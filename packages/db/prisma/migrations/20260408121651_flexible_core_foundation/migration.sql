-- CreateEnum
CREATE TYPE "AccountSegment" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'DISTRIBUTOR', 'MIXED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SegmentAssignmentSource" AS ENUM ('ACUMATICA', 'CRM', 'ADMIN', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ClassificationExceptionStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'SYNC', 'IMPORT', 'EXPORT', 'APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "FeatureFlagState" AS ENUM ('OFF', 'ON', 'ROLLOUT');

-- CreateEnum
CREATE TYPE "ExternalReferenceSource" AS ENUM ('ACUMATICA', 'HUBSPOT', 'SHOPIFY', 'DROPBOX', 'WIDEN', 'LEGACY', 'MANUAL');

-- CreateEnum
CREATE TYPE "ExternalReferenceEntityType" AS ENUM ('ACCOUNT', 'CONTACT', 'LOCATION', 'ORDER', 'PRODUCT', 'USER', 'SEGMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "DataSourceSystem" AS ENUM ('ACUMATICA', 'DYNAMICS_CRM', 'HUBSPOT', 'SHOPIFY', 'QUICKBOOKS', 'AZURE_SQL', 'MAP_MY_CUSTOMER', 'OUTLOOK', 'DROPBOX', 'WIDEN', 'FILE_IMPORT', 'LEGACY', 'MANUAL');

-- CreateEnum
CREATE TYPE "DataRecordEntityType" AS ENUM ('ACCOUNT', 'CONTACT', 'LOCATION', 'ORDER', 'PRODUCT', 'USER', 'DEALER', 'TRAINING_RECORD', 'ASSET', 'OTHER');

-- CreateEnum
CREATE TYPE "MigrationWave" AS ENUM ('WAVE_0', 'WAVE_1', 'WAVE_2', 'WAVE_3');

-- CreateEnum
CREATE TYPE "MigrationRunMode" AS ENUM ('DRY_RUN', 'REHEARSAL', 'BOOTSTRAP', 'DELTA', 'CUTOVER', 'ROLLBACK');

-- CreateEnum
CREATE TYPE "MigrationRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SnapshotStatus" AS ENUM ('CAPTURED', 'NORMALIZED', 'STAGED', 'RECONCILED', 'ARCHIVED', 'ERROR');

-- CreateEnum
CREATE TYPE "MigrationRecordStatus" AS ENUM ('STAGED', 'SKIPPED', 'IMPORTED', 'RECONCILED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "roleCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "accessTokenJti" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEntry" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "beforeData" JSONB,
    "afterData" JSONB,
    "metadata" JSONB,
    "requestId" TEXT,
    "correlationId" TEXT,
    "sourceSystem" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "state" "FeatureFlagState" NOT NULL DEFAULT 'OFF',
    "rolloutPercent" INTEGER NOT NULL DEFAULT 0,
    "enabledForJson" JSONB,
    "disabledForJson" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExternalReference" (
    "id" UUID NOT NULL,
    "source" "ExternalReferenceSource" NOT NULL,
    "entityType" "ExternalReferenceEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalParentId" TEXT,
    "externalKey" TEXT,
    "payload" JSONB,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationRun" (
    "id" UUID NOT NULL,
    "sourceSystem" "DataSourceSystem" NOT NULL,
    "wave" "MigrationWave",
    "mode" "MigrationRunMode" NOT NULL,
    "status" "MigrationRunStatus" NOT NULL DEFAULT 'PENDING',
    "startedByUserId" UUID,
    "entityScope" JSONB,
    "summary" JSONB,
    "reconciliation" JSONB,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRecordSnapshot" (
    "id" UUID NOT NULL,
    "migrationRunId" UUID,
    "sourceSystem" "DataSourceSystem" NOT NULL,
    "entityType" "DataRecordEntityType" NOT NULL,
    "externalId" TEXT NOT NULL,
    "targetEntityType" "DataRecordEntityType",
    "targetEntityId" TEXT,
    "sourceModifiedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "normalizedAt" TIMESTAMP(3),
    "reconciledAt" TIMESTAMP(3),
    "status" "SnapshotStatus" NOT NULL DEFAULT 'CAPTURED',
    "payloadChecksum" TEXT,
    "rawPayload" JSONB NOT NULL,
    "normalizedPayload" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceRecordSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MigrationRunRecord" (
    "id" UUID NOT NULL,
    "migrationRunId" UUID NOT NULL,
    "snapshotId" UUID,
    "sourceSystem" "DataSourceSystem" NOT NULL,
    "entityType" "DataRecordEntityType" NOT NULL,
    "externalId" TEXT,
    "targetEntityType" "DataRecordEntityType",
    "targetEntityId" TEXT,
    "status" "MigrationRecordStatus" NOT NULL DEFAULT 'STAGED',
    "message" TEXT,
    "fieldDiff" JSONB,
    "reconciliation" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MigrationRunRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSegmentRef" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessSegmentRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "accountNumber" TEXT,
    "displayName" TEXT NOT NULL,
    "legalName" TEXT,
    "accountType" TEXT,
    "businessSegmentId" UUID,
    "businessSegmentSource" "SegmentAssignmentSource",
    "isMixedBusinessAccount" BOOLEAN NOT NULL DEFAULT false,
    "classificationDriftFlag" BOOLEAN NOT NULL DEFAULT false,
    "financeAuthorityMode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountLocation" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "locationCode" TEXT,
    "name" TEXT,
    "line1" TEXT,
    "line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "countryCode" TEXT DEFAULT 'US',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "locationId" UUID,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobilePhone" TEXT,
    "roleCode" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountExtension" (
    "accountId" UUID NOT NULL,
    "legacyAttributes" JSONB,
    "sourceMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountExtension_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "AccountLocationExtension" (
    "locationId" UUID NOT NULL,
    "legacyAttributes" JSONB,
    "sourceMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountLocationExtension_pkey" PRIMARY KEY ("locationId")
);

-- CreateTable
CREATE TABLE "ContactExtension" (
    "contactId" UUID NOT NULL,
    "legacyAttributes" JSONB,
    "sourceMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactExtension_pkey" PRIMARY KEY ("contactId")
);

-- CreateTable
CREATE TABLE "AccountSegmentAssignment" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "businessSegmentId" UUID NOT NULL,
    "source" "SegmentAssignmentSource" NOT NULL,
    "confidence" INTEGER NOT NULL DEFAULT 100,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "assignedByUserId" UUID,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountSegmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassificationException" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "businessSegmentId" UUID,
    "status" "ClassificationExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "reasonCode" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "openedByUserId" UUID,
    "resolvedByUserId" UUID,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassificationException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleCode_idx" ON "User"("roleCode");

-- CreateIndex
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Session_refreshTokenHash_key" ON "Session"("refreshTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Session_accessTokenJti_key" ON "Session"("accessTokenJti");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Session_revokedAt_idx" ON "Session"("revokedAt");

-- CreateIndex
CREATE INDEX "AuditEntry_actorUserId_idx" ON "AuditEntry"("actorUserId");

-- CreateIndex
CREATE INDEX "AuditEntry_entityType_entityId_idx" ON "AuditEntry"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEntry_action_idx" ON "AuditEntry"("action");

-- CreateIndex
CREATE INDEX "AuditEntry_requestId_idx" ON "AuditEntry"("requestId");

-- CreateIndex
CREATE INDEX "AuditEntry_correlationId_idx" ON "AuditEntry"("correlationId");

-- CreateIndex
CREATE INDEX "AuditEntry_createdAt_idx" ON "AuditEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_state_idx" ON "FeatureFlag"("state");

-- CreateIndex
CREATE INDEX "FeatureFlag_rolloutPercent_idx" ON "FeatureFlag"("rolloutPercent");

-- CreateIndex
CREATE INDEX "ExternalReference_entityType_entityId_idx" ON "ExternalReference"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "ExternalReference_source_entityType_idx" ON "ExternalReference"("source", "entityType");

-- CreateIndex
CREATE INDEX "ExternalReference_externalId_idx" ON "ExternalReference"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalReference_source_entityType_externalId_key" ON "ExternalReference"("source", "entityType", "externalId");

-- CreateIndex
CREATE INDEX "MigrationRun_sourceSystem_mode_idx" ON "MigrationRun"("sourceSystem", "mode");

-- CreateIndex
CREATE INDEX "MigrationRun_status_idx" ON "MigrationRun"("status");

-- CreateIndex
CREATE INDEX "MigrationRun_wave_idx" ON "MigrationRun"("wave");

-- CreateIndex
CREATE INDEX "MigrationRun_startedAt_idx" ON "MigrationRun"("startedAt");

-- CreateIndex
CREATE INDEX "SourceRecordSnapshot_migrationRunId_idx" ON "SourceRecordSnapshot"("migrationRunId");

-- CreateIndex
CREATE INDEX "SourceRecordSnapshot_status_idx" ON "SourceRecordSnapshot"("status");

-- CreateIndex
CREATE INDEX "SourceRecordSnapshot_targetEntityType_targetEntityId_idx" ON "SourceRecordSnapshot"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE INDEX "SourceRecordSnapshot_sourceSystem_entityType_idx" ON "SourceRecordSnapshot"("sourceSystem", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "SourceRecordSnapshot_sourceSystem_entityType_externalId_key" ON "SourceRecordSnapshot"("sourceSystem", "entityType", "externalId");

-- CreateIndex
CREATE INDEX "MigrationRunRecord_migrationRunId_status_idx" ON "MigrationRunRecord"("migrationRunId", "status");

-- CreateIndex
CREATE INDEX "MigrationRunRecord_snapshotId_idx" ON "MigrationRunRecord"("snapshotId");

-- CreateIndex
CREATE INDEX "MigrationRunRecord_sourceSystem_entityType_idx" ON "MigrationRunRecord"("sourceSystem", "entityType");

-- CreateIndex
CREATE INDEX "MigrationRunRecord_targetEntityType_targetEntityId_idx" ON "MigrationRunRecord"("targetEntityType", "targetEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessSegmentRef_code_key" ON "BusinessSegmentRef"("code");

-- CreateIndex
CREATE INDEX "BusinessSegmentRef_isActive_idx" ON "BusinessSegmentRef"("isActive");

-- CreateIndex
CREATE INDEX "BusinessSegmentRef_sortOrder_idx" ON "BusinessSegmentRef"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Account_accountNumber_key" ON "Account"("accountNumber");

-- CreateIndex
CREATE INDEX "Account_businessSegmentId_idx" ON "Account"("businessSegmentId");

-- CreateIndex
CREATE INDEX "Account_isActive_idx" ON "Account"("isActive");

-- CreateIndex
CREATE INDEX "Account_accountType_idx" ON "Account"("accountType");

-- CreateIndex
CREATE INDEX "Account_displayName_idx" ON "Account"("displayName");

-- CreateIndex
CREATE INDEX "AccountLocation_accountId_idx" ON "AccountLocation"("accountId");

-- CreateIndex
CREATE INDEX "AccountLocation_isPrimary_idx" ON "AccountLocation"("isPrimary");

-- CreateIndex
CREATE INDEX "AccountLocation_isActive_idx" ON "AccountLocation"("isActive");

-- CreateIndex
CREATE INDEX "Contact_accountId_idx" ON "Contact"("accountId");

-- CreateIndex
CREATE INDEX "Contact_locationId_idx" ON "Contact"("locationId");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "Contact_isPrimary_idx" ON "Contact"("isPrimary");

-- CreateIndex
CREATE INDEX "AccountSegmentAssignment_accountId_idx" ON "AccountSegmentAssignment"("accountId");

-- CreateIndex
CREATE INDEX "AccountSegmentAssignment_businessSegmentId_idx" ON "AccountSegmentAssignment"("businessSegmentId");

-- CreateIndex
CREATE INDEX "AccountSegmentAssignment_source_idx" ON "AccountSegmentAssignment"("source");

-- CreateIndex
CREATE INDEX "AccountSegmentAssignment_isPrimary_idx" ON "AccountSegmentAssignment"("isPrimary");

-- CreateIndex
CREATE INDEX "AccountSegmentAssignment_effectiveFrom_idx" ON "AccountSegmentAssignment"("effectiveFrom");

-- CreateIndex
CREATE INDEX "ClassificationException_accountId_idx" ON "ClassificationException"("accountId");

-- CreateIndex
CREATE INDEX "ClassificationException_businessSegmentId_idx" ON "ClassificationException"("businessSegmentId");

-- CreateIndex
CREATE INDEX "ClassificationException_status_idx" ON "ClassificationException"("status");

-- CreateIndex
CREATE INDEX "ClassificationException_reasonCode_idx" ON "ClassificationException"("reasonCode");

-- CreateIndex
CREATE INDEX "ClassificationException_openedAt_idx" ON "ClassificationException"("openedAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEntry" ADD CONSTRAINT "AuditEntry_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRun" ADD CONSTRAINT "MigrationRun_startedByUserId_fkey" FOREIGN KEY ("startedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceRecordSnapshot" ADD CONSTRAINT "SourceRecordSnapshot_migrationRunId_fkey" FOREIGN KEY ("migrationRunId") REFERENCES "MigrationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRunRecord" ADD CONSTRAINT "MigrationRunRecord_migrationRunId_fkey" FOREIGN KEY ("migrationRunId") REFERENCES "MigrationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MigrationRunRecord" ADD CONSTRAINT "MigrationRunRecord_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "SourceRecordSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_businessSegmentId_fkey" FOREIGN KEY ("businessSegmentId") REFERENCES "BusinessSegmentRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLocation" ADD CONSTRAINT "AccountLocation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AccountLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountExtension" ADD CONSTRAINT "AccountExtension_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLocationExtension" ADD CONSTRAINT "AccountLocationExtension_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "AccountLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactExtension" ADD CONSTRAINT "ContactExtension_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSegmentAssignment" ADD CONSTRAINT "AccountSegmentAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSegmentAssignment" ADD CONSTRAINT "AccountSegmentAssignment_businessSegmentId_fkey" FOREIGN KEY ("businessSegmentId") REFERENCES "BusinessSegmentRef"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountSegmentAssignment" ADD CONSTRAINT "AccountSegmentAssignment_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationException" ADD CONSTRAINT "ClassificationException_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationException" ADD CONSTRAINT "ClassificationException_businessSegmentId_fkey" FOREIGN KEY ("businessSegmentId") REFERENCES "BusinessSegmentRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationException" ADD CONSTRAINT "ClassificationException_openedByUserId_fkey" FOREIGN KEY ("openedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassificationException" ADD CONSTRAINT "ClassificationException_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
