import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const assignments = await prisma.teacherPortalAssignment.findMany({
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const teachers = await prisma.teacherProfile.findMany({
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        portalAssignments: true,
      },
    });

    return res.json({
      success: true,
      data: {
        assignments: assignments.map((a) => ({
          id: a.id,
          teacherId: a.teacherId,
          teacherName: `${a.teacher.user.firstName} ${a.teacher.user.lastName}`,
          teacherEmail: a.teacher.user.email,
          portalType: a.portalType,
          assignedById: a.assignedById,
          isActive: a.isActive,
          createdAt: a.createdAt,
        })),
        teachers: teachers.map((t) => ({
          id: t.userId,
          name: `${t.user.firstName} ${t.user.lastName}`,
          email: t.user.email,
          employeeId: t.employeeId,
          assignments: t.portalAssignments.map((a) => ({
            portalType: a.portalType,
            isActive: a.isActive,
          })),
        })),
      },
    });
  } catch (error) {
    console.error("Portal assignments fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch assignments" });
  }
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { teacherId, portalType } = body;

    if (!teacherId || !portalType) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // Get teacher profile
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: teacherId },
    });

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher not found" });
    }

    // Create or update assignment
    const assignment = await prisma.teacherPortalAssignment.upsert({
      where: {
        teacherId_portalType: {
          teacherId: teacherProfile.id,
          portalType,
        },
      },
      update: {
        isActive: true,
        assignedById: session.user.id,
      },
      create: {
        teacherId: teacherProfile.id,
        portalType,
        assignedById: session.user.id,
        isActive: true,
      },
    });

    // If HIFZ portal is assigned, also enable portfolio
    if (portalType === "HIFZ") {
      await prisma.teacherProfile.update({
        where: { id: teacherProfile.id },
        data: { portfolioEnabled: true },
      });
    }

    return res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    console.error("Portal assignment create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create assignment" });
  }
});

router.delete("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const id = (req.query.id as string);

    if (!id) {
      return res.status(400).json({ success: false, error: "Assignment ID required" });
    }

    await prisma.teacherPortalAssignment.delete({ where: { id } });

    return res.json({ success: true });
  } catch (error) {
    console.error("Portal assignment delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete assignment" });
  }
});

export default router;
