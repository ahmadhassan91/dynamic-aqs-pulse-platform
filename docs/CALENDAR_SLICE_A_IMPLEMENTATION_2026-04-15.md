# Calendar Slice A Implementation

Date: 2026-04-15

## Slice Goal

Ship the first real centralized Pulse calendar using live CRM data, while staying provider-free and preserving the approved prototype route direction.

## What Slice A Delivers

Slice A delivers a production-backed centralized calendar workspace at `/calendar`.

It is:

- prototype-aligned
- backend-wired
- driven from real lead and training workflows
- safe to use without Outlook dependencies

## Implemented Scope

### Backend

New backend module:

- `apps/api/src/modules/calendar/service.ts`
- `apps/api/src/modules/calendar/http.ts`

What it does:

- exposes `GET /api/v1/calendar/workspace`
- requires authenticated access to the calendar module
- validates date ranges
- rejects oversized ranges
- aggregates events from governed source modules
- returns a typed calendar workspace response with summary counts and event rows

Current live source modules:

- Lead discovery activity
- Training sessions

Current event types emitted:

- `discovery_call`
- `virtual_training`
- `account_training`
- `on_site_visit`

`consignment_audit` is preserved in the contract, but not yet populated by a live source workflow in this slice.

### Contracts

New contract surface:

- `packages/contracts/src/calendar.ts`

Exposes:

- event type catalog
- event status catalog
- workspace request/response types
- calendar event summary contract

### Frontend

New route and UI:

- `apps/crm-web/src/app/calendar/layout.tsx`
- `apps/crm-web/src/app/calendar/page.tsx`
- `apps/crm-web/src/components/calendar/CalendarWorkspace.tsx`

What the UI now supports:

- month view
- week view
- list view
- event-type filtering
- centralized summary cards
- source-record drill-through
- event detail side panel

Navigation is also wired in the shared shell:

- `apps/crm-web/src/components/layout/Navigation.tsx`

### Web client transport

The web app now calls the live calendar workspace API via:

- `apps/crm-web/src/lib/pulse-api.ts`

## Deliberate product boundary for Slice A

This slice intentionally does not pretend to be the full provider-connected calendar system.

What we intentionally kept out:

- fake Outlook sync
- fake invite dispatch
- fake direct event creation detached from source workflows
- bidirectional provider sync
- Teams/WebEx generation

Scheduling remains owned by the relevant source workflows for now:

- lead discovery remains governed by Lead
- training scheduling remains governed by Training

Calendar is the centralized operations lens across those modules.

## Regression Coverage

Dedicated suite:

- `apps/api/test/calendar.regression.test.mjs`

Current coverage includes:

- centralized route returns discovery + training events together
- completed site visits classify separately from normal training
- unauthenticated route access is rejected
- oversized date ranges are rejected

## Validation

Validated in the implementation repo with:

- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/api test:calendar`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web build`

## What remains for later slices

Next calendar increments should come in this order:

1. Add more live event families as their source modules harden.
   - consignment audit
   - later field/territory visit types if needed
2. Add source-workflow launch affordances where appropriate.
3. Add provider-connected calendar sync after prerequisites are available.
   - Outlook / Graph
   - invite reflection
   - sync status / conflict handling
4. Add broader exception reporting once calendar adoption is real.

## Memory Lock

The most important design decision from Slice A is:

Pulse owns the centralized calendar view first; provider sync is a later dependency-bound layer.
