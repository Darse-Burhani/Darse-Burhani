import prisma from "./prisma";
import { deleteUserFromAllDevices } from "./hikvision";
import { cache } from "./cache";

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
 * Completely purges a student, faculty member, parent, or admin user from the PostgreSQL database
 * AND communicates with all active Hikvision biometric terminals to purge their
 * face, card, and employee records from physical hardware memory.
 */
export async function completelyDeleteUser(userId: string): Promise<CompleteDeleteResult> {
  const cleanId = userId?.trim();
  if (!cleanId) {
    throw new Error("User identifier is required");
  }

  // 1. Resilient lookup: handle User.id, StudentProfile.id/studentId/its, TeacherProfile.id/employeeId/its, ParentProfile.id, or email
  let user = await prisma.user.findUnique({
    where: { id: cleanId },
    include: {
      studentProfile: true,
      teacherProfile: true,
      parentProfile: true,
    },
  });

  let orphanedStudentProfile: any = null;
  let orphanedTeacherProfile: any = null;
  let orphanedParentProfile: any = null;

  if (!user) {
    // Check if cleanId belongs to a student profile
    const student = await prisma.studentProfile.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { userId: cleanId },
          { studentId: cleanId },
          { its: cleanId },
        ],
      },
      include: {
        user: {
          include: {
            studentProfile: true,
            teacherProfile: true,
            parentProfile: true,
          },
        },
      },
    });
    if (student?.user) {
      user = student.user;
    } else if (student) {
      orphanedStudentProfile = student;
    }
  }

  if (!user && !orphanedStudentProfile) {
    // Check if cleanId belongs to a teacher profile
    const teacher = await prisma.teacherProfile.findFirst({
      where: {
        OR: [
          { id: cleanId },
          { userId: cleanId },
          { employeeId: cleanId },
          { its: cleanId },
        ],
      },
      include: {
        user: {
          include: {
            studentProfile: true,
            teacherProfile: true,
            parentProfile: true,
          },
        },
      },
    });
    if (teacher?.user) {
      user = teacher.user;
    } else if (teacher) {
      orphanedTeacherProfile = teacher;
    }
  }

  if (!user && !orphanedStudentProfile && !orphanedTeacherProfile) {
    // Check parent profile or email
    const parent = await prisma.parentProfile.findFirst({
      where: { OR: [{ id: cleanId }, { userId: cleanId }] },
      include: {
        user: {
          include: {
            studentProfile: true,
            teacherProfile: true,
            parentProfile: true,
          },
        },
      },
    });
    if (parent?.user) {
      user = parent.user;
    } else if (parent) {
      orphanedParentProfile = parent;
    }
  }

  if (!user && !orphanedStudentProfile && !orphanedTeacherProfile && !orphanedParentProfile && cleanId.includes("@")) {
    user = await prisma.user.findUnique({
      where: { email: cleanId.toLowerCase() },
      include: {
        studentProfile: true,
        teacherProfile: true,
        parentProfile: true,
      },
    });
  }

  // 1A. Handle Orphaned Student Profile
  if (!user && orphanedStudentProfile) {
    const sId = orphanedStudentProfile.id;
    const tokens = [sId, orphanedStudentProfile.studentId, orphanedStudentProfile.its, orphanedStudentProfile.trNo, orphanedStudentProfile.darsId, orphanedStudentProfile.biometricHash].filter(Boolean) as string[];

    await prisma.$transaction(async (tx) => {
      await tx.bookLoan.deleteMany({ where: { studentId: { in: tokens } } }).catch(() => {});
      await tx.attendanceRecord.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.attendanceRegistry.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.attendanceAuditLog.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.classEnrollment.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.pointLog.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.leaveRequest.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.parentStudentLink.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.hifzWeeklySlip.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.hifzDailyEvaluation.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.hifzIkhtebaarTarget.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.hifzMarhalaReport.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.hifzPart.deleteMany({ where: { report: { studentId: sId } } }).catch(() => {});
      await tx.hifzReport.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.hifzMarhalaAssignment.deleteMany({ where: { OR: [{ studentId: sId }, { musaidStudentId: sId }] } }).catch(() => {});
      await tx.badgeProgress.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.skillTreePoint.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.skillAssessmentAttempt.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.assignment.updateMany({ where: { targetStudentId: sId }, data: { targetStudentId: null } }).catch(() => {});
      await tx.assignmentGrade.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.studentHobby.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.walletTransaction.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.medicalExemption.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.talabatProfile1447.deleteMany({ where: { studentId: sId } }).catch(() => {});
      await tx.studentProfile.deleteMany({ where: { id: sId } });
    }, { maxWait: 20000, timeout: 60000 });

    if (tokens.length > 0) {
      deleteUserFromAllDevices(tokens).catch(() => {});
    }

    cache.invalidateTag("user");
    cache.invalidateTag("studentprofile");
    cache.invalidateTag("dashboard");

    return {
      success: true,
      userId: orphanedStudentProfile.userId || sId,
      role: "STUDENT",
      deletedBiometricIds: tokens,
      hardwareStatus: { deletedFrom: [], errors: [] },
    };
  }

  // 1B. Handle Orphaned Teacher Profile
  if (!user && orphanedTeacherProfile) {
    const tId = orphanedTeacherProfile.id;
    const tokens = [tId, orphanedTeacherProfile.employeeId, orphanedTeacherProfile.its, orphanedTeacherProfile.biometricHash].filter(Boolean) as string[];

    await prisma.$transaction(async (tx) => {
      await tx.teacherPortalAssignment.deleteMany({ where: { teacherId: tId } }).catch(() => {});
      await tx.teacherAttendanceRecord.deleteMany({ where: { teacherId: tId } }).catch(() => {});
      await tx.takhteetProgressLog.deleteMany({ where: { teacherId: tId } }).catch(() => {});
      await tx.takhteetPlan.deleteMany({ where: { teacherId: tId } }).catch(() => {});
      await tx.hifzDailyEvaluation.updateMany({ where: { facultyId: tId }, data: { facultyId: null } }).catch(() => {});
      await tx.hifzPart.deleteMany({ where: { report: { teacherId: tId } } }).catch(() => {});
      await tx.hifzReport.deleteMany({ where: { teacherId: tId } }).catch(() => {});
      await tx.hifzMarhalaReport.deleteMany({ where: { facultyId: tId } }).catch(() => {});
      await tx.hifzWeeklySlip.deleteMany({ where: { facultyId: tId } }).catch(() => {});
      await tx.hifzMarhalaAssignment.deleteMany({ where: { OR: [{ facultyId: tId }, { musaidId: tId }] } }).catch(() => {});
      await tx.medicalExemption.deleteMany({ where: { teacherId: tId } }).catch(() => {});
      await tx.pointLog.deleteMany({ where: { teacherId: tId } }).catch(() => {});
      await tx.class.updateMany({ where: { masoolId: tId }, data: { masoolId: null } }).catch(() => {});
      await tx.takhteetProgressLog.deleteMany({ where: { plan: { class: { teacherId: tId } } } }).catch(() => {});
      await tx.takhteetPlan.deleteMany({ where: { class: { teacherId: tId } } }).catch(() => {});
      await tx.pointLog.deleteMany({ where: { class: { teacherId: tId } } }).catch(() => {});
      await tx.attendanceRecord.deleteMany({ where: { class: { teacherId: tId } } }).catch(() => {});
      await tx.classEnrollment.deleteMany({ where: { class: { teacherId: tId } } }).catch(() => {});
      await tx.timetableSlot.deleteMany({ where: { class: { teacherId: tId } } }).catch(() => {});
      await tx.class.deleteMany({ where: { teacherId: tId } }).catch(() => {});
      await tx.attendanceAuditLog.deleteMany({ where: { teacherId: tId } }).catch(() => {});
      await tx.teacherProfile.deleteMany({ where: { id: tId } });
    }, { maxWait: 20000, timeout: 60000 });

    if (tokens.length > 0) {
      deleteUserFromAllDevices(tokens).catch(() => {});
    }

    cache.invalidateTag("user");
    cache.invalidateTag("teacherprofile");
    cache.invalidateTag("dashboard");

    return {
      success: true,
      userId: orphanedTeacherProfile.userId || tId,
      role: "TEACHER",
      deletedBiometricIds: tokens,
      hardwareStatus: { deletedFrom: [], errors: [] },
    };
  }

  // 1C. Handle Orphaned Parent Profile
  if (!user && orphanedParentProfile) {
    const pId = orphanedParentProfile.id;
    await prisma.$transaction(async (tx) => {
      await tx.parentStudentLink.deleteMany({ where: { parentId: pId } }).catch(() => {});
      await tx.parentProfile.deleteMany({ where: { id: pId } });
    }, { maxWait: 20000, timeout: 60000 });

    cache.invalidateTag("user");
    cache.invalidateTag("parentprofile");
    cache.invalidateTag("dashboard");

    return {
      success: true,
      userId: orphanedParentProfile.userId || pId,
      role: "PARENT",
      deletedBiometricIds: [],
      hardwareStatus: { deletedFrom: [], errors: [] },
    };
  }

  if (!user) {
    // If user is already removed from DB, perform idempotent cleanup of caches and terminals
    deleteUserFromAllDevices([cleanId]).catch(() => {});
    try {
      cache.invalidateTag("user");
      cache.invalidateTag("studentprofile");
      cache.invalidateTag("teacherprofile");
      cache.invalidateTag("parentprofile");
      cache.invalidateTag("dashboard");
      cache.invalidateTag("stats");
    } catch {}

    return {
      success: true,
      userId: cleanId,
      deletedBiometricIds: [cleanId],
      hardwareStatus: { deletedFrom: [], errors: [] },
    };
  }

  const resolvedUserId = user.id;

  // Protect only the master system administrator, not normal admin users
  const MASTER_ADMINS = [
    "admin@darseburhani.edu",
    "master@darseburhani.edu",
    "superadmin@darseburhani.edu",
  ];
  if (MASTER_ADMINS.includes(user.email.toLowerCase())) {
    throw new Error("Master system administrator account cannot be deleted for security and system stability.");
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

  // 2. Cascade hard delete from all DB tables in an atomic transaction FIRST with safe 60s timeout
  const actualStudent = user.studentProfile || (await prisma.studentProfile.findUnique({ where: { userId: resolvedUserId } }));
  const actualTeacher = user.teacherProfile || (await prisma.teacherProfile.findUnique({ where: { userId: resolvedUserId } }));
  const actualParent = user.parentProfile || (await prisma.parentProfile.findUnique({ where: { userId: resolvedUserId } }));

  const studentId = actualStudent?.id;
  const teacherId = actualTeacher?.id;
  const parentId = actualParent?.id;

  await prisma.$transaction(async (tx) => {
    // Clean up reviewer/assignee references on User
    await tx.leaveRequest.updateMany({ where: { reviewerId: resolvedUserId }, data: { reviewerId: null } }).catch(() => {});
    await tx.hifzMarhalaReport.updateMany({ where: { reviewedById: resolvedUserId }, data: { reviewedById: null } }).catch(() => {});
    await tx.hifzWeeklySlip.updateMany({ where: { reviewedById: resolvedUserId }, data: { reviewedById: null } }).catch(() => {});
    await tx.talabatProfile1447.updateMany({ where: { reviewedById: resolvedUserId }, data: { reviewedById: null } }).catch(() => {});
    await tx.assignmentGrade.updateMany({ where: { gradedById: resolvedUserId }, data: { gradedById: null } }).catch(() => {});
    await tx.hifzMarhalaAssignment.deleteMany({ where: { assignedById: resolvedUserId } }).catch(() => {});
    await tx.procurementRequest.deleteMany({
      where: { requesterId: resolvedUserId },
    }).catch(() => {});
    await tx.procurementRequest.updateMany({
      where: { assignedToId: resolvedUserId },
      data: { assignedToId: null },
    }).catch(() => {});

    // Clean up institutional items created/assigned by this user (Admin or Faculty)
    await tx.assignmentGrade.deleteMany({ where: { assignment: { createdById: resolvedUserId } } }).catch(() => {});
    await tx.assignment.deleteMany({ where: { createdById: resolvedUserId } }).catch(() => {});
    await tx.academicCalendarEvent.updateMany({ where: { createdBy: resolvedUserId }, data: { createdBy: "system" } }).catch(() => {});
    await tx.teacherPortalAssignment.deleteMany({ where: { assignedById: resolvedUserId } }).catch(() => {});
    await tx.takhteetPlan.updateMany({ where: { assignedById: resolvedUserId }, data: { assignedById: "system" } }).catch(() => {});

    // Clean up attendance actor / assignment references
    await tx.medicalExemption.updateMany({ where: { assignedById: resolvedUserId }, data: { assignedById: "system" } }).catch(() => {});
    await tx.attendanceRecord.updateMany({ where: { justifiedById: resolvedUserId }, data: { justifiedById: null } }).catch(() => {});
    await tx.attendanceRecord.updateMany({ where: { recordedById: resolvedUserId }, data: { recordedById: "system" } }).catch(() => {});
    await tx.attendanceRegistry.updateMany({ where: { recordedById: resolvedUserId }, data: { recordedById: null } }).catch(() => {});
    await tx.attendanceAuditLog.updateMany({ where: { actorId: resolvedUserId }, data: { actorId: null } }).catch(() => {});
    await tx.attendanceDayLock.updateMany({ where: { lockedById: resolvedUserId }, data: { lockedById: null } }).catch(() => {});
    await tx.user.updateMany({ where: { deletedById: resolvedUserId }, data: { deletedById: null } }).catch(() => {});

    // Delete student-related dependencies
    if (studentId) {
      // Library book loans
      const studentTokens = [
        studentId,
        actualStudent?.studentId,
        actualStudent?.its,
      ].filter(Boolean) as string[];

      await tx.bookLoan.deleteMany({
        where: {
          studentId: { in: studentTokens },
        },
      }).catch(() => {});

      await tx.attendanceRecord.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.attendanceRegistry.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.attendanceAuditLog.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.classEnrollment.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.pointLog.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.leaveRequest.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.parentStudentLink.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.hifzWeeklySlip.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.hifzDailyEvaluation.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.hifzIkhtebaarTarget.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.hifzMarhalaReport.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.hifzPart.deleteMany({ where: { report: { studentId } } }).catch(() => {});
      await tx.hifzReport.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.hifzMarhalaAssignment.deleteMany({
        where: { OR: [{ studentId }, { musaidStudentId: studentId }] },
      }).catch(() => {});
      await tx.badgeProgress.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.skillTreePoint.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.skillAssessmentAttempt.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.assignment.updateMany({ where: { targetStudentId: studentId }, data: { targetStudentId: null } }).catch(() => {});
      await tx.assignmentGrade.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.studentHobby.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.walletTransaction.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.medicalExemption.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.talabatProfile1447.deleteMany({ where: { studentId } }).catch(() => {});
      await tx.studentProfile.deleteMany({ where: { id: studentId } });
    }

    // Delete teacher/faculty-related dependencies
    if (teacherId) {
      await tx.teacherPortalAssignment.deleteMany({ where: { teacherId } }).catch(() => {});
      await tx.teacherAttendanceRecord.deleteMany({ where: { teacherId } }).catch(() => {});
      await tx.takhteetProgressLog.deleteMany({ where: { teacherId } }).catch(() => {});
      await tx.takhteetPlan.deleteMany({ where: { teacherId } }).catch(() => {});
      await tx.hifzDailyEvaluation.updateMany({ where: { facultyId: teacherId }, data: { facultyId: null } }).catch(() => {});
      await tx.hifzPart.deleteMany({ where: { report: { teacherId } } }).catch(() => {});
      await tx.hifzReport.deleteMany({ where: { teacherId } }).catch(() => {});
      await tx.hifzMarhalaReport.deleteMany({ where: { facultyId: teacherId } }).catch(() => {});
      await tx.hifzWeeklySlip.deleteMany({ where: { facultyId: teacherId } }).catch(() => {});
      await tx.hifzMarhalaAssignment.deleteMany({
        where: { OR: [{ facultyId: teacherId }, { musaidId: teacherId }] },
      }).catch(() => {});
      await tx.medicalExemption.deleteMany({ where: { teacherId } }).catch(() => {});
      await tx.pointLog.deleteMany({ where: { teacherId } }).catch(() => {});

      // Disassociate as masool in classes
      await tx.class.updateMany({ where: { masoolId: teacherId }, data: { masoolId: null } }).catch(() => {});

      // Clean up classes taught by this teacher - clean child logs first to avoid FK constraint
      await tx.takhteetProgressLog.deleteMany({ where: { plan: { class: { teacherId } } } }).catch(() => {});
      await tx.takhteetPlan.deleteMany({ where: { class: { teacherId } } }).catch(() => {});
      await tx.pointLog.deleteMany({ where: { class: { teacherId } } }).catch(() => {});
      await tx.attendanceRecord.deleteMany({ where: { class: { teacherId } } }).catch(() => {});
      await tx.classEnrollment.deleteMany({ where: { class: { teacherId } } }).catch(() => {});
      await tx.timetableSlot.deleteMany({ where: { class: { teacherId } } }).catch(() => {});
      await tx.class.deleteMany({ where: { teacherId } }).catch(() => {});

      // Clean up attendance audit logs referencing this teacher
      await tx.attendanceAuditLog.deleteMany({ where: { teacherId } }).catch(() => {});

      await tx.teacherProfile.deleteMany({ where: { id: teacherId } });
    }

    // Delete parent-related dependencies
    if (parentId || user.role === "PARENT") {
      await tx.parentStudentLink.deleteMany({
        where: {
          OR: [
            ...(parentId ? [{ parentId }] : []),
            { parent: { userId: resolvedUserId } },
          ],
        },
      }).catch(() => {});
      await tx.parentProfile.deleteMany({
        where: {
          OR: [
            ...(parentId ? [{ id: parentId }] : []),
            { userId: resolvedUserId },
          ],
        },
      }).catch(() => {});
    }

    // Sessions, accounts, and notifications
    await tx.session.deleteMany({ where: { userId: resolvedUserId } }).catch(() => {});
    await tx.account.deleteMany({ where: { userId: resolvedUserId } }).catch(() => {});
    await tx.notification.deleteMany({ where: { userId: resolvedUserId } }).catch(() => {});

    // Finally delete the user root record (idempotent deleteMany prevents P2025 error)
    await tx.user.deleteMany({ where: { id: resolvedUserId } });
  }, {
    maxWait: 20000,
    timeout: 60000,
  });

  // 3. Non-blocking biometric terminal purge (fires concurrently, never delays HTTP response)
  const hardwareStatus = { deletedFrom: [] as string[], errors: [] as Array<{ host: string; error: string }> };
  if (cleanNos.length > 0) {
    deleteUserFromAllDevices(cleanNos)
      .then((res) => {
        console.log(`[hardware-purge] Purged tokens [${cleanNos.join(", ")}] from terminals:`, res);
      })
      .catch((err) => {
        console.warn(`[hardware-purge] Notice purging biometric terminals for ${userId}:`, err?.message || err);
      });
  }

  // 4. Purge schedule window scopes (remove id from applicableTeacherIds and exempt arrays)
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

  try {
    cache.invalidateTag("user");
    cache.invalidateTag("studentprofile");
    cache.invalidateTag("teacherprofile");
    cache.invalidateTag("parentprofile");
    cache.invalidateTag("dashboard");
    cache.invalidateTag("stats");
    cache.invalidateTag("attendanceRecord");
  } catch (err) {
    // Non-fatal
  }

  return {
    success: true,
    userId: resolvedUserId,
    role: user.role,
    deletedBiometricIds: cleanNos,
    hardwareStatus,
  };
}
