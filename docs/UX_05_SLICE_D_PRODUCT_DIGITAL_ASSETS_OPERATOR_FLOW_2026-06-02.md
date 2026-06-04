# UX-05 Slice D - Product And Digital Assets Operator Flow

Date: 2026-06-02

Status: `Implemented - QA passed`

## Purpose

Product Management and Digital Assets were structurally correct, but still exposed too many setup, governance, storage, and migration concepts on the default surface. This slice keeps the business flow simple:

1. Product team fixes catalog readiness gaps.
2. Product team chooses the Dealer Catalog View that should see the catalog.
3. Marketing/product users find approved files and create revocable customer links.
4. Setup, migration, versions, product usage, and source trace stay reachable behind More, detail rails, or advanced sections.

## Implemented

| Area | Change |
| --- | --- |
| Product Dealer Catalog Views | Create/edit moved from a flat form to a 3-step wizard: `Who is this for? -> What should they see? -> Review before publish`. |
| Product visibility explanation | Added `How catalog visibility works` playbook with the plain-language rule: affinity and ownership/PE are separate axes, independent is an outcome, region/brand scope changes catalog presentation, and price class stays separate. |
| Product publish flow | Row and header actions now put `Review before publish` before `Publish`; create/edit/publish actions are hidden unless the role has the matching backend action. |
| Product detail rail | Removed the redundant Dealer Catalog View column inside a rail already scoped to one view and changed `missing rules` wording to `missing visibility`. |
| Digital Assets default | Default library now starts with `Find and share approved files`; it shows approved, current-file, dealer/public assets first. `Show all files` is available for cleanup and internal assets. |
| Digital Assets primary action | Header primary action is `Copy customer link` when an active share exists, otherwise `Create share link`; upload is no longer the default primary action. |
| Digital Assets governance depth | Delivery health, metrics, and publishing queue moved into collapsed `Library health`; Widen migration and delivery health are reachable through More instead of visible tabs. |
| Digital Assets share safety | Share creation/copy uses revocable share links, not raw file URLs. Pending/rejected assets show an approval warning before external sharing. |
| Bulk upload | Upload is a modal with a dashed drag/drop zone, detected file review, defaults, and final upload step. It remains a per-file persisted upload loop, not an atomic migration job. |

## Requirement Trace

| Requirement | Covered By |
| --- | --- |
| PM-002 product/category/family separation | Categories/families remain in Catalog Placement setup; default Product Catalog remains readiness and Dealer Catalog View oriented. |
| PM-006/PM-007 catalog visibility | Dealer Catalog View table and wizard keep who-sees-what explicit without mixing price class or product identity. |
| PM-008/PM-009 publish readiness | Review-before-publish remains the visible publish path and backed by snapshot compare/publish APIs. |
| PM-010/PM-011 dealer portal catalog preparation | Dealer Catalog Views continue to publish approved product/file context for portal consumption. |
| DA-001/DA-002 asset library and stable file records | Digital Assets default is still the library, now filtered toward approved share-ready files. |
| DA-007/DA-009 share links and auditability | Customer/prospect sharing uses revocable share-link records and copy behavior. |
| DA-010/DA-011 product asset usage and visibility | Product usage, versions, and catalog scope remain visible in asset detail/advanced sections. |
| DA-013/DA-014 bounded Widen replacement | Widen migration remains an advanced review path; source trace stays preserved without becoming daily UI clutter. |

## Parked Boundaries

- Acumatica SKU/product truth, item class, UOM, item status, inventory, pricing, warehouse, cost, and financial fields remain parked.
- Final prototype CSV or Shopify-style product import/apply remains parked until source-of-truth mappings are signed off.
- Price class sync/display logic remains separate from Dealer Catalog View visibility.
- Widen redirect cutover, curated Widen migration execution, and full enterprise DAM behavior remain parked.
- Bulk upload is not presented as rollback-capable batch migration; it creates assets and versions one file at a time through existing APIs.

## QA Evidence

Passed focused gates:

- `node --check apps/crm-web/e2e/ux-depth.spec.mjs apps/crm-web/e2e/ux-clutter.spec.mjs apps/crm-web/e2e/ux-visual.spec.mjs apps/crm-web/e2e/route-coverage.spec.mjs`
- `pnpm --filter @pulse/crm-web typecheck`
- `pnpm --filter @pulse/crm-web test:route-coverage`
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.depth.config.mjs -g "UX-03 slice D role-first queues"`
- `pnpm --dir apps/crm-web exec playwright test -c e2e/playwright.visual.config.mjs -g "capture CRM and dealer default UX budgets"`
- `pnpm --filter @pulse/crm-web test:ux-clutter:quick`
- `git diff --check`

## Next Slice

Move to UX-05 Slice E: Training and Consignment one-queue pass.
