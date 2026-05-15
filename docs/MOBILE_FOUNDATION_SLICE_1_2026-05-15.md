# Mobile Foundation Slice 1

Date: 2026-05-15

## Scope Delivered

`apps/mobile` has been converted from a placeholder package into a clean Expo Router foundation for the Pulse Field app.

Implemented:

- Expo app config and workspace package setup.
- Secure session persistence with stale-session validation.
- Pulse API client for auth, leads, lead detail, accounts, and account detail.
- Native Pulse design primitives: screen, card, metric, status pill, fields, empty/loading/error states, and logo.
- Auth flow with configurable API base URL.
- Bottom-tab shell: Home, Leads, Accounts, Sync.
- Field Home dashboard using live lead/account API data.
- Lead inbox with search and lead detail.
- Account list with search and account detail.
- Sync/status screen that makes the future offline queue visible without pretending offline writes are complete.

## Prototype Parity Preserved

The slice follows the old prototype’s field-app intent:

- TM-first field dashboard.
- Lead inbox as a primary workflow.
- Account context as the field work surface.
- Sync/offline surfaced as a first-class concept.

It intentionally does not port the old prototype wholesale. Mock-only route optimization, camera OCR, voice transcription, consignment audit, and offline conflict handling stay out until those native slices are implemented against real APIs.

## Build And Validation

Commands run:

- `pnpm install`
- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/mobile typecheck`
- `pnpm --filter @pulse/mobile lint`
- `pnpm --filter @pulse/mobile build`

Visual smoke:

- Served the web export locally.
- Verified unauthenticated users land on `/auth/login`.
- Screenshot: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/mobile-foundation-login.png`

## Remaining Mobile Slices

Next useful slice:

1. Add today calendar/training APIs to the mobile dashboard.
2. Persist route/check-in visits through backend APIs once the territory field-execution contract is approved.
3. Add consignment readiness/documents/detail routes beyond the first audit queue.
4. Add durable offline queue and conflict UI.
5. Add push notification and deep-link handling after provider/governance approval.

## Slice 2 Update

Added after the foundation checkpoint:

- Home dashboard now uses `lead workflow queue` summary counts for open actions, urgent items, SLA risk, and stagnant leads.
- Added `Scan Business Card` route.
- Added camera/gallery/manual-text OCR preview flow.
- OCR preview calls the existing `/api/v1/leads/ocr/preview` endpoint.
- OCR remains review-first and does not auto-create a lead.

## Slice 3 Update

Added after the OCR checkpoint:

- Upgraded shared mobile UI primitives toward the Expo native UI guidelines:
  - richer hero surfaces
  - continuous-radius premium cards
  - SF Symbol-backed icons on iOS with stable web/Android fallbacks
  - stronger search and action controls
- Added `Route Plan` tab.
- Added provider-neutral suggested stop ordering from visible accounts.
- Added mobile check-in/check-out shell with:
  - foreground GPS capture through `expo-location`
  - timed-only fallback when location permission is unavailable
  - required checkout notes before completion
  - completed-visit review list
- Route optimization, geofence thresholds, and durable backend visit persistence remain parked until the field-execution contract/provider decision is approved.

Validation:

- `pnpm --filter @pulse/mobile typecheck`
- `pnpm --filter @pulse/mobile lint`
- `pnpm --filter @pulse/mobile build`
- Playwright smoke for dashboard to route tab with mocked account data.
- Screenshot: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/mobile-premium-route-slice.png`

## Slice 4 Update

Added after the route/check-in checkpoint:

- Added mobile bell/status area from Field Home.
- Added `Notifications` route with live CRM pull signals for:
  - urgent lead workflow
  - SLA risk
  - due ROSE audits
  - consignment work/discrepancy items
  - sync boundary messaging
- Replaced the bottom-tab `Sync` workflow with `Consignment`; Sync remains accessible from the notification/status area.
- Added mobile consignment CRM helpers for:
  - site list
  - operational queue
  - site detail
  - ROSE audit update
- Added `Consignment` tab:
  - due/active site queue
  - Acumatica availability warning
  - scheduled ROSE audit load from CRM
  - manual count + notes capture
  - submit ROSE completion back to CRM
- Kept Acumatica warehouse creation, authoritative expected inventory, PO posting, and final financial reconciliation explicitly parked.

Consignment mobile flow clarity:

1. CRM/Pulse owns mobile-visible site, due date, audit, document, and work queue context.
2. TM opens the Consignment tab or bell alert and selects a due ROSE site.
3. App loads the scheduled audit from CRM.
4. TM reviews expected-source freshness. If Acumatica is parked/stale, the app warns and requires manual verification.
5. TM enters counts/notes and submits the ROSE audit to CRM.
6. CRM creates/updates discrepancy and PO follow-up workflow; Acumatica posting remains a back-office parked dependency until access/mappings are approved.

Validation:

- `pnpm --filter @pulse/mobile typecheck`
- `pnpm --filter @pulse/mobile lint`
- `pnpm --filter @pulse/mobile build`
- Playwright smoke for Consignment tab ROSE submission and notification bell/status route.
- Screenshot: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/mobile-consignment-notifications-slice.png`

## Parked Decisions

- Push provider and notification governance.
- Offline sync conflict rules.
- Voice transcription provider, recording retention, and privacy policy.
- Route optimization provider and geofence thresholds.
- Mobile commerce/checkout. The mobile app should hand off to Dealer Portal, not become the dealer checkout app.
