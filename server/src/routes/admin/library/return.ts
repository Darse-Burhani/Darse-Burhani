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

// POST /api/admin/library/return - Process return with fast scan catch & automatic Garamat calculation
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const body = req.body as Record<string, any>;
    const {
      barcode,
      confirmRestock = false,
      garamatAction = "COLLECTED", // "COLLECTED" | "WAIVED" | "PENDING"
      garamatAmountCustom,
      garamatNotes = "",
    } = body;

    if (!barcode) {
      return res.status(400).json({ success: false, error: "Book barcode is required" });
    }

    // Find the book by barcode or ID
    const book = await prisma.libraryBook.findFirst({
      where: {
        OR: [{ barcode }, { id: barcode }],
      },
    });

    if (!book) {
      return res.status(404).json({ success: false, error: `Book with barcode "${barcode}" not found in catalog` });
    }

    // Find active loan
    const activeLoan = await prisma.bookLoan.findFirst({
      where: { bookId: book.id, status: "ACTIVE" },
      orderBy: { borrowedAt: "desc" },
    });

    if (!activeLoan) {
      return res.status(404).json({
        success: false,
        error: `No active borrowing loan record found for "${book.title}" (${book.barcode || book.id})`,
      });
    }

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

    // Update book inventory status
    if (confirmRestock) {
      await prisma.libraryBook.update({
        where: { id: book.id },
        data: {
          status: "AVAILABLE",
          availableCopies: { increment: 1 },
        },
      });
    } else {
      await prisma.libraryBook.update({
        where: { id: book.id },
        data: {
          status: "RESTOCK_QUEUE",
        },
      });
    }

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

      let notifBody = `"${book.title}" was returned on ${returnDate.toLocaleDateString("en-US")} (${returnHijri}).`;
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
          ? `Returned "${book.title}". Overdue by ${daysLate} days — Garamat: ₹${garamatAmount} [${garamatAction}].`
          : `Returned "${book.title}" on time.`,
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
        loan: updatedLoan,
        book: {
          ...book,
          status: confirmRestock ? "AVAILABLE" : "RESTOCK_QUEUE",
          availableCopies: confirmRestock ? book.availableCopies + 1 : book.availableCopies,
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
