"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Fingerprint,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Radio,
  ClipboardList,
  BarChart3,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  verificationMethod: string;
  biometricMethod: string | null;
  notes: string | null;
  createdAt: string;
}

interface Stats {
  total: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
}

interface TeacherInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  employeeId: string;
  its: string | null;
  department: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType; dot: string }> = {
  PRESENT: { label: "Present", color: "text-emerald-700", bg: "bg-emerald-100", icon: CheckCircle2, dot: "bg-emerald-400" },
  LATE: { label: "Late", color: "text-amber-700", bg: "bg-amber-100", icon: Clock, dot: "bg-amber-400" },
  ABSENT: { label: "Absent", color: "text-red-600", bg: "bg-red-100", icon: XCircle, dot: "bg-red-400" },
  EARLY_DEPARTURE: { label: "Early Departure", color: "text-orange-600", bg: "bg-orange-100", icon: AlertTriangle, dot: "bg-orange-400" },
  MEDICAL: { label: "Medical", color: "text-violet-700", bg: "bg-violet-100", icon: ShieldCheck, dot: "bg-violet-400" },
  ON_LEAVE: { label: "On Leave", color: "text-blue-600", bg: "bg-blue-100", icon: ShieldCheck, dot: "bg-blue-400" },
};

const METHOD_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  BIOMETRIC: { label: "Biometric (HIK)", icon: Fingerprint, color: "text-indigo-600" },
  FACIAL: { label: "Facial Recognition", icon: Fingerprint, color: "text-purple-600" },
  FINGERPRINT: { label: "Fingerprint Scan", icon: Fingerprint, color: "text-indigo-600" },
  MANUAL: { label: "Manual Entry", icon: ClipboardList, color: "text-slate-600" },
};

function getISTMonth(date: Date) {
  // Get current IST year/month
  const ist = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  return { year: ist.getFullYear(), month: ist.getMonth() };
}

