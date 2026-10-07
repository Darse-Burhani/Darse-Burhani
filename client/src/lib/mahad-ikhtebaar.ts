/**
 * Mahad Al-Zahra Hifz & Ikhtebaar Client Helpers
 */

export interface MahadMilestone {
  key: string;
  name: string;
  nameAr: string;
  juzRange: string;
  juzCount: number;
  cumulativeAjza: number;
  cumulativePages: number;
  requiredPages: number;
}

export const MAHAD_IKHTEBAAR_MILESTONES: MahadMilestone[] = [
  {
    key: "SURAH_BALAD",
    name: "Surah Al-Balad",
    nameAr: "سورة البلد إلى الناس",
    juzRange: "Juz 30 (Partial)",
    juzCount: 0.25,
    cumulativeAjza: 0.25,
    cumulativePages: 5,
    requiredPages: 5,
  },
  {
    key: "SURAH_INSHIQAQ",
    name: "Surah Al-Inshiqaq",
    nameAr: "سورة الانشقاق إلى الناس",
    juzRange: "Juz 30 (Half)",
    juzCount: 0.5,
    cumulativeAjza: 0.5,
    cumulativePages: 10,
    requiredPages: 10,
  },
  {
    key: "JUZ_AMMA",
    name: "Juz Amma Complete",
    nameAr: "المرحلة الثالثة - جزء عم",
    juzRange: "Juz 30 (Complete)",
    juzCount: 1,
    cumulativeAjza: 1,
    cumulativePages: 20,
    requiredPages: 20,
  },
  {
    key: "MARHALA_4",
    name: "Marhala 4",
    nameAr: "المرحلة الرابعة (الأجزاء ٢٥-٢٩)",
    juzRange: "Juz 25–29",
    juzCount: 5,
    cumulativeAjza: 6,
    cumulativePages: 120,
    requiredPages: 100,
  },
  {
    key: "MARHALA_5",
    name: "Marhala 5",
    nameAr: "المرحلة الخامسة (الأجزاء ٢٠-٢٤)",
    juzRange: "Juz 20–24",
    juzCount: 5,
    cumulativeAjza: 11,
    cumulativePages: 220,
    requiredPages: 100,
  },
  {
    key: "MARHALA_6",
    name: "Marhala 6",
    nameAr: "المرحلة السادسة (الأجزاء ١٥-١٩)",
    juzRange: "Juz 15–19",
    juzCount: 5,
    cumulativeAjza: 16,
    cumulativePages: 320,
    requiredPages: 100,
  },
  {
    key: "MARHALA_7",
    name: "Marhala 7",
    nameAr: "المرحلة السابعة (الأجزاء ٨-١٤)",
    juzRange: "Juz 8–14",
    juzCount: 7,
    cumulativeAjza: 23,
    cumulativePages: 460,
    requiredPages: 140,
  },
  {
    key: "MARHALA_8",
    name: "Marhala 8 · Full Quran",
    nameAr: "المرحلة الثامنة - الختم المبارك",
    juzRange: "Juz 1–7",
    juzCount: 7,
    cumulativeAjza: 30,
    cumulativePages: 604,
    requiredPages: 144,
  },
];

export const TOTAL_QURAN_PAGES = 604;
export const TOTAL_QURAN_AJZA = 30;

export const RATING_BADGES: Record<string, { label: string; labelAr: string; color: string; bg: string }> = {
  MUMTAZ: { label: "Mumtaz (Excellent)", labelAr: "ممتاز", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  JAYYID_JIDDAN: { label: "Jayyid Jiddan (Very Good)", labelAr: "جيد جدا", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  JAYYID: { label: "Jayyid (Good)", labelAr: "جيد", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  MAQBOOL: { label: "Maqbool (Pass)", labelAr: "مقبول", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  DAEEF: { label: "Daeef (Needs Focus)", labelAr: "ضعيف", color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
  ABSENT: { label: "Ghaib (Absent)", labelAr: "غائب", color: "text-slate-600", bg: "bg-slate-100 border-slate-200" },
};
