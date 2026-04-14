# Residential Vs Commercial And Commercial-Ready Schema Blueprint

## Document Control
| Field | Value |
|-------|-------|
| Document Type | Source of Truth Guidance Note |
| Version | 1.0 |
| Status | Active Draft |
| Owner | Architecture / BA |
| Baseline Date | 2026-03-31 |
| Primary Inputs | Discovery meetings, `architecture/`, active PRDs, `registers/RAID_LOG_INITIAL.csv` |

---

## 1. Purpose

This note answers two questions:

1. how commercial differs from residential in the discovery evidence
2. how the target schema should stay flexible so commercial can be added later without redesigning the residential platform

It also gives a direct database recommendation for the long-term platform.

---

## 2. What Discovery Confirms

### Residential and commercial are not the same workflow

The meetings consistently show that commercial is not just another account type inside the residential workflow.

- `Residential` is dealer, onboarding, pricing visibility, ordering, shipment/invoice visibility, and portal activation driven.
- `Commercial` is relationship and influence driven, with manufacturer reps, engineers, architects, building owners, and longer project cycles.
- `Residential territories` are state-based.
- `Commercial territories` are county-based and may include exclusivity plus overlays.
- `Residential pricing in Pulse` is ERP-governed and portal-facing.
- `Commercial pricing/specification tooling` was described as separate because of submittals and CAD-driven configuration.

Key discovery references:

- `Meetings/CG - Dynamics Meeting 2 - Transcipt  Date_ 24_10_2025, 19_30.md`
- `Meetings/Dan Meeting - Introductory Discovery Meeting – CRM Development - Clustox __ dynamic  Date_ 11_11_2025, 20_00.md`
- `Meetings/02 March session 7 Discovery - Delaer Portal.md`
- `Meetings/24th March - Session 12 - Reporting and Widen .md`

### Dan's long-term direction is clear

The current program is still `residential-first`, but Dan explicitly asked that the platform:

- pull `all sales` from `Acumatica`, not just residential sales
- begin organizing data so commercial can be supported later
- avoid structuring the platform in a way that blocks future commercial extension

This means the architecture should not build `commercial workflow` now, but it should build `commercial-safe foundations` now.

---

## 3. Recommended Commercial-Ready Foundation

### Keep one shared core

The following entities should stay generic and shared:

- `Account`
- `Contact`
- `AccountLocation`
- `Activity`
- `Task`
- `Visit`
- `AuditEntry`
- ERP transaction read models
- reporting semantic layer and KPI snapshots

These are not inherently residential entities. They should remain neutral and segment-aware.

### Make business segment explicit

Do not infer commercial vs residential from a name, team, or price list.

The platform should explicitly support:

- `residential`
- `commercial`
- `distributor`
- `mixed`
- `unknown`

This is already started in the current architecture through:

- `BusinessSegmentRef`
- `Account.businessSegment`
- `Account.businessSegmentSource`
- `Account.isMixedBusinessAccount`
- `Account.classificationDriftFlag`
- business-segment fields on ERP read models
- business-segment fields in reporting

### Ingest all sales, then filter views

The right architectural rule is:

`all sales ingest, residential views filter`

That means:

- all relevant ERP sales transactions are loaded into read models
- reporting can see and segment the full truth set
- Phase 1 dashboards, portal surfaces, and workflows can filter to residential scope
- future commercial enablement does not require re-importing or redesigning the fact model

### Treat mixed accounts as a governed case

Some accounts will not fit cleanly into one segment.

The platform should not hide or overwrite these cases silently. It should:

- flag mixed or drifting classification
- retain both Pulse and ERP context
- create reviewable exceptions
- keep audit history of how the classification was resolved

### Extend by module, not by corrupting residential states

When commercial is later brought in-scope, add dedicated commercial modules instead of overloading residential lead/onboarding states.

Likely future extension modules:

- `CommercialOpportunity`
- `OpportunityParty`
- `RepFirm`
- `RepOffice`
- `ContactRoleAssignment`
- `RelationshipMap`
- `QuoteVersion`
- `SpecSubmittal`
- `Project`
- county-based territory coverage entities

