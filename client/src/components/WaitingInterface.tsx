"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WaitingInterfaceProps {
  message?: string;
  subMessage?: string;
  variant?: "fullscreen" | "inline" | "card";
  className?: string;
}

const DEFAULT_MESSAGES = [
  "Synchronizing Academic Records…",
  "Retrieving Hifz & Marhala Milestones…",
  "Validating Biometric Telemetry…",
  "Connecting to Mahad al Zahra System…",
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
    }, 2400);
    return () => clearInterval(interval);
  }, [message]);

  const activeMsg = message || DEFAULT_MESSAGES[msgIndex];

  if (variant === "inline") {
    return (
      <div className={`flex items-center justify-center gap-3 py-6 px-4 ${className}`}>
        <div className="relative w-8 h-8 shrink-0 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-amber-400 animate-[spin_4s_linear_infinite]" />
          <img src="/logo.png" alt="Loading" className="w-5 h-5 object-contain" />
        </div>
        <div className="text-left">
          <p className="text-[13px] font-bold text-slate-800 dark:text-emerald-200">{activeMsg}</p>
          {subMessage && <p className="text-[11px] text-slate-400 dark:text-emerald-400/60">{subMessage}</p>}
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        className={`relative overflow-hidden rounded-3xl border border-emerald-900/15 dark:border-white/10 p-8 text-center flex flex-col items-center justify-center ${className}`}
        style={{
          background: "linear-gradient(145deg, rgba(2,44,34,0.03) 0%, rgba(6,78,59,0.06) 100%)",
        }}
      >
        <div className="relative flex items-center justify-center mb-4">
          <div className="absolute -inset-2 rounded-full border border-dashed border-amber-400/40 animate-[spin_8s_linear_infinite]" />
          <div className="w-14 h-14 rounded-2xl bg-emerald-900/90 p-2 shadow-md flex items-center justify-center ring-1 ring-amber-400/40">
            <img src="/logo.png" alt="Loading" className="w-10 h-10 object-contain drop-shadow" />
          </div>
        </div>
        <h4 className="text-[14px] font-extrabold text-slate-800 dark:text-emerald-100">{activeMsg}</h4>
        {subMessage ? (
          <p className="mt-1 text-[12px] text-slate-500 dark:text-emerald-300/70">{subMessage}</p>
        ) : (
          <div className="mt-3 flex items-center gap-1.5">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ scale: [0.8, 1.25, 0.8], opacity: [0.4, 1, 0.4] }}
                transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }}
                className="w-1.5 h-1.5 rounded-full bg-amber-500"
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Fullscreen institutional waiting screen
  return (
    <div
      className={`min-h-[70vh] flex flex-col items-center justify-center px-4 py-12 select-none relative ${className}`}
    >
      {/* Ambient background aura */}
      <div
        className="absolute w-72 h-72 rounded-full blur-[80px] opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(circle, #d4af37 0%, #059669 100%)" }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
        {/* Sacred Concentric Halo */}
        <div className="relative flex items-center justify-center mb-6">
          {/* Outer Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 12, ease: "linear" }}
            className="absolute -inset-4 rounded-full border border-dashed border-amber-400/40"
          />

          {/* Inner Counter-Ring */}
          <motion.div
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 18, ease: "linear" }}
            className="absolute -inset-2 rounded-full border border-emerald-500/30"
          />

          {/* Glowing Aura */}
          <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-lg animate-pulse" />

          {/* Center Emblem */}
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
            className="relative z-10 w-20 h-20 rounded-2xl p-2.5 flex items-center justify-center shadow-xl ring-1 ring-amber-400/50"
            style={{
              background: "linear-gradient(135deg, #022c22 0%, #064e3b 100%)",
            }}
          >
            <img
              src="/logo.png"
              alt="Darse Burhani"
              width={64}
              height={64}
              className="w-full h-full object-contain drop-shadow-[0_2px_10px_rgba(212,175,55,0.5)]"
            />
          </motion.div>
        </div>

        {/* Dynamic Status Text */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMsg}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="space-y-1"
          >
            <h3 className="text-base font-extrabold text-slate-800 dark:text-emerald-100">
              {activeMsg}
            </h3>
            <p className="text-[11.5px] font-semibold tracking-wider uppercase text-amber-600 dark:text-amber-400/80">
              {subMessage || "Mahad al Zahra · Nisab"}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Triple Micro-Pulses */}
        <div className="mt-5 flex items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [0.75, 1.3, 0.75], opacity: [0.35, 1, 0.35] }}
              transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.18 }}
              className="w-2 h-2 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 shadow-sm"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
