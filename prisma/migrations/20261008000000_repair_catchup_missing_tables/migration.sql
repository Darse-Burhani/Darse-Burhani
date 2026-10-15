-- ============================================================================
-- REPAIR MIGRATION (catch-up for tables missing from the history)
-- ============================================================================
-- These 11 tables and 7 enums exist in prisma/schema.prisma but were never
-- emitted into the migration history (the databases they were developed
-- against were created with `prisma db push`). Unlike the hifz_marhala_*
-- tables, nothing in the existing history references them, so they are
-- created here in their final schema shape.
--
-- Statement order matters: `leave_requests` is created before
-- `attendance_registries`, which has a foreign key onto it.

-- Enums -----------------------------------------------------------------
CREATE TYPE "LeaveType" AS ENUM ('MEDICAL', 'PERSONAL', 'FAMILY_EMERGENCY', 'OTHER');

CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

CREATE TYPE "AttendanceSource" AS ENUM ('BIOMETRIC', 'MANUAL', 'AUTO_ABSENT', 'MEDICAL_LEAVE', 'LEAVE_APPROVED');

CREATE TYPE "ProcurementStatus" AS ENUM ('PENDING', 'APPROVED', 'ORDERED', 'FULFILLED', 'REJECTED', 'CANCELLED');

CREATE TYPE "ProcurementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- Tables -----------------------------------------------------------------
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "hifz_daily_evaluations" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "facultyId" TEXT,
    "evaluationDate" DATE NOT NULL,
    "academicYear" TEXT NOT NULL,
    "marhala" TEXT,
    "currentJuz" INTEGER,
    "currentSafah" INTEGER,
    "sabaqSurah" TEXT,
    "sabaqAyahFrom" INTEGER,
    "sabaqAyahTo" INTEGER,
    "sabaqLines" INTEGER DEFAULT 0,
    "sabaqMarks" DOUBLE PRECISION DEFAULT 0,
    "sabqiJuz" INTEGER,
    "sabqiSafah" INTEGER,
    "sabqiMarks" DOUBLE PRECISION DEFAULT 0,
    "murajaatJuz" INTEGER,
    "murajaatSafah" INTEGER,
    "murajaatMarks" DOUBLE PRECISION DEFAULT 0,
    "totalMarks" DOUBLE PRECISION DEFAULT 0,
    "performanceRating" TEXT DEFAULT 'GOOD',
    "attendanceStatus" TEXT DEFAULT 'PRESENT',
    "teacherRemarks" TEXT,
    "source" TEXT NOT NULL DEFAULT 'ELEARNING_QURAN',
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hifz_daily_evaluations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "hifz_ikhtebaar_targets" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "targetMarhala" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "targetJuzCount" INTEGER NOT NULL DEFAULT 1,
    "targetDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "pagesCompleted" INTEGER NOT NULL DEFAULT 0,
    "totalPagesRequired" INTEGER NOT NULL DEFAULT 20,
    "readinessPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "murajaatCompleted" BOOLEAN NOT NULL DEFAULT false,
    "weakAjzaCleared" BOOLEAN NOT NULL DEFAULT true,
    "examDate" TIMESTAMP(3),
    "examinerName" TEXT,
    "resultScore" DOUBLE PRECISION,
    "resultGrade" TEXT,
    "adminRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hifz_ikhtebaar_targets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teacher_attendance_records" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "verificationMethod" TEXT DEFAULT 'BIOMETRIC',
    "biometricMethod" TEXT,
    "biometricHash" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_attendance_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "procurement_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'STATIONERY',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT DEFAULT 'pcs',
    "officeLocation" TEXT NOT NULL,
    "priority" "ProcurementPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ProcurementStatus" NOT NULL DEFAULT 'PENDING',
    "estimatedCost" DOUBLE PRECISION,
    "actualCost" DOUBLE PRECISION,
    "reason" TEXT,
    "specsOrLink" TEXT,
    "assignedToId" TEXT,
    "reviewerNotes" TEXT,
    "invoiceRef" TEXT,
    "expectedDelivery" TIMESTAMP(3),
    "fulfilledAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procurement_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "leave_requests" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "LeaveType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "attachmentUrl" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewerNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance_registries" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "source" "AttendanceSource" NOT NULL DEFAULT 'BIOMETRIC',
    "checkInTime" TIMESTAMP(3),
    "checkOutTime" TIMESTAMP(3),
    "remarks" TEXT,
    "leaveId" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_registries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "attendance_day_locks" (
    "date" TIMESTAMP(3) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT true,
    "lockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedById" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,

    CONSTRAINT "attendance_day_locks_pkey" PRIMARY KEY ("date")
);

