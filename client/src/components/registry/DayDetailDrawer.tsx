"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X,
  ShieldCheck,
  Flame,
  Loader2,
  AlertCircle,
  Edit3,
  Briefcase,
  GraduationCap,
  CheckCircle2,
  Clock,
  XCircle,
  Activity,
  Check,
  Save,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Heart,
  Award,
  Sparkles,
  BookOpen,
  Wallet,
  Building,
  UserCheck,
  ChevronRight,
} from "lucide-react";
import {
  getStudentAuditTimeline,
  getFacultyAuditTimeline,
  overrideAttendanceLog,
  overrideAttendanceRegistry,
} from "@/lib/api";
import { ProfilePhoto } from "@/components/ui/ProfilePhoto";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

export interface DayDetailDrawerProps {
  studentId?: string | null;
  teacherId?: string | null;
  role?: "STUDENT" | "FACULTY";
  targetDate: string;
  initialOverrideOpen?: boolean;
  onClose: () => void;
  onOverrideSuccess: () => void;
}

export function DayDetailDrawer({
  studentId,
  teacherId,
  role = "STUDENT",
  targetDate,
  initialOverrideOpen = false,
  onClose,
  onOverrideSuccess,
}: DayDetailDrawerProps) {
  const isFaculty = role === "FACULTY" || Boolean(teacherId);
  const activeId = isFaculty ? (teacherId || studentId) : (studentId || teacherId);

  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "ATTENDANCE">("OVERVIEW");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Override Form State
  const [overrideOpen, setOverrideOpen] = useState(initialOverrideOpen);
  const [overrideStatus, setOverrideStatus] = useState("PRESENT");
  const [overrideSource, setOverrideSource] = useState("MANUAL");
  const [overrideRemarks, setOverrideRemarks] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    if (!activeId) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    const loader = isFaculty
      ? getFacultyAuditTimeline(activeId)
      : getStudentAuditTimeline(activeId);

    loader
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || "Failed to load audit history");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [activeId, isFaculty]);

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId) return;

    setSavingOverride(true);
    try {
      if (isFaculty) {
        await overrideAttendanceLog({
          teacherId: activeId,
          date: targetDate,
          status: overrideStatus,
          source: overrideSource,
          remarks: overrideRemarks.trim() || undefined,
        });
      } else {
        await overrideAttendanceRegistry({
          studentId: activeId,
          date: targetDate,
          status: overrideStatus,
          source: overrideSource,
          remarks: overrideRemarks.trim() || undefined,
        });
      }

      toast({
        title: `${isFaculty ? "Faculty" : "Student"} Attendance Overridden`,
        description: `Successfully updated status to ${overrideStatus} for ${targetDate}.`,
        variant: "success",
      });

      onOverrideSuccess();
      setOverrideOpen(false);

      // Refresh audit data
      const refreshed = isFaculty
        ? await getFacultyAuditTimeline(activeId)
        : await getStudentAuditTimeline(activeId);
      setData(refreshed);
    } catch (err: any) {
      toast({
        title: "Override Failed",
        description: err.message || "Failed to save attendance override",
        variant: "destructive",
      });
    } finally {
      setSavingOverride(false);
    }
  };

  if (!activeId) return null;

  const profile = isFaculty ? data?.teacher : data?.student;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-2xs"
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10">
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="w-screen max-w-lg bg-white shadow-2xl border-l border-slate-200 flex flex-col justify-between overflow-hidden"
        >
          {/* Drawer Top Institutional Header */}
          <div
            className={`px-5 py-4 border-b text-white flex items-center justify-between shrink-0 ${
              isFaculty
                ? "bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-900 border-indigo-800"
                : "bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-900 border-emerald-800"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {isFaculty ? (
                <Briefcase className="w-5 h-5 text-indigo-300" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-300" />
              )}
              <div>
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5 font-display">
                  <span>{isFaculty ? "Faculty Member Profile" : "Talabat Comprehensive Dossier"}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black uppercase bg-white/20 text-white font-mono">
                    {isFaculty ? "Faculty" : "Talabat"}
                  </span>
                </h3>
                <p className="text-[11px] text-white/75 font-medium mt-0.5">
                  Target Date: <span className="font-bold text-amber-300">{targetDate}</span> &middot; Full Institutional Record
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Segmented Tab Navigation Ribbon */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 shrink-0">
            <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 rounded-2xl border border-slate-300/60 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("OVERVIEW")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === "OVERVIEW"
                    ? isFaculty
                      ? "bg-indigo-700 text-white shadow-xs"
                      : "bg-emerald-700 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{isFaculty ? "Faculty Overview" : "Talabat Overview Record"}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ATTENDANCE")}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === "ATTENDANCE"
                    ? isFaculty
                      ? "bg-indigo-700 text-white shadow-xs"
                      : "bg-emerald-700 text-white shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Attendance & Day Logs</span>
              </button>
            </div>
          </div>

          {/* Drawer Scrollable Content */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            {loading ? (
              <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center">
                <Loader2 className="w-7 h-7 animate-spin text-emerald-600 mb-2.5" />
                <span className="text-xs font-bold text-slate-700">
                  Retrieving complete {isFaculty ? "faculty" : "Talabat"} profile overview...
                </span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            ) : data && profile ? (
              <>
                {/* ══════════════════════════════════════════════════════════
                    TAB 1: COMPREHENSIVE TALABAT / FACULTY OVERVIEW RECORD
                    ══════════════════════════════════════════════════════════ */}
                {activeTab === "OVERVIEW" ? (
                  <div className="space-y-4">
                    {/* Hero Identity Card */}
                    <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/80 via-white to-amber-50/50 p-4 sm:p-5 shadow-xs">
                      <div className="flex items-start gap-4">
                        <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-emerald-600 shadow-md shrink-0 bg-white">
                          <ProfilePhoto
                            src={profile.avatarUrl}
                            alt={profile.name}
                            className="w-full h-full rounded-2xl"
                            fit="cover"
                            previewable={true}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-tight font-display">
                              {profile.name}
                            </h3>
                            {profile.nameAr && (
                              <span className="font-arabic font-alkanz text-base text-emerald-800 font-bold tracking-normal" dir="rtl" lang="ar">
                                {profile.nameAr}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-800 text-white shrink-0 font-mono">
                              {isFaculty ? (profile.department || "Faculty Staff") : `Grade ${profile.grade || "1"}-${profile.section || "A"}`}
                            </span>

                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 shrink-0 font-mono">
                              ITS: {profile.its || "—"}
                            </span>

                            {profile.trNo && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 shrink-0 font-mono">
                                TR: {profile.trNo}
                              </span>
                            )}

                            {profile.status && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                                {profile.status}
                              </span>
                            )}
                          </div>

                          {profile.hafizYear && (
                            <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-300 text-[10.5px] font-bold text-amber-900 shadow-2xs">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span>Hafiz al-Quran &middot; Year {profile.hafizYear}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Vital Demographics Card (Talabat Only) */}
                    {!isFaculty && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800">
                          <UserCheck className="w-4 h-4 text-emerald-700" />
                          <span>Personal & Vital Demographics</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Date of Birth (Gregorian)</span>
                            <span className="font-extrabold text-slate-900 mt-0.5 block">
                              {profile.dobGregorian
                                ? new Date(profile.dobGregorian).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                                : "—"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Date of Birth (Fatimi Hijri)</span>
                            <span className="font-extrabold text-emerald-900 mt-0.5 block font-arabic">
                              {profile.dobHijri || "—"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Age</span>
                            <span className="font-extrabold text-slate-900 mt-0.5 block">
                              {profile.age ? `${profile.age} years old` : "—"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Blood Group</span>
                            <span className="font-black text-rose-700 mt-0.5 inline-flex items-center gap-1 font-mono">
                              <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
                              {profile.bloodGroup || "—"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Watan (Home City)</span>
                            <span className="font-extrabold text-slate-900 mt-0.5 block">
                              {profile.watan || "—"}
                            </span>
                          </div>

                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Resident City</span>
                            <span className="font-extrabold text-slate-900 mt-0.5 block">
                              {profile.residentCity || "—"}
                            </span>
                          </div>
                        </div>

                        {profile.address && (
                          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                            <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider">Street Address</span>
                            <p className="font-medium text-slate-800 mt-0.5 leading-relaxed">
                              {profile.address}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Parents & Guardians Details Card */}
                    {!isFaculty && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800">
                          <Building className="w-4 h-4 text-emerald-700" />
                          <span>Parental & Guardian Directory</span>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          {/* Father */}
                          <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/80">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Father / Guardian</span>
                              {profile.fatherOccupation && (
                                <span className="text-[10px] font-bold text-slate-500">
                                  {profile.fatherOccupation}
                                </span>
                              )}
                            </div>
                            <p className="font-extrabold text-slate-900 text-sm mt-0.5">{profile.fatherName || "—"}</p>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              {profile.fatherPhone && (
                                <a
                                  href={`tel:${profile.fatherPhone}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-emerald-300 hover:bg-emerald-100 transition-colors"
                                >
                                  <Phone className="w-3 h-3 text-emerald-600" />
                                  <span>{profile.fatherPhone}</span>
                                </a>
                              )}
                              {profile.fatherEmail && (
                                <a
                                  href={`mailto:${profile.fatherEmail}`}
                                  className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-emerald-800 hover:underline"
                                >
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{profile.fatherEmail}</span>
                                </a>
                              )}
                            </div>
                          </div>

                          {/* Mother */}
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">Mother</span>
                            <p className="font-extrabold text-slate-900 text-sm mt-0.5">{profile.motherName || "—"}</p>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              {profile.motherPhone && (
                                <a
                                  href={`tel:${profile.motherPhone}`}
                                  className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-emerald-800 bg-white px-2 py-0.5 rounded-lg border border-slate-300 hover:bg-slate-100 transition-colors"
                                >
                                  <Phone className="w-3 h-3 text-emerald-600" />
                                  <span>{profile.motherPhone}</span>
                                </a>
                              )}
                              {profile.motherEmail && (
                                <a
                                  href={`mailto:${profile.motherEmail}`}
                                  className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-emerald-800 hover:underline"
                                >
                                  <Mail className="w-3 h-3 text-slate-400" />
                                  <span>{profile.motherEmail}</span>
                                </a>
                              )}
                            </div>
                          </div>

                          {profile.mobileNumber && (
                            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Student Mobile</span>
                              <a href={`tel:${profile.mobileNumber}`} className="font-mono font-bold text-emerald-700 hover:underline">
                                {profile.mobileNumber}
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Academic Performance & Scorecard */}
                    {!isFaculty && (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                        <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-800">
                          <Award className="w-4 h-4 text-emerald-700" />
                          <span>Loyalty & Merit Scorecard</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                            <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider block">Merit Tier</span>
                            <span className="font-extrabold text-sm text-amber-950 mt-0.5 block capitalize">
                              {profile.tier || "Bronze"}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                            <span className="text-[10px] font-bold text-emerald-900 uppercase tracking-wider block">Attendance Streak</span>
                            <span className="font-extrabold text-sm text-emerald-950 mt-0.5 inline-flex items-center gap-1">
                              <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />
                              {profile.streakDays || 0} Days
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Current Score</span>
                            <span className="font-mono font-black text-sm text-slate-900 mt-0.5 block">
                              {profile.currentPoints || 0} <span className="text-[10px] text-slate-500 font-normal">pts</span>
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Wallet Balance</span>
                            <span className="font-mono font-black text-sm text-slate-900 mt-0.5 block">
                              ₹{profile.walletBalance || 0}
                            </span>
                          </div>
                        </div>

                        {/* Quick Jump to Attendance Button */}
                        <button
                          type="button"
                          onClick={() => setActiveTab("ATTENDANCE")}
                          className="w-full mt-2 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs border border-emerald-300 transition-colors flex items-center justify-between cursor-pointer"
                        >
                          <span>Inspect Attendance History & Overrides</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ══════════════════════════════════════════════════════════
                     TAB 2: ATTENDANCE HISTORY, OVERRIDE & DAY LOGS
                     ══════════════════════════════════════════════════════════ */
                  <div className="space-y-4">
                    {/* Compact Profile Header */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="w-11 h-11 rounded-xl border border-slate-200 shrink-0 shadow-2xs">
                          <AvatarImage src={profile.avatarUrl || undefined} />
                          <AvatarFallback
                            className={`text-xs font-black ${
                              isFaculty ? "bg-indigo-100 text-indigo-900" : "bg-emerald-100 text-emerald-900"
                            }`}
                          >
                            {getInitials(profile.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <h4 className="font-black text-sm text-slate-900 truncate">{profile.name}</h4>
                          <p className="text-xs text-slate-500 font-medium truncate mt-0.5 font-mono">
                            ITS: {profile.its || "—"} &middot;{" "}
                            {isFaculty
                              ? (profile.department || "Faculty Staff")
                              : `Grade ${profile.grade || "1"}-${profile.section || "A"}`}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase shrink-0 border ${
                          isFaculty
                            ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                            : "bg-emerald-50 text-emerald-800 border-emerald-200"
                        }`}
                      >
                        {isFaculty ? "Staff" : "Talabat"}
                      </span>
                    </div>

                    {/* Manual Override Form Accordion */}
                    <div
                      className={`p-4 rounded-2xl border transition-all ${
                        isFaculty
                          ? "border-indigo-200 bg-indigo-50/40"
                          : "border-emerald-200 bg-emerald-50/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Edit3 className={`w-4 h-4 ${isFaculty ? "text-indigo-700" : "text-emerald-700"}`} />
                          <span className={`text-xs font-black ${isFaculty ? "text-indigo-950" : "text-emerald-950"}`}>
                            {isFaculty ? "Faculty Attendance Override" : "Student Attendance Override"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOverrideOpen(!overrideOpen)}
                          className={`text-xs font-bold hover:underline cursor-pointer ${
                            isFaculty ? "text-indigo-700" : "text-emerald-700"
                          }`}
                        >
                          {overrideOpen ? "Cancel" : "Override Today"}
                        </button>
                      </div>

                      {overrideOpen && (
                        <form
                          onSubmit={handleSaveOverride}
                          className="space-y-3 pt-3 mt-3 border-t border-slate-200/80"
                        >
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">
                                Status
                              </label>
                              <select
                                value={overrideStatus}
                                onChange={(e) => setOverrideStatus(e.target.value)}
                                aria-label="Attendance override status"
                                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white outline-none cursor-pointer"
                              >
                                <option value="PRESENT">PRESENT</option>
                                <option value="LATE">LATE</option>
                                <option value="ABSENT">ABSENT</option>
                                <option value="MEDICAL">MEDICAL</option>
                                <option value="ON_LEAVE">ON LEAVE</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">
                                Verification Source
                              </label>
                              <select
                                value={overrideSource}
                                onChange={(e) => setOverrideSource(e.target.value)}
                                aria-label="Attendance verification source"
                                className="w-full px-2.5 py-1.5 rounded-xl border border-slate-300 text-xs font-bold bg-white outline-none cursor-pointer"
                              >
                                <option value="MANUAL">MANUAL ENTRY</option>
                                <option value="SCAN">HARDWARE SCAN</option>
                                <option value="MEDICAL_LEAVE">MEDICAL LEAVE</option>
                                <option value="LEAVE_APPROVED">APPROVED LEAVE</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-700 uppercase tracking-wider mb-1">
                              Audit Remarks / Reason
                            </label>
                            <input
                              type="text"
                              value={overrideRemarks}
                              onChange={(e) => setOverrideRemarks(e.target.value)}
                              placeholder={
                                isFaculty
                                  ? "e.g. Approved official seminar, outdoor duty, or transport delay"
                                  : "e.g. Scanned late due to official transport delay"
                              }
                              className="w-full px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={savingOverride}
                            className={`w-full py-2.5 rounded-xl text-xs font-black text-white shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                              isFaculty
                                ? "bg-indigo-700 hover:bg-indigo-800"
                                : "bg-emerald-700 hover:bg-emerald-800"
                            }`}
                          >
                            {savingOverride ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Save className="w-3.5 h-3.5" />
                            )}
                            <span>Save {isFaculty ? "Faculty" : "Student"} Override</span>
                          </button>
                        </form>
                      )}
                    </div>

                    {/* 30-Day Registry History Timeline */}
                    <div className="space-y-2.5">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                        Recent 30 Days Timeline
                      </h4>

                      {(!data.registries || data.registries.length === 0) ? (
                        <div className="text-xs text-slate-400 py-6 text-center italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                          No recorded attendance history found in this period.
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {data.registries.map((item: any) => {
                            const d = new Date(item.date);
                            const isPresent = item.status === "PRESENT";
                            const isLate = item.status === "LATE";
                            const isAbsent = item.status === "ABSENT";
                            const isMed = item.status === "MEDICAL";
                            const isLeave = item.status === "ON_LEAVE";

                            return (
                              <div
                                key={item.id}
                                className="p-3 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between text-xs hover:border-slate-300 transition-colors"
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="font-semibold text-slate-800 min-w-[70px]">
                                    {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                  </span>
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                      isPresent
                                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                        : isLate
                                        ? "bg-amber-50 text-amber-800 border-amber-300"
                                        : isMed
                                        ? "bg-purple-50 text-purple-800 border-purple-300"
                                        : isLeave
                                        ? "bg-sky-50 text-sky-800 border-sky-300"
                                        : isAbsent
                                        ? "bg-rose-50 text-rose-800 border-rose-300"
                                        : "bg-slate-100 text-slate-700 border-slate-300"
                                    }`}
                                  >
                                    <span>{item.status === "ON_LEAVE" ? "LEAVE" : item.status}</span>
                                  </span>
                                </div>

                                <div className="text-right text-[11px] text-slate-500 font-mono">
                                  <span className="font-medium text-slate-700">
                                    {item.source === "BIOMETRIC" || item.source === "SCAN"
                                      ? "Device Scan"
                                      : item.source ? item.source.replace(/_/g, " ") : "Manual"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Past Leave Requests (if any) */}
                    {data.recentLeaves && data.recentLeaves.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                          Recent Leave Applications
                        </h4>
                        <div className="space-y-2">
                          {data.recentLeaves.map((l: any) => (
                            <div key={l.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-slate-900 capitalize">{l.type.toLowerCase()} Leave</span>
                                <span className="text-[10px] font-bold text-emerald-800 px-2 py-0.5 rounded-full bg-emerald-100/70">
                                  {l.status}
                                </span>
                              </div>
                              <p className="text-slate-600 line-clamp-1">{l.reason}</p>
                              <div className="text-[10px] text-slate-400 mt-1">
                                {new Date(l.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })} –{" "}
                                {new Date(l.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* Drawer Institutional Footer */}
          <div className="p-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-500 font-medium">
              {isFaculty ? "Faculty Record" : "Talabat Student Record"} &middot; {activeTab === "OVERVIEW" ? "Overview Record" : "Audit Timeline"}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Close Drawer
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
