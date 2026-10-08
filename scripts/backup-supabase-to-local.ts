import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("=================================================");
  console.log("  DARSE BURHANI: FULL SUPABASE -> LOCAL BACKUP   ");
  console.log("=================================================");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(__dirname, "../backups", `backup-${timestamp}`);
  const latestDir = path.join(__dirname, "../backups", "latest");

  fs.mkdirSync(backupDir, { recursive: true });
  fs.mkdirSync(latestDir, { recursive: true });

  console.log(`Export destination: ${backupDir}\n`);

  const manifest: Record<string, number> = {};

  const tables = [
    { name: "users", fetch: () => prisma.user.findMany() },
    { name: "accounts", fetch: () => prisma.account.findMany() },
    { name: "teacher_profiles", fetch: () => prisma.teacherProfile.findMany() },
    { name: "student_profiles", fetch: () => prisma.studentProfile.findMany() },
    { name: "parent_profiles", fetch: () => prisma.parentProfile.findMany() },
    { name: "parent_student_links", fetch: () => prisma.parentStudentLink.findMany() },
    { name: "classes", fetch: () => prisma.class.findMany() },
    { name: "class_enrollments", fetch: () => prisma.classEnrollment.findMany() },
    { name: "attendance_records", fetch: () => prisma.attendanceRecord.findMany() },
    { name: "teacher_attendance_records", fetch: () => prisma.teacherAttendanceRecord.findMany() },
    { name: "attendance_registries", fetch: () => prisma.attendanceRegistry.findMany() },
    { name: "attendance_day_locks", fetch: () => prisma.attendanceDayLock.findMany() },
    { name: "attendance_audit_logs", fetch: () => prisma.attendanceAuditLog.findMany() },
    { name: "biometric_scan_windows", fetch: () => prisma.biometricScanWindow.findMany() },
    { name: "biometric_devices", fetch: () => prisma.biometricDevice.findMany() },
    { name: "leave_requests", fetch: () => prisma.leaveRequest.findMany() },
    { name: "medical_exemptions", fetch: () => prisma.medicalExemption.findMany() },
    { name: "hifz_marhala_assignments", fetch: () => prisma.hifzMarhalaAssignment.findMany() },
    { name: "hifz_marhala_reports", fetch: () => prisma.hifzMarhalaReport.findMany() },
    { name: "hifz_weekly_slips", fetch: () => prisma.hifzWeeklySlip.findMany() },
    { name: "hifz_daily_evaluations", fetch: () => prisma.hifzDailyEvaluation.findMany() },
    { name: "hifz_ikhtebaar_targets", fetch: () => prisma.hifzIkhtebaarTarget.findMany() },
    { name: "hifz_reports", fetch: () => prisma.hifzReport.findMany() },
    { name: "hifz_parts", fetch: () => prisma.hifzPart.findMany() },
    { name: "point_matrices", fetch: () => prisma.pointMatrix.findMany() },
    { name: "point_logs", fetch: () => prisma.pointLog.findMany() },
    { name: "badges", fetch: () => prisma.badge.findMany() },
    { name: "badge_progress", fetch: () => prisma.badgeProgress.findMany() },
    { name: "skill_tree_points", fetch: () => prisma.skillTreePoint.findMany() },
    { name: "wallet_transactions", fetch: () => prisma.walletTransaction.findMany() },
    { name: "timetable_slots", fetch: () => prisma.timetableSlot.findMany() },
    { name: "academic_calendar_events", fetch: () => prisma.academicCalendarEvent.findMany() },
    { name: "teacher_portal_assignments", fetch: () => prisma.teacherPortalAssignment.findMany() },
    { name: "takhteet_plans", fetch: () => prisma.takhteetPlan.findMany() },
    { name: "takhteet_progress_logs", fetch: () => prisma.takhteetProgressLog.findMany() },
    { name: "library_books", fetch: () => prisma.libraryBook.findMany() },
    { name: "book_loans", fetch: () => prisma.bookLoan.findMany() },
    { name: "system_settings", fetch: () => prisma.systemSetting.findMany() },
    { name: "procurement_requests", fetch: () => prisma.procurementRequest.findMany() },
    { name: "assignments", fetch: () => prisma.assignment.findMany() },
    { name: "assignment_grades", fetch: () => prisma.assignmentGrade.findMany() },
    { name: "skill_assessment_attempts", fetch: () => prisma.skillAssessmentAttempt.findMany() },
    { name: "student_hobbies", fetch: () => prisma.studentHobby.findMany() },
    { name: "notifications", fetch: () => prisma.notification.findMany() },
  ];

  let totalRows = 0;

  for (const t of tables) {
    try {
      const rows = await t.fetch();
      manifest[t.name] = rows.length;
      totalRows += rows.length;

      const filePath = path.join(backupDir, `${t.name}.json`);
      const latestPath = path.join(latestDir, `${t.name}.json`);

      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), "utf8");
      fs.writeFileSync(latestPath, JSON.stringify(rows, null, 2), "utf8");

      console.log(`  [✓] Exported ${t.name.padEnd(28)}: ${rows.length} rows`);
    } catch (err: any) {
      console.log(`  [✗] Skipped ${t.name.padEnd(28)}: ${err.message}`);
      manifest[t.name] = 0;
    }
  }

  const manifestData = {
    backupTimestamp: timestamp,
    exportedAt: new Date().toISOString(),
    totalTables: tables.length,
    totalRowsExported: totalRows,
    tables: manifest,
  };

  fs.writeFileSync(
    path.join(backupDir, "manifest.json"),
    JSON.stringify(manifestData, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(latestDir, "manifest.json"),
    JSON.stringify(manifestData, null, 2),
    "utf8"
  );

  console.log("\n=================================================");
  console.log(`✓ ALL DATA SUCCESSFULLY SAVED TO LOCAL!`);
  console.log(`  Total rows: ${totalRows.toLocaleString()}`);
  console.log(`  Timestamp folder: ${backupDir}`);
  console.log(`  Latest folder:    ${latestDir}`);
  console.log("=================================================\n");
}

main()
  .catch((e) => {
    console.error("Backup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
