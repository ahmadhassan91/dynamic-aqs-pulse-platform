CREATE TYPE "DealerPortalAccessRole" AS ENUM ('ADMIN', 'PURCHASING', 'ACCOUNTING', 'VIEWER');

ALTER TABLE "DealerPortalUser" ADD COLUMN "accessRole" "DealerPortalAccessRole" NOT NULL DEFAULT 'ADMIN';

CREATE INDEX "DealerPortalUser_accessRole_idx" ON "DealerPortalUser"("accessRole");
