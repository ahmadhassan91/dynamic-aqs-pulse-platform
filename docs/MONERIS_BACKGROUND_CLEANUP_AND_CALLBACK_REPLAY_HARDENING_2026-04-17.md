# Moneris Background Cleanup And Callback Replay Hardening

## What Changed

- Moneris callback ingress in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/http.ts` now hashes the raw payload and enqueues callback work with an explicit idempotency key.
- Moneris callback job parsing and result handling in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/service.ts` now preserve the callback payload hash and keep replay-safe result processing on the service side.
- A dedicated stale-attempt cleanup queue now exists in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/queue/definitions.ts`.
- The worker runtime in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/server.ts` now:
  - registers a Moneris cleanup worker
  - schedules periodic cleanup enqueueing based on config
  - clears the interval on shutdown
- Moneris hosted-tokenization config in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/config/src/env.ts` now includes a cleanup interval setting.
- The API build script in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/package.json` now clears stale incremental build info before compiling so cross-package type changes do not poison later regression runs.

## Why This Slice Matters

Earlier Moneris slices already covered:

- guarded launch
- cancellation and relaunch
- callback ingress
- queue-based reconciliation
- late-result recovery
- vault finalization

But two production-grade gaps were still open:

1. abandoned hosted attempts could linger until a human touched the CIS package again
2. callback replay hygiene depended on service-layer idempotency alone instead of also marking the queue ingress as duplicate-aware

This slice closes both gaps without making undocumented assumptions about final Moneris sandbox behavior.

## New Runtime Rules

1. Moneris callback jobs now carry a deterministic idempotency key derived from:
   - hosted attempt id
   - raw callback payload hash

2. Stale Moneris attempts can now be expired by the worker runtime without waiting for:
   - finance relaunch
   - CIS detail read refresh

3. Cleanup-driven expiry is recorded as explicit system/service activity instead of pretending a finance user performed it.

## Safe Boundaries Preserved

- Pulse still stores only masked/tokenized payment references.
- Raw PAN or bank data still stays outside CRM truth.
- The cleanup worker only transitions CRM-owned attempt lifecycle state.
- Callback replay protection still treats provider payload normalization as an adapter concern, not CIS business-state logic.

## Regression Coverage Added

Expanded in:

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/cis.regression.test.mjs`

New critical paths:

- valid callback ingress enqueues payload hash plus idempotency metadata
- callback worker remains idempotent when the same payload is replayed
- cleanup worker expires stale attempts across multiple CIS packages

Existing Moneris coverage continues to verify:

- launch guards
- cancellation and replacement
- success/failure recording
- payload normalization
- stale expiry on relaunch and detail read
- late-result reconciliation
- final vault promotion

## Verification

Commands run:

```bash
pnpm --filter @pulse/config build
pnpm --filter @pulse/api build
node --test --test-concurrency=1 apps/api/test/cis.regression.test.mjs
```

The CIS regression suite passed `25/25`.

## Next

The safest next payment/provider slice is:

- callback replay retention/cleanup policy after sandbox confirms final retry patterns
- broader abandoned-attempt cleanup reporting/visibility
- only after that, widen to a second live adapter such as eBizCharge if business preference still points there
