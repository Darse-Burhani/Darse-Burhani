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
  ShieldCheck,
  Check,
  Fingerprint,
  HelpCircle,
  X,
  Building2,
  Loader2,
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
    description: "System governance, security, and administrative operations",
    icon: Shield,
    accentColor: "#00c988",
    glowColor: "rgba(0, 201, 136, 0.45)",
    btnGradient: "linear-gradient(90deg, #00c988 0%, #00b07a 50%, #00966b 100%)",
    cardBg: "linear-gradient(180deg, rgba(6, 34, 27, 0.94) 0%, rgba(2, 20, 16, 0.98) 100%)",
    iconBg: "bg-gradient-to-br from-[#0b3d30] to-[#042119] text-[#00c988] border border-[#00c988]/50",
    badgeBg: "bg-[#00c988]/15 text-[#00c988] border-[#00c988]/40",
    placeholder: "admin@darseburhani.edu",
    inputLabel: "ADMIN EMAIL",
    rolePath: "/admin",
  },
  {
    role: "TEACHER",
    label: "Faculty Portal",
    shortLabel: "Faculty",
    badgeLabel: "FACULTY PORTAL",
    description: "Classroom management, attendance tracking, and syllabus",
    icon: GraduationCap,
    accentColor: "#00d4e7",
    glowColor: "rgba(0, 212, 231, 0.45)",
    btnGradient: "linear-gradient(90deg, #00d4e7 0%, #00b4c8 50%, #0891b2 100%)",
    cardBg: "linear-gradient(180deg, rgba(6, 32, 38, 0.94) 0%, rgba(2, 18, 22, 0.98) 100%)",
    iconBg: "bg-gradient-to-br from-[#063b47] to-[#03222a] text-[#00d4e7] border border-[#00d4e7]/50",
    badgeBg: "bg-[#00d4e7]/15 text-[#00d4e7] border-[#00d4e7]/40",
    placeholder: "faculty@darseburhani.edu",
    inputLabel: "FACULTY EMAIL",
    rolePath: "/teacher",
  },
  {
    role: "STUDENT",
    label: "Talabat Portal",
    shortLabel: "Talabat",
    badgeLabel: "TALABAT PORTAL",
    description: "Daily timetable, Hifz progress, library, and attendance records",
    icon: BookOpen,
    accentColor: "#f59e0b",
    glowColor: "rgba(245, 158, 11, 0.45)",
    btnGradient: "linear-gradient(90deg, #f59e0b 0%, #d97706 50%, #b45309 100%)",
    cardBg: "linear-gradient(180deg, rgba(38, 26, 6, 0.94) 0%, rgba(20, 14, 2, 0.98) 100%)",
    iconBg: "bg-gradient-to-br from-[#452e05] to-[#261902] text-[#f59e0b] border border-[#f59e0b]/50",
    badgeBg: "bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/40",
    placeholder: "8-digit ITS number or student email",
    inputLabel: "ITS NUMBER OR EMAIL",
    rolePath: "/talabat",
  },
  {
    role: "PARENT",
    label: "Parent Portal",
    shortLabel: "Parent",
    badgeLabel: "PARENT PORTAL",
    description: "Child progress reports, leave requests, and academic notices",
    icon: Users,
    accentColor: "#a855f7",
    glowColor: "rgba(168, 85, 247, 0.45)",
    btnGradient: "linear-gradient(90deg, #a855f7 0%, #9333ea 50%, #7e22ce 100%)",
    cardBg: "linear-gradient(180deg, rgba(32, 8, 48, 0.94) 0%, rgba(18, 3, 28, 0.98) 100%)",
    iconBg: "bg-gradient-to-br from-[#3b0d59] to-[#1f0530] text-[#a855f7] border border-[#a855f7]/50",
    badgeBg: "bg-[#a855f7]/15 text-[#a855f7] border-[#a855f7]/40",
    placeholder: "parent@darseburhani.edu",
    inputLabel: "PARENT EMAIL",
    rolePath: "/parent",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "TEACHER" | "STUDENT" | "PARENT">("ADMIN");

  const portal = portals.find((p) => p.role === selectedRole) || portals[0];
  const Icon = portal.icon;

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

  // 3D Parallax Tilt State
  const cardContainerRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0, px: 0.5, py: 0.5 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardContainerRef.current) return;
    const rect = cardContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const px = x / rect.width;
    const py = y / rect.height;
    const rotateY = (px - 0.5) * 10;
    const rotateX = (0.5 - py) * 10;
    setCoords({ x: rotateX, y: rotateY, px, py });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCoords({ x: 0, y: 0, px: 0.5, py: 0.5 });
  };

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

      <main className="h-screen max-h-[100dvh] overflow-hidden flex flex-col items-center justify-between p-2.5 sm:p-4 bg-[#01140e] text-white relative select-none selection:bg-amber-400 selection:text-black">
        
        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── FLOWING AMBIENT LIGHT & ANIMATED SILK WAVES ── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          
          {/* Dynamic Floating Volumetric Light Orbs */}
          <motion.div
            animate={{
              x: [0, 50, -30, 20, 0],
              y: [0, -30, 20, -15, 0],
              scale: [1, 1.1, 0.95, 1.05, 1],
              opacity: [0.2, 0.28, 0.18, 0.24, 0.2],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -top-36 -right-24 w-[500px] h-[450px] rounded-full bg-[radial-gradient(circle_at_60%_40%,rgba(245,158,11,0.25)_0%,rgba(217,119,6,0.08)_45%,transparent_75%)] blur-3xl"
          />

          <motion.div
            animate={{
              x: [0, -40, 30, -20, 0],
              y: [0, 30, -20, 15, 0],
              scale: [1, 1.12, 0.92, 1.06, 1],
              opacity: [0.18, 0.25, 0.15, 0.22, 0.18],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -top-32 -left-28 w-[500px] h-[450px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(0,201,136,0.18)_0%,rgba(4,120,87,0.06)_50%,transparent_75%)] blur-3xl"
          />

          {/* Active Portal Color Ambient Orb Pulsing */}
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.12, 0.2, 0.12],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full blur-[80px] pointer-events-none transition-colors duration-1000"
            style={{ background: portal.accentColor }}
          />

          {/* Showroom Gloss Floor Grid at Base */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 via-[#01140e]/50 to-transparent pointer-events-none" />
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── MAIN AUTH CARD CONTENT (No Vertical Scroll) ── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div className="w-full flex-1 flex flex-col items-center justify-center relative z-10 my-auto py-0">
          
          <div className="w-full max-w-[460px] mx-auto flex flex-col items-center">
            
            {/* ── Top Brand Title & Logo ── */}
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="text-center mb-2 flex flex-col items-center"
            >
              {/* Gold Extruded App Icon */}
              <div className="relative mb-1.5 group cursor-pointer">
                <div
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center relative overflow-hidden transition-transform duration-300 group-hover:scale-105 shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #ffe066 0%, #f59e0b 35%, #d97706 70%, #92400e 100%)",
                    boxShadow: "0 8px 20px -4px rgba(245, 158, 11, 0.5), inset 0 2px 2px rgba(255, 255, 255, 0.8)",
                    border: "1.5px solid rgba(254, 240, 138, 0.65)",
                  }}
                >
                  <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-2xl" />
                  
                  <div className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.55)] text-white flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M12 2L14.2 9.8L22 12L14.2 14.2L12 22L9.8 14.2L2 12L9.8 9.8L12 2Z"
                        fill="url(#starGoldGradLarge)"
                        stroke="#fff"
                        strokeWidth="0.8"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 5L13.3 10.7L19 12L13.3 13.3L12 19L10.7 13.3L5 12L10.7 10.7L12 5Z"
                        fill="#fff"
                        opacity="0.65"
                      />
                      <defs>
                        <linearGradient id="starGoldGradLarge" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                          <stop stopColor="#ffffff" />
                          <stop offset="0.5" stopColor="#fef08a" />
                          <stop offset="1" stopColor="#ca8a04" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>
                <div className="absolute -inset-1.5 rounded-2xl bg-amber-400/25 blur-lg -z-10 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Brand Title */}
              <h1 className="font-display font-extrabold text-xl sm:text-2xl text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                Darse Burhani
              </h1>
            </motion.div>

            {/* ── Segmented Tab Pill Controller ── */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.05 }}
              className="w-full mb-2.5 flex justify-center"
            >
              <div className="inline-flex items-center p-1 rounded-full bg-[#031d17]/90 border border-emerald-500/30 backdrop-blur-2xl shadow-xl shadow-black/50">
                {portals.map((p) => {
                  const isActive = p.role === selectedRole;
                  const PIcon = p.icon;
                  return (
                    <button
                      key={p.role}
                      type="button"
                      onClick={() => handlePortalChange(p.role)}
                      className={`relative flex items-center justify-center gap-1.5 py-1 px-3 rounded-full text-xs font-bold transition-all duration-300 cursor-pointer ${
                        isActive ? "text-white" : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activePillTabIndicator"
                          className="absolute inset-0 rounded-full shadow-md"
                          style={{
                            background: p.btnGradient,
                            boxShadow: `0 2px 14px ${p.glowColor}, inset 0 1px 1px rgba(255,255,255,0.4)`,
                            border: "1px solid rgba(255, 255, 255, 0.25)",
                          }}
                          transition={{ type: "spring", stiffness: 450, damping: 35 }}
                        />
                      )}
                      <PIcon className="w-3.5 h-3.5 relative z-10 shrink-0" />
                      <span className="relative z-10 tracking-tight font-bold text-xs">
                        {p.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* ── 3D Chamfered Glassmorphism Login Card ── */}
            <div
              ref={cardContainerRef}
              onMouseMove={handleMouseMove}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={handleMouseLeave}
              className="w-full relative group perspective-[1000px]"
            >
              <motion.div
                animate={{
                  rotateX: isHovered ? coords.x : 0,
                  rotateY: isHovered ? coords.y : 0,
                  scale: isHovered ? 1.006 : 1,
                }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="w-full relative rounded-3xl p-[2px] transition-all duration-500"
                style={{
                  background: `linear-gradient(135deg, ${portal.accentColor} 0%, rgba(255,255,255,0.25) 30%, ${portal.accentColor} 70%, rgba(255,255,255,0.12) 100%)`,
                  boxShadow: `0 16px 36px -8px ${portal.glowColor}, 0 0 20px ${portal.glowColor}`,
                }}
              >
                {/* 3D Specular Light Sheen Overlay */}
                {isHovered && (
                  <div
                    className="absolute inset-0 pointer-events-none rounded-3xl z-30 transition-opacity duration-300"
                    style={{
                      background: `radial-gradient(circle 240px at ${coords.px * 100}% ${coords.py * 100}%, rgba(255, 255, 255, 0.16), transparent 70%)`,
                    }}
                  />
                )}

                {/* Inner Card Body */}
                <div
                  className="w-full rounded-[calc(1.5rem-2px)] p-4 sm:p-5 relative overflow-hidden backdrop-blur-3xl text-white"
                  style={{
                    background: portal.cardBg,
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  {/* Glowing Top Hairline */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px] transition-all duration-500"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${portal.accentColor}, #ffd700, transparent)`,
                    }}
                  />

                  {/* ── Card Header ── */}
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      {/* 3D Squircle Icon Badge */}
                      <div
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-md relative shrink-0 ${portal.iconBg}`}
                        style={{
                          boxShadow: `0 0 14px ${portal.glowColor}`,
                        }}
                      >
                        <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" style={{ color: portal.accentColor }} />
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full border transition-colors ${portal.badgeBg}`}
                          >
                            {portal.badgeLabel}
                          </span>
                        </div>
                        <h2 className="font-extrabold text-sm sm:text-base text-white mt-0.5 tracking-tight">
                          Sign In to Continue
                        </h2>
                      </div>
                    </div>

                    {/* Role Access Tag on Right */}
                    <div className="flex flex-col items-end text-right">
                      <span className="text-[9px] uppercase tracking-widest text-emerald-300/70 font-bold">
                        ACCESS
                      </span>
                      <span
                        className="text-xs font-extrabold tracking-wide mt-0.5"
                        style={{ color: portal.accentColor }}
                      >
                        {portal.shortLabel}
                      </span>
                    </div>
                  </div>

                  {/* ── Form Inputs ── */}
                  <form onSubmit={handleSubmit} className="space-y-2.5">
                    {error && (
                      <motion.div
                        role="alert"
                        aria-live="assertive"
                        initial={{ opacity: 0, y: -4, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1, x: [0, -4, 4, -2, 2, 0] }}
                        transition={{ duration: 0.3 }}
                        className="p-2.5 rounded-xl bg-red-950/90 border border-red-500/50 text-xs text-red-200 flex items-center gap-2 shadow-md"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="font-semibold text-xs">{error}</span>
                      </motion.div>
                    )}

                    {/* Email / Identifier Field */}
                    <div>
                      <label
                        htmlFor="login-email"
                        className="block text-[10px] font-extrabold text-gray-300 uppercase tracking-wider mb-1"
                      >
                        {portal.inputLabel}
                      </label>
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center text-gray-400">
                          {portal.role === "STUDENT" ? (
                            <Fingerprint size={16} className="text-gray-400 shrink-0" />
                          ) : (
                            <Mail size={16} className="text-gray-400 shrink-0" />
                          )}
                        </span>
                        <input
                          id="login-email"
                          name="email"
                          type={portal.role === "STUDENT" ? "text" : "email"}
                          required
                          aria-invalid={Boolean(error)}
                          autoComplete="username"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (error) setError("");
                          }}
                          placeholder={portal.placeholder}
                          className={`w-full pl-10 pr-4 py-2 sm:py-2.5 rounded-full border bg-[#021f18]/90 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none transition-all font-medium relative z-0 ${
                            error
                              ? "border-rose-500/80 ring-2 ring-rose-500/30"
                              : "border-white/15 focus:border-[#00c988] focus:ring-2 focus:ring-[#00c988]/25 hover:border-white/25"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Password Field */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="login-password"
                          className="block text-[10px] font-extrabold text-gray-300 uppercase tracking-wider"
                        >
                          PASSWORD
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowForgotModal(true)}
                          className="text-[10px] sm:text-xs text-amber-300/95 hover:text-amber-200 hover:underline cursor-pointer font-bold"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative flex items-center">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center text-gray-400">
                          <Lock size={16} className="text-gray-400 shrink-0" />
                        </span>
                        <input
                          id="login-password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          required
                          aria-invalid={Boolean(error)}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            if (error) setError("");
                          }}
                          placeholder="••••••••••••"
                          className={`w-full pl-10 pr-10 py-2 sm:py-2.5 rounded-full border bg-[#021f18]/90 text-xs sm:text-sm text-white placeholder:text-gray-500 focus:outline-none transition-all font-medium relative z-0 ${
                            error
                              ? "border-rose-500/80 ring-2 ring-rose-500/30"
                              : "border-white/15 focus:border-[#00c988] focus:ring-2 focus:ring-[#00c988]/25 hover:border-white/25"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-0.5 cursor-pointer z-10 flex items-center justify-center"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* Remember Me Checkbox */}
                    <div className="flex items-center justify-between pt-0.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-white/20 bg-[#021f18] text-[#00c988] focus:ring-[#00c988]/30 w-3.5 h-3.5 cursor-pointer accent-[#00c988]"
                        />
                        <span className="text-[11px] text-gray-300 font-medium">Keep me signed in</span>
                      </label>
                    </div>

                    {/* ── Glowing Capsule Submit CTA Button ── */}
                    <button
                      type="submit"
                      disabled={isLoading || isSuccess || lockoutSeconds > 0}
                      className="w-full group relative inline-flex items-center justify-between p-1.5 rounded-full font-extrabold text-xs sm:text-sm text-white shadow-lg transition-all duration-300 disabled:opacity-50 cursor-pointer active:scale-98 overflow-hidden hover:brightness-110 mt-0.5"
                      style={{
                        background: portal.btnGradient,
                        boxShadow: `0 4px 16px ${portal.glowColor}, inset 0 1px 1.5px rgba(255,255,255,0.45)`,
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                      }}
                    >
                      <span className="pl-3.5 font-bold text-xs sm:text-sm">
                        {lockoutSeconds > 0
                          ? `Security Lockout (${lockoutSeconds}s)`
                          : isSuccess
                          ? `Launching ${portal.shortLabel}...`
                          : isLoading
                          ? "Verifying Credentials..."
                          : `Sign In to ${portal.label}`}
                      </span>

                      {/* Right Forward Arrow Disc */}
                      <span className="w-7 h-7 rounded-full bg-white/25 flex items-center justify-center shrink-0 group-hover:translate-x-0.5 transition-transform shadow-sm">
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isSuccess ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                      </span>
                    </button>
                  </form>

                  {/* ── Security Trust Footer ── */}
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-400 font-medium">
                    <span className="flex items-center gap-1 text-[#00c988] font-bold">
                      <ShieldCheck className="w-3.5 h-3.5 text-[#00c988] shrink-0" />
                      256-Bit Encrypted
                    </span>
                    <span className="flex items-center gap-1 text-gray-400">
                      <Shield className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      Darse Burhani Security
                    </span>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Global Page Footer */}
        <footer className="w-full text-center text-[10px] text-gray-400 py-1 flex items-center justify-center gap-2 relative z-10 shrink-0">
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

      {/* Forgot Password Help Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md p-7 rounded-3xl bg-[#03231a] border border-emerald-500/30 text-white shadow-2xl"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
                    <HelpCircle className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-base text-white">Password Assistance</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="py-4 space-y-3 text-sm text-gray-300">
                <p>
                  For security and institutional compliance, account passwords can be reset via the Administration Office or your portal coordinator.
                </p>
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 space-y-2">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-200 font-medium">
                    <Building2 className="w-4 h-4 text-[#00c988] shrink-0" />
                    <span>Darse Burhani Administration Desk</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-200 font-mono">
                    <Mail className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>admin@darseburhani.edu</span>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Talabat students may also reach out directly to their respective Class Murabbi.
                </p>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="w-full py-3.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-700 font-bold text-sm text-white shadow-lg hover:brightness-110 cursor-pointer transition-all"
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
