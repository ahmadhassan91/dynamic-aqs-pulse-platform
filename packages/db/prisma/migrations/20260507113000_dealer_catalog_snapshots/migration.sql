-- CreateEnum
CREATE TYPE "DealerCatalogSnapshotStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "DealerCatalogSnapshot" (
    "id" UUID NOT NULL,
    "dealerCatalogViewId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "DealerCatalogSnapshotStatus" NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "publishedByUserId" UUID,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rollbackOfSnapshotId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerCatalogSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerCatalogSnapshotItem" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "dealerCatalogViewId" UUID NOT NULL,
    "presentationId" UUID NOT NULL,
    "baseProductId" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "assetCount" INTEGER NOT NULL DEFAULT 0,
    "assetVersionPayload" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerCatalogSnapshotItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealerCatalogSnapshot_dealerCatalogViewId_version_key" ON "DealerCatalogSnapshot"("dealerCatalogViewId", "version");
CREATE INDEX "DealerCatalogSnapshot_dealerCatalogViewId_isActive_idx" ON "DealerCatalogSnapshot"("dealerCatalogViewId", "isActive");
CREATE INDEX "DealerCatalogSnapshot_status_idx" ON "DealerCatalogSnapshot"("status");
CREATE INDEX "DealerCatalogSnapshot_publishedAt_idx" ON "DealerCatalogSnapshot"("publishedAt");
CREATE INDEX "DealerCatalogSnapshot_rollbackOfSnapshotId_idx" ON "DealerCatalogSnapshot"("rollbackOfSnapshotId");
CREATE UNIQUE INDEX "DealerCatalogSnapshotItem_snapshotId_presentationId_key" ON "DealerCatalogSnapshotItem"("snapshotId", "presentationId");
CREATE INDEX "DealerCatalogSnapshotItem_dealerCatalogViewId_idx" ON "DealerCatalogSnapshotItem"("dealerCatalogViewId");
CREATE INDEX "DealerCatalogSnapshotItem_presentationId_idx" ON "DealerCatalogSnapshotItem"("presentationId");
CREATE INDEX "DealerCatalogSnapshotItem_baseProductId_idx" ON "DealerCatalogSnapshotItem"("baseProductId");

-- AddForeignKey
ALTER TABLE "DealerCatalogSnapshot" ADD CONSTRAINT "DealerCatalogSnapshot_dealerCatalogViewId_fkey" FOREIGN KEY ("dealerCatalogViewId") REFERENCES "DealerCatalogView"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealerCatalogSnapshot" ADD CONSTRAINT "DealerCatalogSnapshot_rollbackOfSnapshotId_fkey" FOREIGN KEY ("rollbackOfSnapshotId") REFERENCES "DealerCatalogSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DealerCatalogSnapshotItem" ADD CONSTRAINT "DealerCatalogSnapshotItem_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "DealerCatalogSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealerCatalogSnapshotItem" ADD CONSTRAINT "DealerCatalogSnapshotItem_dealerCatalogViewId_fkey" FOREIGN KEY ("dealerCatalogViewId") REFERENCES "DealerCatalogView"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealerCatalogSnapshotItem" ADD CONSTRAINT "DealerCatalogSnapshotItem_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "ProductPresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealerCatalogSnapshotItem" ADD CONSTRAINT "DealerCatalogSnapshotItem_baseProductId_fkey" FOREIGN KEY ("baseProductId") REFERENCES "BaseProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
