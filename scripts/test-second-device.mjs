import { createHash, createDecipheriv } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ALGO = 'aes-256-gcm';

function encKey() {
  const secret = process.env.NEXTAUTH_SECRET ?? 'dev-biometric-secret';
  return createHash('sha256').update(secret).digest();
}

function decryptPassword(enc, iv) {
  const buf = Buffer.from(enc, 'base64');
  const tag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const decipher = createDecipheriv(ALGO, encKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

// Minimal digest fetch
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

async function testSecondDevice() {
  const dev = await prisma.biometricDevice.findFirst({
    where: { host: '192.168.0.5' }
  });
  if (!dev) throw new Error('Device not found');

  const password = decryptPassword(dev.passwordEnc, dev.passwordIv);
  console.log(`Connecting to ${dev.host} as ${dev.username}...`);

  const res = await digestFetch(`http://${dev.host}:${dev.port}/ISAPI/System/deviceInfo`, {
    username: dev.username,
    password
  });

  if (!res.ok) {
    console.error(`ISAPI Authentication failed: HTTP ${res.status}`);
    return;
  }

  const xml = await res.text();
  const deviceName = xmlTag(xml, 'deviceName');
  const model = xmlTag(xml, 'model');
  const serialNumber = xmlTag(xml, 'serialNumber');
  const macAddress = xmlTag(xml, 'macAddress');
  const firmwareVersion = xmlTag(xml, 'firmwareVersion');

  console.log('\n=== DEVICE 2 DETAILS (ONLINE & VERIFIED) ===');
  console.log('Model:', model);
  console.log('Serial Number:', serialNumber);
  console.log('MAC Address:', macAddress);
  console.log('Firmware Version:', firmwareVersion);
  console.log('Device Name:', deviceName);

  await prisma.biometricDevice.update({
    where: { id: dev.id },
    data: {
      name: `${deviceName || 'Secondary Terminal'} (${model})`,
      model,
      serialNo: serialNumber,
      mac: macAddress,
      firmwareVersion,
      status: 'ONLINE',
      lastSeenAt: new Date(),
      lastError: null
    }
  });

  console.log('\nUpdated database record with verified hardware serial and online status!');
}

testSecondDevice().catch(console.error).finally(() => prisma.$disconnect());
