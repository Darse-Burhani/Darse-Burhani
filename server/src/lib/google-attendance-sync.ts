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
import { fileURLToPath } from "url";
import prisma from "./prisma";
import { eventRangeForRole, getStartOfDayIST } from "./biometric";
import { getHijriMonthInfo } from "./fatimi-calendar";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

const SUMMARY_TAB = "Summary";

// ── Persistent DB Config & In-Memory Cache ──────────────────────────────────

export interface StoredGoogleSheetConfig {
  spreadsheetId?: string;
  serviceAccountJson?: string;
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
  manualSpreadsheetId?: string;
  enabled?: boolean;
  syncHourUtc?: number;
  lastSyncedAt?: string;
  lastSyncedDate?: string;
}

let cachedDbConfig: StoredGoogleSheetConfig | null = null;
let isConfigLoadedFromDb = false;

/**
 * Loads persisted Google Sheets configuration from PostgreSQL (system_settings table)
 * and populates runtime environment and in-memory cache.
 */
export async function loadSheetConfigFromDb(): Promise<StoredGoogleSheetConfig | null> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: "google_sheets_config" },
    });
    if (row?.value && typeof row.value === "object") {
      cachedDbConfig = row.value as StoredGoogleSheetConfig;
      if (cachedDbConfig.spreadsheetId) {
        process.env.GOOGLE_ATTENDANCE_SPREADSHEET_ID = cachedDbConfig.spreadsheetId;
      }
      if (cachedDbConfig.serviceAccountJson) {
        process.env.GOOGLE_SERVICE_ACCOUNT_JSON = cachedDbConfig.serviceAccountJson;
      }
      if (cachedDbConfig.serviceAccountEmail) {
        process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = cachedDbConfig.serviceAccountEmail;
      }
      if (cachedDbConfig.serviceAccountPrivateKey) {
        process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = cachedDbConfig.serviceAccountPrivateKey;
      }
      if (cachedDbConfig.manualSpreadsheetId) {
        process.env.GOOGLE_MANUAL_ATTENDANCE_SPREADSHEET_ID = cachedDbConfig.manualSpreadsheetId;
      }
      if (cachedDbConfig.enabled !== undefined) {
        process.env.GOOGLE_SHEET_DAILY_SYNC = cachedDbConfig.enabled ? "true" : "false";
      }
      if (cachedDbConfig.syncHourUtc !== undefined) {
        process.env.GOOGLE_SHEET_SYNC_HOUR = String(cachedDbConfig.syncHourUtc);
      }
      isConfigLoadedFromDb = true;
      return cachedDbConfig;
    }
  } catch (err) {
    console.warn("[google-attendance-sync] Could not load sheet config from DB:", (err as Error)?.message);
  }
  isConfigLoadedFromDb = true;
  return null;
}

// ── Bulletproof Service Account JSON & Key Parser ─────────────────────────

