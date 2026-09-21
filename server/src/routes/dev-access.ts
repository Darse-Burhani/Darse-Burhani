import { Router } from "express";

const router = Router();

// Validate Dev Passcode
router.post("/verify", (req, res) => {
  try {
    const { passcode } = req.body || {};
    const configuredPasscode = process.env.DEV_ACCESS_PASSCODE || "DARSE-DEV-5253";
    const lockdownEnabled = process.env.DEV_LOCKDOWN_ENABLED !== "false";

    if (!passcode || typeof passcode !== "string") {
      return res.status(400).json({
        success: false,
        error: "Passcode is required",
      });
    }

    if (passcode.trim() === configuredPasscode.trim()) {
      // Generate an ephemeral verification session signature
      const sessionToken = Buffer.from(
        `unlocked:${Date.now()}:${configuredPasscode.slice(0, 4)}`
      ).toString("base64");

      return res.json({
        success: true,
        message: "Development access granted successfully",
        token: sessionToken,
        lockdownEnabled,
      });
    }

    return res.status(401).json({
      success: false,
      error: "Invalid development access passcode. Please check with the administrator.",
    });
  } catch (error) {
    console.error("Dev access verify error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to verify access code",
    });
  }
});

// Check status of Dev Lockdown
router.get("/status", (req, res) => {
  const lockdownEnabled = process.env.DEV_LOCKDOWN_ENABLED !== "false";
  return res.json({
    success: true,
    lockdownEnabled,
    environment: process.env.NODE_ENV || "development",
  });
});

export default router;
