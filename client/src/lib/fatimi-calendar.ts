/**
 * Fatimi Calendar Library (Client-Side)
 *
 * Implements the tabular Islamic (Hijri) calendar used by the Dawoodi Bohra community.
 * Based on the 30-year astronomical cycle with 11 leap years per cycle.
 *
 * Month Pattern:
 *   Month 1:  Muharram al-Haram (30 days)
 *   Month 2:  Safar al-Muzaffar (29 days)
 *   Month 3:  Rabi al-Awwal (30 days)
 *   Month 4:  Rabi al-Akhir / Rabi ul Akhar (29 days) -> Concluded
 *   Month 5:  Jumada al-Ula / Jamadil Ula (30 days)   -> Active / New Records
 *   Month 6:  Jumada al-Akhirah (29 days)
 *   Month 7:  Rajab al-Asab (30 days)
 *   Month 8:  Shaban al-Karim (29 days)
 *   Month 9:  Ramadan al-Moazzam (30 days)
 *   Month 10: Shawwal al-Mukarram (29 days)
 *   Month 11: Dhu al-Qadah (30 days)
 *   Month 12: Dhu al-Hijjah (29 days common / 30 leap)
 */

export const HIJRI_EPOCH_JULIAN_DAY = 1948438; // Fatimi astronomical (Misri) epoch: July 15, 622 CE (Julian day 1948438)

export interface HijriMonthMeta {
  index: number;
  en: string;
  ar: string;
  short: string;
  days: number;
}

export const HIJRI_MONTHS: HijriMonthMeta[] = [
  { index: 1, en: "Muḥarram al-Ḥarām", ar: "المحرّم", short: "Muharram", days: 30 },
  { index: 2, en: "Ṣafar al-Muẓaffar", ar: "صفر", short: "Safar", days: 29 },
  { index: 3, en: "Rabīʿ al-Awwal", ar: "ربيع الأوّل", short: "Rabi I", days: 30 },
  { index: 4, en: "Rabīʿ al-Ākhir", ar: "ربيع الآخر", short: "Rabi II", days: 29 }, // Rabi ul Akhar
  { index: 5, en: "Jumādā al-Ūlā", ar: "جمادى الأولى", short: "Jumada I", days: 30 }, // Jamadil Ula
  { index: 6, en: "Jumādā al-Ākhirah", ar: "جمادى الآخرة", short: "Jumada II", days: 29 },
  { index: 7, en: "Rajab al-Murajjab", ar: "رجب", short: "Rajab", days: 30 },
  { index: 8, en: "Shaʿbān al-Muʿaẓẓam", ar: "شعبان", short: "Shaban", days: 29 },
  { index: 9, en: "Ramaḍān al-Muʿaẓẓam", ar: "رمضان", short: "Ramadan", days: 30 },
  { index: 10, en: "Shawwāl", ar: "شوّال", short: "Shawwal", days: 29 },
  { index: 11, en: "Dhū al-Qaʿdah", ar: "ذو القعدة", short: "Dhu al-Qa'dah", days: 30 },
  { index: 12, en: "Dhū al-Ḥijjah", ar: "ذو الحجّة", short: "Dhu al-Hijjah", days: 29 },
];

const LEAP_YEARS = new Set([2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29]);
const MONTH_DAYS_COMMON = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
const MONTH_DAYS_LEAP = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30];

export function isHijriLeapYear(year: number): boolean {
  return LEAP_YEARS.has(year % 30);
}

export function getDaysInHijriMonth(year: number, month: number): number {
  const isLeap = isHijriLeapYear(year);
  const monthDays = isLeap ? MONTH_DAYS_LEAP : MONTH_DAYS_COMMON;
  return monthDays[month - 1] || 30;
}

export function getDaysInHijriYear(year: number): number {
  return isHijriLeapYear(year) ? 355 : 354;
}

export function hijriToJulianDay(year: number, month: number, day: number): number {
  const cycleYears = Math.floor((year - 1) / 30);
  const yearInCycle = (year - 1) % 30;

  let totalDays = cycleYears * (30 * 354 + 11);

  for (let y = 1; y <= yearInCycle; y++) {
    totalDays += isHijriLeapYear(y) ? 355 : 354;
  }

  for (let m = 1; m < month; m++) {
    totalDays += getDaysInHijriMonth(year, m);
  }

  totalDays += day - 1;
  return HIJRI_EPOCH_JULIAN_DAY + totalDays;
}

export function julianDayToGregorian(jd: number): { year: number; month: number; day: number } {
  const Z = Math.floor(jd + 0.5);
  let A = Z;
  if (Z >= 2299161) {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);

  const day = B - D - Math.floor(30.6001 * E);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;

  return { year, month, day };
}

