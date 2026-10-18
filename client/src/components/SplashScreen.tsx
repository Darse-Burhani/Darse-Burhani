"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldCheck } from "lucide-react";

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
        }, 150);
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
          exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[999999] flex flex-col items-center justify-center select-none bg-[#03140e] text-[#f5f3ef] overflow-hidden"
          style={{ perspective: "1200px" }}
        >
          {/* ── 3D Ambient Background Atmosphere ── */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Deep radial lighting depth */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-radial from-emerald-600/15 via-[#c59b27]/8 to-transparent blur-3xl opacity-80" />
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[450px] h-[450px] rounded-full bg-emerald-500/10 blur-2xl animate-pulse" />

            {/* Sacred Islamic 8-Point Star Geometry Wireframe in 3D */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] opacity-[0.06] border border-[#c59b27] rounded-full flex items-center justify-center"
            >
              <div className="w-[420px] h-[420px] border border-[#c59b27] rotate-45" />
              <div className="absolute w-[420px] h-[420px] border border-[#c59b27]" />
            </motion.div>
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
              {/* Outer Gyroscope 3D Orbit Ring 1 */}
              <motion.div
                animate={{
                  rotateZ: [0, 360],
                  rotateX: [65, 75, 65],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute w-36 h-36 rounded-full border border-dashed border-[#c59b27]/40 pointer-events-none"
                style={{ transformStyle: "preserve-3d" }}
              />

              {/* Inner Gyroscope 3D Orbit Ring 2 */}
              <motion.div
                animate={{
                  rotateZ: [360, 0],
                  rotateY: [60, 75, 60],
                }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="absolute w-32 h-32 rounded-full border border-[#d4af37]/30 pointer-events-none"
                style={{ transformStyle: "preserve-3d" }}
              />

              {/* 3D Tilting Crest Medallion */}
              <motion.div
                animate={{
                  rotateY: [-12, 12, -12],
                  rotateX: [8, -8, 8],
                  y: [-6, 6, -6],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative w-24 h-24 rounded-2xl bg-gradient-to-br from-[#0c2e20] via-[#082016] to-[#04120c] border-2 border-[#d4af37]/60 p-4 flex items-center justify-center shadow-[0_20px_50px_rgba(2,26,17,0.7),0_0_25px_rgba(197,155,39,0.25)]"
                style={{
                  transformStyle: "preserve-3d",
                  transform: "translateZ(30px)",
                }}
              >
                {/* 3D Specular Sheen highlight reflection */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-white/20 via-transparent to-transparent pointer-events-none" />

                {/* Inner Bevel Border */}
                <div className="absolute inset-1 rounded-xl border border-[#c59b27]/30 pointer-events-none" />

                {/* Institutional Logo with pop-out 3D layer */}
                <img
                  src="/logo.png"
                  alt="Darse Burhani"
                  className="w-full h-full object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)]"
                  style={{ transform: "translateZ(20px)" }}
                  onError={(e) => {
                    const target = e.target as HTMLElement;
                    target.style.display = "none";
                  }}
                />
              </motion.div>

              {/* 3D Depth Shadow on Floor */}
              <motion.div
                animate={{
                  scale: [0.85, 1.15, 0.85],
                  opacity: [0.35, 0.65, 0.35],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute -bottom-5 w-24 h-4 rounded-full bg-black/60 blur-md pointer-events-none"
              />
            </div>

            {/* ── Title & Institutional Heritage ── */}
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="space-y-1"
            >
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#fbf8f2] drop-shadow-sm">
                Darse Burhani <span className="text-[#d4af37] font-semibold text-lg sm:text-xl">(Nisab)</span>
              </h1>
              <div className="flex items-center justify-center gap-2">
                <span className="w-6 h-[1px] bg-[#d4af37]/40" />
                <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#c59b27]">
                  Mahad al Zahra
                </p>
                <span className="w-6 h-[1px] bg-[#d4af37]/40" />
              </div>
            </motion.div>

            {/* Target Portal & User Greeting */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="mt-4"
            >
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#0c2a1e] border border-[#1e4836] text-xs font-semibold text-[#e2dec9] shadow-inner">
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37] animate-pulse" />
                <span>Entering {portalName}</span>
                {userName && <span className="text-[#d4af37]">&bull; {userName}</span>}
              </div>
            </motion.div>

            {/* ── 3D Layered Progress Bar ── */}
            <div className="mt-6 w-56 space-y-2">
              <div className="relative h-2 w-full rounded-full bg-[#061e14] border border-[#1b4330] p-0.5 shadow-inner overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-[#9a781c] via-[#e5b945] to-[#fde047] shadow-[0_0_12px_rgba(229,185,69,0.7)] relative"
                  style={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut" }}
                >
                  {/* Moving Light Shimmer inside progress bar */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                </motion.div>
              </div>

              {/* Stage Text & Percentage */}
              <div className="flex items-center justify-between text-[11px] font-medium text-[#9a9180] px-0.5">
                <span className="truncate pr-2">{stageText}</span>
                <span className="font-mono text-[#d4af37] font-bold shrink-0">{progress}%</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
