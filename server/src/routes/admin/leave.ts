import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  holdLeaveRequest,
  cancelLeaveRequest,
  createDirectApprovedLeave,
  createDirectFacultyLeave,
  markHolidayLeaveBatch,
  assignLeaveRequest,
  unassignLeaveRequest,
  notifyParentLeaveAction,
  getStudentParentPhones,
  getParentContacts,
} from "../../lib/leave-service";
import { LeaveStatus, LeaveType } from "@prisma/client";
import { formatLeaveWhatsAppMessage, generateWhatsAppLink } from "../../lib/whatsapp";
import { getSmtpConfigStatus, testLeaveSmtpConnection, sendTestLeaveEmail } from "../../lib/email";

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

// GET /api/admin/leave/members — Faculty members with portal access who can review assigned leaves
router.get("/members", requireRole("ADMIN"), async (_req, res) => {
  try {
    const members = await prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        role: "TEACHER",
        teacherProfile: { isNot: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
        role: true,
        teacherProfile: {
          select: { employeeId: true, department: true, roleTitle: true },
        },
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return res.json({
      success: true,
      data: members.map((member) => ({
        id: member.id,
        name: `${member.firstName} ${member.lastName}`.trim(),
        email: member.email,
        avatarUrl: member.avatarUrl,
        role: member.role,
        employeeId: member.teacherProfile?.employeeId || null,
        department: member.teacherProfile?.department || null,
        roleTitle: member.teacherProfile?.roleTitle || null,
      })),
    });
  } catch (err) {
    console.error("[admin-leave] Members error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch portal members" });
  }
});

// POST /api/admin/leave/:id/assign — Assign a pending leave to a faculty member
router.post("/:id/assign", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { memberId } = req.body;
    if (!memberId || typeof memberId !== "string") {
      return res.status(400).json({ success: false, error: "Select a portal member to assign" });
    }

    const leave = await assignLeaveRequest({
      leaveId: req.params.id,
      assigneeId: memberId,
      assignedById: session.user.id,
    });

    return res.json({
      success: true,
      message: "Leave application assigned successfully",
      data: {
        id: leave.id,
        assignedTo: leave.assignedTo
          ? {
              id: leave.assignedTo.id,
              name: `${leave.assignedTo.firstName} ${leave.assignedTo.lastName}`.trim(),
              email: leave.assignedTo.email,
            }
          : null,
        assignedAt: leave.assignedAt?.toISOString() || null,
      },
    });
  } catch (error: any) {
    console.error("[admin-leave] Assign error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to assign leave application",
    });
  }
});

