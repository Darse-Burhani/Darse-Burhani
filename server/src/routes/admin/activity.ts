import { Router } from "express";
import prisma from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { requireAuth, requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const limit = parseInt((req.query.limit as string) || "20");

    const data = await cache.getOrSet(
      `admin:activity:${limit}`,
      async () => {
        const pointLogs = await prisma.pointLog.findMany({
          orderBy: { createdAt: "desc" },
          take: limit,
          include: {
            student: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
        });

        const activities = pointLogs.map((log) => ({
          type: "points" as const,
          user: `${log.student.user.firstName} ${log.student.user.lastName}`,
          action: `${log.points > 0 ? "+" : ""}${log.points} ${log.category}`,
          detail: log.note || "",
          createdAt: log.createdAt,
        }));

        return activities;
      },
      {
        ttl: 15_000, // 15 seconds — activity feed should be fairly fresh
        tags: ["pointlog", "dashboard"],
      },
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Admin activity error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch activity" });
  }
});

export default router;
