import os from "node:os";
import prisma from "../prisma";
import { processBiometricScan, type BiometricEvent } from "../biometric";
import { authFailureHint, digestFetch } from "./digest";
import { isAttendanceEvent, type HikConnection, type HikAcsEvent } from "./isapi";
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

function pick(obj: Record<string, any>, keys: string[]): any {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

function num(v: unknown): number | string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return /^\d+$/.test(String(v)) ? Number(v) : String(v);
}

export function normalizeHikEvent(raw: Record<string, any>): HikPushEvent {
  const ev = raw ?? {};
  return {
    employeeNoString: pick(ev, ["employeeNoString", "EmployeeNoString", "employeeNo", "employeeId", "personId", "userCode"]),
    cardNo: pick(ev, ["cardNo", "CardNo"]),
    name: pick(ev, ["name", "Name", "personName"]),
    major: num(pick(ev, ["major", "Major", "eventMajor"])),
    minor: num(pick(ev, ["minor", "Minor", "eventMinor"])),
    serialNo: pick(ev, ["serialNo", "SerialNo", "serial", "eventID", "eventId"]),
    deviceId: pick(ev, ["deviceId", "DeviceID", "deviceID", "deviceIndex"]),
    currentVerifyMode: pick(ev, ["currentVerifyMode", "CurrentVerifyMode", "verifyMode", "verifyMethod"]),
    eventType: pick(ev, ["eventType", "EventType", "event"]),
    time: pick(ev, ["time", "Time", "dateTime", "occurrenceTime", "deviceTime"]),
  };
}

/** Unwrap the common Hikvision JSON envelopes: eventNotificationAlert / EventNotificationAlert / InfoList. */
export function unwrapJsonPayload(obj: Record<string, any>): Record<string, any>[] {
  if (!obj || typeof obj !== "object") return [];

  const keys = Object.keys(obj);

  // Hikvision versioned envelope with nested info — e.g. iVMS-4200 signalled JSON.
  for (const key of keys) {
    const v = obj[key];
    if (/eventnotificationalert/i.test(key)) {
      const inner = Array.isArray(v) ? v : [v];
      return inner.map((e) => normalizeHikEvent(e).time ? { ...e } : e).filter(Boolean);
    }
  }

  // InfoList wrapper (JSON export of AccessControl events pushed by some firmware).
  if (obj.InfoList && typeof obj.InfoList === "object") {
    const list = Array.isArray(obj.InfoList.AcsEvent) ? obj.InfoList.AcsEvent : [obj.InfoList.AcsEvent].filter(Boolean);
    if (list.length) return list;
  }

  // An explicit list of events.
  if (Array.isArray(obj.events)) return obj.events;
  if (Array.isArray(obj.data)) return obj.data;

  // Already a single normalised event (or the raw custom webhook format).
  return [obj];
}

export function jsonToPushEvents(obj: Record<string, any>): HikPushEvent[] {
  const events = unwrapJsonPayload(obj);
  const normalized: HikPushEvent[] = [];
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    // The legacy `{ fingerprint, timestamp }` gateway format is processed by
    // the webhook route directly — never treat it as a device event.
    if (typeof ev.fingerprint === "string") continue;
    normalized.push(normalizeHikEvent(ev));
  }
  return normalized;
}

/** Extract the text of a single XML element, tolerating namespaces, CDATA and suffixed names (e.g. dateTimeV10). */
export function xmlTag(xml: string, tag: string): string {
  const m = xml.match(
    new RegExp(
      `<(?:[a-zA-Z0-9_-]+:)?${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/(?:[a-zA-Z0-9_-]+:)?${tag}(?:[a-zA-Z0-9_.-]*)?>`,
      "i",
    ),
  );
  return m?.[1]?.trim() ?? "";
}

function xmlToPushEvent(xml: string): HikPushEvent {
  const toNum = (s: string) => (s ? (/^\d+$/.test(s) ? Number(s) : s) : undefined);
  return {
    employeeNoString: xmlTag(xml, "employeeNoString") || xmlTag(xml, "employeeNo") || undefined,
    cardNo: xmlTag(xml, "cardNo") || undefined,
    name: xmlTag(xml, "personName") || xmlTag(xml, "name") || undefined,
    major: toNum(xmlTag(xml, "major")),
    minor: toNum(xmlTag(xml, "minor")),
    serialNo: xmlTag(xml, "serialNo") || xmlTag(xml, "eventID") || xmlTag(xml, "eventId") || undefined,
    deviceId: xmlTag(xml, "deviceId") || xmlTag(xml, "deviceID") || undefined,
    currentVerifyMode: xmlTag(xml, "currentVerifyMode") || xmlTag(xml, "verifyMode") || undefined,
    eventType: xmlTag(xml, "eventType") || undefined,
    time: xmlTag(xml, "time") || xmlTag(xml, "dateTime") || undefined,
  };
}

