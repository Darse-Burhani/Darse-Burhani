#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════════
 *  🏛️  DARSE BURHANI — ULTRA-POWERFUL REAL-TIME HIKVISION CLOUD ATTENDANCE BRIDGE
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Bridges physical Hikvision MinMoe Terminals (192.168.0.4, 192.168.0.5) directly
 * to your live cloud deployment on Render and Supabase Database in real time.
 * 
 * Features:
 *   ⚡ Dual-Path Real-Time Sync: Webhook to Render + Direct Supabase DB Fallback
 *   📡 Persistent AlertStream Listener: Instant push notifications on punch
 *   🔄 3-Second Rapid Fallback Poller with 24-hour startup lookback
 *   ⏰ Automatic Terminal Clock Synchronization to Indian Standard Time (IST +05:30)
 *   🛡️ XML and JSON multipart payload auto-detection & parsing
 *   💓 Render Free-Tier Keep-Alive Pings every 30 seconds
 * 
 * Usage:
 *   npm run hikvision:cloud-bridge
 *   Double-click: scripts/start-hikvision-cloud-bridge.bat
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const prisma = new PrismaClient();

// Operational stats for local 24/7 health inspection
const stats = {
  startedAt: new Date(),
  totalPunches: 0,
  renderSynced: 0,
  dbDirectSynced: 0,
  lastPunch: null,
};

// Cloud target. Prefer an explicit CLI/RENDER_URL, then the same public
// HIKVISION_PUSH_URL the server advertises to the terminals, so the bridge and
// the device webhook can never point at two different deployments.
const PUSH_URL_ENV = (process.env.HIKVISION_PUSH_URL || '').trim();
function originOf(url) {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}
const RENDER_BASE = (
  process.argv[2] ||
  process.env.RENDER_URL ||
  process.env.RENDER_APP_URL ||
  originOf(PUSH_URL_ENV) ||
  (process.env.PUBLIC_APP_URL && !process.env.PUBLIC_APP_URL.includes('localhost') && !process.env.PUBLIC_APP_URL.includes('127.0.0.1') ? process.env.PUBLIC_APP_URL : null) ||
  (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost') && !process.env.NEXT_PUBLIC_APP_URL.includes('127.0.0.1') ? process.env.NEXT_PUBLIC_APP_URL : null) ||
  'https://darse-burhani.onrender.com'
).replace(/\/+$/, '');

const SECRET = process.env.BIOMETRIC_SECRET || 'DARSEBURHANI5253';
const WEBHOOK_URL = PUSH_URL_ENV
  ? `${PUSH_URL_ENV}${PUSH_URL_ENV.includes('?') ? '&' : '?'}secret=${encodeURIComponent(SECRET)}`
  : `${RENDER_BASE}/api/hikvision/events?secret=${encodeURIComponent(SECRET)}`;

// Fallback webhook targets. If the primary (custom-domain) gateway is
// unreachable (DNS/SSL/network outage), the bridge retries the live Render
// deployment URL automatically instead of silently dropping to DB-only sync.
const RENDER_FALLBACK_BASE = (
  process.env.RENDER_URL ||
  process.env.RENDER_APP_URL ||
  'https://darse-burhani.onrender.com'
).replace(/\/+$/, '');
const WEBHOOK_FALLBACKS = [...new Set([
  WEBHOOK_URL,
  `${RENDER_FALLBACK_BASE}/api/hikvision/events?secret=${encodeURIComponent(SECRET)}`,
])];
let lastGoodWebhookIndex = 0;

// Health/keep-alive bases: try every known deployment URL (custom domain may
// have DNS/SSL outages; the onrender.com URL is always the guaranteed one).
const CLOUD_HEALTH_BASES = [...new Set([
  RENDER_BASE,
  RENDER_FALLBACK_BASE,
  process.env.PUBLIC_APP_URL && !/localhost|127\.0\.0\.1/.test(process.env.PUBLIC_APP_URL) ? process.env.PUBLIC_APP_URL.replace(/\/+$/, '') : null,
].filter(Boolean))];
let lastGoodHealthBase = RENDER_FALLBACK_BASE;


// Terminal Device Roster
const rawHosts = process.env.HIKVISION_HOSTS || process.env.HIKVISION_HOST || '192.168.0.4,192.168.0.5';
const DEVICES = rawHosts
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)
  .map((host, idx) => {
    const [ip, portStr] = host.split(':');
    return {
      id: `dev-${idx + 1}`,
      name: idx === 0 ? 'Main Entrance MinMoe' : `Secondary Terminal ${idx + 1}`,
      host: ip,
      port: parseInt(portStr || process.env.HIKVISION_PORT || '80', 10),
      username: process.env.HIKVISION_USERNAME || 'admin',
      password: process.env.HIKVISION_PASSWORD || 'DARSEBURHANI5253',
    };
  });

function md5(str) {
  return createHash('md5').update(str).digest('hex');
}

function parseDigestHeader(header) {
  const params = {};
  const re = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
  let match;
  while ((match = re.exec(header)) !== null) {
    params[match[1]] = match[2] || match[3];
  }
  return params;
}

