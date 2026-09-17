"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  ScanLine,
  UserCheck,
  UserX,
  Loader2,
  RefreshCw,
  Clock,
  CheckCircle2,
  Activity,
  CalendarDays,
  KeyRound,
  Plus,
  Trash2,
  Radio,
  CircleSlash2,
  Play,
  Square,
  Server,
  Radar,
  Pencil,
  PlugZap,
  Download,
  Link2,
  Webhook,
  Copy,
  Unplug,
  Usb,
  Save,
  Volume2,
  VolumeX,
  ShieldCheck,
  Search,
  Check,
  AlertTriangle,
  Cpu,
  Sparkles,
  ArrowRight,
  Filter,
  CheckCheck,
  Mail,
  Camera,
  Scan,
  FileSpreadsheet,
  Users,
  Zap,
  GraduationCap,
  Briefcase,
  ShieldAlert,
  User,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import FaceScannerModal from "@/components/admin/FaceScannerModal";
import IvmsControlStation from "@/components/admin/biometric/IvmsControlStation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

// ── Types ──


interface BiometricStudent {
  id: string;
  studentId: string;
  name: string;
  grade: string;
  section: string;
  active: boolean;
  enrolled: boolean;
  fingerprint: string | null;
  fingerprintPreview: string | null;
}

interface BiometricTeacher {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  active: boolean;
  enrolled: boolean;
  fingerprint: string | null;
  fingerprintPreview: string | null;
}

interface BiometricEvent {
  id: string;
  type: "MATCHED" | "UNKNOWN" | "NO_CLASS" | "DUPLICATE" | "TOO_EARLY" | "SYSTEM";
  fingerprint: string;
  deviceId: string | null;
  timestamp: string;
  role?: "STUDENT" | "TEACHER";
  student?: {
    id: string;
    studentId: string;
    name: string;
    grade: string;
    section: string;
    avatarUrl?: string | null;
    its?: string | null;
  };
  teacher?: {
    id: string;
    employeeId: string;
    name: string;
    department: string | null;
    status?: "PRESENT" | "LATE";
    avatarUrl?: string | null;
    its?: string | null;
  };
  classes?: {
    classId: string;
    className: string;
    subject: string;
    period: number;
    startTime: string;
    endTime: string;
    status: "PRESENT" | "LATE";
  }[];
  message?: string;
  isDuplicate?: boolean;
  scanCount?: number;
  scanWindow?: {
    name: string;
    startTime: string;
    endTime: string;
    graceMinutes: number;
    allowEarlyCheckIn?: boolean;
  };
  verifyMode?: "FINGERPRINT" | "FACIAL" | "CARD" | "BIOMETRIC";
}

interface BiometricDevice {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  username: string;
  hasPassword: boolean;
  serialNo: string | null;
  model: string | null;
  mac: string | null;
  firmwareVersion: string | null;
  status: string;
  lastError: string | null;
  lastSeenAt: string | null;
  lastPolledAt: string | null;
  lastEventCursor: string | null;
  pollIntervalSeconds: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DiscoveredDevice {
  host: string;
  port: number;
  mac: string;
  model: string;
  serialNo: string;
  deviceName: string;
  deviceType: string;
  firmwareVersion: string;
}

interface HikHttpHost {
  id: string;
  url: string;
  protocolType: string;
  parameterFormatType: string;
  addressingFormatType: string;
  ipAddress: string;
  portNo: string;
  httpAuthenticationType: string;
}

interface HikHttpConfig {
  webhookUrl: string;
  configured: boolean;
  hosts: HikHttpHost[];
}

interface UnmatchedFingerprint {
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

interface AutoMatchSuggestion {
  fingerprint: string;
  studentId: string;
  studentName: string;
  confidence: number;
  matchedBy: string;
}

const EVENT_STYLES: Record<
  BiometricEvent["type"],
  { label: string; chip: string; text: string; bg: string; icon: React.ElementType }
> = {
  MATCHED: {
    label: "Matched & Present",
    chip: "bg-emerald-600 text-white border-emerald-700 font-bold shadow-2xs",
    text: "text-emerald-950 font-bold",
    bg: "bg-emerald-50/95 border-emerald-300 shadow-sm ring-1 ring-emerald-500/20",
    icon: UserCheck,
  },
  DUPLICATE: {
    label: "Verified (Already Recorded)",
    chip: "bg-emerald-600 text-white border-emerald-700 font-bold shadow-2xs",
    text: "text-emerald-950 font-bold",
    bg: "bg-emerald-50/95 border-emerald-300 shadow-sm ring-1 ring-emerald-500/20",
    icon: CheckCircle2,
  },
  UNKNOWN: {
    label: "Unrecognized ID (Red)",
    chip: "bg-red-600 text-white border-red-700 font-bold animate-pulse shadow-sm",
    text: "text-red-900 font-bold",
    bg: "bg-red-50/95 border-red-400 shadow-md ring-2 ring-red-500/30",
    icon: UserX,
  },
  NO_CLASS: {
    label: "Recognized (No Class Scheduled)",
    chip: "bg-amber-100 text-amber-900 border-amber-300 font-semibold",
    text: "text-amber-900 font-bold",
    bg: "bg-amber-50/80 border-amber-200",
    icon: CircleSlash2,
  },
  TOO_EARLY: {
    label: "Too Early",
    chip: "bg-orange-100 text-orange-900 border-orange-300 font-semibold",
    text: "text-orange-900 font-bold",
    bg: "bg-orange-50/80 border-orange-200",
    icon: Clock,
  },
  SYSTEM: {
    label: "System Event",
    chip: "bg-gray-100 text-gray-700 border-gray-200 font-semibold",
    text: "text-gray-700 font-medium",
    bg: "bg-gray-50/70 border-gray-100",
    icon: Activity,
  },
};

// ── Web Audio Synthesizer (Instant Feedback Chimes) ──

function playAudioChime(type: "PRESENT" | "LATE" | "UNKNOWN") {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === "PRESENT") {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      osc2.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.12); // D6

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc2.start(ctx.currentTime + 0.1);
      osc1.stop(ctx.currentTime + 0.4);
      osc2.stop(ctx.currentTime + 0.4);
    } else if (type === "LATE") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.setValueAtTime(392, ctx.currentTime + 0.15); // G4

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch {
    // AudioContext blocked or not supported
  }
}

function maskFingerprint(fp: string): string {
  if (!fp) return "—";
  return fp.length > 14 ? `${fp.slice(0, 8)}…${fp.slice(-4)}` : fp;
}

