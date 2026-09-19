"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  Search,
  Loader2,
  Shield,
  BookOpen,
  Heart,
  UserCheck,
  GraduationCap,
  RefreshCw,
  X,
  Link2,
  KeyRound,
  Layers,
  FileText,
  Package,
  User,
  Settings,
  Sparkles,
  Check,
  Filter,
  Clock,
  Mail,
  ShoppingBag,
  Library,
  Activity,
  CalendarCheck,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Stethoscope,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

export interface PageDefinition {
  id: string;
  label: string;
  category: "Academics" | "Hifz" | "Attendance" | "Operations" | "Communications" | "Library" | "General";
  description: string;
  icon: React.ElementType;
  badgeColor: string;
  cardColor: string;
}

export const AVAILABLE_PAGES: PageDefinition[] = [
  {
    id: "manual-attendance",
    label: "Manual Attendance",
    category: "Attendance",
    description: "Mark manual attendance for classes, biometric scan windows & daily registry",
    icon: CheckSquare,
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cardColor: "hover:border-emerald-400 hover:bg-emerald-50/40",
  },
  {
    id: "medical-duty",
    label: "Medical & Health Duty",
    category: "Operations",
    description: "Mark Talabat & Faculty on Medical Leave / Exemption for events or full day",
    icon: Stethoscope,
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    cardColor: "hover:border-blue-400 hover:bg-blue-50/40",
  },
  {
    id: "attendance-logs",
    label: "Attendance Logs",
    category: "Attendance",
    description: "Live biometric scans, punch logs & daily class registry",
    icon: FileText,
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cardColor: "hover:border-emerald-400 hover:bg-emerald-50/40",
  },
  {
    id: "leave",
    label: "Leave Management",
    category: "Operations",
    description: "Faculty & talabat leave requests, approvals and history",
    icon: CalendarCheck,
    badgeColor: "bg-rose-100 text-rose-800 border-rose-200",
    cardColor: "hover:border-rose-400 hover:bg-rose-50/40",
  },
  {
    id: "attendance-schedule",
    label: "Attendance Schedule",
    category: "Attendance",
    description: "Punch time windows, shifts, period cutoff timers & rules",
    icon: Clock,
    badgeColor: "bg-teal-100 text-teal-800 border-teal-200",
    cardColor: "hover:border-teal-400 hover:bg-teal-50/40",
  },
  {
    id: "email-reports",
    label: "Email Reports",
    category: "Communications",
    description: "Automated daily attendance dispatch, email logs & reports",
    icon: Mail,
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-200",
    cardColor: "hover:border-indigo-400 hover:bg-indigo-50/40",
  },
  {
    id: "procurement",
    label: "Procurement",
    category: "Operations",
    description: "Stationery requests, supply requisitions & approvals",
    icon: ShoppingBag,
    badgeColor: "bg-orange-100 text-orange-800 border-orange-200",
    cardColor: "hover:border-orange-400 hover:bg-orange-50/40",
  },
  {
    id: "classes",
    label: "Classes",
    category: "Academics",
    description: "Student rosters, enrollment, timetable & masool duties",
    icon: BookOpen,
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    cardColor: "hover:border-blue-400 hover:bg-blue-50/40",
  },
  {
    id: "quran",
    label: "Quran (Hifz)",
    category: "Hifz",
    description: "Memorization ajza tracking, marhala grading & weekly slips",
    icon: Sparkles,
    badgeColor: "bg-cyan-100 text-cyan-800 border-cyan-200",
    cardColor: "hover:border-cyan-400 hover:bg-cyan-50/40",
  },
  {
    id: "takhteet",
    label: "Takhteet",
    category: "Academics",
    description: "Curriculum pacing, portion milestones & syllabus planning",
    icon: Layers,
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    cardColor: "hover:border-amber-400 hover:bg-amber-50/40",
  },
  {
    id: "makhzan",
    label: "Makhzan",
    category: "Operations",
    description: "School asset inventory, depot storage & equipment tracking",
    icon: Package,
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cardColor: "hover:border-emerald-400 hover:bg-emerald-50/40",
  },
  {
    id: "library",
    label: "Library",
    category: "Library",
    description: "Book repository, digital catalog & student loans",
    icon: Library,
    badgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    cardColor: "hover:border-purple-400 hover:bg-purple-50/40",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    category: "General",
    description: "Teacher main overview HUD, quick shortcuts & points",
    icon: Activity,
    badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cardColor: "hover:border-emerald-400 hover:bg-emerald-50/40",
  },
  {
    id: "profile",
    label: "Profile & Settings",
    category: "General",
    description: "Biographical details, ITS credentials & security preferences",
    icon: User,
    badgeColor: "bg-sky-100 text-sky-800 border-sky-200",
    cardColor: "hover:border-sky-400 hover:bg-sky-50/40",
  },
];

