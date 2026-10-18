
import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const classId = req.query.classId as string;
    const page = Math.max(parseInt((req.query.page as string) || "1"), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "20"), 1), 100);
    const skip = (page - 1) * limit;

    const classIds = classId
      ? [classId]
      : (
          await prisma.class.findMany({
            where: { teacherId: teacherProfile.id, isActive: true },
            select: { id: true },
          })
        ).map((c) => c.id);

    const [studentIds, total] = await Promise.all([
      prisma.classEnrollment.findMany({
        where: { classId: { in: classIds }, isActive: true },
        select: { studentId: true },
        distinct: ["studentId"],
        skip,
        take: limit,
      }),
      prisma.classEnrollment.count({
        where: { classId: { in: classIds }, isActive: true },
      }),
    ]);

    const uniqueStudentIds = studentIds.map((e) => e.studentId);

    const students = uniqueStudentIds.length
      ? await prisma.studentProfile.findMany({
          // classEnrollment.studentId references StudentProfile.id (not user id)
          where: { id: { in: uniqueStudentIds } },
          select: {
            userId: true,
            currentPoints: true,
            totalPoints: true,
            tier: true,
            streakDays: true,
            id: true,
            grade: true,
            section: true,
            its: true,
            fatherName: true,
            motherName: true,
            user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
            talabatProfile1447: {
              select: {
                studentPhotoUrl: true,
                fatherPhotoUrl: true,
                motherPhotoUrl: true,
                fatherName: true,
                motherName: true,
                status: true,
              },
            },
          },
        })
      : [];

    return res.json({
      success: true,
      data: students.map((s) => ({
        id: s.userId,
        firstName: s.user.firstName,
        lastName: s.user.lastName,
        email: s.user.email,
        avatarUrl: s.talabatProfile1447?.studentPhotoUrl || s.user.avatarUrl,
        grade: s.grade,
        section: s.section,
        its: s.its,
        currentPoints: s.currentPoints,
        totalPoints: s.totalPoints,
        tier: s.tier,
        streakDays: s.streakDays,
        studentProfileId: s.id,
        fatherPhotoUrl: s.talabatProfile1447?.fatherPhotoUrl || null,
        motherPhotoUrl: s.talabatProfile1447?.motherPhotoUrl || null,
        fatherName: s.talabatProfile1447?.fatherName || s.fatherName || null,
        motherName: s.talabatProfile1447?.motherName || s.motherName || null,
        hasFatherPhoto: !!s.talabatProfile1447?.fatherPhotoUrl,
        hasMotherPhoto: !!s.talabatProfile1447?.motherPhotoUrl,
        profileStatus: s.talabatProfile1447?.status || "NOT_STARTED",
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Teacher students error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch students" });
  }
});

export default router;
