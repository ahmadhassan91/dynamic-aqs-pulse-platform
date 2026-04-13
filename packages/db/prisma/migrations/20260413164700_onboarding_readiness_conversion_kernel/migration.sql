-- CreateEnum
CREATE TYPE "LeadReadinessStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'READY', 'CONVERTED');

-- CreateEnum
CREATE TYPE "OnboardingChecklistStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OnboardingChecklistItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "LeadContactRole" AS ENUM ('PRIMARY', 'OWNER_MANAGER', 'ORDERING', 'ACCOUNTS_PAYABLE', 'TECHNICAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadContactSource" AS ENUM ('LEAD_CAPTURE', 'CIS_PRIMARY', 'CIS_OWNER_MANAGER', 'CIS_ORDERING', 'CIS_ACCOUNTS_PAYABLE', 'MANUAL');

-- CreateEnum
CREATE TYPE "LeadConversionPreparationStatus" AS ENUM ('DRAFT', 'VALIDATED', 'BLOCKED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "PortalEligibilityStatus" AS ENUM ('UNASSESSED', 'BLOCKED', 'READY', 'PROVISIONED');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "sourceLeadId" UUID;

-- CreateTable
CREATE TABLE "LeadContact" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "role" "LeadContactRole" NOT NULL,
    "source" "LeadContactSource",
    "displayName" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobilePhone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadReadinessState" (
    "leadId" UUID NOT NULL,
    "status" "LeadReadinessStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "checklistGeneratedAt" TIMESTAMP(3),
    "financeApprovedAt" TIMESTAMP(3),
    "priceClassResolvedAt" TIMESTAMP(3),
    "portalAccessGrantedAt" TIMESTAMP(3),
    "firstOrderReadyAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "notes" TEXT,
    "sourceCisPackageId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadReadinessState_pkey" PRIMARY KEY ("leadId")
);

-- CreateTable
CREATE TABLE "OnboardingChecklist" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "status" "OnboardingChecklistStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "blockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingChecklistItem" (
    "id" UUID NOT NULL,
    "checklistId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ownerRoleCode" TEXT,
    "ownerUserId" UUID,
    "status" "OnboardingChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedByUserId" UUID,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadConversionPreparation" (
    "leadId" UUID NOT NULL,
    "status" "LeadConversionPreparationStatus" NOT NULL DEFAULT 'DRAFT',
    "targetAccountName" TEXT,
    "legalCompanyName" TEXT,
    "accountType" TEXT,
    "financeAuthorityMode" TEXT,
    "priceClassCode" TEXT,
    "portalEligibilityStatus" "PortalEligibilityStatus" NOT NULL DEFAULT 'UNASSESSED',
    "shippingAddressSnapshot" JSONB,
    "billingAddressSnapshot" JSONB,
    "conversionReady" BOOLEAN NOT NULL DEFAULT false,
    "conversionBlockedReason" TEXT,
    "notes" TEXT,
    "validatedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadConversionPreparation_pkey" PRIMARY KEY ("leadId")
);

-- CreateIndex
CREATE INDEX "LeadContact_leadId_idx" ON "LeadContact"("leadId");

-- CreateIndex
CREATE INDEX "LeadContact_role_idx" ON "LeadContact"("role");

-- CreateIndex
CREATE INDEX "LeadContact_email_idx" ON "LeadContact"("email");

-- CreateIndex
CREATE INDEX "LeadContact_isPrimary_idx" ON "LeadContact"("isPrimary");

-- CreateIndex
CREATE INDEX "LeadContact_isActive_idx" ON "LeadContact"("isActive");

-- CreateIndex
CREATE INDEX "LeadReadinessState_status_idx" ON "LeadReadinessState"("status");

-- CreateIndex
CREATE INDEX "LeadReadinessState_financeApprovedAt_idx" ON "LeadReadinessState"("financeApprovedAt");

-- CreateIndex
CREATE INDEX "LeadReadinessState_firstOrderReadyAt_idx" ON "LeadReadinessState"("firstOrderReadyAt");

-- CreateIndex
CREATE INDEX "LeadReadinessState_convertedAt_idx" ON "LeadReadinessState"("convertedAt");

-- CreateIndex
CREATE INDEX "LeadReadinessState_sourceCisPackageId_idx" ON "LeadReadinessState"("sourceCisPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingChecklist_leadId_key" ON "OnboardingChecklist"("leadId");

-- CreateIndex
CREATE INDEX "OnboardingChecklist_status_idx" ON "OnboardingChecklist"("status");

-- CreateIndex
CREATE INDEX "OnboardingChecklist_completedAt_idx" ON "OnboardingChecklist"("completedAt");

-- CreateIndex
CREATE INDEX "OnboardingChecklistItem_checklistId_sortOrder_idx" ON "OnboardingChecklistItem"("checklistId", "sortOrder");

-- CreateIndex
CREATE INDEX "OnboardingChecklistItem_status_idx" ON "OnboardingChecklistItem"("status");

-- CreateIndex
CREATE INDEX "OnboardingChecklistItem_ownerRoleCode_idx" ON "OnboardingChecklistItem"("ownerRoleCode");

-- CreateIndex
CREATE INDEX "OnboardingChecklistItem_ownerUserId_idx" ON "OnboardingChecklistItem"("ownerUserId");

-- CreateIndex
CREATE INDEX "OnboardingChecklistItem_completedByUserId_idx" ON "OnboardingChecklistItem"("completedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingChecklistItem_checklistId_code_key" ON "OnboardingChecklistItem"("checklistId", "code");

-- CreateIndex
CREATE INDEX "LeadConversionPreparation_status_idx" ON "LeadConversionPreparation"("status");

-- CreateIndex
CREATE INDEX "LeadConversionPreparation_portalEligibilityStatus_idx" ON "LeadConversionPreparation"("portalEligibilityStatus");

-- CreateIndex
CREATE INDEX "LeadConversionPreparation_conversionReady_idx" ON "LeadConversionPreparation"("conversionReady");

-- CreateIndex
CREATE INDEX "LeadConversionPreparation_reviewedByUserId_idx" ON "LeadConversionPreparation"("reviewedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_sourceLeadId_key" ON "Account"("sourceLeadId");

-- CreateIndex
CREATE INDEX "Account_sourceLeadId_idx" ON "Account"("sourceLeadId");

-- AddForeignKey
ALTER TABLE "LeadContact" ADD CONSTRAINT "LeadContact_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadReadinessState" ADD CONSTRAINT "LeadReadinessState_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadReadinessState" ADD CONSTRAINT "LeadReadinessState_sourceCisPackageId_fkey" FOREIGN KEY ("sourceCisPackageId") REFERENCES "CisPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklist" ADD CONSTRAINT "OnboardingChecklist_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "OnboardingChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingChecklistItem" ADD CONSTRAINT "OnboardingChecklistItem_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadConversionPreparation" ADD CONSTRAINT "LeadConversionPreparation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadConversionPreparation" ADD CONSTRAINT "LeadConversionPreparation_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

