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

export interface TokenBucketRecord {
  tokens: number;
  lastRefillTime: number;
  capacity: number;
  refillRatePerMs: number;
  lockedUntil?: number;
  totalRequests: number;
}

const rateLimitMap = new Map<string, TokenBucketRecord>();

// Clean up expired rate limiter keys every 5 minutes to prevent memory leak
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now - record.lastRefillTime > 300000 && (!record.lockedUntil || now > record.lockedUntil)) {
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

/**
 * Diagnostic helper to inspect active rate limit buckets and overall load status.
 */
export function getRateLimitStats(): {
  totalTrackedClients: number;
  activeBuckets: Array<{ key: string; tokens: number; capacity: number; totalRequests: number; locked: boolean }>;
} {
  const active: Array<{ key: string; tokens: number; capacity: number; totalRequests: number; locked: boolean }> = [];
  const now = Date.now();
  for (const [key, b] of rateLimitMap.entries()) {
    active.push({
      key,
      tokens: Math.round(b.tokens * 100) / 100,
      capacity: Math.round(b.capacity),
      totalRequests: b.totalRequests,
      locked: Boolean(b.lockedUntil && now < b.lockedUntil),
    });
    if (active.length >= 100) break;
  }
  return {
    totalTrackedClients: rateLimitMap.size,
    activeBuckets: active,
  };
}

/**
 * Multi-tier Reverse Proxy & CDN Client IP Resolution.
 * Supports Cloudflare, Akamai, AWS ALB, Nginx, Caddy, GCP, Render, Vercel, and direct connections.
 */
export function getClientIp(req: Request): string {
  // 1. Cloudflare CDN / Edge Proxy
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) {
    return cfIp.trim().replace(/^::ffff:/, "");
  }

  // 2. Akamai / Cloudflare True-Client-IP
  const trueClientIp = req.headers["true-client-ip"];
  if (typeof trueClientIp === "string" && trueClientIp.trim()) {
    return trueClientIp.trim().replace(/^::ffff:/, "");
  }

  // 3. Nginx / Traefik / Caddy Forwarded Real IP
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return realIp.trim().replace(/^::ffff:/, "");
  }

  // 4. Standard X-Forwarded-For chain: client, proxy1, proxy2...
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    const ips = forwarded
      .split(",")
      .map((item) => item.trim().replace(/^::ffff:/, ""))
      .filter(Boolean);
    if (ips.length > 0) {
      return ips[0];
    }
  }

  // 5. Express 'trust proxy' resolved IP
  if (req.ip) {
    return req.ip.replace(/^::ffff:/, "");
  }

  // 6. Direct socket remote address fallback
  const socketIp = req.socket?.remoteAddress;
  if (socketIp) {
    return socketIp.replace(/^::ffff:/, "");
  }

  return "127.0.0.1";
}

export interface RateLimiterOptions {
  isAuthLockout?: boolean;
  burstMultiplier?: number;
  roleMultipliers?: Record<string, number>;
}

/**
 * Calculates adaptive role multiplier so active staff (Admin, Teacher) operate with fluid headroom.
 */
function getRoleMultiplier(req: Request, customMultipliers?: Record<string, number>): number {
  const user = (req as any).auth?.user || (req as any).session?.user || (req as any).user;
  const role = String(user?.role || "").toUpperCase();

  if (customMultipliers && customMultipliers[role]) {
    return customMultipliers[role];
  }

  switch (role) {
    case "ADMIN":
    case "SUPER_ADMIN":
      return 10.0; // 10x headroom for administrative operations, reports & directory sweeps
    case "TEACHER":
    case "FACULTY":
      return 5.0; // 5x headroom for class management, live grading & attendance sweeps
    case "STUDENT":
    case "TALABAT":
    case "PARENT":
      return 2.5; // 2.5x headroom for authenticated portal users
    default:
      return 1.0; // 1x baseline for anonymous / guest visitors
  }
}

/**
 * Checks if request is an internal background poll or health check that should not deplete the interactive user click budget.
 */
