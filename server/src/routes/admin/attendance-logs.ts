import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { normalizeDateToUTC } from "../../lib/leave-service";
import { AttendanceStatus, AttendanceSource } from "@prisma/client";
import { runAutoMarkAbsentJob, runAutoMarkFacultyAbsentJob, markSheetSyncRan } from "../../lib/attendance-scheduler";
import { sheetSyncStatus, syncDailyAttendanceToSheet } from "../../lib/google-attendance-sync";
import { eventRangeForRole, hasFacultyTimer, isLegacyFacultyRow, getStartOfDayIST } from "../../lib/biometric";

const router = Router();

// Match check-in timestamp to scheduled scan event (unified model: a scan
// belongs to an event when inside EITHER its Talabat timer or faculty timer)
function matchScheduledEvent(
  checkInTime: Date | string | null | undefined,
  windows: Array<{ id: string; name: string; startTime: string; endTime: string; lateEndTime?: string | null; enabled: boolean; facultyStartTime?: string | null; facultyEndTime?: string | null; facultyLateEndTime?: string | null; facultyEnabled?: boolean }>,
  isFaculty: boolean
): { id: string; name: string; timeWindow: string } | null {
  if (!checkInTime) return null;
  const d = new Date(checkInTime);
  if (Number.isNaN(d.getTime())) return null;

  // Convert to IST minutes
  const istMinutes = (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;

  const inWindow = windows.filter((w) => {
    if (!w.enabled) return false;
    const primary = eventRangeForRole(w, isFaculty ? "TEACHER" : "STUDENT");
    if (primary && primary.enabled && istMinutes >= primary.startMin && istMinutes <= primary.lateMin) return true;
    const secondary = eventRangeForRole(w, isFaculty ? "STUDENT" : "TEACHER");
    return Boolean(secondary && secondary.enabled && istMinutes >= secondary.startMin && istMinutes <= secondary.lateMin);
  });

  if (inWindow.length === 0) {
    return {
      id: "general",
      name: "General Session",
      timeWindow: "Standard Hours",
    };
  }

  const matched =
    inWindow.find((w) => {
      if (hasFacultyTimer(w as any) || isLegacyFacultyRow(w as any)) return true;
      return !isFaculty;
    }) || inWindow[0];

  return {
    id: matched.id,
    name: matched.name,
    timeWindow: `${matched.startTime} - ${matched.lateEndTime ?? matched.endTime}`,
  };
}

// GET /api/admin/attendance-logs/events — Get available scheduled events / windows for toggling
router.get("/events", requireRole("ADMIN"), async (req, res) => {
  try {
    const windows = await prisma.biometricScanWindow.findMany({
      orderBy: { startTime: "asc" },
    });

    const now = new Date();
    const nowMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;

    const events = windows.map((w) => {
      const ww = w as any;
      const unifiedFaculty = hasFacultyTimer(ww);
      const legacyFaculty = isLegacyFacultyRow(ww);
      const audience = legacyFaculty ? "FACULTY" : unifiedFaculty ? "BOTH" : "ALL_STUDENTS";

      const studentRange = eventRangeForRole(ww, "STUDENT");
      const facultyRange = eventRangeForRole(ww, "TEACHER");
      const activeRange = [studentRange, facultyRange].find(
        (r) => r && r.enabled && nowMinutes >= r.startMin && nowMinutes <= r.lateMin,
      );

      let status: "ACTIVE" | "UPCOMING" | "CLOSED" = "CLOSED";
      if (!w.enabled) {
        status = "CLOSED";
      } else if (activeRange) {
        status = "ACTIVE";
      } else if (
        studentRange &&
        nowMinutes < studentRange.startMin &&
        studentRange.startMin - nowMinutes <= 120
      ) {
        status = "UPCOMING";
      } else {
        status = "CLOSED";
      }

      return {
        id: w.id,
        name: w.name,
        startTime: w.startTime,
        endTime: w.endTime,
        lateEndTime: (w as any).lateEndTime || w.endTime,
        facultyStartTime: ww.facultyStartTime ?? null,
        facultyEndTime: ww.facultyEndTime ?? null,
        facultyLateEndTime: ww.facultyLateEndTime ?? ww.facultyEndTime ?? null,
        facultyEnabled: ww.facultyEnabled ?? true,
        hasFacultyTimer: unifiedFaculty || legacyFaculty,
        enabled: w.enabled,
        audience,
        status,
        timeDisplay: `${w.startTime} - ${(w as any).lateEndTime || w.endTime}`,
      };
    });

    return res.json({ success: true, data: events });
  } catch (error) {
    console.error("[attendance-logs] /events error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch scheduled events" });
  }
});

