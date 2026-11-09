import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// GET /api/parent/library - Get issued books and borrowing history for linked children
router.get("/", requireRole("PARENT", "ADMIN", "TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;

    let parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        studentLinks: {
          select: { studentId: true },
        },
      },
    });

    if (!parentProfile && (session.user.role === "ADMIN" || session.user.role === "TEACHER")) {
      const targetParentId = (req.query.parentId as string) || (req.query.parent as string);
      parentProfile = await prisma.parentProfile.findFirst({
        where: targetParentId ? { OR: [{ id: targetParentId }, { userId: targetParentId }] } : undefined,
        include: {
          studentLinks: { select: { studentId: true } },
        },
      });
    }

    if (!parentProfile) {
      return res.status(404).json({ success: false, error: "Parent profile not found" });
    }

    const linkedStudentIds = parentProfile.studentLinks.map((l) => l.studentId);
    if (linkedStudentIds.length === 0) {
      return res.json({
        success: true,
        data: {
          hasLinkedChildren: false,
          children: [],
          currentChild: null,
          activeLoans: [],
          returnedLoans: [],
          stats: {
            totalActive: 0,
            totalOverdue: 0,
            totalReturned: 0,
            totalBorrowed: 0,
          },
        },
      });
    }

    // Load student profiles for linked children
    const students = await prisma.studentProfile.findMany({
      where: { id: { in: linkedStudentIds } },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
        classEnrollments: {
          include: {
            class: { select: { id: true, name: true, grade: true, section: true } },
          },
        },
      },
    });

    // Determine target child
    const requestedChildId = (req.query.studentId as string) || (req.query.childId as string);
    const targetStudent = requestedChildId
      ? students.find(
          (s) =>
            s.id === requestedChildId ||
            s.userId === requestedChildId ||
            s.studentId === requestedChildId ||
            s.its === requestedChildId
        ) || students[0]
      : students[0];

    if (!targetStudent) {
      return res.status(404).json({ success: false, error: "No student linked to this account" });
    }

    // Collect all identifiers for loan matching
    const loanSearchIds = Array.from(
      new Set([
        targetStudent.id,
        targetStudent.userId,
        targetStudent.studentId,
        targetStudent.its,
        targetStudent.trNo,
      ].filter(Boolean) as string[])
    );

    // Query book loans for target student
    const loans = await prisma.bookLoan.findMany({
      where: { studentId: { in: loanSearchIds } },
      orderBy: { borrowedAt: "desc" },
      include: {
        book: true,
      },
    });

    const now = Date.now();

    const formattedLoans = loans.map((loan) => {
      const isOverdue = loan.status === "ACTIVE" && new Date(loan.dueAt).getTime() < now;
      const dueMs = new Date(loan.dueAt).getTime();
      const diffDays = Math.ceil((dueMs - now) / (1000 * 60 * 60 * 24));
      const daysOverdue = isOverdue ? Math.max(1, Math.ceil((now - dueMs) / (1000 * 60 * 60 * 24))) : 0;

      let garamat: any = null;
      try {
        if (loan.notes && loan.notes.startsWith("{")) {
          const parsed = JSON.parse(loan.notes);
          garamat = parsed.garamat;
        }
      } catch {
        // Ignore
      }

      if (isOverdue && !garamat) {
        garamat = {
          isLate: true,
          daysLate: daysOverdue,
          ratePerDay: 10,
          calculatedAmount: daysOverdue * 10,
          status: "PENDING",
          paidAmount: 0,
          notes: "Active overdue loan",
        };
      }

      return {
        id: loan.id,
        bookId: loan.bookId,
        title: loan.bookTitle || loan.book?.title || "Library Book",
        author: loan.book?.author || "Darse Burhani Maktabat",
        category: loan.book?.category || "General",
        barcode: loan.bookBarcode || loan.book?.barcode || "—",
        coverImage: loan.book?.coverImage || null,
        rackNumber: loan.book?.rackNumber || null,
        shelfNumber: loan.book?.shelfNumber || null,
        locationColor: loan.book?.locationColor || null,
        location: `${loan.book?.rackNumber || ""}${loan.book?.shelfNumber ? `-${loan.book?.shelfNumber}` : ""}`.trim() || null,
        borrowedAt: loan.borrowedAt,
        dueAt: loan.dueAt,
        returnedAt: loan.returnedAt,
        status: isOverdue ? "OVERDUE" : loan.status,
        rawStatus: loan.status,
        isOverdue,
        daysRemaining: diffDays,
        daysOverdue,
        garamat,
      };
    });

    const activeLoans = formattedLoans.filter((l) => l.rawStatus === "ACTIVE");
    const returnedLoans = formattedLoans.filter((l) => l.rawStatus === "RETURNED");
    const overdueCount = formattedLoans.filter((l) => l.isOverdue).length;
    const totalPendingGaramat = formattedLoans.reduce((sum, l) => {
      if (l.garamat && l.garamat.status === "PENDING") {
        return sum + (l.garamat.calculatedAmount || 0);
      }
      return sum;
    }, 0);

    // Fetch Maktabat Attendance for Child
    const attendances = await (prisma as any).libraryAttendance.findMany({
      where: {
        studentId: { in: loanSearchIds },
      },
      orderBy: { checkInTime: "desc" },
      take: 40,
    });

    return res.json({
      success: true,
      data: {
        hasLinkedChildren: true,
        children: students.map((s) => ({
          id: s.userId,
          studentProfileId: s.id,
          firstName: s.user?.firstName || "",
          lastName: s.user?.lastName || "",
          its: s.its || s.studentId || "—",
          className: s.classEnrollments?.[0]?.class?.name || `${s.grade} ${s.section}`.trim(),
          avatarUrl: s.user?.avatarUrl || null,
        })),
        currentChild: {
          id: targetStudent.userId,
          studentProfileId: targetStudent.id,
          firstName: targetStudent.user?.firstName || "",
          lastName: targetStudent.user?.lastName || "",
          its: targetStudent.its || targetStudent.studentId || "—",
          grade: targetStudent.grade,
          section: targetStudent.section,
          className: targetStudent.classEnrollments?.[0]?.class?.name || `${targetStudent.grade} ${targetStudent.section}`.trim(),
          avatarUrl: targetStudent.user?.avatarUrl || null,
        },
        activeLoans,
        returnedLoans,
        allLoans: formattedLoans,
        attendances,
        stats: {
          totalActive: activeLoans.length,
          totalOverdue: overdueCount,
          totalReturned: returnedLoans.length,
          totalBorrowed: formattedLoans.length,
          totalPendingGaramat,
          totalLibraryVisits: attendances.length,
        },
      },
    });
  } catch (error) {
    console.error("Parent library error:", error);
    return res.status(500).json({ success: false, error: "Failed to load library data" });
  }
});

export default router;

