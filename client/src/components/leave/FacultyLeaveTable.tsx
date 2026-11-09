"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Stethoscope,
  Palmtree,
  Sparkles,
  Search,
  User,
  Trash2,
  Edit3,
  Loader2,
  AlertCircle,
  ShieldCheck,
  CalendarDays,
  Plus,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";
import {
  FacultyLeaveItem,
  FacultyLeaveStats,
  deleteFacultyLeave,
  updateFacultyLeave,
} from "@/lib/api";

interface FacultyLeaveTableProps {
  items: FacultyLeaveItem[];
  stats: FacultyLeaveStats;
  loading: boolean;
  onRefresh: () => void;
  onOpenRecordModal: () => void;
  isAdmin?: boolean;
}

export function FacultyLeaveTable({
  items,
  stats,
  loading,
  onRefresh,
  onOpenRecordModal,
  isAdmin = true,
}: FacultyLeaveTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  // Edit Leave Dialog State
  const [editingItem, setEditingItem] = useState<FacultyLeaveItem | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editType, setEditType] = useState("PERSONAL");
  const [editReason, setEditReason] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Deleting item state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filteredItems = items.filter((item) => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matchName = item.teacherName.toLowerCase().includes(q);
      const matchIts = item.teacherIts.toLowerCase().includes(q);
      const matchDept = item.department.toLowerCase().includes(q);
      const matchReason = item.reason.toLowerCase().includes(q);
      if (!matchName && !matchIts && !matchDept && !matchReason) return false;
    }
    return true;
  });

  const handleOpenEdit = (item: FacultyLeaveItem) => {
    setEditingItem(item);
    setEditStartDate(item.startDate);
    setEditEndDate(item.endDate);
    setEditType(item.type);
    setEditReason(item.reason);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;
    if (!editStartDate || !editEndDate || !editReason.trim()) {
      toast({ title: "Incomplete Form", description: "Dates and reason are required.", variant: "destructive" });
      return;
    }
    if (new Date(editEndDate) < new Date(editStartDate)) {
      toast({ title: "Invalid Dates", description: "End date cannot be earlier than start date.", variant: "destructive" });
      return;
    }

    setSavingEdit(true);
    try {
      await updateFacultyLeave(
        editingItem.teacherId,
        {
          oldStartDate: editingItem.startDate,
          oldEndDate: editingItem.endDate,
          newStartDate: editStartDate,
          newEndDate: editEndDate,
          type: editType,
          reason: editReason.trim(),
        },
        isAdmin
      );

      toast({
        title: "Faculty Leave Updated",
        description: `Leave dates & attendance updated for ${editingItem.teacherName}.`,
      });

      setEditingItem(null);
      onRefresh();
    } catch (err: any) {
      console.error("Failed to update faculty leave:", err);
      toast({
        title: "Update Failed",
        description: err.message || "Failed to update faculty leave.",
        variant: "destructive",
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (item: FacultyLeaveItem) => {
    if (
      !confirm(
        `Are you sure you want to cancel the leave for ${item.teacherName} (${item.startDate} to ${item.endDate})?\n\nThis will restore their attendance record.`
      )
    ) {
      return;
    }

    setDeletingId(item.id);
    try {
      await deleteFacultyLeave(item.teacherId, item.startDate, item.endDate, isAdmin);
      toast({
        title: "Faculty Leave Cancelled",
        description: `Leave cancelled and attendance restored for ${item.teacherName}.`,
      });
      onRefresh();
    } catch (err: any) {
      console.error("Failed to cancel faculty leave:", err);
      toast({
        title: "Cancellation Failed",
        description: err.message || "Failed to cancel faculty leave.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Metric Summary Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <button
          type="button"
          onClick={() => setStatusFilter("ACTIVE")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "ACTIVE"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-500/20"
              : "bg-white border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider opacity-85">Active Today</span>
            <CheckCircle2 className="w-4 h-4 opacity-85" />
          </div>
          <div className="text-2xl font-black">{stats.active}</div>
          <div className="text-[11px] opacity-75 mt-0.5">Faculty currently away</div>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("UPCOMING")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "UPCOMING"
              ? "bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-400/20"
              : "bg-white border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider opacity-85">Upcoming</span>
            <Clock className="w-4 h-4 opacity-85" />
          </div>
          <div className="text-2xl font-black">{stats.upcoming}</div>
          <div className="text-[11px] opacity-75 mt-0.5">Scheduled future leaves</div>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === "MEDICAL" ? "ALL" : "MEDICAL")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            typeFilter === "MEDICAL"
              ? "bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-500/20"
              : "bg-white border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider opacity-85">Medical</span>
            <Stethoscope className="w-4 h-4 opacity-85" />
          </div>
          <div className="text-2xl font-black">{stats.medical}</div>
          <div className="text-[11px] opacity-75 mt-0.5">Health exemptions</div>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("ALL");
            setTypeFilter("ALL");
          }}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "ALL" && typeFilter === "ALL"
              ? "bg-gray-900 text-white border-gray-900 shadow-md ring-2 ring-gray-900/20"
              : "bg-white border-gray-100 hover:border-gray-200"
          }`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider opacity-85">Total Recorded</span>
            <Calendar className="w-4 h-4 opacity-85" />
          </div>
          <div className="text-2xl font-black">{stats.total}</div>
          <div className="text-[11px] opacity-75 mt-0.5">All faculty leaves</div>
        </button>
      </div>

      {/* ── Auto-Mark System Banner ── */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start md:items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shrink-0 shadow-xs">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
              <span>Automatic Faculty Holiday & Biometric Protection Active</span>
              <Badge className="bg-emerald-600 text-white text-[10px] font-black uppercase">
                Active
              </Badge>
            </div>
            <div className="text-xs text-slate-600 mt-0.5">
              When faculty leave is recorded, all days in the date range are auto-marked as <span className="font-bold text-slate-900">ON_LEAVE / MEDICAL</span>. If a member scans during this period, biometric devices verify and acknowledge the scan without overriding their leave to present or absent.
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenRecordModal}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-all shrink-0 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Record Faculty Leave</span>
        </button>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="p-4 rounded-2xl bg-white border border-gray-100 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by faculty name, ITS, department, or reason..."
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active (Away Today)</option>
            <option value="UPCOMING">Upcoming</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 bg-white focus:outline-none focus:border-amber-500"
          >
            <option value="ALL">All Types</option>
            <option value="MEDICAL">Medical Exemption</option>
            <option value="PERSONAL">Personal / Authorized Leave</option>
          </select>
        </div>
      </div>

      {/* ── Faculty Leaves List ── */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-100 space-y-3">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto" />
          <div className="text-xs text-gray-500 font-medium">Loading faculty leave records...</div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-gray-100 space-y-3">
          <Palmtree className="w-10 h-10 text-gray-300 mx-auto" />
          <div className="text-sm font-bold text-gray-800">No faculty leave records found</div>
          <div className="text-xs text-gray-500 max-w-sm mx-auto">
            {search || statusFilter !== "ALL" || typeFilter !== "ALL"
              ? "Try adjusting your search criteria or filters."
              : "No faculty members are currently on authorized or medical leave."}
          </div>
          <button
            type="button"
            onClick={onOpenRecordModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Record First Faculty Leave</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const isMedical = item.type === "MEDICAL";
            const isDeleting = deletingId === item.id;

            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white border border-gray-200/80 shadow-xs hover:border-amber-400/50 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                {/* Header: Teacher info + status badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-12 h-12 rounded-xl ring-2 ring-gray-100 shrink-0">
                      <AvatarImage src={item.avatarUrl || undefined} alt={item.teacherName} />
                      <AvatarFallback className="bg-amber-100 text-amber-900 font-bold text-xs rounded-xl">
                        {getInitials(item.teacherName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <h3 className="text-sm font-black text-gray-900 truncate">
                        {item.teacherName}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                        <span className="font-semibold text-gray-700">{item.department}</span>
                        {item.teacherIts && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[11px]">ITS {item.teacherIts}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <Badge
                    className={`text-[10px] font-black uppercase shrink-0 ${
                      item.status === "ACTIVE"
                        ? "bg-emerald-500 text-white"
                        : item.status === "UPCOMING"
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-200 text-slate-700"
                    }`}
                  >
                    {item.status === "ACTIVE" ? "Away Today" : item.status}
                  </Badge>
                </div>

                {/* Details Strip */}
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-gray-800">
                      <CalendarDays className="w-4 h-4 text-amber-600" />
                      <span>
                        {formatDateDisplay(item.startDate)}
                        {item.startDate !== item.endDate && ` – ${formatDateDisplay(item.endDate)}`}
                      </span>
                    </div>

                    <Badge
                      className={`text-[10px] font-bold ${
                        isMedical
                          ? "bg-rose-100 text-rose-800 border-rose-200"
                          : "bg-blue-100 text-blue-800 border-blue-200"
                      }`}
                    >
                      {item.totalDays} {item.totalDays === 1 ? "Day" : "Days"} •{" "}
                      {isMedical ? "Medical Leave" : "Authorized Leave"}
                    </Badge>
                  </div>

                  <div className="text-gray-600 leading-relaxed font-medium">
                    <span className="text-gray-400 font-semibold">Reason: </span>
                    {item.reason}
                  </div>

                  {item.assignedByName && (
                    <div className="text-[11px] text-gray-400">
                      Authorized by <span className="text-gray-600 font-semibold">{item.assignedByName}</span>
                    </div>
                  )}
                </div>

                {/* Biometric Auto-Mark Tag & Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Auto-Mark Active</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => handleDelete(item)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-50 transition-colors"
                      title="Cancel leave and restore attendance"
                    >
                      {isDeleting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Edit Leave Modal ── */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 space-y-5 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-gray-900">
                  Update Faculty Leave
                </h3>
                <p className="text-xs text-gray-500">
                  {editingItem.teacherName} • {editingItem.department}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-xl hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">
                  Leave Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditType("MEDICAL")}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                      editType === "MEDICAL"
                        ? "bg-rose-50 border-rose-300 text-rose-700 ring-2 ring-rose-400/20"
                        : "bg-gray-50 border-gray-200 text-gray-600"
                    }`}
                  >
                    <Stethoscope className="w-4 h-4 text-rose-600" />
                    <span>Medical Exemption</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditType("PERSONAL")}
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                      editType === "PERSONAL"
                        ? "bg-amber-50 border-amber-300 text-amber-800 ring-2 ring-amber-400/20"
                        : "bg-gray-50 border-gray-200 text-gray-600"
                    }`}
                  >
                    <Palmtree className="w-4 h-4 text-amber-600" />
                    <span>Authorized Leave</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-900 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">
                  Reason or Description
                </label>
                <textarea
                  rows={3}
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Reason for leave..."
                  className="w-full p-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-amber-50 text-amber-900 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Attendance records will automatically sync for the updated date range.</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={savingEdit}
                onClick={handleSaveEdit}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-bold text-xs shadow-xs disabled:opacity-50 transition-all"
              >
                {savingEdit ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
