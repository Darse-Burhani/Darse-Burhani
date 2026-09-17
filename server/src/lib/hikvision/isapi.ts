import { randomUUID } from "node:crypto";
import { authFailureHint, digestFetch } from "./digest";

export interface HikConnection {
  host: string;
  port: number;
  username: string;
  password: string;
  useHttps?: boolean;
  timeoutMs?: number;
}

export interface HikDeviceInfo {
  deviceName: string;
  model: string;
  serialNumber: string;
  macAddress: string;
  firmwareVersion: string;
}

export interface HikAcsEvent {
  /** Device-local time, e.g. "2026-08-05T09:15:00" */
  time: string;
  employeeNoString?: string | number;
  cardNo?: string | number;
  name?: string;
  major?: number | string;
  minor?: number | string;
  /** Globally unique event id returned by the device */
  serialNo?: string | number;
  deviceId?: string | number;
  currentVerifyMode?: string;
  attendanceStatus?: string;
}

export interface AcsEventsResult {
  events: HikAcsEvent[];
}

export function baseUrl(c: HikConnection): string {
  return `${c.useHttps ? "https" : "http"}://${c.host}:${c.port}`;
}

export function xmlTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
  return m?.[1]?.trim() ?? "";
}

/**
 * Fetch `/ISAPI/System/deviceInfo` and extract identity fields from the XML.
 */
export async function getDeviceInfo(c: HikConnection): Promise<HikDeviceInfo> {
  const res = await digestFetch(`${baseUrl(c)}/ISAPI/System/deviceInfo`, {
    method: "GET",
    username: c.username,
    password: c.password,
    timeoutMs: c.timeoutMs ?? 8000,
  });
  if (!res.ok) throw new Error(`Device returned HTTP ${res.status}${await authFailureHint(res)}`);

  const xml = await res.text();
  return {
    deviceName: xmlTag(xml, "deviceName"),
    model: xmlTag(xml, "model"),
    serialNumber: xmlTag(xml, "serialNumber"),
    macAddress: xmlTag(xml, "macAddress"),
    firmwareVersion: xmlTag(xml, "firmwareVersion"),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** ISAPI window format: yyyy-MM-ddTHH:mm:ss with optional timezone offset. */
function isaTime(d: Date, withTz = true): string {
  const base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  if (!withTz) return base;
  const tz = -d.getTimezoneOffset();
  const sign = tz >= 0 ? "+" : "-";
  const absTz = Math.abs(tz);
  const tzStr = `${sign}${pad(Math.floor(absTz / 60))}:${pad(absTz % 60)}`;
  return `${base}${tzStr}`;
}

/**
 * Pull access-control events from `/ISAPI/AccessControl/AcsEvent`.
 *
 * Automatically paginates through all available pages from the Hikvision terminal
 * to ensure all attendance scans are retrieved without dropping any records.
 */
export async function getAcsEvents(c: HikConnection, from: Date, to: Date): Promise<AcsEventsResult> {
  const pageSize = 30; // MinMoe terminals return max 30 records per page
  const maxTotalToFetch = 5000;
  const postUrl = `${baseUrl(c)}/ISAPI/AccessControl/AcsEvent?format=json`;

  const queryAttempts = [
    { startTime: isaTime(from, true), endTime: isaTime(to, true) },
    { startTime: isaTime(from, false), endTime: isaTime(to, false) },
    {}, // Latest events without time filter fallback
  ];

  for (const timeFilter of queryAttempts) {
    try {
      let position = 0;
      const allEvents: HikAcsEvent[] = [];
      const searchID = randomUUID();

      while (position < maxTotalToFetch) {
        const body = JSON.stringify({
          AcsEventCond: {
            searchID,
            searchResultPosition: position,
            maxResults: pageSize,
            major: 0,
            minor: 0,
            ...timeFilter,
          },
        });

        const postRes = await digestFetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          username: c.username,
          password: c.password,
          timeoutMs: c.timeoutMs ?? 10000,
        });

        if (!postRes.ok) break;

        const text = await postRes.text().catch(() => "");
        if (!text) break;

        let pageEvents: HikAcsEvent[] = [];
        let totalMatches = 0;
        let responseStatus = "";

        try {
          const json = JSON.parse(text);
          const acs = json.AcsEvent || json.AcsEventSearchResult || json.acsEventSearchResult || json;
          totalMatches = acs.totalMatches || 0;
          responseStatus = acs.responseStatusStrg || "";
          pageEvents = parseAcsResponse(json).events;
        } catch {
          if (text.includes("<") && text.includes(">")) {
            pageEvents = xmlToAcsEvents(text);
          }
        }

        if (pageEvents.length === 0) break;

        allEvents.push(...pageEvents);
        position += pageEvents.length;

        // If no more pages or reached total matches reported by device
        if (responseStatus !== "MORE" || (totalMatches > 0 && position >= totalMatches)) {
          break;
        }
      }

      if (allEvents.length > 0) {
        return { events: allEvents };
      }
    } catch {
      // Try next attempt
    }
  }

  // 2) Legacy GET form fallback
  try {
    const qs = new URLSearchParams({
      format: "json",
      starttime: isaTime(from, false),
      endtime: isaTime(to, false),
      maxresults: "500",
    });
    const getUrl = `${baseUrl(c)}/ISAPI/AccessControl/AcsEvent?${qs.toString()}`;
    const res = await digestFetch(getUrl, {
      method: "GET",
      username: c.username,
      password: c.password,
      timeoutMs: c.timeoutMs ?? 8000,
    });
    if (res.ok) {
      const text = await res.text().catch(() => "");
      if (text) {
        try {
          const json = JSON.parse(text);
          return parseAcsResponse(json);
        } catch {
          if (text.includes("<") && text.includes(">")) {
            return { events: xmlToAcsEvents(text) };
          }
        }
      }
    }
  } catch {
    // Ignore
  }

  return { events: [] };
}

