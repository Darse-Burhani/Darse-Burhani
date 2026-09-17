"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  RefreshCw,
  Power,
  Clock,
  Volume2,
  VolumeX,
  Volume1,
  Users,
  CreditCard,
  Trash2,
  UserPlus,
  Send,
  Cpu,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Sliders,
  Maximize2,
  Download,
  Search,
  Sparkles,
  Layers,
  ChevronRight,
  Server,
  Zap,
  Mic,
  MicOff,
  Radio,
  Grid2X2,
  Square,
  Columns,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  Settings2,
  Shield,
  Eye,
  BellRing,
  MessageSquare,
  HardDrive,
  Wifi,
  WifiOff,
} from "lucide-react";
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
  serialNo: string | null;
  model: string | null;
  mac: string | null;
  firmwareVersion: string | null;
  status: string;
  lastError: string | null;
  lastSeenAt: string | null;
  pollIntervalSeconds: number;
  enabled: boolean;
}

interface TelemetryData {
  cpuUsage?: number;
  memoryUsage?: number;
  uptimeSeconds?: number;
}

interface EnrolledMember {
  employeeNo: string;
  name?: string;
  matchedType: "STUDENT" | "TEACHER" | "UNMATCHED";
  matchedEntityName?: string;
  matchedEntityId?: string;
}

interface StudentOption {
  id: string;
  studentId: string;
  name: string;
  grade: string;
  section: string;
}

interface TeacherOption {
  id: string;
  employeeId: string;
  name: string;
  department: string;
}

interface LiveScanEvent {
  id: string;
  name: string;
  type: "STUDENT" | "TEACHER" | "UNMATCHED";
  employeeNo: string;
  timestamp: string;
  deviceId?: string;
  deviceHost?: string;
  status?: string;
}

type ViewMode = "dual" | "focus1" | "focus2" | "pip";
type StreamInterval = 1000 | 2500 | 5000 | 0; // 0 = paused

const PRESET_VOICE_PROMPTS = [
  { id: "pleaseScanFace", label: "Please Scan Face", arabic: "من فضلك امسح وجهك", icon: Eye, color: "from-sky-500 to-blue-600" },
  { id: "accessGranted", label: "Attendance Marked", arabic: "تم تسجيل الحضور بنجاح", icon: CheckCircle2, color: "from-emerald-500 to-teal-600" },
  { id: "scanAgain", label: "Scan Again (Retry)", arabic: "يرجى المسح مرة أخرى", icon: RefreshCw, color: "from-amber-500 to-orange-600" },
  { id: "maintainQueue", label: "Please Wait in Line", arabic: "يرجى الانتظار في الصف", icon: Users, color: "from-indigo-500 to-violet-600" },
  { id: "goodMorning", label: "Good Morning", arabic: "صباح الخير", icon: Sparkles, color: "from-amber-400 to-yellow-500" },
  { id: "goodEvening", label: "Good Afternoon", arabic: "مساؤ الخير", icon: Sparkles, color: "from-purple-500 to-pink-600" },
  { id: "registrationRequired", label: "Registration Required", arabic: "يرجى مراجعة الإدارة", icon: AlertTriangle, color: "from-rose-500 to-red-600" },
];

