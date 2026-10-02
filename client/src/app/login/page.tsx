"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession, signOut } from "next-auth/react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
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
  ShieldCheck,
  Check,
  Fingerprint,
  HelpCircle,
  X,
  Building2,
  Loader2,
  Sparkles,
  Info,
} from "lucide-react";
import { SEO } from "@/components/SEO";
import { LoginCanvas3D } from "@/components/3d/LoginCanvas3D";

export interface PortalConfig {
  role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT";
  label: string;
  shortLabel: string;
  keyNumber: string;
  badgeLabel: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  glowColor: string;
  btnGradient: string;
  cardBorder: string;
  iconBg: string;
  badgeBg: string;
  placeholder: string;
  inputLabel: string;
  rolePath: string;
}

export const portals: PortalConfig[] = [
  {
    role: "ADMIN",
    label: "Admin Portal",
    shortLabel: "Admin",
    keyNumber: "1",
    badgeLabel: "ADMINISTRATIVE",
    description: "System governance, security & institutional operations",
    icon: Shield,
    accentColor: "#10b981",
    glowColor: "rgba(16, 185, 129, 0.35)",
    btnGradient: "linear-gradient(135deg, #059669 0%, #047857 50%, #064e3b 100%)",
    cardBorder: "border-emerald-500/30",
    iconBg: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    badgeBg: "bg-emerald-950/70 text-emerald-300 border border-emerald-600/30",
    placeholder: "admin@darseburhani.edu",
    inputLabel: "Administrator Email",
    rolePath: "/admin",
  },
  {
    role: "TEACHER",
    label: "Faculty Portal",
    shortLabel: "Faculty",
    keyNumber: "2",
    badgeLabel: "ACADEMIC FACULTY",
    description: "Class rosters, live attendance, Hifz & syllabus tracking",
    icon: GraduationCap,
    accentColor: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.35)",
    btnGradient: "linear-gradient(135deg, #0891b2 0%, #0e7490 50%, #155e75 100%)",
    cardBorder: "border-cyan-500/30",
    iconBg: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30",
    badgeBg: "bg-cyan-950/70 text-cyan-200 border border-cyan-600/30",
    placeholder: "faculty@darseburhani.edu",
    inputLabel: "Faculty Email or ITS",
    rolePath: "/teacher",
  },
  {
    role: "STUDENT",
    label: "Talabat Portal",
    shortLabel: "Talabat",
    keyNumber: "3",
    badgeLabel: "TALABAT STUDENT",
    description: "Timetable, Qur'an progress, library & student identity",
    icon: BookOpen,
    accentColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.35)",
    btnGradient: "linear-gradient(135deg, #d97706 0%, #b45309 50%, #78350f 100%)",
    cardBorder: "border-amber-500/30",
    iconBg: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    badgeBg: "bg-amber-950/70 text-amber-200 border border-amber-500/30",
    placeholder: "8-digit ITS or student email",
    inputLabel: "ITS Number or Student Email",
    rolePath: "/talabat",
  },
  {
    role: "PARENT",
    label: "Parent Portal",
    shortLabel: "Parent",
    keyNumber: "4",
    badgeLabel: "PARENT & GUARDIAN",
    description: "Talabat progress reports, leave requests & notices",
    icon: Users,
    accentColor: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.35)",
    btnGradient: "linear-gradient(135deg, #9333ea 0%, #7e22ce 50%, #581c87 100%)",
    cardBorder: "border-purple-500/30",
    iconBg: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
    badgeBg: "bg-purple-950/70 text-purple-200 border border-purple-500/30",
    placeholder: "parent@darseburhani.edu",
    inputLabel: "Registered Parent Email",
    rolePath: "/parent",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "TEACHER" | "STUDENT" | "PARENT">("ADMIN");

  const portal = portals.find((p) => p.role === selectedRole) || portals[0];
  const PortalIcon = portal.icon;

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
  const [capsLockOn, setCapsLockOn] = useState(false);

  // 3D Canvas mouse parallax state
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // 3D Card Interactive Tilt Spring Physics
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), { stiffness: 200, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), { stiffness: 200, damping: 20 });
  const glintX = useTransform(mouseX, [-0.5, 0.5], ["0%", "100%"]);
  const glintY = useTransform(mouseY, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // 3D background coordinates (-1 to 1)
    const { innerWidth, innerHeight } = window;
    setMousePos({
      x: (e.clientX / innerWidth) * 2 - 1,
      y: (e.clientY / innerHeight) * 2 - 1,
    });

    // 3D card tilt
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width - 0.5;
    const yPct = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(xPct);
    mouseY.set(yPct);
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
    setMousePos({ x: 0, y: 0 });
  }, [mouseX, mouseY]);

  // Keyboard shortcut listener: 1=Admin, 2=Teacher, 3=Student, 4=Parent
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in input
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      if (e.key === "1") handlePortalChange("ADMIN");
      if (e.key === "2") handlePortalChange("TEACHER");
      if (e.key === "3") handlePortalChange("STUDENT");
      if (e.key === "4") handlePortalChange("PARENT");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Live Caps Lock detector
  const checkCapsLock = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState("CapsLock"));
  };

  // Smart student ITS detector
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
        router.push(rolePaths[role] || "/admin");
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
        title="Sign In — Darse Burhani"
        description="Secure 3D gateway for Aljamea-tus-Saifiyah administrators, faculty, talabat, and parents."
      />

      <main
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative min-h-[100dvh] w-full bg-[#01140f] text-white flex flex-col justify-between items-center p-3 sm:p-6 selection:bg-amber-400 selection:text-black overflow-x-hidden"
      >
        {/* ── 3D THREE.JS AMBIENT BACKGROUND SCENE ── */}
        <LoginCanvas3D mousePos={mousePos} />

        {/* ── TOP INSTITUTIONAL EMBLEM & TITLE ── */}
        <header className="relative z-10 w-full max-w-md mx-auto pt-2 sm:pt-4 pb-2 flex flex-col items-center shrink-0">
          
          {/* Brand Emblem with 3D Radial Glow */}
          <div className="flex items-center gap-3.5 mb-2 group">
            <div
              className="relative w-12 h-12 rounded-2xl flex items-center justify-center shadow-2xl shrink-0 border border-amber-300/40 transition-transform duration-300 group-hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #fef08a 0%, #f59e0b 50%, #92400e 100%)",
                boxShadow: "0 8px 24px -4px rgba(245, 158, 11, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.6)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                  fill="#ffffff"
                  stroke="#78350f"
                  strokeWidth="0.8"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 5L13.3 10.7L19 12L13.3 13.3L12 19L10.7 13.3L5 12L10.7 10.7L12 5Z"
                  fill="#ffffff"
                  opacity="0.85"
                />
              </svg>
            </div>

            <div className="flex flex-col">
              <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-white tracking-tight leading-tight flex items-center gap-2">
                Darse Burhani
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                  v2.0
                </span>
              </h1>
              <span className="text-xs text-emerald-300/90 font-semibold tracking-normal mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Aljamea-tus-Saifiyah Institutional Gateway
              </span>
            </div>
          </div>

          {/* ── 3D Tactile Role Switcher Matrix ── */}
          <nav aria-label="Portal Selection" className="w-full mt-3">
            <div className="w-full bg-[#021f17]/90 backdrop-blur-md border border-emerald-500/30 rounded-2xl p-1.5 grid grid-cols-4 gap-1.5 shadow-xl">
              {portals.map((p) => {
                const isActive = p.role === selectedRole;
                const PIcon = p.icon;
                return (
                  <button
                    key={p.role}
                    type="button"
                    onClick={() => handlePortalChange(p.role)}
                    className={`relative flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none ${
                      isActive
                        ? "text-white shadow-md scale-[1.02]"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                    style={
                      isActive
                        ? {
                            background: p.btnGradient,
                            boxShadow: `0 4px 14px ${p.glowColor}, inset 0 1px 1px rgba(255, 255, 255, 0.3)`,
                          }
                        : {}
                    }
                  >
                    <PIcon size={16} className="shrink-0" />
                    <span className="text-xs tracking-tight truncate">
                      {p.shortLabel}
                    </span>
                    <span className="hidden sm:inline-block text-[9px] font-mono opacity-50 ml-0.5">
                      [{p.keyNumber}]
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </header>

        {/* ── 3D TILT AUTHENTICATION CARD ── */}
        <div className="relative z-10 w-full max-w-md mx-auto my-auto py-2 shrink-0 perspective-1000">
          <motion.div
            ref={cardRef}
            style={{
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
            }}
            className="w-full rounded-3xl p-1 sm:p-1.5 bg-emerald-950/20 ring-1 ring-emerald-900/30 shadow-2xl transition-shadow duration-300"
          >
            <div
              className="relative w-full rounded-2xl p-6 sm:p-7 text-white overflow-hidden border border-white/10"
              style={{
                background: "linear-gradient(145deg, rgba(2, 33, 25, 0.94) 0%, rgba(1, 23, 17, 0.96) 100%)",
                boxShadow: `0 20px 50px -10px ${portal.glowColor}, inset 0 1px 1px rgba(255, 255, 255, 0.25)`,
              }}
            >
              {/* Dynamic 3D Specular Glint Refraction */}
              <motion.div
                className="absolute inset-0 pointer-events-none opacity-20 rounded-2xl"
                style={{
                  background: `radial-gradient(circle at ${glintX} ${glintY}, rgba(255,255,255,0.8), transparent 60%)`,
                }}
              />

              {/* Portal Header Badge */}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
                <div className="flex items-center gap-3.5">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-md ${portal.iconBg}`}>
                    <PortalIcon size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-lg text-white tracking-tight">
                        {portal.label}
                      </h2>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${portal.badgeBg}`}>
                        {portal.badgeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
                      {portal.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Authentication Form */}
              <form onSubmit={handleSubmit} className="w-full space-y-4">
                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-3.5 rounded-xl bg-red-950/90 border border-red-500/50 text-xs text-red-200 flex items-center gap-2.5 shadow-md animate-shake"
                  >
                    <AlertTriangle size={17} className="text-red-400 shrink-0" />
                    <span className="font-semibold leading-tight">{error}</span>
                  </div>
                )}

                {/* Email / ITS Input Container */}
                <div className="w-full flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-email"
                      className="text-xs font-semibold text-gray-200 flex items-center gap-1.5"
                    >
                      {portal.inputLabel}
                    </label>

                    {/* Smart ITS detection pill for Talabat */}
                    {portal.role === "STUDENT" && email.length > 0 && (
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full transition-all ${
                        isEightDigitIts
                          ? "bg-amber-950/80 text-amber-300 border border-amber-500/40"
                          : isEmail
                          ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                          : "bg-gray-800 text-gray-400"
                      }`}>
                        {isEightDigitIts ? "✓ 8-Digit ITS ID" : isEmail ? "✓ Student Email" : "Enter 8 Digits"}
                      </span>
                    )}
                  </div>

                  <div className="w-full flex items-center rounded-xl bg-[#01140e] border border-white/15 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/20 transition-all overflow-hidden">
                    <div className="w-11 h-11 flex items-center justify-center bg-white/5 border-r border-white/10 text-emerald-400 shrink-0">
                      {portal.role === "STUDENT" ? (
                        <Fingerprint size={18} className="text-amber-400" />
                      ) : (
                        <Mail size={18} className="text-emerald-400" />
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
                      aria-invalid={Boolean(error)}
                      autoComplete="username"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder={portal.placeholder}
                      className="w-full h-11 px-3.5 bg-transparent text-white placeholder:text-gray-500 focus:outline-none text-sm font-medium"
                    />
                  </div>
                </div>

                {/* Password Input Container */}
                <div className="w-full flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <label
                      htmlFor="login-password"
                      className="text-xs font-semibold text-gray-200"
                    >
                      Password
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs font-medium text-amber-300 hover:text-amber-200 hover:underline cursor-pointer transition-colors focus:outline-none"
                    >
                      Forgot password?
                    </button>
                  </div>

                  <div className="relative w-full flex items-center rounded-xl bg-[#01140e] border border-white/15 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/20 transition-all overflow-hidden">
                    <div className="w-11 h-11 flex items-center justify-center bg-white/5 border-r border-white/10 text-emerald-400 shrink-0">
                      <Lock size={18} className="text-emerald-400" />
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
                      aria-invalid={Boolean(error)}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="••••••••••••"
                      className="w-full h-11 pl-3.5 pr-11 bg-transparent text-white placeholder:text-gray-500 focus:outline-none text-sm font-medium"
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-1.5 w-9 h-9 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* Caps Lock Indicator */}
                  {capsLockOn && (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-medium px-1">
                      <AlertTriangle size={12} />
                      <span>Caps Lock is ON</span>
                    </div>
                  )}
                </div>

                {/* Keep Me Signed In */}
                <div className="w-full flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded-md border-white/20 bg-[#01140e] text-emerald-600 focus:ring-emerald-500/30 cursor-pointer accent-emerald-600"
                    />
                    <span className="text-xs text-gray-300 font-medium">Keep me signed in</span>
                  </label>

                  <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-mono">
                    <ShieldCheck size={13} />
                    <span>TLS 1.3 SECURE</span>
                  </div>
                </div>

                {/* 3D Action Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || isSuccess || lockoutSeconds > 0}
                  className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-between px-5 shadow-xl transition-all duration-200 disabled:opacity-50 cursor-pointer active:scale-[0.98] overflow-hidden hover:brightness-110 mt-2"
                  style={{
                    background: portal.btnGradient,
                    boxShadow: `0 6px 20px -2px ${portal.glowColor}, inset 0 1px 1px rgba(255, 255, 255, 0.35)`,
                  }}
                >
                  <span className="font-bold tracking-tight text-sm">
                    {lockoutSeconds > 0
                      ? `Security Lockout (${lockoutSeconds}s)`
                      : isSuccess
                      ? `Launching ${portal.shortLabel}...`
                      : isLoading
                      ? "Verifying Credentials..."
                      : `Enter ${portal.label}`}
                  </span>

                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : isSuccess ? (
                      <Check size={18} />
                    ) : (
                      <ArrowRight size={18} />
                    )}
                  </div>
                </button>
              </form>

              {/* Institutional Certification Footer */}
              <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between text-xs text-gray-400 font-medium">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <Sparkles size={14} className="text-emerald-400 shrink-0" />
                  256-Bit Encrypted
                </span>
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Building2 size={14} className="text-gray-400 shrink-0" />
                  Aljamea-tus-Saifiyah
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── FOOTER ── */}
        <footer className="relative z-10 w-full max-w-md mx-auto text-center text-xs text-gray-400 py-2 flex items-center justify-center gap-2.5 shrink-0">
          <span>&copy; {new Date().getFullYear()} Darse Burhani</span>
          <span>&bull;</span>
          <a href="/privacy" className="hover:text-amber-300 transition-colors">
            Privacy Policy
          </a>
          <span>&bull;</span>
          <a href="/terms" className="hover:text-amber-300 transition-colors">
            Terms of Service
          </a>
        </footer>
      </main>

      {/* Institutional Password Assistance Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md p-6 rounded-3xl bg-[#021f17] border border-emerald-500/30 text-white shadow-2xl space-y-4"
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
                  For institutional security, account credentials can be reset through the Administration Desk or your designated coordinator.
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
