import "../env";
import prisma from "../lib/prisma";
import { toConnection, getDeviceInfo, getAcsEvents, pollDevice } from "../lib/hikvision";

async function main() {
  console.log("=== CHECKING HIKVISION TERMINALS & LIVE SCANS ===");
  const devices = await prisma.biometricDevice.findMany();
  console.log(`Found ${devices.length} devices in DB.`);

  for (const dev of devices) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Checking Device: ${dev.name} (${dev.host}:${dev.port})`);
    const conn = toConnection(dev);
    try {
      const info = await getDeviceInfo(conn);
      console.log(`📡 Model: ${info.model} | Serial: ${info.serialNumber} | FW: ${info.firmwareVersion}`);
      console.log(`🕒 Server Clock (Local):`, new Date().toISOString(), "IST:", new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }));

      // Fetch ACS events for today and last 24h
      const now = new Date();
      const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const { events } = await getAcsEvents(conn, past24h, now);
      console.log(`📊 ACS Events in last 24h: ${events.length}`);
      
      if (events.length > 0) {
        console.log(`\nLast 10 Raw Events from ${dev.host}:`);
        for (const ev of events.slice(-10)) {
          console.log(`  - Time: ${ev.time} | EmpNo: "${ev.employeeNoString}" | Card: "${ev.cardNo}" | Name: "${ev.name}" | Major: ${ev.major} | Minor: ${ev.minor} | Mode: ${ev.currentVerifyMode} | Serial: ${ev.serialNo}`);
        }
      }

      console.log(`\n🔄 Polling scans now through pollDevice()...`);
      const pollRes = await pollDevice(dev.id, true, past24h, now);
      console.log(`✅ Poll Result for ${dev.host}: Fetched=${pollRes.scansFetched}, Processed=${pollRes.scansProcessed}`);
    } catch (err: any) {
      console.error(`❌ Error communicating with ${dev.host}:`, err.message || err);
    }
  }

  // Check recent Attendance records
  console.log(`\n==================================================`);
  console.log(`Recent Attendance records created today:`);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const recentAttendances = await prisma.attendanceRecord.findMany({
    where: { date: { gte: todayStart } },
    take: 10,
    orderBy: { createdAt: "desc" },
  });
  console.log(`Total student attendances today: ${recentAttendances.length}`);
  for (const a of recentAttendances) {
    console.log(`  - Student ID: ${a.studentId} | Status: ${a.status} | Time: ${a.checkInTime} | Created: ${a.createdAt.toISOString()}`);
  }

  const recentTeacherAttendances = await prisma.teacherAttendanceRecord.findMany({
    where: { date: { gte: todayStart } },
    take: 10,
    orderBy: { createdAt: "desc" },
  });
  console.log(`Total teacher attendances today: ${recentTeacherAttendances.length}`);
  for (const t of recentTeacherAttendances) {
    console.log(`  - Teacher ID: ${t.teacherId} | Status: ${t.status} | Time: ${t.checkInTime} | Created: ${t.createdAt.toISOString()}`);
  }
}

main().then(() => process.exit(0)).catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
