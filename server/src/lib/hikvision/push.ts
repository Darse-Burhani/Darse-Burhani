import os from "node:os";
import prisma from "../prisma";
import { processBiometricScan, type BiometricEvent } from "../biometric";
import { authFailureHint, digestFetch } from "./digest";
import { isAttendanceEvent, BIOMETRIC_PASS_MINORS, BIOMETRIC_VERIFY_MODES, type HikConnection, type HikAcsEvent } from "./isapi";
import { toConnection } from ".";

/**
 * Find the machine's local LAN IPv4 address (e.g. 192.168.x.x) so that physical
 * Hikvision terminals on the LAN can push events directly to this computer.
 */
export function getLocalLanIp(deviceIp?: string): string {
  const nets = os.networkInterfaces();
  const allIpv4: string[] = [];
  let matchingSubnetIp: string | null = null;

  const deviceSubnet = deviceIp ? deviceIp.split(".").slice(0, 3).join(".") : null;

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        allIpv4.push(net.address);
        if (deviceSubnet && net.address.startsWith(deviceSubnet)) {
          matchingSubnetIp = net.address;
        }
      }
    }
  }

  if (matchingSubnetIp) return matchingSubnetIp;

  const pref192 = allIpv4.find((ip) => ip.startsWith("192.168."));
  if (pref192) return pref192;
  const pref10 = allIpv4.find((ip) => ip.startsWith("10."));
  if (pref10) return pref10;
  const pref172 = allIpv4.find((ip) => /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip));
  if (pref172) return pref172;

  return allIpv4[0] || "127.0.0.1";
}

// ── Types ──

/** A normalized event extracted from a device push payload. */
export interface HikPushEvent {
  employeeNoString?: string | number;
  cardNo?: string | number;
  name?: string;
  major?: number | string;
  minor?: number | string;
  serialNo?: string | number;
  deviceId?: string | number;
  currentVerifyMode?: string;
  eventType?: string; // e.g. UserVerify, DoorEvent, Heartbeat
  time?: string;
}

export interface HikHttpHost {
  id: string;
  url: string;
  protocolType: string;
  parameterFormatType: string;
  addressingFormatType: string;
  ipAddress: string;
  portNo: string;
  httpAuthenticationType: string;
}

export interface PushResult {
  employeeNoString: string;
  time: string | null;
  attendance: boolean;
  outcome: BiometricEvent["type"];
  message?: string;
}

export interface PushProcessingReport {
  received: number;
  processed: number;
  ignored: number;
  results: PushResult[];
}

// ── In-memory ingestion stats ──

const MAX_PUSH_LOG = 200;
const PUSH_DEDUPE_WINDOW_MS = 60 * 60 * 1000; // 1 hour, same as the poller

const pushLog: PushResult[] = [];
const pushSerials = new Map<string, number>();
export const pushStats = { received: 0, processed: 0, ignored: 0, lastAt: null as string | null };

function bumpRawStats(report: PushProcessingReport): void {
  pushStats.received += report.received;
  pushStats.processed += report.processed;
  pushStats.ignored += report.ignored;
  pushStats.lastAt = new Date().toISOString();
}

export function getPushStats(): { received: number; processed: number; ignored: number; lastAt: string | null; log: PushResult[] } {
  return { ...pushStats, log: [...pushLog].reverse().slice(0, 20) };
}

function rememberPushSerial(key: string): boolean {
  const now = Date.now();
  const prev = pushSerials.get(key);
  if (prev && now - prev < PUSH_DEDUPE_WINDOW_MS) {
    return false;
  }
  pushSerials.set(key, now);
  if (pushSerials.size > 2000) {
    const oldest = pushSerials.keys().next().value;
    if (oldest) pushSerials.delete(oldest);
  }
  return true;
}

// ── Payload parsing ──

function findDeep(obj: any, keys: string[]): any {
  if (!obj || typeof obj !== "object") return undefined;
  const lowerKeys = keys.map((k) => k.toLowerCase());

  // Check top-level keys first
  for (const k of Object.keys(obj)) {
    if (lowerKeys.includes(k.toLowerCase())) {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }

  // Check nested objects
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const found = findDeep(v, keys);
      if (found !== undefined && found !== null && found !== "") return found;
    }
  }
  return undefined;
}

