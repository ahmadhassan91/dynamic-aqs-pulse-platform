# Outlook Calendar Test Setup Checklist

Date: 2026-04-15

## Purpose

Use this checklist to finish the local/test setup for the Outlook-connected Pulse calendar slice.

This is for dev/test only. The current Entra app can stay broader for testing, but production should move to a cleaner single-tenant internal app registration.

## Important Security Note

- Any client secret pasted into chat or shared broadly should be treated as exposed.
- Rotate the current client secret before continuing real testing.
- Store the new secret value only in local environment configuration or a proper secret manager.

## Microsoft Entra Prerequisites

The app registration should have:

- a `Web` redirect URI:
  - `http://localhost:4000/api/v1/integrations/outlook/callback`
- delegated Microsoft Graph permissions:
  - `openid`
  - `profile`
  - `email`
  - `offline_access`
  - `User.Read`
  - `Calendars.ReadWrite`
- admin consent granted for the tenant
- at least one real mailbox user available for testing

Optional for shared-calendar testing:

- `Calendars.ReadWrite.Shared`

## Local Environment Variables

Add these values to the local `.env` in the implementation repo:

```bash
APP_ENCRYPTION_KEY=replace-with-strong-random-secret
MICROSOFT_ENTRA_TENANT_ID=your-tenant-id
MICROSOFT_ENTRA_CLIENT_ID=your-client-id
MICROSOFT_ENTRA_CLIENT_SECRET=your-rotated-secret
MICROSOFT_GRAPH_REDIRECT_URI=http://localhost:4000/api/v1/integrations/outlook/callback
MICROSOFT_GRAPH_SCOPES=openid profile email offline_access User.Read Calendars.ReadWrite
MICROSOFT_ENTRA_AUTH_BASE_URL=https://login.microsoftonline.com
MICROSOFT_GRAPH_API_BASE_URL=https://graph.microsoft.com/v1.0
```

Notes:

- `APP_ENCRYPTION_KEY` is required because Pulse encrypts Outlook refresh/access tokens at rest.
- Do not commit real secrets into the repo.

## Local Run Steps

From:

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform`

Run:

```bash
pnpm db:migrate
pnpm dev:api
pnpm dev:web
```

If the API is already running, only restart the web app when needed:

```bash
pnpm dev:web
```

## Test Flow

1. Open Pulse at `http://localhost:3000`
2. Sign in as the Pulse bootstrap admin
3. Open `/calendar`
4. In the Outlook card, click `Connect Outlook`
5. Complete the Microsoft sign-in/consent flow
6. Return to Pulse and confirm the calendar shows Outlook as connected
7. Select a discovery or training event
8. Click `Sync to Outlook`
9. Verify the event appears in Outlook Calendar
10. Change the source event in Pulse and re-sync to confirm update behavior
11. Disconnect Outlook and confirm the connection state clears cleanly

## Current Scope

Done in this slice:

- backend-owned OAuth callback
- encrypted token storage
- connect / disconnect flow
- manual Pulse-to-Outlook sync for:
  - lead discovery
  - training session
- external event binding persistence
- regression coverage for connect, callback, invalid state, refresh-token path, and missing config

Still intentionally out of scope:

- automatic sync on every lead/training mutation
- Teams meeting generation
- WebEx coexistence
- bidirectional Outlook-to-Pulse reconciliation
- shared/delegate calendar behavior

## Validation Commands

```bash
pnpm --filter @pulse/contracts build
pnpm --filter @pulse/api test:calendar
pnpm --filter @pulse/crm-web lint
pnpm --filter @pulse/crm-web build
```
