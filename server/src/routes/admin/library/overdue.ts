import { Router } from "express";
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";

const router = Router();

// GET /api/admin/library/overdue - Get overdue loan reports
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const groupByClass = req.query.groupBy === "class";

    const overdueLoans = await prisma.bookLoan.findMany({
      where: {
        status: "ACTIVE",
        dueAt: { lt: new Date() },
      },
      include: {
        book: { select: { title: true, barcode: true } },
      },
      orderBy: { dueAt: "asc" },
    });

    if (groupByClass) {
      // Get student profiles with class info
      const userIds = overdueLoans.map((l) => l.studentId);
      const students = await prisma.studentProfile.findMany({
        where: { userId: { in: userIds } },
        include: {
          user: { select: { firstName: true, lastName: true } },
          classEnrollments: {
            include: { class: { select: { name: true, grade: true, section: true } } },
            where: { isActive: true },
          },
        },
      });

      const studentMap = new Map(students.map((s) => [s.userId, s]));

      const groupedByClass: Record<string, any[]> = {};

      for (const loan of overdueLoans) {
        const student = studentMap.get(loan.studentId);
        const className = student?.classEnrollments[0]?.class
          ? `${student.classEnrollments[0].class.grade}-${student.classEnrollments[0].class.section}`
          : "Unassigned";

        if (!groupedByClass[className]) {
          groupedByClass[className] = [];
        }

        groupedByClass[className].push({
          loanId: loan.id,
          studentName: loan.studentName,
          bookTitle: loan.bookTitle,
          bookBarcode: loan.bookBarcode,
          borrowedAt: loan.borrowedAt,
          dueAt: loan.dueAt,
          daysOverdue: Math.floor(
            (new Date().getTime() - new Date(loan.dueAt).getTime()) / (1000 * 60 * 60 * 24)
          ),
        });
      }

      return res.json({
        success: true,
        data: groupedByClass,
        totalOverdue: overdueLoans.length,
      });
    }

    // Simple flat list
    return res.json({
      success: true,
      data: overdueLoans.map((loan) => ({
        id: loan.id,
        studentId: loan.studentId,
        studentName: loan.studentName,
        bookTitle: loan.bookTitle,
        bookBarcode: loan.bookBarcode,
        borrowedAt: loan.borrowedAt,
        dueAt: loan.dueAt,
        daysOverdue: Math.floor(
          (new Date().getTime() - new Date(loan.dueAt).getTime()) / (1000 * 60 * 60 * 24)
        ),
      })),
      totalOverdue: overdueLoans.length,
    });
  } catch (error) {
    console.error("Overdue fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch overdue loans" });
  }
});

export default router;
