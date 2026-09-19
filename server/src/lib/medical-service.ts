import prisma from "./prisma";
import { cache } from "./cache";
import { normalizeDateToUTC } from "./leave-service";
import { AttendanceStatus, AttendanceSource, LeaveType, LeaveStatus } from "@prisma/client";

export interface MarkMedicalInput {
  personType: "STUDENT" | "TEACHER";
  personId: string; // StudentProfile.id or TeacherProfile.id
  date?: Date | string;
  eventId?: string | null;
  eventName?: string | null;
  reason: string;
  assignedById: string; // User.id of the teacher/admin
  assignedByName?: string;
}

/**
 * 1-Click Mark a Talabat or Faculty on Medical Exemption / Leave for a specific event or full day.
 * Sets status to MEDICAL (source MEDICAL_LEAVE) so they are NEVER marked absent.
 */
export async function markMedicalExemption(input: MarkMedicalInput) {
  const day = normalizeDateToUTC(input.date || new Date());
  const reasonText = (input.reason || "Medical Exemption / Rest").trim();
  const eventLabel = input.eventName ? input.eventName.trim() : "Tilawat al Dua / Full Day";

  let createdExemption;

  if (input.personType === "STUDENT") {
    const student = await prisma.studentProfile.findUnique({
      where: { id: input.personId },
      include: {
        user: true,
        classEnrollments: {
          where: { isActive: true },
          include: { class: true },
        },
      },
    });

    if (!student) {
      throw new Error(`Talabat (Student) not found with ID ${input.personId}`);
    }

    // 1. Create MedicalExemption entry
    createdExemption = await prisma.medicalExemption.create({
      data: {
        personType: "STUDENT",
        studentId: student.id,
        date: day,
        eventId: input.eventId || null,
        eventName: eventLabel,
        reason: reasonText,
        assignedById: input.assignedById,
        assignedByName: input.assignedByName || "Medical In-Charge",
        isActive: true,
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          },
        },
      },
    });

    // 2. Also register / sync approved LeaveRequest so existing leave logs match
    const existingLeave = await prisma.leaveRequest.findFirst({
      where: {
        studentId: student.id,
        startDate: { lte: day },
        endDate: { gte: day },
        status: LeaveStatus.APPROVED,
      },
    });

    let leaveId = existingLeave?.id;
    if (!existingLeave) {
      const newLeave = await prisma.leaveRequest.create({
        data: {
          studentId: student.id,
          type: LeaveType.MEDICAL,
          startDate: day,
          endDate: day,
          reason: `[Medical Duty] ${eventLabel}: ${reasonText}`,
          status: LeaveStatus.APPROVED,
          reviewerId: input.assignedById,
          reviewerNotes: `Assigned by Medical Duty (${input.assignedByName || "Teacher/Admin"})`,
          reviewedAt: new Date(),
        },
      });
      leaveId = newLeave.id;
    }

    // 3. Upsert AttendanceRegistry as MEDICAL
    await prisma.attendanceRegistry.upsert({
      where: {
        studentId_date: {
          studentId: student.id,
          date: day,
        },
      },
      create: {
        studentId: student.id,
        date: day,
        status: AttendanceStatus.MEDICAL,
        source: AttendanceSource.MEDICAL_LEAVE,
        remarks: `Medical Duty Exemption: ${eventLabel} - ${reasonText}`,
        leaveId,
        recordedById: input.assignedById,
      },
      update: {
        status: AttendanceStatus.MEDICAL,
        source: AttendanceSource.MEDICAL_LEAVE,
        remarks: `Medical Duty Exemption: ${eventLabel} - ${reasonText}`,
        leaveId,
        recordedById: input.assignedById,
      },
    });

    // 4. Upsert AttendanceRecord for student's classes as MEDICAL
    const classes = student.classEnrollments.map((e) => e.class);
    for (const c of classes) {
      await prisma.attendanceRecord.upsert({
        where: {
          studentId_classId_date: {
            studentId: student.id,
            classId: c.id,
            date: day,
          },
        },
        create: {
          studentId: student.id,
          classId: c.id,
          date: day,
          status: AttendanceStatus.MEDICAL,
          source: AttendanceSource.MEDICAL_LEAVE,
          verificationMethod: "MEDICAL_DUTY",
          recordedById: input.assignedById,
          justification: `Medical Duty: ${eventLabel} (${reasonText})`,
          justificationStatus: "APPROVED",
        },
        update: {
          status: AttendanceStatus.MEDICAL,
          source: AttendanceSource.MEDICAL_LEAVE,
          verificationMethod: "MEDICAL_DUTY",
          recordedById: input.assignedById,
          justification: `Medical Duty: ${eventLabel} (${reasonText})`,
          justificationStatus: "APPROVED",
        },
      });
    }

    // 5. In-app notification to student
    try {
      await prisma.notification.create({
        data: {
          userId: student.userId,
          title: "Medical Leave Logged",
          body: `You have been marked on Medical Leave for ${eventLabel} (${day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}). Note: ${reasonText}`,
          type: "ALERT",
          link: "/talabat/attendance",
          priority: "NORMAL",
        },
      });
    } catch {}

    // 6. Audit log
    await prisma.attendanceAuditLog.create({
      data: {
        date: day,
        entityType: "STUDENT_RECORD",
        entityId: student.id,
        studentId: student.id,
        action: "OVERRIDE",
        newStatus: "MEDICAL",
        newSource: "MEDICAL_LEAVE",
        actorId: input.assignedById,
        actorName: input.assignedByName || "Medical Duty In-Charge",
        actorRole: "TEACHER",
        reason: `Medical Duty Exemption for ${eventLabel}: ${reasonText}`,
      },
    }).catch(() => {});

  } else {
    // TEACHER / FACULTY
    const teacher = await prisma.teacherProfile.findUnique({
      where: { id: input.personId },
      include: {
        user: true,
      },
    });

    if (!teacher) {
      throw new Error(`Faculty member not found with ID ${input.personId}`);
    }

    // 1. Create MedicalExemption entry
    createdExemption = await prisma.medicalExemption.create({
      data: {
        personType: "TEACHER",
        teacherId: teacher.id,
        date: day,
        eventId: input.eventId || null,
        eventName: eventLabel,
        reason: reasonText,
        assignedById: input.assignedById,
        assignedByName: input.assignedByName || "Medical In-Charge",
        isActive: true,
      },
      include: {
        teacher: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          },
        },
      },
    });

    // 2. Upsert TeacherAttendanceRecord as MEDICAL
    await prisma.teacherAttendanceRecord.upsert({
      where: {
        teacherId_date: {
          teacherId: teacher.id,
          date: day,
        },
      },
      create: {
        teacherId: teacher.id,
        date: day,
        status: AttendanceStatus.MEDICAL,
        verificationMethod: "MEDICAL_DUTY",
        notes: `Medical Exemption: ${eventLabel} - ${reasonText}`,
      },
      update: {
        status: AttendanceStatus.MEDICAL,
        verificationMethod: "MEDICAL_DUTY",
        notes: `Medical Exemption: ${eventLabel} - ${reasonText}`,
      },
    });

    // 3. Notification to faculty
    try {
      await prisma.notification.create({
        data: {
          userId: teacher.userId,
          title: "Medical Leave Logged",
          body: `You have been marked on Medical Leave for ${eventLabel} (${day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}).`,
          type: "ALERT",
          link: "/faculty/attendance",
          priority: "NORMAL",
        },
      });
    } catch {}

    // 4. Audit log
    await prisma.attendanceAuditLog.create({
      data: {
        date: day,
        entityType: "TEACHER_RECORD",
        entityId: teacher.id,
        teacherId: teacher.id,
        action: "OVERRIDE",
        newStatus: "MEDICAL",
        newSource: "MEDICAL_LEAVE",
        actorId: input.assignedById,
        actorName: input.assignedByName || "Medical Duty In-Charge",
        actorRole: "TEACHER",
        reason: `Faculty Medical Duty Exemption for ${eventLabel}: ${reasonText}`,
      },
    }).catch(() => {});
  }

  cache.invalidateTag("attendanceRecord");
  cache.invalidateTag("attendanceRegistry");
  cache.invalidateTag("teacherAttendanceRecord");
  cache.invalidateTag("dashboard");
  cache.invalidateTag("stats");

  return createdExemption;
}

