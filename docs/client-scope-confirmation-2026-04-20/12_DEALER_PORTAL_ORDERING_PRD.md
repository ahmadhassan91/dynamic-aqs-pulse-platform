# Dealer Portal & B2B Ordering PRD

## Document Control

| Field | Value |
|-------|-------|
| Module | Dealer Portal & B2B Ordering |
| Document Type | Master PRD |
| Version | 1.1 |
| Status | Draft — initial authoring from discovery transcripts; scope corrections applied 2026-06-18 (FR-DPO-035 parked; FR-DPO-037/016 reframed as candidates) |
| Owner | Product / Operations |
| Sprint Sequence | Seq 06–07 |
| Priority | P0 |
| Date | 2026-06-09 |

---

## Scope corrections (2026-06-18)

- **(HIGH) FR-DPO-035 — expedited shipping with estimated cost delta → move to Parked/Phase-2; drop the cost-delta acceptance criterion.** Dan scoped shipping OUT of the portal in Session 2: *"not charged a credit cards, not figure out the shipping not [do] tracking, do that in a[cumatica]"*; in Session 7 he problematized expedited (FedEx pickup cut-off) and wanted only an approximate algorithm. No transcript supports a per-option cost-delta display, and it contradicts this PRD's own parked-shipping row ("Shipping cost calculation at checkout", §5 Parked Dependencies / ASM-DPO-005).
- **(MED) FR-DPO-037 — gift-card / coupon → reframe as a candidate pending its open question (OQ-DPO-004).** It was a Dan brainstorm in Session 7: *"this is too much … it would be nice if …"* — not a confirmed in-scope requirement.
- **(MED) FR-DPO-016 — payment-decline alert → gate on the parked payment feed.** The alert presumes payment-failure data from a payment integration this same PRD parks (§4 Out-of-Scope: payment processing; §5 Parked Dependencies: credit card / ACH payment at checkout). Treat as a candidate dependent on that parked feed.

Full audit: `docs/SCOPE_ACCURACY_AUDIT_2026-06-18.md`.

---

## Meeting Traceability

| Session | Date | Speakers sourced |
|---------|------|-----------------|
| Session 7 — Dealer Portal Discovery | 02 March 2026 | Ahmad Hassan (Clustox), Dan Harshbarger (Dynamic AQS), C G (Dynamic AQS), Michelle Hogan (Dynamic AQS), Samantha Marks (Dynamic AQS), Maryam Zahid (Clustox), Muhammad Majid (Clustox) |
| Session 11 — To-Be Dealer Portal, Product Management | 19 March 2026 | Ahmad Hassan (Clustox), C G (Dynamic AQS), Don Hearn (Dynamic AQS), Michelle Hogan (Dynamic AQS), Muhammad Majid (Clustox) |
| PRD-Lead-To-Dealer (written synthesis) | circa March 2026 | Ahmad Hassan (Clustox) — authored from sessions through 05 Mar |

---

## Source Inventory

| ID | Absolute Path | What it sourced |
|----|--------------|-----------------|
| SRC-DPO-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/02 March session 7 Discovery - Delaer Portal.md` | Full current-state Shopify walkthrough; billing-address lock requirement; credit-hold/past-due banner; expedited-shipping request; coupon/gift-card codes; company-wide order history; invoice visibility; tracking numbers; shipping algorithm discussion; Acumatica integration flow; product descriptions/images hosted in Shopify; Bold Commerce pricing plug-in pain points; account-context pricing; order-to-ERP sync pattern; refund handling |
| SRC-DPO-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/dealer/DealerPortalProtectedWorkspace.tsx` | Built: auth guard, `DEALER_PORTAL_USER` role check, session hydration, redirect to `/dealer/login` |
| SRC-DPO-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/dealer/DealerDashboard.tsx` | Built: landing dashboard with role-gated CTAs (admin/purchasing/accounting/viewer), account support panel, product files preview, `assignedTmName` display |
| SRC-DPO-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/dealer/DealerCatalog.tsx` | Built: catalog browse with search, category/brand/family/file-type/file-availability filters, favorites toggle, product cards with asset download |
| SRC-DPO-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/dealer/DealerCatalogProductDetail.tsx` | Built: product detail with full asset list, role/file-type groups, long-description, spec summary, catalog-view context |
| SRC-DPO-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/dealer/DealerAccountCenter.tsx` | Built: account center with role display, company portal status, Dynamic AQS account team (TM/RD/territory/shipping-center), portal user management (invite/pause/restore), company contacts, company locations, account-health panel with billing-address-locked note |
| SRC-DPO-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/src/dealer-portal.ts` | Built contracts: `DealerPortalProvisioningStatusKey`, `DealerPortalAccessRoleKey` (admin/purchasing/accounting/viewer), `DealerPortalDashboardResponse`, `DealerPortalCatalogResponse`, `DealerPortalCatalogProductSummary`, `DealerPortalCatalogAssetSummary`, `DealerPortalCatalogDiagnostics`, `DealerPortalFavoriteProductResponse`, `DealerPortalAssetOpenResponse`, invite flow types |
| SRC-DPO-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/dealer-portal/service.ts` | Built service: provisioning, catalog resolution (affinity/ownership/region rules), asset delivery (CloudFront/legacy URL), favorites, invite lifecycle, internal preview with diagnostics |
| SRC-DPO-009 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session _11 To-Be Dealer Portal, Product Management.md` | To-Be product catalog walkthrough; dealer group selection before product view; dealer-specific branding on products; catalog categories/families; reorder functionality; order history with company-wide visibility; tracking in portal; invoice list with date-range filter; year-to-date spend dashboard; credit-hold/past-due notifications; payment-method history (CC/ACH/check); favorite products; asset library by brand; Widen vs S3 discussion |
| SRC-DPO-010 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/PRD-Lead-To-Dealer.md` | Stage-gated ERP activation (first-order gate), HubSpot elimination, dealer portal access dependency on CIS vs first-order, downstream ordering flow, pricing from Acumatica price books |

