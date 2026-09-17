-- Musa'id (المساعد) as a hafiz talabt: a fellow student who assists the muhaffiz.
-- Legacy musaidId (teacher) is kept for history; new assignments use musaidStudentId.
ALTER TABLE "hifz_marhala_assignments"
  ADD COLUMN "musaidStudentId" TEXT;

ALTER TABLE "hifz_marhala_assignments"
  ADD CONSTRAINT "hifz_marhala_assignments_musaidStudentId_fkey"
  FOREIGN KEY ("musaidStudentId") REFERENCES "student_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "hifz_marhala_assignments_musaidStudentId_idx"
  ON "hifz_marhala_assignments"("musaidStudentId");
