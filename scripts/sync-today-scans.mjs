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

function parseEventTime(isoOrLocal) {
  if (!isoOrLocal) return new Date();
  const raw = String(isoOrLocal).trim();
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/);
  if (m) {
    const [, y, mo, d, h, mi, s] = m;
    const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    return new Date(utcMs - (5 * 60 + 30) * 60 * 1000);
  }
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

function isAttendanceEvent(e) {
  const maj = Number(e.major);
  const min = Number(e.minor);
  const employeeNo = String(e.employeeNoString ?? e.name ?? e.cardNo ?? "").trim();
  if (!employeeNo || employeeNo === "undefined" || employeeNo === "null") return false;

  // Major 5: Access event
  if (maj === 5) {
    // 38 (face pass), 75 (face match), 1 (card pass), 76 (face fail), 39 (fingerprint match)
    if ([1, 2, 4, 8, 9, 10, 11, 12, 13, 38, 39, 40, 75, 77, 78].includes(min)) {
      return true;
    }
  }
  return false;
}

async function fetchAllTodayEvents(dev) {
  const password = decryptPassword(dev.passwordEnc, dev.passwordIv);
  let position = 0;
  const pageSize = 50;
  const allEvents = [];

  while (true) {
    const acsPayload = JSON.stringify({
      AcsEventCond: {
        searchID: "sync-" + dev.id + "-" + Date.now(),
        searchResultPosition: position,
        maxResults: pageSize,
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
      console.error(`  ❌ Failed to fetch events from ${dev.host}: HTTP ${acsRes.status}`);
      break;
    }

    const acsData = await acsRes.json();
    const infoList = acsData?.AcsEvent?.InfoList || [];
    if (infoList.length === 0) break;

    allEvents.push(...infoList);
    position += infoList.length;

    if (infoList.length < pageSize || (acsData?.AcsEvent?.totalMatches && position >= acsData.AcsEvent.totalMatches)) {
      break;
    }
  }

  return allEvents;
}

async function processScan(empNo, scanDate, host, verifyMode) {
  // 1. Check student
  const student = await prisma.studentProfile.findFirst({
    where: {
      OR: [
        { its: empNo },
        { studentId: empNo },
        { biometricHash: empNo },
      ]
    },
    include: { user: true, classEnrollments: { include: { class: true } } }
  });

  const timeStr = scanDate.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });

  if (student) {
    const name = `${student.user.firstName} ${student.user.lastName}`.trim();
    console.log(`  👤 MATCHED TALABAT: ${name} (ITS/ID: ${empNo}) at ${timeStr}`);

    // Create AttendanceRecord
    const todayUTC = new Date(Date.UTC(scanDate.getUTCFullYear(), scanDate.getUTCMonth(), scanDate.getUTCDate()));
    
    // Find class enrollment
    const activeEnrollment = student.classEnrollments.find(e => e.isActive) || student.classEnrollments[0];
    let classId = activeEnrollment?.classId;
    if (!classId) {
      const cls = await prisma.class.findFirst({ where: { grade: student.grade, isActive: true } });
      classId = cls?.id;
    }

    if (classId) {
      const rec = await prisma.attendanceRecord.upsert({
        where: {
          studentId_classId_date: {
            studentId: student.id,
            classId,
            date: todayUTC,
          }
        },
        create: {
          studentId: student.id,
          classId,
          date: todayUTC,
          status: "PRESENT",
          checkInTime: scanDate,
          verificationMethod: "BIOMETRIC",
          biometricMethod: "FACIAL",
          biometricHash: empNo,
          recordedById: student.userId,
        },
        update: {
          checkInTime: scanDate,
        }
      });
      console.log(`     ✅ Attendance record saved: ID=${rec.id}, Status=PRESENT`);
    }

    // Registry
    await prisma.attendanceRegistry.upsert({
      where: { studentId_date: { studentId: student.id, date: todayUTC } },
      create: {
        studentId: student.id,
        date: todayUTC,
        status: "PRESENT",
        source: "BIOMETRIC",
        checkInTime: scanDate,
        recordedById: student.userId,
      },
      update: {
        checkInTime: scanDate,
      }
    });
    return true;
  }

  // 2. Check Teacher
  const teacher = await prisma.teacherProfile.findFirst({
    where: {
      OR: [
        { employeeId: empNo },
        { its: empNo },
        { biometricHash: empNo },
      ]
    },
    include: { user: true }
  });

  if (teacher) {
    const name = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
    console.log(`  👨‍🏫 MATCHED FACULTY: ${name} (EmployeeId: ${empNo}) at ${timeStr}`);
    const todayUTC = new Date(Date.UTC(scanDate.getUTCFullYear(), scanDate.getUTCMonth(), scanDate.getUTCDate()));
    await prisma.teacherAttendanceRecord.upsert({
      where: { teacherId_date: { teacherId: teacher.id, date: todayUTC } },
      create: {
        teacherId: teacher.id,
        date: todayUTC,
        status: "PRESENT",
        checkInTime: scanDate,
        verificationMethod: "BIOMETRIC",
        biometricMethod: "FACIAL",
        biometricHash: empNo,
      },
      update: {
        checkInTime: scanDate,
      }
    });
    return true;
  }

  console.log(`  ⚠️ UNRECOGNIZED ID scanned: "${empNo}" at ${timeStr}`);
  return false;
}

async function main() {
  console.log("====================================================");
  console.log("🔄 SYNCING ALL FACE SCANS FROM BOTH TERMINALS FOR TODAY");
  console.log("====================================================");

  const devices = await prisma.biometricDevice.findMany();
  for (const dev of devices) {
    console.log(`\nFetching scans from ${dev.name} (${dev.host})...`);
    const events = await fetchAllTodayEvents(dev);
    const attendanceEvents = events.filter(isAttendanceEvent);
    console.log(`Found ${events.length} total events, ${attendanceEvents.length} attendance face scans.`);

    let processed = 0;
    for (const ev of attendanceEvents) {
      const empNo = String(ev.employeeNoString ?? ev.name ?? ev.cardNo ?? "").trim();
      const scanDate = parseEventTime(ev.time);
      const ok = await processScan(empNo, scanDate, dev.host, ev.currentVerifyMode);
      if (ok) processed++;
    }
    console.log(`Processed ${processed} valid scans from ${dev.name}.`);
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('FATAL:', e); process.exit(1); });
