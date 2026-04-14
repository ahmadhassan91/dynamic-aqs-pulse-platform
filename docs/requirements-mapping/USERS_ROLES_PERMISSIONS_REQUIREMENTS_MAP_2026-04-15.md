# Users, Roles, Permissions Requirements Map

Date: 2026-04-15

Primary source documents:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/FOUNDATION_SECURITY_ADMIN_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/FOUNDATION_SECURITY_ADMIN_SUPPLEMENT.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/ROLE_BASED_VISIBILITY_REQUIREMENTS.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/architecture/AUTH_IMPLEMENTATION_GUIDE.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/architecture/SECURITY_AND_SECRETS_ARCHITECTURE.md`

| Requirement | Source | Status | Implementation Evidence | Hardening / Next Action |
| --- | --- | --- | --- | --- |
| 10-role internal/dealer role catalog | Foundation Security/Admin PRD role matrix | Implemented | `packages/contracts/src/auth.ts`, `apps/api/src/modules/admin/service.ts` | Keep this catalog canonical and avoid frontend drift |
| Admin user management: list, create, update, activate/deactivate, import | Foundation Security/Admin PRD admin scope | Implemented | `apps/api/src/modules/admin/service.ts`, `apps/crm-web/src/components/admin/AdminWorkspace.tsx` | Add fuller delegated-admin policy once approved |
| Module and action permission baseline | Foundation Security/Admin PRD + Role Visibility PRD | Implemented | `packages/contracts/src/auth.ts`, `packages/auth/src/guards.ts`, `apps/crm-web/src/lib/access.ts` | Continue replacing ad hoc UI checks with shared permission source |
| Protected workspace and route guard enforcement | Foundation Security/Admin PRD | Partial | `apps/crm-web/src/components/auth/ProtectedWorkspace.tsx`, guarded leads/customers/finance routes | Extend action guards to more screens and cover them in browser regressions |
| Audit trail for successful auth/admin mutations | Foundation Security/Admin PRD | Partial | `apps/api/src/modules/auth/service.ts`, `apps/api/src/modules/admin/service.ts`, `apps/api/src/utils/audit.ts` | Add failed login / permission-denial audit coverage |
| Session restore / refresh / logout behavior | Foundation Security/Admin PRD | Implemented | `apps/crm-web/src/lib/pulse-session.tsx`, `apps/api/src/modules/auth/service.ts` | Good base; keep aligned with final auth transport decision |
| Inactive-user lockout | Foundation Security/Admin PRD | Implemented | `apps/api/src/modules/auth/service.ts`, `apps/api/test/auth.admin.regression.test.mjs` | Preserve in every future auth change |
| Record-scope visibility: own/team/territory/region/company | Role-Based Visibility Requirements | Partial | Module/action guards exist; central record-scope guard does not | Build backend record-scope enforcement kernel next |
| Dealer hierarchy and company-account access | Dealer Portal discovery + Role Visibility Requirements | Partial | `apps/api/src/modules/dealer-portal/service.ts` returns company-linked context | Add hierarchy/affinity/private-label entitlements explicitly |
| Per-user overrides, temporary elevation, label-based entitlements | Foundation Security/Admin PRD | Missing | Not evidenced in persisted auth model | Design override model before broad rollout to ops/support |
| Field-level masking for finance/pricing/private-label data | Role-Based Visibility Requirements | Partial | Module separation exists; field masking is not centrally enforced | Add field entitlement layer and response-shaping rules |
| Internal auth transport / Entra alignment | Auth guide + architecture + PRD validation notes | Decision | Current implementation uses local identity for internal users | Decide Release 0 auth posture and reconcile docs + code |
| MFA, lockout thresholds, concurrent session cap, self-service recovery | Foundation Security/Admin PRD | Blocked | Tracker explicitly parks advanced hardening | Implement once auth posture is finalized |

Current hardening priorities:
1. Central record-scope enforcement
2. Field-level masking for protected data
3. Failed-login and permission-denial audit logging
4. Auth posture decision: local-first alpha vs Entra-first release baseline

