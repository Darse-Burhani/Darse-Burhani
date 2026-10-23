"use client";

import { signOut, useSession } from "next-auth/react";
import { usePortalAccess } from "@/context/PortalAccessContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Shield,
  LogOut,
  Lock,
  Unlock,
  ShieldAlert,
  Loader2,
  Save,
  GraduationCap,
  Eye,
  EyeOff,
  Activity,
  BookOpen,
  BookMarked,
  Clock,
  ClipboardList,
  ClipboardCheck,
  CalendarDays,
  FileText,
  Fingerprint,
  BarChart3,
  Layers,
  LayoutGrid,
  KeyRound,
  Search,
  Filter,
  CheckCircle2,
  Sparkles,
  SlidersHorizontal,
  RotateCcw,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";
import Link from "next/link";
import { useState, useEffect, useMemo, useCallback } from "react";

interface RegionPermission {
  id: string;
  label: string;
  description: string;
  isOpen: boolean;
  isVisible?: boolean;
  isVisibleToStudent?: boolean;
}

interface TeacherItemPerm {
  id: string;
  label: string;
  description: string;
  isOpen: boolean;
  isVisible?: boolean;
}

interface PortalModulesConfig {
  talabat: Record<string, boolean>;
  teacher: Record<string, boolean>;
}

interface PermissionsData {
  modules: PortalModulesConfig;
  talabat: {
    masterEnabled: boolean;
    masterVisible?: boolean;
    photo: RegionPermission;
    personal: RegionPermission;
    academic: RegionPermission;
    contact: RegionPermission;
    identifiers: RegionPermission;
    parents: RegionPermission;
    [key: string]: any;
  };
  teacher: {
    masterEnabled: boolean;
    masterVisible?: boolean;
    items: Record<string, TeacherItemPerm>;
  };
}

const DEFAULT_TALABAT_ITEMS: Record<string, { label: string; desc: string }> = {
  photo: { label: "Profile Photo", desc: "Allow students to upload and change portrait photo" },
  personal: { label: "Personal Information", desc: "Age, Blood Group, Gregorian DOB, Hijri DOB, Hafiz status & year" },
  academic: { label: "Academic Information", desc: "Grade, Section, Admission Year, Current Year & External Schooling" },
  contact: { label: "Contact & Location", desc: "Watan, Resident City, Full Address & Student Mobile Number" },
  identifiers: { label: "Student IDs & Biometrics", desc: "ITS Number, TR Number, Student ID & Biometric Hash" },
  parents: { label: "Parents Details & Contact", desc: "Father & Mother names, occupations, emails, and parent phone numbers" },
};

const DEFAULT_TEACHER_ITEMS: Array<{ num: number; key: string; label: string; desc: string }> = [
  { num: 1, key: "photo", label: "Photo", desc: "Profile photo upload & change" },
  { num: 2, key: "its", label: "ITS No.", desc: "ITS 8-digit unique ID" },
  { num: 3, key: "name", label: "Name", desc: "Full legal name (First & Last)" },
  { num: 4, key: "age", label: "Age", desc: "Age in completed years" },
  { num: 5, key: "khidmatMauze", label: "KhidmatMauze", desc: "Mauze / Location of Khidmat" },
  { num: 6, key: "subCategory", label: "Sub-Category", desc: "Khidmat sub-category designation" },
  { num: 7, key: "role", label: "Role", desc: "Teacher institutional role title" },
  { num: 8, key: "farigYear", label: "FarigYear", desc: "Graduation Farig year" },
  { num: 9, key: "farigDarajah", label: "FarigDarajah", desc: "Darajah upon graduation" },
  { num: 10, key: "aljameaDegree", label: "AljameaDegree", desc: "Sanad / Degree awarded" },
  { num: 11, key: "hifzStatus", label: "Hifz Status", desc: "Hafiz / Non-Hafiz / Mutim" },
  { num: 12, key: "hifzYear", label: "Hifz Year", desc: "Year of Hifz completion" },
  { num: 13, key: "batchId", label: "BatchID", desc: "Sanah / Batch ID" },
  { num: 14, key: "mobile", label: "Mobile", desc: "Mobile contact number" },
  { num: 15, key: "tEmail", label: "T_Email", desc: "Official teacher email address" },
  { num: 16, key: "khidmatYear", label: "KhidmatYear", desc: "Years in institutional khidmat" },
  { num: 17, key: "birthDateAd", label: "BIRTHDT_AD", desc: "Gregorian Date of Birth (YYYY-MM-DD)" },
  { num: 18, key: "birthDateH", label: "BIRTHDT_H", desc: "Hijri Date of Birth" },
];

const TEACHER_MODULES_LIST = [
  { key: "dashboard", label: "Dashboard", desc: "Overview, quick metrics & daily schedule", icon: Activity },
  { key: "classes", label: "My Classes", desc: "Classes, student list & grading", icon: BookOpen },
  { key: "timetable", label: "Timetable Matrix", desc: "Master schedule, lesson slots, darajah & badal coverage", icon: CalendarDays },
  { key: "takhteet", label: "Takhteet", desc: "Lesson plans, syllabus tracking & curriculum", icon: ClipboardList },
  { key: "attendance", label: "Attendance", desc: "Session attendance marking & registers", icon: Clock },
  { key: "faculty", label: "Faculty Portal", desc: "Teacher biometric clock-in & faculty attendance", icon: ClipboardCheck },
  { key: "calendar", label: "Calendar", desc: "Darse Burhani Hijri calendar, miqaats & schedules", icon: CalendarDays },
  { key: "profile", label: "My Profile", desc: "Teacher institutional profile and bio", icon: User },
];

