"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Plus,
  Search,
  Loader2,
  Trash2,
  Pencil,
  CalendarDays,
  BookOpen,
  Users,
  CheckCircle2,
  TrendingUp,
  FileDown,
  Printer,
  BarChart3,
  CalendarRange,
  Link2,
  AlertTriangle,
  RefreshCw,
  X,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";
import { monthName, statusMeta } from "@/lib/takhteet";
import TakhteetAnalytics from "@/components/admin/TakhteetAnalytics";
import TakhteetMonthlyView from "@/components/admin/TakhteetMonthlyView";
import TakhteetAssignments from "@/components/admin/TakhteetAssignments";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";

const emptyForm = {
  teacherId: "",
  classId: "",
  subject: "",
  title: "",
  description: "",
  academicYear: "2026-2027",
  month: "",
};

export default function AdminTakhteetPage() {
  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"overview" | "analytics" | "monthly" | "assignments">("overview");
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMonth, setFilterMonth] = useState("");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editingPlan, setEditingPlan] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [deletingPlan, setDeletingPlan] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const [showPrint, setShowPrint] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/takhteet");
      const data = await res.json();
      if (data.success) {
        setTeachers(data.data.teachers || []);
        setClasses(data.data.classes || []);
        setPlans(data.data.plans || []);
        if (isManualRefresh) {
          toast({ variant: "success", title: "Data Refreshed", description: "Takhteet plans updated successfully." });
        }
      } else {
        toast({ variant: "destructive", title: "Fetch Failed", description: data.error || "Could not load Takhteet data." });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Network Error", description: "Failed to connect to the server." });
    } finally {
      setLoading(false);
      if (isManualRefresh) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const currentMonth = new Date().getMonth() + 1;

  const stats = useMemo(() => {
    const inProgress = plans.filter((p) => p.status === "IN_PROGRESS").length;
    const completed = plans.filter((p) => p.status === "COMPLETED").length;
    const overdue = plans.filter((p) => p.month && p.month < currentMonth && p.status !== "COMPLETED").length;
    const due = plans.filter((p) => p.month === currentMonth && p.status !== "COMPLETED").length;
    return {
      teachers: teachers.length,
      plans: plans.length,
      inProgress,
      completed,
      overdue,
      due,
      pending: plans.length - inProgress - completed,
    };
  }, [plans, teachers, currentMonth]);

  const isOverdue = (p: any) => p.month && p.month < currentMonth && p.status !== "COMPLETED";
  const isDueThisMonth = (p: any) => p.month === currentMonth && p.status !== "COMPLETED";

  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) =>
      `${t.name} ${t.email} ${t.employeeId || ""} ${t.department || ""}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [teachers, search]);

  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      if (filterTeacher && p.teacherId !== filterTeacher) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (filterMonth && p.month !== parseInt(filterMonth)) return false;
      if (search) {
        const query = search.toLowerCase();
        const matchesPlan =
          p.title?.toLowerCase().includes(query) ||
          p.subject?.toLowerCase().includes(query) ||
          p.teacherName?.toLowerCase().includes(query) ||
          p.className?.toLowerCase().includes(query);
        if (!matchesPlan) return false;
      }
      return true;
    });
  }, [plans, filterTeacher, filterStatus, filterMonth, search]);

  const availableClassesForTeacher = (teacherId: string) =>
    classes.filter((c) => c.teacherUserId === teacherId);

  const openCreateModal = (teacherId?: string) => {
    const defaultTeacher = teacherId || (teachers.length > 0 ? teachers[0].id : "");
    const initialClasses = defaultTeacher ? availableClassesForTeacher(defaultTeacher) : classes;
    const defaultClass = initialClasses.length > 0 ? initialClasses[0] : null;

    setForm({
      ...emptyForm,
      teacherId: defaultTeacher,
      classId: defaultClass ? defaultClass.id : "",
      subject: defaultClass ? defaultClass.subject : "",
      academicYear: defaultClass ? defaultClass.academicYear : "2026-2027",
    });
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!form.teacherId || !form.classId || !form.title.trim()) {
      toast({ variant: "warning", title: "Incomplete Form", description: "Please fill in Teacher, Class, and Portion Title." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/takhteet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setForm(emptyForm);
        toast({ variant: "success", title: "Portion Assigned", description: `"${form.title}" has been assigned successfully.` });
        await fetchData();
      } else {
        toast({ variant: "destructive", title: "Creation Failed", description: data.error || "Failed to create takhteet portion." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Could not save portion due to a network error." });
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (plan: any) => {
    setEditingPlan(plan);
    setEditForm({
      title: plan.title,
      description: plan.description || "",
      subject: plan.subject,
      academicYear: plan.academicYear,
      month: plan.month ? String(plan.month) : "",
      status: plan.status,
      progress: String(plan.progress),
      note: "",
    });
  };

  const handleEditSave = async () => {
    if (!editingPlan || !editForm?.title?.trim()) {
      toast({ variant: "warning", title: "Missing Title", description: "Portion title cannot be empty." });
      return;
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/admin/takhteet/${editingPlan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (data.success) {
        setEditingPlan(null);
        toast({ variant: "success", title: "Updated Successfully", description: "Takhteet plan progress and details updated." });
        await fetchData();
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: data.error || "Failed to update takhteet." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Network error while saving changes." });
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingPlan) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/takhteet/${deletingPlan.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ variant: "success", title: "Portion Deleted", description: `"${deletingPlan.title}" was removed.` });
        setDeletingPlan(null);
        await fetchData();
      } else {
        toast({ variant: "destructive", title: "Delete Failed", description: data.error || "Failed to delete plan." });
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error", description: "Network error while deleting plan." });
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/takhteet/export?format=csv");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `takhteet-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ variant: "success", title: "CSV Downloaded", description: "Takhteet report exported successfully." });
    } catch (err) {
      toast({ variant: "destructive", title: "Export Error", description: "Failed to download export file." });
    } finally {
      setExporting(false);
    }
  };

  const years = useMemo(() => {
    const set = new Set<string>(["2025-2026", "2026-2027", "2027-2028"]);
    classes.forEach((c) => c.academicYear && set.add(c.academicYear));
    plans.forEach((p) => p.academicYear && set.add(p.academicYear));
    return Array.from(set).sort();
  }, [classes, plans]);

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: ClipboardList, badge: plans.length },
    { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
    { id: "monthly" as const, label: "Monthly Grid", icon: CalendarRange },
    { id: "assignments" as const, label: "Class Assignments", icon: Link2, badge: classes.filter(c => !c.teacherUserId).length ? `${classes.filter(c => !c.teacherUserId).length} pending` : undefined },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Academics Hub Navigation Tabs */}
      <AdminHubTabs
        hubTitle="Academics & Curriculum"
        hubDescription="Class schedules, weekly timetable matrix, and Takhteet portion coverage tracking."
        tabs={[
          { label: "Classes", href: "/admin/classes", icon: BookOpen },
          { label: "Master Timetable", href: "/admin/timetable", icon: CalendarDays },
          { label: "Takhteet Curriculum", href: "/admin/takhteet", icon: ClipboardList },
        ]}
      />

      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="fatimi-header-banner">
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center fatimi-gold-accent shadow-md shrink-0">
                <ClipboardList className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">Takhteet Planner</h1>
                </div>
                <p className="text-white/80 text-sm mt-1">Assign portions, monitor syllabus completion, and keep teachers on schedule</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-sm"
                onClick={() => fetchData(true)}
                disabled={refreshing || loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-sm"
                onClick={handleExportCsv}
                disabled={exporting}
              >
                {exporting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <FileDown className="w-4 h-4 mr-1.5" />} Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-sm"
                onClick={() => setShowPrint(true)}
              >
                <Printer className="w-4 h-4 mr-1.5" /> Print / PDF
              </Button>
              <Button
                className="btn-fatimi-gold"
                onClick={() => openCreateModal()}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Assign Portion
              </Button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-60" />
        </div>
      </motion.div>

      {/* Overdue alert banner */}
      {!loading && stats.overdue > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-900">{stats.overdue} overdue portion{stats.overdue === 1 ? "" : "s"} require attention</p>
                <p className="text-xs text-red-700 mt-0.5">Target months have passed without marked completion.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-red-300 text-red-700 hover:bg-red-100 bg-white"
                onClick={() => {
                  setTab("overview");
                  setFilterStatus("");
                  setFilterMonth("");
                }}
              >
                View Overdue Items
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse bg-white border border-gray-100 rounded-xl p-5">
              <div className="w-8 h-8 bg-gray-200 rounded-lg mb-3" />
              <div className="w-16 h-3 bg-gray-200 rounded mb-2" />
              <div className="w-10 h-6 bg-gray-200 rounded" />
            </Card>
          ))}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          {[
            { title: "Teachers", value: stats.teachers, icon: Users, color: "bg-[#fff8dc] text-[#8a5a0d]", border: "border-t-[#d4af37]" },
            { title: "Total Portions", value: stats.plans, icon: ClipboardList, color: "bg-emerald-50 text-emerald-800", border: "border-t-emerald-500" },
            { title: "In Progress", value: stats.inProgress, icon: TrendingUp, color: "bg-amber-50 text-amber-700", border: "border-t-amber-400" },
            { title: "Due This Month", value: stats.due, icon: CalendarDays, color: "bg-blue-50 text-blue-700", border: "border-t-blue-400" },
            { title: "Overdue", value: stats.overdue, icon: AlertTriangle, color: stats.overdue > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700", border: stats.overdue > 0 ? "border-t-red-400" : "border-t-emerald-400" },
            { title: "Completed", value: stats.completed, icon: CheckCircle2, color: "bg-emerald-50 text-emerald-800", border: "border-t-[#047857]" },
          ].map((stat, idx) => (
            <Card key={stat.title} className={`hover:shadow-md transition-all border border-[#d4af37]/15 border-t-2 ${stat.border} rounded-xl bg-white`}>
              <CardContent className="p-4 sm:p-5">
                <div className={`p-2.5 rounded-xl w-fit ${stat.color} mb-2.5`}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <p className="text-xs text-gray-500 font-medium tracking-wide">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1 font-display">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 border-b border-[#d4af37]/25 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((t) => {
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                  isActive
                    ? "btn-fatimi-primary text-white shadow-md ring-1 ring-amber-400/30"
                    : "bg-white border-gray-200 text-gray-700 hover:border-amber-400 hover:bg-gray-50"
                }`}
              >
                <t.icon className="w-4 h-4" />
                <span>{t.label}</span>
                {t.badge !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-amber-100 text-amber-900"
                  }`}>
                    {t.badge}
                  </span>
                )}
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                )}
              </button>
            );
          })}
        </div>

        {tab === "overview" && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c6b2d]" />
            <input
              type="text"
              placeholder="Search portions, teachers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-[#d4af37]/35 bg-white text-sm focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 outline-none transition-all shadow-sm"
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
        )}
      </div>

      {/* Tab 1: Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-8">
          {/* Teachers Section */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-[#d4af37] to-[#b8860b]" />
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#047857]" /> Teachers ({filteredTeachers.length})
              </h2>
            </div>

            {loading ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="animate-pulse bg-white p-5 rounded-xl border border-gray-100">
                    <div className="w-full h-20 bg-gray-200 rounded mb-4" />
                    <div className="w-2/3 h-5 bg-gray-200 rounded" />
                  </Card>
                ))}
              </div>
            ) : filteredTeachers.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTeachers.map((t, i) => (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                    <Card className="hover:shadow-md hover:-translate-y-0.5 transition-all h-full border border-[#d4af37]/20 rounded-xl bg-white flex flex-col justify-between group">
                      <div className="h-0.5 w-full bg-gradient-to-r from-[#047857] via-[#d4af37] to-[#047857] rounded-t-xl" />
                      <CardContent className="p-5">
                        <div className="flex items-start gap-3 mb-3">
                          <Avatar className="w-11 h-11 border-2 border-[#d4af37] shrink-0">
                            {t.avatarUrl && <AvatarImage src={t.avatarUrl} alt={t.name} />}
                            <AvatarFallback className="bg-emerald-700 text-white text-xs font-bold">
                              {getInitials(t.name?.split(" ")[0] || "T", t.name?.split(" ")[1] || "")}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                            <p className="text-xs text-gray-500 truncate">{t.email}</p>
                            <p className="text-[11px] text-gray-400 mt-0.5">{t.employeeId || "Teacher"}{t.department ? ` • ${t.department}` : ""}</p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0 bg-[#fff8dc] text-[#7a5a10] border border-[#d4af37]/40 font-bold">
                            {t.planCount} portion{t.planCount === 1 ? "" : "s"}
                          </Badge>
                        </div>

                        {t.subjects && t.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-3">
                            {t.subjects.map((s: string) => (
                              <Badge key={s} variant="outline" className="text-[10px] bg-gray-50">
                                {s}
                              </Badge>
                            ))}
                          </div>
                        )}

                        {t.classes && t.classes.length > 0 ? (
                          <div className="space-y-1.5 mb-4 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Assigned Classes</p>
                            {t.classes.slice(0, 3).map((c: any) => (
                              <div key={c.classId} className="flex items-center justify-between text-xs text-gray-700">
                                <span className="font-medium truncate">{c.className}</span>
                                <span className="text-[11px] text-gray-500 shrink-0">{c.subject}</span>
                              </div>
                            ))}
                            {t.classes.length > 3 && <p className="text-[10px] text-gray-400">+{t.classes.length - 3} more classes</p>}
                          </div>
                        ) : (
                          <div className="mb-4 p-2 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-700">
                            No classes assigned yet. Assign in Classes tab.
                          </div>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-[#d4af37]/60 text-[#6b4c0a] hover:bg-[#fffdf0] hover:border-[#d4af37] font-semibold transition-all"
                          onClick={() => openCreateModal(t.id)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Assign Portion
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card className="border-dashed border-gray-200">
                <CardContent className="p-8 text-center text-gray-500">
                  <p>No teachers matched your search.</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Plans Section */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 rounded-full bg-gradient-to-b from-[#d4af37] to-[#b8860b]" />
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-[#047857]" /> Portions & Syllabus Tracking ({filteredPlans.length})
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="Filter by teacher"
                  className="px-3 py-1.5 rounded-lg border border-[#d4af37]/35 bg-white text-xs text-gray-700 focus:ring-2 focus:ring-[#d4af37]/20 focus:border-[#d4af37] outline-none transition-all"
                  value={filterTeacher}
                  onChange={(e) => setFilterTeacher(e.target.value)}
                >
                  <option value="">All Teachers</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <select
                  aria-label="Filter by status"
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 focus:ring-2 focus:ring-emerald-200 outline-none"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Completed</option>
                </select>

                <select
                  aria-label="Filter by month"
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 focus:ring-2 focus:ring-emerald-200 outline-none"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                >
                  <option value="">All Target Months</option>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {monthName(m)}
                    </option>
                  ))}
                </select>

                {(filterTeacher || filterStatus || filterMonth) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-gray-500 hover:text-gray-900"
                    onClick={() => {
                      setFilterTeacher("");
                      setFilterStatus("");
                      setFilterMonth("");
                    }}
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="grid gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="animate-pulse bg-white p-5 rounded-xl border border-gray-100">
                    <div className="w-1/3 h-5 bg-gray-200 rounded mb-3" />
                    <div className="w-full h-3 bg-gray-200 rounded" />
                  </Card>
                ))}
              </div>
            ) : filteredPlans.length > 0 ? (
              <div className="grid gap-3">
                {filteredPlans.map((p, i) => {
                  const meta = statusMeta(p.status);
                  const overdue = isOverdue(p);
                  const due = isDueThisMonth(p);
                  return (
                    <motion.div key={p.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                      <Card className={`hover:shadow-md transition-shadow border rounded-xl bg-white ${overdue ? "border-red-300 bg-red-50/20" : "border-gray-200"}`}>
                        <CardContent className="p-4 sm:p-5">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <h3 className="font-bold text-gray-900 text-base">{p.title}</h3>
                                <Badge variant="outline" className="text-[11px] font-medium bg-emerald-50 text-emerald-800 border-emerald-200">
                                  {p.subject}
                                </Badge>
                                <Badge className={`text-[10px] border font-semibold ${meta.badge}`}>
                                  {meta.label}
                                </Badge>
                                {overdue && (
                                  <Badge variant="destructive" className="text-[10px] flex items-center gap-1 font-bold">
                                    <AlertTriangle className="w-3 h-3" /> Overdue
                                  </Badge>
                                )}
                                {due && (
                                  <Badge className="text-[10px] bg-blue-100 text-blue-800 border-blue-200 font-semibold flex items-center gap-1">
                                    <CalendarDays className="w-3 h-3" /> Due this month
                                  </Badge>
                                )}
                              </div>

                              <p className="text-sm text-gray-600 font-medium">
                                Teacher: <span className="text-gray-900 font-semibold">{p.teacherName}</span> • Class: <span className="text-gray-900">{p.className}</span>
                              </p>
                              {p.description && <p className="text-xs text-gray-500 mt-1 italic line-clamp-1">{p.description}</p>}

                              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="w-3.5 h-3.5 text-gray-400" /> {p.academicYear}
                                </span>
                                <span className="flex items-center gap-1">
                                  <CalendarRange className="w-3.5 h-3.5 text-gray-400" /> {monthName(p.month)}
                                </span>
                                {p.logCount > 0 && (
                                  <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium">
                                    {p.logCount} update{p.logCount === 1 ? "" : "s"} logged
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Progress bar */}
                            <div className="lg:w-64 shrink-0 bg-gray-50 p-3 rounded-xl border border-gray-100">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-semibold text-gray-700">Coverage Progress</span>
                                <span className="text-xs font-bold text-gray-900">{p.progress}%</span>
                              </div>
                              <div className="h-2.5 rounded-full bg-gray-200 overflow-hidden">
                                <div className={`h-full rounded-full ${meta.bar} transition-all duration-300`} style={{ width: `${p.progress}%` }} />
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2 shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
                                onClick={() => openEditModal(p)}
                              >
                                <Pencil className="w-3.5 h-3.5 mr-1" /> Update
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2"
                                onClick={() => setDeletingPlan(p)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <Card className="border-dashed border-gray-300 bg-gray-50/50">
                <CardContent className="p-12 text-center">
                  <ClipboardList className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-700 font-semibold text-base">No portion plans found</p>
                  <p className="text-sm text-gray-500 mt-1 mb-4">
                    {search || filterTeacher || filterStatus || filterMonth
                      ? "No portions match your active filters."
                      : "Get started by assigning curriculum portions to teachers."}
                  </p>
                  {search || filterTeacher || filterStatus || filterMonth ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setFilterTeacher("");
                        setFilterStatus("");
                        setFilterMonth("");
                      }}
                    >
                      Clear All Filters
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="bg-[#047857] hover:bg-[#065f46] text-white font-medium"
                      onClick={() => openCreateModal()}
                    >
                      <Plus className="w-4 h-4 mr-1.5" /> Assign First Portion
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Analytics Tab */}
      {tab === "analytics" && <TakhteetAnalytics plans={plans} teachers={teachers} />}

      {/* Tab 3: Monthly Grid */}
      {tab === "monthly" && <TakhteetMonthlyView plans={plans} />}

      {/* Tab 4: Class Assignments */}
      {tab === "assignments" && <TakhteetAssignments classes={classes} teachers={teachers} onChanged={() => fetchData(true)} />}

      {/* Create Plan Modal */}
      <Modal open={showCreateModal} onOpenChange={setShowCreateModal}>
        <ModalContent className="max-w-xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2 text-gray-900">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#d4af37] to-[#b8972e] flex items-center justify-center text-white">
                <Plus className="w-4 h-4" />
              </div>
              Assign Curriculum Portion
            </ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-3">
            <div>
              <label htmlFor="tk-teacher" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                Teacher *
              </label>
              <select
                id="tk-teacher"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                value={form.teacherId}
                onChange={(e) => {
                  const teacherId = e.target.value;
                  const available = availableClassesForTeacher(teacherId);
                  const firstClass = available[0] || null;
                  setForm({
                    ...form,
                    teacherId,
                    classId: firstClass?.id || "",
                    subject: firstClass?.subject || form.subject,
                  });
                }}
              >
                <option value="">Select teacher...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tk-class" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                Class & Subject *
              </label>
              <select
                id="tk-class"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                value={form.classId}
                onChange={(e) => {
                  const cls = classes.find((c) => c.id === e.target.value);
                  setForm({
                    ...form,
                    classId: e.target.value,
                    subject: cls?.subject || form.subject,
                    academicYear: cls?.academicYear || form.academicYear,
                  });
                }}
              >
                <option value="">Select class...</option>
                {(form.teacherId ? availableClassesForTeacher(form.teacherId) : classes).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.subject} ({c.academicYear})
                  </option>
                ))}
              </select>
              {form.teacherId && availableClassesForTeacher(form.teacherId).length === 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Note: This teacher is not currently assigned to any classes. You can assign classes in the "Class Assignments" tab.
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="tk-subject" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Subject *
                </label>
                <input
                  id="tk-subject"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g. Mathematics"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="tk-year" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Academic Year
                </label>
                <select
                  id="tk-year"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                  value={form.academicYear}
                  onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="tk-title" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                Portion / Chapter Title *
              </label>
              <input
                id="tk-title"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="e.g., Unit 3: Fractions & Decimals (Pages 45-80)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="tk-month" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                Target Completion Month
              </label>
              <select
                id="tk-month"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                value={form.month}
                onChange={(e) => setForm({ ...form, month: e.target.value })}
              >
                <option value="">Full Year / No Specific Month</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tk-desc" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                Curriculum Instructions & Notes (Optional)
              </label>
              <textarea
                id="tk-desc"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                placeholder="Key concepts to emphasize, homework assignments, or test prep instructions..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
          </div>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </ModalClose>
            <Button
              size="sm"
              className="bg-[#047857] hover:bg-[#065f46] text-white font-medium shadow-sm"
              onClick={handleCreate}
              disabled={saving || !form.teacherId || !form.classId || !form.title.trim()}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />} Assign Portion
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Plan Modal */}
      <Modal open={!!editingPlan} onOpenChange={() => setEditingPlan(null)}>
        <ModalContent className="max-w-xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2 text-gray-900">
              <div className="w-8 h-8 rounded-xl bg-[#047857] flex items-center justify-center text-white">
                <Pencil className="w-4 h-4" />
              </div>
              Update Portion Progress
            </ModalTitle>
          </ModalHeader>
          {editForm && (
            <div className="space-y-4 py-3">
              <div>
                <label htmlFor="edit-title" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Portion Title *
                </label>
                <input
                  id="edit-title"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-subject" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Subject
                  </label>
                  <input
                    id="edit-subject"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={editForm.subject}
                    onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="edit-year" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Academic Year
                  </label>
                  <select
                    id="edit-year"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    value={editForm.academicYear}
                    onChange={(e) => setEditForm({ ...editForm, academicYear: e.target.value })}
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-status" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Status
                  </label>
                  <select
                    id="edit-status"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    value={editForm.status}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      let newProgress = editForm.progress;
                      if (newStatus === "COMPLETED") newProgress = "100";
                      if (newStatus === "PENDING") newProgress = "0";
                      setEditForm({ ...editForm, status: newStatus, progress: newProgress });
                    }}
                  >
                    <option value="PENDING">Pending (0%)</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="COMPLETED">Completed (100%)</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="edit-month" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Target Month
                  </label>
                  <select
                    id="edit-month"
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                    value={editForm.month}
                    onChange={(e) => setEditForm({ ...editForm, month: e.target.value })}
                  >
                    <option value="">Full Year</option>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        {monthName(m)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="edit-progress" className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Progress Percentage
                  </label>
                  <span className="text-sm font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {editForm.progress}%
                  </span>
                </div>
                <input
                  id="edit-progress"
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  className="w-full accent-[#047857] cursor-pointer"
                  value={editForm.progress}
                  onChange={(e) => {
                    const prog = parseInt(e.target.value) || 0;
                    let st = editForm.status;
                    if (prog === 100) st = "COMPLETED";
                    else if (prog > 0) st = "IN_PROGRESS";
                    else st = "PENDING";
                    setEditForm({ ...editForm, progress: String(prog), status: st });
                  }}
                />
              </div>

              <div>
                <label htmlFor="edit-note" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Progress Note / Changelog (Optional)
                </label>
                <input
                  id="edit-note"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="e.g., Completed pages 1-30, exercise 4 due on Monday"
                  value={editForm.note || ""}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                />
              </div>
            </div>
          )}
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </ModalClose>
            <Button
              size="sm"
              className="bg-[#047857] hover:bg-[#065f46] text-white font-medium shadow-sm"
              onClick={handleEditSave}
              disabled={editSaving || !editForm?.title?.trim()}
            >
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null} Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deletingPlan} onOpenChange={() => setDeletingPlan(null)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Delete Portion Plan
            </ModalTitle>
          </ModalHeader>
          <div className="py-3 text-sm text-gray-600">
            <p>
              Are you sure you want to delete <strong className="text-gray-900">"{deletingPlan?.title}"</strong>?
            </p>
            <p className="text-xs text-gray-500 mt-2">
              This will permanently delete this curriculum portion and all associated progress logs.
            </p>
          </div>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </ModalClose>
            <Button
              size="sm"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Trash2 className="w-4 h-4 mr-1.5" />} Delete Portion
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Print / PDF Modal */}
      <Modal open={showPrint} onOpenChange={setShowPrint}>
        <ModalContent className="max-w-4xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2 text-gray-900">
              <Printer className="w-5 h-5 text-[#047857]" />
              Takhteet Curriculum Portion Report
            </ModalTitle>
          </ModalHeader>
          <div className="py-3">
            <p className="text-xs text-gray-500 mb-3">
              Full overview of all {plans.length} portion(s). Use the Print button to send to your printer or save as PDF.
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-emerald-50 text-gray-700">
                  <tr className="text-left font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Teacher</th>
                    <th className="py-2.5 px-3">Class</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">Portion</th>
                    <th className="py-2.5 px-3">Target Month</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {plans.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50/50">
                      <td className="py-2 px-3 font-medium text-gray-900">{p.teacherName}</td>
                      <td className="py-2 px-3 text-gray-600">{p.className}</td>
                      <td className="py-2 px-3 text-gray-600 font-medium">{p.subject}</td>
                      <td className="py-2 px-3 font-medium text-gray-900">{p.title}</td>
                      <td className="py-2 px-3 text-gray-600">{monthName(p.month)}</td>
                      <td className="py-2 px-3 font-semibold">{statusMeta(p.status).label}</td>
                      <td className="py-2 px-3 text-right font-bold text-gray-900">{p.progress}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline" size="sm">
                Close
              </Button>
            </ModalClose>
            <Button
              size="sm"
              className="bg-[#047857] hover:bg-[#065f46] text-white font-medium"
              onClick={() => window.print()}
            >
              <Printer className="w-4 h-4 mr-1.5" /> Print / Save as PDF
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}