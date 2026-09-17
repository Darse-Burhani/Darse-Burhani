import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/teacher/hifz-weekly-slip/weeks - Distinct weeks that already have slips for my students
router.get("/weeks", requireRole("TEACHER"), async (req, res) => {
  try {
    const user = (req as any).user;
    const academicYear = (req.query.academicYear as string) || "";

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
    });
    if (!teacherProfile) {
      return res.status(403).json({ success: false, error: "Teacher profile not found" });
    }

    const assignments = await prisma.hifzMarhalaAssignment.findMany({
      where: {
        OR: [{ facultyId: teacherProfile.id }, { musaidId: teacherProfile.id }],
        isActive: true,
        ...(academicYear ? { academicYear } : {}),
      },
      select: { studentId: true },
    });

    const studentIds = assignments.map((a) => a.studentId);
    if (studentIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const slips = await prisma.hifzWeeklySlip.findMany({
      where: {
        studentId: { in: studentIds },
        ...(academicYear ? { academicYear } : {}),
      },
      select: { weekNumber: true },
      distinct: ["weekNumber"],
      orderBy: { weekNumber: "desc" },
    });

    return res.json({ success: true, data: slips.map((s) => s.weekNumber) });
  } catch (error) {
    console.error("Teacher weekly slip weeks error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch slip weeks" });
  }
});

