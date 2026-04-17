ALTER TABLE "CisPaymentVaultReference"
ADD COLUMN "sourceCaptureAttemptId" UUID;

CREATE INDEX "CisPaymentVaultReference_sourceCaptureAttemptId_idx"
ON "CisPaymentVaultReference"("sourceCaptureAttemptId");

ALTER TABLE "CisPaymentVaultReference"
ADD CONSTRAINT "CisPaymentVaultReference_sourceCaptureAttemptId_fkey"
FOREIGN KEY ("sourceCaptureAttemptId")
REFERENCES "CisPaymentCaptureAttempt"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
