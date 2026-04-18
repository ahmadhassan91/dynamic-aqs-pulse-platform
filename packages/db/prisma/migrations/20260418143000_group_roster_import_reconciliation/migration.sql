-- CreateEnum
CREATE TYPE "GroupRosterImportKind" AS ENUM ('AFFINITY', 'OWNERSHIP');

-- CreateEnum
CREATE TYPE "GroupRosterImportRunStatus" AS ENUM ('REVIEW_READY', 'APPLIED', 'APPLIED_WITH_ERRORS');

-- CreateEnum
CREATE TYPE "GroupRosterImportRowStatus" AS ENUM ('READY', 'REQUIRES_REVIEW', 'INVALID', 'SKIPPED', 'APPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "GroupRosterImportRowDecision" AS ENUM ('APPLY', 'SKIP');

-- CreateEnum
CREATE TYPE "GroupRosterMatchEntityType" AS ENUM ('LEAD', 'ACCOUNT');

-- CreateTable
CREATE TABLE "GroupRosterImportRun" (
    "id" UUID NOT NULL,
    "createdByUserId" UUID,
    "status" "GroupRosterImportRunStatus" NOT NULL DEFAULT 'REVIEW_READY',
    "groupKind" "GroupRosterImportKind" NOT NULL,
    "affinityGroupId" UUID,
    "ownershipGroupId" UUID,
    "fileName" TEXT NOT NULL,
    "fileFormat" TEXT NOT NULL,
    "fileDigest" TEXT NOT NULL,
    "sheetName" TEXT NOT NULL,
    "batchName" TEXT,
    "sourceLabel" TEXT,
    "sourceVersion" TEXT,
    "effectiveDate" TIMESTAMP(3),
    "mappings" JSONB NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "mappedRows" INTEGER NOT NULL,
    "readyRowCount" INTEGER NOT NULL DEFAULT 0,
    "attentionRowCount" INTEGER NOT NULL DEFAULT 0,
    "appliedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupRosterImportRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRosterImportRunRow" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "status" "GroupRosterImportRowStatus" NOT NULL,
    "detail" TEXT NOT NULL,
    "sourceValues" JSONB,
    "matchedCandidates" JSONB,
    "decision" "GroupRosterImportRowDecision",
    "selectedEntityType" "GroupRosterMatchEntityType",
    "selectedEntityId" TEXT,
    "appliedLeadId" UUID,
    "appliedAccountId" UUID,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupRosterImportRunRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupRosterImportRun_createdByUserId_createdAt_idx" ON "GroupRosterImportRun"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "GroupRosterImportRun_status_createdAt_idx" ON "GroupRosterImportRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "GroupRosterImportRun_groupKind_createdAt_idx" ON "GroupRosterImportRun"("groupKind", "createdAt");

-- CreateIndex
CREATE INDEX "GroupRosterImportRun_affinityGroupId_createdAt_idx" ON "GroupRosterImportRun"("affinityGroupId", "createdAt");

-- CreateIndex
CREATE INDEX "GroupRosterImportRun_ownershipGroupId_createdAt_idx" ON "GroupRosterImportRun"("ownershipGroupId", "createdAt");

-- CreateIndex
CREATE INDEX "GroupRosterImportRunRow_runId_status_rowNumber_idx" ON "GroupRosterImportRunRow"("runId", "status", "rowNumber");

-- CreateIndex
CREATE INDEX "GroupRosterImportRunRow_selectedEntityId_idx" ON "GroupRosterImportRunRow"("selectedEntityId");

-- CreateIndex
CREATE INDEX "GroupRosterImportRunRow_appliedLeadId_idx" ON "GroupRosterImportRunRow"("appliedLeadId");

-- CreateIndex
CREATE INDEX "GroupRosterImportRunRow_appliedAccountId_idx" ON "GroupRosterImportRunRow"("appliedAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRosterImportRunRow_runId_rowNumber_key" ON "GroupRosterImportRunRow"("runId", "rowNumber");

-- AddForeignKey
ALTER TABLE "GroupRosterImportRun" ADD CONSTRAINT "GroupRosterImportRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRosterImportRun" ADD CONSTRAINT "GroupRosterImportRun_affinityGroupId_fkey" FOREIGN KEY ("affinityGroupId") REFERENCES "AffinityGroupRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRosterImportRun" ADD CONSTRAINT "GroupRosterImportRun_ownershipGroupId_fkey" FOREIGN KEY ("ownershipGroupId") REFERENCES "OwnershipGroupRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRosterImportRunRow" ADD CONSTRAINT "GroupRosterImportRunRow_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GroupRosterImportRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

