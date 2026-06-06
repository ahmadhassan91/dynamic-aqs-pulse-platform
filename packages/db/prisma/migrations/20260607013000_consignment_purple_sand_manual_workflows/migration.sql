ALTER TYPE "ConsignmentWorkItemType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT_REVIEW';

CREATE TYPE "ConsignmentAdjustmentStatus" AS ENUM ('REQUESTED', 'APPLIED', 'REJECTED', 'CANCELLED');

CREATE TYPE "ConsignmentExitStatus" AS ENUM ('NOTICE_GIVEN', 'FINAL_RECONCILIATION', 'CLOSED', 'CANCELLED');

ALTER TABLE "ConsignmentSite" ADD COLUMN "manualBaselineQuantity" INTEGER;

CREATE TABLE "ConsignmentAdjustment" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "documentId" UUID,
    "status" "ConsignmentAdjustmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "reasonCode" TEXT,
    "currentTotal" INTEGER NOT NULL,
    "addQuantity" INTEGER NOT NULL DEFAULT 0,
    "removeQuantity" INTEGER NOT NULL DEFAULT 0,
    "proposedTotal" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsignmentAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsignmentExit" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "documentId" UUID,
    "status" "ConsignmentExitStatus" NOT NULL DEFAULT 'NOTICE_GIVEN',
    "noticeGivenAt" TIMESTAMP(3) NOT NULL,
    "plannedExitAt" TIMESTAMP(3),
    "finalReconciliationAt" TIMESTAMP(3),
    "returnQuantity" INTEGER,
    "retainedQuantity" INTEGER,
    "settlementReference" TEXT,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsignmentExit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsignmentSite_manualBaselineQuantity_idx" ON "ConsignmentSite"("manualBaselineQuantity");

CREATE INDEX "ConsignmentAdjustment_siteId_idx" ON "ConsignmentAdjustment"("siteId");
CREATE INDEX "ConsignmentAdjustment_documentId_idx" ON "ConsignmentAdjustment"("documentId");
CREATE INDEX "ConsignmentAdjustment_status_idx" ON "ConsignmentAdjustment"("status");
CREATE INDEX "ConsignmentAdjustment_appliedAt_idx" ON "ConsignmentAdjustment"("appliedAt");

CREATE INDEX "ConsignmentExit_siteId_idx" ON "ConsignmentExit"("siteId");
CREATE INDEX "ConsignmentExit_documentId_idx" ON "ConsignmentExit"("documentId");
CREATE INDEX "ConsignmentExit_status_idx" ON "ConsignmentExit"("status");
CREATE INDEX "ConsignmentExit_noticeGivenAt_idx" ON "ConsignmentExit"("noticeGivenAt");
CREATE INDEX "ConsignmentExit_closedAt_idx" ON "ConsignmentExit"("closedAt");

ALTER TABLE "ConsignmentAdjustment" ADD CONSTRAINT "ConsignmentAdjustment_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConsignmentSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsignmentAdjustment" ADD CONSTRAINT "ConsignmentAdjustment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ConsignmentForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsignmentAdjustment" ADD CONSTRAINT "ConsignmentAdjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConsignmentExit" ADD CONSTRAINT "ConsignmentExit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConsignmentSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsignmentExit" ADD CONSTRAINT "ConsignmentExit_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "ConsignmentForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsignmentExit" ADD CONSTRAINT "ConsignmentExit_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
