"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  UserCheck,
  Search,
  Users,
  Clock,
  Sparkles,
  CheckCircle2,
  CalendarDays,
  Loader2,
  Trash2,
  Barcode,
  Printer,
  Volume2,
  VolumeX,
  FileSpreadsheet,
  RefreshCw,
  School,
  Check,
  BookOpen,
  Layers,
  ArrowRight,
  ShieldCheck,
  LayoutDashboard,
  RotateCcw,
  Undo2,
  Trophy,
  Medal,
  ChevronLeft,
  ChevronRight,
  X,
  Pencil,
  BarChart3,
  BookMarked,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import { cn } from "@/lib/utils";

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  darjah: string | null;
  date: string;
  checkInTime: string;
  sessionType: string;
  status: string;
  notes: string | null;
  avatarUrl?: string | null;
  its?: string | null;
}

interface ClassStudent {
  studentId: string;
  profileId: string;
  name: string;
  its: string;
  darjah: string;
  avatarUrl?: string | null;
  isCheckedIn: boolean;
  checkInTime: string | null;
  attendanceId: string | null;
}

interface ClassItem {
  id: string;
  name: string;
  grade: string;
  section: string;
}

// ── Monthly (Fatimi Hijri) / Leaders / Stacking / Yearly Profile types ──
type MainTab = "daily" | "monthly" | "leaders" | "stacking";

interface HijriMonthMeta {
  month: number;
  year: number;
  monthName: string;
  monthNameAr: string;
  monthLabel: string;
  daysInMonth: number;
}

interface MonthlyPerson {
  studentId: string;
  name: string;
  darjah: string;
  visits: number;
  lastVisit: string | null;
  sessions: Record<string, number>;
}

interface LeaderIssuer {
  studentId: string;
  name: string;
  role: "STUDENT" | "FACULTY";
  darjah: string;
  issued: number;
  returned: number;
}

interface LeaderVisitor {
  studentId: string;
  name: string;
  darjah: string;
  visits: number;
  lastVisit: string | null;
}

interface StackingRow {
  id: string;
  bookTitle: string;
  bookBarcode: string;
  category: string;
  borrowerId: string;
  borrowerName: string;
  borrowerRole: "STUDENT" | "FACULTY";
  darjah: string;
  status: string;
  borrowedAt: string;
  borrowedDateHijri: string;
  dueAt: string;
  returnedAt: string | null;
}

interface ProfileRecord {
  id: string;
  studentId: string;
  studentName: string;
  darjah: string | null;
  date: string;
  checkInTime: string | null;
  sessionType: string;
  status: string;
  notes: string | null;
}

interface ProfileLoan {
  id: string;
  bookTitle: string;
  bookBarcode: string;
  borrowedAt: string;
  borrowedDateHijri: string;
  dueAt: string;
  returnedAt: string | null;
  status: string;
}

interface ProfileData {
  year: number;
  person: { id: string; name: string; darjah: string; its: string | null; avatarUrl: string | null; role: string };
  months: { month: number; monthName: string; visits: number; issued: number }[];
  totals: { visits: number; issued: number; returned: number; active: number };
  recentAttendance: ProfileRecord[];
  recentLoans: ProfileLoan[];
}

const SESSION_LABELS: Record<string, string> = {
  PRESENT: "Arrival",
  READING: "Reading",
  RESEARCH: "Research",
  BOOK_EXCHANGE: "Book Exchange",
  STUDY_HALL: "Study Hall",
};

const SESSION_BADGE: Record<string, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800 border-emerald-200",
  READING: "bg-sky-100 text-sky-800 border-sky-200",
  RESEARCH: "bg-violet-100 text-violet-800 border-violet-200",
  BOOK_EXCHANGE: "bg-amber-100 text-amber-800 border-amber-200",
  STUDY_HALL: "bg-rose-100 text-rose-800 border-rose-200",
};

// High-speed audio chime using Web Audio API
function playCheckinChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.22);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    // Ignore audio permission or context errors
  }
}

