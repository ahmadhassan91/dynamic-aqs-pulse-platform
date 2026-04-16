# CIS OCR And Account Vault Foundation

Date: 2026-04-17  
Branch: `codex/entra-calendar-governance`

## What Shipped

This slice adds a real reviewed OCR-parse lane to the CIS workflow and extends the schema so payment-token references can be promoted from a CIS package into an account-level payment vault record later.

The main implementation areas are:
- `apps/api/src/modules/cis/service.ts`
- `apps/api/src/modules/cis/http.ts`
- `apps/api/src/utils/json.ts`
- `apps/api/test/cis.regression.test.mjs`
- `apps/api/src/modules/auth/request.ts`
- `apps/api/test/auth.admin.integration.regression.test.mjs`
- `apps/crm-web/src/components/leads/LeadCisPanel.tsx`
- `apps/crm-web/src/lib/pulse-api.ts`
- `packages/contracts/src/cis.ts`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260417094500_cis_ocr_and_account_vault_foundation/migration.sql`

## OCR Parse Model

The new OCR/scanned-CIS path is intentionally safe and review-first:

- a lead can register a scanned CIS document through a dedicated upload-scan flow
- the system creates or reuses the CIS package and records the document as a scanned CIS PDF
- a `CisParsedDraft` is created with parse status `needs_review`
- extracted fields are stored in bounded JSON structures for:
  - raw structured payload
  - field-confidence map
  - safe review payload
- reviewed safe fields can later be applied into the canonical CIS form data

This gives us a real OCR review lane without pretending a provider-specific OCR engine or file-storage stack is already live.

## Payment Safety Boundary

The scanned-CIS fallback deliberately refuses to let OCR-extracted payment fields drift into CRM truth.

Safe-field normalization strips payment-sensitive keys such as:
- `paymentMethod`
- `cardOnFileAuthorized`
- `achAuthorized`

If a scanned package appears to include those values, the draft is flagged with `paymentFieldsDetected = true`, but the canonical CIS record still excludes them until a later hosted-payment/tokenization slice exists.

That keeps the CIS review flow useful without accidentally turning OCR into a PCI-dangerous write path.

## Tokenization / Vault Schema Position

Before this slice, the schema was only partially ready for payment-tokenization:

- `CisPaymentVaultReference` already existed for package-level vault references
- provider awareness already existed through `CisPaymentVaultProvider`

But the schema did not yet have a first-class place to keep an approved tokenized payment method against the account itself after CIS.

This slice adds:
- `AccountPaymentVaultReference`

That model is provider-neutral and ready for either eBizCharge or Moneris-style hosted token references later. It supports:

- account linkage
- source CIS vault-reference linkage
- provider name
- vault token / customer reference / external payment-method reference
- last4 / brand / billing zip
- authorization capture timestamp
- default / active flags
- lifecycle status

## What Is Solid

- CIS now has a real reviewed scanned-document parse lane
- OCR fallback is explicitly modeled instead of being hand-waved in notes
- payment-sensitive OCR fields are prevented from entering canonical CIS form data
- account-level payment vault schema foundation now exists
- CIS regressions now cover OCR draft upload, safe-field review, payment-field stripping, and apply behavior
- denied authorization in auth/request handling is now audited more consistently alongside this slice

## What Is Risky

- there is still no real OCR provider integration, binary object storage workflow, or background parse orchestration
- there is still no hosted payment-vault runtime using eBizCharge or Moneris
- account-level payment vault references are schema-ready, but there are no account payment-method APIs or admin/customer UI flows yet
- migration creation hit local Prisma advisory-lock issues during dev-db application, so the checked-in migration was verified by diffing and then applied manually to the dev DB before test-db validation

## What Is Parked Intentionally

- provider-specific OCR engine selection
- hosted upload transport / object storage
- provider-specific tokenization sessions
- card/ACH hosted capture UX
- account payment-method management APIs and UI
- ERP-facing payment-method synchronization

## Regression Coverage

Validated in this slice:
- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/api build`
- `pnpm --filter @pulse/api test:cis`
- `pnpm --filter @pulse/api test:admin`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`

Critical CIS paths now covered:
- scanned-CIS reviewed parse draft creation
- payment-field detection on scanned input
- safe-field stripping before canonical apply
- CIS stage progression after scanned registration
- parsed-draft listing
- parsed-draft apply authorization denial
- reviewed parsed-draft apply success
- finance decision role gating

## Schema Readiness Answer

If the question is, "is the schema ready for tokenization against the account using eBizCharge or Moneris?"

The honest answer is:

- `Yes` for the foundation and relational model
- `No` for live provider integration/runtime behavior

So we are now schema-ready for provider-neutral account token references, but not yet implementation-complete for eBizCharge or Moneris workflows.

## Best Next Slice

The next clean CIS/payment hardening step is:
- hosted payment-token capture provider slice
- account payment-method APIs
- provider-specific sync and callback handling

Only after that should we claim end-to-end tokenization behavior.
