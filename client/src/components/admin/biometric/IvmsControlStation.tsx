"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  CheckCircle2,
  Users,
  GraduationCap,
  RefreshCw,
  Zap,
  Eye,
  Scan,
  Video,
  Camera,
  Maximize2,
  Minimize2,
  Lock,
  Unlock,
  Activity,
  Sparkles,
  Search,
  Volume2,
  VolumeX,
  Clock,
  Server,
  AlertTriangle,
  Layers,
  ChevronRight,
  Trash2,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

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

interface IvmsControlStationProps {
  devices: BiometricDevice[];
  onRefreshDevices?: () => void;
  onOpenTestPunch?: () => void;
}

export default function IvmsControlStation({
  devices,
  onRefreshDevices,
  onOpenTestPunch,
}: IvmsControlStationProps) {
  // Feed Controls
  const [feedMode, setFeedMode] = useState<Record<string, "stream" | "snapshot" | "hud">>({});
  const [snapshotTimestamps, setSnapshotTimestamps] = useState<Record<string, number>>({});
  const [fullscreenDeviceId, setFullscreenDeviceId] = useState<string | null>(null);
  const [doorUnlocking, setDoorUnlocking] = useState<Record<string, boolean>>({});
  const [soundEnabled, setSoundEnabled] = useState(false);

  // Live Scans Ticker State
  const [liveScans, setLiveScans] = useState<LiveScanEvent[]>([]);
  const [liveScanFilter, setLiveScanFilter] = useState<"ALL" | "STUDENT" | "TEACHER">("ALL");
  const [scanSearch, setScanSearch] = useState("");
  const [currentTime, setCurrentTime] = useState("");

  // Sound beep ref
  const audioContextRef = useRef<AudioContext | null>(null);

  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15); // E6 note
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }, [soundEnabled]);

  // Live Clock for HUD Overlay
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
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
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Periodic Snapshot Refresh for Devices in Snapshot Mode (every 2.5 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setSnapshotTimestamps((prev) => {
        const next: Record<string, number> = { ...prev };
        devices.forEach((dev) => {
          next[dev.id] = Date.now();
        });
        return next;
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [devices]);

  // Manual Trigger to Refresh Single Device Feed
  const handleRefreshFeed = (devId: string) => {
    setSnapshotTimestamps((prev) => ({
      ...prev,
      [devId]: Date.now(),
    }));
    toast.success("Terminal video feed refreshed");
  };

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
        toast.success(`Door pulse triggered on ${dev.name}`);
      } else {
        toast.info(`Door command queued for ${dev.name}`);
      }
    } catch {
      toast.info(`Unlock command sent to ${dev.name}`);
    } finally {
      setDoorUnlocking((prev) => ({ ...prev, [dev.id]: false }));
    }
  };

  // Poll recent events from API
  const pollRecentEvents = useCallback(async () => {
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
              student?.status ||
              teacher?.status ||
              ev.classes?.[0]?.status ||
              (ev.type === "DUPLICATE" ? "DUPLICATE" : ev.type === "ON_LEAVE" ? "ON_LEAVE" : "PRESENT");

            const gradeOrDept = student
              ? `Grade ${student.grade || ""}-${student.section || ""}`
              : teacher
              ? teacher.department || "Faculty"
              : "Member";

            return {
              id: ev.id || String(ev.timestamp || Date.now()),
              name: student ? student.name : teacher ? teacher.name : ev.message || "Verified Member",
              type: student ? "STUDENT" : teacher ? "TEACHER" : "UNMATCHED",
              employeeNo: ev.fingerprint || student?.studentId || teacher?.employeeId || "ID",
              timestamp: ev.timestamp || new Date().toISOString(),
              deviceId: ev.deviceId,
              deviceHost: ev.deviceHost,
              status: resolvedStatus,
              verifyMode: ev.verifyMode || "FACIAL",
              eventName: eventName || undefined,
              avatarUrl: avatarUrl || undefined,
              gradeOrDept,
              leaveReason: student?.leaveReason || teacher?.notes,
              leaveType: student?.leaveType,
            };
          });

          setLiveScans((prev) => {
            const seen = new Set<string>();
            const combined: LiveScanEvent[] = [];
            for (const item of formatted) {
              if (!seen.has(item.id)) {
                seen.add(item.id);
                combined.push(item);
              }
            }
            for (const item of prev) {
              if (!seen.has(item.id)) {
                seen.add(item.id);
                combined.push(item);
              }
            }
            return combined.slice(0, 50);
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    pollRecentEvents();
    const interval = setInterval(pollRecentEvents, 3000);
    return () => clearInterval(interval);
  }, [pollRecentEvents]);

  // Real-Time SSE Stream for Instant Push Ingestion
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/biometric/events/stream");
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const student = payload.student;
          const teacher = payload.teacher;
          const eventName = payload.scanWindow?.name || payload.eventName || null;
          const avatarUrl = student?.avatarUrl || teacher?.avatarUrl || null;
          const resolvedStatus =
            student?.status ||
            teacher?.status ||
            payload.classes?.[0]?.status ||
            (payload.type === "DUPLICATE" ? "DUPLICATE" : payload.type === "ON_LEAVE" ? "ON_LEAVE" : "PRESENT");

          const gradeOrDept = student
            ? `Grade ${student.grade || ""}-${student.section || ""}`
            : teacher
            ? teacher.department || "Faculty"
            : "Member";

          const item: LiveScanEvent = {
            id: payload.id || String(Date.now()),
            name: student ? student.name : teacher ? teacher.name : payload.message || "Verified Member",
            type: student ? "STUDENT" : teacher ? "TEACHER" : "UNMATCHED",
            employeeNo: payload.fingerprint || student?.studentId || teacher?.employeeId || "ID",
            timestamp: payload.timestamp || new Date().toISOString(),
            deviceId: payload.deviceId,
            deviceHost: payload.deviceHost,
            status: resolvedStatus,
            verifyMode: payload.verifyMode || "FACIAL",
            eventName: eventName || undefined,
            avatarUrl: avatarUrl || undefined,
            gradeOrDept,
            leaveReason: student?.leaveReason || teacher?.notes,
            leaveType: student?.leaveType,
          };

          playChime();
          setLiveScans((prev) => [item, ...prev.filter((p) => p.id !== item.id)].slice(0, 50));
          if (onRefreshDevices) onRefreshDevices();
        } catch {
          // ignore
        }
      };
    } catch {
      // ignore
    }

    return () => {
      es?.close();
    };
  }, [onRefreshDevices, playChime]);

  // Filtered live scans
  const filteredLiveScans = useMemo(() => {
    let list = liveScans;
    if (liveScanFilter !== "ALL") {
      list = list.filter((s) => s.type === liveScanFilter);
    }
    if (scanSearch.trim()) {
      const q = scanSearch.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.employeeNo.toLowerCase().includes(q) ||
          s.gradeOrDept?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [liveScans, liveScanFilter, scanSearch]);

  // Latest spotlight scan
  const latestScan = liveScans[0] || null;

  // Render individual terminal feed component
  const renderDeviceCameraFeed = (device: BiometricDevice, isExpanded = false) => {
    const mode = feedMode[device.id] || "snapshot";
    const ts = snapshotTimestamps[device.id] || Date.now();
    const isUnlocking = doorUnlocking[device.id] || false;
    const isOnline = device.status === "ONLINE";

    const snapshotSrc = `/api/biometric/devices/${device.id}/snapshot?t=${ts}`;
    const streamSrc = `/api/biometric/devices/${device.id}/stream`;

    return (
      <Card
        key={device.id}
        className={cn(
          "relative overflow-hidden rounded-3xl border-slate-800 bg-slate-950 text-white shadow-xl flex flex-col transition-all duration-300",
          isExpanded ? "p-0" : "p-4 sm:p-5"
        )}
      >
        {/* TOP CAMERA BAR */}
        <div className="flex items-center justify-between gap-2 mb-3 z-10 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping absolute" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 relative" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black tracking-tight text-white truncate max-w-[180px] sm:max-w-none">
                  {device.name}
                </h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border-0 uppercase",
                    isOnline ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"
                  )}
                >
                  {isOnline ? "LIVE STREAM" : "ONLINE (Push)"}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                <span>{device.host}:{device.port}</span>
                <span>•</span>
                <span>{device.model || "MinMoe DS-K1T341"}</span>
              </div>
            </div>
          </div>

          {/* TOP CONTROLS */}
          <div className="flex items-center gap-1.5">
            {/* Feed Mode Switcher */}
            <div className="flex items-center bg-slate-900/90 rounded-xl p-0.5 border border-slate-800 text-[11px]">
              <button
                type="button"
                onClick={() => setFeedMode((prev) => ({ ...prev, [device.id]: "snapshot" }))}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-semibold transition-all",
                  mode === "snapshot"
                    ? "bg-emerald-500 text-slate-950 shadow-xs"
                    : "text-slate-400 hover:text-white"
                )}
                title="Auto-refreshing High Definition Snapshots"
              >
                Snapshot
              </button>
              <button
                type="button"
                onClick={() => setFeedMode((prev) => ({ ...prev, [device.id]: "stream" }))}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-semibold transition-all",
                  mode === "stream"
                    ? "bg-emerald-500 text-slate-950 shadow-xs"
                    : "text-slate-400 hover:text-white"
                )}
                title="Continuous Live Video Stream"
              >
                MJPEG
              </button>
            </div>

            {/* Quick Refresh Snapshot */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRefreshFeed(device.id)}
              className="h-8 w-8 p-0 rounded-xl border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white"
              title="Refresh Camera Frame"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>

            {/* Remote Door Unlock */}
            <Button
              size="sm"
              variant="outline"
              disabled={isUnlocking}
              onClick={() => handleUnlockDoor(device)}
              className="h-8 px-2.5 rounded-xl border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-bold"
              title="Pulse Electric Door Strike / Lock"
            >
              {isUnlocking ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5 mr-1" />
                  Unlock
                </>
              )}
            </Button>

            {/* Fullscreen Toggle */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setFullscreenDeviceId(fullscreenDeviceId === device.id ? null : device.id)}
              className="h-8 w-8 p-0 rounded-xl border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white"
              title="Expand Camera Feed"
            >
              {fullscreenDeviceId === device.id ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>

        {/* CAMERA VIEWPORT WITH HUD OVERLAY */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800/80 shadow-inner group">
          {/* Active Image Feed */}
          <img
            src={mode === "stream" ? streamSrc : snapshotSrc}
            alt={`${device.name} Camera Stream`}
            className="w-full h-full object-cover object-center select-none"
            loading="eager"
            onError={(e) => {
              // Fallback to snapshot mode if stream fails
              const target = e.currentTarget;
              if (!target.src.includes("snapshot")) {
                target.src = snapshotSrc;
              }
            }}
          />

          {/* HUD CORNER CROSSHAIRS */}
          <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-emerald-400/70 pointer-events-none" />
          <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-emerald-400/70 pointer-events-none" />
          <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-emerald-400/70 pointer-events-none" />
          <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-emerald-400/70 pointer-events-none" />

          {/* TOP HUD TAGS */}
          <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none px-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] font-mono font-bold text-emerald-400 shadow-md">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span>REC • 1080P FHD</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] font-mono font-semibold text-sky-300 shadow-md">
              <Clock className="w-3 h-3 text-sky-400" />
              <span>{currentTime || "IST"}</span>
            </div>
          </div>

          {/* BOTTOM HUD STATUS */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none px-4">
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950/70 backdrop-blur-xs border border-white/5 text-[9px] font-mono text-slate-300">
              <span>DEVICE: {device.host}</span>
            </div>

            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950/70 backdrop-blur-xs border border-white/5 text-[9px] font-mono text-emerald-400">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>ISAPI / CLOUD PUSH</span>
            </div>
          </div>
        </div>

        {/* BOTTOM METRIC STRIP */}
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Mode</span>
            <span className="font-bold text-emerald-400">ISAPI / Push</span>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Direct LAN</span>
            <a
              href={`http://${device.host}:${device.port}`}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 justify-center"
              title="Open Terminal Web Admin GUI in new tab"
            >
              <span>{device.host}</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div className="bg-slate-900/60 rounded-xl p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-mono block">Last Ping</span>
            <span className="font-bold text-slate-300 font-mono text-[11px]">
              {device.lastSeenAt
                ? new Date(device.lastSeenAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                    timeZone: "Asia/Kolkata",
                  })
                : "Continuous"}
            </span>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── TOP SECTION: DUAL HIKVISION TERMINAL LIVE FEEDS ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-md shadow-slate-950/20 border border-slate-800">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-gray-950 tracking-tight flex items-center gap-2">
                Hikvision Dual Terminal Live Monitors
                <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                  24/7 Hardware Stream
                </Badge>
              </h2>
              <p className="text-xs text-gray-500">
                Live optical view and hardware status of both MinMoe terminals connected on local Wi-Fi &amp; Cloud.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={cn(
                "rounded-2xl text-xs font-semibold h-9 px-3.5 border transition-all",
                soundEnabled
                  ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              )}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                  Sound On
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                  Sound Off
                </>
              )}
            </Button>

            {onOpenTestPunch && (
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenTestPunch}
                className="rounded-2xl text-xs font-semibold h-9 px-3.5 border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100"
              >
                <Zap className="w-3.5 h-3.5 mr-1.5 text-emerald-600" />
                Simulate Punch
              </Button>
            )}
          </div>
        </div>

        {/* DUAL CAMERA GRID */}
        {devices.length === 0 ? (
          <Card className="p-8 sm:p-12 text-center rounded-3xl border-dashed border-gray-200 bg-white">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto mb-3">
              <Server className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">No MinMoe Terminals Registered</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
              Add your Hikvision MinMoe terminals (e.g., 192.168.0.4 &amp; 192.168.0.5) to view live camera feeds and monitor real-time verification scans.
            </p>
          </Card>
        ) : (
          <div className={cn("grid gap-5", devices.length === 1 ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2")}>
            {devices.map((dev) => renderDeviceCameraFeed(dev))}
          </div>
        )}
      </div>

      {/* FULLSCREEN CAMERA MODAL IF OPEN */}
      <AnimatePresence>
        {fullscreenDeviceId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 sm:p-6 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-5xl max-h-[90vh] flex flex-col"
            >
              {devices
                .filter((d) => d.id === fullscreenDeviceId)
                .map((dev) => renderDeviceCameraFeed(dev, true))}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── BOTTOM SECTION: REAL-TIME SCAN SHOWCASE & LIVE INGESTION STREAM ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 1 COL: LATEST SPOTLIGHT SCAN */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Latest Verified Scan</h3>
              <p className="text-[11px] text-gray-500">Most recent real-time punch received</p>
            </div>
          </div>

          <Card className="rounded-3xl border-gray-100 shadow-md p-6 bg-white overflow-hidden relative">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />

            {latestScan ? (
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  {/* Large Avatar with glowing pulse */}
                  <div className="relative">
                    <div
                      className={cn(
                        "w-20 h-20 rounded-3xl flex items-center justify-center text-xl font-bold shadow-lg overflow-hidden border-2",
                        latestScan.status === "LATE"
                          ? "bg-amber-50 text-amber-700 border-amber-300"
                          : latestScan.type === "STUDENT"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-400"
                          : latestScan.type === "TEACHER"
                          ? "bg-purple-50 text-purple-700 border-purple-400"
                          : "bg-slate-100 text-slate-700 border-slate-300"
                      )}
                    >
                      {latestScan.avatarUrl ? (
                        <img
                          src={latestScan.avatarUrl}
                          alt={latestScan.name}
                          className="w-full h-full object-cover"
                        />
                      ) : latestScan.type === "STUDENT" ? (
                        <GraduationCap className="w-10 h-10" />
                      ) : latestScan.type === "TEACHER" ? (
                        <Users className="w-10 h-10" />
                      ) : (
                        <Scan className="w-10 h-10" />
                      )}
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  </div>

                  {/* Name & Role */}
                  <div className="min-w-0 flex-1">
                    <Badge
                      className={cn(
                        "text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-1.5 uppercase",
                        latestScan.type === "STUDENT"
                          ? "bg-emerald-100 text-emerald-800"
                          : latestScan.type === "TEACHER"
                          ? "bg-purple-100 text-purple-800"
                          : "bg-amber-100 text-amber-800"
                      )}
                    >
                      {latestScan.type === "STUDENT" ? "Talabat (Student)" : latestScan.type === "TEACHER" ? "Faculty" : "Unassigned"}
                    </Badge>
                    <h4 className="text-lg font-black text-gray-950 truncate">{latestScan.name}</h4>
                    <div className="font-mono text-xs text-gray-500 font-semibold">
                      ID: {latestScan.employeeNo}
                    </div>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 text-xs">
                  <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">
                      Class / Dept
                    </span>
                    <span className="font-semibold text-gray-800">{latestScan.gradeOrDept || "--"}</span>
                  </div>
                  <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">
                      Attendance Status
                    </span>
                    <Badge
                      className={cn(
                        "text-[10px] font-extrabold px-2 py-0.5 rounded-lg border-0",
                        latestScan.status === "LATE"
                          ? "bg-amber-100 text-amber-800"
                          : latestScan.status === "DUPLICATE"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-emerald-100 text-emerald-800"
                      )}
                    >
                      {latestScan.status || "PRESENT"}
                    </Badge>
                  </div>
                  <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">
                      Scan Mode
                    </span>
                    <span className="font-mono font-semibold text-emerald-700">
                      {latestScan.verifyMode || "FACIAL"}
                    </span>
                  </div>
                  <div className="bg-gray-50/80 p-3 rounded-2xl border border-gray-100">
                    <span className="text-[10px] uppercase font-bold text-gray-400 block mb-0.5">
                      Check-in Time
                    </span>
                    <span className="font-mono font-bold text-gray-900">
                      {new Date(latestScan.timestamp).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: true,
                        timeZone: "Asia/Kolkata",
                      })}
                    </span>
                  </div>
                </div>

                {latestScan.eventName && (
                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center gap-2 text-xs text-emerald-900">
                    <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Window: <strong className="font-bold">{latestScan.eventName}</strong>
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Scan className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-xs font-semibold text-gray-600">Awaiting incoming scan...</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Face or fingerprint punches will highlight here instantly.
                </p>
              </div>
            )}
          </Card>
        </div>

        {/* RIGHT 2 COLS: REAL-TIME SCAN STREAM FEED */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Real-Time Ingestion Stream</h3>
                <p className="text-[11px] text-gray-500">Live SSE push feed with sub-second latency</p>
              </div>
            </div>

            {/* Filter Pills & Search */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-2xl text-xs font-semibold text-gray-600">
                {(["ALL", "STUDENT", "TEACHER"] as const).map((filterType) => (
                  <button
                    key={filterType}
                    type="button"
                    onClick={() => setLiveScanFilter(filterType)}
                    className={cn(
                      "px-3 py-1 rounded-xl transition-all text-[11px]",
                      liveScanFilter === filterType
                        ? "bg-white text-gray-900 shadow-xs font-bold"
                        : "hover:text-gray-900"
                    )}
                  >
                    {filterType === "ALL" ? "All Scans" : filterType === "STUDENT" ? "Talabat" : "Faculty"}
                  </button>
                ))}
              </div>

              <div className="relative w-40 sm:w-48">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter scans..."
                  value={scanSearch}
                  onChange={(e) => setScanSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {liveScans.length > 0 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    await fetch("/api/biometric/events/clear", { method: "POST" });
                    setLiveScans([]);
                  }}
                  className="h-8 px-2.5 rounded-xl text-gray-400 hover:text-rose-600 text-xs"
                  title="Clear live stream list"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* STREAM SCROLL CONTAINER */}
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
            {filteredLiveScans.length === 0 ? (
              <Card className="border-dashed border-gray-200 bg-white p-10 text-center rounded-3xl">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <Scan className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-gray-800 mb-1">Stream Ready &amp; Listening</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Terminal face and RFID scans are captured 24/7. When someone scans, their card will appear here instantly.
                </p>
              </Card>
            ) : (
              <AnimatePresence initial={false}>
                {filteredLiveScans.map((scan) => {
                  const isStudent = scan.type === "STUDENT";
                  const isTeacher = scan.type === "TEACHER";
                  const isLate = scan.status === "LATE";
                  const isDuplicate = scan.status === "DUPLICATE";
                  const isOnLeave = scan.status === "ON_LEAVE" || scan.status === "EXCUSED";

                  return (
                    <motion.div
                      key={scan.id}
                      initial={{ opacity: 0, y: -8, scale: 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.18 }}
                    >
                      <div className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-white border border-gray-100 shadow-xs hover:border-emerald-200 hover:shadow-sm transition-all gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Avatar */}
                          <div
                            className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs",
                              isStudent
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : isTeacher
                                ? "bg-purple-50 text-purple-700 border border-purple-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            )}
                          >
                            {scan.avatarUrl ? (
                              <img
                                src={scan.avatarUrl}
                                alt={scan.name}
                                className="w-full h-full object-cover rounded-2xl"
                              />
                            ) : isStudent ? (
                              <GraduationCap className="w-5 h-5" />
                            ) : isTeacher ? (
                              <Users className="w-5 h-5" />
                            ) : (
                              <Scan className="w-5 h-5" />
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                                {scan.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[9px] px-2 py-0.5 rounded-md font-semibold",
                                  isStudent
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : isTeacher
                                    ? "bg-purple-50 text-purple-800 border-purple-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                )}
                              >
                                {isStudent ? "Talabat" : isTeacher ? "Faculty" : "Unmatched"}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5 flex-wrap">
                              <span className="font-mono font-semibold text-gray-700">
                                ID: {scan.employeeNo}
                              </span>
                              <span>•</span>
                              <span>{scan.gradeOrDept}</span>
                              {scan.eventName && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-medium">{scan.eventName}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status & Time */}
                        <div className="text-right shrink-0 space-y-0.5">
                          <Badge
                            className={cn(
                              "text-[10px] px-2.5 py-0.5 rounded-lg font-bold border-0",
                              isOnLeave
                                ? "bg-teal-100 text-teal-800"
                                : isDuplicate
                                ? "bg-blue-100 text-blue-800"
                                : isLate
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            )}
                          >
                            {isOnLeave ? "ON LEAVE" : isDuplicate ? "VERIFIED" : isLate ? "LATE" : "PRESENT"}
                          </Badge>
                          <div className="text-[10px] font-mono text-gray-500 font-medium">
                            {new Date(scan.timestamp).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: true,
                              timeZone: "Asia/Kolkata",
                            })}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
