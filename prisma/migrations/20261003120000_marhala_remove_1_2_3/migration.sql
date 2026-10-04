-- AlterEnum
BEGIN;
CREATE TYPE "HifzMarhala_new" AS ENUM ('MARHALA_4', 'MARHALA_5', 'MARHALA_6', 'MARHALA_7', 'MARHALA_8');
ALTER TABLE "hifz_marhala_assignments" ALTER COLUMN "marhala" TYPE "HifzMarhala_new" USING ("marhala"::text::"HifzMarhala_new");
ALTER TABLE "hifz_marhala_reports" ALTER COLUMN "marhala" TYPE "HifzMarhala_new" USING ("marhala"::text::"HifzMarhala_new");
ALTER TABLE "hifz_weekly_slips" ALTER COLUMN "marhala" TYPE "HifzMarhala_new" USING ("marhala"::text::"HifzMarhala_new");
ALTER TYPE "HifzMarhala" RENAME TO "HifzMarhala_old";
ALTER TYPE "HifzMarhala_new" RENAME TO "HifzMarhala";
DROP TYPE "HifzMarhala_old";
COMMIT;
