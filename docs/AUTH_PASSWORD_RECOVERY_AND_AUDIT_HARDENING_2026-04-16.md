# Auth Password Recovery And Audit Hardening

Date: 2026-04-16
Branch: `codex/entra-calendar-governance`

## What Shipped

This slice adds the first production-grade self-service password recovery path for local Pulse users while keeping the internal Microsoft Entra rollout and dealer/internal identity boundaries intact.

The main implementation areas are:
- `apps/api/src/modules/auth/service.ts`
- `apps/api/src/modules/auth/http.ts`
- `apps/api/src/modules/auth/types.ts`
- `apps/api/test/auth.password-recovery.regression.test.mjs`
- `apps/crm-web/src/components/auth/LoginForm.tsx`
- `apps/crm-web/src/app/auth/forgot-password/page.tsx`
- `apps/crm-web/src/app/auth/reset-password/page.tsx`
- `packages/config/src/env.ts`
- `packages/contracts/src/auth.ts`
- `packages/db/prisma/schema.prisma`

## Recovery Model

The current recovery behavior is intentionally narrow and safe:

- only active users with a `LOCAL` identity can request self-service password reset
- unknown, inactive, and non-local identities return a suppressed response instead of leaking account state
- reset tokens are stored server-side, expire on a configurable TTL, and are marked used after success
- successful password reset revokes active sessions so old sessions and old passwords stop working immediately

For local and test environments, preview mode is supported so the reset flow can be validated without an email provider:
- the API can return a preview reset URL
- the browser forgot-password page can surface that preview link

## Audit Hardening

This slice also deepens auth audit coverage:

- denied password-login attempts are now recorded for invalid credentials and inactive accounts
- password-recovery requests are audited even when the outward response is intentionally generic
- successful password resets are audited as a first-class auth event

That gives us better security visibility without making the user-facing flow noisy or unsafe.

## What Is Solid

- local-user password recovery now works end to end
- token expiry and one-time use are enforced
- old sessions are revoked after reset
- local/browser flow is available from the real login page
- auth regression coverage now includes recovery, reset, audit, and post-reset login behavior

## What Is Risky

- delivery is still preview-based in this slice; there is no outbound email provider wired yet
- internal Entra-first staff may never need self-service password recovery in the same way as local users, so the final production posture still needs policy confirmation
- the repo still does not have a single formal cross-package coverage toolchain or global thresholds

## What Is Parked Intentionally

- public registration
- dealer-facing self-service registration/recovery rules
- provider-backed email delivery for reset links
- richer admin recovery analytics and dashboards

## Regression Coverage

Validated in this slice:
- `pnpm db:generate`
- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/config build`
- `pnpm --filter @pulse/api build`
- `pnpm --filter @pulse/api test:admin`
- `pnpm --filter @pulse/api test`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web build`
- `pnpm --filter @pulse/crm-web test:e2e`

The browser suite is green when run sequentially. During validation, a concurrent run alongside the full API regression suite caused false negatives because both flows were resetting the same shared test database. The actual browser paths passed once run in isolation.

## Code Coverage Snapshot

There is still no formal repo-wide coverage runner configured through package scripts, so this slice used Node's built-in test coverage to get an honest auth/admin snapshot.

Coverage command used:

```bash
node --experimental-test-coverage --test --test-concurrency=1 \
  test/auth.admin.regression.test.mjs \
  test/auth.admin.integration.regression.test.mjs \
  test/auth.password-recovery.regression.test.mjs
```

Measured highlights from that run:
- overall emitted files: `line 19.80%`, `branch 59.19%`, `func 22.29%`
- `dist/modules/auth/service.js`: `line 53.04%`, `branch 66.33%`, `func 68.09%`
- `dist/modules/auth/policy.js`: `line 94.63%`, `branch 54.39%`, `func 89.47%`
- `dist/modules/admin/service.js`: `line 84.31%`, `branch 58.06%`, `func 96.43%`

This is a useful snapshot, but not yet a full-platform coverage program.

## Best Next Slice

The clean next hardening move is:
- admin-managed Entra group-role mapping and clearer identity governance
- deeper denied-action audit visibility
- field masking where sensitive data goes beyond simple record scope

That keeps foundation, roles, permissions, auth, and user administration moving toward the `~90%` target before we branch further outward.
