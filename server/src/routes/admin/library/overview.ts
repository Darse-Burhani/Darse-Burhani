import { Router } from "express";
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";

const router = Router();

// GET /api/admin/library/overview - Aggregated "360-degree" view of the library
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const [
      bookCounts,
      bookTotals,
      activeLoans,
      overdueLoans,
      returnedLoans,
      categories,
      recentLoans,
      recentAdditions,
      topBorrowers,
      popularBooks,
    ] = await Promise.all([
      prisma.libraryBook.groupBy({ by: ["status"], _count: true }),
      prisma.libraryBook.aggregate({
        _count: { _all: true },
        _sum: { totalCopies: true, availableCopies: true },
      }),
      prisma.bookLoan.count({ where: { status: "ACTIVE" } }),
      prisma.bookLoan.count({ where: { status: "ACTIVE", dueAt: { lt: new Date() } } }),
      prisma.bookLoan.count({ where: { status: "RETURNED" } }),
      prisma.libraryBook.groupBy({
        by: ["category"],
        _count: true,
        orderBy: { _count: { category: "desc" } },
      }),
      prisma.bookLoan.findMany({
        orderBy: { borrowedAt: "desc" },
        take: 8,
        select: {
          id: true,
          studentName: true,
          bookTitle: true,
          bookBarcode: true,
          borrowedAt: true,
          dueAt: true,
          returnedAt: true,
          status: true,
        },
      }),
      prisma.libraryBook.findMany({
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          title: true,
          author: true,
          category: true,
          barcode: true,
          coverImage: true,
          status: true,
          availableCopies: true,
          totalCopies: true,
        },
      }),
      prisma.bookLoan.groupBy({
        by: ["studentName"],
        where: { status: "ACTIVE" },
        _count: true,
        orderBy: { _count: { studentName: "desc" } },
        take: 5,
      }),
      prisma.bookLoan.groupBy({
        by: ["bookTitle"],
        _count: true,
        orderBy: { _count: { bookTitle: "desc" } },
        take: 5,
      }),
    ]);

    const byStatus = bookCounts.map((b) => ({ status: b.status, count: b._count }));
    const totalCopies = bookTotals._sum.totalCopies || 0;
    const availableCopies = bookTotals._sum.availableCopies || 0;

    return res.json({
      success: true,
      data: {
        books: {
          totalTitles: bookTotals._count._all,
          totalCopies,
          availableCopies,
          issuedCopies: Math.max(totalCopies - availableCopies, 0),
          byStatus,
        },
        loans: {
          active: activeLoans,
          overdue: overdueLoans,
          returned: returnedLoans,
        },
        categories: categories.map((c) => ({ name: c.category, count: c._count })),
        recentLoans: recentLoans.map((l) => ({
          ...l,
          borrowedAt: l.borrowedAt.toISOString(),
          dueAt: l.dueAt.toISOString(),
          returnedAt: l.returnedAt?.toISOString() || null,
        })),
        recentAdditions: recentAdditions.map((b) => ({
          ...b,
          createdAt: undefined,
        })),
        topBorrowers: topBorrowers.map((b) => ({ name: b.studentName, count: b._count })),
        popularBooks: popularBooks.map((b) => ({ title: b.bookTitle, count: b._count })),
      },
    });
  } catch (error) {
    console.error("Library overview error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch library overview" });
  }
});

export default router;
