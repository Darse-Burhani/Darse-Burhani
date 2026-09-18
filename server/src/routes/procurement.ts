
import prisma from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware";

const router = Router();

// ==========================================
// TEACHER / FACULTY REQUISITION ENDPOINTS
// ==========================================

/**
 * GET /api/procurement/my
 * Fetch all procurement requests submitted by the logged-in teacher/faculty member.
 */
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.user.id;
    const { status, search } = req.query as { status?: string; search?: string };

    const where: any = { requesterId: userId };

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { officeLocation: { contains: q, mode: "insensitive" } },
        { reason: { contains: q, mode: "insensitive" } },
        { category: { contains: q, mode: "insensitive" } },
      ];
    }

    const requests = await prisma.procurementRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    console.error("[procurement] Error fetching my requests:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch procurement requests" });
  }
});

/**
 * GET /api/procurement/my-stats
 * KPI breakdown for the logged in user
 */
router.get("/my-stats", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.user.id;

    const [total, pending, approved, ordered, fulfilled, rejected] = await Promise.all([
      prisma.procurementRequest.count({ where: { requesterId: userId } }),
      prisma.procurementRequest.count({ where: { requesterId: userId, status: "PENDING" } }),
      prisma.procurementRequest.count({ where: { requesterId: userId, status: "APPROVED" } }),
      prisma.procurementRequest.count({ where: { requesterId: userId, status: "ORDERED" } }),
      prisma.procurementRequest.count({ where: { requesterId: userId, status: "FULFILLED" } }),
      prisma.procurementRequest.count({ where: { requesterId: userId, status: "REJECTED" } }),
    ]);

    return res.json({
      success: true,
      data: {
        total,
        pending,
        inProgress: approved + ordered,
        fulfilled,
        rejected,
      },
    });
  } catch (error: any) {
    console.error("[procurement] Error fetching my stats:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch stats" });
  }
});

/**
 * POST /api/procurement/request
 * Faculty / Teacher raises a new procurement requisition specifying their office/room location.
 */
router.post("/request", requireAuth, async (req, res) => {
  try {
    const userId = req.auth!.user.id;
    const {
      title,
      category = "STATIONERY",
      quantity = 1,
      unit = "pcs",
      officeLocation,
      priority = "NORMAL",
      reason,
    } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: "Item name/title is required" });
    }

    if (!officeLocation || !officeLocation.trim()) {
      return res.status(400).json({
        success: false,
        error: "Office place / classroom location is required (e.g. Room 204, Faculty Staff Room)",
      });
    }

    const parsedQty = Math.max(1, parseInt(String(quantity), 10) || 1);

    const validPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
    const chosenPriority = validPriorities.includes(priority) ? priority : "NORMAL";

    const newRequest = await prisma.procurementRequest.create({
      data: {
        requesterId: userId,
        title: title.trim(),
        category: category.trim().toUpperCase(),
        quantity: parsedQty,
        unit: (unit || "pcs").trim(),
        officeLocation: officeLocation.trim(),
        priority: chosenPriority,
        status: "PENDING",
        reason: reason?.trim() || null,
      },
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Notify administrators of the new requisition
    try {
      const admins = await prisma.user.findMany({
        where: { role: "ADMIN", isActive: true },
        select: { id: true },
      });

      const requesterName = `${newRequest.requester.firstName} ${newRequest.requester.lastName}`.trim();
      const notificationData = admins.map((admin) => ({
        userId: admin.id,
        title: `Procurement Requisition: ${newRequest.title}`,
        body: `${requesterName} requested ${newRequest.quantity} ${newRequest.unit} for "${newRequest.officeLocation}". Priority: ${newRequest.priority}.`,
        type: "PROCUREMENT",
        link: "/admin/procurement",
        priority: newRequest.priority === "URGENT" ? "URGENT" : "NORMAL",
      }));

      if (notificationData.length > 0) {
        await prisma.notification.createMany({ data: notificationData });
      }
    } catch (notifErr) {
      console.warn("[procurement] Non-critical notification error:", notifErr);
    }

    return res.status(201).json({
      success: true,
      message: "Procurement request submitted successfully and routed to administration.",
      data: newRequest,
    });
  } catch (error: any) {
    console.error("[procurement] Error creating request:", error);
    return res.status(500).json({ success: false, error: error?.message || "Failed to submit procurement request" });
  }
});

