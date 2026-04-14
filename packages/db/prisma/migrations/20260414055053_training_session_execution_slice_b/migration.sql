-- CreateEnum
CREATE TYPE "TrainingFollowUpTaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "TrainingSession" ADD COLUMN     "completionSummary" TEXT;

-- CreateTable
CREATE TABLE "TrainingFollowUpTask" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "ownerUserId" UUID,
    "createdByUserId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "TrainingFollowUpTaskStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingFollowUpTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingFollowUpTask_sessionId_idx" ON "TrainingFollowUpTask"("sessionId");

-- CreateIndex
CREATE INDEX "TrainingFollowUpTask_accountId_idx" ON "TrainingFollowUpTask"("accountId");

-- CreateIndex
CREATE INDEX "TrainingFollowUpTask_ownerUserId_idx" ON "TrainingFollowUpTask"("ownerUserId");

-- CreateIndex
CREATE INDEX "TrainingFollowUpTask_createdByUserId_idx" ON "TrainingFollowUpTask"("createdByUserId");

-- CreateIndex
CREATE INDEX "TrainingFollowUpTask_status_idx" ON "TrainingFollowUpTask"("status");

-- CreateIndex
CREATE INDEX "TrainingFollowUpTask_dueAt_idx" ON "TrainingFollowUpTask"("dueAt");

-- AddForeignKey
ALTER TABLE "TrainingFollowUpTask" ADD CONSTRAINT "TrainingFollowUpTask_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingFollowUpTask" ADD CONSTRAINT "TrainingFollowUpTask_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingFollowUpTask" ADD CONSTRAINT "TrainingFollowUpTask_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingFollowUpTask" ADD CONSTRAINT "TrainingFollowUpTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
