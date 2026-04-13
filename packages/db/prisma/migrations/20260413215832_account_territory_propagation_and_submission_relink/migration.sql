-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "assignedRdUserId" UUID,
ADD COLUMN     "assignedTmUserId" UUID,
ADD COLUMN     "shippingCenterId" UUID,
ADD COLUMN     "territoryAssignedAt" TIMESTAMP(3),
ADD COLUMN     "territoryAssignmentMethod" "TerritoryAssignmentMethod",
ADD COLUMN     "territoryId" UUID;

-- CreateIndex
CREATE INDEX "Account_territoryId_idx" ON "Account"("territoryId");

-- CreateIndex
CREATE INDEX "Account_shippingCenterId_idx" ON "Account"("shippingCenterId");

-- CreateIndex
CREATE INDEX "Account_assignedTmUserId_idx" ON "Account"("assignedTmUserId");

-- CreateIndex
CREATE INDEX "Account_assignedRdUserId_idx" ON "Account"("assignedRdUserId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_shippingCenterId_fkey" FOREIGN KEY ("shippingCenterId") REFERENCES "ShippingCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_assignedTmUserId_fkey" FOREIGN KEY ("assignedTmUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_assignedRdUserId_fkey" FOREIGN KEY ("assignedRdUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
