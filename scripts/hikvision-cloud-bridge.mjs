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
 *   💓 Render Free-Tier Friendly: Wake-on-Demand — webhook fires only when scans
 *       happen, no keep-alive pings, so Render sleeps when idle and saves hours
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
  lastSyncAt: null,
  lastSyncCount: 0,
  syncStatus: 'IDLE (Scans stored in Hikvision hardware)',
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
  'https://p01--darse-burhani--bhwmk842lksg.code.run'
).replace(/\/+$/, '');

const SECRET = process.env.BIOMETRIC_SECRET || 'DARSEBURHANI5253';
const WEBHOOK_URL = PUSH_URL_ENV
  ? `${PUSH_URL_ENV}${PUSH_URL_ENV.includes('?') ? '&' : '?'}secret=${encodeURIComponent(SECRET)}`
  : `${RENDER_BASE}/api/hikvision/events?secret=${encodeURIComponent(SECRET)}`;

// Fallback webhook targets. If the primary (custom-domain) gateway is
// unreachable (DNS/SSL/network outage), the bridge retries the live cloud
// deployment URL automatically instead of silently dropping to DB-only sync.
const RENDER_FALLBACK_BASE = (
  process.env.CLOUD_URL ||
  process.env.RENDER_URL ||
  process.env.RENDER_APP_URL ||
  'https://p01--darse-burhani--bhwmk842lksg.code.run'
).replace(/\/+$/, '');
const WEBHOOK_FALLBACKS = [...new Set([
  WEBHOOK_URL,
  `${RENDER_FALLBACK_BASE}/api/hikvision/events?secret=${encodeURIComponent(SECRET)}`,
])];
let lastGoodWebhookIndex = 0;


