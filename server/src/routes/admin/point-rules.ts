import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { apiCacheMiddleware, cache } from "../../lib/cache";

const router = Router();

// 1. GET /api/admin/point-rules - List all scoring matrix rules
router.get(
  "/",
  requireRole("ADMIN"),
  apiCacheMiddleware({ ttlMs: 60_000, tags: ["point-rules"] }),
  async (req, res) => {
    try {
      const rules = await prisma.pointMatrix.findMany({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { actionName: "asc" }],
      });

      return res.json({ success: true, data: rules });
    } catch (error) {
      console.error("Point rules fetch error:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch rules" });
    }
  }
);

// 2. POST /api/admin/point-rules - Create or update a rule
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const body = req.body as Record<string, any>;
    const { id, category, actionName, pointValue, actionType, color, iconName } = body;

    if (!category || !actionName || pointValue === undefined || !actionType) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const rule = id
      ? await prisma.pointMatrix.update({
          where: { id },
          data: {
            category: category.trim(),
            actionName: actionName.trim(),
            pointValue: Math.abs(parseInt(pointValue, 10)),
            actionType,
            color: color || (actionType === "POSITIVE" ? "#10b981" : "#ef4444"),
            iconName: iconName || "star",
            isActive: true,
          },
        })
      : await prisma.pointMatrix.create({
          data: {
            category: category.trim(),
            actionName: actionName.trim(),
            pointValue: Math.abs(parseInt(pointValue, 10)),
            actionType,
            color: color || (actionType === "POSITIVE" ? "#10b981" : "#ef4444"),
            iconName: iconName || "star",
            isActive: true,
          },
        });

    cache.invalidateTag("point-rules");

    return res.json({ success: true, data: rule });
  } catch (error) {
    console.error("Point rule save error:", error);
    return res.status(500).json({ success: false, error: "Failed to save rule" });
  }
});

// 3. DELETE /api/admin/point-rules/:id - Remove or deactivate a rule
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "Rule ID is required" });
    }

    // Check if logs exist for this matrix rule
    const logCount = await prisma.pointLog.count({ where: { matrixId: id } });
    if (logCount > 0) {
      // Soft-delete by setting isActive: false to preserve history integrity
      await prisma.pointMatrix.update({
        where: { id },
        data: { isActive: false },
      });
    } else {
      await prisma.pointMatrix.delete({ where: { id } });
    }

    cache.invalidateTag("point-rules");
    return res.json({ success: true, message: "Rule deleted successfully" });
  } catch (error) {
    console.error("Point rule delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete rule" });
  }
});

// 4. GET /api/admin/point-rules/talabat - Get all Talabat with their point profile
router.get(
  "/talabat",
  requireRole("ADMIN"),
  apiCacheMiddleware({ ttlMs: 15_000, tags: ["studentprofile", "pointlog"] }),
  async (req, res) => {
    try {
      const students = await prisma.studentProfile.findMany({
        where: {
          user: {
            isActive: true,
            deletedAt: null,
          },
        },
        orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
            },
          },
          pointLogs: {
            where: { isUndone: false },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              points: true,
              actionType: true,
              category: true,
              note: true,
              createdAt: true,
            },
          },
        },
      });

      const formatted = students.map((s) => ({
        id: s.id,
        userId: s.user.id,
        studentId: s.studentId,
        name: `${s.user.firstName} ${s.user.lastName}`.trim(),
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        email: s.user.email,
        avatarUrl: s.user.avatarUrl,
        grade: s.grade,
        section: s.section,
        its: s.its,
        currentPoints: s.currentPoints,
        totalPoints: s.totalPoints,
        tier: s.tier,
        streakDays: s.streakDays,
        recentLogs: s.pointLogs,
      }));

      return res.json({ success: true, data: formatted });
    } catch (error) {
      console.error("Talabat points fetch error:", error);
      return res.status(500).json({ success: false, error: "Failed to fetch Talabat" });
    }
  }
);

