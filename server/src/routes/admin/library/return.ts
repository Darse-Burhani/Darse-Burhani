import { Router } from "express";
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";

const router = Router();

// POST /api/admin/library/return - Process a book return
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { barcode, confirmRestock } = body;

    if (!barcode) {
      return res.status(400).json({ success: false, error: "Book barcode is required" });
    }

    // Find the book by barcode
    const book = await prisma.libraryBook.findFirst({
      where: {
        OR: [
          { barcode },
          { id: barcode },
        ],
      },
    });

    if (!book) {
      return res.status(404).json({ success: false, error: "Book not found" });
    }

    // Find active loan
    const activeLoan = await prisma.bookLoan.findFirst({
      where: { bookId: book.id, status: "ACTIVE" },
    });

    if (!activeLoan) {
      return res.status(404).json({ success: false, error: "No active loan found for this book" });
    }

    // Mark active loan as RETURNED
    const updatedLoan = await prisma.bookLoan.update({
      where: { id: activeLoan.id },
      data: { status: "RETURNED", returnedAt: new Date() },
    });

    // Notify student borrower
    try {
      let borrowerUserId = activeLoan.studentId;
      const profile = await prisma.studentProfile.findFirst({
        where: {
          OR: [
            { id: activeLoan.studentId },
            { userId: activeLoan.studentId },
            { studentId: activeLoan.studentId },
          ],
        },
        select: { userId: true },
      });
      if (profile?.userId) {
        borrowerUserId = profile.userId;
      }

      await prisma.notification.create({
        data: {
          userId: borrowerUserId,
          title: "Book Returned Successfully 📖",
          body: `"${book.title}" was marked returned. Thank you!`,
          type: "LIBRARY",
          link: "/talabat/library",
        },
      });
    } catch (notifErr) {
      console.error("Failed to notify student borrower:", notifErr);
    }

    if (confirmRestock) {
      await prisma.libraryBook.update({
        where: { id: book.id },
        data: {
          status: "AVAILABLE",
          availableCopies: { increment: 1 },
        },
      });

      return res.json({
        success: true,
        data: {
          message: "Book returned and restocked successfully",
          loan: updatedLoan,
          book: { ...book, status: "AVAILABLE", availableCopies: book.availableCopies + 1 },
        },
      });
    } else {
      await prisma.libraryBook.update({
        where: { id: book.id },
        data: { status: "RESTOCK_QUEUE" },
      });

      return res.json({
        success: true,
        data: {
          message: "Book returned. It is now in the Restock Queue. Scan the shelf barcode to confirm restock.",
          restockRequired: true,
          bookId: book.id,
          loan: updatedLoan,
          book: { ...book, status: "RESTOCK_QUEUE" },
        },
      });
    }
  } catch (error) {
    console.error("Library return error:", error);
    return res.status(500).json({ success: false, error: "Failed to process return" });
  }
});

export default router;
