
import prisma from "../../../lib/prisma";
import { requireRole } from "../../../middleware";

const router = Router();

// POST /api/admin/library/checkout - Issue a book to a student
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { barcode, studentId, dueDate } = body;

    if (!barcode) {
      return res.status(400).json({ success: false, error: "Book barcode is required" });
    }
    if (!studentId) {
      return res.status(400).json({ success: false, error: "Student ID is required" });
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

    if (book.status !== "AVAILABLE" || book.availableCopies < 1) {
      return res.status(400).json({ success: false, error: "Book is not available for checkout" });
    }

    // Find the borrower: first check Student, then check Faculty / Teacher
    let borrowerUserId = "";
    let borrowerName = "";
    let borrowerType: "STUDENT" | "FACULTY" = "STUDENT";

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
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (student) {
      borrowerUserId = student.user.id;
      borrowerName = `${student.user.firstName} ${student.user.lastName}`.trim();
      borrowerType = "STUDENT";
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
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      });

      if (teacher) {
        borrowerUserId = teacher.user.id;
        borrowerName = `${teacher.user.firstName} ${teacher.user.lastName}`.trim();
        borrowerType = "FACULTY";
      }
    }

    if (!borrowerUserId) {
      return res.status(404).json({ success: false, error: "Member (Student/Faculty) not found" });
    }

    // Check active loan limit (max 10 for faculty, 5 for student)
    const maxAllowed = borrowerType === "FACULTY" ? 10 : 5;
    const activeLoans = await prisma.bookLoan.count({
      where: { studentId: borrowerUserId, status: "ACTIVE" },
    });

    if (activeLoans >= maxAllowed) {
      return res.status(400).json({ success: false, error: `${borrowerType === "FACULTY" ? "Faculty" : "Student"} has reached maximum loan limit (${maxAllowed})` });
    }

    // Check for overdue books
    const overdueLoans = await prisma.bookLoan.count({
      where: {
        studentId: borrowerUserId,
        status: "ACTIVE",
        dueAt: { lt: new Date() },
      },
    });

    if (overdueLoans > 0) {
      return res.status(400).json({ success: false, error: `${borrowerName} has ${overdueLoans} overdue book(s). Clear them first.` });
    }

    const defaultDueDate = new Date();
    defaultDueDate.setDate(defaultDueDate.getDate() + (borrowerType === "FACULTY" ? 30 : 14)); // 30 days for faculty, 14 for student

    // Create the loan
    const loan = await prisma.bookLoan.create({
      data: {
        bookId: book.id,
        studentId: borrowerUserId,
        studentName: `${borrowerName}${borrowerType === "FACULTY" ? " (Faculty)" : ""}`,
        bookTitle: book.title,
        bookBarcode: book.barcode,
        dueAt: dueDate ? new Date(dueDate) : defaultDueDate,
        status: "ACTIVE",
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

    const dueDateLabel = loan.dueAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    await prisma.notification.create({
      data: {
        userId: borrowerUserId,
        title: "Book Issued",
        body: `"${book.title}" has been issued to you. Due back ${dueDateLabel}.`,
        type: "LIBRARY",
        link: "/talabat/library",
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        loan,
        member: { id: borrowerUserId, name: borrowerName, role: borrowerType },
        book: { id: book.id, title: book.title, author: book.author, barcode: book.barcode, coverImage: book.coverImage },
      },
    });
  } catch (error) {
    console.error("Library checkout error:", error);
    return res.status(500).json({ success: false, error: "Failed to checkout book" });
  }
});

export default router;
