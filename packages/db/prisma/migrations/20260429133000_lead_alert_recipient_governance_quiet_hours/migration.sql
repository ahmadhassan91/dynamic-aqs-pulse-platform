ALTER TABLE "LeadRoutingPolicy"
  ADD COLUMN "operationalAlertQuietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "operationalAlertQuietHoursStartLocal" TEXT NOT NULL DEFAULT '18:00',
  ADD COLUMN "operationalAlertQuietHoursEndLocal" TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN "operationalAlertQuietHoursTimeZone" TEXT NOT NULL DEFAULT 'America/Los_Angeles';
