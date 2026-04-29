# Lead Operational Alert Delivery Preview Foundation

Date: 2026-04-18

## What Landed

This slice takes the persisted lead operational-alert records from the earlier correctness pass and gives them a real delivery lane without pretending SMTP, Graph Mail, or any other provider is already approved.

Implemented:

- a new `lead.operational-alert-delivery` worker queue now sits behind the existing alert scan
- newly created lead operational alerts are queued for delivery automatically from the scan worker
- lead operational alerts now carry explicit delivery summary state:
  - `PENDING`
  - `PREVIEWED`
  - `SENT`
  - `SKIPPED`
  - `FAILED`
- delivery attempts are persisted in a dedicated child table instead of being hidden in logs or JSON blobs
- non-production environments now default to a provider-neutral `preview` mode
- explicitly disabled environments record a real skipped-delivery attempt instead of failing silently
- SGT recipient seeding no longer force-reactivates manually disabled recipients on every scan

## Why This Shape

We still do not have an approved outbound mail provider boundary for these alerts.

So the right engineering move was:

- keep alert creation as the source-of-truth step
- add a clean delivery worker behind it
- persist delivery attempts and current delivery state
- use a preview/log transport until real provider credentials and response contracts exist

That gives us:

- honest operational truth now
- clean upgradeability later
- regression coverage for alert delivery behavior without inventing a live provider

## Runtime And Provider Plan

Current runtime posture:

- `lead.operational-alert-scan` remains the source-of-truth scan job for creating operational alert records.
- `lead.operational-alert-delivery` is the delivery job and is enqueued once per persisted alert using an alert-scoped idempotency key.
- non-production defaults to `LEAD_OPERATIONAL_ALERT_DELIVERY_MODE=preview`
- production defaults to `LEAD_OPERATIONAL_ALERT_DELIVERY_MODE=disabled` until provider credentials, sender policy, and response contracts are approved
- `preview` records a `PREVIEWED` delivery attempt with provider key `pulse.lead-operational-alert.preview`
- `disabled` records a `SKIPPED` delivery attempt with provider key `pulse.lead-operational-alert.disabled`
- both modes persist recipient, subject, correlation metadata, and current alert delivery status so operations can audit what would have happened

Provider activation plan:

1. Keep the queue contract stable: the delivery worker should still receive only the persisted alert id plus correlation context.
2. Add the approved outbound provider behind the delivery worker, not in the scan worker or lead mutation paths.
3. Map provider responses into explicit delivery attempts:
   - accepted/sent -> `SENT`
   - configuration or recipient suppression -> `SKIPPED`
   - retryable provider failure -> worker retry plus `FAILED` only after the retry policy is exhausted
4. Store provider message ids, response classification, and failure reason in the delivery-attempt metadata without moving core alert truth into JSON.
5. Keep production disabled until sender domain, recipient governance, quiet-hours/escalation policy, and support ownership are signed off.

This means production readiness is not "turn on SMTP." It is a controlled provider cutover that preserves the current audit trail and queue isolation.

## Key Files

- `apps/api/src/modules/leads/alerts.ts`
- `apps/api/src/modules/leads/service.ts`
- `apps/api/src/queue/definitions.ts`
- `apps/api/src/server.ts`
- `apps/api/package.json`
- `packages/config/src/env.ts`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260418174000_lead_operational_alert_delivery_foundation/migration.sql`
- `apps/api/test/leads.operations.regression.test.mjs`

## Regression Coverage

Expanded in:

- `apps/api/test/leads.operations.regression.test.mjs`

Critical paths now covered there:

- no matching leads
- empty active SGT recipient roster
- fallback escalation thresholds when the policy record is missing
- dedupe across repeated alert scans
- preview delivery attempt creation
- disabled delivery-mode attempt creation
- idempotent re-processing of an already delivered alert

## Verification

Passed:

- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/config build`
- `pnpm --filter @pulse/db build`
- `pnpm --filter @pulse/api build`
- `node --test --test-concurrency=1 apps/api/test/leads.operations.regression.test.mjs`

## Coverage Snapshot

Targeted coverage run:

- `node --test --experimental-test-coverage --test-concurrency=1 apps/api/test/leads.operations.regression.test.mjs`

Key highlights:

- `apps/api/dist/modules/leads/alerts.js`
- delivery and scan branches are now exercised through preview, disabled, dedupe, empty-recipient, and fallback-policy paths

## Explicitly Still Pending

Still intentionally parked:

- real outbound provider delivery for lead operational alerts
- recipient email governance for the seeded SGT roster
- sender domain, escalation routing, quiet-hours, retry/dead-letter operations, and support ownership for production notifications
- UI surfacing of alert delivery history and delivery-state diagnostics
- richer alert preference management by role/team

This slice gives us the correct worker boundary and persisted delivery evidence now, while keeping the real provider dependency clearly parked.
