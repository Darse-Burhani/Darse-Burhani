import { Router } from "express";
import prisma from "../../../lib/prisma";
import { cache } from "../../../lib/cache";
import { requireRole } from "../../../middleware";
import {
  gregorianToJulianDay,
  julianDayToHijri,
  HIJRI_MONTHS,
} from "../../../lib/fatimi-calendar";
import {
  dispatchWhatsAppNotification,
  generateWhatsAppLink,
} from "../../../lib/whatsapp";
import { sendPushToUser } from "../../../lib/push";

const router = Router();

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

async function generateBarcode(category: string, title: string): Promise<string> {
  const code = CATEGORY_BARCODE_CODES[category] || "99";
  const slug = title
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 20) || "BOOK";
  let base = `${code}-${slug}`;
  let candidate = base;
  let n = 2;
  while (await prisma.libraryBook.findUnique({ where: { barcode: candidate } })) {
    candidate = `${base}-${n}`;
    n++;
    if (n > 99) break;
  }
  return candidate;
}

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

// GET /api/admin/library/checkout/active-loans?userId=... - List active loans for a specific member
router.get("/active-loans", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const userId = String(req.query.userId || req.query.studentId || "").trim();
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId or studentId required" });
    }

    const loans = await prisma.bookLoan.findMany({
      where: {
        studentId: userId,
        status: "ACTIVE",
      },
      include: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            barcode: true,
            category: true,
            coverImage: true,
            rackNumber: true,
            shelfNumber: true,
          },
        },
      },
      orderBy: { borrowedAt: "desc" },
    });

    const data = loans.map((l) => ({
      id: l.id,
      bookId: l.bookId,
      bookTitle: l.bookTitle || l.book?.title || "Book",
      barcode: l.bookBarcode || l.book?.barcode || "",
      borrowedAt: l.borrowedAt,
      dueAt: l.dueAt,
      isOverdue: new Date(l.dueAt) < new Date(),
      coverImage: l.book?.coverImage,
      category: l.book?.category,
    }));

    return res.json({ success: true, data });
  } catch (error: any) {
    console.error("Get active loans error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch active loans" });
  }
});

// GET /api/admin/library/checkout/search-books - Fast search by Book Name / Title, Author, or Barcode
router.get("/search-books", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const q = String(req.query.q || req.query.query || "").trim();
    if (!q) {
      const books = await prisma.libraryBook.findMany({
        where: { status: "AVAILABLE", availableCopies: { gt: 0 } },
        select: {
          id: true,
          title: true,
          author: true,
          barcode: true,
          category: true,
          coverImage: true,
          status: true,
          availableCopies: true,
          totalCopies: true,
          rackNumber: true,
        },
        orderBy: { updatedAt: "desc" },
        take: 15,
      });
      return res.json({ success: true, data: books });
    }

    const tokens = q.split(/\s+/).filter(Boolean);
    const whereClause: any = tokens.length === 1
      ? {
          OR: [
            { title: { contains: tokens[0], mode: "insensitive" } },
            { author: { contains: tokens[0], mode: "insensitive" } },
            { barcode: { contains: tokens[0], mode: "insensitive" } },
            { category: { contains: tokens[0], mode: "insensitive" } },
          ],
        }
      : {
          AND: tokens.map((token) => ({
            OR: [
              { title: { contains: token, mode: "insensitive" } },
              { author: { contains: token, mode: "insensitive" } },
              { barcode: { contains: token, mode: "insensitive" } },
              { category: { contains: token, mode: "insensitive" } },
            ],
          })),
        };

    const books = await prisma.libraryBook.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        author: true,
        barcode: true,
        category: true,
        coverImage: true,
        status: true,
        availableCopies: true,
        totalCopies: true,
        rackNumber: true,
      },
      orderBy: [
        { availableCopies: "desc" },
        { updatedAt: "desc" },
      ],
      take: 25,
    });

    return res.json({ success: true, data: books });
  } catch (error) {
    console.error("Book search error in checkout:", error);
    return res.status(500).json({ success: false, error: "Failed to search books" });
  }
});

