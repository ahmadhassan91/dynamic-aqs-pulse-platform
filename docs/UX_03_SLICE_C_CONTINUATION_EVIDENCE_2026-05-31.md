# UX-03 Slice C Continuation Evidence

Date: 2026-05-31

Status: `Implemented - Product/Training/Territory/Admin catalog QA passed`

## Scope

This continuation slice keeps the UX-03 table/detail cleanup moving across the next safest CRM surfaces without changing backend behavior, permissions, publish rules, territory transfer state, or training decision workflows.

Landed in this pass:

- Product Management selected Dealer Catalog View evidence rail
- Product Management selected-view product visibility table
- Product Management published-version history table
- Training certification decision/revocation row actions
- Training execution exception account navigation row action
- Territory bulk customer transfer row actions
- Admin users table/action cleanup
- Product Management admin readiness/source-review duplication cleanup
- Training passive ops queue tables
- Territory registry and bulk lead-transfer table cleanup
- Admin catalog-rule sampled preview table

Still queued for later Slice C passes:

- Lead and account detail hotspots
- Digital Asset delivery-health/detail density
- Product detail readiness/files/history density

## Changes

### Product Management

- Added a selected Dealer Catalog View evidence rail on the `Who sees it` tab.
- Scoped product visibility evidence to the selected Dealer Catalog View instead of showing one global visibility table.
- Moved published-version history into a shared table inside the evidence rail pattern.
- Kept publish, rollback, review changes, edit, row selection, and product navigation handlers intact.
- Cleared stale snapshot state when the selected Dealer Catalog View changes.

### Training

- Replaced inline `Resolve` certification decision buttons with `RowActionMenu`.
- Replaced inline `Revoke` certification buttons with `RowActionMenu`.
- Replaced execution exception `Open Account` inline button with `RowActionMenu`.
- Preserved existing permission gates and modal-backed decision/revocation handlers.

### Territory

- Replaced bulk customer transfer inline `Open` / `History` buttons with `RowActionMenu`.
- Preserved account selection state, visible-select behavior, bulk transfer payloads, and assignment history behavior.

### Admin

- Converted Admin user management to `WorkbenchTable`.
- Reduced Admin user rows to user, access, sessions, last login, and one row action menu.
- Kept create, import, edit, password reset, activate/deactivate, filtering, and pagination behavior intact.
- Hid `Clear Filters` until filters are active so default user management stays within the action budget.
- Promoted `/admin/users` to visual-budget enforcement.
- Converted Admin catalog-rule preview into sampled account decisions and sampled catalog-view impact tables.
- Added explicit copy that sampled preview covers affinity, ownership/PE, independent status, region, and portal eligibility only.
- Kept Acumatica/product-pricing/order/inventory and brand/private-label source decisions parked until certified.

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
pnpm --filter @pulse/crm-web exec playwright test e2e/flows.spec.mjs --config e2e/playwright.config.mjs --grep "admin user management|navigation|internal workspace auth|RD and TM personas|dealer catalog personas"
```

Result:

- Typecheck: passed
- Syntax checks: passed
- Route coverage: `1 passed`
- Visual UX gate: `1 passed`
- Depth UX gate: `3 passed`
- Targeted flow/persona smoke: `7 passed`
- The first `/admin/users` visual rerun correctly failed because inactive `Clear Filters` created a third visible default action; hiding it until filters are active fixed the budget and the next visual run passed.
- A later depth rerun correctly caught a test expectation bug: the new assertion looked for `Territory registry` on `/territories?tab=admin`, but the approved tab model places that table under `/territories?tab=list`. The assertion was corrected and the next depth run passed.
- Earlier parallel depth/flow attempts failed because another Playwright web server already occupied port `4100`; sequential reruns passed.

## Acceptance Check

| Slice C acceptance item | Continuation status |
| --- | --- |
| Dense evidence moves out of default tables | Improved: Product global visibility evidence is now scoped to the selected Dealer Catalog View rail. |
| Row/card actions use a menu unless there is a real primary inline action | Improved: Training certification/exception rows and Territory bulk customer transfer rows now use row menus. |
| Admin task routes avoid raw table/action clutter | Improved: Admin users now uses the shared table pattern, one row action menu, and a typed empty state. |
| Sampled/admin previews are honest about proof depth | Improved: Product legacy preview and Admin catalog-rule preview now say what is sampled/review-only and what remains parked. |
| Backend-wired behavior stays intact | Passed: handlers, permission gates, selection state, transfer payloads, publish/rollback actions, and product/account navigation were preserved. |
| Parked dependencies remain honest | Preserved: Acumatica product/order/pricing truth, Widen migration execution, provider work, order placement, route optimization, and true offline sync were not changed. |

## Remaining Non-Dependent Work

Continue Slice C in this order:

1. Leads/Accounts: dense detail pages and list-mode hotspots.
2. Digital Assets: delivery-health and detail/version/source-trace density.
3. Product Detail: readiness/files/history drill-in cleanup.
4. Territory: table consolidation after registry/lead row-action cleanup.
5. UX gates: responsive and keyboard/focus coverage for row-action menus and More menus.
