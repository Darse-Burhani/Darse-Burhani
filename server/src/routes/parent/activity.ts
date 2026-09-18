import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

router.get("/", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!parentProfile) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    const links = await prisma.parentStudentLink.findMany({
      where: { parentId: parentProfile.id },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });

    const children = links.map((l) => ({
      id: l.student.userId,
      studentProfileId: l.student.id,
      name: `${l.student.user?.firstName || ""} ${l.student.user?.lastName || ""}`,
      grade: l.student.grade,
      section: l.student.section,
      its: l.student.its || l.student.studentId,
    }));

    const studentIds = links.map((l) => l.student.id);

    const childId = req.query.childId as string;
    const limit = parseInt((req.query.limit as string) || "50");

    // Match either studentProfileId or userId
    const targetStudentProfileIds = childId
      ? links
          .filter((l) => l.student.id === childId || l.student.userId === childId)
          .map((l) => l.student.id)
      : studentIds;

    const [pointLogs, attendanceRecords] = await Promise.all([
      prisma.pointLog.findMany({
        where: { studentId: { in: targetStudentProfileIds } },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          student: {
            select: {
              id: true,
              userId: true,
              user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            },
          },
          teacher: {
            select: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.attendanceRecord.findMany({
        where: { studentId: { in: targetStudentProfileIds } },
        orderBy: { date: "desc" },
        take: limit,
        include: {
          student: {
            select: {
              id: true,
              userId: true,
              user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
      }),
    ]);

    const activities = [
      ...pointLogs.map((p) => ({
        id: `point-${p.id}`,
        type: "POINTS" as const,
        childId: p.student.userId,
        studentProfileId: p.student.id,
        childName: `${p.student.user?.firstName || ""} ${p.student.user?.lastName || ""}`,
        title: `${p.points > 0 ? "+" : ""}${p.points} ${p.category} Points`,
        detail: p.note || `Awarded by ${p.teacher?.user?.firstName || "Teacher"} ${p.teacher?.user?.lastName || ""}`,
        category: p.category,
        points: p.points,
        createdAt: p.createdAt,
      })),
      ...attendanceRecords.map((a) => ({
        id: `att-${a.id}`,
        type: "ATTENDANCE" as const,
        childId: a.student.userId,
        studentProfileId: a.student.id,
        childName: `${a.student.user?.firstName || ""} ${a.student.user?.lastName || ""}`,
        title: `Campus Attendance: ${a.status}`,
        detail: a.checkInTime
          ? `Biometric check-in verified at ${new Date(a.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : `Status logged as ${a.status}`,
        status: a.status,
        checkInTime: a.checkInTime,
        createdAt: a.date,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);

    return res.json({
      success: true,
      data: {
        activities,
        children,
      },
    });
  } catch (error) {
    console.error("Parent activity error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch activity" });
  }
});

export default router;
