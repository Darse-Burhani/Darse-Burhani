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
import { GoogleSheetSyncCard } from "@/components/admin/attendance/GoogleSheetSyncCard";

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
}: {
  startTime: string;
  endTime: string;
  lateEndTime?: string | null;
  accent?: "emerald" | "indigo" | "purple" | "blue";
}) {
  const parseMin = (t: string) => {
    if (!t) return 0;
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const sMin = parseMin(startTime);
  const eMin = parseMin(endTime);
  const lMin = lateEndTime ? parseMin(lateEndTime) : eMin;

  const onTimeDur = Math.max(0, eMin - sMin);
  const lateDur = Math.max(0, lMin - eMin);
  const totalSpan = Math.max(1, onTimeDur + lateDur);

  const onTimePct = Math.round((onTimeDur / totalSpan) * 100);
  const latePct = Math.round((lateDur / totalSpan) * 100);

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const isCurrentlyActive = nowMin >= sMin && nowMin <= lMin;

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
        <span className="flex items-center gap-1 font-mono text-amber-700">
          {lateEndTime || endTime}
        </span>
      </div>

      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden flex shadow-inner border border-gray-200/50">
        <div
          style={{ width: `${onTimePct}%` }}
          className={`h-full ${gradientClass} transition-all duration-500`}
          title={`On-Time: ${onTimeDur} min`}
        />
        {lateDur > 0 && (
          <div
            style={{ width: `${latePct}%` }}
            className="h-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-500"
            title={`Late Allowed: ${lateDur} min`}
          />
        )}
      </div>

      <div className="flex items-center justify-between text-[9px] text-gray-400 font-medium">
        <span>{onTimeDur}m On-Time Window</span>
        {lateDur > 0 && <span className="text-amber-700 font-bold">{lateDur}m Late Grace</span>}
        {isCurrentlyActive && (
          <span className="text-emerald-700 font-black animate-pulse flex items-center gap-0.5">
            ● Active Now
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
    startTime: "07:30",
    endTime: "08:30",
    lateEndTime: "09:00",
    graceMinutes: 10,
    enabled: true,
    applicableClassIds: [] as string[],
    useCustomFacultyTime: false,
    facultyStartTime: "07:30",
    facultyEndTime: "08:30",
    facultyLateEndTime: "09:00",
    applicableTeacherIds: [] as string[],
  });

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
          w.id === "default" ||
          w.id.startsWith("hik_") ||
          (w.windowType === "BOTH" && !w.id.startsWith("manual_"))
      );
    } else {
      list = list.filter(
        (w) =>
          w.windowType === "MANUAL" ||
          w.id.startsWith("manual_") ||
          (w.windowType === "BOTH" && w.id !== "default" && !w.id.startsWith("hik_"))
      );
    }

    // Audience filter
    if (audienceFilter === "STUDENT") {
      list = list.filter((w) => w.audience === "ALL_STUDENTS");
    } else if (audienceFilter === "TEACHER") {
      list = list.filter((w) => w.audience === "FACULTY");
    } else if (audienceFilter === "BOTH") {
      list = list.filter((w) => w.audience === "BOTH");
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
      const isFacultyOnly = w.audience === "FACULTY";
      const isDual = w.audience === "BOTH" || w.hasFacultyTimer;
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
        startTime: "07:30",
        endTime: "08:30",
        lateEndTime: "09:00",
        graceMinutes: 10,
        enabled: true,
        applicableClassIds: [],
        useCustomFacultyTime: false,
        facultyStartTime: "07:30",
        facultyEndTime: "08:30",
        facultyLateEndTime: "09:00",
        applicableTeacherIds: [],
      });
    }
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

      const payload: Record<string, any> = {
        name: windowForm.name.trim(),
        windowType: windowForm.windowType,
        startTime: windowForm.startTime,
        endTime: windowForm.endTime,
        lateEndTime: windowForm.lateEndTime || windowForm.endTime,
        graceMinutes: windowForm.graceMinutes,
        enabled: windowForm.enabled,
      };

      if (windowForm.audience === "STUDENT") {
        payload.applicableClassIds = windowForm.applicableClassIds;
        payload.facultyStartTime = null;
        payload.facultyEndTime = null;
        payload.facultyLateEndTime = null;
        payload.applicableTeacherIds = [];
      } else if (windowForm.audience === "TEACHER") {
        payload.applicableClassIds = [];
        payload.facultyStartTime = windowForm.startTime;
        payload.facultyEndTime = windowForm.endTime;
        payload.facultyLateEndTime = windowForm.lateEndTime || windowForm.endTime;
        payload.applicableTeacherIds = windowForm.applicableTeacherIds;
      } else {
        // BOTH (Talabat & Faculty)
        payload.applicableClassIds = windowForm.applicableClassIds;
        payload.applicableTeacherIds = windowForm.applicableTeacherIds;
        if (windowForm.useCustomFacultyTime) {
          payload.facultyStartTime = windowForm.facultyStartTime;
          payload.facultyEndTime = windowForm.facultyEndTime;
          payload.facultyLateEndTime = windowForm.facultyLateEndTime || windowForm.facultyEndTime;
        } else {
          payload.facultyStartTime = windowForm.startTime;
          payload.facultyEndTime = windowForm.endTime;
          payload.facultyLateEndTime = windowForm.lateEndTime || windowForm.endTime;
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
          { label: "Hikvision Device Hub", href: "/admin/biometric", icon: Fingerprint, badge: "Automated" },
          { label: "Manual Classroom Register", href: "/admin/manual-attendance", icon: ClipboardCheck },
          { label: "Attendance Logs & Verification", href: "/admin/attendance-logs", icon: FileText },
          { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
          { label: "Email Reports", href: "/admin/attendance-emails", icon: Mail },
        ]}
      />

      {/* ── Page Header Banner ── */}
      <div className="relative rounded-3xl p-6 sm:p-8 overflow-hidden bg-gradient-to-br from-[#042f24] via-[#094d37] to-[#021f18] border border-[#d4af37]/40 shadow-[0_12px_36px_rgba(2,44,34,0.35)]">
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
            { id: "ALL", label: "All Schedules", icon: Layers },
            { id: "STUDENT", label: "Talabat Only", icon: GraduationCap },
            { id: "TEACHER", label: "Faculty Only", icon: Shield },
            { id: "BOTH", label: "Dual (Both)", icon: Zap },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setAudienceFilter(pill.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border ${
                audienceFilter === pill.id
                  ? "bg-emerald-100 text-emerald-900 border-emerald-300 shadow-2xs"
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
              }`}
            >
              <pill.icon className="w-3 h-3" />
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
              const accentColor = isFaculty ? "blue" : isDual ? "purple" : "emerald";

              return (
                <Card
                  key={w.id}
                  className={`group relative overflow-hidden transition-all duration-300 rounded-3xl border bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 ${
                    w.enabled
                      ? isLive
                        ? "border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-emerald-500/10"
                        : "border-gray-200/90 hover:border-emerald-400"
                      : "opacity-60 bg-gray-50/80 border-gray-200"
                  }`}
                >
                  <div
                    className={`h-2 w-full ${
                      !w.enabled
                        ? "bg-gray-300"
                        : isFaculty
                        ? "bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400"
                        : isDual
                        ? "bg-gradient-to-r from-purple-600 via-indigo-500 to-emerald-400"
                        : "bg-gradient-to-r from-emerald-600 via-teal-500 to-amber-400"
                    }`}
                  />
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 ${
                          isFaculty
                            ? "bg-blue-100 text-blue-800 border border-blue-300"
                            : isDual
                            ? "bg-purple-100 text-purple-800 border border-purple-300"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        }`}
                      >
                        {isFaculty ? <Shield className="w-5 h-5" /> : isDual ? <Zap className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          {isLive && (
                            <span className="relative flex h-2.5 w-2.5 shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                          )}
                          <h3 className="font-bold text-base text-gray-900 leading-tight truncate">{w.name}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          {/* Audience Badge */}
                          {isFaculty ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-[10px] font-black flex items-center gap-1 py-0 px-2">
                              <Shield className="w-2.5 h-2.5 text-blue-600" />
                              <span>Faculty (Staff)</span>
                            </Badge>
                          ) : isDual ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-[10px] font-black flex items-center gap-1 py-0 px-2">
                              <Zap className="w-2.5 h-2.5 text-purple-600" />
                              <span>Dual: Talabat &amp; Faculty</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-black flex items-center gap-1 py-0 px-2">
                              <GraduationCap className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Talabat (Students)</span>
                            </Badge>
                          )}
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
                        <div className="w-7 h-7 rounded-xl bg-white flex items-center justify-center text-emerald-800 shadow-2xs border border-gray-200/60">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">
                            {isFaculty ? "Faculty Timing" : "Student Timing"}
                          </p>
                          <p className="text-sm font-black text-gray-900 font-mono">
                            {w.startTime} &rarr; {w.endTime}
                          </p>
                          {w.lateEndTime && w.lateEndTime !== w.endTime && (
                            <p className="text-xs font-bold text-amber-700 font-mono">
                              Late Cutoff: {w.lateEndTime}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Span</p>
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-white border border-gray-200 text-xs font-bold text-gray-800 font-mono">
                          {w.durationMinutes}m
                        </span>
                      </div>
                    </div>

                    {/* Faculty Timing details if Dual */}
                    {isDual && w.facultyStartTime && (
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

                    {/* Timeline Bar */}
                    <ScheduleTimelineBar
                      startTime={w.startTime}
                      endTime={w.endTime}
                      lateEndTime={w.lateEndTime}
                      accent={accentColor}
                    />

                    {/* Grace Period & Live Status */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Timer className="w-4 h-4 text-emerald-600" />
                        <span>
                          Grace: <strong>{w.graceMinutes} min</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shadow-2xs ${
                            !w.enabled
                              ? "bg-gray-100 text-gray-600 border-gray-300"
                              : isLive
                              ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                              : "bg-amber-50 text-amber-900 border-amber-300"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              !w.enabled ? "bg-gray-400" : isLive ? "bg-emerald-600 animate-pulse" : "bg-amber-500"
                            }`}
                          />
                          {!w.enabled ? "Disabled" : isLive ? "Active Live" : "Closed"}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleWindowActive(w)}
                          aria-label="Toggle window active state"
                          className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ease-out select-none active:scale-95 ${
                            w.enabled ? "bg-emerald-600 shadow-sm" : "bg-gray-300"
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

      {/* ── MODAL: Create / Edit Attendance Window ── */}
      <AnimatePresence>
        {windowModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="w-full max-w-xl max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0 bg-gradient-to-r from-emerald-50/50 via-white to-gray-50">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-300 shadow-2xs">
                    <Clock className="w-4 h-4" />
                  </div>
                  <span>{editingWindow ? "Edit Attendance Schedule" : "Add Attendance Schedule"}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setWindowModalOpen(false)}
                  className="text-gray-400 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-colors active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={saveWindow} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      Attendance Session Name:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Morning Tilawat, Dua Session, Faculty Check-In"
                      value={windowForm.name}
                      onChange={(e) => setWindowForm({ ...windowForm, name: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                    />
                  </div>

                  {/* 1. Target Scanning Audience Toggle */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      Target Audience / Scanning Scope:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setWindowForm({ ...windowForm, audience: "STUDENT" })}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                          windowForm.audience === "STUDENT"
                            ? "bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400/30 shadow-xs"
                            : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900">
                          <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Talabat Only</span>
                        </div>
                        <span className="text-[10px] text-gray-500 leading-tight">Students only</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWindowForm({ ...windowForm, audience: "TEACHER" })}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                          windowForm.audience === "TEACHER"
                            ? "bg-blue-50 border-blue-500 text-blue-950 ring-2 ring-blue-400/30 shadow-xs"
                            : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900">
                          <Shield className="w-3.5 h-3.5 text-blue-600" />
                          <span>Faculty Only</span>
                        </div>
                        <span className="text-[10px] text-gray-500 leading-tight">Teachers &amp; staff only</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWindowForm({ ...windowForm, audience: "BOTH" })}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                          windowForm.audience === "BOTH"
                            ? "bg-purple-50 border-purple-500 text-purple-950 ring-2 ring-purple-400/30 shadow-xs"
                            : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900">
                          <Zap className="w-3.5 h-3.5 text-purple-600" />
                          <span>Dual (Both)</span>
                        </div>
                        <span className="text-[10px] text-gray-500 leading-tight">Both Talabat &amp; Faculty</span>
                      </button>
                    </div>
                  </div>

                  {/* 2. Attendance Subsystem Mode */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      Subsystem Channel:
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setWindowForm({ ...windowForm, windowType: "HIKVISION" })}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                          windowForm.windowType === "HIKVISION"
                            ? "bg-purple-50 border-purple-500 text-purple-950 ring-2 ring-purple-400/30 shadow-xs"
                            : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900">
                          <Radio className="w-3.5 h-3.5 text-purple-600" />
                          <span>Hikvision Hardware Gate</span>
                        </div>
                        <span className="text-[10px] text-gray-500 leading-tight">Device facial scans &amp; punch terminals</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWindowForm({ ...windowForm, windowType: "MANUAL" })}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                          windowForm.windowType === "MANUAL"
                            ? "bg-emerald-50 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400/30 shadow-xs"
                            : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900">
                          <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Manual Classroom Roll Call</span>
                        </div>
                        <span className="text-[10px] text-gray-500 leading-tight">Teacher manual attendance register</span>
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Timeline Preview inside Modal */}
                  <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Live Timing Preview</span>
                    <ScheduleTimelineBar
                      startTime={windowForm.startTime}
                      endTime={windowForm.endTime}
                      lateEndTime={windowForm.lateEndTime}
                      accent={windowForm.audience === "TEACHER" ? "blue" : windowForm.audience === "BOTH" ? "purple" : "emerald"}
                    />
                  </div>

                  {/* Primary Timing (Talabat / Shared) */}
                  <div className="space-y-3 p-3.5 bg-gray-50/70 rounded-2xl border border-gray-200">
                    <p className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-700" />
                      <span>{windowForm.audience === "TEACHER" ? "Faculty Shift Timing" : "Primary Attendance Window"}</span>
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 block mb-1">On-Time From (24h):</label>
                        <input
                          type="time"
                          required
                          value={windowForm.startTime}
                          onChange={(e) => setWindowForm({ ...windowForm, startTime: e.target.value })}
                          className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-gray-700 block mb-1">On-Time To (24h):</label>
                        <input
                          type="time"
                          required
                          value={windowForm.endTime}
                          onChange={(e) => setWindowForm({ ...windowForm, endTime: e.target.value })}
                          className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 block mb-1">Late Till (24h, optional):</label>
                        <input
                          type="time"
                          value={windowForm.lateEndTime || ""}
                          onChange={(e) => setWindowForm({ ...windowForm, lateEndTime: e.target.value })}
                          className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                          placeholder="e.g. 09:00"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-gray-700 block mb-1">Grace Period (Min):</label>
                        <input
                          type="number"
                          min="0"
                          max="180"
                          required
                          value={windowForm.graceMinutes}
                          onChange={(e) =>
                            setWindowForm({ ...windowForm, graceMinutes: Number(e.target.value) })
                          }
                          className="w-full h-10 px-3 rounded-xl border border-gray-300 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Optional Custom Faculty Shift for Dual Mode */}
                  {windowForm.audience === "BOTH" && (
                    <div className="space-y-3 p-3.5 bg-purple-50/50 rounded-2xl border border-purple-200">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-purple-950 flex items-center gap-1.5 cursor-pointer">
                          <Shield className="w-3.5 h-3.5 text-purple-700" />
                          <span>Separate Timing for Faculty?</span>
                        </label>
                        <input
                          type="checkbox"
                          checked={windowForm.useCustomFacultyTime}
                          onChange={(e) =>
                            setWindowForm({ ...windowForm, useCustomFacultyTime: e.target.checked })
                          }
                          className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                        />
                      </div>

                      {windowForm.useCustomFacultyTime && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-purple-100">
                          <div>
                            <label className="text-[10px] font-bold text-purple-900 block mb-1">Faculty From:</label>
                            <input
                              type="time"
                              value={windowForm.facultyStartTime}
                              onChange={(e) =>
                                setWindowForm({ ...windowForm, facultyStartTime: e.target.value })
                              }
                              className="w-full h-9 px-2 rounded-xl border border-purple-200 text-xs font-mono font-bold text-gray-900 bg-white"
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
                              className="w-full h-9 px-2 rounded-xl border border-purple-200 text-xs font-mono font-bold text-gray-900 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-purple-900 block mb-1">Faculty Late:</label>
                            <input
                              type="time"
                              value={windowForm.facultyLateEndTime}
                              onChange={(e) =>
                                setWindowForm({ ...windowForm, facultyLateEndTime: e.target.value })
                              }
                              className="w-full h-9 px-2 rounded-xl border border-purple-200 text-xs font-mono font-bold text-gray-900 bg-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Class Scope (for Talabat and Dual) */}
                  {(windowForm.audience === "STUDENT" || windowForm.audience === "BOTH") && (
                    <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <GraduationCap className="w-4 h-4 text-emerald-700" />
                          <span>Talabat Class Attendance Scope</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setWindowForm({ ...windowForm, applicableClassIds: [] })}
                          className="text-[11px] font-bold text-emerald-700 hover:underline active:scale-95"
                        >
                          Select All (Default)
                        </button>
                      </div>
                      <p className="text-[11px] text-emerald-900 leading-snug">
                        Choose which classes must attend this session.
                        <strong> Empty = applies to all classes.</strong>
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1 bg-white p-2.5 rounded-xl border border-emerald-100 shadow-inner custom-scrollbar">
                        {classes.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-emerald-50/80 rounded-lg px-2 py-1 text-xs text-gray-800">
                            <input
                              type="checkbox"
                              checked={windowForm.applicableClassIds.includes(c.id)}
                              onChange={(e) =>
                                setWindowForm({
                                  ...windowForm,
                                  applicableClassIds: e.target.checked
                                    ? [...windowForm.applicableClassIds, c.id]
                                    : windowForm.applicableClassIds.filter((id) => id !== c.id),
                                })
                              }
                              className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500"
                            />
                            <span className="font-semibold">{c.name}</span>
                            <span className="text-[10px] text-gray-500">Grade {c.grade}-{c.section}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Teacher Scope (for Faculty and Dual) */}
                  {(windowForm.audience === "TEACHER" || windowForm.audience === "BOTH") && (
                    <div className="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                          <Shield className="w-4 h-4 text-blue-700" />
                          <span>Faculty Member Scope</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setWindowForm({ ...windowForm, applicableTeacherIds: [] })}
                          className="text-[11px] font-bold text-blue-700 hover:underline active:scale-95"
                        >
                          Select All Faculty (Default)
                        </button>
                      </div>
                      <p className="text-[11px] text-blue-900 leading-snug">
                        Choose which teachers/staff are expected.
                        <strong> Empty = applies to all faculty members.</strong>
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1 bg-white p-2.5 rounded-xl border border-blue-100 shadow-inner custom-scrollbar">
                        {teachers.length === 0 ? (
                          <p className="text-xs text-gray-400 p-2">All active faculty included by default.</p>
                        ) : (
                          teachers.map((t) => (
                            <label key={t.id} className="flex items-center gap-2 cursor-pointer hover:bg-blue-50/80 rounded-lg px-2 py-1 text-xs text-gray-800">
                              <input
                                type="checkbox"
                                checked={windowForm.applicableTeacherIds.includes(t.id)}
                                onChange={(e) =>
                                  setWindowForm({
                                    ...windowForm,
                                    applicableTeacherIds: e.target.checked
                                      ? [...windowForm.applicableTeacherIds, t.id]
                                      : windowForm.applicableTeacherIds.filter((id) => id !== t.id),
                                  })
                                }
                                className="rounded border-blue-400 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="font-semibold">{t.name}</span>
                              <span className="text-[10px] text-gray-500 font-mono">({t.department || t.email})</span>
                            </label>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWindowModalOpen(false)}
                    disabled={savingWindow}
                    className="rounded-xl border-gray-200 text-xs font-bold"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingWindow}
                    className="bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-800/20"
                  >
                    {savingWindow ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        <span>{editingWindow ? "Update Schedule" : "Create Schedule"}</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
