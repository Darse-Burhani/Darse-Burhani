import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { cache } from "../../lib/cache";
import { canonicalizeTeacherDisplay, canonicalizeTeacherName } from "../../lib/timetable-master-sync";

const router = Router();

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// GET /api/admin/takhteet/export?format=csv|json - Export all plans
router.get("/export", requireRole("ADMIN"), async (req, res) => {
  try {
    const format = (req.query.format as string) || "csv";

    const plans = await prisma.takhteetPlan.findMany({
      include: {
        teacher: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
        class: { select: { name: true, grade: true, section: true } },
      },
      orderBy: [{ academicYear: "desc" }, { month: "asc" }, { createdAt: "desc" }],
    });

    const rows = plans.map((p) => ({
      teacher: p.teacher?.user ? `${p.teacher.user.firstName} ${p.teacher.user.lastName}` : "Unassigned",
      teacherEmail: p.teacher?.user?.email || "",
      class: p.class ? `${p.class.name} (${p.class.grade}${p.class.section})` : "Unassigned",
      subject: p.subject,
      portion: p.title,
      academicYear: p.academicYear,
      month: p.month ? MONTH_NAMES[p.month - 1] || p.month : "Full year",
      status: p.status,
      progress: p.progress,
      description: p.description || "",
      updatedAt: p.updatedAt.toISOString().split("T")[0],
    }));

    if (format === "csv") {
      const headers = [
        "Teacher", "Teacher Email", "Class", "Subject", "Portion",
        "Academic Year", "Month", "Status", "Progress %", "Notes", "Last Updated",
      ];
      const csv = [
        headers.join(","),
        ...rows.map((r) =>
          [
            `"${r.teacher.replace(/"/g, '""')}"`,
            `"${r.teacherEmail.replace(/"/g, '""')}"`,
            `"${r.class.replace(/"/g, '""')}"`,
            `"${r.subject.replace(/"/g, '""')}"`,
            `"${r.portion.replace(/"/g, '""')}"`,
            r.academicYear,
            r.month,
            r.status,
            r.progress,
            `"${r.description.replace(/"/g, '""')}"`,
            r.updatedAt,
          ].join(",")
        ),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="takhteet-export-${new Date().toISOString().split("T")[0]}.csv"`);
      return res.status(200).send(csv);
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="takhteet-export-${new Date().toISOString().split("T")[0]}.json"`);
    return res.status(200).json({ success: true, data: rows, total: rows.length });
  } catch (error) {
    console.error("Takhteet export error:", error);
    return res.status(500).json({ success: false, error: "Failed to export takhteet" });
  }
});

// GET /api/admin/takhteet - Teachers with their classes + all plans (cached in-memory)
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const data = await cache.getOrSet(
      "admin:takhteet",
      async () => {
        const [teachers, classes, plans] = await Promise.all([
          prisma.teacherProfile.findMany({
            where: { user: { isActive: true } },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
              classes: {
                select: {
                  id: true,
                  name: true,
                  subject: true,
                  academicYear: true,
                  isActive: true,
                },
              },
              takhteetPlans: {
                select: {
                  id: true,
                  title: true,
                  subject: true,
                  progress: true,
                  status: true,
                  month: true,
                  academicYear: true,
                  updatedAt: true,
                },
                orderBy: { updatedAt: "desc" },
              },
              _count: { select: { takhteetPlans: true } },
            },
            orderBy: { user: { firstName: "asc" } },
          }),
          prisma.class.findMany({
            include: {
              teacher: {
                select: {
                  user: { select: { id: true, firstName: true, lastName: true } },
                },
              },
              takhteetPlans: {
                select: {
                  id: true,
                  title: true,
                  progress: true,
                  status: true,
                },
              },
            },
            orderBy: { createdAt: "desc" },
          }),
          prisma.takhteetPlan.findMany({
            include: {
              teacher: {
                select: {
                  id: true,
                  user: { select: { id: true, firstName: true, lastName: true, email: true } },
                },
              },
              class: { select: { id: true, name: true, grade: true, section: true } },
              _count: { select: { progressLogs: true } },
              progressLogs: {
                orderBy: { createdAt: "desc" },
                take: 1,
                select: { note: true, createdAt: true },
              },
            },
            orderBy: { createdAt: "desc" },
          }),
        ]);

        return {
          teachers: teachers.map((t) => {
            const takhteetDisplay = canonicalizeTeacherDisplay(`${t.user.firstName} ${t.user.lastName}`, t.user.avatarUrl);
            const totalPlans = t._count.takhteetPlans;
            const avgProgress = totalPlans > 0
              ? Math.round(t.takhteetPlans.reduce((acc, p) => acc + (p.progress || 0), 0) / totalPlans)
              : 0;
            const completedCount = t.takhteetPlans.filter((p) => p.status === "COMPLETED").length;
            const inProgressCount = t.takhteetPlans.filter((p) => p.status === "IN_PROGRESS").length;
            const pendingCount = t.takhteetPlans.filter((p) => p.status === "PENDING").length;

            return {
              id: t.userId,
              teacherProfileId: t.id,
              name: takhteetDisplay.name,
              email: t.user.email,
              avatarUrl: takhteetDisplay.avatarUrl,
              employeeId: t.employeeId,
              department: t.department,
              subjects: t.subjects,
              planCount: totalPlans,
              avgProgress,
              completedCount,
              inProgressCount,
              pendingCount,
              assignedPortions: t.takhteetPlans.map((p) => ({
                id: p.id,
                title: p.title,
                subject: p.subject,
                progress: p.progress,
                status: p.status,
                month: p.month,
                academicYear: p.academicYear,
                updatedAt: p.updatedAt,
              })),
              classes: t.classes.map((c) => ({
                classId: c.id,
                className: c.name,
                subject: c.subject,
                academicYear: c.academicYear,
                isActive: c.isActive,
              })),
            };
          }),
          classes: classes.map((c: any) => {
            const planCount = c.takhteetPlans?.length || 0;
            const avgProgress = planCount > 0
              ? Math.round(c.takhteetPlans.reduce((sum: number, p: any) => sum + (p.progress || 0), 0) / planCount)
              : null;
            return {
              id: c.id,
              name: c.name,
              grade: c.grade,
              section: c.section,
              subject: c.subject,
              academicYear: c.academicYear,
              isActive: c.isActive,
              teacherUserId: c.teacher?.user?.id || null,
              teacherName: canonicalizeTeacherName(c.teacher?.user ? `${c.teacher.user.firstName} ${c.teacher.user.lastName}` : "Unassigned") || "Unassigned",
              planCount,
              avgProgress,
              plans: c.takhteetPlans || [],
            };
          }),
          plans: plans.map((p) => ({
            id: p.id,
            teacherId: p.teacher?.user?.id || "",
            teacherName: canonicalizeTeacherName(p.teacher?.user ? `${p.teacher.user.firstName} ${p.teacher.user.lastName}` : "Unassigned") || "Unassigned",
            teacherEmail: p.teacher?.user?.email || "",
            classId: p.classId,
            className: p.class ? `${p.class.name} (${p.class.grade}${p.class.section})` : "Unassigned",
            subject: p.subject,
            title: p.title,
            description: p.description,
            academicYear: p.academicYear,
            month: p.month,
            status: p.status,
            progress: p.progress,
            logCount: p._count?.progressLogs || 0,
            lastLog: p.progressLogs?.[0] || null,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })),
        };
      },
      { ttl: 30_000, tags: ["takhteet", "teacher", "class"] }
    );

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Takhteet fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch takhteet" });
  }
});

