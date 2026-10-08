import dns from "node:dns/promises";
import net from "node:net";

/**
 * Checks whether an IP address is in a private, loopback, link-local, or cloud metadata range.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4 mapped IPv6
  if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
  }

  // IPv6 loopback and special
  if (ip === "::1" || ip === "::" || ip.startsWith("fe80:") || ip.startsWith("fc00:") || ip.startsWith("fd00:")) {
    return true;
  }

  // Check valid IPv4 format
  if (!net.isIPv4(ip)) {
    return false;
  }

  const parts = ip.split(".").map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true;
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Broadcast/current network)
  if (a === 0) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (Private class A)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private class B)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private class C)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-local & AWS/GCP metadata 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true;

  return false;
}

export interface SafeFetchOptions extends RequestInit {
  allowLocalhostInDev?: boolean;
  timeoutMs?: number;
}

/**
 * SSRF-Safe Fetch: Resolves DNS and blocks connection attempts to internal,
 * private, loopback, or cloud-metadata endpoints.
 */
export async function safeFetch(urlString: string, options: SafeFetchOptions = {}): Promise<Response> {
  const { allowLocalhostInDev = false, timeoutMs = 15000, ...fetchOptions } = options;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new Error(`SSRF Guard: Invalid URL '${urlString}'`);
  }

  // Only allow http and https protocols
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(`SSRF Guard: Disallowed protocol '${parsedUrl.protocol}'. Only HTTP and HTTPS are permitted.`);
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  // Block localhost keywords unless explicitly permitted in dev
  const isDev = process.env.NODE_ENV !== "production";
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    if (!isDev || !allowLocalhostInDev) {
      throw new Error(`SSRF Guard: Access to loopback address '${hostname}' is prohibited.`);
    }
  } else {
    // Resolve DNS and check all resolved IP addresses
    try {
      const addresses = await dns.resolve(hostname);
      for (const ip of addresses) {
        if (isPrivateOrReservedIp(ip)) {
          throw new Error(`SSRF Guard: Hostname '${hostname}' resolves to private/internal IP '${ip}'. Request blocked.`);
        }
      }
    } catch (err: any) {
      if (err.message?.includes("SSRF Guard")) {
        throw err;
      }
      // If DNS resolution fails, let fetch handle standard network error
    }
  }

  // Set timeout controller
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(parsedUrl.toString(), {
      ...fetchOptions,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}
