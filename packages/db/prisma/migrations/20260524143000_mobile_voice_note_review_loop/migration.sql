-- CreateEnum
CREATE TYPE "MobileVoiceNoteReviewStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "MobileVoiceNote"
  ADD COLUMN "reviewStatus" "MobileVoiceNoteReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
  ADD COLUMN "reviewedByUserId" UUID,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewNotes" TEXT,
  ADD COLUMN "rejectedReason" TEXT,
  ADD COLUMN "writebackCompletedAt" TIMESTAMP(3),
  ADD COLUMN "writebackTarget" TEXT;

-- CreateIndex
CREATE INDEX "MobileVoiceNote_reviewStatus_recordedAt_idx" ON "MobileVoiceNote"("reviewStatus", "recordedAt");

-- CreateIndex
CREATE INDEX "MobileVoiceNote_reviewedByUserId_idx" ON "MobileVoiceNote"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "MobileVoiceNote_writebackCompletedAt_idx" ON "MobileVoiceNote"("writebackCompletedAt");

-- AddForeignKey
ALTER TABLE "MobileVoiceNote" ADD CONSTRAINT "MobileVoiceNote_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
