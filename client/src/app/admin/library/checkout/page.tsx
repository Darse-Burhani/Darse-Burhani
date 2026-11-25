"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Barcode,
  User,
  Users,
  BookOpen,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  CalendarDays,
  Scan,
  RotateCcw,
  ShoppingCart,
  History,
  BookMarked,
  Search,
  BookX,
  Layers,
  ShieldCheck,
  LayoutDashboard,
  ArrowRight,
  Send,
  MessageSquare,
  Mail,
  ChevronLeft,
  ChevronRight,
  Filter,
  DollarSign,
  Sparkles,
  Phone,
  Calendar,
  Check,
  Plus,
  PlusCircle,
  UserCheck,
  Trash2,
  List,
  LayoutGrid,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from "@/components/ui/modal";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { LIBRARY_HUB_TABS, LIBRARY_HUB_TITLE, LIBRARY_HUB_DESCRIPTION } from "@/lib/library-tabs";
import BarcodeDisplay from "@/components/admin/BarcodeDisplay";
import BookScanModal from "@/components/admin/BookScanModal";
import { getHijriFromDate, HIJRI_MONTHS } from "@/lib/fatimi-calendar";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import ReturnBooksLog from "@/components/admin/ReturnBooksLog";
import MonthlyCirculationRecords from "@/components/admin/MonthlyCirculationRecords";
import Link from "next/link";
import { cn } from "@/lib/utils";

// ── Types ──
interface MemberInfo {
  id: string;
  profileId: string;
  memberId: string;
  studentId: string;
  its: string | null;
  trNo: string | null;
  firstName: string;
  lastName: string;
  name: string;
  nameAr?: string | null;
  role: "STUDENT" | "FACULTY";
  roleLabel: string;
  grade: string | null;
  section: string | null;
  className: string | null;
  contactPhone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  parentEmail: string | null;
  fatherName?: string | null;
  fatherPhone?: string | null;
  activeLoans: number;
  hasOverdue: boolean;
  maxAllowed: number;
  photo?: string | null;
  avatarUrl?: string | null;
}

interface BookInfo {
  id: string;
  title: string;
  author: string | null;
  barcode: string | null;
  category?: string;
  coverImage: string | null;
  status: string;
  availableCopies: number;
  rackNumber?: string | null;
  location?: string | null;
}

export interface ActiveIssuedLoan {
  id: string;
  bookId: string;
  bookTitle: string;
  bookBarcode: string;
  category: string;
  coverImage: string | null;
  rackNumber: string | null;
  borrowerId: string;
  borrowerName: string;
  borrowerPhoto?: string | null;
  photo?: string | null;
  borrowerAr?: string | null;
  borrowerRole: "STUDENT" | "FACULTY";
  darjah: string;
  rawGrade: string;
  contactPhone: string | null;
  parentName: string | null;
  parentPhone: string | null;
  parentEmail: string | null;
  fatherName?: string | null;
  fatherPhone?: string | null;
  its: string | null;
  trNo: string | null;
  status: string;
  isReturned?: boolean;
  returnedAt?: string | null;
  borrowedAt: string;
  borrowedDateEn: string;
  borrowedDateHijri: string;
  dueAt: string;
  dueDateEn: string;
  dueDateHijri: string;
  isOverdue: boolean;
  isThursdayGrace: boolean;
  daysOverdue: number;
  garamatAmount: number;
  ratePerDay: number;
  ruleNote: string;
  whatsAppUrl: string | null;
}

// Module-level caches for 0ms instantaneous borrower picking
let _cachedTalabat: MemberInfo[] | null = null;
let _cachedFaculty: MemberInfo[] | null = null;

const DARJAH_OPTIONS = [
  { id: "all", label: "All Talabat", labelAr: "جميع الطلبة", shortLabel: "All" },
  { id: "1", label: "Darajah 1", labelAr: "الأولى", shortLabel: "D1" },
  { id: "2", label: "Darajah 2 (Saniyah)", labelAr: "الثانية", shortLabel: "D2" },
  { id: "3", label: "Darajah 3 (Salisah)", labelAr: "الثالثة", shortLabel: "D3" },
  { id: "4", label: "Darajah 4", labelAr: "الرابعة", shortLabel: "D4" },
];

// ── Web Audio Feedback ──
function playScannerBeep(type: "success" | "error" = "success") {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (type === "success") {
      osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.1);
    } else {
      osc.frequency.setValueAtTime(320, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.25);
    }
  } catch {
    // Ignore autoplay or audio policy errors
  }
}

