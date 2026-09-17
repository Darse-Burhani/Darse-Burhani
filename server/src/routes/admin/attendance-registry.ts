import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { normalizeDateToUTC } from "../../lib/leave-service";
import { AttendanceStatus, AttendanceSource } from "@prisma/client";

const router = Router();

// GET /api/admin/attendance-registry — Consolidated daily stacked view
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const rawDate = req.query.date ? new Date(req.query.date as string) : new Date();
    const dayStart = normalizeDateToUTC(rawDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const { grade, section, status, source, search } = req.query;

    const studentWhere: any = {
      user: { isActive: true },
    };

    if (grade && typeof grade === "string") {
      studentWhere.grade = grade;
    }

    if (section && typeof section === "string") {
      studentWhere.section = section;
    }

    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      studentWhere.OR = [
        { user: { firstName: { contains: q, mode: "insensitive" } } },
        { user: { lastName: { contains: q, mode: "insensitive" } } },
        { studentId: { contains: q, mode: "insensitive" } },
        { its: { contains: q, mode: "insensitive" } },
      ];
    }

    // 1. Fetch all matching active students
    const students = await prisma.studentProfile.findMany({
      where: studentWhere,
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
        classEnrollments: {
          where: { isActive: true },
          include: { class: { select: { id: true, name: true, grade: true, section: true } } },
          take: 1,
        },
        attendanceRegistries: {
          where: { date: dayStart },
          include: { leave: true },
          take: 1,
        },
        attendanceRecords: {
          where: { date: { gte: dayStart, lt: dayEnd } },
          include: { class: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
    });

    // 2. Map and aggregate records
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let medicalCount = 0;
    let leaveCount = 0;
    let notMarkedCount = 0;

    let biometricSourceCount = 0;
    let manualSourceCount = 0;
    let autoAbsentSourceCount = 0;
    let medicalLeaveSourceCount = 0;
    let leaveApprovedSourceCount = 0;

    const mappedRows = students.map((s) => {
      const registry = s.attendanceRegistries[0];
      const record = s.attendanceRecords[0];

      let effectiveStatus: string = "NOT_MARKED";
      let effectiveSource: string = "BIOMETRIC";
      let checkInTime: string | null = null;
      let checkOutTime: string | null = null;
      let remarks: string | null = null;
      let leaveDetails: any = null;

      if (registry) {
        effectiveStatus = registry.status;
        effectiveSource = registry.source;
        checkInTime = registry.checkInTime?.toISOString() || null;
        checkOutTime = registry.checkOutTime?.toISOString() || null;
        remarks = registry.remarks;
        if (registry.leave) {
          leaveDetails = {
            id: registry.leave.id,
            type: registry.leave.type,
            reason: registry.leave.reason,
            startDate: registry.leave.startDate.toISOString(),
            endDate: registry.leave.endDate.toISOString(),
            attachmentUrl: registry.leave.attachmentUrl,
          };
        }
      } else if (record) {
        effectiveStatus = record.status;
        effectiveSource = record.source || (record.verificationMethod === "AUTO_SYSTEM" ? "AUTO_ABSENT" : "BIOMETRIC");
        checkInTime = record.checkInTime?.toISOString() || null;
        checkOutTime = record.checkOutTime?.toISOString() || null;
        remarks = record.justification;
      }

      // Aggregate counters
      if (effectiveStatus === "PRESENT") presentCount++;
      else if (effectiveStatus === "LATE") lateCount++;
      else if (effectiveStatus === "ABSENT") absentCount++;
      else if (effectiveStatus === "MEDICAL") medicalCount++;
      else if (effectiveStatus === "ON_LEAVE") leaveCount++;
      else notMarkedCount++;

      if (effectiveSource === "BIOMETRIC") biometricSourceCount++;
      else if (effectiveSource === "MANUAL") manualSourceCount++;
      else if (effectiveSource === "AUTO_ABSENT") autoAbsentSourceCount++;
      else if (effectiveSource === "MEDICAL_LEAVE") medicalLeaveSourceCount++;
      else if (effectiveSource === "LEAVE_APPROVED") leaveApprovedSourceCount++;

      return {
        id: registry?.id || `virtual-${s.id}`,
        studentId: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`.trim(),
        avatarUrl: s.user.avatarUrl,
        its: s.its || s.studentId,
        grade: s.grade,
        section: s.section,
        className: s.classEnrollments[0]?.class?.name || `Grade ${s.grade}-${s.section}`,
        status: effectiveStatus,
        source: effectiveSource,
        checkInTime,
        checkOutTime,
        remarks,
        leave: leaveDetails,
        biometricMethod: record?.biometricMethod || null,
        streakDays: s.streakDays,
      };
    });

    // Apply filtering on status/source if query params passed
    let filteredRows = mappedRows;
    if (status && typeof status === "string") {
      filteredRows = filteredRows.filter((r) => r.status === status);
    }
    if (source && typeof source === "string") {
      filteredRows = filteredRows.filter((r) => r.source === source);
    }

    // Get available distinct grades/sections for filter dropdowns
    const distinctGrades = Array.from(new Set(students.map((s) => s.grade))).sort();
    const distinctSections = Array.from(new Set(students.map((s) => s.section))).sort();

    return res.json({
      success: true,
      data: {
        date: dayStart.toISOString(),
        summary: {
          total: students.length,
          present: presentCount,
          late: lateCount,
          absent: absentCount,
          medical: medicalCount,
          onLeave: leaveCount,
          notMarked: notMarkedCount,
          sources: {
            biometric: biometricSourceCount,
            manual: manualSourceCount,
            autoAbsent: autoAbsentSourceCount,
            medicalLeave: medicalLeaveSourceCount,
            leaveApproved: leaveApprovedSourceCount,
          },
        },
        filters: {
          grades: distinctGrades,
          sections: distinctSections,
        },
        records: filteredRows,
      },
    });
  } catch (error) {
    console.error("[admin-attendance-registry] GET error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch attendance registry" });
  }
});

// GET /api/admin/attendance-registry/export — CSV Export
router.get("/export", requireRole("ADMIN"), async (req, res) => {
  try {
    const rawStart = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const rawEnd = req.query.endDate ? new Date(req.query.endDate as string) : rawStart;

    const start = normalizeDateToUTC(rawStart);
    const end = normalizeDateToUTC(rawEnd);

    const { grade, section } = req.query;

    const studentWhere: any = { user: { isActive: true } };
    if (grade) studentWhere.grade = grade as string;
    if (section) studentWhere.section = section as string;

    const students = await prisma.studentProfile.findMany({
      where: studentWhere,
      include: {
        user: { select: { firstName: true, lastName: true } },
        attendanceRegistries: {
          where: { date: { gte: start, lte: end } },
          orderBy: { date: "asc" },
        },
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
    });

    const rows: string[] = [];
    rows.push("Student Name,ITS / ID,Grade,Section,Date,Status,Source,Remarks");

    for (const s of students) {
      for (const reg of s.attendanceRegistries) {
        const d = reg.date.toISOString().slice(0, 10);
        const name = `"${s.user.firstName} ${s.user.lastName}"`;
        const its = s.its || s.studentId;
        const remarks = reg.remarks ? `"${reg.remarks.replace(/"/g, '""')}"` : "";
        rows.push(`${name},${its},${s.grade},${s.section},${d},${reg.status},${reg.source},${remarks}`);
      }
    }

    const csv = rows.join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-registry-${start.toISOString().slice(0, 10)}.csv"`
    );
    return res.send(csv);
  } catch (error) {
    console.error("[admin-attendance-registry] Export error:", error);
    return res.status(500).json({ success: false, error: "Failed to export attendance registry" });
  }
});

