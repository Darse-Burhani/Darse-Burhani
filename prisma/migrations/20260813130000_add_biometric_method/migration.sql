-- AlterTable: record which biometric (fingerprint vs facial) a scan used.
ALTER TABLE "attendance_records" ADD COLUMN "biometricMethod" TEXT;
