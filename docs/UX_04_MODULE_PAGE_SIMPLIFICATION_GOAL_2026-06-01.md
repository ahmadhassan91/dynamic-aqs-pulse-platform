# UX-04 Module Page Simplification Goal

Date: 2026-06-01

Status: `In Progress - Slice F provider cleanup passed`

## Goal

Make every developed Pulse CRM, Dealer Portal, and Mobile page feel like a simple operating screen instead of a dense module console.

The UX-01 through UX-03 work moved Pulse in the right direction: shared Workbench primitives exist, many first-screen budgets are green, and Territory/Training/Product/Digital Assets/Admin have already been simplified in several passes. The remaining issue is deeper and systemic: many pages start with the right Workbench pattern, then fall back into local dashboards, repeated tables, setup forms, dense detail rails, implementation terms, and multiple places to do the same work.

UX-04 should make the next implementation goal:

> One page, one job, one next safe action. Details, setup, reports, migration, diagnostics, and parked dependencies stay available, but they do not compete with the user's current work.

## Research Basis

### External UX Research

- Nielsen Norman Group progressive disclosure: show only the most important options first, disclose specialized options only when the user asks, and avoid making the first screen contain confusing features.
  - https://www.nngroup.com/articles/progressive-disclosure/
- Nielsen Norman Group usability heuristics: keep users informed, use the user's language, follow consistency and standards, and remove irrelevant information because it competes with relevant work.
  - https://www.nngroup.com/articles/ten-usability-heuristics/
- Salesforce Lightning Design System data display guidance: use tables for large scannable record sets, tile/card views for short constrained lists, label ambiguous values, and collapse tables into tile lists on narrow screens.
  - https://spring-20.lightningdesignsystem.com/guidelines/displaying-data/
- Atlassian form guidance: forms should guide people with minimal fuss; group controls logically, use clear labels, and keep primary/secondary actions in predictable hierarchy.
  - https://design-system-docs-proxy.services.atlassian.com/patterns/forms/
- Carbon empty-state guidance: empty states must be contextual, concise, and action-oriented; if multiple empty states appear on one dashboard, avoid repeated primary CTAs and unnecessary illustration/noise.
  - https://carbondesignsystem.com/patterns/empty-states-pattern/

### Internal Evidence

- Meeting artifacts are under `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings`, not `/Users/clustox1/Documents/Currie/Meetings`.
- Dynamic/Currie repeatedly asked for fewer barriers, fewer keystrokes, simple navigation, mobile-first field use, trusted reporting, and better adoption.
- Existing UX docs already define the target pattern:
  - `docs/UX_ROLE_BASED_WORKBENCH_OPTIMIZATION_GOAL_2026-05-25.md`
  - `docs/UX_01_CROSS_MODULE_OPTIMIZATION_PLAN_2026-05-26.md`
  - `docs/UX_03_CROSS_MODULE_CLARITY_GOAL_2026-05-31.md`
  - `apps/crm-web/src/components/ui/Workbench.tsx`

## Six-Agent Audit Summary

| Lane | Scope | Main finding |
| --- | --- | --- |
| Requirements and meetings | PRDs, requirement maps, meeting notes | Pulse must feel like a role workbench. Setup, reports, migration, audit, provider status, and parked dependencies must not dominate default operator pages. |
| Leads / Accounts / Calendar / Admin | CRM web operator pages | Leads is the highest-value first cleanup: too many lead doors, too much intake complexity, and dense lead cards. Accounts, Calendar, and Admin still repeat metrics, setup, and detail surfaces. |
| Territory / Training | TM/RD and Training Ops pages | Recent cleanup is real, but Territory List and Training queues still show too many ledgers/forms at once. Role-specific queues should show one visible work surface at a time. |
| Product / Digital Assets | Product Management and Widen replacement | Product setup concepts are still too visible in navigation; categories/families/audience rules blur. Digital Assets needs fast share first and a staged bulk upload flow. |
| Consignment / Dealer Portal | Consignment Ops, site detail, dealer account/catalog | Consignment detail exposes parked ERP wording too early. Dealer-facing pages should stop showing ERP-pending language and internal resolver/group diagnostics by default. |
| Global shell / design system / mobile | Workbench primitives, navigation, tables, badges, mobile kit | `Workbench` has the right contract, but modules still hand-roll local dashboards, metric helpers, raw tables, badges, and action clusters. Mobile needs the same action-first model. |

## UX Principles For All Module Pages