// POST /api/admin/takhteet - Create a portion plan
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { teacherId, classId, subject, title, description, academicYear, month } = body;

    if (!teacherId || !classId || !title) {
      return res.status(400).json({ success: false, error: "Teacher, class and portion title are required" });
    }

    const teacherProfile = await prisma.teacherProfile.findUnique({ where: { userId: teacherId } });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher not found" });
    }

    const cls = await prisma.class.findUnique({ where: { id: classId } });
    if (!cls) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }

    const plan = await prisma.takhteetPlan.create({
      data: {
        teacherId: teacherProfile.id,
        classId,
        subject: subject || cls.subject || "",
        title,
        description: description || null,
        academicYear: academicYear || cls.academicYear || "2026-2027",
        month: month ? parseInt(month) : null,
        assignedById: session.user.id,
      },
    });

    await prisma.notification.create({
      data: {
        userId: teacherId,
        title: "New Takhteet assigned",
        body: `You have been assigned "${title}" for ${cls.name} (${plan.subject}).`,
        type: "TAKHTEET",
        link: "/teacher/takhteet",
      },
    });

    cache.invalidateTag("takhteet");
    return res.status(201).json({ success: true, data: plan });
  } catch (error) {
    console.error("Takhteet create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create takhteet" });
  }
});

