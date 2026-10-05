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
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  X,
  BookmarkCheck,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";

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

  // Data states
  const [rules, setRules] = useState<PointRule[]>([]);
  const [talabat, setTalabat] = useState<Talib[]>([]);
  const [logs, setLogs] = useState<PointLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters & Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [selectedSection, setSelectedSection] = useState("ALL");
  const [selectedTier, setSelectedTier] = useState("ALL");
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
    color: "#10b981",
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

  // Filtered Talabat
  const filteredTalabat = useMemo(() => {
    return talabat.filter((t) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.studentId.toLowerCase().includes(q) ||
        (t.its && t.its.toLowerCase().includes(q)) ||
        `${t.grade} ${t.section}`.toLowerCase().includes(q);

      const matchesGrade = selectedGrade === "ALL" || t.grade === selectedGrade;
      const matchesSection = selectedSection === "ALL" || t.section === selectedSection;
      const matchesTier = selectedTier === "ALL" || t.tier.toUpperCase() === selectedTier.toUpperCase();

      return matchesSearch && matchesGrade && matchesSection && matchesTier;
    });
  }, [talabat, searchQuery, selectedGrade, selectedSection, selectedTier]);

  // Metrics
  const metrics = useMemo(() => {
    const totalTalabat = talabat.length;
    const totalPointsAwarded = talabat.reduce((acc, t) => acc + (t.currentPoints || 0), 0);
    const platinumCount = talabat.filter((t) => t.tier === "PLATINUM").length;
    const goldCount = talabat.filter((t) => t.tier === "GOLD").length;
    const activeRulesCount = rules.length;

    return { totalTalabat, totalPointsAwarded, platinumCount, goldCount, activeRulesCount };
  }, [talabat, rules]);

  // Handle Select All
  const handleSelectAll = () => {
    if (selectedStudentIds.length === filteredTalabat.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredTalabat.map((t) => t.id));
    }
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Open Quick Award Modal for specific rule or selected students
  const handleOpenAssignModal = (rule?: PointRule, specificStudentId?: string) => {
    if (specificStudentId) {
      setSelectedStudentIds([specificStudentId]);
    }

    if (rule) {
      setAssignForm({
        selectedRuleId: rule.id,
        actionName: rule.actionName,
        category: rule.category,
        points: rule.pointValue,
        actionType: rule.actionType,
        note: "",
      });
    } else {
      setAssignForm({
        selectedRuleId: "",
        actionName: "",
        category: "General",
        points: 10,
        actionType: "POSITIVE",
        note: "",
      });
    }
    setShowAssignModal(true);
  };

  // Select a Decided Action Rule from list
  const handleRuleSelectChange = (ruleId: string) => {
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) {
      setAssignForm((prev) => ({
        ...prev,
        selectedRuleId: rule.id,
        actionName: rule.actionName,
        category: rule.category,
        points: rule.pointValue,
        actionType: rule.actionType,
      }));
    } else {
      setAssignForm((prev) => ({
        ...prev,
        selectedRuleId: "",
      }));
    }
  };

  // Submit Point Assignment
  const handleAssignPoints = async () => {
    if (selectedStudentIds.length === 0) {
      showToast("error", "Please select at least one student.");
      return;
    }

    if (!assignForm.actionName.trim()) {
      showToast("error", "Action name is required.");
      return;
    }

    try {
      setActionLoading(true);
      const res = await fetch("/api/admin/point-rules/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds: selectedStudentIds,
          matrixId: assignForm.selectedRuleId || null,
          actionName: assignForm.actionName,
          category: assignForm.category,
          points: assignForm.points,
          actionType: assignForm.actionType,
          note: assignForm.note,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to assign points");
      }

      showToast("success", data.message || "Points successfully awarded!");
      setShowAssignModal(false);
      setSelectedStudentIds([]);
      // Refresh matrix
      fetchData();
    } catch (err: any) {
      showToast("error", err.message || "Error assigning points");
    } finally {
      setActionLoading(false);
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
      color: "#10b981",
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
      color: rule.color || (rule.actionType === "POSITIVE" ? "#10b981" : "#ef4444"),
      iconName: rule.iconName || "star",
    });
    setShowRuleModal(true);
  };

  // Tier color mapper
  const getTierBadge = (tier: string) => {
    switch (tier.toUpperCase()) {
      case "PLATINUM":
        return <Badge className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-0 shadow-sm">💎 Platinum</Badge>;
      case "GOLD":
        return <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-white border-0 shadow-sm">🥇 Gold</Badge>;
      case "SILVER":
        return <Badge className="bg-gradient-to-r from-slate-300 to-slate-500 text-white border-0 shadow-sm">🥈 Silver</Badge>;
      default:
        return <Badge className="bg-gradient-to-r from-orange-400 to-amber-700 text-white border-0 shadow-sm">🥉 Bronze</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950 pb-24 text-slate-900 dark:text-slate-100">
      {/* Toast Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium backdrop-blur-md ${
              feedback.type === "success"
                ? "bg-emerald-500/90 text-white border-emerald-400"
                : "bg-rose-500/90 text-white border-rose-400"
            }`}
          >
            {feedback.type === "success" ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {feedback.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">
        
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400">
                <Sparkles className="w-6 h-6" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 dark:from-white dark:via-indigo-200 dark:to-slate-300 bg-clip-text text-transparent">
                Point Matrix Hub
              </h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Dynamic scoring engine, live Talabat matrix, and decided action point allocation.
            </p>
          </div>

          {/* Quick Action Navigation */}
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-200/70 dark:bg-slate-900 p-1 rounded-xl border border-slate-200/80 dark:border-slate-800">
              <button
                onClick={() => setActiveTab("matrix")}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "matrix"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Users className="w-4 h-4" /> Talabat Matrix
              </button>
              <button
                onClick={() => setActiveTab("rules")}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "rules"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Settings2 className="w-4 h-4" /> Decided Rules ({rules.length})
              </button>
              <button
                onClick={() => setActiveTab("history")}
                className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "history"
                    ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <History className="w-4 h-4" /> Audit Feed
              </button>
            </div>

            <Button
              variant="default"
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5 rounded-xl text-xs sm:text-sm"
              onClick={() => handleOpenAssignModal()}
            >
              <Zap className="w-4 h-4" /> Assign Points
            </Button>
          </div>
        </div>

        {/* Hero Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/60 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Talabat</p>
                <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{metrics.totalTalabat}</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> All active profiles
                </p>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                <Users className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/60 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Score Pool</p>
                <p className="text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                  {metrics.totalPointsAwarded.toLocaleString()}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">Active points tally</p>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <Award className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/60 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Decided Action Rules</p>
                <p className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{metrics.activeRulesCount}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Preset scoring criteria</p>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-2xl">
                <BookmarkCheck className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900/60 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Elite Champions</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-bold text-cyan-600 dark:text-cyan-400">{metrics.platinumCount} 💎</span>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span className="text-xl font-bold text-amber-500">{metrics.goldCount} 🥇</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">Platinum & Gold tiers</p>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <Flame className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ======================= TAB 1: TALABAT MATRIX ======================= */}
        {activeTab === "matrix" && (
          <div className="space-y-6">
            
            {/* Decided Actions Quick-Bar */}
            <Card className="border-indigo-100 dark:border-indigo-950 bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/70 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/40 shadow-sm">
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Decided Quick Actions
                    </h2>
                    <span className="text-xs text-slate-400 font-normal">
                      (Select students below $\rightarrow$ click action to apply instantly)
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 p-0 h-auto"
                    onClick={openCreateRule}
                  >
                    + Add New Rule Preset
                  </Button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
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
                          className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${
                            isPositive
                              ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200/80 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800/60"
                              : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-200/80 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800/60"
                          }`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isPositive ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          <span className="font-semibold">{rule.actionName}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                              isPositive
                                ? "bg-emerald-200/70 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200"
                                : "bg-rose-200/70 text-rose-900 dark:bg-rose-900 dark:text-rose-200"
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

            {/* Filter Bar & Search */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Talabat by name, ITS, ID, or Grade..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Grade Filter */}
                <select
                  aria-label="Filter by Grade"
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
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
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
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
                  onChange={(e) => setSelectedTier(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                >
                  <option value="ALL">All Tiers</option>
                  <option value="PLATINUM">💎 Platinum</option>
                  <option value="GOLD">🥇 Gold</option>
                  <option value="SILVER">🥈 Silver</option>
                  <option value="BRONZE">🥉 Bronze</option>
                </select>

                {/* Bulk Select All */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                  className="text-xs rounded-xl border-slate-200 dark:border-slate-800 flex items-center gap-1.5"
                >
                  {selectedStudentIds.length === filteredTalabat.length && filteredTalabat.length > 0 ? (
                    <>
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> Deselect All
                    </>
                  ) : (
                    <>
                      <Square className="w-3.5 h-3.5 text-slate-400" /> Select All ({filteredTalabat.length})
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Talabat Matrix Table / Grid */}
            <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
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
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="py-3.5 px-4">Talib</th>
                      <th className="py-3.5 px-4">Grade & Section</th>
                      <th className="py-3.5 px-4">ITS / ID</th>
                      <th className="py-3.5 px-4">Tier Status</th>
                      <th className="py-3.5 px-4 text-center">Score Balance</th>
                      <th className="py-3.5 px-4">Recent Point Action</th>
                      <th className="py-3.5 px-4 text-right">Quick Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs sm:text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
                          Loading Talabat point matrix...
                        </td>
                      </tr>
                    ) : filteredTalabat.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No Talabat found matching your search and filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredTalabat.map((talib) => {
                        const isSelected = selectedStudentIds.includes(talib.id);
                        const latestLog = talib.recentLogs?.[0];

                        return (
                          <tr
                            key={talib.id}
                            className={`transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                              isSelected
                                ? "bg-indigo-50/60 dark:bg-indigo-950/20"
                                : ""
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleStudentSelection(talib.id)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="py-3.5 px-4 font-medium">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-sm">
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
                                  <p className="text-slate-900 dark:text-white font-semibold flex items-center gap-1.5">
                                    {talib.name}
                                    {talib.streakDays > 2 && (
                                      <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 flex items-center gap-0.5">
                                        <Flame className="w-2.5 h-2.5 text-amber-500" /> {talib.streakDays}d
                                      </span>
                                    )}
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
                            <td className="py-3.5 px-4">
                              {getTierBadge(talib.tier)}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <div className="inline-flex flex-col items-center">
                                <span className="text-base font-bold text-indigo-600 dark:text-indigo-400">
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
                                  className="h-8 px-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                                  title="Award Points"
                                  onClick={() => handleOpenAssignModal(undefined, talib.id)}
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" /> Points
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Floating Selection Action Deck */}
            <AnimatePresence>
              {selectedStudentIds.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 30 }}
                  className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/90 dark:bg-slate-900/95 text-white backdrop-blur-xl border border-slate-700/80 px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 text-xs sm:text-sm"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xs">
                      {selectedStudentIds.length}
                    </div>
                    <span className="font-medium text-slate-200">Talabat Selected</span>
                  </div>

                  <div className="h-4 w-px bg-slate-700" />

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-xl shadow-sm"
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
                      className="border-rose-500/50 text-rose-300 hover:bg-rose-950/60 font-medium text-xs rounded-xl"
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
                      className="text-slate-400 hover:text-white text-xs"
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
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add New Rule
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Positive Rules Deck */}
              <Card className="border-emerald-100 dark:border-emerald-950/60 bg-white dark:bg-slate-900 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600">
                        <TrendingUp className="w-4 h-4" />
                      </div>
                      Positive Actions ({rules.filter((r) => r.actionType === "POSITIVE").length})
                    </CardTitle>
                    <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-0">
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
                          className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100/80 dark:border-emerald-900/40 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
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
                              className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600"
                              onClick={() => openEditRule(rule)}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-rose-600"
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
              <Card className="border-rose-100 dark:border-rose-950/60 bg-white dark:bg-slate-900 shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-rose-700 dark:text-rose-400">
                      <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600">
                        <TrendingDown className="w-4 h-4" />
                      </div>
                      Negative / Penalty Actions ({rules.filter((r) => r.actionType === "NEGATIVE").length})
                    </CardTitle>
                    <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-0">
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
                          className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/80 dark:border-rose-900/40 hover:shadow-sm transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300 flex items-center justify-center font-bold text-xs">
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
                              className="h-7 w-7 p-0 text-slate-500 hover:text-indigo-600"
                              onClick={() => openEditRule(rule)}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-slate-500 hover:text-rose-600"
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
          <Card className="border-slate-200/80 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Live Audit Log & Reversals
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Chronological ledger of point assignments with one-click undo capability.
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData} className="text-xs rounded-xl">
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
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                              isPositive
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
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
                            className="text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
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
        <ModalContent className="max-w-lg rounded-2xl p-6">
          <ModalHeader>
            <ModalTitle className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" /> Assign Points on Decided Action
            </ModalTitle>
          </ModalHeader>

          <div className="space-y-4 py-3 text-xs sm:text-sm">
            {/* Target Talabat count */}
            <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900 flex items-center justify-between">
              <span className="text-slate-700 dark:text-slate-300 font-medium">Target Recipient(s):</span>
              <Badge className="bg-indigo-600 text-white border-0">
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
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    assignForm.actionType === "POSITIVE"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" /> Positive Award (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAssignForm({ ...assignForm, actionType: "NEGATIVE" })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    assignForm.actionType === "NEGATIVE"
                      ? "bg-rose-600 text-white border-rose-600 shadow-sm"
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
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <ModalFooter className="flex items-center justify-end gap-2 pt-4">
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="rounded-xl">
                Cancel
              </Button>
            </ModalClose>
            <Button
              size="sm"
              disabled={actionLoading || selectedStudentIds.length === 0 || !assignForm.actionName.trim()}
              onClick={handleAssignPoints}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Confirm & Assign
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ======================= MODAL: CREATE / EDIT RULE ======================= */}
      <Modal open={showRuleModal} onOpenChange={setShowRuleModal}>
        <ModalContent className="max-w-md rounded-2xl p-6">
          <ModalHeader>
            <ModalTitle className="text-lg font-bold">
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
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    ruleForm.actionType === "POSITIVE"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" /> Positive (+)
                </button>
                <button
                  type="button"
                  onClick={() => setRuleForm({ ...ruleForm, actionType: "NEGATIVE" })}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                    ruleForm.actionType === "NEGATIVE"
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5" /> Penalty (-)
                </button>
              </div>
            </div>
          </div>

          <ModalFooter className="flex items-center justify-end gap-2 pt-4">
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="rounded-xl">
                Cancel
              </Button>
            </ModalClose>
            <Button
              size="sm"
              disabled={actionLoading || !ruleForm.actionName.trim() || !ruleForm.category.trim()}
              onClick={handleSaveRule}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
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
