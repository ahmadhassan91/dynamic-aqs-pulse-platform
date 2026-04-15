# Microsoft Entra Internal SSO Implementation

Date: 2026-04-15

## Scope

This slice adds the first real Microsoft Entra internal staff sign-in path for Pulse CRM without replacing the existing Pulse session core.

The implementation deliberately keeps:
- one Pulse session model after login
- dealer authentication separate from internal staff authentication
- local/bootstrap login available as a break-glass and rollout fallback

## What Is Solid

- Backend-owned Entra login start and callback completion routes now exist:
  - `/api/v1/auth/entra/start`
  - `/api/v1/auth/entra/complete`
- The browser login experience now includes a real `Sign in with Microsoft` action from the prototype-aligned `/auth/login` page.
- The frontend callback route now completes the Entra sign-in flow at:
  - `/auth/entra/callback`
- Existing internal Pulse users can now be linked to Entra by email without creating a second duplicate user record.
- Entra auto-provisioning now works for internal users when a mapped Entra group resolves to an approved internal Pulse role.
- Dealer users are explicitly rejected from the internal Entra workspace path.
- Successful Entra sign-ins issue the same Pulse access/refresh session pair used by local password sign-in.
- Successful sign-ins now stamp `lastLoginAt`, which keeps admin overview metrics aligned with real user behavior.

## What Is Risky

- Group-to-role mapping is env-driven right now through `MICROSOFT_ENTRA_GROUP_ROLE_MAP`; it is not yet admin-managed in the product UI.
- The current implementation trusts standard Entra token exchange + profile lookup, but it does not yet add richer policy layers like field masking, record-scope visibility, or delegated-admin entitlements.
- The alpha rollout still keeps local password login enabled for internal users. That is intentional for safety, but it means the organization is in a mixed-mode auth posture until a final cutover decision is made.

## What Is Parked Intentionally

- MFA enforcement and conditional-access rollout coordination
- delegated admin / temporary elevation controls
- SCIM / lifecycle provisioning
- admin-managed Entra group mapping UI
- failed-login / permission-denial audit expansion beyond the current foundation
- production single-tenant app-registration hardening and final tenant-specific rollout posture

## Implementation Evidence

- Backend auth flow:
  - `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/auth/service.ts`
  - `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/auth/http.ts`
  - `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/db/prisma/schema.prisma`
  - `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/db/prisma/migrations/20260415162944_entra_internal_sso_slice/migration.sql`
- Frontend auth flow:
  - `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/app/auth/login/page.tsx`
  - `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/app/auth/entra/callback/page.tsx`
  - `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/auth/LoginForm.tsx`
  - `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/lib/pulse-session.tsx`
  - `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/lib/pulse-api.ts`
- Regression coverage:
  - `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/auth.admin.entra.regression.test.mjs`
  - `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/auth.admin.regression.test.mjs`

## Validation Commands

```bash
pnpm --filter @pulse/contracts build
pnpm --filter @pulse/config build
pnpm --filter @pulse/db build
pnpm --filter @pulse/api test:admin
pnpm --filter @pulse/crm-web lint
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web build
```
