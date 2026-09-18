
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/teacher/attendance/justifications - Pending absence justifications across teacher's classes
router.get("/", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (!teacher) {
      return res.status(403).json({ success: false, error: "Teacher profile not found" });
    }

    const records = await prisma.attendanceRecord.findMany({
      where: {
        justificationStatus: "PENDING",
        class: { teacherId: teacher.id },
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        class: { select: { name: true, subject: true } },
      },
      orderBy: { justificationSubmittedAt: "desc" },
      take: 50,
    });

    return res.json({
      success: true,
      data: records.map((r) => ({
        id: r.id,
        date: r.date.toISOString(),
        status: r.status,
        justification: r.justification,
        justificationStatus: r.justificationStatus,
        justificationSubmittedAt: r.justificationSubmittedAt?.toISOString() || null,
        studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
        className: r.class.name,
        subject: r.class.subject,
      })),
    });
  } catch (error) {
    console.error("Teacher justifications fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch justifications" });
  }
});

export default router;
