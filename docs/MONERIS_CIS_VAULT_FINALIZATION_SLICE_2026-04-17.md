# Moneris CIS Vault Finalization Slice

Date: `2026-04-17`
Branch: `codex/entra-calendar-governance`

## What Shipped

- Stale Moneris hosted-capture attempts now expire before finance launches a replacement attempt.
- Finance can now finalize a successful Moneris hosted-capture attempt into a permanent CIS vault reference.
- Finalized vault references now retain the source hosted-capture attempt id for audit and later account promotion.
- Consumed hosted-capture attempts are marked explicitly so the lifecycle is visible instead of silently implied.
- The CIS finance panel now recognizes a token-received Moneris attempt and switches into a clear finalization step.

## What Is Solid

- Temporary Moneris tokens still stay encrypted and never become CRM truth by themselves.
- Permanent vault references remain masked/tokenized only and are still provider-neutral at the account layer.
- Finance-only gating remains enforced for hosted capture, result recording, and final vault promotion.
- The full API regression sweep and browser E2E both passed after this slice.

## What Is Risky

- Callback and reconciliation depth is still limited to the current hosted-response flow; there is no broader provider polling or stale callback recovery yet.
- Moneris remains the only live hosted-capture runtime. eBizCharge is still schema/policy-ready, not runtime-ready.

## What Is Parked Intentionally

- Provider-side callback reconciliation beyond the current hosted tokenization response
- Cleanup jobs for abandoned hosted attempts beyond the launch-time stale-expiry guard
- A second live payment adapter such as eBizCharge

## Regression Coverage

- Expanded suite: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/cis.regression.test.mjs`
- New critical paths:
  - stale hosted-attempt expiry on replacement launch
  - Moneris token-received to permanent vault finalization
  - denial when finance tries to finalize before a tokenized result exists

Exact commands:

```bash
pnpm --filter @pulse/api test
pnpm --filter @pulse/crm-web lint
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web build
pnpm --filter @pulse/crm-web test:e2e
node --test --experimental-test-coverage --test-concurrency=1 apps/api/test/cis.regression.test.mjs
```

## Coverage Snapshot

Targeted CIS snapshot from the command above:

- `apps/api/dist/modules/cis/service.js` -> `90.93%` lines, `55.39%` branches, `98.02%` funcs
- `apps/api/dist/modules/cis/policy.js` -> `74.39%` lines