async function digestFetch(url, { method = 'GET', username, password, body, headers = {}, timeoutMs = 8000 }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const initial = await fetch(url, { method, headers, body, signal: controller.signal });
    if (initial.status !== 401) {
      clearTimeout(t);
      return initial;
    }
    const authHeader = initial.headers.get('www-authenticate') || '';
    if (!authHeader.toLowerCase().startsWith('digest')) {
      clearTimeout(t);
      return initial;
    }
    const chal = parseDigestHeader(authHeader.slice(7));
    const realm = chal.realm || '';
    const nonce = chal.nonce || '';
    const qop = chal.qop;
    const uri = new URL(url).pathname + new URL(url).search;
    const ha1 = md5(`${username}:${realm}:${password}`);
    const ha2 = md5(`${method}:${uri}`);
    let responseVal;
    let authStr = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}"`;

    if (qop) {
      const nc = '00000001';
      const cnonce = Math.random().toString(36).slice(2, 10);
      responseVal = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
      authStr += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${responseVal}"`;
    } else {
      responseVal = md5(`${ha1}:${nonce}:${ha2}`);
      authStr += `, response="${responseVal}"`;
    }
    if (chal.opaque) authStr += `, opaque="${chal.opaque}"`;

    const finalHeaders = { ...headers, Authorization: authStr };
    const authed = await fetch(url, { method, headers: finalHeaders, body, signal: controller.signal });
    clearTimeout(t);
    return authed;
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

// Memory Deduplication Cache (avoids repeating identical scans within 2 hours)
const seenEvents = new Map();
const DEDUPE_WINDOW_MS = 2 * 60 * 60 * 1000;

function isDuplicate(key) {
  const now = Date.now();
  const prev = seenEvents.get(key);
  if (prev && now - prev < DEDUPE_WINDOW_MS) {
    return true;
  }
  seenEvents.set(key, now);
  if (seenEvents.size > 8000) {
    const oldestKey = seenEvents.keys().next().value;
    if (oldestKey) seenEvents.delete(oldestKey);
  }
  return false;
}

/**
 * IST wall-clock parts regardless of the PC's own timezone. The school PC may
 * be set to UTC (or have a dead CMOS battery), so never use getHours()/getDate()
 * when generating the clock value written to a Hikvision terminal.
 */