// PUT /api/admin/takhteet/:id - Update a plan (incl. progress/status)
router.put("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const plan = await prisma.takhteetPlan.findUnique({ where: { id: req.params.id } });
    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }

    const body = req.body as Record<string, any>;
    const { title, description, subject, academicYear, month, status, progress, teacherId, classId } = body;

    let resolvedTeacherProfileId = plan.teacherId;
    if (teacherId && teacherId !== plan.teacherId) {
      const tp = await prisma.teacherProfile.findFirst({
        where: { OR: [{ id: teacherId }, { userId: teacherId }] },
      });
      if (tp) resolvedTeacherProfileId = tp.id;
    }

    const newStatus = (status || plan.status) as string;
    const newProgress =
      progress !== undefined ? Math.max(0, Math.min(100, parseInt(progress) || 0)) : plan.progress;

    const updated = await prisma.takhteetPlan.update({
      where: { id: plan.id },
      data: {
        teacherId: resolvedTeacherProfileId,
        classId: classId || plan.classId,
        title: title ?? plan.title,
        description: description !== undefined ? description || null : plan.description,
        subject: subject ?? plan.subject,
        academicYear: academicYear ?? plan.academicYear,
        month: month !== undefined ? (month ? parseInt(month) : null) : plan.month,
        status: newStatus as any,
        progress: newProgress,
        completedAt:
          newStatus === "COMPLETED" ? new Date() : newStatus !== plan.status ? null : plan.completedAt,
      },
    });

    // Record a progress log when progress or status actually changed
    if (newProgress !== plan.progress || newStatus !== plan.status) {
      await prisma.takhteetProgressLog.create({
        data: {
          planId: plan.id,
          teacherId: resolvedTeacherProfileId,
          note: body.note || null,
          progressBefore: plan.progress,
          progressAfter: newProgress,
          status: newStatus as any,
        },
      });
    }

    cache.invalidateTag("takhteet");
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Takhteet update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update takhteet" });
  }
});

// POST /api/admin/takhteet/bulk-assign - Bulk reassign portions of a class/subject to a teacher
router.post("/bulk-assign", requireRole("ADMIN"), async (req, res) => {
  try {
    const { classId, subject, teacherId } = req.body as Record<string, any>;
    if (!teacherId) {
      return res.status(400).json({ success: false, error: "Teacher is required" });
    }
    const tp = await prisma.teacherProfile.findFirst({
      where: { OR: [{ id: teacherId }, { userId: teacherId }] },
    });
    if (!tp) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const where: any = {};
    if (classId) where.classId = classId;
    if (subject) where.subject = subject;

    const result = await prisma.takhteetPlan.updateMany({
      where,
      data: { teacherId: tp.id },
    });

    cache.invalidateTag("takhteet");
    return res.json({ success: true, count: result.count, message: `Successfully assigned ${result.count} portions to faculty.` });
  } catch (err: any) {
    console.error("Takhteet bulk-assign error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to bulk assign" });
  }
});

// POST /api/admin/takhteet/sync-tafseel - Ingest & apply Tafseel 1-4 Excel files from public
router.post("/sync-tafseel", requireRole("ADMIN"), async (req, res) => {
  try {
    const { importTafseelCurriculum } = await import("../../lib/takhteet-tafseel-sync");
    const result = await importTafseelCurriculum();
    return res.json({
      success: true,
      message: `Successfully ingested ${result.totalPortions} Tafseel units for Darajah 1, 2, 3, 4!`,
      data: result,
    });
  } catch (error: any) {
    console.error("Takhteet sync-tafseel error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to sync Tafseel curriculum" });
  }
});

// DELETE /api/admin/takhteet/:id - Delete a plan
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.takhteetPlan.delete({ where: { id: req.params.id } });
    cache.invalidateTag("takhteet");
    return res.json({ success: true });
  } catch (error) {
    console.error("Takhteet delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete takhteet" });
  }
});

export default router;
