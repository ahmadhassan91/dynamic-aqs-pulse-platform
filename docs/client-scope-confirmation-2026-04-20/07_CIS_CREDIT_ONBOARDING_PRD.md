# Pulse Platform — CIS / Credit / Onboarding Module PRD

## 1. Document Control

| Field | Value |
|---|---|
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Scope confirmation draft for Dynamic AQS review |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS sales leadership, finance (credit decisioning), Strategic Growth team, operations / customer setup lead |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, `01_LEADS_PRD.md`, Accounts / Contacts PRD, Foundation / Auth / Roles PRD, `CIS_SLICE_IMPLEMENTATION_PLAN.md`, `CIS_OCR_AND_ACCOUNT_VAULT_FOUNDATION_2026-04-17.md` |

---

## 2. Executive Summary

The CIS / Credit / Onboarding module will be the governed bridge between a qualified lead and a credit-approved, order-ready account. It will replace the manual print-fill-scan-fax Customer Information Sheet process with a single digital flow that moves cleanly across three personas: a prospect completes a secure web CIS package, Sales/BD reviews and signs off without leaving the lead record, and finance makes a credit decision from a queue that feeds off the same record. Pulse will track every package through one auditable lifecycle, keep business-review data inside the CRM, and hold raw payment-instrument data strictly outside Pulse. The goal of this module is to give Dynamic AQS one tracked, accountable CIS-to-credit handoff instead of email threads, "did you see this yet?" phone calls, and a paper form that nobody can locate. Critically, CIS approval does not create the Acumatica customer — the prospect remains a lead until the first order is placed.

---

## 3. Module Objective

Pulse will provide a single CIS, credit, and onboarding-readiness system that will:

- issue a unique, secure, expirable digital CIS link from a qualified lead
- let a prospect complete and submit a structured CIS package, with save-as-draft, on any device
- give Sales/BD an embedded review-and-sign-off workspace inside the lead record
- route a clean review package to finance and capture a structured credit decision
- track the package through one governed lifecycle with a full audit trail
- support a scanned / handwritten CIS fallback that is reviewed by a human before it touches CRM truth
- keep raw card, CVV, and bank-account data outside Pulse at all times
- keep the lead a lead until the approved first-order activation boundary is reached
- give leadership reliable visibility into CIS turnaround, finance queue depth, and onboarding readiness

---

## 4. Scope Statement

### 4.1 Pulse Will Support

- generation of a unique digital CIS link per lead, with resend and copy-link support
- link expiry and revocation so stale or superseded links stop working
- a prospect-facing public CIS form (`/cis/[token]`) covering, in the approved prototype order:
  - company information (website, technician / install-truck / salesperson counts, affinity group or franchise, private-equity / parent-company context)
  - primary contact and owner / general manager
  - business information as registered (legal name, physical and billing address, company phone, type of business, time in business)
  - ordering contact and accounts-payable contact
  - preferred payment method (Net 30 / ACH-EFT / Credit Card on file)
  - a Section 2 authorization block with an explicit accuracy-and-authorization acknowledgement (e-signature checkbox)
- prospect save-draft and submit, with the package locking on submit
- an internal Sales/BD CIS workspace embedded in the lead record, structured as three steps:
  - Step 1 — send and track the CIS link
  - Step 2 — review the returned package in read-only tabs (Company & Contacts, Ordering & AP, Payment & Signature)
  - Step 3 — record internal review notes, sign off, and submit a clean package to finance
- a finance decision capability covering approve, approve-with-conditions, request-more-information, and decline
- credit line amount and payment terms (Net 30 / Net 60 / COD / Custom) captured on approval
- a finance decision queue (`/leads/finance`) that filters by decision status and surfaces every package awaiting submission or decision
- a scanned-CIS fallback lane: register a scanned/handwritten CIS, review extracted fields, and apply approved non-payment fields into the canonical CIS record
- field-level review of scanned content, with payment-sensitive fields stripped and flagged rather than written to CRM truth
- a 9-state package lifecycle with lead-stage interlock (`cis_sent` on first send; `cis_signed` only after Sales sign-off)
- discovery gating so a CIS cannot be sent before discovery is complete
- role-based visibility, including restriction of payment and accounts-payable detail to finance-enabled roles
- an immutable event trail for every CIS state transition and finance action

### 4.2 This PRD Will Also Cover

- how the prospect → Sales/BD → finance handoff stays inside one record instead of three disconnected tools
- where the PCI / payment boundary sits and what Pulse will and will not store
- how a coherent interim card-on-file experience will behave while hosted tokenized capture is parked
- how the scanned-CIS fallback becomes a real human-reviewed lane rather than a raw-data entry surface
- what Dynamic AQS needs to confirm before CIS scope is locked

