# Territory Requirements Map

Date: 2026-04-15

Primary source documents:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/TERRITORY_MANAGEMENT_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/ROLE_BASED_VISIBILITY_REQUIREMENTS.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/PRD-Lead-To-Dealer.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Shipping and TM map as of 2-2026.jpg`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/05 March-session 8`

| Requirement | Source | Status | Implementation Evidence | Hardening / Next Action |
| --- | --- | --- | --- | --- |
| Territory kernel: region, territory, shipping center, TM/RD ownership | Territory PRD | Implemented | `apps/api/src/modules/territories/service.ts`, schema support, territory regressions | Good base for downstream modules |
| State-based assignment and shipping-center alignment | Territory PRD + current map artifacts | Implemented | territory service, shipping-center alignment, assignment history | Continue validating against current shipping/TM map |
| Manual override with assignment history | Territory PRD | Implemented | override APIs and history in service/tests/UI | Add broader bulk reassignment and customer-side override ops |
| Territory command center under approved prototype shell | Prototype parity rule | Implemented | `/territories`, `/territory_map`, territory components in `crm-web` | Keep route structure stable |
| Interactive coverage map parity | Prototype + current territory map expectation | Implemented | `TerritoryCoverageMapPage.tsx`, `TerritoryMapLibre.tsx`, map read model | Continue enriching overlays and filters |
| Lead ownership posture pre-first-order | Lead-to-dealer journey + visibility rules | Partial | lead assignment kernel exists; final ownership transfer rules still need polish | Harden lead-to-account ownership propagation and handoff rules |
| Account/location propagation of territory truth | Territory PRD + downstream consistency rule | Partial | initial account propagation exists from conversion | Finish propagation and maintenance flows for account/location updates |
| Role-scoped territory visibility | Role-Based Visibility Requirements | Partial | module/action access exists; record-scope visibility is not centrally enforced | Implement scope-aware territory read filters |
| Strategic Growth / National TM precedence flags | Discovery + territory policy posture | Partial | policy flags and UI posture exist | Need explicit approved precedence rules before closure |
| Territory reporting and exception views | Territory PRD + ops expectations | Partial | dashboard counts exist; deeper exception reporting not complete | Build workload/unassigned/coverage-gap reporting |
| Office-side assignment map and shipping vs office control | Meetings + current ops map | Partial | shipping-center aligned kernel exists | Clarify office assignment rules and encode them explicitly |
| Field execution / route behavior | Territory PRD later slice | Decision | not yet modeled beyond map/read models | Rediscover and build only after map/ownership core is fully hardened |

Current hardening priorities:
1. Scope-aware visibility enforcement
2. Lead/account/location propagation maintenance
3. Reporting and exception views
4. Finalize Strategic Growth / National TM precedence rules

