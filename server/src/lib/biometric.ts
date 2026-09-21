import prisma from "./prisma";
import { cache } from "./cache";
import { appendLocalScanLog } from "./attendance-local-log";

export type ScanOutcome = "MATCHED" | "UNKNOWN" | "NO_CLASS" | "DUPLICATE" | "TOO_EARLY";

export interface BiometricClassMatch {
  classId: string;
  className: string;
  subject: string;
  period: number;
  startTime: string;
  endTime: string;
  status: "PRESENT" | "LATE" | "ON_LEAVE" | "MEDICAL" | string;
  attendanceId: string;
}

export interface BiometricEvent {
  id: string;
  type: ScanOutcome | "SYSTEM";
  fingerprint: string;
  deviceId: string | null;
  timestamp: string;
  role?: "STUDENT" | "TEACHER";
  student?: {
    id: string;
    userId: string;
    studentId: string;
    name: string;
    grade: string;
    section: string;
    avatarUrl?: string | null;
    its?: string | null;
    status?: string;
    leaveReason?: string;
    leaveType?: string;
  };
  teacher?: {
    id: string;
    userId: string;
    employeeId: string;
    name: string;
    department: string | null;
    status?: "PRESENT" | "LATE" | "ON_LEAVE" | "MEDICAL" | string;
    attendanceId?: string;
    avatarUrl?: string | null;
    its?: string | null;
    leaveReason?: string;
    leaveType?: string;
  };
  classes?: BiometricClassMatch[];
  message?: string;
  isDuplicate?: boolean;
  scanCount?: number;
  /** The daily scan window (Tilawat al Dua) that was applied to this scan. */
  scanWindow?: {
    name: string;
    startTime: string;
    endTime: string;
    lateEndTime?: string | null;
    graceMinutes: number;
    allowEarlyCheckIn?: boolean;
  };
  /** How the scan was verified: fingerprint, facial, rfid card, or generic biometric. */
  verifyMode?: "FINGERPRINT" | "FACIAL" | "CARD" | "BIOMETRIC";
}

export type BiometricMethod = "FINGERPRINT" | "FACIAL" | "CARD" | "BIOMETRIC";

/**
 * Normalize a device-provided verify mode into a stable method label.
 * Correctly distinguishes Face vs Fingerprint and prevents combo modes (like "cardOrFaceOrFp") from being rejected as CARD.
 */
export function normalizeVerifyMode(mode?: string | number | null): BiometricMethod {
  const raw = String(mode ?? "").trim().toLowerCase();
  if (!raw) return "BIOMETRIC";

  if (/^\d+$/.test(raw)) {
    const n = Number(raw);
    if (n === 6 || n === 11 || n === 12 || n === 75 || n === 76 || n === 77) return "FACIAL";
    if (n === 4 || n === 5 || n === 7 || n === 8 || n === 9 || n === 10 || n === 13 || n === 78) return "FINGERPRINT";
    if (n === 1 || n === 2) return "CARD";
    return "BIOMETRIC";
  }

  // Pure Face mentions
  if (/face|facial/i.test(raw) && !/finger|fp/i.test(raw)) return "FACIAL";
  // Pure Fingerprint mentions
  if (/finger|fp|thumb|palm/i.test(raw) && !/face|facial/i.test(raw)) return "FINGERPRINT";
  // Combined / multi-biometric modes (e.g. "cardOrFaceOrFp", "faceOrFp", "fpOrFace", "faceAndFp")
  if (/face|facial/i.test(raw) && /finger|fp/i.test(raw)) {
    return raw.indexOf("face") <= raw.indexOf("fp") && raw.indexOf("face") <= raw.indexOf("finger") ? "FACIAL" : "FINGERPRINT";
  }
  // Pure card-only mentions (no face or fingerprint component)
  if (/card|rfid/i.test(raw) && !/face|finger|fp|biometric/i.test(raw)) return "CARD";

  return "BIOMETRIC";
}

export interface ScanWindowConfig {
  name: string;
  startTime: string;
  /** On-time window closes here — scans at or before this are PRESENT. */
  endTime: string;
  /** Late window closes here — scans in (endTime, lateEndTime] are LATE. Null = no late zone. */
  lateEndTime: string | null;
  startMinutes: number;
  endMinutes: number;
  lateEndMinutes: number;
  graceMinutes: number;
  enabled: boolean;
  allowEarlyCheckIn?: boolean;
  /** Faculty applicability roster (teacherProfile ids). Empty = applies to everyone. */
  applicableTeacherIds: string[];
  /** Faculty exemption roster (teacherProfile ids). */
  exemptTeacherIds: string[];
  /** Student/Class applicability roster (class ids). Empty = applies to all classes. */
  applicableClassIds: string[];
  /** Student exemption roster (studentProfile ids). */
  exemptStudentIds: string[];
  /** Which role timer this config was built from. */
  role: "STUDENT" | "TEACHER";
  /** Source schedule event (one unified event carries both timers). */
  eventId: string;
  eventName: string;
}

/**
 * Raw schedule-event row shape (unified model: one event carries the Talabat
 * timer in startTime/endTime/lateEndTime plus an optional faculty timer in
 * facultyStartTime/facultyEndTime/facultyLateEndTime).
 */
export interface ScanWindowRowLike {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateEndTime?: string | null;
  graceMinutes?: number;
  enabled: boolean;
  applicableTeacherIds?: string[];
  exemptTeacherIds?: string[];
  applicableClassIds?: string[];
  exemptStudentIds?: string[];
  facultyStartTime?: string | null;
  facultyEndTime?: string | null;
  facultyLateEndTime?: string | null;
  facultyEnabled?: boolean;
}

/** True when the event row carries a usable faculty timer. */
export function hasFacultyTimer(w: ScanWindowRowLike): boolean {
  return Boolean(w.facultyStartTime && w.facultyEndTime);
}

/** Legacy standalone faculty rows (pre-unification) double as faculty timer source. */
export function isLegacyFacultyRow(w: ScanWindowRowLike): boolean {
  return (
    !hasFacultyTimer(w) &&
    (w.id === "faculty_default" ||
      w.id === "faculty" ||
      /faculty|teacher|staff|asateezah/i.test(w.name))
  );
}

/**
 * IST wall-clock range of an event for a role, in minutes since midnight.
 * Null when the event exposes no usable timer for that role (e.g. a
 * student-only evening event has no faculty timer).
 */
