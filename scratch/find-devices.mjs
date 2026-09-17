import dgram from 'node:dgram';
import { randomUUID } from 'node:crypto';
import os from 'node:os';

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return m?.[1]?.trim() ?? "";
}

function parseProbeMatch(xml) {
  return {
    host: tag(xml, "IPv4Address"),
    port: Number(tag(xml, "Port")) || 80,
    mac: tag(xml, "MAC").toUpperCase(),
    model: tag(xml, "Model") || tag(xml, "DeviceType"),
    serialNo: tag(xml, "SerialNumber"),
    deviceName: tag(xml, "DeviceName"),
    deviceType: tag(xml, "DeviceType"),
    firmwareVersion: tag(xml, "FirmwareVersion"),
  };
}

async function main() {
  console.log("Local Network Interfaces:");
  const ifaces = os.networkInterfaces();
  for (const [name, addrs] of Object.entries(ifaces)) {
    for (const a of addrs) {
      if (a.family === 'IPv4' && !a.internal) {
        console.log(`  - ${name}: ${a.address} (Netmask: ${a.netmask})`);
      }
    }
  }

  console.log("\nSending SADP Discovery UDP probe on port 37020...");
  const socket = dgram.createSocket("udp4");
  const found = new Map();
  const uuid = randomUUID();
  const payload = Buffer.from(
    `<?xml version="1.0" encoding="utf-8"?><Probe><Uuid>${uuid}</Uuid><Types>inquiry</Types></Probe>`,
    "utf-8"
  );

  socket.on("message", (msg) => {
    const text = msg.toString("utf-8");
    if (text.includes("ProbeMatch")) {
      const dev = parseProbeMatch(text);
      if (dev.host && !found.has(dev.host)) {
        found.set(dev.host, dev);
        console.log(`\n🎉 FOUND HIKVISION DEVICE:`);
        console.log(JSON.stringify(dev, null, 2));
      }
    }
  });

  socket.bind(0, () => {
    try {
      socket.setBroadcast(true);
    } catch {}

    const send = () => {
      try {
        socket.send(payload, 37020, "255.255.255.255");
        socket.send(payload, 37020, "239.255.255.250");
      } catch {}
    };

    send();
    setTimeout(send, 500);
    setTimeout(send, 1000);
  });

  await new Promise((r) => setTimeout(r, 4000));
  socket.close();

  console.log(`\nTotal Hikvision devices discovered: ${found.size}`);
}

main().catch(console.error);
