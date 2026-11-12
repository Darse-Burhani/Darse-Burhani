"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  User,
  Save,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Lock,
  GraduationCap,
  MapPin,
  ShieldCheck,
  Camera,
  UploadCloud,
  Trash2,
  Sparkles,
  Compass,
  FileText,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/components/student/PageHeader";
import { formatTalabatEmail } from "@/lib/student-email";

interface TalabatProfileData {
  age: string;
  status: string;
  bloodGroup: string;
  dobGregorian: string;
  dobHijri: string;
  hafizYear: string;
  admissionYear: string;
  currentYear: string;
  externalSchooling: string;
  watan: string;
  residentCity: string;
  address: string;
  mobileNumber: string;
  its: string;
  trNo: string;
  grade: string;
  section: string;
  reallyGoodAt?: string;
  loveToStudy?: string;
  loveForFun?: string;
  knowingMyselfSubmitted?: boolean;
  knowingMyselfSubmittedAt?: string | null;
}

interface RegionPermission {
  id: string;
  label: string;
  description: string;
  isOpen: boolean;
  isVisibleToStudent?: boolean;
  isVisible?: boolean;
}

export default function TalabatProfilePage() {
  const { data: session } = useSession();
  const user = session?.user;
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, RegionPermission>>({
    personal: { id: "personal", label: "Personal Information", description: "", isOpen: true, isVisibleToStudent: true },
    academic: { id: "academic", label: "Academic Information", description: "", isOpen: true, isVisibleToStudent: true },
    contact: { id: "contact", label: "Contact & Location", description: "", isOpen: true, isVisibleToStudent: true },
    identifiers: { id: "identifiers", label: "Student IDs", description: "", isOpen: false, isVisibleToStudent: true },
  });
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<TalabatProfileData>({
    age: "",
    status: "",
    bloodGroup: "",
    dobGregorian: "",
    dobHijri: "",
    hafizYear: "",
    admissionYear: "",
    currentYear: "",
    externalSchooling: "",
    watan: "",
    residentCity: "",
    address: "",
    mobileNumber: "",
    its: "",
    trNo: "",
    grade: "",
    section: "",
    reallyGoodAt: "",
    loveToStudy: "",
    loveForFun: "",
    knowingMyselfSubmitted: false,
    knowingMyselfSubmittedAt: null,
  });

  const [justSubmittedAssessment, setJustSubmittedAssessment] = useState(false);

  const isAdmin = user?.role === "ADMIN";

  // Master switch from admin: false = whole profile read-only for students.
  const masterLocked = !isAdmin && (permissions as Record<string, any>).masterEnabled === false;

  const isPhotoOpen = isAdmin || (!masterLocked && permissions.photo?.isOpen !== false);
  const isPersonalOpen = isAdmin || (!masterLocked && permissions.personal?.isOpen !== false);
  const isAcademicOpen = isAdmin || (!masterLocked && permissions.academic?.isOpen !== false);
  const isContactOpen = isAdmin || (!masterLocked && permissions.contact?.isOpen !== false);
  const isIdentifiersOpen = isAdmin || (!masterLocked && permissions.identifiers?.isOpen !== false);

  const isPhotoVisible = isAdmin || (permissions.photo?.isVisible !== false && permissions.photo?.isVisibleToStudent !== false);
  const isPersonalVisible = isAdmin || (permissions.personal?.isVisible !== false && permissions.personal?.isVisibleToStudent !== false);
  const isAcademicVisible = isAdmin || (permissions.academic?.isVisible !== false && permissions.academic?.isVisibleToStudent !== false);
  const isContactVisible = isAdmin || (permissions.contact?.isVisible !== false && permissions.contact?.isVisibleToStudent !== false);
  const isIdentifiersVisible = isAdmin || (permissions.identifiers?.isVisible !== false && permissions.identifiers?.isVisibleToStudent !== false);

  const isDarajah4 =
    isAdmin ||
    profile.grade === "4" ||
    profile.grade?.toLowerCase().includes("rabea") ||
    profile.grade?.toLowerCase().includes("rabia") ||
    profile.grade?.includes("4");

  useEffect(() => {
    fetchProfile();
    fetchPermissions();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("submitted") === "knowing-myself") {
        setJustSubmittedAssessment(true);
      }
    }
  }, []);

  const fetchPermissions = async () => {
    try {
      const res = await fetch("/api/talabat/profile/permissions");
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setPermissions(json.data);
        }
      }
    } catch {
      // default open
    }
  };

  const fetchProfile = async () => {
    try {
      const search = typeof window !== "undefined" ? window.location.search : "";
      const res = await fetch(`/api/talabat/profile${search}`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setAvatarUrl(data.avatarUrl || (!search ? user?.avatarUrl : "") || "");
        setProfile({
          age: data.age?.toString() || "",
          status: data.status || "",
          bloodGroup: data.bloodGroup || "",
          dobGregorian: data.dobGregorian
            ? typeof data.dobGregorian === "string"
              ? data.dobGregorian.slice(0, 10)
              : data.dobGregorian
            : "",
          dobHijri: data.dobHijri || "",
          hafizYear: data.hafizYear || "",
          admissionYear: data.admissionYear || "",
          currentYear: data.currentYear || "",
          externalSchooling: data.externalSchooling || "",
          watan: data.watan || "",
          residentCity: data.residentCity || "",
          address: data.address || "",
          mobileNumber: data.mobileNumber || "",
          its: data.its || "",
          trNo: data.trNo || "",
          grade: data.grade || "",
          section: data.section || "",
          reallyGoodAt: data.reallyGoodAt || "",
          loveToStudy: data.loveToStudy || "",
          loveForFun: data.loveForFun || "",
          knowingMyselfSubmitted: Boolean(data.knowingMyselfSubmitted),
          knowingMyselfSubmittedAt: data.knowingMyselfSubmittedAt || null,
        });
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
  };

  const handleSave = async () => {
    if (!isAdmin && masterLocked) {
      toast({ title: "Profile Editing Locked", description: "Admin has locked talabat profile updates.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setSaved(false);
    try {
      const search = typeof window !== "undefined" ? window.location.search : "";
      const res = await fetch(`/api/talabat/profile${search}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          avatarUrl,
          age: profile.age ? parseInt(profile.age) : null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && (json.success !== false)) {
        setSaved(true);
        toast({ title: "Profile Saved", description: "Your profile changes were saved successfully.", variant: "success" });
        setTimeout(() => setSaved(false), 3000);
      } else {
        toast({ title: "Save Failed", description: json.error || "Failed to save profile changes.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("Failed to save profile:", error);
      toast({ title: "Network Error", description: error?.message || "Failed to connect to server.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof TalabatProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "New password and confirmation do not match." });
      return;
    }
    if (newPassword.length < 3) {
      setPwMessage({ type: "error", text: "New password must be at least 3 characters." });
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) {
        setPwMessage({ type: "error", text: json?.error || "Failed to change password." });
        return;
      }
      setPwMessage({ type: "success", text: "Password updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setPwMessage({ type: "error", text: "An error occurred. Please try again." });
    } finally {
      setPwSaving(false);
    }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Please upload an image file (JPG, PNG, WebP).", variant: "destructive" });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Maximum image size is 5MB.", variant: "destructive" });
      return;
    }

    try {
      setUploadingPhoto(true);
      const data = new FormData();
      data.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: data });
      const json = await res.json();
      if (res.ok && json.success && json.url) {
        setAvatarUrl(json.url);
        toast({ title: "Photo Staged", description: "Click Save Profile to apply permanently.", variant: "success" });
      } else {
        toast({ title: "Upload Failed", description: json.error || "Could not upload image", variant: "destructive" });
      }
    } catch {
      toast({ title: "Upload Error", description: "Server upload failed", variant: "destructive" });
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = () => {
    setAvatarUrl("");
    toast({ title: "Photo Removed", description: "Click Save Profile to confirm removal.", variant: "warning" });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <PageHeader
        icon={User}
        title="Talabat Profile"
        subtitle="Manage your personal and academic profile information"
      />

      {justSubmittedAssessment && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white shadow-lg border border-emerald-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          role="status"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-full bg-emerald-500/30 border-2 border-emerald-300 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <div className="font-bold text-base flex items-center gap-2 text-emerald-100">
                <span>Knowing Myself Assessment Successfully Submitted!</span>
                <span className="text-xs bg-emerald-500/30 text-emerald-200 border border-emerald-400/40 px-2 py-0.5 rounded-full font-semibold">
                  ✓ Recorded
                </span>
              </div>
              <p className="text-xs text-emerald-200/90 mt-0.5 leading-relaxed">
                Your responses have been recorded and synced to your Darajah 4 student profile and administrative record sheet.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setJustSubmittedAssessment(false)}
            className="self-end sm:self-center text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-700/60 hover:bg-emerald-700 text-emerald-100 border border-emerald-500/40 transition-colors"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {isAdmin && (
        <div className="mb-6 flex items-center gap-2.5 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-sm font-semibold text-emerald-900" role="status">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          Administrator Mode: You are editing this student&apos;s profile with full administrative permissions.
        </div>
      )}

      {!isAdmin && masterLocked && (
        <div className="mb-6 flex items-center gap-2.5 p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-sm font-semibold text-amber-900" role="alert">
          <Lock className="w-4 h-4 text-amber-700 shrink-0" />
          Profile editing is locked by admin — all sections are read-only.
        </div>
      )}

      <div className="space-y-6">
        {/* Photo Upload Card */}
        {isPhotoVisible && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="fatimi-card">
              <div className="fatimi-card-header" />
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-100">
                    <Camera className="w-4 h-4 text-[#b8541e]" />
                  </div>
                  Profile Photo
                </CardTitle>
                {!isPhotoOpen && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <Lock className="w-3 h-3" /> Read Only (Locked by Admin)
                  </span>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="relative group shrink-0">
                    {/* Perfectly wrapped circular avatar frame */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full aspect-square overflow-hidden ring-4 ring-[#d4af37]/40 shadow-lg bg-emerald-950 flex items-center justify-center">
                      {avatarUrl ? (
                        <ProfilePhoto
                          src={avatarUrl}
                          alt={user?.firstName || "Student"}
                          loading="eager"
                          decoding="async"
                          fit="cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#1e1b4b] to-[#1e3a8a] text-xl sm:text-2xl font-bold text-white">
                          {getInitials(user?.firstName || "T", user?.lastName || "A")}
                        </div>
                      )}
                    </div>
                    {uploadingPhoto && (
                      <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-center sm:text-left flex-1">
                    <h4 className="text-sm font-semibold text-gray-900">
                      {user?.firstName} {user?.lastName}
                    </h4>
                    <p className="text-xs text-gray-500">
                      Upload a high-resolution portrait. JPG, PNG or WebP up to 5MB.
                    </p>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoSelect}
                        accept="image/png,image/jpeg,image/webp,image/avif"
                        className="hidden"
                        disabled={!isPhotoOpen || uploadingPhoto}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!isPhotoOpen || uploadingPhoto}
                        className="text-xs rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50 h-8"
                      >
                        {uploadingPhoto ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Upload Photo
                      </Button>
                      {avatarUrl && isPhotoOpen && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePhoto}
                          className="text-xs text-rose-600 hover:bg-rose-50 h-8"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Personal Information */}
        {isPersonalVisible && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="fatimi-card">
            <div className="fatimi-card-header" />
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100">
                  <User className="w-4 h-4 text-[#b8541e]" />
                </div>
                Personal Information
              </CardTitle>
              {!isPersonalOpen && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <Lock className="w-3 h-3" /> Read Only (Locked by Admin)
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="talabatName" className="text-sm font-medium text-gray-700">
                    Talabat Name
                  </label>
                  <input
                    id="talabatName"
                    name="talabatName"
                    className="fatimi-input mt-1 bg-gray-50/70"
                    value={`${user?.firstName || ""} ${user?.lastName || ""}`}
                    readOnly
                  />
                </div>
                <div>
                  <label htmlFor="email" className="text-sm font-medium text-gray-700 flex items-center justify-between">
                    <span>Institutional Mailflare Email</span>
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      No Middle Name
                    </span>
                  </label>
                  <input
                    id="email"
                    name="email"
                    className="fatimi-input mt-1 bg-gray-50/70 font-mono text-emerald-900 font-bold"
                    value={formatTalabatEmail(user?.firstName, user?.lastName, user?.email)}
                    readOnly
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Internal student address: <code>firstname.lastname@darseburhani.galiakot</code> (Walled garden network).
                  </p>
                </div>
                <div>
                  <label htmlFor="age" className="text-sm font-medium text-gray-700">
                    Age
                  </label>
                  <input
                    id="age"
                    name="age"
                    disabled={!isPersonalOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    type="number"
                    placeholder="Enter age"
                    value={profile.age}
                    onChange={(e) => handleChange("age", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="status" className="text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    id="status"
                    name="status"
                    disabled={!isPersonalOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    value={profile.status}
                    onChange={(e) => handleChange("status", e.target.value)}
                  >
                    <option value="">Select status</option>
                    <option value="HAFIZ">Hafiz</option>
                    <option value="SANAH">Sanah</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="bloodGroup" className="text-sm font-medium text-gray-700">
                    Blood Group
                  </label>
                  <input
                    id="bloodGroup"
                    name="bloodGroup"
                    disabled={!isPersonalOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    placeholder="e.g., A+ ve"
                    value={profile.bloodGroup}
                    onChange={(e) => handleChange("bloodGroup", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="hafizYear" className="text-sm font-medium text-gray-700">
                    Hafiz Year (Hijri)
                  </label>
                  <input
                    id="hafizYear"
                    name="hafizYear"
                    disabled={!isPersonalOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    placeholder="e.g., 1445"
                    value={profile.hafizYear}
                    onChange={(e) => handleChange("hafizYear", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="dobGregorian" className="text-sm font-medium text-gray-700">
                    Date of Birth (Gregorian)
                  </label>
                  <input
                    id="dobGregorian"
                    name="dobGregorian"
                    disabled={!isPersonalOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    type="date"
                    value={profile.dobGregorian}
                    onChange={(e) => handleChange("dobGregorian", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="dobHijri" className="text-sm font-medium text-gray-700">
                    Date of Birth (Hijri)
                  </label>
                  <input
                    id="dobHijri"
                    name="dobHijri"
                    disabled={!isPersonalOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    placeholder="e.g., 5/1/1428"
                    value={profile.dobHijri}
                    onChange={(e) => handleChange("dobHijri", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        )}

        {/* Student IDs & Identification */}
        {isIdentifiersVisible && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="fatimi-card">
            <div className="fatimi-card-header" />
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100">
                  <ShieldCheck className="w-4 h-4 text-[#b8541e]" />
                </div>
                Student Identification
              </CardTitle>
              {!isIdentifiersOpen && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                  <Lock className="w-3 h-3" /> Admin Verified
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="its" className="text-sm font-medium text-gray-700">
                    ITS No.
                  </label>
                  <input
                    id="its"
                    name="its"
                    disabled={!isIdentifiersOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-80"
                    placeholder="ITS number"
                    value={profile.its}
                    onChange={(e) => handleChange("its", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="trNo" className="text-sm font-medium text-gray-700">
                    TR No.
                  </label>
                  <input
                    id="trNo"
                    name="trNo"
                    disabled={!isIdentifiersOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-80"
                    placeholder="TR number"
                    value={profile.trNo}
                    onChange={(e) => handleChange("trNo", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        )}

        {/* Academic Information */}
        {isAcademicVisible && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="fatimi-card">
            <div className="fatimi-card-header" />
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100">
                  <GraduationCap className="w-4 h-4 text-[#b8541e]" />
                </div>
                Academic Information
              </CardTitle>
              {!isAcademicOpen && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <Lock className="w-3 h-3" /> Read Only (Locked by Admin)
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="grade" className="text-sm font-medium text-gray-700">
                    Standard (Grade)
                  </label>
                  <input
                    id="grade"
                    name="grade"
                    disabled={!isAcademicOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    placeholder="Grade"
                    value={profile.grade}
                    onChange={(e) => handleChange("grade", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="section" className="text-sm font-medium text-gray-700">
                    Section
                  </label>
                  <input
                    id="section"
                    name="section"
                    disabled={!isAcademicOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    placeholder="Section"
                    value={profile.section}
                    onChange={(e) => handleChange("section", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="admissionYear" className="text-sm font-medium text-gray-700">
                    Admission Year
                  </label>
                  <input
                    id="admissionYear"
                    name="admissionYear"
                    disabled={!isAcademicOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    placeholder="e.g., 2023"
                    value={profile.admissionYear}
                    onChange={(e) => handleChange("admissionYear", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="currentYear" className="text-sm font-medium text-gray-700">
                    Current Year
                  </label>
                  <input
                    id="currentYear"
                    name="currentYear"
                    disabled={!isAcademicOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    placeholder="e.g., 2024"
                    value={profile.currentYear}
                    onChange={(e) => handleChange("currentYear", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <span id="furtherStudiesLabel" className="text-sm font-medium text-gray-700">
                    Further Studies
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby="furtherStudiesLabel"
                    className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2"
                  >
                    {[
                      { value: "HSC (10)", hint: "Class 10" },
                      { value: "HSC (12)", hint: "Class 12" },
                      { value: "Graduate", hint: "College" },
                    ].map((opt) => {
                      const selected = profile.externalSchooling === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          disabled={!isAcademicOpen}
                          onClick={() =>
                            handleChange("externalSchooling", selected ? "" : opt.value)
                          }
                          className={`flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
                            selected
                              ? "border-emerald-600 bg-emerald-50 shadow-sm ring-2 ring-emerald-600/20"
                              : "border-gray-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
                          }`}
                        >
                          <span>
                            <span className={`block text-sm font-bold ${selected ? "text-emerald-900" : "text-gray-800"}`}>
                              {opt.value}
                            </span>
                            <span className="block text-[11px] font-medium text-gray-500">{opt.hint}</span>
                          </span>
                          <span
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                              selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-gray-300 text-transparent"
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-gray-500">
                    Tap to select your further-studies level. Tap again to clear.
                    {profile.externalSchooling ? (
                      <span className="font-semibold text-emerald-700"> Selected: {profile.externalSchooling}</span>
                    ) : (
                      <span> No level selected.</span>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        )}

        {/* Darajah 4 Special: Identity Prompts & Knowing Myself Assessment */}
        {isDarajah4 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}>
            <Card className="fatimi-card border-2 border-amber-300/80 shadow-md">
              <div className="fatimi-card-header bg-gradient-to-r from-amber-500 via-emerald-600 to-amber-600" />
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
                    <Sparkles className="w-4 h-4 text-[#b8541e]" />
                  </div>
                  <div>
                    <span className="block text-base font-bold text-slate-900">
                      Personal Reflections &amp; Aspirations
                    </span>
                    <span className="text-xs font-normal text-slate-500">
                      Darajah 4 (Rabea) Special Profile Settings
                    </span>
                  </div>
                </CardTitle>

                {profile.knowingMyselfSubmitted ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>✓ Assessment Submitted</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                    <span>Compulsory · Action Required</span>
                  </span>
                )}
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Knowing Myself Full Assessment Banner / Link */}
                <div className="rounded-2xl p-4 sm:p-5 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 via-teal-50/50 to-white flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 bg-emerald-200/70 px-2 py-0.5 rounded-md">
                        Compulsory Document
                      </span>
                      {profile.knowingMyselfSubmitted && (
                        <span className="text-[11px] font-semibold text-emerald-800">
                          {profile.knowingMyselfSubmittedAt
                            ? `Submitted on ${new Date(profile.knowingMyselfSubmittedAt).toLocaleDateString()}`
                            : "Recorded in Admin Dossier"}
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-bold text-slate-900">
                      Knowing Myself — My Identity and Aspirations
                    </h4>
                    <p className="text-xs text-slate-600 leading-relaxed max-w-2xl">
                      Complete the full questionnaire covering your greatest strengths, activities you enjoy, overcoming obstacles, and aspirations for khidmat. All questions are compulsory for Darajah 4 talabat.
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center">
                    <Link href="/talabat/knowing-myself">
                      <Button
                        type="button"
                        className={
                          profile.knowingMyselfSubmitted
                            ? "border-2 border-emerald-600 text-emerald-800 bg-white hover:bg-emerald-50 font-bold text-xs rounded-xl shadow-xs"
                            : "fatimi-emerald-gradient text-white font-bold text-xs rounded-xl shadow-md hover:opacity-95"
                        }
                      >
                        <Compass className="w-4 h-4 mr-1.5" />
                        {profile.knowingMyselfSubmitted
                          ? "Review / Edit Assessment →"
                          : "Fill Compulsory Assessment →"}
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* 3 Core Quick Identity Prompts */}
                <div className="space-y-4 pt-2">
                  <div className="border-b border-slate-200 pb-2">
                    <h5 className="text-sm font-bold text-slate-900">
                      Core Identity &amp; Learning Prompts
                    </h5>
                    <p className="text-xs text-slate-500">
                      These 3 core prompts will appear prominently on Page 1 of your official Darajah 4 A4 dossier sheet.
                    </p>
                  </div>

                  {/* Prompt 1 */}
                  <div className="space-y-1.5">
                    <label htmlFor="reallyGoodAt" className="block text-xs font-bold text-slate-800">
                      1. I am really Good at ...
                    </label>
                    <input
                      id="reallyGoodAt"
                      name="reallyGoodAt"
                      disabled={!isAcademicOpen}
                      className="fatimi-input w-full disabled:bg-gray-100 disabled:opacity-75"
                      placeholder="e.g. History and Geography, Problem solving, Public speaking"
                      value={profile.reallyGoodAt || ""}
                      onChange={(e) => handleChange("reallyGoodAt", e.target.value)}
                    />
                    <p className="text-[11px] text-slate-500 italic pl-1">
                      Eg: I’m really good at History and Geography
                    </p>
                  </div>

                  {/* Prompt 2 */}
                  <div className="space-y-1.5">
                    <label htmlFor="loveToStudy" className="block text-xs font-bold text-slate-800">
                      2. I love to study about ... because ...
                    </label>
                    <input
                      id="loveToStudy"
                      name="loveToStudy"
                      disabled={!isAcademicOpen}
                      className="fatimi-input w-full disabled:bg-gray-100 disabled:opacity-75"
                      placeholder="e.g. emotions, cognitive development because I'm a life long learner"
                      value={profile.loveToStudy || ""}
                      onChange={(e) => handleChange("loveToStudy", e.target.value)}
                    />
                    <p className="text-[11px] text-slate-500 italic pl-1">
                      Eg: I love to study about emotions, cognitive development because I’m a life long learner
                    </p>
                  </div>

                  {/* Prompt 3 */}
                  <div className="space-y-1.5">
                    <label htmlFor="loveForFun" className="block text-xs font-bold text-slate-800">
                      3. I really love to ..... For Fun
                    </label>
                    <input
                      id="loveForFun"
                      name="loveForFun"
                      disabled={!isAcademicOpen}
                      className="fatimi-input w-full disabled:bg-gray-100 disabled:opacity-75"
                      placeholder="e.g. write stories for fun, play football, read biographies"
                      value={profile.loveForFun || ""}
                      onChange={(e) => handleChange("loveForFun", e.target.value)}
                    />
                    <p className="text-[11px] text-slate-500 italic pl-1">
                      Eg: I really love to write stories for fun
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Contact & Location */}
        {isContactVisible && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="fatimi-card">
            <div className="fatimi-card-header" />
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100">
                  <MapPin className="w-4 h-4 text-[#b8541e]" />
                </div>
                Contact & Location
              </CardTitle>
              {!isContactOpen && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <Lock className="w-3 h-3" /> Read Only (Locked by Admin)
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="watan" className="text-sm font-medium text-gray-700">
                    Watan
                  </label>
                  <input
                    id="watan"
                    name="watan"
                    disabled={!isContactOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    placeholder="Enter watan"
                    value={profile.watan}
                    onChange={(e) => handleChange("watan", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="residentCity" className="text-sm font-medium text-gray-700">
                    Resident City
                  </label>
                  <input
                    id="residentCity"
                    name="residentCity"
                    disabled={!isContactOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    placeholder="Enter resident city"
                    value={profile.residentCity}
                    onChange={(e) => handleChange("residentCity", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="address" className="text-sm font-medium text-gray-700">
                    Address
                  </label>
                  <textarea
                    id="address"
                    name="address"
                    disabled={!isContactOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    rows={2}
                    placeholder="Enter full address"
                    value={profile.address}
                    onChange={(e) => handleChange("address", e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="mobileNumber" className="text-sm font-medium text-gray-700">
                    Mobile Number
                  </label>
                  <input
                    id="mobileNumber"
                    name="mobileNumber"
                    disabled={!isContactOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    type="tel"
                    placeholder="Enter mobile number"
                    value={profile.mobileNumber}
                    onChange={(e) => handleChange("mobileNumber", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        )}

        {/* Change Password */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="fatimi-card">
            <div className="fatimi-card-header" />
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100">
                  <KeyRound className="w-4 h-4 text-[#b8541e]" />
                </div>
                Change Password
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="currentPassword" className="text-sm font-medium text-gray-700">
                      Current Password
                    </label>
                    <div className="relative mt-1">
                      <input
                        id="currentPassword"
                        name="currentPassword"
                        type={showPasswords ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="fatimi-input w-full pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPasswords(!showPasswords)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-600"
                        aria-label={showPasswords ? "Hide passwords" : "Show passwords"}
                      >
                        {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="newPassword" className="text-sm font-medium text-gray-700">
                      New Password
                    </label>
                    <input
                      id="newPassword"
                      name="newPassword"
                      type={showPasswords ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="fatimi-input mt-1 w-full"
                      minLength={3}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">
                      Confirm New Password
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showPasswords ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="fatimi-input mt-1 w-full"
                      minLength={3}
                      required
                    />
                  </div>
                </div>

                {pwMessage && (
                  <div
                    className={`flex items-center gap-2 text-sm rounded-xl px-4 py-3 ${
                      pwMessage.type === "success"
                        ? "text-emerald-800 bg-emerald-50 border border-emerald-200"
                        : "text-red-700 bg-red-50 border border-red-200"
                    }`}
                  >
                    {pwMessage.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    )}
                    {pwMessage.text}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={pwSaving}
                  className="fatimi-emerald-gradient text-white hover:opacity-90 shadow-md"
                >
                  {pwSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <KeyRound className="w-4 h-4 mr-2" />
                  )}
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>

        {/* Save Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="flex justify-end items-center gap-3"
        >
          {saved && (
            <span className="text-sm text-[#b8541e] flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Profile saved successfully!
            </span>
          )}
          <Button
            onClick={handleSave}
            disabled={loading || masterLocked}
            className="fatimi-emerald-gradient text-white hover:opacity-90 shadow-md"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" /> Save Profile
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
