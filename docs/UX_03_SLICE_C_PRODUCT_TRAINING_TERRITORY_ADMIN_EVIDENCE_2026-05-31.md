# UX-03 Slice C Product/Training/Territory/Admin Evidence

Date: 2026-05-31

Status: `Implemented - QA passed`

## Purpose

This pass continues the cross-module UI/UX optimization goal for the developed CRM pages. It reduces dense default surfaces without changing backend behavior, permissions, publish rules, territory assignment state, training decisions, or parked dependency boundaries.

The pass follows the UX-03 rule: one page should first answer what needs attention, what action is safe, and where the user drills in for evidence or setup.

## External UX Basis

- Progressive disclosure: show what matters now and reveal advanced information on demand.
  Source: https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/
- Enterprise process pages should show information and actions only when relevant to the current object stage or user task.
  Source: https://www.salesforceben.com/ultimate-guide-to-designing-salesforce-lightning-pages/
- Data tables should support row-level actions, selection, sorting, and predictable column behavior instead of scattering inline action buttons.
  Source: https://developer.salesforce.com/docs/platform/lightning-component-reference/guide/lightning-datatable.html
- Empty/message states should use the right component and tone for the situation, with banners reserved for critical system-level messages.
  Source: https://design-system-docs-proxy.services.atlassian.com/foundations/content/designing-messages/

## Landed Scope

### Product Management

- Reused one Catalog Setup header/helper across Categories, Families, and Admin setup views.
- Removed the duplicate Admin readiness table that repeated the real Product/Readiness working surface.
- Added a backend-wired `Preview Legacy Products` source preview table using `WorkbenchTable`.
- Kept legacy CSV/product import as preview-only because Acumatica product identity, item status, UOM, item class, pricing, and inventory mappings remain parked.
- Changed copy to say `Source preview only` so sampled rows are not mistaken for a production import apply step.

### Training

- Converted passive operational queues to shared tables:
  - Recertification queue
  - Coaching workload upcoming sessions
  - Overdue cadence queue
  - Training execution exceptions
- Preserved permission-gated training decision and revocation flows.
- Kept execution exception account navigation as a row action rather than another inline button.

### Territory

- Added admin-only `Edit territory` row action to the Territory Registry.
- Added passive `Open lead` and `Assignment history` row actions to Bulk Lead Transfer.
- Preserved row selection and bulk transfer controls so passive row actions do not mutate transfer state.

### Admin Catalog Rules

- Reframed rule preview as sampled/provenance evidence rather than full publish proof.
- Replaced the raw preview table with `Sample catalog rule account decisions`.
- Replaced `Products and Files Affected` with `Sampled Catalog View Impact`.
- Added explicit wording that sampled preview covers affinity, ownership/PE, independent status, region, and portal eligibility only.
- Kept pricing, order, inventory, brand/private-label matching, and Acumatica source-of-truth decisions parked until certified.

## Verification

Commands run from `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform`:

```bash
pnpm --filter @pulse/crm-web typecheck
node --check apps/crm-web/e2e/ux-depth.spec.mjs
pnpm --filter @pulse/crm-web exec playwright test -c e2e/playwright.depth.config.mjs
pnpm --filter @pulse/crm-web exec playwright test e2e/flows.spec.mjs --config e2e/playwright.config.mjs --grep "admin user management|navigation|internal workspace auth|RD and TM personas|dealer catalog personas"
```

Previously green commands retained for this Slice C continuation:

```bash
node --check apps/crm-web/e2e/route-coverage.spec.mjs
node --check apps/crm-web/e2e/ux-visual.spec.mjs
node --check apps/crm-web/e2e/flows.spec.mjs
pnpm --filter @pulse/crm-web run test:route-coverage
pnpm --filter @pulse/crm-web exec playwright test -c e2e/playwright.visual.config.mjs
```

Result:

- CRM web typecheck: passed
- UX depth Playwright: `3 passed`
- Targeted flow/persona smoke: `7 passed`
- Route coverage and visual UX gates: previously passed in this Slice C continuation and remain unchanged by this pass.

Note: the first depth rerun failed because the new assertion looked for `Territory registry` on `/territories?tab=admin`; that table belongs to `/territories?tab=list`. The test was corrected to match the approved tab model, then passed.

## Remaining Non-Dependent UX Work

Recommended next Slice C/D queue:

1. Lead detail and Account detail hotspots: reduce dense secondary panels and repeated activity/evidence actions.
2. Digital Assets delivery-health and detail density: keep share/upload first, move source trace/version details behind detail sections.
3. Product detail readiness/files/history: one readiness summary first, with files/content/visibility/history as focused drill-ins.
4. Territory table consolidation: decide whether Regional Rollups and Owner Coverage should become workload table groupings instead of separate panels.
5. Responsive/keyboard gate: add table row-action and More-menu focus checks across the cleaned modules.

