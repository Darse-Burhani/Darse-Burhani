import ExcelJS from "exceljs";
import prisma from "./prisma";
import { eventRangeForRole, hasFacultyTimer, isLegacyFacultyRow } from "./biometric";

// ── Event-schedule helpers (scan windows are the attendance "events") ──

type ScanWindowRow = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateEndTime?: string | null;
  graceMinutes: number;
  enabled: boolean;
  facultyStartTime?: string | null;
  facultyEndTime?: string | null;
  facultyLateEndTime?: string | null;
  facultyEnabled?: boolean;
};

function toMin(hhmm: string): number {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Minutes since midnight IST for a stored (UTC) timestamp. */
function istMinutes(date: Date | string | null | undefined): number | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
}

function audienceOf(w: ScanWindowRow): "FACULTY" | "ALL_STUDENTS" | "BOTH" {
  if (isLegacyFacultyRow(w)) return "FACULTY";
  return hasFacultyTimer(w) ? "BOTH" : "ALL_STUDENTS";
}

function audienceLabel(w: ScanWindowRow): string {
  const a = audienceOf(w);
  return a === "BOTH" ? "Faculty + Students" : a === "FACULTY" ? "Faculty" : "All Students";
}

/**
 * Match a check-in timestamp to its scheduled scan event.
 * Unified model: a scan belongs to an event when inside EITHER its Talabat
 * timer or its faculty timer. When several enabled windows overlap, prefer
 * the audience-appropriate one (unified both-timer events serve either).
 * Returns the event name, or null when the scan falls outside every window.
 */
function matchScanEvent(
  checkInTime: Date | string | null | undefined,
  windows: ScanWindowRow[],
  preferFaculty: boolean,
): string | null {
  const t = istMinutes(checkInTime);
  if (t === null) return null;
  const inWindow = windows.filter((w) => {
    if (!w.enabled) return false;
    const primary = eventRangeForRole(w, preferFaculty ? "TEACHER" : "STUDENT");
    if (primary && primary.enabled && t >= primary.startMin && t <= primary.lateMin) return true;
    const secondary = eventRangeForRole(w, preferFaculty ? "STUDENT" : "TEACHER");
    return Boolean(secondary && secondary.enabled && t >= secondary.startMin && t <= secondary.lateMin);
  });
  if (inWindow.length === 0) return null;
  const preferred = inWindow.filter((w) => {
    const a = audienceOf(w);
    return a === "BOTH" || (a === "FACULTY") === preferFaculty;
  });
  const pick = preferred.length > 0 ? preferred : inWindow;
  pick.sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
  return pick[0].name;
}

function windowLiveStatus(w: ScanWindowRow, nowMin: number): "ACTIVE" | "UPCOMING" | "CLOSED" | "DISABLED" {
  if (!w.enabled) return "DISABLED";
  const student = eventRangeForRole(w, "STUDENT");
  const faculty = eventRangeForRole(w, "TEACHER");
  const ranges = [student, faculty].filter(
    (r): r is NonNullable<typeof r> => Boolean(r && r.enabled),
  );
  if (ranges.some((r) => nowMin >= r.startMin && nowMin <= r.lateMin)) return "ACTIVE";
  const starts = ranges.map((r) => r.startMin).filter((s) => s > nowMin);
  if (starts.length > 0 && Math.min(...starts) - nowMin <= 180) return "UPCOMING";
  return "CLOSED";
}

function formatTimeIST(date: Date | string | null | undefined): string {
  if (!date) return "--";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  }) + " IST";
}

function formatDateIST(date: Date | string | null | undefined): string {
  if (!date) return "--";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function dayStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface DailyReportOptions {
  dateStr?: string; // "YYYY-MM-DD"
}

// ── Color Theme Definitions (ARGB Hex Codes for ExcelJS) ──
const COLORS = {
  navyDark: "FF0F172A",
  navyHeader: "FF1E293B",
  navyLight: "FF334155",
  white: "FFFFFFFF",
  slate50: "FFF8FAFC",
  slate100: "FFF1F5F9",
  slate200: "FFE2E8F0",
  slate700: "FF334155",
  slate900: "FF0F172A",

  // Role Badges
  talabatFill: "FFDBEAFE",
  talabatText: "FF1E40AF",
  teacherFill: "FFF3E8FF",
  teacherText: "FF6B21A8",

  // Status Colors
  presentFill: "FFDCFCE7",
  presentText: "FF15803D",
  presentBorder: "FF86EFAC",

  lateFill: "FFFEF3C7",
  lateText: "FFB45309",
  lateBorder: "FFFCD34D",

  absentFill: "FFFEE2E2",
  absentText: "FFB91C1C",
  absentBorder: "FFFCA5A5",

  // Metric Cards
  blueCardFill: "FFEFF6FF",
  blueCardBorder: "FF93C5FD",
  purpleCardFill: "FFFAF5FF",
  purpleCardBorder: "FFD8B4FE",
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.slate200 } },
  left: { style: "thin", color: { argb: COLORS.slate200 } },
  bottom: { style: "thin", color: { argb: COLORS.slate200 } },
  right: { style: "thin", color: { argb: COLORS.slate200 } },
};

