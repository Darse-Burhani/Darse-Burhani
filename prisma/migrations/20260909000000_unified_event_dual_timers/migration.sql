-- Unified schedule events: ONE event row carries BOTH the Talabat timer
-- (startTime/endTime/lateEndTime) and the faculty timer
-- (facultyStartTime/facultyEndTime/facultyLateEndTime + facultyEnabled).
ALTER TABLE "biometric_scan_windows" ADD COLUMN "facultyStartTime" TEXT;
ALTER TABLE "biometric_scan_windows" ADD COLUMN "facultyEndTime" TEXT;
ALTER TABLE "biometric_scan_windows" ADD COLUMN "facultyLateEndTime" TEXT;
ALTER TABLE "biometric_scan_windows" ADD COLUMN "facultyEnabled" BOOLEAN NOT NULL DEFAULT true;

-- Merge the legacy standalone faculty row into the primary morning event,
-- so the morning event governs both Talabat and faculty attendance.
UPDATE "biometric_scan_windows" AS s
SET "facultyStartTime" = f."startTime",
    "facultyEndTime" = f."endTime",
    "facultyLateEndTime" = f."lateEndTime",
    "facultyEnabled" = f."enabled"
FROM "biometric_scan_windows" AS f
WHERE s."id" = 'default'
  AND f."id" = 'faculty_default'
  AND s."facultyStartTime" IS NULL;

-- Retire the merged legacy row (only when the merge target exists, so no
-- faculty schedule is ever lost).
DELETE FROM "biometric_scan_windows"
WHERE "id" = 'faculty_default'
  AND EXISTS (SELECT 1 FROM "biometric_scan_windows" WHERE "id" = 'default');
