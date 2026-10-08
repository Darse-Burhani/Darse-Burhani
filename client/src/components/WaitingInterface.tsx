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
        <div
          className="relative w-9 h-9 shrink-0 flex items-center justify-center rounded-xl p-1 shadow-sm ring-1 ring-amber-400/40"
          style={{
            background: "radial-gradient(circle at 35% 30%, #065f46 0%, #022c22 80%)",
          }}
        >
          <div className="absolute -inset-1 rounded-xl border border-dashed border-amber-400/60 animate-[spin_6s_linear_infinite]" />
          <img src="/logo.png" alt="Loading" className="w-6 h-6 object-contain filter brightness-110 drop-shadow" />
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
          background: "linear-gradient(145deg, rgba(2,44,34,0.04) 0%, rgba(6,78,59,0.08) 100%)",
        }}
      >
        <div className="relative flex items-center justify-center mb-4">
          <div className="absolute -inset-2.5 rounded-full border border-dashed border-amber-400/40 animate-[spin_8s_linear_infinite]" />
          <div
            className="w-16 h-16 rounded-2xl p-2.5 shadow-lg flex items-center justify-center ring-1 ring-amber-400/40"
            style={{
              background: "radial-gradient(circle at 35% 30%, #065f46 0%, #022c22 75%, #01140e 100%)",
              boxShadow: "0 10px 25px rgba(0,0,0,0.3), inset 0 1px 2px rgba(254,240,138,0.5)",
            }}
          >
            <img src="/logo.png" alt="Loading" className="w-11 h-11 object-contain filter brightness-110 drop-shadow" />
          </div>
        </div>
        <h4 className="text-[14.5px] font-extrabold text-slate-800 dark:text-emerald-100">{activeMsg}</h4>
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

  // Fullscreen institutional waiting screen with 3D Depth
  return (
    <div
      className={`min-h-[70vh] flex flex-col items-center justify-center px-4 py-12 select-none relative ${className}`}
      style={{ perspective: "1000px" }}
    >
      {/* Ambient background aura */}
      <div
        className="absolute w-80 h-80 rounded-full blur-[90px] opacity-25 pointer-events-none"
        style={{ background: "radial-gradient(circle, #d4af37 0%, #059669 100%)" }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-sm" style={{ transformStyle: "preserve-3d" }}>
        {/* 3D Sacred Concentric Halo */}
        <div className="relative flex items-center justify-center mb-6" style={{ width: 140, height: 140, transformStyle: "preserve-3d" }}>
          {/* Primary 3D Orbital Ring */}
          <motion.div
            animate={{ rotateZ: 360 }}
            transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
            className="absolute w-36 h-36 rounded-full border-2 border-dashed border-amber-400/45 pointer-events-none"
            style={{
              transform: "rotateX(66deg) rotateY(-18deg)",
              boxShadow: "0 0 20px rgba(212,175,55,0.25)",
            }}
          />

          {/* Secondary 3D Counter-Ring */}
          <motion.div
            animate={{ rotateZ: -360 }}
            transition={{ repeat: Infinity, duration: 14, ease: "linear" }}
            className="absolute w-32 h-32 rounded-full border border-emerald-400/35 pointer-events-none"
            style={{
              transform: "rotateX(-62deg) rotateY(24deg)",
            }}
          />

          {/* Glowing Aura */}
          <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-xl animate-pulse" />

          {/* Center 3D Floating Emblem */}
          <motion.div
            animate={{ y: [-2, 2, -2] }}
            transition={{ repeat: Infinity, duration: 2.8, ease: "easeInOut" }}
            className="relative z-10 w-24 h-24 rounded-3xl p-3 flex items-center justify-center cursor-default"
            style={{
              transform: "translateZ(25px)",
              background: "radial-gradient(circle at 35% 30%, #065f46 0%, #022c22 65%, #01140e 100%)",
              border: "1.5px solid rgba(254,240,138,0.45)",
              boxShadow: "0 15px 35px -8px rgba(0,0,0,0.7), 0 0 25px rgba(212,175,55,0.4), inset 0 2px 3px rgba(254,240,138,0.6)",
            }}
          >
            <img
              src="/logo.png"
              alt="Darse Burhani"
              width={80}
              height={80}
              className="w-full h-full object-contain filter brightness-[1.08] drop-shadow-[0_4px_12px_rgba(212,175,55,0.6)]"
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
            <h3 className="text-base sm:text-lg font-extrabold text-slate-800 dark:text-emerald-100">
              {activeMsg}
            </h3>
            <p className="text-[11.5px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-300">
              {subMessage || "Mahad al Zahra · Nisab"}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Shimmering Micro Pulses */}
        <div className="mt-5 flex items-center gap-2">
          {[0, 1, 2, 3].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [0.75, 1.3, 0.75], opacity: [0.35, 1, 0.35] }}
              transition={{ repeat: Infinity, duration: 1.4, delay: i * 0.18 }}
              className="w-2 h-2 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-300 shadow-[0_0_6px_#fde047]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