// GET /api/admin/attendance-logs — Day-by-day attendance log with schedule event matching
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const dayStart = getStartOfDayIST(req.query.date as string || new Date());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const { grade, section, status, source, search, eventWindowId, audience = "STUDENT" } = req.query;

    // Fetch scheduled windows for event matching
    const windows = await prisma.biometricScanWindow.findMany({
      orderBy: { startTime: "asc" },
    });

    // 1. Fetch Students
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

    let studentRecords: any[] = [];
    if (audience === "STUDENT" || audience === "ALL") {
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
            where: { date: { gte: dayStart, lt: dayEnd } },
            include: { leave: true },
            take: 1,
          },
          attendanceRecords: {
            where: { date: { gte: dayStart, lt: dayEnd } },
            include: { class: { select: { name: true } } },
            orderBy: [{ checkInTime: "desc" }],
          },
        },
        orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
      });

      studentRecords = students.map((s) => {
        const registry = s.attendanceRegistries[0];
        const record = s.attendanceRecords.find((r) => r.status === "PRESENT" || r.status === "LATE") || s.attendanceRecords[0];

        let effectiveStatus: string = "NOT_MARKED";
        let effectiveSource: string = "SCAN";
        let checkInTime: string | null = null;
        let checkOutTime: string | null = null;
        let remarks: string | null = null;
        let leaveDetails: any = null;

        if (registry) {
          effectiveStatus = registry.status;
          effectiveSource = registry.source === "BIOMETRIC" ? "SCAN" : registry.source;
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
          effectiveSource = record.source === "BIOMETRIC" || !record.source ? "SCAN" : record.source;
          if (record.verificationMethod === "AUTO_SYSTEM") {
            effectiveSource = "AUTO_ABSENT";
          }
          checkInTime = record.checkInTime?.toISOString() || null;
          checkOutTime = record.checkOutTime?.toISOString() || null;
          remarks = record.justification;
        }

        const matchedEvent = checkInTime ? matchScheduledEvent(checkInTime, windows, false) : null;

        return {
          id: registry?.id || record?.id || `virtual-student-${s.id}`,
          memberId: s.id,
          role: "STUDENT",
          name: `${s.user.firstName} ${s.user.lastName}`.trim(),
          avatarUrl: s.user.avatarUrl,
          its: s.its || s.studentId,
          grade: s.grade,
          section: s.section,
          designationOrClass: s.classEnrollments[0]?.class?.name || `Grade ${s.grade}-${s.section}`,
          status: effectiveStatus,
          source: effectiveSource,
          checkInTime,
          checkOutTime,
          remarks,
          leave: leaveDetails,
          streakDays: s.streakDays || 0,
          scheduledEvent: matchedEvent,
        };
      });
    }

    // 2. Fetch Faculty / Teachers if requested
    let facultyRecords: any[] = [];
    if (audience === "FACULTY" || audience === "ALL") {
      const teacherWhere: any = {
        user: { isActive: true },
      };
      if (search && typeof search === "string" && search.trim()) {
        const q = search.trim();
        teacherWhere.OR = [
          { user: { firstName: { contains: q, mode: "insensitive" } } },
          { user: { lastName: { contains: q, mode: "insensitive" } } },
          { employeeId: { contains: q, mode: "insensitive" } },
        ];
      }

      const teachers = await prisma.teacherProfile.findMany({
        where: teacherWhere,
        include: {
          user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
          attendanceRecords: {
            where: { date: { gte: dayStart, lt: dayEnd } },
            orderBy: [{ checkInTime: "desc" }],
          },
        },
        orderBy: [{ department: "asc" }, { user: { firstName: "asc" } }],
      });

      facultyRecords = teachers.map((t) => {
        const rec = t.attendanceRecords.find((r) => r.status === "PRESENT" || r.status === "LATE") || t.attendanceRecords[0];
        const status = rec ? rec.status : "NOT_MARKED";
        const checkInTime = rec?.checkInTime?.toISOString() || null;
        const checkOutTime = rec?.checkOutTime?.toISOString() || null;
        const remarks = rec?.notes || null;
        const source = rec?.verificationMethod === "AUTO_SYSTEM" ? "AUTO_ABSENT" : "SCAN";
        const matchedEvent = checkInTime ? matchScheduledEvent(checkInTime, windows, true) : null;

        return {
          id: rec?.id || `virtual-faculty-${t.id}`,
          memberId: t.id,
          role: "FACULTY",
          name: `${t.user.firstName} ${t.user.lastName}`.trim(),
          avatarUrl: t.user.avatarUrl,
          its: t.employeeId,
          grade: "Staff",
          section: t.department || "Faculty",
          designationOrClass: `${t.department || "Faculty"} • ${t.subjects?.join(", ") || "Staff"}`,
          status,
          source,
          checkInTime,
          checkOutTime,
          remarks,
          leave: null,
          streakDays: 0,
          scheduledEvent: matchedEvent,
        };
    const allRecords = [...studentRecords, ...facultyRecords];

    // 3. Filter by Event Window if specified
    let filteredRecords = allRecords;
    if (eventWindowId && typeof eventWindowId === "string" && eventWindowId !== "ALL") {
      filteredRecords = filteredRecords.filter((r) => r.scheduledEvent?.id === eventWindowId);
    }

    // Filter by Status
    if (status && typeof status === "string" && status !== "ALL") {
      filteredRecords = filteredRecords.filter((r) => r.status === status);
    }

    // Filter by Source
    if (source && typeof source === "string" && source !== "ALL") {
      filteredRecords = filteredRecords.filter((r) => r.source === source);
    }

    // 4. Calculate Summary Counters — BUGFIX: audience-isolated + filter-aware
    // Previously summary was always computed from allRecords, so selecting
    // a specific Event / Status / Source filter never updated the numbers.
    // Now we compute BOTH the live filtered summary (for the numbers the
    // user sees) and the audience totals (for context), plus split
    // Talabat vs Faculty counters so the UI can show proper separated numbers.
    function countSummary(list: typeof allRecords) {
      let present = 0, late = 0, absent = 0, medical = 0, onLeave = 0, notMarked = 0;
      let scanned = 0, manual = 0, autoAbsent = 0, medicalLeave = 0, leaveApproved = 0;
      for (const r of list) {
        if (r.status === "PRESENT") present++;
        else if (r.status === "LATE") late++;
        else if (r.status === "ABSENT") absent++;
        else if (r.status === "MEDICAL") medical++;
        else if (r.status === "ON_LEAVE") onLeave++;
        else notMarked++;
        if (r.source === "SCAN" || r.source === "BIOMETRIC") scanned++;
        else if (r.source === "MANUAL") manual++;
        else if (r.source === "AUTO_ABSENT") autoAbsent++;
        else if (r.source === "MEDICAL_LEAVE") medicalLeave++;
        else if (r.source === "LEAVE_APPROVED") leaveApproved++;
      }
      return { total: list.length, present, late, absent, medical, onLeave, notMarked,
        sources: { scanned, manual, autoAbsent, medicalLeave, leaveApproved } };
    }

    // Filter-aware summary (what the metric cards should display)
    const summary = countSummary(filteredRecords);
    // Audience-isolated live rosters (for "both" glitch — never mix counts)
    const talabatSummary = countSummary(studentRecords);
    const facultySummary = countSummary(facultyRecords);
    const overallSummary = countSummary(allRecords);

    // Per-event live counts for the Event chips (so each chip shows its live number)
    const eventLiveCounts: Record<string, number> = {};
    for (const r of allRecords) {
      const eid = r.scheduledEvent?.id;
      if (eid) eventLiveCounts[eid] = (eventLiveCounts[eid] || 0) + 1;
    }

    const distinctGrades = Array.from(new Set(studentRecords.map((s) => s.grade).filter(Boolean))).sort();
    const distinctSections = Array.from(new Set(studentRecords.map((s) => s.section).filter(Boolean))).sort();

    // No-cache for live polling
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");

    return res.json({
      success: true,
      data: {
        date: dayStart.toISOString(),
        summary,
        // Extra live splits so frontend can show proper Talabat vs Faculty numbers without mixing
        talabatSummary,
        facultySummary,
        overallSummary,
        eventLiveCounts,
        audience,
        filters: {
          grades: distinctGrades,
          sections: distinctSections,
        },
        records: filteredRecords,
      },
    });
  } catch (error) {
    console.error("[attendance-logs] GET error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch attendance logs" });
  }
});

