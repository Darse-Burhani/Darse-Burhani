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
  "Source",
];
const SUMMARY_HEADER = [
  "Date",
  "Talabat Present",
  "Talabat Late",
  "Talabat Absent",
  "Talabat Total",
  "Talabat Rate %",
  "Faculty Present",
  "Faculty Late",
  "Faculty Absent",
  "Faculty Total",
  "Faculty Rate %",
  "Synced At (IST)",
];

// ── Config ────────────────────────────────────────────────────────────────

export function getAttendanceSpreadsheetId(): string {
  return (
    process.env.GOOGLE_ATTENDANCE_SPREADSHEET_ID ||
    process.env.GOOGLE_ATTENDANCE_SHEET_ID ||
    process.env.GOOGLE_SHEET_ID ||
    ""
  ).trim();
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

export function sheetSyncStatus() {
  const id = getAttendanceSpreadsheetId();
  return {
    configured: isSheetSyncConfigured(),
    spreadsheetId: id ? `${id.slice(0, 6)}…${id.slice(-4)}` : null,
    enabled: process.env.GOOGLE_SHEET_DAILY_SYNC !== "false",
    syncHourUtc: parseInt(process.env.GOOGLE_SHEET_SYNC_HOUR || "15", 10),
    url: id ? `https://docs.google.com/spreadsheets/d/${id}` : null,
  };
}

function getWriteClient() {
  const spreadsheetId = getAttendanceSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error(
      "GOOGLE_ATTENDANCE_SPREADSHEET_ID is not set. Create a spreadsheet, share it with the service account, and set its ID in .env.",
    );
  }
  const creds = getServiceAccountCreds();
  if (!creds) {
    throw new Error(
      "Google service-account credentials missing. Set GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (or GOOGLE_SERVICE_ACCOUNT_JSON) in .env.",
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

export async function buildDailySheetData(targetDate?: Date): Promise<DailySheetData> {
  const now = targetDate || new Date();
  const dayStart = dayStartUTC(now);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const dateKey = dayStart.toISOString().slice(0, 10);
  const formattedDate = fmtDateIST(dayStart);

  const scanWindows = (await prisma.biometricScanWindow.findMany({
    orderBy: { startTime: "asc" },
  })) as unknown as ScanWindowRow[];

  const [students, studentRecords, teachers, teacherRecords] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { user: { isActive: true } },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { studentId: "asc" }],
    }),
    prisma.attendanceRecord.findMany({ where: { date: { gte: dayStart, lt: dayEnd } } }),
    prisma.teacherProfile.findMany({
      where: { user: { isActive: true } },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: [{ employeeId: "asc" }],
    }),
    prisma.teacherAttendanceRecord.findMany({ where: { date: { gte: dayStart, lt: dayEnd } } }),
  ]);

  const sMap = new Map(studentRecords.map((r) => [r.studentId, r]));
  const tMap = new Map(teacherRecords.map((r) => [r.teacherId, r]));

  let sP = 0, sL = 0, sA = 0, tP = 0, tL = 0, tA = 0;
  const rows: string[][] = [];

  for (const s of students) {
    const att = sMap.get(s.id);
    const status = (att?.status as string | undefined) ?? "ABSENT";
    if (status === "PRESENT") sP++;
    else if (status === "LATE") sL++;
    else sA++;
    rows.push([
      `${s.user.firstName} ${s.user.lastName}`.trim(),
      "Talabat",
      (s as { its?: string | null }).its || s.studentId,
      s.section ? `Grade ${s.grade}-${s.section}` : `Grade ${s.grade || "--"}`,
      formattedDate,
      att ? fmtTimeIST(att.checkInTime) : "--",
      att ? matchEvent(att.checkInTime, scanWindows, false) : "--",
      status === "PRESENT" || status === "LATE" ? status : "ABSENT",
      att ? String((att as { source?: string }).source || (att as { verificationMethod?: string }).verificationMethod || "SCAN") : "NOT_MARKED",
    ]);
  }

  for (const t of teachers) {
    const att = tMap.get(t.id);
    const status = (att?.status as string | undefined) ?? "ABSENT";
    if (status === "PRESENT") tP++;
    else if (status === "LATE") tL++;
    else tA++;
    rows.push([
      `${t.user.firstName} ${t.user.lastName}`.trim(),
      "Teacher",
      t.employeeId,
      t.department || "Faculty",
      formattedDate,
      att ? fmtTimeIST(att.checkInTime) : "--",
      att ? matchEvent(att.checkInTime, scanWindows, true) : "--",
      status === "PRESENT" || status === "LATE" ? status : "ABSENT",
      att ? String((att as { verificationMethod?: string }).verificationMethod || "SCAN") : "NOT_MARKED",
    ]);
  }

  const sTotal = students.length;
  const tTotal = teachers.length;
  const sRate = sTotal > 0 ? Math.round(((sP + sL) / sTotal) * 100) : 0;
  const tRate = tTotal > 0 ? Math.round(((tP + tL) / tTotal) * 100) : 0;
  const syncedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST";

  return {
    dateKey,
    formattedDate,
    header: DAILY_HEADER,
    rows,
    summaryRow: [dateKey, sP, sL, sA, sTotal, `${sRate}%`, tP, tL, tA, tTotal, `${tRate}%`, syncedAt],
    stats: {
      studentPresent: sP, studentLate: sL, studentAbsent: sA, studentTotal: sTotal, studentRate: sRate,
      teacherPresent: tP, teacherLate: tL, teacherAbsent: tA, teacherTotal: tTotal, teacherRate: tRate,
    },
  };
}

// ── Sheets write helpers ──────────────────────────────────────────────────

async function ensureTab(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string, title: string): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const exists = (meta.data.sheets || []).some((s) => s.properties?.title === title);
  if (exists) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
}

function sheetTitle(dateKey: string): string {
  return dateKey; // "YYYY-MM-DD" — valid Sheets tab name, sorts chronologically
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

  await ensureTab(sheets, spreadsheetId, SUMMARY_TAB);
  await ensureTab(sheets, spreadsheetId, tab);

  // 1. Daily tab: header + full roster (overwrite → idempotent re-runs)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tab}'!A1:I${data.rows.length + 1}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [data.header, ...data.rows] },
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
      range: `'${SUMMARY_TAB}'!A1:L1`,
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
    range: `'${SUMMARY_TAB}'!A${rowIdx}:L${rowIdx}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [data.summaryRow] },
  });

  // 3. Freeze header rows + autofilter for readability (best-effort)
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
    const idOf = (title: string) =>
      meta.data.sheets?.find((s) => s.properties?.title === title)?.properties?.sheetId;
    const requests: Array<Record<string, unknown>> = [];
    for (const title of [tab, SUMMARY_TAB]) {
      const sid = idOf(title);
      if (sid === undefined || sid === null) continue;
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: sid, gridProperties: { frozenRowCount: 1 } },
          fields: "gridProperties.frozenRowCount",
        },
      });
    }
    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } as never });
    }
  } catch (err) {
    console.warn("[google-sheet-sync] cosmetic formatting skipped:", (err as Error)?.message);
  }

  console.log(
    `[google-sheet-sync] ${data.dateKey}: ${data.rows.length} rows → tab '${tab}' ` +
    `(Talabat P/L/A ${data.stats.studentPresent}/${data.stats.studentLate}/${data.stats.studentAbsent}, ` +
    `Faculty P/L/A ${data.stats.teacherPresent}/${data.stats.teacherLate}/${data.stats.teacherAbsent})`,
  );

  return {
    spreadsheetId,
    tabTitle: tab,
    rowsSynced: data.rows.length,
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
