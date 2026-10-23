/**
 * TableMaster Theme & Deterministic Subject Color Palette
 * Provides rich, high-contrast, accessible color tokens for every academic and religious subject in Darse Burhani.
 */

export interface SubjectTheme {
  id: string;
  name: string;
  bgLight: string;
  bgGradient: string;
  border: string;
  text: string;
  badge: string;
  dot: string;
  accent: string;
}

export const SUBJECT_PALETTE: Record<string, SubjectTheme> = {
  // Religious & Classical Texts
  "quran hifz": {
    id: "quran-hifz",
    name: "Quran Hifz",
    bgLight: "bg-emerald-50/90",
    bgGradient: "from-emerald-50 via-emerald-100/40 to-teal-50",
    border: "border-emerald-300",
    text: "text-emerald-950",
    badge: "bg-emerald-600 text-white",
    dot: "bg-emerald-500",
    accent: "#ef9a33",
  },
  quran: {
    id: "quran",
    name: "Quran",
    bgLight: "bg-emerald-50/90",
    bgGradient: "from-emerald-50 via-emerald-100/40 to-teal-50",
    border: "border-emerald-300",
    text: "text-emerald-950",
    badge: "bg-emerald-600 text-white",
    dot: "bg-emerald-500",
    accent: "#ef9a33",
  },
  qasaid: {
    id: "qasaid",
    name: "Qasaid",
    bgLight: "bg-rose-50/90",
    bgGradient: "from-rose-50 via-rose-100/40 to-pink-50",
    border: "border-rose-300",
    text: "text-rose-950",
    badge: "bg-rose-600 text-white",
    dot: "bg-rose-500",
    accent: "#e11d48",
  },
  "daim al-islam": {
    id: "daim-al-islam",
    name: "Daim al-Islam",
    bgLight: "bg-amber-50/90",
    bgGradient: "from-amber-50 via-amber-100/40 to-yellow-50",
    border: "border-amber-300",
    text: "text-amber-950",
    badge: "bg-amber-600 text-slate-950",
    dot: "bg-amber-500",
    accent: "#d97706",
  },
  "sharhal akhbar": {
    id: "sharhal-akhbar",
    name: "Sharhal akhbar",
    bgLight: "bg-indigo-50/90",
    bgGradient: "from-indigo-50 via-indigo-100/40 to-blue-50",
    border: "border-indigo-300",
    text: "text-indigo-950",
    badge: "bg-indigo-600 text-white",
    dot: "bg-indigo-500",
    accent: "#4f46e5",
  },
  "kitab al-taharat": {
    id: "kitab-al-taharat",
    name: "Kitab al-Taharat",
    bgLight: "bg-teal-50/90",
    bgGradient: "from-teal-50 via-teal-100/40 to-cyan-50",
    border: "border-teal-300",
    text: "text-teal-950",
    badge: "bg-teal-600 text-white",
    dot: "bg-teal-500",
    accent: "#ef9a33",
  },
  "kitab al-iqtisar": {
    id: "kitab-al-iqtisar",
    name: "Kitab al-Iqtisar",
    bgLight: "bg-cyan-50/90",
    bgGradient: "from-cyan-50 via-cyan-100/40 to-sky-50",
    border: "border-cyan-300",
    text: "text-cyan-950",
    badge: "bg-cyan-600 text-white",
    dot: "bg-cyan-500",
    accent: "#0891b2",
  },
  "mukhtasar al-asar": {
    id: "mukhtasar-al-asar",
    name: "Mukhtasar al-Asar",
    bgLight: "bg-blue-50/90",
    bgGradient: "from-blue-50 via-blue-100/40 to-indigo-50",
    border: "border-blue-300",
    text: "text-blue-950",
    badge: "bg-blue-600 text-white",
    dot: "bg-blue-500",
    accent: "#2563eb",
  },
  "muntaza al-akhbar": {
    id: "muntaza-al-akhbar",
    name: "Muntaza al-Akhbar",
    bgLight: "bg-purple-50/90",
    bgGradient: "from-purple-50 via-purple-100/40 to-violet-50",
    border: "border-purple-300",
    text: "text-purple-950",
    badge: "bg-purple-600 text-white",
    dot: "bg-purple-500",
    accent: "#9333ea",
  },
  "raudat hidayat": {
    id: "raudat-hidayat",
    name: "Raudat Hidayat",
    bgLight: "bg-pink-50/90",
    bgGradient: "from-pink-50 via-pink-100/40 to-rose-50",
    border: "border-pink-300",
    text: "text-pink-950",
    badge: "bg-pink-600 text-white",
    dot: "bg-pink-500",
    accent: "#db2777",
  },
  "dirasat uloom il-quran": {
    id: "dirasat-uloom-il-quran",
    name: "Dirasat Uloom il-Quran",
    bgLight: "bg-emerald-50/90",
    bgGradient: "from-emerald-50 via-teal-100/40 to-green-50",
    border: "border-emerald-400",
    text: "text-emerald-950",
    badge: "bg-emerald-700 text-white",
    dot: "bg-emerald-600",
    accent: "#b8541e",
  },

  // Language & Expression
  "lisan arabi": {
    id: "lisan-arabi",
    name: "Lisan Arabi",
    bgLight: "bg-violet-50/90",
    bgGradient: "from-violet-50 via-violet-100/40 to-purple-50",
    border: "border-violet-300",
    text: "text-violet-950",
    badge: "bg-violet-600 text-white",
    dot: "bg-violet-500",
    accent: "#7c3aed",
  },
  "lisan ud dawat": {
    id: "lisan-ud-dawat",
    name: "Lisan ud Dawat",
    bgLight: "bg-fuchsia-50/90",
    bgGradient: "from-fuchsia-50 via-fuchsia-100/40 to-pink-50",
    border: "border-fuchsia-300",
    text: "text-fuchsia-950",
    badge: "bg-fuchsia-600 text-white",
    dot: "bg-fuchsia-500",
    accent: "#c026d3",
  },
  tamreen: {
    id: "tamreen",
    name: "Tamreen",
    bgLight: "bg-orange-50/90",
    bgGradient: "from-orange-50 via-orange-100/40 to-amber-50",
    border: "border-orange-300",
    text: "text-orange-950",
    badge: "bg-orange-600 text-white",
    dot: "bg-orange-500",
    accent: "#ea580c",
  },
  tadreeb: {
    id: "tadreeb",
    name: "Tadreeb",
    bgLight: "bg-sky-50/90",
    bgGradient: "from-sky-50 via-sky-100/40 to-cyan-50",
    border: "border-sky-300",
    text: "text-sky-950",
    badge: "bg-sky-600 text-white",
    dot: "bg-sky-500",
    accent: "#0284c7",
  },
  insha: {
    id: "insha",
    name: "Insha",
    bgLight: "bg-purple-50/90",
    bgGradient: "from-purple-50 via-fuchsia-100/40 to-pink-50",
    border: "border-purple-300",
    text: "text-purple-950",
    badge: "bg-purple-700 text-white",
    dot: "bg-purple-600",
    accent: "#7e22ce",
  },

  // Modern & General Academics
  science: {
    id: "science",
    name: "Science",
    bgLight: "bg-lime-50/90",
    bgGradient: "from-lime-50 via-lime-100/40 to-emerald-50",
    border: "border-lime-300",
    text: "text-lime-950",
    badge: "bg-lime-600 text-slate-950 font-bold",
    dot: "bg-lime-500",
    accent: "#dc6b27",
  },
  maths: {
    id: "maths",
    name: "Maths",
    bgLight: "bg-blue-50/90",
    bgGradient: "from-blue-50 via-blue-100/40 to-sky-50",
    border: "border-blue-300",
    text: "text-blue-950",
    badge: "bg-blue-600 text-white",
    dot: "bg-blue-500",
    accent: "#2563eb",
  },
  physics: {
    id: "physics",
    name: "Physics",
    bgLight: "bg-sky-50/90",
    bgGradient: "from-sky-50 via-indigo-100/40 to-blue-50",
    border: "border-sky-300",
    text: "text-sky-950",
    badge: "bg-sky-700 text-white",
    dot: "bg-sky-500",
    accent: "#0369a1",
  },
  chemistry: {
    id: "chemistry",
    name: "Chemistry",
    bgLight: "bg-rose-50/90",
    bgGradient: "from-rose-50 via-pink-100/40 to-red-50",
    border: "border-rose-300",
    text: "text-rose-950",
    badge: "bg-rose-600 text-white",
    dot: "bg-rose-500",
    accent: "#e11d48",
  },
  biology: {
    id: "biology",
    name: "Biology",
    bgLight: "bg-emerald-50/90",
    bgGradient: "from-emerald-50 via-green-100/40 to-lime-50",
    border: "border-emerald-300",
    text: "text-emerald-950",
    badge: "bg-emerald-700 text-white",
    dot: "bg-emerald-500",
    accent: "#b8541e",
  },
  english: {
    id: "english",
    name: "English",
    bgLight: "bg-slate-50/90",
    bgGradient: "from-slate-50 via-slate-100/50 to-zinc-50",
    border: "border-slate-300",
    text: "text-slate-900",
    badge: "bg-slate-700 text-white",
    dot: "bg-slate-500",
    accent: "#475569",
  },
  geography: {
    id: "geography",
    name: "Geography",
    bgLight: "bg-amber-50/90",
    bgGradient: "from-amber-50 via-yellow-100/40 to-orange-50",
    border: "border-amber-300",
    text: "text-amber-950",
    badge: "bg-amber-600 text-white",
    dot: "bg-amber-500",
    accent: "#d97706",
  },
  "hist/civ": {
    id: "hist-civ",
    name: "Hist/Civ",
    bgLight: "bg-orange-50/90",
    bgGradient: "from-orange-50 via-red-100/40 to-rose-50",
    border: "border-orange-300",
    text: "text-orange-950",
    badge: "bg-orange-700 text-white",
    dot: "bg-orange-500",
    accent: "#c2410c",
  },
  break: {
    id: "break",
    name: "Break",
    bgLight: "bg-slate-100/80",
    bgGradient: "from-slate-100 to-slate-200/60",
    border: "border-slate-300 border-dashed",
    text: "text-slate-700",
    badge: "bg-slate-400 text-slate-950 font-bold",
    dot: "bg-slate-400",
    accent: "#64748b",
  },
};