function isBackgroundOrSilentRequest(req: Request): boolean {
  if (req.method === "OPTIONS" || req.method === "HEAD") return true;

  if (req.query?.silent === "true" || req.query?.background === "true") return true;

  const bgHeader = req.headers["x-background-sync"] || req.headers["x-silent"] || req.headers["x-poll"];
  if (bgHeader === "true" || bgHeader === "1") return true;

  const path = req.path || req.originalUrl || "";
  if (
    path.startsWith("/healthz") ||
    path.startsWith("/readyz") ||
    path.startsWith("/livez") ||
    path.startsWith("/ping") ||
    path === "/api/health" ||
    path === "/api/health/ready" ||
    path === "/api/auth/session"
  ) {
    return true;
  }

  return false;
}

/**
 * Fluent Token Bucket Rate Limiter with burst capacity, role scaling, leaky refill, and RFC 6585 headers.
 */
export function createRateLimiter(
  windowMs: number = 60000,
  maxRequests: number = 60,
  endpointKey: string = "general",
  options?: RateLimiterOptions
): RequestHandler {
  const isDev = process.env.NODE_ENV !== "production";
  const burstMultiplier = options?.burstMultiplier ?? 1.5;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // 1. Bypass background silent polls, preflights, and health probes
      if (isBackgroundOrSilentRequest(req)) {
        return next();
      }

      const ip = getClientIp(req);
      const cleanIp = ip.replace(/^::ffff:/, "").trim();
      const isLocalOrPrivate =
        cleanIp === "127.0.0.1" ||
        cleanIp === "::1" ||
        cleanIp === "localhost" ||
        cleanIp === "0.0.0.0" ||
        cleanIp.startsWith("10.") ||
        cleanIp.startsWith("192.168.") ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(cleanIp);

      // In local development, bypass rate limits for local/private IPs to avoid interfering with Vite HMR, session checks, and tests
      if (isDev && isLocalOrPrivate) {
        return next();
      }

      // 2. Identify client by authenticated user ID if present, otherwise by resolved IP
      const userId = (req as any).auth?.user?.id || (req as any).session?.user?.id;
      const clientIdentifier = userId ? `user_${userId}` : ip;
      const key = `${endpointKey}:${clientIdentifier}`;
      const now = Date.now();

      // 3. Compute dynamic capacity & refill rate based on role and environment
      const roleMult = getRoleMultiplier(req, options?.roleMultipliers);
      const devMult = isDev ? 5.0 : 1.0;
      const effectiveMaxRequests = maxRequests * roleMult * devMult;

      const baseRefillRatePerMs = effectiveMaxRequests / windowMs;
      const targetCapacity = Math.max(10, Math.round(effectiveMaxRequests * burstMultiplier));

      let record = rateLimitMap.get(key);

      if (!record) {
        record = {
          tokens: targetCapacity - 1, // deduct initial request
          lastRefillTime: now,
          capacity: targetCapacity,
          refillRatePerMs: baseRefillRatePerMs,
          totalRequests: 1,
        };
        rateLimitMap.set(key, record);

        // Standard RFC 6585 & X-RateLimit headers
        res.setHeader("X-RateLimit-Limit", Math.round(record.capacity));
        res.setHeader("X-RateLimit-Remaining", Math.max(0, Math.floor(record.tokens)));
        res.setHeader("X-RateLimit-Reset", 1);
        res.setHeader("RateLimit-Limit", Math.round(record.capacity));
        res.setHeader("RateLimit-Remaining", Math.max(0, Math.floor(record.tokens)));
        res.setHeader("RateLimit-Reset", 1);
        return next();
      }

      // Dynamically upgrade capacity if user authenticated mid-session
      if (targetCapacity > record.capacity) {
        record.capacity = targetCapacity;
        record.refillRatePerMs = baseRefillRatePerMs;
      }

      // 4. Smooth Leaky Token Refill (adds tokens based on exact elapsed milliseconds)
      const elapsedMs = Math.max(0, now - record.lastRefillTime);
      record.tokens = Math.min(record.capacity, record.tokens + elapsedMs * record.refillRatePerMs);
      record.lastRefillTime = now;

      // 5. Check if under explicit brute-force lockout
      if (record.lockedUntil && now < record.lockedUntil) {
        const waitSeconds = Math.max(1, Math.ceil((record.lockedUntil - now) / 1000));
        res.setHeader("Retry-After", waitSeconds);
        res.setHeader("X-RateLimit-Limit", Math.round(record.capacity));
        res.setHeader("X-RateLimit-Remaining", 0);
        res.setHeader("X-RateLimit-Reset", waitSeconds);
        res.status(429).json({
          success: false,
          error: `Too many attempts. Temporarily locked for security. Try again in ${waitSeconds} seconds.`,
          retryAfterSeconds: waitSeconds,
        });
        return;
      }

      // 6. Token availability check
      if (record.tokens >= 1.0) {
        record.tokens -= 1.0;
        record.totalRequests++;

        const timeToFullSeconds = Math.max(
          1,
          Math.ceil((record.capacity - record.tokens) / (record.refillRatePerMs * 1000))
        );

        res.setHeader("X-RateLimit-Limit", Math.round(record.capacity));
        res.setHeader("X-RateLimit-Remaining", Math.max(0, Math.floor(record.tokens)));
        res.setHeader("X-RateLimit-Reset", timeToFullSeconds);
        res.setHeader("RateLimit-Limit", Math.round(record.capacity));
        res.setHeader("RateLimit-Remaining", Math.max(0, Math.floor(record.tokens)));
        res.setHeader("RateLimit-Reset", timeToFullSeconds);
        return next();
      }

      // 7. Rate limit exceeded (Token bucket starved)
      const tokensNeeded = 1.0 - record.tokens;
      const waitMs = Math.ceil(tokensNeeded / record.refillRatePerMs);
      const waitSeconds = Math.max(1, Math.ceil(waitMs / 1000));

      if (options?.isAuthLockout) {
        record.lockedUntil = now + securityPolicies.lockoutDurationMinutes * 60000;
      }

      logAuditEvent({
        action: "RATE_LIMIT_EXCEEDED",
        category: "SECURITY",
        severity: options?.isAuthLockout ? "CRITICAL" : "WARN",
        status: "BLOCKED",
        ipAddress: ip,
        userAgent: req.headers["user-agent"],
        details: {
          endpoint: req.originalUrl,
          key,
          waitSeconds,
          capacity: record.capacity,
          tokens: record.tokens,
        },
      });

      res.setHeader("Retry-After", waitSeconds);
      res.setHeader("X-RateLimit-Limit", Math.round(record.capacity));
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", waitSeconds);
      res.setHeader("RateLimit-Limit", Math.round(record.capacity));
      res.setHeader("RateLimit-Remaining", 0);
      res.setHeader("RateLimit-Reset", waitSeconds);

      res.status(429).json({
        success: false,
        error: options?.isAuthLockout
          ? `Too many attempts. Temporarily locked for ${securityPolicies.lockoutDurationMinutes} minutes.`
          : `Traffic smoothed: please ease request pace. Retry in ${waitSeconds}s.`,
        retryAfterSeconds: waitSeconds,
        burstCapacity: Math.round(record.capacity),
        remainingTokens: 0,
      });
      return;
    } catch (limiterErr) {
      console.warn("[rate-limiter] error during check, failing open:", limiterErr);
      next();
    }
  };
}

