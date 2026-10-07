import { Router } from "express";
import prisma from "../lib/prisma";
import { requireRole } from "../middleware";
import { requireMigratedTables, sendDbError } from "../lib/prisma-guards";

const router = Router();

// New tables (assignments, grades, skill attempts) need the latest migration.
// Without it, callers get a clear 503 instead of an opaque 500.
router.use(requireMigratedTables);

const SKILL_CATEGORIES = ["criticalThinking", "collaboration", "leadership", "resilience"] as const;

function sanitizeSkill(skill: unknown): string | null {
  if (typeof skill !== "string" || !skill) return null;
  return (SKILL_CATEGORIES as readonly string[]).includes(skill) ? skill : null;
}

// GET /api/assignments — STUDENT: assignments + my grades; STAFF: all + grade counts
router.get("/", requireRole("STUDENT", "ADMIN", "TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const role = session.user.role;

    const assignments = await prisma.assignment.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    if (role === "STUDENT") {
      const student = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true, grade: true, section: true },
      });
      if (!student) return res.status(404).json({ success: false, error: "Student profile not found" });

      const visible = assignments.filter(
        (a) => (!a.grade || !student.grade || a.grade === student.grade) && (!a.section || !student.section || a.section === student.section)
      );
      const grades = await prisma.assignmentGrade.findMany({ where: { studentId: student.id } });
      const gradeMap = new Map(grades.map((g) => [g.assignmentId, g]));
      return res.json({
        success: true,
        data: visible.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          subject: a.subject,
          skillCategory: a.skillCategory,
          maxMarks: a.maxMarks,
          dueDate: a.dueDate?.toISOString() || null,
          grade: a.grade,
          section: a.section,
          createdAt: a.createdAt.toISOString(),
          myGrade: gradeMap.has(a.id)
            ? {
                marks: gradeMap.get(a.id)!.marks,
                feedback: gradeMap.get(a.id)!.feedback,
                updatedAt: gradeMap.get(a.id)!.updatedAt.toISOString(),
              }
            : null,
        })),
      });
    }

    const gradeCounts = await prisma.assignmentGrade.groupBy({
      by: ["assignmentId"],
      _count: true,
    });
    const countMap = new Map(gradeCounts.map((g) => [g.assignmentId, g._count]));
    return res.json({
      success: true,
      data: assignments.map((a) => ({
        id: a.id,
        title: a.title,
        description: a.description,
        subject: a.subject,
        skillCategory: a.skillCategory,
        maxMarks: a.maxMarks,
        dueDate: a.dueDate?.toISOString() || null,
        grade: a.grade,
        section: a.section,
        createdAt: a.createdAt.toISOString(),
        gradedCount: countMap.get(a.id) || 0,
      })),
    });
  } catch (error) {
    return sendDbError(res, error, "[assignments] GET error", "Failed to fetch assignments");
  }
});

// GET /api/assignments/students — STAFF: minimal student directory for grading
router.get("/students", requireRole("ADMIN"), async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const students = await prisma.studentProfile.findMany({
      where: { user: { isActive: true, deletedAt: null } },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
      take: 500,
      select: {
        id: true,
        grade: true,
        section: true,
        its: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    const list = students.map((s) => ({
      id: s.id,
      name: `${s.user.firstName} ${s.user.lastName}`.trim(),
      its: s.its || "",
      grade: s.grade || "",
      section: s.section || "",
    }));
    const filtered = q
      ? list.filter((s) => `${s.name} ${s.its} ${s.grade}${s.section}`.toLowerCase().includes(q))
      : list;
    return res.json({ success: true, data: filtered });
  } catch (error) {
    return sendDbError(res, error, "[assignments] students error", "Failed to fetch students");
  }
});

// POST /api/assignments — STAFF create
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { title, description, subject, skillCategory, maxMarks, dueDate, grade, section } = req.body as Record<string, unknown>;
    if (!title || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ success: false, error: "Assignment title is required" });
    }
    const max = Number(maxMarks);
    const assignment = await prisma.assignment.create({
      data: {
        title: title.trim(),
        description: typeof description === "string" ? description.trim() || null : null,
        subject: typeof subject === "string" ? subject.trim() || null : null,
        skillCategory: sanitizeSkill(skillCategory),
        maxMarks: Number.isFinite(max) && max > 0 ? Math.round(max) : 100,
        dueDate: dueDate ? new Date(dueDate as string) : null,
        grade: typeof grade === "string" ? grade.trim() || null : null,
        section: typeof section === "string" ? section.trim() || null : null,
        createdById: session.user.id,
      },
    });
    return res.status(201).json({ success: true, data: { id: assignment.id } });
  } catch (error) {
    return sendDbError(res, error, "[assignments] POST error", "Failed to create assignment");
  }
});