1. Default routes answer three questions in order: what needs attention, what is the next safe action, and where do I drill in.
2. Default screens are role workbenches, not dashboards.
3. Daily work appears before reports, setup, migration, diagnostics, audit, source trace, and parked dependencies.
4. Header budget is one primary CTA, at most two visible secondary actions, with the rest behind `More`.
5. First-screen metric budget is four decision metrics. Extra metrics move to reports or details.
6. Tables target five data columns plus one row action menu. Long evidence, notes, and history move to detail rail/drawer.
7. Empty states are typed: all-clear, no data, filtered, permission, external dependency.
8. Dealer-facing pages never expose resolver, affinity/PE/ownership logic, price-class, source IDs, migration, or ERP internals.
9. Parked dependencies must stay honest but quiet. They appear only when they block the current task.
10. Mobile surfaces use a single ranked next-action model across Today, Notifications, and Sync Status.

## Current High-Risk Screens

| Rank | Screen | Why it is risky | Primary next slice |
| --- | --- | --- | --- |
| 1 | Leads workspace and lead intake | Multiple lead doors, dense pipeline cards, broad `More actions`, heavy one-screen intake/OCR/routing form. | UX-04 Slice A |
| 2 | Training workspace | Header, metrics, attention panel, tabs, priority lanes, proof/certification/exceptions, and reports still compete. | UX-04 Slice B |
| 3 | Territory List / Work Queues | Registry, regional registry, assignment gaps, lead roster, customer roster, and bulk transfer forms are too visible together. | UX-04 Slice B |
| 4 | Product Management / Product Detail | Category/family/audience/publish concepts are still close together; readiness and publish sequence is not obvious. | UX-04 Slice C |
| 5 | Digital Assets detail / bulk upload / share links | Fast field sharing is buried among file metadata, attach flow, source trace, versions, and share configuration. | UX-04 Slice C |
| 6 | Consignment site detail | State-derived workflow is right, but parked Acumatica/manual variance/UAT shortcuts appear too early. | UX-04 Slice D |
| 7 | Dealer Portal account/catalog/internal preview | Dealer-facing copy exposes ERP pending states; internal preview shows diagnostics before dealer experience. | UX-04 Slice D |
| 8 | Admin users/roles/catalog rules | Admin IA has too many destinations; roles cards and catalog-rule internals remain dense. | UX-04 Slice E |
| 9 | Calendar | Schedule work, view modes, attention panel, metrics, right detail, and Outlook setup still live too close together. | UX-04 Slice E |
| 10 | Mobile Today / Notifications / Sync | Same field-day priority is described independently in three surfaces. | UX-04 Slice F |

## Module Direction

| Module | Better default job | What moves behind More / detail / setup |
| --- | --- | --- |
| Leads | Work the lead pipeline and next SLA/routing action. | Analytics, import audit, website form governance, finance queue, routing/admin, export, OCR duplicate evidence. |
| Accounts | Find accounts needing cleanup/follow-up, then open account context. | Summary metrics, payment/training/portal/activity secondary tabs, source lineage, advanced readiness. |
| Calendar | See today/week schedule and act on linked events. | Outlook setup, month/list power modes, broad sync health, repeated event detail fields. |
| Territory | TM/RD work queue: unassigned/stale leads/accounts and coverage gaps. | Lifecycle/pipeline/training report panels, region/owner ledgers, setup forms, bulk-transfer detail fields. |
| Training | Priority queue for overdue/proof/recertification/no-training work. | Certification track overview, reports, catalog setup, raw proof/cert ledgers, multi-table exceptions. |
| Consignment | Follow-up queue, due ROSE, site exceptions, one state-derived next step. | Manual variance internals, Acumatica parked detail, document counts, simulated UAT shortcuts. |
| Product Management | Catalog readiness and Dealer Catalog View publish checklist. | Category/family setup, resolver/precedence/matching codes, source preview, migration evidence. |
| Digital Assets | Find/share approved files and resolve asset gaps. | Widen migration review, storage/source trace, versions, metadata, usage history, advanced link settings. |
| Dealer Portal | Dealer sees products/files and simple account context. | ERP/provider blockers, internal group classifications, price/order/payment/shipments until real. |
| Admin | Users/access first; system setup second. | Audit/integration/catalog-rule internals unless troubleshooting or explicitly editing. |
| Mobile | One ranked field-day next action. | Utility launchers, provider/parked dependency copy, route optimization/offline media claims. |

## Slice Plan

