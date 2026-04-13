-- CreateEnum
CREATE TYPE "LeadLifecycleStatus" AS ENUM ('ACTIVE', 'PARKED', 'CLOSED');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "lifecycleChangedAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleReasonCode" TEXT,
ADD COLUMN     "lifecycleReasonNote" TEXT,
ADD COLUMN     "lifecycleStatus" "LeadLifecycleStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "Lead_lifecycleStatus_idx" ON "Lead"("lifecycleStatus");