/**
 * Global rate limiter to smooth load traffic across all incoming API requests (Default: 15,000 req/min for 5000+ users).
 */
const globalRateLimitMax = Number(process.env.RATE_LIMIT_GLOBAL_MAX || 15000);
export const globalApiRateLimiter = createRateLimiter(60000, globalRateLimitMax, "global_api");

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
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Anti-clickjacking
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  // Legacy XSS filter enforcement
  res.setHeader("X-XSS-Protection", "1; mode=block");
  // Referrer leakage prevention
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Feature/Permissions policy
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()"
  );
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("X-Download-Options", "noopen");
  // Cross-Origin Isolation policies
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  // Content-Security-Policy (allows safe self assets, data URIs, WebSockets, and Google Fonts)
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' ws: wss:; frame-ancestors 'self';"
  );

  // HSTS - in production or when connection is secure
  if (process.env.NODE_ENV === "production" || req.secure) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  // Disable caching on sensitive API and Auth endpoints
  if (
    req.path.startsWith("/api/admin") ||
    req.path.startsWith("/api/auth") ||
    req.path.startsWith("/api/points") ||
    req.path.startsWith("/api/talabat") ||
    req.path.startsWith("/api/teacher") ||
    req.path.startsWith("/api/parent")
  ) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
}

/**
 * CSRF & Origin Guard Middleware
 * Validates Origin/Referer on state-modifying requests (POST/PUT/PATCH/DELETE) to prevent cross-site request forgery.
 */
