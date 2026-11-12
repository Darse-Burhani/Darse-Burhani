import { Router } from "express";
import prisma from "../../../lib/prisma";
import { cache } from "../../../lib/cache";
import { requireRole } from "../../../middleware";
import {
  gregorianToJulianDay,
  julianDayToHijri,
  HIJRI_MONTHS,
} from "../../../lib/fatimi-calendar";
import { sendPushToUser } from "../../../lib/push";

const router = Router();

function getHijriString(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === "year")?.value || date.getFullYear());
  const month = Number(parts.find((p) => p.type === "month")?.value || date.getMonth() + 1);
  const day = Number(parts.find((p) => p.type === "day")?.value || date.getDate());

  const jd = gregorianToJulianDay(year, month, day);
  const hijri = julianDayToHijri(jd);
  const mMeta = HIJRI_MONTHS[hijri.month - 1] || HIJRI_MONTHS[0];
  return `${hijri.day} ${mMeta.en} ${hijri.year} H`;
}

// Resolve who actually holds a loan. Legacy loans can carry an empty or
// bare-id studentName, which left the return screen showing no name at all.
async function resolveBorrowerName(loan: { studentId: string; studentName?: string | null }) {
  const stored = (loan.studentName || "").trim();
  // A real name was stored at checkout — use it. Only a blank value or the raw
  // member id falls through to a profile lookup.
  if (stored && stored !== loan.studentId) return stored;

  try {
    const student = await prisma.studentProfile.findFirst({
      where: {
        OR: [{ userId: loan.studentId }, { id: loan.studentId }, { studentId: loan.studentId }],
      },
      select: { user: { select: { firstName: true, lastName: true } } },
    });
    const studentName = `${student?.user?.firstName || ""} ${student?.user?.lastName || ""}`.trim();
    if (studentName) return studentName;
  } catch {
    // fall through
  }

  try {
    const teacher = await prisma.teacherProfile.findFirst({
      where: {
        OR: [{ userId: loan.studentId }, { id: loan.studentId }, { employeeId: loan.studentId }, { its: loan.studentId }],
      },
      select: { user: { select: { firstName: true, lastName: true } } },
    });
    const teacherName = `${teacher?.user?.firstName || ""} ${teacher?.user?.lastName || ""}`.trim();
    if (teacherName) return teacherName;
  } catch {
    // fall through
  }

  return stored || "Unknown Person";
}

// GET /api/admin/library/return/search-active-loans - Fast search active loans by Book Name, Barcode, or Borrower Name
router.get("/search-active-loans", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const q = String(req.query.q || req.query.query || "").trim();
    const whereClause: any = { status: "ACTIVE" };

    if (q) {
      whereClause.OR = [
        { bookTitle: { contains: q, mode: "insensitive" } },
        { bookBarcode: { contains: q, mode: "insensitive" } },
        { studentName: { contains: q, mode: "insensitive" } },
      ];
    }

    const loans = await prisma.bookLoan.findMany({
      where: whereClause,
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            barcode: true,
            category: true,
            coverImage: true,
            shelfNumber: true,
            rackNumber: true,
          },
        },
      },
      orderBy: { borrowedAt: "desc" },
      take: 20,
    });

    const resolvedNames = await Promise.all(loans.map((l) => resolveBorrowerName(l)));

    const formatted = loans.map((l, idx) => ({
      loanId: l.id,
      bookId: l.bookId,
      bookTitle: l.bookTitle || l.book?.title || "Book",
      barcode: l.bookBarcode || l.book?.barcode || "",
      borrowerName: resolvedNames[idx],
      borrowerId: l.studentId,
      borrowedAt: l.borrowedAt,
      dueAt: l.dueAt,
      isOverdue: new Date(l.dueAt) < new Date(),
      coverImage: l.book?.coverImage,
      category: l.book?.category,
    }));

    return res.json({ success: true, data: formatted });
  } catch (error: any) {
    console.error("Search active loans error:", error);
    return res.status(500).json({ success: false, error: "Failed to search active loans" });
  }
});

