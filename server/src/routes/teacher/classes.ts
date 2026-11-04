
import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("TEACHER", "ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    let teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    // If an Admin accesses this endpoint without a TeacherProfile, allow them to view all classes
    if (!teacherProfile && session.user.role === "ADMIN") {
      const classes = await prisma.class.findMany({
        where: { isActive: true },
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
        orderBy: [{ grade: "asc" }, { section: "asc" }, { name: "asc" }],
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
          isMasool: true,
          masoolId: null,
          studentCount: c._count.enrollments,
          students: c.enrollments.map((e) => {
            const fn = e.student.user?.firstName || "";
            const ln = e.student.user?.lastName || "";
            const fullName = `${fn} ${ln}`.trim();
            return {
              id: e.student.userId,
              profileId: e.student.id,
              studentNumber: e.student.studentId,
              its: e.student.studentId,
              firstName: fn,
              lastName: ln,
              name: fullName || e.student.studentId || "Student",
              avatarUrl: e.student.user?.avatarUrl || null,
              grade: e.student.grade,
              section: e.student.section,
              points: e.student.currentPoints,
              tier: e.student.tier,
            };
          }),
        })),
      });
    }

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    // Check if teacher has administrative / delegated manual attendance portal assignment
    const hasManualAttendanceAssignment = await prisma.teacherPortalAssignment.findFirst({
      where: {
        teacherId: teacherProfile.id,
        portal: { in: ["manual-attendance", "attendance-manual", "attendance", "attendance-logs"] },
      },
    });

    const whereClause: any = hasManualAttendanceAssignment
      ? { isActive: true }
      : {
          OR: [
            { teacherId: teacherProfile.id },
            { masoolId: teacherProfile.id },
          ],
        };

    const classes = await prisma.class.findMany({
      where: whereClause,
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
      orderBy: [{ grade: "asc" }, { section: "asc" }, { name: "asc" }],
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
        isMasool: c.masoolId === teacherProfile.id,
        masoolId: c.masoolId,
        studentCount: c._count.enrollments,
        students: c.enrollments.map((e) => {
          const fn = e.student.user?.firstName || "";
          const ln = e.student.user?.lastName || "";
          const fullName = `${fn} ${ln}`.trim();
          return {
            id: e.student.userId,
            profileId: e.student.id,
            studentNumber: e.student.studentId,
            its: e.student.studentId,
            firstName: fn,
            lastName: ln,
            name: fullName || e.student.studentId || "Student",
            avatarUrl: e.student.user?.avatarUrl || null,
            grade: e.student.grade,
            section: e.student.section,
            points: e.student.currentPoints,
            tier: e.student.tier,
          };
        }),
      })),
    });
  } catch (error) {
    console.error("Teacher classes error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch classes" });
  }
});

export default router;
