import prisma from "./prisma";
import { processBiometricScan, getStartOfDayIST } from "./biometric";
import { markScanLogOutcome } from "./biometric-scan-log";

/**
 * Rebuild attendance from the permanent Supabase punch ledger.
 *
 * This is the "no bridge" reconciliation path: instead of reaching into the
 * school LAN and polling Hikvision terminals, the server reads every punch that
 * already landed in `biometric_scan_logs` and re-applies identity matching /
 * attendance derivation. Safe to run repeatedly — outcomes are idempotent and
 * already-applied punches are skipped.
 */
export interface ReconcileScanLogsResult {
  date: string;
  logsConsidered: number;
  replayed: number;
  matched: number;
  stillUnmatched: number;
  failed: number;
}

/**
 * Outcome states that still need identity resolution / attendance derivation.
 * - RECEIVED / POLL / BACKFILL: stored but never applied (e.g. cloud could not
 *   reach the terminal, or a LAN import wrote the punch only).
 * - UNMATCHED / UNKNOWN: the punch carried an ID that did not resolve at the time.
 * - ERROR: processing blew up and should be retried.
 *
 * Deliberate non-attendance states (SYSTEM heartbeats, IGNORED RFID cards,
 * WINDOW_CLOSED, DUPLICATE, HOLIDAY) are never replayed.
 */
const PENDING_OUTCOMES = ["RECEIVED", "POLL", "BACKFILL", "UNMATCHED", "UNKNOWN", "ERROR"];

export async function reconcileAttendanceFromScanLogs(dateInput?: Date | string): Promise<ReconcileScanLogsResult> {
  const dayStart = getStartOfDayIST(dateInput ?? new Date());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const date = dayStart.toISOString().slice(0, 10);

  const logs = await prisma.biometricScanLog.findMany({
    where: {
      scannedAt: { gte: dayStart, lt: dayEnd },
      outcome: { in: PENDING_OUTCOMES },
      NOT: [{ rawEmployeeNo: "HEARTBEAT" }],
    },
    orderBy: { scannedAt: "asc" },
    take: 5000,
  });

  let replayed = 0;
  let matched = 0;
  let stillUnmatched = 0;
  let failed = 0;

  for (const log of logs) {
    const identifier = (log.employeeNo || log.rawEmployeeNo || "").trim();
    if (!identifier) continue;

    replayed++;
    try {
      const result = await processBiometricScan(
        identifier,
        log.scannedAt,
        log.deviceHost ? `hikvision:${log.deviceHost}` : "hikvision:supabase",
        log.method || log.verifyMode || undefined,
      );
      const didMatch = Boolean(result.student || result.teacher) || result.type === "MATCHED";
      if (didMatch) matched++;
      else stillUnmatched++;

      await markScanLogOutcome(log.dedupeKey ?? log.id, {
        outcome: result.type,
        attendance: didMatch,
        matchedType: result.role ?? null,
        studentId: result.student?.id ?? null,
        teacherId: result.teacher?.id ?? null,
        userId: result.student?.userId ?? result.teacher?.userId ?? null,
        message: result.message ?? null,
      });
    } catch (err: any) {
      failed++;
      await markScanLogOutcome(log.dedupeKey ?? log.id, {
        outcome: "ERROR",
        message: err?.message || String(err),
      });
    }
  }

  return {
    date,
    logsConsidered: logs.length,
    replayed,
    matched,
    stillUnmatched,
    failed,
  };
}

/**
 * Background safety net: every couple of minutes, turn any punch that is still
 * sitting unresolved in Supabase into attendance. This is what makes the
 * terminal → Supabase push path self-healing: no LAN polling and no bridge
 * process is needed for a stored punch to be applied.
 */
let ledgerTimer: ReturnType<typeof setInterval> | null = null;
let ledgerRunning = false;

export function startScanLedgerReconciler(intervalMs = 2 * 60 * 1000): void {
  if (ledgerTimer) return;

  const tick = async () => {
    if (ledgerRunning) return;
    ledgerRunning = true;
    try {
      const result = await reconcileAttendanceFromScanLogs(new Date());
      if (result.replayed > 0) {
        console.log(
          `[scan-ledger] reconciled ${result.replayed} pending punch(es) for ${result.date} — ${result.matched} matched, ${result.stillUnmatched} unmatched, ${result.failed} failed`,
        );
      }
    } catch (err: any) {
      console.warn("[scan-ledger] reconcile tick skipped:", err?.message || err);
    } finally {
      ledgerRunning = false;
    }
  };

  ledgerTimer = setInterval(tick, intervalMs);
  if (typeof ledgerTimer.unref === "function") ledgerTimer.unref();
  void tick();
  console.log(`[scan-ledger] Supabase punch-ledger reconciler started (every ${Math.round(intervalMs / 1000)}s)`);
}

export function stopScanLedgerReconciler(): void {
  if (ledgerTimer) {
    clearInterval(ledgerTimer);
    ledgerTimer = null;
  }
}
