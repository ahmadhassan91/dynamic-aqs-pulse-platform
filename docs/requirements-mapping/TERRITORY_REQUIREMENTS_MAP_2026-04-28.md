# Territory Requirements Map

Date: 2026-04-28

Scope:
- Pulse CRM territory kernel, field operating context, TM / RD ownership, and Map My Customer replacement boundary
- Sources reviewed from the Dynamic AQS requirements-gathering corpus under `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings`
- Current implementation scan performed in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform`

Primary source artifacts reviewed for this map:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1_ Executive Vision, Objectives & Mobile Strategy.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/17th March  session 10-To-Be consognment and App.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24th March - Session 12 - Reporting and Widen .md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Shipping and TM map as of 2-2026.jpg`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Consignment/Warehouse_Visit_Tracking_Master.xlsx - Main (1).csv`

Implementation evidence reviewed:
- `apps/api/src/modules/territories/service.ts`
- `apps/api/src/modules/territories/http.ts`
- `apps/api/src/modules/territories/visibility.ts`
- `apps/crm-web/src/components/territories/TerritoryCommandDashboard.tsx`
- `apps/crm-web/src/components/territories/TerritoryCoverageMapPage.tsx`
- `apps/crm-web/src/components/territories/TerritoryMapLibre.tsx`
- `apps/crm-web/src/components/territories/TerritoryOperationsPanel.tsx`
- `apps/crm-web/src/components/territories/TerritoryCalendarFeed.tsx`
- `apps/api/test/territories.regression.test.mjs`

## Coverage statement

This map is the full implementation-side territory traceability pass for the current meeting corpus. It includes:
- assignment kernel requirements
- TM / RD visibility and ownership requirements
- map and field-execution expectations
- route planning and route-context expectations
- reporting and escalation expectations tied to territory operations

It does not close mobile-native execution, geofencing, provider route optimization, or ERP revenue truth unless current code evidence exists.

## Newly reinforced from the wider meeting corpus

- Dynamic expects territory to replace more than a map page. It is the field operating system for TMs and RDs.
- Map My Customer replacement means context-rich pins, route-building help, visit logging, and fast account context, not only polygons.
- Historical authorship on notes matters when accounts move between TMs.
- Strategic Growth, territory manager, and national / pre-handoff visibility rules still drift in the source material.
- The meeting set makes clear that route planning should be possible before provider-connected optimization is approved.

## Current coverage map

| Requirement | Meeting / artifact evidence | Status | Current implementation evidence | Hardening / next action |
| --- | --- | --- | --- | --- |
| Territory kernel with region, territory, shipping center, TM / RD ownership | shipping map and February meetings validate this as the base model | Implemented | `apps/api/src/modules/territories/service.ts`, `apps/api/test/territories.regression.test.mjs` | Preserve as the canonical ownership kernel |
| Assignment propagation from lead to account / customer context | meetings consistently assume converted customers keep territory truth | Implemented | territory / account propagation already lives in the service layer and downstream account flows | Keep propagation audited as later modules deepen |
| Manual override with history and admin correction path | meetings expect admins to fix assignment issues and keep ownership trustworthy | Implemented | override behavior, scoped bulk account transfer, and scoped bulk lead transfer in `apps/api/src/modules/territories/service.ts`, territory UI panels, regression coverage | Continue with authorship preservation and field-execution ergonomics |
| Territory command-center UI for operators | field and leadership workflows require a territory operations surface, not raw data only | Implemented | `apps/crm-web/src/components/territories/TerritoryCommandDashboard.tsx`, `TerritoryOperationsPanel.tsx` | Keep sharpening operational context rather than decorative map work |
| Interactive coverage map with pins and territory overlays | `Discovery Session 1_ Executive Vision, Objectives & Mobile Strategy.md` and `24 Feb 2026 Discovery session 4.md` anchor Map My Customer replacement | Implemented (core parity) | `apps/crm-web/src/components/territories/TerritoryMapLibre.tsx`, `TerritoryCoverageMapPage.tsx` | Add richer field cards and route-planning transitions |
| Shipping-center aligned assignment | shipping map artifact and field discussions reinforce shipping-center grounding | Implemented | territory service kernel and propagation paths | Clarify remaining office-side exceptions only if they remain operationally relevant |
| TM / RD scoped visibility across territory views | meetings and field operations assume role-scoped access, not one global map for everyone | Partial | `apps/api/src/modules/territories/visibility.ts`, scoped read filters, reassignment-scope enforcement, and regression coverage in `apps/api/test/territories.regression.test.mjs` | Continue centralizing record-scope rules across calendar/downstream modules and decide whether target-territory visibility should constrain reassignment |
| Strategic Growth vs TM assignment precedence | `24 Feb 2026 Discovery session 4.md` explicitly says a state can belong to Strategic Growth or a TM | Decision | current policy posture exists but is not fully locked as final business truth | Lock precedence, exception path, and reporting implications in writing |
| National TM / pre-handoff visibility rules | meeting corpus and April hardening review both show this is not fully settled | Partial | policy support exists in current services and visibility helpers | Finish the approved rule set before calling territory production-closed |
| Preserve original note authorship after reassignment | `24 Feb 2026 Discovery session 4.md` explicitly complains that reassignment rewrites who appears to have created historical notes | Implemented (lead-transfer safeguard) | bulk lead transfer now records transfer actor metadata in territory assignment history while regression coverage proves existing lead stage/activity author IDs and notes remain unchanged | Extend the same proof pattern if future account/contact note tables add reassignment side effects |
| Route planning from map and list context | `Discovery Session 1_ Executive Vision, Objectives & Mobile Strategy.md` and `17th March  session 10-To-Be consognment and App.md` both call out route planning | Implemented (provider-neutral foundation) | `apps/api/src/modules/territories/service.ts` now derives scoped route plans from live map pins and shipping-center origins; `packages/contracts/src/territories.ts` exposes route-plan stops without external optimizer dependency; `apps/api/test/territories.regression.test.mjs` covers route-plan payloads, TM / RD scoping, and site-visit execution state on account stops; `apps/crm-web/src/components/territories/TerritoryCoverageMapPage.tsx` surfaces route execution rows in the combined map view | Route-builder save/reorder ergonomics and provider optimization stay parked until the provider/mobile boundary is approved |
| Color-coded field context for active customers, prospects, overdue actions, and training / audit posture | March mobile session explicitly asks for color-coded pins and context while building routes | Partial | operations dashboard, map, and calendar feed provide some context | Add account summary cards with last touch, training, lifecycle, and exceptions |
| Check-in / check-out field execution workflow | March mobile session strongly validates required notes on checkout and inability to leave visits incomplete | Implemented (route-visible foundation) | territory map account pins and route execution rows can now create, immediately check in, and complete a real `site_visit` session through the training execution model with required checkout notes; backend regression proves checked-in and completed visit state is exposed on route stops while staying distinct from formal training | Mobile field ergonomics, offline/geofence behavior, and voice dictation remain parked until approved |
| Voice-to-text field logging | executive mobile session and March mobile walkthrough both validate dictation-style field notes | Missing | no production voice transcription / dictation workflow found in current territory code | Park under mobile field execution until approved to build |
| Territory-linked calendar and visit visibility | meetings connect territory work with training, site visits, and later audits | Partial | `apps/crm-web/src/components/territories/TerritoryCalendarFeed.tsx` and shared calendar foundations exist | Deepen territory-owned visit and schedule context beyond current feed parity |
| County-level commercial readiness | meetings explicitly mention state-based residential now and county-level commercial later | Partial | no county-based assignment runtime was rediscovered in current territory code | Add county-ready data foundation before commercial rollout |
| Route optimization provider integration | March mobile session names a future Google-like optimization path | Blocked | no provider-backed optimization engine exists in the production repo | Keep behind a provider-neutral route-plan foundation until billing / provider decisions are approved |

## Status summary

| Status | Count |
| --- | ---: |
| Implemented | 7 |
| Partial | 5 |
| Missing | 3 |
| Decision | 1 |
| Blocked | 1 |

## Easy-to-miss gaps surfaced by the meeting corpus

- Map My Customer replacement is broader than map pins. Dynamic wants visit-planning confidence.
- The note-authorship complaint is concrete and easy to miss if you only read the PRD layer.
- The current repo has credible territory truth, but not yet the full TM field-execution loop.
- Route optimization is not the first thing to build; route context and selection come first.

## Hardening priority to approach production confidence

1. Centralize TM / RD visibility and ownership rules across all territory reads.
2. Add route-builder UI ergonomics and field-context cards before any provider optimization work.
3. Preserve note authorship and reassignment history explicitly.
4. Build the first real check-in / checkout execution path when the mobile slice opens.
5. Lock Strategic Growth / TM / National TM precedence and any county-ready commercial decisions.

## 100% closure slices

Territory closure is tracked through `T1`, `T2`, `T3`, and the cross-cutting `X1` RBAC / audit gate in `docs/FUNCTIONAL_GAPS_AND_NEXT_SLICES_2026-04-28.md`.

| Slice | Requirement rows closed when complete | Acceptance criteria | Blocked decisions / dependency notes | Regression command |
| --- | --- | --- | --- | --- |
| `T1` Route-planning foundation | Route planning from map/list context; color-coded field context; territory-linked calendar and visit visibility depth | TM/RD users can select account/lead stops, save and reopen route plans, see last-touch/training/lifecycle/open-work context, and use route plans without provider optimization | Maps/routing provider, billing owner, sample address pack, route optimization algorithm, and geocoding precision stay parked until provider-neutral route plans are live | `pnpm --filter @pulse/api test:territories` |
| `T2` Visibility and authorship hardening | TM/RD scoped visibility; Strategic Growth / national / pre-handoff visibility; original note authorship; reassignment transfer evidence | Territory, lead, account, calendar, and training-adjacent reads apply one scope model; reassignment preserves immutable note authorship and records actor, reason, old owner, new owner, and timestamp | Strategic Growth vs TM vs national precedence, target-territory reassignment constraints, and pre-handoff visibility rules require written approval | `pnpm --filter @pulse/api test:territories` plus `pnpm --filter @pulse/api test:leads` for propagation |
| `T3` Field execution | Check-in/check-out visit workflow; required notes; follow-up tasks; voice-to-text boundary | A field visit can be started, completed, reviewed, and tied to follow-up tasks with durable timestamps and role-scoped visibility; voice transcription is either approved and covered or explicitly parked | Mobile app boundary, offline behavior, voice provider, geofence expectations, and route-activity analytics remain parked until field-execution scope is approved | `pnpm --filter @pulse/api test:territories`; add `pnpm --filter @pulse/crm-web test:e2e` when web visit UX changes |
| `Commercial / provider decisions` | County-level commercial readiness; provider route optimization | County-ready data fields and provider interfaces are only closed after the business approves commercial rollout timing and provider/billing ownership | County-level territory truth, polygon/restructure workflows, provider optimization, and ERP revenue truth are blocked or parked dependency items | Do not mark closed without a new targeted regression suite and `pnpm --filter @pulse/api test:territories` |
| `X1` RBAC and audit gate | Sensitive territory reads/writes, transfer audit, masking, and parked boundaries | API-level permission denial coverage exists for every new write path, denied actions are audited where applicable, and parked route/provider/revenue behavior is visible instead of mocked | Canonical role/action matrix and record-scope policy may gate pilot readiness | `pnpm --filter @pulse/api test` |

Territory should not claim 100% closure by building map decoration alone. Closure requires route planning, authorship-safe reassignment, scoped visibility, and the first durable field-execution loop, while provider optimization and commercial county rollout remain explicit parked or blocked boundaries.
