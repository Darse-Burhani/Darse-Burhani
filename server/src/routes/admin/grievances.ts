import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";

const router = Router();

const VALID_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED"];

/**
 * GET /api/admin/grievances
 * Lists every parent grievance / feedback ticket thread (chat-style inbox source),
 * with filters and stats.
 */
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const { status, category } = req.query as { status?: string; category?: string };

    const records = await prisma.notification.findMany({
      where: { type: "PARENT_TICKET" },
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true } },
      },
    });

    // Group by canonical ticket id (parent copy + admin copies of the same ticket)
    const ticketMap = new Map<string, any>();

    for (const r of records) {
      let meta: any = {};
      try {
        meta = JSON.parse(r.body);
      } catch {
        meta = { message: r.body, category: "General Enquiries", status: "OPEN", replies: [] };
      }

      const canonicalTicketId = meta.ticketId || `GR-${r.id.slice(-6).toUpperCase()}`;

      const parentUserId = r.user?.id || meta.parentId || r.userId;

      if (ticketMap.has(canonicalTicketId)) {
        const existing = ticketMap.get(canonicalTicketId);
        // Keep the most complete copy (longest replies array)
        if (Array.isArray(meta.replies) && meta.replies.length > existing.replies.length) {
          existing.replies = meta.replies;
        }
        if (meta.status) existing.status = (meta.status || "OPEN").toUpperCase();
        if (r.user?.firstName && !existing.parent.name) {
          existing.parent = {
            userId: parentUserId,
            name: `${r.user.firstName} ${r.user.lastName || ""}`.trim(),
            email: r.user.email || null,
            avatarUrl: r.user.avatarUrl || null,
          };
        }
        continue;
      }

      const replies = Array.isArray(meta.replies) ? meta.replies : [];
      ticketMap.set(canonicalTicketId, {
        id: r.id,
        ticketId: canonicalTicketId,
        title: meta.subject || r.title,
        category: meta.category || "General Enquiries",
        kind: (meta.kind || "ISSUE").toUpperCase(),
        priority: (meta.priority || r.priority || "NORMAL").toUpperCase(),
        status: (meta.status || "OPEN").toUpperCase(),
        message: meta.message || r.body || "",
        replies,
        createdAt: r.createdAt.toISOString(),
        parent: {
          userId: parentUserId,
          name: meta.parentName || (r.user ? `${r.user.firstName} ${r.user.lastName || ""}`.trim() : "Parent"),
          email: meta.parentEmail || r.user?.email || null,
          avatarUrl: r.user?.avatarUrl || null,
          its: meta.parentIts || null,
        },
      });
    }

    let tickets = Array.from(ticketMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (status && status !== "ALL") {
      tickets = tickets.filter((t) => t.status === String(status).toUpperCase());
    }
    if (category && category !== "ALL") {
      tickets = tickets.filter((t) => t.category === category);
    }

    const all = Array.from(ticketMap.values());
    const stats = {
      total: all.length,
      open: all.filter((t) => t.status === "OPEN").length,
      inProgress: all.filter((t) => t.status === "IN_PROGRESS").length,
      resolved: all.filter((t) => t.status === "RESOLVED").length,
      urgent: all.filter((t) => t.priority === "URGENT" && t.status !== "RESOLVED").length,
    };

    return res.json({ success: true, data: { tickets, stats } });
  } catch (error: any) {
    console.error("[admin/grievances] fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to load grievances inbox" });
  }
});

/**
 * POST /api/admin/grievances/reply
 * Admin answers a parent ticket thread (chat message).
 */
router.post("/reply", requireRole("ADMIN"), async (req, res) => {
  try {
    const admin = (req as any).auth?.user;
    const { ticketId, replyText, status } = req.body || {};

    if (!ticketId || !replyText?.trim()) {
      return res.status(400).json({ success: false, error: "Ticket ID and reply text are required." });
    }
    if (String(replyText).trim().length > 4000) {
      return res.status(400).json({ success: false, error: "Reply must be 4000 characters or fewer." });
    }

    const primary = await prisma.notification.findFirst({
      where: {
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
    const adminName = `${admin?.firstName || "Idarah"} ${admin?.lastName || ""}`.trim() || "Idarah Administration";

    replies.push({
      sender: "ADMIN",
      senderName: adminName,
      text: replyText.trim(),
      timestamp: new Date().toISOString(),
    });
    meta.replies = replies;
    meta.status = VALID_STATUSES.includes(status) ? status : "IN_PROGRESS";
    const nextStatus = meta.status;

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
      m.status = nextStatus;
      m.adminName = adminName;
      await prisma.notification.update({
        where: { id: n.id },
        data: {
          body: JSON.stringify(m),
          // Parent's own copy becomes unread so they see the admin answer
          isRead: n.userId === admin?.id ? n.isRead : false,
        },
      });
    }

    return res.json({ success: true, data: { replies, status: nextStatus, canonicalTicketId } });
  } catch (error: any) {
    console.error("[admin/grievances] reply error:", error);
    return res.status(500).json({ success: false, error: "Failed to send reply" });
  }
});

/**
 * PATCH /api/admin/grievances/status
 * Updates ticket status (OPEN / IN_PROGRESS / RESOLVED), e.g. quick resolve.
 */
router.patch("/status", requireRole("ADMIN"), async (req, res) => {
  try {
    const admin = (req as any).auth?.user;
    const { ticketId, status } = req.body || {};

    if (!ticketId || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, error: "Valid ticketId and status required." });
    }

    const primary = await prisma.notification.findFirst({
      where: {
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
          isRead: status === "RESOLVED" ? true : n.isRead,
        },
      });
    }

    return res.json({ success: true, data: { status, canonicalTicketId } });
  } catch (error: any) {
    console.error("[admin/grievances] status error:", error);
    return res.status(500).json({ success: false, error: "Failed to update status" });
  }
});

export default router;
