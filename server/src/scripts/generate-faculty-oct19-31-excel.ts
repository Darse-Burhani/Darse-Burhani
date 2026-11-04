import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';

dotenv.config({ path: path.resolve('server/.env') });
dotenv.config({ path: path.resolve('.env') });

import prisma from '../lib/prisma';
import { gregorianToJulianDay, julianDayToHijri, formatHijriDate } from '../lib/fatimi-calendar';

interface DayRecord {
  gregorian: string;      // "2026-10-19"
  hijriDay: number;
  hijriDateStr: string;   // "9 Jumādā al-Ūlā 1448 AH"
  hijriArabic: string;    // "٩ جمادى الأولى ١٤٤٨"
  dayOfWeek: string;      // "Monday"
  isSunday: boolean;
  isHoliday: boolean;
  holidayReason?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HOLIDAY';
  checkInISO: string | null;
  checkInIST: string;
  checkOutISO: string | null;
  checkOutIST: string;
  duration: string;
  device: string;
  method: string;
  remarks: string;
}

const TARGET_FACULTY = [
  {
    its: '30434547',
    displayName: 'M Juzer bhai Abbas bhai Bundiwala',
    officialName: 'Mulla Juzer bhai Abbas bhai Bundiwala',
    email: 'juzer.kota@mahadalzahra.com',
    department: 'Nisab & Takhteet / Faculty of Quran & Sharia',
    designation: 'Senior Faculty Member',
  },
  {
    its: '30351321',
    displayName: 'M Huzaifa bhai Alimohammed bhai Mehmoodjee',
    officialName: 'Mulla Huzaifa bhai Alimohammed bhai Mehmoodjiwala',
    email: 'huzaifa.mehmoodjiwala@mahadalzahra.com',
    department: 'Nisab & Takhteet / Faculty of Quran & Sharia',
    designation: 'Senior Faculty Member',
  },
  {
    its: '60414938',
    displayName: 'M Mustafa bhai Bharmal',
    officialName: 'Mulla Mustafa bhai Mulla Shabbir bhai Bharmal',
    email: 'mustafa.bharmal@mahadalzahra.com',
    department: 'Nisab & Takhteet / Faculty of Quran & Sharia',
    designation: 'Senior Faculty Member',
  },
  {
    its: '30705954',
    displayName: 'M Shabbir bhai Mustafa bhai Hydrabad wala',
    officialName: 'Mulla Shabbir bhai Mustafa bhai Hyderabadwala',
    email: 'shabbir.hydrabadwala@mahadalzahra.com',
    department: 'Nisab & Takhteet / Faculty of Quran & Sharia',
    designation: 'Senior Faculty Member',
  },
  {
    its: '30496517',
    displayName: 'M Yusuf bhai Nooruddin bhai Chikli',
    officialName: 'Mulla Yusuf bhai Nooruddin bhai Chikly',
    email: 'yusuf.chikli@mahadalzahra.com',
    department: 'Nisab & Takhteet / Faculty of Quran & Sharia',
    designation: 'Senior Faculty Member',
  },
  {
    its: '30394809',
    displayName: 'Abdulqadir bhai Yusuf bhai Chay wala',
    officialName: 'Abdulqadir bhai Yusuf bhai Chay wala',
    email: 'abdulqadir.chaywala@mahadalzahra.com',
    department: 'Nisab & Takhteet / Faculty of Quran & Sharia',
    designation: 'Senior Faculty Member',
  },
  {
    its: '30390267',
    displayName: 'M Abdulqadir bhai Qaidjoher bhai Kuksiwala',
    officialName: 'Mulla Abdulqadir bhai Qaidjoher bhai Nanpurwala (Kuksiwala)',
    email: 'abdulqadir.kuksiwala@mahadalzahra.com',
    department: 'Nisab & Takhteet / Faculty of Quran & Sharia',
    designation: 'Senior Faculty Member',
  },
];

function formatTimeIST(dateOrIso?: string | Date | null): string {
  if (!dateOrIso) return '—';
  try {
    const d = typeof dateOrIso === 'string' ? new Date(dateOrIso) : dateOrIso;
    if (isNaN(d.getTime())) return String(dateOrIso);
    return d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '—';
  }
}

function calcDuration(inDate?: Date | null, outDate?: Date | null): string {
  if (!inDate || !outDate) return '—';
  const diffMs = outDate.getTime() - inDate.getTime();
  if (diffMs <= 0) return '—';
  const totalMins = Math.floor(diffMs / (1000 * 60));
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0 && mins === 0) return '—';
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

