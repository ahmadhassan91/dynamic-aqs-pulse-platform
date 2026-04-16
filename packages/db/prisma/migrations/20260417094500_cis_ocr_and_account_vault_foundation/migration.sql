-- CreateTable
CREATE TABLE "AccountPaymentVaultReference" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "sourceCisVaultReferenceId" UUID,
    "provider" "CisPaymentVaultProvider" NOT NULL DEFAULT 'UNKNOWN',
    "vaultToken" TEXT,
    "vaultCustomerRef" TEXT,
    "externalPaymentMethodRef" TEXT,
    "last4" TEXT,
    "brand" TEXT,
    "billingZip" TEXT,
    "authorizationCapturedAt" TIMESTAMP(3),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountPaymentVaultReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountPaymentVaultReference_accountId_createdAt_idx" ON "AccountPaymentVaultReference"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "AccountPaymentVaultReference_accountId_isActive_idx" ON "AccountPaymentVaultReference"("accountId", "isActive");

-- CreateIndex
CREATE INDEX "AccountPaymentVaultReference_provider_idx" ON "AccountPaymentVaultReference"("provider");

-- CreateIndex
CREATE INDEX "AccountPaymentVaultReference_sourceCisVaultReferenceId_idx" ON "AccountPaymentVaultReference"("sourceCisVaultReferenceId");

-- AddForeignKey
ALTER TABLE "AccountPaymentVaultReference" ADD CONSTRAINT "AccountPaymentVaultReference_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountPaymentVaultReference" ADD CONSTRAINT "AccountPaymentVaultReference_sourceCisVaultReferenceId_fkey" FOREIGN KEY ("sourceCisVaultReferenceId") REFERENCES "CisPaymentVaultReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
