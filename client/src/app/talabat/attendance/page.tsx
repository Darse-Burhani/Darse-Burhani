"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Award,
  Flame,
  TrendingUp,
  Loader2,
  History,
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  X,
  FileCheck2,
  FileX2,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/student/PageHeader";

const justificationConfig: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "Justification pending", color: "text-amber-700", bg: "bg-amber-100" },
  APPROVED: { label: "Justified", color: "text-emerald-700", bg: "bg-emerald-100" },
  REJECTED: { label: "Rejected", color: "text-red-700", bg: "bg-red-100" },
};

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType; calendarColor: string }> = {
  PRESENT: {
    label: "Present",
    color: "text-emerald-700",
    bg: "bg-emerald-100",
    icon: CheckCircle2,
    calendarColor: "bg-emerald-400",
  },
  LATE: {
    label: "Late",
    color: "text-amber-700",
    bg: "bg-amber-100",
    icon: Clock,
    calendarColor: "bg-amber-400",
  },
  ABSENT: {
    label: "Absent",
    color: "text-red-700",
    bg: "bg-red-100",
    icon: XCircle,
    calendarColor: "bg-red-400",
  },
  EARLY_DEPARTURE: {
    label: "Early Departure",
    color: "text-orange-700",
    bg: "bg-orange-100",
    icon: AlertTriangle,
    calendarColor: "bg-orange-400",
  },
};

const tilawatStatusConfig: Record<string, { label: string; color: string; bg: string; calendarColor: string }> = {
  PRESENT: {
    label: "Tilawat al Dua — Present",
    color: "text-emerald-700",
    bg: "bg-emerald-100",
    calendarColor: "bg-emerald-400",
  },
  LATE: {
    label: "Tilawat al Dua — Late",
    color: "text-amber-700",
    bg: "bg-amber-100",
    calendarColor: "bg-amber-400",
  },
};

function getDayColor(status: string | null): string {
  if (!status) return "bg-gray-100 text-gray-500";
  const cfg = statusConfig[status];
  return cfg ? `${cfg.calendarColor} text-white font-bold` : "bg-gray-100";
}

function getDayHover(status: string | null): string {
  if (!status) return "hover:bg-gray-200";
  return "hover:opacity-80";
}

function getTilawatDayColor(status: string | null): string {
  if (!status) return "bg-gray-100 text-gray-500";
  const cfg = tilawatStatusConfig[status];
  return cfg ? `${cfg.calendarColor} text-white font-bold` : "bg-gray-100";
}

function getTilawatDayHover(status: string | null): string {
  if (!status) return "hover:bg-gray-200";
  return "hover:opacity-80";
}

