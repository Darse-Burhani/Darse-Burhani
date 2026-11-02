"use client";

import { useState } from "react";
import {
  X,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Stethoscope,
  HeartPulse,
  Paperclip,
  ExternalLink,
  Loader2,
  Sparkles,
  Palmtree,
  CheckSquare,
  Square,
  MessageCircle,
  Mail,
  Send,
  Phone,
  BellRing,
  Calendar,
  AlertCircle,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import {
  notifyParentAdminLeave,
  type LeaveRequestItem,
  type PortalLeaveMember,
} from "@/lib/api";

function computeEndDate(startDateStr: string, numDays: number): string {
  if (!startDateStr || numDays < 1) return startDateStr;
  const parts = startDateStr.split("-").map(Number);
  if (parts.length !== 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    return startDateStr;
  }
  const [y, m, d] = parts;
  const targetUtc = new Date(Date.UTC(y, m - 1, d + numDays - 1));
  const year = targetUtc.getUTCFullYear();
  const month = String(targetUtc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(targetUtc.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeDaysBetween(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 1;
  const sParts = startDateStr.split("-").map(Number);
  const eParts = endDateStr.split("-").map(Number);
  if (sParts.length !== 3 || eParts.length !== 3) return 1;
  const sUtc = Date.UTC(sParts[0], sParts[1] - 1, sParts[2]);
  const eUtc = Date.UTC(eParts[0], eParts[1] - 1, eParts[2]);
  if (eUtc < sUtc) return 1;
  return Math.round((eUtc - sUtc) / 86400000) + 1;
}

function formatDateString(val: string | Date | null | undefined): string {
  if (!val) return "";
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    return val.split("T")[0];
  }
  return new Date(val).toISOString().split("T")[0];
}

interface PendingLeaveTableProps {
  requests: LeaveRequestItem[];
  isAdmin?: boolean;
  onApprove: (
    id: string,
    notes?: string,
    approvedDays?: number | null,
    startDate?: string | null,
    endDate?: string | null
  ) => Promise<any>;
  onReject: (id: string, notes?: string) => Promise<any>;
  onHold?: (
    id: string,
    notes?: string,
    startDate?: string | null,
    endDate?: string | null
  ) => Promise<any>;
  onBatchApprove?: (ids: string[], notes?: string) => Promise<any>;
  onDelete?: (id: string) => Promise<void>;
  assignees?: PortalLeaveMember[];
  onAssign?: (id: string, memberId: string | null) => Promise<void>;
  onUpdateDates?: (
    id: string,
    startDate: string,
    endDate: string,
    notes?: string
  ) => Promise<any>;
  loading?: boolean;
}

export function PendingLeaveTable({
  requests,
  isAdmin = false,
  onApprove,
  onReject,
  onHold,
  onBatchApprove,
  onDelete,
  assignees,
  onAssign,
  onUpdateDates,
  loading = false,
}: PendingLeaveTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionSuccessNotice, setActionSuccessNotice] = useState<{
    type: "approve" | "reject" | "hold";
    studentName: string;
    status: string;
    parentPhone?: string | null;
    parentEmail?: string | null;
    whatsAppUrl?: string | null;
  } | null>(null);
  const [activeAction, setActiveAction] = useState<{
    id: string;
    type: "approve" | "reject" | "hold";
    studentName: string;
    parentName?: string | null;
    parentPhone?: string | null;
    parentEmail?: string | null;
    requestedDays?: number;
    startDate?: string;
    endDate?: string;
    isSettlingHold?: boolean;
  } | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [grantDays, setGrantDays] = useState<number>(1);
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);

  // Dedicated standalone Edit Dates modal state
  const [editDatesTarget, setEditDatesTarget] = useState<LeaveRequestItem | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editDays, setEditDays] = useState(1);
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const handleOpenEditDates = (item: LeaveRequestItem) => {
    const s = formatDateString(item.grantedStartDate || item.startDate);
    const e = formatDateString(item.grantedEndDate || item.endDate);
    const d = item.approvedDays ?? computeDaysBetween(s, e);
    setEditDatesTarget(item);
    setEditStartDate(s);
    setEditEndDate(e);
    setEditDays(d);
    setEditNotes(item.reviewerNotes || "");
  };

  const handleSaveEditDates = async () => {
    if (!editDatesTarget || !onUpdateDates) return;
    if (!editStartDate || !editEndDate) {
      alert("Both start date and end date are required");
      return;
    }
    setEditSaving(true);
    try {
      await onUpdateDates(
        editDatesTarget.id,
        editStartDate,
        editEndDate,
        editNotes.trim() || undefined
      );
      setEditDatesTarget(null);
    } catch (err: any) {
      alert(err.message || "Failed to update leave dates");
    } finally {
      setEditSaving(false);
    }
  };

  // Dedicated parent notification modal state
  const [notifyTarget, setNotifyTarget] = useState<LeaveRequestItem | null>(null);
  const [notifyChannel, setNotifyChannel] = useState<"EMAIL" | "WHATSAPP" | "BOTH">("BOTH");
  const [customNotifyMsg, setCustomNotifyMsg] = useState("");
  const [notifySending, setNotifySending] = useState(false);
  const [notifySuccessMsg, setNotifySuccessMsg] = useState<string | null>(null);

  const handleSendParentNotification = async () => {
    if (!notifyTarget) return;
    setNotifySending(true);
    setNotifySuccessMsg(null);
    try {
      const res = await notifyParentAdminLeave(
        notifyTarget.id,
        notifyChannel,
        customNotifyMsg.trim() || undefined
      );
      if (res.success) {
        setNotifySuccessMsg(res.message || "Notification sent to parent successfully!");
        setTimeout(() => {
          setNotifyTarget(null);
          setCustomNotifyMsg("");
          setNotifySuccessMsg(null);
        }, 2200);
      } else {
        alert("Failed to send parent notification");
      }
    } catch (err: any) {
      alert(err.message || "Failed to notify parent");
    } finally {
      setNotifySending(false);
    }
  };

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
      let result: any = null;
      if (activeAction.type === "approve") {
        result = await onApprove(
          activeAction.id,
          actionNotes.trim() || undefined,
          grantDays,
          customStartDate || undefined,
          customEndDate || undefined
        );
      } else if (activeAction.type === "hold") {
        if (!onHold) throw new Error("Hold action is not supported in this view");
        result = await onHold(
          activeAction.id,
          actionNotes.trim() || undefined,
          customStartDate || undefined,
          customEndDate || undefined
        );
      } else {
        result = await onReject(activeAction.id, actionNotes.trim() || "Declined");
      }

      const parentPhone = result?.parentPhone || activeAction.parentPhone;
      const parentEmail = result?.parentEmail || activeAction.parentEmail;
      const whatsAppUrl = result?.whatsAppUrl;

      setActionSuccessNotice({
        type: activeAction.type,
        studentName: activeAction.studentName,
        status: activeAction.type === "approve" ? "Approved" : activeAction.type === "hold" ? "Placed On Hold" : "Rejected",
        parentPhone,
        parentEmail,
        whatsAppUrl,
      });

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

      {/* ── MOBILE CARD PRESENTATION (Below md) ── */}
      <div className="block md:hidden space-y-3.5 mb-6">
        {requests.map((item) => {
          const start = new Date(item.startDate);
          const end = new Date(item.endDate);
          const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const isPending = item.status === "PENDING";
          const isHold = item.status === "HOLD";
          const isSelected = selectedIds.has(item.id);

          return (
            <div
              key={`mob-${item.id}`}
              className={`p-1 rounded-[1.75rem] transition-all duration-300 ${
                isSelected
                  ? "bg-amber-400/30 ring-2 ring-amber-400"
                  : isHold
                  ? "bg-amber-100/60 ring-1 ring-amber-300/80 shadow-xs"
                  : "bg-black/[0.03] ring-1 ring-black/[0.06] shadow-xs"
              }`}
            >
              <div className="depth-3d-card rounded-[calc(1.75rem-0.25rem)] p-4 space-y-3">
                {/* Top Row: Avatar, Student Info, Checkbox & Status */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {onBatchApprove && isPending && (
                      <button
                        type="button"
                        onClick={() => toggleSelectOne(item.id)}
                        className="text-slate-400 hover:text-amber-600 transition-colors shrink-0"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-5 h-5 text-amber-600" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    )}
                    <Avatar className="w-10 h-10 rounded-full ring-2 ring-amber-400/40 shrink-0">
                      <AvatarImage src={item.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs font-bold bg-amber-50 text-amber-950 border border-amber-300">
                        {getInitials(item.studentName || "ST")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-display font-bold text-sm text-slate-900 leading-tight truncate">
                        {item.studentName || "Student"}
                      </h4>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                        <span className="font-mono font-medium">ITS: {item.its || "—"}</span>
                        <span>•</span>
                        <span className="truncate">{item.className || `Gr ${item.grade}-${item.section}`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-tight shrink-0 shadow-2xs ${
                      item.status === "APPROVED"
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-300"
                        : item.status === "REJECTED"
                        ? "bg-rose-50 text-rose-800 border border-rose-300"
                        : item.status === "HOLD"
                        ? "bg-amber-100 text-amber-950 border border-amber-300 ring-1 ring-amber-400/40"
                        : "bg-amber-50 text-amber-900 border border-amber-300"
                    }`}
                  >
                    {item.status === "APPROVED" && <CheckCircle2 className="w-3 h-3 text-emerald-600" strokeWidth={1.75} />}
                    {item.status === "REJECTED" && <XCircle className="w-3 h-3 text-rose-600" strokeWidth={1.75} />}
                    {item.status === "HOLD" && <PauseCircle className="w-3 h-3 text-amber-700" strokeWidth={1.75} />}
                    {item.status === "PENDING" && <Clock className="w-3 h-3 text-amber-600" strokeWidth={1.75} />}
                    <span>{item.status === "HOLD" ? "ON HOLD" : item.status}</span>
                  </span>
                </div>

                {/* Details Box */}
                <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 text-xs">
                  <div>
                    <span className="text-[9.5px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">Type</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 truncate">
                      {item.type === "MEDICAL" && <Stethoscope className="w-3 h-3 text-rose-600 shrink-0" strokeWidth={1.75} />}
                      {item.type === "FAMILY_EMERGENCY" && <HeartPulse className="w-3 h-3 text-amber-600 shrink-0" strokeWidth={1.75} />}
                      {item.type === "PERSONAL" && <Palmtree className="w-3 h-3 text-emerald-600 shrink-0" strokeWidth={1.75} />}
                      <span className="truncate">{item.type === "PERSONAL" ? "Holiday / Personal" : item.type.replace(/_/g, " ")}</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-[9.5px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">Duration</span>
                    <span className="font-bold text-slate-900 block leading-tight truncate">
                      {start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {item.startDate !== item.endDate && ` – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </span>
                    <span className="text-[10px] text-amber-800 font-semibold">{diffDays} {diffDays === 1 ? "day" : "days"} requested</span>
                  </div>
                </div>

                {/* Parent Contact Info Box */}
                {(item.parentPhone || item.parentEmail || item.parentName) && (
                  <div className="p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-1 text-[11px]">
                      <span className="text-[10px] uppercase font-bold text-amber-900 shrink-0">Parent Contact:</span>
                      <span className="font-semibold text-slate-800 truncate">{item.parentName || "Registered Parent"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                      {item.parentPhone ? (
                        <div className="flex items-center gap-1.5">
                          <a
                            href={`tel:${item.parentPhone}`}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-950 font-mono hover:underline"
                            title="Call parent"
                          >
                            <Phone className="w-3 h-3 text-amber-700" />
                            <span>{item.parentPhone}</span>
                          </a>
                          {item.whatsAppUrl && (
                            <a
                              href={item.whatsAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow-2xs"
                              title="Send 1-way WhatsApp Notice"
                            >
                              <MessageCircle className="w-2.5 h-2.5" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10.5px] text-slate-400 italic">No phone linked</span>
                      )}

                      {item.parentEmail && (
                        <a
                          href={`mailto:${item.parentEmail}`}
                          className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-800 hover:underline max-w-[170px] truncate"
                          title={`Email ${item.parentEmail}`}
                        >
                          <Mail className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span className="truncate">{item.parentEmail}</span>
                        </a>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="pt-1.5 border-t border-amber-200/60 flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">Parent notices active</span>
                        <button
                          type="button"
                          onClick={() => {
                            setNotifyTarget(item);
                            setNotifyChannel("BOTH");
                            setCustomNotifyMsg("");
                            setNotifySuccessMsg(null);
                          }}
                          className="inline-flex items-center gap-1 text-[10.5px] font-bold text-amber-900 hover:text-amber-950 hover:underline cursor-pointer"
                        >
                          <BellRing className="w-3 h-3 text-amber-700" />
                          <span>Dispatch Notice</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Reason Text */}
                <div className="text-xs text-slate-700 leading-relaxed">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">Reason</span>
                  <p className="bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/60 text-slate-800 text-[11.5px]">{item.reason}</p>
                </div>

                {/* Attachment Pill */}
                {item.attachmentUrl && (
                  <a
                    href={item.attachmentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 text-[11px] font-bold text-slate-800 hover:bg-slate-200 transition-colors w-full justify-center border border-slate-200/60"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-amber-600" strokeWidth={1.75} />
                    <span>View Supporting Document</span>
                    <ExternalLink className="w-3 h-3 text-slate-400 ml-auto" strokeWidth={1.75} />
                  </a>
                )}

                {/* Hold Notice Callout */}
                {item.status === "HOLD" && item.reviewerNotes && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs">
                    <div className="flex items-center gap-1 font-bold text-[10px] uppercase tracking-wider mb-1 text-amber-900">
                      <PauseCircle className="w-3.5 h-3.5 text-amber-600" strokeWidth={1.75} />
                      <span>Current Hold Remarks (Sent to Parent):</span>
                    </div>
                    <p className="leading-relaxed font-medium">{item.reviewerNotes}</p>
                  </div>
                )}

                {/* Mobile Action Cluster */}
                {isPending ? (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {assignees && onAssign && (
                      <select
                        value={item.assignedTo?.id || ""}
                        onChange={(e) => handleAssign(item.id, e.target.value || null)}
                        disabled={assigningId === item.id}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                      >
                        <option value="">Assign to faculty…</option>
                        {assignees.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setGrantDays(diffDays);
                          setActionNotes("");
                          setCustomStartDate(item.startDate ? new Date(item.startDate).toISOString().split("T")[0] : "");
                          setCustomEndDate(item.endDate ? new Date(item.endDate).toISOString().split("T")[0] : "");
                          setActiveAction({
                            id: item.id,
                            type: "approve",
                            studentName: item.studentName || "Student",
                            parentName: item.parentName,
                            parentPhone: item.parentPhone,
                            parentEmail: item.parentEmail,
                            requestedDays: diffDays,
                            startDate: item.startDate,
                            endDate: item.endDate,
                          });
                        }}
                        className="depth-3d-btn-emerald flex items-center justify-center gap-1 py-3 px-2 rounded-xl text-white font-bold text-xs cursor-pointer"
                      >
                        <Palmtree className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                        <span>Approve</span>
                      </button>

                      {onHold && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionNotes(item.reviewerNotes || "");
                            setCustomStartDate(item.startDate ? new Date(item.startDate).toISOString().split("T")[0] : "");
                            setCustomEndDate(item.endDate ? new Date(item.endDate).toISOString().split("T")[0] : "");
                            setActiveAction({
                              id: item.id,
                              type: "hold",
                              studentName: item.studentName || "Student",
                              parentName: item.parentName,
                              parentPhone: item.parentPhone,
                              parentEmail: item.parentEmail,
                              requestedDays: diffDays,
                              startDate: item.startDate,
                              endDate: item.endDate,
                            });
                          }}
                          className="depth-3d-btn-gold flex items-center justify-center gap-1 py-3 px-2 rounded-xl text-stone-950 font-bold text-xs cursor-pointer"
                        >
                          <PauseCircle className="w-3.5 h-3.5 text-stone-950 shrink-0" strokeWidth={2} />
                          <span>Hold</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActionNotes("");
                          setActiveAction({
                            id: item.id,
                            type: "reject",
                            studentName: item.studentName || "Student",
                            parentName: item.parentName,
                            parentPhone: item.parentPhone,
                            parentEmail: item.parentEmail,
                          });
                        }}
                        className="depth-3d-btn-dark flex items-center justify-center gap-1 py-3 px-2 rounded-xl text-white font-bold text-xs cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                        <span>Reject</span>
                      </button>
                    </div>

                    {isAdmin && onUpdateDates && (
                      <div className="flex items-center justify-end pt-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditDates(item)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 hover:text-amber-950 cursor-pointer"
                        >
                          <Calendar className="w-3.5 h-3.5 text-amber-700" />
                          <span>Edit Dates Directly</span>
                        </button>
                      </div>
                    )}
                  </div>
                ) : isHold ? (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setGrantDays(diffDays);
                          setActionNotes(item.reviewerNotes ? `Resumed after hold: ${item.reviewerNotes}` : "");
                          setCustomStartDate(item.startDate ? new Date(item.startDate).toISOString().split("T")[0] : "");
                          setCustomEndDate(item.endDate ? new Date(item.endDate).toISOString().split("T")[0] : "");
                          setActiveAction({
                            id: item.id,
                            type: "approve",
                            studentName: item.studentName || "Student",
                            parentName: item.parentName,
                            parentPhone: item.parentPhone,
                            parentEmail: item.parentEmail,
                            requestedDays: diffDays,
                            startDate: item.startDate,
                            endDate: item.endDate,
                            isSettlingHold: true,
                          });
                        }}
                        className="depth-3d-btn-emerald flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl text-white font-bold text-xs cursor-pointer"
                      >
                        <Palmtree className="w-3.5 h-3.5" strokeWidth={1.75} />
                        <span>Resume & Approve</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActionNotes(item.reviewerNotes ? `Declined after review: ${item.reviewerNotes}` : "");
                          setActiveAction({
                            id: item.id,
                            type: "reject",
                            studentName: item.studentName || "Student",
                            parentName: item.parentName,
                            parentPhone: item.parentPhone,
                            parentEmail: item.parentEmail,
                            isSettlingHold: true,
                          });
                        }}
                        className="depth-3d-btn-dark flex items-center justify-center gap-1.5 py-3 px-3 rounded-xl text-white font-bold text-xs cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" strokeWidth={2} />
                        <span>Reject</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {onHold && (
                        <button
                          type="button"
                          onClick={() => {
                            setActionNotes(item.reviewerNotes || "");
                            setActiveAction({
                              id: item.id,
                              type: "hold",
                              studentName: item.studentName || "Student",
                              parentName: item.parentName,
                              parentPhone: item.parentPhone,
                              parentEmail: item.parentEmail,
                              requestedDays: diffDays,
                              startDate: item.startDate,
                            });
                          }}
                          className="flex-1 py-2 px-3 rounded-xl bg-white text-amber-950 border border-amber-300 font-bold text-xs text-center cursor-pointer hover:bg-amber-50"
                        >
                          Edit Remarks
                        </button>
                      )}
                      {isAdmin && onUpdateDates && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditDates(item)}
                          className="flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-white text-amber-900 border border-amber-300 font-bold text-xs text-center cursor-pointer hover:bg-amber-50"
                        >
                          <Calendar className="w-3.5 h-3.5 text-amber-700" />
                          <span>Edit Dates</span>
                        </button>
                      )}
                      {item.whatsAppUrl && (
                        <a
                          href={item.whatsAppUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {item.reviewedBy ? `${item.status === "APPROVED" ? "Approved" : "Reviewed"} by ${item.reviewedBy}` : "Processed"}
                    </span>
                    <div className="flex items-center gap-2">
                      {isAdmin && onUpdateDates && (
                        <button
                          type="button"
                          onClick={() => handleOpenEditDates(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] cursor-pointer"
                          title="Edit leave dates and re-sync attendance"
                        >
                          <Calendar className="w-3 h-3 text-amber-600" />
                          <span>Edit Dates</span>
                        </button>
                      )}
                      {item.whatsAppUrl && (
                        <a
                          href={item.whatsAppUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-2xs"
                        >
                          <MessageCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── DESKTOP TABULAR PRESENTATION (md and above) ── */}
      <div className="hidden md:block overflow-x-auto touch-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] rounded-3xl bg-white border border-slate-200/80 shadow-xs">
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
              const isHold = item.status === "HOLD";
              const isSelected = selectedIds.has(item.id);

              return (
                <tr
                  key={item.id}
                  className={`transition-colors ${
                    isSelected ? "bg-emerald-50/70" : isHold ? "bg-amber-50/30 hover:bg-amber-50/60" : "hover:bg-gray-50/60"
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
                        {(item.parentPhone || item.parentEmail) && (
                          <div className="text-[10px] text-emerald-800 font-semibold mt-0.5 space-y-0.5">
                            {item.parentPhone && (
                              <div className="flex items-center gap-1">
                                <span className="text-gray-400 font-normal">Parent:</span>
                                <span>{item.parentName ? `${item.parentName} (${item.parentPhone})` : item.parentPhone}</span>
                              </div>
                            )}
                            {item.parentEmail && (
                              <div className="flex items-center gap-1 text-[9.5px] text-slate-500 font-normal">
                                <Mail className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                                <span className="truncate max-w-[150px]">{item.parentEmail}</span>
                              </div>
                            )}
                          </div>
                        )}
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
                            : item.status === "HOLD"
                            ? "bg-amber-100/90 text-amber-900 border border-amber-300 shadow-2xs"
                            : item.status === "PENDING"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : "bg-gray-100 text-gray-600 border border-gray-200"
                        }`}
                      >
                        {item.status === "APPROVED" && <CheckCircle2 className="w-3 h-3" />}
                        {item.status === "REJECTED" && <XCircle className="w-3 h-3" />}
                        {item.status === "HOLD" && <PauseCircle className="w-3 h-3 text-amber-700" />}
                        {item.status === "PENDING" && <Clock className="w-3 h-3" />}
                        <span>
                          {item.status === "APPROVED"
                            ? item.type === "MEDICAL"
                              ? "MEDICAL EXCUSED"
                              : "ON HOLIDAY / LEAVE"
                            : item.status === "HOLD"
                            ? "ON HOLD"
                            : item.status}
                        </span>
                      </span>
                      {item.status === "HOLD" && item.reviewerNotes && (
                        <div className="text-[10.5px] text-amber-900 bg-amber-50/80 border border-amber-200/90 rounded-md p-1.5 line-clamp-2 max-w-[210px]" title={item.reviewerNotes}>
                          <span className="font-bold block text-[9.5px] uppercase tracking-wider text-amber-900">Hold Reason:</span>
                          {item.reviewerNotes}
                        </div>
                      )}
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
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* 1. APPROVE BUTTON */}
                          <button
                            type="button"
                            onClick={() => {
                              setGrantDays(diffDays);
                              setActionNotes("");
                              setCustomStartDate(item.startDate ? new Date(item.startDate).toISOString().split("T")[0] : "");
                              setCustomEndDate(item.endDate ? new Date(item.endDate).toISOString().split("T")[0] : "");
                              setActiveAction({
                                id: item.id,
                                type: "approve",
                                studentName: item.studentName || "Student",
                                parentName: item.parentName,
                                parentPhone: item.parentPhone,
                                parentEmail: item.parentEmail,
                                requestedDays: diffDays,
                                startDate: item.startDate,
                                endDate: item.endDate,
                              });
                            }}
                            className="depth-3d-btn-emerald px-3 py-1.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                            title="Approve leave and sync attendance"
                          >
                            <Palmtree className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Approve</span>
                          </button>

                          {/* 2. HOLD BUTTON */}
                          {onHold && (
                            <button
                              type="button"
                              onClick={() => {
                                setActionNotes(item.reviewerNotes || "");
                                setCustomStartDate(item.startDate ? new Date(item.startDate).toISOString().split("T")[0] : "");
                                setCustomEndDate(item.endDate ? new Date(item.endDate).toISOString().split("T")[0] : "");
                                setActiveAction({
                                  id: item.id,
                                  type: "hold",
                                  studentName: item.studentName || "Student",
                                  parentName: item.parentName,
                                  parentPhone: item.parentPhone,
                                  parentEmail: item.parentEmail,
                                  requestedDays: diffDays,
                                  startDate: item.startDate,
                                  endDate: item.endDate,
                                });
                              }}
                              className="depth-3d-btn-gold px-3 py-1.5 rounded-xl text-stone-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                              title="Put on hold with administrative remarks sent to parent"
                            >
                              <PauseCircle className="w-3.5 h-3.5 text-stone-950" strokeWidth={2} />
                              <span>Hold</span>
                            </button>
                          )}

                          {/* 3. REJECT BUTTON */}
                          <button
                            type="button"
                            onClick={() => {
                              setActionNotes("");
                              setActiveAction({
                                id: item.id,
                                type: "reject",
                                studentName: item.studentName || "Student",
                                parentName: item.parentName,
                                parentPhone: item.parentPhone,
                                parentEmail: item.parentEmail,
                              });
                            }}
                            className="depth-3d-btn-dark px-3 py-1.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                            title="Reject request"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={2} />
                            <span>Reject</span>
                          </button>

                          {/* 4. EDIT DATES BUTTON */}
                          {isAdmin && onUpdateDates && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditDates(item)}
                              className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1 cursor-pointer"
                              title="Edit leave dates directly"
                            >
                              <Calendar className="w-3.5 h-3.5 text-amber-600" />
                              <span>Edit Dates</span>
                            </button>
                          )}
                        </div>
                        <div className="flex items-center justify-end gap-2.5 mt-1">
                          {item.whatsAppUrl && (
                            <a
                              href={item.whatsAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                              title="Send 1-way WhatsApp Notice to Parent"
                            >
                              <MessageCircle className="w-3 h-3 text-emerald-600" />
                              <span>WhatsApp Notice</span>
                            </a>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setNotifyTarget(item);
                                setNotifyChannel("BOTH");
                                setCustomNotifyMsg("");
                                setNotifySuccessMsg(null);
                              }}
                              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                              title="Send or resend parent notification via Email / WhatsApp"
                            >
                              <BellRing className="w-3 h-3 text-amber-600" />
                              <span>Notify Parent</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : isHold ? (
                      <div className="flex flex-col items-end gap-1.5 text-right">
                        <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                          <PauseCircle className="w-3 h-3 text-amber-600" />
                          <span>On Hold — Resume / Settle:</span>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() => {
                              setGrantDays(diffDays);
                              setActionNotes(item.reviewerNotes ? `Resumed after hold: ${item.reviewerNotes}` : "");
                              setCustomStartDate(item.startDate ? new Date(item.startDate).toISOString().split("T")[0] : "");
                              setCustomEndDate(item.endDate ? new Date(item.endDate).toISOString().split("T")[0] : "");
                              setActiveAction({
                                id: item.id,
                                type: "approve",
                                studentName: item.studentName || "Student",
                                parentName: item.parentName,
                                parentPhone: item.parentPhone,
                                parentEmail: item.parentEmail,
                                requestedDays: diffDays,
                                startDate: item.startDate,
                                endDate: item.endDate,
                                isSettlingHold: true,
                              });
                            }}
                            className="depth-3d-btn-emerald px-3 py-1.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                            title="Resume and approve leave with optional date modifications"
                          >
                            <Palmtree className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Resume &amp; Approve</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setActionNotes(item.reviewerNotes ? `Declined after review: ${item.reviewerNotes}` : "");
                              setActiveAction({
                                id: item.id,
                                type: "reject",
                                studentName: item.studentName || "Student",
                                parentName: item.parentName,
                                parentPhone: item.parentPhone,
                                parentEmail: item.parentEmail,
                                isSettlingHold: true,
                              });
                            }}
                            className="depth-3d-btn-dark px-3 py-1.5 rounded-xl text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                            title="Settle hold and reject leave"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={2} />
                            <span>Reject</span>
                          </button>

                          {onHold && (
                            <button
                              type="button"
                              onClick={() => {
                                setActionNotes(item.reviewerNotes || "");
                                setCustomStartDate(item.startDate ? new Date(item.startDate).toISOString().split("T")[0] : "");
                                setCustomEndDate(item.endDate ? new Date(item.endDate).toISOString().split("T")[0] : "");
                                setActiveAction({
                                  id: item.id,
                                  type: "hold",
                                  studentName: item.studentName || "Student",
                                  parentName: item.parentName,
                                  parentPhone: item.parentPhone,
                                  parentEmail: item.parentEmail,
                                  requestedDays: diffDays,
                                  startDate: item.startDate,
                                  endDate: item.endDate,
                                });
                              }}
                              className="px-2 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-300"
                              title="Update hold remarks"
                            >
                              Edit Remarks
                            </button>
                          )}
                          {isAdmin && onUpdateDates && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditDates(item)}
                              className="px-2 py-1.5 rounded-lg bg-white hover:bg-amber-50 text-amber-900 text-[11px] font-bold border border-amber-300 flex items-center gap-1 cursor-pointer"
                              title="Edit leave dates directly"
                            >
                              <Calendar className="w-3 h-3 text-amber-600" />
                              <span>Edit Dates</span>
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-2.5 mt-0.5">
                          {item.whatsAppUrl && (
                            <a
                              href={item.whatsAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                              title="Shoot official Hold WhatsApp notice to parent"
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                              <span>WhatsApp Notice</span>
                            </a>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setNotifyTarget(item);
                                setNotifyChannel("BOTH");
                                setCustomNotifyMsg("");
                                setNotifySuccessMsg(null);
                              }}
                              className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
                            >
                              <BellRing className="w-3 h-3 text-amber-600" />
                              <span>Notify</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1.5 text-right">
                        <div className="text-[11px] text-gray-500 font-medium">
                          {item.reviewedBy ? `${item.status === "APPROVED" ? "Approved" : "Reviewed"} by ${item.reviewedBy}` : "Processed"}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isAdmin && onUpdateDates && (
                            <button
                              type="button"
                              onClick={() => handleOpenEditDates(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] cursor-pointer"
                              title="Modify dates and re-synchronize attendance registry & Google Sheets"
                            >
                              <Calendar className="w-3 h-3 text-amber-600" />
                              <span>Edit Dates</span>
                            </button>
                          )}
                          {item.whatsAppUrl && (
                            <a
                              href={item.whatsAppUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-[11px] shadow-xs transition-all"
                              title={`Shoot official 1-way WhatsApp notice to parent (${item.parentPhone || ""})`}
                            >
                              <MessageCircle className="w-3.5 h-3.5 text-white" />
                              <span>WhatsApp Notice</span>
                            </a>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setNotifyTarget(item);
                                setNotifyChannel("BOTH");
                                setCustomNotifyMsg("");
                                setNotifySuccessMsg(null);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] cursor-pointer"
                              title="Dispatch parent notice via Email and/or WhatsApp"
                            >
                              <BellRing className="w-3 h-3 text-amber-600" />
                              <span>Notify</span>
                            </button>
                          )}
                        </div>
                        {isAdmin && onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(item.id)}
                            className="text-[10px] text-rose-600 hover:underline inline-block"
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
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onClick={() => setActiveAction(null)} />
          <div className="relative z-10 w-full max-w-[calc(100vw-1.25rem)] sm:max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 depth-3d-card border border-amber-200/60 animate-slide-up">
            {/* Top gold hairline */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80" />
            <div className="w-10 h-1 rounded-full bg-slate-200 mx-auto mb-4 sm:hidden" />
            <h3 className="font-display font-bold text-base text-slate-900 mb-1 leading-tight">
              {activeAction.type === "approve"
                ? activeAction.isSettlingHold
                  ? "Settle & Approve Leave Application"
                  : "Approve Leave Application"
                : activeAction.type === "hold"
                ? "Place Leave Application On Hold"
                : activeAction.isSettlingHold
                ? "Settle & Reject Leave Request"
                : "Reject Leave Request"}
            </h3>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              {activeAction.type === "approve"
                ? `Approve ${activeAction.studentName}'s leave. Choose how many days to grant — attendance and the Google Sheet will reflect only the granted dates.`
                : activeAction.type === "hold"
                ? `Place ${activeAction.studentName}'s leave application on hold pending inquiry or clarification. Remarks will be dispatched to the parent via 1-way WhatsApp & in-app alert.`
                : `Specify why the leave for ${activeAction.studentName} is being rejected.`}
            </p>

            <div className="mb-4">
              <label htmlFor="action-notes" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reviewer Remarks / School Notes
                <span className="normal-case font-normal text-slate-500 ml-1.5">(Dispatched via 1-way WhatsApp)</span>
              </label>
              <textarea
                id="action-notes"
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  activeAction.type === "approve"
                    ? "e.g., Leave granted as requested / Reduced due to exam schedule..."
                    : activeAction.type === "hold"
                    ? "e.g., Medical certificate required / Clarification needed on travel dates / Under review with Masool..."
                    : "e.g., Leave application declined due to mandatory academic schedule..."
                }
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-none"
              />
            </div>

            {(activeAction.type === "approve" || activeAction.type === "hold") && (() => {
              const initialStart = activeAction.startDate ? new Date(activeAction.startDate).toISOString().split("T")[0] : "";
              const initialEnd = activeAction.endDate ? new Date(activeAction.endDate).toISOString().split("T")[0] : "";
              const datesChanged = Boolean((customStartDate && customStartDate !== initialStart) || (customEndDate && customEndDate !== initialEnd));

              return (
                <div className="mb-4 p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-bold text-amber-950 uppercase tracking-wider">
                      {activeAction.type === "hold"
                        ? "Leave Dates (Under Review)"
                        : activeAction.isSettlingHold
                        ? "Resume & Configure Leave Dates"
                        : "Granted Leave Dates & Duration"}
                    </label>
                    {datesChanged ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white shadow-xs">
                        Dates Changed
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-900">
                        Requested: {activeAction.requestedDays ?? 1} {(activeAction.requestedDays ?? 1) === 1 ? "day" : "days"}
                      </span>
                    )}
                  </div>

                  {/* Editable Dates: Start Date & End Date */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomStartDate(val);
                          if (val && customEndDate) {
                            const s = new Date(val).getTime();
                            const en = new Date(customEndDate).getTime();
                            if (en >= s) {
                              const d = Math.round((en - s) / 86400000) + 1;
                              setGrantDays(d);
                            }
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={customEndDate}
                        min={customStartDate || undefined}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomEndDate(val);
                          if (customStartDate && val) {
                            const s = new Date(customStartDate).getTime();
                            const en = new Date(val).getTime();
                            if (en >= s) {
                              const d = Math.round((en - s) / 86400000) + 1;
                              setGrantDays(d);
                            }
                          }
                        }}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                      />
                    </div>
                  </div>

                  {/* Duration & Reset buttons */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-amber-200/60 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-700">Days:</span>
                      <input
                        id="grant-days"
                        type="number"
                        min={1}
                        max={365}
                        value={grantDays}
                        onChange={(e) => {
                          const next = Math.max(1, Number(e.target.value) || 1);
                          setGrantDays(next);
                          if (customStartDate) {
                            const s = new Date(customStartDate);
                            const en = new Date(s.getTime() + (next - 1) * 86400000);
                            setCustomEndDate(en.toISOString().split("T")[0]);
                          }
                        }}
                        className="w-16 px-2 py-1 rounded-lg border border-amber-300 text-xs font-bold text-amber-950 bg-white text-center focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    {datesChanged && (
                      <button
                        type="button"
                        onClick={() => {
                          if (activeAction.startDate && activeAction.endDate) {
                            setCustomStartDate(new Date(activeAction.startDate).toISOString().split("T")[0]);
                            setCustomEndDate(new Date(activeAction.endDate).toISOString().split("T")[0]);
                            setGrantDays(activeAction.requestedDays ?? 1);
                          }
                        }}
                        className="px-2 py-1 rounded-lg bg-white border border-amber-200 text-[10.5px] font-bold text-slate-700 hover:bg-amber-100/50 cursor-pointer"
                        title="Reset to originally requested dates"
                      >
                        Reset Dates
                      </button>
                    )}
                  </div>

                  {/* Quick Grant Presets (e.g. 1 Day, 2 Days, 3 Days, ..., Full) */}
                  {activeAction.requestedDays && activeAction.requestedDays > 1 && (
                    <div className="pt-2 border-t border-amber-200/60">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Quick Duration Presets:
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {Array.from(
                          { length: Math.min(activeAction.requestedDays, 7) },
                          (_, i) => i + 1
                        ).map((d) => (
                          <button
                            key={`grant-chip-${d}`}
                            type="button"
                            onClick={() => {
                              setGrantDays(d);
                              if (customStartDate) {
                                setCustomEndDate(computeEndDate(customStartDate, d));
                              }
                            }}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              grantDays === d
                                ? "bg-amber-600 text-white shadow-xs scale-102"
                                : "bg-white text-slate-700 border border-amber-200 hover:bg-amber-100/60"
                            }`}
                          >
                            {d === activeAction.requestedDays
                              ? `Full (${d} Days)`
                              : `${d} ${d === 1 ? "Day" : "Days"}`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Partial Approval Notice */}
                  {grantDays < (activeAction.requestedDays ?? 1) && (
                    <div className="p-2.5 rounded-xl bg-amber-100/80 border border-amber-300 text-amber-950 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block text-amber-950">Partial Leave Approval</span>
                        <span className="text-[11px] text-amber-900 leading-relaxed">
                          Granting <strong>{grantDays}</strong> of <strong>{activeAction.requestedDays}</strong> requested days.
                          Only the granted period (<strong>{customStartDate}</strong> to <strong>{customEndDate}</strong>) will be marked as excused leave; the remaining {(activeAction.requestedDays ?? 0) - grantDays} days are withheld.
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Active Range Confirmation */}
                  <div className="text-[11px] font-semibold text-emerald-900 bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-2.5">
                    <div className="flex items-center gap-1.5">
                      <Palmtree className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>
                        Period:{" "}
                        <strong className="font-bold text-emerald-950">
                          {customStartDate ? new Date(customStartDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—"}
                          {" "}to{" "}
                          {customEndDate ? new Date(customEndDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "—"}
                        </strong>{" "}
                        ({grantDays} {grantDays === 1 ? "day" : "days"})
                      </span>
                    </div>
                    {activeAction.isSettlingHold && (
                      <div className="mt-1 text-[10.5px] text-emerald-800 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>Resuming from ON HOLD &amp; marking attendance automatically.</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Parent Notification Target Preview */}
            <div className="mb-4 p-3 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-amber-950 uppercase tracking-wider text-[10px]">
                  Parent Notification Target
                </span>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300/80">
                  Email &amp; WhatsApp Auto-Dispatched
                </span>
              </div>
              <div className="space-y-1 text-[11px] text-slate-700">
                {activeAction.parentName && (
                  <div>
                    <span className="text-slate-500 font-medium">Recipient: </span>
                    <span className="font-semibold text-slate-900">{activeAction.parentName}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="text-slate-500 font-medium">Email: </span>
                  {activeAction.parentEmail ? (
                    <span className="font-mono text-slate-900 font-semibold truncate">{activeAction.parentEmail}</span>
                  ) : (
                    <span className="text-slate-400 italic">No parent email on file</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span className="text-slate-500 font-medium">WhatsApp: </span>
                  {activeAction.parentPhone ? (
                    <span className="font-mono text-emerald-900 font-bold">+{activeAction.parentPhone}</span>
                  ) : (
                    <span className="text-slate-400 italic">No parent mobile on file</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs flex items-start gap-2.5">
              <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold text-gray-900 block text-[11.5px]">Strictly One-Way Outbound Notification</span>
                <span className="text-[11px] text-gray-500 leading-relaxed block mt-0.5">
                  Official one-way WhatsApp notice &amp; transactional email are automatically dispatched to the student's registered parents upon decision.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setActiveAction(null);
                  setActionNotes("");
                }}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActionConfirm}
                disabled={processing}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  activeAction.type === "approve"
                    ? "depth-3d-btn-emerald"
                    : activeAction.type === "hold"
                    ? "depth-3d-btn-gold text-stone-950 font-extrabold"
                    : "depth-3d-btn-dark"
                }`}
              >
                {processing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {activeAction.type === "hold" && <PauseCircle className="w-3.5 h-3.5 text-stone-950" strokeWidth={2} />}
                <span>
                  {activeAction.type === "approve"
                    ? activeAction.isSettlingHold
                      ? Boolean((customStartDate && customStartDate !== (activeAction.startDate ? new Date(activeAction.startDate).toISOString().split("T")[0] : "")) || (customEndDate && customEndDate !== (activeAction.endDate ? new Date(activeAction.endDate).toISOString().split("T")[0] : "")))
                        ? `Resume & Approve with Changes (${grantDays} Days)`
                        : `Resume & Approve (${grantDays} Days) & Sync`
                      : grantDays < (activeAction.requestedDays ?? 1)
                      ? `Approve Partial (${grantDays} of ${activeAction.requestedDays} Days) & Sync`
                      : Boolean((customStartDate && customStartDate !== (activeAction.startDate ? new Date(activeAction.startDate).toISOString().split("T")[0] : "")) || (customEndDate && customEndDate !== (activeAction.endDate ? new Date(activeAction.endDate).toISOString().split("T")[0] : "")))
                      ? `Approve with Changes (${grantDays} Days) & Sync`
                      : `Approve (${grantDays} Days) & Sync`
                    : activeAction.type === "hold"
                    ? "Put On Hold & Send Notice"
                    : "Confirm Rejection"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin On-Demand Notify Parent Modal */}
      {notifyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onClick={() => setNotifyTarget(null)} />
          <div className="relative z-10 w-full max-w-[calc(100vw-1.25rem)] sm:max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 depth-3d-card border border-amber-200/60 animate-slide-up">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80" />
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-bold text-base text-slate-900">
                Notify Parent via Email &amp; WhatsApp
              </h3>
              <button
                type="button"
                onClick={() => setNotifyTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4 leading-relaxed">
              Send an administrative notification to {notifyTarget.studentName}'s parents regarding their {notifyTarget.status.toLowerCase()} leave application.
            </p>

            {/* Recipient Details */}
            <div className="mb-4 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
              <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">
                Parent Contact Information
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Parent Name:</span>
                <span className="font-semibold text-slate-800">{notifyTarget.parentName || "Parent / Guardian"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Email Address:</span>
                <span className="font-mono text-slate-800 font-semibold">{notifyTarget.parentEmail || "Not on file"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">WhatsApp / Mobile:</span>
                <span className="font-mono text-emerald-800 font-bold">{notifyTarget.parentPhone ? `+${notifyTarget.parentPhone}` : "Not on file"}</span>
              </div>
            </div>

            {/* Channel Selection */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Notification Channel
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNotifyChannel("BOTH")}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    notifyChannel === "BOTH"
                      ? "bg-slate-950 text-amber-300 border-slate-950 shadow-xs ring-1 ring-amber-400/40"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Both</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotifyChannel("WHATSAPP")}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    notifyChannel === "WHATSAPP"
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNotifyChannel("EMAIL")}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                    notifyChannel === "EMAIL"
                      ? "bg-sky-600 text-white border-sky-600 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Mail className="w-3.5 h-3.5" />
                  <span>Email</span>
                </button>
              </div>
            </div>

            {/* Message input */}
            <div className="mb-4">
              <label htmlFor="custom-notify-msg" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Remarks / Custom Note
                <span className="normal-case font-normal text-slate-500 ml-1.5">(Optional: leave blank for standard status template)</span>
              </label>
              <textarea
                id="custom-notify-msg"
                rows={3}
                value={customNotifyMsg}
                onChange={(e) => setCustomNotifyMsg(e.target.value)}
                placeholder="Optional notes or instructions to the parent..."
                className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-none"
              />
            </div>

            {notifySuccessMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{notifySuccessMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {notifyTarget.whatsAppUrl ? (
                <a
                  href={notifyTarget.whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-bold text-xs hover:bg-emerald-100"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Open WhatsApp</span>
                </a>
              ) : <div />}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setNotifyTarget(null)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendParentNotification}
                  disabled={notifySending}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  {notifySending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Send Notice</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Success / Multi-Channel Delivery Feedback Modal */}
      {actionSuccessNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in" onClick={() => setActionSuccessNotice(null)} />
          <div className="relative z-10 w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 depth-3d-card border border-amber-200/60 animate-slide-up shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-display font-bold text-lg text-slate-900 text-center mb-1">
              Leave Application {actionSuccessNotice.status}!
            </h3>
            <p className="text-xs text-slate-600 text-center mb-4 leading-relaxed">
              Official decisions and notifications for <span className="font-bold text-slate-900">{actionSuccessNotice.studentName}</span> were automatically queued &amp; dispatched.
            </p>

            <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs mb-5">
              <div className="flex items-center gap-2 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <Mail className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-slate-600">Email Notice:</span>
                <span className="font-mono font-semibold text-slate-900 truncate">
                  {actionSuccessNotice.parentEmail || "Dispatched to registered parent inbox"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <BellRing className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-slate-600">Portal Push:</span>
                <span className="font-semibold text-slate-900">
                  Delivered to Parent &amp; Student Portals
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium text-slate-600">WhatsApp Notice:</span>
                <span className="font-mono font-semibold text-slate-900 truncate">
                  {actionSuccessNotice.parentPhone ? `+${actionSuccessNotice.parentPhone}` : "Prepared for WhatsApp dispatch"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {actionSuccessNotice.whatsAppUrl ? (
                <a
                  href={actionSuccessNotice.whatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Send via WhatsApp Now</span>
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setActionSuccessNotice(null)}
                className={`py-3 px-4 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-all cursor-pointer ${
                  actionSuccessNotice.whatsAppUrl ? "" : "flex-1"
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Standalone Dedicated Edit Leave Dates Modal ── */}
      {editDatesTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-md animate-fade-in"
            onClick={() => setEditDatesTarget(null)}
          />
          <div className="relative z-10 w-full max-w-[calc(100vw-1.25rem)] sm:max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 depth-3d-card border border-amber-200/60 animate-slide-up">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-80" />

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shrink-0">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900 leading-tight">
                    Edit Leave Dates
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {editDatesTarget.studentName} ({editDatesTarget.className || `Gr ${editDatesTarget.grade}-${editDatesTarget.section}`})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditDatesTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Status Pill */}
            <div className="flex items-center gap-2 my-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-500 font-medium">Status:</span>
              <span className="font-bold text-slate-900">{editDatesTarget.status}</span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-500 font-medium">Type:</span>
              <span className="font-semibold text-slate-800">{editDatesTarget.type}</span>
            </div>

            {/* Start & End Date Pickers */}
            <div className="space-y-3 mb-4">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditStartDate(val);
                      if (val && editEndDate) {
                        const d = computeDaysBetween(val, editEndDate);
                        setEditDays(d);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>

                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    min={editStartDate || undefined}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditEndDate(val);
                      if (editStartDate && val) {
                        const d = computeDaysBetween(editStartDate, val);
                        setEditDays(d);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-amber-300 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </div>
              </div>

              {/* Quick Preset Duration Chips */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Duration Presets:
                  </span>
                  <span className="text-xs font-bold text-amber-900 font-mono">
                    {editDays} {editDays === 1 ? "Day" : "Days"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[1, 2, 3, 4, 5, 7, 10, 14].map((d) => (
                    <button
                      key={`edit-chip-${d}`}
                      type="button"
                      onClick={() => {
                        setEditDays(d);
                        if (editStartDate) {
                          setEditEndDate(computeEndDate(editStartDate, d));
                        }
                      }}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        editDays === d
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-white text-slate-700 border border-slate-200 hover:bg-amber-50"
                      }`}
                    >
                      {d} {d === 1 ? "Day" : "Days"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Remarks / Justification */}
              <div>
                <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Revision Reason / Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Leave dates shortened per parent agreement / Adjusted for exam schedule..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 resize-none"
                />
              </div>

              {/* Live Status Sync Notice */}
              {editDatesTarget.status === "APPROVED" && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <strong className="block font-bold text-emerald-900">Attendance Auto-Resync Notice</strong>
                    Updating dates on this approved leave will immediately update the leave record, re-calculate granted days, and update the Attendance Registry and Google Sheet.
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditDatesTarget(null)}
                className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditDates}
                disabled={editSaving}
                className="depth-3d-btn-emerald px-5 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
              >
                {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                <span>Save Leave Dates</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
