import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { sendEmail, getSmtpConfigStatus, cleanEmail } from "../../lib/email";
import { TALABAT_FQDN_DOMAIN, extractStudentNameParts } from "../../lib/talabat-email";

const router = Router();

const SUPPORT_EMAIL = process.env.IT_SUPPORT_EMAIL || "support@darseburhani-galiakot.org";
const PORTAL_BASE_URL = (process.env.APP_URL || process.env.NEXTAUTH_URL || "https://darseburhani-galiakot.org").replace(/\/+$/, "");

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
      take: 150,
    });

    // Collect all relevant user IDs: notif.userId and any studentId embedded in metadata
    const userIds = new Set<string>();
    for (const notif of rawNotifications) {
      if (notif.userId) userIds.add(notif.userId);
      try {
        const m = JSON.parse(notif.body);
        if (m.studentId) userIds.add(m.studentId);
      } catch {}
    }

    // Batch query users
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      include: {
        studentProfile: true,
        teacherProfile: true,
      },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    // Deduplicate by canonicalTicketId so we don't display duplicate cards for student+admin copies
    const ticketMap = new Map<string, any>();

    for (const notif of rawNotifications) {
      let meta: any = {};
      try {
        meta = JSON.parse(notif.body);
      } catch {
        meta = { message: notif.body, category: "General Inquiry", status: "OPEN", replies: [] };
      }

      const canonicalTicketId = meta.ticketId || `IT-${notif.id.slice(-6).toUpperCase()}`;

      // If we already added this canonicalTicketId, merge any newer replies or status
      if (ticketMap.has(canonicalTicketId)) {
        const existing = ticketMap.get(canonicalTicketId);
        if (Array.isArray(meta.replies) && meta.replies.length > existing.replies.length) {
          existing.replies = meta.replies;
        }
        if (meta.status) {
          existing.status = (meta.status || "OPEN").toUpperCase();
        }
        continue;
      }

      const status = (meta.status || "OPEN").toUpperCase();

      // Identify student or sender
      let senderUser = userMap.get(notif.userId);
      if (meta.studentId && meta.studentId !== notif.userId) {
        const studentUser = userMap.get(meta.studentId);
        if (studentUser) senderUser = studentUser;
      }

      if (!senderUser || senderUser.role === "ADMIN") {
        if (meta.studentId) {
          const u = userMap.get(meta.studentId);
          if (u) senderUser = u;
        } else if (meta.studentIts) {
          const u = Array.from(userMap.values()).find(
            (usr) => usr.studentProfile?.its === meta.studentIts || usr.studentProfile?.studentId === meta.studentIts
          );
          if (u) senderUser = u;
        }
      }

      const studentProf = senderUser?.studentProfile;
      const photo =
        senderUser?.avatarUrl ||
        senderUser?.teacherProfile?.photoUrl ||
        null;

      const senderIts =
        studentProf?.its ||
        studentProf?.studentId ||
        meta.studentIts ||
        senderUser?.teacherProfile?.its ||
        "N/A";

      const senderGrade =
        studentProf?.grade
          ? `Grade ${studentProf.grade}${studentProf.section || ""}`
          : meta.grade || senderUser?.teacherProfile?.department || senderUser?.role || "Talabat";

      const ticketItem = {
        id: notif.id,
        ticketId: canonicalTicketId,
        title: notif.title,
        subject: meta.subject || notif.title.replace(/^\[.*?\]\s*/, ""),
        category: meta.category || "General Inquiry",
        priority: (meta.priority || notif.priority || "NORMAL").toUpperCase(),
        status,
        message: meta.message || notif.body || "",
        replies: Array.isArray(meta.replies) ? meta.replies : [],
        isRead: notif.isRead,
        createdAt: notif.createdAt.toISOString(),
        outbound: Boolean(meta.outbound),
        sender: {
          id: senderUser?.id || notif.userId,
          name: meta.studentName || `${senderUser?.firstName || "Unknown"} ${senderUser?.lastName || ""}`.trim(),
          email: meta.studentEmail || senderUser?.email || "support@darseburhani-galiakot.org",
          role: senderUser?.role || "STUDENT",
          its: senderIts,
          grade: senderGrade,
          mobile: studentProf?.mobileNumber || senderUser?.teacherProfile?.mobile || "N/A",
          photo,
        },
      };

      ticketMap.set(canonicalTicketId, ticketItem);
    }

    const tickets = Array.from(ticketMap.values());
    tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let unreadCount = 0;

    for (const t of tickets) {
      if (t.status === "RESOLVED") resolvedCount++;
      else if (t.status === "IN_PROGRESS") inProgressCount++;
      else openCount++;

      if (!t.isRead) unreadCount++;
    }

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
 * GET /api/admin/mailflare/students
 * Returns active students list for quick search and 1-click recipient selection.
 */
