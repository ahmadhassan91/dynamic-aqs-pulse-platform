-- CreateEnum
CREATE TYPE "CalendarConnectionProvider" AS ENUM ('OUTLOOK');

-- CreateTable
CREATE TABLE "CalendarConnection" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "CalendarConnectionProvider" NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "providerEmail" TEXT,
    "scope" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarConnectionAuthState" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "CalendarConnectionProvider" NOT NULL,
    "stateHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarConnectionAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventBinding" (
    "id" UUID NOT NULL,
    "connectionId" UUID NOT NULL,
    "provider" "CalendarConnectionProvider" NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "externalWebLink" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventBinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarConnection_provider_idx" ON "CalendarConnection"("provider");

-- CreateIndex
CREATE INDEX "CalendarConnection_providerEmail_idx" ON "CalendarConnection"("providerEmail");

-- CreateIndex
CREATE INDEX "CalendarConnection_isActive_idx" ON "CalendarConnection"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_userId_provider_key" ON "CalendarConnection"("userId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnection_provider_providerSubject_key" ON "CalendarConnection"("provider", "providerSubject");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarConnectionAuthState_stateHash_key" ON "CalendarConnectionAuthState"("stateHash");

-- CreateIndex
CREATE INDEX "CalendarConnectionAuthState_userId_provider_expiresAt_idx" ON "CalendarConnectionAuthState"("userId", "provider", "expiresAt");

-- CreateIndex
CREATE INDEX "CalendarConnectionAuthState_expiresAt_idx" ON "CalendarConnectionAuthState"("expiresAt");

-- CreateIndex
CREATE INDEX "CalendarEventBinding_connectionId_lastSyncedAt_idx" ON "CalendarEventBinding"("connectionId", "lastSyncedAt");

-- CreateIndex
CREATE INDEX "CalendarEventBinding_sourceModule_sourceRecordId_eventType_idx" ON "CalendarEventBinding"("sourceModule", "sourceRecordId", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventBinding_connectionId_sourceModule_sourceRecord_key" ON "CalendarEventBinding"("connectionId", "sourceModule", "sourceRecordId", "eventType");

-- AddForeignKey
ALTER TABLE "CalendarConnection" ADD CONSTRAINT "CalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarConnectionAuthState" ADD CONSTRAINT "CalendarConnectionAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventBinding" ADD CONSTRAINT "CalendarEventBinding_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
