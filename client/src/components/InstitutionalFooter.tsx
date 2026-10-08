"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Mail,
  HelpCircle,
  ExternalLink,
  Lock,
  Sparkles,
  Heart,
  Globe,
  Clock,
} from "lucide-react";
import { FatimiLogo } from "@/components/FatimiLogo";

interface InstitutionalFooterProps {
  variant?: "portal" | "login" | "minimal";
  className?: string;
}

export function InstitutionalFooter({
  variant = "portal",
  className = "",
}: InstitutionalFooterProps) {
  const currentYear = new Date().getFullYear();

  if (variant === "minimal") {
    return (
      <footer className={`mt-auto border-t border-slate-200/80 bg-white/60 backdrop-blur-md py-4 px-4 text-center text-xs text-slate-500 ${className}`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 font-medium">
            <span>© {currentYear} Darse Burhani. All rights reserved.</span>
            <span className="hidden sm:inline text-slate-300">·</span>
            <span className="text-emerald-800 font-semibold">Al-Jamea tus-Saifiyah</span>
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/privacy" className="hover:text-emerald-800 transition-colors font-medium">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-emerald-800 transition-colors font-medium">Terms of Service</Link>
            <a href="mailto:info.tahfeezDBG@gmail.com" className="hover:text-emerald-800 transition-colors font-medium flex items-center gap-1">
              <Mail className="w-3 h-3 text-emerald-700" /> Support
            </a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`mt-auto border-t border-slate-200/90 bg-slate-950 text-white relative overflow-hidden ${className}`}>
      {/* Subtle top gold accent line */}
      <div className="h-[2px] w-full bg-gradient-to-r from-emerald-800 via-amber-400 to-emerald-800" />

      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-emerald-500/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-amber-400/20 blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-white/10">
          {/* Column 1: Institution & Heritage */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-gradient-to-br from-amber-400 to-emerald-800 p-1 shadow-md ring-1 ring-amber-400/40 shrink-0">
                <FatimiLogo size={24} variant="gold" glow={true} />
              </div>
              <div>
                <h3 className="font-display font-bold text-lg text-white tracking-tight leading-none">
                  Darse Burhani
                </h3>
                <p className="text-xs font-semibold text-amber-300/80 uppercase tracking-wider mt-1">
                  Al-Jamea tus-Saifiyah · Nisab al Mahad al Zahra
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-md">
              Unified institutional governance, biometric attendance synchronization, Quranic Hifz tracking, and academic management system.
            </p>

            <div className="flex items-center gap-3 text-xs pt-1 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 font-semibold text-[11px]">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                256-bit Encrypted
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/80 text-amber-300 border border-amber-500/30 font-semibold text-[11px]">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Hikvision Hardware Push
              </span>
            </div>
          </div>

          {/* Column 2: Institutional & Legal Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300/90 font-display">
              Institutional Governance
            </h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li>
                <Link href="/privacy" className="hover:text-amber-300 transition-colors flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-amber-300 transition-colors flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/fatimi-calendar" className="hover:text-amber-300 transition-colors flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  Fatimi Academic Calendar
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Help Desk & Support */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300/90 font-display">
              Helpdesk & Support
            </h4>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex items-start gap-2">
                <Mail className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-400 text-[11px]">Technical Support</p>
                  <a
                    href="mailto:info.tahfeezDBG@gmail.com"
                    className="text-white hover:text-amber-300 font-mono transition-colors break-all"
                  >
                    info.tahfeezDBG@gmail.com
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <HelpCircle className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-slate-400 text-[11px]">Administration Desk</p>
                  <p className="text-white font-medium">Mon – Sat · 07:00 – 16:00 IST</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <p className="text-center sm:text-left">
            © {currentYear} <strong className="text-slate-200">Darse Burhani</strong>. All rights reserved.
          </p>
          <p className="text-center sm:text-right text-[11px] text-slate-500">
            Secure Biometric & Academic Management System
          </p>
        </div>
      </div>
    </footer>
  );
}
