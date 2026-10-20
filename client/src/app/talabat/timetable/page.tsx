"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  Clock,
  BookOpen,
  User,
  GraduationCap,
  Sparkles,
  ArrowRightLeft,
  MapPin,
  RefreshCw,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  Mail,
  Fingerprint,
  ChevronRight,
  Sun,
  LayoutGrid,
  Columns,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

// Subject visual accent color palette
const SUBJECT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Qasaid: { bg: "bg-emerald-50", text: "text-emerald-900", border: "border-emerald-200" },
  "Daim al-Islam": { bg: "bg-amber-50", text: "text-amber-900", border: "border-amber-200" },
  "Sharhal akhbar": { bg: "bg-indigo-50", text: "text-indigo-900", border: "border-indigo-200" },
  "Kitab al-Taharat": { bg: "bg-teal-50", text: "text-teal-900", border: "border-teal-200" },
  "Kitab al-Iqtisar": { bg: "bg-cyan-50", text: "text-cyan-900", border: "border-cyan-200" },
  "Mukhtasar al-Asar": { bg: "bg-blue-50", text: "text-blue-900", border: "border-blue-200" },
  "Muntaza al-Akhbar": { bg: "bg-purple-50", text: "text-purple-900", border: "border-purple-200" },
  "Raudat Hidayat": { bg: "bg-rose-50", text: "text-rose-900", border: "border-rose-200" },
  "Dirasat Uloom il-Quran": { bg: "bg-emerald-50", text: "text-emerald-950", border: "border-emerald-300" },
  Tamreen: { bg: "bg-orange-50", text: "text-orange-900", border: "border-orange-200" },
  Tadreeb: { bg: "bg-sky-50", text: "text-sky-900", border: "border-sky-200" },
  Insha: { bg: "bg-violet-50", text: "text-violet-900", border: "border-violet-200" },
  "Lisan Arabi": { bg: "bg-teal-50", text: "text-teal-900", border: "border-teal-200" },
  "Risalah A": { bg: "bg-fuchsia-50", text: "text-fuchsia-900", border: "border-fuchsia-200" },
  "Risalah B": { bg: "bg-pink-50", text: "text-pink-900", border: "border-pink-200" },
  Science: { bg: "bg-lime-50", text: "text-lime-900", border: "border-lime-200" },
  Maths: { bg: "bg-yellow-50", text: "text-yellow-900", border: "border-yellow-200" },
  Physics: { bg: "bg-blue-50", text: "text-blue-900", border: "border-blue-200" },
  Chemistry: { bg: "bg-rose-50", text: "text-rose-900", border: "border-rose-200" },
  Biology: { bg: "bg-emerald-50", text: "text-emerald-900", border: "border-emerald-200" },
  English: { bg: "bg-slate-50", text: "text-slate-900", border: "border-slate-200" },
  Geography: { bg: "bg-amber-50", text: "text-amber-900", border: "border-amber-200" },
  "Hist/Civ": { bg: "bg-orange-50", text: "text-orange-900", border: "border-orange-200" },
};

function getSubjectBadge(sub: string) {
  return SUBJECT_COLORS[sub] || { bg: "bg-emerald-50/70", text: "text-emerald-900", border: "border-emerald-200" };
}

