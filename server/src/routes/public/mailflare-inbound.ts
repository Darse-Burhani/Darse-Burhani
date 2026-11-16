import { Router } from "express";
import prisma from "../../lib/prisma";
import { isSuppressedAutomatedEmail } from "../../lib/email-filter";
import { sendPushToUser } from "../../lib/push";

const router = Router();

/**
 * POST /api/public/mailflare/inbound or POST /api/inbound
 * Inbound webhook for Cloudflare Email Workers / Mailflare.
 * When an email is received at support@darseburhani-galiakot.org, Cloudflare forwards the payload here.
 */
router.post(["/", "/inbound"], async (req, res) => {
  try {
    const isRaw = typeof req.body === "string";
    const bodyObj = typeof req.body === "object" && req.body !== null ? req.body : {};

    let from = bodyObj.from || (req.headers["x-mailflare-from"] as string) || "";
    let to = bodyObj.to || (req.headers["x-mailflare-to"] as string) || "";
    let headers = bodyObj.headers;
    if (!headers && req.headers["x-mailflare-headers"]) {
      try {
        headers = JSON.parse(req.headers["x-mailflare-headers"] as string);
      } catch {}
    }

    let subject = bodyObj.subject || headers?.subject;
    let text = bodyObj.text || (isRaw ? req.body : "");
    let html = bodyObj.html;

    // Parse raw RFC822 message if subject/from was sent as raw message/rfc822 body
    if (isRaw) {
      if (!subject) {
        const subMatch = (req.body as string).match(/^Subject:\s*(.*)$/im);
        if (subMatch) subject = subMatch[1].trim();
      }
      if (!from) {
        const fromMatch = (req.body as string).match(/^From:\s*(.*)$/im);
        if (fromMatch) from = fromMatch[1].trim();
      }
      if (!to) {
        const toMatch = (req.body as string).match(/^To:\s*(.*)$/im);
        if (toMatch) to = toMatch[1].trim();
      }
    }

    const configuredSecret = process.env.MAILFLARE_WEBHOOK_SECRET || process.env.BIOMETRIC_SECRET;
    if (configuredSecret && bodyObj.secret && bodyObj.secret !== configuredSecret) {
      return res.status(403).json({ success: false, error: "Invalid webhook secret" });
    }

    if (!from || (!text && !html && !subject)) {
      return res.status(400).json({
        success: false,
        error: "Sender and email content are required",
        action: "reject",
        reason: "Sender and email content are required",
      });
    }

    const cleanSender = String(from).trim().toLowerCase();
    const senderEmail = cleanSender.includes("<")
      ? cleanSender.match(/<([^>]+)>/)?.[1] || cleanSender
      : cleanSender;

    const subjectClean = (subject || "(No Subject)").trim();
    const messageBody = (text || html || "").trim();

    // 1. Noise Suppression: Filter out automated bots, cloud vendors (Render, Google Gemini), social media, and newsletters
    if (isSuppressedAutomatedEmail(senderEmail, subjectClean, headers)) {
      console.log(`[public/mailflare/inbound] Filtered automated/vendor email: ${senderEmail} ("${subjectClean}")`);
      return res.status(200).json({
        success: true,
        action: "store",
        ignored: true,
        reason: "Automated vendor/bot email suppressed from student support stack.",
      });
    }

    // Look up if sender matches an existing User (Student, Parent, Teacher)
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: senderEmail, mode: "insensitive" } },
          { teacherProfile: { tEmail: { equals: senderEmail, mode: "insensitive" } } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, role: true },
    });

    // If sender is NOT an existing user and has no body or is suspicious, skip
    if (!existingUser && messageBody.length < 5) {
      return res.status(200).json({
        success: true,
        action: "store",
        ignored: true,
        reason: "Empty or malformed external message ignored.",
      });
    }

    // Assign to default Admin so it appears in the master inbox
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });

    const targetUserId = existingUser?.id || adminUser?.id;
    if (!targetUserId) {
      return res.status(500).json({ success: false, error: "No recipient user account found" });
    }

    const ticketCode = `INB-${Date.now().toString().slice(-6)}`;

    const payload = {
      ticketId: ticketCode,
      category: "Inbound Email",
      subject: subjectClean,
      message: messageBody,
      priority: "NORMAL",
      status: "OPEN",
      studentEmail: senderEmail,
      studentName: existingUser
        ? `${existingUser.firstName} ${existingUser.lastName}`.trim()
        : senderEmail.split("@")[0],
      replies: [],
      inbound: true,
      headers: headers || {},
    };

    const notif = await prisma.notification.create({
      data: {
        userId: targetUserId,
        title: `[${ticketCode}] ${subjectClean} (from ${senderEmail})`,
        body: JSON.stringify(payload),
        type: "INBOUND_EMAIL",
        link: `/admin/mailflare?ticket=${ticketCode}`,
        priority: "HIGH",
        isRead: false,
      },
    });

    // Send push notification to target user
    sendPushToUser(targetUserId, {
      title: `📬 Inbound Email: ${subjectClean}`,
      body: `${senderEmail}: ${messageBody.slice(0, 100)}${messageBody.length > 100 ? "…" : ""}`,
      url: `/admin/mailflare?ticket=${ticketCode}`,
      tag: `mailflare-${ticketCode}`,
    }).catch(() => {});

    // Also notify admins if the email belonged to an existing student
    if (existingUser && adminUser && existingUser.id !== adminUser.id) {
      await prisma.notification.create({
        data: {
          userId: adminUser.id,
          title: `Inbound Email [${ticketCode}]: ${subjectClean}`,
          body: JSON.stringify(payload),
          type: "INBOUND_EMAIL",
          link: `/admin/mailflare?ticket=${ticketCode}`,
          priority: "HIGH",
          isRead: false,
        },
      });

      sendPushToUser(adminUser.id, {
        title: `📬 Inbound Email [${ticketCode}]`,
        body: `${existingUser.firstName || senderEmail}: ${subjectClean}`,
        url: `/admin/mailflare?ticket=${ticketCode}`,
        tag: `mailflare-admin-${ticketCode}`,
      }).catch(() => {});
    }

    return res.json({
      success: true,
      action: "store",
      data: {
        id: notif.id,
        ticketCode,
        message: "Inbound email accepted and saved to Mailflare inbox.",
      },
    });
  } catch (error: any) {
    console.error("[public/mailflare/inbound] error:", error);
    return res.status(500).json({ success: false, error: "Failed to process inbound email" });
  }
});

export default router;
