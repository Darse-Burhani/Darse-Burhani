
import prisma from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware";

const router = Router();

// GET /api/admin/tracking/students - Get list of students with attendance performance summaries
router.get("/students", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const students = await prisma.studentProfile.findMany({
      include: {
        user: true,
        attendanceRecords: {
          orderBy: { date: "desc" },
          take: 60,
        },
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
    });

    const data = students
      .filter((s) => s.user)
      .map((s) => {
        const records = s.attendanceRecords || [];
        const total = records.length;
        const present = records.filter((r) => r.status === "PRESENT").length;
        const late = records.filter((r) => r.status === "LATE").length;
        const absent = records.filter((r) => r.status === "ABSENT").length;
        const earlyDep = records.filter((r) => r.status === "EARLY_DEPARTURE").length;

        const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
        const punctuality = present + late > 0 ? Math.round((present / (present + late)) * 100) : 100;

        return {
          id: s.id,
          userId: s.userId,
          studentId: s.studentId,
          its: s.its || s.studentId,
          name: `${s.user.firstName} ${s.user.lastName}`,
          email: s.user.email,
          grade: s.grade,
          section: s.section,
          avatarUrl: s.user.avatarUrl,
          streakDays: s.streakDays || 0,
          totalPoints: s.totalPoints || 0,
          tier: s.tier || "BRONZE",
          metrics: {
            totalDays: total,
            presentDays: present,
            lateDays: late,
            absentDays: absent,
            earlyDepartureDays: earlyDep,
            attendanceRate: rate,
            punctualityRate: punctuality,
          },
          recentRecords: records.slice(0, 15).map((r) => ({
            id: r.id,
            date: r.date.toISOString(),
            status: r.status,
            checkInTime: r.checkInTime?.toISOString() || null,
            method: r.biometricMethod || r.verificationMethod || "Biometric",
            justification: r.justification,
            justificationStatus: r.justificationStatus,
          })),
        };
      });

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Tracking students error:", error);
    return res.status(500).json({ success: false, error: "Failed to load student tracking data" });
  }
});

// GET /api/admin/tracking/teachers - Get list of teachers with performance summaries
router.get("/teachers", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const teachers = await prisma.teacherProfile.findMany({
      include: {
        user: true,
        attendanceRecords: {
          take: 30,
          orderBy: { date: "desc" },
        },
        classes: {
          select: {
            id: true,
            name: true,
            subject: true,
            grade: true,
            section: true,
          },
        },
      },
      orderBy: { user: { firstName: "asc" } },
    });

    const data = teachers
      .filter((t) => t.user)
      .map((t) => {
        const totalClasses = t.classes?.length || 0;
        const isActive = t.user.isActive;
        const records = t.attendanceRecords || [];
        const total = records.length;
        const present = records.filter((r) => r.status === "PRESENT").length;
        const late = records.filter((r) => r.status === "LATE").length;
        const absent = records.filter((r) => r.status === "ABSENT").length;
        const earlyDep = records.filter((r) => r.status === "EARLY_DEPARTURE").length;

        const rate = total > 0 ? Math.round(((present + late) / total) * 100) : (isActive ? 100 : 0);
        const punctuality = present + late > 0 ? Math.round((present / (present + late)) * 100) : 100;

        return {
          id: t.id,
          userId: t.userId,
          employeeId: t.employeeId,
          name: `${t.user.firstName} ${t.user.lastName}`,
          email: t.user.email,
          department: t.department || "Faculty",
          subjects: t.subjects || [],
          avatarUrl: t.user.avatarUrl,
          totalClasses,
          status: isActive ? "ACTIVE" : "INACTIVE",
          metrics: {
            totalDays: total,
            presentDays: present,
            lateDays: late,
            absentDays: absent,
            earlyDepartureDays: earlyDep,
            attendanceRate: rate,
            punctualityRate: punctuality,
            streakDays: 0,
          },
          recentRecords: records.slice(0, 15).map((r) => ({
            id: r.id,
            date: r.date.toISOString(),
            status: r.status,
            checkInTime: r.checkInTime?.toISOString() || null,
            method: r.biometricMethod || r.verificationMethod || "Biometric",
            notes: r.notes,
          })),
          classesSummary: (t.classes || []).map((c) => ({
            id: c.id,
            name: c.name,
            subject: c.subject,
            grade: c.grade,
            section: c.section,
          })),
        };
      });

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Tracking teachers error:", error);
    return res.status(500).json({ success: false, error: "Failed to load teacher tracking data" });
  }
});

export default router;