---

## 1. Executive Summary

The Dealer Portal & B2B Ordering module replaces Shopify as the primary B2B ordering surface for Dynamic AQS residential dealers. Shopify currently handles approximately 60% of all residential sales and 45% of total company sales (SRC-DPO-001, Dan Harshbarger, Session 7). The replacement must resolve Shopify's documented limitations: 100-variant ceiling, Bold Commerce pricing glitches, no company-wide order visibility, no invoice access, no tracking, no credit-hold awareness, and a locked product-catalog that is difficult to maintain.

The target state is a fully-integrated dealer-facing portal where dealers log in, see their assigned product catalog (filtered by affinity group / ownership group / brand), browse, add to cart, place orders with a PO reference, view their company-wide order history and invoices, track shipments, and self-manage their portal users — all without calling Dynamic AQS staff. Pricing comes from Acumatica price books via the account's assigned price class. Billing addresses are locked and cannot be changed by dealers. A credit-hold/past-due banner is visible and prevents ordering when activated.

The B2B ordering layer (cart, checkout, place-order, order history, invoices, reorder, expedited-shipping, gift-card/coupon, credit-hold) is the primary **gap** in the current build. The catalog, asset, account-center, and user-management layers are substantially **built**; the transactional commerce layer is **not built**.

---

## 2. Problem Statement

### Current State (Shopify)

Per SRC-DPO-001 (Session 7, multiple speakers):

- **100-variant limit** in Shopify prevents full catalog representation; workaround is manual edits.
- **Bold Commerce pricing plug-in** gives wrong prices intermittently, "doesn't work one half of 1% of the time" (Dan Harshbarger). Pricing is uploaded via CSV once per year; no real-time price validation.
- **No company-wide order visibility**: five people ordering for one company can only see their own orders, not each other's.
- **No invoice access** inside Shopify; invoices come by email only.
- **No tracking information** surfaced to dealers; dealers must call in for tracking.
- **Billing address** can be changed by dealers in Shopify — Dynamic AQS does not want this.
- **No credit-hold awareness** in portal; credit-hold customers can still attempt orders.
- **No expedited-shipping selection** by dealers; they call in to request overnight or priority.
- **No coupon/gift-card codes**: contest winners must call in; Dynamic AQS zeroes the order manually.
- **ERP sync delay** ~15 minutes; orders arrive in Acumatica via email-matched contact and SKU-to-stock-ID match; mismatches generate an error queue requiring manual intervention.
- Product descriptions and images exist only in Shopify; Acumatica has none of that marketing content.
- Dealer affinity/brand context drives product display (logos, descriptions, images) but is tag-based and fragile.

### Target State

A self-service B2B portal where dealers interact with a catalog tailored to their affinity group, place orders with account-context pricing, see company-wide history and invoices, track shipments, and manage portal users — replacing Shopify entirely.

---

## 3. In-Scope

- Dealer portal authentication (login, invite acceptance, password management)
- Role-based portal access: Account Access (admin), Products & Files (purchasing), Account Health (accounting), Viewer
- Catalog browse with affinity-group / brand / ownership-group / region filtering
- Product detail with downloadable assets (spec sheets, install guides, marketing materials)
- Product favorites
- **Cart and checkout** — add items, set quantity, select shipping address from dealer's locations
- **Place order** — submit with PO number, capture to Acumatica
- **Order history** — company-wide visibility, date range, status, tracking numbers
- **Invoice list** — view, download, date-range filter, year-to-date spend
- **Reorder** — one-click reorder from prior order
- **Expedited-shipping selection** at checkout (standard vs expedited; show estimated cost delta)
- **Gift-card / coupon code** redemption at checkout (zero-out order for contest winners)
- **Credit-hold banner** — prominent display when account is on credit hold; order placement blocked
- **Past-due balance alert** — visible on dashboard; configurable notifications to TM/RD/accounting
- Billing-address lock — dealer cannot edit billing address; must contact Dynamic AQS
- Multiple shipping-address support from account locations
- Portal user management (invite, activate, pause, restore by company admin users)
- Year-to-date spend summary on dealer dashboard
- Payment-method history display (CC / ACH / check)
- Rebate-eligible spend indicator (shipping excluded from rebate calc per Michelle Hogan, Session 11)

---

## 4. Out-of-Scope

- Commercial (non-residential) customers — explicitly excluded by C G (Session 7): "commercial customers are not in our CRM"
- Full returns / RMA workflow via dealer portal — Dan Harshbarger stated "we don't need to do refunds to the dealer portal" (SRC-DPO-001); returns handled entirely through Acumatica
- Payment processing (credit card, ACH) in the initial portal build — invoicing is preferred; card tokenization is a parked Phase 2 item (see Parked Dependencies)
- Real-time inventory availability display — Dan Harshbarger stated "we want them to order it and then we'll deal with it" (SRC-DPO-001); no stock availability needed at order time
- Tax calculation at checkout display — handled by Acumatica post-order; most dealers have resale certificates and are tax-exempt; Dynamic AQS has Nexus only in FL/NV/NJ/WA (SRC-DPO-001)
- Contractor Commerce / Filter Fetch data surfacing in portal (brainstormed in Session 7 but noted as a complex future item)

