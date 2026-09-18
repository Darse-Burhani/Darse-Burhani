import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/admin/hifz-marhala - Fetch all marhala assignments and reports
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const academicYear = (req.query.academicYear as string) || "";
    const marhala = (req.query.marhala as string) || "";
    const facultyId = (req.query.facultyId as string) || "";
    const status = (req.query.status as string) || "";

    const whereAssign: Record<string, unknown> = {};
    if (academicYear) whereAssign.academicYear = academicYear;

    const [assignments, reports, students, teachers] = await Promise.all([
      prisma.hifzMarhalaAssignment.findMany({
        where: { ...whereAssign, ...(marhala ? { marhala: marhala as any } : {}) },
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            },
          },
          faculty: {
            include: {
              user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            },
          },
          musaid: {
            include: {
              user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            },
          },
          musaidStudent: {
            include: {
              user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            },
          },
          assignedBy: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: [{ marhala: "asc" }, { student: { user: { firstName: "asc" } } }],
      }),
      prisma.hifzMarhalaReport.findMany({
        where: {
          ...(academicYear ? { academicYear } : {}),
          ...(marhala ? { marhala: marhala as any } : {}),
          ...(facultyId ? { facultyId } : {}),
          ...(status ? { status: status as any } : {}),
        },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          faculty: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          reviewer: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: [{ marhala: "asc" }, { student: { user: { firstName: "asc" } } }],
      }),
      prisma.studentProfile.findMany({
        where: { user: { isActive: true } },
        select: {
          id: true,
          studentId: true,
          its: true,
          grade: true,
          section: true,
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { user: { firstName: "asc" } },
      }),
      prisma.teacherProfile.findMany({
        where: { user: { isActive: true } },
        select: {
          id: true,
          employeeId: true,
          department: true,
          photoUrl: true,
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        },
        orderBy: { user: { firstName: "asc" } },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        assignments,
        reports,
        students,
        teachers,
      },
    });
  } catch (error) {
    console.error("Hifz Marhala fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch hifz marhala data" });
  }
});

// POST /api/admin/hifz-marhala/assign - Assign students to marhala, muhaffiz (faculty), and musaid
router.post("/assign", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as Record<string, any>;
    const { assignments } = body; // Array of { studentId, marhala, facultyId, musaidId, musaidStudentId, academicYear }

    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ success: false, error: "Assignments array is required" });
    }

    const results = await prisma.$transaction(
      assignments.map((a: any) =>
        prisma.hifzMarhalaAssignment.upsert({
          where: { studentId_academicYear: { studentId: a.studentId, academicYear: a.academicYear } },
          create: {
            studentId: a.studentId,
            marhala: a.marhala,
            facultyId: a.facultyId,
            musaidId: a.musaidId || null,
            musaidStudentId: a.musaidStudentId || null,
            academicYear: a.academicYear,
            assignedById: session.user.id,
          },
          update: {
            marhala: a.marhala,
            facultyId: a.facultyId,
            musaidId: a.musaidId || null,
            musaidStudentId: a.musaidStudentId || null,
            assignedById: session.user.id,
          },
        })
      )
    );

    return res.status(201).json({ success: true, data: results });
  } catch (error) {
    console.error("Hifz Marhala assign error:", error);
    return res.status(500).json({ success: false, error: "Failed to assign marhala" });
  }
});

// POST /api/admin/hifz-marhala/quick-tag - Quick tag single student
router.post("/quick-tag", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { studentId, marhala, facultyId, musaidId, musaidStudentId, academicYear } = req.body;

    if (!studentId || !marhala || !facultyId || !academicYear) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const assignment = await prisma.hifzMarhalaAssignment.upsert({
      where: { studentId_academicYear: { studentId, academicYear } },
      create: {
        studentId,
        marhala,
        facultyId,
        musaidId: musaidId || null,
        musaidStudentId: musaidStudentId || null,
        academicYear,
        assignedById: session.user.id,
      },
      update: {
        marhala,
        facultyId,
        musaidId: musaidId || null,
        musaidStudentId: musaidStudentId || null,
        assignedById: session.user.id,
      },
      include: {
        student: { include: { user: true } },
        faculty: { include: { user: true } },
        musaid: { include: { user: true } },
        musaidStudent: { include: { user: true } },
      },
    });

    return res.json({ success: true, data: assignment });
  } catch (error) {
    console.error("Quick tag error:", error);
    return res.status(500).json({ success: false, error: "Failed to update tags" });
  }
});

