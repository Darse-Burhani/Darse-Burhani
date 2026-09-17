"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Barcode,
  Search,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  BookMarked,
  BookX,
  Layers,
  Upload,
  Printer,
  Sparkles,
  ArrowRight,
  User,
  GraduationCap,
  Users,
  ShieldCheck,
  RefreshCw,
  X,
  Filter,
  SlidersHorizontal,
  FileSpreadsheet,
  Check,
  Copy,
  Info,
  Tv,
  Clock,
  Calendar,
  ChevronRight,
  ExternalLink,
  Library,
  Tag,
  Hash,
  MapPin,
  Building,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  Database,
  Package,
  PackagePlus,
  PackageCheck,
  QrCode,
  HardDrive,
  Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { generateCode128Svg } from "@/lib/barcode-generator";
import {
  OfflineMakhzanCache,
  CachedMakhzanItem,
  CachedMember,
  MakhzanKit,
  MakhzanKitItem,
  QueuedTransaction,
} from "@/lib/offline-makhzan-cache";
import Link from "next/link";

// ── Types ──
export type MakhzanBook = CachedMakhzanItem;
export type MemberRecord = CachedMember;

interface CategoryCount {
  name: string;
  count: number;
}

const CATEGORY_MAP: Record<string, string> = {
  General: "01",
  Fiction: "02",
  "Non-Fiction": "03",
  Science: "04",
  History: "05",
  Religion: "06",
  Mathematics: "07",
  Language: "08",
  Arts: "09",
  Biography: "10",
  Reference: "11",
  Children: "12",
  "Self-Help": "13",
  Technology: "14",
  GK: "15",
  Commerce: "16",
  Geography: "17",
  Hifz: "18",
  Curriculum: "19",
  Stationery: "20",
  Faculty: "21",
};

// Sound synthesizer for crisp hardware feedback
function playChirpSound(success = true) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (success) {
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.1); // E6
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } else {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    // AudioContext blocked or not supported
  }
}

