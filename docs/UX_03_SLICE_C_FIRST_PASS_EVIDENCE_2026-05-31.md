# UX-03 Slice C First Pass Evidence

Date: 2026-05-31

Status: `Implemented - first pass table/detail standardization QA passed`

Follow-up: `docs/UX_03_SLICE_C_SECOND_PASS_EVIDENCE_2026-05-31.md` continues this pass with Digital Assets delivery/detail tables and Product catalog/readiness tables.

## Scope

This first Slice C pass reduces dense table/detail surfaces without changing backend behavior or permissions.

Landed in this pass:

- Product Catalog setup tables
- Digital Assets library list, share sets, and selected asset detail rail
- Training account/session row actions

Still queued for later Slice C passes:

- Product readiness/detail and Dealer Catalog View evidence rail
- Digital Asset share-link, usage, version, and delivery-health tables
- Territory list, registry, and bulk-transfer tables
- Admin users and catalog-rule preview tables
- Lead and account detail hotspots

## Baseline

UX-03 Slice A/B already shipped the route inventory and label guardrails:

- 42 `crm-web` app routes covered
- 13 visual-budget enforced routes
- 29 explicit route waivers with owner, reason, and expiry

This pass keeps that contract intact while beginning table/detail primitive adoption.

## Changes

### Product Catalog

- Converted Product Catalog `Categories` table to `WorkbenchTable`.
- Converted Product Catalog `Families` table to `WorkbenchTable`.
- Kept existing edit handlers and setup forms unchanged.
- Replaced plain centered no-data rows with typed `EmptyStateMessage` copy.

### Digital Assets

- Converted Library list mode from a 6-column raw table to a 5-column `WorkbenchTable`.
- Combined `Type` and `Access` into one column to meet the Slice C table budget.
- Converted Share Sets to `WorkbenchTable` with row actions.
- Replaced the selected asset side panel wrapper with `WorkbenchDetailRail`.
- Replaced key library/share-set empty states with typed `EmptyStateMessage` variants.

### Training

- Replaced account table inline `Open Account` / `Schedule` buttons with `RowActionMenu`.
- Replaced scheduled-session icon buttons with `RowActionMenu`.
- Preserved all existing permission checks and handlers:
  - account open
  - schedule session
  - reschedule session
  - complete/cancel session

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
- Route coverage: `1 passed`
- Visual UX gate: `1 passed`
- Depth UX gate: `2 passed`

Current generated evidence:

- `output/playwright/ux-03-route-coverage/route-inventory.json`
- `output/playwright/ux-03/internal-report.json`
- `output/playwright/ux-03/dealer-report.json`
- `output/playwright/ux-02-depth/`

Visual report summary after this pass:

- Internal routes: 15, route-ready failures: 0
- Dealer persona routes: 11, route-ready failures: 0

## Acceptance Check

| Slice C acceptance item | First-pass status |
| --- | --- |
| Targeted high-risk tables meet column budgets | Partially met: Product Categories/Families, Digital Asset Library List, and Digital Asset Share Sets now use `WorkbenchTable`; Asset Library list reduced to 5 data columns. |
| Row/card actions use a menu unless there is a real primary inline action | Partially met: Product setup, Digital Asset share sets, and Training account/session rows now use row menus for secondary actions. |
| Detail rails use consistent selected/empty states | Partially met: Digital Asset selected detail now uses `WorkbenchDetailRail` and typed empty state. |

## Remaining Non-Dependent Work

Continue Slice C in this order:

1. Digital Assets second pass: share links, usage, versions, and delivery health tables.
2. Product second pass: readiness table and Dealer Catalog View evidence rail.
3. Training second pass: ops queue table recipe.
4. Territory second pass: territory list, assignment roster, and bulk transfer row actions.
5. Admin second pass: users table and catalog-rule preview table.
6. Leads/Accounts detail pass: reduce dense passive metadata into rails/drawers without touching mutation-heavy lifecycle flows.

No Acumatica, Widen migration execution, real product migration, order placement, payment, route optimization, push, or true offline conflict-resolution dependency was changed in this pass.