function num(v: unknown): number | string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return /^\d+$/.test(String(v)) ? Number(v) : String(v);
}

export function normalizeHikEvent(raw: Record<string, any>): HikPushEvent {
  const ev = raw ?? {};
  const employeeNo = findDeep(ev, [
    "employeeNoString",
    "EmployeeNoString",
    "employeeNo",
    "EmployeeNo",
    "employeeId",
    "EmployeeId",
    "personId",
    "PersonId",
    "userCode",
    "UserCode",
    "memberId",
    "MemberId",
    "studentId",
    "its",
    "ITS",
    "fingerprint",
    "Fingerprint",
  ]);

  const cardNo = findDeep(ev, ["cardNo", "CardNo", "card", "Card"]);
  const name = findDeep(ev, ["name", "Name", "personName", "PersonName", "userName", "UserName"]);
  const major = num(findDeep(ev, ["major", "Major", "majorEventType", "MajorEventType", "eventMajor", "majorType"]));
  const minor = num(findDeep(ev, ["minor", "Minor", "subEventType", "SubEventType", "eventMinor", "minorEventType", "minorType"]));
  const serialNo = findDeep(ev, ["serialNo", "SerialNo", "serial", "Serial", "eventID", "eventId", "EventID", "EventId", "seq"]);
  const deviceId = findDeep(ev, ["deviceId", "DeviceID", "deviceID", "deviceIndex", "deviceName", "DeviceName"]);
  const currentVerifyMode = findDeep(ev, ["currentVerifyMode", "CurrentVerifyMode", "verifyMode", "VerifyMode", "verifyMethod", "mode"]);
  const eventType = findDeep(ev, ["eventType", "EventType", "eventDescription", "EventDescription", "event", "Event"]);
  const time = findDeep(ev, ["time", "Time", "dateTime", "DateTime", "occurrenceTime", "OccurrenceTime", "deviceTime", "DeviceTime", "timestamp", "Timestamp"]);

  return {
    employeeNoString: employeeNo ? String(employeeNo).trim() : undefined,
    cardNo: cardNo ? String(cardNo).trim() : undefined,
    name: name ? String(name).trim() : undefined,
    major,
    minor,
    serialNo: serialNo ? String(serialNo).trim() : undefined,
    deviceId: deviceId ? String(deviceId).trim() : undefined,
    currentVerifyMode: currentVerifyMode ? String(currentVerifyMode).trim() : undefined,
    eventType: eventType ? String(eventType).trim() : undefined,
    time: time ? String(time).trim() : undefined,
  };
}

/** Unwrap the common Hikvision JSON envelopes: AccessControllerEvent / AcsEvent / eventNotificationAlert / InfoList. */
export function unwrapJsonPayload(obj: Record<string, any>): Record<string, any>[] {
  if (!obj || typeof obj !== "object") return [];

  // 1. MinMoe AccessControllerEvent wrapper (most common format)
  if (obj.AccessControllerEvent && typeof obj.AccessControllerEvent === "object") {
    const inner = obj.AccessControllerEvent;
    return [{ ...obj, ...inner }];
  }

  // 2. AcsEvent wrapper
  if (obj.AcsEvent && typeof obj.AcsEvent === "object") {
    const inner = obj.AcsEvent;
    return Array.isArray(inner) ? inner.map((e) => ({ ...obj, ...e })) : [{ ...obj, ...inner }];
  }

  // 3. Hikvision versioned envelope with nested info — e.g. iVMS-4200 signalled JSON.
  const keys = Object.keys(obj);
  for (const key of keys) {
    const v = obj[key];
    if (/eventnotificationalert/i.test(key)) {
      const inner = Array.isArray(v) ? v : [v];
      return inner.map((e) => ({ ...obj, ...(typeof e === "object" ? e : {}) }));
    }
  }

  // 4. InfoList wrapper (JSON export of AccessControl events pushed by some firmware).
  if (obj.InfoList && typeof obj.InfoList === "object") {
    const list = Array.isArray(obj.InfoList.AcsEvent) ? obj.InfoList.AcsEvent : [obj.InfoList.AcsEvent].filter(Boolean);
    if (list.length) return list.map((e: any) => ({ ...obj, ...e }));
  }

  // 5. An explicit list of events.
  if (Array.isArray(obj.events)) return obj.events;
  if (Array.isArray(obj.data)) return obj.data;
  if (Array.isArray(obj.MatchList)) return obj.MatchList;

  // Already a single normalised event
  return [obj];
}

