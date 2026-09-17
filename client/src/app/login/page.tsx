"use client";

import React, { useState, useEffect } from "react";
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
  ShieldCheck,
  Check,
  Fingerprint,
  HelpCircle,
  X,
  Building2,
  Loader2,
  Sparkles,
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
  cardBg: string;
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
    badgeLabel: "ADMIN PORTAL",
    description: "System governance, security & administrative operations",
    icon: Shield,
    accentColor: "#00c988",
    glowColor: "rgba(0, 201, 136, 0.35)",
    btnGradient: "linear-gradient(135deg, #00c988 0%, #00966b 100%)",
    cardBg: "bg-[#031d17]",
    iconBg: "bg-[#00c988]/15 text-[#00c988] border border-[#00c988]/40",
    badgeBg: "bg-[#00c988]/15 text-[#00c988] border border-[#00c988]/30",
    placeholder: "admin@darseburhani.edu",
    inputLabel: "Admin Email",
    rolePath: "/admin",
  },
  {
    role: "TEACHER",
    label: "Faculty Portal",
    shortLabel: "Faculty",
    badgeLabel: "FACULTY PORTAL",
    description: "Classroom management, attendance tracking & syllabus",
    icon: GraduationCap,
    accentColor: "#00d4e7",
    glowColor: "rgba(0, 212, 231, 0.35)",
    btnGradient: "linear-gradient(135deg, #00d4e7 0%, #0891b2 100%)",
    cardBg: "bg-[#031d22]",
    iconBg: "bg-[#00d4e7]/15 text-[#00d4e7] border border-[#00d4e7]/40",
    badgeBg: "bg-[#00d4e7]/15 text-[#00d4e7] border border-[#00d4e7]/30",
    placeholder: "faculty@darseburhani.edu",
    inputLabel: "Faculty Email",
    rolePath: "/teacher",
  },
  {
    role: "STUDENT",
    label: "Talabat Portal",
    shortLabel: "Talabat",
    badgeLabel: "TALABAT PORTAL",
    description: "Daily timetable, Hifz progress, library & attendance",
    icon: BookOpen,
    accentColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.35)",
    btnGradient: "linear-gradient(135deg, #f59e0b 0%, #b45309 100%)",
    cardBg: "bg-[#221805]",
    iconBg: "bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/40",
    badgeBg: "bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30",
    placeholder: "8-digit ITS or student email",
    inputLabel: "ITS Number or Email",
    rolePath: "/talabat",
  },
  {
    role: "PARENT",
    label: "Parent Portal",
    shortLabel: "Parent",
    badgeLabel: "PARENT PORTAL",
    description: "Child progress reports, leave requests & notices",
    icon: Users,
    accentColor: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.35)",
    btnGradient: "linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)",
    cardBg: "bg-[#1d0a28]",
    iconBg: "bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/40",
    badgeBg: "bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/30",
    placeholder: "parent@darseburhani.edu",
    inputLabel: "Parent Email",
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

  const isEmailValid =
    portal.role === "STUDENT"
      ? /^\d{8}$/.test(email.trim()) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

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

    if (portal.role === "STUDENT" && !isEmailValid) {
      setError("Please enter a valid 8-digit ITS number or student email.");
      return;
    }

    if (portal.role !== "STUDENT" && !isEmailValid) {
      setError("Please enter a valid email address.");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
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
        setError("Administrator privileges required.");
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
      setError("Connection failed. Please check your network and retry.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Sign In — Darse Burhani"
        description="Secure gateway for Aljamea-tus-Saifiyah administrators, faculty, talabat, and parents."
      />

      <main className="min-h-[100dvh] w-full bg-[#02130e] text-white flex flex-col justify-between items-center p-3 sm:p-5 selection:bg-amber-400 selection:text-black touch-manipulation overflow-x-hidden">
        
        {/* ── TOP HEADER SECTION ── */}
        <header className="w-full max-w-md mx-auto pt-2 sm:pt-4 pb-2 flex flex-col items-center shrink-0">
          
          {/* Brand Emblem */}
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border border-amber-300/40"
              style={{
                background: "linear-gradient(135deg, #fef08a 0%, #f59e0b 50%, #b45309 100%)",
                boxShadow: "0 6px 16px -2px rgba(245, 158, 11, 0.45)",
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
                  opacity="0.8"
                />
              </svg>
            </div>

            <div className="flex flex-col">
              <h1 className="font-display font-extrabold text-xl sm:text-2xl text-white tracking-tight leading-none">
                Darse Burhani
              </h1>
              <span className="text-[11px] text-emerald-400/90 font-medium tracking-wide mt-1">
                Aljamea-tus-Saifiyah
              </span>
            </div>
          </div>

          {/* ── Dynamic Role Switcher Tabs ── */}
          <nav aria-label="Portal Selection" className="w-full mt-2">
            <div className="w-full bg-[#031f17] border border-emerald-500/25 rounded-2xl p-1 grid grid-cols-4 gap-1 shadow-md">
              {portals.map((p) => {
                const isActive = p.role === selectedRole;
                const PIcon = p.icon;
                return (
                  <button
                    key={p.role}
                    type="button"
                    onClick={() => handlePortalChange(p.role)}
                    className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 py-2 px-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer touch-manipulation select-none ${
                      isActive ? "text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
                    }`}
                    style={
                      isActive
                        ? {
                            background: p.btnGradient,
                            boxShadow: `0 2px 10px ${p.glowColor}`,
                          }
                        : {}
                    }
                  >
                    <PIcon size={15} className="shrink-0" />
                    <span className="text-[11px] sm:text-xs tracking-tight truncate font-semibold">
                      {p.shortLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </nav>
        </header>

        {/* ── MAIN AUTH CARD ── */}
        <div className="w-full max-w-md mx-auto my-auto py-1 shrink-0">
          <div
            className="w-full rounded-3xl p-[1.5px] transition-colors duration-300"
            style={{
              background: `linear-gradient(145deg, ${portal.accentColor} 0%, rgba(255,255,255,0.15) 50%, ${portal.accentColor} 100%)`,
              boxShadow: `0 10px 25px -5px ${portal.glowColor}`,
            }}
          >
            <div className="w-full bg-[#031d17] rounded-[calc(1.5rem-1.5px)] p-4 sm:p-6 text-white border border-white/5">
              
              {/* Card Header */}
              <div className="flex items-center justify-between pb-3 mb-3.5 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${portal.iconBg}`}>
                    <PortalIcon size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md ${portal.badgeBg}`}>
                        {portal.badgeLabel}
                      </span>
                    </div>
                    <h2 className="font-extrabold text-base text-white mt-0.5 tracking-tight">
                      Sign In to Console
                    </h2>
                  </div>
                </div>

                <span
                  className="text-xs font-bold tracking-wide uppercase px-2 py-1 rounded-lg bg-white/5 border border-white/10"
                  style={{ color: portal.accentColor }}
                >
                  {portal.shortLabel}
                </span>
              </div>

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {error && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-2.5 rounded-xl bg-red-950/90 border border-red-500/50 text-xs text-red-200 flex items-center gap-2 shadow-sm"
                  >
                    <AlertTriangle size={16} className="text-red-400 shrink-0" />
                    <span className="font-semibold text-xs leading-tight">{error}</span>
                  </div>
                )}

                {/* Email / Student Identifier Field */}
                <div>
                  <label
                    htmlFor="login-email"
                    className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider mb-1.5"
                  >
                    {portal.inputLabel}
                  </label>
                  
                  {/* Clean Dedicated Icon Box Input Container */}
                  <div className="w-full flex items-center rounded-xl bg-[#021610] border border-white/15 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/20 transition-all overflow-hidden">
                    {/* Dedicated Icon Prefix Compartment */}
                    <div className="w-11 h-11 flex items-center justify-center bg-white/5 border-r border-white/10 text-emerald-400 shrink-0">
                      {portal.role === "STUDENT" ? (
                        <Fingerprint size={18} className="text-amber-400" />
                      ) : (
                        <Mail size={18} className="text-emerald-400" />
                      )}
                    </div>
                    
                    {/* Actual Input */}
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
                      className="w-full h-11 px-3 bg-transparent text-white placeholder:text-gray-500 focus:outline-none text-[15px] sm:text-sm font-medium touch-manipulation"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label
                      htmlFor="login-password"
                      className="block text-[11px] font-bold text-gray-300 uppercase tracking-wider"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-[11px] text-amber-300 hover:text-amber-200 hover:underline cursor-pointer font-bold touch-manipulation"
                    >
                      Forgot?
                    </button>
                  </div>

                  {/* Clean Dedicated Icon Box Input Container */}
                  <div className="w-full flex items-center rounded-xl bg-[#021610] border border-white/15 focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-400/20 transition-all overflow-hidden">
                    {/* Dedicated Icon Prefix Compartment */}
                    <div className="w-11 h-11 flex items-center justify-center bg-white/5 border-r border-white/10 text-emerald-400 shrink-0">
                      <Lock size={18} className="text-emerald-400" />
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
                      aria-invalid={Boolean(error)}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (error) setError("");
                      }}
                      placeholder="••••••••••••"
                      className="w-full h-11 px-3 bg-transparent text-white placeholder:text-gray-500 focus:outline-none text-[15px] sm:text-sm font-medium touch-manipulation"
                    />

                    {/* Dedicated Password Eye Toggle Button Compartment */}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="w-11 h-11 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0 border-l border-white/5 hover:bg-white/5 touch-manipulation"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Keep Me Signed In Checkbox */}
                <div className="flex items-center justify-between pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none touch-manipulation">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-white/20 bg-[#021610] text-[#00c988] focus:ring-[#00c988]/30 w-4 h-4 cursor-pointer accent-[#00c988]"
                    />
                    <span className="text-xs text-gray-300 font-medium">Keep me signed in</span>
                  </label>
                </div>

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={isLoading || isSuccess || lockoutSeconds > 0}
                  className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-between px-4 shadow-lg transition-all duration-200 disabled:opacity-50 cursor-pointer active:scale-98 overflow-hidden hover:brightness-110 mt-1 touch-manipulation"
                  style={{
                    background: portal.btnGradient,
                    boxShadow: `0 4px 14px ${portal.glowColor}`,
                  }}
                >
                  <span className="font-bold">
                    {lockoutSeconds > 0
                      ? `Security Lockout (${lockoutSeconds}s)`
                      : isSuccess
                      ? `Launching ${portal.shortLabel}...`
                      : isLoading
                      ? "Verifying..."
                      : `Sign In to ${portal.label}`}
                  </span>

                  <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                    {isLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : isSuccess ? (
                      <Check size={16} />
                    ) : (
                      <ArrowRight size={16} />
                    )}
                  </div>
                </button>
              </form>

              {/* Trust & Security Footer */}
              <div className="mt-3.5 pt-2.5 border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400 font-medium">
                <span className="flex items-center gap-1 text-[#00c988] font-semibold">
                  <ShieldCheck size={14} className="text-[#00c988] shrink-0" />
                  256-Bit Encrypted
                </span>
                <span className="flex items-center gap-1 text-gray-400">
                  <Shield size={14} className="text-gray-400 shrink-0" />
                  Darse Burhani
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── GLOBAL FOOTER ── */}
        <footer className="w-full max-w-md mx-auto text-center text-[11px] text-gray-400 py-2 flex items-center justify-center gap-2.5 shrink-0">
          <span>&copy; {new Date().getFullYear()} Darse Burhani</span>
          <span>&bull;</span>
          <a href="/privacy" className="hover:text-amber-300 transition-colors">
            Privacy
          </a>
          <span>&bull;</span>
          <a href="/terms" className="hover:text-amber-300 transition-colors">
            Terms
          </a>
        </footer>
      </main>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md p-6 rounded-2xl bg-[#03231a] border border-emerald-500/30 text-white shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                    <HelpCircle size={18} />
                  </div>
                  <h3 className="font-bold text-sm sm:text-base text-white">Password Assistance</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="py-3.5 space-y-2.5 text-xs sm:text-sm text-gray-300">
                <p>
                  For institutional security, account credentials can be reset through the Administration Desk or your portal coordinator.
                </p>
                <div className="p-3 rounded-xl bg-black/40 border border-white/10 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-gray-200 font-medium">
                    <Building2 size={15} className="text-[#00c988] shrink-0" />
                    <span>Darse Burhani Administration Desk</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-200 font-mono">
                    <Mail size={15} className="text-amber-400 shrink-0" />
                    <span>admin@darseburhani.edu</span>
                  </div>
                </div>
                <p className="text-[11px] text-gray-400">
                  Talabat students may also reach out directly to their respective Class Murabbi.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 font-bold text-xs sm:text-sm text-white shadow-md hover:brightness-110 cursor-pointer transition-all"
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

