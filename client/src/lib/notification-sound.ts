/**
 * Smooth, high-fidelity notification sound generator and Desktop Push helper.
 * Uses Web Audio API for 0ms latency, artifact-free, warm harmonic bell chimes.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
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
   * Plays a smooth, silky multi-harmonic bell chime (similar to Apple iOS notification).
   */
  public playSmoothChime(type: "chime" | "arrival" | "alert" | "subtle" = "chime"): void {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);

      if (type === "arrival" || type === "chime") {
        // Multi-tone warm bell: D5 (587.33Hz) -> F#5 (739.99Hz) -> A5 (880Hz)
        const notes = [
          { freq: 587.33, start: 0.00, dur: 0.55, gain: 0.14 },
          { freq: 739.99, start: 0.07, dur: 0.65, gain: 0.16 },
          { freq: 880.00, start: 0.14, dur: 0.85, gain: 0.20 },
          { freq: 1174.66, start: 0.22, dur: 1.10, gain: 0.12 }, // D6 overtone
        ];

        masterGain.gain.setValueAtTime(0.85, now);

        notes.forEach(({ freq, start, dur, gain }) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          // Warm lowpass filter to remove digital sharpness
          filter.type = "lowpass";
          filter.frequency.setValueAtTime(2400, now + start);
          filter.frequency.exponentialRampToValueAtTime(600, now + start + dur);

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + start);

          // Soft attack, smooth exponential decay
          noteGain.gain.setValueAtTime(0.0001, now + start);
          noteGain.gain.exponentialRampToValueAtTime(gain, now + start + 0.025);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

          osc.connect(filter);
          filter.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(now + start);
          osc.stop(now + start + dur + 0.05);
        });
      } else if (type === "alert") {
        // High priority alert: A5 (880Hz) -> C#6 (1108.73Hz)
        const notes = [
          { freq: 880.00, start: 0.00, dur: 0.40, gain: 0.18 },
          { freq: 1108.73, start: 0.10, dur: 0.70, gain: 0.22 },
        ];

        notes.forEach(({ freq, start, dur, gain }) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now + start);

          noteGain.gain.setValueAtTime(0.0001, now + start);
          noteGain.gain.exponentialRampToValueAtTime(gain, now + start + 0.02);
          noteGain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

          osc.connect(noteGain);
          noteGain.connect(masterGain);

          osc.start(now + start);
          osc.stop(now + start + dur + 0.05);
        });
      } else {
        // Subtle tick/ping
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(783.99, now);
        noteGain.gain.setValueAtTime(0.001, now);
        noteGain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.4);
      }
    } catch {
      // AudioContext blocked or unsupported
    }
  }
}

export const soundEngine = new SoundEngine();

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
 * Sends a native Desktop/OS Notification outside the browser window accompanied by a smooth sound.
 */
export function sendDesktopNotification(options: SystemNotificationOptions): void {
  const { title, body, icon = "/logo.png", tag, link, soundType = "chime", silent = false } = options;

  // 1. Play smooth harmonic chime
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
        badge: "/favicon.ico",
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
