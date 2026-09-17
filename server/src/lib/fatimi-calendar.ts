/**
 * Fatimi Calendar Library
 * 
 * Implements the tabular Islamic (Hijri) calendar used by the Dawoodi Bohra community.
 * Based on the 30-year cycle with 11 leap years per cycle.
 * 
 * The Fatimi calendar follows the astronomical tradition of the Fatimid Caliphate,
 * using fixed month lengths rather than physical moon sighting.
 * 
 * Month pattern:
 *   Odd months (1,3,5,7,9,11) = 30 days
 *   Even months (2,4,6,8,10) = 29 days
 *   Month 12 (Dhu al-Hijjah) = 30 days in leap years, 29 in common years
 */

// ── Hijri Calendar Constants ──

/** Hijri epoch: 1 Muharram 1 AH = July 16, 622 CE (Julian) */
const HIJRI_EPOCH_JULIAN_DAY = 1948439.5; // Julian Day Number for July 16, 622 CE

/** Month names in Arabic with English transliteration and honorific suffixes */
export const HIJRI_MONTHS = [
  { ar: "المحرّم", en: "Muḥarram al-Ḥarām", short: "Muharram" },
  { ar: "صفر", en: "Ṣafar al-Muẓaffar", short: "Safar" },
  { ar: "ربيع الأوّل", en: "Rabīʿ al-Awwal", short: "Rabi I" },
  { ar: "ربيع الآخر", en: "Rabīʿ al-Ākhir", short: "Rabi II" },
  { ar: "جمادى الأولى", en: "Jumādā al-Ūlā", short: "Jumada I" },
  { ar: "جمادى الآخرة", en: "Jumādā al-Ākhirah", short: "Jumada II" },
  { ar: "رجب", en: "Rajab al-Murajjab", short: "Rajab" },
  { ar: "شعبان", en: "Shaʿbān al-Muʿaẓẓam", short: "Shaban" },
  { ar: "رمضان", en: "Ramaḍān al-Muʿaẓẓam", short: "Ramadan" },
  { ar: "شوّال", en: "Shawwāl", short: "Shawwal" },
  { ar: "ذو القعدة", en: "Dhū al-Qaʿdah", short: "Dhu al-Qa'dah" },
  { ar: "ذو الحجّة", en: "Dhū al-Ḥijjah", short: "Dhu al-Hijjah" },
];

/** Leap years in the 30-year cycle (1-indexed year within cycle) */
const LEAP_YEARS = new Set([2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29]);

/** Standard month day counts: odd=30, even=29 */
const MONTH_DAYS_COMMON = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
const MONTH_DAYS_LEAP = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30];

// ── Significant Dawoodi Bohra Religious Events ──

export interface FatimiEvent {
  month: number;   // 1-12 (Hijri month)
  day: number;     // 1-30
  day2?: number;   // Optional end day for multi-day events
  name: string;
  nameAr?: string;
  type: "milad" | "urs" | "eid" | "commemoration" | "fast" | "observance";
  description?: string;
}