CREATE TABLE "attendance_audit_logs" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "studentId" TEXT,
    "teacherId" TEXT,
    "action" TEXT NOT NULL,
    "oldStatus" TEXT,
    "newStatus" TEXT,
    "oldSource" TEXT,
    "newSource" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "actorRole" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "medical_exemptions" (
    "id" TEXT NOT NULL,
    "personType" TEXT NOT NULL,
    "studentId" TEXT,
    "teacherId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT,
    "eventName" TEXT,
    "reason" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedByName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "medical_exemptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "talabat_profiles_1447" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "year" TEXT NOT NULL DEFAULT '1447 H',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "studentPhotoUrl" TEXT,
    "name" TEXT,
    "itsNo" TEXT,
    "idNo" TEXT,
    "jamaat" TEXT,
    "vatan" TEXT,
    "nationality" TEXT DEFAULT 'Indian',
    "dob" TEXT,
    "age" INTEGER,
    "fatherPhotoUrl" TEXT,
    "fatherName" TEXT,
    "fatherOccupation" TEXT,
    "motherPhotoUrl" TEXT,
    "motherName" TEXT,
    "motherOccupation" TEXT,
    "result1444" TEXT,
    "result1445" TEXT,
    "result1446" TEXT,
    "result1447" TEXT,
    "hifzYear" TEXT,
    "hifzTabaqa" TEXT,
    "course1" TEXT,
    "course2" TEXT,
    "course3" TEXT,
    "course4" TEXT,
    "activities" TEXT,
    "otherExams" TEXT,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aboutMyself" TEXT,
    "behaviourRating" INTEGER,
    "communicationRating" INTEGER,
    "dedicationRating" INTEGER,
    "disciplineRating" INTEGER,
    "masoolRemarks" TEXT,
    "remarksMasool" TEXT,
    "remarksTahfeez" TEXT,
    "remarksTaleem" TEXT,
    "remarksTadeeb" TEXT,
    "remarksTanzeem" TEXT,
    "remarksSports" TEXT,
    "remarksMaktabat" TEXT,
    "remarksSkills" TEXT,
    "remarksOtherExams" TEXT,
    "remarksCounselling" TEXT,
    "counsellingNotes" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "talabat_profiles_1447_pkey" PRIMARY KEY ("id")
);

-- Indexes ----------------------------------------------------------------
CREATE INDEX "hifz_daily_evaluations_studentId_academicYear_idx" ON "hifz_daily_evaluations"("studentId", "academicYear");

CREATE INDEX "hifz_daily_evaluations_facultyId_idx" ON "hifz_daily_evaluations"("facultyId");

CREATE INDEX "hifz_daily_evaluations_evaluationDate_idx" ON "hifz_daily_evaluations"("evaluationDate");

CREATE INDEX "hifz_daily_evaluations_academicYear_idx" ON "hifz_daily_evaluations"("academicYear");

CREATE UNIQUE INDEX "hifz_daily_evaluations_studentId_evaluationDate_key" ON "hifz_daily_evaluations"("studentId", "evaluationDate");

CREATE INDEX "hifz_ikhtebaar_targets_studentId_idx" ON "hifz_ikhtebaar_targets"("studentId");

CREATE INDEX "hifz_ikhtebaar_targets_status_idx" ON "hifz_ikhtebaar_targets"("status");

CREATE INDEX "teacher_attendance_records_teacherId_idx" ON "teacher_attendance_records"("teacherId");

CREATE INDEX "teacher_attendance_records_date_idx" ON "teacher_attendance_records"("date");

CREATE INDEX "teacher_attendance_records_status_idx" ON "teacher_attendance_records"("status");

