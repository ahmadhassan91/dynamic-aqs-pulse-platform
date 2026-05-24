CREATE TYPE "ConsignmentAuditEvidencePurpose" AS ENUM ('GENERAL', 'DISCREPANCY');

CREATE TABLE "ConsignmentAuditEvidence" (
    "id" UUID NOT NULL,
    "auditId" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "purpose" "ConsignmentAuditEvidencePurpose" NOT NULL DEFAULT 'GENERAL',
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT,
    "notes" TEXT,
    "uploadedByUserId" UUID,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsignmentAuditEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ConsignmentAuditEvidence_auditId_idx" ON "ConsignmentAuditEvidence"("auditId");
CREATE INDEX "ConsignmentAuditEvidence_siteId_idx" ON "ConsignmentAuditEvidence"("siteId");
CREATE INDEX "ConsignmentAuditEvidence_purpose_idx" ON "ConsignmentAuditEvidence"("purpose");
CREATE INDEX "ConsignmentAuditEvidence_uploadedByUserId_idx" ON "ConsignmentAuditEvidence"("uploadedByUserId");

ALTER TABLE "ConsignmentAuditEvidence" ADD CONSTRAINT "ConsignmentAuditEvidence_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "ConsignmentAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsignmentAuditEvidence" ADD CONSTRAINT "ConsignmentAuditEvidence_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConsignmentSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsignmentAuditEvidence" ADD CONSTRAINT "ConsignmentAuditEvidence_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
