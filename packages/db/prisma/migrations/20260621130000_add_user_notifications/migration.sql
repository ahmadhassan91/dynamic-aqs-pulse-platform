-- CreateEnum
CREATE TYPE "UserNotificationCategory" AS ENUM ('LEAD', 'CONSIGNMENT', 'TRAINING', 'ORDER', 'ACCOUNT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UserNotificationSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateTable
CREATE TABLE "UserNotification" (
    "id" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "category" "UserNotificationCategory" NOT NULL,
    "eventType" TEXT NOT NULL,
    "severity" "UserNotificationSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "body" TEXT,
    "deepLinkType" TEXT,
    "deepLinkId" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "metadata" JSONB,
    "readAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserNotification_recipientUserId_readAt_idx" ON "UserNotification"("recipientUserId", "readAt");

-- CreateIndex
CREATE INDEX "UserNotification_recipientUserId_archivedAt_createdAt_idx" ON "UserNotification"("recipientUserId", "archivedAt", "createdAt");

-- CreateIndex
CREATE INDEX "UserNotification_recipientUserId_category_idx" ON "UserNotification"("recipientUserId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotification_recipientUserId_dedupeKey_key" ON "UserNotification"("recipientUserId", "dedupeKey");
