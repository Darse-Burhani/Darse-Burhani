
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!studentProfile) {
      return res.status(404).json({ success: false, error: "Student profile not found" });
    }

    const skillTree = await prisma.skillTreePoint.findUnique({
      where: { studentId: studentProfile.id },
    });

    if (!skillTree) {
      const created = await prisma.skillTreePoint.create({
        data: { studentId: studentProfile.id },
      });
      return res.json({
        success: true,
        data: {
          criticalThinking: created.criticalThinking,
          collaboration: created.collaboration,
          leadership: created.leadership,
          resilience: created.resilience,
        },
      });
    }

    return res.json({
      success: true,
      data: {
        criticalThinking: skillTree.criticalThinking,
        collaboration: skillTree.collaboration,
        leadership: skillTree.leadership,
        resilience: skillTree.resilience,
      },
    });
  } catch (error) {
    console.error("Skill tree error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch skill tree" });
  }
});

export default router;