### 4.3 Later-Phase / Separate Decision Items

These items remain part of the broader Pulse vision, but require later approval or a separate dependency decision and are not assumed finalized by this PRD:

- final e-signature vendor selection and signing automation beyond captured acknowledgement metadata
- final payment provider and hosted tokenized capture runtime (eBizCharge / Moneris)
- raw payment-instrument storage and any change to the current no-raw-card-data boundary
- production OCR / vision extraction engine and binary object storage for uploaded scans
- Acumatica credit / AR writeback, and Acumatica customer creation on first order
- finance SLA escalation automation
- shared-mailbox ingestion of returned CIS documents

---

## 5. Primary Future-State User Journeys

### 5.1 Journey A — Sales/BD Sends A CIS From A Qualified Lead

1. A Sales/BD user opens a lead that has completed discovery.
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
4. On approval, finance sets a credit line amount and payment terms; on conditional or info-requested, finance records what is still needed.
5. Pulse records the decision immutably, advances the package, and returns control to Sales/BD where follow-up is required.

### 5.5 Journey E — Scanned / Handwritten CIS Comes Back Instead

1. A prospect returns a scanned or handwritten CIS rather than completing the digital link.
2. An internal user registers the scanned document against the lead, creating or reusing the CIS package.
3. Pulse creates a review-first parsed draft and presents the extracted non-payment fields for human review.
4. Any payment-sensitive content is flagged and held out of the canonical CIS record.
5. The reviewer applies the approved non-payment fields into the canonical CIS data, then the package rejoins the standard review and finance path.

### 5.6 Journey F — Credit Approval Without Customer Creation

1. Finance approves credit and records the line and terms.
2. Pulse keeps the record as a lead and does not create an Acumatica customer at this point.
3. Onboarding-readiness context (credit approved, terms, portal-readiness signals) is tracked against the lead.
4. The Acumatica customer is created only at the approved first-order activation boundary, consistent with the Leads module.

---

## 6. Functional Capabilities

### 6.1 CIS Link Issuance And Tracking

Pulse will:

- generate a unique, tokenized CIS link per lead and per onboarding attempt
- support resend (fresh link) and copy-link actions for manual delivery
- expire links after a configured window and allow revocation
- record send count, last-sent time, and expiry on the package
- gate issuance behind discovery completion and an active lead lifecycle

### 6.2 Prospect Digital CIS Form

Pulse will:

- present the approved sectioned form layout, with the payment section separated from general company data
- preserve the prototype's field grouping and section order
- support save-draft and submit, locking the package on submit
- enforce a complete US state and territory picker for physical and billing addresses (see BR-CIS-09)
- capture a Section 2 authorization acknowledgement with signature metadata (timestamp)
- clearly distinguish CIS submission from any card-on-file authorization state (see 6.6)

### 6.3 Internal Review And Sign-Off

Pulse will:

- present the returned package in read-only review tabs inside the lead record
- restrict payment and accounts-payable detail to finance-enabled roles
- capture Sales/BD review notes and a finance cover note
- record an auditable Sales/BD sign-off that advances the lead to `cis_signed`
- submit a clean package to finance as a single governed action

### 6.4 Finance Decision And Queue

Pulse will:

- present a finance queue filterable by decision status (awaiting submission, pending, info requested, approved, conditional, declined)
- support four decision outcomes: approve, approve-with-conditions, request-more-information, decline
- capture credit line amount and payment terms (Net 30 / Net 60 / COD / Custom) on approval
- capture decision notes and, for conditional / info-requested outcomes, the specific information still needed
- log every finance decision immutably with actor, outcome, terms, and timestamp
- support finance reviewers acting closer to the queue rather than only deep-linking into the lead (see Q-CIS-05)

### 6.5 Scanned / Handwritten CIS Fallback

Pulse will:

- let an internal user register a scanned or handwritten CIS document against a lead
- create a review-first parsed draft kept separate from the canonical CIS record
- present extracted non-payment fields for human review and field-level confirmation before apply
- detect and flag payment-sensitive content and keep it out of canonical CIS data
- apply only reviewed, approved non-payment fields into the canonical CIS record
- present this lane as a guided review surface, not a raw-JSON or parser-internals entry form (see A-CIS-04)

### 6.6 Payment Boundary And Interim Card-On-File

Pulse will:

