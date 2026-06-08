# Pulse Platform — Accounts / Customers / Contacts / Multi-Location Module PRD

## 1. Document Control

| Field | Value |
|---|---|
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Scope confirmation draft for Dynamic AQS review |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS sales leadership, Strategic Growth team, operations lead, finance lead, customer setup stakeholder |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, `01_LEADS_PRD.md`, `03_TERRITORY_PRD.md`, `05_CONSIGNMENT_PRD.md`, Training PRD, CIS / Finance / Onboarding PRD, Dealer / Portal PRD |

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

### 4.1 Pulse Will Support

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

### 4.2 This PRD Will Also Cover

- how an account comes into existence only through lead conversion, and what manual creation is and is not allowed to do
- how source-lead lineage, territory, contacts, and locations carry forward at activation
- how contact roles and the protected primary contact behave, and where role data needs to move from free text to a governed catalogue
- how billing-versus-shipping location semantics should be expressed beyond a single primary flag
- how the lifecycle is governed today (manual, reason-backed transitions) and where order-driven automation is still pending
- what Dynamic AQS needs to confirm before the account scope is locked

### 4.3 Later-Phase / Separate Decision Items

These items remain part of the broader Pulse vision, but require later approval or a separate dependency decision and must not be treated as in-scope gaps:

- Acumatica-owned financial truth surfaced in Pulse: orders, invoices, shipments, payments received, statement / AR balances, credit limits, revenue, pricing, and live inventory — these stay in Acumatica until the certified integration boundary is live, after which Pulse will display them read-only
- the live Acumatica customer ID and bidirectional customer/contact sync (creation payload, sync status badges, manual re-sync) — parked until the Acumatica boundary, endpoints, and field mappings are available
- raw payment-card and bank data — permanently out of Pulse; capture stays in the Moneris / eBizCharge hosted vaults, with Pulse holding tokenized references only
- HubSpot historical lead/customer data migration mechanics and cutover timing
- mailbox / correspondence ingestion (email threads auto-attached to the account timeline)
- order-driven lifecycle automation (automatic At Risk / Inactive / Churned aging) — depends on a live order signal
- month-over-month sales-trend charting on the account — depends on Acumatica order history being live
- parent / child account hierarchy and multi-entity rollup reporting
- dealer-group and price-class resolution display (Affinity + Ownership + Region → Dealer Group → Price Class) — depends on finance pricing rules and the pricing boundary
- twenty-year QuickBooks / Azure historical sales import onto the account

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

## 7. Business Rules Pulse Will Enforce

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

## 8. Data And Integration Highlights

At business level, this module will depend on and feed the following:

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

## 9. Assumptions To Confirm

| # | Assumption | Why It Matters |
|---|---|---|
| A-A-01 | Accounts are born only on first-order conversion from a lead; there is no routine "create customer" action for sales. | This defines where customer truth originates and prevents duplicate, ungoverned account creation. |
| A-A-02 | The restricted SUPER_ADMIN manual-create path exists only for bootstrap/migration and will be removed or further isolated once migration tooling is final. | This affects data integrity and who can ever create an account outside conversion. |
| A-A-03 | The CRM is the system of record for relationship data (account profile, contacts, locations, lifecycle); Acumatica is the system of record for financial data. | This determines which fields Pulse owns and edits versus displays read-only. |
| A-A-04 | Contact roles will move from free text to a governed role catalogue (Primary, Owner/GM, Ordering, Billing, Accounting/AP, Technical). | This determines reporting consistency and whether downstream processes can rely on role values. |
| A-A-05 | Locations need explicit billing-versus-shipping intent, not just a single primary flag. | This affects where invoices, shipments, and finance notifications are directed. |
| A-A-06 | Lifecycle transitions are manual and reason-backed today; automatic order-driven aging is a later phase once an order signal exists. | This sets expectations on what "At Risk / Inactive / Churned" means at go-live. |
| A-A-07 | Only tokenized payment references belong in Pulse; raw card capture stays in the hosted vault. | This is a security and compliance boundary that must be confirmed explicitly. |
| A-A-08 | Mobile field notes must pass back-office review before becoming account activity. | This affects data quality and who is accountable for what lands on an account. |

---

## 10. Open Questions For Dynamic AQS Decision

| # | Question | Options To Confirm | Why Decision Is Needed |
|---|---|---|---|
| Q-A-01 | What is the governed contact-role catalogue, and is exactly one primary contact required per account? | fixed catalogue / extensible catalogue / free text retained; one primary required / optional | Pulse should lock role values before downstream processes depend on them. |
| Q-A-02 | How should billing-versus-shipping be modelled on locations? | role flag per location / separate billing entity / "same as billing" toggle / other | This changes where finance, invoices, and shipments are directed. |
| Q-A-03 | What is the approved account-level duplicate / merge policy? | admin merge with field-by-field resolution / block at conversion / review queue / no merge | Conversion-born accounts can still collide; this protects customer history integrity. |
| Q-A-04 | Who may reassign territory or owner directly from the account, and with what audit? | Sales Leadership only / Admin/Ops / TM-initiated request / system-driven | This changes ownership control and accountability. |
| Q-A-05 | What are the lifecycle thresholds and who confirms churn? | At Risk 60 days / Inactive 120 days / Churned 180 days; manual confirm vs auto | This sets when automation (later) fires and what manual confirmation is required now. |
| Q-A-06 | Should the directory move beyond the current limits (hard 50-row fetch, top-8 follow-up slice)? | add pagination / configurable columns / bulk actions / keep simple | This changes how operations works large account books at scale. |
| Q-A-07 | What account activity belongs in a first-class CRM-owned timeline, and what document types belong on the account? | CRM events only / include email/correspondence / include documents tab / mixed | This defines how much of the 360 timeline Pulse owns versus parks. |
| Q-A-08 | When the Acumatica boundary is live, which financial tabs and the live customer ID should appear, and to which roles? | orders / invoices / shipments / payments / statements; by role | This pre-frames the parked Acumatica display so it can be enabled cleanly later. |

---

## 11. Later-Phase / Separate Decision Items

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

---

## 12. Approval Checklist

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
