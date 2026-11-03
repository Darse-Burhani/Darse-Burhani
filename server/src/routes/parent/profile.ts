import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

import { parentsUploadsDir, clientPublicParentsDir, clientDistParentsDir } from "../../lib/paths";
import { cache } from "../../lib/cache";


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
router.get("/", requireRole("PARENT", "ADMIN", "TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    let userId = session.user.id;

    const includeClause = {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
          pendingAvatarUrl: true,
          avatarStatus: true,
          avatarRejectionReason: true,
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
    };

    let parent = await prisma.parentProfile.findUnique({
      where: { userId },
      include: includeClause,
    });

    if (!parent && (session.user.role === "ADMIN" || session.user.role === "TEACHER")) {
      const targetParentId = (req.query.parentId as string) || (req.query.parent as string);
      parent = await prisma.parentProfile.findFirst({
        where: targetParentId ? { OR: [{ id: targetParentId }, { userId: targetParentId }] } : undefined,
        include: includeClause,
      });
    }

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
        pendingAvatarUrl: parent.user.pendingAvatarUrl,
        avatarStatus: parent.user.avatarStatus || (parent.user.pendingAvatarUrl ? "PENDING" : "APPROVED"),
        avatarRejectionReason: parent.user.avatarRejectionReason,
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

    const savedParent = await prisma.parentProfile.upsert({
      where: { userId },
      update: profileData,
      create: {
        userId,
        ...profileData,
      },
      include: {
        studentLinks: {
          select: {
            studentId: true,
            relationship: true,
          },
        },
      },
    });

    // Synchronize parent's contact/location info to linked StudentProfiles & TalabatProfile1447
    if (savedParent.studentLinks && savedParent.studentLinks.length > 0) {
      const activeRel = (relationType || savedParent.relationType || "").toLowerCase();
      const isMother = activeRel.includes("mother");

      for (const link of savedParent.studentLinks) {
        try {
          const studentUpdate: Record<string, any> = {};
          if (address !== undefined && address?.trim()) studentUpdate.address = address.trim();
          if (city !== undefined && city?.trim()) studentUpdate.residentCity = city.trim();
          if (watan !== undefined && watan?.trim()) studentUpdate.watan = watan.trim();

          if (isMother) {
            if (phone !== undefined && phone?.trim()) studentUpdate.motherPhone = phone.trim();
            if (occupation !== undefined && occupation?.trim()) studentUpdate.motherOccupation = occupation.trim();
          } else {
            if (phone !== undefined && phone?.trim()) studentUpdate.fatherPhone = phone.trim();
            if (occupation !== undefined && occupation?.trim()) studentUpdate.fatherOccupation = occupation.trim();
          }

          if (Object.keys(studentUpdate).length > 0) {
            await prisma.studentProfile.update({
              where: { id: link.studentId },
              data: studentUpdate,
            });
          }

          // Also synchronize to Talabat yearly profile (1447)
          const yearlyUpdate: Record<string, any> = {};
          if (address !== undefined && address?.trim()) yearlyUpdate.address = address.trim();
          if (city !== undefined && city?.trim()) yearlyUpdate.residentCity = city.trim();
          if (watan !== undefined && watan?.trim()) yearlyUpdate.watan = watan.trim();

          if (isMother) {
            if (phone !== undefined && phone?.trim()) yearlyUpdate.motherMobile = phone.trim();
            if (occupation !== undefined && occupation?.trim()) yearlyUpdate.motherOccupation = occupation.trim();
            if (its !== undefined && its?.trim()) yearlyUpdate.motherIts = its.trim();
          } else {
            if (phone !== undefined && phone?.trim()) yearlyUpdate.fatherMobile = phone.trim();
            if (occupation !== undefined && occupation?.trim()) yearlyUpdate.fatherOccupation = occupation.trim();
            if (its !== undefined && its?.trim()) yearlyUpdate.fatherIts = its.trim();
          }

          if (Object.keys(yearlyUpdate).length > 0) {
            await prisma.talabatProfile1447.updateMany({
              where: { studentId: link.studentId },
              data: yearlyUpdate,
            });
          }
        } catch (syncErr) {
          console.warn(`[parent:sync] Warning syncing to student ${link.studentId}:`, syncErr);
        }
      }
    }

    // Invalidate caches across parent and student entities
    cache.invalidateTag("parentprofile");
    cache.invalidateTag("user");
    cache.invalidateTag("studentprofile");
    cache.invalidateTag("students");
    cache.invalidateTag("dashboard");

    // In-portal notification to Administration
    try {
      const parentName = `${userData.firstName || session.user.name || "Parent"} ${userData.lastName || ""}`.trim();
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true, deletedAt: null },
        select: { id: true },
      });
      for (const adm of admins) {
        await prisma.notification.create({
          data: {
            userId: adm.id,
            title: "Parent Profile Updated",
            message: `${parentName} updated their family profile details and synced them to institutional records.`,
            type: "PROFILE",
            link: "/admin/parents",
            metadata: { parentUserId: userId },
          },
        });
      }
    } catch (notifErr) {
      console.warn("[parent:profile] Notification dispatch warning:", notifErr);
    }

    return res.json({ success: true, message: "Profile updated successfully and synced with student records" });
  } catch (error) {
    console.error("Parent profile update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

// POST /api/parent/avatar - Upload profile picture with admin approval workflow
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
      const filePath = path.join(parentsUploadsDir, req.file.filename);

      // Replicate image to client public & dist upload folders for immediate preview
      try {
        if (fs.existsSync(clientPublicParentsDir)) {
          fs.copyFileSync(filePath, path.join(clientPublicParentsDir, req.file.filename));
        }
        if (fs.existsSync(clientDistParentsDir)) {
          fs.copyFileSync(filePath, path.join(clientDistParentsDir, req.file.filename));
        }
      } catch (copyErr) {
        console.warn("[parent:avatar] Replication copy notice:", copyErr);
      }

      const url = `/uploads/parents/${req.file.filename}`;

      // Save as pending approval so administrators can review and approve/reject
      await prisma.user.update({
        where: { id: userId },
        data: {
          pendingAvatarUrl: url,
          avatarStatus: "PENDING",
          avatarRejectionReason: null,
        },
      });

      cache.invalidateTag("user");
      cache.invalidateTag("parentprofile");
      cache.invalidateTag("dashboard");

      // Dispatch alert to Administrators
      try {
        const parentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstName: true, lastName: true },
        });
        const parentName = `${parentUser?.firstName || "Parent"} ${parentUser?.lastName || ""}`.trim();
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN", isActive: true, deletedAt: null },
          select: { id: true },
        });
        for (const adm of admins) {
          await prisma.notification.create({
            data: {
              userId: adm.id,
              title: "New Parent Photo For Approval",
              message: `${parentName} uploaded a new profile photo awaiting review.`,
              type: "PROFILE",
              link: "/admin/parents",
              metadata: { parentUserId: userId, pendingAvatarUrl: url },
            },
          });
        }
      } catch (notifErr) {
        console.warn("[parent:avatar] Notification warning:", notifErr);
      }

      return res.json({
        success: true,
        url,
        pending: true,
        avatarStatus: "PENDING",
        message: "Profile photo uploaded and submitted for administrator approval.",
      });
    } catch (error) {
      console.error("Parent avatar upload error:", error);
      return res.status(500).json({ success: false, error: "Failed to upload avatar" });
    }
  });
});

export default router;
