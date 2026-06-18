# Pulse Platform — Accounts / Customers / Contacts / Multi-Location Module PRD

## Document Control

| Field | Value |
|---|---|
| Version | 2.1 |
| Date | 2026-06-18 |
| Status | Scope-accuracy correction (2026-06-18): FR-ACC-005's account-home-tabs source line (Rick Cardinale) marked as a paraphrased composite rather than a verbatim quote; the Profile/Training/Sales tab substance stays supported. Builds on v2.0's enrichment pass |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS sales leadership, Strategic Growth team, operations lead, finance lead, customer setup stakeholder |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, `01_LEADS_PRD.md`, `03_TERRITORY_PRD.md`, `05_CONSIGNMENT_PRD.md`, Training PRD, CIS / Finance / Onboarding PRD, Dealer / Portal PRD |
| Enrichment note | Version 2.0 folds in full meeting traceability, a source inventory table, FR/NFR/ASM/OQ tables with SRC citations and build status. All BR-/Q-/UX-GAP IDs from v1.0 are preserved verbatim. |

---

## Scope corrections (2026-06-18)

The following LOW-severity scope-accuracy correction was applied after the program-wide re-check of client-attributed quotes against the cited meeting transcripts. No rows were deleted; substance is unchanged.

- **FR-ACC-005 — the Rick Cardinale account-home-tabs source line is a paraphrase, not a verbatim quote.** The cited line *"the home page of an account — Profile tab; training tab; sales tab"* is a paraphrased composite of the Session-4 discussion rather than an exact transcript quote. The substance it supports — that the account home presents Profile / Training / Sales tabs — **is** supported by the session; only the verbatim-quote framing is corrected.

Full audit: `docs/SCOPE_ACCURACY_AUDIT_2026-06-18.md`.

---

## Meeting Traceability

| Session | Date | File | Key speakers | Topics relevant to this module |
|---|---|---|---|---|
| Session 2 — As-Is CRM walkthrough | 2026-02-18 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md` | Adrienne Cardinale, Michelle Hogan, C G (Curry), Dan Harshbarger, Ahmad Hassan | Manual account creation in Dynamics CRM, affinity/ownership groups, lead-to-customer graduation ("first order"), required fields, payment terms, credit card on CIS, CRM vs ERP gap, pricing attribution |
| Session 4 — TM/Field walkthrough | 2026-02-24 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md` | C G, Don Hearn, Dan Harshbarger, Michelle Hogan, Rick Cardinale (Adrienne), Ahmad Hassan | Account ownership transfer, note authorship on reassignment, contact hierarchy (management vs technicians), sales history on account, single account owner policy, split commissions in Acumatica, CRM as customer contact source of truth |
| As-Is customer setup SOP | undated | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asiscustomerdocuments/Adding a customer.docx.md` | Ops/Customer-service team | Step-by-step customer entry in Dynamics CRM and Acumatica; contact roles (ordering/Purchaser, primary, Shopify); billing vs shipping address; payment terms and credit approval workflow; onboarding checklist stages; affinity group and brand label attributes in Acumatica |

---

## Source Inventory

| ID | Absolute path | What it sourced |
|---|---|---|
| SRC-ACC-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md` | Lead-to-account graduation trigger (first order), affinity group as required field, ownership group field, manual account creation pain, CRM vs Acumatica duplication, phone/email mandatory on lead/account, credit card handling, pricing driven by affinity/ownership |
| SRC-ACC-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md` | Account ownership reassignment preserving note authorship, single account owner policy, contact list hierarchy (management before technicians), TM account overview, sales history / buying-trend visibility on account, SGT vs TM ownership routing |
| SRC-ACC-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asiscustomerdocuments/Adding a customer.docx.md` | Credit approval pre-step before adding customer; CRM fields (business unit, account name, private equity, affinity group, phone, website, shipping/billing address, initial contact date/by, marketing source, credit limit); second-bar fields (number of trucks, account status = onboarding, contacts, primary contact, CIS attachment); contact fields (first/last name, job title, owner, Shopify invite date, email, mobile); Acumatica fields (customer class, payment terms, statement cycle, restrict visibility, credit verification, price class, tax zone, warehouse, ship via, shipping terms, payment method, salesperson, attributes incl. affinity group and brand label) |

> Note: All three sources were readable as .md equivalents. No source was unreadable.

---

## 1. Document Control

*(Preserved from v1.0 above.)*

---

## 2. Executive Summary

The Accounts module will be the operational customer record at the centre of Pulse CRM — the place where a dealer, distributor, or contractor relationship lives once it becomes real business. An account will not be typed in by hand. It will be born when a qualified lead reaches the first-order activation boundary, carrying its source-lead lineage forward so Dynamic AQS can always trace a customer back to where the relationship started. From that point the account becomes the single profile for territory ownership, contacts, operating locations, dealer-portal access, training history, consignment participation, account readiness, and tokenized payment references. The goal of this module is to give Dynamic AQS one governed account truth — owned by the CRM for relationship and operational data — instead of a customer identity scattered across HubSpot, Dynamics, Shopify, spreadsheets, and Acumatica. Financial truth (orders, invoices, balances, pricing) stays in Acumatica by design; Pulse will own the relationship, the people, the places, and the lifecycle around it.

---

## 3. Module Objective

Pulse will provide a single account management system that will:

- create accounts only at the approved first-order activation boundary, never by ad-hoc manual entry
- preserve source-lead lineage so every customer traces back to its originating lead
- present one account workspace covering profile, contacts, locations, readiness, training, consignment, dealer portal, activity, and payment references
- manage multiple contacts per account with governed roles and a protected primary contact
- manage multiple operating locations per account with billing-versus-shipping semantics and shipping-centre context
- enforce a governed lifecycle (Active / At Risk / Inactive / Churned) with reasons and audit
- carry territory and owner assignment forward from the lead and support governed reassignment
- keep raw payment-card data out of Pulse, storing only tokenized vault references
- give back-office reviewers a controlled path to turn mobile field notes into account activity
- give leadership reliable visibility into account health, ownership, and follow-up discipline

---

## 4. Scope Statement

### 4.1 In Scope — Pulse Will Support

- account creation at the first-order activation boundary, carried forward from the converting lead with full `sourceLeadId` lineage
- restricted manual account creation limited to a SUPER_ADMIN bootstrap / migration path (not a routine sales action)
- an account directory with a "Needs follow-up" next-action queue and an "All accounts" directory view
- account search by display name, legal name, and account number, with lifecycle filtering (Active / At Risk / Inactive / Churned)
- an account detail workspace with primary Profile, Contacts, and Locations tabs plus a "More" drawer for account readiness, consignment, activity and documents, payment methods, training, and dealer portal
- editable operational profile fields (display name, legal name, account type, brand / private label, record-active state)
- a governed account lifecycle state machine with operator-entered reasons and lifecycle audit (changed-at, last order, last engagement, reason note)
- multiple contacts per account with create / edit / soft-deactivate / reactivate, a protected primary contact, optional location linkage, and optional dealer-portal-user provisioning
- multiple operating locations per account with create / edit / soft-deactivate / reactivate, primary-location handling, and US/Canada address capture
- territory, region, shipping-centre, TM, and RD ownership display carried forward from the lead, with assignment-method visibility
- tokenized payment-method references (provider, vault token, vault customer reference, external payment-method reference, masked last-4, brand, billing ZIP, default flag, active flag) — references only, never raw card data
- a back-office Field Activity Review queue that turns mobile voice notes into reviewed account / lead / training / consignment activity with optional governed follow-up creation
- an account readiness view and day-one handoff checklist that separates Pulse-owned actions from parked external dependencies
- role-based visibility and edit governance across Super Admin, Executive, Sales Leadership, Sales/BD, TM, RD, Admin/Ops, and Finance

