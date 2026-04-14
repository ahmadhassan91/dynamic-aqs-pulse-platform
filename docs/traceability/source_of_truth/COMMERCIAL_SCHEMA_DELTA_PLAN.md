# Commercial Schema Delta Plan

## Document Control
| Field | Value |
|-------|-------|
| Document Type | Source of Truth Schema Delta Plan |
| Version | 1.0 |
| Status | Active Draft |
| Owner | Architecture / BA |
| Baseline Date | 2026-03-31 |
| Primary Inputs | `architecture/DATABASE_SCHEMA.md`, discovery corpus, `source_of_truth/RESIDENTIAL_VS_COMMERCIAL_AND_COMMERCIAL_READY_SCHEMA_BLUEPRINT.md` |

---

## 1. Purpose

This document shows the concrete schema path for supporting commercial later without redesigning the current residential-first platform.

It answers:

1. which current tables stay as-is
2. which current tables should be extended
3. which new tables should be added only when commercial becomes an active workstream
4. what should be built now as no-regret foundation hardening

---

## 2. Design Rule

The schema strategy should remain:

`one shared relational core, then add commercial extension modules`

Do not:

- fork residential and commercial into two separate core schemas
- overload residential lead/onboarding states with commercial opportunity logic
- replace the core with a document model just to accommodate future variability

---

## 3. Keep Unchanged

These existing entities should remain part of the shared platform core and should not be split into residential vs commercial versions:

| Current Entity | Keep? | Why |
|---|---|---|
| `Account` | Yes | Shared company/account master is still correct |
| `Contact` | Yes | Shared person record remains valid |
| `AccountLocation` | Yes | Both models still need normalized locations |
| `Activity` / `Task` / `Visit` | Yes | Shared interaction log is still useful |
| `AuditEntry` | Yes | Shared audit model should remain central |
| `ExternalReference` | Yes | Needed for Acumatica and future external mappings |
| `SalesOrderReadModel` | Yes | One all-sales ERP fact foundation is the right pattern |
| `InvoiceReadModel` | Yes | Same reason |
| `ShipmentReadModel` | Yes | Same reason |
| `StatementReadModel` | Yes | Same reason |
| `PaymentReadModel` | Yes | Same reason |
| `MetricDefinition` / `KpiSnapshot` | Yes | Reporting should stay conformed, not forked |

---

## 4. Extend Existing Tables

These current tables are the right place to add controlled flexibility.

### 4.1 Account

Current base is correct, but it should eventually be strengthened beyond plain flags.

| Current Field / Concept | Keep? | Future Delta |
|---|---|---|
| `businessSegment` | Yes | Keep as current shortcut, but back with governed assignments |
| `businessSegmentSource` | Yes | Keep and standardize values |
| `isMixedBusinessAccount` | Yes | Keep as fast indicator |
| `financeAuthorityMode` | Yes | Keep and normalize later if needed |
| `classificationDriftFlag` | Yes | Keep as visible health signal |

Recommended later additions:

- `primarySegmentAssignmentId`
- lifecycle linkage to governed segment assignments
- stronger ERP classification provenance

### 4.2 Contact

`Contact` should stay generic, but it needs richer role mapping later.

Current issue:

- one generic `role` string is fine for residential
- it is too weak for commercial influencer networks

Recommended later additions:

- keep `Contact` itself
- do not duplicate it
- add role-assignment and relationship tables around it

### 4.3 Territory

Current territory structure is residential-biased because it is state-array based.

Recommended change:

- keep `Region` and `Territory`
- add boundary/coverage extensions rather than replacing them

### 4.4 ERP Read Models

Current read models already carry `businessSegment`. That is the right start.

Recommended later additions:

- `erpCustomerClass`
- `erpBranchCode`
- `erpMarketCode`
- `erpBusinessUnit`
- `classificationConfidence`

These fields should be kept on ERP-backed read models, not spread across ad hoc JSON blobs.

### 4.5 Reporting

Current KPI/reporting structures should stay shared.

Recommended change:

- preserve current segment-aware pattern
- add commercial dimensions in the semantic layer, not a second reporting stack

---

## 5. Add Now As No-Regret Hardening

These are the best schema additions to make before commercial is formally in-scope.

### 5.1 `AccountSegmentAssignment`

Purpose:

- support one account belonging to more than one segment over time
- separate current status from classification history

Suggested fields:

