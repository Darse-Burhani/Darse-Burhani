import prisma from "./prisma";
import { cache } from "./cache";
import { LeaveType, LeaveStatus, AttendanceSource, AttendanceStatus } from "@prisma/client";

export interface CreateLeaveInput {
  studentId: string;
  type: LeaveType;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  attachmentUrl?: string | null;
}

export interface ReviewLeaveInput {
  leaveId: string;
  reviewerId?: string;
  reviewerNotes?: string;
}

/**
 * Normalizes a date to UTC start of day (midnight 00:00:00.000)
 */
export function normalizeDateToUTC(dateInput: Date | string): Date {
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/**
 * Helper to get all consecutive UTC calendar dates between start and end inclusive.
 */
export function getDateRangeArray(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = [];
  const curr = new Date(startDate.getTime());
  while (curr <= endDate) {
    dates.push(new Date(curr.getTime()));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Create a new leave request for a student.
 */
export async function createLeaveRequest(input: CreateLeaveInput) {
  const student = await prisma.studentProfile.findUnique({
    where: { id: input.studentId },
    include: { user: true },
  });

  if (!student) {
    throw new Error("Student profile not found");
  }

  const start = normalizeDateToUTC(input.startDate);
  const end = normalizeDateToUTC(input.endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid start or end date");
  }

  if (end < start) {
    throw new Error("End date cannot be earlier than start date");
  }

  // Today normalized (allow submitting for today or future dates)
  const today = normalizeDateToUTC(new Date());
  if (end < today) {
    throw new Error("Cannot submit leave requests for past dates");
  }

  // Check for overlapping active (PENDING or APPROVED) leave requests
  const overlapping = await prisma.leaveRequest.findFirst({
    where: {
      studentId: student.id,
      status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
      OR: [
        {
          startDate: { lte: end },
          endDate: { gte: start },
        },
      ],
    },
  });

  if (overlapping) {
    throw new Error(
      `An overlapping ${overlapping.status.toLowerCase()} leave request already exists for this date range.`
    );
  }

  const leave = await prisma.leaveRequest.create({
    data: {
      studentId: student.id,
      type: input.type,
      startDate: start,
      endDate: end,
      reason: input.reason.trim(),
      attachmentUrl: input.attachmentUrl || null,
      status: LeaveStatus.PENDING,
    },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
      },
    },
  });

  // Create notification for student
  try {
    await prisma.notification.create({
      data: {
        userId: student.userId,
        title: "Leave Request Submitted",
        body: `Your ${input.type.toLowerCase()} leave request (${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}) has been submitted for review.`,
        type: "ANNOUNCEMENT",
        link: "/talabat/leave-request",
        priority: "NORMAL",
      },
    });
  } catch (e) {
    console.error("[leave-service] Notification error:", e);
  }

  cache.invalidateTag("attendanceRecord");
  cache.invalidateTag("dashboard");

  return leave;
}

/**
 * Approves a leave request and automatically populates AttendanceRegistry & AttendanceRecord
 */
export async function approveLeaveRequest(input: ReviewLeaveInput) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: input.leaveId },
    include: {
      student: {
        include: {
          user: true,
          classEnrollments: {
            where: { isActive: true },
            include: { class: true },
          },
        },
      },
    },
  });

  if (!leave) {
    throw new Error("Leave request not found");
  }

  if (leave.status === LeaveStatus.APPROVED) {
    return leave;
  }

  const updatedLeave = await prisma.leaveRequest.update({
    where: { id: leave.id },
    data: {
      status: LeaveStatus.APPROVED,
      reviewerId: input.reviewerId || null,
      reviewerNotes: input.reviewerNotes?.trim() || null,
      reviewedAt: new Date(),
    },
  });

  const dates = getDateRangeArray(leave.startDate, leave.endDate);
  const registryStatus: AttendanceStatus =
    leave.type === LeaveType.MEDICAL ? AttendanceStatus.MEDICAL : AttendanceStatus.ON_LEAVE;
  const registrySource: AttendanceSource =
    leave.type === LeaveType.MEDICAL ? AttendanceSource.MEDICAL_LEAVE : AttendanceSource.LEAVE_APPROVED;

  // Sync AttendanceRegistry for each day in range
  for (const date of dates) {
    await prisma.attendanceRegistry.upsert({
      where: {
        studentId_date: {
          studentId: leave.studentId,
          date,
        },
      },
      create: {
        studentId: leave.studentId,
        date,
        status: registryStatus,
        source: registrySource,
        remarks: `Approved ${leave.type} Leave (${leave.reason.slice(0, 80)})`,
        leaveId: leave.id,
        recordedById: input.reviewerId || "leave-service",
      },
      update: {
        status: registryStatus,
        source: registrySource,
        remarks: `Approved ${leave.type} Leave (${leave.reason.slice(0, 80)})`,
        leaveId: leave.id,
        recordedById: input.reviewerId || "leave-service",
      },
    });

    // Also sync AttendanceRecord for assigned active classes
    const classes = leave.student.classEnrollments.map((e) => e.class);
    for (const c of classes) {
      await prisma.attendanceRecord.upsert({
        where: {
          studentId_classId_date: {
            studentId: leave.studentId,
            classId: c.id,
            date,
          },
        },
        create: {
          studentId: leave.studentId,
          classId: c.id,
          date,
          status: registryStatus,
          source: registrySource,
          verificationMethod: "LEAVE_PORTAL",
          recordedById: input.reviewerId || "leave-service",
          justification: `Approved ${leave.type} Leave: ${leave.reason}`,
          justificationStatus: "APPROVED",
        },
        update: {
          status: registryStatus,
          source: registrySource,
          verificationMethod: "LEAVE_PORTAL",
          recordedById: input.reviewerId || "leave-service",
          justification: `Approved ${leave.type} Leave: ${leave.reason}`,
          justificationStatus: "APPROVED",
        },
      });
    }
  }

  // Notify student
  try {
    await prisma.notification.create({
      data: {
        userId: leave.student.userId,
        title: "Leave Request Approved",
        body: `Your leave request for ${leave.startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${leave.endDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} has been approved.`,
        type: "ALERT",
        link: "/talabat/leave-request",
        priority: "HIGH",
      },
    });
  } catch (e) {
    console.error("[leave-service] Notification error:", e);
  }

  cache.invalidateTag("attendanceRecord");
  cache.invalidateTag("dashboard");
  cache.invalidateTag("stats");

  return updatedLeave;
}

