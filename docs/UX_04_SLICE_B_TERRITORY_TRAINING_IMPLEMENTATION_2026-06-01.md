# UX-04 Slice B - Territory And Training One-Queue-At-A-Time

Date: 2026-06-01

Status: `Implemented - focused QA passed`

## Goal

Apply the UX-04 simplification rule to the TM/RD and Training Ops workday:

> Keep the operating truth visible, but show only one queue or ledger at a time.

This slice preserves existing Territory and Training backend behavior while reducing stacked registries, watchlists, queue cards, and setup forms.

## Agents Used

Five targeted agents reviewed the slice before implementation:

| Agent lane | Scope | Output used |
| --- | --- | --- |
| Territory UX | Territory list, work queues, bulk transfer | One registry selector; one work queue selector; collapse transfer details until rows are selected. |
| Training UX | Sessions, Training Ops priority queue, proof/certification | Priority chips with counts; one active queue; sessions table reduced to five columns plus actions. |
| Shared UI | Workbench primitives and cross-module patterns | Use existing one-surface Workbench approach and row-action menus; avoid a new design system. |
| Requirements | Territory and Training PRDs plus meeting notes | Keep TM/RD ownership, assignment history, training obligations, certification proof, and role-scoped truth visible. |
| QA/risk | Existing e2e and backend gates | Focused typecheck, lint, route coverage, depth Playwright, and Territory/Training API regressions. |

## Changes Implemented

### Territory

- `/territories?tab=list` now has a single `Territory registry` shell with segmented views:
  - Territories
  - Regions
  - Assignment gaps
  - Lead ledger
  - Account ledger when permitted
- Territory registry table is reduced to:
  - Territory
  - Owner
  - Region
  - Coverage
  - Work
  - Actions when permitted
- Regional registry, assignment gaps, lead roster, and account roster remain reachable, but no longer all render as separate stacked panels.
- `/territories?tab=admin` no longer shows the admin territory workload card wall above the actual work.
- Territory operations now use one queue selector:
  - Accounts
  - Leads
  - Setup when permitted
- Bulk account and bulk lead transfer forms now show search/filter and the selection table first.
- Target territory, named TM/RD override, reason, and transfer note appear only after at least one row is selected.

### Training

- Sessions table is reduced to five decision columns plus row actions:
  - Account
  - Session
  - Trainer
  - Scheduled
  - Status
- Follow-up and field-note counts are folded into the status cell instead of separate columns.
- The separate session-level execution-exception table was removed from the Sessions tab; exceptions are handled in `Priority Queue`.
- Training Ops priority metrics are now filter chips with counts instead of a second KPI strip.
- `Proof & certs` now shows one proof/certification review queue covering:
  - pending certification decisions
  - missing proof
  - rejected proof
- Expiring/expired certification side tables were removed from `Proof & certs`; recertification remains the active certification-due queue.

## Preserved Backend-Wired Behavior

- Territory list, region list, shipping-center data, map workspace, dashboard, assignment history, lead/account reassignment, bulk transfer, and admin setup remain wired.
- Territory role gates remain intact for TM, RD, Training Ops, and admin users.
- Training catalog, accounts, sessions, trainers, operational queue, recertification queue, coaching workload, compliance reporting, proof review, certification decision resolution, and revocation contracts remain wired.
- Site visits remain distinct from formal training sessions.

## Verification

| Check | Result |
| --- | --- |
| `pnpm --filter @pulse/crm-web typecheck` | Passed |
| `pnpm --filter @pulse/crm-web lint` | Passed |
| `git diff --check` | Passed |
| `pnpm --filter @pulse/crm-web test:route-coverage` | Passed, 1/1 |
| `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.depth.config.mjs --grep "UX-03 slice C advanced tables"` | Passed, 1/1 |
| `pnpm --filter @pulse/api test:territories` | Passed, 28/28 |
| `pnpm --filter @pulse/api test:training` | Passed, 21/21 |

Note: one attempted `pnpm --filter @pulse/crm-web test:e2e -- --grep ...` command used the wrong argument shape and Playwright reported `No tests found` after build/seed. The same target was rerun directly with the correct Playwright syntax and passed.

## Test Fixture Stabilization

- Updated the Training compliance reporting test fixture so the non-overdue East cadence due date is relative (`daysFromNow(60)`) instead of hard-coded to `2026-06-01`. This prevents the test from failing when the real current date reaches June 1, 2026.

## Remaining UX-04 Slice B Follow-Up

- Territory Dashboard still has several secondary rollup tables; they are improved from prior slices but could become drill-down views if UAT still feels dense.
- Training execution and certification modals can be progressively disclosed in a later depth pass.
- Shared `WorkbenchQueueSelector` can be extracted if the same pattern repeats in Slice C/D/E.

## Next Recommended Slice

Move to UX-04 Slice C: Product Management and Digital Assets concept simplification.
