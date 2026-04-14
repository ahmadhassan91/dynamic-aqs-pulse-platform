# Foundation Schema Scalability Review And Fix Slice

**Date:** 2026-04-14  
**Scope:** review of schema scalability concerns raised against the current Pulse production schema

## Verdict

The review is useful and mostly directionally correct.

The current schema is a strong functional foundation, but a few scalability calls should be made now while data volumes are still low.

## Where I Agree Strongly

### 1. Audit/event growth needs a strategy

This is the most important point.

`AuditEntry`, `LeadStageEvent`, `CisPackageEvent`, `TerritoryAssignmentHistory`, and `WebsiteLeadSubmission` are all append-heavy history/event tables. They need an explicit retention and partitioning strategy before the system moves beyond early pilot scale.

### 2. Composite indexes should be added intentionally

This is a real near-term improvement.

The schema already has many single-column indexes, but the hot operational query paths are mostly composite:

- territory + lifecycle + recency on leads
- owner + status + due date on readiness/checklist work
- entity + time on audit
- account + scheduledAt + status on training sessions

These should be added deliberately as part of a targeted performance slice.

### 3. JSON usage needs guardrails

The JSON fields are not automatically wrong, but they do need clearer rules:

- only hot query JSON should get GIN indexes
- large raw payloads need size caps at the service boundary
- repeatedly queried JSON fields should be promoted into real columns or stored/generated projections

### 4. Migration workload should stay isolated from OLTP pressure

This becomes important during large imports. Even if we do not split infrastructure immediately, we should at least formalize run windows, chunking, and bulk-import operating rules before the first major migration wave.

## Where I Would Be More Measured

### UUID v4 -> UUIDv7

This is a valid concern for very high-write tables, but it is also the most invasive fix on the list.

I would not treat this as a blanket emergency change across the whole schema unless we are ready to make it consistently and carefully.

Recommended position:

- keep this as a **planned foundation change**
- prioritize it for hot append-only/event tables first if we choose to adopt it
- do not mix UUID strategy changes casually across the schema

### Vertical split of `Lead`

This may become useful later, but I would not split `Lead` immediately just because it is wide.

Recommended position:

- improve indexes and read-models first
- measure list/query pressure under realistic volumes
- split only if lead list/detail access patterns actually justify it

## Recommended Fix Slice

## Slice A: Near-term, high-value, low-risk

Ship this next when we take a foundation pass:

1. Add composite indexes for the top operational query paths
2. Add `AuditEntry` entity/time composite coverage
3. Add targeted GIN indexes only where JSON is actually queried
4. Add application-level size caps for large raw JSON payloads in migration/CIS paths
5. Write the retention/partitioning policy for audit + history tables

## Slice B: Before broader pilot scale

1. Partition `AuditEntry` by month
2. Define archive handling for event/history tables
3. Add migration operating rules for bulk-run pressure
4. Add generated/projection columns for the hottest JSON-derived fields if needed

## Slice C: Measure-first changes

Only do these after real usage confirms the need:

1. UUIDv7 migration strategy
2. Vertical partitioning of `Lead`
3. Broader partitioning of migration/event tables

## Concrete Index Candidates

These are the most likely high-value additions:

- `Lead(territoryId, lifecycleStatus, createdAt DESC)`
- `Lead(assignedTmUserId, lifecycleStatus, createdAt DESC)`
- `OnboardingChecklistItem(ownerUserId, status, dueAt)`
- `AuditEntry(entityType, entityId, createdAt DESC)`
- `TrainingSession(accountId, status, scheduledAt DESC)`
- `WebsiteLeadSubmission(websiteLeadSiteId, reviewStatus, createdAt DESC)`

## Decisions Locked From This Review

1. We should treat audit/event growth as an explicit architecture concern, not a later cleanup.
2. Composite indexes are the first schema-performance fix slice.
3. JSON usage stays allowed, but only with guardrails and targeted indexing.
4. UUIDv7 is worth evaluating, but not as an unplanned blanket flip.
5. Lead vertical partitioning is not approved yet; it stays a measured later option.
