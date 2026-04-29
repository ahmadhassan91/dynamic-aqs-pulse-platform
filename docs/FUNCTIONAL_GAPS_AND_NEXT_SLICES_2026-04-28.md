# Functional Gaps And Next Slices

Date: 2026-04-28

Source inputs:
- `docs/requirements-mapping/LEADS_REQUIREMENTS_MAP_2026-04-28.md`
- `docs/requirements-mapping/TERRITORY_REQUIREMENTS_MAP_2026-04-28.md`
- `docs/requirements-mapping/TRAINING_REQUIREMENTS_MAP_2026-04-28.md`
- `docs/NEXT_SLICE_PRODUCTION_HARDENING_ROADMAP_2026-04-28.md`

## What counts as a gap

This plan focuses on three requirement-gap types:

1. Production gaps
   - the requirement shape exists, but reliability, audit, or operator trust is not production-ready
2. Functional gaps
   - the requirement is only partially implemented or missing
3. Decision gaps
   - implementation should pause at a governed boundary until business rules are locked

## Module gap summary

| Module | Implemented | Partial | Missing | Decision | Main readiness problem |
| --- | ---: | ---: | ---: | ---: | --- |
| Leads | 9 | 9 | 1 | 1 | Website cutover trust and cross-channel duplicate governance |
| Territory | 6 | 6 | 3 | 1 | Field execution confidence beyond map parity |
| Training | 7 | 8 | 2 | 1 | Reporting, proof governance, and coexistence clarity |

## Leads gaps

### Production gaps

- Website forms still need rate limiting, abuse controls, connection health, and cutover evidence.
- Alerting exists as a foundation but is not yet real provider-backed delivery.
- Admin edit history and public-form operational events need fuller audit depth.

### Functional gaps

- Duplicate handling is now governed for website repeats, imports, and manual intake preview/blocking, but merge/update semantics and account-linked resolution still need final governance.
- Manual intake requiredness and validation still need to match the agreed intake policy more tightly.
- Onboarding and training readiness still lean too much on checklist state instead of stronger downstream evidence.
- Homeowner vs contractor segmentation exists, but downstream reporting and governance need tightening.
- Badge / business-card OCR capture now has a responsive manual-intake preview lane, but mobile-native capture, retention policy, and provider-hardening remain incomplete.

### Decision gaps

- Routing precedence between Strategic Growth, TM, and service-tech-count driven rules still needs final sign-off.

## Territory gaps

### Production gaps

- TM / RD visibility rules need to be centralized across map, dashboard, list, calendar, and downstream reads.
- Assignment and reassignment remain functional, but historical authorship preservation is not fully protected.

### Functional gaps

- Route planning is not yet a real production workflow with selected stops, saved plans, and operator context.
- Account context on territory surfaces is still too light for day-to-day field decision-making.
- Check-in / check-out execution is still missing.
- Voice-to-text field logging is still missing.
- County-level commercial readiness is not yet implemented.

### Decision gaps

- Strategic Growth vs TM vs national visibility precedence still needs to be locked.
- Route optimization provider work should remain parked until provider and billing decisions are approved.

## Training gaps

### Production gaps

- Proof upload exists, but proof review, download, retention, and governance are still shallow.
- Reporting exists, but leadership-grade exports, exception views, and trainer / territory drill-downs are not complete.
- Scheduling is CRM-first in direction, but provider status visibility and pilot-hardening are still needed.

### Functional gaps

- Custom presentation subtype handling is not explicit enough yet.
- Rich participant / attendee depth is still light for certification operations.
- External training-site coexistence is not yet represented with an explicit operating policy.
- Voice-to-text field execution is still missing.
- Contest / giveaway / value-delivered tracking is still missing as a linked adjacent model.

### Decision gaps

- Outlook / Teams / WebEx policy and default meeting behavior still need final approval.

## Recommended slice order

The right order is still:

1. Leads hardening first
2. Territory field-execution next
3. Training proof/reporting hardening next
4. Cross-cutting RBAC/foundation work alongside each sensitive slice

That order matches the April 20 direction that Pulse-native lead intake is the most immediate replacement-risk area.

## Planned slices

### Slice L1 - Leads website cutover controls

Status:
- Partially delivered on 2026-04-28; server-scoped rate limiting, site readiness, embed/origin health, and public submission outcome evidence are now delivered.

Goal:
- Make public intake trustworthy enough to run in parallel with HubSpot and prepare for shutoff.

Scope:
- per-site rate limiting and abuse controls - delivered as server-scoped fixed-window protection
- site/form connection health - delivered as derived readiness on website-site summaries
- embed preview vs production readiness checks - delivered in the admin website-forms workspace
- submission outcomes that clearly distinguish new lead, attached duplicate, and review required - regression-pinned through existing response fields
- cutover checklist and operator-visible parallel-run confidence

