"use client";

import React from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Lock,
  FileText,
  UserCheck,
  EyeOff,
  Server,
  Mail,
  ArrowLeft,
  Calendar,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { InstitutionalFooter } from "@/components/InstitutionalFooter";
import { SEO } from "@/components/SEO";

export default function PrivacyPolicyPage() {
  const lastUpdated = "October 2026 (1448 H)";

  return (
    <>
      <SEO
        title="Privacy Policy | Darse Burhani"
        description="Institutional privacy policy and data governance charter for Mahad al Zahra Darse Burhani platform."
      />

      <div className="min-h-screen bg-gradient-to-br from-[#f8fafc] via-[#f1f5f9] to-[#fff8e7] text-slate-800 flex flex-col justify-between selection:bg-emerald-200 selection:text-emerald-900">
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
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Mahad al Zahra &bull; Institutional Data Governance</span>
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Privacy Policy & Data Protection Charter
            </h1>

            <p className="text-base text-slate-600 leading-relaxed max-w-3xl">
              This charter outlines how Darse Burhani (Nisab) collects, safeguards, and handles academic records, biometric terminal vectors, and institutional communications for enrolled talabat students, faculty murabbis, and guardians.
            </p>
          </header>

          {/* ── Quick Summary Highlights ── */}
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <strong className="block text-slate-900 font-bold">Zero Data Sales</strong>
                <span className="text-slate-600">Records are never shared with marketing brokers or external commercial vendors.</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 shrink-0">
                <EyeOff className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <strong className="block text-slate-900 font-bold">Encrypted Biometrics</strong>
                <span className="text-slate-600">Raw biometric scans are never stored; only one-way cryptographic vectors are used.</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-white border border-slate-200/90 shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-lg bg-teal-50 text-teal-700 border border-teal-100 shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <strong className="block text-slate-900 font-bold">Strict Role Isolation</strong>
                <span className="text-slate-600">Parents only access their own children&apos;s data; teachers only access assigned classes.</span>
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
                  Information We Collect
                </h2>
              </div>

              <p className="text-slate-700">
                Darse Burhani operates as the central academic, attendance, and student tracking console for Mahad al Zahra. In order to facilitate academic programs and communicate with families, we process the following records:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Academic & Identity Records</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Student name, 8-digit ITS number, assigned grade or marhala, classroom schedule, and Quran Hifz milestone progress.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Attendance & Telemetry Records</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Daily check-in timestamps, classroom logbook entries, documented leave requests, and tardiness history.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Biometric Verification Vectors</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    For authorized terminal checkpoints, one-way cryptographic hash vectors are utilized. Raw facial images or biometric prints are never transmitted or stored unencrypted.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Faculty & Guardian Contact Data</span>
                  </div>
                  <p className="text-xs text-slate-600">
                    Registered academic and parent email addresses, SMS/notification preferences, and authenticated portal credentials.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-black text-xs">
                  2
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
                  How Information is Used & Role-Based Access
                </h2>
              </div>

              <p className="text-slate-700">
                Student and faculty records are processed solely for educational oversight, institutional safety, and transparent communication between Mahad al Zahra and enrolled families. Access is enforced strictly by authenticated role:
              </p>

              <ul className="space-y-2 text-xs sm:text-sm text-slate-700">
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                  <div>
                    <strong className="text-slate-900">Faculty Murabbis:</strong> Access attendance registers, daily logbooks, and academic marks for their assigned classes only.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                  <div>
                    <strong className="text-slate-900">Parents & Guardians:</strong> Access attendance logs, Hifz milestones, and performance reviews strictly for their registered children.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                  <div>
                    <strong className="text-slate-900">Talabat Students:</strong> Access their individual lesson assignments, library checkout logs, and personal attendance streaks.
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                  <div>
                    <strong className="text-slate-900">Institutional Administration:</strong> Oversees system maintenance, academic timetables, security policies, and institutional auditing.
                  </div>
                </li>
              </ul>

              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 font-medium space-y-1">
                <strong className="block text-amber-900 font-bold uppercase tracking-wide">
                  Commercial Prohibition
                </strong>
                <span>
                  Mahad al Zahra strictly prohibits licensing, renting, or selling learner records to any commercial advertiser, ad-tech network, or external data aggregator.
                </span>
              </div>
            </section>

            {/* Section 3 */}
            <section className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-black text-xs">
                  3
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
                  Data Security & Infrastructure Protection
                </h2>
              </div>

              <p className="text-slate-700">
                All communications between client devices and Darse Burhani servers are secured using Transport Layer Security (TLS 1.3). Account credentials and biometric vectors are stored with salted cryptographic one-way hashing algorithms.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <span className="font-bold text-slate-900 block mb-1">Automatic Session Expiry</span>
                  <p className="text-slate-600">To prevent unauthorized exposure on shared school terminals, inactive sessions expire automatically.</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <span className="font-bold text-slate-900 block mb-1">Audit Trail Logging</span>
                  <p className="text-slate-600">All administrative modifications, role upgrades, and manual attendance edits are stamped with indelible audit logs.</p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800 font-black text-xs">
                  4
                </div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-slate-900">
                  Correction Requests & Official Inquiries
                </h2>
              </div>

              <p className="text-slate-700">
                Parents, faculty members, and talabat students may inspect their recorded academic data and request rectification of any inaccurate records by contacting the academic administration desk:
              </p>

              {/* Official Contact Box */}
              <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50/70 via-slate-50 to-amber-50/40 border border-emerald-200 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <span>Academic Administration Desk &bull; Mahad al Zahra</span>
                </div>
                <div className="text-xs space-y-1 text-slate-700">
                  <p>
                    <strong className="text-slate-900">Official Support Email:</strong>{" "}
                    <a
                      href="mailto:support.darseburhani.galiakot@gmail.com"
                      className="text-emerald-700 hover:text-emerald-950 font-bold underline"
                    >
                      support.darseburhani.galiakot@gmail.com
                    </a>
                  </p>
                  <p>
                    <strong className="text-slate-900">Location:</strong> Administrative Block, Mahad al Zahra Campus
                  </p>
                  <p>
                    <strong className="text-slate-900">Office Hours:</strong> Monday through Saturday, 08:00 – 16:30 IST
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