export default function TeacherMyAttendancePage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  // Month navigation
  const [viewDate, setViewDate] = useState(() => {
    const ist = getISTMonth(new Date());
    return ist;
  });

  const monthParam = `${viewDate.year}-${String(viewDate.month + 1).padStart(2, "0")}`;

  const fetchData = async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`/api/teacher/my-attendance?month=${monthParam}`);
      const json = await res.json();
      if (json.success) {
        setTeacher(json.data.teacher);
        setStats(json.data.stats);
        setRecords(json.data.records);
      } else {
        toast({ variant: "destructive", title: "Error", description: json.error || "Failed to load" });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load attendance." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthParam]);

  const prevMonth = () => {
    setViewDate((prev) => {
      const d = new Date(prev.year, prev.month - 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const nextMonth = () => {
    const now = getISTMonth(new Date());
    setViewDate((prev) => {
      if (prev.year === now.year && prev.month === now.month) return prev;
      const d = new Date(prev.year, prev.month + 1, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const monthLabel = new Date(viewDate.year, viewDate.month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const now = getISTMonth(new Date());
  const isCurrentMonth = viewDate.year === now.year && viewDate.month === now.month;

  const attendanceRate = stats && stats.total > 0
    ? Math.round(((stats.present + stats.late) / stats.total) * 100)
    : null;

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  };

  const formatDay = (iso: string) => {
    const d = new Date(iso);
    return {
      dayName: d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "Asia/Kolkata" }),
      date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }),
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Attendance</h1>
              <p className="text-sm text-slate-500">Biometric (Hikvision) + manual attendance record</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
          </div>
        ) : (
          <>
            {/* Stats cards */}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { label: "Total Days", value: stats.total, icon: Calendar, grad: "from-slate-400 to-slate-600" },
                  { label: "Present", value: stats.present, icon: CheckCircle2, grad: "from-emerald-400 to-emerald-600" },
                  { label: "Late", value: stats.late, icon: Clock, grad: "from-amber-400 to-amber-600" },
                  { label: "Absent", value: stats.absent, icon: XCircle, grad: "from-red-400 to-rose-600" },
                  { label: "Leave / Medical", value: stats.onLeave, icon: ShieldCheck, grad: "from-violet-400 to-violet-600" },
                ].map((s) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-2xl bg-white border border-slate-100 shadow-sm p-4 flex items-center gap-3"
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${s.grad} shadow-md shrink-0`}>
                      <s.icon className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 leading-tight">{s.label}</p>
                      <p className="text-xl font-bold text-slate-900">{s.value}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Attendance rate bar */}
            {attendanceRate !== null && (
              <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-indigo-500" />
                    <span className="text-sm font-semibold text-slate-700">Attendance Rate — {monthLabel}</span>
                  </div>
                  <span className={`text-lg font-bold ${attendanceRate >= 90 ? "text-emerald-600" : attendanceRate >= 75 ? "text-amber-600" : "text-red-500"}`}>
                    {attendanceRate}%
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${attendanceRate}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className={`h-full rounded-full ${attendanceRate >= 90 ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : attendanceRate >= 75 ? "bg-gradient-to-r from-amber-400 to-amber-600" : "bg-gradient-to-r from-red-400 to-rose-600"}`}
                  />
                </div>
              </div>
            )}

            {/* Month navigator */}
            <div className="flex items-center justify-between rounded-2xl bg-white border border-slate-100 shadow-sm px-5 py-3">
              <Button variant="ghost" size="sm" onClick={prevMonth} className="gap-1">
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500" />
                <span className="text-sm font-semibold text-slate-800">{monthLabel}</span>
                {isCurrentMonth && <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">Current</span>}
              </div>
              <Button variant="ghost" size="sm" onClick={nextMonth} disabled={isCurrentMonth} className="gap-1">
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Records list */}
            <div className="rounded-2xl bg-white border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-indigo-500" />
                <h3 className="font-semibold text-slate-800">Attendance Records ({records.length})</h3>
              </div>

              {records.length === 0 ? (
                <div className="text-center py-14 text-slate-400">
                  <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No records for {monthLabel}</p>
                  <p className="text-sm mt-1">Attendance will appear here once scanned or entered.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {records.map((r, i) => {
                    const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.ABSENT;
                    const methodCfg = METHOD_CONFIG[r.verificationMethod?.toUpperCase()] ||
                      METHOD_CONFIG[r.biometricMethod?.toUpperCase() || ""] ||
                      METHOD_CONFIG.MANUAL;
                    const { dayName, date } = formatDay(r.date);
                    const isHik = r.verificationMethod === "BIOMETRIC" || r.biometricMethod;

                    return (
                      <motion.div
                        key={r.id}
                        initial={{ opacity: 0, y: 2 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50/50 transition-colors"
                      >
                        {/* Date column */}
                        <div className="shrink-0 w-16 text-center">
                          <p className="text-xs font-medium text-slate-500">{dayName}</p>
                          <p className="text-sm font-bold text-slate-900">{date}</p>
                        </div>

                        {/* Status dot + label */}
                        <div className="flex items-center gap-2 w-28 shrink-0">
                          <span className={`inline-flex h-2 w-2 rounded-full ${cfg.dot} shrink-0`} />
                          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                        </div>

                        {/* Times */}
                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-1 min-w-0">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            In: <span className="font-medium text-slate-700">{formatTime(r.checkInTime)}</span>
                          </span>
                          {r.checkOutTime && (
                            <span className="flex items-center gap-1">
                              Out: <span className="font-medium text-slate-700">{formatTime(r.checkOutTime)}</span>
                            </span>
                          )}
                        </div>

                        {/* Source badge */}
                        <div className="shrink-0">
                          {isHik ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                              <Radio className="h-2.5 w-2.5" />
                              HIK {r.biometricMethod || "Biometric"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                              <ClipboardList className="h-2.5 w-2.5" />
                              Manual
                            </span>
                          )}
                        </div>

                        {/* Notes */}
                        {r.notes && (
                          <p className="text-xs text-slate-400 max-w-40 truncate shrink-0">{r.notes}</p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