- `id`
- `accountId`
- `segmentId`
- `isPrimary`
- `sourceSystem`
- `sourceValue`
- `confidence`
- `effectiveFrom`
- `effectiveTo`
- `approvedBy`
- `createdAt`
- `updatedAt`

### 5.2 `ClassificationException`

Purpose:

- handle mixed-account or ERP-vs-Pulse classification conflicts in a governed way

Suggested fields:

- `id`
- `entityType`
- `entityId`
- `exceptionType`
- `erpValue`
- `pulseValue`
- `proposedSegment`
- `status`
- `ownerUserId`
- `resolution`
- `openedAt`
- `resolvedAt`
- `notes`

### 5.3 `RoleSegmentScope`

Purpose:

- keep role-based access separate from business-segment access

Suggested fields:

- `id`
- `role`
- `segmentId`
- `scopeType`
- `isAllowed`

This avoids hard-coding assumptions like “executive sees all residential” into the permanent security model.

---

## 6. Add Later When Commercial Becomes Active

These should be introduced only when commercial is formally approved as a real delivery workstream.

### 6.1 Relationship And Organization Model

| New Entity | Purpose |
|---|---|
| `RepFirm` | Manufacturer rep company |
| `RepOffice` | Office/branch inside a rep firm |
| `ContactRelationshipAssignment` | Classify a contact as rep, engineer, architect, owner, contractor, influencer, etc. |
| `AccountRelationshipMap` | Capture who influences or owns which commercial account/project |

### 6.2 Commercial Opportunity Model

| New Entity | Purpose |
|---|---|
| `CommercialOpportunity` | Long-cycle commercial pipeline record |
| `OpportunityParty` | Contacts/organizations participating in the opportunity |
| `OpportunityStageHistory` | Commercial pipeline progression |
| `OpportunityRatingSnapshot` | Rep/relationship score tracking |

### 6.3 Quote / Spec / Project Model

| New Entity | Purpose |
|---|---|
| `QuoteVersion` | Commercial quote iterations |
| `SpecSubmittal` | Spec and submittal workflow |
| `CommercialProject` | Project-level commercial tracking |
| `ProjectDocumentLink` | Link documents, CAD outputs, submittals, and approvals |

### 6.4 Territory Coverage Model

| New Entity | Purpose |
|---|---|
| `TerritoryBoundary` | Explicit geography boundary record |
| `CountyCoverageAssignment` | County-level commercial coverage |
| `CoverageOverlayRule` | Cross-county or industry overlay assignment |
| `ExclusivityRule` | Exclusive commercial ownership rules |

---

## 7. Recommended Rollout Order

### Phase A: Foundation Hardening

Add first:

1. `AccountSegmentAssignment`
2. `ClassificationException`
3. `RoleSegmentScope`
4. ERP provenance fields on transaction read models

This phase is safe even before commercial delivery starts.

### Phase B: Territory And Relationship Extensions

Add next:

1. county/exclusivity coverage tables
2. rep firm / office structures
3. contact relationship role mappings

This phase supports the commercial operating model without touching residential order flow.

### Phase C: Commercial Pipeline

Add only once commercial scope is approved:

1. `CommercialOpportunity`
2. `OpportunityParty`
3. `OpportunityStageHistory`
4. commercial KPI entities if needed

### Phase D: Quote / Spec / Project Flow

Add last, because this is the biggest divergence from residential:

1. `QuoteVersion`
2. `SpecSubmittal`
3. `CommercialProject`
4. document / CAD / submittal linkage

---

## 8. What Should Stay Out For Now

Do not add these to the active residential build baseline yet:

- full commercial opportunity pipeline
- commercial spec/submittal workflow
- rep-firm office hierarchy
- county exclusivity execution logic
- commercial quoting and pricing engine

Those belong in a future commercial workstream, not in the current reduced core-delivery baseline.

---

## 9. Database Recommendation For The Delta Plan

This delta plan still assumes:

- `PostgreSQL` remains the core system of record
- new commercial capability is added through new relational tables
- variable future attributes are handled with selective `JSONB`, not with a wholesale move to MongoDB

That is the safest way to support:

- shared ERP read models
- governed reporting
- migration and reconciliation
- access control
- audit and exception handling

---

## 10. Bottom Line

The correct expansion path is:

1. keep the current shared relational core
2. harden segment assignment and classification governance now
3. add commercial-only modules later as separate extensions

That gives you `commercial-ready architecture now` without paying the price of `commercial complexity now`.

