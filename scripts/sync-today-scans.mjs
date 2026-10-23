import { createHash, createDecipheriv } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

async function digestFetch(url, { method = 'GET', username, password, body, headers = {}, timeoutMs = 20000 }) {
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
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

// Mirrors server/src/lib/biometric.ts parseScanTime: device timestamps without an
// explicit offset are wall-clock IST, so append +05:30 instead of letting the
// server-local timezone decide.
function parseEventTime(isoOrLocal) {
  if (!isoOrLocal) return new Date();
  const raw = String(isoOrLocal).trim();
  if (!raw) return new Date();
  if (/[Zz]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const normalized = raw.replace(/\//g, "-").replace(" ", "T");
  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/);
  if (isoMatch) {
    const [, y, mo, d, h, mi, s, ms] = isoMatch;
    const parsed = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}${ms ? `.${ms}` : ""}+05:30`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const dmyMatch = raw.match(/^(\d{2})[/-](\d{2})[/-](\d{4})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (dmyMatch) {
    const [, d, mo, y, h, mi, s] = dmyMatch;
    const parsed = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+05:30`);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

// Mirrors server getISTDetails().calendarDayUTC: the IST calendar day (YYYY-MM-DD
// in Asia/Kolkata) stored as midnight UTC. Using the UTC date instead misfiles
// scans between 00:00–05:29 IST into the previous day.
function getIstCalendarDayUTC(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value || "01";
  return new Date(Date.UTC(Number(get("year")), Number(get("month")) - 1, Number(get("day"))));
}

function getIstNowXml() {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value || "00";
  let hour = get("hour");
  if (hour === "24") hour = "00";
  return {
    localTime: `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}:${get("second")}+05:30`,
    timeZone: "CST-5:30:00",
  };
}

// Mirrors server syncDeviceTime (lib/hikvision/index.ts): terminals lose their
// clock (dead CMOS battery / reboot / NTP failure). Measure drift via
// ISAPI/System/time, push IST back when it exceeds 60s, and return driftMs
// (device minus true time) so callers can map skewed event timestamps back.
async function syncDeviceClock(dev, password) {
  try {
    const base = `http://${dev.host}:${dev.port}`;
    const t0 = Date.now();
    const res = await digestFetch(`${base}/ISAPI/System/time`, {
      method: "GET",
      username: dev.username,
      password,
      timeoutMs: 5000,
    });
    if (!res.ok) return 0;
    const xml = await res.text();
    const m = xml.match(/<localTime>([^<]+)<\/localTime>/);
    if (!m) return 0;
    const devNow = new Date(m[1]);
    if (Number.isNaN(devNow.getTime())) return 0;
    const rttHalf = (Date.now() - t0) / 2;
    const driftMs = devNow.getTime() - t0 - rttHalf;
    if (Math.abs(driftMs) <= 60_000) return driftMs;
    const modeMatch = xml.match(/<timeMode>([^<]+)<\/timeMode>/);
    const { localTime, timeZone } = getIstNowXml();
    const body = `<?xml version="1.0" encoding="UTF-8"?>\n<Time version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">\n<timeMode>${modeMatch ? modeMatch[1] : "manual"}</timeMode>\n<localTime>${localTime}</localTime>\n<timeZone>${timeZone}</timeZone>\n</Time>`;
    const putRes = await digestFetch(`${base}/ISAPI/System/time`, {
      method: "PUT",
      username: dev.username,
      password,
      headers: { "Content-Type": "application/xml" },
      body,
      timeoutMs: 5000,
    });
    const outcome = putRes.ok ? "re-synced to IST" : `sync failed (HTTP ${putRes.status})`;
    console.warn(`  ⚠️ ${dev.host} clock drifted by ${Math.round(driftMs / 1000)}s — ${outcome}`);
    return driftMs;
  } catch (err) {
    console.warn(`  ⚠️ Could not read clock on ${dev.host}: ${err.message || err}`);
    return 0;
  }
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

async function fetchAllTodayEvents(dev, password) {
  password = password ?? decryptPassword(dev.passwordEnc, dev.passwordIv);
  let position = 0;
  // NOTE: these terminals cap a page at 30 events no matter what maxResults
  // you ask for (asking 50 or 1000 still returns 30). Do NOT treat a short
  // page as "end of results" — only an empty page or reaching totalMatches
  // means the end. Doing so silently kept just the first 30 of ~1000 events.
  const pageSize = 30;
  const allEvents = [];
  const isWatch = process.argv.includes('--watch') || process.argv.includes('--poll') || process.argv.includes('-w');
  const dateArg = process.argv.slice(2).find((a) => !a.startsWith('-'));
  const nowIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const todayIso = dateArg || nowIST; // YYYY-MM-DD in IST
  // One stable search session per device per run — Hikvision pages a single
  // searchID; minting a new ID per page resets/duplicates the cursor.
  const searchID = "sync-" + dev.id + "-" + Date.now();

  while (true) {
    const acsPayload = JSON.stringify({
      AcsEventCond: {
        searchID,
        searchResultPosition: position,
        maxResults: pageSize,
        major: 0,
        minor: 0,
        startTime: `${todayIso}T00:00:00+05:30`,
        endTime: `${todayIso}T23:59:59+05:30`,
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

    const totalMatches = Number(acsData?.AcsEvent?.totalMatches) || 0;
    // Stop only when the device says we've seen everything. A short page is
    // NOT the end: the firmware always returns at most 30 events per page.
    if (totalMatches && position >= totalMatches) break;
    if (infoList.length === 0) break;
  }

  return allEvents;
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

async function processScan(empNo, scanDate, host, verifyMode) {
  const raw = canonicalizeEmployeeNo(empNo);
  const strippedNum = raw.replace(/^0+/, '');
  const prefixMatch = raw.match(/^(?:STU|ITS|FP|CARD|ID|TALABAT|EMP|TEA|FAC|STAFF|TEACHER|FACULTY)[-_:.]?(.*)$/i);
  const innerNum = prefixMatch && prefixMatch[1] ? prefixMatch[1].trim() : '';
  const innerStripped = innerNum ? innerNum.replace(/^0+/, '') : '';
  const candidates = Array.from(new Set([raw, strippedNum, innerNum, innerStripped])).filter(Boolean);

  // 1. Check student
  const student = await prisma.studentProfile.findFirst({
    where: {
      OR: [
        { its: { in: candidates } },
        { studentId: { in: candidates } },
        { biometricHash: { in: candidates } },
      ]
    },
    include: { user: true, classEnrollments: { include: { class: true } } }
  });

  const timeStr = scanDate.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });

  if (student) {
    const name = `${student.user.firstName} ${student.user.lastName}`.trim();
    console.log(`  👤 MATCHED TALABAT: ${name} (ITS/ID: ${empNo}) at ${timeStr}`);

    // Bucket by IST calendar day (matches server getISTDetails). Using the UTC
    // date misfiles 00:00–05:29 IST scans into the previous day.
    const todayUTC = getIstCalendarDayUTC(scanDate);

    // Find class enrollment
    const activeEnrollment = student.classEnrollments.find(e => e.isActive) || student.classEnrollments[0];
    let classId = activeEnrollment?.classId;
    if (!classId) {
      const cls = await prisma.class.findFirst({ where: { grade: student.grade, isActive: true } });
      classId = cls?.id;
    }

    if (classId) {
      // First scan of the day wins check-in (server DUPLICATE-guard parity);
      // later scans only advance check-out. Re-polls are idempotent.
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
          checkOutTime: scanDate,
          verificationMethod: "BIOMETRIC",
          biometricMethod: "FACIAL",
          biometricHash: empNo,
          recordedById: student.userId,
        },
        update: {
          checkOutTime: scanDate,
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
        checkOutTime: scanDate,
        recordedById: student.userId,
      },
      update: {
        checkOutTime: scanDate,
      }
    });

    return true;
  }

  // 2. Check Teacher
  const teacher = await prisma.teacherProfile.findFirst({
    where: {
      OR: [
        { employeeId: { in: candidates } },
        { its: { in: candidates } },
        { biometricHash: { in: candidates } },
      ]
    },
    include: { user: true }
  });

  if (teacher) {
    const name = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
    console.log(`  👨‍🏫 MATCHED FACULTY: ${name} (EmployeeId: ${empNo}) at ${timeStr}`);
    const todayUTC = getIstCalendarDayUTC(scanDate);
    await prisma.teacherAttendanceRecord.upsert({
      where: { teacherId_date: { teacherId: teacher.id, date: todayUTC } },
      create: {
        teacherId: teacher.id,
        date: todayUTC,
        status: "PRESENT",
        checkInTime: scanDate,
        checkOutTime: scanDate,
        verificationMethod: "BIOMETRIC",
        biometricMethod: "FACIAL",
        biometricHash: empNo,
      },
      update: {
        checkOutTime: scanDate,
      },
    });

    return true;
  }

  console.log(`  ⚠️ UNRECOGNIZED ID scanned: "${empNo}" at ${timeStr}`);
  return false;
}

async function runSyncCycle(targetDayIso) {
  console.log("====================================================");
  console.log(`🔄 SYNCING FACE SCANS FROM BOTH TERMINALS FOR ${targetDayIso}`);
  console.log("====================================================");

  const devices = await prisma.biometricDevice.findMany();
  // Accurate IST calendar day boundary: 00:00:00 IST = previous day 18:30:00 UTC
  const [ty, tm, td] = targetDayIso.split('-').map(Number);
  const startOfTargetIST = new Date(Date.UTC(ty, tm - 1, td, 0, 0, 0) - 5.5 * 3600 * 1000);
  const endOfTargetIST = new Date(Date.UTC(ty, tm - 1, td + 1, 0, 0, 0) - 5.5 * 3600 * 1000);

  for (const dev of devices) {
    try {
      const password = decryptPassword(dev.passwordEnc, dev.passwordIv);
      // Fix + measure terminal clock BEFORE querying: a drifted clock both
      // shifts the device-side query window and skews every event timestamp.
      const driftMs = await syncDeviceClock(dev, password);
      const clockSkewed = Math.abs(driftMs) > 60_000;
      if (driftMs !== 0) {
        console.log(`  🕒 ${dev.host} clock drift: ${Math.round(driftMs / 1000)}s${clockSkewed ? " (correcting event timestamps)" : ""}`);
      }
      console.log(`\nFetching scans from ${dev.name} (${dev.host})...`);
      const events = await fetchAllTodayEvents(dev, password);
      const attendanceEvents = events.filter(isAttendanceEvent);
      console.log(`Found ${events.length} total events, ${attendanceEvents.length} attendance face scans.`);

      // Oldest-first so first scan wins check-in and latest lands check-out.
      const ordered = attendanceEvents
        .map((ev) => {
          const rawEmp = String(ev.employeeNoString ?? ev.name ?? ev.cardNo ?? "").trim();
          const empNo = canonicalizeEmployeeNo(rawEmp, ev.name);
          let scanDate = parseEventTime(ev.time);
          if (clockSkewed) scanDate = new Date(scanDate.getTime() - driftMs);
          return { ev, empNo, scanDate };
        })
        .filter(({ scanDate }) => scanDate >= startOfTargetIST && scanDate < endOfTargetIST)
        .sort((a, b) => a.scanDate - b.scanDate);

      const skipped = attendanceEvents.length - ordered.length;
      if (skipped > 0) console.log(`  ⏭️ Skipped ${skipped} scan(s) outside the ${targetDayIso} IST day window.`);

      let processed = 0;
      for (const { ev, empNo, scanDate } of ordered) {
        const ok = await processScan(empNo, scanDate, dev.host, ev.currentVerifyMode);
        if (ok) processed++;
      }
      console.log(`Processed ${processed} valid scans from ${dev.name}.`);
    } catch (err) {
      console.warn(`  ⚠️ Could not fetch logs from ${dev.name} (${dev.host}):`, err.message || err);
    }
  }
}

async function main() {
  const isWatch = process.argv.includes('--watch') || process.argv.includes('--poll') || process.argv.includes('-w');
  const dateArg = process.argv.slice(2).find((a) => !a.startsWith('-'));

  do {
    const nowIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    const targetDayIso = dateArg || nowIST;
    await runSyncCycle(targetDayIso);

    if (isWatch) {
      console.log(`\n⏳ Continuous watcher active. Next device poll in 15 seconds (Press Ctrl+C to exit)...`);
      await new Promise((resolve) => setTimeout(resolve, 15000));
    }
  } while (isWatch);
}

main().then(() => process.exit(0)).catch(e => { console.error('FATAL:', e); process.exit(1); });
