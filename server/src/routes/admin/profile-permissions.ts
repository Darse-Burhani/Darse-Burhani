import { Router } from "express";
import prisma from "../../lib/prisma";
import { getSessionUser } from "../../auth";
import { requireAuth, requireRole } from "../../middleware";
import {
  getProfilePermissions,
  updateProfilePermissions,
} from "../../lib/profile-permissions";
import { apiCacheMiddleware, cache } from "../../lib/cache";

const router = Router();

// GET /api/admin/profile-permissions/modules - Get portal module lock status for portals
router.get("/modules", apiCacheMiddleware({ ttlMs: 30_000, tags: ["permissions"] }), async (req, res) => {
  try {
    const user = getSessionUser(req);
    const role = user?.role;
    const permissions = getProfilePermissions();

    return res.json({
      success: true,
      data: {
        talabat: permissions.modules.talabat,
        teacher: permissions.modules.teacher,
      },
      roleModules: role === "STUDENT" ? permissions.modules.talabat : role === "TEACHER" ? permissions.modules.teacher : permissions.modules,
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
router.get("/", apiCacheMiddleware({ ttlMs: 30_000, tags: ["permissions"] }), (req, res) => {
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
  cache.invalidateTag("permissions");

  return res.json({
    success: true,
    data: updated,
    message: "Profile permissions updated successfully",
  });
});

export default router;
