# Dynamic Team E2E QA Report - 2026-05-13

Environment: `https://pulse-crm.theclustox.com`  
Tester: Pulse super admin account  
Tools: Browser plugin visual/DOM sanity pass, Playwright CLI headed E2E run  
Evidence: `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/output/playwright/pulse-e2e-2026-05-13`

## Summary

The deployed CRM is reachable, authenticated admin login works, and the core shell/module navigation is stable. The strongest confirmed flows are login, lead intake, duplicate detection, lead support workspaces, territory dashboard/map, and admin/catalog-rules access.

Final Playwright run: **9 flows tested, 4 pass, 1 warn, 4 fail/blockers**.

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

1. **Digital asset sharing is not complete enough for the discovery requirement.**  
   The requirement was that Dynamic can share asset links with prospects/customers. The tested flow can create a link asset and shows `Open Current Link` / `Copy Current Link`, but the expected tracked share modal or recipient workflow was not reachable from the selected asset. This should be fixed before calling asset management 100%.

2. **Several forms are visually labeled but not reliably accessible by label.**  
   Product catalog `Code`, consignment `Account`, and some training tab content were visible, but Playwright could not reliably target them through semantic labels/text because hidden duplicate labels or non-associated labels exist in the DOM. This will hurt automated regression QA and may hurt screen-reader usability.

3. **Lead intake works, but required dealer-group fields are easy to miss.**  
   Manual lead creation required affinity/ownership status. The form only revealed this after submit. Given Dynamic’s repeated “keep it simple” feedback, those required routing fields should be grouped higher or clearly marked as “Routing required”.

4. **Training page loads, but tab semantics need cleanup.**  
   The training module itself rendered the expected certification/exception surfaces. The blocker was hidden duplicated `Certification` text winning the locator. This is likely a DOM/accessibility issue more than a business-flow failure.

5. **Consignment remains partially blocked by data/dependency shape.**  
   The modal is present and correctly parks Acumatica warehouse creation with a manual reference. The account selector could not be selected semantically in the E2E run, and seeded selectable accounts should be added for stable QA.

## Recommended Next Fix Slice

1. Digital assets: add a clear `Share` button on selected asset detail that opens the recipient/share-link modal, records recipient/name/email, and shows active shares in the detail panel.
2. Add `data-testid` and proper `htmlFor` / `aria-labelledby` contracts to the product, training, consignment, and asset forms.
3. Lead intake: move Affinity/Ownership group status into a clearly labeled `Routing` section near the top, with required markers before submit.
4. Seed QA data for product catalog, training, and consignment so E2E can validate create/edit flows without waiting for Acumatica.
5. Add this Playwright flow to the repo as a reusable QA runner once the selectors are stable.