export function eventRangeForRole(
  w: ScanWindowRowLike,
  role: "STUDENT" | "TEACHER",
): { startMin: number; endMin: number; lateMin: number; enabled: boolean } | null {
  if (role === "TEACHER") {
    if (hasFacultyTimer(w)) {
      if (w.facultyEnabled === false) return null;
      const s = toMinutes(w.facultyStartTime as string);
      const e = toMinutes(w.facultyEndTime as string);
      const late = Math.max(e, toMinutes(w.facultyLateEndTime ?? w.facultyEndTime ?? ""));
      return { startMin: s, endMin: e, lateMin: late, enabled: w.enabled };
    }
    // Legacy fallback: standalone faculty rows use their own columns.
    if (isLegacyFacultyRow(w)) {
      if (!w.enabled) return null;
      const s = toMinutes(w.startTime);
      const e = toMinutes(w.endTime);
      const late = Math.max(e, toMinutes(w.lateEndTime ?? w.endTime));
      return { startMin: s, endMin: e, lateMin: late, enabled: w.enabled };
    }
    return null;
  }
  if (!w.enabled) return null;
  const s = toMinutes(w.startTime);
  const e = toMinutes(w.endTime);
  const late = Math.max(e, toMinutes(w.lateEndTime ?? w.endTime));
  return { startMin: s, endMin: e, lateMin: late, enabled: w.enabled };
}

const MAX_EVENTS = 300;
const GRACE_MINUTES = 10; // fallback grace period before a scan counts as LATE
const MOCK_INTERVAL_MS = 4000;

type SseClient = (payload: string) => void;

const events: BiometricEvent[] = [];
const sseClients = new Set<SseClient>();
const startedAt = Date.now();

let mockTimer: ReturnType<typeof setInterval> | null = null;
let lastMockWarningAt = 0;

// Fingerprints that scanned but matched no talabat (for onboarding real devices).
const MAX_UNMATCHED = 200;
const unmatchedFp = new Map<string, { count: number; firstSeen: number; lastSeen: number }>();

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function pushEvent(
  event: Omit<BiometricEvent, "id" | "timestamp">,
  scanTime?: Date,
  /** If true, store in history but do NOT broadcast via SSE (e.g. duplicate re-scans). */
  silent = false,
): BiometricEvent {
  prunePreviousDayEvents();
  const full: BiometricEvent = {
    ...event,
    id: makeId(),
    timestamp: (scanTime ?? new Date()).toISOString(),
  };
  events.push(full);
  if (events.length > MAX_EVENTS) {
    events.splice(0, events.length - MAX_EVENTS);
  }
  // Mirror every scan outcome to the local daily log file
  // (server/logs/attendance/YYYY-MM-DD.jsonl) so no scan is ever only
  // in memory — even UNKNOWN / duplicate scans are auditable.
  try {
    const teacher = (full as BiometricEvent).teacher;
    const student = (full as BiometricEvent).student;
    const personId =
      teacher?.employeeId ?? student?.studentId ?? (full.fingerprint || null);
    const name = teacher?.name ?? student?.name ?? null;
    const status =
      teacher?.status ??
      (full.classes && full.classes.length > 0 ? full.classes[0].status : null);
    appendLocalScanLog({
      timestamp: full.timestamp,
      eventId: full.id,
      outcome: full.type,
      role: full.role ?? (teacher ? "TEACHER" : student ? "STUDENT" : null),
      fingerprint: full.fingerprint,
      deviceId: full.deviceId,
      personId,
      name,
      status,
      checkInIST: full.timestamp
        ? getISTDetails(parseScanTime(full.timestamp)).timeFormatted12
        : null,
      verifyMode: full.verifyMode ?? null,
      message: full.message ?? null,
    });
  } catch {
    // Local logging must never break scan processing.
  }

  // Always broadcast live events to all connected SSE clients (even duplicate re-scans)
  // so live ticker and dashboards update instantaneously.
  const payload = `data: ${JSON.stringify(full)}\n\n`;
  for (const send of sseClients) {
    try {
      send(payload);
    } catch {
      // A slow/disconnected client must not break the loop.
    }
  }
  return full;
}

/**
 * Broadcast an arbitrary attendance update or system notification to all connected SSE clients.
 */
export function broadcastAttendanceEvent(data: Record<string, any>): void {
  const payload = `data: ${JSON.stringify({
    ...data,
    id: data.id || makeId(),
    timestamp: data.timestamp || new Date().toISOString(),
  })}\n\n`;

  for (const send of sseClients) {
    try {
      send(payload);
    } catch {
      // Ignore disconnected clients
    }
  }
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Parse an incoming scan timestamp from any biometric device or manual entry,
 * ensuring it accurately converts to a valid Date in Indian Standard Time (UTC+05:30).
 */
export function parseScanTime(input?: string | number | Date | null): Date {
  if (!input) return new Date();
  if (input instanceof Date) return isNaN(input.getTime()) ? new Date() : input;
  if (typeof input === "number") return new Date(input);

  const raw = String(input).trim();
  if (!raw) return new Date();

  // If already contains offset like +05:30, Z, or timezone offset
  if (/[Zz]|([+-]\d{2}:?\d{2})$/.test(raw)) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) return d;
  }

  // Format "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DD HH:mm:ss" without offset
  const normalized = raw.replace(" ", "T");
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (match) {
    const [_, y, m, d, h, min, s, ms] = match;
    const isoWithIST = `${y}-${m}-${d}T${h}:${min}:${s}${ms ? `.${ms}` : ""}+05:30`;
    const parsed = new Date(isoWithIST);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  const fallback = new Date(raw);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
}

/**
 * Get accurate Indian Standard Time (IST - Asia/Kolkata, UTC+05:30) values for a Date.
 */
export function getISTDetails(date: Date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10) - 1; // 0-indexed
  const day = parseInt(get("day"), 10);
  let hours = parseInt(get("hour"), 10);
  if (hours === 24) hours = 0;
  const minutes = parseInt(get("minute"), 10);
  const seconds = parseInt(get("second"), 10);

  const scanMinutes = hours * 60 + minutes;

  // Calendar day start in UTC for this IST calendar day
  const calendarDayUTC = new Date(Date.UTC(year, month, day));

  const timeFormatted12 = date.toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return {
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    scanMinutes,
    calendarDayUTC,
    timeFormatted12,
  };
}

export function dayStartUTC(date: Date): Date {
  return getISTDetails(date).calendarDayUTC;
}

