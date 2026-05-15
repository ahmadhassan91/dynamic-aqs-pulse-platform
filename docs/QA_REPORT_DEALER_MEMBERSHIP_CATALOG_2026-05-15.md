# Dealer Membership Catalog QA Report - 2026-05-15

Validated deployed release `manual-20260515155035-membership-catalog-ux` at `https://pulse-crm.theclustox.com`.

## Requirement Sentiment

Dynamic AQS repeatedly emphasized keeping the workflow simple and preventing wrong catalog, file, logo, or price confidence. The safest mental model is account-first:

- Affinity group: buying/coaching/franchise membership label.
- Ownership / PE group: parent-owner or private-equity label.
- Independent: neither label applies.
- Dealer Catalog View: the final products/files/branding outcome.
- Price class: parked in Acumatica and must not control product/file visibility.

The UX should therefore show staff why a catalog was chosen, while hiding internal rule machinery from dealers.

## What Changed

- Staff customer portal preview now shows Dealer Classification and Catalog Decision.
- Dealer portal diagnostics now return catalog resolution and membership context.
- `Require Review` catalog rules now block default catalog fallback for ambiguous hybrid accounts.
- Dealer catalog now shows friendly `Your product catalog` language instead of raw internal catalog-view names.
- Account center dealer-facing wording now says `Dynamic AQS Account Team`, avoiding ownership/PE confusion.
- Product/catalog admin copy now explains labels as inputs and Dealer Catalog View as the outcome.
- Partial account membership updates preserve the opposite axis before recalculating classification.

## Browser E2E

Used Browser skill against deployed QA data:

- Pass: internal staff can open a QA Nexstar account, see Affinity/Ownership/Dealer type, and preview as dealer.
- Pass: QA Nexstar account resolves by rule to the QA Nexstar catalog.
- Pass: hybrid QA account shows review warning and zero visible products/files.
- Pass: dealer login sees only the assigned product/file catalog.
- Pass: dealer-facing catalog hides raw catalog-view name and keeps commerce/pricing parked.

Screenshots:

- [Staff membership preview](../output/playwright/membership-admin-preview.png)
- [Hybrid review preview](../output/playwright/membership-hybrid-review.png)
- [Dealer catalog](../output/playwright/membership-dealer-catalog.png)

## Playwright E2E

Automated Playwright pass: `10 passed, 0 failed`.

Result artifact:

- [Playwright result JSON](../output/playwright/membership-catalog-playwright-results.json)
- [Playwright staff preview](../output/playwright/playwright-admin-membership-preview.png)
- [Playwright hybrid review](../output/playwright/playwright-hybrid-review.png)
- [Playwright dealer catalog](../output/playwright/playwright-dealer-catalog.png)

## Backend Regression

- `pnpm --filter @pulse/api build`: pass
- `node --test --test-concurrency=1 apps/api/test/accounts.regression.test.mjs`: 10 pass
- `node --test --test-concurrency=1 apps/api/test/dealer-portal.regression.test.mjs`: 10 pass

Frontend:

- `pnpm --filter @pulse/crm-web lint`: pass
- `pnpm --filter @pulse/crm-web build`: pass

## Remaining Parked Items

- Acumatica pricing, inventory, orders, invoices, payments, and credit status remain parked until approved integration access and mapping are available.
- Final brand/private-label rule semantics still need business confirmation before hardening beyond catalog-view/product/asset scoping.
