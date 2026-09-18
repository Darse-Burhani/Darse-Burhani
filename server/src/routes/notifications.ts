import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth;
    if (!session?.user?.id) {
      return res.json({ success: true, data: { notifications: [], unreadCount: 0 } });
    }

    const unreadOnly = (req.query.unreadOnly as string) === "true";

    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    });

    return res.json({ success: true, data: { notifications, unreadCount } });
  } catch (error) {
    console.error("Notifications fetch error:", error);
    return res.json({ success: true, data: { notifications: [], unreadCount: 0 } });
  }
});

router.put("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { notificationIds, markAll } = body;

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, isRead: false },
        data: { isRead: true },
      });
    } else if (notificationIds?.length) {
      await prisma.notification.updateMany({
        where: { id: { in: notificationIds }, userId: session.user.id },
        data: { isRead: true },
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Notifications update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update notifications" });
  }
});

export default router;
