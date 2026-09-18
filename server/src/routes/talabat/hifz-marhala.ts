
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/talabat/hifz-marhala - Fetch my marhala assignment and reports
router.get("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const academicYear = (req.query.academicYear as string) || "";

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const [assignment, reports] = await Promise.all([
      prisma.hifzMarhalaAssignment.findFirst({
        where: { studentId: studentProfile.id, isActive: true, ...(academicYear ? { academicYear } : {}) },
        include: {
          faculty: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
          musaid: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        },
      }),
      prisma.hifzMarhalaReport.findMany({
        where: { studentId: studentProfile.id, ...(academicYear ? { academicYear } : {}) },
        include: {
          faculty: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        },
        orderBy: { marhala: "asc" },
      }),
    ]);

    return res.json({ success: true, data: { assignment, reports } });
  } catch (error) {
    console.error("Talabat Hifz Marhala fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch hifz marhala data" });
  }
});

// POST /api/talabat/hifz-marhala/report - Submit or update my self-report
router.post("/report", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as Record<string, any>;
    const { marhala, academicYear, ...data } = body;

    if (!marhala || !academicYear) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      include: { user: true },
    });
    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    // Verify assignment exists for this marhala
    const assignment = await prisma.hifzMarhalaAssignment.findFirst({
      where: {
        studentId: studentProfile.id,
        marhala: marhala as any,
        academicYear,
      },
    });
    if (!assignment) {
      return res.status(403).json({ success: false, error: "Not assigned to this marhala" });
    }

    if (!assignment.facultyId) {
      return res.status(400).json({ success: false, error: "No faculty assigned for this marhala" });
    }

    const totalMarks = (Number(data.murajaatMarks) || 0) + (Number(data.juzhaliMarks) || 0) + (Number(data.jadeedMarks) || 0);
    const overallPerformance = totalMarks > 0 ? Math.round((totalMarks / 50) * 100) : 0;

    const report = await prisma.hifzMarhalaReport.upsert({
      where: { studentId_academicYear_marhala: { studentId: studentProfile.id, academicYear, marhala } },
      create: {
        studentId: studentProfile.id,
        facultyId: assignment.facultyId,
        marhala,
        academicYear,
        source: "TALABAT_SELF",
        status: "SUBMITTED",
        its: studentProfile.its,
        name: `${studentProfile.user.firstName} ${studentProfile.user.lastName}`,
        currentJuz: data.currentJuz,
        currentSafah: data.currentSafah,
        totalJadeedPages: data.totalJadeedPages,
        ajzaMatruka: data.ajzaMatruka,
        weakAjza: data.weakAjza,
        murajaatMarks: data.murajaatMarks,
        juzhaliMarks: data.juzhaliMarks,
        jadeedMarks: data.jadeedMarks,
        totalMarks,
        overallPerformance,
        notes: data.notes,
        submittedAt: new Date(),
      },
      update: {
        currentJuz: data.currentJuz,
        currentSafah: data.currentSafah,
        totalJadeedPages: data.totalJadeedPages,
        ajzaMatruka: data.ajzaMatruka,
        weakAjza: data.weakAjza,
        murajaatMarks: data.murajaatMarks,
        juzhaliMarks: data.juzhaliMarks,
        jadeedMarks: data.jadeedMarks,
        totalMarks,
        overallPerformance,
        notes: data.notes,
        status: "SUBMITTED",
        submittedAt: new Date(),
      },
    });

    return res.status(201).json({ success: true, data: report });
  } catch (error) {
    console.error("Talabat Hifz Marhala report create error:", error);
    return res.status(500).json({ success: false, error: "Failed to submit report" });
  }
});

// PUT /api/talabat/hifz-marhala/report - Update my self-report
router.put("/report", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as Record<string, any>;
    const { id, ...data } = body;

    if (!id) return res.status(400).json({ success: false, error: "Report ID required" });

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const existing = await prisma.hifzMarhalaReport.findUnique({ where: { id } });
    if (!existing || existing.studentId !== studentProfile.id) {
      return res.status(403).json({ success: false, error: "Not authorized to update this report" });
    }

    // Only allow updates if report is still in DRAFT or SUBMITTED by self
    if (existing.source !== "TALABAT_SELF" || (existing.status !== "DRAFT" && existing.status !== "SUBMITTED")) {
      return res.status(400).json({ success: false, error: "Cannot update this report" });
    }

    const updateData: Record<string, any> = { ...data };

    // Recalculate totals if marks changed
    if (data.murajaatMarks !== undefined || data.juzhaliMarks !== undefined || data.jadeedMarks !== undefined) {
      const murajaat = Number(data.murajaatMarks ?? existing.murajaatMarks ?? 0) || 0;
      const juzhali = Number(data.juzhaliMarks ?? existing.juzhaliMarks ?? 0) || 0;
      const jadeed = Number(data.jadeedMarks ?? existing.jadeedMarks ?? 0) || 0;
      const total = murajaat + juzhali + jadeed;
      updateData.totalMarks = total;
      updateData.overallPerformance = total > 0 ? Math.round((total / 50) * 100) : 0;
    }

    const updated = await prisma.hifzMarhalaReport.update({
      where: { id },
      data: updateData,
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("Talabat Hifz Marhala report update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update report" });
  }
});

// GET /api/talabat/hifz-marhala/weekly-slips - Fetch my published weekly slips
router.get("/weekly-slips", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const slips = await prisma.hifzWeeklySlip.findMany({
      where: {
        studentId: studentProfile.id,
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
    console.error("Talabat weekly slips fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch weekly slips" });
  }
});

// GET /api/talabat/hifz-marhala/report/:id - Get my single report
router.get("/report/:id", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const report = await prisma.hifzMarhalaReport.findUnique({
      where: { id: req.params.id },
      include: {
        faculty: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!report || report.studentId !== studentProfile.id) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }

    return res.json({ success: true, data: report });
  } catch (error) {
    console.error("Talabat Hifz Marhala report fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch report" });
  }
});

export default router;