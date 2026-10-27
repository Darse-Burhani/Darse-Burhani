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
  Sparkles,
  Check,
  Clock,
  Mail,
  ShoppingBag,
  Library,
  Activity,
  CalendarCheck,
  CalendarDays,
  SlidersHorizontal,
  CheckSquare,
  Square,
  Stethoscope,
  Fingerprint,
  Award,
  BarChart3,
  Bell,
  Settings,
  ClipboardList,
  Palette,
  FileSpreadsheet,
  ShieldOff,
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
  category: "Academics" | "Hifz" | "Attendance" | "Operations" | "Communications" | "Library" | "General" | "Community" | "Systems";
  description: string;
  icon: React.ElementType;
}

// Canonical catalog — must match TEACHER_AVAILABLE_PAGES on the server
// (server/src/routes/admin/portal-assignments.ts) and /teacher routes in App.tsx.
export const AVAILABLE_PAGES: PageDefinition[] = [
  {
    id: "manual-attendance",
    label: "Manual Attendance",
    category: "Attendance",
    description: "Mark manual attendance for classes, biometric scan windows & daily registry",
    icon: CheckSquare,
  },
  {
    id: "medical-duty",
    label: "Medical & Health Duty",
    category: "Operations",
    description: "Mark Talabat & Faculty on Medical Leave / Exemption for events or full day",
    icon: Stethoscope,
  },
  {
    id: "attendance-logs",
    label: "Hikvision Scans & Logs",
    category: "Attendance",
    description: "Live Hikvision scans, manual logs, exports & audit timeline",
    icon: Fingerprint,
  },
  {
    id: "attendance-schedule",
    label: "Attendance Schedule",
    category: "Attendance",
    description: "Punch time windows, shifts, period cutoff timers & rules",
    icon: Clock,
  },
  {
    id: "email-reports",
    label: "Email Attendance Reports",
    category: "Attendance",
    description: "Automated daily/weekly attendance digest & notification emails",
    icon: Mail,
  },
  {
    id: "google-sheets",
    label: "Google Sheets Sync",
    category: "Attendance",
    description: "Cloud spreadsheet sync, daily/monthly exports & configuration",
    icon: FileSpreadsheet,
  },
  {
    id: "biometric",
    label: "Biometric Scanners",
    category: "Attendance",
    description: "Device status, hardware telemetry & scanner sync management",
    icon: Fingerprint,
  },
  {
    id: "leave",
    label: "Leave Management",
    category: "Operations",
    description: "Faculty & talabat leave requests, approvals and history",
    icon: CalendarCheck,
  },
  {
    id: "procurement",
    label: "Procurement",
    category: "Operations",
    description: "Stationery requests, supply requisitions & approvals",
    icon: ShoppingBag,
  },
  {
    id: "classes",
    label: "Classes",
    category: "Academics",
    description: "Student rosters, enrollment, timetable & masool duties",
    icon: BookOpen,
  },
  {
    id: "talabat-profiles",
    label: "Yearly Profile (1447 H)",
    category: "Community",
    description: "Talabat yearly profile, remarks & 1447 H records",
    icon: GraduationCap,
  },
  {
    id: "timetable",
    label: "Timetable Matrix",
    category: "Academics",
    description: "Master timetable & schedule",
    icon: CalendarDays,
  },
  {
    id: "quran",
    label: "Quran (Hifz)",
    category: "Hifz",
    description: "Memorization ajza tracking, marhala grading & weekly slips",
    icon: Sparkles,
  },
  {
    id: "hifz-marhala",
    label: "Hifz Marhala",
    category: "Hifz",
    description: "Marhala progress & exams",
    icon: GraduationCap,
  },
  {
    id: "takhteet",
    label: "Takhteet (Curriculum Portion)",
    category: "Academics",
    description: "Curriculum pacing, portion milestones & syllabus planning (Restricted to specific assigned faculty)",
    icon: Layers,
  },
  {
    id: "makhzan",
    label: "Makhzan",
    category: "Operations",
    description: "School asset inventory, depot storage & equipment tracking",
    icon: Package,
  },
  {
    id: "library",
    label: "Library",
    category: "Library",
    description: "Book repository, digital catalog & student loans",
    icon: Library,
  },
  {
    id: "library-overview",
    label: "Library Overview",
    category: "Library",
    description: "Library dashboard, circulation metrics & quick actions",
    icon: Library,
  },
  {
    id: "library-shelves",
    label: "Library Shelves",
    category: "Library",
    description: "Physical shelves, book locations & catalog management",
    icon: Library,
  },
  {
    id: "library-checkout",
    label: "Library Checkout",
    category: "Library",
    description: "Issue books, scan borrowers & manage active loans",
    icon: Library,
  },
  {
    id: "library-overdue",
    label: "Library Overdue",
    category: "Library",
    description: "Overdue loans, reminder emails & return tracking",
    icon: Library,
  },
  {
    id: "library-auditor",
    label: "Library Auditor",
    category: "Library",
    description: "Inventory audit, missing books & shelf reconciliation",
    icon: Library,
  },
  {
    id: "students",
    label: "Talabat (Students)",
    category: "Community",
    description: "Student directory, biodata & class enrollment details",
    icon: GraduationCap,
  },
  {
    id: "parents",
    label: "Parents Directory",
    category: "Community",
    description: "Parent contacts, guardian directory & student linking",
    icon: Heart,
  },
  {
    id: "parents-assign",
    label: "Assign Talabat to Parent",
    category: "Community",
    description: "Link talabat profiles to parent guardian accounts",
    icon: Link2,
  },
  {
    id: "users",
    label: "Staff & Users",
    category: "Community",
    description: "Staff directory, user accounts & credential management",
    icon: Users,
  },
  {
    id: "passwords",
    label: "User Passwords",
    category: "Community",
    description: "Direct password resets, credentials & access recovery",
    icon: KeyRound,
  },
  {
    id: "tracking",
    label: "Individual Tracking",
    category: "Operations",
    description: "Student performance tracking, point trends & metrics",
    icon: BarChart3,
  },
  {
    id: "point-matrix",
    label: "Point Matrix & Rules",
    category: "Systems",
    description: "Star point rules, rubrics, multipliers & matrix (Restricted to specific assigned faculty)",
    icon: Award,
  },
  {
    id: "portal-assignments",
    label: "Portal Assignments",
    category: "Systems",
    description: "Assign portal pages to teachers (delegates administrative authority)",
    icon: UserCheck,
  },
  {
    id: "notifications",
    label: "Notification Studio",
    category: "Systems",
    description: "Broadcast announcements & targeted notification studio",
    icon: Bell,
  },
  {
    id: "security",
    label: "Security & Logs",
    category: "Systems",
    description: "Audit logs, active sessions & security preferences",
    icon: Shield,
  },
  {
    id: "settings",
    label: "Portal Settings",
    category: "Systems",
    description: "Global portal module locks & permission matrix",
    icon: Settings,
  },
  {
    id: "student-assignments",
    label: "Assignments",
    category: "Academics",
    description: "Create assignments, grade talabat & view skill assessment scores",
    icon: ClipboardList,
  },
  {
    id: "hobbies",
    label: "Hobbies & Skills",
    category: "Community",
    description: "View & manage talabat hobbies, interests and skills",
    icon: Palette,
  },
  {
    id: "talabat-skills",
    label: "Talabat Skills Records",
    category: "Academics",
    description: "Every talabat's skill %, Q&A scores, assignment marks & hobbies",
    icon: Sparkles,
  },
  {
    id: "dashboard",
    label: "Dashboard",
    category: "General",
    description: "Teacher main overview HUD, quick shortcuts & points",
    icon: Activity,
  },
  {
    id: "profile",
    label: "Profile & Settings",
    category: "General",
    description: "Biographical details, ITS credentials & security preferences",
    icon: User,
  },
  {
    id: "tilawat-dua",
    label: "Tilawat Dua",
    category: "Academics",
    description: "Daily Tilawat Dua PDF management, dynamic viewer & projector presentation",
    icon: BookOpen,
  },
];

