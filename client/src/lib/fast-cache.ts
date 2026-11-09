/**
 * In-Memory Fast Cache with Stale-While-Revalidate (SWR) & TTL Safety
 * Provides instant zero-spinner data rendering when navigating between portal tabs.
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const memoryCache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes default TTL

/**
 * Retrieve cached data synchronously.
 * Returns data instantly to bypass loading spinners if within TTL.
 */
export function getCachedData<T>(key: string, maxAgeMs: number = DEFAULT_TTL_MS): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > maxAgeMs) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Store fresh response in memory cache.
 */
export function setCachedData<T>(key: string, data: T): void {
  memoryCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Invalidate a specific cache key.
 */
export function clearCacheKey(key: string): void {
  memoryCache.delete(key);
}

/**
 * Clear all cached portal data (e.g. on logout or theme reload).
 */
export function clearAllFastCache(): void {
  memoryCache.clear();
}
