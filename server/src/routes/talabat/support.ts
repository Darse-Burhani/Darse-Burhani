import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { sendEmail, isDeliverableEmail } from "../../lib/email";
import {
  extractStudentNameParts,
  validateTalabatOutboundEmail,
  TALABAT_MAIL_DOMAIN,
} from "../../lib/talabat-email";

const router = Router();

const IT_SUPPORT_EMAIL =
  process.env.IT_SUPPORT_EMAIL ||
  process.env.LEAVE_ADMIN_EMAIL ||
  process.env.SMTP_USER ||
  "support@darseburhani-galiakot.org";

/**
 * Derives student Mailflare institutional email identity.
 * Rule: strictly firstName.lastName@darseburhani.galiakot (NO middle name).
 */
function getStudentEmailIdentity(
  user: { email?: string | null; firstName?: string | null; lastName?: string | null } | null,
  studentProfile: { its?: string | null; studentId?: string | null } | null
) {
  const { firstName, lastName, username, institutionalEmail, webmailAlias } = extractStudentNameParts(
    user?.firstName,
    user?.lastName,
    user?.email
  );

  const its = studentProfile?.its || studentProfile?.studentId || "student";
  const itsAlias = studentProfile?.its ? `its-${studentProfile.its}@darseburhani-galiakot.org` : null;

  return {
    firstName,
    lastName,
    username,
    institutionalEmail,
    webmailAlias,
    itsAlias,
    its,
  };
}

/**
 * GET /api/talabat/support
 * Returns student institutional email identity, support ticket threads, and notifications feed.
 */
router.get("/", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const [studentProfile, currentUser] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: {
          id: true,
          its: true,
          studentId: true,
          grade: true,
          section: true,
          mobileNumber: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true, email: true, avatarUrl: true },
      }),
    ]);

    const { firstName, lastName, username, institutionalEmail, webmailAlias, itsAlias, its } = getStudentEmailIdentity(
      currentUser,
      studentProfile
    );
    const studentName = `${currentUser?.firstName || session.user.firstName || "Talib"} ${
      currentUser?.lastName || session.user.lastName || ""
    }`.trim();

    // 1. Fetch support tickets/messages
    const supportRecords = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        type: { in: ["SUPPORT_TICKET", "INBOUND_EMAIL"] },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const ticketMap = new Map<string, any>();
    let activeCount = 0;
    let resolvedCount = 0;

    for (const r of supportRecords) {
      let parsedMeta: any = {};
      try {
        parsedMeta = JSON.parse(r.body);
      } catch {
        parsedMeta = { message: r.body, category: "General Inquiry", status: "OPEN", replies: [] };
      }

      const canonicalTicketId = parsedMeta.ticketId || `IT-${r.id.slice(-6).toUpperCase()}`;

      if (ticketMap.has(canonicalTicketId)) {
        const existing = ticketMap.get(canonicalTicketId);
        if (Array.isArray(parsedMeta.replies) && parsedMeta.replies.length > existing.replies.length) {
          existing.replies = parsedMeta.replies;
        }
        if (parsedMeta.status) {
          existing.status = (parsedMeta.status || "OPEN").toUpperCase();
        }
        continue;
      }

      const status = (parsedMeta.status || "OPEN").toUpperCase();
      if (status === "RESOLVED") resolvedCount++;
      else activeCount++;

      ticketMap.set(canonicalTicketId, {
        id: r.id,
        ticketId: canonicalTicketId,
        title: r.title,
        category: parsedMeta.category || "General Inquiry",
        priority: (parsedMeta.priority || r.priority || "NORMAL").toUpperCase(),
        status,
        message: parsedMeta.message || r.body || "",
        replies: Array.isArray(parsedMeta.replies) ? parsedMeta.replies : [],
        sender: parsedMeta.sender || (parsedMeta.outbound ? "ADMIN" : "STUDENT"),
        adminName: parsedMeta.adminName || "Idarah IT Administration",
        createdAt: r.createdAt.toISOString(),
        isRead: r.isRead,
      });
    }

    const tickets = Array.from(ticketMap.values());

    // 2. Fetch all system notifications
    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        type: { notIn: ["SUPPORT_TICKET", "INBOUND_EMAIL"] },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    });

    return res.json({
      success: true,
      data: {
        identity: {
          name: studentName,
          firstName,
          lastName,
          username,
          its,
          institutionalEmail, // strictly firstname.lastname@darseburhani.galiakot (NO middle name)
          webmailAlias,
          itsAlias,
          registeredEmail: currentUser?.email || session.user.email,
          grade: studentProfile?.grade || "N/A",
          section: studentProfile?.section || "",
          mobile: studentProfile?.mobileNumber || "N/A",
          mailflareStatus: "ACTIVE",
          isWalledGarden: true,
          networkNotice: "Talabat mailboxes are restricted to the internal institutional Mailflare network (@darseburhani.galiakot). External public services like Gmail and Yahoo are prohibited.",
        },
        itSupportEmail: IT_SUPPORT_EMAIL,
        tickets,
        notifications,
        unreadCount,
      },
    });
  } catch (error: any) {
    console.error("[talabat/support] fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to load support center" });
  }
});

