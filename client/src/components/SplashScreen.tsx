"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
  minDurationMs = 1200,
  onFinish,
  portalName = "Institutional Portal",
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
        }, 120);
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
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed inset-0 z-[999999] flex flex-col items-center justify-center select-none bg-[#0c1f17] text-[#f5f3ef]"
        >
          <div className="flex flex-col items-center max-w-sm px-6 text-center">
            {/* Emblem */}
            <div className="w-20 h-20 rounded-xl bg-[#122b20] border border-[#234937] p-3 flex items-center justify-center mb-4">
              <img
                src="/logo.png"
                alt="Darse Burhani"
                className="w-full h-full object-contain"
              />
            </div>

            <h1 className="font-serif text-2xl font-bold tracking-tight text-[#fbf8f2]">
              Darse Burhani <span className="text-[#c59b27] font-semibold text-lg">(Nisab)</span>
            </h1>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#a49a86]">
              Mahad al Zahra
            </p>

            <p className="mt-3 text-xs text-[#d2cec3] font-medium">
              Connecting to {portalName}
            </p>

            {/* Simple, honest progress bar */}
            <div className="mt-5 w-48 h-1.5 rounded-full bg-[#163628] overflow-hidden">
              <div
                className="h-full bg-[#c59b27] transition-all duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="mt-2 text-[11px] text-[#8e8574]">
              {stageText}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
