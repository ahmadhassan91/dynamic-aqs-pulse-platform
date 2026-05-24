# QA Report: Dependency-Free UAT Readiness

Date: 2026-05-24

## Scope

This QA cycle focused on what Dynamic AQS can test before Acumatica sandbox access and real migration data are available. The intent is to prove roughly 70-75% practical readiness for Pulse-owned workflows, while keeping ERP/data-source boundaries visible.

## Agent Findings Used

| Focus | Finding |
| --- | --- |
| Product/catalog/dealer portal | UAT seed needed published products, active catalog rules, active snapshots, and real dealer login users. |
| TM/RD/mobile | Mobile has useful field flows, but UAT credibility still depends on login/session validation, route-draft durability, proof-upload truthfulness, and offline/media boundaries. |
| Broad module QA | Existing regression coverage is strong, but UAT readiness needed a seed-specific gate and persona evidence. |
| Security/deployment | Current deployment is acceptable for controlled internal UAT, not production. Production still needs RDS/managed secrets/TLS hardening/lockout/MFA/monitoring/rollback. |

## Fixes Completed In This Cycle

- `scripts/seed-uat-readiness.mjs` now creates local-login internal personas, dealer login personas, active dealer portal memberships, active catalog rules, active catalog snapshots, published product presentations/inclusions, and one scheduled training session.
- Added `apps/api/test/uat-readiness.seed.regression.test.mjs`.
- Added `pnpm --filter @pulse/api test:uat-readiness`.
- Updated the UAT readiness plan with seeded credentials, proof scope, and the validation command.
- Updated the delivery tracker to reflect the stronger dependency-free UAT seed lane.
- Hardened dealer catalog runtime access so portal-eligible rules honor manually provisioned accounts, active catalog snapshots gate direct product/file access, assignment-level asset brand/region/group scopes are enforced, and hybrid/review dealer accounts receive a clear review-required message.
- Expanded maintained Playwright coverage to include Regional Director and Territory Manager workspaces plus affinity, ownership/PE, independent, and hybrid dealer catalog personas.
- Added a CRM-owned Account Readiness brief to account detail so Dynamic can quickly see profile, primary contact/location, territory ownership, dealer membership, source lineage, and parked ERP activity status without inventing Acumatica truth.
- Added dealer portal company-user self-admin for dealer admins: invite non-admin users, revoke/reactivate company users, block self-deactivation, block dealer-created admin users, and keep primary owner/admin governance with Dynamic AQS.

## QA Evidence

| Gate | Result |
| --- | --- |
| `node --check scripts/seed-uat-readiness.mjs` | Passed |
| `DATABASE_URL=... pnpm seed:uat` | Passed |
| `DATABASE_URL=... pnpm --filter @pulse/api test:uat-readiness` | Passed, 1/1 |
| `DATABASE_URL=... pnpm --filter @pulse/api test:product-management` | Passed, 17/17 |
| `DATABASE_URL=... pnpm --filter @pulse/api test:digital-assets` | Passed, 9/9 |
| `pnpm --filter @pulse/contracts build && pnpm --filter @pulse/api build && DATABASE_URL=... node --test --test-concurrency=1 apps/api/test/dealer-portal.regression.test.mjs` | Passed, 15/15 |
| `DATABASE_URL=... pnpm --filter @pulse/api test:leads` | Passed, 71/71 across lead suites |
| `pnpm --filter @pulse/contracts build && pnpm --filter @pulse/api build && DATABASE_URL=... node --test --test-concurrency=1 apps/api/test/accounts.regression.test.mjs` | Passed, 11/11 |
| `DATABASE_URL=... pnpm --filter @pulse/api test:territories` | Passed, 28/28 |
| `DATABASE_URL=... pnpm --filter @pulse/api test:training` | Passed, 21/21 |
| `DATABASE_URL=... pnpm --filter @pulse/api test:consignment` | Passed, 15/15 |
| `pnpm --filter @pulse/mobile test && pnpm --filter @pulse/mobile typecheck` | Passed, 6/6 plus typecheck |
| `DATABASE_URL=... pnpm --filter @pulse/crm-web test:e2e` | Passed, 11/11 |
| Production deploy smoke: `https://pulse-crm.theclustox.com/api/v1/health/ready` | Passed with app/database/queue/workers healthy; Acumatica reports the expected parked placeholder dependency |
| Production UAT seed: `node scripts/seed-uat-readiness.mjs` on EC2 | Passed; reseeded 4 dealer accounts, 4 catalog views, 2 products, 3 assets, internal TM/RD/admin personas, and dealer personas |
| Production Playwright UAT: `https://pulse-crm.theclustox.com` | Passed, 9/9 Dynamic-style flows: super admin leads, RD workspace coverage, TM workspace coverage, product management, digital assets, affinity catalog, ownership/PE catalog, independent catalog, hybrid review boundary, and dealer admin invite flow |
| Production Browser visual smoke: `@Browser` at `https://pulse-crm.theclustox.com/auth/login` | Passed visual/DOM login-page inspection. Browser form typing is blocked by the local virtual clipboard limitation, so production form-submission evidence comes from the Playwright pass above. |
| Browser plugin smoke | Login page loaded and DOM controls were inspectable; text entry was blocked by the Browser virtual clipboard, so the actual login/catalog interaction was covered by maintained Playwright/API gates instead. |
| Playwright CLI smoke | Dealer login page opened and snapshot captured with stable controls; the standalone CLI session did not persist for chained fill commands, so maintained Playwright e2e remains the authoritative browser automation evidence. |
| Browser plugin smoke | `@Browser` opened the local Pulse login page at `http://127.0.0.1:3101/auth/login` and confirmed the rendered login UI. Browser text-entry remains blocked by the local virtual clipboard limitation, so form-submission evidence still comes from maintained Playwright e2e. |
| Mobile UAT hardening | `pnpm --filter @pulse/mobile test` now covers 18 mobile policy tests for session lifecycle, mobile-only access, route retry scheduling, training follow-up/proof truthfulness, sync review, and display-safe asset cache metadata. |
| Mobile typecheck | `pnpm --filter @pulse/mobile typecheck` passes after the session/route/training/asset changes. |