router.get("/students", requireRole("ADMIN"), async (req, res) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: "STUDENT", isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        studentProfile: {
          select: {
            its: true,
            studentId: true,
            grade: true,
            section: true,
            mobileNumber: true,
          },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 250,
    });

    const formatted = students.map((s) => {
      const its = s.studentProfile?.its || s.studentProfile?.studentId || "N/A";
      const { institutionalEmail } = extractStudentNameParts(s.firstName, s.lastName, s.email);
      return {
        id: s.id,
        name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
        its,
        grade: s.studentProfile?.grade ? `Grade ${s.studentProfile.grade}${s.studentProfile.section || ""}` : "Talabat",
        email: s.email,
        institutionalEmail,
        avatarUrl: s.avatarUrl,
        mobile: s.studentProfile?.mobileNumber || "",
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (error: any) {
    console.error("[admin/mailflare] students fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to load students" });
  }
});

/**
 * POST /api/admin/mailflare/reply
 * Admin replies to an existing ticket.
 * Appends to thread across ALL student and admin records, notifies student, and sends SMTP email.
 */
router.post("/reply", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { ticketId, replyText, notifyEmail = true } = req.body || {};

    if (!ticketId || !replyText?.trim()) {
      return res.status(400).json({ success: false, error: "Ticket ID and reply text are required." });
    }

    // 1. Locate primary notification by ID or canonical ticketId
    const primaryNotification = await prisma.notification.findFirst({
      where: {
        OR: [
          { id: ticketId },
          { body: { contains: ticketId } },
          { title: { contains: ticketId } },
        ],
      },
    });

    if (!primaryNotification) {
      return res.status(404).json({ success: false, error: "Message thread not found" });
    }

    let primaryMeta: any = {};
    try {
      primaryMeta = JSON.parse(primaryNotification.body);
    } catch {
      primaryMeta = { message: primaryNotification.body, replies: [] };
    }

    const canonicalTicketId = primaryMeta.ticketId || ticketId;
    const replies = Array.isArray(primaryMeta.replies) ? primaryMeta.replies : [];
    const replyItem = {
      sender: "ADMIN",
      senderName: `Idarah Darse Burhani IT Support (${session.user.firstName || "Admin"})`,
      text: replyText.trim(),
      timestamp: new Date().toISOString(),
    };
    replies.push(replyItem);

    // 2. Find ALL notifications associated with this canonical ticket
    const linkedNotifications = await prisma.notification.findMany({
      where: {
        OR: [
          { id: primaryNotification.id },
          { body: { contains: canonicalTicketId } },
          { title: { contains: canonicalTicketId } },
        ],
      },
    });

    // 3. Update each linked record with new reply and status
    for (const notif of linkedNotifications) {
      let m: any = {};
      try {
        m = JSON.parse(notif.body);
      } catch {
        m = { message: notif.body };
      }
      m.replies = replies;
      if (m.status === "OPEN") {
        m.status = "IN_PROGRESS";
      }

      await prisma.notification.update({
        where: { id: notif.id },
        data: {
          body: JSON.stringify(m),
          // If this record belongs to student, mark unread so they see new reply
          isRead: notif.userId === session.user.id,
        },
      });
    }

    // 4. Send in-app push notification to the student user
    const studentLinkedNotif = linkedNotifications.find((n) => n.userId !== session.user.id);
    let studentUserId = primaryMeta.studentId || studentLinkedNotif?.userId;

    if (!studentUserId && primaryMeta.studentEmail) {
      const u = await prisma.user.findFirst({
        where: {
          OR: [
            { email: { equals: primaryMeta.studentEmail, mode: "insensitive" } },
            { studentProfile: { its: primaryMeta.studentIts || "" } },
          ],
        },
        select: { id: true },
      });
      if (u) studentUserId = u.id;
    }

    if (studentUserId && studentUserId !== session.user.id) {
      await prisma.notification.create({
        data: {
          userId: studentUserId,
          title: `Response to: ${primaryMeta.subject || primaryNotification.title}`,
          body: `IT Support responded: "${replyText.trim().slice(0, 140)}${replyText.trim().length > 140 ? "…" : ""}"`,
          type: "SUPPORT_REPLY",
          link: `/talabat/support?ticket=${canonicalTicketId}`,
          priority: "HIGH",
          isRead: false,
        },
      });
    }

    // 5. Dispatch real outbound email if requested and recipient email exists
    let emailDispatched = false;
    const recipientEmail = primaryMeta.studentEmail;
    if (notifyEmail && recipientEmail && cleanEmail(recipientEmail)) {
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
            <div style="background: #064e3b; padding: 20px 24px; color: #ffffff;">
              <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">Darse Burhani Galiakot — IT Support</h2>
              <p style="margin: 4px 0 0; font-size: 13px; color: #d1fae5;">Official Response to Ticket #${canonicalTicketId}</p>
            </div>
            <div style="padding: 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
              <p style="margin-top: 0;">Afzalus Salam <strong>${primaryMeta.studentName || "Student"}</strong>,</p>
              <div style="background: #f0fdf4; border-left: 4px solid #059669; padding: 14px 16px; margin: 16px 0; border-radius: 6px;">
                <p style="margin: 0; white-space: pre-wrap; font-size: 14px; color: #064e3b;">${replyText.trim()}</p>
              </div>
              <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
                Inquiry: <em>"${(primaryMeta.subject || primaryNotification.title).trim()}"</em>
              </p>
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11.5px; color: #94a3b8; text-align: center;">
                Sent officially from <strong>${SUPPORT_EMAIL}</strong> &middot; Idarah Darse Burhani, Galiakot
              </div>
            </div>
          </div>
        `;

        emailDispatched = await sendEmail({
          to: recipientEmail,
          subject: `Re: [Ticket #${canonicalTicketId}] ${primaryMeta.subject || primaryNotification.title}`,
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
        status: primaryMeta.status === "OPEN" ? "IN_PROGRESS" : primaryMeta.status,
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
 * Updates ticket resolution status (OPEN, IN_PROGRESS, RESOLVED) across all linked records.
 */
router.patch("/status", requireRole("ADMIN"), async (req, res) => {
  try {
    const { ticketId, status } = req.body || {};
    if (!ticketId || !["OPEN", "IN_PROGRESS", "RESOLVED"].includes(status)) {
      return res.status(400).json({ success: false, error: "Valid ticketId and status required." });
    }

    const primaryNotification = await prisma.notification.findFirst({
      where: {
        OR: [
          { id: ticketId },
          { body: { contains: ticketId } },
          { title: { contains: ticketId } },
        ],
      },
    });

    if (!primaryNotification) {
      return res.status(404).json({ success: false, error: "Ticket not found." });
    }

    let meta: any = {};
    try {
      meta = JSON.parse(primaryNotification.body);
    } catch {
      meta = { message: primaryNotification.body };
    }

    const canonicalTicketId = meta.ticketId || ticketId;

    // Update all notifications linked to this canonical ticket
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
        data: {
          body: JSON.stringify(m),
          ...(status === "RESOLVED" ? { isRead: true } : {}),
        },
      });
    }

    return res.json({ success: true, data: { status, canonicalTicketId } });
  } catch (error: any) {
    console.error("[admin/mailflare] status error:", error);
    return res.status(500).json({ success: false, error: "Failed to update ticket status" });
  }
});