export default function TalabatTimetablePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | "all">("all");
  const [viewMode, setViewMode] = useState<"matrix" | "cards">("matrix");

  const fetchTimetable = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch("/api/talabat/timetable");
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        toast({
          variant: "destructive",
          title: "Notice",
          description: json.error || "Could not retrieve your class timetable.",
        });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Failed to connect to timetable service." });
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

  const todayDow = data?.todayDayOfWeek || 1;
  const isWeekend = data?.isWeekend;
  const masool = data?.masool;
  const currentClass = data?.class;
  const subjectTeachers = data?.subjectTeachers || [];
  const badals = data?.badals || [];
  const todaySlots = data?.todaySlots || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Header Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl"
        style={{ background: "linear-gradient(135deg, #06241a 0%, #0a3d2c 50%, #03180f 100%)" }}
      >
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0"
              style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}
            >
              <CalendarDays className="w-8 h-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-3 py-0.5 rounded-full shadow-xs">
                  {currentClass?.name ? `Class ${currentClass.name}` : "Darajah Timetable"}
                </span>
                <span className="text-xs text-emerald-200 font-mono">
                  {currentClass?.academicYear || "1448 H"} • 30 Sessions / Week
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white">
                Official Class Timetable
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5">
                Darajah Core Curriculum schedule with verified subject faculty and classroom locations.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-center">
            <div className="flex items-center bg-white/10 rounded-2xl p-1 border border-white/15">
              <button
                onClick={() => setViewMode("matrix")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "matrix" ? "bg-amber-400 text-slate-950 shadow-xs" : "text-emerald-100 hover:text-white"
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Matrix View</span>
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === "cards" ? "bg-amber-400 text-slate-950 shadow-xs" : "text-emerald-100 hover:text-white"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Day View</span>
              </button>
            </div>

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

        {/* Decorative background glow */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </motion.div>

      {/* ── Masool / Class Teacher Card & Today's Summary ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Class Teacher (Masool al-Fasl) */}
        <Card className="rounded-3xl border-slate-200/80 shadow-xs bg-white overflow-hidden lg:col-span-1">
          <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-emerald-950 via-[#0a3d2c] to-emerald-900 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-300" />
              <span className="text-xs font-black uppercase tracking-wider text-amber-300">
                Class Teacher (Masool al-Fasl)
              </span>
            </div>
            <Badge className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
              Class {currentClass?.name || ""}
            </Badge>
          </div>
          <CardContent className="p-6">
            {masool ? (
              <div className="flex items-center gap-4">
                <Avatar className="w-16 h-16 border-2 border-emerald-600/40 shadow-sm shrink-0">
                  <AvatarImage src={masool.avatarUrl || undefined} alt={masool.name} />
                  <AvatarFallback className="bg-emerald-900 text-amber-300 font-bold text-lg">
                    {getInitials(masool.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-slate-900 text-base leading-tight truncate">
                    {masool.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-500">
                    {masool.its && (
                      <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                        ITS: {masool.its}
                      </span>
                    )}
                    {masool.email && (
                      <span className="truncate text-slate-400 text-[11.5px]">{masool.email}</span>
                    )}
                  </div>
                  <div className="mt-2 text-[11px] text-emerald-800 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    Responsible for Class Supervision & Guidance
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-4 text-center text-slate-400 text-xs font-medium">
                Class teacher assigned by Attalimiyah.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Schedule Quick View */}
        <Card className="rounded-3xl border-slate-200/80 shadow-xs bg-white overflow-hidden lg:col-span-2">
          <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Today&apos;s Schedule (
                {DAYS.find((d) => d.day === todayDow)?.name || "Today"})
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {todaySlots.length} Sessions Scheduled
            </span>
          </div>
          <CardContent className="p-5">
            {isWeekend ? (
              <div className="py-8 text-center text-slate-500 text-xs">
                ✨ Weekend / No academic sessions scheduled today. Review upcoming lessons below!
              </div>
            ) : todaySlots.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                {todaySlots.map((s: any) => {
                  const style = getSubjectBadge(s.subject);
                  return (
                    <div
                      key={s.id}
                      className={`p-3 rounded-2xl border ${style.border} ${style.bg} transition-all hover:shadow-xs relative overflow-hidden`}
                    >
                      <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-500 mb-1">
                        <span className="font-bold text-slate-800">P{s.period}</span>
                        <span>{s.startTime}</span>
                      </div>
                      <div className={`text-xs font-extrabold ${style.text} leading-tight line-clamp-1`}>
                        {s.subject}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1 truncate font-medium">
                        {s.badal ? (
                          <span className="text-amber-800 font-bold flex items-center gap-1">
                            <ArrowRightLeft className="w-2.5 h-2.5 shrink-0" />
                            {s.badal.badalTeacherName}
                          </span>
                        ) : (
                          s.teacherName
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                No sessions registered for today.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Active Badal Substitutions Alert (if any today) ── */}
      {badals.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-3xl flex items-start gap-3 shadow-xs">
          <ArrowRightLeft className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
              Today&apos;s Teacher Substitutions ({badals.length})
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
              {badals.map((b: any, idx: number) => (
                <div key={idx} className="p-3 bg-white rounded-2xl border border-amber-200 text-xs flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">
                      Period {b.period} • {b.subject}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-0.5">
                      Covering Teacher: <span className="font-bold text-emerald-800">{b.badalTeacher}</span> (substituting for {b.originalTeacher})
                    </div>
                    {b.instructions && (
                      <div className="text-[10px] text-amber-800 italic mt-0.5">&ldquo;{b.instructions}&rdquo;</div>
                    )}
                  </div>
                  <Badge variant="outline" className="border-amber-400 text-amber-900 bg-amber-50 text-[10px]">
                    Substituted
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Day Filter Buttons for Cards View ── */}
      {viewMode === "cards" && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Button
            size="sm"
            onClick={() => setSelectedDay("all")}
            variant={selectedDay === "all" ? "default" : "outline"}
            className="rounded-xl text-xs font-bold shrink-0"
          >
            All Week
          </Button>
          {DAYS.map((d) => (
            <Button
              key={d.day}
              size="sm"
              onClick={() => setSelectedDay(d.day)}
              variant={selectedDay === d.day ? "default" : "outline"}
              className={`rounded-xl text-xs font-bold shrink-0 ${
                d.day === todayDow ? "border-amber-400" : ""
              }`}
            >
              {d.name} {d.day === todayDow && "• Today"}
            </Button>
          ))}
        </div>
      )}

      {/* ── Main Timetable View ── */}
      {viewMode === "matrix" ? (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
                Weekly Class Schedule Matrix
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Class {currentClass?.name || ""} • Monday through Saturday
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[920px]">
              <thead>
                <tr className="bg-[#06241a] text-white">
                  <th className="p-3 text-left text-xs font-black uppercase tracking-wider border-r border-emerald-900/60 w-28">
                    Day / Period
                  </th>
                  {PERIOD_DEFS.map((p) => (
                    <th
                      key={p.period}
                      className="p-2.5 text-center border-r border-emerald-900/60 last:border-r-0 min-w-[110px]"
                    >
                      <div className="text-xs font-black text-amber-300">{p.label}</div>
                      <div className="text-[10px] font-mono opacity-80 mt-0.5">{p.time}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map((d) => {
                  const isCurrentDay = d.day === todayDow;
                  return (
                    <tr
                      key={d.day}
                      className={`border-b border-slate-100 transition-colors ${
                        isCurrentDay ? "bg-amber-50/20" : "hover:bg-slate-50/60"
                      }`}
                    >
                      <td
                        className={`p-3 font-black text-xs border-r border-slate-200/80 ${
                          isCurrentDay
                            ? "bg-amber-100/60 text-amber-950 font-extrabold"
                            : "bg-slate-50/80 text-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{d.name}</span>
                          {isCurrentDay && (
                            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                          )}
                        </div>
                      </td>

                      {PERIOD_DEFS.map((p) => {
                        const slot = slotsMap.get(`${d.day}_${p.period}`);
                        const style = slot ? getSubjectBadge(slot.subject) : null;
                        const isBadal = slot?.badal;

                        return (
                          <td
                            key={p.period}
                            className="p-2 border-r border-slate-100 last:border-r-0 align-top"
                          >
                            {slot ? (
                              <div
                                className={`p-2.5 rounded-2xl border ${
                                  isBadal ? "border-amber-300 bg-amber-50/90" : `${style?.border} ${style?.bg}`
                                } shadow-2xs relative`}
                              >
                                <div className="text-xs font-extrabold text-slate-900 leading-tight">
                                  {slot.subject}
                                </div>

                                <div className="text-[11px] text-emerald-800 font-bold mt-1.5 flex items-center gap-1 truncate">
                                  <User className="w-3 h-3 shrink-0 text-emerald-700" />
                                  <span className="truncate">{slot.teacherName}</span>
                                </div>

                                {isBadal && (
                                  <div className="mt-1 text-[9.5px] bg-amber-400 text-slate-950 px-1.5 py-0.5 rounded font-black flex items-center gap-1">
                                    <ArrowRightLeft className="w-2.5 h-2.5" />
                                    <span>Sub: {isBadal.badalTeacherName}</span>
                                  </div>
                                )}

                                <div className="text-[9.5px] font-mono text-slate-400 mt-1 flex items-center gap-1">
                                  <MapPin className="w-2.5 h-2.5" />
                                  {slot.roomNumber}
                                </div>
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
      ) : (
        /* Cards Day-by-Day View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {DAYS.filter((d) => selectedDay === "all" || d.day === selectedDay).map((d) => {
            const daySlots = (data?.slots || [])
              .filter((s: any) => s.dayOfWeek === d.day)
              .sort((a: any, b: any) => a.period - b.period);

            const isCurrentDay = d.day === todayDow;

            return (
              <Card
                key={d.day}
                className={`rounded-3xl border shadow-xs overflow-hidden ${
                  isCurrentDay ? "border-amber-300 ring-2 ring-amber-300/40" : "border-slate-200/80"
                }`}
              >
                <div
                  className={`p-4 border-b flex items-center justify-between ${
                    isCurrentDay
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black"
                      : "bg-slate-50 text-slate-800 font-bold"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold">{d.name}</span>
                    {isCurrentDay && (
                      <Badge className="bg-slate-950 text-white text-[10px] font-black">Today</Badge>
                    )}
                  </div>
                  <span className="text-xs opacity-80">{daySlots.length} periods</span>
                </div>

                <CardContent className="p-4 space-y-2">
                  {daySlots.length > 0 ? (
                    daySlots.map((s: any) => {
                      const style = getSubjectBadge(s.subject);
                      return (
                        <div
                          key={s.id}
                          className={`p-3 rounded-2xl border ${style.border} ${style.bg} flex items-center justify-between`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex flex-col items-center justify-center shrink-0">
                              <span className="text-[10px] font-mono text-slate-400">P{s.period}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-black text-slate-900 truncate">{s.subject}</div>
                              <div className="text-[11px] text-slate-600 truncate mt-0.5">
                                {s.teacherName}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-[10px] font-mono font-semibold text-slate-500 block">
                              {s.startTime}
                            </span>
                            <span className="text-[9.5px] text-slate-400 block">{s.roomNumber}</span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-400">No periods scheduled.</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Subject Faculty Roster for This Class ── */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-800" />
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
              Class Faculty Directory ({subjectTeachers.length} Asatezah)
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Teaching Faculty for Class {currentClass?.name || ""}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {subjectTeachers.map((t: any, idx: number) => (
            <div
              key={idx}
              className="p-4 rounded-2xl border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all bg-slate-50/50 flex flex-col justify-between"
            >
              <div className="flex items-center gap-3">
                <Avatar className="w-11 h-11 border border-slate-200 shrink-0">
                  <AvatarImage src={t.avatarUrl || undefined} alt={t.name} />
                  <AvatarFallback className="bg-emerald-800 text-amber-200 font-bold text-xs">
                    {getInitials(t.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-xs text-slate-900 leading-tight truncate">
                    {t.name}
                  </h4>
                  {t.its && (
                    <span className="text-[10px] font-mono text-slate-500">ITS: {t.its}</span>
                  )}
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200/60">
                <div className="text-[10.5px] font-semibold text-slate-500 mb-1">Subjects:</div>
                <div className="flex flex-wrap gap-1">
                  {t.subjects.map((sub: string, sIdx: number) => (
                    <span
                      key={sIdx}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white border border-slate-200 text-slate-800"
                    >
                      {sub}
                    </span>
                  ))}
                </div>
                <div className="mt-2 text-[10.5px] font-mono text-emerald-800 font-semibold">
                  {t.periodsCount} periods / week
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
