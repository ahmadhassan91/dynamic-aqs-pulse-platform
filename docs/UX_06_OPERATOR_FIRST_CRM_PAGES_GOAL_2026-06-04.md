# UX-06 Operator-First CRM Pages Goal

Date: 2026-06-04

Status: `In Progress - Slices A-C static QA passed; UX-07 Leads carry-forward static QA passed; browser QA pending host recovery`

## Goal

UX-05 reduced deep-route clutter module by module. UX-06 turns that into one durable page rule across Pulse:

> Every default page must answer one question first: what should this user do next?

Setup, reporting, migration, diagnostics, provider boundaries, and secondary directories stay behind `More`, a drawer, a mode switch, or a detail route.

## Research Basis

- Dashboard UX should minimize cognitive load and avoid decorative color/status overload: https://www.techtarget.com/searchbusinessanalytics/tip/Good-dashboard-design-8-tips-and-best-practices-for-BI-teams
- Account/dashboard users are often task-oriented and may not relearn complex navigation each visit: https://baymard.com/ecommerce-design-examples/58-account-dashboard/20010-home-24
- Effective dashboards group related metrics and remove low-value data when it costs clarity: https://www.wandr.studio/blog/dashboard-ui-design
- Existing UX-05 guidance already proved the local Pulse pattern: one active work surface, progressive disclosure, and docs/tracker updates as part of done.

## Agent Audit Summary

| Agent lane | Scope | Main finding | Recommended slice |
| --- | --- | --- | --- |
| Agent 1 | Leads, Accounts, Calendar, Admin | Accounts and Calendar still show multiple work surfaces at once; Calendar auto-selects an event rail before the user chooses one. | Accounts + Calendar detail rails |
| Agent 2 | Dealer Portal, Product, Digital Assets | Dealer Portal still reads like a mini CRM dashboard; catalog cards were not using existing file/favorite action props. | Dealer Portal Start Here and files-first |
| Agent 3 | Territory, Training, Consignment | Territory remains the densest default page; Training/Consignment are better but detail/setup surfaces still need progressive disclosure. | Territory queue-first and setup stepper |
| Agent 4 | Mobile | Today, More/Files, Consignment, Training, and Voice Notes still expose secondary dashboards or office terms before field action. | Mobile secondary-context collapse |
| Agent 5 | QA | UX-06 should extend clutter budgets around dealer-facing simplicity and avoid heavy production-build gates when host resources are constrained. | Dealer critical route budget + focused depth assertions |

## UX-06 Page Rules

| Rule | Pass condition |
| --- | --- |
| One primary action | First paint has one clear next action for the active persona. |
| One work surface | A page may show a queue, a detail workspace, a setup wizard, or a review board, not several at once. |
| Secondary context is optional | Metrics, health, evidence, setup, imports, migration, provider status, and reporting are behind disclosure unless they are the next action. |
| Dealer-facing copy is plain | Dealer pages do not expose `Dealer Catalog View`, resolver, source-system, migration, Widen, ERP, Acumatica, or impersonation terms by default. |
| Tables are compact | Directory tables expose row menus or one row action; wide admin tables live behind modes/detail routes. |
| Mobile stays field-first | Mobile Today, Training, Consignment, Voice Notes, and More do not put office dashboards or integration vocabulary before the field task. |

## Slice Plan

### Slice A - Dealer Portal Start Here And Files-First

Status: `Implemented - static QA passed; browser QA pending host recovery`

Purpose: make dealer pages feel like a dealer product/file portal, not a CRM account dashboard.

Delivered:

- Dealer Dashboard title changed to `Start Here`.
- First paint now has three cards:
  - `Next Action`
  - `Account Support`
  - `Product Files`
- Removed the always-visible metric strip (`Portal Users`, `Contacts`, `Locations`, `Territory`) from the dashboard first paint.
- Removed below-fold dashboard directory tables (`Company Access Directory`, `Account Context`, `Contact Directory`, `Location Directory`) from the dealer home; those details belong in Account Center.
- Dealer Catalog now consumes the existing `assetActions` and `favoriteActions` props.
- Catalog product cards now expose `Save` and up to two `Open file` actions directly on the card when files are available.
- Catalog filter labels now use dealer-facing wording: `All products`, `With files`, and `Missing files`.
- Dealer product detail now puts `Product files` before product prose, and product prose is renamed from `Dealer-facing details` to `Product details`.
- E2E expectations were updated from `Dealer dashboard`/`Portal Users` to the new `Start Here` and files-first contracts.

Next proof:

- Run focused dealer Browser/Playwright checks once host pressure is stable.

