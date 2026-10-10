import { Router } from "express";
import prisma from "../lib/prisma";
import { requireAuth } from "../middleware";
import { AttendanceStatus, AttendanceSource } from "@prisma/client";
import { broadcastAttendanceEvent, getWindowType } from "../lib/biometric";
import {
  queueAutoSheetSync,
  manualSheetSyncStatus,
  createManualSpreadsheet,
  syncManualAttendanceToSheet,
  extractSpreadsheetId,
} from "../lib/google-attendance-sync";

const router = Router();

function parseDate(dateStr?: string): Date {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// GET /api/attendance/manual/schedules - List available schedule event windows created in schedule
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

    const scheduledWindows = windows.map((w) => {
      const ww = w as any;
      const hasFaculty = Boolean(
        ww.facultyStartTime ||
        (w.applicableTeacherIds && w.applicableTeacherIds.length > 0) ||
        /faculty|teacher|staff/i.test(w.name)
      );

      return {
        id: w.id,
        name: w.name,
        windowType: getWindowType(w),
        startTime: w.startTime,
        endTime: w.endTime,
        lateEndTime: w.lateEndTime || w.endTime,
        graceMinutes: w.graceMinutes,
        enabled: w.enabled,
        hasFacultyTimer: hasFaculty,
        facultyStartTime: ww.facultyStartTime || w.startTime,
        facultyEndTime: ww.facultyEndTime || w.endTime,
        facultyLateEndTime: ww.facultyLateEndTime || w.endTime,
        facultyEnabled: ww.facultyEnabled ?? w.enabled,
        applicableTeacherIds: w.applicableTeacherIds || [],
        exemptTeacherIds: ww.exemptTeacherIds || [],
        applicableClassIds: ww.applicableClassIds || [],
        exemptStudentIds: ww.exemptStudentIds || [],
      };
    });

    // Filter strictly for manual events only (no HIKVISION hardware events)
    const manualOnly = scheduledWindows.filter(
      (w) => w.windowType === "MANUAL" || (!w.windowType && w.id.startsWith("manual_"))
    );
    const finalScheduledWindows = manualOnly;

    const grades = Array.from(new Set(classes.map((c) => c.grade).filter(Boolean))).sort();
    const sections = Array.from(new Set(classes.map((c) => c.section).filter(Boolean))).sort();

    return res.json({
      success: true,
      data: {
        scheduledWindows: finalScheduledWindows,
        classes: classes.map((c) => ({
          id: c.id,
          name: c.name,
          grade: c.grade,
          section: c.section,
          subject: c.subject,
          teacherName: `${c.teacher?.user?.firstName || ""} ${c.teacher?.user?.lastName || ""}`.trim(),
          studentCount: c._count.enrollments,
        })),
        grades,
        sections,
      },
    });
  } catch (error) {
    console.error("Fetch manual attendance schedules error:", error);
    return res.status(500).json({ success: false, error: "Failed to load schedule event windows" });
  }
});

