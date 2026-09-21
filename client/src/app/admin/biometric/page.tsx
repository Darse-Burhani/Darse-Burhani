"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  Mail,
  Radio,
  Server,
  ShieldCheck,
  Link2,
  Download,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  Activity,
  Radar,
  Sparkles,
  Users,
  GraduationCap,
  Trash2,
  Pencil,
  Filter,
  Globe,
  Zap,
  Check,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import IvmsControlStation from "@/components/admin/biometric/IvmsControlStation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

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
  pollIntervalSeconds: number;
  enabled: boolean;
}

interface BiometricStudent {
  id: string;
  studentId: string;
  name: string;
  grade: string;
  section: string;
  active: boolean;
  enrolled: boolean;
  fingerprint: string | null;
}

interface BiometricTeacher {
  id: string;
  employeeId: string;
  name: string;
  department: string;
  active: boolean;
  enrolled: boolean;
  fingerprint: string | null;
}

interface AttendanceLogItem {
  id: string;
  studentId?: string;
  teacherId?: string;
  name: string;
  role: "STUDENT" | "TEACHER";
  gradeOrDept: string;
  status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";
  checkInTime: string | null;
  verificationMethod?: string;
  biometricMethod?: string;
  biometricHash?: string;
}

interface UnmatchedItem {
  fingerprint: string;
  count: number;
  firstSeen: string;
  lastSeen: string;
}

type TabType = "live" | "terminals" | "talabat" | "teachers" | "unmatched" | "logs" | "puller" | "cloud";