export function jsonToPushEvents(obj: Record<string, any>): HikPushEvent[] {
  const events = unwrapJsonPayload(obj);
  const normalized: HikPushEvent[] = [];
  for (const ev of events) {
    // The legacy `{ fingerprint, timestamp }` gateway format is normalized into a HikPushEvent.
    if (typeof ev.fingerprint === "string" && !ev.AccessControllerEvent && !ev.AcsEvent) {
      normalized.push({
        employeeNoString: ev.fingerprint.trim(),
        time: ev.timestamp ? String(ev.timestamp) : undefined,
        deviceId: ev.deviceId ? String(ev.deviceId) : undefined,
        currentVerifyMode: ev.verifyMode ? String(ev.verifyMode) : "FACIAL",
      });
      continue;
    }
    normalized.push(normalizeHikEvent(ev));
  }
  return normalized;
}

/** Extract the text of XML elements with multiple possible tag names, tolerating namespaces and CDATA. */
export function xmlTag(xml: string, ...tags: string[]): string {
  for (const tag of tags) {
    const m = xml.match(
      new RegExp(
        `<(?:[a-zA-Z0-9_-]+:)?${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/(?:[a-zA-Z0-9_-]+:)?${tag}(?:[a-zA-Z0-9_.-]*)?>`,
        "i",
      ),
    );
    if (m?.[1]?.trim()) return m[1].trim();
  }
  return "";
}

function xmlToPushEvent(xml: string): HikPushEvent {
  const toNum = (s: string) => (s ? (/^\d+$/.test(s) ? Number(s) : s) : undefined);
  return {
    employeeNoString:
      xmlTag(xml, "employeeNoString", "employeeNo", "employeeId", "personId", "userCode", "its", "ITS") || undefined,
    cardNo: xmlTag(xml, "cardNo", "card") || undefined,
    name: xmlTag(xml, "personName", "name", "userName") || undefined,
    major: toNum(xmlTag(xml, "majorEventType", "major", "eventMajor", "majorType")),
    minor: toNum(xmlTag(xml, "subEventType", "minor", "eventMinor", "minorEventType")),
    serialNo: xmlTag(xml, "serialNo", "eventID", "eventId", "seq") || undefined,
    deviceId: xmlTag(xml, "deviceId", "deviceID", "deviceName") || undefined,
    currentVerifyMode: xmlTag(xml, "currentVerifyMode", "verifyMode", "verifyMethod") || undefined,
    eventType: xmlTag(xml, "eventType", "eventDescription", "event") || undefined,
    time: xmlTag(xml, "dateTime", "time", "occurrenceTime", "deviceTime", "timestamp") || undefined,
  };
}

export function xmlToPushEvents(xml: string): HikPushEvent[] {
  const events: HikPushEvent[] = [];

  // Grab every <EventNotificationAlert> or <AccessControllerEvent> block
  const re = /<(?:[a-zA-Z0-9_-]+:)?(?:EventNotificationAlert|AccessControllerEvent|AcsEvent)(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?(?:EventNotificationAlert|AccessControllerEvent|AcsEvent)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    events.push(xmlToPushEvent(m[1]));
  }
  if (events.length) return events;

  // Fallback: raw per-event fields at the root (some firmware pushes bare fields).
  const single = xmlToPushEvent(xml);
  if (single.time || single.employeeNoString !== undefined || single.eventType) return [single];

  return events;
}

function parseMultipart(buf: Buffer, boundary: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const text = buf.toString("utf8");
  const parts = text.split(`--${boundary}`);
  for (const part of parts) {
    const m = part.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"/i);
    if (!m) continue;
    const idx = part.indexOf("\r\n\r\n");
    if (idx === -1) continue;
    fields[m[1]] = part.slice(idx + 4).replace(/\r\n$/, "").trim();
  }
  return fields;
}

