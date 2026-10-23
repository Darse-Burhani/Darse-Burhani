"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { initAnalytics, trackEvent } from "@/lib/analytics";

interface CookiePreferences {
  essential: boolean;
  functional: boolean;
  analytics: boolean;
  savedAt: string;
}

const STORAGE_KEY = "db_cookie_consent_v1";

export function CookieConsentBanner() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState<CookiePreferences>({
    essential: true,
    functional: true,
    analytics: false,
    savedAt: "",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        const timer = setTimeout(() => setIsOpen(true), 800);
        return () => clearTimeout(timer);
      } else {
        const parsed = JSON.parse(saved);
        setPreferences(parsed);
        if (parsed.analytics) {
          initAnalytics();
        }
      }
    } catch {
      setIsOpen(true);
    }
  }, []);

  const savePreferences = (prefs: CookiePreferences) => {
    const updated = { ...prefs, savedAt: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setPreferences(updated);
    setIsOpen(false);
    setShowPreferences(false);

    if (updated.analytics) {
      initAnalytics();
    }
    trackEvent("cookie_consent_updated", {
      analytics: updated.analytics,
      functional: updated.functional,
    });
  };

  const handleAcceptAll = () => {
    savePreferences({
      essential: true,
      functional: true,
      analytics: true,
      savedAt: "",
    });
  };

  const handleRejectNonEssential = () => {
    savePreferences({
      essential: true,
      functional: false,
      analytics: false,
      savedAt: "",
    });
  };

  if (!isOpen) return null;

  return (
    <aside aria-label="Cookie Preferences" className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-5 flex justify-center">
      <div className="w-full max-w-2xl rounded-lg bg-[#0d0d0d] border border-[#2a2a2a] p-4 sm:p-5 text-[#f5f3ef] shadow-lg">
        {!showPreferences ? (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="text-xs space-y-1">
              <h4 className="font-semibold text-sm text-[#fbf8f2]">
                Cookie & Session Notice
              </h4>
              <p className="text-[#c7c1b5] leading-relaxed">
                This academic portal uses essential session cookies to authenticate your account and ensure secure portal operation. Review our{" "}
                <Link href="/privacy" className="text-[#c59b27] hover:underline">
                  Privacy Policy
                </Link>{" "}
                and{" "}
                <Link href="/terms" className="text-[#c59b27] hover:underline">
                  Terms of Service
                </Link>.
              </p>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setShowPreferences(true)}
                className="px-3 py-1.5 rounded-md border border-[#1c1c1c] text-xs font-medium text-[#d2cec3] hover:bg-[#1c1c1c] transition-colors"
              >
                Preferences
              </button>
              <button
                type="button"
                onClick={handleRejectNonEssential}
                className="px-3 py-1.5 rounded-md border border-[#1c1c1c] text-xs font-medium text-[#d2cec3] hover:bg-[#1c1c1c] transition-colors"
              >
                Essential Only
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="px-3.5 py-1.5 rounded-md bg-[#c59b27] hover:bg-[#b58b20] text-xs font-semibold text-[#0d0d0d] transition-colors"
              >
                Accept All
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-[#2a2a2a] pb-2">
              <h4 className="font-semibold text-sm text-[#fbf8f2]">Customize Cookie Settings</h4>
              <button
                type="button"
                onClick={() => setShowPreferences(false)}
                className="text-[#a49a86] hover:text-[#fbf8f2]"
              >
                Back
              </button>
            </div>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-2 rounded-md bg-[#1c1c1c]">
                <div>
                  <span className="font-medium text-[#fbf8f2]">Essential Cookies</span>
                  <p className="text-[11px] text-[#a49a86]">Required for authentication, session stability, and CSRF protection.</p>
                </div>
                <input type="checkbox" checked disabled className="rounded accent-[#c59b27]" />
              </label>

              <label className="flex items-center justify-between p-2 rounded-md bg-[#1c1c1c] cursor-pointer">
                <div>
                  <span className="font-medium text-[#fbf8f2]">Functional Preferences</span>
                  <p className="text-[11px] text-[#a49a86]">Remembers interface preferences like portal tab and filters.</p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.functional}
                  onChange={(e) => setPreferences({ ...preferences, functional: e.target.checked })}
                  className="rounded accent-[#c59b27]"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-[#2a2a2a]">
              <button
                type="button"
                onClick={() => savePreferences(preferences)}
                className="px-3.5 py-1.5 rounded-md bg-[#c59b27] text-xs font-semibold text-[#0d0d0d] hover:bg-[#b58b20]"
              >
                Save Preferences
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