// POST /api/admin/library/return - Process return with fast scan catch, manual book name support & automatic Garamat calculation
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const body = req.body as Record<string, any>;
    const {
      barcode,
      bookName,
      bookTitle,
      bookId,
      loanId,
      // A returned copy goes straight back into circulation so it can be issued
      // again from Maktabat. Pass confirmRestock:false to hold it in sorting.
      confirmRestock = true,
      garamatAction = "COLLECTED", // "COLLECTED" | "WAIVED" | "PENDING"
      garamatAmountCustom,
      garamatNotes = "",
    } = body;

    const searchTerm = (barcode || bookName || bookTitle || "").trim();
    if (!searchTerm && !loanId && !bookId) {
      return res.status(400).json({ success: false, error: "Book barcode or book name is required" });
    }

    let activeLoan: any = null;

    if (loanId) {
      activeLoan = await prisma.bookLoan.findFirst({
        where: { id: loanId, status: "ACTIVE" },
        include: { book: true },
      });
    }

    // Return by internal book id — used by the Makhzan shelf scanner and the
    // offline return queue, which only know the catalog id.
    if (!activeLoan && bookId) {
      activeLoan = await prisma.bookLoan.findFirst({
        where: { bookId: String(bookId), status: "ACTIVE" },
        include: { book: true },
        orderBy: { borrowedAt: "desc" },
      });
    }

    if (!activeLoan && searchTerm) {
      // 1. Try finding book by barcode or title
      const bookMatch = await prisma.libraryBook.findFirst({
        where: {
          OR: [
            { barcode: searchTerm },
            { id: searchTerm },
            { title: { equals: searchTerm, mode: "insensitive" } },
            { title: { contains: searchTerm, mode: "insensitive" } },
          ],
        },
      });

      if (bookMatch) {
        activeLoan = await prisma.bookLoan.findFirst({
          where: { bookId: bookMatch.id, status: "ACTIVE" },
          include: { book: true },
          orderBy: { borrowedAt: "desc" },
        });
      }

      // 2. If not found, search directly by bookBarcode or bookTitle on bookLoan
      if (!activeLoan) {
        activeLoan = await prisma.bookLoan.findFirst({
          where: {
            status: "ACTIVE",
            OR: [
              { bookBarcode: { equals: searchTerm, mode: "insensitive" } },
              { bookTitle: { equals: searchTerm, mode: "insensitive" } },
              { bookTitle: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
          include: { book: true },
          orderBy: { borrowedAt: "desc" },
        });
      }
    }

    if (!activeLoan) {
      return res.status(404).json({
        success: false,
        error: `No active borrowing loan record found for "${searchTerm}"`,
      });
    }

    const book = activeLoan.book || (activeLoan.bookId ? await prisma.libraryBook.findUnique({ where: { id: activeLoan.bookId } }) : null);
    const resolvedBookTitle = book?.title || activeLoan.bookTitle || "Book";

    const returnDate = new Date();
    const dueDate = new Date(activeLoan.dueAt);
    const returnHijri = getHijriString(returnDate);
    const dueHijri = getHijriString(dueDate);

    // Calculate Late & Garamat (Standard: ₹10 per day)
    const isLate = returnDate.getTime() > dueDate.getTime();
    let daysLate = 0;
    let garamatAmount = 0;

    if (isLate) {
      const diffMs = returnDate.getTime() - dueDate.getTime();
      daysLate = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
      garamatAmount = typeof garamatAmountCustom === "number" ? garamatAmountCustom : daysLate * 10; // standard ₹10/day
    }

    // Parse existing notes JSON if any
    let existingMeta: any = {};
    try {
      if (activeLoan.notes && activeLoan.notes.startsWith("{")) {
        existingMeta = JSON.parse(activeLoan.notes);
      }
    } catch {
      existingMeta = { rawNote: activeLoan.notes };
    }

    const updatedMeta = {
      ...existingMeta,
      returnHijri,
      returnedAt: returnDate.toISOString(),
      garamat: isLate
        ? {
            isLate: true,
            daysLate,
            ratePerDay: 10,
            calculatedAmount: garamatAmount,
            status: garamatAction,
            paidAmount: garamatAction === "WAIVED" ? 0 : garamatAmount,
            notes: garamatNotes,
            settledAt: returnDate.toISOString(),
          }
        : null,
    };

    // Update active loan to RETURNED
    const updatedLoan = await prisma.bookLoan.update({
      where: { id: activeLoan.id },
      data: {
        status: "RETURNED",
        returnedAt: returnDate,
        notes: JSON.stringify(updatedMeta),
      },
    });

    // Update book inventory: the copy is back on the shelf and lendable again.
    // availableCopies is capped at totalCopies so repeated/legacy returns can
    // never leave the catalog with more copies than the library owns.
    let updatedBook = book;
    if (book) {
      if (confirmRestock) {
        const nextAvailable = Math.min(book.totalCopies, book.availableCopies + 1);
        updatedBook = await prisma.libraryBook.update({
          where: { id: book.id },
          data: {
            status: "AVAILABLE",
            availableCopies: nextAvailable,
          },
        });
      } else {
        updatedBook = await prisma.libraryBook.update({
          where: { id: book.id },
          data: { status: "RESTOCK_QUEUE" },
        });
      }
    }

    // Borrower identity for the return receipt / fine panel.
    const borrowerName = await resolveBorrowerName(activeLoan);
    const borrowerMeta = existingMeta || {};

    // Invalidate parent dashboard cache
    cache.invalidatePrefix("parent:dashboard");

    // Send notifications
    try {
      const studentProfile = await prisma.studentProfile.findFirst({
        where: {
          OR: [
            { id: activeLoan.studentId },
            { userId: activeLoan.studentId },
            { studentId: activeLoan.studentId },
          ],
        },
        select: { userId: true },
      });

      const notifyUserId = studentProfile?.userId || activeLoan.studentId;

      let notifBody = `"${resolvedBookTitle}" was returned on ${returnDate.toLocaleDateString("en-US")} (${returnHijri}).`;
      if (isLate) {
        notifBody += ` Overdue return completed. Shukran!`;
      } else {
        notifBody += ` Returned on time. Shukran!`;
      }

      await prisma.notification.create({
        data: {
          userId: notifyUserId,
          title: "Book Returned Successfully 📖",
          body: notifBody,
          type: "LIBRARY",
          link: "/talabat/library",
        },
      });

      sendPushToUser(notifyUserId, {
        title: "Book Returned Successfully 📖",
        body: notifBody,
        url: "/talabat/library",
        tag: `book-return-${activeLoan.id}`,
      }).catch(() => {});
    } catch (notifErr) {
      console.warn("Notification error on return:", notifErr);
    }

    return res.json({
      success: true,
      data: {
        message: isLate
          ? `Returned "${resolvedBookTitle}" from ${borrowerName}. Overdue by ${daysLate} days — Garamat: ₹${garamatAmount} [${garamatAction}].`
          : `Returned "${resolvedBookTitle}" from ${borrowerName} on time.`,
        isLate,
        daysLate,
        ratePerDay: 10,
        garamat: isLate
          ? {
              daysLate,
              ratePerDay: 10,
              amount: garamatAmount,
              status: garamatAction,
              notes: garamatNotes,
            }
          : null,
        restockRequired: !confirmRestock,
        // Borrower shown on the return receipt and the garamat panel.
        borrower: {
          name: borrowerName,
          id: activeLoan.studentId,
          darjah: borrowerMeta.borrowerDarjah || "General",
          role: borrowerMeta.borrowerType || (/faculty/i.test(borrowerName) ? "FACULTY" : "STUDENT"),
          phone: borrowerMeta.borrowerPhone || borrowerMeta.parentPhone || null,
        },
        // studentName is echoed here so every existing caller keeps working
        // even when the stored value was blank.
        loan: { ...updatedLoan, studentName: borrowerName },
        book: {
          ...(updatedBook || book),
          status: confirmRestock ? "AVAILABLE" : "RESTOCK_QUEUE",
          availableCopies: (updatedBook || book)?.availableCopies ?? 0,
        },
        dates: {
          borrowedAt: activeLoan.borrowedAt.toISOString(),
          dueAt: dueDate.toISOString(),
          returnedAt: returnDate.toISOString(),
          dueHijri,
          returnHijri,
        },
      },
    });
  } catch (error) {
    console.error("Library return error:", error);
    return res.status(500).json({ success: false, error: "Failed to process book return" });
  }
});

export default router;
