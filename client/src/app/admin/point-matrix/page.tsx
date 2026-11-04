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
  Filter,
  X,
  BookmarkCheck,
  Crown,
  LayoutGrid,
  List,
  Check,
  Star,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

/* ─────────────────────── Types ─────────────────────── */

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

/* ─────────────────────── Component ─────────────────────── */

export default function AdminPointMatrixPage() {
  const [activeTab, setActiveTab] = useState<"matrix" | "rules" | "history">("matrix");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  const [rules, setRules] = useState<PointRule[]>([]);
  const [talabat, setTalabat] = useState<Talib[]>([]);
  const [logs, setLogs] = useState<PointLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [quickLoadingStudentId, setQuickLoadingStudentId] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [selectedSection, setSelectedSection] = useState("ALL");
  const [selectedTier, setSelectedTier] = useState<"ALL" | "GOLD" | "SILVER" | "BRONZE">("ALL");
  const [sortBy, setSortBy] = useState<"points_desc" | "points_asc" | "name" | "streak">("points_desc");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PointRule | null>(null);

  const [assignForm, setAssignForm] = useState({
    selectedRuleId: "",
    actionName: "",
    category: "General",
    points: 10,
    actionType: "POSITIVE" as "POSITIVE" | "NEGATIVE",
    note: "",
  });

  const [ruleForm, setRuleForm] = useState({
    category: "Academic",
    actionName: "",
    pointValue: "10",
    actionType: "POSITIVE" as "POSITIVE" | "NEGATIVE",
    color: "#d4af37",
    iconName: "star",
  });

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

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

  useEffect(() => { fetchData(); }, []);

  const { availableGrades, availableSections } = useMemo(() => {
    const grades = Array.from(new Set(talabat.map((t) => t.grade).filter(Boolean))).sort();
    const sections = Array.from(new Set(talabat.map((t) => t.section).filter(Boolean))).sort();
    return { availableGrades: grades, availableSections: sections };
  }, [talabat]);

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
      const isGold = t.currentPoints >= 100 || t.tier === "GOLD";
      const isSilver = !isGold && (t.currentPoints >= 50 || t.tier === "SILVER");
      const matchesTier =
        selectedTier === "ALL" ||
        (selectedTier === "GOLD" && isGold) ||
        (selectedTier === "SILVER" && isSilver) ||
        (selectedTier === "BRONZE" && !isGold && !isSilver);
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

  const metrics = useMemo(() => {
    const totalTalabat = talabat.length;
    const totalPointsAwarded = talabat.reduce((acc, t) => acc + (t.currentPoints || 0), 0);
    const activeRulesCount = rules.length;
    const goldCount = talabat.filter((t) => t.currentPoints >= 100 || t.tier === "GOLD").length;
    const silverCount = talabat.filter((t) => (t.currentPoints >= 50 && t.currentPoints < 100) || t.tier === "SILVER").length;
    const avgPoints = totalTalabat > 0 ? Math.round(totalPointsAwarded / totalTalabat) : 0;
    return { totalTalabat, totalPointsAwarded, activeRulesCount, goldCount, silverCount, avgPoints };
  }, [talabat, rules]);

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

  const handleOpenAssignModal = (rule?: PointRule, targetStudentId?: string) => {
    if (targetStudentId) setSelectedStudentIds([targetStudentId]);
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
      setAssignForm({ selectedRuleId: "", actionName: "", category: "Academic", points: 10, actionType: "POSITIVE", note: "" });
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

  const handleAssignPoints = async () => {
    if (selectedStudentIds.length === 0) { showToast("error", "Please select at least one student."); return; }
    if (!assignForm.actionName.trim()) { showToast("error", "Action name / reason is required."); return; }
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

  const handleQuickStudentPoints = async (studentId: string, points: number, actionName: string, category = "Academic") => {
    try {
      setQuickLoadingStudentId(studentId);
      const actionType = points >= 0 ? "POSITIVE" : "NEGATIVE";
      const absPoints = Math.abs(points);
      setTalabat((prev) =>
        prev.map((t) =>
          t.id === studentId
            ? {
                ...t,
                currentPoints: Math.max(0, t.currentPoints + points),
                totalPoints: t.totalPoints + (points > 0 ? points : 0),
                recentLogs: [
                  { id: "temp-" + Date.now(), points: absPoints, actionType, category, note: actionName, createdAt: new Date().toISOString() },
                  ...(t.recentLogs || []),
                ],
              }
            : t
        )
      );
      const res = await fetch("/api/admin/point-rules/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentIds: [studentId], actionName, category, points: absPoints, actionType, note: `Instant score: ${actionName}` }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      showToast("success", `${points >= 0 ? "+" : ""}${points} pts — ${actionName}`);
    } catch (err: any) {
      showToast("error", err.message || "Failed to record points");
      fetchData();
    } finally {
      setQuickLoadingStudentId(null);
    }
  };

  const handleQuickApplyRule = async (rule: PointRule) => {
    if (selectedStudentIds.length === 0) { showToast("error", "Select talabat cards below before applying."); return; }
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
      showToast("success", `Applied "${rule.actionName}" to ${selectedStudentIds.length} talabat`);
      fetchData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to apply rule");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveRule = async () => {
    if (!ruleForm.actionName.trim() || !ruleForm.category.trim() || !ruleForm.pointValue) {
      showToast("error", "Please fill in all rule fields."); return;
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

  const handleDeleteRule = async (id: string, name: string) => {
    if (!confirm(`Delete rule "${name}"?`)) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/admin/point-rules/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete");
      showToast("success", "Rule removed.");
      fetchData();
    } catch (err: any) {
      showToast("error", err.message || "Failed to delete rule");
    } finally {
      setActionLoading(false);
    }
  };

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

  const openCreateRule = () => {
    setEditingRule(null);
    setRuleForm({ category: "Academic", actionName: "", pointValue: "10", actionType: "POSITIVE", color: "#d4af37", iconName: "star" });
    setShowRuleModal(true);
  };

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

  /* ── Tier helpers ── */
  const getTierInfo = (talib: Talib) => {
    const isGold = talib.currentPoints >= 100 || talib.tier === "GOLD";
    const isSilver = !isGold && (talib.currentPoints >= 50 || talib.tier === "SILVER");
    return { isGold, isSilver, isBronze: !isGold && !isSilver };
  };

  /* ── Select input class (shared) ── */
  const selectCls =
    "px-3 py-2 bg-[#faf7f0] border border-[#ddd5c4] rounded-xl text-xs font-semibold text-[#3d3426] focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer";

  const inputCls =
    "w-full px-3.5 py-2.5 bg-[#faf7f0] border border-[#ddd5c4] rounded-xl text-xs sm:text-sm text-[#3d3426] focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-[#97896f]";

  /* ════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen pb-28" style={{ background: "var(--ratio-70-canvas, #faf7f0)" }}>

      {/* ── Toast ── */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.96 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold max-w-[calc(100vw-2rem)] sm:max-w-sm ${
              feedback.type === "success"
                ? "bg-[#1a1408] text-amber-200 border-amber-700/50"
                : "bg-rose-950 text-rose-200 border-rose-700/50"
            }`}
          >
            {feedback.type === "success"
              ? <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            <span className="leading-snug">{feedback.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Container ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-5">

        {/* ════ HEADER BANNER ════ */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl text-white shadow-xl"
          style={{ background: "var(--fatimi-banner-bg, linear-gradient(135deg, #221c14 0%, #191510 55%, #0f0c08 100%))" }}
        >
          {/* Gold shimmer line top */}
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "var(--fatimi-header-line, linear-gradient(90deg, #e7e0d0, #f3b833, #e7e0d0))" }} />

          <div className="relative z-10 p-5 sm:p-7">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">

              {/* Identity block */}
              <div className="flex items-center gap-4">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border border-amber-400/30"
                  style={{ background: "linear-gradient(135deg, #d4af37, #a37a1a)" }}
                >
                  <Crown className="w-7 h-7 text-white" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] text-amber-300 font-semibold mb-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>نظام نقاط الفضيلة · Fatimi Merit Matrix</span>
                  </div>
                  <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                    Talabat Point Matrix
                  </h1>
                  <p className="text-white/60 text-xs mt-0.5 max-w-md leading-relaxed">
                    Dynamic merit scoring engine — real-time allocations and student honour portfolios.
                  </p>
                </div>
              </div>

              {/* Tab switcher + CTA */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Tab pill */}
                <div className="flex bg-white/10 backdrop-blur-sm p-1 rounded-2xl border border-white/15">
                  {(["matrix", "rules", "history"] as const).map((tab) => {
                    const icons = { matrix: <Users className="w-3.5 h-3.5" />, rules: <Settings2 className="w-3.5 h-3.5" />, history: <History className="w-3.5 h-3.5" /> };
                    const labels = { matrix: "Matrix", rules: `Rules (${rules.length})`, history: "Audit" };
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                          activeTab === tab
                            ? "bg-white text-[#1a1408] shadow font-extrabold"
                            : "text-white/70 hover:text-white hover:bg-white/10"
                        }`}
                      >
                        {icons[tab]}
                        <span className="hidden sm:inline">{labels[tab]}</span>
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => handleOpenAssignModal()}
                  className="depth-3d-btn-gold flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-black cursor-pointer transition-all active:scale-95"
                >
                  <Zap className="w-4 h-4" /> Assign Points
                </button>
              </div>
            </div>
          </div>

          {/* Gold shimmer line bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "var(--fatimi-header-line)" }} />
        </motion.div>

        {/* ════ STATS BENTO ════ */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: "Total Talabat",
              value: metrics.totalTalabat,
              sub: "Enrolled Cohort",
              icon: <Users className="w-5 h-5" />,
              accent: "text-amber-700",
              iconBg: "bg-amber-50 border-amber-200/60 text-amber-700",
            },
            {
              label: "Score Pool",
              value: metrics.totalPointsAwarded.toLocaleString(),
              sub: `Avg ${metrics.avgPoints} pts / talib`,
              icon: <Award className="w-5 h-5" />,
              accent: "text-amber-700",
              iconBg: "bg-amber-50 border-amber-200/60 text-amber-700",
            },
            {
              label: "Honors Tiers",
              value: metrics.goldCount,
              sub: `${metrics.silverCount} Silver · ${Math.round(metrics.totalTalabat > 0 ? (metrics.goldCount / metrics.totalTalabat) * 100 : 0)}% elite`,
              icon: <Crown className="w-5 h-5" />,
              accent: "text-amber-800",
              iconBg: "bg-amber-100/60 border-amber-300/60 text-amber-800",
            },
            {
              label: "Scoring Rules",
              value: metrics.activeRulesCount,
              sub: `${logs.length} logged allocations`,
              icon: <BookmarkCheck className="w-5 h-5" />,
              accent: "text-[#6b5f4b]",
              iconBg: "bg-[#f4efe5] border-[#ddd5c4] text-[#6b5f4b]",
            },
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="rounded-2xl border border-[#ddd5c4] bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 h-full">
                <CardContent className="p-4 sm:p-5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#97896f]">{s.label}</p>
                    <p className={`text-2xl sm:text-3xl font-black mt-0.5 leading-none ${s.accent}`}>{s.value}</p>
                    <p className="text-[11px] text-[#97896f] mt-1.5 font-medium leading-tight">{s.sub}</p>
                  </div>
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center border shrink-0 ${s.iconBg}`}>
                    {s.icon}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* ════════════ TAB: MATRIX ════════════ */}
        {activeTab === "matrix" && (
          <div className="space-y-4">

            {/* Standby notice */}
            {logs.length === 0 && !loading && (
              <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200/80 text-amber-950 flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">
                  <span className="font-extrabold text-amber-900">Point Matrix Ready: </span>
                  Use the quick-action cards below or the batch allocator to award merit points. Scores flow dynamically from faculty assessments and milestone events.
                </p>
              </div>
            )}

            {/* ── Quick-Action Rule Ribbon ── */}
            <Card className="rounded-2xl border border-[#ddd5c4] bg-white shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #d4af37, #a37a1a)" }}>
                      <Zap className="w-3.5 h-3.5 text-white fill-white" />
                    </div>
                    <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#221c12]">Quick Actions</h2>
                    {selectedStudentIds.length > 0 && (
                      <span className="text-xs font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full border border-amber-200">
                        {selectedStudentIds.length} selected
                      </span>
                    )}
                  </div>
                  <button
                    onClick={openCreateRule}
                    className="text-xs font-bold text-amber-700 hover:text-amber-900 transition-colors cursor-pointer"
                  >
                    + Add Rule
                  </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {rules.length === 0 ? (
                    <p className="text-xs text-[#97896f] py-1">No rules configured yet.</p>
                  ) : (
                    rules.map((rule) => {
                      const isPos = rule.actionType === "POSITIVE";
                      return (
                        <button
                          key={rule.id}
                          disabled={actionLoading}
                          onClick={() => handleQuickApplyRule(rule)}
                          className={`flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer ${
                            isPos
                              ? "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-200"
                              : "bg-rose-50 hover:bg-rose-100 text-rose-900 border-rose-200"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPos ? "bg-amber-500" : "bg-rose-500"}`} />
                          <span>{rule.actionName}</span>
                          <span className={`px-1.5 py-0.5 rounded-md font-mono text-[10px] font-black ${isPos ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}>
                            {isPos ? "+" : "-"}{rule.pointValue}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* ── Filter Bar ── */}
            <div className="bg-white rounded-2xl border border-[#ddd5c4] p-4 shadow-sm space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#97896f]" />
                <input
                  type="text"
                  placeholder="Search by name, ITS, ID or grade…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 bg-[#faf7f0] border border-[#ddd5c4] rounded-xl text-xs sm:text-sm text-[#3d3426] focus:outline-none focus:ring-2 focus:ring-amber-400 placeholder:text-[#97896f]"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#97896f] hover:text-[#3d3426]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-2">
                <select aria-label="Grade" value={selectedGrade} onChange={(e) => setSelectedGrade(e.target.value)} className={selectCls}>
                  <option value="ALL">All Grades</option>
                  {availableGrades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>

                <select aria-label="Section" value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} className={selectCls}>
                  <option value="ALL">All Sections</option>
                  {availableSections.map((s) => <option key={s} value={s}>Sec {s}</option>)}
                </select>

                <select aria-label="Tier" value={selectedTier} onChange={(e) => setSelectedTier(e.target.value as any)} className={selectCls}>
                  <option value="ALL">All Tiers</option>
                  <option value="GOLD">👑 Gold (100+ pts)</option>
                  <option value="SILVER">🥈 Silver (50+ pts)</option>
                  <option value="BRONZE">🥉 Bronze</option>
                </select>

                <select aria-label="Sort" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className={selectCls}>
                  <option value="points_desc">Points: High → Low</option>
                  <option value="points_asc">Points: Low → High</option>
                  <option value="name">Alphabetical</option>
                  <option value="streak">Streak Days</option>
                </select>

                {/* Select All */}
                <button
                  onClick={handleSelectAll}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border border-[#ddd5c4] bg-[#faf7f0] text-[#3d3426] hover:border-amber-400 transition-colors cursor-pointer"
                >
                  {selectedStudentIds.length === filteredTalabat.length && filteredTalabat.length > 0
                    ? <><CheckSquare className="w-3.5 h-3.5 text-amber-600" /> Deselect All</>
                    : <><Square className="w-3.5 h-3.5 text-[#97896f]" /> Select All ({filteredTalabat.length})</>}
                </button>

                {/* View Switcher */}
                <div className="flex items-center bg-[#f4efe5] p-1 rounded-xl border border-[#ddd5c4] ml-auto">
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    title="Card Grid"
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "grid" ? "bg-white text-amber-700 shadow-sm" : "text-[#97896f] hover:text-[#3d3426]"}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("table")}
                    title="Table View"
                    className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewMode === "table" ? "bg-white text-amber-700 shadow-sm" : "text-[#97896f] hover:text-[#3d3426]"}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Loading / Empty / Content ── */}
            {loading ? (
              <div className="p-16 text-center bg-white rounded-2xl border border-[#ddd5c4]">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-600" />
                <p className="text-sm font-semibold text-[#6b5f4b]">Loading merit matrix…</p>
              </div>
            ) : filteredTalabat.length === 0 ? (
              <div className="p-16 text-center bg-white rounded-2xl border border-[#ddd5c4]">
                <Users className="w-10 h-10 mx-auto mb-3 text-[#ddd5c4]" />
                <p className="text-sm font-bold text-[#3d3426]">No Talabat found</p>
                <p className="text-xs text-[#97896f] mt-1">Adjust filters or search keywords.</p>
              </div>
            ) : viewMode === "grid" ? (

              /* ════ GRID CARDS ════ */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredTalabat.map((talib) => {
                  const isSelected = selectedStudentIds.includes(talib.id);
                  const latestLog = talib.recentLogs?.[0];
                  const { isGold, isSilver } = getTierInfo(talib);
                  const isUpdating = quickLoadingStudentId === talib.id;

                  return (
                    <motion.div
                      key={talib.id}
                      layout
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`group relative rounded-2xl p-4 border flex flex-col transition-all duration-200 ${
                        isSelected
                          ? "bg-amber-50/80 border-amber-400 ring-2 ring-amber-300/40 shadow-md"
                          : "bg-white border-[#ddd5c4] hover:border-amber-300 hover:shadow-lg hover:-translate-y-0.5"
                      }`}
                    >
                      {/* Top Bar: Checkbox + Grade + Tier */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleStudentSelection(talib.id)}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                              isSelected
                                ? "bg-amber-600 border-amber-600 text-white"
                                : "border-[#ddd5c4] hover:border-amber-400 bg-[#faf7f0]"
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          <Badge variant="outline" className="text-[10px] font-semibold border-[#ddd5c4] bg-[#faf7f0] text-[#6b5f4b]">
                            Gr {talib.grade} · {talib.section}
                          </Badge>
                        </div>

                        {/* Tier badge */}
                        {isGold ? (
                          <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white font-black text-[9px] uppercase tracking-wider border-0 flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5 fill-amber-100" /> Gold
                          </Badge>
                        ) : isSilver ? (
                          <Badge className="bg-slate-200 text-slate-700 font-bold text-[9px] uppercase tracking-wider border-0 flex items-center gap-0.5">
                            <ShieldCheck className="w-2.5 h-2.5" /> Silver
                          </Badge>
                        ) : (
                          <Badge className="bg-[#f4efe5] text-[#6b5f4b] border border-[#ddd5c4] font-bold text-[9px] uppercase tracking-wider flex items-center gap-0.5">
                            <Star className="w-2.5 h-2.5" /> Bronze
                          </Badge>
                        )}
                      </div>

                      {/* Avatar + Identity */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="relative shrink-0">
                          <Avatar className="w-11 h-11 rounded-xl border-2 border-amber-100 shadow-sm">
                            {talib.avatarUrl && <AvatarImage src={talib.avatarUrl} alt={talib.name} />}
                            <AvatarFallback className="bg-gradient-to-br from-[#1a1408] to-amber-700 text-amber-100 font-bold text-xs rounded-xl">
                              {getInitials(talib.firstName, talib.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          {talib.streakDays > 0 && (
                            <div
                              className="absolute -bottom-1 -right-1 bg-amber-500 text-white text-[9px] font-black px-1 py-0.5 rounded-full shadow-sm flex items-center gap-0.5"
                              title={`${talib.streakDays} day streak`}
                            >
                              <Flame className="w-2.5 h-2.5 fill-white" />
                              {talib.streakDays}d
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-[#221c12] text-sm leading-snug truncate" title={talib.name}>
                            {talib.name}
                          </h3>
                          <p className="text-[11px] font-mono text-[#97896f] truncate">
                            {talib.its ? `ITS: ${talib.its}` : talib.studentId}
                          </p>
                        </div>
                      </div>

                      {/* Score Gauge */}
                      <div className="p-3 rounded-xl bg-[#faf7f0] border border-[#ddd5c4] flex items-center justify-between mb-3">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#97896f] block">Merit Balance</span>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="text-2xl font-black text-amber-700 leading-none">{talib.currentPoints}</span>
                            <span className="text-xs font-bold text-amber-600 uppercase">pts</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-[#97896f] block">Lifetime</span>
                          <span className="text-xs font-mono font-bold text-[#6b5f4b]">{talib.totalPoints} pts</span>
                        </div>
                      </div>

                      {/* Micro-Action Buttons */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#97896f]">Quick Score</span>
                          {isUpdating && <Loader2 className="w-3 h-3 animate-spin text-amber-600" />}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                          {[
                            { pts: 5,  label: "+5",  cls: "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200",  action: "Class Participation", cat: "Academic" },
                            { pts: 10, label: "+10", cls: "bg-amber-100/70 hover:bg-amber-200/70 text-amber-900 border-amber-300", action: "Academic Excellence", cat: "Academic" },
                            { pts: 25, label: "+25", cls: "bg-[#f4efe5] hover:bg-[#ece5d6] text-[#6b5f4b] border-[#ddd5c4]", action: "Hifz Milestone", cat: "Hifz" },
                            { pts: -5, label: "−5",  cls: "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200",  action: "Disciplinary", cat: "Conduct" },
                          ].map((btn) => (
                            <button
                              key={btn.pts}
                              type="button"
                              disabled={actionLoading || isUpdating}
                              onClick={() => handleQuickStudentPoints(talib.id, btn.pts, btn.action, btn.cat)}
                              className={`py-1.5 rounded-xl font-black text-xs border transition-all active:scale-95 cursor-pointer text-center ${btn.cls} disabled:opacity-50`}
                              title={btn.action}
                            >
                              {btn.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Latest log ribbon */}
                      {latestLog ? (
                        <div className="py-1.5 px-2.5 rounded-xl bg-[#faf7f0] border border-[#ddd5c4] text-[11px] flex items-center justify-between mb-3">
                          <span className="truncate max-w-[140px] font-medium text-[#6b5f4b]" title={latestLog.note || latestLog.category}>
                            {latestLog.note || latestLog.category}
                          </span>
                          <span className={`font-bold shrink-0 ${latestLog.actionType === "POSITIVE" ? "text-amber-700" : "text-rose-600"}`}>
                            {latestLog.actionType === "POSITIVE" ? "+" : "−"}{latestLog.points} pts
                          </span>
                        </div>
                      ) : (
                        <div className="py-1.5 px-2.5 rounded-xl bg-[#faf7f0]/60 text-[11px] text-[#97896f] italic mb-3">
                          No recent point actions
                        </div>
                      )}

                      {/* Footer CTA */}
                      <button
                        onClick={() => handleOpenAssignModal(undefined, talib.id)}
                        className="mt-auto w-full py-2 rounded-xl border border-[#ddd5c4] bg-[#faf7f0] hover:bg-amber-50 hover:border-amber-300 text-xs font-bold text-[#6b5f4b] hover:text-amber-800 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3 h-3 text-amber-500" /> Custom Points
                      </button>
                    </motion.div>
                  );
                })}
              </div>

            ) : (

              /* ════ TABLE VIEW ════ */
              <Card className="rounded-2xl border border-[#ddd5c4] bg-white shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#faf7f0] border-b border-[#ddd5c4] text-[11px] uppercase tracking-wider text-[#97896f]">
                        <th className="py-3 px-4 w-10">
                          <input type="checkbox" checked={selectedStudentIds.length === filteredTalabat.length && filteredTalabat.length > 0} onChange={handleSelectAll} className="rounded border-[#ddd5c4] text-amber-600 focus:ring-amber-500 cursor-pointer" />
                        </th>
                        <th className="py-3 px-4">Talib</th>
                        <th className="py-3 px-4">Grade</th>
                        <th className="py-3 px-4">ITS / ID</th>
                        <th className="py-3 px-4 text-center">Score</th>
                        <th className="py-3 px-4">Last Action</th>
                        <th className="py-3 px-4 text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f0eadb] text-xs">
                      {filteredTalabat.map((talib) => {
                        const isSelected = selectedStudentIds.includes(talib.id);
                        const latestLog = talib.recentLogs?.[0];
                        return (
                          <tr key={talib.id} className={`transition-colors hover:bg-[#faf7f0] ${isSelected ? "bg-amber-50/50" : ""}`}>
                            <td className="py-3 px-4">
                              <input type="checkbox" checked={isSelected} onChange={() => toggleStudentSelection(talib.id)} className="rounded border-[#ddd5c4] text-amber-600 focus:ring-amber-500 cursor-pointer" />
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#1a1408] to-amber-700 text-amber-100 flex items-center justify-center font-bold text-xs shadow-sm shrink-0">
                                  {talib.avatarUrl
                                    ? <img src={talib.avatarUrl} alt={talib.name} className="w-full h-full rounded-lg object-cover" />
                                    : talib.firstName?.[0] || "T"}
                                </div>
                                <div>
                                  <p className="text-[#221c12] font-semibold">{talib.name}</p>
                                  <p className="text-[11px] text-[#97896f]">{talib.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <Badge variant="outline" className="text-[11px] font-medium border-[#ddd5c4] bg-[#faf7f0] text-[#6b5f4b]">
                                Grade {talib.grade} – {talib.section}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 font-mono text-[#97896f]">
                              <div>{talib.its || "—"}</div>
                              <div className="text-[10px] text-[#97896f]/70">{talib.studentId}</div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="inline-flex flex-col items-center">
                                <span className="text-sm font-black text-amber-700">{talib.currentPoints} pts</span>
                                <span className="text-[10px] text-[#97896f]">Total: {talib.totalPoints}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              {latestLog ? (
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-semibold ${latestLog.actionType === "POSITIVE" ? "text-amber-700" : "text-rose-600"}`}>
                                    {latestLog.actionType === "POSITIVE" ? "+" : "−"}{latestLog.points}
                                  </span>
                                  <span className="text-[#97896f] truncate max-w-[120px]">{latestLog.category}</span>
                                </div>
                              ) : <span className="text-[#97896f]">No records</span>}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-2 text-amber-700 hover:bg-amber-50 border-amber-200 cursor-pointer text-xs"
                                onClick={() => handleOpenAssignModal(undefined, talib.id)}
                              >
                                <Plus className="w-3 h-3 mr-1" /> Points
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* ── Floating Batch Dock ── */}
            <AnimatePresence>
              {selectedStudentIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-auto sm:bottom-6 sm:-translate-x-1/2 sm:left-1/2 z-40 depth-3d-dock px-4 sm:px-6 py-3 rounded-2xl flex flex-wrap items-center gap-3 text-xs sm:text-sm sm:w-max"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500 text-[#1a1408] flex items-center justify-center font-black text-xs">
                      {selectedStudentIds.length}
                    </div>
                    <span className="font-bold text-white/90">Talabat Selected</span>
                  </div>
                  <div className="h-4 w-px bg-white/20" />
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-400 text-[#1a1408] font-black text-xs rounded-xl cursor-pointer"
                      onClick={() => { setAssignForm({ selectedRuleId: "", actionName: "Commendable Performance", category: "Academic", points: 10, actionType: "POSITIVE", note: "" }); setShowAssignModal(true); }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Award
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-500/50 text-rose-300 hover:bg-rose-950/60 font-bold text-xs rounded-xl cursor-pointer"
                      onClick={() => { setAssignForm({ selectedRuleId: "", actionName: "Disciplinary Deduction", category: "Conduct", points: 5, actionType: "NEGATIVE", note: "" }); setShowAssignModal(true); }}
                    >
                      <TrendingDown className="w-3.5 h-3.5 mr-1" /> Deduct
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white/50 hover:text-white text-xs cursor-pointer"
                      onClick={() => setSelectedStudentIds([])}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ════════════ TAB: RULES ════════════ */}
        {activeTab === "rules" && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#221c12]">Scoring Rules</h2>
                <p className="text-xs text-[#97896f]">Configure predefined positive and negative point values for swift one-click scoring.</p>
              </div>
              <Button onClick={openCreateRule} className="bg-[#1a1408] hover:bg-[#2d2010] text-amber-300 rounded-xl text-xs font-bold cursor-pointer border border-amber-700/30">
                <Plus className="w-4 h-4 mr-1.5" /> New Rule
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Positive */}
              <Card className="rounded-2xl border border-[#ddd5c4] bg-white shadow-sm">
                <CardHeader className="pb-3 border-b border-[#f0eadb]">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-amber-800">
                      <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700"><TrendingUp className="w-4 h-4" /></div>
                      Positive Actions ({rules.filter((r) => r.actionType === "POSITIVE").length})
                    </CardTitle>
                    <Badge className="bg-amber-100 text-amber-900 border-0 font-bold text-xs">Reward Pool</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {rules.filter((r) => r.actionType === "POSITIVE").length === 0 ? (
                    <p className="text-center text-xs text-[#97896f] py-8">No positive rules configured yet.</p>
                  ) : (
                    rules.filter((r) => r.actionType === "POSITIVE").map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-100 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">+{rule.pointValue}</div>
                          <div>
                            <p className="text-xs font-semibold text-[#221c12]">{rule.actionName}</p>
                            <p className="text-[11px] text-[#97896f]">{rule.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#97896f] hover:text-amber-700 cursor-pointer" onClick={() => openEditRule(rule)}><Edit3 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#97896f] hover:text-rose-600 cursor-pointer" onClick={() => handleDeleteRule(rule.id, rule.actionName)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Negative */}
              <Card className="rounded-2xl border border-[#ddd5c4] bg-white shadow-sm">
                <CardHeader className="pb-3 border-b border-[#f0eadb]">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-rose-700">
                      <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600"><TrendingDown className="w-4 h-4" /></div>
                      Penalty Actions ({rules.filter((r) => r.actionType === "NEGATIVE").length})
                    </CardTitle>
                    <Badge className="bg-rose-100 text-rose-800 border-0 font-bold text-xs">Discipline Pool</Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {rules.filter((r) => r.actionType === "NEGATIVE").length === 0 ? (
                    <p className="text-center text-xs text-[#97896f] py-8">No penalty rules configured yet.</p>
                  ) : (
                    rules.filter((r) => r.actionType === "NEGATIVE").map((rule) => (
                      <div key={rule.id} className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 border border-rose-100 hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold text-xs">−{rule.pointValue}</div>
                          <div>
                            <p className="text-xs font-semibold text-[#221c12]">{rule.actionName}</p>
                            <p className="text-[11px] text-[#97896f]">{rule.category}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#97896f] hover:text-amber-700 cursor-pointer" onClick={() => openEditRule(rule)}><Edit3 className="w-3.5 h-3.5" /></Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-[#97896f] hover:text-rose-600 cursor-pointer" onClick={() => handleDeleteRule(rule.id, rule.actionName)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* ════════════ TAB: HISTORY ════════════ */}
        {activeTab === "history" && (
          <Card className="rounded-2xl border border-[#ddd5c4] bg-white shadow-sm overflow-hidden">
            <CardHeader className="border-b border-[#f0eadb] pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-[#221c12] flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-600" /> Live Audit Log &amp; Reversals
                  </CardTitle>
                  <CardDescription className="text-xs text-[#97896f]">Chronological ledger of point assignments with one-click undo.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} className="text-xs rounded-xl cursor-pointer border-[#ddd5c4]">Refresh</Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-[#f0eadb] text-xs">
                {logs.length === 0 ? (
                  <p className="text-center text-[#97896f] py-12">No point transactions recorded yet.</p>
                ) : (
                  logs.map((log) => {
                    const isPos = log.actionType === "POSITIVE";
                    return (
                      <div
                        key={log.id}
                        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${log.isUndone ? "opacity-40 line-through bg-[#faf7f0]" : ""}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${isPos ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-700"}`}>
                            {isPos ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-semibold text-[#221c12]">
                              {log.student?.user?.firstName} {log.student?.user?.lastName}
                              <span className="text-[#97896f] font-normal ml-2">
                                received {isPos ? "+" : "−"}{log.points} pts
                              </span>
                            </p>
                            <p className="text-[#97896f]">{log.category}{log.note ? ` — "${log.note}"` : ""}</p>
                            <p className="text-[10px] text-[#97896f]/70 mt-0.5">
                              By {log.teacher?.user?.firstName || "Admin"} · {new Date(log.createdAt).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        {!log.isUndone && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={actionLoading}
                            className="text-xs text-[#97896f] hover:text-rose-600 hover:bg-rose-50 rounded-xl cursor-pointer"
                            onClick={() => handleUndoLog(log.id)}
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Revert
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

      {/* ════ MODAL: ASSIGN POINTS ════ */}
      <Modal open={showAssignModal} onOpenChange={setShowAssignModal}>
        <ModalContent className="max-w-lg rounded-3xl p-6 bg-white border border-[#ddd5c4]">
          <ModalHeader>
            <ModalTitle className="text-base font-bold flex items-center gap-2 text-[#221c12]">
              <Sparkles className="w-4 h-4 text-amber-500" /> Assign Points
            </ModalTitle>
          </ModalHeader>

          <div className="space-y-4 py-3 text-xs sm:text-sm">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between">
              <span className="text-amber-900 font-semibold">Recipients:</span>
              <Badge className="bg-amber-700 text-white border-0 font-bold">{selectedStudentIds.length} Talib(s)</Badge>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6b5f4b] mb-1">Preset Rule (Optional)</label>
              <select aria-label="Preset Rule" value={assignForm.selectedRuleId} onChange={(e) => handleRuleSelectChange(e.target.value)} className={inputCls}>
                <option value="">— Choose a rule or enter custom —</option>
                {rules.map((r) => (
                  <option key={r.id} value={r.id}>{r.actionName} ({r.actionType === "POSITIVE" ? "+" : "−"}{r.pointValue} pts) [{r.category}]</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6b5f4b] mb-1">Action Name / Reason *</label>
              <input type="text" placeholder="e.g. Completed Hifz Revision, Exemplary Adab" value={assignForm.actionName} onChange={(e) => setAssignForm({ ...assignForm, actionName: e.target.value })} className={inputCls} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6b5f4b] mb-1.5">Quick Tokens</label>
              <div className="flex flex-wrap gap-1.5">
                {[5, 10, 15, 20, 25, 50].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAssignForm((prev) => ({ ...prev, points: val }))}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer border ${
                      assignForm.points === val ? "bg-amber-600 text-white border-amber-600 shadow-sm" : "bg-[#faf7f0] text-[#6b5f4b] border-[#ddd5c4] hover:border-amber-400"
                    }`}
                  >
                    {assignForm.actionType === "POSITIVE" ? "+" : "−"}{val}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#6b5f4b] mb-1">Category</label>
                <input type="text" placeholder="e.g. Quran, Adab, Khidmat" value={assignForm.category} onChange={(e) => setAssignForm({ ...assignForm, category: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6b5f4b] mb-1">Point Value *</label>
                <input type="number" min="1" value={assignForm.points} onChange={(e) => setAssignForm({ ...assignForm, points: parseInt(e.target.value) || 0 })} className={`${inputCls} font-mono font-bold`} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6b5f4b] mb-1.5">Impact Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setAssignForm({ ...assignForm, actionType: "POSITIVE" })} className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${assignForm.actionType === "POSITIVE" ? "bg-amber-600 text-white border-amber-600" : "bg-[#faf7f0] text-[#6b5f4b] border-[#ddd5c4]"}`}>
                  <TrendingUp className="w-3.5 h-3.5" /> Positive Award (+)
                </button>
                <button type="button" onClick={() => setAssignForm({ ...assignForm, actionType: "NEGATIVE" })} className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${assignForm.actionType === "NEGATIVE" ? "bg-rose-600 text-white border-rose-600" : "bg-[#faf7f0] text-[#6b5f4b] border-[#ddd5c4]"}`}>
                  <TrendingDown className="w-3.5 h-3.5" /> Penalty Deduction (−)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6b5f4b] mb-1">Note (Optional)</label>
              <input type="text" placeholder="e.g. Excellent recitation during morning session" value={assignForm.note} onChange={(e) => setAssignForm({ ...assignForm, note: e.target.value })} className={inputCls} />
            </div>
          </div>

          <ModalFooter className="flex items-center justify-end gap-2 pt-4 border-t border-[#f0eadb]">
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="rounded-xl cursor-pointer border-[#ddd5c4] text-[#6b5f4b]">Cancel</Button>
            </ModalClose>
            <Button
              size="sm"
              disabled={actionLoading || selectedStudentIds.length === 0 || !assignForm.actionName.trim()}
              onClick={handleAssignPoints}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Confirm &amp; Assign
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ════ MODAL: CREATE / EDIT RULE ════ */}
      <Modal open={showRuleModal} onOpenChange={setShowRuleModal}>
        <ModalContent className="max-w-md rounded-3xl p-6 bg-white border border-[#ddd5c4]">
          <ModalHeader>
            <ModalTitle className="text-base font-bold text-[#221c12]">
              {editingRule ? "Edit Rule" : "Create Scoring Rule"}
            </ModalTitle>
          </ModalHeader>

          <div className="space-y-4 py-3 text-xs sm:text-sm">
            <div>
              <label className="block text-xs font-semibold text-[#6b5f4b] mb-1">Action Name *</label>
              <input type="text" placeholder="e.g. Hifz Excellence, Peer Mentoring" value={ruleForm.actionName} onChange={(e) => setRuleForm({ ...ruleForm, actionName: e.target.value })} className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#6b5f4b] mb-1">Category *</label>
                <input type="text" placeholder="e.g. Hifz, Adab, Conduct" value={ruleForm.category} onChange={(e) => setRuleForm({ ...ruleForm, category: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#6b5f4b] mb-1">Point Value *</label>
                <input type="number" min="1" value={ruleForm.pointValue} onChange={(e) => setRuleForm({ ...ruleForm, pointValue: e.target.value })} className={`${inputCls} font-mono font-bold`} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6b5f4b] mb-1.5">Rule Type *</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setRuleForm({ ...ruleForm, actionType: "POSITIVE" })} className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${ruleForm.actionType === "POSITIVE" ? "bg-amber-600 text-white border-amber-600" : "bg-[#faf7f0] text-[#6b5f4b] border-[#ddd5c4]"}`}>
                  <TrendingUp className="w-3.5 h-3.5" /> Positive (+)
                </button>
                <button type="button" onClick={() => setRuleForm({ ...ruleForm, actionType: "NEGATIVE" })} className={`py-2.5 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${ruleForm.actionType === "NEGATIVE" ? "bg-rose-600 text-white border-rose-600" : "bg-[#faf7f0] text-[#6b5f4b] border-[#ddd5c4]"}`}>
                  <TrendingDown className="w-3.5 h-3.5" /> Penalty (−)
                </button>
              </div>
            </div>
          </div>

          <ModalFooter className="flex items-center justify-end gap-2 pt-4 border-t border-[#f0eadb]">
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="rounded-xl cursor-pointer border-[#ddd5c4] text-[#6b5f4b]">Cancel</Button>
            </ModalClose>
            <Button
              size="sm"
              disabled={actionLoading || !ruleForm.actionName.trim() || !ruleForm.category.trim()}
              onClick={handleSaveRule}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer"
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