// POST /api/admin/attendance-logs/override — Manual log override
router.post("/override", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { studentId, teacherId, date, status, source, remarks } = req.body;

    const targetDate = getStartOfDayIST(date ? new Date(date) : new Date());
    const validStatus = Object.values(AttendanceStatus).includes(status);

    if (!validStatus) {
      return res.status(400).json({ success: false, error: "Invalid attendance status" });
    }

    const mappedSource = source === "SCAN" ? AttendanceSource.BIOMETRIC : (source || AttendanceSource.MANUAL);

    if (studentId) {
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
          source: mappedSource,
          remarks: remarks || `Manual entry by Admin (${session.user.firstName})`,
          recordedById: session.user.id,
        },
        update: {
          status: status as AttendanceStatus,
          source: mappedSource,
          remarks: remarks || `Manual entry by Admin (${session.user.firstName})`,
          recordedById: session.user.id,
        },
      });

      return res.json({ success: true, data: updated });
    }

    if (teacherId) {
      const updatedTeacher = await prisma.teacherAttendanceRecord.upsert({
        where: {
          teacherId_date: {
            teacherId,
            date: targetDate,
          },
        },
        create: {
          teacherId,
          date: targetDate,
          status: status as AttendanceStatus,
          verificationMethod: "MANUAL",
          notes: remarks || `Manual entry by Admin (${session.user.firstName})`,
        },
        update: {
          status: status as AttendanceStatus,
          verificationMethod: "MANUAL",
          notes: remarks || `Manual entry by Admin (${session.user.firstName})`,
        },
      });

      return res.json({ success: true, data: updatedTeacher });
    }

    return res.status(400).json({ success: false, error: "studentId or teacherId is required" });
  } catch (error) {
    console.error("[attendance-logs] Override error:", error);
    return res.status(500).json({ success: false, error: "Failed to override attendance log record" });
  }
});

