import { spawn } from 'node:child_process';

const RENDER_URL = 'https://darse-burhani.onrender.com';
const SECRET = 'DARSEBURHANI5253';

async function testStudentPush() {
  const payload = {
    AccessControllerEvent: {
      employeeNoString: '30382757',
      name: 'Abdeali Calcuttawala',
      time: '2026-10-22T08:10:00',
      currentVerifyMode: 'FACIAL',
      serialNo: 'probe-' + Date.now(),
      deviceId: '192.168.0.4',
    },
  };

  try {
    const res = await fetch(`${RENDER_URL}/api/hikvision/events?secret=${SECRET}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    const outcome = json?.data?.results?.[0]?.outcome;
    const msg = json?.data?.results?.[0]?.message;
    return { outcome, msg, ok: res.ok };
  } catch (err) {
    return { error: err.message };
  }
}

async function waitForDeploy() {
  console.log('⏳ Waiting for Render Cloud to finish deploying commit 1868b4f...');
  let attempts = 0;
  while (attempts < 40) {
    attempts++;
    const healthRes = await fetch(`${RENDER_URL}/api/health`).then(r => r.json()).catch(() => null);
    const testRes = await testStudentPush();

    console.log(`[Attempt ${attempts}] Render Uptime: ${healthRes?.uptimeSeconds ?? '?'}s | Test Student Outcome: ${testRes.outcome || 'ERR'} (${testRes.msg || testRes.error})`);

    // If outcome is MATCHED or DUPLICATE, the fix is active!
    if (testRes.outcome === 'MATCHED' || testRes.outcome === 'DUPLICATE') {
      console.log('\n🎉 SUCCESS! Render Cloud is now running the updated code!');
      console.log(`Student attendance outcome verified: "${testRes.outcome}" — ${testRes.msg}`);
      return true;
    }

    await new Promise(r => setTimeout(r, 6000));
  }
  return false;
}

async function runSyncAll() {
  console.log('\n============================================================');
  console.log('🚀 TRIGGERING COMPREHENSIVE CLOUD & LOCAL SYNC FOR ALL DATES');
  console.log('============================================================\n');

  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/sync-all-to-render.mjs'], { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Sync process exited with code ${code}`));
    });
  });
}

async function main() {
  const ready = await waitForDeploy();
  if (!ready) {
    console.error('❌ Timed out waiting for Render deployment.');
    process.exit(1);
  }

  await runSyncAll();
  console.log('\n✅ All Talabat and Faculty attendance is now fully synchronized on Cloud Render!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
