-- CreateTable
CREATE TABLE "AuthLoginState" (
    "id" UUID NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "stateHash" TEXT NOT NULL,
    "nextPath" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthLoginState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthLoginState_stateHash_key" ON "AuthLoginState"("stateHash");

-- CreateIndex
CREATE INDEX "AuthLoginState_provider_expiresAt_idx" ON "AuthLoginState"("provider", "expiresAt");