export function getStartOfDayIST(dateInput: Date | string = new Date()): Date {
  const d = typeof dateInput === "string" ? new Date(dateInput.includes("T") ? dateInput : `${dateInput}T00:00:00Z`) : dateInput;
  const valid = isNaN(d.getTime()) ? new Date() : d;
  return getISTDetails(valid).calendarDayUTC;
}

/**
 * Get the daily biometric scan configuration for a specific role.
 *
 * Unified-event model: ONE schedule event carries BOTH the Talabat timer
 * (startTime/endTime/lateEndTime) and the faculty timer
 * (facultyStartTime/facultyEndTime/facultyLateEndTime). When several events
 * expose a timer for the role, the event containing `when` wins; otherwise
 * the earliest event is returned (preserves old single-window behaviour).
 */
export async function getScanWindow(
  role?: "STUDENT" | "TEACHER",
  when: Date = new Date(),
): Promise<ScanWindowConfig | null> {
  const windows = await getRoleWindows(role ?? "STUDENT");
  if (windows.length === 0) return null;
  const { scanMinutes } = getISTDetails(when);
  return (
    windows.find((w) => scanMinutes >= w.startMinutes && scanMinutes <= w.lateEndMinutes) ??
    windows[0]
  );
}

/**
 * Every schedule event exposing a usable timer for the role, earliest first.
 * TEACHER falls back to legacy standalone faculty rows (pre-unification).
 */
export async function getRoleWindows(role: "STUDENT" | "TEACHER"): Promise<ScanWindowConfig[]> {
  const rows = (await prisma.biometricScanWindow.findMany({
    orderBy: { startTime: "asc" },
  })) as unknown as ScanWindowRowLike[];

  const out: ScanWindowConfig[] = [];
  for (const row of rows) {
    const cfg = toWindowConfig(row, role);
    if (cfg) out.push(cfg);
  }

  // Preferred-event ordering: the primary "default" event first, then by start.
  out.sort((a, b) => {
    const aFirst = a.eventId === "default" ? 0 : 1;
    const bFirst = b.eventId === "default" ? 0 : 1;
    return aFirst - bFirst || a.startMinutes - b.startMinutes;
  });
  return out;
}

export interface RoleWindowStatus {
  isOpen: boolean;
  isUpcoming: boolean;
  isExceeded: boolean;
  isDisabled: boolean;
  window: ScanWindowConfig | null;
  message: string;
}

/**
 * Build a ScanWindowConfig for one role from a unified event row.
 * Returns null when the event exposes no usable timer for the role
 * (e.g. a student-only event has no faculty timer).
 */
export function toWindowConfig(w: ScanWindowRowLike, role: "STUDENT" | "TEACHER" = "STUDENT"): ScanWindowConfig | null {
  const range = eventRangeForRole(w, role);
  if (!range) return null;
  const startTime =
    role === "TEACHER" && hasFacultyTimer(w) ? (w.facultyStartTime as string) : w.startTime;
  const endTime =
    role === "TEACHER" && hasFacultyTimer(w) ? (w.facultyEndTime as string) : w.endTime;
  const lateEndTime =
    role === "TEACHER" && hasFacultyTimer(w)
      ? (w.facultyLateEndTime ?? w.facultyEndTime ?? w.endTime)
      : (w.lateEndTime ?? w.endTime);
  return {
    name: `${w.name} — ${role === "TEACHER" ? "Faculty" : "Talabat"}`,
    startTime,
    endTime,
    lateEndTime,
    startMinutes: range.startMin,
    endMinutes: range.endMin,
    lateEndMinutes: range.lateMin,
    graceMinutes: w.graceMinutes ?? 0,
    enabled: range.enabled,
    allowEarlyCheckIn: false,
    applicableTeacherIds: w.applicableTeacherIds ?? [],
    exemptTeacherIds: w.exemptTeacherIds ?? [],
    applicableClassIds: w.applicableClassIds ?? [],
    exemptStudentIds: w.exemptStudentIds ?? [],
    role,
    eventId: w.id,
    eventName: w.name,
  };
}

/**
 * Resolve the attendance outcome for a scan minute inside an open window:
 * [start, end] => PRESENT (on-time), (end, lateEnd] => LATE,
 * before start => TOO_EARLY, after lateEnd => CLOSED.
 */
export function resolveScanStatus(
  window: ScanWindowConfig,
  scanMinutes: number,
): "TOO_EARLY" | "PRESENT" | "LATE" | "CLOSED" {
  if (scanMinutes < window.startMinutes) return "TOO_EARLY";
  if (scanMinutes <= window.endMinutes) return "PRESENT";
  if (scanMinutes <= window.lateEndMinutes) return "LATE";
  return "CLOSED";
}

export function windowPayload(window: ScanWindowConfig | null) {
  if (!window) return undefined;
  return {
    name: window.eventName,
    eventId: window.eventId,
    role: window.role,
    startTime: window.startTime,
    endTime: window.endTime,
    lateEndTime: window.lateEndTime,
    graceMinutes: window.graceMinutes,
    allowEarlyCheckIn: window.allowEarlyCheckIn,
  };
}

/**
 * Check if scanning is open for a specific role (STUDENT or TEACHER).
 * A role is open when ANY schedule event exposing that role's timer contains
 * the scan time: [startTime, endTime] scans mark PRESENT (on-time),
 * (endTime, lateEndTime] scans mark LATE. Before the first timer is too
 * early, after the last timer is closed — unscanned members become ABSENT
 * via auto-mark.
 */
