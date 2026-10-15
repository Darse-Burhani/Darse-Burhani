/**
 * backfill-attendance.mjs
 *
 * Fetches ALL face-scan attendance events from both Hikvision terminals for
 * one or more IST calendar days and pushes them to the Render cloud API
 * (/api/hikvision/events).  Identical logic to sync-today-scans.mjs's
 * fetchAllTodayEvents + clock-drift correction, but output goes to the cloud
 * instead of a local Prisma DB.
 *
 * Usage:
 *   node scripts/backfill-attendance.mjs [YYYY-MM-DD ...]
 *
 * Examples:
 *   node scripts/backfill-attendance.mjs 2026-10-14
 *   node scripts/backfill-attendance.mjs 2026-10-14 2026-10-15
 *
 * If no dates are given it defaults to both 14-Oct and 15-Oct 2026.
 */

import { createHash, createDecipheriv } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const ALGO = 'aes-256-gcm';

// --- Crypto helpers ---

function encKey() {
  const secret = process.env.NEXTAUTH_SECRET ?? 'dev-biometric-secret';
  return createHash('sha256').update(secret).digest();
}

function decryptPassword(enc, iv) {
  if (!enc || !iv) return process.env.HIKVISION_PASSWORD || 'DARSEBURHANI5253';
  try {
    const buf = Buffer.from(enc, 'base64');
    const tag = buf.subarray(buf.length - 16);
    const data = buf.subarray(0, buf.length - 16);
    const decipher = createDecipheriv(ALGO, encKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return process.env.HIKVISION_PASSWORD || 'DARSEBURHANI5253';
  }
}

function md5(str) {
  return createHash('md5').update(str).digest('hex');
}

// --- Digest Auth fetch ---

function parseDigestHeader(header) {
  const params = {};
  const re = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
  let match;
  while ((match = re.exec(header)) !== null) {
    params[match[1]] = match[2] || match[3];
  }
  return params;
}

async function digestFetch(url, { method = 'GET', username, password, body, headers = {}, timeoutMs = 20000 }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const initial = await fetch(url, { method, headers, body, signal: controller.signal });
    if (initial.status !== 401) { clearTimeout(t); return initial; }
    const authHeader = initial.headers.get('www-authenticate') || '';
    if (!authHeader.toLowerCase().startsWith('digest')) { clearTimeout(t); return initial; }
    const chal = parseDigestHeader(authHeader.slice(7));
    const realm = chal.realm || '';
    const nonce = chal.nonce || '';
    const qop = chal.qop;
    const uri = new URL(url).pathname + new URL(url).search;
    const ha1 = md5(username + ':' + realm + ':' + password);
    const ha2 = md5(method + ':' + uri);
    let responseVal;
    let authStr = 'Digest username="' + username + '", realm="' + realm + '", nonce="' + nonce + '", uri="' + uri + '"';
    if (qop) {
      const nc = '00000001';
      const cnonce = Math.random().toString(36).slice(2, 10);
      responseVal = md5(ha1 + ':' + nonce + ':' + nc + ':' + cnonce + ':' + qop + ':' + ha2);
      authStr += ', qop=' + qop + ', nc=' + nc + ', cnonce="' + cnonce + '", response="' + responseVal + '"';
    } else {
      responseVal = md5(ha1 + ':' + nonce + ':' + ha2);
      authStr += ', response="' + responseVal + '"';
    }
    if (chal.opaque) authStr += ', opaque="' + chal.opaque + '"';
    const finalHeaders = { ...headers, Authorization: authStr };
    const authed = await fetch(url, { method, headers: finalHeaders, body, signal: controller.signal });
    clearTimeout(t);
    return authed;
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

// --- Time helpers ---

function parseEventTime(isoOrLocal) {
  if (!isoOrLocal) return new Date();
  const raw = String(isoOrLocal).trim();
  if (!raw) return new Date();
  if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const normalized = raw.replace(/\//g, '-').replace(' ', 'T');
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (isoMatch) {
    const [, y, mo, d, h, mi, s, ms] = isoMatch;
    const parsed = new Date(y + '-' + mo + '-' + d + 'T' + h + ':' + mi + ':' + s + (ms ? '.' + ms : '') + '+05:30');
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const dmyMatch = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (dmyMatch) {
    const [, d, mo, y, h, mi, s] = dmyMatch;
    const parsed = new Date(y + '-' + mo + '-' + d + 'T' + h + ':' + mi + ':' + s + '+05:30');
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

function istDayBounds(isoDate) {
  const parts = isoDate.split('-').map(Number);
  const y = parts[0], m = parts[1], d = parts[2];
  const start = new Date(Date.UTC(y, m - 1, d));
  const end   = new Date(Date.UTC(y, m - 1, d + 1));
  return { start, end };
}

function getIstNowXml() {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => (parts.find((p) => p.type === t) || {}).value || '00';
  let hour = get('hour');
  if (hour === '24') hour = '00';
  return {
    localTime: get('year') + '-' + get('month') + '-' + get('day') + 'T' + hour + ':' + get('minute') + ':' + get('second') + '+05:30',
    timeZone: 'CST-5:30:00',
  };
}

// --- Device clock sync ---

async function syncDeviceClock(dev, password) {
  try {
    const base = 'http://' + dev.host + ':' + dev.port;
    const t0 = Date.now();
    const res = await digestFetch(base + '/ISAPI/System/time', { method: 'GET', username: dev.username, password, timeoutMs: 5000 });
    if (!res.ok) return 0;
    const xml = await res.text();
    const m = xml.match(/<localTime>([^<]+)<\/localTime>/);
    if (!m) return 0;
    const devNow = new Date(m[1]);
    if (Number.isNaN(devNow.getTime())) return 0;
    const rttHalf = (Date.now() - t0) / 2;
    const driftMs = devNow.getTime() - t0 - rttHalf;
    if (Math.abs(driftMs) <= 60000) return driftMs;
    const modeMatch = xml.match(/<timeMode>([^<]+)<\/timeMode>/);
    const { localTime, timeZone } = getIstNowXml();
    const body = '<?xml version="1.0" encoding="UTF-8"?>\n<Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">\n<timeMode>' + (modeMatch ? modeMatch[1] : 'manual') + '</timeMode>\n<localTime>' + localTime + '</localTime>\n<timeZone>' + timeZone + '</timeZone>\n</Time>';
    const putRes = await digestFetch(base + '/ISAPI/System/time', { method: 'PUT', username: dev.username, password, headers: { 'Content-Type': 'application/xml' }, body, timeoutMs: 5000 });
    const outcome = putRes.ok ? 're-synced to IST' : 'sync failed (HTTP ' + putRes.status + ')';
    console.warn('  WARNING ' + dev.host + ' clock drifted by ' + Math.round(driftMs / 1000) + 's -- ' + outcome);
    return driftMs;
  } catch (err) {
    console.warn('  WARNING Could not read clock on ' + dev.host + ': ' + (err.message || err));
    return 0;
  }
}

// --- Attendance event filter ---

function isAttendanceEvent(e) {
  const maj = Number(e.major);
  const min = Number(e.minor);
  const employeeNo = String(e.employeeNoString != null ? e.employeeNoString : (e.name != null ? e.name : (e.cardNo != null ? e.cardNo : ''))).trim();
  if (!employeeNo || employeeNo === 'undefined' || employeeNo === 'null' || employeeNo === '0') return false;
  if (maj === 5 && [1, 2, 4, 8, 9, 10, 11, 12, 13, 38, 39, 40, 75, 77, 78].includes(min)) return true;
  return false;
}

// --- Paginated event fetch ---

async function fetchAllEventsForDate(dev, password, isoDate) {
  let position = 0;
  const pageSize = 30;
  const allEvents = [];
  const searchID = 'backfill-' + dev.id + '-' + isoDate + '-' + Date.now();

  while (true) {
    const payload = JSON.stringify({
      AcsEventCond: {
        searchID, searchResultPosition: position, maxResults: pageSize,
        major: 0, minor: 0,
        startTime: isoDate + 'T00:00:00+05:30',
        endTime:   isoDate + 'T23:59:59+05:30',
      },
    });
    const res = await digestFetch('http://' + dev.host + ':' + dev.port + '/ISAPI/AccessControl/AcsEvent?format=json', {
      method: 'POST', username: dev.username, password,
      headers: { 'Content-Type': 'application/json' }, body: payload,
    });
    if (!res.ok) { console.error('  ERROR HTTP ' + res.status + ' from ' + dev.host + ' for ' + isoDate); break; }
    const data = await res.json();
    const infoList = (data && data.AcsEvent && data.AcsEvent.InfoList) ? data.AcsEvent.InfoList : [];
    if (infoList.length === 0) break;
    allEvents.push(...infoList);
    position += infoList.length;
    const totalMatches = Number((data && data.AcsEvent && data.AcsEvent.totalMatches) ? data.AcsEvent.totalMatches : 0) || 0;
    if (totalMatches && position >= totalMatches) break;
  }
  return allEvents;
}

// --- Cloud push with retry ---

async function pushToCloud(url, secret, payload, retries) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url + '/api/hikvision/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-biometric-secret': secret },
        body: JSON.stringify(payload),
      });
      if (res.ok) return { ok: true, status: res.status };
      if (attempt === retries) return { ok: false, status: res.status, text: await res.text() };
    } catch (err) {
      if (attempt === retries) return { ok: false, error: err.message };
    }
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }
}

