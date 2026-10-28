import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('.env') });

import prisma from '../lib/prisma';

export const FACULTY_MEMBERS = [
  {
    its: '30434547',
    name: 'Mulla Juzer bhai Abbas bhai Bundiwala',
    requestedName: 'M Juzer bhai Abbas bhai Bundiwala',
    email: 'juzer.kota@mahadalzahra.com',
    teacherId: 'cmv9fpaix00116cttigfqv0fn',
  },
  {
    its: '30351321',
    name: 'Mulla Huzaifa bhai Alimohammed bhai Mehmoodjiwala',
    requestedName: 'M Huzaifa bhai Alimohammed bhai Mehmoodjee',
    email: 'huzaifa.mehmoodjiwala@mahadalzahra.com',
    teacherId: 'cmv9fpai6000d6cttbrazqkx9',
  },
  {
    its: '60414938',
    name: 'Mulla Mustafa bhai Mulla Shabbir bhai Bharmal',
    requestedName: 'M Mustafa bhai Bharmal',
    email: 'mustafa.bharmal@mahadalzahra.com',
    teacherId: 'cmv9fpal0002p6ctt9p392v7y',
  },
  {
    its: '30705954',
    name: 'Mulla Shabbir bhai Mustafa bhai Hyderabadwala',
    requestedName: 'M Shabbir bhai Mustafa bhai Hydrabad wala',
    email: 'shabbir.hydrabadwala@mahadalzahra.com',
    teacherId: 'cmv9fpajq001p6ctth36j2z07',
  },
  {
    its: '30496517',
    name: 'Mulla Yusuf bhai Nooruddin bhai Chikly',
    requestedName: 'M Yusuf bhai Nooruddin bhai Chikli',
    email: 'yusuf.chikli@mahadalzahra.com',
    teacherId: 'cmv9fpajl001l6cttb22cf1vh',
  },
  {
    its: '30394809',
    name: 'Abdulqadir bhai Yusuf bhai Chay wala',
    requestedName: 'Abdulqadir bhai Yusuf bhai Chay wala',
    email: 'abdulqadir.chaywala@mahadalzahra.com',
    teacherId: 'cmv9fpair000v6ctt1olb126x',
  },
  {
    its: '30390267',
    name: 'Mulla Abdulqadir bhai Qaidjoher bhai Nanpurwala (Kuksiwala)',
    requestedName: 'M Abdulqadir bhai Qaidjoher bhai Kuksiwala',
    email: 'abdulqadir.kuksiwala@mahadalzahra.com',
    teacherId: 'cmv9fpaim000r6cttl83r88zs',
  },
  {
    its: '50480081',
    name: 'Mulla Moiz bhai Qutbuddin bhai Nihal',
    requestedName: 'M Moiz bhai Qutbuddin bhai Nihal',
    email: 'moiz.nihal@mahadalzahra.com',
    teacherId: 'cmv9fpakq002h6cttj6cp62gr',
  },
  {
    its: '40462129',
    name: 'Mulla Mohammed bhai Mustafa bhai Saify',
    requestedName: 'M Mohammed bhai Mustafa bhai Saifee',
    email: 'mohammed.saify@mahadalzahra.com',
    teacherId: 'cmv9fpakc00256cttdo0oani0',
  },
  {
    its: '30702162',
    name: 'Mulla Husain bhai Mustafa bhai Kherodawala',
    requestedName: 'M Husain bhai Mustafa bhai Kherodawala',
    email: 'husain.kherodawala@mahadalzahra.com',
    teacherId: 'cmv9fpajn001n6ctt8yrqroqm',
  },
  {
    its: '30381831',
    name: 'Mustafa bhai Khuzaima bhai Bangrodwala',
    requestedName: 'Mustafa bhai Khuzaima bhai bangrodwala',
    email: 'mustafa.bangrodwala@mahadalzahra.com',
    teacherId: 'cmv9fpaid000j6cttd95j942q',
  },
];

export const DATES = [
  { dateStr: '2026-10-19', dayName: 'Monday' },
  { dateStr: '2026-10-20', dayName: 'Tuesday' },
  { dateStr: '2026-10-21', dayName: 'Wednesday' },
  { dateStr: '2026-10-22', dayName: 'Thursday' },
  { dateStr: '2026-10-23', dayName: 'Friday' },
  { dateStr: '2026-10-24', dayName: 'Saturday' },
];

function formatTimeIST(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return isoStr;
  }
}