function getIstParts(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

function getHikvisionTime(d = new Date()) {
  const p = getIstParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+05:30`;
}

/**
 * Parse an ISAPI <localTime> value. Terminals frequently omit the timezone
 * offset; in that case the value is IST wall-clock and must be anchored with
 * +05:30 explicitly. Parsing it with `new Date(raw)` would use the bridge PC's
 * local timezone and produce a bogus 5h30m "drift".
 */
function parseDeviceLocalTime(raw) {
  if (!raw) return null;
  const s = String(raw).trim().replace(/\//g, '-').replace(' ', 'T');
  const hasOffset = /[Zz]|([+-]\d{2}:?\d{2})$/.test(s);
  const parsed = new Date(hasOffset ? s : `${s}+05:30`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDeviceTime(raw) {
  if (!raw) return getHikvisionTime(new Date());
  const s = String(raw).trim();
  if (/[Zz]|([+-]\d{2}:?\d{2})$/.test(s)) return s;
  const normalized = s.replace(/\//g, '-').replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(normalized)) {
    return `${normalized}+05:30`;
  }
  return s;
}

// ── Identity aliases ─────────────────────────────────────────────
// Terminals may enrol a person under a display name or numeric ID instead of
// their official ITS employee number:
// 1. Mustafa Tailor (ITS 40444603 - Faculty):
//    Device: "Mustafa Bhai Moiz Bhai Manpur" / "Mustafa Tailor" -> 40444603
// 2. Mulla Murtaza bhai Shaikh Abbas bhai Hamid (ITS 30489490 - Faculty):
//    Device: employeeNo "2", name "M Murtaza Bhai Shk Abbas Bhai Hamid" -> 30489490
// 3. Murtaza bhai Abbas bhai Chhatariya (ITS 30150861 - Student / Talabat):
//    Device 192.168.0.4: typo employeeNo "30450861", name "30150861" -> 30150861
const MUSTAFA_TAILOR_ITS = '40444603';
const MURTAZA_HAMID_ITS = '30489490';
const MURTAZA_CHHATARIYA_ITS = '30150861';

function canonicalizeEmployeeNo(rawId, name) {
  const id = String(rawId || '').trim();
  const nameStr = String(name || '').trim();
  const combined = `${id} ${nameStr}`.trim();

  // 1. Direct hardware ID / typo aliases
  if (id === '2' || nameStr === '2') {
    return MURTAZA_HAMID_ITS;
  }
  if (id === '30450861' || nameStr === '30450861') {
    return MURTAZA_CHHATARIYA_ITS;
  }
  if (id === MUSTAFA_TAILOR_ITS || nameStr === MUSTAFA_TAILOR_ITS) {
    return MUSTAFA_TAILOR_ITS;
  }
  if (id === MURTAZA_HAMID_ITS || nameStr === MURTAZA_HAMID_ITS) {
    return MURTAZA_HAMID_ITS;
  }
  if (id === MURTAZA_CHHATARIYA_ITS || nameStr === MURTAZA_CHHATARIYA_ITS) {
    return MURTAZA_CHHATARIYA_ITS;
  }

  // 2. Name-based alias patterns
  if (/manpur/i.test(combined) || /mustafa\s*tailor/i.test(combined)) {
    return MUSTAFA_TAILOR_ITS;
  }
  if (
    /shk\s*abbas.*hamid/i.test(combined) ||
    /shaikh\s*abbas.*hamid/i.test(combined) ||
    /m.*murtaza.*sh.*abbas/i.test(combined)
  ) {
    return MURTAZA_HAMID_ITS;
  }
  if (/chhatariya/i.test(combined)) {
    return MURTAZA_CHHATARIYA_ITS;
  }

  // 3. If name is a valid 8-digit ITS number while id is not or has typo
  if (/^\d{8}$/.test(nameStr)) {
    return nameStr;
  }
  if (/^\d+$/.test(id)) {
    return id;
  }

  return id;
}

// Direct Database Sync fallback (guarantees real-time record in Supabase)
async function recordDirectScanInDatabase({ employeeNo, time, verifyMode, deviceHost }) {
  const rawId = String(employeeNo || '').trim();
  if (!rawId) return { ok: false, error: 'Empty ID' };

  const canonicalId = canonicalizeEmployeeNo(rawId);
  const strippedNum = canonicalId.replace(/^0+/, '');
  const prefixMatch = canonicalId.match(/^(?:STU|ITS|FP|CARD|ID|TALABAT|EMP|TEA|FAC|STAFF|TEACHER|FACULTY)[-_:.]?(.*)$/i);
  const innerNum = prefixMatch && prefixMatch[1] ? prefixMatch[1].trim() : '';
  const innerStripped = innerNum ? innerNum.replace(/^0+/, '') : '';
  const candidateIds = Array.from(new Set([rawId, canonicalId, strippedNum, innerNum, innerStripped])).filter(Boolean);

  const scanDate = new Date(time);
  const istFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = istFormatter.formatToParts(scanDate);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10) - 1;
  const day = parseInt(get('day'), 10);
  const hours = parseInt(get('hour'), 10);
  const minutes = parseInt(get('minute'), 10);
  const scanMinutes = hours * 60 + minutes;
  const calendarDayUTC = new Date(Date.UTC(year, month, day));

  // Determine initial status (PRESENT vs LATE)
  const isLate = scanMinutes > 8 * 60 + 1; // After 08:01 AM IST
  const initialStatus = isLate ? 'LATE' : 'PRESENT';
  const biometricMethod = String(verifyMode || '').toLowerCase().includes('face') ? 'FACIAL' : 'FINGERPRINT';

  try {
    // 1. Try matching Student
    const student = await prisma.studentProfile.findFirst({
      where: {
        OR: [
          { biometricHash: { in: candidateIds } },
          { its: { in: candidateIds } },
          { studentId: { in: candidateIds } },
        ],
      },
      include: {
        user: true,
        classEnrollments: { include: { class: true } },
      },
    });

    if (student) {
      // Check for existing registry on this date
      const existingRegistry = await prisma.attendanceRegistry.findUnique({
        where: {
          studentId_date: {
            studentId: student.id,
            date: calendarDayUTC,
          },
        },
      });

      // Preserve early arrival or morning PRESENT; later checkout punches must never degrade status to LATE
      const registryStatus = existingRegistry && existingRegistry.status === 'PRESENT' ? 'PRESENT' : initialStatus;

      await prisma.attendanceRegistry.upsert({
        where: {
          studentId_date: {
            studentId: student.id,
            date: calendarDayUTC,
          },
        },
        create: {
          studentId: student.id,
          date: calendarDayUTC,
          status: registryStatus,
          source: 'BIOMETRIC',
          checkInTime: scanDate,
          checkOutTime: scanDate,
          recordedById: student.userId,
        },
        update: {
          checkOutTime: scanDate,
          ...(existingRegistry && existingRegistry.status === 'PRESENT' ? {} : { status: registryStatus }),
        },
      });

      // Also record AttendanceRecord for their enrolled class
      const activeEnrollment = student.classEnrollments.find((e) => e.isActive) || student.classEnrollments[0];
      let classId = activeEnrollment?.classId;
      if (!classId && student.grade) {
        const cls = await prisma.class.findFirst({ where: { grade: student.grade, isActive: true } });
        classId = cls?.id;
      }

      if (classId) {
        await prisma.attendanceRecord.upsert({
          where: {
            studentId_classId_date: {
              studentId: student.id,
              classId,
              date: calendarDayUTC,
            },
          },
          create: {
            studentId: student.id,
            classId,
            date: calendarDayUTC,
            status: registryStatus,
            source: 'BIOMETRIC',
            checkInTime: scanDate,
            checkOutTime: scanDate,
            verificationMethod: 'BIOMETRIC',
            biometricMethod,
            biometricHash: rawId,
            recordedById: student.userId,
          },
          update: {
            checkOutTime: scanDate,
          },
        });
      }

      console.log(`   💾 [DIRECT DB SYNC] Recorded Talabat attendance: ${student.user.firstName} ${student.user.lastName} (${registryStatus})`);
      return { ok: true, matchedType: 'STUDENT', name: `${student.user.firstName} ${student.user.lastName}` };
    }

    // 2. Try matching Teacher / Faculty
    const teacher = await prisma.teacherProfile.findFirst({
      where: {
        OR: [
          { biometricHash: { in: candidateIds } },
          { its: { in: candidateIds } },
          { employeeId: { in: candidateIds } },
        ],
      },
      include: { user: true },
    });

    if (teacher) {
      const existingTeacherRecord = await prisma.teacherAttendanceRecord.findUnique({
        where: {
          teacherId_date: {
            teacherId: teacher.id,
            date: calendarDayUTC,
          },
        },
      });

      const teacherStatus = existingTeacherRecord && existingTeacherRecord.status === 'PRESENT' ? 'PRESENT' : initialStatus;

      await prisma.teacherAttendanceRecord.upsert({
        where: {
          teacherId_date: {
            teacherId: teacher.id,
            date: calendarDayUTC,
          },
        },
        create: {
          teacherId: teacher.id,
          date: calendarDayUTC,
          status: teacherStatus,
          checkInTime: scanDate,
          checkOutTime: scanDate,
          verificationMethod: 'BIOMETRIC',
          biometricMethod,
          biometricHash: rawId,
          notes: `Direct sync from MinMoe (${deviceHost})`,
        },
        update: {
          checkOutTime: scanDate,
          ...(existingTeacherRecord && existingTeacherRecord.status === 'PRESENT' ? {} : { status: teacherStatus }),
        },
      });

      console.log(`   💾 [DIRECT DB SYNC] Recorded Faculty attendance: ${teacher.user.firstName} ${teacher.user.lastName} (${teacherStatus})`);
      return { ok: true, matchedType: 'TEACHER', name: `${teacher.user.firstName} ${teacher.user.lastName}` };
    }

    return { ok: false, error: 'Unmatched ID' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Dual-path forwarder: Sends to Render Webhook + records to Supabase Database
async function processAndForwardScan({ employeeNo, name, cardNo, time, currentVerifyMode, serialNo, deviceHost }) {
  // Identity alias resolution: device-enrolled display names
  // (e.g. "Mustafa Bhai Moiz Bhai Manpur") map to the canonical ITS number
  // so attendance always lands on the right person.
  employeeNo = canonicalizeEmployeeNo(employeeNo, name);
  const timeStr = normalizeDeviceTime(time);
  const payload = {
    AccessControllerEvent: {
      employeeNoString: String(employeeNo),
      name: name || '',
      cardNo: cardNo || '',
      time: timeStr,
      currentVerifyMode: currentVerifyMode || 'FINGERPRINT',
      serialNo: String(serialNo || `${employeeNo}-${timeStr}`),
      deviceId: deviceHost,
    },
  };

  stats.totalPunches++;
  stats.lastPunch = { employeeNo, name, time: timeStr, currentVerifyMode, deviceHost };

  // 1. Send to Render Cloud Webhook (primary gateway + automatic fallbacks)
  let webhookSuccess = false;
  for (let attempt = 0; attempt < WEBHOOK_FALLBACKS.length && !webhookSuccess; attempt++) {
    // Sticky routing: always retry the last-known-good gateway first.
    const idx = (lastGoodWebhookIndex + attempt) % WEBHOOK_FALLBACKS.length;
    const target = WEBHOOK_FALLBACKS[idx];
    try {
      const res = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-biometric-secret': SECRET,
          'x-webhook-secret': SECRET,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        webhookSuccess = true;
        lastGoodWebhookIndex = idx;
        stats.renderSynced++;
        if (attempt > 0) console.log(`   🔁 [CLOUD WEBHOOK] Recovered via fallback gateway #${idx}`);
        console.log(`   ☁️  [CLOUD WEBHOOK] Synced to Render (${res.status} OK)`);
      } else {
        console.warn(`   ⚠️ [CLOUD WEBHOOK NOTICE] Gateway #${idx} returned HTTP ${res.status}${attempt < WEBHOOK_FALLBACKS.length - 1 ? ' (trying fallback)' : ' (activating direct DB sync)'}`);
      }
    } catch (e) {
      console.warn(`   ⚠️ [CLOUD WEBHOOK NOTICE] Cannot reach gateway #${idx} (${new URL(target).host}): ${e.message}${attempt < WEBHOOK_FALLBACKS.length - 1 ? ' — trying fallback gateway' : ''}`);
    }
  }

  // 2. Direct Supabase Database Write (Dual-Path Guarantee)
  const dbRes = await recordDirectScanInDatabase({
    employeeNo,
    time: timeStr,
    verifyMode: currentVerifyMode,
    deviceHost,
  });
  if (dbRes?.ok) {
    stats.dbDirectSynced++;
  }
}

