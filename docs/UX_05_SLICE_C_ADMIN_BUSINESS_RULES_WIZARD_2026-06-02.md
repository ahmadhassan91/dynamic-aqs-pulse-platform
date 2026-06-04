# UX-05 Slice C - Admin Business Rules Wizard

Date: 2026-06-02

Status: `Implemented - QA passed`

## Purpose

Admin Business Rules was still exposing rule authoring, templates, diagnostics, preview tables, impacted products/files, version history, parked dependency notes, and publish controls at the same time. That gave super admins flexibility, but it made the page feel like a rule engine instead of a safe setup flow.

This slice converts the page into a staged wizard:

1. `Draft` - build the rule set.
2. `Preview` - check sampled account decisions and affected products/files.
3. `Publish` - activate only after preview is clean.

## Agent Findings Applied

Five focused agents reviewed the route before implementation:

| Lane | Applied Decision |
| --- | --- |
| UX audit | Removed duplicate parked dependency messaging and stopped rendering preview/publish diagnostics on first load. |
| Backend/API guardrails | Preview may use inline draft rules, but publish requires a saved rule set and activates persisted server rules only. |
| QA impact | Updated depth, clutter, visual, and route-coverage expectations so this route is no longer waived. |
| Docs/tracker | Slice C is now documented under UX-05 and the tracker will move Slice D next. |
| Copy/accessibility | Renamed the page to `Dealer Catalog Rules`, added plain-language policy copy, and added stable test IDs/ARIA labels for wizard controls. |

## Implementation

| Area | Change |
| --- | --- |
| Page title | `Business Rules` became `Dealer Catalog Rules` to match the product/dealer-catalog concept Dynamic has been discussing. |
| Default view | The first screen now shows `Draft Rule Set` only. Preview tables, impacted product/file tables, publish blockers, version history, and parked dependency detail are hidden until the user opens the relevant step/detail. |
| Draft step | Rule set name, notes, optional templates, rule cards, condition field/operator/value, Dealer Catalog View result, review result, and priority. |
| Preview step | `Preview Account Decisions` runs sampled account resolution and shows account decisions. Affected products/files are under a detail disclosure after preview. |
| Publish step | Publish button is disabled unless the rule set is saved, preview is current, sampled accounts have no unmatched accounts, and sampled accounts do not require review. |
| Safety rails | Duplicate rule priorities are blocked before save because predictable ordering matters for catalog resolution. |
| Active rules | Review rules now reload as `Require review` instead of showing a blank Dealer Catalog View result. |

## Parked Boundaries

The wizard intentionally does not add pricing, ordering, inventory, invoice, shipment, or Acumatica source-of-truth behavior. It also keeps brand/private-label account matching parked until Dynamic confirms the account-level matching source. Dealer Catalog Views can still control product/file/branding/portal visibility, but price class remains separate.

## Requirement Trace

| Requirement | Status |
| --- | --- |
| Keep rule setup flexible for affinity, ownership/PE, independent, region, and portal eligibility | `Done` |
| Keep setup simple enough for super admins to navigate safely | `Done` |
| Preview account decisions before publishing | `Done` |
| Publish only after a clean preview | `Done` |
| Keep Acumatica/pricing/inventory/order dependencies parked | `Done` |
| Audit/version history available without cluttering default view | `Done` |
| Compound multi-condition editor for hybrid rules | `Parked` - current API supports compound rules, but this UI still edits one primary condition per rule. Existing compound rules can remain server-side, and a fuller compound-condition editor should be added only after Dynamic confirms rule complexity. |

## QA Result

- `node --check apps/crm-web/e2e/ux-depth.spec.mjs apps/crm-web/e2e/ux-clutter.spec.mjs apps/crm-web/e2e/ux-visual.spec.mjs apps/crm-web/e2e/route-coverage.spec.mjs` - passed.
- `pnpm --filter @pulse/crm-web typecheck` - passed.
- `pnpm --filter @pulse/crm-web test:route-coverage` - passed, 1/1.
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.depth.config.mjs -g "UX-03 slice C advanced tables"` - passed, 1/1.
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.visual.config.mjs -g "capture CRM and dealer default UX budgets"` - passed, 1/1 after replacing the clickable Stepper with a passive progress strip.
- `pnpm --filter @pulse/crm-web test:ux-clutter:quick` - passed, 2/2 after full production build and test-data seed.
- `git diff --check` - passed.

## Notes From QA

- The first visual run correctly failed because Mantine `Stepper` exposed `Draft`, `Preview`, and `Publish` as visible secondary buttons. The wizard now uses a passive progress strip, and users move forward through `Save and continue`, `Preview Account Decisions`, and `Continue to Publish`.
- `/admin/catalog-rules` is no longer waived in route coverage or visual budget checks.
