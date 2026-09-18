import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware";

const router = Router();

// POST /api/points - Record point mutations (Quick-Point Modifier)
router.post("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { studentIds, actionType, category, pointsChanged, optionalNote } = body;

    if (!studentIds?.length || !actionType || !category || !pointsChanged) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Resolve teacherProfile for the acting user
    let teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile) {
      // If admin or fallback, find any active teacher profile
      teacherProfile = await prisma.teacherProfile.findFirst({
        where: { user: { isActive: true } },
      });
    }

    if (!teacherProfile) {
      return res.status(400).json({
        success: false,
        error: "No active teacher profile found to award points",
      });
    }

    // Resolve studentProfiles for all provided studentIds (supports userId, id, or studentId)
    const profiles = await prisma.studentProfile.findMany({
      where: {
        OR: [
          { userId: { in: studentIds } },
          { id: { in: studentIds } },
          { studentId: { in: studentIds } },
        ],
      },
    });

    if (profiles.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No matching student profiles found",
      });
    }

    const pointMultiplier = actionType === "POSITIVE" ? 1 : -1;

    // Atomic mutation in transaction
    const results = await prisma.$transaction([
      ...profiles.map((profile) =>
        prisma.pointLog.create({
          data: {
            studentId: profile.id,
            teacherId: teacherProfile.id,
            points: pointsChanged,
            actionType,
            category,
            note: optionalNote || null,
          },
        }),
      ),
      ...profiles.map((profile) =>
        prisma.studentProfile.update({
          where: { id: profile.id },
          data: {
            currentPoints: {
              increment: pointsChanged * pointMultiplier,
            },
            totalPoints:
              actionType === "POSITIVE" ? { increment: pointsChanged } : undefined,
          },
        }),
      ),
    ]);

    // Dispatch in-app & notification-bar alert to each student
    const sign = actionType === "POSITIVE" ? "+" : "-";
    const notificationTitle =
      actionType === "POSITIVE"
        ? `🌟 +${pointsChanged} Points Awarded!`
        : `⚠️ -${pointsChanged} Points Deducted`;
    const notificationBody = `You received ${sign}${pointsChanged} points for ${category}${
      optionalNote ? `: "${optionalNote}"` : "."
    }`;

    await prisma.notification.createMany({
      data: profiles.map((p) => ({
        userId: p.userId,
        type: "POINTS",
        title: notificationTitle,
        body: notificationBody,
        link: "/talabat",
        priority: actionType === "POSITIVE" ? "NORMAL" : "HIGH",
      })),
    });

    return res.status(201).json({
      success: true,
      data: results.slice(0, profiles.length),
    });
  } catch (error) {
    console.error("Points mutation error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to record points",
    });
  }
});

// GET /api/points - Get point logs
router.get("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;

    const studentId = req.query.studentId as string;
    const limit = parseInt((req.query.limit as string) || "20");

    const where: Record<string, unknown> = {};
    if (studentId) where.studentId = studentId;

    const logs = await prisma.pointLog.findMany({
      where,
      include: {
        teacher: {
          select: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return res.json({ success: true, data: logs });
  } catch (error) {
    console.error("Points fetch error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch points",
    });
  }
});

// PUT /api/points/undo - Undo a point mutation
router.put("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { pointLogIds } = body;

    if (!pointLogIds?.length) {
      return res.status(400).json({
        success: false,
        error: "Missing point log IDs",
      });
    }

    const logs = await prisma.pointLog.findMany({
      where: { id: { in: pointLogIds }, isUndone: false },
      select: { id: true, actionType: true, points: true, studentId: true },
    });

    const pointLogIdsToUpdate = logs.map((log) => log.id);
    const studentUpdates = logs.map((log) => ({
      where: { id: log.studentId },
      data: {
        currentPoints: {
          increment: log.actionType === "POSITIVE" ? -log.points : log.points,
        },
      },
    }));

    const undoResults = await prisma.$transaction([
      prisma.pointLog.updateMany({
        where: { id: { in: pointLogIdsToUpdate } },
        data: { isUndone: true },
      }),
      ...studentUpdates.map((update) => prisma.studentProfile.update(update)),
    ]);

    return res.json({ success: true, data: undoResults });
  } catch (error) {
    console.error("Points undo error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to undo points",
    });
  }
});

export default router;