// POST /api/admin/attendance-registry/override — Manual override
router.post("/override", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { studentId, date, status, source, remarks } = req.body;

    if (!studentId || !date || !status) {
      return res.status(400).json({ success: false, error: "studentId, date, and status are required" });
    }

    const targetDate = normalizeDateToUTC(date);
    const validStatus = Object.values(AttendanceStatus).includes(status);
    const validSource = source ? Object.values(AttendanceSource).includes(source) : true;

    if (!validStatus) {
      return res.status(400).json({ success: false, error: "Invalid attendance status" });
    }

    const effectiveSource: AttendanceSource = validSource && source ? source : AttendanceSource.MANUAL;

    const updated = await prisma.attendanceRegistry.upsert({
      where: {
        studentId_date: {
          studentId,
          date: targetDate,
        },
      },
      create: {
        studentId,
        date: targetDate,
        status: status as AttendanceStatus,
        source: effectiveSource,
        remarks: remarks || `Manual override by Admin (${session.user.firstName})`,
        recordedById: session.user.id,
      },
      update: {
        status: status as AttendanceStatus,
        source: effectiveSource,
        remarks: remarks || `Manual override by Admin (${session.user.firstName})`,
        recordedById: session.user.id,
      },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("[admin-attendance-registry] Override error:", error);
    return res.status(500).json({ success: false, error: "Failed to override attendance registry record" });
  }
});

// GET /api/admin/attendance-registry/student/:studentId — Student audit timeline
router.get("/student/:studentId", requireRole("ADMIN"), async (req, res) => {
  try {
    const student = await prisma.studentProfile.findUnique({
      where: { id: req.params.studentId },
      include: {
        user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
        attendanceRegistries: {
          take: 30,
          orderBy: { date: "desc" },
          include: { leave: true },
        },
        leaveRequests: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!student) {
      return res.status(404).json({ success: false, error: "Student not found" });
    }

    return res.json({
      success: true,
      data: {
        student: {
          id: student.id,
          name: `${student.user.firstName} ${student.user.lastName}`.trim(),
          avatarUrl: student.user.avatarUrl,
          its: student.its || student.studentId,
          grade: student.grade,
          section: student.section,
          streakDays: student.streakDays,
        },
        registries: student.attendanceRegistries.map((r) => ({
          id: r.id,
          date: r.date.toISOString(),
          status: r.status,
          source: r.source,
          checkInTime: r.checkInTime?.toISOString() || null,
          checkOutTime: r.checkOutTime?.toISOString() || null,
          remarks: r.remarks,
          leave: r.leave
            ? {
                id: r.leave.id,
                type: r.leave.type,
                reason: r.leave.reason,
                status: r.leave.status,
              }
            : null,
        })),
        recentLeaves: student.leaveRequests.map((l) => ({
          id: l.id,
          type: l.type,
          startDate: l.startDate.toISOString(),
          endDate: l.endDate.toISOString(),
          reason: l.reason,
          status: l.status,
          createdAt: l.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    console.error("[admin-attendance-registry] Student audit history error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch student audit history" });
  }
});

export default router;