// PUT /api/admin/hifz-marhala/assign - Update assignment (smooth joint flow: also reassign pending weekly slips + notify teacher)
router.put("/assign", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as Record<string, any>;
    const { id, marhala, facultyId, musaidId, musaidStudentId, isActive } = body;

    if (!id) {
      return res.status(400).json({ success: false, error: "Assignment ID required" });
    }

    const prev = await prisma.hifzMarhalaAssignment.findUnique({ where: { id }, select: { studentId: true, facultyId: true, marhala: true, academicYear: true } });
    const updated = await prisma.hifzMarhalaAssignment.update({
      where: { id },
      data: {
        ...(marhala ? { marhala } : {}),
        ...(facultyId ? { facultyId } : {}),
        ...(musaidId !== undefined ? { musaidId: musaidId || null } : {}),
        ...(musaidStudentId !== undefined ? { musaidStudentId: musaidStudentId || null } : {}),
        ...(typeof isActive === "boolean" ? { isActive } : {}),
        assignedById: session.user.id,
      },
      include: {
        student: { include: { user: true } },
        faculty: { include: { user: true } },
        musaid: { include: { user: true } },
        musaidStudent: { include: { user: true } },
      },
    });

    // Smooth joint: migrate pending DRAFT slips to new muhaffiz so teacher sees them instantly
    if (prev && facultyId && facultyId !== prev.facultyId) {
      await prisma.hifzWeeklySlip.updateMany({
        where: { studentId: prev.studentId, academicYear: prev.academicYear, status: "DRAFT" },
        data: { facultyId },
      }).catch(() => {});
      // Notify new teacher
      const t = await prisma.teacherProfile.findUnique({ where: { id: facultyId }, select: { userId: true } });
      if (t) {
        await prisma.notification.create({
          data: {
            userId: t.userId,
            title: "New Huffaz Assigned to You",
            body: `${fullNameSafe(updated.student?.user)} has been assigned to you (${marhala || updated.marhala}). Open Weekly Slips to fill.`,
            type: "ALERT",
            link: "/teacher/hifz-weekly-slip",
            priority: "HIGH",
          },
        }).catch(() => {});
      }
    }

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Hifz Marhala update assign error:", error);
    return res.status(500).json({ success: false, error: "Failed to update assignment" });
  }
});

function fullNameSafe(u: any): string {
  if (!u) return "A talib";
  return `${u.firstName || ""} ${u.lastName || ""}`.trim() || "A talib";
}

// DELETE /api/admin/hifz-marhala/assign - Remove assignment
router.delete("/assign", requireRole("ADMIN"), async (req, res) => {
  try {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ success: false, error: "Assignment ID required" });
    await prisma.hifzMarhalaAssignment.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error("Hifz Marhala delete assign error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete assignment" });
  }
});

// POST /api/admin/hifz-marhala/report - Create or update report (admin)
router.post("/report", requireRole("ADMIN"), async (req, res) => {
  try {
    const body = req.body as Record<string, any>;
    const { studentId, facultyId, marhala, academicYear, ...data } = body;

    if (!studentId || !facultyId || !marhala || !academicYear) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const totalMarks = (Number(data.murajaatMarks) || 0) + (Number(data.juzhaliMarks) || 0) + (Number(data.jadeedMarks) || 0);
    const overallPerformance = totalMarks > 0 ? Math.round((totalMarks / 50) * 100) : 0;

    const report = await prisma.hifzMarhalaReport.upsert({
      where: { studentId_academicYear_marhala: { studentId, academicYear, marhala } },
      create: {
        studentId,
        facultyId,
        marhala,
        academicYear,
        source: "ADMIN",
        status: "APPROVED",
        its: data.its,
        name: data.name,
        currentJuz: data.currentJuz,
        currentSafah: data.currentSafah,
        totalJadeedPages: data.totalJadeedPages,
        ajzaMatruka: data.ajzaMatruka,
        weakAjza: data.weakAjza,
        murajaatMarks: data.murajaatMarks,
        juzhaliMarks: data.juzhaliMarks,
        jadeedMarks: data.jadeedMarks,
        totalMarks,
        overallPerformance,
        notes: data.notes,
        submittedAt: new Date(),
        reviewedAt: new Date(),
        reviewedById: req.auth?.user.id,
      },
      update: {
        facultyId,
        its: data.its,
        name: data.name,
        currentJuz: data.currentJuz,
        currentSafah: data.currentSafah,
        totalJadeedPages: data.totalJadeedPages,
        ajzaMatruka: data.ajzaMatruka,
        weakAjza: data.weakAjza,
        murajaatMarks: data.murajaatMarks,
        juzhaliMarks: data.juzhaliMarks,
        jadeedMarks: data.jadeedMarks,
        totalMarks,
        overallPerformance,
        notes: data.notes,
        status: "APPROVED",
        reviewedAt: new Date(),
        reviewedById: req.auth?.user.id,
      },
    });

    return res.status(201).json({ success: true, data: report });
  } catch (error) {
    console.error("Hifz Marhala report create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create report" });
  }
});

