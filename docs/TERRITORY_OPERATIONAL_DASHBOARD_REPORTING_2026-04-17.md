# Territory Operational Dashboard Reporting

Date: 2026-04-17

## What shipped

The territory command center now has a server-owned operational dashboard read model instead of relying on client-only aggregation.

This slice added:
- scoped `GET /api/v1/territories/dashboard`
- production-safe workload rollups by territory
- scoped region rollups for RD/TM visibility
- owner metrics for territory managers and regional directors
- unassigned and ownership-gap queue metrics
- prototype-aligned dashboard depth in the territory workspace

## Why this slice mattered

The existing territory UI was visually strong, but its command-center metrics were still being stitched together in the browser from multiple endpoints. That made the reporting harder to trust and harder to scope consistently for TM and RD actors.

This slice moves the reporting truth into the territory backend so:
- the same scope rules drive list/map/dashboard reads
- RD and TM dashboards cannot drift from territory visibility rules
- prototype-aligned territory panels can deepen safely without duplicating business logic in the frontend

## Backend changes

Files:
- `apps/api/src/modules/territories/service.ts`
- `apps/api/src/modules/territories/http.ts`
- `packages/contracts/src/territories.ts`

The new dashboard response includes:
- top-level stats
- operational alerts
- top workload territories
- regional rollups
- TM/RD owner metrics
- queue-style unassigned and ownership-gap counts

The read model respects the same scoped visibility rules already introduced for:
- regions
- territories
- shipping centers
- map workspace
- assignment history

Broad operational roles keep broad reporting visibility. TMs and RDs only see rollups derived from records already inside their allowed scope.

## Frontend changes

Files:
- `apps/crm-web/src/components/territories/TerritoryManagement.tsx`
- `apps/crm-web/src/components/territories/TerritoryCommandDashboard.tsx`

The dashboard tab now consumes the server-owned territory dashboard API and renders:
- workload with lead + account totals
- regional rollups
- TM/RD owner coverage
- operational queue metrics

The rest of the territory workspace stays aligned to the approved prototype shell and does not introduce geo-editing or provider-dependent routing behavior.

## Regression coverage

Expanded in:
- `apps/api/test/territories.regression.test.mjs`

New critical paths covered:
- dashboard route mounted on the HTTP server
- broad-role dashboard workload and owner rollups
- TM-scoped dashboard visibility
- RD-scoped dashboard visibility

## Verification

Commands run:
- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`
- `pnpm dlx tsx --test --test-concurrency=1 apps/api/test/territories.regression.test.mjs`

## What remains open

Still intentionally outside this slice:
- bulk reassignment operations
- territory performance trend APIs over time
- multi-location concurrent territory visibility
- geo-editing and polygon tools
- provider-connected route optimization
