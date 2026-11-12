"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Award,
  Heart,
  Zap,
  Check,
  X,
  Undo2,
  AlertTriangle,
  Search,
  Loader2,
  BookOpen,
  ClipboardList,
  ChevronRight,
  Clock,
  Sparkles,
  CheckCircle2,
  ShoppingBag,
  Filter,
  ShieldAlert,
  CheckSquare,
  RotateCcw,
  Plus,
  Minus,
  Flame,
  BookCheck,
  GraduationCap,
  Send,
  Sparkle,
  UserCheck,
  UserX,
  Star,
  ArrowUpRight,
  RefreshCw,
  Tv,
  CalendarDays,
  User,
  Activity,
  ArrowRightLeft,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatPoints, formatSmartTime } from "@/lib/utils";
import PortfolioView from "@/components/teacher/PortfolioView";
import { usePortalAccess } from "@/context/PortalAccessContext";
import { getCachedData, setCachedData } from "@/lib/fast-cache";

export default function ExpertTeacherDashboard() {
  const { isModuleVisible, isPageAssigned, canManageTimetable } = usePortalAccess();
  const hasBadalDesk = canManageTimetable || isPageAssigned("badal") || isPageAssigned("timetable");
  // Takhteet portion displays to assigned teachers only (respects module visibility & page assignment)
  const can = (key: string) => isModuleVisible(key, "TEACHER") && isPageAssigned(key);

  // Check if point matrix is restricted to specific faculty
  const isPointMatrixRestricted = (key: string) => key === "point-matrix" && (!isModuleVisible(key, "TEACHER") || !isPageAssigned(key));

  // Data state with instant Zero-Spinner Fast Cache
  const cachedDash = getCachedData<any>("teacher_dashboard");
  const [teacher, setTeacher] = useState<any>(cachedDash?.teacher || null);
  const [todayBadals, setTodayBadals] = useState<any[]>(cachedDash?.todayBadals || []);
  const [classes, setClasses] = useState<any[]>(cachedDash?.classes || []);
  const [students, setStudents] = useState<any[]>(cachedDash?.students || []);
  const [stats, setStats] = useState<any>(cachedDash?.stats || null);
  const [recentActivity, setRecentActivity] = useState<any[]>(cachedDash?.recentActivity || []);
  const [takhteet, setTakhteet] = useState<any[]>(() => getCachedData<any[]>("teacher_takhteet") || []);
  const [loading, setLoading] = useState(!cachedDash);
  const [takhteetLoading, setTakhteetLoading] = useState(!getCachedData("teacher_takhteet"));
  const [todayDua, setTodayDua] = useState<any>(null);

  // Filters & Selection
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [attendanceFilter, setAttendanceFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "points_desc" | "points_asc" | "attendance">("name");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  // Custom Point action state (empty by default - teacher enters category and number)
  const [customPointsVal, setCustomPointsVal] = useState<string>("");
  const [customCategoryVal, setCustomCategoryVal] = useState<string>("");
  const [customActionType, setCustomActionType] = useState<"POSITIVE" | "NEGATIVE">("POSITIVE");
  const [customNote, setCustomNote] = useState<string>("");
  const [awarding, setAwarding] = useState(false);
  const [awardFeedback, setAwardFeedback] = useState<string | null>(null);

  // Undo Toast state
  const [showUndo, setShowUndo] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [lastLogIds, setLastLogIds] = useState<string[]>([]);

  // Fetch initial dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/dashboard");
      const json = await res.json();
      if (json.success && json.data) {
        setTeacher(json.data.teacher);
        setClasses(json.data.classes || []);
        setStudents(json.data.students || []);
        setStats(json.data.stats || null);
        setRecentActivity(json.data.recentActivity || []);
        if (Array.isArray(json.data.todayBadals)) setTodayBadals(json.data.todayBadals);
        setCachedData("teacher_dashboard", json.data);
      }
    } catch (err) {
      console.error("Failed to load dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();

    fetch("/api/teacher/takhteet")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setTakhteet(res.data);
          setCachedData("teacher_takhteet", res.data);
        }
        setTakhteetLoading(false);
      })
      .catch(() => setTakhteetLoading(false));

    fetch("/api/tilawat-dua/today")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setTodayDua(res.data);
        }
      })
      .catch(() => {});
  }, [loadDashboardData]);

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (selectedClassId !== "ALL" && !s.classIds?.includes(selectedClassId)) {
          return false;
        }
        if (attendanceFilter === "PRESENT" && !s.isCheckedIn) return false;
        if (attendanceFilter === "ABSENT" && s.isCheckedIn) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
          const its = String(s.its || "").toLowerCase();
          const gradeSec = `${s.grade || ""} ${s.section || ""}`.toLowerCase();
          return fullName.includes(q) || its.includes(q) || gradeSec.includes(q);
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "points_desc") return (b.currentPoints || 0) - (a.currentPoints || 0);
        if (sortBy === "points_asc") return (a.currentPoints || 0) - (b.currentPoints || 0);
        if (sortBy === "attendance") {
          if (a.isCheckedIn === b.isCheckedIn) return a.firstName.localeCompare(b.firstName);
          return a.isCheckedIn ? -1 : 1;
        }
        return a.firstName.localeCompare(b.firstName);
      });
  }, [students, selectedClassId, attendanceFilter, searchQuery, sortBy]);

  // Selection handlers
  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedStudents);
    filteredStudents.forEach((s) => next.add(s.id));
    setSelectedStudents(next);
  };

  const selectPresentOnly = () => {
    const next = new Set<string>();
    filteredStudents.filter((s) => s.isCheckedIn).forEach((s) => next.add(s.id));
    setSelectedStudents(next);
  };

  const clearSelection = () => {
    setSelectedStudents(new Set());
  };

  // Award Points execution
  const executeAward = async (payload: {
    category: string;
    pointsChanged: number;
    actionType: "POSITIVE" | "NEGATIVE";
    optionalNote?: string;
  }) => {
    if (selectedStudents.size === 0 || awarding) return;
    setAwarding(true);
    setAwardFeedback(null);

    try {
      const res = await fetch("/api/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: Array.from(selectedStudents),
          actionType: payload.actionType,
          category: payload.category,
          pointsChanged: Math.abs(payload.pointsChanged),
          optionalNote: payload.optionalNote || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const count = selectedStudents.size;
        setLastLogIds(data.data.map((l: any) => l.id));
        setLastAction(
          `${payload.actionType === "POSITIVE" ? "+" : "-"}${payload.pointsChanged} pts for "${payload.category}" given to ${count} talabat`
        );
        setShowUndo(true);
        setTimeout(() => setShowUndo(false), 9000);

        setAwardFeedback(`✨ Successfully recorded for ${count} talabat!`);
        setTimeout(() => setAwardFeedback(null), 3500);

        await loadDashboardData();
        clearSelection();
        setCustomNote("");
        setCustomCategoryVal("");
        setCustomPointsVal("");
      } else {
        alert(data.error || "Failed to award points");
      }
    } catch (e) {
      console.error(e);
      alert("Network error while submitting points");
    } finally {
      setAwarding(false);
    }
  };

  const handleUndo = async () => {
    if (lastLogIds.length === 0) return;
    try {
      await fetch("/api/points", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointLogIds: lastLogIds }),
      });
      setShowUndo(false);
      setLastAction(null);
      setLastLogIds([]);
      await loadDashboardData();
    } catch (e) {
      console.error(e);
    }
  };

  const attendancePercent = useMemo(() => {
    if (!stats || !stats.totalStudents) return 0;
    return Math.round(((stats.presentToday || 0) / stats.totalStudents) * 100);
  }, [stats]);

  return (
    <div className="max-w-7xl mx-auto px-0 sm:px-2 lg:px-4 py-4 sm:py-8 space-y-6 sm:space-y-8">
      {/* ─────────────────────────────────────────────────────────────
          1. DOUBLE-BEZEL ROYAL FATIMI COMMAND HERO
         ───────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="p-1 sm:p-2 rounded-3xl sm:rounded-[2.5rem] bg-gradient-to-br from-amber-400/40 via-stone-800/30 to-amber-400/20 ring-1 ring-amber-400/35 shadow-2xl"
      >
        <div
          className="relative overflow-hidden rounded-[1.8rem] sm:rounded-[2.2rem] p-4 sm:p-9 text-white border border-amber-400/30"
          style={{
            background: "linear-gradient(135deg, #0d0d0d 0%, #151515 50%, #1c1813 100%)",
            boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.35), 0 20px 45px -12px rgba(0, 0, 0, 0.7)",
          }}
        >
          {/* Subtle Ambient Radial Lighting */}
          <div
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#ffe082]/10 blur-3xl pointer-events-none"
          />
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0"><div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-amber-400/10 blur-3xl" /></div>

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Faculty Identity Profile Tile */}
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="relative shrink-0">
                <div className="p-1 rounded-full bg-gradient-to-br from-[#ffe082] via-amber-400 to-[#ffe082]/40 shadow-xl">
                  <Avatar className="w-16 h-16 sm:w-20 sm:h-20 ring-2 ring-emerald-950 bg-emerald-950">
                    {teacher?.avatarUrl && (
                      <AvatarImage
                        src={teacher.avatarUrl}
                        alt={teacher ? `${teacher.firstName} ${teacher.lastName}` : "Faculty"}
                        className="object-contain object-center bg-[#0d0d0d]"
                      />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-[#2d2214] to-[#0d0d0d] text-[#ffe082] text-xl sm:text-2xl font-bold font-display">
                      {teacher ? getInitials(teacher.firstName, teacher.lastName) : "DB"}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <span
                  title="Verified Faculty Profile"
                  className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-emerald-400 ring-2 ring-emerald-950 flex items-center justify-center shadow-md"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-950 stroke-[3]" />
                </span>
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] px-3 py-0.5 rounded-full bg-emerald-950 text-amber-300 border border-amber-400/60 font-black flex items-center gap-1.5 shadow-xs">
                    <Sparkles className="w-3 h-3 text-[#ffe082]" />
                    Faculty Command Console
                  </span>
                  {teacher?.its && (
                    <span className="text-[10.5px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-200 border border-emerald-500/60 font-mono font-bold">
                      ITS: {teacher.its}
                    </span>
                  )}
                  {teacher?.khidmatMauze && (
                    <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-amber-950 text-amber-200 border border-amber-500/60 font-bold">
                      {teacher.khidmatMauze}
                    </span>
                  )}
                </div>

                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                  {teacher ? `${teacher.firstName} ${teacher.lastName}` : "Teacher Dashboard"}
                </h1>

                <p className="text-xs sm:text-sm text-emerald-100 font-semibold mt-1 flex items-center gap-2.5 font-medium">
                  <span>{teacher?.department || "Darse Burhani Academic Faculty"}</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-amber-200 font-bold">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </p>
              </div>
            </div>

            {/* Action Island: Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              <Link href="/teacher/tilawat-dua" className="group">
                <button className="h-11 px-4 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black border border-amber-300 text-xs transition-all duration-200 flex items-center gap-2.5 active:scale-[0.98] shadow-md shadow-amber-500/10">
                  <span>Tilawat Dua Projector</span>
                  <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                    <Tv className="w-3.5 h-3.5" />
                  </span>
                </button>
              </Link>

              {can("classes") && students.length > 0 && (
                <Link href="/teacher/classes" className="group">
                  <button className="h-11 px-5 rounded-full bg-[#ffe082] hover:bg-[#ffd54f] text-emerald-950 font-black text-xs transition-all duration-200 flex items-center gap-3 shadow-lg hover:shadow-xl active:scale-[0.98]">
                    <span>Take Attendance</span>
                    <span className="w-7 h-7 rounded-full bg-emerald-950/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                    </span>
                  </button>
                </Link>
              )}

              <Link href="/teacher/assignments" className="group">
                <button className="h-11 px-4 rounded-full bg-emerald-950 hover:bg-emerald-900 text-emerald-100 border border-emerald-500/60 font-bold text-xs transition-all duration-200 flex items-center gap-2.5 active:scale-[0.98] shadow-sm">
                  <span>Class Assignments</span>
                  <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                    <FileText className="w-3.5 h-3.5 text-amber-300" />
                  </span>
                </button>
              </Link>

              <Link href="/teacher/procurement" className="group">
                <button className="h-11 px-4 rounded-full bg-emerald-950 hover:bg-emerald-900 text-emerald-100 border border-emerald-500/60 font-bold text-xs transition-all duration-200 flex items-center gap-2.5 active:scale-[0.98]">
                  <span>Desk Requisition</span>
                  <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                    <ShoppingBag className="w-3.5 h-3.5 text-teal-300" />
                  </span>
                </button>
              </Link>

              {can("takhteet") && (
                <Link href="/teacher/takhteet" className="group">
                  <button className="h-11 px-4 rounded-full bg-emerald-950 hover:bg-emerald-900 text-emerald-100 border border-emerald-500/60 font-bold text-xs transition-all duration-200 flex items-center gap-2.5 active:scale-[0.98]">
                    <span>Takhteet Plan</span>
                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                      <ClipboardList className="w-3.5 h-3.5 text-amber-300" />
                    </span>
                  </button>
                </Link>
              )}

              {can("timetable") && (
                <Link href="/teacher/timetable" className="group">
                  <button className="h-11 px-4 rounded-full bg-emerald-950 hover:bg-emerald-900 text-emerald-100 border border-emerald-500/60 font-bold text-xs transition-all duration-200 flex items-center gap-2.5 active:scale-[0.98]">
                    <span>Timetable Matrix</span>
                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                      <CalendarDays className="w-3.5 h-3.5 text-blue-300" />
                    </span>
                  </button>
                </Link>
              )}

              {hasBadalDesk && (
                <Link href="/teacher/timetable?tab=matrix-management" className="group">
                  <button className="h-11 px-4 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300 font-extrabold text-xs transition-all duration-200 flex items-center gap-2.5 active:scale-[0.98] shadow-md">
                    <span>⚡ Timetable &amp; Badal Desk</span>
                    <span className="w-6 h-6 rounded-full bg-slate-950/15 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                      <ArrowRightLeft className="w-3.5 h-3.5 text-slate-950" />
                    </span>
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Today's Assigned Badal Substitute Duties Banner ── */}
      {todayBadals.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl border-2 border-amber-400 bg-gradient-to-r from-amber-500/20 via-yellow-400/15 to-amber-500/25 p-5 sm:p-6 shadow-xl shadow-amber-500/10 space-y-4 text-slate-950"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-md ring-4 ring-amber-300/60 animate-pulse">
                <Zap className="w-6 h-6 fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-red-600 text-white px-2.5 py-0.5 rounded-full shadow-xs animate-bounce">
                    🚨 URGENT SUBSTITUTE DUTY
                  </span>
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                    Badal Assigned to You Today ({todayBadals.length})
                  </span>
                </div>
                <p className="text-xs text-amber-900 font-semibold mt-1 max-w-2xl">
                  You have been assigned substitute teaching duty. An official notice has been recorded. Please review your class and period assignments below.
                </p>
              </div>
            </div>

            <Link href="/teacher/timetable">
              <Button className="bg-amber-400 text-slate-950 font-black hover:bg-amber-300 rounded-2xl px-5 shadow-md">
                Open Timetable &amp; Sabaq Notes →
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {todayBadals.map((b: any) => (
              <div
                key={b.id}
                className="p-4 rounded-2xl bg-white border-2 border-amber-400 shadow-md space-y-2"
              >
                <div className="flex items-center justify-between">
                  <Badge className="bg-emerald-100 text-emerald-950 font-black text-xs border border-emerald-300">
                    {b.subject}
                  </Badge>
                  <span className="text-[11px] font-black text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                    Period {b.period}
                  </span>
                </div>
                <div>
                  <div className="text-sm font-black text-slate-950">
                    Class {b.className} • ⏱️ {b.startTime} – {b.endTime}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5 font-bold">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                    <span>Covering for: {b.originalTeacher}</span>
                  </div>
                  {b.instructions && (
                    <div className="text-[11px] text-amber-900 bg-amber-50 rounded-lg p-2 border border-amber-200/60 mt-1.5 italic font-medium">
                      &ldquo;{b.instructions}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

            {/* ─────────────────────────────────────────────────────────────
          DAILY TILAWAT DUA CLASSROOM BANNER
         ───────────────────────────────────────────────────────────── */}
      {todayDua && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05, ease: "easeOut" }}
          className="p-1 rounded-3xl bg-amber-500/10 ring-1 ring-amber-500/20 overflow-hidden shadow-sm"
        >
          <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-950/70 text-white rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 border border-amber-500/20">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-amber-400 text-slate-950 text-[10px] font-black uppercase">
                    Daily Tilawat Dua
                  </Badge>
                  <span className="text-xs text-amber-200/80 font-mono">Classroom Recitation</span>
                </div>
                <h3 className="text-lg font-extrabold text-white mt-0.5">{todayDua.title}</h3>
                {todayDua.description && (
                  <p className="text-xs text-slate-300 line-clamp-1">{todayDua.description}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
              <Link
                href="/tilawat-dua/projector"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20 transition active:scale-95"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Launch Projector</span>
              </Link>
              <Link
                href="/teacher/tilawat-dua"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition"
              >
                <span>Open Dua Viewer</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. MACHINED HUD METRICS BENTO (DOUBLE-BEZEL)
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: Total Talabat / Faculty Profile */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-1 rounded-3xl bg-emerald-950/5 ring-1 ring-emerald-900/10 shadow-xs"
            >
              <div className="rounded-[calc(1.5rem-0.25rem)] bg-white p-4 sm:p-5 flex items-center gap-4 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)]">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/10 text-amber-700 ring-1 ring-amber-400/25 flex items-center justify-center shrink-0 shadow-xs">
                  {can("classes") ? <Users className="w-6 h-6" strokeWidth={1.75} /> : <User className="w-6 h-6" strokeWidth={1.75} />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.16em]">
                    {can("classes") ? "Total Enrolled" : "Faculty Profile"}
                  </p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-gray-900 num-tabular tracking-tight">
                      {can("classes") ? (loading ? "..." : students.length) : (teacher?.roleTitle || teacher?.department || "Faculty")}
                    </span>
                    {can("classes") && <span className="text-xs text-gray-600 font-bold">Talabat</span>}
                  </div>
                  <p className="text-xs text-emerald-950 dark:text-emerald-300 font-extrabold truncate mt-0.5">
                    {can("classes") ? `Across ${classes.length} active classes` : (teacher?.user ? `${teacher.user.firstName} ${teacher.user.lastName}` : "Darse Burhani")}
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Card 2: Today's Check-Ins (with circular gauge indicator) */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-1 rounded-3xl bg-emerald-950/5 ring-1 ring-emerald-900/10 shadow-xs"
            >
              <div className="rounded-[calc(1.5rem-0.25rem)] bg-white p-4 sm:p-5 flex items-center gap-4 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)]">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100/70 text-emerald-800 border border-emerald-300/80 flex items-center justify-center shrink-0 shadow-xs">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.16em]">Today&apos;s Presence</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-emerald-800 num-tabular tracking-tight">
                      {loading ? "..." : stats?.presentToday || 0}
                    </span>
                    <span className="text-xs text-gray-600 font-bold">
                      / {stats?.totalStudents || students.length || 0}
                    </span>
                  </div>
                  <div className="w-full bg-emerald-100/80 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-700 ease-spring"
                      style={{ width: `${attendancePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Card 3: Points Awarded Today */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="p-1 rounded-3xl bg-amber-950/5 ring-1 ring-amber-900/10 shadow-xs"
            >
              <div className="rounded-[calc(1.5rem-0.25rem)] bg-white p-4 sm:p-5 flex items-center gap-4 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)]">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center justify-center shrink-0 shadow-xs">
                  <Zap className="w-6 h-6 fill-amber-500 text-amber-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.16em]">Merit Points Today</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-amber-800 num-tabular tracking-tight">
                      +{loading ? "..." : stats?.pointsToday || 0}
                    </span>
                    <span className="text-xs text-amber-700 font-bold">pts</span>
                  </div>
                  <p className="text-[10.5px] text-gray-600 font-semibold truncate mt-0.5">
                    {stats?.awardsCountToday || 0} actions recorded
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Card 4: Takhteet / Active Curriculum Goals */}
            {can("takhteet") ? (
              <Link href="/teacher/takhteet" className="block group">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="p-1 rounded-3xl bg-purple-950/5 ring-1 ring-purple-900/10 shadow-xs hover:ring-purple-400/40 transition-all cursor-pointer h-full"
                >
                  <div className="rounded-[calc(1.5rem-0.25rem)] bg-white p-4 sm:p-5 flex items-center gap-4 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)]">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-800 border border-purple-200/80 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform duration-300">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.16em]">Takhteet Portions</p>
                        <ArrowUpRight className="w-4 h-4 text-purple-400 group-hover:text-purple-600 transition-colors" />
                      </div>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-2xl sm:text-3xl font-black text-purple-900 num-tabular tracking-tight">
                          {takhteet.length}
                        </span>
                        <span className="text-xs text-gray-600 font-bold">Portions</span>
                      </div>
                      <p className="text-[10.5px] text-purple-700 font-bold truncate mt-0.5">
                        {takhteet.filter((p) => p.status === "COMPLETED").length} completed
                      </p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ) : can("classes") ? (
              <Link href="/teacher/classes" className="block group">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="p-1 rounded-3xl bg-blue-950/5 ring-1 ring-blue-900/10 shadow-xs hover:ring-blue-400/40 transition-all cursor-pointer h-full"
                >
                  <div className="rounded-[calc(1.5rem-0.25rem)] bg-white p-4 sm:p-5 flex items-center gap-4 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)]">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-800 border border-blue-200/80 flex items-center justify-center shrink-0 shadow-xs">
                      <Award className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.16em]">Assigned Classes</p>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-2xl sm:text-3xl font-black text-blue-900 num-tabular tracking-tight">
                          {classes.length}
                        </span>
                        <span className="text-xs text-gray-600 font-bold">Sections</span>
                      </div>
                      <p className="text-[10.5px] text-blue-700 font-bold truncate mt-0.5">
                        Active teaching sessions
                      </p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ) : (
              <Link href="/teacher/my-attendance" className="block group">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="p-1 rounded-3xl bg-emerald-950/5 ring-1 ring-emerald-900/10 shadow-xs hover:ring-emerald-400/40 transition-all cursor-pointer h-full"
                >
                  <div className="rounded-[calc(1.5rem-0.25rem)] bg-white p-4 sm:p-5 flex items-center gap-4 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)]">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-xs">
                      <Activity className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-slate-800 uppercase tracking-[0.16em]">Faculty Service</p>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-xl sm:text-2xl font-black text-emerald-900 num-tabular tracking-tight">
                          My Attendance
                        </span>
                      </div>
                      <p className="text-[10.5px] text-emerald-700 font-bold truncate mt-0.5">
                        Attendance & scan record
                      </p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              3. DOUBLE-BEZEL CLASS SWITCHER & SMART FILTER CLUSTER
             ───────────────────────────────────────────────────────────── */}
          {students.length > 0 && (
            <div className="p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/10 shadow-sm">
            <div className="rounded-[calc(2rem-0.375rem)] bg-white p-4 sm:p-6 space-y-4">
              {/* Class Tabs Pill Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none border-b border-gray-100">
                <span className="text-xs font-black text-gray-600 uppercase tracking-[0.12em] shrink-0 mr-1 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  Classes:
                </span>

                <button
                  onClick={() => setSelectedClassId("ALL")}
                  className={`px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 flex items-center gap-2 ${
                    selectedClassId === "ALL"
                      ? "bg-stone-900 text-amber-300 shadow-md ring-1 ring-amber-400/40"
                      : "bg-gray-100 text-gray-700 hover:bg-amber-50 hover:text-amber-900"
                  }`}
                >
                  <span>All Talabat</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      selectedClassId === "ALL" ? "bg-amber-400/20 text-amber-300 border border-amber-400/30" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {students.length}
                  </span>
                </button>

                {classes.map((cls) => {
                  const isSelected = selectedClassId === cls.id;
                  return (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 flex items-center gap-2 ${
                        isSelected
                          ? "bg-stone-900 text-amber-300 shadow-md ring-1 ring-amber-400/40"
                          : "bg-gray-100 text-gray-700 hover:bg-amber-50 hover:text-amber-900"
                      }`}
                    >
                      <span>{cls.name}</span>
                      {cls.subject && <span className="opacity-75 font-normal text-[11px]">({cls.subject})</span>}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          isSelected ? "bg-amber-400/20 text-amber-300 border border-amber-400/30" : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {cls.studentCount || 0}
                      </span>
                    </button>
                  );
                })}

                <div className="ml-auto shrink-0 pl-2">
                  <Link href="/teacher/assignments">
                    <button
                      className="px-3.5 py-1.5 rounded-full text-xs font-black transition-all shrink-0 flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-300 shadow-sm active:scale-95"
                      title="Create or manage class assignments"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-950" />
                      <span>+ Assignment for Class</span>
                    </button>
                  </Link>
                </div>
              </div>

              {/* Instant Search Bar & Filter Toolset */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
                <div className="flex-1 flex flex-wrap items-center gap-2.5">
                  {/* Search Input */}
                  <div className="relative min-w-[240px] flex-1 sm:flex-initial">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="teacher-student-search"
                      name="studentSearch"
                      type="text"
                      placeholder="Search by name, ITS, grade..."
                      aria-label="Search students by name, ITS, grade"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-8 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/70 text-xs font-semibold focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        aria-label="Clear search query"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Attendance Presence Filter Pill */}
                  <div className="flex items-center rounded-2xl bg-gray-100 p-1 text-xs font-bold" role="group" aria-label="Filter by attendance status">
                    <button
                      onClick={() => setAttendanceFilter("ALL")}
                      className={`px-3 py-1.5 rounded-xl transition-all ${
                        attendanceFilter === "ALL" ? "bg-white text-gray-900 shadow-xs" : "text-gray-700 hover:text-gray-900"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setAttendanceFilter("PRESENT")}
                      className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                        attendanceFilter === "PRESENT"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-emerald-700 hover:text-emerald-900"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white" />
                      Present
                    </button>
                    <button
                      onClick={() => setAttendanceFilter("ABSENT")}
                      className={`px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition-all ${
                        attendanceFilter === "ABSENT"
                          ? "bg-rose-600 text-white shadow-xs"
                          : "text-rose-700 hover:text-rose-900"
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-rose-400 ring-2 ring-white" />
                      Pending
                    </button>
                  </div>


                  {/* Sort Order */}
                  <select
                    id="teacher-student-sort"
                    name="studentSortOrder"
                    value={sortBy}
                    aria-label="Sort students by"
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/70 text-xs font-bold text-gray-700 focus:border-emerald-500 outline-none"
                  >
                    <option value="name">Sort: Name (A-Z)</option>
                    <option value="points_desc">Sort: Highest Points</option>
                    <option value="points_asc">Sort: Lowest Points</option>
                    <option value="attendance">Sort: Present First</option>
                  </select>
                </div>

                {/* Multi-Selection Smart Hub */}
                <div className="flex flex-wrap items-center gap-2 border-t md:border-t-0 pt-2 md:pt-0 w-full md:w-auto">
                  <button
                    onClick={selectAllFiltered}
                    className="text-xs font-black text-emerald-900 hover:text-emerald-950 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/90 transition-all flex items-center gap-1.5 active:scale-[0.98]"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                    Select All ({filteredStudents.length})
                  </button>
                  <button
                    onClick={selectPresentOnly}
                    className="text-xs font-black text-teal-900 hover:text-teal-950 px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100/80 border border-teal-200/90 transition-all flex items-center gap-1.5 active:scale-[0.98]"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-teal-700" />
                    Present Only
                  </button>
                  {selectedStudents.size > 0 && (
                    <button
                      onClick={clearSelection}
                      className="text-xs font-black text-rose-700 hover:text-rose-950 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100/80 border border-rose-200/90 transition-all flex items-center gap-1.5 active:scale-[0.98]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Clear ({selectedStudents.size})
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              4. MAIN INTERACTIVE WORKSPACE: ROSTER + QUICK MODIFIER DECK
             ───────────────────────────────────────────────────────────── */}
          {students.length === 0 ? (
            <div className="p-1.5 rounded-[2.2rem] bg-emerald-950/5 ring-1 ring-emerald-900/10 shadow-sm">
              <div className="rounded-[calc(2.2rem-0.375rem)] bg-white p-8 sm:p-12 text-center max-w-2xl mx-auto space-y-5">
                <div className="w-16 h-16 rounded-3xl bg-amber-400/10 ring-1 ring-amber-400/25 mx-auto flex items-center justify-center text-amber-700 shadow-sm">
                  <Users className="w-8 h-8 text-amber-700" strokeWidth={1.75} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl font-black text-gray-900 font-display">No Talabat Enrolled</h2>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-lg mx-auto">
                    {classes.length > 0
                      ? `You are assigned to ${classes.length} section${classes.length > 1 ? "s" : ""} (${classes.map((c) => c.name).join(", ")}), but no students are currently enrolled in your roster.`
                      : "You currently have no classes or students assigned to your profile. Please contact the administrator to assign your darajah classes or enroll talabat."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadDashboardData()}
                    className="rounded-2xl text-xs font-bold border-gray-300 hover:bg-gray-50 flex items-center gap-2 h-10 px-5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh Roster
                  </Button>

                  <Link href="/teacher/procurement">
                    <Button
                      size="sm"
                      className="fatimi-emerald-gradient text-white rounded-2xl text-xs font-bold shadow-md hover:shadow-lg flex items-center gap-2 h-10 px-5"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-amber-300" />
                      Desk & Supplies Requisition
                    </Button>
                  </Link>

                  {can("classes") && (
                    <Link href="/teacher/classes">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-2xl text-xs font-bold text-emerald-800 hover:bg-emerald-50 flex items-center gap-2 h-10 px-4"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        Class Overview
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
            {/* Left Col: Interactive Talabat Grid (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-display text-lg font-black text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-700" />
                    Talabat Directory
                  </h2>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-900 border-emerald-300 font-black text-xs px-2.5 py-0.5">
                    {filteredStudents.length} {filteredStudents.length === 1 ? "student" : "students"}
                  </Badge>
                </div>

                {selectedStudents.size > 0 && (
                  <span className="text-xs font-black text-amber-950 bg-amber-100 px-3.5 py-1 rounded-full border border-amber-300 shadow-xs flex items-center gap-1.5 animate-pulse">
                    <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                    {selectedStudents.size} selected for action
                  </span>
                )}
              </div>

              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-48 bg-gray-100 rounded-3xl animate-pulse" />
                  ))}
                </div>
              ) : filteredStudents.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {filteredStudents.map((student) => {
                    const isSelected = selectedStudents.has(student.id);

                    return (
                      <motion.div
                        key={student.id}
                        whileHover={{ y: -4 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => toggleStudent(student.id)}
                        className={`group relative cursor-pointer rounded-3xl p-4 transition-all duration-300 flex flex-col items-center text-center select-none border-2 ${
                          isSelected
                            ? "border-emerald-600 border-t-4 border-t-amber-400 bg-gradient-to-b from-emerald-50/90 via-emerald-50/40 to-white shadow-xl ring-4 ring-emerald-500/20"
                            : "border-stone-200/90 bg-white hover:border-amber-400 hover:border-t-4 hover:border-t-amber-400 hover:shadow-lg shadow-xs"
                        }`}
                      >
                        {/* Selected Check Indicator */}
                        <div
                          className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400"
                              : "border border-gray-300 bg-gray-50 opacity-60 group-hover:opacity-100"
                          }`}
                        >
                          {isSelected ? (
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-transparent" />
                          )}
                        </div>

                        {/* Live Attendance Dot with Pulse on Top Left */}
                        <div className="absolute top-3 left-3">
                          {student.isCheckedIn ? (
                            <span
                              title={`Present (${student.lastCheckIn ? formatSmartTime(student.lastCheckIn) : "Checked in today"})`}
                              className="relative flex h-3 w-3"
                            >
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 ring-2 ring-white shadow-xs" />
                            </span>
                          ) : (
                            <span
                              title="Pending / Not checked in today"
                              className="w-2.5 h-2.5 rounded-full bg-gray-300 ring-2 ring-white inline-block"
                            />
                          )}
                        </div>

                        {/* HD Avatar with fallback */}
                        <div className="relative mt-2 mb-2.5">
                          <div className={`p-0.5 rounded-full ${isSelected ? "ring-2 ring-emerald-500" : "ring-1 ring-gray-200"}`}>
                            <Avatar className="w-14 h-14 ring-2 ring-offset-2 ring-white shadow-sm">
                              {student.avatarUrl && (
                                <AvatarImage
                                  src={student.avatarUrl}
                                  alt={`${student.firstName} ${student.lastName}`}
                                  className="object-contain object-center bg-[#0d0d0d]"
                                />
                              )}
                              <AvatarFallback
                                className={`font-display font-black text-sm ${
                                  isSelected
                                    ? "bg-gradient-to-br from-emerald-600 to-teal-800 text-white"
                                    : "bg-gradient-to-br from-amber-400 to-emerald-600 text-white"
                                }`}
                              >
                                {getInitials(student.firstName, student.lastName)}
                              </AvatarFallback>
                            </Avatar>
                          </div>

                        </div>

                        {/* Full Name & ITS */}
                        <h4 className="font-bold text-sm text-gray-900 leading-tight line-clamp-1">
                          {student.firstName} {student.lastName}
                        </h4>

                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-bold text-gray-500 font-mono">
                            ITS {student.its}
                          </span>
                          {student.grade && (
                            <span className="text-[9.5px] px-1.5 py-0.2 rounded bg-gray-100 font-black text-gray-600">
                              {student.grade}-{student.section || "A"}
                            </span>
                          )}
                        </div>

                        {/* Points Display */}
                        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-stone-100 w-full justify-center">
                          <span className="text-xs font-black text-amber-950 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/90 font-mono shadow-xs flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {formatPoints(student.currentPoints)} <span className="text-[9px] font-bold text-amber-700">PTS</span>
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-1 rounded-[2rem] bg-gray-100 ring-1 ring-gray-200">
                  <div className="rounded-[calc(2rem-0.25rem)] bg-white p-12 text-center">
                    <UserX className="w-12 h-12 mx-auto text-gray-400 mb-3 opacity-60" />
                    <h3 className="font-bold text-gray-800 text-base">No Talabat Found</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                      Try clearing your search query or adjusting your class & attendance filters.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedClassId("ALL");
                        setAttendanceFilter("ALL");
                      }}
                      className="mt-4 rounded-xl text-xs font-bold"
                    >
                      Reset All Filters
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Col: Gamified Quick-Point Modifier Console (4 cols) */}
            <div className="lg:col-span-4 space-y-6">
              {/* Double-Bezel Modifier Deck */}
              <div className="p-1 rounded-[2.2rem] bg-gradient-to-br from-amber-400/40 via-emerald-900/30 to-amber-400/20 ring-1 ring-amber-400/35 shadow-2xl sticky top-24">
                <div className="rounded-[calc(2.2rem-0.25rem)] bg-white overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                  {/* Console Header Crown */}
                  <div className="bg-gradient-to-r from-[#1c1813] via-[#151515] to-[#0d0d0d] text-white p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                        Quick-Point Console
                      </h3>
                      <span className="text-xs font-black px-3 py-0.5 rounded-full bg-emerald-900/90 text-amber-300 border border-amber-300/40">
                        {selectedStudents.size} Selected
                      </span>
                    </div>
                    <p className="text-xs text-emerald-100/80 mt-1">
                      {selectedStudents.size > 0
                        ? `Applying rewards or remarks to ${selectedStudents.size} talabat`
                        : "Tap student cards on the left to batch-apply merit points"}
                    </p>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Award Feedback Toast */}
                    <AnimatePresence>
                      {awardFeedback && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-3 rounded-2xl bg-emerald-100 text-emerald-950 font-black text-xs text-center border border-emerald-300 flex items-center justify-center gap-2 shadow-xs"
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                          {awardFeedback}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {selectedStudents.size === 0 ? (
                      /* Fully Empty State on Zero Selection */
                      <div className="py-10 px-4 text-center space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200/80 mx-auto flex items-center justify-center text-amber-700 shadow-xs">
                          <Award className="w-7 h-7" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-black text-gray-800">No Talabat Selected</p>
                          <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                            Select talabat from the roster on the left to enter point name and how many points to award or deduct.
                          </p>
                        </div>
                        {filteredStudents.length > 0 && (
                          <div className="pt-2">
                            <button
                              type="button"
                              onClick={selectAllFiltered}
                              className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-black transition-all inline-flex items-center gap-1.5 active:scale-95 shadow-xs"
                            >
                              <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                              Select All ({filteredStudents.length})
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Active Form on Selection - Completely Clean & Empty By Default */
                      <div className="space-y-4">
                        {/* Selected Count & Quick Clear */}
                        <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                          <span className="text-[11px] font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            Target: {selectedStudents.size} Talabat
                          </span>
                          <button
                            type="button"
                            onClick={clearSelection}
                            className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 px-2 py-0.5 rounded-lg hover:bg-rose-50 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Clear
                          </button>
                        </div>

                        {/* Award Type: Positive (+) vs Negative (-) */}
                        <div>
                          <label className="text-[11px] font-black uppercase tracking-wider text-gray-500 block mb-1.5">
                            Points Type
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setCustomActionType("POSITIVE")}
                              className={`p-2.5 rounded-2xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                                customActionType === "POSITIVE"
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Merit (+)
                            </button>
                            <button
                              type="button"
                              onClick={() => setCustomActionType("NEGATIVE")}
                              className={`p-2.5 rounded-2xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                                customActionType === "NEGATIVE"
                                  ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                              }`}
                            >
                              <Minus className="w-3.5 h-3.5" />
                              Demerit (-)
                            </button>
                          </div>
                        </div>

                        {/* Point Number (How Much Number) Input */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="quick-point-value" className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                              Points Number / Value <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[10px] text-gray-400 font-semibold">How much number</span>
                          </div>
                          <div className="relative">
                            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-black text-sm text-gray-500">
                              {customActionType === "POSITIVE" ? "+" : "-"}
                            </div>
                            <input
                              id="quick-point-value"
                              name="pointsNumberValue"
                              type="number"
                              min="1"
                              step="1"
                              value={customPointsVal}
                              onChange={(e) => setCustomPointsVal(e.target.value)}
                              placeholder="Enter points number (e.g. 5, 10, 25)..."
                              className="w-full pl-8 pr-4 py-2.5 text-xs font-bold rounded-2xl border border-gray-200 bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:font-normal placeholder:text-gray-400"
                            />
                          </div>
                        </div>

                        {/* Point Name / Category / Reason Input */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label htmlFor="quick-point-reason" className="text-[11px] font-black uppercase tracking-wider text-gray-700">
                              Points Name / Reason <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[10px] text-gray-400 font-semibold">Custom name</span>
                          </div>
                          <input
                            id="quick-point-reason"
                            name="pointsCategoryReason"
                            type="text"
                            value={customCategoryVal}
                            onChange={(e) => setCustomCategoryVal(e.target.value)}
                            placeholder="Enter point name / reason (e.g. Sabaq, Homework, Takhteet)..."
                            className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-gray-200 bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-gray-400"
                          />
                        </div>

                        {/* Optional Teacher Note */}
                        <div>
                          <label htmlFor="quick-point-note" className="text-[11px] font-black uppercase tracking-wider text-gray-500 block mb-1.5">
                            Teacher Note <span className="text-gray-400 font-normal lowercase">(optional)</span>
                          </label>
                          <textarea
                            id="quick-point-note"
                            name="teacherRemarkNote"
                            rows={2}
                            value={customNote}
                            onChange={(e) => setCustomNote(e.target.value)}
                            placeholder="Add a remark visible in student's timeline..."
                            className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-gray-200 bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none resize-none transition-all placeholder:text-gray-400"
                          />
                        </div>

                        {/* Submit Button */}
                        <Button
                          disabled={
                            selectedStudents.size === 0 ||
                            awarding ||
                            !customCategoryVal.trim() ||
                            !customPointsVal ||
                            Number(customPointsVal) <= 0
                          }
                          onClick={() =>
                            executeAward({
                              category: customCategoryVal.trim(),
                              pointsChanged: Number(customPointsVal),
                              actionType: customActionType,
                              optionalNote: customNote.trim() || undefined,
                            })
                          }
                          className={`w-full py-3 rounded-2xl font-black text-xs shadow-lg transition-all active:scale-[0.98] ${
                            customActionType === "POSITIVE"
                              ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-stone-950 font-bold"
                              : "bg-rose-600 hover:bg-rose-700 text-white"
                          }`}
                        >
                          {awarding ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <Send className="w-3.5 h-3.5" />
                              Apply {customActionType === "POSITIVE" ? "+" : "-"}{customPointsVal || 0} Points to {selectedStudents.size} Talabat
                            </span>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ─────────────────────────────────────────────────────────────
                  5. RECENT ACTIVITY FEED (POINTS LOGS)
                 ───────────────────────────────────────────────────────────── */}
              <div className="p-1 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/10 shadow-sm">
                <div className="rounded-[calc(2rem-0.25rem)] bg-white p-5 space-y-3.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)]">
                  <div className="flex items-center justify-between">
                    <h3 className="font-black text-sm text-gray-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-emerald-700" />
                      Recent Point Activity
                    </h3>
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80">
                      Live Stream
                    </span>
                  </div>

                  {recentActivity.length > 0 ? (
                    <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                      {recentActivity.map((log) => {
                        const isPos = log.points > 0;
                        return (
                          <div
                            key={log.id}
                            className="p-3 rounded-2xl bg-gray-50/80 border border-gray-100 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Avatar className="w-8 h-8 shrink-0 ring-1 ring-gray-200">
                                {log.studentAvatar && (
                                  <AvatarImage
                                    src={log.studentAvatar}
                                    alt={log.studentName}
                                    className="object-contain object-center bg-[#0d0d0d]"
                                  />
                                )}
                                <AvatarFallback className="bg-emerald-100 text-emerald-900 text-[10px] font-black">
                                  {getInitials(log.studentName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-black text-gray-900 truncate leading-tight">
                                  {log.studentName}
                                </p>
                                <p className="text-[10.5px] text-gray-500 font-semibold truncate mt-0.5">
                                  {log.category}
                                </p>
                                {log.note && (
                                  <p className="text-[10px] text-gray-400 italic truncate mt-0.5">
                                    &ldquo;{log.note}&rdquo;
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`text-[11px] font-black font-mono ${
                                  isPos ? "text-emerald-700" : "text-rose-600"
                                }`}
                              >
                                {isPos ? `+${log.points}` : log.points} pts
                              </span>
                              <span className="block text-[9px] text-gray-400 font-medium">
                                {formatSmartTime(log.createdAt)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center py-6 text-xs text-gray-600 font-medium">
                      No points awarded yet today
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              6. TAKHTEET CURRICULUM BANNER & OVERVIEW
             ───────────────────────────────────────────────────────────── */}
          {can("takhteet") && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8"
            >
              <Link href="/teacher/takhteet">
                <div className="p-1 rounded-[2.2rem] bg-amber-950/5 ring-1 ring-amber-900/10 shadow-md hover:ring-amber-400/40 transition-all cursor-pointer group">
                  <div className="rounded-[calc(2.2rem-0.25rem)] bg-gradient-to-r from-emerald-50/50 via-white to-amber-50/40 p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                    <div className="flex items-center gap-4 sm:gap-5">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#0d0d0d] to-[#1c1813] border border-amber-400/30 flex items-center justify-center text-amber-300 shadow-lg shrink-0 group-hover:scale-105 transition-transform duration-300">
                        <ClipboardList className="w-7 h-7" strokeWidth={1.75} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300/80 shadow-2xs">
                            Curriculum Planner
                          </span>
                          <span className="text-xs text-gray-500 font-bold">
                            Sabaq & Portion Mastery
                          </span>
                        </div>
                        <h3 className="font-display font-black text-gray-900 text-lg sm:text-xl">
                          Takhteet Progress & Portions Overview
                        </h3>
                        <p className="text-xs text-slate-700 font-medium max-w-xl mt-0.5">
                          Monitor syllabus units, upcoming monthly milestones, and completed portions across your classes.
                        </p>
                      </div>
                    </div>

                    {takhteetLoading ? (
                      <div className="h-12 bg-gray-100 rounded-2xl animate-pulse w-full sm:w-72" />
                    ) : (
                      <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-8 w-full sm:w-auto shrink-0">
                        <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center w-full sm:w-auto">
                          <div>
                            <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">Portions</p>
                            <p className="text-base font-black text-gray-900 num-tabular">{takhteet.length}</p>
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-amber-950 uppercase tracking-wider">Due Month</p>
                            <p className="text-base font-black text-amber-900 num-tabular">
                              {takhteet.filter((p) => p.month === new Date().getMonth() + 1 && p.status !== "COMPLETED").length}
                            </p>
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-emerald-950 uppercase tracking-wider">Completed</p>
                            <p className="text-base font-black text-emerald-950 num-tabular">
                              {takhteet.filter((p) => p.status === "COMPLETED").length}
                            </p>
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-2 text-xs font-black text-amber-950 group-hover:translate-x-1 transition-transform">
                          <span>Open Planner</span>
                          <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          )}

    </div>
  );
}
