# Lead Correctness And Operational Alert Foundation

Date: 2026-04-18

## What Landed

This slice closed the next correctness gaps in the lead, territory, and centralized-calendar backbone without pretending that outbound notifications already exist.

Implemented:

- manual lead intake now rejects `unknown` as a final affinity/ownership classification state
- lead summaries and detail now carry `potentialValueCents`
- territory-manager lead visibility now respects `preHandoffTmVisibility` through the shared record-scope helper
- the same policy-aware lead scope now flows into lead, CIS, territory, and calendar reads
- a persisted lead operational-alert foundation now exists for:
  - Strategic Growth broadcast alerts
  - initial-contact manager escalation alerts
  - initial-contact leadership escalation alerts
- scheduler/worker registration now scans for those alert conditions on an interval

## Why This Shape

The meetings and PRDs clearly require:

- explicit intake classification instead of silently leaving leads in `unknown`
- a real potential-value signal on leads for later reporting
- pre-handoff TM visibility to be policy-driven, not hardcoded
- SGT and SLA escalation behavior to exist operationally

We intentionally did **not** fake email or provider delivery here.

Instead, this slice creates durable operational alert records with dedupe keys and seeded recipients. That gives us:

- correct business-state capture now
- a clean later handoff into real notifications/delivery
- regression-testable alert behavior without lying about channels that do not exist yet

## Key Files

- `apps/api/src/modules/auth/visibility.ts`
- `apps/api/src/modules/leads/alerts.ts`
- `apps/api/src/modules/leads/service.ts`
- `apps/api/src/modules/cis/service.ts`
- `apps/api/src/modules/territories/service.ts`
- `apps/api/src/modules/territories/visibility.ts`
- `apps/api/src/modules/calendar/events.ts`
- `apps/api/src/server.ts`
- `apps/api/src/queue/definitions.ts`
- `packages/contracts/src/leads.ts`
- `packages/config/src/env.ts`
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260418161500_lead_operational_alerts_and_potential_value/migration.sql`

## Regression Coverage

Dedicated regression additions:

- `apps/api/test/lead.classification.regression.test.mjs`
- `apps/api/test/leads.operations.regression.test.mjs`

Related regressions updated for the new TM pre-handoff policy behavior:

- `apps/api/test/territories.regression.test.mjs`
- `apps/api/test/leads.workflow.regression.test.mjs`
- `apps/api/test/calendar.regression.test.mjs`

## Verification

Passed:

- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/config build`
- `pnpm --filter @pulse/db build`
- `pnpm --filter @pulse/api build`
- `node --test --test-concurrency=1 apps/api/test/lead.classification.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/leads.operations.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/leads.workflow.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/territories.regression.test.mjs`
- `node --test --test-concurrency=1 apps/api/test/calendar.regression.test.mjs`
- `pnpm --filter @pulse/api test`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`
- `pnpm --filter @pulse/crm-web test:e2e`

## Coverage Snapshot

Targeted coverage run:

- `node --test --experimental-test-coverage --test-concurrency=1 apps/api/test/lead.classification.regression.test.mjs apps/api/test/leads.operations.regression.test.mjs`

Highlights from that run:

- `apps/api/dist/modules/leads/alerts.js`: `96.15%` lines, `55.17%` branches, `100%` funcs
- `apps/api/dist/modules/reference/group-classification.js`: `70.11%` lines, `66.67%` branches, `90.91%` funcs
- `apps/api/dist/modules/auth/visibility.js`: `33.53%` lines, `92.31%` branches, `60%` funcs

## Explicitly Still Pending

Still parked after this slice:

- real outbound alert delivery for SGT/manager/leadership recipients
- richer alert preferences/admin management beyond the seeded SGT recipient set
- broader lead operational reporting on top of the new alert records
- more complete field masking on sensitive non-lead domains

This slice delivers the operational truth and worker foundation first, then leaves delivery/provider concerns for the later notifications slice.
