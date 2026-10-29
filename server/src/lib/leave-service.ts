import prisma from "./prisma";
import { cache } from "./cache";
import { queueAutoSheetSync } from "./google-attendance-sync";
import { sendLeaveEmail } from "./email";
import {
  leaveApplicationAdminEmail,
  leaveDecisionParentEmail,
} from "./leave-email-templates";
import { sendPushToUser, sendPushToUsers } from "./push";
import { LeaveType, LeaveStatus, AttendanceSource, AttendanceStatus } from "@prisma/client";
import {
  formatLeaveWhatsAppMessage,
  dispatchWhatsAppNotification,
  formatWhatsAppPhone,
  generateWhatsAppLink,
} from "./whatsapp";

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
  /** Number of days granted from the requested start date. Omit for the full range. */
  approvedDays?: number | null;
}

export interface AssignLeaveInput {
  leaveId: string;
  assigneeId: string;
  assignedById: string;
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

/** Inclusive number of calendar days between two dates. */
export function countLeaveDays(startDate: Date, endDate: Date): number {
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatUtcDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4000").replace(/\/$/, "");
  return `${base}${path}`;
}

async function getParentContacts(studentId: string) {
  const links = await prisma.parentStudentLink.findMany({
    where: { studentId },
    include: {
      parent: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  return links
    .map((link) => ({
      userId: link.parent.user.id,
      name: `${link.parent.user.firstName} ${link.parent.user.lastName}`.trim(),
      email: link.parent.user.email,
      isActive: link.parent.user.isActive,
    }))
    .filter((contact) => !!contact.email);
}

export async function getStudentParentPhones(studentId: string): Promise<Array<{ name: string; phone: string; relationship?: string }>> {
  const [links, student] = await Promise.all([
    prisma.parentStudentLink.findMany({
      where: { studentId },
      include: {
        parent: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: {
        fatherPhone: true,
        motherPhone: true,
        mobileNumber: true,
        user: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  const results: Array<{ name: string; phone: string; relationship?: string }> = [];
  const seenPhones = new Set<string>();

  const addPhone = (name: string, rawPhone?: string | null, rel?: string) => {
    if (!rawPhone) return;
    const clean = formatWhatsAppPhone(rawPhone);
    if (clean && !seenPhones.has(clean)) {
      seenPhones.add(clean);
      results.push({ name, phone: clean, relationship: rel });
    }
  };

  for (const link of links) {
    const parentName = `${link.parent.user.firstName} ${link.parent.user.lastName}`.trim();
    addPhone(parentName, link.parent.phone, link.relationship || "Parent");
    addPhone(parentName, link.parent.secondaryPhone, link.relationship || "Parent");
  }

  if (student) {
    const studentName = `${student.user.firstName} ${student.user.lastName}`.trim();
    addPhone(`Father of ${studentName}`, student.fatherPhone, "Father");
    addPhone(`Mother of ${studentName}`, student.motherPhone, "Mother");
    addPhone(`Guardian`, student.mobileNumber, "Guardian");
  }

  return results;
}

async function notifyAdmins(title: string, body: string, link: string = "/admin/leave") {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          title,
          body,
          type: "ALERT",
          link,
          priority: "HIGH",
        })),
      });
    }
    return admins.map((admin) => admin.id);
  } catch (err) {
    console.error("[leave-service] Failed to notify admins:", err);
    return [];
  }
}

async function notifyParents(studentId: string, title: string, body: string, link: string = "/parent") {
  try {
    const links = await prisma.parentStudentLink.findMany({
      where: { studentId },
      include: { parent: { select: { userId: true } } },
    });
    const parentUserIds = Array.from(new Set(links.map((l) => l.parent.userId).filter(Boolean)));
    if (parentUserIds.length > 0) {
      await prisma.notification.createMany({
        data: parentUserIds.map((userId) => ({
          userId,
          title,
          body,
          type: "ALERT",
          link,
          priority: "HIGH",
        })),
      });
    }
    return parentUserIds;
  } catch (err) {
    console.error("[leave-service] Failed to notify parents:", err);
    return [];
  }
}

/**
 * Create a new leave request for a student.
 */
export async function createLeaveRequest(input: CreateLeaveInput) {
  const student = await prisma.studentProfile.findUnique({
    where: { id: input.studentId },
    include: {
      user: true,
      classEnrollments: {
        where: { isActive: true },
        include: {
          class: {
            include: {
              teacher: { include: { user: true } },
              masool: { include: { user: true } },
            },
          },
        },
        take: 1,
      },
    },
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

  // Identify assigned portal access member (Class Teacher / Masool / Portal Member)
  let assignedMemberUser: { id: string; email: string; firstName: string; lastName: string } | null = null;
  const enrolledClass = student.classEnrollments[0]?.class;
  const classTeacherUser = enrolledClass?.teacher?.user;
  const classMasoolUser = enrolledClass?.masool?.user;

  if (classTeacherUser && classTeacherUser.isActive) {
    assignedMemberUser = classTeacherUser;
  } else if (classMasoolUser && classMasoolUser.isActive) {
    assignedMemberUser = classMasoolUser;
  } else {
    // Check if any teacher is assigned portal access for LEAVE
    const leavePortalMember = await prisma.teacherPortalAssignment.findFirst({
      where: {
        isActive: true,
        portalType: { in: ["ALL", "PAGE:leave"] },
        teacher: { user: { isActive: true } },
      },
      include: {
        teacher: { include: { user: true } },
      },
    });
    if (leavePortalMember?.teacher?.user) {
      assignedMemberUser = leavePortalMember.teacher.user;
    }
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
      assignedToId: assignedMemberUser?.id || null,
      assignedAt: assignedMemberUser ? new Date() : null,
    },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
      },
      assignedTo: {
        select: { id: true, firstName: true, lastName: true, email: true, role: true },
      },
    },
  });

  // Create notification for student
  try {
    await prisma.notification.create({
      data: {
        userId: student.userId,
        title: "Leave Request Submitted",
        body: `Your ${input.type.toLowerCase()} leave request (${formatUtcDate(start)} - ${formatUtcDate(end)}) has been submitted for review.`,
        type: "ANNOUNCEMENT",
        link: "/talabat/leave-request",
        priority: "NORMAL",
      },
    });
  } catch (e) {
    console.error("[leave-service] Notification error:", e);
  }

  // Notify School Administration (in-app + desktop push)
  const studentFullName = `${student.user.firstName} ${student.user.lastName}`.trim();
  const requestedDays = countLeaveDays(start, end);
  const dateRangeStr = `${formatUtcDate(start)} – ${formatUtcDate(end)}`;
  const parentContacts = await getParentContacts(student.id);
  const primaryParent = parentContacts[0];
  const assignedMemberName = assignedMemberUser
    ? `${assignedMemberUser.firstName} ${assignedMemberUser.lastName}`.trim()
    : null;

  const adminIds = await notifyAdmins(
    "New Leave Application",
    `${studentFullName} applied for ${input.type.toLowerCase().replace(/_/g, " ")} leave (${dateRangeStr}, ${requestedDays} ${requestedDays === 1 ? "day" : "days"}).`,
    "/admin/leave"
  );

  await sendPushToUsers(adminIds, {
    title: "New Leave Application",
    body: `${studentFullName} · ${requestedDays} ${requestedDays === 1 ? "day" : "days"} · ${dateRangeStr}`,
    url: "/admin/leave",
    tag: `leave-admin-${leave.id}`,
  });

  // Email the Galiakot administration mailbox with the full application layout.
  try {
    const adminEmailTo = process.env.LEAVE_ADMIN_EMAIL || "admin.galiakot@darseburhani.org";
    const emailSent = await sendLeaveEmail({
      to: adminEmailTo,
      subject: `New Leave Application — ${studentFullName} (${requestedDays} ${requestedDays === 1 ? "day" : "days"})`,
      html: leaveApplicationAdminEmail({
        leaveId: leave.id,
        studentName: studentFullName,
        its: student.its || student.studentId,
        grade: student.grade,
        section: student.section,
        className: student.classEnrollments[0]?.class?.name || null,
        parentName: primaryParent?.name || null,
        parentEmail: primaryParent?.email || null,
        type: input.type,
        startDate: formatUtcDate(start),
        endDate: formatUtcDate(end),
        days: requestedDays,
        reason: input.reason.trim(),
        attachmentUrl: input.attachmentUrl || null,
        submittedAt: formatDateTime(leave.createdAt),
        adminUrl: appUrl("/admin/leave"),
        isAssignedMember: false,
        assignedMemberName,
      }),
    });
    if (!emailSent) {
      console.warn(`[leave-service] Admin leave email could not be delivered for ${leave.id}`);
    }
  } catch (err) {
    console.error("[leave-service] Admin leave email error:", err);
  }

  // Notify and email the Assigned Portal Access Member (Faculty member)
  if (assignedMemberUser) {
    try {
      await prisma.notification.create({
        data: {
          userId: assignedMemberUser.id,
          title: "New Leave Application Assigned",
          body: `${studentFullName} applied for ${input.type.toLowerCase().replace(/_/g, " ")} leave (${dateRangeStr}, ${requestedDays} ${requestedDays === 1 ? "day" : "days"}). Add remarks and grant leave days.`,
          type: "ALERT",
          link: "/teacher/leave",
          priority: "HIGH",
        },
      });

      await sendPushToUser(assignedMemberUser.id, {
        title: "Leave Application Assigned",
        body: `${studentFullName} · ${requestedDays} ${requestedDays === 1 ? "day" : "days"} — review and grant days`,
        url: "/teacher/leave",
        tag: `leave-assign-${leave.id}`,
        requireInteraction: true,
      });

      if (assignedMemberUser.email) {
        await sendLeaveEmail({
          to: assignedMemberUser.email,
          subject: `Leave Application for Review — ${studentFullName} (${requestedDays} ${requestedDays === 1 ? "day" : "days"})`,
          html: leaveApplicationAdminEmail({
            leaveId: leave.id,
            studentName: studentFullName,
            its: student.its || student.studentId,
            grade: student.grade,
            section: student.section,
            className: student.classEnrollments[0]?.class?.name || null,
            parentName: primaryParent?.name || null,
            parentEmail: primaryParent?.email || null,
            type: input.type,
            startDate: formatUtcDate(start),
            endDate: formatUtcDate(end),
            days: requestedDays,
            reason: input.reason.trim(),
            attachmentUrl: input.attachmentUrl || null,
            submittedAt: formatDateTime(leave.createdAt),
            adminUrl: appUrl("/teacher/leave"),
            isAssignedMember: true,
            assignedMemberName,
          }),
        });
      }
    } catch (assigneeErr) {
      console.error("[leave-service] Failed to notify assigned portal member:", assigneeErr);
    }
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

  const requestedDays = countLeaveDays(leave.startDate, leave.endDate);
  const requestedGrant =
    input.approvedDays == null ? requestedDays : Number(input.approvedDays);
  const grantedDays = Math.min(
    Math.max(Number.isFinite(requestedGrant) ? Math.trunc(requestedGrant) : requestedDays, 1),
    requestedDays
  );
  const grantedStart = normalizeDateToUTC(leave.startDate);
  const grantedEnd = addUtcDays(grantedStart, grantedDays - 1);
  const reduced = grantedDays < requestedDays;
  const grantedRangeStr = `${formatUtcDate(grantedStart)} – ${formatUtcDate(grantedEnd)}`;

  const updatedLeave = await prisma.leaveRequest.update({
    where: { id: leave.id },
    data: {
      status: LeaveStatus.APPROVED,
      reviewerId: input.reviewerId || null,
      reviewerNotes: input.reviewerNotes?.trim() || null,
      reviewedAt: new Date(),
      approvedDays: grantedDays,
      grantedStartDate: grantedStart,
      grantedEndDate: grantedEnd,
    },
  });

  const dates = getDateRangeArray(grantedStart, grantedEnd);
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

  const approvedStudentName = `${leave.student.user.firstName} ${leave.student.user.lastName}`.trim();
  const reviewer = input.reviewerId
    ? await prisma.user.findUnique({
        where: { id: input.reviewerId },
        select: { firstName: true, lastName: true },
      })
    : null;
  const reviewerName = reviewer
    ? `${reviewer.firstName} ${reviewer.lastName}`.trim()
    : null;
  const decisionSummary = reduced
    ? `approved for ${grantedDays} of ${requestedDays} requested ${requestedDays === 1 ? "day" : "days"} (${grantedRangeStr})`
    : `approved for the full requested period (${grantedRangeStr})`;
  const decisionTitle = reduced ? "Leave Approved — Reduced Days" : "Leave Request Approved";

  // Notify student
  try {
    await prisma.notification.create({
      data: {
        userId: leave.student.userId,
        title: decisionTitle,
        body: `Your leave request has been ${decisionSummary}.`,
        type: "ALERT",
        link: "/talabat/leave-request",
        priority: "HIGH",
      },
    });
  } catch (e) {
    console.error("[leave-service] Notification error:", e);
  }

  // Notify Parent(s) inside the portal
  const parentUserIds = await notifyParents(
    leave.studentId,
    decisionTitle,
    `Leave application for ${approvedStudentName} has been ${decisionSummary}.${input.reviewerNotes ? ` Remarks: ${input.reviewerNotes}` : ""}`,
    "/parent"
  );

  // Notify Parent(s) outside the website (browser push)
  const parentContacts = await getParentContacts(leave.studentId);
  await sendPushToUsers(
    [leave.student.userId, ...parentUserIds, ...parentContacts.map((c) => c.userId)],
    {
      title: decisionTitle,
      body: `${approvedStudentName} · ${decisionSummary}`,
      url: "/parent",
      tag: `leave-decision-${leave.id}`,
      requireInteraction: true,
    }
  );

  // Email the decision to every linked parent from the Galiakot admin mailbox.
  const emailResults = await Promise.allSettled(
    parentContacts
      .filter((contact) => contact.isActive)
      .map((contact) =>
        sendLeaveEmail({
          to: contact.email,
          subject: reduced
            ? `Leave Approved (Reduced Days) — ${approvedStudentName}`
            : `Leave Application Approved — ${approvedStudentName}`,
          html: leaveDecisionParentEmail({
            leaveId: leave.id,
            studentName: approvedStudentName,
            parentName: contact.name,
            type: leave.type,
            status: "APPROVED",
            requestedStart: formatUtcDate(leave.startDate),
            requestedEnd: formatUtcDate(leave.endDate),
            requestedDays,
            approvedDays: grantedDays,
            grantedStart: formatUtcDate(grantedStart),
            grantedEnd: formatUtcDate(grantedEnd),
            reviewerName,
            reviewerNotes: input.reviewerNotes?.trim() || null,
            portalUrl: appUrl("/parent"),
          }),
        })
      )
  );
  emailResults.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `[leave-service] Parent approval email failed for ${parentContacts[index]?.email}:`,
        result.reason
      );
    }
  });

  // One-way WhatsApp notification dispatch to parent(s)
  try {
    const parentPhones = await getStudentParentPhones(leave.studentId);
    for (const p of parentPhones) {
      const waMsg = formatLeaveWhatsAppMessage({
        parentName: p.name,
        studentName: approvedStudentName,
        className: leave.student.classEnrollments[0]?.class?.name || null,
        status: reduced ? "APPROVED_REDUCED" : "APPROVED",
        leaveType: leave.type,
        startDate: formatUtcDate(grantedStart),
        endDate: formatUtcDate(grantedEnd),
        requestedDays,
        approvedDays: grantedDays,
        reviewerNotes: input.reviewerNotes?.trim() || null,
        reviewerName,
      });
      dispatchWhatsAppNotification({ phone: p.phone, message: waMsg }).catch((err) =>
        console.error(`[leave-service] WhatsApp notification failed for ${p.phone}:`, err)
      );
    }
  } catch (waErr) {
    console.error("[leave-service] WhatsApp dispatch error:", waErr);
  }

  cache.invalidateTag("attendanceRecord");
  cache.invalidateTag("dashboard");
  cache.invalidateTag("stats");

  queueAutoSheetSync(leave.startDate);

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
      approvedDays: null,
      grantedStartDate: null,
      grantedEndDate: null,
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

  // Notify Parent(s)
  const rejectedStudentName = `${leave.student.user.firstName} ${leave.student.user.lastName}`.trim();
  const rejectedParentUserIds = await notifyParents(
    leave.studentId,
    "Leave Request Rejected",
    `Leave application for ${rejectedStudentName} was rejected.${input.reviewerNotes ? ` Remarks: ${input.reviewerNotes}` : ""}`,
    "/parent"
  );

  const reviewer = input.reviewerId
    ? await prisma.user.findUnique({
        where: { id: input.reviewerId },
        select: { firstName: true, lastName: true },
      })
    : null;
  const reviewerName = reviewer
    ? `${reviewer.firstName} ${reviewer.lastName}`.trim()
    : null;
  const parentContacts = await getParentContacts(leave.studentId);

  await sendPushToUsers(
    [leave.student.userId, ...rejectedParentUserIds, ...parentContacts.map((c) => c.userId)],
    {
      title: "Leave Request Not Approved",
      body: `${rejectedStudentName} · ${formatUtcDate(leave.startDate)} – ${formatUtcDate(leave.endDate)}`,
      url: "/parent",
      tag: `leave-decision-${leave.id}`,
      requireInteraction: true,
    }
  );

  const emailResults = await Promise.allSettled(
    parentContacts
      .filter((contact) => contact.isActive)
      .map((contact) =>
        sendLeaveEmail({
          to: contact.email,
          subject: `Leave Application Not Approved — ${rejectedStudentName}`,
          html: leaveDecisionParentEmail({
            leaveId: leave.id,
            studentName: rejectedStudentName,
            parentName: contact.name,
            type: leave.type,
            status: "REJECTED",
            requestedStart: formatUtcDate(leave.startDate),
            requestedEnd: formatUtcDate(leave.endDate),
            requestedDays: countLeaveDays(leave.startDate, leave.endDate),
            approvedDays: null,
            grantedStart: null,
            grantedEnd: null,
            reviewerName,
            reviewerNotes: input.reviewerNotes?.trim() || null,
            portalUrl: appUrl("/parent"),
          }),
        })
      )
  );
  emailResults.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `[leave-service] Parent rejection email failed for ${parentContacts[index]?.email}:`,
        result.reason
      );
    }
  });

  // One-way WhatsApp notification dispatch to parent(s)
  try {
    const parentPhones = await getStudentParentPhones(leave.studentId);
    for (const p of parentPhones) {
      const waMsg = formatLeaveWhatsAppMessage({
        parentName: p.name,
        studentName: rejectedStudentName,
        className: (leave as any).student?.classEnrollments?.[0]?.class?.name || null,
        status: "REJECTED",
        leaveType: leave.type,
        startDate: formatUtcDate(leave.startDate),
        endDate: formatUtcDate(leave.endDate),
        requestedDays: countLeaveDays(leave.startDate, leave.endDate),
        reviewerNotes: input.reviewerNotes?.trim() || null,
        reviewerName,
      });
      dispatchWhatsAppNotification({ phone: p.phone, message: waMsg }).catch((err) =>
        console.error(`[leave-service] WhatsApp rejection notification failed for ${p.phone}:`, err)
      );
    }
  } catch (waErr) {
    console.error("[leave-service] WhatsApp dispatch error:", waErr);
  }

  cache.invalidateTag("attendanceRecord");
  cache.invalidateTag("dashboard");

  queueAutoSheetSync(leave.startDate);

  return updatedLeave;
}