export async function generateFacultyExcel(): Promise<string> {
  const logDir = path.resolve('server/logs/attendance');

  const dbRecords = await prisma.teacherAttendanceRecord.findMany({
    where: {
      date: {
        gte: new Date('2026-10-19T00:00:00.000Z'),
        lte: new Date('2026-10-24T23:59:59.999Z'),
      },
    },
    include: {
      teacher: {
        include: { user: true },
      },
    },
  });

  const matrix: Record<string, any> = {};
  const detailedLogs: any[] = [];

  for (const { dateStr, dayName } of DATES) {
    const logFile = path.join(logDir, `${dateStr}.jsonl`);
    const dayPunches = new Map<string, any>();

    if (fs.existsSync(logFile)) {
      const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line);
          const its = ev.its || ev.fingerprint || ev.personId || ev.employeeId || ev.studentId;
          if (its && FACULTY_MEMBERS.some((f) => f.its === String(its))) {
            const itsStr = String(its);
            const prev = dayPunches.get(itsStr);
            if (!prev) {
              dayPunches.set(itsStr, ev);
            } else if (ev.status === 'PRESENT' || ev.outcome === 'MATCHED') {
              dayPunches.set(itsStr, ev);
            }
          }
        } catch {}
      }
    }

    for (const member of FACULTY_MEMBERS) {
      const dbRec = dbRecords.find(
        (r) =>
          r.teacher?.employeeId === member.its &&
          r.date.toISOString().split('T')[0] === dateStr
      );
      const logRec = dayPunches.get(member.its);

      let status = 'ABSENT';
      let checkInTime: string | null = null;
      let checkInIST = '—';
      let verifyMode = '—';
      let device = '—';
      let outcome = 'NO_PUNCH';
      let remarks = 'No scan recorded on terminal';

      if (logRec) {
        checkInTime = logRec.timestamp || logRec.checkInTime || logRec.time;
        checkInIST = logRec.checkInIST || formatTimeIST(checkInTime);
        verifyMode = logRec.verifyMode || logRec.biometricMethod || 'BIOMETRIC';
        device = logRec.deviceId || 'hikvision:192.168.0.4';
        outcome = logRec.outcome || 'MATCHED';
        status = logRec.status || (dbRec ? dbRec.status : 'PRESENT');
        remarks = logRec.message || 'Scanned via biometric terminal';
      } else if (dbRec) {
        checkInTime = dbRec.checkInTime ? dbRec.checkInTime.toISOString() : null;
        checkInIST = formatTimeIST(checkInTime);
        verifyMode = dbRec.biometricMethod || 'BIOMETRIC';
        status = dbRec.status || 'PRESENT';
        outcome = 'DB_RECORD';
        device = 'Main Terminal (192.168.0.4)';
        remarks = dbRec.remarks || 'Recorded in Faculty Attendance Register';
      }

      if (status === 'PRESENT' && checkInIST === '—' && checkInTime) {
        checkInIST = formatTimeIST(checkInTime);
      }

      const rec = {
        date: dateStr,
        dayName,
        its: member.its,
        name: member.name,
        requestedName: member.requestedName,
        email: member.email,
        status,
        checkInTime,
        checkInIST,
        verifyMode,
        device,
        outcome,
        remarks,
        window: 'Tilawat al Dua (07:00 - 12:30 IST)',
      };

      matrix[`${member.its}_${dateStr}`] = rec;
      detailedLogs.push(rec);
    }
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Darse Burhani Administration';
  workbook.lastModifiedBy = 'Antigravity Biometric Sync System';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Summary Sheet
  const summarySheet = workbook.addWorksheet('Attendance Summary', {
    views: [{ showGridLines: true }],
  });

  summarySheet.mergeCells('A1:L1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = 'AL JAMEA TUS SAIFIYAH / DARSE BURHANI — GALIAKOT';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0D3B2E' },
  };
  summarySheet.getRow(1).height = 28;

  summarySheet.mergeCells('A2:L2');
  const subTitleCell = summarySheet.getCell('A2');
  subTitleCell.value = 'FACULTY BIOMETRIC ATTENDANCE AUDIT REPORT: 19 OCT 2026 TO 24 OCT 2026';
  subTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFD4AF37' } };
  subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  subTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1A2E26' },
  };
  summarySheet.getRow(2).height = 22;

  summarySheet.mergeCells('A3:L3');
  const metaCell = summarySheet.getCell('A3');
  metaCell.value = `Audited Strength: 11 Members • Window: Tilawat al Dua (07:00 - 12:30 IST) • Polled on ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} IST`;
  metaCell.font = { name: 'Calibri', size: 9.5, italic: true, color: { argb: 'FF4A5568' } };
  metaCell.alignment = { horizontal: 'center', vertical: 'middle' };
  summarySheet.getRow(3).height = 18;

  const headers = [
    'S.No',
    'ITS ID',
    'Faculty Member Name',
    'Email Address',
    'Mon (19 Oct)',
    'Tue (20 Oct)',
    'Wed (21 Oct)',
    'Thu (22 Oct)',
    'Fri (23 Oct)',
    'Sat (24 Oct)',
    'Present Days',
    'Attendance %',
  ];

  const headerRow = summarySheet.getRow(5);
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F5132' },
    };
    cell.alignment = { horizontal: idx >= 4 ? 'center' : 'left', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'medium', color: { argb: 'FF0D3B2E' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });
  headerRow.height = 26;

  let rowIdx = 6;
  FACULTY_MEMBERS.forEach((member, mIdx) => {
    let presentCount = 0;
    const row = summarySheet.getRow(rowIdx);

    row.getCell(1).value = mIdx + 1;
    row.getCell(2).value = member.its;
    row.getCell(3).value = member.name;
    row.getCell(4).value = member.email;

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };

    DATES.forEach((d, dIdx) => {
      const cell = row.getCell(5 + dIdx);
      const rec = matrix[`${member.its}_${d.dateStr}`];
      const isPresent = rec?.status === 'PRESENT';
      if (isPresent) presentCount++;

      const isLate = rec?.status === 'LATE';

      cell.value = isPresent
        ? `PRESENT\n(${rec.checkInIST})`
        : isLate
        ? `LATE\n(${rec.checkInIST})`
        : 'ABSENT';

      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

      if (isPresent) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD1E7DD' },
        };
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F5132' } };
      } else if (isLate) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF3CD' },
        };
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF664D03' } };
      } else {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8D7DA' },
        };
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF842029' } };
      }

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });

    const pct = Math.round((presentCount / DATES.length) * 100);
    const presentCountCell = row.getCell(11);
    presentCountCell.value = `${presentCount} / ${DATES.length}`;
    presentCountCell.alignment = { horizontal: 'center', vertical: 'middle' };
    presentCountCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F5132' } };

    const pctCell = row.getCell(12);
    pctCell.value = `${pct}%`;
    pctCell.alignment = { horizontal: 'center', vertical: 'middle' };
    pctCell.font = { name: 'Calibri', size: 10, bold: true, color: pct >= 80 ? { argb: 'FF0F5132' } : { argb: 'FFD97706' } };

    [1, 2, 3, 4, 11, 12].forEach((cIdx) => {
      const cell = row.getCell(cIdx);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });

    row.height = 30;
    rowIdx++;
  });

  summarySheet.columns = [
    { width: 7 },
    { width: 13 },
    { width: 38 },
    { width: 32 },
    { width: 17 },
    { width: 17 },
    { width: 17 },
    { width: 17 },
    { width: 17 },
    { width: 17 },
    { width: 15 },
    { width: 15 },
  ];

  // Detailed Day-by-Day Logs Sheet
  const detailSheet = workbook.addWorksheet('Detailed Day-by-Day Logs', {
    views: [{ showGridLines: true }],
  });

  detailSheet.mergeCells('A1:J1');
  const dTitleCell = detailSheet.getCell('A1');
  dTitleCell.value = 'DETAILED BIOMETRIC SCAN LOGS (19 OCT 2026 - 24 OCT 2026)';
  dTitleCell.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  dTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  dTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0D3B2E' },
  };
  detailSheet.getRow(1).height = 26;

  const detailHeaders = [
    'Date',
    'Day',
    'ITS ID',
    'Faculty Member Name',
    'Scheduled Window',
    'Exact Scan Time (IST)',
    'Status',
    'Mode',
    'Terminal Device',
    'Audit Remarks',
  ];

  const dHeaderRow = detailSheet.getRow(3);
  detailHeaders.forEach((h, idx) => {
    const cell = dHeaderRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F5132' },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      bottom: { style: 'medium', color: { argb: 'FF0D3B2E' } },
      left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
      right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    };
  });
  dHeaderRow.height = 24;

  let dRowIdx = 4;
  detailedLogs.forEach((log) => {
    const row = detailSheet.getRow(dRowIdx);
    row.getCell(1).value = log.date;
    row.getCell(2).value = log.dayName;
    row.getCell(3).value = log.its;
    row.getCell(4).value = log.name;
    row.getCell(5).value = log.window;
    row.getCell(6).value = log.checkInIST;
    row.getCell(7).value = log.status;
    row.getCell(8).value = log.verifyMode;
    row.getCell(9).value = log.device;
    row.getCell(10).value = log.remarks;

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(10).alignment = { horizontal: 'left', vertical: 'middle' };

    const statusCell = row.getCell(7);
    if (log.status === 'PRESENT') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD1E7DD' },
      };
      statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F5132' } };
    } else if (log.status === 'LATE') {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFF3CD' },
      };
      statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF664D03' } };
    } else {
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8D7DA' },
      };
      statusCell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF842029' } };
    }

    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    }

    row.height = 20;
    dRowIdx++;
  });

  detailSheet.columns = [
    { width: 14 },
    { width: 12 },
    { width: 13 },
    { width: 38 },
    { width: 30 },
    { width: 22 },
    { width: 14 },
    { width: 16 },
    { width: 26 },
    { width: 44 },
  ];

  const exportDir = path.resolve('server/exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const exportPath = path.join(exportDir, 'Faculty_Attendance_19Oct_to_24Oct_2026.xlsx');
  await workbook.xlsx.writeFile(exportPath);
  return exportPath;
}

if (process.argv[1] && process.argv[1].includes('export-faculty-oct-excel')) {
  generateFacultyExcel()
    .then((p) => {
      console.log('Exported to', p);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
