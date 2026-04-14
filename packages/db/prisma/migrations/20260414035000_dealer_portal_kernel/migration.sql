-- CreateEnum
CREATE TYPE "DealerPortalProvisioningStatus" AS ENUM ('NOT_STARTED', 'READY_TO_PROVISION', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "DealerPortalUserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateTable
CREATE TABLE "DealerPortalAccount" (
    "accountId" UUID NOT NULL,
    "status" "DealerPortalProvisioningStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "provisionedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerPortalAccount_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "DealerPortalUser" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "contactId" UUID,
    "userId" UUID NOT NULL,
    "createdByUserId" UUID,
    "status" "DealerPortalUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimaryOwner" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "activatedAt" TIMESTAMP(3),
    "suspendedAt" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerPortalUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealerPortalAccount_status_idx" ON "DealerPortalAccount"("status");

-- CreateIndex
CREATE INDEX "DealerPortalAccount_provisionedAt_idx" ON "DealerPortalAccount"("provisionedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DealerPortalUser_userId_key" ON "DealerPortalUser"("userId");

-- CreateIndex
CREATE INDEX "DealerPortalUser_accountId_idx" ON "DealerPortalUser"("accountId");

-- CreateIndex
CREATE INDEX "DealerPortalUser_contactId_idx" ON "DealerPortalUser"("contactId");

-- CreateIndex
CREATE INDEX "DealerPortalUser_createdByUserId_idx" ON "DealerPortalUser"("createdByUserId");

-- CreateIndex
CREATE INDEX "DealerPortalUser_status_idx" ON "DealerPortalUser"("status");

-- CreateIndex
CREATE INDEX "DealerPortalUser_isPrimaryOwner_idx" ON "DealerPortalUser"("isPrimaryOwner");

-- AddForeignKey
ALTER TABLE "DealerPortalAccount" ADD CONSTRAINT "DealerPortalAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPortalUser" ADD CONSTRAINT "DealerPortalUser_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPortalUser" ADD CONSTRAINT "DealerPortalUser_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPortalUser" ADD CONSTRAINT "DealerPortalUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPortalUser" ADD CONSTRAINT "DealerPortalUser_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