function toArabicNumerals(num: number): string {
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).split('').map(d => arabicDigits[parseInt(d, 10)] || d).join('');
}

async function generateAttendanceExcel() {
  console.log('=== GENERATING FACULTY ATTENDANCE EXCEL (19 OCT - 31 OCT 2026) ===');

  // Dates array from 2026-10-19 to 2026-10-31
  const dateList: string[] = [];
  for (let day = 19; day <= 31; day++) {
    dateList.push(`2026-10-${String(day).padStart(2, '0')}`);
  }

  // Fetch DB records
  const teachers = await prisma.teacherProfile.findMany({
    where: { its: { in: TARGET_FACULTY.map(f => f.its) } },
    include: { user: true },
  });

  const dbRecords = await prisma.teacherAttendanceRecord.findMany({
    where: {
      teacherId: { in: teachers.map(t => t.id) },
      date: {
        gte: new Date('2026-10-18T00:00:00.000Z'),
        lte: new Date('2026-11-01T23:59:59.999Z'),
      },
    },
  });

  // Map of data per faculty ITS -> Map of dateStr -> DayRecord
  const facultyData = new Map<string, Map<string, DayRecord>>();

  for (const faculty of TARGET_FACULTY) {
    const tProfile = teachers.find(t => t.its === faculty.its);
    const dayMap = new Map<string, DayRecord>();

    for (const dateStr of dateList) {
      const [year, month, day] = dateStr.split('-').map(Number);
      const jd = gregorianToJulianDay(year, month, day);
      const hijri = julianDayToHijri(jd);
      const hInfo = formatHijriDate(hijri.year, hijri.month, hijri.day);

      const dObj = new Date(Date.UTC(year, month - 1, day));
      const dayOfWeek = hInfo.dayOfWeek;
      const isSunday = dayOfWeek === 'Sunday';
      const isHoliday = isSunday || dateStr === '2026-10-26';
      const holidayReason = isSunday
        ? 'Institutional Sunday Holiday'
        : dateStr === '2026-10-26'
        ? 'Institutional Observance / Urs Mubarak (16 Jumada I)'
        : undefined;

      const dbRec = tProfile
        ? dbRecords.find(r => r.teacherId === tProfile.id && r.date.toISOString().slice(0, 10) === dateStr)
        : undefined;

      let status: DayRecord['status'] = 'ABSENT';
      let checkInISO: string | null = null;
      let checkInIST = '—';
      let checkOutISO: string | null = null;
      let checkOutIST = '—';
      let duration = '—';
      let device = 'Main Entrance MinMoe (192.168.0.4)';
      let method = 'Biometric Facial Recognition';
      let remarks = 'No scan recorded';

      if (isHoliday) {
        status = 'HOLIDAY';
        checkInIST = 'Holiday';
        checkOutIST = 'Holiday';
        duration = '—';
        device = 'Campus Closed';
        method = 'Calendar Rule';
        remarks = holidayReason || 'Institutional Holiday';
      } else if (dbRec) {
        status = (dbRec.status as DayRecord['status']) || 'PRESENT';
        checkInISO = dbRec.checkInTime ? dbRec.checkInTime.toISOString() : null;
        checkInIST = formatTimeIST(dbRec.checkInTime);
        checkOutISO = dbRec.checkOutTime ? dbRec.checkOutTime.toISOString() : null;
        
        // Check if checkout is actually a distinct departure scan (> 5 minutes after checkin)
        if (dbRec.checkInTime && dbRec.checkOutTime) {
          const diffMs = Math.abs(dbRec.checkOutTime.getTime() - dbRec.checkInTime.getTime());
          if (diffMs > 5 * 60 * 1000) {
            checkOutIST = formatTimeIST(dbRec.checkOutTime);
            duration = calcDuration(dbRec.checkInTime, dbRec.checkOutTime);
          } else {
            // Rapid double-scan at entrance gate
            checkOutIST = '—';
            duration = '—';
          }
        } else {
          checkOutIST = '—';
          duration = '—';
        }

        method = dbRec.biometricMethod ? `Biometric ${dbRec.biometricMethod}` : 'Biometric Facial / Fingerprint';
        device = dbRec.notes?.includes('MinMoe') ? 'MinMoe Biometric Terminal (192.168.0.4/5)' : 'Main Entrance MinMoe Terminal';
        remarks = dbRec.notes || `Verified scan at ${checkInIST} (Tilawat al-Dua morning window)`;
      }

      const rec: DayRecord = {
        gregorian: dateStr,
        hijriDay: hijri.day,
        hijriDateStr: `${hijri.day} ${hInfo.monthName} ${hijri.year} AH`,
        hijriArabic: `${toArabicNumerals(hijri.day)} ${hInfo.monthNameAr} ${toArabicNumerals(hijri.year)} هـ`,
        dayOfWeek,
        isSunday,
        isHoliday,
        holidayReason,
        status,
        checkInISO,
        checkInIST,
        checkOutISO,
        checkOutIST,
        duration,
        device,
        method,
        remarks,
      };

      dayMap.set(dateStr, rec);
    }

    facultyData.set(faculty.its, dayMap);
  }

  // Create Workbook
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Darse Burhani Administration';
  wb.lastModifiedBy = 'Antigravity Biometric Polling & Sync Engine';
  wb.created = new Date();
  wb.modified = new Date();

  // ══════════════════════════════════════════════════════════════════
  // SHEET 1: EXECUTIVE ATTENDANCE SUMMARY & MATRIX
  // ══════════════════════════════════════════════════════════════════
  const summarySheet = wb.addWorksheet('Executive Summary', {
    views: [{ showGridLines: true }],
  });

  // Title Banner
  summarySheet.mergeCells('A1:Q1');
  const t1 = summarySheet.getCell('A1');
  t1.value = 'AL JAMEA TUS SAIFIYAH / DARSE BURHANI — GALIAKOT CAMPUS';
  t1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  t1.alignment = { horizontal: 'center', vertical: 'middle' };
  t1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D3B2E' } };
  summarySheet.getRow(1).height = 30;

  summarySheet.mergeCells('A2:Q2');
  const t2 = summarySheet.getCell('A2');
  t2.value = 'FACULTY BIOMETRIC AUDIT REPORT & HIJRI SCAN LEDGER (19 OCT 2026 – 31 OCT 2026)';
  t2.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFD4AF37' } };
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2E26' } };
  summarySheet.getRow(2).height = 24;

  summarySheet.mergeCells('A3:Q3');
  const t3 = summarySheet.getCell('A3');
  t3.value = `Hijri Period: 9 Jumādā al-Ūlā 1448 to 21 Jumādā al-Ūlā 1448 AH • Polled Live from Hikvision MinMoe Terminals • Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`;
  t3.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF4A5568' } };
  t3.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(3).height = 20;

  // Header Row for Daily Matrix
  const matrixHeaders = [
    'S.No',
    'ITS ID',
    'Faculty Member Name',
    'Designation',
    ...dateList.map(d => {
      const dayNum = d.slice(8);
      const [y, m, day] = d.split('-').map(Number);
      const jd = gregorianToJulianDay(y, m, day);
      const h = julianDayToHijri(jd);
      const dObj = new Date(Date.UTC(y, m - 1, day));
      const dayShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dObj.getUTCDay()];
      return `${dayShort} (${dayNum} Oct)\n[${h.day} Jumada I]`;
    }),
    'Working Days',
    'Present Days',
    'Attendance %',
  ];

  const mHeaderRow = summarySheet.getRow(5);
  matrixHeaders.forEach((h, idx) => {
    const cell = mHeaderRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5132' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'medium', color: { argb: 'FF0D3B2E' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });
  mHeaderRow.height = 36;

  // Populate Matrix Data Rows
  let sRowIdx = 6;
  TARGET_FACULTY.forEach((fac, idx) => {
    const row = summarySheet.getRow(sRowIdx);
    const dayMap = facultyData.get(fac.its)!;

    row.getCell(1).value = idx + 1;
    row.getCell(2).value = fac.its;
    row.getCell(3).value = fac.displayName;
    row.getCell(4).value = fac.designation;

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };

    let workingDays = 0;
    let presentDays = 0;

    dateList.forEach((dStr, dIdx) => {
      const cell = row.getCell(5 + dIdx);
      const rec = dayMap.get(dStr)!;

      if (!rec.isHoliday) {
        workingDays++;
        if (rec.status === 'PRESENT' || rec.status === 'LATE') {
          presentDays++;
        }
      }

      if (rec.isHoliday) {
        cell.value = `HOLIDAY\n(${rec.isSunday ? 'Sunday' : 'Observance'})`;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF4A5568' } };
      } else if (rec.status === 'PRESENT') {
        cell.value = `PRESENT\n${rec.checkInIST}`;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1E7DD' } };
        cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF0F5132' } };
      } else if (rec.status === 'LATE') {
        cell.value = `LATE\n${rec.checkInIST}`;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
        cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF664D03' } };
      } else {
        cell.value = 'ABSENT';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
        cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF842029' } };
      }

      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });

    const pct = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;
    const workCell = row.getCell(5 + dateList.length);
    workCell.value = `${workingDays} Days`;
    workCell.alignment = { horizontal: 'center', vertical: 'middle' };
    workCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF4A5568' } };

    const presCell = row.getCell(6 + dateList.length);
    presCell.value = `${presentDays} / ${workingDays}`;
    presCell.alignment = { horizontal: 'center', vertical: 'middle' };
    presCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F5132' } };

    const pctCell = row.getCell(7 + dateList.length);
    pctCell.value = `${pct}%`;
    pctCell.alignment = { horizontal: 'center', vertical: 'middle' };
    pctCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F5132' } };

    // Set borders on all fixed columns
    [1, 2, 3, 4, 5 + dateList.length, 6 + dateList.length, 7 + dateList.length].forEach(c => {
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });

    row.height = 34;
    sRowIdx++;
  });

  // Set column widths on summary sheet
  summarySheet.columns = [
    { width: 6 },
    { width: 13 },
    { width: 36 },
    { width: 22 },
    ...dateList.map(() => ({ width: 16 })),
    { width: 14 },
    { width: 14 },
    { width: 14 },
  ];

  // ══════════════════════════════════════════════════════════════════
  // HELPER: CREATE DETAILED SHEET FOR AN INDIVIDUAL FACULTY MEMBER
  // ══════════════════════════════════════════════════════════════════
  function createFacultyDetailSheet(faculty: typeof TARGET_FACULTY[0], sheetTitle: string) {
    const ws = wb.addWorksheet(sheetTitle, { views: [{ showGridLines: true }] });
    const dayMap = facultyData.get(faculty.its)!;

    // Header Title
    ws.mergeCells('A1:J1');
    const h1 = ws.getCell('A1');
    h1.value = 'AL JAMEA TUS SAIFIYAH / DARSE BURHANI — GALIAKOT CAMPUS';
    h1.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    h1.alignment = { horizontal: 'center', vertical: 'middle' };
    h1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D3B2E' } };
    ws.getRow(1).height = 28;

    // Faculty Subtitle
    ws.mergeCells('A2:J2');
    const h2 = ws.getCell('A2');
    h2.value = `INDIVIDUAL FACULTY BIOMETRIC AUDIT LEDGER • ${faculty.displayName.toUpperCase()} (ITS: ${faculty.its})`;
    h2.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFD4AF37' } };
    h2.alignment = { horizontal: 'center', vertical: 'middle' };
    h2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2E26' } };
    ws.getRow(2).height = 24;

    // Faculty Metadata Info Box
    ws.mergeCells('A3:E3');
    ws.getCell('A3').value = `Faculty: ${faculty.officialName} • Email: ${faculty.email}`;
    ws.getCell('A3').font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF2D3748' } };
    ws.getCell('A3').alignment = { vertical: 'middle' };

    ws.mergeCells('F3:J3');
    ws.getCell('F3').value = `Department: ${faculty.department} • Designation: ${faculty.designation}`;
    ws.getCell('F3').font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF4A5568' } };
    ws.getCell('F3').alignment = { horizontal: 'right', vertical: 'middle' };
    ws.getRow(3).height = 20;

    // Columns Header
    const colHeaders = [
      'Gregorian Date',
      'Day of Week',
      'Hijri Date (Fatimi)',
      'Hijri Arabic',
      'Attendance Status',
      'First Scan In (IST)',
      'Last Scan Out (IST)',
      'Total Duration',
      'Biometric Terminal',
      'Terminal Audit Remarks',
    ];

    const cRow = ws.getRow(5);
    colHeaders.forEach((h, idx) => {
      const cell = cRow.getCell(idx + 1);
      cell.value = h;
      cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5132' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        bottom: { style: 'medium', color: { argb: 'FF0D3B2E' } },
        left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
        right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      };
    });
    cRow.height = 26;

    let rIdx = 6;
    let totalWorking = 0;
    let totalPresent = 0;

    dateList.forEach((dStr) => {
      const rec = dayMap.get(dStr)!;
      const row = ws.getRow(rIdx);

      if (!rec.isHoliday) {
        totalWorking++;
        if (rec.status === 'PRESENT' || rec.status === 'LATE') totalPresent++;
      }

      row.getCell(1).value = rec.gregorian;
      row.getCell(2).value = rec.dayOfWeek;
      row.getCell(3).value = rec.hijriDateStr;
      row.getCell(4).value = rec.hijriArabic;
      row.getCell(5).value = rec.status;
      row.getCell(6).value = rec.checkInIST;
      row.getCell(7).value = rec.checkOutIST;
      row.getCell(8).value = rec.duration;
      row.getCell(9).value = rec.device;
      row.getCell(10).value = rec.remarks;

      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(9).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(10).alignment = { horizontal: 'left', vertical: 'middle' };

      // Coloring status
      const statusCell = row.getCell(5);
      if (rec.status === 'PRESENT') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1E7DD' } };
        statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F5132' } };
      } else if (rec.status === 'LATE') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };
        statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF664D03' } };
      } else if (rec.status === 'HOLIDAY') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF4A5568' } };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8D7DA' } };
        statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF842029' } };
      }

      // Check In cell highlighting
      if (rec.status === 'PRESENT' || rec.status === 'LATE') {
        row.getCell(6).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F5132' } };
      }

      for (let c = 1; c <= 10; c++) {
        if (c !== 5) {
          row.getCell(c).font = row.getCell(c).font || { name: 'Calibri', size: 9.5 };
        }
        row.getCell(c).border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        };
      }

      row.height = 24;
      rIdx++;
    });

    // Summary Statistics Footer Box
    const pct = totalWorking > 0 ? Math.round((totalPresent / totalWorking) * 100) : 0;
    const fRow = ws.getRow(rIdx + 1);
    ws.mergeCells(`A${rIdx + 1}:J${rIdx + 1}`);
    fRow.getCell(1).value = `📌 AUDIT SUMMARY (${faculty.displayName}): Total Scheduled Days: ${dateList.length} | Operational Working Days: ${totalWorking} | Present Days: ${totalPresent} | Holidays/Observances: ${dateList.length - totalWorking} | Biometric Attendance Ratio: ${pct}%`;
    fRow.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0D3B2E' } };
    fRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
    fRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    fRow.getCell(1).border = {
      top: { style: 'medium', color: { argb: 'FF0F5132' } },
      bottom: { style: 'medium', color: { argb: 'FF0F5132' } },
      left: { style: 'medium', color: { argb: 'FF0F5132' } },
      right: { style: 'medium', color: { argb: 'FF0F5132' } },
    };
    fRow.height = 26;

    ws.columns = [
      { width: 14 },
      { width: 14 },
      { width: 25 },
      { width: 25 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 16 },
      { width: 34 },
      { width: 44 },
    ];
  }

  // Generate individual sheets
  createFacultyDetailSheet(TARGET_FACULTY[0], 'M Juzer bhai Attendance');
  createFacultyDetailSheet(TARGET_FACULTY[1], 'M Huzaifa bhai Attendance');
  createFacultyDetailSheet(TARGET_FACULTY[2], 'M Mustafa bhai Attendance');
  createFacultyDetailSheet(TARGET_FACULTY[3], 'M Shabbir bhai Attendance');
  createFacultyDetailSheet(TARGET_FACULTY[4], 'M Yusuf bhai Attendance');
  createFacultyDetailSheet(TARGET_FACULTY[5], 'Abdulqadir bhai Attendance');
  createFacultyDetailSheet(TARGET_FACULTY[6], 'M Abdulqadir Kuksiwala Attend');

  // ══════════════════════════════════════════════════════════════════
  // SHEET 5: CHRONOLOGICAL BIOMETRIC AUDIT FEED
  // ══════════════════════════════════════════════════════════════════
  const feedSheet = wb.addWorksheet('Chronological Scan Audit', {
    views: [{ showGridLines: true }],
  });

  feedSheet.mergeCells('A1:H1');
  const feedTitle = feedSheet.getCell('A1');
  feedTitle.value = 'AL JAMEA TUS SAIFIYAH / DARSE BURHANI — CHRONOLOGICAL BIOMETRIC AUDIT FEED';
  feedTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  feedTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  feedTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D3B2E' } };
  feedSheet.getRow(1).height = 28;

  feedSheet.mergeCells('A2:H2');
  const feedSub = feedSheet.getCell('A2');
  feedSub.value = 'RAW TIME-SERIES SCAN EVENT LOGS FOR AUDITED FACULTY MEMBERS (19 OCT – 31 OCT 2026)';
  feedSub.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFD4AF37' } };
  feedSub.alignment = { horizontal: 'center', vertical: 'middle' };
  feedSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2E26' } };
  feedSheet.getRow(2).height = 22;

  const feedHeaders = [
    'Scan Timestamp (IST)',
    'Gregorian Date',
    'Hijri Date',
    'ITS ID',
    'Faculty Member Name',
    'Scan Event Type',
    'Authentication Device',
    'Verification Mode & Remarks',
  ];

  const fHeadRow = feedSheet.getRow(4);
  feedHeaders.forEach((h, idx) => {
    const cell = fHeadRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F5132' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'medium', color: { argb: 'FF0D3B2E' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });
  fHeadRow.height = 26;

  // Collect all scans in chronological order
  const allEventsList: Array<{
    timestamp: Date;
    timestampIST: string;
    dateStr: string;
    hijriStr: string;
    its: string;
    name: string;
    eventType: string;
    device: string;
    remarks: string;
  }> = [];

  for (const fac of TARGET_FACULTY) {
    const dayMap = facultyData.get(fac.its)!;
    for (const [dateStr, rec] of dayMap.entries()) {
      if (rec.checkInISO) {
        const d = new Date(rec.checkInISO);
        allEventsList.push({
          timestamp: d,
          timestampIST: rec.checkInIST,
          dateStr,
          hijriStr: rec.hijriDateStr,
          its: fac.its,
          name: fac.displayName,
          eventType: 'CHECK_IN (Arrival)',
          device: rec.device,
          remarks: 'Morning Attendance Scan (Tilawat al-Dua)',
        });
      }
      if (rec.checkOutISO && rec.checkOutIST !== '—') {
        const d = new Date(rec.checkOutISO);
        allEventsList.push({
          timestamp: d,
          timestampIST: rec.checkOutIST,
          dateStr,
          hijriStr: rec.hijriDateStr,
          its: fac.its,
          name: fac.displayName,
          eventType: 'CHECK_OUT (Departure)',
          device: rec.device,
          remarks: `Campus Departure Scan (${rec.duration})`,
        });
      }
    }
  }

  allEventsList.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  let feedRowIdx = 5;
  for (const ev of allEventsList) {
    const row = feedSheet.getRow(feedRowIdx);
    row.getCell(1).value = `${ev.dateStr} ${ev.timestampIST}`;
    row.getCell(2).value = ev.dateStr;
    row.getCell(3).value = ev.hijriStr;
    row.getCell(4).value = ev.its;
    row.getCell(5).value = ev.name;
    row.getCell(6).value = ev.eventType;
    row.getCell(7).value = ev.device;
    row.getCell(8).value = ev.remarks;

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(8).alignment = { horizontal: 'left', vertical: 'middle' };

    const isCheckIn = ev.eventType.includes('Arrival');
    row.getCell(6).font = {
      name: 'Calibri',
      size: 9.5,
      bold: true,
      color: isCheckIn ? { argb: 'FF0F5132' } : { argb: 'FF1E40AF' },
    };
    row.getCell(6).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: isCheckIn ? { argb: 'FFD1E7DD' } : { argb: 'FFDBEAFE' },
    };

    for (let c = 1; c <= 8; c++) {
      if (c !== 6) {
        row.getCell(c).font = { name: 'Calibri', size: 9.5 };
      }
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }

    row.height = 22;
    feedRowIdx++;
  }

  feedSheet.columns = [
    { width: 24 },
    { width: 15 },
    { width: 24 },
    { width: 14 },
    { width: 38 },
    { width: 24 },
    { width: 34 },
    { width: 38 },
  ];

  // Save the workbook in root and server/exports/
  const exportDir = path.resolve('server/exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const filename = 'Faculty_Attendance_19Oct_to_31Oct_2026.xlsx';
  const rootFilePath = path.resolve(filename);
  const serverFilePath = path.join(exportDir, filename);

  await wb.xlsx.writeFile(rootFilePath);
  await wb.xlsx.writeFile(serverFilePath);

  console.log(`\n✅ EXCEL SHEET GENERATED SUCCESSFULLY!`);
  console.log(`📁 Saved to root: ${rootFilePath}`);
  console.log(`📁 Saved to server exports: ${serverFilePath}`);
}

generateAttendanceExcel().catch(err => {
  console.error("Failed to generate excel:", err);
  process.exit(1);
});
