const DB_NAME = "darse-burhani-offline";
const STORE_ATTENDANCE = "attendance-records";
const STORE_FINALIZED = "finalized-events";
const STORE_SYNC_QUEUE = "sync-queue";
const STORE_META = "meta";
const DB_VERSION = 2;

interface OfflineAttendanceRecord {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "MEDICAL" | "ON_LEAVE";
  source: "BIOMETRIC" | "MANUAL" | "AUTO_ABSENT" | "MEDICAL_LEAVE" | "LEAVE_APPROVED";
  checkInTime?: string;
  checkOutTime?: string;
  verificationMethod?: string;
  biometricMethod?: string;
  biometricHash?: string;
  recordedById?: string;
  justification?: string;
  justificationStatus?: "NONE" | "PENDING" | "APPROVED" | "REJECTED";
  eventId?: string;
  eventName?: string;
  createdAt: string;
  synced: boolean;
  localOnly: boolean;
}

interface FinalizedEvent {
  id: string;
  eventId: string;
  eventName: string;
  date: string;
  startTime: string;
  endTime: string;
  lateEndTime?: string;
  totalStudents: number;
  presentCount: number;
  lateCount: number;
  absentCount: number;
  records: OfflineAttendanceRecord[];
  finalizedAt: string;
  synced: boolean;
}

interface SyncQueueItem {
  id: string;
  type: "ATTENDANCE_RECORD" | "FINALIZED_EVENT" | "JUSTIFICATION" | "BULK_ATTENDANCE";
  payload: unknown;
  createdAt: string;
  retries: number;
  lastAttempt?: string;
}

interface OfflineMeta {
  lastSyncAt?: string;
  lastFinalizedEventId?: string;
  deviceId: string;
  appVersion: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_ATTENDANCE)) {
          const store = db.createObjectStore(STORE_ATTENDANCE, { keyPath: "id" });
          store.createIndex("by_student_date", ["studentId", "date"], { unique: false });
          store.createIndex("by_class_date", ["classId", "date"], { unique: false });
          store.createIndex("by_synced", "synced", { unique: false });
          store.createIndex("by_event", "eventId", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_FINALIZED)) {
          const store = db.createObjectStore(STORE_FINALIZED, { keyPath: "id" });
          store.createIndex("by_date", "date", { unique: false });
          store.createIndex("by_event", "eventId", { unique: false });
          store.createIndex("by_synced", "synced", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_SYNC_QUEUE)) {
          const store = db.createObjectStore(STORE_SYNC_QUEUE, { keyPath: "id" });
          store.createIndex("by_type", "type", { unique: false });
          store.createIndex("by_created", "createdAt", { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META, { keyPath: "key" });
        }
      }

      if (oldVersion < 2) {
        const tx = (event.target as IDBOpenDBRequest)?.transaction;
        if (tx) {
          const attendanceStore = tx.objectStore(STORE_ATTENDANCE);
          if (!attendanceStore.indexNames.contains("by_localOnly")) {
            attendanceStore.createIndex("by_localOnly", "localOnly", { unique: false });
          }
        }
      }
    };
  });

  return dbPromise;
}

