import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import prisma from "../lib/prisma";
import { requireAuth, requireRole, hasTeacherPageAuthority, AuthedRequest } from "../middleware";
import { cache } from "../lib/cache";
import {
  tilawatUploadsDir,
  clientPublicTilawatDir,
  clientDistTilawatDir,
} from "../lib/paths";

const router = Router();

/**
 * Validates magic bytes for PDF file: %PDF- (0x25 0x50 0x44 0x46)
 */
function validatePdfMagicBytes(filePath: string): boolean {
  try {
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    return (
      buffer[0] === 0x25 && // %
      buffer[1] === 0x50 && // P
      buffer[2] === 0x44 && // D
      buffer[3] === 0x46    // F
    );
  } catch {
    return false;
  }
}

// Multer storage for Tilawat Dua PDF documents
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdirSync(tilawatUploadsDir, { recursive: true });
    cb(null, tilawatUploadsDir);
  },
  filename: (_req, file, cb) => {
    const originalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_");
    const secureRandom = crypto.randomBytes(8).toString("hex");
    cb(null, `tilawat_${Date.now()}_${secureRandom}.pdf`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 60 * 1024 * 1024, // 60MB max for high-res manuscript Quran/Dua
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== ".pdf" || (file.mimetype && file.mimetype !== "application/pdf" && file.mimetype !== "application/x-pdf")) {
      return cb(new Error("Invalid file format. Only PDF files are allowed for Tilawat Dua."));
    }
    cb(null, true);
  },
});

/**
 * Helper to check if current user can manage Tilawat Dua
 */
async function canUserManageTilawatDua(req: AuthedRequest): Promise<boolean> {
  const user = req.auth?.user;
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  if (user.role === "TEACHER") {
    return await hasTeacherPageAuthority(user.id, "tilawat-dua");
  }
  return false;
}