---

## 5. Parked Dependencies

| Item | Reason parked |
|------|--------------|
| Credit card / ACH payment at checkout | Requires payment processor integration (Ebiz, Moneris, or similar); 3% card surcharge is a business decision; some dealers prefer invoicing — parked for Phase 2 |
| Real-time Acumatica pricing at checkout | Dan Harshbarger explicitly preferred a nightly-sync local cache over live ERP calls to avoid dependency on Acumatica uptime during checkout (SRC-DPO-001) — pricing syncs nightly or on manual admin trigger |
| Shipping cost calculation at checkout | Requires integration with FedEx/carrier APIs; current workaround is historical-data-based algorithm; parked until algorithm is tuned or carrier API is certified |
| Tax display at checkout | Acumatica computes tax after order; only a handful of states have Nexus — parked by design |
| Widen integration for portal product images | Confirmed decision: Pulse will use AWS S3 + CloudFront for asset storage, not Widen; product images in portal are uploaded to and served from CloudFront (SRC-DPO-009, confirmed by Muhammad Majid) |
| Contractor Commerce / Filter Fetch data in portal | Named by Dan Harshbarger as a brainstorm item (SRC-DPO-001); data-matching complexity noted; parked for future |

---

## 6. Functional Requirements

### 6.1 Authentication & Access

| ID | Requirement | Acceptance Criteria | Priority | Build Status | Source(s) |
|----|------------|---------------------|----------|-------------|-----------|
| FR-DPO-001 | Dealer portal has a separate login page and session from the internal Pulse workspace | Dealer users authenticate at `/dealer/login`; `DEALER_PORTAL_USER` role is enforced; internal Pulse users see a redirect message if they attempt to access dealer routes | P0 | Built | SRC-DPO-002, SRC-DPO-007 |
| FR-DPO-002 | Dealer users are provisioned by Dynamic AQS admin staff | Admin provisions a portal account linked to an `Account`; portal user record created with access role; temporary password or invite token issued | P0 | Built | SRC-DPO-008 |
| FR-DPO-003 | Company admin (Account Access role) can invite additional portal users | Admin sees Invite User button in Account Center; can set name, email, title, and access role (Products & Files / Account Health / Viewer); invite link generated and returned | P0 | Built | SRC-DPO-006 |
| FR-DPO-004 | Company admin can pause (deactivate) and restore portal user access | Pause Access / Restore Access actions in user table; user's status transitions to `deactivated` / `active`; primary-owner and Account-Access users are Dynamic AQS-managed and cannot be self-paused | P0 | Built | SRC-DPO-006 |
| FR-DPO-005 | Invite links expire after 14 days | `inviteExpiresAt` is set to `createdAt + 14 days`; expired invites do not allow password set | P1 | Built | SRC-DPO-008 |
| FR-DPO-006 | Portal provisioning statuses are tracked per account | Statuses: `not_started`, `ready_to_provision`, `active`, `suspended`, `deactivated` visible to internal admin | P0 | Built | SRC-DPO-007 |

### 6.2 Dealer Dashboard

| ID | Requirement | Acceptance Criteria | Priority | Build Status | Source(s) |
|----|------------|---------------------|----------|-------------|-----------|
| FR-DPO-010 | Landing dashboard surfaces role-specific next action | Admin role shows Account Center CTA; Purchasing role shows catalog CTA; Accounting role shows Account Health CTA; Viewer shows read-only catalog CTA | P1 | Built | SRC-DPO-003 |
| FR-DPO-011 | Dashboard shows assigned Territory Manager name | `assignedTmName` displayed in Account Support panel; falls back to "Dynamic AQS support" if no TM assigned | P1 | Built | SRC-DPO-003 |
| FR-DPO-012 | Dashboard shows year-to-date spend summary and monthly spend graph | YTD spend amount visible on dashboard; bar graph by month; dealers use this to verify rebate calculations — shipping amounts must be excluded from rebate-eligible spend per Michelle Hogan (Session 11) | P1 | Not built | SRC-DPO-009 (C G, Michelle Hogan, Don Hearn, Session 11) |
| FR-DPO-013 | Dashboard shows credit-hold / past-due banner when account is on hold | Prominent red/orange banner states credit-hold status; ordering CTAs are disabled or hidden when credit hold is active; past-due is a yellow warning; credit hold is red with explicit block message (per C G, Session 11) | P0 | Not built | SRC-DPO-009 (C G, Session 11) |
| FR-DPO-014 | Credit-hold/past-due change triggers configurable notifications | When an account moves to past-due, notify configurable recipients (TM, RD, accounting user); when account is placed on credit hold, notify same roster; Dynamic AQS controls the notification roster (C G, Session 11: "we need to have control of that notification process") | P1 | Not built | SRC-DPO-009 (C G, Don Hearn, Michelle Hogan, Session 11) |
| FR-DPO-015 | Dashboard shows recent product files for quick access | Up to 3 recently-available downloadable assets shown on dashboard cards with one-click download | P2 | Built | SRC-DPO-003 |
| FR-DPO-016 | Payment decline alert displayed on dashboard — ⚠️ CORRECTED 2026-06-18: candidate, not confirmed in-scope; depends on parked payment processing (see Scope corrections) | When an ACH or credit card payment fails, a banner or notification prompts the dealer to contact Dynamic AQS to update payment method (Michelle Hogan, Session 11) | P2 | Not built | SRC-DPO-009 (Michelle Hogan, Session 11) |