/**
 * POST /api/talabat/support/send
 * Student composes and sends an IT Support inquiry/ticket.
 * Stores record in DB + dispatches real email via SMTP to IT Support.
 */
router.post("/send", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const { subject, category, message, priority } = req.body || {};

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        error: "Subject and message body are required.",
      });
    }

    const targetRecipient = (req.body.recipientEmail || IT_SUPPORT_EMAIL).trim();
    const recipientCheck = validateTalabatOutboundEmail(targetRecipient);
    if (!recipientCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: recipientCheck.reason,
      });
    }

    const [studentProfile, currentUser] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        select: { its: true, grade: true, section: true, mobileNumber: true },
      }),
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { firstName: true, lastName: true, email: true },
      }),
    ]);

    const { username, institutionalEmail, webmailAlias, itsAlias, its } = getStudentEmailIdentity(
      currentUser,
      studentProfile
    );
    const studentName = `${currentUser?.firstName || session.user.firstName || "Talib"} ${
      currentUser?.lastName || session.user.lastName || ""
    }`.trim();
    const chosenCategory = category?.trim() || "Portal Support";
    const chosenPriority = ["NORMAL", "HIGH", "URGENT"].includes(priority) ? priority : "NORMAL";
    const ticketCode = `IT-${Date.now().toString().slice(-6)}`;

    const ticketPayload = {
      ticketId: ticketCode,
      category: chosenCategory,
      subject: subject.trim(),
      message: message.trim(),
      priority: chosenPriority,
      status: "OPEN",
      studentEmail: institutionalEmail,
      studentName,
      studentIts: its,
      grade: `Grade ${studentProfile?.grade || ""}${studentProfile?.section || ""}`,
      replies: [],
    };

    // 1. Create support ticket notification record for student
    const createdNotification = await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: `[${ticketCode}] ${subject.trim()}`,
        body: JSON.stringify(ticketPayload),
        type: "SUPPORT_TICKET",
        link: `/talabat/support?ticket=${ticketCode}`,
        priority: chosenPriority,
        isRead: true,
      },
    });

    // Also notify active Administrators so the inquiry is visible on the institutional dashboard
    try {
      const adminUsers = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      if (adminUsers.length > 0) {
        await prisma.notification.createMany({
          data: adminUsers.map((a) => ({
            userId: a.id,
            title: `Support Ticket [${ticketCode}]: ${subject.trim()}`,
            body: JSON.stringify(ticketPayload),
            type: "SUPPORT_TICKET",
            link: `/admin`,
            priority: chosenPriority,
            isRead: false,
          })),
        });
      }
    } catch (adminNotifErr) {
      console.warn("[talabat/support] Admin in-app notification error:", adminNotifErr);
    }

    // 2. Dispatch real outbound email to IT Support Helpdesk
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: #064e3b; padding: 20px 24px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">Darse Burhani Galiakot — IT Support Desk</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #d1fae5;">Student Support Inquiry & Helpdesk Dispatch</p>
        </div>
        <div style="padding: 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
          <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold; color: #0f172a; font-size: 15px;">Ticket #${ticketCode}: ${subject.trim()}</p>
            <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Category: <strong>${chosenCategory}</strong> | Priority: <strong>${chosenPriority}</strong></p>
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;">Student Name:</td>
              <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${studentName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">ITS Number:</td>
              <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">${its}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Class / Darjah:</td>
              <td style="padding: 6px 0; font-weight: bold; color: #0f172a;">Grade ${studentProfile?.grade || ""}${studentProfile?.section || ""}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Student Email:</td>
              <td style="padding: 6px 0; font-weight: bold; color: #047857;">${institutionalEmail}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Registered Account:</td>
              <td style="padding: 6px 0; color: #0f172a;">${currentUser?.email || session.user.email}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Contact Mobile:</td>
              <td style="padding: 6px 0; color: #0f172a;">${studentProfile?.mobileNumber || "N/A"}</td>
            </tr>
          </table>

          <div style="background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px; margin-top: 16px;">
            <p style="margin: 0 0 8px; font-size: 12px; font-weight: bold; text-transform: uppercase; color: #475569;">Student Message:</p>
            <p style="margin: 0; white-space: pre-wrap; font-size: 14px; color: #0f172a;">${message.trim()}</p>
          </div>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
            This email was automatically generated by the Darse Burhani Student Portal IT Support Desk.<br>
            Direct reply will reach the student at: <a href="mailto:${institutionalEmail}" style="color: #047857;">${institutionalEmail}</a>
          </div>
        </div>
      </div>
    `;

    // Try sending email asynchronously so it doesn't block UI response
    let emailDispatched = false;
    try {
      emailDispatched = await sendEmail({
        to: IT_SUPPORT_EMAIL,
        subject: `[IT Support Ticket ${ticketCode}] ${subject.trim()} - ${studentName} (ITS: ${its})`,
        html: emailHtml,
        text: `Student: ${studentName} (ITS: ${its})\nEmail: ${institutionalEmail}\nCategory: ${chosenCategory}\nPriority: ${chosenPriority}\n\nMessage:\n${message.trim()}`,
        from: `Darse Burhani IT Desk <${IT_SUPPORT_EMAIL}>`,
      });
    } catch (err: any) {
      console.warn(`[talabat/support] Email dispatch error:`, err?.message || err);
    }

    // 3. Create immediate auto-acknowledgement in student feed
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: `Inquiry Received: #${ticketCode}`,
        body: `Your IT Support request regarding "${subject.trim()}" has been recorded. IT administration will review and respond to ${institutionalEmail}.`,
        type: "ANNOUNCEMENT",
        link: `/talabat/support?ticket=${ticketCode}`,
        priority: "NORMAL",
        isRead: false,
      },
    });

    return res.json({
      success: true,
      data: {
        ticketCode,
        id: createdNotification.id,
        emailDispatched,
        institutionalEmail,
        message: "Your support inquiry has been sent to IT Support successfully.",
      },
    });
  } catch (error: any) {
    console.error("[talabat/support] send error:", error);
    return res.status(500).json({ success: false, error: "Failed to send support inquiry" });
  }
});

