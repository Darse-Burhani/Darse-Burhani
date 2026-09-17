import { createHash, randomBytes } from "node:crypto";

export interface DigestChallenge {
  realm: string;
  nonce: string;
  qop?: string;
  opaque?: string;
  algorithm?: string;
}

const DIGEST_PARAM = /([a-zA-Z0-9_-]+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^\s,]+))/g;

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
}

/**
 * Build a human-readable suffix explaining WHY a 401 came back from a
 * Hikvision terminal. Uninitialised terminals report
 * `<isActivated>false</isActivated>` in the 401 body — a much more actionable
 * hint than the generic "bad credentials". Returns "" for non-401 responses.
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
 * Fetch that transparently handles Hikvision's MD5 Digest auth: issues the
 * request, reads the 401 challenge, and retries once with the response hash.
 */
export async function digestFetch(url: string, options: DigestFetchOptions): Promise<Response> {
  const { username, password, timeoutMs = 8000, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let res = await fetch(url, { ...init, signal: controller.signal });

    if (res.status === 401) {
      const challenge = parseDigestChallenge(res.headers.get("www-authenticate") ?? "");
      if (challenge) {
        const parsed = new URL(url);
        const uri = parsed.pathname + parsed.search;
        const authorization = buildDigestAuthHeader(
          (init.method ?? "GET").toUpperCase(),
          uri,
          challenge,
          username,
          password,
        );
        res = await fetch(url, {
          ...init,
          headers: { ...(init.headers ?? {}), Authorization: authorization },
          signal: controller.signal,
        });
      }
    }

    return res;
  } catch (err: any) {
    if (err?.name === "AbortError" || controller.signal.aborted) {
      throw new Error(`Connection timed out (${Math.round(timeoutMs / 1000)}s) — device is offline or unreachable`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
