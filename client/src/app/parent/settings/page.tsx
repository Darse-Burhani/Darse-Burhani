"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import {
  LogOut,
  Camera,
  Save,
  Loader2,
  Heart,
  Droplet,
  Phone,
  Mail,
  GraduationCap,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  Trash2,
  ShieldAlert,
  Info,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";
import { ModuleLockGuard } from "@/context/PortalAccessContext";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const RELATION_TYPES = ["Father", "Mother", "Guardian", "Grandparent", "Uncle", "Aunt", "Other"];

interface ParentProfileData {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  pendingAvatarUrl?: string | null;
  avatarStatus?: "PENDING" | "APPROVED" | "REJECTED" | string | null;
  avatarRejectionReason?: string | null;
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
  children: Array<{
    studentId: string;
    studentName: string;
    grade: string;
    section: string;
    avatarUrl?: string | null;
    relationship?: string | null;
  }>;
}

interface ItemPerm {
  isOpen: boolean;
  isVisible: boolean;
}

interface ParentPermissionsState {
  masterEnabled: boolean;
  items: Record<string, ItemPerm>;
}

export default function ParentSettingsPage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ParentProfileData | null>(null);
  const [permissions, setPermissions] = useState<ParentPermissionsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
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

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/parent/profile");
      const data = await res.json();
      if (data.success && data.data) {
        const p = data.data;
        setProfile(p);
        if (data.permissions) {
          setPermissions(data.permissions);
        }
        setForm({
          firstName: p.firstName || "",
          lastName: p.lastName || "",
          phone: p.phone || "",
          secondaryPhone: p.secondaryPhone || "",
          occupation: p.occupation || "",
          address: p.address || "",
          city: p.city || "",
          watan: p.watan || "",
          bloodGroup: p.bloodGroup || "",
          its: p.its || "",
          relationType: p.relationType || "Father",
          notes: p.notes || "",
        });
      }
    } catch (err) {
      console.error("Failed to load parent profile", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const isAdmin = session?.user?.role === "ADMIN";
  const masterEnabled = permissions?.masterEnabled ?? true;

  const canEdit = (field: string): boolean => {
    if (isAdmin) return true;
    if (!masterEnabled) return false;
    return permissions?.items?.[field]?.isOpen !== false;
  };

  const isFieldVisible = (field: string): boolean => {
    if (isAdmin) return true;
    return permissions?.items?.[field]?.isVisible !== false;
  };

  const anyFieldEditable = useMemo(() => {
    if (isAdmin) return true;
    if (!masterEnabled) return false;
    const editableFields = ["name", "relationType", "bloodGroup", "phone", "secondaryPhone", "occupation", "address", "notes"];
    return editableFields.some((f) => isFieldVisible(f) && canEdit(f));
  }, [isAdmin, masterEnabled, permissions]);

  const handleChangePassword = async (e: React.FormEvent) => {
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
        toast({ variant: "success", title: "Password Changed", description: "Your account password has been updated securely." });
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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canEdit("photo")) {
      toast({ variant: "warning", title: "Action Locked", description: "Photo uploads are restricted by madrasah administration." });
      return;
    }

    setUploadingAvatar(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/parent/avatar", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                pendingAvatarUrl: data.url,
                avatarStatus: "PENDING",
                avatarRejectionReason: null,
              }
            : null
        );
        toast({
          variant: "success",
          title: "Photo Submitted For Approval",
          description: "Your picture has been uploaded and sent to administration for review.",
        });
      } else {
        toast({ variant: "destructive", title: "Upload Failed", description: data.error || "Failed to upload photo." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not upload image." });
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleDeleteAvatar = async () => {
    if (!canEdit("photo")) {
      toast({ variant: "warning", title: "Action Locked", description: "Photo removal is restricted by madrasah administration." });
      return;
    }
    if (!confirm("Are you sure you want to remove your profile photo / pending upload?")) return;
    setDeletingAvatar(true);
    try {
      const res = await fetch("/api/parent/avatar", { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                avatarUrl: null,
                pendingAvatarUrl: null,
                avatarStatus: null,
                avatarRejectionReason: null,
              }
            : null
        );
        toast({ variant: "default", title: "Photo Removed", description: "Your profile photo has been cleared." });
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to remove photo." });
      }
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Network error removing photo." });
    } finally {
      setDeletingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!anyFieldEditable) {
      toast({ variant: "warning", title: "Read-Only Mode", description: "Profile editing is currently locked by administration." });
      return;
    }
    if (isFieldVisible("name") && (!form.firstName.trim() || !form.lastName.trim())) {
      toast({ variant: "warning", title: "Required", description: "First name and last name are required." });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/parent/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          variant: "success",
          title: "Profile Saved & Synchronized",
          description: "Your contact details, address, and profile data have been updated and synced to madrasah records.",
        });
        await fetchProfile();
      } else {
        toast({ variant: "destructive", title: "Save Failed", description: data.error || "Failed to update profile." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not save profile changes." });
    } finally {
      setSaving(false);
    }
  };

  const user = session?.user;

  return (
    <ModuleLockGuard moduleKey="settings" role="PARENT" title="Account Settings">
      <div className="max-w-4xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-5 sm:space-y-6">
        {/* Header Banner */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div
            className="relative overflow-hidden rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-xl"
            style={{ background: "linear-gradient(135deg, #b8541e 0%, #8a3e14 50%, #8a3e14 100%)" }}
          >
            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
              <div className="flex items-center gap-3.5 sm:gap-4">
                <div
                  className="w-13 h-13 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-md shrink-0"
                  style={{ background: "linear-gradient(135deg, #d4af37, #b8972e)" }}
                >
                  <Heart className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-xs text-white font-semibold mb-1">
                    <Sparkles className="w-3 h-3 text-amber-200" />
                    <span>Family Sanctuary &amp; Account</span>
                  </div>
                  <h1 className="font-display text-xl sm:text-3xl font-bold tracking-tight text-white">
                    Parent Profile &amp; Settings
                  </h1>
                  <p className="text-amber-100/90 text-xs sm:text-sm mt-0.5 leading-relaxed">
                    Update your personal contact details, residential address, and view enrolled children.
                  </p>
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-80" />
          </div>
        </motion.div>

        {/* Master Lock Banner if edits are locked administratively */}
        {!masterEnabled && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="p-4 sm:p-4.5 rounded-2xl bg-amber-50/90 border border-amber-300 text-amber-950 text-xs sm:text-sm flex items-start gap-3 shadow-xs">
              <div className="p-2 rounded-xl bg-amber-200/80 text-amber-900 shrink-0 mt-0.5">
                <Lock className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <div className="font-bold text-amber-950 flex items-center gap-2 flex-wrap">
                  <span>Institutional Read-Only Mode Active</span>
                  <Badge variant="outline" className="text-[10px] border-amber-400 text-amber-900 bg-amber-100 font-mono font-bold">
                    MANAGED BY MADRASAH
                  </Badge>
                </div>
                <div className="text-amber-900/80 text-xs mt-1 leading-relaxed">
                  Profile edits are currently locked by the Madrasah administration. You can view your verified contact details and linked students below. To request updates, please contact the administration office.
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Profile Form Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="rounded-2xl sm:rounded-3xl border border-rose-100/90 bg-white shadow-sm overflow-hidden">
            <CardContent className="p-4 sm:p-8">
              {/* Avatar & Photo Banner */}
              {isFieldVisible("photo") && (
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 sm:gap-6 pb-6 mb-6 border-b border-gray-100 text-center sm:text-left">
                  <div className="relative group shrink-0">
                    <Avatar
                      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl border-4 shadow-md ring-2 transition-all ${
                        profile?.avatarStatus === "PENDING" || profile?.pendingAvatarUrl
                          ? "border-amber-300 ring-amber-100"
                          : profile?.avatarStatus === "REJECTED"
                          ? "border-rose-300 ring-rose-100"
                          : "border-rose-100 ring-rose-50"
                      }`}
                    >
                      {(profile?.pendingAvatarUrl || profile?.avatarUrl) && (
                        <AvatarImage
                          src={profile.pendingAvatarUrl || profile.avatarUrl || ""}
                          alt="Parent"
                          className="object-cover"
                        />
                      )}
                      <AvatarFallback className="bg-gradient-to-br from-[#b8541e] to-[#8a3e14] text-white font-black text-xl sm:text-2xl">
                        {getInitials(form.firstName || user?.firstName || "", form.lastName || user?.lastName || "")}
                      </AvatarFallback>
                    </Avatar>

                    {canEdit("photo") && (
                      <>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="absolute inset-0 bg-black/45 rounded-3xl flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 sm:group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-bold gap-1"
                        >
                          {uploadingAvatar ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                          <span>Change</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                        {form.firstName || user?.firstName} {form.lastName || user?.lastName}
                      </h2>
                      <Badge className="text-[11px] bg-rose-50 text-rose-700 border-rose-200 font-bold uppercase">
                        {form.relationType || "PARENT"}
                      </Badge>

                      {/* Photo Review Status Badge */}
                      {profile?.avatarStatus === "PENDING" || profile?.pendingAvatarUrl ? (
                        <Badge className="text-xs bg-amber-50 text-amber-800 border-amber-300 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
                          Photo Pending Approval
                        </Badge>
                      ) : profile?.avatarStatus === "REJECTED" ? (
                        <Badge className="text-xs bg-rose-50 text-rose-700 border-rose-300 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Photo Rejected
                        </Badge>
                      ) : profile?.avatarUrl ? (
                        <Badge className="text-xs bg-emerald-50 text-emerald-800 border-emerald-300 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Photo Approved
                        </Badge>
                      ) : null}

                      {form.bloodGroup && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-md font-mono">
                          <Droplet className="w-3 h-3 text-red-500 fill-red-500" />
                          {form.bloodGroup}
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-gray-500 mt-1 flex items-center justify-center sm:justify-start gap-1.5 truncate">
                      <Mail className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="truncate">{profile?.email || user?.email}</span>
                    </p>

                    <div className="flex items-center justify-center sm:justify-start gap-2 mt-3 flex-wrap">
                      {canEdit("photo") ? (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingAvatar || deletingAvatar}
                            className="text-xs h-8 gap-1.5 border-amber-300 bg-amber-50/50 text-amber-900 hover:bg-amber-100 font-bold rounded-xl"
                          >
                            {uploadingAvatar ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Camera className="w-3.5 h-3.5" />
                            )}
                            {uploadingAvatar ? "Uploading..." : profile?.pendingAvatarUrl || profile?.avatarUrl ? "Change Photo" : "Upload Photo"}
                          </Button>

                          {(profile?.pendingAvatarUrl || profile?.avatarUrl) && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={handleDeleteAvatar}
                              disabled={uploadingAvatar || deletingAvatar}
                              className="text-xs h-8 gap-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold rounded-xl"
                            >
                              {deletingAvatar ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              {profile?.pendingAvatarUrl ? "Cancel Submission" : "Remove"}
                            </Button>
                          )}
                        </>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 text-xs text-amber-800 bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-200">
                          <Lock className="w-3 h-3 text-amber-600" />
                          <span>Photo editing restricted by administration</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Profile Photo Approval Banners */}
              {(profile?.avatarStatus === "PENDING" || profile?.pendingAvatarUrl) && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3 mb-6 shadow-xs">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold text-amber-900">Photo Submitted For Administrative Approval</div>
                    <div className="text-amber-800 mt-0.5 leading-relaxed">
                      Your new profile photo has been received and is currently under review by the madrasah administration. Once approved, it will automatically update across all institutional portals and linked student files.
                    </div>
                  </div>
                </div>
              )}

              {profile?.avatarStatus === "REJECTED" && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-3 mb-6 shadow-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="font-bold text-rose-900">Photo Resubmission Required</div>
                    <div className="text-rose-800 mt-0.5 leading-relaxed">
                      {profile.avatarRejectionReason || "The uploaded picture does not conform to institutional dress code or clarity guidelines."} Please upload a formal photograph conforming to standards (Topi / Rida).
                    </div>
                  </div>
                </div>
              )}

              {/* Profile Form */}
              <form onSubmit={handleSave} className="space-y-5 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                  {/* First Name */}
                  {isFieldVisible("name") && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="pFirstName" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                          First Name *
                        </label>
                        {!canEdit("name") && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <input
                        id="pFirstName"
                        type="text"
                        value={form.firstName}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                        disabled={!canEdit("name")}
                        placeholder="First Name"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                          !canEdit("name")
                            ? "bg-slate-50 border-gray-200 text-gray-500 cursor-not-allowed"
                            : "border-gray-200 focus:border-[#b8541e] focus:ring-2 focus:ring-rose-100"
                        }`}
                      />
                    </div>
                  )}

                  {/* Last Name */}
                  {isFieldVisible("name") && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="pLastName" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                          Last Name *
                        </label>
                        {!canEdit("name") && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <input
                        id="pLastName"
                        type="text"
                        value={form.lastName}
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                        disabled={!canEdit("name")}
                        placeholder="Last Name"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                          !canEdit("name")
                            ? "bg-slate-50 border-gray-200 text-gray-500 cursor-not-allowed"
                            : "border-gray-200 focus:border-[#b8541e] focus:ring-2 focus:ring-rose-100"
                        }`}
                      />
                    </div>
                  )}

                  {/* Relation Role */}
                  {isFieldVisible("relationType") && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="pRelation" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                          Relationship Role
                        </label>
                        {!canEdit("relationType") && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <select
                        id="pRelation"
                        value={form.relationType}
                        onChange={(e) => setForm({ ...form, relationType: e.target.value })}
                        disabled={!canEdit("relationType")}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                          !canEdit("relationType")
                            ? "bg-slate-50 border-gray-200 text-gray-500 cursor-not-allowed"
                            : "border-gray-200 focus:border-[#b8541e] focus:ring-2 focus:ring-rose-100 bg-white"
                        }`}
                      >
                        {RELATION_TYPES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Blood Group */}
                  {isFieldVisible("bloodGroup") && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="pBlood" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                          Blood Group
                        </label>
                        {!canEdit("bloodGroup") && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <select
                        id="pBlood"
                        value={form.bloodGroup}
                        onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                        disabled={!canEdit("bloodGroup")}
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none font-mono transition-all ${
                          !canEdit("bloodGroup")
                            ? "bg-slate-50 border-gray-200 text-gray-500 cursor-not-allowed"
                            : "border-gray-200 focus:border-[#b8541e] focus:ring-2 focus:ring-rose-100 bg-white"
                        }`}
                      >
                        <option value="">Select Blood Group</option>
                        {BLOOD_GROUPS.map((bg) => (
                          <option key={bg} value={bg}>
                            {bg}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Primary Phone */}
                  {isFieldVisible("phone") && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="pPhone" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                          Primary Phone / Mobile
                        </label>
                        {!canEdit("phone") && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <input
                        id="pPhone"
                        type="text"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        disabled={!canEdit("phone")}
                        placeholder="+92 300 1234567"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none font-mono transition-all ${
                          !canEdit("phone")
                            ? "bg-slate-50 border-gray-200 text-gray-500 cursor-not-allowed"
                            : "border-gray-200 focus:border-[#b8541e] focus:ring-2 focus:ring-rose-100"
                        }`}
                      />
                    </div>
                  )}

                  {/* Secondary Phone / WhatsApp */}
                  {isFieldVisible("secondaryPhone") && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="pSecPhone" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                          Secondary Phone / WhatsApp
                        </label>
                        {!canEdit("secondaryPhone") && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <input
                        id="pSecPhone"
                        type="text"
                        value={form.secondaryPhone}
                        onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })}
                        disabled={!canEdit("secondaryPhone")}
                        placeholder="+92 321 7654321"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none font-mono transition-all ${
                          !canEdit("secondaryPhone")
                            ? "bg-slate-50 border-gray-200 text-gray-500 cursor-not-allowed"
                            : "border-gray-200 focus:border-[#b8541e] focus:ring-2 focus:ring-rose-100"
                        }`}
                      />
                    </div>
                  )}

                  {/* ITS Number (Always read-only institutional anchor) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="pIts" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                        ITS Number (8 Digits)
                      </label>
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        Verified
                      </span>
                    </div>
                    <input
                      id="pIts"
                      type="text"
                      value={form.its}
                      disabled
                      placeholder="30345678"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-mono bg-slate-50 text-gray-600 cursor-not-allowed"
                    />
                  </div>

                  {/* Occupation */}
                  {isFieldVisible("occupation") && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="pOccupation" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                          Occupation / Profession
                        </label>
                        {!canEdit("occupation") && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <input
                        id="pOccupation"
                        type="text"
                        value={form.occupation}
                        onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                        disabled={!canEdit("occupation")}
                        placeholder="e.g. Business, Engineer, Merchant"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                          !canEdit("occupation")
                            ? "bg-slate-50 border-gray-200 text-gray-500 cursor-not-allowed"
                            : "border-gray-200 focus:border-[#b8541e] focus:ring-2 focus:ring-rose-100"
                        }`}
                      />
                    </div>
                  )}

                  {/* City */}
                  {isFieldVisible("address") && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="pCity" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                          City of Residence
                        </label>
                        {!canEdit("address") && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <input
                        id="pCity"
                        type="text"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                        disabled={!canEdit("address")}
                        placeholder="e.g. Karachi"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                          !canEdit("address")
                            ? "bg-slate-50 border-gray-200 text-gray-500 cursor-not-allowed"
                            : "border-gray-200 focus:border-[#b8541e] focus:ring-2 focus:ring-rose-100"
                        }`}
                      />
                    </div>
                  )}

                  {/* Watan */}
                  {isFieldVisible("address") && (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="pWatan" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                          Watan (Ancestral Town)
                        </label>
                        {!canEdit("address") && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <input
                        id="pWatan"
                        type="text"
                        value={form.watan}
                        onChange={(e) => setForm({ ...form, watan: e.target.value })}
                        disabled={!canEdit("address")}
                        placeholder="e.g. Surat, Sidhpur"
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                          !canEdit("address")
                            ? "bg-slate-50 border-gray-200 text-gray-500 cursor-not-allowed"
                            : "border-gray-200 focus:border-[#b8541e] focus:ring-2 focus:ring-rose-100"
                        }`}
                      />
                    </div>
                  )}

                  {/* Address Full Width */}
                  {isFieldVisible("address") && (
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="pAddress" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                          Residential Address
                        </label>
                        {!canEdit("address") && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <textarea
                        id="pAddress"
                        rows={2}
                        value={form.address}
                        onChange={(e) => setForm({ ...form, address: e.target.value })}
                        disabled={!canEdit("address")}
                        placeholder="Complete residential address..."
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                          !canEdit("address")
                            ? "bg-slate-50 border-gray-200 text-gray-500 cursor-not-allowed"
                            : "border-gray-200 focus:border-[#b8541e] focus:ring-2 focus:ring-rose-100"
                        }`}
                      />
                    </div>
                  )}

                  {/* Remarks / Notes */}
                  {isFieldVisible("notes") && (
                    <div className="sm:col-span-2">
                      <div className="flex items-center justify-between mb-1.5">
                        <label htmlFor="pNotes" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block">
                          Additional Family Notes / Emergency Instructions
                        </label>
                        {!canEdit("notes") && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <Lock className="w-2.5 h-2.5" /> Locked
                          </span>
                        )}
                      </div>
                      <textarea
                        id="pNotes"
                        rows={2}
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        disabled={!canEdit("notes")}
                        placeholder="Any medical allergies, guardian pickup notes, or special circumstances..."
                        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
                          !canEdit("notes")
                            ? "bg-slate-50 border-gray-200 text-gray-500 cursor-not-allowed"
                            : "border-gray-200 focus:border-[#b8541e] focus:ring-2 focus:ring-rose-100"
                        }`}
                      />
                    </div>
                  )}
                </div>

                {/* Submit Action */}
                {anyFieldEditable ? (
                  <div className="pt-3 sm:pt-4 flex items-center justify-end">
                    <Button
                      type="submit"
                      disabled={saving}
                      className="w-full sm:w-auto bg-[#b8541e] hover:bg-[#8a3e14] text-white font-bold px-6 py-2.5 rounded-xl shadow-md gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Profile Details
                    </Button>
                  </div>
                ) : (
                  <div className="pt-2 text-center sm:text-right text-xs text-slate-500 font-medium">
                    <span className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                      All profile fields are currently read-only.
                    </span>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Linked Children Showcase */}
        {profile && profile.children && profile.children.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="rounded-2xl sm:rounded-3xl border border-emerald-100 bg-white shadow-sm overflow-hidden">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-2 mb-4">
                  <GraduationCap className="w-5 h-5 text-[#b8541e]" />
                  <h3 className="font-display font-bold text-gray-900 text-sm sm:text-base">
                    Enrolled Talabat (Children) ({profile.children.length})
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {profile.children.map((child) => (
                    <div
                      key={child.studentId}
                      className="flex items-center gap-3 p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-100"
                    >
                      <Avatar className="w-10 h-10 rounded-xl border border-emerald-200 shrink-0">
                        {child.avatarUrl && <AvatarImage src={child.avatarUrl} alt={child.studentName} />}
                        <AvatarFallback className="bg-gradient-to-br from-emerald-600 to-teal-700 text-white font-bold text-xs">
                          {getInitials(child.studentName.split(" ")[0], child.studentName.split(" ")[1] || "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 text-sm truncate">{child.studentName}</p>
                        <p className="text-xs text-gray-500">
                          Grade {child.grade}{child.section}
                          {child.relationship && (
                            <span className="text-emerald-700 font-medium ml-1.5">· {child.relationship}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Change Password Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="rounded-2xl sm:rounded-3xl border border-amber-200 bg-white shadow-sm overflow-hidden">
            <CardContent className="p-4 sm:p-8">
              <div className="flex items-center justify-between gap-4 mb-5 sm:mb-6 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-gray-900 text-sm sm:text-base">Change Account Password</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Update your personal password (minimum 8 characters with letters &amp; numbers).
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="text-xs text-gray-500 hover:text-gray-800 gap-1.5 h-8 shrink-0"
                >
                  {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{showPasswords ? "Hide" : "Reveal"}</span>
                </Button>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
                  <div>
                    <label htmlFor="pCurPass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                      Current Password *
                    </label>
                    <input
                      id="pCurPass"
                      type={showPasswords ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Current password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none font-mono transition-all"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="pNewPass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                      New Password *
                    </label>
                    <input
                      id="pNewPass"
                      type={showPasswords ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min. 8)"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none font-mono transition-all"
                      required
                      minLength={8}
                    />
                  </div>

                  <div>
                    <label htmlFor="pConfPass" className="text-xs font-semibold text-gray-700 uppercase tracking-wider block mb-1.5">
                      Confirm New Password *
                    </label>
                    <input
                      id="pConfPass"
                      type={showPasswords ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-type new password"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-100 outline-none font-mono transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end">
                  <Button
                    type="submit"
                    disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword}
                    className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-2.5 sm:py-2 rounded-xl text-xs shadow-md gap-1.5"
                  >
                    {changingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sign Out Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="rounded-2xl sm:rounded-3xl border border-gray-200 bg-white shadow-sm">
            <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-gray-900">Session &amp; Security</p>
                <p className="text-xs text-gray-500 mt-0.5">End your active portal session securely on this device</p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full sm:w-auto rounded-xl font-semibold gap-1.5"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </ModuleLockGuard>
  );
}
