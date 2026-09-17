"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Search,
  Mail,
  Shield,
  Loader2,
  X,
  BookOpen,
  CheckCircle2,
  XCircle,
  Pencil,
  Heart,
  UserCheck,
  GraduationCap,
  Phone,
  MapPin,
  Sparkles,
  Award,
  Crown,
  Building2,
  Clock,
  ExternalLink,
  LayoutGrid,
  List,
  Copy,
  Check,
  Droplet,
  Compass,
  ArrowRight,
  PhoneCall,
  MessageCircle,
  Trash2,
  KeyRound,
  RefreshCw,
  Eye,
  EyeOff,
  User,
  Calendar,
  Briefcase,
  Home,
  FileBadge,
  Layers,
  Info,
  QrCode,
  Printer,
  Power,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  // Details Modal
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Pass Slip Modal
  const [slipUser, setSlipUser] = useState<any | null>(null);

  // Edit Modal
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    watan: "",
    grade: "",
    section: "",
    department: "",
    khidmatMauze: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  // Reset Password Modal
  const [resetModalUser, setResetModalUser] = useState<any | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Create User Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createRole, setCreateRole] = useState("STUDENT");
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    its: "",
    trNo: "",
    grade: "1",
    section: "A",
    employeeId: "",
    department: "Attalimiyah",
    khidmatMauze: "PAKHTI",
    phone: "",
    secondaryPhone: "",
    occupation: "",
    relationType: "Father",
    watan: "",
    residentCity: "",
    bloodGroup: "O+",
    status: "STUDENT",
    hafizYear: "",
    fatherName: "",
    motherName: "",
    fatherPhone: "",
    motherPhone: "",
  });
  const [saving, setSaving] = useState(false);

  const toggleShowPassword = (userId: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const copyToClipboard = (text: string, label?: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast({ title: "Copied", description: label ? `${label}: ${text}` : text, variant: "default" });
    setTimeout(() => setCopiedText(null), 2000);
  };

  const loadAllUsers = useCallback(async () => {
    let all: any[] = [];
    let page = 1;
    const pageSize = 50;
    try {
      while (true) {
        const res = await fetch(`/api/admin/users?page=${page}&pageSize=${pageSize}`);
        const json = await res.json();
        if (!json.success) break;
        all = all.concat(json.data);
        if (page >= json.totalPages) break;
        page++;
      }
      setUsers(all);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllUsers();
  }, [loadAllUsers]);

  // Counts for pills
  const counts = useMemo(() => {
    const res = { ALL: users.length, STUDENT: 0, TEACHER: 0, PARENT: 0, ADMIN: 0, HAFIZ: 0 };
    for (const u of users) {
      if (res[u.role as keyof typeof res] !== undefined) {
        res[u.role as keyof typeof res]++;
      }
      if (u.studentProfile?.status === "HAFIZ") {
        res.HAFIZ++;
      }
    }
    return res;
  }, [users]);

  // Filtered Users
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      const matchFilter = filter === "ALL" || u.role === filter;
      if (!matchFilter) return false;

      if (filter === "STUDENT" && gradeFilter !== "ALL") {
        if (u.studentProfile?.grade !== gradeFilter) return false;
      }

      if (!q) return true;

      const basicMatch = `${u.firstName} ${u.lastName} ${u.email} ${u.role}`.toLowerCase().includes(q);
      if (basicMatch) return true;

      if (u.studentProfile) {
        const sp = u.studentProfile;
        if (sp.its?.toLowerCase().includes(q)) return true;
        if (sp.studentId?.toLowerCase().includes(q)) return true;
        if (sp.trNo?.toLowerCase().includes(q)) return true;
        if (`${sp.grade}${sp.section}`.toLowerCase().includes(q)) return true;
        if (sp.watan?.toLowerCase().includes(q)) return true;
        if (sp.residentCity?.toLowerCase().includes(q)) return true;
        if (sp.fatherName?.toLowerCase().includes(q)) return true;
      }

      if (u.teacherProfile) {
        const tp = u.teacherProfile;
        if (tp.its?.toLowerCase().includes(q)) return true;
        if (tp.employeeId?.toLowerCase().includes(q)) return true;
        if (tp.department?.toLowerCase().includes(q)) return true;
        if (tp.khidmatMauze?.toLowerCase().includes(q)) return true;
        if (tp.mobile?.toLowerCase().includes(q)) return true;
      }

      if (u.parentProfile) {
        const pp = u.parentProfile;
        if (pp.phone?.toLowerCase().includes(q)) return true;
        if (pp.its?.toLowerCase().includes(q)) return true;
        if (
          pp.studentLinks?.some((l: any) =>
            `${l.student?.user?.firstName} ${l.student?.user?.lastName} ${l.student?.its}`.toLowerCase().includes(q)
          )
        ) {
          return true;
        }
      }

      return false;
    });
  }, [users, filter, gradeFilter, search]);

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pass = "Burhani@";
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setResetPassword(pass);
  };

  const openResetPasswordModal = (user: any) => {
    setResetModalUser(user);
    setResetPassword("");
    generateRandomPassword();
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !resetPassword.trim()) return;

    if (resetPassword.length < 6) {
      toast({ variant: "warning", title: "Too Short", description: "Password must be at least 6 characters long." });
      return;
    }

    setResettingPassword(true);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: resetModalUser.id, newPassword: resetPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          variant: "success",
          title: "Password Updated",
          description: `Password for ${resetModalUser.firstName} ${resetModalUser.lastName} is now: ${resetPassword}`,
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === resetModalUser.id ? { ...u, plainPassword: resetPassword } : u))
        );
        setResetModalUser(null);
      } else {
        toast({ variant: "destructive", title: "Reset Failed", description: data.error || "Could not reset password." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Failed to communicate with server." });
    } finally {
      setResettingPassword(false);
    }
  };

  const handlePortfolioToggle = async (userId: string, current: boolean) => {
    await fetch("/api/admin/users", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: userId, portfolioEnabled: !current }),
    });
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId && u.teacherProfile
          ? { ...u, teacherProfile: { ...u.teacherProfile, portfolioEnabled: !current } }
          : u
      )
    );
    toast({
      title: "Portfolio Status Updated",
      description: `Portfolio is now ${!current ? "Enabled" : "Disabled"}.`,
      variant: "success",
    });
  };

  const handleRemoveUserAvatar = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/users/clear-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  avatarUrl: null,
                  teacherProfile: u.teacherProfile ? { ...u.teacherProfile, photoUrl: null } : u.teacherProfile,
                }
              : u
          )
        );
        setSelectedUser((prev: any) =>
          prev && prev.id === userId
            ? {
                ...prev,
                avatarUrl: null,
                teacherProfile: prev.teacherProfile ? { ...prev.teacherProfile, photoUrl: null } : prev.teacherProfile,
              }
            : prev
        );
        setEditAvatarUrl(null);
        toast({
          title: "Profile Photo Removed",
          description: "Standard monogram initials will now be displayed.",
          variant: "success",
        });
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to remove photo." });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to remove photo." });
    }
  };

  const handleClearAllAvatars = async () => {
    if (!confirm("Are you sure you want to remove unwanted profile images and reset everyone to clean monogram initials?")) return;
    try {
      const res = await fetch("/api/admin/users/clear-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: filter === "ALL" ? undefined : filter }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) => ({
            ...u,
            avatarUrl: null,
            teacherProfile: u.teacherProfile ? { ...u.teacherProfile, photoUrl: null } : u.teacherProfile,
          }))
        );
        toast({
          title: "Unwanted Photos Cleared",
          description: data.message || "All user avatars reset to monogram initials.",
          variant: "success",
        });
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to clear photos." });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Failed to clear photos." });
    }
  };

  const openEditModal = (user: any) => {
    setEditingUser(user);
    setEditAvatarUrl(user.avatarUrl || user.teacherProfile?.photoUrl || null);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.teacherProfile?.mobile || user.parentProfile?.phone || "",
      watan: user.studentProfile?.watan || user.parentProfile?.watan || "",
      grade: user.studentProfile?.grade || "",
      section: user.studentProfile?.section || "",
      department: user.teacherProfile?.department || "",
      khidmatMauze: user.teacherProfile?.khidmatMauze || "",
    });
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    setEditSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingUser.id,
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          email: editForm.email,
          phone: editForm.phone,
          watan: editForm.watan,
          avatarUrl: editAvatarUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === editingUser.id
              ? {
                  ...u,
                  firstName: editForm.firstName,
                  lastName: editForm.lastName,
                  email: editForm.email,
                  avatarUrl: editAvatarUrl,
                  teacherProfile: u.teacherProfile
                    ? { ...u.teacherProfile, photoUrl: editAvatarUrl }
                    : u.teacherProfile,
                }
              : u
          )
        );
        setEditingUser(null);
        toast({ title: "User Updated Successfully", variant: "success" });
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: data.error || "Failed to update user." });
      }
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!confirm("Are you sure you want to delete this profile? This will immediately terminate all active sessions and archive access.")) return;
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok || !data.success) {
      toast({ title: "Action failed", description: data.error || "Failed to delete profile", variant: "destructive" });
      return;
    }
    setUsers((prev) => prev.filter((u) => u.id !== id));
    toast({ title: "Profile Deleted", description: "The profile has been removed from active directory.", variant: "default" });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...createForm,
          role: createRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "User Created Successfully",
          description: `${createForm.firstName} ${createForm.lastName} has been registered.`,
          variant: "success",
        });
        setShowCreateModal(false);
        await loadAllUsers();
      } else {
        toast({
          title: res.status === 409 ? "Conflict: User Exists" : "Failed to Create User",
          description: data.error || "Please verify the information and try again.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Failed to communicate with server. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* People & Directory Hub Navigation Tabs */}
      <AdminHubTabs
        hubTitle="People & Directory"
        hubDescription="Manage user accounts, credentials vault, student profiles, parent directory, and portal permissions."
        tabs={[
          { label: "All Accounts", href: "/admin/users", icon: Users },
          { label: "User Passwords Vault", href: "/admin/passwords", icon: KeyRound },
          { label: "Talabat (Students)", href: "/admin/students", icon: GraduationCap },
          { label: "Parents Directory", href: "/admin/parents", icon: Heart },
          { label: "Portal Roles & Permissions", href: "/admin/portal-assignments", icon: UserCheck },
        ]}
      />

      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div className="fatimi-header-banner relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#044e3a] via-[#065f46] to-[#047857] shadow-xl border border-emerald-500/20">
          <div className="absolute top-0 left-0 w-44 h-44 opacity-10 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path d="M50 5L95 50L50 95L5 50Z" fill="none" stroke="#d4af37" strokeWidth="1.5" />
              <circle cx="50" cy="50" r="28" fill="none" stroke="#d4af37" strokeWidth="1" />
            </svg>
          </div>
          <div className="absolute -bottom-8 -right-8 w-44 h-44 opacity-10 rotate-45 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <path d="M50 5L95 50L50 95L5 50Z" fill="none" stroke="#d4af37" strokeWidth="2" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#d4af37] to-[#996515] shadow-lg border border-amber-300/40 shrink-0">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/30 text-amber-200 text-xs font-semibold mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Darse Burhani Institutional Directory</span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                  Directory &amp; People
                </h1>
                <p className="text-emerald-100 text-sm mt-1 max-w-xl">
                  Unified institutional directory displaying Talabat, Faculty (Teachers), and Parents with bespoke identity cards, login credentials, and fast administrative controls.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button
                variant="outline"
                onClick={handleClearAllAvatars}
                className="bg-white/10 hover:bg-white/20 text-white border-white/25 font-semibold px-4 py-2.5 rounded-xl transition-all text-xs flex items-center gap-1.5 backdrop-blur-sm"
                title="Remove unwanted profile photos and switch to clean monogram initials"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-300" /> Remove Unwanted Photos
              </Button>
              <Button
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold shadow-lg shadow-amber-900/30 border border-amber-400/40 px-5 py-2.5 rounded-xl transition-all text-xs"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add New Member
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Search, Filter Pills & View Mode Switcher */}
      <div className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-emerald-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-600" />
            <input
              type="text"
              id="search-people-dir"
              name="search-people-dir"
              placeholder="Search by Name, ITS, Email, Grade, Phone, Mauze..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/20 text-sm placeholder:text-gray-400 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 outline-none transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100/80 p-1 rounded-xl border border-gray-200/60">
            {[
              { id: "ALL", label: "All People", count: counts.ALL, icon: Users },
              { id: "STUDENT", label: "Talabat", count: counts.STUDENT, icon: GraduationCap },
              { id: "TEACHER", label: "Faculty", count: counts.TEACHER, icon: BookOpen },
              { id: "PARENT", label: "Parents", count: counts.PARENT, icon: Heart },
              { id: "ADMIN", label: "Admins", count: counts.ADMIN, icon: Shield },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setFilter(tab.id);
                    setGradeFilter("ALL");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-white text-emerald-950 shadow-sm border border-emerald-200/60"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#047857]" : "text-gray-400"}`} />
                  <span>{tab.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${isActive ? "bg-emerald-100 text-[#047857]" : "bg-gray-200/70 text-gray-600"}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Grade filter for Talabat */}
          {filter === "STUDENT" && (
            <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-900">Sanah / Grade:</span>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-emerald-950 outline-none cursor-pointer"
              >
                <option value="ALL">All Grades</option>
                <option value="1">Grade 1 (Ula)</option>
                <option value="2">Grade 2 (Saniya)</option>
                <option value="3">Grade 3 (Salisa)</option>
                <option value="4">Grade 4 (Rabea)</option>
                <option value="5">Grade 5 (Khamisa)</option>
              </select>
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200/60">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "grid"
                  ? "bg-white text-[#047857] shadow-sm"
                  : "text-gray-400 hover:text-gray-700"
              }`}
              title="Grid Cards Display"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === "table"
                  ? "bg-white text-[#047857] shadow-sm"
                  : "text-gray-400 hover:text-gray-700"
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Directory Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse bg-white border border-gray-100 p-6 rounded-3xl">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gray-200" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-2/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-gray-100 rounded w-full" />
                <div className="h-3 bg-gray-100 rounded w-4/5" />
              </div>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#047857] flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 opacity-60" />
          </div>
          <h3 className="font-display font-bold text-gray-900 text-lg">No Members Found</h3>
          <p className="text-gray-500 text-sm mt-1">
            No accounts matched your search &quot;{search}&quot; with filter &quot;{filter}&quot;.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setSearch(""); setFilter("ALL"); setGradeFilter("ALL"); }}
            className="mt-4 border-emerald-200 text-[#047857]"
          >
            Reset Filters
          </Button>
        </div>
      ) : viewMode === "grid" ? (
        /* ── 4 DISTINCT CARD PATTERNS IN RESPONSIVE GRID ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((user) => {
            const isPasswordVisible = Boolean(showPasswordMap[user.id]);
            if (user.role === "STUDENT") {
              return (
                <TalabatCard
                  key={user.id}
                  user={user}
                  showPassword={isPasswordVisible}
                  onToggleShowPassword={() => toggleShowPassword(user.id)}
                  onEdit={openEditModal}
                  onResetPassword={openResetPasswordModal}
                  onDeleteProfile={handleDeleteProfile}
                  onViewDetails={() => setSelectedUser(user)}
                  onPrintSlip={() => setSlipUser(user)}
                  onCopy={copyToClipboard}
                  copiedText={copiedText}
                />
              );
            } else if (user.role === "TEACHER") {
              return (
                <FacultyCard
                  key={user.id}
                  user={user}
                  showPassword={isPasswordVisible}
                  onToggleShowPassword={() => toggleShowPassword(user.id)}
                  onEdit={openEditModal}
                  onResetPassword={openResetPasswordModal}
                  onDeleteProfile={handleDeleteProfile}
                  onTogglePortfolio={handlePortfolioToggle}
                  onViewDetails={() => setSelectedUser(user)}
                  onPrintSlip={() => setSlipUser(user)}
                  onCopy={copyToClipboard}
                  copiedText={copiedText}
                />
              );
            } else if (user.role === "PARENT") {
              return (
                <ParentCard
                  key={user.id}
                  user={user}
                  showPassword={isPasswordVisible}
                  onToggleShowPassword={() => toggleShowPassword(user.id)}
                  onEdit={openEditModal}
                  onResetPassword={openResetPasswordModal}
                  onDeleteProfile={handleDeleteProfile}
                  onViewDetails={() => setSelectedUser(user)}
                  onPrintSlip={() => setSlipUser(user)}
                  onCopy={copyToClipboard}
                  copiedText={copiedText}
                />
              );
            } else {
              return (
                <AdminCard
                  key={user.id}
                  user={user}
                  showPassword={isPasswordVisible}
                  onToggleShowPassword={() => toggleShowPassword(user.id)}
                  onEdit={openEditModal}
                  onResetPassword={openResetPasswordModal}
                  onDeleteProfile={handleDeleteProfile}
                  onViewDetails={() => setSelectedUser(user)}
                  onCopy={copyToClipboard}
                  copiedText={copiedText}
                />
              );
            }
          })}
        </div>
      ) : (
        /* ── TABLE VIEW ── */
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-emerald-50/50 text-emerald-950 font-bold border-b border-emerald-100">
                <tr>
                  <th className="p-4">Member</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Key Identifier</th>
                  <th className="p-4">Login Password</th>
                  <th className="p-4">Department / Grade</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((u) => {
                  const isVisible = Boolean(showPasswordMap[u.id]);
                  const pwd = u.plainPassword || "Burhani@2026";
                  return (
                    <tr key={u.id} className="hover:bg-emerald-50/20 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 border border-gray-200">
                            {(u.avatarUrl || u.teacherProfile?.photoUrl) ? (
                              <AvatarImage src={u.avatarUrl || u.teacherProfile?.photoUrl} alt={u.firstName} className="object-cover" />
                            ) : null}
                            <AvatarFallback className="bg-emerald-100 text-emerald-800 font-bold text-xs">
                              {getInitials(u.firstName, u.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-bold text-gray-900">{u.firstName} {u.lastName}</p>
                            <p className="text-xs text-gray-500 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={`text-[10px] font-semibold ${
                          u.role === "TEACHER" ? "bg-amber-100 text-amber-800 border-amber-200" :
                          u.role === "STUDENT" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
                          u.role === "PARENT" ? "bg-rose-100 text-rose-800 border-rose-200" :
                          "bg-indigo-100 text-indigo-800 border-indigo-200"
                        }`}>
                          {u.role === "STUDENT" ? "TALABAT" : u.role}
                        </Badge>
                      </td>
                      <td className="p-4 font-mono text-xs">
                        {u.studentProfile?.its ? `ITS: ${u.studentProfile.its}` :
                         u.teacherProfile?.employeeId ? `ITS: ${u.teacherProfile.employeeId}` :
                         u.parentProfile?.phone ? u.parentProfile.phone : "—"}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-amber-950 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            {isVisible ? pwd : "••••••••"}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleShowPassword(u.id)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors"
                            title={isVisible ? "Hide password" : "Show password"}
                          >
                            {isVisible ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(pwd, "Password")}
                            className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-800 transition-colors"
                            title="Copy password"
                          >
                            {copiedText === pwd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="p-4 text-xs text-gray-600">
                        {u.studentProfile ? `Grade ${u.studentProfile.grade || "?"}${u.studentProfile.section || ""} • ${u.studentProfile.watan || "—"}` :
                         u.teacherProfile ? `${u.teacherProfile.department || "Attalimiyah"} • ${u.teacherProfile.khidmatMauze || "PAKHTI"}` :
                         u.parentProfile ? `${u.parentProfile.studentLinks?.length || 0} Linked Children` : "System Admin"}
                      </td>
                      <td className="p-4 text-xs text-gray-600">
                        {u.teacherProfile?.mobile || u.parentProfile?.phone || u.studentProfile?.fatherPhone || u.email}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSlipUser(u)}
                            className="h-8 px-2 text-xs text-blue-800 border-blue-200 hover:bg-blue-50"
                            title="Printable Pass Slip"
                          >
                            <QrCode className="w-3 h-3 mr-1 text-blue-600" /> Pass Slip
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedUser(u)}
                            className="h-8 px-2 text-xs"
                            title="View Full Profile Details"
                          >
                            <Info className="w-3 h-3 mr-1 text-emerald-600" /> Details
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResetPasswordModal(u)}
                            className="h-8 px-2 text-xs text-amber-800 border-amber-200 hover:bg-amber-50"
                            title="Reset Password"
                          >
                            <KeyRound className="w-3 h-3 mr-1 text-amber-600" /> Reset
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditModal(u)} className="h-8 px-2 text-xs">
                            <Pencil className="w-3 h-3 mr-1" /> Edit
                          </Button>
                          {u.role !== "ADMIN" && (
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteProfile(u.id)} className="h-8 px-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Details Modal */}
      <Modal open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white">
                <User className="w-4 h-4" />
              </div>
              Member Profile Details
            </ModalTitle>
          </ModalHeader>
          {selectedUser && (
            <div className="space-y-4 py-2 text-sm">
              <div className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 flex-wrap">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16 rounded-2xl border-2 border-emerald-600 shadow-sm">
                    {selectedUser.avatarUrl || selectedUser.teacherProfile?.photoUrl ? (
                      <AvatarImage src={selectedUser.avatarUrl || selectedUser.teacherProfile?.photoUrl} alt={selectedUser.firstName} />
                    ) : null}
                    <AvatarFallback className="bg-emerald-800 text-white font-bold text-xl">
                      {getInitials(selectedUser.firstName, selectedUser.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{selectedUser.firstName} {selectedUser.lastName}</h3>
                    <p className="text-xs text-gray-600 font-mono">{selectedUser.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="text-xs">{selectedUser.role}</Badge>
                      <span className="text-xs text-gray-500">Status: {selectedUser.isActive ? "Active" : "Archived"}</span>
                    </div>
                  </div>
                </div>

                {(selectedUser.avatarUrl || selectedUser.teacherProfile?.photoUrl) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRemoveUserAvatar(selectedUser.id)}
                    className="text-red-600 border-red-200 hover:bg-red-50 text-xs font-semibold gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remove Photo
                  </Button>
                )}
              </div>

              {/* Role Specific Details */}
              {selectedUser.studentProfile && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs">
                  <div><span className="text-gray-400 block font-semibold uppercase">ITS Number</span><span className="font-mono font-bold text-gray-800">{selectedUser.studentProfile.its || "—"}</span></div>
                  <div><span className="text-gray-400 block font-semibold uppercase">Grade / Section</span><span className="font-bold text-gray-800">{selectedUser.studentProfile.grade || "?"}{selectedUser.studentProfile.section || ""}</span></div>
                  <div><span className="text-gray-400 block font-semibold uppercase">TR Number</span><span className="font-mono text-gray-800">{selectedUser.studentProfile.trNo || "—"}</span></div>
                  <div><span className="text-gray-400 block font-semibold uppercase">Hometown / Watan</span><span className="font-bold text-gray-800">{selectedUser.studentProfile.watan || "—"}</span></div>
                  <div><span className="text-gray-400 block font-semibold uppercase">Father&apos;s Name</span><span className="font-bold text-gray-800">{selectedUser.studentProfile.fatherName || "—"}</span></div>
                  <div><span className="text-gray-400 block font-semibold uppercase">Father&apos;s Phone</span><span className="font-mono text-gray-800">{selectedUser.studentProfile.fatherPhone || "—"}</span></div>
                </div>
              )}

              {selectedUser.teacherProfile && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs">
                  <div><span className="text-gray-400 block font-semibold uppercase">Employee / ITS</span><span className="font-mono font-bold text-gray-800">{selectedUser.teacherProfile.employeeId || selectedUser.teacherProfile.its || "—"}</span></div>
                  <div><span className="text-gray-400 block font-semibold uppercase">Khidmat Mauze</span><span className="font-bold text-emerald-800">{selectedUser.teacherProfile.khidmatMauze || "PAKHTI"}</span></div>
                  <div><span className="text-gray-400 block font-semibold uppercase">Department</span><span className="font-bold text-gray-800">{selectedUser.teacherProfile.department || "Attalimiyah"}</span></div>
                  <div><span className="text-gray-400 block font-semibold uppercase">Khidmat Years</span><span className="font-bold text-gray-800">{selectedUser.teacherProfile.khidmatYear || "—"} Yrs</span></div>
                  <div><span className="text-gray-400 block font-semibold uppercase">Farig Year</span><span className="font-bold text-gray-800">{selectedUser.teacherProfile.farigYear || "—"}</span></div>
                  <div><span className="text-gray-400 block font-semibold uppercase">Contact Phone</span><span className="font-mono text-gray-800">{selectedUser.teacherProfile.mobile || "—"}</span></div>
                </div>
              )}

              {selectedUser.parentProfile && (
                <div className="space-y-3 p-4 rounded-2xl bg-gray-50 border border-gray-200 text-xs">
                  <div className="grid grid-cols-3 gap-3">
                    <div><span className="text-gray-400 block font-semibold uppercase">Phone</span><span className="font-mono font-bold text-gray-800">{selectedUser.parentProfile.phone || "—"}</span></div>
                    <div><span className="text-gray-400 block font-semibold uppercase">Relationship</span><span className="font-bold text-gray-800">{selectedUser.parentProfile.relationType || "Father"}</span></div>
                    <div><span className="text-gray-400 block font-semibold uppercase">Occupation</span><span className="font-bold text-gray-800">{selectedUser.parentProfile.occupation || "—"}</span></div>
                  </div>
                  <div>
                    <span className="text-gray-400 block font-semibold uppercase mb-1">Linked Children</span>
                    {selectedUser.parentProfile.studentLinks?.length > 0 ? (
                      <div className="space-y-1">
                        {selectedUser.parentProfile.studentLinks.map((l: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200">
                            <span className="font-bold text-gray-800">{l.student?.user?.firstName} {l.student?.user?.lastName}</span>
                            <span className="font-mono text-xs text-gray-500">ITS: {l.student?.its} • Grade {l.student?.grade}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400">No linked student records.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Password credentials preview */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between">
                <div>
                  <span className="text-xs text-amber-900 font-bold uppercase block">Login Password:</span>
                  <span className="font-mono font-bold text-amber-950 text-sm">{selectedUser.plainPassword || "Burhani@2026"}</span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyToClipboard(selectedUser.plainPassword || "Burhani@2026", "Password")}
                  className="border-amber-300 text-amber-900 hover:bg-amber-100"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy Password
                </Button>
              </div>

              <ModalFooter>
                <ModalClose asChild>
                  <Button variant="outline" size="sm">Close</Button>
                </ModalClose>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>

      {/* Printable Pass Slip Modal */}
      <Modal open={!!slipUser} onOpenChange={() => setSlipUser(null)}>
        <ModalContent className="max-w-md print-credential-slip">
          <ModalHeader className="border-b border-gray-100 pb-3">
            <ModalTitle className="flex items-center justify-between">
              <span className="text-base font-bold text-gray-900">Institutional Access Pass</span>
              <Badge className="text-xs bg-emerald-100 text-emerald-900 border-emerald-300 font-bold uppercase">
                {slipUser?.role}
              </Badge>
            </ModalTitle>
          </ModalHeader>
          {slipUser && (
            <div className="space-y-4 py-3">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-800 to-teal-950 text-white shadow-md relative overflow-hidden">
                <div className="relative z-10 flex items-center gap-3.5">
                  <Avatar className="w-14 h-14 rounded-xl border-2 border-amber-400">
                    {slipUser.avatarUrl ? <AvatarImage src={slipUser.avatarUrl} /> : null}
                    <AvatarFallback className="bg-amber-500 text-white font-bold text-lg">
                      {getInitials(slipUser.firstName, slipUser.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-bold text-base text-white">{slipUser.firstName} {slipUser.lastName}</h4>
                    <p className="text-xs text-emerald-200 font-mono">{slipUser.email}</p>
                    <p className="text-[11px] text-amber-300 font-bold mt-0.5">
                      {slipUser.studentProfile?.its ? `ITS: ${slipUser.studentProfile.its}` :
                       slipUser.teacherProfile?.employeeId ? `ID: ${slipUser.teacherProfile.employeeId}` :
                       slipUser.parentProfile?.phone ? `Phone: ${slipUser.parentProfile.phone}` : "Darse Burhani Member"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2 p-3.5 rounded-xl bg-gray-50 border border-gray-200 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500 font-medium">Login Portal:</span>
                  <span className="font-mono font-bold text-emerald-800">{window.location.origin}/login</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500 font-medium">Username / ITS:</span>
                  <span className="font-mono font-bold text-gray-900">{slipUser.email}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500 font-medium">Temporary Password:</span>
                  <span className="font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                    {slipUser.plainPassword || "Burhani@2026"}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-gray-500 text-center">
                Please keep this credential pass confidential. You may change your password after logging in.
              </p>

              <ModalFooter className="no-print pt-2">
                <ModalClose asChild>
                  <Button variant="outline" size="sm">Close</Button>
                </ModalClose>
                <Button
                  size="sm"
                  onClick={() => window.print()}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-1"
                >
                  <Printer className="w-4 h-4" /> Print Pass Slip
                </Button>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>

      {/* Create Member Modal */}
      <Modal open={showCreateModal} onOpenChange={setShowCreateModal}>
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl fatimi-gold-accent flex items-center justify-center text-white">
                <Plus className="w-4 h-4" />
              </div>
              Register New Institutional Member
            </ModalTitle>
          </ModalHeader>
          <form onSubmit={handleCreateUser} className="space-y-4 py-2">
            {/* Role Switcher */}
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
                Select Member Role *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "STUDENT", label: "Talabat (Student)", icon: GraduationCap },
                  { id: "TEACHER", label: "Faculty (Teacher)", icon: BookOpen },
                  { id: "PARENT", label: "Parent / Guardian", icon: Heart },
                  { id: "ADMIN", label: "Administrator", icon: Shield },
                ].map((r) => {
                  const Icon = r.icon;
                  const isSel = createRole === r.id;
                  return (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setCreateRole(r.id)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        isSel
                          ? "bg-emerald-50 border-[#047857] text-[#047857] shadow-xs"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-1 ${isSel ? "text-[#047857]" : "text-gray-400"}`} />
                      <span>{r.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700">First Name *</label>
                <input
                  type="text"
                  required
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-600 outline-none"
                  placeholder="e.g. Murtaza"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Last Name *</label>
                <input
                  type="text"
                  required
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-600 outline-none"
                  placeholder="e.g. Hamid"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-700">Official Email *</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:border-emerald-600 outline-none"
                  placeholder="murtaza@darseburhani.com"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Initial Password *</label>
                <input
                  type="text"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:border-emerald-600 outline-none"
                  placeholder="e.g. Burhani@2026"
                />
              </div>
            </div>

            {/* Talabat Specific Fields */}
            {createRole === "STUDENT" && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100">
                <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-emerald-700" /> Talabat Academic Details
                </p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-emerald-950">ITS Number</label>
                    <input
                      type="text"
                      value={createForm.its}
                      onChange={(e) => setCreateForm({ ...createForm, its: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-200 text-sm font-mono bg-white"
                      placeholder="30345678"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-emerald-950">TR Number</label>
                    <input
                      type="text"
                      value={createForm.trNo}
                      onChange={(e) => setCreateForm({ ...createForm, trNo: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-200 text-sm font-mono bg-white"
                      placeholder="TR-102"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-emerald-950">Grade / Sanah</label>
                    <select
                      value={createForm.grade}
                      onChange={(e) => setCreateForm({ ...createForm, grade: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-200 text-sm bg-white"
                    >
                      <option value="1">Grade 1 (Ula)</option>
                      <option value="2">Grade 2 (Saniya)</option>
                      <option value="3">Grade 3 (Salisa)</option>
                      <option value="4">Grade 4 (Rabea)</option>
                      <option value="5">Grade 5 (Khamisa)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-emerald-950">Section</label>
                    <select
                      value={createForm.section}
                      onChange={(e) => setCreateForm({ ...createForm, section: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-200 text-sm bg-white"
                    >
                      <option value="A">Section A</option>
                      <option value="B">Section B</option>
                      <option value="C">Section C</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-emerald-950">Hometown / Watan</label>
                    <input
                      type="text"
                      value={createForm.watan}
                      onChange={(e) => setCreateForm({ ...createForm, watan: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-200 text-sm bg-white"
                      placeholder="Surat"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-emerald-950">Blood Group</label>
                    <select
                      value={createForm.bloodGroup}
                      onChange={(e) => setCreateForm({ ...createForm, bloodGroup: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-emerald-200 text-sm bg-white font-mono"
                    >
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Faculty Specific Fields */}
            {createRole === "TEACHER" && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-amber-50/50 border border-amber-100">
                <p className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-amber-700" /> Faculty Khidmat Details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-amber-950">ITS / Employee ID</label>
                    <input
                      type="text"
                      value={createForm.employeeId}
                      onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 text-sm font-mono bg-white"
                      placeholder="TCH-2026"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-amber-950">Department</label>
                    <input
                      type="text"
                      value={createForm.department}
                      onChange={(e) => setCreateForm({ ...createForm, department: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 text-sm bg-white"
                      placeholder="Attalimiyah"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-amber-950">Khidmat Mauze</label>
                    <input
                      type="text"
                      value={createForm.khidmatMauze}
                      onChange={(e) => setCreateForm({ ...createForm, khidmatMauze: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 text-sm bg-white"
                      placeholder="PAKHTI"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-amber-950">Mobile Number</label>
                    <input
                      type="text"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-amber-200 text-sm font-mono bg-white"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Parent Specific Fields */}
            {createRole === "PARENT" && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100">
                <p className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-rose-700" /> Parent Family Details
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-rose-950">Contact Phone *</label>
                    <input
                      type="text"
                      value={createForm.phone}
                      onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-rose-200 text-sm font-mono bg-white"
                      placeholder="+91 9876543210"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-rose-950">Relationship</label>
                    <select
                      value={createForm.relationType}
                      onChange={(e) => setCreateForm({ ...createForm, relationType: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-rose-200 text-sm bg-white"
                    >
                      <option value="Father">Father (Walid)</option>
                      <option value="Mother">Mother (Walida)</option>
                      <option value="Guardian">Guardian (Wali)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-rose-950">Occupation</label>
                    <input
                      type="text"
                      value={createForm.occupation}
                      onChange={(e) => setCreateForm({ ...createForm, occupation: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-rose-200 text-sm bg-white"
                      placeholder="Business / Professional"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-rose-950">City / Watan</label>
                    <input
                      type="text"
                      value={createForm.watan}
                      onChange={(e) => setCreateForm({ ...createForm, watan: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-rose-200 text-sm bg-white"
                      placeholder="Mumbai"
                    />
                  </div>
                </div>
              </div>
            )}

            <ModalFooter className="pt-2">
              <ModalClose asChild>
                <Button variant="outline" size="sm" type="button" className="border-gray-200">
                  Cancel
                </Button>
              </ModalClose>
              <Button
                type="submit"
                size="sm"
                disabled={saving || !createForm.email || !createForm.password || !createForm.firstName || !createForm.lastName}
                className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold gap-1.5 shadow-md"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Member Profile
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Edit User Modal */}
      <Modal open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl fatimi-emerald-gradient flex items-center justify-center text-white">
                <Pencil className="w-4 h-4" />
              </div>
              Edit User Profile
            </ModalTitle>
          </ModalHeader>
          <div className="space-y-4 py-4">
            {/* Profile Avatar & Removal */}
            <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100">
              <Avatar className="w-14 h-14 rounded-2xl border-2 border-emerald-600 shadow-sm">
                {editAvatarUrl ? <AvatarImage src={editAvatarUrl} alt={editForm.firstName} /> : null}
                <AvatarFallback className="bg-emerald-800 text-white font-bold text-base">
                  {getInitials(editForm.firstName || "U", editForm.lastName || "")}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-800 uppercase tracking-wider">Profile Photo / Avatar</p>
                <p className="text-xs text-gray-500">
                  {editAvatarUrl ? "Custom profile image is set." : "Using clean monogram initials."}
                </p>
              </div>
              {editAvatarUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditAvatarUrl(null);
                    if (editingUser) handleRemoveUserAvatar(editingUser.id);
                  }}
                  className="text-red-600 border-red-200 hover:bg-red-50 text-xs font-semibold gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove Photo
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">First Name</label>
                <input
                  className="fatimi-input mt-1"
                  value={editForm.firstName}
                  onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Name</label>
                <input
                  className="fatimi-input mt-1"
                  value={editForm.lastName}
                  onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Official Email</label>
              <input
                type="email"
                className="fatimi-input mt-1 font-mono text-sm"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
          </div>
          <ModalFooter>
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="border-emerald-200/60">Cancel</Button>
            </ModalClose>
            <Button
              size="sm"
              className="fatimi-emerald-gradient text-white hover:opacity-90"
              onClick={handleEditSave}
              disabled={editSaving || !editForm.email || !editForm.firstName || !editForm.lastName}
            >
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Admin Reset Password Modal */}
      <Modal open={!!resetModalUser} onOpenChange={() => setResetModalUser(null)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md text-white">
                <KeyRound className="w-4 h-4" />
              </div>
              Reset Account Password
            </ModalTitle>
          </ModalHeader>
          {resetModalUser && (
            <form onSubmit={handleAdminResetPassword} className="space-y-4 py-2">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200/80 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900 text-sm">{resetModalUser.firstName} {resetModalUser.lastName}</p>
                  <Badge className="text-[10px] bg-white text-amber-800 border-amber-300 font-bold">
                    {resetModalUser.role}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 font-mono">{resetModalUser.email}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="adminResetPasswordInput" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                    New Password *
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1 hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" /> Generate Random
                  </button>
                </div>
                <input
                  id="adminResetPasswordInput"
                  type="text"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition-all font-bold"
                  required
                  minLength={6}
                />
              </div>

              <div className="rounded-xl bg-gray-50 p-3 border border-gray-200 text-xs text-gray-500 space-y-1">
                <p className="font-semibold text-gray-700">Security Note:</p>
                <p>
                  Resetting the password immediately updates the user&apos;s hash and terminates all currently active login sessions across devices.
                </p>
              </div>

              <ModalFooter className="pt-2">
                <ModalClose asChild>
                  <Button variant="outline" size="sm" type="button" className="border-gray-200">
                    Cancel
                  </Button>
                </ModalClose>
                <Button
                  type="submit"
                  size="sm"
                  disabled={resettingPassword || !resetPassword.trim()}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold gap-1.5 shadow-md"
                >
                  {resettingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  Confirm Reset
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CARD 1: TALABAT (STUDENT) CARD
   Academic ID Badge with Gold/Emerald Fatimi Motif, points tier & credentials
   ══════════════════════════════════════════════════════════════════════ */
function TalabatCard({
  user,
  showPassword,
  onToggleShowPassword,
  onEdit,
  onResetPassword,
  onDeleteProfile,
  onViewDetails,
  onPrintSlip,
  onCopy,
  copiedText,
}: any) {
  const sp = user.studentProfile || {};
  const isHafiz = sp.status === "HAFIZ";
  const pwd = user.plainPassword || "Burhani@2026";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group relative bg-white rounded-3xl border border-emerald-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between"
    >
      {/* Top Academic Ribbon */}
      <div className={`px-5 py-2.5 flex items-center justify-between text-xs font-bold ${
        isHafiz
          ? "bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white shadow-inner"
          : "bg-gradient-to-r from-[#047857] to-[#065f46] text-white"
      }`}>
        <div className="flex items-center gap-1.5">
          {isHafiz ? (
            <>
              <Crown className="w-3.5 h-3.5 text-yellow-100 fill-yellow-200" />
              <span>HAFIZ AL-QURAN {sp.hafizYear ? `(${sp.hafizYear} H)` : ""}</span>
            </>
          ) : (
            <>
              <BookOpen className="w-3.5 h-3.5 text-emerald-200" />
              <span>TALABAT (SANAH)</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase">
            Grade {sp.grade || "Rabea"}{sp.section ? `-${sp.section}` : ""}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-4 flex-1">
        {/* Student Portrait & Primary Info */}
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <Avatar className={`w-16 h-16 rounded-2xl border-2 shadow-md ${
              isHafiz ? "border-amber-400 ring-2 ring-amber-200/50" : "border-[#047857] ring-2 ring-emerald-100"
            }`}>
              {user.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.firstName} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-[#047857] to-[#064e3b] text-white font-black text-lg">
                {getInitials(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
              user.isActive ? "bg-emerald-500" : "bg-gray-400"
            }`} title={user.isActive ? "Active Account" : "Inactive"} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-gray-900 text-base leading-snug group-hover:text-[#047857] transition-colors truncate">
              {user.firstName} {user.lastName}
            </h3>
            
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <button
                onClick={() => onCopy(sp.its || sp.studentId || "", "ITS")}
                className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-[#047857] px-2 py-0.5 rounded-md border border-emerald-200 transition-colors"
                title="Click to copy ITS"
              >
                <span>ITS: {sp.its || sp.studentId || "—"}</span>
                {copiedText === (sp.its || sp.studentId) ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5 opacity-60" />}
              </button>

              {sp.trNo && (
                <span className="font-mono text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200">
                  TR: {sp.trNo}
                </span>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-1 truncate font-mono" title={user.email}>
              {user.email}
            </p>
          </div>
        </div>

        {/* Credentials Bar (Admin Visibility) */}
        <div className="flex items-center justify-between bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/70 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-[10px] uppercase font-bold text-amber-900 tracking-wider shrink-0">Password:</span>
            <span className="font-mono font-bold text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-200/80 truncate">
              {showPassword ? pwd : "••••••••"}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={onToggleShowPassword}
              className="p-1 hover:bg-amber-100 rounded text-amber-800 transition-colors"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onCopy(pwd, "Password")}
              className="p-1 hover:bg-amber-100 rounded text-amber-800 transition-colors"
              title="Copy password"
            >
              {copiedText === pwd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Academic & Personal Indicators */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-1.5 text-gray-600 bg-emerald-50/40 p-2 rounded-xl border border-emerald-100/50">
            <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Performance</span>
              <span className="font-semibold text-gray-800">{sp.currentPoints ?? 0} Pts • {sp.tier || "BRONZE"}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-gray-600 bg-emerald-50/40 p-2 rounded-xl border border-emerald-100/50">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <div className="truncate">
              <span className="text-[10px] uppercase font-bold text-gray-400 block">Hometown / Watan</span>
              <span className="font-semibold text-gray-800">{sp.watan || sp.residentCity || "Unassigned"}</span>
            </div>
          </div>
        </div>

        {/* Family & Blood Group */}
        <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1">
          <div className="flex items-center gap-1.5 truncate">
            {sp.fatherName && (
              <span className="text-gray-600 truncate" title={`Father: ${sp.fatherName}`}>
                Walid: <span className="font-medium text-gray-800">{sp.fatherName.split(" ")[0]}</span>
              </span>
            )}
          </div>
          {sp.bloodGroup && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200 shrink-0">
              <Droplet className="w-3 h-3 text-rose-500" />
              {sp.bloodGroup}
            </span>
          )}
        </div>
      </div>

      {/* Footer Action Strip */}
      <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrintSlip}
            className="text-[11px] text-blue-700 hover:text-blue-900 font-bold hover:underline flex items-center gap-1"
            title="Generate Student Login Pass Slip"
          >
            <QrCode className="w-3 h-3" /> Pass Slip
          </button>
          <span className="text-gray-300">•</span>
          <button
            onClick={onViewDetails}
            className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline flex items-center gap-1"
          >
            <Info className="w-3 h-3" /> Profile
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {onResetPassword && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResetPassword(user)}
              className="h-7 px-2 text-xs text-amber-800 border-amber-200 hover:bg-amber-50"
              title="Reset Password"
            >
              <KeyRound className="w-3 h-3 mr-1 text-amber-600" /> Reset
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(user)}
            className="h-7 px-2 text-xs text-gray-700 border-gray-200 hover:bg-emerald-50 hover:text-[#047857]"
          >
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteProfile(user.id)}
            className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CARD 2: FACULTY (TEACHER / KHIDMAT GUZAR) CARD
   Royal Scholar Card with Emerald Velvet, Gold Arch, Mauze & Portfolio
   ══════════════════════════════════════════════════════════════════════ */
function FacultyCard({
  user,
  showPassword,
  onToggleShowPassword,
  onEdit,
  onResetPassword,
  onDeleteProfile,
  onTogglePortfolio,
  onViewDetails,
  onPrintSlip,
  onCopy,
  copiedText,
}: any) {
  const tp = user.teacherProfile || {};
  const isPortfolio = Boolean(tp.portfolioEnabled);
  const pwd = user.plainPassword || "Burhani@2026";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group relative bg-white rounded-3xl border-2 border-emerald-600/30 shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col justify-between"
    >
      {/* Royal Scholar Header Banner */}
      <div className="bg-gradient-to-r from-[#034430] via-[#056046] to-[#047857] p-4 pb-12 relative text-white">
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <polygon points="50,0 63,38 100,50 63,62 50,100 37,62 0,50 37,38" fill="#d4af37" />
          </svg>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
            <Building2 className="w-3.5 h-3.5 text-amber-300" />
            <span className="font-bold tracking-wide">{tp.khidmatMauze || "PAKHTI"}</span>
          </div>

          <div className="flex items-center gap-2">
            {tp.khidmatYear && (
              <span className="bg-amber-400/25 border border-amber-300/40 text-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {tp.khidmatYear} Yrs Khidmat
              </span>
            )}
            {tp.farigYear && (
              <span className="bg-white/20 text-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-bold">
                Farig {tp.farigYear}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Floating Avatar & Details Body */}
      <div className="px-5 pb-5 pt-0 -mt-8 flex-1 space-y-3.5 relative z-10">
        <div className="flex items-end gap-3.5">
          <div className="relative shrink-0">
            <Avatar className="w-20 h-20 rounded-2xl border-4 border-white shadow-xl ring-2 ring-[#d4af37]/70 shrink-0">
              {(tp.photoUrl || user.avatarUrl) ? (
                <AvatarImage
                  src={tp.photoUrl || user.avatarUrl}
                  alt={`${user.firstName} ${user.lastName}`}
                  className="object-cover object-top"
                />
              ) : null}
              <AvatarFallback className="bg-gradient-to-br from-[#047857] to-[#034430] text-amber-300 font-black text-2xl">
                {getInitials(user.firstName, user.lastName)}
              </AvatarFallback>
            </Avatar>
            <span
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                user.isActive ? "bg-emerald-500" : "bg-gray-400"
              }`}
              title={user.isActive ? "Active Account" : "Inactive"}
            />
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#047857] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-block mb-1">
              {tp.department || tp.subCategory || "Attalimiyah Faculty"}
            </span>
            <h3 className="font-display font-extrabold text-gray-900 text-base leading-snug truncate" title={`${user.firstName} ${user.lastName}`}>
              {user.firstName} {user.lastName}
            </h3>
          </div>
        </div>

        {/* Identification & Credentials Bar */}
        <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/70 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-medium">ITS / Employee ID:</span>
            <button
              onClick={() => onCopy(tp.its || tp.employeeId || "", "ITS")}
              className="font-mono font-bold text-[#047857] hover:underline flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-emerald-200"
            >
              <span>{tp.its || tp.employeeId || "—"}</span>
              {copiedText === (tp.its || tp.employeeId) ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 opacity-60" />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-500 font-medium flex items-center gap-1">
              <Mail className="w-3 h-3 text-emerald-600" /> Email:
            </span>
            <button
              onClick={() => onCopy(user.email, "Email")}
              className="font-mono text-gray-800 truncate max-w-[160px] hover:text-[#047857]"
              title={user.email}
            >
              {user.email}
            </button>
          </div>

          {/* Admin Password View */}
          <div className="flex items-center justify-between pt-1 border-t border-emerald-100">
            <span className="text-gray-500 font-medium flex items-center gap-1">
              <KeyRound className="w-3 h-3 text-amber-600" /> Password:
            </span>
            <div className="flex items-center gap-1">
              <span className="font-mono font-bold text-amber-950 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200">
                {showPassword ? pwd : "••••••••"}
              </span>
              <button
                type="button"
                onClick={onToggleShowPassword}
                className="p-1 hover:bg-emerald-100/70 rounded text-emerald-800 transition-colors"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-3 h-3 text-amber-700" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => onCopy(pwd, "Password")}
                className="p-1 hover:bg-emerald-100/70 rounded text-emerald-800 transition-colors"
                title="Copy password"
              >
                {copiedText === pwd ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {tp.mobile && (
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium flex items-center gap-1">
                <Phone className="w-3 h-3 text-emerald-600" /> Contact:
              </span>
              <a href={`tel:${tp.mobile}`} className="font-mono font-medium text-gray-800 hover:text-emerald-700">
                {tp.mobile}
              </a>
            </div>
          )}
        </div>

        {/* Page & Portal Permissions Bar */}
        <div className="flex items-center justify-between bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/80">
          <div className="flex items-center gap-1.5 text-xs text-emerald-900 font-semibold">
            <Shield className="w-3.5 h-3.5 text-emerald-700" />
            <span>Page Authority</span>
          </div>
          <a href={`/admin/portal-assignments?teacherId=${user.id}`}>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[11px] px-2.5 rounded-lg bg-white border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-bold"
            >
              Assign Pages
            </Button>
          </a>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="px-5 py-3 bg-gray-50/90 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrintSlip}
            className="text-[11px] text-blue-700 hover:text-blue-900 font-bold hover:underline flex items-center gap-1"
            title="Generate Faculty Login Pass Slip"
          >
            <QrCode className="w-3 h-3" /> Pass Slip
          </button>
          <span className="text-gray-300">•</span>
          <a
            href={`/teacher/profile?userId=${user.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Profile
          </a>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {onResetPassword && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResetPassword(user)}
              className="h-7 px-2 text-xs text-amber-800 border-amber-200 hover:bg-amber-50"
              title="Reset Password"
            >
              <KeyRound className="w-3 h-3 mr-1 text-amber-600" /> Reset
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(user)}
            className="h-7 px-2 text-xs text-gray-700 border-gray-200 hover:bg-emerald-50 hover:text-[#047857]"
          >
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteProfile(user.id)}
            className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CARD 3: PARENT (FAMILY & GUARDIAN) CARD
   Warm Rose-Amber Family Card with Linked Children & Direct Contacts
   ══════════════════════════════════════════════════════════════════════ */
function ParentCard({
  user,
  showPassword,
  onToggleShowPassword,
  onEdit,
  onResetPassword,
  onDeleteProfile,
  onViewDetails,
  onPrintSlip,
  onCopy,
  copiedText,
}: any) {
  const pp = user.parentProfile || {};
  const children = pp.studentLinks || [];
  const pwd = user.plainPassword || "Burhani@2026";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group relative bg-white rounded-3xl border border-rose-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between"
    >
      {/* Top Rose-Amber Family Ribbon */}
      <div className="bg-gradient-to-r from-rose-500 via-rose-600 to-amber-600 px-5 py-2.5 text-white flex items-center justify-between text-xs font-bold shadow-inner">
        <div className="flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 text-rose-200 fill-rose-200" />
          <span>FAMILY GUARDIAN</span>
        </div>
        <span className="bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase">
          {children.length} {children.length === 1 ? "Child Linked" : "Children Linked"}
        </span>
      </div>

      <div className="p-5 space-y-4 flex-1">
        {/* Parent Portrait & Contacts */}
        <div className="flex items-start gap-4">
          <Avatar className="w-14 h-14 rounded-2xl border-2 border-rose-200 ring-2 ring-rose-50 shrink-0 shadow-sm">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.firstName} /> : null}
            <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-600 text-white font-black text-base">
              {getInitials(user.firstName, user.lastName)}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-display font-bold text-gray-900 text-base leading-snug truncate">
                {user.firstName} {user.lastName}
              </h3>
              {pp.relationType && (
                <Badge className="text-[9px] bg-rose-50 text-rose-700 border-rose-200 font-bold uppercase py-0 px-1.5">
                  {pp.relationType}
                </Badge>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-0.5 truncate font-mono" title={user.email}>
              {user.email}
            </p>

            <div className="flex items-center gap-2 mt-2 flex-wrap text-xs">
              {pp.phone && (
                <a
                  href={`tel:${pp.phone}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded-md border border-rose-200 transition-colors font-mono"
                >
                  <PhoneCall className="w-3 h-3 text-rose-600" />
                  <span>{pp.phone}</span>
                </a>
              )}
              {pp.occupation && (
                <span className="text-[11px] text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {pp.occupation}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Credentials Bar (Admin Visibility) */}
        <div className="flex items-center justify-between bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/70 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-[10px] uppercase font-bold text-amber-900 tracking-wider shrink-0">Password:</span>
            <span className="font-mono font-bold text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-200/80 truncate">
              {showPassword ? pwd : "••••••••"}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={onToggleShowPassword}
              className="p-1 hover:bg-amber-100 rounded text-amber-800 transition-colors"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onCopy(pwd, "Password")}
              className="p-1 hover:bg-amber-100 rounded text-amber-800 transition-colors"
              title="Copy password"
            >
              {copiedText === pwd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Linked Talabat Children Showcase */}
        <div className="space-y-2 pt-1 border-t border-gray-100">
          <div className="flex items-center justify-between text-xs font-bold text-gray-700">
            <span className="flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5 text-rose-600" />
              Linked Talabat Students ({children.length})
            </span>
          </div>

          {children.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {children.map((link: any, idx: number) => {
                const child = link.student || {};
                const childUser = child.user || {};
                return (
                  <div
                    key={link.id || idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-rose-50/40 border border-rose-100/60 text-xs hover:bg-rose-50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="w-7 h-7 rounded-lg shrink-0 border border-rose-200">
                        {childUser.avatarUrl ? <AvatarImage src={childUser.avatarUrl} /> : null}
                        <AvatarFallback className="text-[10px] font-bold bg-rose-100 text-rose-800">
                          {getInitials(childUser.firstName || "", childUser.lastName || "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">
                          {childUser.firstName} {childUser.lastName}
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          ITS: {child.its || child.studentId}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#047857]">
                        Grade {child.grade || "?"}{child.section ? `-${child.section}` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-3 text-center border border-dashed border-gray-200">
              <p className="text-xs text-gray-400">No students linked to this parent account yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer Action Strip */}
      <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrintSlip}
            className="text-[11px] text-blue-700 hover:text-blue-900 font-bold hover:underline flex items-center gap-1"
            title="Generate Parent Login Pass Slip"
          >
            <QrCode className="w-3 h-3" /> Pass Slip
          </button>
          <span className="text-gray-300">•</span>
          <button
            onClick={onViewDetails}
            className="text-[11px] text-rose-700 hover:text-rose-900 font-bold hover:underline flex items-center gap-1"
          >
            <Info className="w-3 h-3" /> Details
          </button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {onResetPassword && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResetPassword(user)}
              className="h-7 px-2 text-xs text-amber-800 border-amber-200 hover:bg-rose-50"
              title="Reset Password"
            >
              <KeyRound className="w-3 h-3 mr-1 text-amber-600" /> Reset
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(user)}
            className="h-7 px-2 text-xs text-gray-700 border-gray-200 hover:bg-rose-50 hover:text-rose-700"
          >
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDeleteProfile(user.id)}
            className="h-7 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   CARD 4: ADMIN / GOVERNANCE CARD
   Slate-Indigo Shield Card for System Administration
   ══════════════════════════════════════════════════════════════════════ */
function AdminCard({
  user,
  showPassword,
  onToggleShowPassword,
  onEdit,
  onResetPassword,
  onDeleteProfile,
  onViewDetails,
  onCopy,
  copiedText,
}: any) {
  const pwd = user.plainPassword || "Burhani@2026";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className="group relative bg-white rounded-3xl border border-indigo-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col justify-between"
    >
      <div className="bg-gradient-to-r from-slate-900 to-indigo-900 px-5 py-2.5 text-white flex items-center justify-between text-xs font-bold">
        <div className="flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          <span>SYSTEM GOVERNANCE</span>
        </div>
        <span className="bg-indigo-500/30 px-2 py-0.5 rounded-full text-[10px] font-bold text-indigo-200">
          ADMINISTRATOR
        </span>
      </div>

      <div className="p-5 space-y-4 flex-1">
        <div className="flex items-start gap-4">
          <Avatar className="w-14 h-14 rounded-2xl border-2 border-indigo-200 shadow-sm">
            {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.firstName} /> : null}
            <AvatarFallback className="bg-indigo-900 text-white font-bold text-base">
              {getInitials(user.firstName, user.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold text-gray-900 text-base truncate">
              {user.firstName} {user.lastName}
            </h3>
            <p className="text-xs text-gray-500 truncate mt-0.5 font-mono">{user.email}</p>
            <span className="inline-block mt-2 px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md border border-indigo-200">
              Full Institutional Governance
            </span>
          </div>
        </div>

        {/* Credentials Bar */}
        <div className="flex items-center justify-between bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/70 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="text-[10px] uppercase font-bold text-amber-900 tracking-wider shrink-0">Password:</span>
            <span className="font-mono font-bold text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-200/80 truncate">
              {showPassword ? pwd : "••••••••"}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={onToggleShowPassword}
              className="p-1 hover:bg-amber-100 rounded text-amber-800 transition-colors"
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onCopy(pwd, "Password")}
              className="p-1 hover:bg-amber-100 rounded text-amber-800 transition-colors"
              title="Copy password"
            >
              {copiedText === pwd ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={onViewDetails}
          className="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold hover:underline flex items-center gap-1"
        >
          <Info className="w-3 h-3" /> View Details
        </button>
        <div className="flex items-center gap-1.5">
          {onResetPassword && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onResetPassword(user)}
              className="h-7 px-2 text-xs text-amber-800 border-amber-200 hover:bg-amber-50"
              title="Reset Password"
            >
              <KeyRound className="w-3 h-3 mr-1 text-amber-600" /> Reset
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(user)}
            className="h-7 px-2.5 text-xs text-gray-700 border-gray-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            <Pencil className="w-3 h-3 mr-1" /> Edit
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
