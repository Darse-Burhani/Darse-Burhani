"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  BookOpen,
  Heart,
  Shield,
  Camera,
  Save,
  Loader2,
  X,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Trash2,
  BellRing,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Award,
  Layers,
  Power,
} from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
  ModalClose,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

export interface UniversalUserRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "PARENT" | "STUDENT";
  isActive: boolean;
  avatarUrl?: string | null;
  plainPassword?: string | null;
  teacherProfile?: {
    id?: string;
    employeeId?: string | null;
    its?: string | null;
    department?: string | null;
    subCategory?: string | null;
    khidmatMauze?: string | null;
    roleTitle?: string | null;
    khidmatYear?: string | null;
    farigYear?: string | null;
    farigDarajah?: string | null;
    aljameaDegree?: string | null;
    hifzStatus?: string | null;
    hifzYear?: string | null;
    batchId?: string | null;
    birthDateAd?: any;
    birthDateH?: string | null;
    mobile?: string | null;
    tEmail?: string | null;
    age?: number | null;
    biometricHash?: string | null;
    portfolioEnabled?: boolean;
    photoUrl?: string | null;
  } | null;
  parentProfile?: {
    id?: string;
    phone?: string | null;
    secondaryPhone?: string | null;
    relationType?: string | null;
    occupation?: string | null;
    address?: string | null;
    city?: string | null;
    watan?: string | null;
    bloodGroup?: string | null;
    its?: string | null;
    notes?: string | null;
  } | null;
  studentProfile?: {
    grade?: string | null;
    section?: string | null;
    watan?: string | null;
    mobileNumber?: string | null;
    its?: string | null;
  } | null;
}

