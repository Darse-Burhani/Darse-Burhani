import { Router } from "express";
import { getShelvesDisplay } from "../../lib/shelf-display";

const router = Router();

// GET /api/public/library-tv - Public shelf data for the TV / kiosk display.
// No auth: this is meant to run on a lobby TV in a browser without a login.
router.get("/", async (_req, res) => {
  try {
    const data = await getShelvesDisplay(24);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ success: true, data });
  } catch (error) {
    console.error("Library TV fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to load library display" });
  }
});

export default router;