// POST /api/admin/library/checkout/direct-insert-and-issue - Direct book inserting & instant issuing
router.post("/direct-insert-and-issue", requireRole("ADMIN"), async (req, res) => {
  try {
    const {
      title,
      author,
      category = "General",
      barcode,
      totalCopies = 1,
      rackNumber,
      shelfNumber,
      studentId,
      issueDate,
      dueDate,
      reminderOneDayBefore = true,
      reminderDayOfDue = true,
      sendWhatsApp = true,
    } = req.body;

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: "Book title is required for direct insertion" });
    }
    if (!studentId) {
      return res.status(400).json({ success: false, error: "Member (Talabat/Faculty) ID is required" });
    }

    const resolvedCategory = String(category || "").trim() || "General";
    let resolvedBarcode = String(barcode || "").trim();
    if (!resolvedBarcode) {
      resolvedBarcode = await generateBarcode(resolvedCategory, String(title).trim());
    } else {
      const existing = await prisma.libraryBook.findUnique({ where: { barcode: resolvedBarcode } });
      if (existing) {
        return res.status(409).json({ success: false, error: `Barcode "${resolvedBarcode}" is already in use by another volume.` });
      }
    }

    const copiesCount = Math.max(1, Number(totalCopies) || 1);

    // 1. Insert the new book directly into catalog
    const newBook = await prisma.libraryBook.create({
      data: {
        isbn: null,
        title: String(title).trim(),
        author: String(author || "").trim() || null,
        category: resolvedCategory,
        barcode: resolvedBarcode,
        rackNumber: String(rackNumber || "").trim() || null,
        shelfNumber: String(shelfNumber || "").trim() || null,
        status: "AVAILABLE",
        totalCopies: copiesCount,
        availableCopies: copiesCount,
      },
    });

    // 2. Lookup borrower (Student or Faculty)
    let borrowerUserId = "";
    let borrowerName = "";
    let borrowerType: "STUDENT" | "FACULTY" = "STUDENT";
    let borrowerDarjah = "";
    let parentUserId: string | null = null;
    let parentName: string | null = null;
    let parentPhone: string | null = null;
    let borrowerPhone: string | null = null;

    const student = await prisma.studentProfile.findFirst({
      where: {
        OR: [
          { trNo: { equals: studentId } },
          { its: { equals: studentId } },
          { studentId: { equals: studentId } },
          { id: { equals: studentId } },
          { userId: { equals: studentId } },
        ],
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        parentLinks: {
          include: {
            parent: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
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

    if (student) {
      borrowerUserId = student.user.id;
      borrowerName = `${student.user.firstName} ${student.user.lastName}`.trim();
      borrowerType = "STUDENT";
      borrowerDarjah = student.classEnrollments[0]?.class
        ? `Grade ${student.classEnrollments[0].class.grade}-${student.classEnrollments[0].class.section}`
        : student.grade ? `Grade ${student.grade}` : "General";
      borrowerPhone = student.mobileNumber || student.fatherPhone || student.motherPhone || null;

      const pLink = student.parentLinks[0]?.parent;
      if (pLink) {
        parentUserId = pLink.user.id;
        parentName = `${pLink.user.firstName} ${pLink.user.lastName}`.trim();
        parentPhone = pLink.phone || null;
      } else {
        parentName = student.fatherName || student.motherName || null;
        parentPhone = student.fatherPhone || student.motherPhone || null;
      }
    } else {
      const teacher = await prisma.teacherProfile.findFirst({
        where: {
          OR: [
            { employeeId: { equals: studentId } },
            { its: { equals: studentId } },
            { id: { equals: studentId } },
            { userId: { equals: studentId } },
          ],
        },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });

      if (teacher) {
        borrowerUserId = teacher.user.id;
        borrowerName = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
        borrowerType = "FACULTY";
        borrowerDarjah = teacher.department || "Faculty";
        borrowerPhone = teacher.mobile || null;
      }
    }

    if (!borrowerUserId) {
      return res.status(404).json({ success: false, error: "Member (Talabat/Faculty) could not be identified" });
    }

    const borrowedDate = issueDate ? new Date(issueDate) : new Date();
    const finalDueDate = dueDate
      ? new Date(dueDate)
      : new Date(borrowedDate.getTime() + (borrowerType === "FACULTY" ? 30 : 14) * 86400000);

    const issueHijri = getHijriString(borrowedDate);
    const dueHijri = getHijriString(finalDueDate);

    const notesMeta = {
      borrowerType,
      borrowerDarjah,
      parentName,
      parentPhone,
      parentUserId,
      borrowerPhone,
      issueHijri,
      dueHijri,
      reminders: {
        oneDayBefore: !!reminderOneDayBefore,
        dayOfDue: !!reminderDayOfDue,
        oneDayBeforeSent: false,
        dayOfDueSent: false,
      },
    };

    // 3. Create Loan record immediately
    const loan = await prisma.bookLoan.create({
      data: {
        bookId: newBook.id,
        studentId: borrowerUserId,
        studentName: `${borrowerName}${borrowerType === "FACULTY" ? " (Faculty)" : ""}`,
        bookTitle: newBook.title,
        bookBarcode: newBook.barcode,
        borrowedAt: borrowedDate,
        dueAt: finalDueDate,
        status: "ACTIVE",
        notes: JSON.stringify(notesMeta),
      },
    });

    // 4. Update book available copies
    await prisma.libraryBook.update({
      where: { id: newBook.id },
      data: {
        status: newBook.availableCopies - 1 <= 0 ? "BORROWED" : "AVAILABLE",
        availableCopies: { decrement: 1 },
      },
    });

    cache.invalidatePrefix("parent:dashboard");

    const dueDateLabel = finalDueDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    // Create In-App Notification
    await prisma.notification.create({
      data: {
        userId: borrowerUserId,
        title: "Book Issued 📖",
        body: `"${newBook.title}" has been inserted and issued to you. Due on ${dueDateLabel} (${dueHijri}).`,
        type: "LIBRARY",
        link: borrowerType === "FACULTY" ? "/teacher" : "/talabat/library",
      },
    });

    sendPushToUser(borrowerUserId, {
      title: "Book Issued 📖",
      body: `"${newBook.title}" has been issued to you. Due on ${dueDateLabel} (${dueHijri}).`,
      url: borrowerType === "FACULTY" ? "/teacher" : "/talabat/library",
      tag: `loan-issue-${newBook.id}`,
    }).catch(() => {});

    if (parentUserId) {
      await prisma.notification.create({
        data: {
          userId: parentUserId,
          title: `Library Book Issued to ${borrowerName}`,
          body: `"${newBook.title}" has been checked out by ${borrowerName}. Due: ${dueDateLabel} (${dueHijri}).`,
          type: "LIBRARY",
          link: "/parent/library",
        },
      });

      sendPushToUser(parentUserId, {
        title: `Library Book Issued to ${borrowerName}`,
        body: `"${newBook.title}" has been checked out by ${borrowerName}. Due: ${dueDateLabel} (${dueHijri}).`,
        url: "/parent/library",
        tag: `parent-loan-${newBook.id}`,
      }).catch(() => {});
    }

    // Prepare WhatsApp Message
    const targetWaPhone = parentPhone || borrowerPhone;
    const waMessage = `*Maktabat Darse Burhani — Book Inserted & Issued* 📚\n\n` +
      `*Book:* ${newBook.title}\n` +
      `*Barcode:* ${newBook.barcode || "N/A"}\n` +
      `*Issued To:* ${borrowerName} (${borrowerDarjah})\n` +
      `*Issue Date:* ${borrowedDate.toLocaleDateString("en-US")} (${issueHijri})\n` +
      `*Return Due Date:* ${dueDateLabel} (${dueHijri})\n\n` +
      `Darse Burhani Library Desk.`;

    let whatsAppUrl: string | null = null;
    if (targetWaPhone) {
      whatsAppUrl = generateWhatsAppLink(targetWaPhone, waMessage);
      if (sendWhatsApp) {
        dispatchWhatsAppNotification({ phone: targetWaPhone, message: waMessage }).catch((waErr) => {
          console.warn("[checkout] WhatsApp dispatch error:", waErr?.message || waErr);
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `Successfully inserted "${newBook.title}" into catalog and issued to ${borrowerName}!`,
      data: {
        loan,
        book: newBook,
        member: {
          id: borrowerUserId,
          name: borrowerName,
          role: borrowerType,
          darjah: borrowerDarjah,
        },
        dates: {
          borrowedAt: borrowedDate.toISOString(),
          dueAt: finalDueDate.toISOString(),
          issueHijri,
          dueHijri,
        },
        whatsAppUrl,
      },
    });
  } catch (error: any) {
    console.error("Direct insert and issue error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to insert and issue book" });
  }
});

// POST /api/admin/library/checkout - Issue a book with dual calendars & parent synchronization
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const body = req.body as Record<string, any>;
    const {
      barcode,
      bookId,
      bookName,
      studentId,
      issueDate,
      dueDate,
      reminderOneDayBefore = true,
      reminderDayOfDue = true,
      sendWhatsApp = true,
    } = body;

    const bookQuery = String(barcode || bookName || bookId || "").trim();

    if (!bookQuery) {
      return res.status(400).json({ success: false, error: "Book name or barcode is required" });
    }
    if (!studentId) {
      return res.status(400).json({ success: false, error: "Member (Talabat/Faculty) ID is required" });
    }

    // 1. Find book by barcode or direct ID first
    let book = await prisma.libraryBook.findFirst({
      where: {
        OR: [{ barcode: bookQuery }, { id: bookQuery }],
      },
    });

    // 2. If not found by barcode/id, search by exact book title
    if (!book) {
      book = await prisma.libraryBook.findFirst({
        where: {
          title: { equals: bookQuery, mode: "insensitive" },
        },
      });
    }

    // 3. If still not found, search by containing book title or author (preferring AVAILABLE copies)
    if (!book) {
      book = await prisma.libraryBook.findFirst({
        where: {
          OR: [
            { title: { contains: bookQuery, mode: "insensitive" } },
            { author: { contains: bookQuery, mode: "insensitive" } },
          ],
        },
        orderBy: [
          { availableCopies: "desc" },
          { updatedAt: "desc" },
        ],
      });
    }

    if (!book) {
      return res.status(404).json({ success: false, error: `Book matching "${bookQuery}" not found in library catalog` });
    }

    if (book.status !== "AVAILABLE" || book.availableCopies < 1) {
      return res.status(400).json({ success: false, error: `"${book.title}" is currently not available for checkout (0 copies available)` });
    }

    // Lookup borrower (Student or Faculty)
    let borrowerUserId = "";
    let borrowerName = "";
    let borrowerType: "STUDENT" | "FACULTY" = "STUDENT";
    let borrowerDarjah = "";
    let parentUserId: string | null = null;
    let parentName: string | null = null;
    let parentPhone: string | null = null;
    let borrowerPhone: string | null = null;

    const student = await prisma.studentProfile.findFirst({
      where: {
        OR: [
          { trNo: { equals: studentId } },
          { its: { equals: studentId } },
          { studentId: { equals: studentId } },
          { id: { equals: studentId } },
          { userId: { equals: studentId } },
        ],
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        parentLinks: {
          include: {
            parent: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
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

    if (student) {
      borrowerUserId = student.user.id;
      borrowerName = `${student.user.firstName} ${student.user.lastName}`.trim();
      borrowerType = "STUDENT";
      borrowerDarjah = student.classEnrollments[0]?.class
        ? `Grade ${student.classEnrollments[0].class.grade}-${student.classEnrollments[0].class.section}`
        : student.grade ? `Grade ${student.grade}` : "General";
      borrowerPhone = student.mobileNumber || student.fatherPhone || student.motherPhone || null;

      const pLink = student.parentLinks[0]?.parent;
      if (pLink) {
        parentUserId = pLink.user.id;
        parentName = `${pLink.user.firstName} ${pLink.user.lastName}`.trim();
        parentPhone = pLink.phone || null;
      } else {
        parentName = student.fatherName || student.motherName || null;
        parentPhone = student.fatherPhone || student.motherPhone || null;
      }
    } else {
      const teacher = await prisma.teacherProfile.findFirst({
        where: {
          OR: [
            { employeeId: { equals: studentId } },
            { its: { equals: studentId } },
            { id: { equals: studentId } },
            { userId: { equals: studentId } },
          ],
        },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });

      if (teacher) {
        borrowerUserId = teacher.user.id;
        borrowerName = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
        borrowerType = "FACULTY";
        borrowerDarjah = teacher.department || "Faculty";
        borrowerPhone = teacher.mobile || null;
      }
    }

    if (!borrowerUserId) {
      return res.status(404).json({ success: false, error: "Member (Talabat/Faculty) could not be identified" });
    }

    // Check active loan limit (max 10 for faculty, 5 for student)
    const maxAllowed = borrowerType === "FACULTY" ? 10 : 5;
    const activeLoansCount = await prisma.bookLoan.count({
      where: { studentId: borrowerUserId, status: "ACTIVE" },
    });

    if (activeLoansCount >= maxAllowed) {
      return res.status(400).json({
        success: false,
        error: `${borrowerName} has reached the maximum permitted loan allowance (${maxAllowed} volumes).`,
      });
    }

    // Check for overdue loans
    const overdueLoansCount = await prisma.bookLoan.count({
      where: {
        studentId: borrowerUserId,
        status: "ACTIVE",
        dueAt: { lt: new Date() },
      },
    });

    if (overdueLoansCount > 0) {
      return res.status(400).json({
        success: false,
        error: `${borrowerName} has ${overdueLoansCount} overdue book(s). Please return overdue books before new checkouts.`,
      });
    }

    const borrowedDate = issueDate ? new Date(issueDate) : new Date();
    const finalDueDate = dueDate
      ? new Date(dueDate)
      : new Date(borrowedDate.getTime() + (borrowerType === "FACULTY" ? 30 : 14) * 86400000);

    const issueHijri = getHijriString(borrowedDate);
    const dueHijri = getHijriString(finalDueDate);

    const notesMeta = {
      borrowerType,
      borrowerDarjah,
      parentName,
      parentPhone,
      parentUserId,
      borrowerPhone,
      issueHijri,
      dueHijri,
      reminders: {
        oneDayBefore: !!reminderOneDayBefore,
        dayOfDue: !!reminderDayOfDue,
        oneDayBeforeSent: false,
        dayOfDueSent: false,
      },
    };

    // Create loan record
    const loan = await prisma.bookLoan.create({
      data: {
        bookId: book.id,
        studentId: borrowerUserId,
        studentName: `${borrowerName}${borrowerType === "FACULTY" ? " (Faculty)" : ""}`,
        bookTitle: book.title,
        bookBarcode: book.barcode,
        borrowedAt: borrowedDate,
        dueAt: finalDueDate,
        status: "ACTIVE",
        notes: JSON.stringify(notesMeta),
      },
    });

    // Update book status
    await prisma.libraryBook.update({
      where: { id: book.id },
      data: {
        status: book.availableCopies - 1 <= 0 ? "BORROWED" : "AVAILABLE",
        availableCopies: { decrement: 1 },
      },
    });

    // Invalidate parent dashboard cache so parent portal updates immediately
    cache.invalidatePrefix("parent:dashboard");

    const dueDateLabel = finalDueDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    // Create In-App Notification for Student / Faculty
    await prisma.notification.create({
      data: {
        userId: borrowerUserId,
        title: "Book Issued 📖",
        body: `"${book.title}" has been issued to you. Due on ${dueDateLabel} (${dueHijri}).`,
        type: "LIBRARY",
        link: borrowerType === "FACULTY" ? "/teacher" : "/talabat/library",
      },
    });

    sendPushToUser(borrowerUserId, {
      title: "Book Issued 📖",
      body: `"${book.title}" has been issued to you. Due on ${dueDateLabel} (${dueHijri}).`,
      url: borrowerType === "FACULTY" ? "/teacher" : "/talabat/library",
      tag: `loan-issue-${loan.id}`,
    }).catch(() => {});

    // Create In-App Notification for Parent if linked
    if (parentUserId) {
      await prisma.notification.create({
        data: {
          userId: parentUserId,
          title: `Library Book Issued to ${borrowerName}`,
          body: `"${book.title}" has been checked out by ${borrowerName} (${borrowerDarjah}). Due: ${dueDateLabel} (${dueHijri}).`,
          type: "LIBRARY",
          link: "/parent/library",
        },
      });

      sendPushToUser(parentUserId, {
        title: `Library Book Issued to ${borrowerName}`,
        body: `"${book.title}" has been checked out by ${borrowerName} (${borrowerDarjah}). Due: ${dueDateLabel} (${dueHijri}).`,
        url: "/parent/library",
        tag: `parent-loan-${loan.id}`,
      }).catch(() => {});
    }

    // Prepare WhatsApp Message & Link
    const targetWaPhone = parentPhone || borrowerPhone;
    const waMessage = `*Maktabat Darse Burhani — Book Issued* 📚\n\n` +
      `*Book:* ${book.title}\n` +
      `*Barcode:* ${book.barcode || "N/A"}\n` +
      `*Issued To:* ${borrowerName} (${borrowerDarjah})\n` +
      `*Issue Date:* ${borrowedDate.toLocaleDateString("en-US")} (${issueHijri})\n` +
      `*Return Due Date:* ${dueDateLabel} (${dueHijri})\n\n` +
      `_Automatic reminders will be sent 1 day before due date and on the due date._\n` +
      `Darse Burhani Library Desk.`;

    let whatsAppUrl: string | null = null;
    if (targetWaPhone) {
      whatsAppUrl = generateWhatsAppLink(targetWaPhone, waMessage);
      if (sendWhatsApp) {
        dispatchWhatsAppNotification({ phone: targetWaPhone, message: waMessage }).catch((waErr) => {
          console.warn("[checkout] WhatsApp dispatch error:", waErr?.message || waErr);
        });
      }
    }

    return res.status(201).json({
      success: true,
      data: {
        loan,
        member: {
          id: borrowerUserId,
          name: borrowerName,
          role: borrowerType,
          darjah: borrowerDarjah,
          parentName,
          parentPhone,
        },
        book: {
          id: book.id,
          title: book.title,
          author: book.author,
          barcode: book.barcode,
          category: book.category,
          coverImage: book.coverImage,
        },
        dates: {
          borrowedAt: borrowedDate.toISOString(),
          dueAt: finalDueDate.toISOString(),
          issueHijri,
          dueHijri,
        },
        whatsAppUrl,
      },
    });
  } catch (error) {
    console.error("Library checkout error:", error);
    return res.status(500).json({ success: false, error: "Failed to issue book" });
  }
});

// ── DELETE /api/admin/library/checkout/loan/:id ──
// Delete an issued loan record anytime and restore book stock
router.delete("/loan/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const loan = await prisma.bookLoan.findUnique({
      where: { id },
      include: { book: true },
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: "Loan record not found" });
    }

    // If the loan was active, restore available copy count
    if (loan.status === "ACTIVE" && loan.bookId) {
      await prisma.libraryBook.update({
        where: { id: loan.bookId },
        data: {
          availableCopies: { increment: 1 },
          status: "AVAILABLE",
        },
      });
    }

    // Delete loan record
    await prisma.bookLoan.delete({
      where: { id },
    });

    cache.invalidatePrefix("parent:dashboard");

    return res.json({
      success: true,
      message: `Issued loan for "${loan.bookTitle}" has been deleted successfully and book copy restored.`,
    });
  } catch (error: any) {
    console.error("Delete loan error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to delete loan" });
  }
});

// Alias DELETE /:id
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const loan = await prisma.bookLoan.findUnique({
      where: { id },
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: "Loan record not found" });
    }

    if (loan.status === "ACTIVE" && loan.bookId) {
      await prisma.libraryBook.update({
        where: { id: loan.bookId },
        data: {
          availableCopies: { increment: 1 },
          status: "AVAILABLE",
        },
      });
    }

    await prisma.bookLoan.delete({
      where: { id },
    });

    cache.invalidatePrefix("parent:dashboard");

    return res.json({
      success: true,
      message: `Issued loan for "${loan.bookTitle}" has been deleted.`,
    });
  } catch (error: any) {
    console.error("Delete loan error:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to delete loan" });
  }
});

export default router;
