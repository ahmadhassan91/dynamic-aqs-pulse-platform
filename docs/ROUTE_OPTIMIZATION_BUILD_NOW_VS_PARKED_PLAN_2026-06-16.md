# Route Optimization Build-Now Vs Provider-Parked Plan

Date: 2026-06-16

Delivery plan for the mobile route-optimization builder — the Map My Customer replacement Don described
(multi-stop route building with colour-coded stops, per-stop dwell, an end-of-day ETA, and turn-by-turn
handoff) — without waiting for the maps-provider/billing decision. It implements the requirement captured
in `docs/client-scope-confirmation-2026-04-20/08_MOBILE_FIELD_APP_PRD.md` (FR-MOB-061 route builder,
FR-MOB-034 external nav handoff, assumption ASM-MOB-04, open question OQ-MOB-08 nav provider default). It
mirrors `docs/ORDER_ON_BEHALF_BUILD_NOW_VS_ACUMATICA_PARKED_PLAN_2026-06-16.md` and
`docs/CONSIGNMENT_BUILD_NOW_VS_ACUMATICA_PARKED_PLAN_2026-04-30.md`.

Note on the dependency: unlike ordering/consignment, route optimization is **NOT** blocked by Acumatica.
It is parked only on the maps-provider + billing decision (Mapbox vs Google), tracked in the CRM repo at
`docs/roadmap/plans/MAPS_AND_OUTLOOK_CALENDAR_INTEGRATION_PLAN_2026-04-14.md` ("Decision still needed").

## Decision

Build the provider-free route builder now. A large, genuinely useful slice ships with zero external
sign-off because the heavy lifting already exists server-side and external navigation rides the free OS
URL schemes (no API key, no billing). Park only the premium "true optimization / traffic-accurate ETA"
layer and optional server-side route persistence behind the maps-provider decision.

## Why We Are Parking Some Items

Far more is already built than the route screen's "optimization stays parked" copy implies. Verified in
code as of 2026-06-16:

- The server already produces a provider-neutral, nearest-neighbour-ordered route plan:
  `buildProviderNeutralRoutePlans` + `orderRouteStops` in `apps/api/src/modules/territories/service.ts`,
  emitted as `TerritoryRoutePlanSummary` (`isProviderOptimized: false`) in
  `packages/contracts/src/territories.ts`.
- The web territory map already renders that plan with sequence + per-leg miles + visit state
  (`apps/crm-web/src/components/territories/TerritoryCoverageMapPage.tsx`).
- The mobile map already fetches the same workspace endpoint (`fetchTerritoryMapWorkspace` in
  `apps/mobile/app/(tabs)/map.tsx`) but consumes only `coverageEntries` — it ignores `routePlans`.
- The mobile route screen (`apps/mobile/app/(tabs)/route.tsx`) consumes none of it: it re-derives a naive
  oldest-last-touch order locally (`stops` sorts by `lastEngagementAt`, `slice(0, 8)`).
- Status colour markers already ship and now carry through the route stop cards (colour-coding shipped
  2026-06-16, commit a3b85e1, reusing `apps/mobile/src/lib/account-map-status.ts`).
- The durable local-draft pattern for saved routes already exists
  (`apps/mobile/src/lib/mobile-draft-queue.ts`).

So the buildable-now slice is mostly mobile UI plus a tiny nav-link helper. The only genuinely parked
items are road-accurate distance/traffic ETA and a "true" optimization engine, both gated on the
provider/billing decision — building fake road distances now would be dishonest, so the shipped slice uses
straight-line haversine + a flat speed estimate, labelled as an estimate.

## Build Now

