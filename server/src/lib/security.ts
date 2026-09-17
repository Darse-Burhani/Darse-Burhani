import type { Request, Response, NextFunction, RequestHandler } from "express";
import fs from "fs";
import path from "path";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  userName?: string;
  userRole?: string;
  action: string;
  category: "AUTH" | "ACCESS" | "DATA" | "ADMIN" | "POLICY" | "SECURITY";
  severity: "INFO" | "WARN" | "CRITICAL";
  status: "SUCCESS" | "FAILED" | "BLOCKED";
  ipAddress: string;
  userAgent?: string;
  details?: Record<string, unknown> | string;
}

export interface SecurityPolicyConfig {
  sessionTimeoutMinutes: number;
  inactivityLockMinutes: number;
  maxFailedLoginsBeforeLockout: number;
  lockoutDurationMinutes: number;
  requireStrongPassword: boolean;
  twoFactorEnforced: boolean;
  ipWhitelistEnabled: boolean;
  ipWhitelist: string[];
}

// Default in-memory security policies
let securityPolicies: SecurityPolicyConfig = {
  sessionTimeoutMinutes: 60 * 24 * 7, // 7 days
  inactivityLockMinutes: 15,
  maxFailedLoginsBeforeLockout: 5,
  lockoutDurationMinutes: 15,
  requireStrongPassword: true,
  twoFactorEnforced: false,
  ipWhitelistEnabled: false,
  ipWhitelist: ["127.0.0.1", "::1"],
};

// In-memory ring buffer for audit logs (most recent 1000 events)
const MAX_AUDIT_LOGS = 1000;
const auditLogs: AuditLogEntry[] = [
  {
    id: "log_init_001",
    timestamp: new Date().toISOString(),
    userEmail: "admin@darseburhani.edu",
    userName: "Admin System",
    userRole: "ADMIN",
    action: "SYSTEM_INITIALIZED",
    category: "SECURITY",
    severity: "INFO",
    status: "SUCCESS",
    ipAddress: "127.0.0.1",
    details: { message: "Security subsystem initialized and operational" },
  },
];

export function logAuditEvent(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
  const newEntry: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  auditLogs.unshift(newEntry);
  if (auditLogs.length > MAX_AUDIT_LOGS) {
    auditLogs.pop();
  }
  // Persist to file so logs survive restart
  try {
    const logDir = path.join(process.cwd(), "logs");
    fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, "audit.log"), JSON.stringify(newEntry) + "\n", "utf-8");
  } catch {}
  return newEntry;
}

export function getAuditLogs(filters?: {
  severity?: string;
  category?: string;
  status?: string;
  search?: string;
  limit?: number;
}): AuditLogEntry[] {
  let list = [...auditLogs];
  if (filters?.severity && filters.severity !== "ALL") {
    list = list.filter((l) => l.severity === filters.severity);
  }
  if (filters?.category && filters.category !== "ALL") {
    list = list.filter((l) => l.category === filters.category);
  }
  if (filters?.status && filters.status !== "ALL") {
    list = list.filter((l) => l.status === filters.status);
  }
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        (l.userEmail && l.userEmail.toLowerCase().includes(q)) ||
        (l.userName && l.userName.toLowerCase().includes(q)) ||
        l.ipAddress.includes(q)
    );
  }
  return list.slice(0, filters?.limit || 100);
}

export function getSecurityPolicies(): SecurityPolicyConfig {
  return { ...securityPolicies };
}

export function updateSecurityPolicies(updates: Partial<SecurityPolicyConfig>): SecurityPolicyConfig {
  securityPolicies = {
    ...securityPolicies,
    ...updates,
  };
  logAuditEvent({
    action: "SECURITY_POLICY_UPDATED",
    category: "POLICY",
    severity: "WARN",
    status: "SUCCESS",
    ipAddress: "127.0.0.1",
    details: { updatedKeys: Object.keys(updates) },
  });
  return securityPolicies;
}

// ── Rate Limiter & Brute-Force Shield ──

interface RateLimitRecord {
  count: number;
  firstRequestTime: number;
  lockedUntil?: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

// Clean up expired rate limiter keys every 5 minutes to prevent memory leak
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now - record.firstRequestTime > 300000 && (!record.lockedUntil || now > record.lockedUntil)) {
        rateLimitMap.delete(key);
      }
    }
  }, 300000);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

/**
 * Clear in-memory rate limiter maps (useful for testing or admin manual reset).
 */
export function resetRateLimits(): void {
  rateLimitMap.clear();
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || "127.0.0.1";
}

export interface RateLimiterOptions {
  isAuthLockout?: boolean;
}

/**
 * Creates a sliding-window rate limiting middleware.
 */