export function parseServiceAccountJson(input?: string | null): Record<string, any> | null {
  if (!input) return null;
  let str = String(input).trim();
  if (!str) return null;

  // Strip wrapping outer single quotes or double quotes if present
  if ((str.startsWith("'") && str.endsWith("'")) || (str.startsWith('"') && str.endsWith('"'))) {
    str = str.slice(1, -1).trim();
  }

  // Handle escaped quotes inside string
  if (str.includes('\\"') && !str.includes('"type"')) {
    try {
      const unescaped = JSON.parse(`"${str}"`);
      if (typeof unescaped === "string") str = unescaped;
    } catch {}
  }

  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  } catch {
    // Check if user provided base64 encoded JSON
    try {
      const decoded = Buffer.from(str, "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {}
  }

  return null;
}

export function normalizePrivateKey(key?: string | null): string {
  if (!key) return "";
  let clean = String(key).trim();
  // Strip outer quotes
  if ((clean.startsWith("'") && clean.endsWith("'")) || (clean.startsWith('"') && clean.endsWith('"'))) {
    clean = clean.slice(1, -1).trim();
  }
  // Convert literal \n and CRLF to real LF
  clean = clean.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  return clean;
}

// ── Config Extractors ───────────────────────────────────────────────────────

export function extractSpreadsheetId(input: string): string {
  if (!input) return "";
  let trimmed = String(input).trim();
  if (!trimmed) return "";

  // If user pasted an iframe embed snippet: <iframe src=".../spreadsheets/d/ID/edit..."></iframe>
  const iframeMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (iframeMatch && iframeMatch[1]) {
    trimmed = iframeMatch[1].trim();
  }

  // If user accidentally pasted JSON containing spreadsheetId or URL
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.spreadsheetId || parsed.sheetId) {
        return extractSpreadsheetId(parsed.spreadsheetId || parsed.sheetId);
      }
    } catch {
      // not JSON
    }
  }

  // Standard Google Spreadsheet URLs:
  // /spreadsheets/d/<ID>/... or /spreadsheets/u/0/d/<ID>/...
  const match = trimmed.match(/\/spreadsheets\/(?:d|u\/\d+\/d)\/([a-zA-Z0-9-_]+)/i);
  if (match && match[1]) {
    return match[1];
  }

  // Published web spreadsheets: /spreadsheets/d/e/<ID>/...
  const pubMatch = trimmed.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9-_]+)/i);
  if (pubMatch && pubMatch[1]) {
    return pubMatch[1];
  }

  // Clean trailing query params or hashes (e.g. ?gid=0, #gid=0, ?usp=sharing)
  const clean = trimmed.split(/[?#&]/)[0].trim();

  // If path segments exist (e.g. docs.google.com/.../d/123)
  if (clean.includes("/")) {
    const parts = clean.split("/").filter(Boolean);
    const dIdx = parts.indexOf("d");
    if (dIdx !== -1 && parts[dIdx + 1]) {
      return parts[dIdx + 1].trim();
    }
    return parts[parts.length - 1].trim();
  }

  // Remove potential quotes or brackets
  return clean.replace(/['"`[\]]/g, "").trim();
}

export function getAttendanceSpreadsheetId(): string {
  const raw = (
    cachedDbConfig?.spreadsheetId ||
    process.env.GOOGLE_ATTENDANCE_SPREADSHEET_ID ||
    process.env.GOOGLE_ATTENDANCE_SHEET_ID ||
    process.env.GOOGLE_SHEET_ID ||
    ""
  ).trim();
  return extractSpreadsheetId(raw);
}

export function getManualAttendanceSpreadsheetId(): string {
  const raw = (
    cachedDbConfig?.manualSpreadsheetId ||
    process.env.GOOGLE_MANUAL_ATTENDANCE_SPREADSHEET_ID ||
    process.env.GOOGLE_MANUAL_SHEET_ID ||
    cachedDbConfig?.spreadsheetId ||
    process.env.GOOGLE_ATTENDANCE_SPREADSHEET_ID ||
    ""
  ).trim();
  return extractSpreadsheetId(raw);
}

export function getServiceAccountCreds(): { email: string; key: string } | { json: string } | null {
  const jsonRaw = (
    cachedDbConfig?.serviceAccountJson ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    ""
  ).trim();

  if (jsonRaw) {
    const parsed = parseServiceAccountJson(jsonRaw);
    if (parsed?.client_email && parsed?.private_key) {
      return { json: JSON.stringify(parsed) };
    }
  }

  const email = (
    cachedDbConfig?.serviceAccountEmail ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    ""
  ).trim();

  let key = (
    cachedDbConfig?.serviceAccountPrivateKey ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    ""
  ).trim();

  if (!email || !key) return null;
  key = normalizePrivateKey(key);
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
  if (cachedDbConfig) {
    cachedDbConfig.lastSyncedAt = lastSyncedAtIso;
    cachedDbConfig.lastSyncedDate = lastSyncedDateKey;
  }
}

export function sheetSyncStatus() {
  const id = getAttendanceSpreadsheetId();
  const creds = getServiceAccountCreds();
  let saEmail: string | null = null;
  let projectId: string | null = null;

  if (creds) {
    if ("email" in creds) {
      saEmail = creds.email;
    } else if ("json" in creds) {
      const parsed = parseServiceAccountJson(creds.json);
      if (parsed) {
        saEmail = parsed.client_email || null;
        projectId = parsed.project_id || null;
      }
    }
  }

  const hasCreds = Boolean(creds);
  const hasId = Boolean(id);

  return {
    configured: hasId && hasCreds,
    hasSpreadsheetId: hasId,
    hasCredentials: hasCreds,
    spreadsheetId: id || null,
    maskedSpreadsheetId: id ? `${id.slice(0, 6)}…${id.slice(-4)}` : null,
    serviceAccountEmail: saEmail ? `${saEmail.slice(0, 6)}…@${saEmail.split("@")[1] || "gserviceaccount.com"}` : null,
    fullServiceAccountEmail: saEmail,
    projectId,
    enabled: process.env.GOOGLE_SHEET_DAILY_SYNC !== "false",
    syncHourUtc: parseInt(process.env.GOOGLE_SHEET_SYNC_HOUR || String(cachedDbConfig?.syncHourUtc || "15"), 10),
    url: id ? `https://docs.google.com/spreadsheets/d/${id}` : null,
    lastSyncedAt: lastSyncedAtIso || cachedDbConfig?.lastSyncedAt || null,
    lastSyncedDate: lastSyncedDateKey || cachedDbConfig?.lastSyncedDate || null,
  };
}

// ── Centralized JWT Auth Client Generator ──────────────────────────────────

export function createGoogleAuthClient(credsParam?: {
  serviceAccountJson?: string;
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
}): { auth: any; email: string } {
  let saEmail = "";
  let privateKey = "";

  const customJson = credsParam?.serviceAccountJson?.trim();
  if (customJson) {
    const parsed = parseServiceAccountJson(customJson);
    if (!parsed) {
      throw new Error("Invalid Service Account JSON key format. Please ensure you copied the full JSON file from Google Cloud Console.");
    }
    if (!parsed.client_email) {
      throw new Error("Missing 'client_email' in Service Account JSON key.");
    }
    if (!parsed.private_key) {
      throw new Error("Missing 'private_key' in Service Account JSON key.");
    }
    saEmail = parsed.client_email.trim();
    privateKey = normalizePrivateKey(parsed.private_key);
  } else if (credsParam?.serviceAccountEmail && credsParam?.serviceAccountPrivateKey) {
    saEmail = credsParam.serviceAccountEmail.trim();
    privateKey = normalizePrivateKey(credsParam.serviceAccountPrivateKey);
  } else {
    const creds = getServiceAccountCreds();
    if (!creds) {
      throw new Error(
        "Google Service Account is not configured. Please paste your Service Account JSON key in Admin → Google Sheets Settings."
      );
    }
    if ("json" in creds) {
      const parsed = parseServiceAccountJson(creds.json);
      if (!parsed?.client_email || !parsed?.private_key) {
        throw new Error("Stored Service Account JSON key could not be parsed.");
      }
      saEmail = parsed.client_email.trim();
      privateKey = normalizePrivateKey(parsed.private_key);
    } else {
      saEmail = creds.email;
      privateKey = normalizePrivateKey(creds.key);
    }
  }

  if (!privateKey.includes("BEGIN PRIVATE KEY")) {
    throw new Error("Invalid Google Private Key: Missing '-----BEGIN PRIVATE KEY-----' header.");
  }

  const auth = new google.auth.JWT({
    email: saEmail,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });

  return { auth, email: saEmail };
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
    throw new Error("Missing Google Spreadsheet ID or URL. Please paste your Google Sheet link or ID.");
  }

  const { auth, email: saEmail } = createGoogleAuthClient(custom);

  try {
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
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes("The caller does not have permission") || err?.code === 403) {
      throw new Error(
        `Permission Denied (403): The spreadsheet is not shared with the service account. Please open your Google Sheet, click the blue 'Share' button at top-right, and share it with "${saEmail || "your service account email"}" as Editor.`
      );
    }
    if (msg.includes("Requested entity was not found") || err?.code === 404) {
      throw new Error(
        `Spreadsheet Not Found (404): No spreadsheet found with ID "${spreadsheetId}". Please verify the URL or ID you pasted.`
      );
    }
    if (msg.includes("API has not been used in project") || msg.includes("disabled")) {
      throw new Error(
        `Google Sheets API is disabled in your Google Cloud Project. Please visit Google Cloud Console → APIs & Services and enable "Google Sheets API".`
      );
    }
    throw new Error(`Google Sheets connection error: ${msg}`);
  }
}

export async function saveSheetConfiguration(config: {
  spreadsheetId?: string;
  serviceAccountJson?: string;
  serviceAccountEmail?: string;
  serviceAccountPrivateKey?: string;
  manualSpreadsheetId?: string;
  enabled?: boolean;
  syncHourUtc?: number;
}): Promise<void> {
  let cleanId = "";
  let rawJson = (config.serviceAccountJson || "").trim();

  // Detect if user pasted Service Account JSON into spreadsheetId field
  const rawId = (config.spreadsheetId || "").trim();
  if (rawId.startsWith("{") && (rawId.includes("client_email") || rawId.includes("project_id"))) {
    rawJson = rawId;
  } else {
    cleanId = extractSpreadsheetId(rawId);
  }

  // Detect if user pasted sheet URL into serviceAccountJson field
  if (rawJson && (rawJson.includes("docs.google.com/spreadsheets") || (!rawJson.includes("{") && !rawJson.includes("BEGIN PRIVATE KEY")))) {
    const extracted = extractSpreadsheetId(rawJson);
    if (extracted && !cleanId) {
      cleanId = extracted;
      rawJson = "";
    }
  }

  let cleanManualId = "";
  if (config.manualSpreadsheetId) {
    cleanManualId = extractSpreadsheetId(config.manualSpreadsheetId);
  }

  let parsedEmail: string | undefined = config.serviceAccountEmail?.trim();
  let parsedKey: string | undefined = config.serviceAccountPrivateKey?.trim();
  let cleanJsonStr: string | undefined = undefined;

  if (rawJson) {
    const parsed = parseServiceAccountJson(rawJson);
    if (parsed) {
      if (parsed.client_email) parsedEmail = parsed.client_email.trim();
      if (parsed.private_key) parsedKey = parsed.private_key.trim();
      cleanJsonStr = JSON.stringify(parsed);
    } else {
      cleanJsonStr = rawJson;
    }
  }

  if (cleanId) {
    process.env.GOOGLE_ATTENDANCE_SPREADSHEET_ID = cleanId;
  }
  if (cleanManualId) {
    process.env.GOOGLE_MANUAL_ATTENDANCE_SPREADSHEET_ID = cleanManualId;
  }
  if (cleanJsonStr) {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = cleanJsonStr;
  }
  if (parsedEmail) {
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = parsedEmail;
  }
  if (parsedKey) {
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = parsedKey;
  }
  if (config.enabled !== undefined) {
    process.env.GOOGLE_SHEET_DAILY_SYNC = config.enabled ? "true" : "false";
  }
  if (config.syncHourUtc !== undefined) {
    process.env.GOOGLE_SHEET_SYNC_HOUR = String(config.syncHourUtc);
  }

  // Update in-memory cache
  cachedDbConfig = {
    spreadsheetId: cleanId || cachedDbConfig?.spreadsheetId || process.env.GOOGLE_ATTENDANCE_SPREADSHEET_ID,
    manualSpreadsheetId: cleanManualId || cachedDbConfig?.manualSpreadsheetId || process.env.GOOGLE_MANUAL_ATTENDANCE_SPREADSHEET_ID,
    serviceAccountJson: cleanJsonStr || cachedDbConfig?.serviceAccountJson || process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    serviceAccountEmail: parsedEmail || cachedDbConfig?.serviceAccountEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    serviceAccountPrivateKey: parsedKey || cachedDbConfig?.serviceAccountPrivateKey || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
    enabled: config.enabled !== undefined ? config.enabled : (cachedDbConfig?.enabled ?? true),
    syncHourUtc: config.syncHourUtc !== undefined ? config.syncHourUtc : (cachedDbConfig?.syncHourUtc ?? 15),
    lastSyncedAt: lastSyncedAtIso || cachedDbConfig?.lastSyncedAt,
    lastSyncedDate: lastSyncedDateKey || cachedDbConfig?.lastSyncedDate,
  };
  isConfigLoadedFromDb = true;

  // Persist to PostgreSQL database (Prisma SystemSetting table)
  try {
    await prisma.systemSetting.upsert({
      where: { key: "google_sheets_config" },
      update: { value: cachedDbConfig as any },
      create: { key: "google_sheets_config", value: cachedDbConfig as any },
    });
    console.log("[google-attendance-sync] Saved Google Sheets configuration to database (SystemSetting: google_sheets_config).");
  } catch (dbErr) {
    console.warn("[google-attendance-sync] Warning: Could not persist config to DB SystemSetting:", (dbErr as Error)?.message);
  }

  // Also persist to .env files on disk if possible
  const candidatePaths = Array.from(new Set([
    path.resolve(repoRoot, ".env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../.env"),
  ]));

  for (const envPath of candidatePaths) {
    try {
      if (!fs.existsSync(envPath)) continue;
      let content = fs.readFileSync(envPath, "utf8");

      const setEnvVar = (k: string, v: string) => {
        const reg = new RegExp(`^(?:#\\s*)?${k}=.*$`, "m");
        if (reg.test(content)) {
          content = content.replace(reg, `${k}=${v}`);
        } else {
          content = content.trimEnd() + `\n${k}=${v}\n`;
        }
      };

      if (cleanId) setEnvVar("GOOGLE_ATTENDANCE_SPREADSHEET_ID", `"${cleanId}"`);
      if (cleanManualId) setEnvVar("GOOGLE_MANUAL_ATTENDANCE_SPREADSHEET_ID", `"${cleanManualId}"`);
      if (cleanJsonStr) setEnvVar("GOOGLE_SERVICE_ACCOUNT_JSON", JSON.stringify(cleanJsonStr));
      if (parsedEmail) setEnvVar("GOOGLE_SERVICE_ACCOUNT_EMAIL", `"${parsedEmail}"`);
      if (parsedKey) {
        const escapedKey = parsedKey.replace(/\r?\n/g, "\\n");
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
      console.warn(`[google-sheet-sync] Warning: Could not persist to ${envPath}:`, (err as Error)?.message);
    }
  }
}

export function getWriteClient(customSpreadsheetId?: string) {
  const spreadsheetId = extractSpreadsheetId(customSpreadsheetId || getAttendanceSpreadsheetId());
  if (!spreadsheetId) {
    throw new Error(
      "Google Spreadsheet ID/URL is not configured. Open Admin → Google Sheets Settings and paste your Google Sheet link or ID."
    );
  }
  const { auth, email } = createGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth: auth as never });
  return { sheets, spreadsheetId, serviceAccountEmail: email };
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
  notesOrRemarks?: string | null,
): string {
  // 1. If notes or remarks mention a specific manual event name, prioritize it
  if (notesOrRemarks) {
    const manualMatch = notesOrRemarks.match(/Manual mark \(([^)]+)\)/i);
    if (manualMatch && manualMatch[1] && manualMatch[1] !== "Scheduled Event") {
      return manualMatch[1].trim();
    }
    // Also check if any scan window name is mentioned in the notes
    for (const w of windows) {
      if (w.name && notesOrRemarks.toLowerCase().includes(w.name.toLowerCase())) {
        return w.name;
      }
    }
  }

  // 2. If checkIn exists, match by IST time
  if (checkIn) {
    const d = new Date(checkIn);
    if (!Number.isNaN(d.getTime())) {
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
      if (hit.length > 0) {
        hit.sort((a, b) => a.startTime.localeCompare(b.startTime));
        return hit[0].name;
      }
    }
  }

  // 3. Fallback for manual marks
  if (notesOrRemarks && /manual/i.test(notesOrRemarks)) {
    const manualWindow = windows.find((w) => (w as any).windowType === "MANUAL" || w.id.startsWith("manual_"));
    if (manualWindow) return manualWindow.name;
    return "Manual Roll Call";
  }

  return checkIn ? "Unscheduled" : "--";
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
  footerRowIndex: number;
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

