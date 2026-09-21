
import { Router, Request, Response } from "express";
import prisma from "../../lib/prisma";
import { requireRole } from "../../middleware";
import { approveLeaveRequest, rejectLeaveRequest, createDirectApprovedLeave } from "../../lib/leave-service";
import { LeaveStatus, LeaveType } from "@prisma/client";

const router = Router();

// GET /api/teacher/leave/roster — Roster of students in teacher's assigned classes
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

    const students = await prisma.studentProfile.findMany({
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
    });

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
        classes: teacherClasses,
      },
    });
  } catch (err) {
    console.error("[teacher-leave] Roster error:", err);
    return res.status(500).json({ success: false, error: "Failed to fetch student roster" });
  }
});

// POST /api/teacher/leave/manual — Record approved manual leave for a student
router.post("/manual", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const { studentId, type = "PERSONAL", startDate, endDate, reason, notes } = req.body;

    if (!studentId || !startDate || !endDate || !reason?.trim()) {
      return res.status(400).json({ success: false, error: "Student, dates, and reason are required" });
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

    if (teacherClassIds.length === 0) {
      return res.json({
        success: true,
        data: {
          requests: [],
          stats: { pending: 0, approved: 0, rejected: 0, total: 0 },
          classes: [],
          pagination: { page, limit, total: 0, totalPages: 0 },
        },
      });
    }

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

    if (studentIds.length === 0) {
      return res.json({
        success: true,
        data: {
          requests: [],
          stats: { pending: 0, approved: 0, rejected: 0, total: 0 },
          classes: teacherClasses,
          pagination: { page, limit, total: 0, totalPages: 0 },
        },
      });
    }

    // Build where clause
    const where: any = {
      studentId: { in: studentIds },
    };

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
    const [total, pendingCount, approvedCount, rejectedCount, leaves] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.count({ where: { studentId: { in: studentIds }, status: LeaveStatus.PENDING } }),
      prisma.leaveRequest.count({ where: { studentId: { in: studentIds }, status: LeaveStatus.APPROVED } }),
      prisma.leaveRequest.count({ where: { studentId: { in: studentIds }, status: LeaveStatus.REJECTED } }),
      prisma.leaveRequest.findMany({
        where,
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true, avatarUrl: true, email: true } },
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
          approved: approvedCount,
          rejected: rejectedCount,
          total: pendingCount + approvedCount + rejectedCount,
        },
        classes: teacherClasses,
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
    console.error("[teacher-leave] GET error:", error);
    return res.status(500).json({ success: false, error: "Failed to fetch student leave requests" });
  }
});

// POST /api/teacher/leave/:id/approve — Approve a leave request
router.post("/:id/approve", requireRole("TEACHER"), async (req, res) => {
  try {
    const session = req.auth!;
    const { reviewerNotes } = req.body;

    const leave = await approveLeaveRequest({
      leaveId: req.params.id,
      reviewerId: session.user.id,
      reviewerNotes,
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
    console.error("[teacher-leave] Approve error:", error);
    return res.status(400).json({
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
    return res.status(400).json({
      success: false,
      error: error.message || "Failed to reject leave request",
    });
  }
});

export default router;
