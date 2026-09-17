"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  ShieldCheck,
  AlertTriangle,
  Users,
  Key,
  BookOpen,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { FatimiLogo } from "@/components/FatimiLogo";
import { FatimiCornerBracket } from "@/components/FatimiOrnaments";

export default function TermsPage() {
  const lastUpdated = "September 2026";

  return (
    <main className="min-h-screen bg-[#01140f] text-gray-100 py-12 px-4 sm:px-6 lg:px-8 relative overflow-x-hidden select-none">
      {/* Ambient background glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full blur-[140px] bg-[#047857]/20" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[160px] bg-[#d4af37]/15" />
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
            <span>Institutional Agreement</span>
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
                  Terms & Conditions of Portal Access
                </h1>
                <p className="text-xs text-emerald-100/90 mt-1">
                  Academic Conduct, Acceptable Usage & System Security Agreement · Effective {lastUpdated}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 border-t border-white/10 text-xs">
              <div className="flex items-center gap-2 text-gray-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Authorized Users Only</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <Lock className="w-4 h-4 text-[#d4af37] shrink-0" />
                <span>Strict Role Isolation</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <BookOpen className="w-4 h-4 text-teal-400 shrink-0" />
                <span>Academic Honor Code</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-8 text-gray-300 text-sm leading-relaxed">
          {/* Section 1 */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#d4af37]" />
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the Darse Burhani platform (including the Admin Portal, Faculty Portal, Talabat Student Hub, and Parent Portal), you agree to comply with and be legally bound by these Terms and Conditions and all institutional rules established by Aljamea-tus-Saifiyah.
            </p>
            <p className="text-xs text-gray-400">
              If you do not agree with these Terms, you must immediately terminate your session and refrain from utilizing your account credentials.
            </p>
          </section>

          {/* Section 2 */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-emerald-400" />
              2. Account Security & Credential Integrity
            </h2>
            <ul className="list-disc list-inside space-y-2 pl-2 text-gray-300 text-xs sm:text-sm">
              <li><strong className="text-white">Confidentiality:</strong> You are solely responsible for maintaining the confidentiality of your login email, ITS number, and password. You may not share or delegate your credentials to any other individual.</li>
              <li><strong className="text-white">Strict Role Isolation:</strong> Users are granted access only to the portal designated for their authenticated role (Admin, Teacher, Student, Parent). Attempting to bypass role guards or access unauthorized endpoints constitutes a severe disciplinary violation.</li>
              <li><strong className="text-white">Session Security:</strong> Inactivity timeouts and lockout protocols are enforced for security. Any automated credential stuffing or brute-force attempts will result in automated account locking and IP quarantine.</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-[#d4af37]" />
              3. User Codes of Conduct by Portal
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
              <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-1.5">
                <h3 className="font-bold text-[#d4af37]">Faculty & Asateezah</h3>
                <p className="text-gray-300">
                  Must record accurate daily roll-call attendance, maintain objective marks grading, and adhere strictly to Takhteet syllabus timeline portions.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-1.5">
                <h3 className="font-bold text-purple-300">Talabat (Students)</h3>
                <p className="text-gray-300">
                  Must complete physical biometric scans punctually, submit genuine justifications for any unavoidable absences, and maintain academic integrity in Hifz and coursework.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-1.5">
                <h3 className="font-bold text-rose-300">Parents & Guardians</h3>
                <p className="text-gray-300">
                  Review real-time attendance telemetry responsibly, acknowledge school notifications promptly, and coordinate with faculty regarding student progress.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-black/30 border border-white/10 space-y-1.5">
                <h3 className="font-bold text-amber-300">System Administrators</h3>
                <p className="text-gray-300">
                  Ensure 99.9% uptime, preserve audit logs, maintain IVMS hardware terminals, and safeguard student and faculty records from unauthorized exposure.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              4. Prohibited Activities
            </h2>
            <p>Users are strictly prohibited from:</p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-gray-300 text-xs sm:text-sm">
              <li>Engaging in proxy attendance or attempting to simulate biometric scans for another student or teacher.</li>
              <li>Reverse-engineering, scraping, or launching denial-of-service attacks against platform servers or API endpoints.</li>
              <li>Uploading malicious attachments, unauthorized script injections, or illicit materials into academic assignments.</li>
              <li>Falsifying medical justifications or absence documentation.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="p-6 sm:p-8 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-3">
            <h2 className="font-display font-bold text-xl text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              5. Intellectual Property & Institutional Rights
            </h2>
            <p>
              All software architecture, visual designs, Fatimi ornamental assets, Quranic Takhteet curricula, and databases comprising Darse Burhani are the exclusive intellectual property of Aljamea-tus-Saifiyah. Unauthorized reproduction or external redistribution is prohibited.
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between text-xs text-gray-400 gap-4">
          <span>&copy; {new Date().getFullYear()} Darse Burhani · Aljamea-tus-Saifiyah. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-white transition-colors underline">
              Privacy Policy
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
