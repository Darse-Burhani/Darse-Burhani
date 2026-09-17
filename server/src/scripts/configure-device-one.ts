import "../env";
import prisma from "../lib/prisma";
import { encryptPassword, decryptPassword } from "../lib/hikvision";
import { getDeviceInfo } from "../lib/hikvision/isapi";

async function main() {
  console.log("=== Checking Biometric Devices in Database ===");
  const devices = await prisma.biometricDevice.findMany();
  console.log(`Found ${devices.length} devices in database.`);

  for (const d of devices) {
    let pw = "(none)";
    if (d.passwordEnc && d.passwordIv) {
      try {
        pw = `OK (len ${decryptPassword(d.passwordEnc, d.passwordIv).length})`;
      } catch (e: any) {
        pw = `FAILED: ${e.message}`;
      }
    }
    console.log(`- [${d.status}] ${d.name} (${d.host}:${d.port}) | Enabled: ${d.enabled} | PW: ${pw}`);
  }

  const targetHost = "192.168.0.4";
  const defaultPassword = process.env.HIKVISION_PASSWORD || "DARSEBURHANI5253";
  const defaultUsername = process.env.HIKVISION_USERNAME || "admin";
  const defaultPort = Number(process.env.HIKVISION_PORT || 80);

  console.log(`\n=== Configuring Device 1 (${targetHost}) ===`);
  const { enc, iv } = encryptPassword(defaultPassword);

  const existing = await prisma.biometricDevice.findFirst({ where: { host: targetHost } });
  const deviceData = {
    name: existing?.name || "Main Entrance MinMoe (192.168.0.4)",
    type: "HIKVISION",
    host: targetHost,
    port: existing?.port || defaultPort,
    username: existing?.username || defaultUsername,
    passwordEnc: enc,
    passwordIv: iv,
    enabled: true,
    status: "ONLINE",
    pollIntervalSeconds: 15,
  };

  const dev = existing
    ? await prisma.biometricDevice.update({ where: { id: existing.id }, data: deviceData })
    : await prisma.biometricDevice.create({ data: deviceData });

  console.log(`${existing ? "Updated" : "Created"} device record: ID=${dev.id}`);

  console.log(`\n=== Testing ISAPI Communication to ${targetHost}:${dev.port} ===`);
  try {
    const info = await getDeviceInfo({ host: dev.host, port: dev.port, username: dev.username, password: defaultPassword });
    console.log("SUCCESS! Connected to Hikvision Terminal:", info);

    await prisma.biometricDevice.update({
      where: { id: dev.id },
      data: {
        status: "ONLINE",
        lastError: null,
        lastSeenAt: new Date(),
        model: info.model || dev.model,
        serialNo: info.serialNumber || dev.serialNo,
        mac: info.macAddress || dev.mac,
        firmwareVersion: info.firmwareVersion || dev.firmwareVersion,
      },
    });
    console.log("Updated device telemetry in database.");
  } catch (err: any) {
    console.warn(`ISAPI probe to ${targetHost} did not succeed right now:`, err.message);
    console.log("Device record is configured in DB and will automatically connect when on local network.");
  }

  const allDevs = await prisma.biometricDevice.findMany();
  console.log("\n=== Final Registered Devices ===");
  for (const d of allDevs) {
    console.log(`- [${d.status}] ${d.name} (${d.host}:${d.port}) — Enabled: ${d.enabled}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