// PUT /api/admin/hifz-marhala/report - Update report status
router.put("/report", requireRole("ADMIN"), async (req, res) => {
  try {
    const body = req.body as Record<string, any>;
    const { id, status, reviewedById, ...data } = body;

    if (!id) return res.status(400).json({ success: false, error: "Report ID required" });

    const updateData: Record<string, any> = { ...data };
    if (status) {
      updateData.status = status;
      if (status === "REVIEWED" || status === "APPROVED" || status === "REJECTED") {
        updateData.reviewedAt = new Date();
        updateData.reviewedById = reviewedById || req.auth?.user.id;
      }
    }

    // Recalculate totals if marks changed
    if (data.murajaatMarks !== undefined || data.juzhaliMarks !== undefined || data.jadeedMarks !== undefined) {
      const existing = await prisma.hifzMarhalaReport.findUnique({ where: { id } });
      if (existing) {
        const murajaat = Number(data.murajaatMarks ?? existing.murajaatMarks ?? 0) || 0;
        const juzhali = Number(data.juzhaliMarks ?? existing.juzhaliMarks ?? 0) || 0;
        const jadeed = Number(data.jadeedMarks ?? existing.jadeedMarks ?? 0) || 0;
        const total = murajaat + juzhali + jadeed;
        updateData.totalMarks = total;
        updateData.overallPerformance = total > 0 ? Math.round((total / 50) * 100) : 0;
      }
    }

    const updated = await prisma.hifzMarhalaReport.update({
      where: { id },
      data: updateData,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Hifz Marhala report update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update report" });
  }
});

// DELETE /api/admin/hifz-marhala/report - Delete report
router.delete("/report", requireRole("ADMIN"), async (req, res) => {
  try {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ success: false, error: "Report ID required" });
    await prisma.hifzMarhalaReport.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error("Hifz Marhala report delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete report" });
  }
});

