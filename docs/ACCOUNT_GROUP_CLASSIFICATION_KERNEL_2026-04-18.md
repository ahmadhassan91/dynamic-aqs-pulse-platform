# Account Group Classification Kernel

Date: 2026-04-18
Branch: `codex/entra-calendar-governance`

## Why This Slice Exists

Dynamic AQS does not use `Affinity Group`, `Ownership Group`, and `Independent` as casual lead tags.

They are business-driving classification inputs that affect:
- lead intake and qualification
- CIS and operator review
- account and customer setup
- reporting and segmentation
- future dealer-group and price-class resolution

The older Pulse shape stored affinity and ownership as optional free-text lead fields. That was not strong enough for the business model described in the meetings.

This slice replaces that weak model with a governed classification kernel.

## Core Architecture Decision

The production-safe model is:
- two explicit axes
- one derived classification

The two axes are:
- `affinity`
- `ownership`

Each axis now stores an explicit state:
- `unknown`
- `none`
- `group`

The final derived classification is then stored as:
- `independent`
- `affinity_only`
- `ownership_only`
- `hybrid`

This matters because:
- `Independent` is not a blank field
- `Unknown` is not the same as `Independent`
- `Hybrid` is a real operating state, not just a reporting trick

## What Shipped

### Schema

The schema now includes:
- `AffinityGroupRef`
- `OwnershipGroupRef`
- `GroupAxisSelection`
- `GroupClassification`

Lead, account, and CIS records now store governed affinity and ownership relationships through ids plus explicit axis-state fields instead of treating free-text lead fields as the canonical business model.

Main files:
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260418103000_account_group_classification_kernel/migration.sql`

### Shared classification kernel

Classification logic is now centralized in:
- `apps/api/src/modules/reference/group-classification.ts`

That module is responsible for:
- normalizing explicit operator input
- resolving `unknown` vs `none` vs `group`
- deriving the final stored classification
- rejecting invalid mixed inputs

The lead, account, CIS, readiness, and territory paths now reuse that shared kernel:
- `apps/api/src/modules/leads/service.ts`
- `apps/api/src/modules/accounts/service.ts`
- `apps/api/src/modules/leads/readiness.ts`
- `apps/api/src/modules/cis/service.ts`
- `apps/api/src/modules/territories/service.ts`

### Reference APIs and seed data

The platform now exposes governed reference data for:
- affinity groups
- ownership groups

Implemented in:
- `apps/api/src/modules/reference/service.ts`
- `apps/api/src/modules/reference/http.ts`
- `packages/contracts/src/reference.ts`

Seeded examples include:
- `AIRESERV`
- `NEXSTAR`
- `CERTAINPATH`
- `EGIA`
- `REDWOOD_SERVICES`
- `APOLLO`

### Lead UI and contracts

Manual lead intake no longer hides this as optional free text.

The lead workspace now requires explicit operator intent:
- choose affinity status
- choose ownership status
- if a lane is `group`, choose the governed group value

Implemented in:
- `apps/crm-web/src/components/leads/LeadWorkspace.tsx`
- `apps/crm-web/src/components/leads/LeadRecordWorkspace.tsx`
- `apps/crm-web/src/lib/pulse-api.ts`
- `packages/contracts/src/leads.ts`
- `packages/contracts/src/accounts.ts`
- `packages/contracts/src/cis.ts`

## Important Dev-Time Decision

Because this is still a development branch and not a production data migration, we made a clean architectural cut:
- the old lead-level canonical free-text affinity and ownership fields were removed from the core lead model
- we did not preserve them as fake “legacy truth” inside `Lead`

That keeps the kernel clean.

We still preserve raw intake evidence where it belongs:
- CIS and public submission artifacts
- import or OCR-style raw capture lanes

So the rule is now:
- core entities use governed classification
- raw intake evidence stays in raw or staging artifacts

## What Is Strong Now

- explicit separation of affinity and ownership
- explicit `unknown` vs `none`
- real stored `hybrid` support
- governed reference tables and APIs
- lead-to-account propagation updated
- territory and CIS read models no longer depend on old lead free-text fields
- manual lead intake now reflects the real business rule instead of silently defaulting

## What Is Still Next

This slice intentionally stops before:
- dealer-group derived resolution
- price-class governed reference model
- roster-import stewardship pipeline
- admin CRUD/import UI for affinity and ownership masters
- richer account and customer maintenance surfaces for editing these classifications

Those are now follow-up slices instead of hidden architecture debt.

## Regression and Verification

Verified in this slice:
- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/db build`
- `pnpm --filter @pulse/api build`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`
- `pnpm --filter @pulse/api test`
- `pnpm --filter @pulse/crm-web test:e2e`
- `node --test --experimental-test-coverage --test-concurrency=1 apps/api/test/lead.classification.regression.test.mjs`

Additional note:
- backend and browser suites are still safest when run sequentially because the shared test database can deadlock under parallel reset pressure

## Focused Coverage Snapshot

From the targeted classification-kernel coverage run:
- `apps/api/dist/modules/reference/group-classification.js` -> `56.73%` lines, `52.08%` branches, `90.91%` funcs
- `packages/contracts/dist/leads.js` -> `100%` lines
- `packages/contracts/dist/reference.js` -> `100%` lines

The lead service is much larger and therefore lower in isolated percentage under a tiny kernel-focused suite, but the important point is that the new classification kernel itself is now directly exercised and no longer only covered incidentally through broader lead flows.

## Best Next Slice

The clean next move is:
- admin stewardship for affinity and ownership masters
- roster-import ingestion and review
- dealer-group and price-class governed follow-through

That lets the business kernel we just fixed continue outward without falling back into free-text behavior.
