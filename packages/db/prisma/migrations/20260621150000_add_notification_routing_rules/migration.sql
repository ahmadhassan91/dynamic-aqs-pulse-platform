-- CreateEnum
CREATE TYPE "NotificationRoutingRecipientType" AS ENUM ('ROLE', 'USER');

-- CreateTable
CREATE TABLE "NotificationRoutingRule" (
    "id" UUID NOT NULL,
    "category" "UserNotificationCategory" NOT NULL,
    "eventType" TEXT,
    "recipientType" "NotificationRoutingRecipientType" NOT NULL,
    "recipientRoleCode" TEXT,
    "recipientUserId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationRoutingRule_category_isActive_idx" ON "NotificationRoutingRule"("category", "isActive");