Exit criteria:
- admins can see whether each site/form is healthy - delivered
- public capture is abuse-protected - delivered for the current single-process API boundary
- operators can prove submissions are arriving and how they resolved - partially delivered through readiness and duplicate-review evidence

Remaining L1 depth:
- persisted origin/failure telemetry if the team wants historical cutover proof
- HubSpot parallel-run monitoring
- production notification delivery provider
- external / edge rate limiting if the API is horizontally scaled

### Slice L2 - Leads duplicate and audit governance

Status:
- Partially delivered on 2026-04-29; manual-intake duplicate UI preview, blocking, create-new acknowledgement, non-destructive manual enrich-existing lead resolution, website repeat-submission enrich-existing resolution, import-row enrich-existing resolution, and duplicate-enrich history labels are now delivered.

Goal:
- Make lead history and duplicate resolution trustworthy across all intake paths.

Scope:
- broader dedupe kernel for website, manual, import, and account-linked contexts - website repeats, imports, and manual-intake preview/blocking are now delivered against existing lead/account duplicate candidates
- explicit duplicate resolution states and merge/update guardrails - manual create-new override plus manual / website / import enrich-existing lead resolution now require a reason and write audit metadata; account-aware resolution remains pending
- fuller admin-edit activity history
- stage-transition audit completeness

Exit criteria:
- users can understand why a lead attached, duplicated, or required review - delivered for manual intake, website repeats, and imports
- meaningful lead edits and stage moves are durable in history/audit - still pending for broader admin-edit coverage

Remaining L2 depth:
- account-aware duplicate resolution and later merge / customer-side governance
- richer admin-edit activity history
- stage-transition audit completeness review across drag/drop and API paths

### Slice L3 - Leads intake policy and readiness evidence

Goal:
- Close the remaining requirement drift inside intake and lead-to-customer readiness.

Scope:
- tighten manual intake requiredness and validation
- align onboarding milestone naming and evidence
- strengthen homeowner / contractor segmentation outputs
- document final routing precedence

Exit criteria:
- intake fields and validation reflect approved policy
- readiness is backed by stronger evidence than simple checklist posture
- routing policy is documented and implemented consistently

### Slice L4 - Leads mobile OCR card and badge capture

Status:
- Partially delivered on 2026-04-29; responsive New Intake now accepts PDF/photo uploads, uses a PyMuPDF direct-text pass with Tesseract/Pillow fallback, fills a reviewed lead draft, and surfaces duplicate candidates before create.

Goal:
- Let field teams capture show badges and business cards into governed lead intake without bypassing duplicate review, routing, or source attribution.

Scope:
- mobile or responsive capture surface for badge / business-card image upload - responsive CRM New Intake preview delivered; mobile-native camera flow remains pending
- OCR extraction worker with provider boundary kept abstract - delivered as local PyMuPDF + Tesseract/Pillow processor with provider path still swappable
- raw image storage with retention policy and access control
- parsed contact/company/state/email/phone review screen before lead creation - delivered in manual intake draft
- confidence scoring and operator correction workflow - delivered as review reasons and editable intake fields; deeper field-level review queue remains pending
- source metadata for show/event, capture method, captured by, and captured at
- duplicate detection before commit using the same governed lead intake path - delivered for OCR preview and reinforced again at create

Exit criteria:
- a captured card/badge lands in a review queue, not directly as untrusted lead truth - delivered as a reviewed draft inside New Intake
- users can correct OCR fields before committing - delivered
- committed leads preserve capture provenance and route through normal lead assignment
- low-confidence OCR and duplicates are explicit review states - delivered in preview response/UI; durable queue state remains pending

Decision / dependency notes:
- local OCR is now selected for the first internal preview lane: PyMuPDF direct extraction first, Tesseract/Pillow fallback for scanned/image content; Apple Vision / Google Vision / AWS Textract / Azure Document Intelligence remain future provider options if accuracy/deployment requires them
- do not store business-card images indefinitely until retention and privacy rules are approved
- this should follow `L2` duplicate governance, because OCR capture will create more duplicate pressure

### Slice T1 - Territory route-planning foundation

Goal:
- Move territory from map parity into field operating usefulness.

Scope:
- provider-neutral route-plan model
- selected stops from accounts and active leads
- save/view route plans from map and list context
- account context cards with last activity, training status, lifecycle, and open work

Exit criteria:
- TM/RD users can build a usable visit plan inside Pulse
- route planning works without any provider-optimization dependency

### Slice T2 - Territory visibility and authorship hardening

