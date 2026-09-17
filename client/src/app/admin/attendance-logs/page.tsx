"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Briefcase,
  Layers,
  Save,
  Radio,
  Eye,
  EyeOff,
  Zap,
  Activity,
  Sheet,
  ExternalLink,
  CalendarClock,
} from "lucide-react";
import {
  getAttendanceLogs,
  getAttendanceLogEvents,
  finalizeEventScans,
  getExportAttendanceLogsUrl,
  getSheetSyncStatus,
  syncAttendanceSheet,
  AttendanceLogsResponse,
  ScheduledEventWindow,
  SheetSyncStatusData,
} from "@/lib/api";
import { DailyStackedLogView } from "@/components/registry/DailyStackedLogView";
import { DayDetailDrawer } from "@/components/registry/DayDetailDrawer";
import { toast } from "@/components/ui/toast";
import {
  saveDailyArchive,
  generateWeeklyReports,
  generateMonthlyBifurcatedCsv,
  downloadCsv,
  getArchiveStats,
  getAllArchivedDays,
} from "@/lib/attendance-archive";

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
            <Clock className="w-4 h-4" /> LocalStorage Archive — All-Days Stacked
          </p>
          <p className="text-[11px] text-slate-300 mt-1">
            Every day you open is auto-saved locally (Name · ITS · Scan Time · Present/Late/Absent). After a month, download <b>weekly individual reports</b> (bifurcated Talabat + Faculty, nice theme).
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            Stored days: <b className="text-emerald-300">{archiveStats.totalDays}</b> {archiveStats.earliest ? `· ${archiveStats.earliest} → ${archiveStats.latest}` : "· open days to start stacking"} · This month <b className="text-white">{archiveMonth}</b>: <b className="text-amber-300">{daysInMonth}</b> days
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
            <Download className="w-3.5 h-3.5 inline mr-1" /> Monthly CSV (Bifurcated)
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

      {weekly.length > 0 ? (
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
                <Download className="w-3 h-3" /> Weekly CSV (Bifurcated)
              </p>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-400 mt-3">No archived days for {archiveMonth}. Open each day once — it auto-stacks to localStorage for weekly reports.</p>
      )}

      <div className="flex items-center gap-2 mt-3 text-[11px]">
        <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">Talabat + Faculty bifurcated</span>
        <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30">Highlights: Name · ITS/ID · Scan Time · Status</span>
        <button
          type="button"
          onClick={() => {
            if (!confirm("Clear all archived days from localStorage?")) return;
            localStorage.removeItem("attendance-archive-index");
            Object.keys(localStorage).forEach((k) => {
              if (k.startsWith("attendance-archive-")) localStorage.removeItem(k);
            });
            setRefreshKey((k) => k + 1);
            toast({ title: "Archive cleared", variant: "default" });
          }}
          className="ml-auto text-[11px] text-slate-400 hover:text-rose-300 underline"
        >
          Clear archive
        </button>
      </div>
    </div>
  );
}