// Check and sync device clock with IST
async function syncDeviceClock(dev) {
  const url = `http://${dev.host}:${dev.port}/ISAPI/System/time`;
  try {
    const requestStartedAt = Date.now();
    const res = await digestFetch(url, {
      username: dev.username,
      password: dev.password,
      timeoutMs: 5000,
    });
    const requestFinishedAt = Date.now();
    if (!res.ok) return { ok: false, driftSeconds: null };

    const xml = await res.text();
    const timeMatch = xml.match(/<localTime>([^<]+)<\/localTime>/);
    if (!timeMatch) return { ok: false, driftSeconds: null };

    const devTime = parseDeviceLocalTime(timeMatch[1]);
    if (!devTime) return { ok: false, driftSeconds: null };

    // Compensate for network round-trip so a slow LAN link is not reported as
    // clock drift on the terminal.
    const serverMidpoint = (requestStartedAt + requestFinishedAt) / 2;
    const driftSeconds = Math.round((devTime.getTime() - serverMidpoint) / 1000);

    if (Math.abs(driftSeconds) > 45) {
      console.log(`⏰ [CLOCK DRIFT] ${dev.name} (${dev.host}) drifted by ${driftSeconds}s. Synchronizing to IST (+05:30)...`);
      const now = new Date();
      const istTime = getHikvisionTime(now);
      const putBody = `<?xml version="1.0" encoding="UTF-8"?>
<Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<timeMode>manual</timeMode>
<localTime>${istTime}</localTime>
<timeZone>CST-5:30:00</timeZone>
</Time>`;

      const putRes = await digestFetch(url, {
        method: 'PUT',
        username: dev.username,
        password: dev.password,
        headers: { 'Content-Type': 'application/xml' },
        body: putBody,
        timeoutMs: 5000,
      });
      if (putRes.ok) {
        console.log(`✅ [CLOCK SYNCED] ${dev.name} (${dev.host}) time updated to ${istTime}`);
        return { ok: true, driftSeconds, synced: true };
      }
      console.warn(`⚠️ [CLOCK SYNC FAILED] ${dev.name} (${dev.host}) returned HTTP ${putRes.status}`);
      return { ok: false, driftSeconds, synced: false };
    }

    return { ok: true, driftSeconds, synced: false };
  } catch (err) {
    return { ok: false, driftSeconds: null, error: err?.message || String(err) };
  }
}