// 70/30/10 tone system: neutral slate carries structure, emerald and gold
// are reserved for the small set of focal accents.
const CATEGORY_TONES: Record<PageDefinition["category"], { badge: string; icon: string; dot: string }> = {
  General: { badge: "bg-slate-100 text-slate-700 border-slate-200", icon: "text-slate-600", dot: "bg-slate-400" },
  Academics: { badge: "bg-slate-100 text-slate-700 border-slate-200", icon: "text-slate-600", dot: "bg-slate-400" },
  Hifz: { badge: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: "text-emerald-700", dot: "bg-emerald-500" },
  Attendance: { badge: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: "text-emerald-700", dot: "bg-emerald-500" },
  Operations: { badge: "bg-amber-50 text-amber-800 border-amber-200", icon: "text-amber-700", dot: "bg-amber-500" },
  Communications: { badge: "bg-slate-100 text-slate-700 border-slate-200", icon: "text-slate-600", dot: "bg-slate-400" },
  Library: { badge: "bg-slate-100 text-slate-700 border-slate-200", icon: "text-slate-600", dot: "bg-slate-400" },
  Community: { badge: "bg-slate-100 text-slate-700 border-slate-200", icon: "text-slate-600", dot: "bg-slate-400" },
  Systems: { badge: "bg-amber-50 text-amber-800 border-amber-200", icon: "text-amber-700", dot: "bg-amber-500" },
};

