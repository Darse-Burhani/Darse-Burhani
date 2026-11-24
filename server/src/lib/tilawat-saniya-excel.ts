import ExcelJS from "exceljs";
import prisma from "./prisma";
import { getStartOfDayIST } from "./biometric";

const COLORS = {
  midnightNavy: "FF0F172A",
  royalNavy: "FF1E293B",
  fatimiGold: "FFD4AF37",
  goldLight: "FFFFFBEB",
  goldBorder: "FFFDE68A",
  white: "FFFFFFFF",
  slate50: "FFF8FAFC",
  slate100: "FFF1F5F9",
  slate200: "FFE2E8F0",
  slate400: "FF94A3B8",
  slate700: "FF334155",
  slate800: "FF1E293B",
  slate900: "FF0F172A",
  emeraldHeader: "FF065F46",
  emeraldLight: "FFECFDF5",
  emeraldBorder: "FFA7F3D0",
  emeraldText: "FF047857",
  amberLight: "FFFEF3C7",
  amberBorder: "FFFDE68A",
  amberText: "FFB45309",
  roseLight: "FFFEE2E2",
  roseBorder: "FFFECACA",
  roseText: "FFB91C1C",
  blueLight: "FFEFF6FF",
  blueBorder: "FFBFDBFE",
  blueText: "FF1D4ED8",
  grayLight: "FFF3F4F6",
  grayText: "FF6B7280",
};

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: COLORS.slate200 } },
  left: { style: "thin", color: { argb: COLORS.slate200 } },
  bottom: { style: "thin", color: { argb: COLORS.slate200 } },
  right: { style: "thin", color: { argb: COLORS.slate200 } },
};

