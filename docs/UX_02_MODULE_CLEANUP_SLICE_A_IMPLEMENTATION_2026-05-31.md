# UX-02 Module Cleanup Slice A Implementation

Date: 2026-05-31

Status: `Implemented - CRM and Dealer Portal default visual budgets pass`

## Scope

This slice continues `UX-02 Practical Workbench Hardening` from:

- `docs/superpowers/plans/2026-05-26-pulse-crm-ui-ux-optimization.md`
- `docs/UX_02_FOUNDATION_SLICE_IMPLEMENTATION_2026-05-26.md`

The goal was to simplify every developed default module page so users see one clear workbench path instead of a wall of buttons, tabs, cards, empty panels, and setup/report controls.

## Agent Team

| Agent | Scope | Result |
| --- | --- | --- |
| Worker 1 | Leads | Defaulted `/leads` to the pipeline, reduced hero actions, moved review actions into More, and stopped kanban columns from counting as top metric cards. |
| Worker 2 | Territory and Training | Reduced visible Territory and Training tabs, moved admin/reporting into More, consolidated detail panels, and hid zero-count rows. |
| Worker 3 | Product and Digital Assets | Reframed Product Management around dealer catalog views and readiness, moved setup/import actions behind More, and simplified Digital Asset share-set flows. |
| Worker 4 | Dealer Portal | Simplified dealer dashboards/catalog for admin, affinity, ownership, independent, and hybrid personas; removed repeated empty/boolean noise. |
| Worker 5 | Admin, Calendar, Accounts, Consignment | Converted repeated buttons into selects/menus/links, removed duplicate admin CTAs, tightened account list/detail actions, and consolidated consignment empty states. |

## Key UX Changes

### Cross-Module Rules Now Enforced

- Default route first viewport has at most one primary CTA.
- Default route first viewport has at most two visible secondary actions.
- Default route first viewport has at most four top metric cards.
- Default route has at most four visible tabs; admin, setup, reports, import, and migration move into More when not the default job.
- Default route has at most one repeated empty-state panel.

### Module Cleanup Highlights

- Leads now opens on Pipeline, not a duplicated overview/action hub.
- Territory hides admin/calendar behind the tab More menu and moves refresh into the header More menu.
- Territory default watchlists are scannable record links instead of repeated row-action menus.
- Training keeps Reports/Admin under More and uses a single all-clear attention message.
- Calendar uses a compact view select instead of three competing view buttons.
- Product detail treats Check Readiness as the single primary action.
- Digital Assets treats Upload Files as the single primary action, with share/import/setup tasks in More.
- Business Rules keeps dependency notes visible as static context instead of another disclosure action.
- Dealer Portal default dashboards and catalogs pass the same visual budget across all seeded personas.

## Files Changed In This Slice

- `apps/crm-web/src/app/leads/page.tsx`
- `apps/crm-web/src/components/leads/LeadWorkspace.tsx`
- `apps/crm-web/src/components/territories/TerritoryManagement.tsx`
- `apps/crm-web/src/components/territories/TerritoryCommandDashboard.tsx`
- `apps/crm-web/src/components/training/TrainingWorkspace.tsx`
- `apps/crm-web/src/components/product-management/ProductManagementWorkspace.tsx`
- `apps/crm-web/src/components/product-management/ProductDetailWorkspace.tsx`
- `apps/crm-web/src/components/digital-assets/DigitalAssetsWorkspace.tsx`
- `apps/crm-web/src/components/dealer/DealerDashboard.tsx`
- `apps/crm-web/src/components/dealer/DealerCatalog.tsx`
- `apps/crm-web/src/components/dealer/DealerAccountCenter.tsx`
- `apps/crm-web/src/components/calendar/CalendarWorkspace.tsx`
- `apps/crm-web/src/components/admin/AdminWorkspace.tsx`
- `apps/crm-web/src/components/admin/AdminCatalogRulesWorkspace.tsx`
- `apps/crm-web/src/components/customers/CustomerList.tsx`
- `apps/crm-web/src/components/customers/CustomerDetail.tsx`
- `apps/crm-web/src/components/consignment/ConsignmentWorkspace.tsx`
- `apps/crm-web/e2e/flows.spec.mjs`
- `apps/crm-web/e2e/playwright.config.mjs`
- `apps/crm-web/e2e/ux-visual.spec.mjs`
- `apps/crm-web/e2e/playwright.visual.config.mjs`

## Verification

Passed:

```bash
node --check apps/crm-web/e2e/flows.spec.mjs
node --check apps/crm-web/e2e/ux-visual.spec.mjs
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web exec playwright test e2e/flows.spec.mjs --config e2e/playwright.config.mjs --grep "navigation|internal workspace auth"
pnpm --filter @pulse/crm-web exec playwright test --config e2e/playwright.visual.config.mjs
```

Flow regression result:

```text
4 passed
```

Visual budget result:

```text
1 passed
```

Route budget summary:

| Route Set | Before Module Cleanup | After Module Cleanup |
| --- | ---: | ---: |
| Internal CRM routes | 1/14 passing | 14/14 passing |
| Dealer Portal persona routes | 3/11 passing | 11/11 passing |

Latest evidence:

- `output/playwright/ux-02/internal-report.json`
- `output/playwright/ux-02/dealer-report.json`
- `output/playwright/ux-02/*-viewport.png`
- `output/playwright/ux-02/*-full.png`

## Current Route Budget Status

| Route | Status |
| --- | --- |
| `/leads` | Pass |
| `/calendar` | Pass |
| `/territories` | Pass |
| `/training` | Pass |
| `/consignment` | Pass |
| `/product-management` | Pass |
| `/product-management?tab=visibility` | Pass |
| Product detail | Pass |
| `/digital-assets` | Pass |
| `/digital-assets?tab=collections` | Pass |
| `/customers` | Pass |
| Account detail | Pass |
| `/admin` | Pass |
| `/admin/catalog-rules` | Pass |
| Dealer dashboard/catalog/account personas | Pass |

## Remaining UX-02 Work

This slice proves the default-page density budget, but it does not finish all UX hardening:

- Do deeper role-based task testing with Dynamic AQS personas, especially Territory Manager and Regional Director.
- Review detail pages and modals for the same simplicity rules beyond first viewport.
- Re-check mobile app UX against the workbench contract.
- Keep Acumatica/product migration/order/payment/inventory details parked behind dependency language until certified source access exists.
