CREATE TABLE "DealerPortalFavoriteProduct" (
  "id" UUID NOT NULL,
  "dealerPortalUserId" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "productPresentationId" UUID NOT NULL,
  "baseProductId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DealerPortalFavoriteProduct_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DealerPortalFavoriteProduct_user_presentation_key"
  ON "DealerPortalFavoriteProduct"("dealerPortalUserId", "productPresentationId");
CREATE INDEX "DealerPortalFavoriteProduct_accountId_idx" ON "DealerPortalFavoriteProduct"("accountId");
CREATE INDEX "DealerPortalFavoriteProduct_userId_idx" ON "DealerPortalFavoriteProduct"("userId");
CREATE INDEX "DealerPortalFavoriteProduct_productPresentationId_idx" ON "DealerPortalFavoriteProduct"("productPresentationId");
CREATE INDEX "DealerPortalFavoriteProduct_baseProductId_idx" ON "DealerPortalFavoriteProduct"("baseProductId");
CREATE INDEX "DealerPortalFavoriteProduct_createdAt_idx" ON "DealerPortalFavoriteProduct"("createdAt");

ALTER TABLE "DealerPortalFavoriteProduct"
  ADD CONSTRAINT "DealerPortalFavoriteProduct_dealerPortalUserId_fkey"
  FOREIGN KEY ("dealerPortalUserId") REFERENCES "DealerPortalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealerPortalFavoriteProduct"
  ADD CONSTRAINT "DealerPortalFavoriteProduct_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealerPortalFavoriteProduct"
  ADD CONSTRAINT "DealerPortalFavoriteProduct_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealerPortalFavoriteProduct"
  ADD CONSTRAINT "DealerPortalFavoriteProduct_productPresentationId_fkey"
  FOREIGN KEY ("productPresentationId") REFERENCES "ProductPresentation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealerPortalFavoriteProduct"
  ADD CONSTRAINT "DealerPortalFavoriteProduct_baseProductId_fkey"
  FOREIGN KEY ("baseProductId") REFERENCES "BaseProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
