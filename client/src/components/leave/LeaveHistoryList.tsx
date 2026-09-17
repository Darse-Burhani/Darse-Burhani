"use client";

import React, { useState } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Ban,
  Stethoscope,
  User,
  HeartPulse,
  FileText,
  Paperclip,
  ExternalLink,
  Trash2,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { LeaveRequestItem, cancelTalabatLeave } from "@/lib/api";

interface LeaveHistoryListProps {
  leaves: LeaveRequestItem[];
  onRefresh: () => void;
  onRequestClick: () => void;
}

const statusBadgeConfig: Record<
  string,
  { label: string; bg: string; text: string; border: string; icon: React.ElementType }
> = {
  PENDING: {
    label: "Under Review",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Declined",
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    icon: XCircle,
  },
  CANCELLED: {
    label: "Cancelled",
    bg: "bg-gray-100",
    text: "text-gray-600",
    border: "border-gray-200",
    icon: Ban,
  },
};

const typeIconMap: Record<string, React.ElementType> = {
  MEDICAL: Stethoscope,
  PERSONAL: User,
  FAMILY_EMERGENCY: HeartPulse,
  OTHER: FileText,
};

export function LeaveHistoryList({ leaves, onRefresh, onRequestClick }: LeaveHistoryListProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;

    setCancellingId(id);
    try {
      await cancelTalabatLeave(id);
      onRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to cancel request");
    } finally {
      setCancellingId(null);
    }
  };

  if (leaves.length === 0) {
    return (
      <div className="text-center py-12 px-4 rounded-2xl bg-white border border-gray-100 shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto mb-3">
          <Calendar className="w-6 h-6" />
        </div>
        <h3 className="font-bold text-sm text-gray-900 mb-1">No Leave Records</h3>
        <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
          You haven't submitted any leave requests yet. Need time off for medical or personal reasons?
        </p>
        <button
          type="button"
          onClick={onRequestClick}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-xs font-bold text-white shadow-xs transition-colors"
        >
          <span>Submit Request</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {leaves.map((leave) => {
        const statusConfig = statusBadgeConfig[leave.status] || statusBadgeConfig.PENDING;
        const StatusIcon = statusConfig.icon;
        const TypeIcon = typeIconMap[leave.type] || FileText;

        const start = new Date(leave.startDate);
        const end = new Date(leave.endDate);
        const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        const dateRangeStr =
          leave.startDate === leave.endDate
            ? start.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            : `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

        return (
          <div
            key={leave.id}
            className="p-4 sm:p-5 rounded-2xl bg-white border border-gray-100 shadow-xs hover:border-gray-200 transition-all"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gray-50 text-gray-700 flex items-center justify-center shrink-0 border border-gray-100">
                  <TypeIcon className="w-4 h-4 text-emerald-800" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-gray-900 capitalize">
                      {leave.type.replace(/_/g, " ").toLowerCase()}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      {diffDays} {diffDays === 1 ? "day" : "days"}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>{dateRangeStr}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-center">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}
                >
                  <StatusIcon className="w-3 h-3" />
                  <span>{statusConfig.label}</span>
                </span>

                {leave.status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => handleCancel(leave.id)}
                    disabled={cancellingId === leave.id}
                    title="Cancel Request"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    {cancellingId === leave.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Reason Body */}
            <div className="pt-3">
              <p className="text-xs text-gray-700 leading-relaxed bg-gray-50/70 p-2.5 rounded-xl border border-gray-100/80">
                {leave.reason}
              </p>

              {/* Reviewer note if present */}
              {leave.reviewerNotes && (
                <div className="mt-2.5 flex items-start gap-1.5 text-xs text-gray-600 bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                  <span className="font-bold text-amber-800 shrink-0">Reviewer Note:</span>
                  <span>{leave.reviewerNotes}</span>
                </div>
              )}

              {/* Attachment link if present */}
              {leave.attachmentUrl && (
                <div className="mt-2.5 flex items-center justify-between">
                  <a
                    href={leave.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>View Medical Document</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  <span className="text-[10px] text-gray-400 font-medium">
                    Requested on {new Date(leave.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
