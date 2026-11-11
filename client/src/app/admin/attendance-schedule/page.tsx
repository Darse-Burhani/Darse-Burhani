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
  applicableDeviceIds?: string[];
  applicableClasses?: Array<{ id: string; name: string; grade: string; section: string }>;
  applicableTeachers?: Array<{ id: string; name: string }>;
  applicableDevices?: Array<{ id: string; name: string; host: string; status: string; enabled: boolean }>;
  windowType?: "HIKVISION" | "MANUAL" | "BOTH";
  createdAt: string;
  updatedAt: string;
}

interface BiometricDeviceItem {
  id: string;
  name: string;
  host: string;
  port: number;
  model?: string | null;
  serialNo?: string | null;
  status: string;
  enabled: boolean;
  lastSeenAt?: string | null;
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
  const [devices, setDevices] = useState<BiometricDeviceItem[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
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
    applicableDeviceIds: [] as string[],
  });

  const [modalTab, setModalTab] = useState<"basics" | "timing" | "scope">("basics");
  const [classFilterQuery, setClassFilterQuery] = useState("");
  const [teacherFilterQuery, setTeacherFilterQuery] = useState("");
  const [deviceFilterQuery, setDeviceFilterQuery] = useState("");

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
      setLoading(true);
      const res = await fetch("/api/admin/attendance/schedule/windows");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setWindows(json.data);
        }
      }
    } catch {
      toast({ title: "Failed to load attendance windows", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch Faculty Directory (Fast & Independent with Fallback)
  const fetchTeachers = useCallback(async () => {
    try {
      setLoadingTeachers(true);
      const res = await fetch("/api/admin/attendance/schedule/teachers");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setTeachers(json.data);
          return;
        }
      }
      // Immediate fallback to /api/teachers
      const fb = await fetch("/api/teachers").then((r) => r.json()).catch(() => null);
      if (fb?.success && Array.isArray(fb.data) && fb.data.length > 0) {
        setTeachers(
          fb.data.map((t: any) => ({
            id: t.id,
            name: t.name || `${t.user?.firstName || ""} ${t.user?.lastName || ""}`.trim(),
            email: t.email || t.user?.email || "",
            department: t.department || "Faculty",
          }))
        );
      }
    } catch {
      // silent fallback
    } finally {
      setLoadingTeachers(false);
    }
  }, []);

  // Fetch Class Directory (Fast & Independent)
  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/attendance/schedule/classes");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.classes) {
          setClasses(json.data.classes || []);
        }
      }
    } catch {
      // silent fallback
    }
  }, []);

  // Fetch Configured Biometric Devices (Fast with Fallback)
  const fetchDevices = useCallback(async () => {
    try {
      setLoadingDevices(true);
      // 1. Primary schedule endpoint
      const res = await fetch("/api/admin/attendance/schedule/devices");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          setDevices(json.data);
          return;
        }
      }
      // 2. Direct biometric devices endpoint fallback
      const bioRes = await fetch("/api/biometric/devices");
      if (bioRes.ok) {
        const bioJson = await bioRes.json();
        if (bioJson.success && Array.isArray(bioJson.data) && bioJson.data.length > 0) {
          setDevices(bioJson.data);
          return;
        }
      }
    } catch {
      // silent fallback
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  const loadData = useCallback(() => {
    // Fire all fetches in parallel immediately without blocking each other
    fetchWindows();
    fetchTeachers();
    fetchDevices();
    fetchClasses();
  }, [fetchWindows, fetchTeachers, fetchDevices, fetchClasses]);

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

    // Sort: ACTIVE (live) schedules first, then UPCOMING, then CLOSED.
    // Ties keep chronological order by start time.
    const statusRank = (s?: string) => (s === "ACTIVE" ? 0 : s === "UPCOMING" ? 1 : 2);
    list = [...list].sort(
      (a, b) => statusRank(a.status) - statusRank(b.status) || a.startTime.localeCompare(b.startTime),
    );

    return list;
  }, [windows, activeTab, audienceFilter]);

  // Open modal to create/edit window
  const openWindowModal = (
    w?: ScanWindow,
    presetWindowType?: "HIKVISION" | "MANUAL" | "BOTH"
  ) => {
    // Proactively refresh auxiliary lists if empty
    if (devices.length === 0) fetchDevices();
    if (teachers.length === 0) fetchTeachers();
    if (classes.length === 0) fetchClasses();

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
        applicableDeviceIds: w.applicableDeviceIds || [],
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
        applicableDeviceIds: [],
      });
    }
    setModalTab("basics");
    setClassFilterQuery("");
    setTeacherFilterQuery("");
    setDeviceFilterQuery("");
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
        applicableDeviceIds: windowForm.applicableDeviceIds,
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
              const isFaculty = w.audience === "FACULTY" || (w.exemptStudentIds || []).includes("AUDIENCE_FACULTY");
              const isDual = !isFaculty && (w.audience === "BOTH" || (w.exemptStudentIds || []).includes("AUDIENCE_BOTH") || (Boolean(w.facultyStartTime && w.facultyEndTime) && (w.audience as any) !== "ALL_STUDENTS"));

              const theme = isFaculty
                ? {
                    headerBg: "bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900",
                    borderActive: "border-blue-500 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/15",
                    borderDefault: "border-blue-200/90 hover:border-blue-400 shadow-sm hover:shadow-md",
                    iconBox: "bg-white/20 text-white border border-white/30 backdrop-blur-xs",
                    title: "text-white",
                    badge: "bg-white/20 text-blue-100 border-white/30 backdrop-blur-xs",
                    badgeIcon: "text-blue-200",
                    badgeLabel: "Faculty Only (Staff)",
                    actionBtn: "text-white/80 hover:text-white hover:bg-white/20",
                    actionBox: "bg-white/10 border border-white/20",
                    timeBoxBg: "bg-blue-50/60 border-blue-200/70",
                    timeBoxIcon: "text-blue-800",
                    timeBoxLabel: "Faculty Shift Timing",
                    toggleActive: "bg-blue-600 shadow-sm",
                    liveDot: "bg-emerald-400",
                    livePing: "bg-emerald-300",
                    livePill: "bg-blue-100 text-blue-950 border-blue-300 font-bold",
                    timerIcon: "text-blue-600",
                    accent: "blue" as const,
                  }
                : isDual
                ? {
                    headerBg: "bg-gradient-to-r from-purple-800 via-indigo-800 to-fuchsia-900",
                    borderActive: "border-purple-500 ring-2 ring-purple-500/30 shadow-lg shadow-purple-500/15",
                    borderDefault: "border-purple-200/90 hover:border-purple-400 shadow-sm hover:shadow-md",
                    iconBox: "bg-white/20 text-white border border-white/30 backdrop-blur-xs",
                    title: "text-white",
                    badge: "bg-white/20 text-purple-100 border-white/30 backdrop-blur-xs",
                    badgeIcon: "text-purple-200",
                    badgeLabel: "Dual: Talabat & Faculty",
                    actionBtn: "text-white/80 hover:text-white hover:bg-white/20",
                    actionBox: "bg-white/10 border border-white/20",
                    timeBoxBg: "bg-purple-50/60 border-purple-200/70",
                    timeBoxIcon: "text-purple-800",
                    timeBoxLabel: "Unified Gate Timing",
                    toggleActive: "bg-purple-600 shadow-sm",
                    liveDot: "bg-emerald-400",
                    livePing: "bg-emerald-300",
                    livePill: "bg-purple-100 text-purple-950 border-purple-300 font-bold",
                    timerIcon: "text-purple-600",
                    accent: "purple" as const,
                  }
                : {
                    headerBg: "bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-950",
                    borderActive: "border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/15",
                    borderDefault: "border-emerald-200/90 hover:border-emerald-400 shadow-sm hover:shadow-md",
                    iconBox: "bg-white/20 text-white border border-white/30 backdrop-blur-xs",
                    title: "text-white",
                    badge: "bg-white/20 text-emerald-100 border-white/30 backdrop-blur-xs",
                    badgeIcon: "text-emerald-200",
                    badgeLabel: "Talabat Only (Students)",
                    actionBtn: "text-white/80 hover:text-white hover:bg-white/20",
                    actionBox: "bg-white/10 border border-white/20",
                    timeBoxBg: "bg-emerald-50/60 border-emerald-200/70",
                    timeBoxIcon: "text-emerald-800",
                    timeBoxLabel: w.windowType === "MANUAL" ? "Live Marking Window" : "Student Timing",
                    toggleActive: "bg-emerald-600 shadow-sm",
                    liveDot: "bg-emerald-400",
                    livePing: "bg-emerald-300",
                    livePill: "bg-emerald-100 text-emerald-950 border-emerald-300 font-bold",
                    timerIcon: "text-emerald-600",
                    accent: "emerald" as const,
                  };

              const hasStrictDevices = Array.isArray(w.applicableDeviceIds) && w.applicableDeviceIds.length > 0;
              const hasStrictFaculty = Array.isArray(w.applicableTeacherIds) && w.applicableTeacherIds.length > 0;

              return (
                <Card
                  key={w.id}
                  className={`group relative overflow-hidden transition-all duration-300 rounded-3xl border bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 ${
                    w.enabled
                      ? isLive
                        ? theme.borderActive
                        : theme.borderDefault
                      : "opacity-65 bg-gray-50/90 border-gray-200"
                  }`}
                >
                  {/* Distinct Color-Coded Header (Faculty = Blue, Dual = Purple, Talabat = Emerald) */}
                  <CardHeader
                    className={`p-4 sm:p-5 flex flex-row items-start justify-between gap-3 text-white transition-all duration-300 rounded-t-3xl ${
                      w.enabled ? theme.headerBg : "bg-gradient-to-r from-gray-700 to-gray-800"
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover:scale-105 ${
                          theme.iconBox
                        }`}
                      >
                        {isFaculty ? (
                          <Shield className="w-5 h-5 text-white stroke-[2.2]" />
                        ) : isDual ? (
                          <Zap className="w-5 h-5 text-white stroke-[2.2]" />
                        ) : (
                          <GraduationCap className="w-5 h-5 text-white stroke-[2.2]" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {isLive && (
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${theme.livePing}`}></span>
                              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${theme.liveDot}`}></span>
                            </span>
                          )}
                          <h3 className="font-black text-base sm:text-lg text-white leading-tight truncate">{w.name}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
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
                          {!w.enabled && (
                            <Badge className="bg-black/30 text-white/90 border border-white/20 text-[9px] font-bold">
                              Disabled
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={`flex items-center gap-1 p-1 rounded-xl shrink-0 backdrop-blur-xs ${theme.actionBox}`}>
                      <button
                        type="button"
                        onClick={() => openWindowModal(w)}
                        className={`p-1.5 rounded-lg transition-all active:scale-90 ${theme.actionBtn}`}
                        title="Edit Schedule &amp; Scope"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWindow(w.id)}
                        disabled={deletingId === w.id}
                        className="p-1.5 text-white/80 hover:text-rose-200 hover:bg-rose-500/30 rounded-lg transition-all active:scale-90 disabled:opacity-30"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 sm:p-5 space-y-3.5">
                    {/* Time Display */}
                    <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${theme.timeBoxBg}`}>
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
                      <div className={`p-3 rounded-2xl border space-y-1.5 text-xs transition-all ${
                        hasStrictFaculty ? "bg-blue-50/90 border-blue-300 text-blue-950 shadow-2xs" : "bg-blue-50/40 border-blue-200/60 text-blue-900"
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-blue-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                            <Shield className="w-3.5 h-3.5 text-blue-700" />
                            Faculty Scope:
                          </span>
                          {!hasStrictFaculty ? (
                            <Badge variant="outline" className="bg-white text-blue-800 border-blue-300 font-bold text-[10px]">
                              All Active Faculty Eligible
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-700 text-white font-bold text-[10px] shadow-2xs">
                              Strict: {w.applicableTeacherIds?.length} Faculty Eligible
                            </Badge>
                          )}
                        </div>
                        {hasStrictFaculty ? (
                          <div className="space-y-1">
                            <p className="text-[11px] text-blue-900 font-medium leading-tight">
                              Only selected faculty eligible for scanning. Un-eligible faculty will <strong className="text-blue-950 underline decoration-blue-400">never be marked absent</strong>.
                            </p>
                            {w.applicableTeachers && w.applicableTeachers.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {w.applicableTeachers.slice(0, 4).map((t) => (
                                  <span key={t.id} className="text-[10px] bg-white border border-blue-200 text-blue-900 font-semibold px-2 py-0.5 rounded-md shadow-2xs">
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

                    {/* Biometric Terminal Polling Scope (Hikvision Devices) */}
                    {(w.windowType === "HIKVISION" || w.windowType === "BOTH" || w.id === "default" || w.id.startsWith("hik_")) && (
                      <div className={`p-3 rounded-2xl border space-y-1.5 text-xs transition-all ${
                        hasStrictDevices ? "bg-purple-50/90 border-purple-300 text-purple-950 shadow-2xs" : "bg-purple-50/40 border-purple-200/60 text-purple-900"
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-black text-purple-950 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                            <Radio className="w-3.5 h-3.5 text-purple-700" />
                            HIK Polling Eligibility:
                          </span>
                          {!hasStrictDevices ? (
                            <Badge variant="outline" className="bg-white text-purple-800 border-purple-300 font-bold text-[10px]">
                              Universal (All Terminals Poll)
                            </Badge>
                          ) : (
                            <Badge className="bg-purple-700 text-white font-bold text-[10px] shadow-2xs">
                              Strict: {w.applicableDeviceIds?.length} Terminal{w.applicableDeviceIds!.length > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        {hasStrictDevices ? (
                          <div className="space-y-1">
                            <p className="text-[11px] text-purple-900 font-medium leading-tight">
                              Only selected terminals poll attendance. <strong className="text-purple-950 underline decoration-purple-400">Other terminals are strictly restricted.</strong>
                            </p>
                            {w.applicableDevices && w.applicableDevices.length > 0 ? (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {w.applicableDevices.map((d) => (
                                  <span key={d.id} className="text-[10px] bg-white border border-purple-200 text-purple-900 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-2xs">
                                    <span className={`w-1.5 h-1.5 rounded-full ${d.enabled ? "bg-emerald-500" : "bg-gray-400"}`} />
                                    {d.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {w.applicableDeviceIds?.map((id) => (
                                  <span key={id} className="text-[10px] bg-white border border-purple-200 text-purple-900 font-semibold px-2 py-0.5 rounded-md shadow-2xs">
                                    {id}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-purple-700 font-medium">
                            All enabled biometric terminals poll and accept attendance for this schedule.
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

                      {/* Biometric Terminal Polling Eligibility Scope (Hikvision Devices) */}
                      {(windowForm.windowType === "HIKVISION" || windowForm.windowType === "BOTH") && (
                        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-purple-50/90 via-indigo-50/40 to-white border-2 border-purple-200/90 space-y-4 shadow-xs">
                          {/* Master Toggle Bar: Strict HIK Polling vs Universal Polling */}
                          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-purple-200 flex items-center justify-between gap-3 shadow-2xs">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Radio className="w-4 h-4 text-purple-700 shrink-0" />
                                <span className="text-xs font-black uppercase tracking-wider text-purple-950">
                                  Strict Hikvision Polling Toggle
                                </span>
                                {windowForm.applicableDeviceIds.length > 0 ? (
                                  <Badge className="bg-purple-700 text-white font-bold text-[9px] shadow-2xs">
                                    Strict Mode ({windowForm.applicableDeviceIds.length} of {devices.length || windowForm.applicableDeviceIds.length} Chosen)
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 font-bold text-[9px]">
                                    Universal Mode (All {devices.length > 0 ? devices.length : 3} Terminals Active)
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 font-medium leading-tight">
                                {windowForm.applicableDeviceIds.length > 0
                                  ? "Only the selected HIK terminals below are eligible to poll attendance. Other terminals are strictly restricted and blocked."
                                  : "When disabled, all connected and enabled HIK terminals poll attendance universally for this window."}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={async () => {
                                if (windowForm.applicableDeviceIds.length > 0) {
                                  setWindowForm({ ...windowForm, applicableDeviceIds: [] });
                                } else {
                                  let curDevices = devices;
                                  if (curDevices.length === 0) {
                                    setLoadingDevices(true);
                                    try {
                                      const res = await fetch("/api/admin/attendance/schedule/devices");
                                      if (res.ok) {
                                        const json = await res.json();
                                        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                                          curDevices = json.data;
                                          setDevices(curDevices);
                                        }
                                      }
                                    } catch {}
                                    setLoadingDevices(false);
                                  }
                                  setWindowForm((prev) => ({
                                    ...prev,
                                    applicableDeviceIds: curDevices.map((d) => d.id),
                                  }));
                                }
                              }}
                              aria-label="Toggle strict HIK device polling"
                              className={cn(
                                "w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 select-none",
                                windowForm.applicableDeviceIds.length > 0 ? "bg-purple-700 shadow-sm" : "bg-gray-300"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out",
                                  windowForm.applicableDeviceIds.length > 0 ? "translate-x-6" : "translate-x-0"
                                )}
                              />
                            </button>
                          </div>

                          {/* Controls & Quick Actions when Strict Mode is Active */}
                          {windowForm.applicableDeviceIds.length > 0 && (
                            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                              <span className="text-[11px] font-bold text-purple-950">
                                Select HIK terminals allowed to poll attendance:
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setWindowForm({ ...windowForm, applicableDeviceIds: devices.map((d) => d.id) })
                                  }
                                  className="text-[10px] font-bold text-purple-700 hover:text-purple-900 px-2 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 transition-all"
                                >
                                  Select All ({devices.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setWindowForm({ ...windowForm, applicableDeviceIds: [] })}
                                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 transition-all"
                                >
                                  Reset to All (Universal)
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Quick Terminal Selection Cards */}
                          {loadingDevices ? (
                            <div className="p-4 bg-white rounded-2xl border border-purple-100 flex items-center justify-center gap-2 text-xs text-purple-700">
                              <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                              <span>Loading biometric terminals...</span>
                            </div>
                          ) : devices.length === 0 ? (
                            <div className="p-4 bg-white rounded-2xl border border-purple-100 flex items-center justify-between gap-3">
                              <div className="text-xs text-purple-950 space-y-0.5">
                                <p className="font-bold">No configured biometric terminals detected.</p>
                                <p className="text-[11px] text-gray-500">
                                  All active terminals will poll attendance by default.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => fetchDevices()}
                                className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Reload Terminals
                              </button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                              {devices.map((dev) => {
                                const isStrictOn = windowForm.applicableDeviceIds.length > 0;
                                const isSelected = !isStrictOn || windowForm.applicableDeviceIds.includes(dev.id) || windowForm.applicableDeviceIds.includes(dev.host);
                                return (
                                  <label
                                    key={dev.id}
                                    className={cn(
                                      "p-3 rounded-2xl border text-xs cursor-pointer transition-all flex items-start gap-3",
                                      isSelected
                                        ? "bg-white border-purple-500 shadow-sm ring-2 ring-purple-400/40"
                                        : "bg-white/70 border-purple-100 hover:border-purple-300 hover:bg-white text-gray-700 opacity-70"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          if (!isStrictOn) {
                                            setWindowForm({
                                              ...windowForm,
                                              applicableDeviceIds: [dev.id],
                                            });
                                          } else {
                                            setWindowForm({
                                              ...windowForm,
                                              applicableDeviceIds: [...windowForm.applicableDeviceIds, dev.id],
                                            });
                                          }
                                        } else {
                                          if (!isStrictOn) {
                                            setWindowForm({
                                              ...windowForm,
                                              applicableDeviceIds: devices.filter((d) => d.id !== dev.id).map((d) => d.id),
                                            });
                                          } else {
                                            setWindowForm({
                                              ...windowForm,
                                              applicableDeviceIds: windowForm.applicableDeviceIds.filter(
                                                (id) => id !== dev.id && id !== dev.host
                                              ),
                                            });
                                          }
                                        }
                                      }}
                                      className="rounded border-purple-400 text-purple-600 focus:ring-purple-500 w-4 h-4 mt-0.5"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center justify-between gap-1.5">
                                        <p className="font-bold text-gray-900 truncate text-xs">{dev.name}</p>
                                        <Badge
                                          variant="outline"
                                          className={`text-[9px] font-bold py-0 px-1.5 shrink-0 ${
                                            dev.status === "ONLINE"
                                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                              : dev.status === "ERROR"
                                              ? "bg-rose-50 text-rose-700 border-rose-200"
                                              : "bg-gray-50 text-gray-600 border-gray-200"
                                          }`}
                                        >
                                          {dev.status}
                                        </Badge>
                                      </div>
                                      <p className="text-[10px] text-gray-500 font-mono mt-0.5 truncate">
                                        {dev.host}:{dev.port} {dev.model ? `• ${dev.model}` : ""}
                                      </p>
                                      <div className="mt-1 flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${dev.enabled ? "bg-emerald-500" : "bg-gray-400"}`} />
                                        <span className={`text-[10px] font-bold ${isSelected ? "text-purple-700" : "text-amber-700"}`}>
                                          {isSelected ? "Eligible to Poll" : "Restricted / Blocked for this window"}
                                        </span>
                                      </div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}

                          <div className="p-2.5 rounded-xl bg-white/90 border border-purple-100 flex items-center justify-between text-[11px] text-purple-900 shadow-2xs">
                            <span className="font-medium">
                              {windowForm.applicableDeviceIds.length === 0
                                ? "Mode: Universal Polling (All active terminals poll attendance)"
                                : `Mode: Strict Hardware Polling (${windowForm.applicableDeviceIds.length} terminal${windowForm.applicableDeviceIds.length > 1 ? "s" : ""} poll; other terminals restricted)`}
                            </span>
                            {windowForm.applicableDeviceIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setWindowForm({ ...windowForm, applicableDeviceIds: [] })}
                                className="font-bold underline text-purple-700 hover:text-purple-900 text-xs ml-2"
                              >
                                Switch to All
                              </button>
                            )}
                          </div>
                        </div>
                      )}

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
                        <div className="p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-white border-2 border-blue-200/90 space-y-4 shadow-xs">
                          {/* Master Toggle Bar: Strict Faculty Roster vs Universal Active Faculty */}
                          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-blue-200 flex items-center justify-between gap-3 shadow-2xs">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Shield className="w-4 h-4 text-blue-700 shrink-0" />
                                <span className="text-xs font-black uppercase tracking-wider text-blue-950">
                                  Strict Faculty Attendance Eligibility
                                </span>
                                {windowForm.applicableTeacherIds.length > 0 ? (
                                  <Badge className="bg-blue-700 text-white font-bold text-[9px] shadow-2xs">
                                    Strict Roster ({windowForm.applicableTeacherIds.length} of {teachers.length || windowForm.applicableTeacherIds.length} Eligible)
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300 font-bold text-[9px]">
                                    Universal Mode (All {teachers.length > 0 ? teachers.length : "Active"} Faculty)
                                  </Badge>
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 font-medium leading-tight">
                                {windowForm.applicableTeacherIds.length > 0
                                  ? "Only selected faculty members below are eligible to scan. Un-eligible faculty will NEVER be marked absent."
                                  : "When disabled, all active faculty members are eligible for attendance during this schedule window."}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={async () => {
                                if (windowForm.applicableTeacherIds.length > 0) {
                                  setWindowForm({ ...windowForm, applicableTeacherIds: [] });
                                } else {
                                  let curTeachers = teachers;
                                  if (curTeachers.length === 0) {
                                    setLoadingTeachers(true);
                                    try {
                                      const res = await fetch("/api/admin/attendance/schedule/teachers");
                                      if (res.ok) {
                                        const json = await res.json();
                                        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
                                          curTeachers = json.data;
                                          setTeachers(curTeachers);
                                        }
                                      }
                                    } catch {}
                                    setLoadingTeachers(false);
                                  }
                                  setWindowForm((prev) => ({
                                    ...prev,
                                    applicableTeacherIds: curTeachers.map((t) => t.id),
                                  }));
                                }
                              }}
                              aria-label="Toggle strict faculty eligibility"
                              className={cn(
                                "w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 select-none",
                                windowForm.applicableTeacherIds.length > 0 ? "bg-blue-700 shadow-sm" : "bg-gray-300"
                              )}
                            >
                              <div
                                className={cn(
                                  "w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 ease-in-out",
                                  windowForm.applicableTeacherIds.length > 0 ? "translate-x-6" : "translate-x-0"
                                )}
                              />
                            </button>
                          </div>

                          {/* Quick Selection Toolbar when Strict Mode is Active */}
                          {windowForm.applicableTeacherIds.length > 0 && (
                            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                              <span className="text-[11px] font-bold text-blue-950">
                                Choose which teachers are required &amp; eligible for this schedule:
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setWindowForm({ ...windowForm, applicableTeacherIds: teachers.map((t) => t.id) })
                                  }
                                  className="text-[10px] font-bold text-blue-700 hover:text-blue-900 px-2 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 transition-all"
                                >
                                  Select All ({teachers.length})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setWindowForm({ ...windowForm, applicableTeacherIds: [] })}
                                  className="text-[10px] font-bold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 transition-all"
                                >
                                  Reset to All (Universal)
                                </button>
                              </div>
                            </div>
                          )}

                          <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text"
                              placeholder="Filter faculty by name, department, email..."
                              value={teacherFilterQuery}
                              onChange={(e) => setTeacherFilterQuery(e.target.value)}
                              className="w-full h-9 pl-8 pr-3 rounded-xl border border-blue-200 bg-white text-xs font-medium text-gray-800 outline-none focus:ring-2 focus:ring-blue-400/40"
                            />
                          </div>

                          <div className="max-h-52 overflow-y-auto space-y-1.5 bg-white p-2.5 rounded-2xl border border-blue-100 shadow-inner custom-scrollbar">
                            {loadingTeachers ? (
                              <div className="p-4 flex items-center justify-center gap-2 text-xs text-blue-700">
                                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                                <span>Loading faculty roster list...</span>
                              </div>
                            ) : teachers.length === 0 ? (
                              <div className="p-3 flex items-center justify-between gap-2">
                                <p className="text-xs text-gray-500">No faculty profiles loaded yet.</p>
                                <button
                                  type="button"
                                  onClick={() => fetchTeachers()}
                                  className="px-2.5 py-1 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold transition-all flex items-center gap-1"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                  Reload Roster
                                </button>
                              </div>
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
                                  const isStrictOn = windowForm.applicableTeacherIds.length > 0;
                                  const isChecked = !isStrictOn || windowForm.applicableTeacherIds.includes(t.id);
                                  return (
                                    <label
                                      key={t.id}
                                      className={cn(
                                        "flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-all border",
                                        isChecked
                                          ? "bg-blue-50/90 border-blue-400 text-blue-950 font-bold shadow-2xs"
                                          : "bg-gray-50/50 border-gray-100 text-gray-700 hover:bg-gray-100 opacity-60"
                                      )}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              if (!isStrictOn) {
                                                setWindowForm({
                                                  ...windowForm,
                                                  applicableTeacherIds: [t.id],
                                                });
                                              } else {
                                                setWindowForm({
                                                  ...windowForm,
                                                  applicableTeacherIds: [...windowForm.applicableTeacherIds, t.id],
                                                });
                                              }
                                            } else {
                                              if (!isStrictOn) {
                                                setWindowForm({
                                                  ...windowForm,
                                                  applicableTeacherIds: teachers.filter((item) => item.id !== t.id).map((item) => item.id),
                                                });
                                              } else {
                                                setWindowForm({
                                                  ...windowForm,
                                                  applicableTeacherIds: windowForm.applicableTeacherIds.filter((id) => id !== t.id),
                                                });
                                              }
                                            }
                                          }}
                                          className="rounded border-blue-400 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                        />
                                        <span className="truncate">{t.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <Badge variant="outline" className="text-[9px] font-mono text-gray-500">
                                          {t.department || "Faculty"}
                                        </Badge>
                                        <span className={`text-[10px] font-bold ${isChecked ? "text-blue-700" : "text-amber-700"}`}>
                                          {isChecked ? "Eligible" : "Un-eligible (Never Absent)"}
                                        </span>
                                      </div>
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