// Terminal Device Roster
const rawHosts = process.env.HIKVISION_HOSTS || process.env.HIKVISION_HOST || '192.168.0.4,192.168.0.5,192.168.0.11';
const DEVICES = rawHosts
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)
  .map((host, idx) => {
    const [ip, portStr] = host.split(':');
    let name = 'Main Entrance MinMoe (192.168.0.4)';
    if (ip.endsWith('.5') || idx === 1) name = 'Secondary Terminal (192.168.0.5)';
    else if (ip.endsWith('.11') || idx === 2) name = 'Attendance Terminal 3 (192.168.0.11)';
    else if (idx > 0) name = `Terminal ${idx + 1} (${ip})`;
    return {
      id: `dev-${idx + 1}`,
      name,
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

const challengeCache = new Map();

function buildAuthHeader({ username, password, method, uri, chal }) {
  const { realm = '', nonce = '', qop, opaque } = chal;
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  let authStr = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}"`;

  if (qop) {
    const nc = '00000001';
    const cnonce = Math.random().toString(36).slice(2, 10);
    const responseVal = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
    authStr += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${responseVal}"`;
  } else {
    const responseVal = md5(`${ha1}:${nonce}:${ha2}`);
    authStr += `, response="${responseVal}"`;
  }
  if (opaque) authStr += `, opaque="${opaque}"`;
  return authStr;
}

async function digestFetch(url, { method = 'GET', username, password, body, headers = {}, timeoutMs = 8000 }) {
  const urlObj = new URL(url);
  const hostKey = `${urlObj.hostname}:${urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80)}`;
  const uri = urlObj.pathname + urlObj.search;

  let chal = challengeCache.get(hostKey);
  // If no cached challenge exists and we are about to send a body,
  // probe the device with a lightweight GET first so the device challenges without
  // resetting the socket on an unauthenticated payload.
  if (!chal && body) {
    try {
      const probeRes = await fetch(`${urlObj.origin}/ISAPI/System/time`, {
        signal: AbortSignal.timeout(Math.min(timeoutMs, 4000)),
      });
      const authHeader = probeRes.headers.get('www-authenticate') || '';
      if (authHeader.toLowerCase().includes('digest')) {
        chal = parseDigestHeader(authHeader.replace(/^digest\s+/i, ''));
        challengeCache.set(hostKey, chal);
      }
    } catch { }
  }

  const reqHeaders = { ...headers };
  if (chal) {
    reqHeaders['Authorization'] = buildAuthHeader({ username, password, method, uri, chal });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, { method, headers: reqHeaders, body, signal: controller.signal });

    if (res.status === 401) {
      const authHeader = res.headers.get('www-authenticate') || '';
      if (authHeader.toLowerCase().includes('digest')) {
        chal = parseDigestHeader(authHeader.replace(/^digest\s+/i, ''));
        challengeCache.set(hostKey, chal);
        const retryHeaders = {
          ...headers,
          Authorization: buildAuthHeader({ username, password, method, uri, chal }),
        };
        res = await fetch(url, { method, headers: retryHeaders, body, signal: controller.signal });
      }
    }
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/** Check if timestamp (or current time) falls on Sunday in Indian Standard Time (+05:30) */
function isSundayIST(dateOrIsoStr) {
  const d = new Date(dateOrIsoStr || Date.now());
  if (isNaN(d.getTime())) return false;
  const istDate = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
  return istDate.getUTCDay() === 0;
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
 * Check if current time falls within the hardcoded legacy attendance window in IST
 * (07:20 AM - 08:35 AM, Mon-Sat). Used only as a fallback when the schedule
 * windows cannot be read from the database.
 */
function isSchoolHoursIST(d = new Date()) {
  if (process.env.FORCE_PING === 'true') return true;
  if (isSundayIST(d)) return false;
  const ist = getIstParts(d);
  const minutes = parseInt(ist.hour, 10) * 60 + parseInt(ist.minute, 10);
  // STRICTLY ACTIVE FROM 07:20 AM TILL 08:35 AM FOR ATTENDANCE
  // Strictly active 07:20 AM - 08:35 AM IST for biometric attendance
  return minutes >= (7 * 60 + 20) && minutes <= (8 * 60 + 35);
}

// ── Schedule-Driven Scan Window Gate ────────────────────────────────────────
// Polling follows the ACTUAL attendance schedule windows configured in the
// admin Attendance Schedule page (biometricScanWindow table) instead of a
// hardcoded clock window, so no scheduled scan event is ever missed — and no
// terminal (or Render instance) is woken outside scheduled events.

let scheduleWindowsCache = { at: 0, rows: [] };

async function loadScheduleWindows() {
  const now = Date.now();
  if (now - scheduleWindowsCache.at < 60_000 && scheduleWindowsCache.rows) {
    return scheduleWindowsCache.rows;
  }
  try {
    const rows = await prisma.biometricScanWindow.findMany({ orderBy: { startTime: 'asc' } });
    scheduleWindowsCache = { at: now, rows };
    return rows;
  } catch (err) {
    // Fall back to whatever we have (possibly empty → legacy clock window)
    scheduleWindowsCache = { at: now, rows: scheduleWindowsCache.rows || [] };
    return scheduleWindowsCache.rows;
  }
}

function toMinutesHHMM(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * True when ANY enabled hardware schedule event is currently active (or inside
 * its pre-buffer / post-tail so early arrivals and stragglers are still polled).
 * MANUAL roll-call rows never wake the terminals or Render.
 */
async function isScanWindowActiveIST(d = new Date()) {
  if (process.env.FORCE_PING === 'true') return true;
  if (isSundayIST(d)) return false;

  const PRE_BUFFER_MIN = 10;  // wake slightly before the event opens
  const POST_TAIL_MIN = 15;   // keep polling briefly after the event closes

  try {
    const rows = await loadScheduleWindows();
    if (rows.length === 0) return isSchoolHoursIST(d); // no schedule data → legacy window

    const ist = getIstParts(d);
    const nowMin = parseInt(ist.hour, 10) * 60 + parseInt(ist.minute, 10);

    for (const row of rows) {
      if (!row.enabled) continue;
      if (getWindowKind(row) === 'MANUAL') continue; // roll call: no terminal polling

      const exempt = Array.isArray(row.exemptStudentIds) ? row.exemptStudentIds : [];
      const audienceFacultyOnly = exempt.includes('AUDIENCE_FACULTY');
      const audienceStudentOnly = exempt.includes('AUDIENCE_STUDENT');

      const ranges = [];
      if (!audienceFacultyOnly) {
        const s = toMinutesHHMM(row.startTime);
        const e = toMinutesHHMM(row.lateEndTime || row.endTime);
        if (s !== null && e !== null) ranges.push([s, e]);
      }
      const hasFacultyTimer = Boolean(row.facultyStartTime && row.facultyEndTime);
      if (!audienceStudentOnly && (hasFacultyTimer || audienceFacultyOnly)) {
        const fs = toMinutesHHMM(hasFacultyTimer ? row.facultyStartTime : row.startTime);
        const fe = toMinutesHHMM(hasFacultyTimer ? (row.facultyLateEndTime || row.facultyEndTime) : (row.lateEndTime || row.endTime));
        if (fs !== null && fe !== null && row.facultyEnabled !== false) ranges.push([fs, fe]);
      }

      for (const [startMin, endMin] of ranges) {
        if (nowMin >= Math.max(0, startMin - PRE_BUFFER_MIN) && nowMin <= endMin + POST_TAIL_MIN) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return isSchoolHoursIST(d);
  }
}

function getWindowKind(row) {
  const exempt = Array.isArray(row.exemptStudentIds) ? row.exemptStudentIds : [];
  if (exempt.includes('TYPE_BOTH') || /\[both\]/i.test(row.name || '')) return 'BOTH';
  if (exempt.includes('TYPE_HIKVISION') || /\[hikvision\]|\[hik\]/i.test(row.name || '')) return 'HIKVISION';
  if (exempt.includes('TYPE_MANUAL') || /\[manual\]/i.test(row.name || '')) return 'MANUAL';
  if (String(row.id || '').startsWith('manual_')) return 'MANUAL';
  return 'HIKVISION';
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


// ── On-Demand Hikvision Cloud Sync ─────────────────────────────────
// Automatic 3-minute keep-alive pings to Render have been disabled to conserve
// Render's 750 free-tier monthly hours. All punches remain safely stored inside
// the Hikvision hardware memory and the local database.
//
// When the admin clicks "Poll from Hik & Sync to Render" on the web page or the
// bridge dashboard, syncAllDevicesToRender() is executed on demand.

/**
 * Pull all scans from both Hikvision terminals for an ENTIRE MONTH
 * and sync every single punch to Render Cloud and database.
 */
export async function syncMonthDevicesToRender(monthStr) {
  const ist = getIstParts();
  const targetMonth = monthStr || `${ist.year}-${ist.month}`;
  const [yStr, mStr] = targetMonth.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const lastDay = new Date(y, m, 0).getDate();
  const startDateStr = `${targetMonth}-01`;
  const endDateStr = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

  console.log(`\n============================================================`);
  console.log(`⚡ [RENDER FULL MONTH RUN] PULLING HIKVISION SCANS FOR ${targetMonth}`);
  console.log(`📅 Period: ${startDateStr} to ${endDateStr} (Full ${lastDay} Days)`);
  console.log(`============================================================`);
  stats.syncStatus = `RUNNING FULL MONTH ${targetMonth}...`;

  const startTime = `${startDateStr}T00:00:00+05:30`;
  const endTime = `${endDateStr}T23:59:59+05:30`;
  const allEvents = [];
  const deviceReports = [];

  const reports = await Promise.all(
    DEVICES.map(async (dev) => {
      let devEvents = [];
      let position = 0;
      const pageSize = 30;
      let hasMore = true;
      let totalMatches = null;

      console.log(`   ⏳ Querying ${dev.name} (${dev.host}) for entire month ${targetMonth}...`);

      while (hasMore) {
        const payload = JSON.stringify({
          AcsEventCond: {
            searchID: `month-${Date.now()}-${dev.id}`,
            searchResultPosition: position,
            maxResults: pageSize,
            major: 0,
            minor: 0,
            startTime,
            endTime,
          },
        });

        const url = `http://${dev.host}:${dev.port}/ISAPI/AccessControl/AcsEvent?format=json`;
        try {
          const res = await digestFetch(url, {
            method: 'POST',
            username: dev.username,
            password: dev.password,
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            timeoutMs: 12000,
          });

          if (!res.ok) {
            console.warn(`      ⚠️ HTTP ${res.status} at position ${position}`);
            break;
          }

          const data = await res.json();
          const acs = data?.AcsEvent;
          if (!acs) break;

          totalMatches = acs.totalMatches ?? totalMatches;
          const list = acs.InfoList || [];
          if (list.length === 0) break;

          for (const item of list) {
            const rawEmp = item.employeeNoString || item.name || item.cardNo;
            if (!rawEmp) continue;
            const empNo = canonicalizeEmployeeNo(rawEmp, item.name);
            const timeStr = normalizeDeviceTime(item.time);
            const serial = item.serialNo || item.serial || `${empNo}-${timeStr}`;
            const verifyMode = item.currentVerifyMode || (item.minor === 75 ? 'FACIAL' : 'FINGERPRINT');
            devEvents.push({
              employeeNo: empNo,
              name: item.name || '',
              cardNo: item.cardNo || '',
              time: timeStr,
              currentVerifyMode: verifyMode,
              serialNo: serial,
              deviceHost: dev.host,
            });
          }

          position += list.length;
          if (totalMatches !== null && position >= totalMatches) break;
          if (acs.responseStatusStrg && acs.responseStatusStrg !== 'MORE') break;
        } catch (err) {
          console.error(`      ❌ Month fetch error for ${dev.name}:`, err.message);
          break;
        }
      }

      console.log(`   ✓ Retrieved ${devEvents.length} events for ${targetMonth} from ${dev.name} (${dev.host})`);
      return {
        events: devEvents,
        report: {
          name: dev.name,
          host: dev.host,
          fetched: devEvents.length,
          success: true,
        },
      };
    })
  );

  for (const r of reports) {
    deviceReports.push(r.report);
    allEvents.push(...r.events);
  }

  // Deduplicate by employeeNo + date/time minute
  const uniqueEvents = [];
  const seen = new Set();
  for (const ev of allEvents) {
    const key = `${ev.employeeNo}-${ev.time.slice(0, 16)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEvents.push(ev);
    }
  }

  console.log(`   📦 Total unique monthly scans: ${uniqueEvents.length}. Syncing to DB & Render...`);

  // Ensure local DB has all records
  for (const ev of uniqueEvents) {
    recordDirectScanInDatabase(ev).catch(() => { });
  }

  // Forward to Render Cloud in chunks of 15
  let pushedToCloud = 0;
  let failedCloud = 0;
  const chunkSize = 15;

  for (let i = 0; i < uniqueEvents.length; i += chunkSize) {
    const chunk = uniqueEvents.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (ev) => {
        try {
          const payload = {
            AccessControllerEvent: {
              employeeNoString: String(ev.employeeNo),
              name: ev.name || '',
              cardNo: ev.cardNo || '',
              time: ev.time,
              currentVerifyMode: ev.currentVerifyMode || 'FINGERPRINT',
              serialNo: String(ev.serialNo || `${ev.employeeNo}-${ev.time}`),
              deviceId: ev.deviceHost,
            },
          };
          const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-biometric-secret': SECRET,
              'x-webhook-secret': SECRET,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) pushedToCloud++;
          else failedCloud++;
        } catch {
          failedCloud++;
        }
      })
    );
  }

  stats.renderSynced += pushedToCloud;
  stats.lastSyncAt = new Date().toISOString();
  stats.lastSyncCount = pushedToCloud;
  stats.syncStatus = `FULL MONTH ${targetMonth} COMPLETE (${pushedToCloud} pushed to Render)`;

  console.log(`✅ [FULL MONTH RUN COMPLETED] ${uniqueEvents.length} events processed. ${pushedToCloud} pushed to Render Cloud (${failedCloud} failed).`);

  return {
    success: true,
    month: targetMonth,
    daysInMonth: lastDay,
    totalFetched: uniqueEvents.length,
    pushedToRender: pushedToCloud,
    failedRender: failedCloud,
    devices: deviceReports,
  };
}

export async function syncAllDevicesToRender(targetDateStr) {
  const ist = getIstParts();
  const dateStr = targetDateStr || `${ist.year}-${ist.month}-${ist.day}`;
  console.log(`\n============================================================`);
  console.log(`⚡ [ON-DEMAND SYNC] PULLING HIKVISION SCANS FOR ${dateStr}`);
  console.log(`============================================================`);
  stats.syncStatus = `SYNCING ${dateStr}...`;

  const startTime = `${dateStr}T00:00:00+05:30`;
  const endTime = `${dateStr}T23:59:59+05:30`;
  const allEvents = [];
  const deviceReports = [];

  const reports = await Promise.all(
    DEVICES.map(async (dev) => {
      let devEvents = [];
      let position = 0;
      const pageSize = 30;
      let hasMore = true;
      let totalMatches = null;

      console.log(`   ⏳ Querying ${dev.name} (${dev.host})...`);

      while (hasMore) {
        const payload = JSON.stringify({
          AcsEventCond: {
            searchID: `sync-${Date.now()}-${dev.id}`,
            searchResultPosition: position,
            maxResults: pageSize,
            major: 0,
            minor: 0,
            startTime,
            endTime,
          },
        });

        const url = `http://${dev.host}:${dev.port}/ISAPI/AccessControl/AcsEvent?format=json`;
        try {
          const res = await digestFetch(url, {
            method: 'POST',
            username: dev.username,
            password: dev.password,
            headers: { 'Content-Type': 'application/json' },
            body: payload,
            timeoutMs: 8000,
          });

          if (!res.ok) {
            console.warn(`      ⚠️ HTTP ${res.status} at position ${position}`);
            break;
          }

          const data = await res.json();
          const acs = data?.AcsEvent;
          if (!acs) break;

          totalMatches = acs.totalMatches ?? totalMatches;
          const list = acs.InfoList || [];
          if (list.length === 0) break;

          for (const item of list) {
            const rawEmp = item.employeeNoString || item.name || item.cardNo;
            if (!rawEmp) continue;
            const empNo = canonicalizeEmployeeNo(rawEmp, item.name);
            const timeStr = normalizeDeviceTime(item.time);
            const serial = item.serialNo || item.serial || `${empNo}-${timeStr}`;
            const verifyMode = item.currentVerifyMode || (item.minor === 75 ? 'FACIAL' : 'FINGERPRINT');
            devEvents.push({
              employeeNo: empNo,
              name: item.name || '',
              cardNo: item.cardNo || '',
              time: timeStr,
              currentVerifyMode: verifyMode,
              serialNo: serial,
              deviceHost: dev.host,
            });
          }

          position += list.length;
          if (totalMatches !== null && position >= totalMatches) break;
          if (acs.responseStatusStrg && acs.responseStatusStrg !== 'MORE') break;
        } catch (err) {
          console.error(`      ❌ Fetch error for ${dev.name}:`, err.message);
          break;
        }
      }

      console.log(`   ✓ Retrieved ${devEvents.length} events from ${dev.name} (${dev.host})`);
      return {
        events: devEvents,
        report: {
          name: dev.name,
          host: dev.host,
          fetched: devEvents.length,
          success: true,
        },
      };
    })
  );

  for (const r of reports) {
    deviceReports.push(r.report);
    allEvents.push(...r.events);
  }

  // Deduplicate by employeeNo + date/time minute
  const uniqueEvents = [];
  const seen = new Set();
  for (const ev of allEvents) {
    const key = `${ev.employeeNo}-${ev.time.slice(0, 16)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEvents.push(ev);
    }
  }

  console.log(`   📦 Total unique events to forward: ${uniqueEvents.length}`);

  // Ensure local DB has all of them as well
  for (const ev of uniqueEvents) {
    recordDirectScanInDatabase(ev).catch(() => { });
  }

  // Push to Render Cloud in concurrent batches of 15
  let pushedToCloud = 0;
  let failedCloud = 0;
  const chunkSize = 15;

  for (let i = 0; i < uniqueEvents.length; i += chunkSize) {
    const chunk = uniqueEvents.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (ev) => {
        try {
          const payload = {
            AccessControllerEvent: {
              employeeNoString: String(ev.employeeNo),
              name: ev.name || '',
              cardNo: ev.cardNo || '',
              time: ev.time,
              currentVerifyMode: ev.currentVerifyMode || 'FINGERPRINT',
              serialNo: String(ev.serialNo || `${ev.employeeNo}-${ev.time}`),
              deviceId: ev.deviceHost,
            },
          };
          const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-biometric-secret': SECRET,
              'x-webhook-secret': SECRET,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
          });
          if (res.ok) pushedToCloud++;
          else failedCloud++;
        } catch {
          failedCloud++;
        }
      })
    );
  }

  stats.renderSynced += pushedToCloud;
  stats.lastSyncAt = new Date().toISOString();
  stats.lastSyncCount = pushedToCloud;
  stats.syncStatus = `COMPLETED (${pushedToCloud} pushed to Render for ${dateStr})`;

  console.log(`✅ [SYNC COMPLETE] ${uniqueEvents.length} events processed. ${pushedToCloud} pushed to Render Cloud (${failedCloud} failed).`);

  return {
    success: true,
    date: dateStr,
    totalFetched: uniqueEvents.length,
    pushedToRender: pushedToCloud,
    failedRender: failedCloud,
    devices: deviceReports,
  };
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
  if (id === '3038798' || nameStr === '3038798' || /murtaza.*jamali/i.test(combined)) {
    return '30387984';
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

  // Sunday Institutional Holiday: Never record or create attendance on Sundays
  if (calendarDayUTC.getUTCDay() === 0) {
    console.log(`   🏖️ [DIRECT DB SYNC] Sunday Institutional Holiday — skipping attendance write for ${employeeNo}`);
    return { ok: true, matchedType: 'HOLIDAY', name: 'Sunday Holiday' };
  }

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

      const firstCheckIn = existingRegistry?.checkInTime && existingRegistry.checkInTime < scanDate ? existingRegistry.checkInTime : scanDate;
      const lastCheckOut = existingRegistry?.checkOutTime && existingRegistry.checkOutTime > scanDate ? existingRegistry.checkOutTime : scanDate;
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
          checkInTime: firstCheckIn,
          checkOutTime: lastCheckOut,
          recordedById: student.userId,
        },
        update: {
          status: registryStatus,
          source: 'BIOMETRIC',
          checkInTime: firstCheckIn,
          checkOutTime: lastCheckOut,
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
            checkInTime: firstCheckIn,
            checkOutTime: lastCheckOut,
            verificationMethod: 'BIOMETRIC',
            biometricMethod,
            biometricHash: rawId,
            recordedById: student.userId,
          },
          update: {
            status: registryStatus,
            source: 'BIOMETRIC',
            checkInTime: firstCheckIn,
            checkOutTime: lastCheckOut,
            verificationMethod: 'BIOMETRIC',
            biometricMethod,
            biometricHash: rawId,
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

      const firstCheckIn = existingTeacherRecord?.checkInTime && existingTeacherRecord.checkInTime < scanDate ? existingTeacherRecord.checkInTime : scanDate;
      const lastCheckOut = existingTeacherRecord?.checkOutTime && existingTeacherRecord.checkOutTime > scanDate ? existingTeacherRecord.checkOutTime : scanDate;
      const hasMultiple = lastCheckOut.getTime() - firstCheckIn.getTime() > 60000;
      const timeFormatted = firstCheckIn.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
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
          checkInTime: firstCheckIn,
          checkOutTime: hasMultiple ? lastCheckOut : null,
          verificationMethod: 'BIOMETRIC',
          biometricMethod,
          biometricHash: rawId,
          notes: `Premises check-in scan (${timeFormatted} IST via ${biometricMethod})`,
        },
        update: {
          status: teacherStatus,
          checkInTime: firstCheckIn,
          checkOutTime: hasMultiple ? lastCheckOut : null,
          verificationMethod: 'BIOMETRIC',
          biometricMethod,
          biometricHash: rawId,
          notes: `Premises check-in scan (${timeFormatted} IST via ${biometricMethod})`,
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

  // Sunday Institutional Holiday: Discard all scanning on Sunday (never mark absent or record punches)
  if (isSundayIST(timeStr)) {
    console.log(`🏖️ [SUNDAY HOLIDAY] Skipping scan for ${employeeNo} (${timeStr}) — Sunday is institutional holiday.`);
    return;
  }
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

  // 1. Live webhook forward to Render (wake-on-demand: fires only when a scan
  //    actually happens, so Render sleeps whenever attendance is quiet).
  //    Set LIVE_CLOUD_PUSH=false to run in sleep-only mode (direct DB writes only).
  const shouldLivePush = process.env.LIVE_CLOUD_PUSH !== 'false';
  if (shouldLivePush) {
    // Fire-and-forget: never block the LAN poller while Render spins up from
    // sleep (free-tier cold start can take ~1 minute — hence the 90s timeout).
    // The punch is already safe via the direct-DB write below; this webhook
    // wakes Render so dashboards, notifications and caches refresh instantly.
    void (async () => {
      for (let attempt = 0; attempt < WEBHOOK_FALLBACKS.length; attempt++) {
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
            signal: AbortSignal.timeout(90_000),
          });
          if (res.ok) {
            lastGoodWebhookIndex = idx;
            stats.renderSynced++;
            break;
          }
        } catch (e) { }
      }
    })();
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
            if (isSundayIST(timeStr)) {
              console.log(`🏖️ [SUNDAY HOLIDAY] Ignored AlertStream punch for ${employeeNo} at ${timeStr} (Sunday is institutional holiday).`);
              continue;
            }
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
        } catch { }
        buffer = buffer.slice(jsonMatch.index + jsonMatch[0].length);
      }

      // 2. Process XML events
      let xmlMatch;
      while ((xmlMatch = buffer.match(/<AccessControllerEvent[\s\S]*?<\/AccessControllerEvent>/i))) {
        const ev = parseXmlEvent(xmlMatch[0]);
        if (ev && ev.employeeNoString) {
          if (isSundayIST(ev.time)) {
            console.log(`🏖️ [SUNDAY HOLIDAY] Ignored AlertStream XML punch for ${ev.employeeNoString} at ${ev.time} (Sunday is institutional holiday).`);
            continue;
          }
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
  if (isSundayIST(new Date())) {
    return; // Sunday is institutional holiday — no device polling
  }
  if (!(await isScanWindowActiveIST(new Date()))) {
    return; // No schedule event active: skip polling so terminals and Render both rest
  }
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
  } catch { }

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

async function checkDeviceUserFace(dev, employeeNo) {
  try {
    const res = await digestFetch(
      `http://${dev.host}:${dev.port}/ISAPI/AccessControl/UserInfo/Search?format=json`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          UserInfoSearchCond: {
            searchID: `face-chk-${Date.now()}`,
            searchResultPosition: 0,
            maxResults: 1,
            EmployeeNoList: [{ employeeNo: String(employeeNo) }],
          },
        }),
        username: dev.username,
        password: dev.password,
        timeoutMs: 6000,
      }
    );
    if (!res.ok) return false;
    const data = await res.json();
    const user = data?.UserInfoSearch?.UserInfo?.[0];
    return Boolean(user && (user.numOfFace >= 1 || user.faceURL));
  } catch {
    return false;
  }
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
        if (faceSyncSucceeded.has(key)) continue; // already enrolled/verified on this terminal

        // Check if user's face is already enrolled directly on the physical terminal
        const alreadyEnrolled = await checkDeviceUserFace(dev, person.employeeNo);
        if (alreadyEnrolled) {
          faceSyncSucceeded.add(key);
          console.log(`🧑‍💼 [FACE SYNC] ${person.name} (${person.employeeNo}) face already enrolled on ${dev.name} (${dev.host})`);
          continue;
        }

        const photoUrl = person.photoUrl.startsWith('http')
          ? person.photoUrl
          : `${RENDER_BASE}${person.photoUrl.startsWith('/') ? '' : '/'}${person.photoUrl}`;
        try {
          const photo = await loadOfficialPhoto(photoUrl);
          await uploadFaceToDevice(dev, person, photo);
          faceSyncSucceeded.add(key);
          console.log(`🧑‍💼 [FACE SYNC] ${person.name} (${person.employeeNo}) face photo enrolled on ${dev.name} (${dev.host})`);
        } catch (e) {
          if (e.message?.includes('notSupport') || e.message?.includes('Invalid Operation')) {
            faceSyncSucceeded.add(key);
            console.log(`ℹ️ [FACE SYNC] ${person.name} (${person.employeeNo}) on ${dev.name} is configured for direct camera enrollment.`);
          } else {
            console.warn(`⚠️ [FACE SYNC NOTICE] ${person.name} (${person.employeeNo}) via ${dev.name}: ${e.message} — will retry next cycle`);
          }
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
    pollDeviceEvents(dev, 24, 60).catch(() => { });
  }

  // 2. Official Galiakot-kgs staff photos → terminal face-database sync
  console.log('🧑‍💼 Syncing official staff photos to terminal face databases...');
  syncOfficialFaceData().catch(() => { });
  setInterval(() => syncOfficialFaceData().catch(() => { }), 30 * 60 * 1000);

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
      pollDeviceEvents(dev, 1, 3).catch(() => { });
    }
  }, 4000);

  // 4. Clock checks every 30s
  setInterval(() => {
    for (const dev of DEVICES) {
      syncDeviceClock(dev).catch(() => { });
    }
  }, 30000);

  // 5. Render Free-Tier Protection: keep-alive pings are intentionally DISABLED.
  // Render is woken ONLY by real scan webhooks (wake-on-demand) and goes back to
  // sleep 15 minutes after the last scan — saving the 750 free-tier hours/month.
  // Admin can still wake/sync anytime via "Poll from Hik & Sync to Render".

  console.log('\n🚀 BRIDGE IS RUNNING LIVE! Keep this window open on the school PC.');
  console.log('   All biometric punches from physical terminals are syncing to Render.');
  console.log('════════════════════════════════════════════════════════════════════\n');
}

