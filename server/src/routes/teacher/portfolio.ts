
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, portfolioEnabled: true },
    });

    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    // Portfolio access removed - admin can access any page, portfolioEnabled no longer blocks
    // if (!teacherProfile.portfolioEnabled) {
    //   return res.json({ success: true, data: { enabled: false } });
    // }

    const classes = await prisma.class.findMany({
      where: { teacherId: teacherProfile.id, isActive: true },
      include: {
        _count: { select: { enrollments: true } },
        enrollments: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const classIds = classes.map((c) => c.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 86400000);

    const [attendanceToday, pointsToday] = await Promise.all([
      prisma.attendanceRecord.count({
        where: { classId: { in: classIds }, date: { gte: today, lt: tomorrow }, status: "PRESENT" },
      }),
      prisma.pointLog.aggregate({
        where: { teacherId: teacherProfile.id, createdAt: { gte: today, lt: tomorrow } },
        _sum: { points: true },
      }),
    ]);

    // Flatten students across all classes, deduplicated
    const seen = new Set<string>();
    const allStudents: any[] = [];
    for (const cls of classes) {
      for (const enrollment of cls.enrollments) {
        if (seen.has(enrollment.student.userId)) continue;
        seen.add(enrollment.student.userId);
        allStudents.push({
          id: enrollment.student.userId,
          firstName: enrollment.student.user.firstName,
          lastName: enrollment.student.user.lastName,
          currentPoints: enrollment.student.currentPoints,
          totalPoints: enrollment.student.totalPoints,
          tier: enrollment.student.tier,
          streakDays: enrollment.student.streakDays,
          studentProfileId: enrollment.student.id,
        });
      }
    }

    const totalStudents = allStudents.length;

    return res.json({
      success: true,
      data: {
        enabled: true,
        stats: {
          totalStudents,
          totalClasses: classes.length,
          presentToday: attendanceToday,
          pointsToday: pointsToday._sum.points || 0,
          atRiskCount: 0,
        },
        classes: classes.map((c) => ({
          id: c.id,
          name: c.name,
          grade: c.grade,
          section: c.section,
          subject: c.subject,
          roomNumber: c.roomNumber,
          studentCount: c._count.enrollments,
          students: c.enrollments.map((e) => ({
            id: e.student.userId,
            firstName: e.student.user.firstName,
            lastName: e.student.user.lastName,
            currentPoints: e.student.currentPoints,
            tier: e.student.tier,
          })),
        })),
        students: allStudents,
        atRiskStudents: [],
        moodDistribution: {},
      },
    });
  } catch (error) {
    console.error("Portfolio fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch portfolio" });
  }
});

export default router;
