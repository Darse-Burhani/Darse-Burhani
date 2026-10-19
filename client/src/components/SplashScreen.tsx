"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck, CheckCircle2 } from "lucide-react";

interface SplashScreenProps {
  minDurationMs?: number;
  onFinish?: () => void;
  portalName?: string;
  userName?: string;
  mode?: "initial" | "login_transition";
}

const DEFAULT_LOGIN_STAGES = [
  "Verifying institutional credentials...",
  "Loading academic records...",
  "Initializing workspace...",
  "Entering portal...",
];

export function SplashScreen({
  minDurationMs = 1400,
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
        }, 160);
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
          exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[999999] flex flex-col items-center justify-center select-none bg-gradient-to-br from-[#f8fafc] via-[#f0fdf4] to-[#fef9c3]/70 text-slate-800 overflow-hidden"
          style={{ perspective: "1200px" }}
        >
          {/* ── 3D Ambient Radiant Atmosphere ── */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Luminous Central Radial Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] h-[720px] rounded-full bg-gradient-to-tr from-emerald-400/20 via-amber-300/25 to-teal-300/20 blur-3xl opacity-90 animate-pulse" />
            
            {/* Floating Top-Left Radiant Orb */}
            <div className="absolute -top-24 -left-24 w-[520px] h-[520px] rounded-full bg-emerald-500/15 blur-3xl" />
            
            {/* Floating Bottom-Right Warm Amber Radiance */}
            <div className="absolute -bottom-24 -right-24 w-[520px] h-[520px] rounded-full bg-amber-500/20 blur-3xl" />

            {/* Sacred Islamic 8-Point Star Geometry Wireframe in 3D Metallic Gold */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[540px] opacity-[0.22] border-2 border-dashed border-amber-600/40 rounded-full flex items-center justify-center"
            >
              <div className="w-[430px] h-[430px] border border-emerald-700/30 rotate-45 rounded-lg" />
              <div className="absolute w-[430px] h-[430px] border border-amber-700/30 rounded-lg" />
            </motion.div>
          </div>

          {/* ── 3D Center Container ── */}
          <div
            className="relative z-10 flex flex-col items-center max-w-md px-6 text-center"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* ── 3D Floating Institutional Emblem ── */}
            <div
              className="relative mb-7 flex items-center justify-center"
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Outer Gyroscope 3D Orbit Ring 1 (Gold Metallic) */}
              <motion.div
                animate={{
                  rotateZ: [0, 360],
                  rotateX: [65, 75, 65],
                }}
                transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
                className="absolute w-40 h-40 rounded-full border-2 border-dashed border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.25)] pointer-events-none"
                style={{ transformStyle: "preserve-3d" }}
              />

              {/* Inner Gyroscope 3D Orbit Ring 2 (Emerald Luminous) */}
              <motion.div
                animate={{
                  rotateZ: [360, 0],
                  rotateY: [60, 75, 60],
                }}
                transition={{ duration: 5.5, repeat: Infinity, ease: "linear" }}
                className="absolute w-36 h-36 rounded-full border-2 border-emerald-600/50 shadow-[0_0_20px_rgba(5,150,105,0.25)] pointer-events-none"
                style={{ transformStyle: "preserve-3d" }}
              />

              {/* 3D Tilting Crest Medallion with Specular Enamel & Gold Rim */}
              <motion.div
                animate={{
                  rotateY: [-12, 12, -12],
                  rotateX: [8, -8, 8],
                  y: [-8, 8, -8],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative w-28 h-28 rounded-3xl bg-gradient-to-br from-white via-emerald-50/50 to-amber-50/40 border-2 border-amber-400 p-4 flex items-center justify-center shadow-[0_25px_60px_-12px_rgba(5,150,105,0.3),0_12px_30px_-8px_rgba(217,119,6,0.25),inset_0_2px_4px_rgba(255,255,255,0.9)]"
                style={{
                  transformStyle: "preserve-3d",
                  transform: "translateZ(35px)",
                }}
              >
                {/* 3D Specular Sheen reflection sweep */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-white/70 via-transparent to-amber-100/30 pointer-events-none" />

                {/* Inner Gold Bevel Rim */}
                <div className="absolute inset-1.5 rounded-2xl border border-amber-400/40 pointer-events-none" />

                {/* Institutional Logo with pop-out 3D layer */}
                <img
                  src="/logo.png"
                  alt="Darse Burhani"
                  className="w-full h-full object-contain filter drop-shadow-[0_8px_14px_rgba(6,78,59,0.2)]"
                  style={{ transform: "translateZ(24px)" }}
                  onError={(e) => {
                    const target = e.target as HTMLElement;
                    target.style.display = "none";
                  }}
                />
              </motion.div>

              {/* 3D Depth Floor Shadow underneath that reacts dynamically */}
              <motion.div
                animate={{
                  scale: [0.82, 1.18, 0.82],
                  opacity: [0.35, 0.65, 0.35],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -bottom-6 w-28 h-5 rounded-full bg-emerald-950/20 blur-md pointer-events-none"
              />
            </div>

            {/* ── Title & Institutional Heritage (High-Contrast, Crisp, Authoritative) ── */}
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12, duration: 0.5 }}
              className="space-y-1.5"
            >
              <h1 className="font-serif text-2xl sm:text-3xl font-black tracking-tight text-slate-900 drop-shadow-xs">
                Darse Burhani{" "}
                <span className="text-emerald-700 font-bold text-lg sm:text-xl">
                  (Nisab)
                </span>
              </h1>
              <div className="flex items-center justify-center gap-2.5">
                <span className="w-8 h-[1.5px] bg-amber-500/60 rounded-full" />
                <p className="text-[11px] font-black uppercase tracking-[0.26em] text-amber-800">
                  Mahad al Zahra &bull; Aljamea
                </p>
                <span className="w-8 h-[1.5px] bg-amber-500/60 rounded-full" />
              </div>
            </motion.div>

            {/* Target Portal & User Greeting Pill */}
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.4 }}
              className="mt-4"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/95 backdrop-blur-md border border-emerald-600/25 text-xs font-bold text-emerald-900 shadow-sm shadow-emerald-900/5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                <span>Entering {portalName}</span>
                {userName && (
                  <span className="text-amber-700 font-extrabold">&bull; {userName}</span>
                )}
              </div>
            </motion.div>

            {/* ── 3D Polished Progress Bar ── */}
            <div className="mt-7 w-64 space-y-2">
              <div className="relative h-2.5 w-full rounded-full bg-slate-200/90 border border-slate-300/80 p-0.5 shadow-inner overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-500 shadow-[0_0_14px_rgba(5,150,105,0.5)] relative"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut" }}
                >
                  {/* Moving Light Shimmer reflection inside progress bar */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-shimmer" />
                </motion.div>
              </div>

              {/* Stage Text & Percentage with High Contrast */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 px-0.5">
                <span className="truncate pr-2 text-slate-600">{stageText}</span>
                <span className="font-mono text-emerald-800 font-extrabold shrink-0">
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
