"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  Save,
  Search,
  Check,
  X,
  Building2,
  Shield,
  UserCheck,
  Filter,
  BookOpen,
  Sparkles,
  Users,
  GraduationCap,
  ChevronDown,
} from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "MEDICAL" | "ON_LEAVE" | "EARLY_DEPARTURE";

interface ScheduledWindow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateEndTime: string;
  graceMinutes: number;
  enabled: boolean;
  hasFacultyTimer: boolean;
  facultyStartTime?: string;
  facultyEndTime?: string;
  facultyLateEndTime?: string;
  facultyEnabled?: boolean;
  applicableTeacherIds?: string[];
}

interface ManualAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScheduleId?: string;
  initialTargetType?: "STUDENT" | "TEACHER";
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
    color: "text-red-700 bg-red-50 border-red-200",
    activeClass: "bg-red-600 text-white border-red-600 shadow-sm",
    badge: "bg-red-100 text-red-800 border-red-200",
  },
  MEDICAL: {
    label: "Medical",
    icon: AlertTriangle,
    color: "text-blue-700 bg-blue-50 border-blue-200",
    activeClass: "bg-blue-600 text-white border-blue-600 shadow-sm",
    badge: "bg-blue-100 text-blue-800 border-blue-200",
  },
  ON_LEAVE: {
    label: "On Leave",
    icon: UserCheck,
    color: "text-purple-700 bg-purple-50 border-purple-200",
    activeClass: "bg-purple-600 text-white border-purple-600 shadow-sm",
    badge: "bg-purple-100 text-purple-800 border-purple-200",
  },
  EARLY_DEPARTURE: {
    label: "Early Dep.",
    icon: AlertTriangle,
    color: "text-orange-700 bg-orange-50 border-orange-200",
    activeClass: "bg-orange-600 text-white border-orange-600 shadow-sm",
    badge: "bg-orange-100 text-orange-800 border-orange-200",
  },
};

