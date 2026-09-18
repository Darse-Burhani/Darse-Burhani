
import prisma from "./prisma";
import { cache } from "./cache";

const router = Router();

const startTime = Date.now();

// GET /api/health - Lightweight liveness probe (for load balancer health checks)
router.get("/", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
  });
});

// GET /api/health/ready - Comprehensive readiness probe (DB connection, memory, load state)
router.get("/ready", async (_req, res) => {
  const checkStart = Date.now();
  let dbStatus = "connected";
  let dbLatencyMs = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - dbStart;
  } catch (err: any) {
    dbStatus = `error: ${err.message || "failed to connect"}`;
  }

  const memory = process.memoryUsage();
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const isHealthy = dbStatus === "connected";

  const responsePayload = {
    status: isHealthy ? "ready" : "degraded",
    timestamp: new Date().toISOString(),
    uptimeSeconds: uptime,
    checkDurationMs: Date.now() - checkStart,
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs,
    },
    system: {
      memory: {
        rssMb: Math.round(memory.rss / (1024 * 1024)),
        heapUsedMb: Math.round(memory.heapUsed / (1024 * 1024)),
        heapTotalMb: Math.round(memory.heapTotal / (1024 * 1024)),
        externalMb: Math.round(memory.external / (1024 * 1024)),
      },
      cache: {
        activeKeys: cache.size,
      },
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
    },
  };

  res.status(isHealthy ? 200 : 503).json(responsePayload);
});

export default router;