/**
 * Parse a Hikvision HTTP Event push into normalised events. Handles:
 *  - JSON `AccessControllerEvent` / `eventNotificationAlert` / iVMS style envelopes
 *  - XML `EventNotificationAlert` / `AccessControllerEvent`
 *  - URL-encoded notification envelopes (`method=PUT&url=...&dynamic=...`)
 *  - `multipart/form-data` bodies
 *  - the custom `{ fingerprint, timestamp, deviceId }` gateway format
 */
export function parseHikPushPayload(body: unknown, contentType?: string): { events: HikPushEvent[]; acknowledged: boolean } {
  let events: HikPushEvent[] = [];
  let acknowledged = false;

  const ctype = (contentType ?? "").toLowerCase();

  // Already-parsed object (global express.json/urlencoded ran first).
  if (body !== null && typeof body === "object" && !Buffer.isBuffer(body)) {
    if (typeof obj.fingerprint === "string" && !obj.AccessControllerEvent && !obj.AcsEvent) {
      events = [{
        employeeNoString: obj.fingerprint.trim(),
        time: obj.timestamp ? String(obj.timestamp) : undefined,
        deviceId: obj.deviceId ? String(obj.deviceId) : undefined,
        currentVerifyMode: obj.verifyMode ? String(obj.verifyMode) : "FACIAL",
      }];
    } else if (obj.method || obj.url) {
      acknowledged = Boolean(obj.url);
      const dynamic = obj.dynamic || obj.xml || obj.data || obj.message;
      if (dynamic && typeof dynamic === "string") {
        events = parseHikPushPayload(dynamic).events;
      }
    } else {
      events = jsonToPushEvents(obj);
    }
    return { events, acknowledged };
  }

  let buf: Buffer;
  if (Buffer.isBuffer(body)) buf = body;
  else if (typeof body === "string") buf = Buffer.from(body, "utf8");
  else return { events: [], acknowledged };

  const text = buf.toString("utf8").trim();
  if (!text) return { events: [], acknowledged };

  // multipart/form-data — extract fields then re-parse the meaningful one.
  if (ctype.includes("multipart/form-data")) {
    const bm = ctype.match(/boundary=([^;\s]+)/i);
    if (bm) {
      const fields = parseMultipart(buf, bm[1]);
      for (const key of ["xml", "message", "data", "payload", "event_log", "AcsEvent", "AccessControllerEvent"]) {
        if (fields[key]) {
          const inner = parseHikPushPayload(fields[key]);
          return { events: inner.events.length ? inner.events : jsonToPushEvents(fields as unknown as Record<string, any>), acknowledged: true };
        }
      }
      return { events: jsonToPushEvents(fields as unknown as Record<string, any>), acknowledged: true };
    }
  }

  // URL-encoded notification envelope (HTTP/HTTPS listening on older firmware):
  if (ctype.includes("x-www-form-urlencoded") || (ctype.includes("text/plain") && text.includes("&url="))) {
    const params = Object.fromEntries(new URLSearchParams(text));
    if (params.url || params.method) {
      acknowledged = Boolean(params.url);
      const dynamic = params.dynamic || params.xml || params.data || params.message;
      if (dynamic) {
        const inner = parseHikPushPayload(dynamic);
        events = inner.events;
      }
      return { events, acknowledged };
    }
  }

  // JSON
  if (ctype.includes("json") || text.startsWith("{")) {
    try {
      events = jsonToPushEvents(JSON.parse(text));
      if (events.length > 0) return { events, acknowledged: true };
    } catch {
      events = [];
    }
  }

  // XML
  if (ctype.includes("xml") || text.startsWith("<")) {
    events = xmlToPushEvents(text);
    return { events, acknowledged: true };
  }

  // Last resort sniff
  if (text.startsWith("{")) {
    try {
      events = jsonToPushEvents(JSON.parse(text));
    } catch {
      events = [];
    }
  } else if (/<EventNotificationAlert|<AccessControllerEvent|<\/?[a-zA-Z]/.test(text)) {
    events = xmlToPushEvents(text);
  }

  return { events, acknowledged };
}

// ── Processing ──

/**
 * Turn parsed push events into attendance records.
 */
