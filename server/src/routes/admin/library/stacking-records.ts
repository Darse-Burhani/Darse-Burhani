import { Router } from "express";
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";
import {
  gregorianToJulianDay,
  julianDayToHijri,
  hijriToJulianDay,
  julianDayToGregorian,
  getDaysInHijriMonth,
  HIJRI_MONTHS,
} from "../../../lib/fatimi-calendar";
import {
  dispatchWhatsAppNotification,
  generateWhatsAppLink,
  formatWhatsAppPhone,
} from "../../../lib/whatsapp";
import { sendEmail } from "../../../lib/email";

const router = Router();

// Helper to convert any Date to Fatimi Hijri formatted details
function getHijriDetails(date: Date) {
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

  return {
    year: hijri.year,
    month: hijri.month,
    day: hijri.day,
    monthName: mMeta.en,
    monthNameAr: mMeta.ar,
    formatted: `${hijri.day} ${mMeta.en} ${hijri.year} H`,
    formattedShort: `${hijri.day} ${mMeta.short} ${hijri.year}`,
  };
}

// GET /api/admin/library/stacking-records - Monthly circulation stacking records with dual Hijri & English focus
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const now = new Date();
    const currentHijri = getHijriDetails(now);

    const hijriMonthParam = req.query.hijriMonth ? Number(req.query.hijriMonth) : currentHijri.month;
    const hijriYearParam = req.query.hijriYear ? Number(req.query.hijriYear) : currentHijri.year;
    const roleFilter = (req.query.role as string) || "ALL"; // "ALL" | "STUDENT" | "FACULTY"
    const statusFilter = (req.query.status as string) || "ALL"; // "ALL" | "ACTIVE" | "RETURNED" | "OVERDUE"
    const searchQuery = ((req.query.search as string) || "").trim().toLowerCase();

    // Calculate Gregorian boundary dates for the requested Hijri month
    const startJd = hijriToJulianDay(hijriYearParam, hijriMonthParam, 1);
    const daysInMonth = getDaysInHijriMonth(hijriYearParam, hijriMonthParam);
    const endJd = hijriToJulianDay(hijriYearParam, hijriMonthParam, daysInMonth);

    const startGreg = julianDayToGregorian(startJd);
    const endGreg = julianDayToGregorian(endJd);

    const monthStartDate = new Date(startGreg.year, startGreg.month - 1, startGreg.day, 0, 0, 0);
    const monthEndDate = new Date(endGreg.year, endGreg.month - 1, endGreg.day, 23, 59, 59);

    const hMeta = HIJRI_MONTHS[hijriMonthParam - 1] || HIJRI_MONTHS[0];
    const hijriMonthLabel = `${hMeta.en} ${hijriYearParam} H`;
    const gregorianMonthLabel = monthStartDate.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    // Query book loans that were borrowed, returned, or active in this window
    const loans = await prisma.bookLoan.findMany({
      where: {
        OR: [
          { borrowedAt: { gte: monthStartDate, lte: monthEndDate } },
          { returnedAt: { gte: monthStartDate, lte: monthEndDate } },
          { status: "ACTIVE" },
        ],
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            barcode: true,
            category: true,
            rackNumber: true,
            shelfNumber: true,
            coverImage: true,
          },
        },
      },
      orderBy: { borrowedAt: "desc" },
    });

    // Student & parent profile cache
    const studentUserIds = Array.from(new Set(loans.map((l) => l.studentId)));
    const studentProfiles = await prisma.studentProfile.findMany({
      where: { userId: { in: studentUserIds } },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        parentLinks: {
          include: {
            parent: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true } },
              },
            },
          },
          take: 1,
        },
        classEnrollments: {
          include: { class: { select: { name: true, grade: true, section: true } } },
          where: { isActive: true },
          take: 1,
        },
      },
    });

    const studentMap = new Map(studentProfiles.map((s) => [s.userId, s]));

    let totalIssued = 0;
    let totalReturned = 0;
    let totalActive = 0;
    let totalOverdue = 0;
    let totalGaramatAssessed = 0;
    let totalGaramatCollected = 0;
    let studentBorrowersCount = 0;
    let facultyBorrowersCount = 0;

    const transformedRecords = loans
      .map((loan) => {
        let meta: any = {};
        try {
          if (loan.notes && loan.notes.startsWith("{")) {
            meta = JSON.parse(loan.notes);
          }
        } catch {
          meta = {};
        }

        const student = studentMap.get(loan.studentId);
        const parentLink = student?.parentLinks[0]?.parent;
        const isFaculty = loan.studentName.includes("(Faculty)") || meta.borrowerType === "FACULTY";
        const borrowerRole = isFaculty ? "FACULTY" : "STUDENT";

        const darjah = student?.classEnrollments[0]?.class
          ? `Grade ${student.classEnrollments[0].class.grade}-${student.classEnrollments[0].class.section}`
          : student?.grade
          ? `Grade ${student.grade}`
          : meta.borrowerDarjah || (isFaculty ? "Faculty Department" : "General");

        const parentName = parentLink
          ? `${parentLink.user.firstName} ${parentLink.user.lastName}`.trim()
          : student?.fatherName || student?.motherName || meta.parentName || "Unassigned";

        const parentPhone = parentLink?.phone || student?.fatherPhone || meta.parentPhone || null;
        const parentEmail = parentLink?.user.email || student?.fatherEmail || null;

        const borrowedAt = new Date(loan.borrowedAt);
        const dueAt = new Date(loan.dueAt);
        const returnedAt = loan.returnedAt ? new Date(loan.returnedAt) : null;

        const borrowedHijri = getHijriDetails(borrowedAt);
        const dueHijri = getHijriDetails(dueAt);
        const returnedHijri = returnedAt ? getHijriDetails(returnedAt) : null;

        const isCurrentlyOverdue = loan.status === "ACTIVE" && now.getTime() > dueAt.getTime();
        const daysOverdue = isCurrentlyOverdue
          ? Math.max(1, Math.ceil((now.getTime() - dueAt.getTime()) / (1000 * 60 * 60 * 24)))
          : 0;

        // Garamat details
        let garamat = meta.garamat || null;
        if (!garamat && isCurrentlyOverdue) {
          garamat = {
            isLate: true,
            daysLate: daysOverdue,
            ratePerDay: 5,
            calculatedAmount: daysOverdue * 5,
            status: "PENDING",
            paidAmount: 0,
          };
        }

        // Tally monthly metrics
        if (borrowedAt >= monthStartDate && borrowedAt <= monthEndDate) totalIssued++;
        if (returnedAt && returnedAt >= monthStartDate && returnedAt <= monthEndDate) totalReturned++;
        if (loan.status === "ACTIVE") totalActive++;
        if (isCurrentlyOverdue) totalOverdue++;

        if (garamat) {
          totalGaramatAssessed += garamat.calculatedAmount || 0;
          if (garamat.status === "COLLECTED") {
            totalGaramatCollected += garamat.paidAmount || garamat.calculatedAmount || 0;
          }
        }

        if (borrowerRole === "FACULTY") facultyBorrowersCount++;
        else studentBorrowersCount++;

        // Generate customized WhatsApp reminder text & link
        const targetPhone = parentPhone || student?.mobileNumber || null;
        const waReminderMessage = `*Maktabat Darse Burhani — Circulation Alert* 📚\n\n` +
          `*Member:* ${loan.studentName} (${darjah})\n` +
          `*Book Title:* ${loan.bookTitle}\n` +
          `*Barcode:* ${loan.bookBarcode || "N/A"}\n` +
          `*Return Due Date:* ${dueAt.toLocaleDateString("en-US")} (${dueHijri.formatted})\n` +
          (isCurrentlyOverdue
            ? `⚠️ *STATUS: OVERDUE* by ${daysOverdue} day(s). Please return to the library desk.\n`
            : `_Reminder: Please return to the library desk on or before the due date._\n`) +
          `\nDarse Burhani Library Administration.`;

        const whatsAppUrl = targetPhone ? generateWhatsAppLink(targetPhone, waReminderMessage) : null;

        return {
          id: loan.id,
          bookId: loan.bookId,
          bookTitle: loan.bookTitle,
          bookBarcode: loan.bookBarcode || loan.book?.barcode || "N/A",
          category: loan.book?.category || "General",
          location: [loan.book?.rackNumber, loan.book?.shelfNumber].filter(Boolean).join(" · ") || "Library Shelf",
          coverImage: loan.book?.coverImage || null,
          borrowerName: loan.studentName,
          borrowerId: loan.studentId,
          borrowerRole,
          darjah,
          parentName,
          parentPhone,
          parentEmail,
          contactPhone: targetPhone,
          status: isCurrentlyOverdue ? "OVERDUE" : loan.status,
          borrowedAt: borrowedAt.toISOString(),
          borrowedDateEn: borrowedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          borrowedDateHijri: borrowedHijri.formatted,
          dueAt: dueAt.toISOString(),
          dueDateEn: dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          dueDateHijri: dueHijri.formatted,
          returnedAt: returnedAt?.toISOString() || null,
          returnedDateEn: returnedAt?.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) || null,
          returnedDateHijri: returnedHijri?.formatted || null,
          isOverdue: isCurrentlyOverdue,
          daysOverdue,
          garamat,
          whatsAppUrl,
        };
      })
      .filter((rec) => {
        if (roleFilter !== "ALL" && rec.borrowerRole !== roleFilter) return false;
        if (statusFilter !== "ALL" && rec.status !== statusFilter) return false;
        if (searchQuery) {
          const matchTitle = rec.bookTitle.toLowerCase().includes(searchQuery);
          const matchBarcode = rec.bookBarcode.toLowerCase().includes(searchQuery);
          const matchBorrower = rec.borrowerName.toLowerCase().includes(searchQuery);
          const matchDarjah = rec.darjah.toLowerCase().includes(searchQuery);
          const matchParent = rec.parentName.toLowerCase().includes(searchQuery);
          if (!matchTitle && !matchBarcode && !matchBorrower && !matchDarjah && !matchParent) {
            return false;
          }
        }
        return true;
      });

    // ── Monthly Stacking by Borrower (All issues name & volume per Hijri month) ──
    const borrowerMap = new Map<string, {
      borrowerId: string;
      borrowerName: string;
      borrowerRole: "STUDENT" | "FACULTY";
      darjah: string;
      parentName: string;
      parentPhone: string | null;
      parentEmail: string | null;
      issuedCount: number;
      returnedCount: number;
      overdueCount: number;
      totalGaramat: number;
      books: Array<{
        id: string;
        bookTitle: string;
        bookBarcode: string;
        borrowedDateHijri: string;
        dueDateHijri: string;
        status: string;
        isOverdue: boolean;
        garamatAmount: number;
      }>;
    }>();

    for (const rec of transformedRecords) {
      const existing = borrowerMap.get(rec.borrowerId);
      const b = existing || {
        borrowerId: rec.borrowerId,
        borrowerName: rec.borrowerName,
        borrowerRole: (rec.borrowerRole === "FACULTY" ? "FACULTY" : "STUDENT") as "STUDENT" | "FACULTY",
        darjah: rec.darjah,
        parentName: rec.parentName,
        parentPhone: rec.parentPhone,
        parentEmail: rec.parentEmail,
        issuedCount: 0,
        returnedCount: 0,
        overdueCount: 0,
        totalGaramat: 0,
        books: [] as any[],
      };
      if (!existing) {
        borrowerMap.set(rec.borrowerId, b);
      }

      b.issuedCount++;
      if (rec.status === "RETURNED") b.returnedCount++;
      if (rec.status === "OVERDUE" || rec.isOverdue) b.overdueCount++;
      if (rec.garamat?.calculatedAmount) {
        b.totalGaramat += rec.garamat.calculatedAmount;
      }
      b.books.push({
        id: rec.id,
        bookTitle: rec.bookTitle,
        bookBarcode: rec.bookBarcode,
        borrowedDateHijri: rec.borrowedDateHijri,
        dueDateHijri: rec.dueDateHijri,
        status: rec.status,
        isOverdue: rec.isOverdue,
        garamatAmount: rec.garamat?.calculatedAmount || 0,
      });
    }

    const borrowerStack = Array.from(borrowerMap.values()).sort((a, b) => b.issuedCount - a.issuedCount);

    return res.json({
      success: true,
      month: {
        hijriMonth: hijriMonthParam,
        hijriYear: hijriYearParam,
        hijriLabel: hijriMonthLabel,
        hijriMonthName: hMeta.en,
        hijriMonthAr: hMeta.ar,
        gregorianLabel: gregorianMonthLabel,
        startDate: monthStartDate.toISOString(),
        endDate: monthEndDate.toISOString(),
      },
      stats: {
        totalRecords: transformedRecords.length,
        totalIssued,
        totalReturned,
        totalActive,
        totalOverdue,
        totalGaramatAssessed,
        totalGaramatCollected,
        studentBorrowersCount,
        facultyBorrowersCount,
        uniqueBorrowers: borrowerStack.length,
      },
      borrowerStack,
      data: transformedRecords,
    });
  } catch (error) {
    console.error("Stacking records error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch stacking records" });
  }
});