// POST /api/admin/attendance-logs/finalize-event — Save all event scans & mark absences in DB storage
router.post("/finalize-event", requireRole("ADMIN"), async (req, res) => {
  try {
    const targetDate = getStartOfDayIST(req.body.date ? new Date(req.body.date) : new Date());

    // Run automated absence & storage sync for both students and faculty
    const studentResult = await runAutoMarkAbsentJob(targetDate);
    const facultyResult = await runAutoMarkFacultyAbsentJob(targetDate);

    return res.json({
      success: true,
      message: "Event attendance finalized and permanently stored in database",
      data: {
        students: studentResult,
        faculty: facultyResult,
      },
    });
  } catch (error) {
    console.error("[attendance-logs] Finalize event error:", error);
    return res.status(500).json({ success: false, error: "Failed to finalize event attendance storage" });
  }
});

// GET /api/admin/attendance-logs/sync-sheet/status — Google Sheet daily log status
router.get("/sync-sheet/status", requireRole("ADMIN"), async (_req, res) => {
  try {
    return res.json({ success: true, data: sheetSyncStatus() });
  } catch (error) {
    console.error("[attendance-logs] sync-sheet status error:", error);
    return res.status(500).json({ success: false, error: "Failed to read sheet sync status" });
  }
});

// POST /api/admin/attendance-logs/sync-sheet — Push a day's roster to the online Google Sheet
// Body: { date?: "YYYY-MM-DD" } (defaults to today UTC)
router.post("/sync-sheet", requireRole("ADMIN"), async (req, res) => {
  try {
    const raw = typeof req.body?.date === "string" ? req.body.date.trim() : "";
    const target = raw ? new Date(`${raw}T00:00:00Z`) : new Date();
    if (Number.isNaN(target.getTime())) {
      return res.status(400).json({ success: false, error: "Invalid date (expected YYYY-MM-DD)" });
    }
    const result = await syncDailyAttendanceToSheet(target);
    markSheetSyncRan(target.toISOString().slice(0, 10));
    return res.json({ success: true, message: `Synced ${result.rowsSynced} rows to tab '${result.tabTitle}'`, data: result });
  } catch (error) {
    console.error("[attendance-logs] sync-sheet error:", error);
    return res.status(500).json({ success: false, error: (error as Error)?.message || "Failed to sync Google Sheet" });
  }
});

