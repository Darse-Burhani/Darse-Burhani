import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: path.join(__dirname, "../server/.env") });
dotenv.config({ path: path.join(__dirname, "../.env") });

const targetDbUrl = process.env.LOCAL_DATABASE_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: targetDbUrl,
    },
  },
});

async function main() {
  const sourceDir = process.argv[2] 
    ? path.resolve(process.argv[2]) 
    : path.join(__dirname, "../backups/latest");

  if (!fs.existsSync(sourceDir)) {
    console.error(`Error: Backup directory not found: ${sourceDir}`);
    process.exit(1);
  }

  console.log("=================================================");
  console.log("  DARSE BURHANI: RESTORE LOCAL BACKUP TO DB      ");
  console.log("=================================================");
  console.log(`Source backup: ${sourceDir}`);
  console.log(`Target DB:     ${targetDbUrl?.split("@")[1] || "configured database"}\n`);

  function loadJson(table: string): any[] {
    const p = path.join(sourceDir, `${table}.json`);
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, "utf8"));
  }

  // Restore in dependency order
  const order = [
    { name: "users", model: prisma.user },
    { name: "accounts", model: prisma.account },
    { name: "teacher_profiles", model: prisma.teacherProfile },
    { name: "student_profiles", model: prisma.studentProfile },
    { name: "parent_profiles", model: prisma.parentProfile },
    { name: "parent_student_links", model: prisma.parentStudentLink },
    { name: "classes", model: prisma.class },
    { name: "class_enrollments", model: prisma.classEnrollment },
    { name: "attendance_records", model: prisma.attendanceRecord },
    { name: "teacher_attendance_records", model: prisma.teacherAttendanceRecord },
    { name: "attendance_registries", model: prisma.attendanceRegistry },
    { name: "biometric_scan_windows", model: prisma.biometricScanWindow },
    { name: "biometric_devices", model: prisma.biometricDevice },
    { name: "leave_requests", model: prisma.leaveRequest },
    { name: "medical_exemptions", model: prisma.medicalExemption },
    { name: "hifz_marhala_assignments", model: prisma.hifzMarhalaAssignment },
    { name: "hifz_marhala_reports", model: prisma.hifzMarhalaReport },
    { name: "hifz_weekly_slips", model: prisma.hifzWeeklySlip },
    { name: "hifz_daily_evaluations", model: prisma.hifzDailyEvaluation },
    { name: "hifz_ikhtebaar_targets", model: prisma.hifzIkhtebaarTarget },
    { name: "hifz_reports", model: prisma.hifzReport },
    { name: "hifz_parts", model: prisma.hifzPart },
    { name: "point_matrices", model: prisma.pointMatrix },
    { name: "point_logs", model: prisma.pointLog },
    { name: "badges", model: prisma.badge },
    { name: "badge_progress", model: prisma.badgeProgress },
    { name: "skill_tree_points", model: prisma.skillTreePoint },
    { name: "wallet_transactions", model: prisma.walletTransaction },
    { name: "timetable_slots", model: prisma.timetableSlot },
    { name: "academic_calendar_events", model: prisma.academicCalendarEvent },
    { name: "teacher_portal_assignments", model: prisma.teacherPortalAssignment },
    { name: "takhteet_plans", model: prisma.takhteetPlan },
    { name: "takhteet_progress_logs", model: prisma.takhteetProgressLog },
    { name: "library_books", model: prisma.libraryBook },
    { name: "book_loans", model: prisma.bookLoan },
    { name: "system_settings", model: prisma.systemSetting },
    { name: "procurement_requests", model: prisma.procurementRequest },
    { name: "assignments", model: prisma.assignment },
    { name: "assignment_grades", model: prisma.assignmentGrade },
    { name: "skill_assessment_attempts", model: prisma.skillAssessmentAttempt },
    { name: "student_hobbies", model: prisma.studentHobby },
    { name: "notifications", model: prisma.notification },
  ];

  let restoredCount = 0;

  for (const item of order) {
    const rows = loadJson(item.name);
    if (rows.length === 0) continue;

    process.stdout.write(`  Restoring ${item.name.padEnd(30)} (${rows.length} rows)... `);
    let tableRestored = 0;

    for (const row of rows) {
      try {
        await (item.model as any).upsert({
          where: { id: row.id },
          update: row,
          create: row,
        });
        tableRestored++;
      } catch (err: any) {
        // Fallback to simple create
        try {
          await (item.model as any).create({ data: row });
          tableRestored++;
        } catch {}
      }
    }

    restoredCount += tableRestored;
    console.log(`✓ ${tableRestored}/${rows.length} restored`);
  }

  console.log("\n=================================================");
  console.log(`✓ RESTORE COMPLETE: ${restoredCount} records processed`);
  console.log("=================================================\n");
}

main()
  .catch((e) => {
    console.error("Restore failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
