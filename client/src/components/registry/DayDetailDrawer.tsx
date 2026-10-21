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
} from "lucide-react";
import {
  getStudentAuditTimeline,
  getFacultyAuditTimeline,
  overrideAttendanceLog,
  overrideAttendanceRegistry,
} from "@/lib/api";
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
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="w-screen max-w-md bg-white shadow-2xl border-l border-gray-100 flex flex-col justify-between overflow-hidden"
        >
          {/* Drawer Header */}
          <div
            className={`px-6 py-5 border-b text-white flex items-center justify-between shrink-0 ${
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
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  <span>{isFaculty ? "Faculty Audit & Override" : "Student Audit & Log Drawer"}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-black uppercase bg-white/20 text-white">
                    {isFaculty ? "Faculty" : "Talabat"}
                  </span>
                </h3>
                <p className="text-[11px] text-white/70">
                  Target Date: <span className="font-semibold text-white">{targetDate}</span> • 30-Day History
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

          {/* Drawer Body */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
            {loading ? (
              <div className="py-16 text-center text-gray-500 flex flex-col items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
                <span className="text-xs font-semibold">
                  Loading {isFaculty ? "faculty" : "student"} audit history...
                </span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            ) : data && profile ? (
              <>
                {/* Member Profile Card */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-12 h-12 rounded-xl border border-slate-200 shrink-0 shadow-2xs">
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
                      <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                        ITS: <span className="font-mono font-semibold text-slate-700">{profile.its || "—"}</span>
                        {" • "}
                        {isFaculty
                          ? profile.department || profile.roleTitle || "Faculty Staff"
                          : `Grade ${profile.grade || ""}-${profile.section || ""}`}
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

                {/* Manual Override Form Toggle */}
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
              </>
            ) : null}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 font-medium">
              {isFaculty ? "Faculty Member Record" : "Talabat Student Record"}
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
