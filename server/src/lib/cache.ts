import { getSessionUser } from "../auth";

type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

interface CacheOptions {
  /** Time-to-live in milliseconds (default: 60_000 = 1 minute) */
  ttl?: number;
  /** Optional tags for bulk invalidation */
  tags?: string[];
}

/**
 * High-performance in-memory cache with TTL, tag-based invalidation,
 * and automated background garbage collection to prevent memory bloat.
 * Deduplicates concurrent cache misses so the factory function
 * runs only once per key.
 */
class MemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private tagIndex = new Map<string, Set<string>>();
  private inflight = new Map<string, Promise<unknown>>();
  private pruneTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Run automated cache pruning every 60 seconds
    if (typeof setInterval !== "undefined") {
      this.pruneTimer = setInterval(() => this.pruneExpired(), 60_000);
      if (this.pruneTimer.unref) {
        this.pruneTimer.unref(); // don't block node process exit
      }
    }
  }

  /**
   * Returns cached value if it exists and hasn't expired,
   * otherwise calls `fn` to compute the value and caches it.
   * Concurrent calls for the same key are deduplicated.
   */
  async getOrSet<T>(
    key: string,
    fn: () => Promise<T>,
    options: CacheOptions = {},
  ): Promise<T> {
    // Check cache first
    const entry = this.store.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }

    // Deduplicate concurrent misses for the same key
    const existing = this.inflight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const ttl = options.ttl ?? 60_000;

    const promise = fn()
      .then((data) => {
        const expiresAt = Date.now() + ttl;
        this.store.set(key, { data, expiresAt });

        // Index by tags for bulk invalidation
        if (options.tags) {
          options.tags.forEach((tag) => {
            if (!this.tagIndex.has(tag)) {
              this.tagIndex.set(tag, new Set());
            }
            this.tagIndex.get(tag)!.add(key);
          });
        }

        this.inflight.delete(key);
        return data;
      })
      .catch((err) => {
        this.inflight.delete(key);
        throw err;
      });

    this.inflight.set(key, promise);
    return promise;
  }

  /**
   * Synchronous read — returns cached value or undefined.
   */
  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data as T;
    }
    if (entry) this.store.delete(key); // expired
    return undefined;
  }

  /**
   * Manually set a value in the cache.
   */
  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const ttl = options.ttl ?? 60_000;
    this.store.set(key, { data, expiresAt: Date.now() + ttl });

    if (options.tags) {
      options.tags.forEach((tag) => {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      });
    }
  }

  /**
   * Invalidate all cache entries matching a tag.
   */
  invalidateTag(tag: string): void {
    const keys = this.tagIndex.get(tag);
    if (!keys) return;
    keys.forEach((key) => {
      this.store.delete(key);
    });
    this.tagIndex.delete(tag);
  }

  /**
   * Invalidate a specific cache key.
   */
  invalidateKey(key: string): void {
    this.store.delete(key);
    // Remove from tag index too
    this.tagIndex.forEach((keys) => {
      keys.delete(key);
    });
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    this.store.clear();
    this.tagIndex.clear();
    this.inflight.clear();
  }

  /**
   * Prune expired entries to maintain lean memory profile.
   */
  pruneExpired(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt <= now) {
        this.store.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  /**
   * Return number of active cached entries (for monitoring).
   */
  get size(): number {
    return this.store.size;
  }
}

/** Singleton cache instance */
export const cache = new MemoryCache();

/**
 * Express Middleware for high-speed API response caching with conditional GET (ETag / 304).
 * Dramatically cuts down database load by serving cached responses in < 1-2ms.
 */
export function apiCacheMiddleware(options: {
  ttlMs?: number;
  tags?: string[];
  keyGenerator?: (req: any) => string;
} = {}) {
  const { ttlMs = 30_000, tags = [], keyGenerator } = options;

  return (req: any, res: any, next: any) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Skip caching if request has no-cache or bypass headers
    if (req.headers["x-skip-cache"] === "1" || req.headers["cache-control"] === "no-cache") {
      return next();
    }

    const sessionUser = req.auth?.user || req.user || req.session?.user || getSessionUser(req);
    const userId = sessionUser?.id || "public";
    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : `api:${req.baseUrl || ""}${req.path}:${JSON.stringify(req.query)}:${userId}`;

    const cached = cache.get<{ body: any; etag: string; timestamp: number }>(cacheKey);

    if (cached) {
      // Check conditional If-None-Match
      const ifNoneMatch = req.headers["if-none-match"];
      if (ifNoneMatch && ifNoneMatch === cached.etag) {
        res.setHeader("X-Cache", "HIT-304");
        return res.status(304).end();
      }

      res.setHeader("X-Cache", "HIT");
      res.setHeader("ETag", cached.etag);
      res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
      return res.json(cached.body);
    }

    // Intercept res.json to store in memory cache
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Only cache successful 200 responses
      if (res.statusCode >= 200 && res.statusCode < 300 && body !== undefined) {
        try {
          const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
          // Fast simple hash for ETag
          let hash = 0;
          for (let i = 0; i < bodyStr.length; i++) {
            hash = (hash << 5) - hash + bodyStr.charCodeAt(i);
            hash |= 0;
          }
          const etag = `W/"${Math.abs(hash).toString(36)}-${bodyStr.length.toString(36)}"`;

          cache.set(
            cacheKey,
            { body, etag, timestamp: Date.now() },
            { ttl: ttlMs, tags }
          );

          res.setHeader("X-Cache", "MISS");
          res.setHeader("ETag", etag);
          res.setHeader("Cache-Control", "private, max-age=0, must-revalidate");
        } catch {
          // Fallback gracefully on serialization error
        }
      }
      return originalJson(body);
    };

    next();
  };
}
