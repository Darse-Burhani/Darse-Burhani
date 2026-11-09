
import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireAuth } from "../../middleware";

const router = Router();

// GET /api/talabat/library
//   ?shelf=R1-A         — books on a specific rack-shelf
//   ?search=keyword      — search books by title/author
//   ?recommend=true      — get smart recommendations
//   (no params)          — return shelf overview

router.get("/", requireAuth, async (req, res) => {
  try {

    const shelfParam = req.query.shelf as string;
    const searchQuery = req.query.search as string;
    const recommend = (req.query.recommend as string) === "true";
    const includeUnavailable = (req.query.all as string) === "true";
    const myLoans = (req.query.myLoans as string) === "true";

    // ── My Loans, Garamat & Maktabat Attendance History ──
    if (myLoans) {
      const session = req.auth!;
      const userId = session.user.id;

      // Find student profile to get all identifiers
      const studentProfile = await prisma.studentProfile.findFirst({
        where: { userId },
      });

      const searchIds = Array.from(
        new Set([
          userId,
          studentProfile?.id,
          studentProfile?.studentId,
          studentProfile?.its,
          studentProfile?.trNo,
        ].filter(Boolean) as string[])
      );

      // Fetch Book Loans
      const loans = await prisma.bookLoan.findMany({
        where: { studentId: { in: searchIds } },
        include: {
          book: true,
        },
        orderBy: { borrowedAt: "desc" },
      });

      const now = Date.now();
      let totalPendingGaramat = 0;
      let totalPaidGaramat = 0;

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

        // If currently overdue and not yet returned, compute live garamat @ ₹10/day
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

        if (garamat) {
          if (garamat.status === "COLLECTED" || garamat.status === "PAID") {
            totalPaidGaramat += garamat.paidAmount || garamat.calculatedAmount || 0;
          } else if (garamat.status === "PENDING") {
            totalPendingGaramat += garamat.calculatedAmount || 0;
          }
        }

        return {
          id: loan.id,
          bookId: loan.bookId,
          title: loan.bookTitle || loan.book?.title,
          barcode: loan.bookBarcode || loan.book?.barcode,
          author: loan.book?.author,
          category: loan.book?.category || "General",
          coverImage: loan.book?.coverImage,
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

      // Fetch Maktabat Attendance Visits
      const attendances = await (prisma as any).libraryAttendance.findMany({
        where: {
          studentId: { in: searchIds },
        },
        orderBy: { checkInTime: "desc" },
        take: 50,
      });

      return res.json({
        success: true,
        data: {
          activeLoans: formattedLoans.filter((l) => l.rawStatus === "ACTIVE"),
          returnedLoans: formattedLoans.filter((l) => l.rawStatus === "RETURNED"),
          allLoans: formattedLoans,
          stats: {
            totalActive: formattedLoans.filter((l) => l.rawStatus === "ACTIVE").length,
            totalOverdue: formattedLoans.filter((l) => l.isOverdue).length,
            totalReturned: formattedLoans.filter((l) => l.rawStatus === "RETURNED").length,
            totalPendingGaramat,
            totalPaidGaramat,
            totalLibraryVisits: attendances.length,
          },
          attendances,
        },
      });
    }

    // ── Shelf Overview (default) ──
    if (!shelfParam && !searchQuery && !recommend) {
      const shelves = await prisma.libraryBook.groupBy({
        by: ["rackNumber", "shelfNumber", "locationColor"],
        _count: { id: true },
        _sum: { availableCopies: true },
        where: { rackNumber: { not: null } },
        orderBy: [{ rackNumber: "asc" }, { shelfNumber: "asc" }],
      });

      const categories = await prisma.libraryBook.groupBy({
        by: ["rackNumber", "category"],
        _count: { id: true },
        where: { rackNumber: { not: null } },
        orderBy: [{ rackNumber: "asc" }, { _count: { id: "desc" } }],
      });

      // Build category map per rack
      const categoryMap: Record<string, string[]> = {};
      for (const c of categories) {
        const key = c.rackNumber || "";
        if (!categoryMap[key]) categoryMap[key] = [];
        if (categoryMap[key].length < 3) categoryMap[key].push(c.category);
      }

      return res.json({
        success: true,
        data: shelves.map((s) => ({
          rackNumber: s.rackNumber,
          shelfNumber: s.shelfNumber,
          locationColor: s.locationColor,
          totalBooks: s._count.id,
          availableBooks: s._sum.availableCopies || 0,
          label: `${s.rackNumber}${s.shelfNumber ? `-${s.shelfNumber}` : ""}`,
        })),
        categoryMap,
        stats: {
          totalShelves: shelves.length,
          totalBooks: shelves.reduce((a, s) => a + s._count.id, 0),
          totalAvailable: shelves.reduce((a, s) => a + (s._sum.availableCopies || 0), 0),
        },
      });
    }

    // ── Search Books ──
    if (searchQuery) {
      const books = await prisma.libraryBook.findMany({
        where: {
          OR: [
            { title: { contains: searchQuery, mode: "insensitive" } },
            { author: { contains: searchQuery, mode: "insensitive" } },
            { category: { contains: searchQuery, mode: "insensitive" } },
            { barcode: { contains: searchQuery, mode: "insensitive" } },
          ],
          ...(includeUnavailable ? {} : { status: "AVAILABLE" }),
        },
        orderBy: [{ category: "asc" }, { title: "asc" }],
        take: 50,
      });

      return res.json({
        success: true,
        data: books.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          category: b.category,
          barcode: b.barcode,
          rackNumber: b.rackNumber,
          shelfNumber: b.shelfNumber,
          locationColor: b.locationColor,
          coverImage: b.coverImage,
          status: b.status,
          totalCopies: b.totalCopies,
          availableCopies: b.availableCopies,
          location: `${b.rackNumber || "?"}${b.shelfNumber ? `-${b.shelfNumber}` : ""}`,
        })),
        total: books.length,
      });
    }

    // ── Smart Recommendations ──
    if (recommend) {
      // Popular: Currently available books
      const availableBooks = await prisma.libraryBook.findMany({
        where: { status: "AVAILABLE", availableCopies: { gt: 0 } },
        orderBy: [{ category: "asc" }, { title: "asc" }],
        take: 12,
      });

      // Random selection from available
      const shuffled = [...availableBooks].sort(() => Math.random() - 0.5);
      const picks = shuffled.slice(0, 6);

      // Quick stats
      const stats = {
        totalBooks: await prisma.libraryBook.count(),
        availableNow: await prisma.libraryBook.count({
          where: { status: "AVAILABLE", availableCopies: { gt: 0 } },
        }),
        totalCategories: (await prisma.libraryBook.groupBy({ by: ["category"] })).length,
      };

      return res.json({
        success: true,
        data: {
          picks: picks.map((b) => ({
            id: b.id,
            title: b.title,
            author: b.author,
            category: b.category,
            barcode: b.barcode,
            coverImage: b.coverImage,
            rackNumber: b.rackNumber,
            shelfNumber: b.shelfNumber,
            locationColor: b.locationColor,
            status: b.status,
            totalCopies: b.totalCopies,
            availableCopies: b.availableCopies,
            notes: b.notes,
            location: `${b.rackNumber || "?"}${b.shelfNumber ? `-${b.shelfNumber}` : ""}`,
          })),
          stats,
        },
      });
    }

    // ── Books on a Specific Shelf ──
    if (shelfParam) {
      const [rackPart, shelfPart] = shelfParam.split("-");

      const books = await prisma.libraryBook.findMany({
        where: {
          rackNumber: rackPart,
          ...(shelfPart ? { shelfNumber: shelfPart } : {}),
        },
        orderBy: [{ category: "asc" }, { title: "asc" }],
      });

      const shelfInfo = {
        rackNumber: rackPart,
        shelfNumber: shelfPart || null,
        label: shelfParam,
        totalBooks: books.length,
        availableBooks: books.filter((b) => b.status === "AVAILABLE" && b.availableCopies > 0).length,
        locationColor: books.find((b) => b.locationColor)?.locationColor || null,
      };

      return res.json({
        success: true,
        data: books.map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author,
          publisher: b.publisher,
          category: b.category,
          barcode: b.barcode,
          rackNumber: b.rackNumber,
          shelfNumber: b.shelfNumber,
          locationColor: b.locationColor,
          coverImage: b.coverImage,
          status: b.status,
          totalCopies: b.totalCopies,
          availableCopies: b.availableCopies,
          notes: b.notes,
          location: `${b.rackNumber || "?"}${b.shelfNumber ? `-${b.shelfNumber}` : ""}`,
        })),
        shelfInfo,
      });
    }

    return res.json({ success: true, data: [] });
  } catch (error) {
    console.error("Student library error:", error);
    return res.status(500).json({ success: false, error: "Failed to load library data" });
  }
});

export default router;
