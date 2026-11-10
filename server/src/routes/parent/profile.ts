import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { parentsUploadsDir, clientPublicParentsDir, clientDistParentsDir } from "../../lib/paths";
import { cache } from "../../lib/cache";
import { sendPushToUser } from "../../lib/push";
import { getProfilePermissions } from "../../lib/profile-permissions";

const router = Router();

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
]);

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
    const mime = (file.mimetype || "").toLowerCase();
    if (ALLOWED_MIME_TYPES.has(mime)) {
      cb(null, true);
      return;
    }
    cb(new Error("Invalid file type. Allowed: JPEG, PNG, WebP, GIF, AVIF"));
  },
});

const PROFILE_INCLUDE = {
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
          classEnrollments: {
            include: {
              class: {
                include: {
                  masool: {
                    include: {
                      user: { select: { firstName: true, lastName: true, avatarUrl: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Normalizes parent profile and linked student representations into a consistent JSON shape
 */
function formatParentResponse(parent: any) {
  return {
    id: parent.id,
    userId: parent.userId,
    email: parent.user?.email || "",
    firstName: parent.user?.firstName || "",
    lastName: parent.user?.lastName || "",
    avatarUrl: parent.user?.avatarUrl || null,
    pendingAvatarUrl: parent.user?.pendingAvatarUrl || null,
    avatarStatus: parent.user?.avatarStatus || (parent.user?.pendingAvatarUrl ? "PENDING" : parent.user?.avatarUrl ? "APPROVED" : null),
    avatarRejectionReason: parent.user?.avatarRejectionReason || null,
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
    children: (parent.studentLinks || []).map((link: any) => {
      const s = link.student;
      const u = s?.user;
      const enrollmentClass = s?.classEnrollments?.[0]?.class;
      const masoolUser = enrollmentClass?.masool?.user;
      const masoolName = masoolUser
        ? `${masoolUser.firstName} ${masoolUser.lastName}`.trim()
        : enrollmentClass?.masool
        ? "Faculty Masool"
        : null;

      return {
        linkId: link.id,
        studentId: link.studentId,
        studentProfileId: s?.id || link.studentId,
        studentName: `${u?.firstName || ""} ${u?.lastName || ""}`.trim() || s?.studentId || "Student",
        firstName: u?.firstName || "",
        lastName: u?.lastName || "",
        grade: s?.grade || "",
        section: s?.section || "",
        its: s?.its || null,
        avatarUrl: u?.avatarUrl || null,
        relationship: link.relationship || parent.relationType || "Parent",
        className: enrollmentClass?.name || `${s?.grade || ""} ${s?.section || ""}`.trim(),
        masoolName,
        masoolAvatar: masoolUser?.avatarUrl || null,
        masoolIts: enrollmentClass?.masool?.its || null,
      };
    }),
  };
}

// GET /api/parent/profile/permissions - Get parent profile permissions & module locks
router.get("/permissions", requireRole("PARENT", "ADMIN"), (_req, res) => {
  const allPermissions = getProfilePermissions();
  return res.json({
    success: true,
    data: allPermissions.parent,
    modules: allPermissions.modules.parent,
  });
});

// GET /api/parent/profile - Current parent profile
router.get("/", requireRole("PARENT", "ADMIN", "TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    let userId = session.user.id;

    let parent = await prisma.parentProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });

    if (!parent && (session.user.role === "ADMIN" || session.user.role === "TEACHER")) {
      const targetParentId = (req.query.parentId as string) || (req.query.parent as string) || (req.query.userId as string);
      if (targetParentId) {
        parent = await prisma.parentProfile.findFirst({
          where: { OR: [{ id: targetParentId }, { userId: targetParentId }] },
          include: PROFILE_INCLUDE,
        });
      }
    }

    // Auto-create stub profile for PARENT role if it doesn't exist yet
    if (!parent && session.user.role === "PARENT") {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        parent = await prisma.parentProfile.create({
          data: {
            userId,
          },
          include: PROFILE_INCLUDE,
        });
      }
    }

    if (!parent) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    // Auto-heal student links if empty: link by phone or email
    if (parent.studentLinks.length === 0) {
      const matchOrConditions: any[] = [];
      if (parent.phone) {
        matchOrConditions.push({ fatherPhone: parent.phone }, { motherPhone: parent.phone });
      }
      if (parent.secondaryPhone) {
        matchOrConditions.push({ fatherPhone: parent.secondaryPhone }, { motherPhone: parent.secondaryPhone });
      }
      if (parent.user?.email) {
        matchOrConditions.push({ fatherEmail: parent.user.email }, { motherEmail: parent.user.email });
      }
      if (parent.its) {
        matchOrConditions.push({ its: parent.its });
      }

      if (matchOrConditions.length > 0) {
        try {
          const matchedStudents = await prisma.studentProfile.findMany({
            where: { OR: matchOrConditions },
            select: { id: true },
          });

          if (matchedStudents.length > 0) {
            for (const s of matchedStudents) {
              await prisma.parentStudentLink.upsert({
                where: { parentId_studentId: { parentId: parent.id, studentId: s.id } },
                create: {
                  parentId: parent.id,
                  studentId: s.id,
                  relationship: parent.relationType || "Parent",
                },
                update: {},
              });
            }

            // Reload parent profile with newly linked children
            const reloaded = await prisma.parentProfile.findUnique({
              where: { id: parent.id },
              include: PROFILE_INCLUDE,
            });
            if (reloaded) parent = reloaded;
          }
        } catch (linkErr) {
          console.warn("[parent:profile] Auto-link notice:", linkErr);
        }
      }
    }

    const allPermissions = getProfilePermissions();
    return res.json({
      success: true,
      data: formatParentResponse(parent),
      permissions: allPermissions.parent,
      modules: allPermissions.modules.parent,
    });
  } catch (error) {
    console.error("Parent profile fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch profile" });
  }
});

// PUT /api/parent/profile - Update current parent profile
router.put("/", requireRole("PARENT", "ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const isAdmin = session.user.role === "ADMIN";
    const allPermissions = getProfilePermissions();
    const permissions = allPermissions.parent;

    if (!isAdmin && permissions?.masterEnabled === false) {
      return res.status(403).json({
        success: false,
        error: "Parent profile editing is currently locked by administrator",
      });
    }

    const canEdit = (field: string) => {
      if (isAdmin) return true;
      if (permissions?.masterEnabled === false) return false;
      const itm = permissions?.items?.[field];
      return itm?.isOpen !== false;
    };

    let userId = session.user.id;

    if (session.user.role === "ADMIN" && (req.query.parentId || req.query.userId)) {
      const targetId = ((req.query.parentId || req.query.userId) as string).trim();
      const p = await prisma.parentProfile.findFirst({
        where: { OR: [{ id: targetId }, { userId: targetId }] },
        select: { userId: true },
      });
      if (p) userId = p.userId;
      else userId = targetId;
    }

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
    if (canEdit("name")) {
      if (firstName !== undefined && firstName !== null && String(firstName).trim()) {
        userData.firstName = String(firstName).trim();
      }
      if (lastName !== undefined && lastName !== null && String(lastName).trim()) {
        userData.lastName = String(lastName).trim();
      }
    }

    const profileData: Record<string, any> = {};
    if (canEdit("phone") && phone !== undefined) profileData.phone = phone ? String(phone).trim() : null;
    if (canEdit("secondaryPhone") && secondaryPhone !== undefined) profileData.secondaryPhone = secondaryPhone ? String(secondaryPhone).trim() : null;
    if (canEdit("occupation") && occupation !== undefined) profileData.occupation = occupation ? String(occupation).trim() : null;
    if (canEdit("address") && address !== undefined) profileData.address = address ? String(address).trim() : null;
    if (canEdit("address") && city !== undefined) profileData.city = city ? String(city).trim() : null;
    if (canEdit("address") && watan !== undefined) profileData.watan = watan ? String(watan).trim() : null;
    if (canEdit("bloodGroup") && bloodGroup !== undefined) profileData.bloodGroup = bloodGroup ? String(bloodGroup).trim() : null;
    if (canEdit("its") && its !== undefined) profileData.its = its ? String(its).trim() : null;
    if (canEdit("relationType") && relationType !== undefined) profileData.relationType = relationType ? String(relationType).trim() : null;
    if (canEdit("notes") && notes !== undefined) profileData.notes = notes ? String(notes).trim() : null;

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

    // If parent has no linked children, try auto-linking with phone / email / ITS
    let effectiveStudentLinks = savedParent.studentLinks || [];
    if (effectiveStudentLinks.length === 0) {
      const matchOrConditions: any[] = [];
      const parentPhone = profileData.phone || savedParent.phone;
      const parentSecondary = profileData.secondaryPhone || savedParent.secondaryPhone;
      const parentIts = profileData.its || savedParent.its;
      const parentEmail = session.user.email;

      if (parentPhone) matchOrConditions.push({ fatherPhone: parentPhone }, { motherPhone: parentPhone });
      if (parentSecondary) matchOrConditions.push({ fatherPhone: parentSecondary }, { motherPhone: parentSecondary });
      if (parentEmail) matchOrConditions.push({ fatherEmail: parentEmail }, { motherEmail: parentEmail });
      if (parentIts) matchOrConditions.push({ its: parentIts });

      if (matchOrConditions.length > 0) {
        try {
          const matchedStudents = await prisma.studentProfile.findMany({
            where: { OR: matchOrConditions },
            select: { id: true },
          });
          for (const s of matchedStudents) {
            await prisma.parentStudentLink.upsert({
              where: { parentId_studentId: { parentId: savedParent.id, studentId: s.id } },
              create: {
                parentId: savedParent.id,
                studentId: s.id,
                relationship: savedParent.relationType || "Parent",
              },
              update: {},
            });
          }
          if (matchedStudents.length > 0) {
            effectiveStudentLinks = matchedStudents.map((s) => ({
              studentId: s.id,
              relationship: savedParent.relationType || "Parent",
            }));
          }
        } catch (autoLinkErr) {
          console.warn("[parent:profile:put] Auto-link notice:", autoLinkErr);
        }
      }
    }

    // Synchronize parent's contact/location info to linked StudentProfiles & TalabatProfile1447
    if (effectiveStudentLinks && effectiveStudentLinks.length > 0) {
      const activeRel = (relationType || savedParent.relationType || "").toLowerCase();
      const isMother = activeRel.includes("mother");

      for (const link of effectiveStudentLinks) {
        try {
          const studentUpdate: Record<string, any> = {};
          if (address !== undefined && address?.trim()) studentUpdate.address = address.trim();
          if (city !== undefined && city?.trim()) studentUpdate.residentCity = city.trim();
          if (watan !== undefined && watan?.trim()) studentUpdate.watan = watan.trim();

          if (isMother) {
            if (phone !== undefined && phone?.trim()) studentUpdate.motherPhone = phone.trim();
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

          // Synchronize to yearly talabat profile (1447) with schema-safe attributes
          const yearlyUpdate: Record<string, any> = {};
          if (watan !== undefined && watan?.trim()) yearlyUpdate.vatan = watan.trim();

          if (isMother) {
            if (occupation !== undefined && occupation?.trim()) yearlyUpdate.motherOccupation = occupation.trim();
          } else {
            if (occupation !== undefined && occupation?.trim()) yearlyUpdate.fatherOccupation = occupation.trim();
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
      const parentName = `${userData.firstName || (session.user as any).name || (session.user as any).firstName || "Parent"} ${userData.lastName || ""}`.trim();
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true, deletedAt: null },
        select: { id: true },
      });

      if (admins.length > 0) {
        await prisma.notification.createMany({
          data: admins.map((adm) => ({
            userId: adm.id,
            title: "Parent Profile Updated",
            body: `${parentName} updated their family profile details and synced them to institutional records.`,
            type: "PROFILE",
            link: "/admin/parents",
          })),
        });

        for (const adm of admins) {
          sendPushToUser(adm.id, {
            title: "Parent Profile Updated",
            body: `${parentName} updated their family profile details.`,
            url: "/admin/parents",
          }).catch(() => {});
        }
      }
    } catch (notifErr) {
      console.warn("[parent:profile] Notification dispatch warning:", notifErr);
    }

    // Fetch freshly refreshed parent object
    const updatedParent = await prisma.parentProfile.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });

    return res.json({
      success: true,
      message: "Profile updated successfully and synced with student records",
      data: updatedParent ? formatParentResponse(updatedParent) : null,
    });
  } catch (error) {
    console.error("Parent profile update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update profile" });
  }
});

// POST /api/parent/avatar or /api/parent/profile/avatar - Upload profile picture with admin approval workflow
router.post(["/avatar", "/avatar/upload", "/"], requireRole("PARENT", "ADMIN"), (req, res) => {
  const session = req.auth!;
  const isAdmin = session.user.role === "ADMIN";
  const permissions = getProfilePermissions().parent;

  if (!isAdmin && (permissions?.masterEnabled === false || permissions?.items?.photo?.isOpen === false)) {
    return res.status(403).json({
      success: false,
      error: "Photo uploading is currently locked by administrator",
    });
  }

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
      let targetUserId = session.user.id;
      if (session.user.role === "ADMIN" && (req.query.parentId || req.query.userId)) {
        const targetId = ((req.query.parentId || req.query.userId) as string).trim();
        const p = await prisma.parentProfile.findFirst({
          where: { OR: [{ id: targetId }, { userId: targetId }] },
          select: { userId: true },
        });
        if (p) targetUserId = p.userId;
        else targetUserId = targetId;
      }

      const filePath = path.join(parentsUploadsDir, req.file.filename);

      // Replicate image to client public & dist upload folders for immediate preview
      try {
        fs.mkdirSync(clientPublicParentsDir, { recursive: true });
        fs.copyFileSync(filePath, path.join(clientPublicParentsDir, req.file.filename));
      } catch (copyErr) {
        console.warn("[parent:avatar] Replication copy notice:", copyErr);
      }

      try {
        fs.mkdirSync(clientDistParentsDir, { recursive: true });
        fs.copyFileSync(filePath, path.join(clientDistParentsDir, req.file.filename));
      } catch (distCopyErr) {
        console.warn("[parent:avatar] Dist copy notice:", distCopyErr);
      }

      const url = `/uploads/parents/${req.file.filename}`;
      const isAdminUpload = session.user.role === "ADMIN";

      // If uploaded by admin, automatically approve; if by parent, stage as PENDING for admin review
      await prisma.user.update({
        where: { id: targetUserId },
        data: isAdminUpload
          ? {
              avatarUrl: url,
              pendingAvatarUrl: null,
              avatarStatus: "APPROVED",
              avatarRejectionReason: null,
            }
          : {
              pendingAvatarUrl: url,
              avatarStatus: "PENDING",
              avatarRejectionReason: null,
            },
      });

      cache.invalidateTag("user");
      cache.invalidateTag("parentprofile");
      cache.invalidateTag("dashboard");

      // Dispatch alert to Administrators if submitted by parent
      if (!isAdminUpload) {
        try {
          const parentUser = await prisma.user.findUnique({
            where: { id: targetUserId },
            select: { firstName: true, lastName: true },
          });
          const parentName = `${parentUser?.firstName || "Parent"} ${parentUser?.lastName || ""}`.trim();
          const admins = await prisma.user.findMany({
            where: { role: "ADMIN", isActive: true, deletedAt: null },
            select: { id: true },
          });

          if (admins.length > 0) {
            await prisma.notification.createMany({
              data: admins.map((adm) => ({
                userId: adm.id,
                title: "New Parent Photo For Approval",
                body: `${parentName} uploaded a new profile photo awaiting review.`,
                type: "PROFILE",
                link: "/admin/parents",
              })),
            });

            for (const adm of admins) {
              sendPushToUser(adm.id, {
                title: "New Parent Photo For Approval",
                body: `${parentName} uploaded a new profile photo awaiting review.`,
                url: "/admin/parents",
              }).catch(() => {});
            }
          }
        } catch (notifErr) {
          console.warn("[parent:avatar] Notification warning:", notifErr);
        }
      }

      return res.json({
        success: true,
        url,
        pending: !isAdminUpload,
        avatarStatus: isAdminUpload ? "APPROVED" : "PENDING",
        message: isAdminUpload
          ? "Profile photo updated successfully."
          : "Profile photo uploaded and submitted for administrator approval.",
      });
    } catch (error) {
      console.error("Parent avatar upload error:", error);
      return res.status(500).json({ success: false, error: "Failed to upload avatar" });
    }
  });
});

