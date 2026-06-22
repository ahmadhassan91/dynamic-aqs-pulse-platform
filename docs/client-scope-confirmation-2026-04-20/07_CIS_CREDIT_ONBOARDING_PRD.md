# Pulse Platform — CIS / Credit / Onboarding Module PRD

## Document Control

| Field | Value |
|---|---|
| Module | CIS / Credit / Onboarding |
| Document Type | Master PRD |
| Version | 2.1 |
| Date | 2026-06-09 |
| Status | Draft — traceability enrichment pass complete; scope-accuracy corrections applied 2026-06-18 (see Scope corrections) |
| Owner | Product / Business Development |
| Sprint Sequence | Seq 01–02 |
| Priority | P0 |
| Meeting Traceability | Session 2 (Feb 18 2026), Session 3 (Feb 20 2026), Session 4 (Feb 24 2026) |
| Primary Companion Docs | `00_README_AND_MEETING_AGENDA.md`, `01_LEADS_PRD.md`, `CIS_SLICE_IMPLEMENTATION_PLAN.md`, `CIS_OCR_AND_ACCOUNT_VAULT_FOUNDATION_2026-04-17.md` |

---

## Scope corrections (2026-06-18)

A scope-accuracy re-check against the cited meeting transcripts surfaced the following corrections. No corrections change what is already built; they make this PRD honest before scope-lock. Affected rows are kept and carry inline ⚠️ markers.

- **(HIGH) Required Sales/BD sign-off gate — FR-CIS-015/016, BR-CIS-05/06, ASM-CIS-02.** The required Sales/BD sign-off gate before a package reaches finance is **vendor-designed, not found in the cited transcripts**. The opposite was recorded: a BD-review-before-advance gate was **objected to** by Michelle (Session 1) — *"would just slow the process … I don't necessarily like that."* Treat the sign-off gate as a vendor-proposed workflow that is **open**, and carry Michelle's objection.
- **(MED) Card-on-file "for all accounts" — ASM-CIS-03.** "Required for all accounts" **overstates** the source. Michelle named exceptions and was unsure of universality — *"We have to collect that credit card up front"*, then *"Good exceptions … larger PE's … we just give them a credit line out of the gate … So I don't know"*; C G added *"also people on consignment."* Read ASM-CIS-03 as a **default expectation with confirmed PE + consignment exceptions; universality is unresolved** and tracked by OQ-CIS-06.
- **(LOW) "Validated stage model" — ASM-CIS-09.** The CIS pipeline stage model was the **Session-4 vendor walkthrough** (Maryam, master data sheet), **not Session-3-validated**; the "validated" framing/Session-3 attribution is corrected to a Session-4 vendor presentation.

Full audit: `docs/SCOPE_ACCURACY_AUDIT_2026-06-18.md`.

---

## 1. Meeting Traceability

| Session | Date | Key Speakers | CIS-Relevant Topics |
|---|---|---|---|
| Session 2 | Feb 18 2026 | Ahmad Hassan, C G (Curry), Michelle Hogan, Adrienne Cardinale, Dan Harshbarger, Salman Shakeel, Maryam Zahid | Current CIS process (paper form, manual Dropbox attach, credit card data risk), discovery call gate before CIS send, manual CRM entry after CIS receipt, Acumatica manual setup for new customers, payment processor confirmation (eBizCharge US / Moneris Canada), onboarding tab in legacy CRM, CIS as lead-pipeline stage gate |
| Session 3 | Feb 20 2026 | Ahmad Hassan, C G, Michelle Hogan, Dan Harshbarger, Adrienne Cardinale, Muhammad Majid | Validation of as-is infographic (manual double-entry, offline credit bottleneck, PCI risk), credit approval notification desire ("I want to tell the client right away"), terms drop-down requirement, scanned CIS recognized as needed use case, master data sheet review (lead stages: New → Discovery Call Schedule → Discovery Completed → CIS → CIS Sign → Onboarding Completed → Customer Activity), B2B portal context for CIS |
| Session 4 | Feb 24 2026 | Ahmad Hassan, C G, Michelle Hogan, Dan Harshbarger, Don Hearn, Doug Holcomb, Rick Cardinale (Adrienne), Salman Shakeel, Maryam Zahid | Lead master data sheet walkthrough confirms CIS form fields; CIS date received, link, and training completed flag as pipeline tracking points; parallel discussion re: consignment scope (deferred to its own session); confirmation that first order is the Acumatica customer-creation trigger |

---

## 2. Source Inventory

