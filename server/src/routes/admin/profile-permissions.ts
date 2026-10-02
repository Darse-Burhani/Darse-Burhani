import { Router } from "express";
import prisma from "../../lib/prisma";
import { getSessionUser } from "../../auth";
import { requireAuth, requireRole } from "../../middleware";
import {
  getProfilePermissions,
  updateProfilePermissions,
} from "../../lib/profile-permissions";

const router = Router();

// GET /api/admin/profile-permissions/modules - Get portal module lock status for portals
router.get("/modules", async (req, res) => {
  try {
    const user = getSessionUser(req);
    const role = user?.role;
    const permissions = getProfilePermissions();

    let teacherModules = { ...permissions.modules.teacher };

    // If teacher is authenticated, check for teacher-specific page assignments
    if (role === "TEACHER" && user) {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: user.id },
        include: { portalAssignments: true },
      });

      const globalTeacher = permissions.modules.teacher || {};

      if (teacherProfile && teacherProfile.portalAssignments.length > 0) {
        const active = teacherProfile.portalAssignments.filter((a) => a.isActive);
        const hasAll = active.some((a) => a.portalType === "ALL");

        if (!hasAll) {
          const assignedPages = new Set(
            active.map((a) =>
              a.portalType.startsWith("PAGE:") ? a.portalType.replace("PAGE:", "") : a.portalType.toLowerCase()
            )
          );

          // Build dynamic module availability based on assigned pages AND global admin module locks
          teacherModules = {
            dashboard: globalTeacher.dashboard !== false,
            classes: globalTeacher.classes !== false && assignedPages.has("classes"),
            "attendance-logs": globalTeacher.attendance !== false && (assignedPages.has("attendance-logs") || assignedPages.has("attendance")),
            attendance: globalTeacher.attendance !== false && (assignedPages.has("attendance-logs") || assignedPages.has("attendance")),
            "manual-attendance": globalTeacher.attendance !== false && (assignedPages.has("manual-attendance") || assignedPages.has("attendance")),
            "attendance-schedule": globalTeacher.attendance !== false && (assignedPages.has("attendance-schedule") || assignedPages.has("attendance")),
            leave: globalTeacher.leave !== false && assignedPages.has("leave"),
            "email-reports": globalTeacher["email-reports"] !== false && assignedPages.has("email-reports"),
            procurement: globalTeacher.procurement !== false && assignedPages.has("procurement"),
            quran: globalTeacher.hifz !== false && (assignedPages.has("quran") || assignedPages.has("hifz")),
            hifz: globalTeacher.hifz !== false && (assignedPages.has("quran") || assignedPages.has("hifz")),
            takhteet: globalTeacher.takhteet !== false && assignedPages.has("takhteet"),
            makhzan: globalTeacher.makhzan !== false && (assignedPages.has("makhzan") || assignedPages.has("library")),
            library: globalTeacher.library !== false && assignedPages.has("library"),
            "medical-duty": globalTeacher["medical-duty"] !== false && assignedPages.has("medical-duty"),
            profile: globalTeacher.profile !== false,
            settings: true,
            faculty: globalTeacher.faculty !== false,
            calendar: globalTeacher.calendar !== false,
          };
        }
      } else {
        // Teacher has no custom assignments: only base pages (dashboard, profile) are available
        teacherModules = {
          dashboard: globalTeacher.dashboard !== false,
          classes: false,
          "attendance-logs": false,
          attendance: false,
          "manual-attendance": false,
          "attendance-schedule": false,
          leave: false,
          "email-reports": false,
          procurement: false,
          quran: false,
          hifz: false,
          takhteet: false,
          makhzan: false,
          library: false,
          "medical-duty": false,
          profile: globalTeacher.profile !== false,
          settings: true,
          faculty: globalTeacher.faculty !== false,
          calendar: globalTeacher.calendar !== false,
        };
      }
    }

    return res.json({
      success: true,
      data: {
        talabat: permissions.modules.talabat,
        teacher: teacherModules,
      },
      roleModules: role === "STUDENT" ? permissions.modules.talabat : role === "TEACHER" ? teacherModules : permissions.modules,
    });
  } catch (err) {
    console.error("Error resolving module permissions:", err);
    const permissions = getProfilePermissions();
    return res.json({
      success: true,
      data: permissions.modules,
      roleModules: permissions.modules,
    });
  }
});

// GET /api/admin/profile-permissions - Get regional profile edit permissions
router.get("/", (req, res) => {
  return res.json({
    success: true,
    data: getProfilePermissions(),
  });
});

// PUT /api/admin/profile-permissions - Update regional profile edit permissions (open/close regions)
router.put("/", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const updates = req.body;
  if (!updates || typeof updates !== "object") {
    return res.status(400).json({ success: false, error: "Invalid permissions object" });
  }

  const updated = await updateProfilePermissions(updates);
  return res.json({
    success: true,
    data: updated,
    message: "Profile permissions updated successfully",
  });
});

export default router;
