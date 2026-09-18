"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

import { motion } from "framer-motion";
import {
  CheckCircle2,
  Home,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  Copy,
  Check,
  FileCheck2,
} from "lucide-react";

import { FatimiCornerBracket } from "@/components/FatimiOrnaments";
import { SEO } from "@/components/SEO";
import { trackEvent } from "@/lib/analytics";

export default function ThankYouPage() {
  const [copied, setCopied] = useState(false);
  const [refId, setRefId] = useState("DB-849204");

  useEffect(() => {
    // Generate a realistic institutional reference ticket
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const id = `DB-${randomHex}`;
    setRefId(id);
    trackEvent("thank_you_viewed", { referenceId: id });
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(refId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <SEO
        title="Submission Confirmed — Thank You"
        description="Your academic request, attendance inquiry, or form submission has been securely processed by Darse Burhani."
      />

      <main className="min-h-[100dvh] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#01140f] text-gray-100 relative overflow-hidden select-none">
        {/* Ambient background glows */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full blur-[140px] bg-gradient-to-b from-[#047857]/30 via-[#022c22]/40 to-transparent" />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full blur-[120px] bg-[#d4af37]/20" />
        </div>

        <div className="relative z-10 w-full max-w-lg mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-3xl p-1 bg-gradient-to-b from-white/30 via-[#d4af37]/45 to-white/10 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] backdrop-blur-2xl border border-white/20"
          >
            <div className="relative rounded-[1.4rem] overflow-hidden bg-[#032018]/95 backdrop-blur-2xl p-6 sm:p-10 shadow-2xl border border-white/10 text-center">
              {/* Corner Decorative Ornaments */}
              <div className="absolute top-3.5 left-3.5 pointer-events-none">
                <FatimiCornerBracket size={24} stroke="#d4af37" opacity={0.8} />
              </div>
              <div className="absolute top-3.5 right-3.5 pointer-events-none">
                <FatimiCornerBracket size={24} stroke="#d4af37" opacity={0.8} flipH />
              </div>
              <div className="absolute bottom-3.5 left-3.5 pointer-events-none">
                <FatimiCornerBracket size={24} stroke="#d4af37" opacity={0.8} flipV />
              </div>
              <div className="absolute bottom-3.5 right-3.5 pointer-events-none">
                <FatimiCornerBracket size={24} stroke="#d4af37" opacity={0.8} flipH flipV />
              </div>

              {/* Animated Success Badge */}
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.15 }}
                className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-emerald-400 via-emerald-600 to-teal-800 shadow-[0_10px_25px_-5px_rgba(16,185,129,0.5)] border border-emerald-300/60 mx-auto mb-4"
              >
                <CheckCircle2 className="w-9 h-9 text-white drop-shadow-md" />
              </motion.div>

              {/* Pill Header */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/15 border border-emerald-400/30 text-xs font-black uppercase tracking-wider text-emerald-300 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                Transmission Confirmed
              </div>

              <h1 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight leading-tight mb-2">
                Shukran! Submission Received
              </h1>

              <p className="text-sm text-emerald-100/80 max-w-sm mx-auto mb-6 leading-relaxed">
                Your records have been securely registered with Aljamea-tus-Saifiyah's central academic telemetry system.
              </p>

              {/* Reference ID Card */}
              <div className="rounded-xl bg-black/40 border border-white/10 p-3.5 mb-6 text-left flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#d4af37]/20 border border-[#d4af37]/30 flex items-center justify-center text-[#d4af37]">
                    <FileCheck2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                      Reference Tracking ID
                    </span>
                    <span className="text-sm font-mono font-bold text-white tracking-wider">
                      {refId}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-semibold text-gray-200 hover:text-white transition-colors flex items-center gap-1.5"
                  title="Copy Reference ID"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-300 text-[11px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-[#d4af37]" />
                      <span className="text-[11px]">Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* CTA Action Buttons */}
              <div className="space-y-2.5 mb-6">
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white shadow-lg transition-all active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg, #022c22 0%, #047857 55%, #065f46 100%)",
                    boxShadow: "0 8px 24px -4px rgba(4, 120, 87, 0.45)",
                  }}
                >
                  <Home className="w-4 h-4 text-[#d4af37]" />
                  <span>Return to Portal Hub</span>
                  <ArrowRight className="w-4 h-4 ml-auto text-emerald-300" />
                </Link>

                <Link
                  href="/fatimi-calendar"
                  className="inline-flex items-center justify-center gap-2 w-full py-3 px-6 rounded-xl font-bold text-xs text-gray-200 bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5 text-[#d4af37]" />
                  <span>View Fatimi Academic Calendar</span>
                </Link>
              </div>

              {/* Institutional Notice */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-center gap-2 text-[11px] text-gray-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Protected by Aljamea-tus-Saifiyah Institutional Telemetry</span>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}