function resolvePublicImageUrl(photoUrl?: string | null): string | null {
  if (!photoUrl) return null;
  const trimmed = photoUrl.trim();
  if (!trimmed) return null;

  const publicBase = (
    process.env.CLOUDFLARE_TUNNEL_URL ||
    process.env.PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    ""
  ).trim().replace(/\/+$/, "");

  // If already a full URL (http/https)
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    if (trimmed.includes("localhost") || trimmed.includes("127.0.0.1")) {
      if (publicBase && !publicBase.includes("localhost") && !publicBase.includes("127.0.0.1")) {
        const pathPart = trimmed.replace(/^https?:\/\/[^\/]+/, "");
        return `${publicBase}${pathPart.startsWith("/") ? "" : "/"}${pathPart}`;
      }
      return null;
    }
    return trimmed;
  }

  // If relative path (e.g., /uploads/talabat/...)
  if (publicBase && !publicBase.includes("localhost") && !publicBase.includes("127.0.0.1")) {
    const formattedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${publicBase}${formattedPath}`;
  }

  return null;
}

function getPhotoFormula(name: string, photoUrl?: string | null, isFaculty?: boolean): string {
  const bg = isFaculty ? "1E1B4B" : "042F24";
  const fg = isFaculty ? "FDE047" : "D4AF37";
  const fallbackUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=${fg}&bold=true&size=128`;
  
  const publicUrl = resolvePublicImageUrl(photoUrl);
  if (publicUrl) {
    return `=IFERROR(IMAGE("${publicUrl}"), IMAGE("${fallbackUrl}"))`;
  }
  return `=IMAGE("${fallbackUrl}")`;
}

// ── Automatic Background Sync Queue ───────────────────────────────────────

let autoSyncTimeout: NodeJS.Timeout | null = null;
let pendingDate: Date | null = null;

/**
 * Debounced auto-sync to Google Sheet triggered immediately upon biometric scans or manual edits.
 * Debounced by 5 seconds to batch rapid bursts of scans into a single efficient sheet update.
 */
