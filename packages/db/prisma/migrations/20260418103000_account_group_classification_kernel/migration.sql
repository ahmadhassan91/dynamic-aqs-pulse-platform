-- CreateEnum
CREATE TYPE "GroupAxisSelection" AS ENUM ('UNKNOWN', 'NONE', 'GROUP');

-- CreateEnum
CREATE TYPE "GroupClassification" AS ENUM ('INDEPENDENT', 'AFFINITY_ONLY', 'OWNERSHIP_ONLY', 'HYBRID');

-- CreateEnum
CREATE TYPE "AffinityGroupType" AS ENUM ('BUYING_GROUP', 'COACHING_NETWORK', 'FRANCHISE', 'COMMUNITY', 'OTHER');

-- CreateEnum
CREATE TYPE "OwnershipGroupType" AS ENUM ('PRIVATE_EQUITY', 'COMMON_OWNER', 'FRANCHISE_SYSTEM', 'OTHER');

-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "affinityGroupId" UUID,
ADD COLUMN     "affinityGroupSelection" "GroupAxisSelection" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "groupClassification" "GroupClassification",
ADD COLUMN     "ownershipGroupId" UUID,
ADD COLUMN     "ownershipGroupSelection" "GroupAxisSelection" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "CisFormData" ADD COLUMN     "affinityGroupId" UUID,
ADD COLUMN     "affinityGroupSelection" "GroupAxisSelection" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "ownershipGroupId" UUID,
ADD COLUMN     "ownershipGroupSelection" "GroupAxisSelection" NOT NULL DEFAULT 'UNKNOWN';

-- AlterTable
ALTER TABLE "Lead" DROP COLUMN "affinityGroupName",
DROP COLUMN "ownershipGroupName",
ADD COLUMN     "affinityGroupId" UUID,
ADD COLUMN     "affinityGroupSelection" "GroupAxisSelection" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN     "groupClassification" "GroupClassification",
ADD COLUMN     "ownershipGroupId" UUID,
ADD COLUMN     "ownershipGroupSelection" "GroupAxisSelection" NOT NULL DEFAULT 'UNKNOWN';

-- CreateTable
CREATE TABLE "AffinityGroupRef" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "groupType" "AffinityGroupType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AffinityGroupRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnershipGroupRef" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "description" TEXT,
    "ownershipType" "OwnershipGroupType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnershipGroupRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AffinityGroupRef_code_key" ON "AffinityGroupRef"("code");

-- CreateIndex
CREATE INDEX "AffinityGroupRef_isActive_idx" ON "AffinityGroupRef"("isActive");

-- CreateIndex
CREATE INDEX "AffinityGroupRef_groupType_idx" ON "AffinityGroupRef"("groupType");

-- CreateIndex
CREATE INDEX "AffinityGroupRef_sortOrder_idx" ON "AffinityGroupRef"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "OwnershipGroupRef_code_key" ON "OwnershipGroupRef"("code");

-- CreateIndex
CREATE INDEX "OwnershipGroupRef_isActive_idx" ON "OwnershipGroupRef"("isActive");

-- CreateIndex
CREATE INDEX "OwnershipGroupRef_ownershipType_idx" ON "OwnershipGroupRef"("ownershipType");

-- CreateIndex
CREATE INDEX "OwnershipGroupRef_sortOrder_idx" ON "OwnershipGroupRef"("sortOrder");

-- CreateIndex
CREATE INDEX "Account_affinityGroupId_idx" ON "Account"("affinityGroupId");

-- CreateIndex
CREATE INDEX "Account_ownershipGroupId_idx" ON "Account"("ownershipGroupId");

-- CreateIndex
CREATE INDEX "Account_groupClassification_idx" ON "Account"("groupClassification");

-- CreateIndex
CREATE INDEX "CisFormData_affinityGroupId_idx" ON "CisFormData"("affinityGroupId");

-- CreateIndex
CREATE INDEX "CisFormData_ownershipGroupId_idx" ON "CisFormData"("ownershipGroupId");

-- CreateIndex
CREATE INDEX "Lead_affinityGroupId_idx" ON "Lead"("affinityGroupId");

-- CreateIndex
CREATE INDEX "Lead_ownershipGroupId_idx" ON "Lead"("ownershipGroupId");

-- CreateIndex
CREATE INDEX "Lead_groupClassification_idx" ON "Lead"("groupClassification");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_affinityGroupId_fkey" FOREIGN KEY ("affinityGroupId") REFERENCES "AffinityGroupRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownershipGroupId_fkey" FOREIGN KEY ("ownershipGroupId") REFERENCES "OwnershipGroupRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisFormData" ADD CONSTRAINT "CisFormData_affinityGroupId_fkey" FOREIGN KEY ("affinityGroupId") REFERENCES "AffinityGroupRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisFormData" ADD CONSTRAINT "CisFormData_ownershipGroupId_fkey" FOREIGN KEY ("ownershipGroupId") REFERENCES "OwnershipGroupRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_affinityGroupId_fkey" FOREIGN KEY ("affinityGroupId") REFERENCES "AffinityGroupRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_ownershipGroupId_fkey" FOREIGN KEY ("ownershipGroupId") REFERENCES "OwnershipGroupRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

