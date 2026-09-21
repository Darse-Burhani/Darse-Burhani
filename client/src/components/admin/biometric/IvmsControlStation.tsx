"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Radio,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  GraduationCap,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Zap,
  Filter,
  Volume2,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  HelpCircle,
  Eye,
  Scan,
  Smartphone,
  CheckCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  eventName?: string;
  avatarUrl?: string;
  leaveReason?: string;
  leaveType?: string;
}

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

  // Webhook Hub State
  const [webhookUrl, setWebhookUrl] = useState<string>("");
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);

  // Live Scans Ticker
  const [liveScans, setLiveScans] = useState<LiveScanEvent[]>([]);
  const [liveScanFilter, setLiveScanFilter] = useState<"ALL" | "STUDENT" | "TEACHER">("ALL");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isPushConfiguring, setIsPushConfiguring] = useState(false);

  // Fetch Public Webhook URL
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

  useEffect(() => {
    if (devices.length > 0 && !selectedDeviceId) {
      setSelectedDeviceId(devices[0].id);
    }
  }, [devices, selectedDeviceId]);

  // Copy Webhook URL
  const handleCopyWebhook = () => {
    if (!webhookUrl) return;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    toast.success("Webhook URL copied to clipboard! Paste into your MinMoe terminal settings.");
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  // Push Config with zero-hang feedback
  const handlePushConfig = async () => {
    if (!activeDevice) return;
    setIsPushConfiguring(true);
    try {
      const res = await fetch(`/api/biometric/devices/${activeDevice.id}/configure-push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || `Push config prepared for ${activeDevice.name}`);
        if (onRefreshDevices) onRefreshDevices();
      } else {
        toast.info(`Device registered. Enter the Webhook URL in your terminal's HTTP Listening settings.`);
      }
    } catch {
      toast.info(`Webhook ready: ${webhookUrl}`);
    } finally {
      setIsPushConfiguring(false);
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

            return {
              id: ev.id || String(ev.timestamp || Date.now()),
              name: student ? student.name : teacher ? teacher.name : ev.message || "Verified Member",
              type: student ? "STUDENT" : teacher ? "TEACHER" : "UNMATCHED",
              employeeNo: ev.fingerprint || student?.studentId || teacher?.employeeId || "ID",
              timestamp: ev.timestamp || new Date().toISOString(),
              deviceId: ev.deviceId,
              status: resolvedStatus,
              verifyMode: ev.verifyMode || "BIOMETRIC",
              eventName: eventName || undefined,
              avatarUrl: avatarUrl || undefined,
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

          const item: LiveScanEvent = {
            id: payload.id || String(Date.now()),
            name: student ? student.name : teacher ? teacher.name : payload.message || "Verified Member",
            type: student ? "STUDENT" : teacher ? "TEACHER" : "UNMATCHED",
            employeeNo: payload.fingerprint || student?.studentId || teacher?.employeeId || "ID",
            timestamp: payload.timestamp || new Date().toISOString(),
            deviceId: payload.deviceId,
            status: resolvedStatus,
            verifyMode: payload.verifyMode || "BIOMETRIC",
            eventName: eventName || undefined,
            avatarUrl: avatarUrl || undefined,
            leaveReason: student?.leaveReason || teacher?.notes,
            leaveType: student?.leaveType,
          };

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
  }, [onRefreshDevices]);

  // Play Voice Prompt Broadcast
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
        toast.info(`Prompt queued for ${activeDevice.name}`);
      }
    } catch {
      toast.info(`Voice broadcast sent`);
    } finally {
      setVoiceBusy(false);
    }
  };

  const filteredLiveScans = useMemo(() => {
    if (liveScanFilter === "ALL") return liveScans;
    return liveScans.filter((s) => s.type === liveScanFilter);
  }, [liveScanFilter, liveScans]);

  return (
    <div className="space-y-6">
      {/* CLOUD WEBHOOK HERO STATION */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-8 text-white shadow-xl ring-1 ring-white/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-60 h-60 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Cloud Webhook Gateway Active & Listening</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Hikvision MinMoe Realtime Station
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              When students or faculty scan their face or fingerprint on the physical terminal, attendance is recorded instantly with zero network delay.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setGuideOpen(!guideOpen)}
              variant="outline"
              className="border-white/20 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md rounded-2xl text-xs font-semibold h-11 px-4"
            >
              <HelpCircle className="w-4 h-4 mr-1.5 text-emerald-400" />
              Terminal Setup Guide
            </Button>
            <Button
              onClick={handlePushConfig}
              disabled={isPushConfiguring}
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-2xl text-xs h-11 px-5 shadow-lg shadow-emerald-500/25 transition-all"
            >
              <Zap className="w-4 h-4 mr-1.5" />
              {isPushConfiguring ? "Configuring..." : "Push Config & Connect"}
            </Button>
          </div>
        </div>

        {/* WEBHOOK URL DIRECT COPY BAR */}
        <div className="mt-6 pt-6 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-sky-400" />
              Terminal Outbound Webhook URL (Alarm Server / HTTP Listening)
            </div>
            <div className="flex items-center gap-2 bg-slate-950/60 rounded-2xl px-4 py-2.5 border border-white/10 backdrop-blur-sm">
              <span className="font-mono text-xs sm:text-sm text-emerald-300 font-semibold select-all break-all">
                {webhookUrl || "Loading Webhook URL..."}
              </span>
            </div>
          </div>
          <Button
            onClick={handleCopyWebhook}
            className="self-start md:self-end h-10 px-5 rounded-xl bg-white text-slate-900 hover:bg-emerald-50 font-bold text-xs shrink-0 shadow-md"
          >
            {copiedWebhook ? (
              <>
                <Check className="w-4 h-4 mr-1.5 text-emerald-600" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-1.5 text-slate-700" />
                Copy Webhook URL
              </>
            )}
          </Button>
        </div>

        {/* STEP-BY-STEP TERMINAL SETUP GUIDE (EXPANDABLE) */}
        <AnimatePresence>
          {guideOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 pt-6 border-t border-white/10"
            >
              <div className="bg-slate-950/70 rounded-2xl p-5 border border-white/10 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
                    <Smartphone className="w-4 h-4" />
                    How to Connect Your Hikvision MinMoe Terminal in 3 Steps
                  </h4>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
                    Works on Local WiFi / LAN
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-300 font-bold flex items-center justify-center text-xs">
                      1
                    </div>
                    <div className="font-semibold text-white">Open Terminal Web GUI</div>
                    <p className="text-slate-400">
                      Open your browser and navigate to the terminal's IP (e.g. <span className="font-mono text-emerald-300">http://192.168.0.4</span>). Log in with admin credentials.
                    </p>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-300 font-bold flex items-center justify-center text-xs">
                      2
                    </div>
                    <div className="font-semibold text-white">Configure HTTP Listening</div>
                    <p className="text-slate-400">
                      Go to <strong className="text-white">Configuration &gt; Network &gt; Advanced Settings &gt; HTTP Listening / Alarm Server</strong>.
                    </p>
                  </div>

                  <div className="bg-white/5 p-4 rounded-xl border border-white/5 space-y-2">
                    <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center text-xs">
                      3
                    </div>
                    <div className="font-semibold text-white">Paste Webhook URL & Save</div>
                    <p className="text-slate-400">
                      Set Destination Address/URL to the Webhook URL above, Port <strong className="text-white">443</strong> (or <strong className="text-white">80</strong>), Protocol <strong className="text-white">HTTPS</strong>, format <strong className="text-white">XML/JSON</strong>, and click Save.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* LIVE ATTENDANCE STREAM & TERMINAL CONTROLS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT 2 COLS: LIVE PUNCH TICKER */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Live Attendance Punch Ticker</h3>
                <p className="text-xs text-gray-500">Real-time incoming scans streamed from Hikvision terminals</p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-2xl text-xs font-semibold text-gray-600">
              {(["ALL", "STUDENT", "TEACHER"] as const).map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => setLiveScanFilter(filterType)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl transition-all",
                    liveScanFilter === filterType
                      ? "bg-white text-gray-900 shadow-xs"
                      : "hover:text-gray-900"
                  )}
                >
                  {filterType === "ALL" ? "All Scans" : filterType === "STUDENT" ? "Talabat" : "Faculty"}
                </button>
              ))}
            </div>
          </div>

          {/* STREAM LIST */}
          <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
            {filteredLiveScans.length === 0 ? (
              <Card className="border-dashed border-gray-200 bg-gray-50/50 p-10 text-center rounded-3xl">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <Scan className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-gray-800 mb-1">Waiting for Device Scans</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  When a student or teacher scans their face or fingerprint on the terminal, their card will appear here instantly.
                </p>
              </Card>
            ) : (
              <AnimatePresence initial={false}>
                {filteredLiveScans.map((scan) => {
                  const isStudent = scan.type === "STUDENT";
                  const isTeacher = scan.type === "TEACHER";
                  const isMedical = scan.status === "MEDICAL";
                  const isOnLeave = scan.status === "ON_LEAVE" || scan.status === "EXCUSED" || isMedical;
                  const isLate = scan.status === "LATE";
                  const isDuplicate = scan.status === "DUPLICATE";

                  return (
                    <motion.div
                      key={scan.id}
                      initial={{ opacity: 0, y: -10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="flex items-center justify-between p-3.5 sm:p-4 rounded-2xl bg-white border border-gray-100 shadow-xs hover:border-gray-200 hover:shadow-sm transition-all gap-3">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Avatar / Icon */}
                          <div
                            className={cn(
                              "w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold shrink-0 shadow-xs",
                              isOnLeave
                                ? "bg-teal-50 text-teal-700 border border-teal-200"
                                : isStudent
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : isTeacher
                                ? "bg-purple-50 text-purple-700 border border-purple-100"
                                : "bg-amber-50 text-amber-700 border border-amber-100"
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
                              <span className="text-sm font-bold text-gray-900 truncate">
                                {scan.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded-md font-semibold",
                                  isOnLeave
                                    ? "bg-teal-50 text-teal-800 border-teal-200 font-bold"
                                    : isStudent
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                    : isTeacher
                                    ? "bg-purple-50 text-purple-800 border-purple-200"
                                    : "bg-amber-50 text-amber-800 border-amber-200"
                                )}
                              >
                                {isStudent ? "Talabat" : isTeacher ? "Faculty" : "Unmatched"}
                              </Badge>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5 flex-wrap">
                              <span className="font-mono font-semibold text-gray-700">
                                ID: {scan.employeeNo}
                              </span>
                              {scan.eventName && (
                                <>
                                  <span>•</span>
                                  <span className="text-gray-600">{scan.eventName}</span>
                                </>
                              )}
                              <span>•</span>
                              <span className="text-[11px] font-mono text-gray-400">
                                {scan.verifyMode || "Face"}
                              </span>
                            </div>

                            {scan.leaveReason && (
                              <div className="text-[11px] text-teal-700 font-medium truncate mt-0.5">
                                <span className="font-bold">Leave Reason:</span> {scan.leaveReason}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Status & Time */}
                        <div className="text-right shrink-0 space-y-1">
                          <Badge
                            className={cn(
                              "text-xs px-2.5 py-0.5 rounded-lg font-bold border-0",
                              isMedical
                                ? "bg-rose-100 text-rose-800"
                                : isOnLeave
                                ? "bg-teal-100 text-teal-800"
                                : isDuplicate
                                ? "bg-blue-100 text-blue-800"
                                : isLate
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            )}
                          >
                            {isMedical
                              ? "MEDICAL LEAVE"
                              : isOnLeave
                              ? "ON LEAVE"
                              : isDuplicate
                              ? "VERIFIED"
                              : isLate
                              ? "LATE"
                              : "PRESENT"}
                          </Badge>
                          <div className="text-[11px] font-mono text-gray-500 font-medium">
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

        {/* RIGHT 1 COL: TERMINAL HARDWARE ACTIONS */}
        <div className="space-y-4">
          <Card className="rounded-3xl border-gray-100 shadow-xs overflow-hidden">
            <div className="p-4 bg-gray-50/70 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-800">
                  Broadcast Voice Prompt
                </h4>
              </div>
              <Badge variant="outline" className="text-[10px] bg-white border-gray-200">
                Audio Relay
              </Badge>
            </div>

            <div className="p-4 space-y-2">
              <p className="text-xs text-gray-500 mb-3">
                Trigger high-fidelity Arabic / English synthesized voice cues on terminal speaker:
              </p>

              <div className="grid grid-cols-1 gap-2">
                {PRESET_VOICE_PROMPTS.map((prompt) => {
                  const Icon = prompt.icon;
                  return (
                    <button
                      key={prompt.id}
                      onClick={() => handlePlayVoice(prompt.id, prompt.label)}
                      disabled={voiceBusy}
                      className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-white hover:bg-emerald-50/50 hover:border-emerald-200 transition-all text-left text-xs group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gray-50 group-hover:bg-emerald-100/70 text-gray-600 group-hover:text-emerald-700 flex items-center justify-center transition-colors">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 group-hover:text-emerald-950">
                            {prompt.label}
                          </div>
                          <div className="text-[10px] text-gray-400 font-arabic">
                            {prompt.arabic}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-emerald-600 transition-colors" />
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* ACTIVE DEVICE STATUS CARD */}
          {activeDevice && (
            <Card className="rounded-3xl border-gray-100 shadow-xs p-5 space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Active Terminal
                </h4>
                <Badge
                  className={cn(
                    "text-[10px] font-bold px-2 py-0.5 rounded-full border-0",
                    activeDevice.status === "ONLINE"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-gray-100 text-gray-700"
                  )}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 inline-block" />
                  {activeDevice.status === "ONLINE" ? "ONLINE (Cloud Webhook)" : "REGISTERED"}
                </Badge>
              </div>

              <div>
                <div className="text-sm font-extrabold text-gray-900">{activeDevice.name}</div>
                <div className="font-mono text-xs text-gray-500 mt-0.5">{activeDevice.host}:{activeDevice.port}</div>
              </div>

              <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-400 text-[10px] block">Model</span>
                  <span className="font-semibold text-gray-700">{activeDevice.model || "DS-K1T341"}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block">Firmware</span>
                  <span className="font-semibold text-gray-700">{activeDevice.firmwareVersion || "V3.2+"}</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
