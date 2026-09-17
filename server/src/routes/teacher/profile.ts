import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth } from "../../middleware";
import { getProfilePermissions } from "../../lib/profile-permissions";

const router = Router();

// GET /api/teacher/profile/permissions - Get teacher profile edit permissions
router.get("/permissions", requireAuth, (req, res) => {
  const allPermissions = getProfilePermissions();
  return res.json({
    success: true,
    data: allPermissions.teacher,
    modules: allPermissions.modules.teacher,
  });
});

// GET /api/teacher/profile - Fetch current teacher profile
router.get("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;

    // Also support admin querying a specific teacher via ?userId=, ?id=, ?teacherId=, or ?its=
    const queryUserId = (req.query.userId as string) || (req.query.id as string) || undefined;
    const queryTeacherId = (req.query.teacherId as string) || undefined;
    const queryIts = (req.query.its as string) || undefined;

    let targetUserId = session.user.id;
    if (session.user.role === "ADMIN" && (queryUserId || queryTeacherId || queryIts)) {
      if (queryUserId) targetUserId = queryUserId;
    }

    const whereClause: any = queryTeacherId
      ? { teacherProfile: { id: queryTeacherId } }
      : (session.user.role === "ADMIN" && queryIts)
      ? { teacherProfile: { its: queryIts } }
      : { id: targetUserId };

    const user = await prisma.user.findFirst({
      where: whereClause,
      include: { teacherProfile: true },
    });

    if (!user || !user.teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const allPermissions = getProfilePermissions();
    const permissions = allPermissions.teacher;
    const modules = allPermissions.modules.teacher;

    return res.json({
      success: true,
      data: {
        id: user.teacherProfile.id,
        userId: user.id,
        name: `${user.firstName} ${user.lastName}`.trim(),
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        photoUrl: user.teacherProfile.photoUrl || user.avatarUrl || null,
        avatarUrl: user.avatarUrl || user.teacherProfile.photoUrl || null,
        its: user.teacherProfile.its || "",
        age: user.teacherProfile.age || null,
        khidmatMauze: user.teacherProfile.khidmatMauze || "",
        subCategory: user.teacherProfile.subCategory || "",
        role: user.teacherProfile.roleTitle || "",
        roleTitle: user.teacherProfile.roleTitle || "",
        farigYear: user.teacherProfile.farigYear || "",
        farigDarajah: user.teacherProfile.farigDarajah || "",
        aljameaDegree: user.teacherProfile.aljameaDegree || "",
        hifzStatus: user.teacherProfile.hifzStatus || "",
        hifzYear: user.teacherProfile.hifzYear || "",
        batchId: user.teacherProfile.batchId || "",
        mobile: user.teacherProfile.mobile || "",
        tEmail: user.teacherProfile.tEmail || user.email || "",
        khidmatYear: user.teacherProfile.khidmatYear || "",
        birthDateAd: user.teacherProfile.birthDateAd
          ? user.teacherProfile.birthDateAd.toISOString().slice(0, 10)
          : "",
        birthDateH: user.teacherProfile.birthDateH || "",
      },
      permissions,
      modules,
    });
  } catch (err: any) {
    console.error("Error fetching teacher profile:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch teacher profile" });
  }
});