export async function saveAttendanceRecord(record: OfflineAttendanceRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATTENDANCE, "readwrite");
    tx.objectStore(STORE_ATTENDANCE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAttendanceRecord(id: string): Promise<OfflineAttendanceRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATTENDANCE, "readonly");
    const request = tx.objectStore(STORE_ATTENDANCE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAttendanceRecordsByStudentDate(
  studentId: string,
  date: string
): Promise<OfflineAttendanceRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATTENDANCE, "readonly");
    const index = tx.objectStore(STORE_ATTENDANCE).index("by_student_date");
    const request = index.getAll([studentId, date]);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getAttendanceRecordsByClassDate(
  classId: string,
  date: string
): Promise<OfflineAttendanceRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATTENDANCE, "readonly");
    const index = tx.objectStore(STORE_ATTENDANCE).index("by_class_date");
    const request = index.getAll([classId, date]);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getUnsyncedAttendanceRecords(): Promise<OfflineAttendanceRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATTENDANCE, "readonly");
    const index = tx.objectStore(STORE_ATTENDANCE).index("by_synced");
    const request = index.getAll(false as any);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getLocalOnlyRecords(): Promise<OfflineAttendanceRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATTENDANCE, "readonly");
    const index = tx.objectStore(STORE_ATTENDANCE).index("by_localOnly");
    const request = index.getAll(true as any);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function markRecordSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ATTENDANCE, "readwrite");
    const store = tx.objectStore(STORE_ATTENDANCE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const record = getReq.result;
      if (record) {
        record.synced = true;
        record.syncedAt = new Date().toISOString();
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveFinalizedEvent(event: FinalizedEvent): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FINALIZED, "readwrite");
    tx.objectStore(STORE_FINALIZED).put(event);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getFinalizedEvent(id: string): Promise<FinalizedEvent | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FINALIZED, "readonly");
    const request = tx.objectStore(STORE_FINALIZED).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getFinalizedEventsByDate(date: string): Promise<FinalizedEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FINALIZED, "readonly");
    const index = tx.objectStore(STORE_FINALIZED).index("by_date");
    const request = index.getAll(date);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getUnsyncedFinalizedEvents(): Promise<FinalizedEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FINALIZED, "readonly");
    const index = tx.objectStore(STORE_FINALIZED).index("by_synced");
    const request = index.getAll(false as any);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function markFinalizedEventSynced(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_FINALIZED, "readwrite");
    const store = tx.objectStore(STORE_FINALIZED);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const event = getReq.result;
      if (event) {
        event.synced = true;
        store.put(event);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function enqueueSyncItem(item: Omit<SyncQueueItem, "id" | "createdAt" | "retries">): Promise<string> {
  const db = await openDB();
  const id = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const fullItem: SyncQueueItem = {
    ...item,
    id,
    createdAt: new Date().toISOString(),
    retries: 0,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_QUEUE, "readwrite");
    tx.objectStore(STORE_SYNC_QUEUE).put(fullItem);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_QUEUE, "readonly");
    const index = tx.objectStore(STORE_SYNC_QUEUE).index("by_created");
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function removeSyncItem(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_QUEUE, "readwrite");
    tx.objectStore(STORE_SYNC_QUEUE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function incrementSyncRetry(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SYNC_QUEUE, "readwrite");
    const store = tx.objectStore(STORE_SYNC_QUEUE);
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result;
      if (item) {
        item.retries += 1;
        item.lastAttempt = new Date().toISOString();
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

export async function getMeta(key: string): Promise<OfflineMeta | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, "readonly");
    const request = tx.objectStore(STORE_META).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function setMeta(key: string, value: OfflineMeta): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_META, "readwrite");
    tx.objectStore(STORE_META).put({ key, ...value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getDeviceId(): Promise<string> {
  const meta = await getMeta("device");
  if (meta?.deviceId) return meta.deviceId;

  const deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  await setMeta("device", { deviceId, appVersion: "1.0.0" });
  return deviceId;
}

export async function setLastSyncAt(timestamp: string): Promise<void> {
  await setMeta("lastSync", { lastSyncAt: timestamp, deviceId: "", appVersion: "" });
}

export async function getLastSyncAt(): Promise<string | null> {
  const meta = await getMeta("lastSync");
  return meta?.lastSyncAt || null;
}

export async function finalizeEventLocally(
  eventId: string,
  eventName: string,
  date: string,
  records: OfflineAttendanceRecord[],
  window: { startTime: string; endTime: string; lateEndTime?: string }
): Promise<FinalizedEvent> {
  const presentCount = records.filter((r) => r.status === "PRESENT").length;
  const lateCount = records.filter((r) => r.status === "LATE").length;
  const absentCount = records.filter((r) => r.status === "ABSENT").length;

  const finalized: FinalizedEvent = {
    id: `finalized_${eventId}_${date}`,
    eventId,
    eventName,
    date,
    startTime: window.startTime,
    endTime: window.endTime,
    lateEndTime: window.lateEndTime,
    totalStudents: records.length,
    presentCount,
    lateCount,
    absentCount,
    records,
    finalizedAt: new Date().toISOString(),
    synced: false,
  };

  await saveFinalizedEvent(finalized);

  for (const record of records) {
    if (!record.synced) {
      await enqueueSyncItem({
        type: "ATTENDANCE_RECORD",
        payload: record,
      });
    }
  }

  await enqueueSyncItem({
    type: "FINALIZED_EVENT",
    payload: finalized,
  });

  return finalized;
}

export async function getPendingFinalizedEventsForDate(date: string): Promise<FinalizedEvent[]> {
  const events = await getFinalizedEventsByDate(date);
  return events.filter((e) => !e.synced);
}

export async function clearSyncedData(olderThanDays = 30): Promise<void> {
  const db = await openDB();
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString();

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_ATTENDANCE, STORE_FINALIZED, STORE_SYNC_QUEUE], "readwrite");

    const attendanceStore = tx.objectStore(STORE_ATTENDANCE);
    const attendanceIndex = attendanceStore.index("by_synced");
    const attendanceRequest = attendanceIndex.openCursor(IDBKeyRange.only(true));
    attendanceRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const record = cursor.value as OfflineAttendanceRecord;
        if (record.createdAt < cutoff) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    const finalizedStore = tx.objectStore(STORE_FINALIZED);
    const finalizedIndex = finalizedStore.index("by_synced");
    const finalizedRequest = finalizedIndex.openCursor(IDBKeyRange.only(true));
    finalizedRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const eventData = cursor.value as FinalizedEvent;
        if (eventData.finalizedAt < cutoff) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOfflineStats(): Promise<{
  totalRecords: number;
  unsyncedRecords: number;
  finalizedEvents: number;
  unsyncedEvents: number;
  queueSize: number;
}> {
  const [allRecords, unsyncedRecords, allEvents, unsyncedEvents, queue] = await Promise.all([
    (async () => {
      const db = await openDB();
      return new Promise<number>((resolve, reject) => {
        const tx = db.transaction(STORE_ATTENDANCE, "readonly");
        const request = tx.objectStore(STORE_ATTENDANCE).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    })(),
    getUnsyncedAttendanceRecords().then((r) => r.length),
    (async () => {
      const db = await openDB();
      return new Promise<number>((resolve, reject) => {
        const tx = db.transaction(STORE_FINALIZED, "readonly");
        const request = tx.objectStore(STORE_FINALIZED).count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    })(),
    getUnsyncedFinalizedEvents().then((r) => r.length),
    getSyncQueue().then((r) => r.length),
  ]);

  return {
    totalRecords: allRecords,
    unsyncedRecords,
    finalizedEvents: allEvents,
    unsyncedEvents,
    queueSize: queue,
  };
}