# Territory Admin And Bulk Transfer Slice

Date: 2026-04-18
Branch: `codex/entra-calendar-governance`

## What Shipped

- A real bulk customer transfer path now exists for territory operations.
  - Backend: bulk account territory reassignment with per-account assignment history and audit entries.
  - Frontend: prototype-inspired `Operations` tab inside the live `/territories` workspace.
- Territory administration is now exposed in the live workspace instead of staying hidden behind backend-only routes.
  - create region
  - create shipping center
  - create territory
  - update territory ownership / region / shipping-center alignment
  - replace covered states or provinces
- The new operations UI stays inside the approved prototype shell and uses only real backend-backed actions.

## What Is Solid

- Backend bulk account transfer is transactional and writes:
  - territory override state
  - per-account territory assignment history
  - explicit audit entries tagged as `territory.bulk_reassign_accounts`
- Territory creation and edit flows stay aligned to the current territory kernel:
  - region
  - territory
  - shipping center
  - state / province coverage
  - TM / RD ownership
- The current territory map stack still does not require a Dynamic-owned map API key.
  - The live baseline uses MapLibre with CARTO / OpenStreetMap tiles.

## What Is Risky

- The current operations slice is state/province coverage driven, not polygon drawing driven.
- Bulk transfer currently focuses on customer/account reassignment.
  - true merge / split / restructure workflows are not implemented yet
- The prototype showed richer restructure/history concepts than the production kernel currently supports.
  - those were intentionally not faked in the UI

## What Is Parked Intentionally

- polygon drawing / boundary editing
- territory merge / split / restructure workflows
- route optimization and field-routing tools
- provider-backed geocoding / directions / navigation
- county-level commercial territory foundation
- customer notification workflows tied to territory transfer
- deeper exception and performance reporting beyond the current command center and dashboard rollups

## Verification

- `pnpm --filter @pulse/contracts build`
- `pnpm --filter @pulse/api build`
- `node --test --test-concurrency=1 apps/api/test/territories.regression.test.mjs`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web lint`
- `pnpm --filter @pulse/crm-web build`
- `pnpm --filter @pulse/api test`
- `pnpm --filter @pulse/crm-web test:e2e`

## Prototype Alignment Decision

We intentionally took the useful prototype behavior and left the concept-only pieces behind.

Adopted:
- bulk customer transfer
- territory admin/create flows
- visible territory operations surface in the command center

Not adopted yet:
- fake operation progress/history
- territory restructure placeholders
- map drawing without a real polygon-backed kernel

That keeps the territory module closer to the prototype while still staying production-safe.
