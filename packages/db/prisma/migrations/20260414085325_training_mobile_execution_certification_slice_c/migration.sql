-- CreateEnum
CREATE TYPE "TrainingCertificationOutcome" AS ENUM ('NOT_APPLICABLE', 'PENDING_DECISION', 'AWARDED', 'NOT_AWARDED');

-- CreateEnum
CREATE TYPE "TrainingCertificationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "certificationOutcome" "TrainingCertificationOutcome" NOT NULL DEFAULT 'NOT_APPLICABLE',
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "checkedOutAt" TIMESTAMP(3),
ADD COLUMN     "checkoutNotes" TEXT,
ADD COLUMN     "proofAttachmentCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "proofCapturedAt" TIMESTAMP(3),
ADD COLUMN     "proofNotes" TEXT;

-- CreateTable
CREATE TABLE "TrainingCertificationRecord" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "sessionId" UUID,
    "programId" UUID,
    "trainingTypeId" UUID,
    "awardedByUserId" UUID,
    "certificationCode" TEXT,
    "title" TEXT NOT NULL,
    "status" "TrainingCertificationStatus" NOT NULL DEFAULT 'ACTIVE',
    "awardedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingCertificationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingCertificationRecord_accountId_idx" ON "TrainingCertificationRecord"("accountId");

-- CreateIndex
CREATE INDEX "TrainingCertificationRecord_sessionId_idx" ON "TrainingCertificationRecord"("sessionId");

-- CreateIndex
CREATE INDEX "TrainingCertificationRecord_programId_idx" ON "TrainingCertificationRecord"("programId");

-- CreateIndex
CREATE INDEX "TrainingCertificationRecord_trainingTypeId_idx" ON "TrainingCertificationRecord"("trainingTypeId");

-- CreateIndex
CREATE INDEX "TrainingCertificationRecord_awardedByUserId_idx" ON "TrainingCertificationRecord"("awardedByUserId");

-- CreateIndex
CREATE INDEX "TrainingCertificationRecord_status_idx" ON "TrainingCertificationRecord"("status");

-- CreateIndex
CREATE INDEX "TrainingCertificationRecord_awardedAt_idx" ON "TrainingCertificationRecord"("awardedAt");

-- CreateIndex
CREATE INDEX "TrainingCertificationRecord_expiresAt_idx" ON "TrainingCertificationRecord"("expiresAt");

-- CreateIndex
CREATE INDEX "TrainingSession_certificationOutcome_idx" ON "TrainingSession"("certificationOutcome");

-- CreateIndex
CREATE INDEX "TrainingSession_checkedInAt_idx" ON "TrainingSession"("checkedInAt");

-- CreateIndex
CREATE INDEX "TrainingSession_checkedOutAt_idx" ON "TrainingSession"("checkedOutAt");

-- AddForeignKey
ALTER TABLE "TrainingCertificationRecord" ADD CONSTRAINT "TrainingCertificationRecord_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificationRecord" ADD CONSTRAINT "TrainingCertificationRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificationRecord" ADD CONSTRAINT "TrainingCertificationRecord_programId_fkey" FOREIGN KEY ("programId") REFERENCES "AccountTrainingProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificationRecord" ADD CONSTRAINT "TrainingCertificationRecord_trainingTypeId_fkey" FOREIGN KEY ("trainingTypeId") REFERENCES "TrainingType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingCertificationRecord" ADD CONSTRAINT "TrainingCertificationRecord_awardedByUserId_fkey" FOREIGN KEY ("awardedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
