-- CreateEnum
CREATE TYPE "WebsiteLeadSubmissionReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_REVIEW', 'CONFIRMED_EXISTING', 'CREATED_NEW_LEAD', 'RELINKED_EXISTING');

-- AlterTable
ALTER TABLE "TerritoryAssignmentOverride" ADD COLUMN     "assignedRdUserId" UUID,
ADD COLUMN     "assignedTmUserId" UUID;

-- AlterTable
ALTER TABLE "WebsiteLeadSubmission" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "WebsiteLeadSubmissionReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" UUID;

-- CreateIndex
CREATE INDEX "TerritoryAssignmentOverride_assignedTmUserId_idx" ON "TerritoryAssignmentOverride"("assignedTmUserId");

-- CreateIndex
CREATE INDEX "TerritoryAssignmentOverride_assignedRdUserId_idx" ON "TerritoryAssignmentOverride"("assignedRdUserId");

-- CreateIndex
CREATE INDEX "WebsiteLeadSubmission_reviewStatus_idx" ON "WebsiteLeadSubmission"("reviewStatus");

-- CreateIndex
CREATE INDEX "WebsiteLeadSubmission_reviewedByUserId_idx" ON "WebsiteLeadSubmission"("reviewedByUserId");

-- AddForeignKey
ALTER TABLE "TerritoryAssignmentOverride" ADD CONSTRAINT "TerritoryAssignmentOverride_assignedTmUserId_fkey" FOREIGN KEY ("assignedTmUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryAssignmentOverride" ADD CONSTRAINT "TerritoryAssignmentOverride_assignedRdUserId_fkey" FOREIGN KEY ("assignedRdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteLeadSubmission" ADD CONSTRAINT "WebsiteLeadSubmission_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