export async function processPushEvents(events: HikPushEvent[], source: string): Promise<PushProcessingReport> {
  const report: PushProcessingReport = { received: events.length, processed: 0, ignored: 0, results: [] };

  for (const ev of events) {
    let employee = String(ev.employeeNoString ?? "").trim();
    const eventType = String(ev.eventType ?? "").trim();

    // 1. Terminal Heartbeat (periodic keepalive packet sent every ~30s by MinMoe)
    if (!employee && (/heartbeat|keepalive|status/i.test(eventType) || (!ev.cardNo && !ev.name))) {
      report.ignored++;
      report.results.push({
        employeeNoString: "",
        time: ev.time ?? new Date().toISOString(),
        attendance: false,
        outcome: "SYSTEM",
        message: `Heartbeat acknowledged (${eventType || "Terminal Active"})`,
      });
      continue;
    }

    // 2. Classify verification method: Face / Fingerprint vs pure RFID card
    const modeStr = String(ev.currentVerifyMode ?? "").toLowerCase();
    const minorNum = Number(ev.minor);
    const eventTypeStr = String(ev.eventType ?? "").toLowerCase();

    const isFaceScan =
      modeStr.includes("face") ||
      modeStr.includes("facial") ||
      modeStr === "15" ||
      modeStr === "6" ||
      modeStr === "12" ||
      minorNum === 75 || // 0x4B: Face verification passed
      minorNum === 76 || // 0x4C: Face + Card passed
      minorNum === 77 || // 0x4D: Face + Password passed
      minorNum === 11 || // Face pass
      minorNum === 12 || // Face + Password pass
      minorNum === 13 || // Face + Fingerprint pass
      eventTypeStr.includes("face") ||
      eventTypeStr.includes("facial");

    const isFingerprintScan =
      modeStr.includes("finger") ||
      modeStr.includes("fp") ||
      modeStr === "3" ||
      modeStr === "4" ||
      modeStr === "5" ||
      modeStr === "16" ||
      minorNum === 7 ||
      minorNum === 8 ||
      minorNum === 9 ||
      minorNum === 10 ||
      minorNum === 78 ||
      eventTypeStr.includes("finger") ||
      eventTypeStr.includes("fp");

    const isBioScan =
      isFaceScan ||
      isFingerprintScan ||
      (minorNum ? BIOMETRIC_PASS_MINORS.has(minorNum) : false) ||
      (/^\d+$/.test(modeStr) ? BIOMETRIC_VERIFY_MODES.has(Number(modeStr)) : false);

    // Reject pure RFID card-only passes if strictly not a facial or fingerprint scan
    if (
      !isBioScan &&
      (modeStr === "1" ||
        modeStr === "2" ||
        minorNum === 5 ||
        minorNum === 6 ||
        minorNum === 20 ||
        (modeStr.includes("card") && !modeStr.includes("face") && !modeStr.includes("finger")))
    ) {
      report.ignored++;
      report.results.push({
        employeeNoString: String(ev.employeeNoString ?? ev.cardNo ?? ""),
        time: ev.time ?? null,
        attendance: false,
        outcome: "SYSTEM",
        message: "RFID card scanning ignored. Attendance is recorded via Face scan or Fingerprint.",
      });
      continue;
    }

    // Resolve employee reference: if employeeNoString was not passed but cardNo was passed during a Face/Biometric scan, use cardNo
    if (!employee && ev.cardNo && isBioScan) {
      employee = String(ev.cardNo).trim();
    }

    if (!employee) {
      if (ev.cardNo) {
        report.ignored++;
        report.results.push({
          employeeNoString: String(ev.cardNo),
          time: ev.time ?? null,
          attendance: false,
          outcome: "SYSTEM",
          message: "Card scan ignored. Please use Face or Fingerprint scanner.",
        });
        continue;
      }
      report.ignored++;
      report.results.push({ employeeNoString: "", time: ev.time ?? null, attendance: false, outcome: "SYSTEM", message: `${eventType || "Event"}: no employee reference` });
      continue;
    }

    // De-duplicate against events that arrived in the last hour, scoped by device
    const serial = String(ev.serialNo ?? "").trim();
    if (serial) {
      const key = `push:${ev.deviceId ? ev.deviceId + ":" : ""}${serial}`;
      if (!rememberPushSerial(key)) {
        report.ignored++;
        report.results.push({ employeeNoString: employee, time: ev.time ?? null, attendance: false, outcome: "SYSTEM", message: "Duplicate event (serial already seen)" });
        continue;
      }
    }

    // Record attendance for this employee/student scan
    try {
      const deviceRef = String(ev.deviceId ?? "").trim();
      const verifyMethod = isFaceScan ? "FACIAL" : isFingerprintScan ? "FINGERPRINT" : (ev.currentVerifyMode || "FACIAL");
      const result: BiometricEvent = await processBiometricScan(
        employee,
        ev.time ? new Date(ev.time) : new Date(),
        deviceRef ? `hikvision:push:${deviceRef}` : source,
        verifyMethod,
      );
      report.processed++;
      report.results.push({
        employeeNoString: employee,
        time: ev.time ?? null,
        attendance: true,
        outcome: result.type,
        message: result.message,
      });
    } catch (error) {
      console.error("[hikvision:push] scan processing error:", error);
      report.ignored++;
      report.results.push({ employeeNoString: employee, time: ev.time ?? null, attendance: true, outcome: "UNKNOWN", message: error instanceof Error ? error.message : String(error) });
    }
  }

  if (report.received) {
    pushLog.push(...report.results);
    while (pushLog.length > MAX_PUSH_LOG) pushLog.shift();
  }
  bumpRawStats(report);
  return report;
}

