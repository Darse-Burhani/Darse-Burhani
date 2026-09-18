import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

// ── Category-to-Barcode-Code Mapping ──
// Each category gets a unique 2-digit numeric code for barcode generation
const CATEGORY_BARCODE_CODES: Record<string, string> = {
  "General": "01",
  "Fiction": "02",
  "Non-Fiction": "03",
  "Science": "04",
  "History": "05",
  "Religion": "06",
  "Mathematics": "07",
  "Language": "08",
  "Arts": "09",
  "Art": "09",
  "Biography": "10",
  "Reference": "11",
  "Atlas": "11",
  "Children": "12",
  "Self-Help": "13",
  "Technology": "14",
  "GK": "15",
  "General Knowledge": "15",
  "General Knowledge (GK)": "15",
  "Commerce": "16",
  "Geography": "17",
};

/**
 * Generate barcode as: {GENRE_CODE}-{BOOK_NAME_SLUG}
 * e.g., "04-AL-KITAAB" for Science book "Al Kitaab"
 * No sequential number, no quantity - genre number + book name only
 */
async function generateBarcode(category: string, title: string): Promise<string> {
  const code = CATEGORY_BARCODE_CODES[category] || "99";
  const slug = title
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 20) || "BOOK";
  let base = `${code}-${slug}`;
  // Ensure uniqueness - if same genre+name exists, append -2, -3
  let candidate = base;
  let n = 2;
  while (await prisma.libraryBook.findUnique({ where: { barcode: candidate } })) {
    candidate = `${base}-${n}`;
    n++;
    if (n > 99) break;
  }
  return candidate;
}

// GET /api/admin/library - List all books with optional search/filter
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const search = (req.query.search as string) || "";
    const category = (req.query.category as string) || "";
    const status = (req.query.status as string) || "";
    const page = parseInt((req.query.page as string) || "1");
    const pageSize = parseInt((req.query.pageSize as string) || "50");
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { author: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
        { rackNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (status) {
      where.status = status;
    }

    const [books, total] = await Promise.all([
      prisma.libraryBook.findMany({
        where,
        include: {
          loans: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              studentId: true,
              studentName: true,
              borrowedAt: true,
              dueAt: true,
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.libraryBook.count({ where }),
    ]);

    const categories = await prisma.libraryBook.groupBy({
      by: ["category"],
      _count: true,
      orderBy: { _count: { category: "desc" } },
    });

    return res.json({
      success: true,
      data: books.map((book) => ({
        ...book,
        currentBorrower: book.loans[0]?.studentName || null,
        currentLoanId: book.loans[0]?.id || null,
        loanDate: book.loans[0]?.borrowedAt || null,
        dueDate: book.loans[0]?.dueAt || null,
        loans: undefined,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      categories: categories.map((c) => ({ name: c.category, count: c._count })),
    });
  } catch (error) {
    console.error("Library fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch library books" });
  }
});

// POST /api/admin/library - Add a new book
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { title, author, publisher, category, barcode, rackNumber, shelfNumber, locationColor, coverImage, notes } = body;

    if (!title) {
      return res.status(400).json({ success: false, error: "Title is required" });
    }

    const resolvedCategory = category || "General";

    // Resolve barcode: genre number + book name only (no sequential)
    let resolvedBarcode: string;
    if (barcode) {
      const existing = await prisma.libraryBook.findUnique({ where: { barcode } });
      if (existing) {
        return res.status(409).json({ success: false, error: "Barcode already exists" });
      }
      resolvedBarcode = barcode;
    } else {
      resolvedBarcode = await generateBarcode(resolvedCategory, title);
    }

    // Quantity not assigned - each book is 1 copy, genre + book name defines identity
    const copies = 1;
    const book = await prisma.libraryBook.create({
      data: {
        isbn: null,
        title,
        author: author || null,
        publisher: publisher || null,
        category: resolvedCategory,
        barcode: resolvedBarcode,
        rackNumber: rackNumber || null,
        shelfNumber: shelfNumber || null,
        locationColor: locationColor || null,
        coverImage: coverImage || null,
        status: "AVAILABLE",
        totalCopies: copies,
        availableCopies: copies,
        notes: notes || null,
      },
    });

    return res.status(201).json({ success: true, data: book });
  } catch (error) {
    console.error("Library create error:", error);
    return res.status(500).json({ success: false, error: "Failed to create book" });
  }
});

// PUT /api/admin/library - Update a book
router.put("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { id, ...updateData } = body;

    if (!id) {
      return res.status(400).json({ success: false, error: "Book ID required" });
    }

    // Don't allow updating loans through this endpoint - also strip quantity so genre+name only
    const { loans, currentBorrower, totalCopies, availableCopies, ...safeData } = updateData;

    const book = await prisma.libraryBook.update({
      where: { id },
      data: safeData,
    });

    return res.json({ success: true, data: book });
  } catch (error) {
    console.error("Library update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update book" });
  }
});

// DELETE /api/admin/library - Delete a book
router.delete("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const id = req.query.id as string;

    if (!id) {
      return res.status(400).json({ success: false, error: "Book ID required" });
    }

    const activeLoans = await prisma.bookLoan.count({
      where: { bookId: id, status: "ACTIVE" },
    });

    if (activeLoans > 0) {
      return res.status(400).json({ success: false, error: "Cannot delete book with active loans" });
    }

    await prisma.libraryBook.delete({ where: { id } });

    return res.json({ success: true });
  } catch (error) {
    console.error("Library delete error:", error);
    return res.status(500).json({ success: false, error: "Failed to delete book" });
  }
});

export default router;