| ID | Absolute Path | What It Sourced |
|---|---|---|
| SRC-CIS-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md` | Current CIS process pain points; manual paper-scan-attach workflow; PCI risk (credit card on form); Adrienne confirms CIS received is a stage gate; Michelle requires cell + email mandatory before CIS; discovery call gate; Acumatica manual customer setup; eBizCharge (US) and Moneris (Canada) named as payment processors; manual double data entry into CRM + ERP |
| SRC-CIS-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/20 Feb session 3 _ Discovery session 3 _ Validations.md` | Validation of as-is infographic accepted by all stakeholders; credit approval bottleneck pain point confirmed (Michelle: "I want to tell the client right away. You have $5,000 credit line"); terms drop-down requirement raised (Curry); CIS steps validated in pipeline: New → Discovery Call Schedule → Discovery Completed → CIS → CIS Sign → Onboarding Completed → Customer Activity; scanned CIS with OCR confirmed as needed (Curry: "we also have instances they fill out a hard copy"); both payment processor names confirmed by Dan |
| SRC-CIS-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md` | Master data sheet walkthrough — CIS fields: discovery call scheduled, discovery call completed, CIS date received, CIS link, training completed flag; confirms lead lifecycle stage model; Acumatica customer created at first order (Dan: "you cannot create an order in the CRM"); corporate hierarchy / parent-child discussed for PE-owned accounts; confirmation that first order triggers ERP sync |
| SRC-CIS-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/service.ts` | Backend service operations: issueCisLink, savePublicCisDraft, submitPublicCis, reviewAndSignOffCis, submitCisToFinance, recordFinanceDecision, uploadLeadCisScan, applyCisParsedDraft, listFinanceQueue, listCisParsedDrafts; enum values for CisPackageStatus, CisFinanceDecisionStatus, CisPaymentMethod, CisPaymentTerms, CisEntryMethod |
| SRC-CIS-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/http.ts` | Route surface: GET/PUT public CIS token routes, internal lead CIS routes (send-link, resend-link, upload-scan), finance queue route, internal package routes (review-signoff, submit-to-finance, finance-decision), parsed-draft routes |
| SRC-CIS-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/LeadCisPanel.tsx` | CRM UI: link issuance with note, resend, copy-link; scan file upload (UX-CIS-007); parsed-draft apply; sales review notes + finance cover notes; sign-off; finance decision with creditLine + paymentTerms capture; 9-state badge stepper (UX-CIS-009); payment method detection for conditional card-on-file note; all 9 CisPackageStatus states reflected in STEPPER |
| SRC-CIS-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/LeadFinanceQueue.tsx` | Finance queue with decision filter; inline quick-action approve/decline/request-info buttons (UX-CIS-008); modal with decision + notes capture; badge per status |
| SRC-CIS-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/cis/CisPublicForm.tsx` | Public prospect-facing form; US territories added to state picker (UX-CIS-001): AS, GU, MP, PR, VI; save-draft and submit flow; authorization block |
| SRC-CIS-009 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/moneris.ts` | Moneris hosted capture normalization — integration stub for Canada payment path |
| SRC-CIS-010 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/cis/policy.ts` | Payment integration policy resolver — determines which capture provider is in effect |

---

## 3. Executive Summary

The CIS / Credit / Onboarding module is the governed bridge between a qualified lead and a credit-approved, order-ready account. It replaces the manual print-fill-scan-fax Customer Information Sheet process with a single digital flow moving cleanly across three personas: a prospect completes a secure web CIS package, Sales/BD reviews and signs off without leaving the lead record, and finance makes a credit decision from a queue fed off the same record. Pulse tracks every package through one auditable lifecycle, keeps business-review data inside the CRM, and holds raw payment-instrument data strictly outside Pulse.

The direct pain points identified in Sessions 2 and 3 were: credit card data visible in uploaded PDFs creating PCI exposure (Dan: "some CIS do have credit cards in them"), credit approval delivered by phone call rather than system (Michelle: "I want to tell the client right away"), no tracked handoff between Sales and finance, and manual re-entry of CIS data into both CRM and Acumatica. The goal is one tracked, accountable CIS-to-credit handoff instead of email threads and paper forms.

Critically, CIS approval does not create the Acumatica customer — the prospect remains a lead until the first order is placed (Dan: "you cannot create an order in the CRM"; Ahmad confirmed ERP sync triggers on first order in Session 3).

---

## 4. Scope Statement

### 4.1 In Scope

- Generation of a unique, tokenized CIS link per lead, with resend and copy-link support
- Link expiry and revocation so stale or superseded links stop working
- A prospect-facing public CIS form (`/cis/[token]`) covering, in the approved prototype order:
  - company information (website, technician / install-truck / salesperson counts, affinity group or franchise, private-equity / parent-company context)
  - primary contact and owner / general manager
  - business information as registered (legal name, physical and billing address, company phone, type of business, time in business)
  - ordering contact and accounts-payable contact
  - preferred payment method (Net 30 / ACH-EFT / Credit Card on file)
  - Section 2 authorization block with accuracy-and-authorization acknowledgement (e-signature checkbox)
- Prospect save-draft and submit, with the package locking on submit
- An internal Sales/BD CIS workspace embedded in the lead record, structured as three steps:
  - Step 1 — send and track the CIS link
  - Step 2 — review the returned package in read-only tabs (Company and Contacts, Ordering and AP, Payment and Signature)
  - Step 3 — record internal review notes, sign off, and submit a clean package to finance
- A finance decision capability covering approve, approve-with-conditions, request-more-information, and decline
- Credit line amount and payment terms (Net 30 / Net 60 / COD / Custom) captured on approval
- A finance decision queue (`/leads/finance`) filterable by decision status
- A scanned-CIS fallback lane: register a scanned/handwritten CIS, review extracted fields, and apply approved non-payment fields into the canonical CIS record
- Field-level review of scanned content, with payment-sensitive fields stripped and flagged
- A 9-state package lifecycle with lead-stage interlock
- Discovery gating so a CIS cannot be sent before discovery is complete
- Role-based visibility, including restriction of payment and accounts-payable detail to finance-enabled roles
- An immutable event trail for every CIS state transition and finance action

### 4.2 Out of Scope

- Final e-signature vendor selection and signing automation beyond captured acknowledgement metadata
- Final payment provider and hosted tokenized capture runtime (eBizCharge / Moneris) — provider confirmed in Session 2 (Dan: "In the US we use eBiz… in Canada it's Moneris"), integration parked pending hosted capture runtime approval
- Raw payment-instrument storage or any change to the no-raw-card-data boundary
- Production OCR / vision extraction engine and binary object storage for uploaded scans
- Acumatica credit / AR writeback, and Acumatica customer creation (first order only)
- Finance SLA escalation automation
- Shared-mailbox ingestion of returned CIS documents
- Quarterly rebate configuration (Dan: "quarterly rebates are down the road") — parked
- Commercial CIS variant (Dan: "residential first, but I want the foundation to be built so that down the road if we bring in commercial…")
- Canada CIS variant — distinct legal / processor framework, later phase