// DELETE /api/parent/avatar or /api/parent/profile/avatar - Remove avatar or cancel pending approval
router.delete(["/avatar", "/"], requireRole("PARENT", "ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    let targetUserId = session.user.id;

    if (session.user.role === "ADMIN" && (req.query.parentId || req.query.userId)) {
      const targetId = ((req.query.parentId || req.query.userId) as string).trim();
      const p = await prisma.parentProfile.findFirst({
        where: { OR: [{ id: targetId }, { userId: targetId }] },
        select: { userId: true },
      });
      if (p) targetUserId = p.userId;
      else targetUserId = targetId;
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { avatarUrl: true, pendingAvatarUrl: true },
    });

    // Clean up physical file on disk if it was an uploaded parent file
    try {
      const fileUrl = existingUser?.pendingAvatarUrl || existingUser?.avatarUrl;
      if (fileUrl && fileUrl.includes("/uploads/parents/")) {
        const filename = path.basename(fileUrl);
        if (filename && filename.startsWith("parent-")) {
          const p1 = path.join(parentsUploadsDir, filename);
          const p2 = path.join(clientPublicParentsDir, filename);
          const p3 = path.join(clientDistParentsDir, filename);
          if (fs.existsSync(p1)) fs.unlinkSync(p1);
          if (fs.existsSync(p2)) fs.unlinkSync(p2);
          if (fs.existsSync(p3)) fs.unlinkSync(p3);
        }
      }
    } catch (fileErr) {
      console.warn("[parent:avatar] File unlink notice:", fileErr);
    }

    await prisma.user.update({
      where: { id: targetUserId },
      data: {
        avatarUrl: null,
        pendingAvatarUrl: null,
        avatarStatus: null,
        avatarRejectionReason: null,
      },
    });

    cache.invalidateTag("user");
    cache.invalidateTag("parentprofile");
    cache.invalidateTag("dashboard");

    return res.json({
      success: true,
      message: "Profile photo removed successfully.",
    });
  } catch (error) {
    console.error("Parent avatar delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to remove avatar" });
  }
});

export default router;
