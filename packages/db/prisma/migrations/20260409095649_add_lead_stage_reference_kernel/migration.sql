-- CreateTable
CREATE TABLE "LeadStageRef" (
    "id" UUID NOT NULL,
    "stage" "LeadStage" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dashboardLabel" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadStageRef_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadStageRef_stage_key" ON "LeadStageRef"("stage");

-- CreateIndex
CREATE UNIQUE INDEX "LeadStageRef_code_key" ON "LeadStageRef"("code");

-- CreateIndex
CREATE INDEX "LeadStageRef_isActive_idx" ON "LeadStageRef"("isActive");

-- CreateIndex
CREATE INDEX "LeadStageRef_sortOrder_idx" ON "LeadStageRef"("sortOrder");
