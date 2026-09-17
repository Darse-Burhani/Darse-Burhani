import 'dotenv/config';
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

async function digestFetch(url, { method = 'GET', username, password, body, headers = {}, timeoutMs = 3000 }) {
  try {
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
    let authStr = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}"`;

    if (qop) {
      const cnonce = 'abc123xyz';
      const nc = '00000001';
      const resp = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
      authStr += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${resp}"`;
    } else {
      const resp = md5(`${ha1}:${nonce}:${ha2}`);
      authStr += `, response="${resp}"`;
    }

    if (chal.opaque) authStr += `, opaque="${chal.opaque}"`;

    const authHeaders = { ...headers, Authorization: authStr };
    const authRes = await fetch(url, { method, headers: authHeaders, body, signal: controller.signal });
    clearTimeout(t);
    return authRes;
  } catch (err) {
    return { ok: false, status: 0, statusText: err.message, error: err };
  }
}

async function main() {
  const d = await prisma.biometricDevice.findFirst({
    where: { host: '192.168.0.4' }
  });

  if (!d) {
    console.log("Device 192.168.0.4 not found in DB");
    return;
  }

  console.log(`\n========================================`);
  console.log(`Testing Device 1: ${d.name} (${d.host}:${d.port})`);
  console.log(`========================================`);

  let plainPassword = '';
  try {
    if (d.passwordEnc && d.passwordIv) {
      plainPassword = decryptPassword(d.passwordEnc, d.passwordIv);
    }
  } catch (err) {
    console.log(`Password decrypt failed:`, err.message);
  }

  if (!plainPassword) {
    plainPassword = 'DARSEBURHANI5253';
  }
  console.log(`Username: ${d.username}, Password: ${plainPassword}`);

  const endpointsToTest = [
    { method: 'GET', path: '/ISAPI/System/deviceInfo' },
    { method: 'GET', path: '/ISAPI/System/status' },
    { method: 'GET', path: '/ISAPI/Streaming/channels/1/picture' },
    { method: 'GET', path: '/ISAPI/Streaming/channels/101/picture' },
    { method: 'GET', path: '/ISAPI/Streaming/channels/1/picture?videoType=jpeg' },
    { method: 'GET', path: '/ISAPI/Streaming/channels/1/picture?snapType=face' },
    { method: 'GET', path: '/ISAPI/Streaming/channels/2/picture' },
    { method: 'GET', path: '/ISAPI/Streaming/channels/201/picture' },
    { method: 'GET', path: '/ISAPI/System/Video/inputs/channels/1/capture' },
    { method: 'GET', path: '/ISAPI/ContentMgmt/Image/channels/1' },
    { method: 'GET', path: '/ISAPI/AccessControl/CaptureFaceData?format=json' },
    { method: 'GET', path: '/ISAPI/AccessControl/CaptureFaceData' },
    { method: 'PUT', path: '/ISAPI/AccessControl/CaptureFaceData?format=json', body: JSON.stringify({ CaptureFaceData: { captureType: "face" } }) },
    { method: 'POST', path: '/ISAPI/AccessControl/CaptureFaceData?format=json', body: JSON.stringify({ CaptureFaceData: { captureType: "face" } }) },
    { method: 'GET', path: '/ISAPI/AccessControl/FaceCapture/Capture' },
    { method: 'GET', path: '/ISAPI/AccessControl/SnapConfig/1' },
    { method: 'GET', path: '/ISAPI/AccessControl/SnapConfig/1?format=json' },
    { method: 'GET', path: '/ISAPI/Streaming/channels' },
    { method: 'GET', path: '/ISAPI/Streaming/channels?format=json' },
  ];

  const base = `http://${d.host}:${d.port}`;

  for (const ep of endpointsToTest) {
    const url = `${base}${ep.path}`;
    try {
      const res = await digestFetch(url, {
        method: ep.method,
        username: d.username,
        password: plainPassword,
        body: ep.body,
        headers: ep.body ? { 'Content-Type': 'application/json' } : {},
      });

      if (res.ok) {
        const ct = res.headers ? res.headers.get('content-type') : 'unknown';
        const ab = await res.arrayBuffer();
        const len = ab.byteLength;
        console.log(`  [OK ${res.status}] ${ep.method} ${ep.path} -> Content-Type: ${ct}, Length: ${len} bytes`);
        if (len < 500) {
          const text = Buffer.from(ab).toString('utf8');
          console.log(`     Response snippet: ${text.slice(0, 150)}`);
        }
      } else {
        console.log(`  [FAIL ${res.status || 'ERR'}] ${ep.method} ${ep.path} -> ${res.statusText || res.error?.message || 'Error'}`);
      }
    } catch (err) {
      console.log(`  [EXCEPTION] ${ep.method} ${ep.path} -> ${err.message}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
