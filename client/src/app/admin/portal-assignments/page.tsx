"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  Loader2,
  Shield,
  BookOpen,
  Trash2,
  CheckCircle2,
  XCircle,
  Heart,
  UserCheck,
  GraduationCap,
  RefreshCw,
  X,
  AlertTriangle,
  Link2,
  KeyRound,
  Layers,
  FileText,
  FileSpreadsheet,
  Package,
  CalendarDays,
  User,
  Settings,
  Sparkles,
  Check,
  Eye,
  EyeOff,
  Building2,
  Filter,
  ArrowRight,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export interface PageDefinition {
  id: string;
  label: string;
  category: "Academics" | "Hifz" | "Operations" | "General";
  description: string;
  icon: React.ElementType;
  color: string;
}

const AVAILABLE_PAGES: PageDefinition[] = [
  { id: "dashboard", label: "Dashboard", category: "General", description: "Teacher main dashboard & point counter", icon: Layers, color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { id: "classes", label: "My Classes", category: "Academics", description: "Student rosters, enrollment & masool management", icon: BookOpen, color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "attendance", label: "Class Attendance", category: "Academics", description: "Mark student period and daily attendance", icon: CheckCircle2, color: "bg-teal-100 text-teal-800 border-teal-200" },
  { id: "takhteet", label: "Takhteet Planner", category: "Academics", description: "Curriculum planning, portion pacing & syllabus", icon: Layers, color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "mood-insights", label: "Mood Insights", category: "Academics", description: "Student sentiment & behavioral tracking", icon: Heart, color: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "hifz", label: "Hifz Reports", category: "Hifz", description: "Quran memorization ajza progress & history", icon: FileText, color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { id: "hifz-marhala", label: "Hifz Marhala", category: "Hifz", description: "Marhala assessment and oral exam grading", icon: BookOpen, color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { id: "hifz-weekly-slip", label: "Weekly Slips", category: "Hifz", description: "Weekly evaluation slips and sabqi logs", icon: FileSpreadsheet, color: "bg-sky-100 text-sky-800 border-sky-200" },
  { id: "procurement", label: "Procurement / Makhzn", category: "Operations", description: "Stationery and school supply requests", icon: Package, color: "bg-orange-100 text-orange-800 border-orange-200" },
  { id: "leave", label: "Leave Requests", category: "Operations", description: "Student & faculty absence requests", icon: UserCheck, color: "bg-rose-100 text-rose-800 border-rose-200" },
  { id: "calendar", label: "Fatimi Calendar", category: "General", description: "Fatimi calendar events & miqaats schedule", icon: CalendarDays, color: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "profile", label: "Teacher Profile", category: "General", description: "Khidmat details, biographical data & ITS", icon: User, color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { id: "settings", label: "Account Settings", category: "General", description: "Password and notification preferences", icon: Settings, color: "bg-gray-100 text-gray-800 border-gray-200" },
];

const PRESETS = [
  {
    name: "Full Authority",
    description: "Grant access to all teacher portal pages",
    pages: AVAILABLE_PAGES.map((p) => p.id),
    color: "from-emerald-700 to-teal-800",
  },
  {
    name: "Standard Class Teacher",
    description: "Classes, Attendance, Takhteet, Calendar, Profile",
    pages: ["dashboard", "classes", "attendance", "takhteet", "calendar", "profile", "settings"],
    color: "from-blue-700 to-indigo-800",
  },
  {
    name: "Hifz Faculty / Muhaffiz",
    description: "Hifz Reports, Marhala, Weekly Slips, Attendance",
    pages: ["dashboard", "attendance", "hifz", "hifz-marhala", "hifz-weekly-slip", "calendar", "profile", "settings"],
    color: "from-indigo-700 to-purple-800",
  },
  {
    name: "Attendance & Dashboard Only",
    description: "Restricted to class attendance and profile",
    pages: ["dashboard", "attendance", "calendar", "profile", "settings"],
    color: "from-amber-700 to-orange-800",
  },
];

export default function AdminPortalAssignmentsPage() {
  const searchParams = useSearchParams();
  const teacherIdParam = searchParams?.get("teacherId");

  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  // Multi-select & Batch Page Assignment Modal State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/portal-assignments");
      const data = await res.json();
      if (data.success && data.data) {
        setTeachers(data.data.teachers || []);
        if (isManual) {
          toast({ variant: "success", title: "Refreshed", description: "Teacher page permissions reloaded." });
        }
      } else {
        toast({ variant: "destructive", title: "Fetch Error", description: data.error || "Failed to load page assignments." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not connect to server." });
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Auto-open modal if teacherId is provided in URL
  useEffect(() => {
    if (teacherIdParam && teachers.length > 0) {
      const target = teachers.find((t) => t.id === teacherIdParam || t.profileId === teacherIdParam);
      if (target) {
        openModalForTeachers([target.id], target.assignedPages);
      }
    }
  }, [teacherIdParam, teachers]);

  const filteredTeachers = useMemo(() => {
    let list = teachers;
    const query = search.toLowerCase().trim();

    if (query) {
      list = list.filter(
        (t) =>
          t.name?.toLowerCase().includes(query) ||
          t.email?.toLowerCase().includes(query) ||
          t.employeeId?.toLowerCase().includes(query) ||
          t.department?.toLowerCase().includes(query)
      );
    }

    if (categoryFilter !== "ALL") {
      list = list.filter((t) => t.assignedPages?.includes(categoryFilter));
    }

    return list;
  }, [teachers, search, categoryFilter]);

  const openModalForTeachers = (teacherIds: string[], currentPages?: string[]) => {
    setSelectedTeacherIds(teacherIds);
    if (currentPages && currentPages.length > 0) {
      setSelectedPages(new Set(currentPages));
    } else if (teacherIds.length === 1) {
      const t = teachers.find((tch) => tch.id === teacherIds[0]);
      setSelectedPages(new Set(t?.assignedPages || ["dashboard", "classes", "attendance", "calendar", "profile"]));
    } else {
      setSelectedPages(new Set(["dashboard", "classes", "attendance", "takhteet", "calendar", "profile", "settings"]));
    }
    setShowConfigModal(true);
  };

  const togglePage = (pageId: string) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const applyPreset = (presetPages: string[]) => {
    setSelectedPages(new Set(presetPages));
    toast({
      variant: "default",
      title: "Preset Applied",
      description: `Loaded ${presetPages.length} pages for assignment.`,
    });
  };

  const handleSaveAssignments = async () => {
    if (selectedTeacherIds.length === 0) {
      toast({ variant: "warning", title: "Select Teacher", description: "Please select at least one teacher." });
      return;
    }

    setSaving(true);
    try {
      const pagesArray = Array.from(selectedPages);
      const res = await fetch("/api/admin/portal-assignments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherIds: selectedTeacherIds,
          pages: pagesArray,
          grantAll: pagesArray.length === AVAILABLE_PAGES.length,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          variant: "success",
          title: "Page Permissions Updated",
          description: `Assigned ${pagesArray.length} pages to ${selectedTeacherIds.length} teacher(s).`,
        });
        setShowConfigModal(false);
        setSelectedTeacherIds([]);
        await fetchData();
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: json.error || "Could not save permissions." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Failed to connect to server." });
    } finally {
      setSaving(false);
    }
  };

  // Group available pages by category
  const categories: Array<"Academics" | "Hifz" | "Operations" | "General"> = ["Academics", "Hifz", "Operations", "General"];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* People & Directory Hub Navigation Tabs */}
      <AdminHubTabs
        hubTitle="People & Directory"
        hubDescription="Manage user accounts, student profiles, parent directory, and teacher page permissions."
        tabs={[
          { label: "All Accounts", href: "/admin/users", icon: Users },
          { label: "User Passwords Vault", href: "/admin/passwords", icon: KeyRound },
          { label: "Talabat (Students)", href: "/admin/students", icon: GraduationCap },
          { label: "Parents Directory", href: "/admin/parents", icon: Heart },
          { label: "Assign Talabat to Parent", href: "/admin/parents/assign", icon: Link2 },
          { label: "Teacher Page Permissions", href: "/admin/portal-assignments", icon: UserCheck },
        ]}
      />

      {/* Fatimi Header Banner */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div
          className="relative overflow-hidden rounded-2xl p-6 text-white shadow-xl"
          style={{ background: "linear-gradient(135deg, #047857 0%, #065f46 50%, #064e3b 100%)" }}
        >
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md shrink-0"
                style={{ background: "linear-gradient(135deg, #d4af37, #b8972e)" }}
              >
                <Shield className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    Teacher Page & Authority Control
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 text-xs text-white font-semibold">
                    {teachers.length} Faculty
                  </span>
                </div>
                <p className="text-emerald-100 text-sm mt-1">
                  Assign any single or multiple pages to any teacher, show/hide modules, and grant full authority.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
                className="bg-[#d4af37] hover:bg-[#b8972e] text-white font-semibold shadow-lg shadow-black/20"
                onClick={() => openModalForTeachers(teachers.map((t) => t.id))}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Bulk Assign All Faculty
              </Button>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-80" />
        </div>
      </motion.div>

      {/* Available Pages Bar */}
      <div className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
          <span className="text-xs font-bold text-[#065f46] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" /> All Available Modules & Pages ({AVAILABLE_PAGES.length}):
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active in Navigation
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {AVAILABLE_PAGES.map((page) => {
            const Icon = page.icon;
            return (
              <div
                key={page.id}
                onClick={() => setCategoryFilter(categoryFilter === page.id ? "ALL" : page.id)}
                className={`cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  categoryFilter === page.id
                    ? "bg-emerald-700 text-white border-emerald-800 shadow-sm scale-105"
                    : page.color + " hover:opacity-90"
                }`}
                title={`Filter faculty having ${page.label}`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{page.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by teacher name, email, ITS or employee ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none shadow-sm transition-all"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs text-gray-500 font-medium">
            Showing <strong className="text-gray-800">{filteredTeachers.length}</strong> of {teachers.length} faculty
          </span>
          {categoryFilter !== "ALL" && (
            <Button size="sm" variant="ghost" onClick={() => setCategoryFilter("ALL")} className="h-7 text-xs text-red-600 hover:bg-red-50">
              Clear Filter
            </Button>
          )}
        </div>
      </div>

      {/* Faculty Page Permissions Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
          <p className="text-sm text-gray-500 font-medium">Loading teacher page permissions...</p>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-gray-200/80 shadow-sm">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-base font-bold text-gray-700">No teachers found</p>
          <p className="text-xs text-gray-500 mt-1">Try refining your search query or reset filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeachers.map((teacher) => {
            const assignedCount = teacher.assignedPages?.length || 0;
            const isAll = assignedCount >= AVAILABLE_PAGES.length;

            return (
              <motion.div
                key={teacher.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl border border-gray-200/80 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between"
              >
                {/* Header */}
                <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-emerald-50/50 via-white to-amber-50/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#047857] to-[#064e3b] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0">
                        {getInitials(teacher.name.split(" ")[0], teacher.name.split(" ")[1] || "")}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display font-bold text-gray-900 text-base truncate">
                          {teacher.name}
                        </h3>
                        <p className="text-xs text-gray-500 truncate">{teacher.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                            ID: {teacher.employeeId}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium truncate">
                            {teacher.department}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Pages Chips */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        Assigned Pages ({assignedCount}):
                      </span>
                      {isAll && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Full Access
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5 min-h-[70px]">
                      {AVAILABLE_PAGES.map((page) => {
                        const isAssigned = teacher.assignedPages?.includes(page.id);
                        const Icon = page.icon;
                        return (
                          <span
                            key={page.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                              isAssigned
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold"
                                : "bg-gray-100 text-gray-400 border border-gray-200 line-through opacity-50"
                            }`}
                          >
                            <Icon className="w-3 h-3" />
                            {page.label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      onClick={() => openModalForTeachers([teacher.id], teacher.assignedPages)}
                      className="w-full bg-[#047857] hover:bg-[#065f46] text-white font-bold text-xs h-9 rounded-xl shadow-sm"
                    >
                      <Shield className="w-3.5 h-3.5 mr-1.5" /> Configure Authority & Pages
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ASSIGN & CONFIGURE TEACHER PAGES MODAL
         ───────────────────────────────────────────────────────────── */}
      <Modal open={showConfigModal} onOpenChange={setShowConfigModal}>
        <ModalContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#047857] to-[#064e3b] text-white flex items-center justify-center">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 font-display">Assign Teacher Pages & Permissions</p>
                <p className="text-xs text-gray-500">
                  {selectedTeacherIds.length === 1
                    ? `Configuring pages for ${teachers.find((t) => t.id === selectedTeacherIds[0])?.name || "Teacher"}`
                    : `Bulk configuring pages for ${selectedTeacherIds.length} teachers`}
                </p>
              </div>
            </ModalTitle>
          </ModalHeader>

          <div className="space-y-5 py-3">
            {/* Presets Row */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50/40 border border-emerald-100">
              <span className="text-xs font-bold text-[#065f46] uppercase tracking-wider block mb-2.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Quick Role Presets:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset.pages)}
                    className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-emerald-50/50 hover:border-emerald-300 text-left transition-all group"
                  >
                    <p className="text-xs font-bold text-gray-900 group-hover:text-emerald-800">{preset.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Categorized Page Selector */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Select Modules & Pages to Assign:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPages(new Set(AVAILABLE_PAGES.map((p) => p.id)))}
                    className="text-xs text-emerald-700 font-bold hover:underline"
                  >
                    Select All
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPages(new Set(["dashboard", "calendar", "profile"]))}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Minimal
                  </button>
                </div>
              </div>

              {categories.map((cat) => {
                const catPages = AVAILABLE_PAGES.filter((p) => p.category === cat);
                return (
                  <div key={cat} className="p-3.5 rounded-2xl bg-gray-50/80 border border-gray-200/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-gray-700 uppercase tracking-wider">{cat}</span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {catPages.filter((p) => selectedPages.has(p.id)).length} / {catPages.length} Enabled
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {catPages.map((page) => {
                        const isChecked = selectedPages.has(page.id);
                        const Icon = page.icon;
                        return (
                          <div
                            key={page.id}
                            onClick={() => togglePage(page.id)}
                            className={`cursor-pointer p-3 rounded-xl border flex items-center justify-between gap-3 transition-all select-none ${
                              isChecked
                                ? "bg-white border-emerald-500 shadow-sm ring-1 ring-emerald-500"
                                : "bg-white/60 border-gray-200 opacity-60 hover:opacity-100"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                  isChecked ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-400"
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-gray-900 truncate">{page.label}</p>
                                <p className="text-[10px] text-gray-500 truncate">{page.description}</p>
                              </div>
                            </div>

                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all ${
                                isChecked
                                  ? "bg-emerald-600 border-emerald-600 text-white"
                                  : "border-gray-300 bg-white"
                              }`}
                            >
                              {isChecked && <Check className="w-3.5 h-3.5" />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <ModalFooter>
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-gray-500 font-medium">
                <strong className="text-emerald-700">{selectedPages.size}</strong> pages selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowConfigModal(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveAssignments}
                  disabled={saving}
                  className="bg-[#047857] hover:bg-[#065f46] text-white font-bold"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" /> Save Page Permissions
                    </>
                  )}
                </Button>
              </div>
            </div>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
