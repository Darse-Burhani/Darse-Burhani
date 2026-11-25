import { Router, Response } from "express";
import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import ExcelJS from "exceljs";
import prisma from "../lib/prisma";
import { getRepoRoot } from "../lib/paths";
import { requireAuth, requireRole, AuthedRequest } from "../middleware";

const router = Router();

// Real-time event bus & concurrency load telemetry for concurrent Mumtahin uploads
const quranLiveBus = new EventEmitter();
quranLiveBus.setMaxListeners(100);

const loadMetrics = {
  inFlightSaves: 0,
  peakConcurrentSaves: 0,
  totalSavesProcessed: 0,
  lastSaveMs: 0,
  activeListeners: 0,
  lastEventAt: null as string | null,
};

function broadcastQuranSync(event: string, payload: Record<string, unknown>) {
  loadMetrics.lastEventAt = new Date().toISOString();
  quranLiveBus.emit("sync", {
    event,
    payload: {
      ...payload,
      loadMetrics: { ...loadMetrics },
    },
  });
}

function inferDarajahFromGrade(grade?: string | null): number {
  const g = (grade || "").toLowerCase();
  if (g.includes("1") || g.includes("oola") || g.includes("الأولى")) return 1;
  if (g.includes("2") || g.includes("saniya") || g.includes("الثانية")) return 2;
  if (g.includes("3") || g.includes("salisa") || g.includes("الثالثة")) return 3;
  if (g.includes("4") || g.includes("rabia") || g.includes("الرابعة")) return 4;
  return 1;
}

const QURAN_ADMIN_ITS_ALLOWLIST = new Set(["30394078"]); // Mulla Taher bhai Shaikh Muslim bhai Shakir