// Parse XML event block from alertStream
function parseXmlEvent(xmlStr) {
  const extract = (tag) => {
    const m = xmlStr.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, 'i'));
    return m ? m[1].trim() : '';
  };

  const employeeNo = extract('employeeNoString') || extract('cardNo') || extract('employeeNo');
  if (!employeeNo) return null;

  return {
    employeeNoString: employeeNo,
    name: extract('name'),
    cardNo: extract('cardNo'),
    time: normalizeDeviceTime(extract('time') || extract('dateTime')),
    currentVerifyMode: extract('currentVerifyMode') || 'FINGERPRINT',
    serialNo: extract('serialNo') || extract('eventID') || `${employeeNo}-${Date.now()}`,
  };
}

// Real-time alert stream listener
async function listenAlertStream(dev) {
  const url = `http://${dev.host}:${dev.port}/ISAPI/Event/notification/alertStream`;
  console.log(`📡 [STREAM CONNECTING] Connecting real-time punch listener on ${dev.name} (${dev.host}:${dev.port})...`);

  try {
    const res = await digestFetch(url, {
      method: 'GET',
      username: dev.username,
      password: dev.password,
      timeoutMs: 60000,
    });

    if (!res.ok || !res.body) {
      console.warn(`⚠️ [STREAM NOTICE] ${dev.name} returned HTTP ${res.status}. Active polling will handle scans.`);
      return;
    }

    console.log(`🟢 [STREAM CONNECTED] Real-time stream active for ${dev.name} (${dev.host})`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // 1. Process JSON events
      let jsonMatch;
      while ((jsonMatch = buffer.match(/\{[\s\S]*?"AccessControllerEvent"[\s\S]*?\}/))) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const ev = parsed.AccessControllerEvent || parsed;
          const employeeNo = ev.employeeNoString || ev.cardNo;
          if (employeeNo) {
            const timeStr = normalizeDeviceTime(ev.time);
            const serial = ev.serialNo || `${employeeNo}-${timeStr}`;
            const dedupeKey = `${dev.host}:${serial}`;

            if (!isDuplicate(dedupeKey)) {
              const verifyMode = ev.currentVerifyMode || (ev.minor === 75 ? 'FACIAL' : 'FINGERPRINT');
              console.log(`\n⚡ [REAL-TIME PUNCH] ${dev.name} (${dev.host}) -> ID: ${employeeNo} at ${timeStr} [${verifyMode}]`);

              processAndForwardScan({
                employeeNo,
                name: ev.name,
                cardNo: ev.cardNo,
                time: timeStr,
                currentVerifyMode: verifyMode,
                serialNo: serial,
                deviceHost: dev.host,
              });
            }
          }
        } catch {}
        buffer = buffer.slice(jsonMatch.index + jsonMatch[0].length);
      }

      // 2. Process XML events
      let xmlMatch;
      while ((xmlMatch = buffer.match(/<AccessControllerEvent[\s\S]*?<\/AccessControllerEvent>/i))) {
        const ev = parseXmlEvent(xmlMatch[0]);
        if (ev && ev.employeeNoString) {
          const dedupeKey = `${dev.host}:${ev.serialNo}`;
          if (!isDuplicate(dedupeKey)) {
            console.log(`\n⚡ [REAL-TIME PUNCH] ${dev.name} (${dev.host}) -> ID: ${ev.employeeNoString} at ${ev.time} [${ev.currentVerifyMode}]`);

            processAndForwardScan({
              employeeNo: ev.employeeNoString,
              name: ev.name,
              cardNo: ev.cardNo,
              time: ev.time,
              currentVerifyMode: ev.currentVerifyMode,
              serialNo: ev.serialNo,
              deviceHost: dev.host,
            });
          }
        }
        buffer = buffer.slice(xmlMatch.index + xmlMatch[0].length);
      }

      if (buffer.length > 50000) {
        buffer = buffer.slice(-10000);
      }
    }
  } catch (err) {
    console.warn(`🔌 [STREAM DISCONNECTED] ${dev.host} (${err.message}). Reconnecting in 4s...`);
  }
}

