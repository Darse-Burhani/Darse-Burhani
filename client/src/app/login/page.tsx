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
    instructions: "Sign in with your administrator email or 'admin' and password.",
    placeholder: "admin or admin@darseburhani.edu",
    inputLabel: "Admin Email or Username",
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

  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotProfile, setForgotProfile] = useState<ForgotProfile | null>(null);
  const [forgotChecking, setForgotChecking] = useState(false);
  const forgotLookupSeq = useRef(0);

  // ── Restore Remembered Login Credentials ──
  useEffect(() => {
    try {
      const isRemembered = localStorage.getItem("darse_remember_me") === "true";
      if (isRemembered) {
        setRememberMe(true);
        const savedId = localStorage.getItem("darse_saved_login_id");
        if (savedId) setEmail(savedId);
        const savedRole = localStorage.getItem("darse_saved_portal_role");
        if (savedRole && ["ADMIN", "TEACHER", "STUDENT", "PARENT"].includes(savedRole)) {
          setSelectedRole(savedRole as any);
        }
      }
    } catch {
      // LocalStorage access fallback (incognito / blocked)
    }
  }, []);

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    if (!checked) {
      try {
        localStorage.removeItem("darse_remember_me");
        localStorage.removeItem("darse_saved_login_id");
        localStorage.removeItem("darse_saved_portal_role");
      } catch {
        // LocalStorage fallback
      }
    }
  };

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
  const isAdminAlias = /^(admin|administrator|superadmin)$/i.test(email.trim());
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
    if (portal.role === "ADMIN" && !isEmail && !isAdminAlias) {
      setError("Please enter your administrator email address or 'admin'.");
      return;
    }
    if (portal.role !== "STUDENT" && portal.role !== "ADMIN" && !isEmail) {
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
        rememberMe,
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

      // Persist or clear remembered credentials based on rememberMe selection
      try {
        if (rememberMe) {
          localStorage.setItem("darse_remember_me", "true");
          localStorage.setItem("darse_saved_login_id", email.trim());
          localStorage.setItem("darse_saved_portal_role", portal.role);
        } else {
          localStorage.removeItem("darse_remember_me");
          localStorage.removeItem("darse_saved_login_id");
          localStorage.removeItem("darse_saved_portal_role");
        }
      } catch {
        // LocalStorage fallback
      }

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
        title="Sign In | Darse Burhani (Nisab)"
        description="Official sign-in portal for Darse Burhani (Nisab) — Mahad al Zahra talabat, faculty, administration, and parents."
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* ── Twilight Palace Backdrop ──
          Layered cinematic composition:
          1. Blurred full-bleed fill — same panorama, cover-scaled and defocused, so
             the backdrop reaches every screen edge with no letterbox gaps
          2. Tint wash — photo-sampled gradient that unifies the composition
          3. Photo — entire panorama, no crop (centered on desktop, hero band on mobile)
          4. Seam fade — melts the photo edge into the wash on desktop and mobile
          5. Sun glow — breathing amber light where the sun sets in the photo
          6. Parallax — the panorama drifts with the cursor (desktop, motion-safe) */}
      {/* ── Twilight Palace Backdrop (its52-Style scenic panorama with cinematic vignette) ── */}
      {/* 1. Ambient underlay layer to guarantee zero letterbox gaps on any screen ratio */}
      <div
        className="fixed inset-0 z-0 pointer-events-none login-backdrop-ambient"
        aria-hidden="true"
      />
      {/* 2. Scenic Photo: centered on the sunset palace */}
      <div
        className="fixed inset-0 z-0 pointer-events-none login-backdrop-photo"
        style={{ backgroundImage: "url('/login-bg-sunset.jpg')" }}
        aria-hidden="true"
      />
      {/* 3. Soft Scenic Background Fade & Vignette (its52 reference) */}
      <div className="fixed inset-0 z-0 pointer-events-none login-backdrop-fade" aria-hidden="true" />
      {/* 4. Ambient sun glow bloom at sunset horizon */}
      <div className="fixed z-0 pointer-events-none login-sun-glow" aria-hidden="true" />

      {/* ── Full Page Layout (Enables smooth native vertical scrolling on all screen heights) ── */}
      <div
        className="login-page-root relative z-10 flex flex-col w-full min-h-[100dvh]"
        style={{
          fontFamily: "'Inter', 'Segoe UI', sans-serif",
          paddingTop: "max(16px, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(24px, env(safe-area-inset-bottom, 0px))",
        }}
      >
        {/* ═══════════════ MAIN CENTER AREA ═══════════════ */}
        <main className="flex-1 flex flex-col justify-center items-center px-3 py-6 sm:px-6 sm:py-10 my-auto w-full">
          {/* Card — Transparent Workspace UI Template (its52-Style Glassmorphism) */}
          <div
            className="w-full login-glass-card max-w-[460px] mx-auto flex flex-col"
            style={{
              borderRadius: 22,
              border: "1px solid rgba(255, 255, 255, 0.28)",
              background: "rgba(255, 255, 255, 0.09)",
              backdropFilter: "blur(24px) saturate(180%)",
              WebkitBackdropFilter: "blur(24px) saturate(180%)",
              boxShadow:
                "0 24px 70px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.12) inset, 0 1px 1px rgba(255, 255, 255, 0.35) inset",
              padding: "clamp(20px, 5vw, 32px)",
            }}
          >
            {/* ── Header: Logo Badge + Institutional Wordmark ── */}
            <div className="flex flex-col items-center justify-center text-center mb-5">
              {!logoFailed && (
                <div
                  className="login-logo-card mb-3"
                  style={{
                    background: "rgba(255, 255, 255, 0.94)",
                    border: "1px solid rgba(255, 255, 255, 0.98)",
                    boxShadow: "0 10px 28px rgba(0, 0, 0, 0.28)",
                    borderRadius: 16,
                    padding: "8px 18px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src="/logo.png"
                    alt="Darse Burhani"
                    onError={() => setLogoFailed(true)}
                    className="login-logo-img"
                    style={{
                      maxHeight: 56,
                      maxWidth: 160,
                      width: "auto",
                      height: "auto",
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                </div>
              )}

              <h1
                style={{
                  fontFamily: "'Cormorant Garamond', 'Georgia', 'Times New Roman', serif",
                  fontSize: "clamp(22px, 5.5vw, 27px)",
                  fontWeight: 700,
                  lineHeight: 1.18,
                  color: "#fffaf0",
                  textShadow: "0 2px 14px rgba(0,0,0,0.6)",
                  margin: 0,
                }}
              >
                Darse Burhani <span style={{ color: "#fcd468" }}>(Nisab)</span>
              </h1>
              <span
                style={{
                  marginTop: 4,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.26em",
                  textTransform: "uppercase",
                  color: "#fcd468",
                  textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                }}
              >
                Mahad al Zahra
              </span>
            </div>

            {/* ── Workspace Selection Template (its52 Segmented UI) ── */}
            <div className="flex flex-col gap-2 mb-4">
              <div className="flex items-center justify-between px-0.5">
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "rgba(255, 255, 255, 0.78)",
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                  }}
                >
                  Select Workspace
                </span>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 600,
                    color: "#fcd468",
                    letterSpacing: "0.02em",
                  }}
                >
                  {portal.badgeLabel}
                </span>
              </div>

              {/* 4 Workspace Role Tabs */}
              <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                {portals.map((p) => {
                  const active = p.role === selectedRole;
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.role}
                      type="button"
                      onClick={() => handlePortalChange(p.role)}
                      aria-pressed={active}
                      className="login-role-btn"
                      style={{
                        border: active ? "1px solid rgba(252,211,77,0.9)" : "1px solid rgba(255,255,255,0.22)",
                        background: active
                          ? "linear-gradient(145deg, #fcd468 0%, #ef9f2e 55%, #dd6b27 100%)"
                          : "rgba(255,255,255,0.10)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                        boxShadow: active ? "0 4px 18px rgba(239,159,46,0.42)" : "0 2px 6px rgba(0,0,0,0.12)",
                        borderRadius: 12,
                        padding: "9px 3px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                        transition: "all 0.18s ease",
                      }}
                    >
                      <Icon
                        size={19}
                        color={active ? "#1c1403" : "rgba(255,255,255,0.92)"}
                        strokeWidth={active ? 2.3 : 1.9}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: active ? 700 : 600,
                          color: active ? "#1c1403" : "rgba(255,255,255,0.92)",
                          textShadow: active ? "none" : "0 1px 3px rgba(0,0,0,0.45)",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {p.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Contextual Description Banner */}
              <div
                className="px-3 py-1.5 rounded-lg text-center"
                style={{
                  background: "rgba(255, 255, 255, 0.07)",
                  border: "1px solid rgba(255, 255, 255, 0.14)",
                  fontSize: 11,
                  lineHeight: 1.45,
                  color: "rgba(255, 255, 255, 0.82)",
                }}
              >
                {portal.description}
              </div>
            </div>

            {/* ── Form Console ── */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {/* Error Banner */}
              {error && (
                <div
                  style={{
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "rgba(127, 29, 29, 0.80)",
                    border: "1px solid rgba(239, 68, 68, 0.55)",
                    fontSize: 12,
                    color: "#fca5a5",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                  role="alert"
                >
                  <AlertCircle size={15} color="#f87171" style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ lineHeight: 1.4 }}>{error}</span>
                </div>
              )}

              {/* Email / Identifier Field */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-email"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.90)",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    {portal.role === "ADMIN" ? "ADMINISTRATOR EMAIL / USERNAME" : portal.inputLabel.toUpperCase()}
                  </label>
                  {portal.role === "STUDENT" && (
                    <button
                      type="button"
                      onClick={handleOpenScanner}
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: "#fcd468",
                        background: "rgba(252,212,104,0.12)",
                        border: "1px solid rgba(252,212,104,0.35)",
                        borderRadius: 6,
                        padding: "2px 7px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <QrCode size={11} color="#fcd468" />
                      Scan ITS Card
                    </button>
                  )}
                </div>
                <div style={{ position: "relative" }}>
                  <div style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                    <Mail size={16} color="rgba(255,255,255,0.45)" />
                  </div>
                  <input
                    id="login-email"
                    name="email"
                    type={portal.role === "STUDENT" || portal.role === "ADMIN" ? "text" : "email"}
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
                      border: "1px solid rgba(255,255,255,0.26)",
                      background: "rgba(255,255,255,0.12)",
                      paddingLeft: 42,
                      paddingRight: 12,
                      fontSize: 14,
                      color: "#ffffff",
                      outline: "none",
                      transition: "border-color 0.18s, background 0.18s, box-shadow 0.18s",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#fcd468";
                      e.currentTarget.style.background = "rgba(255,255,255,0.18)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(252,211,77,0.25)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.26)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.90)",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
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
                    <Lock size={16} color="rgba(255,255,255,0.45)" />
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
                      border: "1px solid rgba(255,255,255,0.26)",
                      background: "rgba(255,255,255,0.12)",
                      paddingLeft: 42,
                      paddingRight: 42,
                      fontSize: 14,
                      color: "#ffffff",
                      outline: "none",
                      transition: "border-color 0.18s, background 0.18s, box-shadow 0.18s",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      boxSizing: "border-box",
                      letterSpacing: showPassword ? "normal" : "0.12em",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "#fcd468";
                      e.currentTarget.style.background = "rgba(255,255,255,0.18)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(252,211,77,0.25)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.26)";
                      e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                      e.currentTarget.style.boxShadow = "none";
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
                      color: "rgba(255,255,255,0.5)",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Remember Credentials + Forgot Password */}
              <div className="flex items-center justify-between mt-0.5">
                <label
                  className="flex items-center gap-2 cursor-pointer"
                  style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)" }}
                >
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => handleRememberMeChange(e.target.checked)}
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
                        : "rgba(255,255,255,0.08)",
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
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#fcd468",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                >
                  Forgot password?
                </button>
              </div>

              {/* Primary CTA Submit Button */}
              <button
                type="submit"
                disabled={isLoading || isSuccess || lockoutSeconds > 0}
                style={{
                  width: "100%",
                  height: 50,
                  borderRadius: 12,
                  border: "none",
                  background: isLoading || isSuccess || lockoutSeconds > 0
                    ? "rgba(180,140,30,0.5)"
                    : "linear-gradient(90deg, #fcd468 0%, #ef9a33 50%, #dc6b27 100%)",
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
                  boxShadow: "0 4px 20px rgba(229,169,18,0.35)",
                  marginTop: 6,
                }}
                onMouseEnter={(e) => {
                  if (!isLoading && !isSuccess && lockoutSeconds === 0) {
                    e.currentTarget.style.filter = "brightness(1.08)";
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

            {/* ── Assistance & Legal Links ── */}
            <div
              className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1"
              style={{
                marginTop: 18,
                paddingTop: 14,
                borderTop: "1px solid rgba(255,255,255,0.14)",
                fontSize: 11.5,
                color: "rgba(255,255,255,0.65)",
                textAlign: "center",
              }}
            >
              <span>
                Need help?{" "}
                <a
                  href="mailto:support.darseburhani.galiakot@gmail.com?subject=Darse%20Burhani%20(Nisab)%20%E2%80%94%20Support%20Request"
                  style={{ color: "#fcd468", fontWeight: 700, textDecoration: "none" }}
                  onMouseEnter={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                >
                  Contact Administration
                </a>
              </span>
              <span aria-hidden="true" style={{ color: "rgba(255,255,255,0.22)" }}>·</span>
              <Link
                to="/privacy"
                style={{ color: "rgba(255,255,255,0.78)", fontWeight: 600, textDecoration: "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#fcd468"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.78)"; }}
              >
                Privacy Policy
              </Link>
              <span aria-hidden="true" style={{ color: "rgba(255,255,255,0.22)" }}>·</span>
              <Link
                to="/terms"
                style={{ color: "rgba(255,255,255,0.78)", fontWeight: 600, textDecoration: "none" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#fcd468"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.78)"; }}
              >
                Terms of Service
              </Link>
            </div>
          </div>

          {/* Institutional Copyright */}
          <div className="mt-4 text-center">
            <p
              style={{
                fontSize: 11,
                color: "rgba(255, 255, 255, 0.70)",
                textShadow: "0 1px 3px rgba(0,0,0,0.5)",
                letterSpacing: "0.02em",
              }}
            >
              © Darse Burhani (Nisab) · Mahad al Zahra · All Rights Reserved
            </p>
          </div>
        </main>
      </div>

      {/* Backdrop CSS: layered Twilight Palace composition & its52 Glassmorphism */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes login-sun-breathe {
          0%, 100% { opacity: 0.65; transform: translateY(-50%) scale(1); }
          50% { opacity: 0.95; transform: translateY(-50%) scale(1.07); }
        }
        /* Backdrop layers: guaranteed never to intercept touch, mouse, or scroll gestures */
        .login-backdrop-ambient,
        .login-backdrop-photo,
        .login-backdrop-fade,
        .login-sun-glow {
          pointer-events: none !important;
          user-select: none !important;
          touch-action: none !important;
        }

        /* Full Page Root: Smooth native momentum scrolling on all devices */
        .login-page-root {
          min-height: 100dvh;
          width: 100%;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch !important;
          overscroll-behavior-y: auto !important;
        }

        /* 1. Ambient underlay layer to guarantee zero gaps / letterbox seams on any screen ratio */
        .login-backdrop-ambient {
          background-image: url('/login-bg-sunset.jpg');
          background-size: cover;
          background-position: center center;
          filter: blur(28px) brightness(0.55) saturate(140%);
          transform: scale(1.08);
          position: fixed;
          inset: -20px;
        }

        /* 2. Backdrop Photo: Full-bleed cover, centered on the twilight palace */
        .login-backdrop-photo {
          background-size: cover;
          background-position: center 36%;
          background-repeat: no-repeat;
          transform: scale(1.02) translate3d(var(--login-parallax-x, 0px), var(--login-parallax-y, 0px), 0);
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* 3. Soft Scenic Background Fade & Vignette (its52 reference) */
        .login-backdrop-fade {
          background:
            radial-gradient(ellipse at 50% 50%, rgba(6, 9, 22, 0.15) 0%, rgba(6, 9, 22, 0.52) 65%, rgba(4, 6, 16, 0.88) 100%),
            linear-gradient(180deg,
              rgba(10, 14, 30, 0.50) 0%,
              rgba(10, 14, 30, 0.12) 25%,
              rgba(10, 14, 30, 0.18) 70%,
              rgba(6, 8, 18, 0.78) 100%
            );
        }

        /* 4. Sun glow bloom at sunset position */
        .login-sun-glow {
          right: 4%;
          top: 45%;
          width: 320px;
          height: 320px;
          background: radial-gradient(circle, rgba(255, 214, 152, 0.50) 0%, rgba(242, 130, 55, 0.25) 35%, rgba(242, 104, 39, 0) 70%);
          mix-blend-mode: screen;
          animation: login-sun-breathe 7s ease-in-out infinite;
        }

        /* Transparent Glass Card (its52 reference) */
        .login-glass-card {
          background: rgba(255, 255, 255, 0.09) !important;
          backdrop-filter: blur(24px) saturate(180%) !important;
          -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
          border: 1px solid rgba(255, 255, 255, 0.28) !important;
          box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.12) inset, 0 1px 1px rgba(255, 255, 255, 0.35) inset !important;
        }

        .login-role-btn:hover {
          background: rgba(255, 255, 255, 0.18) !important;
          border-color: rgba(255, 255, 255, 0.35) !important;
          transform: translateY(-1px);
        }

        @media (prefers-reduced-motion: reduce) {
          .login-sun-glow { animation: none; opacity: 0.85; }
          .login-backdrop-photo { transition: none; }
        }

        /* ── Mobile Viewport Optimization (<= 768px) ── */
        @media (max-width: 768px) {
          .login-glass-card {
            padding: 20px 16px !important;
            border-radius: 18px !important;
          }
          /* Background: Ensure sunset palace photo covers the screen and is beautifully visible */
          .login-backdrop-photo {
            background-size: cover !important;
            background-position: center center !important;
            transform: none !important;
          }
          .login-backdrop-fade {
            background:
              radial-gradient(ellipse at 50% 45%, rgba(6, 9, 22, 0.10) 0%, rgba(6, 9, 22, 0.48) 60%, rgba(4, 6, 16, 0.85) 100%),
              linear-gradient(180deg,
                rgba(8, 12, 28, 0.45) 0%,
                rgba(8, 12, 28, 0.08) 25%,
                rgba(8, 12, 28, 0.15) 65%,
                rgba(6, 8, 18, 0.80) 100%
              ) !important;
          }
          .login-sun-glow {
            right: 0%;
            top: 20%;
            width: 180px;
            height: 180px;
          }
        }
      `}</style>

      {/* ── ITS Card Scanner Modal ── */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(22,26,48,0.75)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl overscroll-contain" style={{ background: "#ffffff", color: "#0f172a" }}>
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
                    background: scannerMode === mode ? "#8a3e14" : "#f1f5f9",
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
                    <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "#f3d9a0", fontWeight: 700 }}>Verified ITS</span>
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
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#ef9a33"; e.currentTarget.style.background = "#fff8e7"; }}
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
          <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl overscroll-contain" style={{ background: "#ffffff", color: "#0f172a" }}>
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
                      <span style={{ color: "#8a3e14", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5 }}>
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

              <div style={{ padding: "12px 14px", borderRadius: 12, background: forgotProfile ? "rgba(6,95,70,0.08)" : "rgba(6,95,70,0.06)", border: forgotProfile ? "1px solid #fcd468" : "1px solid #f3d9a0" }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", display: "block", marginBottom: 4 }}>Mahad al Zahra Administration Desk</span>
                <p style={{ color: "#334155" }}>
                  Direct Support Email:{" "}
                  <a href="mailto:support.darseburhani.galiakot@gmail.com" style={{ color: "#8a3e14", fontWeight: 700 }}>
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
                  background: "#8a3e14",
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
              style={{ width: "100%", padding: "10px 0", borderRadius: 10, border: "none", background: "#8a3e14", color: "#ffffff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
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
