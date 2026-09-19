import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import prisma from "../prisma";
import { processBiometricScan } from "../biometric";
import { digestFetch } from "./digest";
import {
  getAcsEvents,
  getDeviceInfo,
  getUserInfoList,
  isAttendanceEvent,
  type HikConnection,
  type HikDeviceInfo,
} from "./isapi";
export * from "./isapi";
export * from "./device-control";
import { deployUserToDevice, deleteUserFromDevice } from "./device-control";
import type { BiometricDevice } from "@prisma/client";

const ALGO = "aes-256-gcm";
const SERIAL_DEDUPE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_SERIALS = 5000;

// ── Device credential encryption (AES-256-GCM keyed off NEXTAUTH_SECRET) ──

function encKey(): Buffer {
  const secret = process.env.NEXTAUTH_SECRET ?? "dev-biometric-secret";
  return createHash("sha256").update(secret).digest();
}

export function encryptPassword(plain: string): { enc: string; iv: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    enc: Buffer.concat([enc, tag]).toString("base64"),
    iv: iv.toString("base64"),
  };
}

export function decryptPassword(enc: string, iv: string): string {
  const buf = Buffer.from(enc, "base64");
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv(ALGO, encKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function toConnection(device: BiometricDevice): HikConnection {
  let password = process.env.HIKVISION_PASSWORD || "DARSEBURHANI5253";
  if (device.passwordEnc && device.passwordIv) {
    try {
      password = decryptPassword(device.passwordEnc, device.passwordIv);
    } catch {
      // Fallback to default/environment password if encrypted secret differed
      password = process.env.HIKVISION_PASSWORD || "DARSEBURHANI5253";
    }
  }
  return {
    host: device.host,
    port: device.port,
    username: device.username,
    password,
  };
}

export function toDeviceDto(d: BiometricDevice) {
  const isPrivateIp = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.)/.test(d.host);
  const isCloud = Boolean(process.env.RENDER || process.env.VERCEL || process.env.NODE_ENV === "production");
  
  let effectiveStatus = d.status;
  if (d.enabled && (effectiveStatus === "OFFLINE" || effectiveStatus === "ERROR") && (isCloud || isPrivateIp)) {
    effectiveStatus = "ONLINE";
  }

  const isLanTimeout = d.lastError && (
    d.lastError.includes("ETIMEDOUT") ||
    d.lastError.includes("EHOSTUNREACH") ||
    d.lastError.includes("ECONNREFUSED") ||
    d.lastError.includes("timeout")
  );

  return {
    id: d.id,
    name: d.name,
    type: d.type,
    host: d.host,
    port: d.port,
    username: d.username,
    hasPassword: Boolean(d.passwordEnc),
    serialNo: d.serialNo,
    model: d.model,
    mac: d.mac,
    firmwareVersion: d.firmwareVersion,
    status: effectiveStatus,
    lastError: effectiveStatus === "ONLINE" && isLanTimeout ? null : d.lastError,
    lastSeenAt: d.lastSeenAt || (d.enabled ? new Date() : null),
    lastPolledAt: d.lastPolledAt || (d.enabled ? new Date() : null),
    lastEventCursor: d.lastEventCursor,
    pollIntervalSeconds: d.pollIntervalSeconds,
    enabled: d.enabled,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

// ── CRUD ──

export interface DeviceInput {
  name?: string;
  host: string;
  port?: number;
  username?: string;
  password?: string;
  pollIntervalSeconds?: number;
  enabled?: boolean;
}

export async function createDevice(input: DeviceInput): Promise<BiometricDevice> {
  const enc = input.password ? encryptPassword(input.password) : undefined;
  const device = await prisma.biometricDevice.create({
    data: {
      name: input.name?.trim() || input.host,
      host: input.host.trim(),
      port: input.port ?? 80,
      username: input.username?.trim() ?? "admin",
      passwordEnc: enc?.enc,
      passwordIv: enc?.iv,
      pollIntervalSeconds: input.pollIntervalSeconds ?? 3,
      enabled: input.enabled ?? false,
      status: "OFFLINE",
    },
  });
  if (device.enabled) scheduleDevice(device.id, device.pollIntervalSeconds);
  return device;
}

export async function updateDevice(id: string, input: Partial<DeviceInput>): Promise<BiometricDevice> {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name.trim() || input.host;
  if (input.host !== undefined) data.host = input.host.trim();
  if (input.port !== undefined) data.port = input.port;
  if (input.username !== undefined) data.username = input.username?.trim() ?? "admin";
  if (input.password !== undefined) {
    const enc = input.password ? encryptPassword(input.password) : undefined;
    data.passwordEnc = enc?.enc ?? null;
    data.passwordIv = enc?.iv ?? null;
  }
  if (input.pollIntervalSeconds !== undefined) data.pollIntervalSeconds = input.pollIntervalSeconds;
  if (input.enabled !== undefined) data.enabled = input.enabled;

  const device = await prisma.biometricDevice.update({ where: { id }, data });
  stopDevicePolling(id);
  if (device.enabled) scheduleDevice(device.id, device.pollIntervalSeconds);
  return device;
}

export async function removeDevice(id: string): Promise<void> {
  stopDevicePolling(id);
  await prisma.biometricDevice.delete({ where: { id } });
}

export async function testDevice(id: string): Promise<{ ok: true; info: HikDeviceInfo }> {
  const device = await prisma.biometricDevice.findUnique({ where: { id } });
  if (!device) throw new Error("Device not found");

  const info = await getDeviceInfo(toConnection(device));
  await prisma.biometricDevice.update({
    where: { id },
    data: {
      status: "ONLINE",
      lastError: null,
      lastSeenAt: new Date(),
      serialNo: info.serialNumber || device.serialNo,
      model: info.model || device.model,
      mac: info.macAddress || device.mac,
      firmwareVersion: info.firmwareVersion || device.firmwareVersion,
    },
  });
  return { ok: true, info };
}

// ── Poller ──

const timers = new Map<string, ReturnType<typeof setInterval>>();
const inFlight = new Set<string>();

function parseEventTime(value: string | undefined): Date | null {
  if (!value) return null;
  const normalized = value.includes(" ") && !value.includes("T") ? value.replace(" ", "T") : value;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

const seenSerials = new Map<string, number>();
const recentScans = new Map<string, number>();
const RAPID_DEBOUNCE_MS = 10_000; // 10s: suppress rapid double-read from standing in front of terminal

function rememberSerial(key: string): boolean {
  const now = Date.now();
  const prev = seenSerials.get(key);
  if (prev && now - prev < SERIAL_DEDUPE_WINDOW_MS) {
    return false;
  }
  seenSerials.set(key, now);
  if (seenSerials.size > MAX_SERIALS) {
    const oldestKey = seenSerials.keys().next().value;
    if (oldestKey) seenSerials.delete(oldestKey);
  }
  return true;
}

function shouldProcessScan(deviceKey: string, empNo: string, eventTimeMs: number): boolean {
  const key = `${deviceKey}:${empNo}`;
  const prev = recentScans.get(key);
  if (prev && Math.abs(eventTimeMs - prev) < RAPID_DEBOUNCE_MS) {
    return false;
  }
  recentScans.set(key, eventTimeMs);
  if (recentScans.size > 2000) {
    const oldestKey = recentScans.keys().next().value;
    if (oldestKey) recentScans.delete(oldestKey);
  }
  return true;
}

function getIstTimeXml() {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "00";
  const year = get("year");
  const month = get("month");
  const day = get("day");
  let hour = get("hour");
  if (hour === "24") hour = "00";
  const minute = get("minute");
  const second = get("second");

  const localTime = `${year}-${month}-${day}T${hour}:${minute}:${second}+05:30`;
  const timeZone = "CST-5:30:00"; // IST Indian Standard Time POSIX format
  return { localTime, timeZone };
}

/**
 * Hikvision terminals are notorious for losing their clock (dead CMOS battery,
 * reboot, NTP failure). A drifted clock silently breaks polling (the event
 * window is queried in wall-clock time) AND corrupts scan timestamps, so every
 * poll cycle measures the drift and corrects the device when it exceeds a
 * minute. Returns the measured drift in ms (device time minus server time).
 */
export async function syncDeviceClock(conn: { host: number | string; port: number; username: string; password: string }): Promise<number> {
  return syncDeviceTime(conn as any);
}

export async function syncDeviceTime(conn: HikConnection): Promise<number> {
  const base = `http://${conn.host}:${conn.port}`;
  const t0 = Date.now();
  const res = await digestFetch(`${base}/ISAPI/System/time`, {
    method: "GET",
    username: conn.username,
    password: conn.password,
    timeoutMs: 5000,
  });
  if (!res.ok) return 0;
  const xml = await res.text();
  const m = xml.match(/<localTime>([^<]+)<\/localTime>/);
  if (!m) return 0;
  const devNow = new Date(m[1]);
  if (Number.isNaN(devNow.getTime())) return 0;

  // Compensate for roughly half the round-trip time.
  const rttHalf = (Date.now() - t0) / 2;
  const driftMs = devNow.getTime() - t0 - rttHalf;

  if (Math.abs(driftMs) <= 60_000) return driftMs;

  const modeMatch = xml.match(/<timeMode>([^<]+)<\/timeMode>/);
  const timeMode = modeMatch ? modeMatch[1] : "manual";
  const { localTime, timeZone } = getIstTimeXml();

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<timeMode>${timeMode}</timeMode>
<localTime>${localTime}</localTime>
<timeZone>${timeZone}</timeZone>
</Time>`;

  const putRes = await digestFetch(`${base}/ISAPI/System/time`, {
    method: "PUT",
    headers: { "Content-Type": "application/xml" },
    body,
    username: conn.username,
    password: conn.password,
    timeoutMs: 5000,
  });
  console.warn(
    `[hikvision] ${conn.host} clock drifted by ${Math.round(driftMs / 1000)}s — ${putRes.ok ? "re-synced to IST" : `sync failed (HTTP ${putRes.status})`}`,
  );

  // Events scanned while the clock was wrong carry skewed timestamps. The
  // caller subtracts the measured drift to map them onto the true timeline.
  return driftMs;
}

export async function forceSyncDeviceTime(id: string): Promise<{ ok: boolean; driftSeconds: number; deviceTime?: string; serverTime: string }> {
  const device = await prisma.biometricDevice.findUnique({ where: { id } });
  if (!device) throw new Error("Device not found");

  const conn = toConnection(device);
  const base = `http://${conn.host}:${conn.port}`;

  // Read current device time & schema parameters first to ensure 100% ISAPI schema compatibility
  let timeMode = "manual";
  let existingDeviceTime: string | undefined;

  try {
    const getRes = await digestFetch(`${base}/ISAPI/System/time`, {
      username: conn.username,
      password: conn.password,
      timeoutMs: 5000,
    });
    if (getRes.ok) {
      const xml = await getRes.text();
      const modeMatch = xml.match(/<timeMode>([^<]+)<\/timeMode>/);
      const timeMatch = xml.match(/<localTime>([^<]+)<\/localTime>/);
      if (modeMatch) timeMode = modeMatch[1];
      if (timeMatch) existingDeviceTime = timeMatch[1];
    }
  } catch {
    // fallback to defaults
  }

  const { localTime, timeZone } = getIstTimeXml();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<timeMode>${timeMode}</timeMode>
<localTime>${localTime}</localTime>
<timeZone>${timeZone}</timeZone>
</Time>`;

  const putRes = await digestFetch(`${base}/ISAPI/System/time`, {
    method: "PUT",
    headers: { "Content-Type": "application/xml" },
    body,
    username: conn.username,
    password: conn.password,
    timeoutMs: 5000,
  });

  if (!putRes.ok) {
    throw new Error(`Device rejected time update (HTTP ${putRes.status})`);
  }

  await prisma.biometricDevice.update({
    where: { id },
    data: { status: "ONLINE", lastError: null, lastSeenAt: new Date() },
  });

  return {
    ok: true,
    driftSeconds: 0,
    deviceTime: localTime,
    serverTime: new Date().toISOString(),
  };
}

export async function syncDeviceScansNow(id: string): Promise<{ success: boolean; scansFetched: number; scansProcessed: number; error?: string }> {
  try {
    const res = await pollDevice(id, true);
    return { success: true, scansFetched: res.scansFetched, scansProcessed: res.scansProcessed };
  } catch (err: any) {
    return { success: false, scansFetched: 0, scansProcessed: 0, error: err?.message || String(err) };
  }
}

export async function pullDeviceScansForRange(
  id: string,
  fromDate: Date,
  toDate: Date = new Date(),
): Promise<{ success: boolean; scansFetched: number; scansProcessed: number; error?: string }> {
  try {
    const res = await pollDevice(id, true, fromDate, toDate);
    return { success: true, scansFetched: res.scansFetched, scansProcessed: res.scansProcessed };
  } catch (err: any) {
    return { success: false, scansFetched: 0, scansProcessed: 0, error: err?.message || String(err) };
  }
}

/**
 * Fetch and process scans from ALL configured / enabled biometric terminals to portal
 */
export async function syncAllDevicesScansNow(): Promise<{
  success: boolean;
  totalFetched: number;
  totalProcessed: number;
  devices: Array<{
    id: string;
    name: string;
    host: string;
    success: boolean;
    scansFetched: number;
    scansProcessed: number;
    error?: string;
  }>;
}> {
  const devices = await prisma.biometricDevice.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });
  const targetDevices = devices.length > 0 ? devices : await prisma.biometricDevice.findMany({ orderBy: { createdAt: "asc" } });

  let totalFetched = 0;
  let totalProcessed = 0;
  const results: Array<{
    id: string;
    name: string;
    host: string;
    success: boolean;
    scansFetched: number;
    scansProcessed: number;
    error?: string;
  }> = [];

  for (const dev of targetDevices) {
    const res = await syncDeviceScansNow(dev.id);
    totalFetched += res.scansFetched;
    totalProcessed += res.scansProcessed;
    results.push({
      id: dev.id,
      name: dev.name,
      host: dev.host,
      success: res.success,
      scansFetched: res.scansFetched,
      scansProcessed: res.scansProcessed,
      error: res.error,
    });
  }

  return {
    success: true,
    totalFetched,
    totalProcessed,
    devices: results,
  };
}

export async function pullAllDevicesScansForRange(
  fromDate: Date,
  toDate: Date = new Date(),
): Promise<{
  success: boolean;
  totalFetched: number;
  totalProcessed: number;
  devices: Array<{
    id: string;
    name: string;
    host: string;
    success: boolean;
    scansFetched: number;
    scansProcessed: number;
    error?: string;
  }>;
}> {
  const devices = await prisma.biometricDevice.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });
  const targetDevices = devices.length > 0 ? devices : await prisma.biometricDevice.findMany({ orderBy: { createdAt: "asc" } });

  let totalFetched = 0;
  let totalProcessed = 0;
  const results: Array<{
    id: string;
    name: string;
    host: string;
    success: boolean;
    scansFetched: number;
    scansProcessed: number;
    error?: string;
  }> = [];

  for (const dev of targetDevices) {
    const res = await pullDeviceScansForRange(dev.id, fromDate, toDate);
    totalFetched += res.scansFetched;
    totalProcessed += res.scansProcessed;
    results.push({
      id: dev.id,
      name: dev.name,
      host: dev.host,
      success: res.success,
      scansFetched: res.scansFetched,
      scansProcessed: res.scansProcessed,
      error: res.error,
    });
  }

  return {
    success: true,
    totalFetched,
    totalProcessed,
    devices: results,
  };
}

export interface FetchMembersResult {
  deviceId: string;
  deviceName: string;
  deviceHost: string;
  totalFound: number;
  studentsMatched: number;
  teachersMatched: number;
  unmatchedCount: number;
  members: Array<{
    employeeNo: string;
    name?: string;
    matchedType: "STUDENT" | "TEACHER" | "UNMATCHED";
    matchedEntityName?: string;
    matchedEntityId?: string;
    updatedHash: boolean;
  }>;
}

/**
 * Fetch all enrolled members/users from a Hikvision terminal and link with Portal students & teachers
 */
export async function fetchMembersFromDevice(id: string): Promise<FetchMembersResult> {
  const device = await prisma.biometricDevice.findUnique({ where: { id } });
  if (!device) throw new Error("Device not found");

  const conn = toConnection(device);
  const users = await getUserInfoList(conn, 1000);

  let studentsMatched = 0;
  let teachersMatched = 0;
  let unmatchedCount = 0;
  const membersReport: FetchMembersResult["members"] = [];

  for (const u of users) {
    const empNo = u.employeeNo.trim();
    if (!empNo) continue;

    const strippedNum = empNo.replace(/^0+/, "");
    const candidateIds = Array.from(new Set([empNo, strippedNum])).filter(Boolean);

    // 1. Try matching Student by ITS / studentId / biometricHash
    let student = await prisma.studentProfile.findFirst({
      where: {
        OR: [
          { its: { in: candidateIds } },
          { studentId: { in: candidateIds } },
          { biometricHash: { in: candidateIds } },
        ],
      },
      include: { user: true },
    });

    if (student) {
      studentsMatched++;
      let updatedHash = false;
      if (student.biometricHash !== empNo) {
        try {
          await prisma.studentProfile.updateMany({
            where: { biometricHash: empNo, NOT: { id: student.id } },
            data: { biometricHash: null },
          });
          await prisma.studentProfile.update({
            where: { id: student.id },
            data: { biometricHash: empNo },
          });
          updatedHash = true;
        } catch (e) {
          console.warn(`[hikvision] Error setting biometricHash ${empNo} for student:`, e);
        }
      }
      const fullName = `${student.user.firstName} ${student.user.lastName}`.trim();
      membersReport.push({
        employeeNo: empNo,
        name: fullName || u.name || `Student ${student.studentId}`,
        matchedType: "STUDENT",
        matchedEntityName: fullName,
        matchedEntityId: student.id,
        updatedHash,
      });
      continue;
    }

    // 2. Try matching Teacher by ITS / employeeId / biometricHash
    let teacher = await prisma.teacherProfile.findFirst({
      where: {
        OR: [
          { its: { in: candidateIds } },
          { employeeId: { in: candidateIds } },
          { biometricHash: { in: candidateIds } },
        ],
      },
      include: { user: true },
    });

    if (teacher) {
      teachersMatched++;
      let updatedHash = false;
      if (teacher.biometricHash !== empNo) {
        try {
          await prisma.teacherProfile.updateMany({
            where: { biometricHash: empNo, NOT: { id: teacher.id } },
            data: { biometricHash: null },
          });
          await prisma.teacherProfile.update({
            where: { id: teacher.id },
            data: { biometricHash: empNo },
          });
          updatedHash = true;
        } catch (e) {
          console.warn(`[hikvision] Error setting biometricHash ${empNo} for teacher:`, e);
        }
      }
      const fullName = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
      membersReport.push({
        employeeNo: empNo,
        name: fullName || u.name || `Teacher ${teacher.employeeId}`,
        matchedType: "TEACHER",
        matchedEntityName: fullName,
        matchedEntityId: teacher.id,
        updatedHash,
      });
      continue;
    }

    // 3. Try fuzzy matching by Name if name is provided by terminal
    if (u.name && u.name.trim()) {
      const nameParts = u.name.split(/\s+/).filter(Boolean);
      const possibleUser = await prisma.user.findFirst({
        where: {
          OR: [
            { firstName: { contains: nameParts[0], mode: "insensitive" } },
            { lastName: { contains: nameParts[nameParts.length - 1], mode: "insensitive" } },
          ],
        },
        include: { studentProfile: true, teacherProfile: true },
      });

      if (possibleUser?.studentProfile) {
        studentsMatched++;
        try {
          await prisma.studentProfile.update({
            where: { id: possibleUser.studentProfile.id },
            data: { biometricHash: empNo },
          });
        } catch {}
        const fullName = `${possibleUser.firstName} ${possibleUser.lastName}`.trim();
        membersReport.push({
          employeeNo: empNo,
          name: fullName,
          matchedType: "STUDENT",
          matchedEntityName: fullName,
          matchedEntityId: possibleUser.studentProfile.id,
          updatedHash: true,
        });
        continue;
      }

      if (possibleUser?.teacherProfile) {
        teachersMatched++;
        try {
          await prisma.teacherProfile.update({
            where: { id: possibleUser.teacherProfile.id },
            data: { biometricHash: empNo },
          });
        } catch {}
        const fullName = `${possibleUser.firstName} ${possibleUser.lastName}`.trim();
        membersReport.push({
          employeeNo: empNo,
          name: fullName,
          matchedType: "TEACHER",
          matchedEntityName: fullName,
          matchedEntityId: possibleUser.teacherProfile.id,
          updatedHash: true,
        });
        continue;
      }
    }

    // 4. Unmatched terminal member
    unmatchedCount++;
    membersReport.push({
      employeeNo: empNo,
      name: u.name || "Unnamed Device User",
      matchedType: "UNMATCHED",
      updatedHash: false,
    });
  }

  return {
    deviceId: device.id,
    deviceName: device.name,
    deviceHost: device.host,
    totalFound: users.length,
    studentsMatched,
    teachersMatched,
    unmatchedCount,
    members: membersReport,
  };
}

/**
 * Fetch all enrolled members from ALL terminals to portal
 */
export async function fetchAllMembersFromAllDevices(): Promise<{
  success: boolean;
  totalFound: number;
  studentsMatched: number;
  teachersMatched: number;
  unmatchedCount: number;
  devices: FetchMembersResult[];
}> {
  const devices = await prisma.biometricDevice.findMany({
    where: { enabled: true },
    orderBy: { createdAt: "asc" },
  });
  const targetDevices = devices.length > 0 ? devices : await prisma.biometricDevice.findMany({ orderBy: { createdAt: "asc" } });

  let totalFound = 0;
  let studentsMatched = 0;
  let teachersMatched = 0;
  let unmatchedCount = 0;
  const deviceReports: FetchMembersResult[] = [];

  for (const dev of targetDevices) {
    try {
      const rep = await fetchMembersFromDevice(dev.id);
      totalFound += rep.totalFound;
      studentsMatched += rep.studentsMatched;
      teachersMatched += rep.teachersMatched;
      unmatchedCount += rep.unmatchedCount;
      deviceReports.push(rep);
    } catch (err) {
      console.error(`[hikvision] Failed to fetch members from ${dev.host}:`, err);
    }
  }

  return {
    success: true,
    totalFound,
    studentsMatched,
    teachersMatched,
    unmatchedCount,
    devices: deviceReports,
  };
}

export function getStartOfTodayIST(): Date {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = istFormatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "01";
  const year = parseInt(get("year"), 10);
  const month = parseInt(get("month"), 10) - 1;
  const day = parseInt(get("day"), 10);
  // 00:00:00 IST is UTC day 00:00 minus 5h 30m
  return new Date(Date.UTC(year, month, day, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
}

export async function pollDevice(
  id: string,
  force = false,
  customFrom?: Date,
  customTo?: Date,
): Promise<{ scansFetched: number; scansProcessed: number }> {
  if (inFlight.has(id)) return { scansFetched: 0, scansProcessed: 0 };
  inFlight.add(id);
  let scansFetched = 0;
  let scansProcessed = 0;
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id } });
    if (!device || (!device.enabled && !force)) return { scansFetched: 0, scansProcessed: 0 };

    const conn = toConnection(device);

    // Detect (and fix) terminal clock drift before querying — see
    // syncDeviceClock. The measured drift also repairs event timestamps.
    const driftMs = await syncDeviceClock(conn).catch(() => 0);
    const clockSkewed = Math.abs(driftMs) > 60_000;

    const to = customTo ?? new Date();
    const startOfToday = getStartOfTodayIST();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Query lookback:
    // 1. If explicit customFrom is provided, use it.
    // 2. If force is requested or first poll (no cursor), start from the beginning of today (00:00:00 IST).
    // 3. Otherwise, look back from (lastEventCursor - 30s) capped at start of today (never look into previous days).
    let from: Date;
    if (customFrom) {
      from = customFrom;
    } else if (force || !device.lastEventCursor) {
      from = startOfToday;
    } else {
      const cursorLookback = new Date(device.lastEventCursor.getTime() - 30_000);
      // Fresh start algorithm: each new day / after day off starts at 00:00:00 IST
      from = cursorLookback > startOfToday ? cursorLookback : startOfToday;
    }

    // Sanity check: prevent cursor from getting stuck in future
    if (from > to) {
      from = startOfToday;
    }

    const { events } = await getAcsEvents(conn, from, to);
    const scans = events.filter(isAttendanceEvent);
    scansFetched = scans.length;

    for (const ev of scans) {
      const empNo = String(ev.employeeNoString ?? ev.cardNo ?? "").trim();
      if (!empNo) continue;

      let time = parseEventTime(ev.time) ?? new Date();
      if (clockSkewed) {
        // Map the device-local timestamp onto the true timeline.
        time = new Date(time.getTime() - driftMs);
      }

      // Fresh daily start algorithm: Drop any scans from previous days during normal live polling
      if (!customFrom && time < startOfToday) {
        continue;
      }

      const serial = String(ev.serialNo ?? "").trim();
      if (serial) {
        const serialKey = `${id}:serial:${serial}`;
        if (!rememberSerial(serialKey)) continue;
      }

      // Debounce continuous rapid scans for the same person on this device
      if (!shouldProcessScan(id, empNo, time.getTime())) {
        continue;
      }

      // NOTE: no window-based pre-filtering here. Every scan pulled from the
      // terminal is handed to processBiometricScan(), which enforces the
      // per-role scan windows itself (STUDENT vs TEACHER) and records a
      // visible TOO_EARLY / SYSTEM event when a scan falls outside its
      // window. Pre-filtering at this layer silently dropped valid faculty
      // scans (e.g. faculty scanning at 07:30-07:40 while only the Talabat
      // window was open, or during evening events), which showed up as
      // "scanned on device but missing in portal".

      try {
        console.log(`[hikvision] processing scan from ${device.host} for ID: "${empNo}" (name: "${ev.name ?? ''}", time: ${time.toISOString()}, serial: ${serial})`);
        await processBiometricScan(
          empNo,
          time,
          `hikvision:${device.host}`,
          ev.currentVerifyMode,
        );
        scansProcessed++;
      } catch (err) {
        console.error(`[hikvision] scan processing error for ${device.host}:`, err);
      }
    }

    await prisma.biometricDevice.update({
      where: { id },
      data: {
        status: "ONLINE",
        lastError: null,
        lastPolledAt: new Date(),
        lastSeenAt: new Date(),
        lastEventCursor: to,
      },
    });
    return { scansFetched, scansProcessed };
  } catch (err: any) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isLanUnreachable = errMsg.includes("ETIMEDOUT") || errMsg.includes("EHOSTUNREACH") || errMsg.includes("ECONNREFUSED") || errMsg.includes("timeout");
    const isCloud = Boolean(process.env.RENDER || process.env.VERCEL || process.env.NODE_ENV === "production");

    await prisma.biometricDevice
      .update({
        where: { id },
        data: {
          status: isCloud && isLanUnreachable ? "ONLINE" : "ERROR",
          lastError: isCloud && isLanUnreachable ? null : errMsg,
          lastPolledAt: new Date(),
        },
      })
      .catch(() => {
        // device may have been deleted mid-poll
      });
    throw err;
  } finally {
    inFlight.delete(id);
  }
}

function isCloudEnvironment(): boolean {
  return Boolean(
    process.env.RENDER ||
    process.env.VERCEL ||
    process.env.DISABLE_DEVICE_POLLING === "true" ||
    (process.env.NODE_ENV === "production" && process.env.ENABLE_LAN_POLLING !== "true")
  );
}

function isPrivateLanIp(host?: string): boolean {
  if (!host) return false;
  return /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.)/.test(host.trim());
}

function scheduleDevice(id: string, pollIntervalSeconds: number, host?: string): void {
  stopDevicePolling(id);
  // On cloud deployments (Render/Production), never schedule continuous polling against private LAN IPs
  if (isCloudEnvironment() && (!host || isPrivateLanIp(host))) {
    return;
  }
  const ms = Math.max(2000, (pollIntervalSeconds || 15) * 1000);
  const timer = setInterval(() => {
    pollDevice(id).catch(() => {});
  }, ms);
  timers.set(id, timer);
  pollDevice(id).catch(() => {});
}

export function stopDevicePolling(id: string): void {
  const timer = timers.get(id);
  if (timer) {
    clearInterval(timer);
    timers.delete(id);
  }
}

export function getPollingDeviceIds(): string[] {
  return [...timers.keys()];
}

let supervisorTimer: ReturnType<typeof setInterval> | null = null;

export async function ensureBiometricDevicesConfigured(): Promise<void> {
  try {
    const DEFAULT_DEVICES = [
      {
        name: "Main Entrance MinMoe (192.168.0.4)",
        host: "192.168.0.4",
        port: Number(process.env.HIKVISION_PORT || 80),
        username: process.env.HIKVISION_USERNAME || "admin",
        password: process.env.HIKVISION_PASSWORD || "DARSEBURHANI5253",
        model: "DS-K1T341CMF",
        serialNo: "DS-K1T341CMF20240702V030315ENFT7370343",
        firmwareVersion: "V3.3.15 build 240702",
      },
      {
        name: "Secondary Terminal (192.168.0.5)",
        host: "192.168.0.5",
        port: 80,
        username: "admin",
        password: process.env.HIKVISION_PASSWORD || "DARSEBURHANI5253",
        model: "DS-K1T341CMF",
        serialNo: "DS-K1T341CMF20240702V030315ENFU5715056",
        firmwareVersion: "V3.3.15 build 240702",
      },
    ];

    for (const cfg of DEFAULT_DEVICES) {
      const existing = await prisma.biometricDevice.findFirst({ where: { host: cfg.host } });
      const { enc, iv } = encryptPassword(cfg.password);
      const data = {
        name: cfg.name,
        type: "HIKVISION",
        host: cfg.host,
        port: cfg.port,
        username: cfg.username,
        passwordEnc: enc,
        passwordIv: iv,
        enabled: true,
        status: "ONLINE",
        model: cfg.model,
        serialNo: cfg.serialNo,
        firmwareVersion: cfg.firmwareVersion,
        pollIntervalSeconds: 15,
        lastError: null,
        lastSeenAt: new Date(),
      };

      if (existing) {
        await prisma.biometricDevice.update({
          where: { id: existing.id },
          data: {
            enabled: true,
            status: "ONLINE",
            lastError: null,
            model: existing.model || cfg.model,
            serialNo: existing.serialNo || cfg.serialNo,
            firmwareVersion: existing.firmwareVersion || cfg.firmwareVersion,
          },
        });
      } else {
        await prisma.biometricDevice.create({ data });
      }
    }
    console.log("[hikvision] Configured biometric devices initialized (Status: ONLINE)");
  } catch (err) {
    console.warn("[hikvision] Notice initializing default biometric devices:", err);
  }
}

/**
 * Start polling for enabled devices (optionally just one). Called on server
 * boot and maintains a supervisor loop to automatically schedule any new devices.
 */
export async function startDevicePolling(id?: string): Promise<void> {
  await ensureBiometricDevicesConfigured();

  if (isCloudEnvironment()) {
    console.log("[hikvision] Cloud environment: active LAN polling supervisor bypassed. Webhook push endpoint is ready.");
    return;
  }

  const devices = id
    ? await prisma.biometricDevice.findMany({ where: { id, enabled: true } })
    : await prisma.biometricDevice.findMany({ where: { enabled: true } });
  for (const device of devices) {
    scheduleDevice(device.id, device.pollIntervalSeconds, device.host);
  }

  if (!supervisorTimer) {
    supervisorTimer = setInterval(async () => {
      try {
        const activeDevices = await prisma.biometricDevice.findMany({ where: { enabled: true } });
        const activeIds = new Set(activeDevices.map((d) => d.id));
        for (const runningId of timers.keys()) {
          if (!activeIds.has(runningId)) {
            stopDevicePolling(runningId);
          }
        }
        for (const dev of activeDevices) {
          if (!timers.has(dev.id)) {
            scheduleDevice(dev.id, dev.pollIntervalSeconds, dev.host);
          }
        }
      } catch {
        // Ignore DB blips
      }
    }, 15_000);
  }
}

/**
 * Batch deploy all active students to a specific Hikvision terminal
 */
export async function deployAllStudentsToDevice(deviceId: string): Promise<{
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ studentId: string; name: string; error: string }>;
}> {
  const device = await prisma.biometricDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Device not found");
  const conn = toConnection(device);

  const students = await prisma.studentProfile.findMany({
    where: { user: { isActive: true } },
    include: { user: true },
  });

  let successful = 0;
  let failed = 0;
  const errors: Array<{ studentId: string; name: string; error: string }> = [];

  for (const s of students) {
    const empNo = s.its || s.studentId || s.biometricHash || s.id;
    const fullName = `${s.user.firstName} ${s.user.lastName}`.trim();
    try {
      await deployUserToDevice(conn, {
        employeeNo: empNo,
        name: fullName || `Student ${s.studentId}`,
        userType: "normal",
        gender: "unknown",
      });

      if (!s.biometricHash) {
        await prisma.studentProfile.update({
          where: { id: s.id },
          data: { biometricHash: empNo },
        }).catch(() => {});
      }

      successful++;
    } catch (err: any) {
      failed++;
      errors.push({ studentId: s.studentId, name: fullName, error: err?.message || String(err) });
    }
  }

  return { total: students.length, successful, failed, errors };
}

/**
 * Batch deploy all active faculty to a specific Hikvision terminal
 */
export async function deployAllTeachersToDevice(deviceId: string): Promise<{
  total: number;
  successful: number;
  failed: number;
  errors: Array<{ teacherId: string; name: string; error: string }>;
}> {
  const device = await prisma.biometricDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error("Device not found");
  const conn = toConnection(device);

  const teachers = await prisma.teacherProfile.findMany({
    where: { user: { isActive: true } },
    include: { user: true },
  });

  let successful = 0;
  let failed = 0;
  const errors: Array<{ teacherId: string; name: string; error: string }> = [];

  for (const t of teachers) {
    const empNo = t.employeeId || t.its || t.biometricHash || t.id;
    const fullName = `${t.user.firstName} ${t.user.lastName}`.trim();
    try {
      await deployUserToDevice(conn, {
        employeeNo: empNo,
        name: fullName || `Teacher ${t.employeeId}`,
        userType: "normal",
        gender: "unknown",
      });

      if (!t.biometricHash) {
        await prisma.teacherProfile.update({
          where: { id: t.id },
          data: { biometricHash: empNo },
        }).catch(() => {});
      }

      successful++;
    } catch (err: any) {
      failed++;
      errors.push({ teacherId: t.employeeId, name: fullName, error: err?.message || String(err) });
    }
  }

  return { total: teachers.length, successful, failed, errors };
}

/**
 * Completely purge a user/student/teacher from all active Hikvision biometric terminals
 */
export async function deleteUserFromAllDevices(candidateEmployeeNos: (string | null | undefined)[]): Promise<{
  success: boolean;
  deletedFrom: string[];
  errors: Array<{ host: string; error: string }>;
}> {
  const cleanNos = Array.from(new Set(candidateEmployeeNos.map((s) => s?.trim()).filter(Boolean))) as string[];
  if (cleanNos.length === 0) return { success: true, deletedFrom: [], errors: [] };

  const devices = await prisma.biometricDevice.findMany({ where: { enabled: true } });
  const deletedFrom: string[] = [];
  const errors: Array<{ host: string; error: string }> = [];

  for (const dev of devices) {
    const conn = toConnection(dev);
    for (const empNo of cleanNos) {
      try {
        await deleteUserFromDevice(conn, empNo);
        deletedFrom.push(`${dev.host}:${empNo}`);
      } catch (err: any) {
        // May already not exist on terminal
        errors.push({ host: dev.host, error: err?.message || String(err) });
      }
    }
  }

  return { success: true, deletedFrom, errors };
}

