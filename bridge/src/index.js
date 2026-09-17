"use strict";

const { WebSocketServer, WebSocket } = require("ws");
const { HardwareDriver } = require("./driver");
const { SimulationDriver } = require("./simulator");

const PORT = Number(process.env.BRIDGE_PORT || 8080);
const HOST = process.env.BRIDGE_HOST || "127.0.0.1";
const DLL_PATH = process.env.HCSDK_DLL_PATH; // e.g. C:\Hikvision\HCNetSDK\bin\HCNetSDK.dll
const SIMULATE = process.env.SIMULATE_USB === "1";
const TIMEOUT_MS = Number(process.env.CAPTURE_TIMEOUT_MS || 20000);

function log(...args) {
  console.log(`[bridge ${new Date().toISOString()}]`, ...args);
}

async function createDriver() {
  if (!SIMULATE && DLL_PATH) {
    const driver = new HardwareDriver({ dllPath: DLL_PATH, timeoutMs: TIMEOUT_MS });
    const res = await driver.init();
    if (res.ok) {
      log("hardware mode:", res.reason);
      return driver;
    }
    log("hardware init failed — falling back to simulation:", res.reason);
  }
  const sim = new SimulationDriver();
  log("simulation mode (no hardware) — captured templates are synthetic.");
  log("Set HCSDK_DLL_PATH (and leave SIMULATE_USB unset) to use the real DS-K1F820-F.");
  return sim;
}

async function main() {
  const driver = await createDriver();
  let active = 0;

  const broadcast = (payload) => {
    const frame = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(frame);
    }
  };

  driver.on("status", (message) => {
    broadcast({ type: "event", status: "SCANNING", event: "scanning", message });
  });

  driver.on("template", ({ fingerID, templateData, quality }) => {
    active = 0;
    broadcast({ type: "event", status: "SUCCESS", event: "template", fingerID, templateData, quality });
  });

  driver.on("error", (message) => {
    active = 0;
    broadcast({ type: "event", status: "ERROR", event: "error", message });
  });

  driver.on("cancelled", () => {
    active = 0;
    broadcast({ type: "event", status: "CANCELLED", event: "cancelled" });
  });

  const wss = new WebSocketServer({ port: PORT, host: HOST }, () => {
    log(`listening on ws://${HOST}:${PORT} (${driver.mode} mode)`);
  });

  wss.on("connection", (socket) => {
    log("client connected");
    socket.send(
      JSON.stringify({
        type: "hello",
        version: 1,
        mode: driver.mode,
        model: driver.model,
        ready: true,
      }),
    );

    socket.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        socket.send(JSON.stringify({ type: "error", status: "ERROR", message: "Malformed JSON" }));
        return;
      }

      switch (msg.command) {
        case "START_ENROLLMENT":
          if (active > 0) {
            socket.send(JSON.stringify({ type: "event", status: "ERROR", event: "error", message: "An enrollment is already in progress" }));
            return;
          }
          active++;
          driver.startEnrollment(Number(msg.fingerID) || 1);
          break;

        case "CANCEL":
          driver.cancel();
          active = 0;
          socket.send(JSON.stringify({ type: "event", status: "CANCELLED", event: "cancelled" }));
          break;

        case "PING":
          socket.send(JSON.stringify({ type: "pong", ts: Date.now() }));
          break;

        case "STATUS":
          socket.send(JSON.stringify({ type: "status", device: driver.getInfo(), busy: active > 0 }));
          break;

        default:
          socket.send(JSON.stringify({ type: "error", status: "ERROR", message: "Unknown command" }));
      }
    });

    socket.on("close", () => {
      log("client disconnected");
      if (active > 0) {
        driver.cancel();
        active = 0;
      }
    });
  });

  process.on("SIGINT", async () => {
    await driver.dispose();
    wss.close(() => process.exit(0));
  });
}

main().catch((error) => {
  console.error("[bridge] fatal:", error);
  process.exit(1);
});