import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { getAudienceType } from "../../lib/biometric";

const router = Router();

// GET /api/teacher/my-attendance — returns the logged-in teacher's own attendance records
// Query params:
//   month=YYYY-MM  (default: current month)
//   limit=N        (default: 90)
router.get("/", requireRole("TEACHER", "ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    // Parse optional month filter (e.g. ?month=2026-10)
    const rawMonth = typeof req.query.month === "string" ? req.query.month.trim() : null;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || "90")), 1), 365);

    let dateFilter: { gte?: Date; lt?: Date } = {};
    if (rawMonth && /^\d{4}-\d{2}$/.test(rawMonth)) {
      const [year, month] = rawMonth.split("-").map(Number);
      const start = new Date(Date.UTC(year, month - 1, 1));
      const end = new Date(Date.UTC(year, month, 1));
      dateFilter = { gte: start, lt: end };
    } else {
      // Default: last 90 days
      const cutoff = new Date();
      cutoff.setUTCDate(cutoff.getUTCDate() - 90);
      dateFilter = { gte: cutoff };
    }

    const records = await prisma.teacherAttendanceRecord.findMany({
      where: {
        teacherId: teacherProfile.id,
        date: dateFilter,
      },
      orderBy: { date: "desc" },
      take: limit,
    });

    // Compute quick summary stats
    const total = records.length;
    const present = records.filter((r) => r.status === "PRESENT").length;
    const late = records.filter((r) => r.status === "LATE").length;
    const absent = records.filter((r) => r.status === "ABSENT").length;
    const onLeave = records.filter((r) => r.status === "ON_LEAVE" || r.status === "MEDICAL").length;

    // Fetch all active scan schedules applicable to faculty (FACULTY or BOTH)
    const allWindows = await prisma.biometricScanWindow.findMany({
      where: { enabled: true },
      orderBy: { startTime: "asc" },
    });
    const facultyWindows = allWindows.filter((w) => {
      const aud = getAudienceType(w);
      return aud === "BOTH" || aud === "FACULTY";
    });

    const schedules = facultyWindows.map((w) => {
      const aud = getAudienceType(w);
      const isCustomFaculty = Boolean(w.facultyStartTime && w.facultyEndTime);
      const startTime = isCustomFaculty ? (w.facultyStartTime as string) : w.startTime;
      const endTime = isCustomFaculty ? (w.facultyEndTime as string) : w.endTime;
      const lateEndTime = isCustomFaculty ? ((w as any).facultyLateEndTime || w.facultyEndTime) : ((w as any).lateEndTime || w.endTime);

      const [sh, sm] = (startTime || "07:00").split(":").map(Number);
      const [lh, lm] = (lateEndTime || "08:30").split(":").map(Number);
      const sMin = (sh || 0) * 60 + (sm || 0);
      const lMin = (lh || 0) * 60 + (lm || 0);

      const matchedRecords = records.filter((r) => {
        if (!r.checkInTime) return false;
        const cd = new Date(r.checkInTime);
        const punchMin = (cd.getUTCHours() * 60 + cd.getUTCMinutes() + 330) % 1440;
        return punchMin >= Math.max(0, sMin - 120) && punchMin <= lMin;
      });

      const onTime = matchedRecords.filter((r) => r.status === "PRESENT").length;
      const lateCount = matchedRecords.filter((r) => r.status === "LATE").length;
      const totalDays = total || 1;
      const percentage = totalDays > 0 ? Math.round(((onTime + lateCount) / totalDays) * 100) : 0;

      return {
        id: w.id,
        name: w.name,
        startTime,
        endTime,
        lateEndTime,
        audience: aud,
        stats: {
          total: totalDays,
          present: onTime,
          late: lateCount,
          missed: Math.max(0, totalDays - onTime - lateCount),
          percentage,
        },
        records: matchedRecords.slice(0, 15).map((r) => ({
          id: r.id,
          date: r.date.toISOString(),
          status: r.status,
          checkInTime: r.checkInTime?.toISOString() || null,
          checkOutTime: r.checkOutTime?.toISOString() || null,
          verificationMethod: r.verificationMethod || "MANUAL",
          biometricMethod: r.biometricMethod || null,
        })),
      };
    });

    return res.json({
      success: true,
      data: {
        teacher: {
          id: teacherProfile.id,
          name: `${teacherProfile.user.firstName} ${teacherProfile.user.lastName}`.trim(),
          email: teacherProfile.user.email,
          avatarUrl: teacherProfile.user.avatarUrl,
          employeeId: teacherProfile.employeeId,
          its: teacherProfile.its,
          department: teacherProfile.department,
        },
        schedules,
        stats: { total, present, late, absent, onLeave },
        records: records.map((r) => ({
          id: r.id,
          date: r.date.toISOString(),
          status: r.status,
          checkInTime: r.checkInTime?.toISOString() || null,
          checkOutTime: r.checkOutTime?.toISOString() || null,
          verificationMethod: r.verificationMethod || "MANUAL",
          biometricMethod: r.biometricMethod || null,
          notes: r.notes || null,
          createdAt: r.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("Teacher my-attendance error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch attendance records" });
  }
});

export default router;