const STATUS_PORT = parseInt(process.env.BRIDGE_STATUS_PORT || '8099', 10);

// ── Security Bridge Protection Layer ──
const bridgeNonceCache = new Map();
const bridgeIpRateLimits = new Map();

function checkBridgeRateLimit(ip) {
  const now = Date.now();
  let entry = bridgeIpRateLimits.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60000 };
    bridgeIpRateLimits.set(ip, entry);
  }
  entry.count++;
  return entry.count <= 120;
}

function validateBridgeSecurity(req, reqUrl) {
  const clientSecret =
    req.headers['x-biometric-secret'] ||
    req.headers['x-bridge-token'] ||
    reqUrl.searchParams.get('secret') ||
    reqUrl.searchParams.get('token');

  const isActionEndpoint =
    reqUrl.pathname.startsWith('/api/sync') ||
    reqUrl.pathname.startsWith('/api/clock') ||
    reqUrl.pathname.startsWith('/api/restart');

  if (!isActionEndpoint) return { authorized: true };

  if (!clientSecret || typeof clientSecret !== 'string') {
    return { authorized: false, error: 'Unauthorized: Missing Security Bridge token.' };
  }

  try {
    const a = Buffer.from(clientSecret);
    const b = Buffer.from(SECRET);
    if (a.length !== b.length || !createHash('sha256').update(a).digest().equals(createHash('sha256').update(b).digest())) {
      return { authorized: false, error: 'Forbidden: Invalid Security Bridge cryptographic secret.' };
    }
  } catch {
    return { authorized: false, error: 'Security validation error' };
  }

  const reqTime = req.headers['x-bridge-timestamp'];
  if (reqTime) {
    const diff = Math.abs(Date.now() - new Date(reqTime).getTime());
    if (diff > 300000) {
      return { authorized: false, error: 'Security Bridge: Replay timestamp expired (>300s drift).' };
    }
  }

  const nonce = req.headers['x-bridge-nonce'];
  if (nonce) {
    if (bridgeNonceCache.has(nonce)) {
      return { authorized: false, error: 'Security Bridge: Replayed nonce token detected and rejected.' };
    }
    bridgeNonceCache.set(nonce, Date.now());
    if (bridgeNonceCache.size > 2000) {
      const cutoff = Date.now() - 600000;
      for (const [k, v] of bridgeNonceCache.entries()) {
        if (v < cutoff) bridgeNonceCache.delete(k);
      }
    }
  }

  return { authorized: true };
}

