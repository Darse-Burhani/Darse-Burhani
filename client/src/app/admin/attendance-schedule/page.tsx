"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Sparkles,
  Loader2,
  RefreshCw,
  X,
  FileSpreadsheet,
  FileText,
  Timer,
  Fingerprint,
  Mail,
  Radio,
  Zap,
  Volume2,
  Bell,
  GraduationCap,
  ClipboardCheck,
  Users,
  Shield,
  Layers,
  Search,
  Check,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Activity,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import {
  playSmoothChime,
  requestDesktopNotificationPermission,
  sendDesktopNotification,
} from "@/lib/notification-sound";
import { cn } from "@/lib/utils";

interface ScanWindow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  lateEndTime?: string | null;
  graceMinutes: number;
  enabled: boolean;
  status: "ACTIVE" | "GRACE_PERIOD" | "UPCOMING" | "CLOSED";
  phase?: "ON_TIME" | "LATE" | null;
  durationMinutes: number;
  onTimeMinutes?: number;
  audience?: "ALL_STUDENTS" | "FACULTY" | "BOTH";
  hasFacultyTimer?: boolean;
  facultyStartTime?: string | null;
  facultyEndTime?: string | null;
  facultyLateEndTime?: string | null;
  facultyEnabled?: boolean;
  facultyStatus?: "ACTIVE" | "UPCOMING" | "CLOSED" | "NONE";
  applicableClassIds?: string[];
  applicableTeacherIds?: string[];
  exemptStudentIds?: string[];
  exemptTeacherIds?: string[];
  applicableClasses?: Array<{ id: string; name: string; grade: string; section: string }>;
  applicableTeachers?: Array<{ id: string; name: string }>;
  windowType?: "HIKVISION" | "MANUAL" | "BOTH";
  createdAt: string;
  updatedAt: string;
}

interface ClassItem {
  id: string;
  name: string;
  grade: string;
  section: string;
  subject: string;
  teacherName: string;
}

interface TeacherItem {
  id: string;
  name: string;
  email: string;
  department?: string;
}

/**
 * Visual Color-Coded Schedule Timeline Bar
 */