export function xmlToPushEvents(xml: string): HikPushEvent[] {
  const events: HikPushEvent[] = [];

  // Grab every <EventNotificationAlert> block (handles both a single alert and a list).
  const re = /<(?:[a-zA-Z0-9_-]+:)?EventNotificationAlert(?:\s[^>]*)?>([\s\S]*?)<\/(?:[a-zA-Z0-9_-]+:)?EventNotificationAlert>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    events.push(xmlToPushEvent(m[1]));
  }
  if (events.length) return events;

  // Fallback: raw per-event fields at the root (some firmware pushes bare fields).
  const single = xmlToPushEvent(xml);
  if (single.time || single.employeeNoString !== undefined) return [single];

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
 *  - JSON `eventNotificationAlert` / iVMS style envelopes
 *  - XML `EventNotificationAlert` / `EventNotificationAlertList`
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
    const obj = body as Record<string, any>;
    // Custom webhook format stays in its own processing path.
    if (typeof obj.fingerprint === "string" && (obj.timestamp !== undefined || obj.deviceId !== undefined)) {
      events = [];
    } else if (obj.method || obj.url) {
      // URL-encoded notification envelope (method=PUT&url=...&dynamic=...)
      // that express.urlencoded already turned into an object.
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
      for (const key of ["xml", "message", "data", "payload"]) {
        if (fields[key]) {
          const inner = parseHikPushPayload(fields[key]);
          return { events: inner.events.length ? inner.events : jsonToPushEvents(fields as unknown as Record<string, any>), acknowledged };
        }
      }
      return { events: jsonToPushEvents(fields as unknown as Record<string, any>), acknowledged };
    }
  }

  // URL-encoded notification envelope (HTTP/HTTPS listening on older firmware):
  // method=PUT&url=/ISAPI/...&dynamic=<xml-or-json>&servicename=...
  if (ctype.includes("x-www-form-urlencoded") || (ctype.includes("text/plain") && text.includes("&url="))) {
    const params = Object.fromEntries(new URLSearchParams(text));
    if (params.url || params.method) {
      acknowledged = Boolean(params.url);
      const dynamic = params.dynamic || params.xml || params.data || params.message;
      if (dynamic) {
        const inner = parseHikPushPayload(dynamic);
        events = inner.events;
      }
      // Without parseable details we only acknowledge; the ISAPI poller picks the
      // event up reliably on its next pass.
      return { events, acknowledged };
    }
  }

  // XML (bare parseable tags despite the reported content-type).
  if (ctype.includes("json") && text.startsWith("{")) {
    try {
      events = jsonToPushEvents(JSON.parse(text));
    } catch {
      events = [];
    }
    return { events, acknowledged };
  }

  if (ctype.includes("xml") || text.startsWith("<")) {
    events = xmlToPushEvents(text);
    if (events.length === 0 && /<Heartbeat/i.test(text)) events = [];
    return { events, acknowledged };
  }

  // Last resort: sniff.
  if (text.startsWith("{")) {
    try {
      events = jsonToPushEvents(JSON.parse(text));
    } catch {
      events = [];
    }
  } else if (/<EventNotificationAlert|<\/?[a-zA-Z]/.test(text)) {
    events = xmlToPushEvents(text);
  }

  return { events, acknowledged };
}

// ── Processing ──

/**
 * Turn parsed push events into attendance records. Events that are not
 * recognised as successful fingerprint/face verifications are acknowledged but
 * not recorded (they are reported as IGNORED so the admin can inspect them).
 */
