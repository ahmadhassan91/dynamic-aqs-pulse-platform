# UX-05 Slice B - Lead Detail Work Flow Implementation

Date: 2026-06-02

Status: `Implemented - full UX-05 clutter suite passed`

## Purpose

Lead Detail is the highest daily-operator clutter risk from the UX-05 audit. The old route made Discovery, CIS/Finance, and Onboarding feel like separate peer workspaces even though Dynamic AQS uses them as one lead progression.

This slice keeps all functional requirements reachable while changing the default mental model to:

> Overview first. Work next. Activity last.

## Implemented

- Changed Lead Detail top tabs from:
  - `Overview`
  - `Discovery`
  - `CIS, Finance & Setup`
  - `Onboarding Readiness`
  - `Activity Log`
- To:
  - `Overview`
  - `Work`
  - `Activity Log`
- Added a compact `Current Lead Work` rail inside `Work`:
  - `Discovery`
  - `CIS & Finance`
  - `Onboarding`
- Preserved the existing internal `activeTab` values so existing handlers and menu shortcuts still open the correct work step.
- Preserved the header `More` menu shortcuts:
  - `Discovery workspace`
  - `CIS workspace`
  - `Onboarding readiness`
- Moved lead lifecycle actions into the header `More` menu:
  - `Park lead`
  - `Close lead`
  - `Resume lead` for parked leads
  - `Reopen lead` for closed leads
- Replaced the always-visible `Pipeline Lifecycle` form with a focused lifecycle confirmation modal and a read-only inactive status card.
- Disabled resume/reopen next-best-action clicks for users without lead manage permission instead of allowing a silent no-op.
- Added stable selectors for QA:
  - `lead-work-flow`
  - `lead-work-step-panel`
  - `lead-work-step-discovery`
  - `lead-work-step-cis`
  - `lead-work-step-onboarding`
- Added a strict Lead Detail clutter gate:
  - hero badges <= 2
  - primary buttons <= 1
  - secondary buttons <= 3
  - visible tabs <= 3
- Updated depth checks so the old peer process tabs cannot return quietly.
- Updated route coverage waiver tags to mark `/leads/:id` as `ux-05-clutter-critical`.
- Converted New Intake into a three-step flow:
  - `Customer`
  - `Routing`
  - `Review`
- Moved OCR capture into the `Customer` step with a capture-type selector for business cards, show badges, handwritten notes, and other files.
- Kept affinity and ownership/PE as separate required routing axes in the `Routing` step.
- Moved duplicate preview and create/enrich decisions into the `Review` step before final save.
- Invalidated stale duplicate review state when an operator edits the draft after review.

## Requirement Preservation

The slice does not remove or rewrite lead workflow behavior.

Still reachable:

- Initial contact logging.
- Discovery scheduling.
- Discovery completion.
- Discovery fast-track with reason.
- Pain points, IAQ setup, decision maker, buying intent, and consignment interest/timing.
- CIS send/resend, public link, scanned/OCR fallback, internal sign-off, finance submission, finance decision, and finance masking through `LeadCisPanel`.
- Onboarding checklist, contact import/manual contact, readiness validation, portal eligibility, finance gate, and first-order CRM boundary through `LeadOnboardingReadyPanel`.
- Park, close, resume/reopen, lifecycle reason/note, duplicate close reason, and locked inactive behavior through `More` and the lifecycle modal.
- Activity timeline and audit evidence.
- Manual intake still builds the same `CreateLeadRequest`.
- OCR remains preview-and-review only until the lead is saved.
- Duplicate decisions still require backend preview plus a documented reason for create-new or enrich-existing.
- Routing team, SLA, and queue state remain backend/config-derived, not wizard-derived.

## Research Basis Applied

- Progressive disclosure: show the main work lane first and disclose specialized step content when the user selects that step.
- Minimalist dashboard design: reduce same-level competing controls and make the next workflow state visible.
- Enterprise form guidance: keep long processes staged while preserving the required fields and final review paths.

## Validation Plan

Passed:

```bash
node --check apps/crm-web/e2e/ux-clutter.spec.mjs
node --check apps/crm-web/e2e/ux-depth.spec.mjs
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web test:route-coverage
pnpm --filter @pulse/crm-web test:ux-clutter:quick
pnpm --filter @pulse/crm-web test:ux-clutter
pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.depth.config.mjs -g "UX-03 detail hotspots"
pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.config.mjs -g "internal workspace auth|manual intake shows duplicate|internal lead kanban|super admin can edit|public website form explains"
```

Latest focused intake/browser regression:

- Passed: 5/5 flows.
- Covered: required-field validation, public-form duplicate attachment setup, manual duplicate preview/create-new override, kanban drag after stepped intake create, detail edit/card insight regression, and backend-wired park -> status card -> resume lifecycle behavior.

Latest UX-05 quick clutter gate:

- Internal critical routes: 5/5 rendered.
- Dealer critical routes: 1/1 rendered.
- Internal warnings: 0.
- Dealer warnings: 0.

Latest full UX-05 clutter gate:

- Internal routes: 18/18 rendered.
- Dealer routes: 4/4 rendered.
- Route-readiness failures: 0.
- Non-blocking warning queue: Account Detail hero badges; Territory first-viewport density; Training ops/account repeated empty states and tab/button density; Product default secondary buttons; Dealer dashboard first-viewport density; Dealer product detail repeated empty states.

Latest Lead Detail clutter metrics:

- route ready: true
- hero badges: 2
- visible badges: 8
- primary buttons: 0
- secondary buttons: 3
- visible tabs: 3
- warnings: 0

## Remaining Slice B Work

- None. Move to UX-05 Slice C Admin Business Rules wizard.
