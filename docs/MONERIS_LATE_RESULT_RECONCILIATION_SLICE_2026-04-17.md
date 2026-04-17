# Moneris Late Result Reconciliation Slice

## What Changed

- `recordMonerisHostedCaptureResult` now supports a guarded late-result reconciliation path for expired Moneris hosted-capture attempts in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/service.ts`.
- Exact duplicate replays still remain idempotent.
- Expired attempts can now be promoted back to `token_received` or `failed` when a late provider result arrives and there is no newer active Moneris truth for that CIS package.
- If a newer Moneris attempt is already `launched`, `token_received`, or `consumed`, the older expired attempt is explicitly rejected instead of silently mutating history.
- Reconciled attempt changes now create a dedicated `payment_capture_reconciled` CIS event and a distinct audit operation (`cis.payment_capture.moneris.reconcile`).

## Why This Slice Matters

Earlier slices were safe for straightforward hosted-capture launch and result recording, but they still treated every non-`launched` attempt as effectively frozen unless the replay was perfectly identical.

That was too brittle for a real hosted-tokenization runtime because:

- a provider success can legitimately arrive after Pulse has already marked an attempt expired locally
- finance needs a clean way to accept that late provider truth without manually rebuilding the CIS payment state
- we must still prevent older attempts from overriding newer finance-owned attempts

This slice keeps the default behavior conservative while making the expired-attempt path more operationally usable.

## Safe Rules Added

The runtime now behaves like this:

1. `launched`
   - normal provider result handling
   - success -> `token_received`
   - failure -> `failed`

2. `expired`
   - exact replay -> no-op
   - late provider result -> allowed only when there is no newer Moneris attempt already active or consumed
   - if allowed, result becomes a reconciled state change with audit/event history

3. `failed`
   - exact replay -> no-op
   - non-identical replay -> still rejected

4. `consumed`
   - exact replay -> no-op
   - non-identical replay -> still rejected

## What We Intentionally Did Not Do

- We did not add an unauthenticated direct Moneris webhook route yet.
- We did not guess callback authentication semantics before sandbox evidence confirms them.
- We did not let older expired attempts overwrite newer launched or consumed attempts.
- We did not reopen failed or consumed attempts automatically just because a later payload looked different.

That keeps the CRM-owned payment truth stable until real sandbox callback behavior is proven.

## Regression Coverage Added

Expanded in:

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/cis.regression.test.mjs`

New critical paths:

- late Moneris success can reconcile an expired attempt into `token_received`
- late Moneris success is blocked when a newer Moneris hosted-capture attempt is already active

Existing Moneris coverage continues to verify:

- hosted-capture launch
- config guards
- failure recording
- payload normalization
- stale-attempt expiry
- idempotent replay
- vault finalization

## Verification

Commands run:

```bash
pnpm --filter @pulse/api build
node --test --test-concurrency=1 apps/api/test/cis.regression.test.mjs
pnpm --filter @pulse/api test
node --test --experimental-test-coverage --test-concurrency=1 apps/api/test/cis.regression.test.mjs
```

## Next

The next safe provider slice is still:

- deeper Moneris callback ingestion or worker-driven reconciliation once sandbox callback behavior is confirmed
- more abandoned-attempt cleanup depth beyond expiry-on-read/launch
- only after that, evaluate whether a second provider like eBizCharge should be added