export default function MaktabatAttendancePage() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedDarjah, setSelectedDarjah] = useState<string>("ALL");
  const [availableClasses, setAvailableClasses] = useState<ClassItem[]>([]);
  const [quickQuery, setQuickQuery] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Fast Barcode / ITS Scanner Wedge Input
  const [scanCode, setScanCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedResult, setLastScannedResult] = useState<{
    name: string;
    darjah: string;
    its: string;
    avatarUrl?: string | null;
    time: string;
    alreadyCheckedIn?: boolean;
  } | null>(null);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [classStudents, setClassStudents] = useState<ClassStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [hijriDateLabel, setHijriDateLabel] = useState<string>("");
  const [stats, setStats] = useState<{ totalVisits: number; distinctStudents: number }>({
    totalVisits: 0,
    distinctStudents: 0,
  });

  // ── Monthly (Fatimi Hijri) / Leaders / Stacking / Yearly Profile state ──
  const [mainTab, setMainTab] = useState<MainTab>("daily");
  const [hijriSel, setHijriSel] = useState<{ month: number; year: number } | null>(null);
  const [hijriMonthsList, setHijriMonthsList] = useState<{ month: number; name: string }[]>([]);
  const [monthMeta, setMonthMeta] = useState<HijriMonthMeta | null>(null);
  const [monthlyPersons, setMonthlyPersons] = useState<MonthlyPerson[]>([]);
  const [monthlyTotals, setMonthlyTotals] = useState<{
    totalVisits: number;
    distinctPersons: number;
    sessionCounts: Record<string, number>;
  } | null>(null);
  const [monthlyDays, setMonthlyDays] = useState<number[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [leaders, setLeaders] = useState<{ topIssuers: LeaderIssuer[]; topVisitors: LeaderVisitor[] } | null>(null);
  const [leadersLoading, setLeadersLoading] = useState(false);
  const [stackingRows, setStackingRows] = useState<StackingRow[]>([]);
  const [stackingTotals, setStackingTotals] = useState<Record<string, number> | null>(null);
  const [stackingLoading, setStackingLoading] = useState(false);
  const [stackingRole, setStackingRole] = useState<"ALL" | "STUDENT" | "FACULTY">("ALL");
  const [stackingQuery, setStackingQuery] = useState("");
  const [profilePerson, setProfilePerson] = useState<{ id: string; name: string; darjah?: string; role?: string } | null>(null);
  const [profileYear, setProfileYear] = useState<number | null>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ProfileRecord | null>(null);
  const [editForm, setEditForm] = useState<{ time: string; sessionType: string; notes: string }>({
    time: "",
    sessionType: "READING",
    notes: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Fetch Active Classes for Filter Pills ──
  useEffect(() => {
    fetch("/api/admin/library/attendance/classes")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setAvailableClasses(data.data);
        }
      })
      .catch(() => {});
  }, []);

  // ── Fetch Attendance Log for Selected Date ──
  const fetchAttendanceLog = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/library/attendance?date=${selectedDate}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data || []);
        if (data.stats) {
          setStats({
            totalVisits: data.stats.totalVisits || 0,
            distinctStudents: data.stats.distinctStudents || 0,
          });
        }
        if (data.hijriDate) setHijriDateLabel(data.hijriDate);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load Maktabat attendance records", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  // ── Fetch Class Students for 1-Tap Attendance ──
  const fetchClassStudents = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/library/attendance/class-students?darjah=${encodeURIComponent(selectedDarjah)}&date=${selectedDate}`
      );
      const data = await res.json();
      if (data.success) {
        setClassStudents(data.data || []);
      }
    } catch {
      // Ignore
    }
  }, [selectedDarjah, selectedDate]);

  useEffect(() => {
    fetchAttendanceLog();
    fetchClassStudents();
  }, [fetchAttendanceLog, fetchClassStudents]);

  // ── High-Speed Barcode / ITS Scanner Handler ──
  const handleFastScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = scanCode.trim();
    if (!query) return;

    setIsScanning(true);
    try {
      const res = await fetch("/api/admin/library/attendance/scan-checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          sessionType: "PRESENT",
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (soundEnabled) playCheckinChime();
        const student = data.student || {};
        const isRepeat = data.alreadyCheckedIn;

        setLastScannedResult({
          name: student.name,
          darjah: student.darjah,
          its: student.its,
          avatarUrl: student.avatarUrl || null,
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
          alreadyCheckedIn: isRepeat,
        });

        toast({
          title: isRepeat ? "Already Recorded Present" : "✓ Talabat Arrived & Marked Present",
          description: `${student.name} (${student.darjah})`,
          variant: isRepeat ? "default" : "success",
        });

        fetchAttendanceLog();
        fetchClassStudents();
        setScanCode("");
        barcodeInputRef.current?.focus();
      } else {
        toast({
          title: "Check-In Lookup Failed",
          description: data.error || `No Talabat found for "${query}"`,
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Scan Error", description: "Network error processing scan", variant: "destructive" });
    } finally {
      setIsScanning(false);
    }
  };

  // ── 1-Click Fast Check-In on Roster ──
  const handleCheckIn = async (student: ClassStudent) => {
    setMarkingId(student.studentId);
    try {
      const res = await fetch("/api/admin/library/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.studentId,
          studentName: student.name,
          darjah: student.darjah,
          sessionType: "PRESENT",
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (soundEnabled) playCheckinChime();
        toast({
          title: "✓ Talabat Arrived & Marked Present",
          description: `${student.name} (${student.darjah})`,
          variant: "success",
        });
        fetchAttendanceLog();
        fetchClassStudents();
        setQuickQuery("");
        searchInputRef.current?.focus();
      } else {
        toast({ title: "Attendance Error", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error recording attendance", variant: "destructive" });
    } finally {
      setMarkingId(null);
    }
  };

  // ── Remove / Undo Entry (Revert student back to absent/unmarked) ──
  const handleDelete = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/admin/library/attendance/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Arrival Undone", description: `Reverted arrival record for ${name}. Marked absent.`, variant: "default" });
        if (lastScannedResult?.name === name) {
          setLastScannedResult(null);
        }
        fetchAttendanceLog();
        fetchClassStudents();
      }
    } catch {
      toast({ title: "Error", description: "Failed to remove entry", variant: "destructive" });
    }
  };

  // ── Undo Attendance by Student or Attendance ID ──
  const handleUndoAttendance = async (attendanceId?: string | null, studentName?: string, studentId?: string) => {
    try {
      let res;
      if (attendanceId) {
        res = await fetch(`/api/admin/library/attendance/${attendanceId}`, { method: "DELETE" });
      } else {
        res = await fetch("/api/admin/library/attendance/undo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, date: selectedDate }),
        });
      }
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Attendance Undone",
          description: `Arrival record reverted for ${studentName || "Talabat"}. Marked absent / pending.`,
          variant: "default",
        });
        if (lastScannedResult && (lastScannedResult.its === studentId || lastScannedResult.name === studentName)) {
          setLastScannedResult(null);
        }
        fetchAttendanceLog();
        fetchClassStudents();
      } else {
        toast({ title: "Undo Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to undo attendance record", variant: "destructive" });
    }
  };

  // ── Bulk Mark Entire Class ──
  const handleBulkMarkClass = async () => {
    const uninspected = classStudents.filter((s) => !s.isCheckedIn);
    if (uninspected.length === 0) {
      toast({ title: "All Present", description: "All students in this class are already marked present", variant: "default" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/admin/library/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students: uninspected.map((s) => ({
            studentId: s.studentId,
            studentName: s.name,
            darjah: s.darjah,
          })),
          sessionType: "PRESENT",
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (soundEnabled) playCheckinChime();
        toast({
          title: "Class Marked Present",
          description: `Marked ${data.count} students arrived`,
          variant: "success",
        });
        fetchAttendanceLog();
        fetchClassStudents();
      }
    } catch {
      toast({ title: "Error", description: "Failed to bulk mark class", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════
  // ── Monthly (Fatimi Hijri) / Leaders / All-Persons Stacking ──
  // ══════════════════════════════════════════════════════════════════
  const fetchMonthly = useCallback(async (month?: number, year?: number) => {
    setMonthlyLoading(true);
    try {
      const qs = month && year ? `?hijriMonth=${month}&hijriYear=${year}` : "";
      const res = await fetch(`/api/admin/library/attendance/monthly${qs}`);
      const data = await res.json();
      if (data.success) {
        setMonthMeta(data.month);
        setHijriMonthsList(data.months || []);
        if (month && year) setHijriSel({ month: data.month.month, year: data.month.year });
        else setHijriSel((prev) => prev || { month: data.month.month, year: data.month.year });
        setMonthlyPersons(data.persons || []);
        setMonthlyTotals(data.totals || null);
        setMonthlyDays(data.days || []);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load monthly Maktabat attendance", variant: "destructive" });
    } finally {
      setMonthlyLoading(false);
    }
  }, []);

  const fetchLeaders = useCallback(async (month?: number, year?: number) => {
    setLeadersLoading(true);
    try {
      const qs = month && year ? `?hijriMonth=${month}&hijriYear=${year}` : "";
      const res = await fetch(`/api/admin/library/attendance/leaders${qs}`);
      const data = await res.json();
      if (data.success) {
        setMonthMeta(data.month);
        setHijriMonthsList(data.months || []);
        setHijriSel((prev) => prev || { month: data.month.month, year: data.month.year });
        setLeaders({ topIssuers: data.topIssuers || [], topVisitors: data.topVisitors || [] });
      }
    } catch {
      toast({ title: "Error", description: "Failed to load top performers", variant: "destructive" });
    } finally {
      setLeadersLoading(false);
    }
  }, []);

  const fetchStacking = useCallback(async (month?: number, year?: number) => {
    setStackingLoading(true);
    try {
      const qs = month && year ? `?hijriMonth=${month}&hijriYear=${year}` : "";
      const res = await fetch(`/api/admin/library/attendance/stacking-all${qs}`);
      const data = await res.json();
      if (data.success) {
        setMonthMeta(data.month);
        setHijriMonthsList(data.months || []);
        setHijriSel((prev) => prev || { month: data.month.month, year: data.month.year });
        setStackingRows(data.data || []);
        setStackingTotals(data.totals || null);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load all-persons stacking records", variant: "destructive" });
    } finally {
      setStackingLoading(false);
    }
  }, []);

  // Load data when tab or Hijri month changes (daily tab uses its own fetchers)
  useEffect(() => {
    if (mainTab === "monthly") fetchMonthly(hijriSel?.month, hijriSel?.year);
    else if (mainTab === "leaders") fetchLeaders(hijriSel?.month, hijriSel?.year);
    else if (mainTab === "stacking") fetchStacking(hijriSel?.month, hijriSel?.year);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainTab, hijriSel?.month, hijriSel?.year]);

  const shiftHijriMonth = (delta: number) => {
    setHijriSel((prev) => {
      if (!prev) return prev;
      let m = prev.month + delta;
      let y = prev.year;
      if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
      return { month: m, year: y };
    });
  };

  // ── Inline Yearly Profile (click any person anywhere on this page) ──
  const refreshProfile = useCallback(async (personId: string, year: number | null) => {
    setProfileLoading(true);
    try {
      const qs = new URLSearchParams({ personId });
      if (year) qs.set("hijriYear", String(year));
      const res = await fetch(`/api/admin/library/attendance/yearly-profile?${qs.toString()}`);
      const data = await res.json();
      if (data.success) {
        setProfileData({
          year: data.year,
          person: data.person,
          months: data.months || [],
          totals: data.totals,
          recentAttendance: data.recentAttendance || [],
          recentLoans: data.recentLoans || [],
        });
        setProfileYear(data.year);
      } else {
        toast({ title: "Error", description: data.error || "Failed to load yearly profile", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to load yearly profile", variant: "destructive" });
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const openProfile = (p: { id: string; name: string; darjah?: string; role?: string }) => {
    setEditingRecord(null);
    setProfilePerson(p);
    setProfileYear(hijriSel?.year ?? null);
  };

  useEffect(() => {
    if (!profilePerson) {
      setProfileData(null);
      return;
    }
    refreshProfile(profilePerson.id, profileYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilePerson?.id, profileYear]);

  const shiftProfileYear = (delta: number) => {
    setProfileYear((prev) => (prev ?? new Date().getFullYear()) + delta);
  };

  const closeProfile = () => {
    setProfilePerson(null);
    setProfileData(null);
    setEditingRecord(null);
  };

  // ── Edit attendance record inline (time / session / notes) ──
  const startEditRecord = (r: ProfileRecord) => {
    const t = r.checkInTime ? new Date(r.checkInTime) : null;
    setEditingRecord(r);
    setEditForm({
      time: t
        ? t.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
        : "",
      sessionType: r.sessionType || "READING",
      notes: r.notes || "",
    });
  };

  const saveEditRecord = async () => {
    if (!editingRecord) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/library/attendance/${editingRecord.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkInTime: editForm.time,
          sessionType: editForm.sessionType,
          notes: editForm.notes,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Record Updated", description: "Attendance time, session and notes saved.", variant: "success" });
        setEditingRecord(null);
        if (profilePerson) refreshProfile(profilePerson.id, profileYear);
        fetchAttendanceLog();
      } else {
        toast({ title: "Update Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error while saving the record", variant: "destructive" });
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Undo an attendance record from the yearly profile ──
  const undoProfileRecord = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/admin/library/attendance/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Attendance Undone", description: `Reverted arrival record for ${name}.`, variant: "default" });
        if (profilePerson) refreshProfile(profilePerson.id, profileYear);
        fetchAttendanceLog();
        fetchClassStudents();
      } else {
        toast({ title: "Undo Failed", description: data.error, variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to undo attendance record", variant: "destructive" });
    }
  };

  // Client-side stacking filters (single fetch per month, filtered locally)
  const filteredStacking = stackingRows.filter((r) => {
    if (stackingRole !== "ALL" && r.borrowerRole !== stackingRole) return false;
    if (stackingQuery) {
      const q = stackingQuery.toLowerCase();
      const hay = `${r.borrowerName} ${r.bookTitle} ${r.bookBarcode} ${r.darjah} ${r.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  // ── Export Attendance to Excel (CSV with UTF-8 BOM) ──
  const exportToExcel = () => {
    if (records.length === 0) {
      toast({ title: "No Records", description: "No attendance records to export for this date", variant: "destructive" });
      return;
    }

    const headers = ["Sr", "Student Name", "ITS", "Darjah", "Status", "Marking Time", "Date", "Hijri Date"];
    const rows = records.map((r, i) => [
      i + 1,
      `"${r.studentName.replace(/"/g, '""')}"`,
      `"${r.its || "—"}"`,
      `"${(r.darjah || "General").replace(/"/g, '""')}"`,
      `"ARRIVED / PRESENT"`,
      `"${new Date(r.checkInTime).toLocaleTimeString("en-US")}"`,
      `"${selectedDate}"`,
      `"${hijriDateLabel || "Hijri"}"`,
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((row) => row.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Maktabat_Attendance_${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast({ title: "Excel Export Complete", description: `Exported ${records.length} records to CSV`, variant: "success" });
  };

  // ── Print Daily Sheet ──
  const printDailySheet = () => {
    window.print();
  };

  const filteredClassStudents = classStudents.filter((s) => {
    if (!quickQuery) return true;
    const q = quickQuery.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.its.toLowerCase().includes(q);
  });

  // Dynamic Class Pills
  const darjahOptions = [
    { id: "ALL", label: "All Classes" },
    ...(availableClasses.length > 0
      ? availableClasses.map((c) => ({
          id: c.name,
          label: c.name.startsWith("Grade") || c.name.startsWith("Darajah") ? c.name : `Darajah ${c.name}`,
        }))
      : [
          { id: "1 A", label: "Darajah 1 A" },
          { id: "1 B", label: "Darajah 1 B" },
          { id: "2 A", label: "Darajah 2 A" },
          { id: "2 B", label: "Darajah 2 B" },
          { id: "3 A", label: "Darajah 3 A" },
          { id: "3 B", label: "Darajah 3 B" },
          { id: "4 A", label: "Darajah 4 A" },
          { id: "4 B", label: "Darajah 4 B" },
        ]),
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Library Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Library & Circulation"
        hubDescription="Book catalog, smart color-coded shelves, circulation desk, garamat tracking, and Maktabat attendance."
        tabs={[
          { label: "Book Catalog", href: "/admin/library", icon: BookOpen },
          { label: "Shelves & Racks", href: "/admin/library/shelves", icon: Layers },
          { label: "Express Circulation Desk", href: "/admin/library/checkout", icon: ArrowRight },
          { label: "Maktabat Attendance", href: "/admin/library/attendance", icon: UserCheck },
          { label: "Overdue Monitor", href: "/admin/library/overdue", icon: Clock },
          { label: "Inventory Auditor", href: "/admin/library/auditor", icon: ShieldCheck },
          { label: "Library Overview", href: "/admin/library/overview", icon: LayoutDashboard },
        ]}
      />

      {/* ── Header Banner ── */}
      <div className="fatimi-header-banner">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center fatimi-gold-accent shadow-md shrink-0">
              <UserCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Maktabat Attendance Registry
                </h1>
                {hijriDateLabel && (
                  <span className="bg-amber-400/20 text-amber-200 border border-amber-300/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                    {hijriDateLabel}
                  </span>
                )}
              </div>
              <p className="text-emerald-100 text-sm font-medium mt-0.5">
                Marking Talabat Arrival Time &amp; Date &middot; Instant Sync with Talabat &amp; Parent Portals
              </p>
            </div>
          </div>

          {/* Quick Metrics & Controls */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-black/20 p-1.5 rounded-2xl border border-white/20 backdrop-blur-md">
              <div className="px-3 py-1.5 text-center">
                <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">Arrived Today</p>
                <p className="text-xl font-extrabold text-white">{stats.totalVisits}</p>
              </div>
              <div className="w-px h-8 bg-white/20" />
              <div className="px-3 py-1.5 text-center">
                <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider">Distinct Talabat</p>
                <p className="text-xl font-extrabold text-amber-300">{stats.distinctStudents}</p>
              </div>
            </div>

            {/* Audio Feedback Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                "p-2.5 rounded-xl border transition-all cursor-pointer backdrop-blur-md",
                soundEnabled
                  ? "bg-emerald-600/50 border-emerald-300 text-white hover:bg-emerald-600/70"
                  : "bg-white/10 border-white/20 text-slate-300 hover:bg-white/20"
              )}
              title={soundEnabled ? "Scanner chime enabled" : "Scanner chime muted"}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5 text-rose-300" />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Section Tabs: Daily Desk / Monthly (Hijri) / Top Performers / All-Persons Stacking ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { id: "daily", label: "Daily Desk", icon: UserCheck },
          { id: "monthly", label: "Monthly (Hijri)", icon: CalendarDays },
          { id: "leaders", label: "Top Performers", icon: Trophy },
          { id: "stacking", label: "All-Persons Stacking", icon: BookMarked },
        ] as const).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setMainTab(t.id)}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5",
              mainTab === t.id
                ? "bg-emerald-800 text-white border-emerald-900 shadow-sm"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Fatimi Hijri Month Selector (Monthly / Leaders / Stacking tabs) ── */}
      {mainTab !== "daily" && (
        <Card className="fatimi-card">
          <CardContent className="p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <CalendarDays className="w-4 h-4 text-emerald-700 shrink-0" />
              <button
                type="button"
                onClick={() => shiftHijriMonth(-1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                title="Previous Hijri month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select
                value={hijriSel?.month ?? ""}
                onChange={(e) => hijriSel && setHijriSel({ ...hijriSel, month: Number(e.target.value) })}
                className="text-xs rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs cursor-pointer"
              >
                {(hijriMonthsList.length
                  ? hijriMonthsList
                  : Array.from({ length: 12 }, (_, i) => ({ month: i + 1, name: `Month ${i + 1}` }))
                ).map((m) => (
                  <option key={m.month} value={m.month}>
                    {m.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={hijriSel?.year ?? ""}
                onChange={(e) => hijriSel && setHijriSel({ ...hijriSel, year: Number(e.target.value) || hijriSel.year })}
                className="w-20 text-xs rounded-xl border border-slate-300 px-2.5 py-1.5 bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs font-mono"
              />
              <button
                type="button"
                onClick={() => shiftHijriMonth(1)}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                title="Next Hijri month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              {monthMeta && (
                <Badge variant="outline" className="text-[11px] bg-amber-50 text-amber-800 border-amber-300 font-bold">
                  {monthMeta.monthLabel}
                </Badge>
              )}
              {(mainTab === "monthly" && monthlyLoading) ||
              (mainTab === "leaders" && leadersLoading) ||
              (mainTab === "stacking" && stackingLoading) ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
              ) : null}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              Fatimi Hijri month &middot; follows the same month as stacking records
            </p>
          </CardContent>
        </Card>
      )}

      {mainTab === "daily" && (
        <>
      {/* ── HIGH-SPEED SCANNER WEDGE CARD ── */}
      <Card className="fatimi-card border-2 border-emerald-500/30 bg-radial from-emerald-50/50 to-white shadow-sm">
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={handleFastScanSubmit} className="space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-800 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Barcode className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    High-Speed Barcode &amp; ITS Scanner Wedge
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Point USB scanner at student ID card or type ITS/Name &amp; press Enter for instant arrival logging
                  </p>
                </div>
              </div>

              {/* Action Buttons: Export & Print */}
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={exportToExcel}
                  className="text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-700" />
                  Excel Export
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={printDailySheet}
                  className="text-xs font-bold border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl"
                >
                  <Printer className="w-3.5 h-3.5 mr-1.5 text-slate-600" />
                  Print Sheet
                </Button>
              </div>
            </div>

            {/* Giant Scanner Input Bar */}
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  placeholder="Scan Student Barcode / ITS Number (e.g. 30116072) & press Enter..."
                  autoFocus
                  className="w-full rounded-2xl border-2 border-emerald-400 pl-12 pr-4 py-3 text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-emerald-200 bg-white shadow-inner font-mono"
                />
                {isScanning && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={isScanning || !scanCode.trim()}
                className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-6 py-3 h-auto rounded-2xl shadow-sm shrink-0 active:scale-95 transition-all text-xs sm:text-sm"
              >
                {isScanning ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5 text-amber-300" />}
                Mark Arrived
              </Button>
            </div>

            {/* Last Scanned Result Confirmation Pill with Profile Photo */}
            <AnimatePresence>
              {lastScannedResult && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs shadow-xs",
                    lastScannedResult.alreadyCheckedIn
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-emerald-100/70 border-emerald-300 text-emerald-950 font-semibold"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border-2 border-white shadow-xs">
                      <ProfilePhoto
                        src={lastScannedResult.avatarUrl}
                        alt={lastScannedResult.name}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-slate-900">{lastScannedResult.name}</span>
                        <span className="text-slate-500 font-mono text-[11px]">({lastScannedResult.its})</span>
                        <span className="text-slate-600 font-medium">&middot; {lastScannedResult.darjah}</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 font-bold mt-0.5">
                        {lastScannedResult.alreadyCheckedIn
                          ? "Already recorded present today"
                          : `✓ Arrived & Marked Present at ${lastScannedResult.time}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-[11px] text-slate-500 font-mono bg-white/70 px-2.5 py-1 rounded-lg border border-slate-200">
                      {lastScannedResult.alreadyCheckedIn ? "Recorded" : lastScannedResult.time}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleUndoAttendance(undefined, lastScannedResult.name, lastScannedResult.its)}
                      className="text-xs h-7 px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 font-bold rounded-lg flex items-center gap-1 cursor-pointer"
                      title="Undo this check-in if marked by mistake"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Undo</span>
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </CardContent>
      </Card>

      {/* ── Date & Attendance Control Toolbar ── */}
      <Card className="fatimi-card">
        <CardContent className="p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="text-xs font-bold text-slate-700">Attendance Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs rounded-xl border border-slate-300 px-3 py-1.5 bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-emerald-600 shadow-2xs"
            />
            {selectedDate !== new Date().toISOString().slice(0, 10) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                className="text-xs h-7 px-2 text-emerald-800 hover:bg-emerald-50 font-bold"
              >
                Reset to Today
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchAttendanceLog();
                fetchClassStudents();
              }}
              className="text-xs h-8 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 font-bold"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5 text-emerald-700", loading && "animate-spin")} />
              Sync Roster
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Main Two-Column Attendance Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Talabat Roster with Profile Photos & 1-Tap Mark */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="fatimi-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-700" />
                  <span>Talabat Roster &amp; 1-Tap Arrival</span>
                </CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkMarkClass}
                  disabled={loading || classStudents.length === 0}
                  className="text-xs rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Mark Entire Class Arrived
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Dynamic Class Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap max-h-28 overflow-y-auto pr-1">
                {darjahOptions.map((darjah) => (
                  <button
                    key={darjah.id}
                    type="button"
                    onClick={() => setSelectedDarjah(darjah.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                      selectedDarjah === darjah.id
                        ? "bg-emerald-800 text-white border-emerald-900 shadow-2xs"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    )}
                  >
                    {darjah.label}
                  </button>
                ))}
              </div>

              {/* Fast Filter Search Input */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder={`Search Talabat in ${selectedDarjah === "ALL" ? "All Classes" : selectedDarjah} by name or ITS...`}
                  className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2 text-xs focus:ring-2 focus:ring-emerald-600 outline-none bg-white text-slate-900"
                />
              </div>

              {/* Students Grid with Profile Photos */}
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {filteredClassStudents.length === 0 ? (
                  <div className="text-center py-10 text-xs text-slate-400 space-y-1">
                    <p>No Talabat found matching your search.</p>
                    <p className="text-[11px] text-slate-400">Use the barcode scanner above to look up any student immediately.</p>
                  </div>
                ) : (
                  filteredClassStudents.map((s) => (
                    <div
                      key={s.studentId}
                      className={cn(
                        "p-3 rounded-2xl border flex items-center justify-between gap-3 transition-colors",
                        s.isCheckedIn
                          ? "bg-emerald-50/70 border-emerald-200 text-emerald-950"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Profile Photo */}
                        <div
                          className={cn(
                            "w-11 h-11 rounded-xl overflow-hidden shrink-0 border-2 shadow-xs",
                            s.isCheckedIn ? "border-emerald-500 ring-2 ring-emerald-200" : "border-slate-200"
                          )}
                        >
                          <ProfilePhoto
                            src={s.avatarUrl}
                            alt={s.name}
                            className="w-full h-full"
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900 truncate">{s.name}</p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            ITS: {s.its} &middot; {s.darjah}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {s.isCheckedIn ? (
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-700" />
                                Arrived
                              </span>
                              {s.checkInTime && (
                                <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                  Time: {new Date(s.checkInTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              )}
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleUndoAttendance(s.attendanceId, s.name, s.studentId)}
                              className="text-xs h-7 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 font-bold rounded-lg cursor-pointer flex items-center gap-1"
                              title="Undo arrival / Mark absent (marked by mistake)"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Undo</span>
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleCheckIn(s)}
                            disabled={markingId === s.studentId}
                            className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs h-8 px-3.5 rounded-xl shadow-xs cursor-pointer active:scale-95 transition-transform"
                          >
                            {markingId === s.studentId ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              "Mark Arrived"
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Arrived Talabat Feed (Date + Time + Profile Photo) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="fatimi-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-700" />
                  <span>Today&apos;s Arrivals ({records.length})</span>
                </CardTitle>
                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-300 font-bold">
                  Live Feed
                </Badge>
              </div>
            </CardHeader>

            <CardContent>
              {records.length === 0 ? (
                <div className="text-center py-12 text-slate-400 space-y-2">
                  <UserCheck className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-xs">No arrivals recorded yet for {selectedDate}.</p>
                  <p className="text-[11px] text-slate-400">Use the barcode scanner or class roster to mark Talabat as arrived.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1 divide-y divide-slate-100">
                  {records.map((r) => (
                    <div key={r.id} className="pt-2.5 flex items-center justify-between gap-3 first:pt-0">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Profile Photo */}
                        <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-slate-200 shadow-2xs">
                          <ProfilePhoto
                            src={r.avatarUrl}
                            alt={r.studentName}
                            className="w-full h-full"
                          />
                        </div>

                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900 truncate">{r.studentName}</p>
                          <p className="text-[10.5px] text-slate-500 truncate">
                            {r.darjah || "General"} {r.its ? `· ITS ${r.its}` : ""}
                          </p>
                          <p className="text-[10px] text-emerald-800 font-bold font-mono">
                            Time: {new Date(r.checkInTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200">
                          Present
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUndoAttendance(r.id, r.studentName, r.studentId)}
                          className="flex items-center gap-1 text-slate-500 hover:text-rose-600 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-xs font-semibold cursor-pointer shrink-0"
                          title="Undo arrival record (revert back to absent/unmarked)"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Undo</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
        </>
      )}

      {/* ── MONTHLY (FATIMI HIJRI) ATTENDANCE ── */}
      {mainTab === "monthly" && (
        <div className="space-y-4">
          {/* Summary chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="fatimi-card">
              <CardContent className="p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Total Visits</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{monthlyTotals?.totalVisits ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="fatimi-card">
              <CardContent className="p-4 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Distinct Persons</p>
                <p className="text-2xl font-extrabold text-amber-600 mt-1">{monthlyTotals?.distinctPersons ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="fatimi-card sm:col-span-2">
              <CardContent className="p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-2">Session Mix</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {Object.entries(monthlyTotals?.sessionCounts || {}).length === 0 ? (
                    <span className="text-xs text-slate-400">No sessions recorded</span>
                  ) : (
                    Object.entries(monthlyTotals?.sessionCounts || {}).map(([k, v]) => (
                      <span
                        key={k}
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          SESSION_BADGE[k] || "bg-slate-100 text-slate-700 border-slate-200"
                        )}
                      >
                        {SESSION_LABELS[k] || k}: {v}
                      </span>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Per-Hijri-day distribution */}
          <Card className="fatimi-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-emerald-700" />
                <span>Daily Visits &mdash; {monthMeta?.monthLabel || ""}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-1 h-24 overflow-x-auto">
                {(monthlyDays.length ? monthlyDays : []).map((c, i) => {
                  const max = Math.max(1, ...monthlyDays);
                  return (
                    <div key={i} className="flex flex-col items-center gap-0.5 min-w-[14px] flex-1" title={`Day ${i + 1}: ${c} visits`}>
                      {c > 0 && <span className="text-[8px] font-bold text-emerald-800">{c}</span>}
                      <div
                        className={cn("w-full rounded-t-sm", c > 0 ? "bg-emerald-600/80" : "bg-slate-100")}
                        style={{ height: `${Math.max(c > 0 ? 6 : 2, (c / max) * 80)}px` }}
                      />
                      <span className="text-[7px] text-slate-400 font-mono">{i + 1}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Per-person list */}
          <Card className="fatimi-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                <span>Monthly Attendance by Person</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyPersons.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  No Maktabat visits recorded for {monthMeta?.monthLabel || "this month"}.
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                  {monthlyPersons.map((p, idx) => (
                    <button
                      key={p.studentId}
                      type="button"
                      onClick={() => openProfile({ id: p.studentId, name: p.name, darjah: p.darjah })}
                      className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 text-[10px] font-black text-slate-600 flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900 truncate">{p.name}</p>
                          <p className="text-[10.5px] text-slate-500 truncate">{p.darjah}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {p.lastVisit && (
                          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                            last {new Date(p.lastVisit).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                        <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full">
                          {p.visits} visit{p.visits === 1 ? "" : "s"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── TOP PERFORMERS: Top Issuers + Top Visitors ── */}
      {mainTab === "leaders" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Issuers */}
          <Card className="fatimi-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <span>Top Issuers &mdash; Most Books Borrowed ({monthMeta?.monthLabel || ""})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leadersLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
                </div>
              ) : !leaders || leaders.topIssuers.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  No books issued in {monthMeta?.monthLabel || "this month"}.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {leaders.topIssuers.map((p, idx) => (
                    <button
                      key={p.studentId}
                      type="button"
                      onClick={() => openProfile({ id: p.studentId, name: p.name, darjah: p.darjah, role: p.role })}
                      className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/40 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn(
                            "w-7 h-7 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 border",
                            idx === 0
                              ? "bg-amber-400 text-amber-950 border-amber-500"
                              : idx === 1
                              ? "bg-slate-300 text-slate-800 border-slate-400"
                              : idx === 2
                              ? "bg-orange-300 text-orange-950 border-orange-400"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          )}
                        >
                          {idx === 0 ? <Medal className="w-3.5 h-3.5" /> : idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900 truncate">{p.name}</p>
                          <p className="text-[10.5px] text-slate-500 truncate">
                            {p.darjah} &middot; {p.role === "FACULTY" ? "Faculty" : "Talabat"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full inline-block">
                          {p.issued} book{p.issued === 1 ? "" : "s"}
                        </span>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{p.returned} returned</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Visitors */}
          <Card className="fatimi-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-emerald-600" />
                <span>Top Visitors &mdash; Most Maktabat Visits ({monthMeta?.monthLabel || ""})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {leadersLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
                </div>
              ) : !leaders || leaders.topVisitors.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">
                  No Maktabat visits in {monthMeta?.monthLabel || "this month"}.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {leaders.topVisitors.map((p, idx) => (
                    <button
                      key={p.studentId}
                      type="button"
                      onClick={() => openProfile({ id: p.studentId, name: p.name, darjah: p.darjah })}
                      className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={cn(
                            "w-7 h-7 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 border",
                            idx === 0
                              ? "bg-amber-400 text-amber-950 border-amber-500"
                              : idx === 1
                              ? "bg-slate-300 text-slate-800 border-slate-400"
                              : idx === 2
                              ? "bg-orange-300 text-orange-950 border-orange-400"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          )}
                        >
                          {idx === 0 ? <Medal className="w-3.5 h-3.5" /> : idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900 truncate">{p.name}</p>
                          <p className="text-[10.5px] text-slate-500 truncate">{p.darjah}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full shrink-0">
                        {p.visits} visit{p.visits === 1 ? "" : "s"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── ALL-PERSONS STACKING (students & faculty borrow/issue records) ── */}
      {mainTab === "stacking" && (
        <Card className="fatimi-card">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-emerald-700" />
                <span>All-Persons Stacking &mdash; {monthMeta?.monthLabel || ""}</span>
              </CardTitle>
              {stackingTotals && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-800 border-emerald-300 font-bold">
                    {stackingTotals.records} records
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-800 border-sky-300 font-bold">
                    {stackingTotals.active} active
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-800 border-rose-300 font-bold">
                    {stackingTotals.overdue} overdue
                  </Badge>
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 font-bold">
                    {stackingTotals.faculty} faculty
                  </Badge>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Role pills + search */}
            <div className="flex items-center gap-2 flex-wrap">
              {(["ALL", "STUDENT", "FACULTY"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setStackingRole(r)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border",
                    stackingRole === r
                      ? "bg-emerald-800 text-white border-emerald-900 shadow-2xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {r === "ALL" ? "All Persons" : r === "STUDENT" ? "Talabat" : "Faculty"}
                </button>
              ))}
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={stackingQuery}
                  onChange={(e) => setStackingQuery(e.target.value)}
                  placeholder="Search person, book, barcode or darjah..."
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-4 py-1.5 text-xs focus:ring-2 focus:ring-emerald-600 outline-none bg-white text-slate-900"
                />
              </div>
            </div>

            {/* Rows */}
            {stackingLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-700" />
              </div>
            ) : filteredStacking.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400">
                No stacking records for {monthMeta?.monthLabel || "this month"}
                {stackingQuery ? " matching your search" : ""}.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
                {filteredStacking.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => openProfile({ id: r.borrowerId, name: r.borrowerName, darjah: r.darjah, role: r.borrowerRole })}
                    className="w-full text-left p-2.5 rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-slate-900 truncate">{r.bookTitle}</p>
                      <p className="text-[10.5px] text-slate-500 truncate">
                        {r.borrowerName} &middot; {r.borrowerRole === "FACULTY" ? "Faculty" : r.darjah} &middot; {r.bookBarcode}
                      </p>
                      <p className="text-[9.5px] text-slate-400 font-mono">{r.borrowedDateHijri}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          r.status === "OVERDUE"
                            ? "bg-rose-100 text-rose-800 border-rose-200"
                            : r.status === "ACTIVE"
                            ? "bg-sky-100 text-sky-800 border-sky-200"
                            : "bg-emerald-100 text-emerald-800 border-emerald-200"
                        )}
                      >
                        {r.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── INLINE YEARLY PROFILE PANEL (click any person above) ── */}
      <AnimatePresence>
        {profilePerson && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="relative"
          >
            <Card className="fatimi-card border-2 border-emerald-500/40 bg-radial from-emerald-50/40 to-white shadow-md">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 border-2 border-emerald-300 shadow-xs">
                      <ProfilePhoto
                        src={profileData?.person.avatarUrl}
                        alt={profileData?.person.name || profilePerson.name}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base font-extrabold text-slate-900 truncate">
                          {profileData?.person.name || profilePerson.name}
                        </CardTitle>
                        {profileData?.person.role === "FACULTY" && (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 font-bold">
                            Faculty
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono">
                        {profileData?.person.darjah || profilePerson.darjah || "General"}
                        {profileData?.person.its ? ` · ITS ${profileData.person.its}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => shiftProfileYear(-1)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                        title="Previous Hijri year"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-extrabold text-slate-900 font-mono px-1">
                        {profileData?.year ?? ""} H
                      </span>
                      <button
                        type="button"
                        onClick={() => shiftProfileYear(1)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                        title="Next Hijri year"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                    {profileLoading && <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={closeProfile}
                      className="text-xs h-8 rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 font-bold"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Close
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-5">
                {/* Year totals */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: "Total Visits", value: profileData?.totals.visits ?? 0, cls: "text-emerald-700" },
                    { label: "Books Borrowed", value: profileData?.totals.issued ?? 0, cls: "text-amber-600" },
                    { label: "Books Returned", value: profileData?.totals.returned ?? 0, cls: "text-sky-600" },
                    { label: "Currently Active", value: profileData?.totals.active ?? 0, cls: "text-rose-600" },
                  ].map((s) => (
                    <div key={s.label} className="p-3 rounded-xl bg-white border border-slate-200 text-center">
                      <p className={cn("text-[10px] font-black uppercase tracking-wider", s.cls)}>{s.label}</p>
                      <p className="text-xl font-extrabold text-slate-900 mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* 12 Hijri months */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                    Full-Year Record &mdash; 12 Fatimi Hijri Months
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                    {(profileData?.months || []).map((m) => (
                      <div
                        key={m.month}
                        className={cn(
                          "p-2.5 rounded-xl border text-center",
                          m.visits > 0 || m.issued > 0
                            ? "bg-emerald-50/70 border-emerald-200"
                            : "bg-white border-slate-200"
                        )}
                      >
                        <p className="text-[10px] font-extrabold text-slate-800">{m.monthName}</p>
                        <p className="text-[10px] text-emerald-800 font-bold mt-0.5">{m.visits} visits</p>
                        <p className="text-[10px] text-amber-700 font-bold">{m.issued} issued</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent attendance with edit + undo */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                    Attendance Records &mdash; Edit &amp; Undo
                  </p>
                  {profileData && profileData.recentAttendance.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No attendance records this year.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                      {(profileData?.recentAttendance || []).map((r) => (
                        <div key={r.id}>
                          <div className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 font-mono">
                                {new Date(r.checkInTime || r.date).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                <span
                                  className={cn(
                                    "text-[9.5px] font-bold px-1.5 py-0.5 rounded-full border",
                                    SESSION_BADGE[r.sessionType] || "bg-slate-100 text-slate-700 border-slate-200"
                                  )}
                                >
                                  {SESSION_LABELS[r.sessionType] || r.sessionType}
                                </span>
                                {r.notes && (
                                  <span className="text-[10px] text-slate-500 truncate max-w-[220px]" title={r.notes}>
                                    {r.notes}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => (editingRecord?.id === r.id ? setEditingRecord(null) : startEditRecord(r))}
                                className="text-xs h-7 px-2.5 text-sky-700 hover:text-sky-800 hover:bg-sky-50 border-sky-200 font-bold rounded-lg cursor-pointer flex items-center gap-1"
                                title="Edit time, session and notes"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Edit</span>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => undoProfileRecord(r.id, r.studentName)}
                                className="text-xs h-7 px-2.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 font-bold rounded-lg cursor-pointer flex items-center gap-1"
                                title="Undo this attendance record"
                              >
                                <Undo2 className="w-3 h-3" />
                                <span>Undo</span>
                              </Button>
                            </div>
                          </div>

                          {/* Inline edit form */}
                          {editingRecord?.id === r.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="mt-1.5 p-3 rounded-xl border-2 border-sky-200 bg-sky-50/60 space-y-2.5"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                                    Check-In Time
                                  </label>
                                  <input
                                    type="time"
                                    value={editForm.time}
                                    onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                                    className="w-full text-xs rounded-xl border border-sky-300 px-2.5 py-1.5 bg-white text-slate-900 font-mono font-bold outline-none focus:ring-2 focus:ring-sky-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                                    Session Type
                                  </label>
                                  <select
                                    value={editForm.sessionType}
                                    onChange={(e) => setEditForm({ ...editForm, sessionType: e.target.value })}
                                    className="w-full text-xs rounded-xl border border-sky-300 px-2.5 py-1.5 bg-white text-slate-900 font-bold outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                                  >
                                    {Object.entries(SESSION_LABELS).map(([k, label]) => (
                                      <option key={k} value={k}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block mb-1">
                                    Notes
                                  </label>
                                  <input
                                    type="text"
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                    placeholder="Optional notes..."
                                    className="w-full text-xs rounded-xl border border-sky-300 px-2.5 py-1.5 bg-white text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                                  />
                                </div>
                              </div>
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditingRecord(null)}
                                  className="text-xs h-7 px-3 rounded-lg border-slate-300 text-slate-600 font-bold cursor-pointer"
                                >
                                  Cancel
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={saveEditRecord}
                                  disabled={savingEdit || !editForm.time}
                                  className="bg-sky-700 hover:bg-sky-800 text-white text-xs h-7 px-3 rounded-lg font-bold cursor-pointer active:scale-95 transition-transform"
                                >
                                  {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save Changes"}
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Stacking history */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
                    Stacking History &mdash; Books Borrowed This Year
                  </p>
                  {profileData && profileData.recentLoans.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center">No books borrowed this year.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                      {(profileData?.recentLoans || []).map((l) => (
                        <div
                          key={l.id}
                          className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">{l.bookTitle}</p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {l.bookBarcode} &middot; borrowed {l.borrowedDateHijri}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0",
                              l.status === "ACTIVE"
                                ? "bg-sky-100 text-sky-800 border-sky-200"
                                : "bg-emerald-100 text-emerald-800 border-emerald-200"
                            )}
                          >
                            {l.status === "ACTIVE" ? "Active" : "Returned"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