// GET /api/admin/hifz-marhala/stats - Get marhala statistics
router.get("/stats", requireRole("ADMIN"), async (req, res) => {
  try {
    const academicYear = (req.query.academicYear as string) || "";

    const [assignments, reports] = await Promise.all([
      prisma.hifzMarhalaAssignment.findMany({
        where: { ...(academicYear ? { academicYear } : {}), isActive: true },
        select: { marhala: true, facultyId: true },
      }),
      prisma.hifzMarhalaReport.findMany({
        where: { ...(academicYear ? { academicYear } : {}) },
        select: { marhala: true, status: true, totalMarks: true, overallPerformance: true },
      }),
    ]);

    const marhalaStats = ["MARHALA_1", "MARHALA_2", "MARHALA_3", "MARHALA_4", "MARHALA_5"].map((m) => {
      const assigned = assignments.filter((a) => a.marhala === m).length;
      const marhalaReports = reports.filter((r) => r.marhala === m);
      const submitted = marhalaReports.filter((r) => r.status !== "DRAFT").length;
      const approved = marhalaReports.filter((r) => r.status === "APPROVED").length;
      const avgPerformance = marhalaReports.length > 0
        ? Math.round(marhalaReports.reduce((sum, r) => sum + (r.overallPerformance || 0), 0) / marhalaReports.length)
        : 0;

      return {
        marhala: m,
        assigned,
        submitted,
        approved,
        avgPerformance,
      };
    });

    const totalStudents = assignments.length;
    const totalApproved = reports.filter((r) => r.status === "APPROVED").length;
    const avgPerformance = reports.length > 0
      ? Math.round(reports.reduce((sum, r) => sum + (r.overallPerformance || 0), 0) / reports.length)
      : 0;

    return res.json({ success: true, data: { marhalaStats, totalStudents, totalApproved, avgPerformance } });
  } catch (error) {
    console.error("Hifz Marhala stats error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

// ==========================================
// WEEKLY SLIP ADMIN MANAGEMENT ENDPOINTS
// ==========================================

// GET /api/admin/hifz-marhala/weekly-slips
router.get("/weekly-slips", requireRole("ADMIN"), async (req, res) => {
  try {
    const academicYear = (req.query.academicYear as string) || "";
    const marhala = (req.query.marhala as string) || "";
    const weekNumber = req.query.weekNumber ? parseInt(req.query.weekNumber as string) : undefined;
    const status = (req.query.status as string) || "";

    const slips = await prisma.hifzWeeklySlip.findMany({
      where: {
        ...(academicYear ? { academicYear } : {}),
        ...(marhala && marhala !== "all" ? { marhala: marhala as any } : {}),
        ...(weekNumber ? { weekNumber } : {}),
        ...(status && status !== "all" ? { status: status as any } : {}),
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        faculty: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        reviewer: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ weekNumber: "desc" }, { marhala: "asc" }, { student: { user: { firstName: "asc" } } }],
    });

    // Attach musaid via HifzMarhalaAssignment for all marhala — slip itself only stores facultyId
    const studentIds = [...new Set(slips.map((s) => s.studentId))];
    const assignments = studentIds.length
      ? await prisma.hifzMarhalaAssignment.findMany({
          where: { studentId: { in: studentIds }, ...(academicYear ? { academicYear } : {}) },
          include: {
            musaid: { include: { user: { select: { firstName: true, lastName: true } } } },
            musaidStudent: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        })
      : [];
    const assignMap = new Map(assignments.map((a) => [a.studentId, a]));
    const enriched = slips.map((s) => ({
      ...s,
      // hafiz talabt is student; expose musaid (teacher legacy or talabt) for slip display
      musaid: (assignMap.get(s.studentId) as any)?.musaid || null,
      musaidStudent: (assignMap.get(s.studentId) as any)?.musaidStudent || null,
      assignment: assignMap.get(s.studentId) || null,
    }));

    return res.json({ success: true, data: enriched });
  } catch (error) {
    console.error("Admin fetch weekly slips error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch weekly slips" });
  }
});

// PUT /api/admin/hifz-marhala/weekly-slip - Admin edit/approve weekly slip
router.put("/weekly-slip", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as Record<string, any>;
    const { id, status, adminNotes, ...data } = body;

    if (!id) {
      return res.status(400).json({ success: false, error: "Slip ID is required" });
    }

    const existing = await prisma.hifzWeeklySlip.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Weekly slip not found" });
    }

    const murajaat = data.murajaatMarks !== undefined ? Number(data.murajaatMarks) || 0 : (existing.murajaatMarks ?? 0);
    const juzhali = data.juzhaliMarks !== undefined ? Number(data.juzhaliMarks) || 0 : (existing.juzhaliMarks ?? 0);
    const jadeed = data.jadeedMarks !== undefined ? Number(data.jadeedMarks) || 0 : (existing.jadeedMarks ?? 0);
    const totalMarks = murajaat + juzhali + jadeed;
    const overallPerformance = totalMarks > 0 ? Math.round((totalMarks / 50) * 100) : 0;

    const updateData: Record<string, any> = {
      ...data,
      murajaatMarks: murajaat,
      juzhaliMarks: juzhali,
      jadeedMarks: jadeed,
      totalMarks,
      overallPerformance,
      adminNotes: adminNotes !== undefined ? adminNotes : existing.adminNotes,
    };

    if (status) {
      updateData.status = status;
      if (status === "APPROVED" || status === "PUBLISHED" || status === "REJECTED") {
        updateData.reviewedAt = new Date();
        updateData.reviewedById = session.user.id;
      }
      if (status === "PUBLISHED") {
        updateData.publishedAt = new Date();
      }
    }

    const updated = await prisma.hifzWeeklySlip.update({
      where: { id },
      data: updateData,
      include: {
        student: { include: { user: true } },
        faculty: { include: { user: true } },
        reviewer: { select: { firstName: true, lastName: true } },
      },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Admin update weekly slip error:", error);
    return res.status(500).json({ success: false, error: "Failed to update weekly slip" });
  }
});

// POST /api/admin/hifz-marhala/weekly-slips/publish - Publish selected or all slips to parents
router.post("/weekly-slips/publish", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { ids, academicYear, weekNumber, marhala } = req.body;

    const whereClause: Record<string, any> = {};
    if (Array.isArray(ids) && ids.length > 0) {
      whereClause.id = { in: ids };
    } else {
      if (academicYear) whereClause.academicYear = academicYear;
      if (weekNumber) whereClause.weekNumber = parseInt(weekNumber);
      if (marhala && marhala !== "all") whereClause.marhala = marhala;
      whereClause.status = { in: ["SUBMITTED", "APPROVED"] };
    }

    const updated = await prisma.hifzWeeklySlip.updateMany({
      where: whereClause,
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        reviewedAt: new Date(),
        reviewedById: session.user.id,
      },
    });

    return res.json({ success: true, count: updated.count });
  } catch (error) {
    console.error("Publish weekly slips error:", error);
    return res.status(500).json({ success: false, error: "Failed to publish weekly slips" });
  }
});