### UX-04 Slice A - Leads And Accounts Action-First Cleanup

Purpose: close the highest-friction operator surfaces first.

Deliverables:

- Leads defaults to Pipeline/List work, not an Overview-style command center.
- `Overview` and `Analytics` become `Insights` / drawer / secondary route, not first-row competition.
- Lead intake becomes staged: required identity/contact first, then routing/OCR/duplicate/enrichment preview.
- Lead cards show max two badges; detailed source/routing evidence moves to lead detail.
- Accounts list defaults to attention/follow-up queue; summary metrics move behind compact disclosure.
- Account detail keeps `Profile`, `Contacts`, `Locations` primary and groups Payment/Training/Portal/Activity under `Related`.

Acceptance:

- A CSR/Ops user can create or triage a lead without deciding between five lead entry points.
- Lead and account list cards/rows fit the visible badge and action budget.
- No backend behavior is removed; hidden actions remain reachable through More/detail routes.

### UX-04 Slice B - Territory And Training One-Queue-At-A-Time

Purpose: make TM/RD and Training Ops screens feel operational, not report-heavy.

Status: `Implemented - focused QA passed` in `docs/UX_04_SLICE_B_TERRITORY_TRAINING_IMPLEMENTATION_2026-06-01.md`.

Deliverables:

- Territory List becomes registry-first with inner controls for `Territories`, `Regions`, `Assignment gaps`, `Lead ledger`, and `Account ledger`.
- Territory Work Queues show one queue at a time: `Accounts`, `Leads`, `Setup`.
- Bulk transfer reason/override fields stay collapsed until rows are selected.
- Training removes duplicated attention chrome; priority counts become filter chips.
- Training `Priority Queue` is default for Training Ops; `Sessions` is default for schedulers/TMs.
- Sessions/proof/certification tables tighten to five columns plus row menu/detail rail.

Acceptance:

- TM/RD can find assigned/unassigned/stale work without scrolling through registry/report tables.
- Training Ops can act on one queue without seeing proof, recertification, exceptions, and report data at the same time.

### UX-04 Slice C - Product And Digital Assets Concept Simplification

Purpose: make catalog/file management easy for Product/Marketing without exposing schema/rule internals.

Status: `Implemented - focused QA passed` in `docs/UX_04_SLICE_C_PRODUCT_DIGITAL_ASSETS_IMPLEMENTATION_2026-06-01.md`.

Deliverables:

- Product sidebar exposes only daily surfaces: `Catalog Readiness`, `Dealer Catalog Views`.
- `Categories` and `Families` merge into `Catalog Placement` setup behind More.
- Dealer Catalog View create/edit becomes an audience builder:
  - name the audience
  - choose audience type
  - choose region/brand if scoped
  - advanced matching only when needed
- Product detail becomes one readiness board: `Content`, `Files`, `Dealer Visibility`, `Checks`.
- Product visibility modal does one job: add this product to a Dealer Catalog View.
- Digital Assets detail puts fast actions first: `Open file`, `Copy file link`, `Create share link`.
- Bulk upload becomes staged: select/drop files, review detected fields/exceptions, apply defaults, upload.
- `Advanced Import` becomes `Migration Review` and stays off the main sidebar.

Acceptance:

- Product user can understand: fix product gaps -> attach approved files -> assign dealer audience -> publish Dealer Catalog View.
- Marketing user can upload and share files without reading source trace, storage, Widen, or metadata internals first.

### UX-04 Slice D - Consignment And Dealer Portal Plain-Language Ops

Purpose: preserve honest dependency boundaries while removing provider/process noise from daily work.

Status: `Implemented - focused QA passed` in `docs/UX_04_SLICE_D_CONSIGNMENT_DEALER_PORTAL_IMPLEMENTATION_2026-06-01.md`.

Deliverables:

- Consignment site detail shows one state-derived primary next step.
- Manual/UAT workflow shortcuts move behind More/admin actions.
- `Reconciliation` column becomes plain `Site issue`; discrepancy counts move to row detail.
- Parked Acumatica text moves to advanced/readiness drawer and appears only when blocking.
- Dealer navigation removes `ERP pending` badge language.
- Dealer Account Health becomes one plain support/status card until finance/order integrations are real.
- Internal Preview as Dealer shows actual dealer preview first; diagnostics are collapsed.
- Dealer catalog cards expose one clear save/favorite action or remove Saved filtering until visible.

Acceptance:

- Operators can work due ROSE/follow-up/site readiness without reading Acumatica internals.
- Dealers never see implementation dependency wording as primary content.
- Internal staff can still access diagnostics for support/audit.

### UX-04 Slice E - Calendar And Admin IA Tightening

Purpose: separate daily scheduling/user-access work from setup and troubleshooting.

Status: `Implemented - focused QA passed` in `docs/UX_04_SLICE_E_CALENDAR_ADMIN_IMPLEMENTATION_2026-06-01.md`.

Deliverables:

- Calendar defaults to Day/Week work view.
- Month/List become power-user view modes, not competing first-level choices.
- Outlook setup moves to Admin/Integrations; Calendar keeps event-level sync status only.
- Admin navigation compresses to `Users & Access` and `System Setup`.
- Roles become comparison table with full footprint in detail.
- Catalog Rules editing uses edit/draft drawer; preview diagnostics and rule internals stay behind detail.

Acceptance:

- Admin users can add/manage users without parsing audit/integration/rule cards.
- Calendar users can schedule/review linked records without seeing Outlook setup.

### UX-04 Slice F - Mobile Unified Next Action

Purpose: make mobile a field assistant, not a small CRM clone.

Status: `Implemented - rendered QA passed with native screenshot proof` in `docs/UX_04_SLICE_F_MOBILE_NEXT_ACTION_IMPLEMENTATION_2026-06-01.md`.

Deliverables:

- Add a shared mobile next-action model consumed by Today, Notifications, and Sync Status.
- Rank urgent lead/SLA, checked-in route/route draft, due training, due ROSE, voice-note review, and unsynced drafts with clear copy.
- Replace static Today `Next move` with model-driven next action.
- Notifications uses the same sync guidance as Sync Status.
- ROSE and Training mobile execution become step-based flows where only the current step is open.
- Mobile field kit route uses `/more` instead of `/assets` so Expo/Metro static asset handling does not collide with the tab route.

Acceptance:

- TM/RD sees the same top action across Today, Notifications, and Sync.
- Copy does not claim background sync, push, route optimization, Acumatica saved state, or offline media cache.
- Playwright/Expo QA captures login, Today, Notifications, Sync, Route, Consignment, Training, and More.
- iOS simulator proof captures Today, More, and Consignment as representative native field flows; the next mobile QA cycle can expand native screenshots to the remaining utility screens.

## Shared Engineering Guardrails

- Use existing `Workbench` primitives first.
- Add a composed `ActionFirstPageTemplate` only if it reduces repeated page structure.
- Prefer `WorkbenchTable`, `RowActionMenu`, `WorkbenchDetailRail`, `WorkbenchAdvancedSection`, `StatusBadge`, and typed `EmptyStateMessage` over local Mantine patterns.
- Do not remove backend-wired functionality. Reposition it behind the right layer.
- Do not make Acumatica, Widen migration, route optimization, true offline media sync, prices/orders/invoices/payments, or shipment tracking look complete.
- Preserve approved prototype route structure and role-gated navigation.
- Keep dealer-facing language simple: `Your product catalog`, `Products and files`, `Account Health`, `Available for your company`.

## QA Plan

Each slice should ship with:

- CRM web typecheck.
- Existing route coverage and UX depth Playwright suites.
- One targeted Browser/Playwright flow for the affected module as the relevant persona.
- Before/after screenshot evidence for desktop and one narrower viewport when layout changes.
- Updated tracker row and implementation evidence doc.
- Explicit list of any hidden/demoted UI, proving it remains reachable where appropriate.

## Recommended Execution Order

1. Slice A: Leads and Accounts. This is the highest operator-friction area and affects daily adoption.
2. Slice B: Territory and Training. This cleans the TM/RD and Training Ops workday.
3. Slice C: Product and Digital Assets. This reduces the category/family/audience/Widen confusion already visible in UAT.
4. Slice D: Consignment and Dealer Portal. This removes dependency noise from operators and dealers.
5. Slice E: Calendar and Admin. This tightens supporting screens.
6. Slice F: Mobile. This can run in parallel after the shared next-action model is agreed.

## Non-Goals

- Do not build new functional modules.
- Do not implement Acumatica import/sync, final pricing, orders, invoices, shipments, payment flows, route optimization, true background sync, push/deep links, offline media binary cache, or Widen cutover hardening.
- Do not flatten role/territory/dealer visibility rules for visual simplicity.
- Do not remove audit/source/migration/provider evidence; move it to advanced/detail surfaces.
