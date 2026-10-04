import type { Request, Response, NextFunction, RequestHandler } from "express";
import { logAuditEvent, getClientIp } from "./security";

// ── Threat Categories & Severity ──
export type ThreatCategory =
  | "SQL_INJECTION"
  | "XSS_ATTACK"
  | "COMMAND_INJECTION"
  | "PATH_TRAVERSAL"
  | "MALICIOUS_BOT"
  | "PROTOTYPE_POLLUTION"
  | "HEADER_INJECTION"
  | "SUSPICIOUS_PAYLOAD"
  | "CSRF_ORIGIN_VIOLATION";

export interface BlockedAttackEvent {
  id: string;
  timestamp: string;
  ip: string;
  method: string;
  url: string;
  category: ThreatCategory;
  rule: string;
  matchedValue: string;
  userAgent?: string;
  threatScore: number;
}

export interface BannedIpInfo {
  ip: string;
  bannedAt: number;
  expiresAt: number;
  reason: string;
  threatScore: number;
  totalViolations: number;
}

export interface WafStats {
  totalRequestsChecked: number;
  totalAttacksBlocked: number;
  blockedByCategory: Record<ThreatCategory, number>;
  activeBannedIpsCount: number;
  recentAttacks: BlockedAttackEvent[];
}

// ── In-Memory Threat Tracking & State ──
const MAX_ATTACK_LOGS = 500;
const attackLogs: BlockedAttackEvent[] = [];

// Map of IP -> { score: number, violations: number, lastSeen: number }
const ipThreatScores = new Map<string, { score: number; violations: number; lastSeen: number }>();

// Map of IP -> BannedIpInfo
const bannedIps = new Map<string, BannedIpInfo>();

// Explicit Manual Whitelist & Blacklist
const manualWhitelist = new Set<string>(["127.0.0.1", "::1", "::ffff:127.0.0.1", "localhost"]);
const manualBlacklist = new Set<string>();

// Global WAF Counters
let totalRequestsChecked = 0;
let totalAttacksBlocked = 0;
const blockedByCategory: Record<ThreatCategory, number> = {
  SQL_INJECTION: 0,
  XSS_ATTACK: 0,
  COMMAND_INJECTION: 0,
  PATH_TRAVERSAL: 0,
  MALICIOUS_BOT: 0,
  PROTOTYPE_POLLUTION: 0,
  HEADER_INJECTION: 0,
  SUSPICIOUS_PAYLOAD: 0,
  CSRF_ORIGIN_VIOLATION: 0,
};

