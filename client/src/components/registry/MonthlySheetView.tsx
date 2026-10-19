import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Calendar,
  Share2,
  RefreshCw,
  Search,
  GraduationCap,
  Briefcase,
  FileSpreadsheet,
  ShieldCheck,
  Moon,
  ExternalLink,
  Settings,
  Zap,
} from "lucide-react";
import {
  getMonthlyAttendanceView,
  MonthlyAttendanceViewResponse,
  syncMonthlyAttendanceSheet,
  getSheetSyncStatus,
  SheetSyncStatusData,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { getHijriFromDate } from "@/lib/fatimi-calendar";
import { GoogleSheetPasteConfigModal } from "@/components/admin/attendance/GoogleSheetPasteConfigModal";

interface MonthlySheetViewProps {
  initialMonth?: string;
  onOpenLiveSheet?: () => void;
}

export function MonthlySheetView({ initialMonth, onOpenLiveSheet }: MonthlySheetViewProps) {
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || currentMonthStr);

  const currentHijri = useMemo(() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const midDate = new Date(Date.UTC(y || 2026, (m || 1) - 1, 15));
    return getHijriFromDate(midDate);
  }, [selectedMonth]);
  const [data, setData] = useState<MonthlyAttendanceViewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeAudience, setActiveAudience] = useState<"STUDENT" | "FACULTY">("STUDENT");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterGrade, setFilterGrade] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"sNo" | "name" | "rate" | "absent">("sNo");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [viewMode, setViewMode] = useState<"compact" | "grid">("compact");

  // Google Sheets Sync & Configuration State
  const [syncingSheet, setSyncingSheet] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [sheetStatus, setSheetStatus] = useState<SheetSyncStatusData | null>(null);

  const fetchSheetStatus = useCallback(async () => {
    try {
      const s = await getSheetSyncStatus();
      setSheetStatus(s);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchSheetStatus();
  }, [fetchSheetStatus]);

  const handleSyncMonthlyToSheet = async () => {
    try {
      setSyncingSheet(true);
      const res = await syncMonthlyAttendanceSheet(selectedMonth);
      toast({
        title: "Monthly Register Synced! 📊",
        description: res.message || `Pushed ${data?.monthName || selectedMonth} register to Google Sheets.`,
        variant: "success",
      });
      fetchSheetStatus();
    } catch (err: any) {
      const msg = err?.message || "Failed to sync monthly register";
      if (
        msg.includes("not configured") ||
        msg.includes("missing") ||
        msg.includes("400") ||
        msg.includes("credentials") ||
        !sheetStatus?.configured
      ) {
        toast({
          title: "Google Sheet Setup Required",
          description: "Please paste your Google Sheet link or Service Account credentials to enable syncing.",
          variant: "default",
        });
        setShowConfigModal(true);
      } else {
        toast({
          title: "Sync Failed",
          description: msg,
          variant: "destructive",
        });
      }
    } finally {
      setSyncingSheet(false);
    }
  };

  const daysList = useMemo(() => {
    if (data?.daysList && data.daysList.length > 0) return data.daysList;
    const [yStr, mStr] = selectedMonth.split("-");
    const y = parseInt(yStr, 10) || 2026;
    const m = parseInt(mStr, 10) || 10;
    const count = new Date(y, m, 0).getDate();
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const list = [];
    for (let d = 1; d <= count; d++) {
      const dt = new Date(y, m - 1, d);
      list.push({
        date: `${yStr}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
        day: d,
        weekday: weekdays[dt.getDay()],
        isWeekend: dt.getDay() === 0,
      });
    }
    return list;
  }, [data?.daysList, selectedMonth]);

  const loadMonthlyData = async (month: string) => {
    setLoading(true);
    try {
      const res = await getMonthlyAttendanceView(month);
      setData(res);
    } catch (err: any) {
      toast({
        title: "Failed to load monthly register",
        description: err?.message || "Could not retrieve monthly attendance summary.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthlyData(selectedMonth);
  }, [selectedMonth]);


  // Next month / Upcoming from Monday helper
  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(Date.UTC(y, m, 1));
    const nextStr = `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(nextStr);
  };

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(Date.UTC(y, m - 2, 1));
    const prevStr = `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(prevStr);
  };

  // Available unique grades for students
  const availableGrades = useMemo(() => {
    if (!data?.talabat) return [];
    const grades = new Set<string>();
    data.talabat.forEach((s) => {
      if (s.grade) grades.add(String(s.grade));
    });
    return Array.from(grades).sort((a, b) => Number(a) - Number(b));
  }, [data]);

  // Filtered & sorted Talabat
  const filteredTalabat = useMemo(() => {
    if (!data?.talabat) return [];
    let list = [...data.talabat];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.its.toLowerCase().includes(q) ||
          s.studentId.toLowerCase().includes(q) ||
          s.gradeDisplay.toLowerCase().includes(q)
      );
    }
    if (filterGrade !== "ALL") {
      list = list.filter((s) => String(s.grade) === filterGrade);
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "sNo") cmp = a.sNo - b.sNo;
      else if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "rate") cmp = a.rate - b.rate;
      else if (sortBy === "absent") cmp = a.absent - b.absent;
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return list;
  }, [data, searchQuery, filterGrade, sortBy, sortOrder]);

  // Filtered & sorted Faculty
  const filteredFaculty = useMemo(() => {
    if (!data?.faculty) return [];
    let list = [...data.faculty];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.employeeId && f.employeeId.toLowerCase().includes(q)) ||
          f.department.toLowerCase().includes(q) ||
          f.khidmatMauze.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "sNo") cmp = a.sNo - b.sNo;
      else if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "rate") cmp = a.rate - b.rate;
      else if (sortBy === "absent") cmp = a.absent - b.absent;
      return sortOrder === "asc" ? cmp : -cmp;
    });

    return list;
  }, [data, searchQuery, sortBy, sortOrder]);

  return (
    <div className="space-y-6">
      {/* ── Top Header & KPI Executive Dashboard ── */}
      <div className="p-6 rounded-[24px] bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 border border-emerald-900/40 text-white relative overflow-hidden shadow-xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-emerald-800/30">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black tracking-wider uppercase mb-2">
              <FileSpreadsheet className="w-3.5 h-3.5 text-amber-400" />
              <span>Official Monthly Register &bull; Google Sheets Grid</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2 flex-wrap">
              <span>Monthly Attendance Register</span>
              <span className="text-amber-400 text-lg font-bold">({data?.monthName || selectedMonth})</span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                <Moon className="w-3.5 h-3.5 text-amber-300" />
                <span>{currentHijri.monthName} {currentHijri.year}H</span>
                <span className="text-emerald-400 font-arabic text-xs">({currentHijri.monthNameAr})</span>
                {currentHijri.isJumadaAlUla ? (
                  <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] bg-emerald-500 text-white font-black">
                    New Active Month 🌟
                  </span>
                ) : currentHijri.isRabiAlAkhir ? (
                  <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] bg-amber-400 text-slate-950 font-bold">
                    Concluded
                  </span>
                ) : null}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              High-accuracy attendance performance metrics bifurcated across Talabat and Faculty.
              Displaying monthly registers stacked by Fatimi Hijri months with transition from Rabīʿ al-Ākhir to Jumādā al-Ūlā.
            </p>
          </div>

          {/* Month Selector & Sheet Sync Actions */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Fatimi Hijri Quick-Switch Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-emerald-700/50 shadow-inner">
              <button
                type="button"
                onClick={() => setSelectedMonth("2026-10")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedMonth === "2026-10"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-400 text-emerald-950 shadow-md ring-1 ring-emerald-300"
                    : "text-emerald-300 hover:text-white hover:bg-slate-800"
                }`}
                title="Switch to Jumādā al-Ūlā 1448 H (New Month)"
              >
                <Moon className="w-3 h-3 text-emerald-950" />
                <span>Jumādā al-Ūlā 🌟</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMonth("2026-09")}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                  selectedMonth === "2026-09"
                    ? "bg-amber-400 text-slate-950 shadow-md ring-1 ring-amber-300"
                    : "text-amber-300 hover:text-white hover:bg-slate-800"
                }`}
                title="Switch to Rabīʿ al-Ākhir 1448 H (Ended)"
              >
                <span>Rabīʿ al-Ākhir</span>
              </button>
            </div>

            <div className="flex items-center rounded-xl bg-slate-900 border border-emerald-700/50 p-1 shadow-inner">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-all"
                title="Previous Month"
              >
                &larr; Prev
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1 bg-transparent text-emerald-300 text-xs font-black focus:outline-none cursor-pointer"
              />
              <button
                type="button"
                onClick={handleNextMonth}
                className="px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-bold transition-all"
                title="Next Month"
              >
                Next &rarr;
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSelectedMonth(currentMonthStr)}
              className="px-3 py-2 rounded-xl text-xs font-black bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all cursor-pointer"
            >
              Current Month
            </button>

            {/* Google Sheets Sync & Configure Button Group */}
            <div className="flex items-center rounded-xl bg-slate-900 border border-emerald-700/50 p-1 shadow-inner gap-1">
              <button
                type="button"
                onClick={handleSyncMonthlyToSheet}
                disabled={syncingSheet}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-400 text-emerald-950 hover:from-emerald-400 hover:to-teal-300 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                title="Sync this month's register to Google Sheet tab"
              >
                <FileSpreadsheet className={`w-3.5 h-3.5 ${syncingSheet ? "animate-spin" : ""}`} />
                <span>{syncingSheet ? "Syncing..." : "Sync to Sheet"}</span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    sheetStatus?.configured ? "bg-emerald-800" : "bg-amber-500 animate-pulse"
                  }`}
                  title={sheetStatus?.configured ? "Google Sheets Configured" : "Configuration Needed"}
                />
              </button>

              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                title="Paste Google Sheet URL & Service Account Configuration"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {sheetStatus?.url && (
                <a
                  href={sheetStatus.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg text-emerald-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                  title="Open live Google Spreadsheet in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>

            <button
              type="button"
              onClick={() => loadMonthlyData(selectedMonth)}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
              title="Refresh register"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* ── KPI Metric Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-6">
          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span>Working Days</span>
              <Calendar className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-white mt-2">
              {data ? data.totalWorkingDays : "—"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">Calendar school sessions</p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-bold">
              <span>Talabat Turnout</span>
              <GraduationCap className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400 mt-2">
              {data ? `${data.talabatAvgRate}%` : "—"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {data?.talabatCount ?? 0} enrolled students
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between text-indigo-300 text-xs font-bold">
              <span>Faculty Turnout</span>
              <Briefcase className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black text-indigo-300 mt-2">
              {data ? `${data.facultyAvgRate}%` : "—"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              {data?.facultyCount ?? 0} teachers &amp; staff
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between text-amber-300 text-xs font-bold">
              <span>Compliance Status</span>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-400 mt-2">
              {data ? (data.overallRate >= 80 ? "EXCELLENT" : "OPERATIONAL") : "—"}
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Overall rate: {data?.overallRate ?? 0}%
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center justify-between text-emerald-300 text-xs font-bold">
              <span>Fatimi Hijri Month</span>
              <Moon className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xl sm:text-2xl font-black text-emerald-300 mt-2 truncate">
              {currentHijri.monthNameShort}
            </p>
            <p className="text-[11px] text-slate-300 mt-1 flex items-center gap-1 flex-wrap">
              <span>{currentHijri.year}H</span>
              {currentHijri.isJumadaAlUla ? (
                <span className="px-1.5 py-0.2 rounded text-[8px] bg-emerald-500 text-white font-black uppercase">
                  New Month 🌟
                </span>
              ) : currentHijri.isRabiAlAkhir ? (
                <span className="px-1.5 py-0.2 rounded text-[8px] bg-amber-500 text-slate-950 font-bold uppercase">
                  Concluded
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {/* ── Audience Selector & Filter Toolbar ── */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Bifurcation Switcher */}
        <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveAudience("STUDENT")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeAudience === "STUDENT"
                ? "bg-emerald-600 text-white shadow-md"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Talabat (Students)</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                activeAudience === "STUDENT" ? "bg-white/20 text-white" : "bg-white text-slate-700 border"
              }`}
            >
              {data?.talabatCount ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAudience("FACULTY")}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeAudience === "FACULTY"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Faculty (Staff)</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                activeAudience === "FACULTY" ? "bg-white/20 text-white" : "bg-white text-slate-700 border"
              }`}
            >
              {data?.facultyCount ?? 0}
            </span>
          </button>
        </div>

        {/* Search & Grade Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search name, ITS or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {activeAudience === "STUDENT" && availableGrades.length > 0 && (
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
            >
              <option value="ALL">All Grades</option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
          )}

          {/* Sort selection */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="py-2 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 focus:bg-white focus:outline-none"
          >
            <option value="sNo">Default Order</option>
            <option value="name">Sort by Name</option>
            <option value="rate">Sort by Turnout %</option>
            <option value="absent">Sort by Absent Count</option>
          </select>

          <button
            type="button"
            onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100"
            title={`Ordering: ${sortOrder.toUpperCase()}`}
          >
            {sortOrder === "asc" ? "↑ Asc" : "↓ Desc"}
          </button>
        </div>
      </div>

      {/* ── Day-Wise Attendance Quick Legend & View Switcher ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 sm:px-4 rounded-xl bg-slate-50 border border-slate-200/90 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-700">Day-Wise Codes:</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-black text-[11px] border border-emerald-300">
            P = Present
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-black text-[11px] border border-amber-300">
            L = Late
          </span>
          {activeAudience === "STUDENT" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-black text-[11px] border border-sky-300">
              LV = Leave
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-black text-[11px] border border-rose-300">
            A = Absent
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-500 font-semibold text-[11px]">
            — = No Log / Off
          </span>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("compact")}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
              viewMode === "compact"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            Compact Strip
          </button>
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
              viewMode === "grid"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            Full Day Grid (1–{daysList.length})
          </button>
        </div>
      </div>

      {/* ── Catchy Google Sheets Style Table ── */}
      <div className="rounded-[20px] bg-white border border-slate-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          {activeAudience === "STUDENT" ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-black uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <th className={`py-3.5 px-3 text-center w-12 ${viewMode === "grid" ? "sticky left-0 z-20 bg-slate-900 border-r border-slate-800" : ""}`}>
                    #
                  </th>
                  <th className={`py-3.5 px-4 min-w-[170px] ${viewMode === "grid" ? "sticky left-12 z-20 bg-slate-900 border-r border-slate-800" : ""}`}>
                    Talabat Full Name
                  </th>
                  <th className={`py-3.5 px-3 font-mono ${viewMode === "grid" ? "border-r border-slate-800" : ""}`}>
                    ITS / Student ID
                  </th>
                  <th className={`py-3.5 px-3 ${viewMode === "grid" ? "border-r border-slate-800" : ""}`}>
                    Class
                  </th>

                  {/* Day-Wise Attendance Display */}
                  {viewMode === "compact" ? (
                    <th className="py-3.5 px-3 text-center min-w-[280px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Day-Wise Attendance</span>
                        <span className="text-[10px] font-normal text-slate-400 font-mono">(1–{daysList.length})</span>
                      </div>
                    </th>
                  ) : (
                    daysList.map((d) => (
                      <th
                        key={d.day}
                        className={`py-2 px-1 text-center w-7 min-w-[28px] border-r border-slate-800 text-[10px] ${
                          d.isWeekend ? "bg-slate-800 text-slate-400" : "bg-slate-900 text-slate-200"
                        }`}
                      >
                        <div className="font-bold leading-none">{d.day}</div>
                        <div className="text-[8px] opacity-70 leading-none mt-0.5">{d.weekday}</div>
                      </th>
                    ))
                  )}

                  <th className="py-3.5 px-2.5 text-center bg-emerald-950/60 text-emerald-300">Present</th>
                  <th className="py-3.5 px-2.5 text-center bg-amber-950/60 text-amber-300">Late</th>
                  <th className="py-3.5 px-2.5 text-center bg-sky-950/60 text-sky-300">Leave</th>
                  <th className="py-3.5 px-2.5 text-center bg-rose-950/60 text-rose-300">Absent</th>
                  <th className="py-3.5 px-2.5 text-center">Sessions</th>
                  <th className="py-3.5 px-4 text-center">Monthly Turnout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTalabat.length === 0 ? (
                  <tr>
                    <td
                      colSpan={viewMode === "compact" ? 11 : daysList.length + 10}
                      className="py-12 text-center text-slate-400 font-semibold"
                    >
                      {loading ? "Loading monthly records..." : "No student records found for this month."}
                    </td>
                  </tr>
                ) : (
                  filteredTalabat.map((s, idx) => {
                    const isEven = idx % 2 === 0;
                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-emerald-50/50 transition-colors ${
                          isEven ? "bg-white" : "bg-slate-50/60"
                        }`}
                      >
                        <td className={`py-2.5 px-3 text-center font-bold text-slate-400 font-mono ${viewMode === "grid" ? "sticky left-0 z-10 bg-inherit border-r border-slate-200" : ""}`}>
                          {s.sNo}
                        </td>
                        <td className={`py-2.5 px-4 font-black text-slate-900 ${viewMode === "grid" ? "sticky left-12 z-10 bg-inherit border-r border-slate-200 whitespace-nowrap" : ""}`}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-black text-[10px] flex items-center justify-center border border-emerald-300 shrink-0">
                              {s.name.charAt(0)}
                            </div>
                            <span>{s.name}</span>
                          </div>
                        </td>
                        <td className={`py-2.5 px-3 font-mono font-bold text-slate-600 ${viewMode === "grid" ? "border-r border-slate-200 whitespace-nowrap" : ""}`}>
                          {s.its}
                        </td>
                        <td className={`py-2.5 px-3 font-semibold text-slate-700 ${viewMode === "grid" ? "border-r border-slate-200 whitespace-nowrap" : ""}`}>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {s.gradeDisplay}
                          </span>
                        </td>

                        {/* Day-Wise Attendance Cells */}
                        {viewMode === "compact" ? (
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1 overflow-x-auto max-w-[340px] py-1 scrollbar-thin">
                              {daysList.map((d) => {
                                const code = s.daily?.[d.day];
                                let badgeBg = "bg-slate-100 text-slate-300 border-slate-200/60";
                                if (code === "P") badgeBg = "bg-emerald-600 text-white font-black shadow-xs";
                                else if (code === "L") badgeBg = "bg-amber-500 text-white font-black shadow-xs";
                                else if (code === "LV") badgeBg = "bg-sky-500 text-white font-black shadow-xs";
                                else if (code === "A") badgeBg = "bg-rose-500 text-white font-black shadow-xs";
                                else if (d.isWeekend) badgeBg = "bg-slate-200/50 text-slate-400";

                                return (
                                  <span
                                    key={d.day}
                                    title={`Day ${d.day} (${d.weekday}): ${
                                      code === "P"
                                        ? "Present"
                                        : code === "L"
                                        ? "Late"
                                        : code === "LV"
                                        ? "Leave"
                                        : code === "A"
                                        ? "Absent"
                                        : d.isWeekend
                                        ? "Sunday (Off)"
                                        : "No Session"
                                    }`}
                                    className={`w-5 h-5 rounded-[4px] text-[10px] font-mono flex items-center justify-center shrink-0 cursor-default select-none border transition-transform hover:scale-125 ${badgeBg}`}
                                  >
                                    {code || (d.isWeekend ? "·" : "·")}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        ) : (
                          daysList.map((d) => {
                            const code = s.daily?.[d.day];
                            let cellClass = "text-slate-300 bg-transparent";
                            if (code === "P") cellClass = "bg-emerald-100 text-emerald-900 font-black";
                            else if (code === "L") cellClass = "bg-amber-100 text-amber-900 font-black";
                            else if (code === "LV") cellClass = "bg-sky-100 text-sky-900 font-black";
                            else if (code === "A") cellClass = "bg-rose-100 text-rose-900 font-black";
                            else if (d.isWeekend) cellClass = "bg-slate-100/60 text-slate-400";

                            return (
                              <td
                                key={d.day}
                                className={`p-1 text-center text-[11px] font-mono border-r border-slate-200/80 cursor-default select-none ${cellClass}`}
                                title={`Day ${d.day} (${d.weekday}): ${
                                  code === "P"
                                    ? "Present"
                                    : code === "L"
                                    ? "Late"
                                    : code === "LV"
                                    ? "Leave"
                                    : code === "A"
                                    ? "Absent"
                                    : d.isWeekend
                                    ? "Sunday (Off)"
                                    : "No Log"
                                }`}
                              >
                                {code || (d.isWeekend ? "·" : "—")}
                              </td>
                            );
                          })
                        )}

                        <td className="py-2.5 px-2.5 text-center font-bold text-emerald-700 bg-emerald-50/40">
                          {s.present}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-bold text-amber-700 bg-amber-50/40">
                          {s.late}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-bold text-sky-700 bg-sky-50/40">
                          {s.leave}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-bold text-rose-700 bg-rose-50/40">
                          {s.absent}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-600">
                          {s.total}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-[50px] h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  s.rate >= 90
                                    ? "bg-emerald-500"
                                    : s.rate >= 75
                                    ? "bg-teal-500"
                                    : s.rate >= 60
                                    ? "bg-amber-500"
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(s.rate, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-black font-mono text-slate-900 w-9 text-right">
                              {s.rate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-black uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <th className={`py-3.5 px-3 text-center w-12 ${viewMode === "grid" ? "sticky left-0 z-20 bg-slate-900 border-r border-slate-800" : ""}`}>
                    #
                  </th>
                  <th className={`py-3.5 px-4 min-w-[170px] ${viewMode === "grid" ? "sticky left-12 z-20 bg-slate-900 border-r border-slate-800" : ""}`}>
                    Faculty Member Name
                  </th>
                  <th className={`py-3.5 px-3 font-mono ${viewMode === "grid" ? "border-r border-slate-800" : ""}`}>
                    Employee / ITS
                  </th>
                  <th className={`py-3.5 px-3 ${viewMode === "grid" ? "border-r border-slate-800" : ""}`}>
                    Department
                  </th>
                  <th className={`py-3.5 px-3 ${viewMode === "grid" ? "border-r border-slate-800" : ""}`}>
                    Khidmat Mauze
                  </th>

                  {/* Day-Wise Attendance Display */}
                  {viewMode === "compact" ? (
                    <th className="py-3.5 px-3 text-center min-w-[280px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <span>Day-Wise Attendance</span>
                        <span className="text-[10px] font-normal text-slate-400 font-mono">(1–{daysList.length})</span>
                      </div>
                    </th>
                  ) : (
                    daysList.map((d) => (
                      <th
                        key={d.day}
                        className={`py-2 px-1 text-center w-7 min-w-[28px] border-r border-slate-800 text-[10px] ${
                          d.isWeekend ? "bg-slate-800 text-slate-400" : "bg-slate-900 text-slate-200"
                        }`}
                      >
                        <div className="font-bold leading-none">{d.day}</div>
                        <div className="text-[8px] opacity-70 leading-none mt-0.5">{d.weekday}</div>
                      </th>
                    ))
                  )}

                  <th className="py-3.5 px-2.5 text-center bg-emerald-950/60 text-emerald-300">Present</th>
                  <th className="py-3.5 px-2.5 text-center bg-amber-950/60 text-amber-300">Late</th>
                  <th className="py-3.5 px-2.5 text-center bg-rose-950/60 text-rose-300">Absent</th>
                  <th className="py-3.5 px-2.5 text-center">Sessions</th>
                  <th className="py-3.5 px-4 text-center">Monthly Turnout</th>
                  <th className="py-3.5 px-4 text-center">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFaculty.length === 0 ? (
                  <tr>
                    <td
                      colSpan={viewMode === "compact" ? 12 : daysList.length + 11}
                      className="py-12 text-center text-slate-400 font-semibold"
                    >
                      {loading ? "Loading faculty records..." : "No faculty records found for this month."}
                    </td>
                  </tr>
                ) : (
                  filteredFaculty.map((f, idx) => {
                    const isEven = idx % 2 === 0;
                    return (
                      <tr
                        key={f.id}
                        className={`hover:bg-indigo-50/50 transition-colors ${
                          isEven ? "bg-white" : "bg-slate-50/60"
                        }`}
                      >
                        <td className={`py-2.5 px-3 text-center font-bold text-slate-400 font-mono ${viewMode === "grid" ? "sticky left-0 z-10 bg-inherit border-r border-slate-200" : ""}`}>
                          {f.sNo}
                        </td>
                        <td className={`py-2.5 px-4 font-black text-slate-900 ${viewMode === "grid" ? "sticky left-12 z-10 bg-inherit border-r border-slate-200 whitespace-nowrap" : ""}`}>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-800 font-black text-[10px] flex items-center justify-center border border-indigo-300 shrink-0">
                              {f.name.charAt(0)}
                            </div>
                            <span>{f.name}</span>
                          </div>
                        </td>
                        <td className={`py-2.5 px-3 font-mono font-bold text-slate-600 ${viewMode === "grid" ? "border-r border-slate-200 whitespace-nowrap" : ""}`}>
                          {f.employeeId}
                        </td>
                        <td className={`py-2.5 px-3 font-semibold text-slate-700 ${viewMode === "grid" ? "border-r border-slate-200 whitespace-nowrap" : ""}`}>
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-bold text-[11px]">
                            {f.department}
                          </span>
                        </td>
                        <td className={`py-2.5 px-3 font-medium text-slate-500 ${viewMode === "grid" ? "border-r border-slate-200 whitespace-nowrap" : ""}`}>
                          {f.khidmatMauze}
                        </td>

                        {/* Day-Wise Attendance Cells */}
                        {viewMode === "compact" ? (
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1 overflow-x-auto max-w-[340px] py-1 scrollbar-thin">
                              {daysList.map((d) => {
                                const code = f.daily?.[d.day];
                                let badgeBg = "bg-slate-100 text-slate-300 border-slate-200/60";
                                if (code === "P") badgeBg = "bg-emerald-600 text-white font-black shadow-xs";
                                else if (code === "L") badgeBg = "bg-amber-500 text-white font-black shadow-xs";
                                else if (code === "A") badgeBg = "bg-rose-500 text-white font-black shadow-xs";
                                else if (d.isWeekend) badgeBg = "bg-slate-200/50 text-slate-400";

                                return (
                                  <span
                                    key={d.day}
                                    title={`Day ${d.day} (${d.weekday}): ${
                                      code === "P"
                                        ? "Present"
                                        : code === "L"
                                        ? "Late"
                                        : code === "A"
                                        ? "Absent"
                                        : d.isWeekend
                                        ? "Sunday (Off)"
                                        : "No Session"
                                    }`}
                                    className={`w-5 h-5 rounded-[4px] text-[10px] font-mono flex items-center justify-center shrink-0 cursor-default select-none border transition-transform hover:scale-125 ${badgeBg}`}
                                  >
                                    {code || (d.isWeekend ? "·" : "·")}
                                  </span>
                                );
                              })}
                            </div>
                          </td>
                        ) : (
                          daysList.map((d) => {
                            const code = f.daily?.[d.day];
                            let cellClass = "text-slate-300 bg-transparent";
                            if (code === "P") cellClass = "bg-emerald-100 text-emerald-900 font-black";
                            else if (code === "L") cellClass = "bg-amber-100 text-amber-900 font-black";
                            else if (code === "A") cellClass = "bg-rose-100 text-rose-900 font-black";
                            else if (d.isWeekend) cellClass = "bg-slate-100/60 text-slate-400";

                            return (
                              <td
                                key={d.day}
                                className={`p-1 text-center text-[11px] font-mono border-r border-slate-200/80 cursor-default select-none ${cellClass}`}
                                title={`Day ${d.day} (${d.weekday}): ${
                                  code === "P"
                                    ? "Present"
                                    : code === "L"
                                    ? "Late"
                                    : code === "A"
                                    ? "Absent"
                                    : d.isWeekend
                                    ? "Sunday (Off)"
                                    : "No Log"
                                }`}
                              >
                                {code || (d.isWeekend ? "·" : "—")}
                              </td>
                            );
                          })
                        )}

                        <td className="py-2.5 px-2.5 text-center font-bold text-emerald-700 bg-emerald-50/40">
                          {f.present}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-bold text-amber-700 bg-amber-50/40">
                          {f.late}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-bold text-rose-700 bg-rose-50/40">
                          {f.absent}
                        </td>
                        <td className="py-2.5 px-2.5 text-center font-mono font-bold text-slate-600">
                          {f.total}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-[50px] h-2 rounded-full bg-slate-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  f.rate >= 85
                                    ? "bg-emerald-500"
                                    : f.rate >= 75
                                    ? "bg-indigo-500"
                                    : "bg-rose-500"
                                }`}
                                style={{ width: `${Math.min(f.rate, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-black font-mono text-slate-900 w-9 text-right">
                              {f.rate}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              f.compliance === "EXCELLENT"
                                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                : f.compliance === "GOOD"
                                ? "bg-indigo-100 text-indigo-900 border border-indigo-300"
                                : "bg-rose-100 text-rose-900 border border-rose-300"
                            }`}
                          >
                            {f.compliance}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Google Sheets Paste & Configuration Modal */}
      <GoogleSheetPasteConfigModal
        open={showConfigModal}
        onOpenChange={setShowConfigModal}
        onConfigSaved={(s) => {
          setSheetStatus(s);
        }}
        syncNowAction={{
          label: `Sync ${data?.monthName || selectedMonth} to Sheet`,
          onSync: handleSyncMonthlyToSheet,
        }}
      />
    </div>
  );
}