async function hasQuranAdminAccess(user?: { id: string; role?: string | null }): Promise<boolean> {
  if (!user) return false;
  if (user.role?.toUpperCase() === "ADMIN") return true;
  const tp = await prisma.teacherProfile.findUnique({
    where: { userId: user.id },
    select: {
      its: true,
      employeeId: true,
      portalAssignments: { where: { isActive: true }, select: { portalType: true } },
    },
  });
  if (!tp) return false;
  if ((tp.its && QURAN_ADMIN_ITS_ALLOWLIST.has(tp.its.trim())) || QURAN_ADMIN_ITS_ALLOWLIST.has(tp.employeeId.trim())) {
    return true;
  }
  return tp.portalAssignments.some((a) => {
    const pt = (a.portalType || "").toUpperCase();
    return pt === "ALL" || pt === "PAGE:QURAN-IKHTEBAAR-ADMIN" || pt === "QURAN-IKHTEBAAR-ADMIN";
  });
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
      const isAdmin = await hasQuranAdminAccess(req.auth?.user);

      let teacherId = isAdmin ? requestedTeacherId : "";
      if (!isAdmin || !teacherId) {
        const tp = await prisma.teacherProfile.findUnique({
          where: { userId: req.auth!.user.id },
          select: { id: true },
        });
        if (!tp && !isAdmin) {
          return res.json({ success: true, data: [], teacherId: null });
        }
        if (tp && (!isAdmin || !teacherId)) {
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

      const canManageQuran = await hasQuranAdminAccess(req.auth?.user);

      return res.json({
        success: true,
        canManageQuran,
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
      const isAdmin = await hasQuranAdminAccess(req.auth?.user);

      if (!studentId) {
        return res.status(400).json({ success: false, error: "studentId is required" });
      }

      let teacherId = isAdmin ? requestedTeacherId : "";
      if (!teacherId) {
        const tp = await prisma.teacherProfile.findUnique({
          where: { userId: req.auth!.user.id },
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

      const isAdmin = await hasQuranAdminAccess(req.auth?.user);
      let teacherId = isAdmin ? String(bodyTeacherId || "").trim() : "";
      if (!teacherId) {
        const tp = await prisma.teacherProfile.findUnique({
          where: { userId: req.auth!.user.id },
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
      const clientTs = Number(req.body?.clientTimestamp) || 0;

      const startedAt = Date.now();
      loadMetrics.inFlightSaves += 1;
      if (loadMetrics.inFlightSaves > loadMetrics.peakConcurrentSaves) {
        loadMetrics.peakConcurrentSaves = loadMetrics.inFlightSaves;
      }

      let saved;
      try {
        saved = await prisma.$transaction(async (tx) => {
          const existing = await tx.quranIkhtebaarSession.findUnique({
            where: {
              studentId_teacherId_nizam_darajah: {
                studentId,
                teacherId,
                nizam,
                darajah,
              },
            },
          });

          // Out-of-order retry guard: never let an older delayed retry overwrite a newer committed save
          if (existing && clientTs > 0 && existing.updatedAt.getTime() > clientTs + 2000) {
            return existing;
          }

          return tx.quranIkhtebaarSession.upsert({
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
        });

        loadMetrics.totalSavesProcessed += 1;
        loadMetrics.lastSaveMs = Date.now() - startedAt;
      } finally {
        loadMetrics.inFlightSaves = Math.max(0, loadMetrics.inFlightSaves - 1);
      }

      broadcastQuranSync("marks-updated", {
        sessionId: saved.id,
        studentId: saved.studentId,
        teacherId: saved.teacherId,
        darajah: saved.darajah,
        nizam: saved.nizam,
        totalMarks: saved.totalMarks,
        percentage: saved.percentage,
        status: saved.status,
        updatedAt: saved.updatedAt,
      });

      return res.json({
        success: true,
        data: saved,
        loadMetrics: { ...loadMetrics },
      });
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
  requireRole("ADMIN", "TEACHER"),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (!(await hasQuranAdminAccess(req.auth?.user))) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      const [teachers, students, assignments] = await Promise.all([
        prisma.teacherProfile.findMany({
          where: { user: { isActive: true } },
          include: { user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } } },
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
              include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
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
        avatarUrl: t.user.avatarUrl || null,
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
          teacherAvatarUrl: a.teacher.user.avatarUrl || null,
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
          loadMetrics: { ...loadMetrics },
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
  requireRole("ADMIN", "TEACHER"),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (!(await hasQuranAdminAccess(req.auth?.user))) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
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
            assignedById: req.auth!.user.id,
          },
          update: {
            nizam,
            darajah,
            assignedById: req.auth!.user.id,
          },
        });
      });

      const results = await prisma.$transaction(ops);
      broadcastQuranSync("assignment-updated", { teacherId, count: results.length });
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
  requireRole("ADMIN", "TEACHER"),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (!(await hasQuranAdminAccess(req.auth?.user))) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      await prisma.quranIkhtebaarAssignment.delete({ where: { id: req.params.id } });
      broadcastQuranSync("assignment-updated", { deletedId: req.params.id });
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
  requireRole("ADMIN", "TEACHER"),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (!(await hasQuranAdminAccess(req.auth?.user))) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      await prisma.quranIkhtebaarSession.delete({ where: { id: req.params.id } });
      return res.json({ success: true });
    } catch (error) {
      console.error("[quran-ikhtebaar/admin/session/:id] error:", error);
      return res.status(500).json({ success: false, error: "Failed to reset exam session" });
    }
  }
);

/**
 * GET /api/quran-ikhtebaar/admin/export-excel?teacherId=...
 * Generates either an individual Mumtahin group Excel (when teacherId is provided)
 * or the bulk multi-tab Excel workbook (Summary, Darajah 1-4 tabs, Mumtahin Wise tab).
 */
router.get(
  "/admin/export-excel",
  requireAuth,
  requireRole("ADMIN", "TEACHER"),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (!(await hasQuranAdminAccess(req.auth?.user))) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      const filterTeacherId = typeof req.query.teacherId === "string" ? req.query.teacherId.trim() : "";

      const assignments = await prisma.quranIkhtebaarAssignment.findMany({
        where: filterTeacherId ? { teacherId: filterTeacherId } : undefined,
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
        orderBy: [{ darajah: "asc" }, { createdAt: "asc" }],
      });

      const rows = assignments.map((a) => {
        const session =
          a.student.quranIkhtebaarSessions.find(
            (s) => s.teacherId === a.teacherId && s.nizam === a.nizam && s.darajah === a.darajah
          ) ||
          a.student.quranIkhtebaarSessions.find((s) => s.teacherId === a.teacherId) ||
          null;

        return {
          teacherId: a.teacherId,
          teacherIts: a.teacher.its || a.teacher.employeeId,
          teacherName: `${a.teacher.user.firstName} ${a.teacher.user.lastName}`.trim(),
          studentIts: a.student.its || a.student.studentId,
          studentName: `${a.student.user.firstName} ${a.student.user.lastName}`.trim(),
          darajah: a.darajah,
          nizam: session?.nizam || a.nizam,
          q1: session?.q1Marks ?? null,
          q2: session?.q2Marks ?? null,
          q3: session?.q3Marks ?? null,
          q4: session?.q4Marks ?? null,
          q5: session?.q5Marks ?? null,
          q6: session?.q6Marks ?? null,
          total: session ? session.totalMarks : null,
          percentage: session ? session.percentage : null,
          status: session?.status || "PENDING",
        };
      });

      const wb = new ExcelJS.Workbook();
      wb.creator = "Darse Burhani";
      wb.created = new Date();

      const headerFill: ExcelJS.Fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF221C14" },
      };
      const headerFont: Partial<ExcelJS.Font> = {
        bold: true,
        color: { argb: "FFFCD468" },
        size: 11,
      };
      const mumtahinFill: ExcelJS.Fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF8E7" },
      };
      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "FFE7E0D0" } },
        left: { style: "thin", color: { argb: "FFE7E0D0" } },
        bottom: { style: "thin", color: { argb: "FFE7E0D0" } },
        right: { style: "thin", color: { argb: "FFE7E0D0" } },
      };

      // Individual Mumtahin Group Export (when teacherId is specified)
      if (filterTeacherId) {
        const tName = rows[0]?.teacherName || "Mumtahin";
        const tIts = rows[0]?.teacherIts || "";
        const ws = wb.addWorksheet("Mumtahin Marks", {
          views: [{ state: "frozen", ySplit: 4 }],
          pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 },
        });

        const cols = [
          { key: "sr", width: 6 },
          { key: "its", width: 13 },
          { key: "name", width: 32 },
          { key: "darajah", width: 12 },
          { key: "nizam", width: 11 },
          { key: "q1", width: 10 },
          { key: "q2", width: 10 },
          { key: "q3", width: 10 },
          { key: "q4", width: 10 },
          { key: "q5", width: 10 },
          { key: "q6", width: 10 },
          { key: "total", width: 12 },
          { key: "pct", width: 10 },
          { key: "status", width: 14 },
        ];
        ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));

        ws.mergeCells(1, 1, 1, 14);
        const titleCell = ws.getCell(1, 1);
        titleCell.value = "الامتحان الشفوي لحفظ القرآن الكريم ٤٨-١٤٤٧ھ";
        titleCell.font = { name: "Al-Kanz", size: 17, bold: true, color: { argb: "FFFCD468" } };
        titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2545" } };
        titleCell.alignment = { vertical: "middle", horizontal: "center", readingOrder: "rtl" };
        ws.getRow(1).height = 30;

        ws.mergeCells(2, 1, 2, 14);
        const infoCell = ws.getCell(2, 1);
        const completedRows = rows.filter((r) => r.status === "COMPLETED");
        const avgPct =
          completedRows.length > 0
            ? Math.round(completedRows.reduce((s, r) => s + (r.percentage || 0), 0) / completedRows.length)
            : 0;
        infoCell.value = `Mumtahin: ${tName}${tIts ? ` (ITS: ${tIts})` : ""}   ·   Assigned: ${rows.length}   ·   Completed: ${completedRows.length}/${rows.length}${completedRows.length > 0 ? `   ·   Avg: ${avgPct}%` : ""}`;
        infoCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF221C12" } };
        infoCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF7F0" } };
        infoCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
        ws.getRow(2).height = 24;

        ws.getRow(3).height = 6;

        const headers = [
          "Sr.",
          "ITS",
          "Talib Name",
          "Darajah",
          "Nizam",
          "Q1 (10)",
          "Q2 (10)",
          "Q3 (10)",
          "Q4 (10)",
          "Q5 (10)",
          "Q6 (10)",
          "Total (60)",
          "%",
          "Status",
        ];
        const hdrRow = ws.getRow(4);
        hdrRow.height = 26;
        headers.forEach((h, i) => {
          const c = hdrRow.getCell(i + 1);
          c.value = h;
          c.font = headerFont;
          c.fill = headerFill;
          c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          c.border = thinBorder;
        });

        ws.autoFilter = {
          from: { row: 4, column: 1 },
          to: { row: Math.max(4, 4 + rows.length), column: 14 },
        };

        const sorted = [...rows].sort(
          (a, b) => a.darajah - b.darajah || a.studentName.localeCompare(b.studentName)
        );
        sorted.forEach((r, idx) => {
          const row = ws.addRow([
            idx + 1,
            r.studentIts,
            r.studentName,
            `Darajah ${r.darajah}`,
            r.nizam,
            r.q1 ?? "",
            r.q2 ?? "",
            r.q3 ?? "",
            r.q4 ?? "",
            r.q5 ?? "",
            r.q6 ?? "",
            r.total ?? "",
            r.percentage !== null ? `${r.percentage}%` : "",
            r.status,
          ]);
          row.height = 23;
          const isAlt = idx % 2 === 1;
          row.eachCell((cell, colNumber) => {
            cell.font = {
              name: "Calibri",
              size: 10.5,
              bold: colNumber === 3 || colNumber === 12,
              color: { argb: "FF221C12" },
            };
            if (isAlt) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF7F0" } };
            }
            cell.border = thinBorder;
            cell.alignment = {
              vertical: "middle",
              horizontal: colNumber === 3 ? "left" : "center",
              indent: colNumber === 3 ? 1 : 0,
            };
          });
        });

        const safeSlug = tName.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "Mumtahin";
        const singleBuffer = await wb.xlsx.writeBuffer();
        res.setHeader(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="Quran_Ikhtebaar_${safeSlug}_Marks.xlsx"`
        );
        return res.send(Buffer.from(singleBuffer));
      }

      // 1. Summary Tab
      const summaryWs = wb.addWorksheet("Summary");
      summaryWs.columns = [
        { header: "Darajah", key: "darajah", width: 22 },
        { header: "Assigned Talabat", key: "assigned", width: 18 },
        { header: "Completed", key: "completed", width: 14 },
        { header: "In Progress", key: "inProgress", width: 14 },
        { header: "Pending", key: "pending", width: 14 },
        { header: "Avg Total (60)", key: "avgTotal", width: 16 },
        { header: "Avg %", key: "avgPct", width: 12 },
      ];
      summaryWs.getRow(1).eachCell((c) => {
        c.fill = headerFill;
        c.font = headerFont;
        c.alignment = { vertical: "middle", horizontal: "center" };
      });
      summaryWs.getRow(1).height = 24;

      const darajahNames: Record<number, string> = {
        1: "Darajah 1",
        2: "Darajah 2",
        3: "Darajah 3",
        4: "Darajah 4",
      };

      for (const d of [1, 2, 3, 4]) {
        const dRows = rows.filter((r) => r.darajah === d);
        const completed = dRows.filter((r) => r.status === "COMPLETED").length;
        const inProgress = dRows.filter((r) => r.status === "IN_PROGRESS").length;
        const pending = dRows.length - completed - inProgress;
        const scored = dRows.filter((r) => r.total !== null);
        const avgTotal =
          scored.length > 0
            ? Number((scored.reduce((s, r) => s + (r.total || 0), 0) / scored.length).toFixed(1))
            : 0;
        const avgPct =
          scored.length > 0
            ? Number((scored.reduce((s, r) => s + (r.percentage || 0), 0) / scored.length).toFixed(1))
            : 0;

        const added = summaryWs.addRow({
          darajah: darajahNames[d],
          assigned: dRows.length,
          completed,
          inProgress,
          pending,
          avgTotal: scored.length > 0 ? avgTotal : "-",
          avgPct: scored.length > 0 ? `${avgPct}%` : "-",
        });
        added.eachCell((c) => {
          c.border = thinBorder;
          c.alignment = { vertical: "middle", horizontal: "center" };
        });
      }

      // 2. Darajah 1 - 4 Tabs
      for (const d of [1, 2, 3, 4]) {
        const ws = wb.addWorksheet(darajahNames[d]);
        ws.columns = [
          { header: "SR No.", key: "sr", width: 9 },
          { header: "EjID (ITS)", key: "its", width: 14 },
          { header: "Talib Name", key: "name", width: 38 },
          { header: "Mumtahin", key: "mumtahin", width: 36 },
          { header: "Nizam", key: "nizam", width: 10 },
          { header: "Q1 (10)", key: "q1", width: 10 },
          { header: "Q2 (10)", key: "q2", width: 10 },
          { header: "Q3 (10)", key: "q3", width: 10 },
          { header: "Q4 (10)", key: "q4", width: 10 },
          { header: "Q5 (10)", key: "q5", width: 10 },
          { header: "Q6 (10)", key: "q6", width: 10 },
          { header: "TOTAL (60)", key: "total", width: 13 },
          { header: "%", key: "pct", width: 10 },
          { header: "Status", key: "status", width: 14 },
        ];
        ws.getRow(1).eachCell((c) => {
          c.fill = headerFill;
          c.font = headerFont;
          c.alignment = { vertical: "middle", horizontal: "center" };
        });
        ws.getRow(1).height = 24;

        const dRows = rows.filter((r) => r.darajah === d);
        dRows.forEach((r, idx) => {
          const added = ws.addRow({
            sr: idx + 1,
            its: r.studentIts,
            name: r.studentName,
            mumtahin: r.teacherName,
            nizam: r.nizam,
            q1: r.q1 ?? "",
            q2: r.q2 ?? "",
            q3: r.q3 ?? "",
            q4: r.q4 ?? "",
            q5: r.q5 ?? "",
            q6: r.q6 ?? "",
            total: r.total ?? "",
            pct: r.percentage !== null ? `${r.percentage}%` : "",
            status: r.status,
          });
          added.eachCell((c) => {
            c.border = thinBorder;
            c.alignment = { vertical: "middle", horizontal: "center" };
          });
          added.getCell("name").alignment = { vertical: "middle", horizontal: "left" };
          added.getCell("mumtahin").alignment = { vertical: "middle", horizontal: "left" };
        });
      }

      // 3. Mumtahin Wise Tab
      const mumtahinWs = wb.addWorksheet("Mumtahin Wise");
      mumtahinWs.columns = [
        { header: "SR No.", key: "sr", width: 9 },
        { header: "EjID", key: "its", width: 14 },
        { header: "Name", key: "name", width: 42 },
        { header: "Darajah", key: "darajah", width: 12 },
        { header: "Q1 (10)", key: "q1", width: 10 },
        { header: "Q2 (10)", key: "q2", width: 10 },
        { header: "Q3 (10)", key: "q3", width: 10 },
        { header: "Q4 (10)", key: "q4", width: 10 },
        { header: "Q5 (10)", key: "q5", width: 10 },
        { header: "Q6 (10)", key: "q6", width: 10 },
        { header: "TOTAL (60)", key: "total", width: 13 },
        { header: "%", key: "pct", width: 10 },
      ];
      mumtahinWs.getRow(1).eachCell((c) => {
        c.fill = headerFill;
        c.font = headerFont;
        c.alignment = { vertical: "middle", horizontal: "center" };
      });
      mumtahinWs.getRow(1).height = 24;

      const byTeacher = new Map<string, typeof rows>();
      for (const r of rows) {
        if (!byTeacher.has(r.teacherId)) byTeacher.set(r.teacherId, []);
        byTeacher.get(r.teacherId)!.push(r);
      }

      let srCounter = 1;
      for (const [, tRows] of byTeacher) {
        const first = tRows[0];
        const mRow = mumtahinWs.addRow({
          sr: "",
          its: first.teacherIts,
          name: first.teacherName,
          darajah: "Mumtahin",
          q1: "",
          q2: "",
          q3: "",
          q4: "",
          q5: "",
          q6: "",
          total: "",
          pct: "",
        });
        mRow.eachCell((c) => {
          c.fill = mumtahinFill;
          c.font = { bold: true, color: { argb: "FF7A5A13" } };
          c.border = thinBorder;
        });

        for (const r of tRows) {
          const sRow = mumtahinWs.addRow({
            sr: srCounter++,
            its: r.studentIts,
            name: r.studentName,
            darajah: r.darajah,
            q1: r.q1 ?? "",
            q2: r.q2 ?? "",
            q3: r.q3 ?? "",
            q4: r.q4 ?? "",
            q5: r.q5 ?? "",
            q6: r.q6 ?? "",
            total: r.total ?? "",
            pct: r.percentage !== null ? `${r.percentage}%` : "",
          });
          sRow.eachCell((c) => {
            c.border = thinBorder;
            c.alignment = { vertical: "middle", horizontal: "center" };
          });
          sRow.getCell("name").alignment = { vertical: "middle", horizontal: "left" };
        }
      }

      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="Quran_Ikhtebaar_All_Darajah_Marks.xlsx"'
      );
      return res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("[quran-ikhtebaar/admin/export-excel] error:", error);
      return res.status(500).json({ success: false, error: "Failed to export Excel" });
    }
  }
);

/**
 * GET /api/quran-ikhtebaar/admin/export-blank-marksheet
 * One-click printable Empty Marksheet Excel — one worksheet/page per Mumtahin
 * with their assigned Talabat, 6-question empty marking boxes, Darse Burhani side logo,
 * and Arabic heading: الامتحان الشفوي لحفظ القرآن الكريم ٤٨-١٤٤٧ھ
 */
router.get(
  "/admin/export-blank-marksheet",
  requireAuth,
  requireRole("ADMIN", "TEACHER"),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (!(await hasQuranAdminAccess(req.auth?.user))) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }
      const assignments = await prisma.quranIkhtebaarAssignment.findMany({
        include: {
          teacher: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
        orderBy: [{ darajah: "asc" }, { createdAt: "asc" }],
      });

      const byTeacher = new Map<
        string,
        {
          teacherName: string;
          teacherIts: string;
          talabat: Array<{
            its: string;
            name: string;
            darajah: number;
            nizam: string;
          }>;
        }
      >();

      for (const a of assignments) {
        const tName = `${a.teacher.user.firstName} ${a.teacher.user.lastName}`.trim();
        const tIts = a.teacher.its || a.teacher.employeeId || "";
        if (!byTeacher.has(a.teacherId)) {
          byTeacher.set(a.teacherId, { teacherName: tName, teacherIts: tIts, talabat: [] });
        }
        byTeacher.get(a.teacherId)!.talabat.push({
          its: a.student.its || a.student.studentId || "",
          name: `${a.student.user.firstName} ${a.student.user.lastName}`.trim(),
          darajah: a.darajah,
          nizam: a.nizam === "NEW" ? "New" : "Old",
        });
      }

      const wb = new ExcelJS.Workbook();
      wb.creator = "Darse Burhani";
      wb.created = new Date();

      // Load Darse Burhani side logo if available
      const logoPath = path.join(getRepoRoot(), "client", "public", "logo.png");
      let logoId: number | null = null;
      if (fs.existsSync(logoPath)) {
        logoId = wb.addImage({
          filename: logoPath,
          extension: "png",
        });
      }

      const usedNames = new Set<string>();
      const makeSheetName = (idx: number, rawName: string) => {
        const cleaned = rawName
          .replace(/[\\/?*[\]:]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        let candidate = `${idx}. ${cleaned}`.slice(0, 31).trim();
        if (usedNames.has(candidate)) {
          candidate = `${idx}. ${cleaned.slice(0, 24)} ${idx}`.slice(0, 31).trim();
        }
        usedNames.add(candidate);
        return candidate;
      };

      const boxBorder: Partial<ExcelJS.Borders> = {
        top: { style: "thin", color: { argb: "FF8C7A5B" } },
        bottom: { style: "thin", color: { argb: "FF8C7A5B" } },
        left: { style: "thin", color: { argb: "FF8C7A5B" } },
        right: { style: "thin", color: { argb: "FF8C7A5B" } },
      };

      const sortedTeachers = Array.from(byTeacher.values()).sort((a, b) =>
        a.teacherName.localeCompare(b.teacherName)
      );

      if (sortedTeachers.length === 0) {
        const emptyWs = wb.addWorksheet("No Assignments");
        emptyWs.getCell("A1").value = "No Mumtahin assignments found.";
      }

      sortedTeachers.forEach((group, tIdx) => {
        const ws = wb.addWorksheet(makeSheetName(tIdx + 1, group.teacherName), {
          pageSetup: {
            paperSize: 9, // A4
            orientation: "landscape",
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 1,
            margins: {
              left: 0.35,
              right: 0.35,
              top: 0.4,
              bottom: 0.4,
              header: 0.2,
              footer: 0.2,
            },
          },
        });

        ws.columns = [
          { key: "sr", width: 5.5 },
          { key: "its", width: 12 },
          { key: "name", width: 34 },
          { key: "darajah", width: 9 },
          { key: "nizam", width: 10 },
          { key: "q1", width: 9 },
          { key: "q2", width: 9 },
          { key: "q3", width: 9 },
          { key: "q4", width: 9 },
          { key: "q5", width: 9 },
          { key: "q6", width: 9 },
          { key: "total", width: 11 },
          { key: "remarks", width: 18 },
        ];

        // Banner Rows 1-3 (Navy #0B2545 with Darse Burhani Logo on the side)
        for (let r = 1; r <= 3; r++) {
          for (let c = 1; c <= 13; c++) {
            const cell = ws.getCell(r, c);
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0B2545" } };
          }
        }
        ws.getRow(1).height = 28;
        ws.getRow(2).height = 24;
        ws.getRow(3).height = 20;

        ws.mergeCells("A1:B3");
        if (logoId !== null) {
          ws.addImage(logoId, {
            tl: { col: 0.25, row: 0.15 },
            ext: { width: 66, height: 66 },
          });
        }

        ws.mergeCells("C1:M2");
        const arHeading = ws.getCell("C1");
        arHeading.value = "الامتحان الشفوي لحفظ القرآن الكريم ٤٨-١٤٤٧ھ";
        arHeading.font = { name: "Al-Kanz", size: 20, bold: true, color: { argb: "FFFCD468" } };
        arHeading.alignment = { vertical: "middle", horizontal: "center", readingOrder: "rtl" };

        ws.mergeCells("C3:M3");
        const subHeading = ws.getCell("C3");
        subHeading.value = "Darse Burhani · Al-Quran al-Majeed Oral Examination — Mumtahin Marksheet";
        subHeading.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFAF7F0" } };
        subHeading.alignment = { vertical: "middle", horizontal: "center" };

        // Row 4: Mumtahin Info Strip
        ws.mergeCells("A4:I4");
        const mumtahinCell = ws.getCell("A4");
        mumtahinCell.value = `Mumtahin: ${group.teacherName}${group.teacherIts ? `   (ITS: ${group.teacherIts})` : ""}`;
        mumtahinCell.font = { name: "Calibri", size: 11.5, bold: true, color: { argb: "FF221C12" } };
        mumtahinCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF7F0" } };
        mumtahinCell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };

        ws.mergeCells("J4:M4");
        const countCell = ws.getCell("J4");
        countCell.value = `Assigned Talabat: ${group.talabat.length}`;
        countCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF7A5A13" } };
        countCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E7" } };
        countCell.alignment = { vertical: "middle", horizontal: "center" };

        for (let c = 1; c <= 13; c++) {
          ws.getCell(4, c).border = {
            top: { style: "medium", color: { argb: "FFD4AF37" } },
            bottom: { style: "medium", color: { argb: "FFD4AF37" } },
            left: { style: "thin", color: { argb: "FFE7E0D0" } },
            right: { style: "thin", color: { argb: "FFE7E0D0" } },
          };
        }
        ws.getRow(4).height = 24;

        // Row 5: Spacer
        ws.getRow(5).height = 6;

        // Row 6: Table Header
        const headers = [
          "Sr.",
          "ITS",
          "Talib Name",
          "Darajah",
          "Nizam",
          "Q1 (10)",
          "Q2 (10)",
          "Q3 (10)",
          "Q4 (10)",
          "Q5 (10)",
          "Q6 (10)",
          "Total (60)",
          "Remarks",
        ];
        const headerRow = ws.getRow(6);
        headerRow.height = 26;
        headers.forEach((h, i) => {
          const cell = headerRow.getCell(i + 1);
          cell.value = h;
          cell.font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FFFFFFFF" } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F5132" } };
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          cell.border = boxBorder;
        });

        // Talabat rows with empty marking boxes
        const sortedTalabat = [...group.talabat].sort(
          (a, b) => a.darajah - b.darajah || a.name.localeCompare(b.name)
        );

        sortedTalabat.forEach((t, idx) => {
          const row = ws.addRow([
            idx + 1,
            t.its,
            t.name,
            `D-${t.darajah}`,
            t.nizam,
            "",
            "",
            "",
            "",
            "",
            "",
            "",
            "",
          ]);
          row.height = 28;
          const isAlt = idx % 2 === 1;
          row.eachCell((cell, colNumber) => {
            cell.font = {
              name: "Calibri",
              size: 10.5,
              bold: colNumber === 3,
              color: { argb: "FF221C12" },
            };
            if (colNumber >= 6 && colNumber <= 12) {
              // Empty marking box
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
            } else if (isAlt) {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAF7F0" } };
            }
            cell.border = boxBorder;
            cell.alignment = {
              vertical: "middle",
              horizontal: colNumber === 3 ? "left" : "center",
              indent: colNumber === 3 ? 1 : 0,
            };
          });
        });

        // Signature Footer Row
        const footerRowIdx = 6 + sortedTalabat.length + 2;
        ws.mergeCells(footerRowIdx, 1, footerRowIdx, 7);
        const sigCell = ws.getCell(footerRowIdx, 1);
        sigCell.value = "Mumtahin Signature: _______________________________________";
        sigCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF221C12" } };
        sigCell.alignment = { vertical: "middle", horizontal: "left" };

        ws.mergeCells(footerRowIdx, 8, footerRowIdx, 13);
        const dateCell = ws.getCell(footerRowIdx, 8);
        dateCell.value = "Date: _____________________";
        dateCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF221C12" } };
        dateCell.alignment = { vertical: "middle", horizontal: "right" };
        ws.getRow(footerRowIdx).height = 28;
      });

      const buffer = await wb.xlsx.writeBuffer();
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="Quran_Ikhtebaar_Blank_Marksheets_1448H.xlsx"'
      );
      return res.send(Buffer.from(buffer));
    } catch (error) {
      console.error("[quran-ikhtebaar/admin/export-blank-marksheet] error:", error);
      return res.status(500).json({ success: false, error: "Failed to export blank marksheets" });
    }
  }
);

/**
 * GET /api/quran-ikhtebaar/live
 * Server-Sent Events (SSE) stream for real-time marks updates and concurrency load telemetry.
 */
router.get(
  "/live",
  requireAuth,
  requireRole("ADMIN", "TEACHER"),
  async (req: AuthedRequest, res: Response) => {
    try {
      if (!(await hasQuranAdminAccess(req.auth?.user))) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders?.();

      loadMetrics.activeListeners += 1;

      const sendEvent = (event: string, data: unknown) => {
        try {
          res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        } catch {
          // ignore broken pipe
        }
      };

      sendEvent("load-status", { loadMetrics: { ...loadMetrics } });

      const onSync = ({ event, payload }: { event: string; payload: Record<string, unknown> }) => {
        sendEvent(event, payload);
      };

      quranLiveBus.on("sync", onSync);

      const heartbeat = setInterval(() => {
        try {
          res.write(`: keepalive ${Date.now()}\n\n`);
        } catch {
          // ignore
        }
      }, 20_000);

      req.on("close", () => {
        clearInterval(heartbeat);
        quranLiveBus.off("sync", onSync);
        loadMetrics.activeListeners = Math.max(0, loadMetrics.activeListeners - 1);
      });
    } catch (error) {
      console.error("[quran-ikhtebaar/live] error:", error);
      return res.status(500).end();
    }
  }
);

export default router;
