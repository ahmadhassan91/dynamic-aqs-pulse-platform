# QA Report: Dependency-Free UAT Readiness

Date: 2026-05-24

Latest update: 2026-05-25

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
- Added the next dependency-free UAT polish slice: account detail now has a day-one handoff checklist, dealer Account Center clarifies role boundaries and parked finance/ERP truth, Product Management and Digital Assets show UAT-safe source-of-truth boundaries, and mobile card/badge OCR clearly stops at reviewed preview until direct mobile lead commit rules are approved.
- Hardened dealer self-admin edge cases: backend now blocks dealer-admin attempts to deactivate another admin user, the dealer Account Center explains invite/revoke/Dynamic-managed boundaries in plain language, and per-user action labels distinguish self, primary owner, and admin governance blocks.
- Dealer Portal catalog and file-open now resolve managed-storage Digital Asset versions through the same public S3/CloudFront URL resolver used by Digital Assets share links. Approved visible files with no deliverable URL stay visible but show a clear unavailable state instead of a silent disabled control.

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
| `pnpm --filter @pulse/mobile test` after UAT polish slice | Passed, 19/19 |
| `pnpm --filter @pulse/mobile typecheck` after UAT polish slice | Passed |
| `pnpm --filter @pulse/mobile test` after mobile live-API status slice | Passed, 22/22 |
| `pnpm --filter @pulse/mobile build` after mobile live-API status slice | Passed, Expo web export completed |
| `pnpm --filter @pulse/mobile test` after mobile sync UAT guidance slice | Passed, 26/26 |
| `pnpm --filter @pulse/mobile typecheck && pnpm --filter @pulse/mobile build` after mobile sync UAT guidance slice | Passed; Expo web export completed |
| iOS simulator TM UAT against production API after dealer self-admin slice | Partial pass: Tammy TM login, home live CRM status, account list/detail, route check-in, and Sync Status evidence captured under `output/mobile-ios-uat-2026-05-24/`; gaps found in lead queue/list alignment and route checkout resume clarity. |
| `pnpm --filter @pulse/mobile test` after mobile proactive session-refresh hardening | Passed, 28/28 |
| `pnpm --filter @pulse/mobile typecheck && pnpm --filter @pulse/mobile build` after mobile proactive session-refresh hardening | Passed; Expo web export completed |
| iOS simulator TM UAT after mobile lead/route clarity fix | Passed targeted smoke: Lead Inbox now falls back to CRM workflow queue when raw lead assignment is empty, route restores the checked-in phone draft without requiring accounts refresh, checkout saves to CRM, and success uses a green `Visit saved` notice. Evidence: `08-lead-inbox-workflow-queue.jpg`, `09-route-draft-restored.jpg`, `10-route-visit-saved-success.jpg` under `output/mobile-ios-uat-2026-05-24/`. |
| `pnpm --filter @pulse/mobile test`, `typecheck`, and `build` after mobile lead/route clarity fix | Passed; 28/28 tests, TypeScript clean, Expo web export completed. |
| iOS simulator TM UAT after scoped lead/training/assets pass | Passed targeted TM cycle against the deployed production API: scoped workflow-queue lead appears for Tammy, lead detail opens without out-of-scope 404, scheduled training check-in completes, duplicate training completion is blocked, Asset Library loads dealer-visible assets for TM/RD roles, customer share link opens the iOS share sheet, Consignment shows the parked Acumatica boundary when no visible ROSE sites are seeded, Notifications show urgent lead work, and Sync Status shows a clean signed-in state. Evidence: `11-lead-inbox-scoped-lead.jpg` through `20-sync-status-clear.jpg` under `output/mobile-ios-uat-2026-05-24/`. |
| `pnpm --filter @pulse/mobile test && pnpm --filter @pulse/mobile typecheck && pnpm --filter @pulse/contracts build && pnpm --filter @pulse/api build && node --test --test-concurrency=1 apps/api/test/leads.workflow.regression.test.mjs` after scoped lead/assets fixes | Passed; 28/28 mobile tests, TypeScript clean, contracts/API builds clean, and lead workflow suite passed 17/17. |
| `pnpm --filter @pulse/crm-web lint` after UAT polish slice | Passed |
| `pnpm --filter @pulse/crm-web lint && pnpm --filter @pulse/crm-web typecheck && pnpm --filter @pulse/crm-web build` after account focus slice | Passed |
| `pnpm --filter @pulse/contracts build && pnpm --filter @pulse/api build && DATABASE_URL=... node --test --test-concurrency=1 apps/api/test/accounts.regression.test.mjs` after account activity/document slice | Passed, 11/11 |
| `pnpm --filter @pulse/crm-web lint && pnpm --filter @pulse/crm-web typecheck && pnpm --filter @pulse/crm-web build` after account activity/document slice | Passed |
| `pnpm --filter @pulse/crm-web lint && pnpm --filter @pulse/crm-web typecheck && pnpm --filter @pulse/crm-web build` after product/asset usability slice | Passed |
| `pnpm --filter @pulse/api build && DATABASE_URL=... node --test --test-concurrency=1 apps/api/test/dealer-portal.regression.test.mjs` after dealer self-admin edge-case hardening | Passed, 15/15 |
| `pnpm --filter @pulse/crm-web lint && pnpm --filter @pulse/crm-web typecheck && pnpm --filter @pulse/crm-web build` after dealer self-admin edge-case hardening | Passed |
| `DATABASE_URL=... pnpm --filter @pulse/crm-web test:e2e` | Passed, 11/11 |
| Production deploy smoke: `https://pulse-crm.theclustox.com/api/v1/health/ready` | Passed with app/database/queue/workers healthy; Acumatica reports the expected parked placeholder dependency |
| Production UAT seed: `node scripts/seed-uat-readiness.mjs` on EC2 | Passed; reseeded 4 dealer accounts, 4 catalog views, 2 products, 3 assets, internal TM/RD/admin personas, and dealer personas |
| Production Playwright UAT: `https://pulse-crm.theclustox.com` | Passed, 9/9 Dynamic-style flows: super admin leads, RD workspace coverage, TM workspace coverage, product management, digital assets, affinity catalog, ownership/PE catalog, independent catalog, hybrid review boundary, and dealer admin invite flow |
| Production Browser visual smoke: `@Browser` at `https://pulse-crm.theclustox.com/auth/login` | Passed visual/DOM login-page inspection. Browser form typing is blocked by the local virtual clipboard limitation, so production form-submission evidence comes from the Playwright pass above. |
| Browser plugin smoke | Login page loaded and DOM controls were inspectable; text entry was blocked by the Browser virtual clipboard, so the actual login/catalog interaction was covered by maintained Playwright/API gates instead. |
| Playwright CLI smoke | Dealer login page opened and snapshot captured with stable controls; the standalone CLI session did not persist for chained fill commands, so maintained Playwright e2e remains the authoritative browser automation evidence. |
| Browser plugin smoke | `@Browser` opened the local Pulse login page at `http://127.0.0.1:3101/auth/login` and confirmed the rendered login UI. Browser text-entry remains blocked by the local virtual clipboard limitation, so form-submission evidence still comes from maintained Playwright e2e. |
| Mobile UAT hardening | `pnpm --filter @pulse/mobile test` now covers 32 mobile policy tests for session lifecycle, mobile-only access, approved API host controls, route retry scheduling, training follow-up/proof truthfulness, sync review, live-API section status, Sync Status next-action guidance, display-safe asset cache metadata, and voice-note request/review policy. |
| Mobile typecheck/build | `pnpm --filter @pulse/mobile typecheck` and `pnpm --filter @pulse/mobile build` pass after the session/route/training/asset/voice-note changes. |
| Mobile voice-note API | `pnpm --filter @pulse/api build` and `node --test --test-concurrency=1 apps/api/test/mobile-voice-notes.regression.test.mjs` pass, covering transcript notes, audio-only notes, account context, reviewable structuring, and audit trail. |
| Field Activity Review loop | `node --test --test-concurrency=1 apps/api/test/mobile-voice-notes.review.regression.test.mjs` passes, covering review queue visibility, approve/writeback to account activity, reject-with-reason, Training follow-up creation, Consignment field work-item creation, audit evidence, and no target writeback on rejection. |
| Mobile voice-note live LLM smoke | Temporary OpenAI-backed smoke passed against the test database: provider `openai`, model `gpt-5.5`, status `structured`, account context preserved, summary/next-step/tags returned, and one `MOBILE_VOICE_NOTE` audit entry created. A follow-up provider-only smoke also passed after moving the adapter to Responses API Structured Outputs. |
| Dealer Portal managed asset delivery hardening | `pnpm --filter @pulse/contracts build`, `pnpm --filter @pulse/api build`, `node --test --test-concurrency=1 apps/api/test/dealer-portal.regression.test.mjs`, `pnpm --filter @pulse/crm-web lint`, `pnpm --filter @pulse/crm-web typecheck`, and `pnpm --filter @pulse/crm-web build` passed. Dealer catalog regressions now cover `storageKey`-only CloudFront URLs, missing delivery URLs, and delivery-source audit metadata. |

