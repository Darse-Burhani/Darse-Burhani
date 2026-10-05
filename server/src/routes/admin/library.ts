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

// POST /api/admin/library/seed-catalog - Seed or sync complete Maktabat books catalog
router.post("/seed-catalog", requireRole("ADMIN"), async (req, res) => {
  try {
    const DEFAULT_CATALOG = [
      { title: "Al-Quran al-Kareem (Mushaf Tajweed)", author: "Khattat Uthmani", publisher: "Maktabat Darse Burhani", category: "Religion", barcode: "06-MUSHAF-TAJWEED-01", rackNumber: "Rack-A1", shelfNumber: "Shelf-1", locationColor: "Green", status: "AVAILABLE", totalCopies: 15, availableCopies: 15, notes: "Deluxe gilded Mushaf with Tajweed color coding." },
      { title: "Tafseer al-Jalalayn", author: "Jalal al-Din al-Mahalli & Jalal al-Din al-Suyuti", publisher: "Dar al-Kutub al-Ilmiyyah", category: "Religion", barcode: "06-TAFSEER-JALALAYN", rackNumber: "Rack-A1", shelfNumber: "Shelf-2", locationColor: "Green", status: "AVAILABLE", totalCopies: 4, availableCopies: 4, notes: "Concise Quranic exegesis manual." },
      { title: "Ahkam al-Tajweed wa Qawa'id al-Tilawah", author: "Al-Mahad al-Zahra", publisher: "Idarat al-Hifz", category: "Religion", barcode: "06-AHKAM-TAJWEED", rackNumber: "Rack-A1", shelfNumber: "Shelf-3", locationColor: "Green", status: "AVAILABLE", totalCopies: 12, availableCopies: 12, notes: "Primary rulebook for Makharij and Tartil." },
      { title: "Mutashabihat al-Quran al-Kareem", author: "Al-Mahad al-Zahra Academic Board", publisher: "Darse Burhani Press", category: "Religion", barcode: "06-MUTASHABIHAT-QURAN", rackNumber: "Rack-A1", shelfNumber: "Shelf-4", locationColor: "Green", status: "AVAILABLE", totalCopies: 8, availableCopies: 8, notes: "Revision manual for Hifz Sanad prep." },
      { title: "Da'aim al-Islam (Volume 1)", author: "Al-Qadi al-Nu'man (R.A.)", publisher: "Dar al-Ma'arif", category: "Religion", barcode: "06-DAAIM-ISLAM-VOL1", rackNumber: "Rack-A2", shelfNumber: "Shelf-1", locationColor: "Green", status: "AVAILABLE", totalCopies: 6, availableCopies: 6, notes: "Foundational jurisprudence (Ibadat)." },
      { title: "Da'aim al-Islam (Volume 2)", author: "Al-Qadi al-Nu'man (R.A.)", publisher: "Dar al-Ma'arif", category: "Religion", barcode: "06-DAAIM-ISLAM-VOL2", rackNumber: "Rack-A2", shelfNumber: "Shelf-2", locationColor: "Green", status: "AVAILABLE", totalCopies: 6, availableCopies: 6, notes: "Mu'amalat, trade, and judicial decrees." },
      { title: "Kitab al-Himma fi Adab Ittiba' al-A'imma", author: "Al-Qadi al-Nu'man (R.A.)", publisher: "Al-Jamea Library Editions", category: "Religion", barcode: "06-KITAB-AL-HIMMA", rackNumber: "Rack-A2", shelfNumber: "Shelf-3", locationColor: "Green", status: "AVAILABLE", totalCopies: 5, availableCopies: 5, notes: "Institutional reverence and protocol." },
      { title: "Al-Majalis wal Musayarat", author: "Al-Qadi al-Nu'man (R.A.)", publisher: "Dar al-Andalus", category: "Religion", barcode: "06-MAJALIS-MUSAYARAT", rackNumber: "Rack-A2", shelfNumber: "Shelf-4", locationColor: "Green", status: "AVAILABLE", totalCopies: 4, availableCopies: 4, notes: "Historical gatherings of Fatimi Imams." },
      { title: "Rasa'il Ikhwan al-Safa wa Khillan al-Wafa", author: "Ikhwan al-Safa", publisher: "Dar Sadir", category: "Religion", barcode: "06-RASAIL-IKHWAN-SAFA", rackNumber: "Rack-A3", shelfNumber: "Shelf-1", locationColor: "Green", status: "AVAILABLE", totalCopies: 3, availableCopies: 3, notes: "Philosophical and scientific encyclopedic treatises." },
      { title: "Nahj al-Balaghah (Sharh Ibn Abi al-Hadid)", author: "Amir al-Mumineen Ali ibn Abi Talib (A.S.)", publisher: "Dar al-Kutub", category: "Language", barcode: "08-NAHJ-AL-BALAGHAH", rackNumber: "Rack-B1", shelfNumber: "Shelf-1", locationColor: "Blue", status: "AVAILABLE", totalCopies: 7, availableCopies: 7, notes: "Peak of eloquence sermons and letters." },
      { title: "Diwan al-Mutanabbi", author: "Abu al-Tayyib al-Mutanabbi", publisher: "Dar Beirut", category: "Language", barcode: "08-DIWAN-MUTANABBI", rackNumber: "Rack-B1", shelfNumber: "Shelf-2", locationColor: "Blue", status: "AVAILABLE", totalCopies: 5, availableCopies: 5, notes: "Classical Arabic poetic anthology." },
      { title: "Al-Ajrumiyyah fi Qawa'id Lughat al-Arab", author: "Ibn Ajurrum", publisher: "Maktabat Darse Burhani", category: "Language", barcode: "08-AJRUMIYYAH-NAHW", rackNumber: "Rack-B1", shelfNumber: "Shelf-3", locationColor: "Blue", status: "AVAILABLE", totalCopies: 14, availableCopies: 14, notes: "Primary syntax (Nahw) textbook." },
      { title: "Qatr al-Nada wa Ball al-Sada", author: "Ibn Hisham al-Ansari", publisher: "Dar al-Huda", category: "Language", barcode: "08-QATR-AL-NADA", rackNumber: "Rack-B1", shelfNumber: "Shelf-4", locationColor: "Blue", status: "AVAILABLE", totalCopies: 6, availableCopies: 6, notes: "Intermediate grammar manual." },
      { title: "Lisan ud-Dawat Advanced Grammar & Vocab", author: "Darse Burhani Academic Board", publisher: "Al-Jamea Publications", category: "Language", barcode: "08-LISAN-DAWAT-ADV", rackNumber: "Rack-B2", shelfNumber: "Shelf-1", locationColor: "Blue", status: "AVAILABLE", totalCopies: 15, availableCopies: 15, notes: "Comprehensive Lisan ud-Dawat curriculum." },
      { title: "Uyun al-Akhbar wa Funun al-Athaar (Vol 1-7)", author: "Syedna Idris Imaduddin (R.A.)", publisher: "Dar al-Afaq", category: "History", barcode: "05-UYUN-AL-AKHBAR", rackNumber: "Rack-C1", shelfNumber: "Shelf-1", locationColor: "Orange", status: "AVAILABLE", totalCopies: 4, availableCopies: 4, notes: "Chronicled history of Ismaili Fatimi Da'wah." },
      { title: "Tareekh al-Du'at al-Mutlaqeen", author: "Idarat al-Tareekh", publisher: "Darse Burhani Publications", category: "History", barcode: "05-TAREEKH-DUAT", rackNumber: "Rack-C1", shelfNumber: "Shelf-2", locationColor: "Orange", status: "AVAILABLE", totalCopies: 9, availableCopies: 9, notes: "Biographical chronology of the Du'at al-Mutlaqeen." },
      { title: "Al-Sirat al-Nabawiyyah", author: "Ibn Hisham", publisher: "Dar al-Jeel", category: "History", barcode: "05-SIRAT-NABAWITYAH", rackNumber: "Rack-C1", shelfNumber: "Shelf-3", locationColor: "Orange", status: "AVAILABLE", totalCopies: 5, availableCopies: 5, notes: "Prophetic biography and history." },
      { title: "Mawakeb al-Fatimiyeen fi Misr wal Sham", author: "Dr. Ayman Fu'ad Sayyid", publisher: "Dar al-Kutub al-Misriyyah", category: "History", barcode: "05-MAWAKEB-FATIMIYEEN", rackNumber: "Rack-C1", shelfNumber: "Shelf-4", locationColor: "Orange", status: "AVAILABLE", totalCopies: 3, availableCopies: 3, notes: "Cairo Fatimi era culture and architecture." },
      { title: "Principles of Fatimi Geometry & Astronomy", author: "Academic Heritage Collective", publisher: "Al-Jamea Scientific Research", category: "Science", barcode: "04-FATIMI-GEOMETRY", rackNumber: "Rack-D1", shelfNumber: "Shelf-1", locationColor: "Red", status: "AVAILABLE", totalCopies: 6, availableCopies: 6, notes: "Astrolabe calculations and geometric tiling." },
      { title: "Kitab al-Manazir (Book of Optics)", author: "Ibn al-Haytham", publisher: "National Heritage Library", category: "Science", barcode: "04-KITAB-AL-MANAZIR", rackNumber: "Rack-D1", shelfNumber: "Shelf-2", locationColor: "Red", status: "AVAILABLE", totalCopies: 4, availableCopies: 4, notes: "Foundational optics treatises." },
      { title: "Al-Jabr wal Muqabalah (Algebra Manual)", author: "Muhammad ibn Musa al-Khwarizmi", publisher: "Dar al-Shurooq", category: "Mathematics", barcode: "07-AL-JABR-WA-MUQABALA", rackNumber: "Rack-D1", shelfNumber: "Shelf-3", locationColor: "Yellow", status: "AVAILABLE", totalCopies: 7, availableCopies: 7, notes: "Classical mathematics and equations." },
      { title: "Al-Munjid fi al-Lughah wal A'lam", author: "Fr. Louis Ma'louf", publisher: "Dar al-Mashriq", category: "Reference", barcode: "11-AL-MUNJID-ARABIC", rackNumber: "Rack-E1", shelfNumber: "Shelf-1", locationColor: "White", status: "AVAILABLE", totalCopies: 5, availableCopies: 5, notes: "Definitive Arabic reference dictionary." },
      { title: "A Dictionary of Modern Written Arabic", author: "Hans Wehr", publisher: "Spoken Language Services", category: "Reference", barcode: "11-HANS-WEHR-ARABIC", rackNumber: "Rack-E1", shelfNumber: "Shelf-2", locationColor: "White", status: "AVAILABLE", totalCopies: 6, availableCopies: 6, notes: "Arabic-English lexicon." },
      { title: "Fatimi World Historical Atlas", author: "Darse Burhani Cartographic Unit", publisher: "Darse Burhani Press", category: "Reference", barcode: "11-FATIMI-WORLD-ATLAS", rackNumber: "Rack-E1", shelfNumber: "Shelf-3", locationColor: "White", status: "AVAILABLE", totalCopies: 4, availableCopies: 4, notes: "Full-color historical atlas." },
      { title: "Qisas al-Anbiya (Stories of the Prophets)", author: "Ibn Katheer", publisher: "Maktabat al-Talabat", category: "General", barcode: "01-QISAS-AL-ANBIYA", rackNumber: "Rack-F1", shelfNumber: "Shelf-1", locationColor: "Pink", status: "AVAILABLE", totalCopies: 10, availableCopies: 10, notes: "Prophetic narratives for students." },
      { title: "The Art of Islamic Calligraphy & Kufic Script", author: "Ustad Hashim al-Baghdadi", publisher: "Dar al-Turath", category: "General", barcode: "01-KUFIC-CALLIGRAPHY", rackNumber: "Rack-F1", shelfNumber: "Shelf-2", locationColor: "Pink", status: "AVAILABLE", totalCopies: 5, availableCopies: 5, notes: "Kufic and Thuluth script manual." },
    ];

    let count = 0;
    for (const b of DEFAULT_CATALOG) {
      await prisma.libraryBook.upsert({
        where: { barcode: b.barcode },
        update: {
          title: b.title,
          author: b.author,
          publisher: b.publisher,
          category: b.category,
          rackNumber: b.rackNumber,
          shelfNumber: b.shelfNumber,
          locationColor: b.locationColor,
          status: b.status as any,
          totalCopies: b.totalCopies,
          availableCopies: b.availableCopies,
          notes: b.notes,
        },
        create: {
          title: b.title,
          author: b.author,
          publisher: b.publisher,
          category: b.category,
          barcode: b.barcode,
          rackNumber: b.rackNumber,
          shelfNumber: b.shelfNumber,
          locationColor: b.locationColor,
          status: b.status as any,
          totalCopies: b.totalCopies,
          availableCopies: b.availableCopies,
          notes: b.notes,
        },
      });
      count++;
    }

    return res.json({ success: true, message: `Successfully seeded/synced ${count} Maktabat books with barcodes & QR codes.` });
  } catch (error) {
    console.error("Library seed error:", error);
    return res.status(500).json({ success: false, error: "Failed to seed Maktabat catalog" });
  }
});

export default router;
