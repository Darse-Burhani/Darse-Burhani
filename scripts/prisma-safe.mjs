#!/usr/bin/env node
import { execSync } from "child_process";
import dotenv from "dotenv";

// Load .env if present
dotenv.config();

// Fallback: If DIRECT_URL is missing, default it to DATABASE_URL so Render builds never fail
if (!process.env.DIRECT_URL && process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

const args = process.argv.slice(2).join(" ");
try {
  execSync(`npx prisma ${args}`, { stdio: "inherit", env: process.env });
} catch (err) {
  process.exit(err.status || 1);
}