Note: an earlier parallel test attempt caused false database deadlocks and fixture truncation because several suites reset the same `pulse_platform_test` database at the same time. The valid QA signal is the sequential rerun above.

## Current Coverage Estimate

| Module | Dependency-free requirement coverage | Notes |
| --- | ---: | --- |
| Leads | 80% | Intake, website forms, duplicate review, routing, workflow queues, OCR preview, readiness, operational alerts, mobile workflow-queue visibility, and approved mobile field notes in lead activity are regression/UAT-covered. Mobile committed scan-to-lead remains a gap. |
| Accounts / Customers | 80% | Live customer list/detail, profile edit, contacts, locations, lifecycle, territory ownership, source-lead lineage, dealer portal access, payment-method boundary, Account Readiness, day-one handoff guidance, Today&apos;s Account Focus, stable tab deep links, CRM-owned Activity & Document Review, and approved mobile field notes in account activity are covered. Parent/child hierarchy, merge/import governance, ERP orders/invoices/shipments/pricing, and external document truth remain parked. |
| Territory | 72% | TM/RD scoping, coverage, transfer, dashboard, map/read models, and ownership propagation are covered. Route optimization remains parked. |
| Training | 79% | Training catalog, programs, sessions, check-in/out, proof metadata/upload backend, certification, exceptions, reporting, mobile follow-up/proof-failure truthfulness, and reviewed mobile voice-note follow-up task creation are covered. Named attendee/technician depth remains limited. |
| Consignment | 71% | Site master, document register, BLUE/ROSE flow, evidence upload, variance, queue, Acumatica boundary, and reviewed mobile voice-note field work items are covered. ERP warehouse/inventory/PO truth remains parked. |
| Product Management | 75% | Categories/families, catalog views, inclusions, rules, readiness, snapshots, parked product-import boundary, and a simpler Catalog Setup / Products / Who Sees It workflow guide are covered, with clearer UAT-safe Acumatica/data-source boundaries in the UI. Authoritative product creation/import waits for Acumatica/data signoff. |
| Digital Assets | 84% | Library, versions, managed storage adapter, Widen manifest preview/import traceability, collections, usage, share links, shared public URL resolution for Dealer Portal, mobile display-safe metadata cache, guided share readiness, and clearer UAT asset-flow guidance are covered. Real Widen migration strategy remains parked. |
| Dealer Portal | 81% full scope, 94% dependency-free slice | Login, dashboard, account center, catalog visibility, favorites, active-snapshot direct-access safety, assignment-level file visibility, managed S3/CloudFront-backed file delivery, missing-delivery unavailable states, asset-open audit with delivery-source metadata, internal preview, dealer admin invite/revoke/reactivate for non-admin company users, backend-enforced self/primary-owner/admin governance blocks, clearer self-admin/finance boundaries, and affinity/ownership/independent/hybrid persona boundaries are covered. Commerce, pricing, invoices, shipment tracking, payments, true impersonation, and hierarchy depth remain parked. |
| Mobile | 83% | Login shell, field home, leads/accounts, route, training, ROSE, assets, voice notes, notifications, sync review, approved-host API guardrails, live-API section status, and OCR preview exist. Recent passes added stored-session validation/refresh, mobile-scope gating, proactive session refresh before access-token expiry, checked-in route draft persistence, scoped workflow-queue lead visibility, lead detail without out-of-scope 404s, route draft restore without account-refresh dependency, route checkout success clarity, training check-in/complete proof on iOS, TM/RD digital-asset module access, stable asset-cache snapshots, a first-screen asset share panel, customer share links through the iOS share sheet, voice-note audio/text capture with account/training/consignment context, CRM sync, reviewable LLM structuring, audit trail, mobile-visible office review status, office-created Training follow-up status, office-created Consignment field work-item status, stricter training proof/follow-up messaging, metadata-only asset cache, clearer card/badge OCR review-only boundaries, field-home live CRM status for partial/unavailable API states, and a Sync Status next-action card that tells field users whether to retry, sign in, keep the app open, or ask the office to review. Android QA, true background sync, conflict merge, push/deep links, offline binary media/audio drafts, and seeded TM-visible consignment/ROSE work remain open. |
| Roles/Admin/Auth | 70% | Role catalog, admin user CRUD, login/session/recovery basics exist. MFA, lockout, production identity governance, and fine-grained entitlements remain parked. |

