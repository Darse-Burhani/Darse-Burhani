-- CreateTable
CREATE TABLE "biometric_devices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'HIKVISION',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 80,
    "username" TEXT NOT NULL,
    "passwordEnc" TEXT,
    "passwordIv" TEXT,
    "serialNo" TEXT,
    "model" TEXT,
    "mac" TEXT,
    "firmwareVersion" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFLINE',
    "lastError" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "lastEventCursor" TIMESTAMP(3),
    "pollIntervalSeconds" INTEGER NOT NULL DEFAULT 15,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "biometric_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "biometric_devices_host_idx" ON "biometric_devices"("host");

