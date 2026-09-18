
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { approveLeaveRequest, rejectLeaveRequest, cancelLeaveRequest } from "../../lib/leave-service";
import { LeaveStatus, LeaveType } from "@prisma/client";

const router = Router();

// GET /api/admin/leave — List all leave requests with administrative filtering
router.get("/", requireRole("ADMIN"), async (req, res) => {
  try {
    const { status, type, grade, section, search, startDate, endDate } = req.query;
    const page = Math.max(parseInt((req.query.page as string) || "1"), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "25"), 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status && Object.values(LeaveStatus).includes(status as LeaveStatus)) {
      where.status = status as LeaveStatus;
    }

    if (type && Object.values(LeaveType).includes(type as LeaveType)) {
      where.type = type as LeaveType;
    }

    if (grade && typeof grade === "string") {
      where.student = { ...where.student, grade };
    }

    if (section && typeof section === "string") {
      where.student = { ...where.student, section };
    }

    if (startDate || endDate) {
      where.OR = [];
      if (startDate && endDate) {
        where.startDate = { lte: new Date(endDate as string) };
        where.endDate = { gte: new Date(startDate as string) };
      } else if (startDate) {
        where.endDate = { gte: new Date(startDate as string) };
      } else if (endDate) {
        where.startDate = { lte: new Date(endDate as string) };
      }
    }

    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      where.student = {
        ...where.student,
        OR: [
          { user: { firstName: { contains: q, mode: "insensitive" } } },
          { user: { lastName: { contains: q, mode: "insensitive" } } },
          { studentId: { contains: q, mode: "insensitive" } },
          { its: { contains: q, mode: "insensitive" } },
        ],
      };
    }

    const [total, pendingCount, approvedCount, rejectedCount, medicalCount, leaves, grades] =
      await Promise.all([
        prisma.leaveRequest.count({ where }),
        prisma.leaveRequest.count({ where: { status: LeaveStatus.PENDING } }),
        prisma.leaveRequest.count({ where: { status: LeaveStatus.APPROVED } }),
        prisma.leaveRequest.count({ where: { status: LeaveStatus.REJECTED } }),
        prisma.leaveRequest.count({ where: { type: LeaveType.MEDICAL, status: LeaveStatus.APPROVED } }),
        prisma.leaveRequest.findMany({
          where,
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                classEnrollments: {
                  where: { isActive: true },
                  include: { class: { select: { id: true, name: true, grade: true, section: true } } },
                  take: 1,
                },
              },
            },
            reviewer: {
              select: { firstName: true, lastName: true, role: true, email: true },
            },
          },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
          skip,
          take: limit,
        }),
        prisma.studentProfile.findMany({
          select: { grade: true, section: true },
          distinct: ["grade", "section"],
        }),
      ]);

    return res.json({
      success: true,
      data: {
        stats: {
          pending: pendingCount,
          approved: approvedCount,
          rejected: rejectedCount,
          medical: medicalCount,
          total: pendingCount + approvedCount + rejectedCount,
        },
        gradesSections: grades,
        requests: leaves.map((l) => ({
          id: l.id,
          studentId: l.studentId,
          studentName: `${l.student.user.firstName} ${l.student.user.lastName}`.trim(),
          avatarUrl: l.student.user.avatarUrl,
          its: l.student.its || l.student.studentId,
          grade: l.student.grade,
          section: l.student.section,
          className: l.student.classEnrollments[0]?.class?.name || `Grade ${l.student.grade}-${l.student.section}`,
          type: l.type,
          startDate: l.startDate.toISOString(),
          endDate: l.endDate.toISOString(),
          reason: l.reason,
          attachmentUrl: l.attachmentUrl,
          status: l.status,
          reviewerNotes: l.reviewerNotes,
          reviewedBy: l.reviewer ? `${l.reviewer.firstName} ${l.reviewer.lastName}` : null,
          reviewedAt: l.reviewedAt?.toISOString() || null,
          createdAt: l.createdAt.toISOString(),
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("[admin-leave] GET error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch leave requests" });
  }
});

// POST /api/admin/leave/:id/approve — Admin override / approve
router.post("/:id/approve", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { reviewerNotes } = req.body;

    const leave = await approveLeaveRequest({
      leaveId: req.params.id,
      reviewerId: session.user.id,
      reviewerNotes: reviewerNotes || "Approved by Administrator.",
    });

    return res.json({
      success: true,
      data: {
        id: leave.id,
        status: leave.status,
        reviewedAt: leave.reviewedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[admin-leave] Approve error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to approve leave request",
    });
  }
});

// POST /api/admin/leave/:id/reject — Admin override / reject
router.post("/:id/reject", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { reviewerNotes } = req.body;

    const leave = await rejectLeaveRequest({
      leaveId: req.params.id,
      reviewerId: session.user.id,
      reviewerNotes: reviewerNotes || "Rejected by Administrator.",
    });

    return res.json({
      success: true,
      data: {
        id: leave.id,
        status: leave.status,
        reviewedAt: leave.reviewedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[admin-leave] Reject error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to reject leave request",
    });
  }
});

// DELETE /api/admin/leave/:id — Admin delete / cancel
router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  try {
    const cancelled = await cancelLeaveRequest(req.params.id, undefined, true);

    return res.json({
      success: true,
      data: {
        id: cancelled.id,
        status: cancelled.status,
      },
    });
  } catch (error: any) {
    console.error("[admin-leave] Delete error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to delete leave request",
    });
  }
});

export default router;
