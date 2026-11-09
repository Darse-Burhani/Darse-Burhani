"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Users,
  Loader2,
  Save,
  RotateCcw,
  UserCheck,
  ClipboardCheck,
  ClipboardList,
  Check,
  X,
  Search,
  Mail,
  Send,
  Stethoscope,
  ShieldCheck,
  Fingerprint,
  Radio,
  GraduationCap,
  ChevronDown,
  FileText,
  Activity,
  Calendar,
  Sparkles,
  Zap,
  Keyboard,
  SlidersHorizontal,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { ManualAttendanceModal } from "@/components/attendance/ManualAttendanceModal";
import { getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  isAnyWindowOpen,
  isFinalAttendanceEvent,
  localDateString,
  type WindowTimes,
} from "@/lib/attendance-window";

type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE";

const STATUSES: {
  key: AttendanceStatus;
  label: string;
  hotkey: string;
  icon: React.ElementType;
  idle: string;
  active: string;
  dot: string;
  badgeClass: string;
}[] = [
  {
    key: "PRESENT",
    label: "Present",
    hotkey: "1",
    icon: CheckCircle2,
    idle: "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-300 font-bold",
    active: "bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-400 ring-offset-1 font-black shadow-md shadow-emerald-500/20",
    dot: "bg-emerald-500",
    badgeClass: "bg-emerald-600 text-white font-black border-emerald-500 shadow-xs",
  },
  {
    key: "LATE",
    label: "Late",
    hotkey: "2",
    icon: Clock,
    idle: "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-900 hover:border-amber-300 font-bold",
    active: "bg-amber-500 text-slate-950 border-amber-500 ring-2 ring-amber-300 ring-offset-1 font-black shadow-md shadow-amber-500/20",
    dot: "bg-amber-400",
    badgeClass: "bg-amber-500/20 text-amber-900 border-amber-300 font-black",
  },
  {
    key: "ABSENT",
    label: "Absent",
    hotkey: "3",
    icon: XCircle,
    idle: "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-rose-50 hover:text-rose-800 hover:border-rose-300 font-bold",
    active: "bg-red-600 text-white border-red-600 ring-2 ring-red-400 ring-offset-1 font-black shadow-md shadow-red-500/20",
    dot: "bg-red-400",
    badgeClass: "bg-rose-500/20 text-rose-800 border-rose-300 font-black",
  },
  {
    key: "ON_LEAVE",
    label: "Leave",
    hotkey: "4",
    icon: ShieldCheck,
    idle: "bg-slate-50/80 text-slate-700 border-slate-200 hover:bg-purple-50 hover:text-purple-800 hover:border-purple-300 font-bold",
    active: "bg-purple-600 text-white border-purple-600 ring-2 ring-purple-400 ring-offset-1 font-black shadow-md shadow-purple-500/20",
    dot: "bg-purple-400",
    badgeClass: "bg-purple-500/20 text-purple-900 border-purple-300 font-black",
  },
];

const STATUS_DOT: Record<AttendanceStatus, string> = {
  PRESENT: "bg-emerald-400",
  LATE: "bg-amber-400",
  ABSENT: "bg-red-400",
  ON_LEAVE: "bg-purple-400",
};

interface ScheduledWindow {
  id: string;
  name: string;
  windowType?: "HIKVISION" | "MANUAL" | "BOTH";
  startTime: string;
  endTime: string;
  lateEndTime?: string;
  graceMinutes: number;
  enabled: boolean;
}

interface RosterStudent {
  profileId: string;
  firstName: string;
  lastName: string;
  name: string;
  studentNumber: string;
  grade: string;
  section: string;
  avatarUrl: string | null;
  status: AttendanceStatus;
  originalStatus?: AttendanceStatus;
  checkInTime: string;
  source?: string | null;
  verificationMethod?: string | null;
  isBiometric?: boolean;
  justificationStatus: string;
  justification: string | null;
}