### 4.2 Out of Scope / Parked Dependencies

These items remain part of the broader Pulse vision but require a later approval or a separate dependency decision:

- **Acumatica financial truth** — orders, invoices, shipments, payments received, AR balances, credit limits, revenue, pricing, and live inventory stay in Acumatica; Pulse will display read-only once the certified integration boundary is live
- **Acumatica customer ID and bidirectional sync** — creation payload, sync status badges, manual re-sync — parked until the Acumatica boundary, endpoints, and field mappings are available
- **Raw payment-card / bank data** — permanently out of Pulse; capture stays in Moneris / eBizCharge hosted vaults; Pulse holds tokenized references only
- **HubSpot historical lead/customer data migration** mechanics and cutover timing
- **Mailbox / correspondence ingestion** (email threads auto-attached to the account timeline)
- **Order-driven lifecycle automation** (automatic At Risk / Inactive / Churned aging) — depends on a live order signal
- **Month-over-month sales-trend charting** — depends on Acumatica order history being live
- **Parent / child account hierarchy** and multi-entity rollup reporting
- **Dealer-group and price-class resolution display** (Affinity + Ownership + Region → Dealer Group → Price Class) — depends on finance pricing rules and the pricing boundary
- **Twenty-year QuickBooks / Azure historical sales import** onto the account
- **Rebate and discount engine in Pulse** — acknowledged as complex; parked in Acumatica until a separate decision is made (SRC-ACC-001: Dan — "I wouldn't focus on it — it's gonna derail us")

---

## 5. Primary Future-State User Journeys

### 5.1 Journey A — A Qualified Lead Becomes An Account On First Order

1. A lead completes discovery, CIS, and onboarding readiness inside the Leads module.
2. Pulse confirms the first-order activation event for that lead.
3. Pulse creates the account from the lead backbone and stamps `sourceLeadId` so the lineage is permanent.
4. Territory, region, shipping centre, TM/RD assignment, known contacts, and known locations carry forward from the lead and readiness data.
5. The account enters the directory in an Active lifecycle state, with a readiness view showing what is ready now versus parked.
6. The originating lead remains available as historical pipeline evidence and is never deleted.

### 5.2 Journey B — A Rep Works The Account Follow-Up Queue

1. A sales or operations user opens Accounts and lands on the "Needs follow-up" queue.
2. Pulse surfaces accounts that need risk review, territory assignment, a first contact, or a first location, each with a plain next-action label.
3. The user opens an account, resolves the next action (adds a contact, adds a location, assigns territory, or reviews risk), and the account drops out of the follow-up queue.
4. When looking up a known account instead, the user switches to "All accounts" and searches by name, legal name, or account number.

### 5.3 Journey C — Maintaining Contacts For A Multi-Person Account

1. A user opens the Contacts tab on an account.
2. The user adds the people who matter — primary, owner/GM, ordering, billing, accounting/AP, technical — with name, title, email, phone, mobile, role, and optional linked location.
3. Pulse protects the primary contact: the sole primary cannot simply be removed without designating a replacement.
4. When a person leaves, the user soft-deactivates the contact so activity and training history stay intact rather than deleting the record.
5. Where appropriate, a contact is provisioned as a dealer-portal user from the same account context.

### 5.4 Journey D — Maintaining Operating Locations

1. A user opens the Locations tab on an account.
2. The user adds operating locations with US/Canada address detail, names each location, and marks the primary operating site.
3. The user distinguishes where product ships from where the account is billed, so shipping and billing are not assumed to be the same place.
4. Closed or relocated sites are soft-deactivated, preserving location history and any linked activity.

### 5.5 Journey E — Governing The Account Lifecycle

1. A user reviews an account whose engagement has lapsed or whose relationship status has changed.
2. The user transitions the lifecycle — Active, At Risk, Inactive, or Churned — through governed actions.
3. Pulse requires a reason note where the transition is consequential (for example, confirming churn) and records who changed it and when.
4. Lifecycle state stays separate from the archive/record-active flag so operating risk and churn remain visible without hiding the record.

### 5.6 Journey F — Back-Office Review Of A Field Note Into Account Activity

1. A field user captures a voice note on mobile against an account, lead, training session, or consignment site.
2. The note lands in the back-office Field Activity Review queue as pending review.
3. A reviewer reads the raw transcript, edits the structured summary, follow-up, sentiment, and tags, and decides whether to approve or reject.
4. On approval, Pulse writes the reviewed note as account activity and optionally creates a governed follow-up (such as a training or consignment work item) — nothing is written to the account from the field without back-office review.

### 5.7 Journey G — Registering A Tokenized Payment Reference

1. Finance captures or approves a payment instrument in the hosted Moneris / eBizCharge vault, outside Pulse.
2. An authorized finance user opens the account's payment-methods drawer and registers the provider reference (`tok_…`, `cust_…`, `pm_…`) plus masked descriptors (last-4, brand, billing ZIP).
3. Pulse stores references and masked descriptors only and never accepts a raw card or bank number.
4. The user sets the default method and can deactivate or reactivate references as billing arrangements change.

### 5.8 Journey H — Bootstrap / Migration Account Creation (Restricted)

1. During initial data load or migration, a SUPER_ADMIN uses the restricted account-creation path.
2. Pulse treats this as a bootstrap/migration action, not a routine sales workflow, and keeps it isolated from normal account intake.
3. Once migration tooling is finalized, this path is intended to be removed or further isolated so that first-order conversion remains the only routine way an account is born.

---

## 6. Functional Capabilities

### 6.1 Account Origination And Lineage

Pulse will:

- create an account only at the approved first-order activation boundary, never through routine manual entry
- restrict manual account creation to a SUPER_ADMIN bootstrap / migration path that is isolated from normal intake
- stamp and preserve `sourceLeadId` so every account traces back to its originating lead
- carry forward territory, region, shipping centre, TM/RD assignment, contacts, and locations from the lead and readiness data
- keep the originating lead intact as historical pipeline evidence after activation

### 6.2 Account Directory And Search

Pulse will:

- present a "Needs follow-up" next-action queue alongside an "All accounts" directory view
- compute follow-up reasons (At Risk status, missing territory, no contacts, no locations) and show a plain next-action label per account
- support search by display name, legal name, and account number, and filtering by lifecycle state
- surface owner, territory, contact count, location count, lifecycle, and last-updated context in the directory
- provide summary counts (At Risk, territory-assigned, lead-sourced, active) for managers

### 6.3 Account Workspace And Profile