// Rapid background poller with complete pagination loop
async function pollDeviceEvents(dev, lookbackHours = 3, maxPages = 10) {
  const now = new Date();
  const past = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const startTime = getHikvisionTime(past);
  const endTime = getHikvisionTime(now);

  let position = 0;
  let pageCount = 0;
  let hasMore = true;

  while (hasMore && pageCount < maxPages) {
    pageCount++;
    const payload = JSON.stringify({
      AcsEventCond: {
        searchID: `bridge-${Date.now()}`,
        searchResultPosition: position,
        maxResults: 30,
        major: 0,
        minor: 0,
        startTime,
        endTime,
      },
    });

    try {
      const url = `http://${dev.host}:${dev.port}/ISAPI/AccessControl/AcsEvent?format=json`;
      const res = await digestFetch(url, {
        method: 'POST',
        username: dev.username,
        password: dev.password,
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        timeoutMs: 6000,
      });

      if (!res.ok) break;
      const data = await res.json();
      const acs = data?.AcsEvent;
      const matches = acs?.InfoList || [];
      if (matches.length === 0) break;

      for (const item of matches) {
        const employeeNo = item.employeeNoString || item.cardNo;
        if (!employeeNo) continue;

        const timeStr = normalizeDeviceTime(item.time);
        const serial = item.serialNo || item.serial || `${employeeNo}-${timeStr}`;
        const dedupeKey = `${dev.host}:${serial}`;
        if (isDuplicate(dedupeKey)) continue;

        const verifyMode = item.currentVerifyMode || (item.minor === 75 ? 'FACIAL' : 'FINGERPRINT');
        console.log(`\n📥 [DEVICE SCAN POLLED] ${dev.name} (${dev.host}) -> ID: ${employeeNo} at ${timeStr} [${verifyMode}]`);

        await processAndForwardScan({
          employeeNo,
          name: item.name,
          cardNo: item.cardNo,
          time: timeStr,
          currentVerifyMode: verifyMode,
          serialNo: serial,
          deviceHost: dev.host,
        });
      }

      position += matches.length;
      if (acs.totalMatches && position >= acs.totalMatches) {
        hasMore = false;
      } else if (acs.responseStatusStrg && acs.responseStatusStrg !== 'MORE') {
        hasMore = false;
      }
    } catch {
      break;
    }
  }
}

// ── Official face-photo sync (Galiakot kgs staff photos → terminals) ──
// For every active teacher carrying the official profile photo, upload the
// picture as the terminal's face-enrollment data for their enrolled employee
// number (ITS), so the device's face match recognises the person during
// scanning. Non-destructive: terminal user records created by the office
// (e.g. "Mustafa Bhai Moiz Bhai Manpur") are never renamed or removed —
// identity resolution by ITS makes the name irrelevant for attendance.
const faceSyncSucceeded = new Set();
const photoCache = new Map();

async function loadOfficialPhoto(url) {
  if (photoCache.has(url)) return photoCache.get(url);

  // Check local filesystem in public/ if available
  try {
    const cleanPath = url.replace(/^https?:\/\/[^/]+/, '');
    const localFile = path.resolve(__dirname, '..', 'public', cleanPath.replace(/^\//, ''));
    if (fs.existsSync(localFile)) {
      const buf = fs.readFileSync(localFile);
      if (buf.length >= 1024) {
        const ext = path.extname(localFile).toLowerCase();
        const type = ext === '.png' ? 'image/png' : 'image/jpeg';
        const entry = { buf, type };
        photoCache.set(url, entry);
        return entry;
      }
    }
  } catch {}

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Photo fetch HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 1024) throw new Error('Photo file too small');
  const entry = { buf, type: res.headers.get('content-type') || 'image/jpeg' };
  photoCache.set(url, entry);
  return entry;
}

async function uploadFaceToDevice(dev, person, photo) {
  const base = `http://${dev.host}:${dev.port}`;
  const boundary = '----DarseBurhaniFace' + Date.now().toString(36);
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="FaceDataRecord"\r\nContent-Type: application/json\r\n\r\n` +
      JSON.stringify({ faceInfo: { employeeNo: String(person.employeeNo), enable: true } }) +
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name="bin"; filename="face.jpg"\r\nContent-Type: ${photo.type}\r\n\r\n`
    ),
    photo.buf,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const endpoints = [
    `${base}/ISAPI/AccessControl/FaceDataRecord?format=json&employeeNo=${encodeURIComponent(person.employeeNo)}`,
    `${base}/ISAPI/AccessControl/FaceDataRecord?format=json`,
    `${base}/ISAPI/Intelligent/FDLib/FDModfy/FaceDataRecord?format=json`,
  ];
  let lastStatus = '';
  for (const url of endpoints) {
    try {
      const res = await digestFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
        body,
        username: dev.username,
        password: dev.password,
        timeoutMs: 15000,
      });
      if (res.ok) return true;
      lastStatus += ` [${new URL(url).pathname.split('/').slice(-2).join('/')}: HTTP ${res.status}]`;
    } catch (e) {
      lastStatus += ` [${new URL(url).pathname.split('/').slice(-2).join('/')}: ${e.message}]`;
    }
  }
  throw new Error(`All face endpoints rejected:${lastStatus}`);
}

