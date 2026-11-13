import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { sendEmail } from "../../lib/email";
import { getProfilePermissions } from "../../lib/profile-permissions";

const router = Router();

/**
 * Honors the admin "Portal Locks & Permissions" toggle for the parent
 * Grievances & Feedback module. When hidden, every parent support endpoint
 * is blocked (403) until Idarah re-enables it.
 */
function requireSupportModuleVisible(_req: any, res: any, next: any) {
  if (getProfilePermissions().modules.parent?.support === false) {
    return res.status(403).json({
      success: false,
      error: "Grievances & Feedback is currently disabled by Idarah.",
    });
  }
  next();
}

router.use(requireSupportModuleVisible);

const GRIEVANCE_EMAIL =
  process.env.GRIEVANCE_EMAIL ||
  process.env.LEAVE_ADMIN_EMAIL ||
  process.env.SMTP_USER ||
  "support@darseburhani-galiakot.org";

/**
 * Canonical parent grievance & feedback categories.
 */
export const PARENT_TICKET_CATEGORIES = [
  "Lodging & Accommodation",
  "Food (Mawaid)",
  "Health & Well-being",
  "Academics & Hifz Progress",
  "General Enquiries",
] as const;

function normalizeCategory(input: unknown): string {
  const raw = String(input || "").trim();
  const match = PARENT_TICKET_CATEGORIES.find(
    (c) => c.toLowerCase() === raw.toLowerCase()
  );
  return match || "General Enquiries";
}

/**
 * GET /api/parent/support
 * Returns the parent's grievance & feedback ticket threads + stats.
 * Tickets are stored as Notification records (type "PARENT_TICKET").
 */
router.get("/", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;

    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, its: true, phone: true, userId: true },
    });

    const parentName = `${session.user.firstName || "Parent"} ${session.user.lastName || ""}`.trim();

    const records = await prisma.notification.findMany({
      where: { userId: session.user.id, type: "PARENT_TICKET" },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    const ticketMap = new Map<string, any>();
    let openCount = 0;
    let inProgressCount = 0;
    let resolvedCount = 0;
    let unreadReplies = 0;

    for (const r of records) {
      let meta: any = {};
      try {
        meta = JSON.parse(r.body);
      } catch {
        meta = { message: r.body, category: "General Enquiries", status: "OPEN", replies: [] };
      }

      const canonicalTicketId = meta.ticketId || `GR-${r.id.slice(-6).toUpperCase()}`;

      if (ticketMap.has(canonicalTicketId)) {
        const existing = ticketMap.get(canonicalTicketId);
        if (Array.isArray(meta.replies) && meta.replies.length > existing.replies.length) {
          existing.replies = meta.replies;
        }
        if (meta.status) existing.status = (meta.status || "OPEN").toUpperCase();
        continue;
      }

      const status = (meta.status || "OPEN").toUpperCase();
      if (status === "RESOLVED") resolvedCount++;
      else if (status === "IN_PROGRESS") inProgressCount++;
      else openCount++;

      const replies = Array.isArray(meta.replies) ? meta.replies : [];
      const lastAdminReply = [...replies].reverse().find((x: any) => x.sender === "ADMIN");
      if (lastAdminReply && !r.isRead) unreadReplies++;

      ticketMap.set(canonicalTicketId, {
        id: r.id,
        ticketId: canonicalTicketId,
        title: meta.subject || r.title,
        category: meta.category || "General Enquiries",
        kind: (meta.kind || "ISSUE").toUpperCase(),
        priority: (meta.priority || r.priority || "NORMAL").toUpperCase(),
        status,
        message: meta.message || r.body || "",
        replies,
        createdAt: r.createdAt.toISOString(),
        isRead: r.isRead,
        hasAdminReply: !!lastAdminReply,
      });
    }

    const tickets = Array.from(ticketMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.json({
      success: true,
      data: {
        parent: {
          name: parentName,
          its: parentProfile?.its || null,
          phone: parentProfile?.phone || null,
        },
        categories: PARENT_TICKET_CATEGORIES,
        tickets,
        stats: {
          total: tickets.length,
          open: openCount,
          inProgress: inProgressCount,
          resolved: resolvedCount,
          unreadReplies,
        },
      },
    });
  } catch (error: any) {
    console.error("[parent/support] fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to load grievances & feedback" });
  }
});

/**
 * POST /api/parent/support/send
 * Parent raises a grievance / issue or shares feedback.
 */
