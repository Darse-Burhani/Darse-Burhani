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
      <footer className={`mt-auto border-t border-slate-200 bg-white/95 backdrop-blur-sm py-4 px-4 text-center text-xs text-slate-600 ${className}`}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-semibold text-slate-700">
            © {currentYear} Darse Burhani (Nisab) · <span className="font-bold text-emerald-800">Mahad al Zahra</span>
          </p>
          <div className="flex items-center gap-5 text-xs font-semibold text-slate-600">
            <Link href="/privacy" className="hover:text-emerald-800 hover:underline transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-emerald-800 hover:underline transition-colors">Terms of Service</Link>
            <a href="mailto:support.darseburhani.galiakot@gmail.com" className="hover:text-emerald-800 hover:underline transition-colors">Support</a>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className={`mt-auto border-t border-slate-200 dark:border-[#2a2a2a] bg-[#0d0d0d] text-[#f5f3ef] ${className}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-[#2a2a2a]">
          {/* Column 1: Institution */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#1c1c1c] border border-[#2a2a2a] p-1.5 flex items-center justify-center shrink-0">
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
              <p>Email: <a href="mailto:admin.galiakot@darseburhani.org" className="text-[#c59b27] hover:underline font-semibold">admin.galiakot@darseburhani.org</a></p>
              <p>Tel: <a href="tel:+912964282222" className="text-[#c59b27] hover:underline font-semibold">+91 2964 282222</a></p>
              <p>Assistance hours: Monday to Saturday, 08:00 – 16:30 IST</p>
              <div className="pt-2 flex items-center gap-3 text-[#c59b27]">
                <a href="https://www.facebook.com/darseburhani" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" title="Facebook">Facebook</a>
                <span>·</span>
                <a href="https://twitter.com/darseburhani" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" title="Twitter / X">X</a>
                <span>·</span>
                <a href="https://www.instagram.com/darseburhani" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" title="Instagram">Instagram</a>
                <span>·</span>
                <a href="https://www.linkedin.com/school/darse-burhani" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" title="LinkedIn">LinkedIn</a>
                <span>·</span>
                <a href="https://www.youtube.com/@darseburhani" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors" title="YouTube">YouTube</a>
              </div>
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
