"use client";

import Link from "next/link";
import { InstitutionalFooter } from "@/components/InstitutionalFooter";

export default function PrivacyPolicyPage() {
  const lastUpdated = "October 2026";

  return (
    <div className="min-h-screen bg-[#0c1f17] text-[#f5f3ef] flex flex-col justify-between">
      <main className="max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Navigation */}
        <div className="mb-8 flex items-center justify-between border-b border-[#1e382b] pb-4">
          <Link
            href="/login"
            className="inline-flex items-center text-xs font-semibold text-[#c59b27] hover:underline"
          >
            ← Return to Sign In
          </Link>
          <span className="text-xs text-[#a49a86]">
            Effective Date: {lastUpdated}
          </span>
        </div>

        {/* Title Header */}
        <header className="mb-10 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-[#c59b27]">
            Mahad al Zahra · Institutional Governance
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-[#fbf8f2] tracking-tight">
            Privacy Policy and Data Protection
          </h1>
          <p className="text-sm text-[#b8b2a5] leading-relaxed max-w-2xl">
            This charter outlines how Darse Burhani (Nisab) collects, safeguards, and handles academic, attendance, and identity records for students, faculty, and families.
          </p>
        </header>

        {/* Legal Sections */}
        <div className="space-y-8 text-sm text-[#d2cec3] leading-relaxed">
          <section className="space-y-3 p-6 rounded-lg bg-[#10271d] border border-[#1e382b]">
            <h2 className="font-serif text-xl font-bold text-[#fbf8f2]">
              1. Information We Collect
            </h2>
            <p>
              Darse Burhani operates as the central academic, attendance, and student records platform for Mahad al Zahra. In order to facilitate academic programs and communicate with families, we process the following records:
            </p>
            <ul className="list-disc list-inside space-y-1.5 pl-2 text-xs sm:text-sm text-[#c7c1b5]">
              <li>
                <strong className="text-[#fbf8f2]">Academic and Identity Records:</strong> Student name, registered 8-digit ITS number, assigned grade or marhala, classroom schedule, and Quran Hifz milestone progress.
              </li>
              <li>
                <strong className="text-[#fbf8f2]">Attendance Records:</strong> Daily check-in timestamps, classroom logbook entries, documented leave requests, and tardiness records.
              </li>
              <li>
                <strong className="text-[#fbf8f2]">Biometric Verification Data:</strong> For authorized terminal checkpoints, one-way cryptographic hash vectors are utilized. Raw facial images or biometric prints are never transmitted or stored unencrypted.
              </li>
              <li>
                <strong className="text-[#fbf8f2]">Faculty and Guardian Contact Information:</strong> Registered academic and parent email addresses, notification settings, and authenticated portal credentials.
              </li>
            </ul>
          </section>

          <section className="space-y-3 p-6 rounded-lg bg-[#10271d] border border-[#1e382b]">
            <h2 className="font-serif text-xl font-bold text-[#fbf8f2]">
              2. How Information is Used
            </h2>
            <p>
              Student and faculty data is utilized strictly for educational oversight, institutional safety, and communication between Mahad al Zahra and enrolled families.
            </p>
            <p className="text-xs text-[#a49a86]">
              We do not sell, license, or provide personal records to commercial advertisers or third-party marketing services. Access to student records is governed strictly by institutional role:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs text-[#c7c1b5]">
              <li>Faculty members access rosters and daily logbooks for their assigned classes.</li>
              <li>Parents access progress reports and attendance history for their registered children.</li>
              <li>Students (Talabat) access their individual sabaq assignments and library borrow logs.</li>
              <li>Administrative officers manage system configuration and institutional records.</li>
            </ul>
          </section>

          <section className="space-y-3 p-6 rounded-lg bg-[#10271d] border border-[#1e382b]">
            <h2 className="font-serif text-xl font-bold text-[#fbf8f2]">
              3. Data Security and Access Controls
            </h2>
            <p>
              All communications between your browser and the portal servers are encrypted using industry-standard Transport Layer Security (TLS). Account passwords are protected using salted one-way hashing algorithms.
            </p>
            <p>
              Sessions expire automatically after periods of inactivity to protect unauthorized access on shared campus terminals.
            </p>
          </section>

          <section className="space-y-3 p-6 rounded-lg bg-[#10271d] border border-[#1e382b]">
            <h2 className="font-serif text-xl font-bold text-[#fbf8f2]">
              4. Inquiries and Correction Requests
            </h2>
            <p>
              Parents and faculty members may request review or correction of their recorded personal details by contacting the administration desk:
            </p>
            <div className="text-xs text-[#b8b2a5] space-y-1 pt-1">
              <p className="text-[#fbf8f2] font-semibold">Administration Desk, Mahad al Zahra</p>
              <p>Email: admin@darseburhani.edu</p>
              <p>Location: Administrative Block, Mahad al Zahra Campus</p>
            </div>
          </section>
        </div>
      </main>

      <InstitutionalFooter variant="minimal" />
    </div>
  );
}
