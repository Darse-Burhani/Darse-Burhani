import dgram from "node:dgram";
import { randomUUID } from "node:crypto";

export interface SadpDevice {
  host: string;
  port: number;
  mac: string;
  model: string;
  serialNo: string;
  deviceName: string;
  deviceType: string;
  firmwareVersion: string;
}

const PROBE_PORT = 37020;
const MULTICAST_ADDR = "239.255.255.250";
const BROADCAST_ADDR = "255.255.255.255";

function tag(xml: string, name: string): string {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
  return m?.[1]?.trim() ?? "";
}

/**
 * Parse a SADP `<ProbeMatch>` response. Hikvision terminals (and cameras)
 * answer an XML multicast probe the same way the SADP tool does.
 */
export function parseProbeMatch(xml: string): SadpDevice {
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

export interface DiscoverOptions {
  timeoutMs?: number;
  probeCount?: number;
}

/**
 * Discover Hikvision devices on the LAN using the same UDP probe the SADP
 * tool sends (XML on port 37020, via broadcast + multicast). Resolves with a
 * de-duplicated list after the probe window closes.
 */
export function discoverDevices(options: DiscoverOptions = {}): Promise<SadpDevice[]> {
  const { timeoutMs = 4000, probeCount = 3 } = options;

  return new Promise((resolve) => {
    const socket = dgram.createSocket("udp4");
    const found = new Map<string, SadpDevice>();
    const uuid = randomUUID();
    const payload = Buffer.from(
      `<?xml version="1.0" encoding="utf-8"?><Probe><Uuid>${uuid}</Uuid><Types>inquiry</Types></Probe>`,
      "utf-8",
    );

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      try {
        socket.close();
      } catch {
        // already closed
      }
      resolve([...found.values()]);
    };

    const timer = setInterval(finish, timeoutMs);

    socket.on("error", () => finish());

    socket.on("message", (msg, rinfo) => {
      const text = msg.toString("utf-8");
      if (!text.includes("ProbeMatch")) return;
      const device = parseProbeMatch(text);
      if (!device.host) device.host = rinfo.address;
      const key = device.host || device.mac || device.serialNo;
      if (key && !found.has(key)) found.set(key, device);
    });

    try {
      socket.bind(0, () => {
        socket.setBroadcast(true);
        socket.setMulticastTTL(255);
        try {
          socket.addMembership(MULTICAST_ADDR);
        } catch {
          // multicast membership unsupported on this interface — broadcast only
        }
        for (let i = 0; i < probeCount; i++) {
          setTimeout(() => {
            for (const target of [BROADCAST_ADDR, MULTICAST_ADDR]) {
              try {
                socket.send(payload, PROBE_PORT, target);
              } catch {
                // keep going
              }
            }
          }, i * 200);
        }
      });
    } catch {
      finish();
    }
  });
}
