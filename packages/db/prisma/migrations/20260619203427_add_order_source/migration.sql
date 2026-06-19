-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('INTERNAL_ON_BEHALF', 'DEALER_SELF_SERVICE');

-- AlterTable
ALTER TABLE "OrderDraft" ADD COLUMN     "source" "OrderSource" NOT NULL DEFAULT 'INTERNAL_ON_BEHALF';

-- CreateIndex
CREATE INDEX "OrderDraft_source_idx" ON "OrderDraft"("source");
