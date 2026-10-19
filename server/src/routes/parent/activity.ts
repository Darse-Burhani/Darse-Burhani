import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { isRabiAlAkhirDate } from "../../lib/fatimi-calendar";
import { getISTDetails, eventRangeForRole } from "../../lib/biometric";

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
    const targetLinks = childId
      ? links.filter((l) => l.student.id === childId || l.student.userId === childId)
      : links;

    const targetStudentProfileIds = targetLinks.map((l) => l.student.id);
    const targetUserIds = targetLinks.map((l) => l.student.userId);
    const targetStudentIds = targetLinks.map((l) => l.student.studentId).filter(Boolean) as string[];
    const targetIts = targetLinks.map((l) => l.student.its).filter(Boolean) as string[];

    const targetLoanStudentIds = Array.from(
      new Set([...targetStudentProfileIds, ...targetUserIds, ...targetStudentIds, ...targetIts])
    );

    const [pointLogs, attendanceRecords, bookLoans, scanWindows] = await Promise.all([
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
        take: limit * 2,
        include: {
          class: { select: { id: true, name: true } },
          student: {
            select: {
              id: true,
              userId: true,
              user: { select: { firstName: true, lastName: true, avatarUrl: true } },
            },
          },
        },
      }),
      prisma.bookLoan.findMany({
        where: { studentId: { in: targetLoanStudentIds } },
        orderBy: { borrowedAt: "desc" },
        take: limit,
        include: {
          book: true,
        },
      }),
      prisma.biometricScanWindow.findMany({
        where: { enabled: true },
        orderBy: { startTime: "asc" },
      }),
    ]);

    // Omit Rabi ul Akhar attendance records from Parent portal (without deleting them from DB)
    const nonRabiAttendance = attendanceRecords.filter((a) => !isRabiAlAkhirDate(a.date));

    // Helper map for child lookup by any ID
    const findChildForBorrower = (borrowerId: string) => {
      const match = targetLinks.find(
        (l) =>
          l.student.id === borrowerId ||
          l.student.userId === borrowerId ||
          l.student.studentId === borrowerId ||
          l.student.its === borrowerId
      );
      if (match) {
        return {
          id: match.student.userId,
          studentProfileId: match.student.id,
          name: `${match.student.user?.firstName || ""} ${match.student.user?.lastName || ""}`.trim(),
        };
      }
      return null;
    };

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
      ...nonRabiAttendance.map((a) => {
        const scanTimestamp = a.checkInTime || a.date;
        const { scanMinutes, timeFormatted12 } = getISTDetails(new Date(scanTimestamp));

        const matchedWindow = scanWindows.find((w) => {
          const r = eventRangeForRole(w as any, "STUDENT");
          return r && r.enabled && scanMinutes >= r.startMin && scanMinutes <= r.lateMin;
        });

        const eventName = matchedWindow?.name || a.class?.name || "Tilawat al Dua";
        const method = a.biometricMethod || a.verificationMethod || "Biometric Terminal";

        return {
          id: `att-${a.id}`,
          type: "ATTENDANCE" as const,
          childId: a.student.userId,
          studentProfileId: a.student.id,
          childName: `${a.student.user?.firstName || ""} ${a.student.user?.lastName || ""}`,
          eventName,
          title: `${eventName}: ${a.status}`,
          detail: a.checkInTime
            ? `Biometric scan verified at ${timeFormatted12} IST via ${method} (${eventName})`
            : `Status logged as ${a.status} for ${eventName}`,
          status: a.status,
          checkInTime: a.checkInTime,
          method,
          createdAt: a.checkInTime || a.date,
        };
      }),
      ...bookLoans.map((loan) => {
        const child = findChildForBorrower(loan.studentId);
        const dueFormatted = new Date(loan.dueAt).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
        const returnedFormatted = loan.returnedAt
          ? new Date(loan.returnedAt).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : null;

        return {
          id: `loan-${loan.id}`,
          type: "LIBRARY" as const,
          childId: child?.id || loan.studentId,
          studentProfileId: child?.studentProfileId,
          childName: child?.name || loan.studentName,
          title: `Library Book Issue: ${loan.bookTitle}`,
          detail: `Barcode: ${loan.bookBarcode || loan.book?.barcode || "—"} • Due: ${dueFormatted} • Status: ${loan.status}${
            returnedFormatted ? ` • Returned: ${returnedFormatted}` : ""
          }`,
          bookTitle: loan.bookTitle,
          bookBarcode: loan.bookBarcode || loan.book?.barcode,
          status: loan.status,
          borrowedAt: loan.borrowedAt,
          dueAt: loan.dueAt,
          returnedAt: loan.returnedAt,
          createdAt: loan.borrowedAt,
        };
      }),
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
