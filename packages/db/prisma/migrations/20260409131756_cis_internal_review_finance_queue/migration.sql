-- CreateEnum
CREATE TYPE "CisFinanceDecisionStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'INFO_REQUESTED', 'APPROVED', 'CONDITIONAL', 'DECLINED');

-- CreateEnum
CREATE TYPE "CisPaymentTerms" AS ENUM ('NET_30', 'NET_60', 'COD', 'CUSTOM');

-- CreateTable
CREATE TABLE "CisInternalReview" (
    "id" UUID NOT NULL,
    "cisPackageId" UUID NOT NULL,
    "reviewStartedByUserId" UUID,
    "salesReviewNotes" TEXT,
    "salesSignedOffByUserId" UUID,
    "salesSignedOffAt" TIMESTAMP(3),
    "financeCoverNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CisInternalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CisFinanceDecision" (
    "id" UUID NOT NULL,
    "cisPackageId" UUID NOT NULL,
    "status" "CisFinanceDecisionStatus" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "submittedByUserId" UUID,
    "submittedAt" TIMESTAMP(3),
    "creditLineAmountCents" INTEGER,
    "paymentTerms" "CisPaymentTerms",
    "submissionNotes" TEXT,
    "requestedInfoNotes" TEXT,
    "decisionNotes" TEXT,
    "decidedByUserId" UUID,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CisFinanceDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CisInternalReview_cisPackageId_key" ON "CisInternalReview"("cisPackageId");

-- CreateIndex
CREATE INDEX "CisInternalReview_reviewStartedByUserId_idx" ON "CisInternalReview"("reviewStartedByUserId");

-- CreateIndex
CREATE INDEX "CisInternalReview_salesSignedOffByUserId_idx" ON "CisInternalReview"("salesSignedOffByUserId");

-- CreateIndex
CREATE INDEX "CisInternalReview_salesSignedOffAt_idx" ON "CisInternalReview"("salesSignedOffAt");

-- CreateIndex
CREATE UNIQUE INDEX "CisFinanceDecision_cisPackageId_key" ON "CisFinanceDecision"("cisPackageId");

-- CreateIndex
CREATE INDEX "CisFinanceDecision_status_idx" ON "CisFinanceDecision"("status");

-- CreateIndex
CREATE INDEX "CisFinanceDecision_submittedByUserId_idx" ON "CisFinanceDecision"("submittedByUserId");

-- CreateIndex
CREATE INDEX "CisFinanceDecision_decidedByUserId_idx" ON "CisFinanceDecision"("decidedByUserId");

-- CreateIndex
CREATE INDEX "CisFinanceDecision_submittedAt_idx" ON "CisFinanceDecision"("submittedAt");

-- CreateIndex
CREATE INDEX "CisFinanceDecision_decidedAt_idx" ON "CisFinanceDecision"("decidedAt");

-- AddForeignKey
ALTER TABLE "CisInternalReview" ADD CONSTRAINT "CisInternalReview_cisPackageId_fkey" FOREIGN KEY ("cisPackageId") REFERENCES "CisPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisInternalReview" ADD CONSTRAINT "CisInternalReview_reviewStartedByUserId_fkey" FOREIGN KEY ("reviewStartedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisInternalReview" ADD CONSTRAINT "CisInternalReview_salesSignedOffByUserId_fkey" FOREIGN KEY ("salesSignedOffByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisFinanceDecision" ADD CONSTRAINT "CisFinanceDecision_cisPackageId_fkey" FOREIGN KEY ("cisPackageId") REFERENCES "CisPackage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisFinanceDecision" ADD CONSTRAINT "CisFinanceDecision_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CisFinanceDecision" ADD CONSTRAINT "CisFinanceDecision_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