Goal:
- Make territory ownership and reassignment behavior trustworthy under real usage.

Scope:
- centralize TM / RD / national visibility rules
- preserve original note authorship across reassignment
- strengthen assignment activity history and transfer evidence
- document Strategic Growth precedence and exceptions

Exit criteria:
- all territory reads respect the same role-scope rules
- reassignment never rewrites note authorship

### Slice T3 - Territory field execution

Goal:
- Open the first real field-visit loop.

Scope:
- check-in / check-out workflow
- required notes / completion guardrails
- follow-up task creation from visits
- park voice-to-text behind an approved mobile execution boundary if not yet ready

Exit criteria:
- a field visit can be started, completed, and reviewed with durable evidence

### Slice R1 - Training proof and reporting hardening

Goal:
- Make training defensible for leadership, compliance, and account reviews.

Scope:
- proof review/download/governance
- overdue and no-training exception views
- training hours, penetration, and compliance report packs
- exports by account, trainer, territory, state, and session type

Exit criteria:
- Training Ops can prove what happened
- leadership can answer volume, overdue, and certification posture questions from Pulse alone

### Slice R2 - Training participant and coexistence policy

Goal:
- Close the operational gaps around certification depth and external system boundaries.

Scope:
- richer participant / attendee model
- explicit custom presentation subtype handling
- external training-site remain / integrate / replace memo
- approved Outlook / Teams / WebEx policy

Exit criteria:
- certification operations are not blocked by shallow attendee modeling
- external training-site and provider boundaries are explicit

### Slice R3 - Training adjacent value tracking

Goal:
- Capture training-adjacent business value without polluting the core training model.

Scope:
- linked records for contests, giveaways, and value delivered
- account-history visibility for those records
- keep ownership boundary separate from core training completion and certification

Exit criteria:
- teams can record value-delivered signals without turning training into a junk drawer

## Cross-cutting slice that should run in parallel

### Slice X1 - RBAC and audit hardening

Apply during L1-L3, T1-T3, and R1-R3 whenever sensitive reads or writes change.

Scope:
- denied-action audit events
- masking expansion where training, lead, or territory surfaces expose sensitive fields
- tighter role-based regression coverage

Exit criteria:
- new module behavior is protected at API level, not only in UI

## Delivery recommendation

The next working queue should be:

1. `L1 Leads website cutover controls`
2. `L2 Leads duplicate and audit governance`
3. `L4 Leads mobile OCR card and badge capture`
4. `T1 Territory route-planning foundation`
5. `T2 Territory visibility and authorship hardening`
6. `R1 Training proof and reporting hardening`

Only after those should we open:
- `L3`
- `T3`
- `R2`
- `R3`

That sequence closes the most immediate production-replacement risk first, then builds field confidence, then leadership/reporting confidence.

## 100% requirements closure plan

This is the working closure plan for the April 28 Leads, Territory, and Training maps. A requirement is considered closed only when the production code path exists, the user-facing surface is backend-wired, the audit / permission / parked-boundary behavior is explicit, and the listed regression command is green.

### Closure sequence

