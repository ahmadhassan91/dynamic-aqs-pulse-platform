# Requirements Mapping Index

Date: 2026-04-30

This folder is the implementation-side requirements map for the production Pulse platform.

Purpose:
- keep source-of-truth PRDs and meeting decisions visible in the implementation repo
- map each requirement to current implementation status
- highlight hardening gaps before they become hidden assumptions
- keep parked dependency boundaries explicit

Latest module maps:
- [Foundation / Auth / Users / Roles / Permissions](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/FOUNDATION_AUTH_USERS_PERMISSIONS_REQUIREMENTS_MAP_2026-04-16.md)
- [Leads](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/LEADS_REQUIREMENTS_MAP_2026-04-28.md)
- [Accounts / Contacts](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/ACCOUNTS_CONTACTS_REQUIREMENTS_MAP_2026-04-15.md)
- [Territory](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TERRITORY_REQUIREMENTS_MAP_2026-04-28.md)
- [Training](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TRAINING_REQUIREMENTS_MAP_2026-04-28.md)
- [Calendar](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/CALENDAR_REQUIREMENTS_MAP_2026-04-16.md)
- [Consignment](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/CONSIGNMENT_REQUIREMENTS_MAP_2026-04-30.md)

Supporting hardening plan:
- [Module Hardening Plan To 90 Percent](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/MODULE_HARDENING_PLAN_TO_90_PERCENT_2026-04-16.md)
- [Dynamic Team Decision Agenda And Log](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/DYNAMIC_TEAM_DECISION_AGENDA_AND_LOG_2026-04-16.md)
- [Can Do Now Vs Dynamic Decision Tracker](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/CAN_DO_NOW_VS_DYNAMIC_DECISION_TRACKER_2026-04-16.md)
- [Affinity / Ownership / Independent Discovery And Ingest Plan](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/AFFINITY_OWNERSHIP_INDEPENDENT_DISCOVERY_AND_INGEST_PLAN_2026-04-18.md)
- [Account Group Classification Kernel Implementation](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/ACCOUNT_GROUP_CLASSIFICATION_KERNEL_2026-04-18.md)
- [Functional Gaps And Next Slices - 100% Closure Plan](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/FUNCTIONAL_GAPS_AND_NEXT_SLICES_2026-04-28.md)
- [Consignment Build-Now Vs Acumatica-Parked Plan](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/CONSIGNMENT_BUILD_NOW_VS_ACUMATICA_PARKED_PLAN_2026-04-30.md)

Prior checkpoint maps retained for reference:
- [Users, Roles, Permissions 2026-04-15](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/USERS_ROLES_PERMISSIONS_REQUIREMENTS_MAP_2026-04-15.md)
- [Leads 2026-04-15](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/LEADS_REQUIREMENTS_MAP_2026-04-15.md)
- [Leads 2026-04-16](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/LEADS_REQUIREMENTS_MAP_2026-04-16.md)
- [Territory 2026-04-15](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TERRITORY_REQUIREMENTS_MAP_2026-04-15.md)
- [Territory 2026-04-16](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TERRITORY_REQUIREMENTS_MAP_2026-04-16.md)
- [Training 2026-04-15](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TRAINING_REQUIREMENTS_MAP_2026-04-15.md)
- [Training 2026-04-16](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TRAINING_REQUIREMENTS_MAP_2026-04-16.md)

Status vocabulary:
- `Implemented`: requirement is materially live and evidenced in production code/tests
- `Partial`: meaningful implementation exists, but requirement is not complete enough to close
- `Missing`: not yet built in the production repo
- `Decision`: source-of-truth drift or unresolved business decision blocks clean closure
- `Blocked`: external dependency or approved prerequisite is still missing

Current summary after meeting-artifact rediscovery:

| Module | Implemented | Partial | Missing | Decision | Blocked |
| --- | ---: | ---: | ---: | ---: | ---: |
| Foundation / Auth / Users / Permissions | 8 | 6 | 3 | 4 | 1 |
| Leads | 9 | 9 | 1 | 1 | 0 |
| Accounts / Contacts | 6 | 8 | 2 | 0 | 0 |
| Territory | 6 | 6 | 3 | 1 | 1 |
| Training | 7 | 8 | 2 | 1 | 0 |
| Calendar | 7 | 6 | 2 | 2 | 1 |
| Consignment | 6 | 5 | 2 | 2 | 5 |

Use this folder together with:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/traceability`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/DELIVERY_PROGRESS_TRACKER.md`

## 100% closure operating rule

For the April 28 Leads, Territory, and Training maps, `100%` means all map rows are either:
- implemented and regression-covered in the production repo
- explicitly closed by an approved decision and captured in the map
- parked / blocked with an owner, revisit trigger, and no hidden placeholder behavior in active UI

Closure must be updated in three places when a slice lands:
- the module map row and status summary
- `docs/FUNCTIONAL_GAPS_AND_NEXT_SLICES_2026-04-28.md`
- `docs/DELIVERY_PROGRESS_TRACKER.md`

Required regression commands before marking a map row closed:

| Module | Primary command | Cross-check when touched |
| --- | --- | --- |
| Leads | `pnpm --filter @pulse/api test:leads` | `pnpm --filter @pulse/api test:readiness`, `pnpm --filter @pulse/crm-web test:e2e` |
| Territory | `pnpm --filter @pulse/api test:territories` | `pnpm --filter @pulse/api test:leads`, `pnpm --filter @pulse/crm-web test:e2e` |
| Training | `pnpm --filter @pulse/api test:training` | `pnpm --filter @pulse/crm-web test:e2e` |
| Consignment | `pnpm --filter @pulse/api test:consignment` | `pnpm --filter @pulse/api test:calendar`, `pnpm --filter @pulse/crm-web test:e2e` |
| Cross-module RBAC / audit | `pnpm --filter @pulse/api test` | targeted module command above |
