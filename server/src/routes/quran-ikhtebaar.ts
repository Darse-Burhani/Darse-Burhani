import { Router, Response } from "express";
import prisma from "../lib/prisma";
import { requireAuth, requireRole, AuthedRequest } from "../middleware";

const router = Router();

function inferDarajahFromGrade(grade?: string | null): number {
  const g = (grade || "").toLowerCase();
  if (g.includes("1") || g.includes("oola") || g.includes("الأولى")) return 1;
  if (g.includes("2") || g.includes("saniya") || g.includes("الثانية")) return 2;
  if (g.includes("3") || g.includes("salisa") || g.includes("الثالثة")) return 3;
  if (g.includes("4") || g.includes("rabia") || g.includes("الرابعة")) return 4;
  return 1;
}

function clampMark(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = Number(val);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(10, Math.round(n)));
}

/**
 * GET /api/quran-ikhtebaar/my-talabat?q=...
 * Returns Talabat assigned to the logged-in teacher (or all if Admin filters by teacherId).
 */
router.get(
  "/my-talabat",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  async (req: AuthedRequest, res: Response) => {
    try {
      const search = String(req.query.q || "").trim().toLowerCase();
      const requestedTeacherId = String(req.query.teacherId || "").trim();
      const isAdmin = req.user?.role?.toUpperCase() === "ADMIN";

      let teacherId = requestedTeacherId;
      if (!isAdmin || !teacherId) {
        const tp = await prisma.teacherProfile.findUnique({
          where: { userId: req.user!.id },
          select: { id: true },
        });
        if (!tp && !isAdmin) {
          return res.json({ success: true, data: [], teacherId: null });
        }
        if (tp && !teacherId) {
          teacherId = tp.id;
        }
      }

      const assignments = await prisma.quranIkhtebaarAssignment.findMany({
        where: teacherId ? { teacherId } : undefined,
        include: {
          teacher: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          student: {
            include: {
              user: { select: { firstName: true, lastName: true, isActive: true } },
              quranIkhtebaarSessions: {
                where: teacherId ? { teacherId } : undefined,
                orderBy: { updatedAt: "desc" },
              },
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      });

      const mapped = assignments
        .filter((a) => {
          if (!a.student?.user) return false;
          if (!search) return true;
          const fullName = `${a.student.user.firstName} ${a.student.user.lastName}`.toLowerCase();
          const its = (a.student.its || "").toLowerCase();
          const sid = (a.student.studentId || "").toLowerCase();
          return fullName.includes(search) || its.includes(search) || sid.includes(search);
        })
        .map((a) => {
          const matchingSession =
            a.student.quranIkhtebaarSessions.find(
              (s) => s.nizam === a.nizam && s.darajah === a.darajah
            ) || a.student.quranIkhtebaarSessions[0] || null;

          return {
            assignmentId: a.id,
            teacherId: a.teacherId,
            teacherName: `${a.teacher.user.firstName} ${a.teacher.user.lastName}`.trim(),
            studentId: a.studentId,
            its: a.student.its || a.student.studentId,
            name: `${a.student.user.firstName} ${a.student.user.lastName}`.trim(),
            grade: a.student.grade,
            section: a.student.section,
            nizam: a.nizam === "NEW" ? "NEW" : "OLD",
            darajah: a.darajah,
            session: matchingSession,
          };
        });

      return res.json({
        success: true,
        teacherId: teacherId || null,
        data: mapped,
      });
    } catch (error) {
      console.error("[quran-ikhtebaar/my-talabat] error:", error);
      return res.status(500).json({ success: false, error: "Failed to load assigned talabat" });
    }
  }
);

/**
 * GET /api/quran-ikhtebaar/session?studentId=...&nizam=...&darajah=...&teacherId=...
 * Loads saved exam session so teacher can resume seamlessly.
 */
router.get(
  "/session",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  async (req: AuthedRequest, res: Response) => {
    try {
      const studentId = String(req.query.studentId || "").trim();
      const nizam = String(req.query.nizam || "OLD").toUpperCase() === "NEW" ? "NEW" : "OLD";
      const darajah = Math.min(4, Math.max(1, Number(req.query.darajah) || 1));
      const requestedTeacherId = String(req.query.teacherId || "").trim();
      const isAdmin = req.user?.role?.toUpperCase() === "ADMIN";

      if (!studentId) {
        return res.status(400).json({ success: false, error: "studentId is required" });
      }

      let teacherId = requestedTeacherId;
      if (!teacherId) {
        const tp = await prisma.teacherProfile.findUnique({
          where: { userId: req.user!.id },
          select: { id: true },
        });
        if (!tp) {
          return res.status(403).json({ success: false, error: "Teacher profile not found" });
        }
        teacherId = tp.id;
      }

      if (!isAdmin) {
        const assigned = await prisma.quranIkhtebaarAssignment.findUnique({
          where: { teacherId_studentId: { teacherId, studentId } },
        });
        if (!assigned) {
          return res.status(403).json({ success: false, error: "Student is not assigned to you" });
        }
      }

      const session = await prisma.quranIkhtebaarSession.findUnique({
        where: {
          studentId_teacherId_nizam_darajah: {
            studentId,
            teacherId,
            nizam,
            darajah,
          },
        },
      });

      return res.json({ success: true, data: session });
    } catch (error) {
      console.error("[quran-ikhtebaar/session] error:", error);
      return res.status(500).json({ success: false, error: "Failed to load exam session" });
    }
  }
);

/**
 * POST /api/quran-ikhtebaar/save
 * Saves or resumes individual question marks (Q1-Q6), total, percentage, status & question snapshot.
 */
router.post(
  "/save",
  requireAuth,
  requireRole("TEACHER", "ADMIN"),
  async (req: AuthedRequest, res: Response) => {
    try {
      const {
        studentId,
        teacherId: bodyTeacherId,
        nizam: rawNizam,
        darajah: rawDarajah,
        scores,
        questions,
        status: rawStatus,
      } = req.body || {};

      if (!studentId) {
        return res.status(400).json({ success: false, error: "studentId is required" });
      }

      const isAdmin = req.user?.role?.toUpperCase() === "ADMIN";
      let teacherId = String(bodyTeacherId || "").trim();
      if (!teacherId) {
        const tp = await prisma.teacherProfile.findUnique({
          where: { userId: req.user!.id },
          select: { id: true },
        });
        if (!tp) {
          return res.status(403).json({ success: false, error: "Teacher profile not found" });
        }
        teacherId = tp.id;
      }

      if (!isAdmin) {
        const assigned = await prisma.quranIkhtebaarAssignment.findUnique({
          where: { teacherId_studentId: { teacherId, studentId } },
        });
        if (!assigned) {
          return res.status(403).json({ success: false, error: "Student is not assigned to you" });
        }
      }

      const nizam = String(rawNizam || "OLD").toUpperCase() === "NEW" ? "NEW" : "OLD";
      const darajah = Math.min(4, Math.max(1, Number(rawDarajah) || 1));
      const status = rawStatus === "COMPLETED" ? "COMPLETED" : "IN_PROGRESS";

      const qList = Array.isArray(questions) ? questions : [];
      const scoreObj: Record<string, number | undefined> = scores && typeof scores === "object" ? scores : {};

      const qMarks: (number | null)[] = [0, 1, 2, 3, 4, 5].map((idx) => {
        const qItem = qList[idx];
        const rawVal = qItem?.id ? scoreObj[qItem.id] : scoreObj[`q${idx + 1}`];
        return clampMark(rawVal);
      });

      const totalMarks = qMarks.reduce<number>((sum, m) => sum + (m ?? 0), 0);
      const maxMarks = 60;
      const percentage = Number(((totalMarks / maxMarks) * 100).toFixed(1));

      const saved = await prisma.quranIkhtebaarSession.upsert({
        where: {
          studentId_teacherId_nizam_darajah: {
            studentId,
            teacherId,
            nizam,
            darajah,
          },
        },
        create: {
          studentId,
          teacherId,
          nizam,
          darajah,
          q1Marks: qMarks[0],
          q2Marks: qMarks[1],
          q3Marks: qMarks[2],
          q4Marks: qMarks[3],
          q5Marks: qMarks[4],
          q6Marks: qMarks[5],
          totalMarks,
          maxMarks,
          percentage,
          status,
          questionsSnapshot: qList.length > 0 ? qList : undefined,
          scoresSnapshot: scoreObj,
        },
        update: {
          q1Marks: qMarks[0],
          q2Marks: qMarks[1],
          q3Marks: qMarks[2],
          q4Marks: qMarks[3],
          q5Marks: qMarks[4],
          q6Marks: qMarks[5],
          totalMarks,
          maxMarks,
          percentage,
          status,
          questionsSnapshot: qList.length > 0 ? qList : undefined,
          scoresSnapshot: scoreObj,
        },
      });

      return res.json({ success: true, data: saved });
    } catch (error) {
      console.error("[quran-ikhtebaar/save] error:", error);
      return res.status(500).json({ success: false, error: "Failed to save exam marks" });
    }
  }
);

/**
 * GET /api/quran-ikhtebaar/admin/overview
 * Returns all teachers, all Darajah 1-4 students, and all assignments with individual + total marks & %.
 */
router.get(
  "/admin/overview",
  requireAuth,
  requireRole("ADMIN"),
  async (_req: AuthedRequest, res: Response) => {
    try {
      const [teachers, students, assignments] = await Promise.all([
        prisma.teacherProfile.findMany({
          where: { user: { isActive: true } },
          include: { user: { select: { firstName: true, lastName: true, email: true } } },
          orderBy: [{ user: { firstName: "asc" } }],
        }),
        prisma.studentProfile.findMany({
          where: { user: { isActive: true } },
          include: { user: { select: { firstName: true, lastName: true } } },
          orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
        }),
        prisma.quranIkhtebaarAssignment.findMany({
          include: {
            teacher: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                quranIkhtebaarSessions: { orderBy: { updatedAt: "desc" } },
              },
            },
          },
          orderBy: [{ createdAt: "desc" }],
        }),
      ]);

      const teacherList = teachers.map((t) => ({
        id: t.id,
        name: `${t.user.firstName} ${t.user.lastName}`.trim(),
        its: t.its || t.employeeId,
        department: t.department || t.roleTitle || "Faculty",
      }));

      const studentList = students.map((s) => ({
        id: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`.trim(),
        its: s.its || s.studentId,
        grade: s.grade,
        section: s.section,
        inferredDarajah: inferDarajahFromGrade(s.grade),
      }));

      const assignmentList = assignments.map((a) => {
        const session =
          a.student.quranIkhtebaarSessions.find(
            (s) => s.teacherId === a.teacherId && s.nizam === a.nizam && s.darajah === a.darajah
          ) ||
          a.student.quranIkhtebaarSessions.find((s) => s.teacherId === a.teacherId) ||
          null;

        return {
          id: a.id,
          teacherId: a.teacherId,
          teacherName: `${a.teacher.user.firstName} ${a.teacher.user.lastName}`.trim(),
          teacherIts: a.teacher.its || a.teacher.employeeId,
          studentId: a.studentId,
          studentName: `${a.student.user.firstName} ${a.student.user.lastName}`.trim(),
          studentIts: a.student.its || a.student.studentId,
          grade: a.student.grade,
          section: a.student.section,
          nizam: a.nizam === "NEW" ? "NEW" : "OLD",
          darajah: a.darajah,
          session: session
            ? {
                id: session.id,
                q1Marks: session.q1Marks,
                q2Marks: session.q2Marks,
                q3Marks: session.q3Marks,
                q4Marks: session.q4Marks,
                q5Marks: session.q5Marks,
                q6Marks: session.q6Marks,
                totalMarks: session.totalMarks,
                maxMarks: session.maxMarks,
                percentage: session.percentage,
                status: session.status,
                updatedAt: session.updatedAt,
              }
            : null,
        };
      });

      return res.json({
        success: true,
        data: {
          teachers: teacherList,
          students: studentList,
          assignments: assignmentList,
        },
      });
    } catch (error) {
      console.error("[quran-ikhtebaar/admin/overview] error:", error);
      return res.status(500).json({ success: false, error: "Failed to load Quran management data" });
    }
  }
);

/**
 * POST /api/quran-ikhtebaar/admin/assign
 * Assigns a teacher to one or more Talabat with Nizam & Darajah.
 */
router.post(
  "/admin/assign",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthedRequest, res: Response) => {
    try {
      const { teacherId, studentIds, nizam: rawNizam, darajah: rawDarajah } = req.body || {};
      if (!teacherId || !Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: "teacherId and at least one studentId are required",
        });
      }

      const nizam = String(rawNizam || "OLD").toUpperCase() === "NEW" ? "NEW" : "OLD";
      const explicitDarajah = rawDarajah ? Math.min(4, Math.max(1, Number(rawDarajah))) : null;

      const students = await prisma.studentProfile.findMany({
        where: { id: { in: studentIds } },
        select: { id: true, grade: true },
      });

      const ops = students.map((s) => {
        const darajah = explicitDarajah ?? inferDarajahFromGrade(s.grade);
        return prisma.quranIkhtebaarAssignment.upsert({
          where: {
            teacherId_studentId: { teacherId, studentId: s.id },
          },
          create: {
            teacherId,
            studentId: s.id,
            nizam,
            darajah,
            assignedById: req.user!.id,
          },
          update: {
            nizam,
            darajah,
            assignedById: req.user!.id,
          },
        });
      });

      const results = await prisma.$transaction(ops);
      return res.json({ success: true, count: results.length, data: results });
    } catch (error) {
      console.error("[quran-ikhtebaar/admin/assign] error:", error);
      return res.status(500).json({ success: false, error: "Failed to assign talabat" });
    }
  }
);

/**
 * DELETE /api/quran-ikhtebaar/admin/assign/:id
 */
router.delete(
  "/admin/assign/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthedRequest, res: Response) => {
    try {
      await prisma.quranIkhtebaarAssignment.delete({ where: { id: req.params.id } });
      return res.json({ success: true });
    } catch (error) {
      console.error("[quran-ikhtebaar/admin/assign/:id] error:", error);
      return res.status(500).json({ success: false, error: "Failed to remove assignment" });
    }
  }
);

/**
 * DELETE /api/quran-ikhtebaar/admin/session/:id
 */
router.delete(
  "/admin/session/:id",
  requireAuth,
  requireRole("ADMIN"),
  async (req: AuthedRequest, res: Response) => {
    try {
      await prisma.quranIkhtebaarSession.delete({ where: { id: req.params.id } });
      return res.json({ success: true });
    } catch (error) {
      console.error("[quran-ikhtebaar/admin/session/:id] error:", error);
      return res.status(500).json({ success: false, error: "Failed to reset exam session" });
    }
  }
);

export default router;
