"use client";

import { useSession } from "next-auth/react";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { PageHeader } from "@/components/student/PageHeader";

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
  });

  useEffect(() => {
    fetchProfile();
    fetchPermissions();
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
      const res = await fetch("/api/talabat/profile");
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.avatarUrl || user?.avatarUrl || "");
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
        });
      }
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    }
  };

  const handleSave = async () => {
    if (masterLocked) {
      toast({ title: "Profile Editing Locked", description: "Admin has locked talabat profile updates.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch("/api/talabat/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          avatarUrl,
          age: profile.age ? parseInt(profile.age) : null,
        }),
      });
      if (res.ok) {
        setSaved(true);
        toast({ title: "Profile Saved", description: "Your profile changes were saved successfully.", variant: "success" });
        setTimeout(() => setSaved(false), 3000);
      } else {
        toast({ title: "Save Failed", description: "Failed to save profile changes.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Failed to save profile:", error);
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

  // Master switch from admin: false = whole profile read-only (nothing editable).
  const masterLocked = (permissions as Record<string, any>).masterEnabled === false;

  const isPhotoOpen = !masterLocked && permissions.photo?.isOpen !== false;
  const isPersonalOpen = !masterLocked && permissions.personal?.isOpen !== false;
  const isAcademicOpen = !masterLocked && permissions.academic?.isOpen !== false;
  const isContactOpen = !masterLocked && permissions.contact?.isOpen !== false;
  const isIdentifiersOpen = !masterLocked && permissions.identifiers?.isOpen === true;

  const isPhotoVisible = permissions.photo?.isVisible !== false && permissions.photo?.isVisibleToStudent !== false;
  const isPersonalVisible = permissions.personal?.isVisible !== false && permissions.personal?.isVisibleToStudent !== false;
  const isAcademicVisible = permissions.academic?.isVisible !== false && permissions.academic?.isVisibleToStudent !== false;
  const isContactVisible = permissions.contact?.isVisible !== false && permissions.contact?.isVisibleToStudent !== false;
  const isIdentifiersVisible = permissions.identifiers?.isVisible !== false && permissions.identifiers?.isVisibleToStudent !== false;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Banner */}
      <PageHeader
        icon={User}
        title="Talabat Profile"
        subtitle="Manage your personal and academic profile information"
      />

      {masterLocked && (
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
                    <Camera className="w-4 h-4 text-[#047857]" />
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
                  <div className="relative group">
                    <Avatar className="w-24 h-24 sm:w-28 sm:h-28 ring-4 ring-[#d4af37]/30 shadow-md">
                      {avatarUrl ? (
                        <AvatarImage src={avatarUrl} alt={user?.firstName || "Student"} className="object-cover" />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-br from-[#1e1b4b] to-[#1e3a8a] text-xl font-bold text-white">
                        {getInitials(user?.firstName || "T", user?.lastName || "A")}
                      </AvatarFallback>
                    </Avatar>
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
                  <User className="w-4 h-4 text-[#047857]" />
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
                  <label htmlFor="email" className="text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    className="fatimi-input mt-1 bg-gray-50/70"
                    value={user?.email || ""}
                    readOnly
                  />
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
                  <ShieldCheck className="w-4 h-4 text-[#047857]" />
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
                  <GraduationCap className="w-4 h-4 text-[#047857]" />
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
                  <label htmlFor="externalSchooling" className="text-sm font-medium text-gray-700">
                    External Schooling Status
                  </label>
                  <input
                    id="externalSchooling"
                    name="externalSchooling"
                    disabled={!isAcademicOpen}
                    className="fatimi-input mt-1 disabled:bg-gray-100 disabled:opacity-75"
                    placeholder="Enter external schooling status"
                    value={profile.externalSchooling}
                    onChange={(e) => handleChange("externalSchooling", e.target.value)}
                  />
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
                  <MapPin className="w-4 h-4 text-[#047857]" />
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
                  <KeyRound className="w-4 h-4 text-[#047857]" />
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
            <span className="text-sm text-[#047857] flex items-center gap-1 font-semibold">
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
