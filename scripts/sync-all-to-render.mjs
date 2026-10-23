import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const RENDER_BASE = (
  process.env.RENDER_URL ||
  process.env.RENDER_APP_URL ||
  'https://darse-burhani.onrender.com'
).replace(/\/+$/, '');

const SECRET = process.env.BIOMETRIC_SECRET || 'DARSEBURHANI5253';
const WEBHOOK_URL = `${RENDER_BASE}/api/hikvision/events?secret=${encodeURIComponent(SECRET)}`;

const DEVICES = [
  { id: 'dev-1', name: 'Main Entrance MinMoe', host: '192.168.0.4', port: 80, username: 'admin', password: 'DARSEBURHANI5253' },
  { id: 'dev-2', name: 'Secondary Terminal 2', host: '192.168.0.5', port: 80, username: 'admin', password: 'DARSEBURHANI5253' },
];

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

async function digestFetch(url, { method = 'GET', username, password, body, headers = {}, timeoutMs = 12000 }) {
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
    const params = parseDigestHeader(authHeader);
    const realm = params.realm || '';
    const nonce = params.nonce || '';
    const qop = params.qop;
    const uri = new URL(url).pathname + new URL(url).search;
    const ha1 = md5(`${username}:${realm}:${password}`);
    const ha2 = md5(`${method}:${uri}`);
    let authVal;
    if (qop) {
      const nc = '00000001';
      const cnonce = md5(String(Math.random()));
      const resp = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
      authVal = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", qop=${qop}, nc=${nc}, cnonce="${cnonce}", response="${resp}"`;
    } else {
      const resp = md5(`${ha1}:${nonce}:${ha2}`);
      authVal = `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${resp}"`;
    }
    clearTimeout(t);
    return fetch(url, {
      method,
      headers: { ...headers, Authorization: authVal },
      body,
    });
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

function normalizeDeviceTime(raw) {
  if (!raw) return new Date().toISOString();
  let s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    return s;
  }
  const match = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.\d+)?([+-]\d{2}:?\d{2}|Z)?$/);
  if (match) {
    const datePart = match[1];
    const timePart = match[2];
    const tzPart = match[3];
    if (tzPart) return `${datePart}T${timePart}${tzPart.includes(':') || tzPart === 'Z' ? tzPart : tzPart.slice(0, 3) + ':' + tzPart.slice(3)}`;
    return `${datePart}T${timePart}+05:30`;
  }
  return s;
}

// Pull all events with complete pagination loop
async function pullAllDeviceEventsForDate(dev, dateStr) {
  const startTime = `${dateStr}T00:00:00+05:30`;
  const endTime = `${dateStr}T23:59:59+05:30`;
  const allEvents = [];
  let position = 0;
  const pageSize = 30; // MinMoe terminal maximum page size
  let hasMore = true;
  let totalMatches = null;

  while (hasMore) {
    const payload = JSON.stringify({
      AcsEventCond: {
        searchID: `sync-${Date.now()}`,
        searchResultPosition: position,
        maxResults: pageSize,
        major: 0,
        minor: 0,
        startTime,
        endTime,
      },
    });

    const url = `http://${dev.host}:${dev.port}/ISAPI/AccessControl/AcsEvent?format=json`;
    try {
      const res = await digestFetch(url, {
        method: 'POST',
        username: dev.username,
        password: dev.password,
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        timeoutMs: 8000,
      });

      if (!res.ok) {
        console.warn(`    ⚠️ [${dev.name}] HTTP ${res.status} at position ${position}`);
        break;
      }

      const data = await res.json();
      const acs = data?.AcsEvent;
      if (!acs) break;

      totalMatches = acs.totalMatches ?? totalMatches;
      const list = acs.InfoList || [];

      if (list.length === 0) {
        hasMore = false;
        break;
      }

function canonicalizeEmployeeNo(rawId, name) {
  const id = String(rawId || '').trim();
  const nameStr = String(name || '').trim();
  const combined = `${id} ${nameStr}`.trim();

  if (id === '2' || nameStr === '2') return '30489490';
  if (id === '30450861' || nameStr === '30450861') return '30150861';
  if (id === '40444603' || nameStr === '40444603') return '40444603';
  if (id === '30489490' || nameStr === '30489490') return '30489490';
  if (id === '30150861' || nameStr === '30150861') return '30150861';

  if (/manpur/i.test(combined) || /mustafa\s*tailor/i.test(combined)) return '40444603';
  if (/shk\s*abbas.*hamid|shaikh\s*abbas.*hamid|m.*murtaza.*sh.*abbas/i.test(combined)) return '30489490';
  if (/chhatariya/i.test(combined)) return '30150861';

  if (/^\d{8}$/.test(nameStr)) return nameStr;
  return id;
}

      for (const item of list) {
        const rawEmp = item.employeeNoString || item.name || item.cardNo;
        if (!rawEmp) continue;
        const empNo = canonicalizeEmployeeNo(rawEmp, item.name);
        const timeStr = normalizeDeviceTime(item.time);
        const serial = item.serialNo || item.serial || `${empNo}-${timeStr}`;
        const verifyMode = item.currentVerifyMode || (item.minor === 75 ? 'FACIAL' : 'FINGERPRINT');
        allEvents.push({
          employeeNo: empNo,
          name: item.name || '',
          cardNo: item.cardNo || '',
          time: timeStr,
          currentVerifyMode: verifyMode,
          serialNo: serial,
          deviceHost: dev.host,
        });
      }

      position += list.length;
      if (totalMatches !== null && position >= totalMatches) {
        hasMore = false;
      } else if (acs.responseStatusStrg && acs.responseStatusStrg !== 'MORE') {
        hasMore = false;
      }
    } catch (err) {
      console.error(`    ❌ [${dev.name}] Fetch error at pos ${position}:`, err.message);
      break;
    }
  }

  return { events: allEvents, totalMatches: totalMatches || allEvents.length };
}

