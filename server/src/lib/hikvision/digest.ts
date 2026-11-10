import { createHash, randomBytes } from "node:crypto";
import http from "node:http";
import https from "node:https";

export interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
}

const DIGEST_PARAM = /([a-zA-Z0-9_-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s,]+))/g;

/**
 * Cache challenges per host:port so we send Digest Authorization pre-emptively
 * on subsequent calls. This eliminates the 401 round-trip and doubles throughput.
 */
const challengeCache = new Map<string, DigestChallenge>();

/**
 * High-performance HTTP Keep-Alive Agent for Hikvision MinMoe terminals.
 * Keeps TCP sockets open and reuses them across calls, preventing socket exhaustion
 * and connection drops on MinMoe embedded Linux devices.
 */
export const hikHttpAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 25,
  maxFreeSockets: 10,
  timeout: 15000,
  keepAliveMsecs: 30000,
});

export const hikHttpsAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 25,
  maxFreeSockets: 10,
  timeout: 15000,
  keepAliveMsecs: 30000,
  rejectUnauthorized: false,
});

/**
 * Parse a `WWW-Authenticate: Digest ...` header into its challenge params.
 */
export function parseDigestChallenge(header: string): DigestChallenge | null {
  const idx = header.toLowerCase().indexOf("digest");
  if (idx === -1) return null;

  const params: Record<string, string> = {};
  DIGEST_PARAM.lastIndex = 0;
  let m: RegExpExecArray | null;
  const chunk = header.slice(idx + "digest".length);
  while ((m = DIGEST_PARAM.exec(chunk)) !== null) {
    params[m[1]] = (m[2] ?? m[3] ?? "").replace(/\\(.)/g, "$1");
  }

  if (!params.nonce) return null;
  return {
    realm: params.realm ?? "",
    nonce: params.nonce,
    qop: params.qop,
    opaque: params.opaque,
    algorithm: params.algorithm,
  };
}

function md5Hex(input: string): string {
  return createHash("md5").update(input).digest("hex");
}

/**
 * Build the `Authorization: Digest ...` header for a challenge (RFC 2617).
 */
export function buildDigestAuthHeader(
  method: string,
  uri: string,
  challenge: DigestChallenge,
  username: string,
  password: string,
  cnonce: string = randomBytes(8).toString("hex"),
): string {
  const ha1 = md5Hex(`${username}:${challenge.realm}:${password}`);
  const qop = challenge.qop?.split(",").map((s) => s.trim()).includes("auth") ? "auth" : undefined;
  const nc = "00000001";
  const ha2 = md5Hex(`${method.toUpperCase()}:${uri}`);
  const response = qop
    ? md5Hex(`${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5Hex(`${ha1}:${challenge.nonce}:${ha2}`);

  const parts = [
    `username="${username}"`,
    `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
    "algorithm=MD5",
  ];
  if (challenge.opaque) parts.push(`opaque="${challenge.opaque}"`);
  if (qop) {
    parts.push(`qop=${qop}`);
    parts.push(`nc=${nc}`);
    parts.push(`cnonce="${cnonce}"`);
  }
  return `Digest ${parts.join(", ")}`;
}

export interface DigestFetchOptions extends RequestInit {
  username: string;
  password: string;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Build a human-readable suffix explaining WHY a 401 came back from a
 * Hikvision terminal.
 */
export async function authFailureHint(res: Response): Promise<string> {
  if (res.status !== 401) return "";
  let body = "";
  try {
    body = await res.clone().text();
  } catch {
    body = "";
  }
  if (/<isActivated[^>]*>\s*false/i.test(body)) {
    return " — the terminal has not been activated yet; set its admin password via the device web UI or the Hik-Connect app first";
  }
  return " (bad credentials)";
}

/**
 * Ultra-resilient fetch that transparently handles Hikvision MD5 Digest auth,
 * pre-emptive challenge caching, connection pooling, and automatic retry on transient drops.
 */
export async function digestFetch(url: string, options: DigestFetchOptions): Promise<Response> {
  const { username, password, timeoutMs = 10000, retries = 2, ...init } = options;
  const parsed = new URL(url);
  const hostKey = `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? 443 : 80)}`;
  const uri = parsed.pathname + parsed.search;

  // 1. If payload body is present but no challenge cached yet, probe with a lightweight GET
  // so the terminal challenges on an empty request without resetting the TCP socket.
  let challenge = challengeCache.get(hostKey);
  if (!challenge && init.body) {
    try {
      const probeController = new AbortController();
      const probeTimer = setTimeout(() => probeController.abort(), Math.min(timeoutMs, 3000));
      const probeRes = await fetch(`${parsed.origin}/ISAPI/System/time`, {
        method: "GET",
        signal: probeController.signal,
        headers: { Connection: "keep-alive" },
      }).catch(() => null);
      clearTimeout(probeTimer);

      if (probeRes && probeRes.status === 401) {
        const probedChallenge = parseDigestChallenge(probeRes.headers.get("www-authenticate") ?? "");
        if (probedChallenge) {
          challenge = probedChallenge;
          challengeCache.set(hostKey, challenge);
        }
      }
    } catch {
      // Continue normal flow
    }
  }

  // 2. Request execution with automated retry on transient socket drops
  let attempt = 0;
  let lastError: any = null;

  while (attempt <= retries) {
    attempt++;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const reqHeaders = new Headers(init.headers as any || {});
      reqHeaders.set("Connection", "keep-alive");

      // Use pre-emptive cached challenge if available
      if (challenge) {
        reqHeaders.set(
          "Authorization",
          buildDigestAuthHeader((init.method ?? "GET").toUpperCase(), uri, challenge, username, password),
        );
      }

      let res = await fetch(url, {
        ...init,
        headers: reqHeaders,
        signal: controller.signal,
        // @ts-ignore Node.js keepalive extension
        keepalive: true,
      });

      // If 401 occurs (either no cached challenge or nonce became stale)
      if (res.status === 401) {
        const freshChallenge = parseDigestChallenge(res.headers.get("www-authenticate") ?? "");
        if (freshChallenge) {
          challenge = freshChallenge;
          challengeCache.set(hostKey, challenge);

          reqHeaders.set(
            "Authorization",
            buildDigestAuthHeader((init.method ?? "GET").toUpperCase(), uri, challenge, username, password),
          );

          res = await fetch(url, {
            ...init,
            headers: reqHeaders,
            signal: controller.signal,
            // @ts-ignore Node.js keepalive extension
            keepalive: true,
          });
        }
      }

      clearTimeout(timer);
      return res;
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;

      const isAbort = err?.name === "AbortError" || controller.signal.aborted;
      const isTransientDrop =
        err?.code === "ECONNRESET" ||
        err?.code === "ETIMEDOUT" ||
        err?.code === "EPIPE" ||
        err?.code === "EHOSTUNREACH" ||
        err?.message?.includes("fetch failed") ||
        err?.message?.includes("socket hang up");

      if (attempt <= retries && (isTransientDrop || isAbort)) {
        // Clear cached challenge in case connection dropped due to stale auth
        challengeCache.delete(hostKey);
        challenge = undefined;
        // Fast backoff before retry (200ms, 500ms)
        await new Promise((r) => setTimeout(r, attempt * 250));
        continue;
      }

      if (isAbort) {
        throw new Error(
          `Connection timed out (${Math.round(timeoutMs / 1000)}s) to terminal ${parsed.hostname} — device offline or unreachable`,
        );
      }
      throw err;
    }
  }

  throw lastError || new Error(`Failed to connect to ${parsed.hostname} after ${retries} attempts`);
}
