"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  RefreshCw,
  Volume2,
  Users,
  Activity,
  CheckCircle2,
  Sparkles,
  Radio,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  Eye,
  Copy,
  Check,
  Lock,
  Unlock,
  Filter,
  ShieldCheck,
  GraduationCap,
  Scan,
  Settings,
  HelpCircle,
  ExternalLink,
  Wifi,
  Globe,
  AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
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

interface LiveScanEvent {
  id: string;
  name: string;
  type: "STUDENT" | "TEACHER" | "UNMATCHED";
  employeeNo: string;
  timestamp: string;
  deviceId?: string;
  deviceHost?: string;
  status?: string;
  verifyMode?: string;
  avatarUrl?: string;
}

type StreamInterval = 1000 | 2500 | 5000 | 0; // 0 = paused

const PRESET_VOICE_PROMPTS = [
  { id: "pleaseScanFace", label: "Please Scan Face", arabic: "من فضلك امسح وجهك", icon: Eye },
  { id: "accessGranted", label: "Attendance Marked", arabic: "تم تسجيل الحضور بنجاح", icon: CheckCircle2 },
  { id: "scanAgain", label: "Scan Again", arabic: "يرجى المسح مرة أخرى", icon: RefreshCw },
  { id: "maintainQueue", label: "Please Wait in Line", arabic: "يرجى الانتظار في الصف", icon: Users },
  { id: "goodMorning", label: "Good Morning", arabic: "صباح الخير", icon: Sparkles },
  { id: "goodEvening", label: "Good Afternoon", arabic: "مساء الخير", icon: Sparkles },
];

