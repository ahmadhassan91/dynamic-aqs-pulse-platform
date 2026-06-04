# UX-04 Slice A - Leads And Accounts Action-First Cleanup

Date: 2026-06-01

Status: `Implemented - focused QA passed`

## Goal

Apply the UX-04 simplification rule to the highest-frequency CRM work surfaces first:

> One page, one job, one next safe action.

This slice keeps existing backend-wired lead and account behavior, but changes what competes on the first screen.

## Agents Used

Five targeted agents reviewed the slice before implementation:

| Agent lane | Scope | Output used |
| --- | --- | --- |
| Leads UX | Lead workspace, intake, lead detail | Pipeline-first default, lighter cards/table, staged intake, Insights demotion. |
| Accounts UX | Customer list/detail and related account components | Follow-up queue default, summary metrics behind disclosure, Related detail grouping. |
| Shared UI | Workbench primitives and navigation | Reuse Workbench components and keep navigation stable. |
| Requirements | Meetings, PRDs, requirements maps | Keep lead/account boundary, source/stage/owner/SLA/next gate visible; keep account 360 detail reachable. |
| QA/risk | Scripts and e2e routes | Focused typecheck/lint/route coverage plus core flow and depth Playwright checks. |

## Changes Implemented

### Leads

- `/leads` now keeps `Pipeline` as the default daily work surface.
- Removed the visible `Overview` tab and its duplicate metric/action-card panel.
- Renamed report context from `Analytics` to `Insights`.
- Preserved `/leads/analytics` by mapping it to the new `Insights` tab.
- Renamed `More actions` to `More`.
- Moved day-to-day queue actions into the attention lane:
  - Initial contact overdue
  - CIS follow-up
  - Ready for first order
- Kept secondary/admin routes in `More`:
  - Latest intake
  - Insights
  - Bulk import
  - Website form setup
  - Workflow review
  - Finance queue when permissioned
  - Export report
- Simplified Kanban cards to company/contact, source, SLA/contact status, next action, contact shortcuts, and updated date.
- Reduced List view to five decision columns:
  - Company
  - Contact
  - Stage / next action
  - Owner / routing
  - Updated / SLA
- Staged New Intake:
  - Required identity/contact/service-tech fields stay visible first.
  - OCR moved to `Scan card or note`.
  - Required affinity/ownership routing stays grouped under `Routing details`.
  - Marketing source, lead rating, install tech count, and notes moved to `More intake details`.

### Accounts

- `/customers` now starts with an `Account follow-up queue`, not summary metrics.
- The queue ranks accounts needing:
  - risk review
  - territory assignment
  - contacts
  - locations
- Account summary metrics moved behind `Account summary` disclosure.
- Rebuilt the all-accounts directory with the shared `WorkbenchTable`.
- Reduced the directory to five columns:
  - Account
  - Owner / territory
  - Profile
  - Lifecycle
  - Updated
- Account detail keeps `Profile`, `Contacts`, and `Locations` as primary tabs.
- Renamed account detail `More` to `Related`.
- Moved `View Source Lead` into `Related`, so source lineage remains available without dominating the header.
- Simplified `Today's Account Focus` to:
  - Who to contact
  - Where they operate
  - Profile readiness

## Preserved Backend-Wired Behavior

- Lead fetch/search/filter/stage transition remains wired.
- Manual lead creation remains wired.
- OCR preview remains wired, but is progressively disclosed.
- Duplicate preview, create-anyway, and enrich-existing behavior remain wired.
- Website forms, bulk import, workflow queue, finance queue, and export remain reachable.
- Account list/detail fetch remains wired.
- Contacts, locations, activity/docs, payment methods, training, dealer portal, readiness, handoff, and source lead remain reachable.

## Verification

| Check | Result |
| --- | --- |
| `pnpm --filter @pulse/crm-web typecheck` | Passed |
| `pnpm --filter @pulse/crm-web lint` | Passed |
| `git diff --check` on touched files | Passed |
| `pnpm --filter @pulse/crm-web test:route-coverage` | Passed, 1/1 |
| `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.config.mjs --grep "internal workspace auth and core module routes stay backend-wired"` | Passed, 1/1 |
| `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.depth.config.mjs --grep "UX-03 detail hotspots keep secondary actions behind menus"` | Passed, 1/1 |

Note: one attempted `test:e2e` command used the wrong `pnpm` argument shape and Playwright reported `No tests found` after build/seed. The same target was rerun directly with the correct Playwright syntax and passed.

## Remaining UX-04 Slice A Follow-Up

- Lead detail can be tightened further: reduce visible badges, make the workflow next action the primary CTA, and move activity/source/routing evidence deeper.
- Account related surfaces can be tightened further: Dealer Portal diagnostics, payment provider fields, and activity/document boundaries should use stronger progressive disclosure.
- Contact and location modals should be staged in a later account-detail depth pass if UAT still feels dense.

## Next Recommended Slice

Move to UX-04 Slice B: Territory and Training one-queue-at-a-time cleanup.