---

## 4. What The Current Schema Already Supports Well

The current target schema is already in a good place for `commercial-ready foundation` because it now includes:

- business-segment tagging on accounts and leads
- mixed-account and classification-drift flags
- segment-aware ERP read models
- segment-aware KPI and reporting structures
- API-level business-segment filters
- architecture-level classification-exception handling

Relevant current docs:

- `docs/roadmap/architecture/SYSTEM_ARCHITECTURE_OPTIONS_AND_RECOMMENDATION.md`
- `docs/roadmap/architecture/DATABASE_SCHEMA.md`
- `docs/roadmap/architecture/SYSTEM_ERD_BLUEPRINT.md`
- `docs/roadmap/architecture/API_CONTRACT_SPECIFICATION.md`
- `docs/roadmap/architecture/MESSAGE_QUEUE_AND_ASYNC_PATTERN.md`

---

## 5. What Should Still Be Hardened

The schema is `commercial-safe`, but not yet `commercial-operational`.

The next hardening steps should be:

1. add `AccountSegmentAssignment` instead of relying only on one segment string
2. add `ClassificationException` for mixed or drifting records
3. separate `role scope` from `segment scope` in authorization
4. preserve raw ERP classification inputs on read models where available
5. add county-based and overlay-capable territory structures when commercial comes in-scope
6. introduce commercial-specific entities only when the commercial workstream is formally activated

### Suggested future pattern

Preferred future additions:

- `AccountSegmentAssignment`
  - `accountId`
  - `segmentId`
  - `isPrimary`
  - `sourceSystem`
  - `sourceValue`
  - `confidence`
  - `effectiveFrom`
  - `effectiveTo`
  - `approvedBy`

- `ClassificationException`
  - `entityType`
  - `entityId`
  - `erpValue`
  - `pulseValue`
  - `proposedSegment`
  - `exceptionType`
  - `status`
  - `resolution`
  - `ownerUserId`
  - `openedAt`
  - `resolvedAt`

This preserves the current foundation while making later commercial rollout much safer.

---

## 6. Database Recommendation

### Recommendation

Use `PostgreSQL` as the main operational and reporting foundation.

Do **not** switch the core platform to `MongoDB` just to gain future commercial flexibility.

### Why PostgreSQL is the better fit

This program is heavily relational:

- account, contact, location, and company-account access
- ERP read models for orders, invoices, shipments, statements, and payments
- pricing classes, dealer groups, and visibility rules
- audit trails, sync records, exceptions, and approvals
- reporting semantic layers, KPI snapshots, and reconciliation
- migration validation and release-wave controls

These are areas where strong relational integrity, transactions, joins, indexing, reconciliation, and governed reporting matter more than document flexibility.

### Why MongoDB is not the right main choice

MongoDB would give you easier schema drift for unstructured or rapidly changing objects, but that is not the main problem to solve here.

For this project, MongoDB would make these things harder:

- relational reporting across many entities
- ERP reconciliation and migration controls
- strict auditability and exception workflows
- permission filtering across hierarchical scopes
- financial and operational traceability
- conformed KPI and semantic-layer design

The risk is that you gain flexibility in the least important place and lose strength in the most important place.

### Better flexibility pattern

If flexibility is the goal, use this instead:

- `PostgreSQL` as the system of record
- normalized core entities for governed business data
- extension tables for future commercial modules
- selective `JSONB` for low-risk variable attributes
- object storage for files and large document payloads

That gives you future extensibility without sacrificing data trust.

### Practical recommendation

If commercial comes later:

- keep the same PostgreSQL core
- add commercial extension tables/modules
- keep one shared ERP fact foundation
- avoid forking into a second database platform unless a later commercial product genuinely requires a separate bounded context

---

## 7. Bottom Line

- `Yes`, the platform should be designed so commercial can be added later.
- `No`, that does not mean we should design the whole system as commercial now.
- `No`, MongoDB is not the right main database choice for that goal.
- `Yes`, PostgreSQL with explicit segment modeling, extension modules, and selective JSONB is the right path.

The correct strategy is:

`residential-first delivery, commercial-ready data foundation`

