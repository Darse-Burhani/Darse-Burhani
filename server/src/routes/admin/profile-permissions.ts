import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware";
import {
  getProfilePermissions,
  updateProfilePermissions,
} from "../../lib/profile-permissions";

const router = Router();

// GET /api/admin/profile-permissions/modules - Get portal module lock status for portals
router.get("/modules", requireAuth, (req, res) => {
  const role = req.auth?.user?.role;
  const permissions = getProfilePermissions();
  return res.json({
    success: true,
    data: permissions.modules,
    roleModules: role === "STUDENT" ? permissions.modules.talabat : role === "TEACHER" ? permissions.modules.teacher : permissions.modules,
  });
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