export async function generateTilawatSaniyaExcel(section: "A" | "B" = "A"): Promise<{
  filename: string;
  buffer: Buffer;
  stats: {
    studentCount: number;
    daysCount: number;
    totalPresent: number;
    totalLate: number;
    totalAbsent: number;
    totalLeave: number;
    avgAttendanceRate: number;
  };
}> {
  const sectionUpper = section.toUpperCase() === "B" ? "B" : "A";
  const darajahName = sectionUpper === "B" ? "Darajah Saniya Ba" : "Darajah Saniya Alif";
  const darajahTitle = sectionUpper === "B" ? "DARAJAH SANIYA BA (CLASS 2 B)" : "DARAJAH SANIYA ALIF (CLASS 2 A)";
  const filename = sectionUpper === "B"
    ? "Tilawat_Dua_Attendance_Darajah_Saniya_Ba_24Sept_24Nov.xlsx"
    : "Tilawat_Dua_Attendance_Darajah_Saniya_Alif_24Sept_24Nov.xlsx";

  // 1. Identify Target Class (Darajah Saniya Section A or B)
  const saniyaClass = await prisma.class.findFirst({
    where: {
      OR: [
        { grade: "2", section: sectionUpper },
        { name: `2 ${sectionUpper}` },
        { name: `Grade 2-${sectionUpper}` },
      ],
    },
    include: {
      enrollments: {
        where: { isActive: true },
        include: {
          student: {
            include: { user: true },
          },
        },
        orderBy: { student: { studentId: "asc" } },
      },
    },
  });

  if (!saniyaClass || saniyaClass.enrollments.length === 0) {
    throw new Error(`${darajahTitle} not found or has no enrolled students.`);
  }

  const students = saniyaClass.enrollments.map((en) => ({
    id: en.student.id,
    studentId: en.student.studentId,
    its: en.student.its || en.student.studentId,
    name: `${en.student.user.firstName || ""} ${en.student.user.lastName || ""}`.trim(),
    nameAr: en.student.nameAr || "",
  }));

  const studentIds = students.map((s) => s.id);

  // 2. Build Date Array: 24 Sept 2026 to 24 Nov 2026
  const startDate = new Date(Date.UTC(2026, 8, 24)); // Sept 24, 2026
  const endDate = new Date(Date.UTC(2026, 10, 24)); // Nov 24, 2026

  const dateList: Array<{ date: Date; dateStr: string; label: string; dayOfWeek: string; isSunday: boolean }> = [];
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const d = new Date(cur);
    const dateStr = d.toISOString().slice(0, 10);
    const dayOfWeek = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const isSunday = d.getUTCDay() === 0;
    const label = `${d.getUTCDate()} ${d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}`;
    dateList.push({ date: d, dateStr, label, dayOfWeek, isSunday });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // 3. Fetch all attendance records in range
  const registries = await prisma.attendanceRegistry.findMany({
    where: {
      studentId: { in: studentIds },
      date: { gte: startDate, lte: new Date(endDate.getTime() + 86400000) },
    },
  });

  const calendarHolidays = await prisma.academicCalendarEvent.findMany({
    where: {
      eventType: "HOLIDAY",
      startDate: { lte: new Date(endDate.getTime() + 86400000) },
      endDate: { gte: startDate },
    },
  });

  // Map: `${studentId}:${dateStr}` -> { status, checkInTime }
  const attMap = new Map<string, { status: string; checkInTime: string | null }>();
  for (const r of registries) {
    const dStr = r.date.toISOString().slice(0, 10);
    let checkInFormatted: string | null = null;
    if (r.checkInTime) {
      const utc = new Date(r.checkInTime);
      // Convert to IST (+5:30)
      const istHours = (utc.getUTCHours() + 5 + Math.floor((utc.getUTCMinutes() + 30) / 60)) % 24;
      const istMinutes = (utc.getUTCMinutes() + 30) % 60;
      const ampm = istHours >= 12 ? "PM" : "AM";
      const h12 = istHours % 12 || 12;
      checkInFormatted = `${String(h12).padStart(2, "0")}:${String(istMinutes).padStart(2, "0")} ${ampm}`;
    }
    attMap.set(`${r.studentId}:${dStr}`, {
      status: r.status,
      checkInTime: checkInFormatted,
    });
  }

  // 4. Build ExcelJS Workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = "Darse Burhani Administration";
  wb.created = new Date();
  wb.modified = new Date();

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 1: Attendance Matrix (Day-by-Day Detailed Log)
  // ══════════════════════════════════════════════════════════════════════════
  const wsMatrix = wb.addWorksheet("Attendance Matrix", {
    views: [{ state: "frozen", xSplit: 3, ySplit: 6, showGridLines: true }],
  });

  // Title Banner
  wsMatrix.mergeCells("A1:AP1");
  const cellTitle = wsMatrix.getCell("A1");
  cellTitle.value = "DARSE BURHANI — GALIAKOT | AL MAKTAB AL TALIMI";
  cellTitle.font = { name: "Arial", size: 14, bold: true, color: { argb: COLORS.white } };
  cellTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.midnightNavy } };
  cellTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsMatrix.getRow(1).height = 28;

  wsMatrix.mergeCells("A2:AP2");
  const cellSub = wsMatrix.getCell("A2");
  cellSub.value = `TILAWAT AL DUA BIOMETRIC ATTENDANCE REGISTER — ${darajahTitle}`;
  cellSub.font = { name: "Arial", size: 11, bold: true, color: { argb: COLORS.fatimiGold } };
  cellSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.royalNavy } };
  cellSub.alignment = { horizontal: "center", vertical: "middle" };
  wsMatrix.getRow(2).height = 22;

  wsMatrix.mergeCells("A3:AP3");
  const cellMeta = wsMatrix.getCell("A3");
  cellMeta.value = `Period: 24 September 2026 – 24 November 2026  |  Daily Session: 07:35 AM – 08:15 AM IST  |  Total Enrolled: ${students.length} Talabat  |  Generated: 24-Nov-2026`;
  cellMeta.font = { name: "Arial", size: 9, italic: true, color: { argb: COLORS.white } };
  cellMeta.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.slate700 } };
  cellMeta.alignment = { horizontal: "center", vertical: "middle" };
  wsMatrix.getRow(3).height = 20;

  // Header Row 5 & 6
  wsMatrix.getRow(5).height = 20;
  wsMatrix.getRow(6).height = 22;

  wsMatrix.getCell("A5").value = "S.No";
  wsMatrix.mergeCells("A5:A6");
  wsMatrix.getCell("B5").value = "Student Name (Talab)";
  wsMatrix.mergeCells("B5:B6");
  wsMatrix.getCell("C5").value = "ITS / ID";
  wsMatrix.mergeCells("C5:C6");

  // Date column headers
  dateList.forEach((dt, idx) => {
    const colIdx = 4 + idx;
    const colLetter = wsMatrix.getColumn(colIdx).letter;

    const cellD1 = wsMatrix.getCell(`${colLetter}5`);
    cellD1.value = dt.dayOfWeek;
    cellD1.font = { name: "Arial", size: 7.5, bold: true, color: { argb: dt.isSunday ? COLORS.roseText : COLORS.slate700 } };
    cellD1.alignment = { horizontal: "center", vertical: "middle" };
    cellD1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dt.isSunday ? COLORS.roseLight : COLORS.slate100 } };
    cellD1.border = BORDER_THIN;

    const cellD2 = wsMatrix.getCell(`${colLetter}6`);
    cellD2.value = dt.label;
    cellD2.font = { name: "Arial", size: 7.5, bold: true, color: { argb: dt.isSunday ? COLORS.roseText : COLORS.slate900 } };
    cellD2.alignment = { horizontal: "center", vertical: "middle" };
    cellD2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: dt.isSunday ? COLORS.roseLight : COLORS.slate100 } };
    cellD2.border = BORDER_THIN;

    wsMatrix.getColumn(colIdx).width = 7.0;
  });

  // Summary headers
  const summaryStartCol = 4 + dateList.length;
  const sumHeaders = [
    { label: "Working Days", key: "workDays", width: 13, color: COLORS.slate100 },
    { label: "Present (P)", key: "present", width: 12, color: COLORS.emeraldLight },
    { label: "Late (L)", key: "late", width: 10, color: COLORS.amberLight },
    { label: "Absent (A)", key: "absent", width: 11, color: COLORS.roseLight },
    { label: "On Leave (LV)", key: "leave", width: 12, color: COLORS.blueLight },
    { label: "Attendance %", key: "rate", width: 14, color: COLORS.goldLight },
  ];

  sumHeaders.forEach((sh, i) => {
    const cIdx = summaryStartCol + i;
    const cLet = wsMatrix.getColumn(cIdx).letter;
    wsMatrix.mergeCells(`${cLet}5:${cLet}6`);
    const cCell = wsMatrix.getCell(`${cLet}5`);
    cCell.value = sh.label;
    cCell.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.slate900 } };
    cCell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: sh.color } };
    cCell.border = BORDER_THIN;
    wsMatrix.getColumn(cIdx).width = sh.width;
  });

  // Format fixed student columns
  ["A", "B", "C"].forEach((colL) => {
    const c = wsMatrix.getCell(`${colL}5`);
    c.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.white } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.royalNavy } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = BORDER_THIN;
  });
  wsMatrix.getColumn("A").width = 6;
  wsMatrix.getColumn("B").width = 36;
  wsMatrix.getColumn("C").width = 13;

  // 5. Populate Student Attendance Rows
  let grandTotalPresent = 0;
  let grandTotalLate = 0;
  let grandTotalAbsent = 0;
  let grandTotalLeave = 0;
  let grandTotalWorkingDays = 0;

  students.forEach((stu, sIdx) => {
    const rowIdx = 7 + sIdx;
    wsMatrix.getRow(rowIdx).height = 20;

    const cellNum = wsMatrix.getCell(`A${rowIdx}`);
    cellNum.value = sIdx + 1;
    cellNum.alignment = { horizontal: "center", vertical: "middle" };
    cellNum.border = BORDER_THIN;
    cellNum.font = { name: "Arial", size: 9, bold: true };

    const cellName = wsMatrix.getCell(`B${rowIdx}`);
    cellName.value = stu.name;
    cellName.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    cellName.border = BORDER_THIN;
    cellName.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.slate900 } };

    const cellId = wsMatrix.getCell(`C${rowIdx}`);
    cellId.value = stu.studentId;
    cellId.alignment = { horizontal: "center", vertical: "middle" };
    cellId.border = BORDER_THIN;
    cellId.font = { name: "Consolas", size: 9, bold: true, color: { argb: COLORS.slate700 } };

    let pCount = 0;
    let lCount = 0;
    let aCount = 0;
    let lvCount = 0;
    let workingDays = 0;

    dateList.forEach((dt, dIdx) => {
      const cIdx = 4 + dIdx;
      const cLet = wsMatrix.getColumn(cIdx).letter;
      const cell = wsMatrix.getCell(`${cLet}${rowIdx}`);
      cell.border = BORDER_THIN;

      // Check Holiday / Sunday
      const isHol = dt.isSunday || calendarHolidays.some((h) => h.startDate <= dt.date && h.endDate >= dt.date);
      const record = attMap.get(`${stu.id}:${dt.dateStr}`);

      if (isHol) {
        cell.value = "H";
        cell.font = { name: "Arial", size: 7.5, bold: true, color: { argb: COLORS.grayText } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.grayLight } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        workingDays++;
        if (record) {
          if (record.status === "PRESENT") {
            pCount++;
            cell.value = "P";
            cell.font = { name: "Arial", size: 8, bold: true, color: { argb: COLORS.emeraldText } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.emeraldLight } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else if (record.status === "LATE") {
            lCount++;
            cell.value = "L";
            cell.font = { name: "Arial", size: 8, bold: true, color: { argb: COLORS.amberText } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.amberLight } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else if (record.status === "ON_LEAVE" || record.status === "LEAVE_APPROVED" || record.status === "MEDICAL") {
            lvCount++;
            cell.value = "LV";
            cell.font = { name: "Arial", size: 7.5, bold: true, color: { argb: COLORS.blueText } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.blueLight } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
          } else {
            aCount++;
            cell.value = "A";
            cell.font = { name: "Arial", size: 8, bold: true, color: { argb: COLORS.roseText } };
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.roseLight } };
            cell.alignment = { horizontal: "center", vertical: "middle" };
          }
        } else {
          // If no record on working day, marked Absent
          aCount++;
          cell.value = "A";
          cell.font = { name: "Arial", size: 8, bold: true, color: { argb: COLORS.roseText } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.roseLight } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      }
    });

    grandTotalPresent += pCount;
    grandTotalLate += lCount;
    grandTotalAbsent += aCount;
    grandTotalLeave += lvCount;
    grandTotalWorkingDays = Math.max(grandTotalWorkingDays, workingDays);

    const effectivePresent = pCount + lCount;
    const rate = workingDays > 0 ? Math.round((effectivePresent / workingDays) * 100) : 100;

    // Summary cells
    const s1 = wsMatrix.getCell(`${wsMatrix.getColumn(summaryStartCol).letter}${rowIdx}`);
    s1.value = workingDays;
    s1.alignment = { horizontal: "center", vertical: "middle" };
    s1.border = BORDER_THIN;
    s1.font = { name: "Arial", size: 9, bold: true };

    const s2 = wsMatrix.getCell(`${wsMatrix.getColumn(summaryStartCol + 1).letter}${rowIdx}`);
    s2.value = pCount;
    s2.alignment = { horizontal: "center", vertical: "middle" };
    s2.border = BORDER_THIN;
    s2.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.emeraldText } };

    const s3 = wsMatrix.getCell(`${wsMatrix.getColumn(summaryStartCol + 2).letter}${rowIdx}`);
    s3.value = lCount;
    s3.alignment = { horizontal: "center", vertical: "middle" };
    s3.border = BORDER_THIN;
    s3.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.amberText } };

    const s4 = wsMatrix.getCell(`${wsMatrix.getColumn(summaryStartCol + 3).letter}${rowIdx}`);
    s4.value = aCount;
    s4.alignment = { horizontal: "center", vertical: "middle" };
    s4.border = BORDER_THIN;
    s4.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.roseText } };

    const s5 = wsMatrix.getCell(`${wsMatrix.getColumn(summaryStartCol + 4).letter}${rowIdx}`);
    s5.value = lvCount;
    s5.alignment = { horizontal: "center", vertical: "middle" };
    s5.border = BORDER_THIN;
    s5.font = { name: "Arial", size: 9, bold: true, color: { argb: COLORS.blueText } };

    const s6 = wsMatrix.getCell(`${wsMatrix.getColumn(summaryStartCol + 5).letter}${rowIdx}`);
    s6.value = `${rate}%`;
    s6.alignment = { horizontal: "center", vertical: "middle" };
    s6.border = BORDER_THIN;
    s6.font = { name: "Arial", size: 9.5, bold: true, color: { argb: rate >= 90 ? COLORS.emeraldText : rate >= 75 ? COLORS.amberText : COLORS.roseText } };
    s6.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: rate >= 90 ? COLORS.emeraldLight : rate >= 75 ? COLORS.amberLight : COLORS.roseLight },
    };
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SHEET 2: Student Performance Summary
  // ══════════════════════════════════════════════════════════════════════════
  const wsSummary = wb.addWorksheet("Student Summary", {
    views: [{ showGridLines: true }],
  });

  wsSummary.mergeCells("A1:G1");
  const wsSumTitle = wsSummary.getCell("A1");
  wsSumTitle.value = `${darajahTitle} — STUDENT-WISE ATTENDANCE PERFORMANCE SUMMARY`;
  wsSumTitle.font = { name: "Arial", size: 12, bold: true, color: { argb: COLORS.white } };
  wsSumTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.midnightNavy } };
  wsSumTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsSummary.getRow(1).height = 26;

  const sumCols = [
    { label: "S.No", width: 8, col: "A" },
    { label: "ITS / Student ID", width: 18, col: "B" },
    { label: "Talabat Full Name", width: 38, col: "C" },
    { label: "Present Days", width: 14, col: "D" },
    { label: "Late Scans", width: 14, col: "E" },
    { label: "Absent Days", width: 14, col: "F" },
    { label: "Attendance Rate (%)", width: 22, col: "G" },
  ];

  wsSummary.getRow(3).height = 22;
  sumCols.forEach((sc) => {
    const c = wsSummary.getCell(`${sc.col}3`);
    c.value = sc.label;
    c.font = { name: "Arial", size: 9.5, bold: true, color: { argb: COLORS.white } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.royalNavy } };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.border = BORDER_THIN;
    wsSummary.getColumn(sc.col).width = sc.width;
  });

  students.forEach((stu, sIdx) => {
    const rIdx = 4 + sIdx;
    wsSummary.getRow(rIdx).height = 20;

    let pCount = 0;
    let lCount = 0;
    let aCount = 0;
    let wCount = 0;

    dateList.forEach((dt) => {
      const isHol = dt.isSunday || calendarHolidays.some((h) => h.startDate <= dt.date && h.endDate >= dt.date);
      if (isHol) return;
      wCount++;
      const rec = attMap.get(`${stu.id}:${dt.dateStr}`);
      if (rec?.status === "PRESENT") pCount++;
      else if (rec?.status === "LATE") lCount++;
      else if (rec?.status === "ON_LEAVE" || rec?.status === "LEAVE_APPROVED" || rec?.status === "MEDICAL") { /* leave */ }
      else aCount++;
    });

    const rate = wCount > 0 ? Math.round(((pCount + lCount) / wCount) * 100) : 100;

    wsSummary.getCell(`A${rIdx}`).value = sIdx + 1;
    wsSummary.getCell(`A${rIdx}`).alignment = { horizontal: "center", vertical: "middle" };
    wsSummary.getCell(`A${rIdx}`).border = BORDER_THIN;

    wsSummary.getCell(`B${rIdx}`).value = stu.studentId;
    wsSummary.getCell(`B${rIdx}`).alignment = { horizontal: "center", vertical: "middle" };
    wsSummary.getCell(`B${rIdx}`).font = { name: "Consolas", size: 9.5, bold: true };
    wsSummary.getCell(`B${rIdx}`).border = BORDER_THIN;

    wsSummary.getCell(`C${rIdx}`).value = stu.name;
    wsSummary.getCell(`C${rIdx}`).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    wsSummary.getCell(`C${rIdx}`).font = { name: "Arial", size: 9.5, bold: true };
    wsSummary.getCell(`C${rIdx}`).border = BORDER_THIN;

    wsSummary.getCell(`D${rIdx}`).value = pCount;
    wsSummary.getCell(`D${rIdx}`).alignment = { horizontal: "center", vertical: "middle" };
    wsSummary.getCell(`D${rIdx}`).font = { name: "Arial", size: 9.5, bold: true, color: { argb: COLORS.emeraldText } };
    wsSummary.getCell(`D${rIdx}`).border = BORDER_THIN;

    wsSummary.getCell(`E${rIdx}`).value = lCount;
    wsSummary.getCell(`E${rIdx}`).alignment = { horizontal: "center", vertical: "middle" };
    wsSummary.getCell(`E${rIdx}`).font = { name: "Arial", size: 9.5, bold: true, color: { argb: COLORS.amberText } };
    wsSummary.getCell(`E${rIdx}`).border = BORDER_THIN;

    wsSummary.getCell(`F${rIdx}`).value = aCount;
    wsSummary.getCell(`F${rIdx}`).alignment = { horizontal: "center", vertical: "middle" };
    wsSummary.getCell(`F${rIdx}`).font = { name: "Arial", size: 9.5, bold: true, color: { argb: COLORS.roseText } };
    wsSummary.getCell(`F${rIdx}`).border = BORDER_THIN;

    const rateCell = wsSummary.getCell(`G${rIdx}`);
    rateCell.value = `${rate}%`;
    rateCell.alignment = { horizontal: "center", vertical: "middle" };
    rateCell.font = { name: "Arial", size: 10, bold: true, color: { argb: rate >= 90 ? COLORS.emeraldText : rate >= 75 ? COLORS.amberText : COLORS.roseText } };
    rateCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: rate >= 90 ? COLORS.emeraldLight : rate >= 75 ? COLORS.amberLight : COLORS.roseLight },
    };
    rateCell.border = BORDER_THIN;
  });

  const totalPossible = grandTotalWorkingDays * students.length;
  const avgRate = totalPossible > 0 ? Math.round(((grandTotalPresent + grandTotalLate) / totalPossible) * 100) : 100;

  const rawBuffer = await wb.xlsx.writeBuffer();
  const buffer = Buffer.from(rawBuffer);

  return {
    filename,
    buffer,
    stats: {
      studentCount: students.length,
      daysCount: dateList.length,
      totalPresent: grandTotalPresent,
      totalLate: grandTotalLate,
      totalAbsent: grandTotalAbsent,
      totalLeave: grandTotalLeave,
      avgAttendanceRate: avgRate,
    },
  };
}

export async function generateTilawatSaniyaAlifExcel() {
  return generateTilawatSaniyaExcel("A");
}

export async function generateTilawatSaniyaBaExcel() {
  return generateTilawatSaniyaExcel("B");
}
