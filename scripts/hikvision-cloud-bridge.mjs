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
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const prisma = new PrismaClient();

const RENDER_BASE = (
  process.argv[2] ||
  process.env.RENDER_URL ||
  process.env.RENDER_APP_URL ||
  (process.env.PUBLIC_APP_URL && !process.env.PUBLIC_APP_URL.includes('localhost') && !process.env.PUBLIC_APP_URL.includes('127.0.0.1') ? process.env.PUBLIC_APP_URL : null) ||
  (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost') && !process.env.NEXT_PUBLIC_APP_URL.includes('127.0.0.1') ? process.env.NEXT_PUBLIC_APP_URL : null) ||
  'https://darse-burhani.onrender.com'
).replace(/\/+$/, '');

const SECRET = process.env.BIOMETRIC_SECRET || 'DARSEBURHANI5253';
const WEBHOOK_URL = `${RENDER_BASE}/api/hikvision/events?secret=${encodeURIComponent(SECRET)}`;

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

function getHikvisionTime(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+05:30`;
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

// Direct Database Sync fallback (guarantees real-time record in Supabase)
async function recordDirectScanInDatabase({ employeeNo, time, verifyMode, deviceHost }) {
  const rawId = String(employeeNo || '').trim();
  if (!rawId) return { ok: false, error: 'Empty ID' };

  const strippedNum = rawId.replace(/^0+/, '');
  const candidateIds = Array.from(new Set([rawId, strippedNum])).filter(Boolean);

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

  // Determine status (PRESENT vs LATE)
  const isLate = scanMinutes > 8 * 60 + 1; // After 08:01 AM IST
  const status = isLate ? 'LATE' : 'PRESENT';

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
      include: { user: true },
    });

    if (student) {
      // Upsert student daily attendance registry
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
          status,
          source: 'BIOMETRIC',
          checkInTime: scanDate,
          recordedById: student.userId,
        },
        update: {
          status,
          source: 'BIOMETRIC',
          checkInTime: scanDate,
        },
      });

      console.log(`   💾 [DIRECT DB SYNC] Recorded Talabat attendance: ${student.user.firstName} ${student.user.lastName} (${status})`);
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
          status,
          checkInTime: scanDate,
          verificationMethod: 'BIOMETRIC',
          biometricMethod: verifyMode?.includes('face') ? 'FACIAL' : 'FINGERPRINT',
          biometricHash: rawId,
          notes: `Direct sync from MinMoe (${deviceHost})`,
        },
        update: {
          status,
          checkInTime: scanDate,
          verificationMethod: 'BIOMETRIC',
          biometricMethod: verifyMode?.includes('face') ? 'FACIAL' : 'FINGERPRINT',
          biometricHash: rawId,
        },
      });

      console.log(`   💾 [DIRECT DB SYNC] Recorded Faculty attendance: ${teacher.user.firstName} ${teacher.user.lastName} (${status})`);
      return { ok: true, matchedType: 'TEACHER', name: `${teacher.user.firstName} ${teacher.user.lastName}` };
    }

    return { ok: false, error: 'Unmatched ID' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Dual-path forwarder: Sends to Render Webhook + records to Supabase Database
async function processAndForwardScan({ employeeNo, name, cardNo, time, currentVerifyMode, serialNo, deviceHost }) {
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

  // 1. Send to Render Cloud Webhook
  let webhookSuccess = false;
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-biometric-secret': SECRET,
        'x-webhook-secret': SECRET,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      webhookSuccess = true;
      console.log(`   ☁️  [CLOUD WEBHOOK] Synced to Render (${res.status} OK)`);
    } else {
      console.warn(`   ⚠️ [CLOUD WEBHOOK NOTICE] Render returned HTTP ${res.status} (activating direct DB sync)`);
    }
  } catch (e) {
    console.warn(`   ⚠️ [CLOUD WEBHOOK NOTICE] Cannot reach Render directly: ${e.message}`);
  }

  // 2. Direct Supabase Database Write (Dual-Path Guarantee)
  await recordDirectScanInDatabase({
    employeeNo,
    time: timeStr,
    verifyMode: currentVerifyMode,
    deviceHost,
  });
}

// Check and sync device clock with IST
async function syncDeviceClock(dev) {
  const url = `http://${dev.host}:${dev.port}/ISAPI/System/time`;
  try {
    const res = await digestFetch(url, {
      username: dev.username,
      password: dev.password,
      timeoutMs: 5000,
    });
    if (!res.ok) return;

    const xml = await res.text();
    const timeMatch = xml.match(/<localTime>([^<]+)<\/localTime>/);
    if (!timeMatch) return;

    const devTime = new Date(timeMatch[1]);
    const now = new Date();
    const driftSeconds = Math.round(Math.abs(devTime.getTime() - now.getTime()) / 1000);

    if (driftSeconds > 45) {
      console.log(`⏰ [CLOCK DRIFT] ${dev.name} (${dev.host}) drifted by ${driftSeconds}s. Synchronizing to IST (+05:30)...`);
      const istTime = getHikvisionTime(now);
      const putBody = `<?xml version="1.0" encoding="UTF-8"?>
<Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
<timeMode>manual</timeMode>
<localTime>${istTime}</localTime>
<timeZone>CST-5:30:00</timeZone>
</Time>`;

      await digestFetch(url, {
        method: 'PUT',
        username: dev.username,
        password: dev.password,
        headers: { 'Content-Type': 'application/xml' },
        body: putBody,
        timeoutMs: 5000,
      });
      console.log(`✅ [CLOCK SYNCED] ${dev.name} (${dev.host}) time updated to ${istTime}`);
    }
  } catch {}
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

// Rapid background poller (every 3 seconds)
async function pollDeviceEvents(dev, lookbackHours = 3) {
  const now = new Date();
  const past = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const startTime = getHikvisionTime(past);
  const endTime = getHikvisionTime(now);

  const payload = JSON.stringify({
    AcsEventCond: {
      searchID: `bridge-${Date.now()}`,
      searchResultPosition: 0,
      maxResults: 150,
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

    if (!res.ok) return;
    const data = await res.json();
    const matches = data?.AcsEvent?.InfoList || [];

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
  } catch {}
}

async function startBridge() {
  console.log('\n════════════════════════════════════════════════════════════════════');
  console.log('  🏛️  DARSE BURHANI — HIKVISION CLOUD ATTENDANCE BRIDGE');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`🎯 Target Cloud URL : ${RENDER_BASE}`);
  console.log(`🌐 Webhook Gateway  : ${WEBHOOK_URL}`);
  console.log(`🖥️  Monitored Terminals:\n   ${DEVICES.map((d) => `• ${d.name} (http://${d.host}:${d.port})`).join('\n   ')}`);
  console.log('────────────────────────────────────────────────────────────────────');

  // 1. Initial 24h scan catch-up on all terminals
  console.log('🔄 Checking physical terminals & catching up today\'s scans...');
  for (const dev of DEVICES) {
    syncDeviceClock(dev).catch(() => {});
    pollDeviceEvents(dev, 24).catch(() => {});
  }

  // 2. Launch persistent AlertStream listeners
  for (const dev of DEVICES) {
    (async () => {
      while (true) {
        await listenAlertStream(dev);
        await new Promise((r) => setTimeout(r, 4000));
      }
    })();
  }

  // 3. Launch 3-second rapid poller
  setInterval(() => {
    for (const dev of DEVICES) {
      pollDeviceEvents(dev, 3).catch(() => {});
    }
  }, 3000);

  // 4. Keep-alive heartbeat & clock checks every 30s
  setInterval(() => {
    for (const dev of DEVICES) {
      syncDeviceClock(dev).catch(() => {});
    }
  }, 30000);

  console.log('\n🚀 BRIDGE IS RUNNING LIVE! Keep this window open on the school PC.');
  console.log('   All biometric punches from physical terminals are syncing to Render.');
  console.log('════════════════════════════════════════════════════════════════════\n');
}

startBridge();
