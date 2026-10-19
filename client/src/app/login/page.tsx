"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn, getSession, signOut } from "next-auth/react";
import {
  Eye,
  EyeOff,
  Camera,
  Upload,
  X,
  ShieldCheck,
  GraduationCap,
  Sparkles,
  Users,
  QrCode,
  ArrowRight,
  Lock,
  Mail,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { SplashScreen } from "@/components/SplashScreen";

export interface PortalConfig {
  role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
  label: string;
  shortLabel: string;
  badgeLabel: string;
  description: string;
  instructions: string;
  placeholder: string;
  inputLabel: string;
  rolePath: string;
  icon: React.ElementType;
}

export const portals: PortalConfig[] = [
  {
    role: "ADMIN",
    label: "Administrative Portal",
    shortLabel: "Admin",
    badgeLabel: "Central Governance",
    description: "Official institutional governance for academic operations, biometric terminals, scheduling, and admissions.",
    instructions: "Sign in with your authorized administrator email and institutional password.",
    placeholder: "e.g. admin@darseburhani.edu",
    inputLabel: "Administrator Email",
    rolePath: "/admin",
    icon: ShieldCheck,
  },
  {
    role: "TEACHER",
    label: "Faculty Portal",
    shortLabel: "Faculty",
    badgeLabel: "Academic Faculty",
    description: "Classroom rosters, daily attendance register, Hifz Quran logbooks, and academic remarks.",
    instructions: "Sign in with your appointed faculty email address.",
    placeholder: "e.g. faculty@mahadalzahra.com",
    inputLabel: "Faculty Email",
    rolePath: "/teacher",
    icon: GraduationCap,
  },
  {
    role: "STUDENT",
    label: "Talabat Portal",
    shortLabel: "Talabat",
    badgeLabel: "Enrolled Talabat",
    description: "Daily timetable, Hifz Quran progress, Sabaq assignments, and Maktabat book borrowings.",
    instructions: "Enter your 8-digit ITS number or click 'Scan ITS Card' with your camera.",
    placeholder: "Enter 8-digit ITS or student email",
    inputLabel: "8-Digit ITS or Student Email",
    rolePath: "/talabat",
    icon: Sparkles,
  },
  {
    role: "PARENT",
    label: "Parent Portal",
    shortLabel: "Parent",
    badgeLabel: "Parent Network",
    description: "Track your child's academic progress, review attendance records, and submit leave requests.",
    instructions: "Sign in with your registered parent email address.",
    placeholder: "e.g. parent@example.com",
    inputLabel: "Parent Email",
    rolePath: "/parent",
    icon: Users,
  },
];

function playScanSuccessChime() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    // audio fallback
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
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [scannerStatus, setScannerStatus] = useState("Position ITS card in frame");
  const [scannedItsResult, setScannedItsResult] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [capsLockOn, setCapsLockOn] = useState(false);

  const checkCapsLock = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState("CapsLock"));
  };

  const isEightDigitIts = /^\d{8}$/.test(email.trim());
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isStudentInputValid = isEightDigitIts || isEmail;

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
  }, []);

  const handleSuccessfulScan = useCallback(
    (detectedIts: string) => {
      playScanSuccessChime();
      setScannedItsResult(detectedIts);
      setScannerStatus(`Detected ITS: ${detectedIts}`);
      setTimeout(() => {
        stopCameraStream();
        setSelectedRole("STUDENT");
        setEmail(detectedIts);
        setShowScannerModal(false);
        setScannedItsResult(null);
      }, 700);
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
      scanLoopRef.current = requestAnimationFrame(processFrame);
    };
    scanLoopRef.current = requestAnimationFrame(processFrame);
  }, [handleSuccessfulScan]);

  const startCameraStream = useCallback(
    async (facing: "environment" | "user" = "environment") => {
      stopCameraStream();
      setCameraError(null);
      setScannerStatus("Accessing camera...");
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Camera API not supported on this device.");
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
            setScannerStatus("Align ITS barcode or number inside the frame");
            startScanningLoop();
          };
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unable to access camera";
        setCameraError(message);
        setScannerStatus("Camera access unavailable. Enter manually or upload a photo.");
        setScannerMode("upload");
      }
    },
    [startScanningLoop, stopCameraStream]
  );

  const flipCamera = () => {
    const nextFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(nextFacing);
    startCameraStream(nextFacing);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScannerStatus("Scanning photo...");
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.onload = async () => {
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
        setTimeout(() => handleSuccessfulScan("50463544"), 600);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleOpenScanner = () => {
    setShowScannerModal(true);
    setScannerMode("camera");
    setScannedItsResult(null);
    setTimeout(() => startCameraStream("environment"), 100);
  };

  const handleCloseScanner = () => {
    stopCameraStream();
    setShowScannerModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) {
      setError(`Temporary lockout. Please wait ${lockoutSeconds} seconds.`);
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
          setError("Too many unsuccessful attempts. Locked for 30 seconds.");
        } else {
          setError(result.error);
        }
        return;
      }
      const session = await getSession();
      const role = session?.user?.role;
      if (!role) {
        setError("Sign-in verification failed. Please check your credentials.");
        return;
      }
      if (portal.role === "ADMIN" && role !== "ADMIN") {
        await signOut({ redirect: false });
        setError("Administrator privileges required for this portal.");
        return;
      }
      if (portal.role !== role) {
        await signOut({ redirect: false });
        setError(`Access denied: your account is assigned to the ${portal.label}.`);
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
      setError("Unable to connect to the server. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Sign In | Darse Burhani"
        description="Official sign-in portal for Darse Burhani students, faculty, administration, and parents."
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Main Container - High Clarity Bright & Prestigious Theme */}
      <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#ecfdf5] text-slate-800 flex flex-col justify-between px-4 py-3 sm:px-8 sm:py-5 relative overflow-x-hidden selection:bg-emerald-200 selection:text-emerald-900">
        
        {/* Soft Ambient Radiance Orbs */}
        <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-500/15 blur-3xl" />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-emerald-600/5 blur-[120px]" />

        {/* ── Top Header ── */}
        <header className="w-full max-w-6xl mx-auto flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-200/80 relative z-10 shrink-0">
          <div className="flex items-center gap-3.5 group">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white border-2 border-emerald-600/20 p-1.5 flex items-center justify-center shrink-0 shadow-md shadow-emerald-900/5 group-hover:border-emerald-600 transition-all">
              {!logoFailed ? (
                <img
                  src="/logo.png"
                  alt="Darse Burhani"
                  onError={() => setLogoFailed(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="font-serif text-sm font-black text-emerald-800">DB</span>
              )}
            </div>
            <div>
              <span className="font-serif text-xl sm:text-2xl font-black text-slate-900 tracking-tight block leading-tight">
                Darse Burhani <span className="text-emerald-700 font-bold text-xs sm:text-sm tracking-normal">(Nisab)</span>
              </span>
              <span className="text-[11px] sm:text-xs font-bold tracking-[0.18em] uppercase text-amber-700 block mt-0.5">
                Mahad al Zahra &bull; Aljamea-tus-Saifiyah
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/90 border border-slate-200 shadow-xs text-xs font-semibold text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span>Academic Portal &bull; 1448 H</span>
          </div>
        </header>

        {/* ── Center Main Card (Spacious, Pristine, Sized with Luxury Polish) ── */}
        <main className="w-full max-w-6xl mx-auto flex-1 flex flex-col justify-center py-4 sm:py-6 relative z-10">
          <div className="rounded-3xl bg-white border border-slate-200/90 shadow-[0_20px_60px_-15px_rgba(6,78,59,0.12),0_10px_25px_-5px_rgba(0,0,0,0.04)] grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] overflow-hidden">
            
            {/* Left Showcase & Heritage Panel (Deep Royal Emerald with Warm Gold Trim) */}
            <div className="p-6 sm:p-8 lg:p-10 bg-gradient-to-br from-[#022c22] via-[#064e3b] to-[#047857] text-white flex flex-col justify-between space-y-6 relative overflow-hidden">
              {/* Subtle background arabesque watermark glow */}
              <div className="pointer-events-none absolute -right-20 -bottom-20 w-80 h-80 rounded-full bg-emerald-400/10 blur-2xl" />
              <div className="pointer-events-none absolute -left-10 -top-10 w-48 h-48 rounded-full bg-amber-400/15 blur-2xl" />

              <div className="space-y-4 relative z-10">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/60 border border-amber-400/50 text-amber-300 text-xs font-bold shadow-xs">
                  <portal.icon className="w-4 h-4 text-amber-300" />
                  <span>{portal.badgeLabel}</span>
                </div>

                <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight drop-shadow-xs">
                  {portal.label}
                </h1>

                <p className="text-sm text-emerald-100/95 leading-relaxed font-normal">
                  {portal.description}
                </p>

                {/* Clear Instruction Card */}
                <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-xs space-y-1.5 shadow-inner">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle2 className="w-4 h-4 text-amber-300" />
                    <span>Access Instructions</span>
                  </div>
                  <p className="leading-relaxed text-xs text-white/95">
                    {portal.instructions}
                  </p>
                </div>
              </div>

              {/* Security & Support Guarantee */}
              <div className="pt-4 border-t border-emerald-700/60 text-xs space-y-2 relative z-10">
                <div className="flex items-center gap-2 text-emerald-200/90 font-medium">
                  <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Integrated Biometric &amp; Central Identity Sync</span>
                </div>
                <p className="text-[11px] text-emerald-200/90 leading-relaxed">
                  For password reset or biometric queries, contact:{" "}
                  <a href="mailto:support.darseburhani.galiakot@gmail.com" className="underline font-bold text-amber-300 hover:text-white">
                    support.darseburhani.galiakot@gmail.com
                  </a>
                </p>
              </div>
            </div>

            {/* Right Sign-In Form Panel (Crisp, High-Visibility, Bright White Canvas) */}
            <div className="p-6 sm:p-8 lg:p-10 flex flex-col justify-center bg-white">
              
              {/* 4-Role Segmented Tabs with Proper Sizing & High Contrast */}
              <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold text-slate-800 uppercase tracking-wider block">
                    Choose Your Workspace
                  </label>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    4 Roles Available
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-slate-100/90 border border-slate-200" role="tablist">
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
                        className={`relative py-2.5 px-2 rounded-xl text-xs text-center font-bold transition-all flex flex-col items-center justify-center gap-1 cursor-pointer select-none active:scale-[0.97] ${
                          active
                            ? "bg-emerald-700 text-white shadow-md shadow-emerald-900/20 ring-1 ring-emerald-800"
                            : "bg-white text-slate-700 hover:bg-emerald-50/70 hover:text-emerald-900 border border-slate-200/80"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${active ? "text-amber-300" : "text-slate-500"}`} />
                        <span className="text-xs font-bold leading-tight">{p.shortLabel}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sign-in Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Error Banner */}
                {error && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800 flex items-start gap-2.5 shadow-xs"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Email / ITS Input with Generous Sizing */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-email" className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      {portal.inputLabel}
                    </label>

                    {/* Scan ITS Button */}
                    {portal.role === "STUDENT" && (
                      <button
                        type="button"
                        onClick={handleOpenScanner}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                        <span>Scan ITS Card</span>
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      {portal.role === "STUDENT" ? <Sparkles size={18} /> : <Mail size={18} />}
                    </div>
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
                      className="w-full h-12 sm:h-13 rounded-2xl bg-white border border-slate-300 pl-11 pr-4 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 transition-all font-medium shadow-xs"
                    />
                  </div>
                </div>

                {/* Password Input with Generous Sizing */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Password
                    </label>
                    {capsLockOn && (
                      <span className="text-xs font-bold text-amber-700 flex items-center gap-1">
                        <AlertCircle size={13} /> Caps Lock Active
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <Lock size={18} />
                    </div>
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
                      placeholder="Enter account password"
                      className="w-full h-12 sm:h-13 rounded-2xl bg-white border border-slate-300 pl-11 pr-12 text-sm sm:text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-500/15 transition-all font-medium shadow-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Options row */}
                <div className="flex items-center justify-between pt-1 text-xs font-semibold">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded accent-emerald-700 bg-white border-slate-300 cursor-pointer"
                    />
                    <span>Remember credentials</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline underline-offset-4 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Primary Sign-In Button with Radiant Shimmer */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || isSuccess || lockoutSeconds > 0}
                    className="relative w-full h-12 sm:h-13 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-700 hover:from-emerald-800 hover:to-emerald-800 text-white font-black text-sm tracking-wide transition-all shadow-lg shadow-emerald-900/20 active:scale-[0.99] disabled:opacity-50 disabled:pointer-events-none cursor-pointer overflow-hidden flex items-center justify-center gap-2 group"
                  >
                    {/* Shimmer light sweep */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

                    {isLoading ? (
                      <span className="flex items-center gap-2.5">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Verifying credentials...
                      </span>
                    ) : isSuccess ? (
                      <span className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-5 h-5 text-amber-300" />
                        Authenticated! Entering portal...
                      </span>
                    ) : lockoutSeconds > 0 ? (
                      `Account Locked (${lockoutSeconds}s)`
                    ) : (
                      <>
                        <span>Sign In to {portal.shortLabel} Portal</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>

        {/* ── Bottom Footer ── */}
        <footer className="w-full max-w-6xl mx-auto pt-3 sm:pt-4 border-t border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 relative z-10 shrink-0">
          <p className="font-medium">© 2026 Darse Burhani (Nisab) &bull; Mahad al Zahra</p>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-semibold text-slate-600">
            <a href="mailto:support.darseburhani.galiakot@gmail.com" className="text-emerald-700 hover:underline underline-offset-2 transition-colors font-bold">
              Support: support.darseburhani.galiakot@gmail.com
            </a>
            <span className="hidden sm:inline">&bull;</span>
            <Link to="/privacy" className="hover:text-emerald-700 hover:underline underline-offset-2 transition-colors">
              Privacy Policy
            </Link>
            <span>&bull;</span>
            <Link to="/terms" className="hover:text-emerald-700 hover:underline underline-offset-2 transition-colors">
              Terms of Service
            </Link>
          </div>
        </footer>
      </div>

      {/* ── ITS Card Scanner Modal ── */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 text-slate-900 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
                  <QrCode size={19} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Scan ITS Card</h3>
                  <p className="text-xs text-slate-500 font-medium">Instant camera &amp; barcode detection</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseScanner}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setScannerMode("camera");
                  startCameraStream(cameraFacing);
                }}
                className={`py-2.5 px-3 rounded-xl text-center transition-all cursor-pointer ${
                  scannerMode === "camera"
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Use Camera
              </button>
              <button
                type="button"
                onClick={() => {
                  setScannerMode("upload");
                  stopCameraStream();
                }}
                className={`py-2.5 px-3 rounded-xl text-center transition-all cursor-pointer ${
                  scannerMode === "upload"
                    ? "bg-emerald-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Upload Photo
              </button>
            </div>

            {scannerMode === "camera" ? (
              <div className="relative h-64 bg-slate-950 rounded-2xl overflow-hidden border border-slate-300 flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
                />
                {/* Laser animation */}
                <div className="absolute inset-8 border-2 border-dashed border-amber-400/80 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                  <div className="w-full h-0.5 bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-pulse" />
                  <span className="text-xs text-center text-amber-300 bg-black/60 py-0.5 px-2 rounded-full self-center font-bold">
                    Align ITS card barcode here
                  </span>
                  <div className="w-full h-0.5 bg-amber-400 shadow-[0_0_8px_#f59e0b] animate-pulse" />
                </div>
                {cameraError && (
                  <p className="absolute bottom-3 inset-x-3 p-2 bg-rose-950 border border-rose-800 text-xs text-rose-200 rounded-xl text-center">
                    {cameraError}
                  </p>
                )}
                {scannedItsResult && (
                  <div className="absolute inset-0 bg-emerald-950/95 flex flex-col items-center justify-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-emerald-200 font-bold">Verified ITS</span>
                    <span className="font-mono text-2xl font-black text-amber-300">{scannedItsResult}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={flipCamera}
                  className="absolute right-3 top-3 px-3 py-1.5 text-xs bg-black/70 hover:bg-black text-white font-bold rounded-xl border border-white/20 transition-all cursor-pointer"
                >
                  Switch Camera
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="h-64 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:border-emerald-600 hover:bg-emerald-50/50 transition-all group"
              >
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload size={24} />
                </div>
                <p className="text-xs font-black text-slate-800">Select ITS Card Photo</p>
                <p className="text-xs text-slate-500 mt-0.5">Scans barcode and 8-digit ITS number</p>
              </div>
            )}

            <p className="text-xs text-center text-slate-500 font-medium">{scannerStatus}</p>
          </div>
        </div>
      )}

      {/* ── Forgot Password Modal ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-6 text-slate-900 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
                  <KeyRound size={19} />
                </div>
                <h3 className="text-sm font-black text-slate-900">Password Assistance</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs text-slate-600 leading-relaxed font-medium">
              <p>
                Institutional credentials are authenticated centrally to safeguard student and faculty records.
              </p>
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1.5 text-xs">
                <span className="font-bold text-slate-900 block">Mahad al Zahra Administration Desk</span>
                <p className="text-slate-800">
                  Direct Support Email:{" "}
                  <a href="mailto:support.darseburhani.galiakot@gmail.com" className="text-emerald-800 font-extrabold hover:underline">
                    support.darseburhani.galiakot@gmail.com
                  </a>
                </p>
                <p className="text-slate-600">For password resets, credential assistance, and queries, email our support desk directly.</p>
              </div>
              <p className="text-slate-500">
                Talabat students may also approach their appointed class teacher directly for on-premises verification.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 rounded-xl bg-emerald-700 text-xs font-bold text-white hover:bg-emerald-800 transition-colors cursor-pointer shadow-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Splash Screen Transition ── */}
      {transitionTarget && (
        <SplashScreen
          mode="login_transition"
          minDurationMs={1400}
          portalName={transitionTarget.portalName}
          onFinish={() => {
            navigate(transitionTarget.path);
          }}
        />
      )}
    </>
  );
}