// Periodic cleanup of expired bans & inactive threat scores (every 5 minutes)
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    // Cleanup expired IP bans
    for (const [ip, info] of bannedIps.entries()) {
      if (now > info.expiresAt && !manualBlacklist.has(ip)) {
        bannedIps.delete(ip);
      }
    }
    // Decay threat scores older than 30 minutes
    for (const [ip, data] of ipThreatScores.entries()) {
      if (now - data.lastSeen > 30 * 60 * 1000) {
        ipThreatScores.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref();
}

// ── High-Precision Detection Rules ──

// 1. SQL Injection Patterns
const SQLI_PATTERNS: Array<{ regex: RegExp; name: string; score: number }> = [
  { regex: /(\bUNION\b\s+(?:ALL\s+)?\bSELECT\b)/i, name: "UNION_SELECT_INJECTION", score: 100 },
  { regex: /(?:\b(?:SELECT|UPDATE|INSERT|DELETE|DROP|ALTER|CREATE|TRUNCATE)\b\s+.*\bFROM\b\s+[\w\.\"\`]+)/i, name: "SQL_SUBQUERY_INJECTION", score: 90 },
  { regex: /(\bOR\b\s+['"\d\w]+\s*=\s*['"\d\w]+)/i, name: "SQL_TAUTOLOGY_OR_INJECTION", score: 80 },
  { regex: /(\bAND\b\s+['"\d\w]+\s*=\s*['"\d\w]+)/i, name: "SQL_TAUTOLOGY_AND_INJECTION", score: 70 },
  { regex: /(?:\b(?:SLEEP|BENCHMARK|PG_SLEEP|WAITFOR\s+DELAY)\s*\(\s*\d+\s*\))/i, name: "SQL_TIME_BASED_INJECTION", score: 100 },
  { regex: /(?:;\s*(?:DROP|ALTER|TRUNCATE|DELETE|EXEC|EXECUTE|XP_CMDSHELL)\b)/i, name: "SQL_STACKED_QUERY_ATTACK", score: 100 },
  { regex: /(?:\b(?:INFORMATION_SCHEMA|SYS\.TABLES|SYSOBJECTS|ALL_TAB_COLUMNS)\b)/i, name: "SQL_SCHEMA_PROBE", score: 85 },
  { regex: /(?:\bCHAR\s*\(\s*\d+\s*(?:,\s*\d+\s*)*\))/i, name: "SQL_CHAR_ENCODING_BYPASS", score: 80 },
  { regex: /(?:--\s*$|\/\*[\s\S]*?\*\/|#\s*$)/m, name: "SQL_COMMENT_EVASION", score: 60 },
  { regex: /(?:\bEXEC\s*\(\s*@|\bEXECUTE\s+IMMEDIATE\b)/i, name: "SQL_EXEC_PROC_INJECTION", score: 95 },
];

// 2. Cross-Site Scripting (XSS) Patterns
const XSS_PATTERNS: Array<{ regex: RegExp; name: string; score: number }> = [
  { regex: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, name: "SCRIPT_TAG_INJECTION", score: 100 },
  { regex: /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, name: "IFRAME_INJECTION", score: 90 },
  { regex: /<embed\b|<object\b|<applet\b/gi, name: "EMBED_OBJECT_INJECTION", score: 85 },
  { regex: /\bjavascript:\s*[^"'>]+/gi, name: "JAVASCRIPT_URI_INJECTION", score: 95 },
  { regex: /\bvbscript:\s*[^"'>]+/gi, name: "VBSCRIPT_URI_INJECTION", score: 95 },
  { regex: /\bdata:\s*text\/html/gi, name: "DATA_HTML_INJECTION", score: 90 },
  { regex: /\bon(?:load|error|click|mouseover|focus|blur|change|submit|keydown|keyup|mouseenter|mouseleave)\s*=/gi, name: "DOM_EVENT_HANDLER_INJECTION", score: 90 },
  { regex: /<\s*svg\b[^>]*\bon\w+\s*=/gi, name: "SVG_EVENT_INJECTION", score: 95 },
  { regex: /<\s*img\b[^>]*\bonerror\s*=/gi, name: "IMG_ONERROR_INJECTION", score: 95 },
  { regex: /<\s*body\b[^>]*\bonload\s*=/gi, name: "BODY_ONLOAD_INJECTION", score: 90 },
  { regex: /document\s*\.\s*(?:cookie|location|domain|write)/gi, name: "DOM_COOKIE_THEFT_PATTERN", score: 85 },
  { regex: /(?:eval|Function|setTimeout|setInterval)\s*\(\s*['"\`].*['"\`]\s*\)/gi, name: "UNSAFE_EVAL_EXECUTION", score: 85 },
];

// 3. Command Injection & Remote Code Execution (RCE)
const COMMAND_INJECTION_PATTERNS: Array<{ regex: RegExp; name: string; score: number }> = [
  { regex: /(?:[;&|`]\s*(?:ls|cat|nc|netcat|wget|curl|bash|sh|zsh|powershell|cmd\.exe|whoami|id|uname|dir|type|ping|traceroute)\b)/i, name: "SHELL_COMMAND_CHAINING", score: 100 },
  { regex: /(?:\$\(\s*(?:ls|cat|nc|wget|curl|bash|sh|whoami|id|uname|hostname)\s*\))/i, name: "SUBSHELL_COMMAND_INJECTION", score: 100 },
  { regex: /(?:`\s*(?:ls|cat|nc|wget|curl|bash|sh|whoami|id|uname)\s*`)/i, name: "BACKTICK_COMMAND_INJECTION", score: 100 },
  { regex: /(?:powershell(?:\.exe)?\s+(?:-[eE]n?c?o?d?e?d?C?o?m?m?a?n?d?|-c\b|-w\s+hidden))/i, name: "POWERSHELL_PAYLOAD_EXECUTION", score: 100 },
  { regex: /(?:bash\s+-i\s+>&|\/dev\/tcp\/\d+\.\d+\.\d+\.\d+\/\d+)/i, name: "REVERSE_SHELL_PAYLOAD", score: 100 },
  { regex: /(?:php:\/\/(?:input|filter|memory)|data:\/\/text\/plain)/i, name: "PHP_WRAPPER_EXPLOITATION", score: 90 },
];

// 4. Path Traversal & Local/Remote File Inclusion (LFI/RFI)
const PATH_TRAVERSAL_PATTERNS: Array<{ regex: RegExp; name: string; score: number }> = [
  { regex: /(?:\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\|%252e%252e%252f|%252e%252e\\)/i, name: "DIRECTORY_TRAVERSAL_DOT_DOT", score: 85 },
  { regex: /(?:\/etc\/(?:passwd|shadow|hosts|group|issue|crontab))/i, name: "ETC_PASSWD_LFI_ATTACK", score: 100 },
  { regex: /(?:\/proc\/self\/(?:environ|cmdline|status|maps))/i, name: "PROC_SELF_ENV_EXFILTRATION", score: 100 },
  { regex: /(?:[a-zA-Z]:\\(?:windows|winnt|boot\.ini|system32))/i, name: "WINDOWS_SYSTEM_PATH_TRAVERSAL", score: 95 },
  { regex: /(?:\.env|\.git\/config|\.git\/HEAD|wp-config\.php|id_rsa|id_dsa|authorized_keys)/i, name: "SENSITIVE_CONFIG_FILE_PROBE", score: 90 },
];

// 5. Malicious Automated Vulnerability Scanners & Attack Tools
const MALICIOUS_USER_AGENTS = [
  "sqlmap",
  "nikto",
  "acunetix",
  "nessus",
  "nmap",
  "masscan",
  "zgrab",
  "gobuster",
  "dirbuster",
  "wpscan",
  "hydra",
  "medusa",
  "burpcollaborator",
  "metasploit",
  "havij",
  "beefframework",
  "arachni",
  "openvas",
  "qualys",
  "appscan",
  "webinspect",
  "netsparker",
  "whatweb",
  "nuclei",
  "jaeles",
  "ffuf",
  "wfuzz",
];

// ── Deep Inspection Helper ──

function inspectString(
  str: string,
  location: string
): { detected: boolean; category?: ThreatCategory; rule?: string; matchedValue?: string; score: number } | null {
  if (!str || typeof str !== "string" || str.length === 0) return null;

  // 1. Check SQLi
  for (const item of SQLI_PATTERNS) {
    const match = str.match(item.regex);
    if (match) {
      return {
        detected: true,
        category: "SQL_INJECTION",
        rule: `${item.name} in ${location}`,
        matchedValue: match[0].substring(0, 100),
        score: item.score,
      };
    }
  }

  // 2. Check XSS
  for (const item of XSS_PATTERNS) {
    const match = str.match(item.regex);
    if (match) {
      return {
        detected: true,
        category: "XSS_ATTACK",
        rule: `${item.name} in ${location}`,
        matchedValue: match[0].substring(0, 100),
        score: item.score,
      };
    }
  }

  // 3. Check Command Injection
  for (const item of COMMAND_INJECTION_PATTERNS) {
    const match = str.match(item.regex);
    if (match) {
      return {
        detected: true,
        category: "COMMAND_INJECTION",
        rule: `${item.name} in ${location}`,
        matchedValue: match[0].substring(0, 100),
        score: item.score,
      };
    }
  }

  // 4. Check Path Traversal
  for (const item of PATH_TRAVERSAL_PATTERNS) {
    const match = str.match(item.regex);
    if (match) {
      return {
        detected: true,
        category: "PATH_TRAVERSAL",
        rule: `${item.name} in ${location}`,
        matchedValue: match[0].substring(0, 100),
        score: item.score,
      };
    }
  }

  // 5. Check Header Injection / CRLF
  if (/[\r\n](?:Set-Cookie|Location|Content-Type):/i.test(str)) {
    return {
      detected: true,
      category: "HEADER_INJECTION",
      rule: `CRLF_HEADER_INJECTION in ${location}`,
      matchedValue: str.substring(0, 80),
      score: 90,
    };
  }

  return null;
}

function inspectPayloadRecursively(
  data: unknown,
  location: string,
  depth = 0
): { detected: boolean; category?: ThreatCategory; rule?: string; matchedValue?: string; score: number } | null {
  if (depth > 6 || !data) return null;

  if (typeof data === "string") {
    return inspectString(data, location);
  }

  if (Array.isArray(data)) {
    for (let i = 0; i < data.length; i++) {
      const res = inspectPayloadRecursively(data[i], `${location}[${i}]`, depth + 1);
      if (res) return res;
    }
    return null;
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      // Prototype pollution probe check
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        return {
          detected: true,
          category: "PROTOTYPE_POLLUTION",
          rule: `PROTOTYPE_POLLUTION_KEY in ${location}.${key}`,
          matchedValue: key,
          score: 95,
        };
      }

      // Check key name for injection
      const keyInspection = inspectString(key, `${location}.key`);
      if (keyInspection) return keyInspection;

      // Check value
      const valInspection = inspectPayloadRecursively(obj[key], `${location}.${key}`, depth + 1);
      if (valInspection) return valInspection;
    }
  }

  return null;
}

// ── IP Threat Management & Auto-Ban ──

export function recordAttackViolation(
  ip: string,
  req: Request,
  category: ThreatCategory,
  rule: string,
  matchedValue: string,
  score: number
): BlockedAttackEvent {
  totalAttacksBlocked++;
  blockedByCategory[category] = (blockedByCategory[category] || 0) + 1;

  const event: BlockedAttackEvent = {
    id: `waf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    ip,
    method: req.method,
    url: req.originalUrl || req.url,
    category,
    rule,
    matchedValue,
    userAgent: req.headers["user-agent"] as string,
    threatScore: score,
  };

  attackLogs.unshift(event);
  if (attackLogs.length > MAX_ATTACK_LOGS) {
    attackLogs.pop();
  }

  // Update IP Threat Score
  const current = ipThreatScores.get(ip) || { score: 0, violations: 0, lastSeen: Date.now() };
  current.score += score;
  current.violations += 1;
  current.lastSeen = Date.now();
  ipThreatScores.set(ip, current);

  // Auto-ban IP if score reaches threshold (>= 100) and not whitelisted
  if (current.score >= 100 && !manualWhitelist.has(ip)) {
    const banDuration = 60 * 60 * 1000; // 1 hour auto-ban
    bannedIps.set(ip, {
      ip,
      bannedAt: Date.now(),
      expiresAt: Date.now() + banDuration,
      reason: `Automated WAF defense trigger: ${rule} (Score: ${current.score})`,
      threatScore: current.score,
      totalViolations: current.violations,
    });
  }

  // Audit Log
  logAuditEvent({
    action: `WAF_ATTACK_BLOCKED_${category}`,
    category: "SECURITY",
    severity: "CRITICAL",
    status: "BLOCKED",
    ipAddress: ip,
    userAgent: req.headers["user-agent"],
    details: {
      rule,
      matchedValue,
      method: req.method,
      endpoint: req.originalUrl,
      threatScore: score,
      ipBanned: bannedIps.has(ip),
    },
  });

  return event;
}

export function isIpBanned(ip: string): boolean {
  if (manualWhitelist.has(ip)) return false;
  if (manualBlacklist.has(ip)) return true;

  const info = bannedIps.get(ip);
  if (!info) return false;

  if (Date.now() > info.expiresAt) {
    bannedIps.delete(ip);
    return false;
  }
  return true;
}

export function banIp(ip: string, reason: string, durationMinutes = 60): void {
  const expiresAt = durationMinutes > 0 ? Date.now() + durationMinutes * 60 * 1000 : Infinity;
  bannedIps.set(ip, {
    ip,
    bannedAt: Date.now(),
    expiresAt,
    reason,
    threatScore: 100,
    totalViolations: 1,
  });
  if (durationMinutes === 0) {
    manualBlacklist.add(ip);
  }
}

export function unbanIp(ip: string): void {
  bannedIps.delete(ip);
  manualBlacklist.delete(ip);
  ipThreatScores.delete(ip);
}

export function whitelistIp(ip: string): void {
  manualWhitelist.add(ip);
  bannedIps.delete(ip);
  manualBlacklist.delete(ip);
  ipThreatScores.delete(ip);
}

export function removeWhitelistIp(ip: string): void {
  manualWhitelist.delete(ip);
}

export function getWafStats(): WafStats {
  return {
    totalRequestsChecked,
    totalAttacksBlocked,
    blockedByCategory: { ...blockedByCategory },
    activeBannedIpsCount: bannedIps.size,
    recentAttacks: attackLogs.slice(0, 50),
  };
}

export function getBannedIpsList(): BannedIpInfo[] {
  const list: BannedIpInfo[] = [];
  const now = Date.now();
  for (const [ip, info] of bannedIps.entries()) {
    if (now <= info.expiresAt || manualBlacklist.has(ip)) {
      list.push(info);
    }
  }
  return list;
}

export function getWhitelistedIpsList(): string[] {
  return Array.from(manualWhitelist);
}

// ── Main WAF Middleware ──

export function webApplicationFirewallMiddleware(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    totalRequestsChecked++;
    const ip = getClientIp(req);

    // 1. IP Ban Enforcement
    if (isIpBanned(ip)) {
      const banInfo = bannedIps.get(ip);
      res.status(403).json({
        success: false,
        error: "Access Denied: Your IP address has been temporarily blocked by the Security Wall due to malicious activity.",
        details: banInfo ? { reason: banInfo.reason, expiresAt: new Date(banInfo.expiresAt).toISOString() } : undefined,
      });
      return;
    }

    // 2. Malicious Bot & Vulnerability Scanner Blocking
    const userAgent = (req.headers["user-agent"] || "").toLowerCase();
    for (const tool of MALICIOUS_USER_AGENTS) {
      if (userAgent.includes(tool)) {
        recordAttackViolation(ip, req, "MALICIOUS_BOT", `SCANNER_TOOL_DETECTED: ${tool}`, userAgent, 90);
        res.status(403).json({
          success: false,
          error: "Access Denied: Automated security scanning tool blocked by Security Wall.",
        });
        return;
      }
    }

    // 3. Inspect URL Path & Decoded Path for Traversal or Exploitation
    const rawPath = req.originalUrl || req.path || "";
    let decodedPath = rawPath;
    try {
      decodedPath = decodeURIComponent(rawPath);
    } catch {
      // Malformed URI encoding
      recordAttackViolation(ip, req, "SUSPICIOUS_PAYLOAD", "MALFORMED_URI_ENCODING", rawPath, 50);
      res.status(400).json({ success: false, error: "Invalid URI encoding detected" });
      return;
    }

    const pathThreat = inspectString(decodedPath, "URL_PATH");
    if (pathThreat && pathThreat.detected) {
      recordAttackViolation(ip, req, pathThreat.category!, pathThreat.rule!, pathThreat.matchedValue!, pathThreat.score);
      res.status(403).json({
        success: false,
        error: "Malicious request signature blocked by Security Wall.",
        rule: pathThreat.rule,
      });
      return;
    }

    // 4. Inspect Query Parameters
    if (req.query && typeof req.query === "object") {
      const queryThreat = inspectPayloadRecursively(req.query, "QUERY_PARAMS");
      if (queryThreat && queryThreat.detected) {
        recordAttackViolation(ip, req, queryThreat.category!, queryThreat.rule!, queryThreat.matchedValue!, queryThreat.score);
        res.status(403).json({
          success: false,
          error: "Malicious input parameter blocked by Security Wall.",
          rule: queryThreat.rule,
        });
        return;
      }
    }

    // 5. Inspect Request Body (JSON, Form Data, Text)
    if (req.body && typeof req.body === "object" && !(req.body instanceof Buffer)) {
      const bodyThreat = inspectPayloadRecursively(req.body, "REQUEST_BODY");
      if (bodyThreat && bodyThreat.detected) {
        recordAttackViolation(ip, req, bodyThreat.category!, bodyThreat.rule!, bodyThreat.matchedValue!, bodyThreat.score);
        res.status(403).json({
          success: false,
          error: "Malicious payload detected and blocked by Security Wall.",
          rule: bodyThreat.rule,
        });
        return;
      }
    }

    // 6. Inspect Sensitive Headers for Injection
    const headersToInspect = ["x-forwarded-host", "x-host", "referer"];
    for (const hdr of headersToInspect) {
      const val = req.headers[hdr];
      if (typeof val === "string") {
        const hdrThreat = inspectString(val, `HEADER_${hdr}`);
        if (hdrThreat && hdrThreat.detected) {
          recordAttackViolation(ip, req, hdrThreat.category!, hdrThreat.rule!, hdrThreat.matchedValue!, hdrThreat.score);
          res.status(403).json({
            success: false,
            error: "Security Wall detected illegal header payload.",
          });
          return;
        }
      }
    }

    next();
  };
}