export function ManualAttendanceModal({
  open,
  onOpenChange,
  initialScheduleId = "",
  initialTargetType = "STUDENT",
  initialDate,
  onSuccess,
}: ManualAttendanceModalProps) {
  const [scheduledWindows, setScheduledWindows] = useState<ScheduledWindow[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState(initialScheduleId);
  const [targetType, setTargetType] = useState<"STUDENT" | "TEACHER">(initialTargetType);
  const [date, setDate] = useState(() => initialDate || new Date().toISOString().slice(0, 10));

  // Filters
  const [grades, setGrades] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState("ALL");
  const [selectedSection, setSelectedSection] = useState("ALL");
  const [search, setSearch] = useState("");

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
  }, [open]);

  const activeWindow = useMemo(() => {
    return scheduledWindows.find((w) => w.id === selectedScheduleId) || scheduledWindows[0] || null;
  }, [scheduledWindows, selectedScheduleId]);

  // Load candidate roster whenever schedule event ID, audience, filters or date changes
  const fetchRoster = useCallback(async () => {
    if (!open) return;
    setLoadingRoster(true);
    try {
      const params = new URLSearchParams({
        scheduleId: selectedScheduleId || "",
        targetType,
        date,
        ...(targetType === "STUDENT" && selectedGrade !== "ALL" ? { grade: selectedGrade } : {}),
        ...(targetType === "STUDENT" && selectedSection !== "ALL" ? { section: selectedSection } : {}),
      });

      const res = await fetch(`/api/attendance/manual/roster?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setRoster(
          (json.data.roster || []).map((r: any) => ({
            ...r,
            currentStatus: r.status === "NOT_MARKED" ? "PRESENT" : r.status,
            currentTime: r.checkInTime ? r.checkInTime.slice(11, 16) : (activeWindow?.startTime || "08:00"),
            customRemarks: r.remarks || "",
          }))
        );
      }
    } catch {
      toast({ variant: "destructive", title: "Roster Error", description: "Failed to load candidate roster." });
    } finally {
      setLoadingRoster(false);
    }
  }, [open, selectedScheduleId, targetType, selectedGrade, selectedSection, date, activeWindow]);

  useEffect(() => {
    if (open && (selectedScheduleId || scheduledWindows.length > 0)) {
      fetchRoster();
    }
  }, [open, selectedScheduleId, targetType, selectedGrade, selectedSection, date, fetchRoster]);

  const filteredRoster = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return roster;
    return roster.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.identifier?.toLowerCase().includes(q) ||
        r.its?.toLowerCase().includes(q) ||
        r.department?.toLowerCase().includes(q)
    );
  }, [roster, search]);

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
        status: item.currentStatus,
        checkInTime: item.currentTime ? `${date}T${item.currentTime}:00Z` : undefined,
        remarks: item.customRemarks ? item.customRemarks.trim() : undefined,
      }));

      const payload = {
        scheduleId: selectedScheduleId || undefined,
        date,
        targetType,
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
          description: json.message || `Successfully saved manual attendance for ${records.length} candidate(s).`,
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

  const statuses: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "MEDICAL", "ON_LEAVE"];

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
              <p className="text-xl font-black text-gray-900 tracking-tight">Record Manual Attendance</p>
              <p className="text-xs text-gray-500 font-medium">
                Mark attendance for schedule event windows. Records sync across Teacher &amp; Admin views.
              </p>
            </div>
          </ModalTitle>
        </ModalHeader>

        <div className="space-y-4 py-2">
          {/* ── Schedule Event Window Selector & Audience ── */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  Scheduled Attendance Window
                </label>
                <select
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-xl border border-gray-200 bg-white text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 shadow-sm transition-colors"
                >
                  {scheduledWindows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} · ({w.startTime} - {w.endTime}{w.lateEndTime && w.lateEndTime !== w.endTime ? ` | Late till ${w.lateEndTime}` : ""})
                    </option>
                  ))}
                </select>
              </div>

              <div className="shrink-0">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] flex items-center gap-1.5 mb-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600" />
                  Audience
                </label>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-gray-100 border border-gray-200">
                  <button
                    type="button"
                    onClick={() => setTargetType("STUDENT")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                      targetType === "STUDENT"
                        ? "bg-white text-emerald-900 shadow-sm border border-emerald-200"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                    Talabat (Students)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("TEACHER")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 flex items-center gap-1.5 ${
                      targetType === "TEACHER"
                        ? "bg-white text-emerald-900 shadow-sm border border-emerald-200"
                        : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    Faculty / Teachers
                  </button>
                </div>
              </div>
            </div>

            {/* Event Window Active Timing Chip Strip */}
            {activeWindow && (
              <div className="flex items-center gap-2 flex-wrap text-xs pt-2 border-t border-emerald-100/80">
                <span className="font-bold text-gray-500 text-[10px] uppercase tracking-wide">Event Timing:</span>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-mono font-bold text-[11px] border border-emerald-200">
                  On-Time: {activeWindow.startTime} – {activeWindow.endTime}
                </span>
                {activeWindow.lateEndTime && activeWindow.lateEndTime !== activeWindow.endTime && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold text-[11px] border border-amber-200">
                    Late Till: {activeWindow.lateEndTime}
                  </span>
                )}
                {targetType === "TEACHER" && activeWindow.facultyStartTime && (
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono font-bold text-[11px] border border-blue-200">
                    Faculty Shift: {activeWindow.facultyStartTime} – {activeWindow.facultyEndTime}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Date and Filtering Controls ── */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-3">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] block mb-1.5">Attendance Date:</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors"
              />
            </div>

            {targetType === "STUDENT" && (
              <>
                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] block mb-1.5">Grade:</label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors"
                  >
                    <option value="ALL">All Grades</option>
                    {grades.map((g) => (
                      <option key={g} value={g}>
                        Grade {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] block mb-1.5">Section:</label>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors"
                  >
                    <option value="ALL">All Sections</option>
                    {sections.map((s) => (
                      <option key={s} value={s}>
                        Section {s}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className={targetType === "STUDENT" ? "sm:col-span-5" : "sm:col-span-9"}>
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] block mb-1.5">Search Name / ITS / ID:</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Type name, ITS, ID, department..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-colors placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>

          {/* ── Bulk Actions Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-700">
                Roster: <strong className="text-emerald-700">{filteredRoster.length}</strong> candidate(s)
              </span>
              {loadingRoster && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wide mr-1">Bulk Mark:</span>
              <button
                type="button"
                onClick={() => markAllStatus("PRESENT")}
                className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
              >
                All Present
              </button>
              <button
                type="button"
                onClick={() => markAllStatus("LATE")}
                className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
              >
                All Late
              </button>
              <button
                type="button"
                onClick={() => markAllStatus("ABSENT")}
                className="inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
              >
                All Absent
              </button>
            </div>
          </div>

          {/* ── Candidate Roster List ── */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100/80 max-h-[380px] overflow-y-auto">
            {loadingRoster ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
                <p className="text-xs font-bold text-gray-600">Loading roster for {activeWindow?.name || "event"}...</p>
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                <p className="text-xs font-bold">No candidates found for the selected criteria.</p>
              </div>
            ) : (
              filteredRoster.map((item) => (
                <div
                  key={item.id}
                  className="p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-gray-50/70 transition-colors duration-150"
                >
                  {/* Student / Teacher Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-xs shrink-0 shadow-sm"
                      style={{ background: "linear-gradient(135deg, #059669 0%, #065f46 100%)" }}
                    >
                      {getInitials(item.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-extrabold text-gray-900 truncate">{item.name}</p>
                        {item.its && (
                          <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-mono font-bold text-gray-600 border border-gray-200">
                            ITS {item.its}
                          </span>
                        )}
                        {item.grade && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-[10px] font-bold text-emerald-800 border border-emerald-100">
                            Gr {item.grade}-{item.section || "A"}
                          </span>
                        )}
                        {item.department && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-50 text-[10px] font-bold text-purple-800 border border-purple-100">
                            {item.department}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono truncate mt-0.5">
                        ID: {item.identifier || item.id.slice(0, 8)} · Prev: <span className="font-bold text-gray-600">{item.status}</span> ({item.source || "MANUAL"})
                      </p>
                    </div>
                  </div>

                  {/* Status Button Selection Grid */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap">
                    {statuses.map((st) => {
                      const cfg = STATUS_CONFIG[st];
                      const isSelected = item.currentStatus === st;
                      const Icon = cfg.icon;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => updateItemStatus(item.id, st)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] flex items-center gap-1 border active:scale-[0.96] ${
                            isSelected
                              ? cfg.activeClass
                              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300"
                          }`}
                        >
                          <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : ""}`} />
                          <span>{cfg.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <ModalFooter className="flex items-center justify-between gap-3 border-t border-gray-100 pt-4 bg-gray-50/30">
          <p className="text-xs text-gray-500 font-medium hidden sm:block">
            Updates reflect immediately in Teacher Portal &amp; Admin Attendance Logs.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || filteredRoster.length === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-black transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.97] disabled:opacity-60 shadow-md shadow-emerald-700/20"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save Attendance ({filteredRoster.length})
            </button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
