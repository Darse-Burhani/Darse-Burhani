import { Router } from "express";
import prisma from "../lib/prisma";
import { requireRole } from "../middleware";
import { requireMigratedTables, sendDbError } from "../lib/prisma-guards";

const router = Router();

// New skills tables need the latest migration (clear 503 otherwise).
router.use(requireMigratedTables);

// GET /api/skills/records — STAFF: unified talabat skills record
// (skill-tree %, latest Q&A score per skill, assignment marks avg, hobbies)
router.get("/records", requireRole("ADMIN"), async (req, res) => {
  try {
    const { q, grade } = req.query as { q?: string; grade?: string };

    const students = await prisma.studentProfile.findMany({
      where: {
        user: { isActive: true, deletedAt: null },
        ...(grade ? { grade } : {}),
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
      take: 400,
      select: {
        id: true,
        grade: true,
        section: true,
        its: true,
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    const ids = students.map((s) => s.id);
    if (ids.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const [skillPoints, attempts, grades, hobbies, assignments] = await Promise.all([
      prisma.skillTreePoint.findMany({ where: { studentId: { in: ids } } }),
      prisma.skillAssessmentAttempt.findMany({
        where: { studentId: { in: ids } },
        orderBy: { createdAt: "desc" },
        take: 1200,
      }),
      prisma.assignmentGrade.findMany({
        where: { studentId: { in: ids } },
        include: { assignment: { select: { id: true, title: true, subject: true, maxMarks: true } } },
      }),
      prisma.studentHobby.findMany({
        where: { studentId: { in: ids } },
        orderBy: { createdAt: "desc" },
        take: 2000,
      }),
      prisma.assignment.findMany({
        orderBy: { createdAt: "desc" },
        take: 200,
        select: { id: true, title: true },
      }),
    ]);

    const pointsMap = new Map(skillPoints.map((p) => [p.studentId, p]));

    // Latest attempt per (student, skill)
    const latestByStudentSkill = new Map<string, (typeof attempts)[number]>();
    for (const a of attempts) {
      const key = `${a.studentId}:${a.skill}`;
      if (!latestByStudentSkill.has(key)) latestByStudentSkill.set(key, a);
    }
    const attemptsByStudent = new Map<string, typeof attempts>();
    for (const a of attempts) {
      const list = attemptsByStudent.get(a.studentId) || [];
      if (list.length < 8) {
        list.push(a);
        attemptsByStudent.set(a.studentId, list);
      }
    }

    const gradesByStudent = new Map<string, typeof grades>();
    for (const g of grades) {
      const list = gradesByStudent.get(g.studentId) || [];
      list.push(g);
      gradesByStudent.set(g.studentId, list);
    }

    const hobbiesByStudent = new Map<string, typeof hobbies>();
    for (const h of hobbies) {
      const list = hobbiesByStudent.get(h.studentId) || [];
      list.push(h);
      hobbiesByStudent.set(h.studentId, list);
    }

    const query = (q || "").trim().toLowerCase();

    const records = students
      .map((s) => {
        const name = `${s.user.firstName} ${s.user.lastName}`.trim();
        const pts = pointsMap.get(s.id);
        const sGrades = gradesByStudent.get(s.id) || [];
        const gradedPct =
          sGrades.length > 0
            ? Math.round(
                sGrades.reduce((sum, g) => sum + (g.marks / Math.max(g.assignment.maxMarks, 1)) * 100, 0) /
                  sGrades.length
              )
            : null;
        const sHobbies = hobbiesByStudent.get(s.id) || [];
        const sAttempts = attemptsByStudent.get(s.id) || [];
        return {
          studentId: s.id,
          name,
          its: s.its || "",
          grade: s.grade || "",
          section: s.section || "",
          avatarUrl: s.user.avatarUrl || null,
          skills: {
            criticalThinking: pts?.criticalThinking ?? 0,
            collaboration: pts?.collaboration ?? 0,
            leadership: pts?.leadership ?? 0,
            resilience: pts?.resilience ?? 0,
          },
          latestScores: {
            criticalThinking: latestByStudentSkill.get(`${s.id}:criticalThinking`)?.score ?? null,
            collaboration: latestByStudentSkill.get(`${s.id}:collaboration`)?.score ?? null,
            leadership: latestByStudentSkill.get(`${s.id}:leadership`)?.score ?? null,
            resilience: latestByStudentSkill.get(`${s.id}:resilience`)?.score ?? null,
          },
          assignmentStats: {
            graded: sGrades.length,
            averagePct: gradedPct,
            marks: sGrades.slice(0, 10).map((g) => ({
              assignmentId: g.assignmentId,
              title: g.assignment.title,
              subject: g.assignment.subject,
              marks: g.marks,
              maxMarks: g.assignment.maxMarks,
              feedback: g.feedback,
            })),
          },
          attempts: sAttempts.map((a) => ({
            id: a.id,
            skill: a.skill,
            score: a.score,
            correctAnswers: a.correctAnswers,
            totalQuestions: a.totalQuestions,
            createdAt: a.createdAt.toISOString(),
          })),
          hobbies: sHobbies.map((h) => ({
            id: h.id,
            name: h.name,
            category: h.category,
            level: h.level,
          })),
          totalAssignments: assignments.length,
        };
      })
      .filter((r) =>
        query
          ? `${r.name} ${r.its} ${r.grade}${r.section}`.toLowerCase().includes(query)
          : true
      )
      .slice(0, 200);

    return res.json({ success: true, data: records });
  } catch (error) {
    return sendDbError(res, error, "[skills] records error", "Failed to fetch skills records");
  }
});

export default router;