- store business-review data (preferred payment method, authorization state) inside the CRM
- keep raw card number, CVV, ACH routing number, and ACH account number outside Pulse at all times
- hold tokenized references only, via `CisPaymentVaultReference` (package level) and `AccountPaymentVaultReference` (account level)
- present one coherent interim card-on-file message: the current CIS requires a card on file for all accounts, Pulse records the authorization intent, and hosted tokenized capture is pending Dynamic AQS's revised flow (see Q-CIS-02)
- not launch or record eBizCharge / Moneris capture from the CIS package until the hosted capture runtime is approved

### 6.7 Lifecycle, Audit, And Visibility

Pulse will:

- maintain a 9-state package lifecycle: `not_sent` → `link_sent` → `draft_in_progress` → `submitted` → `review_in_progress` → `sales_signed_off` → `finance_pending` → `finance_approved` | `finance_declined` → `completed`
- support the scanned-PDF fallback as an alternate entry into the same review and finance path
- keep the lead-stage interlock (`cis_sent` on first send, `cis_signed` only after Sales sign-off)
- record an immutable event for every state transition and finance action
- surface package status, send count, finance status, payment method, and card-on-file state on the lead workspace
- feed CIS turnaround, finance queue depth, and onboarding-readiness signals into leadership reporting

---

## 7. Business Rules Pulse Will Enforce

| # | Rule |
|---|---|
| BR-CIS-01 | A CIS cannot be sent until discovery is complete and the lead lifecycle is active. |
| BR-CIS-02 | A prospect remains a lead through CIS, credit approval, and onboarding; the Acumatica customer is created only at the approved first-order activation boundary. |
| BR-CIS-03 | Raw card number, CVV, ACH routing number, and ACH account number will never be stored in Pulse; only tokenized references and authorization state are kept. |
| BR-CIS-04 | Submitting the digital CIS locks the package; further prospect edits require a new or reissued link. |
| BR-CIS-05 | The lead stage advances to `cis_sent` when the link is first sent and to `cis_signed` only after Sales/BD sign-off, never on prospect submission alone. |
| BR-CIS-06 | A package reaches finance only after a recorded Sales/BD sign-off. |
| BR-CIS-07 | Payment-method and accounts-payable detail is visible only to finance-enabled roles. |
| BR-CIS-08 | On the scanned-CIS fallback, payment-sensitive fields are flagged and excluded from canonical CIS data; only reviewed non-payment fields can be applied. |
| BR-CIS-09 | The CIS address pickers will offer the complete set of US states and recognized territories, not a partial list. |
| BR-CIS-10 | Card-on-file messaging will be internally consistent: where a card on file is required, the CIS will present one coherent authorization-intent state rather than asserting capture that does not occur. |
| BR-CIS-11 | Every CIS state transition and finance decision is recorded immutably with actor, outcome, and timestamp. |
| BR-CIS-12 | Custom payment terms must carry a documented justification so non-standard terms remain auditable. |

---

## 8. Data And Integration Highlights

At business level, this module will depend on and feed the following:

| Area | Proposed Pulse Role |
|---|---|
| Leads | Pulse will issue the CIS from a qualified lead and keep the record a lead through credit approval and onboarding |
| Accounts / Contacts | Pulse will carry CIS-captured people forward into account contacts at customer conversion |
| Finance / Credit | Pulse will route a clean package and capture credit decisions, line, and terms |
| Email service | Pulse will deliver and resend the CIS link (provider path to be confirmed) |
| E-signature | Pulse will capture authorization acknowledgement metadata now; vendor automation is a later decision |
| Payment provider | Pulse will hold tokenized references only; hosted capture runtime is a later decision |
| OCR / vision + storage | Pulse will support a reviewed parse lane; the production engine and object storage are later decisions |
| Acumatica | Pulse will defer credit / AR writeback and customer creation to a separate certified integration |
| Reporting | Pulse will feed CIS turnaround, finance queue depth, decision outcomes, and onboarding readiness |

---

## 9. Assumptions To Confirm

| # | Assumption | Why It Matters |
|---|---|---|
| A-CIS-01 | The CIS is sent only after discovery is complete, with no general pre-discovery send path. | This determines the gate on link issuance and where CIS sits in the lead lifecycle. |
| A-CIS-02 | Sales/BD sign-off is a required step before any package reaches finance. | This protects finance from incomplete packages and defines the `cis_signed` interlock. |
| A-CIS-03 | A card on file is required for all accounts as the current business rule, even while hosted capture is parked. | This drives the interim card-on-file UX and the eventual capture integration. |
| A-CIS-04 | The scanned-CIS fallback is a human-reviewed lane, and prospects are never asked to interact with parser internals. | This determines whether the fallback is a safe review surface or an accidental raw-data path. |
| A-CIS-05 | Raw card and bank data stays outside Pulse, and only tokenized references plus authorization state are stored. | This defines the PCI boundary and what the eventual provider integration is allowed to write. |
| A-CIS-06 | Credit approval does not create the Acumatica customer; first order remains the activation boundary. | This affects CRM/ERP handoff timing and avoids premature customer records. |
| A-CIS-07 | Finance decision outcomes are approve, conditional, info-requested, and decline, with line and terms captured on approval. | This determines the finance workspace, queue states, and downstream readiness signals. |

