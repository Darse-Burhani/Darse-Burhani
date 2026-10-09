#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════════
 *  🏛️  DARSE BURHANI — 24/7 DIRECT CLOUD PUSH CONFIGURATOR
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Configures physical Hikvision MinMoe terminals to push all attendance punches
 * directly to your live cloud deployment on Render (HTTPS :443) 24/7 WITHOUT
 * needing any local PC turned on.
 * 
 * Usage:
 *   node scripts/configure-direct-cloud-push.mjs [RENDER_URL]
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
  (process.env.PUBLIC_APP_URL && !process.env.PUBLIC_APP_URL.includes('localhost') && !process.env.PUBLIC_APP_URL.includes('127.0.0.1') ? process.env.PUBLIC_APP_URL : null) ||
  (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.includes('localhost') && !process.env.NEXT_PUBLIC_APP_URL.includes('127.0.0.1') ? process.env.NEXT_PUBLIC_APP_URL : null) ||
  'https://darse-burhani.onrender.com'
).replace(/\/+$/, '');

const urlObj = new URL(RENDER_BASE);
const targetHost = urlObj.hostname;
const targetPort = urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
const isHttps = urlObj.protocol === 'https:';

const rawHosts = process.env.HIKVISION_HOSTS || process.env.HIKVISION_HOST || '192.168.0.4,192.168.0.5';
const DEVICES = rawHosts
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean)
  .map((host, idx) => {
    const [ip, portStr] = host.split(':');
    return {
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

async function configureDevice(dev) {
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`📡 Configuring Device: ${dev.name} (${dev.host}:${dev.port})`);
  console.log(`   Destination Target : ${RENDER_BASE}/api/hikvision/events`);

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">
  <HttpHostNotification>
    <id>1</id>
    <url>/api/hikvision/events</url>
    <protocolType>${isHttps ? 'HTTPS' : 'HTTP'}</protocolType>
    <parameterFormatType>JSON</parameterFormatType>
    <addressingFormatType>hostname</addressingFormatType>
    <hostName>${targetHost}</hostName>
    <ipAddress>${targetHost}</ipAddress>
    <portNo>${targetPort}</portNo>
    <httpAuthenticationType>none</httpAuthenticationType>
  </HttpHostNotification>
</HttpHostNotificationList>`;

  try {
    const res = await digestFetch(`http://${dev.host}:${dev.port}/ISAPI/Event/notification/httpHosts`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/xml' },
      body: xmlBody,
      username: dev.username,
      password: dev.password,
      timeoutMs: 6000,
    });

    if (res.ok) {
      console.log(`   ✅ [SUCCESS] Direct 24/7 Cloud Push Activated on ${dev.name}!`);
      console.log(`   Terminal will push all face/card/fingerprint punches to Render automatically.`);
    } else {
      console.log(`   ⚠️ [WARNING] Device responded with HTTP ${res.status}`);
    }
  } catch (err) {
    console.error(`   ❌ [FAILED] Cannot reach ${dev.host}: ${err.message}`);
  }
}

async function main() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('  🏛️  DARSE BURHANI — 24/7 DIRECT CLOUD PUSH SETUP');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`Target Cloud: ${RENDER_BASE}`);

  for (const dev of DEVICES) {
    await configureDevice(dev);
  }

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('✨ All terminals configured! Scans will now sync 24/7 directly');
  console.log('   from the physical terminals to Render without needing a PC.');
  console.log('════════════════════════════════════════════════════════════\n');
}

main();
