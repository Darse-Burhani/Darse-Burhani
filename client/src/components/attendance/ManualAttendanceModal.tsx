"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  Save,
  Search,
  Shield,
  UserCheck,
  Users,
  GraduationCap,
  Stethoscope,
  ShieldCheck,
  CheckCheck,
  Sparkles,
} from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "ON_LEAVE";

interface ScheduledWindow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  enabled: boolean;
}

interface ManualAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScheduleId?: string;
  initialDate?: string;
  onSuccess?: () => void;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  { label: string; icon: React.ElementType; color: string; activeClass: string; badge: string }
> = {
  PRESENT: {
    label: "Present",
    icon: CheckCircle2,
    color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    activeClass: "bg-emerald-600 text-white border-emerald-600 shadow-sm",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  LATE: {
    label: "Late",
    icon: Clock,
    color: "text-amber-700 bg-amber-50 border-amber-200",
    activeClass: "bg-amber-600 text-white border-amber-600 shadow-sm",
    badge: "bg-amber-100 text-amber-800 border-amber-200",
  },
  ABSENT: {
    label: "Absent",
    icon: XCircle,
    color: "text-rose-700 bg-rose-50 border-rose-200",
    activeClass: "bg-rose-600 text-white border-rose-600 shadow-sm",
    badge: "bg-rose-100 text-rose-800 border-rose-200",
  },
  ON_LEAVE: {
    label: "Leave",
    icon: ShieldCheck,
    color: "text-purple-700 bg-purple-50 border-purple-200",
    activeClass: "bg-purple-600 text-white border-purple-600 shadow-sm",
    badge: "bg-purple-100 text-purple-800 border-purple-200",
  },
};

export function ManualAttendanceModal({
  open,
  onOpenChange,
  initialScheduleId = "",
  initialDate,
  onSuccess,
}: ManualAttendanceModalProps) {
  const [scheduledWindows, setScheduledWindows] = useState<ScheduledWindow[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(initialScheduleId);
  const targetType = "STUDENT";
  const [date, setDate] = useState(() => initialDate || new Date().toISOString().slice(0, 10));

  // Filters
  const [grades, setGrades] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [selectedSection, setSelectedSection] = useState("ALL");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Roster candidate items
  const [roster, setRoster] = useState<any[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load schedule metadata from server
  useEffect(() => {
    if (!open) return;
    setLoadingSchedule(true);
    fetch("/api/attendance/manual/schedules")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          const wins: ScheduledWindow[] = res.data.scheduledWindows || [];
          setScheduledWindows(wins);
          setGrades(res.data.grades || []);
          setSections(res.data.sections || []);

          if (wins.length > 0 && !selectedScheduleId) {
            setSelectedScheduleId(wins[0].id);
          }
        }
      })
      .catch(() => {
        toast({ variant: "destructive", title: "Schedule Error", description: "Failed to load schedule event windows." });
      })
      .finally(() => setLoadingSchedule(false));
  }, [open, selectedScheduleId]);

  const activeWindow = useMemo(() => {
    return scheduledWindows.find((w) => w.id === selectedScheduleId) || scheduledWindows[0] || null;
  }, [scheduledWindows, selectedScheduleId]);

  // Load candidate roster whenever schedule event ID, filters or date changes
  const fetchRoster = useCallback(async () => {
    if (!open) return;
    setLoadingRoster(true);
    try {
      const params = new URLSearchParams({
        scheduleId: selectedScheduleId || "",
        targetType: "STUDENT",
        date,
        ...(selectedGrade !== "ALL" ? { grade: selectedGrade } : {}),
        ...(selectedSection !== "ALL" ? { section: selectedSection } : {}),
      });

      const res = await fetch(`/api/attendance/manual/roster?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setRoster(
          (json.data.roster || []).map((r: any) => ({
            ...r,
            currentStatus: r.status === "NOT_MARKED" ? "PRESENT" : r.status,
            customRemarks: r.remarks || "",
          }))
        );
      }
    } catch {
      toast({ variant: "destructive", title: "Roster Error", description: "Failed to load candidate roster." });
    } finally {
      setLoadingRoster(false);
    }
  }, [open, selectedScheduleId, selectedGrade, selectedSection, date]);

  useEffect(() => {
    if (open && (selectedScheduleId || scheduledWindows.length > 0)) {
      fetchRoster();
    }
  }, [open, selectedScheduleId, selectedGrade, selectedSection, date, fetchRoster, scheduledWindows.length]);

  const statusCounts = useMemo(() => {
    let present = 0, late = 0, absent = 0, onLeave = 0;
    for (const r of roster) {
      if (r.currentStatus === "PRESENT") present++;
      else if (r.currentStatus === "LATE") late++;
      else if (r.currentStatus === "ABSENT") absent++;
      else if (r.currentStatus === "ON_LEAVE") onLeave++;
    }
    return { present, late, absent, onLeave, total: roster.length };
  }, [roster]);

  const filteredRoster = useMemo(() => {
    let list = roster.filter((r) => r.targetType === "STUDENT" || !r.targetType);
    if (statusFilter !== "ALL") {
      list = list.filter((r) => r.currentStatus === statusFilter);
    }
    const q = search.toLowerCase().trim();
    if (!q) return list;
    return list.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.identifier?.toLowerCase().includes(q) ||
        r.its?.toLowerCase().includes(q) ||
        r.grade?.toLowerCase().includes(q) ||
        r.section?.toLowerCase().includes(q)
    );
  }, [roster, statusFilter, search]);

  const updateItemStatus = (id: string, status: AttendanceStatus) => {
    setRoster((prev) =>
      prev.map((item) => (item.id === id ? { ...item, currentStatus: status } : item))
    );
  };

  const updateItemRemarks = (id: string, remarks: string) => {
    setRoster((prev) =>
      prev.map((item) => (item.id === id ? { ...item, customRemarks: remarks } : item))
    );
  };

  const markAllStatus = (status: AttendanceStatus) => {
    setRoster((prev) => prev.map((item) => ({ ...item, currentStatus: status })));
    toast({
      variant: "default",
      title: "Bulk Status Updated",
      description: `Marked all ${roster.length} candidate(s) as ${STATUS_CONFIG[status].label}.`,
    });
  };

  const handleSave = async () => {
    if (roster.length === 0) {
      toast({ variant: "warning", title: "No Records", description: "No candidates to save." });
      return;
    }

    setSaving(true);
    try {
      const records = roster.map((item) => ({
        id: item.id,
        targetType: "STUDENT",
        status: item.currentStatus,
        remarks: item.customRemarks ? item.customRemarks.trim() : undefined,
      }));

      const payload = {
        scheduleId: selectedScheduleId || undefined,
        date,
        targetType: "STUDENT",
        records,
      };

      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          variant: "success",
          title: "Attendance Recorded",
          description: json.message || `Successfully saved manual attendance for ${records.length} Talabat student(s).`,
        });
        onOpenChange(false);
        if (onSuccess) onSuccess();
      } else {
        toast({ variant: "destructive", title: "Save Failed", description: json.error || "Failed to save attendance." });
      }
    } catch {
      toast({ variant: "destructive", title: "Network Error", description: "Could not connect to server." });
    } finally {
      setSaving(false);
    }
  };

  const statuses: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "ON_LEAVE"];

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <ModalHeader className="pb-0">
          <ModalTitle className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
              style={{ background: "linear-gradient(135deg, #047857 0%, #065f46 100%)" }}
            >
              <CheckCircle2 className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <p className="text-xl font-black text-gray-900 tracking-tight">Record Manual Attendance — Talabat</p>
              <p className="text-xs text-gray-500 font-medium">
                Mark manual roll-call for <strong>Talabat students</strong> (Present, Late, Absent, Leave).
              </p>
            </div>
          </ModalTitle>
        </ModalHeader>

        <div className="space-y-4 py-2">
          {/* ── Schedule Event Window Selector ── */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  Attendance Session
                </label>
                <select
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 shadow-sm transition-colors"
                >
                  {scheduledWindows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="shrink-0 flex items-end">
                <div className="px-3.5 py-2 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  <span>Window Active for Marking</span>
                </div>
              </div>
            </div>

            {/* Date & Sub-filters */}
            <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-emerald-100/80">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-700">Date:</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-800 shadow-xs focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {grades.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">Grade:</span>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-800 shadow-xs"
                  >
                    <option value="ALL">All Grades</option>
                    {grades.map((g) => (
                      <option key={g} value={g}>Grade {g}</option>
                    ))}
                  </select>
                </div>
              )}

              {sections.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">Section:</span>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="h-8 px-2.5 rounded-lg border border-gray-200 bg-white text-xs font-semibold text-gray-800 shadow-xs"
                  >
                    <option value="ALL">All Sections</option>
                    {sections.map((s) => (
                      <option key={s} value={s}>Sec {s}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status summary pills */}
              <div className="ml-auto flex items-center gap-1.5 flex-wrap text-[11px] font-bold">
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {statusCounts.present} Present
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                  {statusCounts.late} Late
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  {statusCounts.absent} Absent
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  {statusCounts.onLeave} Leave
                </span>
              </div>
            </div>
          </div>

          {/* ── Search & Bulk Action Bar ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, ITS, ID, department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-xl border border-gray-200 bg-gray-50 text-xs text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => markAllStatus("PRESENT")}
                className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                All Present
              </button>
              <button
                type="button"
                onClick={() => markAllStatus("LATE")}
                className="px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                All Late
              </button>
              <button
                type="button"
                onClick={() => markAllStatus("ABSENT")}
                className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                All Absent
              </button>
              <button
                type="button"
                onClick={() => markAllStatus("ON_LEAVE")}
                className="px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                All Leave
              </button>
            </div>
          </div>

          {/* ── Roster List ── */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-xs">
            {loadingRoster || loadingSchedule ? (
              <div className="p-12 flex flex-col items-center justify-center gap-2 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <p className="text-xs font-semibold">Loading roster candidates...</p>
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="p-10 text-center text-gray-500 space-y-1">
                <p className="text-sm font-bold text-gray-700">No candidates match current selection</p>
                <p className="text-xs text-gray-400">Change filters or search term to view roster.</p>
              </div>
            ) : (
              <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100">
                {filteredRoster.map((item) => {
                  return (
                    <div
                      key={item.id}
                      className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-emerald-50/40 transition-colors"
                    >
                      {/* Member Info */}
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {getInitials(item.name)}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900 truncate">{item.name}</span>
                            <span className="px-1.5 py-0.2 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Grade {item.grade || "1"}-{item.section || "A"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500 font-medium">
                            <span className="font-mono">ITS: {item.identifier || item.its}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status Selection Buttons */}
                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {statuses.map((st) => {
                          const conf = STATUS_CONFIG[st];
                          const isActive = item.currentStatus === st;
                          const Icon = conf.icon;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => updateItemStatus(item.id, st)}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 flex items-center gap-1 border ${
                                isActive
                                  ? conf.activeClass
                                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                              }`}
                            >
                              <Icon className="w-3 h-3" />
                              <span>{conf.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <ModalFooter className="flex items-center justify-between border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500 font-medium">
            <strong>{roster.length}</strong> candidate(s) ready to submit
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || roster.length === 0}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-xs font-black shadow-md hover:from-emerald-500 hover:to-teal-600 active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save Attendance</span>
            </button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
