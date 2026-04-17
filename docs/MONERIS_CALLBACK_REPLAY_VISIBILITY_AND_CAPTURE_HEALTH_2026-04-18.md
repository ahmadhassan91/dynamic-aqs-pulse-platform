# Moneris Callback Replay Visibility And Capture Health

## What Changed

- CIS detail contracts in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/src/cis.ts` now expose a derived `paymentCaptureHealth` block instead of forcing finance-facing UI to infer hosted-capture state from raw attempt rows.
- Moneris callback replay handling in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/service.ts` now records an explicit `payment_capture_callback_replayed` CIS event and audit entry when a duplicate callback payload is safely ignored.
- CIS package detail responses now include derived visibility for:
  - active attempt counts
  - launched/token-received/expired/failed/cancelled/consumed counts
  - callback replay count
  - latest cleanup timestamp
  - latest callback replay timestamp
  - whether finance needs to relaunch a fresh hosted capture
- The finance-facing CIS workspace in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/LeadCisPanel.tsx` now surfaces replay-safe callback history and abandoned-session cleanup as first-class payment-capture health, instead of hiding them inside low-level attempt status rows.

## Why This Slice Matters

The earlier Moneris slices made the runtime safe, but not very transparent:

- duplicate provider callbacks were ignored correctly, but finance could not see that retries had happened
- stale hosted attempts were cleaned up correctly, but the UI still looked like a generic list of statuses

That gap matters in real operations because finance needs to distinguish:

- provider retry noise
- abandoned hosted sessions that need relaunch
- real successful tokenization outcomes

This slice turns those backend protections into visible CRM-owned workflow information.

## New Finance Visibility

The new `paymentCaptureHealth` record makes these states explicit:

1. How many hosted attempts are currently active
2. How many attempts expired and now require a clean relaunch
3. How many callback retries were safely ignored
4. The latest cleanup or replay timestamp

This keeps the hosted-capture lane understandable without leaking raw provider internals or payment data into the UI.

## Safe Boundaries Preserved

- Pulse still stores only masked/tokenized references and hosted-attempt lifecycle state.
- Duplicate callback handling is still replay-safe and idempotent.
- Cleanup/replay reporting does not invent provider truth; it only reflects CRM-owned hosted-attempt and event history.
- Raw payment instrument data remains outside CRM by design.

## Regression Coverage Added

Expanded in:

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/cis.regression.test.mjs`

New critical paths:

- callback replay writes visible replay history and increments the derived replay count
- cleanup worker updates the derived health block and marks the package as needing finance relaunch

## Verification

Commands run:

```bash
pnpm --filter @pulse/contracts build
pnpm --filter @pulse/api build
node --test --test-concurrency=1 apps/api/test/cis.regression.test.mjs
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web build
```

The CIS regression suite passed `25/25`.

## Parallel Follow-Ons

The parallel discovery lanes identified the next best adjacent slices:

- Training: `D0.3 proof transport + proof-aware reporting/export`
- Territory: `location-aware territory map/account summary enrichment`

Those are both engineering-owned and can run without waiting on provider prerequisites or new business decisions.
