# Calendar Slice C Auto Sync And Shared Calendar Implementation

Date: 2026-04-15

## Goal

Extend the Outlook-connected centralized Pulse calendar from a manual sync foundation into a safer production-ready provider slice with:

- automatic Outlook reflection for real lead and training scheduling workflows
- target-calendar selection for shared or alternate Outlook calendars
- Teams meeting-link preference for compatible virtual event families

Pulse still remains the workflow source of truth. Outlook is a connected reflection layer, not the primary system of record.

## Scope Completed

- automatic Outlook sync on lead discovery scheduling
- automatic Outlook unsync on lead discovery completion or skip
- automatic Outlook sync on training session create and reschedule
- automatic Outlook unsync on training session cancel and complete
- selectable Outlook target calendar from available Graph calendars
- persisted Outlook target-calendar settings per connected user
- persisted meeting-link preference per connected user
- Teams meeting-link generation for compatible event families:
  - `discovery_call`
  - `virtual_training`
- binding records now retain:
  - target calendar snapshot
  - meeting provider snapshot
  - external join URL when present
- centralized `/calendar` UI now exposes:
  - available Outlook calendars
  - selected calendar summary
  - meeting-link preference
  - per-event join link when present
- expanded regression coverage for:
  - calendar listing and settings persistence
  - automatic lead discovery sync
  - automatic training sync / resync / unsync

## Important Decisions

1. Pulse still owns workflow truth.
   - Scheduling, completion, cancellation, and lifecycle decisions still happen in Pulse modules.
   - Outlook reflects those changes automatically only after a user explicitly connects Outlook.

2. Provider sync remains user-scoped.
   - Outlook connection, calendar selection, and meeting-link preference are persisted per internal Pulse user.
   - We are not introducing a tenant-wide mailbox service account in this slice.

3. Shared-calendar support is target-calendar based, not a full delegate workflow engine.
   - Users can choose a non-default calendar that Graph returns.
   - Deeper delegate/shared-calendar permission nuance stays parked until pilot behavior is confirmed.

4. Teams meeting generation is opt-in and bounded.
   - Only compatible event families request online meetings.
   - We are not introducing WebEx logic or generic meeting-provider abstraction drift in this slice.

5. Any secret previously pasted in chat must still be treated as exposed.
   - A rotated secret must be used for real testing.

## Backend Additions

Schema additions:
- `CalendarMeetingProviderPreference`
- `CalendarConnection.targetCalendarId`
- `CalendarConnection.targetCalendarName`
- `CalendarConnection.meetingProviderPreference`
- `CalendarEventBinding.externalMeetingJoinUrl`
- `CalendarEventBinding.targetCalendarId`
- `CalendarEventBinding.meetingProvider`

API routes added:
- `GET /api/v1/calendar/outlook/calendars`
- `PATCH /api/v1/calendar/outlook/connection`

Automatic sync hooks added to:
- lead discovery scheduling / completion / skip
- training session create / reschedule / complete / cancel

## Frontend Additions

The centralized calendar now includes:
- available Outlook calendars pulled from Graph
- target-calendar selection
- meeting-link preference selection
- selected calendar summary in the Outlook connection card
- event-level join-link display when Outlook generated a meeting link

This remains inside the approved prototype-aligned `/calendar` workspace.

## Regression Coverage

Expanded suite:
- `apps/api/test/calendar.outlook.regression.test.mjs`

Critical paths covered:
- calendar list retrieval from Graph
- connection settings persistence
- automatic lead discovery sync with Teams join URL
- automatic training create/reschedule sync
- automatic provider unsync on cancellation
- invalid state and missing-config boundaries

## Validation Commands

- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/api test:calendar`
- `pnpm --filter @pulse/api test:training`
- `pnpm --filter @pulse/api test:leads`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web build`

## What Is Solid

- Outlook OAuth/token handling remains backend-owned and encrypted
- automatic sync now follows real module state changes instead of relying only on manual push
- target calendar and meeting-link preference are persisted and typed
- lead and training workflows stayed green under sequential regression validation

## What Is Risky

- Graph/provider behavior for shared calendars can still vary by tenant policy
- Teams meeting generation is foundation-level only until real pilot users confirm behavior
- the currently known exposed secret must not be reused

## What Is Parked Intentionally

- WebEx coexistence
- bidirectional Outlook-to-Pulse reconciliation
- automatic sync for broader event families beyond discovery/training
- advanced delegate/shared-calendar nuance
- Teams/WebEx hybrid selection logic

## Recommended Next Calendar Steps

1. Add more real source families into `/calendar`, starting with the next approved operational workflows.
2. Add sync status/audit visibility in calendar ops and admin views.
3. Validate shared-calendar pilot behavior with real users before going deeper on delegate nuances.
4. Only then consider broader provider coexistence or two-way reconciliation.
