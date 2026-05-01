CREATE TABLE "DigitalAssetShareLink" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "assetVersionId" UUID,
    "tokenHash" TEXT NOT NULL,
    "shareUrl" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL DEFAULT 'prospect',
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "contextType" TEXT,
    "contextId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalAssetShareLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DigitalAssetShareLink_tokenHash_key" ON "DigitalAssetShareLink"("tokenHash");
CREATE INDEX "DigitalAssetShareLink_assetId_idx" ON "DigitalAssetShareLink"("assetId");
CREATE INDEX "DigitalAssetShareLink_assetVersionId_idx" ON "DigitalAssetShareLink"("assetVersionId");
CREATE INDEX "DigitalAssetShareLink_recipientType_idx" ON "DigitalAssetShareLink"("recipientType");
CREATE INDEX "DigitalAssetShareLink_recipientEmail_idx" ON "DigitalAssetShareLink"("recipientEmail");
CREATE INDEX "DigitalAssetShareLink_contextType_contextId_idx" ON "DigitalAssetShareLink"("contextType", "contextId");
CREATE INDEX "DigitalAssetShareLink_expiresAt_idx" ON "DigitalAssetShareLink"("expiresAt");
CREATE INDEX "DigitalAssetShareLink_revokedAt_idx" ON "DigitalAssetShareLink"("revokedAt");
CREATE INDEX "DigitalAssetShareLink_createdByUserId_idx" ON "DigitalAssetShareLink"("createdByUserId");

ALTER TABLE "DigitalAssetShareLink"
ADD CONSTRAINT "DigitalAssetShareLink_assetId_fkey"
FOREIGN KEY ("assetId") REFERENCES "DigitalAsset"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DigitalAssetShareLink"
ADD CONSTRAINT "DigitalAssetShareLink_assetVersionId_fkey"
FOREIGN KEY ("assetVersionId") REFERENCES "DigitalAssetVersion"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
