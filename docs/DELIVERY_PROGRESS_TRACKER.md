# Dynamic AQS Pulse Delivery Progress Tracker

Last updated: 2026-04-08

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
| Auth, session, audit persistence | `In Progress` | Provider-aware foundation is being wired | Finish bootstrap auth API and persistence validation | `apps/api/src/modules/auth/`, `packages/db/prisma/schema.prisma` |
| Acumatica integration boundary | `In Progress` | Safe client/error scaffold exists | Add certified endpoint adapters after sandbox confirmation | `packages/acumatica/src/` |
| Shared API contract baseline | `In Progress` | Core auth contracts exist and module contracts are starting | Add account/contact/import contracts | `packages/contracts/src/` |
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
| Wave 0 | Acumatica Integration & Data Migration | `Ready` | `In Progress` | Safe boundary and migration staging are underway; sandbox-certified adapters still pending. |
| Wave 1 | Lead Capture & Lead Management | `Ready` | `Planned` | Can start once auth/session and account core are stable. |
| Wave 1 | CIS, Credit & Onboarding Workflow | `Mostly Ready` | `Planned` | Depends on lead and account identity foundation. |
| Wave 1 | Customer, Account, Contact & Multi-Location Management | `Partial` | `Planned` | Will be the first major domain module after auth/audit. |
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
| Provider-aware auth/session foundation | `In Progress` | Local bootstrap auth now, Entra seam preserved for later |
| Account/contact core module start | `Planned` | Next recommended build slice after auth persistence |
| Progress tracker established in repo | `Done` | This document is the tracker baseline |

## How To Update This Tracker

When a meaningful slice lands:
1. Update the relevant workstream row.
2. Update the matching module row if delivery status changed.
3. Add or adjust milestone evidence links.
4. Keep notes short and factual.

Do not use this tracker for vague intent.
Use it for shipped evidence, active work, or real blockers.