// DELETE /api/admin/leave/:id/assign — Remove the faculty assignment
router.delete("/:id/assign", requireRole("ADMIN"), async (req, res) => {
  try {
    const leave = await unassignLeaveRequest(req.params.id);
    return res.json({ success: true, data: { id: leave.id, assignedTo: null } });
  } catch (error: any) {
    console.error("[admin-leave] Unassign error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to remove assignment",
    });
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

    const [total, pendingCount, holdCount, approvedCount, rejectedCount, medicalCount, leaves, grades] =
      await Promise.all([
        prisma.leaveRequest.count({ where }),
        prisma.leaveRequest.count({ where: { status: LeaveStatus.PENDING } }),
        prisma.leaveRequest.count({ where: { status: LeaveStatus.HOLD } }),
        prisma.leaveRequest.count({ where: { status: LeaveStatus.APPROVED } }),
        prisma.leaveRequest.count({ where: { status: LeaveStatus.REJECTED } }),
        prisma.leaveRequest.count({ where: { type: LeaveType.MEDICAL, status: LeaveStatus.APPROVED } }),
        prisma.leaveRequest.findMany({
          where,
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
                parentLinks: {
                  include: {
                    parent: {
                      include: {
                        user: { select: { firstName: true, lastName: true, email: true } },
                      },
                    },
                  },
                  take: 1,
                },
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
            assignedTo: {
              select: { id: true, firstName: true, lastName: true, role: true, email: true },
            },
            assignedBy: {
              select: { id: true, firstName: true, lastName: true },
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
          hold: holdCount,
          approved: approvedCount,
          rejected: rejectedCount,
          medical: medicalCount,
          total: pendingCount + holdCount + approvedCount + rejectedCount,
        },
        gradesSections: grades,
        requests: leaves.map((l) => {
          const primaryParent = l.student.parentLinks?.[0]?.parent;
          const parentName = primaryParent?.user
            ? `${primaryParent.user.firstName} ${primaryParent.user.lastName}`.trim()
            : l.student.fatherName || l.student.motherName || null;
          const parentPhone =
            primaryParent?.phone ||
            primaryParent?.secondaryPhone ||
            l.student.fatherPhone ||
            l.student.motherPhone ||
            l.student.mobileNumber ||
            null;
          const parentEmail =
            primaryParent?.user?.email ||
            l.student.fatherEmail ||
            l.student.motherEmail ||
            null;

          const isApproved = l.status === "APPROVED";
          const isReduced = isApproved && l.approvedDays !== null && l.approvedDays !== undefined;
          const waStatus = isApproved
            ? (isReduced ? "APPROVED_REDUCED" : "APPROVED")
            : l.status === "HOLD"
            ? "HOLD"
            : l.status === "REJECTED"
            ? "REJECTED"
            : "PENDING";

          const waMessage = formatLeaveWhatsAppMessage({
            parentName,
            studentName: `${l.student.user.firstName} ${l.student.user.lastName}`.trim(),
            className: l.student.classEnrollments[0]?.class?.name || `Grade ${l.student.grade}-${l.student.section}`,
            status: waStatus,
            leaveType: l.type,
            startDate: (l.grantedStartDate || l.startDate).toISOString().split("T")[0],
            endDate: (l.grantedEndDate || l.endDate).toISOString().split("T")[0],
            approvedDays: l.approvedDays || undefined,
            reviewerNotes: l.reviewerNotes,
            reviewerName: l.reviewer ? `${l.reviewer.firstName} ${l.reviewer.lastName}` : null,
          });

          const whatsAppUrl = parentPhone ? generateWhatsAppLink(parentPhone, waMessage) : null;

          return {
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
            assignedTo: l.assignedTo
              ? {
                  id: l.assignedTo.id,
                  name: `${l.assignedTo.firstName} ${l.assignedTo.lastName}`.trim(),
                  email: l.assignedTo.email,
                  role: l.assignedTo.role,
                }
              : null,
            assignedBy: l.assignedBy
              ? `${l.assignedBy.firstName} ${l.assignedBy.lastName}`.trim()
              : null,
            assignedAt: l.assignedAt?.toISOString() || null,
            approvedDays: l.approvedDays,
            grantedStartDate: l.grantedStartDate?.toISOString() || null,
            grantedEndDate: l.grantedEndDate?.toISOString() || null,
            createdAt: l.createdAt.toISOString(),
            parentName,
            parentPhone,
            parentEmail,
            whatsAppUrl,
          };
        }),
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
    const { reviewerNotes, approvedDays, startDate, endDate } = req.body;

    const leave = await approveLeaveRequest({
      leaveId: req.params.id,
      reviewerId: session.user.id,
      reviewerNotes: reviewerNotes || "Approved by Administrator.",
      approvedDays:
        approvedDays === undefined || approvedDays === null || approvedDays === ""
          ? null
          : Number(approvedDays),
      startDate: startDate || null,
      endDate: endDate || null,
    });

    const [parentPhones, parentContacts] = await Promise.all([
      getStudentParentPhones(leave.studentId),
      getParentContacts(leave.studentId),
    ]);
    const primaryPhone = parentPhones[0]?.phone || null;
    const primaryEmail = parentContacts[0]?.email || null;
    const isReduced = leave.approvedDays !== null && leave.approvedDays !== undefined;
    const waMsg = formatLeaveWhatsAppMessage({
      parentName: parentPhones[0]?.name,
      studentName: `${(leave as any).student?.user?.firstName || "Student"} ${(leave as any).student?.user?.lastName || ""}`.trim(),
      className: (leave as any).student?.classEnrollments?.[0]?.class?.name || null,
      status: isReduced ? "APPROVED_REDUCED" : "APPROVED",
      leaveType: leave.type,
      startDate: (leave.grantedStartDate || leave.startDate).toISOString().split("T")[0],
      endDate: (leave.grantedEndDate || leave.endDate).toISOString().split("T")[0],
      approvedDays: leave.approvedDays || undefined,
      reviewerNotes: leave.reviewerNotes,
      reviewerName: `${session.user.firstName} ${session.user.lastName}`.trim(),
    });
    const whatsAppUrl = primaryPhone ? generateWhatsAppLink(primaryPhone, waMsg) : null;

    return res.json({
      success: true,
      data: {
        id: leave.id,
        status: leave.status,
        approvedDays: leave.approvedDays,
        grantedStartDate: leave.grantedStartDate?.toISOString() || null,
        grantedEndDate: leave.grantedEndDate?.toISOString() || null,
        reviewedAt: leave.reviewedAt?.toISOString(),
        parentPhone: primaryPhone,
        parentEmail: primaryEmail,
        whatsAppUrl,
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

    const [parentPhones, parentContacts] = await Promise.all([
      getStudentParentPhones(leave.studentId),
      getParentContacts(leave.studentId),
    ]);
    const primaryPhone = parentPhones[0]?.phone || null;
    const primaryEmail = parentContacts[0]?.email || null;
    const waMsg = formatLeaveWhatsAppMessage({
      parentName: parentPhones[0]?.name,
      studentName: `${(leave as any).student?.user?.firstName || "Student"} ${(leave as any).student?.user?.lastName || ""}`.trim(),
      className: (leave as any).student?.classEnrollments?.[0]?.class?.name || null,
      status: "REJECTED",
      leaveType: leave.type,
      startDate: leave.startDate.toISOString().split("T")[0],
      endDate: leave.endDate.toISOString().split("T")[0],
      reviewerNotes: leave.reviewerNotes,
      reviewerName: `${session.user.firstName} ${session.user.lastName}`.trim(),
    });
    const whatsAppUrl = primaryPhone ? generateWhatsAppLink(primaryPhone, waMsg) : null;

    return res.json({
      success: true,
      data: {
        id: leave.id,
        status: leave.status,
        reviewedAt: leave.reviewedAt?.toISOString(),
        parentPhone: primaryPhone,
        parentEmail: primaryEmail,
        whatsAppUrl,
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

// POST /api/admin/leave/:id/hold — Put leave request on hold
router.post("/:id/hold", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { reviewerNotes, startDate, endDate } = req.body;

    const leave = await holdLeaveRequest({
      leaveId: req.params.id,
      reviewerId: session.user.id,
      reviewerNotes: reviewerNotes || "Placed on hold pending administrative review.",
      startDate: startDate || null,
      endDate: endDate || null,
    });

    const [parentPhones, parentContacts] = await Promise.all([
      getStudentParentPhones(leave.studentId),
      getParentContacts(leave.studentId),
    ]);
    const primaryPhone = parentPhones[0]?.phone || null;
    const primaryEmail = parentContacts[0]?.email || null;
    const waMsg = formatLeaveWhatsAppMessage({
      parentName: parentPhones[0]?.name,
      studentName: `${(leave as any).student?.user?.firstName || "Student"} ${(leave as any).student?.user?.lastName || ""}`.trim(),
      className: (leave as any).student?.classEnrollments?.[0]?.class?.name || null,
      status: "HOLD",
      leaveType: leave.type,
      startDate: leave.startDate.toISOString().split("T")[0],
      endDate: leave.endDate.toISOString().split("T")[0],
      reviewerNotes: leave.reviewerNotes,
      reviewerName: `${session.user.firstName} ${session.user.lastName}`.trim(),
    });
    const whatsAppUrl = primaryPhone ? generateWhatsAppLink(primaryPhone, waMsg) : null;

    return res.json({
      success: true,
      message: "Leave request placed on hold",
      data: {
        id: leave.id,
        status: leave.status,
        reviewerNotes: leave.reviewerNotes,
        reviewedAt: leave.reviewedAt?.toISOString(),
        parentPhone: primaryPhone,
        parentEmail: primaryEmail,
        whatsAppUrl,
      },
    });
  } catch (error: any) {
    console.error("[admin-leave] Hold error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to put leave request on hold",
    });
  }
});

// PATCH /api/admin/leave/:id/dates — Update leave start and end dates directly
router.patch("/:id/dates", requireRole("ADMIN"), async (req, res) => {
  try {
    const { startDate, endDate, notes } = req.body;
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "Both startDate and endDate are required" });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      return res.status(400).json({ success: false, error: "Invalid date range: start date must be before or equal to end date" });
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: req.params.id },
      include: { student: { include: { user: true } } },
    });
    if (!leave) {
      return res.status(404).json({ success: false, error: "Leave request not found" });
    }

    // If leave was already approved, re-run approveLeaveRequest to synchronize attendance records and days granted
    if (leave.status === LeaveStatus.APPROVED) {
      const authedReq = req as any;
      const reviewerId = authedReq.auth?.user?.id || null;
      const updated = await approveLeaveRequest({
        leaveId: leave.id,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        reviewerNotes: notes || leave.reviewerNotes || undefined,
        reviewerId,
      });

      return res.json({
        success: true,
        message: "Leave dates and attendance synchronized successfully",
        data: {
          id: updated.id,
          startDate: updated.startDate.toISOString(),
          endDate: updated.endDate.toISOString(),
          grantedStartDate: updated.grantedStartDate?.toISOString(),
          grantedEndDate: updated.grantedEndDate?.toISOString(),
          approvedDays: updated.approvedDays,
          status: updated.status,
        },
      });
    }

    // For non-approved leaves (PENDING / HOLD), update the requested dates directly
    const updated = await prisma.leaveRequest.update({
      where: { id: req.params.id },
      data: {
        startDate: start,
        endDate: end,
        ...(notes ? { reviewerNotes: notes } : {}),
      },
    });

    return res.json({
      success: true,
      message: "Leave dates updated successfully",
      data: {
        id: updated.id,
        startDate: updated.startDate.toISOString(),
        endDate: updated.endDate.toISOString(),
        status: updated.status,
      },
    });
  } catch (error: any) {
    console.error("[admin-leave] Update dates error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to update leave dates",
    });
  }
});

// POST /api/admin/leave/:id/notify-parent — Trigger on-demand parent notice (Email / WhatsApp / Both)
router.post("/:id/notify-parent", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { channel = "BOTH", customMessage } = req.body;

    const result = await notifyParentLeaveAction({
      leaveId: req.params.id,
      channel: channel as "EMAIL" | "WHATSAPP" | "BOTH",
      customMessage: typeof customMessage === "string" ? customMessage : undefined,
      senderId: session.user.id,
    });

    return res.json({
      success: true,
      message: result.message || "Parent notification dispatched successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("[admin-leave] Notify parent error:", error);
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to notify parent",
    });
  }
});

// POST /api/admin/leave/batch-approve — 1-Click Approve multiple pending leave requests
router.post("/batch-approve", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { leaveIds, reviewerNotes } = req.body;

    if (!Array.isArray(leaveIds) || leaveIds.length === 0) {
      return res.status(400).json({ success: false, error: "leaveIds array is required" });
    }

    const results = [];
    for (const id of leaveIds) {
      try {
        const leave = await approveLeaveRequest({
          leaveId: id,
          reviewerId: session.user.id,
          reviewerNotes: reviewerNotes || "Batch approved by Administrator.",
        });
        results.push({ id, success: true, status: leave.status });
      } catch (err: any) {
        results.push({ id, success: false, error: err?.message });
      }
    }

    return res.json({
      success: true,
      message: `Processed ${results.filter((r) => r.success).length} of ${leaveIds.length} leave approvals`,
      data: {
        total: leaveIds.length,
        approvedCount: results.filter((r) => r.success).length,
        results,
      },
    });
  } catch (error: any) {
    console.error("[admin-leave] Batch approve error:", error);
    return res.status(500).json({ success: false, error: "Failed to batch approve leave requests" });
  }
});

