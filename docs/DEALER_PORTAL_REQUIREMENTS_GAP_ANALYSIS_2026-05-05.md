# Dealer Portal Requirements Gap Analysis

**Date:** 2026-05-05  
**Scope:** Dealer Portal replacement for Shopify, based on discovery meetings, PRDs, traceability registers, and current Pulse code.

## Source Artifacts Reviewed

- `Meetings/02 March session 7 Discovery - Delaer Portal.md`
- `Meetings/13th March Discovery Session 9.md`
- `Meetings/17th March  session 10-To-Be consognment and App.md`
- `Meetings/Discovery Session _11 To-Be Dealer Portal, Product Management.md`
- `Meetings/24th March - Session 12 - Reporting and Widen .md`
- `docs/DEALER_PORTAL_ARCHITECTURE_DIRECTION_2026-04-14.md`
- `docs/DEALER_PORTAL_BRANDED_SHELL_IMPLEMENTATION_2026-04-14.md`
- `docs/PRODUCT_MANAGEMENT_END_TO_END_PRD_2026-05-01.md`
- `docs/WIDEN_REPLACEMENT_DIGITAL_ASSETS_PRD_2026-05-01.md`
- `docs/traceability/source_of_truth/PRICING_DEALER_GROUP_AFFINITY_OWNERSHIP_IMPLEMENTATION_GUIDE.md`
- `docs/traceability/source_of_truth/FULL_RELEASE_PLAN.md`
- `docs/traceability/registers/PROJECT_BREAKDOWN_DETAILED.csv`
- `docs/traceability/registers/DEPENDENCY_CRITICAL_PATH_REGISTER.csv`
- `docs/traceability/registers/RAID_LOG_INITIAL.csv`
- `docs/DELIVERY_PROGRESS_TRACKER.md`

## Discovery Summary

The Dealer Portal replaces Shopify for residential dealer self-service. The business does not want a complex ecommerce build for its own sake. The intended portal is a simple, account-aware place where dealers can log in, see the correct branded catalog, place or repeat orders with a PO, view company-wide orders and invoices, see tracking, access product files, and avoid calling Dynamic for basic status questions.

Key discovery themes:

- Shopify is contact-centric and siloed; Pulse must be company/account-centric.
- Currie repeatedly asked to keep the dealer experience simple; Pulse should expose clear account, catalog, and file actions before adding heavier commerce flows.
- Dealers should see company-wide orders, not only the orders placed by the signed-in person.
- Billing address should not be freely editable by dealers.
- Product identity comes from Acumatica; dealer-facing names, descriptions, images, files, and branded variants are managed in Pulse.
- Dealer group drives catalog, files, branding, and product presentation.
- Price class drives portal price, but final invoice truth remains in Acumatica.
- Inventory counts and shipment scheduling are not core dealer portal scope.
- Requested delivery date was rejected in Session 11; standard shipping expectation is preferred.
- Credit hold, past due, and failed payment signals should be visible and should drive alerts.
- Widen/Shopify content should be replaced by Pulse Digital Assets where practical, but Widen legacy migration shape is not fully known.

## What Is Developed So Far

### Dealer Identity And Provisioning

Current implementation:

- CRM-side dealer portal setup on customer/account detail.
- Dealer portal account status.
- Dealer portal user provisioning.
- Suspend, deactivate, and reset password flows.
- Dealer user membership linked to a Pulse account.
- Dealer portal role tiers: Admin, Purchasing, Accounting, Viewer.
- Audit entries for provisioning and status/password changes.
- Dealer-facing protected routes:
  - `/dealer`
  - `/dealer/login`
  - `/dealer/accept-invite`
  - `/dealer/dashboard`
  - `/dealer/account`
  - `/dealer/catalog`
- Backend route:
  - `/api/v1/dealer-portal/me/dashboard`

Status: **baseline built and real**, approximately **80%** for provisioning and identity baseline.

Remaining:

- Invitation email delivery.
- Company-admin self-service invite/revoke flow.
- Role-sensitive UX across visible portal sections.
- More explicit customer-account access rules for multi-company or parent-child accounts when hierarchy scope is approved.

### Dealer Account Center

Current implementation:

- Dealer dashboard exposes account status, contacts, locations, portal users, territory, region, shipping center, TM, and RD.
- Account center is read-only and backend-wired.

