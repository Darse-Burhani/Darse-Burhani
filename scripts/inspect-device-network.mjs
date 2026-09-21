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

async function inspectNetwork(dev) {
  console.log(`\n======================================================`);
  console.log(`📡 Inspecting Network for ${dev.name} (${dev.host})`);
  const password = decryptPassword(dev.passwordEnc, dev.passwordIv);

  // 1. Interfaces (IP, Subnet Mask, Gateway)
  const ifRes = await digestFetch(`http://${dev.host}:${dev.port}/ISAPI/System/Network/interfaces`, {
    username: dev.username,
    password,
  });
  if (ifRes.ok) {
    const xml = await ifRes.text();
    console.log(`  IPv4 Address:  ${xmlTag(xml, 'ipAddress')}`);
    console.log(`  Subnet Mask:   ${xmlTag(xml, 'subnetMask')}`);
    console.log(`  Default Gateway: ${xmlTag(xml, 'DefaultGateway') || xmlTag(xml, 'defaultGateway') || xmlTag(xml, 'gateway') || 'NOT SET / EMPTY'}`);
    console.log(`  Full XML snippet:\n`, xml.slice(0, 500));
  } else {
    console.error(`  Failed to get interfaces: HTTP ${ifRes.status}`);
  }

  // 2. DNS
  const dnsRes = await digestFetch(`http://${dev.host}:${dev.port}/ISAPI/System/Network/dns`, {
    username: dev.username,
    password,
  });
  if (dnsRes.ok) {
    const xml = await dnsRes.text();
    console.log(`\n  Primary DNS:   ${xmlTag(xml, 'primaryDns') || xmlTag(xml, 'ipAddress') || 'NOT SET'}`);
    console.log(`  Secondary DNS: ${xmlTag(xml, 'secondaryDns') || 'NOT SET'}`);
    console.log(`  DNS XML snippet:\n`, xml);
  } else {
    console.error(`  Failed to get DNS: HTTP ${dnsRes.status}`);
  }
}

async function main() {
  const devices = await prisma.biometricDevice.findMany();
  for (const dev of devices) {
    await inspectNetwork(dev);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('Error:', e); process.exit(1); });
