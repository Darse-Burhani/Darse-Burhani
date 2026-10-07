"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Plus,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  FileText,
  HeartPulse,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  getParentLeaves,
  submitParentLeave,
  cancelParentLeave,
  type ParentLeaveItem,
  type ParentLeaveType,
} from "@/lib/api";

interface ChildOption {
  studentProfileId: string;
  firstName: string;
  lastName: string;
  grade?: string;
  its?: string;
}

const PARENT_LEAVE_TYPES: Array<{
  type: ParentLeaveType;
  label: string;
  hint: string;
  icon: React.ElementType;
  chip: string;
}> = [
  {
    type: "PERSONAL",
    label: "Holiday / Personal",
    hint: "Family function, travel, personal work",
    icon: User,
    chip: "text-sky-700 bg-sky-50 border-sky-200",
  },
  {
    type: "FAMILY_EMERGENCY",
    label: "Family Emergency",
    hint: "Urgent family situation",
    icon: HeartPulse,
    chip: "text-amber-700 bg-amber-50 border-amber-200",
  },
  {
    type: "OTHER",
    label: "Other",
    hint: "Visa, official work, misc",
    icon: FileText,
    chip: "text-violet-700 bg-violet-50 border-violet-200",
  },
];

const statusStyle: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
  REJECTED: "bg-rose-50 text-rose-800 border-rose-200",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

