"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Search,
  Mail,
  Loader2,
  Pencil,
  Link2,
  Save,
  X,
  Users,
  Heart,
  UserCheck,
  GraduationCap,
  RefreshCw,
  Copy,
  Check,
  Phone,
  Trash2,
  UserPlus,
  AlertTriangle,
  Camera,
  MapPin,
  Briefcase,
  Droplet,
  Plus,
  Home,
  MessageSquare,
  Key,
  Lock,
  Sparkles,
  Eye,
  EyeOff,
  KeyRound,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LinkedStudent {
  linkId?: string;
  studentId: string;
  studentName: string;
  grade: string;
  section: string;
  avatarUrl?: string | null;
  relationship?: string | null;
}

interface ParentData {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  plainPassword?: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  phone: string | null;
  secondaryPhone: string | null;
  occupation: string | null;
  address: string | null;
  city: string | null;
  watan: string | null;
  bloodGroup: string | null;
  its: string | null;
  relationType: string | null;
  notes: string | null;
  children: LinkedStudent[];
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATION_TYPES = ["Father", "Mother", "Guardian", "Grandparent", "Uncle", "Aunt", "Other"];

export default function AdminParentsPage() {
  const [parents, setParents] = useState<ParentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedPasswordId, setCopiedPasswordId] = useState<string | null>(null);
  const [showPasswordMap, setShowPasswordMap] = useState<Record<string, boolean>>({});

