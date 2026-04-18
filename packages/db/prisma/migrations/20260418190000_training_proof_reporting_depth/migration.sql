-- CreateEnum
CREATE TYPE "TrainingProofDocumentType" AS ENUM (
  'PROOF_ATTACHMENT',
  'CERTIFICATE',
  'ATTENDANCE_RECORD',
  'PHOTO',
  'OTHER'
);

-- CreateTable
CREATE TABLE "TrainingProofDocument" (
  "id" UUID NOT NULL,
  "sessionId" UUID NOT NULL,
  "documentType" "TrainingProofDocumentType" NOT NULL DEFAULT 'PROOF_ATTACHMENT',
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "uploadedByUserId" UUID,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sha256" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TrainingProofDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrainingProofDocument_sessionId_idx" ON "TrainingProofDocument"("sessionId");

-- CreateIndex
CREATE INDEX "TrainingProofDocument_documentType_idx" ON "TrainingProofDocument"("documentType");

-- CreateIndex
CREATE INDEX "TrainingProofDocument_uploadedByUserId_idx" ON "TrainingProofDocument"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "TrainingProofDocument_uploadedAt_idx" ON "TrainingProofDocument"("uploadedAt");

-- AddForeignKey
ALTER TABLE "TrainingProofDocument"
ADD CONSTRAINT "TrainingProofDocument_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "TrainingSession"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingProofDocument"
ADD CONSTRAINT "TrainingProofDocument_uploadedByUserId_fkey"
FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
