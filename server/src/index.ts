import "./env";
import cluster from "node:cluster";
import os from "node:os";
import { createApp } from "./app";
import { startMock } from "./lib/biometric";
import { startDevicePolling } from "./lib/hikvision";
import { startAttendanceScheduler } from "./lib/attendance-scheduler";
import { syncMasterTimetableIfEmpty } from "./lib/timetable-master-sync";
import { loadSheetConfigFromDb } from "./lib/google-attendance-sync";
import { initWhatsAppBaileys } from "./lib/whatsapp-baileys";
import prisma from "./lib/prisma";

// Pre-load Google Sheets configuration from database
loadSheetConfigFromDb().catch((err) =>
  console.warn("[google-sheets] Startup config load notice:", (err as any)?.message || err)
);

// Initialize 24/7 Cloud WhatsApp Gateway
initWhatsAppBaileys().catch((err) =>
  console.warn("[whatsapp] Background engine startup notice:", (err as any)?.message || err)
);

// Ensure Tilawat al Dua schedule window applies to BOTH Faculty & Talabat:
// 1. No restrictive class filters — every talab is covered
// 2. Audience is locked to BOTH so faculty and talabat both scan the same event
prisma.biometricScanWindow.updateMany({
  where: {
    OR: [
      { id: "default" },
      { name: { contains: "Tilawat", mode: "insensitive" } },
    ],
  },
  data: { applicableClassIds: [] },
}).catch((err) => console.warn("[startup] Scan window initialization notice:", (err as any)?.message || err));

