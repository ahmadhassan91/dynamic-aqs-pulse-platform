-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "ExternalReferenceEntityType" ADD VALUE 'DEALER';
ALTER TYPE "ExternalReferenceEntityType" ADD VALUE 'TRAINING_RECORD';
ALTER TYPE "ExternalReferenceEntityType" ADD VALUE 'ASSET';

-- DropForeignKey
ALTER TABLE "SourceRecordSnapshot" DROP CONSTRAINT "SourceRecordSnapshot_migrationRunId_fkey";

-- DropIndex
DROP INDEX "SourceRecordSnapshot_sourceSystem_entityType_externalId_key";

-- AlterTable
ALTER TABLE "SourceRecordSnapshot" ALTER COLUMN "migrationRunId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MigrationRunRecord_migrationRunId_snapshotId_key" ON "MigrationRunRecord"("migrationRunId", "snapshotId");

-- CreateIndex
CREATE INDEX "SourceRecordSnapshot_sourceSystem_entityType_externalId_idx" ON "SourceRecordSnapshot"("sourceSystem", "entityType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceRecordSnapshot_migrationRunId_sourceSystem_entityType_key" ON "SourceRecordSnapshot"("migrationRunId", "sourceSystem", "entityType", "externalId");

-- AddForeignKey
ALTER TABLE "SourceRecordSnapshot" ADD CONSTRAINT "SourceRecordSnapshot_migrationRunId_fkey" FOREIGN KEY ("migrationRunId") REFERENCES "MigrationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
