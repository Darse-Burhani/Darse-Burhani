/**
 * Daily Google Sheet (online) attendance log sync.
 *
 * One tab per school day (title "YYYY-MM-DD") + a "Summary" tab with
 * day-wise totals. Designed to run daily from the attendance scheduler
 * AFTER the auto-mark-absent jobs, so ABSENT rows are final.
 *
 * Setup (service-account write access — API key alone is read-only):
 *   1. Google Cloud → create Service Account → create JSON key →
 *      enable "Google Sheets API".
 *   2. Create a spreadsheet (e.g. "Darse Burhani — Attendance Log") and
 *      Share it with the service-account email as Editor.
 *   3. .env:
 *        GOOGLE_ATTENDANCE_SPREADSHEET_ID="1AbC...xyz"
 *        GOOGLE_SERVICE_ACCOUNT_EMAIL="svc@project.iam.gserviceaccount.com"
 *        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 *      (or GOOGLE_SERVICE_ACCOUNT_JSON='<full json key file contents>')
 *   4. Optional:
 *        GOOGLE_SHEET_DAILY_SYNC="true"   (default true when configured)
 *        GOOGLE_SHEET_SYNC_HOUR="15"      (UTC hour to push, default 15 ≈ 20:30 IST)
 *
 * Manual run:
 *   npm run attendance-log:sheet -w server [-- --date YYYY-MM-DD]
 */
import { google } from "googleapis";
import fs from "fs";
import path from "path";
import prisma from "./prisma";
import { eventRangeForRole } from "./biometric";

const SUMMARY_TAB = "Summary";
const DAILY_HEADER = [
  "Name",
  "Role",
  "ITS / ID",
  "Grade / Department",
  "Date",
  "Check-in (IST)",
  "Event",
  "Status",
  "Source / Reason",
];
const SUMMARY_HEADER = [
  "Date",
  "Talabat Present",
  "Talabat Late",
  "Talabat On Leave",
  "Talabat Absent",
  "Talabat Total",
  "Talabat Rate %",
  "Faculty Present",
  "Faculty Late",
  "Faculty On Leave",
  "Faculty Absent",
  "Faculty Total",
  "Faculty Rate %",
  "Synced At (IST)",
];

// ── Config ────────────────────────────────────────────────────────────────

export function extractSpreadsheetId(input: string): string {
  const trimmed = (input || "").trim();
  if (!trimmed) return "";
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) return match[1];
  return trimmed;
}

export function getAttendanceSpreadsheetId(): string {
  const raw = (
    process.env.GOOGLE_ATTENDANCE_SPREADSHEET_ID ||
    process.env.GOOGLE_ATTENDANCE_SHEET_ID ||
    process.env.GOOGLE_SHEET_ID ||
    ""
  ).trim();
  return extractSpreadsheetId(raw);
}

function getServiceAccountCreds(): { email: string; key: string } | { json: string } | null {
  const json = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  if (json) return { json };
  const email = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "").trim();
  let key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "";
  if (!email || !key) return null;
  // .env commonly stores newlines as literal \n
  key = key.replace(/\\n/g, "\n");
  if (!key.includes("BEGIN PRIVATE KEY")) return null;
  return { email, key };
}

export function isSheetSyncConfigured(): boolean {
  return Boolean(getAttendanceSpreadsheetId() && getServiceAccountCreds());
}

let lastSyncedAtIso: string | null = null;
let lastSyncedDateKey: string | null = null;

export function markSheetSyncRan(dateKey: string) {
  lastSyncedAtIso = new Date().toISOString();
  lastSyncedDateKey = dateKey;
}