export default function MakhzanDirectPage() {
  // ── Navigation & Tabs ──
  const [activeTab, setActiveTab] = useState<"scan" | "books" | "kits" | "add" | "bulk">("scan");
  const [books, setBooks] = useState<MakhzanBook[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBooks: 0,
    availableBooks: 0,
    borrowedBooks: 0,
    overdueBooks: 0,
    activeBorrowers: 0,
  });

  // ── Offline Terminal State ──
  const [isOnline, setIsOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // ── Academic Kits State ──
  const [kits, setKits] = useState<MakhzanKit[]>([]);
  const [scannedKit, setScannedKit] = useState<MakhzanKit | null>(null);
  const [showCreateKitModal, setShowCreateKitModal] = useState(false);
  const [newKitName, setNewKitName] = useState("");
  const [newKitBarcode, setNewKitBarcode] = useState("");
  const [newKitCategory, setNewKitCategory] = useState("Hifz");
  const [newKitRole, setNewKitRole] = useState<"STUDENT" | "TEACHER" | "ALL">("STUDENT");
  const [newKitGrade, setNewKitGrade] = useState("");
  const [newKitDescription, setNewKitDescription] = useState("");
  const [selectedKitItemIds, setSelectedKitItemIds] = useState<{ id: string; qty: number }[]>([]);

  // ── Barcode Scanner Engine State ──
  const [scanInput, setScanInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scannedBook, setScannedBook] = useState<MakhzanBook | null>(null);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // ── Member Assignment (Talabat & Faculty) State ──
  const [memberQuery, setMemberQuery] = useState("");
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [searchingMembers, setSearchingMembers] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberRecord | null>(null);
  const [loanDays, setLoanDays] = useState<number>(14);
  const [issuingLoan, setIssuingLoan] = useState(false);
  const [returningLoan, setReturningLoan] = useState(false);

  // ── Add Book Engine State ──
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newPublisher, setNewPublisher] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [customBarcode, setCustomBarcode] = useState("");
  const [newRack, setNewRack] = useState("");
  const [newShelf, setNewShelf] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [isSubmittingBook, setIsSubmittingBook] = useState(false);

  // ── Bulk Import Engine State ──
  const [bulkText, setBulkText] = useState("");
  const [bulkParsed, setBulkParsed] = useState<any[]>([]);
  const [isImportingBulk, setIsImportingBulk] = useState(false);

  // ── Table Search & Filters ──
  const [searchFilter, setSearchFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [barcodeModalBook, setBarcodeModalBook] = useState<MakhzanBook | null>(null);
  const [barcodeModalKit, setBarcodeModalKit] = useState<MakhzanKit | null>(null);

  // ── Online / Offline Listener & Queue Tracker ──
  useEffect(() => {
    const updateOnlineStatus = () => {
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      setIsOnline(online);
      setQueuedCount(OfflineMakhzanCache.getQueue().length);
    };

    updateOnlineStatus();
    setKits(OfflineMakhzanCache.getKits());
    setLastSyncTime(OfflineMakhzanCache.getLastSync());

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);

    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  // ── Load Inventory Data (With Offline Fallback) ──
  const fetchLibraryData = useCallback(async () => {
    try {
      setLoading(true);

      if (!navigator.onLine) {
        // Fallback to offline cache
        const cached = OfflineMakhzanCache.getItems();
        if (cached.length > 0) {
          setBooks(cached);
          setStats({
            totalBooks: cached.length,
            availableBooks: cached.filter((b) => b.status === "AVAILABLE").length,
            borrowedBooks: cached.filter((b) => b.status === "BORROWED").length,
            overdueBooks: 0,
            activeBorrowers: new Set(cached.map((b) => b.currentBorrower).filter(Boolean)).size,
          });
          toast({
            title: "Offline Storage Loaded",
            description: `Loaded ${cached.length} catalog items from local terminal cache.`,
          });
        }
        setLoading(false);
        return;
      }

      const [resBooks, resOverview] = await Promise.all([
        fetch("/api/admin/library?pageSize=300"),
        fetch("/api/admin/library/overview"),
      ]);

      if (resBooks.ok) {
        const data = await resBooks.json();
        if (data.success) {
          const items: MakhzanBook[] = data.data || [];
          setBooks(items);
          setCategories(data.categories || []);
          // Cache to local terminal storage
          OfflineMakhzanCache.saveItems(items);
          setLastSyncTime(new Date().toISOString());
        }
      }

      if (resOverview.ok) {
        const ovData = await resOverview.json();
        if (ovData.success && ovData.data) {
          setStats({
            totalBooks: ovData.data.totalTitles || 0,
            availableBooks: ovData.data.availableCopies || 0,
            borrowedBooks: ovData.data.borrowedCopies || 0,
            overdueBooks: ovData.data.overdueLoans || 0,
            activeBorrowers: ovData.data.activeBorrowers || 0,
          });
        }
      }
    } catch (err) {
      console.warn("Failed to fetch library data live, attempting cache:", err);
      const cached = OfflineMakhzanCache.getItems();
      if (cached.length > 0) {
        setBooks(cached);
        toast({ title: "Offline Fallback", description: "Loaded catalog from offline storage." });
      }
    } finally {
      setLoading(false);
      setQueuedCount(OfflineMakhzanCache.getQueue().length);
    }
  }, []);

  useEffect(() => {
    fetchLibraryData();
  }, [fetchLibraryData]);

  // ── Cache Snapshot to Local Terminal ──
  const handleCacheSnapshot = async () => {
    try {
      setLoading(true);
      const [resBooks, resMembers] = await Promise.all([
        fetch("/api/admin/library?pageSize=500"),
        fetch("/api/admin/library/students?q="),
      ]);

      let itemsCount = 0;
      let membersCount = 0;

      if (resBooks.ok) {
        const data = await resBooks.json();
        if (data.success && data.data) {
          OfflineMakhzanCache.saveItems(data.data);
          setBooks(data.data);
          itemsCount = data.data.length;
        }
      }

      if (resMembers.ok) {
        const memData = await resMembers.json();
        if (memData.success && memData.data) {
          OfflineMakhzanCache.saveMembers(memData.data);
          membersCount = memData.data.length;
        }
      }

      const syncTimestamp = new Date().toISOString();
      setLastSyncTime(syncTimestamp);

      if (soundEnabled) playChirpSound(true);
      toast({
        title: "Terminal Cache Ready",
        description: `Successfully stored ${itemsCount} items & ${membersCount} members for offline basement scanning.`,
      });
    } catch (e) {
      toast({
        title: "Cache Error",
        description: "Failed to download complete catalog snapshot.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Replay / Sync Offline Queue ──
  const handleSyncQueue = async () => {
    if (!navigator.onLine) {
      toast({
        title: "Cannot Sync Offline",
        description: "Please reconnect to the network before syncing queued scans.",
        variant: "destructive",
      });
      return;
    }

    setIsSyncingQueue(true);
    try {
      const result = await OfflineMakhzanCache.syncQueue();
      setQueuedCount(OfflineMakhzanCache.getQueue().length);

      if (result.success > 0) {
        if (soundEnabled) playChirpSound(true);
        toast({
          title: "Offline Scans Synced",
          description: `Successfully synchronized ${result.success} transactions with the server.`,
        });
        fetchLibraryData();
      } else if (result.failed > 0) {
        toast({
          title: "Sync Partial Warning",
          description: `${result.failed} transactions failed to synchronize.`,
          variant: "destructive",
        });
      } else {
        toast({ title: "Queue Empty", description: "No pending offline transactions to sync." });
      }
    } catch {
      toast({ title: "Sync Failed", description: "An error occurred during queue sync.", variant: "destructive" });
    } finally {
      setIsSyncingQueue(false);
    }
  };

  // ── Hardware Barcode Scanner Listener ──
  useEffect(() => {
    let barcodeBuffer = "";
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA") &&
        target !== scanInputRef.current
      ) {
        return;
      }

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (e.key === "Enter") {
        if (barcodeBuffer.length >= 3 && timeDiff < 100) {
          e.preventDefault();
          handleProcessBarcode(barcodeBuffer);
          barcodeBuffer = "";
        }
      } else if (e.key.length === 1) {
        if (timeDiff > 250) {
          barcodeBuffer = e.key;
        } else {
          barcodeBuffer += e.key;
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [books, kits]);

  // ── Process Scanned Barcode (Book or Academic Kit) ──
  const handleProcessBarcode = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;

    setIsScanning(true);
    setScanMessage(null);
    setScanInput(code);
    setScannedKit(null);

    try {
      // 1. Check if scanned barcode is an Academic Kit Bundle
      const matchedKit = kits.find(
        (k) => k.barcode.toLowerCase() === code.toLowerCase() || k.id === code
      );

      if (matchedKit) {
        if (soundEnabled) playChirpSound(true);
        setScannedKit(matchedKit);
        setScannedBook(null);
        setSelectedMember(null);
        setMemberQuery("");
        setMembers([]);
        setActiveTab("scan");
        toast({
          title: "Kit Bundle Identified",
          description: `Found Kit: ${matchedKit.name} (${matchedKit.items.length} items bundled)`,
        });
        return;
      }

      // 2. Search in local books state / cached items
      let found = books.find(
        (b) => b.barcode?.toLowerCase() === code.toLowerCase() || b.id === code
      );

      if (!found) {
        const cachedItems = OfflineMakhzanCache.getItems();
        found = cachedItems.find(
          (b) => b.barcode?.toLowerCase() === code.toLowerCase() || b.id === code
        );
      }

      // 3. Search API if online
      if (!found && navigator.onLine) {
        const res = await fetch(`/api/admin/library?search=${encodeURIComponent(code)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data && data.data.length > 0) {
            found =
              data.data.find(
                (b: MakhzanBook) => b.barcode?.toLowerCase() === code.toLowerCase()
              ) || data.data[0];
          }
        }
      }

      if (found) {
        if (soundEnabled) playChirpSound(true);
        setScannedBook(found);
        setScannedKit(null);
        setSelectedMember(null);
        setMemberQuery("");
        setMembers([]);
        setActiveTab("scan");
        toast({
          title: "Item Identified",
          description: `Found: ${found.title} (${found.category})`,
        });
      } else {
        if (soundEnabled) playChirpSound(false);
        setScannedBook(null);
        setScannedKit(null);
        setScanMessage(`No item or kit found matching barcode "${code}".`);
        toast({
          title: "Unrecognized Barcode",
          description: `Barcode ${code} is not registered in Makhzan.`,
          variant: "destructive",
        });
      }
    } catch (err) {
      if (soundEnabled) playChirpSound(false);
      toast({ title: "Scan Error", description: "Failed to query barcode.", variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  // ── Search Talabat & Faculty Members ──
  useEffect(() => {
    if (!memberQuery.trim() || memberQuery.trim().length < 2) {
      setMembers([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearchingMembers(true);
      try {
        if (!navigator.onLine) {
          // Offline member lookup from cache
          const cached = OfflineMakhzanCache.getMembers();
          const q = memberQuery.toLowerCase().trim();
          const filtered = cached.filter(
            (m) =>
              m.name.toLowerCase().includes(q) ||
              m.itsNumber.includes(q) ||
              (m.className && m.className.toLowerCase().includes(q))
          );
          setMembers(filtered);
          return;
        }

        const res = await fetch(`/api/admin/library/students?q=${encodeURIComponent(memberQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setMembers(data.data);
          }
        }
      } catch (err) {
        console.error("Member search error:", err);
      } finally {
        setSearchingMembers(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [memberQuery]);

  // ── Issue Single Item to Member ──
  const handleIssueBook = async () => {
    if (!scannedBook || !selectedMember) {
      toast({
        title: "Selection Missing",
        description: "Please select a member to issue this item to.",
        variant: "destructive",
      });
      return;
    }

    setIssuingLoan(true);

    // If Offline: Queue transaction locally
    if (!navigator.onLine) {
      OfflineMakhzanCache.enqueue({
        type: "CHECKOUT",
        payload: {
          bookId: scannedBook.id,
          bookBarcode: scannedBook.barcode || undefined,
          studentId: selectedMember.id,
          studentName: selectedMember.name,
          itsNumber: selectedMember.itsNumber,
          borrowDays: loanDays || 14,
        },
      });

      setQueuedCount(OfflineMakhzanCache.getQueue().length);
      if (soundEnabled) playChirpSound(true);

      const updatedBook: MakhzanBook = {
        ...scannedBook,
        status: "BORROWED",
        availableCopies: Math.max(0, scannedBook.availableCopies - 1),
        currentBorrower: selectedMember.name,
        loanDate: new Date().toISOString(),
      };

      setScannedBook(updatedBook);
      setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
      setSelectedMember(null);
      setMemberQuery("");

      toast({
        title: "Queued (Offline Mode)",
        description: `"${scannedBook.title}" assigned to ${selectedMember.name}. Will sync when online.`,
      });
      setIssuingLoan(false);
      return;
    }

    // Online issue via API
    try {
      const res = await fetch("/api/admin/library/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: scannedBook.id,
          studentId: selectedMember.id,
          loanDays: loanDays || (selectedMember.role === "TEACHER" ? 30 : 14),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (soundEnabled) playChirpSound(true);
        toast({
          title: "Item Issued Successfully",
          description: `"${scannedBook.title}" assigned to ${selectedMember.name} (${selectedMember.roleLabel}).`,
        });

        const updatedBook: MakhzanBook = {
          ...scannedBook,
          status: "BORROWED",
          availableCopies: Math.max(0, scannedBook.availableCopies - 1),
          currentBorrower: selectedMember.name,
          currentLoanId: data.data?.id,
          loanDate: new Date().toISOString(),
          dueDate: data.data?.dueAt || new Date(Date.now() + loanDays * 86400000).toISOString(),
        };

        setScannedBook(updatedBook);
        setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
        setSelectedMember(null);
        setMemberQuery("");
        fetchLibraryData();
      } else {
        if (soundEnabled) playChirpSound(false);
        toast({
          title: "Issue Failed",
          description: data.error || "Could not complete checkout.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Issue Error", description: "An error occurred during checkout.", variant: "destructive" });
    } finally {
      setIssuingLoan(false);
    }
  };

  // ── Issue Academic Kit to Member ──
  const handleIssueKit = async () => {
    if (!scannedKit || !selectedMember) {
      toast({
        title: "Member Missing",
        description: "Please search and select a student/teacher to assign this complete kit bundle.",
        variant: "destructive",
      });
      return;
    }

    setIssuingLoan(true);

    if (!navigator.onLine) {
      OfflineMakhzanCache.enqueue({
        type: "KIT_ISSUE",
        payload: {
          kitId: scannedKit.id,
          kitBarcode: scannedKit.barcode,
          kitName: scannedKit.name,
          studentId: selectedMember.id,
          studentName: selectedMember.name,
          itsNumber: selectedMember.itsNumber,
        },
      });

      setQueuedCount(OfflineMakhzanCache.getQueue().length);
      if (soundEnabled) playChirpSound(true);

      toast({
        title: "Kit Queued (Offline Mode)",
        description: `Kit "${scannedKit.name}" issued to ${selectedMember.name}. Will sync when reconnected.`,
      });
      setSelectedMember(null);
      setMemberQuery("");
      setIssuingLoan(false);
      return;
    }

    try {
      // Issue all bundled books
      for (const item of scannedKit.items) {
        await fetch("/api/admin/library/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bookId: item.itemId,
            studentId: selectedMember.id,
            loanDays: 90,
            notes: `[Kit Bundle: ${scannedKit.name}]`,
          }),
        }).catch(() => {});
      }

      if (soundEnabled) playChirpSound(true);
      toast({
        title: "Complete Kit Issued",
        description: `"${scannedKit.name}" (${scannedKit.items.length} items) assigned to ${selectedMember.name}.`,
      });

      setSelectedMember(null);
      setMemberQuery("");
      fetchLibraryData();
    } catch {
      toast({ title: "Kit Issue Error", description: "Failed to issue some kit items.", variant: "destructive" });
    } finally {
      setIssuingLoan(false);
    }
  };

  // ── Return Item ──
  const handleReturnBook = async () => {
    if (!scannedBook) return;

    setReturningLoan(true);

    if (!navigator.onLine) {
      OfflineMakhzanCache.enqueue({
        type: "RETURN",
        payload: {
          bookId: scannedBook.id,
          bookBarcode: scannedBook.barcode || undefined,
        },
      });

      setQueuedCount(OfflineMakhzanCache.getQueue().length);
      if (soundEnabled) playChirpSound(true);

      const updatedBook: MakhzanBook = {
        ...scannedBook,
        status: "AVAILABLE",
        availableCopies: scannedBook.totalCopies || 1,
        currentBorrower: null,
        loanDate: null,
      };

      setScannedBook(updatedBook);
      setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
      toast({
        title: "Return Queued (Offline)",
        description: `"${scannedBook.title}" marked returned locally.`,
      });
      setReturningLoan(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/library/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookId: scannedBook.id,
          barcode: scannedBook.barcode,
          condition: "GOOD",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (soundEnabled) playChirpSound(true);
        toast({
          title: "Item Returned",
          description: `"${scannedBook.title}" is now back on shelf.`,
        });

        const updatedBook: MakhzanBook = {
          ...scannedBook,
          status: "AVAILABLE",
          availableCopies: scannedBook.totalCopies || 1,
          currentBorrower: null,
          currentLoanId: null,
          loanDate: null,
          dueDate: null,
        };

        setScannedBook(updatedBook);
        setBooks((prev) => prev.map((b) => (b.id === updatedBook.id ? updatedBook : b)));
        fetchLibraryData();
      } else {
        toast({
          title: "Return Failed",
          description: data.error || "Could not return item.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Return Error", description: "Failed to return item.", variant: "destructive" });
    } finally {
      setReturningLoan(false);
    }
  };

  // ── Auto-generate Barcode for Add Book ──
  const computedAutoBarcode = useMemo(() => {
    const catCode = CATEGORY_MAP[newCategory] || "01";
    const titleSlug = (newTitle || "BOOK")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "-")
      .slice(0, 10);
    return `${catCode}-${titleSlug}`;
  }, [newCategory, newTitle]);

  // ── Register New Book ──
  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast({ title: "Title Required", description: "Please enter the title.", variant: "destructive" });
      return;
    }

    setIsSubmittingBook(true);
    const barcodeToUse = customBarcode.trim() || computedAutoBarcode;

    try {
      const res = await fetch("/api/admin/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          author: newAuthor.trim() || undefined,
          publisher: newPublisher.trim() || undefined,
          category: newCategory,
          barcode: barcodeToUse,
          rackNumber: newRack.trim() || undefined,
          shelfNumber: newShelf.trim() || undefined,
          notes: newNotes.trim() || undefined,
          totalCopies: 1,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (soundEnabled) playChirpSound(true);
        toast({
          title: "Item Registered",
          description: `"${newTitle}" added with barcode ${barcodeToUse}.`,
        });

        setNewTitle("");
        setNewAuthor("");
        setNewPublisher("");
        setCustomBarcode("");
        setNewRack("");
        setNewShelf("");
        setNewNotes("");
        fetchLibraryData();
        setActiveTab("books");
      } else {
        toast({
          title: "Registration Failed",
          description: data.error || "Could not register book.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Submission Error", description: "Network error creating book.", variant: "destructive" });
    } finally {
      setIsSubmittingBook(false);
    }
  };

  // ── Create Academic Kit Bundle ──
  const handleCreateKit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKitName.trim()) {
      toast({ title: "Name Required", description: "Please provide a name for the kit bundle.", variant: "destructive" });
      return;
    }

    const items: MakhzanKitItem[] = selectedKitItemIds.map((item) => {
      const book = books.find((b) => b.id === item.id);
      return {
        itemId: item.id,
        title: book?.title || "Item",
        barcode: book?.barcode || undefined,
        quantity: item.qty || 1,
      };
    });

    const generatedBarcode =
      newKitBarcode.trim() ||
      `KIT-${newKitCategory.toUpperCase().slice(0, 4)}-${Math.floor(100 + Math.random() * 900)}`;

    const newKit = OfflineMakhzanCache.addKit({
      name: newKitName.trim(),
      barcode: generatedBarcode,
      category: newKitCategory,
      targetRole: newKitRole,
      gradeLevel: newKitGrade.trim() || undefined,
      description: newKitDescription.trim() || "Academic kit bundle",
      items,
      totalItemsCount: items.length,
    });

    setKits(OfflineMakhzanCache.getKits());
    setShowCreateKitModal(false);
    setNewKitName("");
    setNewKitBarcode("");
    setNewKitGrade("");
    setNewKitDescription("");
    setSelectedKitItemIds([]);

    if (soundEnabled) playChirpSound(true);
    toast({
      title: "Kit Bundle Created",
      description: `"${newKit.name}" created with barcode ${newKit.barcode}.`,
    });
  };

  // ── Bulk Import CSV ──
  useEffect(() => {
    if (!bulkText.trim()) {
      setBulkParsed([]);
      return;
    }

    const lines = bulkText.split("\n").filter((l) => l.trim().length > 0);
    const parsed = lines.map((line, idx) => {
      const cols = line.split(/[,\t]/).map((c) => c.trim());
      const title = cols[0] || `Item #${idx + 1}`;
      const author = cols[1] || "";
      const category = cols[2] || "General";
      const barcode = cols[3] || "";
      const rack = cols[4] || "";
      const shelf = cols[5] || "";

      return {
        index: idx + 1,
        title,
        author: author || undefined,
        category,
        barcode: barcode || undefined,
        rackNumber: rack || undefined,
        shelfNumber: shelf || undefined,
        totalCopies: 1,
      };
    });

    setBulkParsed(parsed);
  }, [bulkText]);

  const handleBulkImport = async () => {
    if (bulkParsed.length === 0) return;

    setIsImportingBulk(true);
    try {
      const res = await fetch("/api/admin/library/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ books: bulkParsed }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (soundEnabled) playChirpSound(true);
        toast({
          title: "Bulk Import Complete",
          description: data.message || `Imported ${data.count} items.`,
        });
        setBulkText("");
        setBulkParsed([]);
        fetchLibraryData();
        setActiveTab("books");
      } else {
        toast({
          title: "Import Failed",
          description: data.error || "Bulk import failed.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Import Error", description: "Failed to complete bulk import.", variant: "destructive" });
    } finally {
      setIsImportingBulk(false);
    }
  };

  // ── Filtered Books List ──
  const filteredBooks = useMemo(() => {
    return books.filter((b) => {
      const matchesSearch =
        !searchFilter ||
        b.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
        (b.author && b.author.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (b.barcode && b.barcode.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (b.rackNumber && b.rackNumber.toLowerCase().includes(searchFilter.toLowerCase())) ||
        (b.currentBorrower && b.currentBorrower.toLowerCase().includes(searchFilter.toLowerCase()));

      const matchesCategory = categoryFilter === "ALL" || b.category === categoryFilter;
      const matchesStatus = statusFilter === "ALL" || b.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [books, searchFilter, categoryFilter, statusFilter]);

  // ── Print Single Barcode ──
  const handlePrintBarcode = (book: MakhzanBook) => {
    const printWindow = window.open("", "_blank", "width=600,height=400");
    if (!printWindow) return;

    const svg = generateCode128Svg(book.barcode || book.id, 60, 2);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Makhzan Barcode - ${book.title}</title>
          <style>
            @page { size: auto; margin: 8mm; }
            body { font-family: 'Segoe UI', system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; }
            .label-card { border: 2px solid #000; padding: 16px; width: 340px; text-align: center; border-radius: 8px; }
            .institution { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #1e293b; margin-bottom: 4px; }
            .title { font-size: 14px; font-weight: 700; margin: 4px 0; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .meta { font-size: 11px; color: #475569; margin-bottom: 12px; }
            .barcode-svg { margin: 8px auto; max-width: 100%; }
            .location { display: flex; justify-content: space-between; font-size: 10px; font-weight: 700; color: #334155; margin-top: 8px; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="institution">Darse Burhani • Makhzan Depot</div>
            <div class="title">${book.title}</div>
            <div class="meta">${book.author ? book.author + " • " : ""}${book.category}</div>
            <div class="barcode-svg">${svg}</div>
            <div class="location">
              <span>RACK: ${book.rackNumber || "UNASSIGNED"}</span>
              <span>SHELF: ${book.shelfNumber || "GEN"}</span>
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // ── Print Kit Barcode Slip ──
  const handlePrintKitBarcode = (kit: MakhzanKit) => {
    const printWindow = window.open("", "_blank", "width=650,height=500");
    if (!printWindow) return;

    const svg = generateCode128Svg(kit.barcode, 60, 2);
    const itemsListHtml = kit.items
      .map((item, idx) => `<li>${item.quantity}x ${item.title}</li>`)
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Academic Kit Barcode - ${kit.name}</title>
          <style>
            @page { size: auto; margin: 8mm; }
            body { font-family: 'Segoe UI', system-ui, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #fff; }
            .kit-card { border: 2px solid #000; padding: 20px; width: 380px; border-radius: 12px; }
            .inst { font-size: 11px; font-weight: 800; text-transform: uppercase; color: #047857; text-align: center; }
            .name { font-size: 16px; font-weight: 800; text-align: center; margin: 4px 0 2px 0; }
            .cat { font-size: 11px; text-align: center; color: #64748b; margin-bottom: 12px; }
            .barcode-box { text-align: center; margin: 12px 0; }
            .contents { font-size: 11px; font-weight: 700; border-top: 1px dashed #94a3b8; padding-top: 8px; margin-top: 8px; }
            .contents ul { margin: 4px 0; padding-left: 20px; font-weight: normal; color: #334155; }
          </style>
        </head>
        <body>
          <div class="kit-card">
            <div class="inst">Darse Burhani • Academic Kit Bundle</div>
            <div class="name">${kit.name}</div>
            <div class="cat">Category: ${kit.category} • Target: ${kit.targetRole} (${kit.gradeLevel || "General"})</div>
            <div class="barcode-box">${svg}</div>
            <div class="contents">
              <span>Kit Manifest (${kit.items.length} Bundled Items):</span>
              <ul>${itemsListHtml}</ul>
            </div>
          </div>
          <script>
            window.onload = () => { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="min-h-screen bg-slate-50/60 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">

        {/* ── Standalone Makhzan Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-slate-900 text-amber-400">
                <Barcode className="w-5 h-5" />
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900">
                Makhzan Inventory & Barcode Terminal
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Complete inventory tracker, academic kit barcode scanner, and offline depot synchronization.
            </p>
          </div>
        </div>

        {/* ── Terminal Offline & Sync Control Console Bar ── */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-3 sm:p-4 border border-slate-800 shadow-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
                isOnline
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse"
              }`}
            >
              {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-amber-400" />}
              <span>{isOnline ? "Terminal Online" : "Offline Terminal Mode"}</span>
            </div>

            {queuedCount > 0 && (
              <Badge className="bg-amber-500 text-slate-950 font-extrabold text-xs px-2.5 py-0.5 animate-bounce">
                {queuedCount} Queued Offline {queuedCount === 1 ? "Scan" : "Scans"}
              </Badge>
            )}

            {lastSyncTime && (
              <span className="hidden md:inline-block text-[11px] text-slate-400">
                Last cached: {new Date(lastSyncTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCacheSnapshot}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              title="Cache full catalog & student registry locally for basement depot use"
            >
              <HardDrive className="w-3.5 h-3.5 text-sky-400" />
              <span>Cache Local Snapshot</span>
            </Button>

            <Button
              size="sm"
              onClick={handleSyncQueue}
              disabled={isSyncingQueue || queuedCount === 0 || !isOnline}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <Send className={`w-3.5 h-3.5 ${isSyncingQueue ? "animate-spin" : ""}`} />
              <span>Sync Queued ({queuedCount})</span>
            </Button>
          </div>
        </div>

        {/* ── Top Dashboard Stats Bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Items</span>
              <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                <BookOpen className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-slate-900">{stats.totalBooks}</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Registered in Makhzan</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-emerald-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">On Shelf</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-emerald-800">{stats.availableBooks}</div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Ready for circulation</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-amber-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Issued Out</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-100">
                <BookMarked className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-amber-800">{stats.borrowedBooks}</div>
            <div className="text-[11px] text-amber-600 mt-0.5">Currently loaned</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-purple-200/90 shadow-2xs hover:shadow-xs transition-shadow">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">Academic Kits</span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-700 border border-purple-100">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-purple-800">{kits.length}</div>
            <div className="text-[11px] text-purple-600 mt-0.5">Kit Bundles active</div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-indigo-200/90 shadow-2xs hover:shadow-xs transition-shadow col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">Borrowers</span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold font-mono text-indigo-800">{stats.activeBorrowers}</div>
            <div className="text-[11px] text-indigo-600 mt-0.5">Talabat & Faculty</div>
          </div>
        </div>

        {/* ── Mode Switching Sub-Nav ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab("scan")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "scan"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Barcode className="w-4 h-4 text-emerald-400" />
              <span>Live Barcode Terminal</span>
            </button>

            <button
              onClick={() => setActiveTab("kits")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "kits"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Package className="w-4 h-4 text-purple-400" />
              <span>Academic Kits ({kits.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("books")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "books"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <BookOpen className="w-4 h-4 text-amber-400" />
              <span>Makhzan Catalog ({books.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("add")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "add"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Plus className="w-4 h-4 text-sky-400" />
              <span>Register Item</span>
            </button>

            <button
              onClick={() => setActiveTab("bulk")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "bulk"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Upload className="w-4 h-4 text-indigo-400" />
              <span>Import Barcodes</span>
            </button>
          </div>

          <div className="flex items-center gap-2 px-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute scan chime" : "Enable scan chime"}
              className={`p-2 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer ${
                soundEnabled
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-slate-100 text-slate-500 border-slate-200"
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden sm:inline">{soundEnabled ? "Audio Chirp On" : "Muted"}</span>
            </button>

            <button
              onClick={() => fetchLibraryData()}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
              title="Refresh inventory"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB 1: LIVE BARCODE SCANNER & KIT/ITEM ASSIGNMENT ENGINE */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === "scan" && (
          <div className="space-y-6">
            <div className="bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
              <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-3xl mx-auto text-center space-y-4">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Hardware Scanner Listening (USB Barcode Gun / Camera)
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                  Scan Item or Academic Kit Barcode
                </h2>
                <p className="text-sm text-slate-400 max-w-lg mx-auto">
                  Scan any physical item or <span className="text-purple-300 font-semibold">Kit Bundle Barcode (e.g. KIT-HIFZ-01)</span> to rapidly issue or return materials.
                </p>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (scanInput.trim()) {
                      handleProcessBarcode(scanInput);
                    }
                  }}
                  className="flex items-center gap-2 max-w-xl mx-auto pt-2"
                >
                  <div className="relative flex-1">
                    <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400" />
                    <input
                      ref={scanInputRef}
                      type="text"
                      value={scanInput}
                      onChange={(e) => setScanInput(e.target.value)}
                      placeholder="Scan barcode (e.g. KIT-HIFZ-01, 06-MUSHAF-01, MKZ-1002)..."
                      className="w-full pl-12 pr-10 py-3.5 bg-slate-800/90 border-2 border-slate-700 focus:border-emerald-500 rounded-2xl text-white placeholder-slate-500 font-mono text-base focus:outline-hidden focus:ring-4 focus:ring-emerald-500/20 transition-all shadow-inner"
                      autoFocus
                    />
                    {scanInput && (
                      <button
                        type="button"
                        onClick={() => setScanInput("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={isScanning || !scanInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 h-auto rounded-2xl font-bold text-sm shadow-lg shadow-emerald-900/30 flex items-center gap-2 cursor-pointer"
                  >
                    {isScanning ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    <span>Lookup</span>
                  </Button>
                </form>

                {scanMessage && (
                  <div className="p-3 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 max-w-xl mx-auto flex items-center justify-between">
                    <span>{scanMessage}</span>
                    <button
                      onClick={() => {
                        setCustomBarcode(scanInput);
                        setActiveTab("add");
                      }}
                      className="underline font-bold text-white hover:text-emerald-300 ml-2"
                    >
                      Register Item
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Scanned ACADEMIC KIT Resolution Card ── */}
            <AnimatePresence mode="wait">
              {scannedKit && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-200 shadow-xl space-y-6"
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                    <div className="flex items-start gap-4">
                      <div className="p-3.5 bg-purple-900 text-purple-300 rounded-2xl shadow-md">
                        <Package className="w-8 h-8" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                            {scannedKit.name}
                          </h3>
                          <Badge className="bg-purple-100 text-purple-800 border-purple-300 font-bold text-xs px-2.5 py-0.5">
                            ACADEMIC KIT BUNDLE
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          Category: <span className="font-semibold text-slate-900">{scannedKit.category}</span> • Target:{" "}
                          <span className="font-semibold text-slate-900">{scannedKit.targetRole}</span>
                          {scannedKit.gradeLevel ? ` (${scannedKit.gradeLevel})` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                      <Button
                        variant="outline"
                        onClick={() => handlePrintKitBarcode(scannedKit)}
                        className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                      >
                        <Printer className="w-4 h-4 text-purple-600" />
                        <span>Print Kit Label</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setScannedKit(null)}
                        className="rounded-xl border-slate-300 text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Bundled Items Manifest Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Kit Master Barcode
                      </span>
                      <div
                        className="w-full max-w-[240px] bg-white p-2 rounded-xl border border-slate-300 shadow-2xs"
                        dangerouslySetInnerHTML={{
                          __html: generateCode128Svg(scannedKit.barcode, 50, 2),
                        }}
                      />
                      <span className="text-xs font-mono font-bold text-purple-800 mt-2">
                        {scannedKit.barcode}
                      </span>
                    </div>

                    <div className="md:col-span-2 bg-purple-50/50 p-4 rounded-2xl border border-purple-100 space-y-3">
                      <span className="text-xs font-bold uppercase tracking-wider text-purple-900 block">
                        Included Materials in Bundle ({scannedKit.items.length})
                      </span>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {scannedKit.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="bg-white p-2.5 rounded-xl border border-purple-100 flex items-center justify-between shadow-2xs"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 font-bold text-xs flex items-center justify-center">
                                {item.quantity}x
                              </span>
                              <span className="font-semibold text-sm text-slate-900">{item.title}</span>
                            </div>
                            {item.barcode && (
                              <span className="text-xs font-mono text-slate-500">{item.barcode}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Assign Kit to Student / Member */}
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <Users className="w-4 h-4 text-purple-600" />
                          <span>Assign & Issue Complete Kit to Student or Faculty</span>
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Search by Name or ITS Number to issue all bundled items in 1 scan.
                        </p>
                      </div>

                      {selectedMember && (
                        <Badge className="px-3 py-1 bg-purple-100 text-purple-800 border-purple-300 font-bold">
                          Selected: {selectedMember.name} ({selectedMember.roleLabel})
                        </Badge>
                      )}
                    </div>

                    <div className="relative">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={memberQuery}
                        onChange={(e) => setMemberQuery(e.target.value)}
                        placeholder="Search student or faculty by Name or ITS (e.g. Murtaza, 30400...)"
                        className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 focus:border-purple-500 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 transition-all"
                      />
                      {searchingMembers && (
                        <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-purple-600" />
                      )}
                    </div>

                    {members.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-1">
                        {members.map((m) => {
                          const isSelected = selectedMember?.id === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => setSelectedMember(m)}
                              className={`text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-2 cursor-pointer ${
                                isSelected
                                  ? "bg-purple-50 border-purple-500 ring-2 ring-purple-500/30 shadow-xs"
                                  : "bg-white border-slate-200 hover:border-purple-300 hover:bg-slate-50/80"
                              }`}
                            >
                              <div className="space-y-1">
                                <span className="font-bold text-sm text-slate-900 block">{m.name}</span>
                                <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                                  <span>ITS: {m.itsNumber}</span>
                                  {m.grade && <span>• {m.grade}</span>}
                                </div>
                              </div>
                              {isSelected && <Check className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="pt-2 flex justify-end">
                      <Button
                        onClick={handleIssueKit}
                        disabled={issuingLoan || !selectedMember}
                        className="bg-purple-700 hover:bg-purple-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {issuingLoan ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <PackageCheck className="w-4 h-4" />
                        )}
                        <span>
                          Issue Kit to {selectedMember ? selectedMember.name : "Selected Member"}
                        </span>
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Scanned SINGLE ITEM Resolution Card ── */}
            <AnimatePresence mode="wait">
              {scannedBook && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-lg space-y-6"
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                    <div className="flex items-start gap-4">
                      <div className="p-3.5 bg-slate-900 text-emerald-400 rounded-2xl shadow-md">
                        <BookOpen className="w-8 h-8" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl sm:text-2xl font-bold text-slate-900 font-display">
                            {scannedBook.title}
                          </h3>
                          <Badge
                            className={`px-2.5 py-0.5 rounded-full font-bold text-xs ${
                              scannedBook.status === "AVAILABLE"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : "bg-amber-100 text-amber-800 border-amber-300"
                            }`}
                          >
                            {scannedBook.status === "AVAILABLE" ? "AVAILABLE (On Shelf)" : "ISSUED (Loaned Out)"}
                          </Badge>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">
                          {scannedBook.author ? `By ${scannedBook.author} • ` : ""}
                          Category: <span className="font-semibold text-slate-900">{scannedBook.category}</span>
                          {scannedBook.publisher ? ` • Publisher: ${scannedBook.publisher}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                      <Button
                        variant="outline"
                        onClick={() => handlePrintBarcode(scannedBook)}
                        className="rounded-xl border-slate-300 text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                      >
                        <Printer className="w-4 h-4 text-slate-500" />
                        <span>Print Barcode Label</span>
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setScannedBook(null)}
                        className="rounded-xl border-slate-300 text-slate-500 hover:text-slate-800 text-xs cursor-pointer"
                      >
                        Clear
                      </Button>
                    </div>
                  </div>

                  {/* Book Metadata & Barcode Preview Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                        Code-128 Barcode Tag
                      </span>
                      <div
                        className="w-full max-w-[240px] bg-white p-2 rounded-xl border border-slate-300 shadow-2xs"
                        dangerouslySetInnerHTML={{
                          __html: generateCode128Svg(scannedBook.barcode || scannedBook.id, 50, 2),
                        }}
                      />
                      <span className="text-xs font-mono font-bold text-slate-800 mt-2">
                        {scannedBook.barcode || "NO-BARCODE"}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Shelf Placement
                      </span>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Rack Number</span>
                          <span className="text-sm font-bold font-mono text-slate-800">
                            {scannedBook.rackNumber || "Unassigned"}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Shelf Tier</span>
                          <span className="text-sm font-bold font-mono text-slate-800">
                            {scannedBook.shelfNumber || "Shelf A"}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 pt-1">
                        Copies: <span className="font-bold text-slate-800">{scannedBook.availableCopies}</span> of{" "}
                        <span className="font-bold text-slate-800">{scannedBook.totalCopies}</span> available
                      </div>
                    </div>

                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Circulation Status
                      </span>

                      {scannedBook.status === "BORROWED" ? (
                        <div className="space-y-3 my-2">
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
                            <div className="font-bold text-amber-900 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-amber-700" />
                              <span>Current Borrower: {scannedBook.currentBorrower || "Registered Member"}</span>
                            </div>
                            {scannedBook.dueDate && (
                              <div className="text-amber-700 text-[11px]">
                                Due Date: {new Date(scannedBook.dueDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>

                          <Button
                            onClick={handleReturnBook}
                            disabled={returningLoan}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {returningLoan ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCcw className="w-4 h-4" />
                            )}
                            <span>1-Click Return to Shelf</span>
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2 my-2">
                          <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-medium">
                            Item is ready on shelf for checkout to Talabat or Faculty below.
                          </div>
                        </div>
                      )}

                      <div className="text-[10px] text-slate-400">
                        Status: {scannedBook.status}
                      </div>
                    </div>
                  </div>

                  {/* ── Dynamic Member Assign Section (Only when AVAILABLE) ── */}
                  {scannedBook.status === "AVAILABLE" && (
                    <div className="pt-4 border-t border-slate-200 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                            <Users className="w-4 h-4 text-emerald-600" />
                            <span>Assign & Issue to Member (Talabat or Faculty)</span>
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Search by Name or ITS Number to assign this volume.
                          </p>
                        </div>

                        {selectedMember && (
                          <Badge className="px-3 py-1 bg-emerald-100 text-emerald-800 border-emerald-300 font-bold">
                            Selected: {selectedMember.name} ({selectedMember.roleLabel})
                          </Badge>
                        )}
                      </div>

                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={memberQuery}
                          onChange={(e) => setMemberQuery(e.target.value)}
                          placeholder="Search student or faculty by Name or ITS (e.g. Murtaza, 30400...)"
                          className="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-300 focus:border-emerald-500 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                        {searchingMembers && (
                          <RefreshCw className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-emerald-600" />
                        )}
                      </div>

                      {members.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-60 overflow-y-auto p-1">
                          {members.map((m) => {
                            const isSelected = selectedMember?.id === m.id;
                            const isFaculty = m.role === "TEACHER" || m.role === "FACULTY";

                            return (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setSelectedMember(m);
                                  setLoanDays(isFaculty ? 30 : 14);
                                }}
                                className={`text-left p-3 rounded-xl border transition-all flex items-start justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? "bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/30 shadow-xs"
                                    : "bg-white border-slate-200 hover:border-emerald-300 hover:bg-slate-50/80"
                                }`}
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-sm text-slate-900">{m.name}</span>
                                    <Badge
                                      className={`text-[10px] px-1.5 py-0 rounded font-semibold ${
                                        isFaculty
                                          ? "bg-purple-100 text-purple-800 border-purple-200"
                                          : "bg-blue-100 text-blue-800 border-blue-200"
                                      }`}
                                    >
                                      {m.roleLabel}
                                    </Badge>
                                  </div>
                                  <div className="text-xs text-slate-500 flex items-center gap-2 font-mono">
                                    <span>ITS: {m.itsNumber}</span>
                                    {m.grade && <span>• {m.grade}</span>}
                                  </div>
                                </div>
                                {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <span>Loan Duration:</span>
                          <select
                            value={loanDays}
                            onChange={(e) => setLoanDays(Number(e.target.value))}
                            className="bg-slate-100 border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800"
                          >
                            <option value={7}>7 Days (Short)</option>
                            <option value={14}>14 Days (Standard)</option>
                            <option value={30}>30 Days (Faculty)</option>
                            <option value={90}>90 Days (Term / Kit)</option>
                          </select>
                        </div>

                        <Button
                          onClick={handleIssueBook}
                          disabled={issuingLoan || !selectedMember}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {issuingLoan ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          <span>
                            Issue to {selectedMember ? selectedMember.name : "Selected Member"}
                          </span>
                        </Button>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB 2: ACADEMIC KITS & BUNDLES MANAGEMENT */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === "kits" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm">
              <div>
                <h3 className="text-xl font-bold font-display text-slate-900 flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  <span>Academic Kit Bundles</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Bundle multiple textbooks, Quran mushafs, diaries, and stationery kits under single master barcodes.
                </p>
              </div>

              <Button
                onClick={() => setShowCreateKitModal(true)}
                className="bg-purple-700 hover:bg-purple-600 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <PackagePlus className="w-4 h-4" />
                <span>Create New Kit Bundle</span>
              </Button>
            </div>

            {/* Kits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kits.map((kit) => (
                <div
                  key={kit.id}
                  className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                          {kit.category}
                        </span>
                        <h4 className="font-bold text-base text-slate-900 mt-1.5">{kit.name}</h4>
                      </div>
                      <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] font-mono">
                        {kit.targetRole}
                      </Badge>
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2">{kit.description}</p>

                    {/* Barcode Badge */}
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Barcode className="w-4 h-4 text-purple-600" />
                        <span className="font-mono font-bold text-xs text-slate-800">{kit.barcode}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-semibold">{kit.items.length} items</span>
                    </div>

                    {/* Included Items Preview */}
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Manifest:</span>
                      <ul className="text-xs text-slate-600 space-y-0.5">
                        {kit.items.slice(0, 3).map((item, idx) => (
                          <li key={idx} className="flex items-center gap-1.5 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                            <span className="truncate font-medium">{item.quantity}x {item.title}</span>
                          </li>
                        ))}
                        {kit.items.length > 3 && (
                          <li className="text-[10px] text-purple-600 font-semibold">
                            +{kit.items.length - 3} more items...
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handlePrintKitBarcode(kit)}
                      variant="outline"
                      className="flex-1 rounded-xl text-xs font-semibold border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-900 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 mr-1" />
                      <span>Print Label</span>
                    </Button>

                    <Button
                      size="sm"
                      onClick={() => {
                        setScannedKit(kit);
                        setActiveTab("scan");
                      }}
                      className="flex-1 rounded-xl text-xs font-bold bg-purple-700 hover:bg-purple-600 text-white cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5 mr-1" />
                      <span>Issue Kit</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Create Kit Modal */}
            <AnimatePresence>
              {showCreateKitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="bg-white rounded-3xl p-6 max-w-xl w-full shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <PackagePlus className="w-5 h-5 text-purple-600" />
                        <h3 className="font-bold text-slate-900 text-lg">Create Academic Kit Bundle</h3>
                      </div>
                      <button
                        onClick={() => setShowCreateKitModal(false)}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleCreateKit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Kit Name</label>
                          <input
                            type="text"
                            required
                            value={newKitName}
                            onChange={(e) => setNewKitName(e.target.value)}
                            placeholder="e.g. Darajah 6 Quran & Hifz Kit"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-purple-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Master Barcode</label>
                          <input
                            type="text"
                            value={newKitBarcode}
                            onChange={(e) => setNewKitBarcode(e.target.value)}
                            placeholder="e.g. KIT-HIFZ-06 (Auto if empty)"
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:border-purple-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Category</label>
                          <select
                            value={newKitCategory}
                            onChange={(e) => setNewKitCategory(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                          >
                            <option value="Hifz">Hifz Al-Quran</option>
                            <option value="Curriculum">Academic Curriculum</option>
                            <option value="Stationery">Stationery Pack</option>
                            <option value="Faculty">Faculty Kit</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-700">Target Role</label>
                          <select
                            value={newKitRole}
                            onChange={(e) => setNewKitRole(e.target.value as any)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                          >
                            <option value="STUDENT">Talabat Students</option>
                            <option value="TEACHER">Faculty & Asateezah</option>
                            <option value="ALL">Universal</option>
                          </select>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Description / Grade Level</label>
                        <input
                          type="text"
                          value={newKitDescription}
                          onChange={(e) => setNewKitDescription(e.target.value)}
                          placeholder="e.g. Complete kit for Darajah 6 students including Quran, Sabaq diary, notebook"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                        />
                      </div>

                      {/* Select items from inventory to bundle */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        <label className="text-xs font-bold text-slate-700 block">
                          Select Items from Makhzan Catalog ({selectedKitItemIds.length} Selected)
                        </label>
                        <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-200 p-2 rounded-xl">
                          {books.map((book) => {
                            const isSelected = selectedKitItemIds.some((i) => i.id === book.id);
                            return (
                              <div
                                key={book.id}
                                className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? "bg-purple-50 border-purple-300 font-semibold"
                                    : "bg-white border-slate-200"
                                }`}
                              >
                                <span className="truncate">{book.title} ({book.category})</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setSelectedKitItemIds((prev) => prev.filter((i) => i.id !== book.id));
                                    } else {
                                      setSelectedKitItemIds((prev) => [...prev, { id: book.id, qty: 1 }]);
                                    }
                                  }}
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                                    isSelected
                                      ? "bg-purple-600 text-white"
                                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  }`}
                                >
                                  {isSelected ? "Bundled ✓" : "+ Add"}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCreateKitModal(false)}
                          className="rounded-xl text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="bg-purple-700 hover:bg-purple-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                          Save Kit Bundle
                        </Button>
                      </div>
                    </form>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB 3: COMPLETE MAKHZAN CATALOG TABLE */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === "books" && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search by Title, Author, Barcode, Rack..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-700"
                  >
                    <option value="ALL">All Categories</option>
                    {categories.map((c) => (
                      <option key={c.name} value={c.name}>
                        {c.name} ({c.count})
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-slate-50 border border-slate-200 text-xs rounded-xl px-3 py-2 text-slate-700"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="AVAILABLE">Available</option>
                    <option value="BORROWED">Borrowed / Issued</option>
                  </select>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="p-3">Barcode Tag</th>
                      <th className="p-3">Title & Category</th>
                      <th className="p-3">Location (Rack/Shelf)</th>
                      <th className="p-3">Availability</th>
                      <th className="p-3">Current Borrower</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBooks.map((book) => (
                      <tr key={book.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-mono font-bold text-slate-900">
                          <button
                            onClick={() => setBarcodeModalBook(book)}
                            className="flex items-center gap-1.5 text-emerald-700 hover:text-emerald-900 cursor-pointer"
                          >
                            <Barcode className="w-4 h-4" />
                            <span>{book.barcode || "NO-BARCODE"}</span>
                          </button>
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{book.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {book.author ? `${book.author} • ` : ""}
                            <span className="font-medium text-slate-700">{book.category}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-slate-700">
                            {book.rackNumber ? `${book.rackNumber} / ${book.shelfNumber || "A"}` : "Unassigned"}
                          </span>
                        </td>
                        <td className="p-3">
                          <Badge
                            className={`text-[10px] font-bold ${
                              book.status === "AVAILABLE"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : "bg-amber-100 text-amber-800 border-amber-300"
                            }`}
                          >
                            {book.status === "AVAILABLE" ? "On Shelf" : "Loaned Out"}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-600 font-medium">
                          {book.currentBorrower || "—"}
                        </td>
                        <td className="p-3 text-right space-x-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setScannedBook(book);
                              setActiveTab("scan");
                            }}
                            className="text-xs text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                          >
                            Scan / Issue
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handlePrintBarcode(book)}
                            className="text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB 4: REGISTER NEW BOOK / INVENTORY ITEM */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === "add" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-lg space-y-6">
              <div className="pb-6 border-b border-slate-100">
                <h3 className="text-xl font-bold font-display text-slate-900">
                  Register Item in Makhzan Depot
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Add textbooks, Quran mushafs, or curriculum items with auto-generated Code-128 barcodes.
                </p>
              </div>

              <form onSubmit={handleAddBook} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Item Title *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Mushaf Al-Tajweed, Al-Fiqh Al-Islami..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Author / Compiler</label>
                    <input
                      type="text"
                      value={newAuthor}
                      onChange={(e) => setNewAuthor(e.target.value)}
                      placeholder="e.g. Al-Qadi al-Nu'man"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Category</label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-emerald-500"
                    >
                      {Object.keys(CATEGORY_MAP).map((cat) => (
                        <option key={cat} value={cat}>
                          {cat} (Prefix: {CATEGORY_MAP[cat]})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5 sm:col-span-1">
                    <label className="text-xs font-bold text-slate-700">Custom Barcode (Optional)</label>
                    <input
                      type="text"
                      value={customBarcode}
                      onChange={(e) => setCustomBarcode(e.target.value)}
                      placeholder={computedAutoBarcode}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Rack Number</label>
                    <input
                      type="text"
                      value={newRack}
                      onChange={(e) => setNewRack(e.target.value)}
                      placeholder="e.g. Rack-1, Section-B"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Shelf Tier</label>
                    <input
                      type="text"
                      value={newShelf}
                      onChange={(e) => setNewShelf(e.target.value)}
                      placeholder="e.g. Shelf-2, Tier-A"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                    Live Barcode Generation Preview
                  </span>
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200">
                    <div
                      className="w-full max-w-[280px]"
                      dangerouslySetInnerHTML={{
                        __html: generateCode128Svg(customBarcode || computedAutoBarcode, 50, 2),
                      }}
                    />
                    <div className="text-right text-xs space-y-1">
                      <div className="font-bold text-slate-900">
                        Format: <span className="font-mono text-emerald-700">Code-128B</span>
                      </div>
                      <div className="text-slate-500 font-mono">
                        Value: {customBarcode || computedAutoBarcode}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setActiveTab("books")}
                    className="rounded-xl cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmittingBook || !newTitle.trim()}
                    className="bg-emerald-700 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer"
                  >
                    {isSubmittingBook ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    <span>Register in Makhzan</span>
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* TAB 5: BULK BARCODE IMPORTER */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === "bulk" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-lg space-y-6">
              <div className="pb-6 border-b border-slate-100">
                <h3 className="text-xl font-bold font-display text-slate-900">
                  Bulk Barcode & Book Importer
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Quickly import dozens of books with their barcodes. Paste comma or tab separated values from Excel or CSV.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">
                    Paste CSV or Tabular Data
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Format: Title, Author, Category, Barcode, Rack, Shelf
                  </span>
                </div>
                <textarea
                  rows={6}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Mushaf Tajweed, Darse Burhani, Hifz, 06-MUSHAF-01, Rack-1, Shelf-A\nLisan ud-Dawat Book 1, Aljamea, Language, 08-LISAN-01, Rack-2, Shelf-B\nClassroom Register, Admin, Faculty, 11-REG-01, Rack-3, Shelf-C`}
                  className="w-full p-4 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono text-slate-900 focus:outline-hidden focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {bulkParsed.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Parsed Items Preview ({bulkParsed.length})
                    </span>
                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-xs font-bold">
                      {bulkParsed.length} Ready for Makhzan
                    </Badge>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs text-slate-700">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-500">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Title</th>
                          <th className="p-2.5">Author</th>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5">Barcode</th>
                          <th className="p-2.5">Location</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                        {bulkParsed.map((item) => (
                          <tr key={item.index} className="hover:bg-slate-50">
                            <td className="p-2.5 text-slate-400">{item.index}</td>
                            <td className="p-2.5 font-bold text-slate-900 font-sans">{item.title}</td>
                            <td className="p-2.5 text-slate-600 font-sans">{item.author || "—"}</td>
                            <td className="p-2.5">{item.category}</td>
                            <td className="p-2.5 font-bold text-emerald-700">{item.barcode || "(Auto-Gen)"}</td>
                            <td className="p-2.5 text-slate-500">
                              {item.rackNumber ? `${item.rackNumber}/${item.shelfNumber}` : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <Button
                  onClick={handleBulkImport}
                  disabled={isImportingBulk || bulkParsed.length === 0}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-bold text-xs shadow-md flex items-center gap-2 cursor-pointer"
                >
                  {isImportingBulk ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>Import {bulkParsed.length} Items to Makhzan</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Single Barcode Popover Modal ── */}
        <AnimatePresence>
          {barcodeModalBook && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 text-center space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Makhzan Barcode Tag
                  </span>
                  <button
                    onClick={() => setBarcodeModalBook(null)}
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-base">{barcodeModalBook.title}</h4>
                  <p className="text-xs text-slate-500">{barcodeModalBook.category}</p>
                </div>

                <div
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex justify-center"
                  dangerouslySetInnerHTML={{
                    __html: generateCode128Svg(barcodeModalBook.barcode || barcodeModalBook.id, 60, 2),
                  }}
                />

                <div className="text-xs font-mono font-bold text-slate-800">
                  {barcodeModalBook.barcode}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={() => handlePrintBarcode(barcodeModalBook)}
                    className="w-full bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Label</span>
                  </Button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
