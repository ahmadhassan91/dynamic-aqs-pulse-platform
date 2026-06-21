-- CreateTable
CREATE TABLE "UserNotificationPreference" (
    "id" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "category" "UserNotificationCategory" NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserNotificationPreference_recipientUserId_idx" ON "UserNotificationPreference"("recipientUserId");

-- CreateIndex
CREATE UNIQUE INDEX "UserNotificationPreference_recipientUserId_category_key" ON "UserNotificationPreference"("recipientUserId", "category");
