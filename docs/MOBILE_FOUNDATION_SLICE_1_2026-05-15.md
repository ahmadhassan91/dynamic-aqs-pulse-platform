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

1. Add today calendar/training/consignment APIs to the mobile dashboard.
2. Persist route/check-in visits through backend APIs once the territory field-execution contract is approved.
3. Add consignment ROSE audit mobile flow.
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

## Parked Decisions

- Push provider and notification governance.
- Offline sync conflict rules.
- Voice transcription provider, recording retention, and privacy policy.
- Route optimization provider and geofence thresholds.
- Mobile commerce/checkout. The mobile app should hand off to Dealer Portal, not become the dealer checkout app.
