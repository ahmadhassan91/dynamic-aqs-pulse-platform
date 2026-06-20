-- AlterTable
ALTER TABLE "OrderDraft" ADD COLUMN     "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "OrderDraft_createdByUserId_idempotencyKey_key" ON "OrderDraft"("createdByUserId", "idempotencyKey");
