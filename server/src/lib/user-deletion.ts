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

  // 1. Purge from all physical biometric terminals (ISAPI)
  let hardwareStatus = { deletedFrom: [] as string[], errors: [] as Array<{ host: string; error: string }> };
  try {
    hardwareStatus = await deleteUserFromAllDevices(cleanNos);
    console.log(`[hardware-purge] Removed user ${user.email} (${user.id}) tokens [${cleanNos.join(", ")}] from terminals:`, hardwareStatus);
  } catch (err: any) {
    console.warn(`[hardware-purge] Biometric hardware delete notice for ${userId}:`, err?.message);
    hardwareStatus.errors.push({ host: "terminals", error: err?.message || String(err) });
  }

  // 2. Cascade hard delete from all DB tables in an atomic transaction
  const studentId = user.studentProfile?.id;
  const teacherId = user.teacherProfile?.id;

  await prisma.$transaction(async (tx) => {
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
      await tx.hifzMarhalaReport.deleteMany({ where: { studentId } });
      await tx.hifzReport.deleteMany({ where: { studentId } });
      await tx.hifzMarhalaAssignment.deleteMany({
        where: { OR: [{ studentId }, { musaidStudentId: studentId }] },
      });
      await tx.badgeProgress.deleteMany({ where: { studentId } });
      await tx.skillTreePoint.deleteMany({ where: { studentId } });
      await tx.walletTransaction.deleteMany({ where: { studentId } });
      await tx.studentProfile.delete({ where: { id: studentId } });
    }

    // Delete teacher-related dependencies
    if (teacherId) {
      await tx.teacherPortalAssignment.deleteMany({ where: { teacherId } });
      await tx.teacherAttendanceRecord.deleteMany({ where: { teacherId } });
      await tx.takhteetPlan.deleteMany({ where: { teacherId } });
      await tx.takhteetProgressLog.deleteMany({ where: { teacherId } });
      await tx.hifzReport.deleteMany({ where: { teacherId } });
      await tx.hifzMarhalaReport.deleteMany({ where: { facultyId: teacherId } });
      await tx.hifzWeeklySlip.deleteMany({ where: { facultyId: teacherId } });
      await tx.hifzMarhalaAssignment.deleteMany({
        where: { OR: [{ facultyId: teacherId }, { musaidId: teacherId }] },
      });
      await tx.classEnrollment.deleteMany({ where: { class: { teacherId } } });
      await tx.class.deleteMany({ where: { teacherId } });
      await tx.teacherProfile.delete({ where: { id: teacherId } });
    }

    // Delete parent-related dependencies
    if (user.parentProfile) {
      await tx.parentStudentLink.deleteMany({ where: { parentId: user.parentProfile.id } });
      await tx.parentProfile.delete({ where: { id: user.parentProfile.id } });
    }

    // Finally delete the user root record (cascades sessions, accounts, notifications)
    await tx.user.delete({ where: { id: userId } });
  });

  return {
    success: true,
    userId,
    role: user.role,
    deletedBiometricIds: cleanNos,
    hardwareStatus,
  };
}
