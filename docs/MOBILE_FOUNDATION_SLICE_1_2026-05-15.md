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

## Slice 5 Update

Added after the consignment/bell checkpoint:

- Added a durable mobile draft queue utility for small field-work drafts.
- ROSE audit submission now protects the TM when CRM is unreachable:
  - first tries the live CRM audit update
  - saves the completed audit request as `Draft on phone` if the request fails
  - lets the user retry from Sync Status when signal returns
- Route visit checkout now creates a local `Draft on phone` record instead of only living in component memory.
- Moved Sync Status out of the bottom tab and into a plain notification/status route.
- Home and Notifications now surface local unsynced drafts in user language:
  - `Draft on phone`
  - `CRM saved`
  - `Offline drafts`
- Fixed a React snapshot stability issue in the draft queue hook that caused the exported web build to crash during Sync Status QA.

Field-user clarity:

1. `CRM saved` means Pulse accepted the work and office users can see it.
2. `Draft on phone` means the TM did the work, but it is not in CRM yet.
3. `Preview only` remains the OCR/business-card state until a lead-create flow is approved.

QA as Dynamic field team:

- Simulated a TM opening a due ROSE audit for `AQS Dealer Dallas`.
- Entered a manual count and field notes.
- Forced the first CRM audit update to fail with a weak-signal `503`.
- Confirmed the app did not lose the ROSE work and showed `Saved as a draft on this device`.
- Opened Sync Status and confirmed the draft appeared as `Draft on phone`.
- Retried the draft after restoring the mocked CRM response.
- Confirmed the retry updated the same audit and showed `CRM saved`.
- Confirmed Notifications can open Sync Status for local draft visibility.

Validation:

- `pnpm --filter @pulse/mobile typecheck`
- `pnpm --filter @pulse/mobile lint`
- `pnpm --filter @pulse/mobile build`
- Playwright route-level field QA with mocked CRM outage/recovery.
- Screenshot: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/mobile-offline-draft-queue-slice.png`
- Screenshot: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/mobile-notification-sync-link.png`

Still parked:

- Route visit backend sync remains parked until the field visit API contract is approved.
- ROSE photos/signature/background media sync remain parked; current browser QA stores count/notes/request payload only.
- Conflict merge rules remain parked until the backend conflict policy is approved.

## Slice 6 Update

Added after the offline draft queue checkpoint:

- Added ROSE evidence capture UI inside the mobile Consignment audit card:
  - camera/gallery controls through Expo Image Picker
  - session thumbnail preview
  - remove evidence before submit
  - mark each photo as `General audit evidence` or `Discrepancy evidence`
- Added required TM attestation before submit:
  - typed name
  - checkbox text: `I completed this on-site ROSE audit and verified the count to the best of my knowledge.`
  - submit stays disabled until notes, name, and attestation are present
- Added evidence metadata and attestation metadata to ROSE offline drafts.
- Added draft queue guardrails:
  - no base64/blob/file URI/media bytes stored in local drafts
  - draft payload size cap
  - queue size cap
  - local draft display titles redacted from account/customer names
- Sync Status now shows ROSE attestation/evidence metadata so a TM can tell what is still on the phone.
- Live CRM audit notes include a concise attestation/evidence summary while the actual media upload endpoint remains parked.

Field-user clarity:

1. TM can capture evidence intent without learning backend/media terms.
2. `Draft on phone` still means not visible in CRM yet.
3. `CRM saved` only appears after the audit PATCH succeeds.
4. Photo media upload is explicitly parked until the backend evidence endpoint/storage contract is approved.

QA as Dynamic field team:

- Simulated a TM opening a due ROSE audit.
- Entered count, notes, TM name, and attestation.
- Verified the CRM PATCH payload contains the attestation summary.
- Forced the first CRM audit update to fail with weak signal.
- Confirmed the draft preserved attestation metadata locally.
- Opened Sync Status and confirmed `Attested by Dynamic TM QA` appeared.
- Retried the draft after mocked CRM recovery.
- Confirmed retry updated the audit and showed `CRM saved`.

Validation:

