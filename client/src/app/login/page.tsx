"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
  UserCheck,
  QrCode,
  ArrowRight,
  Check,
  LogIn,
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

export interface ForgotProfile {
  displayName: string;
  role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
  portal: string;
  its: string | null;
  matchedVia: "email" | "its";
}

export const portals: PortalConfig[] = [
  {
    role: "ADMIN",
    label: "Administrative Portal",
    shortLabel: "Admin",
    badgeLabel: "Central Governance",
    description: "Official institutional governance for academic operations, academic records, examinations and administrative services.",
    instructions: "Sign in with your authorized administrator email and institutional password.",
    placeholder: "admin@darseburhani.edu",
    inputLabel: "Administrator Email",
    rolePath: "/admin",
    icon: ShieldCheck,
  },
  {
    role: "TEACHER",
    label: "Faculty Portal",
    shortLabel: "Faculty",
    badgeLabel: "Academic Faculty",
    description: "Classroom instruction, daily attendance registers, Hifz Quran logbooks, and academic remarks.",
    instructions: "Sign in with your appointed faculty email address.",
    placeholder: "faculty@darseburhani.edu",
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
    placeholder: "e.g. 50401234",
    inputLabel: "Student ID / ITS",
    rolePath: "/talabat",
    icon: Users,
  },
  {
    role: "PARENT",
    label: "Parent Portal",
    shortLabel: "Parent",
    badgeLabel: "Parent Network",
    description: "Track your child's academic progress, review attendance records, and submit leave requests.",
    instructions: "Sign in with your registered parent email address.",
    placeholder: "parent@example.com",
    inputLabel: "Parent Email",
    rolePath: "/parent",
    icon: UserCheck,
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

/** Gold floral mandala ornament shown in the page corners (top-left / bottom-right). */
function CornerMandala({ size = 170, style }: { size?: number; style?: React.CSSProperties }) {
  const petalAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none" style={style} aria-hidden="true">
      <g stroke="rgba(212,175,80,0.5)" strokeWidth="0.7">
        {petalAngles.map((a) => (
          <ellipse key={a} cx="60" cy="40" rx="12.5" ry="21" transform={`rotate(${a} 60 60)`} />
        ))}
        {petalAngles.map((a) => (
          <ellipse key={`i${a}`} cx="60" cy="50" rx="6" ry="11" transform={`rotate(${a} 60 60)`} />
        ))}
        <circle cx="60" cy="60" r="27" />
        <circle cx="60" cy="60" r="31.5" strokeDasharray="1.5 4" />
        <circle cx="60" cy="60" r="36" strokeDasharray="0.5 5" />
        {petalAngles.map((a) => {
          const rad = ((a - 90) * Math.PI) / 180;
          return (
            <circle
              key={`d${a}`}
              cx={60 + 42 * Math.cos(rad)}
              cy={60 + 42 * Math.sin(rad)}
              r="1.4"
              fill="rgba(235,170,69,0.55)"
              stroke="none"
            />
          );
        })}
        <circle cx="60" cy="60" r="3" fill="rgba(235,170,69,0.45)" stroke="none" />
      </g>
    </svg>
  );
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

  // ── Forgot-Password Profile Catch ──
  // When the user types their email or ITS, resolve which profile it belongs to
  // (Administrator / Faculty / Talabat / Parent) so the support email auto-fills.
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotProfile, setForgotProfile] = useState<ForgotProfile | null>(null);
  const [forgotChecking, setForgotChecking] = useState(false);
  const forgotLookupSeq = useRef(0);

  useEffect(() => {
    const id = forgotIdentifier.trim();
    const seq = ++forgotLookupSeq.current;
    if (!showForgotModal || id.length < 3) {
      setForgotProfile(null);
      setForgotChecking(false);
      return;
    }
    setForgotChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/profile-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier: id }),
          credentials: "include",
        });
        const json = res.ok ? await res.json() : null;
        if (seq === forgotLookupSeq.current) {
          setForgotProfile(json?.success && json?.data?.found ? (json.data.profile as ForgotProfile) : null);
        }
      } catch {
        if (seq === forgotLookupSeq.current) setForgotProfile(null);
      } finally {
        if (seq === forgotLookupSeq.current) setForgotChecking(false);
      }
    }, 550);
    return () => clearTimeout(timer);
  }, [forgotIdentifier, showForgotModal]);

  // Auto-composed support mailto, pre-filled with the caught profile details.
  const forgotSupportMailto = useMemo(() => {
    const ident = forgotIdentifier.trim();
    const subject = forgotProfile
      ? `Password Reset Request — ${forgotProfile.portal} — ${forgotProfile.displayName}`
      : "Password Reset Request — Darse Burhani (Nisab)";
    const lines = [
      "Assalamu Alaikum,",
      "",
      "I request a password reset for my Darse Burhani (Nisab) account.",
      "",
      `Request Date: ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`,
      "",
    ];
    if (forgotProfile) {
      lines.push(`Full Name: ${forgotProfile.displayName}`);
      lines.push(`Portal / Role: ${forgotProfile.portal}`);
      if (forgotProfile.its) lines.push(`ITS Number: ${forgotProfile.its}`);
      lines.push(`Account matched via: ${forgotProfile.matchedVia === "email" ? "email address" : "ITS number"}`);
    } else if (ident) {
      lines.push(`Identifier entered on sign-in page: ${ident}`);
    }
    lines.push("", "Please reset my password at your earliest convenience.", "", "Jazak Allah,");
    if (forgotProfile) lines.push(forgotProfile.displayName);
    return `mailto:support.darseburhani.galiakot@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  }, [forgotProfile, forgotIdentifier]);

  // ── Backdrop Parallax ──
  // The panorama drifts subtly with the cursor (desktop, motion-safe only) so the
  // full-length photo feels alive without ever cropping it. Touch devices skip it.
  useEffect(() => {
    const photo = document.querySelector<HTMLElement>(".login-backdrop-photo");
    if (!photo) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;

    const tick = () => {
      curX += (targetX - curX) * 0.06;
      curY += (targetY - curY) * 0.06;
      photo.style.setProperty("--login-parallax-x", `${curX.toFixed(2)}px`);
      photo.style.setProperty("--login-parallax-y", `${curY.toFixed(2)}px`);
      if (Math.abs(targetX - curX) > 0.08 || Math.abs(targetY - curY) > 0.08) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
      }
    };

    const handleMove = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 14;
      targetY = (e.clientY / window.innerHeight - 0.5) * 10;
      if (!raf) raf = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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

      {/* ── Twilight Palace Backdrop ──
          Layered cinematic composition:
          1. Fill wash — photo-sampled gradient covering the full viewport
          2. Photo — entire panorama, no crop (centered on desktop, hero band on mobile)
          3. Seam fade — melts the photo edge into the wash on mobile
          4. Sun glow — breathing amber light where the sun sets in the photo
          5. Parallax — the panorama drifts with the cursor (desktop, motion-safe) */}
      <div className="fixed inset-0 z-0 pointer-events-none login-backdrop-fill" />
      <div
        className="fixed inset-0 z-0 pointer-events-none login-backdrop-photo"
        style={{ backgroundImage: "url('/login-bg-sunset.jpg')" }}
      />
      <div className="fixed inset-0 z-0 pointer-events-none login-photo-fade" aria-hidden="true" />
      <div className="fixed z-0 pointer-events-none login-sun-glow" aria-hidden="true" />
      {/* Cinematic overlay: indigo-to-ember tint picked from the backdrop photo */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          background: `
            linear-gradient(180deg,
              rgba(26,32,60,0.62) 0%,
              rgba(26,32,60,0.22) 12%,
              rgba(26,32,60,0.05) 30%,
              rgba(26,32,60,0.06) 58%,
              rgba(24,16,10,0.26) 80%,
              rgba(18,12,6,0.66) 100%
            )
          `,
        }}
      />

      {/* ── Full Page Layout ── */}
      <div className="relative z-10 min-h-screen flex flex-col" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>

        {/* ── Corner Mandala Ornaments ── */}
        <CornerMandala size={190} style={{ position: "fixed", top: -54, left: -48, pointerEvents: "none", zIndex: 40, opacity: 0.85 }} />
        <CornerMandala size={190} style={{ position: "fixed", bottom: -54, right: -48, pointerEvents: "none", zIndex: 40, opacity: 0.85 }} />

        {/* ═══════════════ MAIN CENTER AREA ═══════════════ */}
        <main className="flex-1 flex items-center justify-center px-4 py-6">
          {/* Card */}
          <div
            className="w-full grid login-card-grid"
            style={{
              maxWidth: 1080,
              gridTemplateColumns: "38% 62%",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.3)",
              overflow: "hidden",
              boxShadow:
                "0 32px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(201,146,74,0.28), inset 0 1px 0 rgba(255,255,255,0.18)",
            }}
          >

            {/* ── LEFT PANEL: Cream Photo Panel ── */}
            <div
              className="flex flex-col items-center justify-center p-10 relative overflow-hidden"
              style={{
                background: "linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.08) 100%)",
                backdropFilter: "blur(22px) saturate(150%)",
                WebkitBackdropFilter: "blur(22px) saturate(150%)",
                borderRight: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              {/* Institutional Logo Photo on a soft cream card */}
              {!logoFailed ? (
                <div
                  style={{
                    width: "100%",
                    maxWidth: 420,
                    padding: "12px 16px",
                    borderRadius: 16,
                    background: "rgba(255,251,240,0.94)",
                    border: "1px solid rgba(255,255,255,0.7)",
                    boxShadow: "0 22px 55px rgba(0,0,0,0.35)",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src="/logo.png"
                    alt="Darse Burhani"
                    onError={() => setLogoFailed(true)}
                    style={{
                      width: "100%",
                      height: "auto",
                      objectFit: "contain",
                      display: "block",
                      transform: "scale(1.14)",
                      transformOrigin: "center",
                    }}
                  />
                </div>
              ) : (
                <span
                  style={{
                    fontFamily: "'Georgia', 'Times New Roman', serif",
                    fontSize: 34,
                    fontWeight: 700,
                    color: "#8a6a1f",
                  }}
                >
                  Darse Burhani
                </span>
              )}
            </div>

            {/* ── RIGHT PANEL: Translucent Deep Navy ── */}
            <div
              className="flex flex-col justify-center p-10 gap-5"
              style={{
                background: "linear-gradient(160deg, rgba(30,36,66,0.56) 0%, rgba(18,22,44,0.68) 100%)",
                backdropFilter: "blur(24px) saturate(140%)",
                WebkitBackdropFilter: "blur(24px) saturate(140%)",
              }}
            >
              {/* Workspace Header Row */}
              <div className="flex items-center gap-3">
                <span style={{ fontSize: "clamp(13px, 3.4vw, 15px)", fontWeight: 700, color: "#ffffff", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
                  Choose your workspace
                </span>
                <div className="hidden sm:block" style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.16)" }} />
                <span className="hidden sm:inline" style={{ fontSize: 12.5, fontWeight: 600, color: "rgba(255,255,255,0.62)", letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                  4 Roles Available
                </span>
              </div>

              {/* Role Tabs */}
              <div className="grid grid-cols-4 gap-2.5">
                {portals.map((p) => {
                  const active = p.role === selectedRole;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.role}
                      type="button"
                      onClick={() => handlePortalChange(p.role)}
                      aria-pressed={active}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 7,
                        padding: "14px 6px",
                        borderRadius: 12,
                        border: active ? "1px solid rgba(252,211,77,0.6)" : "1px solid rgba(255,255,255,0.28)",
                        background: active
                          ? "linear-gradient(160deg, #fcd468 0%, #ef9f2e 55%, #dd6b27 100%)"
                          : "rgba(12,16,34,0.55)",
                        backdropFilter: active ? undefined : "blur(6px)",
                        WebkitBackdropFilter: active ? undefined : "blur(6px)",
                        cursor: "pointer",
                        transition: "all 0.18s ease",
                      }}
                    >
                      <Icon
                        size={22}
                        color={active ? "#1c1403" : "rgba(255,255,255,0.95)"}
                        strokeWidth={active ? 2.2 : 1.8}
                      />
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: active ? 700 : 600,
                          color: active ? "#1c1403" : "rgba(255,255,255,0.95)",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {p.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">

                {/* Error Banner */}
                {error && (
                  <div
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "rgba(127,29,29,0.7)",
                      border: "1px solid rgba(239,68,68,0.45)",
                      fontSize: 12,
                      color: "#fca5a5",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 8,
                    }}
                    role="alert"
                  >
                    <AlertCircle size={14} color="#f87171" style={{ marginTop: 1, flexShrink: 0 }} />
                    {error}
                  </div>
                )}

                {/* Email Field */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-email"
                      style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.16em", textTransform: "uppercase" }}
                    >
                      {portal.role === "ADMIN" ? "ADMINISTRATOR EMAIL" : portal.inputLabel.toUpperCase()}
                    </label>
                    {portal.role === "STUDENT" && (
                      <button
                        type="button"
                        onClick={handleOpenScanner}
                        style={{ fontSize: 10, fontWeight: 600, color: "#ebaa45", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}
                      >
                        <QrCode size={11} color="#ebaa45" />
                        Scan ITS Card
                      </button>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      <Mail size={16} color="rgba(255,255,255,0.35)" />
                    </div>
                    <input
                      id="login-email"
                      name="email"
                      type={portal.role === "STUDENT" ? "text" : "email"}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      required
                      autoComplete="username"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (error) setError(""); }}
                      placeholder={portal.placeholder}
                      style={{
                        width: "100%",
                        height: 46,
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: "rgba(255,255,255,0.07)",
                        paddingLeft: 42,
                        paddingRight: 12,
                        fontSize: 14.5,
                        color: "#f1f5f9",
                        outline: "none",
                        transition: "border-color 0.18s, background 0.18s",
                        backdropFilter: "blur(4px)",
                        boxSizing: "border-box",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "rgba(212,152,74,0.7)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.10)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                      }}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      style={{ fontSize: 11.5, fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "0.16em", textTransform: "uppercase" }}
                    >
                      PASSWORD
                    </label>
                    {capsLockOn && (
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#fbbf24", display: "flex", alignItems: "center", gap: 3 }}>
                        <AlertCircle size={11} /> Caps Lock
                      </span>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                      <Lock size={16} color="rgba(255,255,255,0.35)" />
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
                      onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                      placeholder="••••••••"
                      style={{
                        width: "100%",
                        height: 46,
                        borderRadius: 10,
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: "rgba(255,255,255,0.07)",
                        paddingLeft: 42,
                        paddingRight: 42,
                        fontSize: 14.5,
                        color: "#f1f5f9",
                        outline: "none",
                        transition: "border-color 0.18s, background 0.18s",
                        backdropFilter: "blur(4px)",
                        boxSizing: "border-box",
                        letterSpacing: showPassword ? "normal" : "0.12em",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "rgba(212,152,74,0.7)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.10)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                        e.currentTarget.style.background = "rgba(255,255,255,0.07)";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute",
                        right: 10,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 4,
                        color: "rgba(255,255,255,0.4)",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Remember + Forgot */}
                <div className="flex items-center justify-between">
                  <label
                    className="flex items-center gap-2.5 cursor-pointer"
                    style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}
                  >
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ position: "absolute", opacity: 0, width: 0, height: 0, cursor: "pointer" }}
                    />
                    <span
                      aria-hidden="true"
                      style={{
                        width: 17,
                        height: 17,
                        borderRadius: 4,
                        border: "1px solid rgba(235,170,69,0.85)",
                        background: rememberMe
                          ? "linear-gradient(160deg, #fcd468 0%, #eb9a35 100%)"
                          : "rgba(255,255,255,0.06)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background 0.15s",
                        flexShrink: 0,
                      }}
                    >
                      {rememberMe && <Check size={12} color="#1c1403" strokeWidth={3.2} />}
                    </span>
                    Remember credentials
                  </label>
                  <button
                    type="button"
                    onClick={() => { setForgotIdentifier(email.trim()); setShowForgotModal(true); }}
                    style={{ fontSize: 13, color: "#ebaa45", background: "none", border: "none", cursor: "pointer", textDecoration: "none" }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={isLoading || isSuccess || lockoutSeconds > 0}
                  style={{
                    width: "100%",
                    height: 52,
                    borderRadius: 12,
                    border: "none",
                    background: isLoading || isSuccess || lockoutSeconds > 0
                      ? "rgba(180,140,30,0.5)"
                      : "linear-gradient(90deg, #fcd468 0%, #ef9a33 52%, #dc6b27 100%)",
                    color: "#1c1403",
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "0.02em",
                    cursor: isLoading || isSuccess || lockoutSeconds > 0 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "filter 0.18s, transform 0.1s",
                    boxShadow: "0 4px 20px rgba(229,169,18,0.3)",
                    marginTop: 4,
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading && !isSuccess && lockoutSeconds === 0) {
                      e.currentTarget.style.filter = "brightness(1.1)";
                    }
                  }}
                  onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
                  onMouseDown={(e) => { e.currentTarget.style.transform = "scale(0.99)"; }}
                  onMouseUp={(e) => { e.currentTarget.style.transform = "scale(1)"; }}
                >
                  {isLoading ? (
                    <>
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          border: "2.5px solid #1c1403",
                          borderTopColor: "transparent",
                          animation: "spin 0.75s linear infinite",
                          display: "inline-block",
                        }}
                      />
                      Verifying credentials...
                    </>
                  ) : isSuccess ? (
                    <>
                      <CheckCircle2 size={16} color="#1c1403" />
                      Authenticated!
                    </>
                  ) : lockoutSeconds > 0 ? (
                    `Account locked · ${lockoutSeconds}s`
                  ) : (
                    <>
                      <LogIn size={17} color="#1c1403" strokeWidth={2.4} />
                      Sign In to {portal.shortLabel} Portal
                      <ArrowRight size={16} color="#1c1403" strokeWidth={2.5} />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>

      {/* Backdrop CSS: layered Twilight Palace composition */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes login-sun-breathe {
          0%, 100% { opacity: 0.72; transform: translateY(-50%) scale(1); }
          50% { opacity: 1; transform: translateY(-50%) scale(1.07); }
        }
        /* 1. Fill wash — sky indigo melting into warm ember ground */
        .login-backdrop-fill {
          background: linear-gradient(180deg, #3d4771 0%, #4a4f73 24%, #6b5d6e 40%, #4a3a38 62%, #241708 84%, #180f04 100%);
        }
        /* 2. Photo — full-length panorama, drifts with the cursor via CSS vars */
        .login-backdrop-photo {
          background-size: 100% auto;
          background-position: center center;
          background-repeat: no-repeat;
          transform: translate3d(var(--login-parallax-x, 0px), var(--login-parallax-y, 0px), 0);
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        /* 3. Seam fade — hidden on desktop, melts photo into wash on mobile */
        .login-photo-fade { display: none; }
        /* 4. Sun glow — breathing amber light at the sunset's position */
        .login-sun-glow {
          right: 2.5%;
          top: 54%;
          width: 320px;
          height: 320px;
          background: radial-gradient(circle, rgba(255, 214, 152, 0.5) 0%, rgba(242, 130, 55, 0.28) 32%, rgba(242, 104, 39, 0) 70%);
          mix-blend-mode: screen;
          animation: login-sun-breathe 7s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .login-sun-glow { animation: none; opacity: 0.85; }
          .login-backdrop-photo { transition: none; }
        }
        @media (max-width: 768px) {
          .login-card-grid { grid-template-columns: 1fr !important; }
          /* Hero band: full panorama pinned to the top — never cropped */
          .login-backdrop-photo { background-position: center top; }
          /* Wash continues below the band in the photo's own foreground tones */
          .login-backdrop-fill { background: linear-gradient(180deg, #261809 0%, #1a1108 34%, #140d05 64%, #100a04 100%); }
          .login-photo-fade {
            display: block;
            top: calc(33.35vw - 56px);
            height: 84px;
            background: linear-gradient(180deg, rgba(22, 14, 5, 0) 0%, rgba(26, 17, 8, 0.7) 60%, #1a1108 100%);
          }
          .login-sun-glow { right: 3%; top: 18.3vw; width: 150px; height: 150px; }
        }
      `}</style>

      {/* ── ITS Card Scanner Modal ── */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,26,48,0.75)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl" style={{ background: "#ffffff", color: "#0f172a" }}>
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
                  <QrCode size={19} color="#b45309" />
                </div>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>Scan ITS Card</h3>
                  <p style={{ fontSize: 11, color: "#64748b" }}>Instant camera &amp; barcode detection</p>
                </div>
              </div>
              <button type="button" onClick={handleCloseScanner} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8, color: "#94a3b8" }}>
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(["camera", "upload"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setScannerMode(mode);
                    if (mode === "camera") startCameraStream(cameraFacing);
                    else stopCameraStream();
                  }}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: scannerMode === mode ? "#065f46" : "#f1f5f9",
                    color: scannerMode === mode ? "#ffffff" : "#374151",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  {mode === "camera" ? "Use Camera" : "Upload Photo"}
                </button>
              ))}
            </div>

            {scannerMode === "camera" ? (
              <div style={{ position: "relative", height: 256, background: "#020617", borderRadius: 14, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: "100%", height: "100%", objectFit: "cover", transform: cameraFacing === "user" ? "scaleX(-1)" : "none" }}
                />
                <div style={{ position: "absolute", inset: 24, border: "2px dashed rgba(251,191,36,0.8)", borderRadius: 10, pointerEvents: "none", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 8 }}>
                  <div style={{ width: "100%", height: 2, background: "#fbbf24", boxShadow: "0 0 8px #f59e0b", animation: "pulse 2s infinite" }} />
                  <span style={{ fontSize: 11, textAlign: "center", color: "#fde68a", background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: 999, alignSelf: "center", fontWeight: 700 }}>
                    Align ITS card barcode here
                  </span>
                  <div style={{ width: "100%", height: 2, background: "#fbbf24", boxShadow: "0 0 8px #f59e0b" }} />
                </div>
                {cameraError && (
                  <p style={{ position: "absolute", bottom: 12, left: 12, right: 12, padding: "6px 10px", background: "rgba(69,10,10,0.9)", border: "1px solid #7f1d1d", fontSize: 11, color: "#fca5a5", borderRadius: 10, textAlign: "center" }}>
                    {cameraError}
                  </p>
                )}
                {scannedItsResult && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(6,78,59,0.95)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "#a7f3d0", fontWeight: 700 }}>Verified ITS</span>
                    <span style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 900, color: "#fcd34d" }}>{scannedItsResult}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={flipCamera}
                  style={{ position: "absolute", right: 10, top: 10, padding: "4px 10px", fontSize: 11, background: "rgba(0,0,0,0.7)", color: "#ffffff", fontWeight: 700, borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer" }}
                >
                  Flip Camera
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{ height: 256, borderRadius: 14, border: "2px dashed #cbd5e1", background: "#f8fafc", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, cursor: "pointer", transition: "all 0.18s" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#059669"; e.currentTarget.style.background = "#f0fdf4"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#cbd5e1"; e.currentTarget.style.background = "#f8fafc"; }}
              >
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#fef3c7", border: "1px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Upload size={22} color="#92400e" />
                </div>
                <p style={{ fontSize: 12, fontWeight: 800, color: "#0f172a" }}>Select ITS Card Photo</p>
                <p style={{ fontSize: 11, color: "#64748b" }}>Scans barcode and 8-digit ITS number</p>
              </div>
            )}

            <p style={{ fontSize: 11, textAlign: "center", color: "#64748b", fontWeight: 500 }}>{scannerStatus}</p>
          </div>
        </div>
      )}

      {/* ── Forgot Password Modal ── */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,26,48,0.75)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4 shadow-2xl" style={{ background: "#ffffff", color: "#0f172a" }}>
            <div className="flex items-center justify-between pb-3" style={{ borderBottom: "1px solid #f1f5f9" }}>
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#fef3c7", border: "1px solid #fde68a" }}>
                  <KeyRound size={19} color="#b45309" />
                </div>
                <h3 style={{ fontSize: 13, fontWeight: 800 }}>Password Assistance</h3>
              </div>
              <button type="button" onClick={() => setShowForgotModal(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, borderRadius: 8, color: "#94a3b8" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.7, display: "flex", flexDirection: "column", gap: 12 }}>
              <p>Institutional credentials are authenticated centrally to safeguard student and faculty records.</p>

              {/* Email / ITS input → auto-catches the profile behind it */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label
                  htmlFor="forgot-identifier"
                  style={{ fontSize: 10.5, fontWeight: 800, color: "#0f172a", letterSpacing: "0.14em", textTransform: "uppercase" }}
                >
                  Your Email or ITS Number
                </label>
                <input
                  id="forgot-identifier"
                  name="identifier"
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  placeholder="e.g. 40444603 or name@darseburhani.edu"
                  style={{
                    width: "100%",
                    height: 42,
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    padding: "0 12px",
                    fontSize: 13.5,
                    color: "#0f172a",
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "border-color 0.15s",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#d4963e"; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#e2e8f0"; }}
                />
                {/* Live profile-catch status */}
                {forgotIdentifier.trim().length >= 3 && (
                  <div role="status" aria-live="polite" style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 6, minHeight: 16 }}>
                    {forgotChecking ? (
                      <span style={{ color: "#94a3b8" }}>Catching profile…</span>
                    ) : forgotProfile ? (
                      <span style={{ color: "#065f46", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <CheckCircle2 size={13} />
                        {forgotProfile.displayName} · {forgotProfile.portal}
                        {forgotProfile.its ? ` · ITS ${forgotProfile.its}` : ""}
                      </span>
                    ) : (
                      <span style={{ color: "#94a3b8" }}>No matching profile found — you can still email support below.</span>
                    )}
                  </div>
                )}
              </div>

              <div style={{ padding: "12px 14px", borderRadius: 12, background: forgotProfile ? "rgba(6,95,70,0.08)" : "rgba(6,95,70,0.06)", border: forgotProfile ? "1px solid #86efac" : "1px solid #bbf7d0" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", display: "block", marginBottom: 4 }}>Mahad al Zahra Administration Desk</span>
                <p style={{ color: "#334155" }}>
                  Direct Support Email:{" "}
                  <a href="mailto:support.darseburhani.galiakot@gmail.com" style={{ color: "#065f46", fontWeight: 700 }}>
                    support.darseburhani.galiakot@gmail.com
                  </a>
                </p>
                <p style={{ color: "#64748b", marginTop: 4 }}>For password resets, credential assistance, and queries, email our support desk directly.</p>
              </div>

              {/* Auto-filled support email CTA */}
              <a
                href={forgotSupportMailto}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  padding: "11px 0",
                  borderRadius: 10,
                  background: "#065f46",
                  color: "#ffffff",
                  fontSize: 12.5,
                  fontWeight: 700,
                  textDecoration: "none",
                  cursor: "pointer",
                  transition: "filter 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.12)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
              >
                <Mail size={15} />
                {forgotProfile
                  ? `Email support — ${forgotProfile.displayName}'s reset request`
                  : "Email support — password reset request"}
              </a>
              {forgotProfile && (
                <p style={{ fontSize: 11, color: "#94a3b8", marginTop: -4 }}>
                  Opens your mail app with name, portal ({forgotProfile.portal})
                  {forgotProfile.its ? `, ITS ${forgotProfile.its}` : ""} and date pre-filled.
                </p>
              )}

              <p style={{ color: "#94a3b8" }}>Talabat students may also approach their appointed class teacher directly for on-premises verification.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#065f46", color: "#ffffff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
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
          onFinish={() => { navigate(transitionTarget.path); }}
        />
      )}
    </>
  );
}
