import { useState, useEffect, useRef } from "react";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const clientMemoryStore = new Map<string, CacheEntry<unknown>>();
const inflightPromises = new Map<string, Promise<unknown>>();

/**
 * High-performance client-side cache query executor with Stale-While-Revalidate.
 */
export async function fastFetchJson<T = any>(
  url: string,
  options?: RequestInit & { ttlMs?: number; skipCache?: boolean }
): Promise<T> {
  const ttl = options?.ttlMs ?? 60_000; // 1 minute default cache
  const cacheKey = `req:${url}:${JSON.stringify(options?.body || "")}`;

  // 1. Check in-memory client cache
  if (!options?.skipCache) {
    const cached = clientMemoryStore.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data as T;
    }
  }

  // 2. Deduplicate inflight requests for identical URL
  if (inflightPromises.has(cacheKey)) {
    return inflightPromises.get(cacheKey) as Promise<T>;
  }

  const promise = fetch(url, options)
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      if (!options?.skipCache && res.status === 200) {
        clientMemoryStore.set(cacheKey, { data, timestamp: Date.now() });
      }
      inflightPromises.delete(cacheKey);
      return data;
    })
    .catch((err) => {
      inflightPromises.delete(cacheKey);
      throw err;
    });

  inflightPromises.set(cacheKey, promise);
  return promise;
}

/**
 * React Hook for high-speed instant SWR data fetching.
 * Returns cached data immediately if available, then revalidates in the background.
 */
export function useFastQuery<T = any>(
  url: string | null,
  options?: RequestInit & { ttlMs?: number; enabled?: boolean; refreshInterval?: number }
) {
  const [data, setData] = useState<T | null>(() => {
    if (!url) return null;
    const cacheKey = `req:${url}:${JSON.stringify(options?.body || "")}`;
    const cached = clientMemoryStore.get(cacheKey);
    return cached ? (cached.data as T) : null;
  });

  const [loading, setLoading] = useState<boolean>(() => !data);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refetch = async () => {
    if (!url || options?.enabled === false) return;
    try {
      if (!data) setLoading(true);
      const res = await fastFetchJson<T>(url, options);
      if (mountedRef.current) {
        setData(res);
        setError(null);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    refetch();

    if (options?.refreshInterval && options.refreshInterval > 0) {
      const timer = setInterval(refetch, options.refreshInterval);
      return () => clearInterval(timer);
    }
  }, [url, options?.enabled]);

  return { data, loading, error, refetch };
}

/**
 * Manually invalidate client cache entry by prefix or URL
 */
export function invalidateClientCache(urlPrefix?: string): void {
  if (!urlPrefix) {
    clientMemoryStore.clear();
    return;
  }
  for (const key of clientMemoryStore.keys()) {
    if (key.includes(urlPrefix)) {
      clientMemoryStore.delete(key);
    }
  }
}