const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TalabatAttendancePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [justifyRecord, setJustifyRecord] = useState<any>(null);
  const [justifyReason, setJustifyReason] = useState("");
  const [justifySubmitting, setJustifySubmitting] = useState(false);
  const [justifyError, setJustifyError] = useState("");

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/talabat/attendance?month=${currentMonth}&year=${currentYear}`,
      );
      const json = await res.json();
      if (json.success) setData(json.data);
    } finally {
      setLoading(false);
    }
  }, [currentMonth, currentYear]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Live biometric scan update: attendance marks in real-time when student scans on hardware
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/biometric/events/stream");
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data);
          if (ev.type === "MATCHED" || ev.type === "DUPLICATE") {
            fetchAttendance();
          }
        } catch {}
      };
    } catch {}
    return () => {
      es?.close();
    };
  }, [fetchAttendance]);

  const submitJustification = async () => {
    if (!justifyReason.trim()) {
      setJustifyError("Please enter a reason for your absence.");
      return;
    }
    setJustifySubmitting(true);
    setJustifyError("");
    try {
      const res = await fetch("/api/attendance/justify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId: justifyRecord.id, reason: justifyReason.trim() }),
      });
      const json = await res.json();
      if (!json.success) {
        setJustifyError(json.error || "Failed to submit justification.");
        return;
      }
      setJustifyRecord(null);
      setJustifyReason("");
      await fetchAttendance();
    } catch {
      setJustifyError("Failed to submit justification. Please try again.");
    } finally {
      setJustifySubmitting(false);
    }
  };

  const today = new Date();
  const currentTotalMonths = currentYear * 12 + currentMonth;
  const maxTotalMonths = today.getFullYear() * 12 + today.getMonth() + 3; // Allow up to 3 months ahead
  const minTotalMonths = 2020 * 12; // Jan 2020 lower bound
  const canGoNext = currentTotalMonths < maxTotalMonths;
  const canGoPrev = currentTotalMonths > minTotalMonths;

  const goNextMonth = () => {
    if (!canGoNext) return;
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goPrevMonth = () => {
    if (!canGoPrev) return;
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const isCurrentMonth =
    currentMonth === new Date().getMonth() &&
    currentYear === new Date().getFullYear();

  // Get first day of month (0=Sun, 1=Mon, ...)
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Build calendar grid with empty leading cells
  const calendarGrid: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarGrid.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarGrid.push(d);

  const stats = data?.stats;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <PageHeader
        icon={CalendarDays}
        title="My Attendance"
        subtitle={stats ? `Grade ${stats.grade}${stats.section} · ${stats.overall.total} total records` : "Track your attendance history"}
      />

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        </div>
      ) : stats ? (
        <>
          {/* Stats Row */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8"
          >
            <Card className="fatimi-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    This Month
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 font-medium">Attendance Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.month.percentage}%</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {stats.month.present + stats.month.late} of {stats.month.total} days
                </p>
              </CardContent>
            </Card>

            <Card className="fatimi-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-amber-100 text-amber-600">
                    <Flame className="w-5 h-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                    Current
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 font-medium">Day Streak</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.currentStreak}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">consecutive days</p>
              </CardContent>
            </Card>

            <Card className="fatimi-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    Lifetime
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 font-medium">Overall Rate</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.overall.percentage}%</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {stats.overall.present + stats.overall.late} of {stats.overall.total}
                </p>
              </CardContent>
            </Card>

            <Card className="fatimi-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                    <Award className="w-5 h-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                    This Month
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 font-medium">Total Present</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.month.present}</p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {stats.month.late > 0 ? `${stats.month.late} late` : "No late arrivals"}
                </p>
              </CardContent>
            </Card>

            {/* Tilawat al Dua Attendance Card */}
            <Card className="fatimi-card">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                    Tilawat al Dua
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 font-medium">Tilawat Attendance</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {data?.biometricStats?.percentage ?? 0}%
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {data?.biometricStats?.present + data?.biometricStats?.late || 0} of {data?.biometricStats?.total || 0} days
                </p>
              </CardContent>
            </Card>

          </motion.div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Calendar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="lg:col-span-2"
            >
              <Card className="fatimi-card">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="w-5 h-5 text-emerald-500" />
                      {monthNames[currentMonth]} {currentYear}
                    </CardTitle>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={goPrevMonth}
                        className="p-2 rounded-lg hover:bg-emerald-50 text-gray-500 hover:text-emerald-600 transition-colors"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <span className="text-sm font-medium text-gray-500 w-8 text-center">
                        {isCurrentMonth && <Badge variant="success" className="text-[10px]">Now</Badge>}
                      </span>
                      <button
                        onClick={goNextMonth}
                        className="p-2 rounded-lg hover:bg-emerald-50 text-gray-500 hover:text-emerald-600 transition-colors"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {dayNames.map((name) => (
                      <div key={name} className="text-center text-xs font-medium text-gray-500 py-1">
                        {name}
                      </div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarGrid.map((day, i) => {
                      if (day === null) {
                        return <div key={`empty-${i}`} className="aspect-square" />;
                      }
                      const calendarEntry = data?.calendar?.find((c: any) => c.day === day);
                      const status = calendarEntry?.status || null;
                      const tilawatStatus = calendarEntry?.tilawatStatus || null;
                      return (
                        <div
                          key={day}
                          className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm transition-all cursor-default relative`}
                          title={
                            `${monthNames[currentMonth]} ${day}`
                            + (status ? ` — Class: ${statusConfig[status]?.label || status}` : '')
                            + (tilawatStatus ? ` — ${tilawatStatusConfig[tilawatStatus]?.label || 'Tilawat al Dua: ' + tilawatStatus}` : '')
                          }
                        >
                          <div className={`w-full h-1/2 rounded-t-xl ${getDayColor(status)} ${getDayHover(status)} flex items-center justify-center`}>
                            {day}
                          </div>
                          <div className={`w-full h-1/2 rounded-b-xl ${getTilawatDayColor(tilawatStatus)} ${getTilawatDayHover(tilawatStatus)} flex items-center justify-center`}>
                            {tilawatStatus && (
                              <span className="text-[10px] font-bold text-white drop-shadow">
                                {tilawatStatusConfig[tilawatStatus]?.label || `Tilawat: ${tilawatStatus}`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
                      <span>Class Attendance:</span>
                    </div>
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${cfg.calendarColor}`} />
                        <span className="text-xs text-gray-500">{cfg.label}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-gray-100" />
                      <span className="text-xs text-gray-500">No Record</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-600 mt-2 w-full">
                      <span>Tilawat al Dua:</span>
                    </div>
                    {Object.entries(tilawatStatusConfig).map(([key, cfg]) => (
                      <div key={key} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded ${cfg.calendarColor}`} />
                        <span className="text-xs text-gray-500">{cfg.label.replace('Tilawat al Dua — ', '')}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded bg-gray-100" />
                      <span className="text-xs text-gray-500">No Scan</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* This Month Breakdown */}
              <Card className="fatimi-card mt-6">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-5 text-emerald-500" />
                    This Month Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { label: "Present", count: stats.month.present, color: "bg-emerald-400" },
                      { label: "Late", count: stats.month.late, color: "bg-amber-400" },
                      { label: "Absent", count: stats.month.absent, color: "bg-red-400" },
                      { label: "Early Departure", count: stats.month.earlyDeparture, color: "bg-orange-400" },
                    ].map((item) => {
                      const pct = stats.month.total > 0 ? (item.count / stats.month.total) * 100 : 0;
                      return (
                        <div key={item.label} className="flex items-center gap-3">
                          <span className="text-xs font-medium text-gray-600 w-28">{item.label}</span>
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: 0.3 }}
                              className={`h-full rounded-full ${item.color}`}
                            />
                          </div>
                          <span className="text-xs font-semibold text-gray-900 w-8 text-right">{item.count}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Tilawat al Dua Attendance Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="lg:col-span-2"
            >
              <Card className="fatimi-card mt-6">
                <div className="fatimi-card-header bg-gradient-to-r from-purple-500 to-indigo-600" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <BookOpen className="w-4 h-5 text-purple-500" />
                    Tilawat al Dua Attendance ({data?.biometricStats?.windowName || "Tilawat al Dua"})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">On-Time Scans</p>
                      <p className="text-xl font-extrabold text-emerald-700 mt-0.5">{data?.biometricStats?.present || 0}</p>
                    </div>
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Late Scans</p>
                      <p className="text-xl font-extrabold text-amber-700 mt-0.5">{data?.biometricStats?.late || 0}</p>
                    </div>
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Missed</p>
                      <p className="text-xl font-extrabold text-gray-700 mt-0.5">
                        {((data?.biometricStats?.total || 0) - (data?.biometricStats?.present || 0) - (data?.biometricStats?.late || 0))}
                      </p>
                    </div>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Window</p>
                      <p className="text-sm font-bold text-purple-700 mt-0.5 font-mono">
                        {data?.biometricStats?.windowStart || "07:00"} – {data?.biometricStats?.windowEnd || "08:15"}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl">
                    <p className="text-xs text-purple-700 font-medium flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Daily morning recitation attendance (Tilawat al Dua) tracked via biometric scan.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="fatimi-card">
                <div className="fatimi-card-header" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-500" />
                    Recent Records
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {data?.recentRecords?.length > 0 ? (
                    <div className="space-y-3">
                      {data.recentRecords.map((record: any) => {
                        const cfg = statusConfig[record.status];
                        const Icon = cfg?.icon || Clock;
                        const date = new Date(record.date);
                        const jcfg = justificationConfig[record.justificationStatus];
                        const canJustify =
                          (record.status === "ABSENT" || record.status === "EARLY_DEPARTURE") &&
                          (!record.justificationStatus ||
                            record.justificationStatus === "NONE" ||
                            record.justificationStatus === "REJECTED");
                        return (
                          <div
                            key={record.id}
                            className="flex items-start gap-3 p-3 rounded-xl hover:bg-emerald-50/30 transition-colors"
                          >
                            <div className={`p-2 rounded-lg ${cfg?.bg || "bg-gray-100"}`}>
                              <Icon className={`w-4 h-4 ${cfg?.color || "text-gray-500"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900">
                                {cfg?.label || record.status}
                              </p>
                              <p className="text-xs text-gray-500">
                                {date.toLocaleDateString("en-US", {
                                  weekday: "short",
                                  month: "short",
                                  day: "numeric",
                                })}
                                {record.className && ` · ${record.className}`}
                              </p>
                              {record.checkInTime && (
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                  Check-in: {new Date(record.checkInTime).toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              )}
                              {jcfg && (
                                <div className="flex items-start gap-1.5 mt-1.5">
                                  {record.justificationStatus === "APPROVED" ? (
                                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                                  ) : record.justificationStatus === "REJECTED" ? (
                                    <FileX2 className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                                  )}
                                  <div>
                                    <span className={`inline-block text-[10px] font-semibold ${jcfg.color} ${jcfg.bg} px-1.5 py-0.5 rounded`}>
                                      {jcfg.label}
                                    </span>
                                    {record.justification && (
                                      <p className="text-[11px] text-gray-500 mt-0.5">
                                        “{record.justification}”
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${cfg?.bg} ${cfg?.color}`}
                              >
                                {cfg?.label || record.status}
                              </Badge>
                              {canJustify && (
                                <button
                                  onClick={() => {
                                    setJustifyRecord(record);
                                    setJustifyReason("");
                                    setJustifyError("");
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 px-2 py-1 rounded-lg transition-colors"
                                >
                                  <MessageSquarePlus className="w-3.5 h-3.5" />
                                  Justify
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CalendarDays className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                      <p className="text-sm text-gray-500">No attendance records found</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </>
      ) : (
        <Card className="fatimi-card">
          <CardContent className="p-12 text-center text-gray-500">
            Failed to load attendance data
          </CardContent>
        </Card>
      )}

      {/* Justification Modal */}
      {justifyRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !justifySubmitting && setJustifyRecord(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <MessageSquarePlus className="w-5 h-5 text-emerald-600" />
                  Justify Absence
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {justifyRecord.className}
                  {justifyRecord.date &&
                    ` · ${new Date(justifyRecord.date).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}`}
                </p>
              </div>
              <button
                onClick={() => !justifySubmitting && setJustifyRecord(null)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <label htmlFor="justifyReason" className="block text-sm font-medium text-gray-700 mb-1.5">
              Reason for absence
            </label>
            <textarea
              id="justifyReason"
              name="justifyReason"
              value={justifyReason}
              onChange={(e) => setJustifyReason(e.target.value)}
              placeholder="e.g. Was unwell and visited the doctor"
              rows={4}
              maxLength={500}
              className="w-full rounded-xl border border-gray-200 p-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
            />
            <p className="text-[10px] text-gray-500 text-right mt-1">
              {justifyReason.length}/500
            </p>

            {justifyError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-2">
                {justifyError}
              </p>
            )}

            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setJustifyRecord(null)}
                disabled={justifySubmitting}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={submitJustification}
                disabled={justifySubmitting}
              >
                {justifySubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