Pulse will:

- present one account workspace with primary Profile, Contacts, and Locations tabs and a "More" drawer for readiness, consignment, activity and documents, payment methods, training, and dealer portal
- show an account focus panel (who to contact, where they operate, profile readiness) and a day-one handoff checklist
- support editing of operational profile fields: display name, legal name, account type, brand / private label, and record-active state
- display territory ownership (territory, region, shipping centre, TM, RD, assignment method)
- keep external financial, order, and pricing context visibly parked until the Acumatica boundary is live

### 6.4 Contact Management

Pulse will:

- support multiple contacts per account with create, edit, soft-deactivate, and reactivate
- capture name, title, email, phone, mobile phone, role, primary flag, active flag, and optional linked location
- protect the primary contact so the sole primary is not removed without a designated replacement
- preserve activity and training references when a contact is deactivated rather than deleted
- support provisioning a contact as a dealer-portal user from the account context
- move contact role from free text toward a governed role catalogue (see business rules and open questions)
- display management contacts ahead of technician contacts in the contact list

### 6.5 Multi-Location Management

Pulse will:

- support multiple operating locations per account with create, edit, soft-deactivate, and reactivate
- capture location name, reference code, address (line 1/2, city, state, postal code, country), primary flag, and active flag for US and Canada
- support primary-location handling and preserve location history on deactivation
- express billing-versus-shipping semantics as first-class location intent rather than relying on a single primary flag (see open questions)
- carry shipping-centre context forward and keep territory propagation clean as location logic deepens

### 6.6 Lifecycle Governance

Pulse will:

- maintain a governed lifecycle state machine: Active, At Risk, Inactive, Churned
- support operator-driven transitions with reason notes, requiring a reason on consequential transitions such as confirming churn
- record lifecycle audit (status, changed-at, last order, last engagement, reason note) and who made the change
- keep lifecycle state separate from the archive/record-active flag
- support order-driven lifecycle automation later, once a live order signal exists (parked)

### 6.7 Payment References (Tokenized Only)

Pulse will:

- store tokenized payment references and masked descriptors only — provider, vault token, vault customer reference, external payment-method reference, last-4, brand, billing ZIP, default flag, active flag
- reject any attempt to enter raw card numbers, bank account numbers, or unmasked credentials
- support promoting a CIS-captured vault reference and registering provider references manually
- support a single default method per account and active/inactive state per reference

### 6.8 Field Activity Review And Operational Visibility

Pulse will:

- provide a back-office review queue for mobile voice notes targeting accounts, leads, training sessions, or consignment sites
- let reviewers edit structured summary, follow-up, sentiment, and tags, and approve or reject before anything becomes account activity
- write reviewed notes as account activity and optionally create a governed follow-up on approval
- present recent account activity (account, contact, location, dealer-access, payment, and source-lead updates) and available document boundaries
- provide an account readiness score and checks (territory, dealer membership, source lineage, external activity) that separate Pulse-owned actions from parked dependencies

---

## 7. Functional Requirements

> Build status key: **Built** = API + UI both shipped; **Partial** = API or UI only, or known gap; **Not-built** = in-scope, not yet implemented; **Parked** = blocked on Acumatica / payment vault / external dependency.

### FR-ACC-001 — Account Origination (Lead Conversion Only)

| Field | Value |
|---|---|
| Statement | When a lead reaches the first-order activation boundary, Pulse shall create an account record carrying `sourceLeadId`, territory, contacts, and locations forward from the lead without requiring re-entry. |
| Acceptance criteria | (1) Account record is created with `sourceLeadId` populated. (2) Territory, region, shipping centre, TM/RD assignment carry forward. (3) Known contacts and locations from lead data are present on the new account. (4) The originating lead record is preserved and not deleted. |
| Priority | P0 |
| Build status | **Built** — `createAccount` in `service.ts` stamps `sourceLeadId`; `CustomerOverview.tsx` links back to lead; lead preservation confirmed. |
| Sources | SRC-ACC-001 (Adrienne: "graduate them to customer"; Michelle: "once they place an order… graduate"; Ahmad confirms first-order trigger), SRC-ACC-002 (CG: "trigger where it becomes the territory manager's responsibility is [the first order]") |

### FR-ACC-002 — Restricted Manual Account Creation (Bootstrap Path)

| Field | Value |
|---|---|
| Statement | Pulse shall restrict manual account creation to a SUPER_ADMIN role only, isolated from normal sales intake, and shall not expose a general "Create account" action to Sales, TM, or BD roles. |
| Acceptance criteria | (1) Only SUPER_ADMIN can call the manual create path. (2) Account created manually is flagged as bootstrap-origin. (3) Sales/TM/BD roles cannot reach the create path. |
| Priority | P0 |
| Build status | **Built** — `createAccount` checks role; route guarded in `http.ts`. |
| Sources | SRC-ACC-001 (CG/Michelle: accounts are people who buy from them, not ad-hoc entries), SRC-ACC-003 (SOP describes customer service team entering accounts; not a self-service sales action) |

### FR-ACC-003 — Account Directory — Follow-Up Queue and All-Accounts View

| Field | Value |
|---|---|
| Statement | Pulse shall present an account directory with a "Needs follow-up" queue (accounts requiring attention) and an "All accounts" directory view with search and lifecycle filtering. |
| Acceptance criteria | (1) "Needs follow-up" queue surfaces accounts with At Risk status, missing territory, zero contacts, or zero locations, each with a plain next-action label. (2) "All accounts" view supports search by display name, legal name, account number. (3) Lifecycle filter (Active / At Risk / Inactive / Churned) is available. (4) Directory shows owner, territory, contact count, location count, lifecycle, last-updated. (5) Summary counts (At Risk, territory-assigned, lead-sourced, active) visible. |
| Priority | P0 |
| Build status | **Built** — `CustomerList.tsx` ships both `follow_up` and `all` view modes; `accountNeedsAttention` and `accountNextAction` helpers; `listAccounts` supports `lifecycleStatus` filter and pagination. |
| Sources | SRC-ACC-002 (Ahmad: "where is that pipeline where you guys can see the stage of the lead"), SRC-ACC-001 (Adrienne: "there's no quick button to make a change just right here in this page") |

### FR-ACC-004 — Account Search

| Field | Value |
|---|---|
| Statement | Pulse shall support searching accounts by display name, legal name, and account number, returning paginated results. |
| Acceptance criteria | (1) Search matches partial strings on display name, legal name, and account number. (2) Results paginate with configurable page size (≥ 50 rows). |
| Priority | P0 |
| Build status | **Built** — `listAccounts` accepts `search` param; `CustomerList.tsx` debounced search input; page size 50. |
| Sources | SRC-ACC-001 (filter-by account name in legacy Dynamics CRM; CG needs quick snapshot) |

### FR-ACC-005 — Account Workspace — Tabs and Drawer

