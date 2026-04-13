-- AlterTable
ALTER TABLE "LeadRoutingPolicy" ADD COLUMN     "cisFollowUpBusinessDays" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "cisFollowUpOwnerAlertDelayBusinessDays" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "cisFollowUpProspectReminderDelayBusinessDays" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "discoverySchedulingManagerEscalationDelayHours" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN     "discoverySchedulingSlaHours" INTEGER NOT NULL DEFAULT 72,
ADD COLUMN     "initialContactLeadershipEscalationDelayHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "initialContactManagerEscalationDelayHours" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "initialContactSlaHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "initialContactUrgentWindowHours" INTEGER NOT NULL DEFAULT 12,
ADD COLUMN     "stagnantStageDays" INTEGER NOT NULL DEFAULT 7;
