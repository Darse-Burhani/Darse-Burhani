/**
 * High-Performance Client-Side Route & Data Prefetch Engine
 * Provides instant 0ms transitions and memory-level SWR caching.
 */

// In-memory response cache for API queries
const queryMemoryCache = new Map<string, { data: any; timestamp: number; etag?: string }>();
const prefetchedRoutes = new Set<string>();

/**
 * Prefetches an API endpoint and caches the JSON in memory.
 */
export async function prefetchApi(url: string, ttlMs: number = 30_000): Promise<any> {
  const cached = queryMemoryCache.get(url);
  if (cached && Date.now() - cached.timestamp < ttlMs) {
    return cached.data;
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cached?.etag) {
      headers["If-None-Match"] = cached.etag;
    }

    const res = await fetch(url, { credentials: "include", headers });
    if (res.status === 304 && cached) {
      cached.timestamp = Date.now();
      return cached.data;
    }

    if (res.ok) {
      const data = await res.json();
      const etag = res.headers.get("ETag") || undefined;
      queryMemoryCache.set(url, { data, timestamp: Date.now(), etag });
      return data;
    }
  } catch (err) {
    // Fail silently in background prefetch
  }
  return null;
}

/**
 * Get cached query data if valid.
 */
export function getCachedApiData<T = any>(url: string, maxAgeMs: number = 60_000): T | null {
  const cached = queryMemoryCache.get(url);
  if (cached && Date.now() - cached.timestamp < maxAgeMs) {
    return cached.data as T;
  }
  return null;
}

/**
 * Invalidate cache for matching URL prefixes or keys.
 */
export function invalidateApiCache(prefix?: string) {
  if (!prefix) {
    queryMemoryCache.clear();
    return;
  }
  for (const key of queryMemoryCache.keys()) {
    if (key.startsWith(prefix)) {
      queryMemoryCache.delete(key);
    }
  }
}

/**
 * Prefetch dynamic import chunk for a given route path.
 */
export function prefetchRouteChunk(path: string) {
  if (prefetchedRoutes.has(path)) return;
  prefetchedRoutes.add(path);

  // Match and dynamically import route chunks
  if (path.startsWith("/admin/attendance-logs")) {
    import("@/app/admin/attendance-logs/page");
  } else if (path.startsWith("/admin/classes")) {
    import("@/app/admin/classes/page");
  } else if (path.startsWith("/admin/timetable")) {
    import("@/app/admin/timetable/page");
  } else if (path.startsWith("/admin/hifz")) {
    import("@/app/admin/hifz/page");
  } else if (path.startsWith("/admin/library")) {
    import("@/app/admin/library/page");
  } else if (path.startsWith("/admin/users")) {
    import("@/app/admin/users/page");
  } else if (path.startsWith("/teacher")) {
    import("@/app/teacher/page");
  } else if (path.startsWith("/talabat")) {
    import("@/app/talabat/page");
  }
}
