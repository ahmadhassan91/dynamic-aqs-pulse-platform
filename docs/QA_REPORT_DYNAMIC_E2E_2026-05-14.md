# Dynamic Team QA Cycle - 2026-05-14

## Scope

One more Dynamic-team usage cycle was run against `https://pulse-crm.theclustox.com` after reviewing PRDs, meeting artifacts, and the current code for the modules built so far: Leads, Territory, Training, Consignment, Product Management, Digital Assets/Widen replacement, Dealer Portal touchpoints, Calendar/Admin/Accounts context.

Five targeted agents reviewed requirements and usability. Browser and Playwright then exercised the deployed system with fresh QA test data.

## Fixes Made In This Cycle

- Product reference import is now preview-only until Acumatica field mappings and Dynamic catalog rules are signed off. Non-dry-run commit rejects before touching source files.
- Product import preview no longer 400s on EC2 when local Meeting CSV files are absent; it returns parked-dependency warnings instead.
- Dealer catalog snapshot publish now blocks empty catalogs and products without dealer-safe approved files.
- Digital Assets sharing now guides the user to make an asset shareable first when it is internal-only, instead of leaving the share action confusing.
- Product category setup now hides Type/Region/Sort under "Advanced category options" and renames the fields to business language.
- Removed visible prototype/backend wording from lead, territory, training, and consignment user-facing copy.
- Training certification copy now asks for "Expiration date" instead of an ISO timestamp.

## Browser / Playwright Results

Browser final smoke: **6/6 passed**

- Leads
- Territories
- Training
- Consignment
- Product setup
- Digital Assets

Playwright Dynamic flow: **13/13 passed**

- API login
- Generated manual lead test data
- Generated product category, family, and dealer catalog view
- Verified product import commit guard
- Generated digital asset, file version, and prospect share link
- Generated training category
- UI login
- Leads route
- Territory route
- Training route
- Consignment route
- Product management route
- Digital assets route

Artifacts:

- `output/playwright/pulse-e2e-2026-05-14/dynamic-team-cycle.mjs`
- `output/playwright/pulse-e2e-2026-05-14/dynamic-team-cycle-results.json`

Latest deployed release:

- `manual-20260514183037-dynamic-qa-final`

## Verification

- `pnpm --filter @pulse/api build` - passed
- `pnpm --filter @pulse/crm-web typecheck` - passed
- `node --test --test-concurrency=1 apps/api/test/product-management.assets.regression.test.mjs` - 15/15 passed
- Product + digital asset targeted regression earlier in the cycle - 24/24 passed
- Broad API suite reached CIS and then failed on an existing duplicate-fixture issue in `apps/api/test/cis.regression.test.mjs`; not caused by this slice.
- `pnpm --filter @pulse/crm-web lint` remains blocked by missing local package `eslint-module-utils/resolve`.

## Remaining Gaps

- Acumatica-owned product import/apply, SKU truth, inventory/pricing, consignment warehouse/transfer/receipt, and financial posting remain parked until sandbox access, sample records, certified endpoints, and signed mappings are available.
- Product catalog rule precedence across affinity, ownership/PE, independent, region, brand, and account overrides still needs Dynamic final approval.
- Training still needs richer participant/technician rows and deeper offline/mobile execution later.
- Territory saved route planning can be improved using the current derived stops before any optimizer integration.
- Consignment PURPLE/SAND and Samantha-style reporting exports are still useful next build-now slices.
- Admin/roles still need future field masking, per-user overrides, and temporary elevation stories.
