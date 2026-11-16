/**
 * Smooth, high-fidelity notification sound generator, PWA Badging, and Desktop Push helper.
 * Uses Web Audio API for 0ms latency, artifact-free, warm Fatimi harmonic bell chimes.
 * 100% compliant with modern browser Autoplay Policies (strictly zero console warnings).
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private hasInteracted = false;

  constructor() {
    if (typeof window !== "undefined") {
      const unlock = () => {
        this.hasInteracted = true;
        if (this.ctx && this.ctx.state === "suspended") {
          this.ctx.resume().catch(() => {});
        }
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
        window.removeEventListener("touchstart", unlock);
        window.removeEventListener("click", unlock);
      };
      window.addEventListener("pointerdown", unlock, { once: true, passive: true });
      window.addEventListener("keydown", unlock, { once: true, passive: true });
      window.addEventListener("touchstart", unlock, { once: true, passive: true });
      window.addEventListener("click", unlock, { once: true, passive: true });
    }
  }

  /**
   * Lazily acquires or resumes the AudioContext ONLY after a verified user gesture.
   * Prevents Chrome's "The AudioContext was not allowed to start" console warning.
   */
  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined" || !this.hasInteracted) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * Plays a smooth, silky multi-harmonic Fatimi bell chime.
   * If the user hasn't interacted with the page yet, it silently skips to prevent autoplay errors.
   */
  public playSmoothChime(type: "chime" | "arrival" | "alert" | "subtle" = "chime"): void {
    if (!this.hasInteracted) return;

    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().then(() => {
        if (ctx.state === "running") {
          this.synthesizeSound(ctx, type);
        }
      }).catch(() => {});
      return;
    }

    if (ctx.state === "running") {
      this.synthesizeSound(ctx, type);
    }
  }

  /**
   * Synthesizes the unique, sacred Fatimi harmonic chime.
   * Built with pure sinusoidal pentatonic overtones, smooth logarithmic envelopes,
   * and acoustic lowpass resonance for a soothing, non-intrusive sound.
   */
  private synthesizeSound(ctx: AudioContext, type: "chime" | "arrival" | "alert" | "subtle"): void {
    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);

      if (type === "arrival" || type === "chime") {
        // Unique Fatimi Harmonic Chime: D5 (587.3Hz) -> F#5 (739.9Hz) -> A5 (880Hz) -> D6 (1174.6Hz) -> F#6 (1479.9Hz)
        // Gentle arpeggiated entrance with warm lowpass resonant damping
        const notes = [
          { freq: 587.33, start: 0.00, dur: 0.85, gain: 0.10 }, // D5 (Warm foundation)
          { freq: 739.99, start: 0.04, dur: 0.95, gain: 0.12 }, // F#5 (Harmonic body)
          { freq: 880.00, start: 0.08, dur: 1.10, gain: 0.14 }, // A5 (Fifth brightness)
          { freq: 1174.66, start: 0.12, dur: 1.25, gain: 0.09 }, // D6 (Octave chime)
          { freq: 1479.98, start: 0.16, dur: 1.35, gain: 0.05 }, // F#6 (Silky sheen)
        ];

        masterGain.gain.setValueAtTime(0.70, now);

        notes.forEach(({ freq, start, dur, gain }) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          // Warm acoustic lowpass sweep to remove digital sharpness
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(2200, now + start);
          filter.frequency.exponentialRampToValueAtTime(450, now + start + dur);

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + start);

          // Smooth curved attack (zero clicks) & long silky exponential decay
          noteGain.gain.setValueAtTime(0.0001, now + start);
          noteGain.gain.exponentialRampToValueAtTime(gain, now + start + 0.035);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

          osc.connect(filter);
          filter.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(now + start);
          osc.stop(now + start + dur + 0.05);
        });
      } else if (type === "alert") {
        // High priority dignified chime: A5 (880Hz) -> C#6 (1108.7Hz)
        const notes = [
          { freq: 880.00, start: 0.00, dur: 0.60, gain: 0.14 },
          { freq: 1108.73, start: 0.08, dur: 0.95, gain: 0.16 },
        ];

        masterGain.gain.setValueAtTime(0.75, now);

        notes.forEach(({ freq, start, dur, gain }) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(2600, now + start);
          filter.frequency.exponentialRampToValueAtTime(550, now + start + dur);

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + start);

          noteGain.gain.setValueAtTime(0.0001, now + start);
          noteGain.gain.exponentialRampToValueAtTime(gain, now + start + 0.03);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

          osc.connect(filter);
          filter.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(now + start);
          osc.stop(now + start + dur + 0.05);
        });
      } else {
        // Subtle gentle acoustic bell ping
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1800, now);
        filter.frequency.exponentialRampToValueAtTime(400, now + 0.45);

        osc.type = "sine";
        osc.frequency.setValueAtTime(1046.50, now); // C6 bell tone

        noteGain.gain.setValueAtTime(0.0001, now);
        noteGain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        osc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(masterGain);

        osc.start(now);
        osc.stop(now + 0.50);
      }
    } catch {
      // AudioContext blocked or unsupported
    }
  }
}

export const soundEngine = new SoundEngine();

export function playSmoothChime(type: "chime" | "arrival" | "alert" | "subtle" = "chime"): void {
  soundEngine.playSmoothChime(type);
}

/**
 * Universal notification sound player:
 * Combines zero-latency Web Audio API synthesis with an HTML5 Audio element fallback
 * to guarantee acoustic playback across desktop, Android, and iOS PWA environments.
 */
