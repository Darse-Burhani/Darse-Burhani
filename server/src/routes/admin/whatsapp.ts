import { Router } from "express";
import { requireRole } from "../../middleware";
import {
  getBaileysStatus,
  initWhatsAppBaileys,
  logoutBaileys,
  updateBaileysProfileName,
} from "../../lib/whatsapp-baileys";

const router = Router();

// GET /api/admin/whatsapp/status
// Returns the live connection status and QR code for 1-time scanning
router.get("/status", requireRole("ADMIN"), async (_req, res) => {
  try {
    const status = getBaileysStatus();
    return res.json({
      success: true,
      data: status,
    });
  } catch (err: any) {
    console.error("Fetch WhatsApp status error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to get WhatsApp status" });
  }
});

// POST /api/admin/whatsapp/profile-name
// Updates the WhatsApp account display name
router.post("/profile-name", requireRole("ADMIN"), async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name) {
      return res.status(400).json({ success: false, error: "Profile name cannot be empty" });
    }
    const result = await updateBaileysProfileName(name);
    if (result.success) {
      return res.json({
        success: true,
        message: `WhatsApp display name successfully updated to "${name}"`,
      });
    }
    return res.status(400).json({ success: false, error: result.error });
  } catch (err: any) {
    console.error("Update profile name error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to update profile name" });
  }
});

// POST /api/admin/whatsapp/reconnect
// Reconnects or initiates QR code generation
router.post("/reconnect", requireRole("ADMIN"), async (_req, res) => {
  try {
    await initWhatsAppBaileys();
    const status = getBaileysStatus();
    return res.json({
      success: true,
      message: "Connection cycle initialized",
      data: status,
    });
  } catch (err: any) {
    console.error("Reconnect WhatsApp error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to reconnect WhatsApp" });
  }
});

// POST /api/admin/whatsapp/logout
// Unlinks the current device session and clears DB keys
router.post("/logout", requireRole("ADMIN"), async (_req, res) => {
  try {
    await logoutBaileys();
    return res.json({
      success: true,
      message: "WhatsApp session unlinked successfully. You may now scan a new QR code.",
    });
  } catch (err: any) {
    console.error("Logout WhatsApp error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to logout WhatsApp" });
  }
});

export default router;

