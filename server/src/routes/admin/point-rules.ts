import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth, requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const rules = await prisma.pointMatrix.findMany({
      orderBy: [{ category: "asc" }, { actionName: "asc" }],
    });

    return res.json({ success: true, data: rules });
  } catch (error) {
    console.error("Point rules fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch rules" });
  }
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { id, category, actionName, pointValue, actionType, color, iconName } = body;

    if (!category || !actionName || pointValue === undefined || !actionType) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const rule = id
      ? await prisma.pointMatrix.update({
          where: { id },
          data: { category, actionName, pointValue, actionType, color, iconName },
        })
      : await prisma.pointMatrix.create({
          data: { category, actionName, pointValue, actionType, color: color || "#6366f1", iconName: iconName || "star" },
        });

    return res.json({ success: true, data: rule });
  } catch (error) {
    console.error("Point rule save error:", error);
    return res.status(500).json({ success: false, error: "Failed to save rule" });
  }
});

export default router;
