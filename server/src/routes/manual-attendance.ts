import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware";

import { AttendanceStatus, AttendanceSource } from "@prisma/client";

const router = Router();

function parseDate(dateStr?: string): Date {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// GET /api/attendance/manual/schedules - List available schedule types and options
router.get("/schedules", requireAuth, async (req, res) => {
  try {
    const [windows, classes] = await Promise.all([
      prisma.biometricScanWindow.findMany({
        orderBy: { startTime: "asc" },
      }),
      prisma.class.findMany({
        where: { isActive: true },
        include: {
          teacher: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
          _count: { select: { enrollments: true } },
        },
        orderBy: [{ grade: "asc" }, { section: "asc" }, { name: "asc" }],
      }),
    ]);

    const studentWindows = windows.map((w) => ({
      id: w.id,
      name: w.name,
      startTime: w.startTime,
      endTime: w.endTime,
      lateEndTime: w.lateEndTime || w.endTime,
      type: "STUDENT_WINDOW",
      enabled: w.enabled,
    }));

    const facultyWindows = windows
      .filter((w) => Boolean((w as any).facultyStartTime || w.applicableTeacherIds?.length > 0 || /faculty|teacher|staff/i.test(w.name)))
      .map((w) => ({
        id: w.id,
        name: `${w.name} (Faculty)`,
        startTime: (w as any).facultyStartTime || w.startTime,
        endTime: (w as any).facultyEndTime || w.endTime,
        lateEndTime: (w as any).facultyLateEndTime || w.endTime,
        type: "FACULTY_WINDOW",
        applicableTeacherIds: w.applicableTeacherIds || [],
        enabled: (w as any).facultyEnabled ?? w.enabled,
      }));

    return res.json({
      success: true,
      data: {
        scheduleTypes: [
          { id: "WINDOW", label: "Student Scan Window (School-Wide)", description: "School-wide student scan windows (Tilawat al Dua, Maghrib, etc.)" },
          { id: "FACULTY_WINDOW", label: "Faculty Scan Window", description: "Teacher & staff morning/afternoon duty shifts" },
          { id: "CLASS_PERIOD", label: "Class & Period Timetable", description: "Class-wise attendance for specific subjects & periods" },
          { id: "DAILY_REGISTRY", label: "Daily School Registry", description: "Master school-wide calendar day attendance" },
        ],
        studentWindows,
        facultyWindows,
        classes: classes.map((c) => ({
          id: c.id,
          name: c.name,
          grade: c.grade,
          section: c.section,
          subject: c.subject,
          teacherName: `${c.teacher?.user?.firstName || ""} ${c.teacher?.user?.lastName || ""}`.trim(),
          studentCount: c._count.enrollments,
        })),
      },
    });
  } catch (error) {
    console.error("Fetch manual attendance schedules error:", error);
    return res.status(500).json({ success: false, error: "Failed to load schedule options" });
  }
});

// GET /api/attendance/manual/roster - Load candidate roster and current status for any schedule & date
router.get("/roster", requireAuth, async (req, res) => {
  try {
    const { scheduleType = "DAILY_REGISTRY", scheduleId, classId, date, grade, section, search } = req.query as Record<string, string>;
    const targetDate = parseDate(date);
    const dayEnd = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    // ── 1. FACULTY WINDOW ──
    if (scheduleType === "FACULTY_WINDOW") {
      let teacherWhere: any = { user: { isActive: true } };

      if (scheduleId) {
        const window = await prisma.biometricScanWindow.findUnique({ where: { id: scheduleId } });
        if (window) {
          if (window.applicableTeacherIds && window.applicableTeacherIds.length > 0) {
            teacherWhere.id = { in: window.applicableTeacherIds };
          }
          const exempt = (window as any).exemptTeacherIds || [];
          if (exempt.length > 0) {
            teacherWhere.id = { ...(teacherWhere.id || {}), notIn: exempt };
          }
        }
      }

      if (search && search.trim()) {
        const q = search.trim();
        teacherWhere.OR = [
          { user: { firstName: { contains: q, mode: "insensitive" } } },
          { user: { lastName: { contains: q, mode: "insensitive" } } },
          { employeeId: { contains: q, mode: "insensitive" } },
        ];
      }

      const [teachers, records] = await Promise.all([
        prisma.teacherProfile.findMany({
          where: teacherWhere,
          include: { user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } } },
          orderBy: [{ employeeId: "asc" }],
        }),
        prisma.teacherAttendanceRecord.findMany({
          where: { date: { gte: targetDate, lt: dayEnd } },
        }),
      ]);

      const recordMap = new Map<string, (typeof records)[0]>();
      for (const r of records) recordMap.set(r.teacherId, r);

      const roster = teachers.map((t) => {
        const r = recordMap.get(t.id);
        return {
          id: t.id,
          profileId: t.id,
          name: `${t.user.firstName} ${t.user.lastName}`.trim(),
          email: t.user.email,
          identifier: t.employeeId,
          department: t.department || t.roleTitle || "Faculty",
          avatarUrl: t.photoUrl || t.user.avatarUrl,
          targetType: "TEACHER",
          status: r?.status || "NOT_MARKED",
          source: r?.verificationMethod || "MANUAL",
          checkInTime: r?.checkInTime ? new Date(r.checkInTime).toISOString() : null,
          checkOutTime: r?.checkOutTime ? new Date(r.checkOutTime).toISOString() : null,
          remarks: r?.notes || null,
        };
      });

      return res.json({ success: true, data: { roster, totalCount: roster.length, date: targetDate.toISOString() } });
    }

    // ── 2. CLASS PERIOD TIMETABLE ──
    if (scheduleType === "CLASS_PERIOD") {
      if (!classId) {
        return res.status(400).json({ success: false, error: "classId is required for class period attendance" });
      }

      const [enrollments, records] = await Promise.all([
        prisma.classEnrollment.findMany({
          where: { classId, isActive: true },
          include: {
            student: {
              include: { user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } } },
            },
          },
          orderBy: [{ student: { grade: "asc" } }, { student: { user: { firstName: "asc" } } }],
        }),
        prisma.attendanceRecord.findMany({
          where: { classId, date: { gte: targetDate, lt: dayEnd } },
        }),
      ]);

      const recordMap = new Map<string, (typeof records)[0]>();
      for (const r of records) recordMap.set(r.studentId, r);

      const roster = enrollments.map((e) => {
        const s = e.student;
        const r = recordMap.get(s.id);
        return {
          id: s.id,
          profileId: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`.trim(),
          email: s.user.email,
          identifier: s.studentId,
          its: s.its || s.studentId,
          grade: s.grade,
          section: s.section,
          avatarUrl: s.user.avatarUrl,
          targetType: "STUDENT",
          status: r?.status || "NOT_MARKED",
          source: r?.source || "MANUAL",
          checkInTime: r?.checkInTime ? new Date(r.checkInTime).toISOString() : null,
          checkOutTime: r?.checkOutTime ? new Date(r.checkOutTime).toISOString() : null,
          remarks: r?.justification || null,
        };
      });

      return res.json({ success: true, data: { roster, totalCount: roster.length, date: targetDate.toISOString() } });
    }

    // ── 3. STUDENT SCAN WINDOW OR DAILY REGISTRY ──
    const studentWhere: any = { user: { isActive: true } };
    if (grade && grade !== "ALL") studentWhere.grade = grade;
    if (section && section !== "ALL") studentWhere.section = section;
    if (search && search.trim()) {
      const q = search.trim();
      studentWhere.OR = [
        { user: { firstName: { contains: q, mode: "insensitive" } } },
        { user: { lastName: { contains: q, mode: "insensitive" } } },
        { studentId: { contains: q, mode: "insensitive" } },
        { its: { contains: q, mode: "insensitive" } },
      ];
    }

    const [students, registries, records] = await Promise.all([
      prisma.studentProfile.findMany({
        where: studentWhere,
        include: { user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } } },
        orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
      }),
      prisma.attendanceRegistry.findMany({
        where: { date: targetDate },
      }),
      prisma.attendanceRecord.findMany({
        where: { date: { gte: targetDate, lt: dayEnd } },
      }),
    ]);

    const regMap = new Map<string, (typeof registries)[0]>();
    for (const reg of registries) regMap.set(reg.studentId, reg);

    const recMap = new Map<string, (typeof records)[0]>();
    for (const rec of records) {
      if (!recMap.has(rec.studentId)) recMap.set(rec.studentId, rec);
    }

    const roster = students.map((s) => {
      const reg = regMap.get(s.id);
      const rec = recMap.get(s.id);
      const status = reg?.status || rec?.status || "NOT_MARKED";
      const source = reg?.source || rec?.source || "MANUAL";
      const checkInTime = reg?.checkInTime || rec?.checkInTime || null;
      const checkOutTime = reg?.checkOutTime || rec?.checkOutTime || null;
      const remarks = reg?.remarks || rec?.justification || null;

      return {
        id: s.id,
        profileId: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`.trim(),
        email: s.user.email,
        identifier: s.studentId,
        its: s.its || s.studentId,
        grade: s.grade,
        section: s.section,
        avatarUrl: s.user.avatarUrl,
        targetType: "STUDENT",
        status,
        source,
        checkInTime: checkInTime ? new Date(checkInTime).toISOString() : null,
        checkOutTime: checkOutTime ? new Date(checkOutTime).toISOString() : null,
        remarks,
      };
    });

    return res.json({
      success: true,
      data: { roster, totalCount: roster.length, date: targetDate.toISOString() },
    });
  } catch (error) {
    console.error("Fetch manual roster error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch candidate roster" });
  }
});

