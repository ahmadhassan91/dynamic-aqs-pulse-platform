-- CreateEnum
CREATE TYPE "LeadImportRunStatus" AS ENUM ('REVIEW_READY', 'IMPORTED', 'IMPORTED_WITH_ERRORS');

-- CreateEnum
CREATE TYPE "LeadImportRunRowStatus" AS ENUM ('READY', 'POTENTIAL_DUPLICATE', 'INVALID', 'SKIPPED', 'IMPORTED', 'FAILED');

-- CreateEnum
CREATE TYPE "LeadImportDuplicateDecision" AS ENUM ('CREATE_NEW', 'USE_EXISTING', 'SKIP');

-- CreateTable
CREATE TABLE "LeadImportRun" (
    "id" UUID NOT NULL,
    "createdByUserId" UUID,
    "status" "LeadImportRunStatus" NOT NULL DEFAULT 'REVIEW_READY',
    "fileName" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "fileDigest" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "batchName" TEXT,
    "businessSegmentCode" TEXT,
    "leadSourceCode" TEXT,
    "sourceSiteId" TEXT,
    "sourceSiteName" TEXT,
    "sourceBrandTag" TEXT,
    "mappings" JSONB NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "mappedRows" INTEGER NOT NULL,
    "readyRowCount" INTEGER NOT NULL DEFAULT 0,
    "attentionRowCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadImportRunRow" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "LeadImportRunRowStatus" NOT NULL,
    "detail" TEXT NOT NULL,
    "sourceValues" JSONB,
    "mappedPayload" JSONB,
    "duplicateCandidates" JSONB,
    "duplicateDecision" "LeadImportDuplicateDecision",
    "targetEntityId" TEXT,
    "importedLeadId" UUID,
    "importedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadImportRunRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadImportRun_createdByUserId_createdAt_idx" ON "LeadImportRun"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadImportRun_status_createdAt_idx" ON "LeadImportRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LeadImportRun_fileDigest_createdAt_idx" ON "LeadImportRun"("fileDigest", "createdAt");

-- CreateIndex
CREATE INDEX "LeadImportRunRow_runId_status_rowNumber_idx" ON "LeadImportRunRow"("runId", "status", "rowNumber");

-- CreateIndex
CREATE INDEX "LeadImportRunRow_importedLeadId_idx" ON "LeadImportRunRow"("importedLeadId");

-- CreateIndex
CREATE UNIQUE INDEX "LeadImportRunRow_runId_rowNumber_key" ON "LeadImportRunRow"("runId", "rowNumber");

-- AddForeignKey
ALTER TABLE "LeadImportRun" ADD CONSTRAINT "LeadImportRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadImportRunRow" ADD CONSTRAINT "LeadImportRunRow_runId_fkey" FOREIGN KEY ("runId") REFERENCES "LeadImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
