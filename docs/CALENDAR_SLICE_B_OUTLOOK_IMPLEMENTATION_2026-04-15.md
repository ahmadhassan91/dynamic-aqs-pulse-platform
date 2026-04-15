# Calendar Slice B Outlook Implementation

Date: 2026-04-15

Note:
- This document captures the first Outlook foundation slice.
- Automatic sync, target-calendar selection, and Teams meeting preference were added later in `CALENDAR_SLICE_C_AUTO_SYNC_AND_SHARED_CALENDAR_IMPLEMENTATION_2026-04-15.md`.

## Goal

Add the first real provider-connected calendar slice on top of the centralized Pulse calendar without breaking the rule that Pulse remains the workflow source of truth.

This slice makes Outlook a reflection layer for real Pulse events rather than a second source system.

## Scope Completed

- backend-owned Outlook authorization-code flow
- short-lived OAuth state persistence
- encrypted Outlook access/refresh token storage
- user-level Outlook mailbox connection
- centralized calendar connection status in `/calendar`
- manual event sync from Pulse to Outlook for:
  - lead discovery events
  - training session events
- Outlook disconnect flow
- persisted external event binding records
- regression coverage for connect, callback, invalid state, sync, refresh-token flow, and missing config

## Important Decisions

1. Pulse owns workflow truth.
   - Lead discovery and training continue to be authored in Pulse.
   - Outlook reflects those events.

2. Browser does not store Microsoft Graph tokens.
   - OAuth callback and token exchange happen on the backend.
   - Tokens are stored encrypted in the Pulse database.

3. Manual sync comes before automatic sync.
   - This keeps the first provider slice smaller and safer.
   - Automatic sync from lead/training mutations can be added later once this foundation is proven.

4. Current Entra app can remain broader for test/dev.
   - That is acceptable for implementation testing.
   - Production should still move to a cleaner single-tenant internal app registration.

5. Any client secret pasted into chat must be treated as exposed.
   - The testing app can stay in place.
   - The secret value should be rotated before real testing continues.

## Backend Additions

Schema additions:
- `CalendarConnection`
- `CalendarConnectionAuthState`
- `CalendarEventBinding`
- `CalendarConnectionProvider`

Config additions:
- `APP_ENCRYPTION_KEY`
- `MICROSOFT_ENTRA_TENANT_ID`
- `MICROSOFT_ENTRA_CLIENT_ID`
- `MICROSOFT_ENTRA_CLIENT_SECRET`
- `MICROSOFT_GRAPH_REDIRECT_URI`
- `MICROSOFT_GRAPH_SCOPES`
- `MICROSOFT_ENTRA_AUTH_BASE_URL`
- `MICROSOFT_GRAPH_API_BASE_URL`

API routes:
- `GET /api/v1/calendar/workspace`
- `POST /api/v1/calendar/outlook/connect`
- `DELETE /api/v1/calendar/outlook/connection`
- `POST /api/v1/calendar/outlook/events/sync`
- `GET /api/v1/integrations/outlook/callback`

## Frontend Additions

The centralized calendar now shows:
- Outlook connection status
- connect / disconnect actions
- per-selected-event sync action
- last-sync visibility and external Outlook link when present

This stays inside the approved prototype-aligned `/calendar` workspace instead of creating a separate integration page first.

## Security Notes

- Refresh tokens are encrypted at rest using `APP_ENCRYPTION_KEY`.
- OAuth state values are stored hashed and time-bounded.
- Browser session storage still only contains Pulse token pairs, not provider tokens.

## Testing

New regression coverage lives in:
- `apps/api/test/calendar.outlook.regression.test.mjs`

Covered:
- connect URL generation
- callback success path
- callback invalid-state path
- sync create path
- sync update path
- token refresh path
- missing-config 503 path

## Validation Commands

- `pnpm --filter @pulse/config build`
- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/db generate`
- `DATABASE_URL=postgresql://postgres@localhost:5432/pulse_platform_dev pnpm --filter @pulse/db migrate:dev --name calendar_outlook_provider_slice_b`
- `pnpm --filter @pulse/api build`
- `pnpm --filter @pulse/api test:calendar`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`

## What Is Still Next

Not done in this slice:
- automatic Outlook sync on every lead/training schedule mutation
- Teams meeting generation
- WebEx coexistence
- bidirectional Outlook-to-Pulse reconciliation
- shared/delegate calendar behaviors
- broader event-family sync beyond discovery/training

## Recommended Next Calendar Steps

1. Add automatic sync hooks for approved source workflows.
2. Add more source event families to the centralized calendar.
3. Add provider-status/audit visibility in admin or calendar ops views.
4. Only then consider Teams / WebEx / two-way reconciliation.
