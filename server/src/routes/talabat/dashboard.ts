import { Router } from "express";
import prisma from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { requireAuth, requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const [studentProfile, currentUser] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          grade: true,
          section: true,
          currentPoints: true,
          totalPoints: true,
          streakDays: true,
          tier: true,
          // Personal identity for the premium profile card
          its: true,
          trNo: true,
          nameAr: true,
          watan: true,
          residentCity: true,
          bloodGroup: true,
          dobGregorian: true,
          dobHijri: true,
          hafizYear: true,
          status: true,
          age: true,
          mobileNumber: true,
          motherName: true,
          fatherName: true,
        },
      }),
      // Read identity fresh from the DB — the session cookie can hold stale
      // name claims (e.g. after an admin updates the profile).
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true, avatarUrl: true },
      }),
    ]);

    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const firstName = currentUser?.firstName ?? session.user.firstName;
    const lastName = currentUser?.lastName ?? session.user.lastName;
    const avatarUrl = currentUser?.avatarUrl ?? null;

    // Cache the heavy aggregate queries — the profile is unique per student
    const cacheKey = `student:dashboard:${session.user.id}`;

    const data = await cache.getOrSet(
      cacheKey,
      async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today.getTime() + 86400000);

        const [rank, totalStudents, badgeProgress, skillTree] = await Promise.all([
          prisma.studentProfile.count({
            where: { currentPoints: { gt: studentProfile.currentPoints } },
          }),
          prisma.studentProfile.count(),
          prisma.badgeProgress.findMany({
            where: { studentId: studentProfile.id, isEarned: true },
            select: {
              badge: { select: { name: true, tier: true } },
              progress: true,
              isEarned: true,
            },
            take: 4,
            orderBy: { earnedAt: "desc" },
          }),
          prisma.skillTreePoint.findUnique({
            where: { studentId: studentProfile.id },
            select: { criticalThinking: true, collaboration: true, leadership: true, resilience: true },
          }),
        ]);

        return {
          grade: studentProfile.grade,
          section: studentProfile.section,
          currentPoints: studentProfile.currentPoints,
          totalPoints: studentProfile.totalPoints,
          streakDays: studentProfile.streakDays,
          tier: studentProfile.tier,
          // Identity details for the premium profile card
          its: studentProfile.its,
          trNo: studentProfile.trNo,
          nameAr: studentProfile.nameAr,
          watan: studentProfile.watan,
          residentCity: studentProfile.residentCity,
          bloodGroup: studentProfile.bloodGroup,
          dobGregorian: studentProfile.dobGregorian,
          dobHijri: studentProfile.dobHijri,
          hafizYear: studentProfile.hafizYear,
          status: studentProfile.status,
          age: studentProfile.age,
          mobileNumber: studentProfile.mobileNumber,
          motherName: studentProfile.motherName,
          fatherName: studentProfile.fatherName,
          rank: rank + 1,
          totalStudents,
          recentBadges: badgeProgress.map((bp) => ({
            name: bp.badge.name,
            tier: bp.badge.tier,
            earned: bp.isEarned,
            progress: bp.progress,
          })),
          skillTree: skillTree
            ? {
                criticalThinking: skillTree.criticalThinking,
                collaboration: skillTree.collaboration,
                leadership: skillTree.leadership,
                resilience: skillTree.resilience,
              }
            : { criticalThinking: 0, collaboration: 0, leadership: 0, resilience: 0 },
        };
      },
      {
        ttl: 15_000, // 15 seconds — dashboard should load fast but be reasonably fresh
        tags: ["dashboard", "studentprofile", "pointlog"],
      },
    );

    // Identity (name) is merged after the cache read so it is always fresh —
    // the cached payload may otherwise be up to the TTL old.
    return res.json({
      success: true,
      data: { ...data, firstName, lastName, avatarUrl },
    });
  } catch (error) {
    console.error("Student dashboard error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch dashboard" });
  }
});

export default router;
