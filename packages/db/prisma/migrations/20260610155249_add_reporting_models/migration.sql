-- CreateEnum
CREATE TYPE "ReportVisibility" AS ENUM ('PRIVATE', 'TEAM', 'ORG');

-- CreateEnum
CREATE TYPE "ReportScheduleCadence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ReportDeliveryStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "ReportDefinition" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "reportKey" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "visibility" "ReportVisibility" NOT NULL DEFAULT 'PRIVATE',
    "ownerUserId" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSchedule" (
    "id" UUID NOT NULL,
    "reportDefinitionId" UUID NOT NULL,
    "cadence" "ReportScheduleCadence" NOT NULL,
    "hourUtc" INTEGER NOT NULL,
    "recipients" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportDeliveryRecord" (
    "id" UUID NOT NULL,
    "scheduleId" UUID NOT NULL,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "ReportDeliveryStatus" NOT NULL,
    "detail" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReportDeliveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReportDefinition_ownerUserId_idx" ON "ReportDefinition"("ownerUserId");

-- CreateIndex
CREATE INDEX "ReportDefinition_reportKey_idx" ON "ReportDefinition"("reportKey");

-- CreateIndex
CREATE INDEX "ReportDefinition_visibility_idx" ON "ReportDefinition"("visibility");

-- CreateIndex
CREATE INDEX "ReportDefinition_isActive_idx" ON "ReportDefinition"("isActive");

-- CreateIndex
CREATE INDEX "ReportSchedule_reportDefinitionId_idx" ON "ReportSchedule"("reportDefinitionId");

-- CreateIndex
CREATE INDEX "ReportSchedule_isActive_nextRunAt_idx" ON "ReportSchedule"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "ReportDeliveryRecord_scheduleId_idx" ON "ReportDeliveryRecord"("scheduleId");

-- CreateIndex
CREATE INDEX "ReportDeliveryRecord_runAt_idx" ON "ReportDeliveryRecord"("runAt");

-- AddForeignKey
ALTER TABLE "ReportDefinition" ADD CONSTRAINT "ReportDefinition_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSchedule" ADD CONSTRAINT "ReportSchedule_reportDefinitionId_fkey" FOREIGN KEY ("reportDefinitionId") REFERENCES "ReportDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportDeliveryRecord" ADD CONSTRAINT "ReportDeliveryRecord_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ReportSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
