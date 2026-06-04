# UX-03 Slice C Digital Assets and Product Detail Evidence

Date: 2026-05-31

Status: `Implemented - Digital Assets/Product Detail cleanup QA passed`

## Scope

This slice continues the cross-module clarity goal by removing second-click clutter from Digital Assets and Product Detail without changing backend behavior or parked dependency boundaries.

## Changes

| Surface | Before | After |
| --- | --- | --- |
| Digital Assets header | Primary CTA was always `Upload Files`, even on Share Sets, Needs Attention, and Advanced Import. | Primary CTA is tab-aware: `Upload Files`, `Create Share Set`, `Review Items`, or `Preview Import`. Secondary actions stay in `More`. |
| Digital Assets delivery health | `Review asset` loaded detail data while the visible detail rail stayed hidden on the Library tab. | Delivery-health rows and `Review Items` switch to Library and open the visible asset detail rail. |
| Digital Assets Share Sets | Create/select/manage actions repeated between page header and local panel. | Header owns create action; row menus own edit/manage membership actions; local panel only sends users back to Library to select files. |
| Digital Assets advanced import | Local action cluster repeated the page CTA. | `Preview Import` lives in the header for the Advanced Import tab; previous-run loading lives in `More`. |
| Digital Asset detail | Passive product usage table was always open inside an already dense detail rail. | `Product usage` is collapsed in a `WorkbenchAdvancedSection`; share-link, file-detail, and attach-file actions remain visible because they are backend-wired work. |
| Product Detail files | Header `More` had a global unlink action driven by hidden row selection. | `Product Files` rows own their own `Unlink file` action menu; no hidden selected-row state. |
| Product Detail visibility | Region and brand split across columns, and title used `What Dealers See`. | Section is now `Dealer Visibility`; scope is one combined column, preserving `Dealer Catalog View` terminology. |
| Product Detail publish state | Separate `Last Publish State` card repeated readiness/status information already shown in header, metrics, and readiness summary. | Duplicate publish-state card removed. |

## Guardrails

- No upload, share-link, version, product-asset assignment, product inclusion, readiness validation, or save handler payload was removed.
- Widen migration remains review/preview-only until the migration plan is approved.
- Product CSV/Acumatica source-of-truth work remains parked.
- Product Detail still uses Mantine tables for files/readiness/visibility in this slice; the cleanup focused on action placement, labels, and duplicate-card removal.

## QA

Commands run:

```bash
pnpm --filter @pulse/crm-web typecheck
node --check apps/crm-web/e2e/ux-depth.spec.mjs && node --check apps/crm-web/e2e/ux-visual.spec.mjs && node --check apps/crm-web/e2e/flows.spec.mjs && node --check apps/crm-web/e2e/route-coverage.spec.mjs
pnpm --filter @pulse/crm-web exec playwright test -c e2e/playwright.depth.config.mjs --grep "UX-03 product and asset detail surfaces"
pnpm --filter @pulse/crm-web exec playwright test -c e2e/playwright.depth.config.mjs
pnpm --filter @pulse/crm-web exec playwright test -c e2e/playwright.visual.config.mjs
pnpm --filter @pulse/crm-web run test:route-coverage
```

Results:

- CRM web typecheck passed.
- E2E syntax checks passed.
- Targeted Playwright depth test passed: Product detail no longer exposes `Selection`/`Last Publish State`, product file unlink is row-action based, Digital Asset review action is visible, and delivery review opens the Library detail rail when seeded rows exist.
- Full Playwright depth suite passed 5/5.
- Visual UX budget passed 1/1, including Digital Assets Library and Share Sets budget-enforced captures.
- Route coverage passed 1/1; no new untracked route or tab-surface gap was introduced.

## Remaining Non-Dependent Tail

| Tail item | Why it remains |
| --- | --- |
| Product Detail full visual-budget graduation | Product detail is improved but still has raw Mantine tables and a separate readiness checklist; keep route waiver until one more consolidation pass or accept a measured budget waiver. |
| Territory workload table consolidation | The main territory dashboard is lighter, but workload/rollup tables still carry too many columns for repeated TM/RD use. |
| Role-first queue consolidation | Training, Territory, Consignment, and Admin still need persona-specific work queues so Dynamic users do not start from setup/report surfaces. |
