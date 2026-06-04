# UX-05 Slice A - Clutter Budget QA Harness

Date: 2026-06-02

Status: `Implemented - quick gate passed`

## Purpose

UX-05 needs a repeatable way to prove that module pages are becoming less cluttered. Existing visual tests count top-level buttons, tabs, and metrics, but they do not catch below-fold density, table width, repeated row actions, repeated empty states, badge overuse, or dealer-facing internal wording.

This slice adds an opt-in Playwright clutter-budget suite. It starts as a warning-producing measurement harness so the team can baseline current screens, then tighten thresholds as UX-05 slices land.

## Implemented

- Added `apps/crm-web/e2e/ux-clutter.spec.mjs`.
- Added `apps/crm-web/e2e/playwright.clutter.config.mjs`.
- Added CRM web scripts:
  - `pnpm --filter @pulse/crm-web test:ux-clutter:quick`
  - `pnpm --filter @pulse/crm-web test:ux-clutter`
- Quick mode runs only critical routes:
  - Lead Detail
  - Training default
  - Consignment default
  - Digital Assets default
  - Admin Business Rules
  - Dealer Catalog
- Full mode includes additional defaults and deep/setup routes for Accounts, Calendar, Territory, Product, Dealer Portal, and optional Consignment Site detail when fixture data is present.
- The scripts now build required packages, build CRM web, reseed E2E data with `prepare-e2e.mjs`, and then run the Playwright clutter suite. This avoids stale fixture IDs.
- Dealer portal checks include internal/provider vocabulary findings for terms such as `ERP`, `Widen`, `migration`, `resolver`, `source system`, and `Dealer Catalog View`.

## Metrics Captured

Per route, the suite records:

- first-viewport section count
- full visible heading/section count
- top-level panel/card count
- scroll height and viewport-screen ratio
- visible table count
- max visible table columns
- visible row action count
- max row actions per row
- repeated empty-state count
- hero badge count
- visible badge count
- visible primary and secondary buttons
- visible tabs
- sample labels for noisy metrics
- viewport and full-page screenshots

## Artifacts

Runtime evidence is written under:

- `output/playwright/ux-05-clutter/`
- `output/playwright/ux-05-clutter-test-results/`

Current quick-run reports:

- `output/playwright/ux-05-clutter/internal-summary.json`
- `output/playwright/ux-05-clutter/dealer-summary.json`
- `output/playwright/ux-05-clutter/internal-clutter-report.json`
- `output/playwright/ux-05-clutter/dealer-clutter-report.json`

## Latest Quick Gate Result

Command:

```bash
pnpm --filter @pulse/crm-web test:ux-clutter:quick
```

Result:

- Passed: 2/2 Playwright tests.
- Internal critical routes rendered: 5/5.
- Dealer critical routes rendered: 1/1.
- Internal warnings: 0.
- Dealer warnings: 0.

Final warning state:

| Route | Warning |
| --- | --- |
| None | Critical quick-gate routes are within the current Slice A warning budgets. |

The first quick run identified Lead Detail badge overload. Slice B started immediately by moving source, brand, routing team, and rating out of hero badges into a quiet fact line. The final quick run proves Lead Detail now has 2 hero badges and 8 visible page badges against the current targets.

## Validation

- `node --check apps/crm-web/e2e/ux-clutter.spec.mjs` passed.
- `node --check apps/crm-web/e2e/playwright.clutter.config.mjs` passed.
- CRM web `package.json` parsed successfully.
- `pnpm --filter @pulse/crm-web test:route-coverage` passed: 1/1.
- `pnpm --filter @pulse/crm-web test:ux-clutter:quick` passed: 2/2.
- `pnpm --filter @pulse/crm-web typecheck` passed after the Lead Detail header cleanup.

## Next Use

UX-05 Slice B has continued with the Lead Detail and Intake action-first cleanup. Lead Detail now has 2 hero badges and a 3-tab shell (`Overview`, `Work`, `Activity Log`), with Discovery/CIS/Onboarding staged inside the `Work` flow. New Intake is now staged as `Customer -> Routing -> Review`, with OCR in Customer, separate affinity/ownership routing axes, and duplicate preview in Review. Remaining Slice B work is lifecycle-control cleanup and a full non-critical clutter pass before Slice C.