export function playNotificationSound(type: "chime" | "arrival" | "alert" | "subtle" = "chime"): void {
  // 1. Synthesize Fatimi harmonic chime via Web Audio API
  soundEngine.playSmoothChime(type);

  // 2. Play acoustic chime asset as secondary/resilient channel
  if (typeof window !== "undefined") {
    try {
      const audio = new Audio("/notification-chime.wav");
      audio.volume = 0.85;
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Handled gracefully if browser autoplay policy restricts un-interacted audio
        });
      }
    } catch {
      // Audio element not supported or blocked
    }
  }
}

/**
 * Converts a base64 URL string to a Uint8Array for VAPID applicationServerKey.
 */
function urlB64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Automatically subscribes the current device to Web Push notifications if supported and authorized.
 */
export async function ensurePushSubscription(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  if (Notification.permission !== "granted") return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg || !reg.pushManager) return false;

    // Check if device is already subscribed
    let subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      // Fetch VAPID public key from backend
      const res = await fetch("/api/notifications/push/public-key", {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return false;
      const json = await res.json();
      const publicKey = json?.data?.publicKey;
      if (!publicKey) return false;

      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(publicKey) as unknown as BufferSource,
      });
    }

    if (subscription) {
      await fetch("/api/notifications/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      return true;
    }
    return false;
  } catch (err) {
    console.warn("[PWA Push] Failed to register push subscription:", err);
    return false;
  }
}

/**
 * Updates the native PWA App Icon Badge on supported desktop & mobile browsers (Badging API).
 * When count is 0, gracefully clears the badge.
 */
export function updatePwaBadge(count: number): void {
  if (typeof window === "undefined") return;

  // 1. Native Web App Badging API
  try {
    if ("setAppBadge" in navigator) {
      if (count > 0) {
        navigator.setAppBadge(count).catch(() => {});
      } else {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  } catch {
    // Badging API not supported or permissions restricted
  }

  // 2. Service Worker Badging sync (if registered)
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "UPDATE_BADGE",
        badgeCount: Math.max(0, count),
      });
    }
  } catch {}

  // 3. Fallback Dynamic Page Title badge e.g. "(3) Darse Burhani"
  try {
    const rawTitle = document.title.replace(/^\(\d+\+?\)\s*/, "");
    if (count > 0) {
      const badgeStr = count > 99 ? "99+" : count.toString();
      document.title = `(${badgeStr}) ${rawTitle}`;
    } else {
      document.title = rawTitle;
    }
  } catch {}
}

export interface SystemNotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  link?: string;
  soundType?: "chime" | "arrival" | "alert" | "subtle";
  silent?: boolean;
}

/**
 * Requests desktop / OS notification permission from the user.
 * If granted, automatically attempts Web Push registration in the background.
 */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") {
    ensurePushSubscription().catch(() => {});
    return "granted";
  }
  try {
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      ensurePushSubscription().catch(() => {});
    }
    return perm;
  } catch {
    return Notification.permission;
  }
}

/**
 * Sends a native OS / System Notification outside the browser/PWA window
 * into the device's native Notification Center, lock screen, and notification tray,
 * accompanied by the Fatimi bell chime and haptic vibration pattern.
 */
export async function sendDesktopNotification(options: SystemNotificationOptions): Promise<void> {
  const {
    title,
    body,
    icon = "/pwa-192x192.png",
    tag,
    link = "/",
    soundType = "chime",
    silent = false,
  } = options;

  // Unwrap JSON payloads if raw stringified body was supplied
  let cleanBody = body || "";
  if (typeof cleanBody === "string" && cleanBody.trim().startsWith("{") && cleanBody.trim().endsWith("}")) {
    try {
      const parsed = JSON.parse(cleanBody);
      cleanBody = parsed.message || parsed.subject || cleanBody;
    } catch {}
  }

  // 1. Play pristine Fatimi chime sound
  if (!silent) {
    playNotificationSound(soundType);
  }

  // 2. Dispatch OS / System notification outside the window
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "default") {
    const perm = await requestDesktopNotificationPermission();
    if (perm !== "granted") return;
  } else if (Notification.permission !== "granted") {
    return;
  }

  const notificationTag = tag || `darse-${Date.now()}`;
  const notificationOptions: NotificationOptions & Record<string, any> = {
    body: cleanBody,
    icon: icon || "/pwa-192x192.png",
    badge: "/favicon-32x32.png",
    tag: notificationTag,
    vibrate: [300, 100, 300, 100, 400], // Tactile vibration pattern for mobile / PWA outside notification
    renotify: true,
    requireInteraction: false,
    silent: false, // Ensures device OS plays notification sound in notification center
    sound: "/notification-chime.wav",
    data: {
      link: link || "/",
      url: link || "/",
      timestamp: Date.now(),
    },
    actions: [
      { action: "open", title: "Open" },
    ],
  };

  // Primary Path: ServiceWorkerRegistration.showNotification()
  // Required on mobile browsers, Android Chrome, and installed PWAs to display outside the app in the OS tray
  let shownViaSW = false;
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.ready;
      if (registration && "showNotification" in registration) {
        await registration.showNotification(title, notificationOptions);
        shownViaSW = true;
      }
    } catch (swErr) {
      console.warn("[PWA Notification] ServiceWorker showNotification failed, trying fallback:", swErr);
    }
  }

  // Fallback Path: Window-scoped Notification constructor (for desktop environments without active SW)
  if (!shownViaSW) {
    try {
      const notif = new Notification(title, {
        body: cleanBody,
        icon: icon || "/pwa-192x192.png",
        badge: "/favicon-32x32.png",
        tag: notificationTag,
      });

      notif.onclick = (e) => {
        e.preventDefault();
        window.focus();
        if (link && window.location.pathname !== link) {
          window.location.href = link;
        }
        notif.close();
      };
    } catch {
      // Window constructor blocked or restricted
    }
  }
}
