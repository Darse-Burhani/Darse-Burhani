-- CreateTable
CREATE TABLE "assignments" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT,
    "skillCategory" TEXT,
    "maxMarks" INTEGER NOT NULL DEFAULT 100,
    "dueDate" TIMESTAMP(3),
    "grade" TEXT,
    "section" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_grades" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "marks" DOUBLE PRECISION NOT NULL,
    "feedback" TEXT,
    "gradedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_grades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_assessment_attempts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "skill" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "correctAnswers" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_hobbies" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "level" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "student_hobbies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assignments_grade_section_idx" ON "assignments"("grade", "section");
CREATE INDEX "assignments_createdById_idx" ON "assignments"("createdById");
CREATE UNIQUE INDEX "assignment_grades_assignmentId_studentId_key" ON "assignment_grades"("assignmentId", "studentId");
CREATE INDEX "assignment_grades_studentId_idx" ON "assignment_grades"("studentId");
CREATE INDEX "assignment_grades_assignmentId_idx" ON "assignment_grades"("assignmentId");
CREATE INDEX "skill_assessment_attempts_studentId_skill_idx" ON "skill_assessment_attempts"("studentId", "skill");
CREATE INDEX "skill_assessment_attempts_createdAt_idx" ON "skill_assessment_attempts"("createdAt");
CREATE INDEX "student_hobbies_studentId_idx" ON "student_hobbies"("studentId");

-- AddForeignKey
ALTER TABLE "assignment_grades" ADD CONSTRAINT "assignment_grades_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
