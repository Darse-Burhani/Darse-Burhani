import prisma from "./prisma";
import { deleteUserFromAllDevices } from "./hikvision";

export interface CompleteDeleteResult {
  success: boolean;
  userId: string;
  role?: string;
  deletedBiometricIds: string[];
  hardwareStatus: {
    deletedFrom: string[];
    errors: Array<{ host: string; error: string }>;
  };
  error?: string;
}

/**
 * Completely purges a student, faculty member, or user from the PostgreSQL database
 * AND communicates with all active Hikvision biometric terminals to purge their
 * face, card, and employee records from physical hardware memory.
 */
export async function completelyDeleteUser(userId: string): Promise<CompleteDeleteResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      studentProfile: true,
      teacherProfile: true,
      parentProfile: true,
    },
  });

  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  if (user.role === "ADMIN") {
    throw new Error("Master ADMIN account cannot be deleted for system safety");
  }

  // Collect all biometric identification tokens associated with this user
  const candidateNos: (string | null | undefined)[] = [
    user.id,
    user.email,
  ];

  if (user.studentProfile) {
    const s = user.studentProfile;
    candidateNos.push(s.id, s.studentId, s.its, s.trNo, s.darsId, s.biometricHash);
  }

  if (user.teacherProfile) {
    const t = user.teacherProfile;
    candidateNos.push(t.id, t.employeeId, t.its, t.biometricHash);
  }

  const cleanNos = Array.from(new Set(candidateNos.map((n) => n?.trim()).filter(Boolean))) as string[];

  // 1. Cascade hard delete from all DB tables in an atomic transaction FIRST
  const studentId = user.studentProfile?.id;
  const teacherId = user.teacherProfile?.id;

  await prisma.$transaction(async (tx) => {
    // Clean up reviewer/assignee references on User
    await tx.leaveRequest.updateMany({ where: { reviewerId: userId }, data: { reviewerId: null } });
    await tx.hifzMarhalaReport.updateMany({ where: { reviewedById: userId }, data: { reviewedById: null } });
    await tx.hifzWeeklySlip.updateMany({ where: { reviewedById: userId }, data: { reviewedById: null } });
    await tx.talabatProfile1447.updateMany({ where: { reviewedById: userId }, data: { reviewedById: null } });
    await tx.assignmentGrade.updateMany({ where: { gradedById: userId }, data: { gradedById: null } });
    await tx.hifzMarhalaAssignment.deleteMany({ where: { assignedById: userId } });
    await tx.procurementRequest.deleteMany({
      where: { requesterId: userId },
    });
    await tx.procurementRequest.updateMany({
      where: { assignedToId: userId },
      data: { assignedToId: null },
    });

    // Delete student-related dependencies
    if (studentId) {
      await tx.attendanceRecord.deleteMany({ where: { studentId } });
      await tx.attendanceRegistry.deleteMany({ where: { studentId } });
      await tx.attendanceAuditLog.deleteMany({ where: { studentId } });
      await tx.classEnrollment.deleteMany({ where: { studentId } });
      await tx.pointLog.deleteMany({ where: { studentId } });
      await tx.leaveRequest.deleteMany({ where: { studentId } });
      await tx.parentStudentLink.deleteMany({ where: { studentId } });
      await tx.hifzWeeklySlip.deleteMany({ where: { studentId } });
      await tx.hifzDailyEvaluation.deleteMany({ where: { studentId } });
      await tx.hifzIkhtebaarTarget.deleteMany({ where: { studentId } });
      await tx.hifzMarhalaReport.deleteMany({ where: { studentId } });
      await tx.hifzPart.deleteMany({ where: { report: { studentId } } });
      await tx.hifzReport.deleteMany({ where: { studentId } });
      await tx.hifzMarhalaAssignment.deleteMany({
        where: { OR: [{ studentId }, { musaidStudentId: studentId }] },
      });
      await tx.badgeProgress.deleteMany({ where: { studentId } });
      await tx.skillTreePoint.deleteMany({ where: { studentId } });
      await tx.skillAssessmentAttempt.deleteMany({ where: { studentId } });
      await tx.assignment.updateMany({ where: { targetStudentId: studentId }, data: { targetStudentId: null } });
      await tx.assignmentGrade.deleteMany({ where: { studentId } });
      await tx.studentHobby.deleteMany({ where: { studentId } });
      await tx.walletTransaction.deleteMany({ where: { studentId } });
      await tx.medicalExemption.deleteMany({ where: { studentId } });
      await tx.talabatProfile1447.deleteMany({ where: { studentId } });
      await tx.studentProfile.delete({ where: { id: studentId } });
    }

    // Delete teacher/faculty-related dependencies
    if (teacherId) {
      await tx.teacherPortalAssignment.deleteMany({ where: { teacherId } });
      await tx.teacherAttendanceRecord.deleteMany({ where: { teacherId } });
      await tx.takhteetProgressLog.deleteMany({ where: { teacherId } });
      await tx.takhteetPlan.deleteMany({ where: { teacherId } });
      await tx.hifzDailyEvaluation.updateMany({ where: { facultyId: teacherId }, data: { facultyId: null } });
      await tx.hifzPart.deleteMany({ where: { report: { teacherId } } });
      await tx.hifzReport.deleteMany({ where: { teacherId } });
      await tx.hifzMarhalaReport.deleteMany({ where: { facultyId: teacherId } });
      await tx.hifzWeeklySlip.deleteMany({ where: { facultyId: teacherId } });
      await tx.hifzMarhalaAssignment.deleteMany({
        where: { OR: [{ facultyId: teacherId }, { musaidId: teacherId }] },
      });
      await tx.medicalExemption.deleteMany({ where: { teacherId } });
      await tx.pointLog.deleteMany({ where: { teacherId } });

      // Disassociate as masool in classes
      await tx.class.updateMany({ where: { masoolId: teacherId }, data: { masoolId: null } });

      // Clean up classes taught by this teacher
      await tx.attendanceRecord.deleteMany({ where: { class: { teacherId } } });
      await tx.classEnrollment.deleteMany({ where: { class: { teacherId } } });
      await tx.timetableSlot.deleteMany({ where: { class: { teacherId } } });
      await tx.class.deleteMany({ where: { teacherId } });

      // Clean up attendance audit logs referencing this teacher
      await tx.attendanceAuditLog.deleteMany({ where: { teacherId } });

      await tx.teacherProfile.delete({ where: { id: teacherId } });
    }

    // Delete parent-related dependencies
    if (user.parentProfile) {
      await tx.parentStudentLink.deleteMany({ where: { parentId: user.parentProfile.id } });
      await tx.parentProfile.delete({ where: { id: user.parentProfile.id } });
    }

    // Sessions, accounts, and notifications
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });

    // Finally delete the user root record
    await tx.user.delete({ where: { id: userId } });
  });

  // 2. Non-blocking biometric terminal purge (fires concurrently, never delays HTTP response)
  let hardwareStatus = { deletedFrom: [] as string[], errors: [] as Array<{ host: string; error: string }> };
  if (cleanNos.length > 0) {
    deleteUserFromAllDevices(cleanNos)
      .then((res) => {
        console.log(`[hardware-purge] Purged tokens [${cleanNos.join(", ")}] from terminals:`, res);
      })
      .catch((err) => {
        console.warn(`[hardware-purge] Notice purging biometric terminals for ${userId}:`, err?.message || err);
      });
  }

  // 3. Purge schedule window scopes (remove id from applicableTeacherIds and exempt arrays)
  if (teacherId) {
    try {
      const windows = await prisma.biometricScanWindow.findMany({
        where: {
          OR: [
            { applicableTeacherIds: { has: teacherId } },
            { exemptTeacherIds: { has: teacherId } },
          ],
        },
      });

      for (const w of windows) {
        await prisma.biometricScanWindow.update({
          where: { id: w.id },
          data: {
            applicableTeacherIds: (w.applicableTeacherIds || []).filter((id) => id !== teacherId),
            exemptTeacherIds: (w.exemptTeacherIds || []).filter((id) => id !== teacherId),
          },
        });
      }
    } catch (e) {
      console.warn("[user-deletion] Notice removing teacher from scan windows:", e);
    }
  }

  return {
    success: true,
    userId,
    role: user.role,
    deletedBiometricIds: cleanNos,
    hardwareStatus,
  };
}
