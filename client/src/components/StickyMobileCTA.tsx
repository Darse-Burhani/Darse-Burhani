"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogIn, ArrowUp, Calendar, ShieldCheck } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

interface StickyMobileCTAProps {
  onActionClick?: () => void;
  targetElementId?: string;
  label?: string;
}

export function StickyMobileCTA({
  onActionClick,
  targetElementId = "login-form-card",
  label = "Sign In to Portal",
}: StickyMobileCTAProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // If user is at very top or scrolled slightly, keep visible
      if (currentScrollY > 100) {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const handleTrigger = () => {
    trackEvent("sticky_mobile_cta_clicked", { label });
    if (onActionClick) {
      onActionClick();
      return;
    }
    const target = document.getElementById(targetElementId);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-4 inset-x-3 z-40 sm:hidden pointer-events-none"
        >
          <div className="rounded-2xl p-0.5 bg-gradient-to-r from-emerald-500/60 via-[#d4af37]/70 to-emerald-500/60 shadow-[0_12px_36px_rgba(0,0,0,0.7)] backdrop-blur-xl pointer-events-auto">
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-[0.95rem] bg-[#021f17]/95 backdrop-blur-xl border border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                  <ShieldCheck className="w-4 h-4 text-[#d4af37]" />
                </div>
                <div className="leading-tight">
                  <span className="text-xs font-bold text-white block">Darse Burhani</span>
                  <span className="text-[10px] text-emerald-200/70 block">Instant Portal Access</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleTrigger}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#047857] to-[#059669] hover:from-[#059669] hover:to-[#10b981] active:scale-95 text-xs font-bold text-white shadow-md transition-transform"
              >
                <LogIn className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>{label}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
