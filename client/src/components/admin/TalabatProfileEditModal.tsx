"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  GraduationCap,
  MapPin,
  Heart,
  Sparkles,
  Shield,
  Camera,
  Save,
  Loader2,
  X,
  BookOpen,
  Award,
  Phone,
  Mail,
  Calendar,
  Droplet,
  Power,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  QrCode,
  FileText,
  Trash2,
  BellRing,
  Radio,
  Check,
  ChevronDown,
  ChevronUp,
  Layers,
  Wifi,
} from "lucide-react";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter, ModalClose } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

export interface StudentProfileFullData {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  nameAr?: string | null;
  email: string;
  isActive: boolean;
  avatarUrl?: string | null;
  studentId: string;
  its?: string | null;
  trNo?: string | null;
  grade: string;
  section: string;
  status?: string | null;
  bloodGroup?: string | null;
  dobGregorian?: string | null;
  dobHijri?: string | null;
  hafizYear?: string | null;
  motherName?: string | null;
  fatherName?: string | null;
  fatherOccupation?: string | null;
  age?: number | string | null;
  fatherEmail?: string | null;
  motherEmail?: string | null;
  fatherPhone?: string | null;
  motherPhone?: string | null;
  fatherPhotoUrl?: string | null;
  motherPhotoUrl?: string | null;
  admissionYear?: string | null;
  currentYear?: string | null;
  darsId?: string | null;
  externalSchooling?: string | null;
  watan?: string | null;
  residentCity?: string | null;
  address?: string | null;
  mobileNumber?: string | null;
  currentPoints?: number;
  totalPoints?: number;
  tier?: string;
  streakDays?: number;
  walletBalance?: number;
  biometricHash?: string | null;
  reallyGoodAt?: string | null;
  loveToStudy?: string | null;
  loveForFun?: string | null;
}

