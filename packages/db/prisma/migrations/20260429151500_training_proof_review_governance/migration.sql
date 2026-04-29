CREATE TYPE "TrainingProofReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

ALTER TABLE "TrainingProofDocument"
  ADD COLUMN "reviewStatus" "TrainingProofReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN "reviewedByUserId" UUID,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNotes" TEXT;

ALTER TABLE "TrainingProofDocument"
  ADD CONSTRAINT "TrainingProofDocument_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "TrainingProofDocument_reviewStatus_idx" ON "TrainingProofDocument"("reviewStatus");
CREATE INDEX "TrainingProofDocument_reviewedByUserId_idx" ON "TrainingProofDocument"("reviewedByUserId");