export function queueAutoSheetSync(targetDate?: Date): void {
  if (process.env.GOOGLE_SHEET_DAILY_SYNC === "false") return;
  if (!isSheetSyncConfigured()) return;

  pendingDate = targetDate || new Date();

  if (autoSyncTimeout) {
    clearTimeout(autoSyncTimeout);
  }

  autoSyncTimeout = setTimeout(async () => {
    try {
      const d = pendingDate || new Date();
      console.log(`[google-sheet-sync] auto-syncing scans for ${d.toISOString().slice(0, 10)} to Google Sheet...`);
      await syncDailyAttendanceToSheet(d);
      markSheetSyncRan(d.toISOString().slice(0, 10));
    } catch (err) {
      console.warn("[google-sheet-sync] auto-sync notification failed:", (err as Error)?.message);
    } finally {
      autoSyncTimeout = null;
    }
  }, 5000);
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

  const rawStudents = await prisma.studentProfile.findMany({
    where: {
      user: { isActive: true, deletedAt: null },
    },
    include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: [{ grade: "asc" }, { section: "asc" }, { studentId: "asc" }],
  });

  const [studentRecords, studentRegistries] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
    }),
    prisma.attendanceRegistry.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
    }),
  ]);

  const rawTeachers = await prisma.teacherProfile.findMany({
    where: {
      user: { isActive: true, deletedAt: null },
    },
    include: { user: { select: { firstName: true, lastName: true, avatarUrl: true } } },
    orderBy: [{ department: "asc" }, { employeeId: "asc" }],
  });

  const teacherRecords = await prisma.teacherAttendanceRecord.findMany({
    where: { date: { gte: dayStart, lt: dayEnd } },
  });

  const sMap = new Map(studentRecords.map((r) => [r.studentId, r]));
  const regMap = new Map(studentRegistries.map((r) => [r.studentId, r]));
  const tMap = new Map(teacherRecords.map((r) => [r.teacherId, r]));

  // Ensure full roster (all active members) appear cleanly on Google Sheet
  const students = rawStudents;
  const teachers = rawTeachers;

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
    const reg = regMap.get(s.id);
    const effectiveAtt = att || reg;
    const activeLeave = sLeaveMap.get(s.id);
    const activeMed = sMedMap.get(s.id);
    const fullName = `${s.user.firstName} ${s.user.lastName}`.trim();
    const notes = att?.justification || reg?.remarks || null;

    let status = (att?.status || reg?.status || "ABSENT") as string;
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
      source = effectiveAtt ? String((effectiveAtt as { source?: string }).source || "SCAN") : "SCAN";
    } else if (status === "LATE") {
      sL++;
      source = effectiveAtt ? String((effectiveAtt as { source?: string }).source || "SCAN") : "SCAN";
    } else if (status === "ON_LEAVE" || status === "MEDICAL") {
      sLeave++;
      source = "EXCUSED";
      reason = status === "MEDICAL" ? "Medical Exemption" : "On Leave";
    } else if (dayStart.getUTCDay() === 0) {
      status = "HOLIDAY";
      sLeave++;
      source = "HOLIDAY";
      reason = "Sunday Institutional Holiday";
    } else {
      status = "ABSENT";
      sA++;
      source = "UNSCANNED";
    }

    const eventName = matchEvent(effectiveAtt?.checkInTime, scanWindows, false, notes);

    talabatDataRows.push([
      getPhotoFormula(fullName, s.user.avatarUrl, false),
      fullName,
      "Talabat",
      (s as { its?: string | null }).its || s.studentId,
      s.section ? `Grade ${s.grade}-${s.section}` : `Grade ${s.grade || "--"}`,
      formattedDate,
      effectiveAtt ? fmtTimeIST(effectiveAtt.checkInTime) : "--",
      effectiveAtt ? eventName : "--",
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
    const teacherNotes = (att as { notes?: string })?.notes || null;

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
      reason = status === "MEDICAL" ? "Medical Leave" : (teacherNotes || "On Holiday / Leave");
    } else if (dayStart.getUTCDay() === 0) {
      status = "HOLIDAY";
      tLeave++;
      source = "HOLIDAY";
      reason = "Sunday Institutional Holiday";
    } else {
      status = "ABSENT";
      tA++;
      source = "UNSCANNED";
    }

    const eventName = matchEvent(att?.checkInTime, scanWindows, true, teacherNotes);

    facultyDataRows.push([
      getPhotoFormula(fullName, t.photoUrl || t.user.avatarUrl, true),
      fullName,
      "Faculty",
      t.employeeId || (t as { its?: string | null }).its || "—",
      t.department || "Faculty",
      formattedDate,
      att ? fmtTimeIST(att.checkInTime) : "--",
      att ? eventName : "--",
      status,
      source,
      reason,
    ]);
  }

  const sTotal = students.length;
  const tTotal = teachers.length;
  const sRate = sTotal > 0 ? Math.round(((sP + sL) / sTotal) * 100) : 0;
  const tRate = tTotal > 0 ? Math.round(((tP + tL) / tTotal) * 100) : 0;
  const overallTotal = sTotal + tTotal;
  const overallPresent = sP + sL + tP + tL;
  const overallRate = overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;
  const syncedAt = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST";

  // Build the complete combined bifurcated worksheet matrix with top KPI Executive Summary
  const allValues: string[][] = [];

  // ── ROW 1: Executive Title Header ──
  allValues.push([`DARSE BURHANI — DAILY ATTENDANCE & BIOMETRIC REPORT`, "", "", "", "", "", "", "", "", "", ""]);
  
  // ── ROW 2: Metadata / Timestamp Subtitle ──
  allValues.push([`Date: ${formattedDate}  |  Last Synced: ${syncedAt}  |  Auto-Synced via Biometric Cloud Gateway`, "", "", "", "", "", "", "", "", "", ""]);
  
  // ── ROW 3: Executive Metric Dashboard Header ──
  allValues.push([
    "TALABAT (STUDENTS) SUMMARY", "", "",
    "FACULTY (STAFF) SUMMARY", "", "", "",
    "OVERALL INSTITUTION COMPLIANCE", "", "", ""
  ]);

  // ── ROW 4: Executive Metric Dashboard Values ──
  allValues.push([
    `Enrolled: ${sTotal}  |  Present: ${sP}  |  Late: ${sL}  |  Leave: ${sLeave}  |  Absent: ${sA}  |  Turnout: ${sRate}%`, "", "",
    `Enrolled: ${tTotal}  |  Present: ${tP}  |  Late: ${tL}  |  Leave: ${tLeave}  |  Absent: ${tA}  |  Turnout: ${tRate}%`, "", "", "",
    `Total Roster: ${overallTotal}  |  Attended: ${overallPresent}  |  Rate: ${overallRate}%  |  Status: ${overallRate >= 80 ? "EXCELLENT" : "ATTENTION"}`, "", "", ""
  ]);

  // ── ROW 5: Divider Spacer ──
  allValues.push(["", "", "", "", "", "", "", "", "", "", ""]);

  // ── ROW 6: Talabat Section Header ──
  const talabatSectionRowIndex = allValues.length;
  allValues.push([`🎓 TALABAT (STUDENTS) ATTENDANCE ROSTER — ${sTotal} Students (${sP + sL} Present · ${sRate}% Turnout)`, "", "", "", "", "", "", "", "", "", ""]);
  
  // ── ROW 7: Talabat Table Header ──
  const talabatHeaderRowIndex = allValues.length;
  allValues.push(TALABAT_HEADER);
  
  // ── Talabat Data Rows ──
  const talabatStartRowIndex = allValues.length;
  allValues.push(...talabatDataRows);

  // ── Spacer ──
  allValues.push(["", "", "", "", "", "", "", "", "", "", ""]);

  // ── Faculty Section Header ──
  const facultySectionRowIndex = allValues.length;
  allValues.push([`👨‍🏫 FACULTY (TEACHERS & STAFF) ATTENDANCE ROSTER — ${tTotal} Members (${tP + tL} Present · ${tRate}% Turnout)`, "", "", "", "", "", "", "", "", "", ""]);
  
  // ── Faculty Table Header ──
  const facultyHeaderRowIndex = allValues.length;
  allValues.push(FACULTY_HEADER);
  
  // ── Faculty Data Rows ──
  const facultyStartRowIndex = allValues.length;
  allValues.push(...facultyDataRows);

  // ── Spacer & Footer ──
  allValues.push(["", "", "", "", "", "", "", "", "", "", ""]);
  const footerRowIndex = allValues.length;
  allValues.push([`DARSE BURHANI OFFICIAL ATTENDANCE ARCHIVE — CONFIDENTIAL & PRIVILEGED • GENERATED ${syncedAt}`, "", "", "", "", "", "", "", "", "", ""]);

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
    footerRowIndex,
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
      `${overallRate}%`,
      overallRate >= 80 ? "EXCELLENT" : "ATTENTION",
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

