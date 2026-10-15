-- ============================================================================
-- REPAIR MIGRATION (baseline reconstruction)
-- ============================================================================
-- The migration history in this repository is incomplete: the tables below are
-- referenced by later migrations (and by Prisma schema.prisma) but were never
-- created by any migration. They originally existed in databases created with
-- `prisma db push` rather than `prisma migrate`, so `prisma migrate deploy`
-- failed on a fresh database with:
--
--   P3018 ... relation "hifz_marhala_assignments" does not exist
--
-- This migration recreates them in their ORIGINAL (pre-20260911) shape so the
-- existing migrations that mutate them still apply cleanly:
--   * 20260911000000 adds "musaidStudentId"        -> absent here on purpose
--   * 20261003000000 drops NOT NULL on "facultyId" -> NOT NULL here on purpose
--   * 20261003120000 converts "marhala" enum values 1-8 -> 4-8
-- The "HifzMarhala" enum is therefore created with its ORIGINAL values 1..5.

-- Enums -----------------------------------------------------------------
CREATE TYPE "HifzMarhala" AS ENUM ('MARHALA_1', 'MARHALA_2', 'MARHALA_3', 'MARHALA_4', 'MARHALA_5');

CREATE TYPE "HifzReportSource" AS ENUM ('TALABAT_SELF', 'FACULTY_ASSIGNED', 'ADMIN');

CREATE TYPE "HifzReportStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED');

CREATE TYPE "HifzWeeklySlipStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'REJECTED');

-- Tables -----------------------------------------------------------------
CREATE TABLE "hifz_marhala_assignments" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marhala" "HifzMarhala" NOT NULL,
    "assignedById" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "musaidId" TEXT,
    "academicYear" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hifz_marhala_assignments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hifz_marhala_reports" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "marhala" "HifzMarhala" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "source" "HifzReportSource" NOT NULL DEFAULT 'TALABAT_SELF',
    "status" "HifzReportStatus" NOT NULL DEFAULT 'DRAFT',
    "its" TEXT,
    "name" TEXT,
    "currentJuz" INTEGER,
    "currentSafah" INTEGER,
    "totalJadeedPages" INTEGER,
    "ajzaMatruka" INTEGER,
    "weakAjza" INTEGER,
    "murajaatMarks" INTEGER DEFAULT 0,
    "juzhaliMarks" INTEGER DEFAULT 0,
    "jadeedMarks" INTEGER DEFAULT 0,
    "totalMarks" INTEGER DEFAULT 0,
    "overallPerformance" DOUBLE PRECISION DEFAULT 0,
    "notes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hifz_marhala_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hifz_weekly_slips" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "marhala" "HifzMarhala" NOT NULL,
    "academicYear" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "weekStartDate" TIMESTAMP(3),
    "weekEndDate" TIMESTAMP(3),
    "status" "HifzWeeklySlipStatus" NOT NULL DEFAULT 'DRAFT',
    "prevJuz" INTEGER,
    "prevSafah" INTEGER,
    "prevMurajaatStatus" TEXT,
    "currentJuz" INTEGER,
    "currentSafah" INTEGER,
    "sabaqLines" INTEGER,
    "murajaatSabqi" TEXT,
    "disciplineRating" INTEGER DEFAULT 5,
    "murajaatMarks" INTEGER DEFAULT 0,
    "juzhaliMarks" INTEGER DEFAULT 0,
    "jadeedMarks" INTEGER DEFAULT 0,
    "totalMarks" INTEGER DEFAULT 0,
    "overallPerformance" DOUBLE PRECISION DEFAULT 0,
    "teacherNotes" TEXT,
    "adminNotes" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hifz_weekly_slips_pkey" PRIMARY KEY ("id")
);

-- Indexes ----------------------------------------------------------------
CREATE INDEX "hifz_marhala_assignments_facultyId_idx" ON "hifz_marhala_assignments"("facultyId");

CREATE INDEX "hifz_marhala_assignments_musaidId_idx" ON "hifz_marhala_assignments"("musaidId");

CREATE INDEX "hifz_marhala_assignments_academicYear_idx" ON "hifz_marhala_assignments"("academicYear");

CREATE INDEX "hifz_marhala_assignments_assignedById_idx" ON "hifz_marhala_assignments"("assignedById");

CREATE INDEX "hifz_marhala_assignments_academicYear_marhala_idx" ON "hifz_marhala_assignments"("academicYear", "marhala");

CREATE UNIQUE INDEX "hifz_marhala_assignments_studentId_academicYear_key" ON "hifz_marhala_assignments"("studentId", "academicYear");

CREATE INDEX "hifz_marhala_reports_studentId_idx" ON "hifz_marhala_reports"("studentId");

CREATE INDEX "hifz_marhala_reports_facultyId_idx" ON "hifz_marhala_reports"("facultyId");

CREATE INDEX "hifz_marhala_reports_academicYear_idx" ON "hifz_marhala_reports"("academicYear");

CREATE INDEX "hifz_marhala_reports_status_idx" ON "hifz_marhala_reports"("status");

CREATE INDEX "hifz_marhala_reports_reviewedById_idx" ON "hifz_marhala_reports"("reviewedById");

CREATE UNIQUE INDEX "hifz_marhala_reports_studentId_academicYear_marhala_key" ON "hifz_marhala_reports"("studentId", "academicYear", "marhala");

CREATE INDEX "hifz_weekly_slips_studentId_idx" ON "hifz_weekly_slips"("studentId");

CREATE INDEX "hifz_weekly_slips_facultyId_idx" ON "hifz_weekly_slips"("facultyId");

CREATE INDEX "hifz_weekly_slips_academicYear_weekNumber_idx" ON "hifz_weekly_slips"("academicYear", "weekNumber");

CREATE INDEX "hifz_weekly_slips_status_idx" ON "hifz_weekly_slips"("status");

CREATE INDEX "hifz_weekly_slips_reviewedById_idx" ON "hifz_weekly_slips"("reviewedById");

CREATE UNIQUE INDEX "hifz_weekly_slips_studentId_academicYear_weekNumber_key" ON "hifz_weekly_slips"("studentId", "academicYear", "weekNumber");

-- Foreign keys ------------------------------------------------------------
ALTER TABLE "hifz_marhala_assignments" ADD CONSTRAINT "hifz_marhala_assignments_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hifz_marhala_assignments" ADD CONSTRAINT "hifz_marhala_assignments_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hifz_marhala_assignments" ADD CONSTRAINT "hifz_marhala_assignments_musaidId_fkey" FOREIGN KEY ("musaidId") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hifz_marhala_assignments" ADD CONSTRAINT "hifz_marhala_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hifz_marhala_reports" ADD CONSTRAINT "hifz_marhala_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hifz_marhala_reports" ADD CONSTRAINT "hifz_marhala_reports_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hifz_marhala_reports" ADD CONSTRAINT "hifz_marhala_reports_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hifz_weekly_slips" ADD CONSTRAINT "hifz_weekly_slips_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hifz_weekly_slips" ADD CONSTRAINT "hifz_weekly_slips_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hifz_weekly_slips" ADD CONSTRAINT "hifz_weekly_slips_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
