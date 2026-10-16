
import { Router, type Request, type Response } from "express";
import prisma from "./prisma";
import { cache } from "./cache";

const router = Router();
const startTime = Date.now();

/**
 * Lightweight liveness probe for Load Balancer health checks (AWS ALB, Nginx, K8s, GCP).
 */
export function livenessProbe(_req: Request, res: Response): void {
  res.status(200).json({
    status: "healthy",
    pid: process.pid,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
  });
}

/**
 * Comprehensive readiness probe (DB connection ping, memory, active cache keys).
 */
export async function readinessProbe(_req: Request, res: Response): Promise<void> {
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
    pid: process.pid,
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
    loadBalancer: {
      keepAliveTimeoutMs: 65000,
      headersTimeoutMs: 66000,
      healthy: isHealthy,
    },
  };

  res.status(isHealthy ? 200 : 503).json(responsePayload);
}

// GET /api/health - Lightweight liveness probe
router.get("/", livenessProbe);

// GET /api/health/ready - Comprehensive readiness probe
router.get("/ready", readinessProbe);

export default router;