| Field | Value |
|---|---|
| Statement | The account workspace shall present primary Profile, Contacts, and Locations tabs and a "More" drawer containing account readiness, consignment, activity and documents, payment methods, training, and dealer portal panels, with deep-link URL support for each tab. — ⚠️ CORRECTED 2026-06-18: source line is a paraphrase, not a verbatim quote; substance supported. |
| Acceptance criteria | (1) Three primary tabs (Profile, Contacts, Locations) accessible by default. (2) "More" drawer exposes six secondary panels. (3) Active tab is preserved in URL query parameter `?tab=`. (4) Role-based visibility governs which panels are accessible per role. |
| Priority | P0 |
| Build status | **Built** — `CustomerDetail.tsx` resolves tabs from URL; `resolveCustomerSecondaryPanel` handles all six; UX-A-014 done. |
| Sources | SRC-ACC-002 (Rick Cardinale, *paraphrased composite — not verbatim*: account home page shows Profile / Training / Sales tabs), SRC-ACC-001 (Adrienne: "onboarding tab, contacts tab" in Dynamics) |

### FR-ACC-006 — Account Profile Fields

| Field | Value |
|---|---|
| Statement | The account profile shall capture and allow editing of: display name, legal name, business unit (Residential), account type, affinity group, ownership group (PE), private label / brand, website, number of trucks, marketing source, initial contact date/by, credit limit, record-active state, and lifecycle status. |
| Acceptance criteria | (1) All listed fields are editable by authorized roles. (2) Affinity group and ownership group are governed dropdown catalogues (not free text). (3) Marketing source is captured and displayed. (4) Record-active state is separate from lifecycle status. |
| Priority | P0 |
| Build status | **Built** (core fields); **Partial** — affinity group and ownership group are captured but the full governed catalogue reconciliation with Acumatica's attribute list is not yet verified as complete. |
| Sources | SRC-ACC-003 (SOP: business unit, account name, private equity, affinity group, company phone, website, shipping address, billing address, initial contact date/by, marketing source, credit limit, number of trucks, account status, brand label), SRC-ACC-001 (Adrienne: "affinity group, private equity, private label… drives what they have access to") |

### FR-ACC-007 — Source Lead Lineage Display

| Field | Value |
|---|---|
| Statement | The account profile shall display the `sourceLeadId` link so any user can navigate directly to the originating lead record. |
| Acceptance criteria | (1) Source lead link is visible on the account overview. (2) Link navigates to `/leads/{sourceLeadId}`. (3) If no source lead, a contextual placeholder is shown. |
| Priority | P1 |
| Build status | **Partial** — `CustomerOverview.tsx` renders source lead link when `account.sourceLeadId` is present; UX-A-008 confirmed as open (no placeholder shown when absent). |
| Sources | SRC-ACC-001 (Ahmad: "account is an account but it will graduate to a customer when they place their first order"), SRC-ACC-002 (Ahmad on permanent lineage traceability) |

### FR-ACC-008 — Contact Management — CRUD and Primary Protection

| Field | Value |
|---|---|
| Statement | Pulse shall support multiple contacts per account with create, edit, soft-deactivate, and reactivate. Exactly one contact shall be designated as primary, and the sole primary shall not be removable without designating a replacement. |
| Acceptance criteria | (1) Create/edit/soft-deactivate/reactivate contacts works for authorized roles. (2) Attempting to deactivate the sole primary contact is rejected unless a replacement primary is designated. (3) Contact list displays management contacts (primary, owner/GM, ordering) ahead of technicians. (4) Deactivated contacts remain visible with historical references intact. |
| Priority | P0 |
| Build status | **Built** — `createAccountContact`, `updateAccountContact`, `listAccountContacts` in `service.ts`; `CustomerContacts.tsx` present; primary protection logic in `ensurePrimaryActiveContact`. UX-A-005 (sole-primary removal guard) confirmed as Open — protection exists at API level; UI guard still open. |
| Sources | SRC-ACC-003 (SOP: add contacts, primary contact in first bar, add Shopify invite), SRC-ACC-002 (Don Hearn: "contacts in the account — you'll have 14 technicians before you get to the person you want — prioritize management to top") |

### FR-ACC-009 — Contact Roles — Governed Catalogue

| Field | Value |
|---|---|
| Statement | Contact roles shall use a governed catalogue (Primary, Owner/GM, Ordering/Purchaser, Billing, Accounting/AP, Technical) rather than free text, so downstream processes can rely on role values. |
| Acceptance criteria | (1) Role field presents governed dropdown options. (2) Legacy free-text roles are migrated or mapped on import. (3) Shopify portal contact eligibility is derivable from role = Ordering or Primary. |
| Priority | P1 |
| Build status | **Not-built** — UX-A-004 confirmed open; role is still free-text in `CustomerContacts.tsx`. |
| Sources | SRC-ACC-003 (SOP: "Who will be ordering contact's job title is Purchaser"; "Shopify invite sent date if they will be receiving an invite" — invites go to primary and ordering contacts), SRC-ACC-002 (Michelle on contact uploads weekly; cell phone tracking critical) |

### FR-ACC-010 — Multi-Location Management

| Field | Value |
|---|---|
| Statement | Pulse shall support multiple operating locations per account with create, edit, soft-deactivate, and reactivate. Each location shall capture name, address (US/Canada), primary flag, active flag, and optional location-type intent (billing vs shipping). |
| Acceptance criteria | (1) Create/edit/soft-deactivate/reactivate locations works for authorized roles. (2) Primary location is enforced (at most one primary among active locations). (3) Billing vs shipping intent is expressible per location. (4) Deactivated locations preserve historical activity and consignment linkage. |
| Priority | P0 |
| Build status | **Built** — `createAccountLocation`, `updateAccountLocation` in `service.ts`; `CustomerLocations.tsx` present; `ensurePrimaryActiveLocation` enforced. UX-A-012 done (name-prefix convention pending Q-A-02 schema decision). |
| Sources | SRC-ACC-003 (SOP: "shipping address, billing address if different from shipping"; Acumatica "override bill to address if different from shipping"; locations tab in Acumatica), SRC-ACC-001 (Adrienne: "shipping address, billing address if different" — captured in account form) |

### FR-ACC-011 — Account Lifecycle State Machine

| Field | Value |
|---|---|
| Statement | Pulse shall maintain a governed lifecycle state machine (Active / At Risk / Inactive / Churned) with operator-driven transitions, mandatory reason notes on consequential transitions, and a full lifecycle audit trail. |
| Acceptance criteria | (1) Valid transitions are enforced; invalid transitions are rejected. (2) Reason note is required on transitions to Inactive and Churned. (3) Audit trail records status, changed-at, changed-by, last order date, last engagement date, and reason note. (4) Lifecycle status is separate from the record-active flag. |
| Priority | P0 |
| Build status | **Partial** — `updateAccountLifecycle` and `validateAccountLifecycleTransition` are wired; UX-A-003 confirms reason is not yet required on At Risk / Inactive transitions (UI guard still open); UX-A-011 done (lifecycle audit surfaces from `activityReview.recentEvents`). |
| Sources | SRC-ACC-001 (Adrienne on changing "active" to "customer" for placed-order leads; Michelle: "graduated"), SRC-ACC-002 (CG: "we need to eliminate that [manual tracking] so that everybody's using the exact same program") |

### FR-ACC-012 — Note Authorship Preservation on Reassignment

