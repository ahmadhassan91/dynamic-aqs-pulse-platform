# Payment Integration Governance And CIS Hosted Capture Tracking

Date: 2026-04-17

## What shipped

- Admin-managed payment integration settings now exist under the live Pulse administration workspace.
- Finance can mark hosted payment capture as requested on a CIS package.
- Finance can record tokenized vault outcomes on a CIS package without storing raw card or bank details in Pulse.
- The customer workspace already supports account-level masked payment methods, and this slice now makes the governance boundary visible and manageable.

## Current operating model

Pulse is now explicitly operating in a **provider-neutral manual-recording mode** for tokenized payment capture.

That means:

- hosted capture still happens outside Pulse
- Pulse stores only provider references and masked descriptors
- finance can record capture progress and vault outcomes in the CIS flow
- account payment methods remain provider-reference based and masked

This is intentionally safe for production hardening because it keeps CRM truth clean while avoiding guessed eBizCharge or Moneris runtime behavior before the provider adapter is actually wired.

## Admin integration controls

The administration workspace now exposes payment integration controls for:

- capture mode
- default provider
- CIS capture tracking
- account payment-method management

Important boundary:

- secrets still belong in environment configuration or a real secret manager
- the admin UI shows rollout and policy controls, not secret editing

## CIS workflow impact

Inside the lead CIS workspace, finance can now:

1. request hosted capture
2. record a tokenized vault reference once hosted capture succeeds

The CIS card now shows:

- current payment status
- existing vault references
- latest authorization timestamp when available
- explicit reminder that raw payment details stay outside Pulse

## Regression coverage

This slice is covered by:

- `apps/api/test/auth.admin.integration.regression.test.mjs`
- `apps/api/test/cis.regression.test.mjs`
- `apps/crm-web/e2e/flows.spec.mjs`

Verified sequentially:

- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web build`
- `pnpm --filter @pulse/api build`
- `node --test --test-concurrency=1 apps/api/test/auth.admin.integration.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/cis.regression.test.mjs`
- `pnpm --filter @pulse/crm-web test:e2e`

## What is still intentionally parked

- live eBizCharge adapter
- live Moneris adapter
- hosted checkout/session creation
- provider callbacks into Pulse
- provider-side reconciliation/polling

Those remain the next provider-runtime slice on top of this governance and manual-tracking foundation.
