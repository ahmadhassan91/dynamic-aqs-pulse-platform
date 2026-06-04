# UX-04 Slice E - Calendar And Admin IA Tightening

Date: 2026-06-01

Status: `Implemented - focused QA passed`

## Scope

Slice E continued the UX-04 rule: one page, one job, one next safe action. Calendar now behaves like a daily scheduling workbench first, while Admin now leads with user/access work and keeps setup, integrations, catalog rules, and audit evidence one layer deeper.

## Calendar Changes

- Calendar now defaults to `Day` view instead of month view.
- The visible view selector now keeps the daily work modes first: `Day` and `Week`.
- `Month view` and `List view` moved into the header `More` menu as power views.
- Header metrics and attention summaries moved below the schedule so the user sees the actual calendar first.
- Outlook setup controls were removed from the daily calendar surface.
- Header `More` now links admin-capable users to `Manage Outlook in Admin`.
- Event detail uses `WorkbenchDetailRail`.
- The primary event action is now `Open linked record`, shown before dense metadata.
- Contact/location/notes/Outlook handoff moved into `More event details`.
- If Outlook is not connected, Calendar explains that rollout/mailbox setup is managed in Admin instead of showing a connect/setup flow.
- List view now uses `WorkbenchTable` and a typed empty state instead of a raw table.
- Empty range messaging now uses the shared `EmptyStateMessage` pattern.

## Admin Changes

- Main navigation compressed Administration from six sidebar links to two:
  - `Users & Access`
  - `System Setup`
- Admin header copy now makes the daily priority explicit: manage users/access first; setup and evidence stay deeper.
- The `Overview` tab is now labeled `System Setup`.
- `Access Profiles` moved from card grid to comparison table.
- Full role module/action footprint moved into a collapsed `Full access footprint` section.
- Audit Monitor now uses `WorkbenchTable` with typed empty state.
- Catalog Rule Sets now use `WorkbenchTable`.
- Catalog Rule preview metrics now use `WorkbenchMetricStrip`.

## Preserved Behavior

No backend behavior or route was removed. This slice preserves:

- calendar workspace fetch/range/filter behavior
- day/week/month/list calendar renderers
- discovery and training scheduling modal
- event-level Outlook sync for connected users
- admin integration settings and Outlook rollout policy
- admin user creation, import, edit, reset password, activation/deactivation
- access-profile catalog details
- admin audit monitor
- catalog-rule draft, preview, and publish behavior

## UX Rationale

- Daily schedule work should not start with setup, sync, or reporting.
- Admin users should not need to parse integrations/audits/catalog rules before adding or fixing a user.
- Power views and diagnostics remain available, but they do not compete with the first task.
- The implementation follows the UX-04 research basis: progressive disclosure for specialized controls, scannable tables for record sets, and a consistent Workbench pattern for empty states, metrics, and details.

## QA Evidence

Passed:

- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `node --check apps/crm-web/e2e/flows.spec.mjs && node --check apps/crm-web/e2e/ux-depth.spec.mjs && node --check apps/crm-web/e2e/ux-visual.spec.mjs`
- `pnpm --filter @pulse/crm-web test:route-coverage` - 1/1
- `node apps/crm-web/e2e/prepare-e2e.mjs`
- `pnpm --filter @pulse/api test:calendar` - 18/18 calendar, Outlook, and calendar-admin tests
- `pnpm --filter @pulse/api test:admin` - 19/19 admin and password-recovery tests
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.config.mjs --grep "internal workspace auth and core module routes stay backend-wired|admin user management keeps creation, import, and row actions discoverable|RD and TM personas can use scoped Dynamic workspaces"` - 3/3
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.depth.config.mjs --grep "common internal detail modals stay action-light and task-first|TM and RD scoped workspaces avoid setup-first default clutter"` - 2/2
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.visual.config.mjs --grep "capture CRM and dealer default UX budgets"` - 1/1

Notes:

- API suites and Playwright depth/visual suites must run serially because they share the same test database/API port. Initial parallel runs caused expected database/port collisions; sequential reruns passed.
- Acumatica and other external dependencies remain parked. This slice only changed the user-facing IA and Workbench layout.
