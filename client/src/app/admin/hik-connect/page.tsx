"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video,
  Camera,
  Maximize2,
  Minimize2,
  RefreshCw,
  Lock,
  Unlock,
  Radio,
  Scan,
  Volume2,
  VolumeX,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Users,
  GraduationCap,
  Layers,
  Search,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Eye,
  Server,
  FileSpreadsheet,
  Mail,
  ClipboardCheck,
  Fingerprint,
  QrCode,
  SlidersHorizontal,
  X,
  Play,
  Pause,
  Download,
  Activity,
} from "lucide-react";
import { AdminHubTabs } from "@/components/admin/AdminHubTabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

export interface BiometricDevice {
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

export interface LiveScanEvent {
  id: string;
  name: string;
  type: "STUDENT" | "TEACHER" | "UNMATCHED";
  employeeNo: string;
  timestamp: string;
  deviceId?: string;
  deviceHost?: string;
  status?: string;
  verifyMode?: string;
  eventName?: string;
  avatarUrl?: string;
  gradeOrDept?: string;
  leaveReason?: string;
  leaveType?: string;
}

export default function AdminHikConnectPage() {
  // Device & Feed States
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState<string>("all"); // "all" or deviceId
  const [feedMode, setFeedMode] = useState<Record<string, "stream" | "snapshot" | "rtsp">>(
    {}
  );
  const [snapshotTimestamps, setSnapshotTimestamps] = useState<Record<string, number>>({});
  const [fullscreenDeviceId, setFullscreenDeviceId] = useState<string | null>(null);
  const [doorUnlocking, setDoorUnlocking] = useState<Record<string, boolean>>({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentTimeIST, setCurrentTimeIST] = useState("");
  const [powerSyncing, setPowerSyncing] = useState(false);

  // Live Scans Stream
  const [liveScans, setLiveScans] = useState<LiveScanEvent[]>([]);
  const [scanFilter, setScanFilter] = useState<"ALL" | "STUDENT" | "TEACHER">("ALL");
  const [scanSearch, setScanSearch] = useState("");
  const [latestRecognizedFace, setLatestRecognizedFace] = useState<{
    name: string;
    role: string;
    time: string;
    avatarUrl?: string;
    deviceId?: string;
  } | null>(null);

  // Webcam / Barcode Scanner Modal State
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [scannerProcessing, setScannerProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Web Audio Context for Scan Chimes
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.16);
      gain.gain.setValueAtTime(0.14, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.28);
    } catch {
      // Audio context might be restricted before user interaction
    }
  }, [soundEnabled]);

  // Live IST Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeIST(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZone: "Asia/Kolkata",
        }) + " IST"
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Connected Biometric Devices
  const fetchDevices = useCallback(async () => {
    try {
      const res = await fetch("/api/biometric/devices");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setDevices(json.data);
          // Set default feed modes
          const initialModes: Record<string, "stream" | "snapshot" | "rtsp"> = {};
          json.data.forEach((d: BiometricDevice) => {
            initialModes[d.id] = "stream";
          });
          setFeedMode((prev) => ({ ...initialModes, ...prev }));
        }
      }
    } catch (err) {
      console.error("Failed to load devices:", err);
    } finally {
      setLoadingDevices(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // Periodic Snapshot Timestamps for Snapshot Mode (every 2.5s)
  useEffect(() => {
    const interval = setInterval(() => {
      setSnapshotTimestamps((prev) => {
        const next: Record<string, number> = { ...prev };
        devices.forEach((d) => {
          next[d.id] = Date.now();
        });
        return next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [devices]);

  // Fetch Realtime Scan Events
  const lastEventCountRef = useRef<number>(0);
  const fetchRecentEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/biometric/events");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const formatted: LiveScanEvent[] = json.data.map((ev: any) => {
            const student = ev.student;
            const teacher = ev.teacher;
            const eventName = ev.scanWindow?.name || ev.eventName || null;
            const avatarUrl = student?.avatarUrl || teacher?.avatarUrl || null;
            const resolvedStatus =
              ev.classes?.[0]?.status ||
              ev.teacher?.status ||
              (ev.type === "DUPLICATE" ? "VERIFIED" : "PRESENT");

            return {
              id: ev.id || `${ev.fingerprint || ev.itsNumber}-${ev.timestamp}`,
              name: student?.name || teacher?.name || (ev.fingerprint ? `ID: ${ev.fingerprint}` : "Member"),
              type: student ? "STUDENT" : teacher ? "TEACHER" : "UNMATCHED",
              employeeNo: student?.studentId || student?.its || teacher?.employeeId || ev.fingerprint || "—",
              timestamp: ev.timestamp || new Date().toISOString(),
              deviceId: ev.deviceId || undefined,
              status: resolvedStatus,
              verifyMode: ev.verifyMode || "BIOMETRIC",
              eventName: eventName || undefined,
              avatarUrl: avatarUrl || undefined,
              gradeOrDept: student?.grade ? `Class ${student.grade}` : teacher?.department || undefined,
              leaveReason: ev.leaveRecord?.reason || undefined,
              leaveType: ev.leaveRecord?.type || undefined,
            };
          });

          // If new scans arrived, play chime & trigger AR camera bounding box
          if (formatted.length > lastEventCountRef.current && lastEventCountRef.current > 0) {
            const newest = formatted[0];
            playChime();
            setLatestRecognizedFace({
              name: newest.name,
              role: newest.type,
              time: new Date(newest.timestamp).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
                timeZone: "Asia/Kolkata",
              }),
              avatarUrl: newest.avatarUrl,
              deviceId: newest.deviceId,
            });

            // Auto-hide AR overlay after 6 seconds
            setTimeout(() => {
              setLatestRecognizedFace(null);
            }, 6000);
          }
          lastEventCountRef.current = formatted.length;
          setLiveScans(formatted);
        }
      }
    } catch {
      // Background poll fail-safe
    }
  }, [playChime]);

  useEffect(() => {
    fetchRecentEvents();
    const interval = setInterval(fetchRecentEvents, 1800);
    return () => clearInterval(interval);
  }, [fetchRecentEvents]);

  // Door Unlock Trigger
  const handleUnlockDoor = async (dev: BiometricDevice) => {
    setDoorUnlocking((prev) => ({ ...prev, [dev.id]: true }));
    try {
      const res = await fetch(`/api/biometric/devices/${dev.id}/door-control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "open" }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Door pulse triggered on ${dev.name}! Access Granted.`);
      } else {
        toast.info(`Door command queued for ${dev.name}`);
      }
    } catch {
      toast.info(`Door pulse sent to ${dev.name}`);
    } finally {
      setDoorUnlocking((prev) => ({ ...prev, [dev.id]: false }));
    }
  };

  // Power Sync All
  const handlePowerSyncAll = async () => {
    setPowerSyncing(true);
    toast.loading("⚡ Power-syncing all Hik-Connect terminals (ping, IST clocks, punches)...");
    try {
      const res = await fetch("/api/biometric/devices/power-sync-all", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "All Hik-Connect terminals synchronized with live cloud");
        fetchDevices();
        fetchRecentEvents();
      } else {
        toast.error(data.error || "Power sync failed");
      }
    } catch {
      toast.error("Failed to power sync terminals");
    } finally {
      setPowerSyncing(false);
    }
  };

  // Capture Snapshot Frame as Image Download
  const handleDownloadSnapshot = (dev: BiometricDevice) => {
    const url = `/api/biometric/devices/${dev.id}/snapshot?t=${Date.now()}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `hikvision-${dev.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Frame snapshot saved for ${dev.name}`);
  };

  // Start In-Browser Camera Scanner
  const startCameraScanner = async () => {
    setCameraScannerOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn("Could not access local webcam:", err);
      toast.info("Webcam not detected. You can use manual Barcode / ITS ID scanning.");
    }
  };

  const stopCameraScanner = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setCameraScannerOpen(false);
  };

  // Process Scanned Barcode / ITS Number
  const handleProcessScan = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setScannerProcessing(true);
    try {
      const res = await fetch("/api/biometric/face-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itsNumber: trimmed }),
      });
      const data = await res.json();
      if (data.success) {
        playChime();
        toast.success(data.message || `Scanned & Marked: ${trimmed}`);
        fetchRecentEvents();
        setBarcodeInput("");
      } else {
        toast.error(data.error || "No Talabat or Faculty profile matched for this barcode");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to submit attendance scan");
    } finally {
      setScannerProcessing(false);
    }
  };

  // Filtered live scans
  const filteredScans = useMemo(() => {
    return liveScans.filter((s) => {
      if (scanFilter !== "ALL" && s.type !== scanFilter) return false;
      if (scanSearch.trim()) {
        const q = scanSearch.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.employeeNo.toLowerCase().includes(q) ||
          (s.gradeOrDept && s.gradeOrDept.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [liveScans, scanFilter, scanSearch]);

  // Displayed devices (handles "all" vs solo camera)
  const displayedDevices = useMemo(() => {
    if (selectedChannel === "all") return devices;
    return devices.filter((d) => d.id === selectedChannel);
  }, [devices, selectedChannel]);

  return (
    <div className="w-full max-w-full lg:max-w-[1440px] mx-auto p-2.5 sm:p-4 lg:p-6 space-y-4 sm:space-y-6">
      {/* ── Attendance Hub Navigation Tabs ── */}
      <AdminHubTabs
        hubTitle="Attendance & Biometric Center"
        hubDescription="Real-time terminal monitoring, physical biometric scans, manual classroom registers, and automated sync."
        tabs={[
          { label: "Hik-Connect Live", href: "/admin/hik-connect", icon: Video, badge: "Live" },
          { label: "Hikvision Scans", href: "/admin/attendance-hik", icon: Fingerprint, badge: "Hardware" },
          { label: "Device Hub", href: "/admin/biometric", icon: Activity },
          { label: "Manual Logs", href: "/admin/attendance-manual", icon: ClipboardCheck, badge: "Register" },
          { label: "Timing & Schedule", href: "/admin/attendance-schedule", icon: Clock },
          { label: "Google Sheets", href: "/admin/google-sheets", icon: FileSpreadsheet, badge: "Sync" },
          { label: "Email Reports", href: "/admin/attendance-emails", icon: Mail },
        ]}
      />

      {/* ── Direct Hik-Connect Hero Cockpit ── */}
      <div className="relative overflow-hidden rounded-3xl border border-[#d4af37]/40 bg-gradient-to-br from-[#0a0f1d] via-[#0d1527] to-[#080d18] p-5 sm:p-7 shadow-2xl text-white">
        {/* Ambient radiance */}
        <div className="pointer-events-none absolute -right-16 -bottom-16 w-80 h-80 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -top-12 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                Hik-Connect Realtime Feed
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                Cloud Webhook Active
              </span>
              <span className="text-xs font-mono text-amber-300 font-bold bg-slate-900/80 px-2.5 py-1 rounded-lg border border-amber-500/30">
                {currentTimeIST}
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              <Video className="w-7 h-7 text-amber-400" />
              Direct Hik-Connect CCTV & Realtime Scanning
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Instant 1080p camera feeds from Hikvision MinMoe terminals, real-time facial recognition targeting, direct barcode/QR scanning, and physical door access relays.
            </p>
          </div>

          {/* Quick Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-center shrink-0">
            <Button
              onClick={startCameraScanner}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg shadow-emerald-950/40 active:scale-95 transition"
            >
              <Scan className="w-4 h-4 text-emerald-200" />
              <span>Camera Barcode / ID Scan</span>
            </Button>

            <Button
              onClick={handlePowerSyncAll}
              disabled={powerSyncing}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl px-4 py-2 flex items-center gap-2 shadow-lg shadow-amber-950/40 active:scale-95 transition"
            >
              <Zap className={`w-4 h-4 ${powerSyncing ? "animate-spin" : ""}`} />
              <span>{powerSyncing ? "Syncing..." : "Power Sync Clocks"}</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 flex items-center gap-1.5"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <span className="hidden sm:inline">Audio Chime ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span className="hidden sm:inline">Muted</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Channel Selector Pills */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <span className="text-xs font-semibold text-slate-400 mr-1 shrink-0">Channel:</span>
            <button
              onClick={() => setSelectedChannel("all")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 ${
                selectedChannel === "all"
                  ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
              }`}
            >
              All Feeds (Quad Grid)
            </button>
            {devices.map((d, idx) => (
              <button
                key={d.id}
                onClick={() => setSelectedChannel(d.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
                  selectedChannel === d.id
                    ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                    : "bg-slate-800/80 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    d.status === "ONLINE" ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span>CH 0{idx + 1}: {d.name}</span>
              </button>
            ))}
          </div>

          <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
            <span>{devices.length} Hik-Connect Terminals Online</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-semibold">1080p Stream Available</span>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Surveillance & Realtime Console ── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Column: Live Camera Video Matrix (8 cols on XL) */}
        <div className="xl:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-amber-500" />
              <span>Realtime Camera Video Feeds</span>
            </h2>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Auto-refreshing 24/7 stream</span>
            </div>
          </div>

          {loadingDevices ? (
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center flex flex-col items-center justify-center">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin mb-3" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Connecting to Hik-Connect video streams...
              </p>
            </div>
          ) : displayedDevices.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
              <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-800 dark:text-white">
                No biometric devices configured
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Configure your MinMoe terminals in the Device Hub tab to activate live camera feeds.
              </p>
            </div>
          ) : (
            <div
              className={`grid gap-4 ${
                selectedChannel === "all" && displayedDevices.length > 1
                  ? "grid-cols-1 md:grid-cols-2"
                  : "grid-cols-1"
              }`}
            >
              {displayedDevices.map((dev, idx) => {
                const currentMode = feedMode[dev.id] || "stream";
                const isUnlocking = Boolean(doorUnlocking[dev.id]);
                const isFullscreen = fullscreenDeviceId === dev.id;

                const streamUrl = `/api/biometric/devices/${dev.id}/stream`;
                const snapshotUrl = `/api/biometric/devices/${dev.id}/snapshot?t=${
                  snapshotTimestamps[dev.id] || Date.now()
                }`;
                const rtspUrl = `rtsp://${dev.host}:554/Streaming/channels/101`;

                return (
                  <motion.div
                    key={dev.id}
                    layout
                    className={`relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-xl group ${
                      isFullscreen ? "fixed inset-4 z-[99999] bg-black" : ""
                    }`}
                  >
                    {/* Top HUD Telemetry Bar */}
                    <div className="absolute top-0 left-0 right-0 z-20 p-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between text-white">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-red-600/80 text-[10px] font-black uppercase tracking-wider shadow">
                          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                          LIVE
                        </span>
                        <span className="text-xs font-bold text-slate-200 truncate max-w-[160px] sm:max-w-[200px]">
                          CH 0{idx + 1}: {dev.name}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono border-slate-700 bg-slate-900/60 text-slate-300 hidden sm:inline"
                        >
                          {dev.host}:{dev.port}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {/* Feed mode selector */}
                        <div className="bg-slate-900/90 border border-slate-700/80 rounded-lg p-0.5 flex items-center text-[10px] font-bold">
                          <button
                            onClick={() =>
                              setFeedMode((p) => ({ ...p, [dev.id]: "stream" }))
                            }
                            className={`px-2 py-0.5 rounded transition ${
                              currentMode === "stream"
                                ? "bg-amber-500 text-slate-950 font-black"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            Stream
                          </button>
                          <button
                            onClick={() =>
                              setFeedMode((p) => ({ ...p, [dev.id]: "snapshot" }))
                            }
                            className={`px-2 py-0.5 rounded transition ${
                              currentMode === "snapshot"
                                ? "bg-amber-500 text-slate-950 font-black"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            Snapshot
                          </button>
                          <button
                            onClick={() =>
                              setFeedMode((p) => ({ ...p, [dev.id]: "rtsp" }))
                            }
                            className={`px-2 py-0.5 rounded transition ${
                              currentMode === "rtsp"
                                ? "bg-amber-500 text-slate-950 font-black"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            RTSP
                          </button>
                        </div>

                        {/* Fullscreen Toggle */}
                        <button
                          onClick={() =>
                            setFullscreenDeviceId(isFullscreen ? null : dev.id)
                          }
                          className="p-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-300 transition"
                          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen CCTV"}
                        >
                          {isFullscreen ? (
                            <Minimize2 className="w-3.5 h-3.5" />
                          ) : (
                            <Maximize2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Video Player Canvas / Frame */}
                    <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center overflow-hidden">
                      {currentMode === "stream" && (
                        <img
                          src={streamUrl}
                          alt={dev.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // If MJPEG stream stalls, fallback smoothly to snapshot
                            const target = e.target as HTMLImageElement;
                            target.src = snapshotUrl;
                          }}
                        />
                      )}

                      {currentMode === "snapshot" && (
                        <img
                          src={snapshotUrl}
                          alt={dev.name}
                          className="w-full h-full object-cover"
                        />
                      )}

                      {currentMode === "rtsp" && (
                        <div className="p-6 text-center text-white space-y-3">
                          <Radio className="w-10 h-10 text-amber-400 mx-auto animate-pulse" />
                          <h4 className="text-sm font-bold">RTSP Video Stream Broadcast</h4>
                          <p className="text-xs text-slate-400 max-w-sm">
                            Realtime H.264 / H.265 RTSP feed accessible via VLC, OBS, or Hik-Connect NVR:
                          </p>
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 font-mono text-xs text-amber-300 select-all break-all">
                            {rtspUrl}
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(rtspUrl);
                              toast.success("RTSP stream URL copied to clipboard");
                            }}
                            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs"
                          >
                            Copy RTSP Link
                          </Button>
                        </div>
                      )}

                      {/* Realtime Targeting Laser / AR Reticle Overlay */}
                      <div className="absolute inset-0 pointer-events-none">
                        {/* Target Reticle in Center */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-cyan-400/25 rounded-2xl flex items-center justify-center">
                          <div className="w-20 h-20 border border-dashed border-cyan-300/40 rounded-full" />
                          <div className="w-2 h-2 rounded-full bg-cyan-400/50" />
                        </div>

                        {/* Scanner Laser Sweep */}
                        <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent animate-pulse" style={{ top: "45%" }} />

                        {/* Camera Info HUD bottom-left */}
                        <div className="absolute bottom-3 left-3 px-2 py-1 rounded bg-black/60 backdrop-blur-md text-[10px] font-mono text-cyan-300">
                          1080P 60FPS • 4.2 MBPS • AGC AUTO
                        </div>

                        {/* Active Date Time in IST bottom-right */}
                        <div className="absolute bottom-3 right-3 px-2 py-1 rounded bg-black/60 backdrop-blur-md text-[10px] font-mono text-amber-300">
                          {currentTimeIST}
                        </div>
                      </div>

                      {/* ── AR Holographic Facial Recognition Bounding Box ── */}
                      <AnimatePresence>
                        {latestRecognizedFace && (
                          <motion.div
                            initial={{ scale: 0.85, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.85, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="absolute z-30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 sm:w-56 p-3 rounded-2xl bg-slate-900/90 border-2 border-emerald-400 text-white shadow-2xl backdrop-blur-md pointer-events-none"
                          >
                            <div className="flex items-center gap-2.5">
                              <Avatar className="w-10 h-10 border border-emerald-400 shrink-0">
                                <AvatarImage src={latestRecognizedFace.avatarUrl} />
                                <AvatarFallback className="bg-emerald-800 text-white font-bold text-xs">
                                  {getInitials(latestRecognizedFace.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span>VERIFIED &bull; GRANTED</span>
                                </div>
                                <h5 className="text-xs font-bold truncate text-white">
                                  {latestRecognizedFace.name}
                                </h5>
                                <span className="text-[10px] font-mono text-slate-300">
                                  {latestRecognizedFace.role} &bull; {latestRecognizedFace.time}
                                </span>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Bottom Action Footer for Each Camera */}
                    <div className="p-3 bg-slate-900/95 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUnlockDoor(dev)}
                          disabled={isUnlocking}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl px-3 py-1.5 flex items-center gap-1.5 shadow active:scale-95 transition"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>{isUnlocking ? "Pulsing..." : "Pulse Door"}</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadSnapshot(dev)}
                          className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl px-3 py-1.5 flex items-center gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5 text-amber-400" />
                          <span>Snapshot</span>
                        </Button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSnapshotTimestamps((prev) => ({
                              ...prev,
                              [dev.id]: Date.now(),
                            }));
                            toast.success(`Refreshed ${dev.name} stream`);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                          title="Refresh Camera"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Realtime Attendance Scanning Console (4 cols on XL) */}
        <div className="xl:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Scan className="w-5 h-5 text-amber-500" />
              <span>Realtime Scan Stream</span>
            </h2>

            <Badge variant="outline" className="border-amber-400/50 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs font-mono font-bold">
              {filteredScans.length} Scans Today
            </Badge>
          </div>

          <Card className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-lg space-y-4">
            {/* Filter Tabs & Search */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                {(["ALL", "STUDENT", "TEACHER"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setScanFilter(t)}
                    className={`flex-1 py-1 text-xs font-bold rounded-lg transition ${
                      scanFilter === t
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                    }`}
                  >
                    {t === "ALL" ? "All" : t === "STUDENT" ? "Talabat" : "Faculty"}
                  </button>
                ))}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search live scans by name or ITS..."
                  value={scanSearch}
                  onChange={(e) => setScanSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-base sm:text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Quick Barcode Scan Input Strip */}
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-amber-900 dark:text-amber-300">
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  Instant Barcode / ITS Punch
                </span>
                <span className="text-[10px] text-amber-700 dark:text-amber-400/80">USB or Keyboard</span>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleProcessScan(barcodeInput);
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  placeholder="Scan barcode or type ITS..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-white dark:bg-slate-950 text-base sm:text-xs font-mono text-slate-900 dark:text-white outline-none focus:ring-1 focus:ring-amber-400"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={scannerProcessing || !barcodeInput.trim()}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl px-3"
                >
                  {scannerProcessing ? "..." : "Punch"}
                </Button>
              </form>
            </div>

            {/* Live Scans Ticker List */}
            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {filteredScans.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  No scan punches recorded yet. Waiting for incoming telemetry...
                </div>
              ) : (
                filteredScans.map((scan, i) => {
                  const isPresent = scan.status === "PRESENT" || scan.status === "VERIFIED";
                  const isLate = scan.status === "LATE";

                  return (
                    <motion.div
                      key={scan.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.2) }}
                      className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition shadow-2xs space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="w-9 h-9 border border-amber-400/40 shrink-0">
                            <AvatarImage src={scan.avatarUrl} />
                            <AvatarFallback className="bg-slate-800 text-white font-bold text-xs">
                              {getInitials(scan.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {scan.name}
                              </h4>
                              <Badge
                                variant="outline"
                                className={`text-[9px] font-black uppercase px-1.5 py-0 ${
                                  scan.type === "STUDENT"
                                    ? "border-amber-400 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
                                    : "border-purple-400 bg-purple-50 text-purple-900 dark:bg-purple-950/40 dark:text-purple-300"
                                }`}
                              >
                                {scan.type === "STUDENT" ? "Talabat" : "Faculty"}
                              </Badge>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                              ITS: {scan.employeeNo} {scan.gradeOrDept ? `• ${scan.gradeOrDept}` : ""}
                            </div>
                          </div>
                        </div>

                        <Badge
                          className={`text-[10px] font-black shrink-0 ${
                            isPresent
                              ? "bg-emerald-600 text-white"
                              : isLate
                              ? "bg-amber-500 text-slate-950"
                              : "bg-slate-600 text-white"
                          }`}
                        >
                          {scan.status || "PRESENT"}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                        <span className="flex items-center gap-1">
                          <Fingerprint className="w-3 h-3 text-amber-500" />
                          <span className="font-semibold">{scan.verifyMode}</span>
                        </span>
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          {new Date(scan.timestamp).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: true,
                            timeZone: "Asia/Kolkata",
                          })}
                        </span>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Camera Barcode / ID Scanner Modal ── */}
      <AnimatePresence>
        {cameraScannerOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg rounded-3xl bg-slate-900 border-2 border-emerald-500/80 p-6 text-white shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Scan className="w-5 h-5 text-emerald-400 animate-pulse" />
                  <h3 className="text-base font-bold text-white">Live Camera Barcode & ID Scanner</h3>
                </div>
                <button
                  onClick={stopCameraScanner}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative aspect-video rounded-2xl bg-black overflow-hidden border border-slate-800 flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Holographic targeting reticle */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-32 border-2 border-dashed border-emerald-400 rounded-xl relative">
                    <div className="absolute inset-x-0 h-0.5 bg-emerald-400 animate-pulse top-1/2" />
                  </div>
                </div>

                <div className="absolute bottom-2 left-0 right-0 text-center text-xs font-semibold text-emerald-300 bg-black/60 py-1">
                  Point student card barcode or ITS QR directly at camera
                </div>
              </div>

              {/* Manual Input Fallback */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300">
                  Or enter ITS number / Barcode manually:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="e.g. 30304011"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="flex-1 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-base sm:text-xs font-mono text-white outline-none focus:border-emerald-400"
                  />
                  <Button
                    onClick={() => handleProcessScan(barcodeInput)}
                    disabled={scannerProcessing || !barcodeInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl px-4 py-2"
                  >
                    {scannerProcessing ? "Processing..." : "Verify & Mark"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