### 4.3 Parked Dependencies

- eBizCharge (US) and Moneris (Canada) hosted tokenized capture — named processors confirmed in Session 2; parked until provider certifies the hosted capture endpoint
- Microsoft Graph sendMail for CIS link delivery — same provider/credentials dependency as lead alerts; parked pending Graph credentials certification
- Acumatica customer creation at first order — out of scope for CIS module; handled by Leads/Orders integration slice

---

## 5. Primary Future-State User Journeys

### 5.1 Journey A — Sales/BD Sends A CIS From A Qualified Lead

1. A Sales/BD user opens a lead that has completed discovery (gate confirmed in Session 2: Adrienne — "have they had that initial introduction call…then have they returned their customer information sheet").
2. Pulse confirms the lead is eligible (discovery complete, lifecycle active) and presents the CIS workspace.
3. The user issues a unique CIS link to the prospect's email and optionally records an internal send note.
4. Pulse stamps the package as `link_sent`, advances the lead stage to `cis_sent`, and starts tracking.
5. The user can resend a fresh link or copy the public link for manual delivery at any time.

### 5.2 Journey B — Prospect Completes The Digital CIS Package

1. The prospect opens the secure link and sees a Dynamic AQS CIS form scoped to their company.
2. The prospect completes company, contact, business-as-registered, ordering/AP, and preferred-payment sections.
3. The prospect can save a draft and return later through the same link.
4. The prospect completes the Section 2 authorization block, including the accuracy-and-authorization acknowledgement.
5. On submit, Pulse records the submission, captures signature acknowledgement metadata, locks the package, and moves it into the internal review workflow.

### 5.3 Journey C — Sales/BD Reviews And Signs Off

1. The returned package appears in the lead's CIS workspace as `submitted`.
2. Sales/BD reviews the structured data in read-only tabs and confirms completeness.
3. Sales/BD records internal review notes and a finance cover note summarizing the ask.
4. Sales/BD records sign-off; Pulse advances the package to `sales_signed_off` and the lead stage to `cis_signed`.
5. Sales/BD submits the clean package to finance, moving it to `finance_pending`.

### 5.4 Journey D — Finance Makes A Credit Decision

1. Finance opens the finance queue and filters to packages pending decision.
2. Finance opens the package and reviews the full CIS data, lead context, and Sales/BD cover notes.
3. Finance records one of: approve, approve-with-conditions, request-more-information, or decline.
4. On approval, finance sets a credit line amount and payment terms (Michelle: "I want to tell the client right away. You have $5,000 credit line, you have $10,000 credit line"); on conditional or info-requested, finance records what is still needed.
5. Pulse records the decision immutably, advances the package, and returns control to Sales/BD where follow-up is required.

### 5.5 Journey E — Scanned / Handwritten CIS Comes Back Instead

1. A prospect returns a scanned or handwritten CIS rather than completing the digital link (confirmed in Session 2: Curry — "we also have instances they fill out a hard copy or what have you and then they maybe email it in…would we be able to do some kind of recognition things").
2. An internal user registers the scanned document against the lead, creating or reusing the CIS package.
3. Pulse creates a review-first parsed draft and presents the extracted non-payment fields for human review.
4. Any payment-sensitive content is flagged and held out of the canonical CIS record (confirmed in Session 2: Michelle — "we cut off the credit card information…we just take a picture of it not in full view").
5. The reviewer applies the approved non-payment fields into the canonical CIS data, then the package rejoins the standard review and finance path.

### 5.6 Journey F — Credit Approval Without Customer Creation

1. Finance approves credit and records the line and terms.
2. Pulse keeps the record as a lead and does not create an Acumatica customer at this point (Dan Session 4: "you cannot create an order in the CRM…they're manually entered in" / Ahmad confirmed ERP sync only triggers on first order).
3. Onboarding-readiness context (credit approved, terms, portal-readiness signals) is tracked against the lead.
4. The Acumatica customer is created only at the approved first-order activation boundary.

---

## 6. Functional Requirements

### 6.1 CIS Link Issuance And Tracking

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-CIS-001 | Generate a unique, tokenized CIS link per lead and per onboarding attempt | Link token is cryptographically unique per lead; reissue generates a new token and invalidates the prior active token | P0 | SRC-CIS-001, SRC-CIS-004 | Built |
| FR-CIS-002 | Support resend (fresh link) and copy-link actions for manual delivery | "Resend" creates a new link with a new expiry; "Copy link" copies the current active link to clipboard; both actions are logged with timestamp and actor | P0 | SRC-CIS-001, SRC-CIS-006 | Built |
| FR-CIS-003 | Expire links after a configured window (default 30 days) and allow manual revocation | After expiry or revocation the public CIS URL returns a clear expired/revoked message; revocation is logged | P0 | SRC-CIS-004 | Built |
| FR-CIS-004 | Record send count, last-sent time, and expiry on the package | Package detail displays send count, last sent timestamp, and link expiry date to Sales/BD | P1 | SRC-CIS-006, SRC-CIS-001 | Partial — link expiry date not displayed in current UI (UX-CIS-004) |
| FR-CIS-005 | Gate link issuance behind discovery completion and an active lead lifecycle | System presents an error if discovery is not complete or lead is not in an active lifecycle state; gate is enforced server-side via lead stage check | P0 | SRC-CIS-001, SRC-CIS-004 | Built |

