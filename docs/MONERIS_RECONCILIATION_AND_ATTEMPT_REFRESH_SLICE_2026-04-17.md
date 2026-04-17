# Moneris Reconciliation And Attempt Refresh Slice

Date: `2026-04-17`
Branch: `codex/entra-calendar-governance`

## What Shipped

- CIS package detail reads now expire stale Moneris hosted-capture attempts before returning the package.
- Replaying the same Moneris hosted-capture success payload no longer fails once the attempt is already recorded.
- Duplicate provider result replays stay idempotent instead of creating duplicate workflow events.

## Why This Slice Matters

- Sandbox and provider testing often re-send the same result payload more than once.
- Finance users also reopen packages after some hosted attempts have already aged out.
- This slice keeps the capture-attempt lifecycle honest without forcing manual cleanup or breaking on harmless replays.

## What Is Solid

- Expired attempts no longer remain misleadingly `launched` in CIS detail views.
- Idempotent Moneris success replays return the current attempt state instead of erroring once the first result is already stored.
- The existing token-received, failed, expired, and consumed lifecycle still remains explicit and auditable.

## What Is Risky

- We still do not have a full provider-side callback or polling reconciliation loop.
- This slice handles stale-view refresh and duplicate replay safety, but not every possible late-provider edge case yet.

## What Is Parked Intentionally

- Broader Moneris callback or polling reconciliation workers
- Provider-side webhook authentication posture
- A second live payment adapter such as eBizCharge

## Regression Coverage

- Expanded suite: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/cis.regression.test.mjs`
- New critical paths:
  - stale hosted attempts expire when CIS detail is reloaded
  - duplicate Moneris success replays remain idempotent
  - existing launch, result, normalization, and finalization paths remain intact

Exact commands:

```bash
pnpm --filter @pulse/api build
node --test --test-concurrency=1 apps/api/test/cis.regression.test.mjs
pnpm --filter @pulse/api test
pnpm --filter @pulse/crm-web test:e2e
node --test --experimental-test-coverage --test-concurrency=1 apps/api/test/cis.regression.test.mjs
```

## Coverage Snapshot

Targeted CIS snapshot from the coverage command above:

- `apps/api/dist/modules/cis/service.js` -> `90.76%` lines, `56.24%` branches, `98.10%` funcs
- `apps/api/dist/modules/cis/moneris.js` -> `65.52%` lines, `94.00%` branches, `100.00%` funcs
- `apps/api/dist/modules/cis/policy.js` -> `74.39%` lines, `77.14%` branches, `78.57%` funcs

## Next Safe Step

- Add a deeper Moneris reconciliation lane for late provider payloads beyond simple idempotent replay.
- Keep any future provider-specific callback logic behind the Moneris adapter and attempt lifecycle services instead of pushing that complexity into the CIS package model.
