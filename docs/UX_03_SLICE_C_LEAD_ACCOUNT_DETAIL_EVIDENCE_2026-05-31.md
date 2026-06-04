# UX-03 Slice C Lead/Account Detail Evidence

Date: 2026-05-31

Status: `Implemented - QA passed`

## Purpose

This pass continues the cross-module clarity goal on the next high-friction detail routes. It reduces duplicated shortcuts and row-level action clutter on Lead and Account detail pages without changing backend behavior, permissions, duplicate-review rules, lifecycle persistence, payment-method persistence, or dealer portal provisioning.

## Agent Findings Used

Five targeted scouts reviewed Lead Detail, Account Detail, Digital Assets, Product Detail, and QA/docs.

| Lane | Finding | This pass |
| --- | --- | --- |
| Lead Detail | The `Secondary Actions` card duplicated existing tabs and workflow CTA. | Removed the card and moved Discovery, CIS, Onboarding, Finance, and Edit into header `More`. |
| Account Detail | Lifecycle state buttons and source-lead link duplicated page-level actions. | Removed duplicate source-lead link from the profile body and moved lifecycle actions into `Lifecycle actions`. |
| Account row actions | Payment-method and dealer-portal user rows used multiple inline buttons. | Converted payment-method and portal-user row actions to `RowActionMenu`. |
| Digital Assets | Header CTA and detail rail still need tab-aware/drawer cleanup. | Deferred to next slice because it affects upload/share/version/source-trace discoverability. |
| Product Detail | Files and catalog visibility tables need `WorkbenchTable` and readiness-first summary. | Deferred to next slice because unlink/attach/catalog-inclusion behavior needs a dedicated product-detail pass. |

## Landed Scope

### Lead Detail

- Removed the `Secondary Actions` overview card.
- Kept the real next-safe workflow CTA visible in `Next Best Action`.
- Moved navigation-only shortcuts into the header `More` menu:
  - Discovery workspace
  - CIS workspace
  - Onboarding readiness
  - Finance queue, permission-gated
  - Edit lead details, permission-gated
- Preserved live handlers for initial contact, discovery scheduling/completion, CIS navigation, onboarding navigation, finance queue navigation, lifecycle updates, and edit-save behavior.

### Account Detail

- Removed the duplicate `View Source Lead` button from the Account Lifecycle card; the header link remains the single source-lead shortcut.
- Replaced the visible lifecycle button cluster with a `Lifecycle actions` More menu.
- Preserved account lifecycle modal validation, including required notes when confirming churn.
- Converted payment-method row actions to `RowActionMenu`, preserving make-default/deactivate/reactivate handlers and disabled state during updates.
- Converted dealer-portal user row actions to `RowActionMenu`, preserving activate/suspend/deactivate/reset-password/invite-link handlers.

## Verification

Commands run from `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform`:

```bash
node --check apps/crm-web/e2e/flows.spec.mjs
node --check apps/crm-web/e2e/ux-depth.spec.mjs
pnpm --filter @pulse/crm-web typecheck
pnpm --filter @pulse/crm-web exec playwright test -c e2e/playwright.depth.config.mjs
pnpm --filter @pulse/crm-web exec playwright test e2e/flows.spec.mjs --config e2e/playwright.config.mjs --grep "super admin can edit a lead record|internal workspace auth"
```

Result:

- Syntax checks: passed
- CRM web typecheck: passed
- UX depth suite: `4 passed`
- Targeted flow smoke: `2 passed`

The first flow rerun exposed duplicate-review behavior in the seeded lead intake test. The test now follows the governed operator path: when Pulse flags a possible duplicate, it records a separate-lead reason and uses `Create Lead Anyway`.

## Remaining Non-Dependent Work

1. Digital Assets: make the header CTA tab-aware and collapse share/version/source-trace detail sections without hiding upload/share handlers.
2. Product Detail: convert files and visibility tables to `WorkbenchTable`, move unlink/edit into row menus, and make readiness the first summary.
3. Account Detail follow-up: payment-method and dealer-portal row menus are now in place, but payment-method detail density can still be tightened if finance asks for it.
4. UX gate follow-up: promote account/product detail routes from waivers to visual-budget enforcement after their dedicated detail cleanup passes.

