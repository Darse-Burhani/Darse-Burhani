import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "node:url";
import { requireAuth } from "../middleware";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const uploadsDir = path.resolve(process.env.UPLOAD_DIR || path.join(repoRoot, "public", "uploads"));
fs.mkdirSync(uploadsDir, { recursive: true });

const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
const allowedExts = ["jpg", "jpeg", "png", "webp", "gif", "avif"];

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const rawExt = (file.originalname.split(".").pop() || "jpg").toLowerCase();
    const ext = allowedExts.includes(rawExt) ? rawExt : "jpg";
    const rand = Math.random().toString(36).substring(2, 10);
    // Use crypto-random prefix to prevent guessing
    cb(null, `u-${Date.now()}-${rand}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = (file.originalname.split(".").pop() || "").toLowerCase();
    if (!allowedTypes.includes(file.mimetype) || !allowedExts.includes(ext)) {
      cb(new Error("Invalid file type. Allowed: JPEG, PNG, WebP, GIF, AVIF"));
      return;
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
            ? "File too large. Maximum 5MB"
            : "Upload failed"
          : err instanceof Error
            ? err.message
            : "Upload failed";
      return res.status(400).json({ success: false, error: message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file provided" });
    }

    res.json({ success: true, url: `/uploads/${req.file.filename}` });
  });
});

export default router;