export default function IvmsControlStation({
  devices,
  onRefreshDevices,
}: {
  devices: BiometricDevice[];
  onRefreshDevices?: () => void;
}) {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(devices[0]?.id || "");
  const activeDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0] || null;

  // Stream & snapshot
  const [streamInterval, setStreamInterval] = useState<StreamInterval>(2500);
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [copiedRtsp, setCopiedRtsp] = useState(false);
  const [deployingMembers, setDeployingMembers] = useState(false);
  const [terminalGuideOpen, setTerminalGuideOpen] = useState(false);

  // Door control & Audio prompt
  const [doorBusy, setDoorBusy] = useState(false);
  const [doorStatus, setDoorStatus] = useState<string>("NORMAL");
  const [voiceBusy, setVoiceBusy] = useState(false);

  // Telemetry
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);

  // Live Scans Ticker
  const [liveScans, setLiveScans] = useState<LiveScanEvent[]>([]);
  const [liveScanFilter, setLiveScanFilter] = useState<"ALL" | "STUDENT" | "TEACHER">("ALL");

  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  // Snapshot updater
  const fetchSnapshot = useCallback((devId: string) => {
    if (!devId) return;
    const cacheBuster = Date.now();
    const url = `/api/biometric/devices/${devId}/snapshot?_t=${cacheBuster}`;
    setSnapshotUrl(url);
    setImageError(false);
    setLastUpdated(new Date());
  }, []);

  // Polling loop for live snapshot
  useEffect(() => {
    if (!activeDevice || streamInterval === 0) return;
    fetchSnapshot(activeDevice.id);
    const interval = setInterval(() => {
      fetchSnapshot(activeDevice.id);
    }, streamInterval);
    return () => clearInterval(interval);
  }, [activeDevice, streamInterval, fetchSnapshot]);

  // Fetch telemetry
  const fetchTelemetry = useCallback(async (devId: string) => {
    if (!devId) return;
    try {
      const res = await fetch(`/api/biometric/devices/${devId}/system-status`);
      const json = await res.json();
      if (json.success && json.data) {
        setTelemetry(json.data);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (activeDevice) {
      fetchTelemetry(activeDevice.id);
    }
  }, [activeDevice, fetchTelemetry]);

  // Fallback Polling for Real-Time Scans
  const pollRecentEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/biometric/events");
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const formatted: LiveScanEvent[] = json.data.map((ev: any) => {
            const student = ev.student;
            const teacher = ev.teacher;
            return {
              id: ev.id || String(ev.timestamp || Date.now()),
              name: student ? student.name : teacher ? teacher.name : "Verified Member",
              type: student ? "STUDENT" : teacher ? "TEACHER" : "UNMATCHED",
              employeeNo: ev.fingerprint || student?.studentId || teacher?.employeeId || "ID",
              timestamp: ev.timestamp || new Date().toISOString(),
              deviceId: ev.deviceId,
              status: ev.classes?.[0]?.status || teacher?.status || (ev.type === "DUPLICATE" ? "DUPLICATE" : "PRESENT"),
              verifyMode: ev.verifyMode || "BIOMETRIC",
            };
          });
          setLiveScans((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const newItems = formatted.filter((f) => !existingIds.has(f.id));
            if (newItems.length === 0) return prev;
            return [...newItems, ...prev].slice(0, 50);
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    pollRecentEvents();
    const interval = setInterval(pollRecentEvents, 3500);
    return () => clearInterval(interval);
  }, [pollRecentEvents]);

  // SSE for live scans
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/biometric/events/stream");
      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.type === "MATCHED" || payload.type === "DUPLICATE") {
            const student = payload.student;
            const teacher = payload.teacher;
            const item: LiveScanEvent = {
              id: payload.id || String(Date.now()),
              name: student ? student.name : teacher ? teacher.name : "Verified Member",
              type: student ? "STUDENT" : teacher ? "TEACHER" : "UNMATCHED",
              employeeNo: payload.fingerprint || student?.studentId || teacher?.employeeId || "ID",
              timestamp: payload.timestamp || new Date().toISOString(),
              deviceId: payload.deviceId,
              status: payload.classes?.[0]?.status || teacher?.status || (payload.type === "DUPLICATE" ? "DUPLICATE" : "PRESENT"),
              verifyMode: payload.verifyMode || "BIOMETRIC",
            };
            setLiveScans((prev) => [item, ...prev.slice(0, 49)]);
          }
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
  }, []);

  // Remote door control
  const handleDoorControl = async (command: "open" | "close") => {
    if (!activeDevice) return;
    setDoorBusy(true);
    try {
      const res = await fetch(`/api/biometric/devices/${activeDevice.id}/door-control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command, doorNo: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        setDoorStatus(command === "open" ? "UNLOCKED" : "LOCKED");
        toast.success(command === "open" ? "Door unlocked successfully" : "Door closed");
        setTimeout(() => setDoorStatus("NORMAL"), 5000);
      } else {
        toast.error(data.error || "Failed to trigger door relay");
      }
    } catch (err: any) {
      toast.error(err?.message || "Door control error");
    } finally {
      setDoorBusy(false);
    }
  };

  // Play voice prompt
  const handlePlayVoice = async (promptId: string, label: string) => {
    if (!activeDevice) return;
    setVoiceBusy(true);
    try {
      const res = await fetch(`/api/biometric/devices/${activeDevice.id}/voice/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Broadcasting "${label}" on ${activeDevice.name}`);
      } else {
        toast.error(data.error || "Failed to broadcast voice prompt");
      }
    } catch (err: any) {
      toast.error(err?.message || "Voice broadcast error");
    } finally {
      setVoiceBusy(false);
    }
  };

  // Deploy all members to active device
  const handleDeployMembersToDevice = async () => {
    if (!activeDevice) return;
    setDeployingMembers(true);
    try {
      const res = await fetch(`/api/biometric/devices/${activeDevice.id}/users/deploy-all`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Successfully configured members on ${activeDevice.name}: ${data.message}`);
      } else {
        toast.error(data.error || "Member deployment failed");
      }
    } catch (err: any) {
      toast.error(err?.message || "Member configuration error");
    } finally {
      setDeployingMembers(false);
    }
  };

  // Copy RTSP
  const rtspUrl = activeDevice ? `rtsp://${activeDevice.username}:[PASSWORD]@${activeDevice.host}:554/Streaming/channels/101` : "";
  const handleCopyRtsp = () => {
    if (!rtspUrl) return;
    navigator.clipboard.writeText(rtspUrl);
    setCopiedRtsp(true);
    toast.success("RTSP Stream URL copied to clipboard");
    setTimeout(() => setCopiedRtsp(false), 2500);
  };

  const filteredLiveScans = useMemo(() => {
    if (liveScanFilter === "ALL") return liveScans;
    return liveScans.filter((s) => s.type === liveScanFilter);
  }, [liveScanFilter, liveScans]);

  if (!devices || devices.length === 0) {
    return (
      <Card className="border-dashed border-gray-200 bg-gray-50/50 p-8 text-center rounded-2xl">
        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
          <Camera className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-gray-800 mb-1">No Biometric Terminals Registered</h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
          Add your Hikvision Face & Fingerprint terminal (DS-K1T341 / MinMoe) in the Terminals tab to activate live camera feed and hardware telemetry.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Device Selector & Stream Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider pl-1">Camera Feed:</span>
          {devices.map((d) => {
            const isSelected = d.id === selectedDeviceId;
            return (
              <button
                key={d.id}
                onClick={() => {
                  setSelectedDeviceId(d.id);
                  setSnapshotUrl(null);
                  setImageError(false);
                }}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium transition-all",
                  isSelected
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200/70"
                )}
              >
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    d.status === "ONLINE" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                  )}
                />
                <span>{d.name}</span>
                <span className="text-[10px] opacity-70 font-mono">({d.host})</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh rate pill */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl text-[11px] font-medium text-gray-600">
            <span className="px-2 text-gray-400">FPS:</span>
            {[
              { label: "1s", val: 1000 },
              { label: "2.5s", val: 2500 },
              { label: "5s", val: 5000 },
              { label: "Pause", val: 0 },
            ].map((opt) => (
              <button
                key={opt.label}
                onClick={() => setStreamInterval(opt.val as StreamInterval)}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all",
                  streamInterval === opt.val
                    ? "bg-white text-slate-900 shadow-xs font-semibold"
                    : "hover:text-gray-900"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setTerminalGuideOpen(true)}
            className="h-8 px-2.5 text-xs rounded-xl border-sky-200 text-sky-700 bg-sky-50/50 hover:bg-sky-100"
          >
            <Settings className="w-3.5 h-3.5 mr-1 text-sky-600" />
            Device Settings Guide
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => activeDevice && fetchSnapshot(activeDevice.id)}
            className="h-8 px-2.5 text-xs rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1 text-gray-600" />
            Capture Frame
          </Button>

          <Button
            size="sm"
            onClick={handleDeployMembersToDevice}
            disabled={deployingMembers}
            className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl shadow-xs"
          >
            <Users className="w-3.5 h-3.5 mr-1" />
            {deployingMembers ? "Configuring..." : "Configure Members"}
          </Button>
        </div>
      </div>

      {/* Main Grid: Live Camera Monitor & Live Scan Ticker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Video Frame & Controls */}
        <div className="lg:col-span-8 space-y-4">
          <div className="relative bg-slate-950 rounded-3xl overflow-hidden border border-slate-800 shadow-xl group aspect-[16/10] flex items-center justify-center">
            {/* Live Camera Image or Futuristic HUD Scanner Overlay */}
            {snapshotUrl && !imageError ? (
              <img
                src={snapshotUrl}
                alt="Terminal Camera Stream"
                style={{ transform: `scale(${zoomLevel})`, transition: "transform 0.2s ease-out" }}
                className="w-full h-full object-contain"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-slate-950 text-slate-400 p-6 overflow-hidden">
                {/* Visual grid pattern */}
                <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

                {/* Simulated Target Reticle */}
                <div className="relative w-40 h-40 border border-sky-500/30 rounded-2xl flex items-center justify-center mb-3">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-sky-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-sky-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-sky-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-sky-400" />
                  <Scan className="w-12 h-12 text-sky-400/60 animate-pulse" />
                </div>

                <div className="text-center z-10">
                  <div className="text-xs font-mono font-bold text-sky-300">
                    {activeDevice?.name || "Terminal Camera"} • ISAPI Live Standby
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    {activeDevice?.host} • Resolution: 1080p • Ready for Face Scan
                  </div>
                </div>
              </div>
            )}

            {/* Top HUD Overlay */}
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-white text-[11px] font-mono pointer-events-auto shadow-md">
                <span
                  className={cn(
                    "w-2 h-2 rounded-full",
                    activeDevice?.status === "ONLINE" ? "bg-emerald-400 animate-pulse" : "bg-rose-400"
                  )}
                />
                <span className="font-semibold">{activeDevice?.name || "Terminal Camera"}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-300">{activeDevice?.host}</span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-white/10 text-white pointer-events-auto shadow-md">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(1, z - 0.25))}
                  disabled={zoomLevel <= 1}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 disabled:opacity-30"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono px-1 font-bold text-slate-200">{zoomLevel.toFixed(1)}x</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                  disabled={zoomLevel >= 2.5}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 disabled:opacity-30"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Bottom HUD Overlay */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 shadow-md">
              <div className="flex items-center gap-2 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-slate-200">ISAPI Camera Feed</span>
                {lastUpdated && (
                  <span className="text-slate-500">
                    • Frame {lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono bg-slate-800 px-2.5 py-0.5 rounded-md text-sky-300 border border-sky-500/20">
                  {activeDevice?.model || "DS-K1T341"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Hardware Controls & Telemetry */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* RTSP Stream Link Box */}
            <div className="p-3.5 bg-white rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
              <div className="truncate mr-2">
                <div className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-sky-500" />
                  RTSP Video Stream (VLC / OBS)
                </div>
                <div className="text-[10px] font-mono text-gray-500 truncate mt-0.5">
                  {rtspUrl}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyRtsp}
                className="h-7 px-2.5 text-xs text-sky-700 hover:bg-sky-50 rounded-lg shrink-0"
              >
                {copiedRtsp ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                {copiedRtsp ? "Copied" : "Copy"}
              </Button>
            </div>

            {/* Door Control Box */}
            <div className="p-3.5 bg-white rounded-2xl border border-gray-100 shadow-xs flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-gray-700 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" />
                  Electronic Door Relay
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  Status: <span className="font-semibold text-emerald-700">{doorStatus}</span>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => handleDoorControl("open")}
                disabled={doorBusy}
                className="h-7 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs"
              >
                <Unlock className="w-3 h-3 mr-1" />
                Unlock Door
              </Button>
            </div>
          </div>

          {/* Voice Prompt Studio */}
          <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-gray-800">Terminal Voice Broadcast</h4>
              </div>
              <span className="text-[10px] text-gray-400">Plays live audio prompt through device speaker</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PRESET_VOICE_PROMPTS.map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => handlePlayVoice(p.id, p.label)}
                    disabled={voiceBusy}
                    className="flex flex-col items-start p-2.5 rounded-xl border border-gray-100 bg-gray-50/70 hover:bg-indigo-50/50 hover:border-indigo-100 transition-all text-left group"
                  >
                    <div className="flex items-center gap-1.5 w-full text-xs font-semibold text-gray-800 group-hover:text-indigo-700">
                      <Icon className="w-3.5 h-3.5 text-indigo-500" />
                      <span className="truncate">{p.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-arabic mt-0.5">{p.arabic}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Real-Time Live Scan Punch Ticker */}
        <div className="lg:col-span-4 flex flex-col space-y-3">
          <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-gray-100 shadow-xs">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600 animate-pulse" />
              <h3 className="text-xs font-bold text-gray-900">Live Attendance Punch Stream</h3>
            </div>
            <Badge variant="outline" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
              SSE Real-Time
            </Badge>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-medium text-gray-600">
            {(["ALL", "STUDENT", "TEACHER"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLiveScanFilter(tab)}
                className={cn(
                  "flex-1 py-1.5 text-center rounded-lg transition-all text-[11px]",
                  liveScanFilter === tab
                    ? "bg-white text-emerald-800 font-bold shadow-xs"
                    : "hover:text-gray-900"
                )}
              >
                {tab === "ALL" ? "All Scans" : tab === "STUDENT" ? "Talabat" : "Faculty"}
              </button>
            ))}
          </div>

          {/* Punch Stream List */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-xs p-3 overflow-y-auto max-h-[580px] space-y-2">
            {filteredLiveScans.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium">Awaiting Biometric Punches...</p>
                <p className="text-[10px] text-gray-400 mt-1 max-w-[200px] mx-auto">
                  When a student or faculty member scans at the terminal, their live check-in card will appear here instantly.
                </p>
              </div>
            ) : (
              filteredLiveScans.map((scan) => {
                const isLate = scan.status === "LATE";
                const isStudent = scan.type === "STUDENT";
                const timeFormatted = new Date(scan.timestamp).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true,
                });

                return (
                  <motion.div
                    key={scan.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-3 rounded-xl border transition-all",
                      isLate
                        ? "bg-amber-50/50 border-amber-200/70"
                        : "bg-gray-50/60 border-gray-100 hover:border-emerald-200"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                            isStudent
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-indigo-100 text-indigo-800"
                          )}
                        >
                          {isStudent ? <GraduationCap className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-900 leading-tight">
                            {scan.name}
                          </div>
                          <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                            ID: {scan.employeeNo}
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5",
                          isLate
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-emerald-100 text-emerald-800 border-emerald-300"
                        )}
                      >
                        {scan.status || "PRESENT"}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100/80 text-[10px] text-gray-400 font-mono">
                      <span>{scan.verifyMode || "Face"}</span>
                      <span>{timeFormatted}</span>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Terminal Settings Guide Modal */}
      {terminalGuideOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-100 p-6 space-y-6"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 rounded-xl bg-sky-100 text-sky-700">
                    <Settings className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 font-display">
                      Hikvision MinMoe Terminal Configuration
                    </h3>
                    <p className="text-xs text-gray-500">
                      Step-by-step instructions to enable real-time Face/Biometric scans on {activeDevice?.name || "Terminal"} ({activeDevice?.host})
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setTerminalGuideOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-gray-700">
              {/* Step 1 */}
              <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-100 space-y-2">
                <div className="font-bold text-sky-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                  Open Terminal Web Portal
                </div>
                <p className="text-gray-600">
                  Open a web browser on your local network and visit:
                </p>
                <div className="flex items-center gap-2 font-mono font-bold bg-white p-2 rounded-xl border border-sky-200 text-sky-800">
                  <span>http://{activeDevice?.host || "192.168.0.4"}</span>
                  <a
                    href={`http://${activeDevice?.host || "192.168.0.4"}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto text-xs text-sky-600 hover:underline flex items-center gap-1"
                  >
                    Open Terminal Webpage <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <p className="text-[11px] text-gray-500">
                  Default Login: Username: <b>admin</b> | Password: <b>DARSEBURHANI5253</b>
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100 space-y-2">
                <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                  Configure Realtime HTTP Listening / Webhook Push
                </div>
                <p className="text-gray-600">
                  In Hikvision Web Interface, navigate to: <b>Configuration → Network → Advanced Settings → HTTP Listening</b> (or <b>Alarm Host / Webhook</b>):
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-white p-3 rounded-xl border border-emerald-200">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Destination IP / Host:</span>
                    <span className="font-bold text-gray-800">{window.location.hostname}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Port:</span>
                    <span className="font-bold text-gray-800">{window.location.protocol === "https:" ? "443" : "80"}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">URL Path:</span>
                    <span className="font-bold text-emerald-700">/api/hikvision/events</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Data Format:</span>
                    <span className="font-bold text-gray-800">JSON or XML</span>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-100 space-y-2">
                <div className="font-bold text-amber-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                  Enable Face Picture Upload
                </div>
                <p className="text-gray-600">
                  Navigate to <b>Configuration → Access Control → Parameters</b>:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-gray-600">
                  <li>Enable <b>Upload Verification Event</b></li>
                  <li>Enable <b>Upload Face Picture with Verification</b></li>
                  <li>Enable <b>Real-time Event Upload</b></li>
                </ul>
              </div>

              {/* Step 4 */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-bold text-slate-900 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px] font-bold">4</span>
                  Ensure Gateway & DNS are Set (for Cloud Connection)
                </div>
                <p className="text-gray-600">
                  In <b>Configuration → Network → Basic Settings → TCP/IP</b>:
                </p>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px] bg-white p-2.5 rounded-xl border border-slate-200">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Default Gateway:</span>
                    <span className="font-bold text-gray-800">192.168.0.1</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Preferred DNS:</span>
                    <span className="font-bold text-gray-800">8.8.8.8 (Google)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                onClick={() => setTerminalGuideOpen(false)}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold px-6"
              >
                Done
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
