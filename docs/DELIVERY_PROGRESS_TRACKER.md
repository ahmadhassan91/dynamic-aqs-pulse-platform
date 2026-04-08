# Dynamic AQS Pulse Delivery Progress Tracker

Last updated: 2026-04-09

This tracker is the production-repo progress view for delivery execution.

Use it to:
- see current build status without re-reading the roadmap
- track what is done, in progress, blocked, or not started
- attach implementation evidence as the team ships foundation and modules

## Status Legend

| Status | Meaning |
| --- | --- |
| `Done` | Implemented, validated, and merged into the platform repo |
| `In Progress` | Active engineering work is underway |
| `Planned` | Sequenced and approved, but not yet started |
| `Blocked` | Waiting on access, sign-off, or dependency closure |
| `Deferred` | Explicitly outside the current active delivery window |
| `Parked` | Intentionally held for a later slice after the current foundation settles |

## Release Tracker

| Release | Target Window | Status | Focus | Notes |
| --- | --- | --- | --- | --- |
| Release 0 | Mar 30 - May 31, 2026 | `In Progress` | Architecture closure, schema baseline, mappings, environment readiness | Engineering repo is live and backend foundation has started. |
| Release 1 | Jun 2 - Aug 24, 2026 | `Planned` | Platform foundation and Wave 0 migration readiness | Depends on Release 0 gate closure. |
| Release 2 | Aug 25 - Nov 16, 2026 | `Planned` | Revenue operations pilot and Wave 1 migration | Starts after core auth/data/integration foundations are stable. |
| Release 3 | Nov 17, 2026 - Mar 8, 2027 | `Planned` | Dealer, field, reporting, consignment pilot | Residential-first delivery with commercial-safe foundations underneath. |
| Release 4 | Mar 9 - May 17, 2027 | `Planned` | Cutover, GA, hypercare | Final migration and controlled launch. |

## Foundation Workstreams

| Workstream | Status | Current Position | Next Step | Evidence |
| --- | --- | --- | --- | --- |
| Monorepo platform bootstrap | `Done` | Production monorepo is established and pushed | Continue feature slices inside the new repo | `README.md`, `turbo.json`, `pnpm-workspace.yaml` |
| PostgreSQL + Prisma core schema | `Done` | Core CRM schema and migration pipeline foundation are in place | Extend schema for auth/session and domain modules | `packages/db/prisma/schema.prisma` |
| Queue and worker runtime | `Done` | `pg-boss` queue and worker bootstrap are live | Add domain jobs after auth/audit foundation | `apps/api/src/queue/` |
| Migration raw snapshot staging | `Done` | Guarded rehearsal/cutover evidence pipeline is implemented | Build normalization/import workers on top | `apps/api/src/modules/migrations/` |
| Migration normalization path | `Done` | Admin-triggered raw-to-canonical normalization is implemented and locally verified | Build governed import workers on top of normalized payloads | `apps/api/src/modules/migrations/` |
| Auth, session, audit persistence | `Done` | Provider-aware auth/session foundation is merged, runtime-verified, and now shared through a reusable request-auth/authz helper | Add Entra and dealer-specific identity flows later without rewriting the session core | `apps/api/src/modules/auth/`, `apps/api/src/utils/audit.ts`, `packages/db/prisma/schema.prisma` |
| Acumatica integration boundary | `In Progress` | Safe client/error scaffold exists | Add certified endpoint adapters after sandbox confirmation | `packages/acumatica/src/` |
| Shared API contract baseline | `In Progress` | Core auth plus explicit customer/contact/location contract surfaces now exist | Add governed import contracts and account hierarchy contracts | `packages/contracts/src/` |
| Account and contact core API | `In Progress` | Authenticated account, contact, and nested location endpoints are implemented and locally verified against Postgres | Expand into hierarchy, lifecycle state, and governed import paths | `apps/api/src/modules/accounts/` |
| Web rewire from prototype data layer | `Planned` | Prototype remains reference baseline | Port and rewire approved screens behind real APIs | `apps/crm-web/` |
| Mobile rewire from prototype data layer | `Planned` | Prototype remains reference baseline | Introduce real auth/session and sync transport | `apps/mobile/` |
| CI/CD and environment controls | `Planned` | Basic build/typecheck flow exists | Add release pipelines, checks, secrets, deployment notes | `infra/` |

## Module Delivery Tracker

