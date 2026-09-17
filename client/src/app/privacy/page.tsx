"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Lock,
  Eye,
  FileText,
  UserCheck,
  Database,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Mail,
  Scale,
  Cpu,
} from "lucide-react";
import { FatimiLogo } from "@/components/FatimiLogo";
import { FatimiCornerBracket } from "@/components/FatimiOrnaments";

export default function PrivacyPolicyPage() {
  const lastUpdated = "September 2026";

  return (
    <main className="min-h-screen bg-[#01140f] text-gray-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-x-hidden select-none">
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[140px] bg-[#047857]/20" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[160px] bg-[#d4af37]/15" />
      </div>

      <div className="max-w-4xl mx-auto relative z-10">
        {/* Navigation Back */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-bold text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-[#d4af37]" />
            <span>Return to Portal</span>
          </Link>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-400/30 text-[11px] font-bold text-emerald-300">
            <Sparkles className="w-3.5 h-3.5 text-[#d4af37]" />
            <span>Institutional Governance</span>
          </div>
        </div>

        {/* Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="rounded-3xl p-1 bg-gradient-to-b from-white/25 via-[#d4af37]/40 to-white/10 shadow-2xl backdrop-blur-2xl border border-white/15 mb-10"
        >
          <div className="rounded-[1.4rem] bg-[#032018]/90 backdrop-blur-2xl p-6 sm:p-10 relative overflow-hidden">
            <div className="absolute top-3.5 left-3.5 pointer-events-none">
              <FatimiCornerBracket size={24} stroke="#d4af37" opacity={0.8} />
            </div>
            <div className="absolute top-3.5 right-3.5 pointer-events-none">
              <FatimiCornerBracket size={24} stroke="#d4af37" opacity={0.8} flipH />
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-6">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-[#d4af37] via-[#f59e0b] to-[#b8860b] shadow-lg border border-amber-300/60 shrink-0">
                <FatimiLogo size={38} variant="gold" />
              </div>
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#d4af37]">
                  Aljamea-tus-Saifiyah
                </span>
                <h1 className="font-display font-black text-3xl sm:text-4xl text-white tracking-tight">
                  Privacy Policy & Data Protection
                </h1>
                <p className="text-xs text-emerald-100/90 mt-1">
                  Official Institutional Telemetry, Biometric Data & Learner Records Charter · Effective {lastUpdated}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-white/10 text-xs">
              <div className="flex items-center gap-2 text-gray-300">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>256-Bit SSL/TLS Encryption</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Lock className="w-4 h-4 text-[#d4af37] shrink-0" />
                <span>Strict Biometric Isolation</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <UserCheck className="w-4 h-4 text-teal-400 shrink-0" />
                <span>FERPA / GDPR-Aligned Safeguards</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-8 text-gray-300 text-sm leading-relaxed">
          {/* Section 1 */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-[#d4af37]" />
              1. Information We Collect
            </h2>
            <p>
              Darse Burhani operates as the unified academic, attendance, and behavioral administration platform for Aljamea-tus-Saifiyah. In order to administer academic courses, monitor attendance integrity, and deliver real-time student updates to families, we collect and process the following categories of data:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-gray-300 text-xs sm:text-sm">
              <li><strong className="text-white">Academic & Identity Records:</strong> Full legal name, ITS credentials, student ID numbers, enrolled class grade, course sections, and Quran Hifz milestone progress.</li>
              <li><strong className="text-white">Attendance Telemetry:</strong> Arrival timestamps, departure logs, classroom session presence, justified absence documentation, and automated tardiness calculations.</li>
              <li><strong className="text-white">Biometric Template Data:</strong> Cryptographically salted facial recognition vector templates and optical device scan logs. We store only irreversible mathematical vector hashes—raw biometric images are never exposed.</li>
              <li><strong className="text-white">Parent & Faculty Contact Details:</strong> Verified email addresses, notification preferences, emergency telephone contacts, and authenticated portal credentials.</li>
            </ul>
          </section>

          {/* Section 2 */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-400" />
              2. Biometric Security & Retention Protocol
            </h2>
            <p>
              Biometric verification (including facial recognition and terminal turnstile check-ins) is utilized strictly for verified student presence and institutional safety.
            </p>
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Irreversible Vector Hashing</span>
              </div>
              <p className="text-emerald-100/80">
                All facial scans are processed instantly at the edge hardware terminal. The resulting numerical descriptors are encrypted at rest using AES-256 and stored within a segmented security partition. Biometric data is retained solely for the duration of the student or faculty member&apos;s active enrollment.
              </p>
            </div>
          </section>

          {/* Section 3 */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#d4af37]" />
              3. Purpose of Processing & Data Sharing
            </h2>
            <p>
              Your data is processed exclusively for educational, safety, and administrative operations. <strong>We do not sell, license, or monetize any student, parent, or faculty personal information to third parties or commercial advertisers.</strong>
            </p>
            <p className="text-xs text-gray-400">
              Information is accessible strictly through role-based access control (RBAC): Administrators manage system configuration; Teachers access their assigned student rosters; Students view personal learning logs; Parents access their designated children&apos;s attendance telemetry and conduct merits.
            </p>
          </section>

          {/* Section 4 */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-teal-400" />
              4. Cookie Usage & Preferences
            </h2>
            <p>
              Darse Burhani uses essential session cookies and local storage tokens to maintain authenticated login sessions, CSRF protection, and UI theme preferences. Non-essential tracking cookies are disabled by default and subject to user consent via our integrated Cookie Banner.
            </p>
          </section>

          {/* Section 5 */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-amber-400" />
              5. Contact & Privacy Inquiries
            </h2>
            <p>
              For inquiries regarding data records, student profile rectification, or privacy governance, please contact the institutional administration office:
            </p>
            <div className="p-4 rounded-xl bg-black/40 border border-white/10 text-xs font-mono space-y-1">
              <p className="text-[#d4af37] font-bold">Aljamea-tus-Saifiyah IT & Academic Registry</p>
              <p className="text-gray-300">Email: privacy@darseburhani.edu / admin@darseburhani.edu</p>
              <p className="text-gray-400">Website: https://darseburhani.edu</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-4">
          <span>&copy; {new Date().getFullYear()} Darse Burhani · Aljamea-tus-Saifiyah. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-white transition-colors underline">
              Terms & Conditions
            </Link>
            <Link href="/login" className="hover:text-white transition-colors">
              Portal Access
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
