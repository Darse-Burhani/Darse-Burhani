import path from "path";
import fs from "fs";
import { fileURLToPath } from "node:url";

let cachedRepoRoot: string | null = null;

/**
 * Robust Monorepo Root Finder:
 * Resolves the absolute path to the repository root directory in both:
 * 1) Local dev environment (tsx, ts-node, vite-node)
 * 2) Bundled production ESM environment (node server/dist/index.js)
 * 3) Render / Cloud container environment (/opt/render/project/src)
 */
export function getRepoRoot(): string {
  if (cachedRepoRoot) return cachedRepoRoot;

  if (process.env.REPO_ROOT && fs.existsSync(process.env.REPO_ROOT)) {
    cachedRepoRoot = path.resolve(process.env.REPO_ROOT);
    return cachedRepoRoot;
  }

  // Check process.cwd() first
  const cwd = process.cwd();
  if (
    fs.existsSync(path.join(cwd, "package.json")) &&
    fs.existsSync(path.join(cwd, "server")) &&
    fs.existsSync(path.join(cwd, "client"))
  ) {
    cachedRepoRoot = cwd;
    return cachedRepoRoot;
  }

  // Walk up from current module file location
  try {
    let current = path.dirname(fileURLToPath(import.meta.url));
    for (let i = 0; i < 6; i++) {
      if (
        fs.existsSync(path.join(current, "package.json")) &&
        fs.existsSync(path.join(current, "server")) &&
        fs.existsSync(path.join(current, "client"))
      ) {
        cachedRepoRoot = current;
        return cachedRepoRoot;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  } catch {}

  // Fallback to checking parent of cwd (e.g. if running from server/ directory)
  if (
    fs.existsSync(path.join(cwd, "..", "server")) &&
    fs.existsSync(path.join(cwd, "..", "client"))
  ) {
    cachedRepoRoot = path.resolve(cwd, "..");
    return cachedRepoRoot;
  }

  // Ultimate fallback
  cachedRepoRoot = cwd;
  return cachedRepoRoot;
}

export const repoRoot = getRepoRoot();

export const uploadsDir = path.resolve(
  process.env.UPLOAD_DIR || path.join(repoRoot, "public", "uploads")
);

export const tilawatUploadsDir = path.join(uploadsDir, "tilawat-dua");
export const parentsUploadsDir = path.join(uploadsDir, "parents");
export const talabatUploadsDir = path.join(uploadsDir, "talabat");

export const clientPublicDir = path.join(repoRoot, "client", "public");
export const clientPublicUploadsDir = path.join(clientPublicDir, "uploads");
export const clientPublicTilawatDir = path.join(clientPublicUploadsDir, "tilawat-dua");

export const clientDistDir = path.join(repoRoot, "client", "dist");
export const clientDistUploadsDir = path.join(clientDistDir, "uploads");
export const clientDistTilawatDir = path.join(clientDistUploadsDir, "tilawat-dua");

// Ensure essential upload directories exist synchronously at startup
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
  fs.mkdirSync(tilawatUploadsDir, { recursive: true });
  fs.mkdirSync(parentsUploadsDir, { recursive: true });
  fs.mkdirSync(talabatUploadsDir, { recursive: true });
  fs.mkdirSync(clientPublicUploadsDir, { recursive: true });
  fs.mkdirSync(clientPublicTilawatDir, { recursive: true });
  fs.mkdirSync(clientDistUploadsDir, { recursive: true });
  fs.mkdirSync(clientDistTilawatDir, { recursive: true });
} catch (err) {
  console.warn("[paths] Warning ensuring upload directories:", err);
}
