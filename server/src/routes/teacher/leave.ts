
import { Router } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import {
  approveLeaveRequest,
  rejectLeaveRequest,
  holdLeaveRequest,
  createDirectApprovedLeave,
  createDirectFacultyLeave,
  markHolidayLeaveBatch,
  normalizeDateToUTC,
  getDateRangeArray,
} from "../../lib/leave-service";
import { cache } from "../../lib/cache";
import { LeaveStatus, LeaveType } from "@prisma/client";
import { formatLeaveWhatsAppMessage, generateWhatsAppLink } from "../../lib/whatsapp";

const router = Router();

/**
 * A teacher may review a leave when it is assigned to them directly, or when
 * the student belongs to one of their classes (existing class-teacher flow).
 */
async function assertTeacherCanReview(userId: string, leaveId: string) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    select: { id: true, studentId: true, assignedToId: true },
  });
  if (!leave) {
    const err: any = new Error("Leave request not found");
    err.status = 404;
    throw err;
  }
  if (leave.assignedToId === userId) return leave;

  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!teacher) {
    const err: any = new Error("Teacher profile not found");
    err.status = 403;
    throw err;
  }

  // Check if teacher has explicit portal access for leave management or all modules
  const hasPortalLeaveAccess = await prisma.teacherPortalAssignment.findFirst({
    where: {
      teacherId: teacher.id,
      isActive: true,
      portalType: { in: ["ALL", "PAGE:leave"] },
    },
  });
  if (hasPortalLeaveAccess) return leave;

  const inClass = await prisma.classEnrollment.findFirst({
    where: {
      studentId: leave.studentId,
      isActive: true,
      class: {
        isActive: true,
        OR: [{ teacherId: teacher.id }, { masoolId: teacher.id }],
      },
    },
    select: { id: true },
  });

  if (!inClass) {
    const err: any = new Error("This leave request is not assigned to you or your classes");
    err.status = 403;
    throw err;
  }

  return leave;
}

// GET /api/teacher/leave/roster — Roster of students and faculty for manual leave assignment
router.get("/roster", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!teacher) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const teacherClasses = await prisma.class.findMany({
      where: {
        OR: [{ teacherId: teacher.id }, { masoolId: teacher.id }],
        isActive: true,
      },
      select: { id: true, name: true, grade: true, section: true },
    });

    const classIds = teacherClasses.map((c) => c.id);

    const [students, allTeachers] = await Promise.all([
      prisma.studentProfile.findMany({
        where: {
          user: { isActive: true },
          classEnrollments: { some: { classId: { in: classIds }, isActive: true } },
        },
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
        orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
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
        teachers: allTeachers.map((t) => ({
          id: t.id,
          name: `${t.user.firstName} ${t.user.lastName}`.trim(),
          employeeId: t.employeeId || t.user.email,
          its: (t as any).its || t.employeeId || "",
          department: t.department || "Faculty Member",
          avatarUrl: t.user.avatarUrl,
        })),
        classes: teacherClasses,
      },
    });
  } catch (err) {
    console.error("[teacher-leave] Roster error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch roster" });
  }
});

// POST /api/teacher/leave/manual — Record approved manual leave for a student or faculty
router.post("/manual", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const { role = "STUDENT", studentId, teacherId, type = "PERSONAL", startDate, endDate, reason, notes } = req.body;

    if (!startDate || !endDate || !reason?.trim()) {
      return res.status(400).json({ success: false, error: "Dates and reason are required" });
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
        reason: reason.trim(),
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
      reviewerNotes: notes || `Direct manual entry authorized by Teacher (${session.user.firstName} ${session.user.lastName})`,
    });

    return res.json({
      success: true,
      message: "Student leave recorded and approved successfully",
      data: leave,
    });
  } catch (err: any) {
    console.error("[teacher-leave] Manual leave error:", err);
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to record manual leave",
    });
  }
});

