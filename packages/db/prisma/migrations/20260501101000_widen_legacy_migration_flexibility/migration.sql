-- Widen replacement migration flexibility.
-- This is intentionally additive: the first product/digital-assets kernel remains intact,
-- and legacy Widen export data can be staged, audited, searched, and reconciled without
-- forcing every unknown Widen metadata field into permanent first-class columns.

CREATE TABLE "DigitalAssetMigrationBatch" (
    "id" UUID NOT NULL,
    "sourceSystem" "ProductSourceSystem" NOT NULL,
    "batchCode" TEXT NOT NULL,
    "sourceExportName" TEXT,
    "sourceExportedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'staged',
    "sourceRecordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAssetCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAssetCount" INTEGER NOT NULL DEFAULT 0,
    "skippedRecordCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "importedByUserId" UUID,
    "notes" TEXT,
    "rawManifest" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalAssetMigrationBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalAssetLegacyMetadata" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "sourceSystem" "ProductSourceSystem" NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT,
    "fieldValue" TEXT,
    "fieldValueJson" JSONB,
    "valueType" TEXT,
    "isSearchable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalAssetLegacyMetadata_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DigitalAssetMigrationIssue" (
    "id" UUID NOT NULL,
    "batchId" UUID,
    "assetId" UUID,
    "sourceSystem" "ProductSourceSystem" NOT NULL,
    "externalAssetId" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'warning',
    "issueCode" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "sourceRowNumber" INTEGER,
    "rawSourcePayload" JSONB,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalAssetMigrationIssue_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DigitalAsset"
ADD COLUMN "legacyFileName" TEXT,
ADD COLUMN "legacyFolderPath" TEXT,
ADD COLUMN "legacyCreatedAt" TIMESTAMP(3),
ADD COLUMN "legacyUpdatedAt" TIMESTAMP(3),
ADD COLUMN "legacyPublishedAt" TIMESTAMP(3),
ADD COLUMN "migratedAt" TIMESTAMP(3),
ADD COLUMN "migrationBatchId" UUID,
ADD COLUMN "legacyMetadata" JSONB,
ADD COLUMN "rawSourcePayload" JSONB;

ALTER TABLE "DigitalAssetVersion"
ADD COLUMN "sourceVersionId" TEXT,
ADD COLUMN "sourceDownloadUrl" TEXT,
ADD COLUMN "legacyRenditionName" TEXT,
ADD COLUMN "legacyMetadata" JSONB,
ADD COLUMN "rawSourcePayload" JSONB;

ALTER TABLE "DigitalAssetMigrationAlias"
ADD COLUMN "externalVersionId" TEXT,
ADD COLUMN "legacyPath" TEXT,
ADD COLUMN "legacyEmbedCode" TEXT,
ADD COLUMN "httpStatusCode" INTEGER,
ADD COLUMN "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN "rawSourcePayload" JSONB;

CREATE UNIQUE INDEX "DigitalAssetMigrationBatch_batchCode_key" ON "DigitalAssetMigrationBatch"("batchCode");
CREATE INDEX "DigitalAssetMigrationBatch_sourceSystem_idx" ON "DigitalAssetMigrationBatch"("sourceSystem");
CREATE INDEX "DigitalAssetMigrationBatch_status_idx" ON "DigitalAssetMigrationBatch"("status");
CREATE INDEX "DigitalAssetMigrationBatch_sourceExportedAt_idx" ON "DigitalAssetMigrationBatch"("sourceExportedAt");

CREATE UNIQUE INDEX "DigitalAssetLegacyMetadata_assetId_sourceSystem_fieldKey_fieldValue_key" ON "DigitalAssetLegacyMetadata"("assetId", "sourceSystem", "fieldKey", "fieldValue");
CREATE INDEX "DigitalAssetLegacyMetadata_assetId_idx" ON "DigitalAssetLegacyMetadata"("assetId");
CREATE INDEX "DigitalAssetLegacyMetadata_sourceSystem_idx" ON "DigitalAssetLegacyMetadata"("sourceSystem");
CREATE INDEX "DigitalAssetLegacyMetadata_fieldKey_idx" ON "DigitalAssetLegacyMetadata"("fieldKey");
CREATE INDEX "DigitalAssetLegacyMetadata_fieldValue_idx" ON "DigitalAssetLegacyMetadata"("fieldValue");
CREATE INDEX "DigitalAssetLegacyMetadata_isSearchable_idx" ON "DigitalAssetLegacyMetadata"("isSearchable");

CREATE INDEX "DigitalAssetMigrationIssue_batchId_idx" ON "DigitalAssetMigrationIssue"("batchId");
CREATE INDEX "DigitalAssetMigrationIssue_assetId_idx" ON "DigitalAssetMigrationIssue"("assetId");
CREATE INDEX "DigitalAssetMigrationIssue_sourceSystem_idx" ON "DigitalAssetMigrationIssue"("sourceSystem");
CREATE INDEX "DigitalAssetMigrationIssue_externalAssetId_idx" ON "DigitalAssetMigrationIssue"("externalAssetId");
CREATE INDEX "DigitalAssetMigrationIssue_severity_idx" ON "DigitalAssetMigrationIssue"("severity");
CREATE INDEX "DigitalAssetMigrationIssue_issueCode_idx" ON "DigitalAssetMigrationIssue"("issueCode");
CREATE INDEX "DigitalAssetMigrationIssue_resolvedAt_idx" ON "DigitalAssetMigrationIssue"("resolvedAt");

CREATE INDEX "DigitalAsset_legacyFileName_idx" ON "DigitalAsset"("legacyFileName");
CREATE INDEX "DigitalAsset_legacyFolderPath_idx" ON "DigitalAsset"("legacyFolderPath");
CREATE INDEX "DigitalAsset_migrationBatchId_idx" ON "DigitalAsset"("migrationBatchId");
CREATE INDEX "DigitalAsset_migratedAt_idx" ON "DigitalAsset"("migratedAt");

CREATE INDEX "DigitalAssetVersion_sourceVersionId_idx" ON "DigitalAssetVersion"("sourceVersionId");

CREATE INDEX "DigitalAssetMigrationAlias_externalVersionId_idx" ON "DigitalAssetMigrationAlias"("externalVersionId");
CREATE INDEX "DigitalAssetMigrationAlias_legacyPath_idx" ON "DigitalAssetMigrationAlias"("legacyPath");

ALTER TABLE "DigitalAsset" ADD CONSTRAINT "DigitalAsset_migrationBatchId_fkey" FOREIGN KEY ("migrationBatchId") REFERENCES "DigitalAssetMigrationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetLegacyMetadata" ADD CONSTRAINT "DigitalAssetLegacyMetadata_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetMigrationIssue" ADD CONSTRAINT "DigitalAssetMigrationIssue_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "DigitalAssetMigrationBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetMigrationIssue" ADD CONSTRAINT "DigitalAssetMigrationIssue_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
