
import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("TEACHER", "ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacherProfile && session.user.role !== "ADMIN") {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    // Check if teacher has administrative / delegated manual attendance portal assignment
    let hasManualAttendanceAssignment = false;
    if (teacherProfile) {
      const assignment = await prisma.teacherPortalAssignment.findFirst({
        where: {
          teacherId: teacherProfile.id,
          isActive: true,
          portalType: {
            in: [
              "PAGE:manual-attendance",
              "PAGE:attendance",
              "PAGE:attendance-logs",
              "PAGE:attendance-manual",
              "PAGE:attendance-schedule",
              "PAGE:tilawat-dua",
              "manual-attendance",
              "ALL",
            ],
          },
        },
      });
      hasManualAttendanceAssignment = Boolean(assignment);
    }

    const isAdmin = session.user.role === "ADMIN";
    const whereClause: any =
      isAdmin || hasManualAttendanceAssignment
        ? { isActive: true }
        : {
            OR: [
              { teacherId: teacherProfile?.id },
              { masoolId: teacherProfile?.id },
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
        isMasool: isAdmin || (teacherProfile ? c.masoolId === teacherProfile.id : false),
        masoolId: c.masoolId,
        studentCount: c._count.enrollments,
        students: c.enrollments.map((e) => {
          const fn = e.student.user?.firstName || "";
          const ln = e.student.user?.lastName || "";
          const fullName = `${fn} ${ln}`.trim();
          const itsNum = e.student.its || e.student.studentId;
          return {
            id: e.student.userId,
            profileId: e.student.id,
            studentNumber: itsNum,
            its: itsNum,
            firstName: fn,
            lastName: ln,
            name: fullName || e.student.nameAr || `ITS ${itsNum}`,
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
