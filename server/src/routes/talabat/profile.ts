import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth } from "../../middleware";
import { getProfilePermissions } from "../../lib/profile-permissions";

const router = Router();

// GET /api/talabat/profile/permissions - Get region lock status for the student view
router.get("/permissions", requireAuth, (req, res) => {
  const permissions = getProfilePermissions();
  return res.json({
    success: true,
    data: permissions.talabat || permissions,
    modules: permissions.modules?.talabat,
  });
});

// GET /api/talabat/profile - Fetch student profile with parent privacy applied
router.get("/", requireAuth, async (req, res) => {
  const session = req.auth!;
  const isAdmin = session.user.role === "ADMIN";

  const targetUserId = (isAdmin && (req.query.userId as string)) || session.user.id;
  const targetStudentId = (isAdmin && (req.query.studentId as string)) || undefined;

  const user = await prisma.user.findFirst({
    where: targetStudentId
      ? { studentProfile: { id: targetStudentId } }
      : { id: targetUserId },
    include: { studentProfile: true },
  });

  if (!user || !user.studentProfile) {
    return res.status(404).json({ error: "Student profile not found" });
  }

  const profile: any = {
    ...user.studentProfile,
    avatarUrl: user.avatarUrl,
    firstName: user.firstName,
    lastName: user.lastName,
    name: `${user.firstName} ${user.lastName}`.trim(),
    email: user.email,
  };

  const permissions = getProfilePermissions();

  // If parents region is not visible to student, wipe parent contact data from payload
  const isParentsVisible = permissions.talabat?.parents?.isVisible !== false && 
    (permissions.talabat?.parents?.isVisibleToStudent !== false && permissions.parents?.isVisibleToStudent !== false);

  if (!isAdmin && !isParentsVisible) {
    profile.fatherEmail = null;
    profile.motherEmail = null;
    profile.fatherPhone = null;
    profile.motherPhone = null;
    profile.fatherOccupation = null;
    profile.fatherName = null;
    profile.motherName = null;
  }

  return res.json({
    success: true,
    data: profile,
    permissions: permissions.talabat || permissions,
    modules: permissions.modules?.talabat,
    // root level fields for backwards compatibility
    ...profile,
  });
});