| Field | Value |
|---|---|
| Statement | When an account's territory manager or owner is reassigned, all existing activity notes and timeline entries shall retain the original author identity and shall not be re-attributed to the new assignee. |
| Acceptance criteria | (1) Activity entries carry immutable `authorId` and `authorName` stamped at creation. (2) Reassigning account owner does not alter `authorId` on any prior entry. (3) New assignee sees prior entries with original author attribution. |
| Priority | P0 |
| Build status | **Built** — activity audit trail uses immutable author attribution; `buildAccountActivityReview` in `service.ts` preserves authorship from audit log. |
| Sources | SRC-ACC-002 (Don Hearn: "when I get fired, every note gets transferred to the new TM's name — all his previous notes are saying I put them in there. I have no idea [who actually did it] unless I look at the dates") |

### FR-ACC-013 — Territory and Owner Ownership Display

| Field | Value |
|---|---|
| Statement | The account profile shall display territory, region, shipping centre, TM, and RD assignment along with the assignment method, and shall support governed reassignment without rewriting prior activity authorship. |
| Acceptance criteria | (1) Territory, region, shipping centre, TM name, and RD name visible on account profile. (2) Assignment method label (e.g. "auto-assigned", "manual") shown. (3) Reassignment is logged as an audit event. (4) Prior note authorship is unchanged after reassignment (see FR-ACC-012). |
| Priority | P0 |
| Build status | **Built** — `CustomerOverview.tsx` displays territory info; `updateAccount` service handles territory. |
| Sources | SRC-ACC-002 (CG: "business development team assigns accounts; there'll always be one person who owns the account") |

### FR-ACC-014 — Tokenized Payment References

| Field | Value |
|---|---|
| Statement | Pulse shall store only tokenized payment references and masked descriptors per account. Pulse shall reject raw card numbers, bank account numbers, or unmasked credentials at every entry point. |
| Acceptance criteria | (1) Payment method form accepts provider, vault token, vault customer ref, external PM ref, masked last-4, brand, billing ZIP, default flag, active flag. (2) Input validation rejects entries containing 13–19 consecutive digits (raw card pattern). (3) A single default method is enforced per account. (4) Multiple payment methods per account are supported with active/inactive state. |
| Priority | P0 |
| Build status | **Built** — `createAccountPaymentMethod`, `updateAccountPaymentMethod`, `listAccountPaymentMethods` in `service.ts`; `CustomerPaymentMethods.tsx` present; `clearDefaultAccountPaymentMethods` / `ensureDefaultActiveAccountPaymentMethod` enforce single-default rule. UX-A-006 (masked last-4 / card brand visual display) still open; UX-A-013 (register vault reference create form) done. |
| Sources | SRC-ACC-001 (Michelle: "we cut off the credit card information… we get the information but we take a picture"; Dan: "we never charge credit card out of Shopify"), SRC-ACC-003 (SOP: payment methods — ACH, CCD, CHX; credit card users added to Acumatica discounts section) |

### FR-ACC-015 — Field Activity Review Queue

| Field | Value |
|---|---|
| Statement | Pulse shall provide a back-office Field Activity Review queue for mobile voice notes. Reviewers shall edit structured summary, sentiment, follow-up, and tags, then approve or reject. Only approved notes shall become account activity. |
| Acceptance criteria | (1) Queue lists pending voice notes with target entity (account / lead / training / consignment). (2) Reviewer can edit summary, sentiment, and tags before approving. (3) Approval writes a structured activity entry to the target account. (4) Rejection discards the note without writing to the account. (5) Optional governed follow-up (training, consignment work item) can be created on approval. |
| Priority | P1 |
| Build status | **Built** — `FieldActivityReview.tsx` ships; `fetchFieldActivityReviewQueue`, `reviewFieldActivityVoiceNote` wired; `mobile-voice-notes` API module present. UX-A-007 (FieldActivityReview not linked from account detail workspace) still open. |
| Sources | SRC-ACC-002 (Ahmad: "16-hour loss annually per user just because of this manual fatigue"; CG: "the frustration from the field operations team — lack of engagement with the platform, no data entered in a regular way") |

### FR-ACC-016 — Account Readiness View

| Field | Value |
|---|---|
| Statement | The account workspace shall display an account readiness score and checklist distinguishing Pulse-owned actions (completable now) from parked external dependencies (Acumatica integration, payment vault, etc.). |
| Acceptance criteria | (1) Readiness checks are shown with status: ready / needs attention / parked. (2) Day-one handoff checklist separates Pulse-owned items from parked items. (3) Readiness drives "Needs follow-up" queue membership. |
| Priority | P1 |
| Build status | **Built** — `buildAccountReadinessSummary` in `service.ts`; readiness panel in `CustomerDetail.tsx`. |
| Sources | SRC-ACC-002 (Michelle: "if nobody's contacted this account within a quarter or six months we should have an exception report") |

### FR-ACC-017 — Affinity Group and Ownership Group Capture

| Field | Value |
|---|---|
| Statement | Pulse shall capture affinity group (buying / best-practice group membership) and ownership group (PE or common-ownership entity) as separate governed fields on every account, since they drive pricing, rebates, and routing independently. |
| Acceptance criteria | (1) Affinity group field has governed catalogue matching Acumatica attribute list. (2) Ownership group field has separate governed catalogue. (3) Both fields allow "None / Independent" selection. (4) Both fields are displayed on account profile and surface on directory summary. |
| Priority | P0 |
| Build status | **Built** — fields present in account profile; SRC-ACC-001 confirms catalogue exists in legacy CRM and Acumatica. Completeness of catalogue vs Acumatica list is **Partial** (needs reconciliation). |
| Sources | SRC-ACC-001 (CG: "we would want another field that says [ownership group]… affinity group as required at entry with possibly an entry of unknown"; Dan: "affinity group and ownership group — we need to track both because rebate structure depends on both"), SRC-ACC-003 (SOP: Acumatica Attributes tab → Add Affinity Group, Add Brand label) |

### FR-ACC-018 — CSV / Affinity Member List Import

| Field | Value |
|---|---|
| Statement | Pulse shall support column-mapped CSV/Excel import of affinity group member lists as lead records, so that quarterly member updates from buying groups can be ingested without manual entry. |
| Acceptance criteria | (1) Import UI allows column-to-field mapping (company name, email, phone, address, member ID). (2) Import deduplicates against existing accounts and leads on email or account name. (3) Import results show created / updated / skipped counts. |
| Priority | P2 |
| Build status | **Not-built** |
| Sources | SRC-ACC-002 (CG: "ability to import from CSV so we can import this data and map it into a lead contact sheet"; Dan: "I take the Excel spreadsheet, I convert every line to an INSERT statement — if I could just drag and drop someplace and say what's this column… would save me a couple hours every quarter") |

### FR-ACC-019 — Acumatica Customer Sync (Parked)

