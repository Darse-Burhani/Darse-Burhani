-- CreateEnum
CREATE TYPE "StudentStatus" AS ENUM ('HAFIZ', 'SANAH');

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "address" TEXT,
ADD COLUMN     "admissionYear" TEXT,
ADD COLUMN     "age" INTEGER,
ADD COLUMN     "currentYear" TEXT,
ADD COLUMN     "darsId" TEXT,
ADD COLUMN     "externalSchooling" TEXT,
ADD COLUMN     "fatherName" TEXT,
ADD COLUMN     "fatherOccupation" TEXT,
ADD COLUMN     "its" TEXT,
ADD COLUMN     "mobileNumber" TEXT,
ADD COLUMN     "motherName" TEXT,
ADD COLUMN     "residentCity" TEXT,
ADD COLUMN     "status" "StudentStatus",
ADD COLUMN     "watan" TEXT;

-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "portfolioEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "timetable_slots" (
    "id" TEXT NOT NULL,
    "classId" TEXT,
    "dayOfWeek" INTEGER NOT NULL,
    "period" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "roomNumber" TEXT,
    "isBreak" BOOLEAN NOT NULL DEFAULT false,
    "breakName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_slots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "academic_calendar_events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "eventType" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "academic_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hifz_reports" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semester" TEXT,
    "totalParts" INTEGER NOT NULL DEFAULT 30,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hifz_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hifz_parts" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "partNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "isMemorized" BOOLEAN NOT NULL DEFAULT false,
    "isReviewed" BOOLEAN NOT NULL DEFAULT false,
    "isWeak" BOOLEAN NOT NULL DEFAULT false,
    "isAbandoned" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "targetReviews" INTEGER NOT NULL DEFAULT 20,
    "currentPage" INTEGER NOT NULL DEFAULT 0,
    "totalPages" INTEGER NOT NULL DEFAULT 20,
    "firmProgress" INTEGER NOT NULL DEFAULT 0,
    "firmTarget" INTEGER NOT NULL DEFAULT 10,
    "sentencesMemorized" INTEGER NOT NULL DEFAULT 0,
    "sentencePercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "murajaatMarks" INTEGER NOT NULL DEFAULT 0,
    "juzhaliMarks" INTEGER NOT NULL DEFAULT 0,
    "jadeedMarks" INTEGER NOT NULL DEFAULT 0,
    "totalMarks" INTEGER NOT NULL DEFAULT 0,
    "performancePercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pendingAjza" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hifz_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teacher_portal_assignments" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "portalType" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teacher_portal_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "timetable_slots_dayOfWeek_idx" ON "timetable_slots"("dayOfWeek");

-- CreateIndex
CREATE INDEX "academic_calendar_events_startDate_endDate_idx" ON "academic_calendar_events"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "hifz_reports_studentId_idx" ON "hifz_reports"("studentId");

-- CreateIndex
CREATE INDEX "hifz_reports_teacherId_idx" ON "hifz_reports"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "hifz_reports_studentId_academicYear_key" ON "hifz_reports"("studentId", "academicYear");

-- CreateIndex
CREATE INDEX "hifz_parts_reportId_idx" ON "hifz_parts"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "hifz_parts_reportId_partNumber_key" ON "hifz_parts"("reportId", "partNumber");

-- CreateIndex
CREATE INDEX "teacher_portal_assignments_teacherId_idx" ON "teacher_portal_assignments"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "teacher_portal_assignments_teacherId_portalType_key" ON "teacher_portal_assignments"("teacherId", "portalType");

-- AddForeignKey
ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hifz_reports" ADD CONSTRAINT "hifz_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hifz_reports" ADD CONSTRAINT "hifz_reports_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hifz_parts" ADD CONSTRAINT "hifz_parts_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "hifz_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teacher_portal_assignments" ADD CONSTRAINT "teacher_portal_assignments_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
