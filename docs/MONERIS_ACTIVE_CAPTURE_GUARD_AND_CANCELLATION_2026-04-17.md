# Moneris Active Capture Guard And Cancellation Slice

## What Changed

- `startMonerisHostedPaymentCapture` in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/service.ts` now expires stale attempts first, reloads the CIS package, and refuses to launch a new Moneris hosted capture when another Moneris attempt is still active.
- A new finance-only cancellation path now exists through `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/http.ts` and `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/service.ts`.
- The shared contract surface now includes cancellation request/response types in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/src/cis.ts`.
- The internal CIS workspace in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/LeadCisPanel.tsx` now:
  - warns when a Moneris hosted capture is already active
  - disables duplicate launch attempts
  - allows finance to cancel the active hosted attempt from the same workspace
- The frontend API client now supports hosted-capture cancellation in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/lib/pulse-api.ts`.

## Why This Slice Matters

Earlier Moneris slices handled launch, provider result recording, vault finalization, and late-result reconciliation, but the runtime still let finance repeatedly launch replacement hosted captures without an explicit governed stop point.

That left two avoidable production risks:

- duplicate active hosted payment sessions for the same CIS package
- unclear operator recovery when a secure hosted session was abandoned and finance needed to restart cleanly

This slice makes the active-attempt lifecycle explicit instead of relying on operator discipline.

## New Runtime Rules

1. Only one active Moneris hosted capture may exist per CIS package at a time.
   - active means `launched` or `token_received`

2. Finance can cancel an active hosted capture.
   - allowed only for Moneris attempts
   - allowed only while the attempt is still active
   - creates a `payment_capture_cancelled` CIS event
   - writes a dedicated audit trail entry

3. Once an active attempt is cancelled, finance can launch a fresh replacement hosted capture.

## Safe Boundaries Preserved

- Pulse still does not store raw card or bank details.
- Cancellation does not silently finalize or delete provider truth.
- Cancellation only changes the CRM-owned hosted-attempt lifecycle.
- Older completed or consumed attempts still remain immutable.

## Regression Coverage Added

Expanded in:

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/cis.regression.test.mjs`

New critical paths:

- duplicate active Moneris launches are rejected
- finance can cancel an active hosted attempt
- finance can launch a clean replacement after cancellation

The territory regression suite was also normalized onto built runtime imports in:

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/territories.regression.test.mjs`

That keeps the territory suite aligned with the normal `node --test` backend harness instead of depending on a separate `tsx` execution path.

## Verification

Commands run:

```bash
pnpm --filter @pulse/contracts build
pnpm --filter @pulse/auth build
pnpm --filter @pulse/db build
pnpm --filter @pulse/acumatica build
pnpm --filter @pulse/api build
node --test --test-concurrency=1 apps/api/test/cis.regression.test.mjs
node --test --test-concurrency=1 apps/api/test/training.regression.test.mjs
node --test --test-concurrency=1 apps/api/test/territories.regression.test.mjs
pnpm --filter @pulse/api test
pnpm --filter @pulse/crm-web lint
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web build
pnpm --filter @pulse/crm-web test:e2e
```

## Next

The safest next payment/provider slice is still:

- deeper Moneris callback ingress or worker-driven reconciliation once sandbox callback behavior is confirmed
- broader abandoned-attempt cleanup beyond cancellation plus expiry
- only after that, decide whether a second live adapter like eBizCharge should be added
