# Moneris Sandbox Normalization Hardening

Date: `2026-04-17`
Branch: `codex/entra-calendar-governance`

## What Shipped

- Added a Moneris-specific hosted-capture normalization layer in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/moneris.ts`.
- `recordMonerisHostedCaptureResult` now resolves tokenization outcomes from either direct request fields or normalized raw provider payloads.
- The CIS browser-side Moneris message parser now accepts common payload-shape variants instead of only one exact response shape.
- Added regression coverage for alias-based and nested Moneris payloads so sandbox response drift is caught early.

## Why This Slice Matters

- Real Moneris sandbox payloads can differ from our first-pass assumptions.
- This slice keeps provider-specific variance isolated in one adapter seam instead of leaking across CIS workflow logic.
- If sandbox fields drift again later, we should only need to update the Moneris normalizer and its tests.

## What Is Solid

- The CRM-owned CIS and vault model remains provider-neutral.
- Finance still records only masked/tokenized references, never raw payment data.
- Hosted-capture success still requires both a success response code and a tokenized payment reference after normalization.
- Nested and snake-case Moneris payload variants now behave the same as the original direct-field flow.

## What Is Risky

- We still have not validated every real Moneris callback shape because full sandbox certification data is not in hand yet.
- The browser parser and API normalizer intentionally cover the most likely variants first; additional fields may still appear once sandbox traffic is observed.

## What Is Parked Intentionally

- Broader Moneris callback polling and reconciliation jobs
- Hosted-attempt cleanup beyond the existing expiry/finalization guards
- A second live provider adapter such as eBizCharge

## Regression Coverage

- Expanded suite: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/cis.regression.test.mjs`
- New critical paths:
  - alias-based Moneris tokenization success payloads
  - nested Moneris error payloads
  - preservation of the existing hosted-capture success/failure workflow

Exact commands:

```bash
pnpm --filter @pulse/api build
node --test --test-concurrency=1 apps/api/test/cis.regression.test.mjs
pnpm --filter @pulse/api test
pnpm --filter @pulse/crm-web lint
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web build
pnpm --filter @pulse/crm-web test:e2e
node --test --experimental-test-coverage --test-concurrency=1 apps/api/test/cis.regression.test.mjs
```

## Coverage Snapshot

Targeted CIS snapshot from the coverage command above:

- `apps/api/dist/modules/cis/service.js` -> `91.08%` lines, `55.69%` branches, `98.02%` funcs
- `apps/api/dist/modules/cis/moneris.js` -> `65.52%` lines, `94.00%` branches, `100.00%` funcs
- `apps/api/dist/modules/cis/policy.js` -> `74.39%` lines, `77.14%` branches, `78.57%` funcs

## Next Safe Step

- Validate against real Moneris sandbox responses and extend the normalizer only where sandbox evidence demands it.
- Keep all provider-shape adjustments in the Moneris adapter instead of changing CIS package, vault, or account-payment truth models.