/**
 * POST /api/talabat/support/reply
 * Student appends a reply/followup to an existing support ticket thread.
 * Synchronizes across BOTH Student and Admin inbox records in real time!
 */
router.post("/reply", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const { ticketId, replyText } = req.body || {};

    if (!ticketId || !replyText?.trim()) {
      return res.status(400).json({ success: false, error: "Ticket ID and reply text are required." });
    }

    // Locate the student's notification
    const primaryNotification = await prisma.notification.findFirst({
      where: {
        userId: session.user.id,
        OR: [
          { id: ticketId },
          { body: { contains: ticketId } },
          { title: { contains: ticketId } },
        ],
      },
    });

    if (!primaryNotification) {
      return res.status(404).json({ success: false, error: "Support ticket not found" });
    }

    let parsedMeta: any = {};
    try {
      parsedMeta = JSON.parse(primaryNotification.body);
    } catch {
      parsedMeta = { message: primaryNotification.body, replies: [] };
    }

    const canonicalTicketId = parsedMeta.ticketId || ticketId;
    const replies = Array.isArray(parsedMeta.replies) ? parsedMeta.replies : [];
    const studentSenderName = `${session.user.firstName || "Talib"} ${session.user.lastName || ""}`.trim();

    const studentReply = {
      sender: "STUDENT",
      senderName: studentSenderName,
      text: replyText.trim(),
      timestamp: new Date().toISOString(),
    };
    replies.push(studentReply);

    // Synchronize to ALL notifications associated with this ticket (student + admin copies)
    const linkedNotifications = await prisma.notification.findMany({
      where: {
        OR: [
          { id: primaryNotification.id },
          { body: { contains: canonicalTicketId } },
          { title: { contains: canonicalTicketId } },
        ],
      },
    });

    for (const notif of linkedNotifications) {
      let m: any = {};
      try {
        m = JSON.parse(notif.body);
      } catch {
        m = { message: notif.body };
      }
      m.replies = replies;
      m.status = "IN_PROGRESS";

      await prisma.notification.update({
        where: { id: notif.id },
        data: {
          body: JSON.stringify(m),
          // If this is an admin record, mark isRead=false so admin sees alert
          isRead: notif.userId === session.user.id,
        },
      });
    }

    // Notify administrators of student followup
    try {
      const adminUsers = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      if (adminUsers.length > 0) {
        await prisma.notification.createMany({
          data: adminUsers.map((a) => ({
            userId: a.id,
            title: `Student Reply [${canonicalTicketId}]: ${parsedMeta.subject || primaryNotification.title}`,
            body: `${studentSenderName}: "${replyText.trim().slice(0, 120)}${replyText.trim().length > 120 ? "…" : ""}"`,
            type: "SUPPORT_REPLY",
            link: `/admin/mailflare`,
            priority: "HIGH",
            isRead: false,
          })),
        });
      }
    } catch (adminErr) {
      console.warn("[talabat/support] Admin alert warning:", adminErr);
    }

    return res.json({ success: true, data: { replies, status: "IN_PROGRESS", canonicalTicketId } });
  } catch (error: any) {
    console.error("[talabat/support] reply error:", error);
    return res.status(500).json({ success: false, error: "Failed to post reply" });
  }
});