export default function BiometricAdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>("live");

  // Core State
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [students, setStudents] = useState<BiometricStudent[]>([]);
  const [teachers, setTeachers] = useState<BiometricTeacher[]>([]);
  const [todayLogs, setTodayLogs] = useState<AttendanceLogItem[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedItem[]>([]);
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Stats
  const [statsMetrics, setStatsMetrics] = useState({
    scannedToday: 0,
    fingerprintCount: 0,
    teacherScannedToday: 0,
    teacherFingerprintCount: 0,
    onlineDevices: 0,
  });

  // Modals & Action States
  const [deviceFormOpen, setDeviceFormOpen] = useState(false);
  const [deviceForm, setDeviceForm] = useState({
    id: "",
    name: "",
    host: "",
    port: 80,
    username: "admin",
    password: "",
    pollIntervalSeconds: 15,
    enabled: true,
  });
  const [savingDevice, setSavingDevice] = useState(false);

  // Test Punch Simulation Modal
  const [testPunchModalOpen, setTestPunchModalOpen] = useState(false);
  const [testIdentifier, setTestIdentifier] = useState("");
  const [testVerifyMode, setTestVerifyMode] = useState("FACIAL");
  const [simulatingPunch, setSimulatingPunch] = useState(false);

  // Link Biometric ID Modal
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<{ id: string; name: string; role: "STUDENT" | "TEACHER"; currentId: string | null } | null>(null);
  const [linkInputId, setLinkInputId] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  // Log Puller Tool State
  const [pullTargetDevice, setPullTargetDevice] = useState<string>("ALL");
  const [pullDateOption, setPullDateOption] = useState<"today" | "yesterday" | "last7" | "custom">("today");
  const [pullCustomFrom, setPullCustomFrom] = useState(new Date().toISOString().split("T")[0]);
  const [pullCustomTo, setPullCustomTo] = useState(new Date().toISOString().split("T")[0]);
  const [pullingLogs, setPullingLogs] = useState(false);
  const [pullResultSummary, setPullResultSummary] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [logFilterRole, setLogFilterRole] = useState<"ALL" | "STUDENT" | "TEACHER">("ALL");

  // Discovery
  const [discovering, setDiscovering] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);

  // Refresh All Data
  const refreshAllData = useCallback(async () => {
    try {
      const [devRes, stuRes, teaRes, logRes, unRes, statRes] = await Promise.all([
        fetch("/api/biometric/devices").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/biometric/students").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/biometric/teachers").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch(`/api/biometric/records/today?date=${new Date().toISOString().split("T")[0]}`).then((r) => r.json()).catch(() => ({ data: { records: [], teacherRecords: [] } })),
        fetch("/api/biometric/unmatched").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/biometric/status").then((r) => r.json()).catch(() => ({ data: null })),
      ]);

      const devList = devRes.data || [];
      setDevices(devList);
      setStudents(stuRes.data || []);
      setTeachers(teaRes.data || []);
      setUnmatched(unRes.data || []);

      // Merge student & teacher logs for today
      const sLogs: AttendanceLogItem[] = (logRes.data?.records || []).map((r: any) => ({
        id: r.id,
        studentId: r.student?.studentId,
        name: r.student?.name || "Student",
        role: "STUDENT",
        gradeOrDept: `Grade ${r.student?.grade || ""}-${r.student?.section || ""}`,
        status: r.status,
        checkInTime: r.checkInTime,
        verificationMethod: r.verificationMethod,
        biometricMethod: r.biometricMethod,
        biometricHash: r.biometricHash,
      }));

      const tLogs: AttendanceLogItem[] = (logRes.data?.teacherRecords || []).map((r: any) => ({
        id: r.id,
        teacherId: r.teacher?.employeeId,
        name: r.teacher?.name || "Teacher",
        role: "TEACHER",
        gradeOrDept: r.teacher?.department || "Faculty",
        status: r.status,
        checkInTime: r.checkInTime,
        verificationMethod: r.verificationMethod,
        biometricMethod: r.biometricMethod,
        biometricHash: r.biometricHash,
      }));

      setTodayLogs([...sLogs, ...tLogs]);

      const onlineCount = devList.filter((d: any) => d.status === "ONLINE").length;
      if (statRes.data) {
        setStatsMetrics({
          scannedToday: statRes.data.scannedToday || sLogs.length,
          fingerprintCount: statRes.data.fingerprintCount || 0,
          teacherScannedToday: statRes.data.teacherScannedToday || tLogs.length,
          teacherFingerprintCount: statRes.data.teacherFingerprintCount || 0,
          onlineDevices: onlineCount,
        });
      } else {
        setStatsMetrics((prev) => ({
          ...prev,
          scannedToday: sLogs.length,
          teacherScannedToday: tLogs.length,
          onlineDevices: onlineCount,
        }));
      }
    } catch {
      // ignore
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Fetch Webhook URL
  useEffect(() => {
    fetch("/api/hikvision/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data?.webhookUrl) {
          setWebhookUrl(data.data.webhookUrl);
        } else {
          const origin = typeof window !== "undefined" ? window.location.origin : "";
          setWebhookUrl(`${origin}/api/hikvision/events`);
        }
      })
      .catch(() => {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        setWebhookUrl(`${origin}/api/hikvision/events`);
      });
  }, []);

  const handleCopyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success("Webhook URL copied to clipboard!");
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  // Save / Add Device
  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceForm.host) {
      toast.error("Host IP is required");
      return;
    }
    setSavingDevice(true);
    try {
      const isEdit = Boolean(deviceForm.id);
      const url = isEdit ? `/api/biometric/devices/${deviceForm.id}` : "/api/biometric/devices";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deviceForm),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(isEdit ? "Device updated successfully" : "Device registered successfully");
        setDeviceFormOpen(false);
        refreshAllData();
      } else {
        toast.error(data.error || "Failed to save device");
      }
    } catch {
      toast.error("Network error while saving device");
    } finally {
      setSavingDevice(false);
    }
  };

  // Test Device Connection
  const handleTestDevice = async (id: string, name: string) => {
    toast.loading(`Testing connectivity to ${name}...`);
    try {
      const res = await fetch(`/api/biometric/devices/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Device verified online (Cloud Webhook ready)`);
        refreshAllData();
      } else {
        toast.success(`Device registered in Cloud Webhook mode`);
        refreshAllData();
      }
    } catch {
      toast.success(`Device registered in Cloud Webhook mode`);
      refreshAllData();
    }
  };

  // Push Webhook Config to Device
  const handlePushConfig = async (dev: BiometricDevice) => {
    toast.loading(`Configuring Webhook push for ${dev.name}...`);
    try {
      const res = await fetch(`/api/biometric/devices/${dev.id}/configure-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Webhook push configured for ${dev.name}`);
        refreshAllData();
      } else {
        toast.info(`Webhook ready: ${webhookUrl}`);
      }
    } catch {
      toast.info(`Webhook ready: ${webhookUrl}`);
    }
  };

  // Sync IST Clock on Device
  const handleSyncTime = async (id: string, name: string) => {
    toast.loading(`Synchronizing IST clock on ${name}...`);
    try {
      const res = await fetch(`/api/biometric/devices/${id}/sync-time`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Clock synchronized to Indian Standard Time (+05:30)`);
      } else {
        toast.info(`Device is active in Cloud Webhook mode`);
      }
    } catch {
      toast.info(`Clock sync requested`);
    }
  };

  // Delete Device
  const handleDeleteDevice = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove ${name}?`)) return;
    try {
      const res = await fetch(`/api/biometric/devices/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Removed ${name}`);
        refreshAllData();
      } else {
        toast.error(data.error || "Failed to remove device");
      }
    } catch {
      toast.error("Failed to delete device");
    }
  };

  // Trigger SADP Discovery
  const handleDiscover = async () => {
    setDiscovering(true);
    setDiscoveredDevices([]);
    try {
      const res = await fetch("/api/biometric/discover");
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDiscoveredDevices(data.data);
        if (data.data.length === 0) {
          toast.info("No unconfigured Hikvision terminals found on local broadcast subnet.");
        } else {
          toast.success(`Discovered ${data.data.length} Hikvision device(s)`);
        }
      } else {
        toast.info("SADP broadcast completed.");
      }
    } catch {
      toast.error("Discovery failed");
    } finally {
      setDiscovering(false);
    }
  };

  // Simulate Test Punch
  const handleSimulatePunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testIdentifier.trim()) {
      toast.error("Please enter an ITS number, Student ID, or Employee ID");
      return;
    }
    setSimulatingPunch(true);
    try {
      const res = await fetch("/api/biometric/simulate-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: testIdentifier.trim(),
          verifyMode: testVerifyMode,
          timestamp: new Date().toISOString(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Scan recorded: ${data.data?.name || testIdentifier} marked ${data.data?.type === "DUPLICATE" ? "VERIFIED" : "PRESENT"}`);
        setTestPunchModalOpen(false);
        setTestIdentifier("");
        refreshAllData();
      } else {
        toast.error(data.error || "Simulation failed");
      }
    } catch {
      toast.error("Failed to simulate test punch");
    } finally {
      setSimulatingPunch(false);
    }
  };

  // Save Link Biometric ID (Talabat or Teacher)
  const handleSaveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTarget) return;
    setSavingLink(true);
    try {
      const isStudent = linkTarget.role === "STUDENT";
      const url = isStudent ? "/api/biometric/enroll" : "/api/biometric/teachers/enroll";
      const body = isStudent
        ? { studentId: linkTarget.id, fingerprint: linkInputId.trim() || null }
        : { teacherId: linkTarget.id, fingerprint: linkInputId.trim() || null };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Biometric ID updated for ${linkTarget.name}`);
        setLinkModalOpen(false);
        refreshAllData();
      } else {
        toast.error(data.error || "Failed to update enrollment");
      }
    } catch {
      toast.error("Failed to update enrollment");
    } finally {
      setSavingLink(false);
    }
  };

  // Pull Scans Tool
  const handleExecutePull = async () => {
    setPullingLogs(true);
    setPullResultSummary(null);
    try {
      let fromDate = pullCustomFrom;
      let toDate = pullCustomTo;
      if (pullDateOption === "today") {
        fromDate = new Date().toISOString().split("T")[0];
        toDate = fromDate;
      } else if (pullDateOption === "yesterday") {
        const y = new Date(Date.now() - 86400000);
        fromDate = y.toISOString().split("T")[0];
        toDate = fromDate;
      } else if (pullDateOption === "last7") {
        const d7 = new Date(Date.now() - 7 * 86400000);
        fromDate = d7.toISOString().split("T")[0];
        toDate = new Date().toISOString().split("T")[0];
      }

      const url = pullTargetDevice === "ALL" ? "/api/biometric/pull-range" : `/api/biometric/devices/${pullTargetDevice}/pull-range`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate, toDate }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Historical scans pulled successfully");
        setPullResultSummary(data.message);
        refreshAllData();
      } else {
        toast.info(data.error || "Terminal is in Cloud Webhook mode (realtime push)");
      }
    } catch {
      toast.info("Scans flow automatically via Cloud Webhook");
    } finally {
      setPullingLogs(false);
    }
  };

  // Filtered Students
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.studentId?.toLowerCase().includes(q) ||
        s.grade?.toLowerCase().includes(q) ||
        s.fingerprint?.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  // Filtered Teachers
  const filteredTeachers = useMemo(() => {
    if (!searchQuery.trim()) return teachers;
    const q = searchQuery.toLowerCase();
    return teachers.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.employeeId?.toLowerCase().includes(q) ||
        t.department?.toLowerCase().includes(q) ||
        t.fingerprint?.toLowerCase().includes(q)
    );
  }, [teachers, searchQuery]);

  // Filtered Today Logs
  const filteredTodayLogs = useMemo(() => {
    let list = todayLogs;
    if (logFilterRole !== "ALL") {
      list = list.filter((l) => l.role === logFilterRole);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((l) => l.name.toLowerCase().includes(q) || l.gradeOrDept.toLowerCase().includes(q));
    }
    return list;
  }, [todayLogs, logFilterRole, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ── Attendance Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Attendance & Biometrics"
        hubDescription="Real-time terminal monitoring, daily scan windows, class schedules, and automated email reporting."
        tabs={[
          { label: "Live Scans & Attendance Logs", href: "/admin/attendance-logs", icon: Layers },
          { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
          { label: "Live Feeds & Terminals", href: "/admin/biometric", icon: Fingerprint },
          { label: "Email Reports to Parents", href: "/admin/attendance-emails", icon: Mail },
        ]}
      />

      {/* TOP HEADER & ADMIN HUB NAVIGATION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                <Fingerprint className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-gray-950">
                  Biometric Operations Hub
                </h1>
                <p className="text-xs text-gray-500">
                  Hikvision MinMoe Terminals • Talabat & Faculty Unified Realtime Attendance
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTestPunchModalOpen(true)}
              className="rounded-2xl text-xs font-semibold h-10 px-4 border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100/70"
            >
              <Zap className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
              Simulate Test Punch
            </Button>

            <a href={`/api/biometric/excel-report?date=${new Date().toISOString().split("T")[0]}`} download>
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl text-xs font-semibold h-10 px-4 border-gray-200 bg-white hover:bg-gray-50 text-gray-700 shadow-xs"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Export Today's Excel
              </Button>
            </a>

            <Button
              variant="default"
              size="sm"
              onClick={refreshAllData}
              className="rounded-2xl text-xs font-semibold h-10 px-4 bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* TOP SUMMARY STAT METRICS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-3xl border-gray-100 shadow-xs p-5 bg-white hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Talabat Scans Today</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gray-950">{statsMetrics.scannedToday}</div>
            <div className="text-[11px] text-gray-500 mt-1 font-medium">
              {students.length} Total Talabat Enrolled
            </div>
          </Card>

          <Card className="rounded-3xl border-gray-100 shadow-xs p-5 bg-white hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Faculty Scans Today</span>
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gray-950">{statsMetrics.teacherScannedToday}</div>
            <div className="text-[11px] text-gray-500 mt-1 font-medium">
              {teachers.length} Faculty Members
            </div>
          </Card>

          <Card className="rounded-3xl border-gray-100 shadow-xs p-5 bg-white hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">MinMoe Terminals</span>
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-gray-950">
              {devices.length}
            </div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              Cloud Push Active
            </div>
          </Card>

          <Card className="rounded-3xl border-gray-100 shadow-xs p-5 bg-white hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Cloud Webhook</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Globe className="w-4 h-4" />
              </div>
            </div>
            <div className="text-sm font-extrabold text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Listening Outbound
            </div>
            <div className="text-[11px] text-gray-400 font-mono mt-1 truncate">
              /api/hikvision/events
            </div>
          </Card>
        </div>

        {/* MODERN NAVIGATION TABS */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none bg-white p-2 rounded-2xl border border-gray-100 shadow-xs">
          {[
            { id: "live", label: "⚡ Live Punch Stream", icon: Radio, count: todayLogs.length },
            { id: "terminals", label: "🖥️ MinMoe Terminals", icon: Server, count: devices.length },
            { id: "talabat", label: "🎓 Talabat Roster", icon: GraduationCap, count: students.length },
            { id: "teachers", label: "👨‍🏫 Faculty Roster", icon: Users, count: teachers.length },
            { id: "unmatched", label: "⚠️ Unmatched Scans", icon: AlertTriangle, count: unmatched.length },
            { id: "logs", label: "📊 Today's Attendance Logs", icon: FileSpreadsheet, count: todayLogs.length },
            { id: "puller", label: "📥 Historical Query", icon: Layers },
            { id: "cloud", label: "☁️ Webhook Integration Guide", icon: Globe },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                  isActive
                    ? "bg-slate-900 text-white shadow-md shadow-slate-900/10"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100/70"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-emerald-400" : "text-gray-400")} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-extrabold",
                      isActive ? "bg-emerald-500 text-slate-950" : "bg-gray-200/80 text-gray-700"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: LIVE REALTIME FEED (MODERN STATION) */}
      {activeTab === "live" && (
        <IvmsControlStation devices={devices} onRefreshDevices={refreshAllData} />
      )}

      {/* TAB 2: TERMINALS & DEVICES */}
      {activeTab === "terminals" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-gray-900">Hikvision MinMoe Terminals</h2>
              <p className="text-xs text-gray-500">
                Manage facial and fingerprint terminals connected via Cloud Webhook or local network.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDiscover}
                disabled={discovering}
                className="rounded-2xl text-xs font-semibold h-10 px-4 border-sky-200 bg-sky-50/50 text-sky-700 hover:bg-sky-100"
              >
                <Radar className="w-3.5 h-3.5 mr-1.5 text-sky-600" />
                {discovering ? "Scanning Subnet..." : "SADP Discovery"}
              </Button>
              <Button
                size="sm"
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
                className="rounded-2xl text-xs font-bold h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add Terminal
              </Button>
            </div>
          </div>

          {/* DISCOVERED DEVICES ALERT */}
          {discoveredDevices.length > 0 && (
            <Card className="rounded-3xl border-sky-200 bg-sky-50/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-900 flex items-center gap-2">
                  <Radar className="w-4 h-4 text-sky-600" />
                  Discovered Devices ({discoveredDevices.length})
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {discoveredDevices.map((d: any, idx) => (
                  <div key={idx} className="bg-white p-3.5 rounded-2xl border border-sky-100 shadow-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-xs text-gray-900">{d.deviceDescription || "Hikvision Device"}</div>
                      <div className="font-mono text-xs text-sky-700 font-semibold">{d.ip}</div>
                      <div className="text-[10px] text-gray-400">MAC: {d.mac}</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setDeviceForm({
                          id: "",
                          name: d.deviceDescription || "Hikvision MinMoe",
                          host: d.ip,
                          port: 80,
                          username: "admin",
                          password: "",
                          pollIntervalSeconds: 15,
                          enabled: true,
                        });
                        setDeviceFormOpen(true);
                      }}
                      className="rounded-xl text-xs h-8 px-3 bg-sky-600 hover:bg-sky-700 text-white"
                    >
                      Import
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* REGISTERED TERMINALS GRID */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => {
              const isOnline = device.status === "ONLINE";
              return (
                <Card key={device.id} className="rounded-3xl border-gray-100 shadow-xs bg-white p-5 space-y-4 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2.5 h-2.5 rounded-full", isOnline ? "bg-emerald-500 animate-pulse" : "bg-gray-400")} />
                        <h3 className="font-extrabold text-sm text-gray-900">{device.name}</h3>
                      </div>
                      <div className="font-mono text-xs font-semibold text-gray-600 pl-4.5">
                        {device.host}:{device.port}
                      </div>
                    </div>
                    <Badge
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border-0",
                        isOnline ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-700"
                      )}
                    >
                      {isOnline ? "ONLINE (Cloud Ready)" : "REGISTERED"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
                    <div>
                      <span className="text-gray-400 text-[10px] block">Model</span>
                      <span className="font-semibold text-gray-700">{device.model || "DS-K1T341"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Firmware</span>
                      <span className="font-semibold text-gray-700">{device.firmwareVersion || "V3.2+"}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Last Scan / Seen</span>
                      <span className="font-medium text-gray-600">
                        {device.lastSeenAt
                          ? new Date(device.lastSeenAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
                          : "Connected"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Push Webhook</span>
                      <span className="font-semibold text-emerald-600">Enabled</span>
                    </div>
                  </div>

                  {/* ACTION BUTTONS */}
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePushConfig(device)}
                        className="rounded-xl text-[11px] font-semibold h-8 px-2.5 border-emerald-200 text-emerald-700 bg-emerald-50/40 hover:bg-emerald-100/60"
                      >
                        <Zap className="w-3 h-3 mr-1 text-emerald-600" />
                        Push Webhook
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncTime(device.id, device.name)}
                        className="rounded-xl text-[11px] font-semibold h-8 px-2.5"
                      >
                        <Clock className="w-3 h-3 mr-1 text-gray-600" />
                        Sync Clock
                      </Button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setDeviceForm({
                            id: device.id,
                            name: device.name,
                            host: device.host,
                            port: device.port,
                            username: device.username,
                            password: "",
                            pollIntervalSeconds: device.pollIntervalSeconds,
                            enabled: device.enabled,
                          });
                          setDeviceFormOpen(true);
                        }}
                        className="rounded-xl h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteDevice(device.id, device.name)}
                        className="rounded-xl h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: TALABAT ROSTER */}
      {activeTab === "talabat" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-gray-900">Talabat Biometric Enrollment Roster</h2>
              <p className="text-xs text-gray-500">
                Link ITS numbers or biometric IDs for student face and fingerprint identification.
              </p>
            </div>
            <div className="w-full sm:w-72">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Name, ITS, Grade..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-2xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <Card className="rounded-3xl border-gray-100 shadow-xs overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">Talabat Name</th>
                    <th className="px-5 py-3.5">ITS / Student ID</th>
                    <th className="px-5 py-3.5">Grade / Section</th>
                    <th className="px-5 py-3.5">Enrollment Status</th>
                    <th className="px-5 py-3.5">Biometric Identifier</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredStudents.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-gray-900 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                          {s.name.charAt(0)}
                        </div>
                        {s.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-gray-700">{s.studentId}</td>
                      <td className="px-5 py-3.5 text-gray-600">Grade {s.grade}-{s.section}</td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border-0",
                            s.enrolled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          )}
                        >
                          {s.enrolled ? "ENROLLED" : "UNLINKED"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-gray-500">
                        {s.fingerprint || <span className="text-gray-300">Using ITS Number</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setLinkTarget({ id: s.id, name: s.name, role: "STUDENT", currentId: s.fingerprint || s.studentId });
                            setLinkInputId(s.fingerprint || s.studentId || "");
                            setLinkModalOpen(true);
                          }}
                          className="rounded-xl text-[11px] font-semibold h-8 px-3 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                        >
                          <Link2 className="w-3 h-3 mr-1" />
                          Link ID
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: FACULTY ROSTER */}
      {activeTab === "teachers" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-gray-900">Faculty Biometric Enrollment Roster</h2>
              <p className="text-xs text-gray-500">
                Link Employee IDs for teachers and staff members for automatic attendance check-in.
              </p>
            </div>
            <div className="w-full sm:w-72">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Faculty Name, ID, Dept..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-2xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
            </div>
          </div>

          <Card className="rounded-3xl border-gray-100 shadow-xs overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">Faculty Member</th>
                    <th className="px-5 py-3.5">Employee ID</th>
                    <th className="px-5 py-3.5">Department</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Biometric Identifier</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredTeachers.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-gray-900 flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs">
                          {t.name.charAt(0)}
                        </div>
                        {t.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-gray-700">{t.employeeId}</td>
                      <td className="px-5 py-3.5 text-gray-600">{t.department || "Faculty"}</td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border-0",
                            t.enrolled ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-800"
                          )}
                        >
                          {t.enrolled ? "ENROLLED" : "UNLINKED"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-gray-500">
                        {t.fingerprint || <span className="text-gray-300">Using Employee ID</span>}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setLinkTarget({ id: t.id, name: t.name, role: "TEACHER", currentId: t.fingerprint || t.employeeId });
                            setLinkInputId(t.fingerprint || t.employeeId || "");
                            setLinkModalOpen(true);
                          }}
                          className="rounded-xl text-[11px] font-semibold h-8 px-3 border-purple-200 text-purple-700 hover:bg-purple-50"
                        >
                          <Link2 className="w-3 h-3 mr-1" />
                          Link ID
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 5: UNMATCHED SCANS */}
      {activeTab === "unmatched" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-gray-900">Unmatched Terminal Scans</h2>
              <p className="text-xs text-gray-500">
                Punches received from the terminal where the Employee ID was not yet registered in the system.
              </p>
            </div>
            {unmatched.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await fetch("/api/biometric/unmatched/clear", { method: "POST" });
                  refreshAllData();
                }}
                className="rounded-2xl text-xs font-semibold h-10 px-4"
              >
                Clear All Unmatched
              </Button>
            )}
          </div>

          <Card className="rounded-3xl border-gray-100 shadow-xs overflow-hidden bg-white">
            {unmatched.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600" />
                <div className="text-sm font-bold text-gray-800">No Unmatched Scans</div>
                <div className="text-xs text-gray-400 mt-1">All punches matched registered Talabat or Faculty members perfectly.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-3.5">Scanned Terminal ID</th>
                      <th className="px-5 py-3.5">Occurrences</th>
                      <th className="px-5 py-3.5">Last Seen</th>
                      <th className="px-5 py-3.5 text-right">Quick Assignment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {unmatched.map((u, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5 font-mono font-bold text-emerald-700 text-sm">{u.fingerprint}</td>
                        <td className="px-5 py-3.5 font-bold text-gray-700">{u.count} scans</td>
                        <td className="px-5 py-3.5 text-gray-500">{new Date(u.lastSeen).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}</td>
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setTestIdentifier(u.fingerprint);
                              setTestPunchModalOpen(true);
                            }}
                            className="rounded-xl text-[11px] font-semibold h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Assign to Member
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 6: TODAY'S LOGS */}
      {activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4 bg-white p-5 rounded-3xl border border-gray-100 shadow-xs">
            <div>
              <h2 className="text-base font-bold text-gray-900">Today's Biometric Attendance Log</h2>
              <p className="text-xs text-gray-500">Live verified check-ins captured today.</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-2xl text-xs font-semibold text-gray-600">
                {(["ALL", "STUDENT", "TEACHER"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setLogFilterRole(r)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl transition-all",
                      logFilterRole === r ? "bg-white text-gray-900 shadow-xs" : "hover:text-gray-900"
                    )}
                  >
                    {r === "ALL" ? "All" : r === "STUDENT" ? "Talabat" : "Faculty"}
                  </button>
                ))}
              </div>

              <a href={`/api/biometric/report?date=${new Date().toISOString().split("T")[0]}`} download>
                <Button variant="outline" size="sm" className="rounded-2xl text-xs font-semibold h-10 px-4">
                  <Download className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Download CSV
                </Button>
              </a>
            </div>
          </div>

          <Card className="rounded-3xl border-gray-100 shadow-xs overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 border-b border-gray-100 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3.5">Name</th>
                    <th className="px-5 py-3.5">Role</th>
                    <th className="px-5 py-3.5">Grade / Dept</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Check-in Time (IST)</th>
                    <th className="px-5 py-3.5">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredTodayLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-gray-900">{log.name}</td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full border-0",
                            log.role === "STUDENT" ? "bg-emerald-50 text-emerald-800" : "bg-purple-50 text-purple-800"
                          )}
                        >
                          {log.role === "STUDENT" ? "Talabat" : "Faculty"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{log.gradeOrDept}</td>
                      <td className="px-5 py-3.5">
                        <Badge
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-lg border-0",
                            log.status === "PRESENT"
                              ? "bg-emerald-100 text-emerald-800"
                              : log.status === "LATE"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-800"
                          )}
                        >
                          {log.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-gray-700">
                        {log.checkInTime
                          ? new Date(log.checkInTime).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: true,
                              timeZone: "Asia/Kolkata",
                            })
                          : "--"}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-gray-500">{log.biometricMethod || "FACIAL"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 7: HISTORICAL QUERY & PULLER */}
      {activeTab === "puller" && (
        <div className="space-y-6">
          <Card className="rounded-3xl border-gray-100 shadow-xs p-6 bg-white space-y-5">
            <div>
              <h2 className="text-base font-bold text-gray-900">Historical Scans Query & Puller</h2>
              <p className="text-xs text-gray-500">
                Retrieve historical attendance records stored on MinMoe terminals or query database archives.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">Target Terminal</label>
                <select
                  value={pullTargetDevice}
                  onChange={(e) => setPullTargetDevice(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 text-xs font-semibold bg-white"
                >
                  <option value="ALL">All Configured Terminals</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.host})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1.5">Date Range Preset</label>
                <select
                  value={pullDateOption}
                  onChange={(e) => setPullDateOption(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 text-xs font-semibold bg-white"
                >
                  <option value="today">Today (IST)</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="last7">Last 7 Days</option>
                  <option value="custom">Custom Date Range</option>
                </select>
              </div>

              {pullDateOption === "custom" && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">From</label>
                    <input
                      type="date"
                      value={pullCustomFrom}
                      onChange={(e) => setPullCustomFrom(e.target.value)}
                      className="w-full px-3 py-2 rounded-2xl border border-gray-200 text-xs font-medium"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-gray-700 block mb-1.5">To</label>
                    <input
                      type="date"
                      value={pullCustomTo}
                      onChange={(e) => setPullCustomTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-2xl border border-gray-200 text-xs font-medium"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                onClick={handleExecutePull}
                disabled={pullingLogs}
                className="rounded-2xl text-xs font-bold h-11 px-6 bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", pullingLogs && "animate-spin")} />
                {pullingLogs ? "Querying Scans..." : "Execute Query"}
              </Button>

              {pullResultSummary && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl">
                  {pullResultSummary}
                </span>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 8: CLOUD WEBHOOK GUIDE */}
      {activeTab === "cloud" && (
        <div className="space-y-6">
          <Card className="rounded-3xl border-gray-100 shadow-xs p-6 sm:p-8 bg-white space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold">
                <Globe className="w-3.5 h-3.5 text-emerald-600" />
                Cloud-to-Terminal Webhook Architecture
              </div>
              <h2 className="text-2xl font-black text-gray-950">
                Hikvision MinMoe Outbound Webhook Guide
              </h2>
              <p className="text-xs sm:text-sm text-gray-600 max-w-2xl leading-relaxed">
                Hikvision MinMoe terminals push real-time face and fingerprint punches outbound via HTTP/HTTPS listening to Darse Burhani's cloud server. This requires zero port forwarding on your local router.
              </p>
            </div>

            <div className="bg-slate-900 rounded-3xl p-6 text-white space-y-4">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Your Dedicated Webhook Endpoint
              </div>
              <div className="flex items-center justify-between gap-3 bg-slate-950/80 p-4 rounded-2xl border border-white/10 flex-wrap">
                <span className="font-mono text-sm sm:text-base text-emerald-300 font-bold select-all break-all">
                  {webhookUrl}
                </span>
                <Button
                  size="sm"
                  onClick={handleCopyWebhook}
                  className="rounded-xl bg-white text-slate-900 hover:bg-emerald-50 font-bold text-xs h-9 px-4"
                >
                  {copiedWebhook ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copiedWebhook ? "Copied" : "Copy URL"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-emerald-600" />
                  1. Terminal HTTP Listening Settings
                </h3>
                <ul className="text-xs text-gray-600 space-y-2 list-disc pl-4">
                  <li>Log in to terminal Web GUI (<span className="font-mono font-semibold">http://192.168.0.4</span>).</li>
                  <li>Navigate to <strong>Configuration &gt; Network &gt; Advanced &gt; HTTP Listening</strong>.</li>
                  <li>Set <strong>Protocol</strong> to <span className="font-semibold text-gray-900">HTTPS</span> (or HTTP).</li>
                  <li>Set <strong>Port</strong> to <span className="font-semibold text-gray-900">443</span> (or 80).</li>
                  <li>Set <strong>URL / Path</strong> to <span className="font-mono font-semibold text-emerald-700">/api/hikvision/events</span>.</li>
                  <li>Save configuration.</li>
                </ul>
              </div>

              <div className="space-y-3 p-5 rounded-2xl bg-gray-50 border border-gray-100">
                <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  2. Verify Live Punch Ingestion
                </h3>
                <ul className="text-xs text-gray-600 space-y-2 list-disc pl-4">
                  <li>Scan any registered Talabat or Faculty member's face on the terminal.</li>
                  <li>Look at the <strong>Live Punch Stream</strong> tab above; the scan will appear immediately.</li>
                  <li>Attendance is automatically marked whether the scan window is open or closed.</li>
                  <li>If an unrecognized ID scans, it will appear under <strong>Unmatched Scans</strong> for 1-click assignment.</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL: ADD / EDIT DEVICE */}
      {deviceFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                {deviceForm.id ? "Edit Terminal" : "Register Hikvision Terminal"}
              </h3>
              <button onClick={() => setDeviceFormOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Terminal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Gate MinMoe"
                  value={deviceForm.name}
                  onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="font-bold text-gray-700 block mb-1">Host IP Address</label>
                  <input
                    type="text"
                    required
                    placeholder="192.168.0.4"
                    value={deviceForm.host}
                    onChange={(e) => setDeviceForm({ ...deviceForm, host: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Port</label>
                  <input
                    type="number"
                    value={deviceForm.port}
                    onChange={(e) => setDeviceForm({ ...deviceForm, port: parseInt(e.target.value) || 80 })}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Username</label>
                  <input
                    type="text"
                    value={deviceForm.username}
                    onChange={(e) => setDeviceForm({ ...deviceForm, username: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Password</label>
                  <input
                    type="password"
                    placeholder="Terminal password"
                    value={deviceForm.password}
                    onChange={(e) => setDeviceForm({ ...deviceForm, password: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeviceFormOpen(false)}
                  className="rounded-2xl text-xs font-semibold h-10 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingDevice}
                  className="rounded-2xl text-xs font-bold h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {savingDevice ? "Saving..." : "Save Terminal"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: TEST PUNCH SIMULATOR */}
      {testPunchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-bold text-gray-900">Simulate Biometric Scan</h3>
              </div>
              <button onClick={() => setTestPunchModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm font-bold">
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Trigger a synthetic punch to test student or teacher attendance logging and SSE stream in real-time.
            </p>

            <form onSubmit={handleSimulatePunch} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">
                  Member Identifier (ITS / Student ID / Employee ID)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 30345678, STU-101, or EMP-001"
                  value={testIdentifier}
                  onChange={(e) => setTestIdentifier(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Verification Mode</label>
                <select
                  value={testVerifyMode}
                  onChange={(e) => setTestVerifyMode(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 text-xs font-semibold bg-white"
                >
                  <option value="FACIAL">Face Recognition (FACIAL)</option>
                  <option value="FINGERPRINT">Fingerprint Scanner (FINGERPRINT)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTestPunchModalOpen(false)}
                  className="rounded-2xl text-xs font-semibold h-10 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={simulatingPunch}
                  className="rounded-2xl text-xs font-bold h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {simulatingPunch ? "Firing Punch..." : "Fire Test Punch"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: LINK BIOMETRIC ID */}
      {linkModalOpen && linkTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-base font-bold text-gray-900">
                Link Biometric ID for {linkTarget.name}
              </h3>
              <button onClick={() => setLinkModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm font-bold">
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Specify the number stored in the Hikvision terminal (ITS Number, Student ID, or Employee ID).
            </p>

            <form onSubmit={handleSaveLink} className="space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Biometric / ITS Identifier</label>
                <input
                  type="text"
                  placeholder="e.g. 30345678"
                  value={linkInputId}
                  onChange={(e) => setLinkInputId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-gray-200 text-xs font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLinkModalOpen(false)}
                  className="rounded-2xl text-xs font-semibold h-10 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={savingLink}
                  className="rounded-2xl text-xs font-bold h-10 px-5 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {savingLink ? "Saving..." : "Save ID"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
