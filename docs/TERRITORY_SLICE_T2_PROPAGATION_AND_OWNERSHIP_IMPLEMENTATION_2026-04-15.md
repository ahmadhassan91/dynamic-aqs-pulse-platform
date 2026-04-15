# Territory Slice T2: Propagation And Ownership Maintenance

Date: 2026-04-15

## What shipped

Territory Slice T2 extends the live territory kernel beyond lead assignment so customer records stay aligned after first-order conversion and later maintenance changes.

Implemented in the production repo:
- account territory reassignment API
- account territory assignment history
- account territory sync helper
- territory-admin refresh propagation into accounts
- account-location change propagation into account territory ownership
- territory command-center customer roster with account override/history flows
- regression coverage for account propagation and admin refresh edge cases

## Backend behavior now live

### Account territory override

New write path:
- `POST /api/v1/territories/assignments/accounts/:accountId`

This:
- validates assignable TM/RD users
- persists account-level override intent
- writes account assignment history
- writes audit
- updates account territory / shipping center / TM / RD fields immediately

### Account territory sync

Account territory state can now be refreshed from three operational paths:
- account primary-location create
- account primary-location update
- territory admin maintenance changes
  - region updates
  - territory updates
  - territory coverage replacement

### Resolution rules

The current T2 dependency-boundary rule is:
1. account-level manual override wins
2. otherwise primary active location drives default state-based territory
3. otherwise current active territory is retained when still valid

This keeps downstream customer ownership consistent without introducing a second, conflicting location-level territory truth model too early.

## UI behavior now live

The territory command center now exposes:
- active customer assignment counts
- unassigned active account watchlist
- customer territory roster
- account territory override modal
- account assignment history modal

All of that stays inside the approved prototype territory shell and uses the live backend.

## Regression coverage added

Expanded module suite:
- `pnpm --filter @pulse/api test:territories`

New account-side territory cases:
- primary-location create derives account territory
- primary-location state change refreshes territory ownership
- manual account override survives later location edits
- territory admin update refreshes account owner/shipping alignment

## Intentional boundary

This slice does **not** introduce true location-scoped territory columns.

Current production truth is:
- location data influences account assignment
- account remains the governed downstream territory owner

That is intentional until operations explicitly require independent territory truth per location.

## What remains next in territory

Next slice:
- `T3 Reporting And Exception Views`

Still open after T2:
- scope-aware territory visibility enforcement
- office-side assignment rule clarification
- workload / exception reporting depth
- route/provider-connected behavior later