Note: an earlier parallel test attempt caused false database deadlocks and fixture truncation because several suites reset the same `pulse_platform_test` database at the same time. The valid QA signal is the sequential rerun above.

## Current Coverage Estimate

| Module | Dependency-free requirement coverage | Notes |
| --- | ---: | --- |
| Leads | 78% | Intake, website forms, duplicate review, routing, workflow queues, OCR preview, readiness, and operational alerts are regression-covered. Mobile committed scan-to-lead remains a gap. |
| Accounts / Customers | 73% | Live customer list/detail, profile edit, contacts, locations, lifecycle, territory ownership, source-lead lineage, dealer portal access, payment-method boundary, and the new Account Readiness brief are covered. Parent/child hierarchy, merge/import governance, ERP orders/invoices/shipments/pricing, and richer activity/document tabs remain parked or later. |
| Territory | 72% | TM/RD scoping, coverage, transfer, dashboard, map/read models, and ownership propagation are covered. Route optimization remains parked. |
| Training | 77% | Training catalog, programs, sessions, check-in/out, proof metadata/upload backend, certification, exceptions, reporting, and mobile follow-up/proof-failure truthfulness are covered. Named attendee/technician depth remains limited. |
| Consignment | 68% | Site master, document register, BLUE/ROSE flow, evidence upload, variance, queue, and Acumatica boundary are covered. ERP warehouse/inventory/PO truth remains parked. |
| Product Management | 72% | Categories/families, catalog views, inclusions, rules, readiness, snapshots, and parked product-import boundary are covered. Authoritative product creation/import waits for Acumatica/data signoff. |
| Digital Assets | 81% | Library, versions, managed storage adapter, Widen manifest preview/import traceability, collections, usage, share links, and mobile display-safe metadata cache are covered. Real Widen migration strategy remains parked. |
| Dealer Portal | 78% full scope, 90% dependency-free slice | Login, dashboard, account center, catalog visibility, favorites, active-snapshot direct-access safety, assignment-level file visibility, asset-open audit, internal preview, dealer admin invite/revoke/reactivate for non-admin company users, and affinity/ownership/independent/hybrid persona boundaries are covered. Commerce, pricing, invoices, shipment tracking, payments, true impersonation, and hierarchy depth remain parked. |
| Mobile | 68% | Login shell, field home, leads/accounts, route, training, ROSE, assets, notifications, and sync review exist. This pass added stored-session validation/refresh, mobile-scope gating, checked-in route draft persistence, stricter training proof/follow-up messaging, and metadata-only asset cache. Native simulator/live API depth, background sync, Android QA, and offline binary media remain open. |
| Roles/Admin/Auth | 70% | Role catalog, admin user CRUD, login/session/recovery basics exist. MFA, lockout, production identity governance, and fine-grained entitlements remain parked. |

Overall dependency-free readiness: approximately 75%.

## UAT Blockers Dynamic AQS Could Still Hit

- Mobile business-card/badge capture is preview-heavy; full scan-to-committed-lead needs a later slice.
- Mobile proof/photo offline durability remains intentionally metadata-only until encrypted media storage is implemented.
- Mobile native simulator/live API depth still needs another pass, but stored-session validation and checked-in route-draft durability now have implementation and unit coverage.
- Product CSV/prototype data can be previewed/mapped, but final apply remains parked until Acumatica/product source-of-truth signoff.
- Consignment ERP execution remains parked: warehouse creation, inventory movement, transfers/receipts, PO creation, and financial settlement.
- Current EC2 deployment is internal-UAT grade, not production-grade.

## Verdict

Pulse CRM is now credible for controlled dependency-free UAT around the 70-75% target. It is not production-ready. The next useful work should deepen dependency-free UAT where the team will feel the most day-to-day value: customer/account workspace polish, dealer portal self-admin boundaries, product/asset usability cleanup, and mobile native/live-API QA while Acumatica and real product migration remain parked.