export default function TeacherAttendancePage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(() => localDateString());
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [focusedIndex, setFocusedIndex] = useState<number | null>(0);
  const [showHotkeys, setShowHotkeys] = useState(false);

  // Schedules and Live Clock
  const [scheduledWindows, setScheduledWindows] = useState<ScheduledWindow[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("ALL");
  const [currentTimeIst, setCurrentTimeIst] = useState("");

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justifications, setJustifications] = useState<any[]>([]);
  const [loadingJustifications, setLoadingJustifications] = useState(true);
  const [handlingId, setHandlingId] = useState<string | null>(null);

  // Email report state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [emailPeriodType, setEmailPeriodType] = useState<"WEEKLY" | "MONTHLY">("WEEKLY");
  const [emailNote, setEmailNote] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [manualModalOpen, setManualModalOpen] = useState(false);

  // Live IST Clock update every second
  useEffect(() => {
    const updateTime = () => {
      const ist = new Date().toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });
      setCurrentTimeIst(ist);
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch Schedules Metadata
  useEffect(() => {
    fetch("/api/attendance/manual/schedules")
      .then((r) => r.json())
      .then((res) => {
        if (res?.success && Array.isArray(res.data?.scheduledWindows)) {
          setScheduledWindows(res.data.scheduledWindows);
        }
      })
      .catch(() => {});
  }, []);

  const activeWindow = useMemo(() => {
    if (scheduledWindows.length === 0) return null;
    if (selectedScheduleId && selectedScheduleId !== "ALL") {
      const match = scheduledWindows.find((w) => w.id === selectedScheduleId);
      if (match) return match;
    }
    const nowIst = new Date().toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return (
      scheduledWindows.find(
        (w) => w.enabled && nowIst >= w.startTime && nowIst <= (w.lateEndTime || w.endTime)
      ) || scheduledWindows[0] || null
    );
  }, [scheduledWindows, selectedScheduleId, currentTimeIst]);

  const handleSendClassEmails = async () => {
    if (!classId || roster.length === 0) return;
    setEmailSending(true);
    try {
      const studentIds = roster.map((s) => s.profileId);
      const res = await fetch("/api/admin/attendance/email-reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentIds,
          periodType: emailPeriodType,
          customNote: emailNote.trim() || undefined,
          sendToParents: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast({
          title: "Attendance Emails Sent",
          description: `Dispatched ${json.data.sentCount} email${json.data.sentCount !== 1 ? "s" : ""} to parents.`,
          variant: "success",
        });
        setEmailModalOpen(false);
        setEmailNote("");
      } else {
        toast({ title: json.error || "Failed to send emails", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to connect to email service", variant: "destructive" });
    } finally {
      setEmailSending(false);
    }
  };

  const fetchJustifications = useCallback(async () => {
    try {
      const res = await fetch("/api/teacher/attendance/justifications");
      const json = await res.json();
      if (json.success) setJustifications(json.data);
    } catch {
      // silent
    } finally {
      setLoadingJustifications(false);
    }
  }, []);

  useEffect(() => {
    fetchJustifications();
  }, [fetchJustifications]);

  const handleJustification = async (id: string, decision: "APPROVED" | "REJECTED") => {
    setHandlingId(id);
    try {
      const res = await fetch("/api/attendance/justification", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendanceId: id, decision }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: decision === "APPROVED" ? "Justification approved" : "Justification declined",
          variant: "success",
        });
        setJustifications((prev) => prev.filter((j) => j.id !== id));
      } else {
        toast({ title: json.error || "Failed to update justification", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to update justification", variant: "destructive" });
    } finally {
      setHandlingId(null);
    }
  };

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId) || null,
    [classes, classId],
  );

  useEffect(() => {
    fetch("/api/teacher/classes")
      .then((r) => r.json())
      .then((res) => {
        if (res.success && res.data.length > 0) {
          setClasses(res.data);
          setClassId(res.data[0].id);
        }
      })
      .catch(() => toast({ title: "Failed to load classes", variant: "destructive" }))
      .finally(() => setLoadingClasses(false));
  }, []);

  const loadRoster = useCallback(async () => {
    if (!classId) return;
    setLoadingRoster(true);
    try {
      const students = selectedClass?.students || [];
      const res = await fetch(`/api/attendance?classId=${classId}&date=${date}`);
      const json = await res.json();
      const existing: any[] = json.success && Array.isArray(json.data) ? json.data : [];
      const map = new Map<string, any>();
      for (const r of existing) {
        if (r.studentId) map.set(r.studentId, r);
        if (r.student?.id) map.set(r.student.id, r);
        if (r.student?.studentId) map.set(r.student.studentId, r);
        if (r.student?.user?.id) map.set(r.student.user.id, r);
      }

      setRoster(
        students.map((s: any) => {
          const record = map.get(s.profileId) || map.get(s.id) || map.get(s.studentNumber) || map.get(s.its);
          const isBiometric =
            record?.source === "BIOMETRIC" ||
            Boolean(record?.biometricMethod) ||
            Boolean(record?.checkInTime && !record?.verificationMethod?.includes("Manual")) ||
            (record?.verificationMethod && /biometric|hikvision/i.test(record.verificationMethod));

          const rawName = s.name?.trim();
          const constructedName = `${s.firstName || ""} ${s.lastName || ""}`.trim();
          const studentName = rawName || constructedName || (s.its ? `ITS ${s.its}` : s.studentNumber) || "Student";
          const currentStatus: AttendanceStatus = (record?.status as AttendanceStatus) || (record?.checkInTime ? "PRESENT" : "ABSENT");

          return {
            profileId: s.profileId,
            firstName: s.firstName || "",
            lastName: s.lastName || "",
            name: studentName,
            studentNumber: s.studentNumber || s.its || "",
            grade: s.grade || "",
            section: s.section || "",
            avatarUrl: s.avatarUrl || null,
            status: currentStatus,
            originalStatus: currentStatus,
            source: record?.source || (isBiometric ? "BIOMETRIC" : record?.checkInTime ? "BIOMETRIC" : "AUTO_ABSENT"),
            verificationMethod: record?.verificationMethod || (isBiometric ? "Hikvision Biometric Terminal" : record?.source === "MANUAL" ? "Manual Entry" : null),
            isBiometric,
            checkInTime: record?.checkInTime
              ? new Date(record.checkInTime).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                  timeZone: "Asia/Kolkata",
                })
              : "",
            justificationStatus: record?.justificationStatus || "NONE",
            justification: record?.justification || null,
          };
        }),
      );
    } catch {
      toast({ title: "Failed to load attendance", variant: "destructive" });
    } finally {
      setLoadingRoster(false);
    }
  }, [classId, date, selectedClass]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  // Schedule windows used to gate live pulling
  const scheduleWindowsRef = useRef<WindowTimes[] | null>(null);
  useEffect(() => {
    fetch("/api/attendance/manual/schedules")
      .then((r) => r.json())
      .then((res) => {
        const wins = res?.success ? res.data?.scheduledWindows : null;
        if (Array.isArray(wins)) {
          const all: WindowTimes[] = [];
          for (const w of wins) {
            all.push({
              startTime: w.startTime,
              endTime: w.endTime,
              lateEndTime: w.lateEndTime || w.endTime,
              enabled: w.enabled,
            });
          }
          scheduleWindowsRef.current = all;
        }
      })
      .catch(() => {});
  }, []);

  // Live biometric scan ingestion
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const shouldLivePull = (evType?: unknown) => {
      if (isFinalAttendanceEvent(evType)) return true;
      if (date !== localDateString()) return false;
      const wins = scheduleWindowsRef.current;
      if (!wins) return true;
      return isAnyWindowOpen(wins);
    };

    const connect = () => {
      try {
        es = new EventSource("/api/biometric/events/stream");
        es.onmessage = (e) => {
          try {
            const ev = JSON.parse(e.data);
            if (isFinalAttendanceEvent(ev?.type)) {
              loadRoster();
            } else if (
              shouldLivePull(ev?.type) &&
              ev && (ev.type === "MATCHED" || ev.type === "DUPLICATE" || ev.student || ev.teacher || ev.status)
            ) {
              loadRoster();
            }
          } catch {}
        };
        es.onerror = () => {
          try { es?.close(); } catch {}
          if (!retryTimer) {
            retryTimer = setTimeout(() => {
              retryTimer = null;
              connect();
            }, 3000);
          }
        };
      } catch {}
    };

    connect();

    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        if (shouldLivePull("MATCHED")) {
          loadRoster();
        }
      }
    }, 15000);

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      clearInterval(pollInterval);
      es?.close();
    };
  }, [date, loadRoster]);

  const setStatus = (profileId: string, status: AttendanceStatus) => {
    setRoster((prev) =>
      prev.map((s) => (s.profileId === profileId ? { ...s, status } : s)),
    );
  };

  const cycleStatus = (profileId: string) => {
    setRoster((prev) =>
      prev.map((s) => {
        if (s.profileId !== profileId) return s;
        const order: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "ON_LEAVE"];
        const next = order[(order.indexOf(s.status) + 1) % order.length];
        return { ...s, status: next };
      }),
    );
  };

  const filteredRoster = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.studentNumber.toLowerCase().includes(q) ||
        s.grade.toLowerCase().includes(q) ||
        s.section.toLowerCase().includes(q)
      );
    });
  }, [roster, query, statusFilter]);

  const setAll = (status: AttendanceStatus) => {
    setRoster((prev) => prev.map((s) => ({ ...s, status })));
    toast({
      title: `Bulk Action Completed`,
      description: `Marked all students in view as ${status}.`,
      variant: "success",
    });
  };

  const resetAll = () => {
    setRoster((prev) =>
      prev.map((s) => ({
        ...s,
        status: s.originalStatus || "PRESENT",
      }))
    );
    toast({ title: "Reset changes to original state", variant: "default" });
  };

  const summary = useMemo(() => {
    const counts: Record<AttendanceStatus, number> = {
      PRESENT: 0,
      LATE: 0,
      ABSENT: 0,
      ON_LEAVE: 0,
    };
    roster.forEach((s) => {
      if (counts[s.status] !== undefined) {
        counts[s.status] += 1;
      }
    });
    return counts;
  }, [roster]);

  const hasChanges = useMemo(() => {
    return roster.some((s) => s.status !== s.originalStatus);
  }, [roster]);

  const changedCount = useMemo(() => {
    return roster.filter((s) => s.status !== s.originalStatus).length;
  }, [roster]);

  const save = useCallback(async () => {
    if (!classId || roster.length === 0) return;
    setSaving(true);
    try {
      const records = roster.map((s) => ({
        studentId: s.profileId,
        status: s.status,
        ...(s.checkInTime ? { checkInTime: `${date}T${s.checkInTime}:00+05:30` } : {}),
      }));
      const res = await fetch("/api/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, date, records }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Attendance Saved & Synced Successfully!",
          description: `${json.data.count} student record(s) persisted to PostgreSQL & Google Sheets for ${date}`,
          variant: "success",
        });
        setRoster((prev) => prev.map((s) => ({ ...s, originalStatus: s.status })));
      } else {
        toast({ title: json.error || "Failed to save attendance", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save attendance", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [classId, date, roster]);

  // Keyboard Hotkeys: 1: Present, 2: Late, 3: Absent, 4: Leave, Arrows / J / K, Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "SELECT"
      ) {
        return;
      }

      if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        save();
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
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, AttendanceStatus> = {
          "1": "PRESENT",
          "2": "LATE",
          "3": "ABSENT",
          "4": "ON_LEAVE",
        };
        const status = map[e.key];
        const targetStudent = filteredRoster[curr];
        if (targetStudent && status) {
          setStatus(targetStudent.profileId, status);
          if (curr < filteredRoster.length - 1) {
            setFocusedIndex(curr + 1);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredRoster, focusedIndex, save]);

  const markedCount = roster.filter((s) => s.status !== "ABSENT").length;
  const presentPct = roster.length > 0 ? Math.round((summary.PRESENT / roster.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-[#faf7f0] space-y-5 pb-24">
      {/* ── Hub Tabs ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdminHubTabs
          hubTitle="Attendance & Biometric Center"
          hubDescription="Quick classroom roll-call, timetable schedules, and high-speed multi-terminal sync."
          tabs={[
            { label: "Manual Logs", href: "/admin/manual-attendance", icon: ClipboardCheck, badge: "Register" },
            { label: "Hikvision Scans", href: "/admin/attendance-hik", icon: Fingerprint, badge: "Hardware" },
            { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
            { label: "Device Hub", href: "/admin/biometric", icon: Activity },
          ]}
        />
      </div>

      {/* ── Schedule Timetable Master Header Banner (Fatimi Gold & Charcoal) ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-[#d4af37]/60 bg-gradient-to-br from-[#12161f] via-[#1a202c] to-[#12161f] p-6 sm:p-7 shadow-[0_16px_36px_rgba(20,24,33,0.3)] text-white">
          <div className="pointer-events-none absolute -right-12 -bottom-12 w-80 h-80 rounded-full bg-[#d4af37]/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 -top-12 w-72 h-72 rounded-full bg-[#f3b833]/10 blur-3xl" />

          {/* Top Timetable & Clock Row */}
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <span className="inline-flex w-12 h-12 rounded-2xl bg-[#d4af37]/20 border border-[#d4af37]/40 items-center justify-center shadow-inner">
                <Clock className="w-6 h-6 text-[#f3b833] stroke-[2.2]" />
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase tracking-wider text-[#fde047]">
                    Timetable Schedule Window
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-[#d4af37]/20 text-[#fff4be] border border-[#d4af37]/40">
                    <span className="w-2 h-2 rounded-full bg-[#fde047] animate-pulse" />
                    LIVE IST: {currentTimeIst || "Syncing..."}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-0.5">
                  {activeWindow ? activeWindow.name : "Classroom Attendance Register"}
                </h2>
              </div>
            </div>

            {/* Timetable Session Status & Hotkeys Button */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setShowHotkeys((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-emerald-100 transition-colors"
              >
                <Keyboard className="w-3.5 h-3.5 text-[#fde047]" />
                Hotkeys [1-4, J/K, Ctrl+S]
              </button>
              <button
                type="button"
                onClick={() => setManualModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-xs font-bold text-white transition-all shadow-xs"
              >
                <Fingerprint className="w-3.5 h-3.5 text-amber-300" />
                Manual Entry
              </button>
            </div>
          </div>

          {/* Interactive Schedule Timetable Sessions Strip */}
          {scheduledWindows.length > 0 && (
            <div className="relative z-10 pt-4 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-emerald-200/80 mr-1 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-[#fde047]" />
                Timetable Sessions:
              </span>
              {scheduledWindows.map((win) => {
                const isSelected = (selectedScheduleId === win.id) || (!selectedScheduleId && activeWindow?.id === win.id);
                return (
                  <button
                    key={win.id}
                    type="button"
                    onClick={() => setSelectedScheduleId(win.id)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 active:scale-95",
                      isSelected
                        ? "bg-[#d4af37] text-slate-950 border-[#fde047] ring-2 ring-amber-300 font-black shadow-md"
                        : "bg-white/10 hover:bg-white/20 border-white/15 text-emerald-100"
                    )}
                  >
                    <span>{win.name}</span>
                    <span className={cn(
                      "font-mono text-[11px] px-1.5 py-0.2 rounded font-bold",
                      isSelected ? "bg-black/20 text-slate-950" : "bg-black/30 text-emerald-200"
                    )}>
                      {win.startTime} - {win.endTime}
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-slate-950 animate-pulse" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Hotkey Helper Drawer */}
          <AnimatePresence>
            {showHotkeys && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="relative z-10 mt-4 pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs"
              >
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-emerald-200">
                  <span className="font-mono font-black text-amber-300">Key 1:</span> Mark Present
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-amber-200">
                  <span className="font-mono font-black text-amber-300">Key 2:</span> Mark Late
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-rose-200">
                  <span className="font-mono font-black text-amber-300">Key 3:</span> Mark Absent
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-purple-200">
                  <span className="font-mono font-black text-amber-300">Key 4:</span> Mark Leave
                </div>
                <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-emerald-100">
                  <span className="font-mono font-black text-amber-300">Ctrl+S / J,K:</span> Save &amp; Navigate
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
        {/* ── Pending Justifications ── */}
        <AnimatePresence>
          {!loadingJustifications && justifications.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              <div className="rounded-2xl bg-amber-50 border border-amber-200 overflow-hidden shadow-xs">
                <div className="px-5 py-3 flex items-center gap-2 bg-amber-100/60 border-b border-amber-200">
                  <ClipboardList className="w-4 h-4 text-amber-600" />
                  <h3 className="text-sm font-bold text-amber-900">Absence Justifications</h3>
                  <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-black">
                    {justifications.length} pending
                  </span>
                </div>
                <div className="divide-y divide-amber-100">
                  {justifications.map((j) => (
                    <div key={j.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-gray-900">{j.studentName}</p>
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
                            {j.status === "ABSENT" ? "Absent" : "Early Dep."}
                          </span>
                          <span className="text-xs text-gray-500">
                            {j.className} ·{" "}
                            {new Date(j.date).toLocaleDateString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">"{j.justification}"</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleJustification(j.id, "REJECTED")}
                          disabled={handlingId === j.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {handlingId === j.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                          Decline
                        </button>
                        <button
                          type="button"
                          onClick={() => handleJustification(j.id, "APPROVED")}
                          disabled={handlingId === j.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {handlingId === j.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Approve
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 1-Click Division Quick Switcher Strip ── */}
        <div className="rounded-2xl bg-white border border-gray-200/90 shadow-2xs p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-emerald-600" />
              1-Click Division Selector:
            </span>
            <span className="text-xs text-gray-400 font-medium">
              Switch classes with zero dropdowns
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {classes.map((cls) => {
              const isSelected = classId === cls.id;
              const isAll = cls.grade === "All" || cls.name.toLowerCase().includes("general");
              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setClassId(cls.id)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border active:scale-95 shadow-2xs",
                    isSelected
                      ? isAll
                        ? "bg-emerald-700 text-white border-emerald-700 ring-2 ring-emerald-400 font-black shadow-xs"
                        : "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-400 font-black shadow-xs"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-800"
                  )}
                >
                  {isAll ? (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>All Talabat (School)</span>
                    </>
                  ) : (
                    <span>Grade {cls.grade}-{cls.section}</span>
                  )}
                  {cls.studentCount !== undefined && (
                    <span className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold",
                      isSelected ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                    )}>
                      {cls.studentCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Controls & Class Switcher Card ── */}
        <div className="rounded-2xl bg-white border border-gray-200/90 shadow-xs p-4 sm:p-5">
          <div className="grid sm:grid-cols-3 gap-3.5">
            {/* Class selector */}
            <div>
              <label htmlFor="classId" className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-1.5">
                Class / Timetable Division
              </label>
              {loadingClasses ? (
                <div className="h-10 rounded-xl bg-gray-100 animate-pulse" />
              ) : (
                <div className="relative">
                  <select
                    id="classId"
                    name="classId"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    className="w-full h-10 appearance-none rounded-xl border border-gray-200 bg-gray-50 pl-3 pr-8 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors"
                  >
                    {classes.length === 0 && <option value="">No classes available</option>}
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} · {c.subject || "General"} · Gr {c.grade}{c.section ? `-${c.section}` : ""} ({c.studentCount} students)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-3 pointer-events-none" />
                </div>
              )}
            </div>

            {/* Date picker */}
            <div>
              <label htmlFor="date" className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-1.5">
                Register Date
              </label>
              <input
                type="date"
                id="date"
                name="date"
                value={date}
                onChange={(e) => e.target.value && setDate(e.target.value)}
                className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Search */}
            <div>
              <label htmlFor="roster-search" className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-1.5">
                Search Talabat
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  id="roster-search"
                  name="roster-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter by Student Name or ITS…"
                  className="w-full h-10 rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors placeholder:text-gray-400 font-medium"
                />
              </div>
            </div>
          </div>

          {/* Quick Filter Status Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3.5 mt-3.5 border-t border-gray-100">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase text-gray-400 mr-1">Filter:</span>
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                  statusFilter === "ALL"
                    ? "bg-slate-900 text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                All ({roster.length})
              </button>
              {STATUSES.map((cfg) => (
                <button
                  key={cfg.key}
                  type="button"
                  onClick={() => setStatusFilter(cfg.key)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5",
                    statusFilter === cfg.key
                      ? cfg.active
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  <span>{cfg.label} ({summary[cfg.key]})</span>
                </button>
              ))}
            </div>

            {/* Bulk Fast Entry Controls */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black uppercase text-gray-400 mr-1">Speed Actions:</span>
              <button
                type="button"
                onClick={() => setAll("PRESENT")}
                disabled={saving || roster.length === 0}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 transition-colors disabled:opacity-50 shadow-2xs"
              >
                <Check className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
                Mark All Present
              </button>
              <button
                type="button"
                onClick={() => setAll("ABSENT")}
                disabled={saving || roster.length === 0}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-extrabold text-rose-800 bg-rose-100 hover:bg-rose-200 border border-rose-300 transition-colors disabled:opacity-50 shadow-2xs"
              >
                <X className="w-3.5 h-3.5 text-rose-700 stroke-[2.5]" />
                All Absent
              </button>
              <button
                type="button"
                onClick={resetAll}
                disabled={saving || !hasChanges}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 transition-colors disabled:opacity-40"
              >
                <RotateCcw className="w-3 h-3 text-gray-500" />
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* ── Roster Student List ── */}
        {!classId || !selectedClass ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-16 text-center">
            {loadingClasses ? (
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <ClipboardCheck className="w-7 h-7 text-emerald-500" />
                </div>
                <p className="text-base font-bold text-gray-800">No classes assigned to this account.</p>
                <p className="text-xs text-gray-500 mt-1">Please contact your administrator to assign classes or portal permissions.</p>
              </>
            )}
          </div>
        ) : roster.length === 0 ? (
          <div className="rounded-2xl bg-white border border-gray-200 p-16 text-center">
            {loadingRoster ? (
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-base font-bold text-gray-800">No students enrolled in this division yet.</p>
                <p className="text-xs text-gray-500 mt-1">Enrolled talabat will appear here automatically.</p>
              </>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-white border border-gray-200 shadow-sm overflow-hidden">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/70">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                  <GraduationCap className="w-4 h-4 text-emerald-700" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-black text-gray-900">{selectedClass.name}</p>
                    {selectedClass.isMasool && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 shadow-2xs">
                        Masool al-Fasl
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 font-medium">
                    {date} · Showing {filteredRoster.length} of {roster.length} students
                  </p>
                </div>
                {loadingRoster && <Loader2 className="w-4 h-4 animate-spin text-emerald-600 ml-1" />}
              </div>

              {/* Email Parents & Save CTA */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-xs font-bold text-gray-700 transition-colors shadow-2xs"
                >
                  <Mail className="w-3.5 h-3.5 text-amber-600" />
                  Email Parents
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition-all disabled:opacity-50 shadow-xs"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Attendance
                </button>
              </div>
            </div>

            {/* Student Rows */}
            <div className="divide-y divide-gray-100">
              {loadingRoster ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-600" />
                </div>
              ) : (
                filteredRoster.map((s, idx) => {
                  const isFocused = focusedIndex === idx;
                  const currentStatusCfg = STATUSES.find((cfg) => cfg.key === s.status);

                  return (
                    <motion.div
                      key={s.profileId}
                      onClick={() => setFocusedIndex(idx)}
                      className={cn(
                        "px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 transition-colors cursor-pointer",
                        isFocused ? "bg-emerald-50/50 ring-1 ring-inset ring-emerald-400" : "hover:bg-gray-50/70"
                      )}
                    >
                      {/* Left: Avatar + Full Student Name + ITS */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        {/* 1-Click Status Cycle Avatar */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            cycleStatus(s.profileId);
                          }}
                          title="Click avatar to cycle status (Present → Late → Absent → Leave)"
                          className="relative shrink-0 focus:outline-none group"
                        >
                          {s.avatarUrl ? (
                            <img
                              src={s.avatarUrl}
                              alt={s.name}
                              className="w-11 h-11 rounded-2xl object-cover object-center border-2 border-white shadow-xs group-hover:scale-105 transition-transform"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-900 flex items-center justify-center text-xs font-black text-white border-2 border-white shadow-xs group-hover:scale-105 transition-transform">
                              {getInitials(s.name)}
                            </div>
                          )}
                          <span
                            className={cn(
                              "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white shadow-xs",
                              STATUS_DOT[s.status]
                            )}
                          />
                        </button>

                        {/* Name and Identity */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Full Student Name Prominently Displayed */}
                            <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight truncate font-display">
                              {s.name || s.studentNumber || "Student Name"}
                            </h3>

                            {/* Class Badge */}
                            {s.grade && (
                              <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-50 text-[10px] font-black text-emerald-800 border border-emerald-200">
                                Grade {s.grade}{s.section ? `-${s.section}` : ""}
                              </span>
                            )}

                            {/* Status Badge */}
                            {currentStatusCfg && (
                              <span className={cn(
                                "shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs",
                                currentStatusCfg.badgeClass
                              )}>
                                {currentStatusCfg.label}
                              </span>
                            )}
                          </div>

                          {/* Secondary Row: ITS Number + Scan Details */}
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            {/* Unmistakable ITS Badge */}
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-950 border border-amber-300 font-mono font-black text-xs shadow-2xs">
                              <span className="text-[9px] uppercase font-bold text-amber-700 tracking-wider">ITS</span>
                              <span>{s.studentNumber || "—"}</span>
                            </span>

                            {/* Check-In Biometric / Time Badge */}
                            {s.checkInTime ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <Clock className="w-3 h-3 text-emerald-600" />
                                {s.checkInTime}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                                Unscanned
                              </span>
                            )}

                            {/* Terminal Indicator */}
                            {s.isBiometric && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300 shadow-2xs">
                                <Fingerprint className="w-3 h-3 text-amber-700" />
                                Hikvision Terminal
                              </span>
                            )}

                            {/* Justification Indicator */}
                            {s.justificationStatus === "PENDING" && (
                              <span className="inline-block text-[10px] text-amber-600 font-bold">⏳ Justification pending</span>
                            )}
                            {s.justificationStatus === "APPROVED" && (
                              <span className="inline-block text-[10px] text-emerald-700 font-bold">✓ Absence justified</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Instant 1-Click Status Buttons with Hotkey Hints */}
                      <div className="grid grid-cols-4 sm:flex items-center gap-1.5 w-full sm:w-auto shrink-0">
                        {STATUSES.map((cfg) => {
                          const Icon = cfg.icon;
                          const active = s.status === cfg.key;
                          return (
                            <button
                              key={cfg.key}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatus(s.profileId, cfg.key);
                                setFocusedIndex(idx);
                              }}
                              className={cn(
                                "flex items-center justify-center gap-1 sm:gap-1.5 rounded-xl border px-2 sm:px-3 py-1.5 text-xs font-black transition-all duration-150 active:scale-[0.96]",
                                active ? cfg.active : cfg.idle
                              )}
                            >
                              <Icon className="w-3.5 h-3.5 shrink-0" />
                              <span>{cfg.label}</span>
                              <span className="text-[10px] opacity-60 font-mono font-black ml-0.5">[{cfg.hotkey}]</span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  );
                })
              )}

              {filteredRoster.length === 0 && !loadingRoster && (
                <div className="py-12 text-center text-gray-400">
                  <p className="text-sm font-semibold">No talabat match "{query}".</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Floating Quick-Save Dock (Pops up when changes exist or always accessible) ── */}
      <AnimatePresence>
        {hasChanges && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%]"
          >
            <div className="rounded-2xl bg-slate-950/95 backdrop-blur-md border border-emerald-500/50 p-3 sm:p-4 text-white shadow-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                <div>
                  <p className="text-xs sm:text-sm font-black text-white">
                    {changedCount} Unsaved Change{changedCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-[10px] text-emerald-200/80">Press Ctrl+S to save immediately</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={resetAll}
                  className="px-3 py-1.5 rounded-xl border border-white/20 text-xs font-bold text-gray-300 hover:bg-white/10 transition-colors"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all shadow-md shadow-emerald-600/30 active:scale-95 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Email Report Modal ── */}
      <AnimatePresence>
        {emailModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200/80 overflow-hidden"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-amber-600" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">Email Attendance Reports to Parents</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-sm text-gray-600">
                  Send personalized attendance reports for all{" "}
                  <strong className="text-gray-900">{roster.length} talabat</strong> in{" "}
                  <strong className="text-gray-900">{selectedClass?.name || "this class"}</strong> to their parents.
                </p>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-2">Report Period</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(["WEEKLY", "MONTHLY"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setEmailPeriodType(type)}
                        className={cn(
                          "py-2.5 px-3 rounded-xl border text-xs font-bold transition-all",
                          emailPeriodType === type
                            ? "border-amber-500 bg-amber-50 text-amber-900 shadow-sm"
                            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                        )}
                      >
                        {type === "WEEKLY" ? "📅 Weekly (Past 7 Days)" : "📊 Monthly (Current Month)"}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-gray-500 uppercase tracking-[0.12em] mb-2">Teacher's Note (Optional)</label>
                  <textarea
                    rows={3}
                    value={emailNote}
                    onChange={(e) => setEmailNote(e.target.value)}
                    placeholder="e.g. Jazakallah for ensuring punctual attendance."
                    className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400 resize-none transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSendClassEmails}
                  disabled={emailSending}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-black transition-all disabled:opacity-60"
                >
                  {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Send to {roster.length} Parents
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Schedule-Driven Manual Attendance Modal ── */}
      <ManualAttendanceModal
        open={manualModalOpen}
        onOpenChange={setManualModalOpen}
        initialDate={date}
        onSuccess={() => loadRoster()}
      />

      {/* ── Sticky Live Floating Sync Bar ── */}
      <AnimatePresence>
        {roster.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[94%] max-w-[700px] p-3.5 sm:p-4 rounded-3xl bg-slate-950/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl text-white flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={cn(
                "w-3 h-3 rounded-full shrink-0",
                hasChanges ? "bg-amber-400 animate-pulse shadow-[0_0_12px_#f59e0b]" : "bg-emerald-400"
              )} />
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black text-white">
                    {summary.PRESENT} Present
                  </span>
                  <span className="text-gray-500">•</span>
                  <span className="text-xs font-bold text-amber-400">
                    {summary.LATE} Late
                  </span>
                  <span className="text-gray-500">•</span>
                  <span className="text-xs font-bold text-rose-400">
                    {summary.ABSENT} Absent
                  </span>
                  <span className="text-gray-500">•</span>
                  <span className="text-xs font-bold text-purple-300">
                    {summary.ON_LEAVE} Leave
                  </span>
                </div>
                <p className="text-[11px] text-emerald-300/80 truncate">
                  {selectedClass ? selectedClass.name : "Class"} · {activeWindow ? `${activeWindow.name} · ` : ""}{roster.length} students enrolled
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {hasChanges && (
                <button
                  type="button"
                  onClick={resetAll}
                  className="text-xs text-gray-300 hover:text-white hover:bg-white/10 rounded-xl h-9 px-3 transition-colors"
                >
                  Reset
                </button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={save}
                disabled={saving}
                className={cn(
                  "font-black text-xs rounded-2xl h-10 px-5 shadow-lg flex items-center gap-1.5 active:scale-95 transition-all",
                  hasChanges
                    ? "bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 text-slate-950 ring-2 ring-emerald-300 animate-pulse scale-105"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    {hasChanges ? "Save Attendance (Ctrl+S)" : "Saved"}
                  </>
                )}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