// ── HTTP Event Listening (device-side httpHosts / ISAPI Event/notification) ──

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface HikHostRaw {
  id?: string;
  url?: string;
  protocolType?: string;
  parameterFormatType?: string;
  addressingFormatType?: string;
  ipAddress?: string;
  portNo?: string;
  httpAuthenticationType?: string;
}

function parseHttpHostsXml(xml: string): HikHttpHost[] {
  const hosts: HikHttpHost[] = [];
  const re = /<(?:[a-zA-Z0-9_-]+:)?HttpHostNotification(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?HttpHostNotification>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    hosts.push({
      id: xmlTag(m[1], "id"),
      url: xmlTag(m[1], "url"),
      protocolType: xmlTag(m[1], "protocolType"),
      parameterFormatType: xmlTag(m[1], "parameterFormatType"),
      addressingFormatType: xmlTag(m[1], "addressingFormatType"),
      ipAddress: xmlTag(m[1], "ipAddress"),
      portNo: xmlTag(m[1], "portNo"),
      httpAuthenticationType: xmlTag(m[1], "httpAuthenticationType"),
    });
  }
  return hosts;
}

export async function getHttpHosts(conn: HikConnection): Promise<HikHttpHost[]> {
  const res = await digestFetch(`${conn.useHttps ? "https" : "http"}://${conn.host}:${conn.port}/ISAPI/Event/notification/httpHosts`, {
    method: "GET",
    username: conn.username,
    password: conn.password,
    timeoutMs: conn.timeoutMs ?? 8000,
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error(`Bad device credentials for ${conn.host}${await authFailureHint(res)}`);
    return [];
  }
  const xml = await res.text();
  return parseHttpHostsXml(xml);
}

function hostToXml(host: HikHttpHost | HikHostRaw): string {
  const ip = host.addressingFormatType === "hostname" ? "" : host.ipAddress ?? "";
  return [
    "<HttpHostNotification>",
    `<id>${escapeXml(host.id ?? "")}</id>`,
    `<url>${escapeXml(host.url ?? "")}</url>`,
    `<protocolType>${escapeXml(host.protocolType ?? "HTTP")}</protocolType>`,
    `<parameterFormatType>${escapeXml(host.parameterFormatType ?? "XML")}</parameterFormatType>`,
    `<addressingFormatType>${escapeXml(host.addressingFormatType ?? "ipaddress")}</addressingFormatType>`,
    host.addressingFormatType !== "hostname" ? `<ipAddress>${escapeXml(ip)}</ipAddress>` : "",
    `<portNo>${escapeXml(host.portNo ?? "")}</portNo>`,
    `<httpAuthenticationType>${escapeXml(host.httpAuthenticationType ?? "none")}</httpAuthenticationType>`,
    "<SubscribeEventList>",
    "<EventNotify>",
    "<NotifyType>accessControl</NotifyType>",
    "<EventList>",
    "<Event>DoorEvent</Event>",
    "<Event>UserVerify</Event>",
    "</EventList>",
    "</EventNotify>",
    "</SubscribeEventList>",
    "</HttpHostNotification>",
  ]
    .filter((l) => l !== "")
    .join("");
}

/** Replace the full httpHosts list on the device. */
export async function setHttpHosts(conn: HikConnection, hosts: Array<HikHttpHost | HikHostRaw>): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><HttpHostNotificationList>${hosts.map(hostToXml).join("")}</HttpHostNotificationList>`;
  const res = await digestFetch(`${conn.useHttps ? "https" : "http"}://${conn.host}:${conn.port}/ISAPI/Event/notification/httpHosts`, {
    method: "PUT",
    headers: { "Content-Type": "application/xml" },
    body: xml,
    username: conn.username,
    password: conn.password,
    timeoutMs: conn.timeoutMs ?? 8000,
  });
  if (!res.ok) throw new Error(`Device rejected HTTP host configuration (HTTP ${res.status})`);
}

