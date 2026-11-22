import prisma from "./prisma";
import { processBiometricScan, getStartOfDayIST, getISTDetails } from "./biometric";
import { markScanLogOutcome } from "./biometric-scan-log";
import { cache } from "./cache";

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

export interface ReconcileAllHistoryResult {
  datesProcessed: number;
  totalLogsConsidered: number;
  totalLogsReplayed: number;
  totalStudentsUpdated: number;
  totalTeachersUpdated: number;
  dates: string[];
}

/**
 * Reconcile ALL historical attendance records strictly to institutional schedule rules.
 *
 * 1. Collects all historical attendance dates from BiometricScanLog, AttendanceRecord, and TeacherAttendanceRecord.
 * 2. Replays any unhandled biometric punch logs from Supabase.
 * 3. Applies strict schedule window boundaries:
 *    - On-Time (<= cutoff + grace): PRESENT (Green)
 *    - Late (> cutoff + grace): LATE (Yellow)
 *    - No Scan (and not approved leave/medical/holiday): ABSENT (Red)
 * 4. Updates records and invalidates caches so that all views display accurate counts.
 */
export async function reconcileAllHistoricalAttendanceStrict(): Promise<ReconcileAllHistoryResult> {
  const [studentDates, teacherDates, logDates] = await Promise.all([
    prisma.attendanceRecord.findMany({
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "asc" },
    }),
    prisma.teacherAttendanceRecord.findMany({
      select: { date: true },
      distinct: ["date"],
      orderBy: { date: "asc" },
    }),
    prisma.biometricScanLog.findMany({
      select: { scannedAt: true },
      orderBy: { scannedAt: "asc" },
      take: 10000,
    }),
  ]);

  const uniqueDateSet = new Set<string>();
  studentDates.forEach((r) => {
    if (r.date) uniqueDateSet.add(r.date.toISOString().slice(0, 10));
  });
  teacherDates.forEach((r) => {
    if (r.date) uniqueDateSet.add(r.date.toISOString().slice(0, 10));
  });
  logDates.forEach((l) => {
    if (l.scannedAt) {
      const { calendarDayUTC } = getISTDetails(l.scannedAt);
      uniqueDateSet.add(calendarDayUTC.toISOString().slice(0, 10));
    }
  });

  const todayIST = getStartOfDayIST(new Date()).toISOString().slice(0, 10);
  uniqueDateSet.add(todayIST);

  const sortedDates = Array.from(uniqueDateSet).sort();

  let totalLogsConsidered = 0;
  let totalLogsReplayed = 0;
  let totalStudentsUpdated = 0;
  let totalTeachersUpdated = 0;

  const windows = await prisma.biometricScanWindow.findMany({
    orderBy: { startTime: "asc" },
  });

  const defaultWindow = windows.find((w) => w.id === "default" || /tilawat/i.test(w.name)) || windows[0];

  const parseMinutes = (timeStr?: string | null, fallback = 0): number => {
    if (!timeStr) return fallback;
    const [h, m] = timeStr.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const studentEndMin = parseMinutes(defaultWindow?.endTime, 7 * 60 + 50); // 07:50 IST
  const studentGrace = Math.max(0, defaultWindow?.graceMinutes ?? 10);
  const studentOnTimeUntil = studentEndMin + studentGrace; // 08:00 IST (480 min)

  const facultyEndMin = parseMinutes(defaultWindow?.facultyEndTime, 8 * 60 + 3); // 08:03 IST
  const facultyGrace = Math.max(0, defaultWindow?.graceMinutes ?? 10);
  const facultyOnTimeUntil = facultyEndMin + facultyGrace; // 08:13 IST (493 min)

  console.log(`[reconcile-all] Found ${sortedDates.length} distinct dates across records and logs to reconcile.`);

  for (let i = 0; i < sortedDates.length; i++) {
    const dateStr = sortedDates[i];
    const dayStart = getStartOfDayIST(dateStr);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const isSunday = dayStart.getUTCDay() === 0;

    try {
      const replayRes = await reconcileAttendanceFromScanLogs(dateStr);
      totalLogsConsidered += replayRes.logsConsidered;
      totalLogsReplayed += replayRes.replayed;
    } catch (e) {
      console.warn(`[reconcile-all] Scan replay notice for ${dateStr}:`, e);
    }

    // Re-evaluate Student Attendance Records (batched by status for speed)
    const studentRecords = await prisma.attendanceRecord.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      select: { id: true, status: true, checkInTime: true },
    });

    const studentBatches: Record<string, string[]> = {};
    for (const rec of studentRecords) {
      let desiredStatus: "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE" | "MEDICAL" | "HOLIDAY" = "ABSENT";

      if (rec.status === "ON_LEAVE" || rec.status === "MEDICAL") {
        desiredStatus = rec.status;
      } else if (isSunday) {
        desiredStatus = "HOLIDAY";
      } else if (rec.checkInTime) {
        const { scanMinutes } = getISTDetails(rec.checkInTime);
        if (scanMinutes <= studentOnTimeUntil) {
          desiredStatus = "PRESENT";
        } else {
          desiredStatus = "LATE";
        }
      } else {
        desiredStatus = "ABSENT";
      }

      if (rec.status !== desiredStatus) {
        if (!studentBatches[desiredStatus]) studentBatches[desiredStatus] = [];
        studentBatches[desiredStatus].push(rec.id);
        totalStudentsUpdated++;
      }
    }

    for (const [status, ids] of Object.entries(studentBatches)) {
      if (ids.length > 0) {
        await prisma.attendanceRecord.updateMany({
          where: { id: { in: ids } },
          data: { status: status as any },
        });
      }
    }

    // Re-evaluate Attendance Registry items (batched by status)
    const registries = await prisma.attendanceRegistry.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      select: { id: true, status: true, checkInTime: true },
    });

    const regBatches: Record<string, string[]> = {};
    for (const reg of registries) {
      let desiredStatus: "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE" | "MEDICAL" | "HOLIDAY" = "ABSENT";

      if (reg.status === "ON_LEAVE" || reg.status === "MEDICAL") {
        desiredStatus = reg.status;
      } else if (isSunday) {
        desiredStatus = "HOLIDAY";
      } else if (reg.checkInTime) {
        const { scanMinutes } = getISTDetails(reg.checkInTime);
        if (scanMinutes <= studentOnTimeUntil) {
          desiredStatus = "PRESENT";
        } else {
          desiredStatus = "LATE";
        }
      } else {
        desiredStatus = "ABSENT";
      }

      if (reg.status !== desiredStatus) {
        if (!regBatches[desiredStatus]) regBatches[desiredStatus] = [];
        regBatches[desiredStatus].push(reg.id);
      }
    }

    for (const [status, ids] of Object.entries(regBatches)) {
      if (ids.length > 0) {
        await prisma.attendanceRegistry.updateMany({
          where: { id: { in: ids } },
          data: { status: status as any },
        });
      }
    }

    // Re-evaluate Faculty / Teacher Attendance Records (batched by status)
    const teacherRecords = await prisma.teacherAttendanceRecord.findMany({
      where: { date: { gte: dayStart, lt: dayEnd } },
      select: { id: true, status: true, checkInTime: true },
    });

    const teacherBatches: Record<string, string[]> = {};
    for (const trec of teacherRecords) {
      let desiredStatus: "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE" | "MEDICAL" | "HOLIDAY" = "ABSENT";

      if (trec.status === "ON_LEAVE" || trec.status === "MEDICAL") {
        desiredStatus = trec.status;
      } else if (isSunday) {
        desiredStatus = "HOLIDAY";
      } else if (trec.checkInTime) {
        const { scanMinutes } = getISTDetails(trec.checkInTime);
        if (scanMinutes <= facultyOnTimeUntil) {
          desiredStatus = "PRESENT";
        } else {
          desiredStatus = "LATE";
        }
      } else {
        desiredStatus = "ABSENT";
      }

      if (trec.status !== desiredStatus) {
        if (!teacherBatches[desiredStatus]) teacherBatches[desiredStatus] = [];
        teacherBatches[desiredStatus].push(trec.id);
        totalTeachersUpdated++;
      }
    }

    for (const [status, ids] of Object.entries(teacherBatches)) {
      if (ids.length > 0) {
        await prisma.teacherAttendanceRecord.updateMany({
          where: { id: { in: ids } },
          data: { status: status as any },
        });
      }
    }

    if ((i + 1) % 5 === 0 || i === sortedDates.length - 1) {
      console.log(`[reconcile-all] Progress: ${i + 1}/${sortedDates.length} dates reconciled (${dateStr})`);
    }
  }

  cache.invalidateTag("attendanceRecord");
  cache.invalidateTag("teacherAttendanceRecord");
  cache.invalidateTag("dashboard");
  cache.invalidateTag("stats");

  return {
    datesProcessed: sortedDates.length,
    totalLogsConsidered,
    totalLogsReplayed,
    totalStudentsUpdated,
    totalTeachersUpdated,
    dates: sortedDates,
  };
}
