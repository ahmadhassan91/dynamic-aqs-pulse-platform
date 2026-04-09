-- CreateTable
CREATE TABLE "LeadSourceRef" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadSourceRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadSourceRef_code_key" ON "LeadSourceRef"("code");

-- CreateIndex
CREATE INDEX "LeadSourceRef_isActive_idx" ON "LeadSourceRef"("isActive");

-- CreateIndex
CREATE INDEX "LeadSourceRef_sortOrder_idx" ON "LeadSourceRef"("sortOrder");