/**
 * Fetch all medical exemptions for a date or date range.
 */
export async function getMedicalExemptions(params: {
  date?: Date | string;
  personType?: "STUDENT" | "TEACHER" | "ALL";
  isActive?: boolean;
}) {
  const day = params.date ? normalizeDateToUTC(params.date) : normalizeDateToUTC(new Date());

  const where: any = {
    date: day,
    ...(params.isActive !== undefined ? { isActive: params.isActive } : { isActive: true }),
  };

  if (params.personType && params.personType !== "ALL") {
    where.personType = params.personType;
  }

  const exemptions = await prisma.medicalExemption.findMany({
    where,
    include: {
      student: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
          classEnrollments: {
            where: { isActive: true },
            include: { class: { select: { name: true, grade: true, section: true } } },
          },
        },
      },
      teacher: {
        include: {
          user: { select: { firstName: true, lastName: true, email: true, avatarUrl: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return exemptions;
}

/**
 * Revoke or remove a medical exemption.
 */
export async function revokeMedicalExemption(id: string, actorId?: string, actorName?: string) {
  const existing = await prisma.medicalExemption.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error("Medical exemption record not found");
  }

  const updated = await prisma.medicalExemption.update({
    where: { id },
    data: { isActive: false },
  });

  // Audit log
  await prisma.attendanceAuditLog.create({
    data: {
      date: existing.date,
      entityType: existing.personType === "STUDENT" ? "STUDENT_RECORD" : "TEACHER_RECORD",
      entityId: existing.studentId || existing.teacherId,
      studentId: existing.studentId || undefined,
      teacherId: existing.teacherId || undefined,
      action: "OVERRIDE",
      newStatus: "REVOKED",
      actorId: actorId || "system",
      actorName: actorName || "Medical Duty In-Charge",
      reason: `Revoked Medical Exemption (ID: ${id})`,
    },
  }).catch(() => {});

  cache.invalidateTag("attendanceRecord");
  cache.invalidateTag("attendanceRegistry");
  cache.invalidateTag("teacherAttendanceRecord");
  cache.invalidateTag("dashboard");

  return updated;
}

/**
 * Check if student or teacher has an active medical exemption on targetDate.
 */
export async function checkPersonMedicalExemption(
  personType: "STUDENT" | "TEACHER",
  personId: string,
  targetDate: Date,
  eventId?: string | null,
) {
  const day = normalizeDateToUTC(targetDate);
  const where: any = {
    personType,
    date: day,
    isActive: true,
  };

  if (personType === "STUDENT") {
    where.studentId = personId;
  } else {
    where.teacherId = personId;
  }

  if (eventId) {
    where.OR = [{ eventId }, { eventId: null }];
  }

  return prisma.medicalExemption.findFirst({ where });
}
