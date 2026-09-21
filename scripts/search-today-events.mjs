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

async function searchTodayEvents(dev) {
  console.log(`\n======================================================`);
  console.log(`Searching TODAY (2026-09-21) on ${dev.name} (${dev.host})`);
  const password = decryptPassword(dev.passwordEnc, dev.passwordIv);

  // Filter for today
  const acsPayload = JSON.stringify({
    AcsEventCond: {
      searchID: "today-" + Date.now(),
      searchResultPosition: 0,
      maxResults: 100,
      major: 0,
      minor: 0,
      startTime: "2026-09-21T00:00:00+05:30",
      endTime: "2026-09-21T23:59:59+05:30",
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
  console.log(`  📊 Events matching TODAY on ${dev.host}: ${infoList.length} (totalMatches: ${acsData?.AcsEvent?.totalMatches})`);

  for (const ev of infoList) {
    console.log(`     👉 Time: ${ev.time} | EmpNo: "${ev.employeeNoString}" | Card: "${ev.cardNo}" | Name: "${ev.name}" | Major: ${ev.major} | Minor: ${ev.minor} | Mode: ${ev.currentVerifyMode} | Serial: ${ev.serialNo}`);
  }
}

async function main() {
  const devices = await prisma.biometricDevice.findMany();
  for (const d of devices) {
    await searchTodayEvents(d);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('Error:', e); process.exit(1); });
