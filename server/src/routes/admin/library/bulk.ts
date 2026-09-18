import { Router } from "express";
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";

const router = Router();

// POST /api/admin/library/bulk - Bulk import books
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const body = req.body as Record<string, any>;
    const { books } = body;

    if (!books || !Array.isArray(books) || books.length === 0) {
      return res.status(400).json({ success: false, error: "Array of books required in 'books' field" });
    }

    const createdBooks: any[] = [];
    const skippedBooks: any[] = [];

    for (let i = 0; i < books.length; i++) {
      const item = books[i];
      const title = item.title?.trim();
      if (!title) {
        skippedBooks.push({ index: i, item, reason: "Title is required" });
        continue;
      }

      const category = item.category?.trim() || "General";
      let barcode = item.barcode?.trim();

      if (barcode) {
        // Check uniqueness
        const existing = await prisma.libraryBook.findUnique({ where: { barcode } });
        if (existing) {
          skippedBooks.push({ index: i, title, barcode, reason: "Barcode already exists in database" });
          continue;
        }
      } else {
        // Generate barcode
        const slug = title
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .substring(0, 18) || "BOOK";
        const randSuffix = Math.floor(1000 + Math.random() * 9000);
        let candidate = `MKZ-${slug}-${randSuffix}`;
        while (await prisma.libraryBook.findUnique({ where: { barcode: candidate } })) {
          candidate = `MKZ-${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
        }
        barcode = candidate;
      }

      const newBook = await prisma.libraryBook.create({
        data: {
          title,
          author: item.author?.trim() || null,
          publisher: item.publisher?.trim() || null,
          category,
          barcode,
          rackNumber: item.rackNumber?.trim() || null,
          shelfNumber: item.shelfNumber?.trim() || null,
          locationColor: item.locationColor?.trim() || null,
          coverImage: item.coverImage || null,
          status: "AVAILABLE",
          totalCopies: 1,
          availableCopies: 1,
          notes: item.notes?.trim() || null,
        },
      });

      createdBooks.push(newBook);
    }

    return res.status(201).json({
      success: true,
      message: `Successfully imported ${createdBooks.length} book(s)${skippedBooks.length ? `, skipped ${skippedBooks.length}` : ""}`,
      count: createdBooks.length,
      created: createdBooks,
      skipped: skippedBooks,
    });
  } catch (error) {
    console.error("Bulk import error:", error);
    return res.status(500).json({ success: false, error: "Failed to bulk import books" });
  }
});

// PATCH /api/admin/library/bulk - Bulk update books
router.patch("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { bookIds, updates } = body;

    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return res.status(400).json({ success: false, error: "Book IDs array required" });
    }
    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ success: false, error: "Updates object required" });
    }

    // Build allowed update fields
    const allowedFields = ["category", "status", "rackNumber", "shelfNumber", "locationColor", "notes"];
    const safeUpdates: Record<string, any> = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        safeUpdates[field] = updates[field];
      }
    }

    if (Object.keys(safeUpdates).length === 0) {
      return res.status(400).json({ success: false, error: "No valid fields to update" });
    }

    // If changing status from BORROWED or similar, also update availableCopies
    if (updates.status === "AVAILABLE") {
      const result = await prisma.libraryBook.updateMany({
        where: { id: { in: bookIds } },
        data: {
          ...safeUpdates,
          availableCopies: { increment: 1 },
        },
      });
      return res.json({
        success: true,
        message: `Updated ${result.count} book(s)`,
        count: result.count,
      });
    }

    const result = await prisma.libraryBook.updateMany({
      where: { id: { in: bookIds } },
      data: safeUpdates,
    });

    return res.json({
      success: true,
      message: `Updated ${result.count} book(s)`,
      count: result.count,
    });
  } catch (error) {
    console.error("Bulk update error:", error);
    return res.status(500).json({ success: false, error: "Failed to bulk update books" });
  }
});

// DELETE /api/admin/library/bulk - Bulk delete books
router.delete("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { bookIds } = body;

    if (!bookIds || !Array.isArray(bookIds) || bookIds.length === 0) {
      return res.status(400).json({ success: false, error: "Book IDs array required" });
    }

    // Check for active loans
    const activeLoans = await prisma.bookLoan.count({
      where: { bookId: { in: bookIds }, status: "ACTIVE" },
    });

    if (activeLoans > 0) {
      return res.status(400).json({
        success: false,
        error: `${activeLoans} book(s) have active loans. Clear loans first.`,
        activeLoans,
      });
    }

    // Delete all related loans first
    await prisma.bookLoan.deleteMany({
      where: { bookId: { in: bookIds } },
    });

    const result = await prisma.libraryBook.deleteMany({
      where: { id: { in: bookIds } },
    });

    return res.json({
      success: true,
      message: `Deleted ${result.count} book(s)`,
      count: result.count,
    });
  } catch (error) {
    console.error("Bulk delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete books" });
  }
});

export default router;
