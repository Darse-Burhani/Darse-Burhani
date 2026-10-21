"use client";

import { useState, useEffect } from "react";
import { Download, X, Sparkles, Smartphone, Share, PlusSquare } from "lucide-react";
import { usePWA } from "@/lib/pwa";
import { FatimiLogo } from "@/components/FatimiLogo";

export function PWAInstallBanner() {
  const { canInstall, installPWA, dismissInstall } = usePWA();
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const isApple =
        /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsIOS(isApple && !isStandalone);
    }
  }, []);

  if (!canInstall && !isIOS) return null;

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
    } else {
      await installPWA();
    }
  };

  return (
    <>
      {/* Floating Installation Ribbon */}
      <div className="fixed bottom-20 lg:bottom-5 right-3 left-3 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-spring-up select-none">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#021f18] via-[#05372b] to-[#01140f] p-3 sm:p-3.5 border border-amber-400/40 shadow-[0_12px_40px_rgba(0,0,0,0.55)] text-white backdrop-blur-xl">
          <div className="pointer-events-none absolute -right-8 -top-8 w-32 h-32 rounded-full bg-amber-400/10 blur-xl" />

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-amber-400/30 flex items-center justify-center shrink-0 shadow-inner">
              <FatimiLogo size={22} variant="gold" glow={true} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-white truncate">Install Darse Burhani</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  PWA
                </span>
              </div>
              <p className="text-[11px] text-white/70 truncate mt-0.5">
                Fast offline access, fullscreen layout &amp; instant notifications.
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleInstallClick}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Install</span>
              </button>

              <button
                type="button"
                onClick={dismissInstall}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 hover:text-white flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-950 border border-amber-400/40 rounded-3xl p-6 max-w-sm w-full text-white shadow-2xl relative">
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
