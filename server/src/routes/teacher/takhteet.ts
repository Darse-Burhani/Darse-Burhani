
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/teacher/takhteet - Teacher's own plans
router.get("/", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const plans = await prisma.takhteetPlan.findMany({
      where: { teacherId: teacherProfile.id },
      include: {
        class: { select: { id: true, name: true, grade: true, section: true, subject: true } },
        progressLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
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
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      success: true,
      data: plans.map((p) => ({
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
      })),
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

    if (plan.teacherId !== teacherProfile.id) {
      return res.status(403).json({ success: false, error: "Not your plan" });
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

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Teacher takhteet progress error:", error);
    return res.status(500).json({ success: false, error: "Failed to update progress" });
  }
});

export default router;
