# UX-02 Foundation Slice Implementation

Date: 2026-05-26

Status: `Implemented - shared foundation and visual budget gate are in place; module budget failures intentionally remain for next cleanup slices`

## Scope

This slice starts the `UX-02 Practical Workbench Hardening` goal from:

- `docs/superpowers/plans/2026-05-26-pulse-crm-ui-ux-optimization.md`

The goal is to reduce cross-module clutter by creating shared workbench primitives, flattening navigation active-state issues, reducing decorative styling noise, and adding Playwright visual budget evidence.

## Agent Team

| Agent | Scope | Result |
| --- | --- | --- |
| Worker A | Shared Workbench primitives | Added typed primitives in `apps/crm-web/src/components/ui/Workbench.tsx` while preserving existing exports. |
| Worker B | Styling foundation | Flattened premium surfaces, removed radial workbench background, added Pulse semantic theme colors. |
| Worker C | UX visual budget tests | Added route-level budget capture and screenshot/report evidence under `output/playwright/ux-02/`. |
| Worker D | Navigation active states | Fixed Territory Map and Dealer Account Health active states, added regression tests. |
| Explorer E | Product/assets/dealer scout | Produced the next-slice implementation map for Dealer Catalog Views, Digital Assets, and Dealer Portal wording. |

## Files Changed

- `apps/crm-web/src/components/ui/Workbench.tsx`
- `apps/crm-web/src/app/globals.css`
- `apps/crm-web/src/components/providers/AppProviders.tsx`
- `apps/crm-web/src/components/layout/Navigation.tsx`
- `apps/crm-web/src/components/layout/DealerNavigation.tsx`
- `apps/crm-web/e2e/flows.spec.mjs`
- `apps/crm-web/e2e/ux-visual.spec.mjs`
- `apps/crm-web/e2e/playwright.visual.config.mjs`
- `docs/superpowers/plans/2026-05-26-pulse-crm-ui-ux-optimization.md`

## Implemented

### Shared Workbench Primitives

`Workbench.tsx` now exports:

- `WorkbenchPage`
- `WorkbenchHeader`
- `WorkbenchPrimaryActions`
- `WorkbenchAttentionLane`
- `WorkbenchMetricStrip`
- `WorkbenchTable`
- `WorkbenchDetailRail`
- `WorkbenchMoreMenu`
- `StatusBadge`
- `RowActionMenu`
- `EmptyStateMessage`
- Existing compatibility exports: `WorkbenchAttentionPanel`, `WorkbenchAdvancedSection`

These are intentionally generic and contain no module-specific business logic.

### Styling Foundation

- Removed the broad radial background from `.residential-content-container`.
- Normalized premium surfaces to flat CRM workbench cards.
- Added Pulse semantic theme colors:
  - `pulseBlue`
  - `pulseOrange`
  - `pulseRed`
- Defaulted Mantine Paper/Card/Button/Badge/Modal/Drawer styling toward medium-radius, low-shadow operational UI.
- Added `.premium-detail-card`, which existing components already reference.

### Navigation Fixes

- `Navigation.tsx` now supports single-child flattening and `aria-current`.
- Territory Map now links to `/territory_map` instead of competing with the `/territories?tab=map` tab state.
- `DealerNavigation.tsx` now tracks URL hash so `/dealer/account` and `/dealer/account#account-health` do not both show as active.
- Regression tests were added for:
  - Territory Hub active state
  - Territory Map active state
  - Consignment and Training direct links
  - Account Center vs Account Health hash state

### Visual Budget Gate

`ux-visual.spec.mjs` now captures:

- route readiness
- screenshots
- primary button count
- secondary visible action count
- top metric count
- visible tab count
- empty panel count
- sample labels for failures

Evidence output:

- `output/playwright/ux-02/internal-report.json`
- `output/playwright/ux-02/dealer-report.json`
- `output/playwright/ux-02/*.png`
- failure artifacts under `output/playwright/ux-02-test-results/`

The visual config now builds the web app with visual-test env before `next start`, avoiding stale `.next` builds that pointed to the wrong API URL.

## Verification

Passed:

```bash
node --check apps/crm-web/e2e/ux-visual.spec.mjs
node --check apps/crm-web/e2e/playwright.visual.config.mjs
node --check apps/crm-web/e2e/flows.spec.mjs
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web exec playwright test --list --config e2e/playwright.visual.config.mjs
pnpm --filter @pulse/crm-web exec playwright test e2e/flows.spec.mjs --config e2e/playwright.config.mjs --grep "navigation"
```

Navigation regression result:

```text
3 passed
```

Visual budget run:

```bash
pnpm --filter @pulse/crm-web exec playwright test --config e2e/playwright.visual.config.mjs
```

Result:

```text
1 failed
```

This failure is expected at this stage. All routes were reachable after the timing fix, and the failing assertions are genuine UX budget violations that define the next cleanup work.

## Current Visual Budget Findings

| Route | Status |
| --- | --- |
| `/digital-assets` | Pass |
| `/dealer/dashboard` as admin | Pass |
| `/dealer/account` | Pass |
| `/dealer/catalog` as hybrid | Pass |
| `/leads` | Fails secondary actions and top metric budget |
| `/calendar` | Fails secondary action budget |
| `/territories` | Fails secondary actions, top metrics, and tab budget |
| `/training` | Fails secondary actions and tab budget |
| `/consignment` | Fails repeated empty panel budget |
| `/product-management` | Fails secondary actions and tab budget |
| `/product-management?tab=visibility` | Fails primary action, secondary actions, and tab budget |
| Product detail | Fails secondary actions and empty panel budget |
| `/digital-assets?tab=collections` | Fails secondary action budget |
| `/customers` | Fails secondary action budget |
| Account detail | Fails secondary action budget |
| `/admin` | Fails secondary actions and tab budget |
| `/admin/catalog-rules` | Fails secondary action budget |
| Dealer catalog personas | Fail secondary action budget except hybrid empty catalog |
| Dealer non-admin dashboards | Fail repeated empty panel budget |

## Next Recommended Slice

Run the next parallel slice against the highest-budget failures:

1. Leads: move below-fold row/card actions into row menus and stop counting kanban/stage panels as metric cards.
2. Territory: collapse drilldown/watchlist controls and reduce visible tabs to four.
3. Training: move Reports/Admin under More and reduce first-screen action buttons.
4. Product Management: change to Dealer Catalog View first, move Categories/Families into Setup, reduce tab count.
5. Dealer Portal: collapse catalog filters/actions and remove repeated empty "No" style cells from dashboard default views.

Digital Assets Library is the first route to pass the UX-02 visual budget and should be treated as a reference pattern.
