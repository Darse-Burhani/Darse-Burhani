"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  RefreshCw,
  Loader2,
  AlertCircle,
  Info,
} from "lucide-react";

import { LeaveHistoryList } from "@/components/leave/LeaveHistoryList";
import { getTalabatLeaves, type LeaveRequestItem, type StudentLeaveSummary } from "@/lib/api";

export default function TalabatLeavePage() {
  const [leaves, setLeaves] = useState<LeaveRequestItem[]>([]);
  const [summary, setSummary] = useState<StudentLeaveSummary>({
    totalRequests: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    approvedDays: 0,
    medicalDays: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getTalabatLeaves();
      setLeaves(res.leaves);
      setSummary(res.summary);
    } catch (err: any) {
      console.error("Talabat leaves error:", err);
      setError(err.message || "Failed to load leave records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">Leave Records</h1>
          <p className="text-xs text-gray-500 mt-0.5">View your official absence applications and their status</p>
        </div>

        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="self-start sm:self-auto p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
          title="Refresh list"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
        </button>
      </div>

      {/* ── Parent-applies notice (holiday/medical removed from talabat) ── */}
      <div className="flex items-start gap-2.5 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3.5 text-[13px] leading-relaxed text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
        <p>
          <span className="font-bold">Leave applications are now submitted by your parent / guardian</span> from
          the Parent Portal. Holiday and medical applications are no longer available on the talabat side —
          please ask your parent to apply on your behalf.
        </p>
      </div>

      {/* ── Metric Cards Stack ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Approved Days</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{summary.approvedDays}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Approved days off</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Under Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{summary.pendingCount}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Pending approval</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Applications</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{summary.totalRequests}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Total submissions</div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Leave History List (read-only) ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-800 mb-3">Leave History</h2>
        {loading ? (
          <div className="py-16 text-center text-gray-400 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
            <span className="text-xs">Loading leave records...</span>
          </div>
        ) : (
          <LeaveHistoryList
            leaves={leaves}
            onRefresh={() => fetchData(true)}
          />
        )}
      </div>
    </div>
  );
}
