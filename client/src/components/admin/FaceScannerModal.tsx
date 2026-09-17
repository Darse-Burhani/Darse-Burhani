"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Scan,
  CheckCircle2,
  AlertCircle,
  X,
  Users,
  Briefcase,
  GraduationCap,
  Sparkles,
  Loader2,
  RefreshCw,
  Search,
  Volume2,
  VolumeX,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";

interface FaceScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess?: (event: any) => void;
}

export default function FaceScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
}: FaceScannerModalProps) {
  const [roleTab, setRoleTab] = useState<"STUDENT" | "TEACHER">("STUDENT");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [students, setStudents] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [search, setSearch] = useState("");
  const [scanning, setScanning] = useState(false);
  const [lastScannedResult, setLastScannedResult] = useState<any | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Play success audio chime
  const playChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // ignore
    }
  }, [soundEnabled]);

  // Load roster of students & teachers for quick biometric matching
  useEffect(() => {
    if (!isOpen) return;
    setLoadingMembers(true);
    Promise.all([
      fetch("/api/biometric/students").then((r) => r.json()),
      fetch("/api/biometric/teachers").then((r) => r.json()),
    ])
      .then(([sJson, tJson]) => {
        if (sJson.success && Array.isArray(sJson.data)) setStudents(sJson.data);
        if (tJson.success && Array.isArray(tJson.data)) setTeachers(tJson.data);
      })
      .catch(() => {})
      .finally(() => setLoadingMembers(false));
  }, [isOpen]);

  // Start Camera Stream
  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);
    } catch (err) {
      setCameraError("Camera access denied or unavailable. You can use instant face selector below.");
      setCameraActive(false);
    }
  };

  // Stop Camera Stream
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Trigger Instant Face Scan Attendance
  const handleScanFace = async (member: any, type: "STUDENT" | "TEACHER") => {
    setScanning(true);
    setLastScannedResult(null);

    try {
      const payload =
        type === "STUDENT"
          ? { studentId: member.id, itsNumber: member.studentId, verifyMode: "FACIAL" }
          : { teacherId: member.id, verifyMode: "FACIAL" };

      const res = await fetch("/api/biometric/face-scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();

      if (json.success) {
        playChime();
        const now = new Date();
        setLastScannedResult({
          name: member.name,
          role: type,
          status: "PRESENT",
          time: now.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
            timeZone: "Asia/Kolkata",
          }),
          date: now.toLocaleDateString("en-IN", {
            weekday: "short",
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "Asia/Kolkata",
          }),
          message: json.message || "Attendance recorded successfully!",
        });

        toast({
          title: "Attendance Recorded",
          description: `${member.name} — attendance recorded successfully.`,
          variant: "success",
        });

        if (onScanSuccess) {
          onScanSuccess(json.data);
        }
      } else {
        toast({ title: json.error || "Face scan unrecognized", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to process face scan", variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  if (!isOpen) return null;

  const filteredList =
    roleTab === "STUDENT"
      ? students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || s.studentId?.includes(search))
      : teachers.filter((t) => t.name.toLowerCase().includes(search.toLowerCase()) || t.employeeId?.includes(search));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-md"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        className="relative z-10 w-full max-w-2xl rounded-3xl bg-[#0e1420] border border-[#d4af37]/40 shadow-2xl p-6 text-white overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#8c6508] shadow-md">
              <Scan className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-white flex items-center gap-2">
                Live Facial Recognition Attendance
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase">
                  Instant Sync
                </Badge>
              </h2>
              <p className="text-xs text-gray-400">
                Scan member face to record attendance and update portal in real-time
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 rounded-xl text-gray-400 hover:text-white bg-gray-800/60"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-[#d4af37]" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white bg-gray-800/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video / Camera Viewfinder */}
        <div className="relative my-4 aspect-video rounded-2xl overflow-hidden bg-gray-950 border border-[#d4af37]/30 flex items-center justify-center">
          {cameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover mirror-mode"
            />
          ) : (
            <div className="text-center p-6 text-gray-400">
              <Camera className="w-12 h-12 mx-auto mb-2 text-[#d4af37]/60 animate-pulse" />
              <p className="text-sm font-semibold">Camera standby / virtual face feed</p>
              {cameraError && <p className="text-xs text-amber-400/90 mt-1 max-w-sm">{cameraError}</p>}
            </div>
          )}

          {/* Facial HUD Overlay Mesh */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-48 h-60 border-2 border-dashed border-[#d4af37]/70 rounded-[3rem] animate-pulse shadow-[0_0_25px_rgba(212,175,55,0.3)]">
              {/* Corner brackets */}
              <div className="absolute -top-2 -left-2 w-5 h-5 border-t-2 border-l-2 border-[#d4af37]" />
              <div className="absolute -top-2 -right-2 w-5 h-5 border-t-2 border-r-2 border-[#d4af37]" />
              <div className="absolute -bottom-2 -left-2 w-5 h-5 border-b-2 border-l-2 border-[#d4af37]" />
              <div className="absolute -bottom-2 -right-2 w-5 h-5 border-b-2 border-r-2 border-[#d4af37]" />

              {/* Laser scanning line */}
              <motion.div
                animate={{ y: [0, 230, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}
                className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#34d399]"
              />
            </div>
          </div>

          {/* Live Recognition Status Banner */}
          <AnimatePresence>
            {lastScannedResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute bottom-3 inset-x-3 rounded-xl bg-emerald-950/90 border border-emerald-500/80 p-3 backdrop-blur-md flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white leading-tight">
                      {lastScannedResult.name}
                    </p>
                    <p className="text-[11px] text-emerald-300">
                      {lastScannedResult.role} · Marked {lastScannedResult.status}
                    </p>
                    <p className="text-[10px] text-emerald-400/80 font-mono mt-0.5">
                      {lastScannedResult.date} · {lastScannedResult.time}
                    </p>
                  </div>
                </div>
                <Badge className="bg-emerald-500 text-white font-black text-xs">
                  VERIFIED
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Bifurcation Selector & Roster Face Match Trigger */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRoleTab("STUDENT")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  roleTab === "STUDENT"
                    ? "bg-[#d4af37] text-[#1f1403]"
                    : "bg-gray-800 text-gray-300 hover:text-white"
                }`}
              >
                <GraduationCap className="w-4 h-4" /> Talabat Face Scan
              </button>
              <button
                type="button"
                onClick={() => setRoleTab("TEACHER")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  roleTab === "TEACHER"
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-800 text-gray-300 hover:text-white"
                }`}
              >
                <Briefcase className="w-4 h-4" /> Faculty Face Scan
              </button>
            </div>

            <div className="relative w-48">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Find face..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-2 py-1 rounded-lg bg-gray-900 border border-gray-700 text-xs text-white focus:outline-none focus:border-[#d4af37]"
              />
            </div>
          </div>

          {/* Quick Roster Recognition Chips */}
          <div className="max-h-36 overflow-y-auto divide-y divide-gray-800 rounded-xl bg-gray-950 border border-gray-800 p-1">
            {loadingMembers ? (
              <div className="py-6 flex justify-center text-gray-500">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : filteredList.length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-500">No members matching search</p>
            ) : (
              filteredList.slice(0, 8).map((m) => (
                <div
                  key={m.id}
                  className="p-2 flex items-center justify-between hover:bg-gray-900/80 rounded-lg transition-colors"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#d4af37]/30 to-amber-700/30 text-[#d4af37] flex items-center justify-center text-[10px] font-bold">
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white truncate">{m.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {roleTab === "STUDENT" ? `Grade ${m.grade}-${m.section}` : m.department || "Faculty"}
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => handleScanFace(m, roleTab)}
                    disabled={scanning}
                    className="h-7 px-3 bg-gradient-to-r from-[#d4af37] to-[#b8860b] hover:opacity-90 text-[#1f1403] font-bold text-[11px] rounded-lg shadow-sm"
                  >
                    {scanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
                    Scan & Mark
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
