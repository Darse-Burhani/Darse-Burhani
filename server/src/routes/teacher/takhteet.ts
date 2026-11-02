
import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { cache } from "../../lib/cache";

const router = Router();

// GET /api/teacher/takhteet - Teacher's own plans or Darajah 1-4 syllabus
router.get("/", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const isAdmin = session.user.role === "ADMIN";
    const viewAll = req.query.view === "all" || req.query.all === "true";

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    let targetTeacherId: string | undefined = teacherProfile?.id;
    if (isAdmin && req.query.teacherId && typeof req.query.teacherId === "string") {
      targetTeacherId = req.query.teacherId;
    }

    if (!teacherProfile && !isAdmin) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const assignedCount = targetTeacherId
      ? await prisma.takhteetPlan.count({ where: { teacherId: targetTeacherId } })
      : 0;

    // Intelligent Syllabus & Portion Resolution:
    // 1. Direct assignments in TakhteetPlan take highest priority.
    // 2. If no direct assignments exist yet, match classes & subjects the teacher teaches in timetable.
    // 3. If neither exist, display active Darajah curriculum so teachers are never left with an empty screen.
    const whereClause: any = {};
    let isShowingAll = false;

    if (!isAdmin) {
      if (assignedCount > 0) {
        whereClause.teacherId = targetTeacherId;
      } else if (targetTeacherId) {
        // Teacher has no direct links yet. Check what they teach in timetable/classes:
        const [teacherSlots, teacherClasses] = await Promise.all([
          prisma.timetableSlot.findMany({
            where: { teacherId: targetTeacherId },
            select: { classId: true, subject: true },
          }),
          prisma.class.findMany({
            where: { teacherId: targetTeacherId },
            select: { id: true, subject: true },
          }),
        ]);

        const orFilters: any[] = [];
        for (const s of teacherSlots) {
          if (s.classId && s.subject) {
            orFilters.push({ classId: s.classId, subject: { equals: s.subject, mode: "insensitive" } });
          }
        }
        for (const c of teacherClasses) {
          if (c.id && c.subject) {
            orFilters.push({ classId: c.id, subject: { equals: c.subject, mode: "insensitive" } });
          }
        }

        if (orFilters.length > 0) {
          whereClause.OR = orFilters;
        } else {
          isShowingAll = true;
        }
      } else {
        isShowingAll = true;
      }
    } else {
      if (targetTeacherId && !viewAll) {
        whereClause.teacherId = targetTeacherId;
      } else {
        isShowingAll = true;
      }
    }

    const cacheKey = `teacher-takhteet-${targetTeacherId || "admin"}-${viewAll || isShowingAll ? "all" : "targeted"}`;
    const data = await cache.getOrSet(
      cacheKey,
      async () => {
        const plans = await prisma.takhteetPlan.findMany({
          where: whereClause,
          take: 300,
          include: {
            class: { select: { id: true, name: true, grade: true, section: true, subject: true } },
            progressLogs: {
              orderBy: { createdAt: "desc" },
              take: 3,
              select: {
                id: true,
                note: true,
                progressBefore: true,
                progressAfter: true,
                status: true,
                createdAt: true,
              },
            },
          },
          orderBy: [{ month: "asc" }, { createdAt: "desc" }],
        });

        return plans.map((p) => ({
          id: p.id,
          classId: p.classId,
          className: `${p.class.name} (${p.class.grade}${p.class.section})`,
          subject: p.subject,
          title: p.title,
          description: p.description,
          academicYear: p.academicYear,
          month: p.month,
          status: p.status,
          progress: p.progress,
          completedAt: p.completedAt,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
          logs: p.progressLogs,
        }));
      },
      { ttl: 30_000, tags: ["takhteet"] }
    );

    const totalCount = await prisma.takhteetPlan.count();

    return res.json({
      success: true,
      data,
      meta: {
        assignedCount,
        totalCount,
        isShowingAll: viewAll || assignedCount === 0,
      },
    });
  } catch (error) {
    console.error("Teacher takhteet fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch takhteet" });
  }
});

// PUT /api/teacher/takhteet/:id/progress - Teacher updates progress on own plan
router.put("/:id/progress", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const plan = await prisma.takhteetPlan.findUnique({ where: { id: req.params.id } });
    if (!plan) {
      return res.status(404).json({ success: false, error: "Plan not found" });
    }

    if (plan.teacherId !== teacherProfile.id && session.user.role !== "ADMIN") {
      // Auto-assign portion to the teacher actively updating their curriculum
      await prisma.takhteetPlan.update({
        where: { id: plan.id },
        data: { teacherId: teacherProfile.id },
      });
    }

    const body = req.body as Record<string, any>;
    const newStatus = (body.status || plan.status) as string;
    const newProgress =
      body.progress !== undefined
        ? Math.max(0, Math.min(100, parseInt(body.progress) || 0))
        : plan.progress;

    const updated = await prisma.takhteetPlan.update({
      where: { id: plan.id },
      data: {
        status: newStatus as any,
        progress: newProgress,
        completedAt:
          newStatus === "COMPLETED" ? new Date() : newStatus !== plan.status ? null : plan.completedAt,
      },
    });

    await prisma.takhteetProgressLog.create({
      data: {
        planId: plan.id,
        teacherId: teacherProfile.id,
        note: body.note || null,
        progressBefore: plan.progress,
        progressAfter: newProgress,
        status: newStatus as any,
      },
    });

    // Notify assigning admin in-app and in notification bar
    if (plan.assignedById && plan.assignedById !== session.user.id) {
      try {
        await prisma.notification.create({
          data: {
            userId: plan.assignedById,
            title: `Takhteet Plan Updated: ${plan.title}`,
            body: `${session.user.firstName} ${session.user.lastName} updated progress to ${newProgress}% (${newStatus}).`,
            type: "ANNOUNCEMENT",
            link: "/admin/takhteet",
            priority: newStatus === "COMPLETED" ? "HIGH" : "NORMAL",
          },
        });
      } catch (notifErr) {
        console.error("Takhteet progress notification error:", notifErr);
      }
    }

    cache.invalidateTag("takhteet");
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Teacher takhteet progress error:", error);
    return res.status(500).json({ success: false, error: "Failed to update progress" });
  }
});

export default router;
