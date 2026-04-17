# Account Payment Methods And CIS Vault Promotion

Date: 2026-04-17  
Branch: `codex/entra-calendar-governance`

## What Shipped

This slice turns the earlier account-vault schema foundation into a real product surface. Finance-authorized users can now register tokenized payment methods directly against an account, or promote an approved token reference from the CIS workflow into the governed customer record.

The main implementation areas are:
- `apps/api/src/modules/accounts/service.ts`
- `apps/api/src/modules/accounts/http.ts`
- `apps/api/test/accounts.regression.test.mjs`
- `apps/crm-web/src/components/customers/CustomerDetail.tsx`
- `apps/crm-web/src/components/customers/CustomerPaymentMethods.tsx`
- `apps/crm-web/src/lib/pulse-api.ts`
- `packages/contracts/src/accounts.ts`
- `packages/contracts/src/auth.ts`
- `packages/contracts/src/cis.ts`

## Product Shape

The account detail experience now includes a dedicated `Payment Methods` tab under the existing customer workspace.

That surface is intentionally provider-neutral:
- users can view masked payment-method summaries
- finance-authorized users can register a tokenized method manually
- finance-authorized users can promote a `CisPaymentVaultReference` into an account payment method
- users can mark a method as default or activate/deactivate it

The UI never asks for raw card or ACH details. It only works with tokenized/provider-side references and masked metadata.

## Security Boundary

This slice keeps the CRM on the safe side of the payment boundary:
- raw payment data still does **not** enter Pulse
- only token references and masked descriptors are stored in account-level records
- finance visibility stays behind `customer.financials_view`
- finance changes stay behind `customer.financials_manage`

That means the schema and APIs are now ready for hosted-provider capture later, without forcing the CRM to become the system that handles sensitive primary payment data.

## CIS Promotion Model

Promotion from CIS is now a first-class flow instead of a hand-waved later step.

When a CIS package already contains a reviewed payment-vault reference:
- the account payment-method API can promote that reference into the customer record
- promotion keeps lineage through `sourceCisVaultReferenceId`
- repeating the same promotion is idempotent and updates the existing promoted method instead of duplicating it

This preserves the distinction between:
- pre-activation CIS finance flow
- post-approval customer billing record

without losing traceability.

## Default And Lifecycle Rules

Payment-method lifecycle now follows governed customer rules:
- the first active method becomes default automatically
- marking a method as default clears any previous default
- deactivating the current default automatically falls back to another active method when one exists
- inactive methods remain visible as masked history, not hidden truth

## What Is Solid

- account-level tokenized payment methods now have real contracts, APIs, and UI
- CIS vault-reference promotion is now a real workflow, not just schema potential
- finance-only manage actions are enforced separately from broad customer access
- audit entries are written for create, promote, and update operations
- customer detail remains on the approved prototype shell while gaining real billing depth
- regression coverage now includes manual registration, CIS promotion, idempotent promotion, permission denial, and default-fallback behavior

## What Is Risky

- there is still no live hosted-capture session with eBizCharge or Moneris
- there are still no provider callbacks, webhook reconciliation flows, or token-refresh semantics
- no ERP-facing payment-method synchronization exists yet
- the UI currently supports manual token-reference registration and CIS promotion, but not provider-launched hosted capture

## What Is Parked Intentionally

- eBizCharge-specific runtime adapters
- Moneris-specific runtime adapters
- hosted payment iframe/session launch
- provider callback ingestion
- account payment-method deletion rules
- ERP synchronization of approved customer payment methods

## Regression Coverage

Validated in this slice:
- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/api test:admin`
- `node --test --test-concurrency=1 apps/api/test/accounts.regression.test.mjs`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`
- `pnpm --filter @pulse/crm-web test:e2e`

Critical paths now covered:
- finance-only manual tokenized payment-method registration
- CIS vault-reference promotion into account payment methods
- idempotent repeat promotion from the same CIS vault source
- default payment-method reassignment after deactivation
- role denial for non-finance users
- customer workspace still rendering and routing correctly at browser level

## Schema Readiness Answer

If the question is, "is the schema and account model ready for tokenization against the account using eBizCharge or Moneris?"

The honest answer is:

- `Yes` for the provider-neutral relational model and account-facing product surface
- `No` for live provider runtime behavior

So we are now beyond schema-only readiness. Pulse can represent and govern tokenized customer payment methods safely. What remains is the hosted-provider capture and synchronization layer.

## Best Next Slice

The next clean finance/payment hardening step is:
- hosted token-capture launcher and provider adapter boundary
- provider callback handling
- account payment-method capture flow from within CIS or customer billing actions
- provider-specific rollout choice once eBizCharge vs Moneris is finalized for runtime behavior