export async function generateDailyAttendanceExcel(options: DailyReportOptions = {}): Promise<{
  filename: string;
  buffer: Buffer;
  stats: {
    studentTotal: number;
    studentPresent: number;
    studentLate: number;
    studentAbsent: number;
    teacherTotal: number;
    teacherPresent: number;
    teacherLate: number;
    teacherAbsent: number;
  };
}> {
  const targetDate = options.dateStr ? new Date(`${options.dateStr}T00:00:00Z`) : new Date();
  const dateStart = dayStartUTC(targetDate);
  const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);
  const dateLabel = dateStart.toISOString().slice(0, 10);
  const formattedDate = formatDateIST(targetDate);

  // All scheduled scan events (windows) — each has its own name + time range.
  const scanWindows = (await prisma.biometricScanWindow.findMany({
    orderBy: { startTime: "asc" },
  })) as ScanWindowRow[];

  // 1. Fetch Students and their Attendance for the day
  const [students, studentRecords] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { user: { isActive: true } },
      include: { user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } } },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { studentId: "asc" }],
    }),
    prisma.attendanceRecord.findMany({
      where: {
        date: { gte: dateStart, lt: dateEnd },
      },
      include: {
        class: { select: { name: true, subject: true } },
      },
    }),
  ]);

  const studentAttendanceMap = new Map<string, (typeof studentRecords)[0]>();
  for (const rec of studentRecords) {
    if (!studentAttendanceMap.has(rec.studentId)) {
      studentAttendanceMap.set(rec.studentId, rec);
    }
  }

  // 2. Fetch Teachers and their Attendance for the day
  const [teachers, teacherRecords] = await Promise.all([
    prisma.teacherProfile.findMany({
      where: { user: { isActive: true } },
      include: { user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } } },
      orderBy: [{ employeeId: "asc" }],
    }),
    prisma.teacherAttendanceRecord.findMany({
      where: {
        date: { gte: dateStart, lt: dateEnd },
      },
    }),
  ]);

  const teacherAttendanceMap = new Map<string, (typeof teacherRecords)[0]>();
  for (const rec of teacherRecords) {
    if (!teacherAttendanceMap.has(rec.teacherId)) {
      teacherAttendanceMap.set(rec.teacherId, rec);
    }
  }

  // 3. Process Student Rows
  let studentPresent = 0;
  let studentLate = 0;
  let studentAbsent = 0;

  const talabatList = students.map((s) => {
    const att = studentAttendanceMap.get(s.id);
    const fullName = `${s.user.firstName} ${s.user.lastName}`.trim();
    const avatarUrl = s.user.avatarUrl || "";
    const gradeSection = s.section ? `Grade ${s.grade}-${s.section}` : `Grade ${s.grade || "--"}`;
    let status: "PRESENT" | "LATE" | "ABSENT" = "ABSENT";
    let checkInTime = "--";

    if (att) {
      status = att.status as "PRESENT" | "LATE" | "ABSENT";
      if (status === "PRESENT") studentPresent++;
      else if (status === "LATE") studentLate++;
      else studentAbsent++;
      checkInTime = formatTimeIST(att.checkInTime);
    } else {
      studentAbsent++;
    }

    return {
      avatarUrl,
      name: fullName,
      role: "Talabat",
      gradeOrDept: gradeSection,
      date: formattedDate,
      time: checkInTime,
      event: att ? matchScanEvent(att.checkInTime, scanWindows, false) || "Unscheduled" : "--",
      status,
    };
  });

  // 4. Process Teacher Rows
  let teacherPresent = 0;
  let teacherLate = 0;
  let teacherAbsent = 0;

  const teacherList = teachers.map((t) => {
    const att = teacherAttendanceMap.get(t.id);
    const fullName = `${t.user.firstName} ${t.user.lastName}`.trim();
    const avatarUrl = t.user.avatarUrl || (t as any).photoUrl || "";
    const department = t.department || (t as any).roleTitle || "Faculty";
    let status: "PRESENT" | "LATE" | "ABSENT" = "ABSENT";
    let checkInTime = "--";

    if (att) {
      status = att.status as "PRESENT" | "LATE" | "ABSENT";
      if (status === "PRESENT") teacherPresent++;
      else if (status === "LATE") teacherLate++;
      else teacherAbsent++;
      checkInTime = formatTimeIST(att.checkInTime);
    } else {
      teacherAbsent++;
    }

    return {
      avatarUrl,
      name: fullName,
      role: "Teacher",
      gradeOrDept: department,
      date: formattedDate,
      time: checkInTime,
      event: att ? matchScanEvent(att.checkInTime, scanWindows, true) || "Unscheduled" : "--",
      status,
    };
  });

  const studentTotal = students.length;
  const teacherTotal = teachers.length;
  const studentRate = studentTotal > 0 ? Math.round(((studentPresent + studentLate) / studentTotal) * 100) : 0;
  const teacherRate = teacherTotal > 0 ? Math.round(((teacherPresent + teacherLate) / teacherTotal) * 100) : 0;

  const combinedList = [...talabatList, ...teacherList];

  // ── Build ExcelJS Workbook ──
  const wb = new ExcelJS.Workbook();
  wb.creator = "Darse Burhani";
  wb.lastModifiedBy = "Darse Burhani Biometric System";
  wb.created = new Date();
  wb.modified = new Date();

  // ════════════════════════════════════════════════════════════
  // ── Sheet 1: Executive Summary & Metrics Dashboard ──
  // ════════════════════════════════════════════════════════════
  const wsSummary = wb.addWorksheet("Executive Summary", {
    views: [{ showGridLines: true }],
  });

  wsSummary.columns = [
    { width: 5 },  // A (padding)
    { width: 30 }, // B (Event Name / Metric Label)
    { width: 16 }, // C (Audience / Metric Value)
    { width: 13 }, // D (Start / separator)
    { width: 13 }, // E (End / Faculty Label)
    { width: 12 }, // F (Grace / Faculty Value)
    { width: 17 }, // G (Status)
  ];

  // Title Banner
  wsSummary.mergeCells("B2:G2");
  const titleCell = wsSummary.getCell("B2");
  titleCell.value = "DARSE BURHANI — DAILY ATTENDANCE EXECUTIVE REPORT";
  titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: COLORS.white } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyDark } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  wsSummary.getRow(2).height = 36;

  // Subtitle Banner
  wsSummary.mergeCells("B3:G3");
  const subCell = wsSummary.getCell("B3");
  subCell.value = `Report Date: ${formattedDate}   |   Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST   |   Live System Feed`;
  subCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FFCBD5E1" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyHeader } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  wsSummary.getRow(3).height = 22;

  // ── Event-wise Schedule Table (one row per scan event, each with its own name + times) ──
  let cursor = 5;
  wsSummary.mergeCells(`B${cursor}:G${cursor}`);
  const winHead = wsSummary.getCell(`B${cursor}`);
  winHead.value = `EVENT-WISE ATTENDANCE SCHEDULE (IST) — ${scanWindows.length} SCHEDULED EVENT${scanWindows.length === 1 ? "" : "S"}`;
  winHead.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.white } };
  winHead.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyLight } };
  winHead.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  wsSummary.getRow(cursor).height = 24;
  cursor += 1;

  // Table header
  const schedHeader = wsSummary.getRow(cursor);
  const schedCols = ["Event Name", "Audience", "On-Time From", "On-Time To", "Late Till", "Status"];
  const schedKeys = ["B", "C", "D", "E", "F", "G"];
  schedCols.forEach((label, i) => {
    const c = wsSummary.getCell(`${schedKeys[i]}${cursor}`);
    c.value = label;
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.white } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyHeader } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = BORDER_THIN;
  });
  wsSummary.getRow(cursor).height = 22;
  cursor += 1;

  const nowIST = new Date(Date.now() + 330 * 60 * 1000);
  const nowMin = nowIST.getUTCHours() * 60 + nowIST.getUTCMinutes();

  if (scanWindows.length === 0) {
    wsSummary.mergeCells(`B${cursor}:G${cursor}`);
    const emptyCell = wsSummary.getCell(`B${cursor}`);
    emptyCell.value = "No scan events scheduled for attendance";
    emptyCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF94A3B8" } };
    emptyCell.alignment = { horizontal: "center", vertical: "middle" };
    wsSummary.getRow(cursor).height = 22;
    cursor += 1;
  }

  const statusStyle: Record<string, { fill: string; text: string }> = {
    ACTIVE: { fill: COLORS.presentFill, text: COLORS.presentText },
    UPCOMING: { fill: COLORS.lateFill, text: COLORS.lateText },
    CLOSED: { fill: COLORS.slate100, text: COLORS.slate700 },
    DISABLED: { fill: COLORS.slate100, text: "FF94A3B8" },
  };

  for (const w of scanWindows) {
    const status = windowLiveStatus(w, nowMin);
    const style = statusStyle[status];
    const cells: Array<{ col: string; value: string | number; bold?: boolean }> = [
      { col: "B", value: w.name, bold: true },
      { col: "C", value: audienceLabel(w) },
      { col: "D", value: `${w.startTime} IST` },
      { col: "E", value: `${w.endTime} IST` },
      { col: "F", value: `${w.lateEndTime ?? w.endTime} IST` },
      { col: "G", value: status },
    ];
    cells.forEach(({ col, value, bold }, i) => {
      const c = wsSummary.getCell(`${col}${cursor}`);
      c.value = value;
      const isStatus = i === cells.length - 1;
      c.font = {
        name: "Calibri",
        size: 10,
        bold: bold || isStatus,
        color: { argb: isStatus ? style.text : COLORS.slate900 },
      };
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isStatus ? style.fill : i === 0 ? COLORS.slate50 : COLORS.white },
      };
      c.alignment = { horizontal: i === 0 ? "left" : "center", vertical: "middle", indent: 1 };
      c.border = BORDER_THIN;
    });
    wsSummary.getRow(cursor).height = 22;
    cursor += 1;
  }

  cursor += 1; // blank separator row

  // Metric Cards Headers
  wsSummary.mergeCells(`B${cursor}:C${cursor}`);
  const stuHead = wsSummary.getCell(`B${cursor}`);
  stuHead.value = "TALABAT (STUDENT) ATTENDANCE";
  stuHead.font = { name: "Calibri", size: 12, bold: true, color: { argb: COLORS.white } };
  stuHead.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } };
  stuHead.alignment = { horizontal: "center", vertical: "middle" };

  wsSummary.mergeCells(`E${cursor}:F${cursor}`);
  const facHead = wsSummary.getCell(`E${cursor}`);
  facHead.value = "FACULTY (TEACHER) ATTENDANCE";
  facHead.font = { name: "Calibri", size: 12, bold: true, color: { argb: COLORS.white } };
  facHead.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF581C87" } };
  facHead.alignment = { horizontal: "center", vertical: "middle" };
  wsSummary.getRow(cursor).height = 28;
  cursor += 1;

  // Metric Rows (Rows 10 - 15)
  const studentMetrics = [
    { label: "Total Enrolled Students", val: studentTotal, fill: COLORS.slate50, font: { bold: true } },
    { label: "Present (On-Time)", val: studentPresent, fill: COLORS.presentFill, font: { bold: true, color: { argb: COLORS.presentText } } },
    { label: "Late Scans", val: studentLate, fill: COLORS.lateFill, font: { bold: true, color: { argb: COLORS.lateText } } },
    { label: "Absent / Unscanned", val: studentAbsent, fill: COLORS.absentFill, font: { bold: true, color: { argb: COLORS.absentText } } },
    { label: "Overall Attendance Rate", val: `${studentRate}%`, fill: "FFEFF6FF", font: { bold: true, color: { argb: "FF1D4ED8" }, size: 12 } },
  ];

  const teacherMetrics = [
    { label: "Total Registered Faculty", val: teacherTotal, fill: COLORS.slate50, font: { bold: true } },
    { label: "Present (On-Time)", val: teacherPresent, fill: COLORS.presentFill, font: { bold: true, color: { argb: COLORS.presentText } } },
    { label: "Late Scans", val: teacherLate, fill: COLORS.lateFill, font: { bold: true, color: { argb: COLORS.lateText } } },
    { label: "Absent / Unscanned", val: teacherAbsent, fill: COLORS.absentFill, font: { bold: true, color: { argb: COLORS.absentText } } },
    { label: "Overall Attendance Rate", val: `${teacherRate}%`, fill: "FFFAF5FF", font: { bold: true, color: { argb: "FF7E22CE" }, size: 12 } },
  ];

  for (let i = 0; i < studentMetrics.length; i++) {
    const rowIdx = cursor + i;
    wsSummary.getRow(rowIdx).height = 24;

    // Student Column
    const sLabelCell = wsSummary.getCell(`B${rowIdx}`);
    const sValCell = wsSummary.getCell(`C${rowIdx}`);
    sLabelCell.value = studentMetrics[i].label;
    sValCell.value = studentMetrics[i].val;
    sLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: studentMetrics[i].fill } };
    sValCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: studentMetrics[i].fill } };
    sLabelCell.font = { name: "Calibri", size: 10, ...studentMetrics[i].font };
    sValCell.font = { name: "Calibri", size: 11, ...studentMetrics[i].font };
    sLabelCell.border = BORDER_THIN;
    sValCell.border = BORDER_THIN;
    sValCell.alignment = { horizontal: "center", vertical: "middle" };

    // Teacher Column
    const tLabelCell = wsSummary.getCell(`E${rowIdx}`);
    const tValCell = wsSummary.getCell(`F${rowIdx}`);
    tLabelCell.value = teacherMetrics[i].label;
    tValCell.value = teacherMetrics[i].val;
    tLabelCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: teacherMetrics[i].fill } };
    tValCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: teacherMetrics[i].fill } };
    tLabelCell.font = { name: "Calibri", size: 10, ...teacherMetrics[i].font };
    tValCell.font = { name: "Calibri", size: 11, ...teacherMetrics[i].font };
    tLabelCell.border = BORDER_THIN;
    tValCell.border = BORDER_THIN;
    tValCell.alignment = { horizontal: "center", vertical: "middle" };
  }

  // ════════════════════════════════════════════════════════════
  // ── Helper to Render Styled Attendance Data Sheet ──
  // ════════════════════════════════════════════════════════════
  function renderAttendanceSheet(sheetName: string, items: typeof combinedList, titleText: string) {
    const ws = wb.addWorksheet(sheetName, {
      views: [{ showGridLines: true }],
    });

    // Column Definitions with generous widths
    ws.columns = [
      { key: "avatar", width: 22 },       // A: Profile Pic
      { key: "name", width: 38 },         // B: Full Name (HIGHLIGHTED)
      { key: "role", width: 18 },         // C: Role / Type
      { key: "gradeDept", width: 28 },    // D: Grade / Department
      { key: "date", width: 18 },         // E: Date
      { key: "time", width: 22 },         // F: Attendance Time (HIGHLIGHTED)
      { key: "event", width: 28 },        // G: Scheduled Event (matched by scan time)
      { key: "status", width: 26 },       // H: Status (COLOR RECOGNITION)
    ];

    // Banner Top (Row 1)
    ws.mergeCells("A1:H1");
    const banner = ws.getCell("A1");
    banner.value = `DARSE BURHANI — ${titleText.toUpperCase()} (${formattedDate})`;
    banner.font = { name: "Calibri", size: 13, bold: true, color: { argb: COLORS.white } };
    banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyDark } };
    banner.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 32;

    // Table Header Row (Row 2)
    const headerRow = ws.getRow(2);
    headerRow.values = [
      "Profile Pic",
      "Name",
      "Talabat / Teacher",
      "Grade / Department",
      "Date",
      "Attendance Time",
      "Event (Scheduled Scan)",
      "Status (Present / Late / Absent)",
    ];
    headerRow.height = 28;

    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.white } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyHeader } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "medium", color: { argb: COLORS.navyDark } },
        bottom: { style: "medium", color: { argb: COLORS.navyDark } },
        left: { style: "thin", color: { argb: COLORS.navyLight } },
        right: { style: "thin", color: { argb: COLORS.navyLight } },
      };
    });

    // Populate and Style Data Rows (Row 3 onwards)
    items.forEach((item, index) => {
      const rowIndex = 3 + index;
      const row = ws.getRow(rowIndex);
      const isZebra = index % 2 === 1;
      const baseRowFill = isZebra ? COLORS.slate50 : COLORS.white;

      // 1. Profile Pic Cell
      const avatarCell = row.getCell(1);
      if (item.avatarUrl && item.avatarUrl.startsWith("http")) {
        avatarCell.value = {
          text: "📷 View Photo",
          hyperlink: item.avatarUrl,
        };
        avatarCell.font = { name: "Calibri", size: 10, color: { argb: "FF2563EB" }, underline: true };
      } else {
        avatarCell.value = "—";
        avatarCell.font = { name: "Calibri", size: 10, color: { argb: "FF94A3B8" } };
      }
      avatarCell.alignment = { horizontal: "center", vertical: "middle" };
      avatarCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseRowFill } };
      avatarCell.border = BORDER_THIN;

      // 2. Name Cell (HIGHLIGHTED BOLD)
      const nameCell = row.getCell(2);
      nameCell.value = item.name;
      nameCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.slate900 } };
      nameCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      nameCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: isZebra ? "FFF1F5F9" : COLORS.white } };
      nameCell.border = BORDER_THIN;

      // 3. Role Cell (Color Coded Pill)
      const roleCell = row.getCell(3);
      roleCell.value = item.role;
      const isTalabat = item.role.toLowerCase().includes("talabat") || item.role.toLowerCase().includes("student");
      roleCell.font = {
        name: "Calibri",
        size: 10,
        bold: true,
        color: { argb: isTalabat ? COLORS.talabatText : COLORS.teacherText },
      };
      roleCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isTalabat ? COLORS.talabatFill : COLORS.teacherFill },
      };
      roleCell.alignment = { horizontal: "center", vertical: "middle" };
      roleCell.border = BORDER_THIN;

      // 4. Grade / Department Cell
      const gradeCell = row.getCell(4);
      gradeCell.value = item.gradeOrDept;
      gradeCell.font = { name: "Calibri", size: 10, color: { argb: COLORS.slate700 } };
      gradeCell.alignment = { horizontal: "center", vertical: "middle" };
      gradeCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseRowFill } };
      gradeCell.border = BORDER_THIN;

      // 5. Date Cell
      const dateCell = row.getCell(5);
      dateCell.value = item.date;
      dateCell.font = { name: "Calibri", size: 10, color: { argb: COLORS.slate700 } };
      dateCell.alignment = { horizontal: "center", vertical: "middle" };
      dateCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: baseRowFill } };
      dateCell.border = BORDER_THIN;

      // 6. Attendance Time Cell (HIGHLIGHTED)
      const timeCell = row.getCell(6);
      timeCell.value = item.time;
      const hasCheckedIn = item.time !== "--";
      timeCell.font = {
        name: "Calibri",
        size: 10,
        bold: hasCheckedIn,
        color: { argb: hasCheckedIn ? COLORS.slate900 : "FF94A3B8" },
      };
      timeCell.alignment = { horizontal: "center", vertical: "middle" };
      timeCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: hasCheckedIn ? (isZebra ? "FFF0FDF4" : "FFF7FEE7") : baseRowFill },
      };
      timeCell.border = BORDER_THIN;

      // 7. Event Cell (scheduled scan event matched by check-in time)
      const eventCell = row.getCell(7);
      const hasEvent = item.event !== "--";
      eventCell.value = item.event;
      eventCell.font = {
        name: "Calibri",
        size: 10,
        bold: hasEvent && item.event !== "Unscheduled",
        color: { argb: hasEvent ? COLORS.slate900 : "FF94A3B8" },
      };
      eventCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: hasEvent ? "FFFFFBEB" : baseRowFill },
      };
      eventCell.alignment = { horizontal: "center", vertical: "middle" };
      eventCell.border = BORDER_THIN;

      // 8. Status Cell (COLOR CODED HIGH RECOGNITION)
      const statusCell = row.getCell(8);
      statusCell.value = item.status;
      let statusFill = COLORS.absentFill;
      let statusText = COLORS.absentText;
      let statusBorderColor = COLORS.absentBorder;

      if (item.status === "PRESENT") {
        statusFill = COLORS.presentFill;
        statusText = COLORS.presentText;
        statusBorderColor = COLORS.presentBorder;
      } else if (item.status === "LATE") {
        statusFill = COLORS.lateFill;
        statusText = COLORS.lateText;
        statusBorderColor = COLORS.lateBorder;
      }

      statusCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: statusText } };
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill } };
      statusCell.alignment = { horizontal: "center", vertical: "middle" };
      statusCell.border = {
        top: { style: "thin", color: { argb: statusBorderColor } },
        bottom: { style: "thin", color: { argb: statusBorderColor } },
        left: { style: "thin", color: { argb: statusBorderColor } },
        right: { style: "thin", color: { argb: statusBorderColor } },
      };

      row.height = 24;
    });

    // Enable AutoFilter on Table Columns
    ws.autoFilter = {
      from: "A2",
      to: `H${2 + items.length}`,
    };
  }

  // ════════════════════════════════════════════════════════════
  // ── Sheet 2: All Members Attendance ──
  // ════════════════════════════════════════════════════════════
  renderAttendanceSheet("All Attendance", combinedList, "Complete Daily Attendance");

  // ════════════════════════════════════════════════════════════
  // ── Sheet 3: Talabat Attendance ──
  // ════════════════════════════════════════════════════════════
  renderAttendanceSheet("Talabat Attendance", talabatList, "Talabat (Student) Attendance");

  // ════════════════════════════════════════════════════════════
  // ── Sheet 4: Faculty Attendance ──
  // ════════════════════════════════════════════════════════════
  renderAttendanceSheet("Faculty Attendance", teacherList, "Faculty (Teacher) Attendance");

  // ════════════════════════════════════════════════════════════
  // ── Sheet 5: Event Schedule (every scan event, its name + times) ──
  // ════════════════════════════════════════════════════════════
  {
    const ws = wb.addWorksheet("Event Schedule", {
      views: [{ showGridLines: true }],
    });

    ws.columns = [
      { key: "num", width: 8 },        // A: #
      { key: "name", width: 40 },      // B: Event Name
      { key: "audience", width: 18 },  // C: Audience
      { key: "start", width: 18 },     // D: On-Time From
      { key: "end", width: 18 },       // E: On-Time To
      { key: "grace", width: 16 },     // F: Late Till
      { key: "duration", width: 16 },  // G: Duration
      { key: "status", width: 16 },    // H: Status
    ];

    ws.mergeCells("A1:H1");
    const banner = ws.getCell("A1");
    banner.value = `DARSE BURHANI — EVENT-WISE SCAN SCHEDULE (${formattedDate})`;
    banner.font = { name: "Calibri", size: 13, bold: true, color: { argb: COLORS.white } };
    banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyDark } };
    banner.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 32;

    const headerRow = ws.getRow(2);
    headerRow.values = [
      "#",
      "Event Name",
      "Audience",
      "On-Time From",
      "On-Time To",
      "Late Till",
      "Duration",
      "Status",
    ];
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.white } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyHeader } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = BORDER_THIN;
    });

    scanWindows.forEach((w, index) => {
      const rowIndex = 3 + index;
      const row = ws.getRow(rowIndex);
      const status = windowLiveStatus(w, nowMin);
      const style = statusStyle[status];
      const audience = audienceOf(w);
      const isFacultyOnly = audience === "FACULTY";
      const durationMin = Math.max(toMin(w.endTime), toMin(w.lateEndTime ?? w.endTime)) - toMin(w.startTime);

      const values: Array<{ value: string | number; bold?: boolean; fill?: string; text?: string; align?: "left" | "center" }> = [
        { value: index + 1, align: "center" },
        { value: w.name, bold: true, fill: COLORS.slate50, align: "left" },
        { value: audienceLabel(w), bold: true, fill: isFacultyOnly ? COLORS.teacherFill : audience === "BOTH" ? COLORS.purpleCardFill : COLORS.talabatFill, text: isFacultyOnly ? COLORS.teacherText : audience === "BOTH" ? COLORS.teacherText : COLORS.talabatText, align: "center" },
        { value: `${w.startTime} IST`, align: "center" },
        { value: `${w.endTime} IST`, align: "center" },
        { value: `${w.lateEndTime ?? w.endTime} IST`, align: "center" },
        { value: durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`, align: "center" },
        { value: status, bold: true, fill: style.fill, text: style.text, align: "center" },
      ];

      values.forEach((v, i) => {
        const c = row.getCell(i + 1);
        c.value = v.value;
        c.font = { name: "Calibri", size: 11, bold: !!v.bold, color: { argb: v.text || COLORS.slate900 } };
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: v.fill || COLORS.white } };
        c.alignment = { horizontal: v.align || "center", vertical: "middle", indent: 1 };
        c.border = BORDER_THIN;
      });
      row.height = 24;
    });

    if (scanWindows.length === 0) {
      ws.mergeCells("A3:H3");
      const c = ws.getCell("A3");
      c.value = "No scan events scheduled";
      c.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF94A3B8" } };
      c.alignment = { horizontal: "center", vertical: "middle" };
    }

    ws.autoFilter = { from: "A2", to: `H${2 + Math.max(scanWindows.length, 1)}` };
  }

  // Generate Excel Buffer
  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = `Darse-Burhani-Attendance-${dateLabel}.xlsx`;

  return {
    filename,
    buffer,
    stats: {
      studentTotal,
      studentPresent,
      studentLate,
      studentAbsent,
      teacherTotal,
      teacherPresent,
      teacherLate,
      teacherAbsent,
    },
  };
}

// ════════════════════════════════════════════════════════════
// ── Multi-day, event-bifurcated attendance log ──
// One workbook covering [fromStr, toStr] (max 14 days):
//   Sheet 1 "Summary"      — Table A: day-wise totals per role (P/L/A),
//                            Table B: day × event bifurcation of scans.
//   Sheets "DD-Mon" …      — full roster log for each day (same 8 columns
//                            as the daily report, Google-Sheets compatible).
// ════════════════════════════════════════════════════════════

export interface RangedReportOptions {
  fromStr?: string; // "YYYY-MM-DD"
  toStr?: string; // "YYYY-MM-DD"
}

export interface RangedDayTotal {
  date: string;
  formattedDate: string;
  studentPresent: number;
  studentLate: number;
  studentAbsent: number;
  studentTotal: number;
  teacherPresent: number;
  teacherLate: number;
  teacherAbsent: number;
  teacherTotal: number;
}

export interface RangedEventSlice {
  date: string;
  formattedDate: string;
  eventName: string;
  timeWindow: string;
  audience: string;
  studentPresent: number;
  studentLate: number;
  teacherPresent: number;
  teacherLate: number;
  totalScans: number;
}

type RosterRow = {
  avatarUrl: string;
  name: string;
  role: string;
  gradeOrDept: string;
  date: string;
  time: string;
  event: string;
  status: "PRESENT" | "LATE" | "ABSENT";
};

/** Compact styled day sheet (same palette/columns as the daily report). */
function renderRangedDaySheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  titleText: string,
  formattedDate: string,
  items: RosterRow[],
) {
  const ws = wb.addWorksheet(sheetName, { views: [{ showGridLines: true }] });
  ws.columns = [
    { key: "avatar", width: 22 },
    { key: "name", width: 38 },
    { key: "role", width: 18 },
    { key: "gradeDept", width: 28 },
    { key: "date", width: 18 },
    { key: "time", width: 22 },
    { key: "event", width: 28 },
    { key: "status", width: 26 },
  ];

  ws.mergeCells("A1:H1");
  const banner = ws.getCell("A1");
  banner.value = `DARSE BURHANI — ${titleText.toUpperCase()} (${formattedDate})`;
  banner.font = { name: "Calibri", size: 13, bold: true, color: { argb: COLORS.white } };
  banner.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyDark } };
  banner.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 32;

  const headerRow = ws.getRow(2);
  headerRow.values = [
    "Profile Pic",
    "Name",
    "Talabat / Teacher",
    "Grade / Department",
    "Date",
    "Attendance Time",
    "Event (Scheduled Scan)",
    "Status (Present / Late / Absent)",
  ];
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyHeader } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = BORDER_THIN;
  });

  items.forEach((item, index) => {
    const row = ws.getRow(3 + index);
    const isZebra = index % 2 === 1;
    const baseFill = isZebra ? COLORS.slate50 : COLORS.white;
    const cells: Array<{ v: string; bold?: boolean; color?: string; fill?: string }> = [
      { v: item.avatarUrl && item.avatarUrl.startsWith("http") ? "View Photo" : "—", color: "FF2563EB" },
      { v: item.name, bold: true },
      { v: item.role, bold: true },
      { v: item.gradeOrDept },
      { v: item.date },
      { v: item.time, bold: item.time !== "--" },
      { v: item.event, bold: item.event !== "--" && item.event !== "Unscheduled" },
      { v: item.status, bold: true },
    ];
    cells.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      if (i === 0 && item.avatarUrl && item.avatarUrl.startsWith("http")) {
        cell.value = { text: "📷 View Photo", hyperlink: item.avatarUrl };
        cell.font = { name: "Calibri", size: 10, color: { argb: "FF2563EB" }, underline: true };
      } else {
        cell.value = c.v;
        cell.font = { name: "Calibri", size: i === 1 ? 11 : 10, bold: !!c.bold, color: { argb: c.color || COLORS.slate900 } };
      }
      let fill = c.fill || baseFill;
      if (i === 2) {
        const isTalabat = /talabat|student/i.test(item.role);
        fill = isTalabat ? COLORS.talabatFill : COLORS.teacherFill;
        cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: isTalabat ? COLORS.talabatText : COLORS.teacherText } };
      }
      if (i === 7) {
        fill = item.status === "PRESENT" ? COLORS.presentFill : item.status === "LATE" ? COLORS.lateFill : COLORS.absentFill;
        const text = item.status === "PRESENT" ? COLORS.presentText : item.status === "LATE" ? COLORS.lateText : COLORS.absentText;
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: text } };
      }
      if (i === 6 && item.event !== "--") fill = "FFFFFBEB";
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      cell.alignment = { horizontal: i === 1 ? "left" : "center", vertical: "middle", indent: 1 };
      cell.border = BORDER_THIN;
    });
    row.height = 22;
  });

  ws.autoFilter = { from: "A2", to: `H${2 + items.length}` };
}

export async function generateRangedAttendanceExcel(options: RangedReportOptions = {}): Promise<{
  filename: string;
  buffer: Buffer;
  stats: { days: RangedDayTotal[]; eventSlices: RangedEventSlice[] };
}> {
  const todayKey = new Date().toISOString().slice(0, 10);
  const toKey = options.toStr || todayKey;
  const fromKey =
    options.fromStr ||
    new Date(new Date(`${toKey}T00:00:00Z`).getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const fromStart = new Date(`${fromKey}T00:00:00Z`);
  const toStart = new Date(`${toKey}T00:00:00Z`);
  if (Number.isNaN(fromStart.getTime()) || Number.isNaN(toStart.getTime()) || fromStart > toStart) {
    throw new Error("Invalid from/to date range (expected YYYY-MM-DD, from <= to)");
  }
  const spanDays = Math.round((toStart.getTime() - fromStart.getTime()) / 86_400_000) + 1;
  if (spanDays > 14) throw new Error("Date range too large — maximum 14 days per log workbook");

  const scanWindows = (await prisma.biometricScanWindow.findMany({
    orderBy: { startTime: "asc" },
  })) as ScanWindowRow[];
  const windowByName = new Map(scanWindows.map((w) => [w.name, w]));

  const [students, teachers] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { user: { isActive: true } },
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { studentId: "asc" }],
    }),
    prisma.teacherProfile.findMany({
      where: { user: { isActive: true } },
      include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
      orderBy: [{ employeeId: "asc" }],
    }),
  ]);

  const days: RangedDayTotal[] = [];
  const eventSlices: RangedEventSlice[] = [];
  const perDaySheets: Array<{ sheetName: string; title: string; formattedDate: string; rows: RosterRow[] }> = [];

  const cursor = new Date(fromStart);
  while (cursor <= toStart) {
    const dayStart = new Date(cursor);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const dateKey = dayStart.toISOString().slice(0, 10);
    const formattedDate = formatDateIST(dayStart);

    const [studentRecords, teacherRecords] = await Promise.all([
      prisma.attendanceRecord.findMany({ where: { date: { gte: dayStart, lt: dayEnd } } }),
      prisma.teacherAttendanceRecord.findMany({ where: { date: { gte: dayStart, lt: dayEnd } } }),
    ]);

    const sMap = new Map(studentRecords.map((r) => [r.studentId, r]));
    const tMap = new Map(teacherRecords.map((r) => [r.teacherId, r]));

    let sP = 0, sL = 0, sA = 0, tP = 0, tL = 0, tA = 0;
    const rows: RosterRow[] = [];
    const sliceAcc = new Map<string, { sP: number; sL: number; tP: number; tL: number }>();
    const bump = (eventName: string | null, role: "S" | "T", status: string) => {
      if (!eventName) return;
      const acc = sliceAcc.get(eventName) || { sP: 0, sL: 0, tP: 0, tL: 0 };
      if (role === "S") { if (status === "PRESENT") acc.sP++; else if (status === "LATE") acc.sL++; }
      else { if (status === "PRESENT") acc.tP++; else if (status === "LATE") acc.tL++; }
      sliceAcc.set(eventName, acc);
    };

    for (const s of students) {
      const att = sMap.get(s.id);
      const status = (att?.status as "PRESENT" | "LATE" | "ABSENT" | undefined) ?? "ABSENT";
      if (status === "PRESENT") sP++; else if (status === "LATE") sL++; else sA++;
      const ev = att ? matchScanEvent(att.checkInTime, scanWindows, false) : null;
      bump(ev, "S", status);
      rows.push({
        avatarUrl: s.user.avatarUrl || "",
        name: `${s.user.firstName} ${s.user.lastName}`.trim(),
        role: "Talabat",
        gradeOrDept: s.section ? `Grade ${s.grade}-${s.section}` : `Grade ${s.grade || "--"}`,
        date: formattedDate,
        time: att ? formatTimeIST(att.checkInTime) : "--",
        event: att ? ev || "Unscheduled" : "--",
        status: status === "PRESENT" || status === "LATE" ? status : "ABSENT",
      });
    }

    for (const t of teachers) {
      const att = tMap.get(t.id);
      const status = (att?.status as "PRESENT" | "LATE" | "ABSENT" | undefined) ?? "ABSENT";
      if (status === "PRESENT") tP++; else if (status === "LATE") tL++; else tA++;
      const ev = att ? matchScanEvent(att.checkInTime, scanWindows, true) : null;
      bump(ev, "T", status);
      rows.push({
        avatarUrl: t.user.avatarUrl || (t as unknown as { photoUrl?: string }).photoUrl || "",
        name: `${t.user.firstName} ${t.user.lastName}`.trim(),
        role: "Teacher",
        gradeOrDept: t.department || (t as unknown as { roleTitle?: string }).roleTitle || "Faculty",
        date: formattedDate,
        time: att ? formatTimeIST(att.checkInTime) : "--",
        event: att ? ev || "Unscheduled" : "--",
        status: status === "PRESENT" || status === "LATE" ? status : "ABSENT",
      });
    }

    days.push({
      date: dateKey, formattedDate,
      studentPresent: sP, studentLate: sL, studentAbsent: sA, studentTotal: students.length,
      teacherPresent: tP, teacherLate: tL, teacherAbsent: tA, teacherTotal: teachers.length,
    });

    // One slice row per scheduled event per day (plus Unscheduled when needed)
    const orderedEvents = [...scanWindows.map((w) => w.name)];
    if ([...sliceAcc.keys()].some((k) => !windowByName.has(k)) && !orderedEvents.includes("Unscheduled")) {
      orderedEvents.push("Unscheduled");
    }
    for (const eventName of orderedEvents) {
      const acc = sliceAcc.get(eventName);
      if (!acc) continue;
      const w = windowByName.get(eventName);
      eventSlices.push({
        date: dateKey, formattedDate, eventName,
        timeWindow: w ? `${w.startTime}–${w.lateEndTime ?? w.endTime} IST` : "—",
        audience: w ? audienceLabel(w) : "—",
        studentPresent: acc.sP, studentLate: acc.sL,
        teacherPresent: acc.tP, teacherLate: acc.tL,
        totalScans: acc.sP + acc.sL + acc.tP + acc.tL,
      });
    }

    const d = new Date(`${dateKey}T00:00:00Z`);
    const sheetName = `${String(d.getUTCDate()).padStart(2, "0")}-${d.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}`;
    perDaySheets.push({ sheetName, title: "Daily Attendance Log", formattedDate, rows });

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // ── Build workbook ──
  const wb = new ExcelJS.Workbook();
  wb.creator = "Darse Burhani";
  wb.lastModifiedBy = "Darse Burhani Biometric System";
  wb.created = new Date();
  wb.modified = new Date();

  const ws = wb.addWorksheet("Summary", { views: [{ showGridLines: true }] });
  ws.columns = [
    { width: 5 },
    { width: 16 }, // B date
    { width: 34 }, // C event / label
    { width: 16 }, // D
    { width: 14 }, // E
    { width: 14 }, // F
    { width: 14 }, // G
    { width: 14 }, // H
    { width: 16 }, // I
    { width: 16 }, // J
  ];

  ws.mergeCells("B2:J2");
  const title = ws.getCell("B2");
  title.value = `DARSE BURHANI — ATTENDANCE LOG (${fromKey} to ${toKey}) — DAY-WISE, EVENT-BIFURCATED`;
  title.font = { name: "Calibri", size: 14, bold: true, color: { argb: COLORS.white } };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyDark } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(2).height = 34;

  ws.mergeCells("B3:J3");
  const sub = ws.getCell("B3");
  sub.value = `Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST   |   ${spanDays} day(s)   |   Opens directly in Google Sheets (File → Import)`;
  sub.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FFCBD5E1" } };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyHeader } };
  sub.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(3).height = 22;

  const sectionHead = (row: number, text: string) => {
    ws.mergeCells(`B${row}:J${row}`);
    const c = ws.getCell(`B${row}`);
    c.value = text;
    c.font = { name: "Calibri", size: 11, bold: true, color: { argb: COLORS.white } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyLight } };
    c.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    ws.getRow(row).height = 24;
  };
  const tableHead = (row: number, labels: string[]) => {
    labels.forEach((label, i) => {
      const col = String.fromCharCode(66 + i);
      const c = ws.getCell(`${col}${row}`);
      c.value = label;
      c.font = { name: "Calibri", size: 10, bold: true, color: { argb: COLORS.white } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.navyHeader } };
      c.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      c.border = BORDER_THIN;
    });
    ws.getRow(row).height = 30;
  };
  const bodyRow = (row: number, values: Array<string | number>, opts?: { boldCol?: number }) => {
    values.forEach((v, i) => {
      const col = String.fromCharCode(66 + i);
      const c = ws.getCell(`${col}${row}`);
      c.value = v;
      c.font = { name: "Calibri", size: 10, bold: opts?.boldCol === i, color: { argb: COLORS.slate900 } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: row % 2 === 0 ? COLORS.slate50 : COLORS.white } };
      c.alignment = { horizontal: "center", vertical: "middle" };
      c.border = BORDER_THIN;
    });
    ws.getRow(row).height = 22;
  };

  let r = 5;
  sectionHead(r, `TABLE A — DAY-WISE TOTALS (${students.length} TALABAT, ${teachers.length} FACULTY ON ROSTER)`);
  r += 1;
  tableHead(r, ["Date", "Talabat Present", "Talabat Late", "Talabat Absent", "Talabat Total", "Faculty Present", "Faculty Late", "Faculty Absent", "Faculty Total"]);
  for (const d of days) {
    r += 1;
    bodyRow(r, [d.formattedDate, d.studentPresent, d.studentLate, d.studentAbsent, d.studentTotal, d.teacherPresent, d.teacherLate, d.teacherAbsent, d.teacherTotal], { boldCol: 0 });
  }

  r += 2;
  sectionHead(r, "TABLE B — EVENT-WISE BIFURCATION (DAY × SCHEDULED SCAN EVENT)");
  r += 1;
  tableHead(r, ["Date", "Event", "Time Window", "Audience", "Talabat Present", "Talabat Late", "Faculty Present", "Faculty Late", "Total Scans"]);
  if (eventSlices.length === 0) {
    r += 1;
    ws.mergeCells(`B${r}:J${r}`);
    const c = ws.getCell(`B${r}`);
    c.value = "No biometric scans recorded in this period";
    c.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF94A3B8" } };
    c.alignment = { horizontal: "center", vertical: "middle" };
  }
  for (const s of eventSlices) {
    r += 1;
    bodyRow(r, [s.formattedDate, s.eventName, s.timeWindow, s.audience, s.studentPresent, s.studentLate, s.teacherPresent, s.teacherLate, s.totalScans], { boldCol: 1 });
  }
  ws.autoFilter = { from: "B6", to: `J${r}` };

  for (const sheet of perDaySheets) {
    renderRangedDaySheet(wb, sheet.sheetName, sheet.title, sheet.formattedDate, sheet.rows);
  }

  const arrayBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = `Darse-Burhani-Attendance-LOG-${fromKey}_to_${toKey}.xlsx`;
  return { filename, buffer, stats: { days, eventSlices } };
}
