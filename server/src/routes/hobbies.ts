import { Router } from "express";
import prisma from "../lib/prisma";
import { requireRole } from "../middleware";
import { requireMigratedTables, sendDbError } from "../lib/prisma-guards";

const router = Router();

// The student_hobbies table needs the latest migration (clear 503 otherwise).
router.use(requireMigratedTables);

const LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;

function sanitizeLevel(level: unknown): string | null {
  if (typeof level !== "string" || !level) return null;
  return (LEVELS as readonly string[]).includes(level) ? level : null;
}

async function resolveStudentId(sessionUserId: string, role: string, queryStudentId?: string, bodyStudentId?: string) {
  if (role === "STUDENT") {
    const student = await prisma.studentProfile.findUnique({
      where: { userId: sessionUserId },
      select: { id: true },
    });
    return student?.id || null;
  }
  return queryStudentId || bodyStudentId || null;
}

// GET /api/hobbies — STUDENT: own hobbies; STAFF: ?studentId=... or ?all=1
router.get("/", requireRole("STUDENT", "ADMIN", "TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const role = session.user.role;
    const { studentId, all } = req.query as { studentId?: string; all?: string };

    if (role !== "STUDENT" && all === "1") {
      const hobbies = await prisma.studentHobby.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
      });
      const ids = [...new Set(hobbies.map((h) => h.studentId))];
      const students = await prisma.studentProfile.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          grade: true,
          section: true,
          user: { select: { firstName: true, lastName: true } },
        },
      });
      const map = new Map(students.map((s) => [s.id, s]));
      return res.json({
        success: true,
        data: hobbies.map((h) => ({
          id: h.id,
          studentId: h.studentId,
          studentName: map.has(h.studentId)
            ? `${map.get(h.studentId)!.user.firstName} ${map.get(h.studentId)!.user.lastName}`.trim()
            : "Unknown",
          grade: map.get(h.studentId)?.grade || "",
          section: map.get(h.studentId)?.section || "",
          name: h.name,
          category: h.category,
          level: h.level,
          createdAt: h.createdAt.toISOString(),
        })),
      });
    }

    const targetId = await resolveStudentId(session.user.id, role, studentId);
    if (!targetId) return res.status(400).json({ success: false, error: "Select a student" });

    const hobbies = await prisma.studentHobby.findMany({
      where: { studentId: targetId },
      orderBy: { createdAt: "desc" },
    });
    return res.json({
      success: true,
      data: hobbies.map((h) => ({
        id: h.id,
        studentId: h.studentId,
        name: h.name,
        category: h.category,
        level: h.level,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return sendDbError(res, error, "[hobbies] GET error", "Failed to fetch hobbies");
  }
});

// POST /api/hobbies — STUDENT: add own; STAFF: add for a student
router.post("/", requireRole("STUDENT", "ADMIN", "TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const role = session.user.role;
    const { name, category, level, studentId } = req.body as Record<string, unknown>;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, error: "Hobby or skill name is required" });
    }
    if (name.trim().length > 80) {
      return res.status(400).json({ success: false, error: "Name must be under 80 characters" });
    }

    const targetId = await resolveStudentId(session.user.id, role, undefined, typeof studentId === "string" ? studentId : undefined);
    if (!targetId) return res.status(400).json({ success: false, error: "Select a student" });

    const existing = await prisma.studentHobby.count({ where: { studentId: targetId } });
    if (existing >= 20) {
      return res.status(400).json({ success: false, error: "Maximum 20 hobbies & skills per student" });
    }

    const hobby = await prisma.studentHobby.create({
      data: {
        studentId: targetId,
        name: name.trim(),
        category: typeof category === "string" && category.trim() ? category.trim().slice(0, 40) : null,
        level: sanitizeLevel(level),
      },
    });
    return res.status(201).json({ success: true, data: { id: hobby.id } });
  } catch (error) {
    return sendDbError(res, error, "[hobbies] POST error", "Failed to add hobby");
  }
});

// DELETE /api/hobbies/:id — owner student or staff
router.delete("/:id", requireRole("STUDENT", "ADMIN", "TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const hobby = await prisma.studentHobby.findUnique({ where: { id: req.params.id } });
    if (!hobby) return res.status(404).json({ success: false, error: "Not found" });

    if (session.user.role === "STUDENT") {
      const student = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!student || student.id !== hobby.studentId) {
        return res.status(403).json({ success: false, error: "Not allowed" });
      }
    }

    await prisma.studentHobby.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (error) {
    console.error("[hobbies] DELETE error:", error);
    return res.status(400).json({ success: false, error: "Failed to remove" });
  }
});

export default router;
