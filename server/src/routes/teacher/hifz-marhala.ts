
import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/teacher/hifz-marhala - Fetch assigned students and their reports for teacher (muhaffiz OR musaid)
router.get("/", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const academicYear = (req.query.academicYear as string) || "";

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const assignmentWhere: any = {
      OR: [{ facultyId: teacherProfile.id }, { musaidId: teacherProfile.id }],
      isActive: true,
      ...(academicYear ? { academicYear } : {}),
    };

    const assignments = await prisma.hifzMarhalaAssignment.findMany({
      where: assignmentWhere,
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } } } },
        faculty: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        musaid: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
        musaidStudent: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
      },
      orderBy: [{ marhala: "asc" }, { student: { user: { firstName: "asc" } } }],
    });

    const studentIds = assignments.map((a) => a.studentId);
    const [reports, students] = await Promise.all([
      studentIds.length > 0
        ? prisma.hifzMarhalaReport.findMany({
            where: {
              studentId: { in: studentIds },
              ...(academicYear ? { academicYear } : {}),
            },
            include: {
              student: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
              faculty: { include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } } },
            },
            orderBy: [{ marhala: "asc" }, { student: { user: { firstName: "asc" } } }],
          })
        : Promise.resolve([] as any[]),
      prisma.studentProfile.findMany({
        where: { user: { isActive: true } },
        select: { id: true, studentId: true, its: true, grade: true, section: true, user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
        orderBy: { user: { firstName: "asc" } },
      }),
    ]);

    // Annotate each assignment with role hint for frontend (muhaffiz OR musaid-teacher)
    const enriched = assignments.map((a: any) => ({
      ...a,
      isMusaid: a.musaidId === teacherProfile.id,
      isMuhaffiz: a.facultyId === teacherProfile.id,
    }));

    return res.json({ success: true, data: { assignments: enriched, reports, students } });
  } catch (error) {
    console.error("Teacher Hifz Marhala fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch hifz marhala data" });
  }
});

// POST /api/teacher/hifz-marhala/report - Create or update report for a student (teacher)
router.post("/report", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as Record<string, any>;
    const { studentId, marhala, academicYear, ...data } = body;

    if (!studentId || !marhala || !academicYear) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    // Verify this teacher is assigned to this student for this marhala (muhaffiz OR musaid)
    const assignment = await prisma.hifzMarhalaAssignment.findFirst({
      where: {
        studentId,
        marhala,
        academicYear,
        isActive: true,
        OR: [{ facultyId: teacherProfile.id }, { musaidId: teacherProfile.id }],
      },
    });
    if (!assignment) {
      return res.status(403).json({ success: false, error: "Not assigned to this student for this marhala" });
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      include: { user: true },
    });
    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    const totalMarks = (Number(data.murajaatMarks) || 0) + (Number(data.juzhaliMarks) || 0) + (Number(data.jadeedMarks) || 0);
    const overallPerformance = totalMarks > 0 ? Math.round((totalMarks / 50) * 100) : 0;

    const report = await prisma.hifzMarhalaReport.upsert({
      where: { studentId_academicYear_marhala: { studentId, academicYear, marhala } },
      create: {
        studentId,
        facultyId: teacherProfile.id,
        marhala,
        academicYear,
        source: "FACULTY_ASSIGNED",
        status: "SUBMITTED",
        its: data.its || student.its,
        name: data.name || `${student.user.firstName} ${student.user.lastName}`,
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
        its: data.its || student.its,
        name: data.name || `${student.user.firstName} ${student.user.lastName}`,
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
    console.error("Teacher Hifz Marhala report create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create report" });
  }
});

// PUT /api/teacher/hifz-marhala/report - Update report (teacher)
router.put("/report", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as Record<string, any>;
    const { id, ...data } = body;

    if (!id) return res.status(400).json({ success: false, error: "Report ID required" });

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const existing = await prisma.hifzMarhalaReport.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }
    // Allow update if teacher is the original author OR is musaid/muhaffiz for that student
    if (existing.facultyId !== teacherProfile.id) {
      const allowed = await prisma.hifzMarhalaAssignment.findFirst({
        where: {
          studentId: existing.studentId,
          marhala: existing.marhala,
          academicYear: existing.academicYear,
          isActive: true,
          OR: [{ facultyId: teacherProfile.id }, { musaidId: teacherProfile.id }],
        },
      });
      if (!allowed) {
        return res.status(403).json({ success: false, error: "Not authorized to update this report" });
      }
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
    console.error("Teacher Hifz Marhala report update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update report" });
  }
});

// GET /api/teacher/hifz-marhala/report/:id - Get single report
router.get("/report/:id", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const report = await prisma.hifzMarhalaReport.findUnique({
      where: { id: req.params.id },
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        faculty: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });

    if (!report) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }
    if (report.facultyId !== teacherProfile.id) {
      const allowed = await prisma.hifzMarhalaAssignment.findFirst({
        where: {
          studentId: report.studentId,
          marhala: report.marhala,
          academicYear: report.academicYear,
          isActive: true,
          OR: [{ facultyId: teacherProfile.id }, { musaidId: teacherProfile.id }],
        },
      });
      if (!allowed) {
        return res.status(404).json({ success: false, error: "Report not found" });
      }
    }

    return res.json({ success: true, data: report });
  } catch (error) {
    console.error("Teacher Hifz Marhala report fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch report" });
  }
});

export default router;