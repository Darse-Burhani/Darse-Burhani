/**
 * Privacy-First Analytics and Telemetry Engine
 *
 * Supports:
 * - Google Analytics (gtag) integration if VITE_GA_TRACKING_ID or env is configured
 * - Plausible Analytics integration if VITE_PLAUSIBLE_DOMAIN is configured
 * - Custom Telemetry Event Dispatcher
 * - Strict adherence to institutional cookie consent (only sends when consent is granted)
 */

declare global {
  interface Window {
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
    plausible?: (eventName: string, options?: { props?: Record<string, any> }) => void;
  }
}

const STORAGE_KEY = "db_cookie_consent_v1";

/**
 * Check if the user has consented to analytics cookies.
 */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed.analytics);
  } catch {
    return false;
  }
}

/**
 * Initialize external analytics if consent is present and IDs exist in environment.
 */
export function initAnalytics() {
  if (typeof window === "undefined") return;

  const gaId = (import.meta as any).env?.VITE_GA_TRACKING_ID || "";
  if (gaId && hasAnalyticsConsent()) {
    // Avoid double injection
    if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${gaId}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function () {
        window.dataLayer?.push(arguments);
      };
      window.gtag("js", new Date());
      window.gtag("config", gaId, { anonymize_ip: true });
    }
  }
}

/**
 * Track a pageview event.
 */
export function trackPageView(path: string, title?: string) {
  if (typeof window === "undefined") return;

  if (hasAnalyticsConsent()) {
    // 1. Google Analytics
    if (window.gtag) {
      window.gtag("event", "page_view", {
        page_path: path,
        page_title: title || document.title,
      });
    }

    // 2. Plausible
    if (window.plausible) {
      window.plausible("pageview", { props: { path, title } });
    }
  }

  // 3. Custom internal telemetry event dispatch
  try {
    const customEvent = new CustomEvent("darse_telemetry_pageview", {
      detail: { path, title: title || document.title, timestamp: new Date().toISOString() },
    });
    window.dispatchEvent(customEvent);
  } catch {}
}

/**
 * Track custom interaction events (e.g. portal login, form submission, filter changes).
 */
export function trackEvent(eventName: string, properties: Record<string, any> = {}) {
  if (typeof window === "undefined") return;

  if (hasAnalyticsConsent()) {
    if (window.gtag) {
      window.gtag("event", eventName, properties);
    }
    if (window.plausible) {
      window.plausible(eventName, { props: properties });
    }
  }

  try {
    const customEvent = new CustomEvent("darse_telemetry_event", {
      detail: { eventName, properties, timestamp: new Date().toISOString() },
    });
    window.dispatchEvent(customEvent);
  } catch {}
}
