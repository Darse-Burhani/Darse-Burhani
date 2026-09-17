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

      <main className="min-h-[100dvh] flex flex-col items-center justify-between p-4 sm:p-6 md:p-8 bg-[#01140e] text-white relative overflow-hidden select-none selection:bg-amber-400 selection:text-black">
        
        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── FLOWING AMBIENT LIGHT & ANIMATED SILK WAVES ── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          
          {/* 1. Dynamic Floating Volumetric Light Orbs (Continuous Fluid Motion) */}
          <motion.div
            animate={{
              x: [0, 80, -60, 40, 0],
              y: [0, -60, 50, -30, 0],
              scale: [1, 1.15, 0.95, 1.1, 1],
              opacity: [0.25, 0.35, 0.22, 0.3, 0.25],
            }}
            transition={{
              duration: 18,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -top-36 -right-24 w-[700px] h-[650px] rounded-full bg-[radial-gradient(circle_at_60%_40%,rgba(245,158,11,0.32)_0%,rgba(217,119,6,0.12)_45%,transparent_75%)] blur-3xl"
          />

          <motion.div
            animate={{
              x: [0, -70, 50, -40, 0],
              y: [0, 60, -50, 40, 0],
              scale: [1, 1.2, 0.9, 1.12, 1],
              opacity: [0.22, 0.32, 0.18, 0.28, 0.22],
            }}
            transition={{
              duration: 22,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute -top-40 -left-36 w-[680px] h-[650px] rounded-full bg-[radial-gradient(circle_at_40%_40%,rgba(0,201,136,0.25)_0%,rgba(4,120,87,0.1)_50%,transparent_75%)] blur-3xl"
          />

          {/* Active Portal Color Ambient Orb Pulsing */}
          <motion.div
            animate={{
              scale: [1, 1.18, 1],
              opacity: [0.18, 0.28, 0.18],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[550px] rounded-full blur-[100px] pointer-events-none transition-colors duration-1000"
            style={{ background: portal.accentColor }}
          />

          {/* 2. Animated Flowing Silk Ribbons with Continuous Undulation */}
          <motion.svg
            animate={{
              y: [0, -12, 8, -6, 0],
              scaleY: [1, 1.04, 0.98, 1.02, 1],
            }}
            transition={{
              duration: 16,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="absolute inset-0 w-full h-full object-cover opacity-70 pointer-events-none"
            viewBox="0 0 1440 900"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            {/* Emerald Silk Wave 1 */}
            <path
              d="M-100 400 C 200 250, 450 650, 800 420 C 1150 190, 1350 480, 1600 350 L 1600 1000 L -100 1000 Z"
              fill="url(#emeraldGradient1)"
              opacity="0.38"
            />
            {/* Gold Edge Contour 1 */}
            <path
              d="M-100 400 C 200 250, 450 650, 800 420 C 1150 190, 1350 480, 1600 350"
              stroke="url(#goldStroke1)"
              strokeWidth="3"
              fill="none"
              opacity="0.85"
            />
            {/* Deep Silk Wave 2 */}
            <path
              d="M-150 620 C 250 480, 500 850, 950 560 C 1300 350, 1450 680, 1650 500 L 1650 1000 L -150 1000 Z"
              fill="url(#emeraldGradient2)"
              opacity="0.5"
            />
            {/* Gold Edge Contour 2 */}
            <path
              d="M-150 620 C 250 480, 500 850, 950 560 C 1300 350, 1450 680, 1650 500"
              stroke="url(#goldStroke2)"
              strokeWidth="3.5"
              fill="none"
              opacity="0.95"
            />

            <defs>
              <linearGradient id="emeraldGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#004330" />
                <stop offset="50%" stopColor="#02281e" />
                <stop offset="100%" stopColor="#00140e" />
              </linearGradient>
              <linearGradient id="emeraldGradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00583e" />
                <stop offset="50%" stopColor="#013324" />
                <stop offset="100%" stopColor="#00140e" />
              </linearGradient>
              <linearGradient id="goldStroke1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#d4af37" stopOpacity="0.2" />
                <stop offset="30%" stopColor="#fef08a" stopOpacity="0.95" />
                <stop offset="70%" stopColor="#d4af37" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#eab308" stopOpacity="0.3" />
              </linearGradient>
              <linearGradient id="goldStroke2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#fde047" stopOpacity="0.95" />
                <stop offset="40%" stopColor="#ca8a04" stopOpacity="0.85" />
                <stop offset="80%" stopColor="#fef08a" stopOpacity="1" />
                <stop offset="100%" stopColor="#a16207" stopOpacity="0.45" />
              </linearGradient>
            </defs>
          </motion.svg>

          {/* 3. Sweeping Diagonal Light Beam / Caustic Shimmer */}
          <motion.div
            animate={{
              x: ["-100%", "200%"],
            }}
            transition={{
              duration: 9,
              repeat: Infinity,
              ease: "easeInOut",
              repeatDelay: 2,
            }}
            className="absolute top-0 bottom-0 w-[450px] bg-gradient-to-r from-transparent via-white/[0.04] to-transparent transform -skew-x-25 pointer-events-none"
          />

          {/* 4. Floating Micro Star Dust Sparkles */}
          {[
            { top: "15%", left: "20%", delay: 0, duration: 4 },
            { top: "35%", left: "80%", delay: 1.5, duration: 5 },
            { top: "65%", left: "15%", delay: 2.5, duration: 4.5 },
            { top: "75%", left: "85%", delay: 0.8, duration: 6 },
            { top: "25%", left: "65%", delay: 3, duration: 5.5 },
          ].map((star, idx) => (
            <motion.div
              key={idx}
              animate={{
                opacity: [0.1, 0.8, 0.1],
                scale: [0.8, 1.3, 0.8],
                y: [0, -25, 0],
              }}
              transition={{
                duration: star.duration,
                repeat: Infinity,
                delay: star.delay,
                ease: "easeInOut",
              }}
              className="absolute w-1.5 h-1.5 rounded-full bg-amber-200/80 shadow-[0_0_8px_rgba(254,240,138,0.9)] pointer-events-none"
              style={{ top: star.top, left: star.left }}
            />
          ))}

          {/* Showroom Gloss Floor Grid at Base */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/85 via-[#01140e]/65 to-transparent pointer-events-none" />
        </div>

        {/* ══════════════════════════════════════════════════════════════ */}
        {/* ── MAIN LARGER AUTH CARD CONTENT ── */}
        {/* ══════════════════════════════════════════════════════════════ */}
        <div className="w-full flex-1 flex flex-col items-center justify-center py-6 sm:py-8 relative z-10">
          
          {/* Expanded Container Width (Larger Presence) */}
          <div className="w-full max-w-[520px] sm:max-w-[560px] md:max-w-[580px] mx-auto flex flex-col items-center">
            
            {/* ── Top 3D Golden App Tile & Brand Title ── */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className="text-center mb-6 flex flex-col items-center"
            >
              {/* 3D Gold Extruded App Icon Squircle */}
              <div className="relative mb-3.5 group cursor-pointer">
                <div
                  className="w-18 h-18 sm:w-20 sm:h-20 rounded-[1.5rem] flex items-center justify-center relative overflow-hidden transition-transform duration-300 group-hover:scale-105"
                  style={{
                    background: "linear-gradient(135deg, #ffe066 0%, #f59e0b 35%, #d97706 70%, #92400e 100%)",
                    boxShadow: "0 16px 40px -6px rgba(245, 158, 11, 0.6), inset 0 2.5px 3px rgba(255, 255, 255, 0.8), inset 0 -3px 6px rgba(0, 0, 0, 0.45)",
                    border: "1.5px solid rgba(254, 240, 138, 0.65)",
                  }}
                >
                  {/* Top Gloss Specular Highlight */}
                  <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent pointer-events-none rounded-t-[1.5rem]" />
                  
                  {/* 3D Relief Gold Star / Compass */}
                  <div className="relative z-10 drop-shadow-[0_2px_5px_rgba(0,0,0,0.55)] text-white flex items-center justify-center">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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

                {/* Soft Golden Under-Aura */}
                <div className="absolute -inset-2 rounded-3xl bg-amber-400/30 blur-xl -z-10 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Brand Title */}
              <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
                Darse Burhani
              </h1>
            </motion.div>

            {/* ── Segmented Tab Pill Controller ── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="w-full mb-5 flex justify-center"
            >
              <div className="inline-flex items-center p-1.5 rounded-full bg-[#031d17]/90 border border-emerald-500/30 backdrop-blur-2xl shadow-2xl shadow-black/50">
                {portals.map((p) => {
                  const isActive = p.role === selectedRole;
                  const PIcon = p.icon;
                  return (
                    <button
                      key={p.role}
                      type="button"
                      onClick={() => handlePortalChange(p.role)}
                      className={`relative flex items-center justify-center gap-2 py-2 px-4 sm:px-5 rounded-full text-xs sm:text-sm font-bold transition-all duration-300 cursor-pointer ${
                        isActive ? "text-white" : "text-gray-400 hover:text-gray-200"
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activePillTabIndicator"
                          className="absolute inset-0 rounded-full shadow-lg"
                          style={{
                            background: p.btnGradient,
                            boxShadow: `0 4px 20px ${p.glowColor}, inset 0 1px 1.5px rgba(255,255,255,0.4)`,
                            border: "1px solid rgba(255, 255, 255, 0.25)",
                          }}
                          transition={{ type: "spring", stiffness: 450, damping: 35 }}
                        />
                      )}
                      <PIcon className="w-4 h-4 relative z-10" />
                      <span className="relative z-10 tracking-tight font-bold">
                        {p.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* ── 3D Chamfered Glassmorphism Login Card (Enlarged) ── */}
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
                  scale: isHovered ? 1.01 : 1,
                }}
                transition={{ type: "spring", stiffness: 350, damping: 25 }}
                className="w-full relative rounded-[2.25rem] p-[2.5px] transition-all duration-500"
                style={{
                  background: `linear-gradient(135deg, ${portal.accentColor} 0%, rgba(255,255,255,0.25) 30%, ${portal.accentColor} 70%, rgba(255,255,255,0.12) 100%)`,
                  boxShadow: `0 25px 60px -12px ${portal.glowColor}, 0 0 35px ${portal.glowColor}`,
                }}
              >
                {/* 3D Specular Light Sheen Overlay */}
                {isHovered && (
                  <div
                    className="absolute inset-0 pointer-events-none rounded-[2.25rem] z-30 transition-opacity duration-300"
                    style={{
                      background: `radial-gradient(circle 300px at ${coords.px * 100}% ${coords.py * 100}%, rgba(255, 255, 255, 0.18), transparent 70%)`,
                    }}
                  />
                )}

                {/* Inner Card Body with Spacious Padding */}
                <div
                  className="w-full rounded-[calc(2.25rem-2.5px)] p-7 sm:p-9 md:p-10 relative overflow-hidden backdrop-blur-3xl text-white"
                  style={{
                    background: portal.cardBg,
                    border: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  {/* Glowing Top Hairline */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[2.5px] transition-all duration-500"
                    style={{
                      background: `linear-gradient(90deg, transparent, ${portal.accentColor}, #ffd700, transparent)`,
                    }}
                  />

                  {/* ── Card Header ── */}
                  <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/10">
                    <div className="flex items-center gap-4">
                      {/* Larger 3D Squircle Icon Badge with Neon Ring */}
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-lg relative ${portal.iconBg}`}
                        style={{
                          boxShadow: `0 0 20px ${portal.glowColor}`,
                        }}
                      >
                        <Icon className="w-7 h-7 sm:w-8 sm:h-8" style={{ color: portal.accentColor }} />
                      </div>

                      <div>
                        {/* Pill Badge */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] sm:text-xs font-extrabold uppercase tracking-wider px-3 py-0.5 rounded-full border transition-colors ${portal.badgeBg}`}
                          >
                            {portal.badgeLabel}
                          </span>
                        </div>
                        <h2 className="font-extrabold text-xl sm:text-2xl text-white mt-1.5 tracking-tight">
                          Sign In to Continue
                        </h2>
                      </div>
                    </div>

                    {/* Role Access Tag on Right */}
                    <div className="flex flex-col items-end text-right">
                      <span className="text-[10px] uppercase tracking-widest text-emerald-300/70 font-bold">
                        ROLE ACCESS
                      </span>
                      <span
                        className="text-xs sm:text-sm font-extrabold tracking-wide mt-0.5"
                        style={{ color: portal.accentColor }}
                      >
                        {portal.shortLabel}
                      </span>
                    </div>
                  </div>

                  {/* ── Form Inputs ── */}
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {error && (
                      <motion.div
                        role="alert"
                        aria-live="assertive"
                        initial={{ opacity: 0, y: -8, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1, x: [0, -5, 5, -3, 3, 0] }}
                        transition={{ duration: 0.35 }}
                        className="p-3.5 rounded-2xl bg-red-950/90 border border-red-500/50 text-xs sm:text-sm text-red-200 flex items-center gap-3 shadow-lg"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span className="font-semibold">{error}</span>
                      </motion.div>
                    )}

                    {/* Email / Identifier Field */}
                    <div>
                      <label
                        htmlFor="login-email"
                        className="block text-[11px] sm:text-xs font-extrabold text-gray-300 uppercase tracking-wider mb-2"
                      >
                        {portal.inputLabel}
                      </label>
                      <div className="relative">
                        {portal.role === "STUDENT" ? (
                          <Fingerprint className="w-5 h-5 text-gray-400 absolute left-4.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        ) : (
                          <Mail className="w-5 h-5 text-gray-400 absolute left-4.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        )}
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
                          className={`w-full pl-12 pr-5 py-3.5 sm:py-4 rounded-full border bg-[#021f18]/90 text-sm sm:text-base text-white placeholder:text-gray-500 focus:outline-none transition-all font-medium ${
                            error
                              ? "border-rose-500/80 ring-2 ring-rose-500/30"
                              : "border-white/15 focus:border-[#00c988] focus:ring-2 focus:ring-[#00c988]/25 hover:border-white/25"
                          }`}
                        />
                      </div>
                    </div>

                    {/* Password Field */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label
                          htmlFor="login-password"
                          className="block text-[11px] sm:text-xs font-extrabold text-gray-300 uppercase tracking-wider"
                        >
                          PASSWORD
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowForgotModal(true)}
                          className="text-xs sm:text-sm text-amber-300/95 hover:text-amber-200 hover:underline cursor-pointer font-bold"
                        >
                          Forgot Password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-5 h-5 text-gray-400 absolute left-4.5 top-1/2 -translate-y-1/2 pointer-events-none" />
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
                          className={`w-full pl-12 pr-12 py-3.5 sm:py-4 rounded-full border bg-[#021f18]/90 text-sm sm:text-base text-white placeholder:text-gray-500 focus:outline-none transition-all font-medium ${
                            error
                              ? "border-rose-500/80 ring-2 ring-rose-500/30"
                              : "border-white/15 focus:border-[#00c988] focus:ring-2 focus:ring-[#00c988]/25 hover:border-white/25"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1 cursor-pointer"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    {/* Remember Me Checkbox */}
                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="rounded border-white/20 bg-[#021f18] text-[#00c988] focus:ring-[#00c988]/30 w-4 h-4 cursor-pointer accent-[#00c988]"
                        />
                        <span className="text-xs sm:text-sm text-gray-300 font-medium">Keep me signed in</span>
                      </label>
                    </div>

                    {/* ── Vibrant Glowing Capsule Submit CTA Button (Enlarged) ── */}
                    <button
                      type="submit"
                      disabled={isLoading || isSuccess || lockoutSeconds > 0}
                      className="w-full group relative inline-flex items-center justify-between p-2 rounded-full font-extrabold text-sm sm:text-base text-white shadow-xl transition-all duration-300 disabled:opacity-50 cursor-pointer active:scale-98 overflow-hidden hover:brightness-110 mt-2"
                      style={{
                        background: portal.btnGradient,
                        boxShadow: `0 10px 28px ${portal.glowColor}, inset 0 1px 2px rgba(255,255,255,0.45)`,
                        border: "1px solid rgba(255, 255, 255, 0.2)",
                      }}
                    >
                      <span className="pl-5 font-bold">
                        {lockoutSeconds > 0
                          ? `Security Lockout (${lockoutSeconds}s)`
                          : isSuccess
                          ? `Authenticated. Launching ${portal.shortLabel}...`
                          : isLoading
                          ? "Verifying Credentials..."
                          : `Sign In to ${portal.label}`}
                      </span>

                      {/* Right Forward Arrow Disc */}
                      <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/25 flex items-center justify-center shrink-0 group-hover:translate-x-0.5 transition-transform shadow-md">
                        {isLoading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : isSuccess ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <ArrowRight className="w-5 h-5" />
                        )}
                      </span>
                    </button>
                  </form>

                  {/* ── Security Trust Footer ── */}
                  <div className="mt-7 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-gray-400 font-medium">
                    <span className="flex items-center gap-1.5 text-[#00c988] font-bold">
                      <ShieldCheck className="w-4 h-4 text-[#00c988]" />
                      256-Bit Encrypted Session
                    </span>
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <Shield className="w-4 h-4 text-gray-400" />
                      Darse Burhani Security
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* ── Showroom 3D Glossy Floor Reflection Effect (Under Card) ── */}
              <div
                className="w-full h-14 mt-1.5 rounded-[2.25rem] opacity-30 pointer-events-none transform scale-y-[-1] blur-xs overflow-hidden"
                style={{
                  background: `linear-gradient(to top, ${portal.accentColor}44, transparent)`,
                  maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Global Page Footer */}
        <footer className="w-full text-center text-xs text-gray-400 py-3 flex items-center justify-center gap-3 relative z-10">
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
