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
} from "lucide-react";
import {
  StudentAuditHistory,
  getStudentAuditTimeline,
  overrideAttendanceRegistry,
} from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

interface DayDetailDrawerProps {
  studentId: string | null;
  targetDate: string;
  onClose: () => void;
  onOverrideSuccess: () => void;
}

export function DayDetailDrawer({
  studentId,
  targetDate,
  onClose,
  onOverrideSuccess,
}: DayDetailDrawerProps) {
  const [data, setData] = useState<StudentAuditHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Override Form State
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState("PRESENT");
  const [overrideSource, setOverrideSource] = useState("MANUAL");
  const [overrideRemarks, setOverrideRemarks] = useState("");
  const [savingOverride, setSavingOverride] = useState(false);

  useEffect(() => {
    if (!studentId) return;

    let mounted = true;
    setLoading(true);
    setError(null);

    getStudentAuditTimeline(studentId)
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
  }, [studentId]);

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;

    setSavingOverride(true);
    try {
      await overrideAttendanceRegistry({
        studentId,
        date: targetDate,
        status: overrideStatus,
        source: overrideSource,
        remarks: overrideRemarks.trim() || undefined,
      });

      onOverrideSuccess();
      setOverrideOpen(false);
      // Refresh audit data
      const refreshed = await getStudentAuditTimeline(studentId);
      setData(refreshed);
    } catch (err: any) {
      alert(err.message || "Failed to save override");
    } finally {
      setSavingOverride(false);
    }
  };

  if (!studentId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-2xs"
      />

      {/* Slide-over Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="w-screen max-w-md bg-white shadow-2xl border-l border-gray-100 flex flex-col justify-between overflow-hidden"
        >
          {/* Drawer Header */}
          <div className="px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-emerald-900 to-teal-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              <div>
                <h3 className="font-bold text-sm leading-tight">Student Audit & Log Drawer</h3>
                <p className="text-[11px] text-emerald-200/80">30-Day Attendance & Leave History</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {loading ? (
              <div className="py-16 text-center text-gray-500 flex flex-col items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
                <span className="text-xs">Loading audit history...</span>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            ) : data ? (
              <>
                {/* Student Profile Card */}
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12 rounded-xl border border-gray-200">
                      <AvatarImage src={data.student.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs font-bold bg-emerald-100 text-emerald-800">
                        {getInitials(data.student.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h4 className="font-bold text-sm text-gray-900 leading-tight">{data.student.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        ITS: {data.student.its} • Grade {data.student.grade}-{data.student.section}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                      <Flame className="w-3.5 h-3.5 text-amber-500" />
                      <span>{data.student.streakDays}d streak</span>
                    </div>
                  </div>
                </div>

                {/* Manual Override Form Toggle */}
                <div className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-4 h-4 text-emerald-700" />
                      <span className="text-xs font-bold text-emerald-900">Manual Attendance Override</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOverrideOpen(!overrideOpen)}
                      className="text-xs text-emerald-700 font-bold hover:underline"
                    >
                      {overrideOpen ? "Cancel" : "Override Today"}
                    </button>
                  </div>

                  {overrideOpen && (
                    <form onSubmit={handleSaveOverride} className="space-y-3 pt-2 border-t border-emerald-100">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                            Status
                          </label>
                          <select
                            value={overrideStatus}
                            onChange={(e) => setOverrideStatus(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold bg-white"
                          >
                            <option value="PRESENT">PRESENT</option>
                            <option value="LATE">LATE</option>
                            <option value="ABSENT">ABSENT</option>
                            <option value="MEDICAL">MEDICAL</option>
                            <option value="ON_LEAVE">ON_LEAVE</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                            Source
                          </label>
                          <select
                            value={overrideSource}
                            onChange={(e) => setOverrideSource(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold bg-white cursor-pointer"
                          >
                            <option value="MANUAL">MANUAL ENTRY</option>
                            <option value="SCAN">LIVE SCAN</option>
                            <option value="MEDICAL_LEAVE">MEDICAL LEAVE</option>
                            <option value="LEAVE_APPROVED">APPROVED LEAVE</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                          Audit Remarks
                        </label>
                        <input
                          type="text"
                          value={overrideRemarks}
                          onChange={(e) => setOverrideRemarks(e.target.value)}
                          placeholder="e.g. Scanned late due to official transport delay"
                          className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={savingOverride}
                        className="w-full py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white shadow-xs transition-colors flex items-center justify-center gap-1.5"
                      >
                        {savingOverride && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>Save Audit Override</span>
                      </button>
                    </form>
                  )}
                </div>

                {/* 30-Day Registry History Timeline */}
                <div>
                  <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                    Recent 30 Days Timeline
                  </h4>

                  {data.registries.length === 0 ? (
                    <div className="text-xs text-gray-500 py-6 text-center">No recorded history in this period.</div>
                  ) : (
                    <div className="space-y-2">
                      {data.registries.map((item) => {
                        const d = new Date(item.date);
                        return (
                          <div
                            key={item.id}
                            className="p-3 rounded-xl bg-white border border-gray-100 flex items-center justify-between text-xs hover:border-gray-200 transition-colors"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="font-semibold text-gray-800 min-w-[70px]">
                                {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.status === "PRESENT"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : item.status === "LATE"
                                    ? "bg-amber-50 text-amber-700"
                                    : item.status === "MEDICAL"
                                    ? "bg-rose-50 text-rose-700"
                                    : item.status === "ON_LEAVE"
                                    ? "bg-purple-50 text-purple-700"
                                    : "bg-red-50 text-red-700"
                                }`}
                              >
                                <span>{item.status}</span>
                              </span>
                            </div>

                            <div className="text-right text-[11px] text-gray-500">
                              <span className="font-medium text-gray-700">
                                {item.source === "BIOMETRIC" || item.source === "SCAN"
                                  ? "Live Scan"
                                  : item.source.replace(/_/g, " ")}
                              </span>
                              {item.checkInTime && (
                                <div className="text-[10px] text-gray-400">
                                  {new Date(item.checkInTime).toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Past Leave Requests */}
                {data.recentLeaves.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2.5">
                      Recent Leave Applications
                    </h4>
                    <div className="space-y-2">
                      {data.recentLeaves.map((l) => (
                        <div key={l.id} className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-gray-900 capitalize">{l.type.toLowerCase()} Leave</span>
                            <span className="text-[10px] font-bold text-emerald-800 px-2 py-0.5 rounded-full bg-emerald-100/70">
                              {l.status}
                            </span>
                          </div>
                          <p className="text-gray-600 line-clamp-1">{l.reason}</p>
                          <div className="text-[10px] text-gray-400 mt-1">
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
          <div className="p-4 border-t border-gray-100 bg-gray-50 text-right">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100"
            >
              Close Drawer
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