export async function deleteHttpHost(conn: HikConnection, id: string): Promise<void> {
  const res = await digestFetch(`${conn.useHttps ? "https" : "http"}://${conn.host}:${conn.port}/ISAPI/Event/notification/httpHosts/${encodeURIComponent(id)}`, {
    method: "DELETE",
    username: conn.username,
    password: conn.password,
    timeoutMs: conn.timeoutMs ?? 8000,
  });
  if (!res.ok && res.status !== 404) throw new Error(`Failed to remove HTTP host (HTTP ${res.status})`);
}

function splitHostPort(url: string): { host: string; port: string; addressingFormatType: string } {
  try {
    const u = new URL(url);
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname);
    return { host: u.hostname, port: u.port || (u.protocol === "https:" ? "443" : "80"), addressingFormatType: isIp ? "ipaddress" : "hostname" };
  } catch {
    return { host: url, port: "80", addressingFormatType: "hostname" };
  }
}

/**
 * Compare two webhook URLs by their path only — devices store the host entry
 * as a bare path (`/api/hikvision/events`) while the server builds absolute
 * URLs (`http://192.168.x.x:4000/api/hikvision/events`).
 */
export function sameWebhookPath(a: string, b: string): boolean {
  if (!a || !b) return false;
  const pathOf = (u: string) => {
    try {
      return new URL(u, "http://placeholder.invalid").pathname.replace(/\/+$/, "");
    } catch {
      return u.replace(/\/+$/, "");
    }
  };
  return pathOf(a) === pathOf(b);
}

export function isPrivateLanHost(host: string): boolean {
  if (!host) return true;
  const trimmed = host.trim().toLowerCase();
  if (trimmed === "localhost" || trimmed === "127.0.0.1" || trimmed === "0.0.0.0" || trimmed.endsWith(".local")) return true;
  if (/^192\.168\./.test(trimmed)) return true;
  if (/^10\./.test(trimmed)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(trimmed)) return true;
  if (/^169\.254\./.test(trimmed)) return true;
  return false;
}

/**
 * Configure the device to push access-control events to `pushUrl`.
 *
 * In cloud deployments (e.g. Render), private LAN IP addresses cannot be reached
 * inbound from cloud. In this mode, we mark the device as ONLINE (Cloud Webhook Ready)
 * and return the full public Webhook URL so the administrator can configure the terminal.
 */