export async function isRoleWindowOpen(role: "STUDENT" | "TEACHER", scanTime: Date = new Date()): Promise<RoleWindowStatus> {
  const windows = await getRoleWindows(role);
  const roleName = role === "STUDENT" ? "Talabat (Student)" : "Faculty (Teacher)";

  const usable = windows.filter((w) => w.enabled);
  if (usable.length === 0) {
    return {
      isOpen: false,
      isUpcoming: false,
      isExceeded: false,
      isDisabled: true,
      window: windows[0] ?? null,
      message: `${roleName} scanning is DISABLED by Admin schedule`,
    };
  }

  const { scanMinutes } = getISTDetails(scanTime);
  const containing = usable.find(
    (w) => scanMinutes >= w.startMinutes && scanMinutes <= w.lateEndMinutes,
  );
  if (containing) {
    const phase = resolveScanStatus(containing, scanMinutes);
    const phaseLabel = phase === "PRESENT" ? "ON-TIME" : "LATE";
    return {
      isOpen: true,
      isUpcoming: false,
      isExceeded: false,
      isDisabled: false,
      window: containing,
      message: `${roleName} scanning is ACTIVE (${phaseLabel} in "${containing.eventName}": ${containing.startTime}–${containing.endTime} on-time, till ${containing.lateEndTime} late IST)`,
    };
  }

  const upcoming = usable
    .filter((w) => scanMinutes < w.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes)[0];
  if (upcoming) {
    return {
      isOpen: false,
      isUpcoming: true,
      isExceeded: false,
      isDisabled: false,
      window: upcoming,
      message: `${roleName} scanning window has not opened yet (Opens at ${upcoming.startTime} IST in "${upcoming.eventName}")`,
    };
  }

  const last = [...usable].sort((a, b) => b.lateEndMinutes - a.lateEndMinutes)[0];
  return {
    isOpen: false,
    isUpcoming: false,
    isExceeded: true,
    isDisabled: false,
    window: last,
    message: `${roleName} scanning window is closed (Late window closed at ${last.lateEndTime} IST in "${last.eventName}" — unscanned members are ABSENT)`,
  };
}

const STUDENT_SELECT = {
  id: true,
  userId: true,
  studentId: true,
  grade: true,
  section: true,
  biometricHash: true,
  its: true,
  darsId: true,
  trNo: true,
  mobileNumber: true,
  user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
} as const;

export interface ResolvedStudent {
  id: string;
  userId: string;
  studentId: string;
  grade: string;
  section: string;
  its?: string | null;
  trNo?: string | null;
  darsId?: string | null;
  user: { firstName: string; lastName: string; email?: string; avatarUrl?: string | null };
}

export interface ResolvedTeacher {
  id: string;
  userId: string;
  employeeId: string;
  department: string | null;
  user: { firstName: string; lastName: string; email?: string; avatarUrl?: string | null };
}

/**
 * Ultra-resilient student resolver matching against multiple identifier variations:
 * 1. Exact biometricHash
 * 2. Exact its, studentId, darsId, trNo
 * 3. Leading zero-stripped numeric matches (e.g. Hikvision "0000000030382757" -> "30382757")
 * 4. User ID or Email
 * 5. Prefix variations (e.g. "STU-30382757", "ITS-30382757")
 * 6. Mobile number / phone matches
 */
export async function resolveStudent(ref: string): Promise<ResolvedStudent | null> {
  const raw = String(ref || "").trim();
  if (!raw) return null;

  const strippedNum = raw.replace(/^0+/, "");
  const candidates = Array.from(new Set([raw, strippedNum])).filter(Boolean);

  // 1. Direct match by biometricHash
  const byHash = await prisma.studentProfile.findFirst({
    where: { biometricHash: { in: candidates } },
    select: STUDENT_SELECT,
  });
  if (byHash) return byHash;

  // 2. Direct match across all standard IDs (studentId, its, darsId, trNo, id, userId, mobileNumber)
  const byId = await prisma.studentProfile.findFirst({
    where: {
      OR: [
        { id: { in: candidates } },
        { userId: { in: candidates } },
        { studentId: { in: candidates } },
        { its: { in: candidates } },
        { darsId: { in: candidates } },
        { trNo: { in: candidates } },
        { mobileNumber: { in: candidates } },
      ],
    },
    select: STUDENT_SELECT,
  });
  if (byId) return byId;

  // 3. Match by User email or User ID
  const byUser = await prisma.studentProfile.findFirst({
    where: {
      user: {
        OR: [
          { email: { equals: raw, mode: "insensitive" } },
          { id: raw },
        ],
      },
    },
    select: STUDENT_SELECT,
  });
  if (byUser) return byUser;

  // 4. Prefix-stripped normalization (e.g. "STU-30382757", "ITS-30382757", "FP-...")
  const prefixMatch = raw.match(/^(?:STU|ITS|FP|CARD|ID|TALABAT)[-_:.]?(.*)$/i);
  if (prefixMatch && prefixMatch[1]) {
    const inner = prefixMatch[1].trim();
    const innerStripped = inner.replace(/^0+/, "");
    const innerCandidates = Array.from(new Set([inner, innerStripped])).filter(Boolean);
    const byPrefix = await prisma.studentProfile.findFirst({
      where: {
        OR: [
          { studentId: { in: innerCandidates } },
          { its: { in: innerCandidates } },
          { darsId: { in: innerCandidates } },
          { trNo: { in: innerCandidates } },
          { biometricHash: { in: innerCandidates } },
          { id: { in: innerCandidates } },
        ],
      },
      select: STUDENT_SELECT,
    });
    if (byPrefix) return byPrefix;
  }

  // 5. Case-insensitive studentId / its check
  return prisma.studentProfile.findFirst({
    where: {
      OR: [
        { studentId: { equals: raw, mode: "insensitive" } },
        { its: { equals: raw, mode: "insensitive" } },
        ...(strippedNum ? [
          { studentId: { equals: strippedNum, mode: "insensitive" as const } },
          { its: { equals: strippedNum, mode: "insensitive" as const } },
        ] : []),
      ],
    },
    select: STUDENT_SELECT,
  });
}

/**
 * Resolve Teacher / Faculty for biometric passes
 */
