# UX-05 Deep Route Clutter Reduction Goal

Date: 2026-06-02

Status: `In Progress - Slice E Training/Consignment implemented; local browser/DB QA blocked by host resource pressure`

## Goal

UX-04 simplified the default module pages, but Dynamic AQS will still feel clutter when they open detail pages, setup screens, rule builders, or work queues. UX-05 focuses on the deeper surfaces:

> One active work surface at a time. Everything else becomes a drawer, wizard step, detail rail, report, or More action.

## Research Basis

- Nielsen Norman Group progressive disclosure recommends showing only the most important options first and disclosing specialized options only when users ask for them: https://www.nngroup.com/articles/progressive-disclosure/
- Nielsen Norman Group usability heuristics reinforce using the user's language, preserving system status, consistency, and minimalist design: https://www.nngroup.com/articles/ten-usability-heuristics/
- Atlassian form guidance recommends grouping fields logically, staging long forms, and using a clear primary/secondary action hierarchy: https://atlassian.design/patterns/forms/
- Carbon empty-state guidance supports contextual, concise empty states and workflow starter content instead of repeated empty panels: https://carbondesignsystem.com/patterns/empty-states-pattern/

## Five-Agent Audit Summary

| Agent lane | Scope | Main finding |
| --- | --- | --- |
| Agent A | Leads, Accounts, Calendar, Admin | Lead Detail is the highest clutter risk. Admin Business Rules and Account Detail still expose setup/audit/readiness at the same time as daily work. |
| Agent B | Product Management, Digital Assets | Product and assets are conceptually correct, but still feel like governance/DAM consoles. Dealer Catalog Views need a plain-language wizard; assets need fast share first. |
| Agent C | Territory, Training, Consignment | Territory improved, but Training and Consignment still duplicate queues, metrics, and next-action surfaces. Daily work should be one ranked queue. |
| Agent D | Dealer Portal | Dealer pages should feel like a dealer start page and file/product portal, not a mini CRM dashboard. Direct file actions and plain account support should come first. |
| Agent E | QA coverage | Current tests prove default shell budgets, not deep-route clutter. Need clutter-budget tests for scroll height, visible section count, table width, row actions, and repeated empty states. |

## Priority Risk Ranking

| Rank | Surface | Why it still feels cluttered | UX-05 target |
| --- | --- | --- | --- |
| 1 | Lead Detail and Discovery | Header badges, facts, tabs, next action, workflow gates, lifecycle controls, and discovery fields compete. | Lead detail becomes action-first; Discovery/CIS/Onboarding become current-step work. |
| 2 | Admin Business Rules | Parked dependency alert, metrics, templates, rule cards, previews, sample decisions, and impact tables are all visible. | Draft -> Preview -> Publish wizard. |
| 3 | Product Dealer Catalog Views | Affinity, ownership/PE, independent, region, brand, and private label can read like one dropdown instead of separate rule axes. | Plain-language audience builder with advanced diagnostics hidden. |
| 4 | Digital Assets | Share/create/upload/search/detail/migration concepts still appear too close together. | Fast share first, bulk upload modal, migration behind review. |
| 5 | Training and Consignment | Priority queues, metrics, attention panels, work tabs, admin forms, and site details duplicate the same work. | One ranked work queue, setup/reporting behind More. |
| 6 | Dealer Portal | Dashboard/account pages repeat role/status/context and do not make files/products the fastest path. | Dealer Start Here, catalog files-first cards, compact account center. |
| 7 | Account Detail and Calendar | Useful but dense rails/cards/secondary readiness surfaces still sit in the main visual path. | Queue-first account detail and selected-event-only calendar rail. |
| 8 | QA proof | Waived deep routes and desktop-only budgets miss below-fold clutter and responsive fatigue. | New clutter-budget and persona journey gates. |

## Slice Plan

### UX-05 Slice A - Clutter Budget QA Harness

Purpose: prevent subjective clutter from returning.

Status: `Implemented - quick gate passed` in `docs/UX_05_SLICE_A_CLUTTER_BUDGET_IMPLEMENTATION_2026-06-02.md`.

