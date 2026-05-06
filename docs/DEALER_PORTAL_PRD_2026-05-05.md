# Dealer Portal PRD

**Date:** 2026-05-05  
**Status:** Active build baseline for Pulse-owned dealer portal work  
**External dependencies parked:** Acumatica pricing/orders/invoices/shipments/credit status, payment provider/tokenization, transaction migration, true dealer impersonation controls

## Purpose

Replace the current Shopify dealer experience with a simple account-aware Pulse portal where dealers can access the right company context, published catalog, dealer-safe product files, and later ERP-backed commerce history and ordering.

## Discovery Requirements

| ID | Requirement | Source |
|---|---|---|
| DP-REQ-001 | Dealer access must be tied to the company/account, not isolated Shopify contact accounts. | Session 7 |
| DP-REQ-002 | Dynamic staff must provision and govern dealer portal users from the CRM account. | Session 9, release plan |
| DP-REQ-003 | Portal users need business roles so company access can separate admin, purchasing, accounting, and viewer behavior. | Project breakdown, Session 7 |
| DP-REQ-004 | Dealers need a branded/product catalog based on dealer group/catalog view. | Sessions 7 and 11 |
| DP-REQ-005 | Product identity comes from Acumatica, while Pulse manages dealer-facing names, descriptions, images, and files. | Sessions 7 and 11 |
| DP-REQ-006 | Dealer group/catalog view controls catalog and file visibility; price class must stay separate. | Pricing/dealer group guide |
| DP-REQ-007 | Product files must come from the governed Digital Assets library and expose only dealer-safe/public assets. | Session 11, Widen replacement PRD |
| DP-REQ-008 | Dealers need company-wide orders, invoices, shipment/tracking, payments, and statements once Acumatica transaction sync exists. | Sessions 7 and 11 |
| DP-REQ-009 | Billing address edits must be locked or routed through an approved process. | Sessions 7 and 11 |
| DP-REQ-010 | Credit hold, past due, and failed payment signals must be visible and should trigger notifications. | Session 11 |
| DP-REQ-011 | Requested delivery date should not be exposed as a core checkout expectation. | Session 11 |
| DP-REQ-012 | Inventory validation should not block order submission as a hard real-time dependency. | RAID log |
| DP-REQ-013 | Dealer portal UX must stay simple and role-sensitive: users should see the account sections their role can use, with locked or pending states instead of confusing placeholders. | Sessions 7, 11 |
| DP-REQ-014 | Dealers need simple catalog search, filters, and favorites so they can find repeat products and files without a full ecommerce build. | Sessions 7, 11 |
| DP-REQ-015 | Dealer file opens/downloads must be audited by account, user, product/file, visibility context, and timestamp. | Session 11, Widen replacement PRD |
| DP-REQ-016 | Account Health must exist as a shell for payment terms, credit status, billing lock notice, and support guidance, while showing explicit pending ERP-sync states until Acumatica data is live. | Session 11 |
| DP-REQ-017 | Dynamic authorized internal staff need a read-only "Preview as Dealer Account" mode to verify account, role, catalog, and file visibility before inviting or supporting dealers. | Internal preview slice |

## Current Build Scope

### Built Now

- Dealer portal account and user provisioning.
- Dealer portal user status lifecycle: active, suspended, deactivated.
- Dealer portal role tier on the membership:
  - Admin
  - Purchasing
  - Accounting
  - Viewer
- Tokenized dealer invite link foundation:
  - invite token is stored hashed
  - invite link expires
  - accepting invite sets the dealer password
  - accepted invite cannot be reused
- Dealer dashboard and account center.
- Dealer read-only catalog API:
  - resolves the signed-in account to an active catalog view through active catalog rules or default catalog view
  - returns only published, dealer-ready product presentations
  - returns only active dealer/public product assets
  - excludes pricing and order submission
- Dealer `/dealer/catalog` page for products and files.

### Parked Until External Dependencies

| Parked Slice | Dependency |
|---|---|
| Final portal prices | Acumatica/approved price book source, price class resolution, USD/CAD mapping |
| Cart checkout and order submit | Customer creation timing, order endpoint certification, PO validation |
| Invoice PDFs | Acumatica invoice document access |
| Order/shipment tracking | Transaction/shipment sync and carrier tracking source |
| Payment actions | Provider/tokenized hosted payment model |
| Credit hold enforcement | ERP credit status sync and alert engine |
| Historic reporting | Transaction migration and reconciliation |
| True dealer impersonation | Stronger audit reason capture, time-limited session controls, visible identity switching, and support/compliance approval |

