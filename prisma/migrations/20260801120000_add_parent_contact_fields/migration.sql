-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "dobGregorian" TIMESTAMP(3),
ADD COLUMN     "dobHijri" TEXT,
ADD COLUMN     "fatherEmail" TEXT,
ADD COLUMN     "fatherPhone" TEXT,
ADD COLUMN     "hafizYear" TEXT,
ADD COLUMN     "motherEmail" TEXT,
ADD COLUMN     "motherPhone" TEXT;
