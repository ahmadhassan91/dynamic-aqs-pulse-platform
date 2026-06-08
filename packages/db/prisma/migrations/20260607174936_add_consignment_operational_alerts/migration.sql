-- CreateEnum
CREATE TYPE "ConsignmentOperationalAlertType" AS ENUM ('AUDIT_DUE_FOURTEEN_DAYS', 'AUDIT_DUE_SEVEN_DAYS', 'AUDIT_DUE_TODAY', 'AUDIT_OVERDUE_SEVEN_DAYS', 'AUDIT_OVERDUE_FOURTEEN_DAYS', 'PO_CLOCK_START', 'PO_CLOCK_THREE_DAYS_REMAINING', 'PO_CLOCK_ONE_DAY_REMAINING', 'PO_OVERDUE_FIVE_DAYS', 'PO_OVERDUE_TEN_DAYS');

-- CreateEnum
CREATE TYPE "ConsignmentOperationalAlertStatus" AS ENUM ('PENDING', 'PREVIEWED', 'SENT', 'SKIPPED', 'FAILED');

-- AlterTable
ALTER TABLE "TrainingProofDocument" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "ConsignmentOperationalAlert" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "auditId" UUID,
    "discrepancyId" UUID,
    "alertType" "ConsignmentOperationalAlertType" NOT NULL,
    "status" "ConsignmentOperationalAlertStatus" NOT NULL DEFAULT 'PENDING',
    "dedupeKey" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),

    CONSTRAINT "ConsignmentOperationalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsignmentOperationalAlert_dedupeKey_key" ON "ConsignmentOperationalAlert"("dedupeKey");

-- CreateIndex
CREATE INDEX "ConsignmentOperationalAlert_siteId_alertType_idx" ON "ConsignmentOperationalAlert"("siteId", "alertType");

-- CreateIndex
CREATE INDEX "ConsignmentOperationalAlert_auditId_idx" ON "ConsignmentOperationalAlert"("auditId");

-- CreateIndex
CREATE INDEX "ConsignmentOperationalAlert_discrepancyId_idx" ON "ConsignmentOperationalAlert"("discrepancyId");

-- CreateIndex
CREATE INDEX "ConsignmentOperationalAlert_status_createdAt_idx" ON "ConsignmentOperationalAlert"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ConsignmentOperationalAlert_alertType_createdAt_idx" ON "ConsignmentOperationalAlert"("alertType", "createdAt");

-- AddForeignKey
ALTER TABLE "ConsignmentOperationalAlert" ADD CONSTRAINT "ConsignmentOperationalAlert_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConsignmentSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsignmentOperationalAlert" ADD CONSTRAINT "ConsignmentOperationalAlert_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "ConsignmentAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsignmentOperationalAlert" ADD CONSTRAINT "ConsignmentOperationalAlert_discrepancyId_fkey" FOREIGN KEY ("discrepancyId") REFERENCES "ConsignmentDiscrepancyCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "DigitalAssetLegacyMetadata_assetId_sourceSystem_fieldKey_fieldV" RENAME TO "DigitalAssetLegacyMetadata_assetId_sourceSystem_fieldKey_fi_key";

-- RenameIndex
ALTER INDEX "ProductAssetAssignment_presentationId_assetId_role_dealerGroupT" RENAME TO "ProductAssetAssignment_presentationId_assetId_role_dealerGr_key";
