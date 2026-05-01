-- CreateEnum
CREATE TYPE "ProductLifecycleStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISCONTINUED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductPublishStatus" AS ENUM ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'PUBLISHED', 'BLOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductSourceSystem" AS ENUM ('ACUMATICA', 'PULSE', 'SHOPIFY', 'WIDEN', 'FILE_IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "ProductAssetRole" AS ENUM ('PRIMARY_IMAGE', 'GALLERY_IMAGE', 'SPEC_SHEET', 'INSTALL_GUIDE', 'BROCHURE', 'SAFETY_DATA', 'VIDEO', 'TRAINING', 'OTHER');

-- CreateEnum
CREATE TYPE "ProductReadinessStatus" AS ENUM ('PASS', 'WARNING', 'BLOCKED');

-- CreateEnum
CREATE TYPE "DigitalAssetKind" AS ENUM ('IMAGE', 'DOCUMENT', 'VIDEO', 'LOGO', 'PRESENTATION', 'OTHER');

-- CreateEnum
CREATE TYPE "DigitalAssetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'NEEDS_REVIEW', 'ARCHIVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DigitalAssetVisibility" AS ENUM ('INTERNAL_ONLY', 'DEALER_PORTAL', 'PUBLIC');

-- CreateEnum
CREATE TYPE "DigitalAssetReviewStatus" AS ENUM ('NOT_REQUIRED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" UUID NOT NULL,
    "parentId" UUID,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryType" TEXT,
    "regionScope" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductFamily" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaseProduct" (
    "id" UUID NOT NULL,
    "sku" TEXT NOT NULL,
    "acumaticaInventoryId" TEXT,
    "acumaticaItemClass" TEXT,
    "uom" TEXT,
    "itemStatus" TEXT,
    "productName" TEXT NOT NULL,
    "lifecycleStatus" "ProductLifecycleStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceSystem" "ProductSourceSystem" NOT NULL DEFAULT 'MANUAL',
    "sourceOfTruthSystem" "ProductSourceSystem" NOT NULL DEFAULT 'ACUMATICA',
    "categoryId" UUID,
    "familyId" UUID,
    "isSellable" BOOLEAN NOT NULL DEFAULT true,
    "isDealerVisible" BOOLEAN NOT NULL DEFAULT false,
    "acumaticaLastSyncedAt" TIMESTAMP(3),
    "sourceModifiedAt" TIMESTAMP(3),
    "sourceChecksum" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaseProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPresentation" (
    "id" UUID NOT NULL,
    "baseProductId" UUID NOT NULL,
    "displayName" TEXT NOT NULL,
    "shortDescription" TEXT,
    "longDescription" TEXT,
    "specSummary" TEXT,
    "regionScope" TEXT,
    "brandLabel" TEXT,
    "businessSegment" "AccountSegment" NOT NULL DEFAULT 'RESIDENTIAL',
    "publishStatus" "ProductPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "readyForDealerPortal" BOOLEAN NOT NULL DEFAULT false,
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductPresentation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogInclusion" (
    "id" UUID NOT NULL,
    "presentationId" UUID NOT NULL,
    "dealerGroupType" TEXT NOT NULL,
    "dealerGroupId" TEXT,
    "regionScope" TEXT,
    "brandLabel" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "publishStatus" "ProductPublishStatus" NOT NULL DEFAULT 'DRAFT',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogInclusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPublishCheck" (
    "id" UUID NOT NULL,
    "presentationId" UUID NOT NULL,
    "checkCode" TEXT NOT NULL,
    "checkName" TEXT NOT NULL,
    "status" "ProductReadinessStatus" NOT NULL,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPublishCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalAsset" (
    "id" UUID NOT NULL,
    "stableSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "DigitalAssetKind" NOT NULL,
    "status" "DigitalAssetStatus" NOT NULL DEFAULT 'DRAFT',
    "visibility" "DigitalAssetVisibility" NOT NULL DEFAULT 'INTERNAL_ONLY',
    "reviewStatus" "DigitalAssetReviewStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "sourceSystem" "ProductSourceSystem" NOT NULL DEFAULT 'MANUAL',
    "sourceOfTruthSystem" "ProductSourceSystem" NOT NULL DEFAULT 'PULSE',
    "audience" TEXT NOT NULL DEFAULT 'internal',
    "brandScope" TEXT,
    "regionScope" TEXT,
    "dealerGroupType" TEXT,
    "dealerGroupId" TEXT,
    "widenAssetId" TEXT,
    "legacyUrl" TEXT,
    "currentVersionId" UUID,
    "createdByUserId" UUID,
    "approvedByUserId" UUID,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalAssetVersion" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageKey" TEXT,
    "externalUrl" TEXT,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "sha256" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalAssetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAssetAssignment" (
    "id" UUID NOT NULL,
    "presentationId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "assetVersionId" UUID,
    "role" "ProductAssetRole" NOT NULL,
    "dealerGroupType" TEXT,
    "dealerGroupId" TEXT,
    "brandLabel" TEXT,
    "regionScope" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductAssetAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalAssetCollection" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" "DigitalAssetVisibility" NOT NULL DEFAULT 'INTERNAL_ONLY',
    "brandScope" TEXT,
    "regionScope" TEXT,
    "dealerGroupType" TEXT,
    "dealerGroupId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalAssetCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalAssetCollectionItem" (
    "id" UUID NOT NULL,
    "collectionId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DigitalAssetCollectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalAssetMigrationAlias" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "sourceSystem" "ProductSourceSystem" NOT NULL,
    "externalAssetId" TEXT,
    "legacyUrl" TEXT NOT NULL,
    "pulseStableUrl" TEXT,
    "redirectStatus" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalAssetMigrationAlias_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_code_key" ON "ProductCategory"("code");
CREATE INDEX "ProductCategory_parentId_idx" ON "ProductCategory"("parentId");
CREATE INDEX "ProductCategory_isActive_idx" ON "ProductCategory"("isActive");
CREATE INDEX "ProductCategory_sortOrder_idx" ON "ProductCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductFamily_code_key" ON "ProductFamily"("code");
CREATE INDEX "ProductFamily_isActive_idx" ON "ProductFamily"("isActive");
CREATE INDEX "ProductFamily_sortOrder_idx" ON "ProductFamily"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "BaseProduct_sku_key" ON "BaseProduct"("sku");
CREATE INDEX "BaseProduct_acumaticaInventoryId_idx" ON "BaseProduct"("acumaticaInventoryId");
CREATE INDEX "BaseProduct_acumaticaItemClass_idx" ON "BaseProduct"("acumaticaItemClass");
CREATE INDEX "BaseProduct_lifecycleStatus_idx" ON "BaseProduct"("lifecycleStatus");
CREATE INDEX "BaseProduct_sourceSystem_idx" ON "BaseProduct"("sourceSystem");
CREATE INDEX "BaseProduct_sourceOfTruthSystem_idx" ON "BaseProduct"("sourceOfTruthSystem");
CREATE INDEX "BaseProduct_categoryId_idx" ON "BaseProduct"("categoryId");
CREATE INDEX "BaseProduct_familyId_idx" ON "BaseProduct"("familyId");
CREATE INDEX "BaseProduct_isSellable_idx" ON "BaseProduct"("isSellable");
CREATE INDEX "BaseProduct_isDealerVisible_idx" ON "BaseProduct"("isDealerVisible");
CREATE INDEX "BaseProduct_productName_idx" ON "BaseProduct"("productName");

-- CreateIndex
CREATE INDEX "ProductPresentation_baseProductId_idx" ON "ProductPresentation"("baseProductId");
CREATE INDEX "ProductPresentation_publishStatus_idx" ON "ProductPresentation"("publishStatus");
CREATE INDEX "ProductPresentation_regionScope_idx" ON "ProductPresentation"("regionScope");
CREATE INDEX "ProductPresentation_brandLabel_idx" ON "ProductPresentation"("brandLabel");
CREATE INDEX "ProductPresentation_businessSegment_idx" ON "ProductPresentation"("businessSegment");
CREATE INDEX "ProductPresentation_readyForDealerPortal_idx" ON "ProductPresentation"("readyForDealerPortal");

-- CreateIndex
CREATE INDEX "CatalogInclusion_presentationId_idx" ON "CatalogInclusion"("presentationId");
CREATE INDEX "CatalogInclusion_dealerGroupType_dealerGroupId_idx" ON "CatalogInclusion"("dealerGroupType", "dealerGroupId");
CREATE INDEX "CatalogInclusion_regionScope_idx" ON "CatalogInclusion"("regionScope");
CREATE INDEX "CatalogInclusion_brandLabel_idx" ON "CatalogInclusion"("brandLabel");
CREATE INDEX "CatalogInclusion_publishStatus_idx" ON "CatalogInclusion"("publishStatus");
CREATE INDEX "CatalogInclusion_isVisible_idx" ON "CatalogInclusion"("isVisible");

-- CreateIndex
CREATE INDEX "ProductPublishCheck_presentationId_idx" ON "ProductPublishCheck"("presentationId");
CREATE INDEX "ProductPublishCheck_checkCode_idx" ON "ProductPublishCheck"("checkCode");
CREATE INDEX "ProductPublishCheck_status_idx" ON "ProductPublishCheck"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalAsset_stableSlug_key" ON "DigitalAsset"("stableSlug");
CREATE INDEX "DigitalAsset_kind_idx" ON "DigitalAsset"("kind");
CREATE INDEX "DigitalAsset_status_idx" ON "DigitalAsset"("status");
CREATE INDEX "DigitalAsset_visibility_idx" ON "DigitalAsset"("visibility");
CREATE INDEX "DigitalAsset_reviewStatus_idx" ON "DigitalAsset"("reviewStatus");
CREATE INDEX "DigitalAsset_sourceSystem_idx" ON "DigitalAsset"("sourceSystem");
CREATE INDEX "DigitalAsset_brandScope_idx" ON "DigitalAsset"("brandScope");
CREATE INDEX "DigitalAsset_regionScope_idx" ON "DigitalAsset"("regionScope");
CREATE INDEX "DigitalAsset_dealerGroupType_dealerGroupId_idx" ON "DigitalAsset"("dealerGroupType", "dealerGroupId");
CREATE INDEX "DigitalAsset_widenAssetId_idx" ON "DigitalAsset"("widenAssetId");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalAssetVersion_assetId_versionNumber_key" ON "DigitalAssetVersion"("assetId", "versionNumber");
CREATE INDEX "DigitalAssetVersion_assetId_idx" ON "DigitalAssetVersion"("assetId");
CREATE INDEX "DigitalAssetVersion_sha256_idx" ON "DigitalAssetVersion"("sha256");
CREATE INDEX "DigitalAssetVersion_isCurrent_idx" ON "DigitalAssetVersion"("isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "ProductAssetAssignment_presentationId_assetId_role_dealerGroupType_dealerGroupId_brandLabel_regionScope_key" ON "ProductAssetAssignment"("presentationId", "assetId", "role", "dealerGroupType", "dealerGroupId", "brandLabel", "regionScope");
CREATE INDEX "ProductAssetAssignment_presentationId_idx" ON "ProductAssetAssignment"("presentationId");
CREATE INDEX "ProductAssetAssignment_assetId_idx" ON "ProductAssetAssignment"("assetId");
CREATE INDEX "ProductAssetAssignment_assetVersionId_idx" ON "ProductAssetAssignment"("assetVersionId");
CREATE INDEX "ProductAssetAssignment_role_idx" ON "ProductAssetAssignment"("role");
CREATE INDEX "ProductAssetAssignment_dealerGroupType_dealerGroupId_idx" ON "ProductAssetAssignment"("dealerGroupType", "dealerGroupId");
CREATE INDEX "ProductAssetAssignment_brandLabel_idx" ON "ProductAssetAssignment"("brandLabel");
CREATE INDEX "ProductAssetAssignment_regionScope_idx" ON "ProductAssetAssignment"("regionScope");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalAssetCollection_code_key" ON "DigitalAssetCollection"("code");
CREATE INDEX "DigitalAssetCollection_visibility_idx" ON "DigitalAssetCollection"("visibility");
CREATE INDEX "DigitalAssetCollection_brandScope_idx" ON "DigitalAssetCollection"("brandScope");
CREATE INDEX "DigitalAssetCollection_regionScope_idx" ON "DigitalAssetCollection"("regionScope");
CREATE INDEX "DigitalAssetCollection_dealerGroupType_dealerGroupId_idx" ON "DigitalAssetCollection"("dealerGroupType", "dealerGroupId");
CREATE INDEX "DigitalAssetCollection_isActive_idx" ON "DigitalAssetCollection"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalAssetCollectionItem_collectionId_assetId_key" ON "DigitalAssetCollectionItem"("collectionId", "assetId");
CREATE INDEX "DigitalAssetCollectionItem_assetId_idx" ON "DigitalAssetCollectionItem"("assetId");
CREATE INDEX "DigitalAssetCollectionItem_sortOrder_idx" ON "DigitalAssetCollectionItem"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "DigitalAssetMigrationAlias_sourceSystem_legacyUrl_key" ON "DigitalAssetMigrationAlias"("sourceSystem", "legacyUrl");
CREATE INDEX "DigitalAssetMigrationAlias_assetId_idx" ON "DigitalAssetMigrationAlias"("assetId");
CREATE INDEX "DigitalAssetMigrationAlias_sourceSystem_idx" ON "DigitalAssetMigrationAlias"("sourceSystem");
CREATE INDEX "DigitalAssetMigrationAlias_externalAssetId_idx" ON "DigitalAssetMigrationAlias"("externalAssetId");
CREATE INDEX "DigitalAssetMigrationAlias_redirectStatus_idx" ON "DigitalAssetMigrationAlias"("redirectStatus");

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BaseProduct" ADD CONSTRAINT "BaseProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BaseProduct" ADD CONSTRAINT "BaseProduct_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "ProductFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProductPresentation" ADD CONSTRAINT "ProductPresentation_baseProductId_fkey" FOREIGN KEY ("baseProductId") REFERENCES "BaseProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CatalogInclusion" ADD CONSTRAINT "CatalogInclusion_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "ProductPresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductPublishCheck" ADD CONSTRAINT "ProductPublishCheck_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "ProductPresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetVersion" ADD CONSTRAINT "DigitalAssetVersion_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAssetAssignment" ADD CONSTRAINT "ProductAssetAssignment_presentationId_fkey" FOREIGN KEY ("presentationId") REFERENCES "ProductPresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAssetAssignment" ADD CONSTRAINT "ProductAssetAssignment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProductAssetAssignment" ADD CONSTRAINT "ProductAssetAssignment_assetVersionId_fkey" FOREIGN KEY ("assetVersionId") REFERENCES "DigitalAssetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetCollectionItem" ADD CONSTRAINT "DigitalAssetCollectionItem_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "DigitalAssetCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetCollectionItem" ADD CONSTRAINT "DigitalAssetCollectionItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DigitalAssetMigrationAlias" ADD CONSTRAINT "DigitalAssetMigrationAlias_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