interface UniversalUserProfileEditModalProps {
  user: UniversalUserRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

export function UniversalUserProfileEditModal({
  user,
  open,
  onOpenChange,
  onSaved,
}: UniversalUserProfileEditModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Notification Options
  const [notifyUser, setNotifyUser] = useState(true);
  const [adminNote, setAdminNote] = useState("");
  const [showNotifOptions, setShowNotifOptions] = useState(false);

  // Changes Inspector
  const [showDiffDrawer, setShowDiffDrawer] = useState(false);

  // In-modal Quick Password Reset
  const [newPassword, setNewPassword] = useState("");
  const [resettingPw, setResettingPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Populate form state when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        isActive: user.isActive !== false,
        phone:
          user.teacherProfile?.mobile ||
          user.parentProfile?.phone ||
          user.studentProfile?.mobileNumber ||
          "",
        // Teacher specific
        employeeId: user.teacherProfile?.employeeId || user.teacherProfile?.its || "",
        its: user.teacherProfile?.its || user.parentProfile?.its || "",
        department: user.teacherProfile?.department || "",
        khidmatMauze: user.teacherProfile?.khidmatMauze || "",
        roleTitle: user.teacherProfile?.roleTitle || "",
        khidmatYear: user.teacherProfile?.khidmatYear || "",
        farigYear: user.teacherProfile?.farigYear || "",
        farigDarajah: user.teacherProfile?.farigDarajah || "",
        aljameaDegree: user.teacherProfile?.aljameaDegree || "",
        hifzStatus: user.teacherProfile?.hifzStatus || "",
        hifzYear: user.teacherProfile?.hifzYear || "",
        subCategory: user.teacherProfile?.subCategory || "",
        batchId: user.teacherProfile?.batchId || "",
        birthDateH: user.teacherProfile?.birthDateH || "",
        birthDateAd: user.teacherProfile?.birthDateAd ? new Date(user.teacherProfile.birthDateAd).toISOString().slice(0, 10) : "",
        age: user.teacherProfile?.age || "",
        tEmail: user.teacherProfile?.tEmail || "",
        biometricHash:
          user.teacherProfile?.biometricHash ||
          user.teacherProfile?.employeeId ||
          user.teacherProfile?.its ||
          "",
        portfolioEnabled: user.teacherProfile?.portfolioEnabled || false,
        // Parent specific
        secondaryPhone: user.parentProfile?.secondaryPhone || "",
        relationType: user.parentProfile?.relationType || "Father",
        occupation: user.parentProfile?.occupation || "",
        address: user.parentProfile?.address || "",
        city: user.parentProfile?.city || "",
        watan: user.parentProfile?.watan || user.studentProfile?.watan || "",
        bloodGroup: user.parentProfile?.bloodGroup || "",
        notes: user.parentProfile?.notes || "",
      });
      setAvatarUrl(user.avatarUrl || user.teacherProfile?.photoUrl || null);
      setNewPassword("");
      setAdminNote("");
      setNotifyUser(true);
      setShowDiffDrawer(false);
      setSavedSuccess(false);
    }
  }, [user]);

  if (!user) return null;

  const handleFieldChange = (key: string, val: any) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  // Detected Changes Calculation
  const getDetectedChanges = () => {
    if (!user) return [];
    const diffs: { field: string; label: string; oldVal: string; newVal: string }[] = [];

    const check = (key: string, label: string, origVal: any) => {
      const o = String(origVal ?? "").trim();
      const n = String(formData[key] ?? "").trim();
      if (o !== n) {
        diffs.push({ field: key, label, oldVal: o || "(empty)", newVal: n || "(empty)" });
      }
    };

    check("firstName", "First Name", user.firstName);
    check("lastName", "Last Name", user.lastName);
    check("email", "Email", user.email);
    if (user.isActive !== formData.isActive) {
      diffs.push({
        field: "isActive",
        label: "Account Status",
        oldVal: user.isActive ? "Active" : "Suspended",
        newVal: formData.isActive ? "Active" : "Suspended",
      });
    }

    if (user.role === "TEACHER") {
      check("department", "Department", user.teacherProfile?.department);
      check("khidmatMauze", "Khidmat Mauze", user.teacherProfile?.khidmatMauze);
      check("phone", "Mobile Number", user.teacherProfile?.mobile);
      check("roleTitle", "Designation", user.teacherProfile?.roleTitle);
      check("khidmatYear", "Khidmat Years", user.teacherProfile?.khidmatYear);
      check("farigYear", "Farig Year", user.teacherProfile?.farigYear);
      check("its", "ITS Number", user.teacherProfile?.its);
      check("biometricHash", "Biometric ID", user.teacherProfile?.biometricHash);
      if (Boolean(user.teacherProfile?.portfolioEnabled) !== Boolean(formData.portfolioEnabled)) {
        diffs.push({
          field: "portfolioEnabled",
          label: "Portfolio",
          oldVal: user.teacherProfile?.portfolioEnabled ? "Enabled" : "Disabled",
          newVal: formData.portfolioEnabled ? "Enabled" : "Disabled",
        });
      }
    } else if (user.role === "PARENT") {
      check("phone", "Phone", user.parentProfile?.phone);
      check("secondaryPhone", "Secondary Phone", user.parentProfile?.secondaryPhone);
      check("relationType", "Relation", user.parentProfile?.relationType);
      check("occupation", "Occupation", user.parentProfile?.occupation);
      check("address", "Address", user.parentProfile?.address);
      check("city", "City", user.parentProfile?.city);
      check("watan", "Watan", user.parentProfile?.watan);
      check("its", "ITS Number", user.parentProfile?.its);
      check("notes", "Administrative Notes", user.parentProfile?.notes);
    } else if (user.role === "ADMIN") {
      check("phone", "Contact Phone", user.studentProfile?.mobileNumber);
      check("watan", "Watan / City", user.studentProfile?.watan);
    }

    const origAvatar = user.avatarUrl || user.teacherProfile?.photoUrl || null;
    if ((origAvatar || null) !== (avatarUrl || null)) {
      diffs.push({
        field: "avatarUrl",
        label: "Profile Photo",
        oldVal: origAvatar ? "Existing" : "None",
        newVal: avatarUrl ? "New Photo" : "Removed",
      });
    }

    return diffs;
  };

  const detectedChanges = getDetectedChanges();

  const handleAvatarUpload = async (file?: File) => {
    if (!file || !user) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success && data.url) {
        setAvatarUrl(data.url);
        toast({ title: "Photo Ready", description: "Image attached. Click Save Changes to commit.", variant: "success" });
      } else {
        toast({ title: "Upload Failed", description: data.error || "Could not upload photo", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload Error", description: "Network error during photo upload", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleQuickPasswordReset = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: "Invalid Password", description: "Password must be at least 6 characters.", variant: "destructive" });
      return;
    }
    setResettingPw(true);
    try {
      const res = await fetch("/api/admin/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Password Reset Successful",
          description: `Password for ${user.firstName} updated. Previous sessions terminated.`,
          variant: "success",
        });
        setNewPassword("");
      } else {
        toast({ title: "Reset Failed", description: data.error || "Could not reset password", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error during password reset", variant: "destructive" });
    } finally {
      setResettingPw(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      const payload = {
        id: user.id,
        ...formData,
        avatarUrl,
        notifyUser,
        adminNote,
        changesSummary: detectedChanges.map((d) => `${d.label}: ${d.oldVal} ➔ ${d.newVal}`),
      };

      const res = await fetch("/api/admin/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSavedSuccess(true);
        toast({
          title: "Profile Updated & Notified",
          description: `All changes saved. In-app and browser notifications dispatched to ${user.firstName}.`,
          variant: "success",
        });

        if (onSaved) onSaved();
        setTimeout(() => {
          onOpenChange(false);
        }, 1100);
      } else {
        toast({
          title: "Update Failed",
          description: data.error || "Failed to update member profile",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Network Error",
        description: err?.message || "Failed to communicate with server",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const roleTheme = {
    TEACHER: {
      gradient: "linear-gradient(135deg, #134e4a 0%, #0f766e 50%, #115e59 100%)",
      badge: "Faculty / Muallim",
      icon: BookOpen,
      color: "teal",
    },
    PARENT: {
      gradient: "linear-gradient(135deg, #831843 0%, #9d174d 50%, #701a75 100%)",
      badge: "Parent / Guardian",
      icon: Heart,
      color: "rose",
    },
    ADMIN: {
      gradient: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e293b 100%)",
      badge: "Master Administrator",
      icon: Shield,
      color: "indigo",
    },
    STUDENT: {
      gradient: "linear-gradient(135deg, #064e3b 0%, #046a4e 50%, #024e39 100%)",
      badge: "Talabat",
      icon: User,
      color: "emerald",
    },
  }[user.role] || {
    gradient: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
    badge: user.role,
    icon: User,
    color: "slate",
  };

  const RoleIcon = roleTheme.icon;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-slate-50 border border-slate-200 rounded-3xl shadow-2xl">
        {/* ── TOP HERO HEADER BANNER ── */}
        <div
          className="relative px-6 py-5 text-white flex flex-col sm:flex-row items-center sm:items-start gap-5 border-b border-white/10"
          style={{ background: roleTheme.gradient }}
        >
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          {/* Profile Photo Avatar with Hover Camera Overlay */}
          <div className="relative group shrink-0">
            <Avatar className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl border-3 border-amber-300 shadow-md">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={formData.firstName} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-black/40 text-amber-200 text-xl font-bold">
                {getInitials(formData.firstName, formData.lastName)}
              </AvatarFallback>
            </Avatar>

            <button
              type="button"
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white transition-opacity cursor-pointer"
              title="Change Profile Photo"
            >
              {avatarUploading ? (
                <Loader2 className="w-6 h-6 animate-spin text-amber-300" />
              ) : (
                <>
                  <Camera className="w-5 h-5 text-amber-300 mb-0.5" />
                  <span className="text-[10px] font-bold">Change</span>
                </>
              )}
            </button>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleAvatarUpload(e.target.files?.[0])}
            />

            <span
              className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[9px] font-extrabold rounded-md shadow border ${
                formData.isActive
                  ? "bg-emerald-600 text-white border-emerald-400"
                  : "bg-red-600 text-white border-red-400"
              }`}
            >
              {formData.isActive ? "ACTIVE" : "SUSPENDED"}
            </span>
          </div>

          {/* Hero Name & Quick Meta Information */}
          <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-white">
                    {formData.firstName} {formData.lastName}
                  </h2>
                </div>
                <p className="text-xs text-white/80 font-mono mt-0.5">{formData.email}</p>
              </div>

              {/* Role Indicator Badge */}
              <div className="flex items-center justify-center sm:justify-end gap-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white border border-white/30 backdrop-blur-xs">
                  <RoleIcon className="w-3.5 h-3.5 text-amber-300" />
                  {roleTheme.badge}
                </span>

                {detectedChanges.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowDiffDrawer(!showDiffDrawer)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow border border-amber-200 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{detectedChanges.length} Changes</span>
                    {showDiffDrawer ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-black/20 text-white/80 border border-white/20">
                    <CheckCircle2 className="w-3 h-3 text-emerald-300" /> Clean
                  </span>
                )}
              </div>
            </div>

            {/* Quick Details Bar */}
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap text-xs">
              {formData.its && (
                <span className="bg-black/30 text-amber-200 px-2.5 py-0.5 rounded-lg border border-amber-300/30 font-semibold font-mono">
                  ITS: {formData.its}
                </span>
              )}
              {formData.employeeId && (
                <span className="bg-black/30 text-emerald-200 px-2.5 py-0.5 rounded-lg border border-emerald-300/30 font-semibold font-mono">
                  ID: {formData.employeeId}
                </span>
              )}
              {formData.department && (
                <span className="bg-black/30 text-white/90 px-2.5 py-0.5 rounded-lg border border-white/20 font-semibold">
                  Dept: {formData.department}
                </span>
              )}
              {formData.phone && (
                <span className="bg-black/30 text-white/80 px-2.5 py-0.5 rounded-lg border border-white/20 font-mono">
                  {formData.phone}
                </span>
              )}
            </div>
          </div>

          <ModalClose asChild>
            <button
              className="absolute top-4 right-4 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </ModalClose>
        </div>

        {/* ── EXPANDABLE REAL-TIME CHANGES DIFF DRAWER ── */}
        <AnimatePresence>
          {showDiffDrawer && detectedChanges.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-50/90 border-b border-amber-200 px-6 py-3 overflow-hidden text-xs"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-amber-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>Unsaved Changes ({detectedChanges.length}):</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowDiffDrawer(false)}
                  className="text-amber-700 hover:text-amber-900 text-[11px] font-bold"
                >
                  Hide
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {detectedChanges.map((diff) => (
                  <div
                    key={diff.field}
                    className="p-2 rounded-lg bg-white border border-amber-200/80 shadow-2xs flex items-center justify-between gap-2"
                  >
                    <span className="font-bold text-slate-800">{diff.label}:</span>
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-red-600 line-through truncate max-w-[100px]">{diff.oldVal}</span>
                      <span className="text-slate-400">➔</span>
                      <span className="text-emerald-700 font-bold truncate max-w-[120px]">{diff.newVal}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FORM CONTENT SCROLL AREA ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Identity & Basic Credentials */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500" />
              <span>Personal Identity &amp; Portal Account</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                <input
                  type="text"
                  className="fatimi-input"
                  value={formData.firstName || ""}
                  onChange={(e) => handleFieldChange("firstName", e.target.value)}
                  placeholder="First Name"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  className="fatimi-input"
                  value={formData.lastName || ""}
                  onChange={(e) => handleFieldChange("lastName", e.target.value)}
                  placeholder="Last Name"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Official Email *</label>
                <input
                  type="email"
                  className="fatimi-input font-mono text-xs"
                  value={formData.email || ""}
                  onChange={(e) => handleFieldChange("email", e.target.value)}
                  placeholder="email@darseburhani.edu"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Phone / Mobile *</label>
                <input
                  type="tel"
                  className="fatimi-input font-mono"
                  value={formData.phone || ""}
                  onChange={(e) => handleFieldChange("phone", e.target.value)}
                  placeholder="+91 9876543210"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Authority Status</label>
                <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200 bg-slate-50">
                  <span className={`text-xs font-bold ${formData.isActive ? "text-emerald-700" : "text-red-600"}`}>
                    {formData.isActive ? "Active" : "Suspended"}
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant={formData.isActive ? "outline" : "default"}
                    onClick={() => handleFieldChange("isActive", !formData.isActive)}
                    className={
                      formData.isActive
                        ? "text-red-700 border-red-200 hover:bg-red-50 text-xs h-7 px-2"
                        : "bg-emerald-700 text-white text-xs h-7 px-2"
                    }
                  >
                    {formData.isActive ? "Suspend" : "Activate"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* ── FACULTY / TEACHER SPECIFIC FIELDS ── */}
          {user.role === "TEACHER" && (
            <div className="bg-white p-5 rounded-2xl border border-teal-200/80 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-600" />
                <span>Faculty Khidmat &amp; Madrasah Profile</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ITS Number</label>
                  <input
                    type="text"
                    className="fatimi-input font-mono font-bold text-teal-900"
                    value={formData.its || ""}
                    onChange={(e) => handleFieldChange("its", e.target.value)}
                    placeholder="8-digit ITS"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Employee / Teacher ID</label>
                  <input
                    type="text"
                    className="fatimi-input font-mono"
                    value={formData.employeeId || ""}
                    onChange={(e) => handleFieldChange("employeeId", e.target.value)}
                    placeholder="e.g. TCH-1002"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Biometric Terminal ID</label>
                  <input
                    type="text"
                    className="fatimi-input font-mono"
                    value={formData.biometricHash || ""}
                    onChange={(e) => handleFieldChange("biometricHash", e.target.value)}
                    placeholder="Defaults to ITS"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Department</label>
                  <input
                    type="text"
                    className="fatimi-input"
                    value={formData.department || ""}
                    onChange={(e) => handleFieldChange("department", e.target.value)}
                    placeholder="e.g. Quraan, Lisanud Dawat"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khidmat Mauze</label>
                  <input
                    type="text"
                    className="fatimi-input"
                    value={formData.khidmatMauze || ""}
                    onChange={(e) => handleFieldChange("khidmatMauze", e.target.value)}
                    placeholder="e.g. Surat, Mumbai, Karachi"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Designation / Role Title</label>
                  <input
                    type="text"
                    className="fatimi-input"
                    value={formData.roleTitle || ""}
                    onChange={(e) => handleFieldChange("roleTitle", e.target.value)}
                    placeholder="e.g. Head of Quranic Studies"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Khidmat Years</label>
                  <input
                    type="text"
                    className="fatimi-input font-mono"
                    value={formData.khidmatYear || ""}
                    onChange={(e) => handleFieldChange("khidmatYear", e.target.value)}
                    placeholder="e.g. 5"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Farig Year (Hijri)</label>
                  <input
                    type="text"
                    className="fatimi-input font-mono"
                    value={formData.farigYear || ""}
                    onChange={(e) => handleFieldChange("farigYear", e.target.value)}
                    placeholder="e.g. 1440 H"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Farig Darajah</label>
                  <input
                    type="text"
                    className="fatimi-input"
                    value={formData.farigDarajah || ""}
                    onChange={(e) => handleFieldChange("farigDarajah", e.target.value)}
                    placeholder="Darajah"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Al Jamea Degree</label>
                  <input
                    type="text"
                    className="fatimi-input"
                    value={formData.aljameaDegree || ""}
                    onChange={(e) => handleFieldChange("aljameaDegree", e.target.value)}
                    placeholder="Degree"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-1 border-t border-teal-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Hijri Birthday (Waras)</label>
                  <input
                    type="text"
                    className="fatimi-input font-bold"
                    value={formData.birthDateH || ""}
                    onChange={(e) => handleFieldChange("birthDateH", e.target.value)}
                    placeholder="e.g. 20 Rabi II 1410 H"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Gregorian Birthday</label>
                  <input
                    type="date"
                    className="fatimi-input"
                    value={formData.birthDateAd || ""}
                    onChange={(e) => handleFieldChange("birthDateAd", e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Official Faculty Email</label>
                  <input
                    type="email"
                    className="fatimi-input font-mono text-xs"
                    value={formData.tEmail || ""}
                    onChange={(e) => handleFieldChange("tEmail", e.target.value)}
                    placeholder="official@darseburhani.org"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sub-Category</label>
                  <input
                    type="text"
                    className="fatimi-input"
                    value={formData.subCategory || ""}
                    onChange={(e) => handleFieldChange("subCategory", e.target.value)}
                    placeholder="e.g. Senior Faculty"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── PARENT SPECIFIC FIELDS ── */}
          {user.role === "PARENT" && (
            <div className="bg-white p-5 rounded-2xl border border-rose-200/80 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800 flex items-center gap-2">
                <Heart className="w-4 h-4 text-rose-600" />
                <span>Parent &amp; Family Record</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ITS Number</label>
                  <input
                    type="text"
                    className="fatimi-input font-mono font-bold text-rose-900"
                    value={formData.its || ""}
                    onChange={(e) => handleFieldChange("its", e.target.value)}
                    placeholder="8-digit ITS"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship Type</label>
                  <select
                    className="fatimi-input font-bold"
                    value={formData.relationType || "Father"}
                    onChange={(e) => handleFieldChange("relationType", e.target.value)}
                  >
                    <option value="Father">Father (Walid)</option>
                    <option value="Mother">Mother (Walidah)</option>
                    <option value="Guardian">Guardian (Wasi)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Occupation</label>
                  <input
                    type="text"
                    className="fatimi-input"
                    value={formData.occupation || ""}
                    onChange={(e) => handleFieldChange("occupation", e.target.value)}
                    placeholder="Business / Professional"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Secondary Phone</label>
                  <input
                    type="tel"
                    className="fatimi-input font-mono"
                    value={formData.secondaryPhone || ""}
                    onChange={(e) => handleFieldChange("secondaryPhone", e.target.value)}
                    placeholder="+91..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Watan / Hometown</label>
                  <input
                    type="text"
                    className="fatimi-input"
                    value={formData.watan || ""}
                    onChange={(e) => handleFieldChange("watan", e.target.value)}
                    placeholder="e.g. Surat, Galiakot"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Current Resident City</label>
                  <input
                    type="text"
                    className="fatimi-input"
                    value={formData.city || ""}
                    onChange={(e) => handleFieldChange("city", e.target.value)}
                    placeholder="e.g. Mumbai"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Group</label>
                  <input
                    type="text"
                    className="fatimi-input font-bold"
                    value={formData.bloodGroup || ""}
                    onChange={(e) => handleFieldChange("bloodGroup", e.target.value)}
                    placeholder="e.g. O+, A+, B+"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Residential Address</label>
                <textarea
                  rows={2}
                  className="fatimi-input"
                  value={formData.address || ""}
                  onChange={(e) => handleFieldChange("address", e.target.value)}
                  placeholder="Complete residential address"
                />
              </div>
            </div>
          )}

          {/* ── ADMIN SPECIFIC FIELDS ── */}
          {user.role === "ADMIN" && (
            <div className="bg-white p-5 rounded-2xl border border-indigo-200/80 shadow-2xs space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                <span>Administrative Station &amp; Details</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Administrative Center / Watan</label>
                  <input
                    type="text"
                    className="fatimi-input"
                    value={formData.watan || ""}
                    onChange={(e) => handleFieldChange("watan", e.target.value)}
                    placeholder="Institutional Headquarters"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Security Privilege</label>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-indigo-900">
                    Full Institutional Operations &amp; Database Access
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Password Reset */}
          <div className="bg-white p-5 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-600" />
              <span>Administrative Password Reset</span>
            </h3>
            <p className="text-xs text-slate-500">
              Immediately update this account&apos;s password and revoke active sessions.
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <input
                  type={showNewPw ? "text" : "password"}
                  className="fatimi-input font-mono text-xs pr-10 font-bold"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password (min. 6 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPw(!showNewPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const random = "Db@" + Math.random().toString(36).slice(2, 8) + "!";
                  setNewPassword(random);
                  setShowNewPw(true);
                }}
                className="border-amber-300 text-amber-900 hover:bg-amber-100 text-xs font-bold shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Generate
              </Button>

              <Button
                type="button"
                onClick={handleQuickPasswordReset}
                disabled={resettingPw || !newPassword || newPassword.length < 6}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0"
              >
                {resettingPw ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Set Password
              </Button>
            </div>
          </div>
        </div>

        {/* ── EXPANDABLE NOTIFICATION CONTROLS PANEL ── */}
        <AnimatePresence>
          {showNotifOptions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-emerald-50/90 border-t border-emerald-200 px-6 py-3.5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-950 flex items-center gap-1.5">
                  <BellRing className="w-4 h-4 text-emerald-700" />
                  <span>Notification Dispatch Configuration:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowNotifOptions(false)}
                  className="text-xs text-emerald-800 font-bold hover:underline"
                >
                  Done
                </button>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={notifyUser}
                    onChange={(e) => setNotifyUser(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>Send In-App Alert &amp; Web Push Notification to {formData.firstName}</span>
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Administrative Note / Reason for Update (Optional):
                </label>
                <input
                  type="text"
                  className="fatimi-input text-xs"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="e.g. Updated Khidmat Mauze and contact details"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MODAL FOOTER ── */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setShowNotifOptions(!showNotifOptions)}
            className="flex items-center gap-2 text-xs text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-1.5 rounded-xl border border-emerald-200/80 transition-colors"
          >
            <BellRing className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              Alerts: <strong>{notifyUser ? "Push & In-App ON" : "Muted"}</strong>
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showNotifOptions ? "rotate-180" : ""}`} />
          </button>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <ModalClose asChild>
              <Button variant="outline" size="sm" className="border-slate-200 text-slate-600 font-semibold" disabled={saving}>
                Cancel
              </Button>
            </ModalClose>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={saving || !formData.email || !formData.firstName || !formData.lastName}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 shadow-sm transition-all flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving &amp; Notifying...</span>
                </>
              ) : savedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-amber-300" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-amber-300" />
                  <span>{detectedChanges.length > 0 ? `Save ${detectedChanges.length} Changes` : "Save Changes"}</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
