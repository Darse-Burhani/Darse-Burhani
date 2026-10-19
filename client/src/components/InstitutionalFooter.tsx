"use client";

import Link from "next/link";

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
      <footer className={`mt-auto border-t border-slate-200 dark:border-[#1e382b] bg-white dark:bg-[#091711] py-4 px-4 text-center text-xs text-slate-500 dark:text-[#a49a86] ${className}`}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium text-slate-700 dark:text-[#d2cec3]">
            © {currentYear} Darse Burhani (Nisab) · <span className="font-semibold text-[#0f5132] dark:text-[#c59b27]">Mahad al Zahra</span>
          </p>
          <div className="flex items-center gap-5 text-xs">
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-[#fbf8f2] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-slate-900 dark:hover:text-[#fbf8f2] transition-colors">Terms of Service</Link>
            <a href="mailto:support.darseburhani.galiakot@gmail.com" className="hover:text-slate-900 dark:hover:text-[#fbf8f2] transition-colors">Support: support.darseburhani.galiakot@gmail.com</a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`mt-auto border-t border-slate-200 dark:border-[#1b3629] bg-[#0c1f17] text-[#f5f3ef] ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-[#1b3629]">
          {/* Column 1: Institution */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#122b20] border border-[#234937] p-1.5 flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="Darse Burhani" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-[#fbf8f2] tracking-tight">
                  Darse Burhani (Nisab)
                </h3>
                <p className="text-[11px] font-semibold text-[#c59b27] uppercase tracking-wider">
                  Mahad al Zahra
                </p>
              </div>
            </div>
            <p className="text-xs text-[#b8b2a5] leading-relaxed max-w-sm">
              Academic records, classroom attendance, Quran Hifz milestones, and institutional governance for faculty, talabat students, and families.
            </p>
          </div>

          {/* Column 2: Legal & Governance */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#c59b27]">
              Governance & Policies
            </h4>
            <ul className="space-y-1.5 text-xs text-[#d2cec3]">
              <li>
                <Link href="/privacy" className="hover:text-[#fbf8f2] transition-colors">
                  Privacy Policy & Data Protection
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[#fbf8f2] transition-colors">
                  Terms of Service & User Conduct
                </Link>
              </li>
              <li>
                <Link href="/fatimi-calendar" className="hover:text-[#fbf8f2] transition-colors">
                  Fatimi Academic Calendar
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact & Assistance */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#c59b27]">
              Administration & Support
            </h4>
            <div className="text-xs text-[#b8b2a5] space-y-1">
              <p className="text-[#fbf8f2] font-medium">Administration Desk, Mahad al Zahra</p>
              <p>Email: <a href="mailto:support.darseburhani.galiakot@gmail.com" className="text-[#c59b27] hover:underline font-semibold">support.darseburhani.galiakot@gmail.com</a></p>
              <p>Assistance hours: Monday to Saturday, 08:00 – 16:30 IST</p>
            </div>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#8e8574]">
          <p>© {currentYear} Darse Burhani (Nisab). Mahad al Zahra. Authorized academic access only.</p>
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-[#d2cec3]">Privacy</Link>
            <Link href="/terms" className="hover:text-[#d2cec3]">Terms</Link>
            <Link href="/login" className="hover:text-[#d2cec3]">Sign In</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
