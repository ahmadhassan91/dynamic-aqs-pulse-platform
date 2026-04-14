-- CreateEnum
CREATE TYPE "TrainingCategoryKind" AS ENUM ('ONBOARDING', 'PRODUCT', 'TECHNICAL', 'SALES', 'COMPLIANCE', 'CERTIFICATION', 'CUSTOM', 'VISIT');

-- CreateEnum
CREATE TYPE "TrainingCatalogFamily" AS ENUM ('VISIT_FOLLOW_UP', 'PROGRAM_FOUNDATION', 'SALES_COMMUNICATION', 'TECHNICAL_PRODUCT', 'MANAGEMENT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TrainingDeliveryMode" AS ENUM ('VISIT', 'ON_SITE', 'VIRTUAL', 'PHONE', 'HYBRID', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TrainingProofRequirement" AS ENUM ('NOTES_ONLY', 'ATTENDANCE_AND_NOTES', 'PHOTO_OPTIONAL', 'CERTIFICATE_REQUIRED');

-- CreateEnum
CREATE TYPE "AccountTrainingProgramStatus" AS ENUM ('NOT_STARTED', 'ACTIVE', 'COMPLETE', 'OVERDUE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TrainingSessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "TrainingActivityKind" AS ENUM ('TRAINING', 'SITE_VISIT');

-- CreateTable
CREATE TABLE "TrainingCategory" (
    "id" UUID NOT NULL,
    "kind" "TrainingCategoryKind" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingType" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "family" "TrainingCatalogFamily" NOT NULL,
    "deliveryMode" "TrainingDeliveryMode" NOT NULL,
    "defaultDurationMinutes" INTEGER NOT NULL,
    "countsTowardHours" BOOLEAN NOT NULL DEFAULT true,
    "isCustomerFacing" BOOLEAN NOT NULL DEFAULT true,
    "isCertificationTrack" BOOLEAN NOT NULL DEFAULT false,
    "targetSegment" "AccountSegment",
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingTemplate" (
    "id" UUID NOT NULL,
    "trainingTypeId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "prerequisiteSummary" TEXT,
    "materialsSummary" TEXT,
    "proofRequirement" "TrainingProofRequirement" NOT NULL DEFAULT 'ATTENDANCE_AND_NOTES',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingCadencePolicy" (
    "id" UUID NOT NULL,
    "trainingTypeId" UUID NOT NULL,
    "segmentScope" "AccountSegment",
    "cadenceDays" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "appliesToAllAccounts" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCadencePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingTrainerProfile" (
    "userId" UUID NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingTrainerProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AccountTrainingProgram" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "trainingTypeId" UUID,
    "templateId" UUID,
    "createdByUserId" UUID,
    "ownerTmUserId" UUID,
    "ownerRdUserId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "AccountTrainingProgramStatus" NOT NULL DEFAULT 'ACTIVE',
    "cadenceDays" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "targetSegment" "AccountSegment",
    "nextDueAt" TIMESTAMP(3),
    "lastCompletedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountTrainingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingSession" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "locationId" UUID,
    "programId" UUID,
    "trainingTypeId" UUID,
    "trainerUserId" UUID,
    "activityKind" "TrainingActivityKind" NOT NULL DEFAULT 'TRAINING',
    "status" "TrainingSessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "durationMinutes" INTEGER NOT NULL DEFAULT 0,
    "attendeeCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCategory_code_key" ON "TrainingCategory"("code");

-- CreateIndex
CREATE INDEX "TrainingCategory_kind_idx" ON "TrainingCategory"("kind");

-- CreateIndex
CREATE INDEX "TrainingCategory_sortOrder_idx" ON "TrainingCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "TrainingCategory_isActive_idx" ON "TrainingCategory"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingType_code_key" ON "TrainingType"("code");

-- CreateIndex
CREATE INDEX "TrainingType_categoryId_idx" ON "TrainingType"("categoryId");

-- CreateIndex
CREATE INDEX "TrainingType_family_idx" ON "TrainingType"("family");

-- CreateIndex
CREATE INDEX "TrainingType_deliveryMode_idx" ON "TrainingType"("deliveryMode");

-- CreateIndex
CREATE INDEX "TrainingType_targetSegment_idx" ON "TrainingType"("targetSegment");

-- CreateIndex
CREATE INDEX "TrainingType_sortOrder_idx" ON "TrainingType"("sortOrder");

-- CreateIndex
CREATE INDEX "TrainingType_isActive_idx" ON "TrainingType"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingTemplate_code_key" ON "TrainingTemplate"("code");

-- CreateIndex
CREATE INDEX "TrainingTemplate_trainingTypeId_idx" ON "TrainingTemplate"("trainingTypeId");

-- CreateIndex
CREATE INDEX "TrainingTemplate_proofRequirement_idx" ON "TrainingTemplate"("proofRequirement");

-- CreateIndex
CREATE INDEX "TrainingTemplate_isActive_idx" ON "TrainingTemplate"("isActive");

-- CreateIndex
CREATE INDEX "TrainingCadencePolicy_trainingTypeId_idx" ON "TrainingCadencePolicy"("trainingTypeId");

-- CreateIndex
CREATE INDEX "TrainingCadencePolicy_segmentScope_idx" ON "TrainingCadencePolicy"("segmentScope");

-- CreateIndex
CREATE INDEX "TrainingCadencePolicy_isRequired_idx" ON "TrainingCadencePolicy"("isRequired");

-- CreateIndex
CREATE INDEX "TrainingCadencePolicy_isActive_idx" ON "TrainingCadencePolicy"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingCadencePolicy_trainingTypeId_segmentScope_key" ON "TrainingCadencePolicy"("trainingTypeId", "segmentScope");

-- CreateIndex
CREATE INDEX "AccountTrainingProgram_accountId_idx" ON "AccountTrainingProgram"("accountId");

-- CreateIndex
CREATE INDEX "AccountTrainingProgram_trainingTypeId_idx" ON "AccountTrainingProgram"("trainingTypeId");

-- CreateIndex
CREATE INDEX "AccountTrainingProgram_templateId_idx" ON "AccountTrainingProgram"("templateId");

-- CreateIndex
CREATE INDEX "AccountTrainingProgram_createdByUserId_idx" ON "AccountTrainingProgram"("createdByUserId");

-- CreateIndex
CREATE INDEX "AccountTrainingProgram_ownerTmUserId_idx" ON "AccountTrainingProgram"("ownerTmUserId");

-- CreateIndex
CREATE INDEX "AccountTrainingProgram_ownerRdUserId_idx" ON "AccountTrainingProgram"("ownerRdUserId");

-- CreateIndex
CREATE INDEX "AccountTrainingProgram_status_idx" ON "AccountTrainingProgram"("status");

-- CreateIndex
CREATE INDEX "AccountTrainingProgram_targetSegment_idx" ON "AccountTrainingProgram"("targetSegment");

-- CreateIndex
CREATE INDEX "AccountTrainingProgram_nextDueAt_idx" ON "AccountTrainingProgram"("nextDueAt");

-- CreateIndex
CREATE INDEX "TrainingSession_accountId_idx" ON "TrainingSession"("accountId");

-- CreateIndex
CREATE INDEX "TrainingSession_locationId_idx" ON "TrainingSession"("locationId");

-- CreateIndex
CREATE INDEX "TrainingSession_programId_idx" ON "TrainingSession"("programId");

-- CreateIndex
CREATE INDEX "TrainingSession_trainingTypeId_idx" ON "TrainingSession"("trainingTypeId");

-- CreateIndex
CREATE INDEX "TrainingSession_trainerUserId_idx" ON "TrainingSession"("trainerUserId");

-- CreateIndex
CREATE INDEX "TrainingSession_activityKind_idx" ON "TrainingSession"("activityKind");

-- CreateIndex
CREATE INDEX "TrainingSession_status_idx" ON "TrainingSession"("status");

-- CreateIndex
CREATE INDEX "TrainingSession_scheduledAt_idx" ON "TrainingSession"("scheduledAt");

-- CreateIndex
CREATE INDEX "TrainingSession_completedAt_idx" ON "TrainingSession"("completedAt");

-- AddForeignKey
ALTER TABLE "TrainingType" ADD CONSTRAINT "TrainingType_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "TrainingCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingTemplate" ADD CONSTRAINT "TrainingTemplate_trainingTypeId_fkey" FOREIGN KEY ("trainingTypeId") REFERENCES "TrainingType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCadencePolicy" ADD CONSTRAINT "TrainingCadencePolicy_trainingTypeId_fkey" FOREIGN KEY ("trainingTypeId") REFERENCES "TrainingType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingTrainerProfile" ADD CONSTRAINT "TrainingTrainerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTrainingProgram" ADD CONSTRAINT "AccountTrainingProgram_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTrainingProgram" ADD CONSTRAINT "AccountTrainingProgram_trainingTypeId_fkey" FOREIGN KEY ("trainingTypeId") REFERENCES "TrainingType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTrainingProgram" ADD CONSTRAINT "AccountTrainingProgram_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "TrainingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTrainingProgram" ADD CONSTRAINT "AccountTrainingProgram_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTrainingProgram" ADD CONSTRAINT "AccountTrainingProgram_ownerTmUserId_fkey" FOREIGN KEY ("ownerTmUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountTrainingProgram" ADD CONSTRAINT "AccountTrainingProgram_ownerRdUserId_fkey" FOREIGN KEY ("ownerRdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AccountLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AccountTrainingProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainingTypeId_fkey" FOREIGN KEY ("trainingTypeId") REFERENCES "TrainingType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingSession" ADD CONSTRAINT "TrainingSession_trainerUserId_fkey" FOREIGN KEY ("trainerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