/**
 * POST /api/admin/mailflare/compose
 * Direct communication dispatch from Administration to Student or email recipient.
 * Creates synchronized records for BOTH Student and Admin so it shows immediately in Talabat Portal!
 */
router.post("/compose", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { to, recipientUserId, subject, message, priority = "NORMAL", category = "Direct Administration" } = req.body || {};

    if ((!to?.trim() && !recipientUserId) || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, error: "Recipient, subject, and message are required." });
    }

    const cleanTo = (to || "").trim();
    const ticketCode = `INQ-${Date.now().toString().slice(-6)}`;

    // 1. Resolve student recipient user
    let studentUser = recipientUserId
      ? await prisma.user.findUnique({
          where: { id: recipientUserId },
          include: { studentProfile: true },
        })
      : null;

    if (!studentUser && cleanTo) {
      const itsMatch = cleanTo.match(/\b\d{7,8}\b/)?.[0];
      const nameParts = cleanTo.split("@")[0].split(/[._\s-]+/).filter((p) => p.length > 2);

      studentUser = await prisma.user.findFirst({
        where: {
          role: "STUDENT",
          OR: [
            { email: { equals: cleanTo, mode: "insensitive" } },
            { email: { startsWith: cleanTo.split("@")[0], mode: "insensitive" } },
            { username: { equals: cleanTo, mode: "insensitive" } },
            ...(itsMatch ? [{ username: { equals: itsMatch, mode: "insensitive" } }] : []),
            ...(itsMatch ? [{ studentProfile: { its: itsMatch } }, { studentProfile: { studentId: itsMatch } }] : []),
            { studentProfile: { its: cleanTo } },
            { studentProfile: { studentId: cleanTo } },
            ...(nameParts.length >= 2
              ? [
                  {
                    AND: [
                      { firstName: { contains: nameParts[0], mode: "insensitive" } },
                      { lastName: { contains: nameParts[nameParts.length - 1], mode: "insensitive" } },
                    ],
                  },
                ]
              : []),
          ],
        },
        include: { studentProfile: true },
      });
    }

    const studentProfile = studentUser?.studentProfile;
    const studentName = studentUser
      ? `${studentUser.firstName || "Talib"} ${studentUser.lastName || ""}`.trim()
      : cleanTo.split("@")[0];

    const studentIts = studentProfile?.its || studentProfile?.studentId || "N/A";
    const studentGrade = studentProfile?.grade
      ? `Grade ${studentProfile.grade}${studentProfile.section || ""}`
      : "Talabat";

    const { institutionalEmail } = studentUser
      ? extractStudentNameParts(studentUser.firstName, studentUser.lastName, studentUser.email)
      : { institutionalEmail: cleanTo };

    const targetEmail = studentUser?.email || cleanTo;

    // 2. If recipient is a registered Student, create record for Student portal!
    if (studentUser) {
      const studentTicketPayload = {
        ticketId: ticketCode,
        category,
        subject: subject.trim(),
        message: message.trim(),
        priority,
        status: "OPEN",
        sender: "ADMIN",
        adminName: `Idarah IT Administration (${session.user.firstName || "Admin"})`,
        studentEmail: institutionalEmail,
        studentName,
        studentIts,
        grade: studentGrade,
        replies: [],
        outbound: false,
      };

      // Create primary support ticket
      await prisma.notification.create({
        data: {
          userId: studentUser.id,
          title: `[IT Administration] ${subject.trim()}`,
          body: JSON.stringify(studentTicketPayload),
          type: "SUPPORT_TICKET",
          link: `/talabat/support?ticket=${ticketCode}`,
          priority,
          isRead: false,
        },
      });

      // Also create an immediate announcement notification so student bell rings with unread dot!
      await prisma.notification.create({
        data: {
          userId: studentUser.id,
          title: `Administrative Notice: ${subject.trim()}`,
          body: `Idarah IT Administration dispatched an official communication: "${message.trim().slice(0, 110)}${message.trim().length > 110 ? "…" : ""}"`,
          type: "ANNOUNCEMENT",
          link: `/talabat/support?ticket=${ticketCode}`,
          priority: "HIGH",
          isRead: false,
        },
      });
    }

    // 3. Create Admin institutional inbox record
    const adminTicketPayload = {
      ticketId: ticketCode,
      category,
      subject: subject.trim(),
      message: message.trim(),
      priority,
      status: "OPEN",
      sender: "ADMIN",
      adminName: `Idarah IT Administration (${session.user.firstName || "Admin"})`,
      studentEmail: targetEmail,
      studentName,
      studentIts,
      studentId: studentUser?.id || null,
      grade: studentGrade,
      replies: [],
      outbound: true,
    };

    const createdAdminNotif = await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: `[Outbound to ${studentName}] ${subject.trim()}`,
        body: JSON.stringify(adminTicketPayload),
        type: "INBOUND_EMAIL",
        link: "/admin/mailflare",
        priority,
        isRead: true,
      },
    });

    // 4. Send real email via SMTP if deliverable
    let dispatched = false;
    if (targetEmail && cleanEmail(targetEmail)) {
      try {
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
            <div style="background: #064e3b; padding: 20px 24px; color: #ffffff;">
              <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">Darse Burhani Galiakot</h2>
              <p style="margin: 4px 0 0; font-size: 13px; color: #d1fae5;">Official Institutional Communication &middot; Maktab Taalim</p>
            </div>
            <div style="padding: 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
              <p style="margin-top: 0; font-size: 15px;">Afzalus Salam <strong>${studentName}</strong>,</p>
              <h3 style="margin-top: 12px; color: #064e3b; font-size: 16px;">${subject.trim()}</h3>
              <div style="background: #f8fafc; border-left: 4px solid #10b981; padding: 14px 16px; margin: 16px 0; border-radius: 6px;">
                <p style="white-space: pre-wrap; font-size: 14px; color: #1e293b; margin: 0;">${message.trim()}</p>
              </div>
              <p style="font-size: 12px; color: #64748b; margin-top: 20px;">
                You can also view and reply to this message directly in your <a href="${PORTAL_BASE_URL}/talabat/support" style="color: #059669; font-weight: bold;">Talabat Student Portal</a>.
              </p>
              <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center;">
                Official message from <strong>${SUPPORT_EMAIL}</strong> &middot; Idarah Darse Burhani, Galiakot
              </div>
            </div>
          </div>
        `;

        dispatched = await sendEmail({
          to: targetEmail,
          subject: subject.trim(),
          html: emailHtml,
          text: `${message.trim()}\n\n--\nIdarah Darse Burhani (${SUPPORT_EMAIL})`,
          from: `Darse Burhani Support <${SUPPORT_EMAIL}>`,
        });
      } catch (err: any) {
        console.warn("[admin/mailflare] compose email send error:", err?.message || err);
      }
    }

    return res.json({
      success: true,
      data: {
        ticketCode,
        id: createdAdminNotif.id,
        studentName,
        targetEmail,
        dispatched,
        message: studentUser
          ? `Message delivered to ${studentName}'s Talabat portal and queued via email.`
          : `Email dispatched to ${targetEmail}.`,
      },
    });
  } catch (error: any) {
    console.error("[admin/mailflare] compose error:", error);
    return res.status(500).json({ success: false, error: "Failed to dispatch email" });
  }
});

export default router;
