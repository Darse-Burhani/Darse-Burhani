"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  KeyRound,
  Search,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Download,
  Printer,
  Shield,
  GraduationCap,
  BookOpen,
  Heart,
  Users,
  Sparkles,
  Loader2,
  X,
  Filter,
  Layers,
  QrCode,
  Share2,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalFooter, ModalClose } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

export default function AdminPasswordsPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [gradeFilter, setGradeFilter] = useState("ALL");
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Reset Password Modal
  const [resetModalUser, setResetModalUser] = useState<any | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Printable Slip Modal
  const [slipUser, setSlipUser] = useState<any | null>(null);

  // Quick Add Member Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createRole, setCreateRole] = useState("STUDENT");
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    its: "",
    grade: "1",
    section: "A",
    employeeId: "",
    department: "Attalimiyah",
    phone: "",
    relationType: "Father",
  });
  const [creating, setCreating] = useState(false);

  // Load all users from API
  const loadUsers = useCallback(async () => {
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
    } catch (err) {
      console.error("Failed to load users:", err);
      toast({ variant: "destructive", title: "Error", description: "Failed to load user credentials." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Counts for pills
  const counts = useMemo(() => {
    const res = { ALL: users.length, STUDENT: 0, TEACHER: 0, PARENT: 0, ADMIN: 0 };
    for (const u of users) {
      if (res[u.role as keyof typeof res] !== undefined) {
        res[u.role as keyof typeof res]++;
      }
    }
    return res;
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      const matchRole = roleFilter === "ALL" || u.role === roleFilter;
      if (!matchRole) return false;

      if (roleFilter === "STUDENT" && gradeFilter !== "ALL") {
        if (u.studentProfile?.grade !== gradeFilter) return false;
      }

      if (!q) return true;

      const baseText = `${u.firstName} ${u.lastName} ${u.email} ${u.role}`.toLowerCase();
      if (baseText.includes(q)) return true;

      if (u.studentProfile) {
        const sp = u.studentProfile;
        if (sp.its?.toLowerCase().includes(q)) return true;
        if (sp.studentId?.toLowerCase().includes(q)) return true;
        if (sp.trNo?.toLowerCase().includes(q)) return true;
        if (`${sp.grade}${sp.section}`.toLowerCase().includes(q)) return true;
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
            `${l.student?.user?.firstName} ${l.student?.user?.lastName} ${l.student?.its}`
              .toLowerCase()
              .includes(q)
          )
        ) {
          return true;
        }
      }

      return false;
    });
  }, [users, roleFilter, gradeFilter, search]);

  const togglePassword = (id: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAllPasswords = () => {
    const nextState = !showAllPasswords;
    setShowAllPasswords(nextState);
    const newMap: Record<string, boolean> = {};
    for (const u of users) {
      newMap[u.id] = nextState;
    }
    setShowPasswordMap(newMap);
  };

  const copyToClipboard = (text: string, keyIdentifier: string, label?: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyIdentifier);
    toast({
      title: "Copied to Clipboard",
      description: label ? `${label}: ${text}` : text,
      variant: "default",
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const copyAllFilteredCredentials = () => {
    if (filteredUsers.length === 0) return;
    let output = `=== DARSE BURHANI CREDENTIALS LIST (${filteredUsers.length} Users) ===\n\n`;
    filteredUsers.forEach((u, i) => {
      const pwd = u.plainPassword || "Burhani@2026";
      const identifier =
        u.studentProfile?.its ||
        u.teacherProfile?.its ||
        u.teacherProfile?.employeeId ||
        u.parentProfile?.phone ||
        u.email;
      output += `${i + 1}. ${u.firstName} ${u.lastName} [${u.role}]\n   Email: ${u.email}\n   ITS / ID: ${identifier}\n   Password: ${pwd}\n\n`;
    });
    output += `Login Portal: ${window.location.origin}/login\n=================================================`;

    navigator.clipboard.writeText(output);
    setCopiedKey("copy-all");
    toast({
      title: "All Credentials Copied",
      description: `Copied login credentials for all ${filteredUsers.length} filtered users.`,
      variant: "success",
    });
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const copyFullLoginPackage = (u: any) => {
    const pwd = u.plainPassword || "Burhani@2026";
    const identifier =
      u.studentProfile?.its ||
      u.teacherProfile?.its ||
      u.teacherProfile?.employeeId ||
      u.parentProfile?.phone ||
      u.email;

    const pack = `=== DARSE BURHANI LOGIN CREDENTIALS ===\nName: ${u.firstName} ${u.lastName}\nRole: ${u.role}\nEmail: ${u.email}\nITS / ID: ${identifier}\nPassword: ${pwd}\nLogin URL: ${window.location.origin}/login\n======================================`;

    navigator.clipboard.writeText(pack);
    setCopiedKey(`pack-${u.id}`);
    toast({
      title: "Credential Package Copied",
      description: `Full login details for ${u.firstName} ${u.lastName} copied.`,
      variant: "success",
    });
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pass = "Burhani@";
    for (let i = 0; i < 4; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setResetPassword(pass);
  };

  const openResetModal = (user: any) => {
    setResetModalUser(user);
    generateRandomPassword();
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser || !resetPassword.trim()) return;

    if (resetPassword.length < 6) {
      toast({
        variant: "warning",
        title: "Password Too Short",
        description: "Password must be at least 6 characters long.",
      });
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
          title: "Password Reset Successfully",
          description: `Password for ${resetModalUser.firstName} ${resetModalUser.lastName} is now: ${resetPassword}`,
        });
        setUsers((prev) =>
          prev.map((u) => (u.id === resetModalUser.id ? { ...u, plainPassword: resetPassword } : u))
        );
        setResetModalUser(null);
      } else {
        toast({
          variant: "destructive",
          title: "Reset Failed",
          description: data.error || "Could not reset password.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Network Error",
        description: "Failed to communicate with server.",
      });
    } finally {
      setResettingPassword(false);
    }
  };

  // CSV Export
  const exportToCSV = () => {
    if (filteredUsers.length === 0) {
      toast({ variant: "warning", title: "No Data", description: "No records to export." });
      return;
    }

    const headers = [
      "Role",
      "Full Name",
      "Email",
      "ITS / Employee ID",
      "Password",
      "Status",
      "Details / Grade / Mauze",
    ];

    const rows = filteredUsers.map((u) => {
      const pwd = u.plainPassword || "Burhani@2026";
      const its =
        u.studentProfile?.its ||
        u.teacherProfile?.its ||
        u.teacherProfile?.employeeId ||
        u.parentProfile?.its ||
        "";
      const details =
        u.role === "STUDENT"
          ? `Grade ${u.studentProfile?.grade || ""}${u.studentProfile?.section || ""}`
          : u.role === "TEACHER"
          ? `${u.teacherProfile?.department || ""} - ${u.teacherProfile?.khidmatMauze || ""}`
          : u.role === "PARENT"
          ? `${u.parentProfile?.studentLinks?.length || 0} Linked Children`
          : "System Admin";

      return [
        `"${u.role}"`,
        `"${u.firstName} ${u.lastName}"`,
        `"${u.email}"`,
        `"${its}"`,
        `"${pwd}"`,
        `"${u.isActive ? "Active" : "Inactive"}"`,
        `"${details}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Darse_Burhani_User_Passwords_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      variant: "success",
      title: "Export Successful",
      description: `Exported ${filteredUsers.length} user credentials to CSV.`,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Quick Create Member
  const handleQuickCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.firstName || !createForm.lastName || !createForm.email || !createForm.password) {
      toast({ variant: "destructive", title: "Missing Fields", description: "All marked fields are required." });
      return;
    }

    setCreating(true);
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
          variant: "success",
          title: "Account Created",
          description: `${createForm.firstName} ${createForm.lastName} has been created with initial password.`,
        });
        setShowCreateModal(false);
        setCreateForm({
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          its: "",
          grade: "1",
          section: "A",
          employeeId: "",
          department: "Attalimiyah",
          phone: "",
          relationType: "Father",
        });
        await loadUsers();
      } else {
        toast({
          variant: "destructive",
          title: "Creation Failed",
          description: data.error || "Failed to create user account.",
        });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Failed to connect to server." });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* People & Directory Hub Navigation Tabs */}
      <AdminHubTabs
        hubTitle="People & Directory"
        hubDescription="Manage user accounts, passwords vault, student profiles, parent directory, and portal permissions."
        tabs={[
          { label: "All Accounts", href: "/admin/users", icon: Users },
          { label: "User Passwords Vault", href: "/admin/passwords", icon: KeyRound },
          { label: "Talabat (Students)", href: "/admin/students", icon: GraduationCap },
          { label: "Parents Directory", href: "/admin/parents", icon: Heart },
          { label: "Portal Roles & Permissions", href: "/admin/portal-assignments", icon: Layers },
        ]}
      />

      {/* Header Banner */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <div className="fatimi-header-banner relative overflow-hidden rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-[#1c1917] via-[#292524] to-[#1c1917] shadow-2xl border border-amber-500/30 text-white">
          <div className="absolute top-0 right-0 w-64 h-64 opacity-10 pointer-events-none">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#d4af37" strokeWidth="2" strokeDasharray="4 2" />
              <polygon points="50,15 80,75 20,75" fill="none" stroke="#d4af37" strokeWidth="2" />
            </svg>
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-700 shadow-xl border border-amber-300/40 shrink-0">
                <KeyRound className="w-8 h-8 text-white" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold mb-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Administrative Credential Vault</span>
                </div>
                <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight">
                  User Passwords &amp; Logins
                </h1>
                <p className="text-gray-300 text-sm mt-1 max-w-2xl">
                  Centralized vault to view, search, reveal, copy, reset, and export user login credentials across Talabat, Faculty, Parents, and Administrators.
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                onClick={toggleAllPasswords}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold text-xs h-10 px-3.5 rounded-xl transition-all"
              >
                {showAllPasswords ? (
                  <>
                    <EyeOff className="w-4 h-4 mr-1.5 text-amber-400" /> Hide All
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4 mr-1.5 text-amber-300" /> Reveal All
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={copyAllFilteredCredentials}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold text-xs h-10 px-3.5 rounded-xl transition-all"
                title="Copy all credentials currently displayed on screen"
              >
                {copiedKey === "copy-all" ? (
                  <>
                    <Check className="w-4 h-4 mr-1.5 text-emerald-400" /> Copied All
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 mr-1.5 text-amber-300" /> Copy All
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={exportToCSV}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold text-xs h-10 px-3.5 rounded-xl transition-all"
              >
                <Download className="w-4 h-4 mr-1.5 text-emerald-400" /> Export CSV
              </Button>

              <Button
                variant="outline"
                onClick={handlePrint}
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-semibold text-xs h-10 px-3.5 rounded-xl transition-all"
              >
                <Printer className="w-4 h-4 mr-1.5 text-blue-400" /> Print
              </Button>

              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-lg shadow-amber-900/30 border border-amber-400/40 transition-all"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add User
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-white border border-gray-200 shadow-sm rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Accounts</span>
            <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-extrabold text-2xl text-gray-900 mt-2">{counts.ALL}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">Active in system</p>
        </Card>

        <Card className="bg-white border border-emerald-100/80 shadow-sm rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Talabat (Students)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-extrabold text-2xl text-emerald-950 mt-2">{counts.STUDENT}</p>
          <p className="text-[11px] text-emerald-600/80 mt-0.5">Student credentials</p>
        </Card>

        <Card className="bg-white border border-amber-100/80 shadow-sm rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Faculty (Teachers)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-extrabold text-2xl text-amber-950 mt-2">{counts.TEACHER}</p>
          <p className="text-[11px] text-amber-600/80 mt-0.5">Faculty credentials</p>
        </Card>

        <Card className="bg-white border border-rose-100/80 shadow-sm rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Parents &amp; Guardians</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center">
              <Heart className="w-4 h-4" />
            </div>
          </div>
          <p className="font-display font-extrabold text-2xl text-rose-950 mt-2">{counts.PARENT}</p>
          <p className="text-[11px] text-rose-600/80 mt-0.5">Family portal logins</p>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-1 flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              id="search-passwords"
              name="search-passwords"
              placeholder="Search by Name, Email, ITS, Role, Grade, Phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50/50 text-sm placeholder:text-gray-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition-all font-medium"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Role Filters */}
          <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 p-1 rounded-xl border border-gray-200">
            {[
              { id: "ALL", label: "All Users", count: counts.ALL, icon: Users },
              { id: "STUDENT", label: "Talabat", count: counts.STUDENT, icon: GraduationCap },
              { id: "TEACHER", label: "Faculty", count: counts.TEACHER, icon: BookOpen },
              { id: "PARENT", label: "Parents", count: counts.PARENT, icon: Heart },
              { id: "ADMIN", label: "Admins", count: counts.ADMIN, icon: Shield },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = roleFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setRoleFilter(tab.id);
                    setGradeFilter("ALL");
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                      : "text-gray-600 hover:text-gray-900 hover:bg-white/50"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-amber-600" : "text-gray-400"}`} />
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive ? "bg-amber-100 text-amber-800" : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Optional Grade Sub-Filter for Talabat */}
          {roleFilter === "STUDENT" && (
            <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
              <span className="text-[11px] font-bold text-emerald-900">Grade:</span>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-emerald-950 outline-none"
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

        <div className="text-xs text-gray-500 font-medium">
          Showing <span className="font-bold text-gray-900">{filteredUsers.length}</span> of {users.length} credentials
        </div>
      </div>

      {/* Main Credentials Table */}
      {loading ? (
        <div className="bg-white rounded-3xl border border-gray-200 p-12 text-center shadow-sm">
          <Loader2 className="w-8 h-8 text-amber-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-600 font-medium text-sm">Loading credential vault...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-12 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-8 h-8 opacity-60" />
          </div>
          <h3 className="font-display font-bold text-gray-900 text-lg">No Credentials Found</h3>
          <p className="text-gray-500 text-sm mt-1">
            No user matching &quot;{search}&quot; found in category &quot;{roleFilter}&quot;.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setRoleFilter("ALL");
              setGradeFilter("ALL");
            }}
            className="mt-4 border-amber-200 text-amber-800 hover:bg-amber-50"
          >
            Reset Filters
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50/80 text-gray-900 font-bold border-b border-gray-200">
                <tr>
                  <th className="p-4">User Details</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">ITS / Key Identifier</th>
                  <th className="p-4">Login Password</th>
                  <th className="p-4">Portal Link</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((u) => {
                  const isVisible = Boolean(showPasswordMap[u.id]);
                  const pwd = u.plainPassword || "Burhani@2026";
                  const its =
                    u.studentProfile?.its ||
                    u.teacherProfile?.its ||
                    u.teacherProfile?.employeeId ||
                    u.parentProfile?.phone ||
                    "";

                  const roleBadgeClass =
                    u.role === "STUDENT"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                      : u.role === "TEACHER"
                      ? "bg-amber-100 text-amber-800 border-amber-200"
                      : u.role === "PARENT"
                      ? "bg-rose-100 text-rose-800 border-rose-200"
                      : "bg-indigo-100 text-indigo-800 border-indigo-200";

                  const portalUrl =
                    u.role === "STUDENT"
                      ? "/talabat"
                      : u.role === "TEACHER"
                      ? "/teacher"
                      : u.role === "PARENT"
                      ? "/parent"
                      : "/admin";

                  return (
                    <tr key={u.id} className="hover:bg-amber-50/20 transition-colors">
                      {/* User Portrait & Email */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10 border border-gray-200 rounded-xl shadow-xs shrink-0">
                            {u.avatarUrl ? <AvatarImage src={u.avatarUrl} alt={u.firstName} /> : null}
                            <AvatarFallback className="bg-gradient-to-br from-amber-500 to-amber-700 text-white font-bold text-xs rounded-xl">
                              {getInitials(u.firstName, u.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 leading-snug truncate">
                              {u.firstName} {u.lastName}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-xs text-gray-500 truncate max-w-[180px] font-mono" title={u.email}>
                                {u.email}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(u.email, `email-${u.id}`, "Email")}
                                className="p-0.5 text-gray-400 hover:text-gray-700 rounded transition-colors"
                                title="Copy Email"
                              >
                                {copiedKey === `email-${u.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="p-4">
                        <Badge className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 border ${roleBadgeClass}`}>
                          {u.role === "STUDENT" ? "TALABAT" : u.role}
                        </Badge>
                      </td>

                      {/* ITS Identifier */}
                      <td className="p-4">
                        {its ? (
                          <div className="inline-flex items-center gap-1.5 bg-gray-100 px-2 py-1 rounded-lg border border-gray-200 text-xs font-mono font-bold text-gray-800">
                            <span>{its}</span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(its, `its-${u.id}`, "ITS")}
                              className="text-gray-400 hover:text-gray-700"
                              title="Copy ITS"
                            >
                              {copiedKey === `its-${u.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 font-mono">—</span>
                        )}
                      </td>

                      {/* Login Password */}
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`flex items-center px-2.5 py-1 rounded-lg font-mono text-xs font-bold border transition-all ${
                              isVisible
                                ? "bg-amber-50 border-amber-300 text-amber-950 ring-2 ring-amber-100"
                                : "bg-gray-100 border-gray-200 text-gray-600"
                            }`}
                          >
                            <span>{isVisible ? pwd : "••••••••"}</span>
                          </div>

                          {/* Reveal/Hide */}
                          <button
                            type="button"
                            onClick={() => togglePassword(u.id)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors"
                            title={isVisible ? "Hide Password" : "Show Password"}
                          >
                            {isVisible ? (
                              <EyeOff className="w-3.5 h-3.5 text-amber-700" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Copy Password */}
                          <button
                            type="button"
                            onClick={() => copyToClipboard(pwd, `pwd-${u.id}`, "Password")}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-800 transition-colors"
                            title="Copy Password"
                          >
                            {copiedKey === `pwd-${u.id}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Portal Link */}
                      <td className="p-4 text-xs">
                        <span className="font-mono text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {portalUrl}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSlipUser(u)}
                            className="h-8 px-2 text-xs text-blue-800 border-blue-200 hover:bg-blue-50"
                            title="Printable ID Login Slip"
                          >
                            <QrCode className="w-3 h-3 mr-1 text-blue-600" /> Pass Slip
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyFullLoginPackage(u)}
                            className="h-8 px-2 text-xs text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                            title="Copy Full Login Instructions Package"
                          >
                            {copiedKey === `pack-${u.id}` ? (
                              <>
                                <Check className="w-3 h-3 mr-1 text-emerald-600" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 mr-1" /> Copy Pack
                              </>
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResetModal(u)}
                            className="h-8 px-2 text-xs text-amber-800 border-amber-200 hover:bg-amber-50"
                            title="Reset User Password"
                          >
                            <RefreshCw className="w-3 h-3 mr-1 text-amber-600" /> Reset
                          </Button>
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

      {/* Printable Login Pass Slip Modal */}
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

      {/* Reset Password Modal */}
      <Modal open={!!resetModalUser} onOpenChange={() => setResetModalUser(null)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md">
                <KeyRound className="w-4 h-4 text-white" />
              </div>
              Reset User Password
            </ModalTitle>
          </ModalHeader>
          {resetModalUser && (
            <form onSubmit={handleResetPassword} className="space-y-4 py-2">
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-gray-900 text-sm">
                    {resetModalUser.firstName} {resetModalUser.lastName}
                  </p>
                  <Badge className="text-[10px] bg-white text-amber-800 border-amber-300 font-bold">
                    {resetModalUser.role}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 font-mono">{resetModalUser.email}</p>
                <div className="pt-1 flex items-center gap-2 text-[11px] text-amber-900 font-semibold">
                  <span>Current Password:</span>
                  <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-amber-200">
                    {resetModalUser.plainPassword || "Burhani@2026"}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="new-pass-input" className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                    New Password *
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomPassword}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 flex items-center gap-1 hover:underline"
                  >
                    <RefreshCw className="w-3 h-3" /> Generate Random
                  </button>
                </div>
                <input
                  id="new-pass-input"
                  name="newPassword"
                  type="text"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono font-bold text-gray-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none transition-all"
                  required
                  minLength={6}
                />
              </div>

              <div className="rounded-xl bg-gray-50 p-3 border border-gray-200 text-xs text-gray-500 space-y-1">
                <p className="font-bold text-gray-700 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-amber-600" /> Security Impact:
                </p>
                <p>
                  Confirming this change updates the bcrypt hash, updates plain password memory for administrative distribution, and invalidates all existing user login sessions.
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
                  Confirm Password Reset
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>

      {/* Quick Add User Modal */}
      <Modal open={showCreateModal} onOpenChange={setShowCreateModal}>
        <ModalContent className="max-w-xl">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-md">
                <Plus className="w-4 h-4 text-white" />
              </div>
              Create User with Login Credentials
            </ModalTitle>
          </ModalHeader>
          <form onSubmit={handleQuickCreate} className="space-y-4 py-2">
            {/* Role Switcher */}
            <div>
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block mb-1">
                Account Role *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "STUDENT", label: "Talabat", icon: GraduationCap },
                  { id: "TEACHER", label: "Faculty", icon: BookOpen },
                  { id: "PARENT", label: "Parent", icon: Heart },
                  { id: "ADMIN", label: "Admin", icon: Shield },
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
                          ? "bg-amber-50 border-amber-400 text-amber-950 shadow-xs"
                          : "border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className={`w-4 h-4 mb-1 ${isSel ? "text-amber-600" : "text-gray-400"}`} />
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
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-amber-500 outline-none"
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
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-amber-500 outline-none"
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
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:border-amber-500 outline-none"
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
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm font-mono focus:border-amber-500 outline-none"
                  placeholder="e.g. Burhani@2026"
                />
              </div>
            </div>

            {/* Role Specific Fields */}
            {createRole === "STUDENT" && (
              <div className="grid grid-cols-3 gap-3 p-3 rounded-xl bg-emerald-50/50 border border-emerald-100">
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
              </div>
            )}

            {createRole === "TEACHER" && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-amber-50/50 border border-amber-100">
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
            )}

            {createRole === "PARENT" && (
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-rose-50/50 border border-rose-100">
                <div>
                  <label className="text-xs font-medium text-rose-950">Contact Phone</label>
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
                disabled={creating}
                className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold gap-1.5 shadow-md"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Member &amp; Login
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}
