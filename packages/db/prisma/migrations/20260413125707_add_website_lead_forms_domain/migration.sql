-- CreateEnum
CREATE TYPE "WebsiteLeadFormType" AS ENUM ('HOMEOWNER', 'CONTRACTOR', 'BOTH');

-- CreateEnum
CREATE TYPE "WebsiteLeadType" AS ENUM ('HOMEOWNER', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "WebsiteLeadSubmissionOutcome" AS ENUM ('CREATED_NEW_LEAD', 'ATTACHED_TO_EXISTING_LEAD');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "leadType" "WebsiteLeadType";

-- CreateTable
CREATE TABLE "WebsiteLeadSite" (
    "id" UUID NOT NULL,
    "siteId" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "brandTag" TEXT NOT NULL,
    "formType" "WebsiteLeadFormType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteLeadSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteLeadNotificationRecipient" (
    "id" UUID NOT NULL,
    "websiteLeadSiteId" UUID,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "roleTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteLeadNotificationRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteLeadSubmission" (
    "id" UUID NOT NULL,
    "websiteLeadSiteId" UUID,
    "linkedLeadId" UUID,
    "leadType" "WebsiteLeadType" NOT NULL,
    "outcome" "WebsiteLeadSubmissionOutcome" NOT NULL DEFAULT 'CREATED_NEW_LEAD',
    "contactDisplayName" TEXT NOT NULL,
    "contactFirstName" TEXT,
    "contactLastName" TEXT,
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "state" TEXT,
    "countryCode" TEXT,
    "serviceTechCount" INTEGER,
    "installTechCount" INTEGER,
    "truckCount" INTEGER,
    "salesPersonCount" INTEGER,
    "inquiryTopic" TEXT,
    "referralSource" TEXT,
    "referralDetail" TEXT,
    "message" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteLeadSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteLeadSite_siteId_key" ON "WebsiteLeadSite"("siteId");

-- CreateIndex
CREATE INDEX "WebsiteLeadSite_isActive_idx" ON "WebsiteLeadSite"("isActive");

-- CreateIndex
CREATE INDEX "WebsiteLeadSite_formType_idx" ON "WebsiteLeadSite"("formType");

-- CreateIndex
CREATE INDEX "WebsiteLeadSite_brandTag_idx" ON "WebsiteLeadSite"("brandTag");

-- CreateIndex
CREATE INDEX "WebsiteLeadNotificationRecipient_websiteLeadSiteId_idx" ON "WebsiteLeadNotificationRecipient"("websiteLeadSiteId");

-- CreateIndex
CREATE INDEX "WebsiteLeadNotificationRecipient_email_idx" ON "WebsiteLeadNotificationRecipient"("email");

-- CreateIndex
CREATE INDEX "WebsiteLeadNotificationRecipient_isActive_idx" ON "WebsiteLeadNotificationRecipient"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteLeadNotificationRecipient_websiteLeadSiteId_email_key" ON "WebsiteLeadNotificationRecipient"("websiteLeadSiteId", "email");

-- CreateIndex
CREATE INDEX "WebsiteLeadSubmission_websiteLeadSiteId_createdAt_idx" ON "WebsiteLeadSubmission"("websiteLeadSiteId", "createdAt");

-- CreateIndex
CREATE INDEX "WebsiteLeadSubmission_linkedLeadId_idx" ON "WebsiteLeadSubmission"("linkedLeadId");

-- CreateIndex
CREATE INDEX "WebsiteLeadSubmission_leadType_idx" ON "WebsiteLeadSubmission"("leadType");

-- CreateIndex
CREATE INDEX "WebsiteLeadSubmission_outcome_idx" ON "WebsiteLeadSubmission"("outcome");

-- CreateIndex
CREATE INDEX "WebsiteLeadSubmission_email_idx" ON "WebsiteLeadSubmission"("email");

-- CreateIndex
CREATE INDEX "Lead_leadType_idx" ON "Lead"("leadType");

-- AddForeignKey
ALTER TABLE "WebsiteLeadNotificationRecipient" ADD CONSTRAINT "WebsiteLeadNotificationRecipient_websiteLeadSiteId_fkey" FOREIGN KEY ("websiteLeadSiteId") REFERENCES "WebsiteLeadSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteLeadSubmission" ADD CONSTRAINT "WebsiteLeadSubmission_websiteLeadSiteId_fkey" FOREIGN KEY ("websiteLeadSiteId") REFERENCES "WebsiteLeadSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteLeadSubmission" ADD CONSTRAINT "WebsiteLeadSubmission_linkedLeadId_fkey" FOREIGN KEY ("linkedLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
