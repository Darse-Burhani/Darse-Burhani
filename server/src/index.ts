import "./env";
import { createApp } from "./app";
import { startMock } from "./lib/biometric";
import { startDevicePolling } from "./lib/hikvision";
import { startAttendanceScheduler } from "./lib/attendance-scheduler";
import prisma from "./lib/prisma";

const port = Number(process.env.PORT || 4000);
const host = "0.0.0.0";
const app = createApp();

// Process Level Crash Guards (Ensures system stays online under edge-case network anomalies)
process.on("uncaughtException", (err) => {
  console.error("[server:fatal] Uncaught Exception intercepted:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[server:fatal] Unhandled Promise Rejection at:", promise, "reason:", reason);
});

// If vite-node reloads this module, close the existing server before opening a new socket
if ((globalThis as any).__express_server) {
  try {
    (globalThis as any).__express_server.close();
  } catch {}
}

const server = app.listen(port, host, async () => {
  console.log(`[server] Vite-powered backend ready on http://127.0.0.1:${port}`);

  if (process.env.BIOMETRIC_MOCK === "true") {
    await startMock();
    console.log("[biometric] mock device simulator enabled");
  }

  startDevicePolling()
    .then(() => console.log("[hikvision] device poller started"))
    .catch((error) => console.error("[hikvision] failed to start device poller:", error));

  startAttendanceScheduler();
});

// Load Balancer & Socket Connection Tuning
// 65s Keep-Alive prevents race conditions with ALB / Cloudflare / Nginx 60s timeouts
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 30000; // 30s slowloris defense

(globalThis as any).__express_server = server;

// Graceful Shutdown Handler
function gracefulShutdown(signal: string) {
  console.log(`[server] ${signal} signal received: closing HTTP server gracefully`);
  server.close(async () => {
    console.log("[server] HTTP server closed");
    try {
      await prisma.$disconnect();
      console.log("[server] Database connection pool drained");
    } catch (err) {
      console.error("[server] Error disconnecting database:", err);
    }
    process.exit(0);
  });

  // Force close after 10s if connections fail to close
  setTimeout(() => {
    console.error("[server] Could not close connections in time, forcefully shutting down");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Vite-node HMR disposal
if ((import.meta as any).hot) {
  (import.meta as any).hot.dispose(() => {
    try {
      server.close();
    } catch {}
  });
}