### 6.3 Catalog & Product Browse

| ID | Requirement | Acceptance Criteria | Priority | Build Status | Source(s) |
|----|------------|---------------------|----------|-------------|-----------|
| FR-DPO-020 | Dealer sees only the product catalog assigned to their account | Catalog is resolved from affinity-group / ownership-group / region rules; a dealer logged in as ARS sees ARS-branded products; a dealer logged in as Next Star sees Next Star branding; no cross-group product leakage | P0 | Built | SRC-DPO-004, SRC-DPO-007, SRC-DPO-008 |
| FR-DPO-021 | Catalog can be searched by SKU, product name, description, or category | Search input matches across SKU, displayName, shortDescription, longDescription, categoryName, familyName, asset titles, file names | P0 | Built | SRC-DPO-004 |
| FR-DPO-022 | Catalog can be filtered by category, brand, family, file type, and file availability | Dropdowns for category / brand / family / file-type; segmented control for all products vs files-available; all filters combinable and clearable | P1 | Built | SRC-DPO-004 |
| FR-DPO-023 | Product card shows SKU, display name, category, short description, brand label, and available file count | Each product card in the grid renders these fields; "N files available" with link to full detail | P1 | Built | SRC-DPO-004 |
| FR-DPO-024 | Product detail shows long description, spec summary, and all asset files grouped by role | Full detail page with files section (grouped by role: install guide, spec sheet, marketing material, etc.) and product-details section | P1 | Built | SRC-DPO-005 |
| FR-DPO-025 | Dealer can download product assets (spec sheets, install guides, brochures) | Asset download button opens/downloads file from CloudFront URL; loading state shown during request | P0 | Built | SRC-DPO-004, SRC-DPO-005 |
| FR-DPO-026 | Dealer can mark products as favorites | Favorite toggle on product card and detail page; toggled state persists per user; favorite count visible on cards | P2 | Built | SRC-DPO-004, SRC-DPO-007 |
| FR-DPO-027 | Internal CRM admin must select dealer group before viewing products to prevent wrong-brand asset sharing | Product management view requires dealer-group selection first so TMs cannot accidentally share wrong-branded spec sheets (C G, Session 11: "choose dealer group first, that way our team member doesn't make a mistake") | P1 | Not built (internal CRM scope) | SRC-DPO-009 (C G, Session 11) |
| FR-DPO-028 | Asset download from TM's account view is group-context-aware | When a TM sends a spec sheet from within an account, the system uses that account's affinity group to serve the correct branded file — preventing wrong-logo sends | P1 | Not built | SRC-DPO-009 (C G, Michelle Hogan, Session 11) |

### 6.4 Cart & Checkout

| ID | Requirement | Acceptance Criteria | Priority | Build Status | Source(s) |
|----|------------|---------------------|----------|-------------|-----------|
| FR-DPO-030 | Dealer can add products to a persistent cart | Add to cart from catalog or product detail; quantity editable in cart; cart persists across session within a single session; cart state visible in portal navigation | P0 | Not built | SRC-DPO-009 (Ahmad Hassan demo, Session 11) |
| FR-DPO-031 | Cart shows account-context pricing (price class from Acumatica) | Line-item prices derived from dealer's assigned price class, synced from Acumatica nightly (or on admin trigger); prices are not fetched live at checkout to avoid ERP dependency (Dan Harshbarger, Session 7) | P0 | Not built | SRC-DPO-001 (Dan Harshbarger), SRC-DPO-010 |
| FR-DPO-032 | Billing address is locked at checkout; dealer cannot change it | Billing address field is read-only, populated from Acumatica; explicit label "Locked — contact Dynamic AQS to update" (Dan Harshbarger confirmed in Session 7: "agreed" to billing address lock; built in Account Center UI) | P0 | Partial (UI note built; checkout lock not built) | SRC-DPO-001 (Dan Harshbarger), SRC-DPO-006 |
| FR-DPO-033 | Dealer selects shipping address from their account's registered locations | Shipping-address dropdown populated from dealer's `AccountLocation` records; primary location pre-selected; custom one-time address not allowed | P0 | Not built | SRC-DPO-009 (Ahmad Hassan demo, Session 11) |
| FR-DPO-034 | Checkout requires a PO number before order can be submitted | PO number field is required at checkout; the current Shopify flow requires a PO at checkout (Session 7 demo: "you need to put in a purchase order, you could check out") | P0 | Not built | SRC-DPO-001 (Dan Harshbarger, Session 7) |
| FR-DPO-035 | Dealer can select expedited shipping at checkout with estimated cost — ⚠️ CORRECTED 2026-06-18: PARKED/Phase-2; shipping was scoped to Acumatica (S2); no per-option cost delta confirmed (see Scope corrections) | Shipping options include standard (2–3 day) and expedited; estimated shipping cost shown per option; Samantha Marks proposed this in Session 7: "for the customer to choose shipping — if they needed it expedited, they have the options to select it" | P1 | Not built | SRC-DPO-001 (Samantha Marks, Session 7) |
| FR-DPO-036 | Requested delivery date field removed / not shown at checkout | C G and Don Hearn explicitly rejected this field in Session 11: "no, it's usually we tell all of our customers it's two to three days"; do not expose a delivery date picker to avoid unrealistic expectations | P0 | Not built (guard against accidental inclusion) | SRC-DPO-009 (C G, Don Hearn, Session 11) |
| FR-DPO-037 | Dealer can apply a gift-card / coupon code at checkout — ⚠️ CORRECTED 2026-06-18: candidate, not confirmed in-scope; depends on parked payment processing (see Scope corrections) | Code entry field at checkout; valid codes zero out the order total or apply a line-item discount; Dynamic AQS admin issues codes for contest winners; order clearly shows original value crossed out and discounted price (Michelle Hogan, Samantha Marks, Session 7) | P2 | Not built | SRC-DPO-001 (Dan Harshbarger, Michelle Hogan, Session 7) |
| FR-DPO-038 | Credit-hold accounts cannot place orders | If account has credit-hold status, checkout flow is blocked; error message directs dealer to contact Dynamic AQS; red banner visible on all portal pages when on hold | P0 | Not built | SRC-DPO-009 (C G, Session 11) |
| FR-DPO-039 | Order placement sends order to Acumatica | On successful checkout, a sales order is created in Acumatica matched by customer ID (not email); Acumatica returns an order/reference number; Pulse stores the reference and surfaces it in order history | P0 | Not built | SRC-DPO-001 (Dan Harshbarger, Samantha Marks, Session 7); SRC-DPO-010 |
| FR-DPO-040 | Order placement sends confirmation email to dealer | Email confirmation sent to the user who placed the order; shared Dynamic AQS mailbox also notified (current Shopify behaviour: "sends an email to the customer and to our group" — Dan Harshbarger, Session 7) | P1 | Not built | SRC-DPO-001 (Dan Harshbarger, Session 7) |

