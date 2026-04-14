# Requirements Mapping Index

Date: 2026-04-15

This folder is the implementation-side requirements map for the production Pulse platform.

Purpose:
- keep source-of-truth PRDs and meeting decisions visible in the implementation repo
- map each requirement to current implementation status
- highlight hardening gaps before they become hidden assumptions
- keep parked dependency boundaries explicit

Module maps:
- [Users, Roles, Permissions](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/USERS_ROLES_PERMISSIONS_REQUIREMENTS_MAP_2026-04-15.md)
- [Leads](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/LEADS_REQUIREMENTS_MAP_2026-04-15.md)
- [Territory](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TERRITORY_REQUIREMENTS_MAP_2026-04-15.md)
- [Training](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TRAINING_REQUIREMENTS_MAP_2026-04-15.md)

Status vocabulary:
- `Implemented`: requirement is materially live and evidenced in production code/tests
- `Partial`: meaningful implementation exists, but requirement is not complete enough to close
- `Missing`: not yet built in the production repo
- `Decision`: source-of-truth drift or unresolved business decision blocks clean closure
- `Blocked`: external dependency or approved prerequisite is still missing

Current summary:

| Module | Implemented | Partial | Missing | Decision | Blocked |
| --- | ---: | ---: | ---: | ---: | ---: |
| Users / Roles / Permissions | 5 | 4 | 1 | 1 | 1 |
| Leads | 8 | 5 | 1 | 1 | 0 |
| Territory | 6 | 5 | 0 | 1 | 0 |
| Training | 7 | 4 | 0 | 0 | 1 |

Use this folder together with:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/traceability`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/DELIVERY_PROGRESS_TRACKER.md`

