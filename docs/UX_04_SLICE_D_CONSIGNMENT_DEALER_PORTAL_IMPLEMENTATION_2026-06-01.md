# UX-04 Slice D - Consignment And Dealer Portal Plain-Language Ops

Date: 2026-06-01

Status: `Implemented - focused QA passed`

## Scope

Slice D simplified Consignment and Dealer Portal screens around the UX-04 rule: one page, one job, one next safe action. The change keeps Acumatica, catalog-rule, membership, and portal provisioning truth intact while moving provider, parked dependency, and internal diagnostic wording away from daily operator and dealer surfaces.

## Consignment Changes

- Consignment header now describes daily work as site readiness, document evidence, ROSE audits, and follow-up ownership.
- `Ready For Warehouse` user-facing filter/metric copy is now `Ready For Setup`.
- Create-site flow is labeled `Add Consignment Site`.
- Optional warehouse setup input moved into `Advanced setup` as `Warehouse note`.
- Site list now uses `WorkbenchTable` with row actions instead of a raw table/action-icon pattern.
- `Reconciliation` default column is now plain `Site issue`.
- Row issue copy now says `Needs review` / `Clear` instead of manual variance language.
- Follow-up queue now uses `WorkbenchTable` with row actions and typed empty state.
- Frontend work-queue subjects normalize to:
  - `Site issue needs review`
  - `Warehouse setup waiting`
  - `Consignment workflow follow-up`
- Consignment site detail primary action copy is plain-language:
  - `Confirm baseline`
  - `Finish audit`
  - `Mark Active`
- Site detail setup dependency copy now says `Warehouse setup is waiting for the approved handoff`.
- Advanced site detail section is now `Setup and documents`.
- Audit history column is now `Site issue`, with values like `Needs review`, `Follow-up confirmed`, and `Resolved`.

## Dealer Portal Changes

- Dealer navigation no longer shows the `ERP pending` badge.
- Dealer dashboard no longer exposes raw portal eligibility status as a hero badge.
- Dealer dashboard territory fallback now says `Team assignment pending`.
- Account Health copy now uses plain support/status language instead of finance connection/provider language.
- Account Center first card is now `Company portal status`, showing only status and user counts by default.
- Account Center no longer exposes eligibility, setup timestamp, or setup notes in the default dealer view.
- Dealer catalog removed the `Saved` filter until a visible save/favorite action exists on the catalog cards.
- Dealer catalog file warnings now say `File not ready yet` instead of delivery/provider wording.
- Internal CRM `Preview as Dealer` now renders the actual dealer catalog preview before diagnostics.
- Internal membership/rule/catalog-resolution diagnostics are collapsed under `Support diagnostics`.
- Default internal account context no longer foregrounds Affinity / Ownership / PE / Dealer type before the preview.

## Preserved Backend Behavior

No backend contract was removed. This slice preserves:

- consignment site create/read/filter
- consignment agreement and BLUE/ROSE evidence flow
- ROSE 90-day cadence and audit completion
- site issue / discrepancy follow-up
- Acumatica parked boundary checks
- dealer portal provisioning and invite flows
- dealer account center access management
- dealer catalog visibility rules
- catalog snapshots and direct-access enforcement
- internal dealer preview diagnostics

## Parked Dependency Boundary

Acumatica and ERP-owned truth remain parked until sandbox access, endpoint certification, sample records, field mapping sign-off, and recovery rules are available. The UI now states that boundary calmly and only in advanced/support contexts instead of making it the dealer or operator's first-screen problem.

## QA Evidence

Passed:

- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `node --check apps/crm-web/e2e/ux-depth.spec.mjs && node --check apps/crm-web/e2e/ux-visual.spec.mjs && node --check apps/crm-web/e2e/route-coverage.spec.mjs && node --check apps/crm-web/e2e/flows.spec.mjs`
- `pnpm --filter @pulse/crm-web test:route-coverage` - 1/1
- `pnpm --filter @pulse/api test:consignment` - 15/15 total consignment service/API tests
- `pnpm --filter @pulse/api test:dealer-portal` - 15/15
- `node apps/crm-web/e2e/prepare-e2e.mjs`
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.depth.config.mjs --grep "UX-03 slice D role-first queues"` - 1/1
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.config.mjs --grep "dealer portal login|dealer navigation|dealer catalog personas|navigation keeps single-screen|RD and TM personas"` - 5/5
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.visual.config.mjs --grep "capture CRM and dealer default UX budgets"` - 1/1

Notes:

- Consignment and Dealer Portal API tests were run sequentially to avoid shared test-database reset collisions.
- Backend/API tests still use Acumatica/ERP language where they verify the integration boundary. User-facing CRM/dealer copy now uses plain operational wording.