// GET /api/attendance/manual/roster - Load candidate roster and current status for any schedule event & date
router.get("/roster", requireAuth, async (req, res) => {
  try {
    const {
      scheduleId,
      targetType = "ALL",
      date,
      grade,
      section,
      classId,
      department,
      search,
    } = req.query as Record<string, string>;

    const targetDate = parseDate(date);
    const dayEnd = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);

    const isAll = targetType === "ALL";
    const isTeacher = targetType === "TEACHER" || isAll;
    const isStudent = targetType === "STUDENT" || isAll;

    const roster: any[] = [];

    // ── 1. FACULTY AUDIENCE ──
    if (isTeacher) {
      let teacherWhere: any = { user: { isActive: true, deletedAt: null } };

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

      if (department && department !== "ALL") {
        teacherWhere.department = { contains: department, mode: "insensitive" };
      }

      if (search && search.trim()) {
        const q = search.trim();
        teacherWhere.OR = [
          { user: { firstName: { contains: q, mode: "insensitive" } } },
          { user: { lastName: { contains: q, mode: "insensitive" } } },
          { employeeId: { contains: q, mode: "insensitive" } },
          { its: { contains: q, mode: "insensitive" } },
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

      for (const t of teachers) {
        const r = recordMap.get(t.id);
        roster.push({
          id: t.id,
          profileId: t.id,
          name: `${t.user.firstName} ${t.user.lastName}`.trim(),
          email: t.user.email,
          identifier: t.employeeId,
          its: (t as any).its || t.employeeId,
          department: t.department || (t as any).roleTitle || "Faculty",
          avatarUrl: (t as any).photoUrl || t.user.avatarUrl,
          targetType: "TEACHER",
          status: r?.status || "NOT_MARKED",
          source: r?.verificationMethod || "MANUAL",
          checkInTime: r?.checkInTime ? new Date(r.checkInTime).toISOString() : null,
          checkOutTime: r?.checkOutTime ? new Date(r.checkOutTime).toISOString() : null,
          remarks: r?.notes || null,
        });
      }
    }

    // ── 2. STUDENT / TALABAT AUDIENCE ──
    if (isStudent) {
      const studentWhere: any = { user: { deletedAt: null } };
      if (grade && grade !== "ALL") studentWhere.grade = grade;
      if (section && section !== "ALL") studentWhere.section = section;

      if (classId && classId !== "ALL") {
        studentWhere.enrollments = { some: { classId, isActive: true } };
      }

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

      for (const s of students) {
        const reg = regMap.get(s.id);
        const rec = recMap.get(s.id);
        const status = reg?.status || rec?.status || "NOT_MARKED";
        const source = reg?.source || rec?.source || "MANUAL";
        const checkInTime = reg?.checkInTime || rec?.checkInTime || null;
        const checkOutTime = reg?.checkOutTime || rec?.checkOutTime || null;
        const remarks = reg?.remarks || rec?.justification || null;

        roster.push({
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
        });
      }
    }

    // Sort combined roster: Teachers first or alphabetical by name
    if (isAll) {
      roster.sort((a, b) => {
        if (a.targetType !== b.targetType) {
          return a.targetType === "TEACHER" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    }

    return res.json({
      success: true,
      data: { roster, totalCount: roster.length, date: targetDate.toISOString() },
    });
  } catch (error) {
    console.error("Fetch manual roster error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch candidate roster" });
  }
});

// POST /api/attendance/manual - Record manual attendance entries for schedule event window
router.post("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as {
      scheduleId?: string;
      date: string;
      targetType?: "STUDENT" | "TEACHER" | "ALL";
      records: Array<{
        id: string; // studentId or teacherId
        targetType?: "STUDENT" | "TEACHER";
        status: AttendanceStatus;
        checkInTime?: string | null;
        checkOutTime?: string | null;
        remarks?: string | null;
      }>;
    };

    const { scheduleId, date, targetType = "ALL", records } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ success: false, error: "records array cannot be empty" });
    }

    const targetDate = parseDate(date);
    const validStatuses = Object.values(AttendanceStatus);
    const actorName = `${session.user.firstName || ""} ${session.user.lastName || ""}`.trim() || session.user.email;

    let windowName = "Manual Roll Call";
    if (scheduleId) {
      const win = await prisma.biometricScanWindow.findUnique({ where: { id: scheduleId } });
      if (win) windowName = win.name;
    } else {
      const defaultManual = await prisma.biometricScanWindow.findFirst({
        where: {
          OR: [
            { id: { startsWith: "manual_" } },
            { exemptStudentIds: { has: "TYPE_MANUAL" } },
          ],
          enabled: true,
        },
        orderBy: { startTime: "asc" },
      });
      if (defaultManual) windowName = defaultManual.name;
    }

    // Split records by type if targetType === ALL or records have targetType attached
    const teacherRecords: typeof records = [];
    const studentRecords: typeof records = [];

    if (targetType === "TEACHER") {
      teacherRecords.push(...records);
    } else if (targetType === "STUDENT") {
      studentRecords.push(...records);
    } else {
      // Check individual record targetType or lookup ID
      const allIds = records.map((r) => r.id);
      const [knownTeachers, knownStudents] = await Promise.all([
        prisma.teacherProfile.findMany({ where: { id: { in: allIds } }, select: { id: true } }),
        prisma.studentProfile.findMany({ where: { id: { in: allIds } }, select: { id: true } }),
      ]);
      const teacherIdSet = new Set(knownTeachers.map((t) => t.id));
      const studentIdSet = new Set(knownStudents.map((s) => s.id));

      for (const item of records) {
        if (item.targetType === "TEACHER" || teacherIdSet.has(item.id)) {
          teacherRecords.push(item);
        } else {
          studentRecords.push(item);
        }
      }
    }

    let updatedTeacherCount = 0;
    let updatedStudentCount = 0;

    // ── A. TEACHER / FACULTY MANUAL ATTENDANCE ──
    const validTeacherRecords = teacherRecords.filter((r) => r.id && validStatuses.includes(r.status));
    if (validTeacherRecords.length > 0) {
      const existingTeacherRecs = await prisma.teacherAttendanceRecord.findMany({
        where: {
          teacherId: { in: validTeacherRecords.map((t) => t.id) },
          date: targetDate,
        },
      });
      const existingTeacherMap = new Map(existingTeacherRecs.map((r) => [r.teacherId, r]));

      await Promise.allSettled(
        validTeacherRecords.map(async (item) => {
          const checkIn = item.checkInTime
            ? new Date(item.checkInTime)
            : item.status === "PRESENT" || item.status === "LATE"
            ? new Date()
            : null;
          const checkOut = item.checkOutTime ? new Date(item.checkOutTime) : null;
          const note = item.remarks ? item.remarks.trim() : `Manual mark (${windowName}) by ${actorName}`;
          const existing = existingTeacherMap.get(item.id);

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
        }),
      );
      updatedTeacherCount = validTeacherRecords.length;
    }

    // ── B. STUDENT / TALABAT ATTENDANCE ──
    const validStudentRecords = studentRecords.filter((r) => r.id && validStatuses.includes(r.status));
    if (validStudentRecords.length > 0) {
      const studentIds = validStudentRecords.map((s) => s.id);
      const [fallbackClass, allEnrollments, existingRegistries] = await Promise.all([
        prisma.class.findFirst({ where: { isActive: true }, select: { id: true } }),
        prisma.classEnrollment.findMany({
          where: { studentId: { in: studentIds }, isActive: true },
          select: { studentId: true, classId: true },
        }),
        prisma.attendanceRegistry.findMany({
          where: { studentId: { in: studentIds }, date: targetDate },
        }),
      ]);

      const enrollmentMap = new Map<string, string[]>();
      for (const en of allEnrollments) {
        if (!enrollmentMap.has(en.studentId)) enrollmentMap.set(en.studentId, []);
        enrollmentMap.get(en.studentId)!.push(en.classId);
      }
      const registryMap = new Map(existingRegistries.map((r) => [r.studentId, r]));

      await Promise.allSettled(
        validStudentRecords.map(async (item) => {
          const checkIn = item.checkInTime
            ? new Date(item.checkInTime)
            : item.status === "PRESENT" || item.status === "LATE"
            ? new Date()
            : null;
          const checkOut = item.checkOutTime ? new Date(item.checkOutTime) : null;
          const note = item.remarks ? item.remarks.trim() : `Manual mark (${windowName}) by ${actorName}`;
          const existingReg = registryMap.get(item.id);

          // 1. Upsert AttendanceRegistry
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

          // 2. Upsert AttendanceRecord for student's active classes
          const studentClasses = enrollmentMap.get(item.id) || (fallbackClass ? [fallbackClass.id] : []);
          for (const cid of studentClasses) {
            await prisma.attendanceRecord.upsert({
              where: { studentId_classId_date: { studentId: item.id, classId: cid, date: targetDate } },
              create: {
                studentId: item.id,
                classId: cid,
                date: targetDate,
                status: item.status,
                source: AttendanceSource.MANUAL,
                verificationMethod: "MANUAL",
                checkInTime: checkIn,
                checkOutTime: checkOut,
                justification: note,
                recordedById: session.user.id,
              },
              update: {
                status: item.status,
                source: AttendanceSource.MANUAL,
                verificationMethod: "MANUAL",
                checkInTime: checkIn,
                checkOutTime: checkOut,
                justification: note,
                recordedById: session.user.id,
              },
            });
          }

          // 3. Audit Trail
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
        }),
      );
      updatedStudentCount = validStudentRecords.length;
    }

    const totalUpdated = updatedTeacherCount + updatedStudentCount;

    // Broadcast live event so open dashboards and logs refresh immediately
    broadcastAttendanceEvent({
      type: "MANUAL_ATTENDANCE_SAVED",
      role: targetType,
      windowName,
      count: totalUpdated,
      date: targetDate.toISOString(),
      actorName,
    });

    // Auto-sync manual marks to Google Sheet
    queueAutoSheetSync(targetDate);

    return res.json({
      success: true,
      message: `Successfully marked manual attendance for ${totalUpdated} member(s) (${updatedStudentCount} Talabat, ${updatedTeacherCount} Faculty).`,
      data: { updatedCount: totalUpdated, updatedStudentCount, updatedTeacherCount },
    });
  } catch (error) {
    console.error("Manual attendance recording error:", error);
    return res.status(500).json({ success: false, error: "Failed to record manual attendance" });
  }
});

