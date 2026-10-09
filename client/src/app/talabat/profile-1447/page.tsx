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
} from "lucide-react";
import { TalabatProfileDocument, TalabatProfileData } from "@/components/talabat/TalabatProfileDocument";

export default function TalabatProfile1447Page() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isGrade4, setIsGrade4] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/talabat-profile/me");
      const data = await res.json();

      if (!data.success) {
        setNotification({ type: "error", text: data.error || "Failed to load profile" });
        setIsGrade4(false);
        return;
      }

      setIsGrade4(data.isGrade4);
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: "studentPhotoUrl" | "fatherPhotoUrl" | "motherPhotoUrl") => {
    const file = e.target.files?.[0];
    if (!file) return;

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
        setFormData((prev) => ({ ...prev, [fieldName]: data.url }));
        setNotification({ type: "success", text: "Photo uploaded successfully!" });
      } else {
        setNotification({ type: "error", text: data.error || "Upload failed" });
      }
    } catch (err: any) {
      setNotification({ type: "error", text: err.message || "Upload error" });
    } finally {
      setUploadingField(null);
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
          status: submitStatus,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setFormData((prev) => ({ ...prev, status: submitStatus }));
        setNotification({
          type: "success",
          text: submitStatus === "SUBMITTED"
            ? "🎉 Profile submitted successfully to Darajah Masul & Administrators!"
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-600">Loading Talabat Profile (1447 H)...</p>
        </div>
      </div>
    );
  }

  if (isGrade4 === false) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-amber-200 rounded-2xl shadow-sm text-center">
        <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <GraduationCap className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Darajah 4 Exclusive Profile Form</h2>
        <p className="text-slate-600 text-sm leading-relaxed mb-6">
          The <strong>TALABAT PROFILE – 1447 H (Further Education: توجيه الطالب)</strong> is exclusively designed and designated for students of <strong>Darajah 4</strong>.
        </p>
        <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500 border border-slate-200">
          Your current registered Darajah is not Darajah 4. If you believe this is an error, please contact your administration or Darajah Masul.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* ── Top Hero Header ── */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-[#961212] to-[#b31b1b] text-white p-6 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-4">
          <img
            src="/logo.png"
            alt="Darse Burhani"
            className="w-16 h-16 object-contain bg-white/10 p-1.5 rounded-xl border border-white/20 backdrop-blur"
            onError={(e) => ((e.target as HTMLElement).style.display = "none")}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur">
                Darajah 4 Only
              </span>
              <span className="text-xs font-semibold text-white/90">
                Further Education: توجيه الطالب
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
              TALABAT PROFILE – 1447 H
            </h1>
            <p className="text-white/80 text-xs sm:text-sm mt-0.5">
              Fill and submit your official comprehensive academic and self-assessment profile.
            </p>
          </div>
        </div>

        {/* Status Badge & Actions */}
        <div className="relative z-10 flex flex-wrap items-center gap-2">
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            formData.status === "SUBMITTED"
              ? "bg-emerald-500 text-white"
              : formData.status === "REVIEWED"
              ? "bg-blue-500 text-white"
              : "bg-amber-400 text-slate-900"
          }`}>
            Status: {formData.status || "DRAFT"}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("edit")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "edit"
                  ? "bg-white text-[#961212] shadow"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              <FileEdit className="w-3.5 h-3.5" />
              Edit Form
            </button>
            <button
              onClick={() => setActiveTab("preview")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "preview"
                  ? "bg-white text-[#961212] shadow"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Document View &amp; Print
            </button>
          </div>
        </div>
      </div>

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
      {activeTab === "edit" && (
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
              <User className="w-5 h-5 text-[#961212]" />
              <h2 className="text-lg font-bold text-slate-900">1. Personal Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Photo Upload */}
              <div className="md:col-span-3 flex flex-col items-center">
                <span className="text-xs font-semibold text-slate-700 mb-2">Student Photo</span>
                <div className="w-32 h-40 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden relative flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-all group">
                  {formData.studentPhotoUrl ? (
                    <img
                      src={formData.studentPhotoUrl}
                      alt="Student"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-400">
                      <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                      <span className="text-[10px]">Click to upload passport photo</span>
                    </div>
                  )}

                  <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-semibold">
                    <Upload className="w-4 h-4 mb-1" />
                    {uploadingField === "studentPhotoUrl" ? "Uploading..." : "Change Photo"}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, "studentPhotoUrl")}
                      disabled={uploadingField !== null}
                    />
                  </label>
                </div>
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">ID No.</label>
                  <input
                    type="text"
                    value={formData.idNo || ""}
                    onChange={(e) => setFormData({ ...formData, idNo: e.target.value })}
                    placeholder="e.g. 641"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Jamaat</label>
                  <input
                    type="text"
                    value={formData.jamaat || ""}
                    onChange={(e) => setFormData({ ...formData, jamaat: e.target.value })}
                    placeholder="e.g. Ratlam"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Vatan</label>
                  <input
                    type="text"
                    value={formData.vatan || ""}
                    onChange={(e) => setFormData({ ...formData, vatan: e.target.value })}
                    placeholder="e.g. Ratlam"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nationality</label>
                  <input
                    type="text"
                    value={formData.nationality || "Indian"}
                    onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
                    placeholder="Indian"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
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
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Age</label>
                    <input
                      type="number"
                      value={formData.age || ""}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      placeholder="e.g. 17"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 2: Family Details ── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-5">
              <Users className="w-5 h-5 text-[#961212]" />
              <h2 className="text-lg font-bold text-slate-900">2. Family Details</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-200">
              {/* Father Details */}
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="w-28 h-32 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden relative flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-all group shrink-0">
                  {formData.fatherPhotoUrl ? (
                    <img
                      src={formData.fatherPhotoUrl}
                      alt="Father"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-400">
                      <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <span className="text-[10px]">Father Photo</span>
                    </div>
                  )}

                  <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-semibold">
                    <Upload className="w-3.5 h-3.5 mb-1" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, "fatherPhotoUrl")}
                      disabled={uploadingField !== null}
                    />
                  </label>
                </div>

                <div className="flex-1 w-full space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Father Name</label>
                    <input
                      type="text"
                      value={formData.fatherName || ""}
                      onChange={(e) => setFormData({ ...formData, fatherName: e.target.value })}
                      placeholder="e.g. Husain bhai Shaikh Abdulhusain"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Father Occupation</label>
                    <input
                      type="text"
                      value={formData.fatherOccupation || ""}
                      onChange={(e) => setFormData({ ...formData, fatherOccupation: e.target.value })}
                      placeholder="e.g. Business / Service"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Mother Details */}
              <div className="flex flex-col sm:flex-row gap-4 items-center pt-6 md:pt-0 md:pl-6">
                <div className="w-28 h-32 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden relative flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-all group shrink-0">
                  {formData.motherPhotoUrl ? (
                    <img
                      src={formData.motherPhotoUrl}
                      alt="Mother"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2 text-slate-400">
                      <ImageIcon className="w-6 h-6 mx-auto mb-1 opacity-50" />
                      <span className="text-[10px]">Mother Photo</span>
                    </div>
                  )}

                  <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-xs font-semibold">
                    <Upload className="w-3.5 h-3.5 mb-1" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, "motherPhotoUrl")}
                      disabled={uploadingField !== null}
                    />
                  </label>
                </div>

                <div className="flex-1 w-full space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mother Name</label>
                    <input
                      type="text"
                      value={formData.motherName || ""}
                      onChange={(e) => setFormData({ ...formData, motherName: e.target.value })}
                      placeholder="e.g. Zainab bai Husain bhai"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mother Occupation</label>
                    <input
                      type="text"
                      value={formData.motherOccupation || "Homemaker"}
                      onChange={(e) => setFormData({ ...formData, motherOccupation: e.target.value })}
                      placeholder="Homemaker"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#961212] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Academics Details ── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-5">
              <GraduationCap className="w-5 h-5 text-[#961212]" />
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-serif leading-relaxed focus:ring-2 focus:ring-[#961212] focus:outline-none text-right dir-rtl"
                dir="rtl"
              />
            </div>
          </div>

          {/* ── Section 4: Self - Assessment (Strengths & Weaknesses) ── */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-5">
              <Award className="w-5 h-5 text-[#961212]" />
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
              <Sparkles className="w-5 h-5 text-[#961212]" />
              <h2 className="text-lg font-bold text-slate-900">5. About Myself (Hobbies, Interests &amp; Skills)</h2>
            </div>

            <div>
              <textarea
                rows={4}
                value={formData.aboutMyself || ""}
                onChange={(e) => setFormData({ ...formData, aboutMyself: e.target.value })}
                placeholder="e.g. Hobbies - Reading Books, Learning new things. Interest - Computers, Dawat ni akhbar. Skills - Good in computers, can adapt to work with everyone."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm leading-relaxed focus:ring-2 focus:ring-[#961212] focus:outline-none"
              />
            </div>
          </div>

          {/* ── Section 6: Darajah Masul Remarks (Read-Only for Student) ── */}
          {(formData.behaviourRating || formData.masoolRemarks) && (
            <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 border border-blue-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 border-b border-blue-200 pb-3 mb-4">
                <ShieldCheck className="w-5 h-5 text-blue-700" />
                <h2 className="text-lg font-bold text-slate-900">
                  Darajah Masul &amp; Darse Burhani Masul Remarks
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
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#961212] hover:bg-[#b31b1b] text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                {saving ? "Submitting..." : "Submit to Admin & Teachers"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ════════════════════════════════════════════════════════════
          TAB 2: OFFICIAL 2-PAGE DOCUMENT PREVIEW & PRINT
      ════════════════════════════════════════════════════════════ */}
      {activeTab === "preview" && (
        <div className="space-y-6">
          <TalabatProfileDocument data={formData} showPrintButton={true} />
        </div>
      )}
    </div>
  );
}
