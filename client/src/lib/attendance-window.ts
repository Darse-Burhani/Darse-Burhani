/**
 * Window-aware live-pull helpers.
 *
 * Attendance auto-pull (polling + SSE-triggered refetch) must only run while
 * the selected schedule window is actually open in IST. Once the window time
 * passes, pulling stops — the finalized roster stays put instead of churning.
 */

export interface WindowTimes {
  startTime: string;
  endTime: string;
  lateEndTime?: string | null;
  enabled?: boolean;
}

function toMinutes(t: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(t || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Current wall-clock minutes in Asia/Kolkata (IST = UTC + 5:30). */
export function nowISTMinutes(now = new Date()): number {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;
}

/**
 * True while `now` sits inside [startTime, lateEndTime] IST.
 * Disabled windows or unparsable times never count as open.
 */
export function isWindowOpenNow(w: WindowTimes | null | undefined, now = new Date()): boolean {
  if (!w || w.enabled === false) return false;
  const s = toMinutes(w.startTime);
  const e = toMinutes(w.endTime);
  if (s === null || e === null) return false;
  const late = toMinutes(w.lateEndTime || w.endTime);
  if (late === null) return false;
  const n = nowISTMinutes(now);
  return n >= s && n <= late;
}

/** True when at least one of the given windows is open right now. */
export function isAnyWindowOpen(windows: Array<WindowTimes | null | undefined>, now = new Date()): boolean {
  return (windows || []).some((w) => isWindowOpenNow(w, now));
}

/**
 * Scan-event types that only arrive while a window is live. Final/manual
 * events (auto-finalize, overrides, manual saves) must ALWAYS trigger a
 * refetch — even after the window closes — otherwise finalized ABSENT marks
 * never appear without a manual refresh.
 */
const FINAL_EVENT_TYPES = new Set([
  "ATTENDANCE_AUTO_FINALIZED",
  "ATTENDANCE_OVERRIDE",
  "MANUAL_ATTENDANCE_SAVED",
  "CLASS_ATTENDANCE_SAVED",
]);

export function isFinalAttendanceEvent(type: unknown): boolean {
  return typeof type === "string" && FINAL_EVENT_TYPES.has(type);
}

/** Local YYYY-MM-DD for "is today" comparisons on roster pages. */
export function localDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