// POST /api/admin/library/stacking-records/send-reminder - Multi-channel instant reminder (WhatsApp + Email)
router.post("/send-reminder", requireRole("ADMIN"), async (req, res) => {
  try {
    const { loanId, channels = ["whatsapp", "email"], reminderType = "DUE_REMINDER" } = req.body;

    if (!loanId) {
      return res.status(400).json({ success: false, error: "Loan ID is required" });
    }

    const loan = await prisma.bookLoan.findUnique({
      where: { id: loanId },
      include: {
        book: { select: { title: true, barcode: true } },
      },
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: "Loan not found" });
    }

    const dueAt = new Date(loan.dueAt);
    const dueHijri = getHijriDetails(dueAt);
    const dueDateLabel = dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    // Lookup student & parent contact
    const student = await prisma.studentProfile.findFirst({
      where: {
        OR: [
          { userId: loan.studentId },
          { id: loan.studentId },
          { studentId: loan.studentId },
        ],
      },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        parentLinks: {
          include: {
            parent: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true } },
              },
            },
          },
          take: 1,
        },
        classEnrollments: {
          include: { class: { select: { name: true, grade: true, section: true } } },
          where: { isActive: true },
          take: 1,
        },
      },
    });

    const parentLink = student?.parentLinks[0]?.parent;
    const parentPhone = parentLink?.phone || student?.fatherPhone || student?.motherPhone || student?.mobileNumber || null;
    const parentEmail = parentLink?.user?.email || student?.fatherEmail || student?.user?.email || null;
    const studentName = student ? `${student.user.firstName} ${student.user.lastName}` : loan.studentName;
    const darjah = student?.classEnrollments[0]?.class
      ? `Grade ${student.classEnrollments[0].class.grade}-${student.classEnrollments[0].class.section}`
      : student?.grade ? `Grade ${student.grade}` : "Member";

    const isOverdue = new Date().getTime() > dueAt.getTime();
    const daysOverdue = isOverdue ? Math.max(1, Math.ceil((new Date().getTime() - dueAt.getTime()) / 86400000)) : 0;

    let reminderTitle = "Library Circulation Reminder 📚";
    let reminderHeadline = `Your borrowed book "${loan.bookTitle}" is due on ${dueDateLabel} (${dueHijri.formatted}).`;

    if (reminderType === "ONE_DAY_BEFORE") {
      reminderTitle = "Library Reminder: Due Tomorrow ⏳";
      reminderHeadline = `Friendly reminder: "${loan.bookTitle}" is due tomorrow, ${dueDateLabel} (${dueHijri.formatted}).`;
    } else if (reminderType === "DAY_OF_DUE") {
      reminderTitle = "Library Alert: Book Due Today ⚠️";
      reminderHeadline = `Reminder: "${loan.bookTitle}" is due back today, ${dueDateLabel} (${dueHijri.formatted}).`;
    } else if (isOverdue) {
      reminderTitle = "Overdue Library Book Notice ⚠️";
      reminderHeadline = `"${loan.bookTitle}" is OVERDUE by ${daysOverdue} day(s). Please return it to the library desk as soon as possible.`;
    }

    // 1. WhatsApp Dispatch & Link
    let whatsAppSent = false;
    let whatsAppLink: string | null = null;
    const waText = `*Maktabat Darse Burhani — ${reminderTitle}*\n\n` +
      `*Talabat:* ${studentName} (${darjah})\n` +
      `*Book:* ${loan.bookTitle}\n` +
      `*Barcode:* ${loan.bookBarcode || "N/A"}\n` +
      `*Due Date:* ${dueDateLabel} (${dueHijri.formatted})\n\n` +
      `${reminderHeadline}\n\n` +
      `Please ensure books are returned to the library on time.\n` +
      `_Darse Burhani Library Administration._`;

    if (parentPhone) {
      whatsAppLink = generateWhatsAppLink(parentPhone, waText);
      if (channels.includes("whatsapp")) {
        try {
          await dispatchWhatsAppNotification({ phone: parentPhone, message: waText });
          whatsAppSent = true;
        } catch (waErr) {
          console.warn("[reminder] WhatsApp dispatch failed:", waErr);
        }
      }
    }

    // 2. Email Dispatch
    let emailSent = false;
    if (channels.includes("email") && parentEmail) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="background: #064e3b; padding: 16px; border-radius: 8px; text-align: center; color: white;">
            <h2 style="margin: 0; font-size: 18px;">Maktabat Darse Burhani</h2>
            <p style="margin: 4px 0 0; font-size: 12px; color: #fef3c7;">${reminderTitle}</p>
          </div>
          <div style="padding: 20px 0;">
            <p><strong>Member / Talabat:</strong> ${studentName} (${darjah})</p>
            <p><strong>Book:</strong> ${loan.bookTitle} (Barcode: ${loan.bookBarcode || "N/A"})</p>
            <p><strong>Due Date:</strong> ${dueDateLabel} (<strong>${dueHijri.formatted}</strong>)</p>
            <p style="background: #f8fafc; padding: 12px; border-left: 4px solid #d97706; margin: 15px 0;">
              ${reminderHeadline}
            </p>
            <p style="font-size: 13px; color: #64748b;">
              Library circulation hours: 8:30 AM – 4:00 PM. Please visit the library desk for return or renewal.
            </p>
          </div>
          <div style="border-top: 1px dashed #cbd5e1; padding-top: 12px; text-align: center; font-size: 11px; color: #94a3b8;">
            Maktabat Darse Burhani · Circulation &amp; Physical Inventory Desk
          </div>
        </div>
      `;

      try {
        await sendEmail({
          to: parentEmail,
          subject: `${reminderTitle} - ${loan.bookTitle}`,
          html: emailHtml,
        });
        emailSent = true;
      } catch (emErr) {
        console.warn("[reminder] Email dispatch failed:", emErr);
      }
    }

    // 3. In-App Notification
    await prisma.notification.create({
      data: {
        userId: loan.studentId,
        title: reminderTitle,
        body: reminderHeadline,
        type: "LIBRARY",
        link: "/talabat/library",
      },
    });

    return res.json({
      success: true,
      message: `Reminder triggered for "${loan.bookTitle}"`,
      whatsAppSent,
      whatsAppLink,
      emailSent,
      recipient: {
        name: studentName,
        phone: parentPhone,
        email: parentEmail,
      },
    });
  } catch (error) {
    console.error("Send reminder error:", error);
    return res.status(500).json({ success: false, error: "Failed to dispatch reminder" });
  }
});

export default router;
