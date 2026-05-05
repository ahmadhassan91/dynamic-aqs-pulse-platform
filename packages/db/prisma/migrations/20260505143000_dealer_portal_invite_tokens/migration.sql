ALTER TABLE "DealerPortalUser" ADD COLUMN "inviteTokenHash" TEXT;
ALTER TABLE "DealerPortalUser" ADD COLUMN "inviteIssuedAt" TIMESTAMP(3);
ALTER TABLE "DealerPortalUser" ADD COLUMN "inviteExpiresAt" TIMESTAMP(3);
ALTER TABLE "DealerPortalUser" ADD COLUMN "inviteAcceptedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "DealerPortalUser_inviteTokenHash_key" ON "DealerPortalUser"("inviteTokenHash");
CREATE INDEX "DealerPortalUser_inviteExpiresAt_idx" ON "DealerPortalUser"("inviteExpiresAt");
CREATE INDEX "DealerPortalUser_inviteAcceptedAt_idx" ON "DealerPortalUser"("inviteAcceptedAt");