export default function AdminAttendanceLogsPage() {
  const todayStr = new Date().toISOString().slice(0, 10);

  const [date, setDate] = useState<string>(todayStr);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [selectedEventId, setSelectedEventId] = useState<string>("ALL");
  const [audience, setAudience] = useState<"STUDENT" | "FACULTY" | "ALL">("STUDENT");

  const [data, setData] = useState<AttendanceLogsResponse | null>(null);
  const [events, setEvents] = useState<ScheduledEventWindow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [finalizing, setFinalizing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Live state
  const [isLive, setIsLive] = useState<boolean>(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [livePulse, setLivePulse] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const tickRef = useRef<number | null>(null);
  // Archive / weekly reports (localStorage all-days)
  const [archiveMonth, setArchiveMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [archiveStats, setArchiveStats] = useState<{ totalDays: number; earliest?: string; latest?: string }>({ totalDays: 0 });
  const lastFetchRef = useRef(0);

  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await getAttendanceLogEvents();
      setEvents(res || []);
    } catch (err) {
      console.error("Failed to load schedule events:", err);
    }
  }, []);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      // de-dupe rapid calls (poll + sse)
      const now = Date.now();
      if (now - lastFetchRef.current < 800 && isRefresh) return;
      lastFetchRef.current = now;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await getAttendanceLogs({
          date,
          grade: selectedGrade || undefined,
          section: selectedSection || undefined,
          eventWindowId: selectedEventId !== "ALL" ? selectedEventId : undefined,
          audience,
        });
        setData(res);
        setLastUpdatedAt(new Date().toISOString());
        setLivePulse(true);
        setTimeout(() => setLivePulse(false), 600);
        // ── Persist all-days to localStorage (offline archive) ──
        try {
          // Fetch with ALL audience to archive complete bifurcated day (so weekly reports have both)
          const archiveAudience = "ALL";
          const archiveRes = audience === "ALL" ? res : await getAttendanceLogs({ date, audience: archiveAudience as any });
          saveDailyArchive(date, {
            records: archiveRes.records,
            summary: archiveRes.summary,
            talabatSummary: (archiveRes as any).talabatSummary,
            facultySummary: (archiveRes as any).facultySummary,
            overallSummary: (archiveRes as any).overallSummary,
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
    [date, selectedGrade, selectedSection, selectedEventId, audience]
  );

  // Initial
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // Live polling — every 4s when enabled, today only; paused when hidden
  useEffect(() => {
    if (!isLive) return;
    // only auto-poll for today (historical days are static)
    const isToday = date === todayStr;
    if (!isToday) return;

    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetchData(true);
    }, 4000);
    tickRef.current = id;
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [isLive, date, todayStr, fetchData]);

  // SSE live trigger — any biometric scan instantly refreshes the log
  useEffect(() => {
    if (!isLive) return;
    const isToday = date === todayStr;
    if (!isToday) return;

    let es: EventSource | null = null;
    let retry: number | null = null;
    const connect = () => {
      es = new EventSource("/api/biometric/events/stream");
      es.onopen = () => setSseConnected(true);
      es.onerror = () => {
        setSseConnected(false);
        try { es?.close(); } catch {}
        if (retry === null) {
          retry = window.setTimeout(() => {
            retry = null;
            connect();
          }, 3000) as unknown as number;
        }
      };
      es.onmessage = () => {
        // any scan — refresh numbers immediately
        fetchData(true);
      };
    };
    connect();
    return () => {
      if (retry) window.clearTimeout(retry);
      if (es) es.close();
      setSseConnected(false);
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

  const handleFinalizeEvent = async () => {
    setFinalizing(true);
    try {
      await finalizeEventScans(date);
      toast({
        title: "Event Scans Finalized",
        description: "All scans and un-scanned absences have been saved in permanent storage.",
      });
      await fetchData(true);
    } catch (err: any) {
      toast({
        title: "Failed to finalize event",
        description: err.message || "An error occurred while saving to storage.",
        variant: "destructive",
      });
    } finally {
      setFinalizing(false);
    }
  };

  // ── Google Sheet daily store ──
  const [sheetStatus, setSheetStatus] = useState<SheetSyncStatusData | null>(null);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetResult, setSheetResult] = useState<{ tabTitle: string; rowsSynced: number; url: string } | null>(null);

  const fetchSheetStatus = useCallback(async () => {
    try {
      setSheetStatus(await getSheetSyncStatus());
    } catch {
      /* status endpoint is cosmetic — ignore failures */
    }
  }, []);

  useEffect(() => {
    fetchSheetStatus();
  }, [fetchSheetStatus]);

  const handleSyncSheet = async () => {
    setSheetSyncing(true);
    try {
      const r = await syncAttendanceSheet(date);
      setSheetResult({ tabTitle: r.data.tabTitle, rowsSynced: r.data.rowsSynced, url: r.data.url });
      toast({
        title: "Google Sheet updated",
        description: r.message || `${r.data.rowsSynced} rows stored in tab '${r.data.tabTitle}'`,
      });
    } catch (err: any) {
      toast({
        title: "Google Sheet sync failed",
        description: err.message || "Could not reach Google Sheets — check service-account configuration.",
        variant: "destructive",
      });
    } finally {
      setSheetSyncing(false);
    }
  };

  const exportUrl = getExportAttendanceLogsUrl({
    startDate: date,
    endDate: date,
    grade: selectedGrade || undefined,
    section: selectedSection || undefined,
    audience: "ALL",
  });
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

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-5">
      {/* ── Premium Header with Live Controls ── */}
      <div className="relative overflow-hidden rounded-[20px] border border-emerald-100 bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 p-5 sm:p-6 shadow-lg">
        {/* subtle grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }} />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[18px] sm:text-[22px] font-black tracking-tight text-white flex items-center gap-2">
                <span className="inline-flex w-8 h-8 rounded-xl bg-white/10 border border-white/15 items-center justify-center">
                  <Layers className="w-4 h-4 text-emerald-300" />
                </span>
                Attendance Logs
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.12em] bg-emerald-400 text-emerald-950">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-950 animate-pulse" />
                Live Day Stream
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-white/10 text-emerald-100 border border-white/15">
                <Zap className="w-3 h-3 text-amber-300" />
                Auto-refreshing numbers
              </span>
            </div>
            <p className="text-[12px] leading-relaxed text-emerald-100/80 max-w-2xl">
              Every scan (Talabat + Faculty) streams live. Numbers pulse green the instant they change. Separated counts per audience — no more mixing.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${isLive ? "bg-emerald-500 text-white border-emerald-400 shadow" : "bg-white/10 text-white border-white/15"}`}>
                <Radio className={`w-3.5 h-3.5 ${isLive ? "animate-pulse" : ""}`} />
                {isLive ? (sseConnected ? "LIVE • SSE connected" : "LIVE • polling 4s") : "PAUSED"}
              </span>
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

            <button
              type="button"
              onClick={handleFinalizeEvent}
              disabled={finalizing}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white font-bold text-xs shadow-md cursor-pointer disabled:opacity-60"
            >
              {finalizing ? <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" /> : <Save className="w-3.5 h-3.5 text-emerald-400" />}
              Save to Storage
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

            <div className="flex items-center gap-1.5">
              <a href={exportUrl} download className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md" title="Bifurcated Talabat+Faculty — highlights Name/ITS/Scan Time/Present-Late-Absent">
                <Download className="w-4 h-4" />
                CSV Bifurcated
              </a>
              <a href={exportTalabatUrl} download className="inline-flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] shadow-md" title="Talabat only CSV">
                <GraduationCap className="w-3.5 h-3.5" /> Talabat
              </a>
              <a href={exportFacultyUrl} download className="inline-flex items-center justify-center gap-1 px-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[11px] shadow-md" title="Faculty only CSV">
                <Briefcase className="w-3.5 h-3.5" /> Faculty
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ── Audience + Event Filter Bar — Live counts ── */}
      <div className="p-3.5 rounded-[18px] bg-white border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-emerald-700" />
            </div>
            <span className="text-[11px] font-black tracking-[0.14em] uppercase text-gray-500">Event & Audience</span>
            {refreshing && <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><Loader2 className="w-3 h-3 animate-spin" /> syncing…</span>}
          </div>

          <div className="inline-flex rounded-xl bg-gray-100 p-1 border border-gray-200">
            <button
              type="button"
              onClick={() => setAudience("STUDENT")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${audience === "STUDENT" ? "bg-emerald-600 text-white shadow" : "text-gray-600 hover:text-gray-900"}`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              Talabat
              {data?.talabatSummary && <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-black ${audience === "STUDENT" ? "bg-white/20 text-white" : "bg-white text-gray-700 border"}`}>{data.talabatSummary.total}</span>}
            </button>
            <button
              type="button"
              onClick={() => setAudience("FACULTY")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${audience === "FACULTY" ? "bg-indigo-600 text-white shadow" : "text-gray-600 hover:text-gray-900"}`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Faculty
              {data?.facultySummary && <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-black ${audience === "FACULTY" ? "bg-white/20 text-white" : "bg-white text-gray-700 border"}`}>{data.facultySummary.total}</span>}
            </button>
            <button
              type="button"
              onClick={() => setAudience("ALL")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${audience === "ALL" ? "bg-gray-900 text-white shadow" : "text-gray-600 hover:text-gray-900"}`}
            >
              <Users className="w-3.5 h-3.5" />
              All
              {data?.overallSummary && <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-black ${audience === "ALL" ? "bg-white/15 text-white" : "bg-white text-gray-700 border"}`}>{data.overallSummary.total}</span>}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedEventId("ALL")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${selectedEventId === "ALL" ? "bg-emerald-700 text-white shadow ring-2 ring-emerald-500/20" : "bg-gray-50 text-gray-700 border border-gray-200 hover:bg-white"}`}
          >
            <Layers className="w-3.5 h-3.5" />
            All Events
            {data?.summary && <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${selectedEventId === "ALL" ? "bg-white/15 text-emerald-100" : "bg-white text-gray-600 border"}`}>{data.summary.total}</span>}
          </button>
          {events.map((ev) => {
            const isSelected = selectedEventId === ev.id;
            const liveCount = (data?.eventLiveCounts as any)?.[ev.id] ?? null;
            return (
              <button
                key={ev.id}
                type="button"
                onClick={() => setSelectedEventId(ev.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${isSelected ? "bg-emerald-700 text-white shadow ring-2 ring-emerald-500/20" : "bg-white text-gray-700 border border-gray-200 hover:border-emerald-300"}`}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isSelected ? "text-amber-300" : "text-emerald-600"}`} />
                <span>{ev.name}</span>
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

      {/* ── LocalStorage Archive: all-days stacked + Weekly individual reports (with nice theme & bifurcated) ── */}
      <ArchiveWeeklyPanel archiveMonth={archiveMonth} setArchiveMonth={setArchiveMonth} archiveStats={archiveStats} setArchiveStats={setArchiveStats} />

      {/* ── Google Sheet Daily Store — push the viewed day to the online spreadsheet ── */}
      <div className="p-4 rounded-[18px] bg-gradient-to-br from-white to-emerald-50/60 border border-emerald-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-black tracking-[0.14em] uppercase text-emerald-700 flex items-center gap-2">
              <Sheet className="w-4 h-4" /> Google Sheet Daily Store
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Stores the full {date} roster (Talabat + Faculty, Present/Late/Absent) as a tab per day plus a running Summary tab.
              {sheetStatus?.enabled && sheetStatus.configured && (
                <> Auto-push runs daily ~{String(sheetStatus.syncHourUtc).padStart(2, "0")}:00 UTC from the attendance scheduler.</>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {sheetStatus?.configured ? (
                <>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected {sheetStatus.spreadsheetId}
                  </span>
                  {sheetStatus.url && (
                    <a
                      href={sheetStatus.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50"
                    >
                      <ExternalLink className="w-3 h-3" /> Open spreadsheet
                    </a>
                  )}
                </>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  <AlertCircle className="w-3 h-3" /> Not configured — set GOOGLE_ATTENDANCE_SPREADSHEET_ID + service account in .env
                </span>
              )}
              {sheetResult && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                  Last push: {sheetResult.rowsSynced} rows → tab “{sheetResult.tabTitle}”
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSyncSheet}
              disabled={sheetSyncing}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs shadow-md cursor-pointer"
              title={`Store ${date} attendance to the online Google Sheet`}
            >
              {sheetSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarClock className="w-4 h-4" />}
              Store {date} to Sheet
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center rounded-[18px] bg-white border border-gray-200 flex flex-col items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
          <span className="text-xs font-bold text-gray-600">Loading live attendance stream…</span>
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
        />
      ) : null}

      <DayDetailDrawer
        studentId={activeStudentId}
        targetDate={date}
        onClose={() => setActiveStudentId(null)}
        onOverrideSuccess={() => fetchData(true)}
      />
    </div>
  );
}
