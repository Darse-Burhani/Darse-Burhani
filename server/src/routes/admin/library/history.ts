import { Router } from "express";
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";

const router = Router();

// GET /api/admin/library/history?bookId=xxx - Get loan history for a book
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const bookId = req.query.bookId as string;

    if (!bookId) {
      return res.status(400).json({ success: false, error: "Book ID required" });
    }

    const loans = await prisma.bookLoan.findMany({
      where: { bookId },
      orderBy: { borrowedAt: "desc" },
      take: 100,
    });

    // Get unique student IDs to fetch their class info
    const studentIds = Array.from(new Set(loans.map((l) => l.studentId)));
    const studentProfiles = await prisma.studentProfile.findMany({
      where: { userId: { in: studentIds } },
      select: {
        userId: true,
        studentId: true,
        grade: true,
        section: true,
        classEnrollments: {
          where: { isActive: true },
          select: {
            class: { select: { name: true, grade: true, section: true } },
          },
          take: 1,
        },
      },
    });

    const studentMap = new Map(
      studentProfiles.map((s) => [
        s.userId,
        {
          studentId: s.studentId,
          grade: s.grade,
          section: s.section,
          className: s.classEnrollments[0]?.class
            ? `${s.classEnrollments[0].class.grade}-${s.classEnrollments[0].class.section}`
            : null,
        },
      ])
    );

    return res.json({
      success: true,
      data: loans.map((loan) => ({
        id: loan.id,
        studentName: loan.studentName,
        borrowedAt: loan.borrowedAt,
        dueAt: loan.dueAt,
        returnedAt: loan.returnedAt,
        status: loan.status,
        renewed: loan.renewed,
        notes: loan.notes,
        studentInfo: studentMap.get(loan.studentId) || null,
      })),
      total: loans.length,
    });
  } catch (error) {
    console.error("Loan history error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch loan history" });
  }
});

export default router;
