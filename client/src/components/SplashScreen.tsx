"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Sparkles, ShieldCheck, Lock, Activity, CheckCircle2 } from "lucide-react";

interface SplashScreenProps {
  minDurationMs?: number;
  onFinish?: () => void;
  portalName?: string;
  userName?: string;
  mode?: "initial" | "login_transition";
}

const DEFAULT_LOGIN_STAGES = [
  "Authenticating Institutional Credentials…",
  "Verifying Cryptographic 256-bit Session…",
  "Synchronizing Academic & Biometric Ledger…",
  "Initializing Secure Workspace…",
  "Access Granted — Entering Portal…",
];

const DEFAULT_INIT_STAGES = [
  "Initializing Darse Burhani Nisab Engine…",
  "Calibrating Fatimi Calendar & Timetable…",
  "Connecting to Mahad al Zahra Telemetry…",
  "Synchronizing Realtime Attendance Matrices…",
  "Environment Ready",
];

export function SplashScreen({
  minDurationMs = 2000,
  onFinish,
  portalName = "Institutional Portal",
  userName,
  mode = "login_transition",
}: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const stages = mode === "login_transition" ? DEFAULT_LOGIN_STAGES : DEFAULT_INIT_STAGES;
  const [stageText, setStageText] = useState(stages[0]);

  // 3D Parallax Mouse Tracking
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springConfig = { damping: 25, stiffness: 120 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  const rotateX = useTransform(smoothMouseY, [-300, 300], [15, -15]);
  const rotateY = useTransform(smoothMouseX, [-300, 300], [-15, 15]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window;
      mouseX.set(e.clientX - innerWidth / 2);
      mouseY.set(e.clientY - innerHeight / 2);
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  // Progress and Stage Animation Timer
  useEffect(() => {
    const start = performance.now();
    const interval = setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / minDurationMs) * 100));
      setProgress(pct);

      const stageIdx = Math.min(
        stages.length - 1,
        Math.floor((pct / 100) * stages.length)
      );
      setStageText(stages[stageIdx]);

      if (elapsed >= minDurationMs) {
        clearInterval(interval);
        setTimeout(() => {
          setVisible(false);
          if (onFinish) onFinish();
        }, 180);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [minDurationMs, onFinish, stages]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="db-3d-splash-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[999999] flex flex-col items-center justify-center select-none overflow-hidden"
          style={{
            background: "radial-gradient(ellipse at 50% 45%, #032b21 0%, #011d16 45%, #000c09 100%)",
            perspective: "1400px",
          }}
        >
          {/* ── AMBIENT 3D LIGHT BEAMS & VOLUMETRIC GLOWS ── */}
          <div
            className="absolute w-[600px] h-[600px] rounded-full blur-[130px] opacity-35 pointer-events-none"
            style={{
              background: "radial-gradient(circle, #d4af37 0%, #10b981 40%, transparent 70%)",
            }}
          />
          <div
            className="absolute -top-40 -left-40 w-[420px] h-[420px] rounded-full blur-[110px] opacity-25 pointer-events-none"
            style={{ background: "radial-gradient(circle, #059669 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-40 -right-40 w-[420px] h-[420px] rounded-full blur-[110px] opacity-25 pointer-events-none"
            style={{ background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)" }}
          />

          {/* ── 3D FLOATING CONSTELLATION & DUST PARTICLES ── */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(18)].map((_, i) => (
              <motion.div
                key={`spark-3d-${i}`}
                initial={{
                  x: `${(i * 13) % 100}vw`,
                  y: `${100 + (i % 20)}vh`,
                  opacity: 0,
                  scale: 0.4 + (i % 4) * 0.2,
                }}
                animate={{
                  y: "-15vh",
                  opacity: [0, 0.8, 0],
                  scale: [0.4, 1.3, 0.6],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 3.5 + (i % 5) * 1.2,
                  delay: (i * 0.3) % 2.5,
                  ease: "linear",
                }}
                className="absolute w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-amber-200 via-yellow-300 to-emerald-300 shadow-[0_0_10px_rgba(253,224,71,0.9)]"
              />
            ))}
          </div>

          {/* ── 3D ROTATIONAL & INTERACTIVE STAGE ── */}
          <motion.div
            style={{
              rotateX,
              rotateY,
              transformStyle: "preserve-3d",
            }}
            initial={{ scale: 0.82, opacity: 0, z: -80 }}
            animate={{ scale: 1, opacity: 1, z: 0 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center max-w-md px-6 text-center"
          >
            {/* ── 3D GYROSCOPIC MULTI-RING GIMBAL & FLOATING EMBLEM ── */}
            <div
              className="relative flex items-center justify-center mb-4"
              style={{ width: 240, height: 240, transformStyle: "preserve-3d" }}
            >
              {/* Outer 3D Orbital Gyro Ring 1 (Gold Dashed) */}
              <motion.div
                animate={{ rotateZ: 360, rotateX: [65, 75, 65] }}
                transition={{
                  rotateZ: { repeat: Infinity, duration: 12, ease: "linear" },
                  rotateX: { repeat: Infinity, duration: 4, ease: "easeInOut" },
                }}
                className="absolute w-56 h-56 rounded-full border-2 border-dashed border-amber-400/50 pointer-events-none"
                style={{
                  transformStyle: "preserve-3d",
                  boxShadow: "0 0 30px rgba(212,175,55,0.35), inset 0 0 20px rgba(212,175,55,0.2)",
                }}
              >
                {/* 3D Gold Orbiting Satellites */}
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 shadow-[0_0_14px_rgba(253,224,71,1)]"
                  style={{ transform: "translateZ(15px)" }}
                />
                <div
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gradient-to-r from-emerald-300 to-emerald-500 shadow-[0_0_12px_rgba(52,211,153,0.9)]"
                  style={{ transform: "translateZ(10px)" }}
                />
              </motion.div>

              {/* Middle 3D Orbital Gyro Ring 2 (Emerald Solid) */}
              <motion.div
                animate={{ rotateZ: -360, rotateY: [20, -20, 20] }}
                transition={{
                  rotateZ: { repeat: Infinity, duration: 9, ease: "linear" },
                  rotateY: { repeat: Infinity, duration: 5, ease: "easeInOut" },
                }}
                className="absolute w-48 h-48 rounded-full border border-emerald-400/40 pointer-events-none"
                style={{
                  transform: "rotateX(-60deg)",
                  transformStyle: "preserve-3d",
                  boxShadow: "0 0 25px rgba(16,185,129,0.25)",
                }}
              >
                <div
                  className="absolute top-1/2 -right-2 -translate-y-1/2 w-3 h-3 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(253,224,71,1)]"
                  style={{ transform: "translateZ(12px)" }}
                />
              </motion.div>

              {/* Inner 3D Pulse Ring 3 */}
              <motion.div
                animate={{ scale: [0.95, 1.08, 0.95], opacity: [0.4, 0.8, 0.4] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
                className="absolute w-40 h-40 rounded-full border border-yellow-200/30 pointer-events-none"
                style={{
                  boxShadow: "0 0 35px rgba(254,240,138,0.2)",
                }}
              />

              {/* 3D Drop Shadow Base */}
              <div
                className="absolute w-40 h-40 rounded-full bg-black/70 blur-2xl pointer-events-none"
                style={{ transform: "translateZ(-40px) translateY(45px) scale(1.15)" }}
              />

              {/* ── 3D CENTRAL FLOATING MEDALLION HOUSING OFFICIAL LOGO ── */}
              <motion.div
                animate={{
                  y: [-4, 4, -4],
                  rotateZ: [-0.6, 0.6, -0.6],
                }}
                transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
                className="relative z-20 w-32 h-32 sm:w-36 sm:h-36 rounded-[2.2rem] p-3.5 flex items-center justify-center cursor-default"
                style={{
                  transformStyle: "preserve-3d",
                  transform: "translateZ(45px)",
                  background:
                    "radial-gradient(circle at 35% 30%, #065f46 0%, #022c22 65%, #01140e 100%)",
                  border: "2px solid rgba(254, 240, 138, 0.55)",
                  boxShadow:
                    "0 25px 60px -10px rgba(0,0,0,0.9), 0 0 40px rgba(212,175,55,0.5), inset 0 2px 4px rgba(254,240,138,0.8), inset 0 -3px 8px rgba(0,0,0,0.8)",
                }}
              >
                {/* Specular Inner Glaze */}
                <div
                  className="absolute inset-1.5 rounded-[1.8rem] pointer-events-none border border-amber-300/30"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.03) 45%, transparent 65%)",
                  }}
                />

                {/* 3D Breathing Glow Aura Behind Logo */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.75, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="absolute inset-2 rounded-2xl bg-amber-400/30 blur-md"
                />

                {/* THE OFFICIAL LOGO.PNG - High Definition */}
                <img
                  src="/logo.png"
                  alt="Darse Burhani Emblem"
                  width={128}
                  height={128}
                  className="relative z-10 w-full h-full object-contain filter brightness-[1.1] contrast-[1.06] drop-shadow-[0_8px_20px_rgba(212,175,55,0.75)]"
                />
              </motion.div>
            </div>

            {/* ── 3D TYPOGRAPHY & BRAND TITLES ── */}
            <motion.div
              initial={{ y: 18, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="mt-4 text-center"
              style={{ transform: "translateZ(30px)" }}
            >
              <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center justify-center gap-2">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #ffffff 0%, #fef08a 35%, #d4af37 70%, #b45309 100%)",
                    textShadow: "0 4px 22px rgba(212,175,55,0.45)",
                  }}
                >
                  Darse Burhani
                </span>
                <span className="text-amber-400 text-lg sm:text-xl font-bold">(Nisab)</span>
              </h1>

              <p className="mt-1 text-[11px] sm:text-xs font-extrabold uppercase tracking-[0.25em] text-amber-300/90 flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fde047]" />
                Mahad al Zahra
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_#fde047]" />
              </p>

              {/* Portal Target Tag */}
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-bold backdrop-blur-md shadow-xs">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-300" />
                <span>Authorizing {portalName}</span>
              </div>
            </motion.div>

            {/* ── 3D TELEMETRY PROGRESS & STATUS FEEDBACK ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-6 w-full flex flex-col items-center gap-2.5"
              style={{ transform: "translateZ(25px)" }}
            >
              {/* High-Tech Progress Bar */}
              <div className="w-56 sm:w-64 h-2.5 rounded-full bg-black/60 border border-emerald-500/30 overflow-hidden relative p-[1px] shadow-[inset_0_1px_4px_rgba(0,0,0,0.9)]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-200 to-emerald-400 shadow-[0_0_18px_rgba(212,175,55,1)]"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Dynamic Status Text */}
              <div className="flex items-center justify-between w-56 sm:w-64 text-[11px] font-mono text-emerald-200/80">
                <span className="truncate max-w-[200px] text-left">{stageText}</span>
                <span className="text-amber-400 font-bold shrink-0">{progress}%</span>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