export const SIGNIFICANT_EVENTS: FatimiEvent[] = [
  // ── Muharram al-Haraam (1) ──
  { month: 1, day: 1, name: "Ra's al-Sanah al-Hijriyyah", nameAr: "رأس السنة الهجرية", type: "observance", description: "Islamic New Year" },
  { month: 1, day: 1, day2: 10, name: "Ashara Mubaraka", nameAr: "عشرة مباركة", type: "commemoration", description: "Ten days of mourning for Imam Husain" },
  { month: 1, day: 10, name: "Yawm al-Ashura", nameAr: "يوم عاشوراء", type: "commemoration", description: "Martyrdom of Imam Husain at Karbala" },
  { month: 1, day: 16, name: "Urs of Syedna Hatim Mohyuddin", nameAr: "عرس سيدنا حاتم محي الدين", type: "urs", description: "Urs (death anniversary) of Syedna Hatim Mohyuddin, the 3rd Dai" },

  // ── Safar al-Muzaffar (2) ──
  { month: 2, day: 20, name: "Chehlum (Arba'een)", nameAr: "چہلم / أربعين", type: "commemoration", description: "Fortieth day after the martyrdom of Imam Husain" },
  { month: 2, day: 28, name: "Wafat of Prophet Muhammad", nameAr: "وفاة الرسول الأعظم", type: "commemoration", description: "Death anniversary of Prophet Muhammad" },

  // ── Rabi al-Awwal (3) ──
  { month: 3, day: 9, name: "Eid-e-Zahra", nameAr: "عيد الزهراء", type: "eid", description: "Joyous occasion after the mourning of Karbala" },
  { month: 3, day: 12, name: "Milad al-Nabi", nameAr: "ميلاد النبي", type: "milad", description: "Birth anniversary of Prophet Muhammad" },
  { month: 3, day: 16, name: "Urs of Syedna Mohammed Burhanuddin", nameAr: "عرس سيدنا محمد برهان الدين", type: "urs", description: "Urs of Syedna Mohammed Burhanuddin, the 52nd Dai" },

  // ── Rabi al-Akhir (4) ──
  { month: 4, day: 20, name: "Milad of Syedna Mohammed Burhanuddin", nameAr: "ميلاد سيدنا محمد برهان الدين", type: "milad", description: "Birthday of Syedna Mohammed Burhanuddin and His Holiness Syedna Mufaddal Saifuddin" },

  // ── Jumada al-Ula (5) ──

  // ── Jumada al-Akhirah (6) ──
  { month: 6, day: 27, name: "Urs of Syedna Qutbuddin Shaheed", nameAr: "عرس سيدنا قطب الدين الشهيد", type: "urs", description: "Urs of Syedna Qutbuddin Shaheed, the 32nd Dai" },

  // ── Rajab al-Asab (7) ──
  { month: 7, day: 13, name: "Milad of Imam Ali", nameAr: "ميلاد الإمام علي", type: "milad", description: "Birth anniversary of Amir al-Mu'minin Imam Ali ibn Abi Talib" },
  { month: 7, day: 19, name: "Urs of Syedna Taher Saifuddin", nameAr: "عرس سيدنا طاهر سيف الدين", type: "urs", description: "Urs of Syedna Taher Saifuddin, the 51st Dai" },
  { month: 7, day: 27, name: "Yaum al-Mab'ath", nameAr: "يوم المبعث", type: "observance", description: "Day of the Prophet's appointment to prophethood" },
  { month: 7, day: 27, name: "Lailat al-Mi'raj", nameAr: "ليلة المعراج", type: "observance", description: "Night of Ascension of Prophet Muhammad" },

  // ── Shaban al-Moazzam (8) ──
  { month: 8, day: 3, name: "Wiladat of Imam Husain", nameAr: "ولادة الإمام الحسين", type: "milad", description: "Birth anniversary of Imam Husain" },
  { month: 8, day: 15, name: "Lailat al-Bara'at", nameAr: "ليلة البراءة", type: "observance", description: "Night of Forgiveness" },
  { month: 8, day: 15, name: "Wiladat of Imam al-Mahdi", nameAr: "ولادة الإمام المهدي", type: "milad", description: "Birth anniversary of Imam al-Mahdi" },

  // ── Ramadan al-Moazzam (9) ──
  { month: 9, day: 1, name: "1st Ramadan", nameAr: "أوّل رمضان", type: "fast", description: "Beginning of the holy month of fasting" },
  { month: 9, day: 19, name: "Zarbat-e-Zehra", nameAr: "ضربة الزهراء", type: "commemoration", description: "Attack on the house of Imam Ali" },
  { month: 9, day: 21, name: "Shahadat of Imam Ali", nameAr: "شهادة الإمام علي", type: "commemoration", description: "Martyrdom of Imam Ali ibn Abi Talib" },
  { month: 9, day: 23, name: "Lailat al-Qadr", nameAr: "ليلة القدر", type: "observance", description: "Night of Power" },

  // ── Shawwal al-Mukarram (10) ──
  { month: 10, day: 1, name: "Eid al-Fitr", nameAr: "عيد الفطر", type: "eid", description: "Festival of Breaking the Fast" },

  // ── Dhu al-Qa'dah al-Haraam (11) ──
  { month: 11, day: 25, name: "Daho al-Ard", nameAr: "دحو الأرض", type: "observance", description: "Spreading of the earth beneath the Kaaba" },

  // ── Dhu al-Hijjah al-Haraam (12) ──
  { month: 12, day: 9, name: "Yawm al-Arafah", nameAr: "يوم عرفة", type: "fast", description: "Day of Arafah, observed with fasting and prayer" },
  { month: 12, day: 10, name: "Eid al-Adha", nameAr: "عيد الأضحى", type: "eid", description: "Festival of Sacrifice" },
  { month: 12, day: 18, name: "Eid al-Ghadir", nameAr: "عيد الغدير", type: "eid", description: "Anniversary of Prophet's appointment of Imam Ali as his successor" },
  { month: 12, day: 24, name: "Yawm al-Mubahala", nameAr: "يوم المباهلة", type: "eid", description: "Anniversary of the event of Mubahala" },
];

// ── Core Calculation Functions ──