// GET /api/admin/attendance-logs/export — Bifurcated CSV (Talabat + Faculty)
// Now includes BOTH audiences, highlights Name/ITS/Scan Time/Status, IST formatting, and full roster (ABSENT rows included).
router.get("/export", requireRole("ADMIN"), async (req, res) => {
  try {
    const rawStart = req.query.startDate ? new Date(req.query.startDate as string) : new Date();
    const rawEnd = req.query.endDate ? new Date(req.query.endDate as string) : rawStart;

    const start = normalizeDateToUTC(rawStart);
    const end = normalizeDateToUTC(rawEnd);
    const endExclusive = new Date(end.getTime() + 24 * 60 * 60 * 1000);

    const { grade, section, audience } = req.query as Record<string, string | undefined>;
    const wantStudents = !audience || audience === "ALL" || audience === "STUDENT";
    const wantFaculty = !audience || audience === "ALL" || audience === "FACULTY";

    const fmtDateIST = (d: Date) => d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
    const fmtTimeIST = (t: Date | null | undefined) => t ? new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }) : "--";
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;

    const studentWhere: any = { user: { isActive: true } };
    if (grade) studentWhere.grade = grade as string;
    if (section) studentWhere.section = section as string;

    const [students, teachers] = await Promise.all([
      wantStudents ? prisma.studentProfile.findMany({
        where: studentWhere,
        include: {
          user: { select: { firstName: true, lastName: true } },
          attendanceRegistries: { where: { date: { gte: start, lt: endExclusive } } },
          attendanceRecords: { where: { date: { gte: start, lt: endExclusive } } },
        },
        orderBy: [{ grade: "asc" }, { section: "asc" }, { user: { firstName: "asc" } }],
      }) : Promise.resolve([] as any[]),
      wantFaculty ? prisma.teacherProfile.findMany({
        where: { user: { isActive: true } },
        include: {
          user: { select: { firstName: true, lastName: true } },
          attendanceRecords: { where: { date: { gte: start, lt: endExclusive } } },
        },
        orderBy: [{ employeeId: "asc" }],
      }) : Promise.resolve([] as any[]),
    ]);

    // Build day list for full roster export (ABSENT for missing)
    const dayKeys: string[] = [];
    const dayDates: Date[] = [];
    const cur = new Date(start);
    while (cur < endExclusive) { dayKeys.push(cur.toISOString().slice(0, 10)); dayDates.push(new Date(cur)); cur.setUTCDate(cur.getUTCDate() + 1); }

    const titleFrom = fmtDateIST(start);
    const titleTo = fmtDateIST(end);
    const titleRange = dayKeys.length === 1 ? titleFrom : `${titleFrom} → ${titleTo}`;

    const rows: string[] = [];
    // Title + meta rows with nice theme (visible when opened in Excel/Sheets)
    rows.push(esc(`DARSE BURHANI — ATTENDANCE LOG (BIFURCATED) — ${titleRange}`));
    rows.push(esc(`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST | Range: ${dayKeys[0]} to ${dayKeys[dayKeys.length - 1]} | Talabat: ${students.length} | Faculty: ${teachers.length}`));
    rows.push(""); // blank

    const header = ["Name", "ITS / Employee ID", "Grade / Department", "Role", "Date", "Scan Time (IST)", "Status (Present/Late/Absent)", "Source", "Remarks"].map(esc).join(",");

    function findRecForDay(list: any[], day: Date) {
      const key = day.toISOString().slice(0, 10);
      return list.find((r: any) => r.date.toISOString().slice(0, 10) === key) || null;
    }

    if (wantStudents) {
      rows.push(esc("──────── TALABAT (STUDENTS) ────────"));
      rows.push(header);
      for (const day of dayDates) {
        const formattedDate = fmtDateIST(day);
        for (const s of students) {
          const reg = findRecForDay(s.attendanceRegistries, day);
          const rec = findRecForDay(s.attendanceRecords, day);
          const src = reg || rec;
          let status = "ABSENT";
          let checkIn: string | null = null;
          let source = "--";
          let remarks = "";
          if (src) {
            status = src.status || "ABSENT";
            checkIn = src.checkInTime || rec?.checkInTime || null;
            const rawSrc = (src as any).source || (src as any).verificationMethod || "SCAN";
            source = rawSrc === "BIOMETRIC" ? "SCAN" : rawSrc;
            remarks = (src as any).remarks || (src as any).justification || (src as any).notes || "";
          }
          const name = `${s.user.firstName} ${s.user.lastName}`.trim();
          const itsVal = s.its || s.studentId;
          const gradeDept = s.section ? `Grade ${s.grade}-${s.section}` : `Grade ${s.grade || "--"}`;
          rows.push([esc(name), esc(itsVal), esc(gradeDept), esc("Talabat"), esc(formattedDate), esc(fmtTimeIST(checkIn as any)), esc(status), esc(source), esc(remarks)].join(","));
        }
      }
      rows.push(""); // gap between sections
    }

    if (wantFaculty) {
      rows.push(esc("──────── FACULTY (TEACHERS) ────────"));
      rows.push(header);
      for (const day of dayDates) {
        const formattedDate = fmtDateIST(day);
        for (const t of teachers) {
          const rec = findRecForDay(t.attendanceRecords, day);
          const status = rec ? (rec.status as string) : "ABSENT";
          const checkIn = rec?.checkInTime || null;
          const source = rec ? ((rec as any).verificationMethod === "AUTO_SYSTEM" ? "AUTO_ABSENT" : ((rec as any).verificationMethod || "SCAN")) : "--";
          const remarks = (rec as any)?.notes || "";
          const name = `${t.user.firstName} ${t.user.lastName}`.trim();
          const empId = (t as any).employeeId || (t as any).its || t.id;
          const dept = (t as any).department || (t as any).roleTitle || "Faculty";
          rows.push([esc(name), esc(empId), esc(dept), esc("Faculty"), esc(formattedDate), esc(fmtTimeIST(checkIn as any)), esc(status), esc(source), esc(remarks)].join(","));
        }
      }
    }

    if (!wantStudents && !wantFaculty) {
      rows.push(esc("No audience selected"));
    }

    const csv = "\uFEFF" + rows.join("\r\n");
    const rangeLabel = dayKeys.length === 1 ? dayKeys[0] : `${dayKeys[0]}_to_${dayKeys[dayKeys.length - 1]}`;
    const audLabel = audience && audience !== "ALL" ? `-${audience.toLowerCase()}` : "-bifurcated";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-logs${audLabel}-${rangeLabel}.csv"`);
    return res.send(csv);
  } catch (error) {
    console.error("[attendance-logs] Export error:", error);
    return res.status(500).json({ success: false, error: "Failed to export attendance logs" });
  }
});

export default router;
