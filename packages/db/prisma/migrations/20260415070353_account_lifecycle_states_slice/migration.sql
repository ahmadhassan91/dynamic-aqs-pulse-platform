-- CreateEnum
CREATE TYPE "AccountLifecycleStatus" AS ENUM ('ACTIVE', 'AT_RISK', 'INACTIVE', 'CHURNED');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "lastEngagementAt" TIMESTAMP(3),
ADD COLUMN     "lastOrderAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleReasonNote" TEXT,
ADD COLUMN     "lifecycleStatus" "AccountLifecycleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "lifecycleStatusChangedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Account_lifecycleStatus_idx" ON "Account"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "Account_lifecycleStatus_isActive_updatedAt_idx" ON "Account"("lifecycleStatus", "isActive", "updatedAt");
