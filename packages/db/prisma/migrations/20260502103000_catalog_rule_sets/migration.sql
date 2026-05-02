CREATE TYPE "CatalogRuleSetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

CREATE TYPE "CatalogRuleResultAction" AS ENUM ('ASSIGN_CATALOG_VIEW', 'REQUIRE_REVIEW');

CREATE TABLE "CatalogRuleSet" (
  "id" UUID NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "status" "CatalogRuleSetStatus" NOT NULL DEFAULT 'DRAFT',
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "activatedAt" TIMESTAMP(3),
  "activatedByUserId" UUID,
  "retiredAt" TIMESTAMP(3),
  "retiredByUserId" UUID,
  "createdByUserId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogRuleSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CatalogRule" (
  "id" UUID NOT NULL,
  "ruleSetId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "conditions" JSONB NOT NULL,
  "resultAction" "CatalogRuleResultAction" NOT NULL DEFAULT 'ASSIGN_CATALOG_VIEW',
  "dealerCatalogViewId" UUID,
  "requireReviewReason" TEXT,
  "isEnabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CatalogRuleSet_code_key" ON "CatalogRuleSet"("code");
CREATE INDEX "CatalogRuleSet_status_isActive_idx" ON "CatalogRuleSet"("status", "isActive");
CREATE INDEX "CatalogRuleSet_createdAt_idx" ON "CatalogRuleSet"("createdAt");
CREATE INDEX "CatalogRule_ruleSetId_priority_idx" ON "CatalogRule"("ruleSetId", "priority");
CREATE INDEX "CatalogRule_dealerCatalogViewId_idx" ON "CatalogRule"("dealerCatalogViewId");
CREATE INDEX "CatalogRule_isEnabled_idx" ON "CatalogRule"("isEnabled");

ALTER TABLE "CatalogRule"
  ADD CONSTRAINT "CatalogRule_ruleSetId_fkey"
  FOREIGN KEY ("ruleSetId") REFERENCES "CatalogRuleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CatalogRule"
  ADD CONSTRAINT "CatalogRule_dealerCatalogViewId_fkey"
  FOREIGN KEY ("dealerCatalogViewId") REFERENCES "DealerCatalogView"("id") ON DELETE SET NULL ON UPDATE CASCADE;
