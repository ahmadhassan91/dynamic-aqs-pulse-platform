# Foundation, Auth, Users, Roles, Permissions Requirements Map

Date: 2026-04-16

Primary source documents:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/FOUNDATION_SECURITY_ADMIN_PRD.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/FOUNDATION_SECURITY_ADMIN_SUPPLEMENT.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/ROLE_BASED_VISIBILITY_REQUIREMENTS.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/02 March session 7 Discovery - Delaer Portal.md`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Dynamic AQS __ Clustox - Discovery Call - Dynamic Team Intro - Date_ 09_12_2025, 20_00.md`

## Newly surfaced or reinforced from meetings and shared artifacts

- Internal staff access and dealer access are intentionally different. Internal users should use Microsoft Entra SSO; dealer users still need company-scoped local credentials and controlled provisioning.
- Creating an internal Pulse user first, then linking Microsoft sign-in by email, is a valid controlled-rollout pattern. It is not only a local-dev quirk.
- Dynamic wants flexible reporting visibility and differentiated permission levels, not one flat admin/non-admin split.
- Delegated admin is a real operational need. Curry and Dan explicitly expect a small number of trusted people to fix assignments, ownership, and setup issues without engineering intervention.
- Read-only or support access is desired, but meetings never fully operationalized scope, masking, duration, or expiration.
- Forgot/reset-password needs are different for internal versus dealer flows. Dealer portal already showed password setup/reset expectations; internal SSO reduces local-password need but does not remove break-glass/fallback needs.

## Current coverage map

| Requirement | Meeting / artifact evidence beyond PRDs | Status | Current implementation evidence | Hardening / next action |
| --- | --- | --- | --- | --- |
| Distinct identity models for internal staff and dealers | Dealer portal sessions repeatedly describe manual dealer invite/setup and company-scoped access; foundation docs confirm Entra for internal users and local auth for dealer users | Implemented (Alpha) | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/auth/service.ts`, `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/dealer-portal/service.ts` | Keep this split explicit and avoid collapsing dealer auth into internal SSO assumptions |
| Internal Microsoft Entra sign-in | Recent live validation proved the round-trip works once redirect URI and client secret are correct | Implemented (Alpha) | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/auth/service.ts`, `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/app/auth/entra/callback/page.tsx`, `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/auth.admin.entra.regression.test.mjs` | Add admin-managed Entra group mapping and rollout diagnostics |
| Existing-user email link for Entra | Current behavior matched the meetings’ least-privilege expectations: no blind access, only approved internal users or mapped groups | Implemented | Same files as above | Document this as the canonical fallback path, not a temporary accident |
| Auto-provision from approved Entra groups | Supported in code through group-role env mapping | Partial | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/auth/service.ts`, `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/auth.admin.entra.regression.test.mjs` | Replace env-only group mapping with admin-managed configuration and audit trail |
| Canonical role catalog for internal and dealer users | Meetings reinforce differentiated personas, including support-like and oversight roles | Implemented | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/src/auth.ts`, `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/lib/auth-catalog.ts` | Reconcile remaining role-name drift between base PRD and supplement |
| Module-level and action-level permission guards | Meetings repeatedly ask for different visibility by person and purpose | Implemented | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/auth/src/guards.ts`, `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/auth/ProtectedWorkspace.tsx` | Continue replacing module-local permission logic with shared guard helpers |
| Record-scope visibility by own/team/territory/region/company | Strongly reinforced in visibility doc and meeting discussion of TM/RD/support/admin access | Partial | Module access exists, but backend record-scope enforcement remains scattered | Build a central record-scope policy layer and apply it to leads, customers, territory, training, and calendar |
| Field-level masking for finance/pricing/private-label/support contexts | Meetings want flexible permissions, but also protect sensitive finance and company data | Missing | Not centrally enforced in response shaping | Add entitlement-driven field masking before calling this module 90% complete |
| Delegated admin authority | Curry explicitly expects a few trusted users to fix ownership and setup issues | Partial | Admin workspace and user CRUD exist in `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/admin/AdminWorkspace.tsx` | Add scoped delegated-admin role rules, approval boundaries, and audit coverage |
| Read-only support access with expiry/scope | Mentioned in PRDs and reinforced by meetings around support/consultant access | Missing | No read-only support role workflow with expiry window is evidenced | Add expiring support access and audit trail before broader rollout |
| Successful-auth/session auditing | Current implementation records successful auth/admin changes | Partial | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/auth/service.ts`, `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/utils/audit.ts` | Add failed-login, denied-access, and Entra-mapping failure audit events |
| Forgot-password flow for internal users | Meetings and supplement mention self-reset, but internal auth is moving toward Entra-first; current code does not evidence a real internal forgot-password flow | Missing | No internal forgot-password endpoints/UI evidenced in current repo | Decide final internal posture: Entra-only self-service vs break-glass local reset |
| Reset-password flow for internal users | Supplement mentions self-reset and future manager reset; current repo does not evidence a production internal reset flow | Missing | No internal reset-password module/UI evidenced | Build only after internal auth posture is locked |
| Dealer password setup and reset | Dealer portal sessions and current UI expect dealer login/password lifecycle | Partial | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/customers/CustomerDealerPortalAccess.tsx`, dealer portal regression suite | Replace temporary-password/admin reset mechanics with fuller dealer self-service and audit |
| MFA policy by role | Docs disagree on which roles require MFA; meetings do not resolve the final matrix | Decision | No production-complete MFA enforcement evidenced | Lock the approved matrix before broad Entra rollout |
| Session timeout / concurrent session cap | Foundation docs and supplement drift here | Decision | Base session/refresh model exists, but no finalized timeout policy is encoded as an approved business rule | Resolve policy and encode it in auth config/tests |
| Account lockout and abuse controls | Supplement references unauthenticated rate limits and lockout-like behavior | Partial | Baseline auth/session exists; complete lockout posture is not clearly evidenced | Add explicit lockout counters, user-facing feedback, and tests |
| Admin integration settings / tenant health surfaces | Needed now that Entra and Outlook are real provider paths | Partial | In-progress admin integration calendar controls exist in working tree under `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/admin/AdminCalendarIntegrationPanel.tsx` | Finish and regression-close this slice so auth/integration rollout is visible to admins |

## Meeting-to-implementation gaps that were easy to miss from PRDs alone

- The meetings implicitly validate an "approved internal user first" pattern for Entra sign-in, because Dynamic wants controlled access, not open tenant login.
- Dealer login/password lifecycle is operationally important because current Shopify/B2B account handling is painful and fragmented.
- Delegated admin is not a nice-to-have. It is part of how Dynamic expects ops to survive day-to-day ownership corrections.
- The support/read-only concept is still not decision-closed enough to build safely without another explicit business call.

## Hardening priority to approach 90%

1. Finalize internal auth posture:
   - Entra-first for internal users
   - explicit fallback/break-glass rule
   - final MFA and session policy
2. Build admin-managed Entra group mapping and diagnostics.
3. Build central record-scope and field-masking enforcement.
4. Add failed-login and denied-access audit coverage.
5. Close dealer password lifecycle with a real self-service or controlled reset model.
6. Only then add support/read-only expiry workflows.