// --- Main ---

async function main() {
  const targetDates = process.argv.slice(2).length ? process.argv.slice(2) : ['2026-10-14', '2026-10-15'];
  const RENDER_URL = (process.env.RENDER_URL || 'https://darse-burhani.onrender.com').replace(/\/+$/, '');
  const BIOMETRIC_SECRET = process.env.BIOMETRIC_SECRET || 'DARSEBURHANI5253';

  console.log('='.repeat(70));
  console.log('  BACKFILL ATTENDANCE -- dates: ' + targetDates.join(', '));
  console.log('  Cloud endpoint: ' + RENDER_URL + '/api/hikvision/events');
  console.log('='.repeat(70));

  const devices = await prisma.biometricDevice.findMany();
  if (!devices.length) { console.error('ERROR No biometric devices found in the database.'); process.exit(1); }
  console.log('Found ' + devices.length + ' device(s): ' + devices.map((d) => d.name + ' (' + d.host + ')').join(', ') + '\n');

  const grand = { totalRaw: 0, totalAtt: 0, pushed: 0, failed: 0, skipped: 0 };

  for (const isoDate of targetDates) {
    const { start: dayStart, end: dayEnd } = istDayBounds(isoDate);
    console.log('\n' + '-'.repeat(70));
    console.log('Processing ' + isoDate + ' | IST window: ' + dayStart.toISOString() + ' to ' + dayEnd.toISOString());
    console.log('-'.repeat(70));

    const dayScans = [];

    for (const dev of devices) {
      try {
        const password = decryptPassword(dev.passwordEnc, dev.passwordIv);
        const driftMs = await syncDeviceClock(dev, password);
        const clockSkewed = Math.abs(driftMs) > 60000;
        if (driftMs !== 0) {
          console.log('  CLOCK ' + dev.host + ' drift: ' + Math.round(driftMs / 1000) + 's' + (clockSkewed ? ' (correcting timestamps)' : ''));
        }
        console.log('\n  Fetching from ' + dev.name + ' (' + dev.host + ') for ' + isoDate + '...');
        const rawEvents = await fetchAllEventsForDate(dev, password, isoDate);
        grand.totalRaw += rawEvents.length;
        const attEvents = rawEvents.filter(isAttendanceEvent);
        grand.totalAtt += attEvents.length;
        console.log('     Raw events: ' + rawEvents.length + '  |  Attendance scans: ' + attEvents.length);

        for (const ev of attEvents) {
          const empNo = String(ev.employeeNoString != null ? ev.employeeNoString : (ev.name != null ? ev.name : (ev.cardNo != null ? ev.cardNo : ''))).trim();
          let scanDate = parseEventTime(ev.time);
          if (clockSkewed) scanDate = new Date(scanDate.getTime() - driftMs);
          if (scanDate < dayStart || scanDate >= dayEnd) { grand.skipped++; continue; }
          dayScans.push({ empNo, scanDate, deviceId: 'hikvision:' + dev.host, verifyMode: ev.currentVerifyMode || 'FACIAL' });
        }
      } catch (err) {
        console.warn('  WARNING Could not fetch from ' + dev.name + ' (' + dev.host + '): ' + (err.message || err));
      }
    }

    dayScans.sort((a, b) => a.scanDate - b.scanDate);
    console.log('\n  Total scans for ' + isoDate + ': ' + dayScans.length + ' (after IST day-boundary filter)');
    if (!dayScans.length) { console.log('     (no scans to push)'); continue; }

    console.log('  Pushing ' + dayScans.length + ' scans to cloud...');
    const BATCH = 10;
    let dayPushed = 0, dayFailed = 0;
    for (let i = 0; i < dayScans.length; i += BATCH) {
      const batch = dayScans.slice(i, i + BATCH);
      await Promise.all(batch.map(async (scan) => {
        const result = await pushToCloud(RENDER_URL, BIOMETRIC_SECRET, {
          fingerprint: scan.empNo,
          timestamp: scan.scanDate.toISOString(),
          deviceId: scan.deviceId,
          verifyMode: scan.verifyMode,
        }, 3);
        if (result && result.ok) { dayPushed++; grand.pushed++; }
        else {
          dayFailed++; grand.failed++;
          if (result && (result.status || result.error)) {
            console.warn('     WARN push failed ' + scan.empNo + ' @ ' + scan.scanDate.toISOString() + ': HTTP ' + (result.status || '') + ' ' + (result.error || '') + (result.text ? ' ' + result.text.slice(0, 80) : ''));
          }
        }
      }));
      const progress = Math.min(i + BATCH, dayScans.length);
      process.stdout.write('     Progress: ' + progress + '/' + dayScans.length + ' (OK:' + dayPushed + ' FAIL:' + dayFailed + ')\r');
    }
    console.log('\n  DONE ' + isoDate + ': pushed ' + dayPushed + ', failed ' + dayFailed);
  }

  console.log('\n' + '='.repeat(70));
  console.log('  BACKFILL COMPLETE');
  console.log('  Raw ISAPI events pulled   : ' + grand.totalRaw);
  console.log('  Attendance scans found    : ' + grand.totalAtt);
  console.log('  Skipped (outside IST day) : ' + grand.skipped);
  console.log('  Pushed to cloud OK        : ' + grand.pushed);
  console.log('  Failed cloud pushes       : ' + grand.failed);
  console.log('='.repeat(70));

  await prisma.$disconnect();
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