// GET /api/teacher/leave/faculty — List faculty leaves for assigned members
router.get("/faculty", requireRole("TEACHER"), async (req, res) => {
  try {
    const exemptions = await prisma.medicalExemption.findMany({
      where: {
        OR: [{ personType: "TEACHER" }, { teacherId: { not: null } }],
      },
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    const teacherRecords = await prisma.teacherAttendanceRecord.findMany({
      where: { status: { in: ["ON_LEAVE", "MEDICAL"] } },
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { date: "desc" },
    });

    const groups: { [key: string]: any } = {};

    for (const ex of exemptions) {
      if (!ex.teacher) continue;
      const isMed = /medical|sick|hospital|health/i.test(ex.eventName || "");
      const leaveType = isMed ? "MEDICAL" : "PERSONAL";
      const cleanedReason = (ex.reason || ex.eventName || "Authorized Leave").trim();
      const groupKey = `${ex.teacherId}_${leaveType}_${cleanedReason.toLowerCase()}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          teacherId: ex.teacherId!,
          teacherName: `${ex.teacher.user.firstName} ${ex.teacher.user.lastName}`.trim(),
          teacherIts: (ex.teacher as any).its || ex.teacher.employeeId || "",
          department: ex.teacher.department || "Faculty Member",
          avatarUrl: ex.teacher.user.avatarUrl,
          type: leaveType,
          reason: cleanedReason,
          dates: [],
          assignedByName: ex.assignedByName || "Administration",
          exemptionIds: [],
          recordIds: [],
        };
      }
      groups[groupKey].dates.push(new Date(ex.date));
      groups[groupKey].exemptionIds.push(ex.id);
    }

    for (const tr of teacherRecords) {
      if (!tr.teacher) continue;
      const isMed = tr.status === "MEDICAL";
      const leaveType = isMed ? "MEDICAL" : "PERSONAL";
      const noteReason =
        (tr.notes || "").replace(/^\[.*?\]\s*/, "").trim() ||
        (isMed ? "Medical Leave" : "Authorized Faculty Leave");
      const groupKey = `${tr.teacherId}_${leaveType}_${noteReason.toLowerCase()}`;

      if (!groups[groupKey]) {
        groups[groupKey] = {
          teacherId: tr.teacherId,
          teacherName: `${tr.teacher.user.firstName} ${tr.teacher.user.lastName}`.trim(),
          teacherIts: (tr.teacher as any).its || tr.teacher.employeeId || "",
          department: tr.teacher.department || "Faculty Member",
          avatarUrl: tr.teacher.user.avatarUrl,
          type: leaveType,
          reason: noteReason,
          dates: [],
          assignedByName: "Administration",
          exemptionIds: [],
          recordIds: [],
        };
      }
      const d = new Date(tr.date);
      const dStr = d.toISOString().slice(0, 10);
      if (!groups[groupKey].dates.some((existing: Date) => existing.toISOString().slice(0, 10) === dStr)) {
        groups[groupKey].dates.push(d);
      }
      groups[groupKey].recordIds.push(tr.id);
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    const list = Object.values(groups).map((g: any) => {
      g.dates.sort((a: Date, b: Date) => a.getTime() - b.getTime());
      const startDate = g.dates[0] ? g.dates[0].toISOString().slice(0, 10) : todayStr;
      const endDate = g.dates[g.dates.length - 1]
        ? g.dates[g.dates.length - 1].toISOString().slice(0, 10)
        : todayStr;
      const isCurrent = todayStr >= startDate && todayStr <= endDate;
      const isUpcoming = todayStr < startDate;
      const itemStatus = isCurrent ? "ACTIVE" : isUpcoming ? "UPCOMING" : "COMPLETED";

      return {
        id: `fac_${g.teacherId}_${startDate}_${endDate}`,
        teacherId: g.teacherId,
        teacherName: g.teacherName,
        teacherIts: g.teacherIts,
        department: g.department,
        avatarUrl: g.avatarUrl,
        type: g.type,
        reason: g.reason,
        startDate,
        endDate,
        dates: g.dates.map((d: Date) => d.toISOString().slice(0, 10)),
        totalDays: g.dates.length,
        assignedByName: g.assignedByName,
        status: itemStatus,
        exemptionIds: g.exemptionIds,
        recordIds: g.recordIds,
      };
    });

    list.sort((a: any, b: any) => (b.startDate > a.startDate ? 1 : -1));

    return res.json({
      success: true,
      data: list,
      stats: {
        active: list.filter((i: any) => i.status === "ACTIVE").length,
        upcoming: list.filter((i: any) => i.status === "UPCOMING").length,
        medical: list.filter((i: any) => i.type === "MEDICAL").length,
        completed: list.filter((i: any) => i.status === "COMPLETED").length,
        total: list.length,
      },
    });
  } catch (err: any) {
    console.error("[teacher-leave] Faculty leaves error:", err);
    return res.status(500).json({ success: false, error: err.message || "Failed to load faculty leaves" });
  }
});

// GET /api/teacher/leave — List leave requests for students enrolled in teacher's classes
router.get("/", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const teacher = await prisma.teacherProfile.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!teacher) {
      return res.status(404).json({ success: false, error: "Teacher profile not found" });
    }

    const { status, type, classId, search } = req.query;
    const page = Math.max(parseInt((req.query.page as string) || "1"), 1);
    const limit = Math.min(Math.max(parseInt((req.query.limit as string) || "25"), 1), 100);
    const skip = (page - 1) * limit;

    // Get all class IDs taught by or assigned to this teacher
    const teacherClasses = await prisma.class.findMany({
      where: {
        OR: [{ teacherId: teacher.id }, { masoolId: teacher.id }],
        isActive: true,
      },
      select: { id: true, name: true, grade: true, section: true },
    });

    const teacherClassIds = teacherClasses.map((c) => c.id);
    const assignedToMe = (req.query.assignedToMe as string) === "true";

    // Filter class IDs if specific class selected
    const targetClassIds = classId && teacherClassIds.includes(classId as string)
      ? [classId as string]
      : teacherClassIds;

    // Get enrolled student IDs
    const enrollments = await prisma.classEnrollment.findMany({
      where: { classId: { in: targetClassIds }, isActive: true },
      select: { studentId: true, class: { select: { id: true, name: true, grade: true, section: true } } },
    });

    const studentIds = Array.from(new Set(enrollments.map((e) => e.studentId)));

    // Check if teacher has explicit portal access for leave management or all modules
    const hasPortalLeaveAccess = await prisma.teacherPortalAssignment.findFirst({
      where: {
        teacherId: teacher.id,
        isActive: true,
        portalType: { in: ["ALL", "PAGE:leave"] },
      },
    });

    // Visibility: requests for the teacher's classes, requests explicitly assigned
    // to this faculty member, or all requests if teacher has leave portal assignment.
    const visibility: any[] = [];
    if (!hasPortalLeaveAccess || classId) {
      if (studentIds.length > 0) visibility.push({ studentId: { in: studentIds } });
      if (!classId) visibility.push({ assignedToId: session.user.id });
      if (visibility.length === 0) visibility.push({ id: "__none__" });
    }

    const baseWhere: any = (!hasPortalLeaveAccess || classId) ? { OR: visibility } : {};
    if (assignedToMe) baseWhere.assignedToId = session.user.id;

    // Build where clause
    const where: any = { ...baseWhere };

    if (status && Object.values(LeaveStatus).includes(status as LeaveStatus)) {
      where.status = status as LeaveStatus;
    }

    if (type && Object.values(LeaveType).includes(type as LeaveType)) {
      where.type = type as LeaveType;
    }

    if (search && typeof search === "string" && search.trim()) {
      const q = search.trim();
      where.student = {
        OR: [
          { user: { firstName: { contains: q, mode: "insensitive" } } },
          { user: { lastName: { contains: q, mode: "insensitive" } } },
          { studentId: { contains: q, mode: "insensitive" } },
          { its: { contains: q, mode: "insensitive" } },
        ],
      };
    }

    // Get counts
    const [total, pendingCount, holdCount, approvedCount, rejectedCount, leaves] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.count({ where: { ...baseWhere, status: LeaveStatus.PENDING } }),
      prisma.leaveRequest.count({ where: { ...baseWhere, status: LeaveStatus.HOLD } }),
      prisma.leaveRequest.count({ where: { ...baseWhere, status: LeaveStatus.APPROVED } }),
      prisma.leaveRequest.count({ where: { ...baseWhere, status: LeaveStatus.REJECTED } }),
      prisma.leaveRequest.findMany({
        where,
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
              parentLinks: {
                include: {
                  parent: {
                    include: {
                      user: { select: { firstName: true, lastName: true } },
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
            select: { firstName: true, lastName: true, role: true },
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, role: true },
          },
          assignedBy: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
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
          total: pendingCount + holdCount + approvedCount + rejectedCount,
        },
        classes: teacherClasses,
        requests: leaves.map((l) => {
          const primaryParent = l.student.parentLinks?.[0]?.parent;
          const parentName = primaryParent?.user
            ? `${primaryParent.user.firstName} ${primaryParent.user.lastName}`.trim()
            : null;
          const parentPhone =
            primaryParent?.phone ||
            primaryParent?.secondaryPhone ||
            l.student.fatherPhone ||
            l.student.motherPhone ||
            l.student.mobileNumber ||
            null;

          const isApproved = l.status === "APPROVED";
          const isReduced = isApproved && l.approvedDays !== null && l.approvedDays !== undefined;
          const waStatus = isApproved
            ? (isReduced ? "APPROVED_REDUCED" : "APPROVED")
            : l.status === "HOLD"
            ? "HOLD"
            : l.status === "REJECTED"
            ? "REJECTED"
            : "APPROVED";

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
                  role: l.assignedTo.role,
                }
              : null,
            assignedToMe: l.assignedToId === session.user.id,
            assignedBy: l.assignedBy
              ? `${l.assignedBy.firstName} ${l.assignedBy.lastName}`.trim()
              : null,
            approvedDays: l.approvedDays,
            grantedStartDate: l.grantedStartDate?.toISOString() || null,
            grantedEndDate: l.grantedEndDate?.toISOString() || null,
            createdAt: l.createdAt.toISOString(),
            parentName,
            parentPhone,
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
    console.error("[teacher-leave] GET error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch student leave requests" });
  }
});

// POST /api/teacher/leave/:id/approve — Approve a leave request
router.post("/:id/approve", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const { reviewerNotes, approvedDays } = req.body;

    await assertTeacherCanReview(session.user.id, req.params.id);

    const leave = await approveLeaveRequest({
      leaveId: req.params.id,
      reviewerId: session.user.id,
      reviewerNotes,
      approvedDays:
        approvedDays === undefined || approvedDays === null || approvedDays === ""
          ? null
          : Number(approvedDays),
    });

    return res.json({
      success: true,
      data: {
        id: leave.id,
        status: leave.status,
        approvedDays: leave.approvedDays,
        grantedStartDate: leave.grantedStartDate?.toISOString() || null,
        grantedEndDate: leave.grantedEndDate?.toISOString() || null,
        reviewedAt: leave.reviewedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[teacher-leave] Approve error:", error);
    return res.status(error.status || 400).json({
      success: false,
      error: error.message || "Failed to approve leave request",
    });
  }
});

// POST /api/teacher/leave/:id/reject — Reject a leave request
router.post("/:id/reject", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const { reviewerNotes } = req.body;

    await assertTeacherCanReview(session.user.id, req.params.id);

    const leave = await rejectLeaveRequest({
      leaveId: req.params.id,
      reviewerId: session.user.id,
      reviewerNotes: reviewerNotes || "Request declined by teacher.",
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
    console.error("[teacher-leave] Reject error:", error);
    return res.status(error.status || 400).json({
      success: false,
      error: error.message || "Failed to reject leave request",
    });
  }
});

// POST /api/teacher/leave/:id/hold — Put a leave request on hold
router.post("/:id/hold", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const { reviewerNotes } = req.body;

    await assertTeacherCanReview(session.user.id, req.params.id);

    const leave = await holdLeaveRequest({
      leaveId: req.params.id,
      reviewerId: session.user.id,
      reviewerNotes: reviewerNotes || "Request placed on hold by reviewer.",
    });

    return res.json({
      success: true,
      data: {
        id: leave.id,
        status: leave.status,
        reviewerNotes: leave.reviewerNotes,
        reviewedAt: leave.reviewedAt?.toISOString(),
      },
    });
  } catch (error: any) {
    console.error("[teacher-leave] Hold error:", error);
    return res.status(error.status || 400).json({
      success: false,
      error: error.message || "Failed to hold leave request",
    });
  }
});

// POST /api/teacher/leave/batch-approve — Batch approve pending student leave requests
router.post("/batch-approve", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const { leaveIds, reviewerNotes } = req.body;

    if (!Array.isArray(leaveIds) || leaveIds.length === 0) {
      return res.status(400).json({ success: false, error: "leaveIds array is required" });
    }

    const results = [];
    for (const id of leaveIds) {
      try {
        await assertTeacherCanReview(session.user.id, id);
        const leave = await approveLeaveRequest({
          leaveId: id,
          reviewerId: session.user.id,
          reviewerNotes: reviewerNotes || "Batch approved by Teacher.",
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
    console.error("[teacher-leave] Batch approve error:", error);
    return res.status(500).json({ success: false, error: "Failed to batch approve leave requests" });
  }
});

// POST /api/teacher/leave/mark-holiday — Mark selected students on Holiday / Leave
router.post("/mark-holiday", requireRole("TEACHER"), async (req, res) => {
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
      reviewerNotes: notes || `Direct holiday authorization by Teacher (${session.user.firstName} ${session.user.lastName})`,
    });

    return res.json({
      success: true,
      message: `Successfully marked ${result.successCount} student(s) on Holiday / Leave`,
      data: result,
    });
  } catch (error: any) {
    console.error("[teacher-leave] Mark holiday error:", error);
    return res.status(400).json({ success: false, error: error?.message || "Failed to mark holiday" });
  }
});

export default router;