router.post("/send", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const { subject, category, message, priority, kind } = req.body || {};

    if (!subject?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, error: "Subject and message are required." });
    }
    if (String(subject).trim().length > 150) {
      return res.status(400).json({ success: false, error: "Subject must be 150 characters or fewer." });
    }
    if (String(message).trim().length > 4000) {
      return res.status(400).json({ success: false, error: "Message must be 4000 characters or fewer." });
    }

    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true, its: true, phone: true, user: { select: { firstName: true, lastName: true, email: true } } },
    });

    const parentName = `${session.user.firstName || "Parent"} ${session.user.lastName || ""}`.trim();
    const chosenCategory = normalizeCategory(category);
    const chosenPriority = ["NORMAL", "HIGH", "URGENT"].includes(priority) ? priority : "NORMAL";
    const chosenKind = kind === "FEEDBACK" ? "FEEDBACK" : "ISSUE";
    const ticketCode = `GR-${Date.now().toString().slice(-6)}`;

    const ticketPayload = {
      ticketId: ticketCode,
      category: chosenCategory,
      kind: chosenKind,
      subject: subject.trim(),
      message: message.trim(),
      priority: chosenPriority,
      status: "OPEN",
      parentName,
      parentIts: parentProfile?.its || null,
      parentEmail: parentProfile?.user?.email || session.user.email || null,
      parentId: parentProfile?.id || null,
      replies: [],
    };

    const created = await prisma.notification.create({
      data: {
        userId: session.user.id,
        title: `[${ticketCode}] ${subject.trim()}`,
        body: JSON.stringify(ticketPayload),
        type: "PARENT_TICKET",
        link: "/parent/grievances",
        priority: chosenPriority,
        isRead: true,
      },
    });

    // Notify active administrators so Idarah can respond promptly
    try {
      const adminUsers = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });
      if (adminUsers.length > 0) {
        await prisma.notification.createMany({
          data: adminUsers.map((a) => ({
            userId: a.id,
            title: `Parent ${chosenKind === "FEEDBACK" ? "Feedback" : "Grievance"} [${ticketCode}]: ${subject.trim()}`,
            body: JSON.stringify(ticketPayload),
            type: "PARENT_TICKET",
            link: "/admin/grievances",
            priority: chosenPriority,
            isRead: false,
          })),
        });
      }
    } catch (adminNotifErr) {
      console.warn("[parent/support] admin notification error:", adminNotifErr);
    }

    // Best-effort email dispatch to the grievance desk (never blocks the response)
    let emailDispatched = false;
    try {
      emailDispatched = await sendEmail({
        to: GRIEVANCE_EMAIL,
        subject: `[Parent ${chosenKind === "FEEDBACK" ? "Feedback" : "Grievance"} ${ticketCode}] ${subject.trim()} - ${parentName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background: #0f172a; padding: 20px 24px; color: #ffffff;">
              <h2 style="margin: 0; font-size: 18px;">Darse Burhani Galiakot — Parent Grievance & Feedback Desk</h2>
            </div>
            <div style="padding: 24px; color: #1e293b; font-size: 14px; line-height: 1.6;">
              <p style="margin: 0 0 12px;"><strong>Ticket:</strong> #${ticketCode} &middot; <strong>Category:</strong> ${chosenCategory} &middot; <strong>Type:</strong> ${chosenKind} &middot; <strong>Priority:</strong> ${chosenPriority}</p>
              <p style="margin: 0 0 12px;"><strong>Parent:</strong> ${parentName}${parentProfile?.its ? ` (ITS: ${parentProfile.its})` : ""}<br>
              <strong>Email:</strong> ${parentProfile?.user?.email || session.user.email || "N/A"} &middot; <strong>Phone:</strong> ${parentProfile?.phone || "N/A"}</p>
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 16px;">
                <p style="margin: 0; white-space: pre-wrap;">${message.trim()}</p>
              </div>
            </div>
          </div>
        `,
        text: `Ticket: ${ticketCode}\nCategory: ${chosenCategory}\nType: ${chosenKind}\nParent: ${parentName}\n\n${message.trim()}`,
        from: `Darse Burhani Parent Desk <${GRIEVANCE_EMAIL}>`,
      });
    } catch (err: any) {
      console.warn("[parent/support] email dispatch error:", err?.message || err);
    }

    return res.json({
      success: true,
      data: {
        ticketCode,
        id: created.id,
        emailDispatched,
        message: "Your submission has been recorded. Idarah will respond shortly.",
      },
    });
  } catch (error: any) {
    console.error("[parent/support] send error:", error);
    return res.status(500).json({ success: false, error: "Failed to submit grievance/feedback" });
  }
});

/**
 * POST /api/parent/support/reply
 * Parent appends a follow-up message to an existing ticket thread.
 */
