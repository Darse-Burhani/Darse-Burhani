
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const childId = req.query.childId as string;

    // Get parent profile
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!parentProfile) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    // Get linked children
    const links = await prisma.parentStudentLink.findMany({
      where: { parentId: parentProfile.id },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            classEnrollments: {
              include: {
                class: { select: { name: true, grade: true, section: true } },
              },
            },
          },
        },
      },
    });

    const childIds = links
      .filter((l) => !childId || l.studentId === childId)
      .map((l) => l.studentId);

    if (childIds.length === 0) {
      return res.json({ success: true, data: { children: [] } });
    }

    // Fetch published hifz reports for linked children
    const reports = await prisma.hifzReport.findMany({
      where: {
        studentId: { in: childIds },
        isPublished: true,
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
            classEnrollments: {
              include: {
                class: { select: { name: true, grade: true, section: true } },
              },
            },
          },
        },
        parts: {
          where: { isHidden: false },
          orderBy: { partNumber: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    // Build weekly/monthly summaries
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const children = reports.map((report) => {
      const parts = report.parts;
      const totalParts = parts.length;
      const completedParts = parts.filter((p) => p.status === "COMPLETED").length;
      const inProgressParts = parts.filter((p) => p.status === "IN_PROGRESS").length;
      const weakParts = parts.filter((p) => p.isWeak).length;
      const overallProgress = totalParts > 0 ? Math.round((completedParts / totalParts) * 100) : 0;

      // Weekly activity - parts updated in the last 7 days
      const weeklyActiveParts = parts.filter(
        (p) => new Date(p.updatedAt) >= oneWeekAgo
      );
      const weeklyReviews = weeklyActiveParts.reduce((sum, p) => sum + p.reviewCount, 0);
      const weeklySentences = weeklyActiveParts.reduce((sum, p) => sum + p.sentencesMemorized, 0);

      // Monthly activity
      const monthlyActiveParts = parts.filter(
        (p) => new Date(p.updatedAt) >= oneMonthAgo
      );
      const monthlyCompleted = monthlyActiveParts.filter((p) => p.status === "COMPLETED").length;
      const monthlyReviews = monthlyActiveParts.reduce((sum, p) => sum + p.reviewCount, 0);

      const grade = report.student.classEnrollments[0]?.class.grade || "";
      const section = report.student.classEnrollments[0]?.class.section || "";

      return {
        reportId: report.id,
        studentName: `${report.student.user.firstName} ${report.student.user.lastName}`,
        studentId: report.studentId,
        studentGrade: grade,
        studentSection: section,
        currentPoints: report.student.currentPoints,
        totalPoints: report.student.totalPoints,
        streakDays: report.student.streakDays,
        tier: report.student.tier,
        academicYear: report.academicYear,
        semester: report.semester,
        publishedAt: report.publishedAt,
        updatedAt: report.updatedAt,
        summary: {
          totalParts,
          completedParts,
          inProgressParts,
          weakParts,
          overallProgress,
        },
        weekly: {
          activeParts: weeklyActiveParts.length,
          reviews: weeklyReviews,
          sentences: weeklySentences,
        },
        monthly: {
          completedParts: monthlyCompleted,
          reviews: monthlyReviews,
        },
        parts: parts.map((p) => ({
          partNumber: p.partNumber,
          status: p.status,
          progress: p.progress,
          reviewCount: p.reviewCount,
          targetReviews: p.targetReviews,
          sentencesMemorized: p.sentencesMemorized,
          sentencePercentage: p.sentencePercentage,
          isWeak: p.isWeak,
          notes: p.notes,
          updatedAt: p.updatedAt,
        })),
      };
    });

    return res.json({ success: true, data: { children } });
  } catch (error) {
    console.error("Parent hifz fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch hifz data" });
  }
});

// GET /api/parent/hifz/weekly-slips - Fetch published weekly slips for parent's children
router.get("/weekly-slips", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const childId = req.query.childId as string;

    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!parentProfile) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    const links = await prisma.parentStudentLink.findMany({
      where: { parentId: parentProfile.id },
      select: { studentId: true },
    });

    const childIds = links
      .filter((l) => !childId || l.studentId === childId)
      .map((l) => l.studentId);

    if (childIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const slips = await prisma.hifzWeeklySlip.findMany({
      where: {
        studentId: { in: childIds },
        status: "PUBLISHED",
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        faculty: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: [{ weekNumber: "desc" }, { createdAt: "desc" }],
    });

    return res.json({ success: true, data: slips });
  } catch (error) {
    console.error("Parent weekly slips fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch weekly slips" });
  }
});

export default router;
