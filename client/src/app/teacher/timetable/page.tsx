"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  BookOpen,
  ArrowRightLeft,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Printer,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

const DAYS = [
  { day: 1, name: "Monday", short: "Mon" },
  { day: 2, name: "Tuesday", short: "Tue" },
  { day: 3, name: "Wednesday", short: "Wed" },
  { day: 4, name: "Thursday", short: "Thu" },
  { day: 5, name: "Friday", short: "Fri" },
  { day: 6, name: "Saturday", short: "Sat" },
];

const PERIOD_DEFS = [
  { period: 1, time: "10:30 – 11:00", label: "P1" },
  { period: 2, time: "11:00 – 11:30", label: "P2" },
  { period: 3, time: "11:30 – 12:00", label: "P3" },
  { period: 4, time: "12:00 – 12:30", label: "P4" },
  { period: 5, time: "12:30 – 13:00", label: "P5" },
  { period: 6, time: "14:15 – 14:45", label: "P6" },
  { period: 7, time: "14:45 – 15:15", label: "P7" },
  { period: 8, time: "15:15 – 15:45", label: "P8" },
  { period: 9, time: "15:45 – 16:15", label: "P9" },
];

const ALL_DARAJAH_CLASSES = ["1 A", "1 B", "2 A", "2 B", "3 A", "3 B", "4 A", "4 B"];

