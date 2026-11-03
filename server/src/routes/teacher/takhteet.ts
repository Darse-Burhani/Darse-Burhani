
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

    const [assignedCount, teacherSlots, teacherClasses, teacherProfileData] = await Promise.all([
      targetTeacherId ? prisma.takhteetPlan.count({ where: { teacherId: targetTeacherId } }) : 0,
      targetTeacherId
        ? prisma.timetableSlot.findMany({
            where: { teacherId: targetTeacherId },
            select: { classId: true, subject: true },
          })
        : [],
      targetTeacherId
        ? prisma.class.findMany({
            where: { teacherId: targetTeacherId },
            select: { id: true, subject: true },
          })
        : [],
      targetTeacherId
        ? prisma.teacherProfile.findUnique({
            where: { id: targetTeacherId },
            select: {
              subjects: true,
              portalAssignments: { where: { isActive: true }, select: { portalType: true } },
            },
          })
        : null,
    ]);

    const hasExplicitTakhteetAssignment = teacherProfileData?.portalAssignments.some(
      (a: any) => a.portalType === "ALL" || a.portalType === "PAGE:takhteet" || a.portalType === "TAKHTEET"
    );

    const hasAssignedTeaching =
      assignedCount > 0 ||
      teacherSlots.length > 0 ||
      teacherClasses.length > 0 ||
      (Array.isArray(teacherProfileData?.subjects) && teacherProfileData.subjects.length > 0) ||
      Boolean(hasExplicitTakhteetAssignment);

    // Strictly restrict: Faculty members who do NOT have assigned subjects and classes
    // must NOT be shown Takhteet portions unless explicitly delegated by Admin.
    if (!isAdmin && !hasAssignedTeaching) {
      return res.json({
        success: true,
        data: [],
        meta: {
          totalPlans: 0,
          completedPlans: 0,
          inProgressPlans: 0,
          notStartedPlans: 0,
          assignedToTeacherCount: 0,
          isShowingAll: false,
        },
        message: "No assigned teaching subjects or classes found for this faculty member.",
      });
    }

    // Strictly isolate Takhteet portions:
    // Teachers must ONLY see portions for the exact class and subject assigned to them in timetable or class assignments.
    const whereClause: any = {};
    let isShowingAll = false;

    if (!isAdmin) {
      const orFilters: any[] = [];

      // 1. Explicitly assigned portions where teacherId matches
      if (targetTeacherId) {
        orFilters.push({ teacherId: targetTeacherId });
      }

      // 2. Strict (classId, subject) pairs from TimetableSlot assigned to this teacher
      for (const s of teacherSlots) {
        if (s.classId && s.subject) {
          orFilters.push({
            classId: s.classId,
            subject: { equals: s.subject.trim(), mode: "insensitive" },
          });
        }
      }

      // 3. Strict (classId, subject) pairs from Class assigned to this teacher
      for (const c of teacherClasses) {
        if (c.id && c.subject && c.subject !== "General" && c.subject !== "Darajah Core Curriculum") {
          orFilters.push({
            classId: c.id,
            subject: { equals: c.subject.trim(), mode: "insensitive" },
          });
        }
      }

      if (orFilters.length > 0) {
        whereClause.OR = orFilters;
      } else if (hasExplicitTakhteetAssignment && viewAll) {
        isShowingAll = true;
      } else {
        whereClause.teacherId = targetTeacherId || "__NONE__";
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
          take: 1500,
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

    if (session.user.role !== "ADMIN") {
      // Strictly enforce: Teacher can ONLY update portions for the class and subject assigned to them!
      const isDirectOwner = plan.teacherId === teacherProfile.id;
      const teachesClassSubjectInTimetable = await prisma.timetableSlot.findFirst({
        where: {
          teacherId: teacherProfile.id,
          classId: plan.classId,
          subject: { equals: plan.subject, mode: "insensitive" },
        },
      });
      const teachesClassDirectly = await prisma.class.findFirst({
        where: {
          teacherId: teacherProfile.id,
          id: plan.classId,
          subject: { equals: plan.subject, mode: "insensitive" },
        },
      });

      if (!isDirectOwner && !teachesClassSubjectInTimetable && !teachesClassDirectly) {
        return res.status(403).json({
          success: false,
          error: "You can only update syllabus portions for classes and subjects assigned to you.",
        });
      }

      // Auto-assign portion to the teacher actively updating their curriculum if not yet assigned
      if (!isDirectOwner) {
        await prisma.takhteetPlan.update({
          where: { id: plan.id },
          data: { teacherId: teacherProfile.id },
        });
      }
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
