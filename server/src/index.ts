import "./env";
import cluster from "node:cluster";
import os from "node:os";
import { createApp } from "./app";
import { startMock } from "./lib/biometric";
import { startDevicePolling } from "./lib/hikvision";
import { startAttendanceScheduler } from "./lib/attendance-scheduler";
import prisma from "./lib/prisma";

const port = Number(process.env.PORT || 4000);
const host = "0.0.0.0";

// Process Level Crash Guards (Ensures system stays online under edge-case network anomalies)
process.on("uncaughtException", (err) => {
  console.error("[server:fatal] Uncaught Exception intercepted:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[server:fatal] Unhandled Promise Rejection at:", promise, "reason:", reason);
});

// Determine concurrency: In production cluster across available CPU cores (or WEB_CONCURRENCY)
const isDev = process.env.NODE_ENV !== "production" || process.env.DEV === "true";
const numCpus = typeof os.availableParallelism === "function" ? os.availableParallelism() : os.cpus().length;
const concurrency = Number(process.env.WEB_CONCURRENCY || (isDev ? 1 : Math.min(numCpus, 4)));
const useClustering = !isDev && concurrency > 1;

if (useClustering && cluster.isPrimary) {
  console.log(`[cluster:primary] Master PID ${process.pid} running. Multi-core Load Balancer active across ${concurrency} workers...`);

  // Start background singletons on master only to prevent redundant polling across workers
  const isCloud = Boolean(
    process.env.RENDER ||
    process.env.VERCEL ||
    process.env.DISABLE_DEVICE_POLLING === "true" ||
    (process.env.NODE_ENV === "production" && process.env.ENABLE_LAN_POLLING !== "true")
  );

  if (!isCloud) {
    startDevicePolling()
      .then(() => console.log("[hikvision] device poller started on cluster primary"))
      .catch((error) => console.error("[hikvision] failed to start device poller:", error));
  } else {
    console.log("[hikvision] Cloud deployment detected (Render/Production): Full-time LAN polling disabled. Event-driven webhook push listening active on /api/hikvision/events.");
  }
  startAttendanceScheduler();

  // Fork worker processes
  for (let i = 0; i < concurrency; i++) {
    const worker = cluster.fork();
    console.log(`[cluster:primary] Worker ${worker.process.pid} spawned (Index ${i + 1}/${concurrency})`);
  }

  // Auto-recovery: If any worker process exits, automatically spawn a replacement
  cluster.on("exit", (worker, code, signal) => {
    console.warn(`[cluster:primary] Worker PID ${worker.process.pid} died (code: ${code}, signal: ${signal}). Auto-healing and respawning new worker...`);
    const newWorker = cluster.fork();
    console.log(`[cluster:primary] Replacement worker PID ${newWorker.process.pid} is now active.`);
  });

  // Graceful cluster shutdown
  const handleClusterShutdown = (signal: string) => {
    console.log(`[cluster:primary] ${signal} received: shutting down all workers gracefully`);
    for (const id in cluster.workers) {
      cluster.workers[id]?.process.kill(signal as NodeJS.Signals);
    }
    setTimeout(() => {
      console.log("[cluster:primary] All workers exited. Exiting primary process.");
      process.exit(0);
    }, 3000).unref();
  };

  process.on("SIGTERM", () => handleClusterShutdown("SIGTERM"));
  process.on("SIGINT", () => handleClusterShutdown("SIGINT"));

} else {
  // Worker process (or single-process in dev mode)
  const app = createApp();

  if ((globalThis as any).__express_server) {
    try {
      (globalThis as any).__express_server.close();
    } catch {}
  }

  const server = app.listen(port, host, async () => {
    const workerPrefix = useClustering ? `[worker:${process.pid}]` : `[server]`;
    console.log(`${workerPrefix} High-performance backend ready on http://127.0.0.1:${port}`);

    // If running in single-process mode, run background singletons here
    if (!useClustering) {
      if (process.env.BIOMETRIC_MOCK === "true") {
        await startMock();
        console.log("[biometric] mock device simulator enabled");
      }

      const isCloud = Boolean(
        process.env.RENDER ||
        process.env.VERCEL ||
        process.env.DISABLE_DEVICE_POLLING === "true" ||
        (process.env.NODE_ENV === "production" && process.env.ENABLE_LAN_POLLING !== "true")
      );

      if (!isCloud) {
        startDevicePolling()
          .then(() => console.log("[hikvision] device poller started"))
          .catch((error) => console.error("[hikvision] failed to start device poller:", error));
      } else {
        console.log("[hikvision] Cloud deployment detected (Render/Production): Full-time LAN polling disabled. Event-driven webhook push listening active on /api/hikvision/events.");
      }

      startAttendanceScheduler();
    }
  });

  // Socket & Load Balancer Tuning
  // 50,000 max connections, 65s keep-alive timeout
  server.maxConnections = 50000;
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.requestTimeout = 30000;

  (globalThis as any).__express_server = server;

  function gracefulShutdown(signal: string) {
    const workerPrefix = useClustering ? `[worker:${process.pid}]` : `[server]`;
    console.log(`${workerPrefix} ${signal} signal received: closing HTTP server gracefully`);
    server.close(async () => {
      console.log(`${workerPrefix} HTTP server closed`);
      try {
        await prisma.$disconnect();
        console.log(`${workerPrefix} Database connection pool drained`);
      } catch (err) {
        console.error(`${workerPrefix} Error disconnecting database:`, err);
      }
      process.exit(0);
    });

    setTimeout(() => {
      console.error(`${workerPrefix} Forcefully shutting down`);
      process.exit(1);
    }, 10000).unref();
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));

  if ((import.meta as any).hot) {
    (import.meta as any).hot.dispose(() => {
      try {
        server.close();
      } catch {}
    });
  }
}
