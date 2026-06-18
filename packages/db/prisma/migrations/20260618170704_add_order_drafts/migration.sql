-- CreateEnum
CREATE TYPE "OrderDraftStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'FULFILLED', 'CANCELLED');

-- CreateTable
CREATE TABLE "OrderDraft" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "shipToLocationId" UUID,
    "status" "OrderDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "referenceCode" TEXT,
    "customerPoNumber" TEXT,
    "notes" TEXT,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "subtotalCents" INTEGER NOT NULL DEFAULT 0,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "pricingEstimated" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" UUID,
    "submittedAt" TIMESTAMP(3),
    "submittedByUserId" UUID,
    "fulfilledAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderDraftLine" (
    "id" UUID NOT NULL,
    "orderDraftId" UUID NOT NULL,
    "baseProductId" UUID,
    "sku" TEXT,
    "productName" TEXT NOT NULL,
    "unitOfMeasure" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPriceCents" INTEGER,
    "lineNote" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderDraftLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderDraft_accountId_idx" ON "OrderDraft"("accountId");

-- CreateIndex
CREATE INDEX "OrderDraft_shipToLocationId_idx" ON "OrderDraft"("shipToLocationId");

-- CreateIndex
CREATE INDEX "OrderDraft_status_idx" ON "OrderDraft"("status");

-- CreateIndex
CREATE INDEX "OrderDraft_createdByUserId_idx" ON "OrderDraft"("createdByUserId");

-- CreateIndex
CREATE INDEX "OrderDraft_submittedByUserId_idx" ON "OrderDraft"("submittedByUserId");

-- CreateIndex
CREATE INDEX "OrderDraft_status_updatedAt_idx" ON "OrderDraft"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "OrderDraftLine_orderDraftId_idx" ON "OrderDraftLine"("orderDraftId");

-- CreateIndex
CREATE INDEX "OrderDraftLine_baseProductId_idx" ON "OrderDraftLine"("baseProductId");

-- AddForeignKey
ALTER TABLE "OrderDraft" ADD CONSTRAINT "OrderDraft_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDraft" ADD CONSTRAINT "OrderDraft_shipToLocationId_fkey" FOREIGN KEY ("shipToLocationId") REFERENCES "AccountLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDraft" ADD CONSTRAINT "OrderDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDraft" ADD CONSTRAINT "OrderDraft_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDraftLine" ADD CONSTRAINT "OrderDraftLine_orderDraftId_fkey" FOREIGN KEY ("orderDraftId") REFERENCES "OrderDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDraftLine" ADD CONSTRAINT "OrderDraftLine_baseProductId_fkey" FOREIGN KEY ("baseProductId") REFERENCES "BaseProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