async function syncOfficialFaceData() {
  try {
    const teachers = await prisma.teacherProfile.findMany({
      where: { user: { isActive: true } },
      select: {
        its: true,
        biometricHash: true,
        photoUrl: true,
        user: { select: { avatarUrl: true, firstName: true, lastName: true } },
      },
    });
    const targets = teachers
      .map((t) => ({
        employeeNo: (t.its || t.biometricHash || '').trim(),
        name: `${t.user?.firstName ?? ''} ${t.user?.lastName ?? ''}`.trim() || 'Teacher',
        photoUrl: t.photoUrl || t.user?.avatarUrl || null,
      }))
      .filter((p) => p.employeeNo && /^\d+$/.test(p.employeeNo) && p.photoUrl);
    if (!targets.length) return;

    for (const dev of DEVICES) {
      for (const person of targets) {
        const key = `${dev.host}:${person.employeeNo}`;
        if (faceSyncSucceeded.has(key)) continue; // already enrolled on this terminal
        const photoUrl = person.photoUrl.startsWith('http')
          ? person.photoUrl
          : `${RENDER_BASE}${person.photoUrl.startsWith('/') ? '' : '/'}${person.photoUrl}`;
        try {
          const photo = await loadOfficialPhoto(photoUrl);
          await uploadFaceToDevice(dev, person, photo);
          faceSyncSucceeded.add(key);
          console.log(`🧑‍💼 [FACE SYNC] ${person.name} (${person.employeeNo}) face photo enrolled on ${dev.name} (${dev.host})`);
        } catch (e) {
          console.warn(`⚠️ [FACE SYNC NOTICE] ${person.name} (${person.employeeNo}) via ${dev.name}: ${e.message} — will retry next cycle`);
        }
      }
    }
  } catch (e) {
    console.warn('[FACE SYNC] skipped:', e.message);
  }
}

async function startBridge() {
  await startStatusServer();

  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('  🏛️  DARSE BURHANI — HIKVISION CLOUD ATTENDANCE BRIDGE');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`🎯 Target Cloud URL : ${RENDER_BASE}`);
  console.log(`🌐 Webhook Gateway  : ${WEBHOOK_URL}`);
  console.log(`🖥️  Monitored Terminals:\n   ${DEVICES.map((d) => `• ${d.name} (http://${d.host}:${d.port})`).join('\n   ')}`);
  console.log('────────────────────────────────────────────────────────────────────');

  // 1. Initial 24h scan catch-up on all terminals with deep pagination.
  // Clock is corrected BEFORE querying so event-window and scan timestamps are IST-accurate.
  console.log('🔄 Checking physical terminals & catching up today\'s scans...');
  for (const dev of DEVICES) {
    const clock = await syncDeviceClock(dev);
    if (clock.ok && clock.driftSeconds !== null && Math.abs(clock.driftSeconds) <= 45) {
      console.log(`🕒 [CLOCK OK] ${dev.name} (${dev.host}) drift ${clock.driftSeconds}s`);
    }
    pollDeviceEvents(dev, 24, 60).catch(() => {});
  }

  // 2. Official Galiakot-kgs staff photos → terminal face-database sync
  console.log('🧑‍💼 Syncing official staff photos to terminal face databases...');
  syncOfficialFaceData().catch(() => {});
  setInterval(() => syncOfficialFaceData().catch(() => {}), 30 * 60 * 1000);

  // 3. Launch persistent AlertStream listeners
  for (const dev of DEVICES) {
    (async () => {
      while (true) {
        await listenAlertStream(dev);
        await new Promise((r) => setTimeout(r, 4000));
      }
    })();
  }

  // 3. Launch rapid poller
  setInterval(() => {
    for (const dev of DEVICES) {
      pollDeviceEvents(dev, 1, 3).catch(() => {});
    }
  }, 4000);

  // 4. Clock checks every 30s
  setInterval(() => {
    for (const dev of DEVICES) {
      syncDeviceClock(dev).catch(() => {});
    }
  }, 30000);

  // 5. Render Keep-Alive ping every 3 minutes (sticky fallback base)
  setInterval(async () => {
    try {
      await fetch(`${lastGoodHealthBase}/api/health`, { signal: AbortSignal.timeout(10000) });
    } catch {
      for (const base of CLOUD_HEALTH_BASES) {
        try {
          await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(10000) });
          lastGoodHealthBase = base;
          break;
        } catch {}
      }
    }
  }, 180000);

  console.log('\n🚀 BRIDGE IS RUNNING LIVE! Keep this window open on the school PC.');
  console.log('   All biometric punches from physical terminals are syncing to Render.');
  console.log('════════════════════════════════════════════════════════════════════\n');
}

