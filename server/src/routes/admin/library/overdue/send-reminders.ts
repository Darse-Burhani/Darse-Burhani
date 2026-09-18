import { Router } from "express";
import prisma from "../../../../lib/prisma";
import { requireRole } from "../../../../middleware";
import { sendEmail } from "../../../../lib/email";
import { sendSms } from "../../../../lib/sms";
import { overdueReminderEmail, overdueReminderSms } from "../../../../lib/email-templates";

const router = Router();

// ── Types ──
interface OverdueGroup {
  studentId: string;
  studentName: string;
  studentUserId: string;
  parentName: string;
  parentEmail: string | null;
  parentPhone: string | null;
  books: {
    loanId: string;
    title: string;
    barcode: string;
    borrowedAt: Date;
    dueAt: Date;
    daysOverdue: number;
  }[];
  maxDaysOverdue: number;
}

// ── GET: Fetch contact info for overdue students (for the overdue page) ──
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const overdueLoans = await prisma.bookLoan.findMany({
      where: {
        status: "ACTIVE",
        dueAt: { lt: new Date() },
      },
      select: { studentId: true },
      distinct: ["studentId"],
    });

    const userIds = overdueLoans.map((l) => l.studentId);

    if (userIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Batch fetch all student profiles with parent links
    const studentProfiles = await prisma.studentProfile.findMany({
      where: { userId: { in: userIds } },
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
        },
      },
    });

    const contactInfo = studentProfiles.map((profile) => {
      const parentLink = profile.parentLinks[0];
      const parent = parentLink?.parent;
      return {
        studentName: `${profile.user.firstName} ${profile.user.lastName}`,
        studentUserId: profile.userId,
        parentName: parent
          ? `${parent.user.firstName} ${parent.user.lastName}`
          : `${profile.user.firstName} ${profile.user.lastName}`,
        parentEmail: parent?.user.email || profile.user.email || null,
        parentPhone: parent?.phone || profile.mobileNumber || null,
      };
    });

    return res.json({ success: true, data: contactInfo });
  } catch (error) {
    console.error("Fetch contact info error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch contact info" });
  }
});

// ── Batch fetch student profiles helper ──
async function fetchStudentProfiles(studentIds: string[]) {
  if (studentIds.length === 0) return new Map();

  const profiles = await prisma.studentProfile.findMany({
    where: { userId: { in: studentIds } },
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
      },
    },
  });

  const map = new Map<string, typeof profiles[0]>();
  for (const p of profiles) {
    map.set(p.userId, p);
  }
  return map;
}

