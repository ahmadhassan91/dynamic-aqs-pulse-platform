-- CreateEnum
CREATE TYPE "CisPackageStatus" AS ENUM ('NOT_SENT', 'LINK_SENT', 'DRAFT_IN_PROGRESS', 'SUBMITTED', 'REVIEW_IN_PROGRESS', 'SALES_SIGNED_OFF', 'FINANCE_PENDING', 'FINANCE_APPROVED', 'FINANCE_DECLINED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "CisEntryMethod" AS ENUM ('DIGITAL_LINK', 'SCANNED_PDF');

-- CreateEnum
CREATE TYPE "CisPaymentStatus" AS ENUM ('NOT_STARTED', 'VAULT_PENDING', 'VAULT_COMPLETE', 'NOT_REQUIRED');

-- CreateEnum
CREATE TYPE "CisEsignStatus" AS ENUM ('NOT_STARTED', 'SIGNED', 'VENDOR_PENDING');

-- CreateEnum
CREATE TYPE "CisPaymentMethod" AS ENUM ('NET_30', 'ACH', 'CREDIT_CARD');

-- CreateEnum
CREATE TYPE "CisDocumentType" AS ENUM ('SCANNED_CIS_PDF', 'RESALE_CERTIFICATE', 'SUPPORTING_ATTACHMENT');

-- CreateEnum
CREATE TYPE "CisParseStatus" AS ENUM ('QUEUED', 'PARSED', 'NEEDS_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "CisPaymentVaultProvider" AS ENUM ('EBIZCHARGE', 'MONERIS', 'UNKNOWN');

-- CreateTable
CREATE TABLE "CisPackage" (
    "id" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "status" "CisPackageStatus" NOT NULL DEFAULT 'NOT_SENT',
    "entryMethod" "CisEntryMethod" NOT NULL,
    "externalLinkTokenHash" TEXT,
    "externalLinkExpiresAt" TIMESTAMP(3),
    "externalLinkLastSentAt" TIMESTAMP(3),
    "externalLinkSentCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "reviewStartedAt" TIMESTAMP(3),
    "salesSignedOffAt" TIMESTAMP(3),
    "financeSubmittedAt" TIMESTAMP(3),
    "financeDecidedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "paymentStatus" "CisPaymentStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "esignStatus" "CisEsignStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CisPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CisFormData" (
    "id" UUID NOT NULL,
    "cisPackageId" UUID NOT NULL,
    "companyWebsite" TEXT,
    "numOfTechs" INTEGER,
    "numOfInstallTechs" INTEGER,
    "numOfSalespeopleAdvisors" INTEGER,
    "affinityGroupOrFranchise" TEXT,
    "isPrivateEquity" BOOLEAN NOT NULL DEFAULT false,
    "parentCompanyName" TEXT,
    "primaryContactName" TEXT,
    "primaryContactTitle" TEXT,
    "primaryContactEmail" TEXT,
    "primaryContactCellPhone" TEXT,
    "ownerManagerName" TEXT,
    "ownerManagerTitle" TEXT,
    "ownerManagerEmail" TEXT,
    "ownerManagerCellPhone" TEXT,
    "legalCompanyName" TEXT,
    "physicalAddress" TEXT,
    "physicalCity" TEXT,
    "physicalState" TEXT,
    "physicalZip" TEXT,
    "physicalCountryCode" TEXT DEFAULT 'US',
    "billingAddress" TEXT,
    "billingCity" TEXT,
    "billingState" TEXT,
    "billingZip" TEXT,
    "billingCountryCode" TEXT DEFAULT 'US',
    "companyPhone" TEXT,
    "typeOfBusiness" TEXT,
    "yearsInBusiness" INTEGER,
    "monthsInBusiness" INTEGER,
    "orderingContactName" TEXT,
    "orderingContactCellPhone" TEXT,
    "orderingContactEmail" TEXT,
    "apContactName" TEXT,
    "apDirectPhone" TEXT,
    "apEmail" TEXT,
    "paymentMethod" "CisPaymentMethod",
    "achAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "cardOnFileAuthorized" BOOLEAN NOT NULL DEFAULT false,
    "resaleCertificateAttached" BOOLEAN NOT NULL DEFAULT false,
    "signatureCapturedAt" TIMESTAMP(3),
    "submittedByProspectAt" TIMESTAMP(3),
    "lastSavedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CisFormData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CisPackageEvent" (
    "id" UUID NOT NULL,
    "cisPackageId" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" "CisPackageStatus",
    "toStatus" "CisPackageStatus",
    "actorUserId" UUID,
    "actorType" TEXT NOT NULL,
    "note" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CisPackageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CisDocument" (
    "id" UUID NOT NULL,
    "cisPackageId" UUID NOT NULL,
    "documentType" "CisDocumentType" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedByUserId" UUID,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sha256" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CisDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CisParsedDraft" (
    "id" UUID NOT NULL,
    "cisPackageId" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "parseStatus" "CisParseStatus" NOT NULL DEFAULT 'QUEUED',
    "rawExtractionText" TEXT,
    "rawStructuredPayload" JSONB,
    "fieldConfidenceMap" JSONB,
    "safeFieldPayload" JSONB,
    "paymentFieldsDetected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CisParsedDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CisPaymentVaultReference" (
    "id" UUID NOT NULL,
    "cisPackageId" UUID NOT NULL,
    "provider" "CisPaymentVaultProvider" NOT NULL DEFAULT 'UNKNOWN',
    "vaultToken" TEXT,
    "vaultCustomerRef" TEXT,
    "last4" TEXT,
    "brand" TEXT,
    "authorizationCapturedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CisPaymentVaultReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CisPackage_externalLinkTokenHash_key" ON "CisPackage"("externalLinkTokenHash");

-- CreateIndex
CREATE INDEX "CisPackage_leadId_createdAt_idx" ON "CisPackage"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "CisPackage_status_idx" ON "CisPackage"("status");

-- CreateIndex
CREATE INDEX "CisPackage_entryMethod_idx" ON "CisPackage"("entryMethod");

-- CreateIndex
CREATE UNIQUE INDEX "CisFormData_cisPackageId_key" ON "CisFormData"("cisPackageId");

-- CreateIndex
CREATE INDEX "CisFormData_paymentMethod_idx" ON "CisFormData"("paymentMethod");

-- CreateIndex
CREATE INDEX "CisFormData_submittedByProspectAt_idx" ON "CisFormData"("submittedByProspectAt");

-- CreateIndex
CREATE INDEX "CisPackageEvent_cisPackageId_occurredAt_idx" ON "CisPackageEvent"("cisPackageId", "occurredAt");

-- CreateIndex
CREATE INDEX "CisPackageEvent_eventType_idx" ON "CisPackageEvent"("eventType");

-- CreateIndex
CREATE INDEX "CisDocument_cisPackageId_documentType_idx" ON "CisDocument"("cisPackageId", "documentType");

-- CreateIndex
CREATE INDEX "CisParsedDraft_cisPackageId_createdAt_idx" ON "CisParsedDraft"("cisPackageId", "createdAt");

-- CreateIndex
CREATE INDEX "CisParsedDraft_documentId_idx" ON "CisParsedDraft"("documentId");

-- CreateIndex
CREATE INDEX "CisParsedDraft_parseStatus_idx" ON "CisParsedDraft"("parseStatus");

-- CreateIndex
CREATE INDEX "CisPaymentVaultReference_cisPackageId_createdAt_idx" ON "CisPaymentVaultReference"("cisPackageId", "createdAt");

-- CreateIndex
CREATE INDEX "CisPaymentVaultReference_provider_idx" ON "CisPaymentVaultReference"("provider");

-- AddForeignKey
ALTER TABLE "CisPackage" ADD CONSTRAINT "CisPackage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisFormData" ADD CONSTRAINT "CisFormData_cisPackageId_fkey" FOREIGN KEY ("cisPackageId") REFERENCES "CisPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisPackageEvent" ADD CONSTRAINT "CisPackageEvent_cisPackageId_fkey" FOREIGN KEY ("cisPackageId") REFERENCES "CisPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisDocument" ADD CONSTRAINT "CisDocument_cisPackageId_fkey" FOREIGN KEY ("cisPackageId") REFERENCES "CisPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisParsedDraft" ADD CONSTRAINT "CisParsedDraft_cisPackageId_fkey" FOREIGN KEY ("cisPackageId") REFERENCES "CisPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisParsedDraft" ADD CONSTRAINT "CisParsedDraft_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "CisDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisPaymentVaultReference" ADD CONSTRAINT "CisPaymentVaultReference_cisPackageId_fkey" FOREIGN KEY ("cisPackageId") REFERENCES "CisPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
