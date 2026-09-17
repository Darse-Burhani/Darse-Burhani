import { Router } from "express";
import prisma from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/admin/analytics - Aggregated trends for the admin analytics dashboard
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt((req.query.days as string) || "30", 10), 7), 90);

    const data = await cache.getOrSet(
      `admin:analytics:${days}`,
      async () => {
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() - (days - 1));
        start.setHours(0, 0, 0, 0);
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);

        const [attendanceRecords, pointLogs, statusGroups, classRecords] =
          (await Promise.all([
            prisma.attendanceRecord.findMany({
              where: { date: { gte: start, lt: tomorrow } },
              select: { date: true, status: true },
            }),
            prisma.pointLog.findMany({
              where: { createdAt: { gte: start, lt: tomorrow }, isUndone: false },
              select: { createdAt: true, actionType: true, points: true },
            }),
            prisma.attendanceRecord.groupBy({
              by: ["status"],
              _count: { _all: true },
            }),
            prisma.class.findMany({
              where: { isActive: true },
              select: {
                name: true,
                grade: true,
                section: true,
                attendanceRecords: {
                  select: { status: true },
                },
              },
            }),
          ])) as [
            { date: Date; status: string }[],
            { createdAt: Date; actionType: string; points: number }[],
            { status: string; _count: { _all: number } }[],
            { name: string; grade: string; section: string; attendanceRecords: { status: string }[] }[],
          ];

        const summary = await prisma.$transaction([
          prisma.studentProfile.count(),
          prisma.teacherProfile.count(),
          prisma.class.count({ where: { isActive: true } }),
          prisma.attendanceRecord.count({
            where: { justificationStatus: { not: "NONE" } },
          }),
        ]);

        // Daily attendance trend
        const attendanceMap = new Map<string, { present: number; late: number; absent: number; earlyDeparture: number }>();
        const dateKeys: string[] = [];
        for (let i = 0; i < days; i++) {
          const d = new Date(start);
          d.setDate(start.getDate() + i);
          const key = d.toISOString().slice(0, 10);
          dateKeys.push(key);
          attendanceMap.set(key, { present: 0, late: 0, absent: 0, earlyDeparture: 0 });
        }
        attendanceRecords.forEach((r) => {
          const key = r.date.toISOString().slice(0, 10);
          const entry = attendanceMap.get(key);
          if (!entry) return;
          if (r.status === "PRESENT") entry.present += 1;
          else if (r.status === "LATE") entry.late += 1;
          else if (r.status === "ABSENT") entry.absent += 1;
          else if (r.status === "EARLY_DEPARTURE") entry.earlyDeparture += 1;
        });

        const attendanceTrend = dateKeys.map((key) => {
          const e = attendanceMap.get(key)!;
          const total = e.present + e.late + e.absent + e.earlyDeparture;
          const rate = total > 0 ? Math.round(((e.present + e.late) / total) * 100) : 0;
          return { date: key, ...e, total, rate };
        });

        // Daily points trend
        const pointsMap = new Map<string, { positive: number; negative: number }>();
        dateKeys.forEach((k) => pointsMap.set(k, { positive: 0, negative: 0 }));
        pointLogs.forEach((p) => {
          const key = p.createdAt.toISOString().slice(0, 10);
          const entry = pointsMap.get(key);
          if (!entry) return;
          if (p.actionType === "POSITIVE") entry.positive += p.points;
          else entry.negative += Math.abs(p.points);
        });
        const pointsTrend = dateKeys.map((key) => ({ date: key, ...pointsMap.get(key)! }));

        // Attendance status distribution (all-time)
        const statusDistribution = statusGroups.map((g) => ({
          status: g.status,
          count: g._count._all,
        }));

        // Class attendance rates
        const classAttendance = classRecords
          .map((c) => {
            const total = c.attendanceRecords.length;
            const present = c.attendanceRecords.filter(
              (r) => r.status === "PRESENT" || r.status === "LATE",
            ).length;
            return {
              name: c.name,
              grade: c.grade,
              section: c.section,
              total,
              present,
              rate: total > 0 ? Math.round((present / total) * 100) : 0,
            };
          })
          .sort((a: { rate: number }, b: { rate: number }) => b.rate - a.rate)
          .slice(0, 10);

        const moodDistribution: { mood: string; count: number }[] = [];

        const [students, teachers, activeClasses, justifiedAbsences] = summary;

        return {
          attendanceTrend,
          pointsTrend,
          statusDistribution,
          classAttendance,
          moodDistribution,
          summary: {
            students,
            teachers,
            activeClasses,
            justifiedAbsences,
            atRiskStudents: 0,
          },
        };
      },
      { ttl: 60_000, tags: ["attendanceRecord", "pointLog"] },
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return res.status(500).json({ success: false, error: "Failed to load analytics" });
  }
});

export default router;
