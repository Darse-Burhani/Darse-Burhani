import { createHash, createDecipheriv } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
    const decipher = createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64'));
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
  while ((match = re.exec(header)) !== null) params[match[1]] = match[2] || match[3];
  return params;
}

function md5(str) {
  return createHash('md5').update(str).digest('hex');
}

async function digestFetch(url, { method = 'GET', username, password, body, headers = {}, timeoutMs = 5000 }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const initial = await fetch(url, { method, headers, body, signal: controller.signal });
    if (initial.status !== 401) return initial;
    const authHeader = initial.headers.get('www-authenticate') || '';
    if (!authHeader.toLowerCase().startsWith('digest')) return initial;
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
    return await fetch(url, { method, headers: { ...headers, Authorization: authStr }, body, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

async function checkNet(ip) {
  const dev = await prisma.biometricDevice.findFirst({ where: { host: ip } });
  if (!dev) return;
  const password = decryptPassword(dev.passwordEnc, dev.passwordIv);
  console.log(`\n=== Network for ${dev.name} (${ip}) ===`);

  // Interfaces
  const res1 = await digestFetch(`http://${ip}/ISAPI/System/Network/interfaces`, { username: dev.username, password });
  if (res1.ok) {
    const txt = await res1.text();
    console.log(`Interfaces XML:\n`, txt);
  } else {
    console.log(`Interfaces failed: HTTP ${res1.status}`);
  }

  // DNS
  const res2 = await digestFetch(`http://${ip}/ISAPI/System/Network/dns`, { username: dev.username, password });
  if (res2.ok) {
    const txt = await res2.text();
    console.log(`DNS XML:\n`, txt);
  } else {
    console.log(`DNS failed: HTTP ${res2.status}`);
  }
}

async function main() {
  await checkNet('192.168.0.4');
  await checkNet('192.168.0.5');
  await prisma.$disconnect();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
