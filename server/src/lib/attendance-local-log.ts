import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";


export interface LocalScanLogEntry {
  timestamp: string;
  eventId: string;
  outcome: string;
  role?: string | null;
  fingerprint: string;
  deviceId: string | null;
  personId?: string | null;
  name?: string | null;
  status?: string | null;
  checkInIST?: string | null;
  verifyMode?: string | null;
  message?: string | null;
}

const here = path.dirname(fileURLToPath(import.meta.url));
// server/src/lib -> server/logs/attendance
export const ATTENDANCE_LOCAL_DIR = path.resolve(here, "..", "..", "logs", "attendance");
export const ATTENDANCE_EXCEL_DIR = path.join(ATTENDANCE_LOCAL_DIR, "excel");

let dirReady: Promise<void> | null = null;

export function ensureAttendanceLocalDir(): Promise<void> {
  if (!dirReady) {
    dirReady = (async () => {
      await mkdir(ATTENDANCE_LOCAL_DIR, { recursive: true });
      await mkdir(ATTENDANCE_EXCEL_DIR, { recursive: true });
    })().catch((err) => {
      console.error("[attendance-local-log] failed to create log dir:", err);
    });
  }
  return dirReady;
}

/** IST calendar day "YYYY-MM-DD" for a timestamp — one file per school day. */
export function istDayKey(when: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(when);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * Append one scan outcome to the local daily log file:
 *   server/logs/attendance/YYYY-MM-DD.jsonl
 * Fire-and-forget safe — never throws, never blocks attendance recording.
 */
export function appendLocalScanLog(entry: LocalScanLogEntry): void {
  void (async () => {
    try {
      await ensureAttendanceLocalDir();
      const file = path.join(ATTENDANCE_LOCAL_DIR, `${istDayKey(new Date(entry.timestamp))}.jsonl`);
      await appendFile(file, `${JSON.stringify(entry)}\n`, "utf8");
    } catch (err) {
      console.error("[attendance-local-log] append failed:", err);
    }
  })();
}

export function localDayLogPath(dayKey: string): string {
  return path.join(ATTENDANCE_LOCAL_DIR, `${dayKey}.jsonl`);
}