const TALABAT_MODULES_LIST = [
  { key: "dashboard", label: "Dashboard", desc: "Student dashboard, stats & daily highlights", icon: Activity },
  { key: "timetable", label: "Class Timetable", desc: "Weekly darajah timetable, daily period slots & teacher allocations", icon: CalendarDays },
  { key: "attendance", label: "Attendance", desc: "Personal attendance record & statistics", icon: Clock },
  { key: "scans", label: "My Scans", desc: "Biometric & RFID punch scan timeline", icon: Fingerprint },
  { key: "calendar", label: "Calendar", desc: "Darse Burhani Hijri calendar, miqaats & schedules", icon: CalendarDays },
  { key: "library", label: "Library", desc: "Book catalog, borrowed books & overdue tracker", icon: BookOpen },
  { key: "skillTree", label: "Skill Tree", desc: "Academics & character skill development", icon: BarChart3 },
  { key: "badges", label: "Badges", desc: "Earned achievements, certificates & points", icon: Shield },
  { key: "profile", label: "My Profile", desc: "Student credentials, contacts & bio", icon: User },
];

const INITIAL_PERMS: PermissionsData = {
  modules: {
    talabat: {
      dashboard: true,
      timetable: true,
      attendance: true,
      scans: true,
      calendar: true,
      hifz: true,
      library: true,
      skillTree: true,
      badges: true,
      profile: true,
    },
    teacher: {
      dashboard: true,
      classes: true,
      timetable: true,
      takhteet: true,
      attendance: true,
      faculty: true,
      calendar: true,
      hifz: true,
      profile: true,
    },
  },
  talabat: {
    masterEnabled: true,
    masterVisible: true,
    photo: { id: "photo", label: "Profile Photo", description: "Allow student to upload and change portrait", isOpen: true, isVisible: true, isVisibleToStudent: true },
    personal: { id: "personal", label: "Personal Information", description: "Age, Blood Group, Dates of Birth, Hafiz status & year", isOpen: true, isVisible: true, isVisibleToStudent: true },
    academic: { id: "academic", label: "Academic Information", description: "Grade, Section, Admission Year, Current Year & Schooling", isOpen: true, isVisible: true, isVisibleToStudent: true },
    contact: { id: "contact", label: "Contact & Location", description: "Watan, Resident City, Full Address & Student Mobile", isOpen: true, isVisible: true, isVisibleToStudent: true },
    identifiers: { id: "identifiers", label: "Student IDs & Biometrics", description: "ITS Number, TR Number, Student ID & Biometric Hash", isOpen: true, isVisible: true, isVisibleToStudent: true },
    parents: { id: "parents", label: "Parents Details & Contact", description: "Father & Mother names, occupations, emails, and parent phone numbers", isOpen: true, isVisible: true, isVisibleToStudent: true },
  },
  teacher: {
    masterEnabled: true,
    masterVisible: true,
    items: DEFAULT_TEACHER_ITEMS.reduce((acc, it) => {
      acc[it.key] = { id: it.key, label: it.label, description: it.desc, isOpen: true, isVisible: true };
      return acc;
    }, {} as Record<string, TeacherItemPerm>),
  },
};

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const { refreshModules } = usePortalAccess();

  const [activeTab, setActiveTab] = useState<"talabat" | "teacher" | "security">("talabat");
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [savingPerms, setSavingPerms] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "visible" | "hidden" | "editable" | "locked">("all");

  const [permissions, setPermissions] = useState<PermissionsData>(INITIAL_PERMS);
  const [savedBaseline, setSavedBaseline] = useState<string>(JSON.stringify(INITIAL_PERMS));

  // Admin Change Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Check if there are unsaved changes
  const hasUnsavedChanges = useMemo(() => {
    return JSON.stringify(permissions) !== savedBaseline;
  }, [permissions, savedBaseline]);

  const fetchPermissions = useCallback(async () => {
    try {
      setLoadingPerms(true);
      const res = await fetch(`/api/admin/profile-permissions?t=${Date.now()}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const d = json.data;
          const merged: PermissionsData = {
            modules: {
              talabat: { ...INITIAL_PERMS.modules.talabat, ...(d.modules?.talabat || {}) },
              teacher: { ...INITIAL_PERMS.modules.teacher, ...(d.modules?.teacher || {}) },
            },
            talabat: {
              ...INITIAL_PERMS.talabat,
              ...(d.talabat || {}),
              masterEnabled: d.talabat?.masterEnabled !== undefined ? d.talabat.masterEnabled : true,
              masterVisible: d.talabat?.masterVisible !== undefined ? d.talabat.masterVisible : true,
            },
            teacher: {
              ...INITIAL_PERMS.teacher,
              masterEnabled: d.teacher?.masterEnabled !== undefined ? d.teacher.masterEnabled : true,
              masterVisible: d.teacher?.masterVisible !== undefined ? d.teacher.masterVisible : true,
              items: { ...INITIAL_PERMS.teacher.items, ...(d.teacher?.items || {}) },
            },
          };
          setPermissions(merged);
          setSavedBaseline(JSON.stringify(merged));
        }
      }
    } catch {
      toast({ title: "Failed to load permissions", variant: "destructive" });
    } finally {
      setLoadingPerms(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // ── Save Permissions ──
  const savePermissions = async () => {
    try {
      setSavingPerms(true);
      const res = await fetch("/api/admin/profile-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modules: permissions.modules,
          talabat: permissions.talabat,
          teacher: permissions.teacher,
        }),
      });
      if (res.ok) {
        await refreshModules();
        setSavedBaseline(JSON.stringify(permissions));
        toast({
          title: "Locking Policies Applied Live",
          description: "All content visibility and edit restrictions are active across student and teacher portals.",
          variant: "success",
        });
      } else {
        toast({ title: "Failed to save permissions", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error", description: "Failed to save permissions", variant: "destructive" });
    } finally {
      setSavingPerms(false);
    }
  };

  const discardChanges = () => {
    try {
      setPermissions(JSON.parse(savedBaseline));
      toast({ title: "Changes Discarded", description: "Reverted to currently active policy." });
    } catch {
      fetchPermissions();
    }
  };

  // ── Module Visibility Toggles ──
  const toggleModule = (role: "teacher" | "talabat", key: string) => {
    setPermissions((prev) => ({
      ...prev,
      modules: {
        ...prev.modules,
        [role]: {
          ...prev.modules[role],
          [key]: !prev.modules[role][key],
        },
      },
    }));
  };

  const setAllModules = (role: "teacher" | "talabat", visible: boolean) => {
    setPermissions((prev) => {
      const nextRoleMods: Record<string, boolean> = {};
      for (const k of Object.keys(prev.modules[role])) {
        nextRoleMods[k] = visible;
      }
      return {
        ...prev,
        modules: {
          ...prev.modules,
          [role]: nextRoleMods,
        },
      };
    });
  };

  // ── Talabat Item Toggles ──
  const toggleTalabatItemVisibility = (key: string) => {
    setPermissions((prev) => {
      const current = prev.talabat[key] || {
        id: key,
        label: DEFAULT_TALABAT_ITEMS[key]?.label || key,
        description: DEFAULT_TALABAT_ITEMS[key]?.desc || "",
        isOpen: true,
        isVisible: true,
        isVisibleToStudent: true,
      };
      const isCurrentlyVisible = current.isVisible !== false && current.isVisibleToStudent !== false;
      const nextVis = !isCurrentlyVisible;
      return {
        ...prev,
        talabat: {
          ...prev.talabat,
          [key]: {
            ...current,
            isVisible: nextVis,
            isVisibleToStudent: nextVis,
          },
        },
      };
    });
  };

  const toggleTalabatItemEdit = (key: string) => {
    setPermissions((prev) => {
      const current = prev.talabat[key] || {
        id: key,
        label: DEFAULT_TALABAT_ITEMS[key]?.label || key,
        description: DEFAULT_TALABAT_ITEMS[key]?.desc || "",
        isOpen: true,
        isVisible: true,
        isVisibleToStudent: true,
      };
      return {
        ...prev,
        talabat: {
          ...prev.talabat,
          [key]: {
            ...current,
            isOpen: !current.isOpen,
          },
        },
      };
    });
  };

  const setAllTalabatItemsVisibility = (visible: boolean) => {
    setPermissions((prev) => {
      const nextTalabat = { ...prev.talabat };
      for (const k of Object.keys(DEFAULT_TALABAT_ITEMS)) {
        const item = nextTalabat[k] || { id: k, label: DEFAULT_TALABAT_ITEMS[k].label, description: DEFAULT_TALABAT_ITEMS[k].desc, isOpen: true };
        nextTalabat[k] = { ...item, isVisible: visible, isVisibleToStudent: visible };
      }
      return { ...prev, talabat: nextTalabat };
    });
  };

  const setAllTalabatItemsEdit = (open: boolean) => {
    setPermissions((prev) => {
      const nextTalabat = { ...prev.talabat };
      for (const k of Object.keys(DEFAULT_TALABAT_ITEMS)) {
        const item = nextTalabat[k] || { id: k, label: DEFAULT_TALABAT_ITEMS[k].label, description: DEFAULT_TALABAT_ITEMS[k].desc, isVisible: true, isVisibleToStudent: true };
        nextTalabat[k] = { ...item, isOpen: open };
      }
      return { ...prev, talabat: nextTalabat };
    });
  };

  // ── Teacher Item Toggles ──
  const toggleTeacherItemVisibility = (key: string) => {
    setPermissions((prev) => {
      const defaultMeta = DEFAULT_TEACHER_ITEMS.find((it) => it.key === key);
      const current = prev.teacher.items[key] || {
        id: key,
        label: defaultMeta?.label || key,
        description: defaultMeta?.desc || "",
        isOpen: true,
        isVisible: true,
      };
      const isVisible = current.isVisible !== false;
      return {
        ...prev,
        teacher: {
          ...prev.teacher,
          items: {
            ...prev.teacher.items,
            [key]: {
              ...current,
              isVisible: !isVisible,
            },
          },
        },
      };
    });
  };

  const toggleTeacherItemEdit = (key: string) => {
    setPermissions((prev) => {
      const defaultMeta = DEFAULT_TEACHER_ITEMS.find((it) => it.key === key);
      const current = prev.teacher.items[key] || {
        id: key,
        label: defaultMeta?.label || key,
        description: defaultMeta?.desc || "",
        isOpen: true,
        isVisible: true,
      };
      return {
        ...prev,
        teacher: {
          ...prev.teacher,
          items: {
            ...prev.teacher.items,
            [key]: {
              ...current,
              isOpen: !current.isOpen,
            },
          },
        },
      };
    });
  };

  const setAllTeacherItemsVisibility = (visible: boolean) => {
    setPermissions((prev) => {
      const nextItems: Record<string, TeacherItemPerm> = {};
      for (const it of DEFAULT_TEACHER_ITEMS) {
        const current = prev.teacher.items[it.key] || { id: it.key, label: it.label, description: it.desc, isOpen: true };
        nextItems[it.key] = { ...current, isVisible: visible };
      }
      return {
        ...prev,
        teacher: { ...prev.teacher, items: nextItems },
      };
    });
  };

  const setAllTeacherItemsEdit = (open: boolean) => {
    setPermissions((prev) => {
      const nextItems: Record<string, TeacherItemPerm> = {};
      for (const it of DEFAULT_TEACHER_ITEMS) {
        const current = prev.teacher.items[it.key] || { id: it.key, label: it.label, description: it.desc, isVisible: true };
        nextItems[it.key] = { ...current, isOpen: open };
      }
      return {
        ...prev,
        teacher: { ...prev.teacher, items: nextItems },
      };
    });
  };

  // ── Password Change Handler ──
  const handleAdminChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ variant: "warning", title: "Incomplete Form", description: "All password fields are required." });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Mismatch", description: "New password and confirmation do not match." });
      return;
    }
    if (newPassword.length < 8) {
      toast({ variant: "destructive", title: "Weak Password", description: "Password must be at least 8 characters long." });
      return;
    }
    if (!/(?=.*[A-Za-z])(?=.*\d)/.test(newPassword)) {
      toast({ variant: "destructive", title: "Invalid Password", description: "Password must contain at least 1 letter and 1 number." });
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ variant: "success", title: "Password Changed", description: "Administrator credentials updated successfully." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: data.error || "Failed to change password." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not connect to authentication server." });
    } finally {
      setChangingPassword(false);
    }
  };

  // Filtered lists
  const filteredTalabatItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return Object.entries(DEFAULT_TALABAT_ITEMS).filter(([key, meta]) => {
      const perm = permissions.talabat[key] || { isOpen: true, isVisible: true, isVisibleToStudent: true };
      const isVisible = perm.isVisible !== false && perm.isVisibleToStudent !== false;
      const isOpen = perm.isOpen !== false;

      const matchesSearch = !q || key.toLowerCase().includes(q) || meta.label.toLowerCase().includes(q) || meta.desc.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (filterMode === "visible") return isVisible;
      if (filterMode === "hidden") return !isVisible;
      if (filterMode === "editable") return isVisible && isOpen;
      if (filterMode === "locked") return !isOpen || !isVisible;
      return true;
    });
  }, [searchQuery, filterMode, permissions.talabat]);

  const filteredTeacherItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return DEFAULT_TEACHER_ITEMS.filter((it) => {
      const perm = permissions.teacher.items[it.key] || { isOpen: true, isVisible: true };
      const isVisible = perm.isVisible !== false;
      const isOpen = perm.isOpen !== false;

      const matchesSearch = !q || it.key.toLowerCase().includes(q) || it.label.toLowerCase().includes(q) || it.desc.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (filterMode === "visible") return isVisible;
      if (filterMode === "hidden") return !isVisible;
      if (filterMode === "editable") return isVisible && isOpen;
      if (filterMode === "locked") return !isOpen || !isVisible;
      return true;
    });
  }, [searchQuery, filterMode, permissions.teacher.items]);

  // Overall statistics
  const stats = useMemo(() => {
    const talabatVisibleMods = Object.values(permissions.modules.talabat).filter(Boolean).length;
    const teacherVisibleMods = Object.values(permissions.modules.teacher).filter(Boolean).length;

    const talabatSectionsTotal = Object.keys(DEFAULT_TALABAT_ITEMS).length;
    const talabatSectionsVisible = Object.keys(DEFAULT_TALABAT_ITEMS).filter((k) => {
      const p = permissions.talabat[k];
      return p?.isVisible !== false && p?.isVisibleToStudent !== false;
    }).length;
    const talabatSectionsEditable = Object.keys(DEFAULT_TALABAT_ITEMS).filter((k) => {
      const p = permissions.talabat[k];
      return p?.isOpen !== false && p?.isVisible !== false && p?.isVisibleToStudent !== false;
    }).length;

    const teacherItemsTotal = DEFAULT_TEACHER_ITEMS.length;
    const teacherItemsVisible = DEFAULT_TEACHER_ITEMS.filter((it) => {
      const p = permissions.teacher.items[it.key];
      return p?.isVisible !== false;
    }).length;
    const teacherItemsEditable = DEFAULT_TEACHER_ITEMS.filter((it) => {
      const p = permissions.teacher.items[it.key];
      return p?.isOpen !== false && p?.isVisible !== false;
    }).length;

    return {
      talabatVisibleMods,
      teacherVisibleMods,
      talabatSectionsTotal,
      talabatSectionsVisible,
      talabatSectionsEditable,
      teacherItemsTotal,
      teacherItemsVisible,
      teacherItemsEditable,
    };
  }, [permissions]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 pb-32">
      {/* ── Breadcrumbs & Quick Jumps ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Link href="/admin" className="hover:text-emerald-700 font-semibold transition-colors">
            Admin Command
          </Link>
          <span>/</span>
          <span className="text-slate-900 font-bold flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
            Portal Locks &amp; Profile Permissions
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/talabat-profiles"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100 transition-colors font-medium text-[11px]"
          >
            <GraduationCap className="w-3 h-3 text-amber-700" />
            Yearly Profiles (1447 H)
            <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
          </Link>
          <Link
            href="/admin/students"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100 transition-colors font-medium text-[11px]"
          >
            <User className="w-3 h-3 text-emerald-700" />
            Students Roster
            <ExternalLink className="w-2.5 h-2.5 opacity-60 ml-0.5" />
          </Link>
        </div>
      </div>

      {/* ── Header Banner ── */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#b8541e] via-[#8a3e14] to-[#b8541e] text-white shadow-xl border border-emerald-500/20"
      >
        <div className="absolute top-0 left-0 w-48 h-48 opacity-10 pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <path d="M50 5L95 50L50 95L5 50Z" fill="none" stroke="#d4af37" strokeWidth="1.5" />
            <circle cx="50" cy="50" r="28" fill="none" stroke="#d4af37" strokeWidth="1" />
          </svg>
        </div>
        <div className="absolute -bottom-8 -right-8 w-48 h-48 opacity-10 rotate-45 pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <path d="M50 5L95 50L50 95L5 50Z" fill="none" stroke="#d4af37" strokeWidth="2" />
          </svg>
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-semibold backdrop-blur-sm">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
              <span>Administrative Policy &amp; Access Governance</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              Portal &amp; Profile Locking Center
            </h1>
            <p className="text-emerald-100/90 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Instantly control what to <strong>Show vs Hide</strong> across Student &amp; Faculty portals, and precisely <strong>Allow or Restrict Edit</strong> access for institutional data, photos, and biometrics.
            </p>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={fetchPermissions}
              disabled={loadingPerms}
              className="border-white/20 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs h-10 px-4 font-semibold shadow-xs"
            >
              <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${loadingPerms ? "animate-spin" : ""}`} />
              Reload DB Policies
            </Button>

            <Button
              type="button"
              onClick={savePermissions}
              disabled={savingPerms || loadingPerms}
              className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-emerald-950 font-bold rounded-xl text-xs h-10 px-5 shadow-lg shadow-amber-500/20 active:scale-98 transition-all"
            >
              {savingPerms ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin text-emerald-950" />
              ) : (
                <Save className="w-4 h-4 mr-2 text-emerald-950" />
              )}
              Apply Live Policies
            </Button>
          </div>
        </div>

        {/* ── Key Metrics Ribbon ── */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/15">
          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10">
            <span className="text-[11px] text-emerald-200 block font-medium">Talabat Sections</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-extrabold text-white">{stats.talabatSectionsVisible}</span>
              <span className="text-xs text-emerald-300">/ {stats.talabatSectionsTotal} visible</span>
            </div>
            <span className="text-[10px] text-amber-300 font-semibold mt-0.5 block">
              {stats.talabatSectionsEditable} editable
            </span>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10">
            <span className="text-[11px] text-emerald-200 block font-medium">Teacher Fields</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-extrabold text-white">{stats.teacherItemsVisible}</span>
              <span className="text-xs text-emerald-300">/ {stats.teacherItemsTotal} visible</span>
            </div>
            <span className="text-[10px] text-amber-300 font-semibold mt-0.5 block">
              {stats.teacherItemsEditable} editable
            </span>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10">
            <span className="text-[11px] text-emerald-200 block font-medium">Student Navigation</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-extrabold text-white">{stats.talabatVisibleMods}</span>
              <span className="text-xs text-emerald-300">/ {TALABAT_MODULES_LIST.length} modules</span>
            </div>
            <span className="text-[10px] text-emerald-200 font-medium mt-0.5 block">Active in sidebar</span>
          </div>

          <div className="bg-white/10 rounded-2xl p-3 backdrop-blur-sm border border-white/10">
            <span className="text-[11px] text-emerald-200 block font-medium">Master Lock Status</span>
            <div className="flex items-center gap-1.5 mt-1">
              {permissions.talabat.masterEnabled && permissions.teacher.masterEnabled ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-400/30">
                  <Unlock className="w-3 h-3 text-emerald-300" /> Operational
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-400/30">
                  <Lock className="w-3 h-3 text-amber-300" /> Restricted
                </span>
              )}
            </div>
            <span className="text-[10px] text-emerald-200/80 font-medium mt-0.5 block">Policies enforced live</span>
          </div>
        </div>
      </motion.div>

      {/* ── Tabs Navigation & Action Toolbar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        {/* Segmented Tab Switcher */}
        <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200/80 self-start">
          <button
            type="button"
            onClick={() => setActiveTab("talabat")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "talabat"
                ? "bg-white text-emerald-900 shadow-sm border border-emerald-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <GraduationCap className="w-4 h-4 text-emerald-700" />
            <span>Talabat (Student) Governance</span>
            <Badge className="bg-emerald-100 text-emerald-800 text-[10px] py-0 px-1.5 border-emerald-200">
              6 Sections
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("teacher")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "teacher"
                ? "bg-white text-emerald-900 shadow-sm border border-emerald-200/60"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <User className="w-4 h-4 text-amber-700" />
            <span>Teacher (Faculty) Governance</span>
            <Badge className="bg-amber-100 text-amber-900 text-[10px] py-0 px-1.5 border-amber-200">
              18 Fields
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "security"
                ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <KeyRound className="w-4 h-4 text-slate-700" />
            <span>Admin Credentials</span>
          </button>
        </div>

        {/* Search & Filter Controls (for Talabat & Teacher tabs) */}
        {activeTab !== "security" && (
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
            <div className="relative min-w-[220px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search field or module..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 shadow-xs"
              />
            </div>

            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
              {(["all", "visible", "hidden", "editable", "locked"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setFilterMode(m)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-all ${
                    filterMode === m
                      ? "bg-emerald-800 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Main Tab Content ── */}
      {loadingPerms ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3 bg-white rounded-3xl border border-slate-200 shadow-xs">
          <Loader2 className="w-9 h-9 animate-spin text-emerald-700" />
          <p className="text-xs font-semibold text-slate-500">Retrieving system locking policies...</p>
        </div>
      ) : activeTab === "talabat" ? (
        /* =================================================================== */
        /* TAB 1: TALABAT (STUDENT) PORTAL & PROFILE LOCKS                     */
        /* =================================================================== */
        <div className="space-y-8">
          {/* Master Lock Switch Banner */}
          <div className="p-5 rounded-3xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${permissions.talabat.masterEnabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                  {permissions.talabat.masterEnabled ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    Talabat Profile Editing Master Switch
                    {permissions.talabat.masterEnabled ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] py-0 px-2">
                        Open for Edits
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] py-0 px-2">
                        Locked Institutional Mode
                      </Badge>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    When locked, all student profile modifications are immediately prohibited, regardless of section-level settings.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={permissions.talabat.masterEnabled ? "outline" : "default"}
                onClick={() =>
                  setPermissions((prev) => ({
                    ...prev,
                    talabat: { ...prev.talabat, masterEnabled: !prev.talabat.masterEnabled },
                  }))
                }
                className={`text-xs h-9 px-4 rounded-xl font-bold shadow-xs ${
                  permissions.talabat.masterEnabled
                    ? "border-amber-300 text-amber-900 hover:bg-amber-50"
                    : "bg-emerald-700 hover:bg-emerald-800 text-white"
                }`}
              >
                {permissions.talabat.masterEnabled ? (
                  <>
                    <Lock className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
                    Lock Master Editing
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 mr-1.5" />
                    Open Master Editing
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* SECTION 1: Talabat Profile Sections (Show/Hide + Allow/Restrict Edit) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-700" />
                  Talabat Profile Sections Governance
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Fine-tune individual profile blocks. Toggle <strong>Visibility (Show/Hide)</strong> and <strong>Edit Rights (Allow/Restrict Edit)</strong>.
                </p>
              </div>

              {/* Batch Presets */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllTalabatItemsVisibility(true)}
                  className="text-[11px] h-7 px-2 text-emerald-800 hover:bg-emerald-100/60 font-semibold"
                >
                  <Eye className="w-3 h-3 mr-1" /> Show All
                </Button>
                <span className="text-slate-300">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllTalabatItemsVisibility(false)}
                  className="text-[11px] h-7 px-2 text-rose-800 hover:bg-rose-100/60 font-semibold"
                >
                  <EyeOff className="w-3 h-3 mr-1" /> Hide All
                </Button>
                <span className="text-slate-300">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllTalabatItemsEdit(true)}
                  className="text-[11px] h-7 px-2 text-amber-800 hover:bg-amber-100/60 font-semibold"
                >
                  <Unlock className="w-3 h-3 mr-1" /> Allow All Edit
                </Button>
                <span className="text-slate-300">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllTalabatItemsEdit(false)}
                  className="text-[11px] h-7 px-2 text-slate-700 hover:bg-slate-200/60 font-semibold"
                >
                  <Lock className="w-3 h-3 mr-1" /> Restrict All Edit
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTalabatItems.map(([key, meta]) => {
                const perm = permissions.talabat[key] || {
                  id: key,
                  label: meta.label,
                  description: meta.desc,
                  isOpen: true,
                  isVisible: true,
                  isVisibleToStudent: true,
                };
                const isVisible = perm.isVisible !== false && perm.isVisibleToStudent !== false;
                const isEditable = perm.isOpen !== false;

                return (
                  <div
                    key={key}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                      !isVisible
                        ? "bg-slate-50/80 border-slate-200 opacity-80"
                        : "bg-white border-slate-200/90 shadow-xs hover:border-emerald-300 hover:shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-900">{meta.label}</h4>
                          {isVisible ? (
                            <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] py-0 px-2 font-semibold">
                              <Eye className="w-3 h-3 mr-1 inline" /> Visible
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-[10px] py-0 px-2 font-semibold">
                              <EyeOff className="w-3 h-3 mr-1 inline" /> Hidden
                            </Badge>
                          )}
                          {isVisible && (
                            isEditable ? (
                              <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] py-0 px-2 font-semibold">
                                <Unlock className="w-3 h-3 mr-1 inline" /> Allow Edit
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] py-0 px-2 font-semibold">
                                <Lock className="w-3 h-3 mr-1 inline" /> Read Only
                              </Badge>
                            )
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{meta.desc}</p>
                      </div>
                    </div>

                    {/* Dual Action Controls */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {/* Show / Hide Button */}
                      <button
                        type="button"
                        onClick={() => toggleTalabatItemVisibility(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          isVisible
                            ? "bg-emerald-100 text-emerald-900 hover:bg-emerald-200/80 border border-emerald-300/80"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300 border border-slate-300"
                        }`}
                      >
                        {isVisible ? <Eye className="w-3.5 h-3.5 text-emerald-700" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                        <span>{isVisible ? "Showing Content" : "Hidden Content"}</span>
                      </button>

                      {/* Allow / Restrict Edit Button */}
                      <button
                        type="button"
                        onClick={() => toggleTalabatItemEdit(key)}
                        disabled={!isVisible}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          !isVisible
                            ? "opacity-50 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200"
                            : isEditable
                            ? "bg-amber-100 text-amber-900 hover:bg-amber-200/80 border border-amber-300/80"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300"
                        }`}
                      >
                        {isEditable ? <Unlock className="w-3.5 h-3.5 text-amber-700" /> : <Lock className="w-3.5 h-3.5 text-slate-600" />}
                        <span>{isEditable ? "Allow Edit" : "Restrict Edit"}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Talabat Navigation Modules (Show/Hide Pages) */}
          <div className="space-y-4 pt-6 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-emerald-700" />
                  Talabat Portal Navigation Modules (Show / Hide Pages)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toggle sidebar page availability in the student portal. Modules marked &ldquo;Hidden&rdquo; will be inaccessible to talabat.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllModules("talabat", true)}
                  className="text-[11px] h-7 px-2.5 text-emerald-800 hover:bg-emerald-100/60 font-semibold"
                >
                  <Eye className="w-3 h-3 mr-1" /> Show All
                </Button>
                <span className="text-slate-300">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllModules("talabat", false)}
                  className="text-[11px] h-7 px-2.5 text-rose-800 hover:bg-rose-100/60 font-semibold"
                >
                  <EyeOff className="w-3 h-3 mr-1" /> Hide All
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {TALABAT_MODULES_LIST.map((m) => {
                const IconComp = m.icon;
                const isShown = permissions.modules.talabat[m.key] !== false;

                return (
                  <div
                    key={m.key}
                    onClick={() => toggleModule("talabat", m.key)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-3 ${
                      isShown
                        ? "bg-white border-emerald-200/80 shadow-xs hover:border-emerald-400 hover:shadow-sm"
                        : "bg-slate-50/80 border-slate-200 opacity-75 hover:opacity-95"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`p-2.5 rounded-xl ${isShown ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      {isShown ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] py-0 px-2 font-semibold">
                          <Eye className="w-3 h-3 mr-1 inline" /> Visible in Menu
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] py-0 px-2 font-semibold">
                          <EyeOff className="w-3 h-3 mr-1 inline" /> Hidden from Menu
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{m.label}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{m.desc}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono text-[10px]">/talabat/{m.key}</span>
                      <span className={`font-bold ${isShown ? "text-emerald-700" : "text-amber-800"}`}>
                        {isShown ? "Click to Hide" : "Click to Show"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : activeTab === "teacher" ? (
        /* =================================================================== */
        /* TAB 2: TEACHER (FACULTY) PORTAL & PROFILE LOCKS                     */
        /* =================================================================== */
        <div className="space-y-8">
          {/* Master Lock Switch Banner */}
          <div className="p-5 rounded-3xl border border-amber-200/80 bg-gradient-to-r from-amber-50/80 via-yellow-50/50 to-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${permissions.teacher.masterEnabled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
                  {permissions.teacher.masterEnabled ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    Teacher Profile Editing Master Switch
                    {permissions.teacher.masterEnabled ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] py-0 px-2">
                        Open for Edits
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] py-0 px-2">
                        Locked Institutional Mode
                      </Badge>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500">
                    When locked, teachers cannot modify any of their 18 institutional profile attributes.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={permissions.teacher.masterEnabled ? "outline" : "default"}
                onClick={() =>
                  setPermissions((prev) => ({
                    ...prev,
                    teacher: { ...prev.teacher, masterEnabled: !prev.teacher.masterEnabled },
                  }))
                }
                className={`text-xs h-9 px-4 rounded-xl font-bold shadow-xs ${
                  permissions.teacher.masterEnabled
                    ? "border-amber-400 text-amber-900 hover:bg-amber-50"
                    : "bg-emerald-700 hover:bg-emerald-800 text-white"
                }`}
              >
                {permissions.teacher.masterEnabled ? (
                  <>
                    <Lock className="w-3.5 h-3.5 mr-1.5 text-amber-700" />
                    Lock Master Editing
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 mr-1.5" />
                    Open Master Editing
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* SECTION 1: 18 Teacher Profile Items (Show/Hide + Allow/Restrict Edit) */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-700" />
                  Teacher Profile Fields Governance (18 Institutional Attributes)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Set <strong>Visibility (Show/Hide)</strong> and <strong>Edit Rights (Allow/Restrict Edit)</strong> for each faculty field.
                </p>
              </div>

              {/* Batch Presets */}
              <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllTeacherItemsVisibility(true)}
                  className="text-[11px] h-7 px-2 text-emerald-800 hover:bg-emerald-100/60 font-semibold"
                >
                  <Eye className="w-3 h-3 mr-1" /> Show All
                </Button>
                <span className="text-slate-300">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllTeacherItemsVisibility(false)}
                  className="text-[11px] h-7 px-2 text-rose-800 hover:bg-rose-100/60 font-semibold"
                >
                  <EyeOff className="w-3 h-3 mr-1" /> Hide All
                </Button>
                <span className="text-slate-300">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllTeacherItemsEdit(true)}
                  className="text-[11px] h-7 px-2 text-amber-800 hover:bg-amber-100/60 font-semibold"
                >
                  <Unlock className="w-3 h-3 mr-1" /> Allow All Edit
                </Button>
                <span className="text-slate-300">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllTeacherItemsEdit(false)}
                  className="text-[11px] h-7 px-2 text-slate-700 hover:bg-slate-200/60 font-semibold"
                >
                  <Lock className="w-3 h-3 mr-1" /> Restrict All Edit
                </Button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
              {filteredTeacherItems.map((item) => {
                const perm = permissions.teacher.items[item.key] || {
                  id: item.key,
                  label: item.label,
                  description: item.desc,
                  isOpen: true,
                  isVisible: true,
                };
                const isVisible = perm.isVisible !== false;
                const isEditable = perm.isOpen !== false;

                return (
                  <div
                    key={item.key}
                    className={`p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                      !isVisible ? "bg-slate-50/70 opacity-75" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-xl font-bold text-xs flex items-center justify-center flex-shrink-0 shadow-xs ${
                          isVisible ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {item.num}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900">{item.label}</span>
                          {isVisible ? (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5">
                              Visible
                            </Badge>
                          ) : (
                            <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-[10px] py-0 px-1.5">
                              Hidden
                            </Badge>
                          )}
                          {isVisible && (
                            isEditable ? (
                              <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] py-0 px-1.5">
                                Allow Edit
                              </Badge>
                            ) : (
                              <Badge className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] py-0 px-1.5">
                                Locked
                              </Badge>
                            )
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{item.desc}</p>
                      </div>
                    </div>

                    {/* Dual Action Controls */}
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      {/* Show / Hide Button */}
                      <Button
                        type="button"
                        variant={isVisible ? "outline" : "secondary"}
                        size="sm"
                        onClick={() => toggleTeacherItemVisibility(item.key)}
                        className={`h-7 text-xs font-bold px-2.5 rounded-lg ${
                          isVisible
                            ? "border-slate-300 text-slate-700 hover:bg-slate-100"
                            : "bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border border-emerald-300"
                        }`}
                      >
                        {isVisible ? (
                          <>
                            <EyeOff className="w-3 h-3 mr-1 text-slate-500" /> Hide
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3 mr-1 text-emerald-700" /> Show
                          </>
                        )}
                      </Button>

                      {/* Allow / Restrict Edit Button */}
                      <Button
                        type="button"
                        variant={isEditable ? "outline" : "secondary"}
                        size="sm"
                        onClick={() => toggleTeacherItemEdit(item.key)}
                        disabled={!isVisible}
                        className={`h-7 text-xs font-bold px-2.5 rounded-lg ${
                          !isVisible
                            ? "opacity-40 cursor-not-allowed"
                            : isEditable
                            ? "border-amber-300 text-amber-900 hover:bg-amber-50"
                            : "bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300"
                        }`}
                      >
                        {isEditable ? (
                          <>
                            <Lock className="w-3 h-3 mr-1 text-amber-700" /> Restrict Edit
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3 h-3 mr-1 text-amber-700" /> Allow Edit
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: Teacher Navigation Modules */}
          <div className="space-y-4 pt-6 border-t border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-emerald-700" />
                  Teacher Portal Navigation Modules (Show / Hide Pages)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Manage visibility of faculty sidebar links.
                </p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllModules("teacher", true)}
                  className="text-[11px] h-7 px-2.5 text-emerald-800 hover:bg-emerald-100/60 font-semibold"
                >
                  <Eye className="w-3 h-3 mr-1" /> Show All
                </Button>
                <span className="text-slate-300">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAllModules("teacher", false)}
                  className="text-[11px] h-7 px-2.5 text-rose-800 hover:bg-rose-100/60 font-semibold"
                >
                  <EyeOff className="w-3 h-3 mr-1" /> Hide All
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {TEACHER_MODULES_LIST.map((m) => {
                const IconComp = m.icon;
                const isShown = permissions.modules.teacher[m.key] !== false;

                return (
                  <div
                    key={m.key}
                    onClick={() => toggleModule("teacher", m.key)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-3 ${
                      isShown
                        ? "bg-white border-emerald-200/80 shadow-xs hover:border-emerald-400 hover:shadow-sm"
                        : "bg-slate-50/80 border-slate-200 opacity-75 hover:opacity-95"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className={`p-2.5 rounded-xl ${isShown ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                        <IconComp className="w-4 h-4" />
                      </div>
                      {isShown ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] py-0 px-2 font-semibold">
                          <Eye className="w-3 h-3 mr-1 inline" /> Visible in Menu
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-800 border-rose-300 text-[10px] py-0 px-2 font-semibold">
                          <EyeOff className="w-3 h-3 mr-1 inline" /> Hidden from Menu
                        </Badge>
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{m.label}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{m.desc}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-mono text-[10px]">/teacher/{m.key}</span>
                      <span className={`font-bold ${isShown ? "text-emerald-700" : "text-amber-800"}`}>
                        {isShown ? "Click to Hide" : "Click to Show"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* =================================================================== */
        /* TAB 3: ADMIN CREDENTIALS & SECURITY VAULT                           */
        /* =================================================================== */
        <div className="space-y-6">
          <Card className="rounded-3xl border border-slate-200 shadow-sm overflow-hidden bg-white">
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div className="flex items-center gap-4">
                  <Avatar className="w-14 h-14 ring-2 ring-amber-300 shadow-md">
                    <AvatarFallback className="bg-gradient-to-br from-[#8a3e14] to-[#1c1c1c] text-base font-bold text-amber-200">
                      {user ? getInitials(user.firstName || "A", user.lastName || "D") : "AD"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-slate-900">{user?.firstName} {user?.lastName}</span>
                      <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-xs py-0.5 px-2.5 font-bold">
                        {user?.role || "ADMIN"}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{user?.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <span className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200 font-semibold inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Full Institutional Authority
                  </span>
                </div>
              </div>

              {/* Password Change Form */}
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-700" />
                    <h3 className="font-bold text-slate-900 text-sm">Update Administrator Password</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="text-xs text-amber-900 hover:text-amber-800 font-semibold flex items-center gap-1"
                  >
                    {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    {showPasswords ? "Hide text" : "Reveal text"}
                  </button>
                </div>

                <form onSubmit={handleAdminChangePassword} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="curPass" className="text-xs font-semibold text-slate-700 block mb-1">
                        Current Password *
                      </label>
                      <input
                        id="curPass"
                        type={showPasswords ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Current password"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="newPass" className="text-xs font-semibold text-slate-700 block mb-1">
                        New Password *
                      </label>
                      <input
                        id="newPass"
                        type={showPasswords ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono"
                        required
                        minLength={8}
                      />
                    </div>

                    <div>
                      <label htmlFor="confPass" className="text-xs font-semibold text-slate-700 block mb-1">
                        Confirm Password *
                      </label>
                      <input
                        id="confPass"
                        type={showPasswords ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      type="submit"
                      disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                      className="bg-emerald-800 hover:bg-emerald-900 text-white font-bold px-5 h-9 rounded-xl text-xs shadow-md gap-1.5"
                    >
                      {changingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                      Update Admin Password
                    </Button>
                  </div>
                </form>
              </div>

              {/* Sign Out Card */}
              <div className="pt-6 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-sm">Terminate Administrator Session</p>
                  <p className="text-xs text-slate-500">Log out of the command console across this device</p>
                </div>
                <Button variant="destructive" size="sm" onClick={() => signOut({ callbackUrl: "/login" })} className="rounded-xl text-xs font-semibold">
                  <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign Out
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Floating Unsaved Changes Notification Bar ── */}
      <AnimatePresence>
        {hasUnsavedChanges && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-xl"
          >
            <div className="bg-slate-900/95 backdrop-blur-md text-white p-4 rounded-2xl shadow-2xl border border-amber-400/30 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-xs sm:text-sm text-white">Unsaved Policy Changes</h4>
                  <p className="text-[11px] text-slate-300">You have unsaved changes that are not yet applied live.</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={discardChanges}
                  disabled={savingPerms}
                  className="text-xs text-slate-300 hover:text-white hover:bg-white/10 h-8 rounded-xl"
                >
                  Discard
                </Button>

                <Button
                  type="button"
                  size="sm"
                  onClick={savePermissions}
                  disabled={savingPerms}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs h-8 px-4 rounded-xl shadow-md transition-all active:scale-95"
                >
                  {savingPerms ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Save &amp; Apply
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
