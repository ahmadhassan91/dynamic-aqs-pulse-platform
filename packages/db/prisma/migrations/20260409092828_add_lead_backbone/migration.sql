-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('NEW', 'DISCOVERY_SCHEDULED', 'DISCOVERY_COMPLETED', 'CIS_SENT', 'CIS_SIGNED', 'ONBOARDING_COMPLETED', 'CUSTOMER_ACTIVE');

-- CreateEnum
CREATE TYPE "LeadRoutingBasis" AS ENUM ('SERVICE_TECH_COUNT', 'TRUCK_COUNT');

-- CreateEnum
CREATE TYPE "LeadRoutingTeam" AS ENUM ('STRATEGIC_GROWTH', 'NATIONAL_TM');

-- CreateEnum
CREATE TYPE "LeadCaptureMethod" AS ENUM ('DIRECT_WEB_FORM', 'MANUAL_ENTRY', 'BULK_IMPORT', 'LEGACY_IMPORT');

-- AlterEnum
ALTER TYPE "DataRecordEntityType" ADD VALUE 'LEAD';

-- AlterEnum
ALTER TYPE "ExternalReferenceEntityType" ADD VALUE 'LEAD';

-- CreateTable
CREATE TABLE "LeadRoutingPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "routingBasis" "LeadRoutingBasis" NOT NULL DEFAULT 'SERVICE_TECH_COUNT',
    "strategicGrowthMax" INTEGER NOT NULL DEFAULT 5,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadRoutingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" UUID NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "contactDisplayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "state" TEXT,
    "countryCode" TEXT DEFAULT 'US',
    "businessSegmentId" UUID NOT NULL,
    "leadSourceId" UUID NOT NULL,
    "leadCaptureMethod" "LeadCaptureMethod" NOT NULL DEFAULT 'MANUAL_ENTRY',
    "sourceDetail" TEXT,
    "sourceSiteId" TEXT,
    "sourceSiteName" TEXT,
    "sourceBrandTag" TEXT,
    "sourceCampaign" TEXT,
    "leadRating" TEXT,
    "serviceTechCount" INTEGER NOT NULL,
    "installTechCount" INTEGER,
    "truckCount" INTEGER,
    "salesPersonCount" INTEGER,
    "affinityGroupName" TEXT,
    "ownershipGroupName" TEXT,
    "privateLabelName" TEXT,
    "routingBasisSnapshot" "LeadRoutingBasis" NOT NULL,
    "routingThresholdSnapshot" INTEGER NOT NULL,
    "routingTeam" "LeadRoutingTeam" NOT NULL,
    "leadOwnerName" TEXT,
    "assignedTmName" TEXT,
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "initialContactDueAt" TIMESTAMP(3),
    "initialContactedAt" TIMESTAMP(3),
    "discoveryScheduledAt" TIMESTAMP(3),
    "discoveryCompletedAt" TIMESTAMP(3),
    "cisSentAt" TIMESTAMP(3),
    "cisSubmittedAt" TIMESTAMP(3),
    "cisSignedAt" TIMESTAMP(3),
    "onboardingCompletedAt" TIMESTAMP(3),
    "firstOrderAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadExtension" (
    "leadId" UUID NOT NULL,
    "legacyAttributes" JSONB,
    "sourceMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadExtension_pkey" PRIMARY KEY ("leadId")
);

-- CreateTable
CREATE TABLE "LeadStageEvent" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "actorUserId" UUID,
    "fromStage" "LeadStage",
    "toStage" "LeadStage" NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_businessSegmentId_idx" ON "Lead"("businessSegmentId");

-- CreateIndex
CREATE INDEX "Lead_leadSourceId_idx" ON "Lead"("leadSourceId");

-- CreateIndex
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

-- CreateIndex
CREATE INDEX "Lead_routingTeam_idx" ON "Lead"("routingTeam");

-- CreateIndex
CREATE INDEX "Lead_state_idx" ON "Lead"("state");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_initialContactDueAt_idx" ON "Lead"("initialContactDueAt");

-- CreateIndex
CREATE INDEX "LeadStageEvent_leadId_occurredAt_idx" ON "LeadStageEvent"("leadId", "occurredAt");

-- CreateIndex
CREATE INDEX "LeadStageEvent_actorUserId_idx" ON "LeadStageEvent"("actorUserId");

-- CreateIndex
CREATE INDEX "LeadStageEvent_toStage_idx" ON "LeadStageEvent"("toStage");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_businessSegmentId_fkey" FOREIGN KEY ("businessSegmentId") REFERENCES "BusinessSegmentRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "LeadSourceRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadExtension" ADD CONSTRAINT "LeadExtension_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStageEvent" ADD CONSTRAINT "LeadStageEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadStageEvent" ADD CONSTRAINT "LeadStageEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
