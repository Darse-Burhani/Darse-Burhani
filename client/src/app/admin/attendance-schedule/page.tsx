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
  Stethoscope,
  Radio,
  Activity,
  Zap,
  Volume2,
  Bell,
  GraduationCap,
  ClipboardCheck,
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
  audience?: string;
  applicableClassIds?: string[];
  exemptStudentIds?: string[];
  applicableClasses?: Array<{ id: string; name: string; grade: string; section: string }>;
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
  accent?: "emerald" | "indigo" | "purple";
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
      : accent === "indigo"
      ? "bg-gradient-to-r from-indigo-500 to-indigo-600"
      : "bg-gradient-to-r from-emerald-500 to-teal-500";

  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center justify-between text-[10px] font-semibold text-gray-500">
        <span className="flex items-center gap-1 font-mono text-gray-700">
          <span className={`w-1.5 h-1.5 rounded-full ${accent === "purple" ? "bg-purple-600" : accent === "indigo" ? "bg-indigo-600" : "bg-emerald-600"}`} />
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
  const [activeTab, setActiveTab] = useState<"HIKVISION" | "MANUAL">("HIKVISION");
  const [loading, setLoading] = useState(true);

  // Scan Windows state
  const [windows, setWindows] = useState<ScanWindow[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [windowModalOpen, setWindowModalOpen] = useState(false);
  const [editingWindow, setEditingWindow] = useState<ScanWindow | null>(null);
  const [windowForm, setWindowForm] = useState({
    name: "",
    windowType: "HIKVISION" as "HIKVISION" | "MANUAL" | "BOTH",
    startTime: "07:30",
    endTime: "08:30",
    lateEndTime: "09:00",
    graceMinutes: 10,
    enabled: true,
    applicableClassIds: [] as string[],
  });
  const [savingWindow, setSavingWindow] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Download export state
  const [exporting, setExporting] = useState(false);

  // Sound audition test state
  const [isPlayingSound, setIsPlayingSound] = useState(false);
  const [desktopNotifState, setDesktopNotifState] = useState<NotificationPermission>("default");

  // Real-Time Biometric Scan Event Stream
  const [realTimeConnected, setRealTimeConnected] = useState(false);
  const [latestScan, setLatestScan] = useState<{
    name: string;
    role: string;
    status: string;
    time: string;
    message?: string;
  } | null>(null);

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

  // Fetch Class Directory for scope selection
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

  const loadData = useCallback(async () => {
    try {
      await Promise.allSettled([fetchWindows(), fetchClasses()]);
    } finally {
      setLoading(false);
    }
  }, [fetchWindows, fetchClasses]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-Time SSE Stream for Gateway Telemetry
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

              // Play gentle bell sound
              playSmoothChime(status === "LATE" ? "alert" : "arrival");
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
  }, []);

  // Filter windows by workspace
  const hikvisionWindows = useMemo(() => {
    return windows.filter(
      (w) =>
        w.windowType === "HIKVISION" ||
        (w.id === "default" && (!w.windowType || w.windowType === "HIKVISION")) ||
        (w.windowType === "BOTH" && !w.id.startsWith("manual_"))
    );
  }, [windows]);

  const manualWindows = useMemo(() => {
    return windows.filter(
      (w) =>
        w.windowType === "MANUAL" ||
        w.id.startsWith("manual_") ||
        (w.windowType === "BOTH" && w.id !== "default" && !w.id.startsWith("hik_"))
    );
  }, [windows]);

  // Open modal to create/edit window
  const openWindowModal = (
    w?: ScanWindow,
    presetWindowType?: "HIKVISION" | "MANUAL" | "BOTH"
  ) => {
    if (w) {
      setEditingWindow(w);
      setWindowForm({
        name: w.name,
        windowType: (w.windowType as any) || presetWindowType || (activeTab === "HIKVISION" ? "HIKVISION" : "MANUAL"),
        startTime: w.startTime,
        endTime: w.endTime,
        lateEndTime: w.lateEndTime ?? w.endTime,
        graceMinutes: w.graceMinutes,
        enabled: w.enabled,
        applicableClassIds: w.applicableClassIds || [],
      });
    } else {
      setEditingWindow(null);
      const chosenType = presetWindowType || (activeTab === "HIKVISION" ? "HIKVISION" : "MANUAL");
      const defaultName =
        chosenType === "HIKVISION"
          ? "Hikvision Morning Punch Window"
          : chosenType === "MANUAL"
          ? "Classroom Roll Call Window"
          : "Tilawat al Dua Window";

      setWindowForm({
        name: defaultName,
        windowType: chosenType,
        startTime: "07:30",
        endTime: "08:30",
        lateEndTime: "09:00",
        graceMinutes: 10,
        enabled: true,
        applicableClassIds: [],
      });
    }
    setWindowModalOpen(true);
  };

  // Save window
  const saveWindow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!windowForm.name.trim()) {
      toast({ title: "Please enter attendance window name", variant: "destructive" });
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
          role: "STUDENT",
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
              <span>Dual Attendance Timing Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white font-display tracking-tight">
              Attendance Schedule &amp; Timing
            </h1>
            <p className="text-emerald-100/90 text-sm mt-1.5 max-w-2xl font-medium leading-relaxed">
              Differentiated schedule centers for <strong>Automated Hikvision Hardware Terminals</strong> and <strong>Manual Classroom Registers</strong>.
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
              onClick={downloadExcel}
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

      {/* ── Main Tab Switcher (Differentiated Workspaces: Hikvision vs Manual) ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center p-1.5 bg-gray-100/90 rounded-2xl border border-gray-200/90 w-fit flex-wrap gap-1.5 shadow-inner">
          {/* 1. HIKVISION HARDWARE SCHEDULE TAB */}
          <button
            type="button"
            onClick={() => setActiveTab("HIKVISION")}
            className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 select-none active:scale-[0.97] ${
              activeTab === "HIKVISION"
                ? "bg-white text-purple-950 shadow-md border border-purple-200 font-black ring-2 ring-purple-500/30"
                : "text-gray-600 hover:text-gray-950 hover:bg-white/60"
            }`}
          >
            <span className={`flex items-center justify-center w-6 h-6 rounded-lg transition-transform group-hover:scale-110 ${activeTab === "HIKVISION" ? "bg-purple-100 text-purple-800" : "bg-gray-200/70 text-gray-600"}`}>
              <Radio className="w-3.5 h-3.5" />
            </span>
            <span>Hikvision Hardware</span>
            <Badge variant="outline" className="ml-1 bg-purple-50 text-purple-800 border-purple-200 text-[10px] font-extrabold">
              {hikvisionWindows.length}
            </Badge>
          </button>

          {/* 2. MANUAL REGISTER SCHEDULE TAB */}
          <button
            type="button"
            onClick={() => setActiveTab("MANUAL")}
            className={`group flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 select-none active:scale-[0.97] ${
              activeTab === "MANUAL"
                ? "bg-white text-emerald-950 shadow-md border border-emerald-200 font-black ring-2 ring-emerald-500/30"
                : "text-gray-600 hover:text-gray-950 hover:bg-white/60"
            }`}
          >
            <span className={`flex items-center justify-center w-6 h-6 rounded-lg transition-transform group-hover:scale-110 ${activeTab === "MANUAL" ? "bg-emerald-100 text-emerald-800" : "bg-gray-200/70 text-gray-600"}`}>
              <ClipboardCheck className="w-3.5 h-3.5" />
            </span>
            <span>Manual Register</span>
            <Badge variant="outline" className="ml-1 bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-extrabold">
              {manualWindows.length}
            </Badge>
          </button>
        </div>

        {/* Action Button tailored to active tab */}
        {activeTab === "HIKVISION" ? (
          <Button
            onClick={() => openWindowModal(undefined, "HIKVISION")}
            variant="default"
            className="bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-md rounded-xl h-10 px-4 flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" />
            <span>Add Hikvision Hardware Window</span>
          </Button>
        ) : (
          <Button
            onClick={() => openWindowModal(undefined, "MANUAL")}
            variant="default"
            className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md rounded-xl h-10 px-4 flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 duration-300" />
            <span>Add Manual Register Window</span>
          </Button>
        )}
      </div>

      {/* ── WORKSPACE 1: HIKVISION BIOMETRIC HARDWARE SCHEDULE ── */}
      {loading ? (
        <WindowSkeleton />
      ) : activeTab === "HIKVISION" ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-900/10 via-slate-900/5 to-purple-900/10 border border-purple-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-300 flex items-center justify-center text-purple-800 shadow-2xs shrink-0">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-purple-950 font-display">
                  Hikvision Biometric Hardware Timing
                </h3>
                <p className="text-xs text-purple-800/80 mt-0.5">
                  Automated facial recognition &amp; card terminal punch shifts. Terminal scans outside these hours are flagged.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-bold bg-white text-purple-900 border-purple-300">
              {hikvisionWindows.length} Hardware Window(s) Active
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {hikvisionWindows.map((w) => {
              const isLive = w.status === "ACTIVE" || w.status === "GRACE_PERIOD";
              return (
                <Card
                  key={w.id}
                  className={`group relative overflow-hidden transition-all duration-300 rounded-3xl border bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 ${
                    w.enabled
                      ? isLive
                        ? "border-purple-500/80 ring-2 ring-purple-500/20 shadow-purple-500/10"
                        : "border-purple-200/90 hover:border-purple-400"
                      : "opacity-60 bg-gray-50/80 border-gray-200"
                  }`}
                >
                  <div
                    className={`h-2 w-full ${
                      !w.enabled
                        ? "bg-gray-300"
                        : isLive
                        ? "bg-gradient-to-r from-purple-600 via-indigo-500 to-purple-400"
                        : "bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400"
                    }`}
                  />
                  <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105 ${
                        isLive ? "bg-purple-100 text-purple-800 border border-purple-300" : "bg-purple-50 text-purple-700 border border-purple-100"
                      }`}>
                        <Radio className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          {isLive && (
                            <span className="relative flex h-2.5 w-2.5">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-500"></span>
                            </span>
                          )}
                          <h3 className="font-bold text-base text-gray-900 leading-tight">{w.name}</h3>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="bg-purple-50 text-purple-800 border-purple-200 text-[10px] font-extrabold flex items-center gap-1 py-0 px-2">
                            <Radio className="w-2.5 h-2.5 text-purple-600" />
                            <span>Hikvision Terminal</span>
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
                      <button
                        type="button"
                        onClick={() => openWindowModal(w, "HIKVISION")}
                        className="p-1.5 text-gray-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-all active:scale-90"
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
                    <div className="p-3.5 bg-purple-50/50 rounded-2xl border border-purple-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-white flex items-center justify-center text-purple-800 shadow-2xs border border-purple-200/60">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Device Punch Window</p>
                          <p className="text-sm font-black text-purple-950 font-mono">
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
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-white border border-purple-200 text-xs font-bold text-purple-900 font-mono">
                          {w.durationMinutes}m
                        </span>
                      </div>
                    </div>

                    {/* Timeline Bar */}
                    <ScheduleTimelineBar
                      startTime={w.startTime}
                      endTime={w.endTime}
                      lateEndTime={w.lateEndTime}
                      accent="purple"
                    />

                    {/* Grace Period & Live Status */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-purple-100">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Timer className="w-4 h-4 text-purple-600" />
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
                              ? "bg-purple-50 text-purple-900 border-purple-300"
                              : "bg-amber-50 text-amber-900 border-amber-300"
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${!w.enabled ? "bg-gray-400" : isLive ? "bg-purple-600 animate-pulse" : "bg-amber-500"}`} />
                          {!w.enabled ? "Disabled" : isLive ? "Active Live" : "Closed"}
                        </span>

                        <button
                          type="button"
                          onClick={() => toggleWindowActive(w)}
                          aria-label="Toggle window active state"
                          className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ease-out select-none active:scale-95 ${
                            w.enabled ? "bg-purple-600 shadow-sm" : "bg-gray-300"
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

      {/* ── WORKSPACE 2: MANUAL CLASSROOM REGISTER SCHEDULE ── */}
      {!loading && activeTab === "MANUAL" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-900/10 via-slate-900/5 to-emerald-900/10 border border-emerald-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 shadow-2xs shrink-0">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-emerald-950 font-display">
                  Manual Classroom Register Sessions
                </h3>
                <p className="text-xs text-emerald-800/80 mt-0.5">
                  Teacher roll call timing windows for classroom manual attendance sessions.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-bold bg-white text-emerald-900 border-emerald-300">
              {manualWindows.length} Manual Window(s) Active
            </Badge>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
            {manualWindows.map((w) => {
              const isLive = w.status === "ACTIVE" || w.status === "GRACE_PERIOD";
              return (
                <Card
                  key={w.id}
                  className={`group relative overflow-hidden transition-all duration-300 rounded-3xl border bg-white shadow-sm hover:shadow-xl hover:-translate-y-1 ${
                    w.enabled
                      ? isLive
                        ? "border-emerald-500/80 ring-2 ring-emerald-500/20 shadow-emerald-500/10"
                        : "border-emerald-200/90 hover:border-emerald-400"
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
                        <ClipboardCheck className="w-5 h-5 stroke-[1.8]" />
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
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[10px] font-extrabold flex items-center gap-1 py-0 px-2">
                            <ClipboardCheck className="w-2.5 h-2.5 text-emerald-600" />
                            <span>Manual Register</span>
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
                      <button
                        type="button"
                        onClick={() => openWindowModal(w, "MANUAL")}
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
                    <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-white flex items-center justify-center text-emerald-800 shadow-2xs border border-emerald-200/60">
                          <Clock className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Roll Call Session</p>
                          <p className="text-sm font-black text-emerald-950 font-mono">
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
                        <span className="inline-block px-2 py-0.5 rounded-lg bg-white border border-emerald-200 text-xs font-bold text-emerald-900 font-mono">
                          {w.durationMinutes}m
                        </span>
                      </div>
                    </div>

                    {/* Timeline Bar */}
                    <ScheduleTimelineBar
                      startTime={w.startTime}
                      endTime={w.endTime}
                      lateEndTime={w.lateEndTime}
                      accent="emerald"
                    />

                    {/* Grace Period & Live Status */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-100">
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
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      Attendance Session Name:
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Tilawat al Dua, Morning Assembly, Dhuhr Attendance"
                      value={windowForm.name}
                      onChange={(e) => setWindowForm({ ...windowForm, name: e.target.value })}
                      className="w-full h-11 px-4 rounded-xl border border-gray-200 text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs"
                    />
                  </div>

                  {/* Attendance Subsystem Mode */}
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">
                      Target Attendance Subsystem:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setWindowForm({ ...windowForm, windowType: "HIKVISION" })}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                          windowForm.windowType === "HIKVISION"
                            ? "bg-purple-50/90 border-purple-500 text-purple-950 ring-2 ring-purple-400/30 shadow-xs"
                            : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100/80"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-purple-900">
                          <Radio className="w-3.5 h-3.5 text-purple-600" />
                          <span>Hikvision</span>
                        </div>
                        <span className="text-[10px] text-gray-500 leading-tight">Hardware device scans &amp; gate terminals</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWindowForm({ ...windowForm, windowType: "MANUAL" })}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                          windowForm.windowType === "MANUAL"
                            ? "bg-emerald-50/90 border-emerald-500 text-emerald-950 ring-2 ring-emerald-400/30 shadow-xs"
                            : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100/80"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900">
                          <ClipboardCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Manual</span>
                        </div>
                        <span className="text-[10px] text-gray-500 leading-tight">Classroom roll call &amp; teacher registers</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWindowForm({ ...windowForm, windowType: "BOTH" })}
                        className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col gap-1 ${
                          windowForm.windowType === "BOTH"
                            ? "bg-blue-50/90 border-blue-500 text-blue-950 ring-2 ring-blue-400/30 shadow-xs"
                            : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100/80"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 font-bold text-xs text-blue-900">
                          <Zap className="w-3.5 h-3.5 text-blue-600" />
                          <span>Dual (Both)</span>
                        </div>
                        <span className="text-[10px] text-gray-500 leading-tight">Hardware gates + manual registers</span>
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
                      accent={windowForm.windowType === "HIKVISION" ? "purple" : "emerald"}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-emerald-900 block mb-1">On-Time From (24h):</label>
                      <input
                        type="time"
                        required
                        value={windowForm.startTime}
                        onChange={(e) => setWindowForm({ ...windowForm, startTime: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-emerald-300 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-emerald-50/20"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-emerald-900 block mb-1">On-Time To (24h):</label>
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
                      <label className="text-xs font-bold text-gray-700 block mb-1">Late Till (24h, optional):</label>
                      <input
                        type="time"
                        value={windowForm.lateEndTime || ""}
                        onChange={(e) => setWindowForm({ ...windowForm, lateEndTime: e.target.value })}
                        className="w-full h-10 px-3 rounded-xl border border-gray-200 text-xs font-bold font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        placeholder="e.g. 09:00"
                      />
                      <p className="text-[10px] text-gray-500 mt-1 font-medium">
                        Scans between On-Time To &amp; Late Till are marked <strong>LATE</strong>.
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

                  {/* Class Scope for Attendance */}
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                        <GraduationCap className="w-4 h-4 text-emerald-700" />
                        <span>Class Attendance Scope</span>
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
                      Choose which classes must attend this session.
                      <strong> Empty = applies to all classes.</strong>
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
    </div>
  );
}