| Field | Value |
|---|---|
| Statement | When the Acumatica integration boundary is certified, Pulse shall support bidirectional customer record sync including creation payload, live customer ID display, sync status badge, and manual re-sync action. |
| Acceptance criteria | TBD at integration scoping phase. |
| Priority | P0 |
| Build status | **Parked** — `acumaticaStatus` field exists in schema; sync display placeholder visible in UI via UX-A-009 parked cards. Resumes when Acumatica endpoints and field mappings are certified. |
| Sources | SRC-ACC-001 (Dan: "customer information is manually entered into Acumatica — there's no sync"; Michelle: "we can't simultaneously put the same data in — that's why there is a matching problem"), SRC-ACC-003 (SOP: Acumatica Adding a Customer from Scratch — General Tab, Financial Tab, Billing Tab, Shipping Tab, Price Class, Tax Zone, Warehouse) |

### FR-ACC-020 — Account Activity Timeline

| Field | Value |
|---|---|
| Statement | The account workspace shall present a structured activity timeline covering profile changes, contact changes, location changes, payment method changes, lifecycle transitions, dealer-portal events, and source-lead events. |
| Acceptance criteria | (1) Timeline entries show entity type, action, actor, and timestamp. (2) Lifecycle transitions appear with reason note if present. (3) Timeline is append-only and immutable. |
| Priority | P1 |
| Build status | **Built** — `buildAccountActivityReview` in `service.ts`; `formatAccountActivityLabel`, `formatAccountActivityDetail` helpers; `activityReview.recentEvents` surfaced in `CustomerOverview.tsx`. |
| Sources | SRC-ACC-002 (CG: "no notes for that person for that account — territory managers: I don't use the CRM, I use Map My Customer") |

### FR-ACC-021 — Sales History Visibility on Account (Parked)

| Field | Value |
|---|---|
| Statement | When the Acumatica integration is live, the account workspace shall display a month-over-month sales trend view (filterable by 6 months, 12 months, 2 years, 3 years, lifetime), pulled from Acumatica order history and the 20-year Azure/QuickBooks historical dataset. |
| Acceptance criteria | TBD at integration scoping phase. |
| Priority | P2 |
| Build status | **Parked** — depends on Acumatica order history signal. |
| Sources | SRC-ACC-002 (Don Hearn: "I want to be able to look back two to three years and say — do I see a habit or pattern in their buying? … peaks and valleys"; CG: "sales tab — visual representation by month, filterable 6/12/24/36 months, lifetime") |

---

## 8. Non-Functional Requirements

| ID | Category | Requirement | Source |
|---|---|---|---|
| NFR-ACC-001 | Performance | Account directory page shall load within 2 seconds for the first 50-row fetch under normal network conditions. | (inferred standard) |
| NFR-ACC-002 | Performance | Account detail workspace (Profile tab) shall render within 2 seconds including readiness and activity review. | (inferred standard) |
| NFR-ACC-003 | Security / AuthZ | Raw card numbers, bank account numbers, and unmasked payment credentials shall never be accepted, stored, or logged at any system boundary — API, UI, or audit trail. | SRC-ACC-001 (Dan: "we never charge credit card out of Shopify… charge out of Acumatica only"); SRC-ACC-003 (SOP: credit card info cut off before uploading CIS) |
| NFR-ACC-004 | Security / AuthZ | Role-based access shall govern all account read, edit, lifecycle-change, payment-method, and reassignment actions. Finance-only actions (payment methods) shall be inaccessible to Sales/TM roles. | SRC-ACC-001 (CG: "admin access — me or Dan — anything that needs to be done") |
| NFR-ACC-005 | Security / AuthZ | The restricted SUPER_ADMIN account-creation path shall be protected by role enforcement; no other role may invoke it. | (inferred from BR-A-02) |
| NFR-ACC-006 | Scalability | The account directory and search shall support at least 10,000 account records without degradation beyond the 2-second SLA. | SRC-ACC-001 (716 active leads noted as already unwieldy; growth trajectory implies larger sets) |
| NFR-ACC-007 | Availability | The Accounts module API shall target 99.9% monthly uptime, aligned with the broader Pulse platform SLA. | (inferred standard) |
| NFR-ACC-008 | Auditability | All account create, update, lifecycle-change, contact, location, and payment-method mutations shall be recorded in the audit log with actor, timestamp, before-state, and after-state. | SRC-ACC-002 (Don Hearn: note authorship must be immutable; CG: "kept track of who posted the note") |
| NFR-ACC-009 | Auditability | Territory and owner reassignment events shall be stored as audit-log entries and surfaced in the account activity timeline. | (inferred from BR-A-13) |
| NFR-ACC-010 | Accessibility | Account workspace UI components shall meet WCAG 2.1 AA contrast and keyboard-navigation requirements. | (inferred standard) |
| NFR-ACC-011 | Observability | API response times, error rates, and search query latency for the accounts module shall be emitted as named metrics and available in the platform monitoring dashboard. | (inferred standard) |
| NFR-ACC-012 | Data Retention | Soft-deactivated contacts, locations, and payment references shall be retained indefinitely and shall not be physically deleted, preserving historical activity references. | SRC-ACC-001 (Adrienne: "soft-deactivate so activity history remains intact") |
| NFR-ACC-013 | Data Retention | The lifecycle audit trail shall be retained for the life of the account record and exposed to authorized roles. | (inferred from BR-A-08, BR-A-09) |

---

## 9. Business Rules Pulse Will Enforce

| # | Rule |
|---|---|
| BR-A-01 | An account will be created only at the approved first-order activation boundary; routine users will not create accounts by hand. |
| BR-A-02 | Manual account creation will be restricted to a SUPER_ADMIN bootstrap / migration path and kept isolated from normal account intake. |
| BR-A-03 | Every account will retain a permanent `sourceLeadId` link to its originating lead, and that lead will not be deleted on activation. |
| BR-A-04 | Lead context (territory, region, shipping centre, TM/RD, contacts, locations) will carry forward into the account at activation without re-entry. |
| BR-A-05 | An account will support multiple contacts, and the sole primary contact will not be removable without designating a replacement. |
| BR-A-06 | Contacts and locations will be soft-deactivated, never hard-deleted, so activity and training history remain intact. |
| BR-A-07 | An account will support multiple locations, with billing intent and shipping intent expressed distinctly rather than assumed identical. |
| BR-A-08 | Lifecycle transitions will be governed and auditable, with a reason required on consequential transitions such as confirming churn. |
| BR-A-09 | Lifecycle state will be tracked separately from the archive/record-active flag so churn and risk stay visible. |
| BR-A-10 | Pulse will store only tokenized payment references and masked descriptors; raw card or bank data will never be stored in Pulse. |
| BR-A-11 | Mobile field notes will become account activity only after back-office review and approval. |
| BR-A-12 | Financial, order, shipment, pricing, and live-inventory truth will remain owned by Acumatica and will not be edited in Pulse. |
| BR-A-13 | Reassignment of territory or owner will not rewrite prior activity authorship or historical ownership decisions. |

---

## 10. Assumptions

