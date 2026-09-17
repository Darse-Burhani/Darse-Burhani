import { PrismaClient } from '@prisma/client';
import { createHash, createDecipheriv } from 'node:crypto';

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

async function deployUserToDevice(host, username, password, user) {
  const base = `http://${host}:80`;
  const now = new Date();
  const validFrom = `${now.getFullYear()}-01-01T00:00:00`;
  const validTo = `${now.getFullYear() + 5}-12-31T23:59:59`;

  const recordPayload = {
    UserInfo: {
      employeeNo: user.employeeNo,
      name: user.name,
      userType: 'normal',
      closeDelayEnabled: false,
      Valid: {
        enable: true,
        beginTime: validFrom,
        endTime: validTo,
        timeType: 'local',
      },
      belongGroup: '1',
      password: '',
      doorRight: '1',
      RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
    },
  };

  let res = await digestFetch(`${base}/ISAPI/AccessControl/UserInfo/Record?format=json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recordPayload),
    username,
    password,
  });

  if (!res.ok) {
    res = await digestFetch(`${base}/ISAPI/AccessControl/UserInfo/SetUp?format=json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recordPayload),
      username,
      password,
    });
  }

  return res.ok;
}

async function main() {
  const host = '192.168.0.5';
  const dev = await prisma.biometricDevice.findFirst({ where: { host } });
  if (!dev) throw new Error('Device not found');
  const password = decryptPassword(dev.passwordEnc, dev.passwordIv);

  console.log(`Checking connection to Device 2 (${host})...`);
  const infoRes = await digestFetch(`http://${host}:80/ISAPI/System/deviceInfo`, {
    username: dev.username,
    password,
  });

  if (!infoRes.ok) {
    const text = await infoRes.text();
    if (text.includes('<lockStatus>lock</lockStatus>')) {
      const lockMatch = text.match(/<unlockTime>(\d+)<\/unlockTime>/);
      const remaining = lockMatch ? Math.round(Number(lockMatch[1]) / 60) : 'some';
      console.log(`\n⚠️  DEVICE IS TEMPORARILY LOCKED (Security cooldown: ~${remaining} minutes remaining).`);
      console.log('💡 TIP: Power-cycle (turn off and on) the device at 192.168.0.5 to clear the lock instantly, then rerun this command.');
      return;
    }
    console.error(`ISAPI returned status ${infoRes.status}`);
    return;
  }

  const xml = await infoRes.text();
  const serialNo = xmlTag(xml, 'serialNumber');
  const model = xmlTag(xml, 'model');
  console.log(`✅ Connected to Device 2: ${model} (Serial: ${serialNo})`);

  await prisma.biometricDevice.update({
    where: { id: dev.id },
    data: {
      serialNo,
      model,
      status: 'ONLINE',
      lastSeenAt: new Date(),
    }
  });

  console.log('\n--- Syncing Students to Device 2 ---');
  const students = await prisma.studentProfile.findMany({
    where: { user: { isActive: true } },
    include: { user: true },
  });

  let stuSuccess = 0;
  for (const s of students) {
    const empNo = s.its || s.studentId || s.biometricHash || s.id;
    const name = `${s.user.firstName} ${s.user.lastName}`.trim() || `Student ${s.studentId}`;
    try {
      const ok = await deployUserToDevice(host, dev.username, password, { employeeNo: empNo, name });
      if (ok) stuSuccess++;
    } catch {}
  }
  console.log(`✅ Synced ${stuSuccess} / ${students.length} students to Device 2.`);

  console.log('\n--- Syncing Teachers to Device 2 ---');
  const teachers = await prisma.teacherProfile.findMany({
    where: { user: { isActive: true } },
    include: { user: true },
  });

  let teaSuccess = 0;
  for (const t of teachers) {
    const empNo = t.employeeId || t.its || t.biometricHash || t.id;
    const name = `${t.user.firstName} ${t.user.lastName}`.trim() || `Teacher ${t.employeeId}`;
    try {
      const ok = await deployUserToDevice(host, dev.username, password, { employeeNo: empNo, name });
      if (ok) teaSuccess++;
    } catch {}
  }
  console.log(`✅ Synced ${teaSuccess} / ${teachers.length} faculty members to Device 2.`);

  console.log('\n✨ COMPLETE: Device 2 is now fully provisioned and scanning enabled!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
