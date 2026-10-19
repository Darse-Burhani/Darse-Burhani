"use client";

import React from "react";
import { Link } from "react-router-dom";
import {
  Scale,
  ShieldAlert,
  UserCheck,
  BookOpen,
  ArrowLeft,
  Calendar,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Award,
} from "lucide-react";
import { InstitutionalFooter } from "@/components/InstitutionalFooter";
import { SEO } from "@/components/SEO";

export default function TermsPage() {
  const lastUpdated = "October 2026 (1448 H)";

  return (
    <>
      <SEO
        title="Terms of Service | Darse Burhani"
        description="Conditions governing authorized access to the Darse Burhani (Nisab) academic and attendance network."
      />

      <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#ecfdf5] text-slate-800 flex flex-col justify-between selection:bg-emerald-200 selection:text-emerald-900">
        {/* Soft Ambient Radiance Orbs */}
        <div className="pointer-events-none fixed -top-32 -left-32 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none fixed -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-500/15 blur-3xl" />

        <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12 relative z-10">
          {/* ── Top Navigation Bar ── */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 hover:text-emerald-950 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Return to Sign In Portal</span>
            </Link>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-white/80 border border-slate-200 px-3 py-1 rounded-full w-fit">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Effective Date: {lastUpdated}</span>
            </div>
          </div>

          {/* ── Page Header / Hero ── */}
          <header className="mb-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/80 border border-emerald-300 text-emerald-900 text-xs font-bold">
              <Scale className="w-4 h-4 text-emerald-700" />
              <span>Mahad al Zahra &bull; Institutional User Code</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Terms of Service & User Conduct
            </h1>

            <p className="text-base text-slate-600 leading-relaxed max-w-3xl">
              Conditions governing authorized access to the Darse Burhani (Nisab) academic platform, attendance registers, and student learning console.
            </p>
          </header>

          {/* ── Core Institutional Standards Banner ── */}
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <strong className="block text-slate-900 font-bold">Authorized Use Only</strong>
                <span className="text-slate-600">Access restricted exclusively to registered talabat, faculty, and verified parents.</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 shrink-0">
                <Award className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <strong className="block text-slate-900 font-bold">Definitive Academic Log</strong>
                <span className="text-slate-600">Attendance marks and Hifz sabaq recorded here constitute official institutional records.</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 shrink-0">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <strong className="block text-slate-900 font-bold">Tamper Prohibition</strong>
                <span className="text-slate-600">Attempted record tampering or credential sharing results in immediate lockout.</span>
              </div>
            </div>
          </div>

          {/* ── Policy Sections ── */}
          <div className="space-y-6 text-slate-700 text-sm leading-relaxed">
            
            {/* Section 1 */}
            <section className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-black text-xs">
                  1
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
                  Authorized Access & Credential Confidentiality
                </h2>
              </div>

              <p className="text-slate-700">
                Access to Darse Burhani is restricted strictly to enrolled talabat students, registered parents, appointed faculty members, and institutional administrators of Mahad al Zahra.
              </p>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs sm:text-sm">
                <p className="text-slate-700">
                  <strong className="text-slate-900">Credential Custody:</strong> Users are responsible for preserving the confidentiality of their portal credentials (including 8-digit ITS numbers, passcodes, and session tokens).
                </p>
                <p className="text-slate-700">
                  Sharing credentials, attempting to impersonate another student or faculty member, or operating multiple conflicting sessions is strictly prohibited.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-black text-xs">
                  2
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
                  Acceptable Institutional Use & System Conduct
                </h2>
              </div>

              <p className="text-slate-700">
                Users agree to utilize this system solely for academic review, attendance submission, Quran Hifz milestone progress, and official communications. The following actions constitute immediate violations:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 space-y-1">
                  <div className="flex items-center gap-2 text-rose-950 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Falsification Prohibited</span>
                  </div>
                  <p className="text-xs text-rose-900/90">
                    Attempting to alter, forge, or back-date attendance records, exam merits, or library status.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 space-y-1">
                  <div className="flex items-center gap-2 text-rose-950 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Security Circumvention</span>
                  </div>
                  <p className="text-xs text-rose-900/90">
                    Circumventing role-based security permissions, terminal verification checkpoints, or inspection locks.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 space-y-1">
                  <div className="flex items-center gap-2 text-rose-950 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Automated Scraping</span>
                  </div>
                  <p className="text-xs text-rose-900/90">
                    Executing automated scripts, scrapers, or bulk export routines without explicit written authorization.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/80 space-y-1">
                  <div className="flex items-center gap-2 text-rose-950 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Shared Terminal Neglect</span>
                  </div>
                  <p className="text-xs text-rose-900/90">
                    Failing to log out of campus workstations, classroom kiosks, or shared library TV terminals.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-black text-xs">
                  3
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
                  Attendance, Sabaq Records, & Discrepancy Reporting
                </h2>
              </div>

              <p className="text-slate-700">
                Official entries maintained within Darse Burhani constitute the definitive institutional log for daily student attendance, Quran Hifz marhala milestones, and library borrowings.
              </p>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs sm:text-sm text-slate-700">
                <p>
                  Any discrepancies in biometric logs or classroom register entries must be reported within <strong>48 hours</strong> to the assigned Class Murabbi or Academic Administration desk.
                </p>
                <p>
                  Parental leave requests submitted through the portal remain pending until approved by the appropriate faculty member or admin coordinator.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-black text-xs">
                  4
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
                  Administration & Technical Assistance
                </h2>
              </div>

              <p className="text-slate-700">
                For account verification, password resets, or official inquiries regarding terms compliance:
              </p>

              {/* Official Contact Box */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50/70 via-slate-50 to-amber-50/40 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <span>Darse Burhani Administration Desk</span>
                </div>
                <div className="text-xs space-y-1 text-slate-700">
                  <p>
                    <strong className="text-slate-900">Support Email:</strong>{" "}
                    <a
                      href="mailto:support.darseburhani.galiakot@gmail.com"
                      className="text-emerald-700 hover:text-emerald-950 font-bold underline"
                    >
                      support.darseburhani.galiakot@gmail.com
                    </a>
                  </p>
                  <p>
                    <strong className="text-slate-900">Campus:</strong> Mahad al Zahra Academic Administration
                  </p>
                </div>
              </div>
            </section>

          </div>
        </main>

        <InstitutionalFooter variant="minimal" />
      </div>
    </>
  );
}
