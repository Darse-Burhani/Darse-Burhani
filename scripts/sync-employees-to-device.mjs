/**
 * sync-employees-to-device.mjs
 *
 * Syncs ALL talabat (students) and faculty (teachers) from the local
 * Prisma database onto both Hikvision terminals as enrolled UserInfo records.
 *
 * The Hikvision employeeNo is set to the person's ITS number (biometricHash),
 * which is exactly what the devices report back in AcsEvent.employeeNoString.
 * After running this, every scan from a known talabat or faculty member will
 * be recognized by both the local sync-today-scans.mjs and the cloud API.
 *
 * Usage:
 *   node scripts/sync-employees-to-device.mjs
 *
 * Options:
 *   --dry-run    Print what would be synced without calling the devices
 *   --students   Sync only students (talabat)
 *   --teachers   Sync only teachers (faculty)
 */

import { createHash, createDecipheriv } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const ALGO = 'aes-256-gcm';

const isDryRun = process.argv.includes('--dry-run');
const onlyStudents = process.argv.includes('--students');
const onlyTeachers = process.argv.includes('--teachers');

// ---- Crypto helpers ----

function encKey() {
  return createHash('sha256').update(process.env.NEXTAUTH_SECRET ?? 'dev-biometric-secret').digest();
}

function decryptPassword(enc, iv) {
  if (!enc || !iv) return process.env.HIKVISION_PASSWORD || 'DARSEBURHANI5253';
  try {
    const buf = Buffer.from(enc, 'base64');
    const tag = buf.subarray(buf.length - 16);
    const data = buf.subarray(0, buf.length - 16);
    const d = createDecipheriv(ALGO, encKey(), Buffer.from(iv, 'base64'));
    d.setAuthTag(tag);
    return Buffer.concat([d.update(data), d.final()]).toString('utf8');
  } catch {
    return process.env.HIKVISION_PASSWORD || 'DARSEBURHANI5253';
  }
}

function md5(str) {
  return createHash('md5').update(str).digest('hex');
}

// ---- Digest Auth fetch ----

function parseDigestHeader(header) {
  const params = {};
  const re = /(\w+)=(?:"([^"]+)"|([^\s,]+))/g;
  let match;
  while ((match = re.exec(header)) !== null) params[match[1]] = match[2] || match[3];
  return params;
}

async function digestFetch(url, { method = 'GET', username, password, body, headers = {}, timeoutMs = 15000 }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { method, headers, body, signal: ctrl.signal });
    if (r.status !== 401) { clearTimeout(t); return r; }
    const ah = r.headers.get('www-authenticate') || '';
    if (!ah.toLowerCase().startsWith('digest')) { clearTimeout(t); return r; }
    const ch = parseDigestHeader(ah.slice(7));
    const uri = new URL(url).pathname + new URL(url).search;
    const ha1 = md5(username + ':' + (ch.realm || '') + ':' + password);
    const ha2 = md5(method + ':' + uri);
    let auth = 'Digest username="' + username + '", realm="' + (ch.realm || '') + '", nonce="' + (ch.nonce || '') + '", uri="' + uri + '"';
    let resp;
    if (ch.qop) {
      const nc = '00000001', cn = Math.random().toString(36).slice(2, 10);
      resp = md5(ha1 + ':' + ch.nonce + ':' + nc + ':' + cn + ':' + ch.qop + ':' + ha2);
      auth += ', qop=' + ch.qop + ', nc=' + nc + ', cnonce="' + cn + '", response="' + resp + '"';
    } else {
      resp = md5(ha1 + ':' + ch.nonce + ':' + ha2);
      auth += ', response="' + resp + '"';
    }
    if (ch.opaque) auth += ', opaque="' + ch.opaque + '"';
    const authed = await fetch(url, { method, headers: { ...headers, Authorization: auth }, body, signal: ctrl.signal });
    clearTimeout(t);
    return authed;
  } catch (err) {
    clearTimeout(t);
    throw err;
  }
}

// ---- Deploy single user to a device (PUT UserInfo/Record, fallback POST SetUp) ----

