-- CreateEnum
CREATE TYPE "JustificationStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "attendance_records" ADD COLUMN     "justification" TEXT,
ADD COLUMN     "justificationStatus" "JustificationStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "justificationSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "justifiedAt" TIMESTAMP(3),
ADD COLUMN     "justifiedById" TEXT;