export async function ensureTab(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  title: string,
  initialRows = 100,
  initialCols = 15
): Promise<number | undefined> {
  const cleanTitle = title.trim();
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
    const existing = (meta.data.sheets || []).find(
      (s) => s.properties?.title?.trim().toLowerCase() === cleanTitle.toLowerCase()
    );
    if (typeof existing?.properties?.sheetId === "number") {
      return existing.properties.sheetId;
    }
    const addRes = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: cleanTitle,
                gridProperties: { rowCount: initialRows, columnCount: initialCols },
              },
            },
          },
        ],
      },
    });
    const newId = addRes.data.replies?.[0]?.addSheet?.properties?.sheetId;
    return typeof newId === "number" ? newId : undefined;
  } catch (err: any) {
    if (err?.message?.includes("already exists")) {
      const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
      const found = (meta.data.sheets || []).find(
        (s) => s.properties?.title?.trim().toLowerCase() === cleanTitle.toLowerCase()
      );
      return typeof found?.properties?.sheetId === "number" ? found.properties.sheetId : undefined;
    }
    throw err;
  }
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

  await ensureTab(sheets, spreadsheetId, SUMMARY_TAB);
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
      range: `'${SUMMARY_TAB}'!A1:P1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[
        "Date",
        "Talabat Present",
        "Talabat Late",
        "Talabat Leave",
        "Talabat Absent",
        "Talabat Total",
        "Talabat %",
        "Faculty Present",
        "Faculty Late",
        "Faculty Leave",
        "Faculty Absent",
        "Faculty Total",
        "Faculty %",
        "Overall %",
        "Compliance",
        "Last Synced (IST)",
      ]] },
    });
  }
  const rowIdx = colA.length === 0 ? 2 : (() => {
    const found = colA.findIndex((r) => String(r?.[0] || "").trim() === data.dateKey);
    return found >= 0 ? found + 1 : colA.length + 1;
  })();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${SUMMARY_TAB}'!A${rowIdx}:P${rowIdx}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [data.summaryRow] },
  });

  // 3. Apply High-End Fatimi Emerald & Gold Formatting
  if (daySheetId !== undefined) {
    try {
      const requests: Array<Record<string, unknown>> = [];

      // A. Freeze Top 7 Rows (Title + Metric Cards + Table Header remain fixed when scrolling!)
      requests.push({
        updateSheetProperties: {
          properties: { sheetId: daySheetId, gridProperties: { frozenRowCount: 7 } },
          fields: "gridProperties.frozenRowCount",
        },
      });

      // B. Custom Column Widths (A: Photo 65px, B: Name 200px, C: Role 85px, D: ITS 110px, E: Class 135px, F: Date 95px, G: Time 125px, H: Event 135px, I: Status 115px, J: Source 120px, K: Reason 240px)
      const colWidths = [65, 200, 85, 110, 135, 95, 125, 135, 115, 120, 240];
      colWidths.forEach((pixelSize, idx) => {
        requests.push({
          updateDimensionProperties: {
            range: { sheetId: daySheetId, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
            properties: { pixelSize },
            fields: "pixelSize",
          },
        });
      });

      // C. Set Data Row Heights to 46px so photos & text are crisp and prominent
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

      // D. Merge Title & Header Cells
      requests.push(
        // Row 1: Title Banner A1:K1
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 }, mergeType: "MERGE_ALL" } },
        // Row 2: Subtitle A2:K2
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 11 }, mergeType: "MERGE_ALL" } },
        // Row 3: Cards Headers
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 3 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 3, endColumnIndex: 7 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 7, endColumnIndex: 11 }, mergeType: "MERGE_ALL" } },
        // Row 4: Cards Values
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 3 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 3, endColumnIndex: 7 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 7, endColumnIndex: 11 }, mergeType: "MERGE_ALL" } },
        // Talabat Section Header
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: data.talabatSectionRowIndex, endRowIndex: data.talabatSectionRowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 }, mergeType: "MERGE_ALL" } },
        // Faculty Section Header
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: data.facultySectionRowIndex, endRowIndex: data.facultySectionRowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 }, mergeType: "MERGE_ALL" } },
        // Footer Row
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: data.footerRowIndex, endRowIndex: data.footerRowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 }, mergeType: "MERGE_ALL" } }
      );

      // E. Style Row 1 (Title: Dark Emerald #042F24, Gold #FDE047, Bold 12pt)
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.015, green: 0.184, blue: 0.141 },
              textFormat: { foregroundColor: { red: 0.992, green: 0.878, blue: 0.278 }, bold: true, fontSize: 12 },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      });

      // F. Style Row 2 (Subtitle: Slate 900 #0F172A, Slate 300 text, 9.5pt)
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.058, green: 0.09, blue: 0.165 },
              textFormat: { foregroundColor: { red: 0.8, green: 0.85, blue: 0.9 }, fontSize: 9 },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      });

      // G. Style Row 3 (Cards Headers)
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.12, green: 0.16, blue: 0.23 },
              textFormat: { foregroundColor: { red: 0.992, green: 0.878, blue: 0.278 }, bold: true, fontSize: 9.5 },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      });

      // H. Style Row 4 (Cards Values)
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.95, green: 0.97, blue: 0.98 },
              textFormat: { foregroundColor: { red: 0.05, green: 0.1, blue: 0.2 }, bold: true, fontSize: 9.5 },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      });

      // I. Style Talabat Section Header
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: data.talabatSectionRowIndex, endRowIndex: data.talabatSectionRowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.024, green: 0.306, blue: 0.231 }, // #064E3B
              textFormat: { foregroundColor: { red: 0.992, green: 0.878, blue: 0.278 }, bold: true, fontSize: 11 },
              horizontalAlignment: "LEFT",
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      });

      // J. Style Talabat Table Header
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: data.talabatHeaderRowIndex, endRowIndex: data.talabatHeaderRowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.058, green: 0.09, blue: 0.165 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
              verticalAlignment: "MIDDLE",
              horizontalAlignment: "CENTER",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)",
        },
      });

      // K. Style Faculty Section Header
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: data.facultySectionRowIndex, endRowIndex: data.facultySectionRowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.118, green: 0.106, blue: 0.294 }, // #1E1B4B
              textFormat: { foregroundColor: { red: 0.992, green: 0.878, blue: 0.278 }, bold: true, fontSize: 11 },
              horizontalAlignment: "LEFT",
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      });

      // L. Style Faculty Table Header
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

      // M. Style Footer Row
      requests.push({
        repeatCell: {
          range: { sheetId: daySheetId, startRowIndex: data.footerRowIndex, endRowIndex: data.footerRowIndex + 1, startColumnIndex: 0, endColumnIndex: 11 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.94, green: 0.96, blue: 0.98 },
              textFormat: { foregroundColor: { red: 0.4, green: 0.45, blue: 0.55 }, italic: true, fontSize: 8.5 },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      });

      // N. Vertical Middle Alignment for all cells in sheet
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

      // O. Center Alignment for ID, Class, Time, Window, Status, Verification columns
      [0, 2, 3, 4, 5, 6, 7, 8, 9].forEach((colIdx) => {
        if (data.talabatCount > 0) {
          requests.push({
            repeatCell: {
              range: { sheetId: daySheetId, startRowIndex: data.talabatStartRowIndex, endRowIndex: talabatEnd, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
              cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
              fields: "userEnteredFormat.horizontalAlignment",
            },
          });
        }
        if (data.facultyCount > 0) {
          requests.push({
            repeatCell: {
              range: { sheetId: daySheetId, startRowIndex: data.facultyStartRowIndex, endRowIndex: facultyEnd, startColumnIndex: colIdx, endColumnIndex: colIdx + 1 },
              cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
              fields: "userEnteredFormat.horizontalAlignment",
            },
          });
        }
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

  // Also update the Monthly Master Sheet tab so the new month has a proper catchy display table
  syncMonthlyAttendanceToSheet(data.dateKey.slice(0, 7)).catch((err) => {
    console.warn("[google-sheet-sync] monthly sheet sync notice:", (err as Error)?.message || err);
  });

  return {
    spreadsheetId,
    tabTitle: tab,
    rowsSynced: data.talabatCount + data.facultyCount,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    stats: data.stats,
  };
}

/**
 * Builds and syncs a high-end Monthly Attendance Register tab with catchy display tables,
 * executive KPI summary cards, and bifurcated Talabat & Faculty monthly percentages.
 */
export async function syncMonthlyAttendanceToSheet(targetMonth?: string): Promise<{
  spreadsheetId: string;
  tabTitle: string;
  url: string;
}> {
  const { sheets, spreadsheetId } = getWriteClient();
  const now = new Date();
  const monthKey = targetMonth || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let monthStartDate: Date;
  let monthEndDate: Date;
  let monthName: string;

  if (monthKey.startsWith("H")) {
    const parts = monthKey.slice(1).split("-");
    const hYear = parseInt(parts[0], 10) || 1448;
    const hMonth = parseInt(parts[1], 10) || 5;
    const hInfo = getHijriMonthInfo(hYear, hMonth);
    monthStartDate = new Date(Date.UTC(hInfo.gregorianStart.year, hInfo.gregorianStart.month - 1, hInfo.gregorianStart.day, 0, 0, 0));
    monthEndDate = new Date(Date.UTC(hInfo.gregorianEnd.year, hInfo.gregorianEnd.month - 1, hInfo.gregorianEnd.day, 23, 59, 59));
    monthName = `${hInfo.monthName} ${hYear}H`;
  } else {
    const [yearStr, monthStr] = monthKey.split("-");
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    monthStartDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0));
    monthEndDate = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59));
    monthName = monthStartDate.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  }

  const tabTitle = `Monthly - ${monthName}`;
  const daySheetId = await ensureTab(sheets, spreadsheetId, tabTitle, 400, 15);

  // Fetch all active Talabat and Faculty with monthly attendance
  const [students, teachers, studentRecords, teacherRecords] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { user: { isActive: true, deletedAt: null } },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: [{ grade: "asc" }, { section: "asc" }],
    }),
    prisma.teacherProfile.findMany({
      where: { user: { isActive: true, deletedAt: null } },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { employeeId: "asc" },
    }),
    prisma.attendanceRecord.findMany({
      where: { date: { gte: monthStartDate, lte: monthEndDate } },
      select: { studentId: true, status: true },
    }),
    prisma.teacherAttendanceRecord.findMany({
      where: { date: { gte: monthStartDate, lte: monthEndDate } },
      select: { teacherId: true, status: true },
    }),
  ]);

  // Aggregate student stats
  const studentStatsMap = new Map<string, { present: number; late: number; leave: number; absent: number }>();
  for (const r of studentRecords) {
    if (!studentStatsMap.has(r.studentId)) {
      studentStatsMap.set(r.studentId, { present: 0, late: 0, leave: 0, absent: 0 });
    }
    const s = studentStatsMap.get(r.studentId)!;
    if (r.status === "PRESENT") s.present++;
    else if (r.status === "LATE") s.late++;
    else if (r.status === "ON_LEAVE" || r.status === "MEDICAL") s.leave++;
    else if (r.status === "ABSENT") s.absent++;
  }

  // Aggregate teacher stats
  const teacherStatsMap = new Map<string, { present: number; late: number; absent: number }>();
  for (const tr of teacherRecords) {
    if (!teacherStatsMap.has(tr.teacherId)) {
      teacherStatsMap.set(tr.teacherId, { present: 0, late: 0, absent: 0 });
    }
    const t = teacherStatsMap.get(tr.teacherId)!;
    if (tr.status === "PRESENT") t.present++;
    else if (tr.status === "LATE") t.late++;
    else if (tr.status === "ABSENT") t.absent++;
  }

  // Build matrix
  const allValues: string[][] = [];

  // ROW 1: Banner Header
  allValues.push([`DARSE BURHANI OFFICIAL MONTHLY ATTENDANCE REGISTER — ${monthName.toUpperCase()}`, "", "", "", "", "", "", "", "", "", "", ""]);
  // ROW 2: Subtitle
  allValues.push([`Monthly Biometric Scanning & Classroom Roll-Call Matrix • Generated ${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST`, "", "", "", "", "", "", "", "", "", "", ""]);

  // Calculate overall metrics
  let totalStudentAttended = 0;
  let totalStudentExpected = 0;
  const talabatRows: string[][] = students.map((st) => {
    const s = studentStatsMap.get(st.id) || { present: 0, late: 0, leave: 0, absent: 0 };
    const total = s.present + s.late + s.leave + s.absent;
    const attended = s.present + s.late;
    totalStudentAttended += attended;
    totalStudentExpected += total;
    const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
    const statusLabel = pct >= 90 ? "MUMTAZ 🌟" : pct >= 80 ? "JAYYID JIDDAN" : pct >= 70 ? "JAYYID" : "NEEDS ATTENTION";
    return [
      `${st.user.firstName} ${st.user.lastName}`.trim(),
      st.its || "—",
      st.studentId,
      st.grade || "—",
      st.section || "—",
      String(s.present),
      String(s.late),
      String(s.leave),
      String(s.absent),
      String(total),
      `${pct}%`,
      statusLabel,
    ];
  });

  let totalTeacherAttended = 0;
  let totalTeacherExpected = 0;
  const facultyRows: string[][] = teachers.map((tc) => {
    const t = teacherStatsMap.get(tc.id) || { present: 0, late: 0, absent: 0 };
    const total = t.present + t.late + t.absent;
    const attended = t.present + t.late;
    totalTeacherAttended += attended;
    totalTeacherExpected += total;
    const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
    const compliance = pct >= 85 ? "EXCELLENT" : pct >= 75 ? "GOOD" : "ATTENTION";
    return [
      `${tc.user.firstName} ${tc.user.lastName}`.trim(),
      tc.employeeId || tc.its || "—",
      tc.department || "Attalimiyah",
      tc.khidmatMauze || "PAKHTI",
      String(t.present),
      String(t.late),
      String(t.absent),
      String(total),
      `${pct}%`,
      compliance,
      "",
      "",
    ];
  });

  const talabatTurnout = totalStudentExpected > 0 ? Math.round((totalStudentAttended / totalStudentExpected) * 100) : 0;
  const facultyTurnout = totalTeacherExpected > 0 ? Math.round((totalTeacherAttended / totalTeacherExpected) * 100) : 0;

  // ROW 3: KPI Header Titles
  allValues.push([
    "TALABAT MONTHLY TURNOUT", "", "", "",
    "FACULTY MONTHLY TURNOUT", "", "", "",
    "INSTITUTIONAL PERFORMANCE", "", "", "",
  ]);

  // ROW 4: KPI Values
  allValues.push([
    `Students: ${students.length}  |  Monthly Rate: ${talabatTurnout}%`, "", "", "",
    `Faculty: ${teachers.length}  |  Monthly Rate: ${facultyTurnout}%`, "", "", "",
    `Month: ${monthName}  |  Turnout Status: ${talabatTurnout >= 80 ? "EXCELLENT" : "OPERATIONAL"}`, "", "", "",
  ]);

  // ROW 5: Spacer
  allValues.push(["", "", "", "", "", "", "", "", "", "", "", ""]);

  // ROW 6: Talabat Section Header
  const talabatSectionRowIndex = allValues.length;
  allValues.push([`🎓 TALABAT (STUDENTS) MONTHLY ATTENDANCE REGISTER — ${students.length} Students (${talabatTurnout}% Monthly Turnout)`, "", "", "", "", "", "", "", "", "", "", ""]);

  // ROW 7: Talabat Columns Header
  const talabatHeaderRowIndex = allValues.length;
  allValues.push([
    "Full Name",
    "ITS Number",
    "Student ID",
    "Grade",
    "Section",
    "Present Days",
    "Late Days",
    "Leave / Medical",
    "Absent Days",
    "Total Sessions",
    "Monthly Rate %",
    "Attendance Status",
  ]);

  allValues.push(...talabatRows);

  // Spacer
  allValues.push(["", "", "", "", "", "", "", "", "", "", "", ""]);

  // Faculty Section Header
  const facultySectionRowIndex = allValues.length;
  allValues.push([`👨‍🏫 FACULTY (TEACHERS & STAFF) MONTHLY ATTENDANCE REGISTER — ${teachers.length} Members (${facultyTurnout}% Monthly Turnout)`, "", "", "", "", "", "", "", "", "", "", ""]);

  // Faculty Columns Header
  allValues.push([
    "Full Name",
    "Employee / ITS",
    "Department",
    "Khidmat Mauze",
    "Present Days",
    "Late Days",
    "Absent Days",
    "Total Sessions",
    "Monthly Rate %",
    "Compliance Status",
    "",
    "",
  ]);

  allValues.push(...facultyRows);

  // Write values
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${tabTitle}'!A1:L${Math.max(allValues.length + 50, 400)}`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabTitle}'!A1:L${allValues.length}`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: allValues },
  });

  // Apply Rich Emerald & Gold Google Sheets Formatting
  if (daySheetId !== undefined) {
    try {
      const requests: Array<Record<string, unknown>> = [
        // Freeze Top 7 Rows
        {
          updateSheetProperties: {
            properties: { sheetId: daySheetId, gridProperties: { frozenRowCount: 7 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        // Auto column widths
        ...[180, 110, 110, 75, 75, 95, 95, 110, 95, 110, 115, 150].map((pixelSize, idx) => ({
          updateDimensionProperties: {
            range: { sheetId: daySheetId, dimension: "COLUMNS", startIndex: idx, endIndex: idx + 1 },
            properties: { pixelSize },
            fields: "pixelSize",
          },
        })),
        // Merge Title
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 12 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 12 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 4 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 4, endColumnIndex: 8 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 8, endColumnIndex: 12 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 4 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 4, endColumnIndex: 8 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 8, endColumnIndex: 12 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: talabatSectionRowIndex, endRowIndex: talabatSectionRowIndex + 1, startColumnIndex: 0, endColumnIndex: 12 }, mergeType: "MERGE_ALL" } },
        { mergeCells: { range: { sheetId: daySheetId, startRowIndex: facultySectionRowIndex, endRowIndex: facultySectionRowIndex + 1, startColumnIndex: 0, endColumnIndex: 12 }, mergeType: "MERGE_ALL" } },
        // Banner Style
        {
          repeatCell: {
            range: { sheetId: daySheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 12 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.015, green: 0.184, blue: 0.141 },
                textFormat: { foregroundColor: { red: 0.992, green: 0.878, blue: 0.278 }, bold: true, fontSize: 13 },
                horizontalAlignment: "CENTER",
                verticalAlignment: "MIDDLE",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
          },
        },
        // Talabat Section Style
        {
          repeatCell: {
            range: { sheetId: daySheetId, startRowIndex: talabatSectionRowIndex, endRowIndex: talabatSectionRowIndex + 1, startColumnIndex: 0, endColumnIndex: 12 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.024, green: 0.306, blue: 0.231 },
                textFormat: { foregroundColor: { red: 0.992, green: 0.878, blue: 0.278 }, bold: true, fontSize: 11 },
                horizontalAlignment: "LEFT",
                verticalAlignment: "MIDDLE",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
          },
        },
        // Talabat Columns Header Style
        {
          repeatCell: {
            range: { sheetId: daySheetId, startRowIndex: talabatHeaderRowIndex, endRowIndex: talabatHeaderRowIndex + 1, startColumnIndex: 0, endColumnIndex: 12 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.058, green: 0.09, blue: 0.165 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
                verticalAlignment: "MIDDLE",
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,horizontalAlignment)",
          },
        },
        // Faculty Section Style
        {
          repeatCell: {
            range: { sheetId: daySheetId, startRowIndex: facultySectionRowIndex, endRowIndex: facultySectionRowIndex + 1, startColumnIndex: 0, endColumnIndex: 12 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.118, green: 0.106, blue: 0.294 },
                textFormat: { foregroundColor: { red: 0.992, green: 0.878, blue: 0.278 }, bold: true, fontSize: 11 },
                horizontalAlignment: "LEFT",
                verticalAlignment: "MIDDLE",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
          },
        },
      ];

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    } catch (styleErr) {
      console.warn("[google-sheet-sync] monthly formatting notice:", (styleErr as Error)?.message || styleErr);
    }
  }

  return {
    spreadsheetId,
    tabTitle,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
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
  const dayStart = getStartOfDayIST(targetDate || new Date());
  if (dayStart.getUTCDay() === 0) {
    console.log("[google-sheet-sync] skipped — Sunday is institutional holiday");
    return { skipped: true, reason: "Sunday is institutional holiday" };
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

// ════════════════════════════════════════════════════════════════════════════
// DEDICATED MANUAL ATTENDANCE GOOGLE SHEET SUPPORT
// ════════════════════════════════════════════════════════════════════════════

let lastManualSyncedAtIso: string | null = null;
let lastManualSyncedDateKey: string | null = null;

export function manualSheetSyncStatus() {
  const id = getManualAttendanceSpreadsheetId();
  const creds = getServiceAccountCreds();
  let saEmail: string | null = null;
  if (creds) {
    if ("email" in creds) saEmail = creds.email;
    else if ("json" in creds) {
      const parsed = parseServiceAccountJson(creds.json);
      saEmail = parsed?.client_email || null;
    }
  }

  const isDedicated = Boolean(
    process.env.GOOGLE_MANUAL_ATTENDANCE_SPREADSHEET_ID ||
    process.env.GOOGLE_MANUAL_SHEET_ID ||
    cachedDbConfig?.manualSpreadsheetId
  );

  return {
    configured: Boolean(id && creds),
    isDedicated,
    spreadsheetId: id || null,
    maskedSpreadsheetId: id ? `${id.slice(0, 6)}…${id.slice(-4)}` : null,
    serviceAccountEmail: saEmail ? `${saEmail.slice(0, 6)}…@${saEmail.split("@")[1] || "gserviceaccount.com"}` : null,
    fullServiceAccountEmail: saEmail,
    url: id ? `https://docs.google.com/spreadsheets/d/${id}` : null,
    lastSyncedAt: lastManualSyncedAtIso || cachedDbConfig?.lastSyncedAt || null,
    lastSyncedDate: lastManualSyncedDateKey || cachedDbConfig?.lastSyncedDate || null,
  };
}

/**
 * Creates a brand new Google Spreadsheet specifically for Manual Attendance
 * via Google Drive / Sheets API, sets up initial tabs and styling, and returns its URL.
 */
export async function createManualSpreadsheet(customTitle?: string): Promise<{
  success: boolean;
  spreadsheetId: string;
  url: string;
  title: string;
  serviceAccountEmail: string;
}> {
  const { auth, email: saEmail } = createGoogleAuthClient();
  const client = google.sheets({ version: "v4", auth: auth as never });
  const title = customTitle?.trim() || `Darse Burhani — Manual Attendance Register (${new Date().getFullYear()})`;

  const res = await client.spreadsheets.create({
    requestBody: {
      properties: {
        title,
      },
      sheets: [
        {
          properties: {
            title: "Manual Summary",
            gridProperties: { rowCount: 100, columnCount: 15 },
          },
        },
        {
          properties: {
            title: "Manual Register",
            gridProperties: { rowCount: 500, columnCount: 12 },
          },
        },
      ],
    },
  });

  const spreadsheetId = res.data.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error("Failed to create Google Spreadsheet: empty spreadsheetId returned from Google");
  }

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  // Persist as dedicated manual spreadsheet in cache, DB, and .env
  process.env.GOOGLE_MANUAL_ATTENDANCE_SPREADSHEET_ID = spreadsheetId;
  if (cachedDbConfig) {
    cachedDbConfig.manualSpreadsheetId = spreadsheetId;
  }
  try {
    await prisma.systemSetting.upsert({
      where: { key: "google_sheets_config" },
      update: {
        value: {
          ...(cachedDbConfig || {}),
          manualSpreadsheetId: spreadsheetId,
        } as any,
      },
      create: {
        key: "google_sheets_config",
        value: { manualSpreadsheetId: spreadsheetId } as any,
      },
    });
  } catch (err) {
    console.warn("[google-sheet-sync] Warning persisting manual sheet ID to DB:", err);
  }

  try {
    const rootDir = process.cwd();
    const envPath = path.resolve(rootDir, ".env");
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
    const reg = new RegExp(`^(?:#\\s*)?GOOGLE_MANUAL_ATTENDANCE_SPREADSHEET_ID=.*$`, "m");
    if (reg.test(content)) {
      content = content.replace(reg, `GOOGLE_MANUAL_ATTENDANCE_SPREADSHEET_ID="${spreadsheetId}"`);
    } else {
      content = content.trimEnd() + `\nGOOGLE_MANUAL_ATTENDANCE_SPREADSHEET_ID="${spreadsheetId}"\n`;
    }
    fs.writeFileSync(envPath, content, "utf8");
  } catch (err) {
    console.warn("[google-sheet-sync] Warning updating .env with manual spreadsheet ID:", err);
  }

  return {
    success: true,
    spreadsheetId,
    url: sheetUrl,
    title,
    serviceAccountEmail: saEmail,
  };
}

/**
 * Synchronizes manual roll call records for a given date directly to the dedicated manual spreadsheet.
 */
export async function syncManualAttendanceToSheet(
  targetDate: Date = new Date(),
  customSpreadsheetId?: string
): Promise<{
  spreadsheetId: string;
  tabTitle: string;
  rowsSynced: number;
  url: string;
  stats: any;
}> {
  const targetId = extractSpreadsheetId(customSpreadsheetId || getManualAttendanceSpreadsheetId());
  if (!targetId) {
    throw new Error("No Google Spreadsheet configured for manual attendance. Please create or link a sheet first in Google Sheets Settings.");
  }

  const { sheets, spreadsheetId } = getWriteClient(targetId);

  // Date range for the requested day
  const dateKey = targetDate.toISOString().slice(0, 10);
  const dayStart = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate(), 0, 0, 0));
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  // Fetch all students with their manual registries / records
  const [students, teachers] = await Promise.all([
    prisma.studentProfile.findMany({
      where: { user: { isActive: true, deletedAt: null } },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        classEnrollments: {
          where: { isActive: true },
          include: { class: { select: { name: true, grade: true, section: true } } },
          take: 1,
        },
        attendanceRegistries: {
          where: { date: { gte: dayStart, lt: dayEnd } },
          include: { leave: true },
          take: 1,
        },
        attendanceRecords: {
          where: { date: { gte: dayStart, lt: dayEnd } },
          orderBy: [{ checkInTime: "desc" }],
        },
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { studentId: "asc" }],
    }),
    prisma.teacherProfile.findMany({
      where: { user: { isActive: true, deletedAt: null } },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        attendanceRecords: {
          where: { date: { gte: dayStart, lt: dayEnd } },
          orderBy: [{ checkInTime: "desc" }],
        },
      },
      orderBy: [{ department: "asc" }, { employeeId: "asc" }],
    }),
  ]);

  const fmtIST = (d?: Date | null) =>
    d
      ? new Date(d).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        })
      : "--";

  const rows: Array<Array<string | number>> = [];
  const tabTitle = `Manual - ${dateKey}`;

  // Title Banner
  rows.push([`DARSE BURHANI — MANUAL CLASSROOM ATTENDANCE REGISTER (${dateKey})`]);
  rows.push([`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST | Total Active Members: ${students.length + teachers.length}`]);
  rows.push([]);

  // Header
  const HEADER = [
    "S.No",
    "ITS / Employee ID",
    "Full Name",
    "Role",
    "Grade & Section / Dept",
    "Attendance Status",
    "Record Source",
    "Check-In (IST)",
    "Check-Out (IST)",
    "Teacher / Recorded By",
    "Remarks / Reason",
  ];

  rows.push(["─── TALABAT (STUDENTS) MANUAL REGISTER ───"]);
  rows.push(HEADER);

  let studentPresent = 0;
  let studentLate = 0;
  let studentAbsent = 0;
  let studentMedical = 0;
  let studentLeave = 0;

  students.forEach((s, idx) => {
    const reg = s.attendanceRegistries[0];
    const rec = s.attendanceRecords[0];

    const status = reg?.status || rec?.status || "NOT_MARKED";
    const checkIn = reg?.checkInTime || rec?.checkInTime;
    const checkOut = reg?.checkOutTime || rec?.checkOutTime;
    const remarks = reg?.remarks || rec?.justification || (reg?.leave ? `Leave: ${reg.leave.type}` : "");
    const recordedBy = reg?.recordedById || rec?.recordedById || "Teacher";

    if (status === "PRESENT") studentPresent++;
    else if (status === "LATE") studentLate++;
    else if (status === "ABSENT") studentAbsent++;
    else if (status === "MEDICAL") studentMedical++;
    else if (status === "ON_LEAVE") studentLeave++;

    rows.push([
      idx + 1,
      s.its || s.studentId,
      `${s.user.firstName} ${s.user.lastName}`.trim(),
      "Student",
      s.classEnrollments[0]?.class?.name || `Grade ${s.grade}-${s.section}`,
      status,
      reg ? "MANUAL_REGISTRY" : rec?.source || "NOT_MARKED",
      fmtIST(checkIn),
      fmtIST(checkOut),
      recordedBy,
      remarks,
    ]);
  });

  rows.push([]);
  rows.push(["─── FACULTY & STAFF MANUAL REGISTER ───"]);
  rows.push(HEADER);

  let teacherPresent = 0;
  let teacherLate = 0;
  let teacherAbsent = 0;

  teachers.forEach((t, idx) => {
    const rec = t.attendanceRecords[0];
    const status = rec?.status || "NOT_MARKED";
    const checkIn = rec?.checkInTime;
    const checkOut = rec?.checkOutTime;
    const remarks = rec?.notes || "";

    if (status === "PRESENT") teacherPresent++;
    else if (status === "LATE") teacherLate++;
    else if (status === "ABSENT") teacherAbsent++;

    rows.push([
      idx + 1,
      t.employeeId || t.its || "--",
      `${t.user.firstName} ${t.user.lastName}`.trim(),
      "Faculty",
      t.department || "Faculty",
      status,
      rec?.verificationMethod || "MANUAL",
      fmtIST(checkIn),
      fmtIST(checkOut),
      "Admin / Self",
      remarks,
    ]);
  });

  // Ensure tab exists
  const daySheetId = await ensureTab(sheets, spreadsheetId, tabTitle, Math.max(rows.length + 50, 200), 15);

  // Clear and write rows with single quotes around tabTitle
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${tabTitle}'!A1:Z${rows.length + 100}`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabTitle}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: rows,
    },
  });

  // Apply styling
  if (daySheetId !== undefined) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: { sheetId: daySheetId, gridProperties: { frozenRowCount: 5 } },
                fields: "gridProperties.frozenRowCount",
              },
            },
          ],
        },
      });
    } catch {}
  }

  lastManualSyncedAtIso = new Date().toISOString();
  lastManualSyncedDateKey = dateKey;

  const totalSynced = students.length + teachers.length;

  return {
    spreadsheetId,
    tabTitle,
    rowsSynced: totalSynced,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    stats: {
      students: { total: students.length, present: studentPresent, late: studentLate, absent: studentAbsent, medical: studentMedical, leave: studentLeave },
      faculty: { total: teachers.length, present: teacherPresent, late: teacherLate, absent: teacherAbsent },
    },
  };
}

