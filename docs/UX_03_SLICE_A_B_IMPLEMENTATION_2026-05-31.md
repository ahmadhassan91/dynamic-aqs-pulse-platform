# UX-03 Slice A/B Implementation Evidence

Date: 2026-05-31

Status: `Implemented - route coverage and label/navigation QA passed`

## Scope

This slice implements UX-03 Slice A and the low-risk parts of Slice B for `crm-web`.

Implemented:

- Route inventory gate for every `apps/crm-web/src/app/**/page.tsx`
- Visual-budget enforcement or explicit waiver for default module routes and captured UX routes
- Shared Workbench checklist and terminology map
- Dealer/catalog/admin label alignment across targeted CRM and Dealer Portal surfaces
- Dealer-facing removal of parked commerce role copy in active portal UI

## Key Changes

- Added a no-browser Playwright route coverage gate:
  - `apps/crm-web/e2e/route-coverage.spec.mjs`
  - `apps/crm-web/e2e/playwright.route-coverage.config.mjs`
  - `apps/crm-web/package.json` script: `test:route-coverage`
- Promoted visual-budget enforcement for `calendar`, `accounts`, `dealer account`, `territory map`, product visibility, and digital asset share sets.
- Added explicit visual waivers for dense/detail/advanced routes that are intentionally deferred to UX-03 Slice C.
- Updated visual output from `output/playwright/ux-02/` to `output/playwright/ux-03/`.
- Excluded embedded MapLibre controls from page-level action-button clutter counting.
- Added Workbench guardrail comments for page contract, tables, detail rails, and typed empty states.
- Added UX-03 terminology map and module-page checklist in `docs/UX_03_CROSS_MODULE_CLARITY_GOAL_2026-05-31.md`.
- Aligned live labels:
  - Internal CRM: `Dealer Catalog View`, `Who sees it`, `Access Profiles`
  - Dealer Portal: `Your product catalog`, `Products & Files`, `Account Health`
  - Assets: `Who can see this asset/set`, `Advanced catalog visibility`
  - Admin rules: `Draft Rule Set`, `Priority`

## Verification

Commands run from `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform`:

```bash
node --check apps/crm-web/e2e/route-coverage.spec.mjs
node --check apps/crm-web/e2e/playwright.route-coverage.config.mjs
node --check apps/crm-web/e2e/ux-visual.spec.mjs
pnpm --filter @pulse/crm-web run test:route-coverage
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web exec playwright test -c e2e/playwright.visual.config.mjs
```

Result:

- Route coverage: `1 passed`
- Typecheck: passed
- Visual UX gate: `1 passed`
- Visual reports:
  - `output/playwright/ux-03/internal-report.json`: 15 routes, 0 route-ready failures, 0 enforced over-budget routes
  - `output/playwright/ux-03/dealer-report.json`: 11 persona routes, 0 route-ready failures, 0 enforced over-budget routes

## Route Coverage Summary

Canonical report: `output/playwright/ux-03-route-coverage/route-inventory.json`

- Total app routes: 42
- Visual-budget enforced routes: 13
- Waived routes: 29

Waiver policy:

- Every waived route has owner, reason, and expiry.
- Waivers cover redirects, auth/token public routes, dense detail routes, report/task routes, admin/provider setup routes, and parked-dependency surfaces.
- Dense detail and table-heavy routes are deferred to UX-03 Slice C, not ignored.

## Acceptance Evidence

- `docs/UX_03_CROSS_MODULE_CLARITY_GOAL_2026-05-31.md`
- `docs/UX_03_SLICE_A_B_IMPLEMENTATION_2026-05-31.md`
- `apps/crm-web/e2e/route-coverage.spec.mjs`
- `apps/crm-web/e2e/playwright.route-coverage.config.mjs`
- `apps/crm-web/e2e/ux-visual.spec.mjs`
- `apps/crm-web/src/components/ui/Workbench.tsx`
- `output/playwright/ux-03-route-coverage/route-inventory.json`
- `output/playwright/ux-03/internal-report.json`
- `output/playwright/ux-03/dealer-report.json`

## Remaining UX-03 Work

Next: UX-03 Slice C.

Priority targets:

1. Product management tables and product detail rail
2. Digital asset library/detail/share set tables
3. Training account/session/ops tables
4. Territory list, registry, and bulk transfer tables
5. Admin users/rules tables
6. Lead and account detail hotspots

Goal for Slice C: convert high-risk hand-rolled tables/detail panels to shared workbench primitives, reduce default tables toward five data columns plus one row action menu, and move dense metadata/history/source trace into rails, drawers, or detail routes.
