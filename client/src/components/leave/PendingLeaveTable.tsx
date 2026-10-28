"use client";

import { useState } from "react";
import {
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Stethoscope,
  HeartPulse,
  Paperclip,
  ExternalLink,
  Loader2,
  Sparkles,
  Palmtree,
  CheckSquare,
  Square,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { LeaveRequestItem, PortalLeaveMember } from "@/lib/api";

interface PendingLeaveTableProps {
  requests: LeaveRequestItem[];
  isAdmin?: boolean;
  onApprove: (id: string, notes?: string, approvedDays?: number | null) => Promise<void>;
  onReject: (id: string, notes?: string) => Promise<void>;
  onBatchApprove?: (ids: string[], notes?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  assignees?: PortalLeaveMember[];
  onAssign?: (id: string, memberId: string | null) => Promise<void>;
  loading?: boolean;
}

export function PendingLeaveTable({
  requests,
  isAdmin = false,
  onApprove,
  onReject,
  onBatchApprove,
  onDelete,
  assignees,
  onAssign,
  loading = false,
}: PendingLeaveTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeAction, setActiveAction] = useState<{
    id: string;
    type: "approve" | "reject";
    studentName: string;
    requestedDays?: number;
    startDate?: string;
  } | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [grantDays, setGrantDays] = useState<number>(1);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);

  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const allPendingSelected =
    pendingRequests.length > 0 && pendingRequests.every((r) => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (allPendingSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRequests.map((r) => r.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleActionConfirm = async () => {
    if (!activeAction) return;

    setProcessing(true);
    try {
      if (activeAction.type === "approve") {
        await onApprove(
          activeAction.id,
          actionNotes.trim() || undefined,
          grantDays
        );
      } else {
        await onReject(activeAction.id, actionNotes.trim() || "Declined");
      }
      setActiveAction(null);
      setActionNotes("");
    } catch (err: any) {
      alert(err.message || "Failed to process action");
    } finally {
      setProcessing(false);
    }
  };

  const handleAssign = async (id: string, memberId: string | null) => {
    if (!onAssign) return;
    setAssigningId(id);
    try {
      await onAssign(id, memberId);
    } catch (err: any) {
      alert(err.message || "Failed to assign leave application");
    } finally {
      setAssigningId(null);
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.size === 0 || !onBatchApprove) return;
    const ids = Array.from(selectedIds);
    if (!confirm(`Mark and approve ${ids.length} student(s) on Holiday / Leave? Attendance and Google Sheet will be synchronized immediately.`)) return;

    setBatchProcessing(true);
    try {
      await onBatchApprove(ids, "Batch approved on Holiday / Leave");
      setSelectedIds(new Set());
    } catch (err: any) {
      alert(err.message || "Failed to batch approve leave requests");
    } finally {
      setBatchProcessing(false);
    }
  };

  if (requests.length === 0 && !loading) {
    return (
      <div className="text-center py-12 px-4 rounded-2xl bg-white border border-gray-100 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-sm text-gray-900 mb-1">No Leave Requests</h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto">
          There are no leave requests matching the current filter.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Batch Actions Bar */}
      {selectedIds.size > 0 && onBatchApprove && (
        <div className="mb-3 p-3 rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-800 text-white shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-xs font-bold">
              {selectedIds.size}
            </span>
            <span className="text-xs font-bold">
              {selectedIds.size} student request{selectedIds.size > 1 ? "s" : ""} selected for Holiday / Leave Marking
            </span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold transition-colors"
            >
              Deselect All
            </button>
            <button
              type="button"
              onClick={handleBatchApprove}
              disabled={batchProcessing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 active:scale-98 text-emerald-950 text-xs font-black shadow-md transition-all"
            >
              {batchProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Palmtree className="w-3.5 h-3.5" />}
              <span>Mark All Selected on Holiday / Leave</span>
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl bg-white border border-gray-100 shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50/80 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-100">
            <tr>
              {onBatchApprove && pendingRequests.length > 0 && (
                <th className="py-3.5 px-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-gray-500 hover:text-gray-900 transition-colors"
                    title={allPendingSelected ? "Deselect all pending" : "Select all pending"}
                  >
                    {allPendingSelected ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
              )}
              <th className="py-3.5 px-4">Student</th>
              <th className="py-3.5 px-3">Class / Grade</th>
              <th className="py-3.5 px-3">Application Type</th>
              <th className="py-3.5 px-3">Date Range</th>
              <th className="py-3.5 px-4 min-w-[200px]">Reason & Details</th>
              <th className="py-3.5 px-3">Attendance Impact</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map((item) => {
              const start = new Date(item.startDate);
              const end = new Date(item.endDate);
              const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
              const isPending = item.status === "PENDING";
              const isSelected = selectedIds.has(item.id);

              return (
                <tr
                  key={item.id}
                  className={`transition-colors ${
                    isSelected ? "bg-emerald-50/70" : "hover:bg-gray-50/60"
                  }`}
                >
                  {/* Checkbox Cell */}
                  {onBatchApprove && pendingRequests.length > 0 && (
                    <td className="py-3.5 px-3 text-center">
                      {isPending ? (
                        <button
                          type="button"
                          onClick={() => toggleSelectOne(item.id)}
                          className="text-gray-500 hover:text-emerald-600 transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-300">•</span>
                      )}
                    </td>
                  )}

                  {/* Student Cell */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="w-8 h-8 rounded-full border border-gray-200">
                        <AvatarImage src={item.avatarUrl || undefined} />
                        <AvatarFallback className="text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {getInitials(item.studentName || "ST")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-bold text-xs text-gray-900 leading-tight">
                          {item.studentName || "Student"}
                        </div>
                        <div className="text-[11px] text-gray-500">ITS / ID: {item.its || "—"}</div>
                        {item.assignedTo && (
                          <div className="text-[10px] font-semibold text-sky-700 mt-0.5">
                            Assigned: {item.assignedTo.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Class / Grade */}
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-gray-800">{item.className || `Grade ${item.grade}-${item.section}`}</div>
                    <div className="text-[10px] text-gray-500">Grade {item.grade} • Sec {item.section}</div>
                  </td>

                  {/* Leave Type */}
                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        item.type === "MEDICAL"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : item.type === "FAMILY_EMERGENCY"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}
                    >
                      {item.type === "MEDICAL" && <Stethoscope className="w-3 h-3" />}
                      {item.type === "FAMILY_EMERGENCY" && <HeartPulse className="w-3 h-3" />}
                      {item.type === "PERSONAL" && <Palmtree className="w-3 h-3" />}
                      <span>{item.type === "PERSONAL" ? "Holiday / Personal" : item.type.replace(/_/g, " ")}</span>
                    </span>
                  </td>

                  {/* Date Range */}
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-gray-900">
                      {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {item.startDate !== item.endDate && ` – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </div>
                    <div className="text-[11px] text-gray-500 font-medium">
                      {diffDays} {diffDays === 1 ? "day" : "days"} requested
                    </div>
                    {item.status === "APPROVED" && item.approvedDays != null && (
                      <div
                        className={`text-[11px] font-bold mt-0.5 ${
                          item.approvedDays < diffDays ? "text-amber-700" : "text-emerald-700"
                        }`}
                      >
                        {item.approvedDays} of {diffDays} {diffDays === 1 ? "day" : "days"} granted
                      </div>
                    )}
                    {item.status === "APPROVED" && item.grantedStartDate && item.grantedEndDate &&
                      item.grantedStartDate !== item.startDate && (
                        <div className="text-[10px] text-gray-500">
                          Granted from{" "}
                          {new Date(item.grantedStartDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            timeZone: "UTC",
                          })}
                        </div>
                      )}
                  </td>

                  {/* Reason & Attachment */}
                  <td className="py-3.5 px-4">
                    <p className="text-gray-700 line-clamp-2 leading-relaxed font-medium">{item.reason}</p>
                    {item.attachmentUrl && (
                      <a
                        href={item.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline mt-1"
                      >
                        <Paperclip className="w-3 h-3" />
                        <span>Supporting Document</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </td>

                  {/* Status / Attendance Impact */}
                  <td className="py-3.5 px-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold w-fit ${
                          item.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : item.status === "REJECTED"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : item.status === "PENDING"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-gray-100 text-gray-600 border border-gray-200"
                        }`}
                      >
                        {item.status === "APPROVED" && <CheckCircle2 className="w-3 h-3" />}
                        {item.status === "REJECTED" && <XCircle className="w-3 h-3" />}
                        {item.status === "PENDING" && <Clock className="w-3 h-3" />}
                        <span>{item.status === "APPROVED" ? (item.type === "MEDICAL" ? "MEDICAL EXCUSED" : "ON HOLIDAY / LEAVE") : item.status}</span>
                      </span>
                      {item.status === "APPROVED" && (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>Reflected in Sheet & Attendance</span>
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    {isPending ? (
                      <div className="flex flex-col items-end gap-1.5">
                        {assignees && onAssign && (
                          <div className="flex items-center gap-1">
                            <select
                              value={item.assignedTo?.id || ""}
                              onChange={(e) => handleAssign(item.id, e.target.value || null)}
                              disabled={assigningId === item.id}
                              className="max-w-[170px] px-2 py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] font-semibold text-gray-700 focus:outline-none focus:border-emerald-500"
                              title="Assign this leave application to a faculty member with portal access"
                            >
                              <option value="">Assign to faculty…</option>
                              {assignees.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name}
                                </option>
                              ))}
                            </select>
                            {assigningId === item.id && (
                              <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                            )}
                          </div>
                        )}
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setGrantDays(diffDays);
                              setActiveAction({
                                id: item.id,
                                type: "approve",
                                studentName: item.studentName || "Student",
                                requestedDays: diffDays,
                                startDate: item.startDate,
                              });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all"
                            title="Approve leave and sync attendance (you can grant fewer days)"
                          >
                            <Palmtree className="w-3.5 h-3.5" />
                            <span>Approve Leave</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveAction({
                                id: item.id,
                                type: "reject",
                                studentName: item.studentName || "Student",
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1 border border-rose-200 transition-colors"
                            title="Reject request"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-right">
                        <div className="text-[11px] text-gray-500 font-medium">
                          {item.reviewedBy ? `Approved by ${item.reviewedBy}` : "Processed"}
                        </div>
                        {isAdmin && onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(item.id)}
                            className="text-[10px] text-rose-600 hover:underline mt-0.5 inline-block"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Review Confirmation Modal */}
      {activeAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setActiveAction(null)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl border border-gray-100">
            <h3 className="font-bold text-sm text-gray-900 mb-1">
              {activeAction.type === "approve" ? "Approve Leave Application" : "Reject Leave Request"}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {activeAction.type === "approve"
                ? `Approve ${activeAction.studentName}'s leave. Choose how many days to grant — attendance and the Google Sheet will reflect only the granted dates.`
                : `Specify why the leave for ${activeAction.studentName} is being rejected.`}
            </p>

            <div className="mb-4">
              <label htmlFor="action-notes" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Reviewer Remarks / School Notes
                <span className="normal-case font-normal text-gray-500 ml-1.5">(Will be sent to parent via notification & email)</span>
              </label>
              <textarea
                id="action-notes"
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  activeAction.type === "approve"
                    ? "e.g., Leave granted as requested / Reduced due to exam schedule..."
                    : "e.g., Leave application declined due to mandatory academic schedule..."
                }
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 resize-none"
              />
            </div>

            {activeAction.type === "approve" && (
              <div className="mb-4 p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label
                    htmlFor="grant-days"
                    className="block text-xs font-bold text-emerald-950 uppercase tracking-wider"
                  >
                    Granted Leave Option
                  </label>
                  <span className="text-[11px] font-semibold text-emerald-800">
                    Requested: {activeAction.requestedDays ?? 1} {(activeAction.requestedDays ?? 1) === 1 ? "day" : "days"}
                  </span>
                </div>

                {(activeAction.requestedDays ?? 1) > 1 ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGrantDays(activeAction.requestedDays ?? 1)}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-between ${
                          grantDays === (activeAction.requestedDays ?? 1)
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-white text-gray-700 border-emerald-200 hover:bg-emerald-50"
                        }`}
                      >
                        <span className="text-[10px] uppercase opacity-80">Full Approval</span>
                        <span className="text-sm">All {activeAction.requestedDays} Days</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (grantDays >= (activeAction.requestedDays ?? 1)) {
                            setGrantDays(Math.max(1, (activeAction.requestedDays ?? 2) - 1));
                          }
                        }}
                        className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all text-left flex flex-col justify-between ${
                          grantDays < (activeAction.requestedDays ?? 1)
                            ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                            : "bg-white text-gray-700 border-emerald-200 hover:bg-emerald-50"
                        }`}
                      >
                        <span className="text-[10px] uppercase opacity-80">Reduced Approval</span>
                        <span className="text-sm">{grantDays < (activeAction.requestedDays ?? 1) ? `${grantDays} Days Granted` : "Reduce Days"}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs font-semibold text-gray-700 shrink-0">Days to Grant:</span>
                      <input
                        id="grant-days"
                        type="number"
                        min={1}
                        max={activeAction.requestedDays}
                        value={grantDays}
                        onChange={(e) => {
                          const max = activeAction.requestedDays ?? 1;
                          const next = Number(e.target.value);
                          setGrantDays(Math.min(Math.max(Number.isFinite(next) ? next : 1, 1), max));
                        }}
                        className="w-20 px-3 py-1.5 rounded-xl border border-emerald-300 text-sm font-bold text-emerald-900 bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
                      />
                      <button
                        type="button"
                        onClick={() => setGrantDays(activeAction.requestedDays ?? 1)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50"
                      >
                        Max ({activeAction.requestedDays})
                      </button>
                      <button
                        type="button"
                        onClick={() => setGrantDays(1)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-emerald-300 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50"
                      >
                        1 Day
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-emerald-900 font-semibold py-1">
                    Granting single requested day (full duration).
                  </div>
                )}

                {activeAction.startDate && (
                  <div className="text-[11px] font-semibold text-emerald-900 mt-2.5 pt-2 border-t border-emerald-200/80">
                    Granted Range:{" "}
                    <span className="font-bold">
                      {new Date(activeAction.startDate).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}{" "}
                      to{" "}
                      {new Date(
                        new Date(activeAction.startDate).getTime() +
                          (Math.max(1, grantDays) - 1) * 86400000
                      ).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        timeZone: "UTC",
                      })}
                    </span>{" "}
                    ({grantDays} {grantDays === 1 ? "day" : "days"})
                  </div>
                )}

                {grantDays < (activeAction.requestedDays ?? 1) ? (
                  <div className="text-[11.5px] text-amber-800 font-bold bg-amber-100/80 border border-amber-300/80 rounded-lg p-2 mt-2">
                    ⚠ Reduced Approval: Parent will be notified via outside push & email that leave is approved for {grantDays} of {activeAction.requestedDays} days.
                  </div>
                ) : (
                  <div className="text-[11.5px] text-emerald-800 font-bold bg-emerald-100/80 border border-emerald-300/80 rounded-lg p-2 mt-2">
                    ✓ Full Approval: Parent will be notified that leave is approved in full ({grantDays} {grantDays === 1 ? "day" : "days"}).
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setActiveAction(null);
                  setActionNotes("");
                }}
                className="px-3.5 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActionConfirm}
                disabled={processing}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs flex items-center gap-1.5 ${
                  activeAction.type === "approve"
                    ? grantDays < (activeAction.requestedDays ?? 1)
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {processing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>
                  {activeAction.type === "approve"
                    ? grantDays < (activeAction.requestedDays ?? 1)
                      ? `Approve Reduced (${grantDays} Days) & Sync`
                      : `Approve (${grantDays} Days) & Sync`
                    : "Confirm Rejection"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