- `pnpm --filter @pulse/mobile typecheck`
- `pnpm --filter @pulse/mobile lint`
- `pnpm --filter @pulse/mobile build`
- Playwright route-level field QA with mocked CRM outage/recovery.
- Screenshot: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/mobile-rose-evidence-attestation-slice.png`

Still parked:

- Actual photo/media upload endpoint and server-side evidence table.
- Customer/legal e-sign ceremony.
- Background media sync.
- Native encrypted/file-backed offline media storage.
- Conflict merge rules.

## Slice 7 Update

Added after the ROSE evidence/attestation checkpoint:

- Hardened mobile session persistence so the selected API base URL is saved with the session.
- Restricted mobile API base URL entry to approved Pulse hosts and HTTPS, with localhost allowed for QA.
- Made the Field Home role label tolerate legacy/partial session envelopes instead of blanking the app.
- Changed field data loading to degrade by section:
  - leads, accounts, queue, consignment sites, and consignment work can load independently
  - one endpoint failure no longer blanks the whole mobile workspace
- Hardened the mobile draft queue:
  - route visit drafts stay `Local only` and are not retried until the field visit API exists
  - individual drafts can be discarded
  - route drafts expire after 72 hours
  - ROSE drafts expire after 7 days
  - ROSE evidence filenames are redacted before local storage
- Improved route check-in reliability:
  - check-in starts immediately as a timed visit
  - GPS capture updates the active visit if permission succeeds
  - GPS permission no longer blocks a TM from starting the visit
- Tightened OCR capture:
  - camera/gallery request base64 explicitly
  - non-image files are rejected
  - large images are rejected before upload
  - pasted fallback text is capped
- Added native permission copy/config for camera, photo library, and location.
- Made ROSE actual count required before submit.
- Added clear copy that ROSE photos are preview-only until the backend evidence endpoint is approved.

Targeted agent QA inputs:

- Requirements QA: next useful mobile slice is ROSE line-item counts and variance preview.
- Mobile code QA: called out durable draft storage, route retry semantics, API base persistence, partial data loading, OCR guards, and ROSE count requirement.
- Scenario QA: covered login/session, home, OCR, leads, accounts, route visit draft, ROSE draft, notifications, and sync.
- Security/PII QA: called out editable API URL risk, draft retention, OCR size/type guards, and evidence metadata redaction.

Playwright QA as Dynamic field team:

- Seeded a Territory Manager session with mocked Pulse CRM APIs.
- Verified Field Home loads live lead/account/consignment counts.
- Previewed a pasted business card through OCR without auto-creating a lead.
- Opened lead detail and verified the next action.
- Opened account detail and verified contact context.
- Completed a route check-in/check-out and confirmed it becomes a parked local route draft.
- Opened a due ROSE audit, entered count/notes/attestation, forced the first CRM PATCH to fail, and confirmed `Draft on phone`.
- Opened Notifications and confirmed `2 drafts on this phone`.
- Opened Sync Status, retried drafts, confirmed ROSE became `CRM saved`, and confirmed route stayed `Local only`.
- Checked local draft storage for blocked media/local URI/base64 keys and obvious contact PII tokens.

Validation:

- `pnpm --filter @pulse/mobile typecheck`
- `pnpm --filter @pulse/mobile lint`
- `pnpm --filter @pulse/mobile build`
- Playwright full field-flow QA with mocked CRM outage/recovery.
- Screenshot: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/mobile-full-qa-cycle.png`

Still parked:

- Native file-backed durable draft storage adapter.
- Centralized token refresh around every data load.
- Route visit backend API and server conflict handling.
- ROSE media upload endpoint and server-side evidence table.
- ROSE line-item variance workflow. This is the recommended next mobile slice.

## Slice 8 Update

Added after the mobile field QA hardening checkpoint:

- Replaced the single ROSE `Actual count total` field with a simple line-item count workflow.
- Each audit line now shows:
  - product name
  - SKU
  - barcode
  - expected quantity
  - required actual count
  - optional item note
  - per-line variance preview
- Added ROSE count summary chips:
  - expected total
  - actual total
  - total variance
- Expected totals now show immediately when the audit loads, even before the TM/RD starts counting.
- Submitting a ROSE audit now sends all counted lines to CRM instead of a synthetic single total line.
- Variance behavior:
  - balanced counts submit with `true_up_confirmed`
  - any shortage/overage submits with `open` reconciliation so PO/discrepancy follow-up remains visible
- Audit notes now include a concise line-count variance summary plus the existing TM/RD attestation and evidence metadata summary.

Usability focus:

- The screen now matches how a Territory Manager or Regional Director audits a site: count each product, see the short/over amount immediately, and add a note only where follow-up is needed.
- The Acumatica dependency is still visible but does not block field counting.
- The line-item cards avoid backend terms and present the work as a field checklist.

Playwright QA as Regional Director:

- Seeded a Regional Director mobile session.
- Loaded a consignment site with two ROSE audit lines:
  - `ROSE Filter Kit`, expected 12
  - `UV Lamp Cartridge`, expected 4
- Confirmed the mobile app showed expected total 16 before counts were entered.
- Entered actual counts 11 and 4.
- Confirmed variance preview showed one short line and actual total 15.
- Submitted during a mocked CRM outage and confirmed `Draft on phone`.
- Verified the PATCH payload included two line items and `open` reconciliation.
- Retried from Sync Status after mocked CRM recovery and confirmed `CRM saved`.
- Checked draft storage for blocked media/local URI/base64 fields and obvious contact PII.

Validation:

- `pnpm --filter @pulse/mobile typecheck`
- `pnpm --filter @pulse/mobile lint`
- `pnpm --filter @pulse/mobile build`
- Playwright RD field-flow QA with mocked CRM outage/recovery.
- Screenshot: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/mobile-rose-line-items-qa.png`

Still parked:

- Server-side ROSE evidence/media endpoint.
- Acumatica authoritative expected inventory refresh.
- PO creation/posting from variance.
- Native encrypted/file-backed offline draft adapter.
- Route visit backend API.

## Parked Decisions

- Push provider and notification governance.
- Offline sync conflict rules.
- Voice transcription provider, recording retention, and privacy policy.
- Route optimization provider and geofence thresholds.
- Mobile commerce/checkout. The mobile app should hand off to Dealer Portal, not become the dealer checkout app.
