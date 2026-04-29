# Leads, Territory, and Training 100% Requirements Closure Plan

Date: 2026-04-29

This plan defines what remains before the Leads, Territory, and Training modules can be marked 100% requirements-mapped in the production repo.

100% does not mean every future idea is built. It means every discovered requirement is either:

- implemented and regression-covered
- implemented to a named dependency boundary
- decision-closed with an approved product rule
- blocked by a named external dependency
- parked with a documented reason and re-entry trigger

## Current Readiness

| Module | Current engineering readiness | Main gap to 100% mapping |
| --- | ---: | --- |
| Leads | 86% | HubSpot cutover trust, account-aware duplicate governance, OCR/media provenance, and final routing/source decisions |
| Territory | 82% | Field execution beyond map parity, route-planning foundation, authorship preservation, and commercial/county readiness |
| Training | 80% | Proof governance, leadership reporting/export depth, participant/certification depth, and external-site/provider policy |

## Slice L3 - Leads Cutover Trust And Operational Delivery

Goal:
- Make Pulse-native public intake reliable enough to run beside HubSpot and support shutdown decisions.

Scope:
- persisted submission telemetry and failure/origin events
- HubSpot parallel-run comparison read model
- provider-backed notification delivery once email/SMS provider, sender domain, escalation routing, quiet-hours, retry/dead-letter ownership, and support policy are approved
- operator-facing cutover checklist status per website
- regression coverage for success, blocked origin, rate limit, notification preview/delivery state, and parallel-run evidence

Acceptance criteria:
- every public submission has auditable capture, origin, and resolution evidence
- operators can see whether each branded site is ready, warning, or blocked
- HubSpot can be compared against Pulse for duplicate/missing submission confidence before shutdown
- production notification delivery is either active through the existing alert-delivery worker contract or explicitly blocked by provider/runtime configuration

Remaining decision/dependency:
- final notification provider and sender policy
- recipient governance, quiet-hours/escalation routing, retry/dead-letter ownership, and support runbook for failed deliveries
- whether external edge rate limiting will sit in infrastructure or inside the API

Regression command:
- `node --test --test-concurrency=1 apps/api/test/leads.website-forms.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/leads.operations.regression.test.mjs`

## Slice L4 - Leads Account-Aware Duplicate And History Governance

Goal:
- Close duplicate handling across website, manual, import, OCR, lead, and account contexts without unsafe automatic merges.

Scope:
- account-aware duplicate resolution states
- explicit "attach to existing customer/account" governance
- audit history for duplicate confirmations, enrichments, skipped rows, relinks, and account-side outcomes
- admin activity feed improvements for duplicate decisions
- regression coverage for lead candidate, account candidate, invalid target, idempotent repeat, and inactive/customer-active boundaries

Acceptance criteria:
- operators can explain why a duplicate was created, enriched, skipped, relinked, or attached to a customer/account
- account-side duplicate decisions do not silently overwrite customer truth
- lead history shows meaningful duplicate-resolution events

Remaining decision/dependency:
- approved merge/customer-side governance rule set
- whether account duplicate resolution creates a task, note, contact update, or explicit no-op outcome

Regression command:
- `node --test --test-concurrency=1 apps/api/test/leads.import.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/leads.workflow.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/leads.activity-history.regression.test.mjs`

## Slice L5 - Leads Intake Policy, OCR Provenance, And Readiness Evidence

Goal:
- Finish the remaining intake-quality and field-capture requirements without pretending checklist state is proof.

Scope:
- final manual-intake requiredness policy
- source vocabulary cleanup for Pulse-native vs legacy/migration sources
- OCR source event metadata and durable media retention policy
- mobile-native camera capture handoff
- verified training-session evidence in lead readiness
- homeowner/contractor segmentation reporting dimensions

Acceptance criteria:
- required fields match the approved intake policy and are enforced in API and UI
- OCR capture has raw text, parsed fields, confidence, duplicate preview, media retention status, and operator review state
- lead readiness can reference real training-session completion evidence when available

Remaining decision/dependency:
- final routing-basis wording: Strategic Growth vs TM vs service-tech-count precedence
- media retention and storage policy

Regression command:
- `node --test --test-concurrency=1 apps/api/test/leads.workflow.regression.test.mjs`
- `pnpm --filter @pulse/crm-web test:e2e`

## Slice T3 - Territory Visibility, Authorship, And Ownership Hardening

Goal:
- Make territory ownership reliable across reassignment, map, dashboard, calendar, lead, account, and training views.

Scope:
- central TM/RD visibility policy for territory reads
- immutable author attribution checks for notes/activity after reassignment
- reassignment audit detail for source territory, target territory, actor, reason, and affected records
- regression coverage for allowed/denied TM/RD/admin reads and writes

Acceptance criteria:
- reassignment never rewrites who created historical notes or activities
- out-of-scope TM/RD users cannot read or mutate records through territory side doors
- bulk reassignment remains atomic when mixed-scope records are submitted