Overall dependency-free readiness: approximately 82%.

## UAT Blockers Dynamic AQS Could Still Hit

- Mobile business-card/badge capture is intentionally preview-and-review only; full scan-to-committed-lead needs retention, duplicate-review, and offline media signoff before activation.
- Mobile proof/photo/audio offline durability remains intentionally metadata-only or live-sync-only until encrypted media storage and retention policy are approved.
- Mobile native simulator depth now has a TM production-API pass for home, workflow-queue leads, lead detail, account context, route draft restore, CRM checkout save, training check-in/complete, Asset Library, customer share links, notifications, and Sync Status. Stored-session validation, proactive refresh, checked-in route-draft durability, approved production API host controls, live-API partial/unavailable dashboard status, manual-sync next-action guidance, voice-note CRM sync policy, office review status, and reviewer-created Training/Consignment follow-up actions now have implementation and unit/API coverage. Remaining mobile blockers are Android QA, true background sync/conflict merge, push/deep links, offline binary media/audio drafts, and a seeded TM-visible consignment/ROSE site for full ROSE audit proof without Acumatica.
- Product CSV/prototype data can be previewed/mapped, but final apply remains parked until Acumatica/product source-of-truth signoff.
- Consignment ERP execution remains parked: warehouse creation, inventory movement, transfers/receipts, PO creation, and financial settlement.
- Current EC2 deployment is internal-UAT grade, not production-grade.

## Verdict

Pulse CRM is now credible for controlled dependency-free UAT around the 70-75% target. It is not production-ready. The next useful work should deepen dependency-free UAT where the team will feel the most day-to-day value: customer/account workspace polish, dealer portal self-admin boundaries, product/asset usability cleanup, and mobile native/live-API QA while Acumatica and real product migration remain parked.
