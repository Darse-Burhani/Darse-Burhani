import { Router } from "express";
import prisma from "../../../../lib/prisma";
import { requireRole } from "../../../../middleware";
import { sendEmail } from "../../../../lib/email";
import { sendSms } from "../../../../lib/sms";
import { overdueReminderEmail, overdueReminderSms, maktabatReturnReminderPlainText } from "../../../../lib/email-templates";
import {
  formatLibraryReminderWhatsAppMessage,
  dispatchWhatsAppNotification,
  generateWhatsAppLink,
} from "../../../../lib/whatsapp";

const router = Router();

// ── Types ──
interface OverdueGroup {
  studentId: string;
  studentName: string;
  studentUserId: string;
  className?: string | null;
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
    dueDiffLabel?: string;
  }[];
  maxDaysOverdue: number;
}

// ── GET: Fetch contact info for overdue students (for the overdue page) ──
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    
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
      classEnrollments: {
        where: { isActive: true },
        include: { class: { select: { name: true, grade: true, section: true } } },
        take: 1,
      },
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
router.post("/", requireRole("ADMIN", "TEACHER"), async (req, res) => {
  try {
    const body = req.body as Record<string, any>;
    const { studentIds, channels = ["email", "whatsapp"] } = body;

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
      const nowMs = new Date().getTime();
      const dueMs = new Date(loan.dueAt).getTime();
      const daysOverdue = Math.max(1, Math.floor((nowMs - dueMs) / (1000 * 60 * 60 * 24)));
      const dueDiffLabel = `Overdue by ${daysOverdue} days`;

      if (!studentGroups.has(loan.studentId)) {
        const studentProfile = studentProfileMap.get(loan.studentId);
        if (!studentProfile) continue;

        const parentLink = studentProfile.parentLinks[0];
        const parent = parentLink?.parent;
        const enrolledClass = studentProfile.classEnrollments?.[0]?.class;
        const className = enrolledClass ? (enrolledClass.name || `Class ${enrolledClass.grade} ${enrolledClass.section}`).trim() : null;

        studentGroups.set(loan.studentId, {
          studentId: loan.studentId,
          studentName: `${studentProfile.user.firstName} ${studentProfile.user.lastName}`,
          studentUserId: loan.studentId,
          className,
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
        dueDiffLabel,
      });
      if (daysOverdue > group.maxDaysOverdue) group.maxDaysOverdue = daysOverdue;
    }

    // Send reminders
    let sentCount = 0;
    let failedCount = 0;
    const results: { studentName: string; emailSent: boolean; whatsappSent: boolean; smsSent: boolean; whatsAppUrl?: string | null; error?: string }[] = [];

    const promises = Array.from(studentGroups).map(async ([, group]) => {
      const shouldSendEmail = channels.includes("email") && !!group.parentEmail;
      const shouldSendWhatsApp = channels.includes("whatsapp") && !!group.parentPhone;
      const shouldSendSms = channels.includes("sms") && !!group.parentPhone;

      const firstBook = group.books[0];
      const dueFormatted = firstBook.dueAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); // "10-Nov-2026"

      const dataForTemplate = {
        studentName: group.studentName,
        className: group.className,
        parentName: group.parentName,
        books: group.books.map((b) => ({
          title: b.title,
          barcode: b.barcode,
          borrowedAt: b.borrowedAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          dueAt: b.dueAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          dueDiffLabel: b.dueDiffLabel,
          daysOverdue: b.daysOverdue,
          isOverdue: true,
        })),
        totalDaysOverdue: group.maxDaysOverdue,
      };

      const waMessage = formatLibraryReminderWhatsAppMessage({
        borrowerName: group.studentName,
        className: group.className,
        bookTitle: firstBook.title,
        barcode: firstBook.barcode,
        dueDate: dueFormatted,
        dueDiffLabel: firstBook.dueDiffLabel,
        isOverdue: true,
        daysOverdue: group.maxDaysOverdue,
      });

      let emailSent = false;
      let whatsappSent = false;
      let smsSent = false;
      let lastError: string | undefined;
      let whatsAppUrl: string | null = null;

      if (group.parentPhone) {
        whatsAppUrl = generateWhatsAppLink(group.parentPhone, waMessage);
      }

      // Send Email
      if (shouldSendEmail) {
        const html = overdueReminderEmail(dataForTemplate);
        const success = await sendEmail({
          to: group.parentEmail!,
          subject: `📚 Maktabat Darse Burhani • Book Return Reminder - ${group.studentName}`,
          html,
          text: maktabatReturnReminderPlainText(dataForTemplate),
        });
        if (success) {
          emailSent = true;
          sentCount++;
        } else {
          lastError = "Email send failed";
          failedCount++;
        }
      }

      // Send WhatsApp
      if (shouldSendWhatsApp && group.parentPhone) {
        try {
          const waRes = await dispatchWhatsAppNotification({
            phone: group.parentPhone,
            message: waMessage,
          });
          if (waRes.success) {
            whatsappSent = true;
            sentCount++;
          } else {
            lastError = waRes.error || "WhatsApp send failed";
          }
        } catch (e: any) {
          lastError = e?.message || "WhatsApp dispatch error";
        }
      }

      // Send SMS
      if (shouldSendSms && !whatsappSent) {
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
          if (!shouldSendEmail && !whatsappSent) failedCount++;
        }
      }

      // Create in-app notification for the student
      if (emailSent || whatsappSent || smsSent) {
        try {
          await prisma.notification.create({
            data: {
              userId: group.studentUserId,
              title: "Overdue Book Reminder",
              body: `You have ${group.books.length} overdue book(s). Please return them to the Maktabat before due date.`,
              type: "LIBRARY_OVERDUE",
              link: "/admin/library",
            },
          });
        } catch {
          // Non-critical
        }
      }

      results.push({ studentName: group.studentName, emailSent, whatsappSent, smsSent, whatsAppUrl, error: lastError });
    });

    await Promise.all(promises);

    return res.json({
      success: true,
      message: `Reminders sent: ${sentCount} notifications dispatched, ${failedCount} failed`,
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
