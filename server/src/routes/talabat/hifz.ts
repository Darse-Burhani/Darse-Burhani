
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const studentId = req.query.studentId as string;

    // Get student profile
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { firstName: true, lastName: true } },
        classEnrollments: {
          include: {
            class: { select: { name: true, grade: true, section: true } },
          },
        },
      },
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    // Allow viewing other students' reports (for portal links) or own report
    const targetStudentId = studentId || studentProfile.id;

    // Fetch published hifz report
    const report = await prisma.hifzReport.findFirst({
      where: {
        studentId: targetStudentId,
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

    if (!report) {
      return res.json({ success: true, data: { report: null } });
    }

    const parts = report.parts;
    const totalParts = parts.length;
    const completedParts = parts.filter((p) => p.status === "COMPLETED").length;
    const inProgressParts = parts.filter((p) => p.status === "IN_PROGRESS").length;
    const weakParts = parts.filter((p) => p.isWeak).length;
    const overallProgress = totalParts > 0 ? Math.round((completedParts / totalParts) * 100) : 0;

    const grade = report.student.classEnrollments[0]?.class.grade || "";
    const section = report.student.classEnrollments[0]?.class.section || "";

    const reportData = {
      reportId: report.id,
      studentName: `${report.student.user.firstName} ${report.student.user.lastName}`,
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
      parts: parts.map((p) => ({
        partNumber: p.partNumber,
        status: p.status,
        progress: p.progress,
        reviewCount: p.reviewCount,
        targetReviews: p.targetReviews,
        sentencesMemorized: p.sentencesMemorized,
        sentencePercentage: p.sentencePercentage,
        currentPage: p.currentPage,
        totalPages: p.totalPages,
        firmProgress: p.firmProgress,
        firmTarget: p.firmTarget,
        isWeak: p.isWeak,
        notes: p.notes,
        updatedAt: p.updatedAt,
      })),
    };

    return res.json({ success: true, data: { report: reportData } });
  } catch (error) {
    console.error("Student hifz fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch hifz data" });
  }
});

export default router;
