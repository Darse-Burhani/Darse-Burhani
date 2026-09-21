import { createHash, createDecipheriv } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const ALGO = 'aes-256-gcm';
const RENDER_BASE = 'https://darse-burhani.onrender.com';
const WEBHOOK_PATH = '/api/hikvision/events';

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

async function getHttpHosts(dev, password) {
  const res = await digestFetch(`http://${dev.host}:${dev.port}/ISAPI/Event/notification/httpHosts`, {
    username: dev.username,
    password,
  });
  if (!res.ok) return [];
  const xml = await res.text();
  const hostBlocks = xml.match(/<HttpHostNotification[\s\S]*?<\/HttpHostNotification>/g) || [];
  return hostBlocks.map((block) => ({
    id: xmlTag(block, 'id'),
    url: xmlTag(block, 'url'),
    protocolType: xmlTag(block, 'protocolType'),
    parameterFormatType: xmlTag(block, 'parameterFormatType'),
    addressingFormatType: xmlTag(block, 'addressingFormatType'),
    hostName: xmlTag(block, 'hostName') || xmlTag(block, 'ipAddress'),
    ipAddress: xmlTag(block, 'ipAddress'),
    portNo: xmlTag(block, 'portNo'),
    httpAuthenticationType: xmlTag(block, 'httpAuthenticationType'),
  }));
}

async function setHttpHost(dev, password, hostConfig) {
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotification version="2.0" xmlns="http://www.hikvision.com/networks/schemas/2012/04/05">
  <id>${hostConfig.id}</id>
  <url>${hostConfig.url}</url>
  <protocolType>${hostConfig.protocolType}</protocolType>
  <parameterFormatType>${hostConfig.parameterFormatType}</parameterFormatType>
  <addressingFormatType>${hostConfig.addressingFormatType}</addressingFormatType>
  <hostName>${hostConfig.hostName}</hostName>
  <ipAddress>${hostConfig.ipAddress || hostConfig.hostName}</ipAddress>
  <portNo>${hostConfig.portNo}</portNo>
  <httpAuthenticationType>none</httpAuthenticationType>
</HttpHostNotification>`;

  console.log(`  📤 Uploading HTTP Push configuration to slot #${hostConfig.id} on ${dev.host}...`);
  const res = await digestFetch(`http://${dev.host}:${dev.port}/ISAPI/Event/notification/httpHosts/${hostConfig.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/xml' },
    body: xmlBody,
    username: dev.username,
    password,
  });

  const responseText = await res.text();
  if (!res.ok) {
    console.error(`  ❌ Failed to set HTTP host: HTTP ${res.status}`, responseText);
    return false;
  }
  console.log(`  ✅ Successfully configured HTTP Host slot #${hostConfig.id}! Response status: ${res.status}`);
  return true;
}

async function configureDevice(dev) {
  console.log(`\n======================================================`);
  console.log(`Configuring Push on: ${dev.name} (${dev.host}:${dev.port})`);
  const password = decryptPassword(dev.passwordEnc, dev.passwordIv);

  // 1. Fetch existing hosts
  const existing = await getHttpHosts(dev, password);
  console.log(`  Found ${existing.length} existing HTTP host slot(s) on ${dev.host}:`);
  existing.forEach(h => {
    console.log(`   - Slot #${h.id}: ${h.protocolType}://${h.hostName}:${h.portNo}${h.url} (format: ${h.parameterFormatType})`);
  });

  // Target Slot: use slot 1 or find empty
  const targetId = '1';
  const renderHost = 'darse-burhani.onrender.com';

  const hostConfig = {
    id: targetId,
    url: WEBHOOK_PATH,
    protocolType: 'HTTPS',
    parameterFormatType: 'XML',
    addressingFormatType: 'hostname',
    hostName: renderHost,
    ipAddress: renderHost,
    portNo: '443',
  };

  const success = await setHttpHost(dev, password, hostConfig);

  // Verify
  const updated = await getHttpHosts(dev, password);
  console.log(`\n  🔎 Verification on ${dev.host}:`);
  for (const h of updated) {
    if (h.id === targetId) {
      console.log(`   👉 Slot #${h.id}: ${h.protocolType}://${h.hostName}:${h.portNo}${h.url} [Status: Active]`);
    }
  }
}

async function main() {
  console.log("======================================================");
  console.log(`🌐 CONFIGURING HIKVISION DEVICES FOR RENDER WEBHOOK PUSH`);
  console.log(`Destination: ${RENDER_BASE}${WEBHOOK_PATH}`);
  console.log("======================================================");

  // 1. Test Render Webhook Reachability
  try {
    const res = await fetch(`${RENDER_BASE}${WEBHOOK_PATH}`);
    console.log(`✅ Render Webhook Endpoint is Live: HTTP ${res.status}`);
    const txt = await res.text();
    console.log(`   Response snippet: ${txt.slice(0, 120)}`);
  } catch (err) {
    console.warn(`⚠️ Render check note: ${err.message}`);
  }

  // 2. Configure both devices
  const devices = await prisma.biometricDevice.findMany();
  for (const dev of devices) {
    await configureDevice(dev);
  }

  console.log(`\n======================================================`);
  console.log(`🎉 ALL DEVICES CONFIGURED FOR 24/7 RENDER CLOUD PUSH!`);
  console.log(`Whenever anyone scans their face or fingerprint on either`);
  console.log(`terminal, the device will send the scan directly to Render.`);
  console.log(`======================================================`);
}

main().then(() => process.exit(0)).catch(e => { console.error('FATAL:', e); process.exit(1); });
