# Territory Requirements Map

Date: 2026-04-16

Primary source documents:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/TERRITORY_MANAGEMENT_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/ROLE_BASED_VISIBILITY_REQUIREMENTS.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/17th March  session 10-To-Be consognment and App.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Shipping and TM map as of 2-2026.jpg`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Consignment/Warehouse_Visit_Tracking_Master.xlsx - Main (1).csv`

## Newly surfaced or reinforced from meetings and shared artifacts

- Territory is not just back-office assignment. It is the field operating system for TMs and RDs.
- Map My Customer parity matters: visible territory polygons, account clusters, route building, quick history, and account drill-through were all part of the desired experience.
- Preserving original note authorship during account reassignment is a real requirement. Dynamic explicitly complained about current CRM behavior that makes the new TM look like the author of all historical notes.
- State does not always mean TM. A state can be assigned to Strategic Growth or to a TM; the precedence is still not cleanly decision-locked.
- Commercial readiness requires county-level foundation even if residential is state-based today.
- Territory operations and calendar are deeply linked for visits, training, and later audits.

## Current coverage map

| Requirement | Meeting / artifact evidence beyond PRDs | Status | Current implementation evidence | Hardening / next action |
| --- | --- | --- | --- | --- |
| Territory kernel: region, territory, shipping center, TM/RD ownership | Current shipping/TM map and meetings confirm this core structure | Implemented | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/territories/service.ts`, schema support, territory regressions | Good base; preserve canonical ownership model |
| Shipping-center aligned assignment | Shipping/TM map image and warehouse materials reinforce this | Implemented | territory kernel and account propagation slice | Clarify any remaining office-side exceptions |
| Manual override with assignment history | Meetings expect trusted admins to correct assignment issues | Implemented | territory override APIs/UI/history | Add bulk reassignment ops and better exception filtering |
| Interactive territory map with coverage overlays | Meetings and prototype both confirm a visual map experience is required | Implemented (core parity) | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/territories/TerritoryMapLibre.tsx`, `/territory_map` | Continue refining overlays, drill-through, and clutter handling |
| Route-building and field planning from map context | Session 10 and session 4 make route planning explicit | Partial | map exists, but route optimization is not production-complete | Build route planning UI/read model; provider optimization can remain a later dependency |
| Account and primary-location propagation of territory truth | Dynamic needs stable ownership after conversion | Implemented to dependency boundary | account territory propagation in accounts/territory services | Keep location-level independent ownership parked until specifically requested |
| Role-scoped territory visibility by TM/RD/admin/support | Meetings and visibility requirements clearly differentiate these views | Partial | module and action access exist; record-scope filters are not centralized | Build scope-aware read filters before calling territory 90% complete |
| Strategic Growth versus TM assignment precedence | Meetings explicitly say a state can belong to SGT or a TM | Decision | policy posture exists, but no final approved precedence matrix | Lock precedence and exceptions in writing |
| National TM / pre-handoff visibility flags | Current implementation carries policy flags, but not a fully approved rule set | Partial | territory policy posture in command center | Finalize with Dynamic before closure |
| Note authorship remains with original actor after account transfer | Session 4 called out this exact pain point | Missing | no explicit immutable-note-authorship safeguard was rediscovered in territory/account transfer UX | Add regression-backed authorship preservation across reassignment flows |
| Map My Customer parity for quick history, last training, sales trend, and account context | Meetings show TMs need immediate visual context from the map | Partial | map pins and drill-through exist | Add richer mobile-style account summary cards, sales context, and last-touch indicators |
| Consignment/audit scheduling visibility by territory | Warehouse tracker and consignment sessions reinforce central calendar and exception needs | Partial | some map/read-model support exists, but not full audit scheduling overlays | Feed consignment audits into territory/calendar views |
| County-level commercial territory foundation | Meetings explicitly mention county-driven commercial assignments | Partial | schema direction is commercial-ready, but county assignment logic is not implemented | Add county-ready data model before commercial rollout |
| Office-side assignment and shipping-versus-office responsibilities | Meetings imply this may differ from simple shipping-center alignment | Decision | not explicitly encoded | Rediscover and close if still operationally relevant |
| Route optimization provider integration | Session 10 mentions Google API-like optimization | Blocked | provider-connected optimization not built | Keep behind map/field-execution hardening until the owned read model is solid |

## Meeting-to-implementation gaps that were easy to miss from PRDs alone

- Territory includes field execution convenience, not just assignment math.
- Author attribution on notes/history is critical when accounts move between TMs.
- Sales context on the map matters because TMs use it to decide who to visit next.
- Consignment/audit due-state belongs in territory operations even when its owning workflow is separate.

## Hardening priority to approach 90%

1. Central record-scope visibility for TM/RD/admin/support.
2. Lock SGT/TM/National TM precedence rules.
3. Preserve note/history authorship across reassignment and transfer.
4. Add richer map/account cards: last contact, last training, sales trend, audit state.
5. Add territory reporting and exception views.
6. Then build route-planning refinement and later provider-connected optimization.