export async function configureDevicePush(
  deviceId: string,
  pushUrl: string,
  format: "XML" | "JSON" = "XML",
): Promise<{ webhookUrl: string; hosts: HikHttpHost[]; mode?: string; message?: string }> {
  const device = await prisma.biometricDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Device not found");

  const isCloud = Boolean(process.env.RENDER || process.env.NODE_ENV === "production");
  const isLan = isPrivateLanHost(device.host);

  // If pushUrl uses localhost or 127.0.0.1, replace with the machine's real LAN IP
  let effectiveUrl = pushUrl;
  if (effectiveUrl.includes("localhost") || effectiveUrl.includes("127.0.0.1")) {
    const lanIp = getLocalLanIp(device.host);
    effectiveUrl = effectiveUrl.replace(/localhost|127\.0\.0\.1/g, lanIp);
    effectiveUrl = effectiveUrl.replace(":3000", ":4000");
  }

  // If running in cloud with a private LAN IP, do not hang on unreachable IP
  if (isCloud && isLan) {
    await prisma.biometricDevice.update({
      where: { id: deviceId },
      data: { status: "ONLINE", lastError: null, lastSeenAt: new Date(), lastPolledAt: new Date() },
    });
    return {
      webhookUrl: effectiveUrl,
      hosts: [],
      mode: "CLOUD_WEBHOOK",
      message: "Device marked ONLINE in Cloud Webhook mode. Enter this Webhook URL into the MinMoe terminal settings to receive real-time scans.",
    };
  }

  try {
    const conn = toConnection(device);
    const existing = await getHttpHosts(conn).catch(() => []);

    let targetId: string | undefined = existing.find((h) => sameWebhookPath(h.url, effectiveUrl))?.id;
    if (!targetId) targetId = existing.find((h) => !h.url)?.id;
    if (!targetId) {
      const ids = existing.map((h) => Number(h.id) || 0);
      targetId = String((ids.length ? Math.max(...ids) : 0) + 1);
    }

    const { host, port, addressingFormatType } = splitHostPort(effectiveUrl);
    const pathOnly = (() => {
      try {
        return new URL(effectiveUrl).pathname;
      } catch {
        return effectiveUrl.startsWith("/") ? effectiveUrl : `/${effectiveUrl}`;
      }
    })();

    const singleXml = hostToXml({
      id: targetId,
      url: pathOnly,
      protocolType: "HTTP",
      parameterFormatType: format,
      addressingFormatType,
      ipAddress: host,
      portNo: port,
      httpAuthenticationType: "none",
    });

    const putRes = await digestFetch(`${conn.useHttps ? "https" : "http"}://${conn.host}:${conn.port}/ISAPI/Event/notification/httpHosts/${encodeURIComponent(targetId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/xml" },
      body: singleXml,
      username: conn.username,
      password: conn.password,
      timeoutMs: 4000,
    });

    if (!putRes.ok) {
      // Legacy fallback: replace the whole list.
      await setHttpHosts(conn, [
        ...existing.filter((h) => !sameWebhookPath(h.url, pushUrl)),
        {
          id: targetId,
          url: pathOnly,
          protocolType: "HTTP",
          parameterFormatType: format,
          addressingFormatType,
          ipAddress: host,
          portNo: port,
          httpAuthenticationType: "none",
        },
      ]).catch(() => {});
    }

    const hosts = await getHttpHosts(conn).catch(() => []);
    await prisma.biometricDevice.update({
      where: { id: deviceId },
      data: { status: "ONLINE", lastError: null, lastSeenAt: new Date(), lastPolledAt: new Date() },
    });

    return { webhookUrl: effectiveUrl, hosts, mode: "DIRECT_PUSH" };
  } catch (error: any) {
    console.warn(`[hikvision:push] Direct ISAPI push unreachable for ${device.host}: ${error?.message || error}. Falling back to Cloud Webhook mode.`);
    await prisma.biometricDevice.update({
      where: { id: deviceId },
      data: { status: "ONLINE", lastError: null, lastSeenAt: new Date(), lastPolledAt: new Date() },
    });
    return {
      webhookUrl: effectiveUrl,
      hosts: [],
      mode: "WEBHOOK_READY",
      message: "Webhook ready. Configure this URL in the terminal web interface (HTTP Listening / Alarm Server).",
    };
  }
}

/** Remove a previously-configured push host URL from the device. */
export async function removeDevicePushUrl(deviceId: string, pushUrl: string): Promise<HikHttpHost[]> {
  const device = await prisma.biometricDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Device not found");

  const conn = toConnection(device);
  const existing = await getHttpHosts(conn);
  const mine = existing.filter((h) => sameWebhookPath(h.url, pushUrl));
  const rest = existing.filter((h) => !sameWebhookPath(h.url, pushUrl));
  for (const host of mine) {
    await deleteHttpHost(conn, host.id);
  }
  return getHttpHosts(conn);
}