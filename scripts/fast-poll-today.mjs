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

async function digestFetch(url, { method = 'GET', username, password, body, headers = {}, timeoutMs = 15000 }) {
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

function isAttendanceEvent(e) {
  const maj = Number(e.major);
  const min = Number(e.minor);
  const employeeNo = String(e.employeeNoString ?? e.name ?? e.cardNo ?? "").trim();
  if (!employeeNo || employeeNo === "undefined" || employeeNo === "null") return false;
  if (maj === 5) {
    if ([1, 2, 4, 8, 9, 10, 11, 12, 13, 38, 39, 40, 75, 77, 78].includes(min)) {
      return true;
    }
  }
  return false;
}

async function fetchAllTodayEvents(dev, password, todayIso) {
  password = password ?? decryptPassword(dev.passwordEnc, dev.passwordIv);
  let position = 0;
  const pageSize = 30;
  const allEvents = [];
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
      timeoutMs: 10000,
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
    if (totalMatches && position >= totalMatches) break;
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
  if (id === '3038798' || nameStr === '3038798' || /jamali/i.test(combined)) return '30387984';

  if (/manpur/i.test(combined) || /mustafa\s*tailor/i.test(combined)) return '40444603';
  if (/shk\s*abbas.*hamid|shaikh\s*abbas.*hamid|m.*murtaza.*sh.*abbas/i.test(combined)) return '30489490';
  if (/chhatariya/i.test(combined)) return '30150861';

  if (/^\d{8}$/.test(nameStr)) return nameStr;
  return id;
}

function getCandidateKeys(rawId, name) {
  const raw = canonicalizeEmployeeNo(rawId, name);
  const strippedNum = raw.replace(/^0+/, '');
  const prefixMatch = raw.match(/^(?:STU|ITS|FP|CARD|ID|TALABAT|EMP|TEA|FAC|STAFF|TEACHER|FACULTY)[-_:.]?(.*)$/i);
  const innerNum = prefixMatch && prefixMatch[1] ? prefixMatch[1].trim() : '';
  const innerStripped = innerNum ? innerNum.replace(/^0+/, '') : '';
  return Array.from(new Set([raw, strippedNum, innerNum, innerStripped])).filter(Boolean);
}

// Concurrency helper
async function runInParallelBatches(items, batchSize, fn) {
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    await Promise.all(chunk.map(fn));
  }
}