### 6.5 Order History & Tracking

| ID | Requirement | Acceptance Criteria | Priority | Build Status | Source(s) |
|----|------------|---------------------|----------|-------------|-----------|
| FR-DPO-050 | Dealer can view company-wide order history, not just their own orders | Order history shows all orders placed by any user at the dealer's company (parent account level); this was the explicit Shopify pain point: "they only see their own orders in shopify" (Dan Harshbarger, Session 7) | P0 | Not built | SRC-DPO-001 (Dan Harshbarger, Session 7) |
| FR-DPO-051 | Order history shows item list, quantities, order date, status, and order total | Each order row shows: date, items ordered, quantities, total value, order status, who placed it | P0 | Not built | SRC-DPO-001 (Dan Harshbarger, Session 7) |
| FR-DPO-052 | Order history can be filtered by date range (not just year) | Date-range filter including year, quarter, custom range; C G in Session 11: "it would be nice to have a couple of more parameters — like just quarters one and two" | P1 | Not built | SRC-DPO-009 (C G, Michelle Hogan, Session 11) |
| FR-DPO-053 | Order history shows shipment tracking numbers and carrier link | Each shipped order shows tracking number with a deep-link to the carrier's tracking page; C G (Session 11): "that is gonna save us a lot of calls"; estimated delivery date shown where available | P0 | Not built | SRC-DPO-009 (Ahmad Hassan, C G, Don Hearn, Session 11) |
| FR-DPO-054 | Active shipments panel shows in-transit orders with delivery status | Separate view for in-transit orders with status badges: Out for Delivery / In Transit / Delivered / Delayed (Michelle Hogan, Session 11: "I love the colors — delivered, delayed red") | P1 | Not built | SRC-DPO-009 (Michelle Hogan, Ahmad Hassan, Session 11) |
| FR-DPO-055 | Dealer can reorder from a prior order with one click | "Reorder" action on any prior order re-adds the same line items to the cart; PO number must be updated; C G (Session 11): "there you go Michelle — you asked this" | P1 | Not built | SRC-DPO-009 (Michelle Hogan, Ahmad Hassan, C G, Session 11) |
| FR-DPO-056 | Order history shows payment method used per order | Payment method label (credit card / ACH / check) visible per order (Ahmad Hassan demo, Session 11) | P2 | Not built | SRC-DPO-009 (Ahmad Hassan, Session 11) |

### 6.6 Invoices & Account Financials

| ID | Requirement | Acceptance Criteria | Priority | Build Status | Source(s) |
|----|------------|---------------------|----------|-------------|-----------|
| FR-DPO-060 | Dealer can view all company invoices with status | Invoice list shows invoice number, date, amount, status (Paid / Pending / Overdue); sourced from Acumatica; current state: "you can't see invoices in shopify" (Dan Harshbarger, Session 7) | P0 | Not built | SRC-DPO-001 (Dan Harshbarger, Session 7) |
| FR-DPO-061 | Dealer can download individual invoices as PDF | Download action on each invoice row; links to Acumatica-generated invoice PDF or Pulse-generated equivalent | P0 | Not built | SRC-DPO-009 (Ahmad Hassan, Session 11) |
| FR-DPO-062 | Invoice list supports date-range filter | Year, quarter, custom date range filter on invoice list; used by dealers to confirm rebate totals (C G, Session 11) | P1 | Not built | SRC-DPO-009 (C G, Michelle Hogan, Session 11) |
| FR-DPO-063 | Invoice list shows total invoiced, total paid, and outstanding balance | Summary row at top of invoice list: Total Invoiced (period), Total Paid, Outstanding; Michelle Hogan, Session 11: "total invoice paid and pending and overdue — they can see account settlement" | P1 | Not built | SRC-DPO-009 (Ahmad Hassan, Session 11) |
| FR-DPO-064 | Rebate-eligible spend is calculated excluding shipping | When dealers view their spend summary for rebate calculations, shipping charges are excluded from the rebate-eligible total; Michelle Hogan (Session 11): "they do not get rebates if they paid any shipping — I don't want to get a bunch of calls" | P1 | Not built | SRC-DPO-009 (Michelle Hogan, Session 11) |

