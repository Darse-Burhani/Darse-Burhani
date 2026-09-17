import {
  getUnsyncedAttendanceRecords,
  getUnsyncedFinalizedEvents,
  getSyncQueue,
  markRecordSynced,
  markFinalizedEventSynced,
  removeSyncItem,
  incrementSyncRetry,
  setLastSyncAt,
  getOfflineStats,
  clearSyncedData,
} from "./offline-attendance";

interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

let syncInProgress = false;
let syncInterval: ReturnType<typeof setInterval> | null = null;
const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 2000;

async function syncAttendanceRecord(record: any): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(record),
    });
    const data = await response.json();
    if (!data.success) {
      return { success: false, error: data.error || "Server rejected record" };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

async function syncFinalizedEvent(event: any): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/admin/attendance-logs/finalize-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: event.date,
        eventId: event.eventId,
        records: event.records,
      }),
    });
    const data = await response.json();
    if (!data.success) {
      return { success: false, error: data.error || "Server rejected finalized event" };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

async function syncBulkAttendance(payload: any): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/attendance/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!data.success) {
      return { success: false, error: data.error || "Server rejected bulk attendance" };
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

async function processSyncQueue(): Promise<SyncResult> {
  if (syncInProgress) return { success: false, syncedCount: 0, failedCount: 0, errors: ["Sync already in progress"] };

  syncInProgress = true;
  const result: SyncResult = { success: true, syncedCount: 0, failedCount: 0, errors: [] };

  try {
    const queue = await getSyncQueue();
    const unsyncedRecords = await getUnsyncedAttendanceRecords();
    const unsyncedEvents = await getUnsyncedFinalizedEvents();

    for (const item of queue) {
      if (item.retries >= MAX_RETRIES) {
        result.errors.push(`${item.type} ${item.id} exceeded max retries`);
        result.failedCount++;
        await removeSyncItem(item.id);
        continue;
      }

      let syncResult: { success: boolean; error?: string };

      switch (item.type) {
        case "ATTENDANCE_RECORD":
          syncResult = await syncAttendanceRecord(item.payload);
          if (syncResult.success) {
            await markRecordSynced((item.payload as any).id);
            await removeSyncItem(item.id);
            result.syncedCount++;
          } else {
            await incrementSyncRetry(item.id);
            result.failedCount++;
            result.errors.push(`Attendance record ${item.id}: ${syncResult.error}`);
          }
          break;

        case "FINALIZED_EVENT":
          syncResult = await syncFinalizedEvent(item.payload);
          if (syncResult.success) {
            await markFinalizedEventSynced((item.payload as any).id);
            await removeSyncItem(item.id);
            result.syncedCount++;
          } else {
            await incrementSyncRetry(item.id);
            result.failedCount++;
            result.errors.push(`Finalized event ${item.id}: ${syncResult.error}`);
          }
          break;

        case "BULK_ATTENDANCE":
          syncResult = await syncBulkAttendance(item.payload);
          if (syncResult.success) {
            await removeSyncItem(item.id);
            result.syncedCount++;
          } else {
            await incrementSyncRetry(item.id);
            result.failedCount++;
            result.errors.push(`Bulk attendance ${item.id}: ${syncResult.error}`);
          }
          break;

        default:
          await removeSyncItem(item.id);
      }
    }

    for (const record of unsyncedRecords) {
      if (!queue.some((q) => q.type === "ATTENDANCE_RECORD" && (q.payload as any).id === record.id)) {
        const syncResult = await syncAttendanceRecord(record);
        if (syncResult.success) {
          await markRecordSynced(record.id);
          result.syncedCount++;
        } else {
          result.failedCount++;
          result.errors.push(`Orphan record ${record.id}: ${syncResult.error}`);
        }
      }
    }

    for (const event of unsyncedEvents) {
      if (!queue.some((q) => q.type === "FINALIZED_EVENT" && (q.payload as any).id === event.id)) {
        const syncResult = await syncFinalizedEvent(event);
        if (syncResult.success) {
          await markFinalizedEventSynced(event.id);
          result.syncedCount++;
        } else {
          result.failedCount++;
          result.errors.push(`Orphan event ${event.id}: ${syncResult.error}`);
        }
      }
    }

    await setLastSyncAt(new Date().toISOString());
    result.success = result.failedCount === 0;
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : "Unknown sync error");
  } finally {
    syncInProgress = false;
  }

  return result;
}

export function startSyncScheduler(intervalMs = 60000): void {
  if (syncInterval) return;

  syncInterval = setInterval(async () => {
    if (!navigator.onLine) return;
    await processSyncQueue();
  }, intervalMs);

  if (navigator.onLine) {
    processSyncQueue();
  }

  window.addEventListener("online", () => {
    processSyncQueue();
  });
}

export function stopSyncScheduler(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

export async function forceSyncNow(): Promise<SyncResult> {
  if (!navigator.onLine) {
    return { success: false, syncedCount: 0, failedCount: 0, errors: ["Offline"] };
  }
  return processSyncQueue();
}

export async function autoFinalizeTodaysEvents(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const response = await fetch(`/api/biometric/records/today?date=${today}`);
    const data = await response.json();
    if (!data.success) return;

    const { windows, students, teachers } = data.data;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    for (const window of windows) {
      const endMinutes = parseTime(window.endTime);
      const lateEndMinutes = window.lateEndTime ? parseTime(window.lateEndTime) : endMinutes;

      if (currentMinutes > lateEndMinutes + 5) {
        const eventRecords = [...students, ...teachers].filter((r: any) => r.eventId === window.id);
        if (eventRecords.length > 0) {
          await finalizeEventLocally(window.id, window.name, today, eventRecords, {
            startTime: window.startTime,
            endTime: window.endTime,
            lateEndTime: window.lateEndTime,
          });
        }
      }
    }
  } catch (error) {
    console.error("[offline-sync] Auto-finalize failed:", error);
  }
}

export async function runCatchUpFinalization(): Promise<void> {
  const lastSync = await getOfflineStats();
  const today = new Date().toISOString().slice(0, 10);

  for (let i = 1; i <= 7; i++) {
    const checkDate = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (checkDate === today) continue;

    try {
      const response = await fetch(`/api/biometric/records/today?date=${checkDate}`);
      const data = await response.json();
      if (!data.success) continue;

      const { windows, students, teachers } = data.data;

      for (const window of windows) {
        const eventRecords = [...students, ...teachers].filter((r: any) => r.eventId === window.id);
        if (eventRecords.length > 0) {
          const existing = await getFinalizedEventsByDate(checkDate);
          const alreadyFinalized = existing.some((e) => e.eventId === window.id);
          if (!alreadyFinalized) {
            await finalizeEventLocally(window.id, window.name, checkDate, eventRecords, {
              startTime: window.startTime,
              endTime: window.endTime,
              lateEndTime: window.lateEndTime,
            });
          }
        }
      }
    } catch (error) {
      console.error(`[offline-sync] Catch-up for ${checkDate} failed:`, error);
    }
  }
}

function parseTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function isSyncInProgress(): boolean {
  return syncInProgress;
}

export async function initializeOfflineSync(): Promise<void> {
  await clearSyncedData(30);
  await runCatchUpFinalization();
  startSyncScheduler(60000);

  setInterval(async () => {
    if (navigator.onLine) {
      await autoFinalizeTodaysEvents();
    }
  }, 5 * 60 * 1000);
}

import { getFinalizedEventsByDate, finalizeEventLocally } from "./offline-attendance";