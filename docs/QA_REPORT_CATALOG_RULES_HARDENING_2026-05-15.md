# QA Report: Catalog Rules Hardening

Date: 2026-05-15

## Scope

- Dealer Catalog Rules admin workflow
- Product-management catalog-rule options API
- Dealer Portal asset visibility guard
- Brand/private-label catalog-rule parking

## Result

Passed. The slice was deployed to `pulse-crm.theclustox.com` as `manual-20260515162600-catalog-rules-hardening`.

## Verification

- `pnpm --filter @pulse/contracts build` passed
- `pnpm --filter @pulse/api build` passed
- `node --test --test-concurrency=1 apps/api/test/product-management.assets.regression.test.mjs` passed, 16 tests
- `node --test --test-concurrency=1 apps/api/test/dealer-portal.regression.test.mjs` passed, 10 tests
- `pnpm --filter @pulse/crm-web lint` passed
- `pnpm --filter @pulse/crm-web build` passed
- Browser skill: opened the deployed CRM login and verified page structure with snapshot/screenshot
- Playwright: authenticated as SUPER_ADMIN, opened `/admin/catalog-rules`, verified governed reference-list copy, parked brand/private-label copy, no free-text value field, affinity/ownership dropdown labels, and the live `catalog-rule-options` endpoint shape

## Security Review

Codex Security diff scan completed with no reportable findings.

Report: `/tmp/codex-security-scans/dynamic-aqs-pulse-platform/7f51a52_20260515164127_catalog_rules_diff/report.md`

## Notes

- Brand/private-label rule conditions remain explicitly parked until Dynamic confirms the account-level matching source.
- Existing activation preview coverage beyond sampled accounts remains a separate product-hardening follow-up, not introduced by this slice.