// GET /api/teacher/hifz-weekly-slip - Fetch assigned students & their weekly slips
router.get("/", requireRole("TEACHER"), async (req, res) => {
  try {
    const user = (req as any).user;
    const academicYear = (req.query.academicYear as string) || "";
    const weekNumber = req.query.weekNumber ? parseInt(req.query.weekNumber as string) : 1;
    const marhala = (req.query.marhala as string) || "";

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
    });

    if (!teacherProfile) {
      return res.status(403).json({ success: false, error: "Teacher profile not found" });
    }

    // Get assignments where user is either primary Muhaffiz (facultyId) or Musa'id (musaidId)
    const assignments = await prisma.hifzMarhalaAssignment.findMany({
      where: {
        OR: [
          { facultyId: teacherProfile.id },
          { musaidId: teacherProfile.id },
        ],
        isActive: true,
        ...(academicYear ? { academicYear } : {}),
        ...(marhala && marhala !== "all" ? { marhala: marhala as any } : {}),
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        faculty: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        musaid: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        musaidStudent: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: [{ marhala: "asc" }, { student: { user: { firstName: "asc" } } }],
    });

    const studentIds = assignments.map((a) => a.studentId);

    // Fetch current week's slips
    const currentSlips = await prisma.hifzWeeklySlip.findMany({
      where: {
        studentId: { in: studentIds },
        weekNumber,
        ...(academicYear ? { academicYear } : {}),
      },
      include: {
        faculty: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    // Fetch previous week's slips (weekNumber - 1) for baseline carryover
    const prevSlips = weekNumber > 1 ? await prisma.hifzWeeklySlip.findMany({
      where: {
        studentId: { in: studentIds },
        weekNumber: weekNumber - 1,
        ...(academicYear ? { academicYear } : {}),
      },
    }) : [];

    const prevSlipsMap = new Map(prevSlips.map((s) => [s.studentId, s]));
    const currentSlipsMap = new Map(currentSlips.map((s) => [s.studentId, s]));

    const studentsData = assignments.map((a) => {
      const currentSlip = currentSlipsMap.get(a.studentId);
      const prevSlip = prevSlipsMap.get(a.studentId);

      return {
        assignment: a,
        student: a.student,
        marhala: a.marhala,
        muhaffiz: a.faculty,
        musaid: a.musaid,
        isMusaid: a.musaidId === teacherProfile.id,
        currentSlip: currentSlip || null,
        prevSlip: prevSlip ? {
          currentJuz: prevSlip.currentJuz,
          currentSafah: prevSlip.currentSafah,
          totalMarks: prevSlip.totalMarks,
          overallPerformance: prevSlip.overallPerformance,
          murajaatSabqi: prevSlip.murajaatSabqi,
        } : null,
      };
    });

    return res.json({
      success: true,
      data: {
        students: studentsData,
        teacherProfile: {
          id: teacherProfile.id,
          name: `${user.firstName} ${user.lastName}`,
        },
      },
    });
  } catch (error) {
    console.error("Teacher weekly slips fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch weekly slips" });
  }
});

// POST /api/teacher/hifz-weekly-slip - Create/Update single weekly slip
router.post("/", requireRole("TEACHER"), async (req, res) => {
  try {
    const user = (req as any).user;
    const body = req.body as Record<string, any>;
    const {
      studentId,
      marhala,
      academicYear,
      weekNumber,
      weekStartDate,
      weekEndDate,
      status = "SUBMITTED",
      prevJuz,
      prevSafah,
      prevMurajaatStatus,
      currentJuz,
      currentSafah,
      sabaqLines,
      murajaatSabqi,
      disciplineRating = 5,
      murajaatMarks = 0,
      juzhaliMarks = 0,
      jadeedMarks = 0,
      teacherNotes,
    } = body;

    if (!studentId || !marhala || !academicYear || !weekNumber) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
    });
    if (!teacherProfile) {
      return res.status(403).json({ success: false, error: "Teacher profile not found" });
    }

    const murajaat = Number(murajaatMarks) || 0;
    const juzhali = Number(juzhaliMarks) || 0;
    const jadeed = Number(jadeedMarks) || 0;
    const totalMarks = murajaat + juzhali + jadeed;
    const overallPerformance = totalMarks > 0 ? Math.round((totalMarks / 50) * 100) : 0;

    const slip = await prisma.hifzWeeklySlip.upsert({
      where: {
        studentId_academicYear_weekNumber: {
          studentId,
          academicYear,
          weekNumber: Number(weekNumber),
        },
      },
      create: {
        studentId,
        facultyId: teacherProfile.id,
        marhala,
        academicYear,
        weekNumber: Number(weekNumber),
        weekStartDate: weekStartDate ? new Date(weekStartDate) : null,
        weekEndDate: weekEndDate ? new Date(weekEndDate) : null,
        status: status as any,
        prevJuz: prevJuz !== undefined ? Number(prevJuz) : null,
        prevSafah: prevSafah !== undefined ? Number(prevSafah) : null,
        prevMurajaatStatus: prevMurajaatStatus || null,
        currentJuz: currentJuz !== undefined ? Number(currentJuz) : null,
        currentSafah: currentSafah !== undefined ? Number(currentSafah) : null,
        sabaqLines: sabaqLines !== undefined ? Number(sabaqLines) : null,
        murajaatSabqi: murajaatSabqi || null,
        disciplineRating: Number(disciplineRating) || 5,
        murajaatMarks: murajaat,
        juzhaliMarks: juzhali,
        jadeedMarks: jadeed,
        totalMarks,
        overallPerformance,
        teacherNotes: teacherNotes || null,
        submittedAt: status === "SUBMITTED" ? new Date() : null,
      },
      update: {
        facultyId: teacherProfile.id,
        marhala,
        weekStartDate: weekStartDate ? new Date(weekStartDate) : undefined,
        weekEndDate: weekEndDate ? new Date(weekEndDate) : undefined,
        status: status as any,
        prevJuz: prevJuz !== undefined ? Number(prevJuz) : null,
        prevSafah: prevSafah !== undefined ? Number(prevSafah) : null,
        prevMurajaatStatus: prevMurajaatStatus || null,
        currentJuz: currentJuz !== undefined ? Number(currentJuz) : null,
        currentSafah: currentSafah !== undefined ? Number(currentSafah) : null,
        sabaqLines: sabaqLines !== undefined ? Number(sabaqLines) : null,
        murajaatSabqi: murajaatSabqi || null,
        disciplineRating: Number(disciplineRating) || 5,
        murajaatMarks: murajaat,
        juzhaliMarks: juzhali,
        jadeedMarks: jadeed,
        totalMarks,
        overallPerformance,
        teacherNotes: teacherNotes || null,
        submittedAt: status === "SUBMITTED" ? new Date() : undefined,
      },
      include: {
        student: { include: { user: true } },
        faculty: { include: { user: true } },
      },
    });

    // Joint UX: when teacher SUBMITTED, notify all admins so report appears instantly
    if (status === "SUBMITTED") {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
      const sName = `${slip.student.user.firstName} ${slip.student.user.lastName}`.trim();
      await Promise.all(admins.map((a) =>
        prisma.notification.create({
          data: {
            userId: a.id,
            title: `Weekly Slip Submitted — Week ${weekNumber}`,
            body: `${sName} • ${marhala} • ${totalMarks}/50 (${overallPerformance}%) by ${user.firstName} ${user.lastName}`,
            type: "ALERT",
            link: "/admin/hifz-marhala/weekly-slips",
            priority: "HIGH",
          },
        }).catch(() => {})
      ));
    }

    return res.status(201).json({ success: true, data: slip });
  } catch (error) {
    console.error("Teacher weekly slip save error:", error);
    return res.status(500).json({ success: false, error: "Failed to save weekly slip" });
  }
});

