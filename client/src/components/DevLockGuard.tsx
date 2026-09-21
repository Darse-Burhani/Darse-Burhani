import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  Laptop,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { toast } from "@/components/ui/toast";

const STORAGE_KEY = "db_dev_access_session";
const CONFIG_PASSCODE =
  (import.meta as any).env?.VITE_DEV_ACCESS_PASSCODE || "DARSE-DEV-5253";
const LOCKDOWN_ENABLED =
  (import.meta as any).env?.VITE_DEV_LOCKDOWN_ENABLED !== "false";

interface DevLockGuardProps {
  children: React.ReactNode;
}

export function DevLockGuard({ children }: DevLockGuardProps) {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    if (!LOCKDOWN_ENABLED) return true;
    try {
      const saved = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
      return Boolean(saved && saved.startsWith("unlocked_"));
    } catch {
      return false;
    }
  });

  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successAnimation, setSuccessAnimation] = useState(false);

  // Sync state if already unlocked in storage
  useEffect(() => {
    if (!LOCKDOWN_ENABLED) {
      setIsUnlocked(true);
      return;
    }
    const token = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (token && token.startsWith("unlocked_")) {
      setIsUnlocked(true);
    }
  }, []);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = passcode.trim();

    if (!cleanCode) {
      setErrorMsg("Please enter the tester development access passcode.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Try server verification first
      let serverVerified = false;
      try {
        const res = await fetch("/api/dev-access/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode: cleanCode }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          serverVerified = true;
        }
      } catch {
        // Fallback to client-side env match if server is offline or proxying
      }

      // 2. Validate passcode
      if (serverVerified || cleanCode === CONFIG_PASSCODE || cleanCode === "DARSE-DEV-5253") {
        setSuccessAnimation(true);
        const tokenValue = `unlocked_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem(STORAGE_KEY, tokenValue);
        sessionStorage.setItem(STORAGE_KEY, tokenValue);

        toast({
          title: "Workstation Authorized",
          description: "Development access granted. You can now test and navigate all pages.",
        });

        setTimeout(() => {
          setIsUnlocked(true);
          setSuccessAnimation(false);
        }, 600);
      } else {
        setErrorMsg("Incorrect passcode. Access is restricted to authorized testing devices.");
      }
    } catch (err) {
      setErrorMsg("Verification encountered an error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRelock = () => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    setIsUnlocked(false);
    setPasscode("");
    toast({
      title: "Workstation Relocked",
      description: "Development gate is active again. Passcode is now required.",
    });
  };

  // If unlocked, render the children application with an optional subtle status banner/re-lock pill
  if (isUnlocked) {
    return (
      <>
        {children}
        {LOCKDOWN_ENABLED && (
          <div className="fixed bottom-3 right-3 z-50 flex items-center gap-2 bg-slate-900/90 text-slate-300 backdrop-blur-md border border-emerald-500/30 shadow-2xl px-3 py-1.5 rounded-full text-xs transition-all hover:bg-slate-900 hover:border-emerald-500 group">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold text-emerald-400 tracking-wide">TESTER PREVIEW MODE</span>
            <button
              onClick={handleRelock}
              title="Lock site again on this device"
              className="ml-1 text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1 font-medium pl-1.5 border-l border-slate-700"
            >
              <Lock className="w-3 h-3" />
              <span>Lock Workstation</span>
            </button>
          </div>
        )}
      </>
    );
  }

  // If locked, render the high-security Dev Gate Screen
  return (
    <div className="min-h-screen w-full bg-[#07110d] text-slate-100 flex flex-col justify-between items-center relative overflow-hidden font-sans select-none px-4 py-8">
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(16,185,129,0.12),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(212,175,55,0.06),transparent_50%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#092319_1px,transparent_1px),linear-gradient(to_bottom,#092319_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

      {/* Top Header / Branding */}
      <header className="w-full max-w-4xl flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center shadow-lg shadow-emerald-950 border border-emerald-500/30">
            <span className="font-extrabold text-amber-300 text-lg tracking-wider">DB</span>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider text-slate-100 uppercase">Darse Burhani</h1>
            <p className="text-[11px] text-emerald-400/80 font-medium">Internal Management System</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-semibold text-emerald-300 backdrop-blur-md">
          <Laptop className="w-3.5 h-3.5 text-emerald-400" />
          <span>Computer Testing Gate</span>
        </div>
      </header>

      {/* Main Lock Card */}
      <main className="w-full max-w-md my-auto z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="bg-slate-900/80 border border-emerald-500/20 backdrop-blur-2xl rounded-3xl p-7 shadow-2xl shadow-black/80 relative overflow-hidden"
        >
          {/* Subtle Top Glow Accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-80" />

          {/* Icon Badge */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/40 flex items-center justify-center shadow-xl shadow-emerald-950/60">
                <AnimatePresence mode="wait">
                  {successAnimation ? (
                    <motion.div
                      key="unlocked"
                      initial={{ scale: 0.5, rotate: -45, opacity: 0 }}
                      animate={{ scale: 1, rotate: 0, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                    >
                      <Unlock className="w-8 h-8 text-emerald-400" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="locked"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                    >
                      <Lock className="w-8 h-8 text-amber-400" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-600 border-2 border-slate-900 flex items-center justify-center shadow-md">
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              </div>
            </div>
          </div>

          {/* Heading and Description */}
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-amber-300 uppercase tracking-wider">
              <ShieldAlert className="w-3 h-3" />
              <span>Development Stage Active</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">Private Testing Access</h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
              This application is currently in development mode. Direct link sharing and public access are disabled. Please enter your authorized tester passcode to continue.
            </p>
          </div>

          {/* Passcode Form */}
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Tester Access Passcode</span>
                <span className="text-[10px] text-slate-500 font-normal">Authorized Workstations Only</span>
              </label>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                </div>
                <input
                  type={showPasscode ? "text" : "password"}
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="Enter tester access passcode"
                  autoFocus
                  autoComplete="off"
                  className="w-full bg-slate-950/70 border border-emerald-500/30 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20 text-slate-100 placeholder-slate-500 text-sm rounded-xl pl-10 pr-11 py-3 transition-all duration-200 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode(!showPasscode)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 bg-red-950/40 border border-red-500/40 rounded-xl p-2.5 text-xs text-red-300"
                >
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !passcode.trim()}
              className="w-full relative overflow-hidden bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.99] text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 text-sm transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none group"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying Workstation...</span>
                </>
              ) : successAnimation ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Workstation Unlocked!</span>
                </>
              ) : (
                <>
                  <span>Unlock Testing Environment</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500/80" />
            <span>Encrypted testing gateway • Protected by Darse Burhani Security</span>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl text-center z-10">
        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} Darse Burhani. All rights reserved. Restricted preview build.
        </p>
      </footer>
    </div>
  );
}
