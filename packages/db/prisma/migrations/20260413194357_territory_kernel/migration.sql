-- CreateEnum
CREATE TYPE "TerritoryAssignmentMethod" AS ENUM ('DEFAULT_STATE', 'MANUAL_OVERRIDE', 'SYSTEM');

-- CreateEnum
CREATE TYPE "TerritoryAssignmentEntityType" AS ENUM ('LEAD', 'ACCOUNT', 'LOCATION');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "assignedRdUserId" UUID,
ADD COLUMN     "assignedTmUserId" UUID,
ADD COLUMN     "shippingCenterId" UUID,
ADD COLUMN     "territoryAssignedAt" TIMESTAMP(3),
ADD COLUMN     "territoryAssignmentMethod" "TerritoryAssignmentMethod",
ADD COLUMN     "territoryId" UUID;

-- CreateTable
CREATE TABLE "ShippingCenter" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShippingCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryPolicy" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "preHandoffTmVisibility" BOOLEAN NOT NULL DEFAULT false,
    "assignNationalTmLeadsByDefault" BOOLEAN NOT NULL DEFAULT true,
    "strategicGrowthRetainsOwnership" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerritoryPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "directorUserId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Territory" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "regionId" UUID NOT NULL,
    "managerUserId" UUID,
    "shippingCenterId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryStateCoverage" (
    "id" UUID NOT NULL,
    "territoryId" UUID NOT NULL,
    "stateCode" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'US',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerritoryStateCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryAssignmentOverride" (
    "id" UUID NOT NULL,
    "entityType" "TerritoryAssignmentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "territoryId" UUID NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonNote" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TerritoryAssignmentOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TerritoryAssignmentHistory" (
    "id" UUID NOT NULL,
    "entityType" "TerritoryAssignmentEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "assignmentMethod" "TerritoryAssignmentMethod" NOT NULL,
    "previousTerritoryId" UUID,
    "previousTerritoryCode" TEXT,
    "nextTerritoryId" UUID,
    "nextTerritoryCode" TEXT,
    "previousShippingCenterId" UUID,
    "nextShippingCenterId" UUID,
    "previousAssignedTmUserId" UUID,
    "nextAssignedTmUserId" UUID,
    "previousAssignedRdUserId" UUID,
    "nextAssignedRdUserId" UUID,
    "changedByUserId" UUID,
    "reasonCode" TEXT,
    "reasonNote" TEXT,
    "metadata" JSONB,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TerritoryAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShippingCenter_code_key" ON "ShippingCenter"("code");

-- CreateIndex
CREATE INDEX "ShippingCenter_isActive_idx" ON "ShippingCenter"("isActive");

-- CreateIndex
CREATE INDEX "ShippingCenter_state_idx" ON "ShippingCenter"("state");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE INDEX "Region_directorUserId_idx" ON "Region"("directorUserId");

-- CreateIndex
CREATE INDEX "Region_isActive_idx" ON "Region"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Territory_code_key" ON "Territory"("code");

-- CreateIndex
CREATE INDEX "Territory_regionId_idx" ON "Territory"("regionId");

-- CreateIndex
CREATE INDEX "Territory_managerUserId_idx" ON "Territory"("managerUserId");

-- CreateIndex
CREATE INDEX "Territory_shippingCenterId_idx" ON "Territory"("shippingCenterId");

-- CreateIndex
CREATE INDEX "Territory_isActive_idx" ON "Territory"("isActive");

-- CreateIndex
CREATE INDEX "TerritoryStateCoverage_territoryId_idx" ON "TerritoryStateCoverage"("territoryId");

-- CreateIndex
CREATE UNIQUE INDEX "TerritoryStateCoverage_countryCode_stateCode_key" ON "TerritoryStateCoverage"("countryCode", "stateCode");

-- CreateIndex
CREATE INDEX "TerritoryAssignmentOverride_territoryId_idx" ON "TerritoryAssignmentOverride"("territoryId");

-- CreateIndex
CREATE INDEX "TerritoryAssignmentOverride_createdByUserId_idx" ON "TerritoryAssignmentOverride"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TerritoryAssignmentOverride_entityType_entityId_key" ON "TerritoryAssignmentOverride"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "TerritoryAssignmentHistory_entityType_entityId_changedAt_idx" ON "TerritoryAssignmentHistory"("entityType", "entityId", "changedAt");

-- CreateIndex
CREATE INDEX "TerritoryAssignmentHistory_changedByUserId_idx" ON "TerritoryAssignmentHistory"("changedByUserId");

-- CreateIndex
CREATE INDEX "Lead_territoryId_idx" ON "Lead"("territoryId");

-- CreateIndex
CREATE INDEX "Lead_shippingCenterId_idx" ON "Lead"("shippingCenterId");

-- CreateIndex
CREATE INDEX "Lead_assignedTmUserId_idx" ON "Lead"("assignedTmUserId");

-- CreateIndex
CREATE INDEX "Lead_assignedRdUserId_idx" ON "Lead"("assignedRdUserId");

-- AddForeignKey
ALTER TABLE "Region" ADD CONSTRAINT "Region_directorUserId_fkey" FOREIGN KEY ("directorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Territory" ADD CONSTRAINT "Territory_shippingCenterId_fkey" FOREIGN KEY ("shippingCenterId") REFERENCES "ShippingCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryStateCoverage" ADD CONSTRAINT "TerritoryStateCoverage_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryAssignmentOverride" ADD CONSTRAINT "TerritoryAssignmentOverride_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryAssignmentOverride" ADD CONSTRAINT "TerritoryAssignmentOverride_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TerritoryAssignmentHistory" ADD CONSTRAINT "TerritoryAssignmentHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_shippingCenterId_fkey" FOREIGN KEY ("shippingCenterId") REFERENCES "ShippingCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedTmUserId_fkey" FOREIGN KEY ("assignedTmUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedRdUserId_fkey" FOREIGN KEY ("assignedRdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
