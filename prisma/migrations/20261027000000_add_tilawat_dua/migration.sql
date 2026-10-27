-- ============================================================================
-- MIGRATION: Add Tilawat Dua
-- ============================================================================

CREATE TABLE IF NOT EXISTS "tilawat_dua" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pdfUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "pageCount" INTEGER DEFAULT 1,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDailyDefault" BOOLEAN NOT NULL DEFAULT false,
    "targetAudience" TEXT NOT NULL DEFAULT 'ALL',
    "targetMarhala" TEXT,
    "targetClassIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tilawat_dua_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tilawat_dua_date_idx" ON "tilawat_dua"("date");
CREATE INDEX IF NOT EXISTS "tilawat_dua_isActive_idx" ON "tilawat_dua"("isActive");
CREATE INDEX IF NOT EXISTS "tilawat_dua_isDailyDefault_idx" ON "tilawat_dua"("isDailyDefault");
CREATE INDEX IF NOT EXISTS "tilawat_dua_targetAudience_idx" ON "tilawat_dua"("targetAudience");
