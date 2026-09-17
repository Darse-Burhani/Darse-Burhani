"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Stethoscope,
  Plus,
  RefreshCw,
  Loader2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { getTalabatLeaves, LeaveRequestItem, StudentLeaveSummary } from "@/lib/api";
import { LeaveFormModal } from "@/components/leave/LeaveFormModal";
import { LeaveHistoryList } from "@/components/leave/LeaveHistoryList";

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
  const [modalOpen, setModalOpen] = useState(false);

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
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">Medical & Leave Requests</h1>
          <p className="text-xs text-gray-500 mt-0.5">Submit and monitor official absence applications</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {/* ── Metric Cards Stack ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Leaves</span>
            <Calendar className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{summary.approvedDays}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Approved days off</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Medical Leave</span>
            <Stethoscope className="w-4 h-4 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{summary.medicalDays}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Doctor verified days</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Under Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-gray-900">{summary.pendingCount}</div>
          <div className="text-[11px] text-gray-500 mt-0.5">Pending approval</div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs">
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

      {/* ── Leave History List ── */}
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
            onRequestClick={() => setModalOpen(true)}
          />
        )}
      </div>

      {/* ── Submit Modal ── */}
      <LeaveFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => fetchData(true)}
      />
    </div>
  );
}
