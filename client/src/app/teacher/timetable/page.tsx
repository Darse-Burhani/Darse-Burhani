"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  BookOpen,
  ArrowRightLeft,
  RefreshCw,
  Loader2,
  Printer,
  Sparkles,
  Users,
  Search,
  X,
  ShieldCheck,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Zap,
  Mail,
  AlertTriangle,
  Bell,
  Fingerprint,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  Calendar,
  Camera,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  ModalClose,
} from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";
import { getSubjectTheme } from "@/lib/timetable-theme";

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
  const [viewTab, setViewTab] = useState<"my-schedule" | "masool-class" | "classes">("my-schedule");

  // Masool Class Selection
  const [selectedMasoolIndex, setSelectedMasoolIndex] = useState(0);
  const [masoolClassData, setMasoolClassData] = useState<any>(null);
  const [loadingMasoolClass, setLoadingMasoolClass] = useState(false);

  // Masool Desk Sub-View: "timetable" | "scans"
  const [masoolView, setMasoolView] = useState<"timetable" | "scans">("timetable");
  const [masoolScanDate, setMasoolScanDate] = useState<string>(() =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
  );
  const [masoolScansData, setMasoolScansData] = useState<any>(null);
  const [loadingMasoolScans, setLoadingMasoolScans] = useState(false);
  const [masoolScanSearch, setMasoolScanSearch] = useState("");
  const [masoolScanFilter, setMasoolScanFilter] = useState<"ALL" | "BIOMETRIC" | "MANUAL" | "PRESENT" | "LATE" | "ABSENT" | "NOT_MARKED">("ALL");
  const [masoolAutoRefresh, setMasoolAutoRefresh] = useState(false);

  // TableMaster Spotlight & Talabat State
  const [spotlightSubject, setSpotlightSubject] = useState<string | null>(null);
  const [talabatModalOpen, setTalabatModalOpen] = useState(false);
  const [talabatSearch, setTalabatSearch] = useState("");
  const [activeRosterClass, setActiveRosterClass] = useState<any>(null);

  // Darajah Class Explorer State
  const [selectedClassName, setSelectedClassName] = useState<string>("1 A");
  const [classData, setClassData] = useState<any>(null);
  const [loadingClass, setLoadingClass] = useState(false);

  const masoolClasses = data?.masoolClasses || [];
  const isClassMasool = Boolean(data?.isClassMasool || masoolClasses.length > 0);
  const currentMasoolClass = masoolClasses[selectedMasoolIndex] || masoolClasses[0] || null;

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

  const fetchClassTimetable = async (className: string, silent = false) => {
    if (!silent) setLoadingClass(true);
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
      if (!silent) setLoadingClass(false);
    }
  };

  const fetchMasoolClassTimetable = async (className: string, silent = false) => {
    if (!silent) setLoadingMasoolClass(true);
    try {
      const res = await fetch(`/api/teacher/timetable/class/${encodeURIComponent(className)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setMasoolClassData(json.data);
      } else {
        setMasoolClassData(null);
      }
    } catch {
      setMasoolClassData(null);
    } finally {
      if (!silent) setLoadingMasoolClass(false);
    }
  };

  const fetchMasoolScans = async (classId: string, dateStr: string, silent = false) => {
    if (!classId) return;
    if (!silent) setLoadingMasoolScans(true);
    try {
      const res = await fetch(`/api/teacher/timetable/masool-class/${classId}/scans?date=${encodeURIComponent(dateStr)}`);
      const json = await res.json();
      if (json.success && json.data) {
        setMasoolScansData(json.data);
      } else {
        setMasoolScansData(null);
      }
    } catch {
      setMasoolScansData(null);
    } finally {
      if (!silent) setLoadingMasoolScans(false);
    }
  };

  useEffect(() => {
    if (viewTab === "masool-class" && currentMasoolClass?.id) {
      fetchMasoolScans(currentMasoolClass.id, masoolScanDate);
    }
  }, [viewTab, currentMasoolClass?.id, masoolScanDate]);

  useEffect(() => {
    if (!masoolAutoRefresh || viewTab !== "masool-class" || masoolView !== "scans" || !currentMasoolClass?.id) return;
    const interval = setInterval(() => {
      fetchMasoolScans(currentMasoolClass.id, masoolScanDate, true);
    }, 15000);
    return () => clearInterval(interval);
  }, [masoolAutoRefresh, viewTab, masoolView, currentMasoolClass?.id, masoolScanDate]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      const viewParam = params.get("view");
      if (tabParam === "masool-class" || tabParam === "masool") {
        setViewTab("masool-class");
      }
      if (viewParam === "scans" || viewParam === "biometric" || viewParam === "hikvision") {
        setMasoolView("scans");
      }
    }
  }, []);

  const handlePrevDay = () => {
    const [y, m, d] = masoolScanDate.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    dateObj.setUTCDate(dateObj.getUTCDate() - 1);
    setMasoolScanDate(dateObj.toISOString().split("T")[0]);
  };

  const handleNextDay = () => {
    const [y, m, d] = masoolScanDate.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));
    dateObj.setUTCDate(dateObj.getUTCDate() + 1);
    setMasoolScanDate(dateObj.toISOString().split("T")[0]);
  };

  const handleToday = () => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    setMasoolScanDate(today);
  };

  const filteredMasoolScans = useMemo(() => {
    const list: any[] = masoolScansData?.talabat || [];
    let result = list;
    if (masoolScanFilter === "BIOMETRIC") {
      result = result.filter((s: any) => s.source === "BIOMETRIC" || Boolean(s.biometricMethod));
    } else if (masoolScanFilter === "MANUAL") {
      result = result.filter((s: any) => s.source === "MANUAL");
    } else if (masoolScanFilter !== "ALL") {
      result = result.filter((s: any) => s.status === masoolScanFilter);
    }

    if (masoolScanSearch.trim()) {
      const q = masoolScanSearch.toLowerCase().trim();
      result = result.filter(
        (s: any) =>
          s.name?.toLowerCase().includes(q) ||
          s.its?.toLowerCase().includes(q) ||
          s.studentNumber?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [masoolScansData, masoolScanFilter, masoolScanSearch]);

  useEffect(() => {
    fetchTimetable();
    const interval = setInterval(() => {
      fetchTimetable(false);
      if (viewTab === "classes" && selectedClassName) {
        fetchClassTimetable(selectedClassName, true);
      }
      if (viewTab === "masool-class" && currentMasoolClass?.name) {
        fetchMasoolClassTimetable(currentMasoolClass.name, true);
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [viewTab, selectedClassName, currentMasoolClass?.name]);

  useEffect(() => {
    if (viewTab === "classes") {
      fetchClassTimetable(selectedClassName);
    }
  }, [viewTab, selectedClassName]);

  useEffect(() => {
    if (viewTab === "masool-class" && currentMasoolClass?.name) {
      fetchMasoolClassTimetable(currentMasoolClass.name);
    }
  }, [viewTab, currentMasoolClass?.name]);

  // My Personal Slots Map
  const slotsMap = useMemo(() => {
    const map = new Map<string, any>();
    if (data?.slots) {
      data.slots.forEach((s: any) => {
        map.set(`${s.dayOfWeek}_${s.period}`, s);
      });
    }
    return map;
  }, [data]);

  // Class Explorer Slots Map
  const classSlotsMap = useMemo(() => {
    const map = new Map<string, any>();
    if (classData?.slots) {
      classData.slots.forEach((s: any) => {
        map.set(`${s.dayOfWeek}_${s.period}`, s);
      });
    }
    return map;
  }, [classData]);

  // Masool Class Slots Map
  const masoolSlotsMap = useMemo(() => {
    const map = new Map<string, any>();
    if (masoolClassData?.slots) {
      masoolClassData.slots.forEach((s: any) => {
        map.set(`${s.dayOfWeek}_${s.period}`, s);
      });
    }
    return map;
  }, [masoolClassData]);

  // Subject Stats for Explorer Class
  const classSubjectStats = useMemo(() => {
    const classSlots = (Array.isArray(classData?.slots) ? classData.slots : []).filter(
      (s: any) => s && !s.isBreak && s.subject
    );
    const countMap: Record<string, number> = {};
    classSlots.forEach((s: any) => {
      const sub = s.subject.trim();
      countMap[sub] = (countMap[sub] || 0) + 1;
    });

    const total = classSlots.length || 1;
    return Object.entries(countMap)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
        theme: getSubjectTheme(name),
      }))
      .sort((a, b) => b.count - a.count);
  }, [classData]);

  // Subject Stats for Masool Class
  const masoolSubjectStats = useMemo(() => {
    const mSlots = (Array.isArray(masoolClassData?.slots) ? masoolClassData.slots : []).filter(
      (s: any) => s && !s.isBreak && s.subject
    );
    const countMap: Record<string, number> = {};
    mSlots.forEach((s: any) => {
      const sub = s.subject.trim();
      countMap[sub] = (countMap[sub] || 0) + 1;
    });

    const total = mSlots.length || 1;
    return Object.entries(countMap)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / total) * 100),
        theme: getSubjectTheme(name),
      }))
      .sort((a, b) => b.count - a.count);
  }, [masoolClassData]);

  const toggleSpotlight = (subjectName: string) => {
    setSpotlightSubject((prev) => (prev?.toLowerCase() === subjectName.toLowerCase() ? null : subjectName));
  };

  // Filtered Talabat for Active Roster Modal
  const filteredTalabat = useMemo(() => {
    const list: any[] = activeRosterClass?.talabat || [];
    const q = talabatSearch.toLowerCase().trim();
    if (!q) return list;
    return list.filter((s: any) =>
      s.name?.toLowerCase().includes(q) ||
      s.its?.toLowerCase().includes(q) ||
      (s.rollNumber && String(s.rollNumber).toLowerCase().includes(q))
    );
  }, [activeRosterClass, talabatSearch]);

  const openRosterModal = (classObj: any) => {
    setActiveRosterClass(classObj);
    setTalabatSearch("");
    setTalabatModalOpen(true);
  };

  const badalDuties = data?.badalDuties || [];
  const badalsForMe = data?.badalsForMe || [];

  // Unique classes taught by this teacher with their Class Masool
  const classesTaughtWithMasool = useMemo(() => {
    const map = new Map<string, { className: string; masool: string | null; masoolIts: string | null }>();
    (data?.slots || []).forEach((s: any) => {
      if (s.className && !map.has(s.className)) {
        map.set(s.className, {
          className: s.className,
          masool: s.classMasool || null,
          masoolIts: s.classMasoolIts || null,
        });
      }
    });
    return Array.from(map.values());
  }, [data?.slots]);

  const now = new Date();
  const istDayStr = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(now);
  const dowMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const todayDow = dowMap[istDayStr] || 1;
  const todayIso = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);

  const todayDutiesMap = new Map<number, any>();
  const badalDutiesByDayPeriod = new Map<string, any>();
  badalDuties.forEach((b: any) => {
    if (b.date === todayIso) {
      todayDutiesMap.set(b.period, b);
    }
    if (b.date) {
      const parts = b.date.split("-").map(Number);
      if (parts.length === 3) {
        const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
        const bDow = dObj.getDay() === 0 ? 7 : dObj.getDay();
        badalDutiesByDayPeriod.set(`${bDow}_${b.period}`, b);
      }
    }
  });

  const todayCoveredMap = new Map<number, any>();
  const badalsForMeByDayPeriod = new Map<string, any>();
  badalsForMe.forEach((b: any) => {
    if (b.date === todayIso) {
      todayCoveredMap.set(b.period, b);
    }
    if (b.date) {
      const parts = b.date.split("-").map(Number);
      if (parts.length === 3) {
        const dObj = new Date(parts[0], parts[1] - 1, parts[2]);
        const bDow = dObj.getDay() === 0 ? 7 : dObj.getDay();
        badalsForMeByDayPeriod.set(`${bDow}_${b.period}`, b);
      }
    }
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Header Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl"
        style={{ background: "linear-gradient(135deg, #1c1c1c 0%, #1c1c1c 50%, #0d0d0d 100%)" }}
      >
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border border-amber-400/40"
              style={{ background: "linear-gradient(135deg, #d4af37, #b8860b)" }}
            >
              <CalendarDays className="w-7 h-7 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-xs">
                  Academic Timetable Hub
                </span>
                {isClassMasool && (
                  <span className="text-[11px] font-black uppercase tracking-wider bg-emerald-500/30 text-amber-300 border border-amber-400/50 px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                    <ShieldCheck className="w-3 h-3 text-amber-300" /> Class Masool
                  </span>
                )}
                <span className="text-xs text-emerald-200 font-mono">Term I • 1448 H</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white">
                Faculty &amp; Class Timetable Matrix
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 mt-0.5">
                {data?.teacher?.name ? `${data.teacher.name} • ${data?.slots?.length || 0} Teaching Sessions / Week` : "Weekly Academic Timetable"}
                {isClassMasool && currentMasoolClass ? ` • Masool of Class ${currentMasoolClass.name}` : ""}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-emerald-400/30 text-[11px] font-black text-amber-300 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Dynamic Sync</span>
            </div>
            <Button
              onClick={() => window.print()}
              variant="outline"
              size="sm"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold gap-1.5 rounded-xl"
            >
              <Printer className="w-3.5 h-3.5 text-amber-300" /> Print
            </Button>
            <Button
              onClick={() => fetchTimetable(true)}
              disabled={loading || refreshing}
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs font-bold gap-2 rounded-xl"
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
                ? "bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300/40"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>1. My Teaching Schedule ({data?.slots?.length || 0} Periods)</span>
          </button>

          {/* Dedicated Tab for Class Masool */}
          {isClassMasool && (
            <button
              onClick={() => setViewTab("masool-class")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                viewTab === "masool-class"
                  ? "bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300/40"
                  : "bg-emerald-900/60 text-amber-300 hover:bg-emerald-800/80 border border-amber-400/30"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>
                2. 👑 My Masool Class Timetable ({currentMasoolClass ? `Class ${currentMasoolClass.name}` : "Assigned Class"})
              </span>
            </button>
          )}

          <button
            onClick={() => setViewTab("classes")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
              viewTab === "classes"
                ? "bg-amber-400 text-slate-950 shadow-md ring-2 ring-amber-300/40"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>{isClassMasool ? "3. All Darajah Classes (1A–4B)" : "2. All Darajah Classes (1A–4B)"}</span>
          </button>
        </div>
      </motion.div>

      {/* ── Official Timetable Changes Alert Banner ── */}
      {data?.recentChanges && data.recentChanges.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 sm:p-5 rounded-3xl bg-amber-50/95 border border-amber-300 shadow-sm flex items-start gap-3.5"
        >
          <div className="w-10 h-10 rounded-2xl bg-amber-400/30 border border-amber-400/60 flex items-center justify-center shrink-0 text-amber-950 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">
                Official Timetable Update Notice ({data.recentChanges.length} Recent Changes)
              </h4>
              <Badge className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                Highlighted With Glow Below
              </Badge>
            </div>
            <p className="text-xs text-amber-900/90 mt-1">
              The Administration or assigned academic coordinators updated timetable periods. Changed slots are highlighted with an amber glow and badge across your views:
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {data.recentChanges.map((change: any) => (
                <div
                  key={change.id}
                  className="text-xs text-slate-800 font-semibold p-2.5 rounded-xl bg-white/90 border border-amber-200/90 shadow-2xs flex flex-col justify-between gap-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      Class {change.className} • {change.dayName} P{change.period}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(change.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-700 truncate" title={change.changeDescription}>
                    {change.changeDescription}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 1: MY PERSONAL SCHEDULE (TEACHER'S SUBJECTS)
         ───────────────────────────────────────────────────────────── */}
      {viewTab === "my-schedule" && (
        <div className="space-y-6">
          {/* Badal Duties Alert Notice if assigned */}
          {badalDuties.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative overflow-hidden rounded-3xl border-2 border-amber-400 bg-gradient-to-r from-amber-500/15 via-yellow-400/10 to-amber-500/20 p-5 sm:p-6 shadow-xl shadow-amber-500/10 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md ring-4 ring-amber-300/60 animate-pulse">
                    <Zap className="w-6 h-6 fill-current" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-red-600 text-white px-2.5 py-0.5 rounded-full shadow-xs animate-bounce">
                        🚨 URGENT NOTICE
                      </span>
                      <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                        Assigned Badal (Substitute) Duties ({badalDuties.length})
                      </span>
                    </div>
                    <p className="text-xs text-amber-900/90 mt-1 max-w-2xl font-medium">
                      You have been assigned substitute teaching duty (Badal). An urgent email notification and portal alert have been dispatched to you. Please review your class and period assignments below.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 shadow-xs">
                    <Mail className="w-3.5 h-3.5" /> Email Dispatched
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                {badalDuties.map((b: any) => {
                  const bTheme = getSubjectTheme(b.subject);
                  const isTodayDuty = b.date === todayIso;
                  return (
                    <div
                      key={b.id}
                      className={`p-4 rounded-2xl bg-white border-2 transition-all flex flex-col justify-between space-y-3 ${
                        isTodayDuty
                          ? "border-amber-500 ring-4 ring-amber-400/40 shadow-lg shadow-amber-500/15"
                          : "border-amber-200 hover:border-amber-300 shadow-sm"
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black ${bTheme.badge}`}>
                            {b.subject}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              isTodayDuty
                                ? "bg-amber-500 text-slate-950 ring-2 ring-amber-300 animate-pulse"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {isTodayDuty ? "⚡ Today's Duty" : b.date}
                          </span>
                        </div>

                        <div>
                          <div className="text-base font-black text-slate-950 flex items-center gap-2">
                            <span>Class {b.className}</span>
                            <span className="text-xs text-slate-400 font-normal">•</span>
                            <span className="text-xs text-amber-950 font-bold">
                              Period {b.period}
                            </span>
                          </div>
                          <div className="text-xs font-mono text-slate-600 mt-0.5">
                            ⏱️ {b.startTime} – {b.endTime}
                          </div>
                        </div>

                        <div className="text-xs text-slate-700 bg-amber-50/80 rounded-xl p-2.5 border border-amber-200/80 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-950 text-[11px]">
                            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span>Covering for: {b.originalTeacher}</span>
                          </div>
                          {b.reason && (
                            <div className="text-[10.5px] text-slate-600">
                              <span className="font-semibold text-slate-800">Reason:</span> {b.reason}
                            </div>
                          )}
                          {b.instructions && (
                            <div className="text-[10.5px] text-amber-900 font-medium italic">
                              &ldquo;{b.instructions}&rdquo;
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Attendance synced
                        </span>
                        <Badge
                          variant={b.isFulfilled ? "default" : "secondary"}
                          className={
                            b.isFulfilled
                              ? "bg-emerald-600 text-white"
                              : "bg-amber-100 text-amber-950 border border-amber-300 font-bold"
                          }
                        >
                          {b.isFulfilled ? "✓ Fulfilled" : "⚡ Action Required"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Assigned Classes & Class Masools Banner */}
          {classesTaughtWithMasool.length > 0 && (
            <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs flex items-center gap-3 flex-wrap">
              <span className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5 shrink-0">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                Assigned Classes &amp; Class Masool:
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {classesTaughtWithMasool.map((cls) => (
                  <div
                    key={cls.className}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-xs shadow-2xs"
                  >
                    <span className="font-extrabold text-slate-900">Class {cls.className}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-amber-900 font-bold flex items-center gap-1">
                      👑 Masool: {cls.masool || "Assigned by Admin"}
                    </span>
                    {cls.masoolIts && (
                      <span className="text-[10px] font-mono text-slate-500">({cls.masoolIts})</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Timetable Matrix */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Weekly Teaching Matrix
                </span>
                <span className="text-xs text-slate-500">
                  • {data?.slots?.length || 0} active periods across Monday to Saturday
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                <div className="flex items-center gap-1.5 font-bold text-amber-950 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-amber-300 animate-pulse" />
                  <span>⚡ Urgent Badal Duty</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-amber-300" />
                  <span>Recently Updated Slot</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>Regular Session</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-[#1c1c1c] text-white">
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
                          const badalDutySlot = badalDutyToday || badalDutiesByDayPeriod.get(`${d.day}_${p.period}`);
                          const coveredToday = isToday ? todayCoveredMap.get(p.period) : null;
                          const coveredSlot = coveredToday || badalsForMeByDayPeriod.get(`${d.day}_${p.period}`);
                          const theme = slot ? getSubjectTheme(slot.subject) : null;
                          const isChanged = Boolean(slot?.isRecentlyChanged);
                          const isUrgentToday = Boolean(badalDutyToday || (badalDutySlot && (badalDutySlot.date === todayIso || isToday)));

                          return (
                            <td key={p.period} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                              {badalDutySlot ? (
                                <div
                                  className={`p-2.5 rounded-2xl border-2 transition-all relative overflow-hidden ${
                                    isUrgentToday
                                      ? "bg-gradient-to-br from-amber-400/30 via-yellow-300/20 to-amber-500/25 border-amber-500 ring-2 ring-amber-400/80 shadow-[0_0_18px_rgba(245,158,11,0.4)] animate-[pulse_3s_ease-in-out_infinite]"
                                      : "bg-amber-50/95 border-amber-400/90 shadow-2xs"
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-amber-500 text-slate-950 flex items-center gap-1 shadow-2xs">
                                      <Zap className="w-2.5 h-2.5 fill-current" />
                                      {isUrgentToday ? "URGENT BADAL" : "BADAL DUTY"}
                                    </span>
                                    {isUrgentToday ? (
                                      <span className="text-[8px] font-black uppercase text-amber-950 bg-amber-200/90 px-1 py-0.2 rounded border border-amber-300">
                                        TODAY
                                      </span>
                                    ) : (
                                      <span className="text-[8px] font-mono text-slate-500">
                                        {badalDutySlot.date}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs font-black text-slate-900 leading-tight">
                                    {badalDutySlot.subject}
                                  </div>
                                  <div className="text-[11px] text-amber-950 font-bold mt-1 flex items-center justify-between">
                                    <span>Class {badalDutySlot.className}</span>
                                    <span className="text-[9px] font-mono text-slate-500">{badalDutySlot.startTime || p.time}</span>
                                  </div>
                                  <div className="text-[9.5px] font-semibold text-amber-900 mt-1 flex items-center gap-1 bg-amber-100/70 px-1.5 py-0.5 rounded">
                                    <ArrowRightLeft className="w-2.5 h-2.5 shrink-0 text-amber-700" />
                                    <span className="truncate">For: {badalDutySlot.originalTeacher}</span>
                                  </div>
                                  {badalDutySlot.instructions && (
                                    <div className="text-[9px] text-amber-800 italic mt-1 line-clamp-2" title={badalDutySlot.instructions}>
                                      &ldquo;{badalDutySlot.instructions}&rdquo;
                                    </div>
                                  )}
                                </div>
                              ) : slot && theme ? (
                                <div
                                  style={{ borderLeftColor: isChanged ? "#f59e0b" : theme.accent, borderLeftWidth: isChanged ? "4px" : "3px" }}
                                  className={`p-2.5 rounded-xl border shadow-2xs transition-all ${
                                    isChanged
                                      ? "bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/80 shadow-md"
                                      : coveredSlot
                                      ? "bg-slate-50 border-slate-300 opacity-75"
                                      : `${theme.bgLight} ${theme.border}`
                                  }`}
                                >
                                  {isChanged && (
                                    <div className="mb-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-2xs">
                                      <Sparkles className="w-2 h-2 text-slate-950" /> Updated
                                    </div>
                                  )}
                                  <div className={`text-xs font-black leading-tight ${theme.text}`}>
                                    {slot.subject}
                                  </div>
                                  <div className="text-[11px] font-bold mt-1 text-slate-800">
                                    Class {slot.className}
                                  </div>
                                  {slot.classMasool && (
                                    <div
                                      className="text-[9px] font-bold text-amber-900 bg-amber-100/70 px-1.5 py-0.5 rounded mt-1 flex items-center gap-1"
                                      title={`Class Masool: ${slot.classMasool}${slot.classMasoolIts ? ` (ITS: ${slot.classMasoolIts})` : ""}`}
                                    >
                                      <ShieldCheck className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                      <span className="truncate">Masool: {slot.classMasool}</span>
                                    </div>
                                  )}
                                  {isChanged && slot.changeDescription && (
                                    <div className="text-[9px] font-bold text-amber-900 bg-amber-100/80 px-1.5 py-0.5 rounded mt-1 leading-tight">
                                      {slot.changeDescription}
                                    </div>
                                  )}
                                  {coveredSlot ? (
                                    <div className="text-[9.5px] font-bold text-amber-800 mt-1 flex items-center gap-1 bg-amber-100/60 px-1.5 py-0.5 rounded">
                                      <ArrowRightLeft className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                      <span className="truncate">Covered by {coveredSlot.substituteTeacher || coveredSlot.badalTeacher}</span>
                                    </div>
                                  ) : (
                                    <div className="text-[9.5px] font-mono text-slate-500 mt-1">
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
          TAB 2: CLASS MASOOL DEDICATED TIMETABLE & DESK
         ───────────────────────────────────────────────────────────── */}
      {viewTab === "masool-class" && isClassMasool && (
        <div className="space-y-6">
          {/* Masool Header & Controls */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-md shrink-0 border border-amber-400/50"
                  style={{ background: "linear-gradient(135deg, #1c1c1c 0%, #1c1c1c 100%)" }}
                >
                  <ShieldCheck className="w-8 h-8 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full shadow-2xs">
                      Masool al-Fasl Desk
                    </span>
                    <span className="text-xs font-mono text-emerald-800 font-bold">
                      {currentMasoolClass ? `Darajah ${currentMasoolClass.darajah} • Section ${currentMasoolClass.section}` : ""}
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                    Class {currentMasoolClass?.name || ""} Master Timetable
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    As Class Masool, monitor all weekly periods, subject teachers, and student rosters for your assigned class.
                  </p>
                </div>
              </div>

              {/* Quick Actions for Masool */}
              <div className="flex items-center gap-2.5 flex-wrap">
                {masoolClassData?.class && (
                  <Button
                    onClick={() => openRosterModal(masoolClassData.class)}
                    variant="outline"
                    size="sm"
                    className="bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-300 font-bold text-xs gap-1.5 rounded-xl shadow-2xs"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-700" />
                    Talabat Directory ({(masoolClassData.class.talabat?.length || masoolClassData.class.studentCount || 0)})
                  </Button>
                )}

                <Link href="/teacher/attendance">
                  <Button
                    size="sm"
                    className="bg-[#1c1c1c] hover:bg-[#1c1c1c] text-amber-300 font-bold text-xs gap-1.5 rounded-xl shadow-xs"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5 text-amber-300" />
                    Take Class Attendance
                  </Button>
                </Link>

                <Button
                  onClick={() => setMasoolView(masoolView === "scans" ? "timetable" : "scans")}
                  size="sm"
                  className={`${
                    masoolView === "scans"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300"
                  } font-bold text-xs gap-1.5 rounded-xl shadow-xs transition-all`}
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  {masoolView === "scans" ? "Master Timetable" : "📡 Talabat Scan Records"}
                </Button>

                {masoolClasses.length > 1 && (
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    {masoolClasses.map((cls: any, idx: number) => (
                      <button
                        key={cls.id || idx}
                        onClick={() => setSelectedMasoolIndex(idx)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          selectedMasoolIndex === idx
                            ? "bg-[#1c1c1c] text-amber-300 shadow-2xs"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {cls.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Masool Class Information Bar */}
            {masoolClassData?.class && (
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="font-bold text-slate-500 uppercase text-[10px]">Room:</span>
                    <span className="font-extrabold text-slate-900 px-2 py-0.5 rounded-md bg-slate-100">
                      {masoolClassData.class.roomNumber || `Room ${masoolClassData.class.name}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <span className="font-bold text-slate-500 uppercase text-[10px]">Total Talabat:</span>
                    <span className="font-extrabold text-emerald-800">
                      {(masoolClassData.class.talabat?.length || masoolClassData.class.studentCount || 0)} Students
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  ⚡ All schedule changes made in Admin or Assign Portal are live and instantly updated here.
                </div>
              </div>
            )}
          </div>

          {/* Masool Sub-Navigation Switcher */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setMasoolView("timetable")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  masoolView === "timetable"
                    ? "bg-[#1c1c1c] text-amber-300 shadow-2xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                Master Timetable
              </button>
              <button
                onClick={() => setMasoolView("scans")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  masoolView === "scans"
                    ? "bg-emerald-600 text-white shadow-2xs"
                    : "text-emerald-800 hover:text-emerald-950 hover:bg-emerald-50/50"
                }`}
              >
                <Fingerprint className="w-3.5 h-3.5" />
                Talabat Individual Scan Records
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold text-slate-700">Class Masool Only</span>
              <span className="text-[10px] text-slate-400">| Live Biometric Logs</span>
            </div>
          </div>

          {masoolView === "timetable" && (
            <>
          {/* TableMaster Subject Load for Masool Class */}
          {masoolSubjectStats.length > 0 && (
            <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Curriculum Load ({masoolSubjectStats.length} Subjects):
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Click any subject to spotlight across your class schedule
                  </span>
                </div>
                {spotlightSubject && (
                  <button
                    onClick={() => setSpotlightSubject(null)}
                    className="text-[10.5px] font-black text-amber-900 hover:text-amber-950 bg-amber-100 px-2.5 py-0.5 rounded-lg flex items-center gap-1 border border-amber-300 transition-colors"
                  >
                    <X className="w-3 h-3" /> Clear Spotlight: {spotlightSubject}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {masoolSubjectStats.map((item) => {
                  const isSpotlighted = spotlightSubject?.toLowerCase() === item.name.toLowerCase();
                  return (
                    <button
                      key={item.name}
                      onClick={() => toggleSpotlight(item.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                        isSpotlighted
                          ? "ring-2 ring-amber-400 shadow-md scale-105 font-black " + item.theme.badge
                          : "hover:scale-[1.02] " + item.theme.bgLight + " " + item.theme.text + " " + item.theme.border
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${item.theme.dot}`} />
                      <span>{item.name}</span>
                      <span className="text-[10px] opacity-80 font-mono font-bold">
                        {item.count}p ({item.percentage}%)
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Masool Class Timetable Matrix */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
            {loadingMasoolClass ? (
              <div className="p-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto" />
                <p className="text-xs text-slate-500 mt-2">Loading Class {currentMasoolClass?.name} Timetable...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-[#1c1c1c] text-white">
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
                          const slot = masoolSlotsMap.get(`${d.day}_${p.period}`);
                          const isTaughtByMe = slot && data?.teacher && slot.teacherId === data.teacher.id;
                          const theme = slot ? getSubjectTheme(slot.subject) : null;
                          const isMatch = !spotlightSubject || (slot && slot.subject && slot.subject.toLowerCase() === spotlightSubject.toLowerCase());
                          const isChanged = Boolean(slot?.isRecentlyChanged);

                          return (
                            <td key={p.period} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                              {slot && theme ? (
                                <div
                                  style={{
                                    borderLeftColor: isChanged ? "#f59e0b" : theme.accent,
                                    borderLeftWidth: isChanged ? "4px" : "3px",
                                  }}
                                  className={`p-2.5 rounded-2xl border shadow-2xs transition-all ${
                                    isChanged
                                      ? "bg-amber-50/95 border-amber-400 ring-2 ring-amber-400/80 shadow-md"
                                      : isTaughtByMe
                                      ? "ring-2 ring-emerald-500/40 shadow-sm " + theme.bgLight + " " + theme.border
                                      : `${theme.bgLight} ${theme.border}`
                                  } ${
                                    !isMatch ? "opacity-30 grayscale-[40%] scale-98" : spotlightSubject ? "ring-2 ring-amber-400 shadow-md scale-[1.02]" : ""
                                  }`}
                                >
                                  {isChanged && (
                                    <div className="mb-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-2xs">
                                      <Sparkles className="w-2 h-2 text-slate-950" /> Updated
                                    </div>
                                  )}

                                  <div className="flex items-start justify-between gap-1">
                                    <button
                                      onClick={() => toggleSpotlight(slot.subject)}
                                      className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-md leading-tight text-left cursor-pointer transition-transform hover:scale-105 ${theme.badge}`}
                                      title="Click to spotlight this subject"
                                    >
                                      {slot.subject}
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1.5 mt-2">
                                    {slot.teacherAvatar ? (
                                      <Avatar className="w-5 h-5 ring-1 ring-emerald-600/30 shrink-0">
                                        <AvatarImage src={slot.teacherAvatar} alt={slot.teacherName} />
                                        <AvatarFallback className="text-[8px] bg-slate-900 text-amber-200">
                                          {getInitials(slot.teacherName)}
                                        </AvatarFallback>
                                      </Avatar>
                                    ) : null}
                                    <div className="text-[11px] text-slate-700 font-semibold truncate" title={slot.teacherName}>
                                      {slot.teacherName}
                                    </div>
                                  </div>

                                  {isChanged && slot.changeDescription && (
                                    <div className="text-[9px] font-bold text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded mt-1.5 leading-tight">
                                      {slot.changeDescription}
                                    </div>
                                  )}

                                  {isTaughtByMe && (
                                    <div className="mt-1.5 pt-1 border-t border-emerald-200/60 flex items-center gap-1 text-[9px] font-black text-emerald-800">
                                      <Sparkles className="w-2.5 h-2.5 text-amber-600" /> Taught by You
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
            </>
          )}

          {masoolView === "scans" && (
            <div className="space-y-6">
              {/* Scans Control & Date Bar */}
              <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Date Selector */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <Button
                        onClick={handlePrevDay}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg text-slate-700 hover:bg-white hover:text-slate-900"
                        title="Previous Day"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <input
                        type="date"
                        value={masoolScanDate}
                        onChange={(e) => setMasoolScanDate(e.target.value)}
                        className="bg-white px-3 py-1 text-xs font-bold text-slate-900 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <Button
                        onClick={handleNextDay}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg text-slate-700 hover:bg-white hover:text-slate-900"
                        title="Next Day"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>

                    <Button
                      onClick={handleToday}
                      variant="outline"
                      size="sm"
                      className="text-xs font-bold rounded-xl h-9 border-slate-200 hover:bg-slate-50 text-slate-700"
                    >
                      Today
                    </Button>

                    <span className="text-xs font-mono font-bold text-slate-500 ml-1">
                      {new Date(masoolScanDate + "T00:00:00").toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  {/* Live sync & actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setMasoolAutoRefresh(!masoolAutoRefresh)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all border ${
                        masoolAutoRefresh
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300 shadow-2xs"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          masoolAutoRefresh ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                        }`}
                      />
                      Live Auto-Sync (15s)
                    </button>

                    <Button
                      onClick={() => currentMasoolClass?.id && fetchMasoolScans(currentMasoolClass.id, masoolScanDate)}
                      variant="outline"
                      size="sm"
                      disabled={loadingMasoolScans}
                      className="text-xs font-bold rounded-xl h-9 gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingMasoolScans ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>

                    <Button
                      onClick={() => window.print()}
                      variant="outline"
                      size="sm"
                      className="text-xs font-bold rounded-xl h-9 gap-1.5 border-slate-200 text-slate-700 hover:bg-slate-50"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print Roster
                    </Button>
                  </div>
                </div>

                {/* Confidentiality Notice */}
                <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 flex items-start sm:items-center gap-2.5 text-xs text-amber-900">
                  <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 sm:mt-0" />
                  <div>
                    <span className="font-black">Restricted Class Masool Access: </span>
                    You are viewing individual talabat biometric scan records and check-in times for Class{" "}
                    <span className="font-black underline">{currentMasoolClass?.name}</span>. These logs are strictly confidential to the Class Masool and Institute Admin.
                  </div>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider">Enrolled</span>
                    <Users className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-2xl font-black text-slate-900">
                    {masoolScansData?.summary?.totalEnrolled || 0}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">Talabat in class</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-2xs bg-linear-to-b from-white to-emerald-50/30">
                  <div className="flex items-center justify-between text-emerald-600 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider">Present</span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="text-2xl font-black text-emerald-700">
                    {masoolScansData?.summary?.presentCount || 0}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium">
                    {masoolScansData?.summary?.attendanceRate || 0}% Attendance
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-2xs bg-linear-to-b from-white to-indigo-50/30">
                  <div className="flex items-center justify-between text-indigo-600 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider">Biometric Scans</span>
                    <Fingerprint className="w-4 h-4 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-indigo-700">
                    {masoolScansData?.summary?.biometricCount || 0}
                  </div>
                  <div className="text-[11px] text-indigo-600 font-medium">Hikvision Verified</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs bg-linear-to-b from-white to-amber-50/30">
                  <div className="flex items-center justify-between text-amber-600 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider">Late Arrivals</span>
                    <Clock className="w-4 h-4 text-amber-600" />
                  </div>
                  <div className="text-2xl font-black text-amber-700">
                    {masoolScansData?.summary?.lateCount || 0}
                  </div>
                  <div className="text-[11px] text-amber-600 font-medium">Post-window scan</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-red-200/80 shadow-2xs bg-linear-to-b from-white to-red-50/30">
                  <div className="flex items-center justify-between text-red-600 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider">Absent</span>
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  </div>
                  <div className="text-2xl font-black text-red-700">
                    {masoolScansData?.summary?.absentCount || 0}
                  </div>
                  <div className="text-[11px] text-red-600 font-medium">No check-in record</div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[10px] font-black uppercase tracking-wider">Unmarked</span>
                    <Clock className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="text-2xl font-black text-slate-700">
                    {masoolScansData?.summary?.unmarkedCount || 0}
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium">Awaiting punch</div>
                </div>
              </div>

              {/* Search & Filter Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search talabat by Name, ITS number..."
                      value={masoolScanSearch}
                      onChange={(e) => setMasoolScanSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    {masoolScanSearch && (
                      <button
                        onClick={() => setMasoolScanSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Filter Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {(
                      [
                        { key: "ALL", label: `All (${masoolScansData?.summary?.totalEnrolled || 0})` },
                        { key: "BIOMETRIC", label: `Biometric (${masoolScansData?.summary?.biometricCount || 0})` },
                        { key: "PRESENT", label: `Present (${masoolScansData?.summary?.presentCount || 0})` },
                        { key: "LATE", label: `Late (${masoolScansData?.summary?.lateCount || 0})` },
                        { key: "ABSENT", label: `Absent (${masoolScansData?.summary?.absentCount || 0})` },
                        { key: "NOT_MARKED", label: `Unmarked (${masoolScansData?.summary?.unmarkedCount || 0})` },
                      ] as const
                    ).map((filter) => (
                      <button
                        key={filter.key}
                        onClick={() => setMasoolScanFilter(filter.key)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          masoolScanFilter === filter.key
                            ? "bg-[#1c1c1c] text-amber-300 shadow-2xs"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Individual Scan Records List / Table */}
              <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                {loadingMasoolScans ? (
                  <div className="p-12 text-center text-slate-400 space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
                    <p className="text-xs font-bold text-slate-600">Retrieving class biometric scan records from Hikvision...</p>
                  </div>
                ) : filteredMasoolScans.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 space-y-2">
                    <Fingerprint className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-sm font-bold text-slate-700">No student scan records found</p>
                    <p className="text-xs text-slate-500">
                      {masoolScanSearch || masoolScanFilter !== "ALL"
                        ? "Try adjusting your search query or filter."
                        : "No biometric scans or manual entries recorded for this date yet."}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[10.5px] font-black uppercase text-slate-500 tracking-wider">
                          <th className="py-3.5 px-4 w-12 text-center">#</th>
                          <th className="py-3.5 px-4">Talabat Name & ITS</th>
                          <th className="py-3.5 px-4">Status</th>
                          <th className="py-3.5 px-4">Verification Method</th>
                          <th className="py-3.5 px-4">Check-In Time</th>
                          <th className="py-3.5 px-4">Check-Out</th>
                          <th className="py-3.5 px-4 text-center">Punches</th>
                          <th className="py-3.5 px-4">Remarks / Excuse</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMasoolScans.map((student: any, idx: number) => {
                          const isBiometric = student.source === "BIOMETRIC" || Boolean(student.biometricMethod);
                          return (
                            <tr key={student.studentId || idx} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3.5 px-4 text-center font-mono text-slate-400 font-bold">
                                {idx + 1}
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-9 h-9 border border-slate-200">
                                    {student.avatarUrl && <AvatarImage src={student.avatarUrl} alt={student.name} />}
                                    <AvatarFallback className="bg-amber-100 text-amber-900 font-bold text-xs">
                                      {getInitials(student.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-extrabold text-slate-900 text-sm leading-tight">
                                      {student.name}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="font-mono text-[10.5px] font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                                        ITS: {student.its || "—"}
                                      </span>
                                      {student.studentNumber && (
                                        <span className="text-[10px] text-slate-400 font-mono">
                                          ID: {student.studentNumber}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                {student.status === "PRESENT" && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    PRESENT
                                  </span>
                                )}
                                {student.status === "LATE" && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-amber-100 text-amber-800 border border-amber-300">
                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                    LATE
                                  </span>
                                )}
                                {student.status === "ABSENT" && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-red-100 text-red-800 border border-red-300">
                                    <AlertCircle className="w-3.5 h-3.5 text-red-600" />
                                    ABSENT
                                  </span>
                                )}
                                {student.status === "ON_LEAVE" && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-purple-100 text-purple-800 border border-purple-300">
                                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                                    ON LEAVE
                                  </span>
                                )}
                                {(!student.status || student.status === "NOT_MARKED") && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-500">
                                    Not Marked
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {isBiometric ? (
                                  <div className="flex items-center gap-1.5 font-bold text-indigo-900 bg-indigo-50/80 px-2.5 py-1 rounded-xl border border-indigo-200/70 w-fit">
                                    {student.biometricMethod === "FINGERPRINT" ? (
                                      <Fingerprint className="w-3.5 h-3.5 text-indigo-600" />
                                    ) : (
                                      <Camera className="w-3.5 h-3.5 text-indigo-600" />
                                    )}
                                    <span className="text-[11px]">
                                      {student.biometricMethod === "FINGERPRINT"
                                        ? "Hikvision Fingerprint"
                                        : "Hikvision Facial Scan"}
                                    </span>
                                  </div>
                                ) : student.source === "MANUAL" ? (
                                  <div className="flex items-center gap-1.5 font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200 w-fit">
                                    <ClipboardCheck className="w-3.5 h-3.5 text-amber-600" />
                                    <span className="text-[11px]">Manual Entry</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 font-medium text-[11px]">Pending Terminal Punch</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {student.checkInTime ? (
                                  <span className="font-mono font-black text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80">
                                    {student.checkInTime}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-mono">—</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {student.checkOutTime ? (
                                  <span className="font-mono font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded">
                                    {student.checkOutTime}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-mono">—</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-center">
                                {student.punchesCount > 0 ? (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 font-mono font-black text-slate-800 text-[11px] border border-slate-200">
                                    {student.punchesCount}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 font-mono">0</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4">
                                {student.justification ? (
                                  <div className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded-lg border border-slate-200 max-w-xs truncate" title={student.justification}>
                                    {student.justification}
                                  </div>
                                ) : (
                                  <span className="text-slate-300 text-[10px]">None</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Security Audit Footer */}
                <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 text-[11px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Biometric Terminal Sync: All punches logged with hardware timestamps in IST.</span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    Audited by: {data?.teacher?.name || "Class Masool"} • Class ID: {currentMasoolClass?.id}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          TAB 3: ALL DARAJAH CLASSES EXPLORER (WITH TALABAT ROSTER)
         ───────────────────────────────────────────────────────────── */}
      {viewTab === "classes" && (
        <div className="space-y-6">
          {/* Class Selector Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/90 shadow-sm space-y-4">
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
                    className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 ${
                      isSelected
                        ? "bg-[#1c1c1c] text-amber-300 ring-2 ring-emerald-600/30 shadow-sm"
                        : "bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900"
                    }`}
                  >
                    <span>Class {clsName}</span>
                  </button>
                );
              })}
            </div>

            {/* Active Class Header Card */}
            {classData?.class && (
              <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {classData.class.masool && (
                    <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 shadow-xs">
                      {classData.class.masool.avatarUrl ? (
                        <div className="w-14 h-14 ring-3 ring-amber-400 rounded-2xl overflow-hidden shrink-0 shadow-sm bg-slate-900">
                          <img
                            src={classData.class.masool.avatarUrl}
                            alt={classData.class.masool.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-2xl bg-[#1c1c1c] text-amber-300 ring-2 ring-amber-400 flex items-center justify-center text-xs font-black shrink-0">
                          {getInitials(classData.class.masool.name)}
                        </div>
                      )}
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">Class Masool:</div>
                        <div className="text-sm font-extrabold text-slate-900 truncate max-w-[200px]" title={classData.class.masool.name}>
                          {classData.class.masool.name}
                        </div>
                        {classData.class.masool.its && (
                          <div className="text-[10px] font-mono text-slate-500">ITS: {classData.class.masool.its}</div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Talabat Stack & Roster Action */}
                  <div className="flex items-center gap-3 pl-0 sm:pl-3 sm:border-l border-slate-200">
                    <div className="flex -space-x-2 overflow-hidden shrink-0">
                      {(classData.class.talabat || []).slice(0, 4).map((student: any) => (
                        <Avatar key={student.id} className="inline-block w-7 h-7 ring-2 ring-white">
                          {student.avatarUrl && <AvatarImage src={student.avatarUrl} alt={student.name} />}
                          <AvatarFallback className="bg-emerald-800 text-amber-200 text-[9px] font-black">
                            {getInitials(student.name)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-slate-900">
                        {(classData.class.talabat?.length || classData.class.studentCount || 0)} Talabat Enrolled
                      </div>
                      <button
                        onClick={() => openRosterModal(classData.class)}
                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-950 underline flex items-center gap-1 cursor-pointer transition-colors mt-0.5"
                      >
                        <Users className="w-3 h-3 text-emerald-700" />
                        View Talabat Directory
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => openRosterModal(classData.class)}
                    variant="outline"
                    size="sm"
                    className="bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-300 font-bold text-xs gap-1.5 rounded-xl shadow-2xs"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-700" />
                    Talabat Directory ({(classData.class.talabat?.length || classData.class.studentCount || 0)})
                  </Button>
                  <div className="text-xs font-semibold text-emerald-900 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
                    {classData.class.roomNumber || `Room ${classData.class.name}`}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TableMaster Subject Load Distribution & Spotlight Bar */}
          {classSubjectStats.length > 0 && (
            <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    TableMaster Subject Load ({classSubjectStats.length} Subjects):
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Click any subject to spotlight across the weekly timetable
                  </span>
                </div>
                {spotlightSubject && (
                  <button
                    onClick={() => setSpotlightSubject(null)}
                    className="text-[10.5px] font-black text-amber-900 hover:text-amber-950 bg-amber-100 px-2.5 py-0.5 rounded-lg flex items-center gap-1 border border-amber-300 transition-colors"
                  >
                    <X className="w-3 h-3" /> Clear Spotlight: {spotlightSubject}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {classSubjectStats.map((item) => {
                  const isSpotlighted = spotlightSubject?.toLowerCase() === item.name.toLowerCase();
                  return (
                    <button
                      key={item.name}
                      onClick={() => toggleSpotlight(item.name)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                        isSpotlighted
                          ? "ring-2 ring-amber-400 shadow-md scale-105 font-black " + item.theme.badge
                          : "hover:scale-[1.02] " + item.theme.bgLight + " " + item.theme.text + " " + item.theme.border
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${item.theme.dot}`} />
                      <span>{item.name}</span>
                      <span className="text-[10px] opacity-80 font-mono font-bold">
                        {item.count}p ({item.percentage}%)
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
                    <tr className="bg-[#1c1c1c] text-white">
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
                          const theme = slot ? getSubjectTheme(slot.subject) : null;
                          const isMatch = !spotlightSubject || (slot && slot.subject && slot.subject.toLowerCase() === spotlightSubject.toLowerCase());
                          const isChanged = Boolean(slot?.isRecentlyChanged);

                          return (
                            <td key={p.period} className="p-2 border-r border-slate-100 last:border-r-0 align-top">
                              {slot && theme ? (
                                <div
                                  style={{
                                    borderLeftColor: isChanged ? "#f59e0b" : theme.accent,
                                    borderLeftWidth: isChanged ? "4px" : "3px",
                                  }}
                                  className={`p-2.5 rounded-2xl border shadow-2xs transition-all ${
                                    isChanged
                                      ? "bg-amber-50/95 border-amber-400 ring-2 ring-amber-400/80 shadow-md"
                                      : isTaughtByMe
                                      ? "ring-2 ring-emerald-500/40 shadow-sm " + theme.bgLight + " " + theme.border
                                      : `${theme.bgLight} ${theme.border}`
                                  } ${
                                    !isMatch ? "opacity-30 grayscale-[40%] scale-98" : spotlightSubject ? "ring-2 ring-amber-400 shadow-md scale-[1.02]" : ""
                                  }`}
                                >
                                  {isChanged && (
                                    <div className="mb-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 shadow-2xs">
                                      <Sparkles className="w-2 h-2 text-slate-950" /> Updated
                                    </div>
                                  )}

                                  <div className="flex items-start justify-between gap-1">
                                    <button
                                      onClick={() => toggleSpotlight(slot.subject)}
                                      className={`text-[10.5px] font-extrabold px-2 py-0.5 rounded-md leading-tight text-left cursor-pointer transition-transform hover:scale-105 ${theme.badge}`}
                                      title="Click to spotlight this subject"
                                    >
                                      {slot.subject}
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1.5 mt-2">
                                    {slot.teacherAvatar ? (
                                      <Avatar className="w-5 h-5 ring-1 ring-emerald-600/30 shrink-0">
                                        <AvatarImage src={slot.teacherAvatar} alt={slot.teacherName} />
                                        <AvatarFallback className="text-[8px] bg-slate-900 text-amber-200">
                                          {getInitials(slot.teacherName)}
                                        </AvatarFallback>
                                      </Avatar>
                                    ) : null}
                                    <div className="text-[11px] text-slate-700 font-semibold truncate" title={slot.teacherName}>
                                      {slot.teacherName}
                                    </div>
                                  </div>

                                  {isChanged && slot.changeDescription && (
                                    <div className="text-[9px] font-bold text-amber-900 bg-amber-100/90 px-1.5 py-0.5 rounded mt-1.5 leading-tight">
                                      {slot.changeDescription}
                                    </div>
                                  )}

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

      {/* ─────────────────────────────────────────────────────────────
          TALABAT ROSTER MODAL (DARAJAH ENROLLED STUDENTS)
         ───────────────────────────────────────────────────────────── */}
      <Modal open={talabatModalOpen} onOpenChange={setTalabatModalOpen}>
        <ModalContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#1c1c1c] text-amber-300 flex items-center justify-center text-sm font-black shadow-xs">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-base font-extrabold text-slate-900">
                  Enrolled Talabat — Class {activeRosterClass?.name || selectedClassName}
                </div>
                <div className="text-xs text-slate-500 font-normal">
                  {filteredTalabat.length} of {activeRosterClass?.talabat?.length || activeRosterClass?.studentCount || 0} Talabat enrolled in Darajah {activeRosterClass?.grade || ""}{activeRosterClass?.section || ""}
                </div>
              </div>
            </ModalTitle>
          </ModalHeader>

          {/* Search Bar inside Modal */}
          <div className="px-6 py-2 border-b border-slate-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search students by name, ITS, or roll number..."
                value={talabatSearch}
                onChange={(e) => setTalabatSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none font-medium"
              />
            </div>
          </div>

          {/* Student List Grid */}
          <div className="p-6 overflow-y-auto max-h-[50vh] divide-y divide-slate-100">
            {filteredTalabat.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No students match your search in Class {activeRosterClass?.name || selectedClassName}.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {filteredTalabat.map((s: any, idx: number) => (
                  <div
                    key={s.id || idx}
                    className="p-3 rounded-2xl bg-slate-50/80 hover:bg-emerald-50/50 border border-slate-200/80 hover:border-emerald-300 transition-all flex items-center gap-3"
                  >
                    <Avatar className="w-10 h-10 ring-1 ring-emerald-600/30 shrink-0">
                      {s.avatarUrl && <AvatarImage src={s.avatarUrl} alt={s.name} />}
                      <AvatarFallback className="bg-[#1c1c1c] text-amber-300 text-xs font-bold">
                        {getInitials(s.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-slate-900 truncate" title={s.name}>
                        {s.name}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-0.5">
                        {s.rollNumber && <span className="font-bold text-emerald-800">Roll #{s.rollNumber}</span>}
                        {s.rollNumber && <span>•</span>}
                        <span>ITS: {s.its || "—"}</span>
                      </div>
                    </div>

                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 shrink-0">
                      Active
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <ModalFooter className="flex items-center justify-between">
            <span className="text-xs text-slate-500 font-mono">
              Class {activeRosterClass?.name || selectedClassName} • Room {activeRosterClass?.roomNumber || activeRosterClass?.name || selectedClassName}
            </span>
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="text-xs">
                Close
              </Button>
            </ModalClose>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
