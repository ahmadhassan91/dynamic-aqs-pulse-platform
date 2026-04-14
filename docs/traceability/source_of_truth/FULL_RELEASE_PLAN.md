# Full Release Plan

**Date:** 2026-03-31  
**Planning Baseline:** `registers/PROJECT_BREAKDOWN_DETAILED.csv`  
**Current WBS Size:** 190 rows / 1,603 story points / 20 modules

This is the reduced core-delivery baseline. It keeps the end-to-end residential platform path intact and defers lower-priority scope that would otherwise stretch the program back toward the 39-sprint / 2,548-SP package.

## 1. Planning Rules

This release plan is **gate-driven**, not just story-point-driven.

It assumes:

- Sprint 1 kickoff target remains **June 2, 2026**
- no scaled development starts before the **May 31, 2026** readiness gate
- Pulse owns workflow orchestration, user experience, and reporting orchestration
- Acumatica remains source of truth for financial, inventory, warehouse, pricing execution, and posted transaction data
- migration is not a single end-cutover event; it is staged as release-by-release waves with rehearsal before each broader exposure step
- mobile consumes the same governed APIs as web and should not outrun auth, API, territory, and reporting foundations
- buffer rows in the WBS are stabilization, UAT, and launch-control capacity, not hidden feature buckets

## 2. Release 0: Readiness and Architecture Closure

**Window:** March 30, 2026 to May 31, 2026  
**Purpose:** Turn the program into a technically safe build baseline before June delivery starts.

### Must close in Release 0

- source-of-truth matrix approved across Pulse and Acumatica
- customer-creation trigger formally locked
- physical schema, audit, masking, and indexing baseline approved
- field-mapping workbooks completed for customer, contact, product, pricing, consignment, order, and reporting entities
- Acumatica sandbox, auth, representative endpoints, queue pattern, DLQ pattern, retry rules, and reconciliation cadence validated
- reference data seed lists approved
- test strategy and non-prod environment baseline ready

### Exit gate

Release 1 cannot start unless the following are true:

- architecture sign-off completed
- integration sign-off completed
- schema and mapping blockers closed
- readiness checklist critical blockers reduced to acceptable launch status

## 3. Release Calendar

These are the current planning windows derived from the reduced 25-sprint WBS.

| Release | Target Window | WBS Mapping | Primary Outcome |
|---|---|---|---|
| Release 0 | Mar 30 - May 31, 2026 | Pre-build gate | Architecture, mapping, schema, and readiness closure |
| Release 1 | Jun 2 - Aug 24, 2026 | Sprint 01-Sprint 06 | Platform foundation and Wave 0 migration readiness |
| Release 2 | Aug 25 - Nov 16, 2026 | Sprint 07-Sprint 12 | Revenue operations core pilot and Wave 1 bootstrap migration |
| Release 3 | Nov 17, 2026 - Mar 8, 2027 | Sprint 13-Sprint 20 | Dealer, field, reporting, and consignment pilot plus Wave 2 migration |
| Release 4 | Mar 9 - May 17, 2027 | Sprint 21-Sprint 25 | Final migration cutover, GA readiness, and controlled launch |

## 4. Release 1: Platform Foundation and Internal Alpha

**Goal:** Establish the secure, governed foundation that every later module depends on.

### In scope

- program governance, success metrics, and decision rights
- system boundary rules and customer-creation decision
- canonical model and physical schema baseline
- SSO, RBAC, record-scope model, audit logging, environments
- reference data and admin CRUD foundation
- Wave 0 migration foundation for reference data, lead-source configuration, and governed mapping / reconciliation rules
- integration contract, field mappings, and Acumatica environment readiness
- mobile shell, secure login, and notification foundation
- early test strategy, observability, and release discipline

### What ships

- internal non-prod alpha
- no broad dealer launch
- no live ordering
- no broad field rollout

### Entry gate

- Release 0 closed

### Exit gate

- auth works in non-prod for internal roles
- core reference data is loaded
- field mappings are signed
- physical schema is approved
- Acumatica sandbox certification is complete
- Wave 0 migration readiness is proven for reference and workflow-configuration loads
- teams can build against real contracts instead of assumptions

## 5. Release 2: Revenue Operations Pilot

**Goal:** Prove that Pulse can run the lead-to-activation operating model for internal teams.

### In scope

- lead capture, routing, deduplication, workspace, discovery handling, SLA logic
- digital CIS, e-sign, finance queue, onboarding checklist, readiness gates
- customer workspace, multi-location model, lifecycle state, and ERP-linked context
- dealer identity bootstrap and governed portal invitation flow
- Wave 1 bootstrap migration for customer, location, contact, lead history, and active CIS packages
- territory foundation, training foundation, and mobile field foundation
- reporting semantic layer, metric register, reporting home, and the first pilot-ready report outputs
- initial consignment/site structures needed for downstream field work

### Pilot shape

- internal pilot first
- controlled BD, ops, finance, and admin cohort
- limited region and representative account set
- no broad dealer self-service ordering yet