export function gregorianToJulianDay(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;

  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

export function julianDayToHijri(jd: number): { year: number; month: number; day: number } {
  const days = Math.floor(jd) - HIJRI_EPOCH_JULIAN_DAY;

  if (days < 0) {
    return { year: 1, month: 1, day: 1 };
  }

  let year = 1;
  let remainingDays = days;

  while (true) {
    const yearDays = getDaysInHijriYear(year);
    if (remainingDays < yearDays) break;
    remainingDays -= yearDays;
    year++;
  }

  let month = 1;
  for (let m = 1; m <= 12; m++) {
    const monthDays = getDaysInHijriMonth(year, m);
    if (remainingDays < monthDays) {
      month = m;
      break;
    }
    remainingDays -= monthDays;
    month = m;
  }

  return { year, month, day: remainingDays + 1 };
}

export interface HijriDateDetails {
  year: number;
  month: number;
  day: number;
  monthName: string;
  monthNameAr: string;
  monthNameShort: string;
  formatted: string;
  formattedAr: string;
  isJumadaAlUla: boolean; // Month 5 (Active new records)
  isRabiAlAkhir: boolean; // Month 4 (Concluded)
  isCurrentRecordTier: "NEW_RECORDS_JUMADA_ULA" | "CONCLUDED_RABI_AKHIR" | "OTHER";
  gregorianStr: string;
}

/**
 * Convert any Gregorian date string ("YYYY-MM-DD" or ISO) or Date to full Fatimi Hijri details.
 */
export function getHijriFromDate(inputDate?: Date | string | null): HijriDateDetails {
  let year: number;
  let month: number;
  let day: number;

  if (typeof inputDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(inputDate)) {
    const parts = inputDate.slice(0, 10).split("-").map(Number);
    year = parts[0];
    month = parts[1];
    day = parts[2];
  } else {
    const targetDate = inputDate instanceof Date && !Number.isNaN(inputDate.getTime()) ? inputDate : new Date();
    // Parse in Indian Standard Time (Asia/Kolkata) to avoid UTC midnight backward shift
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(targetDate);
    year = Number(parts.find((p) => p.type === "year")?.value || targetDate.getFullYear());
    month = Number(parts.find((p) => p.type === "month")?.value || targetDate.getMonth() + 1);
    day = Number(parts.find((p) => p.type === "day")?.value || targetDate.getDate());
  }

  const jd = gregorianToJulianDay(year, month, day);
  const hijri = julianDayToHijri(jd);
  const mMeta = HIJRI_MONTHS[hijri.month - 1] || HIJRI_MONTHS[0];

  const isJumadaAlUla = hijri.month === 5;
  const isRabiAlAkhir = hijri.month === 4;

  const isCurrentRecordTier = isJumadaAlUla
    ? "NEW_RECORDS_JUMADA_ULA"
    : isRabiAlAkhir
    ? "CONCLUDED_RABI_AKHIR"
    : "OTHER";

  const pad = (n: number) => String(n).padStart(2, "0");
  const gregorianStr = `${year}-${pad(month)}-${pad(day)}`;

  return {
    year: hijri.year,
    month: hijri.month,
    day: hijri.day,
    monthName: mMeta.en,
    monthNameAr: mMeta.ar,
    monthNameShort: mMeta.short,
    formatted: `${hijri.day} ${mMeta.en} ${hijri.year}H`,
    formattedAr: `${hijri.day} ${mMeta.ar} ${hijri.year}هـ`,
    isJumadaAlUla,
    isRabiAlAkhir,
    isCurrentRecordTier,
    gregorianStr,
  };
}

/**
 * Calculate Gregorian date range for a given Hijri month.
 */
export function getHijriMonthGregorianRange(year: number, month: number): {
  startDateStr: string;
  endDateStr: string;
  daysCount: number;
  monthName: string;
  monthNameAr: string;
} {
  const daysInMonth = getDaysInHijriMonth(year, month);
  const jdStart = hijriToJulianDay(year, month, 1);
  const jdEnd = hijriToJulianDay(year, month, daysInMonth);

  const gStart = julianDayToGregorian(jdStart);
  const gEnd = julianDayToGregorian(jdEnd);

  const pad = (n: number) => String(n).padStart(2, "0");
  const startDateStr = `${gStart.year}-${pad(gStart.month)}-${pad(gStart.day)}`;
  const endDateStr = `${gEnd.year}-${pad(gEnd.month)}-${pad(gEnd.day)}`;

  const meta = HIJRI_MONTHS[month - 1] || HIJRI_MONTHS[0];

  return {
    startDateStr,
    endDateStr,
    daysCount: daysInMonth,
    monthName: meta.en,
    monthNameAr: meta.ar,
  };
}

/**
 * Key milestone months for the current academic session (1448 H)
 */
export const HIJRI_1448_MILESTONES = {
  RABI_AL_AKHIR: {
    year: 1448,
    month: 4,
    name: "Rabīʿ al-Ākhir",
    nameAr: "ربيع الآخر",
    status: "ENDED" as const,
    label: "Rabīʿ al-Ākhir (Concluded Records)",
    range: getHijriMonthGregorianRange(1448, 4), // 2026-09-12 to 2026-10-10
  },
  JUMADA_AL_ULA: {
    year: 1448,
    month: 5,
    name: "Jumādā al-Ūlā",
    nameAr: "جمادى الأولى",
    status: "ACTIVE_NEW_RECORDS" as const,
    label: "Jumādā al-Ūlā (Active / New Records 🌟)",
    range: getHijriMonthGregorianRange(1448, 5), // 2026-10-11 to 2026-11-09
  },
};

/**
 * Check if a date (Date object or string) falls within Fatimi Hijri month 4 (Rabīʿ al-Ākhir / Rabi ul Akhar).
 */
export function isRabiAlAkhirDate(inputDate?: Date | string | null): boolean {
  if (!inputDate) return false;
  return getHijriFromDate(inputDate).isRabiAlAkhir;
}

