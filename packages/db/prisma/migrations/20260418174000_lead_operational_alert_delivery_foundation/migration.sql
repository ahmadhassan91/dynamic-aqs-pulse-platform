CREATE TYPE "LeadOperationalAlertDeliveryMode" AS ENUM ('PREVIEW', 'DISABLED');
CREATE TYPE "LeadOperationalAlertDeliveryStatus" AS ENUM ('PENDING', 'PREVIEWED', 'SENT', 'SKIPPED', 'FAILED');

ALTER TABLE "LeadOperationalAlert"
ADD COLUMN "deliveryStatus" "LeadOperationalAlertDeliveryStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "lastDeliveryAttemptAt" TIMESTAMP(3),
ADD COLUMN "deliveredAt" TIMESTAMP(3);

CREATE TABLE "LeadOperationalAlertDeliveryAttempt" (
    "id" UUID NOT NULL,
    "alertId" UUID NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "deliveryMode" "LeadOperationalAlertDeliveryMode" NOT NULL,
    "status" "LeadOperationalAlertDeliveryStatus" NOT NULL,
    "providerKey" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "subject" TEXT NOT NULL,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "LeadOperationalAlertDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LeadOperationalAlertDeliveryAttempt_alertId_attemptNumber_key" ON "LeadOperationalAlertDeliveryAttempt"("alertId", "attemptNumber");
CREATE INDEX "LeadOperationalAlertDeliveryAttempt_alertId_createdAt_idx" ON "LeadOperationalAlertDeliveryAttempt"("alertId", "createdAt");
CREATE INDEX "LeadOperationalAlertDeliveryAttempt_status_createdAt_idx" ON "LeadOperationalAlertDeliveryAttempt"("status", "createdAt");
CREATE INDEX "LeadOperationalAlert_deliveryStatus_createdAt_idx" ON "LeadOperationalAlert"("deliveryStatus", "createdAt");

ALTER TABLE "LeadOperationalAlertDeliveryAttempt"
ADD CONSTRAINT "LeadOperationalAlertDeliveryAttempt_alertId_fkey"
FOREIGN KEY ("alertId") REFERENCES "LeadOperationalAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