/**
 * Rejects a leave request.
 */
export async function rejectLeaveRequest(input: ReviewLeaveInput) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: input.leaveId },
    include: { student: { include: { user: true } } },
  });

  if (!leave) {
    throw new Error("Leave request not found");
  }

  const updatedLeave = await prisma.leaveRequest.update({
    where: { id: leave.id },
    data: {
      status: LeaveStatus.REJECTED,
      reviewerId: input.reviewerId || null,
      reviewerNotes: input.reviewerNotes?.trim() || "Leave request was not approved.",
      reviewedAt: new Date(),
    },
  });

  // If it had previously generated registry records, clean them up or update remarks
  await prisma.attendanceRegistry.deleteMany({
    where: { leaveId: leave.id },
  });

  // Notify student
  try {
    await prisma.notification.create({
      data: {
        userId: leave.student.userId,
        title: "Leave Request Rejected",
        body: `Your leave request was rejected.${input.reviewerNotes ? ` Note: ${input.reviewerNotes}` : ""}`,
        type: "ALERT",
        link: "/talabat/leave-request",
        priority: "HIGH",
      },
    });
  } catch (e) {
    console.error("[leave-service] Notification error:", e);
  }

  cache.invalidateTag("attendanceRecord");
  cache.invalidateTag("dashboard");

  return updatedLeave;
}

/**
 * Cancels a leave request (by student if pending, or by admin).
 */
export async function cancelLeaveRequest(leaveId: string, studentId?: string, isAdmin: boolean = false) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { student: true },
  });

  if (!leave) {
    throw new Error("Leave request not found");
  }

  if (!isAdmin && studentId && leave.studentId !== studentId) {
    throw new Error("Unauthorized to cancel this leave request");
  }

  if (!isAdmin && leave.status !== LeaveStatus.PENDING) {
    throw new Error("Only pending leave requests can be cancelled by students");
  }

  const updatedLeave = await prisma.leaveRequest.update({
    where: { id: leaveId },
    data: {
      status: LeaveStatus.CANCELLED,
    },
  });

  // Remove any associated attendance registry records
  await prisma.attendanceRegistry.deleteMany({
    where: { leaveId: leave.id },
  });

  cache.invalidateTag("attendanceRecord");
  cache.invalidateTag("dashboard");

  return updatedLeave;
}

/**
 * Checks if a student has an approved leave for a specific date.
 */
export async function checkStudentOnLeave(studentId: string, targetDate: Date) {
  const day = normalizeDateToUTC(targetDate);
  return prisma.leaveRequest.findFirst({
    where: {
      studentId,
      status: LeaveStatus.APPROVED,
      startDate: { lte: day },
      endDate: { gte: day },
    },
  });
}

/**
 * Fetch summary stats for a student's leaves.
 */
export async function getStudentLeaveSummary(studentId: string) {
  const leaves = await prisma.leaveRequest.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
  });

  const totalRequests = leaves.length;
  const pendingCount = leaves.filter((l) => l.status === LeaveStatus.PENDING).length;
  const approvedCount = leaves.filter((l) => l.status === LeaveStatus.APPROVED).length;
  const rejectedCount = leaves.filter((l) => l.status === LeaveStatus.REJECTED).length;

  let approvedDays = 0;
  let medicalDays = 0;

  for (const l of leaves) {
    if (l.status === LeaveStatus.APPROVED) {
      const days = Math.round((l.endDate.getTime() - l.startDate.getTime()) / 86400000) + 1;
      approvedDays += days;
      if (l.type === LeaveType.MEDICAL) {
        medicalDays += days;
      }
    }
  }

  return {
    totalRequests,
    pendingCount,
    approvedCount,
    rejectedCount,
    approvedDays,
    medicalDays,
    leaves,
  };
}