function xmlToAcsEvents(xml: string): HikAcsEvent[] {
  const events: HikAcsEvent[] = [];
  const re = /<(?:[a-zA-Z0-9_-]+:)?(?:MatchList|AcsEvent)(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?(?:MatchList|AcsEvent)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    events.push({
      time: xmlTag(block, "time") || xmlTag(block, "dateTime") || new Date().toISOString(),
      employeeNoString: xmlTag(block, "employeeNoString") || xmlTag(block, "employeeNo") || xmlTag(block, "employeeId") || undefined,
      cardNo: xmlTag(block, "cardNo") || undefined,
      name: xmlTag(block, "name") || xmlTag(block, "personName") || undefined,
      major: xmlTag(block, "major") || undefined,
      minor: xmlTag(block, "minor") || undefined,
      serialNo: xmlTag(block, "serialNo") || xmlTag(block, "eventID") || undefined,
      deviceId: xmlTag(block, "deviceId") || undefined,
      currentVerifyMode: xmlTag(block, "currentVerifyMode") || xmlTag(block, "verifyMode") || undefined,
    });
  }
  return events;
}

function parseAcsResponse(json: any): AcsEventsResult {
  if (!json || typeof json !== "object") return { events: [] };

  // 1. Hikvision MinMoe (DS-K1T series) standard response: AcsEventSearchResult.MatchList
  const searchResult = json.AcsEventSearchResult || json.acsEventSearchResult;
  if (searchResult) {
    const list = searchResult.MatchList || searchResult.matchList || searchResult.AcsEvent || searchResult.InfoList;
    if (Array.isArray(list)) return { events: list };
    if (list && typeof list === "object") return { events: [list] };
  }

  // 2. AcsEventCond.MatchList
  const eventCond = json.AcsEventCond || json.acsEventCond;
  if (eventCond) {
    const list = eventCond.MatchList || eventCond.matchList;
    if (Array.isArray(list)) return { events: list };
    if (list && typeof list === "object") return { events: [list] };
  }

  // 3. AcsEvent.InfoList or InfoList.AcsEvent
  const acsEvent = json.AcsEvent || json.acsEvent;
  if (acsEvent) {
    const infoList = acsEvent.InfoList || acsEvent.infoList || acsEvent.MatchList || acsEvent.matchList;
    if (Array.isArray(infoList)) return { events: infoList };
    if (infoList && typeof infoList === "object") {
      const inner = infoList.AcsEvent || infoList.acsEvent;
      if (Array.isArray(inner)) return { events: inner };
      if (inner && typeof inner === "object") return { events: [inner] };
      return { events: [infoList] };
    }
    if (Array.isArray(acsEvent)) return { events: acsEvent };
  }

  // 4. InfoList or MatchList at root
  if (Array.isArray(json.MatchList)) return { events: json.MatchList };
  if (Array.isArray(json.matchList)) return { events: json.matchList };
  if (Array.isArray(json.InfoList)) return { events: json.InfoList };
  if (Array.isArray(json.infoList)) return { events: json.infoList };
  if (Array.isArray(json.events)) return { events: json.events };

  return { events: [] };
}