/**
 * PATCH /api/talabat/support/status
 * Student can mark ticket as RESOLVED or reopen it to OPEN.
 */
router.patch("/status", requireRole("STUDENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const { ticketId, status } = req.body || {};

    if (!ticketId || !["OPEN", "RESOLVED"].includes(status)) {
      return res.status(400).json({ success: false, error: "Valid ticketId and status required." });
    }

    const primaryNotification = await prisma.notification.findFirst({
      where: {
        userId: session.user.id,
        OR: [
          { id: ticketId },
          { body: { contains: ticketId } },
          { title: { contains: ticketId } },
        ],
      },
    });

    if (!primaryNotification) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    let meta: any = {};
    try {
      meta = JSON.parse(primaryNotification.body);
    } catch {
      meta = { message: primaryNotification.body };
    }

    const canonicalTicketId = meta.ticketId || ticketId;

    const linkedNotifications = await prisma.notification.findMany({
      where: {
        OR: [
          { id: primaryNotification.id },
          { body: { contains: canonicalTicketId } },
          { title: { contains: canonicalTicketId } },
        ],
      },
    });

    for (const notif of linkedNotifications) {
      let m: any = {};
      try {
        m = JSON.parse(notif.body);
      } catch {
        m = { message: notif.body };
      }
      m.status = status;

      await prisma.notification.update({
        where: { id: notif.id },
        data: { body: JSON.stringify(m) },
      });
    }

    return res.json({ success: true, data: { status, canonicalTicketId } });
  } catch (error: any) {
    console.error("[talabat/support] status error:", error);
    return res.status(500).json({ success: false, error: "Failed to update ticket status" });
  }
});

export default router;

