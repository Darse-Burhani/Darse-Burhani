/**
 * Aaj No Din Calendar Integration
 *
 * Fetches the authoritative Dawoodi Bohra (Fatimi) Hijri calendar + miqaats
 * from the public AajNoDin API (https://api.aajnodin.com). The endpoint is
 * HTML-based (not JSON), so we parse the monthly calendar grid and miqaats
 * out of the page.
 *
 * The existing local tabular calendar is kept as a fallback in the route if
 * this service is unreachable.
 */
import { cache } from "./cache";
import { HIJRI_MONTHS, hijriToJulianDay, julianDayToGregorian } from "./fatimi-calendar";

const AAJNODIN_API = "https://api.aajnodin.com/";
const USER_AGENT = "DarseBurhani-SIS/1.0 (fatimi-calendar)";

const MONTH_TTL = 7 * 24 * 3600 * 1000; // static data — cache long
const TODAY_TTL = 6 * 3600 * 1000;
const YEAR_EVENTS_TTL = 7 * 24 * 3600 * 1000;

export interface AajNoDinGregorian {
  year: number;
  month: number;
  day: number;
}

export interface AajNoDinToday {
  day: number;
  month: number;
  year: number;
  monthName: string;
  monthNameAr: string;
  monthNameShort: string;
  dayOfWeek: string;
  dayOfWeekAr: string;
  gregorian: AajNoDinGregorian;
}

export type AajNoDinEventType = "milad" | "urs" | "eid" | "commemoration" | "fast" | "observance";

export interface AajNoDinMiqaat {
  month: number;
  day: number;
  name: string;
  nameAr?: string;
  type: AajNoDinEventType;
  description: string;
}

export interface AajNoDinDay {
  hijriDay: number;
  gregorian: AajNoDinGregorian;
  dayOfWeek: number;
}

export interface AajNoDinMonth {
  year: number;
  month: number;
  monthName: string;
  monthNameAr: string;
  monthNameShort: string;
  startDay: number;
  days: AajNoDinDay[];
  dayToGregorian: Record<number, AajNoDinGregorian>;
  miqaats: AajNoDinMiqaat[];
  gregorianStart: AajNoDinGregorian;
  gregorianEnd: AajNoDinGregorian;
}

export interface AajNoDinMonthPage {
  today: AajNoDinToday;
  month: AajNoDinMonth;
}

export interface AajNoDinYearEvent {
  month: number;
  day: number;
  name: string;
  nameAr?: string;
  type: AajNoDinEventType;
  description?: string;
  gregorian: AajNoDinGregorian;
}

// ── Small text helpers ──

function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLetters(text: string): string {
  return text.toLowerCase().replace(/[^a-z]/g, "");
}

