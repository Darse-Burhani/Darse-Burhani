#!/usr/bin/env node
/**
 * Darse Burhani — Hikvision Local-to-Cloud Bridge Daemon
 * 
 * Bridges local physical Hikvision MinMoe terminals (on school LAN: 192.168.x.x)
 * directly to your live cloud deployment on Render or custom domain.
 * 
 * Usage:
 *   node scripts/hikvision-cloud-bridge.mjs [RENDER_URL]
 *   npm run hikvision:cloud-bridge
 *   or double-click scripts/start-hikvision-cloud-bridge.bat
 */

import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

const RENDER_BASE = (
  process.argv[2] ||
  process.env.RENDER_URL ||
  process.env.RENDER_APP_URL ||
  process.env.PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://darse-burhani.onrender.com'
).replace(/\/+$/, '');

const WEBHOOK_URL = `${RENDER_BASE}/api/hikvision/events`;
const SECRET = process.env.BIOMETRIC_SECRET || 'DARSEBURHANI5253';

// Device List: can be configured via environment or fallback defaults
const DEVICES = (process.env.HIKVISION_HOSTS || process.env.HIKVISION_HOST || '192.168.0.4,192.168.0.5')
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)
  .map((host) => {
    const [ip, portStr] = host.split(':');
    return {
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

async function digestFetch(url, { method = 'GET', username, password, body, headers = {}, timeoutMs = 7000 }) {
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

// Push an event payload to Render
async function forwardEventToRender(eventData) {
  try {
    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-biometric-secret': SECRET,
      },
      body: JSON.stringify(eventData),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: json };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Track seen serials to prevent duplicates
const seenEvents = new Set();
function isDuplicate(key) {
  if (seenEvents.has(key)) return true;
  seenEvents.add(key);
  if (seenEvents.size > 5000) {
    const oldest = seenEvents.values().next().value;
    seenEvents.delete(oldest);
  }
  return false;
}

// Poll historical/recent events from device
async function pollDeviceEvents(dev) {
  const now = new Date();
  const startTime = new Date(now.getTime() - 2 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const endTime = now.toISOString().replace(/\.\d{3}Z$/, 'Z');

  const payload = JSON.stringify({
    AcsEventCond: {
      searchID: `bridge-${Date.now()}`,
      searchResultPosition: 0,
      maxResults: 30,
      major: 5,
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
    });

    if (!res.ok) return;
    const data = await res.json();
    const matches = data?.AcsEvent?.InfoList || [];

    for (const item of matches) {
      const serial = item.serialNo || item.serial || `${item.employeeNoString}-${item.time}`;
      const dedupeKey = `${dev.host}:${serial}`;
      if (isDuplicate(dedupeKey)) continue;

      const employeeNo = item.employeeNoString || item.cardNo;
      if (!employeeNo) continue;

      const verifyMode = item.currentVerifyMode || (item.minor === 75 ? 'FACIAL' : 'FINGERPRINT');
      const timeStr = item.time || new Date().toISOString();

      console.log(`\n⚡ [SCAN DETECTED] ${dev.host} -> Member ID: ${employeeNo} at ${timeStr} (${verifyMode})`);
      console.log(`   Forwarding to Render: ${WEBHOOK_URL}...`);

      const result = await forwardEventToRender({
        AccessControllerEvent: {
          employeeNoString: String(employeeNo),
          name: item.name || '',
          cardNo: item.cardNo || '',
          time: timeStr,
          currentVerifyMode: verifyMode,
          serialNo: serial,
          deviceId: dev.host,
        },
      });

      if (result.ok) {
        console.log(`   ✅ [SYNCED TO CLOUD] Attendance successfully recorded on Render!`);
      } else {
        console.warn(`   ⚠️ [SYNC FAILED] Status ${result.status || result.error}`);
      }
    }
  } catch (err) {
    // Device may be unreachable momentarily
  }
}

// Real-time multipart stream listener
async function listenAlertStream(dev) {
  const url = `http://${dev.host}:${dev.port}/ISAPI/Event/notification/alertStream`;
  console.log(`📡 Connecting real-time alert stream to ${dev.host}:${dev.port}...`);

  try {
    const res = await digestFetch(url, {
      method: 'GET',
      username: dev.username,
      password: dev.password,
      timeoutMs: 60000,
    });

    if (!res.ok || !res.body) {
      console.warn(`⚠️ AlertStream on ${dev.host} returned HTTP ${res.status}. Fallback to rapid polling.`);
      return;
    }

    console.log(`✅ [STREAM CONNECTED] Real-time punch listener active for ${dev.host}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Look for JSON or XML blocks
      const jsonMatch = buffer.match(/\{[\s\S]*?"AccessControllerEvent"[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          const ev = parsed.AccessControllerEvent || parsed;
          const employeeNo = ev.employeeNoString || ev.cardNo;
          if (employeeNo) {
            const serial = ev.serialNo || `${employeeNo}-${ev.time}`;
            if (!isDuplicate(`${dev.host}:${serial}`)) {
              console.log(`\n⚡ [STREAM PUNCH] ${dev.host} -> Member ID: ${employeeNo} at ${ev.time || 'now'}`);
              forwardEventToRender(parsed).then((r) => {
                if (r.ok) console.log(`   ✅ [SYNCED TO CLOUD] Punch recorded instantly!`);
              });
            }
          }
        } catch {}
        buffer = buffer.slice(jsonMatch.index + jsonMatch[0].length);
      }
    }
  } catch (err) {
    console.warn(`🔌 Alert stream disconnected from ${dev.host} (${err.message}). Retrying in 5s...`);
  }
}

async function startBridge() {
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  🏛️  DARSE BURHANI — HIKVISION CLOUD ATTENDANCE BRIDGE');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`🎯 Target Cloud URL : ${RENDER_BASE}`);
  console.log(`🌐 Webhook Endpoint : ${WEBHOOK_URL}`);
  console.log(`🖥️  Monitored Devices: ${DEVICES.map((d) => `${d.host}:${d.port}`).join(', ')}`);
  console.log('────────────────────────────────────────────────────────────────────');

  // Verify Render connection
  try {
    const probe = await fetch(`${RENDER_BASE}/api/hikvision/events`);
    if (probe.ok) {
      console.log('✅ Cloud Webhook Gateway is ONLINE & REACHABLE on Render.');
    } else {
      console.log(`⚠️ Cloud Webhook returned HTTP ${probe.status} (will continue attempting sync).`);
    }
  } catch (e) {
    console.warn(`⚠️ Cannot probe Render right now (${e.message}). Proceeding with bridge.`);
  }

  // Start AlertStream listeners
  for (const dev of DEVICES) {
    (async () => {
      while (true) {
        await listenAlertStream(dev);
        await new Promise((r) => setTimeout(r, 5000));
      }
    })();
  }

  // Start rapid fallback polling (every 3 seconds)
  setInterval(() => {
    for (const dev of DEVICES) {
      pollDeviceEvents(dev).catch(() => {});
    }
  }, 3000);

  console.log('🚀 Bridge is LIVE! Keep this window open on the school computer.');
  console.log('   All scans on MinMoe terminals will sync to Render automatically.');
}

startBridge();
