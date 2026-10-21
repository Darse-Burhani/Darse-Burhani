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

export default function AdminAttendanceHikPage() {
  const todayStr = getTodayDateString();
  const { data: session } = useSession();
  const isFaculty = session?.user?.role === "TEACHER";

  const [date, setDate] = useState<string>(todayStr);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [audience, setAudience] = useState<"STUDENT" | "FACULTY" | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showPunchedOnly, setShowPunchedOnly] = useState<boolean>(true);

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
  const [selectedMember, setSelectedMember] = useState<{ id: string; role: "STUDENT" | "FACULTY" } | null>(null);

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

  // Live auto-refresh polling
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
  const handleMemberClick = (memberId: string, role: "STUDENT" | "FACULTY") => {
    setSelectedMember({ id: memberId, role });
    setDrawerOpen(true);
  };

  // Filter records
  const allRecords = data?.records || [];
  const displayRecords = useMemo(() => {
    let list = allRecords;

    // Filter Punched vs Full Roster
    if (showPunchedOnly) {
      list = list.filter(
        (r) =>
          Boolean(r.checkInTime) &&
          (r.source === "SCAN" || r.source === "BIOMETRIC" || r.verificationMethod === "BIOMETRIC" || (r.status !== "NOT_MARKED" && r.status !== "ABSENT"))
      );
    }

    // Role filter
    if (audience !== "ALL") {
      list = list.filter((r) => r.role === audience);
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

    // Sort by checkInTime descending (most recent first)
    return [...list].sort((a, b) => {
      const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
      const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
      return timeB - timeA;
    });
  }, [allRecords, showPunchedOnly, audience, searchQuery]);

  // Aggregated KPI Stats
  const stats = useMemo(() => {
    const punched = allRecords.filter((r) => Boolean(r.checkInTime));
    const studentsPunched = punched.filter((r) => r.role === "STUDENT");
    const facultyPunched = punched.filter((r) => r.role === "FACULTY");
    const onTime = punched.filter((r) => r.status === "PRESENT");
    const late = punched.filter((r) => r.status === "LATE");

    return {
      totalPunched: punched.length,
      studentPunched: studentsPunched.length,
      facultyPunched: facultyPunched.length,
      onTimeCount: onTime.length,
      lateCount: late.length,
      totalExpected: allRecords.length,
    };
  }, [allRecords]);

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-[1440px] mx-auto space-y-6">
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

      {/* ── Fatimi Luxury Hero Cockpit ── */}
      <div className="relative overflow-hidden rounded-3xl border border-[#d4af37]/40 bg-gradient-to-br from-[#021f18] via-[#05372b] to-[#01140f] p-6 sm:p-8 shadow-[0_16px_40px_rgba(2,31,24,0.45)] text-white">
        <div className="pointer-events-none absolute -right-16 -bottom-16 w-96 h-96 rounded-full bg-[#d4af37]/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -top-12 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#d4af37]/20 text-[#f5e6b3] border border-[#d4af37]/40 shadow-xs">
                <Fingerprint className="w-3.5 h-3.5 text-[#d4af37]" />
                Hikvision Hardware Scans
              </span>
              {isLive && date === todayStr && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className={`w-2 h-2 rounded-full bg-emerald-400 ${livePulse ? "animate-ping" : ""}`} />
                  Live Stream
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              Hikvision Biometric Scanning Logs
              <span className="text-sm font-arabic font-normal text-amber-300/80">سجلات البصمة والأجهزة</span>
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 max-w-2xl font-medium leading-relaxed">
              Real-time attendance punched from MinMoe face recognition &amp; fingerprint terminals. All timestamps recorded in Indian Standard Time (Asia/Kolkata).
            </p>
          </div>

          {/* Action Cockpit Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handlePollDevicesNow}
              disabled={pollingHardware || refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 font-black text-xs shadow-lg hover:shadow-amber-400/30 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
              title="Poll MinMoe hardware terminals for today's scans"
            >
              <RefreshCw className={`w-4 h-4 ${pollingHardware ? "animate-spin" : ""}`} />
              <span>{pollingHardware ? "Polling Devices..." : "Poll Today's Scans Now"}</span>
            </button>

            <a
              href={getExportAttendanceLogsUrl({ audience })}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs shadow-sm transition-all"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        {/* Live Terminal & Scan Stats Counter Cards */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">Total Punches Today</div>
            <div className="text-2xl font-black text-white mt-0.5">{stats.totalPunched}</div>
            <div className="text-[10px] text-white/50 font-medium">Scans recorded</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">Talabat (Students)</div>
            <div className="text-2xl font-black text-amber-200 mt-0.5">{stats.studentPunched}</div>
            <div className="text-[10px] text-white/50 font-medium">Student check-ins</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300/80">Faculty Members</div>
            <div className="text-2xl font-black text-sky-200 mt-0.5">{stats.facultyPunched}</div>
            <div className="text-[10px] text-white/50 font-medium">Staff check-ins</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">On-Time / Late</div>
            <div className="text-2xl font-black text-emerald-300 mt-0.5">
              {stats.onTimeCount} <span className="text-xs text-amber-300 font-bold">/ {stats.lateCount} late</span>
            </div>
            <div className="text-[10px] text-white/50 font-medium">Scan timing audit</div>
          </div>
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
            <div className="text-[10px] font-bold uppercase tracking-wider text-teal-300/80">Hardware Terminals</div>
            <div className="text-2xl font-black text-teal-200 mt-0.5">2 Online</div>
            <div className="text-[10px] text-white/50 font-mono">192.168.0.4 &amp; .5</div>
          </div>
        </div>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Date Picker & Quick Navigation */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs font-bold text-slate-900 shadow-2xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={handleNextDay}
              className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
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

          {/* Roster Mode Switcher: Punched Scans vs Full Biometric Roster */}
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setShowPunchedOnly(true)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                showPunchedOnly
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Punched Scans Only ({stats.totalPunched})
            </button>
            <button
              type="button"
              onClick={() => setShowPunchedOnly(false)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                !showPunchedOnly
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Full Biometric Roster ({stats.totalExpected})
            </button>
          </div>
        </div>

        {/* Second Filter Row: Audience + Search + Class */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAudience("ALL")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                audience === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Members
            </button>
            <button
              type="button"
              onClick={() => setAudience("STUDENT")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                audience === "STUDENT"
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Talabat
            </button>
            <button
              type="button"
              onClick={() => setAudience("FACULTY")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                audience === "FACULTY"
                  ? "bg-indigo-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Faculty Staff
            </button>
          </div>

          {/* Search Box */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, ITS, or grade..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none"
            />
          </div>
        </div>
      </div>

      {/* ── Hikvision Scans Table with Exact Scan Time (IST) ── */}
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-black uppercase tracking-wider">
              {showPunchedOnly ? "Punched Biometric Scan Feed" : "Hardware Attendance Roster"}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">({displayRecords.length} records)</span>
          </div>
          {lastUpdatedAt && (
            <span className="text-[10px] text-slate-400 font-mono">
              Last synced: {formatScanTimeIST(lastUpdatedAt)}
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            <p className="text-xs font-bold text-slate-500">Loading Hikvision attendance scans...</p>
          </div>
        ) : displayRecords.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Fingerprint className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Biometric Scans Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {showPunchedOnly
                ? "No hardware punches recorded yet for this date. Click 'Poll Today\'s Scans Now' to sync with physical terminals."
                : "No members matched the active filter criteria."}
            </p>
            <button
              type="button"
              onClick={handlePollDevicesNow}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer"
            >
              Poll Device Scans Now
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-700 font-black text-[10.5px] uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th scope="col" className="px-3 py-3 text-center w-12">Photo</th>
                  <th scope="col" className="px-4 py-3">Member Name &amp; Role</th>
                  <th scope="col" className="px-3 py-3 font-mono">ITS / ID</th>
                  <th scope="col" className="px-3 py-3">Class / Dept</th>
                  <th scope="col" className="px-4 py-3 text-center bg-emerald-50/60 border-x border-emerald-100">
                    Exact Scan Time (IST)
                  </th>
                  <th scope="col" className="px-3 py-3">Biometric Mode</th>
                  <th scope="col" className="px-3 py-3">Device / Terminal</th>
                  <th scope="col" className="px-3 py-3 text-center">Status</th>
                  <th scope="col" className="px-3 py-3 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {displayRecords.map((r, i) => {
                  const isFaculty = r.role === "FACULTY";
                  const hasScan = Boolean(r.checkInTime);
                  const hijri = getHijriFromDate(r.checkInTime || date);
                  const isLate = r.status === "LATE";
                  const isPresent = r.status === "PRESENT";

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
                              isFaculty ? "bg-indigo-100 text-indigo-900" : "bg-emerald-100 text-emerald-900"
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
                              isFaculty
                                ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            }`}
                          >
                            {isFaculty ? "Staff" : "Talabat"}
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
                        <div className="font-bold text-slate-800">
                          {r.remarks?.includes("192.168.0.5") ? "Secondary Terminal" : "Main Entrance MinMoe"}
                        </div>
                        <div className="text-[9.5px] text-slate-400">
                          {r.remarks?.includes("192.168.0.5") ? "192.168.0.5" : "192.168.0.4"}
                        </div>
                      </td>

                      {/* Attendance Status */}
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-black border tracking-wide shadow-2xs ${
                            isPresent
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : isLate
                              ? "bg-amber-50 text-amber-800 border-amber-300"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          {isPresent ? "PRESENT" : isLate ? "LATE" : r.status || "UNMARKED"}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="px-3 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleMemberClick(r.memberId, r.role)}
                          className="px-2.5 py-1 rounded-xl text-[10.5px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
                        >
                          View Logs
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Student / Faculty Drawer ── */}
      {selectedMember && drawerOpen && (
        <DayDetailDrawer
          studentId={selectedMember.id}
          targetDate={date}
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
