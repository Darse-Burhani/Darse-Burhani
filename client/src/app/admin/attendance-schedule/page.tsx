"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Plus,
  Trash2,
  Edit2,
  Users,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Sparkles,
  Loader2,
  RefreshCw,
  Check,
  X,
  FileSpreadsheet,
  FileText,
  Timer,
  ShieldCheck,
  Fingerprint,
  Mail,
  Stethoscope,
  Radio,
  Activity,
  Zap,
  Volume2,
  Bell,
  GraduationCap,
  UserCheck,
  UserX,
  Download,
  CalendarDays,
  Calendar,
  Play,
  CheckCheck,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  audience?: "ALL_STUDENTS" | "FACULTY" | "BOTH" | string;
  applicableTeacherIds?: string[];
  exemptTeacherIds?: string[];
  applicableClassIds?: string[];
  exemptStudentIds?: string[];
  applicableClasses?: Array<{ id: string; name: string; grade: string; section: string }>;
  applicableTeachers?: Array<{ id: string; name: string }>;
  // Unified-event faculty timer (same event, side-by-side with Talabat timer)
  facultyStartTime?: string | null;
  facultyEndTime?: string | null;
  facultyLateEndTime?: string | null;
  facultyEnabled?: boolean;
  hasFacultyTimer?: boolean;
  facultyStatus?: "ACTIVE" | "UPCOMING" | "CLOSED" | "NONE";
  facultyPhase?: "ON_TIME" | "LATE" | null;
  createdAt: string;
  updatedAt: string;
}

interface FacultyMember {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  active: boolean;
  enrolled: boolean;
}

interface TimetableSlot {
  id: string;
  classId: string | null;
  className: string;
  grade: string;
  section: string;
  subject: string;
  teacherName: string;
  dayOfWeek: number;
  period: number;
  startTime: string;
  endTime: string;
  roomNumber: string | null;
  isBreak: boolean;
  breakName: string | null;
}

interface ClassItem {
  id: string;
  name: string;
  grade: string;
  section: string;
  subject: string;
  teacherName: string;
}

const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
  accent?: "emerald" | "indigo";
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

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500">
        <span className="flex items-center gap-1 font-mono text-gray-700">
          <span className={`w-1.5 h-1.5 rounded-full ${accent === "indigo" ? "bg-indigo-600" : "bg-emerald-600"}`} />
          {startTime}
        </span>
        <span className="flex items-center gap-1 font-mono text-amber-700">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          {endTime} (On-Time)
        </span>
        {lateEndTime && lateEndTime !== endTime && (
          <span className="flex items-center gap-1 font-mono text-rose-600">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            {lateEndTime} (Cutoff)
          </span>
        )}
      </div>

      {/* Segmented Timeline Bar */}
      <div className="relative h-2.5 w-full rounded-full bg-gray-100 overflow-hidden flex shadow-inner border border-gray-200/60">
        <div
          style={{ width: `${lateDur > 0 ? onTimePct : 100}%` }}
          className={`h-full ${
            accent === "indigo"
              ? "bg-gradient-to-r from-indigo-500 to-indigo-600"
              : "bg-gradient-to-r from-emerald-500 to-teal-500"
          } transition-all duration-500`}
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

/**
 * Shimmer Loading Skeleton
 */
