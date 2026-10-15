import { createHash } from 'node:crypto';

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

function isAttendanceEvent(ev) {
  const empNo = String(ev.employeeNoString ?? ev.name ?? ev.cardNo ?? "").trim();
  if (!empNo || empNo === "undefined" || empNo === "null" || empNo === "0") return false;
  return true;
}

async function fetchEventsForDate(host, dateStr) {
  let position = 0;
  const pageSize = 30;
  const allEvents = [];
  const searchID = `oct14-${host.replace(/\./g, '')}-${Date.now()}`;

  console.log(`\n📡 Querying terminal ${host} for all AcsEvents on ${dateStr}...`);
  while (true) {
    const payload = JSON.stringify({
      AcsEventCond: {
        searchID,
        searchResultPosition: position,
        maxResults: pageSize,
        major: 0,
        minor: 0,
        startTime: `${dateStr}T00:00:00+05:30`,
        endTime: `${dateStr}T23:59:59+05:30`,
      }
    });

    const res = await digestFetch(`http://${host}:80/ISAPI/AccessControl/AcsEvent?format=json`, {
      method: 'POST',
      username: 'admin',
      password: 'DARSEBURHANI5253',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    });

    if (!res.ok) {
      console.error(`  ❌ HTTP error from ${host}: ${res.status}`);
      break;
    }

    const data = await res.json();
    const acs = data?.AcsEvent || data?.AcsEventSearchResult;
    const list = acs?.InfoList || acs?.MatchList || [];
    if (list.length === 0) break;

    allEvents.push(...list);
    position += list.length;

    const total = acs?.totalMatches || 0;
    process.stdout.write(`  Terminal ${host}: Retrieved ${allEvents.length}${total ? ` / ${total}` : ""} events (status: ${acs?.responseStatusStrg})...\r`);

    if (acs?.responseStatusStrg !== "MORE" || (total > 0 && position >= total)) {
      break;
    }
  }

  console.log(`\n  ✅ Retrieved total ${allEvents.length} events from ${host}`);
  return allEvents;
}

async function pushToRender(payload, retries = 3) {
  const renderUrl = 'https://darse-burhani.onrender.com';
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${renderUrl}/api/hikvision/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-biometric-secret': 'DARSEBURHANI5253',
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        return { ok: true, status: res.status };
      }
      if (attempt === retries) {
        return { ok: false, status: res.status, text: await res.text() };
      }
    } catch (err) {
      if (attempt === retries) {
        return { ok: false, error: err.message };
      }
    }
    await new Promise((r) => setTimeout(r, 300));
  }
}

async function main() {
  console.log("================================================================");
  console.log("  POLLING HIKVISION TERMINALS FOR 14th OCTOBER 2026 SCANS       ");
  console.log("  TARGET WINDOW: Tilawat al Dua (07:00:00 - 12:30:00 IST)      ");
  console.log("  CLOUD DESTINATION: https://darse-burhani.onrender.com         ");
  console.log("================================================================");

  const targetDate = "2026-10-14";
  const devices = ["192.168.0.4", "192.168.0.5"];

  const tilawatStartIST = new Date("2026-10-14T07:00:00+05:30");
  const tilawatEndIST = new Date("2026-10-14T12:30:00+05:30");

  const grandStats = {
    totalRawEvents: 0,
    totalAttendanceScans: 0,
    tilawatDuaScans: 0,
    otherWindowScans: 0,
    uniquePersons: new Set(),
    pushedToCloud: 0,
    cloudFailed: 0,
  };

  const allScansToProcess = [];

  for (const host of devices) {
    try {
      const rawEvents = await fetchEventsForDate(host, targetDate);
      grandStats.totalRawEvents += rawEvents.length;

      const attEvents = rawEvents.filter(isAttendanceEvent);
      grandStats.totalAttendanceScans += attEvents.length;

      for (const ev of attEvents) {
        const empNo = String(ev.employeeNoString ?? ev.name ?? ev.cardNo ?? "").trim();
        const scanDate = parseEventTime(ev.time);
        const inTilawatWindow = scanDate >= tilawatStartIST && scanDate <= tilawatEndIST;

        if (inTilawatWindow) {
          grandStats.tilawatDuaScans++;
        } else {
          grandStats.otherWindowScans++;
        }

        grandStats.uniquePersons.add(empNo);

        allScansToProcess.push({
          host,
          empNo,
          name: ev.name || null,
          cardNo: ev.cardNo || null,
          scanDate,
          inTilawatWindow,
          verifyMode: ev.currentVerifyMode || "FACIAL",
          rawTime: ev.time,
        });
      }
    } catch (err) {
      console.error(`Failed to fetch from ${host}:`, err.message);
    }
  }

  // Sort chronological
  allScansToProcess.sort((a, b) => a.scanDate - b.scanDate);

  console.log("\n=================== SCAN STATISTICS FOR 14th OCTOBER ===================");
  console.log(`Total Raw ISAPI Events from terminals: ${grandStats.totalRawEvents}`);
  console.log(`Total Attendance Scans: ${grandStats.totalAttendanceScans}`);
  console.log(`⭐ Tilawat al Dua Window Scans (07:00 - 12:30 IST): ${grandStats.tilawatDuaScans}`);
  console.log(`Other Time Scans: ${grandStats.otherWindowScans}`);
  console.log(`Unique Individuals Scanned: ${grandStats.uniquePersons.size}`);

  const tilawatScans = allScansToProcess.filter((s) => s.inTilawatWindow);

  console.log(`\nSample Tilawat al Dua Scans (First 15 of ${tilawatScans.length}):`);
  for (const s of tilawatScans.slice(0, 15)) {
    const istTimeStr = s.scanDate.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" });
    console.log(`  • [${istTimeStr}] Device: ${s.host} | ID: ${s.empNo} | Name: "${s.name || '—'}"`);
  }

  console.log(`\n🚀 Pushing ${tilawatScans.length} Tilawat al Dua scans to Render Cloud API...`);
  
  // Concurrently push in small batches of 10 for speed and stability
  const batchSize = 10;
  for (let i = 0; i < tilawatScans.length; i += batchSize) {
    const batch = tilawatScans.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (scan) => {
        const payload = {
          fingerprint: scan.empNo,
          timestamp: scan.scanDate.toISOString(),
          deviceId: `hikvision:${scan.host}`,
          verifyMode: scan.verifyMode,
        };
        const res = await pushToRender(payload);
        if (res?.ok) {
          grandStats.pushedToCloud++;
        } else {
          grandStats.cloudFailed++;
        }
      })
    );
    const progress = Math.min(i + batchSize, tilawatScans.length);
    process.stdout.write(`  Progress: ${progress} / ${tilawatScans.length} scans pushed to Render (Success: ${grandStats.pushedToCloud}, Failed: ${grandStats.cloudFailed})\r`);
  }

  console.log(`\n\n=================== FINAL POLLED & PUSH REPORT ===================`);
  console.log(`✅ Tilawat al Dua Scans Processed: ${tilawatScans.length}`);
  console.log(`✅ Successfully Acknowledged by Render Cloud: ${grandStats.pushedToCloud}`);
  console.log(`❌ Failed Cloud Pushes: ${grandStats.cloudFailed}`);
  console.log(`Unique Individuals Recorded for Tilawat al Dua: ${grandStats.uniquePersons.size}`);
  console.log(`=================================================================\n`);
}

main().catch((err) => {
  console.error("FATAL ERROR:", err);
  process.exit(1);
});
