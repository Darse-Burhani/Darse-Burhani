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
  Mail,
  AlertTriangle,
  Send,
  X,
  ExternalLink,
  Key,
  Check,
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
  getAdminLeaveSmtpStatus,
  testAdminLeaveEmail,
  LeaveRequestItem,
  AdminLeaveStats,
  PortalLeaveMember,
  LeaveSmtpStatus,
} from "@/lib/api";
import { PendingLeaveTable } from "@/components/leave/PendingLeaveTable";
import { ManualLeaveModal } from "@/components/leave/ManualLeaveModal";

export default function AdminLeavePage() {
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [requests, setRequests] = useState<LeaveRequestItem[]>([]);
  const [members, setMembers] = useState<PortalLeaveMember[]>([]);
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

  const [smtpStatus, setSmtpStatus] = useState<LeaveSmtpStatus | null>(null);
  const [smtpModalOpen, setSmtpModalOpen] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [testTargetEmail, setTestTargetEmail] = useState("");
  const [smtpFeedback, setSmtpFeedback] = useState<{ success: boolean; message: string; details?: string } | null>(null);

  const loadSmtpStatus = useCallback(async (force = false) => {
    try {
      const data = await getAdminLeaveSmtpStatus(force);
      setSmtpStatus(data);
      if (!testTargetEmail && data?.config?.adminMailbox) {
        setTestTargetEmail(data.config.adminMailbox);
      }
    } catch (e) {
      console.warn("Could not load SMTP status:", e);
    }
  }, [testTargetEmail]);

  useEffect(() => {
    loadSmtpStatus(false);
  }, [loadSmtpStatus]);

  const handleTestEmail = async () => {
    setTestingSmtp(true);
    setSmtpFeedback(null);
    try {
      const target = testTargetEmail.trim() || undefined;
      const res = await testAdminLeaveEmail(target);
      setSmtpFeedback({
        success: true,
        message: res.message || "Test email sent successfully! Please check the inbox and spam folder.",
      });
      await loadSmtpStatus(true);
    } catch (err: any) {
      setSmtpFeedback({
        success: false,
        message: err.message || "Email delivery failed",
        details: err?.data?.error || err?.error,
      });
    } finally {
      setTestingSmtp(false);
    }
  };

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

      {/* ── Email Notification Status Banner ── */}
      {smtpStatus && (
        <div
          className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl border transition-all ${
            smtpStatus.live.ok
              ? "bg-emerald-50/70 border-emerald-200/80 text-emerald-950"
              : "bg-amber-50/90 border-amber-300/80 text-amber-950"
          }`}
        >
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 mt-0.5 sm:mt-0 ${
                smtpStatus.live.ok
                  ? "bg-emerald-500/15 text-emerald-700"
                  : "bg-amber-500/20 text-amber-700"
              }`}
            >
              {smtpStatus.live.ok ? <Mail className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            </div>
            <div>
              <div className="font-bold text-xs sm:text-sm flex items-center gap-2">
                <span>Admin Leave Notifications</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${
                    smtpStatus.live.ok
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-200 text-amber-900"
                  }`}
                >
                  {smtpStatus.live.ok ? "Active" : "SMTP Password Missing"}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-gray-600 mt-0.5">
                {smtpStatus.live.ok ? (
                  <>
                    Automated leave notifications are delivering to{" "}
                    <strong className="font-semibold text-emerald-900">{smtpStatus.config.adminMailbox}</strong> via{" "}
                    {smtpStatus.live.transportType === "dedicated_leave" ? "Google Workspace" : "Primary SMTP"}.
                  </>
                ) : (
                  <>
                    Emails to <strong className="font-semibold text-amber-950">{smtpStatus.config.adminMailbox}</strong>{" "}
                    require <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-[10px] text-amber-900">LEAVE_SMTP_PASS</code> in Render.
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setSmtpFeedback(null);
              setSmtpModalOpen(true);
            }}
            className={`px-3.5 py-1.5 rounded-xl font-bold text-xs shrink-0 shadow-sm transition-all flex items-center gap-1.5 ${
              smtpStatus.live.ok
                ? "bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300"
                : "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20"
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{smtpStatus.live.ok ? "Test Delivery" : "Setup Guide & Test"}</span>
          </button>
        </div>
      )}

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

      {/* ── Manual Leave Entry Modal ── */}
      <ManualLeaveModal
        isOpen={manualModalOpen}
        onClose={() => setManualModalOpen(false)}
        onSuccess={() => fetchData(true)}
        isAdmin={true}
      />

      {/* ── SMTP Diagnostics & Setup Modal ── */}
      {smtpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-700">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 leading-tight">
                    Leave Email Notifications
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    SMTP dispatch status & delivery verification
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSmtpModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Status Cards */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Target Mailbox</div>
                <div className="font-bold text-gray-900 mt-1 break-all">
                  {smtpStatus?.config.adminMailbox || "admin.galiakot@darseburhani.org"}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-gray-50 border border-gray-100">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Connection Status</div>
                <div className="mt-1 flex items-center gap-1.5 font-bold">
                  {smtpStatus?.live.ok ? (
                    <span className="text-emerald-700 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Connected OK
                    </span>
                  ) : (
                    <span className="text-amber-700 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Offline / Auth Needed
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Live Error Display (if any) */}
            {smtpStatus && !smtpStatus.live.ok && (
              <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-red-800">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  SMTP Connection Failure
                </div>
                <div className="font-mono text-[11px] text-red-700 bg-white/60 p-2 rounded-xl break-all">
                  {smtpStatus.live.error || "No password configured for SMTP authentication"}
                </div>
              </div>
            )}

            {/* Test Email Dispatch Form */}
            <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 space-y-3">
              <div className="text-xs font-bold text-emerald-950 flex items-center justify-between">
                <span>Send Live Test Notification</span>
                <span className="text-[11px] font-normal text-emerald-700">Verifies actual inbox arrival</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testTargetEmail}
                  onChange={(e) => setTestTargetEmail(e.target.value)}
                  placeholder="admin.galiakot@darseburhani.org"
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testingSmtp}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 shrink-0"
                >
                  {testingSmtp ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Test</span>
                    </>
                  )}
                </button>
              </div>

              {smtpFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium ${
                    smtpFeedback.success
                      ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                      : "bg-red-100 text-red-900 border border-red-300"
                  }`}
                >
                  <div>{smtpFeedback.message}</div>
                  {smtpFeedback.details && (
                    <div className="font-mono text-[10px] mt-1 opacity-80 break-all">{smtpFeedback.details}</div>
                  )}
                </div>
              )}
            </div>

            {/* Step-by-Step Setup Instructions */}
            <div className="border-t border-gray-100 pt-4 space-y-2.5">
              <div className="text-xs font-bold text-gray-900">
                How to Enable Leave Notification Emails (Google Workspace)
              </div>
              <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside leading-relaxed">
                <li>
                  Sign in to Google Account as{" "}
                  <strong className="text-gray-900 font-semibold">admin.galiakot@darseburhani.org</strong>
                </li>
                <li>
                  Go to <strong className="text-gray-900 font-semibold">Security</strong> → ensure{" "}
                  <strong className="text-emerald-700 font-semibold">2-Step Verification</strong> is ON
                </li>
                <li>
                  Search for <strong className="text-gray-900 font-semibold">App passwords</strong> (or visit{" "}
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 underline font-semibold"
                  >
                    myaccount.google.com/apppasswords
                  </a>
                  ) and create an app password named <strong className="text-gray-900 font-semibold">Darse Burhani Leave</strong>
                </li>
                <li>
                  Copy the generated <strong className="text-gray-900 font-semibold">16-character code</strong>
                </li>
                <li>
                  In your <strong className="text-gray-900 font-semibold">Render Dashboard</strong> (or local{" "}
                  <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-[10px]">.env</code>), add the variable:
                  <div className="mt-1 bg-gray-900 text-amber-300 p-2 rounded-xl font-mono text-[11px] select-all">
                    LEAVE_SMTP_PASS=your-16-character-code
                  </div>
                </li>
              </ol>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 pt-3 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSmtpModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