// ── 1. Upload Tilawat Dua PDF (Admin or Assigned Teacher) ──
router.post("/upload", requireAuth, async (req: Request, res: Response) => {
  const authedReq = req as AuthedRequest;
  const canManage = await canUserManageTilawatDua(authedReq);
  if (!canManage) {
    return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to upload Tilawat Dua." });
  }

  upload.single("file")(req, res, async (err: unknown) => {
    if (err) {
      const message =
        err instanceof multer.MulterError
          ? err.code === "LIMIT_FILE_SIZE"
            ? "File too large. Maximum 60MB allowed for PDF."
            : `Upload failed: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Upload failed";
      return res.status(400).json({ success: false, error: message });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No PDF file provided" });
    }

    const filePath = path.join(tilawatUploadsDir, req.file.filename);

    // Validate PDF magic bytes
    if (!validatePdfMagicBytes(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
      return res.status(400).json({
        success: false,
        error: "Corrupt or spoofed file: File signature does not match a valid PDF document.",
      });
    }

    // Mirror to client public and dist directories for seamless static serving
    try {
      if (fs.existsSync(clientPublicTilawatDir)) {
        const clientCopyPath = path.join(clientPublicTilawatDir, req.file.filename);
        fs.copyFileSync(filePath, clientCopyPath);
      }
      if (fs.existsSync(clientDistTilawatDir)) {
        const distCopyPath = path.join(clientDistTilawatDir, req.file.filename);
        fs.copyFileSync(filePath, distCopyPath);
      }
    } catch (copyErr) {
      // Non-fatal, primary uploads directory is source of truth
    }

    const fileUrl = `/uploads/tilawat-dua/${req.file.filename}`;
    res.json({
      success: true,
      url: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    });
  });
});

// ── 2. Get Today's Active Tilawat Dua (Context-Aware for Talabat, Faculty, Admin) ──
router.get("/today", requireAuth, async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    const user = authedReq.auth?.user;
    if (!user) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    const cacheKey = `tilawat-dua-today-${user.role}-${user.id}`;
    const result = await cache.getOrSet(
      cacheKey,
      async () => {
        // Determine target filter based on user role
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

        let audienceFilter: any = { isActive: true };

        if (user.role === "STUDENT") {
          // Fetch student details for class & marhala targeting
          const studentProfile = await prisma.studentProfile.findUnique({
            where: { userId: user.id },
            select: {
              id: true,
              grade: true,
              classEnrollments: { select: { classId: true } },
            },
          });

          const studentGrade = studentProfile?.grade ? String(studentProfile.grade).trim().toUpperCase() : null;
          const studentClassIds = studentProfile?.classEnrollments?.map((e) => e.classId) || [];

          audienceFilter = {
            isActive: true,
            OR: [
              { targetAudience: "ALL" },
              { targetAudience: "TALABAT" },
              ...(studentGrade
                ? [
                    {
                      targetAudience: "MARHALA",
                      OR: [
                        { targetMarhala: "ALL" },
                        { targetMarhala: studentGrade },
                        { targetMarhala: { contains: studentGrade, mode: "insensitive" } },
                      ],
                    },
                  ]
                : []),
              ...(studentClassIds.length > 0
                ? [
                    {
                      targetAudience: "CLASS",
                      targetClassIds: { hasSome: studentClassIds },
                    },
                  ]
                : []),
            ],
          };
        } else if (user.role === "TEACHER") {
          audienceFilter = {
            isActive: true,
            OR: [{ targetAudience: "ALL" }, { targetAudience: "FACULTY" }],
          };
        }

        // 1. Try to find marked daily default for today
        let item = await prisma.tilawatDua.findFirst({
          where: {
            ...audienceFilter,
            isDailyDefault: true,
            date: { gte: startOfToday, lte: endOfToday },
          },
          orderBy: [{ updatedAt: "desc" }],
        });

        // 2. If no explicit default today, find any active Tilawat Dua for today
        if (!item) {
          item = await prisma.tilawatDua.findFirst({
            where: {
              ...audienceFilter,
              date: { gte: startOfToday, lte: endOfToday },
            },
            orderBy: [{ isDailyDefault: "desc" }, { updatedAt: "desc" }],
          });
        }

        // 3. If none for today, fallback to the most recent active Tilawat Dua
        if (!item) {
          item = await prisma.tilawatDua.findFirst({
            where: audienceFilter,
            orderBy: [{ date: "desc" }, { isDailyDefault: "desc" }, { updatedAt: "desc" }],
          });
        }

        return {
          data: item,
          hasItem: !!item,
        };
      },
      { ttl: 30_000, tags: ["tilawat-dua"] }
    );

    res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[tilawat-dua:today] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch today's Tilawat Dua" });
  }
});

// ── 3. List & Filter Tilawat Duas ──
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    const user = authedReq.auth?.user;
    if (!user) return res.status(401).json({ success: false, error: "Unauthorized" });

    const canManage = await canUserManageTilawatDua(authedReq);
    const { date, audience, marhala, classId, search, limit } = req.query;

    const where: any = {};

    // If caller cannot manage, only show active and relevant records
    if (!canManage) {
      where.isActive = true;

      if (user.role === "STUDENT") {
        const studentProfile = await prisma.studentProfile.findUnique({
          where: { userId: user.id },
          select: {
            id: true,
            grade: true,
            classEnrollments: { select: { classId: true } },
          },
        });

        const studentGrade = studentProfile?.grade ? String(studentProfile.grade).trim().toUpperCase() : null;
        const studentClassIds = studentProfile?.classEnrollments?.map((e) => e.classId) || [];

        where.OR = [
          { targetAudience: "ALL" },
          { targetAudience: "TALABAT" },
          ...(studentGrade
            ? [
                {
                  targetAudience: "MARHALA",
                  OR: [
                    { targetMarhala: "ALL" },
                    { targetMarhala: studentGrade },
                    { targetMarhala: { contains: studentGrade, mode: "insensitive" } },
                  ],
                },
              ]
            : []),
          ...(studentClassIds.length > 0
            ? [
                {
                  targetAudience: "CLASS",
                  targetClassIds: { hasSome: studentClassIds },
                },
              ]
            : []),
        ];
      } else if (user.role === "TEACHER") {
        where.OR = [{ targetAudience: "ALL" }, { targetAudience: "FACULTY" }];
      }
    }

    // Date filter
    if (date && typeof date === "string") {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        const start = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 0, 0, 0, 0);
        const end = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), 23, 59, 59, 999);
        where.date = { gte: start, lte: end };
      }
    }

    // Audience filter (for admin/manage)
    if (audience && typeof audience === "string" && audience !== "ALL_AUDIENCES") {
      where.targetAudience = audience;
    }

    // Marhala filter
    if (marhala && typeof marhala === "string" && marhala !== "ALL") {
      where.targetMarhala = marhala;
    }

    // Class filter
    if (classId && typeof classId === "string") {
      where.targetClassIds = { has: classId };
    }

    // Search query
    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { fileName: { contains: q, mode: "insensitive" } },
      ];
    }

    const take = limit ? Math.min(Number(limit), 100) : 50;

    const [items, totalCount, activeCount] = await Promise.all([
      prisma.tilawatDua.findMany({
        where,
        orderBy: [{ date: "desc" }, { isDailyDefault: "desc" }, { createdAt: "desc" }],
        take,
      }),
      prisma.tilawatDua.count({ where }),
      prisma.tilawatDua.count({ where: { ...where, isActive: true } }),
    ]);

    res.json({
      success: true,
      data: items,
      meta: {
        total: totalCount,
        active: activeCount,
        canManage,
      },
    });
  } catch (error: any) {
    console.error("[tilawat-dua:list] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch Tilawat Dua records" });
  }
});

// ── 4. Get Single Tilawat Dua by ID ──
router.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await prisma.tilawatDua.findUnique({ where: { id } });
    if (!item) {
      return res.status(404).json({ success: false, error: "Tilawat Dua not found" });
    }
    res.json({ success: true, data: item });
  } catch (error: any) {
    console.error("[tilawat-dua:get] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to fetch Tilawat Dua" });
  }
});

// ── 5. Create Tilawat Dua Record (Admin or Assigned Teacher) ──
router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    const canManage = await canUserManageTilawatDua(authedReq);
    if (!canManage) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to create Tilawat Dua records." });
    }

    const {
      title,
      description,
      pdfUrl,
      fileName,
      fileSize,
      pageCount,
      date,
      isActive = true,
      isDailyDefault = false,
      targetAudience = "ALL",
      targetMarhala,
      targetClassIds = [],
    } = req.body;

    if (!title || !pdfUrl || !fileName) {
      return res.status(400).json({ success: false, error: "Title, PDF file URL, and file name are required." });
    }

    const recordDate = date ? new Date(date) : new Date();

    // If marked as daily default, clear any other default on the same date
    if (isDailyDefault) {
      const startOfDay = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate(), 23, 59, 59, 999);
      await prisma.tilawatDua.updateMany({
        where: {
          date: { gte: startOfDay, lte: endOfDay },
          isDailyDefault: true,
        },
        data: { isDailyDefault: false },
      });
    }

    const newRecord = await prisma.tilawatDua.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        pdfUrl,
        fileName,
        fileSize: fileSize ? Number(fileSize) : null,
        pageCount: pageCount ? Number(pageCount) : 1,
        date: recordDate,
        isActive: Boolean(isActive),
        isDailyDefault: Boolean(isDailyDefault),
        targetAudience: targetAudience || "ALL",
        targetMarhala: targetMarhala || null,
        targetClassIds: Array.isArray(targetClassIds) ? targetClassIds : [],
        uploadedById: authedReq.auth?.user.id,
      },
    });

    cache.invalidateTag("tilawat-dua");
    res.status(201).json({ success: true, data: newRecord });
  } catch (error: any) {
    console.error("[tilawat-dua:create] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to create Tilawat Dua record" });
  }
});

// ── 6. Update Tilawat Dua Record ──
router.put("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    const canManage = await canUserManageTilawatDua(authedReq);
    if (!canManage) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission to modify Tilawat Dua." });
    }

    const { id } = req.params;
    const {
      title,
      description,
      pdfUrl,
      fileName,
      fileSize,
      pageCount,
      date,
      isActive,
      isDailyDefault,
      targetAudience,
      targetMarhala,
      targetClassIds,
    } = req.body;

    const existing = await prisma.tilawatDua.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Tilawat Dua record not found" });
    }

    const recordDate = date ? new Date(date) : existing.date;

    if (isDailyDefault && !existing.isDailyDefault) {
      const startOfDay = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate(), 23, 59, 59, 999);
      await prisma.tilawatDua.updateMany({
        where: {
          id: { not: id },
          date: { gte: startOfDay, lte: endOfDay },
          isDailyDefault: true,
        },
        data: { isDailyDefault: false },
      });
    }

    const updated = await prisma.tilawatDua.update({
      where: { id },
      data: {
        title: title !== undefined ? title.trim() : existing.title,
        description: description !== undefined ? (description ? description.trim() : null) : existing.description,
        pdfUrl: pdfUrl || existing.pdfUrl,
        fileName: fileName || existing.fileName,
        fileSize: fileSize !== undefined ? Number(fileSize) : existing.fileSize,
        pageCount: pageCount !== undefined ? Number(pageCount) : existing.pageCount,
        date: recordDate,
        isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        isDailyDefault: isDailyDefault !== undefined ? Boolean(isDailyDefault) : existing.isDailyDefault,
        targetAudience: targetAudience !== undefined ? targetAudience : existing.targetAudience,
        targetMarhala: targetMarhala !== undefined ? targetMarhala : existing.targetMarhala,
        targetClassIds: Array.isArray(targetClassIds) ? targetClassIds : existing.targetClassIds,
      },
    });

    cache.invalidateTag("tilawat-dua");
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[tilawat-dua:update] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to update Tilawat Dua record" });
  }
});

// ── 7. Toggle Active Status ──
router.patch("/:id/toggle-active", requireAuth, async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    const canManage = await canUserManageTilawatDua(authedReq);
    if (!canManage) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission." });
    }

    const { id } = req.params;
    const existing = await prisma.tilawatDua.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Tilawat Dua record not found" });
    }

    const updated = await prisma.tilawatDua.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    cache.invalidateTag("tilawat-dua");
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[tilawat-dua:toggle-active] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to toggle status" });
  }
});

// ── 8. Set Daily Default ──
router.patch("/:id/set-default", requireAuth, async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    const canManage = await canUserManageTilawatDua(authedReq);
    if (!canManage) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission." });
    }

    const { id } = req.params;
    const existing = await prisma.tilawatDua.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Tilawat Dua record not found" });
    }

    const recordDate = existing.date;
    const startOfDay = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(recordDate.getFullYear(), recordDate.getMonth(), recordDate.getDate(), 23, 59, 59, 999);

    // Clear other defaults on same date
    await prisma.tilawatDua.updateMany({
      where: {
        id: { not: id },
        date: { gte: startOfDay, lte: endOfDay },
        isDailyDefault: true,
      },
      data: { isDailyDefault: false },
    });

    const updated = await prisma.tilawatDua.update({
      where: { id },
      data: { isDailyDefault: true, isActive: true },
    });

    cache.invalidateTag("tilawat-dua");
    res.json({ success: true, data: updated });
  } catch (error: any) {
    console.error("[tilawat-dua:set-default] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to set default" });
  }
});

// ── 9. Delete Tilawat Dua Record ──
router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const authedReq = req as AuthedRequest;
    const canManage = await canUserManageTilawatDua(authedReq);
    if (!canManage) {
      return res.status(403).json({ success: false, error: "Forbidden: You do not have permission." });
    }

    const { id } = req.params;
    const existing = await prisma.tilawatDua.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Tilawat Dua record not found" });
    }

    await prisma.tilawatDua.delete({ where: { id } });

    // Clean up local disk file if present across all mirror targets
    if (existing.pdfUrl && existing.pdfUrl.startsWith("/uploads/tilawat-dua/")) {
      const fileName = path.basename(existing.pdfUrl);
      const filePath = path.join(tilawatUploadsDir, fileName);
      const clientCopyPath = path.join(clientPublicTilawatDir, fileName);
      const distCopyPath = path.join(clientDistTilawatDir, fileName);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        if (fs.existsSync(clientCopyPath)) fs.unlinkSync(clientCopyPath);
        if (fs.existsSync(distCopyPath)) fs.unlinkSync(distCopyPath);
      } catch (fileErr) {
        console.warn("[tilawat-dua:delete] File cleanup notice:", fileErr);
      }
    }

    cache.invalidateTag("tilawat-dua");
    res.json({ success: true, message: "Tilawat Dua deleted successfully" });
  } catch (error: any) {
    console.error("[tilawat-dua:delete] Error:", error);
    res.status(500).json({ success: false, error: error.message || "Failed to delete Tilawat Dua" });
  }
});

export default router;
