# UX-03 Slice C Admin Users Evidence

Date: 2026-05-31

Status: `Implemented - Admin users cleanup QA passed`

## Scope

This slice applies the UX-03 table/action standard to the Admin user-management route without changing user filters, pagination, create/import modals, password reset, activation/deactivation, role gates, or API contracts.

## Research Basis

The cleanup follows the updated cross-module CRM UX direction:

- Dense enterprise tables should organize information for scanning, keep controls close to the table, right-align numeric data, and keep row actions predictable.
- Large tables should be split, simplified, or converted into focused pages instead of becoming wide all-purpose ledgers.
- Default CRM screens should use progressive disclosure: show the work, keep secondary setup/actions behind menus, and avoid showing controls that do nothing in the current state.

## Changes

- Converted the Admin users table to `WorkbenchTable<AdminUserSummary>`.
- Reduced columns to four decision columns: user, access, sessions, and last login.
- Moved edit, password reset, and activate/deactivate into a row action menu.
- Added a typed filtered empty state.
- Hid `Clear Filters` until a filter is active, which removed an unnecessary default-screen action and satisfied the visual budget.
- Promoted `/admin/users` from a waived task route to an enforced UX visual-budget route.
- Added focused Playwright coverage proving:
  - `/admin/users` loads with `User & Access` active.
  - `Add User` opens the create modal.
  - `Import Users` opens from the header overflow menu.
  - Row actions expose edit/reset/activate-or-deactivate without triggering destructive mutations.

## Verification

Commands run from `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform`:

```bash
pnpm --filter @pulse/crm-web typecheck
node --check apps/crm-web/e2e/route-coverage.spec.mjs
node --check apps/crm-web/e2e/ux-visual.spec.mjs
node --check apps/crm-web/e2e/ux-depth.spec.mjs
node --check apps/crm-web/e2e/flows.spec.mjs
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
- Depth UX gate: `2 passed`
- Targeted flow/persona smoke: `7 passed`

Notes:

- The first visual rerun correctly failed `/admin/users` because the default state had three visible actions: `Add User`, `More user actions`, and inactive `Clear Filters`.
- The product fix was to hide `Clear Filters` until there is an active user filter. The next visual run passed with `/admin/users` at two visible secondary actions and three visible tabs.
- Earlier parallel depth/flow attempts hit `EADDRINUSE` on port `4100` while the visual web server was still running. Sequential reruns passed.

## Evidence

- `output/playwright/ux-03/admin-users-viewport.png`
- `output/playwright/ux-03/admin-users-full.png`
- `output/playwright/ux-03/internal-report.json`
- `output/playwright/ux-03-route-coverage/route-inventory.json`

## Remaining Non-Dependent Work

Continue UX-03 Slice C in this order:

1. Product Management: admin/source-review duplication and preview table cleanup.
2. Training: passive ops queue tables.
3. Territory: registry and bulk lead-transfer table cleanup.
4. Admin: catalog-rule preview rail and publish-safety wording.
5. Leads/Accounts: dense detail pages and list-mode hotspots.
