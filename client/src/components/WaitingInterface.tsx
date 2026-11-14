"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

interface WaitingInterfaceProps {
  message?: string;
  subMessage?: string;
  variant?: "fullscreen" | "inline" | "card";
  className?: string;
}

const DEFAULT_MESSAGES = [
  "Synchronizing academic records...",
  "Retrieving timetable and attendance details...",
  "Verifying session permissions...",
  "Loading Mahad al Zahra portal...",
];

export function WaitingInterface({
  message,
  subMessage,
  variant = "fullscreen",
  className = "",
}: WaitingInterfaceProps) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (message) return;
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % DEFAULT_MESSAGES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [message]);

  const activeMsg = message || DEFAULT_MESSAGES[msgIndex];

  if (variant === "inline") {
    return (
      <div className={`flex items-center justify-center gap-3 py-6 px-4 ${className}`}>
        <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
          <div className="w-5 h-5 rounded-full border-2 border-[#c59b27] border-t-transparent animate-spin" />
        </div>
        <div className="text-left">
          <p className="text-xs font-semibold text-slate-800 dark:text-[#f5f3ef]">{activeMsg}</p>
          {subMessage && <p className="text-[11px] text-slate-500 dark:text-[#a49a86]">{subMessage}</p>}
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={`rounded-2xl border border-slate-200/80 dark:border-[#2a2a2a] bg-white/90 dark:bg-[#0d0d0d]/90 backdrop-blur-md p-8 text-center flex flex-col items-center justify-center shadow-lg shadow-amber-950/5 ${className}`}
      >
        <div className="relative w-14 h-14 flex items-center justify-center mb-4">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full border-2 border-dashed border-amber-500/40"
          />
          <div className="w-11 h-11 rounded-xl bg-slate-900 border border-amber-400/60 p-2 flex items-center justify-center shadow-md">
            <img src="/logo.png" alt="Loading" className="w-full h-full object-contain" />
          </div>
        </div>
        <h4 className="text-sm font-bold text-slate-800 dark:text-[#fbf8f2]">{activeMsg}</h4>
        {subMessage && (
          <p className="mt-1 text-xs text-slate-500 dark:text-[#a49a86]">{subMessage}</p>
        )}
        <div className="mt-4 w-6 h-6 rounded-full border-2 border-[#c59b27] border-t-transparent animate-spin" />
      </div>
    );
  }

  // Fullscreen institutional waiting screen with 3D Motion Graphics
  return (
    <div
      className={`min-h-[72vh] flex flex-col items-center justify-center px-4 py-12 select-none relative overflow-hidden ${className}`}
      style={{ perspective: "1200px" }}
    >
      {/* Background ambient radiance */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      <div className="flex flex-col items-center text-center max-w-sm relative z-10">
        {/* 3D Levitating Emblem with Orbital Rings */}
        <div className="relative w-24 h-24 mb-6 flex items-center justify-center" style={{ transformStyle: "preserve-3d" }}>
          {/* Gyroscope Ring 1 */}
          <motion.div
            animate={{ rotateZ: [0, 360], rotateX: [65, 75, 65] }}
            transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
            className="absolute w-24 h-24 rounded-full border-2 border-dashed border-amber-500/40 pointer-events-none"
          />
          {/* Gyroscope Ring 2 */}
          <motion.div
            animate={{ rotateZ: [360, 0], rotateY: [60, 75, 60] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "linear" }}
            className="absolute w-20 h-20 rounded-full border border-emerald-500/40 pointer-events-none"
          />
          {/* Floating Emblem */}
          <motion.div
            animate={{ y: [-4, 4, -4], rotateY: [-8, 8, -8] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-16 h-16 rounded-2xl bg-slate-900/90 border-2 border-amber-400/80 p-3 flex items-center justify-center shadow-xl shadow-amber-950/20 backdrop-blur-md"
            style={{ transformStyle: "preserve-3d", transform: "translateZ(20px)" }}
          >
            <img
              src="/logo.png"
              alt="Darse Burhani"
              className="w-full h-full object-contain drop-shadow"
            />
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          <motion.h3
            key={activeMsg}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="font-serif text-lg font-bold text-slate-800 dark:text-[#fbf8f2] tracking-tight"
          >
            {activeMsg}
          </motion.h3>
        </AnimatePresence>

        <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#b45309] dark:text-[#c59b27] flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-amber-500 animate-spin" />
          {subMessage || "Mahad al Zahra · Darse Burhani"}
        </p>

        <div className="mt-6 flex items-center gap-1.5">
          <motion.span
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
            className="w-2 h-2 rounded-full bg-amber-500"
          />
          <motion.span
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
            className="w-2 h-2 rounded-full bg-emerald-500"
          />
          <motion.span
            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
            className="w-2 h-2 rounded-full bg-amber-400"
          />
        </div>
      </div>
    </div>
  );
}
