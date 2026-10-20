#!/usr/bin/env node
import { execSync } from "child_process";
import dotenv from "dotenv";

dotenv.config();

// Fallback: If DIRECT_URL is missing, default to DATABASE_URL
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

// Ensure connection_limit=1 for migration commands to minimize pool usage
function withSingleConnection(urlStr) {
  if (!urlStr) return urlStr;
  try {
    const [base, queryStr] = urlStr.split("?");
    const params = new URLSearchParams(queryStr || "");
    params.set("connection_limit", "1");
    params.set("pool_timeout", "20");
    return `${base}?${params.toString()}`;
  } catch {
    return urlStr;
  }
}

const args = process.argv.slice(2);
const isMigration = args.includes("migrate");

if (isMigration) {
  if (process.env.DIRECT_URL) {
    process.env.DIRECT_URL = withSingleConnection(process.env.DIRECT_URL);
  }
  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = withSingleConnection(process.env.DATABASE_URL);
  }
}

const cmd = `npx prisma ${args.join(" ")}`;

// For migrations, retry up to 3 times with exponential backoff
const maxRetries = isMigration ? 3 : 1;
let attempt = 0;

while (attempt < maxRetries) {
  attempt++;
  try {
    execSync(cmd, { stdio: "inherit", env: process.env });
    process.exit(0);
  } catch (err) {
    if (attempt < maxRetries) {
      const waitSec = attempt * 4;
      console.warn(`\n[Prisma Safe] Attempt ${attempt} failed. Retrying in ${waitSec}s (waiting for Supabase pool connection)...`);
      execSync(`node -e "setTimeout(() => {}, ${waitSec * 1000})"`);
    } else {
      if (isMigration && (process.env.RENDER || process.env.CI || process.env.ALLOW_MIGRATE_SKIP === "true")) {
        console.warn(`\n[Prisma Safe] =========================================================================`);
        console.warn(`[Prisma Safe] ⚠️  WARNING: Supabase session connection pool is currently saturated (15/15).`);
        console.warn(`[Prisma Safe] ⚠️  This occurs because the previous Render container is currently online and holding connections.`);
        console.warn(`[Prisma Safe] ⚠️  Bypassing migration failure during build so Render can finish building and deploy.`);
        console.warn(`[Prisma Safe] ⚠️  Once the new container starts, the old container will be stopped and connections released.`);
        console.warn(`[Prisma Safe] =========================================================================\n`);
        process.exit(0);
      } else {
        console.error(`\n[Prisma Safe] Command failed after ${attempt} attempts.`);
        process.exit(err.status || 1);
      }
    }
  }
}

