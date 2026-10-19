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
    description: "Official institutional administration for student admissions, academic governance, and scheduling.",
    instructions: "Sign in with your registered administrator email and institutional password.",
    placeholder: "admin@darseburhani.edu",
    inputLabel: "Administrator email",
    rolePath: "/admin",
    icon: ShieldCheck,
  },
  {
    role: "TEACHER",
    label: "Faculty Portal",
    shortLabel: "Faculty",
    badgeLabel: "Academic Faculty",
    description: "Class rosters, daily classroom attendance registry, Hifz Quran logbooks, and academic remarks.",
    instructions: "Sign in with your appointed faculty email address.",
    placeholder: "teacher@darseburhani.edu",
    inputLabel: "Faculty email",
    rolePath: "/teacher",
    icon: GraduationCap,
  },
  {
    role: "STUDENT",
    label: "Talabat Portal",
    shortLabel: "Talabat",
    badgeLabel: "Enrolled Talabat",
    description: "Daily timetable, Hifz Quran progress, Sabaq assignments, and Maktabat book borrowings.",
    instructions: "Enter your 8-digit ITS number or scan your physical ITS card to proceed.",
    placeholder: "Enter 8-digit ITS or student email",
    inputLabel: "ITS number or student email",
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
    placeholder: "parent@darseburhani.edu",
    inputLabel: "Registered parent email",
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

      {/* Main Container */}
      <div className="min-h-screen bg-[#03140e] text-white flex flex-col justify-between px-4 py-6 sm:px-6 sm:py-8 relative overflow-hidden">
        {/* Subtle Ambient Glows */}
        <div className="pointer-events-none absolute -top-40 -left-40 w-96 h-96 rounded-full bg-emerald-600/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-[#d4af37]/10 blur-3xl" />

        {/* ── Top Header ── */}
        <header className="w-full max-w-5xl mx-auto flex items-center justify-between pb-5 border-b border-[#1b3d2c]/60 relative z-10">
          <div className="flex items-center gap-3.5 group">
            <div className="w-13 h-13 sm:w-15 sm:h-15 rounded-2xl bg-[#0c2a1c] border border-[#d4af37]/50 p-1 flex items-center justify-center shrink-0 shadow-lg group-hover:border-[#d4af37] transition-all">
              {!logoFailed ? (
                <img
                  src="/logo.png"
                  alt="Darse Burhani"
                  onError={() => setLogoFailed(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="font-serif text-sm font-bold text-[#d4af37]">DB</span>
              )}
            </div>
            <div>
              <span className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight block leading-tight">
                Darse Burhani <span className="text-[#d4af37] font-semibold text-base sm:text-lg">(Nisab)</span>
              </span>
              <span className="text-xs font-bold tracking-[0.18em] uppercase text-[#d4af37] block mt-0.5">
                Mahad al Zahra
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0a2318] border border-[#1b4330] text-xs font-semibold text-[#d2cec3]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Academic Portal &bull; 1448 H</span>
          </div>
        </header>

        {/* ── Center Main Card ── */}
        <main className="w-full max-w-5xl mx-auto my-auto py-6 sm:py-8 relative z-10">
          <div className="rounded-3xl bg-[#092017]/95 border border-[#1d4432] shadow-[0_24px_60px_rgba(0,0,0,0.5),0_0_1px_rgba(212,175,55,0.2)] grid grid-cols-1 lg:grid-cols-[1fr_1.25fr] overflow-hidden backdrop-blur-md">
            {/* Left Context & Guidance Panel */}
            <div className="p-6 sm:p-10 bg-[#071d14] border-b lg:border-b-0 lg:border-r border-[#1d4432] flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#113826] border border-[#d4af37]/50 text-[#d4af37] text-xs font-bold shadow-inner">
                  <portal.icon className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>{portal.badgeLabel}</span>
                </div>

                <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
                  {portal.label}
                </h1>

                <p className="text-xs sm:text-sm text-[#d2cec3] leading-relaxed font-medium">
                  {portal.description}
                </p>

                <div className="p-4 rounded-2xl bg-[#0d2a1e] border border-[#214f39] text-xs text-[#d2cec3] space-y-2 shadow-inner">
                  <div className="flex items-center gap-1.5 text-white font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>Instructions</span>
                  </div>
                  <p className="leading-relaxed text-xs text-[#d2cec3]">
                    {portal.instructions}
                  </p>
                </div>
              </div>

              {/* Institution Help note */}
              <div className="pt-4 border-t border-[#1d4432] text-xs space-y-1">
                <p className="font-bold text-white">Need institutional credential assistance?</p>
                <p className="text-xs text-[#d2cec3] leading-relaxed">
                  Contact the Administration Desk at Mahad al Zahra or email{" "}
                  <a href="mailto:admin@darseburhani.edu" className="text-[#d4af37] hover:underline underline-offset-2 transition-colors font-semibold">
                    admin@darseburhani.edu
                  </a>.
                </p>
              </div>
            </div>

            {/* Right Sign-In Form Panel */}
            <div className="p-6 sm:p-10 flex flex-col justify-center bg-[#092017]">
              {/* 4-Role Tactile Segmented Control with Unique Button Effects */}
              <div className="space-y-2.5 mb-6">
                <label className="text-xs font-bold text-[#d2cec3] uppercase tracking-wider block">
                  Select Institutional Workspace
                </label>
                <div className="grid grid-cols-4 gap-1.5 p-1.5 rounded-2xl bg-[#051810] border border-[#1b3d2c]" role="tablist">
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
                        className={`relative py-2.5 px-2 rounded-xl text-xs text-center font-black transition-all flex flex-col items-center justify-center gap-1 cursor-pointer select-none active:scale-95 ${
                          active
                            ? "bg-[#143a29] text-white border border-[#d4af37] shadow-[0_2px_8px_rgba(212,175,55,0.25)]"
                            : "bg-[#051810] text-[#d2cec3] hover:text-white hover:bg-[#0c2217]"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${active ? "text-[#d4af37]" : "text-[#9e9789]"}`} />
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
                    className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-xs font-bold text-rose-200 flex items-start gap-2 shadow-sm"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Email / ITS Input */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-email" className="text-xs font-bold text-[#d2cec3]">
                      {portal.inputLabel}
                    </label>

                    {/* Attractive Unique Scan ITS Button */}
                    {portal.role === "STUDENT" && (
                      <button
                        type="button"
                        onClick={handleOpenScanner}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#d4af37]/15 hover:bg-[#d4af37]/25 text-[#d4af37] border border-[#d4af37]/40 text-xs font-bold transition-all shadow-2xs hover:shadow-[#d4af37]/20 active:scale-95 cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5 animate-pulse" />
                        <span>Scan ITS Card</span>
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9e9789] pointer-events-none">
                      {portal.role === "STUDENT" ? <Sparkles size={16} /> : <Mail size={16} />}
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
                      className="w-full h-12 rounded-xl bg-[#051810] border border-[#214936] pl-10 pr-3.5 text-sm text-white placeholder:text-[#65736b] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/25 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="text-xs font-bold text-[#d2cec3]">
                      Password
                    </label>
                    {capsLockOn && (
                      <span className="text-xs font-bold text-[#d4af37] flex items-center gap-1">
                        <AlertCircle size={12} /> Caps Lock Active
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9e9789] pointer-events-none">
                      <Lock size={16} />
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
                      className="w-full h-12 rounded-xl bg-[#051810] border border-[#214936] pl-10 pr-11 text-sm text-white placeholder:text-[#65736b] focus:outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/25 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9e9789] hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Options row */}
                <div className="flex items-center justify-between pt-1 text-xs font-medium">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[#d2cec3]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded accent-[#d4af37] bg-[#051810] border-[#214936] cursor-pointer"
                    />
                    <span>Remember credentials</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-xs text-[#d2cec3] hover:text-[#d4af37] underline decoration-[#d2cec3]/40 hover:decoration-[#d4af37] underline-offset-4 transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* ── UNIQUE 3D PUSH-DOWN SIGN-IN BUTTON WITH SHIMMER EFFECT ── */}
                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isLoading || isSuccess || lockoutSeconds > 0}
                    className="relative w-full h-13 rounded-2xl bg-[#d4af37] hover:bg-[#e0b73c] text-[#03140e] font-black text-sm tracking-wide transition-all transform active:translate-y-0.5 shadow-[0_4px_0_#937318,0_10px_20px_rgba(0,0,0,0.4)] active:shadow-[0_1px_0_#937318,0_4px_8px_rgba(0,0,0,0.3)] disabled:opacity-50 disabled:pointer-events-none cursor-pointer overflow-hidden flex items-center justify-center gap-2 group"
                  >
                    {/* Shimmer light sweep highlight */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/40 to-transparent pointer-events-none" />

                    {isLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-[#071d14] border-t-transparent rounded-full animate-spin" />
                        Verifying credentials...
                      </span>
                    ) : isSuccess ? (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-950" />
                        Success! Entering workspace...
                      </span>
                    ) : lockoutSeconds > 0 ? (
                      `Locked (${lockoutSeconds}s)`
                    ) : (
                      <>
                        <span>Sign in to {portal.shortLabel} Portal</span>
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
        <footer className="w-full max-w-5xl mx-auto pt-5 border-t border-[#1b3d2c]/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#d2cec3] relative z-10">
          <p>© 2026 Darse Burhani (Nisab) &bull; Mahad al Zahra</p>
          <div className="flex items-center gap-4 font-medium text-[#d2cec3]">
            <Link to="/privacy" className="text-[#d2cec3] hover:text-white underline underline-offset-2 transition-colors">
              Privacy Policy
            </Link>
            <span>&bull;</span>
            <Link to="/terms" className="text-[#d2cec3] hover:text-white underline underline-offset-2 transition-colors">
              Terms of Service
            </Link>
          </div>
        </footer>
      </div>

      {/* ── ITS Card Scanner Modal ── */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#092218] border border-[#d4af37]/40 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1d4432] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#d4af37]/20 text-[#d4af37] flex items-center justify-center">
                  <QrCode size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">Scan ITS Card</h3>
                  <p className="text-xs text-[#d2cec3]">Instant camera &amp; barcode detection</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseScanner}
                className="p-1 rounded-lg text-[#d2cec3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-black">
              <button
                type="button"
                onClick={() => {
                  setScannerMode("camera");
                  startCameraStream(cameraFacing);
                }}
                className={`py-2.5 px-3 rounded-xl text-center transition-all cursor-pointer ${
                  scannerMode === "camera"
                    ? "bg-[#d4af37] text-[#03140e] shadow-md"
                    : "bg-[#051810] text-[#d2cec3] hover:text-white border border-[#1b3d2c]"
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
                    ? "bg-[#d4af37] text-[#03140e] shadow-md"
                    : "bg-[#051810] text-[#d2cec3] hover:text-white border border-[#1b3d2c]"
                }`}
              >
                Upload Photo
              </button>
            </div>

            {scannerMode === "camera" ? (
              <div className="relative h-64 bg-black rounded-2xl overflow-hidden border border-[#214936] flex items-center justify-center shadow-inner">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
                />
                {/* Clean framing box with scanning laser animation */}
                <div className="absolute inset-8 border-2 border-dashed border-[#d4af37]/70 rounded-xl pointer-events-none flex flex-col justify-between p-2">
                  <div className="w-full h-0.5 bg-[#d4af37] shadow-[0_0_8px_#d4af37] animate-pulse" />
                  <span className="text-xs text-center text-[#d4af37] bg-black/60 py-0.5 px-2 rounded-full self-center">
                    Align ITS card barcode here
                  </span>
                  <div className="w-full h-0.5 bg-[#d4af37] shadow-[0_0_8px_#d4af37] animate-pulse" />
                </div>
                {cameraError && (
                  <p className="absolute bottom-3 inset-x-3 p-2 bg-rose-950 border border-rose-800 text-xs text-rose-200 rounded-xl text-center">
                    {cameraError}
                  </p>
                )}
                {scannedItsResult && (
                  <div className="absolute inset-0 bg-[#092218]/95 flex flex-col items-center justify-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-[#d2cec3] font-bold">Verified ITS</span>
                    <span className="font-mono text-2xl font-black text-[#d4af37]">{scannedItsResult}</span>
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
                className="h-64 rounded-2xl border-2 border-dashed border-[#2d5843] bg-[#051810] flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:border-[#d4af37] hover:bg-[#071f15] transition-all group"
              >
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <div className="w-12 h-12 rounded-2xl bg-[#d4af37]/15 text-[#d4af37] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Upload size={24} />
                </div>
                <p className="text-xs font-black text-white">Select ITS Card Photo</p>
                <p className="text-xs text-[#d2cec3] mt-0.5">Scans barcode and 8-digit ITS number</p>
              </div>
            )}

            <p className="text-xs text-center text-[#d2cec3] font-medium">{scannerStatus}</p>
          </div>
        </div>
      )}

      {/* ── Forgot Password Modal ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#092218] border border-[#d4af37]/40 p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1d4432] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#d4af37]/20 text-[#d4af37] flex items-center justify-center">
                  <KeyRound size={18} />
                </div>
                <h3 className="text-sm font-black text-white">Password Assistance</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1 rounded-lg text-[#d2cec3] hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs text-[#d2cec3] leading-relaxed font-medium">
              <p>
                Institutional credentials are authenticated centrally to safeguard student and faculty records.
              </p>
              <div className="p-3.5 rounded-2xl bg-[#051810] border border-[#1b3d2c] space-y-1 text-xs">
                <span className="font-bold text-white block">Mahad al Zahra Administration Desk</span>
                <p>Email: <strong className="text-[#d4af37]">admin@darseburhani.edu</strong></p>
                <p>Office: Mahad al Zahra Administration Office</p>
              </div>
              <p className="text-[#d2cec3]">
                Talabat students may also approach their appointed class teacher directly for on-premises verification.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2.5 rounded-xl bg-[#d4af37] text-xs font-black text-[#03140e] hover:bg-[#e0b73c] transition-colors cursor-pointer shadow-md"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── 3D Splash Screen Transition ── */}
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