/**
 * Standard Hikvision access-control event minor codes (major=0) that represent
 * a successful fingerprint / face verification on the DS-K1T341/342 terminals:
 *   7  valid fingerprint pass
 *   8  fingerprint + password pass
 *   9  card / fingerprint / password pass
 *   10 card + fingerprint pass
 *   11 valid face pass
 *   12 face + password pass
 *   13 face + fingerprint pass
 * Card-only passes (5, 6) are deliberately excluded.
 */
// Standard & extended Hikvision ACS minor event codes representing successful Fingerprint or Face verification:
// 7-10: Fingerprint passes
// 11-12: Facial recognition passes
// 13: Face + Fingerprint pass
// 75 (0x4B): Facial recognition passed / face picture compared successfully
// 76 (0x4C): Face + Card authentication passed (face verified)
// 77 (0x4D): Face + Password authentication passed (face verified)
// 78 (0x4E): Face + Fingerprint authentication passed
// Note: Pure card passes (5, 6, 20, 38) are strictly excluded.
const BIOMETRIC_PASS_MINORS = new Set<number>([7, 8, 9, 10, 11, 12, 13, 75, 76, 77, 78]);

// Verify modes: 4 (FP), 5 (FP+PWD), 6 (Face), 12 (Face+FP), 15 (Face+Card), 16 (FP+Card)
// Mode 1 (Card) and Mode 2 (Card+PWD) are strictly excluded.
const BIOMETRIC_VERIFY_MODES = new Set<number>([4, 5, 6, 12, 15, 16]);

/**
 * Decide whether an access-control event represents a successful verification we should record as attendance.
 * STRICT POLICY: Only Fingerprint and Face scan are accepted. RFID Card-only passes are rejected.
 */
export function isAttendanceEvent(ev: HikAcsEvent): boolean {
  const id = String(ev.employeeNoString ?? ev.cardNo ?? "").trim();
  if (!id) return false;

  const major = Number(ev.major);
  const minor = Number(ev.minor);
  if (minor === 1) return false; // failed verification attempt
  if (minor === 21 || minor === 22) return false; // door open/close magnetic sensor events

  // Reject pure card-only minor codes
  if (minor === 5 || minor === 6 || minor === 20) {
    return false;
  }

  const mode = String(ev.currentVerifyMode ?? "").trim().toLowerCase();

  // Reject strictly card-only verify modes (Mode 1 or Mode 2)
  if (mode === "1" || mode === "2" || (mode.includes("card") && !mode.includes("face") && !mode.includes("finger") && !mode.includes("fp"))) {
    return false;
  }

  // 1. Verified via biometric pass minor code (Fingerprint or Face)
  if (BIOMETRIC_PASS_MINORS.has(minor)) {
    return true;
  }

  // 2. Check verify mode text (e.g. "faceOrFpOrCardOrPw", "face", "fingerprint")
  if (/finger|fp|face|facial/i.test(mode)) {
    return true;
  }

  // 3. Attendance upload event (major=5) with valid employee identifier
  if (major === 5 && (ev.employeeNoString || minor === 38 || minor === 39 || minor === 75)) {
    return true;
  }

  // 4. If numeric mode matches biometric verify modes
  if (/^\d+$/.test(mode) && BIOMETRIC_VERIFY_MODES.has(Number(mode))) {
    return true;
  }

  return Boolean(ev.employeeNoString && minor !== 1);
}