export async function processPushEvents(events: HikPushEvent[], source: string): Promise<PushProcessingReport> {
  const report: PushProcessingReport = { received: events.length, processed: 0, ignored: 0, results: [] };

  for (const ev of events) {
    // Explicitly reject RFID card scans — policy only permits Fingerprint and Face scan
    const modeStr = String(ev.currentVerifyMode ?? "").toLowerCase();
    const minorNum = Number(ev.minor);
    if (
      modeStr === "1" ||
      modeStr === "2" ||
      minorNum === 5 ||
      minorNum === 6 ||
      minorNum === 20 ||
      minorNum === 38 ||
      (modeStr.includes("card") && !modeStr.includes("face") && !modeStr.includes("finger"))
    ) {
      report.ignored++;
      report.results.push({
        employeeNoString: String(ev.employeeNoString ?? ev.cardNo ?? ""),
        time: ev.time ?? null,
        attendance: false,
        outcome: "SYSTEM",
        message: "RFID card scanning disabled. Attendance is only permitted via Fingerprint or Face scan.",
      });
      continue;
    }

    const employee = String(ev.employeeNoString ?? "").trim();
    if (!employee) {
      if (ev.cardNo) {
        report.ignored++;
        report.results.push({
          employeeNoString: String(ev.cardNo),
          time: ev.time ?? null,
          attendance: false,
          outcome: "SYSTEM",
          message: "RFID card scan ignored. Please use Fingerprint or Face scanner.",
        });
        continue;
      }
      // No user reference at all — purely a heart-beat / door event.
      if (ev.eventType && !/verify|door|pass|face|finger/i.test(ev.eventType)) {
        report.ignored++;
        report.results.push({ employeeNoString: "", time: ev.time ?? null, attendance: false, outcome: "SYSTEM", message: `${ev.eventType}: no employee reference` });
        continue;
      }
    }

    // De-duplicate against events that arrived in the last hour.
    const serial = String(ev.serialNo ?? "").trim();
    if (serial) {
      const key = `push:${serial}`;
      if (!rememberPushSerial(key)) {
        report.ignored++;
        report.results.push({ employeeNoString: employee, time: ev.time ?? null, attendance: false, outcome: "SYSTEM", message: "Duplicate event (serial already seen)" });
        continue;
      }
    }

    const attendance = employee ? isAttendanceEvent(ev as HikAcsEvent) : false;
    if (!attendance) {
      report.ignored++;
      report.results.push({ employeeNoString: employee, time: ev.time ?? null, attendance: false, outcome: "SYSTEM", message: `Ignored non-biometric event major=${String(ev.major ?? "")} minor=${String(ev.minor ?? "")} ${ev.eventType ? `type=${ev.eventType}` : ""}` });
      continue;
    }

    try {
      const deviceRef = String(ev.deviceId ?? "").trim();
      const result: BiometricEvent = await processBiometricScan(
        employee,
        ev.time ? new Date(ev.time) : new Date(),
        deviceRef ? `hikvision:push:${deviceRef}` : source,
        ev.currentVerifyMode,
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

/**
 * Configure the device to push access-control events to `pushUrl`.
 *
 * Many newer firmwares (e.g. DS-K1T341CMF V3.3.x) silently ignore a full-list
 * `PUT /ISAPI/Event/notification/httpHosts`, so we write a single host via
 * `PUT .../httpHosts/{id}` — reusing an empty placeholder slot when present —
 * and fall back to the full-list write only if that fails.
 */
export async function configureDevicePush(
  deviceId: string,
  pushUrl: string,
  format: "XML" | "JSON" = "XML",
): Promise<{ webhookUrl: string; hosts: HikHttpHost[] }> {
  const device = await prisma.biometricDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Device not found");

  // If pushUrl uses localhost or 127.0.0.1, replace with the machine's real LAN IP
  let effectiveUrl = pushUrl;
  if (effectiveUrl.includes("localhost") || effectiveUrl.includes("127.0.0.1")) {
    const lanIp = getLocalLanIp(device.host);
    effectiveUrl = effectiveUrl.replace(/localhost|127\.0\.0\.1/g, lanIp);
    effectiveUrl = effectiveUrl.replace(":3000", ":4000");
  }

  const conn = toConnection(device);
  const existing = await getHttpHosts(conn);

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
    timeoutMs: conn.timeoutMs ?? 8000,
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
        httpAuthenticationType: process.env.BIOMETRIC_SECRET ? "none" : "none",
      },
    ]);
  }

  const hosts = await getHttpHosts(conn);
  const applied = hosts.some((h) => sameWebhookPath(h.url, effectiveUrl));
  if (!applied) {
    throw new Error("Device did not accept the HTTP listening configuration");
  }

  await prisma.biometricDevice.update({
    where: { id: deviceId },
    data: { status: "ONLINE", lastError: null, lastSeenAt: new Date(), lastPolledAt: new Date() },
  });

  return { webhookUrl: effectiveUrl, hosts };
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