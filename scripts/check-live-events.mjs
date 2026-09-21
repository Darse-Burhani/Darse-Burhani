import { createHash, createDecipheriv } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ALGO = 'aes-256-gcm';

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

function parseDigestHeader(header) {
  const params = {};
  const re = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
  let match;
  while ((match = re.exec(header)) !== null) {
    params[match[1]] = match[2] || match[3];
  }
  return params;
}

function md5(str) {
  return createHash('md5').update(str).digest('hex');
}

async function digestFetch(url, { method = 'GET', username, password, body, headers = {}, timeoutMs = 8000 }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
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
}

function xmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`));
  return m?.[1]?.trim() ?? '';
}

async function checkDevice(dev) {
  console.log(`\n======================================================`);
  console.log(`Checking ${dev.name} (${dev.host}:${dev.port})`);
  const password = decryptPassword(dev.passwordEnc, dev.passwordIv);

  // 1. Device Info
  const infoRes = await digestFetch(`http://${dev.host}:${dev.port}/ISAPI/System/deviceInfo`, {
    username: dev.username,
    password,
  });
  if (!infoRes.ok) {
    console.error(`  ❌ Failed deviceInfo: HTTP ${infoRes.status}`);
    return;
  }
  const infoXml = await infoRes.text();
  console.log(`  📡 Model: ${xmlTag(infoXml, 'model')} | Firmware: ${xmlTag(infoXml, 'firmwareVersion')}`);

  // 2. Device Time
  const timeRes = await digestFetch(`http://${dev.host}:${dev.port}/ISAPI/System/time`, {
    username: dev.username,
    password,
  });
  if (timeRes.ok) {
    const timeXml = await timeRes.text();
    console.log(`  🕒 Device Time: ${xmlTag(timeXml, 'localTime')} | TimeZone: ${xmlTag(timeXml, 'timeZone')}`);
  }

  // 3. Search ACS events without strict time filtering (all recent events)
  const acsPayload = JSON.stringify({
    AcsEventCond: {
      searchID: "check-" + Date.now(),
      searchResultPosition: 0,
      maxResults: 50,
      major: 0,
      minor: 0,
    }
  });

  const acsRes = await digestFetch(`http://${dev.host}:${dev.port}/ISAPI/AccessControl/AcsEvent?format=json`, {
    method: 'POST',
    username: dev.username,
    password,
    headers: { 'Content-Type': 'application/json' },
    body: acsPayload,
  });

  if (!acsRes.ok) {
    console.error(`  ❌ Failed AcsEvent search: HTTP ${acsRes.status}`);
    return;
  }

  const acsData = await acsRes.json();
  const infoList = acsData?.AcsEvent?.InfoList || [];
  console.log(`  📊 Total events returned: ${infoList.length} (Total matches on device: ${acsData?.AcsEvent?.totalMatches})`);

  if (infoList.length > 0) {
    console.log(`  📋 Last 10 events:`);
    for (const ev of infoList.slice(-10)) {
      console.log(`     Time: ${ev.time} | EmpNo: "${ev.employeeNoString}" | Card: "${ev.cardNo}" | Name: "${ev.name}" | Major: ${ev.major} | Minor: ${ev.minor} | Mode: ${ev.currentVerifyMode} | Serial: ${ev.serialNo}`);
    }
  }
}

async function main() {
  console.log(`Server system time (Local/UTC): ${new Date().toISOString()}`);
  console.log(`Server system time (IST): ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);

  // Active scan windows
  const windows = await prisma.biometricScanWindow.findMany();
  console.log(`\n📅 Configured Scan Windows (${windows.length}):`);
  for (const w of windows) {
    console.log(`   - "${w.name}" [${w.startTime} - ${w.endTime}] (Grace: ${w.graceMinutes}m, LateEnd: ${w.lateEndTime || 'none'}, Enabled: ${w.enabled}, Audience: ${w.audience})`);
  }

  const devices = await prisma.biometricDevice.findMany();
  for (const d of devices) {
    await checkDevice(d);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('Error:', e); process.exit(1); });
