# Foundation Scope Visibility And Auth Runtime Hardening

Date: 2026-04-16
Branch: `codex/entra-calendar-governance`

## What Shipped

This slice hardened the foundation around internal authorization, simple CRM-style record visibility, and calendar/runtime stability without turning roles and permissions into a complex custom matrix.

The main implementation areas are:
- `apps/api/src/modules/auth/request.ts`
- `apps/api/src/modules/auth/visibility.ts`
- `apps/api/src/modules/leads/service.ts`
- `apps/api/src/modules/accounts/service.ts`
- `apps/api/src/modules/calendar/events.ts`
- `apps/crm-web/src/lib/access.ts`
- `apps/crm-web/src/lib/auth-catalog.ts`
- `apps/crm-web/src/components/layout/Navigation.tsx`

## Simple Access Model

The access posture in this slice stays intentionally simple:

- global operational roles keep broad visibility
- territory managers only see records they own or that belong to territories they manage
- regional directors only see records they own or that belong to regions they direct
- everything else remains default-deny at the API boundary

This keeps the model closer to the way mainstream CRMs behave:
- easy-to-understand role profiles
- simple scoped visibility for field leadership
- API and UI aligned instead of permission logic drifting into hidden frontend-only checks

## Runtime Hardening

The request-auth layer now treats authorization failures consistently across modules instead of letting role denials crash route handlers.

The biggest practical improvements were:
- authorization errors now resolve to stable API responses instead of runtime blowups
- calendar event reads now respect the same simple territory scope used by lead and customer reads
- bootstrap-auth/test actor helpers now use the correct auth identity shape
- regression suites no longer depend on stale `dist` or mixed-up identity fields to pass

## Calendar Impact

The centralized calendar now benefits from the same permission cleanup:

- training routes return clean `403` responses for calendar-visible but training-restricted roles
- calendar event families are filtered by what the actor can truly access
- territory managers only see owned/managed lead and training events
- browser E2E stays green while the centralized scheduler remains usable

## What Is Solid

- role/module/action access stays simple and readable
- record-scope enforcement now exists in the API, not only the UI
- lead/account/calendar scoped visibility is regression-covered
- admin/auth/calendar suites and browser E2E are green on this branch

## What Is Risky

- broader module-by-module record scoping still needs to expand beyond the current lead/account/calendar/training path
- denied-action auditing can still be deepened
- field masking for sensitive data is still a separate hardening slice

## What Is Parked Intentionally

- highly granular custom permission builders
- admin-editable per-user entitlement matrices
- more advanced delegated-support expiry mechanics
- final Dynamic policy decisions about the full visibility matrix

## Regression Coverage

Validated in this slice:
- `node --test --test-concurrency=1 apps/api/test/calendar.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/leads.workflow.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/accounts.regression.test.mjs`
- `pnpm --filter @pulse/api test:admin`
- `pnpm --filter @pulse/api test:calendar`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web build`
- `pnpm --filter @pulse/crm-web test:e2e`

## Best Next Slice

The clean next hardening move is:
- forgot-password and reset-password production hardening
- denied-access and failed-auth audit depth
- admin-managed auth recovery and recovery diagnostics

That keeps us moving toward the user’s `~90%` target on foundation, auth, users, roles, permissions, and calendar before expanding into new modules.