const PRESETS = [
  {
    name: "Full Authority (All Modules)",
    description: "Grants unconditional access to all portal modules",
    pages: AVAILABLE_PAGES.map((p) => p.id),
    color: "from-emerald-700 to-teal-800",
  },
  {
    name: "Standard Academic Faculty",
    description: "Dashboard, Classes, Quran, Takhteet, Manual Attendance, Profile",
    pages: ["dashboard", "classes", "quran", "takhteet", "manual-attendance", "profile"],
    color: "from-blue-700 to-indigo-800",
  },
  {
    name: "Health & Medical In-Charge",
    description: "Dashboard, Medical & Health Duty, Manual Attendance, Attendance Logs, Profile",
    pages: ["dashboard", "medical-duty", "manual-attendance", "attendance-logs", "leave", "profile"],
    color: "from-blue-800 to-cyan-900",
  },
  {
    name: "Attendance Officer",
    description: "Dashboard, Manual Attendance, Attendance Logs, Attendance Schedule, Email Reports, Leave, Profile",
    pages: ["dashboard", "manual-attendance", "attendance-logs", "attendance-schedule", "email-reports", "leave", "profile"],
    color: "from-emerald-800 to-green-900",
  },
  {
    name: "Hifz Department (Muhaffiz)",
    description: "Dashboard, Quran, Manual Attendance, Leave, Profile",
    pages: ["dashboard", "quran", "manual-attendance", "leave", "profile"],
    color: "from-cyan-700 to-teal-800",
  },
  {
    name: "Operations & Makhzan",
    description: "Dashboard, Procurement, Makhzan, Library, Leave, Profile",
    pages: ["dashboard", "procurement", "makhzan", "library", "leave", "profile"],
    color: "from-orange-700 to-amber-800",
  },
];

