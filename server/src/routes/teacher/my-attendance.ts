import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

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
