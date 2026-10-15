-- ============================================================================
-- REPAIR MIGRATION (schema drift cleanup)
-- ============================================================================
-- prisma/schema.prisma had drifted ahead of prisma/migrations: this applies
-- every remaining difference so that a database built purely from
-- `prisma migrate deploy` is identical to the schema the Prisma Client was
-- generated from. Without it, queries touching these columns/indexes fail at
-- runtime with P2022 ("column does not exist").
--
-- "mood_checkins" / "MoodState" are removed: they exist in the old migration
-- history but are no longer in schema.prisma, and no code references them.
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AttendanceStatus" ADD VALUE 'MEDICAL';
ALTER TYPE "AttendanceStatus" ADD VALUE 'ON_LEAVE';

-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_classId_fkey";

-- DropForeignKey
ALTER TABLE "attendance_records" DROP CONSTRAINT "attendance_records_studentId_fkey";

-- DropForeignKey
ALTER TABLE "classes" DROP CONSTRAINT "classes_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "hifz_reports" DROP CONSTRAINT "hifz_reports_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "mood_checkins" DROP CONSTRAINT "mood_checkins_studentId_fkey";

-- DropForeignKey
ALTER TABLE "point_logs" DROP CONSTRAINT "point_logs_classId_fkey";

-- DropForeignKey
ALTER TABLE "point_logs" DROP CONSTRAINT "point_logs_studentId_fkey";

-- DropForeignKey
ALTER TABLE "point_logs" DROP CONSTRAINT "point_logs_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "wallet_transactions" DROP CONSTRAINT "wallet_transactions_studentId_fkey";

-- AlterTable
ALTER TABLE "assignments" ADD COLUMN     "targetStudentId" TEXT;

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "source" "AttendanceSource" NOT NULL DEFAULT 'BIOMETRIC';

-- AlterTable
ALTER TABLE "biometric_scan_windows" ADD COLUMN     "applicableClassIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "exemptStudentIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "exemptTeacherIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'NORMAL',
ALTER COLUMN "type" SET DEFAULT 'ANNOUNCEMENT';

-- AlterTable
ALTER TABLE "parent_profiles" ADD COLUMN     "address" TEXT,
ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "its" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "relationType" TEXT,
ADD COLUMN     "secondaryPhone" TEXT,
ADD COLUMN     "watan" TEXT;

-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "aljameaDegree" TEXT,
ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "biometricHash" TEXT,
ADD COLUMN     "birthDateAd" TIMESTAMP(3),
ADD COLUMN     "birthDateH" TEXT,
ADD COLUMN     "farigDarajah" TEXT,
ADD COLUMN     "farigYear" TEXT,
ADD COLUMN     "hifzStatus" TEXT,
ADD COLUMN     "hifzYear" TEXT,
ADD COLUMN     "its" TEXT,
ADD COLUMN     "khidmatMauze" TEXT,
ADD COLUMN     "khidmatYear" TEXT,
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "photoUrl" TEXT,
ADD COLUMN     "roleTitle" TEXT,
ADD COLUMN     "subCategory" TEXT,
ADD COLUMN     "tEmail" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletedById" TEXT,
ADD COLUMN     "plainPassword" TEXT;

-- DropTable
DROP TABLE "mood_checkins";

-- DropEnum
DROP TYPE "MoodState";

-- CreateIndex
CREATE INDEX "academic_calendar_events_createdBy_idx" ON "academic_calendar_events"("createdBy");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE INDEX "assignment_grades_gradedById_idx" ON "assignment_grades"("gradedById");

-- CreateIndex
CREATE INDEX "assignments_targetStudentId_idx" ON "assignments"("targetStudentId");

-- CreateIndex
CREATE INDEX "attendance_records_date_idx" ON "attendance_records"("date");

-- CreateIndex
CREATE INDEX "attendance_records_date_status_idx" ON "attendance_records"("date", "status");

-- CreateIndex
CREATE INDEX "attendance_records_recordedById_idx" ON "attendance_records"("recordedById");

-- CreateIndex
CREATE INDEX "attendance_records_justifiedById_idx" ON "attendance_records"("justifiedById");

-- CreateIndex
CREATE INDEX "badge_progress_badgeId_idx" ON "badge_progress"("badgeId");

-- CreateIndex
CREATE INDEX "biometric_devices_status_enabled_idx" ON "biometric_devices"("status", "enabled");

-- CreateIndex
CREATE INDEX "classes_academicYear_isActive_idx" ON "classes"("academicYear", "isActive");

-- CreateIndex
CREATE INDEX "classes_grade_section_idx" ON "classes"("grade", "section");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "parent_profiles_its_idx" ON "parent_profiles"("its");

-- CreateIndex
CREATE INDEX "parent_profiles_phone_idx" ON "parent_profiles"("phone");

-- CreateIndex
CREATE INDEX "parent_student_links_studentId_idx" ON "parent_student_links"("studentId");

-- CreateIndex
CREATE INDEX "point_logs_matrixId_idx" ON "point_logs"("matrixId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "sessions_expires_idx" ON "sessions"("expires");

-- CreateIndex
CREATE INDEX "student_profiles_currentPoints_idx" ON "student_profiles"("currentPoints");

-- CreateIndex
CREATE INDEX "student_profiles_its_idx" ON "student_profiles"("its");

-- CreateIndex
CREATE INDEX "student_profiles_status_idx" ON "student_profiles"("status");

-- CreateIndex
CREATE INDEX "student_profiles_darsId_idx" ON "student_profiles"("darsId");

-- CreateIndex
CREATE INDEX "takhteet_plans_assignedById_idx" ON "takhteet_plans"("assignedById");

-- CreateIndex
CREATE INDEX "takhteet_progress_logs_teacherId_idx" ON "takhteet_progress_logs"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_profiles_biometricHash_key" ON "teacher_profiles"("biometricHash");

-- CreateIndex
CREATE INDEX "teacher_profiles_its_idx" ON "teacher_profiles"("its");

-- CreateIndex
CREATE INDEX "teacher_profiles_department_idx" ON "teacher_profiles"("department");

-- CreateIndex
CREATE INDEX "timetable_slots_classId_idx" ON "timetable_slots"("classId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "users"("deletedAt");

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_logs" ADD CONSTRAINT "point_logs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_logs" ADD CONSTRAINT "point_logs_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_logs" ADD CONSTRAINT "point_logs_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hifz_reports" ADD CONSTRAINT "hifz_reports_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_targetStudentId_fkey" FOREIGN KEY ("targetStudentId") REFERENCES "student_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_assessment_attempts" ADD CONSTRAINT "skill_assessment_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_hobbies" ADD CONSTRAINT "student_hobbies_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

