-- Two-time attendance windows: on-time [startTime, endTime] => PRESENT,
-- late (endTime, lateEndTime] => LATE. Backfill lateEndTime = endTime (no late zone until admin configures).
ALTER TABLE "biometric_scan_windows" ADD COLUMN "lateEndTime" TEXT;

UPDATE "biometric_scan_windows" SET "lateEndTime" = "endTime" WHERE "lateEndTime" IS NULL;

-- Faculty applicability roster: empty = applies to all active teachers.
ALTER TABLE "biometric_scan_windows" ADD COLUMN "applicableTeacherIds" TEXT[] NOT NULL DEFAULT '{}';
