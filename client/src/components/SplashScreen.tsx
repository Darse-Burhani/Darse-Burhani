"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  minDurationMs?: number;
  onFinish?: () => void;
}

export function SplashScreen({ minDurationMs = 700, onFinish }: SplashScreenProps) {
  const [visible, setVisible] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Smooth high-speed progress meter
    const start = performance.now();
    const interval = setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / minDurationMs) * 100));
      setProgress(pct);

      if (elapsed >= minDurationMs) {
        clearInterval(interval);
        setTimeout(() => {
          setVisible(false);
          if (onFinish) onFinish();
        }, 120);
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
          exit={{ opacity: 0, scale: 1.03, filter: "blur(4px)" }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none overflow-hidden"
          style={{
            background: "radial-gradient(circle at center, #022c22 0%, #011a14 65%, #01120e 100%)",
          }}
        >
          {/* Subtle Ambient Background Sacred Glow */}
          <div
            className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[90px] opacity-25 pointer-events-none"
            style={{ background: "radial-gradient(circle, #d4af37 0%, #059669 100%)" }}
          />
          <div
            className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full blur-[90px] opacity-25 pointer-events-none"
            style={{ background: "radial-gradient(circle, #10b981 0%, #d4af37 100%)" }}
          />

          <div className="relative z-10 flex flex-col items-center">
            {/* Concentric Rotating Sacred Halo with logo.png */}
            <div className="relative flex items-center justify-center">
              {/* Outer Counter-Rotating Ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 16, ease: "linear" }}
                className="absolute -inset-4 rounded-full border border-dashed border-amber-400/30"
              />

              {/* Inner Rotating Ring */}
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ repeat: Infinity, duration: 22, ease: "linear" }}
                className="absolute -inset-2 rounded-full border border-emerald-400/25"
              />

              {/* Breathing Glow Halo */}
              <motion.div
                animate={{ scale: [1, 1.15, 1], opacity: [0.35, 0.65, 0.35] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-amber-400/20 blur-xl"
              />

              {/* Central Shield Container */}
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.45, ease: "easeOut" }}
                className="relative z-10 w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-3 flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.35)] ring-1 ring-amber-400/50"
                style={{
                  background: "linear-gradient(135deg, rgba(6,78,59,0.95) 0%, rgba(2,44,34,0.98) 100%)",
                }}
              >
                <img
                  src="/logo.png"
                  alt="Darse Burhani Emblem"
                  width={96}
                  height={96}
                  className="w-full h-full object-contain drop-shadow-[0_4px_16px_rgba(212,175,55,0.5)]"
                />
              </motion.div>
            </div>

            {/* Typography */}
            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="mt-6 text-center"
            >
              <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-1.5">
                <span className="bg-gradient-to-r from-white via-amber-200 to-amber-400 bg-clip-text text-transparent">
                  Darse Burhani
                </span>
                <span className="text-amber-400 text-lg sm:text-xl font-bold">(Nisab)</span>
              </h1>
              <p className="mt-1 text-[11.5px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-300/80">
                Mahad al Zahra
              </p>
            </motion.div>

            {/* Micro Progress Bar */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-8 flex flex-col items-center gap-2"
            >
              <div className="w-40 sm:w-48 h-1.5 rounded-full bg-white/10 overflow-hidden relative p-[1px]">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-yellow-200 to-emerald-400 shadow-[0_0_12px_rgba(212,175,55,0.8)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] font-mono font-medium tracking-wider text-emerald-200/60">
                Initializing Academic Telemetry {progress}%
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
