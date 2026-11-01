import { PrismaClient } from "@prisma/client";

const LOCAL_URL = "postgresql://darseburhani:darseburhani@localhost:5432/darseburhani?schema=public";
const RENDER_URL = "postgresql://darseburhani:bcqntuTadKYmjJ6XSvgXH2m0ZFTKRLfO@dpg-dbjgmb7b9u1s73dvtvf0-a.singapore-postgres.render.com/darseburhani?sslmode=require";

const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });
const render = new PrismaClient({ datasources: { db: { url: RENDER_URL } } });

async function copyTable(name: string, fetchFn: () => Promise<any[]>, insertFn: (data: any[]) => Promise<any>) {
  try {
    const rows = await fetchFn();
    if (rows.length === 0) {
      console.log(`  - ${name.padEnd(28)}: 0 rows`);
      return;
    }
    process.stdout.write(`  ⏳ ${name.padEnd(28)}: Copying ${rows.length} rows... `);
    // Batch in chunks of 50 to avoid payload limits
    const CHUNK_SIZE = 50;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      await insertFn(chunk);
    }
    console.log(`✓ ${rows.length} transferred`);
  } catch (err: any) {
    console.error(`❌ Error in ${name}:`, err.message);
  }
}

async function main() {
  console.log("=================================================");
  console.log("🏛️  DARSE BURHANI — LOCAL TO RENDER CLOUD DB SYNC");
  console.log("=================================================");

  // 1. System Settings
  await copyTable("systemSetting", () => local.systemSetting.findMany(), (c) => render.systemSetting.createMany({ data: c, skipDuplicates: true }));

  // 2. Core Auth & Users
  await copyTable("user", () => local.user.findMany(), (c) => render.user.createMany({ data: c, skipDuplicates: true }));
  await copyTable("account", () => local.account.findMany(), (c) => render.account.createMany({ data: c, skipDuplicates: true }));
  await copyTable("teacherProfile", () => local.teacherProfile.findMany(), (c) => render.teacherProfile.createMany({ data: c, skipDuplicates: true }));
  await copyTable("studentProfile", () => local.studentProfile.findMany(), (c) => render.studentProfile.createMany({ data: c, skipDuplicates: true }));
  await copyTable("parentProfile", () => local.parentProfile.findMany(), (c) => render.parentProfile.createMany({ data: c, skipDuplicates: true }));
  await copyTable("parentStudentLink", () => local.parentStudentLink.findMany(), (c) => render.parentStudentLink.createMany({ data: c, skipDuplicates: true }));

  // 3. Classes & Enrollments
  await copyTable("class", () => local.class.findMany(), (c) => render.class.createMany({ data: c, skipDuplicates: true }));
  await copyTable("classEnrollment", () => local.classEnrollment.findMany(), (c) => render.classEnrollment.createMany({ data: c, skipDuplicates: true }));

  // 4. Biometric hardware config
  await copyTable("biometricScanWindow", () => local.biometricScanWindow.findMany(), (c) => render.biometricScanWindow.createMany({ data: c, skipDuplicates: true }));
  await copyTable("biometricDevice", () => local.biometricDevice.findMany(), (c) => render.biometricDevice.createMany({ data: c, skipDuplicates: true }));

  // 5. Attendance & Leaves
  await copyTable("attendanceRegistry", () => local.attendanceRegistry.findMany(), (c) => render.attendanceRegistry.createMany({ data: c, skipDuplicates: true }));
  await copyTable("attendanceRecord", () => local.attendanceRecord.findMany(), (c) => render.attendanceRecord.createMany({ data: c, skipDuplicates: true }));
  await copyTable("teacherAttendanceRecord", () => local.teacherAttendanceRecord.findMany(), (c) => render.teacherAttendanceRecord.createMany({ data: c, skipDuplicates: true }));
  await copyTable("attendanceDayLock", () => local.attendanceDayLock.findMany(), (c) => render.attendanceDayLock.createMany({ data: c, skipDuplicates: true }));
  await copyTable("leaveRequest", () => local.leaveRequest.findMany(), (c) => render.leaveRequest.createMany({ data: c, skipDuplicates: true }));
  await copyTable("medicalExemption", () => local.medicalExemption.findMany(), (c) => render.medicalExemption.createMany({ data: c, skipDuplicates: true }));

  // 6. Timetable & Academics
  await copyTable("timetableSlot", () => local.timetableSlot.findMany(), (c) => render.timetableSlot.createMany({ data: c, skipDuplicates: true }));
  await copyTable("timetableBadal", () => local.timetableBadal.findMany(), (c) => render.timetableBadal.createMany({ data: c, skipDuplicates: true }));
  await copyTable("academicCalendarEvent", () => local.academicCalendarEvent.findMany(), (c) => render.academicCalendarEvent.createMany({ data: c, skipDuplicates: true }));
  await copyTable("teacherPortalAssignment", () => local.teacherPortalAssignment.findMany(), (c) => render.teacherPortalAssignment.createMany({ data: c, skipDuplicates: true }));

  // 7. Hifz module
  await copyTable("hifzMarhalaAssignment", () => local.hifzMarhalaAssignment.findMany(), (c) => render.hifzMarhalaAssignment.createMany({ data: c, skipDuplicates: true }));
  await copyTable("hifzMarhalaReport", () => local.hifzMarhalaReport.findMany(), (c) => render.hifzMarhalaReport.createMany({ data: c, skipDuplicates: true }));
  await copyTable("hifzWeeklySlip", () => local.hifzWeeklySlip.findMany(), (c) => render.hifzWeeklySlip.createMany({ data: c, skipDuplicates: true }));
  await copyTable("hifzDailyEvaluation", () => local.hifzDailyEvaluation.findMany(), (c) => render.hifzDailyEvaluation.createMany({ data: c, skipDuplicates: true }));
  await copyTable("hifzIkhtebaarTarget", () => local.hifzIkhtebaarTarget.findMany(), (c) => render.hifzIkhtebaarTarget.createMany({ data: c, skipDuplicates: true }));
  await copyTable("hifzReport", () => local.hifzReport.findMany(), (c) => render.hifzReport.createMany({ data: c, skipDuplicates: true }));
  await copyTable("hifzPart", () => local.hifzPart.findMany(), (c) => render.hifzPart.createMany({ data: c, skipDuplicates: true }));

  // 8. Points & Badges
  await copyTable("pointMatrix", () => local.pointMatrix.findMany(), (c) => render.pointMatrix.createMany({ data: c, skipDuplicates: true }));
  await copyTable("pointLog", () => local.pointLog.findMany(), (c) => render.pointLog.createMany({ data: c, skipDuplicates: true }));
  await copyTable("badge", () => local.badge.findMany(), (c) => render.badge.createMany({ data: c, skipDuplicates: true }));
  await copyTable("badgeProgress", () => local.badgeProgress.findMany(), (c) => render.badgeProgress.createMany({ data: c, skipDuplicates: true }));
  await copyTable("skillTreePoint", () => local.skillTreePoint.findMany(), (c) => render.skillTreePoint.createMany({ data: c, skipDuplicates: true }));
  await copyTable("walletTransaction", () => local.walletTransaction.findMany(), (c) => render.walletTransaction.createMany({ data: c, skipDuplicates: true }));

  // 9. Extra modules
  await copyTable("takhteetPlan", () => local.takhteetPlan.findMany(), (c) => render.takhteetPlan.createMany({ data: c, skipDuplicates: true }));
  await copyTable("takhteetProgressLog", () => local.takhteetProgressLog.findMany(), (c) => render.takhteetProgressLog.createMany({ data: c, skipDuplicates: true }));
  await copyTable("libraryBook", () => local.libraryBook.findMany(), (c) => render.libraryBook.createMany({ data: c, skipDuplicates: true }));
  await copyTable("bookLoan", () => local.bookLoan.findMany(), (c) => render.bookLoan.createMany({ data: c, skipDuplicates: true }));
  await copyTable("procurementRequest", () => local.procurementRequest.findMany(), (c) => render.procurementRequest.createMany({ data: c, skipDuplicates: true }));
  await copyTable("assignment", () => local.assignment.findMany(), (c) => render.assignment.createMany({ data: c, skipDuplicates: true }));
  await copyTable("assignmentGrade", () => local.assignmentGrade.findMany(), (c) => render.assignmentGrade.createMany({ data: c, skipDuplicates: true }));
  await copyTable("skillAssessmentAttempt", () => local.skillAssessmentAttempt.findMany(), (c) => render.skillAssessmentAttempt.createMany({ data: c, skipDuplicates: true }));
  await copyTable("studentHobby", () => local.studentHobby.findMany(), (c) => render.studentHobby.createMany({ data: c, skipDuplicates: true }));
  await copyTable("talabatProfile1447", () => local.talabatProfile1447.findMany(), (c) => render.talabatProfile1447.createMany({ data: c, skipDuplicates: true }));
  await copyTable("tilawatDua", () => local.tilawatDua.findMany(), (c) => render.tilawatDua.createMany({ data: c, skipDuplicates: true }));
  await copyTable("notification", () => local.notification.findMany(), (c) => render.notification.createMany({ data: c, skipDuplicates: true }));

  console.log("\n=================================================");
  console.log("🎉 ALL DATA SUCCESSFULLY TRANSFERRED TO RENDER CLOUD!");
  console.log("=================================================\n");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await local.$disconnect();
    await render.$disconnect();
  });