export function ParentLeaveManager({ childrenList }: { childrenList: ChildOption[] }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedChild, setSelectedChild] = useState<string>(childrenList[0]?.studentProfileId || "");
  const [leaves, setLeaves] = useState<ParentLeaveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<ParentLeaveType>("PERSONAL");
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedChild && childrenList[0]) setSelectedChild(childrenList[0].studentProfileId);
  }, [childrenList, selectedChild]);

  const fetchLeaves = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await getParentLeaves();
      setLeaves(res.leaves);
    } catch (e: any) {
      setError(e.message || "Failed to load leave applications");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const visibleLeaves = useMemo(() => {
    if (!selectedChild) return leaves;
    return leaves.filter((l) => l.studentProfileId === selectedChild);
  }, [leaves, selectedChild]);

  const pendingCount = useMemo(() => visibleLeaves.filter((l) => l.status === "PENDING").length, [visibleLeaves]);
  const approvedCount = useMemo(() => visibleLeaves.filter((l) => l.status === "APPROVED").length, [visibleLeaves]);

  const durationDays = useMemo(() => {
    if (!startDate || !endDate) return 1;
    const d = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1;
    return d > 0 ? d : 1;
  }, [startDate, endDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild) {
      setFormError("Select a student first.");
      return;
    }
    if (reason.trim().length < 5) {
      setFormError("Please write a clear reason (at least 5 characters).");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await submitParentLeave({
        studentProfileId: selectedChild,
        type,
        startDate,
        endDate,
        reason: reason.trim(),
      });
      setReason("");
      setStartDate(todayStr);
      setEndDate(todayStr);
      setFormOpen(false);
      fetchLeaves(true);
    } catch (e: any) {
      setFormError(e.message || "Failed to submit leave application");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    setCancellingId(id);
    try {
      await cancelParentLeave(id);
      fetchLeaves(true);
    } catch (e: any) {
      setError(e.message || "Failed to cancel leave");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Child selector + apply */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {childrenList.map((c) => {
            const active = c.studentProfileId === selectedChild;
            return (
              <button
                key={c.studentProfileId}
                type="button"
                onClick={() => setSelectedChild(c.studentProfileId)}
                className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition active:scale-95 ${
                  active
                    ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-800"
                }`}
              >
                {c.firstName} {c.lastName}
                {c.grade ? ` · Gr ${c.grade}` : ""}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchLeaves(true)}
            className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 transition hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw size={15} className={refreshing ? "animate-spin text-emerald-700" : ""} />
          </button>
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            disabled={!selectedChild}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2.5 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-emerald-800 active:scale-[0.98] disabled:opacity-50"
          >
            <Plus size={15} /> Apply for leave
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Total", value: visibleLeaves.length },
          { label: "Pending", value: pendingCount },
          { label: "Approved", value: approvedCount },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
            <p className="mt-0.5 text-xl font-extrabold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <p className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-[12.5px] font-medium leading-relaxed text-sky-900">
        Leave for holidays, family functions and emergencies is applied by parents here. Medical leave is not
        shown here — it is recorded only by the school medical desk.
      </p>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-[13px] font-medium text-rose-800">
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {/* History */}
      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[76px] animate-pulse rounded-2xl border border-slate-100 bg-slate-50" />
          ))}
        </div>
      ) : visibleLeaves.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-10 text-center">
          <CalendarDays size={28} className="mx-auto text-slate-300" />
          <p className="mt-2 text-[13.5px] font-bold text-slate-700">No leave applications yet</p>
          <p className="mx-auto mt-1 max-w-[36ch] text-[12.5px] text-slate-500">
            Tap “Apply for leave” to submit a holiday or emergency application for your child.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleLeaves.map((l) => (
            <div key={l.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${statusStyle[l.status] || statusStyle.PENDING}`}>
                      {l.status}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                      {l.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13.5px] font-bold text-slate-900">
                    {new Date(l.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    {" → "}
                    {new Date(l.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[12.5px] text-slate-500">{l.reason}</p>
                  {l.reviewerNotes && (
                    <p className="mt-1 text-[12px] text-slate-500">
                      <span className="font-bold text-slate-600">School note: </span>{l.reviewerNotes}
                    </p>
                  )}
                </div>
                {l.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => handleCancel(l.id)}
                    disabled={cancellingId === l.id}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11.5px] font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    {cancellingId === l.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Apply modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-emerald-900 px-5 py-4 text-white">
              <div>
                <h3 className="text-[15px] font-extrabold">Apply for leave</h3>
                <p className="text-[12px] text-emerald-200">Holiday / emergency application by parent</p>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} className="rounded-lg p-1.5 text-emerald-200 hover:bg-white/10 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 p-5">
              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-[13px] font-medium text-rose-800">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" /> {formError}
                </div>
              )}

              <div>
                <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Leave category</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {PARENT_LEAVE_TYPES.map((t) => {
                    const active = type === t.type;
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.type}
                        type="button"
                        onClick={() => setType(t.type)}
                        className={`rounded-xl border p-3 text-left transition active:scale-[0.98] ${
                          active ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-600/20" : "border-slate-200 hover:border-slate-300"
                        }`}
                      >
                        <span className={`inline-flex rounded-lg border p-1.5 ${t.chip}`}>
                          <Icon size={14} />
                        </span>
                        <span className="mt-1.5 block text-[12.5px] font-bold text-slate-900">{t.label}</span>
                        <span className="block text-[11px] text-slate-500">{t.hint}</span>
                        {active && <CheckCircle2 size={15} className="mt-1 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="parent-leave-from" className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">From</label>
                  <input
                    id="parent-leave-from"
                    type="date"
                    required
                    min={todayStr}
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (endDate < e.target.value) setEndDate(e.target.value);
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[14px] font-semibold focus:border-emerald-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="parent-leave-to" className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">To</label>
                  <input
                    id="parent-leave-to"
                    type="date"
                    required
                    min={startDate || todayStr}
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-[14px] font-semibold focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-[12.5px]">
                <span className="flex items-center gap-1.5 font-medium text-slate-500"><Clock size={14} /> Duration</span>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800">
                  {durationDays} {durationDays === 1 ? "day" : "days"}
                </span>
              </div>

              <div>
                <label htmlFor="parent-leave-reason" className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wider text-slate-500">Reason</label>
                <textarea
                  id="parent-leave-reason"
                  rows={3}
                  required
                  maxLength={500}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Family wedding in native town, travelling for 3 days…"
                  className="w-full resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-[14px] focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-600 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 text-[13px] font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {submitting ? "Submitting…" : "Submit application"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
