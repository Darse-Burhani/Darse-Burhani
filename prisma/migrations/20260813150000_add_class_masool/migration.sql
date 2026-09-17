-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "masoolId" TEXT;

-- CreateIndex
CREATE INDEX "classes_masoolId_idx" ON "classes"("masoolId");

-- AddForeignKey
ALTER TABLE "classes" ADD CONSTRAINT "classes_masoolId_fkey" FOREIGN KEY ("masoolId") REFERENCES "teacher_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
