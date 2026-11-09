import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { sendEmail, getSmtpConfigStatus, cleanEmail } from "../../lib/email";
import { TALABAT_FQDN_DOMAIN } from "../../lib/talabat-email";

const router = Router();

const SUPPORT_EMAIL = process.env.IT_SUPPORT_EMAIL || "support@darseburhani-galiakot.org";

/**
 * GET /api/admin/mailflare
 * Returns Mailflare configuration, status, summary counts, and all inbound messages/tickets.
 */
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const smtpStatus = getSmtpConfigStatus();

    // Fetch all support tickets and inbound emails
    const rawNotifications = await prisma.notification.findMany({
      where: {
        type: { in: ["SUPPORT_TICKET", "INBOUND_EMAIL"] },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const userIds = Array.from(new Set(rawNotifications.map((n) => n.userId).filter(Boolean)));

    // Batch query users
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      include: {
        studentProfile: true,
        teacherProfile: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let unreadCount = 0;

    const tickets = rawNotifications.map((notif) => {
      let meta: any = {};
      try {
        meta = JSON.parse(notif.body);
      } catch {
        meta = { message: notif.body, category: "General Inquiry", status: "OPEN", replies: [] };
      }

      const status = (meta.status || "OPEN").toUpperCase();
      if (status === "RESOLVED") resolvedCount++;
      else if (status === "IN_PROGRESS") inProgressCount++;
      else openCount++;

      if (!notif.isRead) unreadCount++;

      const u = userMap.get(notif.userId);
      const studentProf = u?.studentProfile;
      const photo =
        u?.avatarUrl ||
        u?.teacherProfile?.photoUrl ||
        null;

      const senderIts =
        studentProf?.its ||
        studentProf?.studentId ||
        u?.teacherProfile?.its ||
        meta.studentIts ||
        "N/A";

      const senderGrade =
        studentProf?.grade
          ? `Grade ${studentProf.grade}${studentProf.section || ""}`
          : u?.teacherProfile?.department || u?.role || "External";

      return {
        id: notif.id,
        ticketId: meta.ticketId || `IT-${notif.id.slice(-6)}`,
        title: notif.title,
        subject: meta.subject || notif.title.replace(/^\[.*?\]\s*/, ""),
        category: meta.category || "General Inquiry",
        priority: (meta.priority || notif.priority || "NORMAL").toUpperCase(),
        status,
        message: meta.message || "",
        replies: Array.isArray(meta.replies) ? meta.replies : [],
        isRead: notif.isRead,
        createdAt: notif.createdAt.toISOString(),
        sender: {
          id: u?.id || notif.userId,
          name: `${u?.firstName || "Unknown"} ${u?.lastName || ""}`.trim(),
          email: u?.email || meta.studentEmail || "support@darseburhani-galiakot.org",
          role: u?.role || "STUDENT",
          its: senderIts,
          grade: senderGrade,
          mobile: studentProf?.mobileNumber || u?.teacherProfile?.mobile || "N/A",
          photo,
        },
      };
    });

    return res.json({
      success: true,
      data: {
        config: {
          supportEmail: SUPPORT_EMAIL,
          institutionalDomain: TALABAT_FQDN_DOMAIN,
          activeTransporter: smtpStatus.activeMailbox,
          isSmtpConfigured: smtpStatus.configured,
          status: "ACTIVE_RECEIVING",
        },
        counts: {
          total: tickets.length,
          open: openCount,
          inProgress: inProgressCount,
          resolved: resolvedCount,
          unread: unreadCount,
        },
        tickets,
      },
    });
  } catch (error: any) {
    console.error("[admin/mailflare] fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to load Mailflare inbox" });
  }
});

/**
 * POST /api/admin/mailflare/reply
 * Admin replies to an existing ticket.
 * Appends to thread, pushes notification to sender, and dispatches real SMTP email.
 */