prisma.biometricScanWindow
  .findMany({
    where: {
      OR: [
        { id: "default" },
        { name: { contains: "Tilawat", mode: "insensitive" } },
      ],
    },
  })
  .then(async (tilawatWindows) => {
    for (const w of tilawatWindows) {
      const exempt = Array.isArray((w as any).exemptStudentIds) ? ((w as any).exemptStudentIds as string[]) : [];
      const hasAudienceTag = exempt.some((t) => t.startsWith("AUDIENCE_"));
      if (hasAudienceTag && !exempt.includes("AUDIENCE_BOTH")) {
        // Force Tilawat to BOTH: drop any faculty-only / student-only audience tag
        await prisma.biometricScanWindow.update({
          where: { id: w.id },
          data: {
            exemptStudentIds: [...exempt.filter((t) => !t.startsWith("AUDIENCE_")), "AUDIENCE_BOTH"],
          },
        }).catch(() => {});
      } else if (!hasAudienceTag) {
        await prisma.biometricScanWindow.update({
          where: { id: w.id },
          data: { exemptStudentIds: [...exempt, "AUDIENCE_BOTH"] },
        }).catch(() => {});
      }

      // Self-heal the late zone. The event used to be created with
      // lateEndTime === endTime, which makes LATE unreachable: every scan after
      // the on-time boundary fell outside the window and was never recorded.
      // Give such events a 45-minute late window so present / late / absent are
      // all derivable from scan timing. Admin-set wider late zones are kept.
      const toMin = (t?: string | null) => {
        if (!t) return null;
        const [h, m] = t.split(":").map((n) => parseInt(n, 10));
        return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
      };
      const formatMin = (total: number) =>
        `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

      const endMin = toMin(w.endTime);
      const lateEndMin = toMin((w as any).lateEndTime);
      const patch: Record<string, string> = {};
      if (endMin !== null && (lateEndMin === null || lateEndMin <= endMin)) {
        patch.lateEndTime = formatMin(Math.min(23 * 60 + 59, endMin + 45));
      }

      // Same fix for the faculty timer of dual-audience events.
      const facEndMin = toMin((w as any).facultyEndTime);
      const facLateEndMin = toMin((w as any).facultyLateEndTime);
      if (facEndMin !== null && (facLateEndMin === null || facLateEndMin <= facEndMin)) {
        patch.facultyLateEndTime = formatMin(Math.min(23 * 60 + 59, facEndMin + 45));
      }

      if (Object.keys(patch).length > 0) {
        await prisma.biometricScanWindow.update({
          where: { id: w.id },
          data: patch as any,
        }).catch(() => {});
      }
    }
  })
  .catch((err) => console.warn("[startup] Tilawat audience normalization notice:", (err as any)?.message || err));

const port = Number(process.env.PORT || 4000);
const host = "0.0.0.0";

// Process Level Crash Guards (Ensures system stays online under edge-case network anomalies)
process.on("uncaughtException", (err) => {
  console.error("[server:fatal] Uncaught Exception intercepted:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[server:fatal] Unhandled Promise Rejection at:", promise, "reason:", reason);
});

// Determine concurrency: On cloud platforms with connection pool limits (e.g. Supabase max 15 clients),
// default to single-process (concurrency 1) to prevent worker processes from multiplying connection pools.
const isDev = process.env.NODE_ENV !== "production" || process.env.DEV === "true";
const isCloud = Boolean(
  process.env.RENDER ||
  process.env.VERCEL ||
  process.env.FLY_APP_NAME ||
  process.env.RAILWAY_ENVIRONMENT ||
  process.env.NORTHFLANK ||
  process.env.DOCKER_CONTAINER ||
  process.env.PORT
);
const defaultConcurrency = 1;
const concurrency = Number(process.env.WEB_CONCURRENCY || defaultConcurrency);
const useClustering = !isDev && concurrency > 1;

if (useClustering && cluster.isPrimary) {
  console.log(`[cluster:primary] Master PID ${process.pid} running. Multi-core Load Balancer active across ${concurrency} workers...`);


  // Start background singletons on master only to prevent redundant polling across workers
  const isPollingCloud = Boolean(
    process.env.DISABLE_DEVICE_POLLING === "true" ||
    ((isCloud || process.env.RENDER || process.env.VERCEL) && process.env.ENABLE_LAN_POLLING !== "true")
  );

  if (!isPollingCloud) {
    startDevicePolling()
      .then(() => console.log("[hikvision] device poller started on cluster primary"))
      .catch((error) => console.error("[hikvision] failed to start device poller:", error));
  } else {
    console.log("[hikvision] Cloud deployment detected (Render/Production): Full-time LAN polling disabled. Event-driven webhook push listening active on /api/hikvision/events.");
  }
  startAttendanceScheduler();
  syncMasterTimetableIfEmpty().catch((err) =>
    console.warn("[timetable:startup] Master timetable auto-sync notice:", (err as any)?.message || err)
  );

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
    console.log(
      `${workerPrefix} Load balancer ready on http://127.0.0.1:${port} (Keep-Alive: 65s, Headers-Timeout: 66s, Max-Conn: 50,000)`
    );

    // If running in single-process mode, run background singletons here
    if (!useClustering) {
      if (process.env.BIOMETRIC_MOCK === "true") {
        try {
          await startMock();
          console.log("[biometric] mock device simulator enabled");
        } catch (error) {
          console.warn("[biometric] mock device startup warning:", (error as any)?.message || error);
        }
      }

      const isCloudDeployment = Boolean(
        process.env.DISABLE_DEVICE_POLLING === "true" ||
        ((isCloud || process.env.RENDER || process.env.VERCEL || process.env.NORTHFLANK || process.env.NODE_ENV === "production") &&
          process.env.ENABLE_LAN_POLLING !== "true")
      );

      if (!isCloudDeployment) {
        startDevicePolling()
          .then(() => console.log("[hikvision] device poller started"))
          .catch((error) => console.error("[hikvision] failed to start device poller:", error));
      } else {
        console.log("[hikvision] Cloud deployment detected (Render/Production): Full-time LAN polling disabled. Event-driven webhook push listening active on /api/hikvision/events.");
      }

      startAttendanceScheduler();
      syncMasterTimetableIfEmpty().catch((err) =>
        console.warn("[timetable:startup] Master timetable auto-sync notice:", (err as any)?.message || err)
      );
    }
  });

  // Socket & Load Balancer Tuning
  // 50,000 max connections, 65s keep-alive timeout, 120s request timeout to prevent 504 gateway timeouts on heavy/cold requests
  server.maxConnections = 50000;
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 125000;
  server.requestTimeout = 120000;

  // Bind errors (EADDRINUSE / EACCES) are emitted on the server, not thrown.
  // Without this handler they surface as an uncaughtException, which the
  // process-level guard above logs and swallows — leaving a "running" process
  // that never accepts a single connection. Fail fast instead so the dev
  // watcher / process manager can restart on a free port.
  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `[server] Port ${port} is already in use. Free it (e.g. \`netstat -ano | findstr :${port}\`) ` +
          `or start with PORT=<other-port>.`
      );
    } else if (error.code === "EACCES") {
      console.error(`[server] Not permitted to bind port ${port}. Use a port above 1024 or run with elevation.`);
    } else {
      console.error("[server] HTTP server failed to start:", error);
    }
    process.exit(1);
  });

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
