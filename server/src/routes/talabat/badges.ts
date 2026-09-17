import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const allBadges = await prisma.badge.findMany({
      where: { isActive: true },
      orderBy: { tier: "asc" },
    });

    const progress = await prisma.badgeProgress.findMany({
      where: { studentId: studentProfile.id },
    });

    const progressMap = new Map(progress.map((p) => [p.badgeId, p]));

    const badges = allBadges.map((badge) => {
      const p = progressMap.get(badge.id);
      return {
        id: badge.id,
        name: badge.name,
        description: badge.description,
        category: badge.category,
        tier: badge.tier,
        pointsRequired: badge.pointsRequired,
        isEarned: p?.isEarned || false,
        progress: p?.progress || 0,
        earnedAt: p?.earnedAt || null,
      };
    });

    return res.json({ success: true, data: badges });
  } catch (error) {
    console.error("Badges error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch badges" });
  }
});

export default router;
