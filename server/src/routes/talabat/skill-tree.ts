
import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { requireMigratedTables, sendDbError } from "../../lib/prisma-guards";

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

    const skillTree = await prisma.skillTreePoint.findUnique({
      where: { studentId: studentProfile.id },
    });

    if (!skillTree) {
      const created = await prisma.skillTreePoint.create({
        data: { studentId: studentProfile.id },
      });
      return res.json({
        success: true,
        data: {
          criticalThinking: created.criticalThinking,
          collaboration: created.collaboration,
          leadership: created.leadership,
          resilience: created.resilience,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        criticalThinking: skillTree.criticalThinking,
        collaboration: skillTree.collaboration,
        leadership: skillTree.leadership,
        resilience: skillTree.resilience,
      },
    });
  } catch (error) {
    console.error("Skill tree error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch skill tree" });
  }
});

const ASSESSABLE_SKILLS = ["criticalThinking", "collaboration", "leadership", "resilience"] as const;

// POST /api/talabat/skill-tree/attempt — submit a skill Q&A result (score 0-100)
router.post("/attempt", requireRole("STUDENT"), requireMigratedTables, async (req, res) => {
  try {
    const session = req.auth!;
    const { skill, score, totalQuestions, correctAnswers } = req.body as {
      skill?: string;
      score?: number;
      totalQuestions?: number;
      correctAnswers?: number;
    };

    if (!skill || !(ASSESSABLE_SKILLS as readonly string[]).includes(skill)) {
      return res.status(400).json({ success: false, error: "Invalid skill category" });
    }
    const pct = Number(score);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ success: false, error: "Score must be between 0 and 100" });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const total = Number(totalQuestions);
    const correct = Number(correctAnswers);
    await prisma.skillAssessmentAttempt.create({
      data: {
        studentId: studentProfile.id,
        skill,
        score: Math.round(pct),
        totalQuestions: Number.isFinite(total) && total > 0 ? Math.round(total) : 0,
        correctAnswers: Number.isFinite(correct) && correct >= 0 ? Math.round(correct) : 0,
      },
    });

    const updated = await prisma.skillTreePoint.upsert({
      where: { studentId: studentProfile.id },
      create: { studentId: studentProfile.id, [skill]: Math.round(pct) },
      update: { [skill]: Math.round(pct) },
    });

    return res.json({
      success: true,
      data: {
        score: Math.round(pct),
        criticalThinking: updated.criticalThinking,
        collaboration: updated.collaboration,
        leadership: updated.leadership,
        resilience: updated.resilience,
      },
    });
  } catch (error) {
    return sendDbError(res, error, "Skill attempt error", "Failed to save assessment");
  }
});

// GET /api/talabat/skill-tree/history — student's own assessment attempts
router.get("/history", requireRole("STUDENT"), requireMigratedTables, async (req, res) => {
  try {
    const session = req.auth!;
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }
    const attempts = await prisma.skillAssessmentAttempt.findMany({
      where: { studentId: studentProfile.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return res.json({
      success: true,
      data: attempts.map((a) => ({
        id: a.id,
        skill: a.skill,
        score: a.score,
        totalQuestions: a.totalQuestions,
        correctAnswers: a.correctAnswers,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return sendDbError(res, error, "Skill history error", "Failed to fetch history");
  }
});

export default router;