### 6.7 Account Center & User Management

| ID | Requirement | Acceptance Criteria | Priority | Build Status | Source(s) |
|----|------------|---------------------|----------|-------------|-----------|
| FR-DPO-070 | Account Center shows company portal status, active user count, and Dynamic AQS account team | Status badge, active/total user count, territory, region, shipping center, TM name, RD name | P1 | Built | SRC-DPO-006 |
| FR-DPO-071 | Account Health panel displays locked billing-address note and links to Dynamic AQS support | Billing address changes directed to Dynamic AQS; account status, documents, and billing all show "contact Dynamic AQS" | P1 | Built | SRC-DPO-006 |
| FR-DPO-072 | Dealer company contacts list is visible in Account Center | List of company contacts with name, title, email, phone; primary contact flagged | P1 | Built | SRC-DPO-006 |
| FR-DPO-073 | Dealer company locations list is visible in Account Center | List of registered locations with city, state, country; primary location flagged; these locations also populate shipping address at checkout | P1 | Built | SRC-DPO-006 |
| FR-DPO-074 | Dealer portal shows payment terms (e.g. Net 30) and credit limit visibly | Michelle Hogan (Session 11): "can we have payment terms visible to them like net 30, credit limit $10,000?" — these values are surfaced from Acumatica account data in the Account Center or dashboard | P2 | Not built | SRC-DPO-009 (Michelle Hogan, Session 11) |
| FR-DPO-075 | Portal user access is role-scoped: admin can manage company users; purchasing/accounting/viewer cannot | Admin role (Account Access) has invite/pause/restore actions; all other roles see read-only view; Dynamic AQS manages primary-owner and admin-role users | P0 | Built | SRC-DPO-006 |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement | Source |
|----|----------|------------|--------|
| NFR-DPO-001 | Performance | Catalog page must load within 3 seconds on standard broadband; first page load of dashboard must complete in under 2 seconds | (inferred standard) |
| NFR-DPO-002 | Performance | Pricing data served from nightly-synced local cache, not live Acumatica queries at checkout; Dan Harshbarger, Session 7: "I don't want every order to be waiting for a response from Acumatica" | SRC-DPO-001 |
| NFR-DPO-003 | Security / AuthZ | All dealer portal routes require authenticated `DEALER_PORTAL_USER` session; internal Pulse users cannot access dealer routes; session validated server-side per request | SRC-DPO-002 |
| NFR-DPO-004 | Security / AuthZ | Role-based route guards: `purchasing` role cannot reach Account Center user-management actions; `accounting` role cannot place orders; `viewer` has read-only access across all surfaces | SRC-DPO-003, SRC-DPO-006 |
| NFR-DPO-005 | Security / AuthZ | Billing-address field is server-enforced as read-only; any attempt to POST a changed billing address for an order is rejected by the API | SRC-DPO-001 |
| NFR-DPO-006 | Security / AuthZ | Credit-hold status is enforced server-side; a POST to place-order is rejected if the account's credit-hold flag is active, regardless of client-side state | SRC-DPO-009 |
| NFR-DPO-007 | Scalability | Catalog system supports full product catalog (3,000+ variants) without Shopify's 100-variant ceiling; Dan Harshbarger, Session 7: "it's a hundred variants and it's all manual edits" | SRC-DPO-001 |
| NFR-DPO-008 | Availability | Dealer portal should be available 99.5% uptime; ordering downtime directly impacts revenue; Shopify carries 45% of total company sales | SRC-DPO-001 (Dan Harshbarger, Session 7) |
| NFR-DPO-009 | Auditability | All order placement events are logged with actor user ID, account ID, timestamp, and Acumatica order reference; all billing-address-change attempts (even rejected) are audit-logged | (inferred standard) |
| NFR-DPO-010 | Auditability | Portal user invite, activation, pause, and restore events are all audit-logged with actor and timestamp | SRC-DPO-008 |
| NFR-DPO-011 | Accessibility | Dealer portal pages meet WCAG 2.1 AA standards; color-coded status badges (credit hold red / past-due yellow) must have text labels, not color alone | (inferred standard) |
| NFR-DPO-012 | Observability | Catalog resolution diagnostics (affinity-group match, ownership-group match, rule applied, warnings) are logged per request and available to internal admin via diagnostics endpoint | SRC-DPO-007, SRC-DPO-008 |
| NFR-DPO-013 | Data Retention | Order history and invoices sourced from Acumatica are displayed for at least the prior 3 years; YTD spend calculation is real-time from Acumatica data | (inferred standard) |
| NFR-DPO-014 | Observability | Failed Acumatica order-sync events generate an internal error queue for Ops review; mirrors the current Shopify "stuck orders" pattern (Dan Harshbarger, Session 7) | SRC-DPO-001 |

---

## 8. Assumptions