export default function TeacherTimetablePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewTab, setViewTab] = useState<"my-schedule" | "classes">("my-schedule");

  // Darajah Class Explorer State
  const [selectedClassName, setSelectedClassName] = useState<string>("1 A");
  const [classData, setClassData] = useState<any>(null);
  const [loadingClass, setLoadingClass] = useState(false);

  const fetchTimetable = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/teacher/timetable");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load timetable." });
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  const fetchClassTimetable = async (className: string) => {
    setLoadingClass(true);
    try {
      const res = await fetch(`/api/teacher/timetable/class/${encodeURIComponent(className)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setClassData(json.data);
      } else {
        setClassData(null);
      }
    } catch {
      setClassData(null);
    } finally {
      setLoadingClass(false);
    }
  };

  useEffect(() => {
    fetchTimetable();
  }, []);

  useEffect(() => {
    if (viewTab === "classes") {
      fetchClassTimetable(selectedClassName);
    }
  }, [viewTab, selectedClassName]);

  // My Slots Map
  const slotsMap = useMemo(() => {
    const map = new Map<string, any>();
    if (data?.slots) {
      data.slots.forEach((s: any) => {
        map.set(`${s.dayOfWeek}_${s.period}`, s);
      });
    }
    return map;
  }, [data]);

  // Class Slots Map
  const classSlotsMap = useMemo(() => {
    const map = new Map<string, any>();
    if (classData?.slots) {
      classData.slots.forEach((s: any) => {
        map.set(`${s.dayOfWeek}_${s.period}`, s);
      });
    }
    return map;
  }, [classData]);

  const badalDuties = data?.badalDuties || [];
  const badalsForMe = data?.badalsForMe || [];

  const now = new Date();
  const istDayStr = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(now);
  const dowMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const todayDow = dowMap[istDayStr] || 1;
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

  const todayDutiesMap = new Map<number, any>();
  badalDuties.forEach((b: any) => {
    if (b.date === todayIso) todayDutiesMap.set(b.period, b);
  });

  const todayCoveredMap = new Map<number, any>();
  badalsForMe.forEach((b: any) => {
    if (b.date === todayIso) todayCoveredMap.set(b.period, b);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl"
        style={{ background: "linear-gradient(135deg, #06241a 0%, #0a3d2c 50%, #03180f 100%)" }}
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
              style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}
            >
              <CalendarDays className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                  Academic Timetable Matrix
                </span>
                <span className="text-xs text-emerald-200 font-mono">Term I • 1448 H</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white">
                Faculty &amp; Class Timetable Hub
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5">
                {data?.teacher?.name ? `${data.teacher.name} • ${data?.slots?.length || 0} Teaching Sessions / Week` : "Weekly Academic Timetable"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <Button
              onClick={() => window.print()}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold gap-1.5"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" /> Print
            </Button>
            <Button
              onClick={() => fetchTimetable(true)}
              disabled={loading || refreshing}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-300" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="mt-6 pt-4 border-t border-emerald-800/60 flex items-center gap-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setViewTab("my-schedule")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              viewTab === "my-schedule"
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>1. My Personal Schedule ({data?.slots?.length || 0} Periods)</span>
          </button>

          <button
            onClick={() => setViewTab("classes")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              viewTab === "classes"
                ? "bg-amber-400 text-slate-950 shadow-md"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>2. Darajah Class Timetables (1A–4B)</span>
          </button>
        </div>
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: MY PERSONAL SCHEDULE
         ───────────────────────────────────────────────────────────── */}
      {viewTab === "my-schedule" && (
        <div className="space-y-6">
          {/* Badal Duties Alert Notice if assigned */}
          {badalDuties.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex items-start gap-3 shadow-xs">
              <ArrowRightLeft className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                  Assigned Badal (Substitute) Duties ({badalDuties.length})
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {badalDuties.map((b: any) => (
                    <div key={b.id} className="p-3 bg-white rounded-xl border border-amber-200 text-xs flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">
                          Class {b.className} • {b.subject} (Period {b.period})
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Date: {b.date} • Covering for {b.originalTeacher}
                        </div>
                        {b.instructions && <div className="text-[10.5px] text-amber-800 italic mt-0.5">&ldquo;{b.instructions}&rdquo;</div>}
                      </div>
                      <Badge variant={b.isFulfilled ? "default" : "secondary"} className="shrink-0">
                        {b.isFulfilled ? "Fulfilled" : "Pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Timetable Matrix */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-[#06241a] text-white">
                    <th className="p-3 text-left text-xs font-black uppercase tracking-wider border-r border-emerald-900/60 w-28">
                      Day / Period
                    </th>
                    {PERIOD_DEFS.map((p) => (
                      <th key={p.period} className="p-2.5 text-center border-r border-emerald-900/60 last:border-r-0 min-w-[110px]">
                        <div className="text-xs font-black text-amber-300">{p.label}</div>
                        <div className="text-[10px] font-mono opacity-80 mt-0.5">{p.time}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((d) => {
                    const isToday = d.day === todayDow;
                    return (
                      <tr key={d.day} className={`border-b border-slate-100 transition-colors ${isToday ? "bg-amber-50/20" : "hover:bg-slate-50/60"}`}>
                        <td className={`p-3 font-black text-xs border-r border-slate-200/80 ${isToday ? "bg-amber-100/60 text-amber-950 font-extrabold" : "bg-slate-50/80 text-slate-900"}`}>
                          <div className="flex items-center gap-1.5">
                            <span>{d.name}</span>
                            {isToday && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
                          </div>
                        </td>
                        {PERIOD_DEFS.map((p) => {
                          const slot = slotsMap.get(`${d.day}_${p.period}`);
                          const badalDutyToday = isToday ? todayDutiesMap.get(p.period) : null;
                          const coveredToday = isToday ? todayCoveredMap.get(p.period) : null;

                          return (
                            <td key={p.period} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                              {badalDutyToday ? (
                                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 shadow-2xs">
                                  <div className="text-[10px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
                                    <ArrowRightLeft className="w-2.5 h-2.5 text-amber-700" /> Badal Duty
                                  </div>
                                  <div className="text-xs font-black text-slate-900 leading-tight mt-0.5">
                                    {badalDutyToday.subject}
                                  </div>
                                  <div className="text-[11px] text-amber-900 font-bold mt-1">
                                    Class {badalDutyToday.className}
                                  </div>
                                  <div className="text-[9.5px] text-slate-500 mt-0.5 italic">
                                    For {badalDutyToday.originalTeacher}
                                  </div>
                                </div>
                              ) : slot ? (
                                <div className={`p-2.5 rounded-xl border shadow-2xs ${coveredToday ? "bg-slate-50 border-slate-300 opacity-75" : "bg-gradient-to-br from-emerald-50/80 to-slate-50 border-emerald-200/80"}`}>
                                  <div className="text-xs font-black text-slate-900 leading-tight">
                                    {slot.subject}
                                  </div>
                                  <div className="text-[11px] text-emerald-800 font-bold mt-1">
                                    Class {slot.className}
                                  </div>
                                  {coveredToday ? (
                                    <div className="text-[9.5px] font-bold text-amber-800 mt-1 flex items-center gap-1">
                                      <ArrowRightLeft className="w-2.5 h-2.5" /> Covered by {coveredToday.badalTeacher}
                                    </div>
                                  ) : (
                                    <div className="text-[9.5px] font-mono text-slate-400 mt-1">
                                      {slot.roomNumber || `Room ${slot.className}`}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="h-16 flex items-center justify-center text-[10px] text-slate-300 font-medium">
                                  Free
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 2: DARAJAH CLASS TIMETABLES EXPLORER
         ───────────────────────────────────────────────────────────── */}
      {viewTab === "classes" && (
        <div className="space-y-6">
          {/* Class Selector Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-xs font-black uppercase text-slate-400 tracking-wider shrink-0 mr-1">
                Select Darajah:
              </span>
              {ALL_DARAJAH_CLASSES.map((clsName) => {
                const isSelected = selectedClassName === clsName;
                return (
                  <button
                    key={clsName}
                    onClick={() => setSelectedClassName(clsName)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[#06241a] text-amber-300 ring-2 ring-emerald-600/30 shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900"
                    }`}
                  >
                    <span>Class {clsName}</span>
                  </button>
                );
              })}
            </div>

            {classData?.class && (
              <div className="flex items-center gap-3 flex-wrap shrink-0">
                {classData.class.masool && (
                  <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200/80">
                    <Avatar className="w-7 h-7 ring-1 ring-amber-400 shrink-0">
                      {classData.class.masool.avatarUrl && <AvatarImage src={classData.class.masool.avatarUrl} alt={classData.class.masool.name} />}
                      <AvatarFallback className="bg-[#06241a] text-amber-300 text-[10px] font-bold">
                        {getInitials(classData.class.masool.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-[9px] font-black uppercase text-amber-800">Class Masool:</div>
                      <div className="text-xs font-bold text-slate-900 truncate max-w-[200px]" title={classData.class.masool.name}>
                        {classData.class.masool.name}
                      </div>
                    </div>
                  </div>
                )}
                <div className="text-xs font-semibold text-emerald-800 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200/60">
                  {classData.class.roomNumber} • {classData.class.studentCount} Talabat
                </div>
              </div>
            )}
          </div>

          {/* Grid View */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            {loadingClass ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs text-slate-500 mt-2">Loading Class {selectedClassName} timetable...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-[#06241a] text-white">
                      <th className="p-3 text-left text-xs font-black uppercase tracking-wider border-r border-emerald-900/60 w-28">
                        Day / Period
                      </th>
                      {PERIOD_DEFS.map((p) => (
                        <th key={p.period} className="p-2.5 text-center border-r border-emerald-900/60 last:border-r-0 min-w-[110px]">
                          <div className="text-xs font-black text-amber-300">{p.label}</div>
                          <div className="text-[10px] font-mono opacity-80 mt-0.5">{p.time}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((d) => (
                      <tr key={d.day} className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
                        <td className="p-3 font-black text-xs text-slate-900 border-r border-slate-200/80 bg-slate-50/80">
                          {d.name}
                        </td>
                        {PERIOD_DEFS.map((p) => {
                          const slot = classSlotsMap.get(`${d.day}_${p.period}`);
                          const isTaughtByMe = slot && data?.teacher && slot.teacherId === data.teacher.id;

                          return (
                            <td key={p.period} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                              {slot ? (
                                <div
                                  className={`p-2.5 rounded-xl border shadow-2xs transition-all ${
                                    isTaughtByMe
                                      ? "bg-emerald-100/70 border-emerald-400 ring-2 ring-emerald-500/30"
                                      : "bg-gradient-to-br from-slate-50 to-white border-slate-200/80"
                                  }`}
                                >
                                  <div className="text-xs font-black text-slate-900 leading-tight">
                                    {slot.subject}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1.5">
                                    <Avatar className="w-5 h-5 ring-1 ring-emerald-600/30 shrink-0">
                                      {slot.teacherAvatar && <AvatarImage src={slot.teacherAvatar} alt={slot.teacherName} />}
                                      <AvatarFallback className="text-[8px] font-black bg-[#06241a] text-amber-300">
                                        {getInitials(slot.teacherName)}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="text-[11px] text-slate-700 font-semibold truncate" title={slot.teacherName}>
                                      {slot.teacherName}
                                    </div>
                                  </div>
                                  {isTaughtByMe && (
                                    <div className="mt-1.5 pt-1 border-t border-emerald-200/60 flex items-center gap-1 text-[9px] font-black text-emerald-800">
                                      <Sparkles className="w-2.5 h-2.5 text-amber-600" /> My Sabaq Session
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="h-16 flex items-center justify-center text-[10px] text-slate-300 font-medium">
                                  —
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