// POST /api/admin/library/overdue/send-reminders - Send overdue reminders
router.post("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;

    const body = req.body as Record<string, any>;
    const { studentIds, channels = ["email"] } = body;

    // Fetch all overdue active loans
    const overdueLoans = await prisma.bookLoan.findMany({
      where: {
        status: "ACTIVE",
        dueAt: { lt: new Date() },
        ...(studentIds?.length ? { studentId: { in: studentIds } } : {}),
      },
      include: {
        book: { select: { title: true, barcode: true } },
      },
      orderBy: { studentId: "asc" },
    });

    if (overdueLoans.length === 0) {
      return res.json({
        success: true,
        message: "No overdue books found",
        sent: 0,
        failed: 0,
      });
    }

    // Batch fetch all student profiles once (fixes N+1)
    const uniqueStudentIds = Array.from(new Set(overdueLoans.map((l) => l.studentId)));
    const studentProfileMap = await fetchStudentProfiles(uniqueStudentIds);

    // Group by student
    const studentGroups = new Map<string, OverdueGroup>();

    for (const loan of overdueLoans) {
      const daysOverdue = Math.floor(
        (new Date().getTime() - new Date(loan.dueAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      if (!studentGroups.has(loan.studentId)) {
        const studentProfile = studentProfileMap.get(loan.studentId);
        if (!studentProfile) continue;

        const parentLink = studentProfile.parentLinks[0];
        const parent = parentLink?.parent;

        studentGroups.set(loan.studentId, {
          studentId: loan.studentId,
          studentName: `${studentProfile.user.firstName} ${studentProfile.user.lastName}`,
          studentUserId: loan.studentId,
          parentName: parent
            ? `${parent.user.firstName} ${parent.user.lastName}`
            : `${studentProfile.user.firstName} ${studentProfile.user.lastName}`,
          parentEmail: parent?.user.email || studentProfile.user.email || null,
          parentPhone: parent?.phone || studentProfile.mobileNumber || null,
          books: [],
          maxDaysOverdue: 0,
        });
      }

      const group = studentGroups.get(loan.studentId)!;
      group.books.push({
        loanId: loan.id,
        title: loan.book.title,
        barcode: loan.book.barcode || "",
        borrowedAt: loan.borrowedAt,
        dueAt: loan.dueAt,
        daysOverdue,
      });
      if (daysOverdue > group.maxDaysOverdue) group.maxDaysOverdue = daysOverdue;
    }

    // Send reminders
    let sentCount = 0;
    let failedCount = 0;
    const results: { studentName: string; emailSent: boolean; smsSent: boolean; error?: string }[] = [];

    const promises = Array.from(studentGroups).map(async ([, group]) => {
      const shouldSendEmail = channels.includes("email") && !!group.parentEmail;
      const shouldSendSms = channels.includes("sms") && !!group.parentPhone;

      const dataForTemplate = {
        studentName: group.studentName,
        parentName: group.parentName,
        books: group.books.map((b: OverdueGroup['books'][0]) => ({
          title: b.title,
          barcode: b.barcode,
          borrowedAt: b.borrowedAt.toLocaleDateString(),
          dueAt: b.dueAt.toLocaleDateString(),
          daysOverdue: b.daysOverdue,
        })),
        totalDaysOverdue: group.maxDaysOverdue,
      };

      let emailSent = false;
      let smsSent = false;
      let lastError: string | undefined;

      // Send Email
      if (shouldSendEmail) {
        const html = overdueReminderEmail(dataForTemplate);
        const success = await sendEmail({
          to: group.parentEmail!,
          subject: `📚 Overdue Book Notice - ${group.studentName} (${group.books.length} book${group.books.length !== 1 ? "s" : ""})`,
          html,
        });
        if (success) {
          emailSent = true;
          sentCount++;
        } else {
          lastError = "Email send failed";
          failedCount++;
        }
      }

      // Send SMS
      if (shouldSendSms) {
        const smsText = overdueReminderSms(dataForTemplate);
        const success = await sendSms({
          to: group.parentPhone!,
          message: smsText,
        });
        if (success) {
          smsSent = true;
          sentCount++;
        } else {
          lastError = lastError || "SMS send failed";
          if (!shouldSendEmail) failedCount++;
        }
      }

      // Create in-app notification for the student
      if (emailSent || smsSent) {
        try {
          await prisma.notification.create({
            data: {
              userId: group.studentUserId,
              title: "Overdue Book Reminder",
              body: `You have ${group.books.length} overdue book(s). Please return them to the library as soon as possible.`,
              type: "LIBRARY_OVERDUE",
              link: "/admin/library",
            },
          });
        } catch {
          // Non-critical
        }
      }

      results.push({ studentName: group.studentName, emailSent, smsSent, error: lastError });
    });

    await Promise.all(promises);

    return res.json({
      success: true,
      message: `Reminders sent: ${sentCount} succeeded, ${failedCount} failed`,
      sent: sentCount,
      failed: failedCount,
      totalStudents: studentGroups.size,
      results,
    });
  } catch (error) {
    console.error("Send reminders error:", error);
    return res.status(500).json({ success: false, error: "Failed to send reminders" });
  }
});

export default router;
