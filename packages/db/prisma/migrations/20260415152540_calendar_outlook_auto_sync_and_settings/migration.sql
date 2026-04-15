-- CreateEnum
CREATE TYPE "CalendarMeetingProviderPreference" AS ENUM ('NONE', 'TEAMS');

-- AlterTable
ALTER TABLE "CalendarConnection"
ADD COLUMN "meetingProviderPreference" "CalendarMeetingProviderPreference" NOT NULL DEFAULT 'NONE',
ADD COLUMN "targetCalendarId" TEXT,
ADD COLUMN "targetCalendarName" TEXT;

-- AlterTable
ALTER TABLE "CalendarEventBinding"
ADD COLUMN "externalMeetingJoinUrl" TEXT,
ADD COLUMN "meetingProvider" "CalendarMeetingProviderPreference" NOT NULL DEFAULT 'NONE',
ADD COLUMN "targetCalendarId" TEXT;
