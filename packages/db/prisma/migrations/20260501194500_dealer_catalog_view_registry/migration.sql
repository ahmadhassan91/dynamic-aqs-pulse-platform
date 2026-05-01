-- CreateEnum
CREATE TYPE "DealerCatalogViewKind" AS ENUM ('STANDARD', 'AFFINITY', 'OWNERSHIP', 'INDEPENDENT', 'REGION', 'BRAND', 'PRIVATE_LABEL', 'ACCOUNT_OVERRIDE');

-- CreateTable
CREATE TABLE "DealerCatalogView" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "DealerCatalogViewKind" NOT NULL,
    "resolverKey" TEXT,
    "resolverLabel" TEXT,
    "regionScope" TEXT,
    "brandLabel" TEXT,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "precedence" INTEGER NOT NULL DEFAULT 100,
    "sourceSystem" "ProductSourceSystem" NOT NULL DEFAULT 'PULSE',
    "sourceOfTruthSystem" "ProductSourceSystem" NOT NULL DEFAULT 'PULSE',
    "provenance" JSONB,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerCatalogView_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CatalogInclusion" ADD COLUMN "dealerCatalogViewId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "DealerCatalogView_code_key" ON "DealerCatalogView"("code");

-- CreateIndex
CREATE INDEX "DealerCatalogView_kind_isActive_idx" ON "DealerCatalogView"("kind", "isActive");

-- CreateIndex
CREATE INDEX "DealerCatalogView_resolverKey_idx" ON "DealerCatalogView"("resolverKey");

-- CreateIndex
CREATE INDEX "DealerCatalogView_regionScope_idx" ON "DealerCatalogView"("regionScope");

-- CreateIndex
CREATE INDEX "DealerCatalogView_brandLabel_idx" ON "DealerCatalogView"("brandLabel");

-- CreateIndex
CREATE INDEX "DealerCatalogView_isDefault_idx" ON "DealerCatalogView"("isDefault");

-- CreateIndex
CREATE INDEX "DealerCatalogView_precedence_idx" ON "DealerCatalogView"("precedence");

-- CreateIndex
CREATE INDEX "CatalogInclusion_dealerCatalogViewId_idx" ON "CatalogInclusion"("dealerCatalogViewId");

-- AddForeignKey
ALTER TABLE "CatalogInclusion" ADD CONSTRAINT "CatalogInclusion_dealerCatalogViewId_fkey" FOREIGN KEY ("dealerCatalogViewId") REFERENCES "DealerCatalogView"("id") ON DELETE SET NULL ON UPDATE CASCADE;

