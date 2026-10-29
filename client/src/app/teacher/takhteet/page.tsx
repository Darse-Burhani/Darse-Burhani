"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { monthName, statusMeta } from "@/lib/takhteet";

export default function TeacherTakhteetPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"assigned" | "all">("assigned");
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
  const [updateForm, setUpdateForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [quickUpdatingId, setQuickUpdatingId] = useState<string | null>(null);

  const fetchData = async (overrideMode?: "assigned" | "all") => {
    try {
      setLoading(true);
      const targetMode = overrideMode || viewMode;
      const res = await fetch(`/api/teacher/takhteet?view=${targetMode}&_t=${Date.now()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPlans(data.data);
        if (data.meta) {
          setMeta(data.meta);
          // If teacher has 0 personal portions, automatically switch viewMode to 'all'
          if (data.meta.assignedCount === 0 && targetMode !== "all") {
            setViewMode("all");
          }
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
      const viewParam = params.get("view");
      if (subjectParam && subjectParam !== "Darajah Core Curriculum" && subjectParam !== "General") {
        setFilterSubject(subjectParam);
      }
      if (classParam) setFilterClass(classParam);
      if (viewParam === "all") setViewMode("all");
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
    setUpdateForm({ progress: String(plan.progress), status: plan.status, note: "" });
  };

  const handleSaveModal = async () => {
    if (!updatingPlan) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teacher/takhteet/${updatingPlan.id}/progress`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateForm),
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

  // Direct quick progress increment (+10%, +25%, or 100% Mark Completed)
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
        note = `Progress bumped by +${delta}% (Now ${nextProgress}%)`;
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
                <CardContent className="p-5">
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

        {/* ── View Switcher: My Assigned Portions vs Full Darajah 1–4 Syllabus ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2.5 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-xs">
          <div className="inline-flex rounded-xl bg-gray-100 dark:bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => {
                setViewMode("assigned");
                fetchData("assigned");
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                viewMode === "assigned"
                  ? "bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              My Portions ({meta.assignedCount})
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("all");
                fetchData("all");
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                viewMode === "all"
                  ? "bg-white dark:bg-emerald-950 text-emerald-900 dark:text-emerald-300 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              All Darajah 1–4 Tafseel ({meta.totalCount || 6512})
            </button>
          </div>

          <div className="text-xs text-gray-500 font-medium px-2">
            {viewMode === "all" || meta.assignedCount === 0
              ? "Showing Full Darajah 1–4 Syllabus Archive"
              : `Showing your assigned subject portions (${plans.length})`}
          </div>
        </div>

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
            <div className="grid gap-4">
              {paginatedPlans.map((p, i) => {
                const meta = statusMeta(p.status);
                const overdue = p.month && p.month < currentMonth && p.status !== "COMPLETED";
                const due = p.month === currentMonth && p.status !== "COMPLETED";
                const isQuickBusy = quickUpdatingId === p.id;

                return (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(0.2, i * 0.02) }}
                  >
                    <Card
                      className={`fatimi-card border hover:shadow-md transition-shadow ${
                        overdue
                          ? "border-red-300 dark:border-red-900/60 bg-red-50/10"
                          : "border-gray-200 dark:border-slate-800"
                      }`}
                    >
                      <CardContent className="p-5">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
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

                          {/* Center: Progress Bar & Quick Increment Actions */}
                          <div className="lg:w-64 shrink-0 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                                Progress
                              </span>
                              <span className="text-sm font-extrabold text-gray-900 dark:text-white">
                                {p.progress}%
                              </span>
                            </div>

                            <div className="h-2.5 rounded-full bg-emerald-100/60 dark:bg-slate-800 overflow-hidden border border-emerald-200/40">
                              <div
                                className={`h-full rounded-full ${meta.bar} transition-all duration-300`}
                                style={{ width: `${p.progress}%` }}
                              />
                            </div>

                            {/* Quick Increment buttons */}
                            <div className="flex items-center gap-1.5 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isQuickBusy || p.progress >= 100}
                                onClick={() => handleQuickProgress(p, 10)}
                                className="h-6 px-2 text-[11px] font-bold border-gray-200 hover:bg-emerald-50 text-emerald-800"
                                title="Add +10% to progress"
                              >
                                +10%
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={isQuickBusy || p.progress >= 100}
                                onClick={() => handleQuickProgress(p, 25)}
                                className="h-6 px-2 text-[11px] font-bold border-gray-200 hover:bg-emerald-50 text-emerald-800"
                                title="Add +25% to progress"
                              >
                                +25%
                              </Button>
                              {p.status !== "COMPLETED" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isQuickBusy}
                                  onClick={() => handleQuickProgress(p, "COMPLETED")}
                                  className="h-6 px-2 text-[11px] font-bold border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                                  title="Mark 100% Complete"
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-0.5 text-emerald-600" />
                                  100%
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* Right: Detailed Update Progress Modal Button */}
                          <div className="shrink-0 flex items-center gap-2">
                            <Button
                              variant="default"
                              size="sm"
                              className="fatimi-emerald-gradient text-white font-semibold text-xs h-9 px-3.5 rounded-xl shadow-sm"
                              onClick={() => openUpdateModal(p)}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1.5" />
                              Update Progress
                            </Button>
                          </div>
                        </div>

                        {/* Recent Progress History */}
                        {p.logs && p.logs.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                              <History className="w-3 h-3 text-amber-600" />
                              Recent Telemetry History
                            </p>
                            <div className="space-y-1.5">
                              {p.logs.slice(0, 2).map((log: any) => (
                                <div key={log.id} className="flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                  <span className="font-medium text-gray-500 shrink-0">
                                    {new Date(log.createdAt).toLocaleDateString()}
                                  </span>
                                  <span className="font-bold text-gray-800 dark:text-gray-200 shrink-0">
                                    {log.progressBefore}% → {log.progressAfter}%
                                  </span>
                                  {log.note && (
                                    <span className="italic text-gray-600 dark:text-gray-300">
                                      “{log.note}”
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

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
            <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">No matching Takhteet portions found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              {hasActiveFilters
                ? "Try adjusting your search query, class, subject, or status filter."
                : "You are currently viewing your personal portions. Click below to view the full Darajah 1–4 Tafseel curriculum."}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
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
              {viewMode !== "all" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setViewMode("all");
                    fetchData("all");
                  }}
                  className="text-xs bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 rounded-xl font-bold"
                >
                  <BookOpen className="w-3.5 h-3.5 mr-1 text-amber-700" />
                  Browse All Darajah 1–4 Tafseel (6,512 Portions)
                </Button>
              )}
            </div>
          </Card>
        )}

        {/* Update Progress Modal */}
        <Modal open={!!updatingPlan} onOpenChange={() => setUpdatingPlan(null)}>
          <ModalContent className="max-w-md">
            <ModalHeader>
              <ModalTitle className="flex items-center gap-2 text-base font-bold">
                <div className="w-8 h-8 rounded-xl fatimi-emerald-gradient flex items-center justify-center text-white">
                  <Pencil className="w-4 h-4" />
                </div>
                Update Curriculum Progress
              </ModalTitle>
            </ModalHeader>
            {updatingPlan && updateForm && (
              <div className="space-y-4 py-4">
                <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/60 p-3.5">
                  <p className="font-bold text-gray-900 dark:text-white text-sm">{updatingPlan.title}</p>
                  <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mt-0.5">
                    {updatingPlan.className} • {updatingPlan.subject}
                  </p>
                  {updatingPlan.description && (
                    <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {updatingPlan.description}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="up-status" className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Status
                  </label>
                  <select
                    id="up-status"
                    name="status"
                    className="fatimi-input w-full h-10 rounded-xl text-sm"
                    value={updateForm.status}
                    onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="up-progress" className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Progress: {updateForm.progress}%
                    </label>
                    <div className="flex gap-1">
                      {[25, 50, 75, 100].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() =>
                            setUpdateForm({
                              ...updateForm,
                              progress: String(val),
                              status: val === 100 ? "COMPLETED" : "IN_PROGRESS",
                            })
                          }
                          className="px-2 py-0.5 text-[10px] font-bold rounded bg-gray-100 hover:bg-emerald-100 text-gray-700"
                        >
                          {val}%
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    id="up-progress"
                    name="progress"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    className="w-full mt-2 accent-emerald-600 cursor-pointer"
                    value={updateForm.progress}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 0;
                      setUpdateForm({
                        ...updateForm,
                        progress: String(val),
                        status: val >= 100 ? "COMPLETED" : val > 0 ? "IN_PROGRESS" : "PENDING",
                      });
                    }}
                  />
                </div>

                <div>
                  <label htmlFor="up-note" className="block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1">
                    Teaching Note / Remarks (optional)
                  </label>
                  <input
                    id="up-note"
                    name="note"
                    className="fatimi-input w-full h-10 rounded-xl text-sm"
                    placeholder="e.g. Covered initial chapters, homework assigned"
                    value={updateForm.note}
                    onChange={(e) => setUpdateForm({ ...updateForm, note: e.target.value })}
                  />
                </div>
              </div>
            )}
            <ModalFooter>
              <ModalClose asChild>
                <Button variant="outline" size="sm" className="rounded-xl border-gray-200">
                  Cancel
                </Button>
              </ModalClose>
              <Button
                size="sm"
                className="fatimi-emerald-gradient text-white font-semibold rounded-xl"
                onClick={handleSaveModal}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Save Progress
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    );
}