| ID | Assumption | Why It Matters | Source |
|---|---|---|---|
| ASM-ACC-001 | Accounts are born only on first-order conversion from a lead; there is no routine "create customer" action for sales. | Defines where customer truth originates; prevents duplicate, ungoverned account creation. | SRC-ACC-001 (Michelle: "once they place an order, graduate them to customer"; Ahmad: "account graduates to a customer when they place their first order — correct") |
| ASM-ACC-002 | The restricted SUPER_ADMIN manual-create path exists only for bootstrap/migration and will be removed or further isolated once migration tooling is final. | Affects data integrity and who can ever create an account outside conversion. | (inferred from BR-A-02) |
| ASM-ACC-003 | The CRM is the system of record for relationship data (account profile, contacts, locations, lifecycle); Acumatica is the system of record for financial data (orders, invoices, pricing, inventory). | Determines which fields Pulse owns/edits vs displays read-only. | SRC-ACC-001 (CG: "contact information, customer information — the CRM will be the source of truth; anything numbers or cost — Acumatica should be"; Dan: "I wouldn't focus on pricing in CRM — bang for buck is the CRM itself") |
| ASM-ACC-004 | Contact roles will move from free text to a governed role catalogue: Primary, Owner/GM, Ordering/Purchaser, Billing, Accounting/AP, Technical. | Determines reporting consistency and whether downstream processes (Shopify invite, portal access) can rely on role values. | SRC-ACC-003 (SOP: "Purchaser" as job title for ordering contact; Shopify invites go to primary and ordering contacts) |
| ASM-ACC-005 | Locations need explicit billing-versus-shipping intent, not just a single primary flag. | Affects where invoices, shipments, and finance notifications are directed. | SRC-ACC-003 (SOP: "billing address if different from shipping"; Acumatica Billing Tab "override bill to address if different from shipping") |
| ASM-ACC-006 | Lifecycle transitions are manual and reason-backed today; automatic order-driven aging is a later phase once a live order signal from Acumatica exists. | Sets expectations on what "At Risk / Inactive / Churned" means at go-live. | (inferred from BR-A-08; order signal depends on Acumatica boundary) |
| ASM-ACC-007 | Only tokenized payment references belong in Pulse; raw card capture stays in the hosted vault (Moneris / eBizCharge). | Security and compliance boundary; must be confirmed explicitly. | SRC-ACC-001 (Michelle: "cut off the credit card information"; Dan: "we never charge credit card out of Shopify — only out of Acumatica") |
| ASM-ACC-008 | Mobile field notes must pass back-office review before becoming account activity. | Affects data quality and accountability for what lands on an account. | (inferred from BR-A-11) |
| ASM-ACC-009 | Affinity group and ownership group are two separate dimensions and must both be stored; an account can carry one of each, both, or neither. | Drives pricing, rebate eligibility, and territory routing independently. | SRC-ACC-001 (Dan: "affinity group and ownership group — we need to track both; rebate depends on both"; CG: "they could be in different affinity groups AND an ownership group") |
| ASM-ACC-010 | Quarterly affinity member-list reconciliation (CSV import, column mapping, deduplication) is a P2 capability; the manual process is acceptable until that is built. | Determines whether Dan's quarterly 2-4 hour manual affinity reconciliation is blocked on Pulse or can proceed in parallel. | SRC-ACC-002 (Dan: "save me four hours a quarter, 16 a year" from automated column mapping) |

---

## 11. Open Questions

| ID | Question | Options To Confirm | Why Decision Is Needed |
|---|---|---|---|
| OQ-ACC-001 (was Q-A-01) | What is the governed contact-role catalogue, and is exactly one primary contact required per account? | Fixed catalogue / extensible catalogue / free text retained; one primary required / optional | Pulse should lock role values before downstream processes (Shopify, portal) depend on them. |
| OQ-ACC-002 (was Q-A-02) | How should billing-versus-shipping be modelled on locations? | Role flag per location / separate billing entity / "same as billing" toggle / other | Changes where finance, invoices, and shipments are directed. |
| OQ-ACC-003 (was Q-A-03) | What is the approved account-level duplicate / merge policy? | Admin merge with field-by-field resolution / block at conversion / review queue / no merge | Conversion-born accounts can still collide on name; protects customer history integrity. |
| OQ-ACC-004 (was Q-A-04) | Who may reassign territory or owner directly from the account, and with what audit? | Sales Leadership only / Admin/Ops / TM-initiated request / system-driven | Changes ownership control and accountability. |
| OQ-ACC-005 (was Q-A-05) | What are the lifecycle thresholds and who confirms churn? | At Risk 60 days / Inactive 120 days / Churned 180 days; manual confirm vs auto | Sets when automation (later) fires and what manual confirmation is required now. |
| OQ-ACC-006 (was Q-A-06) | Should the directory move beyond the current limits (hard 50-row fetch, top-8 follow-up slice)? | Add pagination / configurable columns / bulk actions / keep simple | Changes how operations works large account books at scale. |
| OQ-ACC-007 (was Q-A-07) | What account activity belongs in a first-class CRM-owned timeline, and what document types belong on the account? | CRM events only / include email/correspondence / include documents tab / mixed | Defines how much of the 360 timeline Pulse owns versus parks. |
| OQ-ACC-008 (was Q-A-08) | When the Acumatica boundary is live, which financial tabs and the live customer ID should appear, and to which roles? | Orders / invoices / shipments / payments / statements; by role | Pre-frames the parked Acumatica display so it can be enabled cleanly later. |
| OQ-ACC-009 | Should the CSV affinity member-list import be built in Phase 1 or deferred? | Phase 1 (P2 item) / defer to separate tooling | Dan identified 16 hours/year of manual reconciliation savings as motivation; decision determines build priority. |
| OQ-ACC-010 | How should management contacts be ranked above technician contacts in the contact list display? | Role-based sort order (primary first, then owner/GM, ordering, billing, technical) / manual reorder / headcount threshold | Don Hearn identified 14 technicians obscuring the management contact as a concrete pain point. |

---

## 12. Data And Integration Highlights

| Area | Proposed Pulse Role |
|---|---|
| Leads | Pulse will create the account from the converting lead at first order and keep permanent source-lead lineage |
| Territory | Pulse will carry territory, region, shipping centre, and TM/RD ownership forward and support governed reassignment |
| Training | Pulse will surface training history per account and link contacts to training records |
| Consignment | Pulse will link operating locations to consignment participation and surface consignment context on the account |
| Dealer Portal | Pulse will provision and manage dealer-portal access from the account and its contacts |
| CIS / Finance | Pulse will promote tokenized vault references from CIS and hold relationship/contact truth, leaving financial truth to Acumatica |
| Acumatica | Pulse will later display read-only orders, invoices, shipments, payments, balances, and the live customer ID once the certified boundary is live (parked) |
| Payment vaults (Moneris / eBizCharge) | Pulse will reference hosted, tokenized payment instruments only; raw card data stays in the vault |
| Mobile / Field | Pulse will receive field voice notes and route them through back-office review before they become account activity |
| Reporting | Pulse will feed account health, lifecycle, ownership, territory, and lineage reporting |

---

## 13. Later-Phase / Separate Decision Items

These items may still belong in the broader Pulse roadmap, but will not be assumed as finalized by this PRD:

