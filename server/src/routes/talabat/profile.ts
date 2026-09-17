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

  if (!user || !user.studentProfile) {
    return res.status(404).json({ error: "Student profile not found" });
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
  const canEditPhoto = isAdmin || talabatPerms.photo?.isOpen !== false;
  if (canEditPhoto && (body.avatarUrl !== undefined || body.photoUrl !== undefined)) {
    userUpdateData.avatarUrl = body.avatarUrl || body.photoUrl || null;
  }

  // Personal Information Region
  const canEditPersonal = isAdmin || talabatPerms.personal?.isOpen !== false;
  if (canEditPersonal) {
    if (body.age !== undefined) updateData.age = body.age ? parseInt(String(body.age), 10) : null;
    if (body.status !== undefined) updateData.status = body.status || null;
    if (body.bloodGroup !== undefined) updateData.bloodGroup = body.bloodGroup || null;
    if (body.dobGregorian !== undefined) updateData.dobGregorian = body.dobGregorian ? new Date(body.dobGregorian) : null;
    if (body.dobHijri !== undefined) updateData.dobHijri = body.dobHijri || null;
    if (body.hafizYear !== undefined) updateData.hafizYear = body.hafizYear || null;
    if (body.nameAr !== undefined) updateData.nameAr = body.nameAr || null;
  }

  // Academic Information Region
  const canEditAcademic = isAdmin || talabatPerms.academic?.isOpen !== false;
  if (canEditAcademic) {
    if (body.admissionYear !== undefined) updateData.admissionYear = body.admissionYear || null;
    if (body.currentYear !== undefined) updateData.currentYear = body.currentYear || null;
    if (body.darsId !== undefined) updateData.darsId = body.darsId || null;
    if (body.externalSchooling !== undefined) updateData.externalSchooling = body.externalSchooling || null;
    if (body.grade !== undefined) updateData.grade = body.grade || undefined;
    if (body.section !== undefined) updateData.section = body.section || undefined;
  }

  // Contact & Location Region
  const canEditContact = isAdmin || talabatPerms.contact?.isOpen !== false;
  if (canEditContact) {
    if (body.watan !== undefined) updateData.watan = body.watan || null;
    if (body.residentCity !== undefined) updateData.residentCity = body.residentCity || null;
    if (body.address !== undefined) updateData.address = body.address || null;
    if (body.mobileNumber !== undefined) updateData.mobileNumber = body.mobileNumber || null;
  }

  // Identifiers Region (Only if explicitly open or Admin)
  const canEditIdentifiers = isAdmin || talabatPerms.identifiers?.isOpen === true;
  if (canEditIdentifiers) {
    if (body.its !== undefined) updateData.its = body.its || null;
    if (body.trNo !== undefined) updateData.trNo = body.trNo || null;
  }

  if (Object.keys(userUpdateData).length > 0) {
    await prisma.user.update({
      where: { id: user.id },
      data: userUpdateData,
    });
  }

  const updatedProfile = await prisma.studentProfile.update({
    where: { id: user.studentProfile.id },
    data: updateData,
  });

  return res.json({
    success: true,
    data: {
      ...updatedProfile,
      avatarUrl: userUpdateData.avatarUrl !== undefined ? userUpdateData.avatarUrl : user.avatarUrl,
    },
  });
});

export default router;