export function csrfGuardMiddleware(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  // Safe HTTP methods do not change state
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  // Exempt external hardware bridges and webhooks that use custom auth or API signatures
  const path = req.path;
  if (
    path.startsWith("/api/hikvision") ||
    path.startsWith("/api/events") ||
    path.startsWith("/api/biometric") ||
    path.startsWith("/api/dev-access")
  ) {
    return next();
  }

  // If request has Authorization: Bearer token, it is a protected API client call
  if (req.headers.authorization?.startsWith("Bearer ")) {
    return next();
  }

  const origin = req.headers["origin"] || req.headers["referer"];
  if (origin && typeof origin === "string") {
    try {
      const originUrl = new URL(origin);
      const hostHeader = req.headers["host"] || "";
      const hostWithoutPort = hostHeader.split(":")[0];
      const originHostWithoutPort = originUrl.hostname;

      // Allow same host or localhost origins
      const isSameHost = originHostWithoutPort === hostWithoutPort;
      const isLocalhost =
        originHostWithoutPort === "localhost" ||
        originHostWithoutPort === "127.0.0.1" ||
        originHostWithoutPort === "::1";

      if (!isSameHost && !isLocalhost && process.env.NODE_ENV === "production") {
        logAuditEvent({
          action: "CSRF_ORIGIN_BLOCKED",
          category: "SECURITY",
          severity: "CRITICAL",
          status: "BLOCKED",
          ipAddress: getClientIp(req),
          userAgent: req.headers["user-agent"],
          details: { origin, hostHeader, path: req.originalUrl },
        });

        res.status(403).json({
          success: false,
          error: "Cross-Origin Request Blocked: Origin verification failed.",
        });
        return;
      }
    } catch {
      // Invalid URL format in Origin/Referer header
      res.status(400).json({ success: false, error: "Invalid Origin header format" });
      return;
    }
  }

  next();
}

/**
 * Sensitive Data Log Redactor
 * Strips passwords, secrets, JWT tokens, and sensitive personal identity numbers before logging.
 */
export function sanitizeForLogs(data: any, depth = 0): any {
  if (depth > 5 || !data) return data;
  if (typeof data === "string") {
    // Redact JWT tokens
    if (/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(data) && data.length > 30) {
      return "[REDACTED_JWT_TOKEN]";
    }
    // Redact Bearer tokens
    if (data.toLowerCase().startsWith("bearer ")) {
      return "Bearer [REDACTED]";
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForLogs(item, depth + 1));
  }
  if (typeof data === "object") {
    const sensitiveKeys = new Set([
      "password",
      "passwordhash",
      "plainpassword",
      "currentpassword",
      "newpassword",
      "secret",
      "biometricsecret",
      "token",
      "authorization",
      "cookie",
      "refreshtoken",
      "accesstoken",
      "privatekey",
      "serviceaccountjson",
    ]);
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      const lowerKey = k.toLowerCase().replace(/[-_]/g, "");
      if (sensitiveKeys.has(lowerKey)) {
        clean[k] = "[REDACTED]";
      } else {
        clean[k] = sanitizeForLogs(v, depth + 1);
      }
    }
    return clean;
  }
  return data;
}

/**
 * Strict CORS Guard Middleware
 * Restricts cross-origin requests to explicit whitelist and strictly disallows wildcard '*' when credentials/cookies are active.
 */
export function corsGuardMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const isDev = process.env.NODE_ENV !== "production";

  const allowedOrigins = new Set([
    "http://localhost:3000",
    "http://localhost:4000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:4000",
  ]);

  if (process.env.APP_URL) allowedOrigins.add(process.env.APP_URL.replace(/\/+$/, ""));
  if (process.env.PUBLIC_APP_URL) allowedOrigins.add(process.env.PUBLIC_APP_URL.replace(/\/+$/, ""));
  if (process.env.NEXTAUTH_URL) allowedOrigins.add(process.env.NEXTAUTH_URL.replace(/\/+$/, ""));

  if (origin && typeof origin === "string") {
    const isAllowed = allowedOrigins.has(origin) || (isDev && origin.includes("localhost"));
    if (isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Biometric-Secret"
      );
    }
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
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


