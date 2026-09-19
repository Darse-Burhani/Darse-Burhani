"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  Calendar,
  Download,
  Plus,
  Trash2,
  Edit2,
  Users,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Loader2,
  RefreshCw,
  Filter,
  Check,
  X,
  FileSpreadsheet,
  CalendarDays,
  Timer,
  ShieldCheck,
  Fingerprint,
  Mail,
  UserX,
  UserCheck,
  Stethoscope,
  HeartPulse,
  GraduationCap,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { ManualAttendanceModal } from "@/components/attendance/ManualAttendanceModal";

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
    // Faculty timer lives on the SAME event (side-by-side with Talabat timer)
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
  const [manualModalOpen, setManualModalOpen] = useState(false);

  // Auto-Mark Absent Governance State
  const [autoAbsentPreview, setAutoAbsentPreview] = useState<{
    totalStudents: number;
    loggedCount: number;
    unscannedCount: number;
    targetDate: string;
  } | null>(null);
  const [markingAbsent, setMarkingAbsent] = useState(false);

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

  // Fetch Auto-Mark Absent Preview
  const fetchAutoAbsentPreview = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/attendance/schedule/auto-absent-preview");
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setAutoAbsentPreview(json.data);
        }
      }
    } catch {
      // silent fallback
    }
  }, []);

  // Trigger On-Demand Auto-Mark Absent Job
  const handleTriggerAutoMarkAbsent = async () => {
    if (!autoAbsentPreview) return;
    if (
      !confirm(
        `Are you sure you want to mark ${autoAbsentPreview.unscannedCount} unscanned talabat as ABSENT for today? This will create attendance records, notify learners, and reset attendance streaks.`,
      )
    ) {
      return;
    }

    setMarkingAbsent(true);
    try {
      const res = await fetch("/api/admin/attendance/schedule/auto-mark-absent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Auto-Mark Absent Executed",
          description: `Successfully marked ${json.data.markedCount} talabat as absent.`,
          variant: "success",
        });
        fetchAutoAbsentPreview();
        loadData();
      } else {
        toast({ title: json.error || "Failed to execute auto-mark absent", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error executing auto-mark absent", variant: "destructive" });
    } finally {
      setMarkingAbsent(false);
    }
  };

  // Fetch All Students Windows
  const fetchWindows = useCallback(async () => {
    try {
      let res = await fetch("/api/admin/attendance/schedule/windows");
      if (!res.ok) {
        res = await fetch("/api/attendance/schedule/windows");
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
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
      let res = await fetch("/api/admin/attendance/schedule/classes");
      if (!res.ok) {
        res = await fetch("/api/attendance/schedule/classes");
      }
      if (!res.ok) {
        res = await fetch("/api/admin/timetable");
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setSlots(json.data.slots);
          setClasses(json.data.classes);
        }
      }
    } catch {
      toast({ title: "Failed to load class attendance schedule", variant: "destructive" });
    }
  }, []);

  // Fetch faculty directory (for applicability roster selector)
  const fetchFacultyList = useCallback(async () => {
    try {
      const res = await fetch("/api/biometric/teachers");
      if (res.ok) {
        const json = await res.json();
        if (json.success) setFacultyList(json.data);
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
        loadData();
      } else {
        toast({ title: json.error || "Failed to execute faculty auto-mark absent", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error executing faculty auto-mark absent", variant: "destructive" });
    } finally {
      setMarkingFacultyAbsent(false);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchWindows(), fetchClassSchedule(), fetchAutoAbsentPreview(), fetchFacultyList(), fetchFacultyAbsentPreview()]);
    setLoading(false);
  }, [fetchWindows, fetchClassSchedule, fetchAutoAbsentPreview, fetchFacultyList, fetchFacultyAbsentPreview]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open modal to create/edit window (ONE event carries BOTH timers)
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
        audience: (isLegacyFaculty ? "FACULTY" : "ALL_STUDENTS"),
        applicableTeacherIds: w.applicableTeacherIds || [],
        exemptTeacherIds: w.exemptTeacherIds || [],
        applicableClassIds: w.applicableClassIds || [],
        exemptStudentIds: w.exemptStudentIds || [],
        facultyTimerEnabled: hasFac,
        // Legacy faculty rows carry their schedule in the main columns — adopt them as the faculty timer.
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
          // ONE event, BOTH timers: send the faculty timer alongside the Talabat timer.
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
          description: `Attendance window "${windowForm.name}" is now active.`,
          variant: "success",
        });
        setWindowModalOpen(false);
        fetchWindows();
      } else {
        toast({ title: json.error || "Failed to save schedule window", variant: "destructive" });
      }
    } catch {
      toast({ title: "Network error while saving schedule", variant: "destructive" });
    } finally {
      setSavingWindow(false);
    }
  };

  // Toggle active status for window (faculty cards toggle only the faculty timer)
  const toggleWindowActive = async (w: ScanWindow, facultyOnly?: boolean) => {
    try {
      const res = await fetch(`/api/admin/attendance/schedule/windows/${w.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          facultyOnly && (w.hasFacultyTimer || w.facultyStartTime)
            ? { facultyEnabled: !(w.facultyEnabled ?? true) }
            : { enabled: !w.enabled },
        ),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: !w.enabled ? "Schedule Window Enabled" : "Schedule Window Disabled",
          description: `${w.name} is now ${!w.enabled ? "active" : "inactive"}.`,
          variant: "success",
        });
        fetchWindows();
      }
    } catch {
      toast({ title: "Failed to toggle status", variant: "destructive" });
    }
  };

  // Delete window
  const deleteWindow = async (id: string) => {
    if (!confirm("Are you sure you want to delete this attendance schedule window?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/attendance/schedule/windows/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Schedule Window Deleted", variant: "success" });
        fetchWindows();
      } else {
        toast({ title: json.error || "Failed to delete", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to delete window", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // Open modal for Class slot
  const openSlotModal = (slot?: TimetableSlot) => {
    if (slot) {
      setEditingSlot(slot);
      setSlotForm({
        classId: slot.classId || "",
        dayOfWeek: slot.dayOfWeek,
        period: slot.period,
        subject: slot.subject || "",
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomNumber: slot.roomNumber || "",
        isBreak: slot.isBreak,
        breakName: slot.breakName || "",
      });
    } else {
      setEditingSlot(null);
      setSlotForm({
        classId: classes[0]?.id || "",
        dayOfWeek: selectedDay,
        period: 1,
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

  // Filtered slots for selected day and class
  const filteredSlots = useMemo(() => {
    return slots
      .filter((s) => s.dayOfWeek === selectedDay)
      .filter((s) => (classFilter === "ALL" ? true : s.classId === classFilter));
  }, [slots, selectedDay, classFilter]);

  // Every schedule event carries the Talabat timer; events with a faculty
  // timer additionally appear under the Faculty tab.
  const studentWindows = useMemo(() => {
    return windows;
  }, [windows]);

  const facultyWindows = useMemo(() => {
    return windows.filter((w) => w.hasFacultyTimer || w.audience === "FACULTY" || w.id === "faculty_default");
  }, [windows]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* ── Attendance Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Attendance & Biometrics"
        hubDescription="Real-time terminal monitoring, daily scan windows, class schedules, and automated email reporting."
        tabs={[
          { label: "Live Feeds & Terminals", href: "/admin/biometric", icon: Fingerprint },
          { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
          { label: "Email Reports to Parents", href: "/admin/attendance-emails", icon: Mail },
        ]}
      />

      {/* ── Page Header Banner ── */}
      <div className="relative rounded-3xl p-6 sm:p-8 mb-8 overflow-hidden bg-gradient-to-r from-[#093b2a] via-[#0d503a] to-[#062b1e] border border-[#d4af37]/40 shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 rounded-full bg-[#d4af37]/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-0 p-6 opacity-15 pointer-events-none">
          <Clock className="w-32 h-32 text-white" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#d4af37]/20 border border-[#d4af37]/50 text-[#fff2b2] text-xs font-black tracking-widest uppercase mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[#fde047]" />
              Attendance Governance
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white font-display tracking-tight">
              Attendance Schedule &amp; Timing
            </h1>
            <p className="text-emerald-100/80 text-sm mt-1.5 max-w-2xl font-medium leading-relaxed">
              Configure attendance sessions, scan windows, start/end times, and grace periods for Talabat, Faculty, and Classes.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => (window.location.href = "/teacher/medical-duty")}
              className="bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-lg border border-emerald-400/30 transition-all flex items-center gap-2"
            >
              <Stethoscope className="w-4 h-4 text-emerald-200" />
              Health &amp; Medical Duty
            </Button>
            <Button
              onClick={() => setManualModalOpen(true)}
              className="bg-gradient-to-r from-[#d4af37] to-[#b38f26] hover:from-[#e5c158] hover:to-[#c49f32] text-gray-900 font-extrabold text-xs h-10 px-4 rounded-xl shadow-lg border border-[#fef08a]/40 transition-all flex items-center gap-2"
            >
              <Users className="w-4 h-4 text-gray-900" />
              Manual Attendance Sheet
            </Button>
            <Button
              onClick={() => downloadExcel(activeTab)}
              disabled={exporting}
              className="bg-[#d4af37] hover:bg-[#c59e2a] text-[#1c1204] font-black text-xs shadow-lg shadow-[#d4af37]/20 border border-[#fff2b2]"
            >
              {exporting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 mr-2" />
              )}
              Download as Excel Sheet
            </Button>
            <Button
              onClick={loadData}
              variant="outline"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Tab Switcher Toggle ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center p-1.5 bg-gray-100 rounded-2xl border border-gray-200 w-fit flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("ALL_STUDENTS")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "ALL_STUDENTS"
                ? "bg-white text-emerald-900 shadow-sm border border-gray-200 font-extrabold"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <Users className="w-4 h-4 text-emerald-700" />
            Talabat Windows
            <Badge variant="outline" className="ml-1 bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px]">
              {studentWindows.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("FACULTY")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "FACULTY"
                ? "bg-white text-indigo-900 shadow-sm border border-gray-200 font-extrabold"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Faculty Role Timer
            <Badge variant="outline" className="ml-1 bg-indigo-50 text-indigo-800 border-indigo-200 text-[10px]">
              {facultyWindows.length}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("CLASSES")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === "CLASSES"
                ? "bg-white text-emerald-900 shadow-sm border border-gray-200 font-extrabold"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-700" />
            Class Timetable
            <Badge variant="outline" className="ml-1 bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px]">
              {slots.length}
            </Badge>
          </button>
        </div>

        {/* Create button according to active tab */}
        {activeTab === "ALL_STUDENTS" ? (
          <Button
            onClick={() => openWindowModal(undefined, "ALL_STUDENTS")}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Talabat Window
          </Button>
        ) : activeTab === "FACULTY" ? (
          <Button
            onClick={() => openWindowModal(undefined, "FACULTY")}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs shadow-md"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Faculty Role Timer
          </Button>
        ) : (
          <Button
            onClick={() => openSlotModal()}
            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Class Period Slot
          </Button>
        )}
      </div>

      {/* ── TAB 1: ALL STUDENTS GENERAL ATTENDANCE SCHEDULE ── */}
      {activeTab === "ALL_STUDENTS" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* ── Auto-Mark Absent Governance Banner ── */}
          {autoAbsentPreview && (
            <div className="mb-6 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50 via-yellow-50/70 to-emerald-50/30 p-5 shadow-md relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 to-emerald-600" />
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200 shadow-sm mt-0.5">
                    <UserX className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900">
                        Automated Absence Evaluation (End-of-Window Auto-Mark)
                      </h3>
                      <Badge variant="outline" className="text-[10px] font-bold bg-amber-100/80 text-amber-800 border-amber-300">
                        Daily Governance
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 max-w-2xl leading-relaxed">
                      Active learners without biometric scans or teacher marks by the end of the scan window can be
                      automatically marked as <strong>ABSENT</strong> with instant in-app alerts and streak resets.
                    </p>
                    <div className="flex items-center gap-4 mt-2.5 text-xs text-gray-700 font-medium">
                      <span>Total Enrolled: <strong>{autoAbsentPreview.totalStudents}</strong></span>
                      <span>Present Today: <strong className="text-emerald-700">{autoAbsentPreview.loggedCount}</strong></span>
                      <span>Unscanned: <strong className="text-amber-700">{autoAbsentPreview.unscannedCount}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                  <Button
                    onClick={handleTriggerAutoMarkAbsent}
                    disabled={markingAbsent || autoAbsentPreview.unscannedCount === 0}
                    className="bg-gradient-to-r from-[#022c22] to-[#047857] hover:from-[#033b2e] hover:to-[#059669] text-white font-bold text-xs shadow-md rounded-xl h-9"
                  >
                    {markingAbsent ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <UserX className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                        Auto-Mark {autoAbsentPreview.unscannedCount} Unscanned as Absent
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {studentWindows.map((w) => {
              const isLive = w.status === "ACTIVE" || w.status === "GRACE_PERIOD";
              return (
                <Card
                  key={w.id}
                  className={`fatimi-card overflow-hidden transition-all duration-300 ${
                    w.enabled
                      ? isLive
                        ? "ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/10"
                        : "hover:shadow-md"
                      : "opacity-60 bg-gray-50/80"
                  }`}
                >
                  <div
                    className={`h-1.5 w-full ${
                      !w.enabled
                        ? "bg-gray-300"
                        : isLive
                        ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                        : "bg-gradient-to-r from-[#d4af37] to-amber-400"
                    }`}
                  />
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {isLive && (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                          </span>
                        )}
                        <h3 className="font-bold text-base text-gray-900 leading-tight">{w.name}</h3>
                      </div>
                      <p className="text-xs text-gray-500 font-medium">
                        Audience: {w.audience === "BOTH" || w.hasFacultyTimer ? "Talabat + Faculty (unified event)" : "All Talabat (Learners)"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openWindowModal(w, "ALL_STUDENTS")}
                        className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit Schedule"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWindow(w.id)}
                        disabled={deletingId === w.id || studentWindows.length <= 1}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-4">
                    {/* Time Display */}
                    <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-emerald-700" />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Talabat On-Time</p>
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
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duration</p>
                        <p className="text-xs font-bold text-gray-700">{w.durationMinutes} mins</p>
                      </div>
                    </div>

                    {/* Grace Period & Live Status */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Timer className="w-3.5 h-3.5 text-amber-600" />
                        <span>
                          Grace: <strong>{w.graceMinutes} min</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            !w.enabled
                              ? "bg-gray-100 text-gray-600 border-gray-300"
                              : isLive
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}
                        >
                          {!w.enabled ? "Disabled" : isLive ? "🟢 Check-In Live" : "⚪ Closed"}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleWindowActive(w)}
                          className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                            w.enabled ? "bg-emerald-600" : "bg-gray-300"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out ${
                              w.enabled ? "translate-x-3" : "translate-x-0"
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

          {/* Quick Roster Export Card */}
          <Card className="fatimi-card bg-gradient-to-br from-emerald-50/50 via-white to-amber-50/30 border-emerald-200">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900">Download Today's Live Attendance Sheet</h4>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Exports all talabat check-ins recorded across the schedule today in Excel with profile pic, grade, scheduled event &amp; status.
                  </p>
                </div>
              </div>

              <Button
                onClick={() => downloadExcel("ROSTER")}
                disabled={exporting}
                variant="outline"
                className="text-emerald-800 border-emerald-300 hover:bg-emerald-50 text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Download Report (.csv)
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 2: FACULTY ROLE TIMER ATTENDANCE SCHEDULE ── */}
      {activeTab === "FACULTY" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mb-6 rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-purple-50/60 to-white p-5 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center shrink-0 border border-indigo-200 shadow-sm mt-0.5">
                <ShieldCheck className="w-5 h-5 text-indigo-700" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">
                    Faculty Role Timer &amp; Dedicated Scan Windows
                  </h3>
                  <Badge className="bg-indigo-600 text-white text-[10px] font-bold">
                    Independent Timing
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
                  className={`fatimi-card overflow-hidden transition-all duration-300 border-indigo-200/80 ${
                    w.enabled
                      ? isLive
                        ? "ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/10"
                        : "hover:shadow-md"
                      : "opacity-60 bg-gray-50/80"
                  }`}
                >
                  <div
                    className={`h-1.5 w-full ${
                      !w.enabled
                        ? "bg-gray-300"
                        : isLive
                        ? "bg-gradient-to-r from-indigo-500 to-purple-500"
                        : "bg-gradient-to-r from-indigo-400 to-blue-400"
                    }`}
                  />
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
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
                        <span className="text-gray-500"> · same event as Talabat {w.startTime} &rarr; {w.endTime}</span>
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openWindowModal(w, "FACULTY")}
                        className="p-1.5 text-gray-400 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Schedule"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWindow(w.id)}
                        disabled={deletingId === w.id}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                        title="Delete Schedule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-4">
                    {/* Faculty Time Display (same event, faculty timer) */}
                    <div className="p-3.5 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Clock className="w-4 h-4 text-indigo-700" />
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Faculty On-Time</p>
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
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Duration</p>
                        <p className="text-xs font-bold text-indigo-900">{w.durationMinutes} mins</p>
                      </div>
                    </div>

                    {/* Grace Period & Live Status */}
                    <div className="flex items-center justify-between text-xs pt-1">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Timer className="w-3.5 h-3.5 text-indigo-600" />
                        <span>
                          Grace: <strong>{w.graceMinutes} min</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                            !w.enabled || (w.facultyEnabled === false && (w.hasFacultyTimer || w.facultyStartTime))
                              ? "bg-gray-100 text-gray-600 border-gray-300"
                              : isLive
                              ? "bg-indigo-50 text-indigo-800 border-indigo-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                          }`}
                        >
                          {!w.enabled || (w.facultyEnabled === false && (w.hasFacultyTimer || w.facultyStartTime)) ? "Disabled" : isLive ? "🟢 Faculty Live" : "⚪ Closed"}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleWindowActive(w, true)}
                          title="Toggle faculty timer only (Talabat timer unaffected)"
                          className={`w-8 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                            (w.facultyEnabled ?? true) && w.enabled ? "bg-indigo-600" : "bg-gray-300"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out ${
                              (w.facultyEnabled ?? true) && w.enabled ? "translate-x-3" : "translate-x-0"
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
            <div className="mb-6 rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50 via-yellow-50/70 to-indigo-50/30 p-5 shadow-md relative overflow-hidden">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-amber-500 to-indigo-600" />
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 border border-amber-200 shadow-sm mt-0.5">
                    <UserX className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-gray-900">
                        Faculty Auto-Mark Absent Governance (Roster-Scoped)
                      </h3>
                      <Badge variant="outline" className="text-[10px] font-bold bg-amber-100/80 text-amber-800 border-amber-300">
                        Roster Only
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5 max-w-2xl leading-relaxed">
                      Teachers in the applicability roster who have not scanned by the end of the faculty window can be
                      automatically marked as <strong>ABSENT</strong>. Teachers outside the roster are <strong>never</strong> affected.
                    </p>
                    <div className="flex items-center gap-4 mt-2.5 text-xs text-gray-700 font-medium">
                      <span>Roster: <strong>{facultyAbsentPreview.totalExpected}</strong></span>
                      <span>Present: <strong className="text-emerald-700">{facultyAbsentPreview.loggedCount}</strong></span>
                      {(facultyAbsentPreview.medicalCount ?? 0) > 0 && (
                        <span>Medical: <strong className="text-blue-700">{facultyAbsentPreview.medicalCount}</strong></span>
                      )}
                      <span>Unscanned: <strong className="text-amber-700">{facultyAbsentPreview.unscannedCount}</strong></span>
                      {facultyAbsentPreview.rosterScoped && (
                        <span className="text-indigo-700">Out of roster: <strong>{facultyAbsentPreview.outOfRosterCount}</strong> (skipped)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                  <Button
                    onClick={handleTriggerFacultyAutoMarkAbsent}
                    disabled={markingFacultyAbsent || facultyAbsentPreview.unscannedCount === 0}
                    className="bg-gradient-to-r from-[#022c22] to-[#047857] hover:from-[#033b2e] hover:to-[#059669] text-white font-bold text-xs shadow-md rounded-xl h-9"
                  >
                    {markingFacultyAbsent ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Executing...
                      </>
                    ) : (
                      <>
                        <UserX className="w-3.5 h-3.5 mr-1.5 text-amber-300" />
                        Auto-Mark {facultyAbsentPreview.unscannedCount} Unscanned Faculty as Absent
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Faculty Export Card */}
          <Card className="fatimi-card bg-gradient-to-br from-indigo-50/50 via-white to-purple-50/30 border-indigo-200">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-800">
                  <FileSpreadsheet className="w-5 h-5" />
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
                className="text-indigo-800 border-indigo-300 hover:bg-indigo-50 text-xs font-bold"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Export Faculty (.csv)
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ── TAB 2: CLASSES TIMETABLE ATTENDANCE SCHEDULE ── */}
      {activeTab === "CLASSES" && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* Day of week filter bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-5">
            {DAYS_OF_WEEK.map((d, i) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(i)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedDay === i
                    ? "bg-emerald-700 text-white shadow-md shadow-emerald-700/20"
                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Class filter */}
          <div className="flex items-center gap-3 mb-6">
            <label className="text-xs font-bold text-gray-600">Filter by Class:</label>
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-800"
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
          <Card className="fatimi-card overflow-hidden">
            <div className="fatimi-card-header" />
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-emerald-600" />
                {DAYS_OF_WEEK[selectedDay]} Attendance Periods Schedule
              </CardTitle>
              <Button
                onClick={() => downloadExcel("CLASSES")}
                disabled={exporting}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1" />
                Export Class Schedule
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {filteredSlots.length === 0 ? (
                <div className="py-16 text-center text-gray-400">
                  <Calendar className="w-10 h-10 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm font-medium">No class attendance periods scheduled for {DAYS_OF_WEEK[selectedDay]}.</p>
                  <Button size="sm" onClick={() => openSlotModal()} className="mt-3 text-xs bg-emerald-700">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Period
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 text-[11px] font-bold uppercase tracking-wider">
                        <th className="py-3 px-4">Period</th>
                        <th className="py-3 px-4">Time</th>
                        <th className="py-3 px-4">Subject / Attendance Name</th>
                        <th className="py-3 px-4">Class</th>
                        <th className="py-3 px-4">Teacher</th>
                        <th className="py-3 px-4">Room</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredSlots.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3 px-4 font-bold text-emerald-800">
                            {s.isBreak ? "Break" : `P${s.period}`}
                          </td>
                          <td className="py-3 px-4 font-mono text-xs font-semibold text-gray-700">
                            {s.startTime} – {s.endTime}
                          </td>
                          <td className="py-3 px-4 font-bold text-gray-900">
                            {s.isBreak ? (s.breakName || "Break") : (s.subject || "Attendance")}
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-gray-700">
                            {s.className} {s.grade ? `(Grade ${s.grade}-${s.section})` : ""}
                          </td>
                          <td className="py-3 px-4 text-xs text-gray-600">{s.teacherName || "—"}</td>
                          <td className="py-3 px-4 text-xs text-gray-500">{s.roomNumber || "—"}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openSlotModal(s)}
                                className="p-1.5 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteSlot(s.id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* ── MODAL: Create / Edit All Students Window ── */}
      <AnimatePresence>
        {windowModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0 bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-emerald-600" />
                  {editingWindow ? "Edit Attendance Schedule" : "Add Attendance Window"}
                </h3>
                <button
                  type="button"
                  onClick={() => setWindowModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={saveWindow} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                  <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-[11px] text-emerald-900 font-medium leading-relaxed">
                    One schedule event carries <strong>both timers side-by-side</strong> — Talabat and Faculty scan against the same event, each with its own on-time / late window, synced into attendance automatically.
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">
                      Attendance Session Name:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tilawat al Dua, Subah Assembly, Dhuhr Attendance"
                      value={windowForm.name}
                      onChange={(e) => setWindowForm({ ...windowForm, name: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-emerald-800 block mb-1">Talabat On-Time From (24h):</label>
                      <input
                        type="time"
                        required
                        value={windowForm.startTime}
                        onChange={(e) => setWindowForm({ ...windowForm, startTime: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-emerald-200 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-emerald-800 block mb-1">Talabat On-Time To (24h):</label>
                      <input
                        type="time"
                        required
                        value={windowForm.endTime}
                        onChange={(e) => setWindowForm({ ...windowForm, endTime: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-emerald-200 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                      <p className="text-[11px] text-gray-400 mt-1">
                        Scans after On-Time To until Late Till are marked <strong>LATE</strong>.
                      </p>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">Legacy Grace Period (Minutes):</label>
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
                      <p className="text-[11px] text-gray-400 mt-1">
                        Two-time rule takes precedence.
                      </p>
                    </div>
                  </div>

                  {/* Class Eligibility Roster for Talabat */}
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-emerald-700" />
                        Talabat Class Attendance Scope
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setWindowForm({ ...windowForm, applicableClassIds: [] })}
                          className="text-[11px] font-semibold text-emerald-700 hover:underline"
                        >
                          Select All (Default)
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-emerald-800 leading-snug">
                      Choose which classes must attend this event.
                      <strong> Empty = all classes.</strong> Students in other classes are <strong>never</strong> marked absent.
                    </p>
                    <div className="max-h-36 overflow-y-auto space-y-1 bg-white p-2 rounded-lg border border-emerald-100">
                      {classes.map((c) => (
                        <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-emerald-50/80 rounded px-2 py-1 text-xs text-gray-800">
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
                      <p className="text-[10px] text-emerald-700 font-medium">
                        ✓ Applies to ALL classes and enrolled students.
                      </p>
                    )}
                  </div>

                  {/* ── Faculty timer on the SAME event ── */}
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor="facultyTimerEnabled" className="text-xs font-black text-indigo-900 cursor-pointer flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-indigo-700" />
                        Faculty timer & Attendance Scope
                      </label>
                      <button
                        type="button"
                        onClick={() => setWindowForm({ ...windowForm, facultyTimerEnabled: !windowForm.facultyTimerEnabled })}
                        className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${windowForm.facultyTimerEnabled ? "bg-indigo-600" : "bg-gray-300"}`}
                        title="Toggle faculty timer for this event"
                      >
                        <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ease-in-out ${windowForm.facultyTimerEnabled ? "translate-x-4" : "translate-x-0"}`} />
                      </button>
                    </div>

                    {windowForm.facultyTimerEnabled ? (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-indigo-800 block mb-1">Faculty On-Time From (24h):</label>
                            <input
                              type="time"
                              required
                              value={windowForm.facultyStartTime}
                              onChange={(e) => setWindowForm({ ...windowForm, facultyStartTime: e.target.value })}
                              className="w-full h-10 px-3 rounded-xl border border-indigo-200 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-indigo-800 block mb-1">Faculty On-Time To (24h):</label>
                            <input
                              type="time"
                              required
                              value={windowForm.facultyEndTime}
                              onChange={(e) => setWindowForm({ ...windowForm, facultyEndTime: e.target.value })}
                              className="w-full h-10 px-3 rounded-xl border border-indigo-200 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-indigo-800 block mb-1">Faculty Late Till (24h, optional):</label>
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
                        <div className="bg-white border border-indigo-200 rounded-xl p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                              Select Faculty Expected for this Session:
                            </label>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setWindowForm({ ...windowForm, applicableTeacherIds: [] })}
                                className="text-[10px] font-bold text-indigo-700 hover:underline"
                              >
                                All Faculty ({facultyList.length})
                              </button>
                            </div>
                          </div>
                          <p className="text-[11px] text-indigo-800 leading-snug">
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
                            <p className="text-[10px] text-indigo-700 font-medium flex items-center gap-1">
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

                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50 shrink-0">
                  <Button variant="outline" size="sm" type="button" onClick={() => setWindowModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={savingWindow}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                  >
                    {savingWindow ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    {editingWindow ? "Update Schedule" : "Save Schedule"}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0 bg-gray-50/50">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                  {editingSlot ? "Edit Class Period" : "Add Class Attendance Period"}
                </h3>
                <button
                  type="button"
                  onClick={() => setClassModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={saveSlot} className="flex flex-col flex-1 overflow-hidden">
                <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Class Assigned:</label>
                    <select
                      value={slotForm.classId}
                      onChange={(e) => setSlotForm({ ...slotForm, classId: e.target.value })}
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-900"
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
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-900"
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
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-bold font-mono text-gray-900"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-1">End Time (24h):</label>
                      <input
                        type="time"
                        required
                        value={slotForm.endTime}
                        onChange={(e) => setSlotForm({ ...slotForm, endTime: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-bold font-mono text-gray-900"
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
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-medium text-gray-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50 shrink-0">
                  <Button variant="outline" size="sm" type="button" onClick={() => setClassModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={savingSlot}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
                  >
                    {savingSlot ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                    {editingSlot ? "Update Period" : "Save Period"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual Attendance Modal */}
      <ManualAttendanceModal
        open={manualModalOpen}
        onOpenChange={setManualModalOpen}
        initialScheduleType={
          activeTab === "FACULTY"
            ? "FACULTY_WINDOW"
            : activeTab === "CLASSES"
            ? "CLASS_PERIOD"
            : "WINDOW"
        }
        onSuccess={() => loadData()}
      />
    </div>
  );
}
