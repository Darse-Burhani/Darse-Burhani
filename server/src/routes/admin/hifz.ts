import { Router } from "express";
import prisma from "../../lib/prisma";
import { cache } from "../../lib/cache";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/admin/hifz - Fetch paginated hifz reports + reference data
router.get("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    const page = parseInt((req.query.page as string) || "1");
    const pageSize = parseInt((req.query.pageSize as string) || "50");
    const skip = (page - 1) * pageSize;
    const academicYear = (req.query.academicYear as string) || "";

    const isAdmin = session.user.role === "ADMIN";
    let teacherId: string | undefined;

    if (!isAdmin) {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (!teacherProfile) {
        return res.status(404).json({ success: false, error: "Teacher profile not found" });
      }

      const assignment = await prisma.teacherPortalAssignment.findFirst({
        where: {
          teacherId: teacherProfile.id,
          portalType: { in: ["HIFZ", "ALL"] },
          isActive: true,
        },
      });
      if (!assignment) {
        return res.status(403).json({ success: false, error: "No HIFZ portal access" });
      }
      teacherId = teacherProfile.id;
    }

    // ── 1. Paginated reports with lighter selects ──
    const where: Record<string, unknown> = {};
    if (teacherId) where.teacherId = teacherId;
    if (academicYear) where.academicYear = academicYear;

    const [reports, total] = await Promise.all([
      prisma.hifzReport.findMany({
        where,
        orderBy: { updatedAt: "desc" as const },
        skip,
        take: pageSize,
        include: {
          student: {
            select: {
              userId: true,
              grade: true,
              section: true,
              user: { select: { firstName: true, lastName: true, email: true } },
            },
          },
          teacher: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          // Parts select: only fields needed for the list view
          parts: {
            select: {
              id: true,
              partNumber: true,
              status: true,
              progress: true,
              isMemorized: true,
              isReviewed: true,
              isWeak: true,
              reviewCount: true,
              currentPage: true,
              totalPages: true,
              performancePercent: true,
            },
            orderBy: { partNumber: "asc" },
          },
        },
      }),
      prisma.hifzReport.count({ where }),
    ]);

    // ── 2. Cached reference data: students list ──
    const students = await cache.getOrSet(
      "admin:hifz:students",
      () =>
        prisma.studentProfile.findMany({
          select: {
            userId: true,
            grade: true,
            section: true,
            user: { select: { firstName: true, lastName: true } },
          },
          orderBy: { user: { firstName: "asc" } },
        }),
      { ttl: 60_000, tags: ["studentprofile"] },
    );

    // ── 3. Cached reference data: teachers list ──
    const teachers = await cache.getOrSet(
      "admin:hifz:teachers",
      () =>
        prisma.teacherProfile.findMany({
          select: {
            userId: true,
            user: { select: { firstName: true, lastName: true } },
            portalAssignments: {
              select: { portalType: true, isActive: true },
            },
          },
        }),
      { ttl: 60_000, tags: ["teacherprofile"] },
    );

    return res.json({
      success: true,
      data: {
        reports: reports.map((r) => ({
          id: r.id,
          studentId: r.studentId,
          studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
          studentEmail: r.student.user.email,
          studentGrade: r.student.grade,
          studentSection: r.student.section,
          teacherId: r.teacherId,
          teacherName: `${r.teacher.user.firstName} ${r.teacher.user.lastName}`,
          academicYear: r.academicYear,
          semester: r.semester,
          totalParts: r.parts.length,
          parts: r.parts.map((p) => ({
            id: p.id,
            partNumber: p.partNumber,
            status: p.status,
            progress: p.progress,
            isMemorized: p.isMemorized,
            isReviewed: p.isReviewed,
            isWeak: p.isWeak,
            reviewCount: p.reviewCount,
            currentPage: p.currentPage,
            totalPages: p.totalPages,
            performancePercent: p.performancePercent,
          })),
          isPublished: r.isPublished,
          publishedAt: r.publishedAt,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
        students: students.map((s) => ({
          id: s.userId,
          name: `${s.user.firstName} ${s.user.lastName}`,
          grade: s.grade,
          section: s.section,
        })),
        teachers: teachers.map((t) => ({
          id: t.userId,
          name: `${t.user.firstName} ${t.user.lastName}`,
          hasHifzAccess: t.portalAssignments.some(
            (a) => a.portalType === "HIFZ" && a.isActive,
          ),
        })),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Hifz fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch hifz data" });
  }
});

// POST /api/admin/hifz - Create a new hifz report
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { studentId, teacherId, academicYear, semester } = body;

    if (!studentId || !teacherId || !academicYear) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const teacherProfile = await prisma.teacherProfile.findFirst({
      where: {
        OR: [{ userId: teacherId }, { id: teacherId }],
      },
    });

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher not found" });
    }

    const studentProfile = await prisma.studentProfile.findFirst({
      where: {
        OR: [{ id: studentId }, { userId: studentId }, { studentId: studentId }],
      },
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    const existing = await prisma.hifzReport.findUnique({
      where: {
        studentId_academicYear: {
          studentId: studentProfile.id,
          academicYear,
        },
      },
    });

    if (existing) {
      return res.status(409).json({ success: false, error: "Report already exists" });
    }

    const report = await prisma.hifzReport.create({
      data: {
        studentId: studentProfile.id,
        teacherId: teacherProfile.id,
        academicYear,
        semester,
        parts: {
          create: Array.from({ length: 30 }, (_, i) => ({
            partNumber: i + 1,
            status: "NOT_STARTED",
            progress: 0,
            isMemorized: false,
            isReviewed: false,
            isWeak: false,
            isAbandoned: false,
            reviewCount: 0,
            targetReviews: 20,
            currentPage: 0,
            totalPages: 20,
            firmProgress: 0,
            firmTarget: 10,
            sentencesMemorized: 0,
            sentencePercentage: 0,
          })),
        },
      },
      include: { parts: true },
    });

    return res.status(201).json({ success: true, data: report });
  } catch (error) {
    console.error("Hifz create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create hifz report" });
  }
});

// PUT /api/admin/hifz - Update report publish state or part data
router.put("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { reportId, partId, partData, isPublished, isHidden } = body;

    if (!reportId) {
      return res.status(400).json({ success: false, error: "Missing reportId" });
    }

    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });
      const report = await prisma.hifzReport.findUnique({ where: { id: reportId } });
      if (!teacherProfile || !report || report.teacherId !== teacherProfile.id) {
        return res.status(403).json({ success: false, error: "Unauthorized" });
      }
    }

    if (typeof isPublished === "boolean" || typeof isHidden === "boolean") {
      const updateData: Record<string, any> = { updatedAt: new Date() };
      if (typeof isPublished === "boolean") {
        updateData.isPublished = isPublished;
        if (isPublished) updateData.publishedAt = new Date();
      }
      if (typeof isHidden === "boolean") updateData.isHidden = isHidden;

      const updatedReport = await prisma.hifzReport.update({
        where: { id: reportId },
        data: updateData,
      });
      return res.json({ success: true, data: updatedReport });
    }

    if (!partId || !partData) {
      return res.status(400).json({ success: false, error: "Missing partId or partData" });
    }

    const updatedPart = await prisma.hifzPart.update({
      where: { id: partId },
      data: {
        status: partData.status,
        progress: partData.progress,
        isMemorized: partData.isMemorized,
        isReviewed: partData.isReviewed,
        isWeak: partData.isWeak,
        isAbandoned: partData.isAbandoned,
        isHidden: partData.isHidden,
        reviewCount: partData.reviewCount,
        targetReviews: partData.targetReviews,
        currentPage: partData.currentPage,
        totalPages: partData.totalPages,
        firmProgress: partData.firmProgress,
        firmTarget: partData.firmTarget,
        sentencesMemorized: partData.sentencesMemorized,
        sentencePercentage: partData.sentencePercentage,
        notes: partData.notes,
      },
    });

    await prisma.hifzReport.update({
      where: { id: reportId },
      data: { updatedAt: new Date() },
    });

    return res.json({ success: true, data: updatedPart });
  } catch (error) {
    console.error("Hifz update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update hifz part" });
  }
});

// DELETE /api/admin/hifz - Delete a hifz report
router.delete("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const id = req.query.id as string;

    if (!id) {
      return res.status(400).json({ success: false, error: "Report ID required" });
    }

    await prisma.hifzReport.delete({ where: { id } });

    return res.json({ success: true });
  } catch (error) {
    console.error("Hifz delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete hifz report" });
  }
});

export default router;