| Slice | Name | What We Build Now | Key Files When Implemented |
| --- | --- | --- | --- |
| `RTE-P1` | External nav handoff | `lib/external-nav.ts`: format deep links for Waze (`waze://?ll=lat,lng&navigate=yes`), Google Maps (`comgooglemaps://` / `https://www.google.com/maps/dir/?api=1&destination=...`), Apple Maps (`maps://?daddr=...`), plus a multi-stop Google directions URL with `waypoints`, and a Safari web-URL fallback. No API key. Persist last-chosen provider via the existing draft/AsyncStorage pattern (FR-MOB-034, OQ-MOB-08) | `apps/mobile/src/lib/external-nav.ts` |
| `RTE-P2` | Navigate action sheet | A "Navigate" action sheet (3 provider options, last selection pre-selected) wired into the `route.tsx` check-in card and onto `map.tsx` marker taps | `apps/mobile/app/(tabs)/route.tsx`, `apps/mobile/app/(tabs)/map.tsx` |
| `RTE-P3` | Multi-select route builder | Replace the fixed oldest-touch top-8 list with tap-to-add/remove stops + drag-to-reorder + running straight-line (haversine) mileage; keep each stop's status colour (already on `RouteStopCard`) and add a sequence-number overlay (FR-MOB-061) | `apps/mobile/app/(tabs)/route.tsx`, `apps/mobile/src/lib/account-map-status.ts` |
| `RTE-P4` | Optimize order | An "Optimize order" button that consumes the EXISTING server `routePlans` (via `fetchTerritoryMapWorkspace`, already wired in `map.tsx`) with a client-side nearest-neighbour fallback over `account.latitude/longitude` (mirror server `orderRouteStops`) so it works offline; disabled under 2 stops with the PRD copy | `apps/mobile/app/(tabs)/route.tsx`, `apps/mobile/src/lib/api.ts` |
| `RTE-P5` | Dwell + end-of-day ETA | Per-stop editable dwell time (default 30/45 min) + start time; a straight-line "miles → rough drive minutes" estimate (flat avg-mph constant) to compute a cumulative end-of-day ETA, clearly labelled as an estimate | `apps/mobile/app/(tabs)/route.tsx` |
| `RTE-P6` | Saved / multiple routes | Persist named route drafts locally via the existing `mobile-draft-queue` durable storage; list/load/duplicate them | `apps/mobile/src/lib/mobile-draft-queue.ts`, `apps/mobile/app/(tabs)/route.tsx` |
| `RTE-P7` | Map ↔ route bridge | "Add to route" on a marker/pin tap so the builder and the colour-coded map share state (preserves colour context during build) | `apps/mobile/app/(tabs)/map.tsx`, `apps/mobile/app/(tabs)/route.tsx` |
| `RTE-P8` | Provider abstraction seam | A thin `MapProvider`/nav-target interface (config-driven) so Mapbox/Google can replace CARTO + nav targets later without UI changes — costs nothing now, de-risks the parked decision | `apps/mobile/src/lib/` |
| `RTE-P9` | Analytics | Emit the PRD `route_planned` analytics event with `stop_count` when a route is optimized/saved | `apps/mobile/app/(tabs)/route.tsx` |

## Park Now

| Slice | Name | What Is Parked | Dependency |
| --- | --- | --- | --- |
| `RTE-K1` | Maps provider + billing | Provider direction (Mapbox vs Google), billing/API-key owner, allowed countries (US vs +Canada). Blocks real road-network distances, a true distance/time-optimized TSP, and turn-by-turn-quality ETAs | Dynamic AQS sign-off + billing account (client deliverable; OQ-MOB-08, maps integration plan) |
| `RTE-K2` | Road-distance / traffic ETA | A real road-distance, traffic-aware ETA and "true" optimization engine. The shipped slice uses straight-line haversine + a flat speed estimate, which is honest and provider-free | Depends on `RTE-K1` (P2, "Requires maps API") |
| `RTE-K3` | Street-level geocoding | Pins are city/state-level (server-derived approximate lat/lng + stub fallback). Street-level optimization/dwell accuracy needs a geocoding job behind the chosen provider; surface estimates honestly until then (the map already shows an "Approximate positions" banner) | Provider geocoding (maps integration plan Phase 2) |
| `RTE-K4` | Server route persistence + sharing | Server-side saved routes / dwell / ETA and manager share/export. `territories.ts` has no `dwell`/`eta`/`savedRoute` fields today; needs new contract fields + an endpoint. Local-first ships without it | Product decision on cross-device sync / manager sharing (PRD "Route sharing/export", P1) |

## Resume Plan When Provider Decision Arrives

When the maps provider + billing are decided:

1. Implement the chosen provider behind the `RTE-P8` abstraction (config-only swap of basemap + nav targets).
2. Replace the haversine + flat-speed estimate with real road-distance / traffic-aware ETA, and a
   provider-backed optimized route variant (extend `TerritoryRoutePlanSummary` from
   `isProviderOptimized: false`).
3. Add a geocoding job for street-level pin accuracy (`RTE-K3`).
4. Optionally add server-side saved-route persistence + manager share/export (`RTE-K4`) if the product
   decision calls for cross-device sync.

## First Implementation Slice

`RTE-P1` + `RTE-P2` (external nav handoff + Navigate action sheet) — the smallest, highest-value,
zero-dependency win, immediately useful in the field. Then `RTE-P3` + `RTE-P4` (multi-select builder
consuming the existing server route plan with an offline nearest-neighbour fallback).

## Acceptance Criteria For First Slice

- Tapping "Navigate" on a route stop (and on a map marker) opens the chosen provider (Waze / Google /
  Apple) navigating to that stop's coordinates, with a Safari web-URL fallback when the app scheme is
  unavailable.
- The last-chosen provider is remembered across launches.
- No API key, no billing account, and no new backend endpoint are required.
- Unit tests cover the nav-URL formatting per provider (incl. the multi-stop waypoints URL) and the
  client-side nearest-neighbour ordering fallback.

## Regression Contract Status

`Mobile-only` for the buildable-now slice — external nav, the builder, dwell/ETA, and saved routes are
client-side (no contract change), covered by mobile unit tests (nav URL formatting, nearest-neighbour
fallback ordering). Consuming the server route plan reuses the existing `TerritoryRoutePlanSummary`
contract unchanged. Server-side persistence (`RTE-K4`) would add `territories.ts` fields and is parked.
