"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, CheckCircle2, Radio, Zap } from "lucide-react";
import { SplashScreen3D } from "@/components/SplashScreen3D";

interface SplashScreenProps {
  minDurationMs?: number;
  onFinish?: () => void;
  portalName?: string;
  userName?: string;
  mode?: "initial" | "login_transition";
}

const DEFAULT_LOGIN_STAGES = [
  "Verifying institutional credentials...",
  "Synchronizing Hik-Connect biometric telemetry...",
  "Loading academic records & 1447 H curriculum...",
  "Initializing institutional workspace...",
  "Entering portal...",
];

export function SplashScreen({
  minDurationMs = 1500,
  onFinish,
  portalName = "Institutional Portal",
  userName,
  mode = "login_transition",
}: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const stages = DEFAULT_LOGIN_STAGES;
  const [stageText, setStageText] = useState(stages[0]);

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
          key="db-splash-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.08, filter: "blur(12px)" }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[999999] flex flex-col items-center justify-center select-none bg-[#090d16] text-white overflow-hidden"
          style={{ perspective: "1400px" }}
        >
          {/* ── Native 3D WebGL Armillary Sphere & Particle Constellation ── */}
          <SplashScreen3D className="opacity-90" />

          {/* ── Atmospheric Ambient Radiance & Motion Graphics ── */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Luminous Central Radial Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[780px] h-[780px] rounded-full bg-gradient-to-tr from-amber-500/25 via-[#c59b27]/20 to-amber-300/15 blur-3xl opacity-80 animate-pulse" />

            {/* Floating Top-Left Radiant Orb */}
            <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-amber-600/15 blur-3xl" />

            {/* Floating Bottom-Right Warm Amber Radiance */}
            <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full bg-amber-500/15 blur-3xl" />

            {/* Sacred Islamic 8-Point Star Geometry Wireframe in 3D Motion */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 55, repeat: Infinity, ease: "linear" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-[0.25] border-2 border-dashed border-amber-500/30 rounded-full flex items-center justify-center pointer-events-none"
            >
              <div className="w-[460px] h-[460px] border border-amber-400/30 rotate-45 rounded-2xl" />
              <div className="absolute w-[460px] h-[460px] border border-amber-300/30 rounded-2xl" />
            </motion.div>

            {/* Counter-rotating Golden Orbit Ring */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] opacity-[0.18] border border-dotted border-amber-300/40 rounded-full pointer-events-none"
            />
          </div>

          {/* ── 3D Center Container ── */}
          <div
            className="relative z-10 flex flex-col items-center max-w-md px-6 text-center"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* ── 3D Floating Institutional Emblem ── */}
            <div
              className="relative mb-6 flex items-center justify-center"
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Outer Gyroscope 3D Orbit Ring 1 (Gold Metallic) */}
              <motion.div
                animate={{
                  rotateZ: [0, 360],
                  rotateX: [65, 75, 65],
                }}
                transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
                className="absolute w-44 h-44 rounded-full border-2 border-dashed border-amber-400/60 shadow-[0_0_24px_rgba(245,158,11,0.35)] pointer-events-none"
                style={{ transformStyle: "preserve-3d" }}
              />

              {/* Inner Gyroscope 3D Orbit Ring 2 (Antique Gold Luminous) */}
              <motion.div
                animate={{
                  rotateZ: [360, 0],
                  rotateY: [60, 75, 60],
                }}
                transition={{ duration: 5.5, repeat: Infinity, ease: "linear" }}
                className="absolute w-36 h-36 rounded-full border-2 border-amber-300/50 shadow-[0_0_24px_rgba(243,184,51,0.35)] pointer-events-none"
                style={{ transformStyle: "preserve-3d" }}
              />

              {/* 3D Tilting Crest Medallion with Specular Enamel & Gold Rim */}
              <motion.div
                animate={{
                  rotateY: [-10, 10, -10],
                  rotateX: [8, -8, 8],
                  y: [-6, 6, -6],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-slate-900/90 via-slate-800/90 to-[#0e1726]/90 border-2 border-amber-400/80 p-4 flex items-center justify-center shadow-[0_25px_60px_-10px_rgba(245,158,11,0.4),0_12px_30px_-6px_rgba(217,119,6,0.3),inset_0_2px_4px_rgba(255,255,255,0.2)] backdrop-blur-xl"
                style={{
                  transformStyle: "preserve-3d",
                  transform: "translateZ(40px)",
                }}
              >
                {/* 3D Specular Sheen reflection sweep */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/20 via-transparent to-amber-400/20 pointer-events-none" />

                {/* Inner Gold Bevel Rim */}
                <div className="absolute inset-1.5 rounded-2xl border border-amber-400/40 pointer-events-none" />

                {/* Institutional Logo with 3D pop-out */}
                <img
                  src="/logo.png"
                  alt="Darse Burhani"
                  className="w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
                  style={{ transform: "translateZ(26px)" }}
                  onError={(e) => {
                    const target = e.target as HTMLElement;
                    target.style.display = "none";
                  }}
                />
              </motion.div>

              {/* 3D Depth Dynamic Shadow underneath */}
              <motion.div
                animate={{
                  scale: [0.85, 1.15, 0.85],
                  opacity: [0.4, 0.75, 0.4],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -bottom-6 w-32 h-6 rounded-full bg-amber-500/20 blur-md pointer-events-none"
              />
            </div>

            {/* ── Title & Institutional Heritage (Motion Graphics Reveal) ── */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.55 }}
              className="space-y-1.5"
            >
              <h1 className="font-display text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-md">
                Darse Burhani{" "}
                <span className="text-amber-400 font-bold text-lg sm:text-xl">
                  (Nisab)
                </span>
              </h1>
              <div className="flex items-center justify-center gap-2.5">
                <span className="w-8 h-[1.5px] bg-amber-400/60 rounded-full" />
                <p className="text-[11px] font-black uppercase tracking-[0.28em] text-amber-300">
                  Mahad al Zahra · Galiakot
                </p>
                <span className="w-8 h-[1.5px] bg-amber-400/60 rounded-full" />
              </div>
            </motion.div>

            {/* Target Portal & User Greeting Pill with Motion Badge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.45 }}
              className="mt-4"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-amber-400/40 text-xs font-bold text-amber-200 shadow-lg shadow-amber-900/20">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span>Entering {portalName}</span>
                {userName && (
                  <span className="text-emerald-400 font-extrabold">&bull; {userName}</span>
                )}
              </div>
            </motion.div>

            {/* ── 3D Polished Glowing Progress Bar ── */}
            <div className="mt-7 w-72 space-y-2.5">
              <div className="relative h-2.5 w-full rounded-full bg-slate-800/90 border border-slate-700/80 p-0.5 shadow-inner overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-500 shadow-[0_0_16px_rgba(245,158,11,0.6)] relative"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut" }}
                >
                  {/* Moving Light Shimmer reflection inside progress bar */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer" />
                </motion.div>
              </div>

              {/* Stage Text & Percentage with High Contrast Motion */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-300 px-0.5">
                <span className="truncate pr-2 text-slate-400 text-[11.5px] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {stageText}
                </span>
                <span className="font-mono text-amber-400 font-extrabold shrink-0 text-xs">
                  {progress}%
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