Deliverables:

- Add a Playwright `module clutter budget` suite for default and high-risk deep routes.
- Measure visible section count, first-viewport section count, top-level cards/panels, table column count, visible tables, visible row actions, max row actions per row, repeated empty states, scroll height, badges, buttons, tabs, and dealer-facing internal vocabulary.
- Promote high-risk waived routes into depth checks:
  - `/leads/:id`
  - `/customers/:id`
  - `/consignment/:siteId`
  - `/product-management/products/:productId`
  - `/dealer/catalog/:presentationId`
- Add responsive desktop/tablet/narrow checks for Territory, Training, Product, Digital Assets, Consignment, and Dealer Portal.

Acceptance:

- Each target route has a budget report and screenshot evidence.
- Budget exceptions are documented as intentional with a linked requirement.
- Quick critical route gate passes before UX-05 Slice B begins.

### UX-05 Slice B - Lead Detail And Intake Action-First Pass

Purpose: fix the highest operator-friction surface.

Status: `Implemented - full UX-05 clutter suite passed` in `docs/UX_05_SLICE_B_LEAD_DETAIL_WORK_FLOW_IMPLEMENTATION_2026-06-02.md`.

Deliverables:

- Lead Detail header: one primary CTA, max two status badges, one compact fact row. `Done`
- Move source, routing, group, and rating evidence into quiet overview/fact surfaces. `Done`
- SLA and lifecycle evidence cleanup. `Done`
- Collapse lifecycle controls behind `More`. `Done`
- Discovery/CIS/Onboarding become a step-based `Work` flow where only the current step is open. `Done`
- New Intake becomes three steps:
  - who is the customer
  - where should it route
  - duplicate/OCR review
  - `Done`

Acceptance:

- CSR/Ops can identify the next lead action without reading every workflow gate.
- OCR, duplicate review, routing, finance/CIS, and lifecycle behavior remain reachable.
- Park, close, resume, and reopen stay in `More` with a focused confirmation modal instead of an always-visible lifecycle form.

### UX-05 Slice C - Admin Business Rules Wizard

Purpose: keep flexible catalog rules, but stop showing rule-engine internals as the default admin experience.

Status: `Implemented - QA passed` in `docs/UX_05_SLICE_C_ADMIN_BUSINESS_RULES_WIZARD_2026-06-02.md`.

Deliverables:

- Business Rules becomes `Draft -> Preview -> Publish`. `Done`
- Templates and rule fields live in Draft. `Done`
- Sample decisions and affected product/file impact live in Preview. `Done`
- Audit/version history and parked Acumatica boundaries live behind details. `Done`
- Publish requires a saved, current, clean preview. `Done`
- Duplicate priorities are blocked before save. `Done`

Acceptance:

- A super admin can safely change a rule without parsing every diagnostic panel first.
- Publish still requires clean preview and audit evidence.

### UX-05 Slice D - Product And Digital Assets Operator Flow

Purpose: simplify category/family/audience/Widen confusion.

Status: `Implemented - QA passed` in `docs/UX_05_SLICE_D_PRODUCT_DIGITAL_ASSETS_OPERATOR_FLOW_2026-06-02.md`.

Deliverables:

- Dealer Catalog View wizard:
  - who is this for
  - what should they see
  - review before publish
  - `Done`
- Add a small `How catalog visibility works` playbook popover:
  - affinity and ownership/PE are separate axes
  - independent is an outcome
  - price class stays separate
  - dealer group is resolved context, not a raw manual field
  - `Done`
- Digital Assets default: search + approved files + `Copy customer link` / `Create share link`.
  - `Done`
- Bulk upload becomes a modal with file drop, detected fields, defaults, and upload review.
  - `Done`
- Delivery health, versions, product usage, and Widen migration move behind detail/More.
  - `Done`

Acceptance:

- Product user can explain: fix product gaps -> attach files -> choose dealer audience -> publish.
- Marketing user can find/share approved files without reading storage or Widen internals.