### 6.2 Prospect Digital CIS Form

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-CIS-006 | Present the approved sectioned form layout in the prototype field order | Form renders sections in order: Company Info, Primary Contact, Business As Registered, Ordering and AP, Payment, Section 2 Authorization; no section can be skipped on submit | P0 | SRC-CIS-001, SRC-CIS-008 | Built |
| FR-CIS-007 | Support save-draft and submit, locking the package on submit | Prospect can save progress at any point and return via the same link; on submit, package status moves to `submitted` and further edits require a new or reissued link | P0 | SRC-CIS-002, SRC-CIS-008 | Built |
| FR-CIS-008 | Enforce a complete US state and territory picker for physical and billing addresses | Picker includes all 50 US states plus AS, GU, MP, PR, VI (BR-CIS-09) | P0 | SRC-CIS-008 | Built — territories added per UX-CIS-001 |
| FR-CIS-009 | Capture a Section 2 authorization acknowledgement with signature metadata (timestamp, IP, user-agent) | Authorization block requires explicit checkbox consent; on submit, system stores acknowledgement timestamp and connection metadata; the UI clearly distinguishes this from any card-on-file capture state | P0 | SRC-CIS-001, SRC-CIS-008 | Built |
| FR-CIS-010 | Display "card on file required" explanatory copy in the payment section | Payment section renders a one-paragraph explanation that a card on file is required for all accounts, and that Pulse records the authorization intent while hosted capture is pending | P1 | SRC-CIS-006 | Not built — UX-CIS-002 open |
| FR-CIS-011 | Display a "progress saved" banner and return-link after draft save | After successful draft save, a visible confirmation banner appears with a return link so the prospect can navigate away and return to the correct URL | P1 | SRC-CIS-006 | Not built — UX-CIS-003 open |

### 6.3 Internal Review And Sign-Off

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-CIS-012 | Present the returned package in read-only review tabs inside the lead record | Package viewable in three tabs: Company and Contacts, Ordering and AP, Payment and Signature; all fields are read-only in review tabs | P0 | SRC-CIS-001, SRC-CIS-006 | Built |
| FR-CIS-013 | Restrict payment and accounts-payable detail to finance-enabled roles | Payment method, AP contact details, and vault references are masked for non-finance roles; enforcement is server-side | P0 | SRC-CIS-001, SRC-CIS-004 | Built |
| FR-CIS-014 | Capture Sales/BD review notes and a finance cover note | Sales review notes and finance cover note fields are available in the lead CIS workspace at the sign-off step; both fields persist on the internal review record | P0 | SRC-CIS-001, SRC-CIS-006 | Built |
| FR-CIS-015 | Record an auditable Sales/BD sign-off that advances the lead to `cis_signed` — ⚠️ CORRECTED 2026-06-18: vendor-designed gate, not client-confirmed; a BD-review gate was objected to (see Scope corrections) | Sign-off is a single governed action that records actor, timestamp, and advances the package to `sales_signed_off`; lead stage moves to `cis_signed` only at this point, never on prospect submission alone (BR-CIS-05) | P0 | SRC-CIS-002, SRC-CIS-004 | Built |
| FR-CIS-016 | Submit a clean package to finance as a single governed action — ⚠️ CORRECTED 2026-06-18: vendor-designed gate, not client-confirmed; a BD-review gate was objected to (see Scope corrections) | Submitting to finance moves package status to `finance_pending`; only packages in `sales_signed_off` state can be submitted; submit is logged with actor and timestamp | P0 | SRC-CIS-006, SRC-CIS-005 | Built |

### 6.4 Finance Decision And Queue

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-CIS-017 | Present a finance queue filterable by decision status | Queue filters: awaiting submission, pending, info requested, approved, conditional, declined; default filter is `pending`; queue shows company name, stage, finance decision status badge, and submission date | P0 | SRC-CIS-002, SRC-CIS-007 | Built |
| FR-CIS-018 | Support four decision outcomes: approve, approve-with-conditions, request-more-information, decline | Finance can select one of four outcomes; on approval, credit line amount and payment terms are required (UX-CIS-006); on conditional/info-requested, decision notes capture what is still needed (UX-CIS-005) | P0 | SRC-CIS-002, SRC-CIS-007 | Partial — inline quick actions built (UX-CIS-008 Done); creditLine not enforced on approval and decisionNotes not enforced on conditional (UX-CIS-005, UX-CIS-006 open) |
| FR-CIS-019 | Capture credit line amount and payment terms (Net 30 / Net 60 / COD / Custom) on approval | Credit line amount (currency) and payment terms drop-down are required fields when outcome = approved; custom terms require a documented justification field (BR-CIS-12) | P0 | SRC-CIS-002, SRC-CIS-006 | Partial — fields present in UI; required validation not enforced (UX-CIS-006 open) |
| FR-CIS-020 | Log every finance decision immutably with actor, outcome, terms, and timestamp | Every state transition and finance action is recorded as an immutable event (BR-CIS-11); finance decision record includes: actor, outcome, credit line, terms, notes, timestamp | P0 | SRC-CIS-002, SRC-CIS-004 | Built |
| FR-CIS-021 | Support finance reviewers acting from inline queue quick-actions without deep-linking into the lead | Finance queue renders approve/decline/request-info quick-action buttons inline for packages in `pending` or `info_requested` state; actions open a decision modal that captures decision + notes without requiring full lead navigation (Q-CIS-05) | P1 | SRC-CIS-007 | Built — UX-CIS-008 Done |

### 6.5 Scanned / Handwritten CIS Fallback

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-CIS-022 | Let an internal user register a scanned or handwritten CIS document against a lead | Registration UI accepts file upload or manual field entry; a `CisParsedDraft` record is created separate from the canonical CIS record; entry method is recorded as `scanned` | P0 | SRC-CIS-001, SRC-CIS-006 | Built — file upload added per UX-CIS-007 Done |
| FR-CIS-023 | Present extracted non-payment fields for human review and field-level confirmation before apply | Parsed draft review surface shows each extracted field with the extracted value; reviewer must confirm or edit each field before applying; payment-sensitive fields are not shown in the review surface (A-CIS-04) | P0 | SRC-CIS-001, SRC-CIS-006 | Built |
| FR-CIS-024 | Detect and flag payment-sensitive content and keep it out of canonical CIS data | If `paymentFieldsDetected = true` on a parsed draft, the system displays a warning and prevents any payment-related field from being written to the canonical CIS record (BR-CIS-08) | P0 | SRC-CIS-001, SRC-CIS-006 | Built |
| FR-CIS-025 | Apply only reviewed, approved non-payment fields into the canonical CIS record | Apply action is a single governed operation that writes reviewed non-payment fields to the canonical formData record; application is logged with actor and timestamp | P0 | SRC-CIS-004, SRC-CIS-006 | Built |

