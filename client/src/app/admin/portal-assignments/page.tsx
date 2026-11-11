"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  LayoutGrid,
  TableProperties,
  Eye,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Filter,
  ShieldCheck,
  ArrowUpRight,
  ArrowRightLeft,
  Lock,
  Unlock,
  HeartHandshake,
  Edit3,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
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
  category: "Academics" | "Attendance" | "Operations" | "Communications" | "Library" | "General" | "Community" | "Systems";
  description: string;
  icon: React.ElementType;
}

// Canonical catalog — must match TEACHER_AVAILABLE_PAGES on the server
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
    id: "talabat-profiles-remarks",
    label: "Yearly Profile Remarks (Edit)",
    category: "Community",
    description: "Grant permission to edit Asateza remarks & ratings in Yearly Profile (Locked by default)",
    icon: Edit3,
  },
  {
    id: "counsellor-remarks",
    label: "Counsellor Remarks & Guidance",
    category: "Community",
    description: "Access and edit Counsellor Remarks tab in Yearly Profile (Confidential)",
    icon: HeartHandshake,
  },
  {
    id: "timetable",
    label: "Timetable Matrix",
    category: "Academics",
    description: "Master timetable, weekly schedule & slot substitutions",
    icon: CalendarDays,
  },
  {
    id: "badal",
    label: "Badal & Substitution Desk",
    category: "Academics",
    description: "Manage substitute teachers, proxy assignments, email notices & WhatsApp links",
    icon: ArrowRightLeft,
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
    description: "School warehouse inventory, asset catalog, stock management & equipment tracking",
    icon: Package,
  },
  {
    id: "library",
    label: "Library",
    category: "Library",
    description: "Integrated library workspace, digital catalog, physical shelves & member lending",
    icon: Library,
  },
  {
    id: "library-overview",
    label: "Library Overview",
    category: "Library",
    description: "Library dashboard, circulation metrics, quick loan issuing & return analytics",
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

const CATEGORIES = ["Academics", "Attendance", "Operations", "Library", "Community", "Systems", "General"] as const;

const CATEGORY_TONES: Record<PageDefinition["category"], { badge: string; icon: string; dot: string; border: string }> = {
  General: { badge: "bg-slate-100 text-slate-700 border-slate-200", icon: "text-slate-600", dot: "bg-slate-400", border: "border-slate-300" },
  Academics: { badge: "bg-blue-50 text-blue-800 border-blue-200", icon: "text-blue-700", dot: "bg-blue-500", border: "border-blue-300" },
  Attendance: { badge: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: "text-emerald-700", dot: "bg-emerald-500", border: "border-emerald-300" },
  Operations: { badge: "bg-amber-50 text-amber-800 border-amber-200", icon: "text-amber-700", dot: "bg-amber-500", border: "border-amber-300" },
  Communications: { badge: "bg-purple-50 text-purple-800 border-purple-200", icon: "text-purple-700", dot: "bg-purple-500", border: "border-purple-300" },
  Library: { badge: "bg-indigo-50 text-indigo-800 border-indigo-200", icon: "text-indigo-700", dot: "bg-indigo-500", border: "border-indigo-300" },
  Community: { badge: "bg-rose-50 text-rose-800 border-rose-200", icon: "text-rose-700", dot: "bg-rose-500", border: "border-rose-300" },
  Systems: { badge: "bg-orange-50 text-orange-800 border-orange-200", icon: "text-orange-700", dot: "bg-orange-500", border: "border-orange-300" },
};

const PRESETS = [
  {
    name: "Master Administrator (Portal Assignments & All Admin Rights)",
    description: "Confers full Portal Assignments authority with unconditional administrative access across all 31 system modules",
    pages: AVAILABLE_PAGES.map((p) => p.id),
  },
  {
    name: "Portal Assignments & Core Delegated Admin",
    description: "Delegated authority to assign portal permissions, manage staff, passwords, notifications & security",
    pages: ["dashboard", "portal-assignments", "users", "passwords", "notifications", "security", "settings", "profile"],
  },
  {
    name: "Timetable & Badal Management Officer",
    description: "Full master matrix schedule, substitute teacher assignments (Badal), email notices & Takhteet portions",
    pages: ["dashboard", "classes", "timetable", "badal", "takhteet", "leave", "profile"],
  },
  {
    name: "Standard Academic Faculty",
    description: "Dashboard, Classes, Yearly Profile, Timetable, Manual Attendance, Profile",
    pages: ["dashboard", "classes", "talabat-profiles", "timetable", "manual-attendance", "profile"],
  },
  {
    name: "Takhteet & Portion In-Charge",
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
    name: "Point Matrix & Discipline",
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
  const [activeAuthorityFilter, setActiveAuthorityFilter] = useState<"ALL" | "FULL" | "CUSTOM" | "MINIMAL">("ALL");
  const [viewMode, setViewMode] = useState<"cards" | "matrix">("cards");

  // Selection state for batch bulk operations
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<string[]>([]);

  // Expanded categories state for inline toggles per teacher: { [teacherId]: categoryName | null }
  const [expandedCategories, setExpandedCategories] = useState<Record<string, string | null>>({});

  // Expanded page visibility breakdown per teacher: { [teacherId]: boolean }
  const [showVisibilityDiff, setShowVisibilityDiff] = useState<Record<string, boolean>>({});

  const toggleVisibilityDiff = (teacherId: string) => {
    setShowVisibilityDiff((prev) => ({
      ...prev,
      [teacherId]: !prev[teacherId],
    }));
  };

  // Live Portal Simulation Preview state
  const [previewTeacher, setPreviewTeacher] = useState<any | null>(null);

  // Modal State
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [modalTargetTeacherIds, setModalTargetTeacherIds] = useState<string[]>([]);
  const [modalSelectedPages, setModalSelectedPages] = useState<Set<string>>(new Set());
  const [modalSearch, setModalSearch] = useState("");
  const [modalCategoryFilter, setModalCategoryFilter] = useState<string>("ALL");
  const [saving, setSaving] = useState(false);
  const [grantingId, setGrantingId] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [inlineUpdating, setInlineUpdating] = useState<string | null>(null);

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

    if (activeAuthorityFilter === "FULL") {
      list = list.filter((t) => t.hasFullAccess || (t.assignedPages?.length || 0) >= AVAILABLE_PAGES.length);
    } else if (activeAuthorityFilter === "CUSTOM") {
      list = list.filter((t) => !t.hasFullAccess && (t.assignedPages?.length || 0) > 2 && (t.assignedPages?.length || 0) < AVAILABLE_PAGES.length);
    } else if (activeAuthorityFilter === "MINIMAL") {
      list = list.filter((t) => !t.hasFullAccess && (t.assignedPages?.length || 0) <= 2);
    }

    return list;
  }, [teachers, search, activeModuleFilter, activeAuthorityFilter]);

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
    setModalSearch("");
    setModalCategoryFilter("ALL");

    if (currentPages && currentPages.length > 0) {
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
      const isMasterAdminGrant =
        pagesArray.includes("portal-assignments") ||
        pagesArray.length >= AVAILABLE_PAGES.length;

      const finalPages = isMasterAdminGrant ? AVAILABLE_PAGES.map((p) => p.id) : pagesArray;

      const res = await fetch("/api/admin/portal-assignments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherIds: modalTargetTeacherIds,
          pages: finalPages,
          grantAll: isMasterAdminGrant,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          variant: "success",
          title: isMasterAdminGrant ? "Master Administrator Assigned" : "Portal Permissions Updated",
          description: isMasterAdminGrant
            ? `Granted full administrative authority and all ${AVAILABLE_PAGES.length} modules to ${modalTargetTeacherIds.length} faculty member(s). In-app notifications delivered.`
            : `Assigned ${pagesArray.length} of ${AVAILABLE_PAGES.length} modules to ${modalTargetTeacherIds.length} faculty member(s). In-app notifications delivered.`,
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

  // Instant inline module toggle directly on card or matrix
  const handleToggleModuleInline = async (teacher: any, pageId: string) => {
    const key = `${teacher.id}-${pageId}`;
    setInlineUpdating(key);

    const currentPages = new Set(teacher.assignedPages || []);
    if (currentPages.has(pageId)) {
      currentPages.delete(pageId);
    } else {
      currentPages.add(pageId);
    }
    const nextPages = Array.from(currentPages);
    const hasFull = nextPages.includes("portal-assignments") || nextPages.length >= AVAILABLE_PAGES.length;
    const finalPages = hasFull ? AVAILABLE_PAGES.map((p) => p.id) : nextPages;

    // Optimistic UI update
    setTeachers((prev) =>
      prev.map((t) =>
        t.id === teacher.id
          ? {
              ...t,
              assignedPages: finalPages,
              hasFullAccess: hasFull,
            }
          : t
      )
    );

    try {
      const res = await fetch("/api/admin/portal-assignments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherIds: [teacher.id],
          pages: finalPages,
          grantAll: hasFull,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast({ variant: "destructive", title: "Sync Failed", description: json.error || "Could not update permission." });
        await fetchData();
      } else {
        const pageObj = AVAILABLE_PAGES.find((p) => p.id === pageId);
        toast({
          variant: "default",
          title: hasFull && (pageId === "portal-assignments" || nextPages.includes("portal-assignments"))
            ? "Master Administrator Assigned"
            : currentPages.has(pageId)
            ? "Module Enabled"
            : "Module Disabled",
          description: hasFull && (pageId === "portal-assignments" || nextPages.includes("portal-assignments"))
            ? `${teacher.name} has been granted all admin rights across the institution.`
            : `${pageObj?.label || pageId} ${currentPages.has(pageId) ? "granted to" : "removed from"} ${teacher.name}.`,
        });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not sync with server." });
      await fetchData();
    } finally {
      setInlineUpdating(null);
    }
  };

  // Toggle entire category for a teacher inline
  const handleToggleCategoryInline = async (teacher: any, category: string, grant: boolean) => {
    const categoryPages = AVAILABLE_PAGES.filter((p) => p.category === category).map((p) => p.id);
    const currentPages = new Set(teacher.assignedPages || []);

    categoryPages.forEach((p) => {
      if (grant) currentPages.add(p);
      else currentPages.delete(p);
    });

    const nextPages = Array.from(currentPages);
    const hasFull = nextPages.length >= AVAILABLE_PAGES.length;

    setTeachers((prev) =>
      prev.map((t) =>
        t.id === teacher.id
          ? { ...t, assignedPages: nextPages, hasFullAccess: hasFull }
          : t
      )
    );

    try {
      const res = await fetch("/api/admin/portal-assignments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherIds: [teacher.id],
          pages: nextPages,
          grantAll: hasFull,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          variant: "success",
          title: `${category} Updated`,
          description: `${grant ? "Granted" : "Revoked"} all ${category} modules for ${teacher.name}.`,
        });
      } else {
        await fetchData();
      }
    } catch {
      await fetchData();
    }
  };

  const handleGrantAll = async (teacher: any) => {
    if (!window.confirm(`Grant Master Administrator & all admin rights to ${teacher.name}? They will receive every admin tab, portal assignments authority, and full backend authority.`)) {
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
          title: "Master Administrator Rights Granted",
          description: `${teacher.name} now has all ${AVAILABLE_PAGES.length} modules, Portal Assignments authority, and universal admin rights. In-app notification delivered.`,
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
          description: `${teacher.name} now has Dashboard and Profile only. In-app notification delivered.`,
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

  const toggleCategoryDrawer = (teacherId: string, category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [teacherId]: prev[teacherId] === category ? null : category,
    }));
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

      {/* Hero Authority Panel */}
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
                    Faculty Portal Authority Control
                  </h1>
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-700 font-bold border border-slate-200">
                    {stats.total} Active Faculty
                  </span>
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-[10px] text-emerald-900 font-bold border border-emerald-300 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-700" /> Interactive Switchboard
                  </span>
                </div>
                <p className="text-slate-600 text-sm mt-1.5 max-w-2xl">
                  Configure live module authority for {AVAILABLE_PAGES.length} pages across academics, attendance, health, library and governance. Toggle permissions inline, run role presets, or launch live portal previews.
                </p>
              </div>
            </div>

            {/* Quick Actions & View Switcher */}
            <div className="flex items-center gap-3 shrink-0 flex-wrap">
              <div className="bg-slate-100 p-1 rounded-2xl flex items-center border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    viewMode === "cards"
                      ? "bg-white text-emerald-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Interactive Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("matrix")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    viewMode === "matrix"
                      ? "bg-white text-emerald-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <TableProperties className="w-3.5 h-3.5" />
                  <span>Dense Matrix</span>
                </button>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-sm h-10 px-3.5 rounded-xl"
                onClick={() => fetchData(true)}
                disabled={refreshing || loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
              </Button>

              <Button
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm h-10 px-4 rounded-xl transition-transform active:scale-95"
                onClick={() => openModalForTeachers(teachers.map((t) => t.id), AVAILABLE_PAGES.map((p) => p.id))}
              >
                <Sparkles className="w-4 h-4 mr-1.5" /> Bulk Grant All
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-200">
            <button
              onClick={() => setActiveAuthorityFilter("ALL")}
              className={`text-left rounded-2xl p-3 border transition-all ${
                activeAuthorityFilter === "ALL"
                  ? "border-slate-400 bg-slate-100/90 shadow-xs"
                  : "border-slate-200 bg-slate-50/70 hover:bg-slate-100"
              }`}
            >
              <span className="text-[11px] text-slate-500 font-medium block">Total Active Faculty</span>
              <span className="text-xl font-bold text-slate-900 mt-0.5 block">{stats.total}</span>
            </button>
            <button
              onClick={() => setActiveAuthorityFilter(activeAuthorityFilter === "FULL" ? "ALL" : "FULL")}
              className={`text-left rounded-2xl p-3 border transition-all ${
                activeAuthorityFilter === "FULL"
                  ? "border-emerald-500 bg-emerald-100 shadow-xs ring-2 ring-emerald-500/20"
                  : "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-emerald-800/80 font-medium block">Master Admin (All Rights)</span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <span className="text-xl font-bold text-emerald-700 mt-0.5 block">{stats.fullAuth}</span>
            </button>
            <button
              onClick={() => setActiveAuthorityFilter(activeAuthorityFilter === "CUSTOM" ? "ALL" : "CUSTOM")}
              className={`text-left rounded-2xl p-3 border transition-all ${
                activeAuthorityFilter === "CUSTOM"
                  ? "border-amber-500 bg-amber-100 shadow-xs ring-2 ring-amber-500/20"
                  : "border-amber-200 bg-amber-50/60 hover:bg-amber-100/70"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-amber-800/80 font-medium block">Custom Visible Pages</span>
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <span className="text-xl font-bold text-amber-700 mt-0.5 block">{stats.partial}</span>
            </button>
            <button
              onClick={() => setActiveAuthorityFilter(activeAuthorityFilter === "MINIMAL" ? "ALL" : "MINIMAL")}
              className={`text-left rounded-2xl p-3 border transition-all ${
                activeAuthorityFilter === "MINIMAL"
                  ? "border-slate-500 bg-slate-200 shadow-xs ring-2 ring-slate-400/20"
                  : "border-slate-200 bg-slate-50/70 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-medium block">Base Faculty (Restricted)</span>
                <Lock className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <span className="text-xl font-bold text-slate-900 mt-0.5 block">{stats.minimal}</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Interactive Controls & Filter Bar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search faculty by name, email, employee ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none shadow-2xs transition-all"
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
                <Shield className="w-3.5 h-3.5 mr-1.5" /> Batch Configure ({selectedFacultyIds.length})
              </Button>
            )}

            <span className="text-xs text-gray-500 font-medium">
              Showing <strong className="text-gray-900">{filteredTeachers.length}</strong> of {teachers.length} active faculty
            </span>
          </div>
        </div>

        {/* Category Pill Filters */}
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3 text-emerald-600" /> Filter by Module:
          </span>

          <button
            onClick={() => setActiveModuleFilter("ALL")}
            className={`px-3 py-1 rounded-xl text-xs font-bold shrink-0 transition-all ${
              activeModuleFilter === "ALL"
                ? "bg-emerald-700 text-white shadow-2xs"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Modules
          </button>

          {AVAILABLE_PAGES.map((page) => {
            const count = teachers.filter((t) => t.assignedPages?.includes(page.id) || t.hasFullAccess).length;
            const isSelected = activeModuleFilter === page.id;
            const Icon = page.icon;
            return (
              <button
                key={page.id}
                onClick={() => setActiveModuleFilter(isSelected ? "ALL" : page.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold shrink-0 transition-all border ${
                  isSelected
                    ? "bg-emerald-700 text-white border-emerald-700 shadow-2xs font-bold"
                    : "bg-white text-slate-700 border-slate-200 hover:border-emerald-300"
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span>{page.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main View Area: Cards or Dense Matrix */}
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
        </div>
      ) : viewMode === "cards" ? (
        /* ── INTERACTIVE CARDS VIEW ── */
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredTeachers.map((teacher) => {
            const assignedCount = teacher.assignedPages?.length || 0;
            const isFullAuthority = teacher.hasFullAccess || assignedCount >= AVAILABLE_PAGES.length;
            const isSelected = selectedFacultyIds.includes(teacher.id);
            const activeCategory = expandedCategories[teacher.id] || null;

            return (
              <motion.div
                key={teacher.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-xl ${
                  isSelected
                    ? "border-emerald-500 ring-2 ring-emerald-500/20"
                    : "border-slate-200 hover:border-emerald-200"
                }`}
              >
                {/* Faculty Card Header */}
                <div
                  className={`p-5 border-b transition-colors ${
                    isFullAuthority
                      ? "border-amber-200/80 bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-slate-50/60"
                      : "border-slate-100 bg-slate-50/60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
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

                      <div
                        className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 border ${
                          isFullAuthority
                            ? "bg-gradient-to-br from-amber-600 to-amber-700 border-amber-400/50"
                            : "bg-emerald-700 border-emerald-600/30"
                        }`}
                      >
                        {getInitials(teacher.name.split(" ")[0], teacher.name.split(" ")[1] || "")}
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-display font-bold text-slate-900 text-base truncate flex items-center gap-1.5">
                          <span>{teacher.name}</span>
                          {isFullAuthority && (
                            <ShieldCheck className="w-4 h-4 text-amber-600 inline shrink-0" />
                          )}
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
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-extrabold shadow-xs border border-amber-400">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-100" /> Master Admin
                        </span>
                        <span className="text-[9px] text-emerald-800 font-extrabold bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300">
                          All Admin Rights Active
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-900 text-[10px] font-bold border border-emerald-300">
                          <Eye className="w-3 h-3 text-emerald-700" /> {assignedCount} Visible
                        </span>
                        <span className="text-[9px] text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {AVAILABLE_PAGES.length - assignedCount} Hidden
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Interactive Category Progress Switchboard */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                        Category Authority Gauges:
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium">Click category to expand toggles</span>
                    </div>

                    {/* Interactive Category Pills */}
                    <div className="grid grid-cols-2 gap-2">
                      {CATEGORIES.filter((c) => c !== "General").map((category) => {
                        const pagesInCat = AVAILABLE_PAGES.filter((p) => p.category === category);
                        const assignedInCat = pagesInCat.filter((p) => teacher.assignedPages?.includes(p.id) || teacher.hasFullAccess).length;
                        const pct = Math.round((assignedInCat / pagesInCat.length) * 100);
                        const isExpanded = activeCategory === category;
                        const tone = CATEGORY_TONES[category as PageDefinition["category"]] || CATEGORY_TONES.General;

                        return (
                          <button
                            key={category}
                            type="button"
                            onClick={() => toggleCategoryDrawer(teacher.id, category)}
                            className={`p-2 rounded-xl border text-left transition-all ${
                              isExpanded
                                ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                : assignedInCat > 0
                                ? "bg-slate-50 hover:bg-slate-100 border-slate-200"
                                : "bg-slate-50/50 hover:bg-slate-100/70 border-dashed border-slate-200 text-slate-400"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className={`text-[11px] font-bold truncate ${isExpanded ? "text-white" : "text-slate-800"}`}>
                                {category}
                              </span>
                              <span className={`text-[10px] font-mono font-bold ${isExpanded ? "text-amber-400" : "text-slate-500"}`}>
                                {assignedInCat}/{pagesInCat.length}
                              </span>
                            </div>

                            {/* Progress Gauge */}
                            <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                              <div
                                className={`h-full transition-all duration-300 ${
                                  pct === 100
                                    ? "bg-emerald-500"
                                    : pct > 0
                                    ? "bg-amber-500"
                                    : "bg-transparent"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Expandable Module Drawer for selected category */}
                  <AnimatePresence>
                    {activeCategory && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2.5 overflow-hidden"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-600" />
                            {activeCategory} Modules (Tap to Toggle):
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleCategoryInline(teacher, activeCategory, true)}
                              className="text-[10px] font-bold text-emerald-700 hover:underline px-1.5 py-0.5 rounded bg-emerald-50"
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleCategoryInline(teacher, activeCategory, false)}
                              className="text-[10px] font-bold text-slate-500 hover:underline px-1.5 py-0.5 rounded bg-slate-100"
                            >
                              None
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {AVAILABLE_PAGES.filter((p) => p.category === activeCategory).map((page) => {
                            const isAssigned = teacher.assignedPages?.includes(page.id) || teacher.hasFullAccess;
                            const isPending = inlineUpdating === `${teacher.id}-${page.id}`;
                            const Icon = page.icon;

                            return (
                              <button
                                key={page.id}
                                type="button"
                                disabled={isPending}
                                onClick={() => handleToggleModuleInline(teacher, page.id)}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                                  isAssigned
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-2xs font-bold hover:bg-emerald-700"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50"
                                }`}
                              >
                                {isPending ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Icon className={`w-3 h-3 ${isAssigned ? "text-white" : "text-slate-400"}`} />
                                )}
                                <span>{page.label}</span>
                                {isAssigned && <Check className="w-3 h-3 text-white ml-0.5" />}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Visual Page Visibility Breakdown (Visible vs Hidden) ── */}
                  <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                    <button
                      type="button"
                      onClick={() => toggleVisibilityDiff(teacher.id)}
                      className="w-full p-2.5 flex items-center justify-between bg-slate-50/90 hover:bg-slate-100 transition-colors text-left"
                      aria-expanded={Boolean(showVisibilityDiff[teacher.id])}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Eye className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span className="text-xs font-bold text-slate-800 truncate">
                          Page Visibility Breakdown
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-950 text-[10px] font-extrabold border border-emerald-300">
                          <Check className="w-3 h-3 text-emerald-700" />
                          {isFullAuthority ? "All 31 Visible" : `${assignedCount} Visible`}
                        </span>
                        {!isFullAuthority && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-300">
                            <Lock className="w-2.5 h-2.5 text-slate-400" />
                            {AVAILABLE_PAGES.length - assignedCount} Hidden
                          </span>
                        )}
                        {showVisibilityDiff[teacher.id] ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5" />
                        )}
                      </div>
                    </button>

                    <AnimatePresence>
                      {showVisibilityDiff[teacher.id] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-3 border-t border-slate-200 bg-slate-50/60 space-y-3"
                        >
                          {isFullAuthority ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-3 space-y-2">
                              <div className="flex items-center gap-2 text-amber-950 text-xs font-bold">
                                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>Master Administrator: Full Visibility Unlocked</span>
                              </div>
                              <p className="text-[11px] text-amber-900 leading-relaxed">
                                This faculty member holds universal administrator authority. Every portal page, settings menu, and sensitive system endpoint is visible and fully functional.
                              </p>
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {AVAILABLE_PAGES.map((page) => {
                                  const Icon = page.icon;
                                  return (
                                    <span
                                      key={page.id}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-emerald-300 text-emerald-950 text-[10px] font-bold shadow-2xs"
                                    >
                                      <Icon className="w-3 h-3 text-emerald-600" />
                                      <span>{page.label}</span>
                                      <Check className="w-2.5 h-2.5 text-emerald-600 ml-0.5" />
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {/* Visible Pages */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1">
                                    <Eye className="w-3 h-3 text-emerald-600" />
                                    Visible to Teacher ({assignedCount}):
                                  </span>
                                  <span className="text-[10px] text-emerald-700 font-semibold">Authorized</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {AVAILABLE_PAGES.filter(
                                    (p) => teacher.assignedPages?.includes(p.id) || p.id === "dashboard" || p.id === "profile"
                                  ).map((page) => {
                                    const Icon = page.icon;
                                    return (
                                      <span
                                        key={page.id}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-950 text-[10px] font-bold shadow-2xs"
                                      >
                                        <Icon className="w-3 h-3 text-emerald-700" />
                                        <span>{page.label}</span>
                                        <Check className="w-2.5 h-2.5 text-emerald-600 ml-0.5" />
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Hidden Pages */}
                              <div>
                                <div className="flex items-center justify-between mb-1.5 pt-2 border-t border-slate-200">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-600 flex items-center gap-1">
                                    <Lock className="w-3 h-3 text-slate-400" />
                                    Hidden / Blocked ({AVAILABLE_PAGES.length - assignedCount}):
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-semibold">Click to reveal</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {AVAILABLE_PAGES.filter(
                                    (p) => !teacher.assignedPages?.includes(p.id) && p.id !== "dashboard" && p.id !== "profile"
                                  ).map((page) => {
                                    const Icon = page.icon;
                                    return (
                                      <button
                                        key={page.id}
                                        type="button"
                                        onClick={() => handleToggleModuleInline(teacher, page.id)}
                                        title={`Click to grant and make ${page.label} visible`}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-emerald-50 hover:border-emerald-300 border border-slate-200 text-slate-600 hover:text-emerald-900 text-[10px] font-medium transition-colors cursor-pointer group"
                                      >
                                        <Icon className="w-3 h-3 text-slate-400 group-hover:text-emerald-600" />
                                        <span className="line-through group-hover:no-underline">{page.label}</span>
                                        <span className="text-[9px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 ml-0.5">+ Show</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <Button
                      size="sm"
                      onClick={() => openModalForTeachers([teacher.id], teacher.assignedPages)}
                      className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-9 rounded-xl shadow-2xs"
                    >
                      <Shield className="w-3.5 h-3.5 mr-1" /> Configure
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewTeacher(teacher)}
                      className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                      title="Preview teacher's portal sidebar"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1 text-slate-500" />
                      <span>Preview</span>
                    </Button>

                    {!isFullAuthority ? (
                      <Button
                        size="sm"
                        onClick={() => handleGrantAll(teacher)}
                        disabled={grantingId === teacher.id}
                        className="h-9 px-3 rounded-xl border-amber-300 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-2xs"
                        title="Assign Portal Assignments (Confers All Admin Rights)"
                      >
                        {grantingId === teacher.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5 mr-1 text-amber-100" />
                        )}
                        <span>Make Master Admin</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRevokeAll(teacher)}
                        disabled={revokingId === teacher.id}
                        className="h-9 px-2.5 rounded-xl border-slate-200 text-slate-500 hover:text-rose-700 hover:bg-rose-50 text-xs font-bold"
                        title="Revoke all delegated permissions"
                      >
                        {revokingId === teacher.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* ── INTERACTIVE DENSE MATRIX SWITCHBOARD VIEW ── */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900">
                Institutional Access Matrix
              </h3>
              <p className="text-xs text-slate-500">
                Interactive real-time switchboard — click any cell to instantly toggle page permissions.
              </p>
            </div>
            <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1 rounded-xl border border-emerald-200">
              {filteredTeachers.length} Faculty × {AVAILABLE_PAGES.length} Modules
            </span>
          </div>

          <div className="overflow-x-auto max-h-[70vh]">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="sticky top-0 bg-slate-100 z-20 border-b border-slate-200 shadow-2xs">
                <tr>
                  <th className="sticky left-0 bg-slate-100 z-30 p-3 min-w-[240px] font-bold text-slate-900 border-r border-slate-200">
                    Faculty Member
                  </th>
                  {AVAILABLE_PAGES.map((page) => {
                    const Icon = page.icon;
                    return (
                      <th
                        key={page.id}
                        className="p-2.5 font-bold text-slate-700 text-center min-w-[90px] border-r border-slate-200 hover:bg-slate-200/60"
                        title={`${page.label} (${page.category}): ${page.description}`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Icon className="w-3.5 h-3.5 text-slate-600" />
                          <span className="text-[10px] leading-tight truncate max-w-[85px] block">{page.label}</span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeachers.map((teacher) => {
                  const isFull = teacher.hasFullAccess || (teacher.assignedPages?.length || 0) >= AVAILABLE_PAGES.length;

                  return (
                    <tr key={teacher.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="sticky left-0 bg-white z-10 p-3 border-r border-slate-200 font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-xl text-white font-bold text-xs flex items-center justify-center shrink-0 ${isFull ? "bg-amber-600 shadow-2xs" : "bg-emerald-700"}`}>
                            {getInitials(teacher.name.split(" ")[0], teacher.name.split(" ")[1] || "")}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900 truncate">{teacher.name}</p>
                              {isFull && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[9px] font-extrabold border border-amber-300 shrink-0">
                                  <ShieldCheck className="w-2.5 h-2.5 text-amber-700" /> Master Admin
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {teacher.employeeId}</span>
                          </div>
                        </div>
                      </td>

                      {AVAILABLE_PAGES.map((page) => {
                        const isAssigned = teacher.assignedPages?.includes(page.id) || isFull;
                        const isPending = inlineUpdating === `${teacher.id}-${page.id}`;

                        return (
                          <td
                            key={page.id}
                            className="p-2 text-center border-r border-slate-100 hover:bg-emerald-50/50 cursor-pointer"
                            onClick={() => handleToggleModuleInline(teacher, page.id)}
                          >
                            <button
                              type="button"
                              disabled={isPending}
                              className={`w-6 h-6 rounded-lg mx-auto flex items-center justify-center transition-all ${
                                isAssigned
                                  ? "bg-emerald-600 text-white shadow-xs"
                                  : "border border-slate-200 hover:border-emerald-400 bg-white"
                              }`}
                            >
                              {isPending ? (
                                <Loader2 className="w-3 h-3 animate-spin text-emerald-700" />
                              ) : isAssigned ? (
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              ) : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          LIVE PORTAL PREVIEW DRAWER (Simulated Teacher Sidebar)
         ───────────────────────────────────────────────────────────── */}
      {previewTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setPreviewTeacher(null)} />
          <div className="relative z-10 w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 animate-slide-up">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-bold">
                  {getInitials(previewTeacher.name.split(" ")[0], previewTeacher.name.split(" ")[1] || "")}
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900 leading-tight">
                    {previewTeacher.name}&apos;s Portal Preview
                  </h3>
                  <p className="text-xs text-slate-500">Live simulation of visible sidebar modules</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewTeacher(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sidebar Simulation */}
            <div className="my-4 max-h-[60vh] overflow-y-auto space-y-4 pr-1">
              <div className="p-3 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">Simulated Access Level</span>
                  <span className="text-xs font-bold">
                    {previewTeacher.hasFullAccess || (previewTeacher.assignedPages?.length || 0) >= AVAILABLE_PAGES.length
                      ? "Full Delegated Authority (All Pages Visible)"
                      : `${previewTeacher.assignedPages?.length || 0} Modules Delegated`}
                  </span>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    setPreviewTeacher(null);
                    openModalForTeachers([previewTeacher.id], previewTeacher.assignedPages);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-8 px-3"
                >
                  Edit Permissions
                </Button>
              </div>

              {/* Grouped Modules */}
              {CATEGORIES.map((category) => {
                const catPages = AVAILABLE_PAGES.filter(
                  (p) =>
                    p.category === category &&
                    (previewTeacher.assignedPages?.includes(p.id) || previewTeacher.hasFullAccess)
                );
                if (catPages.length === 0) return null;

                return (
                  <div key={category} className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-2">
                      {category} ({catPages.length})
                    </span>
                    <div className="space-y-1">
                      {catPages.map((page) => {
                        const Icon = page.icon;
                        return (
                          <div
                            key={page.id}
                            className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="w-4 h-4 text-emerald-700" />
                              <span className="font-semibold text-slate-800">{page.label}</span>
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">/teacher/{page.id}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Modules Hidden from Teacher */}
              {!previewTeacher.hasFullAccess && (previewTeacher.assignedPages?.length || 0) < AVAILABLE_PAGES.length && (
                <div className="space-y-2 pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block px-2 flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-slate-400" />
                    Hidden From This Faculty Member ({AVAILABLE_PAGES.length - (previewTeacher.assignedPages?.length || 0)} Modules):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {AVAILABLE_PAGES.filter(
                      (p) => !previewTeacher.assignedPages?.includes(p.id) && p.id !== "dashboard" && p.id !== "profile"
                    ).map((page) => {
                      const Icon = page.icon;
                      return (
                        <div
                          key={page.id}
                          className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-100/70 border border-dashed border-slate-200 text-xs text-slate-500"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="line-through truncate">{page.label}</span>
                          </div>
                          <span className="text-[9px] text-slate-400 font-mono shrink-0">Hidden</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button onClick={() => setPreviewTeacher(null)} className="rounded-xl px-5 text-xs font-bold">
                Close Preview
              </Button>
            </div>
          </div>
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
            {/* Master Administrator Switch Card */}
            <div
              onClick={() => {
                if (modalSelectedPages.has("portal-assignments") && modalSelectedPages.size === AVAILABLE_PAGES.length) {
                  setModalSelectedPages(new Set(["dashboard", "profile"]));
                } else {
                  setModalSelectedPages(new Set(AVAILABLE_PAGES.map((p) => p.id)));
                }
              }}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                modalSelectedPages.has("portal-assignments") && modalSelectedPages.size === AVAILABLE_PAGES.length
                  ? "bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-transparent border-amber-300 ring-2 ring-amber-400/30"
                  : "bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">Master Administrator (All Admin Rights)</span>
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-[10px] font-extrabold text-amber-900 border border-amber-300">
                      Universal
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Assigns Portal Assignments authority with unrestricted administrative access to all 31 modules, API endpoints, and system tools.
                  </p>
                </div>
              </div>
              <div
                className={`w-6 h-6 rounded-lg flex items-center justify-center border transition-all ${
                  modalSelectedPages.has("portal-assignments") && modalSelectedPages.size === AVAILABLE_PAGES.length
                    ? "bg-amber-500 border-amber-500 text-white shadow-xs"
                    : "border-slate-300 bg-white"
                }`}
              >
                {modalSelectedPages.has("portal-assignments") && modalSelectedPages.size === AVAILABLE_PAGES.length && (
                  <Check className="w-4 h-4 stroke-[3]" />
                )}
              </div>
            </div>

            {/* Quick Presets */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" /> One-Click Role Presets:
                </span>
                <span className="text-[10px] text-gray-500 font-medium">Click any preset to auto-select modules</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset.pages)}
                    className="p-3 rounded-xl border border-gray-200/80 bg-white hover:bg-emerald-50/60 hover:border-emerald-300 text-left transition-all group shadow-2xs cursor-pointer"
                  >
                    <p className="text-xs font-bold text-gray-900 group-hover:text-emerald-800">{preset.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Search & Category Filter Pills */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter modules in modal..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-gray-200 text-xs focus:outline-none focus:border-emerald-500"
                />
                {modalSearch && (
                  <button onClick={() => setModalSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
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
                  Minimal Only
                </button>
              </div>
            </div>

            {/* Category tabs inside modal */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setModalCategoryFilter("ALL")}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                  modalCategoryFilter === "ALL"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All Categories
              </button>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setModalCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all ${
                    modalCategoryFilter === cat
                      ? "bg-slate-900 text-white font-bold"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Modules Grid Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {AVAILABLE_PAGES.filter((page) => {
                if (modalCategoryFilter !== "ALL" && page.category !== modalCategoryFilter) return false;
                if (modalSearch.trim()) {
                  const q = modalSearch.toLowerCase().trim();
                  return page.label.toLowerCase().includes(q) || page.description.toLowerCase().includes(q);
                }
                return true;
              }).map((page) => {
                const isChecked = modalSelectedPages.has(page.id);
                const isPortalAssign = page.id === "portal-assignments";
                const Icon = page.icon;

                return (
                  <div
                    key={page.id}
                    onClick={() => toggleModalPage(page.id)}
                    className={`cursor-pointer p-3.5 rounded-2xl border flex items-start justify-between gap-3 transition-all select-none ${
                      isChecked
                        ? isPortalAssign
                          ? "bg-amber-50/70 border-amber-500 shadow-md ring-2 ring-amber-400/30"
                          : "bg-white border-emerald-500 shadow-md ring-2 ring-emerald-500/20"
                        : "bg-gray-50/60 border-gray-200 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? isPortalAssign
                              ? "bg-amber-500 text-white"
                              : "bg-emerald-100 text-emerald-800"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-gray-900 truncate">{page.label}</p>
                          {isPortalAssign && (
                            <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 font-extrabold text-[8px] border border-amber-300">
                              All Admin Rights
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 leading-tight">
                          {page.description}
                        </p>
                        <span className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-[9px] font-bold border ${CATEGORY_TONES[page.category]?.badge || "bg-slate-100 text-slate-700"}`}>
                          {page.category}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border transition-all mt-0.5 ${
                        isChecked
                          ? isPortalAssign
                            ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                            : "bg-emerald-600 border-emerald-600 text-white shadow-sm"
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