- read-only Acumatica financial tabs (orders, invoices, shipments, payments, statements) and the live customer ID with sync-status badges and manual re-sync
- order-driven lifecycle automation and no-order aging alerts
- month-over-month sales-trend charting and longer-horizon buying-pattern analytics on the account
- parent / child account hierarchy and multi-entity rollup reporting
- dealer-group and price-class resolution display (Affinity + Ownership + Region → Dealer Group → Price Class)
- finance-alert notifications when billing-sensitive fields (billing address, AP contact, payment terms) change
- HubSpot historical migration rules beyond the one-time cutover decision
- mailbox / correspondence ingestion onto the account timeline
- twenty-year QuickBooks / Azure historical sales import onto the account
- rebate / discount engine in Pulse (parked per SRC-ACC-001: Dan Harshbarger — "I wouldn't focus on it — it's gonna derail us and the big bang for the buck is the CRM")

---

## 14. Requirement → Source Traceability Matrix

| FR / NFR ID | SRC ID | Session / Document |
|---|---|---|
| FR-ACC-001 | SRC-ACC-001, SRC-ACC-002 | Session 2 (2026-02-18), Session 4 (2026-02-24) |
| FR-ACC-002 | SRC-ACC-001, SRC-ACC-003 | Session 2 (2026-02-18), Adding-customer SOP |
| FR-ACC-003 | SRC-ACC-001, SRC-ACC-002 | Session 2 (2026-02-18), Session 4 (2026-02-24) |
| FR-ACC-004 | SRC-ACC-001 | Session 2 (2026-02-18) |
| FR-ACC-005 | SRC-ACC-002, SRC-ACC-001 | Session 4 (2026-02-24), Session 2 (2026-02-18) |
| FR-ACC-006 | SRC-ACC-003, SRC-ACC-001 | Adding-customer SOP, Session 2 (2026-02-18) |
| FR-ACC-007 | SRC-ACC-001, SRC-ACC-002 | Session 2 (2026-02-18), Session 4 (2026-02-24) |
| FR-ACC-008 | SRC-ACC-003, SRC-ACC-002 | Adding-customer SOP, Session 4 (2026-02-24) |
| FR-ACC-009 | SRC-ACC-003, SRC-ACC-002 | Adding-customer SOP, Session 4 (2026-02-24) |
| FR-ACC-010 | SRC-ACC-003, SRC-ACC-001 | Adding-customer SOP, Session 2 (2026-02-18) |
| FR-ACC-011 | SRC-ACC-001, SRC-ACC-002 | Session 2 (2026-02-18), Session 4 (2026-02-24) |
| FR-ACC-012 | SRC-ACC-002 | Session 4 (2026-02-24) |
| FR-ACC-013 | SRC-ACC-002 | Session 4 (2026-02-24) |
| FR-ACC-014 | SRC-ACC-001, SRC-ACC-003 | Session 2 (2026-02-18), Adding-customer SOP |
| FR-ACC-015 | SRC-ACC-002 | Session 4 (2026-02-24) |
| FR-ACC-016 | SRC-ACC-002 | Session 4 (2026-02-24) |
| FR-ACC-017 | SRC-ACC-001, SRC-ACC-003 | Session 2 (2026-02-18), Adding-customer SOP |
| FR-ACC-018 | SRC-ACC-002 | Session 4 (2026-02-24) |
| FR-ACC-019 | SRC-ACC-001, SRC-ACC-003 | Session 2 (2026-02-18), Adding-customer SOP |
| FR-ACC-020 | SRC-ACC-002 | Session 4 (2026-02-24) |
| FR-ACC-021 | SRC-ACC-002 | Session 4 (2026-02-24) |
| NFR-ACC-003 | SRC-ACC-001, SRC-ACC-003 | Session 2 (2026-02-18), Adding-customer SOP |
| NFR-ACC-004 | SRC-ACC-001 | Session 2 (2026-02-18) |
| NFR-ACC-008 | SRC-ACC-002 | Session 4 (2026-02-24) |
| NFR-ACC-009 | SRC-ACC-002 | Session 4 (2026-02-24) |
| NFR-ACC-012 | SRC-ACC-001 | Session 2 (2026-02-18) |
| ASM-ACC-001 | SRC-ACC-001, SRC-ACC-002 | Session 2 (2026-02-18), Session 4 (2026-02-24) |
| ASM-ACC-003 | SRC-ACC-001 | Session 2 (2026-02-18) |
| ASM-ACC-004 | SRC-ACC-003 | Adding-customer SOP |
| ASM-ACC-005 | SRC-ACC-003 | Adding-customer SOP |
| ASM-ACC-007 | SRC-ACC-001 | Session 2 (2026-02-18) |
| ASM-ACC-009 | SRC-ACC-001 | Session 2 (2026-02-18) |
| ASM-ACC-010 | SRC-ACC-002 | Session 4 (2026-02-24) |

---

## 15. Approval Checklist

Dynamic AQS approval of this PRD will confirm:

- accounts originating only at first-order conversion (with restricted bootstrap/migration creation) is the correct model
- the proposed account workspace, contacts, and multi-location scope reflects Dynamic AQS business reality
- the governed lifecycle model and reason-backed transitions are directionally correct
- the tokenized-only payment boundary and the parked Acumatica financial truth are framed correctly
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
| UX-A-001 | No empty state on follow-up queue | CustomerList.tsx | Yes | Open |
| UX-A-002 | No follow-up reason label per account row | CustomerList.tsx | Yes | Open |
| UX-A-003 | Reason not required on "At Risk" / "Inactive" status transitions | CustomerOverview.tsx | Yes | Open |
| UX-A-004 | Contact role is free-text — must use governed role catalogue (BR-A-05) | CustomerContacts.tsx | Yes | Open |
| UX-A-005 | Cannot remove sole primary contact without designating a replacement | CustomerContacts.tsx | Yes | Open |
| UX-A-006 | Payment panel does not show masked last-4 / card brand visually | CustomerPaymentMethods.tsx | Yes | Open |
| UX-A-007 | FieldActivityReview not linked from account detail workspace | CustomerDetail.tsx | Yes | Open |
| UX-A-008 | Source lead lineage (sourceLeadId) not displayed on account record | CustomerOverview.tsx | Yes | Open |
| UX-A-009 | Parked Acumatica financial tabs show nothing — no placeholder cards | CustomerDetail.tsx | Yes | Open |

### Sprint 2 — Core Workflow (M effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-A-010 | No pagination on account directory — hard limit: 200 (Q-A-06) | CustomerList.tsx | Yes | Done |
| UX-A-011 | No lifecycle audit trail on account (who changed status, when, why) | CustomerOverview.tsx | Yes | Done (parked: dedicated history endpoint — surfaces existing activityReview audit entries which already capture lifecycle changes) |
| UX-A-012 | No billing vs shipping location type distinction (BR-A-07) | CustomerLocations.tsx | Yes | Done (parked: DB column for locationType pending Q-A-02 schema decision — using name-prefix convention in the interim) |
| UX-A-013 | No "Register vault reference" create form on payment panel | CustomerPaymentMethods.tsx | Yes | Done |
| UX-A-014 | No deep-link support for secondary panels (tab not preserved in URL) | CustomerDetail.tsx | Yes | Done |

_To be completed during the review meeting._