router.post("/reply", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { ticketId, replyText, notifyEmail = true } = req.body || {};

    if (!ticketId || !replyText?.trim()) {
      return res.status(400).json({ success: false, error: "Ticket ID and reply text are required." });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: ticketId },
    });

    if (!notification) {
      return res.status(404).json({ success: false, error: "Message thread not found" });
    }

    const recipientUser = notification.userId
      ? await prisma.user.findUnique({
          where: { id: notification.userId },
          select: { id: true, email: true, firstName: true, lastName: true },
        })
      : null;

    let meta: any = {};
    try {
      meta = JSON.parse(notification.body);
    } catch {
      meta = { message: notification.body, replies: [] };
    }

    const replies = Array.isArray(meta.replies) ? meta.replies : [];
    const replyItem = {
      sender: "ADMIN",
      senderName: `Idarah Darse Burhani IT Support (${session.user.firstName || "Admin"})`,
      text: replyText.trim(),
      timestamp: new Date().toISOString(),
    };
    replies.push(replyItem);

    meta.replies = replies;
    if (meta.status === "OPEN") {
      meta.status = "IN_PROGRESS";
    }

    await prisma.notification.update({
      where: { id: notification.id },
      data: {
        body: JSON.stringify(meta),
        isRead: true,
      },
    });

    // 1. Send push/in-app notification to the original sender
    if (notification.userId) {
      await prisma.notification.create({
        data: {
          userId: notification.userId,
          title: `Response to: ${notification.title}`,
          body: `IT Support responded: "${replyText.trim().slice(0, 120)}${replyText.trim().length > 120 ? "…" : ""}"`,
          type: "SUPPORT_REPLY",
          link: `/talabat/support?ticket=${meta.ticketId || ticketId}`,
          priority: "HIGH",
          isRead: false,
        },
      });
    }

    // 2. Dispatch real outbound email if requested and recipient email exists
    let emailDispatched = false;
    const recipientEmail = meta.studentEmail || recipientUser?.email;
    if (notifyEmail && recipientEmail && cleanEmail(recipientEmail)) {
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
            <div style="background: #064e3b; padding: 20px 24px; color: #ffffff;">
              <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">Darse Burhani Galiakot — IT Support</h2>
              <p style="margin: 4px 0 0; font-size: 13px; color: #d1fae5;">Official Response to Ticket #${meta.ticketId || "SUPPORT"}</p>
            </div>
            <div style="padding: 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
              <p style="margin-top: 0;">Afzalus Salam <strong>${recipientUser?.firstName || "Student"}</strong>,</p>
              <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 14px 16px; margin: 16px 0; border-radius: 6px;">
                <p style="margin: 0; white-space: pre-wrap; font-size: 14px; color: #064e3b;">${replyText.trim()}</p>
              </div>
              <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
                Original Inquiry: <em>"${(meta.subject || notification.title).trim()}"</em>
              </p>
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #94a3b8; text-align: center;">
                Sent officially from <strong>${SUPPORT_EMAIL}</strong> &middot; Idarah Darse Burhani, Galiakot
              </div>
            </div>
          </div>
        `;

        emailDispatched = await sendEmail({
          to: recipientEmail,
          subject: `Re: [Ticket #${meta.ticketId || "SUPPORT"}] ${meta.subject || notification.title}`,
          html: emailHtml,
          text: `Official reply from IT Support regarding your inquiry:\n\n${replyText.trim()}\n\n--\nIdarah Darse Burhani Support (${SUPPORT_EMAIL})`,
          from: `Darse Burhani Support <${SUPPORT_EMAIL}>`,
        });
      } catch (err: any) {
        console.warn("[admin/mailflare] email dispatch warning:", err?.message || err);
      }
    }

    return res.json({
      success: true,
      data: {
        replies,
        status: meta.status,
        emailDispatched,
      },
    });
  } catch (error: any) {
    console.error("[admin/mailflare] reply error:", error);
    return res.status(500).json({ success: false, error: "Failed to post reply" });
  }
});

/**
 * PATCH /api/admin/mailflare/status
 * Updates ticket resolution status (OPEN, IN_PROGRESS, RESOLVED).
 */
router.patch("/status", requireRole("ADMIN"), async (req, res) => {
  try {
    const { ticketId, status } = req.body || {};
    if (!ticketId || !["OPEN", "IN_PROGRESS", "RESOLVED"].includes(status)) {
      return res.status(400).json({ success: false, error: "Valid ticketId and status required." });
    }

    const notification = await prisma.notification.findUnique({
      where: { id: ticketId },
    });
    if (!notification) {
      return res.status(404).json({ success: false, error: "Ticket not found." });
    }

    let meta: any = {};
    try {
      meta = JSON.parse(notification.body);
    } catch {
      meta = { message: notification.body };
    }

    meta.status = status;

    await prisma.notification.update({
      where: { id: ticketId },
      data: { body: JSON.stringify(meta) },
    });

    return res.json({ success: true, data: { status } });
  } catch (error: any) {
    console.error("[admin/mailflare] status error:", error);
    return res.status(500).json({ success: false, error: "Failed to update ticket status" });
  }
});

/**
 * POST /api/admin/mailflare/compose
 * Direct email composition from support@darseburhani-galiakot.org to any recipient.
 */
router.post("/compose", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { to, subject, message, priority = "NORMAL" } = req.body || {};

    if (!to?.trim() || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, error: "Recipient email, subject, and message are required." });
    }

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: #064e3b; padding: 20px 24px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">Darse Burhani Galiakot</h2>
          <p style="margin: 4px 0 0; font-size: 13px; color: #d1fae5;">Official Institutional Communication &middot; Maktab Taalim</p>
        </div>
        <div style="padding: 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
          <h3 style="margin-top: 0; color: #064e3b;">${subject.trim()}</h3>
          <div style="white-space: pre-wrap; font-size: 14px; color: #1e293b; margin: 16px 0;">${message.trim()}</div>
          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
            Official message from <strong>${SUPPORT_EMAIL}</strong> &middot; Idarah Darse Burhani, Galiakot
          </div>
        </div>
      </div>
    `;

    const dispatched = await sendEmail({
      to: to.trim(),
      subject: subject.trim(),
      html: emailHtml,
      text: `${message.trim()}\n\n--\nIdarah Darse Burhani (${SUPPORT_EMAIL})`,
      from: `Darse Burhani Support <${SUPPORT_EMAIL}>`,
    });

    // Log outbound message into notifications table for history tracking
    await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: `[Outbound to ${to.trim()}] ${subject.trim()}`,
        body: JSON.stringify({
          ticketId: `OUT-${Date.now().toString().slice(-6)}`,
          category: "Direct Outbound",
          subject: subject.trim(),
          message: message.trim(),
          priority,
          status: "RESOLVED",
          studentEmail: to.trim(),
          studentName: to.trim().split("@")[0],
          replies: [],
          outbound: true,
        }),
        type: "INBOUND_EMAIL",
        link: "/admin/mailflare",
        priority,
        isRead: true,
      },
    });

    return res.json({
      success: true,
      data: {
        dispatched,
        message: dispatched
          ? `Official email dispatched successfully to ${to.trim()}.`
          : `Email queued for dispatch to ${to.trim()}.`,
      },
    });
  } catch (error: any) {
    console.error("[admin/mailflare] compose error:", error);
    return res.status(500).json({ success: false, error: "Failed to dispatch email" });
  }
});

export default router;
