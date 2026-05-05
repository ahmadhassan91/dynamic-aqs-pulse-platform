# Dealer Portal PRD

**Date:** 2026-05-05  
**Status:** Active build baseline for Pulse-owned dealer portal work  
**External dependencies parked:** Acumatica pricing/orders/invoices/shipments/credit status, payment provider/tokenization, transaction migration

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
- Parked dependencies remain documented in this PRD and progress tracker.

## Next Pulse-Owned Slices

1. Dealer role permissions in UI sections.
2. Catalog search/filter/favorites.
3. Dealer asset download audit and stable delivery URL hardening.
4. Account health shell with explicit pending ERP-sync states.
5. Email delivery integration for invite links once provider choice is approved.
