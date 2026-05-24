-- CreateEnum
CREATE TYPE "MobileVoiceNoteContextType" AS ENUM ('GENERAL', 'LEAD', 'ACCOUNT', 'TRAINING_SESSION', 'CONSIGNMENT_SITE', 'ROUTE_VISIT');

-- CreateEnum
CREATE TYPE "MobileVoiceNoteProcessingStatus" AS ENUM ('PENDING', 'STRUCTURED', 'NEEDS_REVIEW', 'FAILED');

-- CreateTable
CREATE TABLE "MobileVoiceNote" (
    "id" UUID NOT NULL,
    "createdByUserId" UUID,
    "contextType" "MobileVoiceNoteContextType" NOT NULL DEFAULT 'GENERAL',
    "leadId" UUID,
    "accountId" UUID,
    "trainingSessionId" UUID,
    "consignmentSiteId" UUID,
    "routeVisitLocalId" TEXT,
    "title" TEXT NOT NULL,
    "rawTranscript" TEXT,
    "structuredSummary" TEXT,
    "structuredNextStep" TEXT,
    "structuredSentiment" TEXT,
    "structuredTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "structuredData" JSONB,
    "processingStatus" "MobileVoiceNoteProcessingStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "llmProvider" TEXT,
    "llmModel" TEXT,
    "llmErrorMessage" TEXT,
    "audioStorageKey" TEXT,
    "audioFileName" TEXT,
    "audioMimeType" TEXT,
    "audioSizeBytes" INTEGER,
    "audioSha256" TEXT,
    "durationSeconds" INTEGER,
    "crmSyncedAt" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MobileVoiceNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MobileVoiceNote_createdByUserId_createdAt_idx" ON "MobileVoiceNote"("createdByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "MobileVoiceNote_contextType_createdAt_idx" ON "MobileVoiceNote"("contextType", "createdAt");

-- CreateIndex
CREATE INDEX "MobileVoiceNote_leadId_createdAt_idx" ON "MobileVoiceNote"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "MobileVoiceNote_accountId_createdAt_idx" ON "MobileVoiceNote"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "MobileVoiceNote_trainingSessionId_createdAt_idx" ON "MobileVoiceNote"("trainingSessionId", "createdAt");

-- CreateIndex
CREATE INDEX "MobileVoiceNote_consignmentSiteId_createdAt_idx" ON "MobileVoiceNote"("consignmentSiteId", "createdAt");

-- CreateIndex
CREATE INDEX "MobileVoiceNote_processingStatus_idx" ON "MobileVoiceNote"("processingStatus");

-- CreateIndex
CREATE INDEX "MobileVoiceNote_crmSyncedAt_idx" ON "MobileVoiceNote"("crmSyncedAt");

-- AddForeignKey
ALTER TABLE "MobileVoiceNote" ADD CONSTRAINT "MobileVoiceNote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileVoiceNote" ADD CONSTRAINT "MobileVoiceNote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileVoiceNote" ADD CONSTRAINT "MobileVoiceNote_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileVoiceNote" ADD CONSTRAINT "MobileVoiceNote_trainingSessionId_fkey" FOREIGN KEY ("trainingSessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MobileVoiceNote" ADD CONSTRAINT "MobileVoiceNote_consignmentSiteId_fkey" FOREIGN KEY ("consignmentSiteId") REFERENCES "ConsignmentSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
