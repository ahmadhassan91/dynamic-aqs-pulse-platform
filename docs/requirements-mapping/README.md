# Requirements Mapping Index

Date: 2026-04-16

This folder is the implementation-side requirements map for the production Pulse platform.

Purpose:
- keep source-of-truth PRDs and meeting decisions visible in the implementation repo
- map each requirement to current implementation status
- highlight hardening gaps before they become hidden assumptions
- keep parked dependency boundaries explicit

Latest module maps:
- [Foundation / Auth / Users / Roles / Permissions](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/FOUNDATION_AUTH_USERS_PERMISSIONS_REQUIREMENTS_MAP_2026-04-16.md)
- [Leads](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/LEADS_REQUIREMENTS_MAP_2026-04-16.md)
- [Accounts / Contacts](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/ACCOUNTS_CONTACTS_REQUIREMENTS_MAP_2026-04-15.md)
- [Territory](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TERRITORY_REQUIREMENTS_MAP_2026-04-16.md)
- [Training](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TRAINING_REQUIREMENTS_MAP_2026-04-16.md)
- [Calendar](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/CALENDAR_REQUIREMENTS_MAP_2026-04-16.md)

Supporting hardening plan:
- [Module Hardening Plan To 90 Percent](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/MODULE_HARDENING_PLAN_TO_90_PERCENT_2026-04-16.md)
- [Dynamic Team Decision Agenda And Log](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/DYNAMIC_TEAM_DECISION_AGENDA_AND_LOG_2026-04-16.md)
- [Can Do Now Vs Dynamic Decision Tracker](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/CAN_DO_NOW_VS_DYNAMIC_DECISION_TRACKER_2026-04-16.md)

Prior checkpoint maps retained for reference:
- [Users, Roles, Permissions 2026-04-15](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/USERS_ROLES_PERMISSIONS_REQUIREMENTS_MAP_2026-04-15.md)
- [Leads 2026-04-15](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/LEADS_REQUIREMENTS_MAP_2026-04-15.md)
- [Territory 2026-04-15](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TERRITORY_REQUIREMENTS_MAP_2026-04-15.md)
- [Training 2026-04-15](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TRAINING_REQUIREMENTS_MAP_2026-04-15.md)

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
| Leads | 10 | 7 | 2 | 3 | 0 |
| Accounts / Contacts | 6 | 8 | 2 | 0 | 0 |
| Territory | 7 | 8 | 1 | 4 | 1 |
| Training | 9 | 8 | 1 | 2 | 1 |
| Calendar | 7 | 6 | 2 | 2 | 1 |

Use this folder together with:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/traceability`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/DELIVERY_PROGRESS_TRACKER.md`