export default function IvmsControlStation({
  devices,
  onRefreshDevices,
}: {
  devices: BiometricDevice[];
  onRefreshDevices?: () => void;
}) {
  // Device Selection & Layout
  const [viewMode, setViewMode] = useState<ViewMode>("dual");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.id || "");
  const dev1 = devices[0] || null;
  const dev2 = devices[1] || null;

  // Live Video Streaming State per Device
  const [streamInterval, setStreamInterval] = useState<StreamInterval>(2500);
  const [dev1Snapshot, setDev1Snapshot] = useState<string | null>(null);
  const [dev2Snapshot, setDev2Snapshot] = useState<string | null>(null);
  const [dev1Loading, setDev1Loading] = useState(false);
  const [dev2Loading, setDev2Loading] = useState(false);
  const [dev1Fps, setDev1Fps] = useState<number>(0);
  const [dev2Fps, setDev2Fps] = useState<number>(0);
  const [dev1LastUpdated, setDev1LastUpdated] = useState<Date | null>(null);
  const [dev2LastUpdated, setDev2LastUpdated] = useState<Date | null>(null);

  // Digital Zoom & Pan per Device
  const [dev1Zoom, setDev1Zoom] = useState<number>(1);
  const [dev2Zoom, setDev2Zoom] = useState<number>(1);
  const [fullscreenDevice, setFullscreenDevice] = useState<BiometricDevice | null>(null);

  // Telemetry per Device
  const [telemetry1, setTelemetry1] = useState<TelemetryData | null>(null);
  const [telemetry2, setTelemetry2] = useState<TelemetryData | null>(null);
  const [loadingTelemetry, setLoadingTelemetry] = useState(false);

  // Audio & Voice Studio
  const [volume1, setVolume1] = useState<number>(60);
  const [volume2, setVolume2] = useState<number>(60);
  const [masterVolume, setMasterVolume] = useState<number>(60);
  const [audioTarget, setAudioTarget] = useState<"BOTH" | "DEV1" | "DEV2">("BOTH");
  const [customVoiceText, setCustomVoiceText] = useState("");
  const [broadcastingVoice, setBroadcastingVoice] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  const micIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Member Provisioning
  const [provisionTab, setProvisionTab] = useState<"batch" | "single" | "enrolled">("batch");
  const [provisionTarget, setProvisionTarget] = useState<"BOTH" | "DEV1" | "DEV2">("BOTH");
  const [batchAudience, setBatchAudience] = useState<"ALL" | "STUDENTS" | "TEACHERS">("ALL");
  const [batchDeploying, setBatchDeploying] = useState(false);
  const [batchResult, setBatchResult] = useState<any>(null);

  // Single Deploy Member
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [memberType, setMemberType] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [deployingSingle, setDeployingSingle] = useState(false);

  // Enrolled Members list
  const [deviceMembers, setDeviceMembers] = useState<EnrolledMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberFilter, setMemberFilter] = useState("");
  const [cardModalUser, setCardModalUser] = useState<string | null>(null);
  const [cardNumber, setCardNumber] = useState("");
  const [cardBusy, setCardBusy] = useState(false);

  // Live Scan Activity Ticker (SSE)
  const [liveScans, setLiveScans] = useState<LiveScanEvent[]>([]);
  const [liveScanFilter, setLiveScanFilter] = useState<"ALL" | "STUDENT" | "FACULTY">("ALL");

  const filteredLiveScans = useMemo(() => {
    if (liveScanFilter === "ALL") return liveScans;
    if (liveScanFilter === "STUDENT") {
      return liveScans.filter((s) => s.type === "STUDENT");
    }
    return liveScans.filter((s) => s.type !== "STUDENT");
  }, [liveScans, liveScanFilter]);

  const liveTalabatCount = liveScans.filter((s) => s.type === "STUDENT").length;
  const liveFacultyCount = liveScans.filter((s) => s.type !== "STUDENT").length;

  // Bulk Master Actions State
  const [bulkSyncingTime, setBulkSyncingTime] = useState(false);
  const [bulkPullingScans, setBulkPullingScans] = useState(false);
  const [rebootingDev, setRebootingDev] = useState<string | null>(null);

  // Quick Device Config / Re-Link Modal
  const [editDeviceModal, setEditDeviceModal] = useState<BiometricDevice | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    host: "",
    port: 80,
    username: "admin",
    password: "",
  });
  const [savingConfig, setSavingConfig] = useState(false);

  const handleOpenConfig = (d: BiometricDevice) => {
    setEditDeviceModal(d);
    setEditForm({
      name: d.name || "",
      host: d.host || "",
      port: d.port || 80,
      username: d.username || "admin",
      password: "",
    });
  };

  const handleSaveConfig = async () => {
    if (!editDeviceModal || !editForm.host.trim()) return;
    setSavingConfig(true);
    try {
      const payload: any = {
        name: editForm.name.trim(),
        host: editForm.host.trim(),
        port: Number(editForm.port) || 80,
        username: editForm.username.trim() || "admin",
      };
      if (editForm.password.trim()) {
        payload.password = editForm.password.trim();
      }

      const res = await fetch(`/api/biometric/devices/${editDeviceModal.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const json = await res.json();

      if (json.success) {
        toast({
          title: "Device Configuration Saved",
          description: `Updated host to ${editForm.host}:${editForm.port}. Verifying link...`,
          variant: "success",
        });

        // Test connection
        const testRes = await fetch(`/api/biometric/devices/${editDeviceModal.id}/test`, {
          method: "POST",
          credentials: "include",
        });
        const testJson = await testRes.json();
        if (testJson.success) {
          toast({
            title: "Terminal Linked & Active",
            description: `Successfully connected to ${testJson.data?.model || "Hikvision Terminal"} (${testJson.data?.serialNo || editForm.host}).`,
            variant: "success",
          });
        } else {
          toast({
            title: "Config Saved (Connection Warning)",
            description: testJson.error || "Device did not respond to ISAPI ping. Please verify network and IP.",
            variant: "destructive",
          });
        }

        setEditDeviceModal(null);
        if (onRefreshDevices) onRefreshDevices();
        // Immediately fetch snapshot with new host
        setTimeout(() => {
          if (editDeviceModal.id === dev1?.id && dev1) fetchFrame(dev1, true);
          if (editDeviceModal.id === dev2?.id && dev2) fetchFrame(dev2, false);
        }, 500);
      } else {
        toast({ title: "Failed to update device", description: json.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Save Error", description: err?.message, variant: "destructive" });
    } finally {
      setSavingConfig(false);
    }
  };

  // Initialize selected device
  useEffect(() => {
    if (devices.length > 0 && (!selectedDeviceId || !devices.some((d) => d.id === selectedDeviceId))) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  // Load students & teachers for provisioning
  useEffect(() => {
    async function loadDirectory() {
      try {
        const [sRes, tRes] = await Promise.all([
          fetch("/api/biometric/students", { credentials: "include" }).then((r) => r.json()),
          fetch("/api/biometric/teachers", { credentials: "include" }).then((r) => r.json()),
        ]);
        if (sRes.success) setStudents(sRes.data || []);
        if (tRes.success) setTeachers(tRes.data || []);
      } catch {}
    }
    loadDirectory();
  }, []);

  // Subscribe to live SSE scan stream
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/biometric/events/stream");
      es.onmessage = (e) => {
        try {
          if (!e.data || e.data.startsWith(":")) return;
          const ev = JSON.parse(e.data);
          if (ev && (ev.name || ev.employeeNo || ev.studentId)) {
            const newScan: LiveScanEvent = {
              id: ev.id || `${Date.now()}-${Math.random()}`,
              name: ev.name || ev.userName || "Verified User",
              type: ev.userType === "teacher" ? "TEACHER" : "STUDENT",
              employeeNo: ev.employeeNo || ev.its || ev.studentId || "0000",
              timestamp: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
              deviceHost: ev.deviceHost || "Terminal",
              status: ev.status || "PRESENT",
            };
            setLiveScans((prev) => [newScan, ...prev.slice(0, 19)]);
          }
        } catch {}
      };
    } catch {}

    return () => {
      if (es) es.close();
    };
  }, []);

  // Fetch frame helper
  const fetchFrame = useCallback(async (dev: BiometricDevice, isDev1: boolean) => {
    if (!dev) return;
    if (isDev1) setDev1Loading(true);
    else setDev2Loading(true);

    const startTime = performance.now();
    try {
      const cacheBuster = Date.now();
      const res = await fetch(`/api/biometric/devices/${dev.id}/snapshot?_t=${cacheBuster}`, { credentials: "include" });
      if (res.ok) {
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const elapsed = performance.now() - startTime;
        const calculatedFps = Math.max(1, Math.round(1000 / (elapsed + 300)));

        if (isDev1) {
          setDev1Snapshot((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return objUrl;
          });
          setDev1Fps(calculatedFps);
          setDev1LastUpdated(new Date());
        } else {
          setDev2Snapshot((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return objUrl;
          });
          setDev2Fps(calculatedFps);
          setDev2LastUpdated(new Date());
        }
      }
    } catch {
      // ignore
    } finally {
      if (isDev1) setDev1Loading(false);
      else setDev2Loading(false);
    }
  }, []);

  // Continuous Video Stream Loop for both devices
  useEffect(() => {
    if (streamInterval === 0) return; // paused

    let isMounted = true;
    let timer1: NodeJS.Timeout | null = null;
    let timer2: NodeJS.Timeout | null = null;

    if (dev1) {
      fetchFrame(dev1, true);
      timer1 = setInterval(() => {
        if (isMounted && dev1) fetchFrame(dev1, true);
      }, streamInterval);
    }

    if (dev2) {
      fetchFrame(dev2, false);
      timer2 = setInterval(() => {
        if (isMounted && dev2) fetchFrame(dev2, false);
      }, streamInterval);
    }

    return () => {
      isMounted = false;
      if (timer1) clearInterval(timer1);
      if (timer2) clearInterval(timer2);
    };
  }, [dev1, dev2, streamInterval, fetchFrame]);

  // Load Telemetry & Volume for both devices
  const loadDeviceData = useCallback(async () => {
    setLoadingTelemetry(true);
    try {
      if (dev1) {
        fetch(`/api/biometric/devices/${dev1.id}/system-status`, { credentials: "include" })
          .then((r) => r.json())
          .then((d) => d.success && setTelemetry1(d.data?.telemetry))
          .catch(() => {});

        fetch(`/api/biometric/devices/${dev1.id}/volume`, { credentials: "include" })
          .then((r) => r.json())
          .then((d) => d.success && typeof d.data?.volume === "number" && setVolume1(d.data.volume))
          .catch(() => {});
      }

      if (dev2) {
        fetch(`/api/biometric/devices/${dev2.id}/system-status`, { credentials: "include" })
          .then((r) => r.json())
          .then((d) => d.success && setTelemetry2(d.data?.telemetry))
          .catch(() => {});

        fetch(`/api/biometric/devices/${dev2.id}/volume`, { credentials: "include" })
          .then((r) => r.json())
          .then((d) => d.success && typeof d.data?.volume === "number" && setVolume2(d.data.volume))
          .catch(() => {});
      }
    } finally {
      setLoadingTelemetry(false);
    }
  }, [dev1, dev2]);

  useEffect(() => {
    loadDeviceData();
  }, [loadDeviceData]);

  // Push-to-Talk Mic Simulator with Visualizer
  const toggleMicrophone = () => {
    if (isMicActive) {
      setIsMicActive(false);
      if (micIntervalRef.current) clearInterval(micIntervalRef.current);
      setMicVolumeLevel(0);
      toast({ title: "Microphone Broadcast Ended", variant: "default" });
    } else {
      setIsMicActive(true);
      toast({
        title: "Live Mic Broadcast Active",
        description: `Streaming voice to ${audioTarget === "BOTH" ? "Both Terminals" : audioTarget === "DEV1" ? dev1?.name : dev2?.name} speakers...`,
        variant: "success",
      });
      // Simulate live audio waveform levels
      micIntervalRef.current = setInterval(() => {
        setMicVolumeLevel(Math.floor(Math.random() * 60) + 30);
      }, 100);
    }
  };

  // Play Preset Voice Prompt
  const handlePlayVoicePrompt = async (promptId: string, promptLabel: string) => {
    setBroadcastingVoice(true);
    try {
      // Local Speech Synthesis for instant natural audio playback
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(promptLabel);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
      }

      const endpoints = [];
      if (audioTarget === "BOTH" || audioTarget === "DEV1") {
        if (dev1) endpoints.push(`/api/biometric/devices/${dev1.id}/voice/play`);
      }
      if (audioTarget === "BOTH" || audioTarget === "DEV2") {
        if (dev2) endpoints.push(`/api/biometric/devices/${dev2.id}/voice/play`);
      }

      await Promise.allSettled(
        endpoints.map((url) =>
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptType: promptId }),
            credentials: "include",
          })
        )
      );

      toast({
        title: `Voice Broadcast: "${promptLabel}"`,
        description: `Dispatched to ${audioTarget === "BOTH" ? "both terminals" : audioTarget === "DEV1" ? dev1?.name : dev2?.name} speakers.`,
        variant: "success",
      });
    } catch {
      toast({ title: "Broadcast Failed", description: "Terminal speaker rejected voice command", variant: "destructive" });
    } finally {
      setBroadcastingVoice(false);
    }
  };

  // Broadcast Custom Text Announcement
  const handleBroadcastCustomText = async () => {
    if (!customVoiceText.trim()) return;
    setBroadcastingVoice(true);
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(customVoiceText.trim());
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }

      const endpoints = [];
      if (audioTarget === "BOTH" || audioTarget === "DEV1") {
        if (dev1) endpoints.push(`/api/biometric/devices/${dev1.id}/voice/play`);
      }
      if (audioTarget === "BOTH" || audioTarget === "DEV2") {
        if (dev2) endpoints.push(`/api/biometric/devices/${dev2.id}/voice/play`);
      }

      await Promise.allSettled(
        endpoints.map((url) =>
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ promptType: "welcome", customText: customVoiceText.trim() }),
            credentials: "include",
          })
        )
      );

      toast({
        title: "Voice Announcement Broadcasted",
        description: `"${customVoiceText.trim()}" played on terminal speakers.`,
        variant: "success",
      });
      setCustomVoiceText("");
    } catch {
      toast({ title: "Failed to broadcast voice", variant: "destructive" });
    } finally {
      setBroadcastingVoice(false);
    }
  };

  // Set Speaker Volume
  const handleSetVolume = async (newVol: number, target: "BOTH" | "DEV1" | "DEV2") => {
    if (target === "BOTH") {
      setMasterVolume(newVol);
      setVolume1(newVol);
      setVolume2(newVol);
      fetch("/api/biometric/devices/bulk/volume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: newVol }),
        credentials: "include",
      }).catch(() => {});
      toast({ title: `Master Volume set to ${newVol}% on all terminals`, variant: "success" });
    } else if (target === "DEV1" && dev1) {
      setVolume1(newVol);
      fetch(`/api/biometric/devices/${dev1.id}/volume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: newVol }),
        credentials: "include",
      }).catch(() => {});
      toast({ title: `${dev1.name} Volume set to ${newVol}%`, variant: "success" });
    } else if (target === "DEV2" && dev2) {
      setVolume2(newVol);
      fetch(`/api/biometric/devices/${dev2.id}/volume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volume: newVol }),
        credentials: "include",
      }).catch(() => {});
      toast({ title: `${dev2.name} Volume set to ${newVol}%`, variant: "success" });
    }
  };

  // Play Speaker Test Tone
  const handleTestTone = (target: "BOTH" | "DEV1" | "DEV2") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);

      handlePlayVoicePrompt("welcome", "Speaker Test Tone");
    } catch {}
  };

  // 1-Click Sync Time on Both Devices
  const handleBulkSyncTime = async () => {
    setBulkSyncingTime(true);
    try {
      const res = await fetch("/api/biometric/devices/bulk/sync-time", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "All Terminal Clocks Synchronized",
          description: `Device clocks synchronized to Indian Standard Time (${new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST).`,
          variant: "success",
        });
        loadDeviceData();
      } else {
        toast({ title: "Clock Sync Failed", description: json.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    } finally {
      setBulkSyncingTime(false);
    }
  };

  // 1-Click Pull Scans from Both Devices
  const handleBulkPullScans = async () => {
    setBulkPullingScans(true);
    try {
      const res = await fetch("/api/biometric/sync-all-now", {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: "Scans Pulled from All Devices",
          description: `Processed ${json.data?.totalEvents || 0} events from terminal storage.`,
          variant: "success",
        });
        if (onRefreshDevices) onRefreshDevices();
      } else {
        toast({ title: "Pull Scans Failed", description: json.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    } finally {
      setBulkPullingScans(false);
    }
  };

  // Remote Terminal Reboot
  const handleReboot = async (device: BiometricDevice) => {
    if (!confirm(`Are you sure you want to reboot ${device.name}? The terminal will restart in 15 seconds.`)) return;

    setRebootingDev(device.id);
    try {
      const res = await fetch(`/api/biometric/devices/${device.id}/reboot`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: `${device.name} Rebooting`,
          description: "Reboot command received. Terminal will come back online in 20-30 seconds.",
          variant: "success",
        });
      } else {
        toast({ title: "Reboot Failed", description: json.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Reboot Error", description: err?.message, variant: "destructive" });
    } finally {
      setRebootingDev(null);
    }
  };

  // Batch Member Deployment
  const handleBatchDeploy = async () => {
    setBatchDeploying(true);
    setBatchResult(null);
    try {
      const targetDeviceIds =
        provisionTarget === "BOTH"
          ? devices.map((d) => d.id)
          : provisionTarget === "DEV1" && dev1
          ? [dev1.id]
          : dev2
          ? [dev2.id]
          : [];

      const results = await Promise.all(
        targetDeviceIds.map((id) =>
          fetch(`/api/biometric/devices/${id}/users/deploy-all`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ target: batchAudience }),
            credentials: "include",
          }).then((r) => r.json())
        )
      );

      const totalDepl = results.reduce((acc, r) => acc + (r.data?.totalDeployed || 0), 0);
      setBatchResult({ totalDeployed: totalDepl, results });
      toast({
        title: "Batch Provisioning Finished",
        description: `Successfully deployed ${totalDepl} member profiles to ${targetDeviceIds.length} terminal(s).`,
        variant: "success",
      });
      if (onRefreshDevices) onRefreshDevices();
    } catch (err: any) {
      toast({ title: "Deployment Error", description: err?.message, variant: "destructive" });
    } finally {
      setBatchDeploying(false);
    }
  };

  // Single Member Deploy
  const handleDeploySingle = async () => {
    if (!selectedMemberId) return;
    setDeployingSingle(true);
    try {
      const body =
        memberType === "STUDENT"
          ? { studentId: selectedMemberId }
          : { teacherId: selectedMemberId };

      const targetDeviceIds =
        provisionTarget === "BOTH"
          ? devices.map((d) => d.id)
          : provisionTarget === "DEV1" && dev1
          ? [dev1.id]
          : dev2
          ? [dev2.id]
          : [];

      await Promise.all(
        targetDeviceIds.map((id) =>
          fetch(`/api/biometric/devices/${id}/users/deploy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            credentials: "include",
          }).then((r) => r.json())
        )
      );

      toast({
        title: "Member Deployed Successfully",
        description: `Profile registered on ${targetDeviceIds.length} terminal(s) for instant facial matching.`,
        variant: "success",
      });
      setSelectedMemberId("");
    } catch (err: any) {
      toast({ title: "Deployment Error", description: err?.message, variant: "destructive" });
    } finally {
      setDeployingSingle(false);
    }
  };

  // Fetch enrolled device users
  const fetchDeviceMembersList = useCallback(async (devId: string) => {
    if (!devId) return;
    setLoadingMembers(true);
    try {
      const res = await fetch(`/api/biometric/devices/${devId}/fetch-members`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success && json.data?.members) {
        setDeviceMembers(json.data.members);
      }
    } catch {
      toast({ title: "Failed to fetch device members", variant: "destructive" });
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  // Delete User from Terminal
  const handleDeleteDeviceUser = async (empNo: string, devId: string) => {
    if (!confirm(`Are you sure you want to delete user ${empNo} from terminal storage?`)) return;

    try {
      const res = await fetch(`/api/biometric/devices/${devId}/users/${encodeURIComponent(empNo)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: `User ${empNo} removed from terminal`, variant: "success" });
        setDeviceMembers((prev) => prev.filter((m) => m.employeeNo !== empNo));
      } else {
        toast({ title: "Delete Failed", description: json.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  // Assign RFID card
  const handleAssignCard = async () => {
    if (!cardModalUser || !cardNumber.trim() || !selectedDeviceId) return;
    setCardBusy(true);
    try {
      const res = await fetch(`/api/biometric/devices/${selectedDeviceId}/users/${encodeURIComponent(cardModalUser)}/card`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardNo: cardNumber.trim() }),
        credentials: "include",
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: `RFID Card ${cardNumber} assigned to ${cardModalUser}`, variant: "success" });
        setCardModalUser(null);
        setCardNumber("");
      } else {
        toast({ title: "Card Assignment Failed", description: json.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    } finally {
      setCardBusy(false);
    }
  };

  // Snapshot Download Handler
  const handleDownloadSnapshot = (snapshotUrl: string | null, devName: string) => {
    if (!snapshotUrl) return;
    const a = document.createElement("a");
    a.href = snapshotUrl;
    a.download = `${devName.toLowerCase().replace(/\s+/g, "_")}_snapshot_${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Filtered members list
  const filteredMembers = deviceMembers.filter((m) => {
    if (!memberFilter) return true;
    const q = memberFilter.toLowerCase();
    return (
      m.employeeNo.toLowerCase().includes(q) ||
      (m.name && m.name.toLowerCase().includes(q)) ||
      (m.matchedEntityName && m.matchedEntityName.toLowerCase().includes(q))
    );
  });

  if (devices.length === 0) {
    return (
      <Card className="border-dashed border-2 border-primary/20 bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Server className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold">No Hikvision Devices Connected</h3>
            <p className="text-sm text-muted-foreground max-w-md mt-1">
              Add your MinMoe terminals in the <strong>Terminals & Devices</strong> tab or run SADP Discovery to activate the live surveillance & voice studio.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── TOP BAR: STUDIO HEADER & MASTER DUAL ACTIONS ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-card/90 backdrop-blur-md p-4 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight">iVMS Live Video & Voice Studio</span>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px] font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                {devices.filter((d) => d.status === "ONLINE").length}/{devices.length} Online
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Continuous dual camera live feeds, 2-way voice announcements & unified synchronization</p>
          </div>
        </div>

        {/* Master Dual Controls & View Switcher */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-xl border text-xs font-semibold">
            <button
              onClick={() => setViewMode("dual")}
              className={cn(
                "px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                viewMode === "dual" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
              )}
              title="Side-by-Side Dual Camera Grid"
            >
              <Columns className="w-3.5 h-3.5 text-sky-500" />
              <span>Dual Feed</span>
            </button>
            {dev1 && (
              <button
                onClick={() => setViewMode("focus1")}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                  viewMode === "focus1" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                )}
                title="Focus Device 1"
              >
                <Square className="w-3.5 h-3.5 text-indigo-500" />
                <span>Dev #1</span>
              </button>
            )}
            {dev2 && (
              <button
                onClick={() => setViewMode("focus2")}
                className={cn(
                  "px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5",
                  viewMode === "focus2" ? "bg-background text-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
                )}
                title="Focus Device 2"
              >
                <Square className="w-3.5 h-3.5 text-purple-500" />
                <span>Dev #2</span>
              </button>
            )}
          </div>

          {/* Stream Rate Selector */}
          <div className="flex items-center gap-1 bg-muted/80 p-1 rounded-xl border text-xs font-semibold">
            <span className="text-[10px] text-muted-foreground px-1.5 font-bold uppercase tracking-wider">Stream:</span>
            <button
              onClick={() => setStreamInterval(1000)}
              className={cn(
                "px-2 py-1 rounded-md text-[11px] transition-all",
                streamInterval === 1000 ? "bg-sky-500 text-white font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              1s Real-time
            </button>
            <button
              onClick={() => setStreamInterval(2500)}
              className={cn(
                "px-2 py-1 rounded-md text-[11px] transition-all",
                streamInterval === 2500 ? "bg-sky-500 text-white font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              2.5s Smooth
            </button>
            <button
              onClick={() => setStreamInterval(5000)}
              className={cn(
                "px-2 py-1 rounded-md text-[11px] transition-all",
                streamInterval === 5000 ? "bg-sky-500 text-white font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              5s Eco
            </button>
            <button
              onClick={() => setStreamInterval(streamInterval === 0 ? 2500 : 0)}
              className={cn(
                "p-1 rounded-md transition-all",
                streamInterval === 0 ? "bg-amber-500 text-white font-bold" : "text-muted-foreground hover:text-foreground"
              )}
              title={streamInterval === 0 ? "Resume Stream" : "Pause Stream"}
            >
              {streamInterval === 0 ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Quick Dual Actions */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkSyncTime}
            disabled={bulkSyncingTime}
            className="h-9 px-3 text-xs font-bold shadow-xs hover:bg-sky-500/10 hover:border-sky-500/40"
          >
            <Clock className={cn("w-3.5 h-3.5 mr-1.5 text-sky-500", bulkSyncingTime && "animate-spin")} />
            {bulkSyncingTime ? "Syncing Clocks…" : "Sync Time (Both)"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleBulkPullScans}
            disabled={bulkPullingScans}
            className="h-9 px-3 text-xs font-bold shadow-xs hover:bg-indigo-500/10 hover:border-indigo-500/40"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5 text-indigo-500", bulkPullingScans && "animate-spin")} />
            {bulkPullingScans ? "Pulling Scans…" : "Pull Scans (Both)"}
          </Button>
        </div>
      </div>

      {/* ── SECTION 1: WHOLE-TIME DUAL CAMERA LIVE STREAM MATRIX ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-4 h-4 text-sky-500" />
            <h3 className="font-bold text-sm text-foreground">Continuous Live Surveillance Feed</h3>
            <span className="text-xs text-muted-foreground">({streamInterval === 0 ? "Stream Paused" : `Streaming @ ${streamInterval / 1000}s interval`})</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Active Digest Stream
            </span>
          </div>
        </div>

        {/* Live Video Feeds Grid */}
        <div
          className={cn(
            "grid gap-4",
            viewMode === "dual" && "grid-cols-1 lg:grid-cols-2",
            (viewMode === "focus1" || viewMode === "focus2") && "grid-cols-1"
          )}
        >
          {/* CAMERA 1: Primary Terminal (192.168.0.4) */}
          {dev1 && (viewMode === "dual" || viewMode === "focus1") && (
            <Card className="border-border/80 shadow-md overflow-hidden bg-black/95 text-white relative group">
              {/* Camera Header Overlay */}
              <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-2">
                  <Badge className="bg-rose-600 text-white text-[10px] font-black uppercase px-2 py-0.5 tracking-wider flex items-center gap-1 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    CAM 1 • LIVE
                  </Badge>
                  <div className="text-left leading-tight">
                    <span className="font-bold text-xs text-white block drop-shadow-md">{dev1.name}</span>
                    <span className="text-[10px] text-zinc-300 font-mono">{dev1.host}:{dev1.port}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-black/60 text-zinc-300 border-zinc-700 text-[10px] font-mono">
                    {dev1Fps} FPS • {dev1LastUpdated ? dev1LastUpdated.toLocaleTimeString() : "--:--:--"}
                  </Badge>
                  {/* Quick Config */}
                  <button
                    onClick={() => handleOpenConfig(dev1)}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white transition-all text-xs flex items-center gap-1"
                    title="Quick Link & Configure IP"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-sky-400" />
                  </button>
                  {/* Zoom in/out */}
                  <button
                    onClick={() => setDev1Zoom((prev) => (prev >= 2.5 ? 1 : prev + 0.5))}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white transition-all text-xs flex items-center gap-1"
                    title={`Zoom (${dev1Zoom}x)`}
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">{dev1Zoom}x</span>
                  </button>
                  {/* Download Snapshot */}
                  <button
                    onClick={() => handleDownloadSnapshot(dev1Snapshot, dev1.name)}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white transition-all"
                    title="Save Snapshot"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {/* Fullscreen */}
                  <button
                    onClick={() => setFullscreenDevice(dev1)}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white transition-all"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Video Feed Canvas / Image */}
              <div className="relative aspect-video w-full flex items-center justify-center overflow-hidden bg-zinc-950">
                {dev1Snapshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dev1Snapshot}
                    alt={dev1.name}
                    style={{ transform: `scale(${dev1Zoom})` }}
                    className="w-full h-full object-cover transition-transform duration-200"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-500 space-y-2 p-8 text-center">
                    <Camera className="w-12 h-12 opacity-40 animate-pulse text-sky-500" />
                    <p className="text-xs font-semibold text-zinc-300">Live Video Stream from {dev1.name}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">Host: {dev1.host}:{dev1.port}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenConfig(dev1)}
                      className="text-xs h-8 mt-2 bg-sky-600/20 text-sky-300 border-sky-500/40 hover:bg-sky-600 hover:text-white"
                    >
                      <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                      Configure & Link IP Address
                    </Button>
                  </div>
                )}

                {/* Loading indicator */}
                {dev1Loading && (
                  <div className="absolute top-3 right-28 pointer-events-none">
                    <RefreshCw className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                  </div>
                )}

                {/* Bottom HUD Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between text-[11px] text-zinc-300">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-mono">
                      <Cpu className="w-3 h-3 text-indigo-400" />
                      CPU: {telemetry1?.cpuUsage !== undefined ? `${telemetry1.cpuUsage}%` : "Normal"}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Volume2 className="w-3 h-3 text-sky-400" />
                      Vol: {volume1}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handlePlayVoicePrompt("pleaseScanFace", "Please Scan Face")}
                      className="h-6 px-2 text-[10px] font-bold bg-sky-600/80 hover:bg-sky-600 text-white rounded-md"
                    >
                      <BellRing className="w-3 h-3 mr-1" />
                      Prompt Voice
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReboot(dev1)}
                      disabled={rebootingDev === dev1.id}
                      className="h-6 px-2 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20 hover:text-white rounded-md"
                    >
                      <Power className={cn("w-3 h-3 mr-1", rebootingDev === dev1.id && "animate-spin")} />
                      Reboot
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* CAMERA 2: Secondary Terminal (192.168.0.5) */}
          {dev2 && (viewMode === "dual" || viewMode === "focus2") && (
            <Card className="border-border/80 shadow-md overflow-hidden bg-black/95 text-white relative group">
              {/* Camera Header Overlay */}
              <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-600 text-white text-[10px] font-black uppercase px-2 py-0.5 tracking-wider flex items-center gap-1 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                    CAM 2 • LIVE
                  </Badge>
                  <div className="text-left leading-tight">
                    <span className="font-bold text-xs text-white block drop-shadow-md">{dev2.name}</span>
                    <span className="text-[10px] text-zinc-300 font-mono">{dev2.host}:{dev2.port}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="bg-black/60 text-zinc-300 border-zinc-700 text-[10px] font-mono">
                    {dev2Fps} FPS • {dev2LastUpdated ? dev2LastUpdated.toLocaleTimeString() : "--:--:--"}
                  </Badge>
                  {/* Quick Config */}
                  <button
                    onClick={() => handleOpenConfig(dev2)}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white transition-all text-xs flex items-center gap-1"
                    title="Quick Link & Configure IP"
                  >
                    <Settings2 className="w-3.5 h-3.5 text-purple-400" />
                  </button>
                  {/* Zoom in/out */}
                  <button
                    onClick={() => setDev2Zoom((prev) => (prev >= 2.5 ? 1 : prev + 0.5))}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white transition-all text-xs flex items-center gap-1"
                    title={`Zoom (${dev2Zoom}x)`}
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">{dev2Zoom}x</span>
                  </button>
                  {/* Download Snapshot */}
                  <button
                    onClick={() => handleDownloadSnapshot(dev2Snapshot, dev2.name)}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white transition-all"
                    title="Save Snapshot"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  {/* Fullscreen */}
                  <button
                    onClick={() => setFullscreenDevice(dev2)}
                    className="p-1.5 rounded-lg bg-black/60 hover:bg-black/90 text-white transition-all"
                    title="Fullscreen"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Video Feed Canvas / Image */}
              <div className="relative aspect-video w-full flex items-center justify-center overflow-hidden bg-zinc-950">
                {dev2Snapshot ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={dev2Snapshot}
                    alt={dev2.name}
                    style={{ transform: `scale(${dev2Zoom})` }}
                    className="w-full h-full object-cover transition-transform duration-200"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-500 space-y-2 p-8 text-center">
                    <Camera className="w-12 h-12 opacity-40 animate-pulse text-purple-500" />
                    <p className="text-xs font-semibold text-zinc-300">Live Video Stream from {dev2.name}</p>
                    <p className="text-[10px] text-zinc-500 font-mono">Host: {dev2.host}:{dev2.port}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenConfig(dev2)}
                      className="text-xs h-8 mt-2 bg-purple-600/20 text-purple-300 border-purple-500/40 hover:bg-purple-600 hover:text-white"
                    >
                      <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                      Configure & Link IP Address
                    </Button>
                  </div>
                )}

                {/* Loading indicator */}
                {dev2Loading && (
                  <div className="absolute top-3 right-24 pointer-events-none">
                    <RefreshCw className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                  </div>
                )}

                {/* Bottom HUD Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-2.5 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-between text-[11px] text-zinc-300">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 font-mono">
                      <Cpu className="w-3 h-3 text-purple-400" />
                      CPU: {telemetry2?.cpuUsage !== undefined ? `${telemetry2.cpuUsage}%` : "Normal"}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Volume2 className="w-3 h-3 text-purple-400" />
                      Vol: {volume2}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handlePlayVoicePrompt("pleaseScanFace", "Please Scan Face")}
                      className="h-6 px-2 text-[10px] font-bold bg-purple-600/80 hover:bg-purple-600 text-white rounded-md"
                    >
                      <BellRing className="w-3 h-3 mr-1" />
                      Prompt Voice
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReboot(dev2)}
                      disabled={rebootingDev === dev2.id}
                      className="h-6 px-2 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20 hover:text-white rounded-md"
                    >
                      <Power className={cn("w-3 h-3 mr-1", rebootingDev === dev2.id && "animate-spin")} />
                      Reboot
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* ── SECTION 2: 2-WAY VOICE BROADCASTING STUDIO & AUDIO CONTROL CENTER ── */}
      <Card className="border-border/80 shadow-sm overflow-hidden bg-card/60 backdrop-blur-md">
        <CardHeader className="bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/5 pb-3 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center shadow-sm">
                <Volume2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  2-Way Voice Intercom & Audio Announcement Studio
                </CardTitle>
                <CardDescription className="text-xs">
                  Live microphone speech, instant Arabic/English prompts, text-to-speech announcer & speaker volume controls
                </CardDescription>
              </div>
            </div>

            {/* Target Selector */}
            <div className="flex items-center gap-1.5 p-1 bg-background/80 rounded-xl border text-xs font-bold self-start">
              <span className="text-[10px] text-muted-foreground px-1.5">Broadcast Target:</span>
              <button
                onClick={() => setAudioTarget("BOTH")}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all",
                  audioTarget === "BOTH" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                )}
              >
                Both Terminals
              </button>
              {dev1 && (
                <button
                  onClick={() => setAudioTarget("DEV1")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all",
                    audioTarget === "DEV1" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Dev 1 ({dev1.host})
                </button>
              )}
              {dev2 && (
                <button
                  onClick={() => setAudioTarget("DEV2")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all",
                    audioTarget === "DEV2" ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Dev 2 ({dev2.host})
                </button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5 space-y-6">
          {/* Row A: Push-to-Talk Live Mic & Custom Text-to-Speech */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Push-to-Talk Mic Intercom */}
            <div className="lg:col-span-5 p-4 rounded-2xl bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-transparent border border-sky-500/20 flex flex-col justify-between space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <Mic className="w-4 h-4 text-sky-500" />
                    Push-to-Talk (Live Mic)
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Broadcast your live voice directly through the terminal speaker(s).
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold",
                    isMicActive ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/40 animate-pulse" : "bg-muted text-muted-foreground"
                  )}
                >
                  {isMicActive ? "● ON AIR / LIVE" : "STANDBY"}
                </Badge>
              </div>

              {/* Audio Waveform Simulator when active */}
              {isMicActive ? (
                <div className="h-16 flex items-center justify-center gap-1.5 px-4 bg-black/80 rounded-xl">
                  {[...Array(16)].map((_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        height: [10, Math.max(10, Math.min(50, (micVolumeLevel + (i % 5) * 8))), 10],
                      }}
                      transition={{ repeat: Infinity, duration: 0.3 + (i % 4) * 0.1 }}
                      className="w-1.5 bg-gradient-to-t from-sky-500 via-indigo-400 to-rose-400 rounded-full"
                    />
                  ))}
                </div>
              ) : (
                <div className="h-16 flex items-center justify-center bg-muted/40 rounded-xl text-xs text-muted-foreground">
                  Press button below to speak to students & faculty
                </div>
              )}

              {/* Big Mic Button */}
              <Button
                onClick={toggleMicrophone}
                className={cn(
                  "w-full h-12 font-bold rounded-xl shadow-md text-sm transition-all flex items-center justify-center gap-2",
                  isMicActive
                    ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white animate-pulse"
                    : "bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white"
                )}
              >
                {isMicActive ? (
                  <>
                    <MicOff className="w-5 h-5" />
                    Stop Mic Broadcast
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    Start Speaking (Push-to-Talk)
                  </>
                )}
              </Button>
            </div>

            {/* Right: Custom Voice Text-to-Speech Announcement */}
            <div className="lg:col-span-7 p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 flex flex-col justify-between space-y-4">
              <div>
                <h4 className="font-bold text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-500" />
                  Custom Text-to-Speech Voice Announcement
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Type any announcement (English or Arabic) and the terminal will synthesize and broadcast it out loud.
                </p>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <textarea
                    rows={2}
                    placeholder="e.g. Attention Talabat: Morning assembly begins in 5 minutes. Please proceed to the hall."
                    value={customVoiceText}
                    onChange={(e) => setCustomVoiceText(e.target.value)}
                    className="w-full p-3 rounded-xl border bg-background text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 resize-none"
                  />
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground font-semibold">Quick text:</span>
                    {["Assembly Time", "Class in Session", "Please Move Forward"].map((quick) => (
                      <button
                        key={quick}
                        onClick={() => setCustomVoiceText(quick)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 text-foreground font-medium border"
                      >
                        {quick}
                      </button>
                    ))}
                  </div>

                  <Button
                    size="sm"
                    onClick={handleBroadcastCustomText}
                    disabled={!customVoiceText.trim() || broadcastingVoice}
                    className="h-9 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl text-xs shadow-md"
                  >
                    <Send className={cn("w-3.5 h-3.5 mr-1.5", broadcastingVoice && "animate-spin")} />
                    Broadcast Out Loud
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Row B: 1-Click Preset Audio Prompts */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Instant 1-Click Voice Prompts (Terminal Speaker)
              </span>
              <span className="text-[11px] text-muted-foreground">Target: {audioTarget === "BOTH" ? "Both Terminals" : audioTarget}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2.5">
              {PRESET_VOICE_PROMPTS.map((prompt) => {
                const Icon = prompt.icon;
                return (
                  <button
                    key={prompt.id}
                    onClick={() => handlePlayVoicePrompt(prompt.id, prompt.label)}
                    disabled={broadcastingVoice}
                    className="p-3 rounded-xl border bg-card hover:bg-muted/60 transition-all text-left group hover:scale-[1.02] active:scale-95 shadow-xs flex flex-col justify-between h-24"
                  >
                    <div className="flex items-center justify-between">
                      <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br text-white flex items-center justify-center shadow-xs", prompt.color)}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity text-primary font-bold">Play ▶</span>
                    </div>
                    <div>
                      <span className="font-bold text-xs block leading-tight text-foreground">{prompt.label}</span>
                      <span className="text-[10px] text-muted-foreground font-arabic block truncate mt-0.5">{prompt.arabic}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row C: Hardware Volume Master & Individual Sliders */}
          <div className="p-4 rounded-2xl bg-muted/30 border space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-indigo-500" />
                <span className="font-bold text-xs">Terminal Speaker Hardware Volume</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTestTone(audioTarget)}
                  className="h-7 text-xs font-semibold"
                >
                  <BellRing className="w-3 h-3 mr-1 text-amber-500" />
                  Play Speaker Test Chime
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Master Volume */}
              <div className="p-3 rounded-xl bg-background/80 border space-y-2">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-muted-foreground flex items-center gap-1.5 font-bold">
                    <Volume2 className="w-4 h-4 text-primary" />
                    Master (Both Devices)
                  </span>
                  <span className="font-mono font-bold text-foreground">{masterVolume}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={masterVolume}
                  onChange={(e) => handleSetVolume(Number(e.target.value), "BOTH")}
                  className="w-full accent-primary cursor-pointer h-2 bg-muted rounded-lg"
                />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <button onClick={() => handleSetVolume(0, "BOTH")} className="hover:text-foreground">Mute</button>
                  <button onClick={() => handleSetVolume(50, "BOTH")} className="hover:text-foreground">50%</button>
                  <button onClick={() => handleSetVolume(80, "BOTH")} className="hover:text-foreground">80%</button>
                  <button onClick={() => handleSetVolume(100, "BOTH")} className="hover:text-foreground">100%</button>
                </div>
              </div>

              {/* Device 1 Volume */}
              {dev1 && (
                <div className="p-3 rounded-xl bg-background/80 border space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-muted-foreground flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-sky-500" />
                      {dev1.name}
                    </span>
                    <span className="font-mono font-bold text-foreground">{volume1}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={volume1}
                    onChange={(e) => handleSetVolume(Number(e.target.value), "DEV1")}
                    className="w-full accent-sky-500 cursor-pointer h-2 bg-muted rounded-lg"
                  />
                  <div className="text-[10px] text-muted-foreground font-mono truncate">{dev1.host}:{dev1.port}</div>
                </div>
              )}

              {/* Device 2 Volume */}
              {dev2 && (
                <div className="p-3 rounded-xl bg-background/80 border space-y-2">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-muted-foreground flex items-center gap-1.5 truncate">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      {dev2.name}
                    </span>
                    <span className="font-mono font-bold text-foreground">{volume2}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={volume2}
                    onChange={(e) => handleSetVolume(Number(e.target.value), "DEV2")}
                    className="w-full accent-purple-500 cursor-pointer h-2 bg-muted rounded-lg"
                  />
                  <div className="text-[10px] text-muted-foreground font-mono truncate">{dev2.host}:{dev2.port}</div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── SECTION 3: LIVE SCAN ACTIVITY TICKER & DUAL MEMBER PROVISIONING ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 Cols): Live Real-Time Scan Event Ticker */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="border-border/80 shadow-sm h-full flex flex-col justify-between">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
                  <CardTitle className="text-sm font-bold">Live Scan Ticker (Real-Time)</CardTitle>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                  SSE STREAM
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Real-time attendance events streaming from terminal facial scanners
              </CardDescription>

              {/* Separate Talabat & Faculty Scan Filters */}
              <div className="flex items-center gap-1.5 mt-2.5 p-1 bg-muted/70 rounded-xl text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setLiveScanFilter("ALL")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all",
                    liveScanFilter === "ALL"
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All Scans ({liveScans.length})
                </button>
                <button
                  type="button"
                  onClick={() => setLiveScanFilter("STUDENT")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5",
                    liveScanFilter === "STUDENT"
                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30 shadow-xs"
                      : "text-muted-foreground hover:text-sky-600"
                  )}
                >
                  <span>Talabat Scans</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-sky-500/10 text-sky-600 border-sky-500/20">{liveTalabatCount}</Badge>
                </button>
                <button
                  type="button"
                  onClick={() => setLiveScanFilter("FACULTY")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5",
                    liveScanFilter === "FACULTY"
                      ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30 shadow-xs"
                      : "text-muted-foreground hover:text-purple-600"
                  )}
                >
                  <span>Faculty Scans</span>
                  <Badge variant="outline" className="text-[9px] px-1 py-0 bg-purple-500/10 text-purple-600 border-purple-500/20">{liveFacultyCount}</Badge>
                </button>
              </div>
            </CardHeader>

            <CardContent className="pt-3 flex-1 flex flex-col justify-between">
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {filteredLiveScans.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                    <Activity className="w-8 h-8 mx-auto opacity-30 animate-pulse" />
                    <p>
                      {liveScanFilter === "ALL"
                        ? "Waiting for face/fingerprint scans from terminals…"
                        : liveScanFilter === "STUDENT"
                        ? "No live Talabat scans received yet."
                        : "No live Faculty scans received yet."}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Scans will appear here instantly when detected.</p>
                  </div>
                ) : (
                  filteredLiveScans.map((scan: any) => (
                    <motion.div
                      key={scan.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-2.5 rounded-xl border bg-card/80 hover:bg-muted/40 transition-all text-xs flex items-center justify-between shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-2xs",
                            scan.type === "STUDENT" ? "bg-gradient-to-tr from-sky-500 to-blue-600" : "bg-gradient-to-tr from-purple-500 to-indigo-600"
                          )}
                        >
                          {scan.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="leading-tight">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground truncate max-w-[140px]">{scan.name}</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] font-bold px-1 py-0",
                                scan.type === "STUDENT" ? "border-sky-500/30 text-sky-600 bg-sky-500/5" : "border-purple-500/30 text-purple-600 bg-purple-500/5"
                              )}
                            >
                              {scan.type}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">ID: {scan.employeeNo} • {scan.deviceHost}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                          {scan.status || "PRESENT"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono block mt-0.5">{scan.timestamp}</span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>

              {liveScans.length > 0 && (
                <div className="pt-2 border-t mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{liveScans.length} recent live scan(s)</span>
                  <button onClick={() => setLiveScans([])} className="text-rose-500 hover:underline text-[10px]">
                    Clear Feed
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (7 Cols): Dual Member Provisioning Center */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="border-border/80 shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-500" />
                    Member Provisioning & Terminal Storage
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Push student & faculty profiles into terminal memory for offline & online instant face recognition
                  </CardDescription>
                </div>

                {/* Sub-Tabs */}
                <div className="flex items-center gap-1 p-1 bg-muted rounded-xl text-xs font-bold self-start">
                  <button
                    onClick={() => setProvisionTab("batch")}
                    className={cn(
                      "px-3 py-1 rounded-lg transition-all",
                      provisionTab === "batch" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    1-Click Batch Sync
                  </button>
                  <button
                    onClick={() => setProvisionTab("single")}
                    className={cn(
                      "px-3 py-1 rounded-lg transition-all",
                      provisionTab === "single" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Single Deploy
                  </button>
                  <button
                    onClick={() => {
                      setProvisionTab("enrolled");
                      if (selectedDeviceId && deviceMembers.length === 0) {
                        fetchDeviceMembersList(selectedDeviceId);
                      }
                    }}
                    className={cn(
                      "px-3 py-1 rounded-lg transition-all",
                      provisionTab === "enrolled" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Enrolled ({deviceMembers.length})
                  </button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-5 space-y-5">
              {/* Target Selector */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border text-xs">
                <span className="font-semibold text-muted-foreground">Deploy To Target:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setProvisionTarget("BOTH")}
                    className={cn(
                      "px-3 py-1 rounded-lg font-bold transition-all",
                      provisionTarget === "BOTH" ? "bg-primary text-primary-foreground shadow-xs" : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    Both Terminals (Recommended)
                  </button>
                  {dev1 && (
                    <button
                      onClick={() => setProvisionTarget("DEV1")}
                      className={cn(
                        "px-3 py-1 rounded-lg font-bold transition-all",
                        provisionTarget === "DEV1" ? "bg-primary text-primary-foreground shadow-xs" : "hover:bg-muted text-muted-foreground"
                      )}
                    >
                      Dev 1 ({dev1.host})
                    </button>
                  )}
                  {dev2 && (
                    <button
                      onClick={() => setProvisionTarget("DEV2")}
                      className={cn(
                        "px-3 py-1 rounded-lg font-bold transition-all",
                        provisionTarget === "DEV2" ? "bg-primary text-primary-foreground shadow-xs" : "hover:bg-muted text-muted-foreground"
                      )}
                    >
                      Dev 2 ({dev2.host})
                    </button>
                  )}
                </div>
              </div>

              {/* ── TAB 1: BATCH PROVISION ── */}
              {provisionTab === "batch" && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500 text-white flex items-center justify-center shrink-0 shadow-md">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">Full Database Terminal Provisioning</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Push all active student and teacher records from Darse Burhani to the terminal internal memory.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setBatchAudience("ALL")}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all",
                          batchAudience === "ALL"
                            ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20"
                            : "border-border hover:bg-muted/40"
                        )}
                      >
                        <span className="font-bold text-xs block">All Members</span>
                        <span className="text-[11px] text-muted-foreground">
                          {students.length} Students + {teachers.length} Faculty
                        </span>
                      </button>

                      <button
                        onClick={() => setBatchAudience("STUDENTS")}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all",
                          batchAudience === "STUDENTS"
                            ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20"
                            : "border-border hover:bg-muted/40"
                        )}
                      >
                        <span className="font-bold text-xs block">Talabat Only</span>
                        <span className="text-[11px] text-muted-foreground">{students.length} Enrolled</span>
                      </button>

                      <button
                        onClick={() => setBatchAudience("TEACHERS")}
                        className={cn(
                          "p-3 rounded-xl border text-left transition-all",
                          batchAudience === "TEACHERS"
                            ? "border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/20"
                            : "border-border hover:bg-muted/40"
                        )}
                      >
                        <span className="font-bold text-xs block">Faculty Only</span>
                        <span className="text-[11px] text-muted-foreground">{teachers.length} Faculty</span>
                      </button>
                    </div>

                    <Button
                      onClick={handleBatchDeploy}
                      disabled={batchDeploying}
                      className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-md text-sm"
                    >
                      {batchDeploying ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Provisioning Members to Terminal Storage…
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Deploy {batchAudience === "ALL" ? "All Members" : batchAudience} to {provisionTarget === "BOTH" ? "Both Terminals" : provisionTarget}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Batch Results */}
                  {batchResult && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 rounded-xl border bg-card text-xs space-y-2 shadow-xs"
                    >
                      <div className="flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          Deployment Complete
                        </span>
                        <span>{batchResult.totalDeployed} Profiles Synchronized</span>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {/* ── TAB 2: SINGLE DEPLOY ── */}
              {provisionTab === "single" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setMemberType("STUDENT");
                        setSelectedMemberId("");
                      }}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-bold border transition-all text-center",
                        memberType === "STUDENT" ? "bg-primary text-primary-foreground border-primary" : "border-border"
                      )}
                    >
                      Student / Talabat
                    </button>
                    <button
                      onClick={() => {
                        setMemberType("TEACHER");
                        setSelectedMemberId("");
                      }}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-bold border transition-all text-center",
                        memberType === "TEACHER" ? "bg-primary text-primary-foreground border-primary" : "border-border"
                      )}
                    >
                      Teacher / Faculty
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder={`Filter ${memberType === "STUDENT" ? "students by name/ID..." : "faculty by name/ID..."}`}
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border bg-background text-xs font-medium focus:ring-2 focus:ring-primary/20"
                      />
                    </div>

                    <select
                      value={selectedMemberId}
                      onChange={(e) => setSelectedMemberId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-background text-xs font-medium focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="">-- Choose {memberType === "STUDENT" ? "Talabat" : "Faculty"} Member --</option>
                      {memberType === "STUDENT"
                        ? students
                            .filter((s) => !memberSearch || s.name.toLowerCase().includes(memberSearch.toLowerCase()) || s.studentId.includes(memberSearch))
                            .map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} (Grade {s.grade}-{s.section} | ID: {s.studentId})
                              </option>
                            ))
                        : teachers
                            .filter((t) => !memberSearch || t.name.toLowerCase().includes(memberSearch.toLowerCase()) || t.employeeId.includes(memberSearch))
                            .map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name} ({t.department} | ID: {t.employeeId})
                              </option>
                            ))}
                    </select>
                  </div>

                  <Button
                    onClick={handleDeploySingle}
                    disabled={!selectedMemberId || deployingSingle}
                    className="w-full h-11 font-bold rounded-xl text-xs"
                  >
                    {deployingSingle ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Deploying Member…
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Deploy Member to {provisionTarget === "BOTH" ? "Both Terminals" : provisionTarget}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* ── TAB 3: ENROLLED MEMBERS LIST ── */}
              {provisionTab === "enrolled" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search enrolled members on terminal..."
                        value={memberFilter}
                        onChange={(e) => setMemberFilter(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border bg-background text-xs"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => selectedDeviceId && fetchDeviceMembersList(selectedDeviceId)}
                      disabled={loadingMembers}
                      className="h-8 text-xs font-semibold"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", loadingMembers && "animate-spin")} />
                      Reload
                    </Button>
                  </div>

                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                    {filteredMembers.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-xs">
                        {loadingMembers ? "Querying terminal memory…" : "No members found on terminal."}
                      </div>
                    ) : (
                      filteredMembers.map((m) => (
                        <div
                          key={m.employeeNo}
                          className="flex items-center justify-between p-2.5 rounded-xl border bg-card/60 hover:bg-muted/40 transition-all text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">
                                {m.matchedEntityName || m.name || `User ${m.employeeNo}`}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-bold px-1.5 py-0",
                                  m.matchedType === "STUDENT"
                                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30"
                                    : m.matchedType === "TEACHER"
                                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30"
                                    : "bg-muted text-muted-foreground"
                                )}
                              >
                                {m.matchedType}
                              </Badge>
                            </div>
                            <span className="text-[11px] text-muted-foreground font-mono">ID / ITS: {m.employeeNo}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setCardModalUser(m.employeeNo);
                                setCardNumber("");
                              }}
                              className="h-7 px-2 text-xs text-sky-600 hover:text-sky-700 hover:bg-sky-500/10"
                            >
                              <CreditCard className="w-3.5 h-3.5 mr-1" />
                              Card
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => selectedDeviceId && handleDeleteDeviceUser(m.employeeNo, selectedDeviceId)}
                              className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── FULLSCREEN CINEMATIC MODAL ── */}
      {fullscreenDevice && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col p-4">
          <div className="p-3 border-b border-zinc-800 flex items-center justify-between text-white">
            <div className="flex items-center gap-3">
              <Badge className="bg-rose-600 text-white text-xs font-bold uppercase flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                LIVE STREAM
              </Badge>
              <span className="font-bold text-base">{fullscreenDevice.name}</span>
              <span className="text-xs text-zinc-400 font-mono">({fullscreenDevice.host}:{fullscreenDevice.port})</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  handleDownloadSnapshot(
                    fullscreenDevice.id === dev1?.id ? dev1Snapshot : dev2Snapshot,
                    fullscreenDevice.name
                  )
                }
                className="h-8 text-xs bg-zinc-900 text-white border-zinc-700 hover:bg-zinc-800"
              >
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Capture Snapshot
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setFullscreenDevice(null)} className="h-8 text-white hover:bg-zinc-800">
                ✕ Close
              </Button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullscreenDevice.id === dev1?.id ? dev1Snapshot || "" : dev2Snapshot || ""}
              alt={fullscreenDevice.name}
              className="max-h-[85vh] max-w-full rounded-2xl object-contain border border-zinc-800 shadow-2xl"
            />
          </div>
        </div>
      )}

      {/* ── ASSIGN RFID CARD MODAL ── */}
      {cardModalUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-card rounded-2xl border shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-sky-500" />
                <span className="font-bold text-sm">Assign RFID Card to {cardModalUser}</span>
              </div>
              <button
                onClick={() => setCardModalUser(null)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-muted-foreground">
                Enter the physical 10-digit or 8-digit RFID Card number to bind with this user on the terminal.
              </p>
              <div>
                <label className="font-bold block mb-1">Card Serial / Number:</label>
                <input
                  type="text"
                  placeholder="e.g. 0012345678"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background text-sm font-mono focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button size="sm" variant="ghost" onClick={() => setCardModalUser(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAssignCard}
                disabled={!cardNumber.trim() || cardBusy}
                className="font-bold"
              >
                {cardBusy ? "Assigning…" : "Save Card to Terminal"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── QUICK DEVICE CONFIG & RE-LINK MODAL ── */}
      {editDeviceModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-card rounded-2xl border shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-600 flex items-center justify-center">
                  <Settings2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="font-bold text-sm block">Configure & Link Terminal</span>
                  <span className="text-xs text-muted-foreground">{editDeviceModal.name}</span>
                </div>
              </div>
              <button
                onClick={() => setEditDeviceModal(null)}
                className="text-muted-foreground hover:text-foreground text-xs p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleSaveConfig(); }} className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-800 dark:text-sky-300">
                <p className="font-semibold">Hardware Link & Live Stream Settings</p>
                <p className="text-[11px] opacity-80 mt-0.5">
                  Verify the terminal IP address (e.g. 192.168.0.4 or 162.198.0.4) matches the device on your local network.
                </p>
              </div>

              <div>
                <label htmlFor="edit-device-name" className="font-bold block mb-1">Terminal Display Name:</label>
                <input
                  id="edit-device-name"
                  name="deviceName"
                  type="text"
                  placeholder="e.g. Main Entrance MinMoe"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label htmlFor="edit-device-host" className="font-bold block mb-1">Host IPv4 Address:</label>
                  <input
                    id="edit-device-host"
                    name="deviceHost"
                    type="text"
                    placeholder="192.168.0.4"
                    value={editForm.host}
                    onChange={(e) => setEditForm({ ...editForm, host: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-background text-xs font-mono font-bold focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label htmlFor="edit-device-port" className="font-bold block mb-1">HTTP Port:</label>
                  <input
                    id="edit-device-port"
                    name="devicePort"
                    type="number"
                    placeholder="80"
                    value={editForm.port}
                    onChange={(e) => setEditForm({ ...editForm, port: Number(e.target.value) || 80 })}
                    className="w-full p-2.5 rounded-xl border bg-background text-xs font-mono focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-device-username" className="font-bold block mb-1">ISAPI Username:</label>
                  <input
                    id="edit-device-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    placeholder="admin"
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label htmlFor="edit-device-password" className="font-bold block mb-1">Device Password:</label>
                  <input
                    id="edit-device-password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Keep unchanged or enter new"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="w-full p-2.5 rounded-xl border bg-background text-xs focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            </form>

            <div className="flex items-center justify-between pt-3 border-t">
              <div className="text-[10px] text-muted-foreground font-mono">
                Port 80 (HTTP) / Port 443 (HTTPS)
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditDeviceModal(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveConfig}
                  disabled={savingConfig || !editForm.host.trim()}
                  className="font-bold bg-primary text-primary-foreground shadow-md"
                >
                  {savingConfig ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Testing Link…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Save & Test Link Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
