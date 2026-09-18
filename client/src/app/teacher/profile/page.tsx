"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import {
  User,
  Camera,
  UploadCloud,
  Save,
  Loader2,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  GraduationCap,
  Phone,
  Mail,
  Calendar,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

interface TeacherProfileForm {
  // 18 fields in strict sequence
  photoUrl: string;
  its: string;
  firstName: string;
  lastName: string;
  name: string;
  age: string;
  khidmatMauze: string;
  subCategory: string;
  role: string;
  farigYear: string;
  farigDarajah: string;
  aljameaDegree: string;
  hifzStatus: string;
  hifzYear: string;
  batchId: string;
  mobile: string;
  tEmail: string;
  khidmatYear: string;
  birthDateAd: string;
  birthDateH: string;
}

interface ItemPerm {
  id: string;
  label: string;
  isOpen: boolean;
  isVisible?: boolean;
}

interface PermissionsState {
  masterEnabled: boolean;
  masterVisible?: boolean;
  items: Record<string, ItemPerm>;
}

export default function TeacherProfilePage() {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [permissions, setPermissions] = useState<PermissionsState>({
    masterEnabled: true,
    masterVisible: true,
    items: {},
  });

  const [form, setForm] = useState<TeacherProfileForm>({
    photoUrl: "",
    its: "",
    firstName: "",
    lastName: "",
    name: "",
    age: "",
    khidmatMauze: "",
    subCategory: "",
    role: "",
    farigYear: "",
    farigDarajah: "",
    aljameaDegree: "",
    hifzStatus: "",
    hifzYear: "",
    batchId: "",
    mobile: "",
    tEmail: "",
    khidmatYear: "",
    birthDateAd: "",
    birthDateH: "",
  });

  // Password Change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [form.photoUrl]);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const search = typeof window !== "undefined" ? window.location.search : "";
      const res = await fetch(`/api/teacher/profile${search}`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          const d = json.data;
          setForm({
            photoUrl: d.photoUrl || d.avatarUrl || "",
            its: d.its || "",
            firstName: d.firstName || "",
            lastName: d.lastName || "",
            name: d.name || `${d.firstName || ""} ${d.lastName || ""}`.trim(),
            age: d.age?.toString() || "",
            khidmatMauze: d.khidmatMauze || "",
            subCategory: d.subCategory || "",
            role: d.role || d.roleTitle || "",
            farigYear: d.farigYear || "",
            farigDarajah: d.farigDarajah || "",
            aljameaDegree: d.aljameaDegree || "",
            hifzStatus: d.hifzStatus || "",
            hifzYear: d.hifzYear || "",
            batchId: d.batchId || "",
            mobile: d.mobile || "",
            tEmail: d.tEmail || d.email || "",
            khidmatYear: d.khidmatYear || "",
            birthDateAd: d.birthDateAd || "",
            birthDateH: d.birthDateH || "",
          });
        }
        if (json.permissions) {
          setPermissions(json.permissions);
        }
      } else {
        toast({ title: "Failed to load profile", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error connecting to server", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isEditable = (key: string): boolean => {
    if (!permissions.masterEnabled) return false;
    if (permissions.items[key]) {
      return permissions.items[key].isOpen;
    }
    return true;
  };

  const isVisible = (key: string): boolean => {
    if (permissions.masterVisible === false) return false;
    if (permissions.items && permissions.items[key]) {
      return permissions.items[key].isVisible !== false;
    }
    return true;
  };

  const handleFieldChange = (field: keyof TeacherProfileForm, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "firstName" || field === "lastName") {
        next.name = `${field === "firstName" ? value : prev.firstName} ${field === "lastName" ? value : prev.lastName}`.trim();
      }
      return next;
    });
  };

  // 1. Photo Upload Handler
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

      const res = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      if (res.ok && json.success && json.url) {
        setForm((prev) => ({ ...prev, photoUrl: json.url }));
        toast({ title: "Photo Uploaded", description: "Photo staged. Click Save Profile to apply permanently.", variant: "success" });
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
    setForm((prev) => ({ ...prev, photoUrl: "" }));
    toast({ title: "Photo Removed", description: "Click Save Profile to confirm removal.", variant: "warning" });
  };

  // Submit Profile Changes
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.masterEnabled) {
      toast({
        title: "Profile Editing Locked",
        description: "Admin has locked teacher profile updates.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/teacher/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          age: form.age ? parseInt(form.age, 10) : null,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          title: "Profile Updated",
          description: "Your teacher profile information has been saved successfully.",
          variant: "success",
        });
        fetchProfile();
      } else {
        toast({
          title: "Save Failed",
          description: json.error || "Could not save profile changes.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Network Error", description: "Failed to connect to server.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Password update
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "New password and confirmation do not match.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 3) {
      toast({ title: "Weak Password", description: "Password must be at least 3 characters.", variant: "destructive" });
      return;
    }

    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        toast({ title: "Password Changed", description: "Your password has been updated.", variant: "success" });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast({ title: "Error", description: json.error || "Failed to change password.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to connect to server.", variant: "destructive" });
    } finally {
      setPwSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-[#047857] mb-3" />
        <p className="text-sm font-medium text-gray-500">Loading Teacher Profile…</p>
      </div>
    );
  }

  const photoEditable = isEditable("photo");

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100/80 text-[#047857] shadow-sm">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-gray-900">
                Teacher Profile
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Darse Burhani Official Faculty Record
              </p>
            </div>
          </div>
        </div>

        {!permissions.masterEnabled ? (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 px-3 py-1 text-xs flex items-center gap-1.5 self-start sm:self-auto">
            <Lock className="w-3.5 h-3.5 text-amber-700" />
            Profile Editing Locked by Admin
          </Badge>
        ) : (
          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-300 px-3 py-1 text-xs flex items-center gap-1.5 self-start sm:self-auto">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Active Faculty Record
          </Badge>
        )}
      </motion.div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ==================================================================== */}
        {/* Item 1: Photo (Upload photo with proper sequence at top)             */}
        {/* ==================================================================== */}
        {isVisible("photo") && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card className="fatimi-card border-emerald-200/80 shadow-md overflow-hidden">
              <div className="fatimi-card-header" />
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-[#d4af37]/20 text-[#8c6508] font-bold text-xs">
                    1
                  </span>
                  <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    Photo (Official Faculty Portrait)
                  </CardTitle>
                </div>
                {!photoEditable && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <Lock className="w-3 h-3" /> Locked by Admin
                  </span>
                )}
              </CardHeader>
              <CardContent className="pt-2 pb-6">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="relative group shrink-0">
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl ring-4 ring-[#d4af37]/40 shadow-xl overflow-hidden bg-gradient-to-br from-[#047857] to-[#022c22] flex items-center justify-center transition-all duration-200 group-hover:scale-105 group-hover:ring-[#d4af37]/70">
                      {form.photoUrl && !imgError ? (
                        <img
                          src={form.photoUrl}
                          alt={form.name || "Teacher Photo"}
                          className="w-full h-full object-cover object-top"
                          loading="lazy"
                          decoding="async"
                          onError={() => setImgError(true)}
                        />
                      ) : (
                        <span className="text-3xl sm:text-4xl font-extrabold text-amber-200 tracking-wider select-none">
                          {getInitials(form.firstName || "U", form.lastName || "T")}
                        </span>
                      )}
                    </div>
                    {uploadingPhoto && (
                      <div className="absolute inset-0 bg-black/60 rounded-2xl flex flex-col items-center justify-center gap-1 backdrop-blur-xs">
                        <Loader2 className="w-6 h-6 text-white animate-spin" />
                        <span className="text-[10px] text-white font-medium">Uploading…</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <h3 className="text-sm font-semibold text-gray-900">
                      {form.name || `${form.firstName} ${form.lastName}` || "Teacher Photo"}
                    </h3>
                    <p className="text-xs text-gray-500 max-w-md">
                      Upload a clear, high-resolution portrait wearing Libas ul-Anwar. PNG, JPG or WebP up to 5MB.
                    </p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handlePhotoSelect}
                        accept="image/png,image/jpeg,image/webp,image/avif"
                        className="hidden"
                        disabled={!photoEditable || uploadingPhoto}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={!photoEditable || uploadingPhoto}
                        className="text-xs rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50 h-9 font-medium"
                      >
                        {uploadingPhoto ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Upload New Photo
                      </Button>
                      {form.photoUrl && photoEditable && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleRemovePhoto}
                          className="text-xs text-rose-600 hover:bg-rose-50 h-9"
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

        {/* ==================================================================== */}
        {/* Items 2 to 18: Exact Specified Sequence                               */}
        {/* ==================================================================== */}
        {["its", "name", "age", "khidmatMauze", "subCategory", "role", "farigYear", "farigDarajah", "aljameaDegree", "hifzStatus", "hifzYear", "batchId", "mobile", "tEmail", "khidmatYear", "birthDateAd", "birthDateH"].some(k => isVisible(k)) && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="fatimi-card border-gray-200 shadow-md">
            <div className="fatimi-card-header" />
            <CardHeader>
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-emerald-600" />
                Faculty Details &amp; Khidmat Profile
              </CardTitle>
              <CardDescription className="text-xs text-gray-500">
                Official profile attributes ordered according to institutional credentials.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 2. ITS No. */}
                {isVisible("its") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">2</span>
                        ITS No.
                      </label>
                      {!isEditable("its") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <input
                      type="text"
                      value={form.its}
                      disabled={!isEditable("its")}
                      onChange={(e) => handleFieldChange("its", e.target.value)}
                      placeholder="e.g. 30398412"
                      className="fatimi-input w-full h-10 text-xs font-mono font-bold tracking-wider disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}

                {/* 3. Name */}
                {isVisible("name") && (
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">3</span>
                        Name (Official Full Name)
                      </label>
                      {!isEditable("name") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={form.firstName}
                        disabled={!isEditable("name")}
                        onChange={(e) => handleFieldChange("firstName", e.target.value)}
                        placeholder="First Name / Title"
                        className="fatimi-input w-full h-10 text-xs font-semibold disabled:bg-gray-100 disabled:text-gray-500"
                      />
                      <input
                        type="text"
                        value={form.lastName}
                        disabled={!isEditable("name")}
                        onChange={(e) => handleFieldChange("lastName", e.target.value)}
                        placeholder="Last Name / Family"
                        className="fatimi-input w-full h-10 text-xs font-semibold disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    </div>
                  </div>
                )}

                {/* 4. Age */}
                {isVisible("age") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">4</span>
                        Age
                      </label>
                      {!isEditable("age") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <input
                      type="number"
                      value={form.age}
                      disabled={!isEditable("age")}
                      onChange={(e) => handleFieldChange("age", e.target.value)}
                      placeholder="Age in years"
                      className="fatimi-input w-full h-10 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}

                {/* 5. KhidmatMauze */}
                {isVisible("khidmatMauze") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">5</span>
                        KhidmatMauze
                      </label>
                      {!isEditable("khidmatMauze") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <input
                      type="text"
                      value={form.khidmatMauze}
                      disabled={!isEditable("khidmatMauze")}
                      onChange={(e) => handleFieldChange("khidmatMauze", e.target.value)}
                      placeholder="e.g. Surat, Mumbai, Karachi"
                      className="fatimi-input w-full h-10 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}

                {/* 6. Sub-Category */}
                {isVisible("subCategory") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">6</span>
                        Sub-Category
                      </label>
                      {!isEditable("subCategory") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <input
                      type="text"
                      value={form.subCategory}
                      disabled={!isEditable("subCategory")}
                      onChange={(e) => handleFieldChange("subCategory", e.target.value)}
                      placeholder="e.g. Ustaad, Idarah, Nazir"
                      className="fatimi-input w-full h-10 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}

                {/* 7. Role */}
                {isVisible("role") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">7</span>
                        Role
                      </label>
                      {!isEditable("role") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <input
                      type="text"
                      value={form.role}
                      disabled={!isEditable("role")}
                      onChange={(e) => handleFieldChange("role", e.target.value)}
                      placeholder="e.g. Hifz Ustaad / Class Masool"
                      className="fatimi-input w-full h-10 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}

                {/* 8. FarigYear */}
                {isVisible("farigYear") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">8</span>
                        FarigYear
                      </label>
                      {!isEditable("farigYear") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <input
                      type="text"
                      value={form.farigYear}
                      disabled={!isEditable("farigYear")}
                      onChange={(e) => handleFieldChange("farigYear", e.target.value)}
                      placeholder="e.g. 1440 H / 2019"
                      className="fatimi-input w-full h-10 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}

                {/* 9. FarigDarajah */}
                {isVisible("farigDarajah") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">9</span>
                        FarigDarajah
                      </label>
                      {!isEditable("farigDarajah") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <input
                      type="text"
                      value={form.farigDarajah}
                      disabled={!isEditable("farigDarajah")}
                      onChange={(e) => handleFieldChange("farigDarajah", e.target.value)}
                      placeholder="e.g. Darajah 11 / Al-Faqih"
                      className="fatimi-input w-full h-10 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}

                {/* 10. AljameaDegree */}
                {isVisible("aljameaDegree") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">10</span>
                        AljameaDegree
                      </label>
                      {!isEditable("aljameaDegree") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <input
                      type="text"
                      value={form.aljameaDegree}
                      disabled={!isEditable("aljameaDegree")}
                      onChange={(e) => handleFieldChange("aljameaDegree", e.target.value)}
                      placeholder="e.g. Al-Faqih al-Jayyid"
                      className="fatimi-input w-full h-10 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}

                {/* 11. Hifz Status */}
                {isVisible("hifzStatus") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">11</span>
                        Hifz Status
                      </label>
                      {!isEditable("hifzStatus") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <select
                      value={form.hifzStatus}
                      disabled={!isEditable("hifzStatus")}
                      onChange={(e) => handleFieldChange("hifzStatus", e.target.value)}
                      className="fatimi-input w-full h-10 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    >
                      <option value="">Select Hifz Status</option>
                      <option value="Hafiz">Hafiz</option>
                      <option value="Non-Hafiz">Non-Hafiz</option>
                      <option value="Mutim">Mutim (In Progress)</option>
                    </select>
                  </div>
                )}

                {/* 12. Hifz Year */}
                {isVisible("hifzYear") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">12</span>
                        Hifz Year
                      </label>
                      {!isEditable("hifzYear") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <input
                      type="text"
                      value={form.hifzYear}
                      disabled={!isEditable("hifzYear")}
                      onChange={(e) => handleFieldChange("hifzYear", e.target.value)}
                      placeholder="e.g. 1438 H"
                      className="fatimi-input w-full h-10 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}

                {/* 13. BatchID */}
                {isVisible("batchId") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">13</span>
                        BatchID
                      </label>
                      {!isEditable("batchId") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <input
                      type="text"
                      value={form.batchId}
                      disabled={!isEditable("batchId")}
                      onChange={(e) => handleFieldChange("batchId", e.target.value)}
                      placeholder="e.g. BATCH-1439"
                      className="fatimi-input w-full h-10 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}

                {/* 14. Mobile */}
                {isVisible("mobile") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">14</span>
                        Mobile
                      </label>
                      {!isEditable("mobile") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3" />
                      <input
                        type="tel"
                        value={form.mobile}
                        disabled={!isEditable("mobile")}
                        onChange={(e) => handleFieldChange("mobile", e.target.value)}
                        placeholder="+91 9876543210"
                        className="fatimi-input w-full h-10 text-xs pl-8 disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    </div>
                  </div>
                )}

                {/* 15. T_Email */}
                {isVisible("tEmail") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">15</span>
                        T_Email
                      </label>
                      {!isEditable("tEmail") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <div className="relative">
                      <Mail className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3" />
                      <input
                        type="email"
                        value={form.tEmail}
                        disabled={!isEditable("tEmail")}
                        onChange={(e) => handleFieldChange("tEmail", e.target.value)}
                        placeholder="teacher@darseburhani.com"
                        className="fatimi-input w-full h-10 text-xs pl-8 disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    </div>
                  </div>
                )}

                {/* 16. KhidmatYear */}
                {isVisible("khidmatYear") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">16</span>
                        KhidmatYear
                      </label>
                      {!isEditable("khidmatYear") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <input
                      type="text"
                      value={form.khidmatYear}
                      disabled={!isEditable("khidmatYear")}
                      onChange={(e) => handleFieldChange("khidmatYear", e.target.value)}
                      placeholder="e.g. 5 Years / Joined 1441"
                      className="fatimi-input w-full h-10 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}

                {/* 17. BIRTHDT_AD */}
                {isVisible("birthDateAd") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">17</span>
                        BIRTHDT_AD
                      </label>
                      {!isEditable("birthDateAd") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-3" />
                      <input
                        type="date"
                        value={form.birthDateAd}
                        disabled={!isEditable("birthDateAd")}
                        onChange={(e) => handleFieldChange("birthDateAd", e.target.value)}
                        className="fatimi-input w-full h-10 text-xs pl-8 disabled:bg-gray-100 disabled:text-gray-500"
                      />
                    </div>
                  </div>
                )}

                {/* 18. BIRTHDT_H */}
                {isVisible("birthDateH") && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                        <span className="text-[10px] w-4 h-4 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center font-bold">18</span>
                        BIRTHDT_H
                      </label>
                      {!isEditable("birthDateH") && <span title="Locked by Admin"><Lock className="w-3 h-3 text-amber-600" /></span>}
                    </div>
                    <input
                      type="text"
                      value={form.birthDateH}
                      disabled={!isEditable("birthDateH")}
                      onChange={(e) => handleFieldChange("birthDateH", e.target.value)}
                      placeholder="e.g. 15 Rajab 1412"
                      className="fatimi-input w-full h-10 text-xs disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-xs text-gray-500 text-center sm:text-left">
                  Items with a <Lock className="w-3 h-3 inline text-amber-600" /> icon are managed strictly under Administrator governance.
                </p>
                <Button
                  type="submit"
                  disabled={saving || !permissions.masterEnabled}
                  className="fatimi-emerald-gradient text-white shadow-md w-full sm:w-auto px-6 h-10 rounded-xl"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Profile Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        )}
      </form>

      {/* Password & Security Section */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <Card className="fatimi-card border-gray-200 shadow-sm">
          <div className="fatimi-card-header" />
          <CardHeader>
            <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#d4af37]" />
              Account Security &amp; Password
            </CardTitle>
            <CardDescription className="text-xs text-gray-500">
              Update your account credentials for portal sign-in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="teacher-current-password" className="text-xs font-semibold text-gray-700 block mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      id="teacher-current-password"
                      name="currentPassword"
                      autoComplete="current-password"
                      type={showPasswords ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="fatimi-input w-full h-10 text-xs pr-8"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute right-2.5 top-2.5 text-gray-500 hover:text-gray-600"
                    >
                      {showPasswords ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="teacher-new-password" className="text-xs font-semibold text-gray-700 block mb-1">New Password</label>
                  <input
                    id="teacher-new-password"
                    name="newPassword"
                    autoComplete="new-password"
                    type={showPasswords ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 3 characters"
                    className="fatimi-input w-full h-10 text-xs"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="teacher-confirm-password" className="text-xs font-semibold text-gray-700 block mb-1">Confirm New Password</label>
                  <input
                    id="teacher-confirm-password"
                    name="confirmPassword"
                    autoComplete="new-password"
                    type={showPasswords ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    className="fatimi-input w-full h-10 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={pwSaving}
                  className="rounded-xl h-9 text-xs border-amber-300 text-amber-900 hover:bg-amber-50"
                >
                  {pwSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5 mr-1.5" />}
                  Change Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