const PRESETS = [
  {
    name: "Full Authority (All Modules)",
    description: "Grants unconditional access to all portal modules",
    pages: AVAILABLE_PAGES.map((p) => p.id),
  },
  {
    name: "Standard Academic Faculty",
    description: "Dashboard, Classes, Yearly Profile, Timetable, Quran, Manual Attendance, Profile",
    pages: ["dashboard", "classes", "talabat-profiles", "timetable", "quran", "manual-attendance", "profile"],
  },
  {
    name: "Takhteet & Portion In-Charge (Specific Faculty)",
    description: "Dashboard, Classes, Timetable, Takhteet Portion Planner, Yearly Profile, Profile",
    pages: ["dashboard", "classes", "talabat-profiles", "timetable", "takhteet", "profile"],
  },
  {
    name: "Health & Medical In-Charge",
    description: "Dashboard, Medical & Health Duty, Manual Attendance, Attendance Logs, Leave, Profile",
    pages: ["dashboard", "medical-duty", "manual-attendance", "attendance-logs", "leave", "profile"],
  },
  {
    name: "Attendance & Scanners Officer",
    description: "Dashboard, Manual Attendance, Hikvision Logs, Attendance Schedule, Email Reports, Google Sheets, Biometric, Leave, Profile",
    pages: ["dashboard", "manual-attendance", "attendance-logs", "attendance-schedule", "email-reports", "google-sheets", "biometric", "leave", "profile"],
  },
  {
    name: "Hifz Department (Muhaffiz)",
    description: "Dashboard, Quran, Hifz Marhala, Manual Attendance, Leave, Profile",
    pages: ["dashboard", "quran", "hifz-marhala", "manual-attendance", "leave", "profile"],
  },
  {
    name: "Operations & Makhzan",
    description: "Dashboard, Procurement, Makhzan, Library, Leave, Profile",
    pages: ["dashboard", "procurement", "makhzan", "library", "leave", "profile"],
  },
  {
    name: "Talabat & Community In-Charge",
    description: "Dashboard, Talabat, Yearly Profile, Parents Directory, Parent Assignments, Staff & Users, Tracking, Profile",
    pages: ["dashboard", "students", "talabat-profiles", "parents", "parents-assign", "users", "tracking", "profile"],
  },
  {
    name: "Point Matrix & Discipline In-Charge (Specific Faculty)",
    description: "Dashboard, Students, Tracking, Point Matrix Rules & Multipliers, Profile",
    pages: ["dashboard", "students", "talabat-profiles", "tracking", "point-matrix", "profile"],
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
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

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
        return pages.includes(activeModuleFilter) || t.hasFullAccess;
      });
    }

    return list;
  }, [teachers, search, activeModuleFilter]);

  const stats = useMemo(() => {
    const total = teachers.length;
    const fullAuth = teachers.filter((t) => t.hasFullAccess || (t.assignedPages?.length || 0) >= AVAILABLE_PAGES.length).length;
    const partial = teachers.filter((t) => !t.hasFullAccess && (t.assignedPages?.length || 0) > 2 && (t.assignedPages?.length || 0) < AVAILABLE_PAGES.length).length;
    const minimal = teachers.filter((t) => !t.hasFullAccess && (t.assignedPages?.length || 0) <= 2).length;
    return { total, fullAuth, partial, minimal };
  }, [teachers]);

  const MINIMAL_PAGES = ["dashboard", "profile"];

  const openModalForTeachers = (teacherIds: string[], currentPages?: string[]) => {
    setModalTargetTeacherIds(teacherIds);
    if (currentPages && currentPages.length > 0) {
      // Normalize legacy ids (hifz -> quran) and drop unknown keys so save is exact.
      const valid = Array.from(
        new Set(
          currentPages.map((p) => (p === "hifz" ? "quran" : p)).filter((p) => AVAILABLE_PAGES.some((ap) => ap.id === p) || p === "dashboard" || p === "profile")
        )
      );
      setModalSelectedPages(new Set(valid.length > 0 ? valid : MINIMAL_PAGES));
    } else if (teacherIds.length === 1) {
      const t = teachers.find((tch) => tch.id === teacherIds[0]);
      const valid = (t?.assignedPages || []).filter((p: string) => AVAILABLE_PAGES.some((ap) => ap.id === p));
      setModalSelectedPages(new Set(valid.length > 0 ? valid : MINIMAL_PAGES));
    } else {
      setModalSelectedPages(new Set(MINIMAL_PAGES));
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
          description: `Assigned ${pagesArray.length} of ${AVAILABLE_PAGES.length} modules to ${modalTargetTeacherIds.length} faculty member(s). In-app notifications were delivered.`,
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

  const handleGrantAll = async (teacher: any) => {
    if (!window.confirm(`Grant full portal authority to ${teacher.name}? They will receive every admin tab and feature.`)) {
      return;
    }
    setGrantingId(teacher.id);
    try {
      const res = await fetch("/api/admin/portal-assignments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherIds: [teacher.id],
          pages: AVAILABLE_PAGES.map((page) => page.id),
          grantAll: true,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          variant: "success",
          title: "Full Authority Granted",
          description: `${teacher.name} now has all ${AVAILABLE_PAGES.length} modules. A notification was sent to their portal.`,
        });
        await fetchData();
      } else {
        toast({ variant: "destructive", title: "Grant Failed", description: json.error || "Could not grant full access." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not reach the server." });
    } finally {
      setGrantingId(null);
    }
  };

  const handleRevokeAll = async (teacher: any) => {
    if (!window.confirm(`Revoke all delegated portal access for ${teacher.name}? Dashboard and Profile will remain available.`)) {
      return;
    }
    setRevokingId(teacher.id);
    try {
      const res = await fetch(`/api/admin/portal-assignments?teacherId=${encodeURIComponent(teacher.id)}&all=true`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          variant: "warning",
          title: "Portal Access Revoked",
          description: `${teacher.name} now has Dashboard and Profile only. A notification was sent to their portal.`,
        });
        setSelectedFacultyIds((prev) => prev.filter((id) => id !== teacher.id));
        await fetchData();
      } else {
        toast({ variant: "destructive", title: "Revoke Failed", description: json.error || "Could not revoke access." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not reach the server." });
    } finally {
      setRevokingId(null);
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

      {/* 70% canvas / 30% structure / 10% accent authority panel */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-700 via-emerald-500 to-amber-500" />
          <div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-emerald-50 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-36 w-36 rounded-full bg-amber-50/80 blur-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm shrink-0 border border-emerald-200 bg-emerald-700">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                    Teacher Portal Authority Control
                  </h1>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-700 font-bold border border-slate-200">
                    {stats.total} Active Faculty
                  </span>
                  <span className="px-3 py-1 rounded-full bg-amber-50 text-[10px] text-amber-800 font-bold border border-amber-200 uppercase tracking-wider">
                    70 · 30 · 10
                  </span>
                </div>
                <p className="text-slate-600 text-sm mt-1.5 max-w-2xl">
                  Manage every admin tab in one place — {AVAILABLE_PAGES.length} modules across attendance, academics, community, library and governance. Grant all authority, configure individual tabs, or revoke access instantly. Teachers receive an in-app notification for every change.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm h-10 px-4 rounded-xl"
                onClick={() => fetchData(true)}
                disabled={refreshing || loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
              </Button>

              <Button
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm h-10 px-5 rounded-xl transition-transform active:scale-95"
                onClick={() => openModalForTeachers(teachers.map((t) => t.id), AVAILABLE_PAGES.map((p) => p.id))}
              >
                <Sparkles className="w-4 h-4 mr-2" /> Bulk Grant All Features
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-200">
            <div className="rounded-2xl p-3 border border-slate-200 bg-slate-50/70">
              <span className="text-[11px] text-slate-500 font-medium block">Total Active Faculty</span>
              <span className="text-xl font-bold text-slate-900 mt-0.5 block">{stats.total}</span>
            </div>
            <div className="rounded-2xl p-3 border border-emerald-200 bg-emerald-50/60">
              <span className="text-[11px] text-emerald-800/80 font-medium block">Full Authority Access</span>
              <span className="text-xl font-bold text-emerald-700 mt-0.5 block">{stats.fullAuth}</span>
            </div>
            <div className="rounded-2xl p-3 border border-amber-200 bg-amber-50/60">
              <span className="text-[11px] text-amber-800/80 font-medium block">Custom Module Access</span>
              <span className="text-xl font-bold text-amber-700 mt-0.5 block">{stats.partial}</span>
            </div>
            <div className="rounded-2xl p-3 border border-slate-200 bg-slate-50/70">
              <span className="text-[11px] text-slate-500 font-medium block">Total Modules Controlled</span>
              <span className="text-xl font-bold text-slate-900 mt-0.5 block">{AVAILABLE_PAGES.length} Core Pages</span>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-500/70 to-transparent" />
        </div>
      </motion.div>

      {/* ── Modules Quick-Filter Bar ── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-700" />
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Filter Faculty by Assigned Module ({AVAILABLE_PAGES.length} Core Pages):
            </span>
          </div>
          {activeModuleFilter !== "ALL" && (
            <button
              onClick={() => setActiveModuleFilter("ALL")}
              className="text-xs text-slate-600 hover:text-slate-900 font-bold hover:underline"
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
                ? "bg-emerald-700 text-white border-emerald-700 shadow-sm scale-105"
                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
            }`}
          >
            All Faculty ({teachers.length})
          </button>

          {AVAILABLE_PAGES.map((page) => {
            const Icon = page.icon;
            const count = teachers.filter((t) => t.assignedPages?.includes(page.id)).length;
            const isSelected = activeModuleFilter === page.id;
            const tone = CATEGORY_TONES[page.category];
            return (
              <button
                key={page.id}
                onClick={() => setActiveModuleFilter(isSelected ? "ALL" : page.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-emerald-700 text-white border-emerald-700 shadow-md scale-105 font-bold"
                    : `${tone.badge} hover:border-emerald-300 hover:bg-white`
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : tone.icon}`} />
                <span>{page.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                  isSelected ? "bg-white/20 text-white" : "bg-white/70 text-slate-700"
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
            const isFullAuthority = teacher.hasFullAccess || assignedCount >= AVAILABLE_PAGES.length;
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
                <div className="p-5 border-b border-slate-200 bg-slate-50/70">
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
                      <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 border border-emerald-600/30">
                        {getInitials(teacher.name.split(" ")[0], teacher.name.split(" ")[1] || "")}
                      </div>

                      {/* Info */}
                      <div className="min-w-0">
                        <h3 className="font-display font-bold text-slate-900 text-base truncate">
                          {teacher.name}
                        </h3>
                        <p className="text-xs text-slate-500 truncate">{teacher.email}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-mono font-bold text-slate-700 bg-slate-200/70 px-2 py-0.5 rounded-md">
                            ID: {teacher.employeeId}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium truncate">
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

                {/* Assigned Modules Matrix */}
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
                  <div className="pt-4 mt-4 border-t border-slate-200 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => openModalForTeachers([teacher.id], teacher.assignedPages)}
                      className="flex-1 min-w-[150px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs h-9 rounded-xl shadow-sm transition-all"
                    >
                      <Shield className="w-3.5 h-3.5 mr-1.5" /> Configure Modules
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleGrantAll(teacher)}
                      disabled={grantingId === teacher.id || revokingId === teacher.id}
                      className="h-9 px-3 rounded-xl border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold"
                      title="Grant every admin tab"
                    >
                      {grantingId === teacher.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      <span className="ml-1.5">Grant All</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevokeAll(teacher)}
                      disabled={grantingId === teacher.id || revokingId === teacher.id}
                      className="h-9 px-3 rounded-xl border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-rose-700 text-xs font-bold"
                      title="Revoke all delegated access"
                    >
                      {revokingId === teacher.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                      <span className="ml-1.5">Revoke</span>
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
        <ModalContent className="max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shadow-sm">
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
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> One-Click Role Presets:
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

            {/* All Modules Grid Selector */}
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
                    Grant All ({AVAILABLE_PAGES.length})
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
                          <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold border ${CATEGORY_TONES[page.category].badge}`}>
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
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl px-5 shadow-sm"
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