### 6.6 Payment Boundary And Interim Card-On-File

> **⚠️ Scope signal — 2026-04-20 (Session 13–20 April): client is eliminating / deferring the credit-card capture (card-on-file) flow.**
> On the digital-CIS demo Ahmad described integrating a payment gateway *"to capture … or authorize their credit cards for the later use,"* and the client pushed back:
> - **Steve Mores:** *"We're going to be eliminating that, Currie, okay?"*
> - **C G:** *"it has the ability to do it but we have to make sure that we follow protocol … that's fine, move on."*
> - **Dan Harshbarger:** *"we may have changed our mind here."*
> (`Meetings/session-13th-20thApril-2026.md` L532–554.)
>
> **Interpretation.** Payment **terms** (Net 30/60/COD/Custom) and credit **decisioning** (credit line, approve/decline — FR-CIS-018/019) **stay**. The card-on-file **capture/authorization** concept is **not wanted now**: do **not** build FR-CIS-010 / FR-CIS-028 (the "card on file required" copy), and treat FR-CIS-029 / eBizCharge / Moneris / the vault-reference capture path as **eliminated-or-deferred** rather than merely "parked pending provider." The built `requestCisPaymentCapture` / `moneris.ts` flow is now **dormant scope**.
>
> **Status: needs PM confirmation.** The signal is directional ("may have changed our mind … move on"), and it was **not** carried into scope — the later 2026-06-18 ASM-CIS-03 note still treats card-on-file as a default-with-exceptions rule. Resolve **OQ-CIS-02** / **OQ-CIS-06** and retract **ASM-CIS-03** once confirmed. **The PCI hard-block (NFR-CIS-03, commit `c6e24c2`) is reinforced either way** — with capture eliminated, no card data should ever reach Pulse.

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-CIS-026 | Store business-review data (preferred payment method, authorization state) inside the CRM | Payment method preference, authorization intent state, and vault reference IDs are stored on the CIS package; raw card/bank data is never written to any Pulse table | P0 | SRC-CIS-001, SRC-CIS-004 | Built |
| FR-CIS-027 | Hold tokenized references only, via `CisPaymentVaultReference` (package level) and `AccountPaymentVaultReference` (account level) | Only provider-issued tokens plus authorization state are stored; vault references carry provider, token, masked display, and created-at | P0 | SRC-CIS-004 | Built |
| FR-CIS-028 | Present one coherent interim card-on-file message where card is required | CIS authorization block and payment section present a single consistent message: card on file is required, Pulse records authorization intent, hosted capture is pending the provider decision (BR-CIS-10) | P1 | SRC-CIS-006 | Not built — UX-CIS-002 open |
| FR-CIS-029 | Not launch or record eBizCharge / Moneris capture from the CIS package until hosted capture runtime is approved | Payment capture attempt is blocked at policy layer until provider is certified; `getResolvedPaymentIntegrationPolicy` returns a disabled state for capture; Moneris stub exists in `moneris.ts` | P0 | SRC-CIS-009, SRC-CIS-010 | Built (policy enforced; provider parked) |

### 6.7 Lifecycle, Audit, And Visibility

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-CIS-030 | Maintain a 9-state package lifecycle | States in order: `not_sent` → `link_sent` → `draft_in_progress` → `submitted` → `review_in_progress` → `sales_signed_off` → `finance_pending` → `finance_approved` \| `finance_declined` → `completed`; no state can be skipped; each transition is logged | P0 | SRC-CIS-002, SRC-CIS-004 | Built |
| FR-CIS-031 | Keep the lead-stage interlock (`cis_sent` on first send, `cis_signed` only after Sales sign-off) | Lead stage advances to `cis_sent` when first link is sent; `cis_signed` only after Sales/BD sign-off completes; prospect submission alone does not advance lead stage (BR-CIS-05) | P0 | SRC-CIS-002, SRC-CIS-004 | Built |
| FR-CIS-032 | Record an immutable event for every state transition and finance action | Audit log entry is written on every CIS state change and finance decision; event includes entity type, action, actor, timestamp, and previous/next state | P0 | SRC-CIS-002, SRC-CIS-004 | Built |
| FR-CIS-033 | Surface package status, send count, finance status, payment method, and card-on-file state on the lead workspace | Lead CIS panel shows: current package status badge stepper, send count, last sent date, link expiry, finance decision status, payment method, card-on-file authorization state | P0 | SRC-CIS-006 | Partial — 9-state stepper present (UX-CIS-009 Done); link expiry display open (UX-CIS-004) |
| FR-CIS-034 | Feed CIS turnaround, finance queue depth, and onboarding-readiness signals into leadership reporting | Finance queue page reports: packages per decision status; average days from link_sent to finance_pending; average days from finance_pending to decision | P1 | SRC-CIS-002, SRC-CIS-007 | Partial — queue exists; summary KPIs not yet computed |

---

## 7. Non-Functional Requirements

