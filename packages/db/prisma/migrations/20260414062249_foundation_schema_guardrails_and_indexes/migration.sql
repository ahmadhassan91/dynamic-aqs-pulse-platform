-- CreateIndex
CREATE INDEX "AuditEntry_entityType_createdAt_idx" ON "AuditEntry"("entityType", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_territoryId_lifecycleStatus_createdAt_idx" ON "Lead"("territoryId", "lifecycleStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_assignedTmUserId_lifecycleStatus_createdAt_idx" ON "Lead"("assignedTmUserId", "lifecycleStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_leadCaptureMethod_lifecycleStatus_createdAt_idx" ON "Lead"("leadCaptureMethod", "lifecycleStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_lifecycleStatus_stage_updatedAt_createdAt_idx" ON "Lead"("lifecycleStatus", "stage", "updatedAt", "createdAt");

-- CreateIndex
CREATE INDEX "OnboardingChecklistItem_ownerUserId_status_dueAt_idx" ON "OnboardingChecklistItem"("ownerUserId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "TrainingSession_accountId_status_scheduledAt_idx" ON "TrainingSession"("accountId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "WebsiteLeadSubmission_websiteLeadSiteId_reviewStatus_create_idx" ON "WebsiteLeadSubmission"("websiteLeadSiteId", "reviewStatus", "createdAt");