// PUT /api/talabat/profile - Save student profile changes respecting regional permissions
router.put("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const isAdmin = session.user.role === "ADMIN";

    const targetUserId = (isAdmin && (req.query.userId as string || req.body.userId)) || session.user.id;
    const targetStudentId = (isAdmin && (req.query.studentId as string || req.body.studentProfileId)) || undefined;

    const user = await prisma.user.findFirst({
      where: targetStudentId
        ? { studentProfile: { id: targetStudentId } }
        : { id: targetUserId },
      include: { studentProfile: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Auto-create studentProfile if user exists but profile record is missing
    let studentProfile = user.studentProfile;
    if (!studentProfile) {
      studentProfile = await prisma.studentProfile.create({
        data: {
          userId: user.id,
          studentId: user.email?.split("@")[0] || `STD-${Date.now().toString().slice(-6)}`,
          grade: "1",
          section: "A",
        },
      });
    }

    const permissions = getProfilePermissions();
    const talabatPerms = permissions.talabat || permissions;

    if (!isAdmin && talabatPerms.masterEnabled === false) {
      return res.status(403).json({
        success: false,
        error: "Talabat profile editing is currently locked by administrator",
      });
    }

    const body = req.body as Record<string, any>;
    const updateData: Record<string, any> = {};
    const userUpdateData: Record<string, any> = {};

    // Photo
    const canEditPhoto = isAdmin || (talabatPerms.masterEnabled !== false && talabatPerms.photo?.isOpen !== false);
    if (canEditPhoto && (body.avatarUrl !== undefined || body.photoUrl !== undefined)) {
      userUpdateData.avatarUrl = body.avatarUrl || body.photoUrl || null;
    }

    // Personal Information Region
    const canEditPersonal = isAdmin || (talabatPerms.masterEnabled !== false && talabatPerms.personal?.isOpen !== false);
    if (canEditPersonal) {
      if (body.age !== undefined) {
        if (body.age === null || body.age === "" || body.age === undefined) {
          updateData.age = null;
        } else {
          const parsed = parseInt(String(body.age), 10);
          updateData.age = !isNaN(parsed) ? parsed : null;
        }
      }

      if (body.status !== undefined) {
        if (!body.status) {
          updateData.status = null;
        } else {
          const norm = String(body.status).trim().toUpperCase();
          updateData.status = norm === "HAFIZ" || norm === "SANAH" ? norm : null;
        }
      }

      if (body.bloodGroup !== undefined) updateData.bloodGroup = body.bloodGroup ? String(body.bloodGroup).trim() : null;

      if (body.dobGregorian !== undefined) {
        if (!body.dobGregorian) {
          updateData.dobGregorian = null;
        } else {
          const d = new Date(body.dobGregorian);
          updateData.dobGregorian = !isNaN(d.getTime()) ? d : null;
        }
      }

      if (body.dobHijri !== undefined) updateData.dobHijri = body.dobHijri ? String(body.dobHijri).trim() : null;
      if (body.hafizYear !== undefined) updateData.hafizYear = body.hafizYear ? String(body.hafizYear).trim() : null;
      if (body.nameAr !== undefined) updateData.nameAr = body.nameAr ? String(body.nameAr).trim() : null;
    }

    // Academic Information Region
    const canEditAcademic = isAdmin || (talabatPerms.masterEnabled !== false && talabatPerms.academic?.isOpen !== false);
    if (canEditAcademic) {
      if (body.admissionYear !== undefined) updateData.admissionYear = body.admissionYear ? String(body.admissionYear).trim() : null;
      if (body.currentYear !== undefined) updateData.currentYear = body.currentYear ? String(body.currentYear).trim() : null;
      if (body.darsId !== undefined) updateData.darsId = body.darsId ? String(body.darsId).trim() : null;
      if (body.externalSchooling !== undefined) updateData.externalSchooling = body.externalSchooling ? String(body.externalSchooling).trim() : null;
      if (body.grade !== undefined && body.grade) updateData.grade = String(body.grade).trim();
      if (body.section !== undefined && body.section) updateData.section = String(body.section).trim();
    }

    // Contact & Location Region
    const canEditContact = isAdmin || (talabatPerms.masterEnabled !== false && talabatPerms.contact?.isOpen !== false);
    if (canEditContact) {
      if (body.watan !== undefined) updateData.watan = body.watan ? String(body.watan).trim() : null;
      if (body.residentCity !== undefined) updateData.residentCity = body.residentCity ? String(body.residentCity).trim() : null;
      if (body.address !== undefined) updateData.address = body.address ? String(body.address).trim() : null;
      if (body.mobileNumber !== undefined) updateData.mobileNumber = body.mobileNumber ? String(body.mobileNumber).trim() : null;
    }

    // Identifiers Region
    const canEditIdentifiers = isAdmin || (talabatPerms.masterEnabled !== false && talabatPerms.identifiers?.isOpen !== false);
    if (canEditIdentifiers) {
      if (body.its !== undefined) updateData.its = body.its ? String(body.its).trim() : null;
      if (body.trNo !== undefined) updateData.trNo = body.trNo ? String(body.trNo).trim() : null;
    }

    // Parents Details & Contact Region
    const canEditParents = isAdmin || (talabatPerms.masterEnabled !== false && talabatPerms.parents?.isOpen !== false);
    if (canEditParents) {
      if (body.fatherName !== undefined) updateData.fatherName = body.fatherName ? String(body.fatherName).trim() : null;
      if (body.motherName !== undefined) updateData.motherName = body.motherName ? String(body.motherName).trim() : null;
      if (body.fatherPhone !== undefined) updateData.fatherPhone = body.fatherPhone ? String(body.fatherPhone).trim() : null;
      if (body.motherPhone !== undefined) updateData.motherPhone = body.motherPhone ? String(body.motherPhone).trim() : null;
      if (body.fatherEmail !== undefined) updateData.fatherEmail = body.fatherEmail ? String(body.fatherEmail).trim() : null;
      if (body.motherEmail !== undefined) updateData.motherEmail = body.motherEmail ? String(body.motherEmail).trim() : null;
      if (body.fatherOccupation !== undefined) updateData.fatherOccupation = body.fatherOccupation ? String(body.fatherOccupation).trim() : null;
    }

    if (isAdmin) {
      if (body.firstName !== undefined && body.firstName.trim()) userUpdateData.firstName = body.firstName.trim();
      if (body.lastName !== undefined && body.lastName.trim()) userUpdateData.lastName = body.lastName.trim();
      if (body.email !== undefined && body.email.trim()) userUpdateData.email = body.email.trim();
    }

    if (Object.keys(userUpdateData).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: userUpdateData,
      });
    }

    let updatedProfile = studentProfile;
    if (Object.keys(updateData).length > 0) {
      updatedProfile = await prisma.studentProfile.update({
        where: { id: studentProfile.id },
        data: updateData,
      });
    }

    return res.json({
      success: true,
      data: {
        ...updatedProfile,
        avatarUrl: userUpdateData.avatarUrl !== undefined ? userUpdateData.avatarUrl : user.avatarUrl,
      },
    });
  } catch (err: any) {
    console.error("Error updating talabat profile:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to update talabat profile",
    });
  }
});

export default router;