/**
 * DELETE /api/procurement/request/:id
 * Requester cancels their pending request, or Admin deletes any request.
 */
router.delete("/request/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.auth!.user;

    const request = await prisma.procurementRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return res.status(404).json({ success: false, error: "Procurement request not found" });
    }

    // Admins can delete any request. Requesters can only cancel their own PENDING request.
    if (user.role !== "ADMIN") {
      if (request.requesterId !== user.id) {
        return res.status(403).json({ success: false, error: "You can only cancel your own requests" });
      }
      if (request.status !== "PENDING") {
        return res.status(400).json({
          success: false,
          error: `Cannot cancel request because it is already ${request.status.toLowerCase()}`,
        });
      }
    }

    await prisma.procurementRequest.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: "Procurement requisition cancelled successfully.",
    });
  } catch (error: any) {
    console.error("[procurement] Error deleting request:", error);
    return res.status(500).json({ success: false, error: "Failed to delete request" });
  }
});

// ==========================================
// ADMIN ("CONCERN PERSON") ENDPOINTS
// ==========================================

/**
 * GET /api/procurement/admin/all
 * Central console query for all school-wide requisitions.
 */
router.get("/admin/all", requireRole("ADMIN"), async (req, res) => {
  try {
    const {
      status,
      priority,
      category,
      search,
      page = "1",
      limit = "50",
    } = req.query as Record<string, string | undefined>;

    const where: any = {};

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (priority && priority !== "ALL") {
      where.priority = priority;
    }

    if (category && category !== "ALL") {
      where.category = category.toUpperCase();
    }

    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { officeLocation: { contains: q, mode: "insensitive" } },
        { reason: { contains: q, mode: "insensitive" } },
        { requester: { firstName: { contains: q, mode: "insensitive" } } },
        { requester: { lastName: { contains: q, mode: "insensitive" } } },
        { requester: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page || "1", 10));
    const take = Math.min(100, Math.max(1, parseInt(limit || "50", 10)));
    const skip = (pageNum - 1) * take;

    const [total, requests] = await Promise.all([
      prisma.procurementRequest.count({ where }),
      prisma.procurementRequest.findMany({
        where,
        skip,
        take,
        orderBy: [
          // Urgent pending first, then by date
          { createdAt: "desc" },
        ],
        include: {
          requester: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              role: true,
              teacherProfile: {
                select: {
                  employeeId: true,
                  department: true,
                  khidmatMauze: true,
                  mobile: true,
                },
              },
            },
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        requests,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error: any) {
    console.error("[procurement] Admin fetch error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch procurement requisitions" });
  }
});

/**
 * GET /api/procurement/admin/stats
 * Aggregate dashboard metrics for admin command center.
 */
router.get("/admin/stats", requireRole("ADMIN"), async (_req, res) => {
  try {
    const [
      total,
      pending,
      approved,
      ordered,
      fulfilled,
      rejected,
      urgentPending,
      allRequests,
    ] = await Promise.all([
      prisma.procurementRequest.count(),
      prisma.procurementRequest.count({ where: { status: "PENDING" } }),
      prisma.procurementRequest.count({ where: { status: "APPROVED" } }),
      prisma.procurementRequest.count({ where: { status: "ORDERED" } }),
      prisma.procurementRequest.count({ where: { status: "FULFILLED" } }),
      prisma.procurementRequest.count({ where: { status: "REJECTED" } }),
      prisma.procurementRequest.count({ where: { status: "PENDING", priority: "URGENT" } }),
      prisma.procurementRequest.findMany({
        select: {
          category: true,
          status: true,
        },
      }),
    ]);

    const categoryCounts: Record<string, number> = {};

    for (const r of allRequests) {
      categoryCounts[r.category] = (categoryCounts[r.category] || 0) + 1;
    }

    return res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        ordered,
        fulfilled,
        rejected,
        urgentPending,
        byCategory: categoryCounts,
      },
    });
  } catch (error: any) {
    console.error("[procurement] Admin stats error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch procurement stats" });
  }
});

/**
 * PATCH /api/procurement/admin/:id/status
 * Admin / Concern Person updates status (Approve, Order, Fulfill, Reject).
 */
