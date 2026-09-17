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

    // Only set defaults if not already explicitly configured
    if (!params.has("connection_limit")) {
      params.set("connection_limit", "10");
    }
    if (!params.has("pool_timeout")) {
      params.set("pool_timeout", "10");
    }
    if (!params.has("prepared_statement_cache_size")) {
      params.set("prepared_statement_cache_size", "500");
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

        // Only invalidate cache on write operations — reads are safe
        if (model && WRITE_OPERATIONS.has(operation)) {
          const tag = model.toLowerCase();
          cache.invalidateTag(tag);

          // Also clear global dashboards/stats that aggregate across models
          if (["pointlog", "studentprofile", "attendancerecord"].includes(tag)) {
            cache.invalidateTag("dashboard");
            cache.invalidateTag("stats");
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