/**
 * Deterministically resolve a subject theme by name
 */
export function getSubjectTheme(rawName: string = ""): SubjectTheme {
  const normalized = rawName.toLowerCase().trim();

  // Direct lookup
  if (SUBJECT_PALETTE[normalized]) {
    return SUBJECT_PALETTE[normalized];
  }

  // Substring match
  for (const [key, theme] of Object.entries(SUBJECT_PALETTE)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return theme;
    }
  }

  // Deterministic fallback based on string hash
  const fallbacks = [
    {
      bgLight: "bg-teal-50/90",
      bgGradient: "from-teal-50 via-emerald-100/30 to-slate-50",
      border: "border-teal-300",
      text: "text-teal-950",
      badge: "bg-teal-600 text-white",
      dot: "bg-teal-500",
      accent: "#ef9a33",
    },
    {
      bgLight: "bg-indigo-50/90",
      bgGradient: "from-indigo-50 via-blue-100/30 to-slate-50",
      border: "border-indigo-300",
      text: "text-indigo-950",
      badge: "bg-indigo-600 text-white",
      dot: "bg-indigo-500",
      accent: "#4f46e5",
    },
    {
      bgLight: "bg-amber-50/90",
      bgGradient: "from-amber-50 via-yellow-100/30 to-slate-50",
      border: "border-amber-300",
      text: "text-amber-950",
      badge: "bg-amber-600 text-white",
      dot: "bg-amber-500",
      accent: "#d97706",
    },
    {
      bgLight: "bg-rose-50/90",
      bgGradient: "from-rose-50 via-pink-100/30 to-slate-50",
      border: "border-rose-300",
      text: "text-rose-950",
      badge: "bg-rose-600 text-white",
      dot: "bg-rose-500",
      accent: "#e11d48",
    },
    {
      bgLight: "bg-purple-50/90",
      bgGradient: "from-purple-50 via-violet-100/30 to-slate-50",
      border: "border-purple-300",
      text: "text-purple-950",
      badge: "bg-purple-600 text-white",
      dot: "bg-purple-500",
      accent: "#9333ea",
    },
  ];

  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const chosen = fallbacks[Math.abs(hash) % fallbacks.length];

  return {
    id: normalized.replace(/\s+/g, "-"),
    name: rawName || "Lesson",
    ...chosen,
  };
}
