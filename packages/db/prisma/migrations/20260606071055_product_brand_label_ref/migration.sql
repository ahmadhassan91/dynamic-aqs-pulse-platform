-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "brandLabelId" UUID;

-- CreateTable
CREATE TABLE "BrandLabelRef" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandLabelRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandLabelRef_code_key" ON "BrandLabelRef"("code");

-- CreateIndex
CREATE INDEX "BrandLabelRef_isActive_idx" ON "BrandLabelRef"("isActive");

-- CreateIndex
CREATE INDEX "BrandLabelRef_sortOrder_idx" ON "BrandLabelRef"("sortOrder");

-- CreateIndex
CREATE INDEX "Account_brandLabelId_idx" ON "Account"("brandLabelId");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_brandLabelId_fkey" FOREIGN KEY ("brandLabelId") REFERENCES "BrandLabelRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;