export default function AdminPortalAssignmentsPage() {
  const searchParams = useSearchParams();
  const teacherIdParam = searchParams?.get("teacherId");

  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeModuleFilter, setActiveModuleFilter] = useState<string>("ALL");

  // Selection state for batch bulk operations
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<string[]>([]);

  // Modal State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [modalTargetTeacherIds, setModalTargetTeacherIds] = useState<string[]>([]);
  const [modalSelectedPages, setModalSelectedPages] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/portal-assignments");
      const data = await res.json();
      if (data.success && data.data) {
        setTeachers(data.data.teachers || []);
        if (isManual) {
          toast({ variant: "success", title: "Refreshed", description: "Teacher portal permissions reloaded." });
        }
      } else {
        toast({ variant: "destructive", title: "Fetch Error", description: data.error || "Failed to load portal assignments." });
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

  // Auto-open modal if teacherId is provided in query params
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

    if (activeModuleFilter !== "ALL") {
      list = list.filter((t) => {
        const pages = t.assignedPages || [];
        return pages.includes(activeModuleFilter);
      });
    }

    return list;
  }, [teachers, search, activeModuleFilter]);

  const stats = useMemo(() => {
    const total = teachers.length;
    const fullAuth = teachers.filter((t) => (t.assignedPages?.length || 0) >= AVAILABLE_PAGES.length).length;
    const partial = teachers.filter((t) => (t.assignedPages?.length || 0) > 0 && (t.assignedPages?.length || 0) < AVAILABLE_PAGES.length).length;
    const minimal = teachers.filter((t) => (t.assignedPages?.length || 0) <= 2).length;
    return { total, fullAuth, partial, minimal };
  }, [teachers]);

  const openModalForTeachers = (teacherIds: string[], currentPages?: string[]) => {
    setModalTargetTeacherIds(teacherIds);
    if (currentPages && currentPages.length > 0) {
      setModalSelectedPages(new Set(currentPages));
    } else if (teacherIds.length === 1) {
      const t = teachers.find((tch) => tch.id === teacherIds[0]);
      setModalSelectedPages(new Set(t?.assignedPages || ["dashboard", "classes", "attendance-logs", "takhteet", "quran", "profile"]));
    } else {
      setModalSelectedPages(new Set(["dashboard", "classes", "attendance-logs", "takhteet", "quran", "profile"]));
    }
    setShowConfigModal(true);
  };

  const toggleModalPage = (pageId: string) => {
    setModalSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const applyPreset = (presetPages: string[]) => {
    setModalSelectedPages(new Set(presetPages));
    toast({
      variant: "default",
      title: "Preset Applied",
      description: `Configured ${presetPages.length} module(s).`,
    });
  };

  const handleSaveAssignments = async () => {
    if (modalTargetTeacherIds.length === 0) {
      toast({ variant: "warning", title: "Select Faculty", description: "Please select at least one teacher." });
      return;
    }

    setSaving(true);
    try {
      const pagesArray = Array.from(modalSelectedPages);
      const res = await fetch("/api/admin/portal-assignments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherIds: modalTargetTeacherIds,
          pages: pagesArray,
          grantAll: pagesArray.length === AVAILABLE_PAGES.length,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          variant: "success",
          title: "Portal Permissions Updated",
          description: `Assigned ${pagesArray.length} modules to ${modalTargetTeacherIds.length} faculty member(s).`,
        });
        setShowConfigModal(false);
        setSelectedFacultyIds([]);
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

  const toggleSelectFaculty = (id: string) => {
    setSelectedFacultyIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllFiltered = () => {
    if (selectedFacultyIds.length === filteredTeachers.length && filteredTeachers.length > 0) {
      setSelectedFacultyIds([]);
    } else {
      setSelectedFacultyIds(filteredTeachers.map((t) => t.id));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
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

      {/* Fatimi Luxury Hero Banner */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div
          className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-2xl"
          style={{ background: "linear-gradient(135deg, #022c22 0%, #064e3b 40%, #047857 100%)" }}
        >
          {/* Decorative Pattern Background */}
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,0 L100,100 M100,0 L0,100" stroke="#d4af37" strokeWidth="0.5" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border border-white/20"
                style={{ background: "linear-gradient(135deg, #d4af37 0%, #b8972e 100%)" }}
              >
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    Teacher Portal Authority Control
                  </h1>
                  <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs text-white font-bold border border-white/20">
                    {stats.total} Active Faculty
                  </span>
                </div>
                <p className="text-emerald-100 text-sm mt-1.5 max-w-2xl">
                  Granular control to assign, grant full authority, or completely hide any of the 12 core modules for any faculty member. Inactive or deleted profiles are strictly excluded from all directories.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-sm backdrop-blur-md h-10 px-4 rounded-xl"
                onClick={() => fetchData(true)}
                disabled={refreshing || loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
              </Button>

              <Button
                className="bg-[#d4af37] hover:bg-[#b8972e] text-white font-bold shadow-lg shadow-black/20 h-10 px-5 rounded-xl transition-transform active:scale-95"
                onClick={() => openModalForTeachers(teachers.map((t) => t.id))}
              >
                <Sparkles className="w-4 h-4 mr-2" /> Bulk Assign All Faculty
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/15">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <span className="text-[11px] text-emerald-200 font-medium block">Total Active Faculty</span>
              <span className="text-xl font-bold text-white mt-0.5 block">{stats.total}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <span className="text-[11px] text-emerald-200 font-medium block">Full Authority Access</span>
              <span className="text-xl font-bold text-emerald-300 mt-0.5 block">{stats.fullAuth}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <span className="text-[11px] text-emerald-200 font-medium block">Custom Module Access</span>
              <span className="text-xl font-bold text-amber-300 mt-0.5 block">{stats.partial}</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
              <span className="text-[11px] text-emerald-200 font-medium block">Total Modules Controlled</span>
              <span className="text-xl font-bold text-white mt-0.5 block">12 Core Pages</span>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-90" />
        </div>
      </motion.div>

      {/* ── 12 Modules Quick-Filter Bar ── */}
      <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-bold text-[#065f46] uppercase tracking-wider">
              Filter Faculty by Assigned Module ({AVAILABLE_PAGES.length} Core Pages):
            </span>
          </div>
          {activeModuleFilter !== "ALL" && (
            <button
              onClick={() => setActiveModuleFilter("ALL")}
              className="text-xs text-rose-600 hover:text-rose-800 font-bold hover:underline"
            >
              Reset to All Faculty
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            onClick={() => setActiveModuleFilter("ALL")}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
              activeModuleFilter === "ALL"
                ? "bg-[#064e3b] text-white border-[#064e3b] shadow-sm scale-105"
                : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
            }`}
          >
            All Faculty ({teachers.length})
          </button>

          {AVAILABLE_PAGES.map((page) => {
            const Icon = page.icon;
            const count = teachers.filter((t) => t.assignedPages?.includes(page.id)).length;
            const isSelected = activeModuleFilter === page.id;
            return (
              <button
                key={page.id}
                onClick={() => setActiveModuleFilter(isSelected ? "ALL" : page.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-[#047857] text-white border-[#047857] shadow-md scale-105 font-bold"
                    : `${page.badgeColor} hover:opacity-95`
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{page.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isSelected ? "bg-white/20 text-white" : "bg-white/60 text-gray-800"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Search, Batch Selection Bar & Filters ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search faculty by name, email, employee ID or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none shadow-sm transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Multi-Selection Batch Controls */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleSelectAllFiltered}
            className="h-9 px-3 rounded-xl border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {selectedFacultyIds.length === filteredTeachers.length && filteredTeachers.length > 0 ? (
              <>
                <CheckSquare className="w-4 h-4 mr-1.5 text-emerald-600" /> Deselect All
              </>
            ) : (
              <>
                <Square className="w-4 h-4 mr-1.5 text-gray-400" /> Select All ({filteredTeachers.length})
              </>
            )}
          </Button>

          {selectedFacultyIds.length > 0 && (
            <Button
              size="sm"
              onClick={() => openModalForTeachers(selectedFacultyIds)}
              className="h-9 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md animate-fade-in"
            >
              <Shield className="w-3.5 h-3.5 mr-1.5" /> Configure ({selectedFacultyIds.length}) Selected
            </Button>
          )}

          <span className="text-xs text-gray-500 font-medium">
            Showing <strong className="text-gray-900">{filteredTeachers.length}</strong> of {teachers.length} active faculty
          </span>
        </div>
      </div>

      {/* ── Faculty Cards Grid ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-3" />
          <p className="text-sm text-gray-600 font-medium">Loading faculty page permissions & directory...</p>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-gray-200 shadow-sm">
          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-base font-bold text-gray-800">No active faculty matching your criteria</p>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Try adjusting your search query or reset module filters to view all active faculty.
          </p>
          {(search || activeModuleFilter !== "ALL") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSearch("");
                setActiveModuleFilter("ALL");
              }}
              className="mt-4 rounded-xl text-xs font-semibold"
            >
              Clear All Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeachers.map((teacher) => {
            const assignedCount = teacher.assignedPages?.length || 0;
            const isFullAuthority = assignedCount >= AVAILABLE_PAGES.length;
            const isSelected = selectedFacultyIds.includes(teacher.id);

            return (
              <motion.div
                key={teacher.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-sm hover:shadow-xl ${
                  isSelected
                    ? "border-emerald-500 ring-2 ring-emerald-500/20"
                    : "border-gray-200/80 hover:border-emerald-200"
                }`}
              >
                {/* Faculty Card Header */}
                <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-emerald-50/60 via-white to-amber-50/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Checkbox for batch multi-select */}
                      <button
                        type="button"
                        onClick={() => toggleSelectFaculty(teacher.id)}
                        className="text-gray-400 hover:text-emerald-600 transition-colors shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-300 hover:text-gray-500" />
                        )}
                      </button>

                      {/* Avatar */}
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#047857] to-[#064e3b] text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 border border-emerald-600/30">
                        {getInitials(teacher.name.split(" ")[0], teacher.name.split(" ")[1] || "")}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <h3 className="font-display font-bold text-gray-900 text-base truncate">
                          {teacher.name}
                        </h3>
                        <p className="text-xs text-gray-500 truncate">{teacher.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
                            ID: {teacher.employeeId}
                          </span>
                          <span className="text-[10px] text-gray-500 font-medium truncate">
                            {teacher.department}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Authority Pill */}
                    {isFullAuthority ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200 shrink-0">
                        <Sparkles className="w-3 h-3 text-amber-500" /> Full Authority
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-[10px] font-semibold border border-gray-200 shrink-0">
                        {assignedCount} / {AVAILABLE_PAGES.length} Modules
                      </span>
                    )}
                  </div>
                </div>

                {/* Assigned 12 Modules Matrix */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                        Module Visibility Status:
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {assignedCount} Visible • {AVAILABLE_PAGES.length - assignedCount} Hidden
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {AVAILABLE_PAGES.map((page) => {
                        const isAssigned = teacher.assignedPages?.includes(page.id);
                        const Icon = page.icon;

                        return (
                          <div
                            key={page.id}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-medium transition-all ${
                              isAssigned
                                ? "bg-emerald-50/80 text-emerald-900 border-emerald-200 font-semibold"
                                : "bg-gray-50 text-gray-400 border-gray-200/60 opacity-60 line-through"
                            }`}
                          >
                            <Icon className={`w-3.5 h-3.5 shrink-0 ${isAssigned ? "text-emerald-700" : "text-gray-400"}`} />
                            <span className="truncate">{page.label}</span>
                            {isAssigned && (
                              <Check className="w-3 h-3 ml-auto text-emerald-600 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      onClick={() => openModalForTeachers([teacher.id], teacher.assignedPages)}
                      className="w-full bg-[#047857] hover:bg-[#065f46] text-white font-bold text-xs h-9 rounded-xl shadow-sm transition-all"
                    >
                      <Shield className="w-3.5 h-3.5 mr-1.5" /> Configure Authority & Modules
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          ASSIGN & CONFIGURE TEACHER PAGES MODAL (All 12 Modules)
         ───────────────────────────────────────────────────────────── */}
      <Modal open={showConfigModal} onOpenChange={setShowConfigModal}>
        <ModalContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#047857] to-[#064e3b] text-white flex items-center justify-center shadow-md">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900 font-display">
                  Assign Portal Modules & Authority
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {modalTargetTeacherIds.length === 1
                    ? `Managing page access for ${teachers.find((t) => t.id === modalTargetTeacherIds[0])?.name || "Teacher"}`
                    : `Bulk configuring access for ${modalTargetTeacherIds.length} selected faculty members`}
                </p>
              </div>
            </ModalTitle>
          </ModalHeader>

          <div className="space-y-6 py-4">
            {/* Quick Presets */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-amber-50/40 border border-emerald-100/80 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#065f46] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> One-Click Role Presets:
                </span>
                <span className="text-[10px] text-gray-500 font-medium">Click any preset to auto-select modules</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset.pages)}
                    className="p-3 rounded-xl border border-gray-200/80 bg-white hover:bg-emerald-50/60 hover:border-emerald-300 text-left transition-all group shadow-2xs"
                  >
                    <p className="text-xs font-bold text-gray-900 group-hover:text-emerald-800">{preset.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* All 12 Modules Grid Selector */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                  Select Modules to Display in Teacher Navigation ({modalSelectedPages.size} / {AVAILABLE_PAGES.length} Enabled):
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setModalSelectedPages(new Set(AVAILABLE_PAGES.map((p) => p.id)))}
                    className="text-xs text-emerald-700 font-bold hover:underline"
                  >
                    Grant All (12)
                  </button>
                  <span className="text-gray-300">•</span>
                  <button
                    type="button"
                    onClick={() => setModalSelectedPages(new Set(["dashboard", "profile"]))}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Minimal (Dashboard & Profile)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {AVAILABLE_PAGES.map((page) => {
                  const isChecked = modalSelectedPages.has(page.id);
                  const Icon = page.icon;

                  return (
                    <div
                      key={page.id}
                      onClick={() => toggleModalPage(page.id)}
                      className={`cursor-pointer p-3.5 rounded-2xl border flex items-start justify-between gap-3 transition-all select-none ${
                        isChecked
                          ? "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                          : "bg-gray-50/60 border-gray-200 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                            isChecked ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-400"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-xs font-bold text-gray-900 truncate">{page.label}</p>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 leading-tight">
                            {page.description}
                          </p>
                          <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold ${page.badgeColor}`}>
                            {page.category}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all mt-0.5 ${
                          isChecked
                            ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
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
          </div>

          <ModalFooter>
            <div className="flex items-center justify-between w-full pt-2">
              <span className="text-xs text-gray-500 font-medium">
                <strong className="text-emerald-700">{modalSelectedPages.size}</strong> of {AVAILABLE_PAGES.length} modules selected for {modalTargetTeacherIds.length} faculty
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowConfigModal(false)} disabled={saving} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveAssignments}
                  disabled={saving}
                  className="bg-[#047857] hover:bg-[#065f46] text-white font-bold rounded-xl px-5 shadow-md"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-1.5" /> Save Permissions
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
