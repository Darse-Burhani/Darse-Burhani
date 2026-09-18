
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";

const router = Router();

// GET /api/admin/library/auditor - List books on a specific shelf for auditing
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const rackNumber = (req.query.rack as string) || "";

    if (!rackNumber) {
      // Return shelf overview
      const shelves = await prisma.libraryBook.groupBy({
        by: ["rackNumber", "shelfNumber", "locationColor"],
        _count: true,
        where: { rackNumber: { not: null } },
        orderBy: [{ rackNumber: "asc" }, { shelfNumber: "asc" }],
      });

      return res.json({
        success: true,
        data: shelves.map((s) => ({
          rackNumber: s.rackNumber,
          shelfNumber: s.shelfNumber,
          locationColor: s.locationColor,
          count: s._count,
          label: `${s.rackNumber}${s.shelfNumber ? `-${s.shelfNumber}` : ""}`,
        })),
      });
    }

    // Get expected books for this rack/shelf
    const [shelfRack, shelfLetter] = rackNumber.split("-");
    
    const expectedBooks = await prisma.libraryBook.findMany({
      where: {
        rackNumber: shelfRack,
        ...(shelfLetter ? { shelfNumber: shelfLetter } : {}),
      },
      orderBy: { barcode: "asc" },
    });

    return res.json({
      success: true,
      data: expectedBooks.map((book) => ({
        id: book.id,
        title: book.title,
        barcode: book.barcode,
        coverImage: book.coverImage,
        rackNumber: book.rackNumber,
        shelfNumber: book.shelfNumber,
        status: book.status,
        locationColor: book.locationColor,
      })),
      shelfLabel: `${shelfRack}${shelfLetter ? `-${shelfLetter}` : ""}`,
    });
  } catch (error) {
    console.error("Auditor fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to load shelf data" });
  }
});

// POST /api/admin/library/auditor - Verify scanned barcode against expected shelf
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { barcode, expectedRackNumber, expectedShelfNumber } = body;

    if (!barcode) {
      return res.status(400).json({ success: false, error: "Barcode is required" });
    }

    const book = await prisma.libraryBook.findFirst({
      where: { OR: [{ barcode }, { id: barcode }] },
    });

    if (!book) {
      return res.status(200).json({ success: false, error: "Book not found in system", bookFound: false });
    }

    const isCorrectLocation =
      book.rackNumber === expectedRackNumber &&
      (!expectedShelfNumber || book.shelfNumber === expectedShelfNumber);

    return res.json({
      success: true,
      data: {
        bookFound: true,
        isCorrectLocation,
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          barcode: book.barcode,
          expectedLocation: `${book.rackNumber || "?"}${book.shelfNumber ? `-${book.shelfNumber}` : ""}`,
          actualLocation: `${expectedRackNumber}${expectedShelfNumber ? `-${expectedShelfNumber}` : ""}`,
          status: book.status,
          locationColor: book.locationColor,
        },
      },
    });
  } catch (error) {
    console.error("Auditor verify error:", error);
    return res.status(500).json({ success: false, error: "Failed to verify book" });
  }
});

export default router;