// PATCH /api/assignments/:id — STAFF update
router.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { title, description, subject, skillCategory, maxMarks, dueDate, grade, section } = req.body as Record<string, unknown>;
    const data: Record<string, unknown> = {};
    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return res.status(400).json({ success: false, error: "Title cannot be empty" });
      }
      data.title = title.trim();
    }
    if (description !== undefined) data.description = typeof description === "string" && description.trim() ? description.trim() : null;
    if (subject !== undefined) data.subject = typeof subject === "string" && subject.trim() ? subject.trim() : null;
    if (skillCategory !== undefined) data.skillCategory = sanitizeSkill(skillCategory);
    if (maxMarks !== undefined) {
      const max = Number(maxMarks);
      if (!Number.isFinite(max) || max <= 0) return res.status(400).json({ success: false, error: "Max marks must be positive" });
      data.maxMarks = Math.round(max);
    }
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate as string) : null;
    if (grade !== undefined) data.grade = typeof grade === "string" && grade.trim() ? grade.trim() : null;
    if (section !== undefined) data.section = typeof section === "string" && section.trim() ? section.trim() : null;

    await prisma.assignment.update({ where: { id: req.params.id }, data: data as never });
    return res.json({ success: true });
  } catch (error) {
    return sendDbError(res, error, "[assignments] PATCH error", "Failed to update assignment", 400);
  }
});

// DELETE /api/assignments/:id — STAFF delete
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.assignment.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (error) {
    return sendDbError(res, error, "[assignments] DELETE error", "Failed to delete assignment", 400);
  }
});

// GET /api/assignments/:id/grades — STAFF: all grades for an assignment with student names
router.get("/:id/grades", requireRole("ADMIN"), async (req, res) => {
  try {
    const grades = await prisma.assignmentGrade.findMany({
      where: { assignmentId: req.params.id },
      orderBy: { updatedAt: "desc" },
    });
    const studentIds = [...new Set(grades.map((g) => g.studentId))];
    const students = await prisma.studentProfile.findMany({
      where: { id: { in: studentIds } },
      select: {
        id: true,
        grade: true,
        section: true,
        its: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    const studentMap = new Map(students.map((s) => [s.id, s]));
    return res.json({
      success: true,
      data: grades.map((g) => {
        const s = studentMap.get(g.studentId);
        return {
          id: g.id,
          studentId: g.studentId,
          studentName: s ? `${s.user.firstName} ${s.user.lastName}`.trim() : "Unknown",
          its: s?.its || "",
          grade: s?.grade || "",
          section: s?.section || "",
          marks: g.marks,
          feedback: g.feedback,
          updatedAt: g.updatedAt.toISOString(),
        };
      }),
    });
  } catch (error) {
    return sendDbError(res, error, "[assignments] grades GET error", "Failed to fetch grades");
  }
});

// POST /api/assignments/:id/grades — STAFF: upsert a student's marks
router.post("/:id/grades", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const assignment = await prisma.assignment.findUnique({ where: { id: req.params.id } });
    if (!assignment) return res.status(404).json({ success: false, error: "Assignment not found" });

    const { studentId, marks, feedback } = req.body as { studentId?: string; marks?: number; feedback?: string };
    if (!studentId) return res.status(400).json({ success: false, error: "Select a student" });
    const m = Number(marks);
    if (!Number.isFinite(m) || m < 0 || m > assignment.maxMarks) {
      return res.status(400).json({ success: false, error: `Marks must be between 0 and ${assignment.maxMarks}` });
    }
    const student = await prisma.studentProfile.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) return res.status(404).json({ success: false, error: "Student not found" });

    const grade = await prisma.assignmentGrade.upsert({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId } },
      create: {
        assignmentId: assignment.id,
        studentId,
        marks: m,
        feedback: typeof feedback === "string" && feedback.trim() ? feedback.trim() : null,
        gradedById: session.user.id,
      },
      update: {
        marks: m,
        feedback: typeof feedback === "string" && feedback.trim() ? feedback.trim() : null,
        gradedById: session.user.id,
      },
    });
    return res.json({ success: true, data: { id: grade.id } });
  } catch (error) {
    return sendDbError(res, error, "[assignments] grade POST error", "Failed to save marks", 400);
  }
});

// GET /api/assignments/skill-attempts/recent — STAFF: view skill Q&A attempts
router.get("/skill-attempts/recent", requireRole("ADMIN"), async (req, res) => {
  try {
    const { studentId, skill } = req.query as { studentId?: string; skill?: string };
    const attempts = await prisma.skillAssessmentAttempt.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(skill ? { skill } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const ids = [...new Set(attempts.map((a) => a.studentId))];
    const students = await prisma.studentProfile.findMany({
      where: { id: { in: ids } },
      select: { id: true, grade: true, section: true, user: { select: { firstName: true, lastName: true } } },
    });
    const map = new Map(students.map((s) => [s.id, s]));
    return res.json({
      success: true,
      data: attempts.map((a) => ({
        id: a.id,
        studentId: a.studentId,
        studentName: map.has(a.studentId)
          ? `${map.get(a.studentId)!.user.firstName} ${map.get(a.studentId)!.user.lastName}`.trim()
          : "Unknown",
        skill: a.skill,
        score: a.score,
        totalQuestions: a.totalQuestions,
        correctAnswers: a.correctAnswers,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return sendDbError(res, error, "[assignments] attempts error", "Failed to fetch attempts");
  }
});

export default router;