| Order | Slice | Closes | Acceptance criteria | Blocked decisions / dependency notes | Regression command |
| ---: | --- | --- | --- | --- | --- |
| 1 | `L1` Leads website cutover controls | Website replacement confidence, embed readiness, abuse controls, submission outcome proof | Site admins can see readiness per branded site; public capture rejects untrusted origins and is rate-limited; submission outcomes distinguish new, duplicate, review, and failure states; cutover evidence can support HubSpot parallel-run comparison | Historical origin/failure telemetry, external edge rate limiting, HubSpot parallel-run reporting format, and production notification provider remain decision/dependency items | `pnpm --filter @pulse/api test:leads` |
| 2 | `L2` Leads duplicate and audit governance | Website / manual / import duplicate trust, account-aware resolution, admin edit history | Every intake path exposes duplicate candidates before commit or audited enrich / create-new decisions; account-aware resolution rules are explicit; meaningful admin edits, source changes, and stage moves are durable in lead history | Cross-entity merge semantics, customer-side relink rules, bulk import precedence, and source-run provenance need business sign-off | `pnpm --filter @pulse/api test:leads` |
| 3 | `L4` Leads mobile OCR card and badge capture | Field capture, OCR review, capture provenance | Captured cards/badges land in review before becoming lead truth; users can correct extracted fields; duplicate detection runs before commit; capture method, event/source, captured-by, and captured-at metadata survive in history | Mobile-native camera UX, media retention window, storage provider, and OCR provider escalation remain open | `pnpm --filter @pulse/api test:leads` plus `pnpm --filter @pulse/crm-web test:e2e` when the mobile/responsive flow changes |
| 4 | `L3` Leads intake policy and readiness evidence | Remaining intake drift, segmentation reporting, lead-to-training readiness | Manual requiredness matches approved policy; homeowner/contractor dimensions are reportable; readiness is backed by downstream CIS/training evidence rather than checklist-only posture; routing precedence is documented in the policy artifact and enforced in one path | Strategic Growth vs TM vs service-tech-count precedence, discovery mandatory vs optional strictness, and active lead-source vocabulary need final sign-off | `pnpm --filter @pulse/api test:leads` and `pnpm --filter @pulse/api test:readiness` |
| 5 | `T1` Territory route-planning foundation | Provider-neutral route planning and richer field context | TM/RD users can select stops from accounts/leads, save a route plan, reopen it from map/list context, and see account cards with last touch, lifecycle, training status, and open work; no provider optimization is required for closure | Maps/routing provider, billing owner, sample address pack, and provider optimization stay parked until after provider-neutral route plans work | `pnpm --filter @pulse/api test:territories` |
| 6 | `T2` Territory visibility and authorship hardening | Visibility consistency, reassignment trust, immutable authorship | Territory, lead, account, calendar, and training-adjacent reads apply the same TM/RD/national scope rules; reassignment records preserve original note authorship; transfer evidence shows old owner, new owner, reason, actor, and timestamp | Strategic Growth / national / pre-handoff visibility precedence and target-territory reassignment constraints need approval | `pnpm --filter @pulse/api test:territories` plus `pnpm --filter @pulse/api test:leads` for propagation paths |
| 7 | `T3` Territory field execution | Check-in / check-out visit loop | A visit can be started, completed, and reviewed with durable timestamps, required checkout notes, follow-up tasks, role-scoped visibility, and assignment history; voice-to-text is parked unless mobile execution scope is approved | Mobile app boundary, offline behavior, voice transcription provider, and geofence expectations remain outside closure until approved | `pnpm --filter @pulse/api test:territories` plus `pnpm --filter @pulse/crm-web test:e2e` when web visit flows change |
| 8 | `R1` Training proof and reporting hardening | Proof governance, exception views, leadership reporting | Proof can be reviewed, downloaded/exported, retained under policy, and tied to session/certification outcomes; exception views cover overdue, no-training, recertification, trainer, territory, state, and session-type questions; leadership exports are reproducible | Storage provider, retention policy, report-pack layout, and certification authority rules need approval where they affect legal/compliance posture | `pnpm --filter @pulse/api test:training` |
| 9 | `R2` Training participant and coexistence policy | Attendee depth, custom presentations, external training-site boundary | Participant/attendee records support certification operations without forcing a heavyweight technician master; custom presentation subtype handling is explicit; remain / integrate / replace policy for the external training site is documented | External training-site future state, sync direction, participant requiredness, Outlook / Teams / WebEx policy, and default meeting behavior need sign-off | `pnpm --filter @pulse/api test:training` |
| 10 | `R3` Training adjacent value tracking | Contests, giveaways, value-delivered tracking | Value-delivered signals are linked account-history or training-adjacent records, visible where useful, and excluded from core completion/certification truth; ownership boundary is explicit | Marketing vs Training Ops ownership, allowed value categories, reporting audience, and any promotion/compliance rules need approval | `pnpm --filter @pulse/api test:training` |
| 11 | `X1` RBAC and audit hardening | Cross-module closure gate | Each closing slice includes API-level permission denial coverage, denied-action audit where applicable, masking review for sensitive fields, and parked dependency behavior that is visible to operators | Canonical role/action matrix, internal identity policy, and broader entitlement model are foundation decisions that may gate final pilot readiness | `pnpm --filter @pulse/api test` |

### Closure rules by module

Leads can reach 100% requirement closure for the current map after `L1`, `L2`, `L3`, `L4`, and the relevant `X1` gates are complete. Marketing campaigns, Zoho/email-platform replacement, SMS, promotions, and homeowner response automation remain parked PRDs and should not be counted against the Leads closure percentage unless Dynamic AQS moves them into active scope.

Territory can reach 100% requirement closure for the current map after `T1`, `T2`, `T3`, and the relevant `X1` gates are complete. Provider route optimization, polygon editing/restructure workflows, ERP revenue truth, county-level commercial rollout, geofencing, and voice transcription remain blocked or parked until explicit provider, billing, mobile, or commercial decisions are approved.

Training can reach 100% requirement closure for the current map after `R1`, `R2`, `R3`, and the relevant `X1` gates are complete. Outlook / Teams / WebEx reflection, external training-site sync, provider-backed file storage, printable certification authority, and value-delivered ownership are closure decisions, not silent implementation assumptions.
