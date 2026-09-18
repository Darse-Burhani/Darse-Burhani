import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const oneDayAgo = new Date(now.getTime() - 86400000);

    const [
      totalStudents,
      activeTeachers,
      attendanceBreakdown,
      atRiskStudents,
      topPerformers,
      pointsByCategory,
      activeSessions,
      parentLinkage,
      totalSessions,
      biometricDevices,
    ] = await Promise.all([
      // Total students
      prisma.studentProfile.count(),

      // Active teachers
      prisma.teacherProfile.count(),

      // Attendance breakdown today
      Promise.all([
        prisma.attendanceRecord.count({
          where: { date: { gte: todayStart, lt: todayEnd }, status: "PRESENT" },
        }),
        prisma.attendanceRecord.count({
          where: { date: { gte: todayStart, lt: todayEnd }, status: "LATE" },
        }),
        prisma.attendanceRecord.count({
          where: { date: { gte: todayStart, lt: todayEnd }, status: "ABSENT" },
        }),
        prisma.attendanceRecord.count({
          where: { date: { gte: todayStart, lt: todayEnd }, status: "EARLY_DEPARTURE" },
        }),
        prisma.attendanceRecord.count({
          where: { date: { gte: todayStart, lt: todayEnd } },
        }),
      ]),

      Promise.resolve([]),

      // Top 5 performers
      prisma.studentProfile.findMany({
        take: 5,
        orderBy: { currentPoints: "desc" },
        include: { user: { select: { firstName: true, lastName: true } } },
      }),

      // Points by category in last 30 days
      prisma.pointLog.groupBy({
        by: ["category", "actionType"],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _sum: { points: true },
        _count: true,
      }),

      // Active sessions (last 24h)
      prisma.session.count({
        where: { expires: { gt: now }, createdAt: { gte: oneDayAgo } },
      }),

      // Parent linkage
      Promise.all([
        prisma.parentStudentLink.count(),
        prisma.studentProfile.count(),
      ]),

      // Total active sessions
      prisma.session.count({
        where: { expires: { gt: now } },
      }),

      // Enabled biometric devices
      prisma.biometricDevice.findMany({
        where: { enabled: true },
        select: { id: true, name: true, status: true, lastError: true, lastSeenAt: true },
      }),
    ]);

    const [present, late, absent, earlyDeparture, totalRecords] = attendanceBreakdown;
    const [linkedStudents, totalStudentCount] = parentLinkage;
    const devices = (biometricDevices || []) as Array<{ id: string; name: string; status: string; lastError: string | null; lastSeenAt: Date | null }>;

    const failingDevices = devices.filter((d) => d.status === "ERROR" || d.status === "OFFLINE");
    const systemAlerts: { type: "WARNING" | "ERROR"; title: string; message: string; link?: string }[] = [];
    if (failingDevices.length > 0) {
      systemAlerts.push({
        type: "WARNING",
        title: "Biometric Hardware Alert",
        message: `${failingDevices.length} terminal(s) offline or reporting errors: ${failingDevices.map((d) => `${d.name} (${d.status}${d.lastError ? `: ${d.lastError}` : ""})`).join(", ")}`,
        link: "/admin/biometric",
      });
    }

    const attendanceRate = totalRecords > 0 ? ((present / totalRecords) * 100).toFixed(1) : "0";

    return res.json({
      success: true,
      data: {
        overview: {
          totalStudents,
          activeTeachers,
          attendanceRate: `${attendanceRate}%`,
          presentToday: present,
          lateToday: late,
          absentToday: absent,
          earlyDepartureToday: earlyDeparture,
          totalAttendanceRecords: totalRecords,
          atRiskCount: 0,
          activeSessions,
          totalActiveSessions: totalSessions,
          linkedStudents,
          unlinkedStudents: totalStudentCount - linkedStudents,
        },
        atRiskStudents: [],
        topPerformers: topPerformers.map((s) => ({
          id: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`,
          grade: s.grade,
          section: s.section,
          points: s.currentPoints,
          totalPoints: s.totalPoints,
          tier: s.tier,
        })),
        pointsByCategory: pointsByCategory.map((p) => ({
          category: p.category,
          actionType: p.actionType,
          totalPoints: p._sum.points || 0,
          count: p._count,
        })),
        systemAlerts,
        devicesStatus: {
          total: devices.length,
          online: devices.filter((d) => d.status === "ONLINE").length,
          failing: failingDevices.length,
        },
      },
    });
  } catch (error) {
    console.error("Admin monitoring error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch monitoring data" });
  }
});

export default router;
