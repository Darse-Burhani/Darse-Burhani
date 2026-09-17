"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  getTeacherLeaves,
  approveTeacherLeave,
  rejectTeacherLeave,
  LeaveRequestItem,
  TeacherLeaveStats,
} from "@/lib/api";
import { PendingLeaveTable } from "@/components/leave/PendingLeaveTable";

export default function TeacherLeavePage() {
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [stats, setStats] = useState<TeacherLeaveStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    total: 0,
  });
  const [classes, setClasses] = useState<Array<{ id: string; name: string; grade: string; section: string }>>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("PENDING");
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getTeacherLeaves({
        status: selectedStatus === "ALL" ? undefined : selectedStatus,
        classId: selectedClass || undefined,
        search: search.trim() || undefined,
      });

      setRequests(res.requests);
      setStats(res.stats);
      setClasses(res.classes);
    } catch (err: any) {
      console.error("Teacher leave error:", err);
      setError(err.message || "Failed to load leave requests");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, selectedClass, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id: string, notes?: string) => {
    await approveTeacherLeave(id, notes);
    await fetchData(true);
  };

  const handleReject = async (id: string, notes?: string) => {
    await rejectTeacherLeave(id, notes);
    await fetchData(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">Student Leave Requests</h1>
          <p className="text-xs text-gray-500 mt-0.5">Review and manage medical and absence requests for your classes</p>
        </div>

        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 self-start sm:self-auto transition-colors"
          title="Refresh requests"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
        </button>
      </div>

      {/* ── Metric Summary Stack ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setSelectedStatus("PENDING")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedStatus === "PENDING"
              ? "bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-400/20"
              : "bg-white border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Pending Action</span>
            <Clock className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-black">{stats.pending}</div>
          <div className="text-[11px] opacity-75 mt-0.5">Awaiting teacher review</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatus("APPROVED")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedStatus === "APPROVED"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20"
              : "bg-white border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Approved</span>
            <CheckCircle2 className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-black">{stats.approved}</div>
          <div className="text-[11px] opacity-75 mt-0.5">Authorized leaves</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatus("REJECTED")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedStatus === "REJECTED"
              ? "bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-500/20"
              : "bg-white border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Declined</span>
            <XCircle className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-black">{stats.rejected}</div>
          <div className="text-[11px] opacity-75 mt-0.5">Rejected applications</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatus("ALL")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedStatus === "ALL"
              ? "bg-gray-900 text-white border-gray-900 shadow-md ring-2 ring-gray-900/20"
              : "bg-white border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Total Requests</span>
            <Calendar className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-black">{stats.total}</div>
          <div className="text-[11px] opacity-75 mt-0.5">All student leaves</div>
        </button>
      </div>

      {/* ── Filter & Search Toolbar ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-gray-100 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by student name, ITS, or ID..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">All My Classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Gr {c.grade}-{c.section})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error notification */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Table View ── */}
      {loading ? (
        <div className="py-20 text-center text-gray-400 flex flex-col items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
          <span className="text-xs">Loading leave requests...</span>
        </div>
      ) : (
        <PendingLeaveTable
          requests={requests}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={loading}
        />
      )}
    </div>
  );
}
