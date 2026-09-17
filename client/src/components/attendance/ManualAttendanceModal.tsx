"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Users,
  Loader2,
  Save,
  RotateCcw,
  Search,
  Check,
  X,
  Building2,
  Shield,
  Layers,
  Sparkles,
  UserCheck,
  Calendar,
  Filter,
  BookOpen,
} from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalFooter,
  ModalClose,
} from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { getInitials } from "@/lib/utils";

export type ScheduleType = "WINDOW" | "FACULTY_WINDOW" | "CLASS_PERIOD" | "DAILY_REGISTRY";
export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "MEDICAL" | "ON_LEAVE" | "EARLY_DEPARTURE";

interface ManualAttendanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScheduleType?: ScheduleType;
  initialClassId?: string;
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
  initialScheduleType = "WINDOW",
  initialClassId = "",
  initialDate,
  onSuccess,
}: ManualAttendanceModalProps) {
  const [scheduleType, setScheduleType] = useState<ScheduleType>(initialScheduleType);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState(initialClassId);
  const [date, setDate] = useState(() => initialDate || new Date().toISOString().slice(0, 10));

  // Schedule definitions loaded from server
  const [scheduleData, setScheduleData] = useState<any>(null);
  const [loadingSchedules, setLoadingSchedules] = useState(true);

  // Roster candidate items
  const [roster, setRoster] = useState<any[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  // Load schedule metadata
  useEffect(() => {
    if (!open) return;
    setLoadingSchedules(true);
    fetch("/api/attendance/manual/schedules")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data) {
          setScheduleData(res.data);
          if (res.data.studentWindows?.length > 0 && !selectedScheduleId) {
            setSelectedScheduleId(res.data.studentWindows[0].id);
          }
          if (res.data.classes?.length > 0 && !selectedClassId) {
            setSelectedClassId(res.data.classes[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSchedules(false));
  }, [open]);

  // Load candidate roster whenever schedule type, schedule ID, class ID or date changes
  const fetchRoster = useCallback(async () => {
    if (!open) return;
    setLoadingRoster(true);
    try {
      const params = new URLSearchParams({
        scheduleType,
        date,
        ...(scheduleType === "WINDOW" || scheduleType === "FACULTY_WINDOW" ? { scheduleId: selectedScheduleId } : {}),
        ...(scheduleType === "CLASS_PERIOD" ? { classId: selectedClassId } : {}),
      });

      const res = await fetch(`/api/attendance/manual/roster?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setRoster(
          (json.data.roster || []).map((r: any) => ({
            ...r,
            currentStatus: r.status === "NOT_MARKED" ? "PRESENT" : r.status,
            currentTime: r.checkInTime ? r.checkInTime.slice(11, 16) : "08:00",
            customRemarks: r.remarks || "",
          }))
        );
      }
    } catch {
      toast({ variant: "destructive", title: "Roster Error", description: "Failed to load candidate roster." });
    } finally {
      setLoadingRoster(false);
    }
  }, [open, scheduleType, selectedScheduleId, selectedClassId, date]);

  useEffect(() => {
    if (open) {
      fetchRoster();
    }
  }, [open, fetchRoster]);

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

      const isTeacher = scheduleType === "FACULTY_WINDOW";
      const payload = {
        scheduleType,
        scheduleId: selectedScheduleId || undefined,
        classId: scheduleType === "CLASS_PERIOD" ? selectedClassId : undefined,
        date,
        targetType: isTeacher ? "TEACHER" : "STUDENT",
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
        <ModalHeader>
          <ModalTitle className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md"
              style={{ background: "linear-gradient(135deg, #047857 0%, #064e3b 100%)" }}
            >
              <CheckCircle2 className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 font-display">Record Manual Attendance</p>
              <p className="text-xs text-gray-500">
                Mark single or bulk attendance across different schedule types with full audit logging.
              </p>
            </div>
          </ModalTitle>
        </ModalHeader>

        <div className="space-y-6 py-2">
          {/* Schedule Type Segmented Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-gray-100/90 border border-gray-200/70">
            {[
              { type: "WINDOW" as const, label: "Student Window", icon: Clock, desc: "School-Wide Scans" },
              { type: "FACULTY_WINDOW" as const, label: "Faculty Shift", icon: Shield, desc: "Teacher Windows" },
              { type: "CLASS_PERIOD" as const, label: "Class Timetable", icon: BookOpen, desc: "Period Attendance" },
              { type: "DAILY_REGISTRY" as const, label: "Daily Registry", icon: CalendarDays, desc: "Master Day Log" },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = scheduleType === tab.type;
              return (
                <button
                  key={tab.type}
                  type="button"
                  onClick={() => setScheduleType(tab.type)}
                  className={`p-2.5 rounded-xl text-left transition-all ${
                    isActive
                      ? "bg-white text-emerald-950 font-black shadow-md border border-emerald-200 ring-1 ring-emerald-500/20"
                      : "text-gray-600 hover:bg-white/50 font-semibold"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon className={`w-4 h-4 ${isActive ? "text-[#047857]" : "text-gray-400"}`} />
                    <span className="text-xs">{tab.label}</span>
                  </div>
                  <p className="text-[10px] text-gray-500 line-clamp-1">{tab.desc}</p>
                </button>
              );
            })}
          </div>

          {/* Schedule Selectors & Date Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
            {/* 1. Specific Schedule Selector */}
            {scheduleType === "WINDOW" && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select Scan Window</label>
                <select
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                >
                  {scheduleData?.studentWindows?.map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.startTime} - {w.lateEndTime})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scheduleType === "FACULTY_WINDOW" && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select Faculty Window</label>
                <select
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                >
                  {scheduleData?.facultyWindows?.map((w: any) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.startTime} - {w.lateEndTime})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scheduleType === "CLASS_PERIOD" && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Select Class / Subject</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                >
                  {scheduleData?.classes?.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.grade}-{c.section}) - {c.subject}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {scheduleType === "DAILY_REGISTRY" && (
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Scope</label>
                <div className="px-3 py-2 rounded-xl border border-emerald-200 bg-white text-xs font-bold text-emerald-800 flex items-center gap-1.5 shadow-xs">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>All Active Students (School-Wide)</span>
                </div>
              </div>
            )}

            {/* 2. Date Picker */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Attendance Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
              />
            </div>

            {/* 3. Search Filter in Roster */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Search Candidate</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none shadow-xs"
                />
              </div>
            </div>
          </div>

          {/* Bulk Action Controls */}
          <div className="flex items-center justify-between gap-3 flex-wrap bg-gray-50/80 p-3 rounded-2xl border border-gray-200/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">Fast Bulk Actions:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => markAllStatus("PRESENT")}
                className="h-7 text-xs bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 font-bold"
              >
                <Check className="w-3 h-3 mr-1" /> All Present
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => markAllStatus("ABSENT")}
                className="h-7 text-xs bg-red-50 border-red-300 text-red-800 hover:bg-red-100 font-bold"
              >
                <X className="w-3 h-3 mr-1" /> All Absent
              </Button>
            </div>

            <span className="text-xs text-gray-500 font-medium">
              Showing <strong>{filteredRoster.length}</strong> of {roster.length} candidate(s)
            </span>
          </div>

          {/* Roster Candidate List */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden bg-white shadow-xs">
            {loadingRoster ? (
              <div className="py-16 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
                <p className="text-xs text-gray-500 font-medium">Loading schedule candidates...</p>
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <p className="text-sm font-bold">No candidates found for selected schedule</p>
                <p className="text-xs mt-1">Try changing the date or search query.</p>
              </div>
            ) : (
              <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-100">
                {filteredRoster.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 hover:bg-gray-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    {/* Candidate Info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#047857] to-[#064e3b] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                        {getInitials(item.name.split(" ")[0], item.name.split(" ")[1] || "")}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-900 truncate">{item.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono">
                          <span>{item.its ? `ITS: ${item.its}` : `ID: ${item.identifier}`}</span>
                          {item.grade && <span>• Grade {item.grade}-{item.section}</span>}
                          {item.department && <span>• {item.department}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Status Picker Pills & Remarks */}
                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <div className="flex items-center gap-1 bg-gray-100/90 p-1 rounded-xl">
                        {statuses.map((st) => {
                          const conf = STATUS_CONFIG[st];
                          const isCurrent = item.currentStatus === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => updateItemStatus(item.id, st)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                isCurrent
                                  ? conf.activeClass
                                  : "text-gray-600 hover:bg-white/80"
                              }`}
                            >
                              {conf.label}
                            </button>
                          );
                        })}
                      </div>

                      <input
                        type="text"
                        placeholder="Optional remarks..."
                        value={item.customRemarks || ""}
                        onChange={(e) => updateItemRemarks(item.id, e.target.value)}
                        className="px-2.5 py-1 text-[11px] rounded-lg border border-gray-200 bg-white w-28 sm:w-36 outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <ModalFooter>
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-gray-500">
              Target: <strong className="text-emerald-800">{scheduleType.replace("_", " ")}</strong> on{" "}
              <strong>{date}</strong>
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || roster.length === 0}
                className="bg-[#047857] hover:bg-[#065f46] text-white font-bold"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Recording...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1.5" /> Save Manual Attendance
                  </>
                )}
              </Button>
            </div>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
