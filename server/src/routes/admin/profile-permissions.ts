import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware";
import {
  getProfilePermissions,
  updateProfilePermissions,
} from "../../lib/profile-permissions";

const router = Router();

// GET /api/admin/profile-permissions/modules - Get portal module lock status for portals
router.get("/modules", requireAuth, async (req, res) => {
  try {
    const session = req.auth!;
    const role = session.user?.role;
    const permissions = getProfilePermissions();

    let teacherModules = { ...permissions.modules.teacher };

    // If teacher is authenticated, check for teacher-specific page assignments
    if (role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        include: { portalAssignments: true },
      });

      if (teacherProfile && teacherProfile.portalAssignments.length > 0) {
        const active = teacherProfile.portalAssignments.filter((a) => a.isActive);
        const hasAll = active.some((a) => a.portalType === "ALL");

        if (!hasAll) {
          const assignedPages = new Set(
            active.map((a) =>
              a.portalType.startsWith("PAGE:") ? a.portalType.replace("PAGE:", "") : a.portalType.toLowerCase()
            )
          );

          // Build dynamic module availability based on assigned pages
          teacherModules = {
            dashboard: true,
            classes: assignedPages.has("classes"),
            attendance: assignedPages.has("attendance"),
            hifz: assignedPages.has("hifz") || assignedPages.has("hifz-marhala") || assignedPages.has("hifz-weekly-slip"),
            "hifz-marhala": assignedPages.has("hifz-marhala") || assignedPages.has("hifz"),
            "hifz-weekly-slip": assignedPages.has("hifz-weekly-slip") || assignedPages.has("hifz"),
            takhteet: assignedPages.has("takhteet"),
            procurement: assignedPages.has("procurement"),
            leave: assignedPages.has("leave") || assignedPages.has("attendance"),
            "mood-insights": assignedPages.has("mood-insights"),
            calendar: assignedPages.has("calendar") || true,
            profile: assignedPages.has("profile") || true,
            settings: true,
            faculty: true,
          };
        }
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
router.get("/", requireAuth, requireRole("ADMIN"), (req, res) => {
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