export function createRateLimiter(
  windowMs: number = 60000,
  maxRequests: number = 60,
  endpointKey: string = "general",
  options?: RateLimiterOptions
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const isDev = process.env.NODE_ENV !== "production";
    const isLocalhost =
      ip === "127.0.0.1" ||
      ip === "::1" ||
      ip === "::ffff:127.0.0.1" ||
      ip === "localhost";

    // In local development, bypass rate limits to avoid interfering with Vite HMR, session checks, and tests
    if (isDev && isLocalhost) {
      return next();
    }

    const key = `${endpointKey}:${ip}`;
    const now = Date.now();

    let record = rateLimitMap.get(key);

    if (!record) {
      record = { count: 1, firstRequestTime: now };
      rateLimitMap.set(key, record);
      return next();
    }

    // If the window has expired, reset counter and release any lock
    if (now - record.firstRequestTime > windowMs) {
      record.count = 1;
      record.firstRequestTime = now;
      record.lockedUntil = undefined;
      return next();
    }

    // If an explicit lockout is currently active
    if (record.lockedUntil && now < record.lockedUntil) {
      const waitSeconds = Math.max(1, Math.ceil((record.lockedUntil - now) / 1000));
      res.setHeader("Retry-After", waitSeconds);
      res.status(429).json({
        success: false,
        error: `Too many attempts. Temporarily locked. Try again in ${waitSeconds} seconds.`,
      });
      return;
    }

    record.count++;

    const effectiveMax = isDev ? maxRequests * 5 : maxRequests;

    if (record.count > effectiveMax) {
      const waitSeconds = options?.isAuthLockout
        ? securityPolicies.lockoutDurationMinutes * 60
        : Math.max(1, Math.ceil((record.firstRequestTime + windowMs - now) / 1000));

      if (options?.isAuthLockout) {
        record.lockedUntil = now + waitSeconds * 1000;
      }

      logAuditEvent({
        action: "RATE_LIMIT_EXCEEDED",
        category: "SECURITY",
        severity: options?.isAuthLockout ? "CRITICAL" : "WARN",
        status: "BLOCKED",
        ipAddress: ip,
        userAgent: req.headers["user-agent"],
        details: { endpoint: req.originalUrl, count: record.count, waitSeconds },
      });

      res.setHeader("Retry-After", waitSeconds);
      res.status(429).json({
        success: false,
        error: options?.isAuthLockout
          ? `Too many attempts. Temporarily locked for ${securityPolicies.lockoutDurationMinutes} minutes.`
          : `Rate limit exceeded. Try again in ${waitSeconds} seconds.`,
      });
      return;
    }

    next();
  };
}

/**
 * Global rate limiter to smooth load traffic across all incoming API requests (600 req/min/IP).
 */
export const globalApiRateLimiter = createRateLimiter(60000, 600, "global_api");

/**
 * Deep sanitization helper against prototype pollution, NULL bytes, and malicious injection keys.
 */
function sanitizeObject(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }

  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    // Block Prototype Pollution
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }

    let val = obj[key];
    if (typeof val === "string") {
      // Strip null bytes
      val = val.replace(/\0/g, "");
      // Neutralize unescaped script tags in user input strings
      val = val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    } else if (typeof val === "object" && val !== null) {
      val = sanitizeObject(val);
    }
    clean[key] = val;
  }
  return clean;
}

/**
 * Middleware: Input Sanitization & Anti-Injection Guard
 */
export function sanitizeInputsMiddleware(req: Request, _res: Response, next: NextFunction): void {
  try {
    if (req.body && typeof req.body === "object" && !(req.body instanceof Buffer)) {
      req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === "object") {
      req.query = sanitizeObject(req.query);
    }
    if (req.params && typeof req.params === "object") {
      req.params = sanitizeObject(req.params);
    }
  } catch (err) {
    console.warn("[security] sanitization warning:", err);
  }
  next();
}

/**
 * Security Headers Middleware (OWASP recommended defense in depth)
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Download-Options", "noopen");

  // Content-Security-Policy (allows safe self assets, data URIs, and styled fonts)
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' ws: wss:;"
  );

  // HSTS - only in production over HTTPS
  if (process.env.NODE_ENV === "production" && req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // Disable caching on sensitive API and Auth endpoints
  if (
    req.path.startsWith("/api/admin") ||
    req.path.startsWith("/api/auth") ||
    req.path.startsWith("/api/points")
  ) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
}

/**
 * Request timeout middleware (prevents Slowloris & hung requests from blocking connection pool)
 */
export function requestTimeoutMiddleware(timeoutMs: number = 30000): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: "Request timed out on server",
        });
      }
    }, timeoutMs);

    res.on("finish", () => clearTimeout(timer));
    res.on("close", () => clearTimeout(timer));
    next();
  };
}
