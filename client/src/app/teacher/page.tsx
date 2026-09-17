"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Award, Heart, Zap, Check, X, Undo2, AlertTriangle, TrendingUp,
  Search, Loader2, BookOpen, ClipboardList, CalendarDays, ChevronRight,
  Clock, Sparkles, CheckCircle2, ArrowRight, ShoppingBag, Filter,
  Layers, ShieldAlert, CheckSquare, Square, RotateCcw, Plus, Minus,
  Flame, BookCheck, GraduationCap, Send, ChevronDown, MessageSquare,
  Sparkle, UserCheck, UserX, Star, ArrowUpRight, ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { getInitials, formatPoints, formatSmartTime, getTierStyle } from "@/lib/utils";
import PortfolioView from "@/components/teacher/PortfolioView";
import { monthName } from "@/lib/takhteet";
import { usePortalAccess } from "@/context/PortalAccessContext";

interface QuickActionPreset {
  id: string;
  label: string;
  category: string;
  points: number;
  type: "POSITIVE" | "NEGATIVE";
  color: string;
  badgeColor: string;
  icon: any;
  description: string;
}

const quickActionPresets: QuickActionPreset[] = [
  {
    id: "excellence",
    label: "Academic Excellence",
    category: "Academic Excellence",
    points: 15,
    type: "POSITIVE",
    color: "bg-emerald-50/80 text-emerald-950 border-emerald-200/90 hover:bg-emerald-100 hover:border-emerald-400 hover:shadow-sm",
    badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold",
    icon: GraduationCap,
    description: "Exceptional mastery or test scores",
  },
  {
    id: "hifz",
    label: "Hifz & Daur Revision",
    category: "Hifz & Daur Revision",
    points: 20,
    type: "POSITIVE",
    color: "bg-amber-50/80 text-amber-950 border-amber-200/90 hover:bg-amber-100 hover:border-amber-400 hover:shadow-sm",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
    icon: BookCheck,
    description: "Outstanding Quran recitation & sabaq",
  },
  {
    id: "akhlaq",
    label: "Akhlaq & Adab",
    category: "Akhlaq & Adab",
    points: 15,
    type: "POSITIVE",
    color: "bg-teal-50/80 text-teal-950 border-teal-200/90 hover:bg-teal-100 hover:border-teal-400 hover:shadow-sm",
    badgeColor: "bg-teal-100 text-teal-900 border-teal-300 font-bold",
    icon: Heart,
    description: "Polite demeanor, respect & punctuality",
  },
  {
    id: "teamwork",
    label: "Ta'awun & Teamwork",
    category: "Ta'awun & Teamwork",
    points: 10,
    type: "POSITIVE",
    color: "bg-blue-50/80 text-blue-950 border-blue-200/90 hover:bg-blue-100 hover:border-blue-400 hover:shadow-sm",
    badgeColor: "bg-blue-100 text-blue-900 border-blue-300 font-bold",
    icon: Users,
    description: "Collaborative spirit and assisting peers",
  },
  {
    id: "leadership",
    label: "Khidmat & Leadership",
    category: "Khidmat & Leadership",
    points: 25,
    type: "POSITIVE",
    color: "bg-indigo-50/80 text-indigo-950 border-indigo-200/90 hover:bg-indigo-100 hover:border-indigo-400 hover:shadow-sm",
    badgeColor: "bg-indigo-100 text-indigo-900 border-indigo-300 font-bold",
    icon: Award,
    description: "Voluntary class khidmat and initiative",
  },
  {
    id: "critical",
    label: "Insightful Question",
    category: "Critical Thinking",
    points: 10,
    type: "POSITIVE",
    color: "bg-purple-50/80 text-purple-950 border-purple-200/90 hover:bg-purple-100 hover:border-purple-400 hover:shadow-sm",
    badgeColor: "bg-purple-100 text-purple-900 border-purple-300 font-bold",
    icon: Sparkles,
    description: "Inquisitive thinking and thoughtful questions",
  },
  {
    id: "late",
    label: "Late Arrival",
    category: "Late / Tardy",
    points: -5,
    type: "NEGATIVE",
    color: "bg-amber-50/50 text-amber-950 border-amber-200 hover:bg-amber-100/70 hover:border-amber-300",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-300 font-bold",
    icon: Clock,
    description: "Unexcused delay entering sabaq",
  },
  {
    id: "incomplete",
    label: "Incomplete Sabaq",
    category: "Incomplete Sabaq",
    points: -5,
    type: "NEGATIVE",
    color: "bg-rose-50/60 text-rose-950 border-rose-200 hover:bg-rose-100/70 hover:border-rose-300",
    badgeColor: "bg-rose-100 text-rose-900 border-rose-300 font-bold",
    icon: AlertTriangle,
    description: "Unprepared assignment or missing task",
  },
  {
    id: "distracting",
    label: "Distracting Peer",
    category: "Distracting Peer",
    points: -5,
    type: "NEGATIVE",
    color: "bg-red-50/70 text-red-950 border-red-200 hover:bg-red-100/80 hover:border-red-300",
    badgeColor: "bg-red-100 text-red-900 border-red-300 font-bold",
    icon: X,
    description: "Disrupting classroom focus",
  },
  {
    id: "offtask",
    label: "Off-Task Activity",
    category: "Off-Task",
    points: -3,
    type: "NEGATIVE",
    color: "bg-orange-50/60 text-orange-950 border-orange-200 hover:bg-orange-100/70 hover:border-orange-300",
    badgeColor: "bg-orange-100 text-orange-900 border-orange-300 font-bold",
    icon: ShieldAlert,
    description: "Engaging in unrelated activities",
  },
];

