# UX-04 Slice C - Product And Digital Assets Implementation

Date: 2026-06-01

Status: `Implemented - focused QA passed`

## Scope

Slice C simplified the Product Management and Digital Assets workspaces around the UX-04 rule: one page, one job, one next safe action. The change keeps existing backend behavior intact while moving setup, migration, source trace, matching details, and dense detail work behind More or Advanced sections.

## Product Management Changes

- Product sidebar now exposes only daily work: `Catalog Readiness` and `Dealer Catalog Views`.
- Category and family setup stays reachable from Product Management `More` as `Catalog Placement`.
- `Legacy Product Review` was renamed to `Source Review` and remains preview-only.
- Dealer Catalog View detail rail is now a `publish checklist`, with `Missing Visibility` and `Live Version` labels.
- Dealer Catalog View create/edit now reads as an audience builder:
  - `Audience name`
  - `Internal staff label`
  - `Audience type`
  - Region or brand fields only when scoped audience types apply
  - priority and matching code stay inside `Advanced matching details`
- Product detail is now a four-section readiness board:
  - `Content`
  - `Files`
  - `Dealer Visibility`
  - `Checks`
- Product detail primary action is gap-aware:
  - missing content -> `Edit Catalog Content`
  - missing files -> `Attach File`
  - missing visibility -> `Add to Dealer Catalog View`
  - otherwise -> `Check Readiness`
- Product file, visibility, and check ledgers use `WorkbenchTable` instead of raw tables.
- Product visibility modal now does one default job: add/edit this product in a Dealer Catalog View. Scope, audience override, and notes live in `Advanced scope and notes`.

## Digital Assets Changes

- Digital Assets sidebar now exposes only daily work: `Asset Library`, `Share Sets`, and `Needs Attention`.
- `Advanced Import` was renamed to `Migration Review` and remains reachable from the workspace `More` menu.
- Asset detail puts fast actions first:
  - `Open file`
  - `Copy file link`
  - `Create share link`
- Share work is labeled `Share this file`.
- Asset edit fields moved into collapsed `Marketing details`.
- Attach/replace file and version history moved into collapsed `File versions`.
- `Source trace` was renamed to `Source and migration trace` and remains collapsed.
- Bulk upload is now staged:
  - select files
  - review detected file details
  - apply defaults
  - upload files

## Cross-Module Visual Cleanup Found During QA

The full visual budget run also exposed two remaining UX-04 Slice A leaks:

- Lead pipeline showed action buttons on every attention card even when the count was zero.
- Lead Kanban showed repeated `No leads in this stage` messages.
- Account follow-up queue showed a visible `Open` button on every row.

Those were cleaned in the same pass:

- Lead attention actions now render only when the count is actionable.
- Empty Kanban columns no longer repeat empty-state text.
- Account rows use the account name link as the open path instead of repeating `Open` buttons.

## Preserved Backend Behavior

No Product Management or Digital Assets backend contract was changed. This slice preserves:

- category/family CRUD
- Dealer Catalog View CRUD
- catalog inclusion create/update
- product asset attach/unlink
- readiness validation
- catalog snapshot compare/publish/rollback
- digital asset create/update/versioning
- share link create/copy/revoke
- Widen migration preview/review boundaries
- dealer portal catalog and file visibility gates

## QA Evidence

Passed:

- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `node --check apps/crm-web/e2e/ux-depth.spec.mjs && node --check apps/crm-web/e2e/ux-visual.spec.mjs && node --check apps/crm-web/e2e/route-coverage.spec.mjs`
- `pnpm --filter @pulse/crm-web run test:route-coverage` - 1/1
- `node apps/crm-web/e2e/prepare-e2e.mjs`
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.depth.config.mjs --grep "common internal detail modals|UX-03 slice D role-first queues|UX-03 product and asset detail surfaces"` - 3/3
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.visual.config.mjs` - 1/1
- `pnpm --filter @pulse/api test:product-management` - 17/17
- `pnpm --filter @pulse/api test:digital-assets` - 9/9
- `pnpm --filter @pulse/api test:dealer-portal` - 15/15

Notes:

- Product, Digital Assets, and Dealer Portal API suites must run sequentially because they share and truncate `pulse_platform_test`.
- Initial parallel API runs produced deadlocks/foreign-key noise from concurrent database resets, then passed when rerun sequentially.
