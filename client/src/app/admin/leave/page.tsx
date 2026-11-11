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
  Plus,
  Palmtree,
  Sparkles,
  PauseCircle,
  X,
  ExternalLink,
  Check,
  GraduationCap,
  Users,
  Mail,
  Send,
  AlertTriangle,
} from "lucide-react";
import {
  getAdminLeaves,
  approveAdminLeave,
  rejectAdminLeave,
  holdAdminLeave,
  updateAdminLeaveDates,
  deleteAdminLeave,
  batchApproveAdminLeaves,
  getAdminLeaveMembers,
  assignAdminLeave,
  unassignAdminLeave,
  getFacultyLeaves,
  getLeaveSmtpStatus,
  sendLeaveTestEmail,
  LeaveSmtpConfigStatus,
  LeaveSmtpTestResult,
  LeaveRequestItem,
  AdminLeaveStats,
  PortalLeaveMember,
  FacultyLeaveItem,
  FacultyLeaveStats,
} from "@/lib/api";
import { PendingLeaveTable } from "@/components/leave/PendingLeaveTable";
import { ManualLeaveModal } from "@/components/leave/ManualLeaveModal";
import { FacultyLeaveTable } from "@/components/leave/FacultyLeaveTable";

export default function AdminLeavePage() {
  const [activeTab, setActiveTab] = useState<"STUDENT" | "FACULTY">("STUDENT");
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualModalDefaultRole, setManualModalDefaultRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [members, setMembers] = useState<PortalLeaveMember[]>([]);
  const [stats, setStats] = useState<AdminLeaveStats>({
    pending: 0,
    approved: 0,
    rejected: 0,
    medical: 0,
    total: 0,
  });

  // Faculty Leaves state
  const [facultyItems, setFacultyItems] = useState<FacultyLeaveItem[]>([]);
  const [facultyStats, setFacultyStats] = useState<FacultyLeaveStats>({
    active: 0,
    upcoming: 0,
    medical: 0,
    completed: 0,
    total: 0,
  });
  const [loadingFaculty, setLoadingFaculty] = useState(false);

  const [gradesSections, setGradesSections] = useState<Array<{ grade: string; section: string }>>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedSection, setSelectedSection] = useState<string>("");
  const [search, setSearch] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFacultyData = useCallback(async () => {
    setLoadingFaculty(true);
    try {
      const res = await getFacultyLeaves({ isAdmin: true });
      if (res.success && res.data) {
        setFacultyItems(res.data);
        if (res.stats) setFacultyStats(res.stats);
      }
    } catch (err: any) {
      console.error("Failed to load faculty leaves:", err);
    } finally {
      setLoadingFaculty(false);
    }
  }, []);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    fetchFacultyData();

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

  useEffect(() => {
    getAdminLeaveMembers()
      .then(setMembers)
      .catch((err) => console.error("Failed to load portal members:", err));
  }, []);

  const handleApprove = async (
    id: string,
    notes?: string,
    approvedDays?: number | null,
    startDate?: string | null,
    endDate?: string | null
  ) => {
    const res = await approveAdminLeave(id, notes, approvedDays, startDate, endDate);
    await fetchData(true);
    return res;
  };

  const handleAssign = async (id: string, memberId: string | null) => {
    if (memberId) {
      await assignAdminLeave(id, memberId);
    } else {
      await unassignAdminLeave(id);
    }
    await fetchData(true);
  };

  const handleBatchApprove = async (ids: string[], notes?: string) => {
    await batchApproveAdminLeaves(ids, notes);
    await fetchData(true);
  };

  const handleReject = async (id: string, notes?: string) => {
    const res = await rejectAdminLeave(id, notes);
    await fetchData(true);
    return res;
  };

  const handleHold = async (
    id: string,
    notes?: string,
    startDate?: string | null,
    endDate?: string | null
  ) => {
    const res = await holdAdminLeave(id, notes, startDate, endDate);
    await fetchData(true);
    return res;
  };

  const handleUpdateDates = async (
    id: string,
    startDate: string,
    endDate: string,
    notes?: string
  ) => {
    const res = await updateAdminLeaveDates(id, startDate, endDate, notes);
    await fetchData(true);
    return res;
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this leave request?")) return;
    // Optimistically remove from state immediately so it goes away without waiting
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await deleteAdminLeave(id);
      await fetchData(true);
    } catch (err: any) {
      console.error("Failed to delete leave:", err);
      alert("Failed to delete leave request: " + (err.message || "Unknown error"));
      await fetchData(true);
    }
  };

  const distinctGrades = Array.from(new Set(gradesSections.map((g) => g.grade))).sort();
  const distinctSections = Array.from(new Set(gradesSections.map((g) => g.section))).sort();

  // ── Email service status (leave notification delivery) ──
  const [smtpStatus, setSmtpStatus] = useState<{ config: LeaveSmtpConfigStatus; live: LeaveSmtpTestResult } | null>(null);
  const [smtpChecking, setSmtpChecking] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const refreshSmtpStatus = useCallback(async () => {
    setSmtpChecking(true);
    try {
      setSmtpStatus(await getLeaveSmtpStatus());
    } catch {
      setSmtpStatus(null);
    } finally {
      setSmtpChecking(false);
    }
  }, []);

  useEffect(() => {
    refreshSmtpStatus();
  }, [refreshSmtpStatus]);

  const handleSmtpTest = async () => {
    setSmtpTesting(true);
    setSmtpTestResult(null);
    try {
      const res = await sendLeaveTestEmail();
      if (res.success) {
        setSmtpTestResult({ ok: true, text: res.message || "Test email dispatched successfully." });
      } else {
        setSmtpTestResult({ ok: false, text: res.error || "Test email failed." });
      }
    } catch (err: any) {
      setSmtpTestResult({ ok: false, text: err.message || "Test email failed." });
    } finally {
      setSmtpTesting(false);
      refreshSmtpStatus();
    }
  };

  const providerChips = [
    { label: "Resend", active: !!smtpStatus?.config.hasResend },
    { label: "Brevo", active: !!smtpStatus?.config.hasBrevo },
    { label: "Google SMTP", active: !!smtpStatus?.config.hasDedicatedLeaveCreds || !!smtpStatus?.config.hasPrimaryCreds },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 leading-tight">Leave Administration</h1>
          <p className="text-xs text-gray-500 mt-0.5">Global oversight and review for all medical, personal, and faculty leaves</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setManualModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Record Manual Leave</span>
          </button>

          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
            title="Refresh records"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Email Service Status ── */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm text-gray-900">Leave Email Service</p>
              {smtpStatus?.config.configured ? (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase tracking-wide">
                  Ready
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wide">
                  Not Configured
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {providerChips.map((chip) => (
                <span
                  key={chip.label}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    chip.active
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-gray-50 text-gray-400 border border-gray-100"
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${chip.active ? "bg-emerald-500" : "bg-gray-300"}`} />
                  {chip.label}
                </span>
              ))}
              <span className="text-[11px] text-gray-500 truncate">
                · {smtpStatus?.config.activeMailbox || "admin.galiakot@darseburhani.org"}
              </span>
            </div>
            {smtpStatus && !smtpStatus.live.ok && (
              <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span className="truncate" title={smtpStatus.live.error}>
                  Connectivity: {smtpStatus.live.error}
                </span>
              </p>
            )}
            {smtpTestResult && (
              <p
                className={`text-[11px] mt-1 flex items-start gap-1 ${
                  smtpTestResult.ok ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {smtpTestResult.ok ? (
                  <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                )}
                <span>{smtpTestResult.text}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={refreshSmtpStatus}
            disabled={smtpChecking}
            className="p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
            title="Re-check email connectivity"
          >
            <RefreshCw className={`w-4 h-4 ${smtpChecking ? "animate-spin text-emerald-600" : ""}`} />
          </button>
          <button
            type="button"
            onClick={handleSmtpTest}
            disabled={smtpTesting || !smtpStatus?.config.configured}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {smtpTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Send Test Email</span>
          </button>
        </div>
      </div>

      {/* ── Main Tab Navigation (Talabat vs Faculty) ── */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("STUDENT")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === "STUDENT"
              ? "bg-slate-900 text-white shadow-xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Talabat (Student) Leaves</span>
          {stats.pending > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black">
              {stats.pending}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("FACULTY")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeTab === "FACULTY"
              ? "bg-amber-500 text-slate-950 shadow-xs"
              : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Faculty & Asateezah Leaves</span>
          {facultyStats.active > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black">
              {facultyStats.active}
            </span>
          )}
        </button>
      </div>

      {activeTab === "FACULTY" ? (
        <FacultyLeaveTable
          items={facultyItems}
          stats={facultyStats}
          loading={loadingFaculty}
          onRefresh={fetchFacultyData}
          onOpenRecordModal={() => {
            setManualModalDefaultRole("TEACHER");
            setManualModalOpen(true);
          }}
          isAdmin={true}
        />
      ) : (
        <>
          {/* ── Metric Summary Cards Stack ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
              onClick={() => setSelectedStatus("HOLD")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                selectedStatus === "HOLD"
                  ? "bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-500/20"
                  : "bg-white border-gray-100 hover:border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">On Hold</span>
                <PauseCircle className="w-4 h-4 opacity-80" />
              </div>
              <div className="text-2xl font-black">{stats.hold ?? 0}</div>
              <div className="text-[11px] opacity-75 mt-0.5">Pending clarification</div>
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

          {/* Live Sync Information Banner */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 text-xs text-emerald-900 font-medium">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Palmtree className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-emerald-950">Applied Student Holiday & Leave Sync Active</div>
                <div className="text-[11px] text-emerald-800 opacity-90">
                  When student holiday or leave is approved, their attendance is automatically marked as <span className="font-bold">ON_LEAVE / MEDICAL</span> across all attendance registries and reflects on the Google Sheet immediately.
                </div>
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
              onHold={handleHold}
              onBatchApprove={handleBatchApprove}
              onDelete={handleDelete}
              assignees={members}
              onAssign={handleAssign}
              onUpdateDates={handleUpdateDates}
              loading={loading}
            />
          )}
        </>
      )}

      {/* ── Manual Leave Entry Modal ── */}
      <ManualLeaveModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        onSuccess={() => {
          fetchData(true);
          fetchFacultyData();
        }}
        isAdmin={true}
        defaultRole={manualModalDefaultRole}
      />

    </div>
  );
}
