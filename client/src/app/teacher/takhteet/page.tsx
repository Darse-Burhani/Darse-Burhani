"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  ClipboardList,
  Loader2,
  CalendarDays,
  Pencil,
  History,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
  RotateCcw,
  Sparkles,
  BookOpen,
  CheckSquare,
  Square,
  Layers,
  LayoutGrid,
  Calendar,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FastForward,
  Check,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { monthName, statusMeta } from "@/lib/takhteet";
import { TakhteetUpdateModal } from "@/components/takhteet/TakhteetUpdateModal";

export default function TeacherTakhteetPage() {
  const { data: session } = useSession();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<{ assignedCount: number; totalCount: number; isShowingAll: boolean }>({
    assignedCount: 0,
    totalCount: 0,
    isShowingAll: false,
  });
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [filterClass, setFilterClass] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const [updatingPlan, setUpdatingPlan] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [quickUpdatingId, setQuickUpdatingId] = useState<string | null>(null);

  // Interactive View Modes & Batch Selection State
  const [viewMode, setViewMode] = useState<"CARDS" | "ROADMAP">("CARDS");
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<number>>(new Set([new Date().getMonth() + 1]));
  const [hoverSlider, setHoverSlider] = useState<{ planId: string; percent: number } | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Strictly loads portions assigned to the authenticated teacher only
      const res = await fetch(`/api/teacher/takhteet?_t=${Date.now()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPlans(data.data);
        if (data.meta) {
          setMeta(data.meta);
        }
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to load assigned Takhteet." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const subjectParam = params.get("subject");
      const classParam = params.get("class");
      if (subjectParam && subjectParam !== "Darajah Core Curriculum" && subjectParam !== "General") {
        setFilterSubject(subjectParam);
      }
      if (classParam) setFilterClass(classParam);
    }
    fetchData();
  }, []);

  const currentMonth = new Date().getMonth() + 1;

  // Derive unique filter options from plans
  const uniqueSubjects = useMemo(() => {
    const set = new Set<string>();
    plans.forEach((p) => {
      if (p.subject) set.add(p.subject);
    });
    return Array.from(set).sort();
  }, [plans]);

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    plans.forEach((p) => {
      if (p.className) set.add(p.className);
    });
    return Array.from(set).sort();
  }, [plans]);

  const uniqueMonths = useMemo(() => {
    const set = new Set<number>();
    plans.forEach((p) => {
      if (typeof p.month === "number") set.add(p.month);
    });
    return Array.from(set).sort((a, b) => a - b);
  }, [plans]);

  const classCounts = useMemo(() => {
    const map = new Map<string, number>();
    plans.forEach((p) => {
      if (p.className) map.set(p.className, (map.get(p.className) || 0) + 1);
    });
    return map;
  }, [plans]);

  const subjectCounts = useMemo(() => {
    const map = new Map<string, number>();
    plans.forEach((p) => {
      if (p.subject) map.set(p.subject, (map.get(p.subject) || 0) + 1);
    });
    return map;
  }, [plans]);

  const stats = useMemo(() => {
    const pending = plans.filter((p) => p.status === "PENDING").length;
    const inProgress = plans.filter((p) => p.status === "IN_PROGRESS").length;
    const completed = plans.filter((p) => p.status === "COMPLETED").length;
    const overdue = plans.filter((p) => p.month && p.month < currentMonth && p.status !== "COMPLETED").length;
    const avg = plans.length ? Math.round(plans.reduce((a, p) => a + (p.progress || 0), 0) / plans.length) : 0;
    return { total: plans.length, pending, inProgress, completed, overdue, avg };
  }, [plans, currentMonth]);

  const currentPlans = useMemo(() => {
    return plans.filter(
      (p) => p.status !== "COMPLETED" && (!p.month || p.month === currentMonth)
    );
  }, [plans, currentMonth]);

  // Apply filters & search
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterSubject && filterSubject !== "ALL" && filterSubject !== "Darajah Core Curriculum" && filterSubject !== "General") {
        const cleanSubj = filterSubject.toLowerCase().trim();
        const pSubj = (p.subject || "").toLowerCase().trim();
        if (pSubj !== cleanSubj && !pSubj.includes(cleanSubj) && !cleanSubj.includes(pSubj)) return false;
      }
      if (filterClass && filterClass !== "ALL") {
        const cleanCls = filterClass.toLowerCase().trim();
        const pCls = (p.className || "").toLowerCase().trim();
        if (!pCls.includes(cleanCls) && cleanCls !== pCls) return false;
      }
      if (filterMonth && String(p.month) !== String(filterMonth)) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const t = (p.title || "").toLowerCase();
        const d = (p.description || "").toLowerCase();
        const s = (p.subject || "").toLowerCase();
        const c = (p.className || "").toLowerCase();
        if (!t.includes(q) && !d.includes(q) && !s.includes(q) && !c.includes(q)) return false;
      }
      return true;
    });
  }, [plans, filterStatus, filterSubject, filterClass, filterMonth, search]);

  // Reset to first page when filter criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, filterSubject, filterClass, filterMonth, search]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / pageSize));
  const paginatedPlans = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPlans.slice(start, start + pageSize);
  }, [filteredPlans, currentPage, pageSize]);

  const hasActiveFilters = Boolean(filterStatus || filterSubject || filterClass || filterMonth || search.trim());

  const resetAllFilters = () => {
    setFilterStatus("");
    setFilterSubject("");
    setFilterClass("");
    setFilterMonth("");
    setSearch("");
  };

  const openUpdateModal = (plan: any) => {
    setUpdatingPlan(plan);
  };

  const handleSaveModal = async (payload: { progress: number; status: string; note: string }) => {
    if (!updatingPlan) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teacher/takhteet/${updatingPlan.id}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        toast({ variant: "success", title: "Saved", description: "Progress updated successfully." });
        setUpdatingPlan(null);
        await fetchData();
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: data.error || "Failed to update progress." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Failed to update progress." });
    } finally {
      setSaving(false);
    }
  };

  // Direct quick progress increment (+5%, +10%, +25%, or 100% Mark Completed)
  const handleQuickProgress = async (plan: any, delta: number | "COMPLETED") => {
    setQuickUpdatingId(plan.id);
    try {
      let nextProgress = plan.progress;
      let nextStatus = plan.status;
      let note = "";

      if (delta === "COMPLETED") {
        nextProgress = 100;
        nextStatus = "COMPLETED";
        note = "Completed portion curriculum";
      } else {
        nextProgress = Math.min(100, Math.max(0, plan.progress + delta));
        nextStatus = nextProgress >= 100 ? "COMPLETED" : nextProgress > 0 ? "IN_PROGRESS" : "PENDING";
        const sign = delta > 0 ? `+${delta}%` : `${delta}%`;
        note = `Quick progress update (${sign} → ${nextProgress}%)`;
      }

      const res = await fetch(`/api/teacher/takhteet/${plan.id}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress: nextProgress, status: nextStatus, note }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          variant: "success",
          title: nextStatus === "COMPLETED" ? "Portion Completed!" : `Progress Updated (${nextProgress}%)`,
          description: plan.title,
        });
        await fetchData();
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Network error updating progress." });
    } finally {
      setQuickUpdatingId(null);
    }
  };

  // Direct scrubber percentage setter
  const handleDirectProgress = async (plan: any, progressValue: number) => {
    const clamped = Math.max(0, Math.min(100, Math.round(progressValue)));
    const nextStatus = clamped >= 100 ? "COMPLETED" : clamped > 0 ? "IN_PROGRESS" : "PENDING";
    setQuickUpdatingId(plan.id);
    try {
      const res = await fetch(`/api/teacher/takhteet/${plan.id}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progress: clamped,
          status: nextStatus,
          note: `Direct track set to ${clamped}%`,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          variant: "success",
          title: clamped === 100 ? "Portion Completed! 🎓" : `Progress Set: ${clamped}%`,
          description: plan.title,
        });
        await fetchData();
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Network error updating progress." });
    } finally {
      setQuickUpdatingId(null);
    }
  };

  // Batch actions
  const toggleSelectPlan = (id: string) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    if (selectedPlanIds.size === paginatedPlans.length) {
      setSelectedPlanIds(new Set());
    } else {
      setSelectedPlanIds(new Set(paginatedPlans.map((p) => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedPlanIds(new Set());
    setIsMultiSelectMode(false);
  };

  const toggleExpandLog = (id: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpandMonth = (m: number) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const handleBatchUpdate = async (options: { progress?: number; status?: string; note?: string }) => {
    if (selectedPlanIds.size === 0) return;
    setBatchProcessing(true);
    try {
      const res = await fetch("/api/teacher/takhteet/batch-progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planIds: Array.from(selectedPlanIds),
          ...options,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          variant: "success",
          title: "Batch Update Complete",
          description: `Updated ${data.data.updatedCount} portions successfully.`,
        });
        clearSelection();
        await fetchData();
      } else {
        toast({ variant: "destructive", title: "Batch Update Failed", description: data.error });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Network error during batch update." });
    } finally {
      setBatchProcessing(false);
    }
  };

  // Roadmap grouping by month
  const roadmapByMonth = useMemo(() => {
    const map = new Map<number, any[]>();
    for (let m = 1; m <= 12; m++) map.set(m, []);
    filteredPlans.forEach((p) => {
      const m = p.month || 0;
      if (map.has(m)) map.get(m)!.push(p);
      else map.set(m, [p]);
    });
    return map;
  }, [filteredPlans]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Banner */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="relative">
          <div className="fatimi-header-banner">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center fatimi-gold-accent shadow-md">
                  <ClipboardList className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 text-xs font-semibold uppercase tracking-wider mb-1">
                    <Sparkles className="w-3 h-3" />
                    Faculty Syllabus Telemetry
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    My Takhteet & Tafseel
                  </h1>
                  <p className="text-emerald-100/90 text-sm mt-0.5">
                    Portions assigned to your subjects — update student coverage, log notes, and track milestones.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                <Badge className="bg-white/15 text-white border-white/20 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                  {stats.total} Assigned Portions
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-200 border-emerald-400/30 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm">
                  {stats.avg}% Average Progress
                </Badge>
              </div>
            </div>
            <div
              className="absolute bottom-0 left-0 right-0 h-1"
              style={{ background: "linear-gradient(90deg, transparent, #d4af37, transparent)" }}
            />
          </div>
        </motion.div>

        {/* Overdue alert */}
        {!loading && stats.overdue > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="rounded-2xl border border-red-200 bg-red-50/90 dark:bg-red-950/40 p-4 flex items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                    You have {stats.overdue} overdue portion{stats.overdue === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Update current progress or mark completed to maintain curriculum timelines.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilterStatus("IN_PROGRESS")}
                className="border-red-300 text-red-700 hover:bg-red-100 text-xs shrink-0"
              >
                View In Progress
              </Button>
            </div>
          </motion.div>
        )}

        {/* Stats Grid */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="fatimi-card animate-pulse">
                <CardContent className="p-4 sm:p-5">
                  <div className="w-10 h-10 bg-gray-200 rounded-xl mb-3" />
                  <div className="w-16 h-4 bg-gray-200 rounded mb-2" />
                  <div className="w-10 h-7 bg-gray-200 rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {[
              { title: "Total Portions", value: stats.total, color: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 border-indigo-200" },
              { title: "Due This Month", value: currentPlans.length, color: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 border-amber-200" },
              { title: "In Progress", value: stats.inProgress, color: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 border-blue-200" },
              { title: "Completed", value: stats.completed, color: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 border-emerald-200" },
            ].map((stat) => (
              <Card key={stat.title} className="fatimi-card border hover:shadow-md transition">
                <CardContent className="p-5">
                  <div className={`p-2.5 rounded-xl w-fit ${stat.color} mb-3 border`}>
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-gray-500 font-medium">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        {/* ── Assigned Portions Info Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center gap-2 px-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-gray-900 dark:text-white">
              Assigned Curriculum Portions ({plans.length})
            </span>
          </div>
          <div className="text-xs text-gray-500 font-medium px-1">
            Displaying only curriculum portions officially assigned to your subjects and classes.
          </div>
        </div>

        {/* ── Interactive Class & Subject Quick Filter Chips ── */}
        {!loading && (
          <div className="space-y-2.5">
            {/* Class Chips */}
            {uniqueClasses.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 shrink-0 uppercase tracking-wider mr-1 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> Class:
                </span>
                <button
                  type="button"
                  onClick={() => setFilterClass("")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    !filterClass
                      ? "bg-slate-900 text-amber-300 shadow-sm"
                      : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50"
                  }`}
                >
                  All Classes ({plans.length})
                </button>
                {uniqueClasses.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFilterClass(filterClass === c ? "" : c)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterClass === c
                        ? "bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-400/50"
                        : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-emerald-50/50"
                    }`}
                  >
                    <span>{c}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        filterClass === c
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {classCounts.get(c) || 0}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Subject Chips */}
            {uniqueSubjects.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 shrink-0 uppercase tracking-wider mr-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Subject:
                </span>
                <button
                  type="button"
                  onClick={() => setFilterSubject("")}
                  className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    !filterSubject
                      ? "bg-slate-900 text-amber-300 shadow-sm"
                      : "bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50"
                  }`}
                >
                  All Subjects ({uniqueSubjects.length})
                </button>
                {uniqueSubjects.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilterSubject(filterSubject === s ? "" : s)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                      filterSubject === s
                        ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-300/50"
                        : "bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-slate-700 hover:bg-amber-50/50"
                    }`}
                  >
                    <span>{s}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                        filterSubject === s
                          ? "bg-white/20 text-white"
                          : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      {subjectCounts.get(s) || 0}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Search & Filter Controls Bar ── */}
        <Card className="fatimi-card border border-emerald-100 dark:border-emerald-900/40 shadow-sm p-4 sm:p-5">
          <div className="space-y-4">
            {/* Row 1: Search & Dropdown Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search portion, chapter, book..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="fatimi-input pl-9 pr-8 text-xs sm:text-sm w-full h-10 rounded-xl"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Subject Dropdown */}
              <div>
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="fatimi-input text-xs sm:text-sm w-full h-10 rounded-xl"
                >
                  <option value="">All Subjects ({uniqueSubjects.length})</option>
                  {uniqueSubjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Dropdown */}
              <div>
                <select
                  value={filterClass}
                  onChange={(e) => setFilterClass(e.target.value)}
                  className="fatimi-input text-xs sm:text-sm w-full h-10 rounded-xl"
                >
                  <option value="">All Classes ({uniqueClasses.length})</option>
                  {uniqueClasses.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Month Dropdown */}
              <div>
                <select
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="fatimi-input text-xs sm:text-sm w-full h-10 rounded-xl"
                >
                  <option value="">All Target Months</option>
                  {uniqueMonths.map((m) => (
                    <option key={m} value={String(m)}>
                      Month {m} ({monthName(m)})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: Status Pills & Reset */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: "", label: "All", count: stats.total },
                  { id: "PENDING", label: "Pending", count: stats.pending },
                  { id: "IN_PROGRESS", label: "In Progress", count: stats.inProgress },
                  { id: "COMPLETED", label: "Completed", count: stats.completed },
                ].map((s) => (
                  <Button
                    key={s.id}
                    variant={filterStatus === s.id ? "default" : "outline"}
                    size="sm"
                    className={`h-8 text-xs font-semibold rounded-lg px-3 ${
                      filterStatus === s.id
                        ? "fatimi-emerald-gradient text-white shadow-sm"
                        : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => setFilterStatus(s.id)}
                  >
                    {s.label} ({s.count})
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500 font-medium">
                  Showing <b>{filteredPlans.length}</b> of <b>{plans.length}</b> portions
                </span>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetAllFilters}
                    className="h-8 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg px-2.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Row 3: Interactive View Mode Switcher & Multi-Select Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                {/* View Mode Toggle */}
                <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl border border-gray-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setViewMode("CARDS")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      viewMode === "CARDS"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-gray-500 hover:text-gray-900 dark:text-gray-400"
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Cards View</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("ROADMAP")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      viewMode === "ROADMAP"
                        ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                        : "text-gray-500 hover:text-gray-900 dark:text-gray-400"
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-amber-600" />
                    <span>Monthly Roadmap</span>
                  </button>
                </div>
              </div>

              {/* Multi-Select Toggle */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsMultiSelectMode(!isMultiSelectMode);
                    if (isMultiSelectMode) setSelectedPlanIds(new Set());
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    isMultiSelectMode
                      ? "bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/40"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {isMultiSelectMode ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  <span>Batch Select {selectedPlanIds.size > 0 ? `(${selectedPlanIds.size})` : ""}</span>
                </button>

                {isMultiSelectMode && paginatedPlans.length > 0 && (
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-gray-50 hover:bg-gray-100 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    {selectedPlanIds.size === paginatedPlans.length ? "Deselect All" : `Select All Visible (${paginatedPlans.length})`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* ── Plans Card List ── */}
        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="fatimi-card animate-pulse p-6">
                <div className="w-2/3 h-5 bg-gray-200 rounded mb-3" />
                <div className="w-full h-3 bg-gray-200 rounded mb-2" />
                <div className="w-1/2 h-3 bg-gray-200 rounded" />
              </Card>
            ))}
          </div>
        ) : filteredPlans.length > 0 ? (
          <div className="space-y-4">
            {/* ── Helper Plan Card Component ── */}
            {(() => {
              const renderPlanCard = (p: any, i: number) => {
                const meta = statusMeta(p.status);
                const overdue = p.month && p.month < currentMonth && p.status !== "COMPLETED";
                const due = p.month === currentMonth && p.status !== "COMPLETED";
                const isQuickBusy = quickUpdatingId === p.id;
                const isSelected = selectedPlanIds.has(p.id);
                const isNotesExpanded = expandedLogIds.has(p.id);

                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(0.2, i * 0.02) }}
                  >
                    <Card
                      className={`fatimi-card border transition-all ${
                        isSelected
                          ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/20"
                          : overdue
                          ? "border-red-300 dark:border-red-900/60 bg-red-50/10"
                          : "border-gray-200 dark:border-slate-800 hover:shadow-md"
                      }`}
                    >
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          {/* Multi-Select Checkbox */}
                          {isMultiSelectMode && (
                            <div
                              onClick={() => toggleSelectPlan(p.id)}
                              className="cursor-pointer shrink-0 pt-1 lg:pt-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-emerald-600" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-300 hover:text-gray-500" />
                              )}
                            </div>
                          )}

                          {/* Left: Title, Badges, Class, Description */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <h3 className="font-bold text-gray-900 dark:text-white text-base leading-snug">
                                {p.title}
                              </h3>
                              <Badge variant="outline" className="text-xs font-semibold bg-emerald-50 text-emerald-800 border-emerald-200">
                                {p.subject}
                              </Badge>
                              <Badge className={`text-xs border ${meta.badge}`}>
                                {meta.label}
                              </Badge>
                              {overdue && (
                                <Badge variant="destructive" className="text-xs flex items-center gap-1 font-semibold">
                                  <AlertTriangle className="w-3 h-3" /> Overdue
                                </Badge>
                              )}
                              {due && (
                                <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200 flex items-center gap-1 font-semibold">
                                  <CalendarDays className="w-3 h-3" /> Due this month
                                </Badge>
                              )}
                            </div>

                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                              <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                              {p.className}
                            </p>

                            {p.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed bg-gray-50/80 dark:bg-slate-800/60 p-2 rounded-lg border border-gray-100 dark:border-slate-800">
                                {p.description}
                              </p>
                            )}

                            <div className="flex items-center gap-4 mt-2.5 text-xs text-gray-500 font-medium">
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3.5 h-3.5 text-gray-400" /> {p.academicYear}
                              </span>
                              <span className="flex items-center gap-1">
                                <CalendarDays className="w-3.5 h-3.5 text-gray-400" /> {monthName(p.month)}
                              </span>
                              {!p.month && <span>Full year</span>}
                            </div>
                          </div>

                          {/* Center: Interactive Scrubber Progress Bar & Quick Steppers */}
                          <div className="lg:w-80 shrink-0 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                                <span>Coverage Track</span>
                                <span className="text-[10px] text-gray-400 font-normal hidden sm:inline">(Click to jump)</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                                  {p.progress}%
                                </span>
                                {p.progress >= 100 && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                )}
                              </div>
                            </div>

                            {/* Interactive Clickable & Hover Progress Track */}
                            <div
                              className="relative h-4 rounded-full bg-emerald-100/60 dark:bg-slate-800 overflow-hidden border border-emerald-200/50 cursor-pointer group select-none transition-all hover:ring-2 hover:ring-amber-400/40"
                              onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const pct = Math.max(0, Math.min(100, Math.round((clickX / rect.width) * 100)));
                                handleDirectProgress(p, pct);
                              }}
                              onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const clickX = e.clientX - rect.left;
                                const pct = Math.max(0, Math.min(100, Math.round((clickX / rect.width) * 100)));
                                setHoverSlider({ planId: p.id, percent: pct });
                              }}
                              onMouseLeave={() => setHoverSlider(null)}
                              title="Click anywhere to jump to percentage"
                            >
                              <div
                                className={`h-full rounded-full ${meta.bar} transition-all duration-300`}
                                style={{ width: `${p.progress}%` }}
                              />
                              {/* Milestone tick marks at 25%, 50%, 75% */}
                              <div className="absolute inset-0 flex justify-between pointer-events-none px-2 items-center opacity-30 group-hover:opacity-75 transition-opacity">
                                <span className="w-0.5 h-1.5 bg-slate-500 rounded" />
                                <span className="w-0.5 h-1.5 bg-slate-500 rounded" />
                                <span className="w-0.5 h-1.5 bg-slate-500 rounded" />
                              </div>
                              {/* Live hover cursor and percentage tooltip */}
                              {hoverSlider && hoverSlider.planId === p.id && (
                                <div
                                  className="absolute top-0 bottom-0 w-0.5 bg-amber-500 pointer-events-none"
                                  style={{ left: `${hoverSlider.percent}%` }}
                                >
                                  <span className="absolute -top-6 -translate-x-1/2 bg-slate-900 text-amber-300 text-[10px] font-black px-1.5 py-0.5 rounded shadow pointer-events-none z-10 whitespace-nowrap">
                                    {hoverSlider.percent}%
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Tactile Quick Increment & Stepper buttons */}
                            <div className="flex items-center flex-wrap gap-1 pt-0.5">
                              {p.progress > 0 && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isQuickBusy}
                                  onClick={() => handleQuickProgress(p, -5)}
                                  className="h-6 px-1.5 text-[11px] font-bold border-gray-200 hover:bg-gray-100 text-gray-700 dark:border-slate-700 dark:text-gray-300 rounded-md cursor-pointer"
                                  title="Reduce -5%"
                                >
                                  -5%
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isQuickBusy || p.progress >= 100}
                                onClick={() => handleQuickProgress(p, 5)}
                                className="h-6 px-1.5 text-[11px] font-bold border-emerald-200 hover:bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300 rounded-md cursor-pointer"
                                title="Add +5%"
                              >
                                +5%
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isQuickBusy || p.progress >= 100}
                                onClick={() => handleQuickProgress(p, 10)}
                                className="h-6 px-2 text-[11px] font-bold border-gray-200 hover:bg-emerald-50 text-emerald-800 dark:border-slate-700 dark:text-emerald-400 rounded-md cursor-pointer"
                                title="Add +10%"
                              >
                                +10%
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isQuickBusy || p.progress >= 100}
                                onClick={() => handleQuickProgress(p, 25)}
                                className="h-6 px-2 text-[11px] font-bold border-gray-200 hover:bg-emerald-50 text-emerald-800 dark:border-slate-700 dark:text-emerald-400 rounded-md cursor-pointer"
                                title="Add +25%"
                              >
                                +25%
                              </Button>
                              {p.status !== "COMPLETED" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isQuickBusy}
                                  onClick={() => handleQuickProgress(p, "COMPLETED")}
                                  className="h-6 px-2 text-[11px] font-bold border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700 dark:text-emerald-300 rounded-md cursor-pointer"
                                  title="Mark 100% Complete"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-0.5 text-emerald-600 dark:text-emerald-400" />
                                  100%
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Right: Detailed Update Progress Modal Button & Notes Toggle */}
                          <div className="shrink-0 flex items-center gap-2 w-full lg:w-auto">
                            {p.logs && p.logs.length > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-9 px-2.5 rounded-xl border-gray-200 hover:bg-gray-50 flex items-center gap-1 cursor-pointer"
                                onClick={() => toggleExpandLog(p.id)}
                                title="Toggle Notes Drawer"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-amber-600" />
                                <span className="font-semibold">{p.logs.length}</span>
                                {isNotesExpanded ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                              </Button>
                            )}
                            <Button
                              variant="default"
                              size="sm"
                              className="fatimi-emerald-gradient text-white font-semibold text-xs h-9 px-3.5 rounded-xl shadow-sm w-full lg:w-auto justify-center flex items-center cursor-pointer"
                              onClick={() => openUpdateModal(p)}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1.5" />
                              Update Progress
                            </Button>
                          </div>
                        </div>

                        {/* Collapsible Recent Progress Notes Drawer */}
                        {isNotesExpanded && p.logs && p.logs.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 space-y-1.5"
                          >
                            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                              <History className="w-3 h-3 text-amber-600" />
                              Curriculum Log History
                            </p>
                            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                              {p.logs.map((log: any) => (
                                <div key={log.id} className="p-2 rounded-lg bg-gray-50 dark:bg-slate-800 text-xs flex flex-wrap items-center justify-between gap-2 border border-gray-100 dark:border-slate-700">
                                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                                    {log.progressBefore}% → {log.progressAfter}% ({log.status})
                                  </span>
                                  <span className="text-[11px] text-gray-400">
                                    {new Date(log.createdAt).toLocaleDateString()}
                                  </span>
                                  {log.note && (
                                    <p className="w-full text-xs text-gray-600 dark:text-gray-300 italic">
                                      &ldquo;{log.note}&rdquo;
                                    </p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              };

              if (viewMode === "ROADMAP") {
                return (
                  <div className="space-y-4">
                    {Array.from(roadmapByMonth.entries())
                      .filter(([_, mPlans]) => mPlans.length > 0)
                      .map(([monthNum, mPlans]) => {
                        const mCompleted = mPlans.filter((p) => p.status === "COMPLETED").length;
                        const mAvg = mPlans.length ? Math.round(mPlans.reduce((a, p) => a + (p.progress || 0), 0) / mPlans.length) : 0;
                        const isExpanded = expandedMonths.has(monthNum);
                        const isCurrent = monthNum === currentMonth;

                        return (
                          <div key={monthNum} className="border border-gray-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
                            {/* Month Header Banner */}
                            <div
                              onClick={() => toggleExpandMonth(monthNum)}
                              className="p-4 bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100/80 flex items-center justify-between gap-3 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-2xs ${
                                  isCurrent ? "bg-amber-400 text-amber-950 ring-2 ring-amber-300/60" : "bg-emerald-100 text-emerald-800"
                                }`}>
                                  M{monthNum}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">
                                      Month {monthNum} ({monthName(monthNum)})
                                    </h4>
                                    {isCurrent && (
                                      <span className="text-[10px] font-extrabold uppercase tracking-wider bg-amber-400 text-amber-950 px-2 py-0.5 rounded-full">
                                        Active Current Month
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                                    {mCompleted} of {mPlans.length} portions completed • {mAvg}% covered
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <div className="hidden sm:block w-32 h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${mAvg >= 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                                    style={{ width: `${mAvg}%` }}
                                  />
                                </div>
                                <span className="font-extrabold text-xs text-slate-700 dark:text-slate-300">{mAvg}%</span>
                                <div className="p-1 rounded-lg bg-white dark:bg-slate-700 text-slate-400">
                                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </div>
                            </div>

                            {/* Month Portions List */}
                            {isExpanded && (
                              <div className="p-4 space-y-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                                {mPlans.map((p, idx) => renderPlanCard(p, idx))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                );
              }

              return (
                <div className="grid gap-4">
                  {paginatedPlans.map((p, i) => renderPlanCard(p, i))}
                </div>
              );
            })()}

            {/* ── Pagination Controls ── */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-slate-800">
                <p className="text-xs text-gray-500">
                  Showing <b>{(currentPage - 1) * pageSize + 1}</b> to{" "}
                  <b>{Math.min(currentPage * pageSize, filteredPlans.length)}</b> of <b>{filteredPlans.length}</b> portions
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="h-8 px-3 text-xs rounded-lg"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-1" />
                    Previous
                  </Button>

                  <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300">
                    Page {currentPage} of {totalPages}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="h-8 px-3 text-xs rounded-lg"
                  >
                    Next
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Card className="p-12 text-center fatimi-card border border-gray-200">
            <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">
              {hasActiveFilters ? "No matching Takhteet portions found" : "No Takhteet portions assigned"}
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto leading-relaxed">
              {hasActiveFilters
                ? "Try adjusting your search query, class, subject, or status filter."
                : "Curriculum portions are displayed only to teachers assigned to the respective subjects and classes. If you teach Darajah subjects, please contact the Academic Administrator to assign your syllabus portions."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
              {session?.user?.role === "ADMIN" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setLoading(true);
                    fetch(`/api/teacher/takhteet?view=all&_t=${Date.now()}`)
                      .then((r) => r.json())
                      .then((d) => {
                        if (d.success && Array.isArray(d.data)) {
                          setPlans(d.data);
                          if (d.meta) setMeta(d.meta);
                        }
                      })
                      .finally(() => setLoading(false));
                  }}
                  className="text-xs border-amber-300 bg-amber-50 text-amber-950 font-bold hover:bg-amber-100 rounded-xl"
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1.5 text-amber-600" />
                  Explore Complete Darajah Syllabus
                </Button>
              )}
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resetAllFilters}
                  className="text-xs fatimi-emerald-gradient text-white rounded-xl"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* ── Interactive Floating Batch Dock ── */}
        {selectedPlanIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white backdrop-blur-md px-4 sm:px-6 py-3 rounded-2xl shadow-2xl border border-amber-400/40 flex items-center gap-3 sm:gap-4 max-w-[95vw] flex-wrap justify-between"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center font-black text-xs">
                {selectedPlanIds.size}
              </div>
              <span className="text-xs font-bold text-slate-100 hidden sm:inline">
                {selectedPlanIds.size} Portions Selected
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                size="sm"
                disabled={batchProcessing}
                onClick={() => handleBatchUpdate({ progress: 100, status: "COMPLETED", note: "Batch marked completed" })}
                className="h-8 text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-xs cursor-pointer"
              >
                {batchProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                Mark 100% Done
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={batchProcessing}
                onClick={() => handleBatchUpdate({ progress: 50, status: "IN_PROGRESS", note: "Batch marked in progress" })}
                className="h-8 text-xs font-bold border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 rounded-xl cursor-pointer"
              >
                <FastForward className="w-3.5 h-3.5 mr-1 text-amber-400" />
                Set 50%
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelection}
                className="h-8 text-xs text-slate-400 hover:text-white rounded-xl cursor-pointer"
              >
                Clear
              </Button>
            </div>
          </motion.div>
        )}

        {/* Modernized Takhteet Update Modal */}
        <TakhteetUpdateModal
          plan={updatingPlan}
          open={!!updatingPlan}
          onOpenChange={(open) => {
            if (!open) setUpdatingPlan(null);
          }}
          onSave={handleSaveModal}
          saving={saving}
        />
      </div>
    );
}
