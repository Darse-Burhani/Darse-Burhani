import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve('server/.env') });
dotenv.config({ path: path.resolve('.env') });

import prisma from '../lib/prisma';
import {
  toConnection,
  getDeviceInfo,
  getAcsEvents,
  pollDevice,
  getStartOfTodayIST,
  isAttendanceEvent,
  syncDeviceTime,
} from '../lib/hikvision';
import { getISTDetails } from '../lib/biometric';

async function main() {
  console.log('================================================================================');
  console.log('           POLLING TODAY FACULTY SCANS WITH PROPER TIME SYNC                    ');
  console.log('================================================================================');

  const now = new Date();
  const { calendarDayUTC, timeFormatted12 } = getISTDetails(now);
  const targetDate = calendarDayUTC;
  const startOfTodayIST = getStartOfTodayIST();
  const istDateString = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

  console.log(`📅 Date: ${istDateString} | Current IST Time: ${timeFormatted12}`);
  console.log(`🕒 Polling Window: ${startOfTodayIST.toISOString()} → ${now.toISOString()}\n`);

  // 1. Devices
  const devices = await prisma.biometricDevice.findMany({
    where: { enabled: true },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`📡 Found ${devices.length} enabled biometric device(s).\n`);

  let totalScansFetched = 0;
  let totalScansProcessed = 0;

  for (const dev of devices) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`👉 Device: "${dev.name}" (${dev.host}:${dev.port})`);
    const conn = toConnection(dev);

    try {
      const info = await getDeviceInfo(conn);
      console.log(`   ✅ Online: Model=${info.model} | Serial=${info.serialNumber}`);

      // Perform proper clock synchronization
      console.log(`   ⏱️ Checking and synchronizing hardware clock with IST...`);
      const driftMs = await syncDeviceTime(conn);
      console.log(`   ✅ Hardware Clock Synced: Measured drift = ${(driftMs / 1000).toFixed(2)}s`);

      // Query raw ACS events
      const { events } = await getAcsEvents(conn, startOfTodayIST, now);
      const attEvents = events.filter(isAttendanceEvent);
      console.log(`   📊 Events Today: ${events.length} total, ${attEvents.length} attendance events`);

      // Poll and process into DB
      console.log(`   🔄 Polling and synchronizing attendance records...`);
      const pollRes = await pollDevice(dev.id, true, startOfTodayIST, now);
      console.log(`   ✅ Polled: Fetched=${pollRes.scansFetched}, Processed=${pollRes.scansProcessed}`);

      totalScansFetched += pollRes.scansFetched;
      totalScansProcessed += pollRes.scansProcessed;
    } catch (err: any) {
      console.error(`   ❌ Device ${dev.host} error:`, err?.message || err);
    }
  }

  console.log(`\n================================================================================`);
  console.log(`🎯 Hardware Poll Finished: Total Scans=${totalScansFetched}, Processed=${totalScansProcessed}`);
  console.log(`================================================================================\n`);

  // 2. Fetch all faculty attendance records for today
  const allTeachers = await prisma.teacherProfile.findMany({
    include: { user: true },
    orderBy: { user: { firstName: 'asc' } },
  });

  const teacherRecordsToday = await prisma.teacherAttendanceRecord.findMany({
    where: { date: targetDate },
  });
  const teaMap = new Map(teacherRecordsToday.map(r => [r.teacherId, r]));

  console.log(`================================================================================`);
  console.log(`               TODAY'S FACULTY ATTENDANCE AUDIT (${istDateString})              `);
  console.log(`================================================================================`);
  console.log(
    `| ${'ITS ID'.padEnd(10)} | ${'Faculty Member Name'.padEnd(35)} | ${'Status'.padEnd(10)} | ${'Check-In (IST)'.padEnd(16)} | ${'Check-Out (IST)'.padEnd(16)} |`
  );
  console.log(`--------------------------------------------------------------------------------`);

  let presentCount = 0;
  let lateCount = 0;
  let unrecordedCount = 0;

  for (const t of allTeachers) {
    const rec = teaMap.get(t.id);
    const its = t.its || '-';
    const name = `${t.user?.firstName || ''} ${t.user?.lastName || ''}`.trim().slice(0, 35);
    const status = rec ? rec.status : 'UNRECORDED';
    const checkIn = rec?.checkInTime
      ? new Date(rec.checkInTime).toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      : '—';
    const checkOut = rec?.checkOutTime && rec.checkInTime && Math.abs(rec.checkOutTime.getTime() - rec.checkInTime.getTime()) > 5 * 60 * 1000
      ? new Date(rec.checkOutTime).toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      : '—';

    if (status === 'PRESENT') presentCount++;
    else if (status === 'LATE') lateCount++;
    else unrecordedCount++;

    console.log(
      `| ${its.padEnd(10)} | ${name.padEnd(35)} | ${status.padEnd(10)} | ${checkIn.padEnd(16)} | ${checkOut.padEnd(16)} |`
    );
  }

  console.log(`--------------------------------------------------------------------------------`);
  console.log(`📊 Faculty Attendance Summary: Present=${presentCount} | Late=${lateCount} | Pending/Unrecorded=${unrecordedCount}`);
  console.log(`⚡ Render cloud was NOT woken (local poll only). Token usage minimized.`);
  console.log(`================================================================================\n`);
}

main().finally(() => prisma.$disconnect());