// POST /api/attendance/manual - Record manual attendance entries for any schedule type
router.post("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as {
      scheduleType: "WINDOW" | "FACULTY_WINDOW" | "CLASS_PERIOD" | "DAILY_REGISTRY";
      scheduleId?: string;
      classId?: string;
      date: string;
      targetType: "STUDENT" | "TEACHER";
      records: Array<{
        id: string; // studentId or teacherId
        status: AttendanceStatus;
        checkInTime?: string | null;
        checkOutTime?: string | null;
        remarks?: string | null;
      }>;
    };

    const { scheduleType = "DAILY_REGISTRY", scheduleId, classId, date, targetType = "STUDENT", records } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: "records array cannot be empty" });
    }

    const targetDate = parseDate(date);
    const validStatuses = Object.values(AttendanceStatus);
    const actorName = `${session.user.firstName || ""} ${session.user.lastName || ""}`.trim() || session.user.email;

    let updatedCount = 0;

    // ── A. TEACHER / FACULTY MANUAL ATTENDANCE ──
    if (targetType === "TEACHER" || scheduleType === "FACULTY_WINDOW") {
      for (const item of records) {
        if (!item.id || !validStatuses.includes(item.status)) continue;

        const checkIn = item.checkInTime ? new Date(item.checkInTime) : item.status === "PRESENT" ? new Date() : null;
        const checkOut = item.checkOutTime ? new Date(item.checkOutTime) : null;
        const note = item.remarks ? item.remarks.trim() : `Manual mark by ${actorName}`;

        const existing = await prisma.teacherAttendanceRecord.findUnique({
          where: { teacherId_date: { teacherId: item.id, date: targetDate } },
        });

        await prisma.teacherAttendanceRecord.upsert({
          where: { teacherId_date: { teacherId: item.id, date: targetDate } },
          create: {
            teacherId: item.id,
            date: targetDate,
            status: item.status,
            checkInTime: checkIn,
            checkOutTime: checkOut,
            verificationMethod: "MANUAL",
            notes: note,
          },
          update: {
            status: item.status,
            checkInTime: checkIn,
            checkOutTime: checkOut,
            verificationMethod: "MANUAL",
            notes: note,
          },
        });

        // Audit Trail Log
        await prisma.attendanceAuditLog.create({
          data: {
            date: targetDate,
            entityType: "TEACHER_RECORD",
            entityId: item.id,
            teacherId: item.id,
            action: existing ? "OVERRIDE" : "CREATE",
            oldStatus: existing?.status || null,
            newStatus: item.status,
            oldSource: existing?.verificationMethod || null,
            newSource: "MANUAL",
            actorId: session.user.id,
            actorName,
            actorRole: session.user.role,
            reason: note,
          },
        }).catch(() => {});

        updatedCount++;
      }

      return res.json({
        success: true,
        message: `Successfully marked manual attendance for ${updatedCount} faculty member(s).`,
        data: { updatedCount },
      });
    }

    // ── B. CLASS PERIOD TIMETABLE ATTENDANCE ──
    if (scheduleType === "CLASS_PERIOD" && classId) {
      for (const item of records) {
        if (!item.id || !validStatuses.includes(item.status)) continue;

        const checkIn = item.checkInTime ? new Date(item.checkInTime) : item.status === "PRESENT" ? new Date() : null;
        const checkOut = item.checkOutTime ? new Date(item.checkOutTime) : null;
        const note = item.remarks ? item.remarks.trim() : `Manual entry by ${actorName}`;

        const existing = await prisma.attendanceRecord.findUnique({
          where: { studentId_classId_date: { studentId: item.id, classId, date: targetDate } },
        });

        await prisma.attendanceRecord.upsert({
          where: { studentId_classId_date: { studentId: item.id, classId, date: targetDate } },
          create: {
            studentId: item.id,
            classId,
            date: targetDate,
            status: item.status,
            source: AttendanceSource.MANUAL,
            checkInTime: checkIn,
            checkOutTime: checkOut,
            justification: note,
            recordedById: session.user.id,
          },
          update: {
            status: item.status,
            source: AttendanceSource.MANUAL,
            checkInTime: checkIn,
            checkOutTime: checkOut,
            justification: note,
            recordedById: session.user.id,
          },
        });

        // Audit log
        await prisma.attendanceAuditLog.create({
          data: {
            date: targetDate,
            entityType: "STUDENT_RECORD",
            entityId: item.id,
            studentId: item.id,
            action: existing ? "OVERRIDE" : "CREATE",
            oldStatus: existing?.status || null,
            newStatus: item.status,
            oldSource: existing?.source || null,
            newSource: "MANUAL",
            actorId: session.user.id,
            actorName,
            actorRole: session.user.role,
            reason: `Class Period: ${note}`,
          },
        }).catch(() => {});

        updatedCount++;
      }

      return res.json({
        success: true,
        message: `Successfully marked manual attendance for ${updatedCount} student(s) in class.`,
        data: { updatedCount },
      });
    }

    // ── C. STUDENT SCAN WINDOW OR DAILY REGISTRY ──
    for (const item of records) {
      if (!item.id || !validStatuses.includes(item.status)) continue;

      const checkIn = item.checkInTime ? new Date(item.checkInTime) : item.status === "PRESENT" ? new Date() : null;
      const checkOut = item.checkOutTime ? new Date(item.checkOutTime) : null;
      const note = item.remarks ? item.remarks.trim() : `Manual mark (${scheduleType}) by ${actorName}`;

      const existingReg = await prisma.attendanceRegistry.findUnique({
        where: { studentId_date: { studentId: item.id, date: targetDate } },
      });

      await prisma.attendanceRegistry.upsert({
        where: { studentId_date: { studentId: item.id, date: targetDate } },
        create: {
          studentId: item.id,
          date: targetDate,
          status: item.status,
          source: AttendanceSource.MANUAL,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          remarks: note,
          recordedById: session.user.id,
        },
        update: {
          status: item.status,
          source: AttendanceSource.MANUAL,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          remarks: note,
          recordedById: session.user.id,
        },
      });

      // Audit Trail
      await prisma.attendanceAuditLog.create({
        data: {
          date: targetDate,
          entityType: "STUDENT_REGISTRY",
          entityId: item.id,
          studentId: item.id,
          action: existingReg ? "OVERRIDE" : "CREATE",
          oldStatus: existingReg?.status || null,
          newStatus: item.status,
          oldSource: existingReg?.source || null,
          newSource: "MANUAL",
          actorId: session.user.id,
          actorName,
          actorRole: session.user.role,
          reason: note,
        },
      }).catch(() => {});

      updatedCount++;
    }

    return res.json({
      success: true,
      message: `Successfully marked manual attendance for ${updatedCount} student(s).`,
      data: { updatedCount },
    });
  } catch (error) {
    console.error("Manual attendance recording error:", error);
    return res.status(500).json({ success: false, error: "Failed to record manual attendance" });
  }
});

export default router;