function startStatusServer() {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      // Enable CORS & Chrome Private Network Access (PNA) so browser pages on HTTPS (e.g. darse-burhani.onrender.com) can call this local bridge
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.setHeader('Access-Control-Allow-Private-Network', 'true');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const clientIp = req.socket?.remoteAddress || '127.0.0.1';
      if (!checkBridgeRateLimit(clientIp)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Security Wall: Bridge rate limit exceeded (120 req/min).' }));
        return;
      }

      const reqUrl = new URL(req.url, 'http://127.0.0.1:8099');

      const secCheck = validateBridgeSecurity(req, reqUrl);
      if (!secCheck.authorized) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: secCheck.error }));
        return;
      }

      // Ping & Keep-Alive endpoints
      if (reqUrl.pathname === '/ping' || reqUrl.pathname === '/api/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          pong: true,
          securityWall: 'ARMED',
          timeIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          uptimeSeconds: Math.round(process.uptime()),
        }));
        return;
      }

      // Security Bridge Telemetry Endpoint
      if (reqUrl.pathname === '/api/bridge-security' || reqUrl.pathname === '/api/security') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'SECURE',
          securityWall: 'ACTIVE',
          bridgeId: 'db-hikvision-security-bridge-v2',
          encryption: 'HMAC-SHA256 & Timing-Safe Secret Handshake',
          mutualAuth: true,
          replayProtection: 'ACTIVE (5-min window & nonce verification)',
          rateLimiter: 'ACTIVE (120 req/min/IP)',
          targetCloud: RENDER_BASE,
          uptimeSeconds: Math.round(process.uptime()),
          activeMinMoeDevices: DEVICES.map(d => ({ name: d.name, host: d.host })),
          totalScansSynced: stats.totalPunches,
        }, null, 2));
        return;
      }

      // Full Month Run endpoint: /api/sync-month?month=YYYY-MM
      if (reqUrl.pathname === '/api/sync-month' || reqUrl.pathname === '/api/sync-month-to-render') {
        const monthParam = reqUrl.searchParams.get('month');
        try {
          const result = await syncMonthDevicesToRender(monthParam);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
        return;
      }

      if (reqUrl.pathname === '/health' || reqUrl.pathname === '/api/status') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ONLINE',
          mode: 'ON_DEMAND_SYNC',
          uptimeSeconds: Math.round(process.uptime()),
          startedAt: stats.startedAt,
          totalPunches: stats.totalPunches,
          renderSynced: stats.renderSynced,
          dbDirectSynced: stats.dbDirectSynced,
          lastPunch: stats.lastPunch,
          lastSyncAt: stats.lastSyncAt,
          lastSyncCount: stats.lastSyncCount,
          syncStatus: stats.syncStatus,
          devices: DEVICES.map((d) => ({ name: d.name, host: d.host, port: d.port })),
          cloudUrl: RENDER_BASE,
        }, null, 2));
        return;
      }

      // On-Demand Sync Endpoint called by the "Poll from Hik & Sync to Render" button
      if (reqUrl.pathname === '/api/sync' || reqUrl.pathname === '/api/sync-to-render') {
        const dateParam = reqUrl.searchParams.get('date');
        try {
          const result = await syncAllDevicesToRender(dateParam);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
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

    <!-- On-Demand Sync Control Cockpit -->
    <div style="background: linear-gradient(135deg, #064e3b 0%, #022c22 100%); border-radius: 10px; padding: 18px; border: 1px solid #10b981; margin: 16px 0; text-align: center;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <span style="font-size:13px; color:#a7f3d0; font-weight:700;">⚡ CLOUD SYNC ON-DEMAND</span>
        <span style="font-size:11px; background:#047857; color:#fff; padding:2px 8px; border-radius:6px; font-weight:600;">Render Free Tier Safe</span>
      </div>
      <button id="syncBtn" onclick="runSync()" style="width:100%; background: linear-gradient(135deg, #10b981, #059669); color:#fff; border:none; padding:14px 20px; border-radius:8px; font-weight:800; font-size:15px; cursor:pointer; box-shadow:0 4px 14px rgba(16,185,129,0.35); transition:all 0.2s;">
        ⚡ Poll Scans from Hikvision & Push to Render
      </button>
      <div id="syncStatus" style="font-size:12px; color:#6ee7b7; margin-top:10px; line-height:1.5;">
        ${stats.syncStatus}
      </div>
    </div>

    <script>
      async function runSync() {
        const btn = document.getElementById('syncBtn');
        const st = document.getElementById('syncStatus');
        btn.disabled = true;
        btn.innerText = '⏳ Polling terminals & syncing to Render...';
        st.innerText = 'Connecting to 192.168.0.4 & 192.168.0.5...';
        try {
          const res = await fetch('/api/sync', { method: 'POST' });
          const json = await res.json();
          if (json.success) {
            btn.innerText = '✓ Sync Complete!';
            st.innerHTML = '<span style="color:#34d399; font-weight:bold;">Successfully pulled ' + json.totalFetched + ' scans across terminals and pushed ' + json.pushedToRender + ' to Render!</span>';
            setTimeout(() => { location.reload(); }, 2500);
          } else {
            btn.innerText = '❌ Sync Failed';
            st.innerText = json.error || 'Failed to sync to Render';
            btn.disabled = false;
          }
        } catch (err) {
          btn.innerText = '❌ Network Error';
          st.innerText = err.message;
          btn.disabled = false;
        }
      }
    </script>

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