const STATUS_PORT = parseInt(process.env.BRIDGE_STATUS_PORT || '8099', 10);

function startStatusServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === '/health' || req.url === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ONLINE',
        uptimeSeconds: Math.round(process.uptime()),
        startedAt: stats.startedAt,
        totalPunches: stats.totalPunches,
        renderSynced: stats.renderSynced,
        dbDirectSynced: stats.dbDirectSynced,
        lastPunch: stats.lastPunch,
        devices: DEVICES.map((d) => ({ name: d.name, host: d.host, port: d.port })),
        cloudUrl: RENDER_BASE,
      }, null, 2));
      return;
    }

    const uptimeMins = Math.floor(process.uptime() / 60);
    const uptimeHours = Math.floor(uptimeMins / 60);
    const uptimeDays = Math.floor(uptimeHours / 24);
    const uptimeStr = uptimeDays > 0 
      ? `${uptimeDays}d ${uptimeHours % 24}h ${uptimeMins % 60}m` 
      : `${uptimeHours}h ${uptimeMins % 60}m ${Math.floor(process.uptime() % 60)}s`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Darse Burhani — Hikvision Bridge (24/7)</title>
  <meta http-equiv="refresh" content="10">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 680px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 24px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); border: 1px solid #334155; }
    .badge { display: inline-flex; align-items: center; gap: 6px; background: #064e3b; color: #34d399; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 13px; }
    .badge-dot { width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981; animation: pulse 2s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
    h1 { margin: 8px 0 16px 0; font-size: 22px; font-weight: 700; color: #fff; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
    .metric { background: #0f172a; padding: 14px; border-radius: 8px; border: 1px solid #334155; }
    .metric-val { font-size: 20px; font-weight: 700; color: #38bdf8; }
    .metric-lbl { font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-top: 4px; }
    .list { margin-top: 16px; background: #0f172a; border-radius: 8px; padding: 12px; border: 1px solid #334155; font-size: 13px; }
    .device-item { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #1e293b; }
    .device-item:last-child { border-bottom: none; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span class="badge"><span class="badge-dot"></span> LIVE 24/7 ACTIVE</span>
      <span style="font-size:12px; color:#94a3b8;">Uptime: ${uptimeStr}</span>
    </div>
    <h1>🏛️ Darse Burhani — Hikvision Cloud Bridge</h1>
    <p style="color:#94a3b8; font-size:14px; margin-top:-8px;">Local biometric hardware bridge syncing Hikvision terminals with live cloud.</p>
    
    <div class="grid">
      <div class="metric"><div class="metric-val">${stats.totalPunches}</div><div class="metric-lbl">Total Scans Synced</div></div>
      <div class="metric"><div class="metric-val">${stats.renderSynced}</div><div class="metric-lbl">Render Cloud Pushes</div></div>
      <div class="metric"><div class="metric-val">${stats.dbDirectSynced}</div><div class="metric-lbl">Supabase Direct Records</div></div>
      <div class="metric"><div class="metric-val">${stats.lastPunch ? (stats.lastPunch.name || stats.lastPunch.employeeNo) : 'None yet'}</div><div class="metric-lbl">Last Punch Person</div></div>
    </div>

    <div class="list">
      <strong style="color:#cbd5e1;">Monitored Terminals:</strong>
      ${DEVICES.map((d) => `<div class="device-item"><span>🟢 ${d.name} (${d.host})</span><span style="color:#34d399;">Active</span></div>`).join('')}
    </div>

    <div style="margin-top:16px; font-size:12px; color:#64748b; text-align:center;">
      Target: ${RENDER_BASE} • Auto-refreshing every 10s
    </div>
  </div>
</body>
</html>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`\n⚠️  [INSTANCE ALREADY ACTIVE] Port ${STATUS_PORT} is in use.`);
      console.warn('   Another 24/7 Hikvision Bridge instance is already running on this PC.');
      console.warn(`   View live dashboard at: http://localhost:${STATUS_PORT}\n`);
      process.exit(42);
    }
  });

  server.listen(STATUS_PORT, '127.0.0.1', () => {
    console.log(`📊 Local Status Dashboard : http://localhost:${STATUS_PORT}`);
    resolve(server);
  });
});
}

// 24/7 Resilience Guards: Prevent transient network drops/timeouts from terminating the process
process.on('unhandledRejection', (reason) => {
  console.warn('⚠️ [BRIDGE WARNING] Unhandled promise rejection caught (continuing 24/7 daemon):', reason?.message || reason);
});

process.on('uncaughtException', (err) => {
  console.error('🚨 [BRIDGE ERROR] Uncaught exception caught (recovering daemon):', err?.message || err);
});

startBridge();


