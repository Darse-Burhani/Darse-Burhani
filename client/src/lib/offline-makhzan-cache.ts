/**
 * Offline Makhzan Cache & Transaction Queue Manager
 * Provides client-side local caching (IndexedDB/LocalStorage) for offline warehouse/depot operations.
 */

export interface CachedMakhzanItem {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  category: string;
  barcode: string | null;
  rackNumber: string | null;
  shelfNumber: string | null;
  locationColor: string | null;
  coverImage: string | null;
  status: "AVAILABLE" | "BORROWED" | "RESTOCK_QUEUE" | "DAMAGED" | "LOST";
  totalCopies: number;
  availableCopies: number;
  notes: string | null;
  currentBorrower?: string | null;
  currentLoanId?: string | null;
  loanDate?: string | null;
  dueDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CachedMember {
  id: string;
  name: string;
  itsNumber: string;
  role: "STUDENT" | "TEACHER" | "FACULTY";
  roleLabel: string;
  subtitle: string;
  activeLoansCount: number;
  grade?: string;
  className?: string;
  department?: string;
  phone?: string;
}

export interface MakhzanKitItem {
  itemId: string;
  title: string;
  barcode?: string;
  quantity: number;
}

export interface MakhzanKit {
  id: string;
  name: string;
  barcode: string; // e.g., "KIT-HIFZ-01", "KIT-STD-05"
  category: string;
  targetRole: "STUDENT" | "TEACHER" | "ALL";
  gradeLevel?: string;
  description: string;
  items: MakhzanKitItem[];
  totalItemsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface QueuedTransaction {
  id: string;
  type: "CHECKOUT" | "RETURN" | "KIT_ISSUE" | "STOCK_ADJUST";
  payload: {
    bookId?: string;
    bookBarcode?: string;
    studentId?: string;
    studentName?: string;
    itsNumber?: string;
    kitId?: string;
    kitBarcode?: string;
    kitName?: string;
    borrowDays?: number;
    notes?: string;
    delta?: number;
  };
  queuedAt: string;
  status: "PENDING" | "SYNCING" | "FAILED" | "COMPLETED";
  error?: string;
}

const STORAGE_KEYS = {
  ITEMS: "makhzan_offline_items_v1",
  MEMBERS: "makhzan_offline_members_v1",
  KITS: "makhzan_offline_kits_v1",
  QUEUE: "makhzan_offline_queue_v1",
  LAST_SYNC: "makhzan_last_sync_timestamp",
};

// Default kits if none saved
const DEFAULT_KITS: MakhzanKit[] = [
  {
    id: "kit-hifz-starter",
    name: "Hifz Al-Quran Starter Kit",
    barcode: "KIT-HIFZ-01",
    category: "Hifz",
    targetRole: "STUDENT",
    gradeLevel: "All Hifz Levels",
    description: "Essential kit for new Hifz students including Tajweed Quran, Sabaq diary, and pouch",
    items: [
      { itemId: "item-quran-tajweed", title: "Mushaf Al-Tajweed (15 Lines)", barcode: "06-MUSHAF-01", quantity: 1 },
      { itemId: "item-hifz-diary", title: "Daily Hifz & Muraja'ah Progress Diary", barcode: "06-DIARY-01", quantity: 1 },
      { itemId: "item-pencil-pouch", title: "Darse Burhani Velvet Sabaq Pouch", barcode: "14-POUCH-01", quantity: 1 },
    ],
    totalItemsCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "kit-std-primary",
    name: "Primary Curriculum Academic Kit",
    barcode: "KIT-PRIM-01",
    category: "Curriculum",
    targetRole: "STUDENT",
    gradeLevel: "Darajah 1-4",
    description: "Complete academic starter bundle for primary grade students",
    items: [
      { itemId: "item-lisan-dawat", title: "Lisan ud-Dawat Grammar Book 1", barcode: "08-LISAN-01", quantity: 1 },
      { itemId: "item-tarbiyat-01", title: "Islamic Tarbiyat & Adab Guide", barcode: "06-TARBIYAT-01", quantity: 1 },
      { itemId: "item-notebook-set", title: "Darse Burhani Ruled Notebook (4-Pack)", barcode: "15-NOTE-04", quantity: 1 },
    ],
    totalItemsCount: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "kit-teacher-faculty",
    name: "Faculty Khidmat Teaching Kit",
    barcode: "KIT-FAC-01",
    category: "Faculty",
    targetRole: "TEACHER",
    gradeLevel: "Faculty & Asateezah",
    description: "Teacher classroom management handbook, register, and academic planner",
    items: [
      { itemId: "item-takhteet-planner", title: "Annual Takhteet Lesson Planner", barcode: "11-PLAN-01", quantity: 1 },
      { itemId: "item-attendance-register", title: "Classroom Attendance & Mark Registry", barcode: "11-REG-01", quantity: 1 },
    ],
    totalItemsCount: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export class OfflineMakhzanCache {
  // ── Items Caching ──
  static saveItems(items: CachedMakhzanItem[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.ITEMS, JSON.stringify(items));
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
    } catch (e) {
      console.warn("Makhzan Cache: Unable to save items to localStorage", e);
    }
  }

  static getItems(): CachedMakhzanItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ITEMS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // ── Members Caching ──
  static saveMembers(members: CachedMember[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
    } catch (e) {
      console.warn("Makhzan Cache: Unable to save members to localStorage", e);
    }
  }

  static getMembers(): CachedMember[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // ── Kits Management ──
  static saveKits(kits: MakhzanKit[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.KITS, JSON.stringify(kits));
    } catch (e) {
      console.warn("Makhzan Cache: Unable to save kits", e);
    }
  }

  static getKits(): MakhzanKit[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.KITS);
      if (data) return JSON.parse(data);
      // Initialize with default kits
      this.saveKits(DEFAULT_KITS);
      return DEFAULT_KITS;
    } catch {
      return DEFAULT_KITS;
    }
  }

