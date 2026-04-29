-- CreateEnum
CREATE TYPE "ConsignmentSiteStatus" AS ENUM ('ONBOARDING_IN_PROGRESS', 'READY_FOR_WAREHOUSE', 'WAREHOUSE_PENDING', 'BASELINE_PENDING', 'ACTIVE', 'SUSPENDED', 'EXITING', 'EXITED');

-- CreateEnum
CREATE TYPE "ConsignmentAcumaticaStatus" AS ENUM ('NOT_REQUIRED', 'PARKED', 'PENDING', 'AVAILABLE', 'ERROR');

-- CreateEnum
CREATE TYPE "ConsignmentFormType" AS ENUM ('AGREEMENT', 'BLUE', 'ROSE', 'PURPLE', 'SAND', 'RETURN', 'DAMAGE', 'MASTER_REFERENCE');

-- CreateEnum
CREATE TYPE "ConsignmentFormStatus" AS ENUM ('DRAFT', 'SENT', 'RETURNED', 'SIGNED', 'APPROVED', 'REJECTED', 'CURRENT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ConsignmentAuditStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ConsignmentReconciliationStatus" AS ENUM ('NOT_STARTED', 'OPEN', 'TRUE_UP_CONFIRMED', 'RESOLVED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "ConsignmentDiscrepancyStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'PO_REQUIRED', 'PO_RECEIVED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "ConsignmentPoFollowUpStatus" AS ENUM ('NOT_REQUIRED', 'REQUIRED', 'ESCALATED', 'RECEIVED', 'WAIVED');

-- CreateEnum
CREATE TYPE "ConsignmentWorkItemType" AS ENUM ('WAREHOUSE_SETUP', 'BASELINE_REVIEW', 'VARIANCE_REVIEW', 'PO_FOLLOW_UP', 'EXIT_REVIEW', 'ACUMATICA_RESUME');

-- CreateEnum
CREATE TYPE "ConsignmentWorkItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ConsignmentSite" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "locationId" UUID,
    "name" TEXT NOT NULL,
    "status" "ConsignmentSiteStatus" NOT NULL DEFAULT 'ONBOARDING_IN_PROGRESS',
    "acumaticaStatus" "ConsignmentAcumaticaStatus" NOT NULL DEFAULT 'PARKED',
    "warehouseCode" TEXT,
    "acumaticaWarehouseId" TEXT,
    "acumaticaLastSyncedAt" TIMESTAMP(3),
    "acumaticaLastError" TEXT,
    "activeSince" TIMESTAMP(3),
    "exitedAt" TIMESTAMP(3),
    "baselineEstablishedAt" TIMESTAMP(3),
    "lastAuditCompletedAt" TIMESTAMP(3),
    "nextAuditDueAt" TIMESTAMP(3),
    "ownerTmUserId" UUID,
    "ownerRdUserId" UUID,
    "territoryId" UUID,
    "regionId" UUID,
    "shippingCenterId" UUID,
    "primaryContactName" TEXT,
    "primaryContactEmail" TEXT,
    "primaryContactPhone" TEXT,
    "notes" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsignmentSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsignmentForm" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "formType" "ConsignmentFormType" NOT NULL,
    "status" "ConsignmentFormStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT,
    "documentUrl" TEXT,
    "externalRef" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "receivedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsignmentForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsignmentAudit" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "status" "ConsignmentAuditStatus" NOT NULL DEFAULT 'SCHEDULED',
    "reconciliationStatus" "ConsignmentReconciliationStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "expectedSource" TEXT NOT NULL DEFAULT 'manual_or_imported',
    "sourceFreshnessLabel" TEXT NOT NULL DEFAULT 'acumatica_parked',
    "notes" TEXT,
    "submittedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsignmentAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsignmentAuditLine" (
    "id" UUID NOT NULL,
    "auditId" UUID NOT NULL,
    "sku" TEXT,
    "barcode" TEXT,
    "productName" TEXT NOT NULL,
    "expectedQuantity" INTEGER,
    "actualQuantity" INTEGER,
    "varianceQuantity" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsignmentAuditLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsignmentDiscrepancyCase" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "auditId" UUID,
    "status" "ConsignmentDiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
    "poFollowUpStatus" "ConsignmentPoFollowUpStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "reasonCode" TEXT,
    "sku" TEXT,
    "productName" TEXT,
    "quantity" INTEGER,
    "trueUpConfirmedAt" TIMESTAMP(3),
    "poDueAt" TIMESTAMP(3),
    "externalPoRef" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsignmentDiscrepancyCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsignmentWorkItem" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "type" "ConsignmentWorkItemType" NOT NULL,
    "status" "ConsignmentWorkItemStatus" NOT NULL DEFAULT 'OPEN',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL,
    "assignedToUserId" UUID,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsignmentWorkItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsignmentSite_accountId_idx" ON "ConsignmentSite"("accountId");
CREATE INDEX "ConsignmentSite_locationId_idx" ON "ConsignmentSite"("locationId");
CREATE INDEX "ConsignmentSite_status_idx" ON "ConsignmentSite"("status");
CREATE INDEX "ConsignmentSite_acumaticaStatus_idx" ON "ConsignmentSite"("acumaticaStatus");
CREATE INDEX "ConsignmentSite_ownerTmUserId_idx" ON "ConsignmentSite"("ownerTmUserId");
CREATE INDEX "ConsignmentSite_ownerRdUserId_idx" ON "ConsignmentSite"("ownerRdUserId");
CREATE INDEX "ConsignmentSite_territoryId_idx" ON "ConsignmentSite"("territoryId");
CREATE INDEX "ConsignmentSite_regionId_idx" ON "ConsignmentSite"("regionId");
CREATE INDEX "ConsignmentSite_shippingCenterId_idx" ON "ConsignmentSite"("shippingCenterId");
CREATE INDEX "ConsignmentSite_nextAuditDueAt_idx" ON "ConsignmentSite"("nextAuditDueAt");
CREATE INDEX "ConsignmentSite_warehouseCode_idx" ON "ConsignmentSite"("warehouseCode");
CREATE INDEX "ConsignmentSite_acumaticaWarehouseId_idx" ON "ConsignmentSite"("acumaticaWarehouseId");
CREATE INDEX "ConsignmentForm_siteId_idx" ON "ConsignmentForm"("siteId");
CREATE INDEX "ConsignmentForm_formType_status_idx" ON "ConsignmentForm"("formType", "status");
CREATE INDEX "ConsignmentForm_siteId_formType_isCurrent_idx" ON "ConsignmentForm"("siteId", "formType", "isCurrent");
CREATE INDEX "ConsignmentAudit_siteId_idx" ON "ConsignmentAudit"("siteId");
CREATE INDEX "ConsignmentAudit_scheduledFor_idx" ON "ConsignmentAudit"("scheduledFor");
CREATE INDEX "ConsignmentAudit_status_idx" ON "ConsignmentAudit"("status");
CREATE INDEX "ConsignmentAudit_reconciliationStatus_idx" ON "ConsignmentAudit"("reconciliationStatus");
CREATE INDEX "ConsignmentAuditLine_auditId_idx" ON "ConsignmentAuditLine"("auditId");
CREATE INDEX "ConsignmentAuditLine_sku_idx" ON "ConsignmentAuditLine"("sku");
CREATE INDEX "ConsignmentAuditLine_barcode_idx" ON "ConsignmentAuditLine"("barcode");
CREATE INDEX "ConsignmentDiscrepancyCase_siteId_idx" ON "ConsignmentDiscrepancyCase"("siteId");
CREATE INDEX "ConsignmentDiscrepancyCase_auditId_idx" ON "ConsignmentDiscrepancyCase"("auditId");
CREATE INDEX "ConsignmentDiscrepancyCase_status_idx" ON "ConsignmentDiscrepancyCase"("status");
CREATE INDEX "ConsignmentDiscrepancyCase_poFollowUpStatus_idx" ON "ConsignmentDiscrepancyCase"("poFollowUpStatus");
CREATE INDEX "ConsignmentDiscrepancyCase_poDueAt_idx" ON "ConsignmentDiscrepancyCase"("poDueAt");
CREATE INDEX "ConsignmentWorkItem_siteId_idx" ON "ConsignmentWorkItem"("siteId");
CREATE INDEX "ConsignmentWorkItem_type_idx" ON "ConsignmentWorkItem"("type");
CREATE INDEX "ConsignmentWorkItem_status_idx" ON "ConsignmentWorkItem"("status");
CREATE INDEX "ConsignmentWorkItem_assignedToUserId_idx" ON "ConsignmentWorkItem"("assignedToUserId");
CREATE INDEX "ConsignmentWorkItem_dueAt_idx" ON "ConsignmentWorkItem"("dueAt");

-- AddForeignKey
ALTER TABLE "ConsignmentSite" ADD CONSTRAINT "ConsignmentSite_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsignmentSite" ADD CONSTRAINT "ConsignmentSite_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AccountLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsignmentSite" ADD CONSTRAINT "ConsignmentSite_ownerTmUserId_fkey" FOREIGN KEY ("ownerTmUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsignmentSite" ADD CONSTRAINT "ConsignmentSite_ownerRdUserId_fkey" FOREIGN KEY ("ownerRdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsignmentSite" ADD CONSTRAINT "ConsignmentSite_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsignmentSite" ADD CONSTRAINT "ConsignmentSite_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsignmentSite" ADD CONSTRAINT "ConsignmentSite_shippingCenterId_fkey" FOREIGN KEY ("shippingCenterId") REFERENCES "ShippingCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsignmentSite" ADD CONSTRAINT "ConsignmentSite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsignmentForm" ADD CONSTRAINT "ConsignmentForm_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConsignmentSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsignmentForm" ADD CONSTRAINT "ConsignmentForm_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsignmentAudit" ADD CONSTRAINT "ConsignmentAudit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConsignmentSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsignmentAudit" ADD CONSTRAINT "ConsignmentAudit_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsignmentAuditLine" ADD CONSTRAINT "ConsignmentAuditLine_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "ConsignmentAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsignmentDiscrepancyCase" ADD CONSTRAINT "ConsignmentDiscrepancyCase_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConsignmentSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsignmentDiscrepancyCase" ADD CONSTRAINT "ConsignmentDiscrepancyCase_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "ConsignmentAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConsignmentWorkItem" ADD CONSTRAINT "ConsignmentWorkItem_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConsignmentSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsignmentWorkItem" ADD CONSTRAINT "ConsignmentWorkItem_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