### Exit gate

- one pilot cohort can execute lead -> discovery -> CIS -> finance -> onboarding -> customer activation without spreadsheet fallbacks
- internal users trust identity, workflow status, and basic reporting
- Wave 1 bootstrap migration passes rehearsal and reconciliation for pilot users
- lead routing, onboarding gating, and customer visibility are stable in pilot

## 6. Release 3: Dealer Commerce and Field Pilot

**Goal:** Bring dealer-facing commerce, reporting, and field execution online with tight pilot control.

### In scope

- dealer portal catalog, account center, orders, invoice visibility, payment-scope policy, and address governance
- product management and dealer-group visibility needed for pilot commerce
- core pricing rules needed for portal and field execution
- training completion, scheduling, and compliance logic
- Wave 2 migration for dealer accounts, recent transaction history, consignment sites/documents, training history, curated assets, and pilot KPI baselines
- territory routing refinement and mobile field execution for visits, training capture, consignment, and alerts
- consignment cadence, reconciliation, and exception workflows
- dynamic report builder, role dashboards, KPI lineage testing, and executive composition baseline
- pilot governance, role training, SOPs, and support readiness

### Pilot shape

- one region or clearly bounded TM/RD chain
- limited dealer-group and brand set
- controlled payment scope
- staged mobile enrollment
- legacy fallback remains available during pilot

### Exit gate

- pilot cohort defined and approved
- role training completed
- support tiers and severity routing active
- pricing, catalog visibility, order flow, invoice visibility, and mobile sync proven for representative accounts
- Wave 2 migration passes rehearsal and reconciliation for representative pilot accounts
- KPI reconciliation and sync monitoring show acceptable variance
- GA go/no-go criteria are agreed before expansion

## 7. Release 4: Cutover, GA, and Hypercare

**Goal:** Move from successful pilot to controlled general availability.

### In scope

- migration dry runs, delta capture, reconciliation, and rollback scripts
- final KPI baseline load and release-4 reporting migration evidence
- final cutover plan, freeze windows, communications, and go/no-go approvals
- scale, permission-boundary, mobile-sync, and sensitive-data testing
- launch stabilization, command-center controls, and early hypercare
- mobile store submission and production release controls

### GA strategy

- widen by region, dealer group, and function in waves
- do not convert every dealer group at once
- do not widen mobile enrollment until sync and support metrics stay healthy
- keep deferred scope out of the active launch path if it threatens core GA stability

### Exit gate

- full cutover rehearsal passed
- migration reconciliation signed off
- rollback rehearsal proven
- pilot exit metrics met
- Sev1 threshold at zero and Sev2 threshold within agreed tolerance
- executive go/no-go board approves GA

## 8. Non-Negotiable Sequencing Rules

These are the rules that make the plan technically and operationally correct:

1. Dealer ordering cannot launch before finance approval, onboarding readiness, dealer-group resolution, and price-class resolution are working.
2. Product visibility, digital assets, and portal publishing must stay behind dealer-group go-live checks.
3. Mobile field execution cannot scale before auth, shared APIs, territory rules, and alert routing are stable.
4. Reporting is not a polish layer. KPI register, semantic layer, and reconciliation must exist before role dashboards are trusted.
5. No release widens without the migration wave assigned to that release being rehearsed and reconciled first.
6. No migration cutover happens without dry run, delta logic, rollback, and sample reconciliation evidence.
7. No broad rollout happens directly from UAT. A named pilot cohort and GA gate are mandatory.

## 9. Suggested Go/No-Go Gate Stack

| Gate | Required Evidence |
|---|---|
| G0 - Build Start | Boundary sign-off, customer trigger decision, schema baseline, field mappings, sandbox certification |
| G1 - Internal Alpha | Auth works, reference data loaded, Wave 0 migration readiness proven, core workflows buildable in non-prod |
| G2 - Revenue Ops Pilot | Lead-to-activation flow stable for internal pilot cohort and Wave 1 bootstrap migration rehearsal passed |
| G3 - Dealer/Field Pilot | Portal, pricing, reporting, mobile, consignment, and Wave 2 migration stable for representative pilot accounts |
| G4 - General Availability | Cutover rehearsal passed, rollback proven, migration reconciled, support model live, executive approval granted |

## 10. Deferred Scope

The following scope is known, but intentionally outside the reduced 1,603-SP baseline:

- commercial CRM enablement
- AI / natural-language reporting
- advanced portal intelligence, cart analytics, and recommendation logic
- broader historical QuickBooks reporting
- advanced barcode / OCR / gamification extras
- broader Widen/Dropbox migration and lower-priority digital-asset enhancements

## 11. Final Position

This is the release plan I would use as the working delivery baseline.

It is logically correct because it follows the real business dependencies discovered in the sessions.  
It is technically correct because it does not let portal, mobile, reporting, or migration outrun architecture, mappings, environment readiness, or operational support.
