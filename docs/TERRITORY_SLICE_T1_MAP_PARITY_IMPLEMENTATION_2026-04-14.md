# Territory Slice T1 Implementation

Date: 2026-04-14

## Summary

Territory Slice T1 is now implemented in the production repo.

This slice closes the biggest prototype-parity gap in the territory module by replacing
the earlier atlas-style placeholder with a real interactive geographic map under the
approved `/territory_map` route and Pulse shell.

## What This Slice Added

- dedicated map workspace endpoint: `GET /api/v1/territories/map`
- explicit territory map contracts for:
  - coverage entries
  - account pins
  - lead pins
  - shipping-center summaries
- interactive MapLibre territory map in `crm-web`
- live state overlays colored by territory coverage
- live account and lead markers
- live shipping-center markers
- map popups with territory / TM / RD / shipping context
- click-through from pins into customer or lead detail
- overlay modes for:
  - coverage
  - accounts
  - pipeline
  - combined operating view

## What Stayed Intentionally Out Of Scope

- polygon editing
- route optimization
- GPS tolerance / geofencing
- provider-connected directions
- external map-provider billing decisions

Those remain later territory/provider slices.

## Why This Matters

Before this slice, the territory module was operationally real on the backend but still
below prototype parity in the most visible territory surface.

After this slice:

- `/territories` remains the command-center / policy workspace
- `/territory_map` is now a true interactive coverage view
- the map is backed by live territory, lead, account, and shipping-center data
- no standalone alternate shell was introduced

## Regression Coverage

Territory regressions now also verify the map workspace read model:

- coverage entries
- assigned lead pins
- unassigned lead pins
- account pins
- shipping-center rollups

Suite:

- `pnpm --filter @pulse/api test:territories`

## Remaining Territory Work

Territory is stronger now, but not complete yet.

Still active after T1:

- T2: account/location propagation and ownership maintenance
- T3: reporting and exception views
- T4: provider-free field-execution foundation

Still parked until later/provider decisions:

- T5: provider-connected routing
- route optimization
- geofencing / navigation provider behavior

## Files

- `apps/api/src/modules/territories/service.ts`
- `apps/api/src/modules/territories/http.ts`
- `packages/contracts/src/territories.ts`
- `apps/api/test/territories.regression.test.mjs`
- `apps/crm-web/src/components/territories/TerritoryCoverageMapPage.tsx`
- `apps/crm-web/src/components/territories/TerritoryMapLibre.tsx`
- `apps/crm-web/src/lib/pulse-api.ts`
- `apps/crm-web/public/maps/us-states.geojson`