| ID | Requirement | Target | SRC |
|---|---|---|---|
| NFR-CIS-01 | Public CIS form load time | Form must load and become interactive within 3 seconds on a standard broadband connection | (inferred standard) |
| NFR-CIS-02 | Link token entropy | CIS link token must have at least 128 bits of cryptographic randomness so tokens cannot be guessed | SRC-CIS-004 (crypto.randomBytes usage) |
| NFR-CIS-03 | Payment data isolation | Raw card number, CVV, ACH routing number, and ACH account number must never be written to any Pulse database table, log, or audit record (BR-CIS-03) | SRC-CIS-001, SRC-CIS-004 |
| NFR-CIS-04 | Role-based data enforcement | Payment and accounts-payable field masking must be enforced server-side; client-side role checks are supplementary only and cannot be the sole control | SRC-CIS-004, SRC-CIS-013 |
| NFR-CIS-05 | Audit immutability | CIS event trail records must be append-only; no update or delete operation is permitted on audit records | SRC-CIS-002, SRC-CIS-004 |
| NFR-CIS-06 | Finance queue response time | Finance queue list must return within 2 seconds for up to 500 pending packages | (inferred standard) |
| NFR-CIS-07 | Link expiry enforcement | Expired or revoked links must be rejected within a single request-response cycle; no caching of valid-token state past expiry | SRC-CIS-004 |
| NFR-CIS-08 | Scanned CIS payment isolation | Payment fields flagged in a parsed draft must be excluded from the canonical apply operation even if a future code path attempts to include them; exclusion is enforced in the `applyCisParsedDraft` service operation | SRC-CIS-004 |
| NFR-CIS-09 | Availability | CIS public form and link issuance must be available during business hours with 99.5% uptime target | (inferred standard) |
| NFR-CIS-10 | Accessibility | Public CIS form must meet WCAG 2.1 AA color contrast and keyboard-navigation requirements | (inferred standard) |
| NFR-CIS-11 | Observability | Every CIS state transition, finance decision, and link issuance must emit a structured log event with correlation ID, actor, entity ID, and outcome for operations monitoring | (inferred standard) |

---

## 8. Business Rules Pulse Will Enforce

| # | Rule | SRC |
|---|---|---|
| BR-CIS-01 | A CIS cannot be sent until discovery is complete and the lead lifecycle is active. | SRC-CIS-001 (Adrienne confirms discovery call gate) |
| BR-CIS-02 | A prospect remains a lead through CIS, credit approval, and onboarding; the Acumatica customer is created only at the approved first-order activation boundary. | SRC-CIS-003 (Dan: "you cannot create an order in the CRM") |
| BR-CIS-03 | Raw card number, CVV, ACH routing number, and ACH account number will never be stored in Pulse; only tokenized references and authorization state are kept. | SRC-CIS-001 (Michelle: "we cut off the credit card information…the credit card piece on that end") |
| BR-CIS-04 | Submitting the digital CIS locks the package; further prospect edits require a new or reissued link. | SRC-CIS-002 |
| BR-CIS-05 | The lead stage advances to `cis_sent` when the link is first sent and to `cis_signed` only after Sales/BD sign-off, never on prospect submission alone. — ⚠️ CORRECTED 2026-06-18: vendor-designed gate, not client-confirmed; a BD-review gate was objected to (see Scope corrections) | SRC-CIS-002, SRC-CIS-003 (master data sheet stage model) |
| BR-CIS-06 | A package reaches finance only after a recorded Sales/BD sign-off. — ⚠️ CORRECTED 2026-06-18: vendor-designed gate, not client-confirmed; a BD-review gate was objected to (see Scope corrections) | SRC-CIS-002 |
| BR-CIS-07 | Payment-method and accounts-payable detail is visible only to finance-enabled roles. | SRC-CIS-001 |
| BR-CIS-08 | On the scanned-CIS fallback, payment-sensitive fields are flagged and excluded from canonical CIS data; only reviewed non-payment fields can be applied. | SRC-CIS-001 (Michelle: "we cut off the credit card information") |
| BR-CIS-09 | The CIS address pickers will offer the complete set of US states and recognized territories, not a partial list. | SRC-CIS-001, SRC-CIS-008 |
| BR-CIS-10 | Card-on-file messaging will be internally consistent: where a card on file is required, the CIS will present one coherent authorization-intent state rather than asserting capture that does not occur. | SRC-CIS-002 |
| BR-CIS-11 | Every CIS state transition and finance decision is recorded immutably with actor, outcome, and timestamp. | SRC-CIS-002 |
| BR-CIS-12 | Custom payment terms must carry a documented justification so non-standard terms remain auditable. | SRC-CIS-002 (Curry: terms require procedural conversation; Dan confirms custom terms exist) |
| BR-CIS-13 | Cell phone number and email must be mandatory before CIS issuance. | SRC-CIS-001 (Michelle: "cell phone number needs to be mandatory and email needs to be mandatory. I don't even want the lead without those two things") |

---

## 9. Assumptions

