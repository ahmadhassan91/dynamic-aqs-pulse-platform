# Pulse Production Hardening Roadmap - Next Slice

Date: 2026-04-28

Source inputs:
- `docs/DELIVERY_PROGRESS_TRACKER.md`
- `docs/client-scope-confirmation-2026-04-20/01_LEADS_PRD.md`
- `docs/client-scope-confirmation-2026-04-20/02_TRAINING_PRD.md`
- `docs/client-scope-confirmation-2026-04-20/03_TERRITORY_PRD.md`
- `docs/FUNCTIONAL_GAPS_AND_NEXT_SLICES_2026-04-28.md`
- `docs/requirements-mapping/FOUNDATION_AUTH_USERS_PERMISSIONS_REQUIREMENTS_MAP_2026-04-16.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md`

## Executive Decision

The next active development slice should be:

**Leads Production Hardening + External Systems Confidence**

This should come before a new feature-heavy territory or training slice because the April 20 meeting turned lead intake into the highest-confidence approval path:
- Pulse-native website forms are expected to replace HubSpot intake.
- Marketing raised specific concerns about forms working reliably before HubSpot is removed.
- Zoho/Vivo email marketing was raised, but should be documented as a separate parked PRD rather than mixed into the current Leads implementation.
- Lead source, campaign, duplicate handling, public-form reliability, and activity history are the first things stakeholders will use to judge whether Pulse can replace the fragmented stack.

## Current Readiness Snapshot

These are delivery-readiness estimates from the tracker and latest session synthesis, not client sign-off percentages.

| Area | Current Position | Estimated Readiness | Main Gap Before Production Confidence |
| --- | --- | ---: | --- |
| Foundation | Strong foundation with monorepo, DB, auth/session/audit, queue, migrations, Entra alpha, and visibility helpers | 80-85% | Denied-action audit depth, field masking expansion, admin-managed Entra group mapping, permission-management polish |
| Leads | Most mature module; intake, import, duplicate review, website forms, stages, edit, quick insights, lifecycle, alerts foundation are advanced | 75-80% | Production public-form rollout controls, activity/audit completeness, source/campaign governance, real alert delivery, HubSpot cutover confidence |
| Territory | Good kernel; state coverage, TM/RD assignment, map parity, reporting, bulk transfer, visibility are in place | 70-75% | Field execution, route planning, Map My Customer replacement confidence, assignment audit depth, provider/API decisions |
| Training | Strong baseline; catalog, scheduling, execution, certification, recertification, reporting are live | 65-70% | Proof transport depth, training-hours/ROI reporting, Outlook/provider sync hardening, external training-site coexistence |
| Roles / Permissions | Functional RBAC/session/visibility foundation exists | 60-65% | Fine-grained permissions, delegated admin, MFA/session policy, denied-action audit, read-only/support access, field masking |
| CIS / Finance | CIS lifecycle and finance review remain live; eBiz/Moneris card capture is parked after April 20 scope change | 55-65% | Revised card-capture flow decision and provider/source-of-truth boundary |

## Slice 1 - Leads Production Hardening + External Systems Confidence

Status: `Active - website cutover controls expanded 2026-04-28`

### Goals

- Make Pulse-native lead intake production-believable enough to replace HubSpot forms safely.
- Preserve HubSpot history and migration provenance without keeping HubSpot as the future-state intake owner.
- Keep Zoho/Vivo/email marketing as a separate marketing PRD, not a hidden lead-module commitment.
- Make the live lead workspace operationally trustworthy for admin, Strategic Growth, TM, RD, and leadership roles.

### Scope

1. Public website form production controls
   - wildcard public capture CORS removed; responses now echo only approved Pulse app origins with regression coverage
   - per-site allowed-origin enforcement now blocks cross-site submissions while preserving internal Pulse preview origins
   - public capture is protected by server-scoped fixed-window rate limiting with 429 / retry-after responses
   - derived connection readiness per website/form now covers active state, trusted origins, embed identity, and recent submission evidence
   - environment-specific embed preview and production readiness checks are visible in the admin website-forms workspace
   - trial-run checklist so Pulse and current HubSpot forms can run in parallel before cutover
   - clear submission outcome evidence is already returned and regression-pinned through `submissionId`, `outcome`, and `reviewStatus`

2. Source and campaign provenance
   - formal source vocabulary cleanup: Pulse-native sources vs legacy HubSpot migration sources
   - source site, brand, campaign, capture method, and import-run provenance visible in lead detail and reporting surfaces
   - keep marketing campaign attribution fields scoped to lead/source reporting until the parked Email Marketing PRD is approved

3. Admin lead edit and activity completeness
   - ensure full admin-editable lead fields are persisted through the API, not client-only state
   - all meaningful edits write lead history/activity/audit entries
   - stage drag/drop writes explicit transition history and respects workflow validation