function formatRelative(iso: string, now: number = Date.now()): string {
  if (!iso) return "never";
  const diff = now - new Date(iso).getTime();
  if (diff < 0) return "just now";
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatEventDateTime(iso: string): { date: string; time: string; full: string } {
  if (!iso) return { date: "", time: "", full: "" };
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const time = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
  return { date, time, full: `${date}, ${time} IST` };
}

function useLiveClock(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// ── Individual scan graph helpers (event timeline figure) ──
function hmToMinutes(hm: string | undefined | null): number | null {
  if (!hm || typeof hm !== "string" || !hm.includes(":")) return null;
  const [h, m] = hm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function istMinutesOf(iso: string): number | null {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
  } catch {
    return null;
  }
}

function scanGraphPosition(
  timestamp: string,
  startTime?: string | null,
  endTime?: string | null,
): { pct: number | null; label: string } {
  const s = hmToMinutes(startTime);
  const e = hmToMinutes(endTime);
  const t = istMinutesOf(timestamp);
  if (s === null || e === null || t === null || e <= s) return { pct: null, label: "" };
  const pct = Math.min(100, Math.max(0, ((t - s) / (e - s)) * 100));
  const mins = t - s;
  return { pct, label: mins >= 0 ? `+${mins}m into window` : `${Math.abs(mins)}m early` };
}

function eventNameOf(ev: any): string {
  return ev?.scanWindow?.name || ev?.eventName || "General Daily Scan";
}

type TabType = "ivms" | "terminals" | "talabat" | "teachers" | "unmatched";

export default function AdminBiometricPage() {
  const nowTick = useLiveClock();
  const [activeTab, setActiveTab] = useState<TabType>("terminals");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [faceModalOpen, setFaceModalOpen] = useState(false);

  const [status, setStatus] = useState<any>(null);
  const [students, setStudents] = useState<BiometricStudent[]>([]);
  const [teachers, setTeachers] = useState<BiometricTeacher[]>([]);
  const [events, setEvents] = useState<BiometricEvent[]>([]);
  const [todayRecords, setTodayRecords] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [liveConnected, setLiveConnected] = useState(false);
  const [dedupeFeed, setDedupeFeed] = useState(true);
  const [fetchingScans, setFetchingScans] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [membersReport, setMembersReport] = useState<any>(null);
  const [clearingFeed, setClearingFeed] = useState(false);
  const [feedRoleFilter, setFeedRoleFilter] = useState<"ALL" | "STUDENTS" | "TEACHERS" | "UNRECOGNIZED">("ALL");

  // Simulator
  const [simRole, setSimRole] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [simStudentId, setSimStudentId] = useState("");
  const [simTeacherId, setSimTeacherId] = useState("");
  const [simFingerprint, setSimFingerprint] = useState("");
  const [simTimestamp, setSimTimestamp] = useState("");
  const [simVerifyMode, setSimVerifyMode] = useState("FINGERPRINT");
  const [simBusy, setSimBusy] = useState(false);

  // Enroll
  const [enrollStudentId, setEnrollStudentId] = useState("");
  const [enrollFingerprint, setEnrollFingerprint] = useState("");
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [enrollDeviceId, setEnrollDeviceId] = useState("");
  const [enrollTeacherId, setEnrollTeacherId] = useState("");
  const [enrollTeacherFingerprint, setEnrollTeacherFingerprint] = useState("");
  const [enrollTeacherBusy, setEnrollTeacherBusy] = useState(false);
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherStatusFilter, setTeacherStatusFilter] = useState<"ALL" | "ENROLLED" | "UNENROLLED">("ALL");

  const [usbBusy, setUsbBusy] = useState(false);
  const [usbStatus, setUsbStatus] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const [mockBusy, setMockBusy] = useState(false);

  // Hikvision devices
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [discovered, setDiscovered] = useState<DiscoveredDevice[]>([]);
  const [discovering, setDiscovering] = useState(false);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [deviceBusyId, setDeviceBusyId] = useState<string | null>(null);
  const [syncTimeBusyId, setSyncTimeBusyId] = useState<string | null>(null);
  const [syncingAllTime, setSyncingAllTime] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    id: "",
    name: "",
    host: "",
    port: 80,
    username: "admin",
    password: "",
    pollIntervalSeconds: 15,
    enabled: false,
  });
  const [deviceFormOpen, setDeviceFormOpen] = useState(false);

  // Hikvision HTTP Event Listening (device push)
  const [pushOpen, setPushOpen] = useState<string | null>(null);
  const [pushConfigs, setPushConfigs] = useState<Record<string, HikHttpConfig | null>>({});
  const [pushBusyId, setPushBusyId] = useState<string | null>(null);

  // Unmatched fingerprints & Auto-matcher
  const [unmatched, setUnmatched] = useState<UnmatchedFingerprint[]>([]);
  const [unmatchedLoading, setUnmatchedLoading] = useState(false);
  const [assignFor, setAssignFor] = useState<Record<string, string>>({});
  const [assignBusyFp, setAssignBusyFp] = useState<string | null>(null);
  const [autoSuggestions, setAutoSuggestions] = useState<AutoMatchSuggestion[]>([]);
  const [autoMatchBusy, setAutoMatchBusy] = useState(false);

  // Daily scan windows (Talabat and Faculty independent role timer)
  const [scanWindow, setScanWindow] = useState<any>(null);
  const [facultyScanWindow, setFacultyScanWindow] = useState<any>(null);

  // Talabat directory search & filters
  const [studentSearch, setStudentSearch] = useState("");
  const [studentGradeFilter, setStudentGradeFilter] = useState("ALL");
  const [studentStatusFilter, setStudentStatusFilter] = useState<"ALL" | "ENROLLED" | "UNENROLLED">("ALL");

  // Today's records filter & bifurcated events
  const [recordRoleFilter, setRecordRoleFilter] = useState<"ALL" | "STUDENT" | "TEACHER">("ALL");
  const [recordSearch, setRecordSearch] = useState("");
  const [recordStatusFilter, setRecordStatusFilter] = useState("ALL");
  const [recordMethodFilter, setRecordMethodFilter] = useState("ALL");
  const [recordGradeFilter, setRecordGradeFilter] = useState("ALL");
  const [selectedEventTab, setSelectedEventTab] = useState<string>("ALL");
  const [eventWindows, setEventWindows] = useState<any[]>([]);
  const [selectedAuditRecord, setSelectedAuditRecord] = useState<any>(null);
  const [networkInfo, setNetworkInfo] = useState<{ lanIp: string; port: number; webhookUrl: string } | null>(null);

  // All-days stacked storage (persistent history + local stacked cache)
  const [historyFrom, setHistoryFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 13);
    return d.toISOString().slice(0, 10);
  });
  const [historyTo, setHistoryTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [historyDays, setHistoryDays] = useState<any[]>([]);
  const [historyTotals, setHistoryTotals] = useState<any>(null);
  const [historyEvents, setHistoryEvents] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [stackedCacheCount, setStackedCacheCount] = useState(0);

  const today = useMemo(() => {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/biometric/status");
      const json = await res.json();
      if (json.success) setStatus(json.data);
    } catch {
      // silent
    }
  }, []);

  const refreshStudents = useCallback(async () => {
    try {
      const res = await fetch("/api/biometric/students");
      const json = await res.json();
      if (json.success) setStudents(json.data);
    } catch {
      // silent
    }
  }, []);

  const refreshTeachers = useCallback(async () => {
    try {
      const res = await fetch("/api/biometric/teachers");
      const json = await res.json();
      if (json.success) setTeachers(json.data);
    } catch {
      // silent
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/biometric/events");
      const json = await res.json();
      if (json.success) setEvents(json.data);
    } catch {
      // silent
    }
  }, []);

  const refreshToday = useCallback(async (eventOverride?: string) => {
    try {
      const activeEvent = eventOverride !== undefined ? eventOverride : selectedEventTab;
      const eventParam = activeEvent && activeEvent !== "ALL" ? `&eventId=${encodeURIComponent(activeEvent)}` : "";
      const res = await fetch(`/api/biometric/records/today?date=${today}${eventParam}`);
      const json = await res.json();
      if (json.success && json.data) {
        setTodayRecords(json.data.all || []);
        if (json.data.windows || json.data.eventSummaries) {
          setEventWindows(json.data.windows || json.data.eventSummaries || []);
        }
      } else {
        const fallbackRes = await fetch(`/api/attendance?date=${today}`);
        const fallbackJson = await fallbackRes.json();
        if (fallbackJson.success) {
          setTodayRecords(
            fallbackJson.data.filter((r: any) => r.verificationMethod === "BIOMETRIC"),
          );
        }
      }
    } catch {
      // silent
    }
  }, [today, selectedEventTab]);

  const handleSelectEventTab = (eventId: string) => {
    setSelectedEventTab(eventId);
    refreshToday(eventId);
  };

  // All-days stacked history (DB storage) + local stacked cache count
  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ from: historyFrom, to: historyTo, limit: "500" });
      if (selectedEventTab !== "ALL") params.set("eventId", selectedEventTab);
      const res = await fetch(`/api/biometric/records/history?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setHistoryDays(json.data.days || []);
        setHistoryTotals(json.data.totals || null);
        setHistoryEvents(json.data.eventTotals || []);
        if (json.data.windows?.length) setEventWindows(json.data.windows);
      }
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
    try {
      let stacked = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i) || "";
        if (k.startsWith("biometric-stack-")) {
          try {
            const arr = JSON.parse(localStorage.getItem(k) || "[]");
            if (Array.isArray(arr)) stacked += arr.length;
          } catch {}
        }
      }
      setStackedCacheCount(stacked);
    } catch {}
  }, [historyFrom, historyTo, selectedEventTab]);

  const refreshDevices = useCallback(async () => {
    setDevicesLoading(true);
    try {
      const res = await fetch("/api/biometric/devices");
      const json = await res.json();
      if (json.success) setDevices(json.data);
    } catch {
      // silent
    } finally {
      setDevicesLoading(false);
    }
  }, []);

  const refreshWindow = useCallback(async () => {
    try {
      const res = await fetch("/api/biometric/window");
      const json = await res.json();
      if (json.success) {
        setScanWindow(json.student || json.data);
        if (json.faculty) setFacultyScanWindow(json.faculty);
      }
    } catch {
      // silent
    }
  }, []);

  const refreshUnmatched = useCallback(async () => {
    setUnmatchedLoading(true);
    try {
      const res = await fetch("/api/biometric/unmatched");
      const json = await res.json();
      if (json.success) setUnmatched(json.data);
    } catch {
      // silent
    } finally {
      setUnmatchedLoading(false);
    }
  }, []);

  const runAutoMatch = useCallback(async () => {
    setAutoMatchBusy(true);
    try {
      const res = await fetch("/api/biometric/auto-match", { method: "POST" });
      const json = await res.json();
      if (json.success) setAutoSuggestions(json.data);
    } catch {
      // silent
    } finally {
      setAutoMatchBusy(false);
    }
  }, []);

  const fetchNetworkInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/biometric/network-info");
      const json = await res.json();
      if (json.success) setNetworkInfo(json.data);
    } catch {
      // silent
    }
  }, []);

  const refreshAll = useCallback(() => {
    refreshStatus();
    refreshStudents();
    refreshTeachers();
    refreshEvents();
    refreshToday();
    refreshDevices();
    refreshUnmatched();
    refreshWindow();
    fetchNetworkInfo();
    refreshHistory();
  }, [refreshStatus, refreshStudents, refreshTeachers, refreshEvents, refreshToday, refreshDevices, refreshUnmatched, refreshWindow, fetchNetworkInfo, refreshHistory]);

  const handleFetchMembers = async (deviceId?: string) => {
    setFetchingMembers(true);
    try {
      const url = deviceId ? `/api/biometric/devices/${deviceId}/fetch-members` : "/api/biometric/fetch-all-members";
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setMembersReport(json.data);
        setMembersModalOpen(true);
        toast({
          title: "Terminal Members Synchronized",
          description: json.message,
          variant: "success",
        });
        refreshStudents();
        refreshTeachers();
        refreshStatus();
      } else {
        toast({
          title: "Member Fetch Failed",
          description: json.error || "Failed to fetch members from terminal",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Could not connect to biometric terminal",
        variant: "destructive",
      });
    } finally {
      setFetchingMembers(false);
    }
  };

  // Clear realtime feed events manually (all or role-specific)
  const handleClearFeed = async (role?: "STUDENT" | "TEACHER") => {
    setClearingFeed(true);
    if (role === "TEACHER") {
      setEvents((prev) => prev.filter((p) => p.role !== "TEACHER" && !p.teacher));
    } else if (role === "STUDENT") {
      setEvents((prev) => prev.filter((p) => p.role !== "STUDENT" && !p.student));
    } else {
      setEvents([]);
    }
    try {
      await fetch("/api/biometric/events/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(role ? { role } : {}),
      });
      toast({
        title: role === "TEACHER" ? "Faculty Feed Cleared" : role === "STUDENT" ? "Talabat Feed Cleared" : "Real-time Feed Cleared",
        description: role === "TEACHER" ? "Buffered faculty scans cleared from live feed." : "All buffered real-time scans have been cleared.",
        variant: "default",
      });
    } catch {
      // client-side state already cleared
    } finally {
      setClearingFeed(false);
    }
  };

  // Clear feed and stay on Terminals (scans remain in Daily Attendance storage)
  const handleClearFeedAndOpenRecords = async () => {
    setClearingFeed(true);
    setEvents([]);
    try {
      await fetch("/api/biometric/events/clear", { method: "POST" });
      toast({
        title: "Live Feed Cleared & Saved in Daily Attendance",
        description: "All scans remain recorded in Daily Attendance.",
        variant: "success",
      });
      refreshToday();
      setActiveTab("terminals");
    } catch {
      setActiveTab("terminals");
    } finally {
      setClearingFeed(false);
    }
  };

  // Initial load
  useEffect(() => {
    Promise.all([
      refreshStatus(),
      refreshStudents(),
      refreshTeachers(),
      refreshEvents(),
      refreshToday(),
      refreshDevices(),
      refreshUnmatched(),
      refreshWindow(),
      fetchNetworkInfo(),
    ]).finally(() => setLoading(false));
  }, [refreshStatus, refreshStudents, refreshTeachers, refreshEvents, refreshToday, refreshDevices, refreshUnmatched, refreshWindow, fetchNetworkInfo]);

  // Poll status
  useEffect(() => {
    const t = setInterval(refreshStatus, 8_000);
    return () => clearInterval(t);
  }, [refreshStatus]);

  // Live SSE feed
  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connectSse = () => {
      es = new EventSource("/api/biometric/events/stream");
      es.onopen = () => setLiveConnected(true);
      es.onerror = () => {
        setLiveConnected(false);
        try {
          es?.close();
        } catch {}
        if (!retryTimer) {
          retryTimer = setTimeout(() => {
            retryTimer = null;
            connectSse();
          }, 3000);
        }
      };
      es.onmessage = (e) => {
        try {
          const ev = JSON.parse(e.data) as BiometricEvent;
          if (ev.message === "EVENTS_CLEARED") {
            setEvents([]);
            return;
          }
          if (ev.message === "TEACHER_EVENTS_CLEARED") {
            setEvents((prev) => prev.filter((p) => p.role !== "TEACHER" && !p.teacher));
            return;
          }
          if (ev.message === "STUDENT_EVENTS_CLEARED") {
            setEvents((prev) => prev.filter((p) => p.role !== "STUDENT" && !p.student));
            return;
          }
          setEvents((prev) => {
            const filtered = prev.filter((p) => p.id !== ev.id);
            return [ev, ...filtered].slice(0, 200);
          });

          // Stack every scan into persistent local storage, keyed by IST day.
          // This keeps an all-days stacked copy even after the live feed is cleared.
          try {
            const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ev.timestamp));
            const storageKey = `biometric-stack-${dayKey}`;
            const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
            if (Array.isArray(existing) && !existing.some((s: any) => s.id === ev.id)) {
              existing.unshift({
                id: ev.id,
                timestamp: ev.timestamp,
                type: ev.type,
                role: ev.role,
                name: ev.teacher?.name || ev.student?.name || null,
                eventName: (ev as any).scanWindow?.name || null,
                verifyMode: (ev as any).verifyMode || null,
              });
              localStorage.setItem(storageKey, JSON.stringify(existing.slice(0, 500)));
              setStackedCacheCount((c) => c + 1);
            }
          } catch {}

          // Trigger Audio Chimes
          if (soundEnabled) {
            if (ev.type === "MATCHED" || ev.type === "DUPLICATE") {
              const isLate = ev.classes?.some((c) => c.status === "LATE");
              playAudioChime(isLate ? "LATE" : "PRESENT");
            } else if (ev.type === "UNKNOWN") {
              playAudioChime("UNKNOWN");
            }
          }

          // Visual feedback
          const displayName = ev.teacher?.name || ev.student?.name || ev.message || ev.type;
          toast({
            title: `Biometric Scan: ${displayName}`,
            description: ev.type === "MATCHED" ? "Verified & Marked Present" : ev.type === "DUPLICATE" ? "Verified (Already Recorded)" : ev.message || "Scan processed",
            variant: ev.type === "MATCHED" || ev.type === "DUPLICATE" ? "success" : ev.type === "UNKNOWN" ? "warning" : "default",
          });

          refreshStatus();
          refreshToday();
          if (ev.type === "UNKNOWN") {
            refreshUnmatched();
          }
        } catch {
          // ignore heartbeats
        }
      };
    };

    connectSse();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (es) es.close();
    };
  }, [soundEnabled, refreshStatus, refreshToday, refreshUnmatched]);

  // Instant on-demand fetch of scans from Hikvision terminal (specific or all)
  const handleFetchDeviceScans = useCallback(async (deviceId?: string) => {
    setFetchingScans(true);
    try {
      const url = deviceId ? `/api/biometric/devices/${deviceId}/sync-now` : "/api/biometric/sync-all-now";
      const res = await fetch(url, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Scans Synchronized",
          description: json.message || `Pulled ${json.data?.totalFetched ?? json.data?.scansFetched ?? 0} scans into attendance.`,
          variant: "success",
        });
        refreshEvents();
        refreshToday();
        refreshStatus();
        refreshDevices();
      } else {
        toast({
          title: "Fetch Failed",
          description: json.error || "Failed to pull scan records from terminal",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      toast({
        title: "Connection Error",
        description: err?.message || "Failed to reach device",
        variant: "destructive",
      });
    } finally {
      setFetchingScans(false);
    }
  }, [refreshEvents, refreshToday, refreshStatus, refreshDevices]);

  // Download complete daily attendance Excel workbook (.xlsx)
  const handleDownloadExcel = useCallback(async (dateStr?: string) => {
    setExportingExcel(true);
    try {
      const query = dateStr ? `?date=${dateStr}` : `?date=${today}`;
      const res = await fetch(`/api/biometric/excel-report${query}`);
      if (!res.ok) throw new Error("Failed to generate Excel report");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Darse-Burhani-Daily-Attendance-${dateStr || today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast({
        title: "Daily Excel Downloaded",
        description: "Generated multi-sheet report with Information & Summary, Talabat, and Teacher tabs.",
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Export Error",
        description: err?.message || "Could not generate Excel spreadsheet",
        variant: "destructive",
      });
    } finally {
      setExportingExcel(false);
    }
  }, [today]);

  // Clean deduplicated feed: only display scans from today in IST, deduplicating repetitive scans
  const displayedEvents = useMemo(() => {
    const todayIST = today; // "YYYY-MM-DD"
    const todaysEvents = events.filter((ev) => {
      try {
        const evDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ev.timestamp));
        return evDate === todayIST;
      } catch {
        return true;
      }
    });

    if (!dedupeFeed) return todaysEvents;

    const seen = new Map<string, { event: BiometricEvent; count: number }>();

    for (const ev of todaysEvents) {
      const key = ev.student?.studentId
        ? `student:${ev.student.studentId}`
        : ev.teacher?.employeeId
          ? `teacher:${ev.teacher.employeeId}`
          : ev.fingerprint
            ? `fp:${ev.fingerprint}`
            : ev.id;

      const existing = seen.get(key);
      if (!existing) {
        seen.set(key, { event: ev, count: 1 });
      } else {
        existing.count++;
        // If the newer event has richer info or is MATCHED, preserve it
        if (ev.type === "MATCHED") {
          existing.event = { ...ev, scanCount: existing.count };
        } else {
          existing.event = { ...existing.event, scanCount: existing.count };
        }
      }
    }

    return Array.from(seen.values()).map(({ event, count }) => ({
      ...event,
      scanCount: Math.max(count, event.scanCount || 1),
    }));
  }, [events, dedupeFeed, today]);

  const feedCounts = useMemo(() => {
    let students = 0;
    let teachers = 0;
    let unrecognized = 0;
    for (const e of displayedEvents) {
      if (e.type === "UNKNOWN") unrecognized++;
      else if (e.role === "TEACHER" || Boolean(e.teacher)) teachers++;
      else students++;
    }
    return { all: displayedEvents.length, students, teachers, unrecognized };
  }, [displayedEvents]);

  const filteredFeedEvents = useMemo(() => {
    if (feedRoleFilter === "STUDENTS") {
      return displayedEvents.filter((e) => (e.role === "STUDENT" || Boolean(e.student)) && e.type !== "UNKNOWN");
    }
    if (feedRoleFilter === "TEACHERS") {
      return displayedEvents.filter((e) => (e.role === "TEACHER" || Boolean(e.teacher)) && e.type !== "UNKNOWN");
    }
    if (feedRoleFilter === "UNRECOGNIZED") {
      return displayedEvents.filter((e) => e.type === "UNKNOWN");
    }
    return displayedEvents;
  }, [displayedEvents, feedRoleFilter]);

  const enrolledStudents = useMemo(
    () => students.filter((s) => s.enrolled && s.active),
    [students],
  );
  const allActiveStudents = useMemo(() => students.filter((s) => s.active), [students]);

  const enrolledTeachers = useMemo(
    () => teachers.filter((t) => t.enrolled && t.active),
    [teachers],
  );
  const allActiveTeachers = useMemo(() => teachers.filter((t) => t.active), [teachers]);

  // Calculate high level KPI metrics
  const statsMetrics = useMemo(() => {
    const totalScans = todayRecords.length;
    const talabatRecords = todayRecords.filter((r) => {
      const role = r.role || (r.studentId ? "STUDENT" : "");
      return role === "STUDENT" || (!r.teacherId && r.studentId);
    });
    const facultyRecords = todayRecords.filter((r) => {
      const role = r.role || "";
      return role === "FACULTY" || role === "TEACHER" || !!r.teacherId;
    });

    const talabatScans = talabatRecords.length;
    const facultyScans = facultyRecords.length;

    const talabatPresent = talabatRecords.filter((r) => r.status === "PRESENT").length;
    const talabatLate = talabatRecords.filter((r) => r.status === "LATE").length;

    const facultyPresent = facultyRecords.filter((r) => r.status === "PRESENT").length;
    const facultyLate = facultyRecords.filter((r) => r.status === "LATE").length;

    const presentCount = todayRecords.filter((r) => r.status === "PRESENT").length;
    const lateCount = todayRecords.filter((r) => r.status === "LATE").length;
    const onTimeRate = totalScans > 0 ? Math.round((presentCount / totalScans) * 100) : 100;
    const enrolledTotal = enrolledStudents.length;
    const totalStudents = allActiveStudents.length;
    const enrolledTeachersTotal = enrolledTeachers.length;
    const totalTeachers = allActiveTeachers.length;
    const onlineDevices = devices.filter((d) => d.status === "ONLINE").length;

    return {
      totalScans,
      talabatScans,
      facultyScans,
      talabatPresent,
      talabatLate,
      facultyPresent,
      facultyLate,
      presentCount,
      lateCount,
      onTimeRate,
      enrolledTotal,
      totalStudents,
      enrolledTeachersTotal,
      totalTeachers,
      onlineDevices,
      totalDevices: devices.length,
    };
  }, [todayRecords, enrolledStudents, allActiveStudents, enrolledTeachers, allActiveTeachers, devices]);

  // Filtered Talabat Directory
  const filteredStudents = useMemo(() => {
    return allActiveStudents.filter((s) => {
      const q = studentSearch.toLowerCase().trim();
      const matchQuery =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.studentId.toLowerCase().includes(q) ||
        (s.fingerprint && s.fingerprint.toLowerCase().includes(q));

      const matchGrade = studentGradeFilter === "ALL" || s.grade === studentGradeFilter;

      const matchStatus =
        studentStatusFilter === "ALL" ||
        (studentStatusFilter === "ENROLLED" && s.enrolled) ||
        (studentStatusFilter === "UNENROLLED" && !s.enrolled);

      return matchQuery && matchGrade && matchStatus;
    });
  }, [allActiveStudents, studentSearch, studentGradeFilter, studentStatusFilter]);

  // Filtered Faculty Directory
  const filteredTeachers = useMemo(() => {
    return allActiveTeachers.filter((t) => {
      const q = teacherSearch.toLowerCase().trim();
      const matchQuery =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.employeeId.toLowerCase().includes(q) ||
        (t.department && t.department.toLowerCase().includes(q)) ||
        (t.fingerprint && t.fingerprint.toLowerCase().includes(q));

      const matchStatus =
        teacherStatusFilter === "ALL" ||
        (teacherStatusFilter === "ENROLLED" && t.enrolled) ||
        (teacherStatusFilter === "UNENROLLED" && !t.enrolled);

      return matchQuery && matchStatus;
    });
  }, [allActiveTeachers, teacherSearch, teacherStatusFilter]);

  // Filtered Today's Records (Combined Talabat + Teachers)
  const filteredTodayRecords = useMemo(() => {
    return todayRecords.filter((r) => {
      const q = recordSearch.toLowerCase().trim();
      const name = String(r.name || r.student?.user ? `${r.student?.user?.firstName || ""} ${r.student?.user?.lastName || ""}` : r.personId || "").toLowerCase();
      const personId = String(r.personId || r.student?.studentId || "").toLowerCase();
      const details = String(r.details || r.class?.name || "").toLowerCase();

      const matchQuery = !q || name.includes(q) || personId.includes(q) || details.includes(q);

      const role = r.role || (r.studentId ? "STUDENT" : "STUDENT");
      const matchRole = recordRoleFilter === "ALL" || role === recordRoleFilter;

      const matchStatus = recordStatusFilter === "ALL" || r.status === recordStatusFilter;
      const method = String(r.biometricMethod || r.verificationMethod || "").toUpperCase();
      const matchMethod = recordMethodFilter === "ALL" || method.includes(recordMethodFilter);
      const grade = r.grade || r.student?.grade || r.class?.grade;
      const matchGrade = recordGradeFilter === "ALL" || grade === recordGradeFilter;

      return matchQuery && matchRole && matchStatus && matchMethod && matchGrade;
    });
  }, [todayRecords, recordSearch, recordRoleFilter, recordStatusFilter, recordMethodFilter, recordGradeFilter]);

  // Precision Attendance Calculations
  const precisionMetrics = useMemo(() => {
    const total = todayRecords.length;
    const present = todayRecords.filter((r) => r.status === "PRESENT").length;
    const late = todayRecords.filter((r) => r.status === "LATE").length;
    const rate = total > 0 ? ((present / total) * 100).toFixed(1) : "100.0";

    const timestamps = todayRecords
      .map((r) => (r.checkInTime ? new Date(r.checkInTime).getTime() : 0))
      .filter((t) => t > 0);

    let avgTimeStr = "—";
    if (timestamps.length > 0) {
      const avgMs = timestamps.reduce((a, b) => a + b, 0) / timestamps.length;
      avgTimeStr = new Date(avgMs).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    }

    return { total, present, late, rate, avgTimeStr };
  }, [todayRecords]);

  // Simulator
  const simulate = async () => {
    if (simRole === "TEACHER") {
      if (!simTeacherId && !simFingerprint.trim()) {
        toast({ title: "Select a teacher or enter a test ID", variant: "warning" });
        return;
      }
      const t = teachers.find((th) => th.id === simTeacherId);
      const fp = simFingerprint.trim() || t?.fingerprint || t?.employeeId || simTeacherId;
      setSimBusy(true);
      try {
        const res = await fetch("/api/biometric/simulate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fingerprint: fp,
            timestamp: simTimestamp ? new Date(simTimestamp).toISOString() : undefined,
            verifyMode: simVerifyMode || undefined,
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast({ title: "Faculty scan processed successfully", variant: "success" });
          setEvents((prev) =>
            prev.some((p) => p.id === json.data.id) ? prev : [json.data, ...prev].slice(0, 200),
          );
          refreshStatus();
          refreshToday();
        } else {
          toast({ title: json.error || "Simulation failed", variant: "destructive" });
        }
      } catch {
        toast({ title: "Simulation failed", variant: "destructive" });
      } finally {
        setSimBusy(false);
      }
      return;
    }

    if (!simStudentId && !simFingerprint.trim()) {
      toast({
        title: "Select a talabat or enter a test ID",
        variant: "warning",
      });
      return;
    }
    setSimBusy(true);
    try {
      const res = await fetch("/api/biometric/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: simStudentId || undefined,
          fingerprint: simFingerprint.trim() || undefined,
          timestamp: simTimestamp ? new Date(simTimestamp).toISOString() : undefined,
          verifyMode: simVerifyMode || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Scan processed successfully", variant: "success" });
        setEvents((prev) =>
          prev.some((p) => p.id === json.data.id) ? prev : [json.data, ...prev].slice(0, 200),
        );
        refreshStatus();
        refreshToday();
      } else {
        toast({ title: json.error || "Simulation failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Simulation failed", variant: "destructive" });
    } finally {
      setSimBusy(false);
    }
  };

  const generateFingerprint = () => {
    setEnrollFingerprint(
      `fp-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`,
    );
  };

  const generateTeacherFingerprint = () => {
    setEnrollTeacherFingerprint(
      `fp-tchr-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-6)}`,
    );
  };

  const enrollTeacher = async (clear: boolean, customTeacherId?: string, customFp?: string) => {
    const targetTeacherId = customTeacherId || enrollTeacherId;
    const targetFp = customFp !== undefined ? customFp : enrollTeacherFingerprint;

    if (!targetTeacherId) {
      toast({ title: "Select a teacher first", variant: "warning" });
      return;
    }
    if (!clear && !targetFp.trim()) {
      toast({ title: "Enter or generate an ID/card number", variant: "warning" });
      return;
    }
    setEnrollTeacherBusy(true);
    try {
      const res = await fetch("/api/biometric/teachers/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: targetTeacherId,
          fingerprint: clear ? null : targetFp.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: clear ? "Faculty Biometric ID Cleared" : "Faculty Biometric Enrolled",
          variant: "success",
        });
        if (!customTeacherId) setEnrollTeacherFingerprint("");
        refreshTeachers();
        refreshStatus();
      } else {
        toast({ title: json.error || "Enrollment failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Enrollment failed", variant: "destructive" });
    } finally {
      setEnrollTeacherBusy(false);
    }
  };

  const enroll = async (clear: boolean, customStudentId?: string, customFp?: string) => {
    const targetStudentId = customStudentId || enrollStudentId;
    const targetFp = customFp !== undefined ? customFp : enrollFingerprint;

    if (!targetStudentId) {
      toast({ title: "Select a talabat first", variant: "warning" });
      return;
    }
    if (!clear && !targetFp.trim()) {
      toast({ title: "Enter or generate a fingerprint", variant: "warning" });
      return;
    }
    setEnrollBusy(true);
    try {
      const res = await fetch("/api/biometric/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: targetStudentId,
          fingerprint: clear ? null : targetFp.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: clear ? "Biometric ID cleared" : "Biometric ID enrolled",
          variant: "success",
        });
        if (!customStudentId) {
          setEnrollFingerprint("");
        }
        refreshStudents();
        refreshStatus();
      } else {
        toast({ title: json.error || "Enrollment failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Enrollment failed", variant: "destructive" });
    } finally {
      setEnrollBusy(false);
    }
  };

  // Bridge USB Reader Enrollment
  const bridgeUrl = () => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname || "127.0.0.1";
    return `${proto}//${host}:8080`;
  };

  const cancelUsbScan = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ command: "CANCEL" }));
    }
    setUsbBusy(false);
    setUsbStatus("Capture cancelled.");
  };

  const enrollWithUsb = () => {
    if (!enrollStudentId) {
      toast({ title: "Select a talabat first", variant: "warning" });
      return;
    }
    const chosen = students.find((s) => s.id === enrollStudentId);
    if (!chosen) {
      toast({ title: "Talabat not found", variant: "warning" });
      return;
    }

    setUsbBusy(true);
    setUsbStatus("Connecting to USB reader bridge…");

    try {
      const ws = new WebSocket(bridgeUrl());
      wsRef.current = ws;

      const finish = () => {
        setUsbBusy(false);
        try {
          ws.close();
        } catch {}
      };

      ws.onopen = () => {
        setUsbStatus("Connected! Place finger on the DS-K1F820-F reader…");
        ws.send(JSON.stringify({ command: "START_ENROLLMENT", fingerID: 1 }));
      };

      ws.onerror = () => {
        setUsbStatus("Cannot connect to local bridge at " + bridgeUrl() + ". Ensure bridge service is running.");
        finish();
      };

      ws.onmessage = async (event) => {
        let msg: any;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === "event" && msg.status === "SCANNING") {
          setUsbStatus(msg.message || "Scanning… place finger firmly on scanner.");
        } else if (msg.type === "event" && msg.status === "SUCCESS" && msg.templateData) {
          setUsbStatus("Template captured! Syncing with system…");
          setEnrollFingerprint(msg.templateData);

          try {
            const res = await fetch("/api/members/add-fingerprint", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                employeeNo: chosen.studentId,
                fingerData: msg.templateData,
                fingerPrintID: msg.fingerID || 1,
                deviceId: enrollDeviceId || undefined,
              }),
            });
            const json = await res.json();
            if (json.success) {
              setUsbStatus(`Enrolled ${chosen.studentId} → ${json.data.device.name} successfully!`);
              toast({ title: "Fingerprint enrolled and synced with terminal", variant: "success" });
              refreshStudents();
              refreshStatus();
            } else {
              setUsbStatus(`Local capture succeeded, but terminal rejected template: ${json.error}`);
              toast({ title: json.error || "Terminal rejected template", variant: "warning" });
            }
          } catch {
            setUsbStatus("Captured locally, but server sync failed.");
          }
          finish();
        } else if (msg.type === "event" && (msg.status === "ERROR" || msg.status === "CANCELLED")) {
          setUsbStatus(msg.message || "Capture cancelled or failed.");
          finish();
        }
      };
    } catch (err: any) {
      setUsbBusy(false);
      setUsbStatus(err?.message || "Failed to start USB scan");
    }
  };

  // Hikvision Devices Actions
  const discover = async () => {
    setDiscovering(true);
    try {
      const res = await fetch("/api/biometric/discover", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        setDiscovered(json.data);
        toast({
          title: json.data.length ? `Found ${json.data.length} device(s) on network` : "No Hikvision devices found on LAN",
          variant: json.data.length ? "success" : "default",
        });
      }
    } catch {
      toast({ title: "Discovery failed", variant: "destructive" });
    } finally {
      setDiscovering(false);
    }
  };

  const testDevice = async (id: string) => {
    setDeviceBusyId(id);
    try {
      const res = await fetch(`/api/biometric/devices/${id}/test`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast({
          title: `Connected to ${json.data.info.model || "device"} (FW ${json.data.info.firmwareVersion || "unknown"})`,
          variant: "success",
        });
        refreshDevices();
      } else {
        toast({ title: json.error || "Connection test failed", variant: "destructive" });
        refreshDevices();
      }
    } catch {
      toast({ title: "Connection test failed", variant: "destructive" });
    } finally {
      setDeviceBusyId(null);
    }
  };

  const syncDeviceTime = async (id: string) => {
    setSyncTimeBusyId(id);
    try {
      const res = await fetch(`/api/biometric/devices/${id}/sync-time`, { method: "POST" });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Device clock synchronized with Indian Standard Time (IST)", variant: "success" });
        refreshDevices();
      } else {
        toast({ title: json.error || "Time sync failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Time sync failed", variant: "destructive" });
    } finally {
      setSyncTimeBusyId(null);
    }
  };

  const syncAllDevicesTime = async () => {
    if (devices.length === 0) {
      toast({ title: "No biometric devices configured", variant: "default" });
      return;
    }
    setSyncingAllTime(true);
    let successCount = 0;
    try {
      for (const dev of devices) {
        try {
          const res = await fetch(`/api/biometric/devices/${dev.id}/sync-time`, { method: "POST" });
          const json = await res.json();
          if (json.success) successCount++;
        } catch {}
      }
      toast({
        title: `Synchronized ${successCount} of ${devices.length} device(s) to Indian Standard Time (IST)`,
        variant: "success",
      });
      refreshDevices();
    } catch {
      toast({ title: "Time synchronization encountered an error", variant: "destructive" });
    } finally {
      setSyncingAllTime(false);
    }
  };

  const toggleDevicePolling = async (d: BiometricDevice) => {
    setDeviceBusyId(d.id);
    try {
      const res = await fetch(`/api/biometric/devices/${d.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !d.enabled }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: d.enabled ? "Device polling stopped" : "Device polling started",
          variant: "success",
        });
        refreshDevices();
      }
    } catch {
      toast({ title: "Failed to toggle polling", variant: "destructive" });
    } finally {
      setDeviceBusyId(null);
    }
  };

  const saveDevice = async () => {
    if (!deviceForm.host.trim()) {
      toast({ title: "Device IP / host is required", variant: "warning" });
      return;
    }
    setDeviceBusyId(deviceForm.id || "new");
    try {
      const isEdit = Boolean(deviceForm.id);
      const url = isEdit ? `/api/biometric/devices/${deviceForm.id}` : "/api/biometric/devices";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deviceForm.name,
          host: deviceForm.host,
          port: deviceForm.port,
          username: deviceForm.username,
          password: deviceForm.password || undefined,
          pollIntervalSeconds: deviceForm.pollIntervalSeconds,
          enabled: deviceForm.enabled,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: isEdit ? "Device updated" : "Device added", variant: "success" });
        setDeviceFormOpen(false);
        refreshDevices();
      } else {
        toast({ title: json.error || "Failed to save device", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to save device", variant: "destructive" });
    } finally {
      setDeviceBusyId(null);
    }
  };

  const deleteDevice = async (d: BiometricDevice) => {
    if (!confirm(`Delete device ${d.name} (${d.host})?`)) return;
    try {
      const res = await fetch(`/api/biometric/devices/${d.id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Device removed", variant: "success" });
        refreshDevices();
      }
    } catch {
      toast({ title: "Failed to delete device", variant: "destructive" });
    }
  };

  // HTTP Push Event Configuration
  const loadPushConfig = async (d: BiometricDevice) => {
    setPushBusyId(d.id);
    try {
      const res = await fetch(`/api/hikvision/devices/${d.id}/http-listening`);
      const json = await res.json();
      if (json.success) {
        setPushConfigs((prev) => ({ ...prev, [d.id]: json.data }));
      }
    } catch {
      // silent
    } finally {
      setPushBusyId(null);
    }
  };

  const togglePushPanel = (d: BiometricDevice) => {
    if (pushOpen === d.id) {
      setPushOpen(null);
    } else {
      setPushOpen(d.id);
      if (!pushConfigs[d.id]) loadPushConfig(d);
    }
  };

  const enablePush = async (d: BiometricDevice, format: "XML" | "JSON") => {
    setPushBusyId(d.id);
    try {
      const res = await fetch(`/api/hikvision/devices/${d.id}/http-listening`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: `HTTP event push subscribed (${format})`, variant: "success" });
        loadPushConfig(d);
        refreshDevices();
      } else {
        toast({ title: json.error || "Failed to configure push", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to configure push", variant: "destructive" });
    } finally {
      setPushBusyId(null);
    }
  };

  const disablePush = async (d: BiometricDevice) => {
    setPushBusyId(d.id);
    try {
      const res = await fetch(`/api/hikvision/devices/${d.id}/http-listening`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        toast({ title: "HTTP push removed from terminal", variant: "success" });
        loadPushConfig(d);
        refreshDevices();
      }
    } catch {
      toast({ title: "Failed to disable push", variant: "destructive" });
    } finally {
      setPushBusyId(null);
    }
  };

  // Assign unmatched fingerprint
  const assignUnmatched = async (fingerprint: string, overrideStudentId?: string) => {
    const studentId = overrideStudentId || assignFor[fingerprint];
    if (!studentId) {
      toast({ title: "Pick a talabat to assign this ID to", variant: "warning" });
      return;
    }
    setAssignBusyFp(fingerprint);
    try {
      const res = await fetch("/api/biometric/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, fingerprint }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: "Biometric ID assigned to talabat", variant: "success" });
        setAssignFor((prev) => {
          const next = { ...prev };
          delete next[fingerprint];
          return next;
        });
        refreshUnmatched();
        refreshStudents();
        refreshStatus();
      } else {
        toast({ title: json.error || "Failed to assign ID", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to assign ID", variant: "destructive" });
    } finally {
      setAssignBusyFp(null);
    }
  };

  const dismissUnmatched = async (fingerprint?: string) => {
    try {
      const res = await fetch("/api/biometric/unmatched/clear", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fingerprint ? { fingerprint } : {}),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: fingerprint ? "ID dismissed" : "All unmatched IDs cleared",
          variant: "default",
        });
        setUnmatched(json.data);
      }
    } catch {
      // silent
    }
  };

  const exportReport = async (audience: "ALL" | "STUDENT" | "FACULTY" = "ALL") => {
    try {
      const res = await fetch(`/api/biometric/report?date=${today}&audience=${audience}`);
      if (!res.ok) {
        toast({ title: "Export failed", variant: "destructive" });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const aud = audience === "ALL" ? "bifurcated" : audience.toLowerCase();
      a.download = `biometric-attendance-${aud}-${today}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: audience === "ALL" ? "Bifurcated CSV downloaded (Talabat+Faculty, Name/ITS/Scan Time/Status highlighted)" : `${audience} CSV downloaded`, variant: "success" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const toggleMock = async () => {
    setMockBusy(true);
    try {
      const res = await fetch("/api/biometric/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !status?.mockEnabled }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: json.data.mockEnabled ? "Device simulator started" : "Device simulator stopped",
          variant: "default",
        });
        refreshStatus();
      }
    } catch {
      toast({ title: "Failed to toggle simulator", variant: "destructive" });
    } finally {
      setMockBusy(false);
    }
  };

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

      {/* Header Banner */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="fatimi-header-banner mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 text-white shadow-xl relative overflow-hidden"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="p-2 rounded-xl bg-white/10 backdrop-blur-md text-white border border-white/10">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-widest text-white/80">
              Darse Burhani Engine
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Biometric Attendance & Access Control
          </h1>
          <p className="text-white/80 text-sm mt-1 max-w-2xl">
            Live monitoring of hardware biometric terminals, real-time scan ingestion, and instant attendance marking.
          </p>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            loading={loading}
            className="bg-white/15 border-white/30 text-white hover:bg-white/25 hover:text-white rounded-2xl font-semibold"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" /> Sync
          </Button>
        </div>
      </motion.div>

      {/* KPI Metric Cards */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <Card className="fatimi-card rounded-2xl border border-gray-100/80 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Scans Today
              </span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <Fingerprint className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {statsMetrics.totalScans}
              </p>
              <span className="text-xs text-gray-500 font-medium">total scans</span>
            </div>

            {/* Bifurcated Talabat & Faculty Today's Scans */}
            <div className="mt-3 pt-2.5 border-t border-gray-100 grid grid-cols-2 gap-2 text-[11px]">
              <div className="bg-sky-50/80 rounded-xl p-2 border border-sky-100/90 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-sky-800 tracking-wider">Talabat</span>
                  <span className="text-xs font-extrabold text-sky-900">{statsMetrics.talabatScans}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-sky-700">
                  <span>{statsMetrics.talabatPresent} on-time</span>
                  <span>·</span>
                  <span>{statsMetrics.talabatLate} late</span>
                </div>
              </div>

              <div className="bg-purple-50/80 rounded-xl p-2 border border-purple-100/90 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-purple-800 tracking-wider">Faculty</span>
                  <span className="text-xs font-extrabold text-purple-900">{statsMetrics.facultyScans}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-purple-700">
                  <span>{statsMetrics.facultyPresent} on-time</span>
                  <span>·</span>
                  <span>{statsMetrics.facultyLate} late</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="fatimi-card rounded-2xl border border-gray-100/80 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                On-Time Punctuality
              </span>
              <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-emerald-600 tracking-tight">
                {statsMetrics.onTimeRate}%
              </p>
              <span className="text-xs text-gray-500 font-medium">arrival compliance</span>
            </div>
            <p className="text-[11px] text-teal-600 font-medium mt-3">
              {statsMetrics.onTimeRate >= 90 ? "Excellent attendance trend" : "Review late arrivals"}
            </p>
          </CardContent>
        </Card>

        <Card className="fatimi-card rounded-2xl border border-gray-100/80 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Biometric Enrollment
              </span>
              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                <KeyRound className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {statsMetrics.enrolledTotal}
              </p>
              <span className="text-xs text-gray-500 font-medium">/ {statsMetrics.totalStudents} talabat</span>
            </div>
            <div className="flex items-center justify-between mt-3 text-[11px] font-medium text-indigo-600">
              <span>{statsMetrics.enrolledTeachersTotal}/{statsMetrics.totalTeachers} faculty enrolled</span>
            </div>
          </CardContent>
        </Card>

        <Card className="fatimi-card rounded-2xl border border-gray-100/80 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Terminals Fleet
              </span>
              <div className="p-2 rounded-xl bg-sky-50 text-sky-600">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold text-gray-900 tracking-tight">
                {statsMetrics.onlineDevices}
              </p>
              <span className="text-xs text-gray-500 font-medium">/ {statsMetrics.totalDevices} online</span>
            </div>
            <div className="flex items-center justify-between mt-3 text-[11px]">
              <span className="text-sky-600 font-medium">Hikvision ISAPI</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] text-emerald-700 hover:bg-emerald-50"
                onClick={discover}
                loading={discovering}
              >
                <Radar className="w-3 h-3 mr-1" /> Discover
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1.5 bg-gray-100/80 rounded-2xl mb-8 overflow-x-auto">
        {[
          { id: "ivms", label: "iVMS Live Video & Voice Studio", icon: Zap, badge: "Live Feed" },
          { id: "terminals", label: "Terminals & Devices", icon: Server, badge: devices.length },
          { id: "talabat", label: "Talabat Enrollment", icon: KeyRound, badge: `${statsMetrics.enrolledTotal}/${statsMetrics.totalStudents}` },
          { id: "teachers", label: "Faculty / Teachers", icon: ShieldCheck, badge: `${statsMetrics.enrolledTeachersTotal}/${statsMetrics.totalTeachers}` },
          { id: "unmatched", label: "Unmatched IDs", icon: Link2, badge: unmatched.length ? unmatched.length : undefined },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                isActive
                  ? "bg-white text-emerald-800 shadow-sm ring-1 ring-emerald-600/10"
                  : "text-gray-600 hover:text-gray-900 hover:bg-white/50",
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-emerald-600" : "text-gray-500")} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                    tab.id === "ivms"
                      ? "bg-gradient-to-r from-sky-500 to-indigo-600 text-white"
                      : isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-gray-200 text-gray-600",
                  )}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB: iVMS-4200 FULL DEVICE CONTROL STUDIO */}
      {activeTab === "ivms" && (
        <div className="mb-8">
          <IvmsControlStation devices={devices} onRefreshDevices={refreshDevices} />
        </div>
      )}

      {/* TAB 2: TERMINALS & DEVICES */}
      {activeTab === "terminals" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Hikvision Terminals & Readers</h2>
              <p className="text-xs text-gray-500">
                Manage DS-K1T341CMF Face/Fingerprint terminals with automated ISAPI event polling & HTTP push.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={discover} loading={discovering} className="rounded-xl">
                <Radar className="w-4 h-4 mr-1.5" /> SADP Discovery
              </Button>
              <Button
                onClick={() => {
                  setDeviceForm({
                    id: "",
                    name: "",
                    host: "",
                    port: 80,
                    username: "admin",
                    password: "",
                    pollIntervalSeconds: 15,
                    enabled: true,
                  });
                  setDeviceFormOpen(true);
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                size="sm"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add Terminal
              </Button>
            </div>
          </div>

          {/* Server Network Info Banner */}
          {networkInfo && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 text-xs">
              <div className="flex items-center gap-2 shrink-0">
                <Webhook className="w-4 h-4 text-sky-600" />
                <span className="font-semibold text-sky-800">Server Push URL (Alarm Server)</span>
              </div>
              <code className="flex-1 bg-white border border-sky-200 rounded-lg px-3 py-1.5 font-mono text-sky-900 text-[11px] truncate">
                {networkInfo.webhookUrl}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(networkInfo.webhookUrl);
                  toast({ title: "Webhook URL copied", variant: "default" });
                }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] transition-colors"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
              <span className="text-sky-600 text-[10px] shrink-0">LAN: {networkInfo.lanIp}:{networkInfo.port}</span>
            </div>
          )}

          {/* Discovered Devices Banner */}
          {discovered.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" /> Discovered Hikvision Hardware ({discovered.length})
                </p>
                <button onClick={() => setDiscovered([])} className="text-xs text-emerald-700 hover:underline">
                  Dismiss
                </button>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {discovered.map((d) => (
                  <div
                    key={d.host || d.mac}
                    className="bg-white rounded-xl border border-emerald-100 p-3.5 flex flex-col justify-between gap-3 shadow-sm"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-900">{d.deviceName || d.model || d.host}</p>
                      <p className="text-xs text-gray-500 font-mono mt-0.5">
                        {d.host}:{d.port}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {d.model ? `Model: ${d.model}` : ""} {d.serialNo ? `· SN: ${d.serialNo}` : ""}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      onClick={() => {
                        setDeviceForm({
                          id: "",
                          name: d.deviceName || d.model || `Reader ${d.host}`,
                          host: d.host,
                          port: d.port || 80,
                          username: "admin",
                          password: "",
                          pollIntervalSeconds: 15,
                          enabled: true,
                        });
                        setDeviceFormOpen(true);
                      }}
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Configure & Connect
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add / Edit Device Form Modal */}
          {deviceFormOpen && (
            <Card className="fatimi-card rounded-2xl border-emerald-200 bg-emerald-50/20 p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">
                {deviceForm.id ? "Edit Terminal Configuration" : "Add Hikvision Terminal"}
              </h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="deviceName" className="text-xs font-semibold text-gray-700 mb-1 block">Device Name</label>
                  <input
                    type="text"
                    id="deviceName"
                    name="deviceName"
                    value={deviceForm.name}
                    onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                    placeholder="Front Gate Terminal"
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="deviceHost" className="text-xs font-semibold text-gray-700 mb-1 block">IP Address / Host *</label>
                  <input
                    type="text"
                    id="deviceHost"
                    name="deviceHost"
                    value={deviceForm.host}
                    onChange={(e) => setDeviceForm({ ...deviceForm, host: e.target.value })}
                    placeholder="192.168.1.64"
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="devicePort" className="text-xs font-semibold text-gray-700 mb-1 block">ISAPI Port</label>
                  <input
                    type="number"
                    id="devicePort"
                    name="devicePort"
                    value={deviceForm.port}
                    onChange={(e) => setDeviceForm({ ...deviceForm, port: Number(e.target.value) || 80 })}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="deviceUsername" className="text-xs font-semibold text-gray-700 mb-1 block">Username</label>
                  <input
                    type="text"
                    id="deviceUsername"
                    name="username"
                    autoComplete="username"
                    value={deviceForm.username}
                    onChange={(e) => setDeviceForm({ ...deviceForm, username: e.target.value })}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="devicePassword" className="text-xs font-semibold text-gray-700 mb-1 block">
                    ISAPI Password {deviceForm.id ? "(leave empty to keep existing)" : "*"}
                  </label>
                  <input
                    type="password"
                    id="devicePassword"
                    name="password"
                    autoComplete="current-password"
                    value={deviceForm.password}
                    onChange={(e) => setDeviceForm({ ...deviceForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="devicePollInterval" className="text-xs font-semibold text-gray-700 mb-1 block">Poll Interval (seconds)</label>
                  <input
                    type="number"
                    id="devicePollInterval"
                    name="devicePollInterval"
                    min={5}
                    value={deviceForm.pollIntervalSeconds}
                    onChange={(e) => setDeviceForm({ ...deviceForm, pollIntervalSeconds: Number(e.target.value) || 15 })}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <input
                  type="checkbox"
                  id="deviceEnabled"
                  name="deviceEnabled"
                  checked={deviceForm.enabled}
                  onChange={(e) => setDeviceForm({ ...deviceForm, enabled: e.target.checked })}
                  className="w-4 h-4 accent-emerald-600 rounded"
                />
                <label htmlFor="deviceEnabled" className="text-xs text-gray-700 font-medium">
                  Enable active polling & event ingestion immediately
                </label>
              </div>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-200">
                <Button
                  onClick={saveDevice}
                  loading={deviceBusyId === (deviceForm.id || "new")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs"
                >
                  <Save className="w-3.5 h-3.5 mr-1.5" /> {deviceForm.id ? "Save Changes" : "Save Terminal"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeviceFormOpen(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
              </div>
            </Card>
          )}

          {/* Configured Devices Grid */}
          {devicesLoading && devices.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : devices.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-3xl">
              <Server className="w-12 h-12 mx-auto text-gray-500 mb-3" />
              <p className="text-sm font-semibold text-gray-700">No Hikvision terminals configured yet.</p>
              <p className="text-xs text-gray-500 mt-1">
                Click &quot;SADP Discovery&quot; above to find devices on the network, or add a device IP manually.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {devices.map((d) => {
                const isBusy = deviceBusyId === d.id;
                const pushCfg = pushConfigs[d.id];
                return (
                  <Card key={d.id} className="fatimi-card rounded-2xl border-gray-100 shadow-sm p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm",
                          d.status === "ONLINE" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700",
                        )}>
                          <Server className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{d.name}</p>
                          <p className="text-xs text-gray-500 font-mono">
                            {d.host}:{d.port}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant={d.status === "ONLINE" ? "success" : "destructive"}
                        className="text-[10px]"
                      >
                        {d.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 rounded-xl p-3 text-gray-600">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase block">Model / FW</span>
                        <span className="font-medium text-gray-800">{d.model || "—"} {d.firmwareVersion ? `(v${d.firmwareVersion})` : ""}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase block">Serial / MAC</span>
                        <span className="font-medium text-gray-800 font-mono text-[11px]">{d.serialNo || d.mac || "—"}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase block">Last Polled</span>
                        <span className="font-medium text-gray-800">{formatRelative(d.lastPolledAt || "")}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase block">Polling Mode</span>
                        <span className="font-medium text-gray-800">{d.enabled ? `Every ${d.pollIntervalSeconds}s` : "Disabled"}</span>
                      </div>
                    </div>

                    {d.lastError && (
                      <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-xl p-2.5">
                        {d.lastError}
                      </p>
                    )}

                    {/* Action Bar */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-gray-100">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFetchDeviceScans(d.id)}
                        loading={fetchingScans}
                        className="rounded-xl text-xs h-8 bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 font-bold"
                        title="Fetch scan logs immediately from device"
                      >
                        <PlugZap className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Fetch Scans
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFetchMembers(d.id)}
                        loading={fetchingMembers}
                        className="rounded-xl text-xs h-8 bg-indigo-50 text-indigo-800 border-indigo-300 hover:bg-indigo-100 font-bold"
                        title="Fetch enrolled members/users from this device into portal"
                      >
                        <Users className="w-3.5 h-3.5 mr-1 text-indigo-600" /> Fetch Members
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => testDevice(d.id)}
                        loading={isBusy}
                        className="rounded-xl text-xs h-8"
                      >
                        <PlugZap className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Test Ping
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncDeviceTime(d.id)}
                        loading={syncTimeBusyId === d.id}
                        className="rounded-xl text-xs h-8"
                        title="Synchronize terminal clock with server time"
                      >
                        <Clock className="w-3.5 h-3.5 mr-1 text-teal-600" /> Sync Time
                      </Button>
                      <Button
                        size="sm"
                        variant={d.enabled ? "destructive" : "outline"}
                        onClick={() => toggleDevicePolling(d)}
                        loading={isBusy}
                        className="rounded-xl text-xs h-8"
                      >
                        {d.enabled ? (
                          <>
                            <Square className="w-3.5 h-3.5 mr-1" /> Stop Poll
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 mr-1" /> Start Poll
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => togglePushPanel(d)}
                        loading={pushBusyId === d.id && !pushCfg}
                        className="rounded-xl text-xs h-8"
                      >
                        <Webhook className="w-3.5 h-3.5 mr-1 text-sky-600" /> HTTP Push
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDeviceForm({
                            id: d.id,
                            name: d.name,
                            host: d.host,
                            port: d.port,
                            username: d.username,
                            password: "",
                            pollIntervalSeconds: d.pollIntervalSeconds,
                            enabled: d.enabled,
                          });
                          setDeviceFormOpen(true);
                        }}
                        className="h-8 w-8 p-0 rounded-xl"
                      >
                        <Pencil className="w-3.5 h-3.5 text-gray-500" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteDevice(d)}
                        className="h-8 w-8 p-0 rounded-xl hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-gray-500" />
                      </Button>
                    </div>

                    {/* HTTP Push Drawer */}
                    {pushOpen === d.id && (
                      <div className="pt-3 border-t border-sky-100">
                        <div className="rounded-xl bg-sky-50/70 border border-sky-200 p-3 space-y-3 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sky-800 flex items-center gap-1.5">
                              <Webhook className="w-4 h-4 text-sky-600" /> HTTP Event Listening (Alarm Server)
                            </span>
                            {pushCfg?.configured ? (
                              <Badge variant="success" className="text-[10px]">Configured</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">Not Configured</Badge>
                            )}
                          </div>
                          {pushCfg && (
                            <>
                              <div className="flex items-center gap-2">
                                <code className="text-[10px] bg-white border border-sky-200 rounded px-2 py-1 flex-1 font-mono truncate">
                                  {pushCfg.webhookUrl}
                                </code>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px]"
                                  onClick={() => {
                                    navigator.clipboard.writeText(pushCfg.webhookUrl);
                                    toast({ title: "Webhook URL copied", variant: "default" });
                                  }}
                                >
                                  <Copy className="w-3 h-3 mr-1" /> Copy
                                </Button>
                              </div>
                              <div className="flex items-center gap-2 pt-1">
                                <Button
                                  size="sm"
                                  className="h-7 text-[10px] bg-sky-600 hover:bg-sky-700 text-white"
                                  onClick={() => enablePush(d, "XML")}
                                  loading={pushBusyId === d.id}
                                >
                                  <Link2 className="w-3 h-3 mr-1" /> Subscribe XML
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-[10px]"
                                  onClick={() => enablePush(d, "JSON")}
                                  loading={pushBusyId === d.id}
                                >
                                  <Link2 className="w-3 h-3 mr-1" /> Subscribe JSON
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-[10px] text-gray-500"
                                  onClick={() => disablePush(d)}
                                  loading={pushBusyId === d.id}
                                >
                                  <Unplug className="w-3 h-3 mr-1" /> Remove
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TALABAT BIOMETRIC DIRECTORY & ENROLLMENT */}
      {activeTab === "talabat" && (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Enrollment Card */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="fatimi-card rounded-3xl border-gray-100 shadow-sm">
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-4 text-white rounded-t-3xl">
                <div className="flex items-center gap-2 font-display font-semibold text-sm">
                  <KeyRound className="w-4 h-4" />
                  Enroll Biometric Credentials
                </div>
                <p className="text-[11px] text-teal-100 mt-0.5">
                  Assign fingerprint or face ID to a talabat
                </p>
              </div>
              <CardContent className="p-5 space-y-4">
                <div>
                  <label htmlFor="enrollStudentId" className="text-xs font-semibold text-gray-700 mb-1.5 block">
                    Select Talabat
                  </label>
                  <select
                    id="enrollStudentId"
                    value={enrollStudentId}
                    onChange={(e) => setEnrollStudentId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Choose talabat…</option>
                    {allActiveStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · Grade {s.grade} · {s.studentId} {s.enrolled ? "✓ Enrolled" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="enrollFingerprint" className="text-xs font-semibold text-gray-700 mb-1.5 block">
                    Biometric Hash / Card Number / Terminal ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="enrollFingerprint"
                      value={enrollFingerprint}
                      onChange={(e) => setEnrollFingerprint(e.target.value)}
                      placeholder="Paste hash or type ID…"
                      className="flex-1 h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateFingerprint}
                      className="rounded-xl h-10 px-3"
                      title="Generate synthetic fingerprint"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                {/* USB / WebHID Reader */}
                <div className="rounded-2xl border border-dashed border-gray-200 p-3.5 bg-gray-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                      <Usb className="w-3.5 h-3.5 text-emerald-600" /> USB Optical Reader
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      WebHID / WS
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Connect an optical scanner (ZK / DigitalPersona) via USB for instant enrollment.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={enrollWithUsb}
                    loading={usbBusy}
                    className="w-full text-xs rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50 h-8"
                  >
                    <Fingerprint className="w-3.5 h-3.5 mr-1" />
                    {usbBusy ? "Place Finger on Scanner…" : "Scan from USB Device"}
                  </Button>
                  {usbStatus && (
                    <p className="text-[10px] text-emerald-700 font-medium text-center">
                      {usbStatus}
                    </p>
                  )}
                  {usbBusy && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={cancelUsbScan}
                      className="w-full text-xs text-rose-600 mt-1 h-7"
                    >
                      Cancel USB Capture
                    </Button>
                  )}
                </div>

                <div>
                  <label htmlFor="enrollDeviceId" className="text-xs font-semibold text-gray-700 mb-1.5 block">
                    Push To Hikvision Terminal (Optional)
                  </label>
                  <select
                    id="enrollDeviceId"
                    value={enrollDeviceId}
                    onChange={(e) => setEnrollDeviceId(e.target.value)}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">Don&apos;t push to terminal (Database only)</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.host})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => enroll(false)}
                    loading={enrollBusy}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 font-semibold text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Save Credentials
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => enroll(true)}
                    disabled={enrollBusy}
                    className="rounded-xl h-10 text-rose-600 hover:bg-rose-50 border-rose-200 px-3"
                    title="Clear enrolled ID"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Student Directory Table */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="fatimi-card rounded-3xl border-gray-100 shadow-sm">
              <CardHeader className="pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-sm font-bold text-gray-900">
                    Talabat Biometric Enrollment Directory ({filteredStudents.length})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="Search student…"
                        className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 w-40 sm:w-48"
                      />
                    </div>
                    <select
                      value={studentStatusFilter}
                      onChange={(e) => setStudentStatusFilter(e.target.value as any)}
                      className="px-2 py-1.5 text-xs rounded-xl border border-gray-200 bg-white"
                    >
                      <option value="ALL">All Status</option>
                      <option value="ENROLLED">Enrolled</option>
                      <option value="UNENROLLED">Missing ID</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100 max-h-[560px] overflow-y-auto">
                  {filteredStudents.map((s) => (
                    <div key={s.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0",
                          s.enrolled ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500",
                        )}>
                          <Fingerprint className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-500">
                            {s.studentId} · Grade {s.grade}{s.section ? `-${s.section}` : ""}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {s.enrolled ? (
                          <div className="text-right">
                            <Badge variant="success" className="text-[10px]">Enrolled</Badge>
                            <p className="text-[10px] font-mono text-gray-500 mt-0.5">{maskFingerprint(s.fingerprint || "")}</p>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">No ID</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEnrollStudentId(s.id);
                            setEnrollFingerprint(s.fingerprint || s.studentId);
                            toast({ title: `Selected ${s.name} for enrollment`, variant: "default" });
                          }}
                          className="h-8 px-2.5 text-xs rounded-xl"
                        >
                          <KeyRound className="w-3.5 h-3.5 mr-1" /> {s.enrolled ? "Edit" : "Enroll"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB: FACULTY & TEACHERS BIOMETRIC ENROLLMENT */}
      {activeTab === "teachers" && (
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Faculty Enrollment Card */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="fatimi-card rounded-3xl border-gray-100 shadow-sm">
              <div className="bg-gradient-to-r from-indigo-700 to-indigo-600 p-4 text-white rounded-t-3xl">
                <div className="flex items-center gap-2 font-display font-semibold text-sm">
                  <ShieldCheck className="w-4 h-4" />
                  Enroll Faculty Biometrics
                </div>
                <p className="text-[11px] text-indigo-100 mt-0.5">
                  Link face ID or fingerprint to a teacher
                </p>
              </div>
              <CardContent className="p-5 space-y-4">
                <div>
                  <label htmlFor="enrollTeacherSelect" className="text-xs font-semibold text-gray-700 mb-1.5 block">
                    Select Faculty Member
                  </label>
                  <select
                    id="enrollTeacherSelect"
                    value={enrollTeacherId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setEnrollTeacherId(id);
                      const t = teachers.find((th) => th.id === id);
                      if (t?.fingerprint) {
                        setEnrollTeacherFingerprint(t.fingerprint);
                      }
                    }}
                    className="w-full h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Choose teacher / faculty…</option>
                    {allActiveTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.employeeId} ({t.department}) {t.enrolled ? "✓ Enrolled" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="enrollTeacherFp" className="text-xs font-semibold text-gray-700 mb-1.5 block">
                    Biometric Hash / Terminal User ID / Face ID
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="enrollTeacherFp"
                      value={enrollTeacherFingerprint}
                      onChange={(e) => setEnrollTeacherFingerprint(e.target.value)}
                      placeholder="e.g. TCH-001, ITS ID, or biometric hash…"
                      className="flex-1 h-10 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateTeacherFingerprint}
                      className="rounded-xl h-10 px-3"
                      title="Generate test credential"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">
                    Enter the Employee ID or Card number configured in the Hikvision DS-K1T341 terminal.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => enrollTeacher(false)}
                    loading={enrollTeacherBusy}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 font-semibold text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" /> Save Credentials
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => enrollTeacher(true)}
                    disabled={enrollTeacherBusy}
                    className="rounded-xl h-10 text-rose-600 hover:bg-rose-50 border-rose-200 px-3"
                    title="Clear enrolled ID"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Teacher Directory Table */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="fatimi-card rounded-3xl border-gray-100 shadow-sm">
              <CardHeader className="pb-3 border-b border-gray-100">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="text-sm font-bold text-gray-900">
                    Faculty Biometric Directory ({filteredTeachers.length})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={teacherSearch}
                        onChange={(e) => setTeacherSearch(e.target.value)}
                        placeholder="Search faculty name, ID…"
                        className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-40 sm:w-48"
                      />
                    </div>
                    <select
                      value={teacherStatusFilter}
                      onChange={(e) => setTeacherStatusFilter(e.target.value as any)}
                      className="px-2 py-1.5 text-xs rounded-xl border border-gray-200 bg-white"
                    >
                      <option value="ALL">All Status</option>
                      <option value="ENROLLED">Enrolled</option>
                      <option value="UNENROLLED">Missing ID</option>
                    </select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {filteredTeachers.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <ShieldCheck className="w-10 h-10 mx-auto mb-2 text-gray-500" />
                    <p className="text-xs font-medium">No faculty members found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 max-h-[560px] overflow-y-auto">
                    {filteredTeachers.map((t) => (
                      <div key={t.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/80 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0",
                            t.enrolled ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-500",
                          )}>
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                            <p className="text-xs text-gray-500">
                              {t.employeeId} · {t.department}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {t.enrolled ? (
                            <div className="text-right">
                              <Badge variant="success" className="text-[10px] bg-emerald-100 text-emerald-800">Enrolled</Badge>
                              <p className="text-[10px] font-mono text-gray-500 mt-0.5">{maskFingerprint(t.fingerprint || "")}</p>
                            </div>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">No ID</Badge>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEnrollTeacherId(t.id);
                              setEnrollTeacherFingerprint(t.fingerprint || t.employeeId);
                              toast({ title: `Selected ${t.name} for enrollment`, variant: "default" });
                            }}
                            className="h-8 px-2.5 text-xs rounded-xl"
                          >
                            <KeyRound className="w-3.5 h-3.5 mr-1" /> {t.enrolled ? "Edit" : "Enroll"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: SCAN TIMING & ATTENDANCE SCHEDULE HUB */}
      {/* TAB 5: UNMATCHED IDS & AUTO RESOLVER */}
      {activeTab === "unmatched" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Unmatched Scans & ID Resolver</h2>
              <p className="text-xs text-gray-500">
                Identifiers captured on Hikvision terminals that have not yet been assigned to a student.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={runAutoMatch}
                loading={autoMatchBusy}
                className="rounded-xl text-xs"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600" /> Run Smart Auto-Match
              </Button>
              {unmatched.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => dismissUnmatched()}
                  className="rounded-xl text-xs text-gray-500 hover:text-rose-600"
                >
                  Dismiss All
                </Button>
              )}
            </div>
          </div>

          {/* Auto Suggestions Banner */}
          {autoSuggestions.length > 0 && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-3">
              <p className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-600" /> Smart Suggestions ({autoSuggestions.length})
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {autoSuggestions.map((sug) => (
                  <div key={sug.fingerprint} className="bg-white rounded-xl border border-indigo-100 p-3 flex items-center justify-between gap-2 shadow-sm">
                    <div>
                      <p className="text-xs font-mono font-bold text-gray-900">{sug.fingerprint}</p>
                      <p className="text-xs text-indigo-700 font-semibold">{sug.studentName}</p>
                      <p className="text-[10px] text-gray-500">Match by {sug.matchedBy} ({sug.confidence}%)</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => assignUnmatched(sug.fingerprint, sug.studentId)}
                      loading={assignBusyFp === sug.fingerprint}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-8 text-xs"
                    >
                      Assign
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unmatched List */}
          {unmatchedLoading && unmatched.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : unmatched.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-3xl">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-3" />
              <p className="text-sm font-semibold text-gray-700">All captured scans are matched to registered students!</p>
              <p className="text-xs text-gray-500 mt-1">
                Any future unrecognized employee numbers from terminals will be captured here.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {unmatched.map((u) => (
                <Card key={u.fingerprint} className="fatimi-card rounded-2xl border-amber-200 bg-amber-50/40 p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Terminal ID</span>
                      <p className="text-sm font-mono font-bold text-gray-900">{u.fingerprint}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning" className="text-[10px]">
                        Scanned {u.count}x
                      </Badge>
                      <button
                        onClick={() => dismissUnmatched(u.fingerprint)}
                        className="text-gray-500 hover:text-rose-600"
                        title="Dismiss"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-500">
                    Last scanned {formatRelative(u.lastSeen)}
                  </p>

                  <div className="flex gap-2 pt-2 border-t border-amber-100">
                    <select
                      value={assignFor[u.fingerprint] || ""}
                      onChange={(e) => setAssignFor((m) => ({ ...m, [u.fingerprint]: e.target.value }))}
                      className="flex-1 h-8 rounded-xl border border-gray-200 bg-white px-2 text-xs text-gray-900 focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="">Select talabat…</option>
                      {allActiveStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} · {s.studentId}
                        </option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      onClick={() => assignUnmatched(u.fingerprint)}
                      loading={assignBusyFp === u.fingerprint}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-8 text-xs"
                    >
                      Assign
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Live Face Scanner Modal */}
      <FaceScannerModal
        isOpen={faceModalOpen}
        onClose={() => setFaceModalOpen(false)}
        onScanSuccess={() => {
          refreshStatus();
          refreshToday();
        }}
      />

      {/* Terminal Enrolled Members Sync Modal */}
      <AnimatePresence>
        {membersModalOpen && membersReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-gray-100 space-y-4 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2 font-display font-bold text-base text-gray-900">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  Terminal Enrolled Members Synchronized
                </div>
                <button
                  onClick={() => setMembersModalOpen(false)}
                  className="p-1 rounded-lg text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {/* KPI stats */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Found on Device</span>
                  <span className="text-xl font-extrabold text-slate-900">{membersReport.totalFound ?? 0}</span>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 block">Talabat Linked</span>
                  <span className="text-xl font-extrabold text-emerald-700">{membersReport.studentsMatched ?? 0}</span>
                </div>
                <div className="p-3 bg-teal-50 border border-teal-200 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-teal-600 block">Faculty Linked</span>
                  <span className="text-xl font-extrabold text-teal-700">{membersReport.teachersMatched ?? 0}</span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl">
                  <span className="text-[10px] uppercase font-bold text-amber-600 block">Unmatched</span>
                  <span className="text-xl font-extrabold text-amber-700">{membersReport.unmatchedCount ?? 0}</span>
                </div>
              </div>

              {/* Members List */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px] max-h-[420px]">
                {(() => {
                  const membersList = membersReport.members || membersReport.devices?.flatMap((d: any) => d.members) || [];
                  if (membersList.length === 0) {
                    return (
                      <p className="text-center text-xs text-gray-500 py-8">
                        No member records returned by the terminal. Ensure users are registered on the Hikvision MinMoe terminal.
                      </p>
                    );
                  }
                  return membersList.map((m: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-gray-50/70 hover:bg-white transition-colors text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs",
                          m.matchedType === "STUDENT"
                            ? "bg-emerald-100 text-emerald-800"
                            : m.matchedType === "TEACHER"
                            ? "bg-teal-100 text-teal-800"
                            : "bg-amber-100 text-amber-800",
                        )}>
                          {m.matchedType === "STUDENT" ? "STD" : m.matchedType === "TEACHER" ? "FAC" : "DEV"}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{m.name || "Unnamed Device Member"}</span>
                            <span className="font-mono text-gray-500 bg-white px-1.5 py-0.5 rounded border border-gray-200 text-[10px]">
                              ID: {m.employeeNo}
                            </span>
                          </div>
                          {m.matchedEntityName && (
                            <p className="text-[11px] text-gray-500">
                              Matched Portal Record: <strong className="text-gray-800">{m.matchedEntityName}</strong>
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {m.matchedType !== "UNMATCHED" ? (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-300 flex items-center gap-1 font-semibold">
                            <Check className="w-3 h-3 text-emerald-600" /> Hash Linked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 font-semibold">
                            Not In Portal
                          </Badge>
                        )}
                        <Badge
                          variant={m.matchedType === "UNMATCHED" ? "warning" : "success"}
                          className="text-[10px]"
                        >
                          {m.matchedType === "STUDENT" ? "Talabat" : m.matchedType === "TEACHER" ? "Faculty" : "Device Only"}
                        </Badge>
                      </div>
                    </div>
                  ));
                })()}
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                  Enrolled IDs are synced to biometric hashes for instant scan recognition.
                </p>
                <Button
                  onClick={() => setMembersModalOpen(false)}
                  className="rounded-xl text-xs px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                >
                  Done
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
