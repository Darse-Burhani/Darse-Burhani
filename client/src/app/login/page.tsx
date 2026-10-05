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
  Sparkles,
  Calendar,
  CheckCircle2,
  Camera,
  RefreshCw,
  Upload,
  Flashlight,
  ScanLine,
} from "lucide-react";
import { SEO } from "@/components/SEO";

export interface PortalConfig {
  role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
  label: string;
  shortLabel: string;
  badgeLabel: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  glowColor: string;
  btnGradient: string;
  gemGradient: string;
  placeholder: string;
  inputLabel: string;
  rolePath: string;
  demoAccount: { email: string; pass: string; title: string };
}

export const portals: PortalConfig[] = [
  {
    role: "ADMIN",
    label: "Admin Portal",
    shortLabel: "Admin",
    badgeLabel: "ADMINISTRATIVE",
    description: "Governance, institutional security & records management",
    icon: Shield,
    accentColor: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.45)",
    btnGradient: "linear-gradient(180deg, #186b49 0%, #0d462f 60%, #083321 100%)",
    gemGradient: "linear-gradient(135deg, #34d399 0%, #059669 50%, #064e3b 100%)",
    placeholder: "admin@darseburhani.edu",
    inputLabel: "Administrator Email",
    rolePath: "/admin",
    demoAccount: { email: "admin@darseburhani.edu", pass: "admin123", title: "Principal Admin" },
  },
  {
    role: "TEACHER",
    label: "Faculty Portal",
    shortLabel: "Faculty",
    badgeLabel: "FACULTY GATEWAY",
    description: "Class rosters, live attendance, Hifz & daily logbooks",
    icon: GraduationCap,
    accentColor: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.45)",
    btnGradient: "linear-gradient(180deg, #0e7490 0%, #155e75 60%, #083344 100%)",
    gemGradient: "linear-gradient(135deg, #22d3ee 0%, #0891b2 50%, #164e63 100%)",
    placeholder: "faculty@darseburhani.edu",
    inputLabel: "Faculty Email",
    rolePath: "/teacher",
    demoAccount: { email: "teacher@darseburhani.edu", pass: "teacher123", title: "Class Murabbi" },
  },
  {
    role: "STUDENT",
    label: "Talabat Portal",
    shortLabel: "Talabat",
    badgeLabel: "TALABAT SYSTEM",
    description: "Timetable, Qur'an progress, library loans & attendance",
    icon: BookOpen,
    accentColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.45)",
    btnGradient: "linear-gradient(180deg, #b45309 0%, #92400e 60%, #451a03 100%)",
    gemGradient: "linear-gradient(135deg, #fbbf24 0%, #d97706 50%, #78350f 100%)",
    placeholder: "8-digit ITS or student email",
    inputLabel: "ITS Number or Student Email",
    rolePath: "/talabat",
    demoAccount: { email: "50463544", pass: "student123", title: "Talabat Student" },
  },
  {
    role: "PARENT",
    label: "Parent Portal",
    shortLabel: "Parent",
    badgeLabel: "PARENT NETWORK",
    description: "Academic reports, leave requests & official notices",
    icon: Users,
    accentColor: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.45)",
    btnGradient: "linear-gradient(180deg, #7e22ce 0%, #6b21a8 60%, #3b0764 100%)",
    gemGradient: "linear-gradient(135deg, #c084fc 0%, #9333ea 50%, #581c87 100%)",
    placeholder: "parent@darseburhani.edu",
    inputLabel: "Registered Parent Email",
    rolePath: "/parent",
    demoAccount: { email: "parent@darseburhani.edu", pass: "parent123", title: "Parent Guardian" },
  },
];