Static proof passed:

- `pnpm --filter @pulse/crm-web typecheck`
- `node --check apps/crm-web/e2e/ux-clutter.spec.mjs && node --check apps/crm-web/e2e/ux-depth.spec.mjs && node --check apps/crm-web/e2e/flows.spec.mjs && node --check apps/crm-web/e2e/ux-visual.spec.mjs && node --check apps/crm-web/e2e/route-coverage.spec.mjs`
- `git diff --check`

### Slice B - Accounts And Calendar Detail Rails

Status: `Implemented - static QA passed; browser QA pending host recovery`

Purpose: default account/calendar views should not show a queue, a directory, a detail rail, and health metrics simultaneously.

Delivered:

- `/customers` now defaults to `Needs follow-up`; `All accounts` is a user-selected mode instead of a simultaneous second work surface.
- Account summary metrics now stay under `All accounts`, not the default follow-up queue.
- Account detail keeps `Today’s Account Focus`, `Profile`, `Contacts`, and `Locations` primary.
- `Related` was renamed to `More`.
- Account readiness, consignment, activity/documents, payment methods, training, and dealer portal open in a right-side drawer instead of secondary primary tabs.
- Consignment participation moved out of first paint and into the secondary account drawer.
- Parked ERP lifecycle wording was removed from the default account profile.
- Calendar stops auto-selecting the first event on load or filter changes.
- Calendar shows `Day health` by default; `Event detail` appears only after a user selects an event.
- E2E contracts now guard account mode behavior, account secondary drawer behavior, and calendar no-default-event-selection behavior.

Static proof passed:

- `pnpm --filter @pulse/crm-web typecheck`
- `node --check apps/crm-web/e2e/ux-clutter.spec.mjs && node --check apps/crm-web/e2e/ux-depth.spec.mjs && node --check apps/crm-web/e2e/flows.spec.mjs && node --check apps/crm-web/e2e/ux-visual.spec.mjs && node --check apps/crm-web/e2e/route-coverage.spec.mjs`

### Slice C - Territory Queue-First And Setup Stepper

Purpose: territory default should show the attention queue first, not reporting posture first.

Status: `Implemented through UX-07 Slice B - static QA passed; Browser/Playwright blocked by host build SIGKILL`

Delivered:

- `/territories` now starts with `Territory Action Queue`.
- `Lead routing posture`, training penetration, lifecycle, pipeline, workload, region, and owner rollups now sit behind `Performance details`.
- Map, registry, calendar, and setup stay behind `More` or direct deep links.
- Territory setup now uses a `Region -> Shipping hub -> Territory -> Coverage review` stepper.
- Bulk lead/account transfer stays in focused transfer queues and keeps audited reassignment behavior intact.

### Slice D - Mobile Secondary Context Collapse

Purpose: mobile field users should see one next action before metrics, source details, or office context.

Planned:

- Today keeps `MobileNextActionCard` as the only above-fold action queue.
- More becomes a simple field toolbox; Files/Asset Library gets its own route/drawer.
- Consignment hides Acumatica/warehouse/PO language behind source detail.
- Training moves metrics into `Queue summary`.
- Voice Notes shows suggested contexts first and full context search behind `Change context`.

Related UX-07 carry-forward:

- UX-07 Slice A extends the same operator-first page rule to Leads: `/leads` now opens on `Lead Work Queue`, with board/reporting secondary and lead detail action-first.
- Focused Browser/Playwright proof remains pending until host resource pressure clears.

## QA Plan

Cheap proof under local resource pressure:

- `node --check apps/crm-web/e2e/ux-clutter.spec.mjs && node --check apps/crm-web/e2e/ux-depth.spec.mjs && node --check apps/crm-web/e2e/flows.spec.mjs`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/mobile test -- mobile-next-action.test.ts mobile-training-policy.test.ts`
- `git diff --check`

Browser proof after host resources recover:

- `PULSE_UX_CLUTTER_SCOPE=critical PULSE_UX_CLUTTER_VIEWPORTS=desktop pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.clutter.config.mjs -g "dealer portal routes" --workers=1 --max-failures=1`
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.depth.config.mjs -g "UX-06|dealer" --workers=1 --max-failures=1`

## Parked Boundaries

- Pricing, ordering, invoices, shipment tracking, payments, credit hold enforcement, and true dealer impersonation remain parked until certified external sources and governance are ready.
- Acumatica, Widen migration, provider setup, and source-system diagnostics must not appear on dealer-facing first paint.
- UX-06 does not change backend source-of-truth ownership; it changes page hierarchy and operator flow.
