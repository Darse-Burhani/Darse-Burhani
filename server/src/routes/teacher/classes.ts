
import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const classes = await prisma.class.findMany({
      where: { teacherId: teacherProfile.id },
      include: {
        _count: { select: { enrollments: true } },
        enrollments: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true, avatarUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      success: true,
      data: classes.map((c) => ({
        id: c.id,
        name: c.name,
        grade: c.grade,
        section: c.section,
        subject: c.subject,
        roomNumber: c.roomNumber,
        academicYear: c.academicYear,
        isActive: c.isActive,
        studentCount: c._count.enrollments,
        students: c.enrollments.map((e) => ({
          id: e.student.userId,
          profileId: e.student.id,
          studentNumber: e.student.studentId,
          firstName: e.student.user.firstName,
          lastName: e.student.user.lastName,
          avatarUrl: e.student.user.avatarUrl,
          grade: e.student.grade,
          section: e.student.section,
          points: e.student.currentPoints,
          tier: e.student.tier,
        })),
      })),
    });
  } catch (error) {
    console.error("Teacher classes error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch classes" });
  }
});

export default router;