function formatGreg(g: { year: number; month: number; day: number }): string {
  const y = String(g.year).padStart(4, "0");
  const m = String(g.month).padStart(2, "0");
  const d = String(g.day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Hijri month name mapping (AajNoDin transliterations) ──

const MONTH_ALIASES: [number, string[]][] = [
  [1, ["moharram", "muharram", "muharramulharam"]],
  [2, ["safar", "safarulmuzaffar"]],
  [3, ["rabiulawwal", "rabialawwal", "rabiulawal", "rabilawwal", "rabiulawwalm"]],
  [4, ["rabiulukhra", "rabialakhir", "rabiulakhir", "rabilakhir", "rabiulakhar", "rabilakhar", "rabiulakhirah"]],
  [5, ["jamadilula", "jumadaula", "jamadilawwal", "jamadilawal"]],
  [6, ["jamadilukhra", "jumadaakhirah", "jamadilakhir", "jamadilakhirah", "jamadilukhar"]],
  [7, ["rajab", "rajabalmurajjab"]],
  [8, ["shaban", "shaaban", "shabbaan", "shabaan", "shabaanulkarim", "shabbaanulkarim", "shabanulkarim"]],
  [9, ["ramazan", "ramadan", "ramazaan", "ramadaan", "ramazanulmoazzam", "ramadanulmoazzam"]],
  [10, ["shawwal", "shawwalalmukarram"]],
  [11, ["zilqadal", "zilqad", "zilqadatil", "dhuqa", "dhulqa", "zilqadah"]],
  [12, ["zilhajj", "zilhajjatil", "dhuhijjah", "dhulhijjah", "zilhajjatulharam"]],
];

function parseMonthIndex(raw: string): number | null {
  const norm = normalizeLetters(raw);
  if (!norm) return null;
  for (const [idx, aliases] of MONTH_ALIASES) {
    for (const alias of aliases) {
      if (norm.includes(alias)) return idx;
    }
  }
  // Fallback: match against the app's own month names
  for (let i = 0; i < HIJRI_MONTHS.length; i++) {
    if (norm.includes(normalizeLetters(HIJRI_MONTHS[i].short))) return i + 1;
  }
  return null;
}

const GREG_MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const DAY_NAMES_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

// ── AajNoDin page parsing ──

function parseHijriDate(text: string): { day: number; month: number; year: number } | null {
  const cleaned = cleanText(text);
  const m = cleaned.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+(.+?)\s+(\d{1,4})$/);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const month = parseMonthIndex(m[2]);
  const year = parseInt(m[3], 10);
  if (!month || isNaN(day) || isNaN(year)) return null;
  return { day, month, year };
}

function parseHeaderToday(html: string): { day: number; month: number; year: number } | null {
  const re = /class="hdrDateDay"[^>]*>[\s\S]*?<strong>([^<]*)<\/strong>/;
  const m = html.match(re);
  if (!m) return null;
  return parseHijriDate(m[1]);
}

function parseMonthTitle(html: string): { hijriName: string; hijriYear: number; gregYear: number } | null {
  const re = /class="popCalMainTitleDateText"[\s\S]*?<div>\s*([^<]*?)\s*<\/div>[\s\S]*?class="popCalMainTitleDateTextEng"[^>]*>\s*([^<]*?)\s*<\/div>/;
  const m = html.match(re);
  if (!m) return null;
  const hijriPart = cleanText(m[1]);
  const gregPart = cleanText(m[2]);
  const hijriYearMatch = hijriPart.match(/(\d{1,4})\s*H?$/);
  const gregMatch = gregPart.match(/^([A-Za-z]+)\s+(\d{1,4})$/);
  if (!hijriYearMatch || !gregMatch) return null;
  return {
    hijriName: hijriPart.replace(/\d{1,4}\s*H?$/, "").trim(),
    hijriYear: parseInt(hijriYearMatch[1], 10),
    gregYear: parseInt(gregMatch[2], 10),
  };
}

function parseGrid(html: string, startGregYear: number): AajNoDinDay[] {
  const cells: { top: string; bot: string }[] = [];
  const re = /class="popCalMainTblDateTop">([^<]*)<\/td>[\s\S]*?class="popCalMainTblDateBot">([^<]*)<\/td>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    cells.push({ top: cleanText(match[1]), bot: cleanText(match[2]) });
  }

  const days: AajNoDinDay[] = [];
  let year = startGregYear;
  let prevMonth = 0;

  for (const cell of cells) {
    const hijriDay = parseInt(cell.top, 10);
    if (isNaN(hijriDay) || !cell.bot) continue; // placeholder cell
    const gm = cell.bot.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
    if (!gm) continue;
    const month = GREG_MONTHS[gm[1].toLowerCase()];
    if (!month) continue;
    const day = parseInt(gm[2], 10);
    if (month < prevMonth) year++; // Gregorian year wrap (e.g. Dec → Jan)
    prevMonth = month;
    const date = new Date(year, month - 1, day);
    days.push({
      hijriDay,
      gregorian: { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() },
      dayOfWeek: date.getDay(),
    });
  }

  return days;
}

function classifyType(text: string): AajNoDinEventType {
  const t = text.toLowerCase();
  if (t.includes("eid")) return "eid";
  if (t.includes("milad")) return "milad";
  if (t.includes("urs")) return "urs";
  if (t.includes("roza") || t.includes("fast")) return "fast";
  if (t.includes("shahadat") || t.includes("wafat") || t.includes("chehlum") || t.includes("marty")) return "commemoration";
  return "observance";
}

function parseMiqaats(html: string, monthIndex: number): AajNoDinMiqaat[] {
  const miqaats: AajNoDinMiqaat[] = [];
  const re = /class="event_for_month_wrap_left">([^<]*)<\/div>[\s\S]*?class="bld">([^<]*)<\/span>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const day = parseInt(cleanText(match[1]), 10);
    const text = cleanText(match[2]);
    if (isNaN(day) || !text) continue;
    const colonIdx = text.indexOf(":");
    const name = colonIdx >= 0 ? text.slice(colonIdx + 1).trim() : text;
    miqaats.push({ month: monthIndex, day, name, type: classifyType(text), description: text });
  }
  return miqaats.sort((a, b) => a.day - b.day);
}