// GET /api/attendance/manual/sheet-status — Status of the dedicated manual attendance Google Sheet
router.get("/sheet-status", requireAuth, async (req, res) => {
  try {
    const status = manualSheetSyncStatus();
    return res.json({ success: true, data: status });
  } catch (error) {
    console.error("Manual sheet status error:", error);
    return res.status(500).json({ success: false, error: "Failed to retrieve manual sheet status" });
  }
});

// POST /api/attendance/manual/create-sheet — Programmatically create a new Google Sheet for manual roll calls
router.post("/create-sheet", requireAuth, async (req, res) => {
  try {
    const { title } = req.body || {};
    const result = await createManualSpreadsheet(title);
    return res.json({
      success: true,
      message: `New Google Sheet created successfully: "${result.title}"`,
      data: result,
    });
  } catch (error: any) {
    console.error("Create manual sheet error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to create new Google Sheet",
    });
  }
});

// POST /api/attendance/manual/link-sheet — Link an existing Google Sheet URL/ID specifically for manual attendance
router.post("/link-sheet", requireAuth, async (req, res) => {
  try {
    const { spreadsheetId } = req.body || {};
    const cleanId = extractSpreadsheetId(spreadsheetId || "");
    if (!cleanId) {
      return res.status(400).json({ success: false, error: "Valid Google Sheet ID or URL is required" });
    }

    process.env.GOOGLE_MANUAL_ATTENDANCE_SPREADSHEET_ID = cleanId;
    return res.json({
      success: true,
      message: "Manual attendance Google Sheet linked successfully",
      data: {
        spreadsheetId: cleanId,
        url: `https://docs.google.com/spreadsheets/d/${cleanId}`,
      },
    });
  } catch (error: any) {
    console.error("Link manual sheet error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to link Google Sheet" });
  }
});

// POST /api/attendance/manual/sync-sheet — Sync manual attendance for a date to the dedicated Google Sheet
router.post("/sync-sheet", requireAuth, async (req, res) => {
  try {
    const rawDate = typeof req.body?.date === "string" ? req.body.date.trim() : "";
    const targetDate = rawDate ? new Date(`${rawDate}T00:00:00Z`) : new Date();
    if (Number.isNaN(targetDate.getTime())) {
      return res.status(400).json({ success: false, error: "Invalid date (expected YYYY-MM-DD)" });
    }

    const result = await syncManualAttendanceToSheet(targetDate);
    return res.json({
      success: true,
      message: `Synced ${result.rowsSynced} manual roll-call records to tab "${result.tabTitle}"`,
      data: result,
    });
  } catch (error: any) {
    console.error("Manual sheet sync error:", error);
    return res.status(500).json({
      success: false,
      error: error?.message || "Failed to sync manual attendance to Google Sheet",
    });
  }
});

export default router;