Status: **partially built**, approximately **55%**.

Remaining:

- Payment terms, credit limit, credit hold, past due, and failed payment indicators.
- Account-wide order, invoice, shipment, statement, and payment history.
- Billing address lock / governance messaging.
- Shipping, office, warehouse, training, and billing address type handling in the dealer view.

### Product And Catalog Foundations

Current implementation:

- Product Management has categories, families, products, dealer catalog visibility, readiness, and publish control foundations.
- Dealer Catalog Views / Catalog Rules support group-first thinking.
- Product readiness tracks display content and file requirements.
- Digital Assets has internal/dealer/public visibility, external share links, product assignments, and S3/CloudFront adapter direction.
- Dealer-facing catalog route/API exists for published catalog and dealer-safe files.

Status: **read-only dealer catalog baseline is built**, approximately **45%** for the full discovery catalog experience.

Remaining:

- Role-sensitive catalog actions.
- Search, filters, categories, product detail, favorites, and later quick reorder.
- Branded/private-label presentation per dealer group.
- File-open/download audit from the portal.
- Published catalog snapshot/rollback behavior for pilot safety.

### Orders, Pricing, Invoices, Shipments, Payments

Current implementation:

- No production dealer ordering flow.
- No dealer cart.
- No invoice/order/shipment/payment dealer views.
- No portal pricing sync/read model.

Status: **mostly parked by dependency**.

Primary dependencies:

- Acumatica product, customer, price class, order, invoice, shipment, payment, credit hold, and document APIs.
- Customer creation timing decision: before first order vs after approved activation.
- Payment provider/tokenization model for US/Canada.
- Pricing bootstrap source: Acumatica, existing Azure pricing database, or governed import.
- Transaction history migration/reconciliation plan.

## Requirement Gap Matrix

| Area | Discovery Requirement | Current State | Gap | Next Action |
|---|---|---|---|---|
| Account access | Company-level dealer account visibility | Dealer users link to account with role tiers | Need role-sensitive section behavior, company admin, parent-child visibility | Build role-sensitive portal sections; park hierarchy depth until approved |
| Provisioning | Governed access after onboarding | CRM admin can provision user | No invite email / first-login enrollment | Build invitation workflow and tokenized first login |
| Account center | Contacts, locations, company context | Read-only contacts/locations exist | No financial/account health widgets | Add account-health read model placeholders and parked ERP source notes |
| Billing governance | Dealers cannot freely edit billing | Not exposed | Need locked billing view and change request path | Build read-only billing section with internal change workflow later |
| Role-sensitive UX | Simple dealer experience by business role | Role tiers exist | Need role-aware portal sections and locked states | Build role-sensitive dashboard/account/catalog sections |
| Catalog | Branded catalog by dealer group | Read-only dealer catalog baseline exists | Need simple search, filters, product detail, and favorites | Build search/filter/favorites without pricing/cart |
| Product content | Descriptions/images/files managed outside ERP | Published dealer-safe feed exists | Need file-open/download audit and better delivery hardening | Audit every dealer file open/download |
| Favorites/quick order | Dealers can favorite and quickly reorder | Favorites not built | Need account/user saved items | Build favorites now; keep quick reorder parked until pricing/order boundary |
| Cart/order | Add to cart, PO, quantity, checkout | Not built | Depends on pricing/order boundary | Park submit; build cart draft only after pricing read model |
| Delivery date | Do not expose requested delivery date | Not built | Ensure it stays out | Keep excluded from checkout design |
| Inventory | Do not block on real-time stock | Not built | Need non-blocking validation policy | Park until order validation slice |
| Pricing | Correct account price at login/checkout | Pricing model not dealer-facing | Needs price class/source approval | Park final pricing; build readiness warnings only |
| Invoices | Download invoice PDFs | Not built | Acumatica docs dependency | Park until invoice sync |
| Orders | Company order history and tracking | Not built | Acumatica transaction sync dependency | Park until transaction bootstrap |
| Payments | Tokenized card/ACH, payment history | Account payment token refs exist internally | Provider decision needed | Park portal payment actions |
| Credit hold | Show hold/past due and block ordering | Not built in portal | ERP status and alert engine dependency | Build account-health shell; enforce later |
| Notifications | Alert dealer/admin/TM/RD on finance events | Notification framework incomplete | Needs alert rules and ERP event source | Build preference/read model after account-health shell |
| Assets | Dealer-safe files and share links | Digital Assets backend/UI exists | Portal download/feed missing | Add dealer portal file list after catalog feed |
| Internal preview | Dynamic staff can verify account/role/catalog/file visibility before dealer rollout or support | No governed preview mode documented yet | Need read-only preview with visible internal banner, audit, diagnostics, and no commercial fake data | Build Dynamic Internal Dealer Preview before dealer self-admin |