// POST /api/teacher/hifz-weekly-slip/batch - Batch submission for Halaqah Fast Grid
router.post("/batch", requireRole("TEACHER"), async (req, res) => {
  try {
    const user = (req as any).user;
    const body = req.body as { slips: any[]; academicYear: string; weekNumber: number; status?: string };
    const { slips, academicYear, weekNumber, status = "SUBMITTED" } = body;

    if (!Array.isArray(slips) || slips.length === 0 || !academicYear || !weekNumber) {
      return res.status(400).json({ success: false, error: "Missing required fields or slips array" });
    }

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
    });
    if (!teacherProfile) {
      return res.status(403).json({ success: false, error: "Teacher profile not found" });
    }

    const results = await prisma.$transaction(
      slips.map((item) => {
        const murajaat = Number(item.murajaatMarks) || 0;
        const juzhali = Number(item.juzhaliMarks) || 0;
        const jadeed = Number(item.jadeedMarks) || 0;
        const totalMarks = murajaat + juzhali + jadeed;
        const overallPerformance = totalMarks > 0 ? Math.round((totalMarks / 50) * 100) : 0;

        return prisma.hifzWeeklySlip.upsert({
          where: {
            studentId_academicYear_weekNumber: {
              studentId: item.studentId,
              academicYear,
              weekNumber: Number(weekNumber),
            },
          },
          create: {
            studentId: item.studentId,
            facultyId: teacherProfile.id,
            marhala: item.marhala,
            academicYear,
            weekNumber: Number(weekNumber),
            status: status as any,
            currentJuz: item.currentJuz !== undefined ? Number(item.currentJuz) : null,
            currentSafah: item.currentSafah !== undefined ? Number(item.currentSafah) : null,
            sabaqLines: item.sabaqLines !== undefined ? Number(item.sabaqLines) : null,
            murajaatSabqi: item.murajaatSabqi || null,
            disciplineRating: Number(item.disciplineRating) || 5,
            murajaatMarks: murajaat,
            juzhaliMarks: juzhali,
            jadeedMarks: jadeed,
            totalMarks,
            overallPerformance,
            teacherNotes: item.teacherNotes || null,
            submittedAt: status === "SUBMITTED" ? new Date() : null,
          },
          update: {
            facultyId: teacherProfile.id,
            marhala: item.marhala,
            status: status as any,
            currentJuz: item.currentJuz !== undefined ? Number(item.currentJuz) : null,
            currentSafah: item.currentSafah !== undefined ? Number(item.currentSafah) : null,
            sabaqLines: item.sabaqLines !== undefined ? Number(item.sabaqLines) : null,
            murajaatSabqi: item.murajaatSabqi || null,
            disciplineRating: Number(item.disciplineRating) || 5,
            murajaatMarks: murajaat,
            juzhaliMarks: juzhali,
            jadeedMarks: jadeed,
            totalMarks,
            overallPerformance,
            teacherNotes: item.teacherNotes || null,
            submittedAt: status === "SUBMITTED" ? new Date() : undefined,
          },
        });
      })
    );

    if (status === "SUBMITTED") {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
      await Promise.all(admins.map((a) =>
        prisma.notification.create({
          data: {
            userId: a.id,
            title: `Weekly Slips Batch — Week ${weekNumber}`,
            body: `${results.length} slips submitted by ${user.firstName} ${user.lastName} — ready for admin review & teacher assignment`,
            type: "ALERT",
            link: "/admin/hifz-marhala/weekly-slips",
            priority: "HIGH",
          },
        }).catch(() => {})
      ));
    }

    return res.json({ success: true, count: results.length });
  } catch (error) {
    console.error("Batch weekly slip error:", error);
    return res.status(500).json({ success: false, error: "Failed to batch save weekly slips" });
  }
});

export default router;
