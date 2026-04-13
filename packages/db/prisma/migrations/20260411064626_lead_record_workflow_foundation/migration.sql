-- CreateEnum
CREATE TYPE "LeadConsignmentInterestStatus" AS ENUM ('NOT_DISCUSSED', 'INTERESTED', 'APPROVED', 'DECLINED');

-- CreateEnum
CREATE TYPE "LeadConsignmentEntryTiming" AS ENUM ('AT_ONBOARDING', 'LATER');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "consignmentEntryTiming" "LeadConsignmentEntryTiming",
ADD COLUMN     "consignmentInterestStatus" "LeadConsignmentInterestStatus",
ADD COLUMN     "discoveryBuyingIntent" TEXT,
ADD COLUMN     "discoveryCallSkipped" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discoveryCurrentIaqSetup" TEXT,
ADD COLUMN     "discoveryDecisionMaker" TEXT,
ADD COLUMN     "discoveryFastTrackReason" TEXT,
ADD COLUMN     "discoveryPainPoints" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "discoverySummary" TEXT;