Remaining decision/dependency:
- whether target-territory visibility should constrain who can reassign into a territory
- national TM / pre-handoff visibility rule final wording

Regression command:
- `node --test --test-concurrency=1 apps/api/test/territories.regression.test.mjs`

## Slice T4 - Territory Route Planning Foundation

Goal:
- Replace map-only parity with a provider-neutral field-planning workflow.

Scope:
- saved route-plan read/write model
- selected stops from accounts/leads/map pins
- stop ordering without provider optimization
- account context cards: lifecycle, last touch, training status, overdue actions, exceptions
- route-plan history and audit events

Acceptance criteria:
- a TM can create a route plan from visible accounts/leads
- a route plan can be reviewed without calling Google/Mapbox optimization
- stop context supports field prioritization before mobile execution exists

Remaining decision/dependency:
- route optimization provider, billing owner, and optimization rules

Regression command:
- `node --test --test-concurrency=1 apps/api/test/territories.regression.test.mjs`

## Slice T5 - Territory Field Execution And Commercial Readiness

Goal:
- Close the field loop after route planning while keeping commercial/county readiness explicit.

Scope:
- check-in/check-out execution workflow
- required checkout notes and incomplete-visit guardrails
- follow-up task creation
- voice-note placeholder/provider boundary
- county-ready commercial assignment data foundation

Acceptance criteria:
- field visits cannot be completed without required notes
- incomplete visits remain visible as exceptions
- commercial/county fields are modeled without disrupting state-based residential assignment

Remaining decision/dependency:
- voice transcription provider/policy
- commercial county ownership rules

Regression command:
- `node --test --test-concurrency=1 apps/api/test/territories.regression.test.mjs`

## Slice R2 - Training Proof Governance

Goal:
- Make proof capture auditable enough for operations and leadership.

Scope:
- proof review states - landed for approve/reject with reviewer metadata and audit evidence
- download/export metadata - landed with checksum validation and audit evidence
- rejection and re-upload flow - review state landed; rejected-proof exception surfacing and guided re-upload remain next
- retention policy
- proof audit events - landed for proof review

Acceptance criteria:
- proof can be uploaded, reviewed, approved/rejected, and audited - backend and training execution UI now support this
- completion evidence is separate from attendance notes
- missing or rejected proof appears in exception reporting - still pending for rejected-proof queue surfacing

Remaining decision/dependency:
- retention duration and storage policy
- leadership export package layout and delivery audience

Regression command:
- `node --test --test-concurrency=1 apps/api/test/training.proof-upload.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/training.regression.test.mjs`

## Slice R3 - Training Leadership Reporting And Exports

Goal:
- Turn existing reporting foundations into leadership-ready operational packs.

Scope:
- account, territory, trainer, type, state, and exception rollups
- no-training red flags for quarterly/six-month cadence
- export-ready report DTOs
- drill-down from summary to accounts/sessions

Acceptance criteria:
- leadership can answer who was trained, where, by whom, what type, and what is overdue
- exports do not depend on UI-only calculations
- reporting respects territory visibility

Remaining decision/dependency:
- final reporting pack format and schedule

Regression command:
- `node --test --test-concurrency=1 apps/api/test/training.regression.test.mjs`

## Slice R4 - Training Participant, Certification, And Coexistence Closure

Goal:
- Finish certification usefulness without overbuilding a full technician master prematurely.

Scope:
- richer attendee roster for sessions
- technician/certification traceability where certification is issued
- printable/exportable certification evidence
- custom-presentation subtype governance
- external training-site coexistence decision memo and sync/import boundary

Acceptance criteria:
- certification outcomes are traceable to session, account, and participant evidence
- ordinary trainings can remain lightweight
- the old training site is either retained, integrated, replaced, or explicitly parked

Remaining decision/dependency:
- external training-site future state
- Teams/WebEx/Outlook default meeting-provider policy

Regression command:
- `node --test --test-concurrency=1 apps/api/test/training.regression.test.mjs`

## Cross-Module Closure Gates

Before any module is marked 100%:

1. API regression suite for that module is green.
2. CRM web typecheck is green if shared contracts changed.
3. Any frontend route touched has either e2e smoke or a documented reason for backend-only closure.
4. RBAC is enforced in API, not only hidden in UI.
5. Requirement map row status is updated with evidence.
6. Parked or blocked rows name the exact decision/dependency and re-entry trigger.

## Recommended Delivery Order

1. `L3` Leads cutover trust and operational delivery
2. `L4` Leads account-aware duplicate and history governance
3. `T3` Territory visibility/authorship hardening
4. `R2` Training proof governance
5. `R3` Training leadership reporting and exports
6. `T4` Territory route planning foundation
7. `L5` Leads intake/OCR/readiness evidence
8. `R4` Training participant/certification/coexistence closure
9. `T5` Territory field execution and commercial readiness

This order keeps the highest replacement-risk area first, then closes shared trust boundaries before mobile/provider-heavy work.
