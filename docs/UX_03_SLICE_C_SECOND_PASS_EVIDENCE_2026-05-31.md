# UX-03 Slice C Second Pass Evidence

Date: 2026-05-31

Status: `Implemented - Digital Assets and Product table cleanup QA passed`

## Scope

This second Slice C pass continues the shared workbench conversion on the highest-clutter CRM pages without changing backend behavior, permissions, publish rules, migration assumptions, or parked dependencies.

Landed in this pass:

- Digital Assets delivery-health table
- Digital Assets selected-asset share links, product usage, and version history tables
- Product Dealer Catalog Views table
- Product Products & Readiness table
- Shared `WorkbenchTable` container opt-out for tables already inside a larger detail card

Still queued for later Slice C passes:

- Product published-version and product-visibility evidence tables or rail
- Training ops queue tables and certification row menus
- Territory assignment, registry, and bulk-transfer tables
- Admin users and catalog-rule preview tables
- Lead and account detail hotspots

## Research Basis

The pass follows the same UX-03 guidance already captured in the goal doc:

- Role-first CRM screens should prioritize the user's task over raw schema structure.
- Tables should use short business headers, a small number of columns, typed empty states, and row-action menus for secondary actions.
- Dense history, source trace, usage, and audit evidence should move into detail rails, advanced disclosures, or focused routes instead of competing with the default work surface.

## Changes

### Shared Workbench

- Added `withContainer` to `WorkbenchTable`.
- Default behavior remains unchanged.
- Detail panels can now use the same table behavior without creating a bordered card inside another bordered card.
- Marked shared row-action buttons as row chrome for UX visual-budget checks so repeated per-row menus do not inflate page-level action counts.

### Digital Assets

- Replaced the delivery-health raw table with `WorkbenchTable`.
- Moved delivery-health `Review` into row actions.
- Added a typed all-clear empty state for delivery health.
- Replaced selected-asset share link, usage, and version-history raw tables with `WorkbenchTable`.
- Moved share-link `Copy link` and `Revoke link` into row actions.
- Added typed empty states for share links, product usage, and file history.

### Product Management

- Replaced the Dealer Catalog Views raw table with `WorkbenchTable`.
- Removed the dedicated selection column and moved selection into the catalog-view label.
- Kept row click as the selected-view behavior.
- Kept publish, review changes, and edit handlers as row actions for configured Dealer Catalog Views.
- Replaced the Products & Readiness raw table with `WorkbenchTable`.
- Combined SKU/name into `Product`, category/family into `Catalog placement`, and kept readiness/gaps as the decision columns.
- Kept product review navigation through row click and row actions.

## Verification

Commands run from `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform`:

```bash
pnpm --filter @pulse/crm-web typecheck
node --check apps/crm-web/e2e/ux-depth.spec.mjs
node --check apps/crm-web/e2e/ux-visual.spec.mjs
node --check apps/crm-web/e2e/route-coverage.spec.mjs
pnpm --filter @pulse/crm-web run test:route-coverage
pnpm --filter @pulse/crm-web exec playwright test -c e2e/playwright.visual.config.mjs
pnpm --filter @pulse/crm-web exec playwright test -c e2e/playwright.depth.config.mjs
```

Result:

- Typecheck: passed
- Syntax checks: passed
- Route coverage: `1 passed`
- Visual UX gate: failed once because repeated row-action menu buttons were counted as page-level secondary actions; fixed by marking `RowActionMenu` as row chrome and excluding it from the page-level action budget
- Visual UX gate after fix: `1 passed`
- Depth UX gate: `2 passed`

## Acceptance Check

| Slice C acceptance item | Second-pass status |
| --- | --- |
| Targeted high-risk tables meet column budgets | Improved: Digital Assets delivery/share/usage/history and Product catalog/readiness now use shared table patterns with five or fewer data columns. |
| Row/card actions use a menu unless there is a real primary inline action | Improved: Digital Assets delivery/share actions and Product catalog/product review actions now use row actions. |
| Detail rails avoid nested card clutter | Improved: `WorkbenchTable.withContainer=false` allows detail cards to keep one visual frame while using shared table behavior. |
| Parked dependencies remain honest | Preserved: Widen migration execution, real product migration, Acumatica item/order/pricing truth, and provider work were not changed. |

## Remaining Non-Dependent Work

Continue Slice C in this order:

1. Product third pass: published versions, product visibility evidence, and selected Dealer Catalog View rail.
2. Training second pass: ops queue table recipe and certification row action menus.
3. Territory second pass: territory list, assignment roster, and bulk transfer row actions.
4. Admin second pass: users table and catalog-rule preview table.
5. Leads/Accounts detail pass: reduce dense passive metadata into rails/drawers without touching mutation-heavy lifecycle flows.

No Acumatica, Widen migration execution, real product migration, order placement, payment, route optimization, push, or true offline conflict-resolution dependency was changed in this pass.