  const toggleShowPassword = (userId: string) => {
    setShowPasswordMap((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const handleCopyPassword = (pwd: string, userId: string) => {
    navigator.clipboard.writeText(pwd);
    setCopiedPasswordId(userId);
    toast({ variant: "default", title: "Copied", description: "Password copied to clipboard." });
    setTimeout(() => setCopiedPasswordId(null), 2000);
  };

  // Edit profile state
  const [editingParent, setEditingParent] = useState<ParentData | null>(null);
  const [editForm, setEditForm] = useState<Partial<ParentData>>({});
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset password state
  const [resetPasswordParent, setResetPasswordParent] = useState<ParentData | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  // Create new parent state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phone: "",
    secondaryPhone: "",
    occupation: "",
    address: "",
    city: "",
    watan: "",
    bloodGroup: "",
    its: "",
    relationType: "Father",
    notes: "",
  });
  const [creating, setCreating] = useState(false);

  // Delete modal state
  const [deletingParent, setDeletingParent] = useState<ParentData | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchParents = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch("/api/admin/parents");
      const data = await res.json();
      if (data.success) {
        setParents(data.data || []);
        if (isManual) {
          toast({ variant: "success", title: "Refreshed", description: "Parents list updated." });
        }
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to fetch parents." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not connect to server." });
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchParents();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return parents;
    return parents.filter((p) => {
      const matchName = `${p.firstName} ${p.lastName}`.toLowerCase().includes(q);
      const matchEmail = p.email.toLowerCase().includes(q);
      const matchPhone = p.phone ? p.phone.toLowerCase().includes(q) : false;
      const matchSecPhone = p.secondaryPhone ? p.secondaryPhone.toLowerCase().includes(q) : false;
      const matchIts = p.its ? p.its.toLowerCase().includes(q) : false;
      const matchOccupation = p.occupation ? p.occupation.toLowerCase().includes(q) : false;
      const matchAddress = p.address ? p.address.toLowerCase().includes(q) : false;
      const matchCity = p.city ? p.city.toLowerCase().includes(q) : false;
      const matchWatan = p.watan ? p.watan.toLowerCase().includes(q) : false;
      const matchBlood = p.bloodGroup ? p.bloodGroup.toLowerCase().includes(q) : false;
      const matchChildren = p.children?.some((c) =>
        `${c.studentName} ${c.grade} ${c.section}`.toLowerCase().includes(q)
      );
      return (
        matchName ||
        matchEmail ||
        matchPhone ||
        matchSecPhone ||
        matchIts ||
        matchOccupation ||
        matchAddress ||
        matchCity ||
        matchWatan ||
        matchBlood ||
        matchChildren
      );
    });
  }, [parents, search]);

  const handleCopyEmail = (email: string, id: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    toast({ variant: "default", title: "Copied to Clipboard", description: email });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openEditModal = (parent: ParentData) => {
    setEditingParent(parent);
    setEditForm({
      firstName: parent.firstName,
      lastName: parent.lastName,
      email: parent.email,
      phone: parent.phone || "",
      secondaryPhone: parent.secondaryPhone || "",
      occupation: parent.occupation || "",
      address: parent.address || "",
      city: parent.city || "",
      watan: parent.watan || "",
      bloodGroup: parent.bloodGroup || "",
      its: parent.its || "",
      relationType: parent.relationType || "Father",
      notes: parent.notes || "",
      avatarUrl: parent.avatarUrl,
    });
  };

  const openResetPasswordModal = (parent: ParentData) => {
    setResetPasswordParent(parent);
    setNewPassword("Burhani@" + Math.floor(1000 + Math.random() * 9000));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingParent) return;

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`/api/admin/parents/${editingParent.userId}/avatar`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setEditForm((prev) => ({ ...prev, avatarUrl: data.url }));
        setParents((prev) =>
          prev.map((p) => (p.userId === editingParent.userId ? { ...p, avatarUrl: data.url } : p))
        );
        toast({ variant: "success", title: "Photo Uploaded", description: "Parent profile image updated." });
      } else {
        toast({ variant: "destructive", title: "Upload Failed", description: data.error || "Could not upload image." });
      }
    } catch {
      toast({ variant: "destructive", title: "Upload Error", description: "Network error during avatar upload." });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editingParent || !editForm.email?.trim() || !editForm.firstName?.trim() || !editForm.lastName?.trim()) {
      toast({ variant: "warning", title: "Required Fields", description: "First name, last name, and email are required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/parents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingParent.userId,
          email: editForm.email.trim(),
          firstName: editForm.firstName.trim(),
          lastName: editForm.lastName.trim(),
          phone: editForm.phone,
          secondaryPhone: editForm.secondaryPhone,
          occupation: editForm.occupation,
          address: editForm.address,
          city: editForm.city,
          watan: editForm.watan,
          bloodGroup: editForm.bloodGroup,
          its: editForm.its,
          relationType: editForm.relationType,
          notes: editForm.notes,
          avatarUrl: editForm.avatarUrl,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setParents((prev) =>
          prev.map((p) =>
            p.userId === editingParent.userId
              ? {
                  ...p,
                  email: editForm.email!.trim(),
                  firstName: editForm.firstName!.trim(),
                  lastName: editForm.lastName!.trim(),
                  phone: editForm.phone || null,
                  secondaryPhone: editForm.secondaryPhone || null,
                  occupation: editForm.occupation || null,
                  address: editForm.address || null,
                  city: editForm.city || null,
                  watan: editForm.watan || null,
                  bloodGroup: editForm.bloodGroup || null,
                  its: editForm.its || null,
                  relationType: editForm.relationType || null,
                  notes: editForm.notes || null,
                  avatarUrl: editForm.avatarUrl || null,
                }
              : p
          )
        );
        toast({
          variant: "success",
          title: "Profile Updated",
          description: `Updated profile details for ${editForm.firstName} ${editForm.lastName}.`,
        });
        setEditingParent(null);
      } else {
        toast({ variant: "destructive", title: "Update Failed", description: data.error || "Failed to update profile." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Failed to update parent profile." });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordParent || !newPassword.trim()) {
      toast({ variant: "warning", title: "Password Required", description: "Please enter a new password." });
      return;
    }
    if (newPassword.trim().length < 6) {
      toast({ variant: "warning", title: "Too Short", description: "Password must be at least 6 characters." });
      return;
    }

    setResettingPassword(true);
    try {
      const res = await fetch("/api/admin/parents/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resetPasswordParent.userId,
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          variant: "success",
          title: "Password Reset Successfully",
          description: `Password for ${resetPasswordParent.firstName} has been updated. Old sessions terminated.`,
        });
        setResetPasswordParent(null);
        setNewPassword("");
      } else {
        toast({ variant: "destructive", title: "Reset Failed", description: data.error || "Failed to reset password." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not connect to server." });
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCreateParent = async () => {
    if (!createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.email.trim()) {
      toast({ variant: "warning", title: "Required Fields", description: "First name, last name, and email are required." });
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/parents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          variant: "success",
          title: "Parent Created",
          description: `Account created for ${createForm.firstName} ${createForm.lastName}.`,
        });
        setShowCreateModal(false);
        setCreateForm({
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          phone: "",
          secondaryPhone: "",
          occupation: "",
          address: "",
          city: "",
          watan: "",
          bloodGroup: "",
          its: "",
          relationType: "Father",
          notes: "",
        });
        await fetchParents();
      } else {
        toast({ variant: "destructive", title: "Creation Failed", description: data.error || "Failed to create parent account." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Failed to create parent account." });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteParent = async () => {
    if (!deletingParent) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/parents?id=${deletingParent.id}&userId=${deletingParent.userId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setParents((prev) => prev.filter((p) => p.id !== deletingParent.id && p.userId !== deletingParent.userId));
        toast({
          variant: "success",
          title: "Parent Profile Deleted",
          description: `Deleted profile for ${deletingParent.firstName} ${deletingParent.lastName}.`,
        });
        setDeletingParent(null);
      } else {
        toast({ variant: "destructive", title: "Delete Failed", description: data.error || "Failed to delete parent profile." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Failed to delete parent profile." });
    } finally {
      setDeleting(false);
    }
  };

  const totalLinkedStudents = parents.reduce((acc, p) => acc + (p.children?.length || 0), 0);
  const unlinkedParentsCount = parents.filter((p) => !p.children || p.children.length === 0).length;
  const withBloodGroupCount = parents.filter((p) => !!p.bloodGroup).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* People & Directory Hub Navigation Tabs */}
      <AdminHubTabs
        hubTitle="People & Directory"
        hubDescription="Manage user accounts, student profiles, parent directory, and portal permissions."
        tabs={[
          { label: "All Accounts", href: "/admin/users", icon: Users },
          { label: "User Passwords Vault", href: "/admin/passwords", icon: KeyRound },
          { label: "Talabat (Students)", href: "/admin/students", icon: GraduationCap },
          { label: "Parents Directory", href: "/admin/parents", icon: Heart },
          { label: "Assign Talabat to Parent", href: "/admin/parents/assign", icon: Link2 },
          { label: "Portal Roles & Permissions", href: "/admin/portal-assignments", icon: UserCheck },
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
                <Heart className="w-7 h-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    Parent Directory &amp; Profiles
                  </h1>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 border-0 text-xs text-white font-semibold">
                    {parents.length} Registered
                  </span>
                </div>
                <p className="text-emerald-100 text-sm mt-1">
                  Manage parent profiles: photos, ITS ID, blood groups, addresses, occupations, password reset, and linked talabat.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-[#d4af37] hover:bg-[#b8972e] text-gray-950 font-bold shadow-md gap-1.5"
              >
                <Plus className="w-4 h-4" /> Add Parent
              </Button>
              <Link href="/admin/parents/assign">
                <Button
                  size="sm"
                  className="bg-white/20 hover:bg-white/30 text-white font-bold border border-white/30 shadow-sm gap-1.5"
                >
                  <UserPlus className="w-4 h-4" /> Assign Talabat
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 shadow-sm"
                onClick={() => fetchParents(true)}
                disabled={refreshing || loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </div>
          </div>
          {/* Gold hairline at bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-80" />
        </div>
      </motion.div>

      {/* Stats Overview Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-rose-100 rounded-xl p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-none">{parents.length}</p>
            <p className="text-xs text-gray-500 mt-1">Registered Parents</p>
          </div>
        </div>
        <div className="bg-white border border-emerald-100 rounded-xl p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-[#047857] shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-none">{totalLinkedStudents}</p>
            <p className="text-xs text-gray-500 mt-1">Linked Talabat</p>
          </div>
        </div>
        <div className="bg-white border border-red-100 rounded-xl p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600 shrink-0">
            <Droplet className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-none">{withBloodGroupCount}</p>
            <p className="text-xs text-gray-500 mt-1">Blood Groups Logged</p>
          </div>
        </div>
        <div className="bg-white border border-amber-100 rounded-xl p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-none">{unlinkedParentsCount}</p>
            <p className="text-xs text-gray-500 mt-1">Pending Linkage</p>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="mb-6">
        <div className="relative max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c6b2d]" />
          <label htmlFor="search-parents" className="sr-only">
            Search parents
          </label>
          <input
            type="text"
            id="search-parents"
            name="search-parents"
            placeholder="Search by name, ITS ID, email, blood group, occupation, city, address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-[#d4af37]/35 bg-white text-sm focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/20 outline-none shadow-xs transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse p-5 rounded-2xl border border-gray-100 bg-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-48 h-5 bg-gray-200 rounded" />
                  <div className="w-64 h-4 bg-gray-200 rounded" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((parent) => (
            <motion.div key={parent.userId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="hover:shadow-md transition-shadow rounded-2xl border border-rose-100 bg-white overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                    {/* Left: Avatar + Profile Details */}
                    <div className="flex items-start gap-4 min-w-0 flex-1">
                      <Avatar className="w-16 h-16 rounded-2xl border-2 border-rose-200 ring-2 ring-rose-50 shrink-0 shadow-xs">
                        {parent.avatarUrl && <AvatarImage src={parent.avatarUrl} alt={parent.firstName} />}
                        <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-600 text-white font-bold text-lg">
                          {getInitials(parent.firstName, parent.lastName)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 flex-1 space-y-2">
                        {/* Name & Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-display font-bold text-gray-900 text-lg leading-snug">
                            {parent.firstName} {parent.lastName}
                          </h3>

                          {parent.relationType && (
                            <Badge className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 font-bold uppercase tracking-wider">
                              {parent.relationType}
                            </Badge>
                          )}

                          {parent.bloodGroup && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md font-mono">
                              <Droplet className="w-3 h-3 text-red-500 fill-red-500" />
                              {parent.bloodGroup}
                            </span>
                          )}

                          {parent.its && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-mono">
                              ITS: {parent.its}
                            </span>
                          )}

                          {parent.occupation && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 text-gray-700 px-2 py-0.5 rounded-md">
                              <Briefcase className="w-3 h-3 text-gray-500" />
                              {parent.occupation}
                            </span>
                          )}
                        </div>

                        {/* Contact & Location Info */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1.5 text-xs text-gray-600 pt-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="font-medium text-gray-800 truncate">{parent.email}</span>
                            <button
                              onClick={() => handleCopyEmail(parent.email, parent.userId)}
                              className="text-gray-400 hover:text-gray-700 p-0.5 rounded"
                              title="Copy email"
                            >
                              {copiedId === parent.userId ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {parent.phone && (
                            <div className="flex items-center gap-1.5 font-mono">
                              <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span>{parent.phone}</span>
                            </div>
                          )}

                          {parent.secondaryPhone && (
                            <div className="flex items-center gap-1.5 font-mono text-emerald-700">
                              <MessageSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span>{parent.secondaryPhone} (WhatsApp)</span>
                            </div>
                          )}

                          {(parent.city || parent.watan) && (
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>
                                {parent.city ? parent.city : ""}
                                {parent.city && parent.watan ? " · " : ""}
                                {parent.watan ? `Watan: ${parent.watan}` : ""}
                              </span>
                            </div>
                          )}

                          {parent.address && (
                            <div className="flex items-center gap-1.5 sm:col-span-2 text-gray-500 truncate" title={parent.address}>
                              <Home className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <span className="truncate">{parent.address}</span>
                            </div>
                          )}
                        </div>

                        {/* Admin Password View */}
                        <div className="flex items-center justify-between bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/70 text-xs">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Lock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="text-[10px] uppercase font-bold text-amber-900 tracking-wider shrink-0">Password:</span>
                            <span className="font-mono font-bold text-amber-950 bg-white px-2 py-0.5 rounded border border-amber-200/80 truncate">
                              {showPasswordMap[parent.userId] ? (parent.plainPassword || "Burhani@2026") : "••••••••"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <button
                              type="button"
                              onClick={() => toggleShowPassword(parent.userId)}
                              className="p-1 hover:bg-amber-100 rounded text-amber-800 transition-colors"
                              title={showPasswordMap[parent.userId] ? "Hide password" : "Show password"}
                            >
                              {showPasswordMap[parent.userId] ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyPassword(parent.plainPassword || "Burhani@2026", parent.userId)}
                              className="p-1 hover:bg-amber-100 rounded text-amber-800 transition-colors"
                              title="Copy password"
                            >
                              {copiedPasswordId === parent.userId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Linked Children Showcase */}
                        <div className="pt-2 border-t border-rose-50 flex items-center gap-2 flex-wrap">
                          <Link2 className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="text-xs font-semibold text-gray-700">Linked Children:</span>
                          {parent.children && parent.children.length > 0 ? (
                            parent.children.map((child) => (
                              <Badge
                                key={child.studentId}
                                variant="outline"
                                className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200 font-medium py-0.5 px-2 flex items-center gap-1.5"
                              >
                                {child.avatarUrl && (
                                  <Avatar className="w-4 h-4 rounded-full">
                                    <AvatarImage src={child.avatarUrl} />
                                    <AvatarFallback className="text-[8px]">ST</AvatarFallback>
                                  </Avatar>
                                )}
                                <span>{child.studentName}</span>
                                <span className="text-[10px] text-emerald-600 font-bold">
                                  (Grade {child.grade}{child.section})
                                </span>
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-gray-400 italic">No students linked yet</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex lg:flex-col items-center gap-2 shrink-0 self-end lg:self-center flex-wrap">
                      <Button
                        size="sm"
                        onClick={() => openEditModal(parent)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 h-8 px-3"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit Profile
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openResetPasswordModal(parent)}
                        className="border-amber-300 text-amber-900 bg-amber-50/70 hover:bg-amber-100 font-semibold text-xs gap-1.5 h-8 px-3"
                        title="Admin Reset Password"
                      >
                        <Key className="w-3.5 h-3.5 text-amber-600" />
                        Reset Password
                      </Button>

                      <Link href={`/admin/parents/assign?parentId=${parent.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-emerald-200 text-[#047857] hover:bg-emerald-50 font-semibold text-xs gap-1.5 h-8 px-3"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Assign Talabat
                        </Button>
                      </Link>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingParent(parent)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 font-medium text-xs gap-1.5 h-8 px-2.5"
                        title="Delete parent profile"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <Card className="border-dashed border-gray-300 bg-gray-50/50">
              <CardContent className="p-12 text-center text-gray-500">
                <Heart className="w-10 h-10 mx-auto mb-2 text-gray-400" />
                <p className="font-semibold text-gray-700">No parents found</p>
                {search && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setSearch("")}>
                    Clear Search
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Edit Parent Profile Modal ── */}
      <Modal open={!!editingParent} onOpenChange={() => setEditingParent(null)}>
        <ModalContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle className="text-gray-900 font-bold flex items-center gap-2">
              <Pencil className="w-5 h-5 text-emerald-700" />
              Edit Parent Profile
            </ModalTitle>
          </ModalHeader>

          {editingParent && (
            <div className="space-y-6 py-2">
              {/* Photo & Identity Banner */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-rose-50 via-amber-50/40 to-emerald-50/30 rounded-2xl border border-rose-100">
                <div className="relative group">
                  <Avatar className="w-20 h-20 rounded-2xl border-2 border-white shadow-md">
                    {editForm.avatarUrl && <AvatarImage src={editForm.avatarUrl} alt="Parent Profile" />}
                    <AvatarFallback className="bg-gradient-to-br from-rose-500 to-pink-600 text-white font-bold text-xl">
                      {getInitials(editForm.firstName || "", editForm.lastName || "")}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 bg-black/40 rounded-2xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-bold gap-1"
                  >
                    {uploadingAvatar ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                    <span>Upload</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-bold text-gray-900 truncate">
                    {editForm.firstName} {editForm.lastName}
                  </h4>
                  <p className="text-xs text-gray-500 truncate">{editForm.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="text-xs h-7 gap-1 border-rose-200 text-rose-800 hover:bg-rose-50"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {uploadingAvatar ? "Uploading..." : "Change Photo"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const target = editingParent;
                        setEditingParent(null);
                        openResetPasswordModal(target);
                      }}
                      className="text-xs h-7 gap-1 border-amber-300 text-amber-900 bg-amber-50 hover:bg-amber-100"
                    >
                      <Key className="w-3 h-3 text-amber-600" />
                      Reset Password
                    </Button>
                  </div>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* First Name */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.firstName || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, firstName: e.target.value }))}
                    placeholder="First Name"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.lastName || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Last Name"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={editForm.email || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="parent@example.com"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                  />
                </div>

                {/* Relationship Type */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Relationship Role
                  </label>
                  <select
                    value={editForm.relationType || "Father"}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, relationType: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none bg-white"
                  >
                    {RELATION_TYPES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ITS Number (Prominent identifier) */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    ITS ID (8 Digits)
                  </label>
                  <input
                    type="text"
                    value={editForm.its || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, its: e.target.value }))}
                    placeholder="e.g. 30345678"
                    className="w-full px-3 py-2 rounded-xl border border-amber-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono bg-amber-50/20"
                  />
                </div>

                {/* Blood Group */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Blood Group
                  </label>
                  <select
                    value={editForm.bloodGroup || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, bloodGroup: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none bg-white font-mono"
                  >
                    <option value="">Select Blood Group</option>
                    {BLOOD_GROUPS.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Primary Phone */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Primary Mobile Phone
                  </label>
                  <input
                    type="text"
                    value={editForm.phone || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="+92 300 1234567"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono"
                  />
                </div>

                {/* Secondary Phone / WhatsApp */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Secondary Phone / WhatsApp
                  </label>
                  <input
                    type="text"
                    value={editForm.secondaryPhone || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, secondaryPhone: e.target.value }))}
                    placeholder="+92 321 7654321"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono"
                  />
                </div>

                {/* Occupation */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Occupation / Profession
                  </label>
                  <input
                    type="text"
                    value={editForm.occupation || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, occupation: e.target.value }))}
                    placeholder="e.g. Business Owner, Physician, Merchant"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    City of Residence
                  </label>
                  <input
                    type="text"
                    value={editForm.city || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="e.g. Karachi, Mumbai, Dubai"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                  />
                </div>

                {/* Watan */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Watan (Native / Ancestral Town)
                  </label>
                  <input
                    type="text"
                    value={editForm.watan || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, watan: e.target.value }))}
                    placeholder="e.g. Surat, Sidhpur, Dahod"
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                  />
                </div>

                {/* Address Full Width */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Residential Address
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.address || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Street address, building, apartment, neighborhood..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                    Special Notes &amp; Guidance
                  </label>
                  <textarea
                    rows={2}
                    value={editForm.notes || ""}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any administrative, medical, or family contact notes..."
                    className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                  />
                </div>
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
              className="bg-[#047857] hover:bg-[#065f46] text-white font-medium shadow-xs"
              onClick={handleSaveProfile}
              disabled={saving}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Save className="w-4 h-4 mr-1.5" />}
              Save Changes
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Admin Reset Password Modal ── */}
      <Modal open={!!resetPasswordParent} onOpenChange={() => setResetPasswordParent(null)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="text-gray-900 font-bold flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-600" />
              Admin Password Reset
            </ModalTitle>
          </ModalHeader>

          {resetPasswordParent && (
            <div className="space-y-4 py-3">
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900">
                <p className="font-bold text-sm text-gray-950">
                  {resetPasswordParent.firstName} {resetPasswordParent.lastName}
                </p>
                <p className="text-gray-600 mt-0.5">{resetPasswordParent.email}</p>
                <p className="mt-2 text-[11px] text-amber-800">
                  Setting a new password will terminate all existing active sessions for this account immediately.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-300 text-sm font-mono focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none"
                  />
                  <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewPassword("Burhani@" + Math.floor(1000 + Math.random() * 9000))}
                  className="text-xs gap-1 border-amber-200 text-amber-800 hover:bg-amber-50"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Generate Random PIN
                </Button>
                <span className="text-[11px] text-gray-400">Min 6 characters</span>
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
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-xs gap-1.5"
              onClick={handleResetPassword}
              disabled={resettingPassword || !newPassword.trim() || newPassword.trim().length < 6}
            >
              {resettingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Set Password
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Add New Parent Modal ── */}
      <Modal open={showCreateModal} onOpenChange={setShowCreateModal}>
        <ModalContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle className="text-gray-900 font-bold flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-emerald-700" />
              Register New Parent
            </ModalTitle>
          </ModalHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  First Name *
                </label>
                <input
                  type="text"
                  value={createForm.firstName}
                  onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })}
                  placeholder="First Name"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Last Name *
                </label>
                <input
                  type="text"
                  value={createForm.lastName}
                  onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })}
                  placeholder="Last Name"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="parent@example.com"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Password (optional)
                </label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Default: parent123"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Relation Role
                </label>
                <select
                  value={createForm.relationType}
                  onChange={(e) => setCreateForm({ ...createForm, relationType: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none bg-white"
                >
                  {RELATION_TYPES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Blood Group
                </label>
                <select
                  value={createForm.bloodGroup}
                  onChange={(e) => setCreateForm({ ...createForm, bloodGroup: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none bg-white font-mono"
                >
                  <option value="">Select Blood Group</option>
                  {BLOOD_GROUPS.map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  ITS ID (8 Digits)
                </label>
                <input
                  type="text"
                  value={createForm.its}
                  onChange={(e) => setCreateForm({ ...createForm, its: e.target.value })}
                  placeholder="e.g. 30345678"
                  className="w-full px-3 py-2 rounded-xl border border-amber-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono bg-amber-50/20"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Primary Mobile Phone
                </label>
                <input
                  type="text"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                  placeholder="+92 300 1234567"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Occupation / Profession
                </label>
                <input
                  type="text"
                  value={createForm.occupation}
                  onChange={(e) => setCreateForm({ ...createForm, occupation: e.target.value })}
                  placeholder="e.g. Merchant, Business"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  City of Residence
                </label>
                <input
                  type="text"
                  value={createForm.city}
                  onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                  placeholder="e.g. Karachi"
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1">
                  Residential Address
                </label>
                <textarea
                  rows={2}
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  placeholder="Complete residential address..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
                />
              </div>
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
              className="bg-[#047857] hover:bg-[#065f46] text-white font-medium shadow-xs"
              onClick={handleCreateParent}
              disabled={creating}
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              Create Parent Account
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* ── Delete Parent Profile Confirmation Modal ── */}
      <Modal open={!!deletingParent} onOpenChange={() => setDeletingParent(null)}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="flex items-center gap-2 text-red-600 font-bold">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Delete Parent Profile
            </ModalTitle>
          </ModalHeader>
          <div className="py-3 text-sm text-gray-600 space-y-3">
            <p>
              Are you sure you want to delete the profile for{" "}
              <strong className="text-gray-900">
                {deletingParent?.firstName} {deletingParent?.lastName}
              </strong>{" "}
              ({deletingParent?.email})?
            </p>
            {deletingParent && deletingParent.children && deletingParent.children.length > 0 && (
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-800">
                <span className="font-semibold block mb-1">
                  ⚠️ This parent has {deletingParent.children.length} linked student(s):
                </span>
                <ul className="list-disc list-inside space-y-0.5 text-red-700">
                  {deletingParent.children.map((c) => (
                    <li key={c.studentId}>
                      {c.studentName} (Grade {c.grade}{c.section})
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-red-600">
                  Deleting this profile will safely unlink these students and revoke parent dashboard access.
                </p>
              </div>
            )}
            <p className="text-xs text-gray-500">
              This action removes the parent profile and their login access immediately.
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
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              onClick={handleDeleteParent}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="w-4 h-4 mr-1.5" />
              )}
              Confirm Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
