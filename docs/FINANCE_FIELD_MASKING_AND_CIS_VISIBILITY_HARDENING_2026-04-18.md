# Finance Field Masking And CIS Visibility Hardening

## What Landed

This slice hardened the customer-financial visibility boundary without waiting on any external provider access.

Shipped now:

- shared `customer.financials_view` visibility helpers in `apps/api/src/modules/accounts/financials.ts`
- response-layer masking for CIS/account-adjacent finance data in `apps/api/src/modules/cis/service.ts`
- non-finance CIS viewers no longer receive:
  - AP contact name / AP phone / AP email
  - payment method / ACH authorization / card-on-file authorization
  - finance decision credit line / payment terms
  - Moneris hosted-capture provider profile / result code / provider error / BIN / temporary-token indicator
  - vault-reference capture linkage / masked card descriptors / vault-presence indicators
- finance-enabled roles (`FINANCE`, `EXECUTIVE`, `SUPER_ADMIN`) still receive the full finance-approved view
- the internal CIS workspace now degrades cleanly in `apps/crm-web/src/components/leads/LeadCisPanel.tsx` by showing restricted notices instead of misleading blank-or-false finance values

## What Stayed Intentionally The Same

- account payment methods remain on their dedicated gated route; non-finance roles are denied before any payment-method summary is returned
- account summary/detail routes remain thin and do not inline payment methods
- finance decision notes, internal review notes, and general CIS workflow status were not broadened into a larger masking pass in this slice

## Why This Cut

The original concern was framed as an `/accounts/:id` leak, but the concrete live exposure path was narrower and more important:

- CIS detail was still exposing AP and tokenization/provider metadata to non-finance internal roles
- account payment methods were already action-gated
- customer summary/detail payloads were already relatively thin

So the correct patch was to fix the real exposure path first, not invent a larger account-model rewrite.

## Verification

Targeted regression:

- `node --test --test-concurrency=1 apps/api/test/accounts.finance-masking.regression.test.mjs`

Broader verification:

- `pnpm --filter @pulse/api test`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`
- `pnpm --filter @pulse/crm-web test:e2e`

## Still Pending Later

- deeper field-level masking review across non-CIS finance-adjacent surfaces
- outbound alert/mail transport once provider credentials are available
- territory operational reporting depth
