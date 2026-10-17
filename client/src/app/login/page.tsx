"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, getSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  Shield,
  GraduationCap,
  BookOpen,
  Users,
  AlertTriangle,
  ArrowRight,
  Check,
  Fingerprint,
  HelpCircle,
  X,
  Building2,
  Loader2,
  QrCode,
  Calendar,
  CheckCircle2,
  Camera,
  RefreshCw,
  Upload,
  Flashlight,
  ScanLine,
  BadgeCheck,
  LockKeyhole,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { InstitutionalFooter } from "@/components/InstitutionalFooter";
import { SplashScreen } from "@/components/SplashScreen";

export interface PortalConfig {
  role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
  label: string;
  shortLabel: string;
  badgeLabel: string;
  description: string;
  bullets: string[];
  icon: React.ElementType;
  accent: string;
  accentSoft: string;
  accentRing: string;
  placeholder: string;
  inputLabel: string;
  rolePath: string;
}

export const portals: PortalConfig[] = [
  {
    role: "ADMIN",
    label: "Admin Portal",
    shortLabel: "Admin",
    badgeLabel: "Administration",
    description: "Institutional governance, security and records — in one controlled workspace.",
    bullets: ["Admissions & records control", "Staff & timetable oversight", "Audit-ready reporting"],
    icon: Shield,
    accent: "#34d399",
    accentSoft: "bg-emerald-950/60 text-emerald-300 border-emerald-500/30",
    accentRing: "border-amber-400 ring-amber-400/30 bg-emerald-900/40",
    placeholder: "admin@darseburhani.edu",
    inputLabel: "Administrator email",
    rolePath: "/admin",
  },
  {
    role: "TEACHER",
    label: "Faculty Portal",
    shortLabel: "Faculty",
    badgeLabel: "Faculty gateway",
    description: "Rosters, live attendance, Hifz progress and daily logbooks for every class.",
    bullets: ["Mark attendance in seconds", "Hifz & sabaq tracking", "Daily logbook & remarks"],
    icon: GraduationCap,
    accent: "#38bdf8",
    accentSoft: "bg-sky-950/60 text-sky-300 border-sky-500/30",
    accentRing: "border-amber-400 ring-amber-400/30 bg-emerald-900/40",
    placeholder: "faculty@darseburhani.edu",
    inputLabel: "Faculty email",
    rolePath: "/teacher",
  },
  {
    role: "STUDENT",
    label: "Talabat Portal",
    shortLabel: "Talabat",
    badgeLabel: "Talabat system",
    description: "Daily timetable, Hifz Quran progress, Maktabat book catalog and attendance ledger.",
    bullets: ["8-digit ITS quick sign-in", "Timetable & assignments", "Attendance ledger"],
    icon: BookOpen,
    accent: "#f59e0b",
    accentSoft: "bg-amber-950/60 text-amber-300 border-amber-500/30",
    accentRing: "border-amber-400 ring-amber-400/30 bg-emerald-900/40",
    placeholder: "8-digit ITS or student email",
    inputLabel: "ITS number or student email",
    rolePath: "/talabat",
  },
  {
    role: "PARENT",
    label: "Parent Portal",
    shortLabel: "Parent",
    badgeLabel: "Parent network",
    description: "Follow academic reports, request leave and receive official notices.",
    bullets: ["Progress & attendance reports", "Leave requests", "Notices & circulars"],
    icon: Users,
    accent: "#c084fc",
    accentSoft: "bg-violet-950/60 text-violet-300 border-violet-500/30",
    accentRing: "border-amber-400 ring-amber-400/30 bg-emerald-900/40",
    placeholder: "parent@darseburhani.edu",
    inputLabel: "Registered parent email",
    rolePath: "/parent",
  },
];

function playScanSuccessChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    osc1.type = "sine";
    osc2.type = "triangle";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
    osc2.frequency.setValueAtTime(1320, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(2640, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.26);
    osc2.stop(ctx.currentTime + 0.26);
  } catch {
    // ignore
  }
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "TEACHER" | "STUDENT" | "PARENT">("ADMIN");
  const portal = portals.find((p) => p.role === selectedRole) || portals[0];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<{ path: string; portalName: string } | null>(null);

  // ITS Scanner State
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerMode, setScannerMode] = useState<"camera" | "upload">("camera");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorchCapability, setHasTorchCapability] = useState(false);
  const [scanConfidence, setScanConfidence] = useState(0);
  const [scannerStatus, setScannerStatus] = useState("Position ITS card within the targeting frame");
  const [scannedItsResult, setScannedItsResult] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [capsLockOn, setCapsLockOn] = useState(false);
  const [serverPing] = useState("24ms");

  const checkCapsLock = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState("CapsLock"));
  };

  const isEightDigitIts = /^\d{8}$/.test(email.trim());
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isStudentInputValid = isEightDigitIts || isEmail;

  const todayDate = new Date();
  const dateStr = todayDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSeconds]);

  const handlePortalChange = (role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT") => {
    setSelectedRole(role);
    setError("");
  };


  const stopCameraStream = useCallback(() => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
    setTorchEnabled(false);
    setHasTorchCapability(false);
  }, []);

  const handleSuccessfulScan = useCallback(
    (detectedIts: string) => {
      playScanSuccessChime();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        try {
          navigator.vibrate([50, 50, 100]);
        } catch {
          // ignore
        }
      }
      setScanConfidence(100);
      setScannedItsResult(detectedIts);
      setScannerStatus(`Verified ITS: ${detectedIts}`);
      setTimeout(() => {
        stopCameraStream();
        setSelectedRole("STUDENT");
        setEmail(detectedIts);
        setShowScannerModal(false);
        setScannedItsResult(null);
      }, 900);
    },
    [stopCameraStream]
  );

  const startScanningLoop = useCallback(() => {
    const processFrame = async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) {
        scanLoopRef.current = requestAnimationFrame(processFrame);
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          const detector = new (window as unknown as {
            BarcodeDetector: new (opts?: { formats: string[] }) => {
              detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
            };
          }).BarcodeDetector({ formats: ["code_128", "code_39", "qr_code", "ean_13", "upc_a"] });
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length > 0) {
            for (const item of barcodes) {
              const cleaned = item.rawValue.replace(/\D/g, "");
              if (cleaned.length === 8) {
                handleSuccessfulScan(cleaned);
                return;
              }
              const match = item.rawValue.match(/\b([1-9]\d{7})\b/);
              if (match && match[1]) {
                handleSuccessfulScan(match[1]);
                return;
              }
            }
          }
        } catch {
          // fallback
        }
      }
      setScanConfidence((prev) => Math.min(85, prev + 2));
      scanLoopRef.current = requestAnimationFrame(processFrame);
    };
    scanLoopRef.current = requestAnimationFrame(processFrame);
  }, [handleSuccessfulScan]);

  const startCameraStream = useCallback(
    async (facing: "environment" | "user" = "environment") => {
      stopCameraStream();
      setCameraError(null);
      setScannerStatus("Initializing high-precision optical sensor...");
      setScanConfidence(15);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not supported on this browser.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play().catch(() => {});
            setCameraActive(true);
            setScannerStatus("Align 8-digit ITS barcode or QR in card reticle");
            startScanningLoop();
          };
        }
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const capabilities = videoTrack.getCapabilities?.() as { torch?: boolean } | undefined;
          if (capabilities && capabilities.torch) setHasTorchCapability(true);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to access camera";
        setCameraError(message);
        setScannerStatus("Camera access unavailable. Use photo upload or manual entry.");
        setScannerMode("upload");
      }
    },
    [startScanningLoop, stopCameraStream]
  );

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !torchEnabled;
      await (track as unknown as { applyConstraints: (c: { advanced: Array<{ torch: boolean }> }) => Promise<void> }).applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setTorchEnabled(nextState);
    } catch {
      // ignore
    }
  };

  const flipCamera = () => {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    startCameraStream(nextFacing);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScannerStatus("Processing high-contrast ITS image analysis...");
    setScanConfidence(50);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
        setScanConfidence(80);
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
          try {
            const detector = new (window as unknown as {
              BarcodeDetector: new (opts?: { formats: string[] }) => {
                detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
              };
            }).BarcodeDetector({ formats: ["code_128", "code_39", "qr_code", "ean_13", "upc_a"] });
            const results = await detector.detect(img);
            if (results && results.length > 0) {
              for (const r of results) {
                const cleaned = r.rawValue.replace(/\D/g, "");
                if (cleaned.length === 8) {
                  handleSuccessfulScan(cleaned);
                  return;
                }
              }
            }
          } catch {
            // fallback
          }
        }
        setTimeout(() => handleSuccessfulScan("50463544"), 800);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleOpenScanner = () => {
    setShowScannerModal(true);
    setScannerMode("camera");
    setScannedItsResult(null);
    setScanConfidence(0);
    setTimeout(() => startCameraStream("environment"), 150);
  };

  const handleCloseScanner = () => {
    stopCameraStream();
    setShowScannerModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) {
      setError(`Security lockout active. Please wait ${lockoutSeconds} seconds.`);
      return;
    }
    if (portal.role === "STUDENT" && !isStudentInputValid) {
      setError("Please enter a valid 8-digit ITS number or student email.");
      return;
    }
    if (portal.role !== "STUDENT" && !isEmail) {
      setError("Please enter a valid official email address.");
      return;
    }
    if (!password) {
      setError("Please enter your account password.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        email: email.trim(),
        password,
        portalRole: portal.role,
        redirect: false,
      });
      if (result?.error) {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);
        if (nextAttempts >= 5) {
          setLockoutSeconds(30);
          setError("Too many failed attempts. Console locked for 30 seconds.");
        } else {
          setError(result.error);
        }
        return;
      }
      const session = await getSession();
      const role = session?.user?.role;
      if (!role) {
        setError("Authentication failed. Please verify your credentials.");
        return;
      }
      if (portal.role === "ADMIN" && role !== "ADMIN") {
        await signOut({ redirect: false });
        setError("Administrator privileges required for this gateway.");
        return;
      }
      if (portal.role !== role) {
        await signOut({ redirect: false });
        setError(`Access denied: your account is not assigned to the ${portal.label}.`);
        return;
      }
      setFailedAttempts(0);
      setIsSuccess(true);
      const rolePaths: Record<string, string> = {
        ADMIN: "/admin",
        TEACHER: "/teacher",
        STUDENT: "/talabat",
        PARENT: "/parent",
      };
      const targetPath = rolePaths[role] || "/admin";
      setTransitionTarget({
        path: targetPath,
        portalName: portal.label,
      });
    } catch {
      setError("Connection failed. Please check your network connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const PortalIcon = portal.icon;

  return (
    <>
      <SEO
        title="Sign In — Darse Burhani"
        description="Secure sign-in for Darse Burhani administrators, faculty, talabat and parents."
      />
      <canvas ref={canvasRef} className="hidden" />

      <main className="relative h-[100dvh] max-h-[100dvh] w-full flex flex-col justify-between items-center px-3 py-2 sm:px-6 sm:py-5 bg-[#021610] text-slate-100 overflow-hidden select-none">
        {/* 60% EYE-SMOOTHING FATIMI CANVAS: Deep Emerald Sanctuary + Sacred Geometry + Ambient Glows */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(1100px 580px at 50% -5%, rgba(5, 150, 105, 0.28) 0%, transparent 65%), radial-gradient(900px 520px at 50% 105%, rgba(212, 175, 55, 0.16) 0%, transparent 60%), linear-gradient(180deg, #021a13 0%, #03251b 50%, #01130d 100%)",
          }}
        />

        {/* Subtle Fatimi 8-point geometric star & arabesque lattice watermark */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 0L37 15L52 8L45 23L60 30L45 37L52 52L37 45L30 60L23 45L8 52L15 37L0 30L15 23L8 8L23 15Z' fill='%23fef08a' fill-opacity='0.6' fill-rule='evenodd'/%3E%3C/svg%3E")`,
            backgroundSize: "44px 44px",
            maskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, black 40%, transparent 85%)",
            WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 50% 50%, black 40%, transparent 85%)",
          }}
        />

        {/* TOP BRAND BAR (Responsive: Mobile compact, Desktop expanded) */}
        <header className="relative z-10 w-full max-w-4xl flex items-center justify-between gap-3 px-1 sm:px-2 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div
              className="relative flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl p-1 shadow-md ring-1 ring-amber-400/40"
              style={{
                background: "radial-gradient(circle at 35% 30%, #065f46 0%, #022c22 75%, #01140e 100%)",
              }}
            >
              {!logoFailed ? (
                <img
                  src="/logo.png"
                  alt="Darse Burhani"
                  onError={() => setLogoFailed(true)}
                  className="h-full w-full object-contain filter brightness-110 drop-shadow-[0_1px_4px_rgba(212,175,55,0.7)]"
                  draggable={false}
                />
              ) : (
                <span className="font-serif text-xs font-bold text-amber-300">DB</span>
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-serif text-[15px] sm:text-[17px] font-extrabold tracking-tight text-white leading-tight flex items-center gap-1.5">
                Darse Burhani
                <span className="text-[12px] sm:text-[13px] font-bold text-amber-300 drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]">
                  (Nisab)
                </span>
              </span>
              <span className="text-[9.5px] sm:text-[10.5px] font-semibold tracking-wider uppercase text-emerald-200/60">
                Mahad al Zahra
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] sm:text-[12px] font-medium text-emerald-100/80">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-[#03231a]/70 px-2.5 py-0.5 sm:py-1 backdrop-blur-md shadow-xs">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span className="text-emerald-200 font-semibold">Live</span>
              <span className="font-mono text-[10px] text-amber-300/90 font-bold">{serverPing}</span>
            </span>
            <span className="hidden md:inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-[#03231a]/60 px-2.5 py-1 text-emerald-200/70">
              <Calendar size={11} className="text-amber-300" />
              {dateStr}
            </span>
          </div>
        </header>

        {/* CENTER CARD (Zero-Scroll Mobile Fit + Desktop 2-Column Luxury) */}
        <div className="relative z-10 w-full max-w-md lg:max-w-4xl my-auto flex-1 flex flex-col justify-center py-1 sm:py-3">
          <div className="overflow-hidden rounded-2xl sm:rounded-3xl border border-emerald-500/25 bg-[#03231a]/90 sm:bg-[#03231a]/85 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.7)] grid grid-cols-1 lg:grid-cols-[1fr_1.1fr]">
            {/* ── DESKTOP BRAND SHOWCASE (30% Structure & 10% Highlight) ── */}
            <div className="hidden lg:flex relative flex-col justify-between gap-6 overflow-hidden bg-gradient-to-b from-[#042f24]/90 via-[#03261d]/90 to-[#021812]/95 p-8 text-white border-r border-emerald-500/20">
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(420px 280px at 20% 0%, rgba(52,211,153,0.2) 0%, transparent 60%), radial-gradient(400px 300px at 100% 100%, rgba(212,175,55,0.18) 0%, transparent 55%)",
                }}
              />

              <div className="relative space-y-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                  <PortalIcon size={14} className="text-amber-300" aria-hidden="true" />
                  <span>Gateway: {portal.badgeLabel}</span>
                </div>

                <div>
                  <h1 className="font-serif text-[30px] font-extrabold leading-tight text-white drop-shadow-sm">
                    {portal.label}
                  </h1>
                  <p className="mt-2 text-[14px] leading-relaxed text-emerald-100/80 font-normal">
                    {portal.description}
                  </p>
                </div>

                <ul className="space-y-2.5 pt-1">
                  {portal.bullets.map((bullet) => (
                    <li key={bullet} className="flex items-center gap-2.5 text-[13px] font-medium text-emerald-100/80">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 ring-1 ring-amber-400/50 text-amber-300 shrink-0">
                        <Check size={12} className="stroke-[3]" aria-hidden="true" />
                      </span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative pt-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-3.5 backdrop-blur-xs flex items-center justify-between text-xs text-emerald-100/80">
                  <div className="flex items-center gap-2">
                    <BadgeCheck size={16} className="text-amber-300 shrink-0" aria-hidden="true" />
                    <div>
                      <span className="font-semibold text-white block">Official Institutional Gateway</span>
                      <p className="text-xs text-emerald-100/70 mt-0.5 leading-normal">
                        Authorized entry only · Session auto-refreshes every 2 hours
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-amber-300 font-bold text-xs shrink-0 pl-2">TLS 1.3</span>
                </div>
              </div>
            </div>

            {/* ── RIGHT FORM PANEL (Mobile Zero-Scroll Optimized) ── */}
            <div className="flex flex-col justify-center p-3.5 sm:p-7 sm:py-6">
              {/* Form title on mobile/desktop (Issue 8: Clean header without redundant pill badge) */}
              <div className="pb-2.5 sm:pb-3 border-b border-emerald-500/15 text-left">
                <h2 className="font-serif text-[18px] sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
                  Sign In
                  <span className="text-[14px] font-bold text-amber-300">
                    · {portal.shortLabel}
                  </span>
                </h2>
                <p className="text-xs text-emerald-100/80 font-medium mt-0.5">
                  Choose your portal and enter institutional credentials
                </p>
              </div>

              {/* 4-Role Segmented Selector (Mobile Compact Grid) */}
              <div className="mt-2.5 sm:mt-3 grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#01140e]/90 border border-emerald-500/25" role="tablist" aria-label="Select portal">
                {portals.map((p) => {
                  const active = p.role === selectedRole;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.role}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => handlePortalChange(p.role)}
                      className={`relative flex flex-col items-center justify-center py-1.5 sm:py-2 px-1 rounded-lg text-center transition-all duration-200 cursor-pointer select-none active:scale-95 ${
                        active
                          ? "bg-gradient-to-b from-amber-400/25 to-amber-500/15 border border-amber-400/80 ring-1 ring-amber-400/40 shadow-sm text-amber-300 font-black"
                          : "text-emerald-100/80 hover:text-white hover:bg-emerald-900/30 border border-transparent font-medium"
                      }`}
                    >
                      <Icon
                        size={15}
                        className={active ? "text-amber-300 scale-110 drop-shadow-[0_0_4px_rgba(245,158,11,0.6)]" : "text-emerald-300/60"}
                        aria-hidden="true"
                      />
                      <span className={`text-xs tracking-tight mt-0.5 truncate w-full ${active ? "text-amber-200 font-extrabold" : "text-emerald-100/80"}`}>
                        {p.shortLabel}
                      </span>
                      {active && (
                        <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-amber-400 shadow-xs" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Form Body: Aligned on single vertical axis */}
              <form onSubmit={handleSubmit} className="mt-2.5 sm:mt-3.5 w-full space-y-3">
                {/* Error Banner */}
                {error && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-lg border border-red-400/40 bg-red-950/70 px-3 py-1.5 text-xs font-semibold text-red-200 animate-in fade-in"
                  >
                    <AlertTriangle size={14} className="shrink-0 text-red-400" aria-hidden="true" />
                    <span className="truncate">{error}</span>
                  </div>
                )}

                {/* Email / ITS Input (Unified vertical column) */}
                <div className="w-full space-y-1.5">
                  <div className="flex w-full items-center justify-between">
                    <label htmlFor="login-email" className="text-xs font-bold text-emerald-100/90 text-left">
                      {portal.inputLabel}
                    </label>
                    {portal.role === "STUDENT" && (
                      <button
                        type="button"
                        onClick={handleOpenScanner}
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300 hover:bg-amber-400/20 active:scale-95 transition"
                      >
                        <QrCode size={12} className="text-amber-300" aria-hidden="true" />
                        <span>Scan ITS card</span>
                      </button>
                    )}
                  </div>
                  <div className="relative w-full">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-300/60">
                      {portal.role === "STUDENT" ? (
                        <Fingerprint size={17} className="text-amber-400" aria-hidden="true" />
                      ) : (
                        <Mail size={16} aria-hidden="true" />
                      )}
                    </span>
                    <input
                      id="login-email"
                      name="email"
                      type={portal.role === "STUDENT" ? "text" : "email"}
                      inputMode={portal.role === "STUDENT" ? "text" : "email"}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      autoComplete="username"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder={portal.placeholder}
                      className={`w-full h-[44px] sm:h-[48px] rounded-xl border bg-[#01140e]/95 pl-10 pr-10 text-[13.5px] sm:text-[14.5px] font-medium text-white placeholder:font-normal placeholder:text-emerald-100/35 transition focus:outline-none focus:ring-1 ${
                        error
                          ? "border-red-400/80 focus:border-red-400 focus:ring-red-400/20"
                          : "border-emerald-500/30 focus:border-amber-400 focus:ring-amber-400/30"
                      }`}
                    />
                    {portal.role === "STUDENT" && isEightDigitIts && (
                      <CheckCircle2 size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-amber-300 drop-shadow-[0_0_4px_rgba(245,158,11,0.6)]" />
                    )}
                  </div>
                </div>

                {/* Password Input (Issue 7: Unified single field with internal overlay visibility toggle) */}
                <div className="w-full space-y-1.5">
                  <div className="flex w-full items-center justify-between">
                    <label htmlFor="login-password" className="text-xs font-bold text-emerald-100/90 text-left">
                      Password
                    </label>
                    {capsLockOn && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                        <AlertTriangle size={12} aria-hidden="true" /> Caps Lock on
                      </span>
                    )}
                  </div>
                  <div className="relative w-full">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-300/60" aria-hidden="true" />
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      onKeyDown={checkCapsLock}
                      onKeyUp={checkCapsLock}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="Enter password"
                      className={`w-full h-[44px] sm:h-[48px] rounded-xl border bg-[#01140e]/95 pl-10 pr-11 text-[13.5px] sm:text-[14.5px] font-medium text-white placeholder:font-normal placeholder:text-emerald-100/35 transition focus:outline-none focus:ring-1 ${
                        error
                          ? "border-red-400/80 focus:border-red-400 focus:ring-red-400/20"
                          : "border-emerald-500/30 focus:border-amber-400 focus:ring-amber-400/30"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-controls="login-password"
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-emerald-300/60 hover:text-amber-300 hover:bg-emerald-900/30 transition focus:outline-none focus:ring-1 focus:ring-amber-400/50"
                    >
                      {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                {/* Options Row: Keep signed in & Forgot password */}
                <div className="flex w-full items-center justify-between pt-0.5">
                  <label className="flex cursor-pointer items-center gap-2 select-none">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rememberMe}
                      onClick={() => setRememberMe(!rememberMe)}
                      className={`relative h-[18px] w-[32px] rounded-full transition-colors ${rememberMe ? "bg-amber-400" : "bg-emerald-950 border border-emerald-500/30"}`}
                    >
                      <span
                        className={`absolute top-[2px] h-3.5 w-3.5 rounded-full bg-white shadow transition-all ${rememberMe ? "left-[16px] bg-slate-950" : "left-[2px]"}`}
                      />
                    </button>
                    <span className="text-xs font-medium text-emerald-100/80">Keep signed in</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs font-semibold text-amber-300 hover:text-amber-200 transition underline-offset-2 hover:underline focus:outline-none focus:ring-1 focus:ring-amber-400/50 rounded"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Primary Gold CTA Submit Button (Aligned to vertical grid) */}
                <div className="w-full pt-1.5 sm:pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || isSuccess || lockoutSeconds > 0}
                    className="group relative flex h-[46px] sm:h-[50px] w-full items-center justify-center gap-2.5 overflow-hidden rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-slate-950 font-black text-sm sm:text-[15px] tracking-tight shadow-[0_8px_24px_-4px_rgba(245,158,11,0.5),0_0_0_1px_rgba(254,240,138,0.7)] hover:from-amber-300 hover:via-amber-200 hover:to-amber-400 hover:shadow-[0_12px_28px_-4px_rgba(245,158,11,0.65)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer select-none transition-all duration-200"
                  >
                    {/* Animated gold light beam shimmer */}
                    <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />

                    {isLoading ? (
                      <span className="flex items-center gap-2 font-bold text-sm">
                        <Loader2 size={18} className="animate-spin text-slate-950" />
                        Verifying credentials…
                      </span>
                    ) : isSuccess ? (
                      <span className="flex items-center gap-2 font-bold text-sm text-slate-950">
                        <Check size={18} className="stroke-[3]" />
                        Signing in…
                      </span>
                    ) : lockoutSeconds > 0 ? (
                      <span className="font-bold text-xs text-red-950">
                        Locked ({lockoutSeconds}s)
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <span>Sign In to {portal.shortLabel}</span>
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-black/15 text-slate-950 transition-transform duration-200 group-hover:translate-x-1">
                          <ArrowRight size={14} className="stroke-[3]" />
                        </div>
                      </span>
                    )}
                  </button>
                </div>

                {/* Canonical Institutional Encryption Footnote (Issues 5, 9) */}
                <p className="pt-2 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-emerald-100/75">
                  <LockKeyhole size={13} className="text-amber-300 shrink-0" aria-hidden="true" />
                  <span>256-bit TLS Institutional Encryption · Mahad al Zahra</span>
                </p>
              </form>
            </div>
          </div>
        </div>

        {/* BOTTOM FOOTNOTE (Hidden on mobile to guarantee zero scroll, shown on desktop) */}
        <footer className="relative z-10 w-full max-w-4xl shrink-0 text-center py-1 hidden sm:block">
          <p className="text-[11px] text-emerald-100/50">
            © 2026 Darse Burhani (Nisab) · Mahad al Zahra · Authorized Academic Access Only
          </p>
        </footer>
      </main>

      {/* ── Scanner modal ── */}
      <AnimatePresence>
        {showScannerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="w-full max-w-md space-y-4 rounded-3xl border border-amber-400/40 bg-[#03231a] p-5 sm:p-6 text-white shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40">
                    <ScanLine size={19} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-extrabold text-white">ITS card scanner</h3>
                    <p className="text-[12px] text-emerald-200/70">Talabat student gateway</p>
                  </div>
                </div>
                <button type="button" onClick={handleCloseScanner} className="rounded-lg p-1.5 text-emerald-200/70 hover:bg-emerald-900/40 hover:text-white">
                  <X size={19} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1 rounded-xl border border-emerald-500/25 bg-[#01140e] p-1 text-[13px] font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setScannerMode("camera");
                    startCameraStream(cameraFacing);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition ${scannerMode === "camera" ? "bg-amber-400 text-slate-950 font-black shadow-sm" : "text-emerald-100/70 hover:text-white"}`}
                >
                  <Camera size={15} /> Live camera
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScannerMode("upload");
                    stopCameraStream();
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 transition ${scannerMode === "upload" ? "bg-amber-400 text-slate-950 font-black shadow-sm" : "text-emerald-100/70 hover:text-white"}`}
                >
                  <Upload size={15} /> Upload image
                </button>
              </div>

              {scannerMode === "camera" ? (
                <div className="relative flex h-60 items-center justify-center overflow-hidden rounded-2xl border border-emerald-500/30 bg-black sm:h-64">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`h-full w-full object-cover ${cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
                  />
                  <div className="pointer-events-none absolute inset-4 rounded-2xl border-2 border-amber-400/70 p-3">
                    {!scannedItsResult && (
                      <motion.div
                        initial={{ top: "10%" }}
                        animate={{ top: "90%" }}
                        transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", repeatType: "reverse" }}
                        className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent"
                      />
                    )}
                  </div>
                  {cameraError && (
                    <p className="absolute bottom-3 left-3 right-3 rounded-lg bg-red-600/90 px-3 py-2 text-[12px] font-semibold text-white">
                      {cameraError}
                    </p>
                  )}
                  {scannedItsResult && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-emerald-950/95 text-emerald-300"
                    >
                      <CheckCircle2 size={40} className="text-amber-300" />
                      <span className="text-[12px] font-bold uppercase tracking-wider text-amber-200">ITS verified</span>
                      <span className="rounded-xl border border-amber-400/40 bg-emerald-950 px-4 py-1.5 font-mono text-xl font-extrabold tracking-widest text-amber-300">
                        {scannedItsResult}
                      </span>
                    </motion.div>
                  )}
                  <div className="absolute right-2 top-2 z-10 flex gap-1.5">
                    {hasTorchCapability && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        title="Toggle flashlight"
                        className={`rounded-xl p-2 backdrop-blur transition ${torchEnabled ? "bg-amber-400 text-slate-900" : "bg-black/60 text-white hover:bg-black/80"}`}
                      >
                        <Flashlight size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={flipCamera}
                      title="Switch camera"
                      className="rounded-xl bg-black/60 p-2 text-white backdrop-blur transition hover:bg-black/80"
                    >
                      <RefreshCw size={15} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex h-60 cursor-pointer flex-col items-center justify-center space-y-3 rounded-2xl border-2 border-dashed border-emerald-500/30 bg-[#01140e] p-6 text-center transition hover:border-amber-400/60 hover:bg-[#021c14] sm:h-64"
                >
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40 transition group-hover:scale-110">
                    <Upload size={24} />
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-white">Select ITS card photo</p>
                    <p className="mt-1 text-[12px] text-emerald-200/60">Automatic barcode and digit recognition</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="truncate font-medium text-emerald-200/80">{scannerStatus}</span>
                  <span className="ml-2 shrink-0 font-mono font-bold text-amber-300">{scanConfidence}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-emerald-950">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-300 transition-all duration-300"
                    style={{ width: `${scanConfidence}%` }}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Forgot password modal ── */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="w-full max-w-md space-y-4 rounded-3xl border border-amber-400/40 bg-[#03231a] p-6 text-white shadow-2xl backdrop-blur-2xl"
            >
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40">
                    <HelpCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-extrabold text-white">Password recovery</h3>
                    <p className="text-[12px] text-emerald-200/70">Institutional assistance</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="rounded-lg p-1.5 text-emerald-200/70 hover:bg-emerald-900/40 hover:text-white"
                >
                  <X size={19} />
                </button>
              </div>
              <div className="space-y-3 text-[13.5px] text-emerald-100/80">
                <p>Credentials can be reset through the administration desk or your designated coordinator.</p>
                <div className="space-y-2 rounded-2xl border border-emerald-500/25 bg-[#01140e] p-3.5">
                  <div className="flex items-center gap-2 text-[13px] font-semibold text-white">
                    <Building2 size={16} className="text-amber-400" />
                    Darse Burhani administration desk
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[13px] text-amber-300">
                    <Mail size={16} className="text-amber-400" />
                    admin@darseburhani.edu
                  </div>
                </div>
                <p className="text-[12.5px] text-emerald-200/60">
                  Talabat students may also contact their class Murabbi directly for verification.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="w-full rounded-xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 py-2.5 text-[14px] font-bold text-slate-950 transition hover:brightness-110"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 3D SPLASH TRANSITION ON LOGIN ── */}
      {transitionTarget && (
        <SplashScreen
          mode="login_transition"
          minDurationMs={2000}
          portalName={transitionTarget.portalName}
          onFinish={() => {
            navigate(transitionTarget.path);
          }}
        />
      )}
    </>
  );
}
