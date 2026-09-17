"use client";

import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import {
  User,
  Shield,
  LogOut,
  Lock,
  Unlock,
  CheckCircle2,
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";
import { useState, useEffect } from "react";
import { usePortalAccess } from "@/context/PortalAccessContext";

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
    items: Record<string, TeacherItemPerm>;
  };
}

export default function AdminSettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const { refreshModules } = usePortalAccess();

  const [activeTab, setActiveTab] = useState<"teacher" | "talabat">("teacher");
  const [loadingPerms, setLoadingPerms] = useState(true);
  const [savingPerms, setSavingPerms] = useState(false);

  // Admin Change Password State
  const [showPasswordCard, setShowPasswordCard] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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
        toast({ variant: "success", title: "Password Changed", description: "Administrator password updated successfully." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordCard(false);
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: data.error || "Failed to change password." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not connect to authentication server." });
    } finally {
      setChangingPassword(false);
    }
  };

  const [permissions, setPermissions] = useState<PermissionsData>({
    modules: {
      talabat: {
        dashboard: true,
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
      photo: { id: "photo", label: "Profile Photo", description: "Allow student to upload and change portrait", isOpen: true, isVisible: true, isVisibleToStudent: true },
      personal: { id: "personal", label: "Personal Information", description: "Age, Blood Group, Dates of Birth, Hafiz status & year", isOpen: true, isVisible: true, isVisibleToStudent: true },
      academic: { id: "academic", label: "Academic Information", description: "Grade, Section, Admission Year, Current Year & Schooling", isOpen: true, isVisible: true, isVisibleToStudent: true },
      contact: { id: "contact", label: "Contact & Location", description: "Watan, Resident City, Full Address & Student Mobile", isOpen: true, isVisible: true, isVisibleToStudent: true },
      identifiers: { id: "identifiers", label: "Student IDs & Biometrics", description: "ITS Number, TR Number, Student ID & Biometric Hash", isOpen: false, isVisible: true, isVisibleToStudent: true },
      parents: { id: "parents", label: "Parents Details & Contact", description: "Father & Mother names, occupations, emails, and parent phone numbers", isOpen: false, isVisible: false, isVisibleToStudent: false },
    },
    teacher: {
      masterEnabled: true,
      items: {
        photo: { id: "photo", label: "Photo", description: "Profile portrait upload & change", isOpen: true, isVisible: true },
        its: { id: "its", label: "ITS No.", description: "ITS 8-digit unique ID", isOpen: false, isVisible: true },
        name: { id: "name", label: "Name", description: "Full Legal Name (First and Last Name)", isOpen: false, isVisible: true },
        age: { id: "age", label: "Age", description: "Age in completed years", isOpen: true, isVisible: true },
        khidmatMauze: { id: "khidmatMauze", label: "KhidmatMauze", description: "Mauze / Location of Khidmat (Surat, etc.)", isOpen: true, isVisible: true },
        subCategory: { id: "subCategory", label: "Sub-Category", description: "Khidmat sub-category designation", isOpen: true, isVisible: true },
        role: { id: "role", label: "Role", description: "Teacher role / designation in Darse Burhani", isOpen: true, isVisible: true },
        farigYear: { id: "farigYear", label: "FarigYear", description: "Year of Farigh from Al-Jamea-tus-Saifiyah", isOpen: true, isVisible: true },
        farigDarajah: { id: "farigDarajah", label: "FarigDarajah", description: "Darajah upon graduation", isOpen: true, isVisible: true },
        aljameaDegree: { id: "aljameaDegree", label: "AljameaDegree", description: "Sanad / Degree title awarded", isOpen: true, isVisible: true },
        hifzStatus: { id: "hifzStatus", label: "Hifz Status", description: "Hafiz / Non-Hafiz / Mutim status", isOpen: true, isVisible: true },
        hifzYear: { id: "hifzYear", label: "Hifz Year", description: "Year of Hifz completion", isOpen: true, isVisible: true },
        batchId: { id: "batchId", label: "BatchID", description: "Sanah / Batch ID", isOpen: true, isVisible: true },
        mobile: { id: "mobile", label: "Mobile", description: "Faculty mobile contact number", isOpen: true, isVisible: true },
        tEmail: { id: "tEmail", label: "T_Email", description: "Official teacher email address", isOpen: true, isVisible: true },
        khidmatYear: { id: "khidmatYear", label: "KhidmatYear", description: "Years of khidmat rendered", isOpen: true, isVisible: true },
        birthDateAd: { id: "birthDateAd", label: "BIRTHDT_AD", description: "Gregorian Date of Birth (YYYY-MM-DD)", isOpen: true, isVisible: true },
        birthDateH: { id: "birthDateH", label: "BIRTHDT_H", description: "Hijri Date of Birth (e.g. 15 Rajab 1412)", isOpen: true, isVisible: true },
      },
    },
  });

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      setLoadingPerms(true);
      const res = await fetch("/api/admin/profile-permissions");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const d = json.data;
          setPermissions((prev) => ({
            modules: d.modules
              ? {
                  talabat: { ...prev.modules.talabat, ...(d.modules.talabat || {}) },
                  teacher: { ...prev.modules.teacher, ...(d.modules.teacher || {}) },
                }
              : prev.modules,
            talabat: d.talabat
              ? {
                  ...prev.talabat,
                  ...d.talabat,
                  masterEnabled: d.talabat.masterEnabled !== undefined ? d.talabat.masterEnabled : prev.talabat.masterEnabled,
                }
              : prev.talabat,
            teacher: d.teacher
              ? {
                  masterEnabled: d.teacher.masterEnabled !== undefined ? d.teacher.masterEnabled : prev.teacher.masterEnabled,
                  items: { ...prev.teacher.items, ...(d.teacher.items || {}) },
                }
              : prev.teacher,
          }));
        }
      }
    } catch {
      toast({ title: "Failed to load permissions", variant: "destructive" });
    } finally {
      setLoadingPerms(false);
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

  // ── Teacher Profile Item Toggles ──
  const toggleTeacherMaster = () => {
    setPermissions((prev) => ({
      ...prev,
      teacher: {
        ...prev.teacher,
        masterEnabled: !prev.teacher.masterEnabled,
      },
    }));
  };

  const toggleTeacherItemEdit = (key: string) => {
    setPermissions((prev) => ({
      ...prev,
      teacher: {
        ...prev.teacher,
        items: {
          ...prev.teacher.items,
          [key]: {
            ...prev.teacher.items[key],
            isOpen: !prev.teacher.items[key]?.isOpen,
          },
        },
      },
    }));
  };

  const toggleTeacherItemVisibility = (key: string) => {
    setPermissions((prev) => ({
      ...prev,
      teacher: {
        ...prev.teacher,
        items: {
          ...prev.teacher.items,
          [key]: {
            ...prev.teacher.items[key],
            isVisible: prev.teacher.items[key]?.isVisible !== false ? false : true,
          },
        },
      },
    }));
  };

  const setAllTeacherItemsEdit = (open: boolean) => {
    setPermissions((prev) => {
      const nextItems: Record<string, TeacherItemPerm> = {};
      for (const [k, v] of Object.entries(prev.teacher.items)) {
        nextItems[k] = { ...v, isOpen: open };
      }
      return {
        ...prev,
        teacher: { ...prev.teacher, items: nextItems },
      };
    });
  };

  const setAllTeacherItemsVisibility = (visible: boolean) => {
    setPermissions((prev) => {
      const nextItems: Record<string, TeacherItemPerm> = {};
      for (const [k, v] of Object.entries(prev.teacher.items)) {
        nextItems[k] = { ...v, isVisible: visible };
      }
      return {
        ...prev,
        teacher: { ...prev.teacher, items: nextItems },
      };
    });
  };

  // ── Talabat Profile Section Toggles ──
  const toggleTalabatMaster = () => {
    setPermissions((prev) => ({
      ...prev,
      talabat: {
        ...prev.talabat,
        masterEnabled: !prev.talabat.masterEnabled,
      },
    }));
  };

  const toggleTalabatItemEdit = (key: string) => {
    setPermissions((prev) => ({
      ...prev,
      talabat: {
        ...prev.talabat,
        [key]: {
          ...prev.talabat[key],
          isOpen: !prev.talabat[key]?.isOpen,
        },
      },
    }));
  };

  const toggleTalabatItemVisibility = (key: string) => {
    setPermissions((prev) => {
      const current = prev.talabat[key];
      const isCurrentlyVisible = current?.isVisible !== false && current?.isVisibleToStudent !== false;
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

  const setAllTalabatItemsEdit = (open: boolean) => {
    setPermissions((prev) => {
      const nextTalabat = { ...prev.talabat };
      const keys = ["photo", "personal", "academic", "contact", "identifiers", "parents"];
      for (const k of keys) {
        if (nextTalabat[k]) {
          nextTalabat[k] = { ...nextTalabat[k], isOpen: open };
        }
      }
      return { ...prev, talabat: nextTalabat };
    });
  };

  const setAllTalabatItemsVisibility = (visible: boolean) => {
    setPermissions((prev) => {
      const nextTalabat = { ...prev.talabat };
      const keys = ["photo", "personal", "academic", "contact", "identifiers", "parents"];
      for (const k of keys) {
        if (nextTalabat[k]) {
          nextTalabat[k] = { ...nextTalabat[k], isVisible: visible, isVisibleToStudent: visible };
        }
      }
      return { ...prev, talabat: nextTalabat };
    });
  };

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
        toast({
          title: "Locking Policies Saved",
          description: "Portal module visibility and profile permissions successfully updated.",
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

  // Modules metadata
  const teacherModulesList = [
    { key: "dashboard", label: "Dashboard", desc: "Overview, quick metrics & daily schedule", icon: Activity },
    { key: "classes", label: "My Classes", desc: "Classes, student list & grading", icon: BookOpen },
    { key: "takhteet", label: "Takhteet", desc: "Lesson plans, syllabus tracking & curriculum", icon: ClipboardList },
    { key: "attendance", label: "Attendance", desc: "Session attendance marking & registers", icon: Clock },
    { key: "faculty", label: "Faculty Portal", desc: "Teacher biometric clock-in & faculty attendance", icon: ClipboardCheck },
    { key: "calendar", label: "Calendar", desc: "Darse Burhani Hijri calendar, miqaats & schedules", icon: CalendarDays },
    { key: "hifz", label: "Hifz Reports", desc: "Student Quran memorization daily tracking", icon: FileText },
    { key: "profile", label: "My Profile", desc: "Teacher institutional profile and bio", icon: User },
  ];

  const talabatModulesList = [
    { key: "dashboard", label: "Dashboard", desc: "Student dashboard, stats & daily highlights", icon: Activity },
    { key: "attendance", label: "Attendance", desc: "Personal attendance record & statistics", icon: Clock },
    { key: "scans", label: "My Scans", desc: "Biometric & RFID punch scan timeline", icon: Fingerprint },
    { key: "calendar", label: "Calendar", desc: "Darse Burhani Hijri calendar, miqaats & schedules", icon: CalendarDays },
    { key: "hifz", label: "Hifz Journey", desc: "Quran memorization milestones & progress", icon: BookMarked },
    { key: "library", label: "Library", desc: "Book catalog, borrowed books & overdue tracker", icon: BookOpen },
    { key: "skillTree", label: "Skill Tree", desc: "Academics & character skill development", icon: BarChart3 },
    { key: "badges", label: "Badges", desc: "Earned achievements, certificates & points", icon: Shield },
    { key: "profile", label: "My Profile", desc: "Student credentials, contacts & bio", icon: User },
  ];

  const teacherItemsList = [
    { num: 1, key: "photo", label: "Photo", desc: "Profile photo upload & change" },
    { num: 2, key: "its", label: "ITS No.", desc: "ITS 8-digit unique ID" },
    { num: 3, key: "name", label: "Name", desc: "Full legal name (First & Last)" },
    { num: 4, key: "age", label: "Age", desc: "Age in completed years" },
    { num: 5, key: "khidmatMauze", label: "KhidmatMauze", desc: "Mauze / Location of Khidmat" },
    { num: 6, key: "subCategory", label: "Sub-Category", desc: "Khidmat sub-category designation" },
    { num: 7, key: "role", label: "Role", desc: "Teacher institutional role title" },
    { num: 8, key: "farigYear", label: "FarigYear", desc: "Al-Jamea Farig year" },
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

  const talabatItemsList = [
    { key: "photo", label: "Profile Photo", desc: "Allow students to upload and change portrait photo" },
    { key: "personal", label: "Personal Information", desc: "Age, Blood Group, Gregorian DOB, Hijri DOB, Hafiz status & year" },
    { key: "academic", label: "Academic Information", desc: "Grade, Section, Admission Year, Current Year & External Schooling" },
    { key: "contact", label: "Contact & Location", desc: "Watan, Resident City, Full Address & Student Mobile Number" },
    { key: "identifiers", label: "Student IDs & Biometrics", desc: "ITS Number, TR Number, Student ID & Biometric Hash" },
    { key: "parents", label: "Parents Details & Contact", desc: "Father & Mother names, occupations, emails, and parent phone numbers" },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100/80 text-[#8c6508] shadow-sm">
              <ShieldAlert className="w-6 h-6" />
            </div>
            Portal &amp; Profile Locking System
          </h1>
          <p className="text-gray-500 mt-1 text-xs sm:text-sm">
            Control what to <strong>show vs hide</strong> in Talabat (Student) and Teacher portals, and manage granular profile editing permissions.
          </p>
        </div>

        <Button
          onClick={savePermissions}
          disabled={savingPerms || loadingPerms}
          className="fatimi-emerald-gradient text-white shadow-md h-10 text-xs px-5 rounded-xl self-start sm:self-auto font-bold"
        >
          {savingPerms ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Save All Locking Policies
        </Button>
      </motion.div>

      {/* Administrator Account Badge Card */}
      <Card className="fatimi-card">
        <div className="fatimi-card-header" />
        <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Avatar className="w-12 h-12 ring-2 ring-amber-300 shadow-sm">
              <AvatarFallback className="bg-gradient-to-br from-[#064e3b] to-[#022c22] text-sm font-bold text-amber-200">
                {user ? getInitials(user.firstName || "A", user.lastName || "D") : "AD"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-gray-900">{user?.firstName} {user?.lastName}</span>
                <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] py-0 px-2 font-bold">
                  {user?.role || "ADMIN"}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPasswordCard(!showPasswordCard)}
              className="text-xs border-amber-300 text-amber-900 hover:bg-amber-50 h-8 gap-1.5 rounded-xl font-semibold"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-600" />
              {showPasswordCard ? "Close Password Form" : "Change Admin Password"}
            </Button>
            <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 font-medium hidden sm:inline">
              Governance Active
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Admin Change Password Card (Collapsible) */}
      {showPasswordCard && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
          <Card className="rounded-3xl border border-amber-300 bg-amber-50/40 shadow-sm overflow-hidden mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-amber-200/60">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-amber-700" />
                  <h3 className="font-display font-bold text-gray-900 text-sm">Change Administrator Password</h3>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="text-xs text-amber-800 hover:bg-amber-100/50 gap-1 h-7"
                >
                  {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showPasswords ? "Hide" : "Reveal"}
                </Button>
              </div>

              <form onSubmit={handleAdminChangePassword} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label htmlFor="admCurPass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                      Current Password *
                    </label>
                    <input
                      id="admCurPass"
                      type={showPasswords ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none font-mono"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="admNewPass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                      New Password *
                    </label>
                    <input
                      id="admNewPass"
                      type={showPasswords ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min. 8)"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none font-mono"
                      required
                      minLength={8}
                    />
                  </div>

                  <div>
                    <label htmlFor="admConfPass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                      Confirm New Password *
                    </label>
                    <input
                      id="admConfPass"
                      type={showPasswords ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPasswordCard(false)}
                    className="h-8 text-xs border-gray-200"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 h-8 rounded-xl text-xs shadow-md gap-1.5"
                  >
                    {changingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    Save New Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main Governance Hub */}
      <Card className="fatimi-card border-amber-300/60 shadow-lg">
        <div className="fatimi-card-header" />

        {/* Tab Selection */}
        <div className="px-6 pt-4 border-b border-gray-100 flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("teacher")}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "teacher"
                ? "border-[#047857] text-[#047857]"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Teacher Portal &amp; Profile Locking
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("talabat")}
            className={`pb-3 text-xs sm:text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === "talabat"
                ? "border-[#047857] text-[#047857]"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <User className="w-4 h-4" />
            Talabat (Student) Portal &amp; Profile Locking
          </button>
        </div>

        <CardContent className="p-6 space-y-8">
          {loadingPerms ? (
            <div className="py-16 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#d4af37] mb-2" />
              <p className="text-xs text-gray-500">Loading locking policies…</p>
            </div>
          ) : activeTab === "teacher" ? (
            /* ========================================================== */
            /* TAB 1: TEACHER PORTAL & PROFILE LOCKING                    */
            /* ========================================================== */
            <div className="space-y-8">
              {/* SECTION A: Teacher Portal Navigation Modules */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-emerald-600" />
                      Teacher Portal Navigation Modules (Show / Hide Pages)
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Choose which pages show in the Teacher sidebar. Hidden modules will not appear to teachers.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllModules("teacher", true)}
                      className="text-xs text-emerald-700 hover:bg-emerald-50 h-7"
                    >
                      <Eye className="w-3 h-3 mr-1" /> Show All
                    </Button>
                    <span className="text-gray-400">|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllModules("teacher", false)}
                      className="text-xs text-amber-800 hover:bg-amber-50 h-7"
                    >
                      <EyeOff className="w-3 h-3 mr-1" /> Hide All
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {teacherModulesList.map((m) => {
                    const IconComp = m.icon;
                    const isShown = permissions.modules.teacher[m.key] !== false;

                    return (
                      <div
                        key={m.key}
                        onClick={() => toggleModule("teacher", m.key)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-3 ${
                          isShown
                            ? "bg-white border-emerald-200/80 shadow-xs hover:border-emerald-300 hover:shadow-sm"
                            : "bg-gray-50/80 border-gray-200/80 opacity-70 hover:opacity-90"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className={`p-2 rounded-xl ${isShown ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-500"}`}>
                            <IconComp className="w-4 h-4" />
                          </div>
                          {isShown ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] py-0 px-2 font-semibold">
                              <Eye className="w-3 h-3 mr-1 inline" /> Shown
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] py-0 px-2 font-semibold">
                              <EyeOff className="w-3 h-3 mr-1 inline" /> Hidden
                            </Badge>
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-gray-900">{m.label}</h4>
                          <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{m.desc}</p>
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                          <span className="text-gray-400 font-mono text-[10px]">/{m.key}</span>
                          <span className={`font-semibold ${isShown ? "text-emerald-700" : "text-amber-800"}`}>
                            {isShown ? "Click to Hide" : "Click to Show"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION B: Teacher Profile Fields & Edit Rights (18 Items) */}
              <div className="space-y-4 pt-4 border-t border-gray-200/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#047857]" />
                      Teacher Profile Fields Governance (18 Items in Sequence)
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Configure both <strong>Visibility (Show/Hide)</strong> and <strong>Edit Rights (Editable/Locked)</strong> for each profile field.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllTeacherItemsVisibility(true)}
                      className="text-xs text-emerald-700 hover:bg-emerald-50 h-7"
                    >
                      <Eye className="w-3 h-3 mr-1" /> Show All
                    </Button>
                    <span className="text-gray-400">|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllTeacherItemsVisibility(false)}
                      className="text-xs text-amber-800 hover:bg-amber-50 h-7"
                    >
                      <EyeOff className="w-3 h-3 mr-1" /> Hide All
                    </Button>
                    <span className="text-gray-400">|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllTeacherItemsEdit(true)}
                      className="text-xs text-emerald-700 hover:bg-emerald-50 h-7"
                    >
                      <Unlock className="w-3 h-3 mr-1" /> Unlock All
                    </Button>
                    <span className="text-gray-400">|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllTeacherItemsEdit(false)}
                      className="text-xs text-amber-800 hover:bg-amber-50 h-7"
                    >
                      <Lock className="w-3 h-3 mr-1" /> Lock All
                    </Button>
                  </div>
                </div>

                {/* Master Switch Banner */}
                <div className="p-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/60 to-teal-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">
                        Teacher Profile Editing Master Switch
                      </span>
                      {permissions.teacher.masterEnabled ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                          <Unlock className="w-3 h-3 mr-1 inline" /> Open
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                          <Lock className="w-3 h-3 mr-1 inline" /> Completely Locked
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      When closed, teachers cannot modify any profile field even if individual items are unlocked.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={permissions.teacher.masterEnabled ? "outline" : "default"}
                    size="sm"
                    onClick={toggleTeacherMaster}
                    className={
                      permissions.teacher.masterEnabled
                        ? "border-amber-400 text-amber-900 hover:bg-amber-50 text-xs h-8"
                        : "fatimi-emerald-gradient text-white text-xs h-8"
                    }
                  >
                    {permissions.teacher.masterEnabled ? (
                      <>
                        <Lock className="w-3.5 h-3.5 mr-1.5" /> Lock Master Editing
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5 mr-1.5" /> Open Master Editing
                      </>
                    )}
                  </Button>
                </div>

                {/* 18 Items List with Dual Controls */}
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden bg-white">
                  {teacherItemsList.map((item) => {
                    const perm = permissions.teacher.items[item.key] || { isOpen: true, isVisible: true, label: item.label };
                    const isVisible = perm.isVisible !== false;
                    const isOpen = perm.isOpen;

                    return (
                      <div
                        key={item.key}
                        className={`p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          !isVisible ? "bg-gray-50/70 opacity-75" : "hover:bg-gray-50/50"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className={`w-6 h-6 rounded-full font-bold text-xs flex items-center justify-center flex-shrink-0 ${
                            isVisible ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-500"
                          }`}>
                            {item.num}
                          </span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs sm:text-sm text-gray-900">{item.label}</span>
                              {isVisible ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5">
                                  Visible
                                </Badge>
                              ) : (
                                <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-[10px] py-0 px-1.5">
                                  Hidden from Profile
                                </Badge>
                              )}
                              {isVisible && (
                                isOpen ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5">
                                    Editable
                                  </Badge>
                                ) : (
                                  <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] py-0 px-1.5">
                                    Locked Read-Only
                                  </Badge>
                                )
                              )}
                            </div>
                            <p className="text-[11px] text-gray-400 truncate">{item.desc}</p>
                          </div>
                        </div>

                        {/* Action buttons: Visibility & Edit */}
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          {/* Visibility Toggle */}
                          <Button
                            type="button"
                            variant={isVisible ? "outline" : "secondary"}
                            size="sm"
                            onClick={() => toggleTeacherItemVisibility(item.key)}
                            className={
                              isVisible
                                ? "h-7 text-xs border-gray-300 text-gray-700 hover:bg-gray-100 px-2.5"
                                : "h-7 text-xs bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 px-2.5"
                            }
                          >
                            {isVisible ? (
                              <>
                                <EyeOff className="w-3 h-3 mr-1" /> Hide
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3 mr-1" /> Show
                              </>
                            )}
                          </Button>

                          {/* Edit Rights Toggle */}
                          <Button
                            type="button"
                            variant={isOpen ? "outline" : "secondary"}
                            size="sm"
                            onClick={() => toggleTeacherItemEdit(item.key)}
                            disabled={!isVisible}
                            className={
                              isOpen
                                ? "h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-50 px-2.5"
                                : "h-7 text-xs bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 px-2.5"
                            }
                          >
                            {isOpen ? (
                              <>
                                <Lock className="w-3 h-3 mr-1" /> Lock Edit
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3 mr-1" /> Allow Edit
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================== */
            /* TAB 2: TALABAT PORTAL & PROFILE LOCKING                    */
            /* ========================================================== */
            <div className="space-y-8">
              {/* SECTION A: Talabat Portal Navigation Modules */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <LayoutGrid className="w-4 h-4 text-emerald-600" />
                      Talabat Portal Navigation Modules (Show / Hide Pages)
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Choose which pages show in the Talabat portal sidebar. Hidden modules will not appear to students.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllModules("talabat", true)}
                      className="text-xs text-emerald-700 hover:bg-emerald-50 h-7"
                    >
                      <Eye className="w-3 h-3 mr-1" /> Show All
                    </Button>
                    <span className="text-gray-400">|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllModules("talabat", false)}
                      className="text-xs text-amber-800 hover:bg-amber-50 h-7"
                    >
                      <EyeOff className="w-3 h-3 mr-1" /> Hide All
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {talabatModulesList.map((m) => {
                    const IconComp = m.icon;
                    const isShown = permissions.modules.talabat[m.key] !== false;

                    return (
                      <div
                        key={m.key}
                        onClick={() => toggleModule("talabat", m.key)}
                        className={`p-3.5 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-3 ${
                          isShown
                            ? "bg-white border-emerald-200/80 shadow-xs hover:border-emerald-300 hover:shadow-sm"
                            : "bg-gray-50/80 border-gray-200/80 opacity-70 hover:opacity-90"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className={`p-2 rounded-xl ${isShown ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-500"}`}>
                            <IconComp className="w-4 h-4" />
                          </div>
                          {isShown ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] py-0 px-2 font-semibold">
                              <Eye className="w-3 h-3 mr-1 inline" /> Shown
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px] py-0 px-2 font-semibold">
                              <EyeOff className="w-3 h-3 mr-1 inline" /> Hidden
                            </Badge>
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs font-bold text-gray-900">{m.label}</h4>
                          <p className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{m.desc}</p>
                        </div>

                        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px]">
                          <span className="text-gray-400 font-mono text-[10px]">/{m.key}</span>
                          <span className={`font-semibold ${isShown ? "text-emerald-700" : "text-amber-800"}`}>
                            {isShown ? "Click to Hide" : "Click to Show"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION B: Talabat Profile Sections Governance */}
              <div className="space-y-4 pt-4 border-t border-gray-200/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-[#047857]" />
                      Talabat Profile Sections Governance
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Configure both <strong>Visibility (Show/Hide)</strong> and <strong>Edit Rights (Editable/Locked)</strong> for each section in the student profile.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllTalabatItemsVisibility(true)}
                      className="text-xs text-emerald-700 hover:bg-emerald-50 h-7"
                    >
                      <Eye className="w-3 h-3 mr-1" /> Show All
                    </Button>
                    <span className="text-gray-400">|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllTalabatItemsVisibility(false)}
                      className="text-xs text-amber-800 hover:bg-amber-50 h-7"
                    >
                      <EyeOff className="w-3 h-3 mr-1" /> Hide All
                    </Button>
                    <span className="text-gray-400">|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllTalabatItemsEdit(true)}
                      className="text-xs text-emerald-700 hover:bg-emerald-50 h-7"
                    >
                      <Unlock className="w-3 h-3 mr-1" /> Unlock All
                    </Button>
                    <span className="text-gray-400">|</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAllTalabatItemsEdit(false)}
                      className="text-xs text-amber-800 hover:bg-amber-50 h-7"
                    >
                      <Lock className="w-3 h-3 mr-1" /> Lock All
                    </Button>
                  </div>
                </div>

                {/* Master Switch Banner */}
                <div className="p-4 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/60 to-purple-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900">
                        Talabat Profile Editing Master Switch
                      </span>
                      {permissions.talabat.masterEnabled ? (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]">
                          <Unlock className="w-3 h-3 mr-1 inline" /> Open
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-900 border-amber-300 text-[10px]">
                          <Lock className="w-3 h-3 mr-1 inline" /> Completely Locked
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      When closed, students cannot modify any section of their profile.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={permissions.talabat.masterEnabled ? "outline" : "default"}
                    size="sm"
                    onClick={toggleTalabatMaster}
                    className={
                      permissions.talabat.masterEnabled
                        ? "border-amber-400 text-amber-900 hover:bg-amber-50 text-xs h-8"
                        : "fatimi-emerald-gradient text-white text-xs h-8"
                    }
                  >
                    {permissions.talabat.masterEnabled ? (
                      <>
                        <Lock className="w-3.5 h-3.5 mr-1.5" /> Lock Master Editing
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5 mr-1.5" /> Open Master Editing
                      </>
                    )}
                  </Button>
                </div>

                {/* Talabat Sections List with Dual Controls */}
                <div className="divide-y divide-gray-100 border border-gray-200 rounded-2xl overflow-hidden bg-white">
                  {talabatItemsList.map((item) => {
                    const perm = permissions.talabat[item.key] || { isOpen: false, isVisible: true, label: item.label };
                    const isVisible = perm.isVisible !== false && perm.isVisibleToStudent !== false;
                    const isOpen = perm.isOpen;

                    return (
                      <div
                        key={item.key}
                        className={`p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                          !isVisible ? "bg-gray-50/70 opacity-75" : "hover:bg-gray-50/50"
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs sm:text-sm text-gray-900">{item.label}</span>
                            {isVisible ? (
                              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5">
                                Visible in Portal
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-50 text-rose-800 border-rose-200 text-[10px] py-0 px-1.5">
                                Hidden from Student
                              </Badge>
                            )}
                            {isVisible && (
                              isOpen ? (
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 px-1.5">
                                  Editable
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] py-0 px-1.5">
                                  Locked Read-Only
                                </Badge>
                              )
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
                        </div>

                        {/* Action buttons: Visibility & Edit */}
                        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                          {/* Visibility Toggle */}
                          <Button
                            type="button"
                            variant={isVisible ? "outline" : "secondary"}
                            size="sm"
                            onClick={() => toggleTalabatItemVisibility(item.key)}
                            className={
                              isVisible
                                ? "h-7 text-xs border-gray-300 text-gray-700 hover:bg-gray-100 px-2.5"
                                : "h-7 text-xs bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-300 px-2.5"
                            }
                          >
                            {isVisible ? (
                              <>
                                <EyeOff className="w-3 h-3 mr-1" /> Hide
                              </>
                            ) : (
                              <>
                                <Eye className="w-3 h-3 mr-1" /> Show
                              </>
                            )}
                          </Button>

                          {/* Edit Rights Toggle */}
                          <Button
                            type="button"
                            variant={isOpen ? "outline" : "secondary"}
                            size="sm"
                            onClick={() => toggleTalabatItemEdit(item.key)}
                            disabled={!isVisible}
                            className={
                              isOpen
                                ? "h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-50 px-2.5"
                                : "h-7 text-xs bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-300 px-2.5"
                            }
                          >
                            {isOpen ? (
                              <>
                                <Lock className="w-3 h-3 mr-1" /> Lock Edit
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3 mr-1" /> Allow Edit
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sign Out Card */}
      <Card className="border-red-100">
        <CardContent className="p-5 flex items-center justify-between">
          <div>
            <p className="font-bold text-gray-900 text-sm">Sign Out of Admin Portal</p>
            <p className="text-xs text-gray-500">Terminate current administrative session</p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="w-4 h-4 mr-2" /> Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