export async function pollAttendance(targetDayIso) {
  const t0 = Date.now();
  console.log('====================================================');
  console.log(`⚡ HIGH-SPEED ATTENDANCE POLL FOR ${targetDayIso}`);
  console.log('====================================================');

  const [ty, tm, td] = targetDayIso.split('-').map(Number);
  const startOfTargetIST = new Date(Date.UTC(ty, tm - 1, td, 0, 0, 0) - 5.5 * 3600 * 1000);
  const endOfTargetIST = new Date(Date.UTC(ty, tm - 1, td + 1, 0, 0, 0) - 5.5 * 3600 * 1000);
  const todayUTC = new Date(Date.UTC(ty, tm - 1, td));

  // 1. Fetch all students and teachers from DB in parallel
  console.log('📦 Loading student & teacher profiles...');
  const [allStudents, allTeachers, classes] = await Promise.all([
    prisma.studentProfile.findMany({
      include: {
        user: true,
        classEnrollments: { include: { class: true } },
      }
    }),
    prisma.teacherProfile.findMany({
      include: { user: true }
    }),
    prisma.class.findMany({ where: { isActive: true } }),
  ]);

  console.log(`Loaded ${allStudents.length} students, ${allTeachers.length} teachers, ${classes.length} classes.`);

  // Build indexed lookup maps
  const studentKeyMap = new Map();
  for (const s of allStudents) {
    if (s.its) studentKeyMap.set(s.its, s);
    if (s.studentId) studentKeyMap.set(s.studentId, s);
    if (s.biometricHash) studentKeyMap.set(s.biometricHash, s);
    const cleanIts = s.its ? s.its.replace(/^0+/, '') : null;
    if (cleanIts) studentKeyMap.set(cleanIts, s);
  }

  const teacherKeyMap = new Map();
  for (const t of allTeachers) {
    if (t.employeeId) teacherKeyMap.set(t.employeeId, t);
    if (t.its) teacherKeyMap.set(t.its, t);
    if (t.biometricHash) teacherKeyMap.set(t.biometricHash, t);
    const cleanEmp = t.employeeId ? t.employeeId.replace(/^0+/, '') : null;
    if (cleanEmp) teacherKeyMap.set(cleanEmp, t);
    const cleanIts = t.its ? t.its.replace(/^0+/, '') : null;
    if (cleanIts) teacherKeyMap.set(cleanIts, t);
  }

  function findStudent(rawId, name) {
    for (const k of getCandidateKeys(rawId, name)) {
      if (studentKeyMap.has(k)) return studentKeyMap.get(k);
    }
    return null;
  }

  function findTeacher(rawId, name) {
    for (const k of getCandidateKeys(rawId, name)) {
      if (teacherKeyMap.has(k)) return teacherKeyMap.get(k);
    }
    return null;
  }

  // 2. Fetch events from physical terminals
  const devices = await prisma.biometricDevice.findMany();
  const rawEvents = [];

  for (const dev of devices) {
    try {
      const password = decryptPassword(dev.passwordEnc, dev.passwordIv);
      console.log(`Connecting to ${dev.name} (${dev.host})...`);
      const events = await fetchAllTodayEvents(dev, password, targetDayIso);
      const attEvents = events.filter(isAttendanceEvent);
      console.log(`  → Found ${events.length} total events, ${attEvents.length} attendance face scans.`);

      for (const ev of attEvents) {
        const rawEmp = String(ev.employeeNoString ?? ev.name ?? ev.cardNo ?? "").trim();
        const scanDate = parseEventTime(ev.time);
        if (scanDate >= startOfTargetIST && scanDate < endOfTargetIST) {
          rawEvents.push({ ev, rawEmp, name: ev.name, scanDate, host: dev.host });
        }
      }
    } catch (err) {
      console.warn(`  ⚠️ Could not fetch from ${dev.name} (${dev.host}):`, err.message || err);
    }
  }

  console.log(`\nTotal verified scans inside ${targetDayIso} window: ${rawEvents.length}`);

  // 3. Aggregate scans in-memory by person
  // Student scans: studentId -> { student, scans: Date[], firstScan: Date, lastScan: Date, rawEmp: string }
  const studentScans = new Map();
  // Teacher scans: teacherId -> { teacher, scans: Date[], firstScan: Date, lastScan: Date, rawEmp: string }
  const teacherScans = new Map();
  const unrecognized = [];

  for (const item of rawEvents) {
    const student = findStudent(item.rawEmp, item.name);
    if (student) {
      if (!studentScans.has(student.id)) {
        studentScans.set(student.id, {
          student,
          scans: [],
          firstScan: item.scanDate,
          lastScan: item.scanDate,
          rawEmp: item.rawEmp,
        });
      }
      const agg = studentScans.get(student.id);
      agg.scans.push(item.scanDate);
      if (item.scanDate < agg.firstScan) agg.firstScan = item.scanDate;
      if (item.scanDate > agg.lastScan) agg.lastScan = item.scanDate;
      continue;
    }

    const teacher = findTeacher(item.rawEmp, item.name);
    if (teacher) {
      if (!teacherScans.has(teacher.id)) {
        teacherScans.set(teacher.id, {
          teacher,
          scans: [],
          firstScan: item.scanDate,
          lastScan: item.scanDate,
          rawEmp: item.rawEmp,
        });
      }
      const agg = teacherScans.get(teacher.id);
      agg.scans.push(item.scanDate);
      if (item.scanDate < agg.firstScan) agg.firstScan = item.scanDate;
      if (item.scanDate > agg.lastScan) agg.lastScan = item.scanDate;
      continue;
    }

    unrecognized.push(item);
  }

  console.log(`\nMatched Talabat with scans : ${studentScans.size}`);
  console.log(`Matched Faculty with scans : ${teacherScans.size}`);
  console.log(`Unrecognized scans         : ${unrecognized.length}`);

  // 4. Load existing records from Postgres for today
  console.log('\nLoading existing DB records for today to preserve prior check-ins...');
  const [existingStudentRecs, existingRegistries, existingTeacherRecs] = await Promise.all([
    prisma.attendanceRecord.findMany({ where: { date: todayUTC } }),
    prisma.attendanceRegistry.findMany({ where: { date: todayUTC } }),
    prisma.teacherAttendanceRecord.findMany({ where: { date: todayUTC } }),
  ]);

  const existingRecMap = new Map(); // `${studentId}_${classId}` -> record
  for (const r of existingStudentRecs) {
    existingRecMap.set(`${r.studentId}_${r.classId}`, r);
  }

  const existingRegMap = new Map(); // studentId -> registry
  for (const reg of existingRegistries) {
    existingRegMap.set(reg.studentId, reg);
  }

  const existingTeacherMap = new Map(); // teacherId -> record
  for (const tr of existingTeacherRecs) {
    existingTeacherMap.set(tr.teacherId, tr);
  }

  // 5. Update / Upsert Students (Talabat)
  console.log('\nWriting Talabat attendance records in parallel...');
  const studentWorkItems = [];

  for (const student of allStudents) {
    const agg = studentScans.get(student.id);

    // Determine target classes
    let targetClassIds = student.classEnrollments.filter(e => e.isActive).map(e => e.classId);
    if (targetClassIds.length === 0) {
      const cls = classes.find(c => c.grade === student.grade);
      if (cls) targetClassIds = [cls.id];
    }

    if (agg) {
      // Scanned today!
      const existingReg = existingRegMap.get(student.id);
      const firstCheckIn = existingReg?.checkInTime && existingReg.checkInTime < agg.firstScan
        ? existingReg.checkInTime
        : agg.firstScan;
      const lastCheckOut = existingReg?.checkOutTime && existingReg.checkOutTime > agg.lastScan
        ? existingReg.checkOutTime
        : agg.lastScan;

      // Status: on-time threshold 07:50 AM IST (470 mins)
      const stuMinutes = (firstCheckIn.getUTCHours() * 60 + firstCheckIn.getUTCMinutes() + 330) % 1440;
      const calculatedStatus = stuMinutes <= (7 * 60 + 50) ? 'PRESENT' : 'LATE';
      const finalStatus = existingReg && existingReg.status === 'PRESENT' ? 'PRESENT' : calculatedStatus;

      studentWorkItems.push({
        type: 'SCANNED_STUDENT',
        student,
        targetClassIds,
        finalStatus,
        firstCheckIn,
        lastCheckOut,
        rawEmp: agg.rawEmp,
      });
    } else {
      // Not scanned today -> ABSENT
      studentWorkItems.push({
        type: 'ABSENT_STUDENT',
        student,
        targetClassIds,
      });
    }
  }

  let stuPresentCount = 0;
  let stuLateCount = 0;
  let stuAbsentCount = 0;

  await runInParallelBatches(studentWorkItems, 20, async (item) => {
    const { student, targetClassIds } = item;

    if (item.type === 'SCANNED_STUDENT') {
      const { finalStatus, firstCheckIn, lastCheckOut, rawEmp } = item;
      if (finalStatus === 'PRESENT') stuPresentCount++;
      else stuLateCount++;

      // Upsert Registry
      await prisma.attendanceRegistry.upsert({
        where: { studentId_date: { studentId: student.id, date: todayUTC } },
        create: {
          studentId: student.id,
          date: todayUTC,
          status: finalStatus,
          source: 'BIOMETRIC',
          checkInTime: firstCheckIn,
          checkOutTime: lastCheckOut,
          recordedById: student.userId,
        },
        update: {
          status: finalStatus,
          source: 'BIOMETRIC',
          checkInTime: firstCheckIn,
          checkOutTime: lastCheckOut,
        }
      });

      // Upsert AttendanceRecord for each enrolled class
      for (const classId of targetClassIds) {
        await prisma.attendanceRecord.upsert({
          where: { studentId_classId_date: { studentId: student.id, classId, date: todayUTC } },
          create: {
            studentId: student.id,
            classId,
            date: todayUTC,
            status: finalStatus,
            checkInTime: firstCheckIn,
            checkOutTime: lastCheckOut,
            verificationMethod: 'BIOMETRIC',
            biometricMethod: 'FACIAL',
            biometricHash: rawEmp,
            recordedById: student.userId,
            source: 'BIOMETRIC',
          },
          update: {
            status: finalStatus,
            checkInTime: firstCheckIn,
            checkOutTime: lastCheckOut,
            verificationMethod: 'BIOMETRIC',
            biometricMethod: 'FACIAL',
            biometricHash: rawEmp,
            source: 'BIOMETRIC',
          }
        });
      }
    } else {
      // ABSENT
      stuAbsentCount++;
      // Registry
      await prisma.attendanceRegistry.upsert({
        where: { studentId_date: { studentId: student.id, date: todayUTC } },
        create: {
          studentId: student.id,
          date: todayUTC,
          status: 'ABSENT',
          source: 'AUTO_ABSENT',
          remarks: 'Auto-marked absent (no device scan recorded)',
          recordedById: student.userId,
        },
        update: {
          // If it was already absent or not present, keep it absent
          status: 'ABSENT',
          source: 'AUTO_ABSENT',
        }
      });

      for (const classId of targetClassIds) {
        await prisma.attendanceRecord.upsert({
          where: { studentId_classId_date: { studentId: student.id, classId, date: todayUTC } },
          create: {
            studentId: student.id,
            classId,
            date: todayUTC,
            status: 'ABSENT',
            source: 'AUTO_ABSENT',
            verificationMethod: 'AUTO_SYSTEM',
            justification: 'No biometric scan recorded',
            recordedById: student.userId,
          },
          update: {
            status: 'ABSENT',
            source: 'AUTO_ABSENT',
            verificationMethod: 'AUTO_SYSTEM',
          }
        });
      }
    }
  });

  // 6. Update / Upsert Teachers (Faculty)
  console.log('Writing Faculty attendance records in parallel...');
  const teacherWorkItems = [];

  for (const teacher of allTeachers) {
    const agg = teacherScans.get(teacher.id);
    if (agg) {
      const existing = existingTeacherMap.get(teacher.id);
      const firstCheckIn = existing?.checkInTime && existing.checkInTime < agg.firstScan
        ? existing.checkInTime
        : agg.firstScan;
      const lastCheckOut = existing?.checkOutTime && existing.checkOutTime > agg.lastScan
        ? existing.checkOutTime
        : agg.lastScan;

      // On-time threshold 08:03 AM IST (483 mins)
      const teaMinutes = (firstCheckIn.getUTCHours() * 60 + firstCheckIn.getUTCMinutes() + 330) % 1440;
      const calculatedStatus = teaMinutes <= (8 * 60 + 3) ? 'PRESENT' : 'LATE';
      const finalStatus = existing && existing.status === 'PRESENT' ? 'PRESENT' : calculatedStatus;
      const hasMultipleScans = lastCheckOut.getTime() - firstCheckIn.getTime() > 60000;
      const timeFormatted = firstCheckIn.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });

      teacherWorkItems.push({
        type: 'SCANNED_TEACHER',
        teacher,
        finalStatus,
        firstCheckIn,
        checkOutTime: hasMultipleScans ? lastCheckOut : null,
        rawEmp: agg.rawEmp,
        notes: `Premises check-in scan (${timeFormatted} IST via FACIAL)`,
      });
    } else {
      teacherWorkItems.push({
        type: 'ABSENT_TEACHER',
        teacher,
      });
    }
  }

  let teaPresentCount = 0;
  let teaLateCount = 0;
  let teaAbsentCount = 0;

  await runInParallelBatches(teacherWorkItems, 20, async (item) => {
    const { teacher } = item;
    if (item.type === 'SCANNED_TEACHER') {
      const { finalStatus, firstCheckIn, checkOutTime, rawEmp, notes } = item;
      if (finalStatus === 'PRESENT') teaPresentCount++;
      else teaLateCount++;

      await prisma.teacherAttendanceRecord.upsert({
        where: { teacherId_date: { teacherId: teacher.id, date: todayUTC } },
        create: {
          teacherId: teacher.id,
          date: todayUTC,
          status: finalStatus,
          checkInTime: firstCheckIn,
          checkOutTime,
          verificationMethod: 'BIOMETRIC',
          biometricMethod: 'FACIAL',
          biometricHash: rawEmp,
          notes,
        },
        update: {
          status: finalStatus,
          checkInTime: firstCheckIn,
          checkOutTime,
          verificationMethod: 'BIOMETRIC',
          biometricMethod: 'FACIAL',
          biometricHash: rawEmp,
          notes,
        }
      });
    } else {
      teaAbsentCount++;
      await prisma.teacherAttendanceRecord.upsert({
        where: { teacherId_date: { teacherId: teacher.id, date: todayUTC } },
        create: {
          teacherId: teacher.id,
          date: todayUTC,
          status: 'ABSENT',
          notes: 'Auto-marked absent (no scan inside faculty window)',
        },
        update: {
          status: 'ABSENT',
          notes: 'Auto-marked absent (no scan inside faculty window)',
        }
      });
    }
  });

  const durationSec = ((Date.now() - t0) / 1000).toFixed(1);
  console.log('\n====================================================');
  console.log(`✅ ATTENDANCE SYNC COMPLETE IN ${durationSec}s`);
  console.log('====================================================');
  console.log(`Talabat Results: Total ${allStudents.length} | Present: ${stuPresentCount} | Late: ${stuLateCount} | Absent: ${stuAbsentCount}`);
  console.log(`Faculty Results: Total ${allTeachers.length} | Present: ${teaPresentCount} | Late: ${teaLateCount} | Absent: ${teaAbsentCount}`);

  return {
    students: { total: allStudents.length, present: stuPresentCount, late: stuLateCount, absent: stuAbsentCount },
    teachers: { total: allTeachers.length, present: teaPresentCount, late: teaLateCount, absent: teaAbsentCount },
    durationSec,
  };
}

async function main() {
  const dateArg = process.argv.slice(2).find((a) => !a.startsWith('-'));
  const nowIST = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const targetDayIso = dateArg || nowIST;

  try {
    const res = await pollAttendance(targetDayIso);
    console.log('\nFinal Output:', JSON.stringify(res, null, 2));
    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('FATAL ERROR:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
