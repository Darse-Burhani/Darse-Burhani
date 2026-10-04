"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck,
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
  CalendarDays,
  RefreshCw,
  Fingerprint,
  FileText,
  Mail,
  Zap,
  CheckCheck,
  RotateCcw,
  Smartphone,
  Layers,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  Info,
  Radio,
  Keyboard,
  Timer,
  Award,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, getInitials } from "@/lib/utils";

export type AttendanceStatus =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "MEDICAL"
  | "ON_LEAVE"
  | "EARLY_DEPARTURE"
  | "NOT_MARKED";

interface ScheduledWindow {
  id: string;
  name: string;
  windowType?: "HIKVISION" | "MANUAL" | "BOTH";
  startTime: string;
  endTime: string;
  lateEndTime?: string;
  graceMinutes: number;
  enabled: boolean;
  hasFacultyTimer: boolean;
  facultyStartTime?: string;
  facultyEndTime?: string;
  facultyLateEndTime?: string;
  facultyEnabled?: boolean;
}

interface ClassOption {
  id: string;
  name: string;
  grade: string;
  section: string;
  subject?: string;
  teacherName?: string;
  studentCount?: number;
}

interface RosterMember {
  id: string;
  profileId: string;
  name: string;
  email?: string;
  identifier: string;
  its?: string;
  grade?: string;
  section?: string;
  department?: string;
  avatarUrl?: string | null;
  targetType: "STUDENT" | "TEACHER";
  status: AttendanceStatus;
  originalStatus?: AttendanceStatus;
  source?: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  remarks?: string | null;
}

const STATUS_BUTTONS: {
  key: AttendanceStatus;
  label: string;
  hotkey: string;
  icon: React.ElementType;
  activeColor: string;
  hoverColor: string;
  badgeBg: string;
  dotColor: string;
}[] = [
  {
    key: "PRESENT",
    label: "Present",
    hotkey: "1",
    icon: CheckCircle2,
    activeColor: "bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400/40",
    hoverColor: "hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300",
    badgeBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
    dotColor: "bg-emerald-500",
  },
  {
    key: "LATE",
    label: "Late",
    hotkey: "2",
    icon: Clock,
    activeColor: "bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-400/40",
    hoverColor: "hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300",
    badgeBg: "bg-amber-50 text-amber-800 border-amber-200",
    dotColor: "bg-amber-500",
  },
  {
    key: "ABSENT",
    label: "Absent",
    hotkey: "3",
    icon: XCircle,
    activeColor: "bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-400/40",
    hoverColor: "hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300",
    badgeBg: "bg-rose-50 text-rose-800 border-rose-200",
    dotColor: "bg-rose-500",
  },
  {
    key: "MEDICAL",
    label: "Medical",
    hotkey: "4",
    icon: Stethoscope,
    activeColor: "bg-sky-600 text-white border-sky-600 shadow-md ring-2 ring-sky-400/40",
    hoverColor: "hover:bg-sky-50 hover:text-sky-800 hover:border-sky-300",
    badgeBg: "bg-sky-50 text-sky-800 border-sky-200",
    dotColor: "bg-sky-500",
  },
  {
    key: "ON_LEAVE",
    label: "Excused",
    hotkey: "5",
    icon: ShieldCheck,
    activeColor: "bg-purple-600 text-white border-purple-600 shadow-md ring-2 ring-purple-400/40",
    hoverColor: "hover:bg-purple-50 hover:text-purple-800 hover:border-purple-300",
    badgeBg: "bg-purple-50 text-purple-800 border-purple-200",
    dotColor: "bg-purple-500",
  },
  {
    key: "EARLY_DEPARTURE",
    label: "Early Dep.",
    hotkey: "6",
    icon: AlertTriangle,
    activeColor: "bg-orange-600 text-white border-orange-600 shadow-md ring-2 ring-orange-400/40",
    hoverColor: "hover:bg-orange-50 hover:text-orange-800 hover:border-orange-300",
    badgeBg: "bg-orange-50 text-orange-800 border-orange-200",
    dotColor: "bg-orange-500",
  },
];

