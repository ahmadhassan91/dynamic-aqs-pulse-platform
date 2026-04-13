# CIS Slice Implementation Plan

Last updated: 2026-04-09

This plan turns the discovery-backed CIS scope into a production delivery slice for `dynamic-aqs-pulse-platform`.

It is based on the confirmed future state:
- unique digital CIS link per lead
- prospect-completed web CIS form
- internal Sales/BD review and sign-off
- finance handoff after CIS sign-off
- scanned/handwritten PDF CIS upload + parse as a fallback path
- tokenized/hosted payment handling only, never raw card storage in Pulse

## What This Slice Covers

Primary path:
- Sales/BD sends a unique CIS link from a qualified lead
- prospect completes the digital CIS package
- Sales/BD reviews and signs off
- finance receives a clean review package

Fallback path:
- internal user uploads a scanned or handwritten CIS PDF
- Pulse performs OCR / vision extraction into a draft CIS record
- user reviews and corrects the parsed data before saving

This slice does **not** include final production payment-provider wiring or full Acumatica writeback certification.

## Discovery Anchors

- Digital CIS link generation and send flow:
  [CIS_CREDIT_ONBOARDING_PRD.md](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/CIS_CREDIT_ONBOARDING_PRD.md#L54)
- Lead workflow with `Send CIS`, status movement, and alert events:
  [LEAD_CAPTURE_MANAGEMENT_PRD.md](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/LEAD_CAPTURE_MANAGEMENT_PRD.md#L252)
- Digital CIS via magic link:
  [13th March Discovery Session 9.md](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/13th%20March%20Discovery%20Session%209.md#L603)
- PDF parsing fallback for handwritten forms:
  [13th March Discovery Session 9.md](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/13th%20March%20Discovery%20Session%209.md#L83)
- Hosted/tokenized payment handling only:
  [13th March Discovery Session 9.md](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/13th%20March%20Discovery%20Session%209.md#L192)
  [CIS_CREDIT_ONBOARDING_PRD.md](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/CIS_CREDIT_ONBOARDING_PRD.md#L352)
- Prototype CIS page:
  [DigitalCISPageClient.tsx](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/src/app/cis/%5Bid%5D/DigitalCISPageClient.tsx)
- Prototype validation schema:
  [leadSchemas.ts](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/src/lib/validation/leadSchemas.ts#L208)

## Scope Split

### In Scope For First Production CIS Epic

- CIS domain entities and workflow state
- digital CIS link generation and resend/copy support
- external CIS form page
- save draft and submit flow
- e-sign capture metadata
- internal review and sign-off state
- scanned PDF upload and OCR/vision draft extraction
- human review screen for parsed CIS drafts
- finance handoff state and queue-ready package status
- audit trail for every CIS state transition

### Explicitly Out Of Scope For This First Epic

- final e-sign vendor integration
- final payment-provider integration
- storing raw ACH/card details in Pulse
- full finance approval workbench depth
- final Acumatica writeback beyond queue/package readiness
- generalized document-management platform features outside CIS

## Production Design Principles

- Use one governed relational CIS core, not ad hoc JSON blobs for operational state.
- Keep raw scanned-document extraction separate from the canonical CIS record.
- Do not persist raw credit-card or bank-account details in Pulse.
- Use additive schema evolution only.
- Keep digital CIS as the main future-state path; PDF parse is fallback support.
- Preserve the prototype section order and field grouping where already approved.

## Proposed Data Model

These are the recommended first production tables.

### `CisPackage`

One package per lead per onboarding attempt.

Core fields:
- `id`
- `leadId`
- `status`
  - `not_sent`
  - `link_sent`
  - `draft_in_progress`
  - `submitted`
  - `review_in_progress`
  - `sales_signed_off`
  - `finance_pending`
  - `finance_approved`
  - `finance_declined`
  - `completed`
- `entryMethod`
  - `digital_link`
  - `scanned_pdf`
- `externalLinkTokenHash`
- `externalLinkExpiresAt`
- `externalLinkLastSentAt`
- `externalLinkSentCount`
- `submittedAt`
- `reviewStartedAt`
- `salesSignedOffAt`
- `financeSubmittedAt`
- `financeDecidedAt`
- `completedAt`
- `paymentStatus`
  - `not_started`
  - `vault_pending`
  - `vault_complete`
  - `not_required`
- `esignStatus`
  - `not_started`
  - `signed`
  - `vendor_pending`
- `sourceDocumentId`
- `parsedDraftId`
- `notes`

### `CisFormData`

Canonical structured CIS business data.

Core fields:
- `id`
- `cisPackageId`
- `companyWebsite`
- `numOfTechs`
- `numOfInstallTrucks`
- `numOfSalespeopleAdvisors`
- `affinityGroupOrFranchise`
- `isPrivateEquity`
- `parentCompanyName`
- `primaryContactName`
- `primaryContactTitle`
- `primaryContactEmail`
- `primaryContactCellPhone`
- `ownerManagerName`
- `ownerManagerTitle`
- `ownerManagerEmail`
- `ownerManagerCellPhone`
- `legalCompanyName`
- `physicalAddress`
- `physicalCity`
- `physicalState`
- `physicalZip`
- `billingAddress`
- `billingCity`
- `billingState`
- `billingZip`
- `companyPhone`
- `typeOfBusiness`
- `yearsInBusiness`
- `monthsInBusiness`
- `orderingContactName`
- `orderingContactCellPhone`
- `orderingContactEmail`
- `apContactName`
- `apDirectPhone`
- `apEmail`
- `paymentMethod`
  - `NET_30`
  - `ACH`
  - `CREDIT_CARD`
- `cardOnFileAuthorized`
- `resaleCertificateAttached`
- `signatureCapturedAt`
- `submittedByProspectAt`

### `CisPackageEvent`

Audit/event stream for lifecycle transitions.

Core fields:
- `id`
- `cisPackageId`
- `eventType`
- `fromStatus`
- `toStatus`
- `actorUserId`
- `actorType`
  - `internal`
  - `prospect`
  - `service`
- `note`
- `metadata`
- `occurredAt`

### `CisDocument`

Document registry without overloading the form record.

Core fields:
- `id`
- `cisPackageId`
- `documentType`
  - `scanned_cis_pdf`
  - `resale_certificate`
  - `supporting_attachment`
- `storageKey`
- `fileName`
- `mimeType`
- `uploadedByUserId`
- `uploadedAt`
- `sha256`

### `CisParsedDraft`

Raw OCR/vision parse result kept separate from canonical form data.

Core fields:
- `id`
- `cisPackageId`
- `documentId`
- `parserVersion`
- `parseStatus`
  - `queued`
  - `parsed`
  - `needs_review`
  - `failed`
- `rawExtractionText`
- `rawStructuredPayload`
- `fieldConfidenceMap`
- `safeFieldPayload`
- `paymentFieldsDetected`
- `createdAt`
- `updatedAt`

### `CisPaymentVaultReference`

Reference only, never raw instrument data.

Core fields:
- `id`
- `cisPackageId`
- `provider`
  - `ebizcharge`
  - `moneris`
  - `unknown`
- `vaultToken`
- `vaultCustomerRef`
- `last4`
- `brand`
- `authorizationCapturedAt`
- `status`

## Recommended API Surface

### Internal API

- `POST /api/v1/leads/:id/cis/send-link`
  - generate or rotate CIS link
  - send email or return copyable link payload
- `POST /api/v1/leads/:id/cis/resend-link`
- `GET /api/v1/leads/:id/cis`
  - summary for lead workspace/detail
- `GET /api/v1/cis/:cisPackageId`
  - full internal CIS package detail
- `POST /api/v1/cis/:cisPackageId/review-signoff`
- `POST /api/v1/cis/:cisPackageId/submit-to-finance`
- `POST /api/v1/cis/:cisPackageId/upload-scan`
  - register PDF/image and queue parsing
- `POST /api/v1/cis/:cisPackageId/parsed-draft/:draftId/apply`
  - human-approved merge from parse draft into canonical form
- `GET /api/v1/cis/finance-queue`
- `POST /api/v1/cis/:cisPackageId/finance-decision`

### External Prospect API

- `GET /api/v1/public/cis/:token`
  - resolve active CIS package from token
- `POST /api/v1/public/cis/:token/save-draft`
- `POST /api/v1/public/cis/:token/submit`
- `POST /api/v1/public/cis/:token/payment-session`
  - initiate hosted/tokenized vault step
- `POST /api/v1/public/cis/:token/payment-complete`

### OCR / Parse API

- `POST /api/v1/cis/parse/preview`
  - optional admin-only dry run for parser validation
- `POST /api/v1/cis/:cisPackageId/parse`
  - queue parse against stored document

## Recommended Web Routes

### Internal `crm-web`

- `/leads/:id/cis`
  - internal CIS summary and actions
- `/cis/:cisPackageId`
  - full internal review page
- `/cis/finance-queue`
  - finance workbench starter slice

### External Prospect Route

- `/public/cis/[token]`
  - externally accessible digital CIS form

### Internal Parse Review

- `/cis/:cisPackageId/parse-review`
  - compare OCR draft to canonical fields before apply

## State Machine

Recommended first production state machine:

1. `not_sent`
2. `link_sent`
3. `draft_in_progress`
4. `submitted`
5. `review_in_progress`
6. `sales_signed_off`
7. `finance_pending`
8. `finance_approved` or `finance_declined`
9. `completed`

Allowed path:

```txt
not_sent
  -> link_sent
  -> draft_in_progress
  -> submitted
  -> review_in_progress
  -> sales_signed_off
  -> finance_pending
  -> finance_approved | finance_declined
  -> completed
```

Fallback parse path:

```txt
not_sent
  -> review_in_progress
  -> sales_signed_off
  -> finance_pending
```

Lead-stage interaction:
- `lead.stage = cis_sent` when link is first sent
- `lead.stage = cis_signed` only after submission is reviewed and Sales/BD signs off
- finance decisions do not create Acumatica customer directly

## UI / UX To Preserve From Prototype

Must preserve:
- sectioned CIS form layout
- company info first
- contact sections grouped logically
- business registration block
- ordering + AP contacts block
- payment section separated from general company info
- explicit completion messaging
- clear distinction between CIS submission and card authorization completion

Reference implementation:
- [DigitalCISPageClient.tsx](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/src/app/cis/%5Bid%5D/DigitalCISPageClient.tsx)
- [leadSchemas.ts](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/src/lib/validation/leadSchemas.ts#L221)

## Security / Compliance Guardrails

- Do not store raw card number, CVV, ACH routing number, or ACH account number in Pulse tables.
- If OCR detects payment instrument fields in scanned PDFs, mark `paymentFieldsDetected = true` and require redacted/manual handling.
- Use hosted/tokenized provider workflow for card-on-file authorization.
- Log all CIS state transitions and finance actions.
- Encrypt stored CIS form data and documents at rest.
- External CIS links must expire and be revocable.

## Blockers And Clarifications

These items do not block schema/API start, but they do block full production completion:

- payment provider choice and hosted vault flow details
- email delivery/provider path for send/resend CIS link
- OCR / vision extraction production approach
- e-sign vendor decision if a dedicated provider is required beyond captured signature metadata
- finance queue action details and approval authority nuances
- exact retention and document-storage operating model for uploaded CIS scans

## Recommended Delivery Order

### Slice A: CIS foundation

Deliver:
- schema
- contracts
- CIS state machine
- audit events
- lead-to-CIS linking

### Slice B: Digital CIS magic-link baseline

Deliver:
- send/resend/copy link
- external token resolution
- save draft / submit
- signature metadata capture
- lead stage update to `cis_sent`

### Slice C: Internal review and finance handoff

Deliver:
- internal CIS detail page
- review sign-off
- submit to finance
- queue-ready finance summary

### Slice D: Scanned PDF parse fallback

Deliver:
- upload scan
- OCR/vision extraction to `CisParsedDraft`
- parse-review UI
- apply approved fields into canonical CIS form

### Slice E: Payment tokenization handoff

Deliver:
- hosted/tokenized payment session
- vault reference persistence
- completion status updates without raw card storage

## Week-by-Week Suggested Implementation

### Week 1

- add CIS tables and enums
- add CIS contracts
- add `lead -> cis` linkage
- add internal send/resend/copy endpoints
- add tracker entries

### Week 2

- build external digital CIS route
- save draft and submit APIs
- internal review summary screen
- lead status synchronization (`cis_sent`)

### Week 3

- add review sign-off and finance handoff
- add finance queue starter view
- add alert/event hooks for submitted and finance pending

### Week 4

- add scanned PDF upload
- add OCR/vision parse draft model
- add review-and-apply workflow for parsed fields

### Week 5

- add hosted payment session boundary
- add vault reference model
- finish completion rules and banners
- close internal alpha testing gaps

## Parked For Later CIS Iterations

- full finance decision dashboard depth
- SLA/escalation automation beyond baseline alerts
- advanced OCR confidence tuning and field-level model evaluation
- document template/version management for multiple CIS variants
- multi-country payment/provider branching beyond baseline references
- full Acumatica writeback after finance approval

## Recommended Next Build Step

Start with **Slice A: CIS foundation**.

That keeps us aligned with the meetings and lets web/backend move in parallel:
- backend can create the CIS domain and send-link lifecycle
- web can start the internal send/review pages and external form shell
- OCR/payment specifics can follow without corrupting the core workflow
