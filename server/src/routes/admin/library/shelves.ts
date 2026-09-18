
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";

const router = Router();

// Color options for shelf labels
const COLOR_OPTIONS = [
  "Red", "Blue", "Green", "Yellow", "Orange", "Purple", "Pink", "Light Blue", "White",
] as const;

// ── GET /api/admin/library/shelves ──
// Returns all unique shelves with stats
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    // Get all unique shelf combinations with counts
    const shelves = await prisma.libraryBook.groupBy({
      by: ["rackNumber", "shelfNumber", "locationColor"],
      _count: { id: true },
      _sum: { availableCopies: true },
      where: { rackNumber: { not: null } },
      orderBy: [{ rackNumber: "asc" }, { shelfNumber: "asc" }],
    });

    // Get category breakdown per shelf
    const categoryData = await prisma.libraryBook.groupBy({
      by: ["rackNumber", "shelfNumber", "category"],
      _count: { id: true },
      where: { rackNumber: { not: null } },
      orderBy: [{ rackNumber: "asc" }, { shelfNumber: "asc" }, { _count: { id: "desc" } }],
    });

    // Build category map per shelf
    const shelfCategoryMap: Record<string, { name: string; count: number }[]> = {};
    for (const c of categoryData) {
      const key = `${c.rackNumber}-${c.shelfNumber || ""}`;
      if (!shelfCategoryMap[key]) shelfCategoryMap[key] = [];
      shelfCategoryMap[key].push({ name: c.category, count: c._count.id });
    }

    // Get books per shelf (cover images for the 3D shelf view), capped per shelf.
    // AVAILABLE sorts before BORROWED so the scene's "available first" visual matches.
    const shelfBooks = await prisma.libraryBook.findMany({
      where: { rackNumber: { not: null } },
      orderBy: [{ status: "asc" }, { title: "asc" }],
      select: {
        rackNumber: true,
        shelfNumber: true,
        title: true,
        author: true,
        coverImage: true,
        status: true,
        barcode: true,
      },
    });

    const shelfBooksMap: Record<
      string,
      {
        title: string;
        author: string | null;
        coverImage: string | null;
        status: string;
        barcode: string | null;
      }[]
    > = {};
    for (const b of shelfBooks) {
      const key = `${b.rackNumber}-${b.shelfNumber || ""}`;
      if (!shelfBooksMap[key]) shelfBooksMap[key] = [];
      if (shelfBooksMap[key].length >= 20) continue;
      shelfBooksMap[key].push({
        title: b.title,
        author: b.author,
        coverImage: b.coverImage,
        status: b.status,
        barcode: b.barcode,
      });
    }

    return res.json({
      success: true,
      data: shelves.map((s) => {
        const key = `${s.rackNumber}-${s.shelfNumber || ""}`;
        return {
          rackNumber: s.rackNumber,
          shelfNumber: s.shelfNumber,
          locationColor: s.locationColor,
          totalBooks: s._count.id,
          availableBooks: s._sum.availableCopies || 0,
          label: `${s.rackNumber}${s.shelfNumber ? `-${s.shelfNumber}` : ""}`,
          categories: shelfCategoryMap[key] || [],
          borrowedBooks: s._count.id - (s._sum.availableCopies || 0),
          books: shelfBooksMap[key] || [],
        };
      }),
      colorOptions: COLOR_OPTIONS,
      stats: {
        totalShelves: shelves.length,
        totalBooks: shelves.reduce((a, s) => a + s._count.id, 0),
        totalAvailable: shelves.reduce((a, s) => a + (s._sum.availableCopies || 0), 0),
        unassignedBooks: await prisma.libraryBook.count({ where: { rackNumber: null } }),
      },
    });
  } catch (error) {
    console.error("Shelves fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to load shelves" });
  }
});

// ── PUT /api/admin/library/shelves ──
// Update shelf properties (rename rack, rename shelf, change color)
router.put("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { oldRackNumber, oldShelfNumber, newRackNumber, newShelfNumber, locationColor } = body;

    if (!oldRackNumber) {
      return res.status(400).json({ success: false, error: "Old rack number is required" });
    }

    // Build the where clause for books to update
    const where: any = { rackNumber: oldRackNumber };
    if (oldShelfNumber !== undefined) {
      where.shelfNumber = oldShelfNumber || null;
    }

    // Build the update data
    const updateData: any = {};
    if (newRackNumber !== undefined) updateData.rackNumber = newRackNumber || null;
    if (newShelfNumber !== undefined) updateData.shelfNumber = newShelfNumber || null;
    if (locationColor !== undefined) updateData.locationColor = locationColor || null;

    // Count books affected
    const affectedCount = await prisma.libraryBook.count({ where });

    // Update all books on this shelf
    await prisma.libraryBook.updateMany({ where, data: updateData });

    return res.json({
      success: true,
      message: `Updated ${affectedCount} book(s) on ${oldRackNumber}${oldShelfNumber ? `-${oldShelfNumber}` : ""}`,
      affectedCount,
    });
  } catch (error) {
    console.error("Shelf update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update shelf" });
  }
});

// ── POST /api/admin/library/shelves ──
// Bulk-move books from one shelf to another, or assign unassigned books
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { fromRack, fromShelf, toRack, toShelf, bookIds, locationColor } = body;

    // Validate: either bookIds or fromRack is required
    if (!bookIds?.length && !fromRack) {
      return res.status(400).json({ success: false, error: "Source shelf or book IDs required" });
    }

    if (!toRack) {
      return res.status(400).json({ success: false, error: "Destination rack is required" });
    }

    const where: any = {};
    
    if (bookIds?.length) {
      where.id = { in: bookIds };
    } else {
      where.rackNumber = fromRack;
      if (fromShelf !== undefined) {
        where.shelfNumber = fromShelf || null;
      }
    }

    const updateData: any = {
      rackNumber: toRack,
      shelfNumber: toShelf || null,
    };
    if (locationColor !== undefined) updateData.locationColor = locationColor || null;

    const affectedCount = await prisma.libraryBook.updateMany({ where, data: updateData });

    return res.json({
      success: true,
      message: `Moved ${affectedCount} book(s) to ${toRack}${toShelf ? `-${toShelf}` : ""}`,
      affectedCount,
    });
  } catch (error) {
    console.error("Shelf move error:", error);
    return res.status(500).json({ success: false, error: "Failed to move books" });
  }
});

// ── DELETE /api/admin/library/shelves ──
// Clear shelf assignments (set rackNumber/shelfNumber to null)
router.delete("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const rack = req.query.rack as string;
    const shelf = req.query.shelf as string | null;

    if (!rack) {
      return res.status(400).json({ success: false, error: "Rack number is required" });
    }

    const where: any = { rackNumber: rack };
    if (shelf !== null) {
      where.shelfNumber = shelf || null;
    }

    const affectedCount = await prisma.libraryBook.updateMany({
      where,
      data: { rackNumber: null, shelfNumber: null, locationColor: null },
    });

    return res.json({
      success: true,
      message: `Cleared shelf assignments for ${affectedCount} book(s)`,
      affectedCount,
    });
  } catch (error) {
    console.error("Shelf clear error:", error);
    return res.status(500).json({ success: false, error: "Failed to clear shelf" });
  }
});

export default router;