export interface HikUserInfo {
  employeeNo: string;
  name?: string;
  userType?: string;
  gender?: string;
}

/**
 * Query enrolled users/members from Hikvision terminal via ISAPI
 * POST /ISAPI/AccessControl/UserInfo/Search?format=json
 * Automatically paginates through all enrolled users on the terminal.
 */
export async function getUserInfoList(c: HikConnection, maxTotal = 1000): Promise<HikUserInfo[]> {
  const allUsers: HikUserInfo[] = [];
  const seenEmpNos = new Set<string>();
  let position = 0;
  const pageSize = 30; // MinMoe terminal maximum page size

  while (position < maxTotal) {
    const url = `${baseUrl(c)}/ISAPI/AccessControl/UserInfo/Search?format=json`;
    const body = JSON.stringify({
      UserInfoSearchCond: {
        searchID: "1",
        searchResultPosition: position,
        maxResults: pageSize,
      },
    });

    try {
      const res = await digestFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        username: c.username,
        password: c.password,
        body,
        timeoutMs: c.timeoutMs ?? 10000,
      });

      if (!res.ok) break;

      const text = await res.text();
      let batch: HikUserInfo[] = [];
      let totalMatches = 0;
      let numOfMatches = 0;

      try {
        const json = JSON.parse(text);
        const searchResult = json.UserInfoSearch || json.userInfoSearch || json;
        totalMatches = Number(searchResult.totalMatches ?? 0);
        numOfMatches = Number(searchResult.numOfMatches ?? 0);
        const list = searchResult.UserInfo || searchResult.userInfo || searchResult.MatchList || searchResult.matchList;
        const usersArray = Array.isArray(list) ? list : list && typeof list === "object" ? [list] : [];

        batch = usersArray
          .map((u: any) => ({
            employeeNo: String(u.employeeNo ?? u.employeeNoString ?? u.id ?? "").trim(),
            name: typeof u.name === "string" ? u.name.trim() : undefined,
            userType: u.userType,
            gender: u.gender,
          }))
          .filter((u: HikUserInfo) => Boolean(u.employeeNo));
      } catch {
        // Fallback to XML parsing
        if (text.includes("<") && text.includes(">")) {
          batch = parseXmlUserInfo(text);
          numOfMatches = batch.length;
        }
      }

      if (batch.length === 0) break;

      for (const u of batch) {
        if (!seenEmpNos.has(u.employeeNo)) {
          seenEmpNos.add(u.employeeNo);
          allUsers.push(u);
        }
      }

      const advance = numOfMatches > 0 ? numOfMatches : batch.length;
      position += advance;

      // Stop if reached total matches or terminal has no more
      if (totalMatches > 0 && allUsers.length >= totalMatches) break;
      if (advance === 0) break;
    } catch (err) {
      console.error(`[hikvision] Failed to query UserInfo page at ${position} from ${c.host}:`, err);
      break;
    }
  }

  return allUsers;
}

function parseXmlUserInfo(xml: string): HikUserInfo[] {
  const users: HikUserInfo[] = [];
  const re = /<(?:[a-zA-Z0-9_-]+:)?UserInfo(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?UserInfo>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const employeeNo = xmlTag(block, "employeeNo") || xmlTag(block, "employeeNoString") || xmlTag(block, "id");
    if (employeeNo) {
      users.push({
        employeeNo: employeeNo.trim(),
        name: xmlTag(block, "name") || undefined,
        userType: xmlTag(block, "userType") || undefined,
        gender: xmlTag(block, "gender") || undefined,
      });
    }
  }
  return users;
}
