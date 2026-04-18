-- CreateEnum
CREATE TYPE "LeadOperationalAlertType" AS ENUM ('ROUTING_BROADCAST', 'INITIAL_CONTACT_MANAGER_ESCALATION', 'INITIAL_CONTACT_LEADERSHIP_ESCALATION');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "potentialValueCents" INTEGER;

-- CreateTable
CREATE TABLE "LeadOperationalAlertRecipient" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "routingTeam" "LeadRoutingTeam" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "roleTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadOperationalAlertRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadOperationalAlert" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "recipientId" UUID,
    "recipientUserId" UUID,
    "alertType" "LeadOperationalAlertType" NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadOperationalAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadOperationalAlertRecipient_code_key" ON "LeadOperationalAlertRecipient"("code");

-- CreateIndex
CREATE INDEX "LeadOperationalAlertRecipient_routingTeam_isActive_sortOrde_idx" ON "LeadOperationalAlertRecipient"("routingTeam", "isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LeadOperationalAlert_dedupeKey_key" ON "LeadOperationalAlert"("dedupeKey");

-- CreateIndex
CREATE INDEX "LeadOperationalAlert_leadId_alertType_idx" ON "LeadOperationalAlert"("leadId", "alertType");

-- CreateIndex
CREATE INDEX "LeadOperationalAlert_recipientId_idx" ON "LeadOperationalAlert"("recipientId");

-- CreateIndex
CREATE INDEX "LeadOperationalAlert_recipientUserId_idx" ON "LeadOperationalAlert"("recipientUserId");

-- CreateIndex
CREATE INDEX "LeadOperationalAlert_createdAt_idx" ON "LeadOperationalAlert"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_potentialValueCents_idx" ON "Lead"("potentialValueCents");

-- AddForeignKey
ALTER TABLE "LeadOperationalAlert"
ADD CONSTRAINT "LeadOperationalAlert_leadId_fkey"
FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOperationalAlert"
ADD CONSTRAINT "LeadOperationalAlert_recipientId_fkey"
FOREIGN KEY ("recipientId") REFERENCES "LeadOperationalAlertRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadOperationalAlert"
ADD CONSTRAINT "LeadOperationalAlert_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
