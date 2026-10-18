"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SEO } from "@/components/SEO";
import { trackEvent } from "@/lib/analytics";

export default function ThankYouPage() {
  const [copied, setCopied] = useState(false);
  const [refId, setRefId] = useState("DB-849204");

  useEffect(() => {
    const randomHex = Math.floor(100000 + Math.random() * 900000);
    const id = `DB-${randomHex}`;
    setRefId(id);
    trackEvent("thank_you_viewed", { referenceId: id });
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(refId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <SEO
        title="Submission Confirmed | Darse Burhani"
        description="Your academic request, attendance inquiry, or form submission has been received by Darse Burhani."
      />

      <main className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-[#0c1f17] text-[#f5f3ef]">
        <div className="w-full max-w-md mx-auto rounded-xl bg-[#10271d] border border-[#1e382b] p-6 sm:p-8 text-center space-y-5">
          <div className="w-14 h-14 rounded-xl bg-[#163628] border border-[#234937] p-2 flex items-center justify-center mx-auto">
            <img src="/logo.png" alt="Darse Burhani" className="w-9 h-9 object-contain" />
          </div>

          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest font-semibold text-[#c59b27]">
              Mahad al Zahra
            </p>
            <h1 className="font-serif text-2xl font-bold text-[#fbf8f2]">
              Submission Received
            </h1>
            <p className="text-xs text-[#b8b2a5] leading-relaxed pt-1">
              Your record has been registered with the Darse Burhani institutional administration.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[#0c1f17] border border-[#1e382b] flex items-center justify-between text-xs">
            <div className="text-left">
              <span className="text-[11px] text-[#a49a86] block">Reference Number</span>
              <span className="font-mono font-bold text-[#fbf8f2] text-sm tracking-wide">{refId}</span>
            </div>
            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1 rounded border border-[#2d5843] text-[11px] font-medium text-[#c59b27] hover:bg-[#163628] transition-colors"
            >
              {copied ? "Copied" : "Copy Ref"}
            </button>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/login"
              className="w-full py-2.5 rounded-md bg-[#c59b27] hover:bg-[#b58b20] text-xs font-semibold text-[#0c1f17] transition-colors text-center"
            >
              Return to Sign In
            </Link>
            <Link
              href="/privacy"
              className="text-[11px] text-[#a49a86] hover:text-[#d2cec3] transition-colors"
            >
              View Institutional Privacy Policy
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
