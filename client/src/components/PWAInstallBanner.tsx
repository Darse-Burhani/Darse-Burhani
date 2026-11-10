"use client";

import { useState, useEffect } from "react";
import { Download, X, Sparkles, Smartphone, Share, PlusSquare } from "lucide-react";
import { usePWA, isPWAStandalone } from "@/lib/pwa";
import { FatimiLogo } from "@/components/FatimiLogo";

export function PWAInstallBanner() {
  const { canInstall, dismissed, installPWA, dismissInstall } = usePWA();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const isStandalone = isPWAStandalone();

  // Listen for explicit manual install guide triggers (from header / drawer / settings)
  useEffect(() => {
    const handleManualGuide = () => {
      setShowIOSGuide(true);
    };
    window.addEventListener("show-pwa-install-guide", handleManualGuide);
    return () => window.removeEventListener("show-pwa-install-guide", handleManualGuide);
  }, []);

  // In standalone PWA mode, never render banners or guides
  if (isStandalone) return null;

  return (
    <>
      {/* iOS Instructions Modal — Triggered on explicit user request */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="bg-slate-950 border border-amber-400/40 rounded-3xl p-6 max-w-sm w-full text-white shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top-Right Close Button for iOS Guide Modal */}
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer touch-manipulation"
              aria-label="Close guide"
              title="Close guide"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center mb-4 mx-auto text-amber-300">
              <Smartphone className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-center text-white">Install on iOS (iPhone/iPad)</h3>
            <p className="text-xs text-white/70 text-center mt-1 mb-5">
              Follow these simple steps in Safari to add Darse Burhani as a native app:
            </p>

            <div className="space-y-3 text-xs bg-white/5 p-4 rounded-2xl border border-white/10 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-amber-400">
                  <Share className="w-4 h-4" />
                </div>
                <span>1. Tap the <strong>Share</strong> button in Safari toolbar.</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-amber-400">
                  <PlusSquare className="w-4 h-4" />
                </div>
                <span>2. Scroll down and tap <strong>Add to Home Screen</strong>.</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span>3. Tap <strong>Add</strong> in the top-right corner.</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-bold text-xs active:scale-95 transition-all cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