// 5. POST /api/admin/point-rules/assign - Dynamic point assignment on decided actions
router.post("/assign", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as Record<string, any>;
    const { studentIds, matrixId, actionName, category, points, actionType, note } = body;

    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, error: "At least one student must be selected" });
    }

    if (!actionName || !category || points === undefined || !actionType) {
      return res.status(400).json({ success: false, error: "Missing required point action fields" });
    }

    const pointAmount = Math.abs(parseInt(points, 10));
    if (isNaN(pointAmount) || pointAmount <= 0) {
      return res.status(400).json({ success: false, error: "Points must be a positive number" });
    }

    // Resolve teacherProfile for the acting admin/teacher
    let teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile) {
      teacherProfile = await prisma.teacherProfile.findFirst({
        where: { user: { isActive: true } },
      });
    }

    if (!teacherProfile) {
      return res.status(400).json({
        success: false,
        error: "No active teacher profile found to record points mutation",
      });
    }

    // Find all student profiles
    const studentProfiles = await prisma.studentProfile.findMany({
      where: {
        id: { in: studentIds },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (studentProfiles.length === 0) {
      return res.status(404).json({ success: false, error: "No matching students found" });
    }

    const pointMultiplier = actionType === "POSITIVE" ? 1 : -1;
    const delta = pointAmount * pointMultiplier;

    // Helper to calculate tier
    const calculateTier = (totalPts: number) => {
      if (totalPts >= 500) return "PLATINUM";
      if (totalPts >= 250) return "GOLD";
      if (totalPts >= 100) return "SILVER";
      return "BRONZE";
    };

    // Execute atomic transaction for all selected Talabat
    const createdLogs = await prisma.$transaction(async (tx) => {
      const logs = [];

      for (const student of studentProfiles) {
        // Create point log
        const log = await tx.pointLog.create({
          data: {
            studentId: student.id,
            teacherId: teacherProfile!.id,
            matrixId: matrixId || null,
            points: pointAmount,
            actionType,
            category: `${category}: ${actionName}`,
            note: note ? note.trim() : null,
          },
        });
        logs.push(log);

        const newCurrent = Math.max(0, student.currentPoints + delta);
        const newTotal = actionType === "POSITIVE" ? student.totalPoints + pointAmount : student.totalPoints;
        const newTier = calculateTier(newTotal);

        await tx.studentProfile.update({
          where: { id: student.id },
          data: {
            currentPoints: newCurrent,
            totalPoints: newTotal,
            tier: newTier,
          },
        });
      }

      return logs;
    });

    // Create notifications for students
    const sign = actionType === "POSITIVE" ? "+" : "-";
    const notificationTitle =
      actionType === "POSITIVE"
        ? `🌟 +${pointAmount} Points Awarded!`
        : `⚠️ -${pointAmount} Points Deducted`;
    const notificationBody = `You were assigned ${sign}${pointAmount} points for "${actionName}" (${category})${
      note ? `: ${note}` : ""
    }`;

    await prisma.notification.createMany({
      data: studentProfiles.map((p) => ({
        userId: p.user.id,
        type: "POINTS",
        title: notificationTitle,
        body: notificationBody,
        link: "/talabat",
        priority: actionType === "POSITIVE" ? "NORMAL" : "HIGH",
      })),
    });

    // Invalidate caches
    cache.invalidateTag("studentprofile");
    cache.invalidateTag("pointlog");
    cache.invalidateTag("dashboard");

    return res.status(201).json({
      success: true,
      message: `Successfully assigned ${sign}${pointAmount} points to ${studentProfiles.length} student(s)`,
      data: createdLogs,
    });
  } catch (error) {
    console.error("Point assign error:", error);
    return res.status(500).json({ success: false, error: "Failed to assign points" });
  }
});

// 6. GET /api/admin/point-rules/logs - Get recent points history with undo support
router.get("/logs", requireRole("ADMIN"), async (req, res) => {
  try {
    const limit = parseInt((req.query.limit as string) || "50", 10);
    const logs = await prisma.pointLog.findMany({
      take: Math.min(limit, 100),
      orderBy: { createdAt: "desc" },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatarUrl: true,
              },
            },
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        matrix: true,
      },
    });

    return res.json({ success: true, data: logs });
  } catch (error) {
    console.error("Point logs fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch point history" });
  }
});

// 7. POST /api/admin/point-rules/undo - Revert point transactions
router.post("/undo", requireRole("ADMIN"), async (req, res) => {
  try {
    const { logIds } = req.body as { logIds: string[] };
    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.status(400).json({ success: false, error: "Missing log IDs to undo" });
    }

    const logs = await prisma.pointLog.findMany({
      where: { id: { in: logIds }, isUndone: false },
      include: { student: true },
    });

    if (logs.length === 0) {
      return res.status(400).json({ success: false, error: "No active logs found to undo" });
    }

    await prisma.$transaction(async (tx) => {
      for (const log of logs) {
        // Reverse point effect
        const revertDelta = log.actionType === "POSITIVE" ? -log.points : log.points;
        const newCurrent = Math.max(0, log.student.currentPoints + revertDelta);

        await tx.studentProfile.update({
          where: { id: log.studentId },
          data: { currentPoints: newCurrent },
        });

        await tx.pointLog.update({
          where: { id: log.id },
          data: { isUndone: true },
        });
      }
    });

    cache.invalidateTag("studentprofile");
    cache.invalidateTag("pointlog");
    cache.invalidateTag("dashboard");

    return res.json({ success: true, message: `Successfully undid ${logs.length} point entry(s)` });
  } catch (error) {
    console.error("Point undo error:", error);
    return res.status(500).json({ success: false, error: "Failed to undo points" });
  }
});

export default router;