function getTierBadge(tier: string) {
  const variants: Record<string, "bronze" | "silver" | "gold" | "platinum" | "diamond"> = {
    BRONZE: "bronze",
    SILVER: "silver",
    GOLD: "gold",
    PLATINUM: "platinum",
    DIAMOND: "diamond",
  };
  return variants[tier?.toUpperCase()] ?? "bronze";
}

export default function ExpertTeacherDashboard() {
  const { isModuleVisible } = usePortalAccess();
  const can = (key: string) => isModuleVisible(key, "TEACHER");

  // Data state
  const [teacher, setTeacher] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [takhteet, setTakhteet] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [takhteetLoading, setTakhteetLoading] = useState(true);

  // Portfolio state
  const [portfolioEnabled, setPortfolioEnabled] = useState(false);
  const [portfolioMode, setPortfolioMode] = useState(false);
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  // Filters & Selection
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [attendanceFilter, setAttendanceFilter] = useState<"ALL" | "PRESENT" | "ABSENT">("ALL");
  const [tierFilter, setTierFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "points_desc" | "points_asc" | "attendance">("name");
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  // Quick-Point action state
  const [activeTab, setActiveTab] = useState<"presets" | "custom">("presets");
  const [customPointsVal, setCustomPointsVal] = useState<number>(10);
  const [customCategoryVal, setCustomCategoryVal] = useState<string>("Exemplary Khidmat");
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
        setPortfolioEnabled(Boolean(json.data.portfolioEnabled));

        if (json.data.portfolioEnabled) {
          const saved = localStorage.getItem("teacher_portfolio_mode");
          if (saved === "true") setPortfolioMode(true);
        }
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
        }
        setTakhteetLoading(false);
      })
      .catch(() => setTakhteetLoading(false));
  }, [loadDashboardData]);

  // Handle portfolio switch
  useEffect(() => {
    if (portfolioMode && portfolioEnabled && !portfolioData) {
      setPortfolioLoading(true);
      fetch("/api/teacher/portfolio")
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setPortfolioData(res.data);
          setPortfolioLoading(false);
        })
        .catch(() => setPortfolioLoading(false));
    }
  }, [portfolioMode, portfolioEnabled, portfolioData]);

  const togglePortfolioMode = () => {
    const next = !portfolioMode;
    setPortfolioMode(next);
    localStorage.setItem("teacher_portfolio_mode", String(next));
  };

  // Filter and sort students
  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (selectedClassId !== "ALL" && !s.classIds?.includes(selectedClassId)) {
          return false;
        }
        if (attendanceFilter === "PRESENT" && !s.isCheckedIn) return false;
        if (attendanceFilter === "ABSENT" && s.isCheckedIn) return false;
        if (tierFilter !== "ALL" && s.tier?.toUpperCase() !== tierFilter) return false;

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
  }, [students, selectedClassId, attendanceFilter, tierFilter, searchQuery, sortBy]);

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

  // Fast single-student instant reward (+10 Merit)
  const handleQuickAwardSingle = async (e: React.MouseEvent, studentId: string) => {
    e.stopPropagation();
    if (awarding) return;
    setAwarding(true);

    try {
      const res = await fetch("/api/points", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: [studentId],
          actionType: "POSITIVE",
          category: "Exemplary Sabaq & Adab",
          pointsChanged: 10,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setLastLogIds(data.data.map((l: any) => l.id));
        setLastAction(`+10 pts awarded for "Exemplary Sabaq & Adab"`);
        setShowUndo(true);
        setTimeout(() => setShowUndo(false), 9000);
        await loadDashboardData();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAwarding(false);
    }
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* ─────────────────────────────────────────────────────────────
          1. DOUBLE-BEZEL ROYAL FATIMI COMMAND HERO
         ───────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="p-1.5 sm:p-2 rounded-[2.5rem] bg-emerald-950/20 ring-1 ring-emerald-900/30 shadow-2xl"
      >
        <div
          className="relative overflow-hidden rounded-[2.2rem] p-6 sm:p-9 text-white"
          style={{
            background: "linear-gradient(135deg, #011f18 0%, #022c22 40%, #064e3b 75%, #047857 100%)",
            boxShadow: "inset 0 1px 1px rgba(255, 255, 255, 0.25), 0 20px 40px -15px rgba(2, 44, 34, 0.5)",
          }}
        >
          {/* Subtle Ambient Radial Lighting */}
          <div
            className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#ffe082]/10 blur-3xl pointer-events-none"
          />
          <div
            className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none"
          />

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Faculty Identity Profile Tile */}
            <div className="flex items-center gap-4 sm:gap-6">
              <div className="relative shrink-0">
                <div className="p-1 rounded-full bg-gradient-to-br from-[#ffe082] via-emerald-400 to-[#ffe082]/40 shadow-xl">
                  <Avatar className="w-16 h-16 sm:w-20 sm:h-20 ring-2 ring-emerald-950 bg-emerald-950">
                    {teacher?.avatarUrl && (
                      <AvatarImage
                        src={teacher.avatarUrl}
                        alt={teacher ? `${teacher.firstName} ${teacher.lastName}` : "Faculty"}
                        className="object-cover object-top"
                      />
                    )}
                    <AvatarFallback className="bg-gradient-to-br from-[#065f46] to-[#011f18] text-[#ffe082] text-xl sm:text-2xl font-bold font-display">
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
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] px-3 py-0.5 rounded-full bg-emerald-900/90 text-[#ffe082] border border-[#ffe082]/40 flex items-center gap-1.5 shadow-xs">
                    <Sparkles className="w-3 h-3 text-[#ffe082]" />
                    Faculty Command Console
                  </span>
                  {teacher?.its && (
                    <span className="text-[10.5px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-200 border border-emerald-600/40">
                      ITS: {teacher.its}
                    </span>
                  )}
                  {teacher?.khidmatMauze && (
                    <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-full bg-amber-950/60 text-amber-200 border border-amber-500/40">
                      {teacher.khidmatMauze}
                    </span>
                  )}
                </div>

                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                  {teacher ? `${teacher.firstName} ${teacher.lastName}` : "Teacher Dashboard"}
                </h1>

                <p className="text-xs sm:text-sm text-emerald-100/90 mt-1 flex items-center gap-2.5 font-medium">
                  <span>{teacher?.department || "Darse Burhani Academic Faculty"}</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-amber-200/95 font-semibold">
                    {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </p>
              </div>
            </div>

            {/* Action Island: Nested Button-in-Button Architecture */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {portfolioEnabled && (
                <button
                  onClick={togglePortfolioMode}
                  className={`group relative inline-flex h-11 w-[200px] items-center rounded-full transition-all duration-300 focus:outline-none ring-1 ring-white/20 p-1 shadow-inner ${
                    portfolioMode
                      ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white"
                      : "bg-emerald-950/90 text-emerald-200 hover:bg-emerald-900"
                  }`}
                >
                  <span className="flex items-center gap-1.5 px-3 text-xs font-bold">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </span>
                  <span
                    className={`absolute right-1 flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-900 shadow-md transition-all duration-300 ${
                      portfolioMode ? "-translate-x-[102px] text-indigo-900" : "translate-x-0"
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                  </span>
                  <span className="flex items-center gap-1.5 px-3 text-xs font-bold ml-auto">
                    <span>Portfolio</span>
                  </span>
                </button>
              )}

              {can("classes") && (
                <Link href="/teacher/classes" className="group">
                  <button className="h-11 px-5 rounded-full bg-[#ffe082] hover:bg-[#ffd54f] text-emerald-950 font-black text-xs transition-all duration-200 flex items-center gap-3 shadow-lg hover:shadow-xl active:scale-[0.98]">
                    <span>Take Attendance</span>
                    <span className="w-7 h-7 rounded-full bg-emerald-950/10 flex items-center justify-center transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-950" />
                    </span>
                  </button>
                </Link>
              )}

              {can("takhteet") && (
                <Link href="/teacher/takhteet" className="group">
                  <button className="h-11 px-4 rounded-full bg-emerald-950/60 hover:bg-emerald-900 text-emerald-100 border border-emerald-500/40 font-bold text-xs transition-all duration-200 flex items-center gap-2.5 active:scale-[0.98]">
                    <span>Takhteet Plan</span>
                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                      <ClipboardList className="w-3.5 h-3.5 text-amber-300" />
                    </span>
                  </button>
                </Link>
              )}

              {can("procurement") && (
                <Link href="/teacher/procurement" className="group">
                  <button className="h-11 px-4 rounded-full bg-emerald-950/60 hover:bg-emerald-900 text-emerald-100 border border-emerald-500/40 font-bold text-xs transition-all duration-200 flex items-center gap-2.5 active:scale-[0.98]">
                    <span>Procurement</span>
                    <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
                      <ShoppingBag className="w-3.5 h-3.5 text-teal-300" />
                    </span>
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─────────────────────────────────────────────────────────────
          PORTFOLIO MODE SWITCH
         ───────────────────────────────────────────────────────────── */}
      {portfolioMode ? (
        portfolioLoading ? (
          <div className="flex items-center justify-center py-28">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-600" />
          </div>
        ) : portfolioData?.classes ? (
          <PortfolioView data={portfolioData} />
        ) : (
          <div className="p-1 rounded-[2rem] bg-gray-100 ring-1 ring-gray-200">
            <div className="rounded-[calc(2rem-0.25rem)] bg-white p-16 text-center">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-40 text-emerald-600" />
              <p className="text-base font-bold text-gray-700">No portfolio data available for your account</p>
            </div>
          </div>
        )
      ) : (
        <>
          {/* ─────────────────────────────────────────────────────────────
              2. MACHINED HUD METRICS BENTO (DOUBLE-BEZEL)
             ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {/* Card 1: Total Talabat */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-1 rounded-3xl bg-emerald-950/5 ring-1 ring-emerald-900/10 shadow-xs"
            >
              <div className="rounded-[calc(1.5rem-0.25rem)] bg-white p-4 sm:p-5 flex items-center gap-4 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)]">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#047857] border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-xs">
                  <Users className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.16em]">Total Enrolled</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-gray-900 num-tabular tracking-tight">
                      {loading ? "..." : students.length}
                    </span>
                    <span className="text-xs text-gray-500 font-bold">Talabat</span>
                  </div>
                  <p className="text-[10.5px] text-emerald-700 font-bold truncate mt-0.5">
                    Across {classes.length} active classes
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
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.16em]">Today&apos;s Presence</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-emerald-800 num-tabular tracking-tight">
                      {loading ? "..." : stats?.presentToday || 0}
                    </span>
                    <span className="text-xs text-gray-500 font-bold">
                      / {stats?.totalStudents || students.length || 0}
                    </span>
                  </div>
                  <div className="w-full bg-emerald-100/80 h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
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
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.16em]">Merit Points Today</p>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-2xl sm:text-3xl font-black text-amber-800 num-tabular tracking-tight">
                      +{loading ? "..." : stats?.pointsToday || 0}
                    </span>
                    <span className="text-xs text-amber-700 font-bold">pts</span>
                  </div>
                  <p className="text-[10.5px] text-gray-500 font-semibold truncate mt-0.5">
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
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.16em]">Takhteet Portions</p>
                        <ArrowUpRight className="w-4 h-4 text-purple-400 group-hover:text-purple-600 transition-colors" />
                      </div>
                      <div className="flex items-baseline gap-1.5 mt-0.5">
                        <span className="text-2xl sm:text-3xl font-black text-purple-900 num-tabular tracking-tight">
                          {takhteet.length}
                        </span>
                        <span className="text-xs text-gray-500 font-bold">Portions</span>
                      </div>
                      <p className="text-[10.5px] text-purple-700 font-bold truncate mt-0.5">
                        {takhteet.filter((p) => p.status === "COMPLETED").length} completed
                      </p>
                    </div>
                  </div>
                </motion.div>
              </Link>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-1 rounded-3xl bg-blue-950/5 ring-1 ring-blue-900/10 shadow-xs"
              >
                <div className="rounded-[calc(1.5rem-0.25rem)] bg-white p-4 sm:p-5 flex items-center gap-4 h-full shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)]">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-800 border border-blue-200/80 flex items-center justify-center shrink-0 shadow-xs">
                    <Award className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.16em]">Assigned Classes</p>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-2xl sm:text-3xl font-black text-blue-900 num-tabular tracking-tight">
                        {classes.length}
                      </span>
                      <span className="text-xs text-gray-500 font-bold">Sections</span>
                    </div>
                    <p className="text-[10.5px] text-blue-700 font-bold truncate mt-0.5">
                      Active teaching sessions
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* ─────────────────────────────────────────────────────────────
              3. DOUBLE-BEZEL CLASS SWITCHER & SMART FILTER CLUSTER
             ───────────────────────────────────────────────────────────── */}
          <div className="p-1.5 rounded-[2rem] bg-emerald-950/5 ring-1 ring-emerald-900/10 shadow-sm">
            <div className="rounded-[calc(2rem-0.375rem)] bg-white p-4 sm:p-6 space-y-4">
              {/* Class Tabs Pill Bar */}
              <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none border-b border-gray-100">
                <span className="text-xs font-black text-gray-500 uppercase tracking-[0.12em] shrink-0 mr-1 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                  Classes:
                </span>

                <button
                  onClick={() => setSelectedClassId("ALL")}
                  className={`px-4 py-2 rounded-full text-xs font-black transition-all shrink-0 flex items-center gap-2 ${
                    selectedClassId === "ALL"
                      ? "bg-[#047857] text-white shadow-md ring-2 ring-emerald-600/30"
                      : "bg-gray-100 text-gray-700 hover:bg-emerald-50 hover:text-emerald-800"
                  }`}
                >
                  <span>All Talabat</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      selectedClassId === "ALL" ? "bg-emerald-900 text-emerald-100" : "bg-gray-200 text-gray-700"
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
                          ? "bg-[#047857] text-white shadow-md ring-2 ring-emerald-600/30"
                          : "bg-gray-100 text-gray-700 hover:bg-emerald-50 hover:text-emerald-800"
                      }`}
                    >
                      <span>{cls.name}</span>
                      {cls.subject && <span className="opacity-75 font-normal text-[11px]">({cls.subject})</span>}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          isSelected ? "bg-emerald-900 text-emerald-100" : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {cls.studentCount || 0}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Instant Search Bar & Filter Toolset */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
                <div className="flex-1 flex flex-wrap items-center gap-2.5">
                  {/* Search Input */}
                  <div className="relative min-w-[240px] flex-1 sm:flex-initial">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by name, ITS, grade..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-8 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/70 text-xs font-semibold focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Attendance Presence Filter Pill */}
                  <div className="flex items-center rounded-2xl bg-gray-100 p-1 text-xs font-bold">
                    <button
                      onClick={() => setAttendanceFilter("ALL")}
                      className={`px-3 py-1.5 rounded-xl transition-all ${
                        attendanceFilter === "ALL" ? "bg-white text-gray-900 shadow-xs" : "text-gray-500 hover:text-gray-900"
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

                  {/* Tier Filter */}
                  <select
                    value={tierFilter}
                    onChange={(e) => setTierFilter(e.target.value)}
                    className="px-3.5 py-2.5 rounded-2xl border border-gray-200 bg-gray-50/70 text-xs font-bold text-gray-700 focus:border-emerald-500 outline-none"
                  >
                    <option value="ALL">All Tiers</option>
                    <option value="DIAMOND">💎 Diamond</option>
                    <option value="PLATINUM">✨ Platinum</option>
                    <option value="GOLD">🥇 Gold</option>
                    <option value="SILVER">🥈 Silver</option>
                    <option value="BRONZE">🥉 Bronze</option>
                  </select>

                  {/* Sort Order */}
                  <select
                    value={sortBy}
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
                <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0">
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

          {/* ─────────────────────────────────────────────────────────────
              4. MAIN INTERACTIVE WORKSPACE: ROSTER + QUICK MODIFIER DECK
             ───────────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
            {/* Left Col: Interactive Talabat Grid (8 cols) */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2.5">
                  <h2 className="font-display text-lg font-black text-gray-900 flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-700" />
                    Talabat Roster
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
                            ? "border-emerald-600 bg-emerald-50/80 shadow-lg ring-4 ring-emerald-500/20"
                            : "border-gray-200/90 bg-white hover:border-emerald-300 hover:shadow-md"
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
                                  className="object-cover object-top"
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

                          {/* Streak Flame Badge */}
                          {student.streakDays > 0 && (
                            <div
                              title={`${student.streakDays} days active streak`}
                              className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full flex items-center shadow-xs"
                            >
                              <Flame className="w-2.5 h-2.5 mr-0.5 fill-current" />
                              {student.streakDays}
                            </div>
                          )}
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

                        {/* Points & Tier Badge */}
                        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-gray-100 w-full justify-center">
                          <span className="text-xs font-black text-emerald-950 font-mono">
                            {formatPoints(student.currentPoints)} <span className="text-[9px] font-bold text-gray-500">PTS</span>
                          </span>
                          <Badge
                            variant={getTierBadge(student.tier)}
                            className="text-[9px] px-1.5 py-0 font-black uppercase tracking-wider"
                          >
                            {student.tier}
                          </Badge>
                        </div>

                        {/* Instant 1-Click +10 Quick Reward (Hover trigger) */}
                        <button
                          type="button"
                          onClick={(e) => handleQuickAwardSingle(e, student.id)}
                          title="Quick +10 Points"
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-2 text-[10px] font-black px-2.5 py-1 rounded-full bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 flex items-center gap-1 shadow-xs"
                        >
                          <Plus className="w-3 h-3" />
                          +10 Quick Merit
                        </button>
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
                        setTierFilter("ALL");
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
              <div className="p-1 rounded-[2.2rem] bg-emerald-950/10 ring-1 ring-emerald-900/20 shadow-xl sticky top-24">
                <div className="rounded-[calc(2.2rem-0.25rem)] bg-white overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.9)]">
                  {/* Console Header Crown */}
                  <div className="bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white p-5">
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
                    {/* Console Tabs: Fast Presets vs Custom Modifier */}
                    <div className="flex items-center rounded-2xl bg-gray-100 p-1 text-xs font-black">
                      <button
                        onClick={() => setActiveTab("presets")}
                        className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                          activeTab === "presets"
                            ? "bg-white text-emerald-950 shadow-sm"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        <Sparkle className="w-3.5 h-3.5 text-amber-500" />
                        Fast Presets
                      </button>
                      <button
                        onClick={() => setActiveTab("custom")}
                        className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                          activeTab === "custom"
                            ? "bg-white text-emerald-950 shadow-sm"
                            : "text-gray-500 hover:text-gray-900"
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 text-teal-600" />
                        Custom Award
                      </button>
                    </div>

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

                    {/* TAB 1: FAST PRESETS */}
                    {activeTab === "presets" && (
                      <div className="space-y-4">
                        {/* Positive Presets */}
                        <div>
                          <span className="text-[10px] font-black text-emerald-900 uppercase tracking-[0.16em] flex items-center gap-1.5 mb-2">
                            <Star className="w-3 h-3 fill-emerald-600 text-emerald-600" />
                            Merit & Akhlaq Awards
                          </span>
                          <div className="grid grid-cols-1 gap-2">
                            {quickActionPresets
                              .filter((a) => a.type === "POSITIVE")
                              .map((preset) => {
                                const Icon = preset.icon;
                                const disabled = selectedStudents.size === 0 || awarding;
                                return (
                                  <motion.button
                                    key={preset.id}
                                    whileHover={!disabled ? { x: 3 } : {}}
                                    whileTap={!disabled ? { scale: 0.98 } : {}}
                                    disabled={disabled}
                                    onClick={() =>
                                      executeAward({
                                        category: preset.category,
                                        pointsChanged: preset.points,
                                        actionType: "POSITIVE",
                                      })
                                    }
                                    className={`w-full text-left p-2.5 rounded-2xl border transition-all flex items-center justify-between ${
                                      disabled
                                        ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400"
                                        : preset.color
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-xl bg-white shadow-xs flex items-center justify-center shrink-0">
                                        <Icon className="w-4 h-4 text-emerald-800" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-black leading-tight">{preset.label}</p>
                                        <p className="text-[10px] opacity-80">{preset.description}</p>
                                      </div>
                                    </div>
                                    <span
                                      className={`text-xs font-black px-2.5 py-0.5 rounded-xl border shrink-0 ${preset.badgeColor}`}
                                    >
                                      +{preset.points}
                                    </span>
                                  </motion.button>
                                );
                              })}
                          </div>
                        </div>

                        {/* Constructive / Negative Presets */}
                        <div className="pt-2 border-t border-gray-100">
                          <span className="text-[10px] font-black text-rose-900 uppercase tracking-[0.16em] mb-2 block flex items-center gap-1.5">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Classroom Focus Corrections
                          </span>
                          <div className="grid grid-cols-1 gap-2">
                            {quickActionPresets
                              .filter((a) => a.type === "NEGATIVE")
                              .map((preset) => {
                                const Icon = preset.icon;
                                const disabled = selectedStudents.size === 0 || awarding;
                                return (
                                  <motion.button
                                    key={preset.id}
                                    whileHover={!disabled ? { x: 3 } : {}}
                                    whileTap={!disabled ? { scale: 0.98 } : {}}
                                    disabled={disabled}
                                    onClick={() =>
                                      executeAward({
                                        category: preset.category,
                                        pointsChanged: Math.abs(preset.points),
                                        actionType: "NEGATIVE",
                                      })
                                    }
                                    className={`w-full text-left p-2.5 rounded-2xl border transition-all flex items-center justify-between ${
                                      disabled
                                        ? "opacity-50 cursor-not-allowed bg-gray-50 border-gray-200 text-gray-400"
                                        : preset.color
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-xl bg-white shadow-xs flex items-center justify-center shrink-0">
                                        <Icon className="w-4 h-4 text-rose-800" />
                                      </div>
                                      <div>
                                        <p className="text-xs font-black leading-tight">{preset.label}</p>
                                        <p className="text-[10px] opacity-80">{preset.description}</p>
                                      </div>
                                    </div>
                                    <span
                                      className={`text-xs font-black px-2.5 py-0.5 rounded-xl border shrink-0 ${preset.badgeColor}`}
                                    >
                                      {preset.points}
                                    </span>
                                  </motion.button>
                                );
                              })}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* TAB 2: CUSTOM MODIFIER */}
                    {activeTab === "custom" && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-black text-gray-800 block mb-1.5">
                            Award Type & Point Value
                          </label>
                          <div className="grid grid-cols-2 gap-2 mb-2.5">
                            <button
                              type="button"
                              onClick={() => setCustomActionType("POSITIVE")}
                              className={`p-2.5 rounded-2xl text-xs font-black border transition-all flex items-center justify-center gap-1.5 ${
                                customActionType === "POSITIVE"
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                                  : "bg-gray-50 text-gray-600 border-gray-200"
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
                                  : "bg-gray-50 text-gray-600 border-gray-200"
                              }`}
                            >
                              <Minus className="w-3.5 h-3.5" />
                              Demerit (-)
                            </button>
                          </div>

                          {/* Numeric Stepper */}
                          <div className="flex items-center justify-between border border-gray-200 rounded-2xl p-2.5 bg-gray-50/80">
                            <button
                              type="button"
                              onClick={() => setCustomPointsVal((v) => Math.max(1, v - 5))}
                              className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-black text-gray-700 hover:bg-gray-100 active:scale-95 shadow-xs"
                            >
                              -5
                            </button>
                            <div className="text-center">
                              <span className="text-2xl font-black text-gray-900 font-mono tracking-tight">
                                {customActionType === "POSITIVE" ? "+" : "-"}
                                {customPointsVal}
                              </span>
                              <span className="text-[9.5px] font-black text-gray-500 uppercase block tracking-wider">POINTS</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setCustomPointsVal((v) => v + 5)}
                              className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center font-black text-gray-700 hover:bg-gray-100 active:scale-95 shadow-xs"
                            >
                              +5
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-black text-gray-800 block mb-1">
                            Category / Reason
                          </label>
                          <input
                            type="text"
                            value={customCategoryVal}
                            onChange={(e) => setCustomCategoryVal(e.target.value)}
                            placeholder="e.g. Takhteet Milestone Completed"
                            className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-gray-200 bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-black text-gray-800 block mb-1">
                            Teacher Note (Optional)
                          </label>
                          <textarea
                            rows={2}
                            value={customNote}
                            onChange={(e) => setCustomNote(e.target.value)}
                            placeholder="Add a remark visible in student's timeline..."
                            className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-2xl border border-gray-200 bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none resize-none"
                          />
                        </div>

                        <Button
                          disabled={selectedStudents.size === 0 || awarding || !customCategoryVal.trim()}
                          onClick={() =>
                            executeAward({
                              category: customCategoryVal,
                              pointsChanged: customPointsVal,
                              actionType: customActionType,
                              optionalNote: customNote,
                            })
                          }
                          className={`w-full py-3 rounded-2xl font-black text-xs shadow-lg transition-all active:scale-[0.98] ${
                            customActionType === "POSITIVE"
                              ? "bg-[#047857] hover:bg-[#065f46] text-white"
                              : "bg-rose-600 hover:bg-rose-700 text-white"
                          }`}
                        >
                          {awarding ? (
                            <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                          ) : (
                            <span className="flex items-center justify-center gap-2">
                              <Send className="w-3.5 h-3.5" />
                              Apply to {selectedStudents.size} Talabat
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
                                    className="object-cover object-top"
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
                    <p className="text-center py-6 text-xs text-gray-400 font-medium">
                      No points awarded yet today
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

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
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#011f18] to-[#047857] flex items-center justify-center text-[#ffe082] shadow-lg shrink-0 group-hover:scale-105 transition-transform duration-300">
                        <ClipboardList className="w-7 h-7" />
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
                        <p className="text-xs text-gray-600 max-w-xl mt-0.5">
                          Monitor syllabus units, upcoming monthly milestones, and completed portions across your classes.
                        </p>
                      </div>
                    </div>

                    {takhteetLoading ? (
                      <div className="h-12 bg-gray-100 rounded-2xl animate-pulse w-72" />
                    ) : (
                      <div className="flex items-center gap-8 shrink-0">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Portions</p>
                            <p className="text-base font-black text-gray-900 num-tabular">{takhteet.length}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Due Month</p>
                            <p className="text-base font-black text-amber-700 num-tabular">
                              {takhteet.filter((p) => p.month === new Date().getMonth() + 1 && p.status !== "COMPLETED").length}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Completed</p>
                            <p className="text-base font-black text-emerald-800 num-tabular">
                              {takhteet.filter((p) => p.status === "COMPLETED").length}
                            </p>
                          </div>
                        </div>

                        <div className="hidden sm:flex items-center gap-2 text-xs font-black text-[#047857] group-hover:translate-x-1 transition-transform">
                          <span>Open Planner</span>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              7. FLOATING UNDO ACTION TOAST
             ───────────────────────────────────────────────────────────── */}
          <AnimatePresence>
            {showUndo && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                className="fixed bottom-6 right-6 z-50 bg-gray-950 text-white px-5 py-4 rounded-3xl shadow-2xl flex items-center gap-4 border border-amber-500/30 backdrop-blur-md"
              >
                <div className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4" />
                </div>
                <div className="max-w-xs">
                  <p className="text-xs font-black text-white leading-tight">{lastAction}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Mistake? Tap undo to revert points.</p>
                </div>
                <button
                  onClick={handleUndo}
                  className="px-3.5 py-1.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-amber-950 text-xs font-black transition-colors flex items-center gap-1.5 shrink-0 shadow-sm active:scale-95"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Undo
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
