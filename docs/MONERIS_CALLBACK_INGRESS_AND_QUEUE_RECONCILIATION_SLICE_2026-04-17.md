# Moneris Callback Ingress And Queue Reconciliation Slice

## What Changed

- A guarded Moneris callback ingress route now exists in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/http.ts`.
- Callback payloads are no longer forced through the finance-user action path. They are accepted through a shared-secret route and enqueued onto a dedicated worker queue.
- A dedicated queue definition now exists in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/queue/definitions.ts`.
- The worker runtime now registers and processes Moneris callback jobs in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/server.ts`.
- CIS result persistence has been refactored so both:
  - finance-driven result recording
  - service/webhook-driven callback processing
  reuse the same Moneris normalization and reconciliation rules in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/service.ts`.
- Moneris callback config now has an explicit secret boundary in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/config/src/env.ts`.

## Why This Slice Matters

Earlier Moneris slices were operationally useful, but the secure hosted-capture runtime still depended on:

- direct finance interaction in the browser
- manual result recording
- or simulated result replay from internal paths

That was enough for safe early runtime proof, but not enough for a real provider-callback lane.

This slice closes that gap without over-committing to undocumented Moneris callback semantics:

- the CRM still owns package and attempt identity
- callback ingress is guarded by a shared secret
- raw provider payloads are queued first, then processed by the worker runtime
- normalization differences stay isolated from CIS business truth

## Safe Design Boundaries

The new callback lane is intentionally narrow:

1. It requires Pulse-owned identifiers in the route:
   - `cisPackageId`
   - `attemptId`

2. It requires a configured shared secret:
   - `MONERIS_HOSTED_TOKENIZATION_CALLBACK_SECRET`

3. It accepts raw payloads and lets the Moneris normalizer absorb payload-shape differences.

4. It records callback-driven state transitions as `service` actor activity instead of pretending a finance user performed them.

5. It still does **not** store raw payment details in CRM truth.

## What This Does Not Guess

- exact Moneris production webhook signing format
- provider-owned event ids
- bidirectional provider state sync beyond the hosted-capture attempt we already own
- broader provider orchestration for a second adapter like eBizCharge

So if sandbox later returns different payload shapes, we should mostly adjust:

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/moneris.ts`
- and, if needed, the thin callback-ingress parser

not the CIS lifecycle itself.

## Regression Coverage Added

Expanded in:

- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/cis.regression.test.mjs`

New critical paths:

- callback worker can reconcile a Moneris hosted result into CIS payment truth
- callback ingress rejects an invalid shared secret
- callback ingress accepts a valid shared secret and enqueues the payload

Existing Moneris regression coverage still verifies:

- launch guards
- cancellation and replacement launch
- success/failure recording
- payload normalization
- stale expiry
- idempotent replay
- late-result reconciliation
- final vault promotion

## Verification

Commands run:

```bash
pnpm --filter @pulse/contracts build
pnpm --filter @pulse/config build
pnpm --filter @pulse/auth build
pnpm --filter @pulse/db build
pnpm --filter @pulse/acumatica build
pnpm --filter @pulse/api build
node --test --test-name-pattern "Moneris callback|finance cannot launch a second active Moneris hosted capture" --test-concurrency=1 apps/api/test/cis.regression.test.mjs
node --test --test-concurrency=1 apps/api/test/cis.regression.test.mjs
```

## Next

The next safest payment/provider slice is:

- richer Moneris callback authentication once sandbox callback behavior is confirmed
- abandoned-attempt cleanup and reconciliation beyond the current active/cancelled/expired lanes
- only after that, consider a second live adapter such as eBizCharge