async function fetchHtml(gdate: string): Promise<string> {
  const res = await fetch(`${AAJNODIN_API}?gdate=${gdate}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`AajNoDin request failed: ${res.status}`);
  }
  return res.text();
}

function buildTodayFromHeader(parsed: { day: number; month: number; year: number }): AajNoDinToday {
  const now = new Date();
  const monthMeta = HIJRI_MONTHS[parsed.month - 1];
  return {
    day: parsed.day,
    month: parsed.month,
    year: parsed.year,
    monthName: monthMeta?.en || "",
    monthNameAr: monthMeta?.ar || "",
    monthNameShort: monthMeta?.short || "",
    dayOfWeek: now.toLocaleDateString("en-US", { weekday: "long" }),
    dayOfWeekAr: DAY_NAMES_AR[now.getDay()] || "",
    gregorian: { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() },
  };
}

/**
 * Fetch and parse one AajNoDin page (for a given Gregorian date) into a
 * structured month page (the Hijri month that contains that Gregorian date).
 */
export async function loadMonthPage(gdate: string): Promise<AajNoDinMonthPage> {
  const html = await fetchHtml(gdate);

  const header = parseHeaderToday(html);
  const title = parseMonthTitle(html);
  const monthIndex = title ? parseMonthIndex(title.hijriName) : null;

  if (!header || !title || !monthIndex || !title.hijriYear) {
    throw new Error("Could not parse AajNoDin page structure");
  }

  const days = parseGrid(html, title.gregYear);
  const miqaats = parseMiqaats(html, monthIndex);

  const dayToGregorian: Record<number, AajNoDinGregorian> = {};
  for (const d of days) {
    dayToGregorian[d.hijriDay] = d.gregorian;
  }

  const monthMeta = HIJRI_MONTHS[monthIndex - 1];
  const gregorianStart = days.length > 0 ? days[0].gregorian : { year: title.gregYear, month: 1, day: 1 };
  const gregorianEnd = days.length > 0 ? days[days.length - 1].gregorian : gregorianStart;

  return {
    today: buildTodayFromHeader(header),
    month: {
      year: title.hijriYear,
      month: monthIndex,
      monthName: monthMeta?.en || "",
      monthNameAr: monthMeta?.ar || "",
      monthNameShort: monthMeta?.short || "",
      startDay: days.length > 0 ? days[0].dayOfWeek : 0,
      days,
      dayToGregorian,
      miqaats,
      gregorianStart,
      gregorianEnd,
    },
  };
}

/**
 * Get a specific Hijri (year, month) from AajNoDin, converging on the right
 * Gregorian anchor date if the local tabular calculation drifts by a day or two.
 */
export async function getMonth(hy: number, hm: number): Promise<AajNoDinMonth> {
  const key = `aajnodin:month:${hy}:${hm}`;
  return cache.getOrSet<AajNoDinMonth>(
    key,
    async () => {
      // Candidate Gregorian anchor: the first day of the Hijri month (tabular, approx).
      let anchor = julianDayToGregorian(hijriToJulianDay(hy, hm, 1));
      let page: AajNoDinMonthPage | null = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          page = await loadMonthPage(formatGreg(anchor));
        } catch {
          // Page unparseable (e.g. unrecognized month transliteration) — nudge
          // the anchor past the offending month and try again.
          const nudged = new Date(anchor.year, anchor.month - 1, anchor.day + 8);
          anchor = { year: nudged.getFullYear(), month: nudged.getMonth() + 1, day: nudged.getDate() };
          continue;
        }

        const actual = page.month;
        if (actual.year === hy && actual.month === hm) break;

        const diffMonths = (actual.year - hy) * 12 + (actual.month - hm);
        if (page.month.days.length === 0) break;

        // Shift the anchor by ~30 days per Hijri month difference using the
        // exact Gregorian date of the returned month's first day.
        const day1 = page.month.days[0].gregorian;
        const shifted = new Date(day1.year, day1.month - 1, day1.day - diffMonths * 30);
        anchor = { year: shifted.getFullYear(), month: shifted.getMonth() + 1, day: shifted.getDate() };
      }

      if (!page || page.month.days.length === 0) {
        throw new Error(`Could not load Hijri month ${hm}/${hy} from AajNoDin`);
      }
      return page.month;
    },
    { ttl: MONTH_TTL, tags: ["aajnodin"] },
  );
}

/**
 * Today's Hijri date + current Hijri month (parsed from a fetch of today's page).
 */
export async function getToday(): Promise<AajNoDinToday> {
  const key = "aajnodin:today";
  return cache.getOrSet<AajNoDinToday>(
    key,
    async () => {
      const now = new Date();
      const gdate = formatGreg({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
      const page = await loadMonthPage(gdate);

      // Prime the current month cache — the today page already contains it.
      cache.set(`aajnodin:month:${page.month.year}:${page.month.month}`, page.month, { ttl: MONTH_TTL, tags: ["aajnodin"] });

      return page.today;
    },
    { ttl: TODAY_TTL, tags: ["aajnodin"] },
  );
}

/**
 * Every miqaat in a Hijri year, each mapped to its Gregorian date.
 * Fetches all 12 months (cached per month, and the combined result cached too).
 */
export async function getYearMiqaats(hy: number): Promise<AajNoDinYearEvent[]> {
  const key = `aajnodin:yearevents:${hy}`;
  return cache.getOrSet<AajNoDinYearEvent[]>(
    key,
    async () => {
      // A single unparseable month shouldn't discard the whole year.
      const results = await Promise.allSettled(
        Array.from({ length: 12 }, (_, i) => getMonth(hy, i + 1)),
      );
      const months = results
        .filter((r): r is PromiseFulfilledResult<AajNoDinMonth> => r.status === "fulfilled")
        .map((r) => r.value);

      const events: AajNoDinYearEvent[] = [];
      for (const month of months) {
        for (const miqaat of month.miqaats) {
          const gregorian = month.dayToGregorian[miqaat.day];
          if (!gregorian) continue;
          events.push({
            month: miqaat.month,
            day: miqaat.day,
            name: miqaat.name,
            nameAr: miqaat.nameAr,
            type: miqaat.type,
            description: miqaat.description,
            gregorian,
          });
        }
      }

      return events;
    },
    { ttl: YEAR_EVENTS_TTL, tags: ["aajnodin"] },
  );
}