  static addKit(kit: Omit<MakhzanKit, "id" | "createdAt" | "updatedAt">): MakhzanKit {
    const kits = this.getKits();
    const newKit: MakhzanKit = {
      ...kit,
      id: `kit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    kits.unshift(newKit);
    this.saveKits(kits);
    return newKit;
  }

  static deleteKit(id: string) {
    const kits = this.getKits().filter((k) => k.id !== id);
    this.saveKits(kits);
  }

  // ── Offline Queue Management ──
  static getQueue(): QueuedTransaction[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.QUEUE);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static saveQueue(queue: QueuedTransaction[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
    } catch (e) {
      console.warn("Makhzan Cache: Unable to save queue", e);
    }
  }

  static enqueue(transaction: Omit<QueuedTransaction, "id" | "queuedAt" | "status">): QueuedTransaction {
    const queue = this.getQueue();
    const newTx: QueuedTransaction = {
      ...transaction,
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      queuedAt: new Date().toISOString(),
      status: "PENDING",
    };
    queue.push(newTx);
    this.saveQueue(queue);

    // Also update local cached state optimistically
    this.applyLocalOptimisticUpdate(newTx);

    return newTx;
  }

  static dequeue(id: string) {
    const queue = this.getQueue().filter((t) => t.id !== id);
    this.saveQueue(queue);
  }

  static clearQueue() {
    try {
      localStorage.removeItem(STORAGE_KEYS.QUEUE);
    } catch {}
  }

  static getLastSync(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    } catch {
      return null;
    }
  }

  // Apply changes locally to cached items when offline
  private static applyLocalOptimisticUpdate(tx: QueuedTransaction) {
    try {
      const items = this.getItems();
      if (tx.type === "CHECKOUT" && tx.payload.bookId) {
        const item = items.find((i) => i.id === tx.payload.bookId || i.barcode === tx.payload.bookBarcode);
        if (item) {
          item.status = "BORROWED";
          item.availableCopies = Math.max(0, item.availableCopies - 1);
          item.currentBorrower = tx.payload.studentName || tx.payload.itsNumber || "Student";
          item.loanDate = new Date().toISOString();
          this.saveItems(items);
        }
      } else if (tx.type === "RETURN" && tx.payload.bookId) {
        const item = items.find((i) => i.id === tx.payload.bookId || i.barcode === tx.payload.bookBarcode);
        if (item) {
          item.status = "AVAILABLE";
          item.availableCopies = Math.min(item.totalCopies, item.availableCopies + 1);
          item.currentBorrower = null;
          item.loanDate = null;
          this.saveItems(items);
        }
      } else if (tx.type === "KIT_ISSUE" && tx.payload.kitBarcode) {
        const kits = this.getKits();
        const kit = kits.find((k) => k.barcode === tx.payload.kitBarcode || k.id === tx.payload.kitId);
        if (kit) {
          kit.items.forEach((kitItem) => {
            const found = items.find((i) => i.id === kitItem.itemId || (kitItem.barcode && i.barcode === kitItem.barcode));
            if (found) {
              found.availableCopies = Math.max(0, found.availableCopies - kitItem.quantity);
              if (found.availableCopies === 0) {
                found.status = "BORROWED";
              }
            }
          });
          this.saveItems(items);
        }
      }
    } catch (e) {
      console.warn("Optimistic local update error", e);
    }
  }

  // ── Sync Queue Replay Runner ──
  static async syncQueue(
    onProgress?: (synced: number, total: number) => void
  ): Promise<{ success: number; failed: number; errors: string[] }> {
    const queue = this.getQueue();
    if (queue.length === 0) return { success: 0, failed: 0, errors: [] };

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const remainingQueue: QueuedTransaction[] = [];

    for (let i = 0; i < queue.length; i++) {
      const tx = queue[i];
      try {
        if (tx.type === "CHECKOUT") {
          const res = await fetch("/api/admin/library/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId: tx.payload.bookId,
              studentId: tx.payload.studentId,
              borrowDays: tx.payload.borrowDays || 14,
              notes: tx.payload.notes ? `[Offline Synced] ${tx.payload.notes}` : "[Offline Synced]",
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Failed to sync checkout");
          }
          successCount++;
        } else if (tx.type === "RETURN") {
          const res = await fetch("/api/admin/library/return", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookId: tx.payload.bookId,
              notes: "[Offline Synced Return]",
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || "Failed to sync return");
          }
          successCount++;
        } else if (tx.type === "KIT_ISSUE") {
          // For Kit issuances, find kit and issue each constituent book if found
          const kits = this.getKits();
          const kit = kits.find((k) => k.barcode === tx.payload.kitBarcode || k.id === tx.payload.kitId);
          if (kit) {
            for (const kitItem of kit.items) {
              await fetch("/api/admin/library/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  bookId: kitItem.itemId,
                  studentId: tx.payload.studentId,
                  borrowDays: 90,
                  notes: `[Kit Bundle: ${kit.name}] [Offline Synced]`,
                }),
              }).catch(() => {});
            }
          }
          successCount++;
        }

        if (onProgress) {
          onProgress(successCount, queue.length);
        }
      } catch (err: any) {
        failedCount++;
        errors.push(err.message || "Sync failed for transaction");
        remainingQueue.push({
          ...tx,
          status: "FAILED",
          error: err.message,
        });
      }
    }

    this.saveQueue(remainingQueue);
    return { success: successCount, failed: failedCount, errors };
  }
}
