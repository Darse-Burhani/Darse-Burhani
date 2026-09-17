-- CreateEnum
CREATE TYPE "TakhteetStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "takhteet_plans" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "academicYear" TEXT NOT NULL,
    "month" INTEGER,
    "status" "TakhteetStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "assignedById" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "takhteet_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "takhteet_progress_logs" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "note" TEXT,
    "progressBefore" INTEGER NOT NULL DEFAULT 0,
    "progressAfter" INTEGER NOT NULL DEFAULT 0,
    "status" "TakhteetStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "takhteet_progress_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "takhteet_plans_teacherId_idx" ON "takhteet_plans"("teacherId");

-- CreateIndex
CREATE INDEX "takhteet_plans_classId_idx" ON "takhteet_plans"("classId");

-- CreateIndex
CREATE INDEX "takhteet_plans_academicYear_idx" ON "takhteet_plans"("academicYear");

-- CreateIndex
CREATE INDEX "takhteet_progress_logs_planId_idx" ON "takhteet_progress_logs"("planId");

-- AddForeignKey
ALTER TABLE "takhteet_plans" ADD CONSTRAINT "takhteet_plans_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takhteet_plans" ADD CONSTRAINT "takhteet_plans_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takhteet_progress_logs" ADD CONSTRAINT "takhteet_progress_logs_planId_fkey" FOREIGN KEY ("planId") REFERENCES "takhteet_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "takhteet_progress_logs" ADD CONSTRAINT "takhteet_progress_logs_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teacher_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
