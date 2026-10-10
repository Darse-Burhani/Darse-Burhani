import React, { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Download,
  Share2,
  RefreshCw,
  Search,
  Filter,
  Users,
  GraduationCap,
  Briefcase,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import {
  getMonthlyAttendanceView,
  syncMonthlyAttendanceSheet,
  MonthlyAttendanceViewResponse,
  MonthlyAttendanceStudentItem,
  MonthlyAttendanceFacultyItem,
} from "@/lib/api";
import { toast } from "@/components/ui/toast";

interface MonthlySheetViewProps {
  initialMonth?: string;
  onOpenLiveSheet?: () => void;
}

export function MonthlySheetView({ initialMonth }: MonthlySheetViewProps) {
  const currentMonthStr = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(initialMonth || currentMonthStr);
  const [data, setData] = useState<MonthlyAttendanceViewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);
  const [activeAudience, setActiveAudience] = useState<"STUDENT" | "FACULTY">("STUDENT");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterGrade, setFilterGrade] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"sNo" | "name" | "rate" | "absent">("sNo");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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

  const handleSyncToGoogleSheet = async () => {
    setIsSyncingSheet(true);
    try {
      const res = await syncMonthlyAttendanceSheet(selectedMonth);
      toast({
        title: "Google Sheet Updated Successfully",
        description: res.message || `Monthly register tab '${res.data?.tabTitle}' synced!`,
        variant: "success",
      });
      if (res.data?.url) {
        window.open(res.data.url, "_blank");
      }
    } catch (err: any) {
      toast({
        title: "Sheet Sync Notice",
        description: err?.message || "Failed to update Google Sheet tab.",
        variant: "destructive",
      });
    } finally {
      setIsSyncingSheet(false);
    }
  };

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
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              Monthly Attendance Register
              <span className="text-amber-400 text-lg font-bold">({data?.monthName || selectedMonth})</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              High-accuracy attendance performance metrics bifurcated across Talabat and Faculty.
              Displaying monthly registers with automatic transition for upcoming months.
            </p>
          </div>

          {/* Month Selector & Sheet Sync Actions */}
          <div className="flex flex-wrap items-center gap-3">
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
                title="Next Month (From Monday)"
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

            <button
              type="button"
              onClick={handleSyncToGoogleSheet}
              disabled={isSyncingSheet}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-emerald-950 font-black text-xs shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <Share2 className={`w-3.5 h-3.5 ${isSyncingSheet ? "animate-spin" : ""}`} />
              <span>{isSyncingSheet ? "Syncing..." : "Sync to Google Sheet"}</span>
            </button>

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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6">
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

      {/* ── Catchy Google Sheets Style Table ── */}
      <div className="rounded-[20px] bg-white border border-slate-200 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          {activeAudience === "STUDENT" ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-black uppercase tracking-wider text-[11px] border-b border-slate-800">
                  <th className="py-3.5 px-3 text-center w-12">#</th>
                  <th className="py-3.5 px-4">Talabat Full Name</th>
                  <th className="py-3.5 px-3">ITS / Student ID</th>
                  <th className="py-3.5 px-3">Class</th>
                  <th className="py-3.5 px-3 text-center bg-emerald-950/60 text-emerald-300">Present</th>
                  <th className="py-3.5 px-3 text-center bg-amber-950/60 text-amber-300">Late</th>
                  <th className="py-3.5 px-3 text-center bg-sky-950/60 text-sky-300">Leave</th>
                  <th className="py-3.5 px-3 text-center bg-rose-950/60 text-rose-300">Absent</th>
                  <th className="py-3.5 px-3 text-center">Sessions</th>
                  <th className="py-3.5 px-4 text-center">Monthly Turnout</th>
                  <th className="py-3.5 px-4 text-center">Performance Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTalabat.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 font-semibold">
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
                        <td className="py-3 px-3 text-center font-bold text-slate-400 font-mono">
                          {s.sNo}
                        </td>
                        <td className="py-3 px-4 font-black text-slate-900 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-black text-[11px] flex items-center justify-center border border-emerald-300 shrink-0">
                            {s.name.charAt(0)}
                          </div>
                          <span>{s.name}</span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-600">
                          {s.its}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                            {s.gradeDisplay}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-700 bg-emerald-50/40">
                          {s.present}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-amber-700 bg-amber-50/40">
                          {s.late}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-sky-700 bg-sky-50/40">
                          {s.leave}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-rose-700 bg-rose-50/40">
                          {s.absent}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">
                          {s.total}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
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
                            <span className="text-xs font-black font-mono text-slate-900 w-10 text-right">
                              {s.rate}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              s.rate >= 90
                                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                                : s.rate >= 80
                                ? "bg-teal-100 text-teal-900 border border-teal-300"
                                : s.rate >= 70
                                ? "bg-blue-100 text-blue-900 border border-blue-300"
                                : "bg-amber-100 text-amber-900 border border-amber-300"
                            }`}
                          >
                            {s.tier}
                          </span>
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
                  <th className="py-3.5 px-3 text-center w-12">#</th>
                  <th className="py-3.5 px-4">Faculty Member Name</th>
                  <th className="py-3.5 px-3">Employee / ITS</th>
                  <th className="py-3.5 px-3">Department</th>
                  <th className="py-3.5 px-3">Khidmat Mauze</th>
                  <th className="py-3.5 px-3 text-center bg-emerald-950/60 text-emerald-300">Present</th>
                  <th className="py-3.5 px-3 text-center bg-amber-950/60 text-amber-300">Late</th>
                  <th className="py-3.5 px-3 text-center bg-rose-950/60 text-rose-300">Absent</th>
                  <th className="py-3.5 px-3 text-center">Sessions</th>
                  <th className="py-3.5 px-4 text-center">Monthly Turnout</th>
                  <th className="py-3.5 px-4 text-center">Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFaculty.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 font-semibold">
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
                        <td className="py-3 px-3 text-center font-bold text-slate-400 font-mono">
                          {f.sNo}
                        </td>
                        <td className="py-3 px-4 font-black text-slate-900 flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-800 font-black text-[11px] flex items-center justify-center border border-indigo-300 shrink-0">
                            {f.name.charAt(0)}
                          </div>
                          <span>{f.name}</span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-600">
                          {f.employeeId}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 font-bold text-[11px]">
                            {f.department}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-500">
                          {f.khidmatMauze}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-emerald-700 bg-emerald-50/40">
                          {f.present}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-amber-700 bg-amber-50/40">
                          {f.late}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-rose-700 bg-rose-50/40">
                          {f.absent}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">
                          {f.total}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
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
                            <span className="text-xs font-black font-mono text-slate-900 w-10 text-right">
                              {f.rate}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
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
    </div>
  );
}
