// ─────────────────────────────────────────────────────────────
// PWA Management & Registration Module for Darse Burhani
// Handles Service Worker lifecycle, installation prompts, and online/offline status
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Global deferred prompt holder
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<(canInstall: boolean) => void>();

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  // Reload page when new service worker takes control (new app version)
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    console.log("[PWA] Controller changed — applying new version immediately.");
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.log("[PWA] Service Worker registered with scope:", reg.scope);

        // If a worker is already waiting, trigger skipWaiting immediately
        if (reg.waiting) {
          reg.waiting.postMessage({ type: "SKIP_WAITING" });
        }

        // Check for updates when a new worker is installing
        reg.onupdatefound = () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === "installed") {
                if (navigator.serviceWorker.controller) {
                  console.log("[PWA] New version installed! Signaling skipWaiting to activate.");
                  installingWorker.postMessage({ type: "SKIP_WAITING" });
                } else {
                  console.log("[PWA] App cached and ready for offline usage.");
                }
              }
            };
          }
        };

        // Periodic background update check every 15 minutes
        setInterval(() => {
          reg.update().catch(() => {});
        }, 15 * 60 * 1000);

        // Immediate check when mobile user brings app to foreground
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            reg.update().catch(() => {});
          }
        });

        window.addEventListener("focus", () => {
          reg.update().catch(() => {});
        });
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker registration failed:", err);
      });

    // Listen for install prompt from browser
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      installListeners.forEach((listener) => listener(true));
      console.log("[PWA] 'beforeinstallprompt' captured, ready to prompt install.");
    });

    // Listen for app installed event
    window.addEventListener("appinstalled", () => {
      deferredPrompt = null;
      installListeners.forEach((listener) => listener(false));
      console.log("[PWA] Darse Burhani application successfully installed!");
    });
  });
}

// Check if running in standalone PWA window
export function isPWAStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes("android-app://")
  );
}

// React hook for PWA status and installation banner
export function usePWA() {
  const [canInstall, setCanInstall] = useState<boolean>(() => !!deferredPrompt);
  const [isInstalled, setIsInstalled] = useState<boolean>(() => isPWAStandalone());
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("db-pwa-dismissed") === "true";
  });

  useEffect(() => {
    const handleStatus = (available: boolean) => {
      setCanInstall(available);
      setIsInstalled(isPWAStandalone());
    };

    installListeners.add(handleStatus);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial check
    if (deferredPrompt) {
      setCanInstall(true);
    }
    setIsInstalled(isPWAStandalone());

    return () => {
      installListeners.delete(handleStatus);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const installPWA = useCallback(async () => {
    if (!deferredPrompt) {
      // Fallback instruction for iOS / browsers without beforeinstallprompt
      const isIOS =
        typeof navigator !== "undefined" &&
        /iPad|iPhone|iPod/.test(navigator.userAgent) &&
        !(window as any).MSStream;
      if (isIOS) {
        alert(
          "To install on iOS: Tap the Share button in Safari, then choose 'Add to Home Screen' (📲)."
        );
      }
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        console.log("[PWA] User accepted installation prompt");
        deferredPrompt = null;
        setCanInstall(false);
        return true;
      } else {
        console.log("[PWA] User dismissed installation prompt");
        return false;
      }
    } catch (err) {
      console.error("[PWA] Error triggering install:", err);
      return false;
    }
  }, []);

  const dismissInstall = useCallback(() => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("db-pwa-dismissed", "true");
    }
  }, []);

  return {
    canInstall: canInstall && !dismissed && !isInstalled,
    isInstalled,
    isOnline,
    installPWA,
    dismissInstall,
  };
}