export default function AdminManualAttendancePage() {
  const [targetType, setTargetType] = useState<"ALL" | "STUDENT" | "TEACHER">("ALL");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scheduledWindows, setScheduledWindows] = useState<ScheduledWindow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [department, setDepartment] = useState<string>("ALL");

  // Filters
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("ALL");
  const [selectedGrade, setSelectedGrade] = useState<string>("ALL");
  const [selectedSection, setSelectedSection] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tabletMode, setTabletMode] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Roster & Data
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Live IST Clock
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setCurrentTimeStr(
        d.toLocaleTimeString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const t = setInterval(updateTime, 1000);
    return () => clearInterval(t);
  }, []);

  // Load Schedule Windows & Class Metadata
  const loadMetadata = useCallback(async () => {
    try {
      setLoadingInitial(true);
      const res = await fetch("/api/attendance/manual/schedules", {
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setScheduledWindows(data.data.scheduledWindows || []);
        setClasses(data.data.classes || []);
        setGrades(data.data.grades || []);
        setSections(data.data.sections || []);

        if (data.data.scheduledWindows?.length > 0 && !selectedScheduleId) {
          // Prefer Manual window or Both window
          // Default to All Schedules so full Talabat & Faculty roster is visible immediately
          setSelectedScheduleId("");
        }
      }
    } catch (err) {
      console.error("Failed to load attendance schedule metadata:", err);
      toast({ title: "Failed to load schedules", variant: "destructive" });
    } finally {
      setLoadingInitial(false);
    }
  }, [selectedScheduleId]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // Load candidate roster
  const loadRoster = useCallback(async () => {
    try {
      setLoadingRoster(true);
      const params = new URLSearchParams({
        targetType,
        date,
      });
      if (selectedScheduleId) params.set("scheduleId", selectedScheduleId);
      if (selectedClassId && selectedClassId !== "ALL") params.set("classId", selectedClassId);
      if (selectedGrade && selectedGrade !== "ALL") params.set("grade", selectedGrade);
      if (selectedSection && selectedSection !== "ALL") params.set("section", selectedSection);
      if (department && department !== "ALL") params.set("department", department);

      const res = await fetch(`/api/attendance/manual/roster?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success && json.data?.roster) {
        const list: RosterMember[] = json.data.roster.map((m: any) => ({
          ...m,
          originalStatus: m.status,
        }));
        setRoster(list);
        setHasChanges(false);
        setFocusedIndex(list.length > 0 ? 0 : null);
      } else {
        setRoster([]);
        setFocusedIndex(null);
      }
    } catch (err) {
      console.error("Failed to fetch candidate roster:", err);
      toast({ title: "Failed to load candidate roster", variant: "destructive" });
    } finally {
      setLoadingRoster(false);
    }
  }, [targetType, date, selectedScheduleId, selectedClassId, selectedGrade, selectedSection, department]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Active Selected Window Timing Analysis
  const activeWindow = useMemo(() => {
    if (!selectedScheduleId) return scheduledWindows[0] || null;
    return scheduledWindows.find((w) => w.id === selectedScheduleId) || scheduledWindows[0] || null;
  }, [scheduledWindows, selectedScheduleId]);

  const windowTimingStatus = useMemo(() => {
    if (!activeWindow) return { state: "UNKNOWN", text: "No schedule selected", color: "bg-gray-100 text-gray-700" };
    const now = new Date();
    const istMinutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + 330) % 1440;

    const isFac = targetType === "TEACHER" && activeWindow.hasFacultyTimer;
    const startStr = isFac ? activeWindow.facultyStartTime || activeWindow.startTime : activeWindow.startTime;
    const endStr = isFac ? activeWindow.facultyEndTime || activeWindow.endTime : activeWindow.endTime;
    const lateStr = isFac ? activeWindow.facultyLateEndTime || activeWindow.lateEndTime || endStr : activeWindow.lateEndTime || endStr;

    const [sh, sm] = (startStr || "07:00").split(":").map(Number);
    const [eh, em] = (endStr || "08:15").split(":").map(Number);
    const [lh, lm] = (lateStr || endStr || "08:30").split(":").map(Number);

    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    const lateMin = lh * 60 + lm;

    if (!activeWindow.enabled) {
      return { state: "DISABLED", text: "Session Disabled", color: "bg-gray-100 text-gray-700 border-gray-300" };
    }
    if (istMinutes < startMin) {
      const diff = startMin - istMinutes;
      return {
        state: "UPCOMING",
        text: `Opens in ${diff}m (${startStr} IST)`,
        color: "bg-amber-50 text-amber-900 border-amber-300",
      };
    }
    if (istMinutes <= endMin) {
      const diff = endMin - istMinutes;
      return {
        state: "OPEN",
        text: `On-Time Window Open (${diff}m left)`,
        color: "bg-emerald-100 text-emerald-950 border-emerald-400 ring-2 ring-emerald-400/30",
      };
    }
    if (istMinutes <= lateMin) {
      const diff = lateMin - istMinutes;
      return {
        state: "LATE",
        text: `Late / Grace Period Active (${diff}m left)`,
        color: "bg-amber-100 text-amber-950 border-amber-400 ring-2 ring-amber-400/30",
      };
    }
    return {
      state: "CLOSED",
      text: `Window Closed (Cutoff was ${lateStr} IST)`,
      color: "bg-rose-100 text-rose-950 border-rose-300",
    };
  }, [activeWindow, targetType, currentTimeStr]);

  // Status Change for single member
  const handleStatusChange = (memberId: string, newStatus: AttendanceStatus) => {
    setRoster((prev) =>
      prev.map((m) => {
        if (m.id !== memberId) return m;
        const currentIso = new Date().toISOString();
        const checkIn =
          newStatus === "PRESENT" || newStatus === "LATE"
            ? m.checkInTime || currentIso
            : null;
        return {
          ...m,
          status: newStatus,
          checkInTime: checkIn,
        };
      })
    );
    setHasChanges(true);
  };

  // Remarks Change
  const handleRemarksChange = (memberId: string, remarks: string) => {
    setRoster((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, remarks } : m))
    );
    setHasChanges(true);
  };

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    return roster.filter((m) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "UNMARKED" && m.status !== "NOT_MARKED") return false;
        if (statusFilter !== "UNMARKED" && m.status !== statusFilter) return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.identifier?.toLowerCase().includes(q) ||
        m.its?.toLowerCase().includes(q) ||
        m.department?.toLowerCase().includes(q) ||
        m.grade?.toLowerCase().includes(q) ||
        m.section?.toLowerCase().includes(q)
      );
    });
  }, [roster, statusFilter, searchQuery]);

  // Keyboard Hotkey Navigation & Marking
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid hotkeys when typing in search or input fields
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }

      if (filteredRoster.length === 0) return;

      const curr = focusedIndex ?? 0;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min((prev ?? 0) + 1, filteredRoster.length - 1));
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max((prev ?? 0) - 1, 0));
      } else if (["1", "2", "3", "4", "5", "6"].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, AttendanceStatus> = {
          "1": "PRESENT",
          "2": "LATE",
          "3": "ABSENT",
          "4": "MEDICAL",
          "5": "ON_LEAVE",
          "6": "EARLY_DEPARTURE",
        };
        const status = map[e.key];
        const targetMember = filteredRoster[curr];
        if (targetMember && status) {
          handleStatusChange(targetMember.id, status);
          // Auto-advance to next candidate on successful hotkey press
          if (curr < filteredRoster.length - 1) {
            setFocusedIndex(curr + 1);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredRoster, focusedIndex]);

  // Batch mark all
  const handleBatchMarkAll = (status: AttendanceStatus) => {
    setRoster((prev) =>
      prev.map((m) => {
        const matchSearch =
          !searchQuery.trim() ||
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.identifier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.its?.toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchSearch) return m;

        const currentIso = new Date().toISOString();
        const checkIn =
          status === "PRESENT" || status === "LATE"
            ? m.checkInTime || currentIso
            : null;

        return {
          ...m,
          status,
          checkInTime: checkIn,
        };
      })
    );
    setHasChanges(true);
    toast({
      title: `Marked all displayed ${targetType === "STUDENT" ? "students" : "faculty"} as ${status}`,
      variant: "default",
    });
  };

  // Mark unmarked as absent
  const handleMarkUnmarkedAbsent = () => {
    setRoster((prev) =>
      prev.map((m) => {
        if (m.status === "NOT_MARKED" || !m.status) {
          return { ...m, status: "ABSENT", checkInTime: null };
        }
        return m;
      })
    );
    setHasChanges(true);
    toast({ title: "Marked all unmarked as Absent", variant: "warning" });
  };

  // Reset to original
  const handleReset = () => {
    setRoster((prev) =>
      prev.map((m) => ({
        ...m,
        status: m.originalStatus || "NOT_MARKED",
      }))
    );
    setHasChanges(false);
    toast({ title: "Reset changes to original saved state", variant: "default" });
  };

  // Submit manual attendance
  const handleSaveAttendance = async () => {
    try {
      setSaving(true);
      const payloadRecords = roster
        .filter((m) => m.status !== "NOT_MARKED" && Boolean(m.status))
        .map((m) => ({
          id: m.profileId || m.id,
          targetType: m.targetType,
          status: m.status,
          checkInTime: m.checkInTime || undefined,
          remarks: m.remarks || undefined,
        }));

      if (payloadRecords.length === 0) {
        toast({ title: "No attendance entries to save", variant: "warning" });
        setSaving(false);
        return;
      }

      const res = await fetch("/api/attendance/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: selectedScheduleId || undefined,
          date,
          targetType,
          records: payloadRecords,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast({
          title: "Manual Attendance Saved Successfully!",
          description: `Updated ${data.data?.updatedCount || payloadRecords.length} records (${data.data?.updatedStudentCount ?? 0} Talabat, ${data.data?.updatedTeacherCount ?? 0} Faculty). Dual sync complete.`,
          variant: "success",
        });
        setRoster((prev) =>
          prev.map((m) => ({ ...m, originalStatus: m.status }))
        );
        setHasChanges(false);
      } else {
        toast({
          title: "Failed to save manual attendance",
          description: data.error || "An unknown error occurred",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Save manual attendance error:", err);
      toast({ title: "Error submitting attendance", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Status Metrics
  const stats = useMemo(() => {
    const total = roster.length;
    let present = 0;
    let late = 0;
    let absent = 0;
    let medical = 0;
    let onLeave = 0;
    let earlyDep = 0;
    let unmarked = 0;

    for (const m of roster) {
      if (m.status === "PRESENT") present++;
      else if (m.status === "LATE") late++;
      else if (m.status === "ABSENT") absent++;
      else if (m.status === "MEDICAL") medical++;
      else if (m.status === "ON_LEAVE") onLeave++;
      else if (m.status === "EARLY_DEPARTURE") earlyDep++;
      else unmarked++;
    }

    const marked = total - unmarked;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return { total, present, late, absent, medical, onLeave, earlyDep, unmarked, marked, rate };
  }, [roster]);

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-[1500px] mx-auto space-y-6">
      {/* ── Attendance Hub Navigation Tabs (Standardized Across All Attendance Views) ── */}
      <AdminHubTabs
        hubTitle="Attendance & Biometric Center"
        hubDescription="Dedicated separate workspaces for Automated Hikvision Hardware and Manual Classroom Registers."
        tabs={[
          { label: "Hikvision Device Hub", href: "/admin/biometric", icon: Fingerprint, badge: "Automated" },
          { label: "Manual Classroom Register", href: "/admin/manual-attendance", icon: ClipboardCheck, badge: "Active" },
          { label: "Attendance Logs & Verification", href: "/admin/attendance-logs", icon: FileText },
          { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
                  ]}
      />

      {/* ── Header Banner (Fatimi Luxury Emerald & Gold Theme) ── */}
      <div className="relative overflow-hidden rounded-3xl border border-[#d4af37]/40 bg-gradient-to-br from-[#042f24] via-[#094d37] to-[#021f18] p-6 sm:p-8 shadow-[0_12px_36px_rgba(2,44,34,0.35)] text-white">
        <div className="pointer-events-none absolute -right-12 -bottom-12 w-80 h-80 rounded-full bg-[#d4af37]/15 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, #d4af37 1px, transparent 0)", backgroundSize: "28px 28px" }} />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#fff2b2] text-xs font-black tracking-wider uppercase shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-[#fde047] animate-pulse" />
              <span>Dedicated Manual Attendance Engine</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 items-center justify-center shadow-inner">
                <ClipboardCheck className="w-6 h-6 text-emerald-300 stroke-[2]" />
              </span>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-display">
                  Manual Classroom Attendance
                </h1>
                <p className="text-xs text-emerald-100/90 font-medium mt-0.5">
                  Real-time classroom roll call for Talabat &amp; Faculty, tablet mode, and keyboard-accelerated marking with dual cloud sync.
                </p>
              </div>
            </div>

            {/* Sub-Badges & Context Indicators */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-emerald-200 border border-white/15 backdrop-blur-md">
                <CalendarDays className="w-3.5 h-3.5 text-emerald-300" />
                Date: <strong>{date}</strong>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-emerald-200 border border-white/15 backdrop-blur-md">
                <Users className="w-3.5 h-3.5 text-emerald-300" />
                Audience: <strong>{targetType === "ALL" ? "All Users (Talabat & Faculty)" : targetType === "STUDENT" ? "Talabat (Students)" : "Faculty & Staff"}</strong>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 text-emerald-200 border border-white/15 backdrop-blur-md font-mono">
                <Clock className="w-3.5 h-3.5 text-[#fde047]" />
                IST: <strong>{currentTimeStr || "--:--"}</strong>
              </span>

              {hasChanges && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-400 text-slate-950 border border-amber-300 shadow-md animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Unsaved Changes ({stats.marked} marked)
                </span>
              )}
            </div>
          </div>

          {/* Quick Action Control Strip */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Tablet Mode Toggle */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setTabletMode(!tabletMode)}
              className={cn(
                "rounded-xl text-xs font-bold border transition-all h-10 px-4 backdrop-blur-md",
                tabletMode
                  ? "bg-[#d4af37] text-slate-950 border-[#d4af37] shadow-lg font-black"
                  : "bg-white/10 text-white border-white/20 hover:bg-white/20"
              )}
            >
              <Smartphone className="w-4 h-4 mr-1.5" />
              {tabletMode ? "Tablet View (ON)" : "Tablet Kiosk Mode"}
            </Button>

            {/* Reload Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadRoster}
              disabled={loadingRoster}
              className="bg-white/10 text-white border-white/20 hover:bg-white/20 rounded-xl text-xs font-bold h-10 px-3.5 backdrop-blur-md"
            >
              <RefreshCw className={cn("w-4 h-4 mr-1.5", loadingRoster && "animate-spin")} />
              Reload
            </Button>

            {/* Primary Save Button */}
            <Button
              type="button"
              size="sm"
              onClick={handleSaveAttendance}
              disabled={saving || loadingRoster || roster.length === 0}
              className={cn(
                "h-10 px-5 rounded-xl font-black text-xs transition-all shadow-xl flex items-center gap-2",
                hasChanges
                  ? "bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 text-slate-950 ring-2 ring-emerald-300/60 shadow-emerald-900/50 scale-102"
                  : "bg-emerald-700 hover:bg-emerald-600 text-white"
              )}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Syncing Cloud...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {hasChanges ? "Commit & Sync" : "All Saved"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* ── LIVE MANUAL REGISTER WINDOW STATUS STRIP ── */}
      {activeWindow && (
        <div className="p-4 rounded-2xl bg-white border border-gray-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-gray-900 font-display">{activeWindow.name}</span>
                <Badge variant="outline" className="text-[10px] font-extrabold bg-slate-50 text-slate-800 border-slate-300">
                  {activeWindow.windowType === "HIKVISION" ? "Hikvision Hardware" : activeWindow.windowType === "MANUAL" ? "Manual Register" : "Dual Mode"}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 font-mono mt-0.5">
                On-time: <strong>{activeWindow.startTime} &rarr; {activeWindow.endTime} IST</strong>
                {activeWindow.lateEndTime && activeWindow.lateEndTime !== activeWindow.endTime && (
                  <span className="text-amber-700"> &bull; Late till: {activeWindow.lateEndTime} IST</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={cn("px-3.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2", windowTimingStatus.color)}>
              <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
              <span>{windowTimingStatus.text}</span>
            </div>

            <div className="hidden sm:flex items-center gap-1 text-[11px] text-gray-400 font-medium">
              <Keyboard className="w-3.5 h-3.5 text-gray-500" />
              <span>Hotkeys: <strong>1-6</strong> mark, <strong>&uarr;&darr;</strong> move</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter & Setup Control Matrix ── */}
      <Card className="rounded-3xl border-gray-200/90 shadow-sm bg-white overflow-hidden">
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Audience Switcher (3 Pills) */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                Audience Group
              </label>
              <div className="grid grid-cols-3 p-1 rounded-2xl bg-gray-100 border border-gray-200">
                <button
                  type="button"
                  onClick={() => setTargetType("ALL")}
                  className={cn(
                    "py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1",
                    targetType === "ALL"
                      ? "bg-white text-slate-950 shadow-sm border border-slate-300 font-black"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <Users className="w-3.5 h-3.5 text-amber-600" />
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType("STUDENT")}
                  className={cn(
                    "py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1",
                    targetType === "STUDENT"
                      ? "bg-white text-emerald-950 shadow-sm border border-emerald-200/50 font-black"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                  Talabat
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType("TEACHER")}
                  className={cn(
                    "py-1.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1",
                    targetType === "TEACHER"
                      ? "bg-white text-indigo-950 shadow-sm border border-indigo-200/50 font-black"
                      : "text-gray-600 hover:text-gray-900"
                  )}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Faculty
                </button>
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                Attendance Date
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-10 px-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
              />
            </div>

            {/* Schedule Window Selector */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                Timing Window (Manual Session)
              </label>
              <select
                value={selectedScheduleId}
                onChange={(e) => setSelectedScheduleId(e.target.value)}
                className="w-full h-10 px-3.5 rounded-2xl border border-emerald-300 bg-white text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none shadow-xs"
              >
                <option value="">All Schedule Windows</option>
                <optgroup label="📝 Manual Classroom Registers">
                  {scheduledWindows
                    .filter((w) => w.windowType === "MANUAL" || w.windowType === "BOTH" || !w.windowType)
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.startTime} - {w.endTime}) {w.windowType === "MANUAL" ? "[Manual]" : "[Dual]"}
                      </option>
                    ))}
                </optgroup>
                {scheduledWindows.some((w) => w.windowType === "HIKVISION") && (
                  <optgroup label="⚡ Hikvision Hardware Windows">
                    {scheduledWindows
                      .filter((w) => w.windowType === "HIKVISION")
                      .map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.name} ({w.startTime} - {w.endTime}) [Hardware Terminal]
                        </option>
                      ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Class Selector (Students or All) */}
            {targetType !== "TEACHER" && (
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Class / Section
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                >
                  <option value="ALL">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Grade {c.grade}-{c.section})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Department Selector (Faculty or All) */}
            {targetType !== "STUDENT" && (
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                  Department / Role
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                >
                  <option value="ALL">All Departments</option>
                  <option value="Hifz">Hifz Faculty</option>
                  <option value="Academic">Academic Teachers</option>
                  <option value="Admin">Administration</option>
                </select>
              </div>
            )}

            {/* Instant Search Bar */}
            <div>
              <label className="block text-[11px] font-black uppercase tracking-wider text-gray-500 mb-1.5">
                Quick Search
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name, ITS, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-10 pl-9 pr-3.5 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-medium text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Status Metrics & Progress Rate Bar ── */}
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={cn(
              "p-3 rounded-2xl border text-left transition-all",
              statusFilter === "ALL"
                ? "bg-slate-950 text-white border-slate-900 shadow-md ring-2 ring-slate-400/40"
                : "bg-white text-gray-700 border-gray-200/80 hover:bg-slate-50"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-70">Total Roster</p>
            <p className="text-lg font-black mt-0.5">{stats.total}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("PRESENT")}
            className={cn(
              "p-3 rounded-2xl border text-left transition-all",
              statusFilter === "PRESENT"
                ? "bg-emerald-700 text-white border-emerald-600 shadow-md ring-2 ring-emerald-400/40"
                : "bg-emerald-50/50 text-emerald-900 border-emerald-200/70 hover:bg-emerald-100/60"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-75">Present</p>
            <p className="text-lg font-black mt-0.5">{stats.present}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("LATE")}
            className={cn(
              "p-3 rounded-2xl border text-left transition-all",
              statusFilter === "LATE"
                ? "bg-amber-600 text-white border-amber-500 shadow-md ring-2 ring-amber-400/40"
                : "bg-amber-50/50 text-amber-900 border-amber-200/70 hover:bg-amber-100/60"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-75">Late</p>
            <p className="text-lg font-black mt-0.5">{stats.late}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("ABSENT")}
            className={cn(
              "p-3 rounded-2xl border text-left transition-all",
              statusFilter === "ABSENT"
                ? "bg-rose-700 text-white border-rose-600 shadow-md ring-2 ring-rose-400/40"
                : "bg-rose-50/50 text-rose-900 border-rose-200/70 hover:bg-rose-100/60"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-75">Absent</p>
            <p className="text-lg font-black mt-0.5">{stats.absent}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("MEDICAL")}
            className={cn(
              "p-3 rounded-2xl border text-left transition-all",
              statusFilter === "MEDICAL"
                ? "bg-sky-700 text-white border-sky-600 shadow-md ring-2 ring-sky-400/40"
                : "bg-sky-50/50 text-sky-900 border-sky-200/70 hover:bg-sky-100/60"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-75">Medical</p>
            <p className="text-lg font-black mt-0.5">{stats.medical}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("ON_LEAVE")}
            className={cn(
              "p-3 rounded-2xl border text-left transition-all",
              statusFilter === "ON_LEAVE"
                ? "bg-purple-700 text-white border-purple-600 shadow-md ring-2 ring-purple-400/40"
                : "bg-purple-50/50 text-purple-900 border-purple-200/70 hover:bg-purple-100/60"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-75">Excused</p>
            <p className="text-lg font-black mt-0.5">{stats.onLeave}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("EARLY_DEPARTURE")}
            className={cn(
              "p-3 rounded-2xl border text-left transition-all",
              statusFilter === "EARLY_DEPARTURE"
                ? "bg-orange-700 text-white border-orange-600 shadow-md ring-2 ring-orange-400/40"
                : "bg-orange-50/50 text-orange-900 border-orange-200/70 hover:bg-orange-100/60"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-75">Early Dep</p>
            <p className="text-lg font-black mt-0.5">{stats.earlyDep}</p>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter("UNMARKED")}
            className={cn(
              "p-3 rounded-2xl border text-left transition-all",
              statusFilter === "UNMARKED"
                ? "bg-gray-800 text-white border-gray-700 shadow-md ring-2 ring-gray-400/40"
                : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
            )}
          >
            <p className="text-[10px] font-black uppercase tracking-wider opacity-75">Unmarked</p>
            <p className="text-lg font-black mt-0.5">{stats.unmarked}</p>
          </button>
        </div>

        {/* Visual Progress Ratio Bar */}
        {stats.total > 0 && (
          <div className="p-3 rounded-2xl bg-white border border-gray-200 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span>Overall Attendance Rate: <strong className="text-emerald-700 font-mono">{stats.rate}%</strong></span>
              <span className="text-gray-500 font-normal">{stats.marked} of {stats.total} marked ({stats.unmarked} remaining)</span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden flex">
              <div style={{ width: `${(stats.present / stats.total) * 100}%` }} className="h-full bg-emerald-500" title="Present" />
              <div style={{ width: `${(stats.late / stats.total) * 100}%` }} className="h-full bg-amber-400" title="Late" />
              <div style={{ width: `${(stats.medical / stats.total) * 100}%` }} className="h-full bg-sky-500" title="Medical" />
              <div style={{ width: `${(stats.onLeave / stats.total) * 100}%` }} className="h-full bg-purple-500" title="Excused" />
              <div style={{ width: `${(stats.earlyDep / stats.total) * 100}%` }} className="h-full bg-orange-500" title="Early Departure" />
              <div style={{ width: `${(stats.absent / stats.total) * 100}%` }} className="h-full bg-rose-500" title="Absent" />
            </div>
          </div>
        )}
      </div>

      {/* ── Batch Action Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-gray-200/90 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-gray-500 mr-1 flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-500" /> Fast Batch:
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleBatchMarkAll("PRESENT")}
            className="h-8 px-3 rounded-xl bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 text-xs font-bold"
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
            Mark All Present
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleMarkUnmarkedAbsent}
            className="h-8 px-3 rounded-xl bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100 text-xs font-bold"
          >
            <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
            Mark Unmarked Absent
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-8 px-3 rounded-xl bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 text-xs font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1 text-gray-500" />
            Reset State
          </Button>
        </div>

        <div className="text-xs text-gray-500 font-semibold">
          Showing <span className="font-bold text-gray-900">{filteredRoster.length}</span> of {roster.length} members
        </div>
      </div>

      {/* ── Roster Member Grid / Cards ── */}
      {loadingRoster ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-gray-200 shadow-sm flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm font-bold text-gray-700">Loading Candidate Roster...</p>
        </div>
      ) : filteredRoster.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white border border-gray-200 shadow-sm flex flex-col items-center justify-center space-y-2">
          <ClipboardCheck className="w-10 h-10 text-gray-300" />
          <p className="text-sm font-bold text-gray-700">No candidates match your current filter.</p>
          <p className="text-xs text-gray-500">Try adjusting the search query, class selector, or status filter.</p>
        </div>
      ) : (
        <div
          className={cn(
            "grid gap-3.5",
            tabletMode
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3"
          )}
        >
          {filteredRoster.map((member, idx) => {
            const isMarked = member.status !== "NOT_MARKED" && Boolean(member.status);
            const isFocused = focusedIndex === idx;

            return (
              <motion.div
                key={member.id}
                layout
                onClick={() => setFocusedIndex(idx)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(idx * 0.015, 0.2) }}
                className={cn(
                  "p-4 rounded-3xl border transition-all duration-200 bg-white shadow-xs relative flex flex-col justify-between cursor-pointer",
                  isFocused && "ring-2 ring-emerald-500 border-emerald-400 shadow-md",
                  isMarked
                    ? "border-gray-200/90 hover:border-emerald-400 hover:shadow-md"
                    : "border-amber-300/80 bg-amber-50/20 hover:border-amber-400"
                )}
              >
                {/* Header: Avatar, Name & Identifiers */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-12 h-12 rounded-2xl border-2 border-emerald-100 shadow-2xs shrink-0">
                      {member.avatarUrl && (
                        <AvatarImage src={member.avatarUrl} alt={member.name} className="object-cover" />
                      )}
                      <AvatarFallback className={cn(
                        "font-black text-xs text-white",
                        member.targetType === "TEACHER" ? "bg-gradient-to-br from-indigo-800 to-purple-900" : "bg-gradient-to-br from-emerald-800 to-teal-900"
                      )}>
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-sm font-black text-gray-900 truncate font-display">
                          {member.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[9px] font-extrabold px-2 py-0.5 rounded-full border",
                            member.targetType === "TEACHER"
                              ? "bg-indigo-50 text-indigo-800 border-indigo-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          )}
                        >
                          {member.targetType === "TEACHER" ? "Faculty" : "Talabat"}
                        </Badge>
                      </div>

                      {/* Prominent ITS Badge & Info */}
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-50 text-amber-950 border border-amber-300 text-[11px] font-mono font-black shadow-2xs">
                          ITS: {member.its || member.identifier || "—"}
                        </span>
                        {member.grade && (
                          <span className="text-[11px] text-gray-600 font-semibold">
                            Grade {member.grade}-{member.section}
                          </span>
                        )}
                        {member.department && (
                          <span className="text-[11px] text-indigo-700 font-semibold truncate max-w-[120px]">
                            {member.department}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Current Status Badge */}
                  <div>
                    {member.status && member.status !== "NOT_MARKED" ? (
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs",
                          STATUS_BUTTONS.find((b) => b.key === member.status)?.badgeBg || "bg-gray-100 text-gray-800"
                        )}
                      >
                        {member.status}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Status Selector Button Strip with Hotkey hints */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mt-4">
                  {STATUS_BUTTONS.map((btn) => {
                    const isSelected = member.status === btn.key;
                    const Icon = btn.icon;
                    return (
                      <button
                        key={btn.key}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusChange(member.id, btn.key);
                          setFocusedIndex(idx);
                        }}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-2xl text-[11px] font-extrabold border transition-all duration-150 select-none active:scale-95 relative",
                          tabletMode ? "py-3 text-xs" : "py-2",
                          isSelected
                            ? btn.activeColor
                            : cn("bg-gray-50/70 text-gray-700 border-gray-200/80", btn.hoverColor)
                        )}
                      >
                        <span className="absolute top-1 right-1 text-[8px] opacity-40 font-mono font-bold">
                          {btn.hotkey}
                        </span>
                        <Icon className={cn("w-3.5 h-3.5 mb-1 shrink-0", isSelected ? "text-white" : "text-gray-500")} />
                        <span className="leading-tight">{btn.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Optional Remarks Input */}
                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add remark / reason..."
                    value={member.remarks || ""}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => handleRemarksChange(member.id, e.target.value)}
                    className="w-full h-8 px-2.5 text-[11px] font-medium rounded-xl border border-gray-200 bg-gray-50/40 text-gray-800 placeholder:text-gray-400 focus:bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 transition-all outline-none"
                  />
                  {member.source && (
                    <Badge variant="outline" className="text-[9px] font-mono text-gray-400 shrink-0 uppercase px-1.5 py-0.5">
                      {member.source}
                    </Badge>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Floating Sticky Save Bar (when changes are made) ── */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-[650px] p-3.5 rounded-3xl bg-slate-950/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl text-white flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate font-display">
                  Unsaved Attendance Changes
                </p>
                <p className="text-[11px] text-emerald-200/75 truncate">
                  Ready to commit {stats.marked} marks to registry &amp; live audit log
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded-xl h-9"
              >
                Discard
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSaveAttendance}
                disabled={saving}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-2xl h-9 px-4 shadow-md flex items-center gap-1.5"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Save Now
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