4. Duplicate, import, and migration confidence
   - strengthen duplicate review path for website and file imports
   - preserve old HubSpot IDs/source snapshots where imported
   - add a HubSpot cutover and migration-readiness checklist

5. Alert delivery and SLA hardening
   - keep SLA timers and operational alert records
   - wire real provider-backed alert delivery only after notification provider access is approved
   - in the meantime, keep preview/disabled delivery explicit and visible

### Acceptance Criteria

- A website form can be tested in parallel with existing HubSpot intake and show reliable submission evidence.
- Lead detail and Kanban card clearly show source, campaign/site context, rating, routing, SLA, and next action.
- Admin edits create durable history/audit evidence.
- Drag/drop stage changes are persisted and history-backed.
- Duplicate/attached submissions are obvious to users.
- HubSpot is represented as migration/source history, not the active future-state intake platform.
- Zoho/Vivo/email marketing is referenced only as a parked marketing module dependency.

### Recommended Tests

- `pnpm --filter @pulse/api build`
- `pnpm --filter @pulse/crm-web typecheck`
- `node --test --test-concurrency=1 apps/api/test/leads.website-forms.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/leads.import.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/leads.workflow.regression.test.mjs`
- targeted browser flow for public form submission, duplicate attach, lead edit, and card/detail visibility

## Slice 2 - Territory Field Execution + Map My Customer Confidence

Status: `Next after Leads hardening`

### Goals

- Move territory from administration/map parity into field operating confidence.
- Address the April 20 expectation that Pulse can replace more day-to-day field tooling, especially Map My Customer-style planning.

### Scope

- route-planning workspace from territory map/list selection
- selected stops from accounts and active leads
- account map context: last activity, training status, lifecycle, open lead/customer posture
- assignment and route-plan activity logs
- TM/RD visibility validation across map, list, dashboard, and calendar surfaces
- provider-neutral route ordering first; defer provider optimization until map provider/billing decisions are signed off

### Acceptance Criteria

- TM/RD users can use territory surfaces to decide who to visit next.
- Territory map shows enough account/lead/training context to be operational, not just visual.
- Assignment and ownership changes remain auditable.
- Provider-specific route optimization remains parked unless approved.

## Slice 3 - Training Reporting, Proof, And Coexistence Hardening

Status: `After Leads/Territory or parallel if capacity exists`

### Goals

- Make Training executive-reportable and field-proof-ready.
- Keep external training site and Outlook/Teams/WebEx boundaries clear.

### Scope

- proof transport hardening and evidence review
- training hours reporting by account, state, territory, trainer, and session type
- recertification and overdue reporting depth
- export/report templates for leadership
- external training-site coexistence decision memo
- Outlook/provider sync status visibility

### Acceptance Criteria

- Training Ops can prove what happened, who completed it, and what is overdue.
- Leadership can see training volume/penetration and certification posture.
- External training site is documented as remain / integrate / replace later.

## Slice 4 - Roles, Permissions, And Foundation Hardening

Status: `Cross-cutting, should run alongside module slices when touching sensitive data`

### Goals

- Make RBAC product-safe, not only technically present.
- Align API enforcement, route guards, navigation, and field masking.

### Scope

- denied-action audit events
- field masking expansion for finance/pricing/support-sensitive areas
- delegated admin rules and boundaries
- admin-managed Entra group-to-role mapping
- MFA/session-policy decision documentation
- read-only/support access with expiry as a later controlled workflow

### Acceptance Criteria

- Allowed and denied paths are regression-covered.
- Sensitive fields are masked in API responses, not merely hidden in UI.
- Internal and dealer roles remain separate.

## Parked Marketing PRDs Created From April 20 Meeting

The April 20 meeting raised real marketing initiatives. They should be documented now but not moved into the active development pipeline until scope, provider strategy, deliverability, consent, and compliance decisions are approved.

Parked PRDs:
- `docs/parked-prds/MARKETING_EMAIL_CAMPAIGN_PRD_PARKED_2026-04-28.md`
- `docs/parked-prds/MARKETING_SMS_CAMPAIGN_PRD_PARKED_2026-04-28.md`
- `docs/parked-prds/WEBSITE_FORM_ANALYTICS_AND_CUTOVER_PRD_PARKED_2026-04-28.md`

## Not In The Active Pipeline Yet

- Full email marketing engine
- SMS campaign sender
- marketing contact-limit strategy as a product commitment
- open/read/click tracking implementation
- deliverability warmup and sender reputation operations
- full replacement of Zoho/Vivo or any email platform
- marketing consent/unsubscribe/bounce automation

Those are now documented for later approval, but the active engineering pipeline should remain focused on production hardening of Leads, Territory, Training, and Roles/Permissions.