| ID | Assumption |
|----|-----------|
| ASM-DPO-001 | Pricing changes at most once per year; a nightly or admin-triggered sync from Acumatica to a local pricing cache is sufficient for accurate checkout pricing. (Dan Harshbarger, Session 7: "it changes once a year… maybe at midnight, you could go update the prices") |
| ASM-DPO-002 | Dealers are identified in Acumatica by a stable customer ID (`acumaticaCustomerId`); order creation uses the customer ID — not email — to prevent the email-mismatch error queue in the current Shopify integration. (Michelle Hogan confirmed desire for customer-ID matching in Session 7) |
| ASM-DPO-003 | A single affinity group / ownership group determines the dealer's catalog view and price class; a dealer cannot have ambiguous group membership that changes their catalog mid-session. |
| ASM-DPO-004 | Dynamic AQS internal staff manage billing-address records in Acumatica; the dealer portal exposes those read-only and never allows dealer-side edits. |
| ASM-DPO-005 | Shipping cost at checkout is either (a) displayed as an estimate based on historical algorithm or (b) not shown until the order is processed in Acumatica — the final approach is a Phase 2 decision pending carrier-API certification. |
| ASM-DPO-006 | Gift-card / coupon codes are issued by Dynamic AQS admin through a back-office tool; the portal only redeems them at checkout; code generation is not a dealer-facing feature. |
| ASM-DPO-007 | Acumatica is the system of record for invoice and order financial truth; Pulse displays Acumatica-sourced data with a `lastSyncedAt` staleness indicator. |
| ASM-DPO-008 | The portal is web-only for Phase 1; no native mobile app for ordering (dealers use the web portal on desktop or mobile browser). |
| ASM-DPO-009 | Tracking numbers are provided by Acumatica after fulfillment; there is a human fulfillment step before tracking appears; dealers will see "awaiting fulfillment" until Acumatica provides a tracking number. (C G, Session 11: "there's a human element to it") |

---

## 9. Open Questions

| ID | Question | Impact | Decision Owner |
|----|---------|--------|---------------|
| OQ-DPO-001 | Should dealer portal access be gated on CIS completion or on first order? The PRD-Lead-To-Dealer document left this explicitly open: "open design discussion on 16 Feb 2026" — it remains unresolved. | Determines when portal provisioning is triggered in the lead-to-customer workflow | C G / Dan Harshbarger |
| OQ-DPO-002 | Is an estimated shipping cost displayed at checkout (historical algorithm) or is shipping added post-order by Acumatica? Dan Harshbarger proposed an algorithm but it was not finalised. | Checkout UX completeness; dealer expectation setting | Dan Harshbarger / Operations |
| OQ-DPO-003 | What is the exact credit-hold trigger from Acumatica? Is there a specific field / flag on the customer record that Pulse reads? | Implementation of credit-hold banner and order block | Dan Harshbarger / Finance / Architecture |
| OQ-DPO-004 | What exactly is the "contest winner" gift-card / coupon-code workflow? Who generates codes, what denominations, single-use or multi-use, do they expire? | FR-DPO-037 implementation scope | Michelle Hogan / Dan Harshbarger |
| OQ-DPO-005 | Should the year-to-date spend graph on the dealer dashboard break out by product category (air cleaner / UV / humidifier / replacement parts)? Don Hearn suggested a monthly-bar graph; Michelle Hogan suggested category breakdown. | Dashboard scope for dealers | C G / Product |
| OQ-DPO-006 | When a dealer places an order with expedited shipping after 3 pm, is there a cut-off time warning at checkout? Dan Harshbarger noted the FedEx pickup-time complication. | Expedited shipping UX (FR-DPO-035) | Operations / Dan Harshbarger |
| OQ-DPO-007 | Should the Pulse portal surface a Contractor Commerce / Filter Fetch data feed for dealers who want to see their own market data? Dan Harshbarger named this as a "brainstorming idea" — is it in-scope for any phase? | Future portal scope | Dan Harshbarger / C G |
| OQ-DPO-008 | What is the definitive list of Dynamic AQS price classes (Dan and Don estimated 5–8, Michelle said "more than that")? This determines the complexity of the catalog rule system. | Catalog rule configuration scope | Dan Harshbarger / Finance |

---

## 10. Requirement–Source Traceability Matrix

