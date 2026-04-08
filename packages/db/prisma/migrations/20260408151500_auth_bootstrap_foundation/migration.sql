-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('INTERNAL', 'DEALER', 'SERVICE');

-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('LOCAL', 'MICROSOFT_ENTRA', 'SERVICE');

-- CreateEnum
CREATE TYPE "SessionAuthMethod" AS ENUM ('PASSWORD', 'OIDC', 'SERVICE');

-- DropIndex
DROP INDEX "Session_accessTokenJti_key";

-- AlterTable
ALTER TABLE "Session"
  DROP COLUMN "accessTokenJti",
  ADD COLUMN "accessTokenHash" TEXT NOT NULL,
  ADD COLUMN "authMethod" "SessionAuthMethod" NOT NULL,
  ADD COLUMN "identityId" UUID NOT NULL,
  ADD COLUMN "lastSeenAt" TIMESTAMP(3),
  ADD COLUMN "refreshExpiresAt" TIMESTAMP(3) NOT NULL,
  ADD COLUMN "revokedReason" TEXT;

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "userType" "UserKind" NOT NULL DEFAULT 'INTERNAL';

-- CreateTable
CREATE TABLE "UserIdentity" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "provider" "IdentityProvider" NOT NULL,
  "providerSubject" TEXT NOT NULL,
  "loginEmail" TEXT,
  "passwordHash" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "lastAuthenticatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserIdentity_userId_idx" ON "UserIdentity"("userId");

-- CreateIndex
CREATE INDEX "UserIdentity_provider_idx" ON "UserIdentity"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_provider_providerSubject_key" ON "UserIdentity"("provider", "providerSubject");

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_provider_loginEmail_key" ON "UserIdentity"("provider", "loginEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Session_accessTokenHash_key" ON "Session"("accessTokenHash");

-- CreateIndex
CREATE INDEX "Session_identityId_idx" ON "Session"("identityId");

-- CreateIndex
CREATE INDEX "Session_refreshExpiresAt_idx" ON "Session"("refreshExpiresAt");

-- CreateIndex
CREATE INDEX "User_userType_idx" ON "User"("userType");

-- AddForeignKey
ALTER TABLE "UserIdentity"
  ADD CONSTRAINT "UserIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_identityId_fkey"
  FOREIGN KEY ("identityId") REFERENCES "UserIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