---

## 10. Open Questions For Dynamic AQS Decision

| # | Question | Options To Confirm | Why Decision Is Needed |
|---|---|---|---|
| Q-CIS-01 | What is the final e-signature approach for the CIS authorization block? | captured acknowledgement metadata only / dedicated vendor (DocuSign, etc.) / hybrid | This affects legal sufficiency, the prospect experience, and integration scope. |
| Q-CIS-02 | What is the final card-on-file capture model, and when does it run? | hosted capture during CIS / separate post-approval step / provider-of-record per region | This sets the interim UX, the PCI boundary, and the eventual capture integration. |
| Q-CIS-03 | When should the prospect learn their approved credit line and terms? | immediately by Pulse / Sales/BD relays personally first / configurable by role | This affects notification design and the BD relationship workflow. |
| Q-CIS-04 | What is the finance decision SLA, and should breaches escalate automatically? | informal target only / tracked timer / auto-escalation to finance leadership | This determines queue timers, alerting, and escalation automation scope. |
| Q-CIS-05 | How much should finance be able to act directly from the queue? | decide inline in the queue / open lead then act / quick-actions with full detail on open | This changes the finance workspace and how fast decisions can be recorded. |
| Q-CIS-06 | Does the card-on-file requirement have exceptions? | applies to all / ACH-only or institutional exceptions / region-specific | This affects validation, the interim message, and downstream credit handling. |
| Q-CIS-07 | Is a Canada CIS variant in this scope, or a later phase? | same form with conditional fields / separate flow / later phase | This affects address, tax-ID, processor, and signature-framework handling. |

---

## 11. Later-Phase / Separate Decision Items

These items may still belong in the broader Pulse roadmap, but will not be assumed as finalized by this PRD:

- final e-signature vendor integration and signing automation
- final payment provider and hosted tokenized capture runtime (eBizCharge / Moneris)
- raw payment-instrument storage or any relaxation of the no-raw-card-data boundary
- production OCR / vision extraction engine and binary object storage for scans
- Acumatica credit / AR writeback and customer creation at first order
- finance SLA escalation automation and finance dashboard depth
- shared-mailbox ingestion of returned CIS documents
- automated onboarding checklist, portal provisioning, and training generation beyond credit-readiness signals
- Canada CIS variant and its distinct legal / processor framework

---

## 12. Approval Checklist

Dynamic AQS approval of this PRD will confirm:

- the prospect → Sales/BD → finance handoff is modeled correctly and stays inside one record
- the 9-state lifecycle and the `cis_sent` / `cis_signed` interlock reflect the intended process
- the PCI / payment boundary is framed correctly and the interim card-on-file behavior is acceptable
- the scanned-CIS fallback is correctly scoped as a human-reviewed, payment-safe lane
- the credit-approval-without-customer-creation boundary is correct
- the open questions capture the real business decisions still needed

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
| UX-CIS-001 | US territories (PR, VI, GU, AS, MP) missing from state dropdown (BR-CIS-09) | CisPublicForm.tsx | Yes | Open |
| UX-CIS-002 | No "card on file required" explanatory copy in payment section | CisPublicForm.tsx | Yes | Open |
| UX-CIS-003 | No "progress saved" banner or return-link on draft CIS form | CisPublicForm.tsx | Yes | Open |
| UX-CIS-004 | No CIS link expiry date displayed and "Resend fresh link" CTA absent | LeadCisPanel.tsx | Yes | Open |
| UX-CIS-005 | decisionNotes not required for conditional / info-requested outcomes (BR-CIS-12) | LeadCisPanel.tsx | Yes | Open |
| UX-CIS-006 | creditLine amount not required when finance decision = approved | LeadCisPanel.tsx | Yes | Open |

### Sprint 2 — Core Workflow (M effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-CIS-007 | Scanned CIS upload flow incomplete — no file upload and parsed-field review modal (A-CIS-04) | LeadCisPanel.tsx | Yes | Done |
| UX-CIS-008 | Finance queue has no inline approve/decline/request-info quick actions (Q-CIS-05) | LeadFinanceQueue.tsx | Yes | Done |
| UX-CIS-009 | No 9-state badge progression stepper in CIS panel | LeadCisPanel.tsx | Yes | Done |

_To be completed during the review meeting._
