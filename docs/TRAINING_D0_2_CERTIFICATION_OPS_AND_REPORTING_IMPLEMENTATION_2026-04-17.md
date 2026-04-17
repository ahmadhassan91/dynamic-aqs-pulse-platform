# Training D0.2: Certification Ops + Reporting

**Date:** 2026-04-17  
**Repo:** `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform`  
**Branch:** `codex/entra-calendar-governance`

## Scope

This slice extends the D0.1 centralized queue with production-safe certification operations and compliance reporting that fit the current schema without introducing new business decisions.

Delivered:

- resolve pending certification decisions after session completion
- revoke issued certifications with audit-preserving notes
- centralized compliance/reporting read model
- TM/RD owner rollups
- certification-track rollups
- export-ready reporting data surfaced in `/training`

## What Is Now Live

### Certification operations

New backend-wired operations now exist for training roles that already have scheduling authority:

- `POST /api/v1/training/sessions/:sessionId/certification-decision`
- `POST /api/v1/training/certifications/:certificationId/revoke`

The decision flow is intentionally narrow:

- only `completed` sessions are eligible
- only certification-track sessions are eligible
- only sessions still in `pending_decision` can be resolved
- supported outcomes are:
  - `awarded`
  - `not_awarded`

If the decision is `awarded`, Pulse creates the certification record at that point instead of leaving the session stranded in an exception queue.

Revocation is also explicit:

- revoked certifications stay historically visible
- notes are preserved and appended, not silently dropped
- audit entries capture the lifecycle change

### Compliance reporting

New backend read model:

- `GET /api/v1/training/reporting`

The report summarizes:

- accounts in scope
- accounts with active programs
- active certifications
- expiring certifications
- expired certifications
- revoked certifications
- overdue cadence items
- unresolved execution exceptions
- pending certification decisions
- delivered training hours

Rollups are now available for:

- territory managers
- regional directors
- certification tracks

The same owner scoping rules used by D0.1 continue to apply:

- TMs are scoped to their own records
- RDs are scoped to their own records
- broader training/admin actors can apply TM/RD filters

## UI Outcome

`/training` keeps the approved prototype shell and now extends the existing `Exceptions & Recertification` tab with:

- a `Pending certification decisions` working queue
- `Resolve` action for pending decisions
- `Revoke` action on expiring/expired certification rows
- a backend-wired compliance reporting section
- CSV export derived from the backend reporting read model

This stays practical instead of decorative. The tab is meant to help ops users actively clear certification debt and review ownership/compliance posture without waiting on Outlook or external training-site work.

## Why Renewal Was Not Added Yet

True renewal semantics are intentionally still parked.

The current schema cleanly supports:

- issued certification records
- revocation
- expiry-based reporting
- post-session certification decisions

It does **not** yet cleanly model:

- superseded certifications
- structured renewal history
- separate renewal actor/timestamp fields

Rather than guessing at a lifecycle we may have to unwind later, this slice stopped at the safer boundary.

## Regression Coverage Added

Expanded module suite:

- `apps/api/test/training.regression.test.mjs`

New critical paths:

- resolving pending certification decisions to `awarded`
- certification record creation from post-session decisioning
- revoking issued certifications
- compliance/reporting summary counts
- TM/RD scope-aware reporting
- certification-track reporting rollups

## Verification

Relevant commands for this slice:

- `pnpm --filter @pulse/contracts build`
- `cd apps/api && pnpm exec tsc -p tsconfig.json --noEmitOnError false`
- `node --test --test-concurrency=1 apps/api/test/training.regression.test.mjs`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`

## Open / Parked

Still intentionally out of scope here:

- certification renewal lifecycle semantics
- certification revocation approval rules beyond existing training authority
- proof-file binary storage transport
- Outlook/provider sync for training
- external training-site coexistence
- richer leadership exports beyond the first report/CSV surface

## Best Next Training Slice

If provider prerequisites are still parked:

- `Training D0.3: reporting/export depth + proof transport`

If provider prerequisites are available:

- `Training D1: Outlook Sync + External Coexistence`