// PUT /api/teacher/profile - Update teacher profile
router.put("/", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const isAdmin = session.user.role === "ADMIN";

    const queryTeacherId = (req.query.teacherId as string) || req.body.teacherProfileId || undefined;
    const queryUserId = (req.query.userId as string) || req.body.userId || undefined;

    let targetWhere: any = { id: session.user.id };
    if (isAdmin && (queryTeacherId || queryUserId)) {
      targetWhere = queryTeacherId
        ? { teacherProfile: { id: queryTeacherId } }
        : { id: queryUserId };
    }

    const user = await prisma.user.findFirst({
      where: targetWhere,
      include: { teacherProfile: true },
    });

    if (!user || !user.teacherProfile) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const body = req.body as Record<string, any>;
    const permissions = getProfilePermissions().teacher;

    // If not admin, check master toggle
    if (!isAdmin && !permissions.masterEnabled) {
      return res.status(403).json({
        success: false,
        error: "Teacher profile editing is currently locked by administrator",
      });
    }

    const teacherUpdate: Record<string, any> = {};
    const userUpdate: Record<string, any> = {};

    const canEdit = (field: string) => {
      if (isAdmin) return true;
      const itm = permissions.items[field];
      return itm?.isOpen !== false && itm?.isVisible !== false;
    };

    // 1. Photo
    if (canEdit("photo")) {
      if (body.photoUrl !== undefined) {
        teacherUpdate.photoUrl = body.photoUrl || null;
        userUpdate.avatarUrl = body.photoUrl || null;
      }
    }

    // 2. ITS No.
    if (canEdit("its") && body.its !== undefined) {
      teacherUpdate.its = body.its ? String(body.its).trim() : null;
    }

    // 3. Name (firstName, lastName, or combined name)
    if (canEdit("name")) {
      if (body.firstName !== undefined) userUpdate.firstName = body.firstName.trim();
      if (body.lastName !== undefined) userUpdate.lastName = body.lastName.trim();
      if (body.name && !body.firstName && !body.lastName) {
        const parts = body.name.trim().split(/\s+/);
        userUpdate.firstName = parts[0] || user.firstName;
        userUpdate.lastName = parts.slice(1).join(" ") || user.lastName;
      }
    }

    // 4. Age
    if (canEdit("age") && body.age !== undefined) {
      teacherUpdate.age = body.age ? parseInt(String(body.age), 10) : null;
    }

    // 5. KhidmatMauze
    if (canEdit("khidmatMauze") && body.khidmatMauze !== undefined) {
      teacherUpdate.khidmatMauze = body.khidmatMauze ? String(body.khidmatMauze).trim() : null;
    }

    // 6. Sub-Category
    if (canEdit("subCategory") && body.subCategory !== undefined) {
      teacherUpdate.subCategory = body.subCategory ? String(body.subCategory).trim() : null;
    }

    // 7. Role
    if (canEdit("role") && (body.role !== undefined || body.roleTitle !== undefined)) {
      const val = body.role !== undefined ? body.role : body.roleTitle;
      teacherUpdate.roleTitle = val ? String(val).trim() : null;
    }

    // 8. FarigYear
    if (canEdit("farigYear") && body.farigYear !== undefined) {
      teacherUpdate.farigYear = body.farigYear ? String(body.farigYear).trim() : null;
    }

    // 9. FarigDarajah
    if (canEdit("farigDarajah") && body.farigDarajah !== undefined) {
      teacherUpdate.farigDarajah = body.farigDarajah ? String(body.farigDarajah).trim() : null;
    }

    // 10. AljameaDegree
    if (canEdit("aljameaDegree") && body.aljameaDegree !== undefined) {
      teacherUpdate.aljameaDegree = body.aljameaDegree ? String(body.aljameaDegree).trim() : null;
    }

    // 11. Hifz Status
    if (canEdit("hifzStatus") && body.hifzStatus !== undefined) {
      teacherUpdate.hifzStatus = body.hifzStatus ? String(body.hifzStatus).trim() : null;
    }

    // 12. Hifz Year
    if (canEdit("hifzYear") && body.hifzYear !== undefined) {
      teacherUpdate.hifzYear = body.hifzYear ? String(body.hifzYear).trim() : null;
    }

    // 13. BatchID
    if (canEdit("batchId") && body.batchId !== undefined) {
      teacherUpdate.batchId = body.batchId ? String(body.batchId).trim() : null;
    }

    // 14. Mobile
    if (canEdit("mobile") && body.mobile !== undefined) {
      teacherUpdate.mobile = body.mobile ? String(body.mobile).trim() : null;
    }

    // 15. T_Email
    if (canEdit("tEmail") && body.tEmail !== undefined) {
      teacherUpdate.tEmail = body.tEmail ? String(body.tEmail).trim() : null;
    }

    // 16. KhidmatYear
    if (canEdit("khidmatYear") && body.khidmatYear !== undefined) {
      teacherUpdate.khidmatYear = body.khidmatYear ? String(body.khidmatYear).trim() : null;
    }

    // 17. BIRTHDT_AD
    if (canEdit("birthDateAd") && body.birthDateAd !== undefined) {
      teacherUpdate.birthDateAd = body.birthDateAd ? new Date(body.birthDateAd) : null;
    }

    // 18. BIRTHDT_H
    if (canEdit("birthDateH") && body.birthDateH !== undefined) {
      teacherUpdate.birthDateH = body.birthDateH ? String(body.birthDateH).trim() : null;
    }

    // Execute updates
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: userUpdate,
      });
    }

    const updatedTeacher = await prisma.teacherProfile.update({
      where: { id: user.teacherProfile.id },
      data: teacherUpdate,
      include: { user: true },
    });

    return res.json({
      success: true,
      message: "Teacher profile updated successfully",
      data: {
        ...updatedTeacher,
        firstName: updatedTeacher.user.firstName,
        lastName: updatedTeacher.user.lastName,
        name: `${updatedTeacher.user.firstName} ${updatedTeacher.user.lastName}`.trim(),
        avatarUrl: updatedTeacher.user.avatarUrl,
        birthDateAd: updatedTeacher.birthDateAd
          ? updatedTeacher.birthDateAd.toISOString().slice(0, 10)
          : "",
      },
    });
  } catch (err: any) {
    console.error("Error updating teacher profile:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to update profile" });
  }
});

export default router;
