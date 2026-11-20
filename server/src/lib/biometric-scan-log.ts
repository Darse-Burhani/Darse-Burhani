import prisma from "./prisma";

/**
 * Raw punch ledger (`biometric_scan_logs`).
 *
 * Every event a Hikvision terminal sends — webhook push, LAN poll, or manual
 * replay — is written here before/while it is converted into attendance. This
 * makes Supabase the single source of truth for hardware scans: the dashboard,
 * reconciliation jobs and audits can all read punches straight from Postgres
 * without needing a local bridge process.
 *
 * Logging must never break attendance ingestion, so every write is best-effort.
 */

export interface ScanLogInput {
  deviceId?: string | null;
  deviceHost?: string | null;
  deviceName?: string | null;
  /** Exactly what the terminal sent (employeeNoString / cardNo / name). */
  rawEmployeeNo: string;
  /** Canonical ITS / employee number after alias resolution. */
  employeeNo?: string | null;
  personName?: string | null;
  scannedAt: Date | string;
  verifyMode?: string | null;
  method?: string | null;
  serialNo?: string | null;
  source?: "PUSH" | "POLL" | "MANUAL" | string;
  outcome?: string;
  attendance?: boolean;
  matchedType?: "STUDENT" | "TEACHER" | null;
  studentId?: string | null;
  teacherId?: string | null;
  userId?: string | null;
  message?: string | null;
  rawPayload?: unknown;
  /** Stable per-device key so replaying the same punch never duplicates a row. */
  dedupeKey?: string | null;
}

/** Accepts a Date, ISO string or Hikvision wall-clock string. */
function toDate(value: Date | string): Date {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export async function logBiometricScan(input: ScanLogInput): Promise<void> {
  const rawEmployeeNo = String(input.rawEmployeeNo ?? "").trim();
  if (!rawEmployeeNo) return;

  try {
    const scannedAt = toDate(input.scannedAt);
    const dedupeKey =
      input.dedupeKey ??
      (input.serialNo
        ? `${input.deviceHost || input.deviceId || "hik"}:serial:${input.serialNo}`
        : `${input.deviceHost || input.deviceId || "hik"}:${rawEmployeeNo}:${scannedAt.toISOString()}`);

    await prisma.biometricScanLog.createMany({
      data: [
        {
          deviceId: input.deviceId ?? null,
          deviceHost: input.deviceHost ?? null,
          deviceName: input.deviceName ?? null,
          rawEmployeeNo,
          employeeNo: input.employeeNo ? String(input.employeeNo) : null,
          personName: input.personName ?? null,
          scannedAt,
          verifyMode: input.verifyMode ?? null,
          method: input.method ?? null,
          serialNo: input.serialNo ?? null,
          source: input.source ?? "PUSH",
          outcome: input.outcome ?? "RECEIVED",
          attendance: Boolean(input.attendance),
          matchedType: input.matchedType ?? null,
          studentId: input.studentId ?? null,
          teacherId: input.teacherId ?? null,
          userId: input.userId ?? null,
          message: input.message ?? null,
          rawPayload: (input.rawPayload ?? undefined) as any,
          dedupeKey,
        },
      ],
      skipDuplicates: true,
    });
  } catch (err: any) {
    // Never let an audit-log failure drop a real attendance scan.
    console.warn("[biometric-scan-log] write skipped:", err?.message || err);
  }
}

/** Update the outcome of an already-written punch (e.g. poll → processed). */
export async function markScanLogOutcome(
  dedupeKey: string,
  patch: Partial<Pick<ScanLogInput, "outcome" | "attendance" | "matchedType" | "studentId" | "teacherId" | "userId" | "message" | "method" | "employeeNo" | "personName">>,
): Promise<void> {
  try {
    await prisma.biometricScanLog.updateMany({
      where: { dedupeKey },
      data: {
        outcome: patch.outcome,
        attendance: patch.attendance,
        matchedType: patch.matchedType ?? undefined,
        studentId: patch.studentId ?? undefined,
        teacherId: patch.teacherId ?? undefined,
        userId: patch.userId ?? undefined,
        message: patch.message ?? undefined,
        method: patch.method ?? undefined,
        employeeNo: patch.employeeNo ? String(patch.employeeNo) : undefined,
        personName: patch.personName ?? undefined,
      },
    });
  } catch (err: any) {
    console.warn("[biometric-scan-log] outcome update skipped:", err?.message || err);
  }
}
