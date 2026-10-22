"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSession } from "next-auth/react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  Users,
  GraduationCap,
  Activity,
  Fingerprint,
  Mail,
  FileText,
  Briefcase,
  ClipboardCheck,
  Zap,
  CheckCircle2,
  UserCheck,
  FileSpreadsheet,
  Moon,
  Search,
  Filter,
  Check,
  ArrowUpDown,
  SlidersHorizontal,
  X,
  Calendar,
  Building2,
  XCircle,
  HelpCircle,
  Edit3,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import {
  getAttendanceLogs,
  getAttendanceLogEvents,
  getExportAttendanceLogsUrl,
  pollHikvisionDevicesNow,
  AttendanceLogsResponse,
  ScheduledEventWindow,
  AttendanceLogRecordItem,
} from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DayDetailDrawer } from "@/components/registry/DayDetailDrawer";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";
import { getHijriFromDate } from "@/lib/fatimi-calendar";

export function formatScanTimeIST(timeStr?: string | Date | null): string {
  if (!timeStr) return "—";
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatScanDateIST(timeStr?: string | Date | null): string {
  if (!timeStr) return "—";
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

function formatRelative(iso?: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 5000) return "just now";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type StatusFilterType =
  | "ALL"
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "NOT_MARKED"
  | "MEDICAL"
  | "ON_LEAVE";

type SortOptionType =
  | "time-desc"
  | "time-asc"
  | "name-asc"
  | "name-desc"
  | "status"
  | "type"
  | "class";

export default function AdminAttendanceHikPage() {
  const todayStr = getTodayDateString();
  const { data: session } = useSession();
  const isFaculty = session?.user?.role === "TEACHER";

  const [date, setDate] = useState<string>(todayStr);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [audience, setAudience] = useState<"STUDENT" | "FACULTY" | "ALL">("STUDENT");
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>("ALL");
  const [sortBy, setSortBy] = useState<SortOptionType>("time-desc");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [data, setData] = useState<AttendanceLogsResponse | null>(null);
  const [events, setEvents] = useState<ScheduledEventWindow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [pollingHardware, setPollingHardware] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live state
  const [isLive, setIsLive] = useState<boolean>(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [livePulse, setLivePulse] = useState(false);
  const tickRef = useRef<number | null>(null);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    role: "STUDENT" | "FACULTY";
    openOverride?: boolean;
  } | null>(null);

  // Fetch events
  useEffect(() => {
    getAttendanceLogEvents()
      .then((evs) => setEvents(evs))
      .catch((err) => console.error("Failed to load events", err));
  }, []);

  // Primary loader
  const loadAttendance = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      else setRefreshing(true);
      setError(null);

      try {
        const res = await getAttendanceLogs({
          date,
          grade: selectedGrade || undefined,
          section: selectedSection || undefined,
          eventWindowId: selectedEventId || undefined,
          audience,
          logType: "HIKVISION",
        });
        setData(res);
        setLastUpdatedAt(new Date().toISOString());
        setLivePulse(true);
        setTimeout(() => setLivePulse(false), 900);
      } catch (err: any) {
        setError(err.message || "Failed to load Hikvision attendance logs");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [date, selectedGrade, selectedSection, selectedEventId, audience]
  );

  useEffect(() => {
    loadAttendance(false);
  }, [loadAttendance]);

  // Live auto-refresh polling every 15s
  useEffect(() => {
    if (!isLive || date !== todayStr) return;
    tickRef.current = window.setInterval(() => {
      loadAttendance(true);
    }, 15000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isLive, date, todayStr, loadAttendance]);

  // Immediate Hardware Polling Handler
  const handlePollDevicesNow = async () => {
    setPollingHardware(true);
    try {
      const res = await pollHikvisionDevicesNow();
      if (res.success) {
        toast({
          variant: "success",
          title: "Hardware Scans Synchronized",
          description: `Pulled ${res.data.totalFetched} live scans across ${res.data.devices.length} terminal(s) (${res.data.totalProcessed} processed into attendance).`,
        });
        await loadAttendance(true);
      } else {
        toast({
          variant: "destructive",
          title: "Hardware Sync Warning",
          description: res.message || "Failed to poll devices",
        });
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: err.message || "Failed to communicate with Hikvision terminals",
      });
    } finally {
      setPollingHardware(false);
    }
  };

  // Date controls
  const handlePrevDay = () => {
    const cur = new Date(date);
    cur.setDate(cur.getDate() - 1);
    setDate(cur.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    const cur = new Date(date);
    cur.setDate(cur.getDate() + 1);
    setDate(cur.toISOString().split("T")[0]);
  };

  const handleToday = () => {
    setDate(todayStr);
  };

  // Open Drawer
  const handleMemberClick = (memberId: string, role: "STUDENT" | "FACULTY", openOverride = false) => {
    setSelectedMember({ id: memberId, role, openOverride });
    setDrawerOpen(true);
  };

  // Scanned biometric records from server
  const allRecords = useMemo(() => data?.records || [], [data?.records]);

  // Audience scoped records (for computing status counts)
  const audienceRecords = useMemo(() => {
    if (audience === "ALL") return allRecords;
    return allRecords.filter((r) => r.role === audience);
  }, [allRecords, audience]);

  // Aggregated KPI Stats
  const stats = useMemo(() => {
    const studentsPunched = allRecords.filter((r) => r.role === "STUDENT").length;
    const facultyPunched = allRecords.filter((r) => r.role === "FACULTY").length;

    let presentCount = 0;
    let lateCount = 0;

    audienceRecords.forEach((r) => {
      if (r.status === "PRESENT") presentCount++;
      else if (r.status === "LATE") lateCount++;
    });

    return {
      totalPunched: allRecords.length,
      studentPunched: studentsPunched,
      facultyPunched: facultyPunched,
      presentCount,
      lateCount,
    };
  }, [allRecords, audienceRecords]);

  const handleStatusFilterChange = (newStatus: StatusFilterType) => {
    setStatusFilter(newStatus);
  };

  // Filter and Sort Records
  const displayRecords = useMemo(() => {
    let list = allRecords;

    // Role filter
    if (audience !== "ALL") {
      list = list.filter((r) => r.role === audience);
    }

    // Status filter
    if (statusFilter !== "ALL") {
      if (statusFilter === "NOT_MARKED") {
        list = list.filter(
          (r) =>
            r.status === "NOT_MARKED" ||
            (!r.checkInTime &&
              r.status !== "PRESENT" &&
              r.status !== "LATE" &&
              r.status !== "ABSENT" &&
              r.status !== "MEDICAL" &&
              r.status !== "ON_LEAVE")
        );
      } else {
        list = list.filter((r) => r.status === statusFilter);
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.its && r.its.toLowerCase().includes(q)) ||
          (r.designationOrClass && r.designationOrClass.toLowerCase().includes(q))
      );
    }

    // Sorting
    return [...list].sort((a, b) => {
      if (sortBy === "time-desc") {
        const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
        const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
        if (timeB !== timeA) return timeB - timeA;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "time-asc") {
        const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : Number.MAX_SAFE_INTEGER;
        const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : Number.MAX_SAFE_INTEGER;
        if (timeA !== timeB) return timeA - timeB;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name-asc") {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "name-desc") {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === "type") {
        if (a.role !== b.role) return a.role === "STUDENT" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "class") {
        const classA = a.designationOrClass || a.className || "";
        const classB = b.designationOrClass || b.className || "";
        const cmp = classA.localeCompare(classB);
        if (cmp !== 0) return cmp;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === "status") {
        const priority: Record<string, number> = {
          PRESENT: 1,
          LATE: 2,
          MEDICAL: 3,
          ON_LEAVE: 4,
          ABSENT: 5,
          NOT_MARKED: 6,
        };
        const pA = priority[a.status] || 99;
        const pB = priority[b.status] || 99;
        if (pA !== pB) return pA - pB;
        const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
        const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
        return timeB - timeA;
      }
      return 0;
    });
  }, [allRecords, audience, statusFilter, searchQuery, sortBy]);

  // Helper for Status Badge Styling
  const getStatusBadge = (status: string, hasScan: boolean) => {
    switch (status) {
      case "PRESENT":
        return {
          label: "PRESENT",
          bg: "bg-emerald-50 text-emerald-800 border-emerald-300",
          dot: "bg-emerald-500",
          icon: CheckCircle2,
        };
      case "LATE":
        return {
          label: "LATE",
          bg: "bg-amber-50 text-amber-800 border-amber-300",
          dot: "bg-amber-500",
          icon: Clock,
        };
      case "ABSENT":
        return {
          label: "ABSENT",
          bg: "bg-rose-50 text-rose-800 border-rose-300",
          dot: "bg-rose-500",
          icon: XCircle,
        };
      case "MEDICAL":
        return {
          label: "MEDICAL",
          bg: "bg-purple-50 text-purple-800 border-purple-300",
          dot: "bg-purple-500",
          icon: Activity,
        };
      case "ON_LEAVE":
        return {
          label: "ON LEAVE",
          bg: "bg-sky-50 text-sky-800 border-sky-300",
          dot: "bg-sky-500",
          icon: Briefcase,
        };
      default:
        return {
          label: hasScan ? "SCANNED" : "NOT MARKED",
          bg: "bg-slate-100 text-slate-700 border-slate-300",
          dot: "bg-slate-400",
          icon: HelpCircle,
        };
    }
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto p-3 sm:p-5 lg:p-8 space-y-4 sm:space-y-6">
      {/* ── Attendance Hub Navigation Tabs ── */}
      {!isFaculty && (
        <AdminHubTabs
          hubTitle="Attendance & Biometric Center"
          hubDescription="Real-time terminal monitoring, physical biometric scans, manual classroom registers, and automated sync."
          tabs={[
            { label: "Hikvision Scans", href: "/admin/attendance-hik", icon: Fingerprint, badge: "Hardware" },
            { label: "Manual Logs", href: "/admin/attendance-manual", icon: ClipboardCheck, badge: "Register" },
            { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
            { label: "Device Hub", href: "/admin/biometric", icon: Activity },
            { label: "Google Sheets", href: "/admin/google-sheets", icon: FileSpreadsheet, badge: "Sync" },
            { label: "Email Reports", href: "/admin/attendance-emails", icon: Mail },
          ]}
        />
      )}

      {/* ── Fatimi Luxury Hero Cockpit (Mobile Adaptive) ── */}
      <div className="relative overflow-hidden rounded-3xl border border-[#d4af37]/40 bg-gradient-to-br from-[#021f18] via-[#05372b] to-[#01140f] p-4 sm:p-6 lg:p-8 shadow-[0_16px_40px_rgba(2,31,24,0.45)] text-white">
        <div className="pointer-events-none absolute -right-16 -bottom-16 w-72 sm:w-96 h-72 sm:h-96 rounded-full bg-[#d4af37]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -top-12 w-60 sm:w-80 h-60 sm:h-80 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
          <div className="space-y-1.5 sm:space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#d4af37]/20 text-[#f5e6b3] border border-[#d4af37]/40 shadow-xs">
                <Fingerprint className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
                Hikvision Hardware Scans
              </span>
              {isLive && date === todayStr && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className={`w-2 h-2 rounded-full bg-emerald-400 shrink-0 ${livePulse ? "animate-ping" : ""}`} />
                  Live Stream
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white flex flex-wrap items-baseline gap-2">
              <span>Hikvision Biometric Scanning Logs</span>
              <span className="text-xs sm:text-sm font-arabic font-normal text-amber-300/80">سجلات البصمة والأجهزة</span>
            </h1>

            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl font-medium leading-relaxed">
              Real-time attendance punched from MinMoe face recognition &amp; fingerprint terminals. All timestamps recorded in Indian Standard Time (Asia/Kolkata).
            </p>
          </div>

          {/* Action Cockpit Buttons */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 pt-1 lg:pt-0">
            <button
              type="button"
              onClick={handlePollDevicesNow}
              disabled={pollingHardware || refreshing}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 font-black text-xs shadow-lg hover:shadow-amber-400/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50 min-h-[42px]"
              title="Poll MinMoe hardware terminals for today's scans"
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${pollingHardware ? "animate-spin" : ""}`} />
              <span className="truncate">{pollingHardware ? "Polling Devices..." : "Poll Today's Scans Now"}</span>
            </button>

            <a
              href={getExportAttendanceLogsUrl({ audience })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs shadow-sm transition-all min-h-[42px]"
            >
              <Download className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        {/* Live Terminal & Scan Stats Counter Cards (Responsive 2 / 3 / 5 column grid) */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-white/10">
          {/* Card 1: Total Scans */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80 truncate">Total Scans</div>
            <div className="text-xl sm:text-2xl font-black text-white mt-0.5 truncate">{stats.totalPunched}</div>
            <div className="text-[10px] text-white/50 font-medium truncate">Punched today</div>
          </div>

          {/* Card 2: Total Talabat (Students) */}
          <div
            onClick={() => setAudience("STUDENT")}
            className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer min-w-0 ${
              audience === "STUDENT"
                ? "bg-amber-400/20 border-amber-400/60 shadow-xs"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300/90 truncate">Talabat</span>
              <GraduationCap className="w-3 h-3 text-amber-300 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-200 mt-0.5 truncate">
              {stats.studentPunched}
            </div>
            <div className="text-[10px] text-white/60 font-medium truncate">Scanned today</div>
          </div>

          {/* Card 3: Total Faculty */}
          <div
            onClick={() => setAudience("FACULTY")}
            className={`p-2.5 sm:p-3 rounded-2xl border transition-all cursor-pointer min-w-0 ${
              audience === "FACULTY"
                ? "bg-sky-400/20 border-sky-400/60 shadow-xs"
                : "bg-white/5 border-white/10 hover:bg-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300/90 truncate">Faculty</span>
              <Briefcase className="w-3 h-3 text-sky-300 shrink-0" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-sky-200 mt-0.5 truncate">
              {stats.facultyPunched}
            </div>
            <div className="text-[10px] text-white/60 font-medium truncate">Scanned today</div>
          </div>

          {/* Card 4: Present vs Late */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 truncate">On-Time / Late</div>
            <div className="text-xl sm:text-2xl font-black text-emerald-300 mt-0.5 truncate">
              {stats.presentCount} <span className="text-xs text-amber-300 font-bold">/ {stats.lateCount} late</span>
            </div>
            <div className="text-[10px] text-white/50 font-medium truncate">Scan timing breakdown</div>
          </div>

          {/* Card 5: Hardware Status */}
          <div className="p-2.5 sm:p-3 rounded-2xl bg-white/5 border border-white/10 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-teal-300/80 truncate">Terminals</div>
            <div className="text-xl sm:text-2xl font-black text-teal-200 mt-0.5 truncate">2 Online</div>
            <div className="text-[10px] text-white/50 font-mono truncate">192.168.0.4 &amp; .5</div>
          </div>
        </div>
      </div>

      {/* ── Filter, Audience, Status Toggles & Search Toolbar ── */}
      <div className="p-3.5 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3.5 sm:space-y-4">
        {/* Row 1: Date Navigation & Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Date Picker & Quick Navigation */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 shadow-2xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleNextDay}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer transition-colors"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {date !== todayStr && (
              <button
                type="button"
                onClick={handleToday}
                className="px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-black shadow-xs hover:bg-slate-800 transition-all cursor-pointer"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Audience Toggle Buttons (All, Students, Faculty) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Audience:</span>
          </div>

          <div className="grid grid-cols-3 sm:flex items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setAudience("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center truncate ${
                audience === "ALL"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({allRecords.length})
            </button>

            <button
              type="button"
              onClick={() => setAudience("STUDENT")}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
                audience === "STUDENT"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5 shrink-0" />
              <span>Talabat ({stats.studentPunched})</span>
            </button>

            <button
              type="button"
              onClick={() => setAudience("FACULTY")}
              className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer truncate ${
                audience === "FACULTY"
                  ? "bg-indigo-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5 shrink-0" />
              <span>Faculty ({stats.facultyPunched})</span>
            </button>
          </div>
        </div>

        {/* Row 3: Status Filter Toggles (Present, Late, Absent, Not Marked, Medical, On Leave) */}
        <div className="space-y-1.5 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            <div className="flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>Filter by Status:</span>
            </div>
            {statusFilter !== "ALL" && (
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className="text-emerald-700 hover:text-emerald-900 text-[11px] font-bold lowercase tracking-normal flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                reset status filter
              </button>
            )}
          </div>

          {/* Horizontally scrollable chips on mobile with touch drag, flex-wrap on desktop */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 -mx-1 px-1 touch-pan-x">
            {/* Chip: All */}
            <button
              type="button"
              onClick={() => handleStatusFilterChange("ALL")}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                statusFilter === "ALL"
                  ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                  : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span>All Statuses</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "ALL" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-800"}`}>
                {audienceRecords.length}
              </span>
            </button>

            {/* Chip: Present */}
            <button
              type="button"
              onClick={() => handleStatusFilterChange("PRESENT")}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                statusFilter === "PRESENT"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Present</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "PRESENT" ? "bg-white/20 text-white" : "bg-emerald-200 text-emerald-900 font-bold"}`}>
                {stats.presentCount}
              </span>
            </button>

            {/* Chip: Late */}
            <button
              type="button"
              onClick={() => handleStatusFilterChange("LATE")}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                statusFilter === "LATE"
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-xs"
                  : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>Late</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === "LATE" ? "bg-slate-900/20 text-slate-950 font-black" : "bg-amber-200 text-amber-900 font-bold"}`}>
                {stats.lateCount}
              </span>
            </button>
          </div>
        </div>

        {/* Row 4: Search Box and Sort Type Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          {/* Search Box */}
          <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ITS, or grade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative w-full sm:w-auto">
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-bold shadow-2xs hover:border-slate-300">
                <ArrowUpDown className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-[11px] text-slate-500 font-medium shrink-0">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOptionType)}
                  aria-label="Sort attendance records"
                  className="bg-transparent text-xs font-bold text-slate-900 outline-none cursor-pointer pr-2"
                >
                  <option value="time-desc">Scan Time (Newest First)</option>
                  <option value="time-asc">Scan Time (Oldest First)</option>
                  <option value="name-asc">Name (A → Z)</option>
                  <option value="name-desc">Name (Z → A)</option>
                  <option value="status">Status Priority</option>
                  <option value="type">Type (Talabat First)</option>
                  <option value="class">Class / Department</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hikvision Scans: Mobile Adaptive Display ── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Container Header Banner */}
        <div className="p-3.5 sm:p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Fingerprint className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-black uppercase tracking-wider truncate">
              Biometric Scan Feed
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-emerald-300 shrink-0">
              {displayRecords.length} {displayRecords.length === 1 ? "record" : "records"}
            </span>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 text-[10px] text-slate-400 font-mono">
            {statusFilter !== "ALL" && (
              <span className="text-amber-300 font-bold">
                Filtered: {statusFilter}
              </span>
            )}
            {lastUpdatedAt && (
              <span>Last synced: {formatScanTimeIST(lastUpdatedAt)}</span>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="p-12 sm:p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs font-bold text-slate-500">Loading Hikvision attendance scans...</p>
          </div>
        ) : displayRecords.length === 0 ? (
          /* Empty State */
          <div className="p-10 sm:p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Fingerprint className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Biometric Scans Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {statusFilter !== "ALL"
                ? `No attendance records found with status "${statusFilter}". Try selecting "All Statuses" or clearing your search.`
                : "No hardware punches recorded yet for this date. Click 'Poll Today\'s Scans Now' to sync with physical terminals."}
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              {statusFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Clear Status Filter
                </button>
              )}
              <button
                type="button"
                onClick={handlePollDevicesNow}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer"
              >
                Poll Devices Now
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── MOBILE VIEW: Responsive Touch Cards (Visible on screens < lg) ── */}
            <div className="block lg:hidden divide-y divide-slate-100 p-2 sm:p-3 space-y-2.5">
              {displayRecords.map((r, i) => {
                const isFacultyMember = r.role === "FACULTY";
                const hasScan = Boolean(r.checkInTime);
                const hijri = getHijriFromDate(r.checkInTime || date);
                const badgeInfo = getStatusBadge(r.status, hasScan);
                const StatusIcon = badgeInfo.icon;

                return (
                  <div
                    key={r.id || r.memberId || i}
                    className="p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:border-emerald-500/40 shadow-xs transition-all space-y-3"
                  >
                    {/* Header Row: Avatar, Member Info, Role Badge & Status Pill */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="w-10 h-10 rounded-xl border border-slate-200 shrink-0 shadow-2xs">
                          <AvatarImage src={r.avatarUrl || undefined} />
                          <AvatarFallback
                            className={`text-[11px] font-black ${
                              isFacultyMember ? "bg-indigo-100 text-indigo-900" : "bg-emerald-100 text-emerald-900"
                            }`}
                          >
                            {getInitials(r.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-black text-xs text-slate-900 truncate">
                              {r.name}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                                isFacultyMember
                                  ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {isFacultyMember ? "Faculty" : "Talabat"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10.5px] text-slate-500 font-mono mt-0.5">
                            <span className="font-semibold text-slate-700">ITS: {r.its || "—"}</span>
                            <span>•</span>
                            <span className="truncate">{r.designationOrClass || "—"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black border tracking-wide shrink-0 shadow-2xs ${badgeInfo.bg}`}
                      >
                        <StatusIcon className="w-3 h-3 shrink-0" />
                        <span>{badgeInfo.label}</span>
                      </span>
                    </div>

                    {/* Middle Row: Exact Scan Timestamp & Verification Mode */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50/80 border border-slate-100 text-xs">
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">Exact Scan Time (IST)</div>
                        {hasScan ? (
                          <div className="mt-0.5 flex flex-col">
                            <span className="inline-flex items-center gap-1 font-mono font-black text-emerald-800 text-[11.5px]">
                              <Clock className="w-3 h-3 text-emerald-600 shrink-0" />
                              {formatScanTimeIST(r.checkInTime)}
                            </span>
                            <span className="text-[9.5px] font-medium text-slate-500">
                              {formatRelative(r.checkInTime)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Unscanned</span>
                        )}
                      </div>

                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">Terminal &amp; Mode</div>
                        <div className="mt-0.5 flex flex-col">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 truncate">
                            <Fingerprint className="w-3 h-3 text-emerald-600 shrink-0" />
                            {r.biometricMethod === "FACIAL" ? "Facial Scan" : "Fingerprint"}
                          </span>
                          <span className="text-[9.5px] text-slate-400 font-mono truncate">
                            {r.remarks?.includes("192.168.0.5") ? "Secondary (192.168.0.5)" : "Main MinMoe (192.168.0.4)"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Row: Hijri Date & Action Button */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {hijri.day} {hijri.monthNameShort} {hijri.year}H
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isFacultyMember && (
                          <button
                            type="button"
                            onClick={() => handleMemberClick(r.memberId, r.role, true)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-black text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all cursor-pointer shadow-2xs"
                            title="Direct Faculty Attendance Override"
                          >
                            <Edit3 className="w-3 h-3 text-indigo-600 shrink-0" />
                            <span>Override</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleMemberClick(r.memberId, r.role, false)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
                        >
                          <span>Audit / View Logs</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── DESKTOP VIEW: High-Density Tabular Display (Visible on lg+) ── */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-700 font-black text-[10.5px] uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-center w-12">Photo</th>
                    <th
                      scope="col"
                      onClick={() => setSortBy(sortBy === "name-asc" ? "name-desc" : "name-asc")}
                      className="px-4 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                      title="Click to sort by name"
                    >
                      <div className="flex items-center gap-1">
                        <span>Member Name &amp; Role</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th scope="col" className="px-3 py-3 font-mono">ITS / ID</th>
                    <th
                      scope="col"
                      onClick={() => setSortBy("class")}
                      className="px-3 py-3 cursor-pointer hover:bg-slate-100 transition-colors"
                      title="Click to sort by class"
                    >
                      <div className="flex items-center gap-1">
                        <span>Class / Dept</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th
                      scope="col"
                      onClick={() => setSortBy(sortBy === "time-desc" ? "time-asc" : "time-desc")}
                      className="px-4 py-3 text-center bg-emerald-50/60 border-x border-emerald-100 cursor-pointer hover:bg-emerald-100/60 transition-colors"
                      title="Click to sort by exact scan time"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Exact Scan Time (IST)</span>
                        <ArrowUpDown className="w-3 h-3 text-emerald-700" />
                      </div>
                    </th>
                    <th scope="col" className="px-3 py-3">Biometric Mode</th>
                    <th scope="col" className="px-3 py-3">Device / Terminal</th>
                    <th
                      scope="col"
                      onClick={() => setSortBy("status")}
                      className="px-3 py-3 text-center cursor-pointer hover:bg-slate-100 transition-colors"
                      title="Click to sort by status"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Status</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-400" />
                      </div>
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {displayRecords.map((r, i) => {
                    const isFacultyMember = r.role === "FACULTY";
                    const hasScan = Boolean(r.checkInTime);
                    const hijri = getHijriFromDate(r.checkInTime || date);
                    const badgeInfo = getStatusBadge(r.status, hasScan);

                    return (
                      <tr
                        key={r.id || r.memberId || i}
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Photo */}
                        <td className="px-3 py-2.5 text-center">
                          <Avatar className="w-9 h-9 mx-auto rounded-xl border border-slate-200 shadow-2xs">
                            <AvatarImage src={r.avatarUrl || undefined} />
                            <AvatarFallback
                              className={`text-[10px] font-black ${
                                isFacultyMember ? "bg-indigo-100 text-indigo-900" : "bg-emerald-100 text-emerald-900"
                              }`}
                            >
                              {getInitials(r.name)}
                            </AvatarFallback>
                          </Avatar>
                        </td>

                        {/* Name & Role */}
                        <td className="px-4 py-2.5 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate">{r.name}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-black shrink-0 ${
                                isFacultyMember
                                  ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                                  : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              }`}
                            >
                              {isFacultyMember ? "Faculty" : "Talabat"}
                            </span>
                          </div>
                        </td>

                        {/* ITS / ID */}
                        <td className="px-3 py-2.5 font-mono font-bold text-slate-700">
                          {r.its || "—"}
                        </td>

                        {/* Class / Department */}
                        <td className="px-3 py-2.5 text-slate-600">
                          <div className="font-semibold text-slate-800">{r.designationOrClass || "—"}</div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {hijri.day} {hijri.monthNameShort}
                          </div>
                        </td>

                        {/* Exact Scan Time (IST) - PROMINENT DISPLAY */}
                        <td className="px-4 py-2.5 text-center bg-emerald-50/30 border-x border-emerald-100/60">
                          {hasScan ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-700 text-white font-mono shadow-xs">
                                <Clock className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
                                <span>{formatScanTimeIST(r.checkInTime)}</span>
                              </span>
                              <span className="text-[9.5px] font-semibold text-slate-500 mt-1">
                                {formatRelative(r.checkInTime)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10.5px] text-slate-400 font-mono italic">
                              Unscanned
                            </span>
                          )}
                        </td>

                        {/* Biometric Mode */}
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs">
                            <Fingerprint className="w-3 h-3 text-emerald-600" />
                            <span>{r.biometricMethod === "FACIAL" ? "Facial Recognition" : "Fingerprint"}</span>
                          </span>
                        </td>

                        {/* Device / Terminal */}
                        <td className="px-3 py-2.5 text-[11px] text-slate-600 font-mono">
                          <div className="font-bold text-slate-800 truncate">
                            {r.remarks?.includes("192.168.0.5") ? "Secondary Terminal" : "Main Entrance MinMoe"}
                          </div>
                          <div className="text-[9.5px] text-slate-400">
                            {r.remarks?.includes("192.168.0.5") ? "192.168.0.5" : "192.168.0.4"}
                          </div>
                        </td>

                        {/* Attendance Status */}
                        <td className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-black border tracking-wide shadow-2xs ${badgeInfo.bg}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${badgeInfo.dot}`} />
                            <span>{badgeInfo.label}</span>
                          </span>
                        </td>

                        {/* Action */}
                        <td className="px-3 py-2.5 text-right">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            {isFacultyMember && (
                              <button
                                type="button"
                                onClick={() => handleMemberClick(r.memberId, r.role, true)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10.5px] font-black text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all cursor-pointer shadow-2xs"
                                title="Direct Faculty Attendance Override"
                              >
                                <Edit3 className="w-3 h-3 text-indigo-600 shrink-0" />
                                <span>Override</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleMemberClick(r.memberId, r.role, false)}
                              className="px-2.5 py-1 rounded-xl text-[10.5px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
                            >
                              View Logs
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Student / Faculty Drawer ── */}
      {selectedMember && drawerOpen && (
        <DayDetailDrawer
          studentId={selectedMember.role === "STUDENT" ? selectedMember.id : undefined}
          teacherId={selectedMember.role === "FACULTY" ? selectedMember.id : undefined}
          role={selectedMember.role}
          targetDate={date}
          initialOverrideOpen={selectedMember.openOverride || false}
          onClose={() => {
            setDrawerOpen(false);
            setSelectedMember(null);
          }}
          onOverrideSuccess={() => {
            loadAttendance(true);
          }}
        />
      )}
    </div>
  );
}
