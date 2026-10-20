-- ============================================================================
-- MIGRATION: Timetable Badal and Slot Fields
-- ============================================================================

-- CreateEnum if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'BadalStatus'
    ) THEN
        CREATE TYPE "BadalStatus" AS ENUM ('PENDING', 'ASSIGNED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');
    END IF;
END $$;

-- AlterTable timetable_slots
ALTER TABLE "timetable_slots" ADD COLUMN IF NOT EXISTS "className" TEXT;
ALTER TABLE "timetable_slots" ADD COLUMN IF NOT EXISTS "teacherId" TEXT;
ALTER TABLE "timetable_slots" ADD COLUMN IF NOT EXISTS "teacherName" TEXT;

-- CreateTable timetable_badals
CREATE TABLE IF NOT EXISTS "timetable_badals" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "slotId" TEXT,
    "classId" TEXT,
    "className" TEXT NOT NULL,
    "period" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "originalTeacherId" TEXT,
    "originalTeacherName" TEXT,
    "badalTeacherId" TEXT,
    "badalTeacherName" TEXT,
    "reason" TEXT NOT NULL,
    "status" "BadalStatus" NOT NULL DEFAULT 'ASSIGNED',
    "instructions" TEXT,
    "isFulfilled" BOOLEAN NOT NULL DEFAULT false,
    "assignedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "timetable_badals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "timetable_slots_teacherId_idx" ON "timetable_slots"("teacherId");
CREATE INDEX IF NOT EXISTS "timetable_slots_dayOfWeek_period_idx" ON "timetable_slots"("dayOfWeek", "period");

CREATE INDEX IF NOT EXISTS "timetable_badals_date_idx" ON "timetable_badals"("date");
CREATE INDEX IF NOT EXISTS "timetable_badals_status_idx" ON "timetable_badals"("status");
CREATE INDEX IF NOT EXISTS "timetable_badals_badalTeacherId_idx" ON "timetable_badals"("badalTeacherId");
CREATE INDEX IF NOT EXISTS "timetable_badals_originalTeacherId_idx" ON "timetable_badals"("originalTeacherId");
CREATE INDEX IF NOT EXISTS "timetable_badals_date_period_idx" ON "timetable_badals"("date", "period");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'timetable_slots_teacherId_fkey'
    ) THEN
        ALTER TABLE "timetable_slots" ADD CONSTRAINT "timetable_slots_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'timetable_badals_originalTeacherId_fkey'
    ) THEN
        ALTER TABLE "timetable_badals" ADD CONSTRAINT "timetable_badals_originalTeacherId_fkey" FOREIGN KEY ("originalTeacherId") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'timetable_badals_badalTeacherId_fkey'
    ) THEN
        ALTER TABLE "timetable_badals" ADD CONSTRAINT "timetable_badals_badalTeacherId_fkey" FOREIGN KEY ("badalTeacherId") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'timetable_badals_slotId_fkey'
    ) THEN
        ALTER TABLE "timetable_badals" ADD CONSTRAINT "timetable_badals_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "timetable_slots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'timetable_badals_classId_fkey'
    ) THEN
        ALTER TABLE "timetable_badals" ADD CONSTRAINT "timetable_badals_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