interface TalabatProfileEditModalProps {
  student: StudentProfileFullData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

type TabKey = "identity" | "academic" | "personal" | "family" | "reflection" | "security";

export function TalabatProfileEditModal({
  student,
  open,
  onOpenChange,
  onSaved,
}: TalabatProfileEditModalProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("identity");
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [fatherPhotoUrl, setFatherPhotoUrl] = useState<string | null>(null);
  const [motherPhotoUrl, setMotherPhotoUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [uploadingParentPhoto, setUploadingParentPhoto] = useState<string | null>(null);

  // Dynamic Available Classes & Biometric Terminals
  const [availableClasses, setAvailableClasses] = useState<any[]>([]);
  const [biometricDevices, setBiometricDevices] = useState<any[]>([]);
  const [deployingBiometric, setDeployingBiometric] = useState(false);

  // Notification Delivery Configuration & Diff Inspector
  const [notifyStudent, setNotifyStudent] = useState(true);
  const [notifyParents, setNotifyParents] = useState(true);
  const [adminNote, setAdminNote] = useState("");
  const [showNotifOptions, setShowNotifOptions] = useState(false);
  const [showDiffDrawer, setShowDiffDrawer] = useState(false);

  // Quick Password Reset State
  const [newPassword, setNewPassword] = useState("");
  const [resettingPw, setResettingPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const fatherInputRef = useRef<HTMLInputElement>(null);
  const motherInputRef = useRef<HTMLInputElement>(null);

  // Fetch active classes & hardware devices when modal opens
  useEffect(() => {
    if (open) {
      fetch("/api/admin/classes?pageSize=200")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setAvailableClasses(data.data);
          }
        })
        .catch(() => {});

      fetch("/api/biometric/devices")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.data)) {
            setBiometricDevices(data.data);
          }
        })
        .catch(() => {});
    }
  }, [open]);

  // Sync state whenever student prop changes
  useEffect(() => {
    if (student) {
      setFormData({
        firstName: student.firstName || "",
        lastName: student.lastName || "",
        nameAr: student.nameAr || "",
        email: student.email || "",
        isActive: student.isActive !== false,
        studentId: student.studentId || "",
        its: student.its || "",
        trNo: student.trNo || "",
        grade: student.grade || "1",
        section: student.section || "A",
        status: student.status || "SANAH",
        hafizYear: student.hafizYear || "",
        admissionYear: student.admissionYear || "",
        currentYear: student.currentYear || "1447 H",
        darsId: student.darsId || "",
        externalSchooling: student.externalSchooling || "",
        age: student.age ? String(student.age) : "",
        bloodGroup: student.bloodGroup || "",
        dobGregorian: student.dobGregorian ? student.dobGregorian.slice(0, 10) : "",
        dobHijri: student.dobHijri || "",
        watan: student.watan || "",
        residentCity: student.residentCity || "",
        address: student.address || "",
        mobileNumber: student.mobileNumber || "",
        fatherName: student.fatherName || "",
        fatherOccupation: student.fatherOccupation || "",
        fatherPhone: student.fatherPhone || "",
        fatherEmail: student.fatherEmail || "",
        motherName: student.motherName || "",
        motherPhone: student.motherPhone || "",
        motherEmail: student.motherEmail || "",
        biometricHash: student.biometricHash || student.its || "",
        currentPoints: student.currentPoints || 0,
        totalPoints: student.totalPoints || 0,
        tier: student.tier || "BRONZE",
        streakDays: student.streakDays || 0,
        walletBalance: student.walletBalance || 0,
        reallyGoodAt: student.reallyGoodAt || "",
        loveToStudy: student.loveToStudy || "",
        loveForFun: student.loveForFun || "",
      });
      setAvatarUrl(student.avatarUrl || null);
      setFatherPhotoUrl(student.fatherPhotoUrl || null);
      setMotherPhotoUrl(student.motherPhotoUrl || null);
      setActiveTab("identity");
      setSavedSuccess(false);
      setNewPassword("");
      setAdminNote("");
      setNotifyStudent(true);
      setNotifyParents(true);
      setShowDiffDrawer(false);
      setShowNotifOptions(false);
    }
  }, [student]);

  if (!student) return null;

  const handleFieldChange = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  // Detected Changes Calculation
  const getDetectedChanges = () => {
    if (!student) return [];
    const diffs: { field: string; label: string; oldVal: string; newVal: string }[] = [];

    const check = (key: string, label: string, formatter?: (v: any) => string) => {
      const rawOld = (student as any)[key];
      const rawNew = formData[key];
      const oldStr = formatter ? formatter(rawOld) : String(rawOld ?? "").trim();
      const newStr = formatter ? formatter(rawNew) : String(rawNew ?? "").trim();
      if (oldStr !== newStr) {
        diffs.push({ field: key, label, oldVal: oldStr || "(empty)", newVal: newStr || "(empty)" });
      }
    };

    check("firstName", "First Name");
    check("lastName", "Last Name");
    check("nameAr", "Arabic Name");
    check("email", "Portal Email");
    check("its", "ITS Number");
    check("trNo", "TR Number");
    check("grade", "Grade");
    check("section", "Section");
    check("status", "Hifz Status");
    check("hafizYear", "Hafiz Year");
    check("admissionYear", "Admission Year");
    check("currentYear", "Academic Year");
    check("darsId", "Dars ID");
    check("externalSchooling", "External Schooling");
    check("dobGregorian", "Gregorian DOB", (v) => (v ? String(v).slice(0, 10) : ""));
    check("dobHijri", "Hijri DOB");
    check("age", "Age", (v) => (v ? String(v) : ""));
    check("bloodGroup", "Blood Group");
    check("watan", "Watan / Hometown");
    check("residentCity", "Resident City");
    check("address", "Address");
    check("mobileNumber", "Student Mobile");
    check("fatherName", "Father Name");
    check("fatherPhone", "Father Phone");
    check("fatherEmail", "Father Email");
    check("fatherOccupation", "Father Occupation");
    check("motherName", "Mother Name");
    check("motherPhone", "Mother Phone");
    check("motherEmail", "Mother Email");
    check("biometricHash", "Biometric ID");
    check("currentPoints", "Current Points", (v) => String(v ?? 0));
    check("totalPoints", "Total Points", (v) => String(v ?? 0));
    check("tier", "Tier");
    check("streakDays", "Streak Days", (v) => String(v ?? 0));
    check("walletBalance", "Wallet Balance", (v) => String(v ?? 0));
    check("reallyGoodAt", "Really Good At");
    check("loveToStudy", "Love To Study");
    check("loveForFun", "Love For Fun");

    if (student.isActive !== formData.isActive) {
      diffs.push({
        field: "isActive",
        label: "Account Status",
        oldVal: student.isActive ? "Active" : "Suspended",
        newVal: formData.isActive ? "Active" : "Suspended",
      });
    }

    const origAvatar = student.avatarUrl || null;
    if (origAvatar !== (avatarUrl || null)) {
      diffs.push({
        field: "avatarUrl",
        label: "Profile Photo",
        oldVal: origAvatar ? "Existing" : "None",
        newVal: avatarUrl ? "New Photo" : "Removed",
      });
    }

    const origFather = student.fatherPhotoUrl || null;
    if (origFather !== (fatherPhotoUrl || null)) {
      diffs.push({
        field: "fatherPhotoUrl",
        label: "Father Photo",
        oldVal: origFather ? "Existing" : "None",
        newVal: fatherPhotoUrl ? "New Photo" : "Removed",
      });
    }

    const origMother = student.motherPhotoUrl || null;
    if (origMother !== (motherPhotoUrl || null)) {
      diffs.push({
        field: "motherPhotoUrl",
        label: "Mother Photo",
        oldVal: origMother ? "Existing" : "None",
        newVal: motherPhotoUrl ? "New Photo" : "Removed",
      });
    }

    return diffs;
  };

  const detectedChanges = getDetectedChanges();

  // Dynamic Age & Hijri Calculators
  const calculateAge = (dobString: string) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  };

  const estimateHijri = (dobString: string) => {
    if (!dobString) return null;
    const dob = new Date(dobString);
    if (isNaN(dob.getTime())) return null;
    const gregYear = dob.getFullYear();
    const hijriYear = Math.round((gregYear - 621.57) * 1.0307);
    return `${hijriYear} H`;
  };

  const calculatedAge = calculateAge(formData.dobGregorian);
  const estimatedHijriYear = estimateHijri(formData.dobGregorian);

  // Dynamic Class Resolver
  const matchingClass = availableClasses.find(
    (c) =>
      String(c.grade).trim().toLowerCase() === String(formData.grade || "").trim().toLowerCase() &&
      String(c.section).trim().toLowerCase() === String(formData.section || "").trim().toLowerCase()
  );

  const handleDeployBiometric = async () => {
    if (!student) return;
    setDeployingBiometric(true);
    try {
      const res = await fetch(`/api/admin/students/${student.userId}/deploy-biometric`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Biometric Hardware Synchronized",
          description: data.message || "Student profile deployed to physical terminals successfully.",
          variant: "success",
        });
      } else {
        toast({
          title: "Terminal Sync Failed",
          description: data.error || "Failed to push student to biometric hardware",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Could not contact biometric server bridge",
        variant: "destructive",
      });
    } finally {
      setDeployingBiometric(false);
    }
  };

  const handleAvatarUpload = async (file?: File) => {
    if (!file || !student) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/students/${student.userId}/avatar`, {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setAvatarUrl(data.url);
        toast({ title: "Photo Updated", description: "Profile photo uploaded successfully.", variant: "success" });
      } else {
        toast({ title: "Upload Failed", description: data.error || "Failed to upload photo", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Network error uploading photo", variant: "destructive" });
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleParentPhotoUpload = async (file: File | undefined, field: "fatherPhotoUrl" | "motherPhotoUrl") => {
    if (!file || !student) return;
    setUploadingParentPhoto(field);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.success && json.url) {
        if (field === "fatherPhotoUrl") setFatherPhotoUrl(json.url);
        else setMotherPhotoUrl(json.url);
        toast({ title: "Parent Photo Updated", description: "Photo uploaded for official yearly record.", variant: "success" });
      } else {
        toast({ title: "Upload Failed", description: json.error || "Failed to upload photo", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to upload photo", variant: "destructive" });
    } finally {
      setUploadingParentPhoto(null);
      if (field === "fatherPhotoUrl" && fatherInputRef.current) fatherInputRef.current.value = "";
      if (field === "motherPhotoUrl" && motherInputRef.current) motherInputRef.current.value = "";
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
        body: JSON.stringify({ userId: student.userId, newPassword }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Password Reset Successful",
          description: `Password for ${student.firstName} updated. All previous sessions terminated.`,
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
    if (!student) return;
    setSaving(true);
    setSavedSuccess(false);

    try {
      const payload = {
        ...formData,
        avatarUrl,
        fatherPhotoUrl,
        motherPhotoUrl,
        notifyStudent,
        notifyParents,
        adminNote,
        changesSummary: detectedChanges.map((d) => `${d.label}: ${d.oldVal} ➔ ${d.newVal}`),
      };

      const res = await fetch(`/api/admin/students/${student.userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSavedSuccess(true);
        toast({
          title: "Profile Updated & Notified",
          description: `All records saved.${notifyStudent ? " Student notified." : ""}${notifyParents ? " Parents notified." : ""}`,
          variant: "success",
        });

        if (onSaved) onSaved();

        setTimeout(() => {
          onOpenChange(false);
        }, 1100);
      } else {
        toast({
          title: "Update Failed",
          description: data.error || "Failed to update profile",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Network Error",
        description: err?.message || "Failed to communicate with the server",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isHafiz = formData.status === "HAFIZ";

  const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
    { key: "identity", label: "Identity & Account", icon: User },
    { key: "academic", label: "Academic & Madrasah", icon: GraduationCap },
    { key: "personal", label: "Personal & Contact", icon: MapPin },
    { key: "family", label: "Parents & Family", icon: Heart },
    { key: "reflection", label: "Knowing Myself", icon: Sparkles },
    { key: "security", label: "Biometric & Security", icon: Shield },
  ];

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-slate-50 border border-slate-200 rounded-3xl shadow-2xl">
        {/* ── TOP HERO HEADER BANNER ── */}
        <div
          className="relative px-6 py-5 text-white flex flex-col sm:flex-row items-center sm:items-start gap-5 border-b border-emerald-900/40"
          style={{
            background: isHafiz
              ? "linear-gradient(135deg, #1e3a1e 0%, #134e2f 50%, #064e3b 100%)"
              : "linear-gradient(135deg, #064e3b 0%, #046a4e 50%, #024e39 100%)",
          }}
        >
          {/* Subtle Islamic Motif Top Background Pattern */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          {/* Profile Photo Avatar with Hover Camera Overlay */}
          <div className="relative group shrink-0">
            <Avatar className="w-20 h-20 sm:w-22 sm:h-22 rounded-2xl border-3 border-amber-300 shadow-md">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={formData.firstName} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-emerald-900 text-amber-200 text-xl font-bold">
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

            {/* Quick status pill */}
            <span
              className={`absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[9px] font-extrabold rounded-md shadow border ${
                formData.isActive
                  ? "bg-emerald-600 text-white border-emerald-400"
                  : "bg-red-600 text-white border-red-400"
              }`}
            >
              {formData.isActive ? "ACTIVE" : "INACTIVE"}
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
                  {formData.nameAr && (
                    <span className="text-base font-arabic text-amber-300 px-2 py-0.5 rounded-lg bg-black/20 border border-amber-300/30">
                      {formData.nameAr}
                    </span>
                  )}
                </div>
                <p className="text-xs text-emerald-200/90 font-mono mt-0.5">{formData.email}</p>
              </div>

              {/* Status Indicator & Changes Pill */}
              <div className="flex items-center justify-center sm:justify-end gap-1.5 flex-wrap">
                {isHafiz ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-900 shadow border border-amber-200">
                    <Sparkles className="w-3.5 h-3.5 text-slate-900" />
                    Hafiz al-Quran {formData.hafizYear ? `(${formData.hafizYear})` : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-700/80 text-emerald-100 border border-emerald-400/40">
                    <BookOpen className="w-3.5 h-3.5" />
                    Talabat (Sanah)
                  </span>
                )}

                {detectedChanges.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowDiffDrawer(!showDiffDrawer)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow border border-amber-200 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{detectedChanges.length} Changes</span>
                    {showDiffDrawer ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-black/20 text-emerald-200 border border-emerald-500/20">
                    <Check className="w-3 h-3 text-emerald-300" /> Clean
                  </span>
                )}
              </div>
            </div>

            {/* Quick Metadata Bar */}
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap text-xs">
              <span className="bg-emerald-950/60 text-emerald-200 px-2.5 py-0.5 rounded-lg border border-emerald-500/30 font-semibold font-mono">
                ITS: {formData.its || "—"}
              </span>
              {formData.trNo && (
                <span className="bg-amber-950/60 text-amber-200 px-2.5 py-0.5 rounded-lg border border-amber-500/30 font-semibold font-mono">
                  TR: {formData.trNo}
                </span>
              )}
              <span className="bg-blue-950/60 text-blue-200 px-2.5 py-0.5 rounded-lg border border-blue-500/30 font-semibold">
                Grade {formData.grade} ({formData.section})
              </span>
              <span className="bg-purple-950/60 text-purple-200 px-2.5 py-0.5 rounded-lg border border-purple-500/30 font-semibold">
                {formData.currentPoints || 0} Points ({formData.tier || "BRONZE"})
              </span>
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

        {/* ── HORIZONTAL TABBED NAVIGATION ── */}
        <div className="flex items-center px-6 bg-white border-b border-slate-200 overflow-x-auto gap-1 py-1.5 scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  isSelected
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-amber-300" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── TAB CONTENT SCROLL AREA ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence mode="wait">
            {/* TAB 1: IDENTITY & ACCOUNT */}
            {activeTab === "identity" && (
              <motion.div
                key="tab-identity"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    <span>Core Identity &amp; Portal Account</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Arabic Full Name (الاسم باللغة العربية)
                      </label>
                      <input
                        type="text"
                        dir="rtl"
                        className="fatimi-input font-arabic text-right text-emerald-950 font-bold"
                        value={formData.nameAr || ""}
                        onChange={(e) => handleFieldChange("nameAr", e.target.value)}
                        placeholder="مثال: طه بن محمد"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Official Portal Email *</label>
                      <input
                        type="email"
                        className="fatimi-input font-mono text-xs"
                        value={formData.email || ""}
                        onChange={(e) => handleFieldChange("email", e.target.value)}
                        placeholder="its@darseburhani.edu"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">ITS Number *</label>
                      <input
                        type="text"
                        className="fatimi-input font-mono font-bold text-emerald-900"
                        value={formData.its || ""}
                        onChange={(e) => handleFieldChange("its", e.target.value)}
                        placeholder="8-digit ITS"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">TR Number (Tazyeen)</label>
                      <input
                        type="text"
                        className="fatimi-input font-mono"
                        value={formData.trNo || ""}
                        onChange={(e) => handleFieldChange("trNo", e.target.value)}
                        placeholder="e.g. TR-1049"
                      />
                    </div>
                  </div>
                </div>

                {/* Profile Photo Management */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="w-16 h-16 rounded-xl border-2 border-emerald-600 shadow-sm">
                      {avatarUrl ? <AvatarImage src={avatarUrl} alt="Preview" /> : null}
                      <AvatarFallback className="bg-emerald-800 text-white font-bold">
                        {getInitials(formData.firstName, formData.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Student Profile Picture</h4>
                      <p className="text-xs text-slate-500">Supports JPG, PNG, WebP up to 5MB. Synchronizes with ID cards and badges.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="border-emerald-600 text-emerald-800 hover:bg-emerald-50 text-xs font-bold"
                    >
                      <Camera className="w-3.5 h-3.5 mr-1" />
                      {avatarUrl ? "Change Photo" : "Upload Photo"}
                    </Button>
                    {avatarUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAvatarUrl(null)}
                        className="text-red-600 hover:bg-red-50 text-xs"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: ACADEMIC & MADRASAH */}
            {activeTab === "academic" && (
              <motion.div
                key="tab-academic"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                    <span>Academic Enrollment &amp; Class Placement</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Grade (Darajah) *</label>
                      <select
                        className="fatimi-input"
                        value={formData.grade || "1"}
                        onChange={(e) => handleFieldChange("grade", e.target.value)}
                      >
                        <option value="1">Grade 1 (Al-Ula)</option>
                        <option value="2">Grade 2 (Al-Thaniyah)</option>
                        <option value="3">Grade 3 (Al-Thalithah)</option>
                        <option value="4">Grade 4 (Al-Rabiah)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Section *</label>
                      <select
                        className="fatimi-input font-bold"
                        value={formData.section || "A"}
                        onChange={(e) => handleFieldChange("section", e.target.value)}
                      >
                        <option value="A">Section A</option>
                        <option value="B">Section B</option>
                        <option value="C">Section C</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Hifz / Sanah Status *</label>
                      <select
                        className="fatimi-input font-bold text-amber-900"
                        value={formData.status || "SANAH"}
                        onChange={(e) => handleFieldChange("status", e.target.value)}
                      >
                        <option value="SANAH">Sanah (Academic)</option>
                        <option value="HAFIZ">Hafiz al-Quran</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Hafiz Year (Hijri)</label>
                      <input
                        type="text"
                        className="fatimi-input"
                        value={formData.hafizYear || ""}
                        onChange={(e) => handleFieldChange("hafizYear", e.target.value)}
                        placeholder="e.g. 1445 H"
                      />
                    </div>
                  </div>

                  {/* Dynamic Matched Class Placement Info Banner */}
                  <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        {matchingClass ? (
                          <span>Matched Active Class: <strong>{matchingClass.name}</strong></span>
                        ) : (
                          <span>Custom Grade &amp; Section Placement</span>
                        )}
                      </div>
                      <div className="text-slate-600 text-[11px] mt-0.5">
                        {matchingClass ? (
                          <>
                            Room: {matchingClass.roomNumber || "Main Building"} • Teacher: {matchingClass.teacherName}
                            {matchingClass.masoolName ? ` • Masool: ${matchingClass.masoolName}` : ""}
                            {" • "}{matchingClass.academicYear}
                          </>
                        ) : (
                          "No registered timetable class matches this Grade & Section combination. ClassEnrollment will create a custom placeholder."
                        )}
                      </div>
                    </div>
                    <span className="shrink-0 px-2.5 py-1 rounded-md text-[10px] font-bold bg-white text-emerald-800 border border-emerald-300 shadow-2xs">
                      Auto-Enrollment Sync Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Admission Year</label>
                      <input
                        type="text"
                        className="fatimi-input"
                        value={formData.admissionYear || ""}
                        onChange={(e) => handleFieldChange("admissionYear", e.target.value)}
                        placeholder="e.g. 1442 H"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Current Academic Year</label>
                      <input
                        type="text"
                        className="fatimi-input"
                        value={formData.currentYear || "1447 H"}
                        onChange={(e) => handleFieldChange("currentYear", e.target.value)}
                        placeholder="1447 H"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Dars ID / Group</label>
                      <input
                        type="text"
                        className="fatimi-input font-mono"
                        value={formData.darsId || ""}
                        onChange={(e) => handleFieldChange("darsId", e.target.value)}
                        placeholder="e.g. DRS-01"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">External Schooling</label>
                      <input
                        type="text"
                        className="fatimi-input"
                        value={formData.externalSchooling || ""}
                        onChange={(e) => handleFieldChange("externalSchooling", e.target.value)}
                        placeholder="e.g. NIOS / Regular"
                      />
                    </div>
                  </div>
                </div>

                {/* Gamification, Streak & Tier */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-600" />
                    <span>Institutional Recognition &amp; Point Matrix</span>
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Current Points</label>
                      <input
                        type="number"
                        className="fatimi-input font-bold text-amber-800"
                        value={formData.currentPoints ?? 0}
                        onChange={(e) => handleFieldChange("currentPoints", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Total Lifetime Points</label>
                      <input
                        type="number"
                        className="fatimi-input font-bold"
                        value={formData.totalPoints ?? 0}
                        onChange={(e) => handleFieldChange("totalPoints", parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Tier Badge</label>
                      <select
                        className="fatimi-input font-bold"
                        value={formData.tier || "BRONZE"}
                        onChange={(e) => handleFieldChange("tier", e.target.value)}
                      >
                        <option value="BRONZE">Bronze Tier</option>
                        <option value="SILVER">Silver Tier</option>
                        <option value="GOLD">Gold Tier</option>
                        <option value="PLATINUM">Platinum Tier</option>
                        <option value="DIAMOND">Diamond Tier</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Attendance Streak (Days)</label>
                      <input
                        type="number"
                        className="fatimi-input font-bold text-emerald-800"
                        value={formData.streakDays ?? 0}
                        onChange={(e) => handleFieldChange("streakDays", parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: PERSONAL & CONTACT */}
            {activeTab === "personal" && (
              <motion.div
                key="tab-personal"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>Demographics &amp; Health</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth (Gregorian)</label>
                      <input
                        type="date"
                        className="fatimi-input"
                        value={formData.dobGregorian || ""}
                        onChange={(e) => handleFieldChange("dobGregorian", e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">DOB Hijri (التاريخ الهجري)</label>
                      <input
                        type="text"
                        className="fatimi-input"
                        value={formData.dobHijri || ""}
                        onChange={(e) => handleFieldChange("dobHijri", e.target.value)}
                        placeholder="e.g. 14 Rajab 1432 H"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
                      <input
                        type="number"
                        className="fatimi-input"
                        value={formData.age || ""}
                        onChange={(e) => handleFieldChange("age", e.target.value)}
                        placeholder="Age"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Blood Group</label>
                      <select
                        className="fatimi-input font-bold text-red-700"
                        value={formData.bloodGroup || ""}
                        onChange={(e) => handleFieldChange("bloodGroup", e.target.value)}
                      >
                        <option value="">Select blood group</option>
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

                  {/* Smart Age & Hijri Calculator Suggestion */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="text-slate-600">
                      {calculatedAge !== null ? (
                        <span>
                          Calculated from DOB: <strong className="text-emerald-700 font-bold">{calculatedAge} Years Old</strong>
                          {estimatedHijriYear ? ` • Estimated Hijri Year: ~${estimatedHijriYear}` : ""}
                        </span>
                      ) : (
                        <span className="text-slate-400">Select Gregorian DOB to auto-calculate exact Age and Hijri birth year.</span>
                      )}
                    </div>
                    {calculatedAge !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          handleFieldChange("age", String(calculatedAge));
                          if (!formData.dobHijri && estimatedHijriYear) {
                            handleFieldChange("dobHijri", estimatedHijriYear);
                          }
                          toast({ title: "Calculators Applied", description: `Age set to ${calculatedAge}.`, variant: "success" });
                        }}
                        className="text-xs text-emerald-800 hover:text-emerald-950 font-bold bg-white px-2.5 py-1 rounded-lg border border-slate-300 shadow-2xs hover:bg-emerald-50 transition-colors"
                      >
                        ⚡ Apply Calculated Age &amp; Hijri
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600" />
                    <span>Origin, Residence &amp; Direct Contact</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Student Mobile Number</label>
                      <input
                        type="tel"
                        className="fatimi-input font-mono"
                        value={formData.mobileNumber || ""}
                        onChange={(e) => handleFieldChange("mobileNumber", e.target.value)}
                        placeholder="+91 9876543210"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Watan (Homeland City)</label>
                      <input
                        type="text"
                        className="fatimi-input"
                        value={formData.watan || ""}
                        onChange={(e) => handleFieldChange("watan", e.target.value)}
                        placeholder="e.g. Surat, Galiakot, Sidhpur"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Resident City</label>
                      <input
                        type="text"
                        className="fatimi-input"
                        value={formData.residentCity || ""}
                        onChange={(e) => handleFieldChange("residentCity", e.target.value)}
                        placeholder="e.g. Mumbai, Dahod"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Permanent Residential Address</label>
                      <textarea
                        rows={2}
                        className="fatimi-input"
                        value={formData.address || ""}
                        onChange={(e) => handleFieldChange("address", e.target.value)}
                        placeholder="Full home postal address"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 4: PARENTS & FAMILY */}
            {activeTab === "family" && (
              <motion.div
                key="tab-family"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                {/* Father & Mother Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Father Details Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-600" />
                      <span>Father&apos;s Information</span>
                    </h4>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Father&apos;s Full Name</label>
                      <input
                        type="text"
                        className="fatimi-input"
                        value={formData.fatherName || ""}
                        onChange={(e) => handleFieldChange("fatherName", e.target.value)}
                        placeholder="Father's Name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Father&apos;s Occupation</label>
                      <input
                        type="text"
                        className="fatimi-input"
                        value={formData.fatherOccupation || ""}
                        onChange={(e) => handleFieldChange("fatherOccupation", e.target.value)}
                        placeholder="e.g. Business, Khidmat, Teacher"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Father&apos;s Phone</label>
                        <input
                          type="tel"
                          className="fatimi-input font-mono text-xs"
                          value={formData.fatherPhone || ""}
                          onChange={(e) => handleFieldChange("fatherPhone", e.target.value)}
                          placeholder="Phone"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Father&apos;s Email</label>
                        <input
                          type="email"
                          className="fatimi-input font-mono text-xs"
                          value={formData.fatherEmail || ""}
                          onChange={(e) => handleFieldChange("fatherEmail", e.target.value)}
                          placeholder="Email"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mother Details Card */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                      <User className="w-4 h-4 text-pink-600" />
                      <span>Mother&apos;s Information</span>
                    </h4>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Mother&apos;s Full Name</label>
                      <input
                        type="text"
                        className="fatimi-input"
                        value={formData.motherName || ""}
                        onChange={(e) => handleFieldChange("motherName", e.target.value)}
                        placeholder="Mother's Name"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Mother&apos;s Phone</label>
                        <input
                          type="tel"
                          className="fatimi-input font-mono text-xs"
                          value={formData.motherPhone || ""}
                          onChange={(e) => handleFieldChange("motherPhone", e.target.value)}
                          placeholder="Phone"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Mother&apos;s Email</label>
                        <input
                          type="email"
                          className="fatimi-input font-mono text-xs"
                          value={formData.motherEmail || ""}
                          onChange={(e) => handleFieldChange("motherEmail", e.target.value)}
                          placeholder="Email"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Yearly Profile Parent Photos Card */}
                <div className="p-5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-2">
                        <Camera className="w-4 h-4 text-amber-700" />
                        <span>Official Yearly Profile Parent Photos (توجيه الطالب)</span>
                      </h4>
                      <p className="text-xs text-amber-800 mt-0.5">
                        These photos appear in the student&apos;s official PDF portfolio and annual administration records.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Father Photo Box */}
                    <div className="flex items-center gap-4 p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center shrink-0">
                        {fatherPhotoUrl ? (
                          <img
                            src={fatherPhotoUrl}
                            alt="Father"
                            className="w-full h-full object-cover"
                            onError={(e: any) => (e.target.style.display = "none")}
                          />
                        ) : (
                          <User className="w-7 h-7 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs font-bold text-slate-800">Father&apos;s Photo</span>
                        <input
                          ref={fatherInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleParentPhotoUpload(e.target.files?.[0], "fatherPhotoUrl")}
                        />
                        <div className="flex items-center gap-1.5 mt-2">
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            className="h-7 px-2.5 text-xs font-bold border-amber-300 text-amber-900 hover:bg-amber-100"
                            onClick={() => fatherInputRef.current?.click()}
                            disabled={uploadingParentPhoto === "fatherPhotoUrl"}
                          >
                            {uploadingParentPhoto === "fatherPhotoUrl" ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <Camera className="w-3 h-3 mr-1" />
                            )}
                            {fatherPhotoUrl ? "Change" : "Upload"}
                          </Button>
                          {fatherPhotoUrl && (
                            <Button
                              size="sm"
                              type="button"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                              onClick={() => setFatherPhotoUrl(null)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mother Photo Box */}
                    <div className="flex items-center gap-4 p-3 bg-white rounded-xl border border-amber-200/80 shadow-2xs">
                      <div className="w-16 h-16 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center shrink-0">
                        {motherPhotoUrl ? (
                          <img
                            src={motherPhotoUrl}
                            alt="Mother"
                            className="w-full h-full object-cover"
                            onError={(e: any) => (e.target.style.display = "none")}
                          />
                        ) : (
                          <User className="w-7 h-7 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block text-xs font-bold text-slate-800">Mother&apos;s Photo</span>
                        <input
                          ref={motherInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleParentPhotoUpload(e.target.files?.[0], "motherPhotoUrl")}
                        />
                        <div className="flex items-center gap-1.5 mt-2">
                          <Button
                            size="sm"
                            type="button"
                            variant="outline"
                            className="h-7 px-2.5 text-xs font-bold border-amber-300 text-amber-900 hover:bg-amber-100"
                            onClick={() => motherInputRef.current?.click()}
                            disabled={uploadingParentPhoto === "motherPhotoUrl"}
                          >
                            {uploadingParentPhoto === "motherPhotoUrl" ? (
                              <Loader2 className="w-3 h-3 animate-spin mr-1" />
                            ) : (
                              <Camera className="w-3 h-3 mr-1" />
                            )}
                            {motherPhotoUrl ? "Change" : "Upload"}
                          </Button>
                          {motherPhotoUrl && (
                            <Button
                              size="sm"
                              type="button"
                              variant="ghost"
                              className="h-7 px-2 text-xs text-red-600 hover:bg-red-50"
                              onClick={() => setMotherPhotoUrl(null)}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 5: KNOWING MYSELF */}
            {activeTab === "reflection" && (
              <motion.div
                key="tab-reflection"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span>Rabea Special Passion &amp; Reflection Prompts</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        These responses are filled during student self-discovery and reviewed by teachers.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        1. I am really good at...
                      </label>
                      <textarea
                        rows={3}
                        className="fatimi-input"
                        value={formData.reallyGoodAt || ""}
                        onChange={(e) => handleFieldChange("reallyGoodAt", e.target.value)}
                        placeholder="Detail the student's natural talents, technical skills, art, or recitation strengths..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        2. I love to study about... because...
                      </label>
                      <textarea
                        rows={3}
                        className="fatimi-input"
                        value={formData.loveToStudy || ""}
                        onChange={(e) => handleFieldChange("loveToStudy", e.target.value)}
                        placeholder="Topics, subjects, books, or historical subjects the student is deeply curious about..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        3. I really love to... for fun
                      </label>
                      <textarea
                        rows={3}
                        className="fatimi-input"
                        value={formData.loveForFun || ""}
                        onChange={(e) => handleFieldChange("loveForFun", e.target.value)}
                        placeholder="Favorite sports, hobbies, creative activities, or recreations..."
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 6: BIOMETRIC & SECURITY */}
            {activeTab === "security" && (
              <motion.div
                key="tab-security"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="space-y-5"
              >
                {/* Biometric Terminal Mapping */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span>Hikvision MinMoe Terminal Biometric Synchronization</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    The biometric identifier matches face recognition scans and card punches from physical hardware to this student record.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Biometric Hardware Identifier (ITS / Card / Face ID)
                      </label>
                      <input
                        type="text"
                        className="fatimi-input font-mono font-bold text-emerald-950"
                        value={formData.biometricHash || ""}
                        onChange={(e) => handleFieldChange("biometricHash", e.target.value)}
                        placeholder="e.g. 50499945"
                      />
                      <span className="block text-[11px] text-slate-400 mt-1">
                        Defaults to the student&apos;s ITS number.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Account Sign-In Authority</label>
                      <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
                        <div className="flex items-center gap-2">
                          <Power className={`w-4 h-4 ${formData.isActive ? "text-emerald-600" : "text-red-500"}`} />
                          <span className="text-xs font-bold text-slate-800">
                            {formData.isActive ? "Account Active" : "Account Suspended"}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant={formData.isActive ? "outline" : "default"}
                          onClick={() => handleFieldChange("isActive", !formData.isActive)}
                          className={formData.isActive ? "text-amber-800 border-amber-200 text-xs" : "bg-emerald-700 text-white text-xs"}
                        >
                          {formData.isActive ? "Suspend Access" : "Activate Access"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Physical MinMoe Terminals Live Status & Deployment Control */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                        <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                        <span>Connected Physical MinMoe Terminals ({biometricDevices.length})</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Terminals poll face recognition and card scans directly on the local institutional network.
                      </p>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={handleDeployBiometric}
                      disabled={deployingBiometric}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 flex items-center gap-1.5"
                    >
                      {deployingBiometric ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Deploying to Terminals...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                          <span>Sync Student to Terminals</span>
                        </>
                      )}
                    </Button>
                  </div>

                  {biometricDevices.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                      No biometric terminals configured or reachable. Check Network Hardware Settings.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {biometricDevices.map((dev) => (
                        <div
                          key={dev.id}
                          className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  dev.status === "ONLINE" ? "bg-emerald-500 ring-2 ring-emerald-200" : "bg-slate-400"
                                }`}
                              />
                              <span>{dev.name}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {dev.host}:{dev.port} • {dev.model || "Hikvision MinMoe"}
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                              dev.enabled
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : "bg-slate-200 text-slate-600 border-slate-300"
                            }`}
                          >
                            {dev.enabled ? "ACTIVE" : "STANDBY"}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Instant Administrative Password Reset */}
                <div className="bg-white p-5 rounded-2xl border border-amber-200/80 bg-amber-50/20 shadow-2xs space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-600" />
                    <span>Administrative Password Override</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Immediately assigns a new password to this account and forces all active sessions to re-authenticate.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type={showNewPw ? "text" : "password"}
                        className="fatimi-input font-mono text-xs pr-10 font-bold"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password (min. 6 chars)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        title={showNewPw ? "Hide" : "Show"}
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
                      Reset Password
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={notifyStudent}
                    onChange={(e) => setNotifyStudent(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>Deliver Alert &amp; Web Push to Student ({formData.firstName})</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={notifyParents}
                    onChange={(e) => setNotifyParents(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span>Deliver Alert &amp; Web Push to Linked Guardians</span>
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
                  placeholder="e.g. Promoted to Grade 2, biometric ID re-synced"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── MODAL FOOTER WITH DYNAMIC NOTIFICATION CONTROLS ── */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setShowNotifOptions(!showNotifOptions)}
            className="flex items-center gap-2 text-xs text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-1.5 rounded-xl border border-emerald-200/80 transition-colors"
          >
            <BellRing className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">
              Alerts: <strong>Student {notifyStudent ? "ON" : "OFF"}</strong> • <strong>Guardians {notifyParents ? "ON" : "OFF"}</strong>
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
              disabled={saving}
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