export function sheetSyncStatus() {
  const id = getAttendanceSpreadsheetId();
  const creds = getServiceAccountCreds();
  let saEmail: string | null = null;
  if (creds) {
    if ("email" in creds) saEmail = creds.email;
    else if ("json" in creds) {
      try {
        saEmail = JSON.parse(creds.json).client_email || null;
      } catch {
        saEmail = null;
      }
    }
  }

  return {
    configured: isSheetSyncConfigured(),
    spreadsheetId: id || null,
    maskedSpreadsheetId: id ? `${id.slice(0, 6)}…${id.slice(-4)}` : null,
    serviceAccountEmail: saEmail ? `${saEmail.slice(0, 6)}…@${saEmail.split("@")[1] || "gserviceaccount.com"}` : null,
    fullServiceAccountEmail: saEmail,
    enabled: process.env.GOOGLE_SHEET_DAILY_SYNC !== "false",
    syncHourUtc: parseInt(process.env.GOOGLE_SHEET_SYNC_HOUR || "15", 10),
    url: id ? `https://docs.google.com/spreadsheets/d/${id}` : null,
    lastSyncedAt: lastSyncedAtIso,
    lastSyncedDate: lastSyncedDateKey,
  };
}

export async function testSheetConnection(custom?: {
  spreadsheetId?: string;
  serviceAccountJson?: string;
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
}): Promise<{
  success: boolean;
  title: string;
  sheetNames: string[];
  url: string;
  serviceAccountEmail: string;
}> {
  const spreadsheetId = extractSpreadsheetId(custom?.spreadsheetId || getAttendanceSpreadsheetId());
  if (!spreadsheetId) {
    throw new Error("Missing Google Spreadsheet ID or URL. Please provide a valid sheet URL/ID.");
  }

  let auth: unknown;
  let saEmail = "";

  const rawJson = (custom?.serviceAccountJson || "").trim();
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      saEmail = parsed.client_email || "";
      auth = new google.auth.JWT({
        email: parsed.client_email,
        key: parsed.private_key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
    } catch (err) {
      throw new Error(`Invalid Service Account JSON format: ${(err as Error).message}`);
    }
  } else if (custom?.serviceAccountEmail && custom?.serviceAccountPrivateKey) {
    saEmail = custom.serviceAccountEmail.trim();
    let key = custom.serviceAccountPrivateKey.trim().replace(/\\n/g, "\n");
    auth = new google.auth.JWT({
      email: saEmail,
      key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  } else {
    const creds = getServiceAccountCreds();
    if (!creds) {
      throw new Error("No Service Account credentials configured. Provide Service Account JSON or Email + Key.");
    }
    if ("json" in creds) {
      const parsed = JSON.parse(creds.json);
      saEmail = parsed.client_email || "";
      auth = new google.auth.JWT({
        email: parsed.client_email,
        key: parsed.private_key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
    } else {
      saEmail = creds.email;
      auth = new google.auth.JWT({
        email: creds.email,
        key: creds.key,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
    }
  }

  const client = google.sheets({ version: "v4", auth: auth as never });
  const meta = await client.spreadsheets.get({ spreadsheetId });
  const title = meta.data.properties?.title || "Untitled Spreadsheet";
  const sheetNames = (meta.data.sheets || []).map((s) => s.properties?.title || "Sheet").filter(Boolean);

  return {
    success: true,
    title,
    sheetNames,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    serviceAccountEmail: saEmail,
  };
}

export async function saveSheetConfiguration(config: {
  spreadsheetId?: string;
  serviceAccountJson?: string;
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
  enabled?: boolean;
  syncHourUtc?: number;
}): Promise<void> {
  const rootDir = process.cwd();
  const envPath = path.resolve(rootDir, ".env");

  const cleanId = extractSpreadsheetId(config.spreadsheetId || "");
  if (cleanId) process.env.GOOGLE_ATTENDANCE_SPREADSHEET_ID = cleanId;
  if (config.serviceAccountJson !== undefined) {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = config.serviceAccountJson.trim();
  }
  if (config.serviceAccountEmail !== undefined) {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = config.serviceAccountEmail.trim();
  }
  if (config.serviceAccountPrivateKey !== undefined) {
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = config.serviceAccountPrivateKey.trim();
  }
  if (config.enabled !== undefined) {
    process.env.GOOGLE_SHEET_DAILY_SYNC = config.enabled ? "true" : "false";
  }
  if (config.syncHourUtc !== undefined) {
    process.env.GOOGLE_SHEET_SYNC_HOUR = String(config.syncHourUtc);
  }

  // Update .env file if it exists
  try {
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";

    const setEnvVar = (key: string, val: string) => {
      const reg = new RegExp(`^${key}=.*$`, "m");
      if (reg.test(content)) {
        content = content.replace(reg, `${key}=${val}`);
      } else {
        content = content.trimEnd() + `\n${key}=${val}\n`;
      }
    };

    if (cleanId) setEnvVar("GOOGLE_ATTENDANCE_SPREADSHEET_ID", `"${cleanId}"`);
    if (config.serviceAccountJson !== undefined && config.serviceAccountJson.trim()) {
      // JSON stringified for single line or formatted
      const cleanJson = JSON.stringify(JSON.parse(config.serviceAccountJson));
      setEnvVar("GOOGLE_SERVICE_ACCOUNT_JSON", `'${cleanJson}'`);
    }
    if (config.serviceAccountEmail !== undefined && config.serviceAccountEmail.trim()) {
      setEnvVar("GOOGLE_SERVICE_ACCOUNT_EMAIL", `"${config.serviceAccountEmail.trim()}"`);
    }
    if (config.serviceAccountPrivateKey !== undefined && config.serviceAccountPrivateKey.trim()) {
      const escapedKey = config.serviceAccountPrivateKey.trim().replace(/\r?\n/g, "\\n");
      setEnvVar("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", `"${escapedKey}"`);
    }
    if (config.enabled !== undefined) {
      setEnvVar("GOOGLE_SHEET_DAILY_SYNC", config.enabled ? "true" : "false");
    }
    if (config.syncHourUtc !== undefined) {
      setEnvVar("GOOGLE_SHEET_SYNC_HOUR", `"${config.syncHourUtc}"`);
    }

    fs.writeFileSync(envPath, content, "utf8");
  } catch (err) {
    console.warn("[google-sheet-sync] Warning: Could not persist to .env file:", (err as Error)?.message);
  }
}

function getWriteClient() {
  const spreadsheetId = getAttendanceSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error(
      "GOOGLE_ATTENDANCE_SPREADSHEET_ID is not set. Create a spreadsheet, share it with the service account, and set its ID in .env or the Attendance Settings.",
    );
  }
  const creds = getServiceAccountCreds();
  if (!creds) {
    throw new Error(
      "Google service-account credentials missing. Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT_JSON).",
    );
  }
  let auth: unknown;
  if ("json" in creds) {
    const parsed = JSON.parse(creds.json);
    auth = new google.auth.JWT({
      email: parsed.client_email,
      key: parsed.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  } else {
    auth = new google.auth.JWT({
      email: creds.email,
      key: creds.key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
  }
  return { sheets: google.sheets({ version: "v4", auth: auth as never }), spreadsheetId };
}

// ── Data builders (mirror attendance-excel.ts daily logic, Sheets-friendly) ──

type ScanWindowRow = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateEndTime?: string | null;
  enabled: boolean;
  facultyStartTime?: string | null;
  facultyEndTime?: string | null;
  facultyLateEndTime?: string | null;
  facultyEnabled?: boolean;
};

function istMinutesOf(d: Date): number {
  return (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
}

function matchEvent(
  checkIn: Date | string | null | undefined,
  windows: ScanWindowRow[],
  faculty: boolean,
): string {
  if (!checkIn) return "--";
  const d = new Date(checkIn);
  if (Number.isNaN(d.getTime())) return "--";
  const t = istMinutesOf(d);
  const hit = windows.filter((w) => {
    if (!w.enabled) return false;
    const p = eventRangeForRole(w as never, faculty ? "TEACHER" : "STUDENT") as {
      enabled: boolean;
      startMin: number;
      lateMin: number;
    } | null;
    if (p && p.enabled && t >= p.startMin && t <= p.lateMin) return true;
    const s = eventRangeForRole(w as never, faculty ? "STUDENT" : "TEACHER") as {
      enabled: boolean;
      startMin: number;
      lateMin: number;
    } | null;
    return Boolean(s && s.enabled && t >= s.startMin && t <= s.lateMin);
  });
  if (hit.length === 0) return "Unscheduled";
  hit.sort((a, b) => a.startTime.localeCompare(b.startTime));
  return hit[0].name;
}

function fmtTimeIST(v: Date | string | null | undefined): string {
  if (!v) return "--";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "--";
  return (
    d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }) + " IST"
  );
}

function fmtDateIST(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
}

function dayStartUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export interface DailySheetData {
  dateKey: string;
  formattedDate: string;
  header: string[];
  rows: string[][];
  summaryRow: (string | number)[];
  stats: {
    studentPresent: number;
    studentLate: number;
    studentAbsent: number;
    studentTotal: number;
    studentRate: number;
    teacherPresent: number;
    teacherLate: number;
    teacherAbsent: number;
    teacherTotal: number;
    teacherRate: number;
  };
}

export interface DailySheetData {
  dateKey: string;
  formattedDate: string;
  allValues: string[][];
  talabatCount: number;
  facultyCount: number;
  summaryRow: (string | number)[];
  talabatSectionRowIndex: number;
  talabatHeaderRowIndex: number;
  talabatStartRowIndex: number;
  facultySectionRowIndex: number;
  facultyHeaderRowIndex: number;
  facultyStartRowIndex: number;
  kpiSectionRowIndex: number;
  stats: {
    studentPresent: number;
    studentLate: number;
    studentAbsent: number;
    studentTotal: number;
    studentRate: number;
    teacherPresent: number;
    teacherLate: number;
    teacherAbsent: number;
    teacherTotal: number;
    teacherRate: number;
  };
}

function getPhotoFormula(name: string, photoUrl?: string | null, isFaculty?: boolean): string {
  const cleanUrl = (photoUrl || "").trim();
  const bg = isFaculty ? "1E1B4B" : "042F24";
  const fg = isFaculty ? "FDE047" : "D4AF37";
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=${fg}&bold=true&size=128`;
  
  if (cleanUrl.startsWith("http://") || cleanUrl.startsWith("https://")) {
    return `=IFERROR(IMAGE("${cleanUrl}"), IMAGE("${fallbackUrl}"))`;
  }
  return `=IMAGE("${fallbackUrl}")`;
}

export async function buildDailySheetData(targetDate?: Date): Promise<DailySheetData> {
  const now = targetDate || new Date();
  const dayStart = dayStartUTC(now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dateKey = dayStart.toISOString().slice(0, 10);
  const formattedDate = fmtDateIST(dayStart);

  const scanWindows = (await prisma.biometricScanWindow.findMany({
    orderBy: { startTime: "asc" },
  })) as unknown as ScanWindowRow[];

  const students = await prisma.studentProfile.findMany({
    where: { user: { isActive: true } },
    include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: [{ grade: "asc" }, { section: "asc" }, { studentId: "asc" }],
  });

  const studentRecords = await prisma.attendanceRecord.findMany({
    where: { date: { gte: dayStart, lt: dayEnd } },
  });

  const teachers = await prisma.teacherProfile.findMany({
    where: { user: { isActive: true } },
    include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: [{ employeeId: "asc" }],
  });

  const teacherRecords = await prisma.teacherAttendanceRecord.findMany({
    where: { date: { gte: dayStart, lt: dayEnd } },
  });

  const studentLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: "APPROVED",
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
    },
    select: { studentId: true, type: true, reason: true },
  });

  const medicalExemptions = await prisma.medicalExemption.findMany({
    where: {
      isActive: true,
      date: { gte: dayStart, lt: dayEnd },
    },
    select: { studentId: true, teacherId: true, reason: true, eventName: true },
  });

  const sMap = new Map(studentRecords.map((r) => [r.studentId, r]));
  const tMap = new Map(teacherRecords.map((r) => [r.teacherId, r]));
  const sLeaveMap = new Map(studentLeaves.map((l) => [l.studentId, l]));
  const sMedMap = new Map(medicalExemptions.filter((m) => m.studentId).map((m) => [m.studentId!, m]));
  const tMedMap = new Map(medicalExemptions.filter((m) => m.teacherId).map((m) => [m.teacherId!, m]));

  let sP = 0, sL = 0, sLeave = 0, sA = 0;
  let tP = 0, tL = 0, tLeave = 0, tA = 0;

  const TALABAT_HEADER = [
    "Photo",
    "Student Full Name",
    "Audience",
    "ITS / Roll No",
    "Grade & Section",
    "Date",
    "Check-in (IST)",
    "Scan Window / Session",
    "Attendance Status",
    "Verification Source",
    "Leave / Medical Reason",
  ];

  const FACULTY_HEADER = [
    "Photo",
    "Faculty Member Name",
    "Audience",
    "Employee ID / ITS",
    "Department / Role",
    "Date",
    "Check-in (IST)",
    "Scan Window / Session",
    "Attendance Status",
    "Verification Source",
    "Leave / Medical Reason",
  ];

  const talabatDataRows: string[][] = [];
  for (const s of students) {
    const att = sMap.get(s.id);
    const activeLeave = sLeaveMap.get(s.id);
    const activeMed = sMedMap.get(s.id);
    const fullName = `${s.user.firstName} ${s.user.lastName}`.trim();

    let status = (att?.status as string | undefined) ?? "ABSENT";
    let source = "NOT_MARKED";
    let reason = "—";

    if (activeMed) {
      status = "MEDICAL";
      source = "MEDICAL_DUTY";
      reason = `Medical Exemption: ${activeMed.eventName || "Medical Duty"} (${activeMed.reason})`;
      sLeave++;
    } else if (activeLeave) {
      status = "ON_LEAVE";
      source = "LEAVE_APPROVED";
      reason = `Approved Leave (${activeLeave.type}): ${activeLeave.reason || "Excused"}`;
      sLeave++;
    } else if (status === "PRESENT") {
      sP++;
      source = att ? String((att as { source?: string }).source || "SCAN") : "SCAN";
    } else if (status === "LATE") {
      sL++;
      source = att ? String((att as { source?: string }).source || "SCAN") : "SCAN";
    } else if (status === "ON_LEAVE" || status === "MEDICAL") {
      sLeave++;
      source = "EXCUSED";
      reason = status === "MEDICAL" ? "Medical Exemption" : "On Leave";
    } else {
      status = "ABSENT";
      sA++;
      source = "UNSCANNED";
    }

    talabatDataRows.push([
      getPhotoFormula(fullName, s.user.avatarUrl, false),
      fullName,
      "Talabat",
      (s as { its?: string | null }).its || s.studentId,
      s.section ? `Grade ${s.grade}-${s.section}` : `Grade ${s.grade || "--"}`,
      formattedDate,
      att ? fmtTimeIST(att.checkInTime) : "--",
      att ? matchEvent(att.checkInTime, scanWindows, false) : "--",
      status,
      source,
      reason,
    ]);
  }

  const facultyDataRows: string[][] = [];
  for (const t of teachers) {
    const att = tMap.get(t.id);
    const activeMed = tMedMap.get(t.id);
    const fullName = `${t.user.firstName} ${t.user.lastName}`.trim();

    let status = (att?.status as string | undefined) ?? "ABSENT";
    let source = "NOT_MARKED";
    let reason = "—";

    if (activeMed) {
      status = "MEDICAL";
      source = "MEDICAL_DUTY";
      reason = `Medical Duty: ${activeMed.eventName || "Duty"} (${activeMed.reason})`;
      tLeave++;
    } else if (status === "PRESENT") {
      tP++;
      source = att ? String((att as { verificationMethod?: string }).verificationMethod || "SCAN") : "SCAN";
    } else if (status === "LATE") {
      tL++;
      source = att ? String((att as { verificationMethod?: string }).verificationMethod || "SCAN") : "SCAN";
    } else if (status === "ON_LEAVE" || status === "MEDICAL") {
      tLeave++;
      source = "EXCUSED";
      reason = status === "MEDICAL" ? "Medical Leave" : "On Leave";
    } else {
      status = "ABSENT";
      tA++;
      source = "UNSCANNED";
    }

    facultyDataRows.push([
      getPhotoFormula(fullName, t.photoUrl || t.user.avatarUrl, true),
      fullName,
      "Faculty",
      t.employeeId || (t as { its?: string | null }).its || "—",
      t.department || "Faculty",
      formattedDate,
      att ? fmtTimeIST(att.checkInTime) : "--",
      att ? matchEvent(att.checkInTime, scanWindows, true) : "--",
      status,
      source,
      reason,
    ]);
  }

  const sTotal = students.length;
  const tTotal = teachers.length;
  const sRate = sTotal > 0 ? Math.round(((sP + sL) / sTotal) * 100) : 0;
  const tRate = tTotal > 0 ? Math.round(((tP + tL) / tTotal) * 100) : 0;
  const syncedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST";

  // Build the complete combined bifurcated worksheet matrix
  const allValues: string[][] = [];

  // 1. Talabat Section Header
  const talabatSectionRowIndex = allValues.length;
  allValues.push([`🎓 TALABAT (STUDENTS) ATTENDANCE ROSTER — ${formattedDate}`, "", "", "", "", "", "", "", "", "", ""]);
  
  // 2. Talabat Table Header
  const talabatHeaderRowIndex = allValues.length;
  allValues.push(TALABAT_HEADER);
  
  // 3. Talabat Data Rows
  const talabatStartRowIndex = allValues.length;
  allValues.push(...talabatDataRows);

  // 4. Spacer
  allValues.push(["", "", "", "", "", "", "", "", "", "", ""]);

  // 5. Faculty Section Header
  const facultySectionRowIndex = allValues.length;
  allValues.push([`👨‍🏫 FACULTY (TEACHERS & STAFF) ATTENDANCE ROSTER — ${formattedDate}`, "", "", "", "", "", "", "", "", "", ""]);
  
  // 6. Faculty Table Header
  const facultyHeaderRowIndex = allValues.length;
  allValues.push(FACULTY_HEADER);
  
  // 7. Faculty Data Rows
  const facultyStartRowIndex = allValues.length;
  allValues.push(...facultyDataRows);

  // 8. Spacer
  allValues.push(["", "", "", "", "", "", "", "", "", "", ""]);

  // 9. Daily KPI Summary Section
  const kpiSectionRowIndex = allValues.length;
  allValues.push([`📊 DAILY ATTENDANCE SUMMARY & METRICS — ${formattedDate}`, "", "", "", "", "", "", "", "", "", ""]);
  allValues.push(["Audience", "Total Roster", "Present (On-Time)", "Late Arrival", "Approved Leave", "Absent", "Attendance Rate %", "Compliance Status", "Synced Timestamp", "", ""]);
  allValues.push(["Talabat (Students)", String(sTotal), String(sP), String(sL), String(sLeave), String(sA), `${sRate}%`, sRate >= 80 ? "EXCELLENT" : "ATTENTION NEEDED", syncedAt, "", ""]);
  allValues.push(["Faculty (Staff)", String(tTotal), String(tP), String(tL), String(tLeave), String(tA), `${tRate}%`, tRate >= 80 ? "EXCELLENT" : "ATTENTION NEEDED", syncedAt, "", ""]);
  allValues.push(["Combined Total", String(sTotal + tTotal), String(sP + tP), String(sL + tL), String(sLeave + tLeave), String(sA + tA), `${Math.round(((sP + sL + tP + tL) / (sTotal + tTotal || 1)) * 100)}%`, "OFFICIAL ARCHIVE", syncedAt, "", ""]);

  return {
    dateKey,
    formattedDate,
    allValues,
    talabatCount: talabatDataRows.length,
    facultyCount: facultyDataRows.length,
    talabatSectionRowIndex,
    talabatHeaderRowIndex,
    talabatStartRowIndex,
    facultySectionRowIndex,
    facultyHeaderRowIndex,
    facultyStartRowIndex,
    kpiSectionRowIndex,
    summaryRow: [
      dateKey,
      sP,
      sL,
      sLeave,
      sA,
      sTotal,
      `${sRate}%`,
      tP,
      tL,
      tLeave,
      tA,
      tTotal,
      `${tRate}%`,
      syncedAt,
    ],
    stats: {
      studentPresent: sP,
      studentLate: sL,
      studentAbsent: sA,
      studentTotal: sTotal,
      studentRate: sRate,
      teacherPresent: tP,
      teacherLate: tL,
      teacherAbsent: tA,
      teacherTotal: tTotal,
      teacherRate: tRate,
    },
  };
}

// ── Sheets write helpers ──────────────────────────────────────────────────

async function ensureTab(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string, title: string): Promise<number | undefined> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const existing = (meta.data.sheets || []).find((s) => s.properties?.title === title);
  if (existing?.properties?.sheetId !== undefined) {
    return existing.properties.sheetId;
  }
  const addRes = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  return addRes.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined;
}

function sheetTitle(dateKey: string): string {
  return dateKey; // "YYYY-MM-DD"
}

export async function syncDailyAttendanceToSheet(targetDate?: Date): Promise<{
  spreadsheetId: string;
  tabTitle: string;
  rowsSynced: number;
  url: string;
  stats: DailySheetData["stats"];
}> {
  const { sheets, spreadsheetId } = getWriteClient();
  const data = await buildDailySheetData(targetDate);
  const tab = sheetTitle(data.dateKey);

  const summarySheetId = await ensureTab(sheets, spreadsheetId, SUMMARY_TAB);
  const daySheetId = await ensureTab(sheets, spreadsheetId, tab);

  // 1. Clear previous content & write complete bifurcated data matrix
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${tab}'!A1:K${Math.max(data.allValues.length + 50, 500)}`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab}'!A1:K${data.allValues.length}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: data.allValues },
  });

  // 2. Summary tab: header + upsert one row per date
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${SUMMARY_TAB}'!A:A`,
  }).catch(() => ({ data: { values: [] as string[][] } }));
  const colA = existing.data.values || [];
  if (colA.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `'${SUMMARY_TAB}'!A1:N1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [SUMMARY_HEADER] },
    });
  }
  const rowIdx = colA.length === 0 ? 2 : (() => {
    const found = colA.findIndex((r) => String(r?.[0] || "").trim() === data.dateKey);
    return found >= 0 ? found + 1 : colA.length + 1;
  })();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${SUMMARY_TAB}'!A${rowIdx}:N${rowIdx}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [data.summaryRow] },
  });

  // 3. Apply Rich Professional Google Sheets Formatting
  if (daySheetId !== undefined) {
    try {
      const requests: Array<Record<string, unknown>> = [];

      // A. Freeze Top 2 Rows
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: daySheetId, gridProperties: { frozenRowCount: 2 } },
          fields: "gridProperties.frozenRowCount",
        },
      });

      // B. Custom Column Widths (A: Photo 60px, B: Name 190px, C: Role 90px, D: ITS 105px, E: Class/Dept 140px, F: Date 95px, G: Time 120px, H: Event 130px, I: Status 115px, J: Source 115px, K: Reason 230px)
      const colWidths = [60, 190, 90, 105, 140, 95, 120, 130, 115, 115, 230];
      colWidths.forEach((pixelSize, idx) => {
        requests.push({
          updateDimensionProperties: {
            range: { sheetId: daySheetId, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
            properties: { pixelSize },
            fields: "pixelSize",
          },
        });
      });

      // C. Set Data Row Heights to 46px so photos are crisp and prominent
      const talabatEnd = data.talabatStartRowIndex + data.talabatCount;
      if (data.talabatCount > 0) {
        requests.push({
          updateDimensionProperties: {
            range: { sheetId: daySheetId, dimension: "ROWS", startIndex: data.talabatStartRowIndex, endIndex: talabatEnd },
            properties: { pixelSize: 46 },
            fields: "pixelSize",
          },
        });
      }

      const facultyEnd = data.facultyStartRowIndex + data.facultyCount;
      if (data.facultyCount > 0) {
        requests.push({
          updateDimensionProperties: {
            range: { sheetId: daySheetId, dimension: "ROWS", startIndex: data.facultyStartRowIndex, endIndex: facultyEnd },
            properties: { pixelSize: 46 },
            fields: "pixelSize",
          },
        });
      }

      // D. Format Talabat Section Header (Dark Emerald background, Fatimi Gold text, Bold 11pt, Middle)
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: data.talabatSectionRowIndex, endRowIndex: data.talabatSectionRowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.015, green: 0.184, blue: 0.141 }, // #042F24
              textFormat: { foregroundColor: { red: 0.992, green: 0.878, blue: 0.278 }, bold: true, fontSize: 11 }, // #FDE047
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
        },
      });

      // E. Format Talabat Table Header (Slate Dark, White text, Bold 10pt)
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: data.talabatHeaderRowIndex, endRowIndex: data.talabatHeaderRowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.058, green: 0.09, blue: 0.165 }, // #0F172A
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
              verticalAlignment: "MIDDLE",
              horizontalAlignment: "CENTER",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)",
        },
      });

      // F. Format Faculty Section Header (Royal Indigo, Gold text, Bold 11pt)
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: data.facultySectionRowIndex, endRowIndex: data.facultySectionRowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.118, green: 0.106, blue: 0.294 }, // #1E1B4B
              textFormat: { foregroundColor: { red: 0.992, green: 0.878, blue: 0.278 }, bold: true, fontSize: 11 },
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
        },
      });

      // G. Format Faculty Table Header (Royal Slate, White text, Bold 10pt)
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: data.facultyHeaderRowIndex, endRowIndex: data.facultyHeaderRowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.192, green: 0.18, blue: 0.506 }, // #312E81
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
              verticalAlignment: "MIDDLE",
              horizontalAlignment: "CENTER",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)",
        },
      });

      // H. Format KPI Summary Section Header
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: data.kpiSectionRowIndex, endRowIndex: data.kpiSectionRowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.058, green: 0.09, blue: 0.165 },
              textFormat: { foregroundColor: { red: 0.992, green: 0.878, blue: 0.278 }, bold: true, fontSize: 11 },
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment)",
        },
      });

      // I. Middle Vertical Align for all Data Cells
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: 0, endRowIndex: data.allValues.length, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat.verticalAlignment",
        },
      });

      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } as never });
    } catch (err) {
      console.warn("[google-sheet-sync] formatting applied with fallback:", (err as Error)?.message);
    }
  }

  console.log(
    `[google-sheet-sync] ${data.dateKey}: ${data.allValues.length} total rows → tab '${tab}' ` +
    `(Talabat ${data.talabatCount}, Faculty ${data.facultyCount})`,
  );

  return {
    spreadsheetId,
    tabTitle: tab,
    rowsSynced: data.talabatCount + data.facultyCount,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    stats: data.stats,
  };
}

/** Scheduler-safe wrapper — never throws, skips quietly when unconfigured. */
export async function runDailySheetSyncJob(targetDate?: Date): Promise<{
  skipped: boolean;
  reason?: string;
  tabTitle?: string;
  rowsSynced?: number;
}> {
  if (process.env.GOOGLE_SHEET_DAILY_SYNC === "false") {
    return { skipped: true, reason: "disabled via GOOGLE_SHEET_DAILY_SYNC=false" };
  }
  if (!isSheetSyncConfigured()) {
    console.log("[google-sheet-sync] skipped — spreadsheet ID / service-account not configured");
    return { skipped: true, reason: "not configured" };
  }
  try {
    const r = await syncDailyAttendanceToSheet(targetDate);
    return { skipped: false, tabTitle: r.tabTitle, rowsSynced: r.rowsSynced };
  } catch (err) {
    console.error("[google-sheet-sync] daily push failed:", (err as Error)?.message || err);
    return { skipped: true, reason: (err as Error)?.message || "push failed" };
  }
}