export async function resolveTeacher(ref: string): Promise<ResolvedTeacher | null> {
  const raw = String(ref || "").trim();
  if (!raw) return null;

  const teacherSelect = {
    id: true,
    userId: true,
    employeeId: true,
    its: true,
    department: true,
    user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
  } as const;

  const strippedNum = raw.replace(/^0+/, "");
  const candidates = Array.from(new Set([raw, strippedNum])).filter(Boolean);

  // 1. Direct match by biometricHash
  const byHash = await prisma.teacherProfile.findFirst({
    where: { biometricHash: { in: candidates } },
    select: teacherSelect,
  });
  if (byHash) return byHash as any;

  // 2. Direct match by standard IDs (employeeId, its, id, userId, mobile)
  const byId = await prisma.teacherProfile.findFirst({
    where: {
      OR: [
        { id: { in: candidates } },
        { userId: { in: candidates } },
        { employeeId: { in: candidates } },
        { its: { in: candidates } },
        { mobile: { in: candidates } },
        { user: { email: { equals: raw, mode: "insensitive" } } },
      ],
    },
    select: teacherSelect,
  });
  if (byId) return byId as any;

  // 3. Prefix-stripped normalization (e.g. "EMP-50463544", "FAC-50463544", "TEA-50463544", "ITS-50463544")
  const prefixMatch = raw.match(/^(?:EMP|TEA|FAC|STAFF|TEACHER|FACULTY|ITS|FP|CARD|ID)[-_:.]?(.*)$/i);
  if (prefixMatch && prefixMatch[1]) {
    const inner = prefixMatch[1].trim();
    const innerStripped = inner.replace(/^0+/, "");
    const innerCandidates = Array.from(new Set([inner, innerStripped])).filter(Boolean);
    const byPrefix = await prisma.teacherProfile.findFirst({
      where: {
        OR: [
          { employeeId: { in: innerCandidates } },
          { its: { in: innerCandidates } },
          { biometricHash: { in: innerCandidates } },
          { id: { in: innerCandidates } },
        ],
      },
      select: teacherSelect,
    });
    if (byPrefix) return byPrefix as any;
  }

  // 4. Case-insensitive employeeId / its check
  return prisma.teacherProfile.findFirst({
    where: {
      OR: [
        { employeeId: { equals: raw, mode: "insensitive" } },
        { its: { equals: raw, mode: "insensitive" } },
        ...(strippedNum ? [
          { employeeId: { equals: strippedNum, mode: "insensitive" as const } },
          { its: { equals: strippedNum, mode: "insensitive" as const } },
        ] : []),
      ],
    },
    select: teacherSelect,
  }) as any;
}

/**
 * Ensure a student has at least one active class enrollment.
 * If none exists, links them to the class matching their grade and section.
 */
