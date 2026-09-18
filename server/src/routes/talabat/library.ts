
import { Router, Request, Response } from "express";
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
    const session = req.auth!;

    const shelfParam = req.query.shelf as string;
    const searchQuery = req.query.search as string;
    const recommend = (req.query.recommend as string) === "true";
    const includeUnavailable = (req.query.all as string) === "true";

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
