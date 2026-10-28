import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware";
import { getVapidPublicKey, isPushConfigured } from "../lib/push";

const router = Router();

router.get("/", async (req, res) => {
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

// GET /api/notifications/push/public-key — VAPID public key for browser subscription
router.get("/push/public-key", requireAuth, (_req, res) => {
  const publicKey = getVapidPublicKey();
  return res.json({
    success: true,
    data: {
      publicKey,
      configured: isPushConfigured() && !!publicKey,
    },
  });
});

// POST /api/notifications/push/subscribe — register a browser push subscription
router.post("/push/subscribe", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const subscription = req.body?.subscription ?? req.body;
    const endpoint = subscription?.endpoint;
    const p256dh = subscription?.keys?.p256dh;
    const auth = subscription?.keys?.auth;

    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ success: false, error: "Invalid push subscription" });
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      create: {
        userId: session.user.id,
        endpoint,
        p256dh,
        auth,
        userAgent: req.headers["user-agent"]?.slice(0, 400) || null,
      },
      update: {
        userId: session.user.id,
        p256dh,
        auth,
        userAgent: req.headers["user-agent"]?.slice(0, 400) || null,
      },
    });

    return res.json({ success: true, data: { subscribed: true } });
  } catch (error) {
    console.error("Push subscribe error:", error);
    return res.status(500).json({ success: false, error: "Failed to save push subscription" });
  }
});

// DELETE /api/notifications/push/subscribe — remove a browser push subscription
router.delete("/push/subscribe", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const endpoint = req.body?.endpoint || req.query.endpoint;
    if (!endpoint || typeof endpoint !== "string") {
      return res.status(400).json({ success: false, error: "Endpoint is required" });
    }
    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.user.id },
    });
    return res.json({ success: true });
  } catch (error) {
    console.error("Push unsubscribe error:", error);
    return res.status(500).json({ success: false, error: "Failed to remove push subscription" });
  }
});

// GET /api/notifications/push/status — whether this user has a registered device
router.get("/push/status", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const count = await prisma.pushSubscription.count({ where: { userId: session.user.id } });
    return res.json({
      success: true,
      data: { configured: isPushConfigured(), devices: count },
    });
  } catch (error) {
    return res.json({ success: true, data: { configured: isPushConfigured(), devices: 0 } });
  }
});

export default router;
