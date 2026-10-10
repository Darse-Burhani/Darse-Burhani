"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  Save,
  Search,
  Check,
  X,
  Building2,
  Shield,
  UserCheck,
  Filter,
  BookOpen,
  Sparkles,
  Users,
  GraduationCap,
  ChevronDown,
  CalendarDays,
  RefreshCw,
  Fingerprint,
  FileText,
  Zap,
  CheckCheck,
  RotateCcw,
  Smartphone,
  Layers,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  Info,
  Radio,
  Keyboard,
  Timer,
  Award,
  Grid3X3,
  ListFilter,
  CheckSquare,
  Flame,
  LayoutGrid,
  Table as TableIcon,
  HelpCircle,
  FileSpreadsheet,
  ExternalLink,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { GoogleSheetSyncCard } from "@/components/admin/attendance/GoogleSheetSyncCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "ON_LEAVE"
  | "NOT_MARKED";

interface ScheduledWindow {
  id: string;
  name: string;
  windowType?: "HIKVISION" | "MANUAL" | "BOTH";
  startTime: string;
  endTime: string;
  lateEndTime?: string;
  graceMinutes: number;
  enabled: boolean;
  hasFacultyTimer: boolean;
  facultyStartTime?: string;
  facultyEndTime?: string;
  facultyLateEndTime?: string;
  facultyEnabled?: boolean;
}

interface ClassOption {
  id: string;
  name: string;
  grade: string;
  section: string;
  subject?: string;
  teacherName?: string;
  studentCount?: number;
}

interface RosterMember {
  id: string;
  profileId: string;
  name: string;
  email?: string;
  identifier: string;
  its?: string;
  grade?: string;
  section?: string;
  department?: string;
  avatarUrl?: string | null;
  targetType: "STUDENT" | "TEACHER";
  status: AttendanceStatus;
  originalStatus?: AttendanceStatus;
  source?: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  remarks?: string | null;
}

type ViewLayout = "grid" | "table" | "kiosk";

const STATUS_CONFIG: {
  key: AttendanceStatus;
  label: string;
  shortLabel: string;
  hotkey: string;
  icon: React.ElementType;
  bgActive: string;
  bgLight: string;
  borderActive: string;
  textActive: string;
  textLight: string;
  glowColor: string;
  badgeClass: string;
}[] = [
  {
    key: "PRESENT",
    label: "Present",
    shortLabel: "Pres",
    hotkey: "1",
    icon: CheckCircle2,
    bgActive: "bg-emerald-600 text-white",
    bgLight: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100/80 border-emerald-200/80",
    borderActive: "border-emerald-600 ring-2 ring-emerald-400/40 shadow-emerald-500/20 shadow-md",
    textActive: "text-white",
    textLight: "text-emerald-800",
    glowColor: "rgba(16, 185, 129, 0.25)",
    badgeClass: "bg-emerald-500/15 text-emerald-700 border-emerald-300 font-bold",
  },
  {
    key: "LATE",
    label: "Late",
    shortLabel: "Late",
    hotkey: "2",
    icon: Clock,
    bgActive: "bg-amber-500 text-slate-950 font-black",
    bgLight: "bg-amber-50 text-amber-900 hover:bg-amber-100/80 border-amber-200/80",
    borderActive: "border-amber-500 ring-2 ring-amber-400/40 shadow-amber-500/20 shadow-md",
    textActive: "text-slate-950",
    textLight: "text-amber-900",
    glowColor: "rgba(245, 158, 11, 0.25)",
    badgeClass: "bg-amber-500/15 text-amber-800 border-amber-300 font-bold",
  },
  {
    key: "ABSENT",
    label: "Absent",
    shortLabel: "Abs",
    hotkey: "3",
    icon: XCircle,
    bgActive: "bg-rose-600 text-white",
    bgLight: "bg-rose-50 text-rose-800 hover:bg-rose-100/80 border-rose-200/80",
    borderActive: "border-rose-600 ring-2 ring-rose-400/40 shadow-rose-500/20 shadow-md",
    textActive: "text-white",
    textLight: "text-rose-800",
    glowColor: "rgba(225, 29, 72, 0.25)",
    badgeClass: "bg-rose-500/15 text-rose-700 border-rose-300 font-bold",
  },
  {
    key: "ON_LEAVE",
    label: "Leave",
    shortLabel: "Leave",
    hotkey: "4",
    icon: ShieldCheck,
    bgActive: "bg-purple-600 text-white",
    bgLight: "bg-purple-50 text-purple-800 hover:bg-purple-100/80 border-purple-200/80",
    borderActive: "border-purple-600 ring-2 ring-purple-400/40 shadow-purple-500/20 shadow-md",
    textActive: "text-white",
    textLight: "text-purple-800",
    glowColor: "rgba(147, 51, 234, 0.25)",
    badgeClass: "bg-purple-500/15 text-purple-700 border-purple-300 font-bold",
  },
];