| FR/NFR ID | SRC ID | Session |
|-----------|--------|---------|
| FR-DPO-001 | SRC-DPO-002, SRC-DPO-007 | (built) |
| FR-DPO-002 | SRC-DPO-008 | (built) |
| FR-DPO-003 | SRC-DPO-006 | (built) |
| FR-DPO-004 | SRC-DPO-006 | (built) |
| FR-DPO-005 | SRC-DPO-008 | (built) |
| FR-DPO-006 | SRC-DPO-007 | (built) |
| FR-DPO-010 | SRC-DPO-003 | (built) |
| FR-DPO-011 | SRC-DPO-003 | (built) |
| FR-DPO-012 | SRC-DPO-009 | Session 11 |
| FR-DPO-013 | SRC-DPO-009 | Session 11 |
| FR-DPO-014 | SRC-DPO-009 | Session 11 |
| FR-DPO-015 | SRC-DPO-003 | (built) |
| FR-DPO-016 | SRC-DPO-009 | Session 11 |
| FR-DPO-020 | SRC-DPO-004, SRC-DPO-007, SRC-DPO-008 | (built) |
| FR-DPO-021 | SRC-DPO-004 | (built) |
| FR-DPO-022 | SRC-DPO-004 | (built) |
| FR-DPO-023 | SRC-DPO-004 | (built) |
| FR-DPO-024 | SRC-DPO-005 | (built) |
| FR-DPO-025 | SRC-DPO-004, SRC-DPO-005 | (built) |
| FR-DPO-026 | SRC-DPO-004, SRC-DPO-007 | (built) |
| FR-DPO-027 | SRC-DPO-009 | Session 11 |
| FR-DPO-028 | SRC-DPO-009 | Session 11 |
| FR-DPO-030 | SRC-DPO-009 | Session 11 |
| FR-DPO-031 | SRC-DPO-001, SRC-DPO-010 | Session 7 |
| FR-DPO-032 | SRC-DPO-001, SRC-DPO-006 | Session 7 |
| FR-DPO-033 | SRC-DPO-009 | Session 11 |
| FR-DPO-034 | SRC-DPO-001 | Session 7 |
| FR-DPO-035 | SRC-DPO-001 | Session 7 |
| FR-DPO-036 | SRC-DPO-009 | Session 11 |
| FR-DPO-037 | SRC-DPO-001 | Session 7 |
| FR-DPO-038 | SRC-DPO-009 | Session 11 |
| FR-DPO-039 | SRC-DPO-001, SRC-DPO-010 | Session 7 |
| FR-DPO-040 | SRC-DPO-001 | Session 7 |
| FR-DPO-050 | SRC-DPO-001 | Session 7 |
| FR-DPO-051 | SRC-DPO-001 | Session 7 |
| FR-DPO-052 | SRC-DPO-009 | Session 11 |
| FR-DPO-053 | SRC-DPO-009 | Session 11 |
| FR-DPO-054 | SRC-DPO-009 | Session 11 |
| FR-DPO-055 | SRC-DPO-009 | Session 11 |
| FR-DPO-056 | SRC-DPO-009 | Session 11 |
| FR-DPO-060 | SRC-DPO-001 | Session 7 |
| FR-DPO-061 | SRC-DPO-009 | Session 11 |
| FR-DPO-062 | SRC-DPO-009 | Session 11 |
| FR-DPO-063 | SRC-DPO-009 | Session 11 |
| FR-DPO-064 | SRC-DPO-009 | Session 11 |
| FR-DPO-070 | SRC-DPO-006 | (built) |
| FR-DPO-071 | SRC-DPO-006 | (built) |
| FR-DPO-072 | SRC-DPO-006 | (built) |
| FR-DPO-073 | SRC-DPO-006 | (built) |
| FR-DPO-074 | SRC-DPO-009 | Session 11 |
| FR-DPO-075 | SRC-DPO-006 | (built) |
| NFR-DPO-001 | — | (inferred standard) |
| NFR-DPO-002 | SRC-DPO-001 | Session 7 |
| NFR-DPO-003 | SRC-DPO-002 | (built) |
| NFR-DPO-004 | SRC-DPO-003, SRC-DPO-006 | (built) |
| NFR-DPO-005 | SRC-DPO-001 | Session 7 |
| NFR-DPO-006 | SRC-DPO-009 | Session 11 |
| NFR-DPO-007 | SRC-DPO-001 | Session 7 |
| NFR-DPO-008 | SRC-DPO-001 | Session 7 |
| NFR-DPO-009 | — | (inferred standard) |
| NFR-DPO-010 | SRC-DPO-008 | (built) |
| NFR-DPO-011 | — | (inferred standard) |
| NFR-DPO-012 | SRC-DPO-007, SRC-DPO-008 | (built) |
| NFR-DPO-013 | — | (inferred standard) |
| NFR-DPO-014 | SRC-DPO-001 | Session 7 |

---

## 11. Not-Built / Gap Summary

The following requirements are confirmed in-scope from discovery transcripts and are **not yet built** in the current codebase:

| FR ID | Summary |
|-------|---------|
| FR-DPO-012 | Year-to-date spend dashboard with monthly graph and rebate-excluded shipping calculation |
| FR-DPO-013 | Credit-hold / past-due banner on dealer dashboard with order block |
| FR-DPO-014 | Configurable credit-hold/past-due notifications to TM/RD/accounting |
| FR-DPO-016 | Payment-decline alert on dealer dashboard |
| FR-DPO-027 | Internal CRM product view requires dealer-group selection first |
| FR-DPO-028 | TM account view serves group-context-correct branded asset when sharing |
| FR-DPO-030 | Cart (add to cart, quantity edit, persistent cart state) |
| FR-DPO-031 | Account-context pricing at checkout (price class from Acumatica nightly sync) |
| FR-DPO-032 | Billing-address locked at checkout (server-enforced; UI note exists) |
| FR-DPO-033 | Shipping address selection from account locations at checkout |
| FR-DPO-034 | PO number required at checkout |
| FR-DPO-035 | Expedited-shipping option at checkout with estimated cost |
| FR-DPO-036 | Delivery-date field must NOT be shown at checkout (guard) |
| FR-DPO-037 | Gift-card / coupon code redemption at checkout |
| FR-DPO-038 | Credit-hold enforcement — server-side block on order placement |
| FR-DPO-039 | Order placement creates sales order in Acumatica |
| FR-DPO-040 | Order confirmation email to dealer and Dynamic AQS mailbox |
| FR-DPO-050 | Company-wide order history (not just individual user orders) |
| FR-DPO-051 | Order history with items, quantities, dates, status, totals |
| FR-DPO-052 | Order history date-range filter (year, quarter, custom) |
| FR-DPO-053 | Tracking numbers with carrier deep-links in order history |
| FR-DPO-054 | Active-shipments panel with delivery-status badges |
| FR-DPO-055 | Reorder from prior order |
| FR-DPO-056 | Payment method displayed per order |
| FR-DPO-060 | Invoice list with status (paid / pending / overdue) |
| FR-DPO-061 | Invoice PDF download |
| FR-DPO-062 | Invoice date-range filter |
| FR-DPO-063 | Invoice summary totals (invoiced / paid / outstanding) |
| FR-DPO-064 | Rebate-eligible spend excluding shipping |
| FR-DPO-074 | Payment terms and credit limit visible in Account Center |
