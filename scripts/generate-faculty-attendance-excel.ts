import { createHash, createDecipheriv } from "node:crypto";
import path from "node:path";
import { PrismaClient, AttendanceStatus } from "@prisma/client";
import ExcelJS from "exceljs";

const prisma = new PrismaClient();
const ALGO = "aes-256-gcm";

function encKey() {
  const secret = process.env.NEXTAUTH_SECRET ?? "dev-biometric-secret";
  return createHash("sha256").update(secret).digest();
}

function decryptPassword(enc: string | null, iv: string | null) {
  if (!enc || !iv) return process.env.HIKVISION_PASSWORD || "DARSEBURHANI5253";
  try {
    const buf = Buffer.from(enc, "base64");
    const tag = buf.subarray(buf.length - 16);
    const data = buf.subarray(0, buf.length - 16);
    const decipher = createDecipheriv(ALGO, encKey(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return process.env.HIKVISION_PASSWORD || "DARSEBURHANI5253";
  }
}

function parseDigestHeader(header: string) {
  const params: Record<string, string> = {};
  const re = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
  let match;
  while ((match = re.exec(header)) !== null) {
    params[match[1]] = match[2] || match[3];
  }
  return params;
}

function md5(str: string) {
  return createHash("md5").update(str).digest("hex");
}

async function digestFetch(url: string, { method = "GET", username, password, body, headers = {}, timeoutMs = 12000 }: any) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const initial = await fetch(url, { method, headers, body, signal: controller.signal });
    if (initial.status !== 401) {
      clearTimeout(t);
      return initial;
    }
    const authHeader = initial.headers.get("www-authenticate") || "";
    if (!authHeader.toLowerCase().startsWith("digest")) {
      clearTimeout(t);
      return initial;
    }
    const chal = parseDigestHeader(authHeader.slice(7));
    const realm = chal.realm || "";
    const nonce = chal.nonce || "";
    const qop = chal.qop;
    const uri = new URL(url).pathname + new URL(url).search;
    const ha1 = md5(`${username}:${realm}:${password}`);
    const ha2 = md5(`${method}:${uri}`);
    let responseVal;
    let authStr = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}"`;

    if (qop) {
      const nc = "00000001";
      const cnonce = Math.random().toString(36).slice(2, 10);
      responseVal = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
      authStr += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${responseVal}"`;
    } else {
      responseVal = md5(`${ha1}:${nonce}:${ha2}`);
      authStr += `, response="${responseVal}"`;
    }
    if (chal.opaque) authStr += `, opaque="${chal.opaque}"`;

    const finalHeaders = { ...headers, Authorization: authStr };
    const authed = await fetch(url, { method, headers: finalHeaders, body, signal: controller.signal });
    clearTimeout(t);
    return authed;
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

// Exactly 11 faculty members as specified by the user
const facultyList = [
  { name: "M Juzer bhai Abbas bhai Bundiwala", its: "30434547" },
  { name: "M Huzaifa bhai Alimohammed bhai Mehmoodjee", its: "30351321" },
  { name: "M Mustafa bhai Bharmal", its: "60414938" },
  { name: "M Shabbir bhai Mustafa bhai Hydrabad wala", its: "30705954" },
  { name: "M Yusuf bhai Nooruddin bhai Chikli", its: "30496517" },
  { name: "Abdulqadir bhai Yusuf bhai Chay wala", its: "30394809" },
  { name: "M Abdulqadir bhai Qaidjoher bhai Kuksiwala", its: "30390267" },
  { name: "M Moiz bhai Qutbuddin bhai Nihal", its: "50480081" },
  { name: "M Mohammed bhai Mustafa bhai Saifee", its: "40462129" },
  { name: "M Husain bhai Mustafa bhai Kherodawala", its: "30702162" },
  { name: "Mustafa bhai Khuzaima bhai bangrodwala", its: "30381831" },
];

const dates = [
  { gregorian: "2026-10-11", hijriDay: 1, hijriStr: "1 Jumada al-Ula 1448", dayOfWeek: "Sunday", isWeekend: true },
  { gregorian: "2026-10-12", hijriDay: 2, hijriStr: "2 Jumada al-Ula 1448", dayOfWeek: "Monday", isWeekend: false },
  { gregorian: "2026-10-13", hijriDay: 3, hijriStr: "3 Jumada al-Ula 1448", dayOfWeek: "Tuesday", isWeekend: false },
  { gregorian: "2026-10-14", hijriDay: 4, hijriStr: "4 Jumada al-Ula 1448", dayOfWeek: "Wednesday", isWeekend: false },
  { gregorian: "2026-10-15", hijriDay: 5, hijriStr: "5 Jumada al-Ula 1448", dayOfWeek: "Thursday", isWeekend: false },
  { gregorian: "2026-10-16", hijriDay: 6, hijriStr: "6 Jumada al-Ula 1448", dayOfWeek: "Friday", isWeekend: false },
  { gregorian: "2026-10-17", hijriDay: 7, hijriStr: "7 Jumada al-Ula 1448", dayOfWeek: "Saturday", isWeekend: false },
  { gregorian: "2026-10-18", hijriDay: 8, hijriStr: "8 Jumada al-Ula 1448", dayOfWeek: "Sunday", isWeekend: true },
  { gregorian: "2026-10-19", hijriDay: 9, hijriStr: "9 Jumada al-Ula 1448", dayOfWeek: "Monday (Today)", isWeekend: false },
];

function formatTime12h(timeStr?: string | null) {
  if (!timeStr) return "—";
  // timeStr is like "07:29:51"
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const s = parts[2] || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${m}:${s} ${ampm}`;
}

function calculateDuration(inTime?: string | null, outTime?: string | null) {
  if (!inTime || !outTime || inTime === outTime) return "—";
  const [h1, m1, s1] = inTime.split(":").map(Number);
  const [h2, m2, s2] = outTime.split(":").map(Number);
  const sec1 = h1 * 3600 + m1 * 60 + (s1 || 0);
  const sec2 = h2 * 3600 + m2 * 60 + (s2 || 0);
  const diffSec = Math.max(0, sec2 - sec1);
  if (diffSec === 0) return "—";
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

async function main() {
  console.log("1. Connecting to database & biometric devices...");
  const devices = await prisma.biometricDevice.findMany({ where: { enabled: true } });
  const teachers = await prisma.teacherProfile.findMany({
    where: { its: { in: facultyList.map((f) => f.its) } },
    include: { user: true },
  });

  const teacherMapByIts = new Map(teachers.map((t) => [t.its!, t]));

  // Pull all events from hardware terminals
  const allEvents: Array<{ its: string; time: string; device: string }> = [];

  for (const f of facultyList) {
    for (const dev of devices) {
      const password = decryptPassword(dev.passwordEnc, dev.passwordIv);
      let pos = 0;
      let hasMore = true;

      while (hasMore) {
        const acsPayload = JSON.stringify({
          AcsEventCond: {
            searchID: `f-${f.its}-${Date.now()}`,
            searchResultPosition: pos,
            maxResults: 100,
            major: 0,
            minor: 0,
            startTime: "2026-10-11T00:00:00+05:30",
            endTime: "2026-10-19T23:59:59+05:30",
            employeeNoString: f.its,
          },
        });
        const res = await digestFetch(`http://${dev.host}:${dev.port}/ISAPI/AccessControl/AcsEvent?format=json`, {
          method: "POST",
          username: dev.username,
          password,
          body: acsPayload,
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        const list = data?.AcsEvent?.InfoList || [];
        for (const ev of list) {
          allEvents.push({
            its: f.its,
            time: ev.time,
            device: dev.name,
          });
        }
        if (list.length < 100) {
          hasMore = false;
        } else {
          pos += 100;
        }
      }
    }
  }

  console.log(`✓ Retrieved ${allEvents.length} raw biometric scans from terminals.`);

  // Map events by faculty and date
  const scansByFacultyDate = new Map<string, string[]>();
  for (const ev of allEvents) {
    const d = ev.time.slice(0, 10);
    const key = `${ev.its}_${d}`;
    if (!scansByFacultyDate.has(key)) {
      scansByFacultyDate.set(key, []);
    }
    scansByFacultyDate.get(key)!.push(ev.time);
  }

  // 2. Backfill / Sync to PostgreSQL database
  console.log("2. Updating Prisma database records...");
  for (const f of facultyList) {
    const tProfile = teacherMapByIts.get(f.its);
    if (!tProfile) continue;

    for (const dt of dates) {
      const dateObj = new Date(`${dt.gregorian}T00:00:00.000Z`);
      const times = scansByFacultyDate.get(`${f.its}_${dt.gregorian}`) || [];
      times.sort();

      let status: AttendanceStatus = AttendanceStatus.ABSENT;
      let checkInTime: Date | null = null;
      let checkOutTime: Date | null = null;

      if (times.length > 0) {
        checkInTime = new Date(times[0]);
        checkOutTime = times.length > 1 ? new Date(times[times.length - 1]) : new Date(times[0]);

        // Evaluate LATE vs PRESENT based on 07:30 cutoff in IST
        const firstTimeStr = times[0].slice(11, 19);
        const [h, m] = firstTimeStr.split(":").map(Number);
        const mins = h * 60 + m;
        // Normal faculty report: 07:00, Grace up to 07:30
        if (mins > 450) {
          status = AttendanceStatus.LATE;
        } else {
          status = AttendanceStatus.PRESENT;
        }
      } else if (dt.isWeekend) {
        // Leave weekend unmarked or skipped in DB, or marked as on leave/weekend
        status = AttendanceStatus.ABSENT;
      }

      // Check existing record
      const existing = await prisma.teacherAttendanceRecord.findFirst({
        where: {
          teacherId: tProfile.id,
          date: dateObj,
        },
      });

      if (times.length > 0) {
        if (existing) {
          await prisma.teacherAttendanceRecord.update({
            where: { id: existing.id },
            data: {
              status,
              checkInTime,
              checkOutTime,
              verificationMethod: "BIOMETRIC",
              biometricMethod: "FACIAL",
            },
          });
        } else {
          await prisma.teacherAttendanceRecord.create({
            data: {
              teacherId: tProfile.id,
              date: dateObj,
              status,
              checkInTime,
              checkOutTime,
              verificationMethod: "BIOMETRIC",
              biometricMethod: "FACIAL",
            },
          });
        }
      }
    }
  }
  console.log("✓ Database synchronized with hardware biometric scans.");

  // 3. Build Styled Excel Workbook
  console.log("3. Generating institutional Excel workbook with dynamic colors...");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Darse Burhani Administration";
  workbook.lastModifiedBy = "Antigravity Biometric Sync";
  workbook.created = new Date();
  workbook.modified = new Date();

  // Colors Palette
  const FATIMI_DARK_GREEN = "06241A";
  const FATIMI_EMERALD = "0A3D2C";
  const FATIMI_GOLD = "D4AF37";
  const FATIMI_AMBER = "F59E0B";

  // Status Styling Helpers
  const STATUS_STYLES: Record<string, { fill: string; font: string; border: string }> = {
    PRESENT: { fill: "D4EDDA", font: "155724", border: "C3E6CB" },   // Soft Emerald
    LATE: { fill: "FFF3CD", font: "856404", border: "FFEEBA" },      // Warm Amber
    ABSENT: { fill: "F8D7DA", font: "721C24", border: "F5C6CB" },    // Soft Rose
    WEEKEND: { fill: "E2E3E5", font: "383D41", border: "D6D8DB" },   // Elegant Slate
  };

  // ─────────────────────────────────────────────────────────────
  // SHEET 1: ATTENDANCE MATRIX (GRID VIEW)
  // ─────────────────────────────────────────────────────────────
  const wsMatrix = workbook.addWorksheet("Attendance Matrix", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 5, xSplit: 3 }],
  });

  // Title Banner
  wsMatrix.mergeCells("A1:N1");
  const titleCell = wsMatrix.getCell("A1");
  titleCell.value = "DARSE BURHANI – FACULTY BIOMETRIC ATTENDANCE MATRIX";
  titleCell.font = { name: "Segoe UI", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FATIMI_DARK_GREEN } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  wsMatrix.getRow(1).height = 40;

  // Subtitle Banner
  wsMatrix.mergeCells("A2:N2");
  const subCell = wsMatrix.getCell("A2");
  subCell.value = "Active Period: 1 Jumādā al-Ūlā 1448 H (11 Oct 2026) to 9 Jumādā al-Ūlā 1448 H (19 Oct 2026 - Today) • Real-time Facial Biometrics";
  subCell.font = { name: "Segoe UI", size: 10, italic: true, bold: true, color: { argb: "FFF59E0B" } };
  subCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FATIMI_EMERALD } };
  subCell.alignment = { horizontal: "center", vertical: "middle" };
  wsMatrix.getRow(2).height = 24;

  // Legend Row
  wsMatrix.mergeCells("A3:N3");
  const legCell = wsMatrix.getCell("A3");
  legCell.value = "LEGEND:   [ P ] PRESENT (On-Time)     [ L ] LATE (After 07:30 AM)     [ A ] ABSENT     [ W ] WEEKEND / OFF";
  legCell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF334155" } };
  legCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
  legCell.alignment = { horizontal: "center", vertical: "middle" };
  wsMatrix.getRow(3).height = 22;

  // Table Headers (Row 4: Hijri Dates & Days, Row 5: Column Labels)
  // Row 4 - Dates
  wsMatrix.getCell("A4").value = "FACULTY DETAILS";
  wsMatrix.mergeCells("A4:C4");
  wsMatrix.getCell("A4").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  wsMatrix.getCell("A4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: FATIMI_EMERALD } };
  wsMatrix.getCell("A4").alignment = { horizontal: "center", vertical: "middle" };

  dates.forEach((d, i) => {
    const colIdx = 4 + i;
    const cell = wsMatrix.getRow(4).getCell(colIdx);
    cell.value = `Day ${d.hijriDay} (${d.dayOfWeek.split(" ")[0].slice(0, 3)})`;
    cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: d.isWeekend ? "FFFFFFFF" : "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: d.isWeekend ? "FF475569" : FATIMI_EMERALD } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  wsMatrix.getCell("M4").value = "SUMMARY STATS";
  wsMatrix.mergeCells("M4:N4");
  wsMatrix.getCell("M4").font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
  wsMatrix.getCell("M4").fill = { type: "pattern", pattern: "solid", fgColor: { argb: FATIMI_EMERALD } };
  wsMatrix.getCell("M4").alignment = { horizontal: "center", vertical: "middle" };
  wsMatrix.getRow(4).height = 24;

  // Row 5 - Specific Columns
  const r5Headers = [
    "S.No",
    "Faculty Member Name",
    "ITS Number",
    ...dates.map((d) => d.gregorian.slice(5)), // MM-DD
    "Total Present",
    "Attendance %",
  ];

  const r5 = wsMatrix.getRow(5);
  r5Headers.forEach((h, i) => {
    const cell = r5.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF0F172A" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: FATIMI_GOLD } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
  r5.height = 26;

  // Fill Faculty Matrix Rows
  facultyList.forEach((f, fIdx) => {
    const rowNum = 6 + fIdx;
    const row = wsMatrix.getRow(rowNum);
    row.height = 28;

    row.getCell(1).value = fIdx + 1;
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

    row.getCell(2).value = f.name;
    row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    row.getCell(2).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF0F172A" } };

    row.getCell(3).value = f.its;
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(3).font = { name: "Segoe UI", size: 9, color: { argb: "FF475569" } };

    let presentDays = 0;
    const workingDaysCount = dates.filter((d) => !d.isWeekend).length; // 7 working days

    dates.forEach((d, dIdx) => {
      const colIdx = 4 + dIdx;
      const cell = row.getCell(colIdx);
      const times = scansByFacultyDate.get(`${f.its}_${d.gregorian}`) || [];
      times.sort();

      let code = "A";
      let styleKey = "ABSENT";

      if (times.length > 0) {
        presentDays++;
        const firstTimeStr = times[0].slice(11, 16);
        const [h, m] = times[0].slice(11, 19).split(":").map(Number);
        const mins = h * 60 + m;

        if (d.isWeekend) {
          code = `P (${firstTimeStr})`;
          styleKey = "PRESENT";
        } else if (mins > 450) { // After 07:30
          code = `L (${firstTimeStr})`;
          styleKey = "LATE";
        } else {
          code = `P (${firstTimeStr})`;
          styleKey = "PRESENT";
        }
      } else {
        if (d.isWeekend) {
          code = "W (Off)";
          styleKey = "WEEKEND";
        } else {
          code = "A";
          styleKey = "ABSENT";
        }
      }

      const st = STATUS_STYLES[styleKey];
      cell.value = code;
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: `FF${st.font}` } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${st.fill}` } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });

    // Summary calculations
    const pct = Math.round((presentDays / workingDaysCount) * 100);

    const cellPres = row.getCell(13);
    cellPres.value = `${presentDays} / ${workingDaysCount} Days`;
    cellPres.alignment = { horizontal: "center", vertical: "middle" };
    cellPres.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF0F172A" } };

    const cellPct = row.getCell(14);
    cellPct.value = `${pct}%`;
    cellPct.alignment = { horizontal: "center", vertical: "middle" };
    cellPct.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: pct >= 80 ? "FF155724" : "FF721C24" } };
    cellPct.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: pct >= 80 ? "FFD4EDDA" : "FFF8D7DA" },
    };

    // Row borders
    [1, 2, 3, 13, 14].forEach((c) => {
      row.getCell(c).border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  // Set Matrix Column Widths
  wsMatrix.getColumn(1).width = 7;
  wsMatrix.getColumn(2).width = 44;
  wsMatrix.getColumn(3).width = 14;
  for (let c = 4; c <= 12; c++) {
    wsMatrix.getColumn(c).width = 15;
  }
  wsMatrix.getColumn(13).width = 16;
  wsMatrix.getColumn(14).width = 16;

  // ─────────────────────────────────────────────────────────────
  // SHEET 2: DETAILED LOG (CHRONOLOGICAL LINE-BY-LINE)
  // ─────────────────────────────────────────────────────────────
  const wsDetail = workbook.addWorksheet("Detailed Log", {
    views: [{ showGridLines: true, state: "frozen", ySplit: 3, xSplit: 2 }],
  });

  // Header Banner
  wsDetail.mergeCells("A1:K1");
  const dTitle = wsDetail.getCell("A1");
  dTitle.value = "DARSE BURHANI – COMPREHENSIVE FACULTY BIOMETRIC AUDIT TRAIL";
  dTitle.font = { name: "Segoe UI", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
  dTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FATIMI_DARK_GREEN } };
  dTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsDetail.getRow(1).height = 36;

  wsDetail.mergeCells("A2:K2");
  const dSub = wsDetail.getCell("A2");
  dSub.value = "Individual Daily Scan Log: First In • Last Out • Shift Duration • MinMoe Facial Recognition Verification";
  dSub.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFF59E0B" } };
  dSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FATIMI_EMERALD } };
  dSub.alignment = { horizontal: "center", vertical: "middle" };
  wsDetail.getRow(2).height = 22;

  // Columns Row 3
  const dHeaders = [
    "S.No",
    "Faculty Member Name",
    "ITS Number",
    "Hijri Date (Fatimi)",
    "Gregorian Date",
    "Day of Week",
    "Check-In Time",
    "Check-Out Time",
    "Duration (Hrs)",
    "Attendance Status",
    "Hardware Terminal / Method",
  ];

  const r3 = wsDetail.getRow(3);
  dHeaders.forEach((h, i) => {
    const cell = r3.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FATIMI_EMERALD } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: FATIMI_GOLD } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
  r3.height = 26;

  let detailRowIdx = 4;
  facultyList.forEach((f, fIdx) => {
    dates.forEach((d) => {
      const times = scansByFacultyDate.get(`${f.its}_${d.gregorian}`) || [];
      times.sort();

      const row = wsDetail.getRow(detailRowIdx);
      row.height = 24;

      const firstTimeStr = times.length > 0 ? times[0].slice(11, 19) : null;
      const lastTimeStr = times.length > 1 ? times[times.length - 1].slice(11, 19) : firstTimeStr;

      let status = "ABSENT";
      let statusKey = "ABSENT";

      if (times.length > 0) {
        const [h, m] = times[0].slice(11, 19).split(":").map(Number);
        const mins = h * 60 + m;
        if (d.isWeekend) {
          status = "PRESENT (Weekend Duty)";
          statusKey = "PRESENT";
        } else if (mins > 450) {
          status = "LATE";
          statusKey = "LATE";
        } else {
          status = "PRESENT";
          statusKey = "PRESENT";
        }
      } else if (d.isWeekend) {
        status = "WEEKEND (Off)";
        statusKey = "WEEKEND";
      }

      row.getCell(1).value = detailRowIdx - 3;
      row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

      row.getCell(2).value = f.name;
      row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      row.getCell(2).font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF0F172A" } };

      row.getCell(3).value = f.its;
      row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(3).font = { name: "Segoe UI", size: 9, color: { argb: "FF475569" } };

      row.getCell(4).value = d.hijriStr;
      row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(4).font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FF1E293B" } };

      row.getCell(5).value = d.gregorian;
      row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };

      row.getCell(6).value = d.dayOfWeek;
      row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };

      row.getCell(7).value = formatTime12h(firstTimeStr);
      row.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(7).font = { name: "Consolas", size: 9, bold: true };

      row.getCell(8).value = formatTime12h(lastTimeStr);
      row.getCell(8).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(8).font = { name: "Consolas", size: 9 };

      row.getCell(9).value = calculateDuration(firstTimeStr, lastTimeStr);
      row.getCell(9).alignment = { horizontal: "center", vertical: "middle" };

      const st = STATUS_STYLES[statusKey];
      const statusCell = row.getCell(10);
      statusCell.value = status;
      statusCell.alignment = { horizontal: "center", vertical: "middle" };
      statusCell.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: `FF${st.font}` } };
      statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: `FF${st.fill}` } };

      row.getCell(11).value = times.length > 0 ? "MinMoe Facial Biometrics (Secondary Terminal)" : "—";
      row.getCell(11).alignment = { horizontal: "left", vertical: "middle" };
      row.getCell(11).font = { name: "Segoe UI", size: 8, color: { argb: "FF64748B" } };

      // Zebra striping for non-status cells
      const isEvenRow = detailRowIdx % 2 === 0;
      const bgZebra = isEvenRow ? "FFFFFFFF" : "FFF8FAFC";
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 11].forEach((c) => {
        const cl = row.getCell(c);
        if (!cl.fill) {
          cl.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgZebra } };
        }
        cl.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });

      detailRowIdx++;
    });
  });

  // Column Widths for Detail Log
  wsDetail.getColumn(1).width = 7;
  wsDetail.getColumn(2).width = 44;
  wsDetail.getColumn(3).width = 14;
  wsDetail.getColumn(4).width = 24;
  wsDetail.getColumn(5).width = 15;
  wsDetail.getColumn(6).width = 16;
  wsDetail.getColumn(7).width = 17;
  wsDetail.getColumn(8).width = 17;
  wsDetail.getColumn(9).width = 15;
  wsDetail.getColumn(10).width = 24;
  wsDetail.getColumn(11).width = 42;

  // ─────────────────────────────────────────────────────────────
  // SHEET 3: EXECUTIVE SUMMARY & SCORECARD
  // ─────────────────────────────────────────────────────────────
  const wsSum = workbook.addWorksheet("Executive Summary", {
    views: [{ showGridLines: true }],
  });

  wsSum.mergeCells("A1:G1");
  const sTitle = wsSum.getCell("A1");
  sTitle.value = "DARSE BURHANI – FACULTY ATTENDANCE EXECUTIVE SCORECARD";
  sTitle.font = { name: "Segoe UI", size: 15, bold: true, color: { argb: "FFFFFFFF" } };
  sTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FATIMI_DARK_GREEN } };
  sTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsSum.getRow(1).height = 36;

  wsSum.mergeCells("A2:G2");
  const sSub = wsSum.getCell("A2");
  sSub.value = "Performance Overview for 11 Key Faculty Members • 1 Jumādā al-Ūlā to 9 Jumādā al-Ūlā 1448 H (11–19 Oct 2026)";
  sSub.font = { name: "Segoe UI", size: 9, bold: true, color: { argb: "FFF59E0B" } };
  sSub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FATIMI_EMERALD } };
  sSub.alignment = { horizontal: "center", vertical: "middle" };
  wsSum.getRow(2).height = 22;

  const sHeaders = [
    "S.No",
    "Faculty Member Name",
    "ITS Number",
    "Working Days",
    "Present Days",
    "Absent Days",
    "Attendance Rate",
  ];

  const sr3 = wsSum.getRow(3);
  sHeaders.forEach((h, i) => {
    const cell = sr3.getCell(i + 1);
    cell.value = h;
    cell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FATIMI_EMERALD } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: FATIMI_GOLD } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } },
    };
  });
  sr3.height = 26;

  const workingDaysList = dates.filter((d) => !d.isWeekend);

  facultyList.forEach((f, idx) => {
    const row = wsSum.getRow(4 + idx);
    row.height = 25;

    let presentCount = 0;
    workingDaysList.forEach((d) => {
      const times = scansByFacultyDate.get(`${f.its}_${d.gregorian}`) || [];
      if (times.length > 0) presentCount++;
    });

    const absentCount = workingDaysList.length - presentCount;
    const rate = Math.round((presentCount / workingDaysList.length) * 100);

    row.getCell(1).value = idx + 1;
    row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

    row.getCell(2).value = f.name;
    row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
    row.getCell(2).font = { name: "Segoe UI", size: 10, bold: true };

    row.getCell(3).value = f.its;
    row.getCell(3).alignment = { horizontal: "center", vertical: "middle" };

    row.getCell(4).value = workingDaysList.length;
    row.getCell(4).alignment = { horizontal: "center", vertical: "middle" };

    row.getCell(5).value = presentCount;
    row.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(5).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: "FF155724" } };

    row.getCell(6).value = absentCount;
    row.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
    row.getCell(6).font = { name: "Segoe UI", size: 10, bold: true, color: { argb: absentCount > 0 ? "FF721C24" : "FF64748B" } };

    const rateCell = row.getCell(7);
    rateCell.value = `${rate}%`;
    rateCell.alignment = { horizontal: "center", vertical: "middle" };
    rateCell.font = { name: "Segoe UI", size: 10, bold: true, color: { argb: rate >= 80 ? "FF155724" : "FF721C24" } };
    rateCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: rate >= 80 ? "FFD4EDDA" : "FFF8D7DA" },
    };

    [1, 2, 3, 4, 5, 6, 7].forEach((c) => {
      row.getCell(c).border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });

  wsSum.getColumn(1).width = 7;
  wsSum.getColumn(2).width = 44;
  wsSum.getColumn(3).width = 14;
  wsSum.getColumn(4).width = 16;
  wsSum.getColumn(5).width = 16;
  wsSum.getColumn(6).width = 16;
  wsSum.getColumn(7).width = 20;

  // Save workbook to file
  const outFileName = "Faculty_Attendance_Jumada_al-Ula_1448H.xlsx";
  const outPath = path.resolve(process.cwd(), outFileName);
  await workbook.xlsx.writeFile(outPath);
  console.log(`\n🎉 SUCCESS! Excel workbook saved to: ${outPath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
