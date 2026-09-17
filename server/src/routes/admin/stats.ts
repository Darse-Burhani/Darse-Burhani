import { Router } from "express";
import prisma from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { requireAuth, requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const data = await cache.getOrSet(
      "admin:stats",
      async () => {
        const [
          totalStudents,
          activeTeachers,
          attendanceToday,
          avgPointsResult,
          recentPointLogs,
        ] = await Promise.all([
          prisma.studentProfile.count(),
          prisma.teacherProfile.count(),
          (async () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const [present, total] = await Promise.all([
              prisma.attendanceRecord.count({
                where: {
                  date: { gte: today, lt: new Date(today.getTime() + 86400000) },
                  status: "PRESENT",
                },
              }),
              prisma.attendanceRecord.count({
                where: {
                  date: { gte: today, lt: new Date(today.getTime() + 86400000) },
                },
              }),
            ]);
            return total > 0 ? ((present / total) * 100).toFixed(1) : "0";
          })(),
          prisma.studentProfile.aggregate({
            _avg: { currentPoints: true },
          }),
          prisma.pointLog.findMany({
            orderBy: { createdAt: "desc" },
            take: 10,
            include: {
              student: {
                select: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
            },
          }),
        ]);

        const avgPoints = avgPointsResult._avg.currentPoints
          ? Math.round(avgPointsResult._avg.currentPoints)
          : 0;

        return {
          totalStudents,
          activeTeachers,
          attendanceToday: `${attendanceToday}%`,
          avgPoints: avgPoints.toString(),
          recentActivity: recentPointLogs.map((log) => ({
            user: `${log.student.user.firstName} ${log.student.user.lastName}`,
            action: `${log.points > 0 ? "+" : ""}${log.points} points`,
            detail: log.category + (log.note ? ` - ${log.note}` : ""),
            type: log.actionType === "POSITIVE" ? "positive" : "negative",
            createdAt: log.createdAt,
          })),
        };
      },
      {
        ttl: 30_000, // 30 seconds — stats change frequently
        tags: ["stats", "studentprofile", "attendanceRecord"],
      },
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Admin stats error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

export default router;
