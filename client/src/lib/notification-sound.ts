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
 */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "denied";
  }
  if (Notification.permission === "granted") {
    return "granted";
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

/**
 * Sends a native Desktop/OS Notification outside the browser window accompanied by the subtle Fatimi chime.
 */
export function sendDesktopNotification(options: SystemNotificationOptions): void {
  const { title, body, icon = "/logo.png", tag, link, soundType = "chime", silent = false } = options;

  // 1. Play smooth harmonic Fatimi chime
  if (!silent) {
    soundEngine.playSmoothChime(soundType);
  }

  // 2. Dispatch OS / Desktop notification
  if (typeof window === "undefined" || !("Notification" in window)) return;

  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        body,
        icon,
        badge: "/favicon-32x32.png",
        tag: tag || `darse-${Date.now()}`,
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
      // Fallback if Notification constructor fails
    }
  } else if (Notification.permission === "default") {
    requestDesktopNotificationPermission().then((perm) => {
      if (perm === "granted") {
        sendDesktopNotification({ ...options, silent: true });
      }
    });
  }
}
