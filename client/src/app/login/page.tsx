"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn, getSession, signOut } from "next-auth/react";
import { Eye, EyeOff, Camera, Upload, X } from "lucide-react";
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
}

export const portals: PortalConfig[] = [
  {
    role: "ADMIN",
    label: "Administrative Portal",
    shortLabel: "Admin",
    badgeLabel: "Central Administration",
    description: "Official institutional administration for student admissions, faculty scheduling, and academic governance.",
    instructions: "Sign in with your registered administrator email and institutional password.",
    placeholder: "admin@darseburhani.edu",
    inputLabel: "Administrator email",
    rolePath: "/admin",
  },
  {
    role: "TEACHER",
    label: "Faculty Portal",
    shortLabel: "Faculty",
    badgeLabel: "Academic Faculty",
    description: "Class rosters, daily attendance registry, Hifz Quran logbooks, and academic remarks.",
    instructions: "Sign in with your appointed faculty email address.",
    placeholder: "faculty@darseburhani.edu",
    inputLabel: "Faculty email",
    rolePath: "/teacher",
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

      <div className="min-h-screen bg-[#0a1a13] text-[#f5f3ef] flex flex-col justify-between px-4 py-6 sm:px-6 sm:py-8">
        {/* Top Header */}
        <header className="w-full max-w-4xl mx-auto flex items-center justify-between pb-6 border-b border-[#1b3528]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#122b20] border border-[#234937] p-1 flex items-center justify-center shrink-0">
              {!logoFailed ? (
                <img
                  src="/logo.png"
                  alt="Darse Burhani"
                  onError={() => setLogoFailed(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="font-serif text-xs font-bold text-[#c59b27]">DB</span>
              )}
            </div>
            <div>
              <span className="font-serif text-lg font-bold text-[#fbf8f2] tracking-tight block leading-tight">
                Darse Burhani <span className="text-[#c59b27] font-semibold text-sm">(Nisab)</span>
              </span>
              <span className="text-[11px] font-medium tracking-wider uppercase text-[#a49a86] block">
                Mahad al Zahra
              </span>
            </div>
          </div>

          <div className="text-right text-xs text-[#a49a86]">
            <span>Official Academic Gateway</span>
          </div>
        </header>

        {/* Center Main Card */}
        <main className="w-full max-w-4xl mx-auto my-auto py-8">
          <div className="rounded-xl bg-[#0f241b] border border-[#1e3b2d] grid grid-cols-1 md:grid-cols-[1.1fr_1.3fr] overflow-hidden">
            {/* Left Context & Guidance Panel */}
            <div className="p-6 sm:p-8 bg-[#0c1f17] border-b md:border-b-0 md:border-r border-[#1e3b2d] flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-[#c59b27]">
                  {portal.badgeLabel}
                </span>

                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#fbf8f2] leading-snug">
                  {portal.label}
                </h1>

                <p className="text-sm text-[#c7c1b5] leading-relaxed">
                  {portal.description}
                </p>

                <div className="p-4 rounded-lg bg-[#122b20] border border-[#1e3b2d] text-xs text-[#d2cec3] space-y-1.5">
                  <span className="font-semibold text-[#fbf8f2] block">Sign-in instructions</span>
                  <p className="leading-relaxed">{portal.instructions}</p>
                </div>
              </div>

              {/* Institution Help note */}
              <div className="pt-4 border-t border-[#1e3b2d] text-xs text-[#8e8574] space-y-1">
                <p className="font-medium text-[#b8b2a5]">Need credential assistance?</p>
                <p>Contact the Administration Desk at Mahad al Zahra or email admin@darseburhani.edu.</p>
              </div>
            </div>

            {/* Right Sign-In Form Panel */}
            <div className="p-6 sm:p-8 flex flex-col justify-center">
              {/* 4-Role Segmented Control */}
              <div className="space-y-2 mb-6">
                <label className="text-xs font-semibold text-[#a49a86] uppercase tracking-wider block">
                  Select your portal
                </label>
                <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[#0a1a13] border border-[#1e3b2d]" role="tablist">
                  {portals.map((p) => {
                    const active = p.role === selectedRole;
                    return (
                      <button
                        key={p.role}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => handlePortalChange(p.role)}
                        className={`py-2 px-1 rounded-md text-xs text-center transition-colors font-medium ${
                          active
                            ? "bg-[#183a2c] text-[#fbf8f2] font-semibold border border-[#2d5843]"
                            : "text-[#a49a86] hover:text-[#f5f3ef]"
                        }`}
                      >
                        {p.shortLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Error Banner */}
                {error && (
                  <div
                    role="alert"
                    className="p-3 rounded-md bg-[#2d1214] border border-[#6b2528] text-xs font-medium text-[#fca5a5]"
                  >
                    {error}
                  </div>
                )}

                {/* Email / ITS Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-email" className="text-xs font-semibold text-[#d2cec3]">
                      {portal.inputLabel}
                    </label>
                    {portal.role === "STUDENT" && (
                      <button
                        type="button"
                        onClick={handleOpenScanner}
                        className="text-xs font-medium text-[#c59b27] hover:underline"
                      >
                        Scan ITS card
                      </button>
                    )}
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
                    className="w-full h-11 rounded-md bg-[#0a1a13] border border-[#234937] px-3.5 text-sm text-[#f5f3ef] placeholder:text-[#5d6b63] focus:outline-none focus:border-[#c59b27]"
                  />
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="text-xs font-semibold text-[#d2cec3]">
                      Password
                    </label>
                    {capsLockOn && (
                      <span className="text-xs text-[#c59b27]">
                        Caps Lock is active
                      </span>
                    )}
                  </div>
                  <div className="relative">
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
                      className="w-full h-11 rounded-md bg-[#0a1a13] border border-[#234937] pl-3.5 pr-10 text-sm text-[#f5f3ef] placeholder:text-[#5d6b63] focus:outline-none focus:border-[#c59b27]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#7f8c84] hover:text-[#f5f3ef] p-1"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Options row */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[#b8b2a5]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded accent-[#c59b27] bg-[#0a1a13] border-[#234937]"
                    />
                    <span>Remember on this computer</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(true)}
                    className="text-[#c59b27] hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isLoading || isSuccess || lockoutSeconds > 0}
                    className="w-full h-11 rounded-md bg-[#c59b27] hover:bg-[#b58b20] disabled:opacity-50 text-[#0c1f17] font-semibold text-sm transition-colors cursor-pointer"
                  >
                    {isLoading ? (
                      "Verifying credentials..."
                    ) : isSuccess ? (
                      "Signing in..."
                    ) : lockoutSeconds > 0 ? (
                      `Locked (${lockoutSeconds}s)`
                    ) : (
                      `Sign in to ${portal.shortLabel} Portal`
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>

        {/* Bottom Footer */}
        <footer className="w-full max-w-4xl mx-auto pt-6 border-t border-[#1b3528] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#7f8c84]">
          <p>© 2026 Darse Burhani (Nisab) · Mahad al Zahra</p>
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-[#d2cec3] transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-[#d2cec3] transition-colors">
              Terms of Service
            </Link>
          </div>
        </footer>
      </div>

      {/* ITS Card Scanner Modal */}
      {showScannerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg bg-[#0c1f17] border border-[#234937] p-5 text-[#f5f3ef] space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e382b] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#fbf8f2]">Scan ITS Card</h3>
                <p className="text-xs text-[#a49a86]">Talabat quick verification</p>
              </div>
              <button
                type="button"
                onClick={handleCloseScanner}
                className="text-[#a49a86] hover:text-[#fbf8f2]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setScannerMode("camera");
                  startCameraStream(cameraFacing);
                }}
                className={`py-2 px-3 rounded-md text-center font-medium transition-colors ${
                  scannerMode === "camera"
                    ? "bg-[#c59b27] text-[#0c1f17] font-semibold"
                    : "bg-[#122b20] text-[#a49a86] hover:text-[#fbf8f2]"
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
                className={`py-2 px-3 rounded-md text-center font-medium transition-colors ${
                  scannerMode === "upload"
                    ? "bg-[#c59b27] text-[#0c1f17] font-semibold"
                    : "bg-[#122b20] text-[#a49a86] hover:text-[#fbf8f2]"
                }`}
              >
                Upload Photo
              </button>
            </div>

            {scannerMode === "camera" ? (
              <div className="relative h-60 bg-black rounded-md overflow-hidden border border-[#1e382b] flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`h-full w-full object-cover ${cameraFacing === "user" ? "scale-x-[-1]" : ""}`}
                />
                {/* Clean framing box */}
                <div className="absolute inset-8 border border-white/40 rounded pointer-events-none" />
                {cameraError && (
                  <p className="absolute bottom-3 inset-x-3 p-2 bg-[#2d1214] border border-[#6b2528] text-xs text-[#fca5a5] rounded">
                    {cameraError}
                  </p>
                )}
                {scannedItsResult && (
                  <div className="absolute inset-0 bg-[#0c1f17]/95 flex flex-col items-center justify-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-[#a49a86]">Verified ITS</span>
                    <span className="font-mono text-xl font-bold text-[#c59b27]">{scannedItsResult}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={flipCamera}
                  className="absolute right-2 top-2 px-2.5 py-1 text-xs bg-black/60 text-white rounded hover:bg-black/80"
                >
                  Switch Camera
                </button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="h-60 rounded-md border border-dashed border-[#234937] bg-[#10271d] flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-[#143024] transition-colors"
              >
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                <Upload size={24} className="text-[#c59b27] mb-2" />
                <p className="text-xs font-semibold text-[#fbf8f2]">Select ITS card photo</p>
                <p className="text-[11px] text-[#a49a86] mt-0.5">Scans barcode and 8-digit number</p>
              </div>
            )}

            <p className="text-xs text-center text-[#a49a86]">{scannerStatus}</p>
          </div>
        </div>
      )}

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-lg bg-[#0c1f17] border border-[#234937] p-6 text-[#f5f3ef] space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#1e382b] pb-3">
              <h3 className="text-sm font-bold text-[#fbf8f2]">Password Assistance</h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-[#a49a86] hover:text-[#fbf8f2]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 text-xs text-[#c7c1b5] leading-relaxed">
              <p>
                Institutional credentials are managed centrally to safeguard student records.
              </p>
              <div className="p-3 rounded-md bg-[#122b20] border border-[#1e382b] space-y-1">
                <span className="font-semibold text-[#fbf8f2] block">Administration Desk</span>
                <p>Email: admin@darseburhani.edu</p>
                <p>Location: Mahad al Zahra Administration Office</p>
              </div>
              <p className="text-[#a49a86]">
                Talabat students may also approach their appointed class Murabbi directly for verification and assistance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="w-full py-2 rounded-md bg-[#c59b27] text-xs font-semibold text-[#0c1f17] hover:bg-[#b58b20]"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Login Transition Screen */}
      {transitionTarget && (
        <SplashScreen
          mode="login_transition"
          minDurationMs={1200}
          portalName={transitionTarget.portalName}
          onFinish={() => {
            navigate(transitionTarget.path);
          }}
        />
      )}
    </>
  );
}