## Acceptance Criteria

### Provisioning

- Internal authorized users can provision dealer users from the customer/account workspace.
- A provisioned dealer user has a role tier.
- Provisioning creates an invite link for dealer first-login setup.
- Internal authorized users can reissue an invite link for an active dealer portal user.
- Invite acceptance sets the dealer password and revokes any older sessions.
- Used or expired invite tokens cannot be reused.
- Suspended or deactivated users cannot continue using active sessions.
- Password reset revokes older sessions.

### Catalog

- Dealer users can open `/dealer/catalog`.
- Catalog data comes from `/api/v1/dealer-portal/me/catalog`.
- Products appear only when:
  - base product is active, sellable, and dealer-visible
  - presentation is published and ready for dealer portal
  - catalog inclusion matches the resolved catalog view
  - inclusion is visible and published
- Product files appear only when:
  - asset is active
  - asset visibility is dealer portal or public
  - brand/region scope does not conflict with the resolved catalog view

### Dependency Boundary

- No fake prices, invoices, orders, shipment statuses, credit holds, or payment actions are shown.
- No commercial fake data is introduced to make preview, catalog, account health, or parked commerce areas appear complete.
- Parked dependencies remain documented in this PRD and progress tracker.

### Delivered No-External-Dependency Slice

This slice keeps the dealer experience simple, as Currie repeatedly asked during discovery. It improves the already-built dealer portal shell without depending on Acumatica pricing, checkout/order submit, invoices, shipment tracking, payments, or credit hold enforcement.

#### Role-Sensitive UX

- Dealer portal sections respect the signed-in user's company role:
  - Admin can see company users and account context.
  - Purchasing can use catalog and saved product/file workflows.
  - Accounting can see Account Health shell fields that are safe before ERP sync.
  - Viewer can browse approved catalog/files without management actions.
- Hidden sections do not leak blocked data through UI labels, empty states, or API responses.
- Locked sections use simple wording that explains whether the limitation is role-based or waiting on ERP data.

#### Catalog Search, Filters, And Favorites

- Dealers can search the published catalog by dealer-facing product name, SKU/item number when available, family, category, and file title.
- Dealers can filter by category/family, brand/private-label presentation, product readiness, and file type when those fields are present.
- Favorites can be saved per dealer user and account, so repeat users can quickly return to common products and files.
- Favorites do not imply price, stock, cart, checkout, or reorder capability.

#### Dealer File-Open Audit

- Every dealer file open/download records account, dealer user, product/file, resolved catalog view, visibility source, timestamp, and delivery outcome.
- Audit entries are internal-only and must support later support, compliance, and wrong-file investigation.
- Audit capture must not expose files that fail dealer/public visibility checks.

#### Account Health Shell

- Account Health shows simple cards for payment terms, credit status, billing lock notice, and support instructions.
- Values that require Acumatica show explicit `pending ERP sync` or `not available yet` states.
- The shell does not enforce credit hold, accept payments, show invoice balances, or calculate account status until ERP/provider data is certified.

### Next Slice: Dynamic Internal Dealer Preview

The next Pulse-owned dealer portal slice is an internal-only **Preview as Dealer Account** mode. It lets authorized Dynamic staff verify the dealer account experience without creating commercial placeholders or entering a true impersonation session.

Acceptance criteria:

- Authorized internal staff can preview the dealer portal account center, role-specific navigation/states, published catalog, and dealer-safe files for a selected account.
- Preview mode is read-only and cannot create dealer actions, mutate favorites, submit orders, change account data, or alter catalog/file state.
- Every preview screen is visibly bannered as an internal Dynamic preview, including the selected account and role context.
- Preview uses real account/catalog/file visibility data only; no fake prices, invoices, orders, shipment statuses, payments, credit holds, or other commercial data are introduced.
- Audit and diagnostics capture who started the preview, selected account, selected role/context, timestamp, route/surface viewed, and denied/empty visibility outcomes.
- True impersonation remains parked for a later support/compliance slice with stronger reason capture, time limits, explicit identity switching, and audit review controls.

## Next Pulse-Owned Slices

1. Email delivery integration for invite links once provider choice is approved.
2. Published-catalog snapshot/rollback safety.
3. Stable delivery URL hardening beyond the current file-open audit.
4. Parent/child account visibility once account-hierarchy scope is approved.
5. Company-admin self-service invite/revoke/access-management flow only after Dynamic confirms this belongs in dealer scope.
6. True dealer impersonation only after reason, time-limit, identity-switching, and audit-review controls are approved.
