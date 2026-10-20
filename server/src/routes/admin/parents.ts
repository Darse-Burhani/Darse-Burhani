import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { completelyDeleteUser } from "../../lib/user-deletion";
import { cache } from "../../lib/cache";

const { hash } = bcrypt;
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

// GET /api/admin/parents - Full parent profiles list
router.get("/", requireRole("ADMIN", "TEACHER"), async (_req, res) => {
  try {
    const parents = await prisma.parentProfile.findMany({
      where: {
        user: { deletedAt: null, isActive: true },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            plainPassword: true,
            isActive: true,
            createdAt: true,
          },
        },
        studentLinks: {
          where: {
            student: {
              user: { deletedAt: null, isActive: true },
            },
          },
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
                talabatProfile1447: {
                  select: {
                    fatherPhotoUrl: true,
                    motherPhotoUrl: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        user: { createdAt: "desc" },
      },
    });

    const formattedParents = parents.map((parent) => {
      const isMother = (parent.relationType || "").toLowerCase().includes("mother");
      const firstChildYearlyProfile = parent.studentLinks[0]?.student?.talabatProfile1447;
      const yearlyParentPhoto = isMother
        ? firstChildYearlyProfile?.motherPhotoUrl
        : (firstChildYearlyProfile?.fatherPhotoUrl || firstChildYearlyProfile?.motherPhotoUrl);

      return {
        id: parent.id,
        userId: parent.userId,
        email: parent.user.email,
        firstName: parent.user.firstName,
        lastName: parent.user.lastName,
        avatarUrl: parent.user.avatarUrl || yearlyParentPhoto || null,
        plainPassword: parent.user.plainPassword,
        isActive: parent.user.isActive,
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
          linkId: link.id,
          studentId: link.studentId,
          studentName: `${link.student.user.firstName} ${link.student.user.lastName}`,
          grade: link.student.grade,
          section: link.student.section,
          avatarUrl: link.student.user.avatarUrl,
          fatherPhotoUrl: link.student.talabatProfile1447?.fatherPhotoUrl || null,
          motherPhotoUrl: link.student.talabatProfile1447?.motherPhotoUrl || null,
          relationship: link.relationship,
        })),
      };
    });

    return res.json({ success: true, data: formattedParents });
  } catch (error) {
    console.error("Parents fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch parents" });
  }
});

// POST /api/admin/parents - Create new parent profile
router.post("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const body = req.body as Record<string, any>;
    const {
      email,
      password,
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
      avatarUrl,
    } = body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ success: false, error: "First name, last name, and email are required." });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existingUser) {
      return res.status(409).json({ success: false, error: "A user with this email already exists." });
    }

    const defaultPassword = password || "parent5253";
    const passwordHash = await hash(defaultPassword, 10);

    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        passwordHash,
        plainPassword: defaultPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: "PARENT",
        avatarUrl: avatarUrl || null,
        parentProfile: {
          create: {
            phone: phone?.trim() || null,
            secondaryPhone: secondaryPhone?.trim() || null,
            occupation: occupation?.trim() || null,
            address: address?.trim() || null,
            city: city?.trim() || null,
            watan: watan?.trim() || null,
            bloodGroup: bloodGroup?.trim() || null,
            its: its?.trim() || null,
            relationType: relationType?.trim() || null,
            notes: notes?.trim() || null,
          },
        },
      },
      include: {
        parentProfile: true,
      },
    });

    // If studentId or studentIds provided, link them immediately
    const rawStudentIds = body.studentIds || (body.studentId ? [body.studentId] : []);
    if (Array.isArray(rawStudentIds) && rawStudentIds.length > 0 && user.parentProfile) {
      for (const sId of rawStudentIds) {
        if (!sId) continue;
        const student = await prisma.studentProfile.findFirst({
          where: { OR: [{ id: sId }, { userId: sId }, { studentId: sId }] },
        });
        if (student) {
          await prisma.parentStudentLink.upsert({
            where: {
              parentId_studentId: {
                parentId: user.parentProfile.id,
                studentId: student.id,
              },
            },
            create: {
              parentId: user.parentProfile.id,
              studentId: student.id,
              relationship: relationType || "Parent",
            },
            update: {
              relationship: relationType || "Parent",
            },
          });
        }
      }
    }

    cache.invalidateTag("parentprofile");
    cache.invalidateTag("dashboard");

    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    console.error("Parent create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create parent profile" });
  }
});