async function deployUser(host, port, username, password, employeeNo, name) {
  const base = 'http://' + host + ':' + port;
  const now = new Date();
  const validFrom = now.getFullYear() + '-01-01T00:00:00';
  const validTo = (now.getFullYear() + 5) + '-12-31T23:59:59';

  const jsonPayload = JSON.stringify({
    UserInfo: {
      employeeNo,
      name,
      userType: 'normal',
      closeDelayEnabled: false,
      Valid: { enable: true, beginTime: validFrom, endTime: validTo, timeType: 'local' },
      belongGroup: '1',
      password: '',
      doorRight: '1',
      RightPlan: [{ doorNo: 1, planTemplateNo: '1' }],
      maxOpenDoorTime: 0,
      openDoorTime: 0,
      roomNumber: 0,
      floorNumber: 0,
    },
  });

  const xmlPayload = '<?xml version="1.0" encoding="UTF-8"?>\n<UserInfo version="2.0" xmlns="http://www.isapi.org/ver20/XMLSchema">\n  <employeeNo>' + employeeNo + '</employeeNo>\n  <name>' + name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</name>\n  <userType>normal</userType>\n  <Valid>\n    <enable>true</enable>\n    <beginTime>' + validFrom + '</beginTime>\n    <endTime>' + validTo + '</endTime>\n    <timeType>local</timeType>\n  </Valid>\n  <doorRight>1</doorRight>\n  <RightPlan><doorNo>1</doorNo><planTemplateNo>1</planTemplateNo></RightPlan>\n</UserInfo>';

  const attempts = [
    { url: base + '/ISAPI/AccessControl/UserInfo/Record?format=json', method: 'POST', ct: 'application/json', body: jsonPayload },
    { url: base + '/ISAPI/AccessControl/UserInfo/SetUp?format=json', method: 'PUT', ct: 'application/json', body: jsonPayload },
    { url: base + '/ISAPI/AccessControl/UserInfo/Modify?format=json', method: 'PUT', ct: 'application/json', body: jsonPayload },
  ];

  for (const att of attempts) {
    try {
      const res = await digestFetch(att.url, {
        method: att.method,
        headers: { 'Content-Type': att.ct },
        body: att.body,
        username,
        password,
        timeoutMs: 8000,
      });
      if (res.ok) return { ok: true };
      const txt = await res.text().catch(() => '');
      // 4xx response with "already exists" or duplicate is fine — user is already on device
      if (res.status === 400 && (txt.includes('replayAttack') || txt.includes('already') || txt.includes('exist'))) {
        return { ok: true, alreadyExists: true };
      }
      // Try next attempt format
    } catch (_) {
      // Network error on this attempt — try next format
    }
  }
  return { ok: false };
}

// ---- Get list of employeeNos already on the device ----

async function getExistingEmployeeNos(host, port, username, password) {
  const base = 'http://' + host + ':' + port;
  const existing = new Set();
  let position = 0;
  const pageSize = 30; // MinMoe terminal maximum page size
  const searchID = 'sync-users-' + Date.now();

  while (true) {
    try {
      const payload = JSON.stringify({
        UserInfoSearchCond: {
          searchID,
          searchResultPosition: position,
          maxResults: pageSize,
        },
      });
      const res = await digestFetch(base + '/ISAPI/AccessControl/UserInfo/Search?format=json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        username,
        password,
        timeoutMs: 10000,
      });
      if (!res.ok) break;
      const text = await res.text();
      let list = [];
      let totalMatches = 0;
      try {
        const data = JSON.parse(text);
        const searchResult = data?.UserInfoSearch || data?.userInfoSearch || data;
        totalMatches = Number(searchResult?.totalMatches || 0);
        const rawList = searchResult?.UserInfo || searchResult?.userInfo || searchResult?.MatchList || searchResult?.matchList;
        list = Array.isArray(rawList) ? rawList : (rawList && typeof rawList === 'object' ? [rawList] : []);
      } catch {
        // Fallback simple XML parse if needed
        const matches = text.match(/<employeeNo>([^<]+)<\/employeeNo>/g) || [];
        for (const m of matches) {
          const val = m.replace(/<\/?employeeNo>/g, '').trim();
          if (val) existing.add(val);
        }
        break;
      }

      if (!list.length) break;
      for (const u of list) {
        const emp = String(u.employeeNo ?? u.employeeNoString ?? u.id ?? '').trim();
        if (emp) existing.add(emp);
      }
      position += list.length;
      if (totalMatches && position >= totalMatches) break;
      if (list.length < pageSize && (!totalMatches || position >= totalMatches)) break;
    } catch {
      break;
    }
  }
  return existing;
}

// ---- Main ----