function WindowSkeleton() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-gray-200/80 bg-white p-5 shadow-sm space-y-4 animate-pulse"
        >
          <div className="flex items-center justify-between">
            <div className="h-5 w-36 bg-gray-200 rounded-lg" />
            <div className="h-4 w-12 bg-gray-200 rounded-full" />
          </div>
          <div className="h-16 bg-gray-100 rounded-xl" />
          <div className="h-4 w-full bg-gray-100 rounded-full" />
          <div className="flex justify-between">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-4 w-24 bg-gray-200 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminAttendanceSchedulePage() {
  const [activeTab, setActiveTab] = useState<"ALL_STUDENTS" | "FACULTY" | "CLASSES">("ALL_STUDENTS");
  const [loading, setLoading] = useState(true);

  // Scan Windows state (Students & Faculty)
  const [windows, setWindows] = useState<ScanWindow[]>([]);
  const [windowModalOpen, setWindowModalOpen] = useState(false);
  const [editingWindow, setEditingWindow] = useState<ScanWindow | null>(null);
  const [windowForm, setWindowForm] = useState({
    name: "",
    startTime: "07:30",
    endTime: "08:30",
    lateEndTime: "09:00",
    graceMinutes: 10,
    enabled: true,
    audience: "ALL_STUDENTS" as "ALL_STUDENTS" | "FACULTY",
    applicableTeacherIds: [] as string[],
    exemptTeacherIds: [] as string[],
    applicableClassIds: [] as string[],
    exemptStudentIds: [] as string[],
    facultyTimerEnabled: true,
    facultyStartTime: "07:30",
    facultyEndTime: "08:45",
    facultyLateEndTime: "09:00",
    facultyEnabled: true,
  });
  const [savingWindow, setSavingWindow] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Classes Timetable state
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedDay, setSelectedDay] = useState(0); // Sunday default
  const [classFilter, setClassFilter] = useState("ALL");
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [slotForm, setSlotForm] = useState({
    classId: "",
    dayOfWeek: 0,
    period: 1,
    subject: "",
    startTime: "08:00",
    endTime: "08:45",
    roomNumber: "",
    isBreak: false,
    breakName: "",
  });
  const [savingSlot, setSavingSlot] = useState(false);

  // Download export state
  const [exporting, setExporting] = useState(false);

  // Sound audition test state
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [desktopNotifState, setDesktopNotifState] = useState<NotificationPermission>("default");

  // Faculty applicability roster + faculty auto-absent governance
  const [facultyList, setFacultyList] = useState<FacultyMember[]>([]);
  const [facultyAbsentPreview, setFacultyAbsentPreview] = useState<{
    totalExpected: number;
    loggedCount: number;
    medicalCount?: number;
    unscannedCount: number;
    outOfRosterCount: number;
    rosterScoped: boolean;
    targetDate: string;
    unscannedTeachers: Array<{ id: string; name: string }>;
  } | null>(null);
  const [markingFacultyAbsent, setMarkingFacultyAbsent] = useState(false);

  // Check notification permission on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setDesktopNotifState(Notification.permission);
    }
  }, []);

  // Fetch All Students Windows
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

  // Fetch Class Timetable Slots
  const fetchClassSchedule = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/attendance/schedule/classes");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setSlots(json.data.slots || []);
          setClasses(json.data.classes || []);
        }
      }
    } catch {
      toast({ title: "Failed to load class attendance schedule", variant: "destructive" });
    }
  }, []);

  // Fetch faculty directory
  const fetchFacultyList = useCallback(async () => {
    try {
      const res = await fetch("/api/biometric/teachers");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) setFacultyList(json.data);
      }
    } catch {
      // silent fallback
    }
  }, []);

  // Fetch Faculty Auto-Mark Absent Preview
  const fetchFacultyAbsentPreview = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/attendance/schedule/faculty-absent-preview");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setFacultyAbsentPreview(json.data);
      }
    } catch {
      // silent fallback
    }
  }, []);

  // Trigger On-Demand Faculty Auto-Mark Absent Job
  const handleTriggerFacultyAutoMarkAbsent = async () => {
    if (!facultyAbsentPreview) return;
    if (
      !confirm(
        `Mark ${facultyAbsentPreview.unscannedCount} unscanned faculty as ABSENT for today? Teachers outside the applicability roster are skipped.`,
      )
    ) {
      return;
    }

    setMarkingFacultyAbsent(true);
    try {
      const res = await fetch("/api/admin/attendance/schedule/auto-mark-faculty-absent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Faculty Auto-Mark Absent Executed",
          description: `Marked ${json.data.markedCount} faculty as absent (${json.data.skippedCount} out of roster skipped).`,
          variant: "success",
        });
        fetchFacultyAbsentPreview();
        fetchWindows();
      } else {
        toast({ title: json.error || "Failed to execute faculty auto-mark absent", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error executing faculty auto-mark absent", variant: "destructive" });
    } finally {
      setMarkingFacultyAbsent(false);
    }
  };

  // Ultra-Fast Progressive Loader: Primary data unlocks UI immediately
  const loadData = useCallback(async () => {
    try {
      await Promise.allSettled([fetchWindows(), fetchClassSchedule()]);
    } finally {
      setLoading(false);
    }
    // Background load secondary rosters without blocking visual paint
    Promise.allSettled([fetchFacultyList(), fetchFacultyAbsentPreview()]);
  }, [fetchWindows, fetchClassSchedule, fetchFacultyList, fetchFacultyAbsentPreview]);

  // Real-Time Biometric Scan Event Stream
  const [realTimeConnected, setRealTimeConnected] = useState(false);
  const [latestScan, setLatestScan] = useState<{
    name: string;
    role: string;
    status: string;
    time: string;
    message?: string;
  } | null>(null);

  useEffect(() => {
    let es: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connectSSE() {
      try {
        es = new EventSource("/api/biometric/events/stream");
        es.onopen = () => {
          setRealTimeConnected(true);
        };
        es.onmessage = (e) => {
          try {
            if (!e.data || e.data.startsWith(":")) return;
            const data = JSON.parse(e.data);
            if (
              data.type === "SCAN_LOGGED" ||
              data.type === "WEBHOOK_SCAN" ||
              data.type === "MOCK_SCAN" ||
              data.type === "SCAN_EVENT" ||
              data.type === "MATCHED" ||
              data.type === "DUPLICATE" ||
              data.type === "UNKNOWN" ||
              data.type === "TOO_EARLY" ||
              data.student ||
              data.teacher
            ) {
              const name =
                data.student?.name ||
                data.teacher?.name ||
                data.studentName ||
                data.teacherName ||
                data.personName ||
                data.name ||
                "Member";
              const role =
                data.role ||
                (data.teacher || data.teacherName ? "Faculty" : "Talabat");
              const status =
                data.attendanceStatus ||
                data.status ||
                data.student?.status ||
                data.teacher?.status ||
                "PRESENT";
              const time = new Date().toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
              const message = data.message || "";
              setLatestScan({ name, role, status, time, message });

              // Harmonic Bell Audio chime on live scan punch
              playSmoothChime(status === "LATE" ? "alert" : "arrival");

              // Refresh counts without full loading flicker
              fetchFacultyAbsentPreview();
            }
          } catch {
            // Ignore malformed messages
          }
        };
        es.onerror = () => {
          setRealTimeConnected(false);
          es?.close();
          reconnectTimeout = setTimeout(connectSSE, 5000);
        };
      } catch {
        setRealTimeConnected(false);
      }
    }

    connectSSE();
    return () => {
      es?.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [fetchFacultyAbsentPreview]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal to create/edit window
  const openWindowModal = (w?: ScanWindow, defaultAudience?: "ALL_STUDENTS" | "FACULTY") => {
    if (w) {
      setEditingWindow(w);
      const isLegacyFaculty = (w.audience === "FACULTY" || w.id === "faculty_default") && !w.hasFacultyTimer;
      const hasFac = Boolean(w.facultyStartTime && w.facultyEndTime) || isLegacyFaculty;
      setWindowForm({
        name: w.name,
        startTime: w.startTime,
        endTime: w.endTime,
        lateEndTime: w.lateEndTime ?? w.endTime,
        graceMinutes: w.graceMinutes,
        enabled: w.enabled,
        audience: isLegacyFaculty ? "FACULTY" : "ALL_STUDENTS",
        applicableTeacherIds: w.applicableTeacherIds || [],
        exemptTeacherIds: w.exemptTeacherIds || [],
        applicableClassIds: w.applicableClassIds || [],
        exemptStudentIds: w.exemptStudentIds || [],
        facultyTimerEnabled: hasFac,
        facultyStartTime: w.facultyStartTime || (isLegacyFaculty ? w.startTime : "07:30"),
        facultyEndTime: w.facultyEndTime || (isLegacyFaculty ? w.endTime : "08:45"),
        facultyLateEndTime: w.facultyLateEndTime || w.facultyEndTime || (isLegacyFaculty ? (w.lateEndTime ?? w.endTime) : "09:00"),
        facultyEnabled: w.facultyEnabled ?? true,
      });
    } else {
      setEditingWindow(null);
      const aud = defaultAudience || (activeTab === "FACULTY" ? "FACULTY" : "ALL_STUDENTS");
      setWindowForm({
        name: aud === "FACULTY" ? "Faculty Reporting & Briefing" : "",
        startTime: aud === "FACULTY" ? "07:30" : "07:00",
        endTime: aud === "FACULTY" ? "08:15" : "08:15",
        lateEndTime: aud === "FACULTY" ? "09:00" : "08:15",
        graceMinutes: aud === "FACULTY" ? 15 : 10,
        enabled: true,
        audience: aud,
        applicableTeacherIds: [],
        exemptTeacherIds: [],
        applicableClassIds: [],
        exemptStudentIds: [],
        facultyTimerEnabled: true,
        facultyStartTime: "07:30",
        facultyEndTime: "08:45",
        facultyLateEndTime: "09:00",
        facultyEnabled: true,
      });
    }
    setWindowModalOpen(true);
  };

  // Save window
  const saveWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!windowForm.name.trim()) {
      toast({ title: "Please enter attendance name", variant: "destructive" });
      return;
    }

    setSavingWindow(true);
    try {
      const url = editingWindow
        ? `/api/admin/attendance/schedule/windows/${editingWindow.id}`
        : "/api/admin/attendance/schedule/windows";
      const method = editingWindow ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...windowForm,
          role: windowForm.audience === "FACULTY" ? "TEACHER" : "STUDENT",
          ...(windowForm.facultyTimerEnabled
            ? {
                facultyStartTime: windowForm.facultyStartTime,
                facultyEndTime: windowForm.facultyEndTime,
                facultyLateEndTime: windowForm.facultyLateEndTime || windowForm.facultyEndTime,
                facultyEnabled: windowForm.facultyEnabled,
              }
            : { facultyStartTime: "", facultyEndTime: "", facultyLateEndTime: "", facultyEnabled: true }),
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: editingWindow ? "Schedule Updated" : "Schedule Created",
          description: `Attendance window "${windowForm.name}" is now live.`,
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
  const toggleWindowActive = async (w: ScanWindow, toggleFacultyTimerOnly = false) => {
    try {
      if (toggleFacultyTimerOnly && (w.hasFacultyTimer || w.facultyStartTime)) {
        const nextFac = !(w.facultyEnabled ?? true);
        const res = await fetch(`/api/admin/attendance/schedule/windows/${w.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...w, facultyEnabled: nextFac }),
        });
        const json = await res.json();
        if (json.success) {
          toast({
            title: nextFac ? "Faculty Timer Enabled" : "Faculty Timer Paused",
            description: `Faculty check-in for "${w.name}" is now ${nextFac ? "active" : "paused"}.`,
            variant: "success",
          });
          fetchWindows();
        }
        return;
      }

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
          description: `Attendance window "${w.name}" is now ${nextState ? "active" : "inactive"}.`,
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
    if (!confirm("Are you sure you want to delete this attendance scan window?")) return;
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

  // Open class timetable modal
  const openSlotModal = (slot?: TimetableSlot) => {
    if (slot) {
      setEditingSlot(slot);
      setSlotForm({
        classId: slot.classId || (classes[0]?.id ?? ""),
        dayOfWeek: slot.dayOfWeek,
        period: slot.period,
        subject: slot.subject,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomNumber: slot.roomNumber || "",
        isBreak: slot.isBreak,
        breakName: slot.breakName || "",
      });
    } else {
      setEditingSlot(null);
      setSlotForm({
        classId: classes[0]?.id ?? "",
        dayOfWeek: selectedDay,
        period: (filteredSlots.length || 0) + 1,
        subject: "",
        startTime: "08:00",
        endTime: "08:45",
        roomNumber: "",
        isBreak: false,
        breakName: "",
      });
    }
    setClassModalOpen(true);
  };

  // Save Class slot
  const saveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSlot(true);
    try {
      const res = await fetch("/api/admin/timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingSlot?.id,
          ...slotForm,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: editingSlot ? "Class Schedule Updated" : "Class Period Added",
          variant: "success",
        });
        setClassModalOpen(false);
        fetchClassSchedule();
      } else {
        toast({ title: json.error || "Failed to save class schedule", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save slot", variant: "destructive" });
    } finally {
      setSavingSlot(false);
    }
  };

  // Delete Class slot
  const deleteSlot = async (id: string) => {
    if (!confirm("Are you sure you want to remove this timetable attendance slot?")) return;
    try {
      const res = await fetch(`/api/admin/timetable?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Period Removed", variant: "success" });
        fetchClassSchedule();
      } else {
        toast({ title: json.error || "Failed to delete slot", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete slot", variant: "destructive" });
    }
  };

  // Download as Excel Sheet
  const downloadExcel = async (type: "ALL_STUDENTS" | "FACULTY" | "CLASSES" | "ROSTER") => {
    setExporting(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const exportType = type === "FACULTY" ? "FACULTY" : type === "CLASSES" ? "CLASSES" : "ROSTER";
      const url = `/api/admin/attendance/schedule/export?type=${exportType}&date=${todayStr}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download =
        type === "CLASSES"
          ? `Class_Attendance_Schedule_${todayStr}.csv`
          : type === "FACULTY"
          ? `Faculty_Attendance_Schedule_${todayStr}.csv`
          : `Attendance_Roster_${todayStr}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast({
        title: "Excel Sheet Downloaded",
        description: `Successfully exported ${type.toLowerCase().replace("_", " ")} schedule spreadsheet.`,
        variant: "success",
      });
    } catch {
      toast({ title: "Failed to download spreadsheet", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  // Test notification sound
  const handleTestSound = () => {
    setIsPlayingSound(true);
    playSmoothChime("arrival");
    sendDesktopNotification({
      title: "Darse Burhani • Audio Test",
      body: "Harmonic bell chime notification verified at 0ms latency.",
      soundType: "arrival",
    });
    setTimeout(() => setIsPlayingSound(false), 800);
  };

  // Enable desktop notifications
  const handleEnableDesktopNotifs = async () => {
    const perm = await requestDesktopNotificationPermission();
    setDesktopNotifState(perm);
    if (perm === "granted") {
      toast({
        title: "Desktop Alerts Enabled",
        description: "You will receive background attendance alerts outside the browser.",
        variant: "success",
      });
      playSmoothChime("arrival");
    } else {
      toast({
        title: "Permission Required",
        description: "Please allow notifications in browser site settings.",
        variant: "destructive",
      });
    }
  };

  // Filtered slots for selected day and class
  const filteredSlots = useMemo(() => {
    return slots
      .filter((s) => s.dayOfWeek === selectedDay)
      .filter((s) => (classFilter === "ALL" ? true : s.classId === classFilter));
  }, [slots, selectedDay, classFilter]);

  const studentWindows = useMemo(() => {
    return windows;
  }, [windows]);

  const facultyWindows = useMemo(() => {
    return windows.filter((w) => w.hasFacultyTimer || w.audience === "FACULTY" || w.id === "faculty_default");
  }, [windows]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* ── Attendance Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Attendance & Biometrics"
        hubDescription="Real-time terminal monitoring, daily scan windows, class schedules, and automated email reporting."
        tabs={[
          { label: "Live Scans & Attendance Logs", href: "/admin/attendance-logs", icon: FileText },
          { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
          { label: "Live Feeds & Terminals", href: "/admin/biometric", icon: Fingerprint },
          { label: "Email Reports to Parents", href: "/admin/attendance-emails", icon: Mail },
        ]}
      />

      {/* ── Page Header Banner with Audio Audition & Actions ── */}
      <div className="relative rounded-3xl p-6 sm:p-8 overflow-hidden bg-gradient-to-br from-[#042f24] via-[#094d37] to-[#021f18] border border-[#d4af37]/40 shadow-[0_12px_36px_rgba(2,44,34,0.35)]">
        <div className="absolute -right-12 -bottom-12 w-80 h-80 rounded-full bg-[#d4af37]/15 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Clock className="w-40 h-40 text-white stroke-[1.2]" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#fff2b2] text-xs font-black tracking-wider uppercase mb-3 shadow-inner">
              <Sparkles className="w-3.5 h-3.5 text-[#fde047] animate-pulse" />
              <span>Attendance Automation Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white font-display tracking-tight">
              Attendance Schedule &amp; Timing
            </h1>
            <p className="text-emerald-100/90 text-sm mt-1.5 max-w-2xl font-medium leading-relaxed">
              Configure attendance sessions, scan windows, start/end times, and grace periods for Talabat, Faculty, and Classes.
            </p>
          </div>

          {/* Action Buttons & Sound Audition */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Smooth Sound Audition Pill */}
            <Button
              onClick={handleTestSound}
              disabled={isPlayingSound}
              variant="glass"
              className="text-xs font-bold h-10 px-4 rounded-xl transition-all flex items-center gap-2"
              title="Audition smooth 0ms harmonic bell notification sound"
            >
              <span className={`p-1 rounded-lg bg-emerald-500/20 text-emerald-300 transition-transform duration-300 ${isPlayingSound ? "scale-125 text-[#fde047]" : "group-hover:scale-110"}`}>
                <Volume2 className="w-4 h-4" />
              </span>
              <span>{isPlayingSound ? "Playing Bell..." : "Test Audio Bell"}</span>
            </Button>

            {/* Desktop Notification Activator */}
            {desktopNotifState !== "granted" && (
              <Button
                onClick={handleEnableDesktopNotifs}
                variant="outline"
                className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/50 text-xs font-bold h-10 px-3.5 rounded-xl backdrop-blur-md transition-all flex items-center gap-2"
                title="Enable OS Desktop Notifications outside the browser"
              >
                <span className="p-1 rounded-lg bg-amber-400/20 text-amber-300">
                  <Bell className="w-4 h-4 animate-bounce" />
                </span>
                <span>Enable OS Alerts</span>
              </Button>
            )}

            <Button
              onClick={() => (window.location.href = "/teacher/medical-duty")}
              variant="default"
              className="text-xs font-bold h-10 px-4 rounded-xl flex items-center gap-2"
            >
              <span className="p-1 rounded-lg bg-emerald-700/60 text-emerald-200">
                <Stethoscope className="w-3.5 h-3.5" />
              </span>
              <span>Health Duty</span>
            </Button>

            <Button
              onClick={() => downloadExcel(activeTab)}
              disabled={exporting}
              variant="fatimi-gold"
              className="text-xs font-black h-10 px-4 rounded-xl shadow-lg"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              )}
              <span>Download Sheet</span>
            </Button>

            <Button
              onClick={loadData}
              variant="glass"
              className="h-10 w-10 p-0 rounded-xl"
              title="Refresh attendance schedule and status"
            >
              <RefreshCw className={`w-4 h-4 transition-transform ${loading ? "animate-spin" : "group-hover:rotate-180 duration-500"}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Daily Google Sheet Online Sync Station ── */}
      <GoogleSheetSyncCard />

      {/* ── Real-Time Gateway Feed Pulse & Pop-In Live Scan Ticker ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white/90 backdrop-blur-md border border-gray-200/90 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200">
            <span className={`w-2.5 h-2.5 rounded-full ${realTimeConnected ? "bg-emerald-500" : "bg-amber-500"}`} />
            {realTimeConnected && (
              <span className="absolute w-5 h-5 rounded-full bg-emerald-400/40 animate-ping" />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${realTimeConnected ? "text-emerald-600 animate-pulse" : "text-amber-500"}`} />
            <span className="text-xs font-bold text-gray-900">
              {realTimeConnected ? "Live Biometric Gateway Connected (24/7)" : "Connecting to Live Event Stream..."}
            </span>
            <Badge variant="outline" className={`text-[10px] font-extrabold ${realTimeConnected ? "bg-emerald-50 text-emerald-800 border-emerald-300" : "bg-amber-50 text-amber-800 border-amber-300"}`}>
              {realTimeConnected ? "SSE Active" : "Polling"}
            </Badge>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {latestScan ? (
            <motion.div
              key={`${latestScan.name}-${latestScan.time}`}
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border border-emerald-200 text-xs font-medium text-emerald-950 shadow-sm"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-700 text-white font-black text-[10px] flex items-center justify-center shadow-xs">
                {latestScan.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-500 text-[11px]">Latest Scan:</span>
                <strong className="font-bold text-gray-900">{latestScan.name}</strong>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-white font-bold border border-emerald-200 text-emerald-800">
                {latestScan.role}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold ${
                  latestScan.status === "LATE"
                    ? "bg-amber-100 text-amber-800 border-amber-300"
                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                }`}
              >
                {latestScan.status}
              </Badge>
              <span className="text-[10px] text-gray-400 font-mono">{latestScan.time}</span>
            </motion.div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
              <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>Awaiting device punches...</span>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main Tab Switcher Toggle ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center p-1.5 bg-gray-100/90 rounded-2xl border border-gray-200/90 w-fit flex-wrap gap-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab("ALL_STUDENTS")}
            className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 select-none active:scale-[0.97] ${
              activeTab === "ALL_STUDENTS"
                ? "bg-white text-emerald-950 shadow-md border border-gray-200 font-black ring-1 ring-emerald-500/20"
                : "text-gray-600 hover:text-gray-950 hover:bg-white/60"
            }`}
          >
            <span className={`flex items-center justify-center w-6 h-6 rounded-lg transition-transform group-hover:scale-110 ${activeTab === "ALL_STUDENTS" ? "bg-emerald-100 text-emerald-800" : "bg-gray-200/70 text-gray-600"}`}>
              <Users className="w-3.5 h-3.5" />
            </span>
            <span>Talabat Windows</span>
            <Badge variant="outline" className="ml-1 bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-extrabold">
              {studentWindows.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("FACULTY")}
            className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 select-none active:scale-[0.97] ${
              activeTab === "FACULTY"
                ? "bg-white text-indigo-950 shadow-md border border-gray-200 font-black ring-1 ring-indigo-500/20"
                : "text-gray-600 hover:text-gray-950 hover:bg-white/60"
            }`}
          >
            <span className={`flex items-center justify-center w-6 h-6 rounded-lg transition-transform group-hover:scale-110 ${activeTab === "FACULTY" ? "bg-indigo-100 text-indigo-800" : "bg-gray-200/70 text-gray-600"}`}>
              <ShieldCheck className="w-3.5 h-3.5" />
            </span>
            <span>Faculty Role Timer</span>
            <Badge variant="outline" className="ml-1 bg-indigo-50 text-indigo-800 border-indigo-200 text-[10px] font-extrabold">
              {facultyWindows.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("CLASSES")}
            className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 select-none active:scale-[0.97] ${
              activeTab === "CLASSES"
                ? "bg-white text-emerald-950 shadow-md border border-gray-200 font-black ring-1 ring-emerald-500/20"
                : "text-gray-600 hover:text-gray-950 hover:bg-white/60"
            }`}
          >
            <span className={`flex items-center justify-center w-6 h-6 rounded-lg transition-transform group-hover:scale-110 ${activeTab === "CLASSES" ? "bg-emerald-100 text-emerald-800" : "bg-gray-200/70 text-gray-600"}`}>
              <BookOpen className="w-3.5 h-3.5" />
            </span>
            <span>Class Timetable</span>
            <Badge variant="outline" className="ml-1 bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-extrabold">
              {slots.length}
            </Badge>
          </button>
        </div>

        {/* Create button according to active tab */}
        {activeTab === "ALL_STUDENTS" ? (
          <Button
            onClick={() => openWindowModal(undefined, "ALL_STUDENTS")}
            variant="default"
            className="text-xs font-bold shadow-md rounded-xl h-10 px-4 flex items-center gap-2"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" />
            <span>Add Talabat Window</span>
          </Button>
        ) : activeTab === "FACULTY" ? (
          <Button
            onClick={() => openWindowModal(undefined, "FACULTY")}
            variant="fatimi-lapis"
            className="text-xs font-bold shadow-md rounded-xl h-10 px-4 flex items-center gap-2"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" />
            <span>Add Faculty Role Timer</span>
          </Button>
        ) : (
          <Button
            onClick={() => openSlotModal()}
            variant="default"
            className="text-xs font-bold shadow-md rounded-xl h-10 px-4 flex items-center gap-2"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" />
            <span>Add Class Period Slot</span>
          </Button>
        )}
      </div>

      {/* ── TAB 1: ALL STUDENTS GENERAL ATTENDANCE SCHEDULE ── */}
      {loading ? (
        <WindowSkeleton />
      ) : activeTab === "ALL_STUDENTS" ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {studentWindows.map((w) => {
              const isLive = w.status === "ACTIVE" || w.status === "GRACE_PERIOD";
              return (
                <Card
                  key={w.id}
                  className={`group relative overflow-hidden transition-all duration-300 rounded-3xl border bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 ${
                    w.enabled
                      ? isLive
                        ? "border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-emerald-500/10"
                        : "border-gray-200/90 hover:border-emerald-500/40"
                      : "opacity-60 bg-gray-50/80 border-gray-200"
                  }`}
                >
                  <div
                    className={`h-2 w-full ${
                      !w.enabled
                        ? "bg-gray-300"
                        : isLive
                        ? "bg-gradient-to-r from-emerald-600 via-teal-500 to-emerald-400"
                        : "bg-gradient-to-r from-[#d4af37] via-amber-400 to-yellow-500"
                    }`}
                  />
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 ${
                        isLive ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                      }`}>
                        <Users className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          {isLive && (
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                            </span>
                          )}
                          <h3 className="font-bold text-base text-gray-900 leading-tight">{w.name}</h3>
                        </div>
                        <p className="text-xs text-gray-500 font-medium">
                          {w.audience === "BOTH" || w.hasFacultyTimer ? "Talabat + Faculty (Unified Event)" : "All Talabat (Learners)"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
                      <button
                        type="button"
                        onClick={() => openWindowModal(w, "ALL_STUDENTS")}
                        className="p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all active:scale-90"
                        title="Edit Schedule"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWindow(w.id)}
                        disabled={deletingId === w.id || studentWindows.length <= 1}
                        className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all active:scale-90 disabled:opacity-30"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-3.5">
                    {/* Time Display */}
                    <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-white flex items-center justify-center text-emerald-800 shadow-2xs border border-slate-200/60">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Talabat On-Time</p>
                          <p className="text-sm font-black text-gray-900 font-mono">
                            {w.startTime} &rarr; {w.endTime}
                          </p>
                          {w.lateEndTime && w.lateEndTime !== w.endTime && (
                            <p className="text-xs font-bold text-amber-700 font-mono">
                              Late Till: {w.lateEndTime}
                            </p>
                          )}
                          {(w.hasFacultyTimer || w.facultyStartTime) && (
                            <p className="text-xs font-bold text-indigo-700 font-mono mt-1">
                              Faculty: {w.facultyStartTime} &rarr; {w.facultyEndTime}
                              {w.facultyLateEndTime && w.facultyLateEndTime !== w.facultyEndTime && (
                                <span className="text-amber-700"> (Late till {w.facultyLateEndTime})</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Duration</p>
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-gray-800 font-mono">
                          {w.durationMinutes}m
                        </span>
                      </div>
                    </div>

                    {/* Interactive Visual Timeline Progress Bar */}
                    <ScheduleTimelineBar
                      startTime={w.startTime}
                      endTime={w.endTime}
                      lateEndTime={w.lateEndTime}
                      accent="emerald"
                    />

                    {/* Grace Period & Live Status */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Timer className="w-4 h-4 text-amber-600" />
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
                          <span className={`w-1.5 h-1.5 rounded-full ${!w.enabled ? "bg-gray-400" : isLive ? "bg-emerald-600 animate-pulse" : "bg-amber-500"}`} />
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
        </motion.div>
      ) : null}

      {/* ── TAB 2: FACULTY ROLE TIMER ATTENDANCE SCHEDULE ── */}
      {!loading && activeTab === "FACULTY" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6 rounded-3xl border border-indigo-200/90 bg-gradient-to-br from-indigo-50/90 via-purple-50/50 to-white p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0 border border-indigo-200 shadow-sm">
                <ShieldCheck className="w-6 h-6 text-indigo-700 stroke-[1.8]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-gray-900">
                    Faculty Role Timer &amp; Dedicated Scan Windows
                  </h3>
                  <Badge className="bg-indigo-600 text-white text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                    2026 Independent Timing
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 mt-1 max-w-2xl leading-relaxed">
                  Each schedule event below carries its <strong>own faculty timer side-by-side with the Talabat timer</strong> — one event, two timings, synced into attendance automatically.
                  Teachers scanning during the faculty timer receive verified faculty status without triggering learner attendance rules.
                </p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {facultyWindows.map((w) => {
              const facStart = w.facultyStartTime || w.startTime;
              const facEnd = w.facultyEndTime || w.endTime;
              const facLate = w.facultyLateEndTime || w.facultyEndTime || w.lateEndTime || w.endTime;
              const isLive = w.facultyStatus ? w.facultyStatus === "ACTIVE" : (w.status === "ACTIVE" || w.status === "GRACE_PERIOD");
              return (
                <Card
                  key={w.id}
                  className={`group relative overflow-hidden transition-all duration-300 border rounded-3xl bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 ${
                    w.enabled
                      ? isLive
                        ? "border-indigo-500/80 ring-2 ring-indigo-500/20 shadow-indigo-500/10"
                        : "border-indigo-200/80 hover:border-indigo-400"
                      : "opacity-60 bg-gray-50/80 border-gray-200"
                  }`}
                >
                  <div
                    className={`h-2 w-full ${
                      !w.enabled
                        ? "bg-gray-300"
                        : isLive
                        ? "bg-gradient-to-r from-indigo-600 via-purple-500 to-indigo-400"
                        : "bg-gradient-to-r from-indigo-400 to-blue-400"
                    }`}
                  />
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 ${
                        isLive ? "bg-indigo-100 text-indigo-800 border border-indigo-300" : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                      }`}>
                        <ShieldCheck className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          {isLive && (
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
                            </span>
                          )}
                          <h3 className="font-bold text-base text-gray-900 leading-tight">{w.name}</h3>
                        </div>
                        <p className="text-xs text-indigo-700 font-medium">
                          Audience: Faculty &amp; Staff
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
                      <button
                        type="button"
                        onClick={() => openWindowModal(w, "FACULTY")}
                        className="p-1.5 text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-all active:scale-90"
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
                    {/* Faculty Time Display */}
                    <div className="p-3.5 bg-indigo-50/60 rounded-2xl border border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-white flex items-center justify-center text-indigo-800 shadow-2xs border border-indigo-200/60">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Faculty On-Time</p>
                          <p className="text-sm font-black text-indigo-950 font-mono">
                            {facStart} &rarr; {facEnd}
                          </p>
                          {facLate && facLate !== facEnd && (
                            <p className="text-xs font-bold text-amber-700 font-mono">
                              Late Till: {facLate}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Duration</p>
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-white border border-indigo-200 text-xs font-bold text-indigo-900 font-mono">
                          {w.durationMinutes}m
                        </span>
                      </div>
                    </div>

                    {/* Interactive Visual Timeline for Faculty */}
                    <ScheduleTimelineBar
                      startTime={facStart}
                      endTime={facEnd}
                      lateEndTime={facLate}
                      accent="indigo"
                    />

                    {/* Grace Period & Live Status */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-indigo-100">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Timer className="w-4 h-4 text-indigo-600" />
                        <span>
                          Grace: <strong>{w.graceMinutes} min</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border shadow-2xs ${
                            !w.enabled || (w.facultyEnabled === false && (w.hasFacultyTimer || w.facultyStartTime))
                              ? "bg-gray-100 text-gray-600 border-gray-300"
                              : isLive
                              ? "bg-indigo-50 text-indigo-800 border-indigo-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${!w.enabled ? "bg-gray-400" : isLive ? "bg-indigo-600 animate-pulse" : "bg-amber-500"}`} />
                          {!w.enabled || (w.facultyEnabled === false && (w.hasFacultyTimer || w.facultyStartTime)) ? "Disabled" : isLive ? "Active Live" : "Closed"}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleWindowActive(w, true)}
                          title="Toggle faculty timer only (Talabat timer unaffected)"
                          className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ease-out select-none active:scale-95 ${
                            (w.facultyEnabled ?? true) && w.enabled ? "bg-indigo-600 shadow-sm" : "bg-gray-300"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${
                              (w.facultyEnabled ?? true) && w.enabled ? "translate-x-4" : "translate-x-0"
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

          {/* Faculty Auto-Mark Absent Governance */}
          {facultyAbsentPreview && (
            <div className="mb-6 rounded-3xl border border-amber-300/80 bg-gradient-to-r from-amber-50 via-yellow-50/80 to-indigo-50/40 p-6 shadow-md relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-amber-500 via-amber-600 to-indigo-600" />
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-300 shadow-sm mt-0.5">
                    <UserX className="w-6 h-6 text-amber-700 stroke-[1.8]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900">
                        Faculty Auto-Mark Absent Governance (Roster-Scoped)
                      </h3>
                      <Badge variant="outline" className="text-[10px] font-extrabold bg-amber-100/90 text-amber-900 border-amber-400">
                        24/7 Automated Roster
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 max-w-2xl leading-relaxed">
                      Teachers in the applicability roster who have not scanned by the end of the faculty window can be
                      automatically marked as <strong>ABSENT</strong>. Teachers outside the roster are <strong>never</strong> affected.
                    </p>
                    <div className="flex items-center gap-3 mt-3 text-xs text-gray-700 font-semibold flex-wrap">
                      <span className="px-2.5 py-1 rounded-xl bg-white border border-gray-200">Roster: <strong>{facultyAbsentPreview.totalExpected}</strong></span>
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">Present: <strong>{facultyAbsentPreview.loggedCount}</strong></span>
                      {(facultyAbsentPreview.medicalCount ?? 0) > 0 && (
                        <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200">Medical: <strong>{facultyAbsentPreview.medicalCount}</strong></span>
                      )}
                      <span className="px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 border border-amber-200">Unscanned: <strong>{facultyAbsentPreview.unscannedCount}</strong></span>
                      {facultyAbsentPreview.rosterScoped && (
                        <span className="px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-800 border border-indigo-200">Out of roster: <strong>{facultyAbsentPreview.outOfRosterCount}</strong> (skipped)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                  <Button
                    onClick={handleTriggerFacultyAutoMarkAbsent}
                    disabled={markingFacultyAbsent || facultyAbsentPreview.unscannedCount === 0}
                    variant="fatimi-gold"
                    className="text-xs font-bold rounded-xl h-10 px-4"
                  >
                    {markingFacultyAbsent ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        <span>Executing...</span>
                      </>
                    ) : (
                      <>
                        <UserX className="w-4 h-4 mr-1.5 text-[#1c1204]" />
                        <span>Auto-Mark {facultyAbsentPreview.unscannedCount} Unscanned Faculty</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Faculty Export Card */}
          <Card className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/40 shadow-sm overflow-hidden">
            <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-800 shadow-2xs">
                  <FileSpreadsheet className="w-6 h-6 stroke-[1.8]" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Download Faculty Attendance Report</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Exports all faculty check-ins and punctuality records with profile pictures, role tags, and arrival timestamps.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => downloadExcel("FACULTY")}
                disabled={exporting}
                variant="outline"
                className="text-indigo-800 border-indigo-300 hover:bg-indigo-50 text-xs font-bold rounded-xl h-10 px-4"
              >
                <Download className="w-4 h-4 mr-1.5" />
                <span>Export Faculty (.csv)</span>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 3: CLASSES TIMETABLE ATTENDANCE SCHEDULE ── */}
      {!loading && activeTab === "CLASSES" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          {/* Day of week filter bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-5 no-scrollbar">
            {DAYS_OF_WEEK.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(i)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 select-none active:scale-95 whitespace-nowrap ${
                  selectedDay === i
                    ? "bg-gradient-to-r from-emerald-900 to-teal-900 text-white shadow-md border border-emerald-700 font-extrabold ring-1 ring-amber-400/30"
                    : "bg-white text-gray-700 hover:bg-gray-50 border border-gray-200/90 hover:border-emerald-400"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Class filter */}
          <div className="flex items-center gap-3 mb-6">
            <label className="text-xs font-bold text-gray-700">Filter by Class:</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-800 shadow-xs"
            >
              <option value="ALL">All Classes ({classes.length})</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · Grade {c.grade}-{c.section}
                </option>
              ))}
            </select>
          </div>

          {/* Slots Table */}
          <Card className="fatimi-card overflow-hidden rounded-3xl border border-gray-200/90 shadow-md">
            <div className="fatimi-card-header" />
            <CardHeader className="flex flex-row items-center justify-between pb-4 bg-gray-50/50">
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-200 shadow-2xs">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <span>{DAYS_OF_WEEK[selectedDay]} Attendance Periods Schedule</span>
              </CardTitle>
              <Button
                onClick={() => downloadExcel("CLASSES")}
                disabled={exporting}
                variant="outline"
                size="sm"
                className="text-xs rounded-xl font-bold h-9 px-3.5"
              >
                <FileSpreadsheet className="w-4 h-4 mr-1.5 text-emerald-700" />
                <span>Export Schedule</span>
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {filteredSlots.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-gray-100 flex items-center justify-center text-gray-400 mb-3 border border-gray-200 shadow-inner">
                    <Calendar className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600">No class attendance periods scheduled for {DAYS_OF_WEEK[selectedDay]}.</p>
                  <Button size="sm" onClick={() => openSlotModal()} variant="default" className="mt-4 text-xs rounded-xl font-bold">
                    <Plus className="w-4 h-4 mr-1.5" /> Add Period Slot
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-100/70 border-b border-gray-200/90 text-gray-700 text-[11px] font-black uppercase tracking-wider">
                        <th className="py-3.5 px-5">Period</th>
                        <th className="py-3.5 px-5">Time</th>
                        <th className="py-3.5 px-5">Subject / Attendance Name</th>
                        <th className="py-3.5 px-5">Class</th>
                        <th className="py-3.5 px-5">Teacher</th>
                        <th className="py-3.5 px-5">Room</th>
                        <th className="py-3.5 px-5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 bg-white">
                      {filteredSlots.map((s) => (
                        <tr key={s.id} className="hover:bg-emerald-50/30 transition-colors group">
                          <td className="py-3.5 px-5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black font-mono shadow-2xs ${
                              s.isBreak ? "bg-amber-100 text-amber-900 border border-amber-300" : "bg-emerald-100 text-emerald-950 border border-emerald-300"
                            }`}>
                              {s.isBreak ? "Break" : `P${s.period}`}
                            </span>
                          </td>
                          <td className="py-3.5 px-5 font-mono text-xs font-bold text-gray-800">
                            {s.startTime} – {s.endTime}
                          </td>
                          <td className="py-3.5 px-5 font-bold text-gray-900">
                            {s.isBreak ? (s.breakName || "Break") : (s.subject || "Attendance")}
                          </td>
                          <td className="py-3.5 px-5 text-xs font-semibold text-gray-700">
                            {s.className} {s.grade ? `(Grade ${s.grade}-${s.section})` : ""}
                          </td>
                          <td className="py-3.5 px-5 text-xs font-medium text-gray-600">{s.teacherName || "—"}</td>
                          <td className="py-3.5 px-5 text-xs font-mono text-gray-500">{s.roomNumber || "—"}</td>
                          <td className="py-3.5 px-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => openSlotModal(s)}
                                className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-all active:scale-90"
                                title="Edit Period"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSlot(s.id)}
                                className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all active:scale-90"
                                title="Delete Period"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

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
                  <span>{editingWindow ? "Edit Attendance Schedule" : "Add Attendance Window"}</span>
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
                  <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200/80 text-[11px] text-emerald-950 font-medium leading-relaxed shadow-2xs">
                    One schedule event carries <strong>both timers side-by-side</strong> — Talabat and Faculty scan against the same event, each with its own on-time / late window, synced into attendance automatically.
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      Attendance Session Name:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tilawat al Dua, Subah Assembly, Dhuhr Attendance"
                      value={windowForm.name}
                      onChange={(e) => setWindowForm({ ...windowForm, name: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                    />
                  </div>

                  {/* Dynamic Timeline Preview inside Modal */}
                  <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-1">
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider">Live Timing Preview</span>
                    <ScheduleTimelineBar
                      startTime={windowForm.startTime}
                      endTime={windowForm.endTime}
                      lateEndTime={windowForm.lateEndTime}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-emerald-900 block mb-1">Talabat On-Time From (24h):</label>
                      <input
                        type="time"
                        required
                        value={windowForm.startTime}
                        onChange={(e) => setWindowForm({ ...windowForm, startTime: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-emerald-300 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-emerald-900 block mb-1">Talabat On-Time To (24h):</label>
                      <input
                        type="time"
                        required
                        value={windowForm.endTime}
                        onChange={(e) => setWindowForm({ ...windowForm, endTime: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-emerald-300 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Talabat Late Till (24h, optional):</label>
                      <input
                        type="time"
                        value={windowForm.lateEndTime || ""}
                        onChange={(e) => setWindowForm({ ...windowForm, lateEndTime: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="e.g. 09:00"
                      />
                      <p className="text-[10px] text-gray-500 mt-1 font-medium">
                        Scans between On-Time To &amp; Late Till are marked <strong>LATE</strong>. Scans before start are blocked.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Grace Period (Minutes):</label>
                      <input
                        type="number"
                        min="0"
                        max="180"
                        required
                        value={windowForm.graceMinutes}
                        onChange={(e) =>
                          setWindowForm({ ...windowForm, graceMinutes: Number(e.target.value) })
                        }
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Class Eligibility Roster for Talabat */}
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-emerald-700" />
                        <span>Talabat Class Attendance Scope</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setWindowForm({ ...windowForm, applicableClassIds: [] })}
                          className="text-[11px] font-bold text-emerald-700 hover:underline active:scale-95"
                        >
                          Select All (Default)
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-900 leading-snug">
                      Choose which classes must attend this event.
                      <strong> Empty = all classes.</strong> Students in other classes are <strong>never</strong> marked absent.
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1 bg-white p-2.5 rounded-xl border border-emerald-100 shadow-inner">
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
                    {windowForm.applicableClassIds.length === 0 && (
                      <p className="text-[10px] text-emerald-800 font-bold">
                        ✓ Applies to ALL classes and enrolled students.
                      </p>
                    )}
                  </div>

                  {/* ── Faculty timer on the SAME event ── */}
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="facultyTimerEnabled" className="text-xs font-black text-indigo-950 cursor-pointer flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-indigo-700" />
                        <span>Faculty Timer &amp; Attendance Scope</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setWindowForm({ ...windowForm, facultyTimerEnabled: !windowForm.facultyTimerEnabled })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ease-out active:scale-95 ${windowForm.facultyTimerEnabled ? "bg-indigo-600 shadow-sm" : "bg-gray-300"}`}
                        title="Toggle faculty timer for this event"
                      >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${windowForm.facultyTimerEnabled ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                    </div>

                    {windowForm.facultyTimerEnabled ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-indigo-900 block mb-1">Faculty On-Time From (24h):</label>
                            <input
                              type="time"
                              required
                              value={windowForm.facultyStartTime}
                              onChange={(e) => setWindowForm({ ...windowForm, facultyStartTime: e.target.value })}
                              className="w-full h-10 px-3 rounded-xl border border-indigo-300 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-indigo-900 block mb-1">Faculty On-Time To (24h):</label>
                            <input
                              type="time"
                              required
                              value={windowForm.facultyEndTime}
                              onChange={(e) => setWindowForm({ ...windowForm, facultyEndTime: e.target.value })}
                              className="w-full h-10 px-3 rounded-xl border border-indigo-300 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-indigo-900 block mb-1">Faculty Late Till (24h, optional):</label>
                            <input
                              type="time"
                              value={windowForm.facultyLateEndTime || ""}
                              onChange={(e) => setWindowForm({ ...windowForm, facultyLateEndTime: e.target.value })}
                              className="w-full h-10 px-3 rounded-xl border border-indigo-200 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            />
                          </div>
                          <div className="flex items-end pb-1">
                            <label className="flex items-center gap-2 text-xs font-bold text-indigo-900 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={windowForm.facultyEnabled}
                                onChange={(e) => setWindowForm({ ...windowForm, facultyEnabled: e.target.checked })}
                                className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              Faculty check-in active
                            </label>
                          </div>
                        </div>

                        {/* Faculty Applicability Selection List */}
                        <div className="bg-white border border-indigo-200 rounded-xl p-3.5 space-y-2 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Select Faculty Expected for this Session:</span>
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setWindowForm({ ...windowForm, applicableTeacherIds: [] })}
                                className="text-[10px] font-bold text-indigo-700 hover:underline active:scale-95"
                              >
                                All Faculty ({facultyList.length})
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-indigo-800 leading-snug font-medium">
                            Selected teachers are expected to scan and monitored for auto-absent.
                            <strong> Unselected teachers are never auto-marked absent.</strong>
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-1 border border-indigo-100 rounded-lg p-2 bg-indigo-50/30">
                            {facultyList.map((t) => (
                              <label key={t.id} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded px-2 py-1 transition-colors">
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
                                  className="rounded border-indigo-400 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-medium text-gray-900">{t.name}</span>
                                <span className="text-[10px] text-gray-500 font-mono">({t.employeeId})</span>
                                {t.department && <span className="text-[10px] text-indigo-600 font-medium ml-auto">{t.department}</span>}
                              </label>
                            ))}
                          </div>
                          {windowForm.applicableTeacherIds.length === 0 && facultyList.length > 0 && (
                            <p className="text-[10px] text-indigo-700 font-bold flex items-center gap-1">
                              ✓ Window applies to ALL active teachers ({facultyList.length}).
                            </p>
                          )}
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-gray-500">
                        No faculty schedule on this event — faculty scans will not be accepted under it.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="enabled"
                      checked={windowForm.enabled}
                      onChange={(e) => setWindowForm({ ...windowForm, enabled: e.target.checked })}
                      className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <label htmlFor="enabled" className="text-xs font-bold text-gray-700 cursor-pointer">
                      Enable this attendance schedule window immediately
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 p-4 border-t border-gray-100 bg-gray-50 shrink-0">
                  <Button variant="outline" size="sm" type="button" onClick={() => setWindowModalOpen(false)} className="rounded-xl font-bold text-xs h-10 px-4">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={savingWindow}
                    variant="default"
                    className="font-bold rounded-xl text-xs h-10 px-5 shadow-md"
                  >
                    {savingWindow ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    <span>{editingWindow ? "Update Schedule" : "Save Schedule"}</span>
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── MODAL: Create / Edit Class Slot ── */}
      <AnimatePresence>
        {classModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
              className="w-full max-w-md max-h-[92vh] bg-white rounded-3xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0 bg-gradient-to-r from-emerald-50/50 via-white to-gray-50">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center border border-emerald-300 shadow-2xs">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <span>{editingSlot ? "Edit Class Period" : "Add Class Attendance Period"}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setClassModalOpen(false)}
                  className="text-gray-400 hover:text-gray-700 p-2 rounded-xl hover:bg-gray-100 transition-colors active:scale-90"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={saveSlot} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">Class Assigned:</label>
                    <select
                      value={slotForm.classId}
                      onChange={(e) => setSlotForm({ ...slotForm, classId: e.target.value })}
                      className="w-full h-11 px-3.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                    >
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} · Grade {c.grade}-{c.section} ({c.teacherName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Day of Week:</label>
                      <select
                        value={slotForm.dayOfWeek}
                        onChange={(e) => setSlotForm({ ...slotForm, dayOfWeek: Number(e.target.value) })}
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        {DAYS_OF_WEEK.map((d, i) => (
                          <option key={d} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Period Number:</label>
                      <input
                        type="number"
                        min="1"
                        max="12"
                        value={slotForm.period}
                        onChange={(e) => setSlotForm({ ...slotForm, period: Number(e.target.value) })}
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Subject / Attendance Label:</label>
                    <input
                      type="text"
                      placeholder="e.g. Al-Quran, Fiqh, Adab, Mathematics"
                      value={slotForm.subject}
                      onChange={(e) => setSlotForm({ ...slotForm, subject: e.target.value })}
                      className="w-full h-10 px-3.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Start Time (24h):</label>
                      <input
                        type="time"
                        required
                        value={slotForm.startTime}
                        onChange={(e) => setSlotForm({ ...slotForm, startTime: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">End Time (24h):</label>
                      <input
                        type="time"
                        required
                        value={slotForm.endTime}
                        onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Room Number:</label>
                    <input
                      type="text"
                      placeholder="e.g. Room 204, Iwan Hall"
                      value={slotForm.roomNumber}
                      onChange={(e) => setSlotForm({ ...slotForm, roomNumber: e.target.value })}
                      className="w-full h-10 px-3.5 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 p-4 border-t border-gray-100 bg-gray-50 shrink-0">
                  <Button variant="outline" size="sm" type="button" onClick={() => setClassModalOpen(false)} className="rounded-xl font-bold text-xs h-10 px-4">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={savingSlot}
                    variant="default"
                    className="font-bold rounded-xl text-xs h-10 px-5 shadow-md"
                  >
                    {savingSlot ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    <span>{editingSlot ? "Update Period" : "Save Period"}</span>
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
