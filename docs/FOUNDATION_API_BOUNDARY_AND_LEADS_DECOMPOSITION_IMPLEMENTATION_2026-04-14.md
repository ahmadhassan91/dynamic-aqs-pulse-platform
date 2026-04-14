# Foundation API Boundary And Leads Decomposition Implementation

**Date:** 2026-04-14  
**Scope:** first implementation pass for API boundary standardization and `leads` service decomposition

## What Shipped

This slice addressed two architecture-review concerns directly:

1. the API layer was becoming route-heavy and regex-heavy
2. the `leads` module boundary was correct, but `service.ts` was turning into a catch-all

## API Boundary Standardization

The HTTP utility layer now exposes reusable path and query helpers:

- `matchPath()`
- `matchesPath()`
- `readTrimmedQuery()`
- `readIntegerQuery()`

These helpers were applied to the `leads` routes so path matching no longer relies on repeated regex parsing and ad hoc query handling.

Working standard from this slice:

- path parameters should be matched with `matchPath`
- route registration should prefer declarative path matching over inline regex blocks
- trimmed string query access and integer query access should use shared helpers instead of one-off parsing

## Leads Decomposition

The first internal extraction was completed:

- website-form site/recipient configuration and seeding now live in `website-config.ts`
- shared lead string/website-form helpers now live in `shared.ts`

This is an intentional first seam, because the website-form admin/configuration slice had a coherent responsibility and low coupling to the rest of lead workflow behavior.

## What Stayed In `service.ts`

This slice did **not** try to split the entire lead module at once.

`service.ts` still owns:

- lead intake orchestration
- duplicate review orchestration
- workflow queue logic
- lifecycle control
- lead detail/list read models
- import flows
- stage transitions

That was deliberate. The goal was to start decomposition safely, not create a risky sweeping refactor.

## Next Decomposition Targets

The next safe internal splits should be:

1. workflow/history support
2. lifecycle and transition helpers
3. intake/duplicate-review orchestration helpers

## Decision Locked

The architecture feedback is no longer only documented.  
The repo now has an active boundary standard and a real first decomposition seam inside `leads`.
