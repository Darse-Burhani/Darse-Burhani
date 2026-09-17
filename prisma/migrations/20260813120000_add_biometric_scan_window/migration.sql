-- CreateTable
CREATE TABLE "biometric_scan_windows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Tilawat al Dua',
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "graceMinutes" INTEGER NOT NULL DEFAULT 10,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biometric_scan_windows_pkey" PRIMARY KEY ("id")
);

-- Seed the default daily scan window (admin can edit it in Admin → Biometric).
INSERT INTO "biometric_scan_windows" ("id", "name", "startTime", "endTime", "graceMinutes", "enabled", "updatedAt")
VALUES ('default', 'Tilawat al Dua', '07:00', '12:30', 10, true, CURRENT_TIMESTAMP);
