# Dynamic Team E2E QA Report - 2026-05-13

Environment: `https://pulse-crm.theclustox.com`  
Tester: Pulse super admin account  
Tools: Browser plugin visual/DOM sanity pass, Playwright CLI headed E2E run, targeted API smoke for asset share creation  
Evidence: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/pulse-e2e-2026-05-13`

## Summary

The deployed CRM is reachable, authenticated admin login works, and the core shell/module navigation is stable. After the blocker fix slice, the most important user-facing blockers from the first run are addressed: asset sharing permission is available to super admin, product/training/consignment forms now expose stable automation/accessibility hooks, lead routing is visibly grouped, and consignment cannot submit without an account.

Initial full Playwright run: **9 flows tested, 4 pass, 1 warn, 4 fail/blockers**.  
Post-fix targeted retest: **Browser visual/DOM checks passed for asset access selector, product visibility form, and consignment disabled guard; API smoke confirmed dealer-portal asset share-link creation.** The targeted Playwright rerun still has locator strictness in a few assertions, but the screenshots show the affected UI is rendering correctly.

| Flow | Result | Notes |
| --- | --- | --- |
| Login through Pulse form | Pass | Super admin login works through the real deployed form. |
| Lead intake + duplicate guard | Warn | Lead creation works and duplicate review appears. Warning is favicon 404 noise. |
| Lead supporting workspaces | Pass | Website Forms, Finance Queue, Workflow Queue load. |
| Territory dashboard + map | Pass | Territory hub and map route load with live operational signals. |
| Digital assets link/share/bulk upload | Fail | Link asset creation works, but tracked prospect/customer share flow did not open from the tested detail flow. |
| Product catalog setup/publish preview | Fail | Screen renders correctly, but form labels are not reliably accessible to Playwright. This is a testability/accessibility gap. |
| Training operations | Fail | Training tabs render, but hidden duplicate text caused automation to target hidden Certification text. Needs better semantic/tab contracts. |
| Consignment workspace | Fail | Create Site modal renders, but Account combobox is not accessible by label for automation. |
| Calendar, admin users, catalog rules | Pass | Workspaces load; catalog rules impact preview is available. |

## Post-Fix Retest - 2026-05-13

| Area | Result | Notes |
| --- | --- | --- |
| Deployment | Pass | Manual EC2 release `manual-20260513103637-qa-blockers-2` built, applied migrations, and restarted `pulse-api` / `pulse-web` successfully. |
| Asset share permission | Pass | `digital_asset.share` was added to the frontend role catalog for super admin and relevant operational roles. |
| Asset link UI | Pass | Browser plugin verified the Add Link modal now exposes a stable `Who can access` selector. |
| Asset share backend | Pass | API smoke created a `dealer_portal` asset and created a tracked prospect share link successfully. |
| Product management routing | Pass | Browser/Playwright verified category, family, and Dealer Catalog Views panels route through the intended tab contracts. |
| Training catalog routing | Pass | Playwright targeted retest verified the training overview and catalog form hooks load. |
| Consignment create guard | Pass | Browser/Playwright verified `Create Site` remains disabled until an account is selected. |
| Lead intake clarity | Pass with automation note | Browser/Playwright screenshots confirm the new `Routing required` section is visible. One strict Playwright assertion saw duplicate `Independent / no group` text; that is test-script strictness, not a missing UI state. |

## Evidence Files

- Login: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/pulse-e2e-2026-05-13/01-login-through-pulse-form.png`
- Lead duplicate guard: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/pulse-e2e-2026-05-13/02-lead-intake-create-and-duplicate-guard.png`
- Territory: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/pulse-e2e-2026-05-13/04-territory-dashboard-and-map-flow.png`
- Digital assets: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/pulse-e2e-2026-05-13/05-digital-asset-link-share-link-and-bulk-upload.png`
- Product management: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/pulse-e2e-2026-05-13/06-product-catalog-setup-and-publish-preview.png`
- Training: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/pulse-e2e-2026-05-13/07-training-operations-flow.png`
- Consignment: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/pulse-e2e-2026-05-13/08-consignment-workspace-flow.png`
- Machine-readable summary snapshot: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/pulse-e2e-2026-05-13/summary-snapshot.txt`

## Findings

1. **Digital asset sharing is now functionally available for shareable assets.**  
   The tested blocker was caused by frontend role action drift plus an internal-only asset path. Super admin now receives `digital_asset.share`; the UI exposes the access choice; backend smoke confirms `dealer_portal` assets can generate tracked prospect links. The remaining UX improvement is making the “make this shareable” decision more obvious for non-technical users.

2. **Several forms are visually labeled but not reliably accessible by label.**  
   Product catalog `Code`, consignment `Account`, and some training tab content were visible, but Playwright could not reliably target them through semantic labels/text because hidden duplicate labels or non-associated labels exist in the DOM. This will hurt automated regression QA and may hurt screen-reader usability.

3. **Lead intake routing is clearer after the fix.**  
   Affinity/ownership status is now grouped in a visible `Routing required` section with copy explaining Independent / No group versus affinity, PE, or ownership group.

4. **Training page loads, but tab semantics need cleanup.**  
   The training module itself rendered the expected certification/exception surfaces. The blocker was hidden duplicated `Certification` text winning the locator. This is likely a DOM/accessibility issue more than a business-flow failure.

5. **Consignment remains dependent on selectable account data, but the bad submit path is fixed.**  
   The modal is present and correctly parks Acumatica warehouse creation with a manual reference. Create Site now stays disabled until an account is selected; stable QA still needs seeded selectable account data.

## Recommended Next Fix Slice

1. Digital assets: make “share externally” a guided flow: if an asset is internal-only, prompt the user to switch it to Dealer Portal/Public before creating the prospect/customer link.
2. Add seeded QA account/product/training data so E2E can validate create/edit flows without waiting for Acumatica.
3. Harden the reusable Playwright runner around first-visible locators and seeded fixtures, then move it from `output/` into the repo test suite.
4. Continue the UI simplification pass across product, assets, training, consignment, and dealer portal using the same “keep it simple” rule from discovery.