function ScheduleTimelineBar({
  startTime,
  endTime,
  lateEndTime,
  accent = "emerald",
  isManual = false,
}: {
  startTime: string;
  endTime: string;
  lateEndTime?: string | null;
  accent?: "emerald" | "indigo" | "purple" | "blue";
  isManual?: boolean;
}) {
  const parseMin = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const sMin = parseMin(startTime);
  const eMin = parseMin(endTime);
  const lMin = !isManual && lateEndTime ? parseMin(lateEndTime) : eMin;

  const onTimeDur = Math.max(0, eMin - sMin);
  const lateDur = isManual ? 0 : Math.max(0, lMin - eMin);
  const totalSpan = Math.max(1, isManual ? eMin - sMin : onTimeDur + lateDur);

  const onTimePct = isManual ? 100 : Math.round((onTimeDur / totalSpan) * 100);
  const latePct = isManual ? 0 : Math.round((lateDur / totalSpan) * 100);

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isCurrentlyActive = nowMin >= sMin && nowMin <= (isManual ? eMin : lMin);

  const gradientClass =
    accent === "purple"
      ? "bg-gradient-to-r from-purple-500 to-indigo-600"
      : accent === "blue"
      ? "bg-gradient-to-r from-blue-500 to-indigo-600"
      : accent === "indigo"
      ? "bg-gradient-to-r from-indigo-500 to-indigo-600"
      : "bg-gradient-to-r from-emerald-500 to-teal-500";

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500">
        <span className="flex items-center gap-1 font-mono text-gray-700">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              accent === "purple"
                ? "bg-purple-600"
                : accent === "blue"
                ? "bg-blue-600"
                : accent === "indigo"
                ? "bg-indigo-600"
                : "bg-emerald-600"
            }`}
          />
          {startTime}
        </span>
        <span className="flex items-center gap-1 font-mono text-gray-700">
          {isManual ? endTime : lateEndTime || endTime}
        </span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden flex shadow-inner border border-gray-200/50">
        <div
          style={{ width: `${onTimePct}%` }}
          className={`h-full ${gradientClass} transition-all duration-500`}
          title={isManual ? `Live Marking Window: ${totalSpan} min` : `On-Time: ${onTimeDur} min`}
        />
        {!isManual && lateDur > 0 && (
          <div
            style={{ width: `${latePct}%` }}
            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
            title={`Late Allowed: ${lateDur} min`}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-[9px] text-gray-500 font-medium">
        <span>{isManual ? `${totalSpan}m Live Marking Window` : `${onTimeDur}m On-Time Window`}</span>
        {!isManual && lateDur > 0 && <span className="text-amber-700 font-bold">{lateDur}m Late Grace</span>}
        {isCurrentlyActive && (
          <span className="text-emerald-700 font-black animate-pulse flex items-center gap-0.5">
            ● Live Now
          </span>
        )}
      </div>
    </div>
  );
}

export default function AdminAttendanceSchedulePage() {
  const [activeTab, setActiveTab] = useState<"HIKVISION" | "MANUAL">("HIKVISION");
  const [audienceFilter, setAudienceFilter] = useState<"ALL" | "STUDENT" | "TEACHER" | "BOTH">("ALL");
  const [loading, setLoading] = useState(true);

  // Scan Windows state
  const [windows, setWindows] = useState<ScanWindow[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [windowModalOpen, setWindowModalOpen] = useState(false);
  const [editingWindow, setEditingWindow] = useState<ScanWindow | null>(null);

  // Form State
  const [windowForm, setWindowForm] = useState({
    name: "",
    windowType: "HIKVISION" as "HIKVISION" | "MANUAL" | "BOTH",
    audience: "BOTH" as "STUDENT" | "TEACHER" | "BOTH",
    startTime: "07:35",
    endTime: "07:50",
    lateEndTime: "08:30",
    graceMinutes: 10,
    enabled: true,
    applicableClassIds: [] as string[],
    useCustomFacultyTime: true,
    facultyStartTime: "07:35",
    facultyEndTime: "08:03",
    facultyLateEndTime: "08:30",
    applicableTeacherIds: [] as string[],
  });

  const [modalTab, setModalTab] = useState<"basics" | "timing" | "scope">("basics");
  const [classFilterQuery, setClassFilterQuery] = useState("");
  const [teacherFilterQuery, setTeacherFilterQuery] = useState("");

  const addMinutesToTime = (timeStr: string, minsToAdd: number) => {
    if (!timeStr) return "08:00";
    const [h, m] = timeStr.split(":").map(Number);
    const total = (h || 0) * 60 + (m || 0) + minsToAdd;
    const newH = Math.floor(total / 60) % 24;
    const newM = total % 60;
    return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
  };

  const [savingWindow, setSavingWindow] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Download export state
  const [exporting, setExporting] = useState(false);

  // Sound audition test state
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [desktopNotifState, setDesktopNotifState] = useState<NotificationPermission>("default");

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setDesktopNotifState(Notification.permission);
    }
  }, []);

  // Fetch Attendance Windows
  const fetchWindows = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/attendance/schedule/windows");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setWindows(json.data);
        }
      }
    } catch {
      toast({ title: "Failed to load attendance windows", variant: "destructive" });
    }
  }, []);

  // Fetch Class Directory & Faculty Directory
  const fetchClassesAndTeachers = useCallback(async () => {
    try {
      const [classRes, teacherRes] = await Promise.all([
        fetch("/api/admin/attendance/schedule/classes").then((r) => r.json()),
        fetch("/api/admin/attendance/schedule/teachers").then((r) => r.json()),
      ]);

      if (classRes.success && classRes.data?.classes) {
        setClasses(classRes.data.classes || []);
      }
      if (teacherRes.success && Array.isArray(teacherRes.data)) {
        setTeachers(teacherRes.data);
      }
    } catch {
      // silent fallback
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      await Promise.allSettled([fetchWindows(), fetchClassesAndTeachers()]);
    } finally {
      setLoading(false);
    }
  }, [fetchWindows, fetchClassesAndTeachers]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter windows by Tab and Audience Filter
  const filteredWindows = useMemo(() => {
    let list = windows;

    // Subsystem filter
    if (activeTab === "HIKVISION") {
      list = list.filter(
        (w) =>
          w.windowType === "HIKVISION" ||
          w.windowType === "BOTH" ||
          w.id === "default" ||
          w.id.startsWith("hik_")
      );
    } else {
      list = list.filter(
        (w) =>
          w.windowType === "MANUAL" ||
          w.windowType === "BOTH" ||
          w.id.startsWith("manual_")
      );
    }

    // Audience filter (handles FACULTY, BOTH, and ALL_STUDENTS)
    if (audienceFilter === "STUDENT") {
      list = list.filter((w) => {
        const isFaculty = w.audience === "FACULTY" || (w.exemptStudentIds || []).includes("AUDIENCE_FACULTY");
        const isDual = !isFaculty && (w.audience === "BOTH" || (w.exemptStudentIds || []).includes("AUDIENCE_BOTH") || (Boolean(w.facultyStartTime && w.facultyEndTime) && (w.audience as any) !== "ALL_STUDENTS"));
        return !isFaculty && !isDual;
      });
    } else if (audienceFilter === "TEACHER") {
      list = list.filter((w) => w.audience === "FACULTY" || (w.exemptStudentIds || []).includes("AUDIENCE_FACULTY"));
    } else if (audienceFilter === "BOTH") {
      list = list.filter((w) => {
        const isFaculty = w.audience === "FACULTY" || (w.exemptStudentIds || []).includes("AUDIENCE_FACULTY");
        return !isFaculty && (w.audience === "BOTH" || (w.exemptStudentIds || []).includes("AUDIENCE_BOTH") || (Boolean(w.facultyStartTime && w.facultyEndTime) && (w.audience as any) !== "ALL_STUDENTS"));
      });
    }

    return list;
  }, [windows, activeTab, audienceFilter]);

  // Open modal to create/edit window
  const openWindowModal = (
    w?: ScanWindow,
    presetWindowType?: "HIKVISION" | "MANUAL" | "BOTH"
  ) => {
    if (w) {
      setEditingWindow(w);
      const isFacultyOnly = w.audience === "FACULTY" || (w.exemptStudentIds || []).includes("AUDIENCE_FACULTY");
      const isDual = !isFacultyOnly && (w.audience === "BOTH" || (w.exemptStudentIds || []).includes("AUDIENCE_BOTH") || (Boolean(w.facultyStartTime && w.facultyEndTime) && (w.audience as any) !== "ALL_STUDENTS"));
      const initialAudience = isFacultyOnly ? "TEACHER" : isDual ? "BOTH" : "STUDENT";
      const hasSeparateFacultyTime = Boolean(
        w.facultyStartTime &&
          (w.facultyStartTime !== w.startTime || w.facultyEndTime !== w.endTime)
      );

      setWindowForm({
        name: w.name,
        windowType: (w.windowType as any) || presetWindowType || activeTab,
        audience: initialAudience,
        startTime: w.startTime,
        endTime: w.endTime,
        lateEndTime: w.lateEndTime ?? w.endTime,
        graceMinutes: w.graceMinutes,
        enabled: w.enabled,
        applicableClassIds: w.applicableClassIds || [],
        useCustomFacultyTime: hasSeparateFacultyTime,
        facultyStartTime: w.facultyStartTime || w.startTime,
        facultyEndTime: w.facultyEndTime || w.endTime,
        facultyLateEndTime: w.facultyLateEndTime || w.lateEndTime || w.endTime,
        applicableTeacherIds: w.applicableTeacherIds || [],
      });
    } else {
      setEditingWindow(null);
      const chosenType = presetWindowType || activeTab;
      const defaultName =
        chosenType === "HIKVISION"
          ? "Hikvision Morning Punch Window"
          : chosenType === "MANUAL"
          ? "Classroom Roll Call Window"
          : "Tilawat al Dua Window";

      setWindowForm({
        name: defaultName,
        windowType: chosenType,
        audience: "BOTH",
        startTime: "07:35",
        endTime: "07:50",
        lateEndTime: "08:30",
        graceMinutes: 10,
        enabled: true,
        applicableClassIds: [],
        useCustomFacultyTime: true,
        facultyStartTime: "07:35",
        facultyEndTime: "08:03",
        facultyLateEndTime: "08:30",
        applicableTeacherIds: [],
      });
    }
    setModalTab("basics");
    setClassFilterQuery("");
    setTeacherFilterQuery("");
    setWindowModalOpen(true);
  };

  // Save window
  const saveWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!windowForm.name.trim()) {
      toast({ title: "Please enter attendance schedule name", variant: "destructive" });
      return;
    }

    setSavingWindow(true);
    try {
      const url = editingWindow
        ? `/api/admin/attendance/schedule/windows/${editingWindow.id}`
        : "/api/admin/attendance/schedule/windows";
      const method = editingWindow ? "PUT" : "POST";

      const isManual = windowForm.windowType === "MANUAL";
      const payload: Record<string, any> = {
        name: windowForm.name.trim(),
        windowType: windowForm.windowType,
        startTime: windowForm.startTime,
        endTime: windowForm.endTime,
        lateEndTime: isManual ? windowForm.endTime : (windowForm.lateEndTime || windowForm.endTime),
        graceMinutes: isManual ? 0 : windowForm.graceMinutes,
        enabled: windowForm.enabled,
      };

      if (windowForm.audience === "STUDENT") {
        payload.audience = "ALL_STUDENTS";
        payload.applicableClassIds = windowForm.applicableClassIds;
        payload.facultyStartTime = null;
        payload.facultyEndTime = null;
        payload.facultyLateEndTime = null;
        payload.applicableTeacherIds = [];
      } else if (windowForm.audience === "TEACHER") {
        payload.audience = "FACULTY";
        payload.applicableClassIds = [];
        payload.facultyStartTime = windowForm.startTime;
        payload.facultyEndTime = windowForm.endTime;
        payload.facultyLateEndTime = isManual ? windowForm.endTime : (windowForm.lateEndTime || windowForm.endTime);
        payload.applicableTeacherIds = windowForm.applicableTeacherIds;
      } else {
        // BOTH (Talabat & Faculty)
        payload.audience = "BOTH";
        payload.applicableClassIds = windowForm.applicableClassIds;
        payload.applicableTeacherIds = windowForm.applicableTeacherIds;
        if (!isManual && windowForm.useCustomFacultyTime) {
          payload.facultyStartTime = windowForm.facultyStartTime;
          payload.facultyEndTime = windowForm.facultyEndTime;
          payload.facultyLateEndTime = windowForm.facultyLateEndTime || windowForm.facultyEndTime;
        } else {
          payload.facultyStartTime = windowForm.startTime;
          payload.facultyEndTime = windowForm.endTime;
          payload.facultyLateEndTime = isManual ? windowForm.endTime : (windowForm.lateEndTime || windowForm.endTime);
        }
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: editingWindow ? "Schedule Updated" : "Schedule Created",
          description: `Attendance schedule "${windowForm.name}" is now live.`,
          variant: "success",
        });
        setWindowModalOpen(false);
        fetchWindows();
      } else {
        toast({ title: json.error || "Failed to save schedule window", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save schedule window", variant: "destructive" });
    } finally {
      setSavingWindow(false);
    }
  };

  // Toggle active/inactive state
  const toggleWindowActive = async (w: ScanWindow) => {
    try {
      const nextState = !w.enabled;
      const res = await fetch(`/api/admin/attendance/schedule/windows/${w.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...w, enabled: nextState }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: nextState ? "Schedule Window Enabled" : "Schedule Window Disabled",
          description: `Attendance schedule "${w.name}" is now ${nextState ? "active" : "inactive"}.`,
          variant: "success",
        });
        fetchWindows();
      }
    } catch {
      toast({ title: "Failed to update window state", variant: "destructive" });
    }
  };

  // Delete window
  const deleteWindow = async (id: string) => {
    if (!confirm("Are you sure you want to delete this attendance scan schedule?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/attendance/schedule/windows/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Schedule Window Deleted", variant: "success" });
        fetchWindows();
      } else {
        toast({ title: json.error || "Failed to delete window", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete schedule window", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // Download as CSV / Excel Sheet
  const downloadExcel = async () => {
    setExporting(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const url = `/api/admin/attendance/schedule/export?type=ROSTER&date=${todayStr}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `Attendance_Schedule_${todayStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Excel Sheet Downloaded",
        description: "Successfully exported attendance schedule spreadsheet.",
        variant: "success",
      });
    } catch {
      toast({ title: "Failed to download spreadsheet", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Attendance Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Attendance & Biometric Center"
        hubDescription="Dedicated separate schedule workspaces for Automated Hikvision Hardware and Manual Classroom Registers."
        tabs={[
          { label: "Hikvision Scans", href: "/admin/attendance-hik", icon: Fingerprint, badge: "Hardware" },
          { label: "Manual Logs", href: "/admin/attendance-manual", icon: ClipboardCheck, badge: "Register" },
          { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
          { label: "Device Hub", href: "/admin/biometric", icon: Activity },
          { label: "Google Sheets", href: "/admin/google-sheets", icon: FileSpreadsheet, badge: "Sync" },
          { label: "Email Reports", href: "/admin/attendance-emails", icon: Mail },
        ]}
      />

      {/* ── Page Header Banner ── */}
      <div className="relative rounded-3xl p-6 sm:p-8 overflow-hidden bg-gradient-to-br from-[#0d0d0d] via-[#1c1c1c] to-[#0d0d0d] border border-[#d4af37]/40 shadow-[0_12px_36px_rgba(2,44,34,0.35)]">
        <div className="absolute -right-12 -bottom-12 w-80 h-80 rounded-full bg-[#d4af37]/15 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Clock className="w-40 h-40 text-white stroke-[1.2]" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#fff2b2] text-xs font-black tracking-wider uppercase mb-3 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-[#fde047] animate-pulse" />
              <span>Scanning Scope: Talabat &amp; Faculty</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white font-display tracking-tight">
              Attendance Schedule &amp; Timing
            </h1>
            <p className="text-emerald-100/90 text-sm mt-1.5 max-w-2xl font-medium leading-relaxed">
              Configure scanning windows for <strong>Talabat (Students)</strong>, <strong>Faculty (Teachers &amp; Staff)</strong>, or <strong>Dual (Both)</strong> with automated gate shifts and manual roll call registers.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadExcel}
              disabled={exporting}
              className="h-10 px-4 rounded-xl border-white/20 bg-white/10 hover:bg-white/20 text-white font-bold text-xs backdrop-blur-sm transition-all active:scale-95 shadow-xs"
            >
              {exporting ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-300" />}
              <span>Export Schedule CSV</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => openWindowModal()}
              className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-emerald-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95 flex items-center gap-1.5 border border-amber-300/40"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Schedule Window</span>
            </Button>
          </div>
        </div>
      </div>

      {/* ── Subsystem Mode Tabs (Hikvision Hardware vs Manual Register) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-2 bg-white rounded-3xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 p-1 bg-gray-100/80 rounded-2xl border border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab("HIKVISION")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
              activeTab === "HIKVISION"
                ? "bg-purple-900 text-white shadow-md shadow-purple-950/20"
                : "text-gray-600 hover:text-purple-900 hover:bg-white/60"
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>Hikvision Hardware Gate</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("MANUAL")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
              activeTab === "MANUAL"
                ? "bg-emerald-800 text-white shadow-md shadow-emerald-950/20"
                : "text-gray-600 hover:text-emerald-900 hover:bg-white/60"
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Manual Roll Call Register</span>
          </button>
        </div>

        {/* Audience Filter Pills */}
        <div className="flex items-center gap-1.5 px-2">
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mr-1">Audience:</span>
          {[
            { id: "ALL", label: "All Schedules", icon: Layers, activeCls: "bg-slate-900 text-white border-slate-900 shadow-sm" },
            { id: "STUDENT", label: "Talabat Only", icon: GraduationCap, activeCls: "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/25" },
            { id: "TEACHER", label: "Faculty Only", icon: Shield, activeCls: "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/25" },
            { id: "BOTH", label: "Dual (Both)", icon: Zap, activeCls: "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-500/25" },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setAudienceFilter(pill.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                audienceFilter === pill.id
                  ? pill.activeCls
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              <pill.icon className="w-3.5 h-3.5" />
              <span>{pill.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── SCHEDULE CARDS GRID ── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-emerald-800" />
            <h2 className="text-base font-bold text-gray-900">
              {activeTab === "HIKVISION" ? "Biometric Scanning Windows" : "Classroom Register Schedules"} ({filteredWindows.length})
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={fetchWindows}
            className="text-xs text-gray-600 hover:text-gray-900"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </div>

        {filteredWindows.length === 0 ? (
          <Card className="p-8 text-center bg-gray-50/50 border-dashed border-2 border-gray-200 rounded-3xl">
            <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-gray-800">No attendance windows found</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              No schedule matches the current subsystem &amp; audience filter. Create a new window to open scanning shifts.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => openWindowModal()}
              className="mt-4 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Add Schedule Window
            </Button>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredWindows.map((w) => {
              const isLive = w.status === "ACTIVE" || w.status === "GRACE_PERIOD";
              const isFaculty = w.audience === "FACULTY";
              const isDual = w.audience === "BOTH" || w.hasFacultyTimer;

              const theme = isFaculty
                ? {
                    stripe: "bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-500",
                    borderActive: "border-blue-500/80 ring-2 ring-blue-500/20 shadow-blue-500/10",
                    borderDefault: "border-blue-200/80 hover:border-blue-400 bg-blue-50/5",
                    iconBox: "bg-blue-100 text-blue-800 border border-blue-200",
                    badge: "bg-blue-50 text-blue-800 border-blue-200",
                    badgeIcon: "text-blue-600",
                    badgeLabel: "Faculty Only (Staff)",
                    timeBoxIcon: "text-blue-800",
                    timeBoxLabel: "Faculty Shift Timing",
                    toggleActive: "bg-blue-600 shadow-sm",
                    liveDot: "bg-blue-500",
                    livePing: "bg-blue-400",
                    livePill: "bg-blue-50 text-blue-900 border-blue-300",
                    timerIcon: "text-blue-600",
                    accent: "blue" as const,
                  }
                : isDual
                ? {
                    stripe: "bg-gradient-to-r from-purple-700 via-indigo-600 to-pink-500",
                    borderActive: "border-purple-500/80 ring-2 ring-purple-500/20 shadow-purple-500/10",
                    borderDefault: "border-purple-200/80 hover:border-purple-400 bg-purple-50/5",
                    iconBox: "bg-purple-100 text-purple-800 border border-purple-200",
                    badge: "bg-purple-50 text-purple-800 border-purple-200",
                    badgeIcon: "text-purple-600",
                    badgeLabel: "Dual: Talabat & Faculty",
                    timeBoxIcon: "text-purple-800",
                    timeBoxLabel: "Unified Gate Timing",
                    toggleActive: "bg-purple-600 shadow-sm",
                    liveDot: "bg-purple-500",
                    livePing: "bg-purple-400",
                    livePill: "bg-purple-50 text-purple-900 border-purple-300",
                    timerIcon: "text-purple-600",
                    accent: "purple" as const,
                  }
                : {
                    stripe: "bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-400",
                    borderActive: "border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-emerald-500/10",
                    borderDefault: "border-emerald-200/80 hover:border-emerald-400 bg-emerald-50/5",
                    iconBox: "bg-emerald-100 text-emerald-800 border border-emerald-200",
                    badge: "bg-emerald-50 text-emerald-800 border-emerald-200",
                    badgeIcon: "text-emerald-600",
                    badgeLabel: "Talabat Only (Students)",
                    timeBoxIcon: "text-emerald-800",
                    timeBoxLabel: w.windowType === "MANUAL" ? "Live Marking Window" : "Student Timing",
                    toggleActive: "bg-emerald-600 shadow-sm",
                    liveDot: "bg-emerald-500",
                    livePing: "bg-emerald-400",
                    livePill: "bg-emerald-50 text-emerald-900 border-emerald-300",
                    timerIcon: "text-emerald-600",
                    accent: "emerald" as const,
                  };

              return (
                <Card
                  key={w.id}
                  className={`group relative overflow-hidden transition-all duration-300 rounded-3xl border bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 ${
                    w.enabled
                      ? isLive
                        ? theme.borderActive
                        : theme.borderDefault
                      : "opacity-60 bg-gray-50/80 border-gray-200"
                  }`}
                >
                  <div
                    className={`h-2.5 w-full ${
                      !w.enabled ? "bg-gray-300" : theme.stripe
                    }`}
                  />
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 ${
                          theme.iconBox
                        }`}
                      >
                        {isFaculty ? (
                          <Shield className="w-5 h-5" />
                        ) : isDual ? (
                          <Zap className="w-5 h-5" />
                        ) : (
                          <GraduationCap className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {isLive && (
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.livePing}`}></span>
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${theme.liveDot}`}></span>
                            </span>
                          )}
                          <h3 className="font-bold text-base text-gray-900 leading-tight truncate">{w.name}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {/* Audience Badge */}
                          <Badge variant="outline" className={`${theme.badge} text-[10px] font-black flex items-center gap-1 py-0.5 px-2`}>
                            {isFaculty ? (
                              <Shield className={`w-2.5 h-2.5 ${theme.badgeIcon}`} />
                            ) : isDual ? (
                              <Zap className={`w-2.5 h-2.5 ${theme.badgeIcon}`} />
                            ) : (
                              <GraduationCap className={`w-2.5 h-2.5 ${theme.badgeIcon}`} />
                            )}
                            <span>{theme.badgeLabel}</span>
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100 shrink-0">
                      <button
                        type="button"
                        onClick={() => openWindowModal(w)}
                        className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all active:scale-90"
                        title="Edit Schedule"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWindow(w.id)}
                        disabled={deletingId === w.id}
                        className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-90 disabled:opacity-30"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3.5">
                    {/* Time Display */}
                    <div className="p-3.5 bg-gray-50/80 rounded-2xl border border-gray-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-xl bg-white flex items-center justify-center shadow-2xs border border-gray-200/60 ${theme.timeBoxIcon}`}>
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                            {theme.timeBoxLabel}
                          </p>
                          <p className="text-sm font-black text-gray-900 font-mono">
                            {w.startTime} &rarr; {w.endTime}
                          </p>
                          {w.windowType !== "MANUAL" && w.lateEndTime && w.lateEndTime !== w.endTime && (
                            <p className="text-xs font-bold text-amber-700 font-mono">
                              Late Cutoff: {w.lateEndTime}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Span</p>
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-800 font-mono">
                          {w.durationMinutes}m {w.windowType === "MANUAL" ? "Live" : ""}
                        </span>
                      </div>
                    </div>

                    {/* Faculty Timing details if Dual and not manual */}
                    {w.windowType !== "MANUAL" && isDual && w.facultyStartTime && (
                      <div className="p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 flex items-center justify-between text-xs">
                        <span className="font-bold text-purple-900 flex items-center gap-1.5">
                          <Shield className="w-3.5 h-3.5 text-purple-600" />
                          Faculty Shift:
                        </span>
                        <span className="font-mono font-bold text-purple-950">
                          {w.facultyStartTime} – {w.facultyEndTime}
                          {w.facultyLateEndTime && w.facultyLateEndTime !== w.facultyEndTime && ` (Late: ${w.facultyLateEndTime})`}
                        </span>
                      </div>
                    )}

                    {/* Faculty Scanning Eligibility Scope */}
                    {(isFaculty || isDual || (w.applicableTeacherIds && w.applicableTeacherIds.length > 0)) && (
                      <div className="p-2.5 rounded-xl bg-blue-50/70 border border-blue-200/80 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-blue-950 flex items-center gap-1.5">
                            <Shield className="w-3.5 h-3.5 text-blue-700" />
                            Faculty Scope:
                          </span>
                          {(!w.applicableTeacherIds || w.applicableTeacherIds.length === 0) ? (
                            <Badge variant="outline" className="bg-white text-blue-800 border-blue-300 font-bold text-[10px]">
                              All Faculty Eligible
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-700 text-white font-bold text-[10px]">
                              {w.applicableTeacherIds.length} Eligible Faculty Selected
                            </Badge>
                          )}
                        </div>
                        {w.applicableTeacherIds && w.applicableTeacherIds.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-[11px] text-blue-900 font-medium leading-tight">
                              Only selected faculty eligible for scanning. Un-eligible faculty will <strong className="text-blue-950">never be marked absent</strong>.
                            </p>
                            {w.applicableTeachers && w.applicableTeachers.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {w.applicableTeachers.slice(0, 4).map((t) => (
                                  <span key={t.id} className="text-[10px] bg-white border border-blue-200 text-blue-900 font-semibold px-2 py-0.5 rounded-md">
                                    {t.name}
                                  </span>
                                ))}
                                {w.applicableTeachers.length > 4 && (
                                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-md">
                                    +{w.applicableTeachers.length - 4} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-blue-700 font-medium">
                            All active faculty eligible for scanning during this schedule.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Timeline Bar */}
                    <ScheduleTimelineBar
                      startTime={w.startTime}
                      endTime={w.endTime}
                      lateEndTime={w.lateEndTime}
                      accent={theme.accent}
                      isManual={w.windowType === "MANUAL"}
                    />

                    {/* Grace Period & Live Status */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Timer className={`w-4 h-4 ${theme.timerIcon}`} />
                        <span>
                          {w.windowType === "MANUAL" ? (
                            <strong className="text-emerald-800">Live Marking Window</strong>
                          ) : (
                            <>
                              Grace: <strong>{w.graceMinutes} min</strong>
                            </>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shadow-2xs ${
                            !w.enabled
                              ? "bg-gray-100 text-gray-600 border-gray-300"
                              : isLive
                              ? theme.livePill
                              : "bg-amber-50 text-amber-900 border-amber-300"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              !w.enabled ? "bg-gray-400" : isLive ? `${theme.liveDot} animate-pulse` : "bg-amber-500"
                            }`}
                          />
                          {!w.enabled ? "Disabled" : isLive ? "Active Live" : "Closed"}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleWindowActive(w)}
                          aria-label="Toggle window active state"
                          className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ease-out select-none active:scale-95 ${
                            w.enabled ? theme.toggleActive : "bg-gray-300"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${
                              w.enabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL: Create / Edit Attendance Window (Redesigned) ── */}
      <AnimatePresence>
        {windowModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className={`w-full max-w-3xl max-h-[92vh] bg-white rounded-3xl shadow-[0_24px_70px_rgba(0,0,0,0.45)] border flex flex-col overflow-hidden transition-all duration-300 ${
                windowForm.audience === "TEACHER"
                  ? "border-blue-500/40"
                  : windowForm.audience === "BOTH"
                  ? "border-purple-500/40"
                  : "border-emerald-500/40"
              }`}
            >
              {/* 1. Modal Hero Header */}
              {(() => {
                const aud = windowForm.audience;
                const isFormFaculty = aud === "TEACHER";
                const isFormDual = aud === "BOTH";
                const modalTheme = isFormFaculty
                  ? {
                      headerBg: "bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-b border-blue-500/40",
                      glow1: "bg-blue-500/20",
                      glow2: "bg-indigo-500/20",
                      iconBox: "bg-gradient-to-br from-blue-500/30 to-indigo-500/20 border-blue-400/50 text-blue-300",
                      badge: "bg-blue-500/20 text-blue-200 border-blue-400/40",
                      badgeText: "Faculty Only (Staff)",
                      subtext: "Configure faculty shift hours, biometric scanning windows, and eligible teacher rosters.",
                      icon: Shield,
                      tabActive: "bg-blue-600 text-white font-black shadow-md scale-[1.02]",
                      tabInactive: "bg-white/10 text-blue-100 hover:bg-white/15",
                    }
                  : isFormDual
                  ? {
                      headerBg: "bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border-b border-purple-500/40",
                      glow1: "bg-purple-500/20",
                      glow2: "bg-pink-500/20",
                      iconBox: "bg-gradient-to-br from-purple-500/30 to-pink-500/20 border-purple-400/50 text-purple-300",
                      badge: "bg-purple-500/20 text-purple-200 border-purple-400/40",
                      badgeText: "Dual: Talabat & Faculty",
                      subtext: "Synchronized dual gates covering student arrival and faculty shifts simultaneously.",
                      icon: Zap,
                      tabActive: "bg-purple-600 text-white font-black shadow-md scale-[1.02]",
                      tabInactive: "bg-white/10 text-purple-100 hover:bg-white/15",
                    }
                  : {
                      headerBg: "bg-gradient-to-r from-[#071d18] via-emerald-950 to-[#071d18] border-b border-emerald-500/40",
                      glow1: "bg-[#d4af37]/15",
                      glow2: "bg-emerald-500/20",
                      iconBox: "bg-gradient-to-br from-emerald-500/30 to-teal-400/20 border-emerald-400/50 text-emerald-300",
                      badge: "bg-emerald-500/20 text-emerald-200 border-emerald-400/40",
                      badgeText: "Talabat Only (Students)",
                      subtext: "Configure student arrival windows, late punch cutoffs, and classroom register roll-calls.",
                      icon: GraduationCap,
                      tabActive: "bg-emerald-600 text-white font-black shadow-md scale-[1.02]",
                      tabInactive: "bg-white/10 text-emerald-100 hover:bg-white/15",
                    };
                const ModalHeaderIcon = modalTheme.icon;

                return (
                  <div className={`relative overflow-hidden p-5 sm:p-6 text-white shrink-0 transition-all duration-300 ${modalTheme.headerBg}`}>
                    <div className={`pointer-events-none absolute -right-10 -bottom-10 w-44 h-44 rounded-full blur-2xl ${modalTheme.glow1}`} />
                    <div className={`pointer-events-none absolute -left-10 -top-10 w-40 h-40 rounded-full blur-2xl ${modalTheme.glow2}`} />

                    <div className="relative z-10 flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-11 h-11 rounded-2xl border flex items-center justify-center shadow-inner shrink-0 ${modalTheme.iconBox}`}>
                          <ModalHeaderIcon className="w-5 h-5 stroke-[2.2]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg sm:text-xl font-black text-white font-display tracking-tight">
                              {editingWindow ? "Edit Attendance Schedule" : "Create Attendance Schedule"}
                            </h3>
                            <Badge className={`${modalTheme.badge} text-[10px] font-black uppercase tracking-wider`}>
                              {modalTheme.badgeText}
                            </Badge>
                          </div>
                          <p className="text-xs text-white/80 font-medium mt-0.5">
                            {modalTheme.subtext}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setWindowModalOpen(false)}
                        className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors active:scale-90 shrink-0"
                        aria-label="Close modal"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* 2. Stepped Tab Navigation Strip */}
                    <div className="relative z-10 grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => setModalTab("basics")}
                        className={cn(
                          "py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all select-none",
                          modalTab === "basics" ? modalTheme.tabActive : modalTheme.tabInactive
                        )}
                      >
                        <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px] font-mono">1</span>
                        <span className="truncate">Identity &amp; Channel</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalTab("timing")}
                        className={cn(
                          "py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all select-none",
                          modalTab === "timing" ? modalTheme.tabActive : modalTheme.tabInactive
                        )}
                      >
                        <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px] font-mono">2</span>
                        <span className="truncate">Timing &amp; Grace</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalTab("scope")}
                        className={cn(
                          "py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all select-none",
                          modalTab === "scope" ? modalTheme.tabActive : modalTheme.tabInactive
                        )}
                      >
                        <span className="w-4 h-4 rounded-full bg-black/20 flex items-center justify-center text-[10px] font-mono">3</span>
                        <span className="truncate">Audience Scope</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* 3. Modal Form Body */}
              <form onSubmit={saveWindow} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">

                  {/* ──────────────── TAB 1: IDENTITY & CHANNEL ──────────────── */}
                  {modalTab === "basics" && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="space-y-5"
                    >
                      {/* Quick Presets / Templates (Only for Manual & Custom Sessions) */}
                      {windowForm.windowType !== "HIKVISION" && (
                        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50/80 via-emerald-50/60 to-white border border-amber-200/80 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                              Quick Template Presets
                            </span>
                            <span className="text-[10px] text-gray-500 font-medium">Click to prefill timing &amp; options</span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {[
                              {
                                label: "Morning Tilawat",
                                type: "BOTH" as const,
                                aud: "BOTH" as const,
                                start: "07:35",
                                end: "07:50",
                                late: "08:30",
                                grace: 10,
                              },
                              {
                                label: "Classroom Roll Call",
                                type: "MANUAL" as const,
                                aud: "STUDENT" as const,
                                start: "08:30",
                                end: "09:15",
                                late: "09:30",
                                grace: 5,
                              },
                              {
                                label: "Dua Session",
                                type: "BOTH" as const,
                                aud: "BOTH" as const,
                                start: "12:45",
                                end: "13:30",
                                late: "13:45",
                                grace: 10,
                              },
                            ].map((tmpl) => (
                              <button
                                key={tmpl.label}
                                type="button"
                                onClick={() => {
                                  setWindowForm({
                                    ...windowForm,
                                    name: tmpl.label,
                                    windowType: tmpl.type,
                                    audience: tmpl.aud,
                                    startTime: tmpl.start,
                                    endTime: tmpl.end,
                                    lateEndTime: tmpl.late,
                                    graceMinutes: tmpl.grace,
                                  });
                                  toast({
                                    title: `Applied Template: ${tmpl.label}`,
                                    description: `Timing set to ${tmpl.start} - ${tmpl.end}`,
                                    variant: "default",
                                  });
                                }}
                                className="px-2.5 py-1 rounded-xl bg-white text-xs font-bold text-gray-800 border border-gray-200 hover:border-emerald-500 hover:text-emerald-900 hover:bg-emerald-50 transition-all shadow-2xs active:scale-95"
                              >
                                + {tmpl.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Schedule Session Name */}
                      <div>
                        <label className="text-xs font-black uppercase tracking-wider text-gray-700 block mb-1.5">
                          Schedule Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Morning Tilawat, Dua Session, Classroom Roll Call..."
                          value={windowForm.name}
                          onChange={(e) => setWindowForm({ ...windowForm, name: e.target.value })}
                          className="w-full h-11 px-4 rounded-2xl border border-gray-200 bg-gray-50/50 text-xs font-bold text-gray-900 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none shadow-2xs"
                        />
                      </div>

                      {/* Subsystem Channel Selection */}
                      <div>
                        <label className="text-xs font-black uppercase tracking-wider text-gray-700 block mb-1.5">
                          Subsystem Channel &amp; Mode
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setWindowForm({ ...windowForm, windowType: "HIKVISION" })}
                            className={cn(
                              "p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2",
                              windowForm.windowType === "HIKVISION"
                                ? "bg-purple-50/80 border-purple-500 text-purple-950 ring-2 ring-purple-400/40 shadow-sm"
                                : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="p-2 rounded-xl bg-purple-100 text-purple-800">
                                <Radio className="w-4 h-4" />
                              </span>
                              <Badge variant="outline" className="text-[9px] font-bold border-purple-300 text-purple-800 bg-purple-50">
                                Hardware
                              </Badge>
                            </div>
                            <div>
                              <p className="font-extrabold text-xs text-purple-950">Hikvision Gate</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Biometric facial scanners &amp; turnstiles</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setWindowForm({ ...windowForm, windowType: "MANUAL" })}
                            className={cn(
                              "p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2",
                              windowForm.windowType === "MANUAL"
                                ? "bg-emerald-50/80 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400/40 shadow-sm"
                                : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                                <ClipboardCheck className="w-4 h-4" />
                              </span>
                              <Badge variant="outline" className="text-[9px] font-bold border-emerald-300 text-emerald-800 bg-emerald-50">
                                Roll Call
                              </Badge>
                            </div>
                            <div>
                              <p className="font-extrabold text-xs text-emerald-950">Manual Register</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Teacher one-touch classroom attendance</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setWindowForm({ ...windowForm, windowType: "BOTH" })}
                            className={cn(
                              "p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2",
                              windowForm.windowType === "BOTH"
                                ? "bg-amber-50/80 border-amber-500 text-amber-950 ring-2 ring-amber-400/40 shadow-sm"
                                : "bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="p-2 rounded-xl bg-amber-100 text-amber-800">
                                <Layers className="w-4 h-4" />
                              </span>
                              <Badge variant="outline" className="text-[9px] font-bold border-amber-300 text-amber-800 bg-amber-50">
                                Unified
                              </Badge>
                            </div>
                            <div>
                              <p className="font-extrabold text-xs text-amber-950">Unified Dual</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">Hardware terminal + classroom roll call</p>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Target Audience Scope */}
                      <div>
                        <label className="text-xs font-black uppercase tracking-wider text-gray-700 block mb-1.5">
                          Target Audience Scope
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setWindowForm({ ...windowForm, audience: "STUDENT" })}
                            className={cn(
                              "p-3 rounded-2xl border text-left transition-all flex items-center gap-3",
                              windowForm.audience === "STUDENT"
                                ? "bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400/30 shadow-2xs"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            <span className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                              <GraduationCap className="w-4 h-4" />
                            </span>
                            <div>
                              <p className="font-bold text-xs text-emerald-950">Talabat Only</p>
                              <p className="text-[10px] text-gray-500">Students roster only</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setWindowForm({ ...windowForm, audience: "TEACHER" })}
                            className={cn(
                              "p-3 rounded-2xl border text-left transition-all flex items-center gap-3",
                              windowForm.audience === "TEACHER"
                                ? "bg-blue-50 border-blue-500 text-blue-950 ring-2 ring-blue-400/30 shadow-2xs"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            <span className="p-2 rounded-xl bg-blue-100 text-blue-800">
                              <Shield className="w-4 h-4" />
                            </span>
                            <div>
                              <p className="font-bold text-xs text-blue-950">Faculty Only</p>
                              <p className="text-[10px] text-gray-500">Teachers &amp; staff only</p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setWindowForm({ ...windowForm, audience: "BOTH" })}
                            className={cn(
                              "p-3 rounded-2xl border text-left transition-all flex items-center gap-3",
                              windowForm.audience === "BOTH"
                                ? "bg-purple-50 border-purple-500 text-purple-950 ring-2 ring-purple-400/30 shadow-2xs"
                                : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            <span className="p-2 rounded-xl bg-purple-100 text-purple-800">
                              <Zap className="w-4 h-4" />
                            </span>
                            <div>
                              <p className="font-bold text-xs text-purple-950">Dual (Both)</p>
                              <p className="text-[10px] text-gray-500">Talabat &amp; Faculty</p>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* Active Status Switch */}
                      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-gray-900">Schedule Active &amp; Operational</p>
                          <p className="text-[11px] text-gray-500">When enabled, attendance marks and facial punches are actively registered for this window.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setWindowForm({ ...windowForm, enabled: !windowForm.enabled })}
                          className={cn(
                            "w-11 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0",
                            windowForm.enabled ? "bg-emerald-600" : "bg-gray-300"
                          )}
                        >
                          <div
                            className={cn(
                              "w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out",
                              windowForm.enabled ? "translate-x-5" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* ──────────────── TAB 2: SMART TIMING & SHIFTS ──────────────── */}
                  {modalTab === "timing" && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="space-y-5"
                    >
                      {/* Notice for Manual Roll-Call */}
                      {windowForm.windowType === "MANUAL" && (
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                          <p className="text-xs text-emerald-950 font-medium">
                            <strong>Live Attendance Window:</strong> Mark live attendance between opening and closing time.
                          </p>
                        </div>
                      )}

                      {/* Primary Timing Panel */}
                      <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-700" />
                            {windowForm.windowType === "MANUAL"
                              ? "Live Marking Window"
                              : windowForm.audience === "TEACHER"
                              ? "Faculty Shift Window"
                              : "Primary Attendance Window"}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono font-bold">24-Hour Format</span>
                        </div>

                        {/* Timing From & To */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-gray-700 block mb-1">
                              {windowForm.windowType === "MANUAL" ? "Live Marking Opens (From):" : "On-Time Window From:"}
                            </label>
                            <input
                              type="time"
                              required
                              value={windowForm.startTime}
                              onChange={(e) => setWindowForm({ ...windowForm, startTime: e.target.value })}
                              className="w-full h-11 px-3.5 rounded-2xl border border-gray-200 bg-white text-xs font-bold font-mono text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-bold text-gray-700 block mb-1">
                              {windowForm.windowType === "MANUAL" ? "Live Marking Closes (To):" : "On-Time Window To:"}
                            </label>
                            <input
                              type="time"
                              required
                              value={windowForm.endTime}
                              onChange={(e) => {
                                const newEnd = e.target.value;
                                if (windowForm.windowType === "MANUAL") {
                                  setWindowForm({
                                    ...windowForm,
                                    endTime: newEnd,
                                    lateEndTime: newEnd,
                                    graceMinutes: 0,
                                  });
                                } else {
                                  setWindowForm({ ...windowForm, endTime: newEnd });
                                }
                              }}
                              className="w-full h-11 px-3.5 rounded-2xl border border-gray-200 bg-white text-xs font-bold font-mono text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                            />
                          </div>
                        </div>

                        {/* Late Cutoff & Grace Minutes ONLY for non-manual */}
                        {windowForm.windowType !== "MANUAL" && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-200/80">
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold text-gray-700">Late Cutoff Till:</label>
                                <div className="flex items-center gap-1">
                                  {[15, 30, 45].map((m) => (
                                    <button
                                      key={m}
                                      type="button"
                                      onClick={() =>
                                        setWindowForm({
                                          ...windowForm,
                                          lateEndTime: addMinutesToTime(windowForm.endTime, m),
                                        })
                                      }
                                      className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                                    >
                                      +{m}m
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <input
                                type="time"
                                value={windowForm.lateEndTime || ""}
                                onChange={(e) => setWindowForm({ ...windowForm, lateEndTime: e.target.value })}
                                className="w-full h-11 px-3.5 rounded-2xl border border-gray-200 bg-white text-xs font-bold font-mono text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                                placeholder="e.g. 09:00"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[11px] font-bold text-gray-700">Grace Period (Minutes):</label>
                                <div className="flex items-center gap-1">
                                  {[0, 5, 10, 15].map((g) => (
                                    <button
                                      key={g}
                                      type="button"
                                      onClick={() => setWindowForm({ ...windowForm, graceMinutes: g })}
                                      className={cn(
                                        "px-1.5 py-0.5 rounded text-[9px] font-bold transition-all",
                                        windowForm.graceMinutes === g
                                          ? "bg-emerald-700 text-white"
                                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                      )}
                                    >
                                      {g}m
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <input
                                type="number"
                                min="0"
                                max="180"
                                required
                                value={windowForm.graceMinutes}
                                onChange={(e) =>
                                  setWindowForm({ ...windowForm, graceMinutes: Number(e.target.value) })
                                }
                                className="w-full h-11 px-3.5 rounded-2xl border border-gray-200 bg-white text-xs font-bold text-gray-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all outline-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Interactive Visual Timeline Bar */}
                      <div className="p-4 rounded-2xl bg-white border border-gray-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-wider text-gray-500">Live Visual Timeline</span>
                          <span className="text-[11px] font-mono font-bold text-emerald-800">
                            {windowForm.startTime} → {windowForm.windowType === "MANUAL" ? windowForm.endTime : (windowForm.lateEndTime || windowForm.endTime)}
                          </span>
                        </div>
                        <ScheduleTimelineBar
                          startTime={windowForm.startTime}
                          endTime={windowForm.endTime}
                          lateEndTime={windowForm.windowType === "MANUAL" ? windowForm.endTime : windowForm.lateEndTime}
                          accent={windowForm.audience === "TEACHER" ? "blue" : windowForm.audience === "BOTH" ? "purple" : "emerald"}
                          isManual={windowForm.windowType === "MANUAL"}
                        />
                      </div>

                      {/* Optional Faculty Shift for Dual Mode */}
                      {windowForm.audience === "BOTH" && (
                        <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-purple-950 flex items-center gap-1.5 cursor-pointer">
                              <Shield className="w-3.5 h-3.5 text-purple-700" />
                              <span>Separate Timing for Faculty Members?</span>
                            </label>
                            <input
                              type="checkbox"
                              checked={windowForm.useCustomFacultyTime}
                              onChange={(e) =>
                                setWindowForm({ ...windowForm, useCustomFacultyTime: e.target.checked })
                              }
                              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                            />
                          </div>

                          {windowForm.useCustomFacultyTime && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-purple-200/80">
                              <div>
                                <label className="text-[10px] font-bold text-purple-900 block mb-1">Faculty From:</label>
                                <input
                                  type="time"
                                  value={windowForm.facultyStartTime}
                                  onChange={(e) =>
                                    setWindowForm({ ...windowForm, facultyStartTime: e.target.value })
                                  }
                                  className="w-full h-10 px-3 rounded-xl border border-purple-200 text-xs font-mono font-bold text-gray-900 bg-white"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-purple-900 block mb-1">Faculty To:</label>
                                <input
                                  type="time"
                                  value={windowForm.facultyEndTime}
                                  onChange={(e) =>
                                    setWindowForm({ ...windowForm, facultyEndTime: e.target.value })
                                  }
                                  className="w-full h-10 px-3 rounded-xl border border-purple-200 text-xs font-mono font-bold text-gray-900 bg-white"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-purple-900 block mb-1">Faculty Late Cutoff:</label>
                                <input
                                  type="time"
                                  value={windowForm.facultyLateEndTime}
                                  onChange={(e) =>
                                    setWindowForm({ ...windowForm, facultyLateEndTime: e.target.value })
                                  }
                                  className="w-full h-10 px-3 rounded-xl border border-purple-200 text-xs font-mono font-bold text-gray-900 bg-white"
                                />
                              </div>
                            </div>
                          )}
                          </div>
                        )}
                      </motion.div>
                    )}

                    {/* ──────────────── TAB 3: AUDIENCE SCOPE ──────────────── */}
                  {modalTab === "scope" && (
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="space-y-5"
                    >
                      {/* If HIKVISION: Show Universal Gate Scope Banner for Students */}
                      {windowForm.windowType === "HIKVISION" && (
                        <div className="p-5 rounded-3xl bg-gradient-to-br from-purple-50 via-indigo-50/50 to-white border-2 border-purple-200/80 space-y-3 shadow-sm">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-purple-100 border border-purple-300 flex items-center justify-center text-purple-800 shadow-inner shrink-0">
                              <Radio className="w-5 h-5 text-purple-700" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-black uppercase tracking-wider text-purple-950 font-display">
                                  Universal Gate Scanning Scope (Talabat)
                                </h4>
                                <Badge className="bg-purple-600 text-white text-[10px] font-black uppercase">
                                  Hikvision Terminal
                                </Badge>
                              </div>
                              <p className="text-xs text-purple-800 font-medium mt-0.5">
                                All registered Talabat authenticate automatically at MinMoe gates without class restrictions.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* If NOT HIKVISION: Show Talabat Class Scope for manual/custom sessions */}
                      {windowForm.windowType !== "HIKVISION" && (windowForm.audience === "STUDENT" || windowForm.audience === "BOTH") && (
                            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5">
                                  <GraduationCap className="w-4 h-4 text-emerald-700" />
                                  <span className="text-xs font-black uppercase tracking-wider text-emerald-950">
                                    Talabat Class Scope
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] font-bold bg-white text-emerald-800 border-emerald-300">
                                    {windowForm.applicableClassIds.length === 0
                                      ? "All Classes (Default)"
                                      : `${windowForm.applicableClassIds.length} Selected`}
                                  </Badge>

                                  {windowForm.applicableClassIds.length > 0 ? (
                                    <button
                                      type="button"
                                      onClick={() => setWindowForm({ ...windowForm, applicableClassIds: [] })}
                                      className="text-[10px] font-bold text-rose-600 hover:underline"
                                    >
                                      Clear Selection
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setWindowForm({ ...windowForm, applicableClassIds: classes.map((c) => c.id) })
                                      }
                                      className="text-[10px] font-bold text-emerald-700 hover:underline"
                                    >
                                      Select Specific
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                  type="text"
                                  placeholder="Filter classes by name, grade, section..."
                                  value={classFilterQuery}
                                  onChange={(e) => setClassFilterQuery(e.target.value)}
                                  className="w-full h-8 pl-8 pr-3 rounded-xl border border-emerald-200 bg-white text-xs font-medium text-gray-800 outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                              </div>

                              <div className="max-h-44 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-2xl border border-emerald-100 shadow-inner custom-scrollbar">
                                {classes
                                  .filter((c) => {
                                    if (!classFilterQuery.trim()) return true;
                                    const q = classFilterQuery.toLowerCase();
                                    return (
                                      c.name.toLowerCase().includes(q) ||
                                      c.grade.toLowerCase().includes(q) ||
                                      c.section.toLowerCase().includes(q)
                                    );
                                  })
                                  .map((c) => {
                                    const isChecked = windowForm.applicableClassIds.includes(c.id);
                                    return (
                                      <label
                                        key={c.id}
                                        className={cn(
                                          "flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all border",
                                          isChecked
                                            ? "bg-emerald-50 border-emerald-400 text-emerald-950 font-bold"
                                            : "bg-gray-50/50 border-gray-100 text-gray-700 hover:bg-gray-100"
                                        )}
                                      >
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) =>
                                              setWindowForm({
                                                ...windowForm,
                                                applicableClassIds: e.target.checked
                                                  ? [...windowForm.applicableClassIds, c.id]
                                                  : windowForm.applicableClassIds.filter((id) => id !== c.id),
                                              })
                                            }
                                            className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                                          />
                                          <span>{c.name}</span>
                                        </div>
                                        <Badge variant="outline" className="text-[9px] font-mono text-gray-500">
                                          Grade {c.grade}-{c.section}
                                        </Badge>
                                      </label>
                                    );
                                  })}
                              </div>
                            </div>
                          )}

                      {/* Faculty Scanning Eligibility Scope - Available for Hikvision AND any Faculty/Both schedule */}
                      {(windowForm.windowType === "HIKVISION" || windowForm.audience === "TEACHER" || windowForm.audience === "BOTH") && (
                        <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-3">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <Shield className="w-4 h-4 text-blue-700" />
                              <div>
                                <span className="text-xs font-black uppercase tracking-wider text-blue-950 block">
                                  Faculty Scanning Eligibility Scope
                                </span>
                                <span className="text-[11px] text-blue-800/80 font-medium block">
                                  Select faculty eligible for scanning. Un-eligible faculty will <strong className="text-blue-950">never be marked absent</strong>.
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-[10px] font-bold bg-white text-blue-800 border-blue-300">
                                {windowForm.applicableTeacherIds.length === 0
                                  ? "All Faculty (Default)"
                                  : `${windowForm.applicableTeacherIds.length} Eligible`}
                              </Badge>

                              {windowForm.applicableTeacherIds.length > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setWindowForm({ ...windowForm, applicableTeacherIds: [] })}
                                  className="text-[10px] font-bold text-rose-600 hover:underline"
                                >
                                  Clear Selection
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setWindowForm({ ...windowForm, applicableTeacherIds: teachers.map((t) => t.id) })
                                  }
                                  className="text-[10px] font-bold text-blue-700 hover:underline"
                                >
                                  Select Specific
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Filter faculty by name, department, email..."
                              value={teacherFilterQuery}
                              onChange={(e) => setTeacherFilterQuery(e.target.value)}
                              className="w-full h-8 pl-8 pr-3 rounded-xl border border-blue-200 bg-white text-xs font-medium text-gray-800 outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          <div className="max-h-48 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-2xl border border-blue-100 shadow-inner custom-scrollbar">
                            {teachers.length === 0 ? (
                              <p className="text-xs text-gray-400 p-2">All active faculty included by default.</p>
                            ) : (
                              teachers
                                .filter((t) => {
                                  if (!teacherFilterQuery.trim()) return true;
                                  const q = teacherFilterQuery.toLowerCase();
                                  return (
                                    t.name.toLowerCase().includes(q) ||
                                    t.email?.toLowerCase().includes(q) ||
                                    t.department?.toLowerCase().includes(q)
                                  );
                                })
                                .map((t) => {
                                  const isChecked = windowForm.applicableTeacherIds.includes(t.id);
                                  return (
                                    <label
                                      key={t.id}
                                      className={cn(
                                        "flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all border",
                                        isChecked
                                          ? "bg-blue-50 border-blue-400 text-blue-950 font-bold"
                                          : "bg-gray-50/50 border-gray-100 text-gray-700 hover:bg-gray-100"
                                      )}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) =>
                                            setWindowForm({
                                              ...windowForm,
                                              applicableTeacherIds: e.target.checked
                                                ? [...windowForm.applicableTeacherIds, t.id]
                                                : windowForm.applicableTeacherIds.filter((id) => id !== t.id),
                                            })
                                          }
                                          className="rounded border-blue-400 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                        />
                                        <span className="truncate">{t.name}</span>
                                      </div>
                                      <Badge variant="outline" className="text-[9px] font-mono text-gray-500 shrink-0">
                                        {t.department || "Faculty"}
                                      </Badge>
                                    </label>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* 4. Modal Footer Action Dock */}
                <div className="p-4 sm:p-5 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                  {/* Live Summary Pill */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="font-extrabold text-gray-900 truncate">{windowForm.name || "Untitled Schedule"}</span>
                    <span className="text-gray-400">|</span>
                    <span className="font-mono text-gray-700">{windowForm.startTime} - {windowForm.endTime}</span>
                  </div>

                  {/* Buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setWindowModalOpen(false)}
                      disabled={savingWindow}
                      className="rounded-xl border-gray-200 text-xs font-bold h-9 px-3.5"
                    >
                      Cancel
                    </Button>

                    {modalTab !== "basics" && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          if (modalTab === "scope") setModalTab("timing");
                          else if (modalTab === "timing") setModalTab("basics");
                        }}
                        className="rounded-xl border-gray-200 text-xs font-bold h-9 px-3.5 flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        Back
                      </Button>
                    )}

                    {modalTab !== "scope" && (
                      <Button
                        type="button"
                        onClick={() => {
                          if (modalTab === "basics") setModalTab("timing");
                          else if (modalTab === "timing") setModalTab("scope");
                        }}
                        className="rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold h-9 px-3.5 flex items-center gap-1"
                      >
                        Next
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                    )}

                    <Button
                      type="submit"
                      disabled={savingWindow}
                      className="bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl text-xs font-black h-9 px-5 shadow-md shadow-emerald-700/25 flex items-center gap-1.5 active:scale-95 transition-all"
                    >
                      {savingWindow ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{editingWindow ? "Update Schedule" : "Create Schedule"}</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
