import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
  createDirectApprovedLeave,
  createDirectFacultyLeave,
} from "../../lib/leave-service";
import { LeaveStatus, LeaveType } from "@prisma/client";

const router = Router();

// GET /api/admin/leave/roster — Searchable roster for manual leave assignment
router.get("/roster", requireRole("ADMIN"), async (req, res) => {
  try {
    const [students, teachers] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { user: { isActive: true } },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          classEnrollments: {
            where: { isActive: true },
            include: { class: { select: { id: true, name: true, grade: true, section: true } } },
            take: 1,
          },
        },
        orderBy: [{ grade: "asc" }, { section: "asc" }, { studentId: "asc" }],
      }),
      prisma.teacherProfile.findMany({
        where: { user: { isActive: true } },
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
        orderBy: { employeeId: "asc" },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        students: students.map((s) => ({
          id: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`.trim(),
          studentId: s.studentId,
          its: s.its || s.studentId,
          grade: s.grade,
          section: s.section,
          className: s.classEnrollments[0]?.class?.name || `Grade ${s.grade}-${s.section}`,
          avatarUrl: s.user.avatarUrl,
        })),
        teachers: teachers.map((t) => ({
          id: t.id,
          name: `${t.user.firstName} ${t.user.lastName}`.trim(),
          employeeId: t.employeeId,
          department: t.department,
          avatarUrl: t.user.avatarUrl,
        })),
      },
    });
  } catch (err) {
    console.error("[admin-leave] Roster error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch roster" });
  }
});

// POST /api/admin/leave/manual — Record direct approved manual leave for Student or Faculty
router.post("/manual", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { role = "STUDENT", studentId, teacherId, type = "PERSONAL", startDate, endDate, reason, notes } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "Start date and end date are required" });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, error: "Leave reason is required" });
    }

    if (role === "TEACHER") {
      if (!teacherId) {
        return res.status(400).json({ success: false, error: "Faculty member selection is required" });
      }

      const result = await createDirectFacultyLeave({
        teacherId,
        type,
        startDate,
        endDate,
        reason,
        assignedById: session.user.id,
        assignedByName: `${session.user.firstName} ${session.user.lastName}`.trim(),
      });

      return res.json({
        success: true,
        message: "Faculty leave recorded and approved successfully",
        data: result,
      });
    }

    // Default: STUDENT
    if (!studentId) {
      return res.status(400).json({ success: false, error: "Student selection is required" });
    }

    const leave = await createDirectApprovedLeave({
      studentId,
      type: (type as LeaveType) || LeaveType.PERSONAL,
      startDate,
      endDate,
      reason,
      reviewerId: session.user.id,
      reviewerNotes: notes || "Direct manual entry authorized by Administrator",
    });

    return res.json({
      success: true,
      message: "Student leave recorded and approved successfully",
      data: leave,
    });
  } catch (err: any) {
    console.error("[admin-leave] Manual leave error:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to create manual leave",
    });
  }
});

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