// POST /api/admin/leave/mark-holiday — 1-Click Mark applied / selected students on Holiday / Leave
router.post("/mark-holiday", requireRole("ADMIN"), async (req, res) => {
  try {
    const session = req.auth!;
    const { studentIds, startDate, endDate, reason, type = "PERSONAL", notes } = req.body;

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({ success: false, error: "At least one student must be selected" });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ success: false, error: "Start date and end date are required" });
    }

    const result = await markHolidayLeaveBatch({
      studentIds,
      type: type as LeaveType,
      startDate,
      endDate,
      reason: reason || "Approved Holiday / Leave",
      reviewerId: session.user.id,
      reviewerNotes: notes || "Direct holiday authorization by Administrator",
    });

    return res.json({
      success: true,
      message: `Successfully marked ${result.successCount} student(s) on Holiday / Leave`,
      data: result,
    });
  } catch (error: any) {
    console.error("[admin-leave] Mark holiday error:", error);
    return res.status(400).json({ success: false, error: error?.message || "Failed to mark holiday" });
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

// GET /api/admin/leave/smtp-status — Live email configuration & connectivity status
router.get("/smtp-status", requireRole("ADMIN"), async (_req, res) => {
  try {
    const config = getSmtpConfigStatus();
    const live = await testLeaveSmtpConnection();
    return res.json({
      success: true,
      data: {
        config,
        live,
      },
    });
  } catch (err: any) {
    console.error("[admin-leave] SMTP status error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Failed to check SMTP status" });
  }
});

// POST /api/admin/leave/test-email — Dispatch a real test leave notification email
router.post("/test-email", requireRole("ADMIN"), async (req, res) => {
  try {
    const target = typeof req.body?.to === "string" ? req.body.to.trim() : undefined;
    const result = await sendTestLeaveEmail(target);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || "Failed to send test email",
        data: result,
      });
    }
    return res.json({
      success: true,
      message: `Test email dispatched successfully to ${result.to}`,
      data: result,
    });
  } catch (err: any) {
    console.error("[admin-leave] Test email error:", err);
    return res.status(500).json({ success: false, error: err?.message || "Internal error sending test email" });
  }
});

export default router;
