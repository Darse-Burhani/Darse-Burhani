"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cookie,
  ShieldCheck,
  Check,
  X,
  Sliders,
  Sparkles,
  Info,
  Lock,
} from "lucide-react";
import { initAnalytics, trackEvent } from "@/lib/analytics";

interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  savedAt: string;
}

const STORAGE_KEY = "db_cookie_consent_v1";

export function CookieConsentBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true, // Always true
    functional: true,
    analytics: false,
    savedAt: "",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        // Show after brief delay for smooth entrance
        const timer = setTimeout(() => setIsOpen(true), 1200);
        return () => clearTimeout(timer);
      } else {
        const parsed = JSON.parse(saved);
        setPreferences(parsed);
        if (parsed.analytics) {
          initAnalytics();
        }
      }
    } catch {
      setIsOpen(true);
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    const updated = { ...prefs, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setPreferences(updated);
    setIsOpen(false);
    setShowPreferences(false);

    if (updated.analytics) {
      initAnalytics();
    }
    trackEvent("cookie_consent_updated", {
      analytics: updated.analytics,
      functional: updated.functional,
    });
  };

  const handleAcceptAll = () => {
    savePreferences({
      essential: true,
      functional: true,
      analytics: true,
      savedAt: "",
    });
  };

  const handleRejectNonEssential = () => {
    savePreferences({
      essential: true,
      functional: false,
      analytics: false,
      savedAt: "",
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-x-0 bottom-0 z-50 p-4 sm:p-6 pointer-events-none flex justify-center">
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-2xl rounded-2xl p-1 bg-gradient-to-b from-white/30 via-[#d4af37]/45 to-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-2xl border border-white/20 pointer-events-auto select-none"
        >
          <div className="rounded-[1.2rem] bg-[#022018]/95 backdrop-blur-2xl p-5 sm:p-6 text-white border border-white/10">
            {/* Top 24K Gold Hairline */}
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-90 pointer-events-none" />

            {!showPreferences ? (
              // ── Main Compact View ──
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5 flex-1">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#d4af37] via-[#f59e0b] to-[#b8860b] text-white shadow-md shrink-0 mt-0.5">
                    <Cookie className="w-5 h-5 drop-shadow-sm" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-display font-bold text-sm text-white">
                        Institutional Privacy & Cookie Preferences
                      </h4>
                      <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
                        <Sparkles className="w-2.5 h-2.5 text-[#d4af37]" />
                        Essential
                      </span>
                    </div>
                    <p className="text-xs text-emerald-100/75 leading-relaxed">
                      We use necessary session cookies and security tokens to protect your portal credentials and ensure reliable attendance operations. Learn more in our{" "}
                      <Link href="/privacy" className="text-[#d4af37] hover:underline font-bold">
                        Privacy Policy
                      </Link>{" "}
                      and{" "}
                      <Link href="/terms" className="text-[#d4af37] hover:underline font-bold">
                        Terms
                      </Link>.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto shrink-0 w-full sm:w-auto justify-end pt-2 sm:pt-0">
                  <button
                    type="button"
                    onClick={() => setShowPreferences(true)}
                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-gray-200 transition-colors flex items-center gap-1.5"
                  >
                    <Sliders className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>Customize</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleRejectNonEssential}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-gray-200 transition-colors"
                  >
                    Essential Only
                  </button>
                  <button
                    type="button"
                    onClick={handleAcceptAll}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#047857] to-[#059669] hover:from-[#059669] hover:to-[#10b981] text-xs font-bold text-white shadow-md transition-all flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Accept All</span>
                  </button>
                </div>
              </div>
            ) : (
              // ── Expanded Preferences Modal View ──
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#d4af37]" />
                    <h4 className="font-display font-bold text-sm text-white">
                      Configure Cookie Preferences
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPreferences(false)}
                    className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close preferences"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  {/* Essential Cookies */}
                  <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/10">
                    <div className="flex items-start gap-2.5">
                      <Lock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">Strictly Necessary & Security</span>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            Required
                          </span>
                        </div>
                        <p className="text-gray-400 text-[11px] mt-0.5">
                          Enables NextAuth session credentials, CSRF tokens, portal route guards, and biometric lockout security.
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={true}
                      disabled={true}
                      className="w-4 h-4 rounded text-emerald-600 border-gray-600 bg-gray-800 cursor-not-allowed opacity-80"
                    />
                  </div>

                  {/* Functional Cookies */}
                  <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/10">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-[#d4af37] mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold text-white">Functional & UI State</span>
                        <p className="text-gray-400 text-[11px] mt-0.5">
                          Remembers table view modes, sidebar toggle positions, and theme preferences across visits.
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      id="cookie-functional"
                      checked={preferences.functional}
                      onChange={(e) =>
                        setPreferences((p) => ({ ...p, functional: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-[#047857] border-gray-600 bg-gray-800 focus:ring-[#047857] cursor-pointer"
                    />
                  </div>

                  {/* Analytics */}
                  <div className="flex items-start justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/10">
                    <div className="flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-teal-400 mt-0.5 shrink-0" />
                      <div>
                        <span className="font-bold text-white">Performance Telemetry</span>
                        <p className="text-gray-400 text-[11px] mt-0.5">
                          Anonymous speed metrics to detect latency and improve hardware terminal synchronization.
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      id="cookie-analytics"
                      checked={preferences.analytics}
                      onChange={(e) =>
                        setPreferences((p) => ({ ...p, analytics: e.target.checked }))
                      }
                      className="w-4 h-4 rounded text-[#047857] border-gray-600 bg-gray-800 focus:ring-[#047857] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowPreferences(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => savePreferences(preferences)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#047857] to-[#059669] hover:from-[#059669] hover:to-[#10b981] text-xs font-bold text-white shadow-md transition-all"
                  >
                    Save Preferences
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
