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

// For migrations, retry up to 4 times with exponential backoff if Supabase pooler is momentarily full
const maxRetries = isMigration ? 4 : 1;
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
      console.error(`\n[Prisma Safe] Command failed after ${attempt} attempts.`);
      process.exit(err.status || 1);
    }
  }
}
