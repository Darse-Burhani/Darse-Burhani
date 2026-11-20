-- Permanent raw Hikvision punch ledger.
-- Attendance is derived from this table, so scans survive bridge outages,
-- identity-mapping gaps and cloud redeploys. The unique dedupeKey makes
-- webhook retries and LAN backfills idempotent.

CREATE TABLE IF NOT EXISTS "biometric_scan_logs" (
  "id" TEXT NOT NULL,
  "deviceId" TEXT,
  "deviceHost" TEXT,
  "deviceName" TEXT,
  "rawEmployeeNo" TEXT NOT NULL,
  "employeeNo" TEXT,
  "personName" TEXT,
  "scannedAt" TIMESTAMP(3) NOT NULL,
  "verifyMode" TEXT,
  "method" TEXT,
  "serialNo" TEXT,
  "source" TEXT NOT NULL DEFAULT 'PUSH',
  "outcome" TEXT NOT NULL DEFAULT 'RECEIVED',
  "attendance" BOOLEAN NOT NULL DEFAULT false,
  "matchedType" TEXT,
  "studentId" TEXT,
  "teacherId" TEXT,
  "userId" TEXT,
  "message" TEXT,
  "rawPayload" JSONB,
  "dedupeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "biometric_scan_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "biometric_scan_logs_dedupeKey_key"
  ON "biometric_scan_logs"("dedupeKey");
CREATE INDEX IF NOT EXISTS "biometric_scan_logs_scannedAt_idx"
  ON "biometric_scan_logs"("scannedAt");
CREATE INDEX IF NOT EXISTS "biometric_scan_logs_rawEmployeeNo_idx"
  ON "biometric_scan_logs"("rawEmployeeNo");
CREATE INDEX IF NOT EXISTS "biometric_scan_logs_employeeNo_idx"
  ON "biometric_scan_logs"("employeeNo");
CREATE INDEX IF NOT EXISTS "biometric_scan_logs_studentId_idx"
  ON "biometric_scan_logs"("studentId");
CREATE INDEX IF NOT EXISTS "biometric_scan_logs_teacherId_idx"
  ON "biometric_scan_logs"("teacherId");
CREATE INDEX IF NOT EXISTS "biometric_scan_logs_outcome_idx"
  ON "biometric_scan_logs"("outcome");
CREATE INDEX IF NOT EXISTS "biometric_scan_logs_source_idx"
  ON "biometric_scan_logs"("source");