async function ensureStudentEnrollment(student: ResolvedStudent) {
  const enrollments = await prisma.classEnrollment.findMany({
    where: { studentId: student.id, isActive: true },
    include: { class: { select: { id: true, name: true, subject: true, isActive: true } } },
  });

  const active = enrollments.filter((e) => e.class?.isActive !== false);
  if (active.length > 0) return active;

  // Find or create class for student's grade & section
  let targetClass = await prisma.class.findFirst({
    where: { grade: student.grade, section: student.section, isActive: true },
  });

  if (!targetClass) {
    targetClass = await prisma.class.findFirst({
      where: { grade: student.grade, isActive: true },
    });
  }

  if (!targetClass) {
    targetClass = await prisma.class.findFirst({
      where: { isActive: true },
    });
  }

  if (targetClass) {
    try {
      const newEnrollment = await prisma.classEnrollment.upsert({
        where: { classId_studentId: { classId: targetClass.id, studentId: student.id } },
        create: { classId: targetClass.id, studentId: student.id, isActive: true },
        update: { isActive: true },
        include: { class: { select: { id: true, name: true, subject: true, isActive: true } } },
      });
      return [newEnrollment];
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Process a single biometric scan.
 * First check-in of the day wins; later scans never downgrade an earlier status.
 */
export async function processBiometricScan(
  fingerprint: string,
  timestamp?: string | number | Date,
  deviceId?: string | null,
  verifyMode?: string | number | null,
): Promise<BiometricEvent> {
  const when = parseScanTime(timestamp);
  const { scanMinutes, calendarDayUTC, timeFormatted12 } = getISTDetails(when);
  const date = calendarDayUTC;
  const method = normalizeVerifyMode(verifyMode);

  // 1. Attempt to resolve Student
  const student = await resolveStudent(fingerprint);

  if (!student) {
    // 2. Check if this is a Teacher / Faculty Member
    const teacher = await resolveTeacher(fingerprint);
    if (teacher) {
      const teacherInfo = {
        id: teacher.id,
        userId: teacher.userId,
        employeeId: teacher.employeeId,
        name: `${teacher.user.firstName} ${teacher.user.lastName}`.trim(),
        department: teacher.department,
        avatarUrl: teacher.user.avatarUrl,
        its: (teacher as any).its || teacher.employeeId,
      };

      // Fetch the faculty timer from the unified schedule event
      const facultyWindow = await getScanWindow("TEACHER", when);
      const facultyWindowStatus = await isRoleWindowOpen("TEACHER", when);

      // Determine attendance status (PRESENT / LATE) with strict schedule enforcement
      let teacherStatus: "PRESENT" | "LATE" = "PRESENT";
      if (facultyWindow && facultyWindow.enabled) {
        if (facultyWindowStatus.isUpcoming) {
          // Strict Schedule Enforcement: Block early attendance marking
          return pushEvent({
            type: "TOO_EARLY",
            fingerprint,
            deviceId: deviceId ?? null,
            role: "TEACHER",
            teacher: teacherInfo,
            message: `Too early to scan. Faculty window opens at ${facultyWindow.startTime} IST. Attendance not recorded.`,
            verifyMode: method,
            scanWindow: windowPayload(facultyWindow),
          }, when, false);
        }

        // Strict Exemption: Excluded from schedule session
        if (facultyWindow.exemptTeacherIds && facultyWindow.exemptTeacherIds.includes(teacher.id)) {
          return pushEvent({
            type: "SYSTEM",
            fingerprint,
            deviceId: deviceId ?? null,
            role: "TEACHER",
            teacher: teacherInfo,
            message: `Faculty ${teacherInfo.name} is exempt from "${facultyWindow.eventName}". Scan acknowledged.`,
            verifyMode: method,
            scanWindow: windowPayload(facultyWindow),
          }, when, true);
        }

        // Strict Roster Applicability: If roster is specified, only assigned faculty are processed
        if (facultyWindow.applicableTeacherIds && facultyWindow.applicableTeacherIds.length > 0) {
          if (!facultyWindow.applicableTeacherIds.includes(teacher.id)) {
            return pushEvent({
              type: "SYSTEM",
              fingerprint,
              deviceId: deviceId ?? null,
              role: "TEACHER",
              teacher: teacherInfo,
              message: `Faculty ${teacherInfo.name} is not in the applicability roster for "${facultyWindow.eventName}".`,
              verifyMode: method,
              scanWindow: windowPayload(facultyWindow),
            }, when, true);
          }
        }

        if (facultyWindowStatus.isOpen) {
          teacherStatus = resolveScanStatus(facultyWindow, scanMinutes) === "LATE" ? "LATE" : "PRESENT";
        } else {
          // Window has passed / late arrival
          teacherStatus = "LATE";
        }
      } else {
        const morningBoundary = 8 * 60 + 30; // 8:30 AM IST fallback
        teacherStatus = scanMinutes <= morningBoundary ? "PRESENT" : "LATE";
      }

      // Check if faculty member is on active Medical Exemption today
      const activeMedical = await prisma.medicalExemption.findFirst({
        where: {
          teacherId: teacher.id,
          date,
          isActive: true,
        },
      });

      if (activeMedical) {
        await prisma.teacherAttendanceRecord.upsert({
          where: { teacherId_date: { teacherId: teacher.id, date } },
          create: {
            teacherId: teacher.id,
            date,
            status: "MEDICAL",
            checkInTime: when,
            verificationMethod: "BIOMETRIC",
            biometricMethod: method === "BIOMETRIC" ? null : method,
            biometricHash: fingerprint,
            notes: `Medical Exemption: ${activeMedical.eventName || "Medical Duty"} (${activeMedical.reason})`,
          },
          update: {
            checkInTime: when,
          },
        });

        cache.invalidateTag("teacherAttendanceRecord");
        cache.invalidateTag("dashboard");

        return pushEvent({
          type: "MATCHED",
          fingerprint,
          deviceId: deviceId ?? null,
          role: "TEACHER",
          teacher: {
            ...teacherInfo,
            status: "MEDICAL" as any,
          },
          message: `Faculty Verified (Medical Leave active): ${teacherInfo.name}`,
          verifyMode: method,
          scanWindow: windowPayload(facultyWindow),
        }, when, false);
      }

      // Check if attendance already recorded for this faculty member today
      const existingTeacherRecord = await prisma.teacherAttendanceRecord.findUnique({
        where: { teacherId_date: { teacherId: teacher.id, date } },
      });

      if (existingTeacherRecord) {
        const firstCheckIn = existingTeacherRecord.checkInTime;
        const timeStr = firstCheckIn
          ? getISTDetails(new Date(firstCheckIn)).timeFormatted12
          : timeFormatted12;
        return pushEvent({
          type: "DUPLICATE",
          fingerprint,
          deviceId: deviceId ?? null,
          role: "TEACHER",
          isDuplicate: true,
          teacher: {
            ...teacherInfo,
            status: existingTeacherRecord.status as "PRESENT" | "LATE",
            attendanceId: existingTeacherRecord.id,
          },
          message: `Faculty Verified (Already checked in at ${timeStr || "earlier"} IST): ${teacherInfo.name}`,
          verifyMode: method,
          scanWindow: windowPayload(facultyWindow),
        }, when, false);
      }

      const teacherRecord = await prisma.teacherAttendanceRecord.upsert({
        where: { teacherId_date: { teacherId: teacher.id, date } },
        create: {
          teacherId: teacher.id,
          date,
          status: teacherStatus,
          checkInTime: when,
          verificationMethod: "BIOMETRIC",
          biometricMethod: method === "BIOMETRIC" ? null : method,
          biometricHash: fingerprint,
        },
        update: {
          status: teacherStatus,
          checkInTime: when,
          verificationMethod: "BIOMETRIC",
          biometricMethod: method === "BIOMETRIC" ? null : method,
          biometricHash: fingerprint,
        },
      });

      cache.invalidateTag("teacherAttendanceRecord");
      cache.invalidateTag("attendanceRecord");
      cache.invalidateTag("dashboard");
      cache.invalidateTag("stats");

      // ── Dispatch notification to faculty member ──
      try {
        if (teacher.userId) {
          await prisma.notification.create({
            data: {
              userId: teacher.userId,
              title: `⚡ Faculty Check-In: ${teacherInfo.name}`,
              body: `${teacherInfo.name} checked in (${teacherStatus}) at ${timeFormatted12} IST via ${method || "Biometric Scan"}.`,
              type: "ATTENDANCE" as any,
              link: "/faculty/attendance",
            },
          });
        }
      } catch (notifErr) {
        console.warn("[biometric] faculty notification dispatch notice:", notifErr);
      }

      return pushEvent({
        type: "MATCHED",
        fingerprint,
        deviceId: deviceId ?? null,
        role: "TEACHER",
        teacher: {
          ...teacherInfo,
          status: teacherRecord.status as "PRESENT" | "LATE",
          attendanceId: teacherRecord.id,
        },
        message: `Faculty Attendance marked ${teacherStatus} for ${teacherInfo.name} at ${timeFormatted12} IST`,
        verifyMode: method,
        scanWindow: windowPayload(facultyWindow),
      }, when, false);
    }

    recordUnmatched(fingerprint);
    return pushEvent({
      type: "UNKNOWN",
      fingerprint,
      deviceId: deviceId ?? null,
      message: `Unrecognized ID "${fingerprint}" scanned at ${timeFormatted12} IST. Assign this ID in Admin → Biometric.`,
      verifyMode: method,
    }, when, false);
  }

  const studentInfo = {
    id: student.id,
    userId: student.userId,
    studentId: student.studentId,
    its: student.its || student.studentId,
    name: `${student.user.firstName} ${student.user.lastName}`.trim(),
    grade: student.grade,
    section: student.section,
    avatarUrl: student.user.avatarUrl,
  };

  // Fetch the Talabat timer from the unified schedule event
  const studentWindow = await getScanWindow("STUDENT", when);
  const studentWindowStatus = await isRoleWindowOpen("STUDENT", when);

  // Ensure active class enrollment exists
  const activeClasses = await ensureStudentEnrollment(student);

  // Check if student is on approved leave today
  const leave = await prisma.leaveRequest.findFirst({
    where: {
      studentId: student.id,
      status: "APPROVED",
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });

  if (leave) {
    const leaveStatus = leave.type === "MEDICAL" ? "MEDICAL" : "ON_LEAVE";
    return pushEvent({
      type: "MATCHED",
      fingerprint,
      deviceId: deviceId ?? null,
      role: "STUDENT",
      student: {
        ...studentInfo,
        status: leaveStatus as any,
        leaveReason: leave.reason,
        leaveType: leave.type,
      },
      classes: activeClasses.map((c) => ({
        classId: c.classId,
        className: c.class.name,
        subject: c.class.subject,
        period: 1,
        startTime: studentWindow?.startTime || "07:30",
        endTime: studentWindow?.endTime || "08:15",
        status: leaveStatus,
        attendanceId: `leave_${leave.id}`,
      })),
      message: `Learner Verified (On Approved ${leave.type} Leave): ${studentInfo.name}`,
      verifyMode: method,
      scanWindow: windowPayload(studentWindow),
    }, when, false);
  }

  // Determine status (PRESENT / LATE) with strict schedule enforcement
  let status: "PRESENT" | "LATE" = "PRESENT";
  if (studentWindow && studentWindow.enabled) {
    if (studentWindowStatus.isUpcoming) {
      // Strict Schedule Enforcement: Block early attendance marking
      return pushEvent({
        type: "TOO_EARLY",
        fingerprint,
        deviceId: deviceId ?? null,
        role: "STUDENT",
        student: studentInfo,
        message: `Too early to scan. "${studentWindow.eventName}" opens at ${studentWindow.startTime} IST. Attendance not recorded.`,
        verifyMode: method,
        scanWindow: windowPayload(studentWindow),
      }, when, false);
    }

    // Strict Exemption: Excluded from schedule session
    if (studentWindow.exemptStudentIds && studentWindow.exemptStudentIds.includes(student.id)) {
      return pushEvent({
        type: "SYSTEM",
        fingerprint,
        deviceId: deviceId ?? null,
        role: "STUDENT",
        student: studentInfo,
        message: `Student ${studentInfo.name} is exempt from "${studentWindow.eventName}". Scan acknowledged.`,
        verifyMode: method,
        scanWindow: windowPayload(studentWindow),
      }, when, true);
    }

    // Strict Class Applicability: If specific classes are assigned, verify student's enrollment
    if (studentWindow.applicableClassIds && studentWindow.applicableClassIds.length > 0) {
      const isEnrolledInApplicable = activeClasses.some((c) =>
        studentWindow.applicableClassIds!.includes(c.classId),
      );
      if (!isEnrolledInApplicable) {
        return pushEvent({
          type: "SYSTEM",
          fingerprint,
          deviceId: deviceId ?? null,
          role: "STUDENT",
          student: studentInfo,
          message: `Student ${studentInfo.name} is not enrolled in classes assigned to "${studentWindow.eventName}".`,
          verifyMode: method,
          scanWindow: windowPayload(studentWindow),
        }, when, true);
      }
    }

    if (studentWindowStatus.isOpen) {
      status = resolveScanStatus(studentWindow, scanMinutes) === "LATE" ? "LATE" : "PRESENT";
    } else {
      // Scanned after late window / late arrival
      status = "LATE";
    }
  } else {
    // Default morning threshold: 08:00 AM IST
    const morningBoundary = 8 * 60; // 8:00 AM IST
    status = scanMinutes <= morningBoundary ? "PRESENT" : "LATE";
  }

  // Check if attendance is already recorded for this talabat today
  const existingRecords = await prisma.attendanceRecord.findMany({
    where: { studentId: student.id, date, verificationMethod: "BIOMETRIC" },
    include: { class: { select: { name: true, subject: true } } },
  });

  if (existingRecords.length > 0) {
    const firstCheckIn = existingRecords[0].checkInTime;
    const timeStr = firstCheckIn
      ? getISTDetails(new Date(firstCheckIn)).timeFormatted12
      : timeFormatted12;
    return pushEvent({
      type: "DUPLICATE",
      fingerprint,
      deviceId: deviceId ?? null,
      role: "STUDENT",
      isDuplicate: true,
      student: studentInfo,
      classes: existingRecords.map((r) => ({
        classId: r.classId,
        className: r.class?.name ?? `Grade ${student.grade}-${student.section}`,
        subject: r.class?.subject ?? "Core",
        period: 1,
        startTime: studentWindow?.startTime ?? "08:00",
        endTime: studentWindow?.endTime ?? "08:30",
        status: r.status as "PRESENT" | "LATE",
        attendanceId: r.id,
      })),
      message: `Already verified today at ${timeStr || "earlier"} IST. Attendance recorded.`,
      verifyMode: method,
      scanWindow: windowPayload(studentWindow),
    }, when, false);
  }

  const classMatches: BiometricClassMatch[] = [];

  // Write attendance record for every enrolled/assigned class
  if (activeClasses.length > 0) {
    for (const enrollment of activeClasses) {
      const record = await prisma.attendanceRecord.upsert({
        where: { studentId_classId_date: { studentId: student.id, classId: enrollment.classId, date } },
        create: {
          studentId: student.id,
          classId: enrollment.classId,
          date,
          status,
          checkInTime: when,
          verificationMethod: "BIOMETRIC",
          biometricMethod: method === "BIOMETRIC" ? null : method,
          biometricHash: fingerprint,
          recordedById: student.userId,
        },
        update: {
          status,
          checkInTime: when,
          verificationMethod: "BIOMETRIC",
          biometricMethod: method === "BIOMETRIC" ? null : method,
          biometricHash: fingerprint,
        },
      });

      classMatches.push({
        classId: enrollment.classId,
        className: enrollment.class?.name ?? `Grade ${student.grade}-${student.section}`,
        subject: enrollment.class?.subject ?? "Core",
        period: 1,
        startTime: studentWindow?.startTime ?? "08:00",
        endTime: studentWindow?.endTime ?? "08:30",
        status: record.status as "PRESENT" | "LATE",
        attendanceId: record.id,
      });
    }
  }

  // Persist daily attendance log in storage
  const dayUTC = calendarDayUTC;
  await prisma.attendanceRegistry.upsert({
    where: { studentId_date: { studentId: student.id, date: dayUTC } },
    create: {
      studentId: student.id,
      date: dayUTC,
      status: status as any,
      source: "BIOMETRIC",
      checkInTime: when,
      recordedById: student.userId,
    },
    update: {
      status: status as any,
      checkInTime: when,
    },
  }).catch((err) => console.error("[biometric] AttendanceRegistry upsert warning:", err));

  // Invalidate caches so student, parent, and admin dashboards update immediately
  cache.invalidateTag("attendanceRecord");
  cache.invalidateTag("attendanceRegistry");
  cache.invalidateTag("dashboard");
  cache.invalidateTag("stats");

  // ── Dispatch notifications to student and linked parents ──
  try {
    const parentLinks = await prisma.parentStudentLink.findMany({
      where: { studentId: student.id },
      select: { parent: { select: { userId: true } } },
    });

    const recipientUserIds = new Set<string>();
    if (student.userId) recipientUserIds.add(student.userId);
    for (const pl of parentLinks) {
      if (pl.parent?.userId) recipientUserIds.add(pl.parent.userId);
    }

    const notifTitle = `⚡ Attendance Scanned: ${studentInfo.name}`;
    const notifMsg = `${studentInfo.name} has checked in (${status}) at ${timeFormatted12} IST via ${method || "Biometric Scan"}.`;

    if (recipientUserIds.size > 0) {
      await prisma.notification.createMany({
        data: Array.from(recipientUserIds).map((userId) => ({
          userId,
          title: notifTitle,
          body: notifMsg,
          type: "ATTENDANCE" as any,
          link: "/parent/attendance",
        })),
      });
    }
  } catch (notifErr) {
    console.warn("[biometric] scan notification dispatch notice:", notifErr);
  }

  return pushEvent({
    type: "MATCHED",
    fingerprint,
    deviceId: deviceId ?? null,
    role: "STUDENT",
    student: studentInfo,
    classes: classMatches,
    verifyMode: method,
    message: `Attendance marked ${status} for ${studentInfo.name}`,
    scanWindow: windowPayload(studentWindow),
  }, when);
}

// ── Event store / SSE ──

/**
 * Automatically purge any in-memory events that belong to previous calendar days (in IST).
 * Guarantees that every new day / post-holiday morning begins with a 100% fresh live stream.
 */
export function prunePreviousDayEvents(): void {
  try {
    const todayIST = getISTDetails().calendarDayUTC.getTime();
    const valid = events.filter((ev) => {
      try {
        const evDate = getISTDetails(parseScanTime(ev.timestamp)).calendarDayUTC.getTime();
        return evDate === todayIST;
      } catch {
        return true;
      }
    });
    if (valid.length !== events.length) {
      events.length = 0;
      events.push(...valid);
    }
  } catch {}
}

export function getEvents(limit = 100): BiometricEvent[] {
  prunePreviousDayEvents();
  return [...events].reverse().slice(0, limit);
}

export function clearEvents(role?: "STUDENT" | "TEACHER"): void {
  if (role) {
    const remaining = events.filter((ev) => {
      if (role === "TEACHER") {
        return ev.role !== "TEACHER" && !ev.teacher;
      }
      if (role === "STUDENT") {
        return ev.role !== "STUDENT" && !ev.student;
      }
      return true;
    });
    events.length = 0;
    events.push(...remaining);
  } else {
    events.length = 0;
  }

  for (const send of sseClients) {
    try {
      send(
        `data: ${JSON.stringify({
          type: "SYSTEM",
          message: role ? `${role}_EVENTS_CLEARED` : "EVENTS_CLEARED",
          id: makeId(),
          timestamp: new Date().toISOString(),
        })}\n\n`,
      );
    } catch {}
  }
}

export function getEventCount(): number {
  return events.length;
}

export function getUptimeMs(): number {
  return Date.now() - startedAt;
}

export function subscribeSse(send: SseClient): () => void {
  sseClients.add(send);
  return () => {
    sseClients.delete(send);
  };
}

// ── Unmatched fingerprints ──

export interface UnmatchedFingerprint {
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

function recordUnmatched(fingerprint: string): void {
  const now = Date.now();
  const rec = unmatchedFp.get(fingerprint);
  if (rec) {
    rec.count++;
    rec.lastSeen = now;
  } else if (unmatchedFp.size < MAX_UNMATCHED) {
    unmatchedFp.set(fingerprint, { count: 1, firstSeen: now, lastSeen: now });
  }
}

export function getUnmatchedFingerprints(): UnmatchedFingerprint[] {
  return [...unmatchedFp.entries()]
    .map(([fingerprint, r]) => ({
      fingerprint,
      count: r.count,
      firstSeen: new Date(r.firstSeen).toISOString(),
      lastSeen: new Date(r.lastSeen).toISOString(),
    }))
    .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
}

export function clearUnmatchedFingerprint(fingerprint?: string): void {
  if (fingerprint) unmatchedFp.delete(fingerprint);
  else unmatchedFp.clear();
}

// ── Mock device ──

export function isMockRunning(): boolean {
  return mockTimer !== null;
}

export async function startMock(): Promise<void> {
  if (mockTimer) return;
  await mockScan();
  mockTimer = setInterval(() => {
    mockScan().catch((error) => {
      console.error("[biometric] mock scan error:", error);
    });
  }, MOCK_INTERVAL_MS);
}

export function stopMock(): void {
  if (mockTimer) {
    clearInterval(mockTimer);
    mockTimer = null;
  }
}

async function mockScan(): Promise<void> {
  const weekday = new Date().getDay();
  const slots = await prisma.timetableSlot.findMany({
    where: { dayOfWeek: weekday, isBreak: false, classId: { not: null } },
    include: {
      class: {
        select: {
          id: true,
          isActive: true,
          enrollments: {
            where: { isActive: true },
            select: { student: { select: { biometricHash: true } } },
          },
        },
      },
    },
  });

  const candidates = slots.flatMap((s) =>
    (s.class?.enrollments ?? [])
      .filter((e) => e.student.biometricHash)
      .map((e) => ({
        fingerprint: e.student.biometricHash as string,
        startHour: Number(s.startTime.split(":")[0]),
        startMin: Number(s.startTime.split(":")[1]),
        endHour: Number(s.endTime.split(":")[0]),
        endMin: Number(s.endTime.split(":")[1]),
      })),
  );

  if (candidates.length === 0) {
    const now = Date.now();
    if (now - lastMockWarningAt > 30_000) {
      lastMockWarningAt = now;
      pushEvent({
        type: "SYSTEM",
        fingerprint: "",
        deviceId: "mock",
        message: "No enrolled talabat with a registered fingerprint to simulate. Enroll fingerprints first.",
      });
    }
    return;
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  const startMs = (pick.startHour * 60 + pick.startMin) * 60_000;
  const endMs = (pick.endHour * 60 + pick.endMin) * 60_000;
  const window = endMs - startMs;
  // Scan anywhere from 10 minutes before the period starts to the end of the period.
  const offsetMs = Math.floor(Math.random() * (window + 1)) - 10 * 60_000;

  const base = new Date();
  base.setHours(0, 0, 0, 0);
  base.setTime(base.getTime() + startMs + offsetMs);

  // Alternate between fingerprint and facial so the feed exercises both.
  const mode = Math.random() < 0.5 ? "Fingerprint" : "Face";
  await processBiometricScan(pick.fingerprint, base, "mock-device", mode);
}
