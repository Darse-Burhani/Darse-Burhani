
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";

const router = Router();

// POST /api/admin/hifz/publish - Publish/unpublish/hide a hifz report
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { reportId, publish, hide } = body;

    if (!reportId) {
      return res.status(400).json({ success: false, error: "Report ID required" });
    }

    const report = await prisma.hifzReport.findUnique({
      where: { id: reportId },
    });

    if (!report) {
      return res.status(404).json({ success: false, error: "Report not found" });
    }

    const updateData: any = {};

    if (typeof publish === "boolean") {
      updateData.isPublished = publish;
      updateData.publishedAt = publish ? new Date() : null;
    }

    if (typeof hide === "boolean") {
      updateData.isHidden = hide;
    }

    const updated = await prisma.hifzReport.update({
      where: { id: reportId },
      data: updateData,
    });

    return res.json({
      success: true,
      data: {
        id: updated.id,
        isPublished: updated.isPublished,
        isHidden: updated.isHidden,
        publishedAt: updated.publishedAt,
      },
    });
  } catch (error) {
    console.error("Publish error:", error);
    return res.status(500).json({ success: false, error: "Failed to update report" });
  }
});

export default router;