CREATE INDEX "teacher_attendance_records_verificationMethod_idx" ON "teacher_attendance_records"("verificationMethod");

CREATE UNIQUE INDEX "teacher_attendance_records_teacherId_date_key" ON "teacher_attendance_records"("teacherId", "date");

CREATE INDEX "procurement_requests_requesterId_idx" ON "procurement_requests"("requesterId");

CREATE INDEX "procurement_requests_status_idx" ON "procurement_requests"("status");

CREATE INDEX "procurement_requests_createdAt_idx" ON "procurement_requests"("createdAt");

CREATE INDEX "procurement_requests_assignedToId_idx" ON "procurement_requests"("assignedToId");

CREATE INDEX "leave_requests_studentId_idx" ON "leave_requests"("studentId");

CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");

CREATE INDEX "leave_requests_startDate_endDate_idx" ON "leave_requests"("startDate", "endDate");

CREATE INDEX "leave_requests_reviewerId_idx" ON "leave_requests"("reviewerId");

CREATE INDEX "attendance_registries_date_idx" ON "attendance_registries"("date");

CREATE INDEX "attendance_registries_studentId_idx" ON "attendance_registries"("studentId");

CREATE INDEX "attendance_registries_status_idx" ON "attendance_registries"("status");

CREATE INDEX "attendance_registries_source_idx" ON "attendance_registries"("source");

CREATE INDEX "attendance_registries_leaveId_idx" ON "attendance_registries"("leaveId");

CREATE UNIQUE INDEX "attendance_registries_studentId_date_key" ON "attendance_registries"("studentId", "date");

CREATE INDEX "attendance_audit_logs_date_idx" ON "attendance_audit_logs"("date");

CREATE INDEX "attendance_audit_logs_studentId_idx" ON "attendance_audit_logs"("studentId");

CREATE INDEX "attendance_audit_logs_teacherId_idx" ON "attendance_audit_logs"("teacherId");

CREATE INDEX "attendance_audit_logs_actorId_idx" ON "attendance_audit_logs"("actorId");

CREATE INDEX "attendance_audit_logs_entityType_entityId_idx" ON "attendance_audit_logs"("entityType", "entityId");

CREATE INDEX "attendance_audit_logs_action_idx" ON "attendance_audit_logs"("action");

CREATE INDEX "medical_exemptions_date_idx" ON "medical_exemptions"("date");

CREATE INDEX "medical_exemptions_studentId_idx" ON "medical_exemptions"("studentId");

CREATE INDEX "medical_exemptions_teacherId_idx" ON "medical_exemptions"("teacherId");

CREATE INDEX "medical_exemptions_assignedById_idx" ON "medical_exemptions"("assignedById");

CREATE INDEX "medical_exemptions_personType_date_idx" ON "medical_exemptions"("personType", "date");

CREATE UNIQUE INDEX "talabat_profiles_1447_studentId_key" ON "talabat_profiles_1447"("studentId");

CREATE INDEX "talabat_profiles_1447_studentId_idx" ON "talabat_profiles_1447"("studentId");

CREATE INDEX "talabat_profiles_1447_reviewedById_idx" ON "talabat_profiles_1447"("reviewedById");

-- Foreign keys ------------------------------------------------------------
ALTER TABLE "hifz_daily_evaluations" ADD CONSTRAINT "hifz_daily_evaluations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "hifz_daily_evaluations" ADD CONSTRAINT "hifz_daily_evaluations_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "hifz_ikhtebaar_targets" ADD CONSTRAINT "hifz_ikhtebaar_targets_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "teacher_attendance_records" ADD CONSTRAINT "teacher_attendance_records_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "procurement_requests" ADD CONSTRAINT "procurement_requests_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "attendance_registries" ADD CONSTRAINT "attendance_registries_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "attendance_registries" ADD CONSTRAINT "attendance_registries_leaveId_fkey" FOREIGN KEY ("leaveId") REFERENCES "leave_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "medical_exemptions" ADD CONSTRAINT "medical_exemptions_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "medical_exemptions" ADD CONSTRAINT "medical_exemptions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "talabat_profiles_1447" ADD CONSTRAINT "talabat_profiles_1447_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