// ── Action Log ──
function ActionLog({ items }: { items: { type: "checkout" | "return" | "error" | "reminder"; message: string; time: string }[] }) {
  return (
    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
      {items.length === 0 ? (
        <p className="text-center text-slate-400 py-6 text-xs">No circulation transactions recorded this session</p>
      ) : (
        items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-100">
            {item.type === "checkout" && <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />}
            {item.type === "return" && <RotateCcw className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />}
            {item.type === "reminder" && <MessageSquare className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />}
            {item.type === "error" && <XCircle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 leading-snug">{item.message}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{item.time}</p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Main Checkout & Circulation Terminal ──
export default function CheckoutPage() {
  const [mode, setMode] = useState<"checkout" | "issued" | "return" | "return-log" | "stacking">(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const tabParam = p.get("tab") || p.get("mode");
      if (tabParam === "return-log" || tabParam === "return_log" || tabParam === "returns") return "return-log";
      if (tabParam === "issued" || tabParam === "loans" || window.location.pathname.endsWith("/issued")) return "issued";
      if (tabParam === "return") return "return";
      if (tabParam === "stacking") return "stacking";
    }
    return "checkout";
  });
  const [recipientType, setRecipientType] = useState<"talabat" | "faculty">("talabat");
  const [selectedDarjah, setSelectedDarjah] = useState<string>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [selectedDept, setSelectedDept] = useState<string>("all");

  // All Active Issued Loans state
  const [allActiveLoans, setAllActiveLoans] = useState<ActiveIssuedLoan[]>([]);
  const [loadingActiveLoans, setLoadingActiveLoans] = useState(false);
  const [issuedSearchQuery, setIssuedSearchQuery] = useState("");
  const [issuedFilter, setIssuedFilter] = useState<
    "ALL" | "DUE_TODAY" | "OVERDUE" | "RETURNED" | "DARJAH_1" | "DARJAH_2" | "DARJAH_3" | "DARJAH_4" | "FACULTY"
  >("ALL");
  const [issuedViewMode, setIssuedViewMode] = useState<"table" | "grid">("table");
  const [returnModalLoan, setReturnModalLoan] = useState<ActiveIssuedLoan | null>(null);
  const [waiveChoice, setWaiveChoice] = useState<"COLLECT" | "WAIVE">("WAIVE");
  const [activeLoansStats, setActiveLoansStats] = useState({
    totalActive: 0,
    overdueCount: 0,
    thursdayGraceCount: 0,
    totalGaramat: 0,
    totalReturned: 0,
  });

  // Fast In-Memory Member Caches for 0ms Instant Borrower Picking
  const [allTalabat, setAllTalabat] = useState<MemberInfo[]>(_cachedTalabat || []);
  const [allFaculty, setAllFaculty] = useState<MemberInfo[]>(_cachedFaculty || []);
  const [loadingMemberCache, setLoadingMemberCache] = useState(!_cachedTalabat);

  // Today's Returns Summary & Live Names
  const [todayReturnSummary, setTodayReturnSummary] = useState<{
    totalReturnedToday: number;
    todaysBorrowerNames: string[];
    onTimeCount: number;
    lateCount: number;
    totalGaramat: number;
  }>({
    totalReturnedToday: 0,
    todaysBorrowerNames: [],
    onTimeCount: 0,
    lateCount: 0,
    totalGaramat: 0,
  });

  // Member states
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [memberQuery, setMemberQuery] = useState("");
  const [availableDepts, setAvailableDepts] = useState<{ department: string; count: number }[]>([]);

  // Barcode & processing
  const [scannedBarcode, setScannedBarcode] = useState("");
  const [processing, setProcessing] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [scannedBooks, setScannedBooks] = useState<BookInfo[]>([]);
  const [actionLog, setActionLog] = useState<{ type: "checkout" | "return" | "error" | "reminder"; message: string; time: string }[]>([]);
  const [activeLoans, setActiveLoans] = useState<any[]>([]);

  // Book Name Search & Selection for Checkout
  const [bookInputMode, setBookInputMode] = useState<"scan" | "search" | "insert">("scan");
  const [bookSearchResults, setBookSearchResults] = useState<BookInfo[]>([]);
  const [searchingBooks, setSearchingBooks] = useState(false);
  const [showBookDropdown, setShowBookDropdown] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookInfo | null>(null);

  // Return by Book Name & Active Loans
  const [returnLoanResults, setReturnLoanResults] = useState<any[]>([]);
  const [showReturnDropdown, setShowReturnDropdown] = useState(false);

  const searchReturnLoansByName = async (q: string) => {
    const term = q.trim();
    if (!term || term.length < 2) {
      setReturnLoanResults([]);
      setShowReturnDropdown(false);
      return;
    }
    setSearchingBooks(true);
    try {
      const res = await fetch(`/api/admin/library/return/search-active-loans?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setReturnLoanResults(data.data);
        setShowReturnDropdown(data.data.length > 0);
      }
    } catch {
      setReturnLoanResults([]);
    } finally {
      setSearchingBooks(false);
    }
  };

  // Direct Book Inserting & Instant Issue State
  const [insertTitle, setInsertTitle] = useState("");
  const [insertAuthor, setInsertAuthor] = useState("");
  const [insertCategory, setInsertCategory] = useState("General");
  const [insertBarcode, setInsertBarcode] = useState("");
  const [insertRack, setInsertRack] = useState("");
  const [insertCopies, setInsertCopies] = useState(1);
  const [insertingDirectly, setInsertingDirectly] = useState(false);
  const [insertSuggestions, setInsertSuggestions] = useState<BookInfo[]>([]);
  const [showInsertDropdown, setShowInsertDropdown] = useState(false);
  const [matchingExistingBook, setMatchingExistingBook] = useState<BookInfo | null>(null);

  // Dynamic fetch of related books on manual book title enter
  useEffect(() => {
    const q = insertTitle.trim();
    if (!q || q.length < 2) {
      setInsertSuggestions([]);
      setShowInsertDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/library/checkout/search-books?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setInsertSuggestions(data.data);
          setShowInsertDropdown(data.data.length > 0);
        }
      } catch {
        // Ignore
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [insertTitle]);

  // Issue Dates & Till UI
  const [issueDate] = useState<Date>(new Date());
  const [dueDateDays, setDueDateDays] = useState(7);
  const [customDueDate, setCustomDueDate] = useState<string>("");
  const [reminderOneDayBefore, setReminderOneDayBefore] = useState(true);
  const [reminderDayOfDue, setReminderDayOfDue] = useState(true);
  const [sendWhatsAppOnIssue, setSendWhatsAppOnIssue] = useState(true);

  // Return & Garamat states
  const [pendingReturnGaramat, setPendingReturnGaramat] = useState<{
    bookTitle: string;
    barcode: string;
    borrowerName: string;
    darjah: string;
    daysLate: number;
    garamatAmount: number;
    action: "COLLECTED" | "WAIVED" | "PENDING";
    notes: string;
  } | null>(null);

  // Green On-Time Return Feedback
  const [lastOnTimeReturn, setLastOnTimeReturn] = useState<{
    bookTitle: string;
    barcode: string;
    borrowerName: string;
    borrowedAt?: string;
    dueAt?: string;
    dueHijri?: string;
  } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const memberSearchInputRef = useRef<HTMLInputElement>(null);

  // Focus barcode input on mode change
  useEffect(() => {
    if (mode !== "stacking" && mode !== "issued") {
      barcodeInputRef.current?.focus();
    }
  }, [mode]);

  // Initial Hijri calculation for Issue Date
  const issueHijri = getHijriFromDate(issueDate);

  // Computed Due Date based on days or custom picker
  const computedDueDate = customDueDate
    ? new Date(customDueDate)
    : new Date(issueDate.getTime() + dueDateDays * 86400000);
  const dueHijri = getHijriFromDate(computedDueDate);

  // Log action
  const logAction = useCallback((type: "checkout" | "return" | "error" | "reminder", message: string) => {
    setActionLog((prev) => [
      {
        type,
        message,
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      },
      ...prev,
    ].slice(0, 50));
  }, []);

  // Preload Talabat & Faculty on mount into memory for 0ms instantaneous borrower picking
  const preloadMembers = useCallback(async () => {
    try {
      setLoadingMemberCache(true);
      const [tRes, fRes] = await Promise.all([
        fetch("/api/admin/library/students?type=talabat&limit=1000"),
        fetch("/api/admin/library/students?type=faculty&limit=1000"),
      ]);
      const [tData, fData] = await Promise.all([tRes.json(), fRes.json()]);

      if (tData.success && Array.isArray(tData.data)) {
        _cachedTalabat = tData.data;
        setAllTalabat(tData.data);
      }
      if (fData.success && Array.isArray(fData.data)) {
        _cachedFaculty = fData.data;
        setAllFaculty(fData.data);
        if (fData.availableDepartments) {
          setAvailableDepts(fData.availableDepartments);
        }
      }
    } catch {
      // Non-critical background caching error
    } finally {
      setLoadingMemberCache(false);
    }
  }, []);

  // Fetch all active loans across the library
  const fetchAllActiveLoans = useCallback(async () => {
    setLoadingActiveLoans(true);
    try {
      const res = await fetch("/api/admin/library/checkout/all-active-loans");
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAllActiveLoans(json.data);
        if (json.stats) {
          setActiveLoansStats(json.stats);
        }
      }
    } catch {
      // Ignore
    } finally {
      setLoadingActiveLoans(false);
    }
  }, []);

  // Counts by Darajah computed directly from all loaded talabat
  const darjahCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allTalabat.length, "1": 0, "2": 0, "3": 0, "4": 0 };
    for (const s of allTalabat) {
      const g = String(s.grade || "").trim();
      if (counts[g] !== undefined) {
        counts[g]++;
      }
    }
    return counts;
  }, [allTalabat]);

  // Section counts for selected Darajah
  const sectionCounts = useMemo(() => {
    if (selectedDarjah === "all") return {};
    const counts: Record<string, number> = { all: darjahCounts[selectedDarjah] || 0 };
    for (const s of allTalabat) {
      const g = String(s.grade || "").trim();
      if (g === selectedDarjah) {
        const sec = String(s.section || "").trim().toUpperCase();
        if (sec) {
          counts[sec] = (counts[sec] || 0) + 1;
        }
      }
    }
    return counts;
  }, [allTalabat, selectedDarjah, darjahCounts]);

  // 0ms In-Memory Instant Member Search & Filter with Full Name & Multi-Word Token Matching
  const memberResults = useMemo(() => {
    const pool = recipientType === "talabat" ? allTalabat : allFaculty;
    const q = memberQuery.trim().toLowerCase();
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];

    return pool.filter((m) => {
      // Darjah Filter (Talabat)
      if (recipientType === "talabat" && selectedDarjah !== "all") {
        const g = String(m.grade || "").trim().toLowerCase();
        const cn = String(m.className || "").toLowerCase();
        if (
          g !== selectedDarjah &&
          !cn.includes(`grade ${selectedDarjah}`) &&
          !cn.includes(`darajah ${selectedDarjah}`) &&
          !cn.includes(`darajeh ${selectedDarjah}`) &&
          !cn.startsWith(`${selectedDarjah} `) &&
          !cn.startsWith(`${selectedDarjah}-`)
        ) {
          return false;
        }

        // Section Filter (e.g. A, B)
        if (selectedSection !== "all") {
          const sec = String(m.section || "").trim().toUpperCase();
          if (sec !== selectedSection && !cn.includes(` ${selectedSection}`)) {
            return false;
          }
        }
      }

      // Department Filter (Faculty)
      if (recipientType === "faculty" && selectedDept !== "all") {
        const dept = String(m.className || m.roleLabel || "").toLowerCase();
        if (!dept.includes(selectedDept.toLowerCase())) {
          return false;
        }
      }

      // If no query, show ALL matching members in the selected Darajah/Dept
      if (tokens.length === 0) return true;

      // Multi-word Token Matching: every word typed must match at least one attribute of the member
      return tokens.every((tok) => {
        return (
          (m.name && m.name.toLowerCase().includes(tok)) ||
          (m.firstName && m.firstName.toLowerCase().includes(tok)) ||
          (m.lastName && m.lastName.toLowerCase().includes(tok)) ||
          (m.nameAr && m.nameAr.includes(tok)) ||
          (m.its && m.its.includes(tok)) ||
          (m.trNo && m.trNo.toLowerCase().includes(tok)) ||
          (m.studentId && m.studentId.toLowerCase().includes(tok)) ||
          (m.parentName && m.parentName.toLowerCase().includes(tok)) ||
          (m.fatherName && m.fatherName.toLowerCase().includes(tok)) ||
          (m.className && m.className.toLowerCase().includes(tok))
        );
      });
    });
  }, [recipientType, allTalabat, allFaculty, memberQuery, selectedDarjah, selectedSection, selectedDept]);

  // Live Server Fallback Search: if typing a query and in-memory search yielded 0 results, query server to make 100% sure nothing was missed
  useEffect(() => {
    const q = memberQuery.trim();
    if (q.length < 2) return;

    const timeout = setTimeout(async () => {
      if (memberResults.length > 0) return;
      try {
        const res = await fetch(`/api/admin/library/students?query=${encodeURIComponent(q)}&type=${recipientType}&limit=100`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          if (recipientType === "talabat") {
            setAllTalabat((prev) => {
              const existingIds = new Set(prev.map((s) => s.id));
              const newItems = json.data.filter((item: MemberInfo) => !existingIds.has(item.id));
              return newItems.length > 0 ? [...prev, ...newItems] : prev;
            });
          } else {
            setAllFaculty((prev) => {
              const existingIds = new Set(prev.map((f) => f.id));
              const newItems = json.data.filter((item: MemberInfo) => !existingIds.has(item.id));
              return newItems.length > 0 ? [...prev, ...newItems] : prev;
            });
          }
        }
      } catch {
        // Ignore fallback search error
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [memberQuery, memberResults.length, recipientType]);

  // Quick In-Memory Filter for All Issued Loans
  const filteredActiveLoans = useMemo(() => {
    const q = issuedSearchQuery.trim().toLowerCase();
    return allActiveLoans.filter((item) => {
      // Tab pill filtering
      if (issuedFilter === "DUE_TODAY") {
        const today = new Date().toISOString().slice(0, 10);
        const dueStr = new Date(item.dueAt).toISOString().slice(0, 10);
        if (dueStr !== today && !item.isThursdayGrace) return false;
      } else if (issuedFilter === "OVERDUE") {
        if (!item.isOverdue) return false;
      } else if (issuedFilter === "RETURNED") {
        if (item.status !== "RETURNED" && !item.isReturned) return false;
      } else if (issuedFilter === "DARJAH_1") {
        if (item.rawGrade !== "1") return false;
      } else if (issuedFilter === "DARJAH_2") {
        if (item.rawGrade !== "2") return false;
      } else if (issuedFilter === "DARJAH_3") {
        if (item.rawGrade !== "3") return false;
      } else if (issuedFilter === "DARJAH_4") {
        if (item.rawGrade !== "4") return false;
      } else if (issuedFilter === "FACULTY") {
        if (item.borrowerRole !== "FACULTY") return false;
      }

      // If viewing active loans (not explicitly filtered by RETURNED), exclude returned items
      if (issuedFilter !== "RETURNED" && (item.status === "RETURNED" || item.isReturned)) {
        return false;
      }

      // Text query filtering
      if (!q) return true;
      return (
        item.bookTitle.toLowerCase().includes(q) ||
        item.bookBarcode.toLowerCase().includes(q) ||
        item.borrowerName.toLowerCase().includes(q) ||
        (item.borrowerAr && item.borrowerAr.includes(q)) ||
        (item.parentName && item.parentName.toLowerCase().includes(q)) ||
        (item.its && item.its.includes(q)) ||
        (item.trNo && item.trNo.toLowerCase().includes(q)) ||
        (item.darjah && item.darjah.toLowerCase().includes(q))
      );
    });
  }, [allActiveLoans, issuedFilter, issuedSearchQuery]);

  // Fetch today's returned books summary & names
  const fetchTodaysReturns = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/library/return/today");
      const json = await res.json();
      if (json.success && json.data) {
        setTodayReturnSummary({
          totalReturnedToday: json.data.stats?.totalReturnedToday ?? 0,
          todaysBorrowerNames: json.data.todaysBorrowerNames || [],
          onTimeCount: json.data.stats?.onTimeCount ?? 0,
          lateCount: json.data.stats?.lateCount ?? 0,
          totalGaramat: json.data.stats?.totalGaramat ?? 0,
        });
      }
    } catch {
      // Ignore
    }
  }, []);

  // Initial load of caches, today's returns & URL tab catch
  useEffect(() => {
    preloadMembers();
    fetchAllActiveLoans();
    fetchTodaysReturns();
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const tabParam = p.get("tab") || p.get("mode");
      if (tabParam === "return-log" || tabParam === "return_log" || tabParam === "returns") {
        setMode("return-log");
      } else if (tabParam === "issued" || tabParam === "loans") {
        setMode("issued");
      } else if (tabParam === "return") {
        setMode("return");
      } else if (tabParam === "stacking") {
        setMode("stacking");
      }
    }
  }, [preloadMembers, fetchAllActiveLoans, fetchTodaysReturns]);

  // 1-Click Return directly from Issued Books Table or Cards
  const handleQuickReturnFromIssued = async (loan: ActiveIssuedLoan) => {
    if (loan.isOverdue && loan.garamatAmount > 0) {
      setReturnModalLoan(loan);
      setWaiveChoice("WAIVE");
      return;
    }
    await executeReturn(loan, false);
  };

  const executeReturn = async (loan: ActiveIssuedLoan, waiveGaramat: boolean) => {
    setProcessing(true);
    try {
      const res = await fetch("/api/admin/library/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: loan.bookBarcode,
          loanId: loan.id,
          confirmRestock: true,
          garamatAction: waiveGaramat ? "WAIVED" : "COLLECTED",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Book Returned & Restocked",
          description: `"${loan.bookTitle}" returned by ${loan.borrowerName}. Volume is now back in stock on shelf.`,
          variant: "success",
        });
        playScannerBeep("success");
        setReturnModalLoan(null);
        // Optimistically update local active list
        setAllActiveLoans((prev) => prev.filter((item) => item.id !== loan.id));
        fetchAllActiveLoans();
        fetchTodaysReturns();
      } else {
        toast({ title: "Return Failed", description: data.error || "Failed to process return", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error processing return", variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  // Select Member
  const selectMember = (m: MemberInfo) => {
    setMember(m);
    setMemberQuery("");
    fetchActiveLoans(m.id);
    toast({
      title: `${m.roleLabel} Selected`,
      description: `${m.name} (${m.className || m.roleLabel}) · ${m.activeLoans}/${m.maxAllowed} volumes borrowed`,
      variant: "success",
    });
    barcodeInputRef.current?.focus();
  };

  const clearMember = () => {
    setMember(null);
    setScannedBooks([]);
    setActiveLoans([]);
    memberSearchInputRef.current?.focus();
  };

  // Fetch active loans for member
  const fetchActiveLoans = async (userId: string) => {
    try {
      const res = await fetch(`/api/admin/library/checkout/active-loans?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setActiveLoans(data.data);
      } else {
        setActiveLoans([]);
      }
    } catch {
      setActiveLoans([]);
    }
  };

  // Delete an issued loan record anytime
  const handleDeleteLoan = async (loanId: string, bookTitle: string) => {
    if (!confirm(`Are you sure you want to delete the issue record for "${bookTitle}"? This will cancel the loan and restore the volume to available inventory.`)) return;
    try {
      const res = await fetch(`/api/admin/library/checkout/loan/${loanId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Loan Record Deleted",
          description: `Issue record for "${bookTitle}" has been deleted and book stock restored.`,
          variant: "default",
        });
        if (member) {
          fetchActiveLoans(member.id);
          setMember((prev) => (prev ? { ...prev, activeLoans: Math.max(0, prev.activeLoans - 1) } : null));
        }
        fetchAllActiveLoans();
      } else {
        toast({ title: "Failed to delete loan", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error deleting loan", variant: "destructive" });
    }
  };

  // Search books by Name / Title / Author / Barcode
  const searchBooksByName = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setBookSearchResults([]);
      setShowBookDropdown(false);
      return;
    }
    setSearchingBooks(true);
    try {
      const res = await fetch(`/api/admin/library/checkout/search-books?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.success) {
        setBookSearchResults(data.data || []);
        setShowBookDropdown((data.data || []).length > 0);
      }
    } catch {
      // Ignore
    } finally {
      setSearchingBooks(false);
    }
  }, []);

  const handleSelectBook = (b: BookInfo) => {
    setSelectedBook(b);
    setScannedBarcode(b.title || b.barcode || "");
    setShowBookDropdown(false);
    toast({
      title: "Book Selected 📖",
      description: `"${b.title}" · ${b.availableCopies} available`,
      variant: "success",
    });
  };

  // ── Handle Checkout ──
  const handleCheckout = async (barcodeToUse?: string, bookNameToUse?: string) => {
    const rawInput = (barcodeToUse || scannedBarcode).trim();
    if (!rawInput && !selectedBook) return;
    if (!member) {
      playScannerBeep("error");
      toast({ title: "No Borrower Selected", description: "Please select or search for a Talabat or Faculty first", variant: "destructive" });
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/admin/library/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: selectedBook?.barcode || rawInput,
          bookName: selectedBook?.title || bookNameToUse || rawInput,
          bookId: selectedBook?.id,
          studentId: member.id,
          issueDate: issueDate.toISOString(),
          dueDate: computedDueDate.toISOString(),
          reminderOneDayBefore,
          reminderDayOfDue,
          sendWhatsApp: sendWhatsAppOnIssue,
        }),
      });

      const data = await res.json();
      if (data.success) {
        playScannerBeep("success");
        const msg = `Issued "${data.data.book.title}" [${data.data.book.barcode || rawInput}] → ${member.name} (${member.className || member.roleLabel})`;
        logAction("checkout", msg);
        toast({
          title: "Book Issued Successfully 📖",
          description: `"${data.data.book.title}" due on ${data.data.dates.dueHijri}`,
          variant: "success",
        });

        setScannedBooks((prev) => [data.data.book, ...prev]);
        setMember((prev) => (prev ? { ...prev, activeLoans: prev.activeLoans + 1 } : null));
        setScannedBarcode("");
        setSelectedBook(null);
        setShowBookDropdown(false);
        fetchAllActiveLoans();

        // If WhatsApp URL is available, provide click-to-open
        if (data.data.whatsAppUrl && !sendWhatsAppOnIssue) {
          window.open(data.data.whatsAppUrl, "_blank");
        }
      } else {
        playScannerBeep("error");
        logAction("error", data.error || "Checkout failed");
        toast({ title: "Issue Failed", description: data.error, variant: "destructive" });
      }
    } catch (err) {
      playScannerBeep("error");
      toast({ title: "Error", description: "Network error during issue", variant: "destructive" });
    } finally {
      setProcessing(false);
      barcodeInputRef.current?.focus();
    }
  };

  // ── Handle Direct Book Inserting & Instant Issue ──
  const handleDirectInsertAndIssue = async () => {
    if (!insertTitle.trim()) {
      toast({ title: "Title Required", description: "Please enter book title to insert into catalog", variant: "destructive" });
      return;
    }
    if (!member) {
      playScannerBeep("error");
      toast({ title: "No Borrower Selected", description: "Please select a Talabat or Faculty recipient first", variant: "destructive" });
      return;
    }

    setInsertingDirectly(true);
    try {
      const res = await fetch("/api/admin/library/checkout/direct-insert-and-issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: insertTitle.trim(),
          author: insertAuthor.trim() || undefined,
          category: insertCategory,
          barcode: insertBarcode.trim() || undefined,
          rackNumber: insertRack.trim() || undefined,
          totalCopies: insertCopies,
          studentId: member.id,
          issueDate: issueDate.toISOString(),
          dueDate: computedDueDate.toISOString(),
          reminderOneDayBefore,
          reminderDayOfDue,
          sendWhatsApp: sendWhatsAppOnIssue,
        }),
      });

      const data = await res.json();
      if (data.success) {
        playScannerBeep("success");
        const msg = `Inserted & Issued "${data.data.book.title}" [${data.data.book.barcode}] → ${member.name} (${member.className || member.roleLabel})`;
        logAction("checkout", msg);
        toast({
          title: "Book Inserted & Issued Successfully! 📖",
          description: `"${data.data.book.title}" registered in catalog and due on ${data.data.dates.dueHijri}`,
          variant: "success",
        });

        setScannedBooks((prev) => [data.data.book, ...prev]);
        setMember((prev) => (prev ? { ...prev, activeLoans: prev.activeLoans + 1 } : null));

        // Reset insert form
        setInsertTitle("");
        setInsertAuthor("");
        setInsertBarcode("");
        setInsertRack("");
        fetchAllActiveLoans();

        if (data.data.whatsAppUrl && !sendWhatsAppOnIssue) {
          window.open(data.data.whatsAppUrl, "_blank");
        }
      } else {
        playScannerBeep("error");
        logAction("error", data.error || "Direct insertion failed");
        toast({ title: "Insert & Issue Failed", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      playScannerBeep("error");
      toast({ title: "Network Error", description: err?.message || "Failed to direct insert and issue", variant: "destructive" });
    } finally {
      setInsertingDirectly(false);
    }
  };

  // ── Handle Return ──
  const handleReturn = async (
    barcodeToUse?: string,
    garamatDecision?: "COLLECTED" | "WAIVED" | "PENDING",
    bookNameToUse?: string,
    loanIdToUse?: string
  ) => {
    const term = (barcodeToUse || scannedBarcode).trim();
    if (!term && !bookNameToUse && !loanIdToUse) return;

    setProcessing(true);
    try {
      const res = await fetch("/api/admin/library/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: term,
          bookName: bookNameToUse || term,
          loanId: loanIdToUse,
          // Put the copy back into circulation immediately so it is available
          // to issue again from Maktabat right after the return.
          confirmRestock: true,
          garamatAction: garamatDecision || "COLLECTED",
        }),
      });

      const data = await res.json();
      if (data.success) {
        playScannerBeep("success");
        setScannedBarcode("");
        setShowReturnDropdown(false);
        setReturnLoanResults([]);

        if (data.data.isLate) {
          setLastOnTimeReturn(null);
          if (!garamatDecision) {
            // Open Garamat settlement dialog (Rate: ₹10/day)
            setPendingReturnGaramat({
              bookTitle: data.data.book.title,
              barcode: data.data.book?.barcode || term,
              borrowerName: data.data.borrower?.name || data.data.loan.studentName,
              darjah: data.data.borrower?.darjah || "Circulation",
              daysLate: data.data.daysLate,
              garamatAmount: data.data.garamat.amount,
              action: "COLLECTED",
              notes: "",
            });
          }
        } else {
          setPendingReturnGaramat(null);
          setLastOnTimeReturn({
            bookTitle: data.data.book.title,
            barcode: data.data.book?.barcode || term,
            borrowerName: data.data.borrower?.name || data.data.loan.studentName,
            borrowedAt: data.data.dates?.borrowedAt,
            dueAt: data.data.dates?.dueAt,
            dueHijri: data.data.dates?.dueHijri,
          });
        }

        const msg = data.data.isLate
          ? `Returned "${data.data.book.title}" (Late by ${data.data.daysLate} days · Garamat: ₹${data.data.garamat.amount})`
          : `Returned "${data.data.book.title}" on time — 0 Garamat assessed`;

        logAction("return", msg);
        toast({
          title: data.data.isLate ? "Book Returned (Late Overdue)" : "Return Confirmed & Restocked",
          description: msg,
          variant: data.data.isLate ? "warning" : "success",
        });

        // Refresh active loans & today's returns summary
        if (member) fetchActiveLoans(member.id);
        fetchAllActiveLoans();
        fetchTodaysReturns();
      } else {
        playScannerBeep("error");
        logAction("error", data.error || "Return failed");
        toast({ title: "Return Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      playScannerBeep("error");
      toast({ title: "Error", description: "Network error during return", variant: "destructive" });
    } finally {
      setProcessing(false);
      barcodeInputRef.current?.focus();
    }
  };

  // Ref holders for latest checkout/return callbacks in global keydown listener
  const handleCheckoutRef = useRef(handleCheckout);
  handleCheckoutRef.current = handleCheckout;
  const handleReturnRef = useRef(handleReturn);
  handleReturnRef.current = handleReturn;

  // ── Global Hardware Barcode Gun Scanner Catch on Circulation Desk ──
  useEffect(() => {
    let scanBuffer = "";
    let lastKeyTime = 0;

    const handleGlobalBarcodeScan = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const isInputFocused =
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable);

      const now = Date.now();
      const timeDiff = now - lastKeyTime;
      lastKeyTime = now;

      if (e.key === "Enter") {
        const barcode = scanBuffer.trim();
        if (barcode.length >= 3) {
          // If scanner gun typed or barcode pattern matched
          if (!isInputFocused || activeEl === barcodeInputRef.current || barcode.startsWith("DB-") || barcode.includes("-") || /^[A-Z0-9]{5,}$/i.test(barcode)) {
            e.preventDefault();
            e.stopPropagation();
            setScannedBarcode(barcode);
            if (mode === "checkout") {
              handleCheckoutRef.current(barcode);
            } else if (mode === "return") {
              handleReturnRef.current(barcode);
            }
            scanBuffer = "";
            return;
          }
        }
        scanBuffer = "";
        return;
      }

      // Barcode scanners type characters with <50ms delays. Reset if deliberate typing pause.
      if (timeDiff > 140 && scanBuffer.length > 0) {
        scanBuffer = "";
      }

      if (e.key.length === 1) {
        scanBuffer += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalBarcodeScan, true);
    return () => window.removeEventListener("keydown", handleGlobalBarcodeScan, true);
  }, [mode]);

  // Keyboard shortcut listener
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (mode === "checkout") handleCheckout();
      else if (mode === "return") handleReturn();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* ── Library Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle={LIBRARY_HUB_TITLE}
        hubDescription={LIBRARY_HUB_DESCRIPTION}
        tabs={LIBRARY_HUB_TABS}
      />

      {/* ── Header Banner ── */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <div className="fatimi-header-banner p-4 sm:p-5">
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-2">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center fatimi-gold-accent shadow-sm shrink-0">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="font-display text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                    Library Circulation &amp; Loans
                  </h1>
                  <p className="text-emerald-100/90 text-xs font-medium mt-0.5">
                    Issue and return books, track active loans, and manage monthly circulation.
                  </p>
                </div>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center rounded-xl border border-white/20 bg-black/20 p-1 backdrop-blur-md shrink-0 flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setMode("checkout")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${mode === "checkout"
                    ? "bg-white text-emerald-900 shadow-sm"
                    : "text-emerald-100 hover:text-white hover:bg-white/10"
                    }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Issue Book</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("issued")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${mode === "issued"
                    ? "bg-white text-emerald-900 shadow-sm"
                    : "text-emerald-100 hover:text-white hover:bg-white/10"
                    }`}
                >
                  <BookMarked className="w-3.5 h-3.5" />
                  <span>Issued Books</span>
                  {allActiveLoans.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-amber-950 shadow-xs">
                      {allActiveLoans.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMode("return")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${mode === "return"
                    ? "bg-white text-emerald-900 shadow-sm"
                    : "text-emerald-100 hover:text-white hover:bg-white/10"
                    }`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Return Book</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMode("return-log")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${mode === "return-log"
                    ? "bg-white text-emerald-900 shadow-sm"
                    : "text-emerald-100 hover:text-white hover:bg-white/10"
                    }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Recent Returns</span>
                  {todayReturnSummary.totalReturnedToday > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-xs">
                      {todayReturnSummary.totalReturnedToday}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setMode("stacking")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${mode === "stacking"
                    ? "bg-amber-400 text-amber-950 shadow-sm"
                    : "text-amber-200 hover:text-white hover:bg-white/10"
                    }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Monthly Records</span>
                </button>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }} />
        </div>
      </motion.div>

      {/* ──────────────────────────────────────────────────────────── */}
      {/* ── WORKSPACE VIEWS                                        ── */}
      {/* ──────────────────────────────────────────────────────────── */}
      {mode === "return-log" ? (
        <ReturnBooksLog onReturnAnother={() => setMode("return")} />
      ) : mode === "issued" ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Bento Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="fatimi-card border-slate-200">
              <div className="fatimi-card-header" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Issued Books</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{allActiveLoans.length}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Volumes actively checked out</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <BookMarked className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="fatimi-card border-amber-200 bg-amber-50/20">
              <div className="fatimi-card-header bg-amber-500" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-900">Thursday Grace (Due Today)</p>
                  <p className="text-2xl font-black text-amber-900 mt-1">{activeLoansStats.thursdayGraceCount}</p>
                  <p className="text-[11px] text-amber-700 mt-0.5">₹0 Garamat assessed on Thursday</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-900 flex items-center justify-center font-bold">
                  <Sparkles className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="fatimi-card border-rose-200 bg-rose-50/20">
              <div className="fatimi-card-header bg-rose-500" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-900">Overdue Books</p>
                  <p className="text-2xl font-black text-rose-900 mt-1">{activeLoansStats.overdueCount}</p>
                  <p className="text-[11px] text-rose-700 mt-0.5">Past due (₹10/day fine applies)</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center font-bold">
                  <AlertTriangle className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card className="fatimi-card border-slate-200">
              <div className="fatimi-card-header" />
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Returned Today</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{todayReturnSummary.totalReturnedToday}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Volumes restocked on shelf</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Control Bar: Multi-axis filter ribbon, view switch & instant search */}
          <Card className="fatimi-card">
            <div className="fatimi-card-header" />
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={issuedSearchQuery}
                    onChange={(e) => setIssuedSearchQuery(e.target.value)}
                    placeholder="Search by Student Name, ITS, TR No., Book Title, Barcode, or Parent..."
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none bg-slate-50/70 text-slate-900 placeholder:text-slate-400"
                  />
                  {issuedSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setIssuedSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* View Mode & Quick Action Buttons */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIssuedViewMode("table")}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${issuedViewMode === "table" ? "bg-white text-emerald-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                        }`}
                      title="Table View"
                    >
                      <List className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIssuedViewMode("grid")}
                      className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${issuedViewMode === "grid" ? "bg-white text-emerald-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
                        }`}
                      title="Card Grid View"
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </button>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={fetchAllActiveLoans}
                    disabled={loadingActiveLoans}
                    className="rounded-xl border-slate-200 text-xs font-bold flex items-center gap-1.5"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${loadingActiveLoans ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setMode("checkout")}
                    className="rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Issue New Book</span>
                  </Button>
                </div>
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                {[
                  { id: "ALL", label: `All Issued (${allActiveLoans.filter((l) => !l.isReturned && l.status !== "RETURNED").length})` },
                  { id: "OVERDUE", label: `Overdue (${activeLoansStats.overdueCount})` },
                  { id: "DUE_TODAY", label: `Due Today / Grace (${activeLoansStats.thursdayGraceCount})` },
                  { id: "RETURNED", label: "Past Returns" },
                  { id: "DARJAH_1", label: "Darajah 1" },
                  { id: "DARJAH_2", label: "Darajah 2" },
                  { id: "DARJAH_3", label: "Darajah 3" },
                  { id: "DARJAH_4", label: "Darajah 4" },
                  { id: "FACULTY", label: "Faculty" },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setIssuedFilter(pill.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer border transition-all ${issuedFilter === pill.id
                      ? "bg-emerald-800 text-white border-emerald-900 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Issued Books Presentation: Table or Card Grid */}
          {issuedViewMode === "table" ? (
            <Card className="fatimi-card overflow-hidden shadow-xs">
              <div className="fatimi-card-header" />
              <CardHeader className="pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-800" />
                  <CardTitle className="text-base text-slate-800 font-bold">
                    All Issued Volume Circulations ({filteredActiveLoans.length})
                  </CardTitle>
                </div>
                <p className="text-xs text-slate-500 font-medium hidden sm:block">
                  Displaying {filteredActiveLoans.length} of {allActiveLoans.length} total records &bull; 1-click return replenishes book inventory
                </p>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead className="bg-slate-50/90 border-b border-slate-200 text-[11px] uppercase tracking-wider font-extrabold text-slate-600">
                    <tr>
                      <th className="py-3 px-4">Borrower (Student / Faculty)</th>
                      <th className="py-3 px-4">Book Details &amp; Location</th>
                      <th className="py-3 px-4">Circulation Dates</th>
                      <th className="py-3 px-4">Status &amp; Garamat</th>
                      <th className="py-3 px-4 text-right">Circulation Flow</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {loadingActiveLoans ? (
                      <tr>
                        <td colSpan={5} className="py-16 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Loader2 className="w-7 h-7 animate-spin text-emerald-700" />
                            <p className="text-xs font-semibold text-slate-600">Loading issued circulations with member profiles...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredActiveLoans.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-16 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <BookX className="w-9 h-9 text-slate-300" />
                            <p className="text-sm font-bold text-slate-700">No matching issued books found</p>
                            <p className="text-xs text-slate-400">Try adjusting your search query or filter tab</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredActiveLoans.map((loan) => (
                        <tr key={loan.id} className="hover:bg-amber-50/20 transition-colors">
                          {/* 1. Borrower with Profile Photo */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-start gap-3">
                              <div className="relative shrink-0">
                                <ProfilePhoto
                                  src={loan.borrowerPhoto || loan.photo}
                                  alt={loan.borrowerName}
                                  className="w-10 h-10 rounded-full border-2 border-amber-400/60 object-cover shadow-2xs bg-slate-100"
                                />
                                {loan.borrowerRole === "FACULTY" && (
                                  <span className="absolute -bottom-1 -right-1 bg-purple-700 text-white text-[9px] font-bold px-1 rounded-full">
                                    F
                                  </span>
                                )}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="font-bold text-slate-900 leading-snug">{loan.borrowerName}</p>
                                  <span
                                    className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-bold border ${loan.borrowerRole === "FACULTY"
                                      ? "bg-purple-50 text-purple-800 border-purple-200"
                                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                      }`}
                                  >
                                    {loan.darjah}
                                  </span>
                                </div>
                                {loan.borrowerAr && (
                                  <p className="text-[11px] text-emerald-800 font-arabic font-medium mt-0.5" dir="rtl">
                                    {loan.borrowerAr}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono flex-wrap">
                                  {loan.its && (
                                    <span className="bg-slate-100 px-1 rounded border border-slate-200">
                                      ITS: {loan.its}
                                    </span>
                                  )}
                                  {loan.trNo && (
                                    <span className="bg-slate-100 px-1 rounded border border-slate-200">
                                      TR: {loan.trNo}
                                    </span>
                                  )}
                                  {loan.parentPhone && loan.whatsAppUrl && (
                                    <a
                                      href={loan.whatsAppUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title="WhatsApp Notification"
                                      className="inline-flex items-center gap-0.5 text-emerald-700 hover:text-emerald-900 font-sans font-bold hover:underline"
                                    >
                                      <MessageSquare className="w-2.5 h-2.5" />
                                      <span>WA</span>
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Book Title & Barcode */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="flex items-start gap-2.5">
                              <div className="w-8 h-10 rounded bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 shrink-0 mt-0.5">
                                <BookOpen className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 leading-snug">{loan.bookTitle}</p>
                                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                    {loan.bookBarcode}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                    {loan.category}
                                  </span>
                                  {loan.rackNumber && (
                                    <span className="text-[10px] text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                      Shelf {loan.rackNumber}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 3. Circulation Dates (En & Hijri) */}
                          <td className="py-3.5 px-4 align-top">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-[11px] text-slate-600">
                                <span className="font-semibold text-slate-400 w-8">Out:</span>
                                <span className="font-medium text-slate-700">{loan.borrowedDateEn}</span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-900">
                                <span className="font-semibold text-slate-400 w-8">Due:</span>
                                <span>{loan.dueDateEn}</span>
                              </div>
                              <p className="text-[10px] text-emerald-800 font-medium">
                                {loan.dueDateHijri}
                              </p>
                            </div>
                          </td>

                          {/* 4. Status & Garamat */}
                          <td className="py-3.5 px-4 align-top">
                            {loan.isReturned ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200">
                                  <CheckCircle2 className="w-3 h-3 text-slate-500 shrink-0" />
                                  <span>Returned &middot; In Stock</span>
                                </span>
                                {loan.returnedAt && (
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    {new Date(loan.returnedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                                  </p>
                                )}
                              </div>
                            ) : loan.isThursdayGrace ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-300">
                                  <Sparkles className="w-3 h-3 text-amber-600 shrink-0" />
                                  <span>Thursday Grace (Due Today)</span>
                                </span>
                                <p className="text-[10px] text-amber-800 font-medium">
                                  ₹0 Garamat &bull; Weekly Grace Active
                                </p>
                              </div>
                            ) : loan.isOverdue ? (
                              <div className="space-y-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-950 border border-rose-300">
                                  <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                  <span>Overdue by {loan.daysOverdue} {loan.daysOverdue === 1 ? "day" : "days"}</span>
                                </span>
                                <p className="text-[11px] font-extrabold text-rose-700">
                                  Garamat: ₹{loan.garamatAmount}
                                </p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-950 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>Active / On Time</span>
                              </span>
                            )}
                          </td>

                          {/* 5. Circulation Flow Actions */}
                          <td className="py-3.5 px-4 align-top text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!loan.isReturned ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleQuickReturnFromIssued(loan)}
                                  disabled={processing}
                                  className="h-7 px-3 rounded-lg text-[11px] font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                                  title="Check book back in and restock into inventory"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Return to Stock</span>
                                </Button>
                              ) : (
                                <span className="text-[10px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                                  Restocked
                                </span>
                              )}

                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteLoan(loan.id, loan.bookTitle)}
                                className="h-7 w-7 p-0 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="Delete circulation record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            /* Visual Card Grid View */
            <div>
              {loadingActiveLoans ? (
                <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                  <Loader2 className="w-8 h-8 animate-spin text-emerald-700 mx-auto" />
                  <p className="text-xs font-semibold text-slate-600 mt-2">Loading issued cards...</p>
                </div>
              ) : filteredActiveLoans.length === 0 ? (
                <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
                  <BookX className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700 mt-2">No matching issued books found</p>
                  <p className="text-xs text-slate-400">Try adjusting your filters or search query</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredActiveLoans.map((loan) => (
                    <Card
                      key={loan.id}
                      className="fatimi-card overflow-hidden border border-slate-200/90 shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
                    >
                      <div className="fatimi-card-header" />
                      <CardContent className="p-4 space-y-3">
                        {/* Member Row */}
                        <div className="flex items-start gap-3">
                          <ProfilePhoto
                            src={loan.borrowerPhoto || loan.photo}
                            alt={loan.borrowerName}
                            className="w-12 h-12 rounded-full border-2 border-amber-400/70 object-cover shrink-0 shadow-xs bg-slate-100"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-bold text-slate-900 text-sm leading-tight truncate">
                                {loan.borrowerName}
                              </h4>
                              <span
                                className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${loan.borrowerRole === "FACULTY"
                                  ? "bg-purple-50 text-purple-800 border-purple-200"
                                  : "bg-emerald-50 text-emerald-800 border-emerald-200"
                                  }`}
                              >
                                {loan.darjah}
                              </span>
                            </div>
                            {loan.borrowerAr && (
                              <p className="text-xs text-emerald-800 font-arabic font-medium mt-0.5" dir="rtl">
                                {loan.borrowerAr}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-mono">
                              {loan.its && <span>ITS: {loan.its}</span>}
                              {loan.trNo && <span>&bull; TR: {loan.trNo}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Book Info Block */}
                        <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/70 space-y-1.5">
                          <div className="flex items-start gap-2">
                            <BookOpen className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                                {loan.bookTitle}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span className="font-mono text-[10px] font-bold px-1.5 py-0.2 rounded bg-white text-slate-800 border border-slate-200">
                                  {loan.bookBarcode}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium">
                                  {loan.category}
                                </span>
                                {loan.rackNumber && (
                                  <span className="text-[10px] text-amber-800 font-bold ml-auto">
                                    Shelf {loan.rackNumber}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Dates & Status Strip */}
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase font-bold block">Circulation</span>
                            <span className="text-[11px] font-semibold text-slate-700">
                              {loan.borrowedDateEn} &rarr; {loan.dueDateEn}
                            </span>
                            <span className="text-[10px] text-emerald-800 font-medium block">
                              {loan.dueDateHijri}
                            </span>
                          </div>

                          <div className="text-right">
                            {loan.isReturned ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                <CheckCircle2 className="w-3 h-3 text-slate-500" />
                                <span>Returned</span>
                              </span>
                            ) : loan.isThursdayGrace ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-950 border border-amber-300">
                                <Sparkles className="w-3 h-3 text-amber-600" />
                                <span>Thursday Grace</span>
                              </span>
                            ) : loan.isOverdue ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-950 border border-rose-300">
                                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                                  <span>{loan.daysOverdue}d Overdue</span>
                                </span>
                                <p className="text-[10px] font-black text-rose-700 mt-0.5">₹{loan.garamatAmount}</p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-950 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>Active</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2">
                          {!loan.isReturned ? (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleQuickReturnFromIssued(loan)}
                              disabled={processing}
                              className="flex-1 h-8 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Return to Stock</span>
                            </Button>
                          ) : (
                            <div className="flex-1 h-8 rounded-xl bg-slate-50 border border-slate-200 text-slate-400 font-bold text-xs flex items-center justify-center">
                              Restocked
                            </div>
                          )}

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteLoan(loan.id, loan.bookTitle)}
                            className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                            title="Delete loan record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Overdue Garamat Settlement Modal */}
          {returnModalLoan && (
            <Modal open={Boolean(returnModalLoan)} onOpenChange={(open) => !open && setReturnModalLoan(null)}>
              <ModalContent className="max-w-md p-6">
                <ModalHeader>
                  <ModalTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    <span>Overdue Garamat Settlement</span>
                  </ModalTitle>
                  <ModalDescription className="text-xs text-slate-500">
                    This book is overdue by {returnModalLoan.daysOverdue} days. Choose how to handle the accrued garamat fine before restocking.
                  </ModalDescription>
                </ModalHeader>

                <div className="space-y-4 my-4">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Borrower:</span>
                      <span className="font-bold text-slate-800">{returnModalLoan.borrowerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Book:</span>
                      <span className="font-bold text-slate-800">{returnModalLoan.bookTitle}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Barcode:</span>
                      <span className="font-mono font-bold text-slate-800">{returnModalLoan.bookBarcode}</span>
                    </div>
                    <div className="flex justify-between border-t border-amber-200/80 pt-1 mt-1 text-sm">
                      <span className="font-bold text-rose-700">Calculated Garamat:</span>
                      <span className="font-black text-rose-700">₹{returnModalLoan.garamatAmount}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700">Select Settlement Action:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWaiveChoice("WAIVE")}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${waiveChoice === "WAIVE"
                          ? "bg-emerald-50 border-emerald-600 text-emerald-950 font-bold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                          <Check className="w-3.5 h-3.5" />
                          <span>Waive Fine (₹0)</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Special permission or approved grace</p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWaiveChoice("COLLECT")}
                        className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${waiveChoice === "COLLECT"
                          ? "bg-rose-50 border-rose-600 text-rose-950 font-bold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>Collect (₹{returnModalLoan.garamatAmount})</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">Cash received from member</p>
                      </button>
                    </div>
                  </div>
                </div>

                <ModalFooter className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setReturnModalLoan(null)}
                    disabled={processing}
                    className="h-9 rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={async () => {
                      const loan = returnModalLoan;
                      const waive = waiveChoice === "WAIVE";
                      setReturnModalLoan(null);
                      await executeReturn(loan, waive);
                    }}
                    disabled={processing}
                    className="h-9 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-2xs"
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Confirm & Return to Stock"
                    )}
                  </Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
          )}
        </motion.div>
      ) : mode !== "stacking" ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Workspace (Left 2 cols) */}
          <div className="lg:col-span-2 space-y-6">
            {/* ── 1. Borrower / Member Selection (Issue Mode) ── */}
            {mode === "checkout" && (
              <Card className="fatimi-card">
                <div className="fatimi-card-header" />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                      <User className="w-5 h-5 text-emerald-700" />
                      <span>Select Recipient: Talabat or Faculty</span>
                    </CardTitle>
                    {member && (
                      <Button variant="ghost" size="sm" onClick={clearMember} className="text-rose-600 hover:bg-rose-50 text-xs font-bold">
                        <XCircle className="w-4 h-4 mr-1" /> Change Borrower
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {member ? (
                    /* Selected Member Details Card */
                    <div className="space-y-3 w-full min-w-0 max-w-full">
                      <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-50/60 p-4 sm:p-5 shadow-xs w-full min-w-0 max-w-full overflow-hidden">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
                          <div className="flex items-center gap-3.5 sm:gap-4 min-w-0 flex-1">
                            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-emerald-600 shadow-sm shrink-0 bg-white">
                              {member.photo || member.avatarUrl ? (
                                <ProfilePhoto
                                  src={member.photo || member.avatarUrl}
                                  alt={member.name}
                                  className="w-full h-full rounded-2xl"
                                  fit="cover"
                                  previewable={true}
                                />
                              ) : (
                                <div className="w-full h-full bg-emerald-700 text-white font-extrabold text-xl flex items-center justify-center">
                                  {member.firstName[0]}{member.lastName[0]}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight font-display">{member.name}</h3>
                                {member.nameAr && <span className="font-arabic font-alkanz text-sm text-emerald-800 font-bold tracking-normal" dir="rtl" lang="ar">{member.nameAr}</span>}
                                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-800 text-white shrink-0">
                                  {member.roleLabel}
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 mt-1 font-medium">
                                <span className="font-bold text-slate-800">{member.className || member.roleLabel}</span> &middot; ITS: <span className="font-mono font-bold text-slate-900 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">{member.its || "—"}</span>
                                {member.trNo && <> &middot; TR No: <span className="font-mono font-bold text-slate-900">{member.trNo}</span></>}
                              </p>
                              {member.parentName && (
                                <p className="text-[11px] text-slate-600 mt-1.5 flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-700">Parent Assigned:</span>
                                  <span className="text-slate-900 font-medium">{member.parentName}</span>
                                  {member.parentPhone && (
                                    <span className="font-mono text-emerald-800 font-bold bg-white/70 px-1.5 py-0.2 rounded border border-emerald-200">({member.parentPhone})</span>
                                  )}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Loans Badge & Allowance */}
                          <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-1.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-emerald-200/60">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold border shadow-2xs ${member.activeLoans >= member.maxAllowed
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : member.activeLoans > 0
                                ? "bg-amber-50 text-amber-800 border-amber-200"
                                : "bg-emerald-50 text-emerald-800 border-emerald-200"
                              }`}>
                              <BookOpen className="w-3.5 h-3.5" />
                              {member.activeLoans} / {member.maxAllowed} Active Volumes
                            </span>
                            {member.hasOverdue && (
                              <span className="text-[10.5px] font-bold text-rose-700 bg-rose-100/90 border border-rose-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                <span>Has Overdue Loans Pending</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Currently Issued Books for this Borrower (Admin can return or delete anytime) */}
                      <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <BookOpen className="w-4 h-4 text-emerald-700" />
                            <span>Currently Issued Books ({activeLoans.length}):</span>
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Admin can Return or Delete anytime
                          </span>
                        </div>

                        {activeLoans.length === 0 ? (
                          <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                            No books currently borrowed. This borrower has 0 active loans.
                          </p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {activeLoans.map((loan) => (
                              <div
                                key={loan.id}
                                className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-emerald-300 transition-all flex items-center justify-between gap-2.5 shadow-2xs"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="font-extrabold text-xs text-slate-900 truncate">{loan.bookTitle}</p>
                                  <p className="text-[10.5px] text-slate-500 font-mono">
                                    {loan.barcode ? `Barcode: ${loan.barcode}` : "Catalog Volume"}
                                  </p>
                                  <p className="text-[10px] text-slate-600 mt-0.5">
                                    Due: {new Date(loan.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    {loan.isOverdue && <span className="text-rose-600 font-black ml-1.5">(OVERDUE)</span>}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => handleReturn(loan.barcode || loan.bookTitle, undefined, loan.bookTitle, loan.id)}
                                    className="h-8 px-2.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg cursor-pointer"
                                  >
                                    Return
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleDeleteLoan(loan.id, loan.bookTitle)}
                                    className="h-8 px-2 text-xs border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 font-bold rounded-lg cursor-pointer flex items-center gap-1"
                                    title="Delete this issued loan record anytime"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Delete</span>
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Member Search & Selection Interface */
                    <div className="space-y-4">
                      {/* Recipient Role Toggle */}
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100 p-1">
                          <button
                            type="button"
                            onClick={() => { setRecipientType("talabat"); setSelectedDarjah("all"); setSelectedSection("all"); }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${recipientType === "talabat"
                              ? "bg-white text-emerald-800 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                              }`}
                          >
                            Talabat (Students)
                          </button>
                          <button
                            type="button"
                            onClick={() => { setRecipientType("faculty"); setSelectedDept("all"); }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${recipientType === "faculty"
                              ? "bg-white text-emerald-800 shadow-xs"
                              : "text-slate-600 hover:text-slate-900"
                              }`}
                          >
                            Faculty / Asateez
                          </button>
                        </div>

                        {/* Quick Darjah / Department Filter Ribbon */}
                        {recipientType === "talabat" ? (
                          <div className="flex flex-col gap-2 w-full">
                            {/* Darajah Toggle Strip with Live Counts */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                              {DARJAH_OPTIONS.map((opt) => {
                                const count = darjahCounts[opt.id] ?? 0;
                                const isSelected = selectedDarjah === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedDarjah(opt.id);
                                      setSelectedSection("all");
                                    }}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer border flex items-center gap-1.5 transition-all shadow-2xs ${isSelected
                                      ? "bg-emerald-800 text-white border-emerald-900 ring-2 ring-emerald-500/30 scale-[1.02]"
                                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                                      }`}
                                  >
                                    <span>{opt.label}</span>
                                    <span
                                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${isSelected
                                        ? "bg-emerald-700 text-emerald-100"
                                        : "bg-slate-100 text-slate-600"
                                        }`}
                                    >
                                      {count}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            {/* Section Sub-Toggles (when Darajah is active: e.g. 2 A, 2 B) */}
                            {selectedDarjah !== "all" && Object.keys(sectionCounts).length > 1 && (
                              <div className="flex items-center gap-1.5 overflow-x-auto pl-1">
                                <span className="text-[11px] font-bold text-slate-400 shrink-0">Section:</span>
                                <button
                                  type="button"
                                  onClick={() => setSelectedSection("all")}
                                  className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${selectedSection === "all"
                                    ? "bg-slate-900 text-white border-slate-900"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-white"
                                    }`}
                                >
                                  All ({sectionCounts.all || 0})
                                </button>
                                {Object.entries(sectionCounts)
                                  .filter(([sec]) => sec !== "all")
                                  .map(([sec, count]) => (
                                    <button
                                      key={sec}
                                      type="button"
                                      onClick={() => setSelectedSection(sec)}
                                      className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${selectedSection === sec
                                        ? "bg-emerald-700 text-white border-emerald-800"
                                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-white"
                                        }`}
                                    >
                                      Section {sec} ({count})
                                    </button>
                                  ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                            <button
                              type="button"
                              onClick={() => setSelectedDept("all")}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 cursor-pointer border ${selectedDept === "all"
                                ? "bg-emerald-800 text-white border-emerald-900"
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                              All Departments ({allFaculty.length})
                            </button>
                            {availableDepts.slice(0, 5).map((d) => (
                              <button
                                key={d.department}
                                type="button"
                                onClick={() => setSelectedDept(d.department)}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 cursor-pointer border ${selectedDept === d.department
                                  ? "bg-emerald-800 text-white border-emerald-900"
                                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                                  }`}
                              >
                                {d.department} ({d.count})
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Status / Showing Header */}
                      <div className="flex items-center justify-between text-xs text-slate-500 px-1 pt-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800">
                            {recipientType === "talabat"
                              ? selectedDarjah === "all"
                                ? `Showing All Talabat (${memberResults.length} of ${allTalabat.length} loaded)`
                                : `Showing Darajah ${selectedDarjah} Talabat (${memberResults.length} of ${darjahCounts[selectedDarjah] || 0} students)`
                              : `Showing Faculty Members (${memberResults.length} of ${allFaculty.length})`}
                          </span>
                          {memberQuery && (
                            <span className="text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              matching &ldquo;{memberQuery}&rdquo;
                            </span>
                          )}
                        </div>

                        {memberQuery && (
                          <button
                            type="button"
                            onClick={() => setMemberQuery("")}
                            className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline cursor-pointer"
                          >
                            Clear search to show all {selectedDarjah === "all" ? allTalabat.length : (darjahCounts[selectedDarjah] || 0)}
                          </button>
                        )}
                      </div>

                      {/* Quick Pick 1-Tap Chip Strip */}
                      {memberResults.length > 0 && (
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 max-w-full">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 shrink-0">
                            Quick Pick:
                          </span>
                          {memberResults.slice(0, 8).map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => selectMember(m)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 shrink-0 transition-colors cursor-pointer"
                            >
                              <span>{m.firstName}</span>
                              {m.grade && <span className="text-[10px] text-emerald-700 font-bold">D{m.grade}</span>}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Search Bar with 0ms Instant Match & Enter Key Catch */}
                      <div className="relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          ref={memberSearchInputRef}
                          type="text"
                          value={memberQuery}
                          onChange={(e) => setMemberQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && memberResults.length > 0) {
                              e.preventDefault();
                              selectMember(memberResults[0]);
                            }
                          }}
                          placeholder={`Search ${recipientType === "talabat" ? `all ${allTalabat.length} Talabat by First Name, Last Name, Arabic Name, ITS, or Class...` : "Faculty by Name, Department, or ITS"}...`}
                          className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none bg-slate-50/70 text-slate-900 placeholder:text-slate-400"
                        />
                        {loadingMemberCache && (
                          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-emerald-600" />
                        )}
                      </div>

                      {/* Member Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 sm:max-h-[30rem] overflow-y-auto pr-1">
                        {memberResults.length === 0 ? (
                          <div className="col-span-full py-8 text-center space-y-2 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                            <Users className="w-8 h-8 text-slate-300 mx-auto" />
                            <p className="text-xs font-semibold text-slate-600">
                              No {recipientType === "talabat" ? "talabat" : "faculty"} found matching &ldquo;{memberQuery}&rdquo;
                              {selectedDarjah !== "all" && ` in Darajah ${selectedDarjah}`}
                            </p>
                            {selectedDarjah !== "all" && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedDarjah("all");
                                  setSelectedSection("all");
                                }}
                                className="text-xs h-8 font-bold border-emerald-300 text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                              >
                                Search across All Darajahs ({allTalabat.length} Talabat)
                              </Button>
                            )}
                          </div>
                        ) : (
                          memberResults.map((m) => (
                            <div
                              key={m.id}
                              onClick={() => selectMember(m)}
                              className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-500 hover:bg-emerald-50/40 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs group"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {m.photo || m.avatarUrl ? (
                                  <img
                                    src={m.photo || m.avatarUrl!}
                                    alt={m.name}
                                    className="w-10 h-10 rounded-xl object-cover border border-emerald-300 shrink-0"
                                    onError={(e) => {
                                      (e.currentTarget as HTMLElement).style.display = "none";
                                      const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                                      if (fallback) fallback.style.display = "flex";
                                    }}
                                  />
                                ) : null}
                                <div
                                  className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center justify-center shrink-0"
                                  style={{ display: m.photo || m.avatarUrl ? "none" : "flex" }}
                                >
                                  {m.firstName ? m.firstName[0] : ""}{m.lastName ? m.lastName[0] : ""}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-bold text-xs text-slate-900 truncate group-hover:text-emerald-900">{m.name}</p>
                                    {m.nameAr && (
                                      <span className="text-[10px] text-emerald-700 font-arabic truncate hidden sm:inline" dir="rtl">
                                        {m.nameAr}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    <span className="font-semibold text-slate-700">{m.className || m.roleLabel}</span> &middot; ITS: <span className="font-mono">{m.its || m.trNo || m.studentId}</span>
                                  </p>
                                  {m.parentName && (
                                    <p className="text-[10px] text-slate-400 truncate">P: {m.parentName}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${m.activeLoans >= m.maxAllowed ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"
                                  }`}>
                                  {m.activeLoans}/{m.maxAllowed}
                                </span>
                                <span className="text-[9px] text-emerald-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                                  Pick &rarr;
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ── 2. Fast Barcode Scanner, Manual Book Search & Direct Insert Terminal ── */}
            <Card className="fatimi-card">
              <div className="fatimi-card-header" />
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                    <Scan className="w-5 h-5 text-emerald-700" />
                    <span>
                      {mode === "checkout"
                        ? "Issue Book: Dual Scan, Search by Name, or Direct Insert"
                        : "Scan Book Barcode for Return & Garamat"}
                    </span>
                  </CardTitle>

                  {/* Mode Selector & Fast Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {mode === "checkout" && (
                      <div className="flex bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 text-xs">
                        {/* Tab 1: Dual Scan */}
                        <button
                          type="button"
                          onClick={() => {
                            setBookInputMode("scan");
                            setTimeout(() => barcodeInputRef.current?.focus(), 50);
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                            bookInputMode === "scan"
                              ? "bg-white text-emerald-900 shadow-xs border border-emerald-200"
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <Barcode className="w-3.5 h-3.5 text-emerald-700" />
                          <span>⚡ Dual Scan</span>
                        </button>

                        {/* Tab 2: Manual Book Name */}
                        <button
                          type="button"
                          onClick={() => {
                            setBookInputMode("search");
                            setTimeout(() => barcodeInputRef.current?.focus(), 50);
                          }}
                          className={cn(
                            "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                            bookInputMode === "search"
                              ? "bg-white text-emerald-900 shadow-xs border border-emerald-200"
                              : "text-slate-600 hover:text-slate-900"
                          )}
                        >
                          <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                          <span>📖 Manual Book Name</span>
                        </button>

                        {/* Tab 3: Direct Insert & Issue */}
                        <button
                          type="button"
                          onClick={() => setBookInputMode("insert")}
                          className={cn(
                            "px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                            bookInputMode === "insert"
                              ? "bg-emerald-800 text-white shadow-xs"
                              : "text-emerald-800 hover:bg-emerald-50"
                          )}
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Insert &amp; Issue</span>
                        </button>
                      </div>
                    )}

                    {/* Camera Scanner Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowScanModal(true)}
                      className="text-xs rounded-xl border-slate-200 hover:bg-slate-50 font-medium"
                    >
                      <Scan className="w-3.5 h-3.5 mr-1 text-emerald-700" />
                      Camera Scanner
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Selected Book Banner */}
                {selectedBook && bookInputMode !== "insert" && (
                  <div className="p-3 bg-emerald-50/90 border border-emerald-300 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                        <BookOpen className="w-5 h-5 text-emerald-700" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs text-emerald-950 truncate">{selectedBook.title}</p>
                        <p className="text-[11px] text-emerald-700 truncate">
                          {selectedBook.author ? `By ${selectedBook.author}` : "Author unlisted"} · Barcode:{" "}
                          <span className="font-mono font-bold">{selectedBook.barcode || "N/A"}</span> ·{" "}
                          <span className="font-bold text-emerald-800">{selectedBook.availableCopies} copy available</span>
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedBook(null);
                        setScannedBarcode("");
                        setShowBookDropdown(false);
                      }}
                      className="text-xs text-slate-500 hover:text-rose-600 h-7 px-2"
                    >
                      Clear
                    </Button>
                  </div>
                )}

                {/* ── MODE 1 & 2: SCAN OR MANUAL SEARCH ── */}
                {bookInputMode !== "insert" ? (
                  <div className="relative">
                    {/* Input Label / Hint */}
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <span className="text-slate-600 font-medium">
                        {bookInputMode === "scan"
                          ? "⚡ Scan barcode with USB Wedge scanner or type barcode below:"
                          : "📖 Search book title or author from library catalog:"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setBookInputMode("insert")}
                        className="text-emerald-700 hover:text-emerald-900 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Book not in catalog? Insert &amp; Issue</span>
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        {bookInputMode === "search" ? (
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600" />
                        ) : (
                          <Barcode className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        )}
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          value={scannedBarcode}
                          onChange={(e) => {
                            const val = e.target.value;
                            setScannedBarcode(val);
                            if (mode === "checkout") {
                              searchBooksByName(val);
                            } else if (mode === "return") {
                              searchReturnLoansByName(val);
                            }
                          }}
                          onFocus={() => {
                            if (mode === "checkout" && scannedBarcode.trim().length >= 2) {
                              searchBooksByName(scannedBarcode);
                            } else if (mode === "return" && scannedBarcode.trim().length >= 2) {
                              searchReturnLoansByName(scannedBarcode);
                            }
                          }}
                          onKeyDown={handleKeyDown}
                          placeholder={
                            mode === "checkout"
                              ? bookInputMode === "search"
                                ? "Type Book Name or Author (e.g. Nahjul Balagha, Lisaan, Science)..."
                                : "Scan Barcode (e.g. 04-AL-KITAAB) or enter book name..."
                              : "Scan barcode or type book name to return (e.g. Nahjul Balagha)..."
                          }
                          className="w-full rounded-xl border-2 border-emerald-600/40 pl-11 pr-10 py-3 text-base font-medium focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 outline-none bg-white text-slate-900"
                          disabled={mode === "checkout" && !member}
                        />
                        {searchingBooks && (
                          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-emerald-600" />
                        )}
                      </div>

                      <Button
                        onClick={() => {
                          if (mode === "checkout") handleCheckout();
                          else handleReturn(scannedBarcode, undefined, scannedBarcode);
                        }}
                        disabled={!scannedBarcode.trim() || processing || (mode === "checkout" && !member)}
                        className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-6 rounded-xl shadow-xs shrink-0 cursor-pointer"
                      >
                        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === "checkout" ? "Issue Book" : "Return Book"}
                      </Button>
                    </div>

                    {/* Return Mode: Matching Active Loans by Book Name Dropdown */}
                    {mode === "return" && showReturnDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-emerald-200 shadow-xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-slate-100">
                        <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                          <span>Active Loans Matching Book Name ({returnLoanResults.length})</span>
                          <span className="text-[10px] text-slate-400">Click to return directly</span>
                        </div>

                        {returnLoanResults.length === 0 ? (
                          <div className="p-4 text-center">
                            <p className="text-xs text-slate-500">No active loans found matching "{scannedBarcode}". You can still click "Return Book" to search catalog.</p>
                          </div>
                        ) : (
                          returnLoanResults.map((l) => (
                            <div
                              key={l.loanId}
                              onClick={() => handleReturn(l.barcode || l.bookTitle, undefined, l.bookTitle, l.loanId)}
                              className="p-3 hover:bg-emerald-50/70 cursor-pointer transition-colors flex items-center justify-between gap-3 text-left"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                                  <BookOpen className="w-5 h-5 text-emerald-700" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-xs text-slate-900 truncate">{l.bookTitle}</p>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    Borrowed by <strong className="text-slate-800">{l.borrowerName}</strong> &middot; Barcode:{" "}
                                    <span className="font-mono font-bold">{l.barcode || "N/A"}</span>
                                  </p>
                                  <p className="text-[10px] text-slate-400">
                                    Due: {new Date(l.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    {l.isOverdue && <span className="text-rose-600 font-bold ml-1">(OVERDUE)</span>}
                                  </p>
                                </div>
                              </div>

                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReturn(l.barcode || l.bookTitle, undefined, l.bookTitle, l.loanId);
                                }}
                                className="h-7 text-xs px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold shrink-0"
                              >
                                Return This Volume
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Interactive Book Search Dropdown Results */}
                    {showBookDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white rounded-xl border border-emerald-200 shadow-xl overflow-hidden max-h-80 overflow-y-auto divide-y divide-slate-100">
                        <div className="px-3 py-1.5 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                          <span>Matching Books in Catalog ({bookSearchResults.length})</span>
                          <span className="text-[10px] text-slate-400">Click a book or Checkout</span>
                        </div>

                        {bookSearchResults.length === 0 ? (
                          <div className="p-4 text-center">
                            <p className="text-xs text-slate-500 mb-2">No matching books found for "{scannedBarcode}".</p>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => {
                                setInsertTitle(scannedBarcode);
                                setBookInputMode("insert");
                                setShowBookDropdown(false);
                              }}
                              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg"
                            >
                              <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                              Insert "{scannedBarcode}" &amp; Issue Directly
                            </Button>
                          </div>
                        ) : (
                          bookSearchResults.map((b) => (
                            <div
                              key={b.id}
                              onClick={() => handleSelectBook(b)}
                              className="p-3 hover:bg-emerald-50/70 cursor-pointer transition-colors flex items-center justify-between gap-3 text-left"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                                  <BookOpen className="w-5 h-5 text-emerald-700" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-bold text-xs text-slate-900 truncate">{b.title}</p>
                                  <p className="text-[11px] text-slate-500 truncate">
                                    {b.author ? `By ${b.author}` : "Author unlisted"} · Category:{" "}
                                    <span className="font-medium text-slate-700">{b.category || "General"}</span>
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    Barcode: {b.barcode || "N/A"} {b.rackNumber ? `· Rack: ${b.rackNumber}` : ""}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span
                                  className={cn(
                                    "text-[10.5px] font-bold px-2 py-0.5 rounded-full",
                                    b.availableCopies > 0
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-rose-100 text-rose-800"
                                  )}
                                >
                                  {b.availableCopies > 0 ? `${b.availableCopies} Available` : "Checked Out"}
                                </span>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={b.availableCopies < 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectBook(b);
                                    if (member) {
                                      handleCheckout(b.barcode || b.title, b.title);
                                    }
                                  }}
                                  className="h-7 text-xs px-2.5 rounded-lg border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-bold"
                                >
                                  Issue Now
                                </Button>
                              </div>
                            </div>
                          ))
                        )}

                        {/* Bottom Banner to Insert New Book */}
                        <div className="p-2.5 bg-emerald-50/50 flex items-center justify-between text-xs">
                          <span className="text-slate-600 text-[11px]">Cannot find what you are looking for?</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (scannedBarcode) setInsertTitle(scannedBarcode);
                              setBookInputMode("insert");
                              setShowBookDropdown(false);
                            }}
                            className="font-bold text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer text-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Insert New Book to Catalog
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ── MODE 3: DIRECT BOOK INSERT & ISSUE TERMINAL ── */
                  <div className="p-4 rounded-2xl bg-amber-50/50 border-2 border-dashed border-amber-300/80 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/60 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-amber-600 text-white flex items-center justify-center text-xs font-bold">
                            <Plus className="w-3.5 h-3.5" />
                          </span>
                          <h4 className="font-bold text-sm text-amber-950">
                            Direct Book Registration &amp; Instant Issue
                          </h4>
                        </div>
                        <p className="text-xs text-amber-800 mt-0.5">
                          Directly insert a new uncataloged book into the library and issue it to{" "}
                          <span className="font-bold underline text-amber-950">
                            {member ? member.name : "selected borrower"}
                          </span>{" "}
                          in 1 click.
                        </p>
                      </div>

                      {!member && (
                        <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-200 shrink-0 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Select recipient above first</span>
                        </span>
                      )}
                    </div>

                    {/* Fast Book Form Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {/* Title with Live Dynamic Drop Bar */}
                      <div className="space-y-1 sm:col-span-2 relative">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-700">
                            Book Title <span className="text-rose-500">*</span>
                          </label>
                          {matchingExistingBook && (
                            <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              Catalog Matched: {matchingExistingBook.availableCopies} available
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="text"
                            value={insertTitle}
                            onChange={(e) => {
                              setInsertTitle(e.target.value);
                              setMatchingExistingBook(null);
                            }}
                            onFocus={() => {
                              if (insertSuggestions.length > 0) setShowInsertDropdown(true);
                            }}
                            placeholder="Type manual book name (e.g. Nahjul Balagha, Kalam Mubarak, Fiqh)..."
                            className="w-full text-base sm:text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none font-medium"
                          />
                        </div>

                        {/* Dynamic Drop Bar of Related Books */}
                        <AnimatePresence>
                          {showInsertDropdown && insertSuggestions.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 4 }}
                              className="absolute top-full left-0 right-0 z-50 mt-1 bg-white rounded-xl shadow-2xl border-2 border-emerald-300/80 overflow-hidden max-h-64 overflow-y-auto"
                            >
                              <div className="p-2.5 bg-gradient-to-r from-emerald-50 to-amber-50 border-b border-emerald-200 flex items-center justify-between text-xs font-extrabold text-emerald-950">
                                <span className="flex items-center gap-1.5">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                  Related Books in Catalog ({insertSuggestions.length})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowInsertDropdown(false)}
                                  className="text-[10px] text-slate-500 hover:text-slate-800 font-normal underline cursor-pointer"
                                >
                                  Close
                                </button>
                              </div>

                              <div className="divide-y divide-slate-100">
                                {insertSuggestions.map((book) => (
                                  <div
                                    key={book.id}
                                    onClick={() => {
                                      setInsertTitle(book.title);
                                      if (book.author) setInsertAuthor(book.author);
                                      if (book.category) setInsertCategory(book.category);
                                      if (book.rackNumber) setInsertRack(book.rackNumber);
                                      setMatchingExistingBook(book);
                                      setShowInsertDropdown(false);
                                    }}
                                    className="p-2.5 hover:bg-emerald-50/70 cursor-pointer transition-colors flex items-center justify-between gap-3 text-left"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold shrink-0 text-xs">
                                        📖
                                      </div>
                                      <div className="min-w-0">
                                        <p className="font-bold text-xs text-slate-900 truncate">{book.title}</p>
                                        <p className="text-[11px] text-slate-500 truncate">
                                          {book.author ? `By ${book.author}` : "Author unlisted"} &middot; Category:{" "}
                                          <span className="font-semibold text-emerald-900">{book.category || "General"}</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-mono">
                                          Barcode: {book.barcode || "N/A"} {book.rackNumber ? `· Rack: ${book.rackNumber}` : ""}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                      <span
                                        className={cn(
                                          "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                          book.availableCopies > 0
                                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                            : "bg-rose-100 text-rose-800 border border-rose-200"
                                        )}
                                      >
                                        {book.availableCopies > 0 ? `${book.availableCopies} available` : "Checked out"}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Matching Existing Book Quick Action Banner */}
                      {matchingExistingBook && (
                        <div className="sm:col-span-3 p-3 bg-amber-50 border border-amber-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs text-amber-900">
                            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              <strong>&ldquo;{matchingExistingBook.title}&rdquo;</strong> is already in the library catalog with <strong>{matchingExistingBook.availableCopies}</strong> available copies.
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              handleSelectBook(matchingExistingBook);
                              setBookInputMode("search");
                            }}
                            className="text-xs bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-lg shadow-xs shrink-0 cursor-pointer"
                          >
                            <ArrowRight className="w-3.5 h-3.5 mr-1" />
                            Issue Existing Copy Instead
                          </Button>
                        </div>
                      )}

                      {/* Author */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Author / Musannif</label>
                        <input
                          type="text"
                          value={insertAuthor}
                          onChange={(e) => setInsertAuthor(e.target.value)}
                          placeholder="e.g. Syedna Qadi al-Numan"
                          className="w-full text-base sm:text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
                        />
                      </div>

                      {/* Category */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Category</label>
                        <select
                          value={insertCategory}
                          onChange={(e) => setInsertCategory(e.target.value)}
                          className="w-full text-base sm:text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
                        >
                          <option value="Dars-e-Nizami">Dars-e-Nizami</option>
                          <option value="Quran &amp; Tafseer">Quran &amp; Tafseer</option>
                          <option value="Hadith">Hadith</option>
                          <option value="Fiqh">Fiqh</option>
                          <option value="Tareekh &amp; Seerat">Tareekh &amp; Seerat</option>
                          <option value="Lisan al-Dawat">Lisan al-Dawat</option>
                          <option value="Arabic Literature">Arabic Literature</option>
                          <option value="Religion">Religion</option>
                          <option value="General">General</option>
                          <option value="Science">Science</option>
                          <option value="Mathematics">Mathematics</option>
                          <option value="English">English</option>
                          <option value="History">History</option>
                          <option value="Reference">Reference</option>
                          <option value="General Knowledge (GK)">General Knowledge (GK)</option>
                          <option value="Children">Children</option>
                        </select>
                      </div>

                      {/* Shelf / Rack */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Shelf / Rack No.</label>
                        <input
                          type="text"
                          value={insertRack}
                          onChange={(e) => setInsertRack(e.target.value)}
                          placeholder="e.g. Shelf 2B / Rack-A"
                          className="w-full text-base sm:text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
                        />
                      </div>

                      {/* Custom Barcode */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">
                          Barcode <span className="text-[10px] text-slate-400 font-normal">(Auto if blank)</span>
                        </label>
                        <input
                          type="text"
                          value={insertBarcode}
                          onChange={(e) => setInsertBarcode(e.target.value)}
                          placeholder="Leave blank for auto-generate"
                          className="w-full text-base sm:text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none font-mono"
                        />
                      </div>

                      {/* Total Copies */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-700">Total Copies Added</label>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={insertCopies}
                          onChange={(e) => setInsertCopies(Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-full text-base sm:text-xs rounded-xl border border-slate-300 px-3 py-2 bg-white text-slate-900 focus:ring-2 focus:ring-emerald-600 outline-none"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-amber-200/60">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setBookInputMode("scan")}
                        className="text-xs text-slate-600 hover:text-slate-900"
                      >
                        ← Back to Dual Scanner
                      </Button>

                      <Button
                        type="button"
                        onClick={handleDirectInsertAndIssue}
                        disabled={insertingDirectly || !insertTitle.trim() || !member}
                        className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-6 py-2 rounded-xl text-xs flex items-center gap-2 shadow-sm"
                      >
                        {insertingDirectly ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <PlusCircle className="w-4 h-4" />
                        )}
                        <span>
                          {member ? `Insert & Issue to ${member.name.split(" ")[0]}` : "Insert Book & Issue Directly"}
                        </span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── 3. Till Selection & Issue Deadlines (Issue Mode) ── */}
                {mode === "checkout" && (
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-emerald-700" />
                        <span className="text-xs font-bold text-slate-700">Till Selection (Due Date):</span>
                      </div>

                      {/* Preset Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[7, 14, 21, 30, 60].map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => { setDueDateDays(days); setCustomDueDate(""); }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${dueDateDays === days && !customDueDate
                              ? "bg-amber-600 text-white border-amber-700 shadow-2xs"
                              : "bg-white text-slate-700 border-slate-200 hover:bg-amber-50"
                              }`}
                          >
                            {days} Days
                          </button>
                        ))}
                      </div>

                      {/* Custom Picker */}
                      <input
                        type="date"
                        value={customDueDate}
                        onChange={(e) => setCustomDueDate(e.target.value)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800 bg-white"
                        title="Pick custom due date"
                      />
                    </div>

                    {/* Dual Calendar Deadline Preview */}
                    <div className="rounded-xl bg-amber-50/70 border border-amber-200 p-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-200 text-amber-900">
                          Auto-filled Issue
                        </span>
                        <span className="text-xs text-slate-700 font-medium">
                          Today, {issueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} ({issueHijri.day} {issueHijri.monthNameShort} {issueHijri.year} H)
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900">
                          Return Deadline
                        </span>
                        <span className="text-xs font-extrabold text-slate-900">
                          {computedDueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="text-xs font-bold text-emerald-800">
                          ({dueHijri.formatted})
                        </span>
                      </div>
                    </div>

                    {/* Multi-Channel Reminders Settings */}
                    <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={reminderOneDayBefore}
                          onChange={(e) => setReminderOneDayBefore(e.target.checked)}
                          className="rounded text-emerald-700 focus:ring-emerald-600"
                        />
                        <span>1 Day Before Due Reminder (WhatsApp + Email)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={reminderDayOfDue}
                          onChange={(e) => setReminderDayOfDue(e.target.checked)}
                          className="rounded text-emerald-700 focus:ring-emerald-600"
                        />
                        <span>Day-of-Due Reminder (WhatsApp + Email)</span>
                      </label>

                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={sendWhatsAppOnIssue}
                          onChange={(e) => setSendWhatsAppOnIssue(e.target.checked)}
                          className="rounded text-emerald-700 focus:ring-emerald-600"
                        />
                        <span>Instant WhatsApp Issue Receipt to Parent</span>
                      </label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── 3.5. Today's Return Activity & Names Bar (Return Mode) ── */}
            {mode === "return" && (
              <Card className="fatimi-card">
                <div className="fatimi-card-header" />
                <CardHeader className="pb-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                      <RotateCcw className="w-5 h-5 text-emerald-700" />
                      <span>Today&apos;s Return Activity &amp; Returnees</span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Live
                      </span>
                    </CardTitle>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setMode("return-log")}
                      className="h-8 text-xs font-bold rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white shadow-xs flex items-center gap-1.5"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Full Return Log ({todayReturnSummary.totalReturnedToday})</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Today&apos;s Returns</span>
                      <p className="text-lg font-black text-emerald-900 mt-0.5">{todayReturnSummary.totalReturnedToday}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Borrowers Today</span>
                      <p className="text-lg font-black text-emerald-800 mt-0.5">{todayReturnSummary.todaysBorrowerNames.length}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">On-Time Returns</span>
                      <p className="text-lg font-black text-emerald-700 mt-0.5">{todayReturnSummary.onTimeCount}</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200">
                      <span className="text-[10px] font-bold text-amber-700 uppercase">Late / Garamat</span>
                      <p className="text-lg font-black text-amber-900 mt-0.5">
                        {todayReturnSummary.lateCount} <span className="text-xs font-bold font-mono">(₹{todayReturnSummary.totalGaramat})</span>
                      </p>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-2">
                      <Users className="w-3.5 h-3.5 text-emerald-600" />
                      Today&apos;s Returnee Names
                    </span>
                    {todayReturnSummary.todaysBorrowerNames.length === 0 ? (
                      <div className="p-3 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center">
                        <p className="text-xs text-slate-400">
                          No returns recorded today yet. When books are scanned/returned, student and faculty names appear here instantly.
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {todayReturnSummary.todaysBorrowerNames.map((name, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setMode("return-log")}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50/80 hover:bg-emerald-100 text-emerald-950 border border-emerald-300 shadow-2xs hover:shadow-xs transition-all cursor-pointer group"
                            title={`Click to view ${name} in Return Books Log`}
                          >
                            <span className="w-5 h-5 rounded-full bg-emerald-200 text-emerald-900 flex items-center justify-center text-[10px] font-black">
                              {name.slice(0, 1).toUpperCase()}
                            </span>
                            <span>{name}</span>
                            <span className="text-emerald-500 text-[10px] group-hover:translate-x-0.5 transition-transform">→</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── 4. Scanned Books Queue (Checkout Mode) ── */}
            {mode === "checkout" && scannedBooks.length > 0 && (
              <Card className="fatimi-card">
                <div className="fatimi-card-header" />
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base text-slate-800">
                    <ShoppingCart className="w-5 h-5 text-emerald-700" />
                    <span>Recently Issued in this Session ({scannedBooks.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {scannedBooks.map((b, i) => (
                      <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-200">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                          <div>
                            <p className="font-extrabold text-xs text-slate-900">{b.title}</p>
                            <p className="text-[11px] text-slate-500">
                              Barcode: <span className="font-mono font-bold text-slate-700">{b.barcode}</span> &middot; {b.author || "Author recorded"}
                            </p>
                          </div>
                        </div>
                        <Badge variant="success" className="text-[10px]">
                          Issued Successfully
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ── 5. Green On-Time Return Banner (Nothing will happen / 0 Garamat) ── */}
            {lastOnTimeReturn && !pendingReturnGaramat && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/90 p-5 shadow-lg">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <h3 className="font-extrabold text-sm text-emerald-950">
                        Book Returned On-Time &middot; Green Status (0 Garamat)
                      </h3>
                      <p className="text-xs text-emerald-800">
                        &ldquo;{lastOnTimeReturn.bookTitle}&rdquo; [{lastOnTimeReturn.barcode}] returned by {lastOnTimeReturn.borrowerName}. Book checked back into circulation.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setLastOnTimeReturn(null)} className="text-emerald-400 hover:text-emerald-700">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-2">
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Return Status</span>
                    <p className="text-sm font-black text-emerald-700">On Time (Clean)</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Issue Due Date</span>
                    <p className="text-xs font-bold text-slate-800">{lastOnTimeReturn.dueHijri || "On Schedule"}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-emerald-200 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Garamat Assessed</span>
                    <p className="text-sm font-black text-emerald-700 font-mono">₹0 (None)</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── 5. Garamat Late Return Notification Drawer / Settlement Panel (₹10/day) ── */}
            {pendingReturnGaramat && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl border-2 border-rose-500 bg-rose-50/90 p-5 shadow-lg">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0" />
                    <div>
                      <h3 className="font-extrabold text-sm text-rose-950">Overdue Return Detected &middot; Garamat Fine Assessed</h3>
                      <p className="text-xs text-rose-800">
                        &ldquo;{pendingReturnGaramat.bookTitle}&rdquo; [{pendingReturnGaramat.barcode}] was returned {pendingReturnGaramat.daysLate} day(s) late
                        by <strong className="font-bold">{pendingReturnGaramat.borrowerName}</strong>
                        {pendingReturnGaramat.darjah && pendingReturnGaramat.darjah !== "Circulation" ? ` (${pendingReturnGaramat.darjah})` : ""}.
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setPendingReturnGaramat(null)} className="text-rose-400 hover:text-rose-700">
                    <XCircle className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-3">
                  <div className="p-2.5 rounded-xl bg-white border border-rose-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Days Delayed</span>
                    <p className="text-lg font-black text-rose-700 font-mono">{pendingReturnGaramat.daysLate} Days</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-rose-200">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Garamat Rate</span>
                    <p className="text-lg font-black text-slate-800 font-mono">₹10 / Day</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-rose-200 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Total Garamat</span>
                    <p className="text-lg font-black text-rose-900 font-mono">₹{pendingReturnGaramat.garamatAmount}</p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-rose-200">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      toast({ title: "Garamat Waived", description: "Recorded administrative exemption", variant: "default" });
                      setPendingReturnGaramat(null);
                    }}
                    className="text-xs rounded-xl border-rose-300 text-rose-900 hover:bg-rose-100 font-bold"
                  >
                    Waive Garamat
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      toast({ title: "Garamat Settled", description: `Collected ₹${pendingReturnGaramat.garamatAmount} in cash`, variant: "success" });
                      setPendingReturnGaramat(null);
                    }}
                    className="text-xs rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold shadow-xs"
                  >
                    Collect ₹{pendingReturnGaramat.garamatAmount} &amp; Confirm
                  </Button>
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar Area (Right 1 col) */}
          <div className="space-y-6">
            {/* Live Circulation Transaction Log */}
            <Card className="fatimi-card">
              <div className="fatimi-card-header" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-slate-800">
                  <History className="w-4 h-4 text-emerald-700" />
                  <span>Session Circulation Ledger</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ActionLog items={actionLog} />
              </CardContent>
            </Card>

            {/* Express Scanner Tips */}
            <Card className="fatimi-card">
              <div className="fatimi-card-header" />
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-slate-800">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>High-Speed Scanner Protocol</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center justify-center shrink-0">1</span>
                  <p><strong>Fast Scanner Wedge:</strong> Point USB barcode scanner at sticker; auto-enters in &lt;100ms.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center justify-center shrink-0">2</span>
                  <p><strong>Dual Calendars:</strong> Both Gregorian and Fatimi Hijri dates are computed automatically.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center justify-center shrink-0">3</span>
                  <p><strong>Automatic Reminders:</strong> WhatsApp and Email reminders trigger 1 day before and on due date.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-[10px] flex items-center justify-center shrink-0">4</span>
                  <p><strong>Garamat Protocol:</strong> Late returns automatically compute ₹10/day fine with waiver options.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <MonthlyCirculationRecords
          onDeleteLoan={handleDeleteLoan}
          onLogAction={logAction}
        />
      )}

      {/* ── Camera Barcode Scanner Modal ── */}
      <BookScanModal
        open={showScanModal}
        onOpenChange={setShowScanModal}
        onBookIssued={() => {
          fetchAllActiveLoans();
        }}
      />
    </div>
  );
}