| ID | Assumption | Why It Matters | SRC |
|---|---|---|---|
| ASM-CIS-01 | The CIS is sent only after discovery is complete, with no general pre-discovery send path. | This determines the gate on link issuance and where CIS sits in the lead lifecycle. | SRC-CIS-001 |
| ASM-CIS-02 | Sales/BD sign-off is a required step before any package reaches finance. — ⚠️ CORRECTED 2026-06-18: vendor-designed gate, not client-confirmed; a BD-review gate was objected to (see Scope corrections) | This protects finance from incomplete packages and defines the `cis_signed` interlock. | SRC-CIS-002 |
| ASM-CIS-03 | A card on file is required for all accounts as the current business rule, even while hosted capture is parked. — ⚠️ CORRECTED 2026-06-18: default with PE/consignment exceptions; universality unresolved (OQ-CIS-06). — ⚠️ 2026-04-20 SIGNAL TO RETRACT: client indicated card-on-file capture is eliminated/deferred (Steve Mores), which would void this rule entirely; confirm (see §6.6). | This drives the interim card-on-file UX and the eventual capture integration. | SRC-CIS-001, SRC-CIS-002 |
| ASM-CIS-04 | The scanned-CIS fallback is a human-reviewed lane, and prospects are never asked to interact with parser internals. | This determines whether the fallback is a safe review surface or an accidental raw-data path. | SRC-CIS-001 |
| ASM-CIS-05 | Raw card and bank data stays outside Pulse, and only tokenized references plus authorization state are stored. | This defines the PCI boundary and what the eventual provider integration is allowed to write. | SRC-CIS-001, SRC-CIS-004 |
| ASM-CIS-06 | Credit approval does not create the Acumatica customer; first order remains the activation boundary. | This affects CRM/ERP handoff timing and avoids premature customer records. | SRC-CIS-003 |
| ASM-CIS-07 | Finance decision outcomes are approve, conditional, info-requested, and decline, with line and terms captured on approval. | This determines the finance workspace, queue states, and downstream readiness signals. | SRC-CIS-002 |
| ASM-CIS-08 | eBizCharge is the US payment processor and Moneris is the Canada payment processor. | Integration design and provider-specific hosted capture flow are scoped accordingly. | SRC-CIS-001 (Dan confirmed both processors) |
| ASM-CIS-09 | The lead pipeline stages relevant to CIS in order are: New → Discovery Call Scheduled → Discovery Completed → CIS → CIS Signed → Onboarding Completed → Customer Activity. | This is the validated stage model used to derive the `cis_sent` / `cis_signed` interlock and reporting pipeline. | SRC-CIS-003 (Maryam master data sheet walkthrough) |

---

## 10. Open Questions

| ID | Question | Options To Confirm | Why Decision Is Needed | SRC |
|---|---|---|---|---|
| OQ-CIS-01 | What is the final e-signature approach for the CIS authorization block? | Captured acknowledgement metadata only / dedicated vendor (DocuSign etc.) / hybrid | This affects legal sufficiency, the prospect experience, and integration scope. | SRC-CIS-002 |
| OQ-CIS-02 | What is the final card-on-file capture model, and when does it run? | Hosted capture during CIS / separate post-approval step / provider-of-record per region | This sets the interim UX, the PCI boundary, and the eventual capture integration. **→ 2026-04-20 signal: card-on-file capture eliminated/deferred — confirm to close (see §6.6).** | SRC-CIS-001 |
| OQ-CIS-03 | When should the prospect learn their approved credit line and terms? | Immediately by Pulse / Sales/BD relays personally first / configurable by role | This affects notification design and the BD relationship workflow. Michelle requested immediate notification. | SRC-CIS-002 |
| OQ-CIS-04 | What is the finance decision SLA, and should breaches escalate automatically? | Informal target only / tracked timer / auto-escalation to finance leadership | This determines queue timers, alerting, and escalation automation scope. | SRC-CIS-002 |
| OQ-CIS-05 | How much should finance be able to act directly from the queue? | Decide inline in the queue / open lead then act / quick-actions with full detail on open | This changes the finance workspace and how fast decisions can be recorded. Inline quick-actions built as UX-CIS-008. | SRC-CIS-007 |
| OQ-CIS-06 | Does the card-on-file requirement have exceptions? | Applies to all / ACH-only or institutional exceptions / region-specific | This affects validation, the interim message, and downstream credit handling. **→ likely MOOT per the 2026-04-20 signal (capture eliminated/deferred) — see §6.6.** | SRC-CIS-001 |
| OQ-CIS-07 | Is a Canada CIS variant in this scope, or a later phase? | Same form with conditional fields / separate flow / later phase | This affects address, tax-ID, processor, and signature-framework handling. | SRC-CIS-001 (Dan: Canada supported in Acumatica) |

---

## 11. Later-Phase / Separate Decision Items

- Final e-signature vendor integration and signing automation
- Final payment provider and hosted tokenized capture runtime (eBizCharge / Moneris)
- Raw payment-instrument storage or any relaxation of the no-raw-card-data boundary
- Production OCR / vision extraction engine and binary object storage for scans
- Acumatica credit / AR writeback and customer creation at first order
- Finance SLA escalation automation and finance dashboard depth
- Shared-mailbox ingestion of returned CIS documents
- Automated onboarding checklist, portal provisioning, and training generation beyond credit-readiness signals
- Canada CIS variant and its distinct legal / processor framework
- Quarterly rebate flags during account setup (Dan: "quarterly rebates are down the road — don't want to distract from the CRM")
- Commercial CIS variant (foundation should be architected for future commercial extension per Dan Session 4)

---

## 12. Approval Checklist

Dynamic AQS approval of this PRD will confirm:

- The prospect → Sales/BD → finance handoff is modeled correctly and stays inside one record
- The 9-state lifecycle and the `cis_sent` / `cis_signed` interlock reflect the intended process
- The PCI / payment boundary is framed correctly and the interim card-on-file behavior is acceptable
- The scanned-CIS fallback is correctly scoped as a human-reviewed, payment-safe lane
- The credit-approval-without-customer-creation boundary is correct
- The open questions capture the real business decisions still needed
- BR-CIS-13 (mandatory cell + email before CIS) is confirmed as a hard gate

### Module Status

- `Approved`
- `Approved with amendments`
- `Parked pending decision`
- `Needs rewrite`

### Notes

_To be completed during the review meeting._

---

## §UX-GAPS — Audit 2026-06-08

Gaps identified during a full platform UX/requirements audit. Organised by sprint priority.
All items with **Can do now = Yes** have no external dependency.

### Sprint 1 — Quick Wins (S effort)

| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-CIS-001 | US territories (PR, VI, GU, AS, MP) missing from state dropdown (BR-CIS-09) | CisPublicForm.tsx | Yes | Done — territories added per SRC-CIS-008 |
| UX-CIS-002 | No "card on file required" explanatory copy in payment section | CisPublicForm.tsx | Yes | Open |
| UX-CIS-003 | No "progress saved" banner or return-link on draft CIS form | CisPublicForm.tsx | Yes | Open |
| UX-CIS-004 | No CIS link expiry date displayed and "Resend fresh link" CTA absent | LeadCisPanel.tsx | Yes | Open |
| UX-CIS-005 | decisionNotes not required for conditional / info-requested outcomes (BR-CIS-12) | LeadCisPanel.tsx | Yes | Open |
| UX-CIS-006 | creditLine amount not required when finance decision = approved | LeadCisPanel.tsx | Yes | Open |

### Sprint 2 — Core Workflow (M effort)

| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-CIS-007 | Scanned CIS upload flow incomplete — no file upload and parsed-field review modal (A-CIS-04) | LeadCisPanel.tsx | Yes | Done — file upload added per SRC-CIS-006 |
| UX-CIS-008 | Finance queue has no inline approve/decline/request-info quick actions (Q-CIS-05) | LeadFinanceQueue.tsx | Yes | Done — inline quick actions added per SRC-CIS-007 |
| UX-CIS-009 | No 9-state badge progression stepper in CIS panel | LeadCisPanel.tsx | Yes | Done — stepper added per SRC-CIS-006 |

_To be completed during the review meeting._

---

## 13. FR / NFR → SRC Traceability Matrix

| Requirement ID | Title (abbreviated) | SRC Citations |
|---|---|---|
| FR-CIS-001 | Unique tokenized link | SRC-CIS-001, SRC-CIS-004 |
| FR-CIS-002 | Resend and copy-link | SRC-CIS-001, SRC-CIS-006 |
| FR-CIS-003 | Link expiry and revocation | SRC-CIS-004 |
| FR-CIS-004 | Send count and expiry display | SRC-CIS-006, SRC-CIS-001 |
| FR-CIS-005 | Discovery gate | SRC-CIS-001, SRC-CIS-004 |
| FR-CIS-006 | Sectioned form layout | SRC-CIS-001, SRC-CIS-008 |
| FR-CIS-007 | Save-draft and submit lock | SRC-CIS-002, SRC-CIS-008 |
| FR-CIS-008 | US state and territory picker | SRC-CIS-008, SRC-CIS-001 |
| FR-CIS-009 | Section 2 authorization | SRC-CIS-001, SRC-CIS-008 |
| FR-CIS-010 | Card-on-file explanatory copy | SRC-CIS-006 |
| FR-CIS-011 | Progress saved banner | SRC-CIS-006 |
| FR-CIS-012 | Read-only review tabs | SRC-CIS-001, SRC-CIS-006 |
| FR-CIS-013 | Finance role masking | SRC-CIS-001, SRC-CIS-004 |
| FR-CIS-014 | Sales/BD review and cover notes | SRC-CIS-001, SRC-CIS-006 |
| FR-CIS-015 | Sales/BD sign-off and lead stage advance | SRC-CIS-002, SRC-CIS-004 |
| FR-CIS-016 | Submit to finance | SRC-CIS-006, SRC-CIS-005 |
| FR-CIS-017 | Finance queue with filter | SRC-CIS-002, SRC-CIS-007 |
| FR-CIS-018 | Four decision outcomes | SRC-CIS-002, SRC-CIS-007 |
| FR-CIS-019 | Credit line and terms capture | SRC-CIS-002, SRC-CIS-006 |
| FR-CIS-020 | Immutable decision log | SRC-CIS-002, SRC-CIS-004 |
| FR-CIS-021 | Inline queue quick-actions | SRC-CIS-007 |
| FR-CIS-022 | Register scanned CIS | SRC-CIS-001, SRC-CIS-006 |
| FR-CIS-023 | Parsed-field human review | SRC-CIS-001, SRC-CIS-006 |
| FR-CIS-024 | Payment field flagging | SRC-CIS-001, SRC-CIS-006 |
| FR-CIS-025 | Apply non-payment fields | SRC-CIS-004, SRC-CIS-006 |
| FR-CIS-026 | Business review data in CRM | SRC-CIS-001, SRC-CIS-004 |
| FR-CIS-027 | Tokenized vault references | SRC-CIS-004 |
| FR-CIS-028 | Coherent card-on-file message | SRC-CIS-006 |
| FR-CIS-029 | No capture until provider certified | SRC-CIS-009, SRC-CIS-010 |
| FR-CIS-030 | 9-state lifecycle | SRC-CIS-002, SRC-CIS-004 |
| FR-CIS-031 | Lead-stage interlock | SRC-CIS-002, SRC-CIS-003 |
| FR-CIS-032 | Immutable event trail | SRC-CIS-002, SRC-CIS-004 |
| FR-CIS-033 | Package status on lead workspace | SRC-CIS-006 |
| FR-CIS-034 | Leadership reporting signals | SRC-CIS-002, SRC-CIS-007 |
| NFR-CIS-01 | Form load time | (inferred standard) |
| NFR-CIS-02 | Link token entropy | SRC-CIS-004 |
| NFR-CIS-03 | Payment data isolation | SRC-CIS-001, SRC-CIS-004 |
| NFR-CIS-04 | Server-side role enforcement | SRC-CIS-004, SRC-CIS-013 |
| NFR-CIS-05 | Audit immutability | SRC-CIS-002, SRC-CIS-004 |
| NFR-CIS-06 | Finance queue response time | (inferred standard) |
| NFR-CIS-07 | Link expiry enforcement | SRC-CIS-004 |
| NFR-CIS-08 | Scanned CIS payment isolation | SRC-CIS-004 |
| NFR-CIS-09 | Availability | (inferred standard) |
| NFR-CIS-10 | Accessibility | (inferred standard) |
| NFR-CIS-11 | Observability | (inferred standard) |