// POST /api/admin/parents/sync-and-link - Automated linking of all parents from Talabat profiles
router.post("/sync-and-link", requireRole("ADMIN"), async (_req, res) => {
  try {
    const PARENT_PASSWORD = "parent5253";
    const passwordHash = await hash(PARENT_PASSWORD, 10);

    const students = await prisma.studentProfile.findMany({
      include: { user: true },
      orderBy: { its: "asc" },
    });

    let fatherUsersCreated = 0;
    let motherUsersCreated = 0;
    let linksCreated = 0;
    let studentsProcessed = 0;

    const getOrCreateParent = async (
      emailRaw: string,
      relationType: string,
      watan?: string | null,
      city?: string | null
    ) => {
      const email = emailRaw.toLowerCase().trim();
      const emailName = email.split("@")[0].trim();

      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: { parentProfile: true },
      });

      if (existingUser) {
        let parentProfileId = existingUser.parentProfile?.id;
        if (!parentProfileId) {
          const newProfile = await prisma.parentProfile.create({
            data: {
              userId: existingUser.id,
              relationType,
              watan: watan || null,
              city: city || null,
            },
          });
          parentProfileId = newProfile.id;
        }
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            role: "PARENT",
            plainPassword: PARENT_PASSWORD,
            isActive: true,
          },
        });
        return { userId: existingUser.id, parentProfileId };
      }

      const newUser = await prisma.user.create({
        data: {
          email,
          passwordHash,
          plainPassword: PARENT_PASSWORD,
          firstName: emailName.charAt(0).toUpperCase() + emailName.slice(1),
          lastName: "",
          role: "PARENT",
          isActive: true,
          parentProfile: {
            create: {
              relationType,
              watan: watan || null,
              city: city || null,
            },
          },
        },
        include: { parentProfile: true },
      });

      return { userId: newUser.id, parentProfileId: newUser.parentProfile!.id };
    };

    for (const student of students) {
      const fEmail = student.fatherEmail?.toLowerCase().trim() || null;
      const mEmail = student.motherEmail?.toLowerCase().trim() || null;

      if (!fEmail && !mEmail) continue;
      studentsProcessed++;

      if (fEmail && mEmail && fEmail === mEmail) {
        // Shared Parent Account
        const { parentProfileId } = await getOrCreateParent(
          fEmail,
          "Father & Mother",
          student.watan,
          student.residentCity
        );

        await prisma.parentStudentLink.upsert({
          where: {
            parentId_studentId: {
              parentId: parentProfileId,
              studentId: student.id,
            },
          },
          create: {
            parentId: parentProfileId,
            studentId: student.id,
            relationship: "Father & Mother",
          },
          update: {
            relationship: "Father & Mother",
          },
        });
        fatherUsersCreated++;
        linksCreated++;
      } else {
        if (fEmail) {
          const { parentProfileId: fatherProfileId } = await getOrCreateParent(
            fEmail,
            "Father",
            student.watan,
            student.residentCity
          );

          await prisma.parentStudentLink.upsert({
            where: {
              parentId_studentId: {
                parentId: fatherProfileId,
                studentId: student.id,
              },
            },
            create: {
              parentId: fatherProfileId,
              studentId: student.id,
              relationship: "Father",
            },
            update: {
              relationship: "Father",
            },
          });
          fatherUsersCreated++;
          linksCreated++;
        }

        if (mEmail) {
          const { parentProfileId: motherProfileId } = await getOrCreateParent(
            mEmail,
            "Mother",
            student.watan,
            student.residentCity
          );

          await prisma.parentStudentLink.upsert({
            where: {
              parentId_studentId: {
                parentId: motherProfileId,
                studentId: student.id,
              },
            },
            create: {
              parentId: motherProfileId,
              studentId: student.id,
              relationship: "Mother",
            },
            update: {
              relationship: "Mother",
            },
          });
          motherUsersCreated++;
          linksCreated++;
        }
      }
    }

    cache.invalidateTag("parentprofile");
    cache.invalidateTag("user");
    cache.invalidateTag("dashboard");

    const [totalParents, totalLinks] = await Promise.all([
      prisma.user.count({ where: { role: "PARENT" } }),
      prisma.parentStudentLink.count(),
    ]);

    return res.json({
      success: true,
      message: `Processed ${studentsProcessed} talabat. Created/verified ${linksCreated} parent-student connections.`,
      data: {
        studentsProcessed,
        fatherUsersCreated,
        motherUsersCreated,
        linksCreated,
        totalParents,
        totalLinks,
      },
    });
  } catch (error) {
    console.error("Sync and link parents error:", error);
    return res.status(500).json({ success: false, error: "Failed to sync and link parents" });
  }
});