router.patch("/admin/:id/status", requireRole("ADMIN"), async (req, res) => {
  try {
    const { id } = req.params;
    const adminUser = req.auth!.user;
    const {
      status,
      reviewerNotes,
      expectedDelivery,
    } = req.body;

    const validStatuses = ["PENDING", "APPROVED", "ORDERED", "FULFILLED", "REJECTED", "CANCELLED"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: "Invalid status provided" });
    }

    const existing = await prisma.procurementRequest.findUnique({
      where: { id },
      include: { requester: true },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: "Procurement request not found" });
    }

    const updateData: any = {
      status,
      assignedToId: adminUser.id,
      updatedAt: new Date(),
    };

    if (reviewerNotes !== undefined) {
      updateData.reviewerNotes = reviewerNotes?.trim() || null;
    }

    if (expectedDelivery !== undefined) {
      updateData.expectedDelivery = expectedDelivery ? new Date(expectedDelivery) : null;
    }

    if (status === "FULFILLED") {
      updateData.fulfilledAt = new Date();
    } else if (status === "REJECTED") {
      updateData.rejectedAt = new Date();
    }

    const updated = await prisma.procurementRequest.update({
      where: { id },
      data: updateData,
      include: {
        requester: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Notify the teacher about status change
    try {
      const statusLabels: Record<string, string> = {
        APPROVED: "Approved by Administration",
        ORDERED: "Order Placed / In Procurement",
        FULFILLED: "Fulfilled & Delivered",
        REJECTED: "Declined",
        PENDING: "Set back to Pending Review",
      };

      const friendlyStatus = statusLabels[status] || status;
      const noteSuffix = reviewerNotes ? ` Remark: "${reviewerNotes}"` : "";

      await prisma.notification.create({
        data: {
          userId: existing.requesterId,
          title: `Procurement Update: ${existing.title}`,
          body: `Your requisition for "${existing.title}" (${existing.officeLocation}) is now ${friendlyStatus}.${noteSuffix}`,
          type: "PROCUREMENT",
          link: "/teacher/procurement",
          priority: status === "FULFILLED" ? "NORMAL" : status === "REJECTED" ? "HIGH" : "NORMAL",
        },
      });
    } catch (notifErr) {
      console.warn("[procurement] Non-critical notification error:", notifErr);
    }

    return res.json({
      success: true,
      message: `Requisition "${updated.title}" marked as ${status}.`,
      data: updated,
    });
  } catch (error: any) {
    console.error("[procurement] Status update error:", error);
    return res.status(500).json({ success: false, error: "Failed to update requisition status" });
  }
});

/**
 * GET /api/procurement/admin/export
 * Export requisitions in CSV format for administrative and accounts records.
 */
router.get("/admin/export", requireRole("ADMIN"), async (_req, res) => {
  try {
    const requests = await prisma.procurementRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        requester: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            teacherProfile: {
              select: {
                employeeId: true,
                department: true,
              },
            },
          },
        },
      },
    });

    const headers = [
      "Requisition ID",
      "Item Title",
      "Category",
      "Quantity",
      "Unit",
      "Office Location",
      "Priority",
      "Status",
      "Requester Name",
      "Requester Email",
      "Department",
      "Reviewer Notes",
      "Date Requested",
      "Date Fulfilled",
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = requests.map((r) => [
      escapeCsv(r.id),
      escapeCsv(r.title),
      escapeCsv(r.category),
      escapeCsv(r.quantity),
      escapeCsv(r.unit || "pcs"),
      escapeCsv(r.officeLocation),
      escapeCsv(r.priority),
      escapeCsv(r.status),
      escapeCsv(`${r.requester.firstName} ${r.requester.lastName}`.trim()),
      escapeCsv(r.requester.email),
      escapeCsv(r.requester.teacherProfile?.department ?? ""),
      escapeCsv(r.reviewerNotes ?? ""),
      escapeCsv(r.createdAt.toISOString().slice(0, 10)),
      escapeCsv(r.fulfilledAt ? r.fulfilledAt.toISOString().slice(0, 10) : ""),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=procurement_requisitions_${new Date().toISOString().slice(0, 10)}.csv`);
    return res.send(csvContent);
  } catch (error: any) {
    console.error("[procurement] Export error:", error);
    return res.status(500).json({ success: false, error: "Failed to export requisitions" });
  }
});

export default router;
