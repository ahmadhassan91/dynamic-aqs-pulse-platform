-- CreateEnum
CREATE TYPE "CisPaymentCaptureAttemptStatus" AS ENUM ('LAUNCHED', 'TOKEN_RECEIVED', 'FAILED', 'CANCELLED', 'EXPIRED', 'CONSUMED');

-- CreateTable
CREATE TABLE "CisPaymentCaptureAttempt" (
    "id" UUID NOT NULL,
    "cisPackageId" UUID NOT NULL,
    "provider" "CisPaymentVaultProvider" NOT NULL DEFAULT 'UNKNOWN',
    "status" "CisPaymentCaptureAttemptStatus" NOT NULL DEFAULT 'LAUNCHED',
    "providerProfileId" TEXT,
    "launchedByUserId" UUID,
    "completedByUserId" UUID,
    "launchNote" TEXT,
    "resultNote" TEXT,
    "temporaryTokenEncrypted" TEXT,
    "providerResultCode" TEXT,
    "providerErrorMessage" TEXT,
    "providerBin" TEXT,
    "launchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CisPaymentCaptureAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CisPaymentCaptureAttempt_cisPackageId_createdAt_idx" ON "CisPaymentCaptureAttempt"("cisPackageId", "createdAt");

-- CreateIndex
CREATE INDEX "CisPaymentCaptureAttempt_status_idx" ON "CisPaymentCaptureAttempt"("status");

-- CreateIndex
CREATE INDEX "CisPaymentCaptureAttempt_provider_idx" ON "CisPaymentCaptureAttempt"("provider");

-- AddForeignKey
ALTER TABLE "CisPaymentCaptureAttempt" ADD CONSTRAINT "CisPaymentCaptureAttempt_cisPackageId_fkey" FOREIGN KEY ("cisPackageId") REFERENCES "CisPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
