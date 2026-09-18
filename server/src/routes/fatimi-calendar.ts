import { Router } from "express";
import { cache } from "../lib/cache";
import { getMonth, getToday, getYearMiqaats } from "../lib/aajnodin-calendar";
import type { AajNoDinToday } from "../lib/aajnodin-calendar";
import {
  getTodayHijri,
  getHijriMonthInfo,
  getEventsForMonth,
  getUpcomingEvents,
  getTodayEvent,
  getYearEvents,
  formatHijriDate,
  hijriToJulianDay,
  julianDayToHijri,
  HIJRI_MONTHS,
} from "../lib/fatimi-calendar";

const router = Router();

function monthsPayload() {
  return HIJRI_MONTHS.map((m, i) => ({ index: i + 1, ...m }));
}

function monthNavigation(year: number, month: number) {
  return {
    prev: month === 1
      ? { year: year - 1, month: 12 }
      : { year, month: month - 1 },
    next: month === 12
      ? { year: year + 1, month: 1 }
      : { year, month: month + 1 },
  };
}

/**
 * Upcoming miqaats (next ~10) computed from the authoritative AajNoDin year
 * events, measured in exact Hijri days from today.
 */
async function buildUpcoming(year: number, todayInfo: AajNoDinToday) {
  const todayJd = hijriToJulianDay(todayInfo.year, todayInfo.month, todayInfo.day);
  const yearEvents = (await Promise.all([
    getYearMiqaats(year),
    getYearMiqaats(year + 1),
  ])).flat();

  const upcoming: {
    date: ReturnType<typeof formatHijriDate>;
    event: (typeof yearEvents)[number];
    daysUntil: number;
  }[] = [];

  for (const event of yearEvents) {
    let jd = hijriToJulianDay(year, event.month, event.day);
    if (jd < todayJd) jd = hijriToJulianDay(year + 1, event.month, event.day);
    const daysUntil = jd - todayJd;
    if (daysUntil < 0) continue;
    const hijri = julianDayToHijri(jd);
    upcoming.push({
      date: formatHijriDate(hijri.year, hijri.month, hijri.day),
      event,
      daysUntil,
    });
  }

  return upcoming.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, 10);
}

/**
 * Primary path — build the calendar from the authoritative AajNoDin API.
 */
async function buildFromAajNoDin(hy: number, hm: number) {
  const todayInfo = await getToday();

  const year = hy > 0 ? hy : todayInfo.year;
  const month = hm > 0 ? hm : todayInfo.month;

  const [monthData, currentMonth] = await Promise.all([
    getMonth(year, month),
    getMonth(todayInfo.year, todayInfo.month),
  ]);

  const todayEvent =
    currentMonth.miqaats.find((m) => m.day === todayInfo.day) || null;

  const calendarDays = monthData.days.map((d) => ({
    day: d.hijriDay,
    gregorian: d.gregorian,
    isToday:
      d.hijriDay === todayInfo.day &&
      month === todayInfo.month &&
      year === todayInfo.year,
    events: monthData.miqaats
      .filter((m) => m.day === d.hijriDay)
      .map((m) => ({
        month: m.month,
        day: m.day,
        name: m.name,
        nameAr: m.nameAr,
        type: m.type,
        description: m.description,
      })),
    dayOfWeek: d.dayOfWeek,
  }));

  const [upcoming, yearEvents] = await Promise.all([
    buildUpcoming(year, todayInfo),
    getYearMiqaats(year),
  ]);

  return {
    today: {
      hijri: {
        year: todayInfo.year,
        month: todayInfo.month,
        day: todayInfo.day,
        monthName: todayInfo.monthName,
        monthNameAr: todayInfo.monthNameAr,
        monthNameShort: todayInfo.monthNameShort,
        dayOfWeek: todayInfo.dayOfWeek,
        dayOfWeekAr: todayInfo.dayOfWeekAr,
      },
      event: todayEvent,
    },
    month: {
      year: monthData.year,
      month: monthData.month,
      monthName: monthData.monthName,
      monthNameAr: monthData.monthNameAr,
      days: monthData.days.length,
      startDay: monthData.startDay,
      calendarDays,
      gregorianStart: monthData.gregorianStart,
      gregorianEnd: monthData.gregorianEnd,
    },
    upcoming,
    yearEvents,
    navigation: monthNavigation(year, month),
    months: monthsPayload(),
  };
}

/**
 * Fallback path — local tabular calendar when AajNoDin is unreachable.
 */
function buildTabular(hy: number, hm: number) {
  const today = getTodayHijri();
  const todayEvent = getTodayEvent();

  const year = hy > 0 ? hy : today.year;
  const month = hm > 0 ? hm : today.month;

  const monthInfo = getHijriMonthInfo(year, month);
  const monthEvents = getEventsForMonth(month);

  const calendarDays: {
    day: number;
    gregorian: { year: number; month: number; day: number };
    isToday: boolean;
    events: (typeof monthEvents)[0]["event"][];
    dayOfWeek: number;
  }[] = [];

  for (let d = 1; d <= monthInfo.days; d++) {
    const gregDate = new Date(
      monthInfo.gregorianStart.year,
      monthInfo.gregorianStart.month - 1,
      monthInfo.gregorianStart.day + (d - 1),
    );

    calendarDays.push({
      day: d,
      gregorian: {
        year: gregDate.getFullYear(),
        month: gregDate.getMonth() + 1,
        day: gregDate.getDate(),
      },
      isToday: d === today.day && month === today.month && year === today.year,
      events: monthEvents.filter((e) => e.day === d).map((e) => e.event),
      dayOfWeek: gregDate.getDay(),
    });
  }

  return {
    today: { hijri: today, event: todayEvent },
    month: {
      ...monthInfo,
      calendarDays,
    },
    upcoming: getUpcomingEvents(10),
    yearEvents: getYearEvents(year),
    navigation: monthNavigation(year, month),
    months: monthsPayload(),
  };
}

router.get("/", async (req, res) => {
  try {
    const hy = parseInt((req.query.hy as string) || "0");
    const hm = parseInt((req.query.hm as string) || "0");

    const data = await cache.getOrSet(
      `fatimi-calendar:hy${hy}:hm${hm}`,
      async () => {
        try {
          return await buildFromAajNoDin(hy, hm);
        } catch (err) {
          console.error("AajNoDin unavailable, using tabular fallback:", err);
          return buildTabular(hy, hm);
        }
      },
      { ttl: 3600_000, tags: ["fatimi-calendar"] }, // Cache for 1 hour — calendar data doesn't change
    );

    return res.json({ success: true, data });
  } catch (error) {
    console.error("Fatimi calendar error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch Fatimi calendar",
    });
  }
});

export default router;