// PUT /api/admin/parents - Update parent profile
router.put("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const body = req.body as Record<string, any>;
    const {
      userId,
      email,
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
      avatarUrl,
      isActive,
    } = body;

    if (!userId) {
      return res.status(400).json({ success: false, error: "User ID is required" });
    }

    // Check email conflict if changing email
    if (email) {
      const existingUser = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (existingUser && existingUser.id !== userId) {
        return res.status(409).json({ success: false, error: "Email already exists" });
      }
    }

    const userData: Record<string, any> = {};
    if (email !== undefined) userData.email = email.trim().toLowerCase();
    if (firstName !== undefined) userData.firstName = firstName.trim();
    if (lastName !== undefined) userData.lastName = lastName.trim();
    if (avatarUrl !== undefined) userData.avatarUrl = avatarUrl || null;
    if (isActive !== undefined) userData.isActive = Boolean(isActive);

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

    // Update user
    if (Object.keys(userData).length > 0) {
      await prisma.user.update({
        where: { id: userId },
        data: userData,
      });
    }

    // Upsert parent profile
    if (Object.keys(profileData).length > 0) {
      await prisma.parentProfile.upsert({
        where: { userId },
        update: profileData,
        create: {
          userId,
          ...profileData,
        },
      });
    }

    return res.json({ success: true, message: "Parent profile updated successfully" });
  } catch (error) {
    console.error("Parent update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update parent profile" });
  }
});

// POST /api/admin/parents/:userId/avatar - Upload profile picture for parent
router.post("/:userId/avatar", requireRole("ADMIN", "TEACHER"), (req, res) => {
  const { userId } = req.params;
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
      const parent = await prisma.parentProfile.findUnique({
        where: { userId },
        select: { id: true },
      });
      if (!parent) {
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ success: false, error: "Parent not found" });
      }

      const url = `/uploads/parents/${req.file.filename}`;
      await prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } });

      return res.json({ success: true, url });
    } catch (error) {
      console.error("Parent avatar upload error:", error);
      return res.status(500).json({ success: false, error: "Failed to upload avatar" });
    }
  });
});

// DELETE /api/admin/parents?id=xxx or ?userId=xxx
router.delete("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const id = (req.query.id as string) || (req.query.parentId as string) || (req.body?.id as string);
    const userId = (req.query.userId as string) || (req.body?.userId as string);

    if (!id && !userId) {
      return res.status(400).json({ success: false, error: "Parent ID or User ID is required" });
    }

    const targetId = userId || id;
    const result = await completelyDeleteUser(targetId);

    cache.invalidateTag("user");
    cache.invalidateTag("parentprofile");
    cache.invalidateTag("dashboard");

    return res.json({
      success: true,
      message: "Parent profile completely purged from database.",
      data: result,
    });
  } catch (error: any) {
    console.error("Parent delete error:", error);
    const status = error?.message?.includes("Master system administrator") ? 403 : 400;
    return res.status(status).json({ success: false, error: error?.message || "Failed to delete parent" });
  }
});

// DELETE /api/admin/parents/:id
router.delete("/:id", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: "Parent identifier is required" });
    }
    const result = await completelyDeleteUser(id);

    cache.invalidateTag("user");
    cache.invalidateTag("parentprofile");
    cache.invalidateTag("dashboard");

    return res.json({
      success: true,
      message: "Parent profile completely purged from database.",
      data: result,
    });
  } catch (error: any) {
    console.error("Parent delete error:", error);
    const status = error?.message?.includes("Master system administrator") ? 403 : 400;
    return res.status(status).json({ success: false, error: error?.message || "Failed to delete parent" });
  }
});

// POST /api/admin/parents/reset-password
router.post("/reset-password", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const { userId, newPassword } = req.body as { userId?: string; newPassword?: string };

    if (!userId || !newPassword) {
      return res.status(400).json({ success: false, error: "User ID and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: "Password must be at least 6 characters long" });
    }

    const passwordHash = await hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        plainPassword: newPassword,
      },
    });

    // Invalidate existing sessions for this user so they must log in with the new password
    await prisma.session.deleteMany({ where: { userId } });

    return res.json({ success: true, message: "Parent password has been reset successfully" });
  } catch (error) {
    console.error("Parent reset password error:", error);
    return res.status(500).json({ success: false, error: "Failed to reset parent password" });
  }
});

export default router;
