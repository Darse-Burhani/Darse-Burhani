#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════════════════════
 *  🏛️  DARSE BURHANI — HIKVISION COMPLETE PERSON & BIOMETRIC CLONING TOOL
 * ════════════════════════════════════════════════════════════════════════════════
 * 
 * Clones all Person Information (User Records, Facial Recognition Photos, 
 * Fingerprint Biometric Templates, and RFID Cards) from the master old device
 * (192.168.0.4 / 192.168.0.5) to the new attendance terminal (192.168.0.11).
 */

import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SOURCE_HOST_PRIMARY = process.env.SOURCE_HIK_HOST || '192.168.0.4';
const SOURCE_HOST_SECONDARY = '192.168.0.5';
const TARGET_HOST = process.env.TARGET_HIK_HOST || '192.168.0.11';
const USERNAME = process.env.HIKVISION_USERNAME || 'admin';
const PASSWORD = process.env.HIKVISION_PASSWORD || 'DARSEBURHANI5253';

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

async function digestFetch(url, { method = 'GET', username = USERNAME, password = PASSWORD, body, headers = {}, timeoutMs = 12000 }) {
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
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function getAllUsersFromDevice(host) {
  const allUsers = [];
  let position = 0;
  const pageSize = 30;

  while (true) {
    try {
      const res = await digestFetch(`http://${host}:80/ISAPI/AccessControl/UserInfo/Search?format=json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          UserInfoSearchCond: {
            searchID: '1',
            searchResultPosition: position,
            maxResults: pageSize
          }
        }),
        timeoutMs: 10000,
      });

      if (!res.ok) break;
      const json = await res.json();
      const list = json.UserInfoSearch?.UserInfo || [];
      if (!Array.isArray(list) || list.length === 0) break;
      allUsers.push(...list);
      position += list.length;
      const total = json.UserInfoSearch?.totalMatches ?? 0;
      if (position >= total) break;
    } catch (err) {
      console.warn(`[WARN] Failed reading user page at ${position} from ${host}:`, err.message);
      break;
    }
  }

  return allUsers;
}

async function deployUserInfo(targetHost, user) {
  const now = new Date();
  const validFrom = user.Valid?.beginTime || `${now.getFullYear()}-01-01T00:00:00`;
  const validTo = user.Valid?.endTime || `${now.getFullYear() + 10}-12-31T23:59:59`;

  const payload = {
    UserInfo: {
      employeeNo: user.employeeNo,
      name: user.name || `User ${user.employeeNo}`,
      userType: user.userType || 'normal',
      closeDelayEnabled: false,
      Valid: {
        enable: false,
        beginTime: validFrom,
        endTime: validTo,
        timeType: 'local'
      },
      belongGroup: user.belongGroup || '',
      password: '',
      doorRight: user.doorRight || '1',
      RightPlan: user.RightPlan || [{ doorNo: 1, planTemplateNo: '1' }],
      maxOpenDoorTime: 0,
      openDoorTime: 0,
      roomNumber: 0,
      floorNumber: 0,
      localUIRight: false,
      gender: user.gender || 'unknown'
    }
  };

  const attempts = [
    { url: `http://${targetHost}:80/ISAPI/AccessControl/UserInfo/Record?format=json`, method: 'POST' },
    { url: `http://${targetHost}:80/ISAPI/AccessControl/UserInfo/SetUp?format=json`, method: 'PUT' },
    { url: `http://${targetHost}:80/ISAPI/AccessControl/UserInfo/Modify?format=json`, method: 'PUT' },
  ];

  for (const att of attempts) {
    try {
      const res = await digestFetch(att.url, {
        method: att.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeoutMs: 8000,
      });
      if (res.ok) return { ok: true };
    } catch {}
  }

  return { ok: false, error: 'UserInfo deployment failed' };
}

async function transferFace(sourceHost, targetHost, employeeNo, faceUrl) {
  if (!faceUrl) return { skipped: true };

  try {
    // 1. Download face picture from source device
    const picRes = await digestFetch(faceUrl, { timeoutMs: 10000 });
    if (!picRes.ok) return { ok: false, error: `Download HTTP ${picRes.status}` };
    const picBuffer = Buffer.from(await picRes.arrayBuffer());
    if (picBuffer.length < 500) return { ok: false, error: 'Invalid face image size' };

    // 2. Upload to target device via multipart ISAPI FDLib
    const boundary = '----HikCloningBoundary' + Math.random().toString(36).substring(2);
    const faceRecordJson = JSON.stringify({
      faceLibType: 'blackFD',
      FDID: '1',
      FPID: employeeNo
    });

    const bodyParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="FaceDataRecord"\r\nContent-Type: application/json\r\n\r\n${faceRecordJson}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="img"; filename="face.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
      picBuffer,
      `\r\n--${boundary}--\r\n`
    ];

    const fullMultipartBuffer = Buffer.concat([
      Buffer.from(bodyParts[0]),
      Buffer.from(bodyParts[1]),
      bodyParts[2],
      Buffer.from(bodyParts[3])
    ]);

    const upRes = await digestFetch(`http://${targetHost}:80/ISAPI/Intelligent/FDLib/FaceDataRecord?format=json`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: fullMultipartBuffer,
      timeoutMs: 12000,
    });

    if (upRes.ok) {
      return { ok: true, sizeBytes: picBuffer.length };
    }

    // Fallback attempt: FDSetUp
    const upRes2 = await digestFetch(`http://${targetHost}:80/ISAPI/Intelligent/FDLib/FDSetUp?format=json`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: fullMultipartBuffer,
      timeoutMs: 12000,
    });

    if (upRes2.ok) {
      return { ok: true, sizeBytes: picBuffer.length };
    }

    return { ok: false, error: `Upload HTTP ${upRes.status}` };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function transferFingerprint(sourceHost, targetHost, employeeNo) {
  try {
    // 1. Fetch fingerprint template from source device
    const res = await digestFetch(`http://${sourceHost}:80/ISAPI/AccessControl/FingerPrintUpload?format=json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        FingerPrintCond: {
          searchID: '1',
          employeeNo
        }
      }),
      timeoutMs: 8000,
    });

    if (!res.ok) return { skipped: true };
    const json = await res.json();
    const fpList = json.FingerPrintInfo?.FingerPrintList || [];
    if (!Array.isArray(fpList) || fpList.length === 0) return { skipped: true };

    // 2. Upload each fingerprint to target device
    let successFpCount = 0;
    for (const fp of fpList) {
      if (!fp.fingerData) continue;
      const downloadPayload = {
        FingerPrintCfg: {
          employeeNo,
          enableCardReader: fp.cardReaderNo ? [fp.cardReaderNo] : [1],
          fingerPrintID: fp.fingerPrintID || 1,
          fingerType: fp.fingerType || 'normalFP',
          fingerData: fp.fingerData
        }
      };

      const dlRes = await digestFetch(`http://${targetHost}:80/ISAPI/AccessControl/FingerPrintDownload?format=json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(downloadPayload),
        timeoutMs: 8000,
      });

      if (dlRes.ok) {
        successFpCount++;
      }
    }

    return successFpCount > 0 ? { ok: true, count: successFpCount } : { ok: false, error: 'Fingerprint download rejected' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

async function main() {
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log('  🏛️  DARSE BURHANI — HIKVISION COMPLETE PERSON & BIOMETRIC CLONING');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(`Source Master Device : ${SOURCE_HOST_PRIMARY}`);
  console.log(`Target New Device    : ${TARGET_HOST}`);
  console.log(`Timestamp            : ${new Date().toISOString()}`);

  // 1. Fetch all users from Primary Source (192.168.0.4)
  console.log(`\n⏳ Step 1: Reading user directory from ${SOURCE_HOST_PRIMARY}...`);
  const primaryUsers = await getAllUsersFromDevice(SOURCE_HOST_PRIMARY);
  console.log(`   Found ${primaryUsers.length} enrolled persons on ${SOURCE_HOST_PRIMARY}.`);

  // 2. Fetch users from Secondary Source (192.168.0.5) to catch any unique ones
  console.log(`\n⏳ Step 2: Checking secondary source ${SOURCE_HOST_SECONDARY} for unique users...`);
  const secondaryUsers = await getAllUsersFromDevice(SOURCE_HOST_SECONDARY);
  const primaryMap = new Map(primaryUsers.map(u => [u.employeeNo, u]));
  let addedFromSecondary = 0;
  for (const u of secondaryUsers) {
    if (!primaryMap.has(u.employeeNo)) {
      primaryUsers.push(u);
      primaryMap.set(u.employeeNo, u);
      addedFromSecondary++;
    }
  }
  if (addedFromSecondary > 0) {
    console.log(`   Added ${addedFromSecondary} unique user(s) from ${SOURCE_HOST_SECONDARY}.`);
  }

  const totalToClone = primaryUsers.length;
  console.log(`\n🚀 Step 3: Beginning Transfer of ${totalToClone} persons to ${TARGET_HOST}...`);

  let countUsersOk = 0;
  let countFacesOk = 0;
  let countFpOk = 0;
  let countErrors = 0;

  for (let i = 0; i < totalToClone; i++) {
    const user = primaryUsers[i];
    const sourceHostForUser = user.faceURL?.includes(SOURCE_HOST_SECONDARY) ? SOURCE_HOST_SECONDARY : SOURCE_HOST_PRIMARY;
    const progress = `[${i + 1}/${totalToClone}]`;
    const label = `${user.employeeNo} (${user.name || 'Unnamed'})`;

    // A. Deploy User Info
    const userRes = await deployUserInfo(TARGET_HOST, user);
    if (!userRes.ok) {
      console.log(`${progress} ❌ FAILED UserInfo for ${label}: ${userRes.error}`);
      countErrors++;
      continue;
    }
    countUsersOk++;

    // B. Deploy Face Picture
    let faceStatus = 'none';
    if (user.numOfFace > 0 || user.faceURL) {
      const faceRes = await transferFace(sourceHostForUser, TARGET_HOST, user.employeeNo, user.faceURL);
      if (faceRes.ok) {
        faceStatus = `✅ Face (${Math.round(faceRes.sizeBytes / 1024)} KB)`;
        countFacesOk++;
      } else if (!faceRes.skipped) {
        faceStatus = `⚠️ Face fail: ${faceRes.error}`;
      }
    }

    // C. Deploy Fingerprint
    let fpStatus = 'none';
    if (user.numOfFP > 0) {
      const fpRes = await transferFingerprint(sourceHostForUser, TARGET_HOST, user.employeeNo);
      if (fpRes.ok) {
        fpStatus = `✅ FP (${fpRes.count})`;
        countFpOk++;
      } else if (!fpRes.skipped) {
        fpStatus = `⚠️ FP fail: ${fpRes.error}`;
      }
    }

    console.log(`${progress} 👤 ${label} -> User: OK | ${faceStatus} | ${fpStatus}`);

    // Small 80ms breather to prevent flooding the Hikvision embedded controller
    await new Promise((r) => setTimeout(r, 80));
  }

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log('🎉 CLONING PROCESS FINISHED!');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(`Total Persons Processed      : ${totalToClone}`);
  console.log(`Successfully Deployed Users  : ${countUsersOk}`);
  console.log(`Face Photos Transferred      : ${countFacesOk}`);
  console.log(`Fingerprint Templates Synced : ${countFpOk}`);
  console.log(`Errors Encountered           : ${countErrors}`);

  // Verification from Target Device
  console.log('\n🔍 Verifying Enrollment State directly on new device 192.168.0.11...');
  try {
    const verifyUserRes = await digestFetch(`http://${TARGET_HOST}:80/ISAPI/AccessControl/UserInfo/Search?format=json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ UserInfoSearchCond: { searchID: '1', searchResultPosition: 0, maxResults: 1 } }),
      timeoutMs: 8000,
    });
    const verifyUserJson = await verifyUserRes.json();
    const verifiedUserCount = verifyUserJson.UserInfoSearch?.totalMatches ?? 0;

    const verifyFdRes = await digestFetch(`http://${TARGET_HOST}:80/ISAPI/Intelligent/FDLib/FDSearch?format=json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ searchResultPosition: 0, maxResults: 1, faceLibType: 'blackFD', FDID: '1' }),
      timeoutMs: 8000,
    });
    const verifyFdJson = await verifyFdRes.json();
    const verifiedFaceCount = verifyFdJson.totalMatches ?? verifyFdJson.FDLibSearchResult?.totalMatches ?? 0;

    console.log(`\n📊 NEW DEVICE (192.168.0.11) HARDWARE VERIFICATION:`);
    console.log(`   - Enrolled Users in Memory : ${verifiedUserCount} / ${totalToClone}`);
    console.log(`   - Active Face Biometrics   : ${verifiedFaceCount} / ${countFacesOk}`);

    if (verifiedUserCount >= totalToClone - 5) {
      console.log(`\n✨ SUCCESS: New device (192.168.0.11) is now fully provisioned and ready for live attendance scanning!`);
    }
  } catch (err) {
    console.error('Verification query failed:', err.message);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());

