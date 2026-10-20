import { PrismaClient } from "@prisma/client";
import * as Sentry from "@sentry/node";
import { cache } from "./cache";

const WRITE_OPERATIONS = new Set([
  "create",
  "update",
  "delete",
  "updateMany",
  "deleteMany",
  "upsert",
  "createMany",
]);

/**
 * Ensures the DATABASE_URL includes optimal connection pooling parameters.
 * - connection_limit: max concurrent connections in the pool
 * - pool_timeout: seconds to wait for a connection from the pool
 * - prepared_statement_cache_size: number of prepared statements to cache per connection
 *
 * These params are applied at runtime so the .env file stays clean.
 */
function getPooledDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  try {
    const [base, queryStr] = url.split("?");
    const params = new URLSearchParams(queryStr || "");

    const isSupabasePooler = url.includes("pooler.supabase.com") || url.includes("supabase.co");
    const isPort6543 = url.includes(":6543");
    const isPort5432 = url.includes(":5432");

    // Optimize connection limit:
    // Supabase session pooler on port 5432 limits max clients to 15. Keep connection limit low to prevent exhaustion.
    const defaultLimit = process.env.RENDER ? (isSupabasePooler && isPort5432 ? "3" : "4") : "5";
    const targetLimit = parseInt(process.env.DATABASE_CONNECTION_LIMIT || defaultLimit, 10);
    params.set("connection_limit", String(targetLimit));

    // Connect & Pool timeouts
    const currentTimeout = parseInt(params.get("pool_timeout") || "0", 10);
    if (!params.has("pool_timeout") || currentTimeout < 30) {
      params.set("pool_timeout", "30");
    }
    if (!params.has("connect_timeout")) {
      params.set("connect_timeout", "15");
    }

    // Handle PgBouncer transaction mode vs session mode
    if (isPort6543 || params.get("pgbouncer") === "true") {
      params.set("pgbouncer", "true");
      params.set("statement_cache_size", "0");
      params.delete("prepared_statement_cache_size");
    } else if (!params.has("prepared_statement_cache_size")) {
      params.set("prepared_statement_cache_size", "250");
    }

    return `${base}?${params.toString()}`;
  } catch {
    return url;
  }
}

const prismaClientSingleton = () => {
  const pooledUrl = getPooledDatabaseUrl();
  const client = new PrismaClient({
    ...(pooledUrl ? { datasources: { db: { url: pooledUrl } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  const cacheExtension: any = {
    query: {
      async $allOperations({ model, operation, args, query }: any) {
        const result = await query(args);

        // Invalidate cache on write operations — reads are fast & cached
        if (model && WRITE_OPERATIONS.has(operation)) {
          const tag = model.toLowerCase();
          cache.invalidateTag(tag);

          // Clear global dashboards/stats
          if (["pointlog", "studentprofile", "attendancerecord"].includes(tag)) {
            cache.invalidateTag("dashboard");
            cache.invalidateTag("stats");
          }

          // Clear timetable & class caches
          if (["timetableslot", "timetablebadal", "class", "classenrollment", "teacherprofile", "user"].includes(tag)) {
            cache.invalidateTag("timetable");
            cache.invalidateTag("timetableslot");
            cache.invalidateTag("class");
            cache.invalidateTag("classes");
            cache.invalidateTag("teachers");
          }
        }

        return result;
      },
    },
  };

  let extended = client.$extends(cacheExtension);

  if (process.env.NODE_ENV === "production" && process.env.SENTRY_DSN) {
    const sentryExtension: any = {
      query: {
        async $allOperations({ model, args, query }: any) {
          try {
            return await query(args);
          } catch (error) {
            Sentry.captureException(error, {
              tags: {
                "prisma.model": model ?? "unknown",
              },
            });
            throw error;
          }
        },
      },
    };
    extended = extended.$extends(sentryExtension);
  }

  return extended as unknown as typeof client;
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;

export default prisma;
