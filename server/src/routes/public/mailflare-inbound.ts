import { Router } from "express";
import prisma from "../../lib/prisma";

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

    // If not found, assign to default Admin so it appears in the master inbox
    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });

    const targetUserId = existingUser?.id || adminUser?.id;
    if (!targetUserId) {
      return res.status(500).json({ success: false, error: "No recipient user account found" });
    }

    const ticketCode = `INB-${Date.now().toString().slice(-6)}`;
    const subjectClean = (subject || "(No Subject)").trim();
    const messageBody = (text || html || "").trim();

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

