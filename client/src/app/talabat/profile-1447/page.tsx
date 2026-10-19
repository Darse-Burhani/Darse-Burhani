"use client";

import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import {
  User,
  Upload,
  Save,
  Send,
  Eye,
  FileEdit,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Plus,
  Trash2,
  Image as ImageIcon,
  GraduationCap,
  Users,
  BookOpen,
  Award,
  Camera,
  ZoomIn,
  X,
} from "lucide-react";
import { TalabatProfileDocument, TalabatProfileData } from "@/components/talabat/TalabatProfileDocument";

export default function TalabatProfile1447Page() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isGrade4, setIsGrade4] = useState<boolean | null>(null);
  const [isParent, setIsParent] = useState<boolean>(false);
  const isParentUser = session?.user?.role === "PARENT" || isParent;
  const [studentInfo, setStudentInfo] = useState<{ id: string; name: string; grade: string; section?: string; its?: string } | null>(null);
  const [availableChildren, setAvailableChildren] = useState<Array<{ id: string; name: string; grade: string; isGrade4: boolean }>>([]);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [lightboxImg, setLightboxImg] = useState<{ url: string; title: string } | null>(null);

  const [formData, setFormData] = useState<TalabatProfileData>({
    year: "1447 H",
    status: "DRAFT",
    studentPhotoUrl: "",
    name: "",
    itsNo: "",
    idNo: "",
    jamaat: "",
    vatan: "",
    nationality: "Indian",
    dob: "",
    age: "",
    fatherPhotoUrl: "",
    fatherName: "",
    fatherOccupation: "",
    motherPhotoUrl: "",
    motherName: "",
    motherOccupation: "Homemaker",
    result1444: "",
    result1445: "",
    result1446: "",
    result1447: "",
    hifzYear: "",
    hifzTabaqa: "",
    course1: "",
    course2: "",
    course3: "",
    course4: "",
    activities: "",
    otherExams: "",
    strengths: ["", "", ""],
    weaknesses: ["", "", ""],
    aboutMyself: "",
    behaviourRating: null,
    communicationRating: null,
    dedicationRating: null,
    disciplineRating: null,
    masoolRemarks: "",
  });

  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);

  useEffect(() => {
    const qId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("studentId") : null;
    if (qId) setSelectedChildId(qId);
    fetchProfile(qId || undefined);
  }, []);

  const fetchProfile = async (targetStudentId?: string) => {
    try {
      setLoading(true);
      const effectiveId = targetStudentId || selectedChildId;
      const url = effectiveId ? `/api/talabat-profile/me?studentId=${effectiveId}` : "/api/talabat-profile/me";
      const res = await fetch(url);
      const data = await res.json();

      if (!data.success) {
        setNotification({ type: "error", text: data.error || "Failed to load profile" });
        setIsGrade4(false);
        return;
      }

      setIsGrade4(data.isGrade4);
      if (data.isParent || session?.user?.role === "PARENT") {
        setIsParent(true);
        setActiveTab("preview");
      }
      if (data.studentInfo) {
        setStudentInfo(data.studentInfo);
        if (data.studentInfo.id) setSelectedChildId(data.studentInfo.id);
      }
      if (data.availableChildren) setAvailableChildren(data.availableChildren);

      if (data.isGrade4 && data.profile) {
        setFormData({
          ...data.profile,
          strengths: Array.isArray(data.profile.strengths) && data.profile.strengths.length > 0
            ? data.profile.strengths
            : ["", "", ""],
          weaknesses: Array.isArray(data.profile.weaknesses) && data.profile.weaknesses.length > 0
            ? data.profile.weaknesses
            : ["", "", ""],
        });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Failed to load profile" });
    } finally {
      setLoading(false);
    }
  };

  const renderPhotoUploadField = (
    field: "studentPhotoUrl" | "fatherPhotoUrl" | "motherPhotoUrl",
    label: string,
    subtitle: string,
    inputId: string,
    guideline?: string
  ) => {
    const photoUrl = formData[field];
    const isUploading = uploadingField === field;
    const cameraInputId = `${inputId}-camera`;

    return (
      <div className="flex flex-col items-center w-full max-w-[260px]">
        <div className="flex items-center justify-between w-full mb-1.5 px-0.5">
          <span className="text-xs font-bold text-slate-800">{label}</span>
          {photoUrl ? (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1 shadow-2xs">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Saved
            </span>
          ) : (
            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Required
            </span>
          )}
        </div>

        <div className="w-full h-48 border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-2xl overflow-hidden relative flex flex-col items-center justify-center bg-slate-50/80 hover:bg-emerald-50/20 transition-all group shadow-2xs">
          {photoUrl ? (
            <div className="relative w-full h-full">
              <img
                src={photoUrl}
                alt={label}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              {/* Overlay with Zoom, Change & Remove actions */}
              <div className="absolute inset-0 bg-slate-900/65 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                <button
                  type="button"
                  onClick={() => setLightboxImg({ url: photoUrl, title: label })}
                  className="px-3 py-1.5 bg-white/90 hover:bg-white text-slate-900 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition-all cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-blue-600" />
                  Inspect Full
                </button>
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor={inputId}
                    className="px-2.5 py-1.5 bg-white text-slate-900 rounded-lg text-xs font-bold flex items-center gap-1 shadow hover:bg-slate-100 cursor-pointer transition-all"
                  >
                    <Upload className="w-3 h-3 text-emerald-700" />
                    Change
                  </label>
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(field)}
                    className="px-2.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow hover:bg-rose-700 cursor-pointer transition-all"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center select-none">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center mb-1.5 shadow-2xs group-hover:scale-105 transition-transform">
                <ImageIcon className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-slate-700 group-hover:text-emerald-800 transition-colors leading-tight">
                {subtitle}
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5">Passport photo format</span>
              {guideline && (
                <span className="text-[9px] text-emerald-900 bg-emerald-50/80 px-2 py-0.5 rounded mt-1 border border-emerald-200/60 leading-tight">
                  {guideline}
                </span>
              )}

              <div className="flex items-center gap-1.5 mt-2.5">
                <label
                  htmlFor={inputId}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 shadow-2xs hover:bg-emerald-800 hover:text-white cursor-pointer transition-all"
                >
                  <Upload className="w-3 h-3" />
                  Choose File
                </label>
                <label
                  htmlFor={cameraInputId}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 border border-amber-300 rounded-lg text-[11px] font-semibold text-amber-900 shadow-2xs hover:bg-amber-600 hover:text-white cursor-pointer transition-all"
                  title="Take photo using camera"
                >
                  <Camera className="w-3 h-3" />
                  Camera
                </label>
              </div>
            </div>
          )}

          {/* Loading Spinner Overlay */}
          {isUploading && (
            <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center z-20">
              <div className="w-7 h-7 border-3 border-emerald-700 border-t-transparent rounded-full animate-spin mb-1.5"></div>
              <span className="text-xs font-bold text-slate-800">Uploading &amp; saving...</span>
              <span className="text-[10px] text-slate-500">Please wait</span>
            </div>
          )}

          {/* Hidden File Input: Standard File Picker */}
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/avif,image/jfif,image/*"
            className="hidden"
            onChange={(e) => handleFileUpload(e, field)}
            disabled={isUploading}
          />

          {/* Hidden File Input: Direct Smartphone Camera Snap */}
          <input
            id={cameraInputId}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleFileUpload(e, field)}
            disabled={isUploading}
          />
        </div>

        {/* Visible buttons for touchscreens / quick access when photo is present */}
        {photoUrl && (
          <div className="flex items-center justify-between w-full mt-2 gap-1.5">
            <button
              type="button"
              onClick={() => setLightboxImg({ url: photoUrl, title: label })}
              className="py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold border border-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <ZoomIn className="w-3 h-3 text-blue-600" /> View
            </button>
            <label
              htmlFor={inputId}
              className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-[11px] font-semibold text-center cursor-pointer border border-slate-200 transition-colors flex items-center justify-center gap-1"
            >
              <Upload className="w-3 h-3 text-emerald-700" /> Change
            </label>
            <button
              type="button"
              onClick={() => handleRemovePhoto(field)}
              className="py-1 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-semibold cursor-pointer border border-rose-200 transition-colors flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Remove
            </button>
          </div>
        )}
      </div>
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: "studentPhotoUrl" | "fatherPhotoUrl" | "motherPhotoUrl") => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so re-selecting the exact same file fires onChange reliably
    e.target.value = "";

    const fd = new FormData();
    fd.append("file", file);

    try {
      setUploadingField(fieldName);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.success && data.url) {
        const updated = { ...formData, [fieldName]: data.url };
        setFormData(updated);

        // Auto-save photo into database draft immediately so it is never lost
        const saveRes = await fetch("/api/talabat-profile/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...updated,
            studentId: selectedChildId || studentInfo?.id,
            status: formData.status || "DRAFT",
          }),
        });
        const saveJson = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok || saveJson.success === false) {
          throw new Error(saveJson.error || "Upload succeeded but failed to save to database profile.");
        }

        const label =
          fieldName === "fatherPhotoUrl"
            ? "Father photo"
            : fieldName === "motherPhotoUrl"
            ? "Mother photo"
            : "Student photo";
        setNotification({ type: "success", text: `✓ ${label} uploaded and saved successfully!` });
      } else {
        setNotification({ type: "error", text: data.error || "Upload failed. Please check file format and size." });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Upload error" });
    } finally {
      setUploadingField(null);
    }
  };

  const handleRemovePhoto = async (fieldName: "studentPhotoUrl" | "fatherPhotoUrl" | "motherPhotoUrl") => {
    const updated = { ...formData, [fieldName]: "" };
    setFormData(updated);
    try {
      await fetch("/api/talabat-profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updated,
          studentId: selectedChildId || studentInfo?.id,
          status: formData.status || "DRAFT",
        }),
      });
      const label =
        fieldName === "fatherPhotoUrl"
          ? "Father photo"
          : fieldName === "motherPhotoUrl"
          ? "Mother photo"
          : "Student photo";
      setNotification({ type: "success", text: `${label} removed.` });
    } catch {
      setNotification({ type: "error", text: "Failed to remove photo." });
    }
  };

  const handleSave = async (submitStatus: "DRAFT" | "SUBMITTED") => {
    try {
      setSaving(true);
      setNotification(null);

      const res = await fetch("/api/talabat-profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          studentId: selectedChildId || studentInfo?.id,
          status: submitStatus,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFormData((prev) => ({ ...prev, status: submitStatus }));
        setNotification({
          type: "success",
          text: submitStatus === "SUBMITTED"
            ? "🎉 Profile submitted successfully to Administration & Teachers!"
            : "💾 Profile draft saved.",
        });
      } else {
        setNotification({ type: "error", text: data.error || "Failed to save profile" });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Network error while saving" });
    } finally {
      setSaving(false);
    }
  };

  const updateStrength = (index: number, val: string) => {
    setFormData((prev) => {
      const updated = [...(prev.strengths || [])];
      updated[index] = val;
      return { ...prev, strengths: updated };
    });
  };

  const addStrength = () => {
    setFormData((prev) => ({
      ...prev,
      strengths: [...(prev.strengths || []), ""],
    }));
  };

  const removeStrength = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      strengths: (prev.strengths || []).filter((_, i) => i !== index),
    }));
  };

  const updateWeakness = (index: number, val: string) => {
    setFormData((prev) => {
      const updated = [...(prev.weaknesses || [])];
      updated[index] = val;
      return { ...prev, weaknesses: updated };
    });
  };

  const addWeakness = () => {
    setFormData((prev) => ({
      ...prev,
      weaknesses: [...(prev.weaknesses || []), ""],
    }));
  };

  const removeWeakness = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      weaknesses: (prev.weaknesses || []).filter((_, i) => i !== index),
    }));
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-pulse">
        {/* Top Hero Banner Skeleton */}
        <div className="rounded-2xl bg-gradient-to-r from-[#06241a] via-[#0a3d2c] to-[#041a13] p-6 shadow-xl border border-emerald-800/40 relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-emerald-900/80 border border-emerald-700/50" />
              <div className="space-y-2">
                <div className="h-4 w-36 rounded-full bg-emerald-800/70" />
                <div className="h-7 w-64 sm:w-80 rounded-lg bg-emerald-700/60" />
                <div className="h-3.5 w-48 sm:w-72 rounded-md bg-emerald-800/50" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-7 w-24 rounded-full bg-emerald-800/60" />
              <div className="h-9 w-32 rounded-lg bg-emerald-700/60" />
            </div>
          </div>
        </div>

        {/* 3 Photo Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col items-center gap-3">
              <div className="w-28 h-36 rounded-xl bg-slate-200/80 border-2 border-dashed border-slate-300" />
              <div className="h-4 w-32 rounded bg-slate-200" />
              <div className="h-3 w-44 rounded bg-slate-100" />
            </div>
          ))}
        </div>

        {/* Form Section 1 Skeleton */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="w-6 h-6 rounded-full bg-emerald-100" />
            <div className="h-5 w-48 rounded bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3.5 w-24 rounded bg-slate-200" />
                <div className="h-10 w-full rounded-lg bg-slate-100 border border-slate-200" />
              </div>
            ))}
          </div>
        </div>

        {/* Form Section 2 Skeleton */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="w-6 h-6 rounded-full bg-amber-100" />
            <div className="h-5 w-52 rounded bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-3.5 w-20 rounded bg-slate-200" />
                <div className="h-10 w-full rounded-lg bg-slate-100 border border-slate-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isGrade4 === false) {
    return (
      <div className="max-w-xl mx-auto my-14 p-8 bg-white border border-emerald-900/10 rounded-2xl shadow-lg text-center">
        <div className="w-16 h-16 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
          <GraduationCap className="w-8 h-8 text-emerald-800" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 mb-3">
          Darajah Rabea (Grade 4) Exclusive
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 mb-2">Yearly Profile (1447 H)</h2>
        <p className="text-slate-600 text-sm leading-relaxed mb-6">
          The <strong>TALABAT PROFILE – 1447 H (Further Education: توجيه الطالب)</strong> is exclusively designated for students enrolled in <strong>Darajah 4 (Rabea)</strong> and their parents.
        </p>
        <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 border border-slate-200 leading-relaxed text-left space-y-1.5">
          <p className="font-semibold text-slate-800">Access Information:</p>
          <p>
            {isParentUser
              ? "None of your assigned children are currently enrolled in Darajah 4 (Rabea). Once a student enters Darajah Rabea, their verified yearly profile document will automatically appear here for inspection and printing."
              : "Your enrolled darajah is not Darajah 4 (Rabea). Yearly profile submission is reserved for Grade 4 Talabat."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* ── Top Hero Header (Fatimi Theme) ── */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-[#06241a] via-[#0a3d2c] to-[#041a13] text-white p-6 rounded-2xl shadow-xl relative overflow-hidden border border-emerald-700/40">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-4">
          <img
            src="/logo.png"
            alt="Darse Burhani"
            className="w-16 h-16 object-contain bg-white/10 p-1.5 rounded-xl border border-amber-400/30 backdrop-blur shadow-sm"
            onError={(e) => ((e.target as HTMLElement).style.display = "none")}
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider bg-amber-400/20 text-amber-300 border border-amber-400/30 px-2.5 py-0.5 rounded-full backdrop-blur">
                Academic Year 1447 H
              </span>
              <span className="text-xs font-semibold text-emerald-200">
                Further Education: توجيه الطالب
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white">
              TALABAT PROFILE – 1447 H
            </h1>
            <p className="text-emerald-100/80 text-xs sm:text-sm mt-0.5">
              {isParentUser
                ? "Official verified academic, hifz milestones and character records (Parent View-Only Mode)."
                : "Fill and submit your official comprehensive academic and self-assessment profile."}
            </p>
          </div>
        </div>

        {/* Status Badge & Actions */}
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-xs ${
            formData.status === "SUBMITTED"
              ? "bg-emerald-600 text-white border border-emerald-400/40"
              : formData.status === "REVIEWED"
              ? "bg-blue-600 text-white border border-blue-400/40"
              : "bg-amber-400 text-slate-900 border border-amber-300"
          }`}>
            Status: {formData.status || "DRAFT"}
          </div>

          <div className="flex items-center gap-2">
            {!isParentUser && (
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                  activeTab === "edit"
                    ? "bg-white text-[#0a3d2c] shadow-md"
                    : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                <FileEdit className="w-3.5 h-3.5 text-emerald-700" />
                Edit Form
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs ${
                activeTab === "preview"
                  ? "bg-white text-[#0a3d2c] shadow-md"
                  : "bg-white/15 text-white hover:bg-white/25"
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-amber-600" />
              {isParentUser ? "Official Document View" : "Document View & Print"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Parent Mode Banner (if logged in as parent) ── */}
      {isParentUser && (
        <div className="mb-6 bg-gradient-to-r from-emerald-50/80 via-white to-amber-50/60 border border-emerald-700/20 p-4 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-emerald-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 flex items-center justify-center shrink-0 shadow-2xs">
              <Users className="w-5 h-5 text-emerald-800" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-700 text-white px-2 py-0.5 rounded-full shadow-2xs">
                  Parent View-Only Mode
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {studentInfo?.name || "Student"} • Grade {studentInfo?.grade || "Rabea"}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Parents have view-only access to inspect and print this official Yearly Profile document. Form editing is restricted to Darajah Rabea students and school administration.
              </p>
            </div>
          </div>

          {availableChildren.length > 1 && (
            <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs shrink-0">
              <span className="text-xs font-semibold text-slate-700">Select Rabea Child:</span>
              <select
                value={studentInfo?.id || ""}
                onChange={(e) => fetchProfile(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              >
                {availableChildren.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Grade {c.grade})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── Notification Banner ── */}
      {notification && (
        <div
          className={`mb-6 p-4 rounded-xl text-sm flex items-center justify-between shadow-sm ${
            notification.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{notification.text}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-bold hover:underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB 1: EDIT FORM
      ════════════════════════════════════════════════════════════ */}
      {!isParentUser && activeTab === "edit" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSave("SUBMITTED");
          }}
          className="space-y-8"
        >
          {/* ── Section 1: Personal Details ── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-5">
              <User className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-slate-900">1. Personal Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Photo Upload */}
              <div className="md:col-span-3 flex justify-center">
                {renderPhotoUploadField(
                  "studentPhotoUrl",
                  "Student Passport Photo",
                  "Upload Student Photo",
                  "upload-student-photo",
                  "Dawoodi Bohra Libas / Topi • Plain background"
                )}
              </div>

              {/* Personal Fields */}
              <div className="md:col-span-9 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Jafar bhai Husain bhai Badri"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ITS No.</label>
                  <input
                    type="text"
                    value={formData.itsNo || ""}
                    onChange={(e) => setFormData({ ...formData, itsNo: e.target.value })}
                    placeholder="e.g. 30382713"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ID No.</label>
                  <input
                    type="text"
                    value={formData.idNo || ""}
                    onChange={(e) => setFormData({ ...formData, idNo: e.target.value })}
                    placeholder="e.g. 641"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jamaat</label>
                  <input
                    type="text"
                    value={formData.jamaat || ""}
                    onChange={(e) => setFormData({ ...formData, jamaat: e.target.value })}
                    placeholder="e.g. Ratlam"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vatan</label>
                  <input
                    type="text"
                    value={formData.vatan || ""}
                    onChange={(e) => setFormData({ ...formData, vatan: e.target.value })}
                    placeholder="e.g. Ratlam"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={formData.nationality || "Indian"}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    placeholder="Indian"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">DOB</label>
                    <input
                      type="text"
                      value={formData.dob || ""}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      placeholder="YYYY-MM-DD"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
                    <input
                      type="number"
                      value={formData.age || ""}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      placeholder="e.g. 17"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Family Details ── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-5">
              <Users className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-slate-900">2. Family Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Father Details */}
              <div className="flex flex-col sm:flex-row gap-5 items-start">
                <div className="w-full sm:w-auto shrink-0 flex justify-center">
                  {renderPhotoUploadField(
                    "fatherPhotoUrl",
                    "Father's Photo",
                    "Upload Father Photo",
                    "upload-father-photo",
                    "Dawoodi Bohra Libas / Topi • Plain background"
                  )}
                </div>

                <div className="flex-1 w-full space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Father's Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.fatherName || ""}
                      onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                      placeholder="e.g. Husain bhai Shaikh Abdulhusain"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Father's Occupation / Khidmat
                    </label>
                    <input
                      type="text"
                      value={formData.fatherOccupation || ""}
                      onChange={(e) => setFormData({ ...formData, fatherOccupation: e.target.value })}
                      placeholder="e.g. Business / Service"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Mother Details */}
              <div className="flex flex-col sm:flex-row gap-5 items-start pt-6 md:pt-0 md:pl-8">
                <div className="w-full sm:w-auto shrink-0 flex justify-center">
                  {renderPhotoUploadField(
                    "motherPhotoUrl",
                    "Mother's Photo",
                    "Upload Mother Photo",
                    "upload-mother-photo",
                    "Rida • Plain background"
                  )}
                </div>

                <div className="flex-1 w-full space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mother's Full Name
                    </label>
                    <input
                      type="text"
                      value={formData.motherName || ""}
                      onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                      placeholder="e.g. Zainab bai Husain bhai"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mother's Occupation
                    </label>
                    <input
                      type="text"
                      value={formData.motherOccupation || "Homemaker"}
                      onChange={(e) => setFormData({ ...formData, motherOccupation: e.target.value })}
                      placeholder="Homemaker"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Academics Details ── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-5">
              <GraduationCap className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-slate-900">3. Academics Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              {/* Exam Results */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <span>Annual Exam Results</span>
                  <span className="font-serif dir-rtl" dir="rtl">نتائج الامتحان السنوي</span>
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 font-medium">1444 H:</span>
                    <input
                      type="text"
                      value={formData.result1444 || ""}
                      onChange={(e) => setFormData({ ...formData, result1444: e.target.value })}
                      placeholder="e.g. 76.14"
                      className="w-24 px-2 py-1 border border-slate-300 rounded text-xs text-right font-semibold"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 font-medium">1445 H:</span>
                    <input
                      type="text"
                      value={formData.result1445 || ""}
                      onChange={(e) => setFormData({ ...formData, result1445: e.target.value })}
                      placeholder="e.g. 81.62"
                      className="w-24 px-2 py-1 border border-slate-300 rounded text-xs text-right font-semibold"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 font-medium">1446 H:</span>
                    <input
                      type="text"
                      value={formData.result1446 || ""}
                      onChange={(e) => setFormData({ ...formData, result1446: e.target.value })}
                      placeholder="e.g. 80.34"
                      className="w-24 px-2 py-1 border border-slate-300 rounded text-xs text-right font-semibold"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-600 font-medium">1447 H:</span>
                    <input
                      type="text"
                      value={formData.result1447 || ""}
                      onChange={(e) => setFormData({ ...formData, result1447: e.target.value })}
                      placeholder="Current / Score"
                      className="w-24 px-2 py-1 border border-slate-300 rounded text-xs text-right font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* Hifz Details */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <span>Hifz Results</span>
                  <span className="font-serif dir-rtl" dir="rtl">نتائج الحفظ</span>
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Hifz (Completion Year / Status)</label>
                    <input
                      type="text"
                      value={formData.hifzYear || ""}
                      onChange={(e) => setFormData({ ...formData, hifzYear: e.target.value })}
                      placeholder="e.g. 1445"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Tabaqa (الطبقة)</label>
                    <input
                      type="text"
                      value={formData.hifzTabaqa || ""}
                      onChange={(e) => setFormData({ ...formData, hifzTabaqa: e.target.value })}
                      placeholder="e.g. الثانية / الاولى"
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-serif dir-rtl text-right"
                      dir="rtl"
                    />
                  </div>
                </div>
              </div>

              {/* Courses */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1.5">
                  Courses Taken
                </h3>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={formData.course1 || ""}
                    onChange={(e) => setFormData({ ...formData, course1: e.target.value })}
                    placeholder="1. Course name..."
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    value={formData.course2 || ""}
                    onChange={(e) => setFormData({ ...formData, course2: e.target.value })}
                    placeholder="2. Course name..."
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    value={formData.course3 || ""}
                    onChange={(e) => setFormData({ ...formData, course3: e.target.value })}
                    placeholder="3. Course name..."
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                  />
                  <input
                    type="text"
                    value={formData.course4 || ""}
                    onChange={(e) => setFormData({ ...formData, course4: e.target.value })}
                    placeholder="4. Course name..."
                    className="w-full px-2 py-1 border border-slate-300 rounded text-xs"
                  />
                </div>
              </div>

              {/* Other Exams */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <span>Other Exams</span>
                  <span className="font-serif dir-rtl" dir="rtl">الامتحانات الأخرى</span>
                </h3>
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Status / Examinations</label>
                  <input
                    type="text"
                    value={formData.otherExams || ""}
                    onChange={(e) => setFormData({ ...formData, otherExams: e.target.value })}
                    placeholder="e.g. 10th Done / NIOS"
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-xs font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* Cultural / Academic Program Participations */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Participation in Academic &amp; Cultural Programs</span>
                <span className="font-serif text-slate-500 dir-rtl" dir="rtl">الاشتراك في البرامج العلمية والثقافية</span>
              </label>
              <textarea
                rows={3}
                value={formData.activities || ""}
                onChange={(e) => setFormData({ ...formData, activities: e.target.value })}
                placeholder="e.g. المعرض العلمي، مسابقة حفظ القصائد، روضة الادب الفاطمي، الروض العربي، Debate, Skit"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-serif leading-relaxed focus:ring-2 focus:ring-emerald-700 focus:outline-none text-right dir-rtl"
                dir="rtl"
              />
            </div>
          </div>

          {/* ── Section 4: Self - Assessment (Strengths & Weaknesses) ── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-5">
              <Award className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-slate-900">4. Self – Assessment</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Strengths */}
              <div className="p-4 bg-emerald-50/50 border border-emerald-200/60 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                  <h3 className="text-sm font-bold text-emerald-900">My Strengths</h3>
                  <button
                    type="button"
                    onClick={addStrength}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900 bg-white px-2 py-1 rounded border border-emerald-300 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>

                <div className="space-y-2">
                  {(formData.strengths || []).map((strength, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-800 w-4">{idx + 1}.</span>
                      <input
                        type="text"
                        value={strength}
                        onChange={(e) => updateStrength(idx, e.target.value)}
                        placeholder={`Strength #${idx + 1}`}
                        className="flex-1 px-3 py-1.5 bg-white border border-emerald-300/80 rounded-lg text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-none"
                      />
                      {(formData.strengths || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStrength(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Weaknesses */}
              <div className="p-4 bg-rose-50/50 border border-rose-200/60 rounded-xl space-y-3">
                <div className="flex items-center justify-between border-b border-rose-200/60 pb-2">
                  <h3 className="text-sm font-bold text-rose-900">My Weaknesses</h3>
                  <button
                    type="button"
                    onClick={addWeakness}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-white px-2 py-1 rounded border border-rose-300 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>

                <div className="space-y-2">
                  {(formData.weaknesses || []).map((weakness, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-rose-800 w-4">•</span>
                      <input
                        type="text"
                        value={weakness}
                        onChange={(e) => updateWeakness(idx, e.target.value)}
                        placeholder={`Weakness #${idx + 1}`}
                        className="flex-1 px-3 py-1.5 bg-white border border-rose-300/80 rounded-lg text-xs focus:ring-2 focus:ring-rose-600 focus:outline-none"
                      />
                      {(formData.weaknesses || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeWeakness(idx)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 5: About Myself ── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-5">
              <Sparkles className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-slate-900">5. About Myself (Hobbies, Interests &amp; Skills)</h2>
            </div>

            <div>
              <textarea
                rows={4}
                value={formData.aboutMyself || ""}
                onChange={(e) => setFormData({ ...formData, aboutMyself: e.target.value })}
                placeholder="e.g. Hobbies - Reading Books, Learning new things. Interest - Computers, Dawat ni akhbar. Skills - Good in computers, can adapt to work with everyone."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm leading-relaxed focus:ring-2 focus:ring-emerald-700 focus:outline-none"
              />
            </div>
          </div>

          {/* ── Section 6: Faculty & Administration Remarks (Read-Only for Student) ── */}
          {(formData.behaviourRating || formData.masoolRemarks) && (
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-blue-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-blue-200 pb-3 mb-4">
                <ShieldCheck className="w-5 h-5 text-blue-700" />
                <h2 className="text-lg font-bold text-slate-900">
                  Administration &amp; Darse Burhani Masul Remarks
                </h2>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-4">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <span className="block text-[11px] font-semibold text-slate-500">Behaviour</span>
                  <span className="text-lg font-extrabold text-emerald-700">{formData.behaviourRating || "—"} / 5</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <span className="block text-[11px] font-semibold text-slate-500">Communication</span>
                  <span className="text-lg font-extrabold text-emerald-700">{formData.communicationRating || "—"} / 5</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <span className="block text-[11px] font-semibold text-slate-500">Dedication</span>
                  <span className="text-lg font-extrabold text-emerald-700">{formData.dedicationRating || "—"} / 5</span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                  <span className="block text-[11px] font-semibold text-slate-500">Discipline</span>
                  <span className="text-lg font-extrabold text-emerald-700">{formData.disciplineRating || "—"} / 5</span>
                </div>
              </div>

              {formData.masoolRemarks && (
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                  <span className="block text-xs font-bold text-slate-700 mb-1 font-serif dir-rtl" dir="rtl">
                    ملاحظات عامة:
                  </span>
                  <p className="text-sm font-serif leading-relaxed text-right dir-rtl text-slate-800" dir="rtl">
                    {formData.masoolRemarks}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Form Actions Bottom Bar ── */}
          <div className="sticky bottom-4 z-20 bg-white/95 backdrop-blur border border-slate-300 p-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Make sure all details and photos are verified before submission.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleSave("DRAFT")}
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl text-sm transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                {saving ? "Saving..." : "Save Draft"}
              </button>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-800 to-teal-900 hover:from-emerald-900 hover:to-teal-950 text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Send className="w-4 h-4 text-amber-300" />
                {saving ? "Submitting..." : "Submit to Admin & Teachers"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB 2: OFFICIAL 2-PAGE DOCUMENT PREVIEW & PRINT
      ════════════════════════════════════════════════════════════ */}
      {(isParentUser || activeTab === "preview") && (
        <div className="space-y-6">
          <TalabatProfileDocument data={formData} showPrintButton={true} />
        </div>
      )}

      {/* ── IMAGE ZOOM / LIGHTBOX PREVIEW MODAL ── */}
      {lightboxImg && (
        <div
          className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImg(null)}
        >
          <div
            className="relative max-w-lg w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-2 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-3 border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-800 truncate pr-2">{lightboxImg.title}</h4>
              <button
                onClick={() => setLightboxImg(null)}
                className="p-1 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 flex items-center justify-center bg-slate-50 rounded-xl max-h-[70vh] overflow-hidden">
              <img
                src={lightboxImg.url}
                alt={lightboxImg.title}
                className="max-h-[66vh] max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
