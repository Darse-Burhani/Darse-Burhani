import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "node:url";
import { requireAuth } from "../middleware";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const uploadsDir = path.resolve(process.env.UPLOAD_DIR || path.join(repoRoot, "public", "uploads"));
fs.mkdirSync(uploadsDir, { recursive: true });

// Allowed MIME types and extensions
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif"]);

// Dangerous extensions that must be rejected regardless of MIME type
const DANGEROUS_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "sh", "bash", "ps1", "vbs", "js", "mjs", "ts",
  "php", "phtml", "php3", "php4", "php5", "phps", "cgi", "pl", "py",
  "html", "htm", "shtml", "xhtml", "svg", "xml", "jsp", "asp", "aspx",
  "dll", "so", "dylib", "jar", "war", "htaccess", "config"
]);

/**
 * Validates magic byte header of image files
 */
function validateMagicBytes(filePath: string): boolean {
  try {
    const buffer = Buffer.alloc(12);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return true;
    }
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return true;
    }
    // GIF: GIF87a or GIF89a (47 49 46 38 37 61 or 47 49 46 38 39 61)
    if (
      buffer[0] === 0x47 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x38 &&
      (buffer[4] === 0x37 || buffer[4] === 0x39) &&
      buffer[5] === 0x61
    ) {
      return true;
    }
    // WebP: RIFF .... WEBP (52 49 46 46 ... 57 45 42 50)
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return true;
    }
    // AVIF: ....ftypavif (66 74 79 70 61 76 69 66)
    if (
      buffer[4] === 0x66 &&
      buffer[5] === 0x74 &&
      buffer[6] === 0x79 &&
      buffer[7] === 0x70 &&
      buffer[8] === 0x61 &&
      buffer[9] === 0x76 &&
      buffer[10] === 0x69 &&
      buffer[11] === 0x66
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const originalName = path.basename(file.originalname).toLowerCase();
    const parts = originalName.split(".");
    const ext = parts.pop() || "jpg";

    // Double extension / dangerous sub-extension check
    for (const part of parts) {
      if (DANGEROUS_EXTENSIONS.has(part)) {
        return cb(new Error("File rejected: dangerous double extension pattern detected"), "");
      }
    }

    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : "jpg";
    const secureRandom = crypto.randomBytes(16).toString("hex");
    cb(null, `img_${Date.now()}_${secureRandom}.${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const rawName = path.basename(file.originalname).toLowerCase();
    const parts = rawName.split(".");
    const ext = parts[parts.length - 1] || "";

    // Check for dangerous extensions
    for (const part of parts) {
      if (DANGEROUS_EXTENSIONS.has(part)) {
        return cb(new Error("File contains illegal extension"));
      }
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype) || !ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error("Invalid file type. Allowed: JPEG, PNG, WebP, GIF, AVIF"));
    }

    cb(null, true);
  },
});

// POST /api/upload
router.post("/", requireAuth, (req, res) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError
          ? err.code === "LIMIT_FILE_SIZE"
            ? "File too large. Maximum 5MB allowed."
            : `Upload failed: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Upload failed";
      return res.status(400).json({ success: false, error: message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file provided" });
    }

    // Verify magic bytes of saved file to prevent polyglot / MIME spoofing
    const filePath = path.join(uploadsDir, req.file.filename);
    const isValidImage = validateMagicBytes(filePath);

    if (!isValidImage) {
      // Remove malicious/corrupt file immediately
      try {
        fs.unlinkSync(filePath);
      } catch {}
      return res.status(400).json({
        success: false,
        error: "File integrity check failed: file signature does not match a valid image.",
      });
    }

    res.json({ success: true, url: `/uploads/${req.file.filename}` });
  });
});

export default router;
