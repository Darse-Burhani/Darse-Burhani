/**
 * Shared design tokens & helpers for the Hifz module.
 * One brand voice across admin / teacher / talabat surfaces.
 */
import { BookOpen, Send, CheckCircle, Globe, AlertTriangle, FileText } from "lucide-react";
import type { ComponentType } from "react";

export const MARHALA_ORDER = ["MARHALA_1", "MARHALA_2", "MARHALA_3", "MARHALA_4", "MARHALA_5"] as const;
export type MarhalaKey = (typeof MARHALA_ORDER)[number];

export const MARHALA_LABELS: Record<string, string> = {
  MARHALA_1: "Marhala 1 · Juz 1–6",
  MARHALA_2: "Marhala 2 · Juz 7–12",
  MARHALA_3: "Marhala 3 · Juz 13–18",
  MARHALA_4: "Marhala 4 · Juz 19–24",
  MARHALA_5: "Marhala 5 · Juz 25–30",
};

/** Arabic marhala names — rendered inside brackets next to the English label, e.g. "Marhala 1 (المرحلة الأولى)" */
export const MARHALA_LABELS_AR: Record<string, string> = {
  MARHALA_1: "المرحلة الأولى",
  MARHALA_2: "المرحلة الثانية",
  MARHALA_3: "المرحلة الثالثة",
  MARHALA_4: "المرحلة الرابعة",
  MARHALA_5: "المرحلة الخامسة",
};

/** English + Arabic combined label: "Marhala 1 · Juz 1–6 (المرحلة الأولى)" */
export const MARHALA_LABELS_BILINGUAL: Record<string, string> = Object.fromEntries(
  Object.keys(MARHALA_LABELS).map((k) => [k, `${MARHALA_LABELS[k]} (${MARHALA_LABELS_AR[k]})`])
);

/** Role names with Arabic in brackets — used across slips, flow map and forms */
export const ROLE_LABELS_AR = {
  MUHAFFIZ: "المُحَفِّظ",
  MUSAID: "المُسَاعِد",
  HAFIZ_TALABT: "حفظ طلبة",
  MARHALA: "المرحلة",
  WEEK: "الأسبوع",
  SABAQ: "سبق",
  SABIQI: "سبقي",
  JADEED: "جديد",
} as const;

/** "Muhaffiz (المُحَفِّظ)" style helper */
export const roleBilingual = (en: string, ar: string) => `${en} (${ar})`;

export const MARHALA_LABELS_SHORT: Record<string, string> = {
  MARHALA_1: "Marhala 1",
  MARHALA_2: "Marhala 2",
  MARHALA_3: "Marhala 3",
  MARHALA_4: "Marhala 4",
  MARHALA_5: "Marhala 5",
};

export interface MarhalaColor {
  grad: string; // gradient classes for badges/avatars e.g. "from-emerald-500 to-teal-600"
  gradCss: string; // raw css for style props
  solid: string;
  soft: string; // soft background
  softBorder: string;
  text: string;
  ring: string; // ring color for active states
  hex: string;
}

export const MARHALA_COLORS: Record<string, MarhalaColor> = {
  MARHALA_1: { grad: "from-emerald-500 to-teal-600", gradCss: "linear-gradient(135deg, #10b981, #0d9488)", solid: "bg-emerald-600", soft: "bg-emerald-50", softBorder: "border-emerald-200", text: "text-emerald-700", ring: "ring-emerald-500", hex: "#059669" },
  MARHALA_2: { grad: "from-blue-500 to-indigo-600", gradCss: "linear-gradient(135deg, #3b82f6, #4f46e5)", solid: "bg-blue-600", soft: "bg-blue-50", softBorder: "border-blue-200", text: "text-blue-700", ring: "ring-blue-500", hex: "#2563eb" },
  MARHALA_3: { grad: "from-violet-500 to-purple-600", gradCss: "linear-gradient(135deg, #8b5cf6, #9333ea)", solid: "bg-violet-600", soft: "bg-violet-50", softBorder: "border-violet-200", text: "text-violet-700", ring: "ring-violet-500", hex: "#7c3aed" },
  MARHALA_4: { grad: "from-amber-500 to-orange-600", gradCss: "linear-gradient(135deg, #f59e0b, #ea580c)", solid: "bg-amber-600", soft: "bg-amber-50", softBorder: "border-amber-200", text: "text-amber-700", ring: "ring-amber-500", hex: "#d97706" },
  MARHALA_5: { grad: "from-rose-500 to-pink-600", gradCss: "linear-gradient(135deg, #f43f5e, #db2777)", solid: "bg-rose-600", soft: "bg-rose-50", softBorder: "border-rose-200", text: "text-rose-700", ring: "ring-rose-500", hex: "#e11d48" },
};

export const marhalaColor = (m?: string | null): MarhalaColor =>
  MARHALA_COLORS[m || ""] || MARHALA_COLORS.MARHALA_1;

// ── Weekly slip statuses (shared shape across admin & teacher) ──
export interface SlipStatusCfg {
  label: string;
  color: string;
  bgColor: string;
  icon: ComponentType<{ className?: string }>;
}

export const SLIP_STATUS: Record<string, SlipStatusCfg> = {
  DRAFT: { label: "Draft", color: "text-slate-600", bgColor: "bg-slate-100", icon: FileText },
  SUBMITTED: { label: "Submitted to Admin", color: "text-blue-700", bgColor: "bg-blue-100", icon: Send },
  APPROVED: { label: "Approved", color: "text-emerald-700", bgColor: "bg-emerald-100", icon: CheckCircle },
  PUBLISHED: { label: "Published to Parents", color: "text-purple-700", bgColor: "bg-purple-100", icon: Globe },
  REJECTED: { label: "Rejected", color: "text-red-700", bgColor: "bg-red-100", icon: AlertTriangle },
};

export const slipStatus = (s?: string | null): SlipStatusCfg =>
  SLIP_STATUS[s || ""] || SLIP_STATUS.DRAFT;

// ── Performance tiers ──
export function perfTier(perf?: number | null): { label: string; color: string; grad: string } {
  const p = perf || 0;
  if (p >= 80) return { label: "Excellent", color: "text-emerald-600", grad: "linear-gradient(90deg, #059669, #34d399)" };
  if (p >= 60) return { label: "Very Good", color: "text-teal-600", grad: "linear-gradient(90deg, #0d9488, #2dd4bf)" };
  if (p >= 40) return { label: "Needs Work", color: "text-amber-600", grad: "linear-gradient(90deg, #d97706, #fbbf24)" };
  return { label: "At Risk", color: "text-red-600", grad: "linear-gradient(90deg, #dc2626, #f87171)" };
}

// ── Full name helper ──
export const fullName = (u?: { firstName?: string; lastName?: string } | null): string =>
  u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() : "";

// ── Icons re-exported so pages don't import lucide twice for the same set ──
export { BookOpen };

// ── Current academic year default (Sep–Aug academic year) ──
export function defaultAcademicYear(now = new Date()): string {
  const y = now.getFullYear();
  const m = now.getMonth();
  const startYear = m >= 8 ? y : y - 1; // academic year flips in September
  return `${startYear}-${startYear + 1}`;
}
