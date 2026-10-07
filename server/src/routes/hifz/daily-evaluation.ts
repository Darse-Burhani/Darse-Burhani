import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware";
import {
  calculateHifzProgressAndIkhtebaar,
  MAHAD_IKHTEBAAR_MILESTONES,
  TOTAL_QURAN_PAGES,
} from "../../lib/mahad-ikhtebaar";

const router = Router();

// Helper to get normalized date at 00:00:00 UTC
function normalizeDate(dateStr?: string | Date): Date {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * POST /api/hifz/daily-evaluation/sync
 * Syncs daily evaluation data (from eLearningQuran scraper/extension or manual bulk entry)
 */
router.post("/sync", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const { evaluations, date, academicYear = "1446-1447", source = "ELEARNING_QURAN" } = req.body;

    if (!Array.isArray(evaluations) || evaluations.length === 0) {
      return res.status(400).json({ success: false, error: "evaluations array is required" });
    }

    const targetDate = normalizeDate(date);

    // Identify teacher if requester is a teacher
    let facultyId: string | null = null;
    if (session.user.role === "TEACHER") {
      const teacher = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (teacher) facultyId = teacher.id;
    }

    const results: any[] = [];

    for (const item of evaluations) {
      // Find student by its, studentId, or profileId
      let student = null;
      if (item.its) {
        student = await prisma.studentProfile.findFirst({
          where: { its: String(item.its) },
          include: { user: true },
        });
      }
      if (!student && item.studentId) {
        student = await prisma.studentProfile.findFirst({
          where: {
            OR: [{ id: item.studentId }, { studentId: item.studentId }],
          },
          include: { user: true },
        });
      }

      if (!student) {
        results.push({
          success: false,
          error: `Student not found for identifier: ${item.its || item.studentId || item.name}`,
          item,
        });
        continue;
      }

      // Upsert daily evaluation
      const totalMarks =
        item.totalMarks ??
        ((item.sabaqMarks || 0) + (item.sabqiMarks || 0) + (item.murajaatMarks || 0));

      const evaluation = await prisma.hifzDailyEvaluation.upsert({
        where: {
          studentId_evaluationDate: {
            studentId: student.id,
            evaluationDate: targetDate,
          },
        },
        create: {
          studentId: student.id,
          facultyId: facultyId || item.facultyId || null,
          evaluationDate: targetDate,
          academicYear,
          marhala: item.marhala || null,
          currentJuz: item.currentJuz ? Number(item.currentJuz) : null,
          currentSafah: item.currentSafah ? Number(item.currentSafah) : null,
          sabaqSurah: item.sabaqSurah || null,
          sabaqAyahFrom: item.sabaqAyahFrom ? Number(item.sabaqAyahFrom) : null,
          sabaqAyahTo: item.sabaqAyahTo ? Number(item.sabaqAyahTo) : null,
          sabaqLines: item.sabaqLines ? Number(item.sabaqLines) : 0,
          sabaqMarks: item.sabaqMarks ? Number(item.sabaqMarks) : 0,
          sabqiJuz: item.sabqiJuz ? Number(item.sabqiJuz) : null,
          sabqiSafah: item.sabqiSafah ? Number(item.sabqiSafah) : null,
          sabqiMarks: item.sabqiMarks ? Number(item.sabqiMarks) : 0,
          murajaatJuz: item.murajaatJuz ? Number(item.murajaatJuz) : null,
          murajaatSafah: item.murajaatSafah ? Number(item.murajaatSafah) : null,
          murajaatMarks: item.murajaatMarks ? Number(item.murajaatMarks) : 0,
          totalMarks: Number(totalMarks),
          performanceRating: item.performanceRating || "GOOD",
          attendanceStatus: item.attendanceStatus || "PRESENT",
          teacherRemarks: item.teacherRemarks || null,
          source,
          syncedAt: new Date(),
        },
        update: {
          facultyId: facultyId || item.facultyId || undefined,
          academicYear,
          marhala: item.marhala || undefined,
          currentJuz: item.currentJuz ? Number(item.currentJuz) : undefined,
          currentSafah: item.currentSafah ? Number(item.currentSafah) : undefined,
          sabaqSurah: item.sabaqSurah || undefined,
          sabaqAyahFrom: item.sabaqAyahFrom ? Number(item.sabaqAyahFrom) : undefined,
          sabaqAyahTo: item.sabaqAyahTo ? Number(item.sabaqAyahTo) : undefined,
          sabaqLines: item.sabaqLines ? Number(item.sabaqLines) : undefined,
          sabaqMarks: item.sabaqMarks ? Number(item.sabaqMarks) : undefined,
          sabqiJuz: item.sabqiJuz ? Number(item.sabqiJuz) : undefined,
          sabqiSafah: item.sabqiSafah ? Number(item.sabqiSafah) : undefined,
          sabqiMarks: item.sabqiMarks ? Number(item.sabqiMarks) : undefined,
          murajaatJuz: item.murajaatJuz ? Number(item.murajaatJuz) : undefined,
          murajaatSafah: item.murajaatSafah ? Number(item.murajaatSafah) : undefined,
          murajaatMarks: item.murajaatMarks ? Number(item.murajaatMarks) : undefined,
          totalMarks: Number(totalMarks),
          performanceRating: item.performanceRating || undefined,
          attendanceStatus: item.attendanceStatus || undefined,
          teacherRemarks: item.teacherRemarks || undefined,
          source,
          syncedAt: new Date(),
        },
      });

      // Update student's Ikhtebaar target readiness
      const calc = calculateHifzProgressAndIkhtebaar({
        currentJuz: item.currentJuz,
        currentSafah: item.currentSafah,
        totalJadeedPages: item.totalJadeedPages,
      });

      // Find or upsert next Ikhtebaar target
      const target = await prisma.hifzIkhtebaarTarget.findFirst({
        where: {
          studentId: student.id,
          status: { in: ["PREPARING", "READY_FOR_TEST", "SUBMITTED"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (target) {
        await prisma.hifzIkhtebaarTarget.update({
          where: { id: target.id },
          data: {
            targetMarhala: calc.nextMilestone.key,
            targetName: calc.nextMilestone.name,
            targetJuzCount: Math.ceil(calc.nextMilestone.juzCount),
            pagesCompleted: calc.nextMilestone.pagesCompleted,
            totalPagesRequired: calc.nextMilestone.totalPagesRequired,
            readinessPercentage: calc.nextMilestone.progressPercentage,
            status: calc.nextMilestone.status,
          },
        });
      } else {
        await prisma.hifzIkhtebaarTarget.create({
          data: {
            studentId: student.id,
            targetMarhala: calc.nextMilestone.key,
            targetName: calc.nextMilestone.name,
            targetJuzCount: Math.ceil(calc.nextMilestone.juzCount),
            pagesCompleted: calc.nextMilestone.pagesCompleted,
            totalPagesRequired: calc.nextMilestone.totalPagesRequired,
            readinessPercentage: calc.nextMilestone.progressPercentage,
            status: calc.nextMilestone.status,
          },
        });
      }

      results.push({
        success: true,
        evaluationId: evaluation.id,
        studentName: `${student.user.firstName} ${student.user.lastName}`,
        its: student.its,
        progress: calc,
      });
    }

    return res.json({
      success: true,
      processedCount: results.filter((r) => r.success).length,
      totalCount: evaluations.length,
      results,
    });
  } catch (error: any) {
    console.error("Hifz daily evaluation sync error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hifz/daily-evaluation/overview
 * Overview for teachers / admins for a specific date
 */
router.get("/overview", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const dateQuery = (req.query.date as string) || "";
    const academicYear = (req.query.academicYear as string) || "1446-1447";
    const targetDate = normalizeDate(dateQuery);

    let whereStudent: any = { user: { isActive: true } };

    // If teacher, limit to their assigned students
    if (session.user.role === "TEACHER") {
      const teacher = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (teacher) {
        const assignments = await prisma.hifzMarhalaAssignment.findMany({
          where: {
            OR: [{ facultyId: teacher.id }, { musaidId: teacher.id }],
            isActive: true,
          },
          select: { studentId: true },
        });
        const assignedStudentIds = assignments.map((a) => a.studentId);
        whereStudent.id = { in: assignedStudentIds };
      }
    }

    const [students, evaluations] = await Promise.all([
      prisma.studentProfile.findMany({
        where: whereStudent,
        include: {
          user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          ikhtebaarTargets: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
        orderBy: { user: { firstName: "asc" } },
      }),
      prisma.hifzDailyEvaluation.findMany({
        where: {
          evaluationDate: targetDate,
          ...(academicYear ? { academicYear } : {}),
        },
        include: {
          faculty: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
    ]);

    // Map evaluation to each student
    const evalMap = new Map(evaluations.map((e) => [e.studentId, e]));

    const rows = students.map((s) => {
      const ev = evalMap.get(s.id);
      const ikhtebaar = s.ikhtebaarTargets[0];
      const progress = calculateHifzProgressAndIkhtebaar({
        currentJuz: ev?.currentJuz,
        currentSafah: ev?.currentSafah,
      });

      return {
        studentId: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        its: s.its,
        grade: s.grade,
        section: s.section,
        avatarUrl: s.user.avatarUrl,
        isEvaluated: !!ev,
        evaluation: ev || null,
        progress,
        nextIkhtebaar: ikhtebaar || progress.nextMilestone,
      };
    });

    return res.json({
      success: true,
      date: targetDate.toISOString().split("T")[0],
      totalStudents: students.length,
      evaluatedCount: evaluations.length,
      pendingCount: students.length - evaluations.length,
      students: rows,
    });
  } catch (error: any) {
    console.error("Hifz daily overview error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hifz/daily-evaluation/student/:studentId
 * Detailed Hifz daily evaluations, weekly slip progress, and Ikhtebaar readiness for a student
 */
router.get("/student/:studentId", requireAuth, async (req, res) => {
  try {
    const { studentId } = req.params;
    const academicYear = (req.query.academicYear as string) || "1446-1447";

    const student = await prisma.studentProfile.findFirst({
      where: {
        OR: [{ id: studentId }, { studentId: studentId }, { its: studentId }],
      },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        ikhtebaarTargets: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    // Fetch past 30 days daily evaluations
    const dailyEvals = await prisma.hifzDailyEvaluation.findMany({
      where: {
        studentId: student.id,
      },
      orderBy: { evaluationDate: "desc" },
      take: 30,
      include: {
        faculty: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    // Fetch latest evaluation
    const latestEval = dailyEvals[0];

    // Compute weekly sum (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weeklyEvals = dailyEvals.filter((e) => new Date(e.evaluationDate) >= sevenDaysAgo);
    const weeklyLines = weeklyEvals.reduce((acc, e) => acc + (e.sabaqLines || 0), 0);
    const weeklyPages = Number((weeklyLines / 15).toFixed(1)); // ~15 lines per standard Madinah mushaf page
    const weeklyAvgMarks =
      weeklyEvals.length > 0
        ? Number(
            (
              weeklyEvals.reduce((acc, e) => acc + (e.totalMarks || 0), 0) /
              weeklyEvals.length
            ).toFixed(1)
          )
        : 0;

    // Full Progress & Next Ikhtebaar calculation
    const progress = calculateHifzProgressAndIkhtebaar({
      currentJuz: latestEval?.currentJuz,
      currentSafah: latestEval?.currentSafah,
      weeklyPagesCount: weeklyPages || 1.5,
    });

    return res.json({
      success: true,
      student: {
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        its: student.its,
        grade: student.grade,
        section: student.section,
        avatarUrl: student.user.avatarUrl,
      },
      todayEvaluation: latestEval || null,
      recentEvaluations: dailyEvals,
      weeklySummary: {
        daysRecited: weeklyEvals.length,
        totalLinesRecited: weeklyLines,
        totalPagesRecited: weeklyPages,
        averageMarks: weeklyAvgMarks,
      },
      progress,
      ikhtebaarTargets: student.ikhtebaarTargets,
    });
  } catch (error: any) {
    console.error("Hifz student daily evaluation error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hifz/daily-evaluation/my-progress
 * Endpoint for logged-in Talabat or Parent to view daily & Ikhtebaar reflection
 */
router.get("/my-progress", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    let studentId: string | null = null;

    if (session.user.role === "STUDENT") {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (profile) studentId = profile.id;
    } else if (session.user.role === "PARENT") {
      const parent = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { studentLinks: true },
      });
      if (parent && parent.studentLinks.length > 0) {
        studentId = parent.studentLinks[0].studentId;
      }
    }

    if (!studentId) {
      return res.status(404).json({ success: false, error: "Student profile not linked to user" });
    }

    // Call internal calculation logic
    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true } },
        ikhtebaarTargets: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Student record not found" });
    }

    const isHafiz = student.status === "HAFIZ" || !!student.hafizYear;
    if (isHafiz) {
      return res.json({
        success: true,
        isHafiz: true,
        student: {
          id: student.id,
          name: `${student.user.firstName} ${student.user.lastName}`,
          its: student.its,
          grade: student.grade,
          section: student.section,
          avatarUrl: student.user.avatarUrl,
          status: student.status,
          hafizYear: student.hafizYear,
        },
      });
    }

    const dailyEvals = await prisma.hifzDailyEvaluation.findMany({
      where: { studentId: student.id },
      orderBy: { evaluationDate: "desc" },
      take: 14,
      include: {
        faculty: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    const latestEval = dailyEvals[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weeklyEvals = dailyEvals.filter((e) => new Date(e.evaluationDate) >= sevenDaysAgo);
    const weeklyLines = weeklyEvals.reduce((acc, e) => acc + (e.sabaqLines || 0), 0);
    const weeklyPages = Number((weeklyLines / 15).toFixed(1));

    const progress = calculateHifzProgressAndIkhtebaar({
      currentJuz: latestEval?.currentJuz,
      currentSafah: latestEval?.currentSafah,
      weeklyPagesCount: weeklyPages || 1.5,
    });

    return res.json({
      success: true,
      student: {
        id: student.id,
        name: `${student.user.firstName} ${student.user.lastName}`,
        its: student.its,
        grade: student.grade,
        section: student.section,
        avatarUrl: student.user.avatarUrl,
      },
      todayEvaluation: latestEval || null,
      recentEvaluations: dailyEvals,
      weeklySummary: {
        daysRecited: weeklyEvals.length,
        totalLinesRecited: weeklyLines,
        totalPagesRecited: weeklyPages,
      },
      progress,
      nextIkhtebaar: student.ikhtebaarTargets[0] || progress.nextMilestone,
    });
  } catch (error: any) {
    console.error("My Hifz progress error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
