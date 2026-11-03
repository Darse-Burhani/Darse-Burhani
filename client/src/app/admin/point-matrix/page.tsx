"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Award,
  Sparkles,
  Flame,
  RotateCcw,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Users,
  ShieldCheck,
  CheckSquare,
  Square,
  Zap,
  History,
  Settings2,
  Loader2,
  ChevronRight,
  Filter,
  X,
  BookmarkCheck,
  Layers,
  Crown,
  LayoutGrid,
  List,
  Check,
  SlidersHorizontal,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface PointRule {
  id: string;
  category: string;
  actionName: string;
  pointValue: number;
  actionType: "POSITIVE" | "NEGATIVE";
  color?: string;
  iconName?: string;
}

interface Talib {
  id: string;
  userId: string;
  studentId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
  grade: string;
  section: string;
  its?: string | null;
  currentPoints: number;
  totalPoints: number;
  tier: string;
  streakDays: number;
  recentLogs?: Array<{
    id: string;
    points: number;
    actionType: "POSITIVE" | "NEGATIVE";
    category: string;
    note?: string | null;
    createdAt: string;
  }>;
}

interface PointLogItem {
  id: string;
  points: number;
  actionType: "POSITIVE" | "NEGATIVE";
  category: string;
  note?: string | null;
  isUndone: boolean;
  createdAt: string;
  student: {
    user: {
      firstName: string;
      lastName: string;
      avatarUrl?: string | null;
    };
  };
  teacher?: {
    user: {
      firstName: string;
      lastName: string;
    };
  };
}

