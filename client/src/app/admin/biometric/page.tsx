"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Fingerprint,
  Camera,
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
  Send,
  Globe,
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

type TabType = "live" | "terminals" | "logs" | "puller" | "talabat" | "teachers" | "unmatched" | "cloud";

export default function BiometricAdminPage() {
  const [activeTab, setActiveTab] = useState<TabType>("live");

  // State
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [students, setStudents] = useState<BiometricStudent[]>([]);
  const [teachers, setTeachers] = useState<BiometricTeacher[]>([]);
  const [todayLogs, setTodayLogs] = useState<AttendanceLogItem[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedItem[]>([]);

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

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [logFilterRole, setLogFilterRole] = useState<"ALL" | "STUDENT" | "TEACHER">("ALL");

  // Discovery
  const [discovering, setDiscovering] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);

  // Refresh All Data
  const refreshAllData = useCallback(async () => {
    try {
      const [devRes, stuRes, teaRes, logRes, unRes, winRes, statRes] = await Promise.all([
        fetch("/api/biometric/devices").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/biometric/students").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/biometric/teachers").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch(`/api/biometric/records/today?date=${new Date().toISOString().split("T")[0]}`).then((r) => r.json()).catch(() => ({ data: { records: [], teacherRecords: [] } })),
        fetch("/api/biometric/unmatched").then((r) => r.json()).catch(() => ({ data: [] })),
        fetch("/api/biometric/window").then((r) => r.json()).catch(() => ({ data: null })),
        fetch("/api/biometric/status").then((r) => r.json()).catch(() => ({ data: null })),
      ]);

      const devList = devRes.data || [];
      setDevices(devList);
      setStudents(stuRes.data || []);
      setTeachers(teaRes.data || []);
      setUnmatched(unRes.data || []);
      setActiveScanWindow(winRes.data);

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
        toast.success(isEdit ? "Terminal updated" : "Terminal added successfully");
        setDeviceFormOpen(false);
        refreshAllData();
      } else {
        toast.error(data.error || "Failed to save device");
      }
    } catch (err: any) {
      toast.error(err?.message || "Device save error");
    } finally {
      setSavingDevice(false);
    }
  };

  // Delete Device
  const handleDeleteDevice = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to remove terminal "${name}"?`)) return;
    try {
      const res = await fetch(`/api/biometric/devices/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Terminal removed");
        refreshAllData();
      } else {
        toast.error(data.error || "Failed to delete terminal");
      }
    } catch (err: any) {
      toast.error(err?.message || "Delete error");
    }
  };

  // Test Device Connection
  const handleTestDevice = async (id: string) => {
    try {
      const res = await fetch(`/api/biometric/devices/${id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Terminal Online: ${data.data?.model || "Connected"} (Firmware: ${data.data?.firmwareVersion || "OK"})`);
      } else {
        toast.error(`Device unreachable: ${data.error}`);
      }
      refreshAllData();
    } catch (err: any) {
      toast.error(err?.message || "Connection test failed");
    }
  };

  // Sync Device Time (IST)
  const handleSyncTime = async (id?: string) => {
    try {
      const url = id ? `/api/biometric/devices/${id}/sync-time` : "/api/biometric/devices/bulk/sync-time";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success("Terminal clock synchronized to Indian Standard Time (+05:30)");
      } else {
        toast.error(data.error || "Failed to sync time");
      }
    } catch (err: any) {
      toast.error(err?.message || "Time sync error");
    }
  };

  // Configure Webhook Push to Cloud/Render
  const handleConfigurePush = async (id: string) => {
    try {
      const res = await fetch(`/api/biometric/devices/${id}/configure-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "JSON" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Push Webhook configured on device! (${data.message})`);
      } else {
        toast.error(data.error || "Failed to configure webhook");
      }
    } catch (err: any) {
      toast.error(err?.message || "Webhook setup error");
    }
  };

  // SADP LAN Discovery
  const handleDiscover = async () => {
    setDiscovering(true);
    try {
      const res = await fetch("/api/biometric/discover");
      const data = await res.json();
      if (data.success && data.data?.devices) {
        setDiscoveredDevices(data.data.devices);
        toast.success(`Discovered ${data.data.devices.length} Hikvision terminal(s) on LAN`);
      } else {
        toast.error(data.error || "No new terminals discovered via SADP broadcast");
      }
    } catch (err: any) {
      toast.error(err?.message || "SADP discovery error");
    } finally {
      setDiscovering(false);
    }
  };

  // Execute Range Log Pull
  const handleExecuteLogPull = async () => {
    setPullingLogs(true);
    setPullResultSummary(null);
    try {
      let fromDate = pullCustomFrom;
      let toDate = pullCustomTo;

      if (pullDateOption === "today") {
        fromDate = new Date().toISOString().split("T")[0];
        toDate = fromDate;
      } else if (pullDateOption === "yesterday") {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        fromDate = y.toISOString().split("T")[0];
        toDate = fromDate;
      } else if (pullDateOption === "last7") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        fromDate = d.toISOString().split("T")[0];
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
        toast.success(data.message);
        setPullResultSummary(data.message);
        refreshAllData();
      } else {
        toast.error(data.error || "Failed to pull logs from device");
        setPullResultSummary(`Error: ${data.error}`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Log pull error");
    } finally {
      setPullingLogs(false);
    }
  };

  // Simulate Test Punch
  const handleSimulatePunch = async () => {
    if (!testIdentifier.trim()) {
      toast.error("Please enter a Student ID, ITS, or Employee ID");
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
        toast.success(`Test Punch Success: ${data.message}`);
        setTestPunchModalOpen(false);
        setTestIdentifier("");
        refreshAllData();
      } else {
        toast.error(data.error || "Punch simulation failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Simulation error");
    } finally {
      setSimulatingPunch(false);
    }
  };

  // Link All Talabat & Faculty by ITS ID
  const handleLinkAllByIts = async () => {
    try {
      const res = await fetch("/api/biometric/link-all-by-its", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(`Linked Members: ${data.message}`);
        refreshAllData();
      } else {
        toast.error(data.error || "Failed to link members");
      }
    } catch (err: any) {
      toast.error(err?.message || "Linking error");
    }
  };

  // Deploy all members to all devices
  const handleDeployAllMembers = async () => {
    try {
      const res = await fetch("/api/biometric/deploy-all-to-all-devices", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Member deployment queued — syncing in background.");
      } else {
        toast.error(data.error || "Failed to deploy members");
      }
    } catch (err: any) {
      toast.error(err?.message || "Deployment error");
    }
  };

  // Link Biometric ID to Student / Teacher
  const handleSaveLink = async () => {
    if (!linkTarget) return;
    setSavingLink(true);
    try {
      const url = linkTarget.role === "STUDENT" ? "/api/biometric/enroll" : "/api/biometric/teachers/enroll";
      const body = linkTarget.role === "STUDENT"
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
        toast.error(data.error || "Failed to link biometric ID");
      }
    } catch (err: any) {
      toast.error(err?.message || "Link error");
    } finally {
      setSavingLink(false);
    }
  };

  // Filtered Logs
  const filteredTodayLogs = useMemo(() => {
    let list = todayLogs;
    if (logFilterRole !== "ALL") {
      list = list.filter((l) => l.role === logFilterRole);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          (l.studentId && l.studentId.toLowerCase().includes(q)) ||
          (l.teacherId && l.teacherId.toLowerCase().includes(q)) ||
          (l.biometricHash && l.biometricHash.toLowerCase().includes(q))
      );
    }
    return list;
  }, [todayLogs, logFilterRole, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Top Hub Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-xs">
          <AdminHubTabs
            hubTitle="Biometric Attendance & Terminal Studio"
            hubDescription="Live camera snapshot monitoring, ISAPI hardware log extraction, time sync, and student/faculty biometric registry."
            tabs={[
              { label: "Live Feeds & Terminals", href: "/admin/biometric", icon: Fingerprint },
              { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
              { label: "Daily Attendance Logs", href: "/admin/attendance-logs", icon: Activity },
              { label: "Email Reports", href: "/admin/attendance-emails", icon: Send },
            ]}
          />
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* Hero Section: System Health & Global Quick Actions */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
          {/* Subtle decorative background pattern */}
          <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[11px] font-bold px-2.5 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse mr-1.5" />
                  ISAPI Engine v2.4 Active
                </Badge>
                <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-[11px] font-mono">
                  IST (+05:30)
                </Badge>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
                Biometric Terminal Studio
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Automated Facial & Fingerprint attendance pipeline with real-time ISAPI push, direct hardware log retrieval, and live camera feed.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center flex-wrap gap-2.5">
              <Button
                onClick={handleLinkAllByIts}
                variant="outline"
                className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/30 rounded-xl text-xs font-semibold h-9"
              >
                <Link2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                Auto-Link All ITS Cards
              </Button>

              <Button
                onClick={handleDeployAllMembers}
                variant="outline"
                className="bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border-sky-500/30 rounded-xl text-xs font-semibold h-9"
              >
                <Users className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
                Sync Members to Devices
              </Button>

              <Button
                onClick={() => {
                  setPullDateOption("today");
                  handleExecuteLogPull();
                }}
                disabled={pullingLogs}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-emerald-900/30 h-9"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                {pullingLogs ? "Pulling..." : "Pull Today's Logs"}
              </Button>

              <Button
                onClick={() => handleSyncTime()}
                variant="outline"
                className="bg-white/10 hover:bg-white/15 text-white border-white/20 rounded-xl text-xs font-semibold h-9"
              >
                <Clock className="w-3.5 h-3.5 mr-1.5 text-sky-400" />
                Sync IST Time
              </Button>

              <Button
                onClick={() => setTestPunchModalOpen(true)}
                variant="outline"
                className="bg-white/10 hover:bg-white/15 text-white border-white/20 rounded-xl text-xs font-semibold h-9"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5 text-amber-400" />
                Test Punch
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
                className="bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold h-9"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Terminal
              </Button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10 text-slate-300">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-emerald-400 shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white leading-tight">
                  {statsMetrics.onlineDevices} / {devices.length}
                </div>
                <div className="text-[11px] text-slate-400">Terminals Online</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-sky-400 shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white leading-tight">
                  {statsMetrics.scannedToday}
                </div>
                <div className="text-[11px] text-slate-400">Talabat Present Today</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-indigo-400 shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white leading-tight">
                  {statsMetrics.teacherScannedToday}
                </div>
                <div className="text-[11px] text-slate-400">Faculty Present Today</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-amber-400 shrink-0">
                <Fingerprint className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl font-bold text-white leading-tight">
                  {students.filter((s) => s.enrolled).length} / {students.length}
                </div>
                <div className="text-[11px] text-slate-400">Biometric Enrolled</div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 p-1.5 bg-gray-100/90 rounded-2xl overflow-x-auto shadow-xs">
          {[
            { id: "live", label: "Live Camera & Studio", icon: Camera, badge: "Feed Active" },
            { id: "terminals", label: "Terminals & Hardware", icon: Server, count: devices.length },
            { id: "logs", label: "Today's Scans & Punches", icon: Activity, count: todayLogs.length },
            { id: "puller", label: "Direct Log Puller", icon: Download },
            { id: "talabat", label: "Talabat Enrollment", icon: GraduationCap, count: `${students.filter((s) => s.enrolled).length}/${students.length}` },
            { id: "teachers", label: "Faculty Enrollment", icon: ShieldCheck, count: `${teachers.filter((t) => t.enrolled).length}/${teachers.length}` },
            { id: "unmatched", label: "Unmatched IDs", icon: Link2, count: unmatched.length || undefined },
            { id: "cloud", label: "Cloud & Webhook Setup", icon: Globe },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all whitespace-nowrap",
                  isActive
                    ? "bg-white text-slate-900 shadow-xs ring-1 ring-black/5"
                    : "text-gray-600 hover:text-gray-900 hover:bg-white/40"
                )}
              >
                <Icon className={cn("w-4 h-4", isActive ? "text-emerald-600" : "text-gray-400")} />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded-md text-[10px] font-bold",
                      isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-200/80 text-gray-600"
                    )}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.badge && (
                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-sky-100 text-sky-800">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: LIVE FEED & STUDIO */}
        {activeTab === "live" && (
          <IvmsControlStation devices={devices} onRefreshDevices={refreshAllData} />
        )}

        {/* TAB 2: TERMINALS & DEVICES */}
        {activeTab === "terminals" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Hikvision MinMoe Terminals</h2>
                <p className="text-xs text-gray-500">
                  Manage network connectivity, automated polling, time sync, and push notifications for registered devices.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscover}
                  disabled={discovering}
                  className="rounded-xl text-xs"
                >
                  <Radar className="w-3.5 h-3.5 mr-1 text-sky-600" />
                  {discovering ? "Scanning..." : "SADP Discovery"}
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Terminal
                </Button>
              </div>
            </div>

            {/* Discovered devices banner */}
            {discoveredDevices.length > 0 && (
              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-sky-900 flex items-center gap-1.5">
                    <Radar className="w-4 h-4 text-sky-600" />
                    SADP Discovered Devices on LAN ({discoveredDevices.length})
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setDiscoveredDevices([])} className="h-6 text-[10px] text-sky-700">
                    Dismiss
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {discoveredDevices.map((d, i) => (
                    <div key={i} className="bg-white p-3 rounded-xl border border-sky-100 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-bold text-gray-900">{d.deviceDescription || d.deviceType || "Hikvision Terminal"}</div>
                        <div className="text-[11px] font-mono text-gray-500">{d.ipv4Address || d.ip}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setDeviceForm({
                            id: "",
                            name: d.deviceDescription || "Hikvision Terminal",
                            host: d.ipv4Address || d.ip,
                            port: d.port || 80,
                            username: "admin",
                            password: "",
                            pollIntervalSeconds: 15,
                            enabled: true,
                          });
                          setDeviceFormOpen(true);
                        }}
                        className="h-7 text-xs text-sky-700 rounded-lg"
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Device Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {devices.map((device) => {
                const isOnline = device.status === "ONLINE";
                return (
                  <Card key={device.id} className="rounded-2xl border border-gray-100 shadow-xs overflow-hidden hover:shadow-md transition-all">
                    <CardHeader className="p-4 pb-3 border-b border-gray-50 bg-gray-50/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "w-2.5 h-2.5 rounded-full",
                              isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                            )}
                          />
                          <CardTitle className="text-sm font-bold text-gray-900 truncate">
                            {device.name}
                          </CardTitle>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-bold px-2 py-0.5",
                            isOnline
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-rose-50 text-rose-700 border-rose-200"
                          )}
                        >
                          {device.status}
                        </Badge>
                      </div>
                      <CardDescription className="text-[11px] font-mono text-gray-500 mt-1">
                        http://{device.host}:{device.port} • User: {device.username}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3 text-xs text-gray-600">
                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-gray-50 p-2.5 rounded-xl font-mono">
                        <div>
                          <span className="text-gray-400 block text-[10px]">Model</span>
                          <span className="font-semibold text-gray-800 truncate block">{device.model || "DS-K1T341"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Firmware</span>
                          <span className="font-semibold text-gray-800 truncate block">{device.firmwareVersion || "v2.x ISAPI"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Serial No</span>
                          <span className="font-semibold text-gray-800 truncate block">{device.serialNo ? `${device.serialNo.slice(-8)}` : "—"}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Auto-Polling</span>
                          <span className={cn("font-semibold", device.enabled ? "text-emerald-700" : "text-gray-500")}>
                            {device.enabled ? `Every ${device.pollIntervalSeconds}s` : "Disabled"}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestDevice(device.id)}
                          className="h-8 text-[11px] rounded-xl"
                        >
                          <Activity className="w-3 h-3 mr-1 text-emerald-600" />
                          Test Ping
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncTime(device.id)}
                          className="h-8 text-[11px] rounded-xl"
                        >
                          <Clock className="w-3 h-3 mr-1 text-sky-600" />
                          Sync IST
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPullTargetDevice(device.id);
                            setPullDateOption("today");
                            setActiveTab("puller");
                          }}
                          className="h-8 text-[11px] rounded-xl"
                        >
                          <Download className="w-3 h-3 mr-1 text-indigo-600" />
                          Pull Scans
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfigurePush(device.id)}
                          className="h-8 text-[11px] rounded-xl text-sky-700 bg-sky-50/50 hover:bg-sky-100"
                        >
                          <Globe className="w-3 h-3 mr-1" />
                          Push Config
                        </Button>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                        <button
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
                          className="text-gray-500 hover:text-gray-900 font-medium flex items-center gap-1"
                        >
                          <Pencil className="w-3 h-3" /> Edit Config
                        </button>

                        <button
                          onClick={() => handleDeleteDevice(device.id, device.name)}
                          className="text-rose-500 hover:text-rose-700 font-medium flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: TODAY'S LOGS & PUNCHES */}
        {activeTab === "logs" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, ID, or ITS..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl w-60 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="flex items-center bg-gray-100 p-1 rounded-xl text-xs">
                  {(["ALL", "STUDENT", "TEACHER"] as const).map((r) => (
                    <button
                      key={r}
                      onClick={() => setLogFilterRole(r)}
                      className={cn(
                        "px-3 py-1 rounded-lg font-medium transition-all text-[11px]",
                        logFilterRole === r ? "bg-white text-slate-900 shadow-xs font-bold" : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      {r === "ALL" ? "All Logs" : r === "STUDENT" ? "Talabat" : "Faculty"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshAllData}
                  className="rounded-xl text-xs h-8"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
                <Button
                  size="sm"
                  onClick={() => setTestPunchModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold h-8"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Test Scan
                </Button>
              </div>
            </div>

            {/* Table of Today's Logs */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Role & Grade</th>
                    <th className="px-4 py-3">Time (IST)</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3 text-right">Identifier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTodayLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-400">
                        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-medium text-xs">No attendance records for today yet.</p>
                        <p className="text-[10px] text-gray-400 mt-1">Use the Direct Log Puller to extract scans from terminal memory, or click "Test Scan" to verify the pipeline.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTodayLogs.map((log) => {
                      const isStudent = log.role === "STUDENT";
                      const isLate = log.status === "LATE";
                      const timeStr = log.checkInTime
                        ? new Date(log.checkInTime).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: true,
                          })
                        : "—";

                      return (
                        <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            <div className="flex items-center gap-2">
                              <div
                                className={cn(
                                  "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold",
                                  isStudent ? "bg-emerald-100 text-emerald-800" : "bg-indigo-100 text-indigo-800"
                                )}
                              >
                                {isStudent ? <GraduationCap className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                              </div>
                              <span>{log.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{log.gradeOrDept}</td>
                          <td className="px-4 py-3 font-mono text-gray-700 font-medium">{timeStr}</td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-bold px-2 py-0.5",
                                isLate
                                  ? "bg-amber-50 text-amber-800 border-amber-300"
                                  : "bg-emerald-50 text-emerald-800 border-emerald-300"
                              )}
                            >
                              {log.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-[11px]">
                            {log.biometricMethod || log.verificationMethod || "Biometric"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-500 text-[11px]">
                            {log.studentId || log.teacherId || log.biometricHash || "—"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: DIRECT LOG PULLER TOOL */}
        {activeTab === "puller" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <Card className="rounded-3xl border border-gray-100 shadow-lg p-6 bg-white">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Download className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Direct Hardware Log Extraction</h3>
                  <p className="text-xs text-gray-500">
                    Query access-control event logs stored inside Hikvision terminal hardware and ingest them directly into student and teacher attendance records.
                  </p>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-gray-100">
                {/* Target Terminal */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Target Terminal</label>
                  <select
                    value={pullTargetDevice}
                    onChange={(e) => setPullTargetDevice(e.target.value)}
                    className="w-full text-xs p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    <option value="ALL">All Configured & Enabled Terminals</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.host}) — {d.status}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Range Selection */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">Query Range</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    {[
                      { id: "today", label: "Today (00:00 - Now)" },
                      { id: "yesterday", label: "Yesterday" },
                      { id: "last7", label: "Last 7 Days" },
                      { id: "custom", label: "Custom Date Range" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setPullDateOption(opt.id as any)}
                        className={cn(
                          "p-2.5 rounded-xl border text-xs font-medium text-center transition-all",
                          pullDateOption === opt.id
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-bold"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {pullDateOption === "custom" && (
                    <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                      <div>
                        <label className="text-[11px] font-medium text-gray-500 block mb-1">From Date</label>
                        <input
                          type="date"
                          value={pullCustomFrom}
                          onChange={(e) => setPullCustomFrom(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-gray-200 rounded-xl"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-gray-500 block mb-1">To Date</label>
                        <input
                          type="date"
                          value={pullCustomTo}
                          onChange={(e) => setPullCustomTo(e.target.value)}
                          className="w-full text-xs p-2 bg-white border border-gray-200 rounded-xl"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Execution Button */}
                <Button
                  onClick={handleExecuteLogPull}
                  disabled={pullingLogs}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold py-3 h-11 shadow-md shadow-emerald-900/20"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {pullingLogs ? "Extracting Scans from Terminal Memory..." : "Extract & Ingest Hardware Logs"}
                </Button>

                {pullResultSummary && (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-medium text-emerald-900">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 inline mr-2" />
                    {pullResultSummary}
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 5: TALABAT BIOMETRIC REGISTRY */}
        {activeTab === "talabat" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search students by name, ID, or grade..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl w-64 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLinkAllByIts}
                  className="h-8 text-xs rounded-xl text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                >
                  <Link2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  Auto-Link ITS Cards
                </Button>
                <Button
                  size="sm"
                  onClick={handleDeployAllMembers}
                  className="h-8 text-xs rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Users className="w-3.5 h-3.5 mr-1" />
                  Push Students to Terminals
                </Button>
                <div className="text-xs font-semibold text-gray-500 ml-2">
                  Enrolled: <span className="text-emerald-700 font-bold">{students.filter((s) => s.enrolled).length}</span> / {students.length} Students
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Student Name</th>
                    <th className="px-4 py-3">Student ID</th>
                    <th className="px-4 py-3">Grade & Section</th>
                    <th className="px-4 py-3">Biometric ID</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {students
                    .filter((s) => !searchQuery.trim() || s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.studentId.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((s) => (
                      <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-gray-900">{s.name}</td>
                        <td className="px-4 py-3 font-mono text-gray-600">{s.studentId}</td>
                        <td className="px-4 py-3 text-gray-600">Grade {s.grade}-{s.section}</td>
                        <td className="px-4 py-3 font-mono text-gray-700 font-medium">
                          {s.fingerprint || <span className="text-gray-400 font-normal">Not Registered</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5",
                              s.enrolled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-500"
                            )}
                          >
                            {s.enrolled ? "Enrolled" : "Pending"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setLinkTarget({ id: s.id, name: s.name, role: "STUDENT", currentId: s.fingerprint });
                              setLinkInputId(s.fingerprint || s.studentId);
                              setLinkModalOpen(true);
                            }}
                            className="h-7 text-xs text-emerald-700 hover:bg-emerald-50 rounded-lg"
                          >
                            <Link2 className="w-3.5 h-3.5 mr-1" />
                            {s.enrolled ? "Edit ID" : "Link ID"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: FACULTY BIOMETRIC REGISTRY */}
        {activeTab === "teachers" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search faculty by name or employee ID..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-xl w-64 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLinkAllByIts}
                  className="h-8 text-xs rounded-xl text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                >
                  <Link2 className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                  Auto-Link ITS Cards
                </Button>
                <Button
                  size="sm"
                  onClick={handleDeployAllMembers}
                  className="h-8 text-xs rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Users className="w-3.5 h-3.5 mr-1" />
                  Push Faculty to Terminals
                </Button>
                <div className="text-xs font-semibold text-gray-500 ml-2">
                  Enrolled: <span className="text-indigo-700 font-bold">{teachers.filter((t) => t.enrolled).length}</span> / {teachers.length} Faculty
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Faculty Member</th>
                    <th className="px-4 py-3">Employee ID</th>
                    <th className="px-4 py-3">Department</th>
                    <th className="px-4 py-3">Biometric ID</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {teachers
                    .filter((t) => !searchQuery.trim() || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.employeeId.toLowerCase().includes(searchQuery.toLowerCase()))
                    .map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-gray-900">{t.name}</td>
                        <td className="px-4 py-3 font-mono text-gray-600">{t.employeeId}</td>
                        <td className="px-4 py-3 text-gray-600">{t.department || "General Faculty"}</td>
                        <td className="px-4 py-3 font-mono text-gray-700 font-medium">
                          {t.fingerprint || <span className="text-gray-400 font-normal">Not Registered</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5",
                              t.enrolled ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-gray-100 text-gray-500"
                            )}
                          >
                            {t.enrolled ? "Enrolled" : "Pending"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setLinkTarget({ id: t.id, name: t.name, role: "TEACHER", currentId: t.fingerprint });
                              setLinkInputId(t.fingerprint || t.employeeId);
                              setLinkModalOpen(true);
                            }}
                            className="h-7 text-xs text-indigo-700 hover:bg-indigo-50 rounded-lg"
                          >
                            <Link2 className="w-3.5 h-3.5 mr-1" />
                            {t.enrolled ? "Edit ID" : "Link ID"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: UNMATCHED IDS */}
        {activeTab === "unmatched" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-gray-900">Unrecognized Scans & Smart Linker</h3>
                <p className="text-xs text-gray-500">Punches received from the terminal that do not match any enrolled student or faculty profile.</p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await fetch("/api/biometric/unmatched/clear", { method: "POST" });
                  toast.success("Unmatched queue cleared");
                  refreshAllData();
                }}
                className="text-xs rounded-xl"
              >
                Clear Queue
              </Button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-xs overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Unmatched Scanned ID</th>
                    <th className="px-4 py-3">Scan Count</th>
                    <th className="px-4 py-3">Last Seen</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {unmatched.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-12 text-gray-400">
                        <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/40" />
                        <p className="font-medium text-xs">All terminal scans matched with registered members!</p>
                      </td>
                    </tr>
                  ) : (
                    unmatched.map((u) => (
                      <tr key={u.fingerprint} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-mono font-bold text-rose-700">{u.fingerprint}</td>
                        <td className="px-4 py-3 text-gray-600 font-semibold">{u.count} times</td>
                        <td className="px-4 py-3 font-mono text-gray-500">
                          {new Date(u.lastSeen).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            onClick={() => {
                              setTestIdentifier(u.fingerprint);
                              setTestPunchModalOpen(true);
                            }}
                            className="h-7 text-xs bg-slate-900 text-white rounded-lg"
                          >
                            Assign to Profile
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 8: CLOUD & WEBHOOK SETUP */}
        {activeTab === "cloud" && (
          <div className="max-w-4xl mx-auto space-y-6">
            <Card className="rounded-3xl border border-gray-100 shadow-md p-6 bg-white space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Configuring Terminals for Render / Cloud Deployment</h3>
                  <p className="text-xs text-gray-500">Step-by-step instructions for getting attendance logs from physical LAN hardware to Render.</p>
                </div>
              </div>

              <div className="space-y-4 text-xs text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                <div className="p-3 bg-slate-900 text-slate-200 rounded-2xl font-mono text-[11px]">
                  <div className="text-slate-400 mb-1">Webhook Receiver URL:</div>
                  <div className="text-emerald-400 font-bold break-all">
                    {typeof window !== "undefined" ? `${window.location.origin}/api/hikvision/events` : "https://[YOUR-RENDER-APP].onrender.com/api/hikvision/events"}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-gray-900">Option 1: One-Click Webhook Push (Recommended)</h4>
                  <p>
                    Go to the <strong>Terminals & Hardware</strong> tab and click <strong>&quot;Push Config&quot;</strong> on any device. The server will send an ISAPI command registering the cloud webhook directly onto the terminal.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-gray-900">Option 2: Direct Device Log Puller</h4>
                  <p>
                    Whenever the terminal is accessible on the network, administrators can use the <strong>Direct Log Puller</strong> tab to query the terminal&apos;s internal flash memory for any date range and sync all scans at once.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      {/* Add / Edit Terminal Modal */}
      {deviceFormOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">
                {deviceForm.id ? "Edit Biometric Terminal" : "Add Biometric Terminal"}
              </h3>
              <button onClick={() => setDeviceFormOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>

            <form onSubmit={handleSaveDevice} className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Terminal Name</label>
                <input
                  type="text"
                  required
                  value={deviceForm.name}
                  onChange={(e) => setDeviceForm({ ...deviceForm, name: e.target.value })}
                  placeholder="e.g. Main Gate Terminal"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="font-semibold text-gray-700 block mb-1">Host IP Address</label>
                  <input
                    type="text"
                    required
                    value={deviceForm.host}
                    onChange={(e) => setDeviceForm({ ...deviceForm, host: e.target.value })}
                    placeholder="192.168.0.4"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Port</label>
                  <input
                    type="number"
                    value={deviceForm.port}
                    onChange={(e) => setDeviceForm({ ...deviceForm, port: Number(e.target.value) || 80 })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Username</label>
                  <input
                    type="text"
                    required
                    value={deviceForm.username}
                    onChange={(e) => setDeviceForm({ ...deviceForm, username: e.target.value })}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Password</label>
                  <input
                    type="password"
                    value={deviceForm.password}
                    onChange={(e) => setDeviceForm({ ...deviceForm, password: e.target.value })}
                    placeholder={deviceForm.id ? "••••••••" : "Device password"}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="devEnabled"
                  checked={deviceForm.enabled}
                  onChange={(e) => setDeviceForm({ ...deviceForm, enabled: e.target.checked })}
                  className="rounded text-emerald-600"
                />
                <label htmlFor="devEnabled" className="font-medium text-gray-700">Enable Automated ISAPI Polling</label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={() => setDeviceFormOpen(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={savingDevice} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs">
                  {savingDevice ? "Saving..." : "Save Terminal"}
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Simulate Test Punch Modal */}
      {testPunchModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Simulate Biometric Punch
              </h3>
              <button onClick={() => setTestPunchModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>

            <p className="text-xs text-gray-500">
              Instantly test the attendance pipeline and live feed by sending a verified punch identifier for any student or teacher.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Student ID / ITS / Employee ID / Card Hash</label>
                <input
                  type="text"
                  value={testIdentifier}
                  onChange={(e) => setTestIdentifier(e.target.value)}
                  placeholder="e.g. 30382757 or STU-101"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Verification Mode</label>
                <select
                  value={testVerifyMode}
                  onChange={(e) => setTestVerifyMode(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium"
                >
                  <option value="FACIAL">Facial Recognition (Camera)</option>
                  <option value="FINGERPRINT">Fingerprint Sensor</option>
                  <option value="CARD">RFID Smart Card</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button variant="ghost" onClick={() => setTestPunchModalOpen(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button onClick={handleSimulatePunch} disabled={simulatingPunch} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold">
                  {simulatingPunch ? "Processing..." : "Trigger Punch"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Link Biometric ID Modal */}
      {linkModalOpen && linkTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-emerald-600" />
                Link Biometric ID
              </h3>
              <button onClick={() => setLinkModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
            </div>

            <p className="text-xs text-gray-500">
              Assign or update the terminal employee number / card / fingerprint hash for <strong>{linkTarget.name}</strong>.
            </p>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Terminal Employee Number / Card Hash</label>
                <input
                  type="text"
                  value={linkInputId}
                  onChange={(e) => setLinkInputId(e.target.value)}
                  placeholder="e.g. 30382757"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <Button variant="ghost" onClick={() => setLinkModalOpen(false)} className="rounded-xl text-xs">
                  Cancel
                </Button>
                <Button onClick={handleSaveLink} disabled={savingLink} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold">
                  {savingLink ? "Saving..." : "Save Biometric Link"}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
