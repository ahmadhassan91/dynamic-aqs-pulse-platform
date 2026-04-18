# Group Roster Membership Reconciliation

Date: 2026-04-18
Branch: `codex/entra-calendar-governance`

## Summary

Affinity-group and ownership-group roster membership is now handled as a governed reconciliation workflow instead of a blind bulk overwrite.

This slice adds:
- roster file preview for CSV and XLSX
- steward-selected column mapping
- persisted review runs with row-level decisions
- lead/account candidate matching with confidence and conflict detail
- safe application into linked lead/account families

## Why this slice matters

The business does not just maintain the list of valid groups.

It also receives recurring rosters that say who belongs to those groups over time.

Without this slice, we had the governed masters but no safe operational lane for:
- monthly or quarterly membership refreshes
- conflict review before overwriting CRM truth
- row provenance and steward accountability

## What shipped

### Backend

Files:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/reference/roster-file-ingest.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/reference/roster-service.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/reference/http.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/reference/service.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/src/reference.ts`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/db/prisma/schema.prisma`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/db/prisma/migrations/20260418143000_group_roster_import_reconciliation/migration.sql`

Capabilities:
- preview a roster file before persistence
- map source columns into canonical reconciliation fields
- create a durable review run with per-row status and candidate matches
- require steward decisions for ambiguous rows
- apply only reviewed matches
- update linked lead/account families consistently when one side is already related

### Stewardship workflow

Each run now targets one governed group:
- one affinity group
- or one ownership group

Each row becomes one of these outcomes:
- `ready`
- `requires_review`
- `invalid`
- `skipped`
- `applied`
- `failed`

Stewards can then:
- apply a matched row to a chosen entity
- skip the row explicitly

This avoids mixing roster imports into the master-data CRUD surface and keeps source-run provenance intact.

### Frontend

Files:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/GroupRosterImportWorkbench.tsx`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/LeadWebsiteFormsWorkspace.tsx`
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/lib/pulse-api.ts`

Capabilities:
- upload roster file from the existing `Classification Stewardship` workspace
- choose target group and roster kind
- inspect preview rows and mapped columns
- review candidate matches and conflict detail
- commit steward-reviewed decisions into governed CRM classification

## Important guardrails

This slice is deliberately conservative.

It does not:
- auto-create new leads or accounts from unmatched roster rows
- auto-resolve uncertain conflicts without review
- derive dealer group from roster data
- invent ERP-owned price class behavior

That keeps the workflow safe and CRM-owned.

## Verification

Commands run:
- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/db build`
- `pnpm --filter @pulse/api build`
- `node --test --test-concurrency=1 apps/api/test/reference.roster.regression.test.mjs`
- `pnpm --filter @pulse/api test`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`
- `pnpm --filter @pulse/crm-web test:e2e`

Additional note:
- full backend and browser verification remain safest when run sequentially because the shared test database can still produce false negatives under parallel reset pressure

## Regression coverage

Primary regression file:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/test/reference.roster.regression.test.mjs`

Covered cases:
- review run identifies ready, conflict, and unmatched rows
- commit applies reviewed matches into linked lead/account families
- non-admin roles are denied stewardship actions
- ownership reconciliation correctly promotes existing affinity members into `hybrid`

## Focused coverage snapshot

From the targeted roster coverage run:
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/dist/modules/reference/roster-service.js` -> `88.63%` lines, `63.78%` branches, `97.37%` funcs
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/dist/modules/reference/roster-file-ingest.js` -> `62.82%` lines, `42.55%` branches, `88.24%` funcs
- `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/dist/reference.js` -> `100%` lines

## What remains intentionally parked

This slice still does not include:
- reusable saved mapping templates for recurring roster formats
- run-history browsing and reopen UX
- auto-creation of CRM records from unmatched rows
- dealer-group derived resolution
- price-class reference model or Acumatica sync

Those should stay separate so the roster workflow does not absorb unresolved downstream business logic.

## Best next slice

The clean follow-through from here is:
- saved templates and recurring-run ergonomics for real roster operators
- then dealer-group derivation once account context and portal rules are ready
- then price-class only when Acumatica is no longer a black box
