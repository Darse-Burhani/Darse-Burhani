import { Router } from "express";
import { requireRole } from "../middleware";
import { processBiometricScan } from "../lib/biometric";
import {
  parseHikPushPayload,
  processPushEvents,
  getPushStats,
  configureDevicePush,
  removeDevicePushUrl,
  getHttpHosts,
  sameWebhookPath,
  getLocalLanIp,
} from "../lib/hikvision/push";
import { toConnection } from "../lib/hikvision";
import prisma from "../lib/prisma";

const router = Router();

/** The externally-reachable webhook URL the device should push events to. */
function buildPushUrl(req: import("express").Request, deviceIp?: string): string {
  if (process.env.HIKVISION_PUSH_URL) return process.env.HIKVISION_PUSH_URL;
  if (
    process.env.NEXT_PUBLIC_APP_URL &&
    !process.env.NEXT_PUBLIC_APP_URL.includes("localhost") &&
    !process.env.NEXT_PUBLIC_APP_URL.includes("127.0.0.1")
  ) {
    return `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/hikvision/events`;
  }
  const forwardedHost = req.get("x-forwarded-host") || req.get("host");
  if (forwardedHost && !forwardedHost.includes("localhost") && !forwardedHost.includes("127.0.0.1")) {
    const proto = req.secure || req.get("x-forwarded-proto") === "https" ? "https" : "http";
    return `${proto}://${forwardedHost}/api/hikvision/events`;
  }
  const lanIp = getLocalLanIp(deviceIp);
  return `http://${lanIp}:4000/api/hikvision/events`;
}

function authorizePush(req: import("express").Request): boolean {
  const secret = process.env.BIOMETRIC_SECRET;
  if (!secret) return true; // dev mode — open
  if (req.headers["x-biometric-secret"] === secret) return true;

  // Hikvision httpHosts supports HTTP Basic auth (but not custom headers).
  const auth = req.headers.authorization ?? "";
  if (auth.toLowerCase().startsWith("basic ")) {
    try {
      const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
      const [, password] = decoded.split(":");
      if (password === secret) return true;
    } catch {
      // fall through
    }
  }
  return false;
}

function bodyAsObject(body: unknown): Record<string, any> {
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString("utf8"));
    } catch {
      return {};
    }
  }
  if (body && typeof body === "object") return body as Record<string, any>;
  return {};
}

// ── Public webhook: device → server (HTTP Event Listening / Alarm Server) ──

const handleWebhookEvents = async (req: import("express").Request, res: import("express").Response) => {
  try {
    if (!authorizePush(req)) {
      console.warn(`[hikvision] push rejected from ${req.ip} — invalid secret`);
      return res.status(401).json({ success: false, error: "Invalid biometric secret" });
    }

    // Automatically mark all enabled devices as ONLINE when receiving webhook traffic
    prisma.biometricDevice.updateMany({
      where: { enabled: true },
      data: { status: "ONLINE", lastSeenAt: new Date(), lastError: null, lastPolledAt: new Date() },
    }).catch(() => {});

    const contentType = String(req.headers["content-type"] ?? "application/json");
    console.log(`[hikvision] push received (${contentType}, ${Buffer.isBuffer(req.body) ? req.body.length : JSON.stringify(req.body ?? {}).length} bytes)`);

    // Legacy gateway format: { fingerprint, timestamp, deviceId, verifyMode }.
    const obj = bodyAsObject(req.body);
    if (typeof obj.fingerprint === "string" && obj.fingerprint.trim()) {
      const event = await processBiometricScan(obj.fingerprint.trim(), obj.timestamp, obj.deviceId ?? null, obj.verifyMode);
      return res.json({
        success: true,
        acknowledged: true,
        data: { received: 1, processed: 1, results: [{ employeeNoString: obj.fingerprint, time: obj.timestamp ?? null, attendance: true, outcome: event.type, message: event.message }] },
      });
    }

    const parsed = parseHikPushPayload(req.body, contentType);
    const report = await processPushEvents(parsed.events, "hikvision:push");
    return res.json({
      success: true,
      acknowledged: parsed.acknowledged || report.received === 0,
      data: report,
    });
  } catch (error) {
    console.error("[hikvision:push] webhook error:", error);
    return res.status(500).json({ success: false, error: "Failed to process push event" });
  }
};

// ── HTTP Event Listening & Probe Handlers (POST / PUT / GET / HEAD / OPTIONS) ──

const handleWebhookProbe = (req: import("express").Request, res: import("express").Response) => {
  return res.status(200).json({
    success: true,
    status: "ONLINE",
    service: "Hikvision MinMoe Cloud Webhook Gateway",
    endpoint: "/api/hikvision/events",
    message: "Hikvision Webhook Gateway is active and ready to receive real-time attendance push events.",
    acceptedMethods: ["POST", "PUT", "GET", "HEAD", "OPTIONS"],
    acceptedFormats: ["JSON", "XML", "multipart/form-data", "application/x-www-form-urlencoded"],
    stats: getPushStats(),
  });
};

const webhookPaths = [
  "/events",
  "/event",
  "/upload",
  "/notification",
  "/EventNotificationAlert",
  "/EventNotification",
  "/alertStream",
  "/AcsEvent",
  "/",
  "",
];

// Handle Inbound Event Pushes (POST & PUT)
for (const p of webhookPaths) {
  router.post(p, handleWebhookEvents);
  router.put(p, handleWebhookEvents);
  router.get(p, handleWebhookProbe);
  router.head(p, handleWebhookProbe);
  router.options(p, (_req, res) => {
    res.setHeader("Allow", "GET, POST, PUT, HEAD, OPTIONS");
    res.status(200).end();
  });
}

// ── Webhook status (admin console) ──

router.get("/status", requireRole("ADMIN"), (req, res) => {
  return res.json({
    success: true,
    data: {
      webhookUrl: buildPushUrl(req),
      secretSet: Boolean(process.env.BIOMETRIC_SECRET),
      ...getPushStats(),
    },
  });
});

// ── Device HTTP Event Listening configuration ──

router.get("/devices/:id/http-listening", requireRole("ADMIN"), async (req, res) => {
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const hosts = await getHttpHosts(toConnection(device));
    const webhookUrl = buildPushUrl(req, device.host);
    const mine = hosts.filter((h) => sameWebhookPath(h.url, webhookUrl));

    return res.json({
      success: true,
      data: { webhookUrl, configured: mine.length > 0, hosts },
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message ?? "Failed to read push configuration" });
  }
});

router.post("/devices/:id/http-listening", requireRole("ADMIN"), async (req, res) => {
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const body = bodyAsObject(req.body);
    const format: "XML" | "JSON" = body.format === "JSON" ? "JSON" : "XML";
    const url = typeof body.url === "string" && body.url.trim() ? body.url.trim() : buildPushUrl(req, device.host);

    const result = await configureDevicePush(req.params.id, url, format);
    return res.json({ success: true, data: result });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message ?? "Failed to configure device push" });
  }
});

router.delete("/devices/:id/http-listening", requireRole("ADMIN"), async (req, res) => {
  try {
    const device = await prisma.biometricDevice.findUnique({ where: { id: req.params.id } });
    if (!device) return res.status(404).json({ success: false, error: "Device not found" });

    const hosts = await removeDevicePushUrl(req.params.id, buildPushUrl(req, device.host));
    return res.json({ success: true, data: { hosts } });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message ?? "Failed to remove push configuration" });
  }
});

export default router;