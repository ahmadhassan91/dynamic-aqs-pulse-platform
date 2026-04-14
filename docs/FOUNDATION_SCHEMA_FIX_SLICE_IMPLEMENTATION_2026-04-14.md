# Foundation Schema Fix Slice Implementation

**Date:** 2026-04-14  
**Scope:** first near-term schema scalability pass after the reviewer-note and schema review

## What Shipped

This slice intentionally focused on the safest high-value changes:

1. Added composite indexes for hot operational query paths already used by the current codebase
2. Added shared JSON payload-size guardrails at the API/service boundary
3. Left broader structural changes as planned follow-up work instead of mixing too many moving parts into one slice

## Composite Indexes Added

The schema now includes composite coverage for these active query paths:

- `AuditEntry(entityType, createdAt)`
- `Lead(territoryId, lifecycleStatus, createdAt)`
- `Lead(assignedTmUserId, lifecycleStatus, createdAt)`
- `Lead(leadCaptureMethod, lifecycleStatus, createdAt)`
- `Lead(lifecycleStatus, stage, updatedAt, createdAt)`
- `WebsiteLeadSubmission(websiteLeadSiteId, reviewStatus, createdAt)`
- `OnboardingChecklistItem(ownerUserId, status, dueAt)`
- `TrainingSession(accountId, status, scheduledAt)`

These were chosen from the real code paths in `leads`, `admin`, `readiness`, `territories`, and `training`, not only from theoretical future access patterns.

## JSON Guardrails Added

Shared bounded JSON serialization now protects the highest-risk paths:

- audit `beforeData`
- audit `afterData`
- audit `metadata`
- migration run `entityScope`
- migration snapshot `rawPayload`
- migration snapshot `normalizedPayload`
- migration snapshot `metadata`
- website lead submission payload storage
- CIS metadata payloads

## Payload Limits Locked

These limits are application-level guardrails, not final storage policy:

- audit snapshots: `32KB`
- audit metadata: `16KB`
- migration run scope: `16KB`
- migration run summary/reconciliation reserved: `32KB`
- migration snapshot raw payload: `256KB`
- migration snapshot normalized payload: `128KB`
- migration snapshot metadata: `32KB`
- website lead submission payload: `32KB`
- CIS metadata: `16KB`

These caps are meant to stop accidental blob growth early without blocking realistic CRM workflow payloads.

## What We Intentionally Did Not Do Yet

This slice did **not** implement:

- UUIDv7 migration
- table partitioning
- audit/event archival jobs
- broad JSON GIN indexing
- vertical partitioning of `Lead`

Those are still valid concerns, but they are bigger or more invasive decisions. The current repo gets more value right now from better operational indexes and payload discipline than from a large ID or partitioning rewrite.

## Decision From This Slice

The schema scalability review is now partially implemented, not just documented.

Working position after this slice:

- composite indexes are part of the active foundation now
- JSON remains allowed, but only behind size guardrails
- GIN indexes stay deferred until a JSON field becomes a proven SQL filter path
- partitioning and UUID strategy remain planned foundation changes, not abandoned ideas