| Wave | Module | PRD Readiness | Build Status | Notes |
| --- | --- | --- | --- | --- |
| Wave 0 | Program Foundation & Solution Architecture | `Partial` | `In Progress` | Execution baseline exists; build controls are being established in code. |
| Wave 0 | Security, Identity, Environments & DevOps | `Partial` | `In Progress` | Minimal provider-aware auth foundation underway; Entra not implemented yet. |
| Wave 0 | QA, UAT, Rollout & Adoption | `Coverage Only` | `Planned` | Will be tracked once CI/test/release controls are added. |
| Wave 0 | Master Data, Admin Settings & Configuration | `Partial` | `Planned` | Depends on reference data sign-off and admin CRUD foundation. |
| Wave 0 | Acumatica Integration & Data Migration | `Ready` | `In Progress` | Safe boundary, raw capture, and canonical normalization are underway; sandbox-certified adapters still pending. |
| Wave 1 | Lead Capture & Lead Management | `Ready` | `Planned` | Can start once auth/session and account core are stable. |
| Wave 1 | CIS, Credit & Onboarding Workflow | `Mostly Ready` | `Planned` | Depends on lead and account identity foundation. |
| Wave 1 | Customer, Account, Contact & Multi-Location Management | `Partial` | `In Progress` | Minimal authenticated account/contact/location APIs are verified; hierarchy, classification writes, and lifecycle state are still to come. |
| Wave 1 | Dealer identity at company-account level | `Partial` | `Planned` | Will use shared auth foundation plus account context, not a separate auth stack. |
| Wave 2 | Product Management & Dealer Catalog Governance | `Mostly Ready` | `Planned` | Awaits account/dealer identity and Acumatica product sync groundwork. |
| Wave 2 | Digital Assets & Document Handling | `Mostly Ready` | `Planned` | Keep Widen scope bounded to validated product/dealer workflow. |
| Wave 2 | Pricing & ERP-Dependent Commercial Rules | `Mostly Ready` | `Planned` | Requires Acumatica certification and account/dealer context. |
| Wave 2 | Dealer Portal Replacement for Shopify | `Partial` | `Planned` | Reuse prototype UX, replace local/demo auth and service layer. |
| Wave 3 | Territory Management & Field Routing | `Mostly Ready` | `Planned` | Needs auth, account, and reporting foundation first. |
| Wave 3 | Mobile Field App | `Ready` | `Planned` | Prototype shell will be reused; auth/sync will be rebuilt underneath. |
| Wave 3 | Training Management | `Mostly Ready` | `Planned` | Depends on territory, account, and calendar/integration boundaries. |
| Wave 3 | Reports & Analytics | `Ready` | `Planned` | Semantic layer starts after governed APIs and audit-ready facts exist. |
| Wave 3 | Executive Dashboard | `Partial` | `Planned` | Depends on reports/semantic layer, not before it. |
| Wave 4 | Consignment Management | `Mostly Ready` | `Planned` | Requires warehouse/site master reconciliation and audit cadence logic. |
| Deferred | Commercial CRM Enablement | `Coverage Only` | `Deferred` | Commercial-safe schema stays in foundation; full workflow remains later-phase scope. |

## Current Milestone Checklist

| Milestone | Status | Notes |
| --- | --- | --- |
| New production monorepo created and pushed | `Done` | Active repo: `dynamic-aqs-pulse-platform` |
| Core Postgres/Prisma foundation | `Done` | Core CRM schema and migrations are live |
| Queue/worker foundation | `Done` | `pg-boss` runtime verified |
| Raw-source-first migration foundation | `Done` | Rehearsal/cutover staging verified locally |
| Raw-to-canonical normalization path | `Done` | Capture, normalize, and stage flow is locally verified |
| Provider-aware auth/session foundation | `Done` | Bootstrap auth, refresh, session lookup, logout, and audit events verified locally |
| Account/contact core module start | `Done` | Authenticated list/create/detail/contact endpoints are locally verified |
| Account-location nested API start | `Done` | Nested location list/create endpoints are locally verified |
| Shared request authz helper for business modules | `Done` | Customer routes now reuse one request-auth/authz path instead of duplicating bearer/session checks |
| Progress tracker established in repo | `Done` | This document is the tracker baseline |

## Parked Items

These are intentionally not being built yet, but they should stay visible so they can be picked up later without rediscovery.

| Item | Status | Why Parked Now | Revisit Trigger |
| --- | --- | --- | --- |
| Microsoft Entra login for internal staff | `Parked` | Session core exists; real OIDC wiring should wait until tenant, group mapping, and IT sign-off are ready | Release 0 identity sign-off and tenant access |
| Dealer invite, password reset, and company-user provisioning | `Parked` | Dealer identity depends on account/contact context and portal model, not just auth plumbing | Dealer identity module start |
| MFA, lockout, and password-recovery hardening | `Parked` | Important, but not needed before the core auth/session model is proven | Before non-prod internal pilot |
| Service-to-service/API key identities | `Parked` | Integration boundary exists, but service auth should follow concrete integration needs | When external automation or webhook flows are introduced |
| Fine-grained permission persistence beyond role defaults | `Parked` | Current role/module/action model is enough for early foundation | When admin-managed entitlements are in scope |
| Account classification and business-segment write APIs | `Parked` | Classification ownership and drift-handling rules should not be hardcoded before business sign-off is final | When customer/account modeling moves beyond the minimal core |
| Account-location hierarchy write APIs | `Parked` | Nested location endpoints exist, but full hierarchy modeling needs migration and mapping clarity | Customer workspace expansion |
| Primary contact/location DB-level uniqueness hardening | `Parked` | Service-level guard exists for primary contacts, but stronger relational constraints should follow once hierarchy rules are locked | When account-location and contact write paths expand |
| Account lifecycle state machine and ERP sync status badges | `Parked` | Needs field mapping and first-order activation rules finalized | Customer workspace phase |
| Governed import workers from normalized payloads | `Parked` | Canonical normalization now exists; direct writes into governed CRM tables should wait until field mappings and ownership rules are tighter | After normalized payload review and field mapping sign-off |
| Queue-driven normalization orchestration | `Parked` | Admin-triggered normalization is enough for early foundation; queued batch fanout should follow real data volume and retry needs | When migration rehearsal scale justifies it |
| Prototype web/mobile rewiring to real account APIs | `Parked` | Backend contracts should stabilize before client rewiring starts | After first account/contact API review |

## How To Update This Tracker

When a meaningful slice lands:
1. Update the relevant workstream row.
2. Update the matching module row if delivery status changed.
3. Add or adjust milestone evidence links.
4. Keep notes short and factual.

Do not use this tracker for vague intent.
Use it for shipped evidence, active work, or real blockers.