// Push to Render cloud webhook with concurrency
async function pushEventToRender(ev) {
  const payload = {
    AccessControllerEvent: {
      employeeNoString: String(ev.employeeNo),
      name: ev.name || '',
      cardNo: ev.cardNo || '',
      time: ev.time,
      currentVerifyMode: ev.currentVerifyMode || 'FINGERPRINT',
      serialNo: String(ev.serialNo || `${ev.employeeNo}-${ev.time}`),
      deviceId: ev.deviceHost,
    },
  };

  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-biometric-secret': SECRET,
      'x-webhook-secret': SECRET,
    },
    body: JSON.stringify(payload),
  });

  return res.ok;
}

// Direct local DB update as dual-path
async function recordLocalDB(ev) {
  const rawId = String(ev.employeeNo || '').trim();
  if (!rawId) return;

  const canonicalId = canonicalizeEmployeeNo(rawId, ev.name);
  const strippedNum = canonicalId.replace(/^0+/, '');
  const prefixMatch = canonicalId.match(/^(?:STU|ITS|FP|CARD|ID|TALABAT|EMP|TEA|FAC|STAFF|TEACHER|FACULTY)[-_:.]?(.*)$/i);
  const innerNum = prefixMatch && prefixMatch[1] ? prefixMatch[1].trim() : '';
  const innerStripped = innerNum ? innerNum.replace(/^0+/, '') : '';
  const candidateIds = Array.from(new Set([rawId, canonicalId, strippedNum, innerNum, innerStripped])).filter(Boolean);

  const scanDate = new Date(ev.time);
  const istFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = istFormatter.formatToParts(scanDate);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  const year = parseInt(get('year'), 10);
  const month = parseInt(get('month'), 10) - 1;
  const day = parseInt(get('day'), 10);
  const hours = parseInt(get('hour'), 10);
  const minutes = parseInt(get('minute'), 10);
  const scanMinutes = hours * 60 + minutes;
  const calendarDayUTC = new Date(Date.UTC(year, month, day));

  const isLate = scanMinutes > 8 * 60 + 1;
  const initialStatus = isLate ? 'LATE' : 'PRESENT';
  const biometricMethod = String(ev.currentVerifyMode || '').toLowerCase().includes('face') ? 'FACIAL' : 'FINGERPRINT';

  try {
    const student = await prisma.studentProfile.findFirst({
      where: {
        OR: [
          { biometricHash: { in: candidateIds } },
          { its: { in: candidateIds } },
          { studentId: { in: candidateIds } },
        ],
      },
      include: { user: true, classEnrollments: { include: { class: true } } },
    });

    if (student) {
      const existingRegistry = await prisma.attendanceRegistry.findUnique({
        where: { studentId_date: { studentId: student.id, date: calendarDayUTC } },
      });
      const registryStatus = existingRegistry && existingRegistry.status === 'PRESENT' ? 'PRESENT' : initialStatus;

      await prisma.attendanceRegistry.upsert({
        where: { studentId_date: { studentId: student.id, date: calendarDayUTC } },
        create: {
          studentId: student.id,
          date: calendarDayUTC,
          status: registryStatus,
          source: 'BIOMETRIC',
          checkInTime: scanDate,
          checkOutTime: scanDate,
          recordedById: student.userId,
        },
        update: {
          checkOutTime: scanDate,
          ...(existingRegistry && existingRegistry.status === 'PRESENT' ? {} : { status: registryStatus }),
        },
      });

      const activeEnrollment = student.classEnrollments.find((e) => e.isActive) || student.classEnrollments[0];
      let classId = activeEnrollment?.classId;
      if (!classId && student.grade) {
        const cls = await prisma.class.findFirst({ where: { grade: student.grade, isActive: true } });
        classId = cls?.id;
      }
      if (classId) {
        await prisma.attendanceRecord.upsert({
          where: { studentId_classId_date: { studentId: student.id, classId, date: calendarDayUTC } },
          create: {
            studentId: student.id,
            classId,
            date: calendarDayUTC,
            status: registryStatus,
            source: 'BIOMETRIC',
            checkInTime: scanDate,
            checkOutTime: scanDate,
            verificationMethod: 'BIOMETRIC',
            biometricMethod,
            biometricHash: rawId,
            recordedById: student.userId,
          },
          update: { checkOutTime: scanDate },
        });
      }
      return;
    }

    const teacher = await prisma.teacherProfile.findFirst({
      where: {
        OR: [
          { biometricHash: { in: candidateIds } },
          { its: { in: candidateIds } },
          { employeeId: { in: candidateIds } },
        ],
      },
      include: { user: true },
    });

    if (teacher) {
      const teacherStatus = scanMinutes > 8 * 60 + 15 ? 'LATE' : 'PRESENT';
      await prisma.teacherAttendanceRecord.upsert({
        where: { teacherId_date: { teacherId: teacher.id, date: calendarDayUTC } },
        create: {
          teacherId: teacher.id,
          date: calendarDayUTC,
          status: teacherStatus,
          verificationMethod: 'BIOMETRIC',
          biometricHash: rawId,
          checkInTime: scanDate,
          checkOutTime: scanDate,
        },
        update: { checkOutTime: scanDate },
      });
    }
  } catch {}
}