// POST /api/admin/hifz-marhala/weekly-slips/command — Admin issues a weekly command: create DRAFT slips for all assigned huffaz
// Smooth joint UX: every slip is pre-created for the teacher, so filling is one tap. Admin sees live fill progress.
router.post("/weekly-slips/command", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { academicYear, weekNumber, marhala, weekStartDate, weekEndDate } = req.body as Record<string, any>;
    if (!academicYear || !weekNumber) {
      return res.status(400).json({ success: false, error: "academicYear and weekNumber are required" });
    }
    const wk = Number(weekNumber);
    if (!Number.isFinite(wk) || wk < 1 || wk > 60) {
      return res.status(400).json({ success: false, error: "weekNumber must be 1-60" });
    }
    const whereAssign: Record<string, any> = { isActive: true, academicYear };
    if (marhala && marhala !== "all") whereAssign.marhala = marhala;

    const assignments = await prisma.hifzMarhalaAssignment.findMany({
      where: whereAssign,
      select: { studentId: true, facultyId: true, marhala: true },
    });
    if (assignments.length === 0) {
      return res.status(404).json({ success: false, error: "No assigned huffaz for this filter — assign students first" });
    }

    const existing = await prisma.hifzWeeklySlip.findMany({
      where: { academicYear, weekNumber: wk, ...(marhala && marhala !== "all" ? { marhala: marhala as any } : {}) },
      select: { studentId: true },
    });
    const existingIds = new Set(existing.map((e) => e.studentId));
    const toCreate = assignments.filter((a) => !existingIds.has(a.studentId));

    let created = 0;
    if (toCreate.length > 0) {
      await prisma.hifzWeeklySlip.createMany({
        data: toCreate.map((a) => ({
          studentId: a.studentId,
          facultyId: a.facultyId,
          marhala: a.marhala,
          academicYear,
          weekNumber: wk,
          weekStartDate: weekStartDate ? new Date(weekStartDate) : null,
          weekEndDate: weekEndDate ? new Date(weekEndDate) : null,
          status: "DRAFT" as const,
        })),
        skipDuplicates: true,
      });
      created = toCreate.length;
      // Notify each muhaffiz that a new week has been opened
      const teacherIds = [...new Set(toCreate.map((a) => a.facultyId))];
      const teachers = await prisma.teacherProfile.findMany({ where: { id: { in: teacherIds } }, select: { userId: true } });
      const notifs = teachers.map((t) => ({
        userId: t.userId,
        title: `New Weekly Hifz Slips — Week ${wk}`,
        body: `${created} huffaz • AY ${academicYear}${marhala && marhala !== "all" ? ` • ${marhala}` : ""} — open your Weekly Slip page to fill.`,
        type: "ALERT" as const,
        link: "/teacher/hifz-weekly-slip",
        priority: "HIGH" as const,
      }));
      if (notifs.length) await prisma.notification.createMany({ data: notifs }).catch(() => {});
    }

    // Live stats for this week (so admin sees joint fill progress instantly)
    const stats = await prisma.hifzWeeklySlip.groupBy({
      by: ["status"],
      where: { academicYear, weekNumber: wk, ...(marhala && marhala !== "all" ? { marhala: marhala as any } : {}) },
      _count: { status: true },
    });
    const statusCounts = Object.fromEntries(stats.map((s) => [s.status, s._count.status])) as Record<string, number>;
    const total = existing.length + created;
    const filled = (statusCounts.SUBMITTED || 0) + (statusCounts.APPROVED || 0) + (statusCounts.PUBLISHED || 0) + (statusCounts.DRAFT || 0);
    // DRAFT = created but not yet filled with marks — treat as not filled until marks >0
    return res.json({
      success: true,
      data: { weekNumber: wk, academicYear, marhala: marhala || "all", created, alreadyExisted: existing.length, total, statusCounts },
      message: created > 0 ? `Week ${wk} opened: ${created} new slips created (${existing.length} already existed)` : `Week ${wk} already fully initialized (${existing.length} slips)`,
    });
  } catch (error) {
    console.error("Weekly slips command error:", error);
    return res.status(500).json({ success: false, error: "Failed to issue weekly command" });
  }
});

// DELETE /api/admin/hifz-marhala/weekly-slip
router.delete("/weekly-slip", requireRole("ADMIN"), async (req, res) => {
  try {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ success: false, error: "Slip ID required" });
    await prisma.hifzWeeklySlip.delete({ where: { id } });
    return res.json({ success: true });
  } catch (error) {
    console.error("Delete weekly slip error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete weekly slip" });
  }
});

export default router;