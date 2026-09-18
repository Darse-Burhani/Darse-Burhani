"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Stethoscope,
  RefreshCw,
  Search,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  getAdminLeaves,
  approveAdminLeave,
  rejectAdminLeave,
  deleteAdminLeave,
  LeaveRequestItem,
  AdminLeaveStats,
} from "@/lib/api";
import { PendingLeaveTable } from "@/components/leave/PendingLeaveTable";

export default function AdminLeavePage() {
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [stats, setStats] = useState<AdminLeaveStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    medical: 0,
    total: 0,
  });
  const [gradesSections, setGradesSections] = useState<Array<{ grade: string; section: string }>>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await getAdminLeaves({
        status: selectedStatus === "ALL" ? undefined : selectedStatus,
        type: selectedType || undefined,
        grade: selectedGrade || undefined,
        section: selectedSection || undefined,
        search: search.trim() || undefined,
      });

      setRequests(res.requests);
      setStats(res.stats);
      setGradesSections(res.gradesSections);
    } catch (err: any) {
      console.error("Admin leave error:", err);
      setError(err.message || "Failed to load leave records");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedStatus, selectedType, selectedGrade, selectedSection, search]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id: string, notes?: string) => {
    await approveAdminLeave(id, notes);
    await fetchData(true);
  };

  const handleReject = async (id: string, notes?: string) => {
    await rejectAdminLeave(id, notes);
    await fetchData(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this leave request?")) return;
    await deleteAdminLeave(id);
    await fetchData(true);
  };

  const distinctGrades = Array.from(new Set(gradesSections.map((g) => g.grade))).sort();
  const distinctSections = Array.from(new Set(gradesSections.map((g) => g.section))).sort();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">Leave Administration</h1>
          <p className="text-xs text-gray-500 mt-0.5">Global oversight and review for all medical and personal student leaves</p>
        </div>

        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 self-start sm:self-auto transition-colors"
          title="Refresh records"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
        </button>
      </div>

      {/* ── Metric Summary Cards Stack ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
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
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Pending</span>
            <Clock className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-black">{stats.pending}</div>
          <div className="text-[11px] opacity-75 mt-0.5">Awaiting decision</div>
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
          onClick={() => setSelectedType("MEDICAL")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedType === "MEDICAL"
              ? "bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-500/20"
              : "bg-white border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Medical</span>
            <Stethoscope className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-black">{stats.medical}</div>
          <div className="text-[11px] opacity-75 mt-0.5">Doctor verified</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatus("REJECTED")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            selectedStatus === "REJECTED"
              ? "bg-red-600 text-white border-red-600 shadow-md ring-2 ring-red-500/20"
              : "bg-white border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Declined</span>
            <XCircle className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-black">{stats.rejected}</div>
          <div className="text-[11px] opacity-75 mt-0.5">Rejected leaves</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setSelectedStatus("ALL");
            setSelectedType("");
          }}
          className={`p-4 rounded-2xl border text-left transition-all col-span-2 sm:col-span-1 ${
            selectedStatus === "ALL" && !selectedType
              ? "bg-gray-900 text-white border-gray-900 shadow-md ring-2 ring-gray-900/20"
              : "bg-white border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider opacity-80">Total</span>
            <Calendar className="w-4 h-4 opacity-80" />
          </div>
          <div className="text-2xl font-black">{stats.total}</div>
          <div className="text-[11px] opacity-75 mt-0.5">All applications</div>
        </button>
      </div>

      {/* ── Filters & Search Toolbar ── */}
      <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
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

          <div className="flex flex-wrap items-center gap-2">
            {/* Type selector */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Categories</option>
              <option value="MEDICAL">Medical Leave</option>
              <option value="PERSONAL">Personal Leave</option>
              <option value="FAMILY_EMERGENCY">Family Emergency</option>
              <option value="OTHER">Other</option>
            </select>

            {/* Grade selector */}
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Grades</option>
              {distinctGrades.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>

            {/* Section selector */}
            <select
              value={selectedSection}
              onChange={(e) => setSelectedSection(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Sections</option>
              {distinctSections.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error state */}
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
          isAdmin={true}
          onApprove={handleApprove}
          onReject={handleReject}
          onDelete={handleDelete}
          loading={loading}
        />
      )}
    </div>
  );
}
