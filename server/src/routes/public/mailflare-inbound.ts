import { Router } from "express";
import prisma from "../../lib/prisma";
import { isSuppressedAutomatedEmail } from "../../lib/email-filter";

const router = Router();

/**
 * POST /api/public/mailflare/inbound
 * Inbound webhook for Cloudflare Email Workers / Mailflare.
 * When an email is received at support@darseburhani-galiakot.org, Cloudflare forwards the payload here.
 */
router.post("/inbound", async (req, res) => {
  try {
    const { from, to, subject, text, html, headers, secret } = req.body || {};

    const configuredSecret = process.env.MAILFLARE_WEBHOOK_SECRET || process.env.BIOMETRIC_SECRET;
    if (configuredSecret && secret && secret !== configuredSecret) {
      return res.status(403).json({ success: false, error: "Invalid webhook secret" });
    }

    if (!from || (!text && !html && !subject)) {
      return res.status(400).json({ success: false, error: "Sender and email content are required" });
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
    }

    return res.json({
      success: true,
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
