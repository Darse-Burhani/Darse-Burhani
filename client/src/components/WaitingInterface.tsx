"use client";

import { useState, useEffect } from "react";

interface WaitingInterfaceProps {
  message?: string;
  subMessage?: string;
  variant?: "fullscreen" | "inline" | "card";
  className?: string;
}

const DEFAULT_MESSAGES = [
  "Synchronizing academic records...",
  "Retrieving Hifz and attendance details...",
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
        <div className="w-5 h-5 rounded-full border-2 border-[#c59b27] border-t-transparent animate-spin shrink-0" />
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
        className={`rounded-xl border border-slate-200 dark:border-[#234937] bg-white dark:bg-[#0c1f17] p-8 text-center flex flex-col items-center justify-center ${className}`}
      >
        <div className="w-12 h-12 rounded-xl bg-[#122b20] border border-[#234937] p-2 flex items-center justify-center mb-4">
          <img src="/logo.png" alt="Loading" className="w-8 h-8 object-contain" />
        </div>
        <h4 className="text-sm font-bold text-slate-800 dark:text-[#fbf8f2]">{activeMsg}</h4>
        {subMessage && (
          <p className="mt-1 text-xs text-slate-500 dark:text-[#a49a86]">{subMessage}</p>
        )}
        <div className="mt-4 w-6 h-6 rounded-full border-2 border-[#c59b27] border-t-transparent animate-spin" />
      </div>
    );
  }

  // Fullscreen institutional waiting screen
  return (
    <div
      className={`min-h-[70vh] flex flex-col items-center justify-center px-4 py-12 select-none ${className}`}
    >
      <div className="flex flex-col items-center text-center max-w-sm">
        <div className="w-16 h-16 rounded-xl bg-[#122b20] border border-[#234937] p-2.5 flex items-center justify-center mb-5">
          <img
            src="/logo.png"
            alt="Darse Burhani"
            className="w-full h-full object-contain"
          />
        </div>

        <h3 className="font-serif text-lg font-bold text-slate-800 dark:text-[#fbf8f2]">
          {activeMsg}
        </h3>
        <p className="mt-1 text-xs font-medium text-[#8c6f1d] dark:text-[#c59b27]">
          {subMessage || "Mahad al Zahra · Darse Burhani"}
        </p>

        <div className="mt-6 w-5 h-5 rounded-full border-2 border-[#c59b27] border-t-transparent animate-spin" />
      </div>
    </div>
  );
}
