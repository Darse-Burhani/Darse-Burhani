-- CreateIndex
CREATE INDEX "attendance_records_classId_date_status_idx" ON "attendance_records"("classId", "date", "status");

-- CreateIndex
CREATE INDEX "badge_progress_studentId_isEarned_idx" ON "badge_progress"("studentId", "isEarned");

-- CreateIndex
CREATE INDEX "class_enrollments_studentId_isActive_idx" ON "class_enrollments"("studentId", "isActive");

-- CreateIndex
CREATE INDEX "class_enrollments_classId_isActive_idx" ON "class_enrollments"("classId", "isActive");

-- CreateIndex
CREATE INDEX "classes_teacherId_isActive_idx" ON "classes"("teacherId", "isActive");

-- CreateIndex
CREATE INDEX "mood_checkins_studentId_date_idx" ON "mood_checkins"("studentId", "date");

-- CreateIndex
CREATE INDEX "point_logs_teacherId_createdAt_idx" ON "point_logs"("teacherId", "createdAt");

-- CreateIndex
CREATE INDEX "point_logs_studentId_createdAt_idx" ON "point_logs"("studentId", "createdAt");

-- CreateIndex
CREATE INDEX "student_profiles_userId_idx" ON "student_profiles"("userId");

-- CreateIndex
CREATE INDEX "student_profiles_grade_section_idx" ON "student_profiles"("grade", "section");

-- CreateIndex
CREATE INDEX "teacher_profiles_userId_idx" ON "teacher_profiles"("userId");