/**
 * Synchronizes Talabat (Students) Directory to Google Sheets.
 */
export async function syncTalabatDirectoryToSheet(customSpreadsheetId?: string): Promise<{
  spreadsheetId: string;
  tabTitle: string;
  rowsSynced: number;
  url: string;
}> {
  const { sheets, spreadsheetId } = getWriteClient(customSpreadsheetId || getAttendanceSpreadsheetId());

  const students = await prisma.studentProfile.findMany({
    where: { user: { isActive: true, deletedAt: null } },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      talabatProfile1447: { select: { status: true, fatherName: true, motherName: true, fatherOccupation: true, motherOccupation: true, updatedAt: true } },
    },
    orderBy: [{ grade: "asc" }, { section: "asc" }, { studentId: "asc" }],
  });

  const tabTitle = "Talabat Directory";
  const rows: Array<Array<string | number>> = [];
  rows.push(["DARSE BURHANI — TALABAT (STUDENT) DIRECTORY"]);
  rows.push([`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST | Total Active Talabat: ${students.length}`]);
  rows.push([]);
  rows.push([
    "S.No",
    "ITS",
    "Student ID",
    "Full Name",
    "Arabic Name",
    "Grade",
    "Section",
    "Status",
    "Hafiz Year",
    "Father Name",
    "Mother Name",
    "Mobile / Contact",
    "City / Watan",
    "Yearly Profile Status",
    "Last Updated",
  ]);

  students.forEach((s, idx) => {
    rows.push([
      idx + 1,
      s.its || "--",
      s.studentId || "--",
      `${s.user.firstName} ${s.user.lastName}`.trim(),
      s.nameAr || "--",
      s.grade || "--",
      s.section || "--",
      s.status || "SANAH",
      s.hafizYear || "--",
      s.talabatProfile1447?.fatherName || s.fatherName || "--",
      s.talabatProfile1447?.motherName || s.motherName || "--",
      s.mobileNumber || s.fatherPhone || "--",
      s.residentCity || s.watan || "--",
      s.talabatProfile1447?.status || "NOT_STARTED",
      s.talabatProfile1447?.updatedAt ? new Date(s.talabatProfile1447.updatedAt).toISOString().slice(0, 10) : "--",
    ]);
  });

  // Ensure tab exists
  const daySheetId = await ensureTab(sheets, spreadsheetId, tabTitle, Math.max(rows.length + 50, 200), 16);

  // Clear and update with single-quote range
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${tabTitle}'!A1:Z${rows.length + 100}`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabTitle}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });

  // Apply Emerald styling
  if (daySheetId !== undefined) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: { sheetId: daySheetId, gridProperties: { frozenRowCount: 4 } },
                fields: "gridProperties.frozenRowCount",
              },
            },
            {
              repeatCell: {
                range: { sheetId: daySheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 15 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.015, green: 0.184, blue: 0.141 },
                    textFormat: { foregroundColor: { red: 0.992, green: 0.878, blue: 0.278 }, bold: true, fontSize: 12 },
                    horizontalAlignment: "CENTER",
                  },
                },
                fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
              },
            },
            {
              repeatCell: {
                range: { sheetId: daySheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 15 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.058, green: 0.09, blue: 0.165 },
                    textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
                    horizontalAlignment: "CENTER",
                  },
                },
                fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
              },
            },
          ],
        },
      });
    } catch {}
  }

  return {
    spreadsheetId,
    tabTitle,
    rowsSynced: students.length,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

/**
 * Synchronizes Faculty & Staff Directory to Google Sheets.
 */
export async function syncFacultyDirectoryToSheet(customSpreadsheetId?: string): Promise<{
  spreadsheetId: string;
  tabTitle: string;
  rowsSynced: number;
  url: string;
}> {
  const { sheets, spreadsheetId } = getWriteClient(customSpreadsheetId || getAttendanceSpreadsheetId());

  const teachers = await prisma.teacherProfile.findMany({
    where: { user: { isActive: true, deletedAt: null } },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    orderBy: [{ department: "asc" }, { employeeId: "asc" }],
  });

  const tabTitle = "Faculty Directory";
  const rows: Array<Array<string | number>> = [];
  rows.push(["DARSE BURHANI — FACULTY & STAFF ROSTER"]);
  rows.push([`Generated: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST | Total Active Faculty: ${teachers.length}`]);
  rows.push([]);
  rows.push([
    "S.No",
    "Employee ID",
    "ITS",
    "Full Name",
    "Department",
    "Role / Designation",
    "Email",
    "Mobile / Contact",
    "Subjects / Specialization",
    "Khidmat Mauze",
    "Aljamea Degree",
  ]);

  teachers.forEach((t, idx) => {
    rows.push([
      idx + 1,
      t.employeeId || "--",
      t.its || "--",
      `${t.user.firstName} ${t.user.lastName}`.trim(),
      t.department || "Faculty",
      t.roleTitle || t.subCategory || "Teacher",
      t.user.email || t.tEmail || "--",
      t.mobile || "--",
      t.subjects && t.subjects.length > 0 ? t.subjects.join(", ") : "--",
      t.khidmatMauze || "--",
      t.aljameaDegree || t.farigDarajah || "--",
    ]);
  });

  // Ensure tab exists
  const daySheetId = await ensureTab(sheets, spreadsheetId, tabTitle, Math.max(rows.length + 50, 100), 12);

  // Clear and update with single-quote range
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${tabTitle}'!A1:Z${rows.length + 100}`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${tabTitle}'!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });

  // Apply Indigo styling
  if (daySheetId !== undefined) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              updateSheetProperties: {
                properties: { sheetId: daySheetId, gridProperties: { frozenRowCount: 4 } },
                fields: "gridProperties.frozenRowCount",
              },
            },
            {
              repeatCell: {
                range: { sheetId: daySheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.118, green: 0.106, blue: 0.294 },
                    textFormat: { foregroundColor: { red: 0.992, green: 0.878, blue: 0.278 }, bold: true, fontSize: 12 },
                    horizontalAlignment: "CENTER",
                  },
                },
                fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
              },
            },
            {
              repeatCell: {
                range: { sheetId: daySheetId, startRowIndex: 3, endRowIndex: 4, startColumnIndex: 0, endColumnIndex: 11 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.058, green: 0.09, blue: 0.165 },
                    textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 10 },
                    horizontalAlignment: "CENTER",
                  },
                },
                fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
              },
            },
          ],
        },
      });
    } catch {}
  }

  return {
    spreadsheetId,
    tabTitle,
    rowsSynced: teachers.length,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  };
}

