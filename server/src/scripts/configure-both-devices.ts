import "../env";
import prisma from "../lib/prisma";
import {
  encryptPassword,
  toConnection,
  deployAllStudentsToDevice,
  deployAllTeachersToDevice,
  forceSyncDeviceTime,
  syncDeviceScansNow,
  getDeviceInfo,
  getDoorStatus,
} from "../lib/hikvision";

interface DeviceConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  pollIntervalSeconds: number;
}

const TARGET_DEVICES: DeviceConfig[] = [
  {
    name: "Main Entrance MinMoe (192.168.0.4)",
    host: "192.168.0.4",
    port: Number(process.env.HIKVISION_PORT || 80),
    username: process.env.HIKVISION_USERNAME || "admin",
    password: process.env.HIKVISION_PASSWORD || "DARSEBURHANI5253",
    pollIntervalSeconds: 15,
  },
  {
    name: "Secondary Terminal (192.168.0.5)",
    host: "192.168.0.5",
    port: 80,
    username: "admin",
    password: process.env.HIKVISION_PASSWORD || "DARSEBURHANI5253",
    pollIntervalSeconds: 15,
  },
];

async function setupDevice(cfg: DeviceConfig) {
  console.log(`\n======================================================`);
  console.log(`🔧 Configuring: ${cfg.name} [${cfg.host}:${cfg.port}]`);
  console.log(`======================================================`);

  const { enc, iv } = encryptPassword(cfg.password || "DARSEBURHANI5253");

  const existing = await prisma.biometricDevice.findFirst({ where: { host: cfg.host } });
  const data = {
    name: cfg.name,
    type: "HIKVISION",
    host: cfg.host,
    port: cfg.port,
    username: cfg.username,
    passwordEnc: enc,
    passwordIv: iv,
    enabled: true,
    status: "ONLINE",
    pollIntervalSeconds: cfg.pollIntervalSeconds,
    lastError: null,
  };

  const dev = existing
    ? await prisma.biometricDevice.update({ where: { id: existing.id }, data })
    : await prisma.biometricDevice.create({ data });

  console.log(`✅ DB Record Ready: ID=${dev.id} (Status: ONLINE, Enabled: true)`);

  // Probe ISAPI
  const conn = toConnection(dev);
  try {
    const info = await getDeviceInfo(conn);
    console.log(`📡 Connected to Terminal: ${info.model} | Serial: ${info.serialNumber} | FW: ${info.firmwareVersion}`);

    await prisma.biometricDevice.update({
      where: { id: dev.id },
      data: {
        model: info.model || dev.model,
        serialNo: info.serialNumber || dev.serialNo,
        mac: info.macAddress || dev.mac,
        firmwareVersion: info.firmwareVersion || dev.firmwareVersion,
        lastSeenAt: new Date(),
      },
    });

    // Sync Clock to IST
    try {
      const timeSync = await forceSyncDeviceTime(dev.id);
      console.log(`🕒 Clock Synchronized to IST: ${timeSync.deviceTime}`);
    } catch (e: any) {
      console.warn(`⚠️ Clock sync notice: ${e.message}`);
    }

    // Check Door Status
    try {
      const door = await getDoorStatus(conn, 1);
      console.log(`🚪 Door #1 Status: State=${door.doorState}, Lock=${door.lockState}`);
    } catch {}

    // Deploy Students
    console.log(`\n👥 Deploying Talabat (Students) to ${cfg.host}...`);
    const stuRes = await deployAllStudentsToDevice(dev.id);
    console.log(`   ✅ Talabat: ${stuRes.successful}/${stuRes.total} synced (${stuRes.failed} failed)`);
    if (stuRes.errors.length > 0 && stuRes.errors.length <= 5) {
      stuRes.errors.forEach((e) => console.log(`      - ${e.name} (${e.studentId}): ${e.error}`));
    }

    // Deploy Teachers
    console.log(`\n👨‍🏫 Deploying Asateez (Faculty) to ${cfg.host}...`);
    const teaRes = await deployAllTeachersToDevice(dev.id);
    console.log(`   ✅ Faculty: ${teaRes.successful}/${teaRes.total} synced (${teaRes.failed} failed)`);
    if (teaRes.errors.length > 0 && teaRes.errors.length <= 5) {
      teaRes.errors.forEach((e) => console.log(`      - ${e.name} (${e.teacherId}): ${e.error}`));
    }

    // Poll Scans
    console.log(`\n📋 Polling Attendance Scans from ${cfg.host}...`);
    const pollRes = await syncDeviceScansNow(dev.id);
    console.log(`   ✅ Attendance Poll: Fetched=${pollRes.scansFetched}, Processed=${pollRes.scansProcessed}`);
  } catch (err: any) {
    console.warn(`\n⚠️  ISAPI communication note for ${cfg.host}: ${err.message}`);
    console.log(`   Device is registered and enabled. It will auto-poll when online on the local network.`);
  }

  return dev;
}

async function main() {
  console.log("======================================================");
  console.log("🚀 DARSE BURHANI - DUAL BIOMETRIC TERMINAL CONFIGURATION");
  console.log("======================================================");

  for (const cfg of TARGET_DEVICES) {
    await setupDevice(cfg);
  }

  const allDevs = await prisma.biometricDevice.findMany({ orderBy: { host: "asc" } });
  console.log(`\n======================================================`);
  console.log(`🏁 All Configured Biometric Devices (${allDevs.length})`);
  console.log(`======================================================`);
  for (const d of allDevs) {
    console.log(`- [${d.status}] ${d.name} (${d.host}:${d.port}) | Enabled: ${d.enabled} | Model: ${d.model || "N/A"} | Serial: ${d.serialNo || "N/A"}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Configuration failed:", err);
    await prisma.$disconnect();
    process.exit(1);
  });
