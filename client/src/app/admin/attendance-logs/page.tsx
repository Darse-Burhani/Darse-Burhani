import React, { useState, useEffect, useCallback, useRef } from "react";
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
  Eye,
  EyeOff,
  Activity,
  Fingerprint,
  Mail,
  FileText,
  Layers,
  Briefcase,
  ClipboardCheck,
  Zap,
  UserCheck,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import {
  getAttendanceLogs,
  getAttendanceLogEvents,
  getExportAttendanceLogsUrl,
  pollHikvisionDevicesNow,
  AttendanceLogsResponse,
  ScheduledEventWindow,
} from "@/lib/api";
import { DailyStackedLogView } from "@/components/registry/DailyStackedLogView";
import { DayDetailDrawer } from "@/components/registry/DayDetailDrawer";
import { ManualAttendanceModal } from "@/components/attendance/ManualAttendanceModal";
import { toast } from "@/components/ui/toast";
import {
  saveDailyArchive,
  generateWeeklyReports,
  generateMonthlyBifurcatedCsv,
  downloadCsv,
  getArchiveStats,
  getAllArchivedDays,
} from "@/lib/attendance-archive";
import {
  isWindowOpenNow,
  isFinalAttendanceEvent,
} from "@/lib/attendance-window";

function formatRelative(iso: string | null) {
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

function ArchiveWeeklyPanel({
  archiveMonth,
  setArchiveMonth,
  archiveStats,
  setArchiveStats,
}: {
  archiveMonth: string;
  setArchiveMonth: (v: string) => void;
  archiveStats: { totalDays: number; earliest?: string; latest?: string };
  setArchiveStats: (v: { totalDays: number; earliest?: string; latest?: string }) => void;
}) {
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    setArchiveStats(getArchiveStats());
  }, [refreshKey, setArchiveStats]);

  const weekly = generateWeeklyReports(archiveMonth);
  const monthly = generateMonthlyBifurcatedCsv(archiveMonth);
  const daysInMonth = getAllArchivedDays().filter((d) => d.startsWith(archiveMonth)).length;

  return (
    <div className="p-4 rounded-[18px] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 border border-slate-800 shadow-md text-white relative overflow-hidden">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.14em] uppercase text-amber-300 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Local Archive & Weekly Reports
          </p>
          <p className="text-[11px] text-slate-300 mt-1">
            Historical attendance archive with instant weekly individual reports (Talabat + Faculty bifurcated).
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Archived days: <b className="text-emerald-300">{archiveStats.totalDays}</b> {archiveStats.earliest ? `· ${archiveStats.earliest} → ${archiveStats.latest}` : ""} · Month <b className="text-white">{archiveMonth}</b>: <b className="text-amber-300">{daysInMonth}</b> days
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={archiveMonth}
            onChange={(e) => setArchiveMonth(e.target.value)}
            className="h-9 px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-xs font-semibold"
          />
          <button
            type="button"
            onClick={() => {
              if (!monthly) {
                toast({ title: "No archived days for this month", variant: "warning" });
                return;
              }
              downloadCsv(monthly.csv, monthly.filename);
              toast({ title: "Monthly bifurcated CSV downloaded", variant: "success" });
            }}
            disabled={!monthly}
            className="h-9 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-black"
          >
            <Download className="w-3.5 h-3.5 inline mr-1" /> Monthly CSV
          </button>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/15"
          >
            <RefreshCw className="w-3.5 h-3.5 inline mr-1" /> Refresh
          </button>
        </div>
      </div>

      {weekly.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mt-4 relative">
          {weekly.map((w) => (
            <button
              key={w.weekLabel}
              type="button"
              onClick={() => {
                downloadCsv(w.csv, w.filename);
                toast({ title: `${w.weekLabel} downloaded`, variant: "success" });
              }}
              className="p-3 rounded-xl bg-white text-slate-900 text-left hover:bg-amber-50 border border-amber-200 shadow-sm transition-colors group"
            >
              <p className="text-xs font-black text-slate-900 group-hover:text-indigo-700">{w.weekLabel}</p>
              <p className="text-[11px] text-slate-500 mt-0.5">{w.dates.length} days · {w.dates.join(", ").slice(0, 48)}</p>
              <p className="text-[10px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
                <Download className="w-3 h-3" /> Weekly CSV
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminAttendanceLogsPage() {
  const todayStr = getTodayDateString();
  const { data: session } = useSession();
  const isFaculty = session?.user?.role === "TEACHER";

  const [date, setDate] = useState<string>(todayStr);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [audience, setAudience] = useState<"STUDENT" | "FACULTY" | "ALL">("ALL");
  const [logType, setLogType] = useState<"HIKVISION" | "MANUAL" | "ALL">(isFaculty ? "MANUAL" : "ALL");

  useEffect(() => {
    if (isFaculty) {
      setLogType("MANUAL");
    }
  }, [isFaculty]);

  const [data, setData] = useState<AttendanceLogsResponse | null>(null);
  const [events, setEvents] = useState<ScheduledEventWindow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live state
  const [isLive, setIsLive] = useState<boolean>(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [livePulse, setLivePulse] = useState(false);
  const tickRef = useRef<number | null>(null);
  // Archive / weekly reports
  const [archiveMonth, setArchiveMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [archiveStats, setArchiveStats] = useState<{ totalDays: number; earliest?: string; latest?: string }>({ totalDays: 0 });
  const lastFetchRef = useRef(0);

  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [isSyncingHardware, setIsSyncingHardware] = useState(false);

  const handleSyncHardwareNow = async () => {
    setIsSyncingHardware(true);
    try {
      const res = await pollHikvisionDevicesNow();
      toast({
        title: "Hardware Terminals Synced",
        description: res.message || `Pulled ${res.data?.totalFetched ?? 0} scans (${res.data?.totalProcessed ?? 0} processed).`,
        variant: "success",
      });
      await fetchData(true);
    } catch (err: any) {
      toast({
        title: "Hardware Sync Notice",
        description: err?.message || "Failed to poll physical terminals",
        variant: "warning",
      });
      await fetchData(true);
    } finally {
      setIsSyncingHardware(false);
    }
  };

  const fetchEvents = useCallback(async () => {
    try {
      const res = await getAttendanceLogEvents();
      const eventList = res || [];
      setEvents(eventList);
    } catch (err) {
      console.error("Failed to load schedule events:", err);
    }
  }, []);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      const now = Date.now();
      if (now - lastFetchRef.current < 800 && isRefresh) return;
      lastFetchRef.current = now;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const effectiveLogType = isFaculty ? "MANUAL" : logType;
        const effectiveEventWindowId = effectiveLogType !== "MANUAL" && selectedEventId && selectedEventId !== "ALL" ? selectedEventId : undefined;
        const res = await getAttendanceLogs({
          date,
          grade: selectedGrade || undefined,
          section: selectedSection || undefined,
          eventWindowId: effectiveEventWindowId,
          audience,
          logType: effectiveLogType,
        });
        setData(res);
        setLastUpdatedAt(new Date().toISOString());
        setLivePulse(true);
        setTimeout(() => setLivePulse(false), 600);

        // Persist daily archive
        try {
          saveDailyArchive(date, {
            records: res.records,
            summary: res.summary,
            talabatSummary: (res as any).talabatSummary,
            facultySummary: (res as any).facultySummary,
            overallSummary: (res as any).overallSummary,
          } as any);
        } catch {}
      } catch (err: any) {
        console.error("Attendance logs fetch error:", err);
        setError(err.message || "Failed to load attendance logs");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [date, selectedGrade, selectedSection, selectedEventId, audience, logType, isFaculty]
  );

  // Initial
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // ── Window-aware live pull ──
  const selectedWindowOpen = (() => {
    if (date !== todayStr) return false;
    if (events.length === 0) return true;
    const targetEvent = events.find((e) => e.id === selectedEventId) || events[0];
    if (!targetEvent) return true;
    const studentOpen = isWindowOpenNow(targetEvent);
    const facultyTimer =
      targetEvent.facultyStartTime && targetEvent.facultyEndTime
        ? {
            startTime: targetEvent.facultyStartTime,
            endTime: targetEvent.facultyEndTime,
            lateEndTime: targetEvent.facultyLateEndTime || targetEvent.facultyEndTime,
            enabled: targetEvent.facultyEnabled ?? targetEvent.enabled,
          }
        : null;
    const facultyOpen = facultyTimer ? isWindowOpenNow(facultyTimer) : studentOpen;
    if (audience === "FACULTY") return facultyOpen;
    return studentOpen;
  })();

  // Live mirror of the window-open flag for the always-connected SSE handler.
  const windowOpenRef = useRef(true);
  windowOpenRef.current = selectedWindowOpen;

  // Live polling — high-precision 2s interval when enabled, today only, window open only
  useEffect(() => {
    if (!isLive) return;
    if (!selectedWindowOpen) return;

    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchData(true);
    }, 2000);
    tickRef.current = id;
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [isLive, selectedWindowOpen, fetchData]);

  // SSE live trigger
  useEffect(() => {
    if (!isLive) return;
    const isToday = date === todayStr;
    if (!isToday) return;

    let es: EventSource | null = null;
    let retry: number | null = null;
    const connect = () => {
      es = new EventSource("/api/biometric/events/stream");
      es.onerror = () => {
        try { es?.close(); } catch {}
        if (retry === null) {
          retry = window.setTimeout(() => {
            retry = null;
            connect();
          }, 3000) as unknown as number;
        }
      };
      es.onmessage = (msg) => {
        try {
          const ev = JSON.parse((msg as MessageEvent).data);
          if (ev?.type === "WINDOW_CLOSED" || ev?.type === "TOO_EARLY") {
            return; // Outside window — no attendance recorded or changed
          }
          if (isFinalAttendanceEvent(ev?.type)) {
            fetchData(true);
            return;
          }
          if (!windowOpenRef.current) return;
          if (ev && (ev.type === "MATCHED" || ev.type === "DUPLICATE" || ev.student || ev.teacher || ev.status)) {
            fetchData(true);
          }
        } catch {
          if (windowOpenRef.current) fetchData(true);
        }
      };
    };
    connect();
    return () => {
      if (retry) window.clearTimeout(retry);
      if (es) es.close();
    };
  }, [isLive, date, todayStr, fetchData]);

  // Keep relative time fresh
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => forceTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  const handlePrevDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    setDate(d.toISOString().slice(0, 10));
  };
  const handleNextDay = () => {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    setDate(d.toISOString().slice(0, 10));
  };
  const handleToday = () => setDate(todayStr);

  const exportTalabatUrl = getExportAttendanceLogsUrl({
    startDate: date,
    endDate: date,
    grade: selectedGrade || undefined,
    section: selectedSection || undefined,
    audience: "STUDENT",
  });
  const exportFacultyUrl = getExportAttendanceLogsUrl({
    startDate: date,
    endDate: date,
    audience: "FACULTY",
  });

  const totalLiveCount = data?.summary.total ?? 0;
  const activeEvent = events.find((e) => e.id === selectedEventId);
  const isFacultyOnlyEvent = Boolean(
    activeEvent && (
      (data as any)?.isFacultyOnly ||
      activeEvent.audience === "FACULTY"
    )
  );
  const isStudentOnlyEvent = Boolean(
    activeEvent && (
      (data as any)?.isStudentOnly ||
      activeEvent.audience === "ALL_STUDENTS" ||
      activeEvent.audience === "STUDENT"
    )
  );
  const isTilawatSelected = Boolean(
    data?.isTilawatDua ||
    (activeEvent && /tilawat/i.test(activeEvent.name))
  );

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId);
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;
    if (ev.audience === "FACULTY") {
      setAudience("FACULTY");
    } else if (ev.audience === "ALL_STUDENTS" || ev.audience === "STUDENT") {
      setAudience("STUDENT");
    }
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      {/* ── Attendance Hub Navigation Tabs (Admin Only) ── */}
      {!isFaculty && (
        <AdminHubTabs
          hubTitle="Attendance & Biometric Center"
          hubDescription="Real-time terminal monitoring, manual classroom registers, scan windows, and automated reports."
          tabs={[
            { label: "Hikvision Device Hub", href: "/admin/biometric", icon: Fingerprint, badge: "Automated" },
            { label: "Manual Classroom Register", href: "/admin/manual-attendance", icon: ClipboardCheck },
            { label: "Live Scans & Logs", href: "/admin/attendance-logs", icon: FileText, badge: "Audit" },
            { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
          ]}
        />
      )}

      {/* ── Premium Streamlined Header ── */}
      <div className="relative overflow-hidden rounded-[20px] border border-emerald-100 bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 p-5 sm:p-6 shadow-lg">
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }} />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[18px] sm:text-[22px] font-black tracking-tight text-white flex items-center gap-2">
                <span className="inline-flex w-8 h-8 rounded-xl bg-white/10 border border-white/15 items-center justify-center">
                  {logType === "HIKVISION" ? <Fingerprint className="w-4 h-4 text-emerald-300" /> : <FileText className="w-4 h-4 text-emerald-300" />}
                </span>
                {isFaculty ? "Manual Attendance Logs" : logType === "HIKVISION" ? "Hikvision Biometric Scan Logs" : "Manual Classroom Attendance Logs"}
              </h1>
            </div>
            <p className="text-[12px] leading-relaxed text-emerald-100/80 max-w-2xl">
              {isFaculty
                ? "Faculty view — review student classroom roll-call entries, manual status marks, and excused absences."
                : logType === "HIKVISION"
                ? "Direct hardware scan logs from Hikvision terminals with punch timestamps and verification methods."
                : "Teacher roll-call registers, manual overrides, medical exemptions, and approved leaves."}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-white/10 text-emerald-100 border border-white/15">
                <Clock className="w-3.5 h-3.5 text-emerald-300" />
                Last sync: {formatRelative(lastUpdatedAt)}
              </span>
              {data && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-white text-emerald-900">
                  <Activity className={`w-3.5 h-3.5 ${livePulse ? "text-emerald-600 animate-bounce" : "text-gray-500"}`} />
                  {totalLiveCount} records • {date}
                </span>
              )}
              {isTilawatSelected && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black bg-amber-400 text-slate-950 shadow-md">
                  <Sparkles className="w-3.5 h-3.5" />
                  Tilawat al-Dua — Talabat & Faculty Window
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            {/* Live toggle */}
            <button
              type="button"
              onClick={() => setIsLive((v) => !v)}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${isLive ? "bg-emerald-400 text-emerald-950 shadow-lg" : "bg-white/10 text-white border border-white/20 hover:bg-white/15"}`}
            >
              {isLive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {isLive ? "Live ON" : "Live OFF"}
            </button>

            {/* Date nav */}
            <div className="flex items-center rounded-xl bg-white p-1 shadow-md border border-gray-100">
              <button type="button" onClick={handlePrevDay} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="px-2 py-1 text-xs font-extrabold text-gray-900 bg-transparent focus:outline-none cursor-pointer"
              />
              <button type="button" onClick={handleNextDay} className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 cursor-pointer">
                <ChevronRight className="w-4 h-4" />
              </button>
              {date !== todayStr && (
                <button type="button" onClick={handleToday} className="ml-1 px-2.5 py-1 rounded-lg text-[11px] font-black bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer">
                  Today
                </button>
              )}
            </div>

            {logType !== "MANUAL" && (
              <button
                type="button"
                onClick={handleSyncHardwareNow}
                disabled={isSyncingHardware}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-md cursor-pointer disabled:opacity-50 transition-all"
                title="Pull and sync scans from all Hikvision biometric terminals immediately"
              >
                <Zap className={`w-3.5 h-3.5 fill-current ${isSyncingHardware ? "animate-spin text-slate-950" : ""}`} />
                {isSyncingHardware ? "Syncing..." : "Sync Terminals"}
              </button>
            )}

            <button
              type="button"
              onClick={() => setManualModalOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              Record Manual
            </button>

            <button
              type="button"
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-white hover:bg-gray-50 text-gray-700 shadow-md border border-gray-100 cursor-pointer"
              title="Refresh now"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
            </button>

            {/* CSV Download Buttons: Talabat & Faculty */}
            <div className="flex items-center gap-2">
              <a
                href={exportTalabatUrl}
                download
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-xs shadow-md transition-all cursor-pointer"
                title="Download Talabat (Students) CSV"
              >
                <GraduationCap className="w-4 h-4" />
                <span>Talabat CSV</span>
              </a>
              <a
                href={exportFacultyUrl}
                download
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs shadow-md transition-all cursor-pointer"
                title="Download Faculty (Staff) CSV"
              >
                <Briefcase className="w-4 h-4" />
                <span>Faculty CSV</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Log Subsystem Switcher (All vs Hikvision vs Manual Logs) ── */}
      {!isFaculty && (
        <div className="p-1.5 rounded-2xl bg-gray-100 border border-gray-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 ml-2">Log Mode:</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 w-full sm:w-auto">
            {/* All Logs Pill */}
            <button
              type="button"
              onClick={() => setLogType("ALL")}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                logType === "ALL"
                  ? "bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md font-black ring-2 ring-slate-700/40"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              <Layers className={`w-3.5 h-3.5 ${logType === "ALL" ? "text-amber-300" : "text-gray-600"}`} />
              <span>All Logs</span>
              {data?.overallSummary && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${logType === "ALL" ? "bg-white/20 text-white" : "bg-gray-100 text-gray-800"}`}>
                  {data.overallSummary.total}
                </span>
              )}
            </button>

            {/* Hikvision Biometric Log Pill */}
            <button
              type="button"
              onClick={() => setLogType("HIKVISION")}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                logType === "HIKVISION"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md font-black ring-2 ring-emerald-500/40"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              <Fingerprint className={`w-3.5 h-3.5 ${logType === "HIKVISION" ? "text-emerald-200" : "text-emerald-600"}`} />
              <span>Hikvision Scans</span>
              {data?.hikvisionSummary && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${logType === "HIKVISION" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"}`}>
                  {data.hikvisionSummary.total}
                </span>
              )}
            </button>

            {/* Manual Attendance Log Pill */}
            <button
              type="button"
              onClick={() => setLogType("MANUAL")}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                logType === "MANUAL"
                  ? "bg-gradient-to-r from-blue-600 to-indigo-700 text-white shadow-md font-black ring-2 ring-blue-500/40"
                  : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200"
              }`}
            >
              <ClipboardCheck className={`w-3.5 h-3.5 ${logType === "MANUAL" ? "text-blue-200" : "text-blue-600"}`} />
              <span>Manual Register</span>
              {data?.manualSummary && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${logType === "MANUAL" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-800"}`}>
                  {data.manualSummary.total}
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Audience Selector & Event Filter Bar ── */}
      <div className="p-3.5 rounded-[18px] bg-white border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <div>
              <span className="text-[11px] font-black tracking-[0.14em] uppercase text-gray-500">Roster Audience &amp; Events</span>
              <p className="text-[10.5px] text-gray-400 font-medium">All active Talabat &amp; Faculty applicable for scanning and roll-call</p>
            </div>
            {refreshing && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 ml-2"><Loader2 className="w-3 h-3 animate-spin" /> syncing…</span>}
          </div>

          {/* Unified 3-way Audience Selector */}
          <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200">
            <button
              type="button"
              onClick={() => setAudience("ALL")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${audience === "ALL" ? "bg-slate-900 text-white shadow" : "text-gray-600 hover:text-gray-900"}`}
            >
              <Users className="w-3.5 h-3.5 text-amber-300" />
              All Members
              {data?.overallSummary && <span className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-black ${audience === "ALL" ? "bg-white/20 text-white" : "bg-white text-gray-700 border"}`}>{data.overallSummary.total}</span>}
            </button>
            <button
              type="button"
              onClick={() => setAudience("STUDENT")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${audience === "STUDENT" ? "bg-emerald-600 text-white shadow" : "text-gray-600 hover:text-gray-900"}`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Talabat
              {data?.talabatSummary && <span className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-black ${audience === "STUDENT" ? "bg-white/20 text-white" : "bg-white text-gray-700 border"}`}>{data.talabatSummary.total}</span>}
            </button>
            <button
              type="button"
              onClick={() => setAudience("FACULTY")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${audience === "FACULTY" ? "bg-indigo-600 text-white shadow" : "text-gray-600 hover:text-gray-900"}`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Faculty
              {data?.facultySummary && <span className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-black ${audience === "FACULTY" ? "bg-white/20 text-white" : "bg-white text-gray-700 border"}`}>{data.facultySummary.total}</span>}
            </button>
          </div>
        </div>

        {/* Scheduled Scan & Manual Event Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-gray-100">
          {/* All Events Button */}
          <button
            type="button"
            onClick={() => setSelectedEventId("")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${!selectedEventId || selectedEventId === "ALL" ? "bg-slate-900 text-white shadow ring-2 ring-slate-800/20" : "bg-white text-gray-700 border border-gray-200 hover:border-slate-400"}`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>All Scheduled Events</span>
          </button>

          {events.map((ev) => {
            const isSelected = selectedEventId === ev.id;
            const liveCount = (data?.eventLiveCounts as any)?.[ev.id] ?? null;
            const isFacultyEvent = ev.audience === "FACULTY";
            const isStudentEvent = ev.audience === "STUDENT" || ev.audience === "ALL_STUDENTS";
            const isBothEvent = ev.audience === "BOTH";
            const isManualEvent = (ev as any).windowType === "MANUAL";

            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => handleSelectEvent(ev.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isSelected ? "bg-emerald-700 text-white shadow ring-2 ring-emerald-500/20" : "bg-white text-gray-700 border border-gray-200 hover:border-emerald-300"}`}
              >
                {isManualEvent ? (
                  <ClipboardCheck className={`w-3.5 h-3.5 ${isSelected ? "text-amber-300" : "text-blue-600"}`} />
                ) : (
                  <Fingerprint className={`w-3.5 h-3.5 ${isSelected ? "text-amber-300" : isFacultyEvent ? "text-indigo-500" : "text-emerald-600"}`} />
                )}
                <span>{ev.name}</span>

                {/* Subsystem & Audience Badges */}
                {isManualEvent && (
                  <span className={`text-[8.5px] px-1 py-0.2 rounded font-black uppercase tracking-wider ${isSelected ? "bg-blue-300 text-blue-950" : "bg-blue-50 text-blue-800 border border-blue-200"}`}>
                    Manual
                  </span>
                )}
                {isFacultyEvent && (
                  <span className={`text-[8.5px] px-1 py-0.2 rounded font-black uppercase tracking-wider ${isSelected ? "bg-indigo-300 text-indigo-950" : "bg-indigo-100 text-indigo-900 border border-indigo-200"}`}>
                    Faculty
                  </span>
                )}
                {isStudentEvent && (
                  <span className={`text-[8.5px] px-1 py-0.2 rounded font-black uppercase tracking-wider ${isSelected ? "bg-emerald-300 text-emerald-950" : "bg-emerald-100 text-emerald-900 border border-emerald-200"}`}>
                    Talabat
                  </span>
                )}
                {isBothEvent && (
                  <span className={`text-[8.5px] px-1 py-0.2 rounded font-black uppercase tracking-wider ${isSelected ? "bg-teal-300 text-teal-950" : "bg-teal-100 text-teal-900 border border-teal-200"}`}>
                    Both
                  </span>
                )}

                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${isSelected ? "bg-white/15 text-emerald-100" : "bg-gray-100 text-gray-600"}`}>{ev.timeDisplay}</span>
                {liveCount !== null && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${isSelected ? "bg-amber-400 text-emerald-950" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>{liveCount}</span>
                )}
                {ev.status === "ACTIVE" && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow shadow-emerald-400/50" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── LocalStorage Archive: all-days stacked + Weekly individual reports ── */}
      <ArchiveWeeklyPanel archiveMonth={archiveMonth} setArchiveMonth={setArchiveMonth} archiveStats={archiveStats} setArchiveStats={setArchiveStats} />

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center rounded-[18px] bg-white border border-gray-200 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
          <span className="text-xs font-bold text-gray-600">Loading attendance records…</span>
          <span className="text-[11px] text-gray-400 mt-1">Talabat + Faculty • {date}</span>
        </div>
      ) : data ? (
        <DailyStackedLogView
          records={data.records}
          summary={data.summary}
          talabatSummary={data.talabatSummary}
          facultySummary={data.facultySummary}
          overallSummary={data.overallSummary}
          availableGrades={data.filters.grades}
          availableSections={data.filters.sections}
          selectedGrade={selectedGrade}
          selectedSection={selectedSection}
          onGradeChange={setSelectedGrade}
          onSectionChange={setSelectedSection}
          onMemberClick={(memberId) => setActiveStudentId(memberId)}
          audience={audience}
          livePulse={livePulse}
          lastUpdatedAt={lastUpdatedAt}
          logType={logType}
        />
      ) : null}

      <DayDetailDrawer
        studentId={activeStudentId}
        targetDate={date}
        onClose={() => setActiveStudentId(null)}
        onOverrideSuccess={() => fetchData(true)}
      />

      <ManualAttendanceModal
        open={manualModalOpen}
        onOpenChange={setManualModalOpen}
        initialScheduleId={selectedEventId || undefined}
        initialDate={date}
        onSuccess={() => fetchData(true)}
      />
    </div>
  );
}

