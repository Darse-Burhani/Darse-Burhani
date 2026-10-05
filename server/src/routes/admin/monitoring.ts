import { Router } from "express";
import prisma from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const data = await cache.getOrSet(
      "admin:monitoring",
      async () => {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date(todayStart.getTime() + 86400000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
        const oneDayAgo = new Date(now.getTime() - 86400000);

        const totalStudents = await prisma.studentProfile.count();
        const activeTeachers = await prisma.teacherProfile.count();

        const [present, late, absent, earlyDeparture, totalRecords] = await Promise.all([
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
        ]);

        const topPerformers = await prisma.studentProfile.findMany({
          take: 5,
          orderBy: { currentPoints: "desc" },
          include: { user: { select: { firstName: true, lastName: true } } },
        });

        const pointsByCategory = await prisma.pointLog.groupBy({
          by: ["category", "actionType"],
          where: { createdAt: { gte: thirtyDaysAgo } },
          _sum: { points: true },
          _count: true,
        });

        const activeSessions = await prisma.session.count({
          where: { expires: { gt: now }, createdAt: { gte: oneDayAgo } },
        });

        const linkedStudents = await prisma.parentStudentLink.count();

        const totalSessions = await prisma.session.count({
          where: { expires: { gt: now } },
        });

        const biometricDevices = await prisma.biometricDevice.findMany({
          where: { enabled: true },
          select: { id: true, name: true, status: true, lastError: true, lastSeenAt: true },
        });

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

        return {
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
            unlinkedStudents: totalStudents - linkedStudents,
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
        };
      },
      { ttl: 15_000, tags: ["stats", "monitoring"] }
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Admin monitoring error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch monitoring data" });
  }
});

export default router;