async function syncDate(dateStr) {
  console.log(`\n============================================================`);
  console.log(`📅 SYNCING DATE: ${dateStr}`);
  console.log(`============================================================`);

  let allDateEvents = [];
  for (const dev of DEVICES) {
    process.stdout.write(`  ⏳ Pulling from ${dev.name} (${dev.host})... `);
    const { events, totalMatches } = await pullAllDeviceEventsForDate(dev, dateStr);
    console.log(`✓ Retrieved ${events.length} / ${totalMatches} events.`);
    allDateEvents.push(...events);
  }

  // Deduplicate by employeeNo + hour:min (or serial)
  const uniqueEvents = [];
  const seen = new Set();
  for (const ev of allDateEvents) {
    const key = `${ev.employeeNo}-${ev.time.slice(0, 16)}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEvents.push(ev);
    }
  }

  console.log(`  📦 Total unique events to forward: ${uniqueEvents.length}`);

  // Forward to Render Cloud in concurrent chunks
  const chunkSize = 15;
  let pushedToCloud = 0;
  let failedCloud = 0;

  for (let i = 0; i < uniqueEvents.length; i += chunkSize) {
    const chunk = uniqueEvents.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (ev) => {
        try {
          const ok = await pushEventToRender(ev);
          if (ok) pushedToCloud++;
          else failedCloud++;
        } catch {
          failedCloud++;
        }
        await recordLocalDB(ev);
      })
    );
    process.stdout.write(`    ☁️  Render Sync Progress: ${Math.min(i + chunkSize, uniqueEvents.length)} / ${uniqueEvents.length} (Success: ${pushedToCloud}, Fail: ${failedCloud})\r`);
  }

  console.log(`\n  ✅ Date ${dateStr} Complete: ${pushedToCloud} pushed to Render Cloud (${failedCloud} failed).`);
}

async function main() {
  console.log('🏛️  DARSE BURHANI — HIKVISION FULL CLOUD & LOCAL SYNC');
  console.log(`Target Cloud: ${RENDER_BASE}`);

  // Check Render keepalive
  try {
    const health = await fetch(`${RENDER_BASE}/api/health`);
    console.log(`Render Health Status: ${health.status} (${health.statusText})`);
  } catch (e) {
    console.warn(`Render health check warning:`, e.message);
  }

  // Get date from arguments or sync today + past 7 days
  const args = process.argv.slice(2);
  let targetDates = [];
  if (args.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(args[0])) {
    targetDates = [args[0]];
  } else if (args.includes('--today')) {
    targetDates = [new Date().toISOString().split('T')[0]];
  } else {
    // Today + previous 7 days
    const now = new Date();
    for (let i = 0; i <= 7; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      targetDates.push(d.toISOString().split('T')[0]);
    }
  }

  for (const d of targetDates) {
    await syncDate(d);
  }

  console.log('\n🎉 ALL REQUESTED DATES FULLY SYNCHRONIZED!');
  await prisma.$disconnect();
}

main().catch(console.error);
