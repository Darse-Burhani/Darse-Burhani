"use client";

import React, { useState } from "react";
import {
  Check,
  X,
  Clock,
  CheckCircle2,
  XCircle,
  Stethoscope,
  User,
  HeartPulse,
  Paperclip,
  ExternalLink,
  Loader2,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { LeaveRequestItem } from "@/lib/api";

interface PendingLeaveTableProps {
  requests: LeaveRequestItem[];
  isAdmin?: boolean;
  onApprove: (id: string, notes?: string) => Promise<void>;
  onReject: (id: string, notes?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  loading?: boolean;
}

export function PendingLeaveTable({
  requests,
  isAdmin = false,
  onApprove,
  onReject,
  onDelete,
  loading = false,
}: PendingLeaveTableProps) {
  const [activeAction, setActiveAction] = useState<{
    id: string;
    type: "approve" | "reject";
    studentName: string;
  } | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleActionConfirm = async () => {
    if (!activeAction) return;

    setProcessing(true);
    try {
      if (activeAction.type === "approve") {
        await onApprove(activeAction.id, actionNotes.trim() || undefined);
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
      <div className="overflow-x-auto rounded-2xl bg-white border border-gray-100 shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50/80 text-gray-600 font-bold uppercase tracking-wider border-b border-gray-100">
            <tr>
              <th className="py-3.5 px-4">Student</th>
              <th className="py-3.5 px-3">Class / Grade</th>
              <th className="py-3.5 px-3">Leave Type</th>
              <th className="py-3.5 px-3">Date Range</th>
              <th className="py-3.5 px-4 min-w-[200px]">Reason & Proof</th>
              <th className="py-3.5 px-3">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {requests.map((item) => {
              const start = new Date(item.startDate);
              const end = new Date(item.endDate);
              const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

              const isPending = item.status === "PENDING";

              return (
                <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
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
                        <div className="text-[11px] text-gray-500">ITS: {item.its || "—"}</div>
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
                      {item.type === "PERSONAL" && <User className="w-3 h-3" />}
                      <span>{item.type.replace(/_/g, " ")}</span>
                    </span>
                  </td>

                  {/* Date Range */}
                  <td className="py-3.5 px-3">
                    <div className="font-semibold text-gray-900">
                      {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {item.startDate !== item.endDate && ` – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {diffDays} {diffDays === 1 ? "day" : "days"}
                    </div>
                  </td>

                  {/* Reason & Attachment */}
                  <td className="py-3.5 px-4">
                    <p className="text-gray-700 line-clamp-2 leading-relaxed">{item.reason}</p>
                    {item.attachmentUrl && (
                      <a
                        href={item.attachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline mt-1"
                      >
                        <Paperclip className="w-3 h-3" />
                        <span>Medical Document</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
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
                      <span>{item.status}</span>
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right">
                    {isPending ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setActiveAction({
                              id: item.id,
                              type: "approve",
                              studentName: item.studentName || "Student",
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-xs transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve</span>
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
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-400 font-medium">
                        {item.reviewedBy ? `By ${item.reviewedBy}` : "Reviewed"}
                      </span>
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
              {activeAction.type === "approve" ? "Approve Leave Request" : "Reject Leave Request"}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              {activeAction.type === "approve"
                ? `Confirm leave approval for ${activeAction.studentName}. Attendance records will be synchronized automatically.`
                : `Specify why the leave for ${activeAction.studentName} is being rejected.`}
            </p>

            <div className="mb-4">
              <label htmlFor="action-notes" className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Reviewer Note (Optional for approval, recommended for rejection)
              </label>
              <textarea
                id="action-notes"
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Add optional notes for the student..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 resize-none"
              />
            </div>

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
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {processing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{activeAction.type === "approve" ? "Confirm Approval" : "Confirm Rejection"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