### UX-05 Slice E - Training And Consignment One-Queue Pass

Purpose: reduce duplicate priority surfaces.

Status: `Implemented - static/type/mobile/service QA passed; local browser/DB QA blocked` in `docs/UX_05_SLICE_E_TRAINING_CONSIGNMENT_ONE_QUEUE_PASS_2026-06-04.md`.

Deliverables:

- Training default uses Priority Queue chips as the only count surface. `Done`
- Training Admin setup becomes one Catalog Setup wizard/drawer. `Done`
- Consignment default becomes one ranked `Next site work` list:
  - due audits
  - follow-ups
  - site issues
  - `Done`
- Consignment Site Detail keeps the header primary action as the only next-action surface. `Done`
- `Finish audit` opens a small modal: `No issue` / `Log site issue`. `Done`

Acceptance:

- Training Ops and consignment users see one work queue before reports/setup/history.
- Acumatica-dependent inventory/PO truth remains parked and quiet.

### UX-05 Slice F - Dealer Portal Start Here And Files-First

Purpose: make the portal feel dealer-facing, not CRM-facing.

Deliverables:

- Dealer Dashboard becomes:
  - one role-aware next action
  - one account-support card
  - one recent products/files panel
- Account Center splits into `Company Profile`, `Users`, and `Account Health`.
- User rows compact to name, email, role, status, actions.
- Product cards show 1-2 approved files with direct `Open file` actions.
- Product Detail starts with `Product files`; internal availability metadata moves under `Why this is available`.
- Keep Preview-as-Dealer as preview only; true impersonation remains parked until reason, expiry, banner, audit, and support workflow are approved.

Acceptance:

- Dealer can open files/products quickly.
- Dealer never sees resolver/group/ERP internals by default.

### UX-05 Slice G - Accounts And Calendar Detail Rails

Purpose: keep supporting screens useful without turning them into dashboards.

Deliverables:

- Accounts default mode: `Needs follow-up`; `All accounts` becomes a mode, not a second always-visible directory.
- Account Detail keeps `Today’s Account Focus`, `Profile`, `Contacts`, and `Locations` primary.
- Readiness/handoff/payment/training/portal activity move into one `Account readiness` drawer.
- Calendar Event Detail rail appears only after event selection.
- Metrics/attention move into `Day health` disclosure.
- Scheduler modal becomes `Schedule Work` with first-step choice: Discovery call or Training session.

Acceptance:

- Operators can act on accounts/events without reading every related status card.

## QA Plan

- CRM web typecheck and lint.
- Existing route coverage, visual budget, and depth suites.
- New clutter-budget suite from Slice A.
- Persona journeys:
  - CSR creates and triages a lead.
  - TM reviews territory gaps and opens lead/account work.
  - Training Ops resolves proof/certification queue.
  - Consignment user completes due site work.
  - Dealer finds product files and account support.
- Mobile rendered QA remains active for Today, Notifications, Sync, Route, Training, Voice Notes, More, and Consignment.

## Recommended Order

1. Slice A: QA harness, so the next changes have proof.
2. Slice B: Lead Detail and Intake, because this is daily operator friction.
3. Slice C: Admin Business Rules, because rule flexibility is powerful but currently too dense. `Implemented - QA passed`
4. Slice D: Product and Digital Assets, because category/family/group/asset concepts are still confusing. `Implemented - QA passed`
5. Slice E: Training and Consignment, because these still duplicate work queues. `Implemented - static/type/mobile/service QA passed; local browser/DB QA blocked`
6. Slice F: Dealer Portal, because dealer experience must be files/product first. `Next`
7. Slice G: Accounts and Calendar, because these are supporting surfaces after the core work queues.

## Non-Goals

- Do not implement Acumatica-owned inventory, PO, order, invoice, payment, pricing, or shipment truth.
- Do not implement true dealer impersonation until governance is approved.
- Do not implement route optimization, true background sync, push/deep links, or offline media cache in this UX goal.
- Do not remove functional requirements; demote secondary details instead.
