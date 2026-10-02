"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
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
  Zap,
  Calendar,
  Activity,
  CheckCircle2,
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
  iconBg: string;
  badgeBg: string;
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
    glowColor: "rgba(16, 185, 129, 0.25)",
    btnGradient: "linear-gradient(135deg, #059669 0%, #047857 60%, #064e3b 100%)",
    iconBg: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    badgeBg: "bg-emerald-950/70 text-emerald-300 border border-emerald-600/30",
    placeholder: "admin@darseburhani.edu",
    inputLabel: "Administrator Email",
    rolePath: "/admin",
    demoAccount: { email: "admin@darseburhani.edu", pass: "admin123", title: "Principal Admin" },
  },
  {
    role: "TEACHER",
    label: "Faculty Portal",
    shortLabel: "Faculty",
    badgeLabel: "FACULTY",
    description: "Class rosters, live attendance, Hifz & daily logbooks",
    icon: GraduationCap,
    accentColor: "#06b6d4",
    glowColor: "rgba(6, 182, 212, 0.25)",
    btnGradient: "linear-gradient(135deg, #0891b2 0%, #0e7490 60%, #155e75 100%)",
    iconBg: "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30",
    badgeBg: "bg-cyan-950/70 text-cyan-200 border border-cyan-600/30",
    placeholder: "faculty@darseburhani.edu",
    inputLabel: "Faculty Email or ITS",
    rolePath: "/teacher",
    demoAccount: { email: "teacher@darseburhani.edu", pass: "teacher123", title: "Class Murabbi" },
  },
  {
    role: "STUDENT",
    label: "Talabat Portal",
    shortLabel: "Talabat",
    badgeLabel: "TALABAT",
    description: "Timetable, Qur'an progress, library loans & attendance",
    icon: BookOpen,
    accentColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.25)",
    btnGradient: "linear-gradient(135deg, #d97706 0%, #b45309 60%, #78350f 100%)",
    iconBg: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
    badgeBg: "bg-amber-950/70 text-amber-200 border border-amber-500/30",
    placeholder: "8-digit ITS or student email",
    inputLabel: "ITS Number or Student Email",
    rolePath: "/talabat",
    demoAccount: { email: "50463544", pass: "student123", title: "Talabat Student" },
  },
  {
    role: "PARENT",
    label: "Parent Portal",
    shortLabel: "Parent",
    badgeLabel: "PARENT",
    description: "Academic reports, leave requests & official notices",
    icon: Users,
    accentColor: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.25)",
    btnGradient: "linear-gradient(135deg, #9333ea 0%, #7e22ce 60%, #581c87 100%)",
    iconBg: "bg-purple-500/15 text-purple-300 border border-purple-500/30",
    badgeBg: "bg-purple-950/70 text-purple-200 border border-purple-500/30",
    placeholder: "parent@darseburhani.edu",
    inputLabel: "Registered Parent Email",
    rolePath: "/parent",
    demoAccount: { email: "parent@darseburhani.edu", pass: "parent123", title: "Parent Guardian" },
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
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scannerSuccess, setScannerSuccess] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [serverPing] = useState("24ms");

  // Live Caps Lock detector
  const checkCapsLock = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState("CapsLock"));
  };

  // Smart student ITS detector
  const isEightDigitIts = /^\d{8}$/.test(email.trim());
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const isStudentInputValid = isEightDigitIts || isEmail;

  // Hijri Date Formatter
  const todayDate = new Date();
  const gregorianStr = todayDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

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

  // Quick Persona Auto-Fill
  const handleApplyDemoPersona = (role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT") => {
    const targetPortal = portals.find((p) => p.role === role);
    if (!targetPortal) return;
    setSelectedRole(role);
    setEmail(targetPortal.demoAccount.email);
    setPassword(targetPortal.demoAccount.pass);
    setError("");
  };

  // ITS Scanner Simulator
  const handleStartScanner = () => {
    setShowScannerModal(true);
    setScannerActive(true);
    setScannerSuccess(false);

    // Simulate smart optical laser scan
    setTimeout(() => {
      setScannerActive(false);
      setScannerSuccess(true);
      setTimeout(() => {
        setSelectedRole("STUDENT");
        setEmail("50463544");
        setPassword("student123");
        setShowScannerModal(false);
      }, 900);
    }, 1600);
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
      }, 350);
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
        description="Portal gateway for Aljamea-tus-Saifiyah administrators, faculty, talabat, and parents."
      />

      <main className="relative min-h-[100dvh] w-full bg-[#02130e] text-white flex flex-col justify-between items-center p-3 sm:p-6 selection:bg-amber-400 selection:text-black overflow-x-hidden">
        
        {/* Subtle Ambient Radial Lighting (Clean, smooth executive background) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-emerald-600/10 blur-[130px] pointer-events-none rounded-full" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[250px] bg-amber-500/5 blur-[120px] pointer-events-none rounded-full" />

        {/* ── TOP HEADER ── */}
        <header className="relative z-10 w-full max-w-md mx-auto pt-2 sm:pt-4 pb-2 flex flex-col items-center shrink-0">
          
          {/* Brand Emblem */}
          <div className="flex items-center gap-3.5 mb-2">
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border border-amber-300/40"
              style={{
                background: "linear-gradient(135deg, #fef08a 0%, #f59e0b 50%, #92400e 100%)",
                boxShadow: "0 8px 24px -4px rgba(245, 158, 11, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.6)",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
              <h1 className="font-display font-extrabold text-2xl text-white tracking-tight leading-tight">
                Darse Burhani
              </h1>
              <span className="text-xs text-emerald-300 font-medium tracking-normal mt-0.5">
                Aljamea-tus-Saifiyah
              </span>
            </div>
          </div>

          {/* ── Role Switcher Tabs ── */}
          <nav aria-label="Portal Selection" className="w-full mt-2.5">
            <div className="w-full bg-[#031d17] border border-emerald-500/25 rounded-2xl p-1.5 grid grid-cols-4 gap-1.5 shadow-lg">
              {portals.map((p) => {
                const isActive = p.role === selectedRole;
                const PIcon = p.icon;
                return (
                  <button
                    key={p.role}
                    type="button"
                    onClick={() => handlePortalChange(p.role)}
                    className={`relative flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer select-none ${
                      isActive
                        ? "text-white shadow-md scale-[1.02]"
                        : "text-gray-400 hover:text-white hover:bg-white/5"
                    }`}
                    style={
                      isActive
                        ? {
                            background: p.btnGradient,
                            boxShadow: `0 3px 12px ${p.glowColor}`,
                          }
                        : {}
                    }
                  >
                    <PIcon size={15} className="shrink-0" />
                    <span className="text-xs tracking-tight truncate">
                      {p.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </header>

        {/* ── MAIN AUTHENTICATION CARD ── */}
        <div className="relative z-10 w-full max-w-md mx-auto my-auto py-1 shrink-0">
          <div className="w-full rounded-3xl p-1 bg-emerald-950/20 ring-1 ring-emerald-900/30 shadow-2xl">
            <div
              className="relative w-full rounded-2xl p-6 sm:p-7 text-white overflow-hidden border border-white/10"
              style={{
                background: "linear-gradient(160deg, #03211a 0%, #021712 100%)",
                boxShadow: `0 18px 45px -10px ${portal.glowColor}, inset 0 1px 1px rgba(255, 255, 255, 0.15)`,
              }}
            >
              {/* Portal Header */}
              <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${portal.iconBg}`}>
                    <PortalIcon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-bold text-base sm:text-lg text-white tracking-tight">
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

              {/* Unique Feature 1: Fast One-Click Demo Persona Fillers */}
              <div className="mb-4 p-2.5 rounded-xl bg-black/35 border border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-300 font-semibold">
                  <Zap size={14} className="text-amber-400 shrink-0" />
                  <span>Quick Test:</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                  {portals.map((item) => (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => handleApplyDemoPersona(item.role)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        selectedRole === item.role
                          ? "bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 shadow-xs"
                          : "bg-white/5 text-gray-400 hover:text-gray-200 hover:bg-white/10"
                      }`}
                    >
                      {item.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              {/* Authentication Form */}
              <form onSubmit={handleSubmit} className="w-full space-y-4">
                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-3.5 rounded-xl bg-red-950/90 border border-red-500/50 text-xs text-red-200 flex items-center gap-2.5 shadow-md"
                  >
                    <AlertTriangle size={16} className="text-red-400 shrink-0" />
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

                    {/* Unique Feature 2: Smart ITS Scanner Launch Trigger */}
                    {portal.role === "STUDENT" && (
                      <button
                        type="button"
                        onClick={handleStartScanner}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-400/30 hover:bg-amber-500/25 transition-all cursor-pointer"
                      >
                        <QrCode size={12} />
                        <span>Scan ITS Card</span>
                      </button>
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

                  {/* Smart detection indicator */}
                  {portal.role === "STUDENT" && email.length > 0 && (
                    <div className="flex items-center gap-1.5 px-1 text-[11px] text-gray-400">
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

                {/* Keep Me Signed In & Latency Meter */}
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

                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Ping: {serverPing}</span>
                  </div>
                </div>

                {/* Action Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || isSuccess || lockoutSeconds > 0}
                  className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-between px-5 shadow-lg transition-all duration-200 disabled:opacity-50 cursor-pointer active:scale-[0.98] overflow-hidden hover:brightness-110 mt-2"
                  style={{
                    background: portal.btnGradient,
                    boxShadow: `0 6px 18px -2px ${portal.glowColor}`,
                  }}
                >
                  <span className="font-bold tracking-tight text-sm">
                    {lockoutSeconds > 0
                      ? `Security Lockout (${lockoutSeconds}s)`
                      : isSuccess
                      ? `Launching ${portal.shortLabel}...`
                      : isLoading
                      ? "Verifying..."
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

              {/* Live Academic Session Banner */}
              <div className="mt-5 pt-3.5 border-t border-white/10 flex items-center justify-between text-xs text-gray-400 font-medium">
                <span className="flex items-center gap-1.5 text-amber-300/90 font-medium">
                  <Calendar size={13} className="text-amber-400 shrink-0" />
                  {gregorianStr}
                </span>
                <span className="flex items-center gap-1.5 text-gray-400">
                  <Building2 size={13} className="text-gray-400 shrink-0" />
                  Darse Burhani
                </span>
              </div>
            </div>
          </div>
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

      {/* Unique Feature 3: Interactive ITS Card Smart Optical Scanner Modal */}
      <AnimatePresence>
        {showScannerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm p-6 rounded-3xl bg-[#021f17] border border-amber-500/40 text-white shadow-2xl text-center space-y-4 overflow-hidden"
            >
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <QrCode size={18} className="text-amber-400" />
                  <h3 className="font-bold text-sm text-white">Smart ITS Card Scanner</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScannerModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Optical Scanner Viewport */}
              <div className="relative w-full h-44 rounded-2xl bg-black/70 border-2 border-dashed border-amber-400/40 flex items-center justify-center overflow-hidden">
                {scannerActive && (
                  <motion.div
                    initial={{ y: -80 }}
                    animate={{ y: 80 }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", repeatType: "reverse" }}
                    className="absolute w-full h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b]"
                  />
                )}

                {scannerSuccess ? (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex flex-col items-center gap-2 text-emerald-400"
                  >
                    <CheckCircle2 size={42} />
                    <span className="text-xs font-bold font-mono">ITS: 50463544 VERIFIED</span>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <Fingerprint size={38} className="text-amber-400 animate-pulse" />
                    <span className="text-xs font-medium text-amber-200">Align ITS barcode / QR to scan</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400">
                Place your physical student ITS badge or scan card to auto-fill credentials.
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Password Assistance Modal */}
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
