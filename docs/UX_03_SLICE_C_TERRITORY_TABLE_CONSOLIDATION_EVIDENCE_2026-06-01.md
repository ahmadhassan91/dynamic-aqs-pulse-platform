# UX-03 Slice C Territory Table Consolidation Evidence

Date: 2026-06-01

Status: `Passed`

## Scope

This slice reduced Territory Management clutter without changing the territory kernel, map workspace, reassignment contracts, or approved prototype shell.

## Agent Review Lanes

| Lane | Finding Applied |
| --- | --- |
| Territory dashboard UX | Moved dense workload, region, and owner tables behind `Performance details`, then split them into Workload, Regions, and Owners focus tabs. |
| Territory page redundancy | Removed dashboard duplicate assignment watchlists and the map-tab workload card repeat; the same work remains available through `Needs attention`, List, and Admin work queues. |
| Territory operations | Preserved bulk transfer handlers and reassignment payloads; no backend-wired transfer behavior changed in this slice. |
| QA coverage | Added targeted Playwright assertions for the Territory detail focus gate and required row-action menu behavior. |
| Tracker/docs | Updated UX-03 as still in progress, with Slice D role-first queue consolidation as the next useful slice. |

## Implementation Result

| Area | Result |
| --- | --- |
| Territory dashboard details | `Training`, lifecycle, pipeline, workload, regional rollups, and owner workload now stay behind `Show Details`. |
| Detail table focus | The advanced table set uses an inner focus gate: `Workload`, `Regions`, and `Owners`; hidden tables are not mounted until selected. |
| Workload table | Reduced from a wide multi-column snapshot to four scannable columns: Territory, Ownership, Load, and Signals. |
| Regional rollups | Reduced to Region, Director, Territories, and Attention. |
| Owner workload | Reduced to Owner, Scope, Coverage, and Attention. |
| Duplicate UI removed | Removed the dashboard `Lead assignment watchlist`, dashboard `Customer ownership watchlist`, and map-tab workload card grid instead of shipping repeated surfaces. |
| Row-action coverage | Territory registry row actions are now required by the UX-03 depth test and verified to open/close the `Edit territory` menu. |

## Prototype Surfaces Preserved

- Approved Territory Management shell and primary tabs remain intact.
- `Map View` remains the live MapLibre surface with territory coverage, pins, and shipping centers.
- `Admin Config` / work-queue access remains role-gated.
- The territory list, map, admin, and calendar route model remains unchanged.

## Backend-Wired Surfaces Verified

- Reassignment handlers and bulk transfer payloads were not changed.
- Territory visibility and TM/RD policy behavior were not changed.
- The dashboard still consumes the existing territory dashboard response shape.
- The map still consumes the existing territory map workspace response shape.

## QA Evidence

| Gate | Result |
| --- | --- |
| `pnpm --filter @pulse/crm-web typecheck` | Passed |
| `node --check apps/crm-web/e2e/ux-depth.spec.mjs` | Passed |
| `node --check apps/crm-web/e2e/ux-visual.spec.mjs` | Passed |
| `node --check apps/crm-web/e2e/route-coverage.spec.mjs` | Passed |
| `pnpm --filter @pulse/crm-web exec playwright test -c e2e/playwright.depth.config.mjs --grep "UX-03 slice C advanced tables"` | Passed, 1/1 |
| `pnpm --filter @pulse/crm-web exec playwright test -c e2e/playwright.depth.config.mjs` | Passed, 5/5 |
| `pnpm --filter @pulse/crm-web exec playwright test -c e2e/playwright.visual.config.mjs` | Passed, 1/1 |
| `pnpm --filter @pulse/crm-web run test:route-coverage` | Passed, 1/1 |

## Remaining Non-Dependency UX Gaps

- UX-03 Slice D should consolidate role-first work queues so TM/RD, Training Ops, Consignment Ops, Product/Marketing, and Super Admin all land on daily work before setup/reporting.
- Territory List still has several ledgers available for admin/operator depth; these should stay secondary unless role-first UAT shows a daily-work need on the default route.
- Responsive and keyboard-specific UX gates are still planned under UX-03 Slice F.
