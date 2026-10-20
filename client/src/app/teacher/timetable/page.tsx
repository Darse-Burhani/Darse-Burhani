"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Clock,
  BookOpen,
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Loader2,
  Users,
  MapPin,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

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

export default function TeacherTimetablePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    fetchTimetable();
  }, []);

  const slotsMap = new Map<string, any>();
  if (data?.slots) {
    data.slots.forEach((s: any) => {
      slotsMap.set(`${s.dayOfWeek}_${s.period}`, s);
    });
  }

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
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl" style={{ background: "linear-gradient(135deg, #06241a 0%, #0a3d2c 50%, #03180f 100%)" }}>
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0" style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}>
              <CalendarDays className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                  My Official Teaching Schedule
                </span>
                <span className="text-xs text-emerald-200 font-mono">Term I • 1448 H</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white">
                Faculty Weekly Timetable Matrix
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5">
                {data?.teacher?.name ? `${data.teacher.name} • ${data?.slots?.length || 0} Teaching Sessions / Week` : "Weekly Academic Timetable"}
              </p>
            </div>
          </div>

          <Button
            onClick={() => fetchTimetable(true)}
            disabled={loading || refreshing}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold gap-2 self-start sm:self-center"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-amber-300" : ""}`} />
            Refresh
          </Button>
        </div>
      </motion.div>

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
  );
}