/** Check if a Hijri year is a leap year in the 30-year cycle */
export function isHijriLeapYear(year: number): boolean {
  return LEAP_YEARS.has(year % 30);
}

/** Get number of days in a Hijri month */
export function getDaysInHijriMonth(year: number, month: number): number {
  const isLeap = isHijriLeapYear(year);
  const monthDays = isLeap ? MONTH_DAYS_LEAP : MONTH_DAYS_COMMON;
  return monthDays[month - 1];
}

/** Get total days in a Hijri year */
export function getDaysInHijriYear(year: number): number {
  return isHijriLeapYear(year) ? 355 : 354;
}

/**
 * Convert a Hijri date to Julian Day Number.
 * Uses the standard tabular Islamic calendar algorithm.
 */
export function hijriToJulianDay(year: number, month: number, day: number): number {
  // Calculate days from Hijri epoch
  const cycleYears = Math.floor((year - 1) / 30);
  const yearInCycle = (year - 1) % 30;

  // Days in completed 30-year cycles
  let totalDays = cycleYears * (30 * 354 + 11); // 30 years × 354 days + 11 leap days

  // Days in completed years within current cycle
  for (let y = 1; y <= yearInCycle; y++) {
    totalDays += isHijriLeapYear(y) ? 355 : 354;
  }

  // Days in completed months of current year
  for (let m = 1; m < month; m++) {
    totalDays += getDaysInHijriMonth(year, m);
  }

  // Days in current month (day - 1 because day 1 = 0 elapsed days)
  totalDays += day - 1;

  return HIJRI_EPOCH_JULIAN_DAY + totalDays;
}

/**
 * Convert Julian Day Number to Gregorian date.
 * Uses the standard algorithm.
 */
export function julianDayToGregorian(jd: number): { year: number; month: number; day: number } {
  const a = Math.floor(jd + 0.5);
  const b = a + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);

  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;

  return { year, month, day };
}

/**
 * Convert Julian Day Number to Hijri date.
 */
