"use client";

import { useState, useEffect } from "react";
import { Download, X, Sparkles, Smartphone, Share, PlusSquare, MoreVertical, CheckCircle2 } from "lucide-react";
import { usePWA, isPWAStandalone } from "@/lib/pwa";

export function PWAInstallBanner() {
  const { canPromptDirectly, installPWA } = usePWA();
  const [showGuide, setShowGuide] = useState(false);
  const [platform, setPlatform] = useState<"ios" | "android" | "other">("android");
  const isStandalone = isPWAStandalone();

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent || "";
      if (/iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream) {
        setPlatform("ios");
      } else if (/Android/.test(ua)) {
        setPlatform("android");
      } else {
        setPlatform("other");
      }
    }
  }, []);

  // Listen for explicit manual install guide triggers (from header / drawer / settings)
  useEffect(() => {
    const handleManualGuide = () => {
      setShowGuide(true);
    };
    window.addEventListener("show-pwa-install-guide", handleManualGuide);
    return () => window.removeEventListener("show-pwa-install-guide", handleManualGuide);
  }, []);

  // In standalone PWA mode, never render banners or guides
  if (isStandalone) return null;

  return (
    <>
      {/* Platform-Aware PWA Installation Guide Modal */}
      {showGuide && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="bg-slate-950 border border-amber-400/40 rounded-3xl p-6 max-w-sm w-full text-white shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top-Right Close Button */}
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 text-white/70 hover:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer touch-manipulation"
              aria-label="Close guide"
              title="Close guide"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>

            {/* App Icon preview (New Gold Obsidian Sacred Geometry) */}
            <div className="flex flex-col items-center justify-center mb-4">
              <div className="w-16 h-16 rounded-2xl bg-black border-2 border-amber-400/60 p-1 shadow-lg shadow-amber-500/20 flex items-center justify-center overflow-hidden">
                <img
                  src="/pwa-192x192.png"
                  alt="Darse Burhani App Emblem"
                  className="w-full h-full object-contain rounded-xl"
                />
              </div>
              <h3 className="text-base font-bold text-center text-white mt-2.5">
                {platform === "ios"
                  ? "Install on iOS (iPhone / iPad)"
                  : platform === "android"
                  ? "Install on Android"
                  : "Install Darse Burhani"}
              </h3>
              <p className="text-[11px] text-amber-300/80 text-center font-medium mt-0.5">
                Darse Burhani — Mahad al Zahra
              </p>
            </div>

            <p className="text-xs text-white/75 text-center mb-4">
              {platform === "ios"
                ? "Add Darse Burhani to your home screen using Safari for instant biometric access:"
                : "Add Darse Burhani directly to your home screen in 3 quick steps:"}
            </p>

            {/* Step-by-step instructions */}
            <div className="space-y-3 text-xs bg-white/5 p-4 rounded-2xl border border-white/10 mb-5">
              {platform === "ios" ? (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300">
                      <Share className="w-4 h-4" />
                    </div>
                    <span>
                      1. Tap the <strong>Share</strong> button in Safari's bottom toolbar.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300">
                      <PlusSquare className="w-4 h-4" />
                    </div>
                    <span>
                      2. Scroll down and tap <strong>Add to Home Screen</strong>.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <span>
                      3. Tap <strong>Add</strong> in the top-right corner.
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300">
                      <MoreVertical className="w-4 h-4" />
                    </div>
                    <span>
                      1. Tap the <strong>three dots menu (⋮)</strong> in Chrome / browser top corner.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300">
                      <Download className="w-4 h-4" />
                    </div>
                    <span>
                      2. Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <span>
                      3. Confirm by tapping <strong>Install</strong> to pin the gold emblem app.
                    </span>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              {canPromptDirectly && (
                <button
                  type="button"
                  onClick={async () => {
                    const success = await installPWA();
                    if (success) setShowGuide(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs active:scale-95 transition-all cursor-pointer shadow-md"
                >
                  Install Now
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 font-bold text-xs active:scale-95 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