export default function AdminManualAttendancePage() {
  const targetType = "STUDENT";
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scheduledWindows, setScheduledWindows] = useState<ScheduledWindow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);

  // Filters & Layout Mode
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [selectedGrade, setSelectedGrade] = useState<string>("ALL");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [viewLayout, setViewLayout] = useState<ViewLayout>("grid");
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [showHotkeyGuide, setShowHotkeyGuide] = useState(false);

  // Roster & State
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Dedicated Google Sheet for Manual Attendance State
  const [sheetStatus, setSheetStatus] = useState<{
    configured: boolean;
    isDedicated: boolean;
    spreadsheetId: string | null;
    maskedSpreadsheetId: string | null;
    serviceAccountEmail: string | null;
    fullServiceAccountEmail: string | null;
    url: string | null;
    lastSyncedAt: string | null;
    lastSyncedDate: string | null;
  } | null>(null);
  const [loadingSheetStatus, setLoadingSheetStatus] = useState(false);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [customSheetInput, setCustomSheetInput] = useState("");

  const loadSheetStatus = useCallback(async () => {
    try {
      setLoadingSheetStatus(true);
      const res = await fetch("/api/attendance/manual/sheet-status");
      const json = await res.json();
      if (json.success) {
        setSheetStatus(json.data);
      }
    } catch (e) {
      console.warn("Failed to fetch manual sheet status:", e);
    } finally {
      setLoadingSheetStatus(false);
    }
  }, []);

  useEffect(() => {
    loadSheetStatus();
  }, [loadSheetStatus]);

  const handleCreateNewSheet = async () => {
    setCreatingSheet(true);
    try {
      const res = await fetch("/api/attendance/manual/create-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Darse Burhani — Manual Classroom Register (${new Date().getFullYear()})`,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "New Google Sheet Created!",
          description: `Spreadsheet created and linked successfully. ID: ${json.data.spreadsheetId}`,
          variant: "success",
        });
        await loadSheetStatus();
        await handleSyncSheet();
      } else {
        toast({
          title: "Creation Notice",
          description: json.error || "Failed to create new Google Sheet",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Creation Error",
        description: err?.message || "Failed to create Google Sheet",
        variant: "destructive",
      });
    } finally {
      setCreatingSheet(false);
    }
  };

  const handleSyncSheet = async () => {
    setSyncingSheet(true);
    try {
      const res = await fetch("/api/attendance/manual/sync-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Manual Attendance Synced to Google Sheet",
          description: json.message || "Roll-call records pushed to Google Sheet.",
          variant: "success",
        });
        await loadSheetStatus();
      } else {
        toast({
          title: "Sheet Sync Notice",
          description: json.error || "Failed to push to Google Sheet",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Sync Error",
        description: err?.message || "Failed to sync to Google Sheet",
        variant: "destructive",
      });
    } finally {
      setSyncingSheet(false);
    }
  };

  const handleLinkSheet = async () => {
    if (!customSheetInput.trim()) return;
    try {
      const res = await fetch("/api/attendance/manual/link-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spreadsheetId: customSheetInput.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Google Sheet Linked",
          description: "Manual attendance sheet linked successfully.",
          variant: "success",
        });
        setShowLinkModal(false);
        setCustomSheetInput("");
        await loadSheetStatus();
      } else {
        toast({ title: "Link Failed", description: json.error || "Failed to link sheet", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Link Error", description: err?.message || "Failed to link sheet", variant: "destructive" });
    }
  };

  // Load Schedules & Metadata
  const loadMetadata = useCallback(async () => {
    try {
      setLoadingInitial(true);
      const res = await fetch("/api/attendance/manual/schedules", {
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success && data.data) {
        // Strictly allow only manual schedule events; never show HIKVISION hardware events
        const manualWindows = ((data.data.scheduledWindows || []) as ScheduledWindow[]).filter(
          (w) =>
            (w.windowType === "MANUAL" || (!w.windowType && w.id.startsWith("manual_"))) &&
            !w.id.startsWith("hik_") &&
            w.id !== "default"
        );
        setScheduledWindows(manualWindows);
        setClasses(data.data.classes || []);
        setGrades(data.data.grades || []);
        setSections(data.data.sections || []);
        if (manualWindows.length > 0 && !selectedScheduleId) {
          setSelectedScheduleId("");
        }
      }
    } catch (err) {
      console.error("Failed to load attendance schedule metadata:", err);
      toast({ title: "Failed to load schedules", variant: "destructive" });
    } finally {
      setLoadingInitial(false);
    }
  }, [selectedScheduleId]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Load candidate roster
  const loadRoster = useCallback(async () => {
    try {
      setLoadingRoster(true);
      const params = new URLSearchParams({
        targetType: "STUDENT",
        date,
      });
      if (selectedScheduleId) params.set("scheduleId", selectedScheduleId);
      if (selectedClassId && selectedClassId !== "ALL") params.set("classId", selectedClassId);
      if (selectedGrade && selectedGrade !== "ALL") params.set("grade", selectedGrade);
      if (selectedSection && selectedSection !== "ALL") params.set("section", selectedSection);

      const res = await fetch(`/api/attendance/manual/roster?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success && json.data?.roster) {
        const list: RosterMember[] = json.data.roster
          .filter((m: any) => m.targetType === "STUDENT" || !m.targetType)
          .map((m: any) => ({
            ...m,
            originalStatus: m.status,
          }));
        setRoster(list);
        setHasChanges(false);
        setFocusedIndex(list.length > 0 ? 0 : null);
      } else {
        setRoster([]);
        setFocusedIndex(null);
      }
    } catch (err) {
      console.error("Failed to fetch candidate roster:", err);
      toast({ title: "Failed to load candidate roster", variant: "destructive" });
    } finally {
      setLoadingRoster(false);
    }
  }, [date, selectedScheduleId, selectedClassId, selectedGrade, selectedSection]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Active Window Timing Status - Simply open for marking attendance
  const activeWindow = useMemo(() => {
    if (!selectedScheduleId) return scheduledWindows[0] || null;
    return scheduledWindows.find((w) => w.id === selectedScheduleId) || scheduledWindows[0] || null;
  }, [scheduledWindows, selectedScheduleId]);

  const windowTimingStatus = useMemo(() => {
    if (!activeWindow) {
      return { state: "OPEN", text: "Window Open for Marking Attendance", color: "bg-emerald-100 text-emerald-950 border-emerald-400 ring-2 ring-emerald-400/30" };
    }
    if (!activeWindow.enabled) {
      return { state: "DISABLED", text: "Session Disabled", color: "bg-gray-100 text-gray-700 border-gray-300" };
    }
    return {
      state: "OPEN",
      text: "Window Open for Marking Attendance",
      color: "bg-emerald-100 text-emerald-950 border-emerald-400 ring-2 ring-emerald-400/30",
    };
  }, [activeWindow]);

  // Status Change for candidate - purely marking status without time tracking
  const handleStatusChange = (memberId: string, newStatus: AttendanceStatus) => {
    setRoster((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        return {
          ...m,
          status: newStatus,
        };
      })
    );
    setHasChanges(true);
  };

  // Remarks Change
  const handleRemarksChange = (memberId: string, remarks: string) => {
    setRoster((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, remarks } : m))
    );
    setHasChanges(true);
  };

  // Strict Student Audience Filtering & Search
  const filteredRoster = useMemo(() => {
    return roster.filter((m) => {
      // 1. Status filter
      if (statusFilter !== "ALL") {
        if (statusFilter === "UNMARKED" && m.status !== "NOT_MARKED") return false;
        if (statusFilter !== "UNMARKED" && m.status !== statusFilter) return false;
      }

      // 2. Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.identifier?.toLowerCase().includes(q) ||
        m.its?.toLowerCase().includes(q) ||
        m.grade?.toLowerCase().includes(q) ||
        m.section?.toLowerCase().includes(q)
      );
    });
  }, [roster, statusFilter, searchQuery]);

  // Keyboard Hotkeys: 1: Present, 2: Late, 3: Absent, 4: Leave
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }

      if (filteredRoster.length === 0) return;
      const curr = focusedIndex ?? 0;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min((prev ?? 0) + 1, filteredRoster.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max((prev ?? 0) - 1, 0));
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, AttendanceStatus> = {
          "1": "PRESENT",
          "2": "LATE",
          "3": "ABSENT",
          "4": "ON_LEAVE",
        };
        const status = map[e.key];
        const targetMember = filteredRoster[curr];
        if (targetMember && status) {
          handleStatusChange(targetMember.id, status);
          if (curr < filteredRoster.length - 1) {
            setFocusedIndex(curr + 1);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredRoster, focusedIndex]);

  // Batch mark operations
  const handleBatchMarkAll = (status: AttendanceStatus) => {
    const idsToUpdate = new Set(filteredRoster.map((m) => m.id));
    setRoster((prev) =>
      prev.map((m) => {
        if (!idsToUpdate.has(m.id)) return m;
        return {
          ...m,
          status,
        };
      })
    );
    setHasChanges(true);
    toast({
      title: `Bulk Action Completed`,
      description: `Marked all ${idsToUpdate.size} visible candidate(s) as ${status}.`,
      variant: "success",
    });
  };

  const handleMarkUnmarkedAbsent = () => {
    let count = 0;
    setRoster((prev) =>
      prev.map((m) => {
        if (m.status === "NOT_MARKED") {
          count++;
          return { ...m, status: "ABSENT" };
        }
        return m;
      })
    );
    if (count > 0) {
      setHasChanges(true);
      toast({
        title: "Unmarked Candidates Updated",
        description: `Marked ${count} unmarked record(s) as ABSENT.`,
        variant: "default",
      });
    } else {
      toast({ title: "No pending unmarked candidates", variant: "default" });
    }
  };

  const handleReset = () => {
    setRoster((prev) =>
      prev.map((m) => ({
        ...m,
        status: m.originalStatus || "NOT_MARKED",
      }))
    );
    setHasChanges(false);
    toast({ title: "Reset changes to original state", variant: "default" });
  };

  // Submit manual attendance
  const handleSaveAttendance = async () => {
    try {
      setSaving(true);
      const payloadRecords = roster
        .filter((m) => m.status !== "NOT_MARKED" && Boolean(m.status))
        .map((m) => ({
          id: m.profileId || m.id,
          targetType: m.targetType,
          status: m.status,
          checkInTime: m.checkInTime || undefined,
          remarks: m.remarks || undefined,
        }));

      if (payloadRecords.length === 0) {
        toast({ title: "No attendance entries to save", variant: "warning" });
        setSaving(false);
        return;
      }

      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: selectedScheduleId || activeWindow?.id || undefined,
          date,
          targetType,
          records: payloadRecords,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "Attendance Saved & Synced Successfully!",
          description: `Updated ${data.data?.updatedCount || payloadRecords.length} records (${data.data?.updatedStudentCount ?? 0} Talabat, ${data.data?.updatedTeacherCount ?? 0} Faculty). Dual database sync complete.`,
          variant: "success",
        });
        setRoster((prev) =>
          prev.map((m) => ({ ...m, originalStatus: m.status }))
        );
        setHasChanges(false);
      } else {
        toast({
          title: "Failed to save attendance",
          description: data.error || "An unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Save manual attendance error:", err);
      toast({ title: "Error submitting attendance", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Telemetry Metrics
  const stats = useMemo(() => {
    const list = roster.filter((m) => {
      if (targetType === "STUDENT") return m.targetType === "STUDENT";
      if (targetType === "TEACHER") return m.targetType === "TEACHER";
      return true;
    });

    const total = list.length;
    let present = 0, late = 0, absent = 0, onLeave = 0, unmarked = 0;

    for (const m of list) {
      if (m.status === "PRESENT") present++;
      else if (m.status === "LATE") late++;
      else if (m.status === "ABSENT") absent++;
      else if (m.status === "ON_LEAVE") onLeave++;
      else unmarked++;
    }

    const marked = total - unmarked;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
    const completionRate = total > 0 ? Math.round((marked / total) * 100) : 0;

    return { total, present, late, absent, onLeave, unmarked, marked, rate, completionRate };
  }, [roster, targetType]);

  const audienceCounts = useMemo(() => {
    const studentCount = roster.filter((m) => m.targetType === "STUDENT").length;
    const teacherCount = roster.filter((m) => m.targetType === "TEACHER").length;
    return {
      all: roster.length,
      student: studentCount,
      teacher: teacherCount,
    };
  }, [roster]);

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      {/* ── Attendance Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Attendance & Biometric Center"
        hubDescription="Dedicated separate workspaces for Automated Hardware Scanning and Manual Roll-Call Registers."
        tabs={[
          { label: "Hikvision Device Hub", href: "/admin/biometric", icon: Fingerprint, badge: "Automated" },
          { label: "Manual Classroom Register", href: "/admin/manual-attendance", icon: ClipboardCheck, badge: "Active" },
          { label: "Attendance Logs & Verification", href: "/admin/attendance-logs", icon: FileText },
          { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
        ]}
      />

      {/* ── Dedicated Google Sheet for Manual Attendance Cockpit ── */}
      <div className="relative overflow-hidden rounded-3xl border border-[#d4af37]/40 bg-gradient-to-br from-[#021f18] via-[#05372b] to-[#04241b] p-5 sm:p-6 text-white shadow-xl shadow-emerald-950/30">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-emerald-500/15 blur-3xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#d4af37]/50 bg-[#d4af37]/15 text-[#fde047] shadow-inner">
              <FileSpreadsheet className="h-6 w-6" />
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white font-display">
                  Dedicated Google Sheet — Manual Attendance
                </h2>
                {loadingSheetStatus ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800/80 px-2.5 py-0.5 text-xs text-slate-300">
                    <Loader2 className="h-3 w-3 animate-spin text-emerald-400" /> Checking...
                  </span>
                ) : sheetStatus?.spreadsheetId ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-500/20 px-3 py-0.5 text-xs font-bold text-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    {sheetStatus.isDedicated ? "Dedicated Manual Google Sheet Active" : "Linked to Attendance Sheet"}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40 px-2.5 py-0.5 text-xs font-bold">
                    No Google Sheet Configured
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl font-medium leading-relaxed">
                Dedicated Google Spreadsheet specifically for manual classroom roll-calls. Generates organized daily tabs (<span className="font-mono text-[#fde047]">Manual - YYYY-MM-DD</span>) with complete student and faculty statuses.
                {sheetStatus?.lastSyncedAt && (
                  <span className="ml-1 text-emerald-300 font-semibold">
                    · Last synced: {new Date(sheetStatus.lastSyncedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {sheetStatus?.url && (
              <a
                href={sheetStatus.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                title="Open spreadsheet in Google Sheets"
              >
                <ExternalLink className="w-4 h-4 text-emerald-300" />
                <span>Open Google Sheet</span>
              </a>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleSyncSheet}
              disabled={syncingSheet}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs h-10 px-4 rounded-xl shadow-md cursor-pointer transition-all"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", syncingSheet && "animate-spin")} />
              {syncingSheet ? "Syncing..." : "Sync to Google Sheet"}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleCreateNewSheet}
              disabled={creatingSheet}
              className="bg-[#d4af37] hover:bg-[#c29d2b] text-slate-950 font-black text-xs h-10 px-4 rounded-xl shadow-md cursor-pointer transition-all"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5 text-slate-950" />
              {creatingSheet ? "Creating..." : "Create New Google Sheet"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowLinkModal(true)}
              className="bg-white/5 border-white/20 text-emerald-100 hover:bg-white/10 text-xs h-10 px-3.5 rounded-xl cursor-pointer"
            >
              Link Existing Sheet
            </Button>
          </div>
        </div>
      </div>

      {/* ── Dynamic Hero Cockpit (Fatimi Luxury Emerald & Obsidian Theme) ── */}
      <div className="relative overflow-hidden rounded-3xl border border-[#d4af37]/40 bg-gradient-to-br from-[#021f18] via-[#05372b] to-[#01140f] p-6 sm:p-8 shadow-[0_16px_40px_rgba(2,31,24,0.45)] text-white">
        <div className="pointer-events-none absolute -right-16 -bottom-16 w-96 h-96 rounded-full bg-[#d4af37]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -top-12 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: "radial-gradient(circle at 2px 2px, #d4af37 1.5px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#fff4be] text-xs font-black tracking-wider uppercase shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-[#fde047] animate-pulse" />
              <span>Smart Roll-Call &amp; Manual Attendance Engine</span>
            </div>

            <div className="flex items-center gap-3.5">
              <span className="inline-flex w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 items-center justify-center shadow-inner">
                <ClipboardCheck className="w-7 h-7 text-emerald-300 stroke-[2.2]" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white font-display">
                  Manual Classroom Attendance — Talabat
                </h1>
                <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-1">
                  High-speed roll call for Talabat students with instant one-touch marking (Present, Late, Absent, Leave) and cloud sync.
                </p>
              </div>
            </div>

            {/* Context Telemetry Badges */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-white/10 text-emerald-200 border border-white/15 backdrop-blur-md">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-300" />
                Date: <strong>{date}</strong>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-white/10 text-emerald-200 border border-white/15 backdrop-blur-md">
                <CheckSquare className="w-3.5 h-3.5 text-emerald-300" />
                Marked: <strong>{stats.marked} / {stats.total}</strong> ({stats.completionRate}%)
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/40 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Window Active for Marking
              </span>

              {hasChanges && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-amber-400 text-slate-950 border border-amber-300 shadow-md animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Unsaved Changes ({stats.marked} marked)
                </span>
              )}
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Hotkey Guide Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowHotkeyGuide(!showHotkeyGuide)}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 rounded-xl text-xs font-bold h-10 px-3.5 backdrop-blur-md"
            >
              <Keyboard className="w-4 h-4 mr-1.5 text-[#fde047]" />
              Hotkeys (1-4)
            </Button>

            {/* Layout Mode Selector */}
            <div className="flex items-center p-1 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setViewLayout("grid")}
                title="Bento Card Grid"
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-all",
                  viewLayout === "grid" ? "bg-[#d4af37] text-slate-950 shadow-sm" : "text-emerald-100 hover:text-white"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewLayout("table")}
                title="Rapid Roll-Call Table"
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-all",
                  viewLayout === "table" ? "bg-[#d4af37] text-slate-950 shadow-sm" : "text-emerald-100 hover:text-white"
                )}
              >
                <TableIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewLayout("kiosk")}
                title="Tablet Kiosk Touch Mode"
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-all",
                  viewLayout === "kiosk" ? "bg-[#d4af37] text-slate-950 shadow-sm" : "text-emerald-100 hover:text-white"
                )}
              >
                <Smartphone className="w-4 h-4" />
              </button>
            </div>

            {/* Reload */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadRoster}
              disabled={loadingRoster}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 rounded-xl text-xs font-bold h-10 px-3.5 backdrop-blur-md"
            >
              <RefreshCw className={cn("w-4 h-4 mr-1.5", loadingRoster && "animate-spin")} />
              Reload
            </Button>

            {/* Save Button */}
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAttendance}
              disabled={saving || loadingRoster || roster.length === 0}
              className={cn(
                "h-10 px-5 rounded-xl font-black text-xs transition-all shadow-xl flex items-center gap-2",
                hasChanges
                  ? "bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 text-slate-950 ring-2 ring-emerald-300/60 shadow-emerald-900/50 scale-105"
                  : "bg-emerald-700 hover:bg-emerald-600 text-white"
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {hasChanges ? "Commit & Sync" : "All Saved"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Hotkey Guide Drawer (Collapsible) ── */}
      <AnimatePresence>
        {showHotkeyGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-2xl bg-slate-900 text-slate-100 border border-slate-700 shadow-md flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2">
              <Keyboard className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-black uppercase tracking-wider text-amber-300 font-display">
                Keyboard Navigation Engine
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <kbd className="px-2 py-0.5 rounded bg-slate-800 border border-slate-600 font-mono font-bold text-amber-300">↑ / ↓</kbd>
                Navigate candidates
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-2 py-0.5 rounded bg-emerald-900/80 border border-emerald-600 font-mono font-bold text-emerald-200">1</kbd> Present
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-2 py-0.5 rounded bg-amber-900/80 border border-amber-600 font-mono font-bold text-amber-200">2</kbd> Late
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-2 py-0.5 rounded bg-rose-900/80 border border-rose-600 font-mono font-bold text-rose-200">3</kbd> Absent
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-2 py-0.5 rounded bg-purple-900/80 border border-purple-600 font-mono font-bold text-purple-200">4</kbd> Leave
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowHotkeyGuide(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dynamic Google Sheet Live Sync Interface ── */}
      <GoogleSheetSyncCard targetDate={date} />

      {/* ── Active Session Window Status Strip (No timestamps shown) ── */}
      <div className="p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-gray-500">Audience Scope:</span>
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-black text-xs px-2.5 py-0.5">
            Talabat Students Only
          </Badge>
        </div>

        {activeWindow && (
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
            <span className="text-gray-500 font-medium">Manual Event:</span>
            <span className="font-extrabold text-slate-900">{activeWindow.name}</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Marking Active
            </span>
          </div>
        )}
      </div>

      {/* ── Filter Matrix Control Strip ── */}
      <Card className="rounded-3xl border-gray-200/90 shadow-xs bg-white overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Date Selector */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                Attendance Date
              </label>
              <div className="relative">
                <CalendarDays className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-10 pl-9 pr-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                />
              </div>
            </div>

            {/* Manual Event Selector (Session Names Only - No Window Times) */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                Manual Schedule Event
              </label>
              <div className="relative">
                <Clock className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className="w-full h-10 pl-9 pr-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none shadow-2xs"
                >
                  <option value="">
                    {scheduledWindows.length > 0 ? "All Manual Events" : "No Manual Events Scheduled"}
                  </option>
                  {scheduledWindows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Class Selector (Students) */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                Class / Section
              </label>
              <div className="relative">
                <BookOpen className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full h-10 pl-9 pr-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                >
                  <option value="ALL">All Classes &amp; Sections</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Grade {c.grade}-{c.section})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Instant Search Input */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                Quick Search
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search student name, ITS, grade..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-8 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Live Telemetry Cards & Metric Buttons (Present, Late, Absent, Leave, Pending) ── */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {/* Total Roster */}
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={cn(
              "p-3.5 rounded-2xl border text-left transition-all duration-150 relative overflow-hidden",
              statusFilter === "ALL"
                ? "bg-slate-950 text-white border-slate-900 shadow-md ring-2 ring-slate-500/40"
                : "bg-white text-gray-800 border-gray-200/90 hover:bg-gray-50 shadow-2xs"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-70">Total Roster</p>
            <p className="text-xl font-black mt-1">{stats.total}</p>
          </button>

          {/* Present */}
          <button
            type="button"
            onClick={() => setStatusFilter("PRESENT")}
            className={cn(
              "p-3.5 rounded-2xl border text-left transition-all duration-150 relative overflow-hidden",
              statusFilter === "PRESENT"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400/50"
                : "bg-emerald-50/60 text-emerald-900 border-emerald-200/80 hover:bg-emerald-100/60 shadow-2xs"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Present</p>
            <p className="text-xl font-black mt-1">{stats.present}</p>
          </button>

          {/* Late */}
          <button
            type="button"
            onClick={() => setStatusFilter("LATE")}
            className={cn(
              "p-3.5 rounded-2xl border text-left transition-all duration-150 relative overflow-hidden",
              statusFilter === "LATE"
                ? "bg-amber-500 text-slate-950 font-black border-amber-500 shadow-md ring-2 ring-amber-400/50"
                : "bg-amber-50/60 text-amber-900 border-amber-200/80 hover:bg-amber-100/60 shadow-2xs"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Late</p>
            <p className="text-xl font-black mt-1">{stats.late}</p>
          </button>

          {/* Absent */}
          <button
            type="button"
            onClick={() => setStatusFilter("ABSENT")}
            className={cn(
              "p-3.5 rounded-2xl border text-left transition-all duration-150 relative overflow-hidden",
              statusFilter === "ABSENT"
                ? "bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-400/50"
                : "bg-rose-50/60 text-rose-900 border-rose-200/80 hover:bg-rose-100/60 shadow-2xs"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Absent</p>
            <p className="text-xl font-black mt-1">{stats.absent}</p>
          </button>

          {/* Excused / Leave */}
          <button
            type="button"
            onClick={() => setStatusFilter("ON_LEAVE")}
            className={cn(
              "p-3.5 rounded-2xl border text-left transition-all duration-150 relative overflow-hidden",
              statusFilter === "ON_LEAVE"
                ? "bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-400/50"
                : "bg-purple-50/60 text-purple-900 border-purple-200/80 hover:bg-purple-100/60 shadow-2xs"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Leave</p>
            <p className="text-xl font-black mt-1">{stats.onLeave}</p>
          </button>

          {/* Unmarked */}
          <button
            type="button"
            onClick={() => setStatusFilter("UNMARKED")}
            className={cn(
              "p-3.5 rounded-2xl border text-left transition-all duration-150 relative overflow-hidden",
              statusFilter === "UNMARKED"
                ? "bg-gray-800 text-white border-gray-700 shadow-md ring-2 ring-gray-400/50"
                : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200/70 shadow-2xs"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-80">Pending</p>
            <p className="text-xl font-black mt-1">{stats.unmarked}</p>
          </button>
        </div>

        {/* Dynamic Progress Telemetry Bar */}
        {stats.total > 0 && (
          <div className="p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-2xs space-y-2">
            <div className="flex flex-wrap items-center justify-between text-xs font-bold text-gray-700 gap-2">
              <div className="flex items-center gap-2">
                <span>Attendance Rate: <strong className="text-emerald-700 font-mono text-sm">{stats.rate}%</strong></span>
                <span className="text-gray-300">|</span>
                <span className="text-gray-600">Register Completion: <strong className="text-indigo-700 font-mono">{stats.completionRate}%</strong></span>
              </div>
              <span className="text-gray-500 font-medium">
                {stats.marked} of {stats.total} marked ({stats.unmarked} pending)
              </span>
            </div>

            <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden flex shadow-inner">
              <div style={{ width: `${(stats.present / stats.total) * 100}%` }} className="h-full bg-emerald-500 transition-all duration-300" title={`Present: ${stats.present}`} />
              <div style={{ width: `${(stats.late / stats.total) * 100}%` }} className="h-full bg-amber-400 transition-all duration-300" title={`Late: ${stats.late}`} />
              <div style={{ width: `${(stats.onLeave / stats.total) * 100}%` }} className="h-full bg-purple-500 transition-all duration-300" title={`Leave: ${stats.onLeave}`} />
              <div style={{ width: `${(stats.absent / stats.total) * 100}%` }} className="h-full bg-rose-500 transition-all duration-300" title={`Absent: ${stats.absent}`} />
            </div>
          </div>
        )}
      </div>

      {/* ── Rapid Batch Actions & View Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-2xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black uppercase tracking-wider text-gray-400 mr-1 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Rapid Batch:
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleBatchMarkAll("PRESENT")}
            className="h-8 px-3 rounded-xl bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 text-xs font-bold"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Mark All Present
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleMarkUnmarkedAbsent}
            className="h-8 px-3 rounded-xl bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 text-xs font-bold"
          >
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
            Mark Pending Absent
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-8 px-3 rounded-xl bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1 text-gray-500" />
            Reset
          </Button>
        </div>

        <div className="text-xs text-gray-500 font-semibold">
          Showing <span className="font-bold text-gray-900">{filteredRoster.length}</span> candidates in view
        </div>
      </div>

      {/* ── Candidate Roll-Call Roster View (Grid / Table / Kiosk) ── */}
      {loadingRoster ? (
        <div className="p-16 text-center rounded-3xl bg-white border border-gray-200 shadow-sm flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
          <p className="text-sm font-black text-gray-800 font-display">Loading Candidate Register...</p>
          <p className="text-xs text-gray-500">Fetching latest biometric timestamps &amp; status records</p>
        </div>
      ) : filteredRoster.length === 0 ? (
        <div className="p-16 text-center rounded-3xl bg-white border border-gray-200 shadow-sm flex flex-col items-center justify-center space-y-2">
          <ClipboardCheck className="w-12 h-12 text-gray-300" />
          <p className="text-base font-black text-gray-800 font-display">No candidates found</p>
          <p className="text-xs text-gray-500">Try changing the audience filter, class selection, or search query.</p>
        </div>
      ) : viewLayout === "table" ? (
        /* ── TABLE VIEW (Power Roll-Call List) ── */
        <div className="rounded-3xl border border-gray-200/90 bg-white overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-black uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3.5 px-4">#</th>
                  <th className="py-3.5 px-4">Candidate Profile</th>
                  <th className="py-3.5 px-4">ITS / Identifier</th>
                  <th className="py-3.5 px-4">Grade / Dept</th>
                  <th className="py-3.5 px-4">Current Status</th>
                  <th className="py-3.5 px-4">Quick Mark Status</th>
                  <th className="py-3.5 px-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRoster.map((member, idx) => {
                  const isSelected = focusedIndex === idx;
                  return (
                    <tr
                      key={member.id}
                      onClick={() => setFocusedIndex(idx)}
                      className={cn(
                        "transition-colors hover:bg-emerald-50/40 cursor-pointer",
                        isSelected && "bg-emerald-50/70 ring-1 ring-emerald-500"
                      )}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-gray-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="w-8 h-8 rounded-xl border border-emerald-100 shadow-2xs">
                            {member.avatarUrl && <AvatarImage src={member.avatarUrl} alt={member.name} />}
                            <AvatarFallback className="text-[10px] font-black bg-emerald-800 text-white">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-bold text-gray-900">{member.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-950 border border-amber-200 font-mono font-bold text-[11px]">
                          {member.its || member.identifier || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600 font-semibold">
                        {member.grade ? `Grade ${member.grade}-${member.section}` : member.department || "Faculty"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border",
                          STATUS_CONFIG.find((s) => s.key === member.status)?.badgeClass || "bg-gray-100 text-gray-600 border-gray-200"
                        )}>
                          {member.status === "NOT_MARKED" ? "Pending" : member.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1">
                          {STATUS_CONFIG.map((btn) => {
                            const isCurrent = member.status === btn.key;
                            const Icon = btn.icon;
                            return (
                              <button
                                key={btn.key}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStatusChange(member.id, btn.key);
                                  setFocusedIndex(idx);
                                }}
                                title={`${btn.label} (Press ${btn.hotkey})`}
                                className={cn(
                                  "px-2 py-1 rounded-lg text-[10px] font-extrabold border transition-all flex items-center gap-1",
                                  isCurrent ? btn.bgActive : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                                )}
                              >
                                <Icon className="w-3 h-3" />
                                <span>{btn.shortLabel}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          placeholder="Note..."
                          value={member.remarks || ""}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => handleRemarksChange(member.id, e.target.value)}
                          className="h-7 px-2 text-[11px] rounded-lg border border-gray-200 bg-gray-50/50 text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-emerald-400 outline-none w-32"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ── BENTO CARD GRID / KIOSK TOUCH VIEW ── */
        <div
          className={cn(
            "grid gap-4",
            viewLayout === "kiosk"
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
          )}
        >
          {filteredRoster.map((member, idx) => {
            const isMarked = member.status !== "NOT_MARKED" && Boolean(member.status);
            const isFocused = focusedIndex === idx;
            const currentStatusConfig = STATUS_CONFIG.find((s) => s.key === member.status);

            return (
              <motion.div
                key={member.id}
                layout
                onClick={() => setFocusedIndex(idx)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, delay: Math.min(idx * 0.012, 0.18) }}
                className={cn(
                  "p-4 rounded-3xl border transition-all duration-200 bg-white shadow-2xs relative flex flex-col justify-between cursor-pointer group select-none",
                  isFocused && "ring-2 ring-emerald-500 border-emerald-400 shadow-md",
                  isMarked
                    ? "border-gray-200/90 hover:border-emerald-400 hover:shadow-md"
                    : "border-amber-300/80 bg-amber-50/15 hover:border-amber-400"
                )}
              >
                {/* Top Row: Avatar, Name, ITS, Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-12 h-12 rounded-2xl border-2 border-emerald-100 shadow-2xs shrink-0">
                      {member.avatarUrl && (
                        <AvatarImage src={member.avatarUrl} alt={member.name} className="object-cover object-center" />
                      )}
                      <AvatarFallback className="font-black text-xs text-white bg-gradient-to-br from-emerald-800 to-teal-900">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-black text-gray-900 truncate font-display group-hover:text-emerald-900">
                          {member.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-extrabold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200"
                        >
                          Talabat
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-50 text-amber-950 border border-amber-300 text-[11px] font-mono font-black shadow-2xs">
                          ITS: {member.its || member.identifier || "—"}
                        </span>
                        {member.grade && (
                          <span className="text-[11px] text-gray-600 font-semibold">
                            Grade {member.grade}-{member.section}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Pill Badge */}
                  <div>
                    {currentStatusConfig ? (
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs",
                        currentStatusConfig.badgeClass
                      )}>
                        {currentStatusConfig.label}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Selection Strip with Number Hotkeys (4 Statuses: Present, Late, Absent, Leave) */}
                <div className={cn(
                  "grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4",
                  viewLayout === "kiosk" && "gap-2.5"
                )}>
                  {STATUS_CONFIG.map((btn) => {
                    const isSelected = member.status === btn.key;
                    const Icon = btn.icon;
                    return (
                      <button
                        key={btn.key}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(member.id, btn.key);
                          setFocusedIndex(idx);
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-2xl text-[11px] font-extrabold border transition-all duration-150 select-none active:scale-95 relative",
                          viewLayout === "kiosk" ? "py-3 text-xs" : "py-2.5",
                          isSelected
                            ? cn(btn.bgActive, btn.borderActive)
                            : cn(btn.bgLight, "border")
                        )}
                      >
                        <span className="absolute top-1 right-1.5 text-[9px] opacity-50 font-mono font-bold">
                          {btn.hotkey}
                        </span>
                        <Icon className={cn("w-4 h-4 mb-1 shrink-0", isSelected ? "text-white" : "opacity-80")} />
                        <span className="leading-tight">{btn.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Bottom Bar: Remarks Input & Source Indicator */}
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add attendance note / reason..."
                    value={member.remarks || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleRemarksChange(member.id, e.target.value)}
                    className="w-full h-8 px-2.5 text-[11px] font-medium rounded-xl border border-gray-200 bg-gray-50/40 text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 transition-all outline-none"
                  />
                  {member.source && (
                    <Badge variant="outline" className="text-[9px] font-mono text-gray-400 shrink-0 uppercase px-1.5 py-0.5">
                      {member.source}
                    </Badge>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Floating Sticky Commit Dock ── */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-[700px] p-4 rounded-3xl bg-slate-950/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl text-white flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shrink-0 shadow-[0_0_12px_#f59e0b]" />
              <div className="min-w-0">
                <p className="text-xs font-black text-white truncate font-display">
                  Unsaved Attendance Changes
                </p>
                <p className="text-[11px] text-emerald-200/80 truncate">
                  Ready to commit {stats.marked} attendance entries to database &amp; live registry
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded-xl h-9 px-3"
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveAttendance}
                disabled={saving}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-2xl h-9 px-5 shadow-lg flex items-center gap-1.5 active:scale-95 transition-transform"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Commit Register
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Link Existing Google Sheet Modal ── */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-emerald-500/30 text-white shadow-2xl">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#fde047]" /> Link Manual Attendance Google Sheet
            </h3>
            <p className="mt-1.5 text-xs text-gray-300 leading-relaxed">
              Paste the Google Spreadsheet URL or Spreadsheet ID to use specifically for manual classroom attendance.
            </p>

            <div className="mt-4 space-y-3">
              <input
                type="text"
                placeholder="https://docs.google.com/spreadsheets/d/... or Sheet ID"
                value={customSheetInput}
                onChange={(e) => setCustomSheetInput(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="mt-5 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowLinkModal(false)}
                className="text-gray-400 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleLinkSheet}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4"
              >
                Save &amp; Link Sheet
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
