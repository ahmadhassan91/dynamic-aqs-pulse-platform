# Auth Session Transport Alignment Implementation

**Date:** 2026-04-14  
**Scope:** short foundation slice to lock the current web auth/session transport story

## Why This Slice Exists

The auth/session domain model was already solid, but the web transport story was still too implicit:

- `crm-web` was persisting the full auth bundle in browser storage
- identity/session snapshots could become stale between browser restore and API reality
- roadmap guidance and implementation intent were aligned philosophically, but not explicit enough operationally

This slice makes the current alpha transport deliberate instead of accidental.

## Decision Locked

Current web auth transport is:

- bearer-token transport for alpha
- browser storage keeps **token pairs only**
- API remains the source of truth for identity/session state
- browser restore must rehydrate through `/api/v1/auth/me`
- if access restore fails, browser may attempt refresh once
- if refresh fails, local session is cleared and the user is sent back through login

This is still an **alpha transport**, not the final production transport.

Future hardening direction remains:

- BFF / httpOnly cookie transport before broader production rollout

## What Changed

### `crm-web`

In `apps/crm-web/src/lib/pulse-session.tsx`:

- persisted session storage now keeps only `TokenPair`
- legacy stored full-auth payloads are still tolerated during read and normalized into the new token-only shape
- browser hydration now restores through API rehydration instead of trusting cached identity/session snapshots
- proactive refresh scheduling now happens from token expiry instead of ad hoc immediate validation loops
- expired or invalid sessions now clear browser storage explicitly
- `rememberMe` is now clearly a **browser storage preference**, not a backend auth behavior

In `apps/crm-web/src/app/auth/login/page.tsx`:

- session-expiry restore errors now surface cleanly on the real login screen

### Regression Coverage

In `apps/api/test/auth.admin.regression.test.mjs`:

- logout now explicitly proves refresh-token invalidation
- inactive-user handling now explicitly proves both access-token and refresh-token rejection

## Why This Is Better

- less stale auth state in the browser
- API stays authoritative for identity and session facts
- clearer boundary between current alpha transport and planned future production transport
- lower risk of web/mobile/API auth drift as more modules land

## What This Slice Intentionally Did Not Do

- no switch to httpOnly cookies yet
- no BFF layer yet
- no Entra/OIDC implementation
- no mobile auth transport change

Those remain later hardening and identity slices.