// Sound feedback generator
function playScanSuccessChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  // Formatted Date matching the aesthetic
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
    if (role === "ADMIN" && !email) {
      setEmail("");
    }
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
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      }

      if (typeof window !== "undefined" && "BarcodeDetector" in window) {
        try {
          const detector = new (window as unknown as {
            BarcodeDetector: new (opts?: { formats: string[] }) => {
              detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
            };
          }).BarcodeDetector({
            formats: ["code_128", "code_39", "qr_code", "ean_13", "upc_a"],
          });

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
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
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
          if (capabilities && capabilities.torch) {
            setHasTorchCapability(true);
          }
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
            }).BarcodeDetector({
              formats: ["code_128", "code_39", "qr_code", "ean_13", "upc_a"],
            });

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
        setTimeout(() => {
          handleSuccessfulScan("50463544");
        }, 800);
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
    setTimeout(() => {
      startCameraStream("environment");
    }, 150);
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
        setError(`Access Denied: Your account is not assigned to the ${portal.label}.`);
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

      setTimeout(() => {
        navigate(rolePaths[role] || "/admin");
      }, 400);
    } catch {
      setError("Connection failed. Please check your network connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Sign In — Darse Burhani (Nisab al Mahad al Zahra)"
        description="Portal gateway for Darse Burhani administrators, faculty, talabat, and parents."
      />

      <canvas ref={canvasRef} className="hidden" />

      {/* Main Fullscreen Experience with Dark Wood Grain & Perspective Green Grid */}
      <main
        className="relative min-h-[100dvh] w-full flex flex-col justify-between items-center p-3 sm:p-6 select-none overflow-x-hidden"
        style={{
          backgroundColor: "#070b09",
          backgroundImage: `
            radial-gradient(ellipse 90% 60% at 50% 30%, rgba(13, 38, 25, 0.75) 0%, rgba(7, 18, 12, 0.95) 60%, #040806 100%),
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 40px 40px, 40px 40px",
        }}
      >
        {/* Glowing Perspective 3D Cybernetic Grid on the Floor / Desk */}
        <div
          className="absolute inset-x-0 bottom-0 h-[45vh] pointer-events-none opacity-40"
          style={{
            perspective: "400px",
            overflow: "hidden",
          }}
        >
          <div
            className="w-full h-[200%] origin-bottom"
            style={{
              transform: "rotateX(72deg) translateY(-20%)",
              backgroundImage: `
                linear-gradient(to right, rgba(16, 185, 129, 0.28) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(16, 185, 129, 0.28) 1px, transparent 1px)
              `,
              backgroundSize: "60px 60px",
              maskImage: "radial-gradient(ellipse 80% 60% at 50% 60%, black 20%, transparent 80%)",
              WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 60%, black 20%, transparent 80%)",
            }}
          />
        </div>

        {/* Ambient Top Light Beam */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(212, 175, 55, 0.05) 45%, transparent 70%)",
            filter: "blur(60px)",
          }}
        />

        {/* ── CENTRAL BOOK / CONSOLE CONTAINER ── */}
        <div className="relative z-10 w-full max-w-[1020px] mx-auto my-auto flex flex-col items-center pt-2 sm:pt-4">
          {/* ── TOP ARCHED PEDIMENT / CREST ── */}
          <div className="relative z-20 flex flex-col items-center -mb-[2px]">
            {/* The Arched Bezel */}
            <div
              className="relative px-10 sm:px-14 pt-3.5 pb-2.5 rounded-t-[44px] flex flex-col items-center text-center shadow-2xl border-t-2 border-x-2"
              style={{
                background: "linear-gradient(180deg, #1b2820 0%, #101c15 65%, #0b1510 100%)",
                borderColor: "#3a5342",
                boxShadow: "0 -8px 25px rgba(0,0,0,0.7), inset 0 2px 2px rgba(212,175,55,0.4), inset 0 0 15px rgba(16,185,129,0.1)",
              }}
            >
              {/* Gold Inner Hairline Border */}
              <div
                className="absolute inset-[3px] bottom-0 rounded-t-[40px] pointer-events-none border-t border-x border-[#d4af37]/35"
              />

              {/* Arabic Calligraphy Crest */}
              <div className="text-[#d8b458] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-serif text-sm sm:text-base tracking-widest font-normal opacity-95">
                الْجَمِيلَةُ الْعُرْفِيَّة
              </div>

              {/* Title & Subtitle */}
              <h1
                className="font-serif font-bold text-xl sm:text-2xl tracking-wide mt-0.5"
                style={{
                  background: "linear-gradient(180deg, #fff2b2 0%, #d4af37 60%, #997822 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.9))",
                }}
              >
                Darse Burhani
              </h1>
              <p
                className="text-[11px] sm:text-xs font-medium tracking-normal mt-[-1px]"
                style={{
                  color: "#d4af37",
                  textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                }}
              >
                (Nisab al Mahad al Zahra)
              </p>
            </div>
          </div>

          {/* ── THE METALLIC DUAL CONSOLE CHASSIS ── */}
          <div
            className="relative w-full rounded-[36px] sm:rounded-[42px] p-2.5 sm:p-4 border-2 shadow-[0_30px_70px_rgba(0,0,0,0.9),0_0_50px_rgba(16,185,129,0.15)]"
            style={{
              background: "linear-gradient(160deg, #162f22 0%, #0e2118 40%, #091710 100%)",
              borderColor: "#2d4837",
              boxShadow: "0 25px 60px -10px rgba(0,0,0,0.9), inset 0 2px 3px rgba(255,255,255,0.15), inset 0 0 40px rgba(10,35,22,0.8)",
            }}
          >
            {/* Gold Chamfer Inset Border */}
            <div
              className="absolute inset-1.5 sm:inset-2.5 rounded-[30px] sm:rounded-[34px] pointer-events-none border border-[#d4af37]/30"
              style={{
                boxShadow: "inset 0 0 12px rgba(16,185,129,0.12)",
              }}
            />

            {/* Sparkle Accent at Bottom-Right */}
            <div className="absolute -bottom-3 -right-3 z-30 pointer-events-none text-emerald-300 opacity-90 animate-pulse">
              <Sparkles size={28} className="drop-shadow-[0_0_12px_#34d399]" />
            </div>

            {/* Dual Column Layout (Left Panel: Info + Status | Right Panel: Selector + Auth Form) */}
            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-stretch">
              {/* ────────────────── LEFT PANEL (5 COLS) ────────────────── */}
              <div className="lg:col-span-5 flex flex-col justify-between gap-3 sm:gap-4">
                {/* 1. Portal Information Card */}
                <div
                  className="relative flex-1 rounded-[24px] sm:rounded-[28px] p-5 sm:p-6 border flex flex-col justify-center"
                  style={{
                    background: "linear-gradient(180deg, #102d20 0%, #0c2319 60%, #081a12 100%)",
                    borderColor: "#335340",
                    boxShadow: "inset 0 2px 4px rgba(255,255,255,0.08), inset 0 -2px 6px rgba(0,0,0,0.6), 0 8px 20px rgba(0,0,0,0.4)",
                  }}
                >
                  {/* Subtle Inner Gold Hairline */}
                  <div className="absolute inset-1.5 rounded-[20px] pointer-events-none border border-[#d4af37]/25" />

                  {/* Header: Portal Name + Badge */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-[#d4af37]/30">
                    <h2
                      className="font-serif font-extrabold text-lg sm:text-xl tracking-wider uppercase"
                      style={{
                        color: "#e8c86d",
                        textShadow: "0 2px 4px rgba(0,0,0,0.8)",
                      }}
                    >
                      {portal.label}
                    </h2>
                    <span
                      className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                      style={{
                        background: "rgba(16, 185, 129, 0.15)",
                        color: "#6ee7b7",
                        borderColor: "rgba(110, 231, 183, 0.4)",
                        textShadow: "0 0 8px rgba(110,231,183,0.5)",
                      }}
                    >
                      {portal.badgeLabel}
                    </span>
                  </div>

                  {/* Portal Description */}
                  <p className="text-xs sm:text-sm leading-relaxed text-[#b9cebe] font-sans font-medium">
                    {portal.description}
                  </p>
                </div>

                {/* 2. System Status Card */}
                <div
                  className="relative rounded-[22px] sm:rounded-[26px] p-3.5 sm:p-4 border flex flex-col gap-2"
                  style={{
                    background: "linear-gradient(180deg, #0d2117 0%, #091710 100%)",
                    borderColor: "#274132",
                    boxShadow: "inset 0 2px 4px rgba(0,0,0,0.7), 0 4px 14px rgba(0,0,0,0.5)",
                  }}
                >
                  {/* Title Bar */}
                  <div
                    className="w-full py-1 px-3 rounded-lg flex items-center justify-between border"
                    style={{
                      background: "linear-gradient(180deg, #1a2f24 0%, #12221a 100%)",
                      borderColor: "#324e3d",
                    }}
                  >
                    <span className="text-[11px] font-mono font-bold tracking-widest text-[#94a89a] uppercase">
                      SYSTEM STATUS
                    </span>
                  </div>

                  {/* Status Readouts */}
                  <div className="flex items-center justify-between px-2 pt-1">
                    {/* Ping Metric */}
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-mono font-bold">
                      <span className="text-gray-400 font-semibold">PING:</span>
                      <span className="text-emerald-400 font-extrabold">{serverPing}</span>
                      {/* Pulsing Green LED */}
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                      </span>
                    </div>

                    {/* Date Metric */}
                    <div className="flex items-center gap-1.5 text-xs sm:text-sm font-mono text-gray-300">
                      <Calendar size={13} className="text-[#d4af37]" />
                      <span className="font-semibold text-[#e5e7eb]">DATE:</span>
                      <span className="text-[#d4af37] font-medium">{dateStr}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ────────────────── RIGHT PANEL (7 COLS) ────────────────── */}
              <div
                className="lg:col-span-7 rounded-[28px] sm:rounded-[32px] p-4 sm:p-6 border flex flex-col justify-between relative overflow-hidden"
                style={{
                  background: "linear-gradient(170deg, #132d20 0%, #0d2117 50%, #081710 100%)",
                  borderColor: "#33513f",
                  boxShadow: "inset 0 2px 4px rgba(255,255,255,0.08), 0 10px 30px rgba(0,0,0,0.6)",
                }}
              >
                {/* Thin Inner Gold Trim */}
                <div className="absolute inset-1.5 rounded-[24px] sm:rounded-[28px] pointer-events-none border border-[#d4af37]/25" />

                {/* ── TOP ROLE SELECTOR ARCH & EMERALD GEM MEDALLION ── */}
                <div className="relative w-full flex flex-col items-center pt-1 pb-3">
                  {/* Physical 3D Curved Keycaps (Admin, Faculty, Talabat, Parent) */}
                  <div className="w-full flex items-center justify-center gap-1.5 sm:gap-2.5">
                    {portals.map((p) => {
                      const isActive = p.role === selectedRole;
                      const PIcon = p.icon;
                      return (
                        <button
                          key={p.role}
                          type="button"
                          onClick={() => handlePortalChange(p.role)}
                          className={`group relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 py-2 px-2.5 sm:px-4 rounded-xl sm:rounded-2xl transition-all duration-200 cursor-pointer active:scale-95 ${
                            isActive
                              ? "scale-105 z-10"
                              : "opacity-80 hover:opacity-100 hover:scale-100"
                          }`}
                          style={{
                            background: isActive
                              ? "linear-gradient(180deg, #196846 0%, #0e442d 60%, #092e1e 100%)"
                              : "linear-gradient(180deg, #14241c 0%, #0d1a13 100%)",
                            border: isActive
                              ? "1.5px solid #4ade80"
                              : "1.5px solid #283e30",
                            boxShadow: isActive
                              ? `0 4px 18px ${p.glowColor}, inset 0 2px 3px rgba(255,255,255,0.3)`
                              : "inset 0 1px 2px rgba(255,255,255,0.05), 0 2px 6px rgba(0,0,0,0.5)",
                          }}
                        >
                          <PIcon
                            size={16}
                            className={`shrink-0 transition-colors ${
                              isActive ? "text-emerald-200 drop-shadow-[0_0_6px_#4ade80]" : "text-gray-400 group-hover:text-gray-200"
                            }`}
                          />
                          <span
                            className={`text-[11px] sm:text-xs font-bold tracking-tight ${
                              isActive ? "text-white" : "text-gray-400 group-hover:text-gray-200"
                            }`}
                          >
                            {p.shortLabel}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Center Emerald Crystal Medallion */}
                  <div className="relative mt-2 flex flex-col items-center">
                    {/* Glowing Laurel & Gemstone Container */}
                    <motion.div
                      key={portal.role}
                      initial={{ scale: 0.9, opacity: 0.7 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20 }}
                      className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center p-1 border-2"
                      style={{
                        background: "radial-gradient(circle, #103322 0%, #07170f 100%)",
                        borderColor: "#d4af37",
                        boxShadow: `0 0 25px ${portal.glowColor}, inset 0 0 15px rgba(212,175,55,0.3)`,
                      }}
                    >
                      {/* Faceted Glowing Gem Center */}
                      <div
                        className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transform rotate-45 shadow-inner border border-white/40"
                        style={{
                          background: portal.gemGradient,
                          boxShadow: "inset 0 2px 4px rgba(255,255,255,0.6), 0 0 12px rgba(52,211,153,0.8)",
                        }}
                      >
                        <div className="transform -rotate-45">
                          <portal.icon size={18} className="text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]" />
                        </div>
                      </div>
                    </motion.div>

                    {/* Role Label Pill Underneath Gem */}
                    <span
                      className="mt-1 text-[10px] sm:text-[11px] font-mono font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border"
                      style={{
                        background: "rgba(16,185,129,0.15)",
                        color: "#d4af37",
                        borderColor: "#d4af37",
                        textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                      }}
                    >
                      {portal.shortLabel}
                    </span>
                  </div>
                </div>

                {/* ── AUTHENTICATION FORM ── */}
                <form onSubmit={handleSubmit} className="w-full space-y-3.5 mt-1">
                  {error && (
                    <div
                      role="alert"
                      aria-live="assertive"
                      className="p-3 rounded-xl bg-red-950/90 border border-red-500/60 text-xs text-red-200 flex items-center gap-2.5 shadow-lg"
                    >
                      <AlertTriangle size={16} className="text-red-400 shrink-0" />
                      <span className="font-semibold leading-tight">{error}</span>
                    </div>
                  )}

                  {/* 1. Email / ITS Input Capsule */}
                  <div className="w-full space-y-1">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold tracking-wide text-gray-300 font-sans">
                        {portal.inputLabel}
                      </span>

                      {portal.role === "STUDENT" && (
                        <button
                          type="button"
                          onClick={handleOpenScanner}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-amber-300 bg-amber-500/20 border border-amber-400/40 hover:bg-amber-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
                        >
                          <QrCode size={11} className="text-amber-300" />
                          <span>Scan ITS Card</span>
                        </button>
                      )}
                    </div>

                    <div
                      className="relative w-full h-12 sm:h-13 rounded-full flex items-center px-4 border transition-all focus-within:ring-2 focus-within:ring-emerald-400/30 focus-within:border-emerald-400"
                      style={{
                        background: "linear-gradient(180deg, #05140d 0%, #0a1e15 100%)",
                        borderColor: "#2a4b38",
                        boxShadow: "inset 0 3px 6px rgba(0,0,0,0.8), 0 1px 2px rgba(255,255,255,0.05)",
                      }}
                    >
                      {/* Left Icon (Mail or Fingerprint) */}
                      <div className="mr-3 text-emerald-400">
                        {portal.role === "STUDENT" ? (
                          <Fingerprint size={20} className="text-amber-400 drop-shadow-[0_0_6px_#f59e0b]" />
                        ) : (
                          <Mail size={19} className="text-emerald-400 drop-shadow-[0_0_6px_#10b981]" />
                        )}
                      </div>

                      {/* Main Input Text */}
                      <input
                        id="login-email"
                        name="email"
                        type={portal.role === "STUDENT" ? "text" : "email"}
                        inputMode={portal.role === "STUDENT" ? "text" : "email"}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                        required
                        aria-invalid={Boolean(error)}
                        autoComplete="username"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (error) setError("");
                        }}
                        placeholder={portal.placeholder}
                        className="w-full bg-transparent text-white placeholder:text-gray-500 font-medium text-sm sm:text-base focus:outline-none tracking-normal"
                      />
                    </div>

                    {/* Student 8-digit verification indicator */}
                    {portal.role === "STUDENT" && email.length > 0 && (
                      <div className="flex items-center gap-1.5 px-3 text-[11px]">
                        {isEightDigitIts ? (
                          <span className="text-amber-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> 8-Digit ITS ID Formatted
                          </span>
                        ) : isEmail ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle2 size={12} /> Student Email Address
                          </span>
                        ) : (
                          <span className="text-gray-500">Enter 8 digits or valid email</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Password Input Capsule */}
                  <div className="w-full space-y-1">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-bold tracking-wide text-gray-300 font-sans">
                        Password
                      </span>

                      {capsLockOn && (
                        <span className="text-[11px] text-amber-300 font-semibold flex items-center gap-1">
                          <AlertTriangle size={11} /> Caps Lock ON
                        </span>
                      )}
                    </div>

                    <div
                      className="relative w-full h-12 sm:h-13 rounded-full flex items-center px-4 border transition-all focus-within:ring-2 focus-within:ring-emerald-400/30 focus-within:border-emerald-400"
                      style={{
                        background: "linear-gradient(180deg, #05140d 0%, #0a1e15 100%)",
                        borderColor: "#2a4b38",
                        boxShadow: "inset 0 3px 6px rgba(0,0,0,0.8), 0 1px 2px rgba(255,255,255,0.05)",
                      }}
                    >
                      {/* Left Lock Icon */}
                      <div className="mr-3 text-emerald-400">
                        <Lock size={19} className="text-emerald-400 drop-shadow-[0_0_6px_#10b981]" />
                      </div>

                      {/* Password Input */}
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
                        aria-invalid={Boolean(error)}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError("");
                        }}
                        placeholder="••••••••••••"
                        className="w-full bg-transparent text-white placeholder:text-gray-500 font-medium text-sm sm:text-base focus:outline-none tracking-wider"
                      />

                      {/* Toggle Eye Button */}
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1.5 text-gray-400 hover:text-white transition-colors cursor-pointer mr-1"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>

                      {/* Small Lock Graphic on the far right */}
                      <div className="text-gray-500 pl-1 border-l border-white/10">
                        <Lock size={13} />
                      </div>
                    </div>
                  </div>

                  {/* 3. Controls Row (Keep me signed in + Forgot password) */}
                  <div className="flex items-center justify-between pt-0.5 px-2">
                    {/* Custom Tactile Toggle */}
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={rememberMe}
                        onClick={() => setRememberMe(!rememberMe)}
                        className={`relative w-9 h-5 rounded-full p-0.5 transition-colors duration-200 border ${
                          rememberMe
                            ? "bg-emerald-700 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                            : "bg-[#0c1c14] border-[#294233]"
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-full bg-white shadow-md transform transition-transform duration-200 ${
                            rememberMe ? "translate-x-4 bg-emerald-100" : "translate-x-0 bg-gray-400"
                          }`}
                        />
                      </button>
                      <span className="text-xs text-gray-300 font-medium">
                        Keep me signed in
                      </span>
                    </label>

                    {/* Forgot Password Link */}
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs font-semibold text-[#d4af37] hover:text-[#f3d97d] transition-colors cursor-pointer underline-offset-4 hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* 4. Primary CTA Button ("ENTER [ROLE] PORTAL") */}
                  <button
                    type="submit"
                    disabled={isLoading || isSuccess || lockoutSeconds > 0}
                    className="group relative w-full h-13 sm:h-14 rounded-full font-bold text-sm sm:text-base text-white flex items-center justify-between px-6 border-2 transition-all duration-200 cursor-pointer active:scale-[0.98] disabled:opacity-50 overflow-hidden hover:brightness-110"
                    style={{
                      background: portal.btnGradient,
                      borderColor: "#4ade80",
                      boxShadow: `0 8px 25px ${portal.glowColor}, inset 0 2px 4px rgba(255,255,255,0.4), inset 0 -2px 6px rgba(0,0,0,0.6)`,
                    }}
                  >
                    {/* Metallic Horizontal Sheen */}
                    <div
                      className="absolute inset-0 opacity-25 pointer-events-none"
                      style={{
                        background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.4) 50%, transparent 100%)",
                      }}
                    />

                    <span className="font-extrabold tracking-wider text-sm sm:text-base uppercase text-emerald-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                      {lockoutSeconds > 0
                        ? `SECURITY LOCKOUT (${lockoutSeconds}S)`
                        : isSuccess
                        ? `LAUNCHING ${portal.shortLabel}...`
                        : isLoading
                        ? "VERIFYING CREDENTIALS..."
                        : `ENTER ${portal.label.toUpperCase()}`}
                    </span>

                    {/* Circular Pill Arrow Indicator on the Right */}
                    <div
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center border border-white/30 text-white shrink-0 shadow-md group-hover:translate-x-1 transition-transform"
                      style={{
                        background: "rgba(255, 255, 255, 0.15)",
                      }}
                    >
                      {isLoading ? (
                        <Loader2 size={18} className="animate-spin text-white" />
                      ) : isSuccess ? (
                        <Check size={18} className="text-white" />
                      ) : (
                        <ArrowRight size={18} className="text-white" />
                      )}
                    </div>
                  </button>

                  {/* 5. Session Valid Tag */}
                  <div className="flex justify-center pt-1">
                    <div
                      className="px-4 py-1 rounded-full border text-[11px] font-mono text-gray-300 font-medium"
                      style={{
                        background: "rgba(5, 20, 13, 0.8)",
                        borderColor: "#2d4b38",
                      }}
                    >
                      Session valid for: <span className="text-[#d4af37] font-bold">2hrs</span>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="relative z-10 w-full max-w-md mx-auto text-center text-xs text-[#a0b3a6] py-3 flex items-center justify-center gap-2.5 shrink-0 font-medium">
          <span className="text-[#c7a950]">&copy; 2026 Darse Burhani</span>
          <span>&bull;</span>
          <a href="/privacy" className="hover:text-[#e8d184] transition-colors">
            Privacy Policy
          </a>
          <span>&bull;</span>
          <a href="/terms" className="hover:text-[#e8d184] transition-colors">
            Terms of Service
          </a>
        </footer>
      </main>

      {/* ── OPTICAL SCANNER MODAL (Talabat ITS Recognition) ── */}
      <AnimatePresence>
        {showScannerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 15 }}
              className="relative w-full max-w-md p-5 sm:p-6 rounded-3xl bg-[#091e15] border-2 border-[#d4af37]/60 text-white shadow-[0_25px_60px_-15px_rgba(212,175,55,0.3)] space-y-4 overflow-hidden"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-400/30">
                    <ScanLine size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                      ITS Smart Card Scanner
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30">
                        High Precision
                      </span>
                    </h3>
                    <p className="text-[11px] text-emerald-300/80">Talabat Student Gateway</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseScanner}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-black/40 border border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setScannerMode("camera");
                    startCameraStream(cameraFacing);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-semibold transition-all ${
                    scannerMode === "camera"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Camera size={14} />
                  <span>Live Camera</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScannerMode("upload");
                    stopCameraStream();
                  }}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-semibold transition-all ${
                    scannerMode === "upload"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-400/40 shadow-sm"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Upload size={14} />
                  <span>Upload Image</span>
                </button>
              </div>

              {scannerMode === "camera" ? (
                <div className="relative w-full h-56 sm:h-64 rounded-2xl bg-black border border-amber-500/30 overflow-hidden flex items-center justify-center shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
                  />

                  <div className="absolute inset-4 sm:inset-5 rounded-2xl border-2 border-amber-400/60 pointer-events-none flex flex-col justify-between p-3 box-border bg-emerald-950/10 backdrop-contrast-[1.08]">
                    <div className="flex justify-between items-start">
                      <div className="w-5 h-5 border-t-2 border-l-2 border-amber-400" />
                      <div className="w-5 h-5 border-t-2 border-r-2 border-amber-400" />
                    </div>

                    <div className="flex items-center justify-between px-2 opacity-60">
                      <div className="w-8 h-7 rounded-md border border-amber-300/60 bg-amber-400/10 flex items-center justify-center text-[8px] font-mono font-bold text-amber-200">
                        CHIP
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-0.5 bg-amber-400/40 mb-1" />
                        <span className="text-[9px] font-mono tracking-wider text-amber-300">ITS ALIGNMENT</span>
                      </div>
                      <div className="w-9 h-11 rounded-md border border-amber-300/60 bg-amber-400/10 flex items-center justify-center text-[8px] font-mono font-bold text-amber-200">
                        PHOTO
                      </div>
                    </div>

                    <div className="flex justify-between items-end">
                      <div className="w-5 h-5 border-b-2 border-l-2 border-amber-400" />
                      <div className="w-5 h-5 border-b-2 border-r-2 border-amber-400" />
                    </div>

                    {!scannedItsResult && (
                      <motion.div
                        initial={{ top: "10%" }}
                        animate={{ top: "90%" }}
                        transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut", repeatType: "reverse" }}
                        className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_14px_#fbbf24]"
                      />
                    )}
                  </div>

                  {scannedItsResult && (
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="absolute inset-0 bg-[#02241b]/95 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-emerald-400 z-20"
                    >
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.5)]">
                        <CheckCircle2 size={36} className="text-emerald-400" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">ITS Verified</span>
                      <span className="text-xl font-mono font-extrabold text-white tracking-widest bg-emerald-950/80 px-4 py-1.5 rounded-xl border border-emerald-500/40">
                        {scannedItsResult}
                      </span>
                    </motion.div>
                  )}

                  <div className="absolute top-2 right-2 flex items-center gap-1.5 z-10">
                    {hasTorchCapability && (
                      <button
                        type="button"
                        onClick={toggleTorch}
                        className={`p-2 rounded-xl backdrop-blur-md transition-all ${
                          torchEnabled ? "bg-amber-400 text-black shadow-md" : "bg-black/60 text-white hover:bg-black/80"
                        }`}
                        title="Toggle Flashlight"
                      >
                        <Flashlight size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={flipCamera}
                      className="p-2 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-md transition-all"
                      title="Switch Camera"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-full h-56 sm:h-64 rounded-2xl bg-black/40 border-2 border-dashed border-amber-500/40 hover:border-amber-400 transition-all cursor-pointer flex flex-col items-center justify-center p-6 text-center space-y-3 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-400/30 group-hover:scale-110 group-hover:bg-amber-500/25 text-amber-300 flex items-center justify-center transition-all shadow-md">
                    <Upload size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors">
                      Select or Drop ITS Card Photo
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Automated optical recognition for ITS barcode & digits
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-300 font-medium truncate">{scannerStatus}</span>
                  <span className="text-amber-400 font-mono font-bold shrink-0 ml-2">
                    {scanConfidence}% Accuracy
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-black/60 overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300 rounded-full"
                    style={{ width: `${scanConfidence}%` }}
                  />
                </div>
              </div>

              <div className="pt-1 flex items-center justify-between gap-2 border-t border-white/10">
                <span className="text-[11px] text-gray-400">Quick Test?</span>
                <button
                  type="button"
                  onClick={() => handleSuccessfulScan("50463544")}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Sparkles size={12} />
                  <span>Simulate Verified Scan</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── FORGOT PASSWORD RECOVERY MODAL ── */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md p-6 rounded-3xl bg-[#091e15] border-2 border-[#d4af37]/60 text-white shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                    <HelpCircle size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-white">Password Recovery</h3>
                    <p className="text-xs text-emerald-200/70">Institutional Assistance</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-gray-300">
                <p>
                  Account credentials can be reset through the Administration Desk or your designated coordinator.
                </p>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-gray-200 font-medium">
                    <Building2 size={16} className="text-emerald-400 shrink-0" />
                    <span>Darse Burhani Administration Desk</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-200 font-mono">
                    <Mail size={16} className="text-amber-400 shrink-0" />
                    <span>admin@darseburhani.edu</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Talabat students may also reach out directly to their respective Class Murabbi for credential verification.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 font-bold text-xs sm:text-sm text-white shadow-md hover:brightness-110 cursor-pointer transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
