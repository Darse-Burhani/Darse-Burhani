import { Router } from "express";
import prisma from "../../../lib/prisma";
import { requireAuth, requireRole } from "../../../middleware";

const router = Router();

// GET /api/admin/library/export?format=csv - Export library data
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const format = (req.query.format as string) || "csv";

    const books = await prisma.libraryBook.findMany({
      include: {
        loans: {
          where: { status: "ACTIVE" },
          select: {
            studentName: true,
            borrowedAt: true,
            dueAt: true,
          },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (format === "csv") {
      const headers = [
        "Barcode", "Title", "Author", "Publisher", "Category",
        "Rack", "Shelf", "Color", "Status", "Total Copies",
        "Available Copies", "Current Borrower", "Due Date", "Notes",
      ];

      const rows = books.map((book) => [
        book.barcode || "",
        `"${book.title.replace(/"/g, '""')}"`,
        book.author ? `"${book.author.replace(/"/g, '""')}"` : "",
        book.publisher ? `"${book.publisher.replace(/"/g, '""')}"` : "",
        book.category,
        book.rackNumber || "",
        book.shelfNumber || "",
        book.locationColor || "",
        book.status,
        book.totalCopies,
        book.availableCopies,
        book.loans[0]?.studentName ? `"${book.loans[0].studentName.replace(/"/g, '""')}"` : "",
        book.loans[0]?.dueAt ? book.loans[0].dueAt.toISOString().split("T")[0] : "",
        book.notes ? `"${book.notes.replace(/"/g, '""')}"` : "",
      ]);

      const csv = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
      ].join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="library-export-${new Date().toISOString().split("T")[0]}.csv"`);
      return res.status(200).send(csv);
    }

    // JSON format
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="library-export-${new Date().toISOString().split("T")[0]}.json"`);
    return res.status(200).json({
      success: true,
      data: books.map((book) => ({
        ...book,
        currentBorrower: book.loans[0]?.studentName || null,
        dueDate: book.loans[0]?.dueAt || null,
        loans: undefined,
      })),
      total: books.length,
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Library export error:", error);
    return res.status(500).json({ success: false, error: "Failed to export library data" });
  }
});

export default router;