export function julianDayToHijri(jd: number): { year: number; month: number; day: number } {
  const days = Math.floor(jd) - Math.floor(HIJRI_EPOCH_JULIAN_DAY);

  if (days < 0) {
    return { year: 1, month: 1, day: 1 };
  }

  // Find the year
  let year = 1;
  let remainingDays = days;

  while (true) {
    const yearDays = getDaysInHijriYear(year);
    if (remainingDays < yearDays) break;
    remainingDays -= yearDays;
    year++;
  }

  // Find the month
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

/**
 * Convert Gregorian date to Julian Day Number.
 */
export function gregorianToJulianDay(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;

  return day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
}

// ── High-Level API Functions ──

export interface HijriDateInfo {
  year: number;
  month: number;
  day: number;
  monthName: string;
  monthNameAr: string;
  monthNameShort: string;
  dayOfWeek: string;
  dayOfWeekAr: string;
  isLeapYear: boolean;
  gregorian: { year: number; month: number; day: number };
}

export interface MonthInfo {
  year: number;      // Hijri year
  month: number;     // Hijri month (1-12)
  monthName: string;
  monthNameAr: string;
  days: number;      // Days in this month
  startDay: number;  // Day of week for 1st of month (0=Sun)
  gregorianStart: { year: number; month: number; day: number };
  gregorianEnd: { year: number; month: number; day: number };
}

export interface MonthEvent {
  day: number;
  event: FatimiEvent;
}

/**
 * Get today's date in both Hijri and Gregorian.
 */
export function getTodayHijri(): HijriDateInfo {
  const now = new Date();
  const jd = gregorianToJulianDay(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const hijri = julianDayToHijri(jd);
  return formatHijriDate(hijri.year, hijri.month, hijri.day);
}

/**
 * Format a Hijri date with all metadata.
 */
export function formatHijriDate(year: number, month: number, day: number): HijriDateInfo {
  const jd = hijriToJulianDay(year, month, day);
  const greg = julianDayToGregorian(jd);
  const gregDate = new Date(greg.year, greg.month - 1, greg.day);
  const dayOfWeek = gregDate.toLocaleDateString("en-US", { weekday: "long" });
  const dayOfWeekAr = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][gregDate.getDay()];

  return {
    year,
    month,
    day,
    monthName: HIJRI_MONTHS[month - 1]?.en || "",
    monthNameAr: HIJRI_MONTHS[month - 1]?.ar || "",
    monthNameShort: HIJRI_MONTHS[month - 1]?.short || "",
    dayOfWeek,
    dayOfWeekAr,
    isLeapYear: isHijriLeapYear(year),
    gregorian: greg,
  };
}

/**
 * Get full month info: days, start day, events, Gregorian range.
 */
export function getHijriMonthInfo(year: number, month: number): MonthInfo {
  const jd1 = hijriToJulianDay(year, month, 1);
  const gregStart = julianDayToGregorian(jd1);
  const daysInMonth = getDaysInHijriMonth(year, month);

  const jdEnd = hijriToJulianDay(year, month, daysInMonth);
  const gregEnd = julianDayToGregorian(jdEnd);

  // Day of week for 1st of month (0=Sunday)
  const gregDate = new Date(gregStart.year, gregStart.month - 1, gregStart.day);
  const startDay = gregDate.getDay();

  return {
    year,
    month,
    monthName: HIJRI_MONTHS[month - 1]?.en || "",
    monthNameAr: HIJRI_MONTHS[month - 1]?.ar || "",
    days: daysInMonth,
    startDay,
    gregorianStart: gregStart,
    gregorianEnd: gregEnd,
  };
}

/**
 * Expand a Fatimi event into the list of (month, day) pairs it covers.
 * Handles multi-day events using the `day2` field.
 */
export function expandEventDays(e: FatimiEvent): { month: number; day: number }[] {
  const days: { month: number; day: number }[] = [];
  const end = e.day2 ?? e.day;
  for (let d = e.day; d <= end; d++) {
    const daysInMonth = getDaysInHijriMonth(1, e.month);
    if (d > daysInMonth) break;
    days.push({ month: e.month, day: d });
  }
  return days;
}

/**
 * Check whether an event falls on a given Hijri (month, day).
 */
export function eventFallsOn(e: FatimiEvent, month: number, day: number): boolean {
  return expandEventDays(e).some((d) => d.month === month && d.day === day);
}

/**
 * Get all significant events for a given Hijri month (including multi-day events).
 */
export function getEventsForMonth(month: number): MonthEvent[] {
  const result: MonthEvent[] = [];
  for (const e of SIGNIFICANT_EVENTS) {
    if (e.month !== month) continue;
    for (const { day } of expandEventDays(e)) {
      result.push({ day, event: e });
    }
  }
  return result.sort((a, b) => a.day - b.day);
}

/**
 * Get today's event if any.
 */
export function getTodayEvent(): FatimiEvent | null {
  const today = getTodayHijri();
  return SIGNIFICANT_EVENTS.find((e) => eventFallsOn(e, today.month, today.day)) || null;
}

/**
 * Get upcoming events within the next N days.
 */
export function getUpcomingEvents(daysAhead: number = 30): { date: HijriDateInfo; event: FatimiEvent; daysUntil: number }[] {
  const today = getTodayHijri();
  const todayJd = hijriToJulianDay(today.year, today.month, today.day);
  const upcoming: { date: HijriDateInfo; event: FatimiEvent; daysUntil: number }[] = [];

  // Look through current and next Hijri months (a full year to cover all events)
  for (let offset = 0; offset < 365; offset++) {
    const checkJd = todayJd + offset;
    const checkHijri = julianDayToHijri(checkJd);
    const events = SIGNIFICANT_EVENTS.filter((e) =>
      eventFallsOn(e, checkHijri.month, checkHijri.day) && checkHijri.day === e.day,
    );
    for (const event of events) {
      upcoming.push({
        date: formatHijriDate(checkHijri.year, checkHijri.month, checkHijri.day),
        event,
        daysUntil: offset,
      });
    }
    if (offset > 0 && upcoming.length >= daysAhead * 2) break;
  }

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, daysAhead);
}

/**
 * Get the current Hijri year and month for calendar navigation.
 */
export function getCurrentHijriYearMonth(): { year: number; month: number } {
  const today = getTodayHijri();
  return { year: today.year, month: today.month };
}

export interface YearEvent {
  month: number;
  day: number;
  day2?: number;
  name: string;
  nameAr?: string;
  type: FatimiEvent["type"];
  description?: string;
  gregorian: { year: number; month: number; day: number };
}

/**
 * Get every significant event in a given Hijri year, each mapped to its
 * Gregorian date. Used for the full "year at a glance" miqaat list.
 */
export function getYearEvents(year: number): YearEvent[] {
  return SIGNIFICANT_EVENTS.map((e) => {
    const jd = hijriToJulianDay(year, e.month, e.day);
    return {
      month: e.month,
      day: e.day,
      day2: e.day2,
      name: e.name,
      nameAr: e.nameAr,
      type: e.type,
      description: e.description,
      gregorian: julianDayToGregorian(jd),
    };
  });
}

/** Day names for the calendar header */
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES_AR = ["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];