export default function AdminPointMatrixPage() {
  const [activeTab, setActiveTab] = useState<"matrix" | "rules" | "history">("matrix");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Data states
  const [rules, setRules] = useState<PointRule[]>([]);
  const [talabat, setTalabat] = useState<Talib[]>([]);
  const [logs, setLogs] = useState<PointLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [quickLoadingStudentId, setQuickLoadingStudentId] = useState<string | null>(null);

  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [selectedSection, setSelectedSection] = useState("ALL");
  const [selectedTier, setSelectedTier] = useState<"ALL" | "GOLD" | "SILVER" | "BRONZE">("ALL");
  const [sortBy, setSortBy] = useState<"points_desc" | "points_asc" | "name" | "streak">("points_desc");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  // Modals & Drawers
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PointRule | null>(null);

  // Quick Action / Assign Form State
  const [assignForm, setAssignForm] = useState({
    selectedRuleId: "",
    actionName: "",
    category: "General",
    points: 10,
    actionType: "POSITIVE" as "POSITIVE" | "NEGATIVE",
    note: "",
  });

  // Rule Form State
  const [ruleForm, setRuleForm] = useState({
    category: "Academic",
    actionName: "",
    pointValue: "10",
    actionType: "POSITIVE" as "POSITIVE" | "NEGATIVE",
    color: "#d4af37",
    iconName: "star",
  });

  // Toast / Status feedback
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [rulesRes, talabatRes, logsRes] = await Promise.all([
        fetch("/api/admin/point-rules").then((r) => r.json()),
        fetch("/api/admin/point-rules/talabat").then((r) => r.json()),
        fetch("/api/admin/point-rules/logs").then((r) => r.json()),
      ]);

      if (rulesRes.success) setRules(rulesRes.data || []);
      if (talabatRes.success) setTalabat(talabatRes.data || []);
      if (logsRes.success) setLogs(logsRes.data || []);
    } catch (err) {
      console.error("Failed to load point matrix data:", err);
      showToast("error", "Failed to fetch matrix data. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Compute unique grades and sections
  const { availableGrades, availableSections } = useMemo(() => {
    const grades = Array.from(new Set(talabat.map((t) => t.grade).filter(Boolean))).sort();
    const sections = Array.from(new Set(talabat.map((t) => t.section).filter(Boolean))).sort();
    return { availableGrades: grades, availableSections: sections };
  }, [talabat]);

  // Filtered & Sorted Talabat
  const filteredTalabat = useMemo(() => {
    let list = talabat.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.studentId.toLowerCase().includes(q) ||
        (t.its && t.its.toLowerCase().includes(q)) ||
        `${t.grade} ${t.section}`.toLowerCase().includes(q);

      const matchesGrade = selectedGrade === "ALL" || t.grade === selectedGrade;
      const matchesSection = selectedSection === "ALL" || t.section === selectedSection;

      const isGold = (t.currentPoints >= 100) || t.tier === "GOLD";
      const isSilver = !isGold && ((t.currentPoints >= 50) || t.tier === "SILVER");
      const isBronze = !isGold && !isSilver;

      const matchesTier =
        selectedTier === "ALL" ||
        (selectedTier === "GOLD" && isGold) ||
        (selectedTier === "SILVER" && isSilver) ||
        (selectedTier === "BRONZE" && isBronze);

      return matchesSearch && matchesGrade && matchesSection && matchesTier;
    });

    return list.sort((a, b) => {
      if (sortBy === "points_desc") return b.currentPoints - a.currentPoints;
      if (sortBy === "points_asc") return a.currentPoints - b.currentPoints;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "streak") return (b.streakDays || 0) - (a.streakDays || 0);
      return 0;
    });
  }, [talabat, searchQuery, selectedGrade, selectedSection, selectedTier, sortBy]);

  // Metrics
  const metrics = useMemo(() => {
    const totalTalabat = talabat.length;
    const totalPointsAwarded = talabat.reduce((acc, t) => acc + (t.currentPoints || 0), 0);
    const activeRulesCount = rules.length;
    const goldCount = talabat.filter((t) => (t.currentPoints >= 100) || t.tier === "GOLD").length;
    const silverCount = talabat.filter((t) => (t.currentPoints >= 50 && t.currentPoints < 100) || t.tier === "SILVER").length;
    const avgPoints = totalTalabat > 0 ? Math.round(totalPointsAwarded / totalTalabat) : 0;
    return { totalTalabat, totalPointsAwarded, activeRulesCount, goldCount, silverCount, avgPoints };
  }, [talabat, rules]);

  // Bulk Selection Handlers
  const handleSelectAll = () => {
    if (selectedStudentIds.length === filteredTalabat.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredTalabat.map((t) => t.id));
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  // Open modal with preselected rule or target
  const handleOpenAssignModal = (rule?: PointRule, targetStudentId?: string) => {
    if (targetStudentId) {
      setSelectedStudentIds([targetStudentId]);
    }

    if (rule) {
      setAssignForm({
        selectedRuleId: rule.id,
        actionName: rule.actionName,
        category: rule.category,
        points: rule.pointValue,
        actionType: rule.actionType,
        note: `Predefined action: ${rule.actionName}`,
      });
    } else {
      setAssignForm({
        selectedRuleId: "",
        actionName: "",
        category: "Academic",
        points: 10,
        actionType: "POSITIVE",
        note: "",
      });
    }
    setShowAssignModal(true);
  };

  const handleRuleSelectChange = (ruleId: string) => {
    const selected = rules.find((r) => r.id === ruleId);
    if (selected) {
      setAssignForm({
        selectedRuleId: selected.id,
        actionName: selected.actionName,
        category: selected.category,
        points: selected.pointValue,
        actionType: selected.actionType,
        note: `Predefined rule: ${selected.actionName}`,
      });
    } else {
      setAssignForm((prev) => ({ ...prev, selectedRuleId: "" }));
    }
  };

  // Submit Point Assignment
  const handleAssignPoints = async () => {
    if (selectedStudentIds.length === 0) {
      showToast("error", "Please select at least one student.");
      return;
    }

    if (!assignForm.actionName.trim()) {
      showToast("error", "Action name / reason is required.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch("/api/admin/point-rules/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          matrixId: assignForm.selectedRuleId || undefined,
          actionName: assignForm.actionName,
          category: assignForm.category,
          points: assignForm.points,
          actionType: assignForm.actionType,
          note: assignForm.note,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to assign points");

      showToast("success", data.message || "Points successfully awarded!");
      setShowAssignModal(false);
      setSelectedStudentIds([]);
      fetchData();
    } catch (err: any) {
      showToast("error", err.message || "Error assigning points");
    } finally {
      setActionLoading(false);
    }
  };

  // Direct 1-Click Interactive Micro-Scoring on Student Card
  const handleQuickStudentPoints = async (
    studentId: string,
    points: number,
    actionName: string,
    category: string = "Academic"
  ) => {
    try {
      setQuickLoadingStudentId(studentId);
      const actionType = points >= 0 ? "POSITIVE" : "NEGATIVE";
      const absPoints = Math.abs(points);

      // Optimistically update local talabat state for instant haptic feedback
      setTalabat((prev) =>
        prev.map((t) =>
          t.id === studentId
            ? {
                ...t,
                currentPoints: Math.max(0, t.currentPoints + points),
                totalPoints: t.totalPoints + (points > 0 ? points : 0),
                recentLogs: [
                  {
                    id: "temp-" + Date.now(),
                    points: absPoints,
                    actionType,
                    category,
                    note: actionName,
                    createdAt: new Date().toISOString(),
                  },
                  ...(t.recentLogs || []),
                ],
              }
            : t
        )
      );

      const res = await fetch("/api/admin/point-rules/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: [studentId],
          actionName,
          category,
          points: absPoints,
          actionType,
          note: `Instant score: ${actionName}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");

      showToast("success", `${points >= 0 ? "+" : ""}${points} pts awarded for ${actionName}!`);
    } catch (err: any) {
      showToast("error", err.message || "Failed to record points");
      fetchData(); // Rollback if failed
    } finally {
      setQuickLoadingStudentId(null);
    }
  };

  // Quick One-Click Apply Action to selected students
  const handleQuickApplyRule = async (rule: PointRule) => {
    if (selectedStudentIds.length === 0) {
      showToast("error", "Select talabat checkboxes below before applying an action.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch("/api/admin/point-rules/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          matrixId: rule.id,
          actionName: rule.actionName,
          category: rule.category,
          points: rule.pointValue,
          actionType: rule.actionType,
          note: `Quick applied: ${rule.actionName}`,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");

      showToast("success", `Applied "${rule.actionName}" (${rule.actionType === "POSITIVE" ? "+" : "-"}${rule.pointValue} pts) to ${selectedStudentIds.length} talabat!`);
      fetchData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to apply rule");
    } finally {
      setActionLoading(false);
    }
  };

  // Save / Update Rule
  const handleSaveRule = async () => {
    if (!ruleForm.actionName.trim() || !ruleForm.category.trim() || !ruleForm.pointValue) {
      showToast("error", "Please fill in all rule fields.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch("/api/admin/point-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingRule?.id,
          category: ruleForm.category,
          actionName: ruleForm.actionName,
          pointValue: ruleForm.pointValue,
          actionType: ruleForm.actionType,
          color: ruleForm.color,
          iconName: ruleForm.iconName,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to save rule");

      showToast("success", `Rule ${editingRule ? "updated" : "created"} successfully!`);
      setShowRuleModal(false);
      setEditingRule(null);
      fetchData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to save rule");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Rule
  const handleDeleteRule = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the rule "${name}"?`)) return;

    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/point-rules/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete");

      showToast("success", "Rule removed successfully.");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to delete rule");
    } finally {
      setActionLoading(false);
    }
  };

  // Undo Log Entry
  const handleUndoLog = async (logId: string) => {
    try {
      setActionLoading(true);
      const res = await fetch("/api/admin/point-rules/undo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logIds: [logId] }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to undo");

      showToast("success", "Point transaction reversed.");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to undo");
    } finally {
      setActionLoading(false);
    }
  };

  // Open Create Rule Modal
  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm({
      category: "Academic",
      actionName: "",
      pointValue: "10",
      actionType: "POSITIVE",
      color: "#d4af37",
      iconName: "star",
    });
    setShowRuleModal(true);
  };

  // Open Edit Rule Modal
  const openEditRule = (rule: PointRule) => {
    setEditingRule(rule);
    setRuleForm({
      category: rule.category,
      actionName: rule.actionName,
      pointValue: rule.pointValue.toString(),
      actionType: rule.actionType,
      color: rule.color || (rule.actionType === "POSITIVE" ? "#d4af37" : "#e11d48"),
      iconName: rule.iconName || "star",
    });
    setShowRuleModal(true);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] dark:bg-slate-950 pb-28 text-slate-900 dark:text-slate-100 font-sans">
      {/* Toast Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border text-xs sm:text-sm font-bold backdrop-blur-xl ${
              feedback.type === "success"
                ? "bg-emerald-900/95 text-emerald-100 border-emerald-700 shadow-emerald-950/20"
                : "bg-rose-900/95 text-rose-100 border-rose-700 shadow-rose-950/20"
            }`}
          >
            {feedback.type === "success" ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-rose-400" />}
            <span>{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

        {/* Fatimi Executive Central Header Banner */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-emerald-800/40"
          style={{ background: "linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)" }}
        >
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border border-amber-300/40"
                style={{ background: "linear-gradient(135deg, #d4af37, #b8972e)" }}
              >
                <Crown className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-white/15 text-xs text-amber-200 font-semibold mb-1 border border-white/20">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>نظام نقاط الفضيلة والدرجات · Fatimi Merit &amp; Fadilat Matrix</span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
                  Talabat Point Matrix
                </h1>
                <p className="text-emerald-100/90 text-xs sm:text-sm mt-0.5 max-w-xl leading-relaxed">
                  Dynamic institutional scoring engine, student merit portfolios, and real-time curricular score allocations.
                </p>
              </div>
            </div>

            {/* Quick Action Navigation & Global CTAs */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex bg-black/25 backdrop-blur-md p-1.5 rounded-2xl border border-white/20">
                <button
                  onClick={() => setActiveTab("matrix")}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTab === "matrix"
                      ? "bg-white text-emerald-900 shadow-md font-extrabold"
                      : "text-emerald-100 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Users className="w-4 h-4" /> Talabat Matrix
                </button>
                <button
                  onClick={() => setActiveTab("rules")}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTab === "rules"
                      ? "bg-white text-emerald-900 shadow-md font-extrabold"
                      : "text-emerald-100 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Settings2 className="w-4 h-4" /> Scoring Rules ({rules.length})
                </button>
                <button
                  onClick={() => setActiveTab("history")}
                  className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    activeTab === "history"
                      ? "bg-white text-emerald-900 shadow-md font-extrabold"
                      : "text-emerald-100 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <History className="w-4 h-4" /> Audit Feed
                </button>
              </div>

              <Button
                variant="default"
                className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black shadow-lg shadow-amber-950/20 flex items-center gap-2 rounded-2xl text-xs sm:text-sm px-5 py-5 border border-amber-300/60 cursor-pointer transition-all active:scale-95"
                onClick={() => handleOpenAssignModal()}
              >
                <Zap className="w-4 h-4 fill-slate-950" /> Assign Points
              </Button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-80" />
        </motion.div>

        {/* Hero Stats Bento Deck */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Talabat */}
          <Card className="rounded-3xl border border-emerald-100/90 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Talabat</p>
                <p className="text-2xl sm:text-3xl font-black mt-1 text-slate-900 dark:text-white leading-none">
                  {metrics.totalTalabat}
                </p>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-2 font-semibold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Enrolled Cohort
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 flex items-center justify-center border border-emerald-200/60 shadow-xs">
                <Users className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          {/* Central Merit Score Vault */}
          <Card className="rounded-3xl border border-amber-200/90 dark:border-amber-950/60 shadow-xs bg-gradient-to-br from-white to-amber-50/40 dark:from-slate-900 dark:to-slate-900 hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">Score Pool Vault</p>
                <p className="text-2xl sm:text-3xl font-black mt-1 text-amber-700 dark:text-amber-300 leading-none">
                  {metrics.totalPointsAwarded.toLocaleString()}
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-400 mt-2 font-medium">
                  Avg {metrics.avgPoints} pts / talib
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 dark:bg-amber-950/50 flex items-center justify-center border border-amber-200 shadow-xs">
                <Award className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          {/* Tier Distribution */}
          <Card className="rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Honors Tiers</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white leading-none">
                    {metrics.goldCount}
                  </span>
                  <span className="text-xs font-bold text-amber-600 font-mono">Gold</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-sm font-bold text-slate-700 font-mono">{metrics.silverCount} Silver</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  {metrics.totalTalabat > 0 ? Math.round((metrics.goldCount / metrics.totalTalabat) * 100) : 0}% in elite honors
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-100/60 text-amber-800 dark:bg-amber-950/40 flex items-center justify-center border border-amber-300/60 shadow-xs">
                <Crown className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          {/* Predefined Rules */}
          <Card className="rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Scoring Rules</p>
                <p className="text-2xl sm:text-3xl font-black mt-1 text-slate-900 dark:text-white leading-none">
                  {metrics.activeRulesCount}
                </p>
                <p className="text-[11px] text-slate-500 mt-2 font-medium">
                  {logs.length} logged allocations
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 flex items-center justify-center border border-emerald-200/60 shadow-xs">
                <BookmarkCheck className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ======================= TAB 1: TALABAT MATRIX ======================= */}
        {activeTab === "matrix" && (
          <div className="space-y-6">

            {/* Standby Status Institutional Notice */}
            {logs.length === 0 && !loading && (
              <div className="p-4 rounded-3xl bg-amber-50/90 border border-amber-300/80 text-amber-950 flex items-start gap-3 shadow-xs">
                <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs leading-relaxed">
                  <span className="font-extrabold text-amber-900">Point Matrix Ready (Term Standby): </span>
                  Points flow dynamically from monthly assignments, hifz progress, and faculty assessments. Use the interactive quick-action cards below or the batch allocator to award merit points immediately.
                </div>
              </div>
            )}

            {/* Decided Actions Quick-Bar Ribbon */}
            <Card className="rounded-3xl border border-emerald-200/80 dark:border-emerald-950 bg-gradient-to-r from-emerald-50/70 via-white to-amber-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/40 shadow-xs overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="p-1.5 rounded-lg bg-emerald-700 text-white shadow-xs">
                      <Zap className="w-3.5 h-3.5 fill-white" />
                    </div>
                    <h2 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-900 dark:text-slate-200">
                      Decided Quick Actions
                    </h2>
                    <span className="text-xs text-slate-500 font-medium">
                      {selectedStudentIds.length > 0 ? (
                        <span className="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 rounded-full">
                          Ready for {selectedStudentIds.length} Selected Talabat
                        </span>
                      ) : (
                        "(Select student cards below $\rightarrow$ click rule to apply instantly)"
                      )}
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-emerald-800 hover:text-emerald-900 font-bold p-0 h-auto cursor-pointer"
                    onClick={openCreateRule}
                  >
                    + Add Rule Preset
                  </Button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
                  {rules.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2">No decided action rules configured yet.</p>
                  ) : (
                    rules.map((rule) => {
                      const isPositive = rule.actionType === "POSITIVE";
                      return (
                        <button
                          key={rule.id}
                          disabled={actionLoading}
                          onClick={() => handleQuickApplyRule(rule)}
                          className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-2xs ${
                            isPositive
                              ? "bg-white hover:bg-emerald-50 text-emerald-900 border-emerald-200/90 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60"
                              : "bg-white hover:bg-rose-50 text-rose-900 border-rose-200/90 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isPositive ? "bg-emerald-600" : "bg-rose-600"
                            }`}
                          />
                          <span>{rule.actionName}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-black ${
                              isPositive
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200"
                            }`}
                          >
                            {isPositive ? "+" : "-"}
                            {rule.pointValue}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Filter Bar, Search, and Interactive View Toggle */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Talabat by name, ITS, ID, or grade..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filters & Interactive Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Grade Filter */}
                <select
                  aria-label="Filter by Grade"
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                >
                  <option value="ALL">All Grades</option>
                  {availableGrades.map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>

                {/* Section Filter */}
                <select
                  aria-label="Filter by Section"
                  value={selectedSection}
                  onChange={(e) => setSelectedSection(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                >
                  <option value="ALL">All Sections</option>
                  {availableSections.map((s) => (
                    <option key={s} value={s}>
                      Sec {s}
                    </option>
                  ))}
                </select>

                {/* Tier Filter */}
                <select
                  aria-label="Filter by Tier"
                  value={selectedTier}
                  onChange={(e) => setSelectedTier(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                >
                  <option value="ALL">All Honors Tiers</option>
                  <option value="GOLD">👑 Gold Tier (100+ pts)</option>
                  <option value="SILVER">🥈 Silver Tier (50+ pts)</option>
                  <option value="BRONZE">🥉 Bronze Tier (&lt;50 pts)</option>
                </select>

                {/* Sort By */}
                <select
                  aria-label="Sort Talabat"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
                >
                  <option value="points_desc">Points: High to Low</option>
                  <option value="points_asc">Points: Low to High</option>
                  <option value="name">Alphabetical (Name)</option>
                  <option value="streak">Active Days Streak</option>
                </select>

                {/* Bulk Select All */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs rounded-xl border-slate-200 dark:border-slate-800 flex items-center gap-1.5 cursor-pointer font-bold"
                >
                  {selectedStudentIds.length === filteredTalabat.length && filteredTalabat.length > 0 ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-emerald-700" /> Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5 text-slate-400" /> Select All ({filteredTalabat.length})
                    </>
                  )}
                </Button>

                {/* View Switcher: Interactive Cards vs Table */}
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === "grid"
                        ? "bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-400 shadow-xs font-bold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    title="Interactive Cards View"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                      viewMode === "table"
                        ? "bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-400 shadow-xs font-bold"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                    title="Compact Table View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Loading Indicator */}
            {loading ? (
              <div className="p-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-700" />
                <p className="text-sm font-semibold">Loading Talabat merit matrix...</p>
              </div>
            ) : filteredTalabat.length === 0 ? (
              <div className="p-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-100">
                <Users className="w-10 h-10 mx-auto mb-3 text-slate-300" />
                <p className="text-base font-bold text-slate-700">No Talabat found</p>
                <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search keywords.</p>
              </div>
            ) : viewMode === "grid" ? (
              /* ================= REDESIGNED INTERACTIVE TALABAT MERIT CARDS ================= */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTalabat.map((talib) => {
                  const isSelected = selectedStudentIds.includes(talib.id);
                  const latestLog = talib.recentLogs?.[0];
                  const isGold = (talib.currentPoints >= 100) || talib.tier === "GOLD";
                  const isSilver = !isGold && ((talib.currentPoints >= 50) || talib.tier === "SILVER");
                  const isUpdatingThisCard = quickLoadingStudentId === talib.id;

                  return (
                    <motion.div
                      key={talib.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className={`group relative rounded-3xl p-5 border transition-all duration-300 flex flex-col justify-between ${
                        isSelected
                          ? "bg-gradient-to-br from-emerald-50 via-white to-amber-50/50 dark:from-emerald-950/60 dark:via-slate-900 dark:to-slate-900 border-emerald-600 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-950/5"
                          : "bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-amber-400/80 hover:shadow-xl hover:shadow-emerald-950/5 hover:-translate-y-0.5"
                      }`}
                    >
                      <div>
                        {/* Top Utility Bar: Checkbox + Grade Badge + Tier */}
                        <div className="flex items-center justify-between gap-2 mb-3.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => toggleStudentSelection(talib.id)}
                              className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-emerald-700 border-emerald-700 text-white shadow-xs"
                                  : "border-slate-300 dark:border-slate-700 hover:border-emerald-600 bg-slate-50 dark:bg-slate-800"
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </button>

                            <Badge variant="outline" className="text-[11px] font-semibold border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                              Gr {talib.grade} · {talib.section}
                            </Badge>
                          </div>

                          {/* Tier Badge */}
                          {isGold ? (
                            <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black text-[10px] uppercase tracking-wider shadow-xs border-0 flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-200 fill-amber-200" /> Gold Tier
                            </Badge>
                          ) : isSilver ? (
                            <Badge className="bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-bold text-[10px] uppercase tracking-wider border-0 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3 text-slate-600 dark:text-slate-400" /> Silver Tier
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-50 text-amber-900 border border-amber-200 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-600" /> Bronze
                            </Badge>
                          )}
                        </div>

                        {/* Student Avatar & Identity */}
                        <div className="flex items-center gap-3.5 mb-4">
                          <div className="relative shrink-0">
                            <Avatar className="w-13 h-13 rounded-2xl border-2 border-emerald-100 ring-2 ring-emerald-50 shadow-xs">
                              {talib.avatarUrl && <AvatarImage src={talib.avatarUrl} alt={talib.name} />}
                              <AvatarFallback className="bg-gradient-to-br from-emerald-700 to-amber-600 text-white font-bold text-sm">
                                {getInitials(talib.firstName, talib.lastName)}
                              </AvatarFallback>
                            </Avatar>
                            {talib.streakDays > 0 && (
                              <div
                                className="absolute -bottom-1.5 -right-1.5 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full shadow-xs flex items-center gap-0.5"
                                title={`${talib.streakDays} days active streak`}
                              >
                                <Flame className="w-2.5 h-2.5 fill-white" />
                                {talib.streakDays}d
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base leading-snug truncate" title={talib.name}>
                              {talib.name}
                            </h3>
                            <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                              {talib.its ? `ITS: ${talib.its}` : talib.studentId}
                            </p>
                          </div>
                        </div>

                        {/* Central Score Card Gauge */}
                        <div className="p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-emerald-50/40 dark:from-slate-950 dark:to-emerald-950/20 border border-emerald-100/90 dark:border-emerald-900/40 flex items-center justify-between mb-4 shadow-inner">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                              Merit Balance
                            </span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span className="text-2xl sm:text-3xl font-black text-emerald-800 dark:text-emerald-400 tracking-tight">
                                {talib.currentPoints}
                              </span>
                              <span className="text-xs font-bold text-emerald-600 uppercase">pts</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 block">Lifetime Total</span>
                            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                              {talib.totalPoints} pts
                            </span>
                          </div>
                        </div>

                        {/* Interactive Micro-Action Bar */}
                        <div className="space-y-1.5 mb-4">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                            <span>Quick Merit Action</span>
                            {isUpdatingThisCard && <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />}
                          </span>
                          <div className="grid grid-cols-4 gap-1.5">
                            <button
                              type="button"
                              disabled={actionLoading || isUpdatingThisCard}
                              onClick={() => handleQuickStudentPoints(talib.id, 5, "Class Participation", "Academic")}
                              className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 rounded-xl font-bold text-xs transition-all active:scale-95 text-center cursor-pointer shadow-xs"
                              title="Award 5 points for Participation"
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading || isUpdatingThisCard}
                              onClick={() => handleQuickStudentPoints(talib.id, 10, "Academic Excellence", "Academic")}
                              className="py-1.5 px-2 bg-emerald-100/70 hover:bg-emerald-200/70 dark:bg-emerald-900/40 dark:hover:bg-emerald-800/50 text-emerald-900 dark:text-emerald-200 border border-emerald-300/80 rounded-xl font-black text-xs transition-all active:scale-95 text-center cursor-pointer shadow-xs"
                              title="Award 10 points for Excellence"
                            >
                              +10
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading || isUpdatingThisCard}
                              onClick={() => handleQuickStudentPoints(talib.id, 25, "Hifz / Khidmat Milestone", "Hifz")}
                              className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300/80 rounded-xl font-black text-xs transition-all active:scale-95 text-center cursor-pointer shadow-xs"
                              title="Award 25 points for Milestone"
                            >
                              +25
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading || isUpdatingThisCard}
                              onClick={() => handleQuickStudentPoints(talib.id, -5, "Disciplinary Remark", "Conduct")}
                              className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-800 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 rounded-xl font-bold text-xs transition-all active:scale-95 text-center cursor-pointer shadow-xs"
                              title="Deduct 5 points for Conduct"
                            >
                              -5
                            </button>
                          </div>
                        </div>

                        {/* Recent Log Ribbon */}
                        {latestLog ? (
                          <div className="py-1.5 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-800 text-[11px] flex items-center justify-between text-slate-600 dark:text-slate-300 mb-4">
                            <span className="truncate max-w-[150px] font-medium" title={latestLog.note || latestLog.category}>
                              {latestLog.note || latestLog.category}
                            </span>
                            <span className={`font-bold shrink-0 ${latestLog.actionType === "POSITIVE" ? "text-emerald-700" : "text-rose-600"}`}>
                              {latestLog.actionType === "POSITIVE" ? "+" : "-"}{latestLog.points} pts
                            </span>
                          </div>
                        ) : (
                          <div className="py-1.5 px-2.5 rounded-xl bg-slate-50/60 dark:bg-slate-800/40 text-[11px] text-slate-400 italic mb-4">
                            No recent point actions
                          </div>
                        )}
                      </div>

                      {/* Card Footer Action */}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenAssignModal(undefined, talib.id)}
                        className="w-full h-9 rounded-xl border-emerald-200 hover:border-emerald-400 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold text-xs gap-1.5 cursor-pointer shadow-xs transition-all"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        Assign Custom Points
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              /* ================= COMPACT MATRIX TABLE VIEW ================= */
              <Card className="rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs overflow-hidden bg-white dark:bg-slate-900">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="py-3.5 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={
                              selectedStudentIds.length === filteredTalabat.length &&
                              filteredTalabat.length > 0
                            }
                            onChange={handleSelectAll}
                            className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-3.5 px-4">Talib</th>
                        <th className="py-3.5 px-4">Grade & Section</th>
                        <th className="py-3.5 px-4">ITS / ID</th>
                        <th className="py-3.5 px-4 text-center">Score Balance</th>
                        <th className="py-3.5 px-4">Recent Point Action</th>
                        <th className="py-3.5 px-4 text-right">Quick Score</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                      {filteredTalabat.map((talib) => {
                        const isSelected = selectedStudentIds.includes(talib.id);
                        const latestLog = talib.recentLogs?.[0];

                        return (
                          <tr
                            key={talib.id}
                            className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                              isSelected
                                ? "bg-emerald-50/60 dark:bg-emerald-950/20"
                                : ""
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStudentSelection(talib.id)}
                                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-500 cursor-pointer"
                              />
                            </td>
                            <td className="py-3.5 px-4 font-medium">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-600 to-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                                  {talib.avatarUrl ? (
                                    <img
                                      src={talib.avatarUrl}
                                      alt={talib.name}
                                      className="w-full h-full rounded-full object-cover object-center"
                                    />
                                  ) : (
                                    talib.firstName?.[0] || "T"
                                  )}
                                </div>
                                <div>
                                  <p className="text-slate-900 dark:text-white font-semibold">
                                    {talib.name}
                                  </p>
                                  <p className="text-[11px] text-slate-400">{talib.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <Badge variant="outline" className="text-xs font-medium border-slate-200 dark:border-slate-800">
                                Grade {talib.grade} - {talib.section}
                              </Badge>
                            </td>
                            <td className="py-3.5 px-4 text-xs font-mono text-slate-500">
                              <div>{talib.its || "—"}</div>
                              <div className="text-[10px] text-slate-400">{talib.studentId}</div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="inline-flex flex-col items-center">
                                <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                                  {talib.currentPoints} pts
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Lifetime: {talib.totalPoints}
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-xs">
                              {latestLog ? (
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`font-semibold ${
                                      latestLog.actionType === "POSITIVE"
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-rose-600 dark:text-rose-400"
                                    }`}
                                  >
                                    {latestLog.actionType === "POSITIVE" ? "+" : "-"}
                                    {latestLog.points}
                                  </span>
                                  <span className="text-slate-600 dark:text-slate-400 truncate max-w-[140px]">
                                    {latestLog.category}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-400 text-xs">No records</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 cursor-pointer"
                                  title="Award Points"
                                  onClick={() => handleOpenAssignModal(undefined, talib.id)}
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" /> Points
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Floating Selection Action Deck */}
            <AnimatePresence>
              {selectedStudentIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 30 }}
                  className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 dark:bg-slate-900/95 text-white backdrop-blur-xl border border-emerald-500/40 px-6 py-3.5 rounded-3xl shadow-2xl flex items-center gap-4 text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                      {selectedStudentIds.length}
                    </div>
                    <span className="font-bold text-slate-200">Talabat Selected</span>
                  </div>

                  <div className="h-4 w-px bg-slate-700" />

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                      onClick={() => {
                        setAssignForm({
                          selectedRuleId: "",
                          actionName: "Commendable Performance",
                          category: "Academic",
                          points: 10,
                          actionType: "POSITIVE",
                          note: "",
                        });
                        setShowAssignModal(true);
                      }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Award Points
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-500/60 text-rose-300 hover:bg-rose-950/60 font-bold text-xs rounded-xl cursor-pointer"
                      onClick={() => {
                        setAssignForm({
                          selectedRuleId: "",
                          actionName: "Disciplinary Deduction",
                          category: "Conduct",
                          points: 5,
                          actionType: "NEGATIVE",
                          note: "",
                        });
                        setShowAssignModal(true);
                      }}
                    >
                      <TrendingDown className="w-3.5 h-3.5 mr-1" /> Deduct Points
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-slate-400 hover:text-white text-xs cursor-pointer"
                      onClick={() => setSelectedStudentIds([])}
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Clear
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ======================= TAB 2: DECIDED RULES MANAGER ======================= */}
        {activeTab === "rules" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Point Scoring Matrix Rules</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure predefined positive and negative point values for swift one-click scoring.
                </p>
              </div>
              <Button
                onClick={openCreateRule}
                className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add New Rule
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Positive Rules Deck */}
              <Card className="rounded-3xl border border-emerald-100 dark:border-emerald-950/60 bg-white dark:bg-slate-900 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
                      <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      Positive Actions ({rules.filter((r) => r.actionType === "POSITIVE").length})
                    </CardTitle>
                    <Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border-0 font-bold">
                      Reward Pool
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5">
                  {rules.filter((r) => r.actionType === "POSITIVE").length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-8">No positive rules configured yet.</p>
                  ) : (
                    rules
                      .filter((r) => r.actionType === "POSITIVE")
                      .map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/90 dark:border-emerald-900/40 hover:shadow-xs transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs shadow-2xs">
                              +{rule.pointValue}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                                {rule.actionName}
                              </p>
                              <p className="text-[11px] text-slate-500">{rule.category}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-emerald-700 cursor-pointer"
                              onClick={() => openEditRule(rule)}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-rose-600 cursor-pointer"
                              onClick={() => handleDeleteRule(rule.id, rule.actionName)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>

              {/* Negative Rules Deck */}
              <Card className="rounded-3xl border border-rose-100 dark:border-rose-950/60 bg-white dark:bg-slate-900 shadow-xs">
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-rose-700 dark:text-rose-400">
                      <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                      Negative / Penalty Actions ({rules.filter((r) => r.actionType === "NEGATIVE").length})
                    </CardTitle>
                    <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-0 font-bold">
                      Discipline Pool
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5">
                  {rules.filter((r) => r.actionType === "NEGATIVE").length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-8">No penalty rules configured yet.</p>
                  ) : (
                    rules
                      .filter((r) => r.actionType === "NEGATIVE")
                      .map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between p-3 rounded-2xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/90 dark:border-rose-900/40 hover:shadow-xs transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold text-xs shadow-2xs">
                              -{rule.pointValue}
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                                {rule.actionName}
                              </p>
                              <p className="text-[11px] text-slate-500">{rule.category}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-emerald-700 cursor-pointer"
                              onClick={() => openEditRule(rule)}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-rose-600 cursor-pointer"
                              onClick={() => handleDeleteRule(rule.id, rule.actionName)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ======================= TAB 3: AUDIT HISTORY & UNDO ======================= */}
        {activeTab === "history" && (
          <Card className="rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900 overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-emerald-700 dark:text-emerald-400" /> Live Audit Log &amp; Reversals
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Chronological ledger of point assignments with one-click undo capability.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} className="text-xs rounded-xl cursor-pointer">
                  Refresh Ledger
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                {logs.length === 0 ? (
                  <p className="text-center text-slate-400 py-12">No point transactions recorded yet.</p>
                ) : (
                  logs.map((log) => {
                    const isPositive = log.actionType === "POSITIVE";
                    return (
                      <div
                        key={log.id}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          log.isUndone ? "opacity-40 bg-slate-50 dark:bg-slate-950 line-through" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs ${
                              isPositive
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">
                              {log.student?.user?.firstName} {log.student?.user?.lastName}
                              <span className="text-slate-400 font-normal ml-2 text-xs">
                                received {isPositive ? "+" : "-"}
                                {log.points} pts
                              </span>
                            </p>
                            <p className="text-xs text-slate-500">
                              {log.category} {log.note ? `— "${log.note}"` : ""}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              By {log.teacher?.user?.firstName || "Admin"} •{" "}
                              {new Date(log.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {!log.isUndone && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionLoading}
                            className="text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl cursor-pointer"
                            onClick={() => handleUndoLog(log.id)}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Revert (Undo)
                          </Button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        )}

      </div>

      {/* ======================= MODAL: ASSIGN POINTS ======================= */}
      <Modal open={showAssignModal} onOpenChange={setShowAssignModal}>
        <ModalContent className="max-w-lg rounded-3xl p-6 bg-white">
          <ModalHeader>
            <ModalTitle className="text-lg font-bold flex items-center gap-2 text-slate-900">
              <Sparkles className="w-5 h-5 text-amber-500" /> Assign Points on Decided Action
            </ModalTitle>
          </ModalHeader>

          <div className="space-y-4 py-3 text-xs sm:text-sm">
            {/* Target Talabat count */}
            <div className="p-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 rounded-2xl border border-emerald-200 dark:border-emerald-900 flex items-center justify-between">
              <span className="text-emerald-950 dark:text-slate-300 font-semibold">Target Recipient(s):</span>
              <Badge className="bg-emerald-700 text-white border-0 font-bold">
                {selectedStudentIds.length} Talib(s) Selected
              </Badge>
            </div>

            {/* Select Predefined Rule */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Preset Decided Rule (Optional Shortcut)
              </label>
              <select
                aria-label="Preset Decided Rule"
                value={assignForm.selectedRuleId}
                onChange={(e) => handleRuleSelectChange(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">-- Choose a Decided Rule or Custom --</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.actionName} ({r.actionType === "POSITIVE" ? "+" : "-"}
                    {r.pointValue} pts) [{r.category}]
                  </option>
                ))}
              </select>
            </div>

            {/* Action Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Action Name / Reason *
              </label>
              <input
                type="text"
                placeholder="e.g. Completed Hifz Revision, Exemplary Adab"
                value={assignForm.actionName}
                onChange={(e) => setAssignForm({ ...assignForm, actionName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Quick Amount Tokens */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Quick Point Tokens
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[5, 10, 15, 20, 25, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAssignForm((prev) => ({ ...prev, points: val }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      assignForm.points === val
                        ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-400"
                    }`}
                  >
                    {assignForm.actionType === "POSITIVE" ? "+" : "-"}{val}
                  </button>
                ))}
              </div>
            </div>

            {/* Category & Points */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  placeholder="e.g. Quran, Adab, Khidmat"
                  value={assignForm.category}
                  onChange={(e) => setAssignForm({ ...assignForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Point Value *
                </label>
                <input
                  type="number"
                  min="1"
                  value={assignForm.points}
                  onChange={(e) => setAssignForm({ ...assignForm, points: parseInt(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>
            </div>

            {/* Positive vs Negative toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Impact Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAssignForm({ ...assignForm, actionType: "POSITIVE" })}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    assignForm.actionType === "POSITIVE"
                      ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" /> Positive Award (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAssignForm({ ...assignForm, actionType: "NEGATIVE" })}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    assignForm.actionType === "NEGATIVE"
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" /> Penalty Deduction (-)
                </button>
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Optional Note / Remarks
              </label>
              <input
                type="text"
                placeholder="e.g. Excellent recitation during morning session"
                value={assignForm.note}
                onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <ModalFooter className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="rounded-xl cursor-pointer">
                Cancel
              </Button>
            </ModalClose>
            <Button
              size="sm"
              disabled={actionLoading || selectedStudentIds.length === 0 || !assignForm.actionName.trim()}
              onClick={handleAssignPoints}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Confirm &amp; Assign
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ======================= MODAL: CREATE / EDIT RULE ======================= */}
      <Modal open={showRuleModal} onOpenChange={setShowRuleModal}>
        <ModalContent className="max-w-md rounded-3xl p-6 bg-white">
          <ModalHeader>
            <ModalTitle className="text-lg font-bold text-slate-900">
              {editingRule ? "Edit Decided Rule" : "Create Decided Scoring Rule"}
            </ModalTitle>
          </ModalHeader>

          <div className="space-y-4 py-3 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Action Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Hifz Excellence, Peer Mentoring"
                value={ruleForm.actionName}
                onChange={(e) => setRuleForm({ ...ruleForm, actionName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Category *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hifz, Adab, Conduct"
                  value={ruleForm.category}
                  onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Point Value *
                </label>
                <input
                  type="number"
                  min="1"
                  value={ruleForm.pointValue}
                  onChange={(e) => setRuleForm({ ...ruleForm, pointValue: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Rule Type *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRuleForm({ ...ruleForm, actionType: "POSITIVE" })}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    ruleForm.actionType === "POSITIVE"
                      ? "bg-emerald-700 text-white border-emerald-700 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" /> Positive (+)
                </button>
                <button
                  type="button"
                  onClick={() => setRuleForm({ ...ruleForm, actionType: "NEGATIVE" })}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    ruleForm.actionType === "NEGATIVE"
                      ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" /> Penalty (-)
                </button>
              </div>
            </div>
          </div>

          <ModalFooter className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="rounded-xl cursor-pointer">
                Cancel
              </Button>
            </ModalClose>
            <Button
              size="sm"
              disabled={actionLoading || !ruleForm.actionName.trim() || !ruleForm.category.trim()}
              onClick={handleSaveRule}
              className="bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold cursor-pointer"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              {editingRule ? "Update Rule" : "Create Rule"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

    </div>
  );
}
