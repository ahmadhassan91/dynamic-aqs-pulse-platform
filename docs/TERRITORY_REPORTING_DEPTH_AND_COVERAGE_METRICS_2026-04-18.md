# Territory Reporting Depth And Coverage Metrics

Date: 2026-04-18
Branch: `codex/entra-calendar-governance`

## Summary

This slice deepens the live territory command-center reporting without inventing ERP, route-provider, or map-provider behavior that is not ready yet.

The territory dashboard now exposes:
- CRM-owned customer coverage score based on `lastEngagementAt`
- account lifecycle posture across `active / at_risk / inactive / churned`
- pipeline phase posture across `new / discovery / cis / onboarding`
- richer per-territory, per-region, and per-owner rollups for coverage and risk

This keeps the territory dashboard aligned to the PRD direction for:
- `FR-TR-029` territory performance dashboard
- `FR-TR-030` RD rollup dashboard
- `FR-TR-033` customer coverage score
- `FR-TR-036` pipeline by territory

## What Shipped

### Backend

- extended `TerritoryDashboardResponse` with:
  - `coverage`
  - `lifecycle`
  - `pipeline`
- extended workload, region-rollup, and owner-rollup reporting with:
  - recent coverage counts
  - overdue 90-day coverage counts
  - at-risk account counts
  - pipeline phase counts
- kept role-scoped territory visibility intact for TM and RD dashboard reads
- used only CRM-owned fields already present in the relational core:
  - `Account.lifecycleStatus`
  - `Account.isActive`
  - `Account.lastEngagementAt`
  - `Lead.stage`

### Frontend

- territory command-center now shows:
  - 30/60/90-day coverage metrics
  - lifecycle posture cards
  - pipeline posture cards
  - richer territory workload table
  - richer RD regional rollups
  - richer TM/RD owner coverage table

## What We Intentionally Did Not Fake

These remain parked and should not be blurred into “done” by this slice:

- territory revenue trending
  - still depends on ERP-backed order/revenue truth and reconciliation
- TM activity metrics like visits per week and average visit duration
  - route/check-in execution is not the source of truth yet
- peer comparison / territory comparison reporting
  - still belongs to a later reporting depth slice
- heat map and white-space analysis
  - still map/reporting follow-through, not current kernel truth
- training/compliance threshold logic beyond existing CRM-safe reporting
  - business threshold rules are still partially open in the requirements pack

## Regression Coverage

Expanded in:
- `apps/api/test/territories.regression.test.mjs`

New critical paths covered:
- dashboard exposes coverage, lifecycle, and pipeline metrics from CRM-owned data
- those reporting metrics remain correctly scoped for TM visibility

## Verification

Core verification for this slice:
- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/api build`
- `node --test --test-concurrency=1 apps/api/test/territories.regression.test.mjs`

Broader verification should still be run sequentially because the repo uses a shared test database.
