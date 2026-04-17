# Moneris Hosted Capture Runtime Slice

Date: 2026-04-17  
Branch: `codex/entra-calendar-governance`

## What Shipped

This slice adds the first real hosted-payment runtime lane on top of the earlier CIS/account payment-vault foundation by wiring a Moneris-first hosted tokenization launch flow, runtime capture-attempt tracking, and result recording without storing raw card or bank details inside Pulse.

The main implementation areas are:
- `apps/api/src/modules/cis/service.ts`
- `apps/api/src/modules/cis/http.ts`
- `apps/api/src/modules/cis/policy.ts`
- `apps/api/src/modules/admin/http.ts`
- `apps/api/src/modules/admin/service.ts`
- `apps/api/src/modules/training/service.ts`
- `apps/api/test/cis.regression.test.mjs`
- `apps/api/test/auth.admin.integration.regression.test.mjs`
- `apps/crm-web/src/components/leads/LeadCisPanel.tsx`
- `apps/crm-web/src/components/admin/AdminPaymentIntegrationPanel.tsx`
- `apps/crm-web/src/lib/pulse-api.ts`
- `packages/config/src/env.ts`
- `packages/contracts/src/cis.ts`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260417112000_moneris_cis_capture_attempts/migration.sql`

## Runtime Model

The runtime flow is intentionally split into two layers:

- temporary hosted tokenization attempts
- permanent masked vault/payment-method references

That means Pulse now creates a dedicated `CisPaymentCaptureAttempt` when finance launches Moneris hosted capture, but it does **not** prematurely treat the temporary Moneris response as a permanent account or CIS vault record.

This boundary keeps the model safe and provider-neutral:

- Moneris hosted iframe/runtime data lives in `CisPaymentCaptureAttempt`
- permanent CIS-level vault references still live in `CisPaymentVaultReference`
- permanent account-level methods still live in `AccountPaymentVaultReference`

## Moneris-First Provider Choice

This slice uses Moneris as the first provider runtime because the public hosted-tokenization documentation is clearer and more implementation-ready than the currently accessible eBizCharge public material.

The implementation uses the official hosted tokenization pattern:

- environment-specific iframe host (`mpg1t` for QA/dev, `mpg1` for production)
- required hosted profile ID
- iframe postMessage tokenization launch
- result recording through provider payload capture

We still keep the CRM-side model provider-neutral so eBizCharge can be added later without rewriting the schema.

## What Is Solid

- finance can launch Moneris hosted capture from the live CIS panel
- Pulse tracks hosted capture attempts, statuses, expiry, and provider payload outcomes
- successful Moneris temporary tokens are encrypted at rest
- failed hosted captures are recorded with auditable error detail instead of disappearing into the UI
- admin integration status now reflects whether Moneris runtime configuration is actually ready
- the lead/CIS frontend now has a real hosted-capture modal instead of manual-only status tracking

## What Is Still Intentionally Not Done

- converting a successful Moneris temporary token into a permanent provider vault/customer record
- automatic promotion into `CisPaymentVaultReference` or `AccountPaymentVaultReference`
- provider callback/webhook reconciliation
- eBizCharge runtime adapter
- background provider polling or hosted-capture timeout cleanup jobs

Those are the next real payment-provider slices, not something this slice fakes.

## Training Stability Fix Included

This checkpoint also fixes a real regression-harness flake that surfaced during the full sequential backend sweep:

- `ensureTrainingSeededInternal` was using an interactive Prisma transaction even though the seed path is idempotent and serial
- under the long full-suite run, that transaction boundary intermittently collapsed with `Transaction not found`
- the seed path now uses direct idempotent writes instead of the fragile interactive transaction wrapper

That change is not product-facing, but it materially improves regression stability and keeps the full API run trustworthy.

The same sweep also exposed a second full-suite-only issue in longer lead/calendar creation paths. To address that safely, this checkpoint raises the shared Prisma interactive-transaction defaults in the central DB client:

- `maxWait` is now `10s`
- `timeout` is now `20s`

That keeps long but legitimate CRM transactions from expiring under the sequential regression run without changing the business workflow semantics.

## Regression Coverage

Validated in this slice:
- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/config build`
- `pnpm --filter @pulse/db generate`
- `pnpm --filter @pulse/api build`
- `node --test --test-concurrency=1 apps/api/test/cis.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/auth.admin.integration.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/training.regression.test.mjs`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`
- `pnpm --filter @pulse/crm-web test:e2e`

Targeted code-coverage snapshot from the CIS regression run:
- `apps/api/dist/modules/cis/service.js` — `90.55%` lines, `53.65%` branches, `98.00%` functions
- `apps/api/dist/modules/cis/policy.js` — `74.39%` lines, `77.14%` branches, `78.57%` functions
- `packages/config/dist/env.js` — `86.76%` lines

## Best Next Slice

The next clean payment/provider step is:
- finalize provider-side vault promotion from successful Moneris tokenization
- expose governed account/CIS promotion actions for completed provider captures
- add cleanup/reconciliation for stale or abandoned hosted attempts
- decide whether to add eBizCharge as the second provider adapter in parallel or only after Moneris is end-to-end
