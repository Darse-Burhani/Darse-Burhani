import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

export function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return `${formatDate(d)} at ${formatTime(d)}`;
}

export function formatPoints(points: number): string {
  if (points >= 1000) {
    return `${(points / 1000).toFixed(1)}k`;
  }
  return points.toString();
}

export function getTierColor(tier: string): string {
  const tierColors: Record<string, string> = {
    BRONZE: "#cd7f32",
    SILVER: "#c0c0c0",
    GOLD: "#ffd700",
    PLATINUM: "#e5e4e2",
    DIAMOND: "#b9f2ff",
  };
  return tierColors[tier?.toUpperCase()] ?? "#cd7f32";
}

export function getTierStyle(tier: string): {
  bg: string;
  border: string;
  text: string;
  glow: string;
  gradient: string;
} {
  switch (tier?.toUpperCase()) {
    case "DIAMOND":
      return {
        bg: "bg-cyan-500/10 dark:bg-cyan-950/40",
        border: "border-cyan-400/40",
        text: "text-cyan-400",
        glow: "shadow-[0_0_15px_rgba(6,182,212,0.35)]",
        gradient: "from-cyan-400 via-sky-300 to-blue-500",
      };
    case "PLATINUM":
      return {
        bg: "bg-slate-300/10 dark:bg-slate-800/50",
        border: "border-slate-300/40",
        text: "text-slate-200",
        glow: "shadow-[0_0_12px_rgba(226,232,240,0.25)]",
        gradient: "from-slate-200 via-gray-100 to-slate-400",
      };
    case "GOLD":
      return {
        bg: "bg-amber-500/10 dark:bg-amber-950/40",
        border: "border-amber-400/40",
        text: "text-amber-400",
        glow: "shadow-[0_0_15px_rgba(251,191,36,0.3)]",
        gradient: "from-amber-300 via-yellow-400 to-amber-600",
      };
    case "SILVER":
      return {
        bg: "bg-zinc-400/10 dark:bg-zinc-800/40",
        border: "border-zinc-400/30",
        text: "text-zinc-300",
        glow: "shadow-[0_0_10px_rgba(212,212,216,0.2)]",
        gradient: "from-zinc-300 via-zinc-200 to-zinc-400",
      };
    default: // BRONZE
      return {
        bg: "bg-orange-950/20",
        border: "border-amber-700/40",
        text: "text-amber-600 dark:text-amber-500",
        glow: "shadow-[0_0_10px_rgba(180,83,9,0.2)]",
        gradient: "from-amber-600 via-amber-700 to-yellow-800",
      };
  }
}

export function getTierFromPoints(points: number): string {
  if (points >= 5000) return "DIAMOND";
  if (points >= 2500) return "PLATINUM";
  if (points >= 1000) return "GOLD";
  if (points >= 500) return "SILVER";
  return "BRONZE";
}

export function formatSmartTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 45) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;

  const isToday = now.toDateString() === d.toDateString();
  const isYesterday =
    new Date(now.getTime() - 86400000).toDateString() === d.toDateString();

  if (isToday) return `Today at ${formatTime(d)}`;
  if (isYesterday) return `Yesterday at ${formatTime(d)}`;
  return formatDateTime(d);
}

export function isArabic(text?: string | null): boolean {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

export function calculateProgress(current: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
}


export function getInitials(firstName?: string | null, lastName?: string | null): string {
  const f = (firstName || "").trim().charAt(0);
  const l = (lastName || "").trim().charAt(0);
  return (f + l).toUpperCase() || "?";
}

export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${timestamp}${random}`;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function truncate(str: string, length: number): string {
  if (!str) return "";
  if (str.length <= length) return str;
  return `${str.substring(0, length)}...`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "";
  const now = new Date();
  const past = new Date(date);
  if (isNaN(past.getTime())) return "";
  const diffMs = now.getTime() - past.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(past);
}
