"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  minDurationMs?: number;
  onFinish?: () => void;
}

const TELEMETRY_STAGES = [
  "Initializing Academic Telemetry...",
  "Loading Hifz & Marhala Records...",
  "Calibrating Biometric Matrices...",
  "Authenticating Mahad al Zahra System...",
  "Academic Environment Ready",
];

export function SplashScreen({ minDurationMs = 850, onFinish }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState(TELEMETRY_STAGES[0]);

  useEffect(() => {
    const start = performance.now();
    const interval = setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / minDurationMs) * 100));
      setProgress(pct);

      const stageIdx = Math.min(
        TELEMETRY_STAGES.length - 1,
        Math.floor((pct / 100) * TELEMETRY_STAGES.length)
      );
      setStageText(TELEMETRY_STAGES[stageIdx]);

      if (elapsed >= minDurationMs) {
        clearInterval(interval);
        setTimeout(() => {
          setVisible(false);
          if (onFinish) onFinish();
        }, 140);
      }
    }, 16);

    return () => clearInterval(interval);
  }, [minDurationMs, onFinish]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="db-splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04, filter: "blur(6px)" }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none overflow-hidden"
          style={{
            background: "radial-gradient(circle at 50% 45%, #022c22 0%, #011d16 55%, #010f0c 100%)",
            perspective: "1200px",
          }}
        >
          {/* Volumetric Radial Ambient Lighting */}
          <div
            className="absolute w-[500px] h-[500px] rounded-full blur-[110px] opacity-30 pointer-events-none"
            style={{
              background: "radial-gradient(circle, #d4af37 0%, #059669 50%, transparent 75%)",
            }}
          />
          <div
            className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-[90px] opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle, #10b981 0%, transparent 70%)" }}
          />
          <div
            className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full blur-[90px] opacity-20 pointer-events-none"
            style={{ background: "radial-gradient(circle, #fbbf24 0%, transparent 70%)" }}
          />

          {/* 3D Floating Dust Particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={`spark-${i}`}
                initial={{
                  x: `${(i * 17) % 100}vw`,
                  y: "105vh",
                  opacity: 0,
                  scale: 0.6,
                }}
                animate={{
                  y: "-10vh",
                  opacity: [0, 0.75, 0],
                  scale: [0.6, 1.2, 0.8],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 4 + (i % 5) * 1.5,
                  delay: (i * 0.4) % 3,
                  ease: "linear",
                }}
                className="absolute w-1.5 h-1.5 rounded-full bg-gradient-to-tr from-amber-300 to-yellow-100 shadow-[0_0_8px_rgba(253,224,71,0.9)]"
              />
            ))}
          </div>

          {/* MAIN 3D ROTATIONAL STAGE */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, rotateX: 18, rotateY: -15 }}
            animate={{
              scale: 1,
              opacity: 1,
              rotateX: [12, -8, 6, 0],
              rotateY: [-15, 12, -6, 0],
            }}
            transition={{
              duration: 1.2,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="relative z-10 flex flex-col items-center"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* 3D Gyroscopic Orbital Halo & Medallion */}
            <div
              className="relative flex items-center justify-center"
              style={{ width: 220, height: 220, transformStyle: "preserve-3d" }}
            >
              {/* Primary 3D Inclined Orbital Ring */}
              <motion.div
                animate={{ rotateZ: 360 }}
                transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
                className="absolute w-52 h-52 rounded-full border-2 border-dashed border-amber-400/40 pointer-events-none"
                style={{
                  transform: "rotateX(68deg) rotateY(-18deg)",
                  boxShadow: "0 0 25px rgba(212,175,55,0.25), inset 0 0 20px rgba(212,175,55,0.15)",
                }}
              >
                {/* 3D Orbiting Gold Pearl Node 1 */}
                <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 shadow-[0_0_12px_rgba(253,224,71,1)]" />
                {/* Orbiting Gold Pearl Node 2 */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-emerald-300 to-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
              </motion.div>

              {/* Secondary 3D Counter-Inclined Orbital Ring */}
              <motion.div
                animate={{ rotateZ: -360 }}
                transition={{ repeat: Infinity, duration: 14, ease: "linear" }}
                className="absolute w-44 h-44 rounded-full border border-emerald-400/35 pointer-events-none"
                style={{
                  transform: "rotateX(-62deg) rotateY(24deg)",
                  boxShadow: "0 0 20px rgba(16,185,129,0.2)",
                }}
              >
                {/* Counter Node */}
                <div className="absolute top-1/2 -right-1.5 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(253,224,71,0.9)]" />
              </motion.div>

              {/* 3D Base Drop Shadow Plate */}
              <div
                className="absolute w-36 h-36 rounded-full bg-black/60 blur-xl pointer-events-none"
                style={{
                  transform: "translateZ(-30px) translateY(35px) scale(1.1)",
                }}
              />

              {/* 3D Concentric Floating Medallion Housing logo.png */}
              <motion.div
                animate={{
                  y: [-3, 3, -3],
                  rotateZ: [-0.5, 0.5, -0.5],
                }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="relative z-20 w-32 h-32 sm:w-36 sm:h-36 rounded-[2rem] p-3.5 flex items-center justify-center cursor-default"
                style={{
                  transformStyle: "preserve-3d",
                  transform: "translateZ(35px)",
                  background:
                    "radial-gradient(circle at 35% 30%, #065f46 0%, #022c22 60%, #01140e 100%)",
                  border: "2px solid rgba(254, 240, 138, 0.45)",
                  boxShadow:
                    "0 20px 50px -10px rgba(0,0,0,0.85), 0 0 35px rgba(212,175,55,0.45), inset 0 2px 4px rgba(254,240,138,0.7), inset 0 -3px 6px rgba(0,0,0,0.7)",
                }}
              >
                {/* Specular Inner Glaze */}
                <div
                  className="absolute inset-1.5 rounded-[1.6rem] pointer-events-none border border-amber-300/30"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.03) 40%, transparent 60%)",
                  }}
                />

                {/* 3D Breathing Glow Aura Behind Logo */}
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.65, 0.35] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                  className="absolute inset-2 rounded-2xl bg-amber-400/25 blur-md"
                />

                {/* THE OFFICIAL LOGO.PNG - High Definition with 3D Drop-Shadow */}
                <img
                  src="/logo.png"
                  alt="Darse Burhani Emblem"
                  width={128}
                  height={128}
                  className="relative z-10 w-full h-full object-contain filter brightness-[1.08] contrast-[1.05] drop-shadow-[0_6px_18px_rgba(212,175,55,0.65)]"
                />
              </motion.div>
            </div>

            {/* Typography with 3D Shimmer */}
            <motion.div
              initial={{ y: 14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.18, duration: 0.45 }}
              className="mt-6 text-center"
              style={{ transform: "translateZ(20px)" }}
            >
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-1.5">
                <span
                  className="bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, #ffffff 0%, #fef08a 40%, #d4af37 75%, #b45309 100%)",
                    textShadow: "0 4px 20px rgba(212,175,55,0.35)",
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
            </motion.div>

            {/* 3D Micro Telemetry Progress Bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.28 }}
              className="mt-7 flex flex-col items-center gap-2"
              style={{ transform: "translateZ(15px)" }}
            >
              <div className="w-48 sm:w-56 h-2 rounded-full bg-black/40 border border-emerald-500/20 overflow-hidden relative p-[1px] shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-200 to-emerald-400 shadow-[0_0_16px_rgba(212,175,55,0.9)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-[10.5px] font-mono font-medium tracking-wide text-emerald-200/70">
                <span className="truncate max-w-[200px]">{stageText}</span>
                <span className="text-amber-400 font-bold">{progress}%</span>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