/**
 * Assigns a pending leave application to a faculty member with portal access.
 */
export async function assignLeaveRequest(input: AssignLeaveInput) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: input.leaveId },
    include: {
      student: {
        include: { user: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (!leave) {
    throw new Error("Leave request not found");
  }
  if (leave.status !== LeaveStatus.PENDING) {
    throw new Error("Only pending leave applications can be assigned");
  }

  const assignee = await prisma.user.findFirst({
    where: {
      id: input.assigneeId,
      isActive: true,
      role: { in: ["TEACHER", "ADMIN"] },
    },
    include: {
      teacherProfile: { select: { id: true, department: true, roleTitle: true } },
    },
  });

  if (!assignee) {
    throw new Error("Selected member does not have portal access");
  }
  if (assignee.role === "TEACHER" && !assignee.teacherProfile) {
    throw new Error("Selected member does not have a faculty portal profile");
  }

  const updated = await prisma.leaveRequest.update({
    where: { id: leave.id },
    data: {
      assignedToId: assignee.id,
      assignedById: input.assignedById,
      assignedAt: new Date(),
    },
    include: {
      assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      assignedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  const studentName = `${leave.student.user.firstName} ${leave.student.user.lastName}`.trim();
  const days = countLeaveDays(leave.startDate, leave.endDate);
  const link = assignee.role === "ADMIN" ? "/admin/leave" : "/teacher/leave";

  try {
    await prisma.notification.create({
      data: {
        userId: assignee.id,
        title: "Leave Application Assigned",
        body: `${studentName} · ${formatUtcDate(leave.startDate)} – ${formatUtcDate(leave.endDate)} (${days} ${days === 1 ? "day" : "days"}). Add remarks and choose the granted days.`,
        type: "ALERT",
        link,
        priority: "HIGH",
      },
    });
  } catch (err) {
    console.error("[leave-service] Assign notification error:", err);
  }

  await sendPushToUser(assignee.id, {
    title: "Leave Application Assigned",
    body: `${studentName} · ${days} ${days === 1 ? "day" : "days"} — review and grant days`,
    url: link,
    tag: `leave-assign-${leave.id}`,
    requireInteraction: true,
  });

  // Email the assigned portal member with full leave application layout
  if (assignee.email) {
    try {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { id: leave.studentId },
        include: {
          classEnrollments: {
            where: { isActive: true },
            include: { class: true },
            take: 1,
          },
        },
      });
      const parentContacts = await getParentContacts(leave.studentId);
      const primaryParent = parentContacts[0];
      const assigneeName = `${assignee.firstName} ${assignee.lastName}`.trim();

      await sendLeaveEmail({
        to: assignee.email,
        subject: `Leave Application Assigned — ${studentName} (${days} ${days === 1 ? "day" : "days"})`,
        html: leaveApplicationAdminEmail({
          leaveId: leave.id,
          studentName,
          its: studentProfile?.its || studentProfile?.studentId,
          grade: studentProfile?.grade,
          section: studentProfile?.section,
          className: studentProfile?.classEnrollments[0]?.class?.name || null,
          parentName: primaryParent?.name || null,
          parentEmail: primaryParent?.email || null,
          type: leave.type,
          startDate: formatUtcDate(leave.startDate),
          endDate: formatUtcDate(leave.endDate),
          days,
          reason: leave.reason,
          attachmentUrl: leave.attachmentUrl || null,
          submittedAt: formatDateTime(leave.createdAt),
          adminUrl: appUrl(link),
          isAssignedMember: true,
          assignedMemberName: assigneeName,
        }),
      });
    } catch (err) {
      console.error("[leave-service] Assign email error:", err);
    }
  }

  cache.invalidateTag("dashboard");
  return updated;
}

/** Removes the faculty assignment from a pending leave application. */
export async function unassignLeaveRequest(leaveId: string) {
  const leave = await prisma.leaveRequest.findUnique({ where: { id: leaveId } });
  if (!leave) {
    throw new Error("Leave request not found");
  }
  if (leave.status !== LeaveStatus.PENDING) {
    throw new Error("Only pending leave applications can be unassigned");
  }

  return prisma.leaveRequest.update({
    where: { id: leaveId },
    data: { assignedToId: null, assignedById: null, assignedAt: null },
  });
}

/**
 * Cancels a leave request (by student if pending, or by admin).
 */
export async function cancelLeaveRequest(leaveId: string, studentId?: string, isAdmin: boolean = false) {
  const leave = await prisma.leaveRequest.findUnique({
    where: { id: leaveId },
    include: { student: { include: { user: true } } },
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
  queueAutoSheetSync(leave.startDate);

  if (isAdmin) {
    const studentName = leave.student ? `${leave.student.user.firstName} ${leave.student.user.lastName}`.trim() : "Student";
    await notifyParents(
      leave.studentId,
      "Leave Request Cancelled",
      `The leave application for ${studentName} was cancelled by school administration.`,
      "/parent"
    );
  }

  return updatedLeave;
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
      const days = l.approvedDays ?? countLeaveDays(l.startDate, l.endDate);
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

export interface CreateManualLeaveInput {
  studentId: string;
  type: LeaveType;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  reviewerId: string;
  reviewerNotes?: string;
  attachmentUrl?: string | null;
}

/**
 * Creates and immediately approves a manual leave for a student.
 */
export async function createDirectApprovedLeave(input: CreateManualLeaveInput) {
  const student = await prisma.studentProfile.findUnique({
    where: { id: input.studentId },
    include: {
      user: true,
      classEnrollments: {
        where: { isActive: true },
        include: { class: true },
      },
    },
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

  // Create the approved leave record
  const leave = await prisma.leaveRequest.create({
    data: {
      studentId: student.id,
      type: input.type,
      startDate: start,
      endDate: end,
      reason: input.reason.trim(),
      attachmentUrl: input.attachmentUrl || null,
      status: LeaveStatus.APPROVED,
      reviewerId: input.reviewerId,
      reviewerNotes: input.reviewerNotes?.trim() || "Direct manual entry authorized by Administrator",
      reviewedAt: new Date(),
    },
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
      },
    },
  });

  const dates = getDateRangeArray(start, end);
  const registryStatus: AttendanceStatus =
    input.type === LeaveType.MEDICAL ? AttendanceStatus.MEDICAL : AttendanceStatus.ON_LEAVE;
  const registrySource: AttendanceSource =
    input.type === LeaveType.MEDICAL ? AttendanceSource.MEDICAL_LEAVE : AttendanceSource.LEAVE_APPROVED;

  for (const date of dates) {
    await prisma.attendanceRegistry.upsert({
      where: {
        studentId_date: {
          studentId: student.id,
          date,
        },
      },
      create: {
        studentId: student.id,
        date,
        status: registryStatus,
        source: registrySource,
        remarks: `Manual ${input.type} Leave (${input.reason.slice(0, 80)})`,
        leaveId: leave.id,
        recordedById: input.reviewerId,
      },
      update: {
        status: registryStatus,
        source: registrySource,
        remarks: `Manual ${input.type} Leave (${input.reason.slice(0, 80)})`,
        leaveId: leave.id,
        recordedById: input.reviewerId,
      },
    });

    const classes = student.classEnrollments.map((e) => e.class);
    for (const c of classes) {
      await prisma.attendanceRecord.upsert({
        where: {
          studentId_classId_date: {
            studentId: student.id,
            classId: c.id,
            date,
          },
        },
        create: {
          studentId: student.id,
          classId: c.id,
          date,
          status: registryStatus,
          source: registrySource,
          verificationMethod: "MANUAL_LEAVE_ENTRY",
          recordedById: input.reviewerId,
          justification: `Approved ${input.type} Leave: ${input.reason}`,
          justificationStatus: "APPROVED",
        },
        update: {
          status: registryStatus,
          source: registrySource,
          verificationMethod: "MANUAL_LEAVE_ENTRY",
          recordedById: input.reviewerId,
          justification: `Approved ${input.type} Leave: ${input.reason}`,
          justificationStatus: "APPROVED",
        },
      });
    }
  }

  try {
    await prisma.notification.create({
      data: {
        userId: student.userId,
        title: "Leave Recorded & Approved",
        body: `Your leave for ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })} has been authorized.`,
        type: "ALERT",
        link: "/talabat/leave-request",
        priority: "HIGH",
      },
    });
  } catch (e) {
    console.error("[leave-service] Notification error:", e);
  }

  // One-way WhatsApp notification dispatch to parent(s)
  try {
    const parentPhones = await getStudentParentPhones(student.id);
    const studentName = `${student.user.firstName} ${student.user.lastName}`.trim();
    for (const p of parentPhones) {
      const waMsg = formatLeaveWhatsAppMessage({
        parentName: p.name,
        studentName,
        className: student.classEnrollments[0]?.class?.name || null,
        status: "APPROVED",
        leaveType: input.type || "PERSONAL",
        startDate: formatUtcDate(start),
        endDate: formatUtcDate(end),
        requestedDays: countLeaveDays(start, end),
        approvedDays: countLeaveDays(start, end),
        reviewerNotes: input.reviewerNotes?.trim() || "Direct authorized leave by administration.",
        reviewerName: "Academic Administration",
      });
      dispatchWhatsAppNotification({ phone: p.phone, message: waMsg }).catch((err) =>
        console.error(`[leave-service] Manual leave WhatsApp notification failed for ${p.phone}:`, err)
      );
    }
  } catch (waErr) {
    console.error("[leave-service] WhatsApp dispatch error in createDirectApprovedLeave:", waErr);
  }

  cache.invalidateTag("attendanceRecord");
  cache.invalidateTag("dashboard");
  cache.invalidateTag("stats");

  queueAutoSheetSync(start);

  return leave;
}

export interface CreateManualFacultyLeaveInput {
  teacherId: string;
  type?: string;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  assignedById: string;
  assignedByName?: string;
}

/**
 * Creates an approved manual leave / exemption for a faculty member.
 */
export async function createDirectFacultyLeave(input: CreateManualFacultyLeaveInput) {
  const teacher = await prisma.teacherProfile.findUnique({
    where: { id: input.teacherId },
    include: { user: true },
  });

  if (!teacher) {
    throw new Error("Teacher profile not found");
  }

  const start = normalizeDateToUTC(input.startDate);
  const end = normalizeDateToUTC(input.endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid start or end date");
  }

  if (end < start) {
    throw new Error("End date cannot be earlier than start date");
  }

  const dates = getDateRangeArray(start, end);
  const isMedical = input.type === "MEDICAL";
  const teacherStatus = isMedical ? "MEDICAL" : "ON_LEAVE";
  const eventLabel = isMedical ? "Medical Leave" : "Authorized Faculty Leave";

  for (const date of dates) {
    // 1. Create or update medical exemption record
    await prisma.medicalExemption.create({
      data: {
        personType: "TEACHER",
        teacherId: teacher.id,
        date,
        eventName: eventLabel,
        reason: input.reason.trim(),
        assignedById: input.assignedById,
        assignedByName: input.assignedByName || "Administrator",
        isActive: true,
      },
    });

    // 2. Set Teacher Attendance Record for that date
    await prisma.teacherAttendanceRecord.upsert({
      where: {
        teacherId_date: {
          teacherId: teacher.id,
          date,
        },
      },
      create: {
        teacherId: teacher.id,
        date,
        status: teacherStatus as any,
        verificationMethod: "MANUAL",
        notes: `[${eventLabel}] ${input.reason.trim()}`,
      },
      update: {
        status: teacherStatus as any,
        verificationMethod: "MANUAL",
        notes: `[${eventLabel}] ${input.reason.trim()}`,
      },
    });
  }

  try {
    if (teacher.userId) {
      await prisma.notification.create({
        data: {
          userId: teacher.userId,
          title: "Faculty Leave Authorized",
          body: `Your leave for ${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })} has been recorded in the attendance system.`,
          type: "ALERT",
          link: "/faculty/attendance",
          priority: "HIGH",
        },
      });
    }
  } catch (e) {
    console.error("[leave-service] Teacher notification error:", e);
  }

  cache.invalidateTag("teacherAttendanceRecord");
  cache.invalidateTag("dashboard");
  cache.invalidateTag("stats");

  queueAutoSheetSync(start);

  return { success: true, teacherId: teacher.id, datesCount: dates.length };
}

export interface BatchHolidayLeaveInput {
  studentIds: string[];
  type?: LeaveType;
  startDate: Date | string;
  endDate: Date | string;
  reason: string;
  reviewerId: string;
  reviewerNotes?: string;
}

/**
 * 1-Click Batch mark applied or selected students on Holiday / Leave.
 * Sets status to ON_LEAVE across AttendanceRegistry & AttendanceRecord and triggers Google Sheet sync.
 */
export async function markHolidayLeaveBatch(input: BatchHolidayLeaveInput) {
  if (!input.studentIds || input.studentIds.length === 0) {
    throw new Error("At least one student must be selected");
  }

  const results = [];
  for (const studentId of input.studentIds) {
    try {
      const leave = await createDirectApprovedLeave({
        studentId,
        type: input.type || LeaveType.PERSONAL,
        startDate: input.startDate,
        endDate: input.endDate,
        reason: input.reason || "Approved Holiday / Leave",
        reviewerId: input.reviewerId,
        reviewerNotes: input.reviewerNotes || "Authorized Holiday Exemption",
      });
      results.push({ studentId, success: true, leaveId: leave.id });
    } catch (err: any) {
      results.push({ studentId, success: false, error: err?.message });
    }
  }

  return {
    total: input.studentIds.length,
    successCount: results.filter((r) => r.success).length,
    results,
  };
}