router.post("/reply", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const { ticketId, replyText } = req.body || {};

    if (!ticketId || !replyText?.trim()) {
      return res.status(400).json({ success: false, error: "Ticket ID and reply text are required." });
    }
    if (String(replyText).trim().length > 4000) {
      return res.status(400).json({ success: false, error: "Reply must be 4000 characters or fewer." });
    }

    const primary = await prisma.notification.findFirst({
      where: {
        userId: session.user.id,
        type: "PARENT_TICKET",
        OR: [{ id: ticketId }, { body: { contains: ticketId } }],
      },
    });

    if (!primary) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    let meta: any = {};
    try {
      meta = JSON.parse(primary.body);
    } catch {
      meta = { message: primary.body, replies: [] };
    }
    const canonicalTicketId = meta.ticketId || ticketId;
    const replies = Array.isArray(meta.replies) ? meta.replies : [];
    replies.push({
      sender: "PARENT",
      senderName: `${session.user.firstName || "Parent"} ${session.user.lastName || ""}`.trim(),
      text: replyText.trim(),
      timestamp: new Date().toISOString(),
    });
    meta.replies = replies;
    meta.status = "IN_PROGRESS";

    // Sync across all copies of this ticket (parent + admin inbox records)
    const linked = await prisma.notification.findMany({
      where: {
        type: "PARENT_TICKET",
        OR: [{ id: primary.id }, { body: { contains: canonicalTicketId } }],
      },
    });

    for (const n of linked) {
      let m: any = {};
      try {
        m = JSON.parse(n.body);
      } catch {
        m = { message: n.body };
      }
      m.replies = replies;
      m.status = "IN_PROGRESS";
      await prisma.notification.update({
        where: { id: n.id },
        data: {
          body: JSON.stringify(m),
          isRead: n.userId === session.user.id,
        },
      });
    }

    return res.json({ success: true, data: { replies, status: "IN_PROGRESS", canonicalTicketId } });
  } catch (error: any) {
    console.error("[parent/support] reply error:", error);
    return res.status(500).json({ success: false, error: "Failed to post reply" });
  }
});

/**
 * PATCH /api/parent/support/status
 * Parent acknowledges/closes a ticket (RESOLVED) or reopens it (OPEN).
 */
router.patch("/status", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const { ticketId, status } = req.body || {};

    if (!ticketId || !["OPEN", "RESOLVED"].includes(status)) {
      return res.status(400).json({ success: false, error: "Valid ticketId and status required." });
    }

    const primary = await prisma.notification.findFirst({
      where: {
        userId: session.user.id,
        type: "PARENT_TICKET",
        OR: [{ id: ticketId }, { body: { contains: ticketId } }],
      },
    });

    if (!primary) {
      return res.status(404).json({ success: false, error: "Ticket not found" });
    }

    let meta: any = {};
    try {
      meta = JSON.parse(primary.body);
    } catch {
      meta = { message: primary.body };
    }
    const canonicalTicketId = meta.ticketId || ticketId;

    const linked = await prisma.notification.findMany({
      where: {
        type: "PARENT_TICKET",
        OR: [{ id: primary.id }, { body: { contains: canonicalTicketId } }],
      },
    });

    for (const n of linked) {
      let m: any = {};
      try {
        m = JSON.parse(n.body);
      } catch {
        m = { message: n.body };
      }
      m.status = status;
      await prisma.notification.update({
        where: { id: n.id },
        data: {
          body: JSON.stringify(m),
          ...(status === "RESOLVED" ? { isRead: true } : {}),
        },
      });
    }

    return res.json({ success: true, data: { status, canonicalTicketId } });
  } catch (error: any) {
    console.error("[parent/support] status error:", error);
    return res.status(500).json({ success: false, error: "Failed to update ticket status" });
  }
});

/**
 * PATCH /api/parent/support/read
 * Marks a ticket's admin replies as read on the parent side.
 */
router.patch("/read", requireRole("PARENT"), async (req, res) => {
  try {
    const session = req.auth!;
    const { ticketId } = req.body || {};
    if (!ticketId) {
      return res.status(400).json({ success: false, error: "Ticket ID required." });
    }
    await prisma.notification.updateMany({
      where: {
        userId: session.user.id,
        type: "PARENT_TICKET",
        OR: [{ id: ticketId }, { body: { contains: ticketId } }],
      },
      data: { isRead: true },
    });
    return res.json({ success: true });
  } catch (error: any) {
    console.error("[parent/support] read error:", error);
    return res.status(500).json({ success: false, error: "Failed to mark ticket read" });
  }
});

export default router;
