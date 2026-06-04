# UX-01 Workbench Slice D Implementation Notes

Date: 2026-05-26

Status: `Implemented - CRM/dealer automated and visual QA passed; mobile device visual QA pending`

## Scope Completed

Slice D applied the default-workbench cleanup from `docs/UX_01_CROSS_MODULE_OPTIMIZATION_PLAN_2026-05-26.md` across the developed CRM web, Dealer Portal, and mobile surfaces.

The goal was not to remove capability. The goal was to move setup, audit, dependency, and technical detail behind progressive disclosure so default pages answer:

> What needs action now?

## CRM Web Changes

| Area | Slice D Result |
| --- | --- |
| Leads | `/leads` now defaults to Pipeline, and pipeline stage badges use human labels instead of raw keys. |
| Calendar | Detail action copy now says `Open linked record` instead of implementation-facing source-record language. |
| Training | Header has one primary CTA, `Schedule Training`; first-screen Needs Attention lane surfaces overdue programs, pending proof decisions, and execution exceptions; header copy is Dynamic-user-facing. |
| Territory | Secondary engagement, training, lifecycle, pipeline, workload, regional, and owner posture sections moved behind progressive disclosure so the first screen stays leaner. |
| Consignment | Default no longer shows both Work Queue summary and Mailbox queue table; mailbox remains available as a drill-in tab. Repeated Acumatica/ERP/warehouse boundary language is reduced to quieter handoff/detail copy. |
| Product Management | Categories, Families, and Dealer Visibility are list-first; create/edit forms moved behind compact actions/modals; nav/tab language standardized to Dealer Visibility. |
| Product Detail | Dealer visibility add/edit moved into modal behavior so the visibility list remains primary. |
| Digital Assets | Share Sets are list-first; create/edit moved into modal behavior; visible `Set code` changed to `Internal code`; Widen trace remains in advanced/import areas. |
| Accounts | Account focus copy now uses business language instead of UAT/ERP dependency language in first task cards. |
| Admin | `Add User` is the single primary CTA; `Import Users` moved out of the primary CTA position. |
| Dealer Portal | Dashboard CTA is role-sensitive; duplicate dashboard navigation paths removed; catalog search/category stay visible while deeper filters sit behind `Filters`; repeated finance/order warnings removed from catalog/detail; empty state uses dealer-safe publish wording. |

## Mobile Changes

| Surface | Slice D Result |
| --- | --- |
| Today | `Today’s priorities` appears before optional tools, API status, drafts, and broader browsing. |
| Field tools | The prior six visible quick actions are demoted into a compact Field tools section with `Route` and `More tools` entry points. |
| More / Assets | Field-facing copy no longer exposes Widen IDs, offline file cache, binary cache, or storage-policy wording. |

## Automated QA

| Check | Status | Evidence |
| --- | --- | --- |
| CRM web typecheck | Passed | `pnpm --filter @pulse/crm-web typecheck` |
| CRM web lint | Passed | `pnpm --filter @pulse/crm-web lint` |
| Mobile typecheck | Passed | `pnpm --filter @pulse/mobile typecheck` |
| Mobile lint | Passed | `pnpm --filter @pulse/mobile lint` |
| CRM web Playwright e2e | Passed | `pnpm --filter @pulse/crm-web test:e2e` -> 11 passed |
| CRM/dealer visual screenshot pack | Passed | `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.visual.config.mjs` -> 2 passed |
| Copy offender scan | Passed for default UI | Remaining `Widen ID` mentions are contained in Digital Assets advanced import/reconciliation areas. |

## Visual QA Evidence

Slice D CRM web and Dealer Portal screenshot evidence has been captured with Playwright.

Evidence path:

- `output/playwright/ux-01-slice-d/`

Captured CRM routes:

- CRM default routes: Leads, Calendar, Territories, Training, Consignment, Product Management, Digital Assets, Accounts, Admin.
- Dealer Portal personas: admin, purchasing, accounting, viewer, affinity, ownership/PE, independent, hybrid.

Key fixes validated by screenshots:

- Territory first screen now shows the lead routing posture and one Needs Attention lane, with secondary posture behind progressive disclosure.
- Product Catalog and Digital Assets are list-first instead of create-form-first.
- Dealer Portal no longer repeats the Dashboard navigation entry on non-dashboard pages.
- Calendar, Training, Consignment, Accounts, Admin, and Business Rules keep setup/dependency detail out of the first action lane.

## Pending Mobile Device Visual QA

Slice D should not be marked fully closed until mobile device screenshot evidence is captured.

Required mobile proof set:

- iOS and Android Today, Route, More, Asset Library, Voice Notes, Training, Consignment, Sync Status.

## Still Parked

- Acumatica-backed pricing, inventory, orders, invoices, payments, shipments, and product import/application.
- Route optimization provider selection and native route optimization.
- True background sync, conflict merge, large offline media cache, and binary asset cache.
- Migration hardening beyond trace-preserving advanced import review.

## Next Step

Run mobile device visual QA, then start Slice E detail/progressive-disclosure cleanup:

- one primary CTA
- one Needs Attention / Today lane
- four to six first-screen metrics
- queue/table/library first
- setup, audit, dependency, and trace details behind progressive disclosure