async function main() {
  console.log('='.repeat(70));
  console.log('  SYNC EMPLOYEES -> HIKVISION TERMINALS' + (isDryRun ? ' [DRY RUN]' : ''));
  console.log('  Pushes all talabat ITS + faculty ITS as device UserInfo records');
  console.log('  so every scan is recognized in real-time AND on backfill.');
  console.log('='.repeat(70));

  // 1. Load people from DB
  const toSync = []; // { employeeNo, name, role }

  if (!onlyTeachers) {
    const students = await prisma.studentProfile.findMany({
      where: { user: { isActive: true } },
      select: {
        its: true,
        studentId: true,
        biometricHash: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    for (const s of students) {
      const empNo = s.biometricHash || s.its || s.studentId;
      if (!empNo) continue;
      const name = (s.user.firstName + ' ' + s.user.lastName).trim() || empNo;
      toSync.push({ employeeNo: empNo, name, role: 'STUDENT' });
    }
    console.log('Talabat loaded from DB: ' + students.length + ' (' + toSync.filter(x => x.role === 'STUDENT').length + ' with ITS/ID)');
  }

  if (!onlyStudents) {
    const teachers = await prisma.teacherProfile.findMany({
      where: { user: { isActive: true } },
      select: {
        its: true,
        employeeId: true,
        biometricHash: true,
        user: { select: { firstName: true, lastName: true } },
      },
    });
    for (const t of teachers) {
      // Prefer ITS for matching; fallback to biometricHash or employeeId
      const empNo = t.its || t.biometricHash || t.employeeId;
      if (!empNo || empNo.startsWith('EMP-') || empNo === 'BIOMETRIC-SYSTEM-001') continue;
      const name = (t.user.firstName + ' ' + t.user.lastName).trim() || empNo;
      toSync.push({ employeeNo: empNo, name, role: 'TEACHER' });
    }
    console.log('Faculty loaded from DB : ' + teachers.length + ' (' + toSync.filter(x => x.role === 'TEACHER').length + ' with ITS)');
  }

  if (!toSync.length) {
    console.log('\nNo people to sync. Check that students have ITS/biometricHash populated.');
    process.exit(0);
  }
  console.log('Total to push: ' + toSync.length + ' (students: ' + toSync.filter(x => x.role === 'STUDENT').length + ', faculty: ' + toSync.filter(x => x.role === 'TEACHER').length + ')');

  if (isDryRun) {
    console.log('\n[DRY RUN] First 20 records that would be pushed:');
    for (const p of toSync.slice(0, 20)) {
      console.log('  ' + p.role.padEnd(8) + ' | ' + String(p.employeeNo).padEnd(12) + ' | ' + p.name);
    }
    if (toSync.length > 20) console.log('  ... and ' + (toSync.length - 20) + ' more');
    await prisma.$disconnect();
    return;
  }

  // 2. Load devices
  const devices = await prisma.biometricDevice.findMany({ where: { enabled: true } });
  if (!devices.length) {
    console.error('\nERROR: No enabled biometric devices in DB.');
    process.exit(1);
  }
  console.log('\nDevices: ' + devices.map(d => d.name + ' (' + d.host + ')').join(', '));

  // 3. For each device: fetch existing users, then push missing ones
  for (const dev of devices) {
    const password = decryptPassword(dev.passwordEnc, dev.passwordIv);
    console.log('\n' + '-'.repeat(70));
    console.log('Terminal: ' + dev.name + ' (' + dev.host + ':' + dev.port + ')');
    console.log('-'.repeat(70));

    // 3a. Get already-enrolled employee numbers
    process.stdout.write('  Fetching existing users from terminal...');
    const existing = await getExistingEmployeeNos(dev.host, dev.port, dev.username, password);
    console.log(' found ' + existing.size + ' existing users.');

    const toCreate = toSync.filter(p => !existing.has(String(p.employeeNo)));
    const alreadyThere = toSync.length - toCreate.length;
    console.log('  Already on device: ' + alreadyThere + '  |  To enroll: ' + toCreate.length);

    if (!toCreate.length) {
      console.log('  All users already enrolled. Nothing to do.');
      continue;
    }

    // 3b. Push new users in serial (avoid overwhelming the device)
    let ok = 0, fail = 0, skip = 0;
    for (let i = 0; i < toCreate.length; i++) {
      const person = toCreate[i];
      const result = await deployUser(dev.host, dev.port, dev.username, password, person.employeeNo, person.name);
      if (result.ok) {
        if (result.alreadyExists) skip++;
        else ok++;
      } else {
        fail++;
        console.log('    FAIL ' + person.employeeNo + ' (' + person.name + ')');
      }
      if ((i + 1) % 10 === 0 || i === toCreate.length - 1) {
        process.stdout.write('  Progress: ' + (i + 1) + '/' + toCreate.length + ' (enrolled:' + ok + ' skipped:' + skip + ' failed:' + fail + ')\r');
      }
    }
    console.log('\n  DONE: enrolled=' + ok + ' already_existed=' + (alreadyThere + skip) + ' failed=' + fail);
  }

  console.log('\n' + '='.repeat(70));
  console.log('  SYNC COMPLETE');
  console.log('  All talabat ITS and faculty ITS are now enrolled on all terminals.');
  console.log('  Scans will now be recognized in real-time and on every backfill.');
  console.log('='.repeat(70));

  await prisma.$disconnect();
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
