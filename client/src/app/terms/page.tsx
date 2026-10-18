"use client";

import Link from "next/link";
import { InstitutionalFooter } from "@/components/InstitutionalFooter";

export default function TermsPage() {
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
            Terms of Service and User Conduct
          </h1>
          <p className="text-sm text-[#b8b2a5] leading-relaxed max-w-2xl">
            Conditions governing authorized access to the Darse Burhani (Nisab) academic and attendance network.
          </p>
        </header>

        {/* Legal Sections */}
        <div className="space-y-8 text-sm text-[#d2cec3] leading-relaxed">
          <section className="space-y-3 p-6 rounded-lg bg-[#10271d] border border-[#1e382b]">
            <h2 className="font-serif text-xl font-bold text-[#fbf8f2]">
              1. Authorized Access and Credentials
            </h2>
            <p>
              Access to Darse Burhani is restricted strictly to enrolled talabat students, registered parents, appointed faculty members, and institutional administrators of Mahad al Zahra.
            </p>
            <p>
              Users are responsible for maintaining the confidentiality of their login credentials (including ITS number and account password). Sharing accounts or attempting to access other users&apos; accounts is strictly prohibited.
            </p>
          </section>

          <section className="space-y-3 p-6 rounded-lg bg-[#10271d] border border-[#1e382b]">
            <h2 className="font-serif text-xl font-bold text-[#fbf8f2]">
              2. Acceptable Institutional Use
            </h2>
            <p>
              Users agree to utilize this system solely for academic review, attendance submission, Hifz progress tracking, and official communications. The following actions constitute immediate violations:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-xs text-[#c7c1b5]">
              <li>Attempting to alter or falsify attendance records, grades, or merits.</li>
              <li>Circumventing role-based security permissions or inspection locks.</li>
              <li>Automated scraping, bulk downloading, or exporting learner data without written administrative authorization.</li>
            </ul>
          </section>

          <section className="space-y-3 p-6 rounded-lg bg-[#10271d] border border-[#1e382b]">
            <h2 className="font-serif text-xl font-bold text-[#fbf8f2]">
              3. Attendance and Sabaq Records
            </h2>
            <p>
              Official records maintained within Darse Burhani constitute the definitive institutional log for student attendance, Hifz Quran marhala milestones, and library borrowings. Discrepancies should be reported promptly to the class Murabbi or designated coordinator.
            </p>
          </section>

          <section className="space-y-3 p-6 rounded-lg bg-[#10271d] border border-[#1e382b]">
            <h2 className="font-serif text-xl font-bold text-[#fbf8f2]">
              4. Contact and Administration
            </h2>
            <p>
              For account issues, credential recovery, or technical assistance, contact the institutional administration desk:
            </p>
            <div className="text-xs text-[#b8b2a5] space-y-1 pt-1">
              <p className="text-[#fbf8f2] font-semibold">Darse Burhani Administration Desk</p>
              <p>Email: admin@darseburhani.edu</p>
              <p>Mahad al Zahra Academic Administration</p>
            </div>
          </section>
        </div>
      </main>

      <InstitutionalFooter variant="minimal" />
    </div>
  );
}
