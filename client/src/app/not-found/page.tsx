"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Home,
  Shield,
  GraduationCap,
  BookOpen,
  Users,
  Sparkles,
} from "lucide-react";
import { FatimiLogo } from "@/components/FatimiLogo";
import { FatimiCornerBracket } from "@/components/FatimiOrnaments";
import { SEO } from "@/components/SEO";


export default function NotFoundPage() {
  return (
    <>
      <SEO
        title="404 — Page Not Found"
        description="The requested page or academic resource does not exist on Darse Burhani portal."
        noIndex={true}
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

              {/* Emblem */}
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#d4af37] via-[#f59e0b] to-[#b8860b] shadow-[0_10px_25px_-5px_rgba(212,175,55,0.5)] border border-amber-300/60 mx-auto mb-4">
                <FatimiLogo size={38} variant="gold" />
              </div>

              {/* Error Code */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-xs font-black uppercase tracking-wider text-amber-300 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
                Error 404 · Destination Uncharted
              </div>

              <h1 className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight leading-tight mb-2">
                Resource Missing
              </h1>

              <p className="text-sm text-emerald-100/80 max-w-sm mx-auto mb-6 leading-relaxed">
                The portal page or academic resource you requested does not exist or requires authenticated role clearance.
              </p>

              {/* Single Clear CTA */}
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl font-bold text-sm text-white shadow-lg transition-all active:scale-[0.98] mb-6"
                style={{
                  background: "linear-gradient(135deg, #022c22 0%, #047857 55%, #065f46 100%)",
                  boxShadow: "0 8px 24px -4px rgba(4, 120, 87, 0.45)",
                }}
              >
                <Home className="w-4 h-4 text-[#d4af37]" />
                <span>Return to Portal Hub</span>
              </Link>

              {/* Portal Quick Links */}
              <div className="pt-5 border-t border-white/10">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 block mb-2.5">
                  Quick Portal Navigation
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Link
                    href="/login?role=ADMIN"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-gray-200 hover:text-white transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>Admin</span>
                  </Link>
                  <Link
                    href="/login?role=TEACHER"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-gray-200 hover:text-white transition-colors"
                  >
                    <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Teacher</span>
                  </Link>
                  <Link
                    href="/login?role=STUDENT"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-gray-200 hover:text-white transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                    <span>Talabat</span>
                  </Link>
                  <Link
                    href="/login?role=PARENT"
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-black/40 hover:bg-black/60 border border-white/10 text-gray-200 hover:text-white transition-colors"
                  >
                    <Users className="w-3.5 h-3.5 text-rose-400" />
                    <span>Parent</span>
                  </Link>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </>
  );
}
