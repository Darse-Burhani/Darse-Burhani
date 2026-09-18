
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "node:url";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const parentsUploadsDir = path.join(repoRoot, "public", "uploads", "parents");

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(parentsUploadsDir, { recursive: true });
      cb(null, parentsUploadsDir);
    },
    filename: (_req, file, cb) => {
      const ext = (file.originalname.split(".").pop() || "jpg").toLowerCase();
      cb(null, `parent-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Invalid file type. Allowed: JPEG, PNG, WebP, GIF, AVIF"));
  },
});

// GET /api/parent/profile - Current parent profile
router.get("/", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const userId = session.user.id;

    const parent = await prisma.parentProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
        studentLinks: {
          include: {
            student: {
              include: {
                user: {
                  select: {
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!parent) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    return res.json({
      success: true,
      data: {
        id: parent.id,
        userId: parent.userId,
        email: parent.user.email,
        firstName: parent.user.firstName,
        lastName: parent.user.lastName,
        avatarUrl: parent.user.avatarUrl,
        phone: parent.phone,
        secondaryPhone: parent.secondaryPhone,
        occupation: parent.occupation,
        address: parent.address,
        city: parent.city,
        watan: parent.watan,
        bloodGroup: parent.bloodGroup,
        its: parent.its,
        relationType: parent.relationType,
        notes: parent.notes,
        children: parent.studentLinks.map((link) => ({
          studentId: link.studentId,
          studentName: `${link.student.user.firstName} ${link.student.user.lastName}`,
          grade: link.student.grade,
          section: link.student.section,
          avatarUrl: link.student.user.avatarUrl,
          relationship: link.relationship,
        })),
      },
    });
  } catch (error) {
    console.error("Parent profile fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch profile" });
  }
});

// PUT /api/parent/profile - Update current parent profile
router.put("/", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const userId = session.user.id;
    const body = req.body as Record<string, any>;
    const {
      firstName,
      lastName,
      phone,
      secondaryPhone,
      occupation,
      address,
      city,
      watan,
      bloodGroup,
      its,
      relationType,
      notes,
    } = body;

    const userData: Record<string, any> = {};
    if (firstName !== undefined) userData.firstName = firstName.trim();
    if (lastName !== undefined) userData.lastName = lastName.trim();

    const profileData: Record<string, any> = {};
    if (phone !== undefined) profileData.phone = phone?.trim() || null;
    if (secondaryPhone !== undefined) profileData.secondaryPhone = secondaryPhone?.trim() || null;
    if (occupation !== undefined) profileData.occupation = occupation?.trim() || null;
    if (address !== undefined) profileData.address = address?.trim() || null;
    if (city !== undefined) profileData.city = city?.trim() || null;
    if (watan !== undefined) profileData.watan = watan?.trim() || null;
    if (bloodGroup !== undefined) profileData.bloodGroup = bloodGroup?.trim() || null;
    if (its !== undefined) profileData.its = its?.trim() || null;
    if (relationType !== undefined) profileData.relationType = relationType?.trim() || null;
    if (notes !== undefined) profileData.notes = notes?.trim() || null;

    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userData,
      });
    }

    await prisma.parentProfile.upsert({
      where: { userId },
      update: profileData,
      create: {
        userId,
        ...profileData,
      },
    });

    return res.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Parent profile update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

// POST /api/parent/avatar - Upload profile picture
router.post("/avatar", requireRole("PARENT"), (req, res) => {
  const session = req.auth!;
  const userId = session.user.id;

  avatarUpload.single("file")(req, res, async (err: unknown) => {
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

    try {
      const url = `/uploads/parents/${req.file.filename}`;
      await prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });

      return res.json({ success: true, url });
    } catch (error) {
      console.error("Parent avatar upload error:", error);
      return res.status(500).json({ success: false, error: "Failed to upload avatar" });
    }
  });
});

export default router;