## What Can Be Built Next Without Waiting On Acumatica

### Slice DP-1: Dealer Portal PRD And Traceability Finalization

Output:

- Formal Dealer Portal PRD copied into the development repo.
- Requirement IDs mapped to sessions and registers.
- Parked dependency table for Acumatica, pricing, invoices, payments, and order submit.

Why now:

- There is no full standalone Dealer Portal PRD in the development repo yet, only architecture direction and implementation notes.

### Slice DP-2: Dealer Role Tiers And Access Policy

Output:

- Dealer portal roles: Admin, Purchasing, Accounting, Viewer.
- Backend permission rules for dashboard/account center sections.
- UI labels that make these roles easy to understand.

Why now:

- This is Pulse-owned and required before showing orders/invoices/payments safely.

### Slice DP-3: Invitation And First Login

Output:

- CRM admin sends invite.
- Dealer receives tokenized first-login flow.
- Temporary password exposure reduced.
- First login can require password reset.

Why now:

- Current provisioning works but is not production-polished.

### Slice DP-4: Read-Only Dealer Catalog Shell

Output:

- Dealer-facing `/dealer/catalog`.
- Backend API reads published Product Management catalog views.
- Account dealer group resolves visible products and files.
- No pricing/cart/order submit yet.

Why now:

- Product Management and Digital Assets are now strong enough to feed a read-only catalog.
- This proves the Shopify replacement direction without taking on unsafe financial dependencies.

### Slice DP-5: Dealer Asset Downloads

Output:

- Dealer-safe product files and downloads in the portal.
- Only assets marked dealer-visible/public and matching dealer catalog context are visible.
- Download/share audit is captured.

Why now:

- It builds on the Widen replacement work and supports the discovery need for product docs/downloads.

### Slice DP-6: Account Health Shell

Output:

- Portal card for payment terms, credit status, billing lock notice, and support instructions.
- Values can start as explicit `pending ERP sync` states.
- No fake financial calculations.

Why now:

- It prepares the exact UI area where credit hold/past due/payment failure will land later.

### Slice DP-7: Delivered No-External-Dependency Dealer UX

Output:

- Role-sensitive portal sections for Admin, Purchasing, Accounting, and Viewer.
- Simple catalog search, filters, and favorites.
- Dealer file-open/download audit.
- Account Health shell with explicit pending ERP-sync states.

Acceptance criteria:

- Users only see actions and account sections allowed by their dealer role.
- Role-locked or dependency-locked states use simple wording and do not show fake data.
- Catalog search and filters operate only on the already-published dealer-visible catalog feed.
- Favorites are saved without implying price, stock, cart, checkout, or reorder readiness.
- File opens/downloads are audited with account, user, product/file, catalog view, visibility source, timestamp, and outcome.
- Account Health displays payment terms, credit status, billing lock notice, and support guidance as shell fields.
- Any value requiring Acumatica, payment-provider, invoice, shipment, order, or credit-hold data displays `pending ERP sync` or `not available yet`.

Why now:

- It moves the dealer portal toward the simple self-service experience Currie asked for while avoiding unsafe external dependencies.

### Slice DP-8: Dynamic Internal Dealer Preview / Preview As Dealer Account

Output:

- Internal-only preview entry point for authorized Dynamic staff.
- Account and role/context selection for the dealer account center, catalog, and dealer-safe file views.
- Read-only preview state across portal surfaces.
- Persistent visible banner identifying the session as an internal Dynamic preview.
- Audit and diagnostics for preview start, route/surface viewed, selected account, selected role/context, timestamp, and denied/empty visibility outcomes.

Acceptance criteria:

- Authorized internal staff can preview account center, role-sensitive sections, catalog visibility, and dealer-safe files for a selected account.
- Preview is read-only and cannot submit orders, change account data, mutate favorites, create dealer actions, or change catalog/file state.
- Preview mode is visibly bannered as internal preview on every previewed surface.
- Preview uses real account/catalog/file visibility data only; no fake prices, invoices, orders, shipment statuses, payment records, credit holds, or other commercial placeholder data are introduced.
- Audit/diagnostics capture staff identity, account, role/context, route/surface, timestamp, and visibility outcomes.

Why now:

- It gives Dynamic a safe way to validate what dealers will see before wider rollout, without moving prematurely into dealer company self-admin or true impersonation.
- True impersonation is a later support/compliance capability and requires stronger reason capture, time-limited access, explicit identity switching, and audit-review controls.

## What Must Stay Parked Until Dependencies Close

| Parked Area | Dependency | Resume When |
|---|---|---|
| Final portal pricing | Price class mapping, price book source, USD/CAD rules, Acumatica or approved pricing database access | Representative accounts can resolve expected price class and price book |
| Submit order to Acumatica | Customer creation trigger, order API, PO and validation rules | Acumatica sandbox/order endpoint is certified |
| Invoice PDF download | Invoice/document API and 24-month transaction bootstrap | Acumatica invoice document retrieval works in non-prod |
| Shipment tracking | Shipment/tracking sync from Acumatica/carriers | Shipment read model is populated for pilot accounts |
| Payment collection | US/Canada payment provider and tokenization decision | Provider contract and hosted/tokenized flow approved |
| Credit hold enforcement | ERP credit status sync and alert framework | Credit hold signal reaches Pulse with SLA |
| Historic transaction reporting | Migration/reconciliation plan | Transaction bootstrap rehearsal passes |
| True dealer impersonation | Reason capture, time-limited session controls, explicit identity switching, support/compliance approval, and audit review | After internal preview is stable and impersonation governance is approved |

## Recommended Next Roadmap

1. **DP-1 Dealer Portal PRD and traceability finalization**  
   This should be done first so every later slice maps cleanly to discovery and parked dependencies.

2. **DP-2 Dealer role tiers and access policy**  
   Protects future orders, invoices, payments, and company-wide data.

3. **DP-3 Invitation and first-login enrollment**  
   Makes the provisioning baseline production-ready.

4. **DP-4 Read-only dealer catalog shell**  
   First meaningful Shopify replacement surface without financial risk.

5. **DP-5 Dealer asset downloads from published catalog context**  
   Connects Product Management and Digital Assets to the portal.

6. **DP-6 Account health shell**  
   Prepares for credit hold, past due, and payment failure without pretending ERP sync is done.

7. **DP-7 no-external-dependency dealer UX**
   Role-sensitive UX, catalog search/filter/favorites, dealer file-open audit, and Account Health shell are now implemented. This remains intentionally simple and avoids ERP/provider dependencies.

8. **DP-8 Dynamic internal dealer preview / Preview as Dealer Account**
   Implemented: authorized Dynamic staff can verify account/role/catalog/file visibility in a read-only, visibly bannered, audited mode using real data only. This is not true impersonation.

9. **DP-9 Cart draft and quick reorder**
   Only after read-only catalog is stable. Keep submit disabled until pricing/order dependencies close.

10. **DP-10 Pricing, checkout, order submit, invoices, payments, and tracking**
   Resume after Acumatica/provider dependencies are certified.

11. **Later: true dealer impersonation**
   Revisit only after reason, time-limit, identity-switching, and audit-review controls are approved.

## Current Completion Estimate

| Dealer Portal Sub-Area | Completion |
|---|---:|
| Provisioning and account-user identity | 70% |
| Dealer login and protected shell | 65% |
| Dealer account center | 55% |
| Dealer roles and company access governance | 25% |
| Dealer catalog browsing | 10% |
| Dealer asset/file access | 20% |
| Cart and quick reorder | 0% |
| Pricing display | 10% |
| Order submit | 0% |
| Order/invoice/shipment history | 0% |
| Payments and credit hold enforcement | 5% |

Overall Dealer Portal completion: **approximately 48-55%**.

The built foundation is real, but the actual Shopify replacement experience is not complete yet. The next useful work should focus on Dynamic Internal Dealer Preview / Preview as Dealer Account so authorized staff can validate account, role, catalog, and file visibility before moving into dealer company self-admin, pricing, checkout/order submit, invoices, shipment tracking, payments, credit hold enforcement, or true impersonation.
