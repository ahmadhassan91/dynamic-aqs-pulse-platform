# Acumatica ERP Integration PRD

## Document Control

| Field | Value |
|---|---|
| Module | Acumatica ERP Integration |
| Document Type | Master PRD |
| Version | 1.1 |
| Status | Draft — scope-accuracy corrections (2026-06-18): FR-ACU-029 "base price" source-of-truth scoped to identity fields + price class (base/list price originates in the external pricing engine, reflected via Acumatica — cross-ref Pricing §0); push-notification availability qualified as documented-in-2024-R2-docs, unconfirmed in the Dynamic AQS instance. Builds on the 2026-06-09 scope-confirmation pass |
| Owner | Product / Architecture |
| Priority | P0 (unblocking) |
| Sprint Sequence | Mostly PARKED — sandbox access and endpoint certification gate all active slices |
| Meeting Traceability | Discovery Session 1 (Feb 16 2026, Currie G, Ahmad Hassan, Faraz Sohail, Michelle Hogan, Dan Harshbarger, Donald Hearn); Session 2 (Feb 18 2026, Dan Harshbarger, Currie G, Ahmad Hassan); Session 3 (Feb 20 2026, Ahmad Hassan, Currie G, Dan Harshbarger, Michelle Hogan); Session 5 (Feb 25 2026, Samantha Marks, Currie G, Ahmad Hassan); Session 6 (Feb 27 2026, Currie G, Dan Harshbarger, Ahmad Hassan, Samantha Marks); Session 9 (Mar 13 2026, Currie G, Ahmad Hassan, Donald Hearn, Michelle Hogan, Dan Harshbarger); Session 10 (Mar 17 2026, Currie G, Samantha Marks, Ahmad Hassan); Session 11 (undated — To-Be Dealer Portal and Product Management, Currie G, Ahmad Hassan, Don Hearn, Michelle Hogan); Apr 13–20 2026 scope review (Currie G, Steve Mores, Betsy Eastman, Johan Ericsson, Ahmad Hassan, Faraz Sohail); Acumatica training PDFs I100/I300/I310 2024 R2 |
| Primary Companion Docs | `06_ACCOUNTS_CUSTOMERS_PRD.md`, `05_CONSIGNMENT_PRD.md`, `12_DEALER_PORTAL_ORDERING_PRD.md`, `07_CIS_CREDIT_ONBOARDING_PRD.md`, `11_PRICING_PRICE_UPDATE_PRD.md` |

---

## Scope corrections (2026-06-18)

The following LOW-severity scope-accuracy corrections were applied after the program-wide re-check of source-of-truth claims and inferred-from-docs assumptions against the cited transcripts and PDFs. No rows were deleted; substance is otherwise unchanged.

- **FR-ACU-029 — "base price" mis-scoped as Acumatica source-of-truth.** The requirement listed Acumatica as the source of truth for product `InventoryID`, `ItemClass`, **base price**, and unit of measure. Base/list price actually originates in the **external pricing engine** and is only *reflected via* Acumatica (cross-ref `11_PRICING_PRICE_UPDATE_PRD.md` §0, which established the pricing engine is separate from the ERP). Acumatica's truth should be scoped to the **identity fields** (`InventoryID`, `ItemClass`, UoM) plus the **price CLASS**, not the base/list price value itself. FR-ACU-029 is corrected accordingly.
- **Push-notification availability is inferred from generic 2024 R2 docs, not the Dynamic AQS instance.** The claim that Acumatica push notifications are available for real-time credit-hold / inventory monitoring (ASM-ACU-007, NFR-ACU-002, §4.2) is derived from the generic Acumatica 2024 R2 documentation (I300/I310 PDFs), not from the client's own instance. It must be **confirmed in the sandbox** before being relied upon; polling remains the certified fallback.

Full audit: `docs/SCOPE_ACCURACY_AUDIT_2026-06-18.md`.

---

## 1. Executive Summary

Acumatica is Dynamic AQS's system of financial and inventory record. Pulse CRM is the system of relationship, workflow, and people record. These two systems must coexist without creating double-truth: Acumatica owns orders, invoices, AR balances, credit limits, credit-hold flags, price classes, warehouse creation, inventory on-hand, transfer orders, purchase orders, and financial settlement. Pulse owns the lead funnel, account relationships, contacts, locations, territory, training cadence, consignment workflow, mobile field execution, and operational alerts.

The integration boundary is a deliberate architectural decision made in the discovery sessions and confirmed by business leadership (Currie G, Session 13/20 April 2026): "anything number-wise — orders, finance — will be housed by Acumatica and just reflected in Pulse. Anything to do with customer account data, names, phone numbers, email addresses, activity will be housed in Pulse and pushed to Acumatica for reflection."

At the date of this PRD (2026-06-09), all active Acumatica integration work is PARKED pending certified sandbox access. The `packages/acumatica` client library exists, the health-check endpoint is wired, and parked-status placeholders exist across the consignment, accounts, leads, and product-management modules. No live ERP entity creation, inventory query, or PO posting has been implemented. This PRD documents the full scope of what must be built when the sandbox is certified.

---

## 2. Source Inventory

| ID | Absolute Path | What It Sourced |
|---|---|---|
| SRC-ACU-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1 - 16th Feb 2026.md` | Architectural decision: Acumatica = financial truth, Pulse = relationship truth; customer push to Acumatica only on first order; credit-hold visibility in dealer portal |
| SRC-ACU-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md` | Manual Acumatica customer entry today, integration trigger debate (CIS vs first order), inventory master in Acumatica, price class in Acumatica, discount table data-quality issue |
| SRC-ACU-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/20 Feb session 3 _ Discovery session 3 _ Validations.md` | ERP sync gate confirmed (first order = trigger), pricing engine separate from ERP, Acumatica as pricing master, three outputs (Acumatica / portal / PDFs); integration handshake model |
| SRC-ACU-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/25 Feb 2026 Session 5.md` | Consignment warehouse creation in Acumatica (TR transfer order, receipt, inventory balance); Samantha walkthrough of warehouse and inventory master; BLUE form trigger for warehouse |
| SRC-ACU-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Fri 27th  Feb Session 6.md` | Sandbox access request (Ahmad Hassan + Dan Harshbarger); RESTful API confirmation; discount table extraction issue; sandbox promised next week; Shopify order sync model (hourly pull into Acumatica) |
| SRC-ACU-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/13th March Discovery Session 9.md` | Warehouse creation debate — Acumatica-first confirmed; territory change sync to Acumatica; Acumatica sandbox corrupt, Dan working to restore |
| SRC-ACU-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/17th March  session 10-To-Be consognment and App.md` | Warehouse creation must be Acumatica-first; Pulse triggers notification then syncs warehouse ID back; customer attributes (consignment free shipping) set in Acumatica customer record; PO creation through dealer portal; OData/REST capabilities discussion |
| SRC-ACU-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session _11 To-Be Dealer Portal, Product Management.md` | Product identity and price class pulled from Acumatica; dealer portal pricing fetched from Acumatica price books; credit-hold signal for dealer portal checkout block |
| SRC-ACU-009 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md` | System of record split confirmed for Steve Mores (executive); customer created in Acumatica only when first order is placed; pulse pushes customer data to Acumatica; numbers/orders stay in Acumatica |
| SRC-ACU-010 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/acumatica/src/client.ts` | Built: `AcumaticaClient` with login/logout (cookie-based session), `GET/POST/PUT/DELETE`, `healthCheck` (hits `$metadata`), auto-retry on 401 |
| SRC-ACU-011 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/acumatica/src/types.ts` | Built: `AcumaticaConfig` (baseUrl, apiVersion, company, username/password/accessToken); `AcumaticaRequestOptions` ($select/$expand/$filter via query params) |
| SRC-ACU-012 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/server.ts` | Built: health-check endpoint `/api/v1/health/acumatica`; `createAcumatica` factory wired from env; `getAdminIntegrationStatus` surfaces Acumatica health in admin dashboard |
| SRC-ACU-013 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/consignment/service.ts` | Built: `acumaticaStatus` enum (PARKED/PENDING/AVAILABLE/ERROR) on `ConsignmentSite`; audit entry with `acumaticaBoundary: 'parked_until_sandbox_and_certified_mappings'`; work item "Create Acumatica consignment warehouse when access is certified"; all ERP-touching steps marked parked |
| SRC-ACU-014 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/leads/service.ts` | Built: `acumaticaSyncStatus: 'parked'` field on lead workflow action audit entries; `firstOrderAt` timestamp captured |
| SRC-ACU-015 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/accounts/service.ts` | Built: readiness check "ERP activity" parked; document boundary "ERP orders, invoices, shipments" parked with message "parked until Acumatica access and mappings are certified" |
| SRC-ACU-016 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/product-management/service.ts` | Built: `acumaticaInventoryId`, `acumaticaItemClass`, `acumaticaLastSyncedAt` on products; seed-product reconciliation gate blocks publish until Acumatica mappings are certified |
| SRC-ACU-017 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/I100_IntegrationScenarios_2024R2.pdf` | Acumatica 2024 R2 integration services overview: integration scenarios (import/export), web services API, mobile REST API; CSV/Excel/MSSQL data providers; import/export scenario patterns for Customers, AR Invoices, Purchase Orders, Leads, Stock Items |
| SRC-ACU-018 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/I300_DataRetrievalWithOData_2024R2.pdf` | Acumatica OData endpoints: Generic Inquiry-based OData; DAC-based OData; push notifications for real-time monitoring; `$expand`, `$select`, `$filter` parameters; `$metadata` endpoint |
| SRC-ACU-019 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/I310_DataRetrievalRESTAPIBasics_2024R2 1.pdf` | Acumatica contract-based REST API (version `24.100.001` baseline); sign-in/sign-out (cookie session); `$expand`, `$select`, `$filter`; retrieving modified records; push notifications; customization projects for endpoint extension |
| SRC-ACU-020 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/config/src/env.ts` | Built: env config keys for `ACUMATICA_BASE_URL`, `ACUMATICA_API_VERSION`, `ACUMATICA_COMPANY`, `ACUMATICA_USERNAME`, `ACUMATICA_PASSWORD`, `ACUMATICA_ACCESS_TOKEN` |

Note: The Acumatica training PDFs (SRC-ACU-017, SRC-ACU-018, SRC-ACU-019) were readable via the Read tool (cover pages and tables of contents were legible). No DOCX files were in this meeting folder — only .md and .pdf sources. The `NAW.DAQS` custom extension package could not be confirmed from available sources; it is treated as an open question.

---

## 3. Overview

### 3.1 System Boundary

```
┌─────────────────────────────────────────────────────────────┐
│  PULSE CRM (relationship + workflow truth)                  │
│  - Lead funnel, CIS, onboarding readiness                   │
│  - Account profile, contacts, locations, lifecycle          │
│  - Territory, TM/RD assignment                              │
│  - Training scheduling and history                          │
│  - Consignment workflow, ROSE audit, PO clock               │
│  - Mobile field execution, voice notes                      │
│  - Dealer portal product catalog (enrichment layer)         │
│  - Operational alerts and dashboards                        │
└────────────────────┬────────────────────────────────────────┘
                     │  Contract-based REST API v24.100.001
                     │  + OData (Generic Inquiry / DAC-based)
                     │  + Push Notifications (real-time events)
┌────────────────────▼────────────────────────────────────────┐
│  ACUMATICA ERP (financial + inventory truth)                │
│  - Customer record (CustomerID, CustomerClass)              │
│  - Price class, payment terms, AR balance, credit limit     │
│  - Credit-hold status                                       │
│  - Inventory on-hand by warehouse                           │
│  - Transfer orders, transfer receipts                       │
│  - Purchase orders (POs), sales orders                      │
│  - Invoices, credit memos, financial settlement             │
│  - Warehouse / location master                              │
│  - Stock item master (InventoryID, ItemClass)               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Governing Decision (verbatim)

Currie G, Session 13/20 April 2026 (SRC-ACU-009):
> "We wanted to make sure there wasn't conflict of data. Anything number-wise — orders, finance, everything — will be housed by Acumatica and just reflected in Pulse. Anything to do with the customer account data — names, phone numbers, email addresses, activity — will be housed in Pulse and pushed to Acumatica for reflection."

Ahmad Hassan, Session 3 (SRC-ACU-003):
> "ERP sync execute only upon revenue event right … the system will validate the data and it will only push to the ERP when the revenue is even real — like when the customer places their first order. Then it will create an entry in the Acumatica ERP."

---

## 4. In-Scope

### 4.1 Integration Domains

| Domain | Direction | Trigger / Cadence | Priority | Status |
|---|---|---|---|---|
| Customer creation in Acumatica | Pulse → Acumatica | On first order activation | P0 | Parked |
| Customer profile sync (name, address, contacts) | Pulse → Acumatica | On Pulse account update | P1 | Parked |
| Credit-hold read | Acumatica → Pulse | Polling or push notification | P0 | Parked |
| Price class / dealer group read | Acumatica → Pulse | On account setup; periodic refresh | P0 | Parked |
| AR balance and credit limit read | Acumatica → Pulse | Periodic / on-demand | P1 | Parked |
| Order history read (orders, invoices, shipments) | Acumatica → Pulse | Periodic pull or push | P1 | Parked |
| Inventory on-hand read (consignment warehouse) | Acumatica → Pulse | Near-real-time polling | P0 | Parked |
| Transfer order / receipt read (consignment) | Acumatica → Pulse | Event-driven or polling | P0 | Parked |
| Consignment warehouse creation | Pulse notifies → Acumatica creates | On site ready-for-warehouse | P0 | Parked |
| Consignment warehouse ID sync-back | Acumatica → Pulse | After warehouse created in ERP | P0 | Parked |
| Consignment PO creation / linking | Pulse → Acumatica | On PO received confirmation | P0 | Parked |
| Consignment PURPLE inventory adjustment post | Acumatica | After Pulse PURPLE form approved | P1 | Parked |
| Consignment final settlement (SAND exit) | Acumatica | On Pulse exit approval | P1 | Parked |
| Stock item / product master sync | Acumatica → Pulse | One-time import + periodic delta | P0 | Partial (CSV import built; live API parked) |
| Dealer portal inventory availability check | Acumatica → Pulse | Real-time query at checkout | P1 | Parked |
| Dealer portal price resolution | Acumatica → Pulse | Per session / per product view | P0 | Parked |

### 4.2 Technical Interface

The Acumatica REST API is the primary integration interface, using the contract-based REST API (version `24.100.001`) as documented in I310 (SRC-ACU-019). The OData interfaces (SRC-ACU-018) are available for read-heavy reporting queries and delta-fetch patterns. Push notifications (I300 Part 3, I310 Part 3) are documented as available for real-time credit-hold and inventory monitoring — ⚠️ CORRECTED 2026-06-18: documented in 2024 R2 docs; availability in the Dynamic AQS instance unconfirmed (sandbox). The `packages/acumatica` client library is already built and supports both cookie-session login and Bearer token access.

---

## 5. Out-of-Scope

These items are permanently outside Pulse scope:

- Raw financial posting logic — Pulse triggers; Acumatica executes
- Invoice generation, payment processing, collections management
- Acumatica module configuration (GL, AR, AP, inventory setup)
- Shopify-to-Acumatica order synchronization (already runs independently, hourly, outside Pulse)
- Rebate calculation logic — stays in Acumatica
- Multi-entity parent/child financial rollup

---

## 6. Parked Dependencies (by design)

All active Acumatica integration work is gated on:

1. **Sandbox access** — Dan Harshbarger (Session 6, SRC-ACU-005) committed to providing a test environment; as of Session 9 (SRC-ACU-006) it was still corrupted. No sandbox credentials have been certified at this writing.
2. **Endpoint certification** — The specific Acumatica entity endpoints (Customer, Warehouse, TransferOrder, PurchaseOrder, InventoryBalance) and their field mappings must be verified in the sandbox before any production code is written.
3. **NAW.DAQS custom extension** — Dynamic AQS may have a customization project in Acumatica that extends the standard Customer and Warehouse entities with DAQS-specific fields. This is referenced implicitly in consignment attribute discussions (Session 10, SRC-ACU-007: "there are certain things that change dynamically within the customer record … consignment shipping is free") but has not been confirmed or documented. All field-mapping work must be done against the live instance with the customization layer active.
4. **Payment integration** — Moneris / eBizCharge vault is separate from Acumatica; Pulse holds tokenized references only. PCI/financial credentials are permanently out of Pulse scope.

---

## 7. Functional Requirements

### 7.1 Customer Creation Trigger (FR-ACU-001 – FR-ACU-007)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-ACU-001 | When a lead's `firstOrderAt` timestamp is set (first order activation event), Pulse shall queue a customer-creation payload to Acumatica containing: CustomerID (derived from account number), legal name, display name, primary billing address, primary contact name/email/phone, assigned price class, assigned payment terms | Customer record appears in Acumatica with all mapped fields; `acumaticaCustomerId` written back to Pulse account; `acumaticaSyncStatus` transitions from `parked` → `synced` | P0 | Not-built (parked) | SRC-ACU-001, SRC-ACU-002, SRC-ACU-003, SRC-ACU-009 |
| FR-ACU-002 | Customer-creation shall be idempotent — a duplicate trigger for the same account shall not create a second Acumatica customer record | Idempotency key (account number or source lead ID) checked before creation; duplicate returns existing `acumaticaCustomerId` | P0 | Not-built (parked) | SRC-ACU-003 |
| FR-ACU-003 | If Acumatica customer creation fails, Pulse shall retry up to 3 times with exponential back-off and surface a sync-error badge on the account detail page | Failure visible in admin integration dashboard; retry count and last-error stored on account record | P0 | Not-built (parked) | SRC-ACU-010 (error types built), SRC-ACU-012 (health endpoint built) |
| FR-ACU-004 | The `acumaticaSyncStatus` field on the account shall carry states: `parked` / `pending` / `synced` / `error` with `lastSyncedAt` and `lastError` | Status badge visible on account detail; admin can trigger manual re-sync | P0 | Partial (field exists in lead audit metadata as 'parked'; not yet surfaced on account contract) | SRC-ACU-014, SRC-ACU-015 |
| FR-ACU-005 | Upon successful customer creation, Pulse shall record the Acumatica `CustomerID` on the account record and link it permanently | `account.acumaticaCustomerId` populated and visible on account profile | P0 | Not-built (parked) | SRC-ACU-001, SRC-ACU-009 |
| FR-ACU-006 | When key account fields change in Pulse (legal name, billing address, primary contact, payment terms), Pulse shall sync the delta to the Acumatica customer record | Field-level change triggers an Acumatica PUT; audit log records sync event | P1 | Not-built (parked) | SRC-ACU-009 |
| FR-ACU-007 | A field-mapping specification document shall be completed in the Acumatica sandbox before any of FR-ACU-001 through FR-ACU-006 are built | Mapping doc reviewed by Dan Harshbarger and signed off; stored in `docs/roadmap/architecture/` | P0 | Not-built (OQ-ACU-01 is the gate) | SRC-ACU-005, SRC-ACU-007 |

### 7.2 Credit-Hold Read (FR-ACU-008 – FR-ACU-012)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-ACU-008 | Pulse shall read the credit-hold flag from the Acumatica customer record and display it on the account detail page for Admin/Ops, Finance, RD, and TM roles | Credit-hold badge visible when Acumatica `CreditHold = true`; cleared when false | P0 | Not-built (parked) — placeholder card shown in `CustomerDetail.tsx` | SRC-ACU-001, SRC-ACU-008 |
| FR-ACU-009 | When a dealer portal user attempts checkout and the account has `creditHold = true`, the portal shall block the order and display a clear message | Checkout button disabled; message shown: "Your account is on credit hold — please contact [Dynamic AQS contact]"; alert sent to TM and RD | P0 | Not-built (parked) | SRC-ACU-008 |
| FR-ACU-010 | When an account transitions to credit-hold in Acumatica, Pulse shall send an operational alert to the assigned TM and RD within the alert polling interval | Alert record created in `OperationalAlert` table; delivery via Microsoft Graph when dispatcher is live | P0 | Not-built (parked) | SRC-ACU-001, SRC-ACU-008 |
| FR-ACU-011 | Credit-hold status read shall use either polling (configurable interval, default 15 minutes) or Acumatica push notifications (I300 Part 3 / I310 Part 3) whichever is certified first in sandbox | Response latency from Acumatica event to Pulse badge update within one polling interval | P1 | Not-built (parked) | SRC-ACU-018, SRC-ACU-019 |
| FR-ACU-012 | Every Acumatica-sourced status field in Pulse (credit-hold, balance, price class) shall carry `sourceRef`, `lastSyncedAt`, and `syncStatus` and show a stale-data warning if `lastSyncedAt > 30 minutes` | Stale warning visible on UI; suppressed when sync is current | P1 | Not-built (parked) | SRC-ACU-013 (pattern established in consignment) |

### 7.3 Price Class Read (FR-ACU-013 – FR-ACU-016)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-ACU-013 | Pulse shall read the customer's assigned price class (`CustomerClass` or `PriceClassID`) from Acumatica and store it on the account record | `account.priceClassCode` populated from Acumatica; visible to Admin/Ops and Finance roles | P0 | Partial (`priceClassCode` field exists in leads contract; not yet fetched from Acumatica live) | SRC-ACU-003, SRC-ACU-008, SRC-ACU-016 |
| FR-ACU-014 | The dealer portal product catalog shall resolve prices for a logged-in dealer using their Acumatica price class | Product prices shown match the price book for the dealer's `priceClassCode` | P0 | Not-built (parked) | SRC-ACU-008 |
| FR-ACU-015 | When a price class changes in Acumatica, Pulse shall re-fetch and update the account's `priceClassCode` within the polling interval | Price displayed in dealer portal reflects the new class within one sync cycle | P1 | Not-built (parked) | SRC-ACU-003 |
| FR-ACU-016 | Admin users shall be able to trigger a manual price-class sync from the account detail page | "Sync from Acumatica" action available on account; sync badge updates on completion | P1 | Not-built (parked) | SRC-ACU-008 |

### 7.4 Inventory / Warehouse Read (FR-ACU-017 – FR-ACU-023)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-ACU-017 | Pulse shall read consignment warehouse inventory on-hand from Acumatica and surface it as the `lastSyncedInventory` read model on the consignment site | Inventory balance per SKU visible on consignment site detail; `acumaticaLastSyncedAt` timestamp shown | P0 | Not-built (parked) | SRC-ACU-004, SRC-ACU-007 |
| FR-ACU-018 | Pulse shall read in-transit transfer orders for a consignment warehouse from Acumatica so the true-up review can account for shipments not yet received | Transfer order list shown in true-up review panel; each line shows: order reference, SKU, quantity, expected receipt date | P0 | Not-built (parked) | SRC-ACU-004, SRC-ACU-007 |
| FR-ACU-019 | Pulse shall never invent a `warehouseCode` or `acumaticaWarehouseId` — these must originate in Acumatica | `ConsignmentSite.acumaticaStatus` remains `PARKED` until Acumatica returns a real warehouse ID; admin-exception requires audit log | P0 | Built (rule enforced in `consignment/service.ts`) | SRC-ACU-013 |
| FR-ACU-020 | When a consignment site reaches `READY_FOR_WAREHOUSE` status, Pulse shall notify the designated Ops user (Samantha Marks role) and create a work item: "Create Acumatica consignment warehouse when access is certified" | Work item visible in consignment operational queue; `ConsignmentWorkItem.type = WAREHOUSE_SETUP` | P0 | Built (work item creation wired in `service.ts`) | SRC-ACU-013 |
| FR-ACU-021 | After warehouse creation in Acumatica, Ops shall enter the warehouse ID in Pulse (or a sync shall fetch it automatically); the warehouse ID shall be stored as `acumaticaWarehouseId` and `acumaticaStatus` shall transition to `READY` | `acumaticaStatus = READY`; site can proceed to BLUE form and baseline | P0 | Partial (fields exist; auto-sync not built) | SRC-ACU-013 |
| FR-ACU-022 | Dealer portal checkout shall query Acumatica for real-time inventory availability before order submission | Out-of-stock products display an "Out of stock" label; checkout blocked for zero-quantity items unless back-order is allowed | P1 | Not-built (parked) | SRC-ACU-002, SRC-ACU-008 |
| FR-ACU-023 | Consignment inventory value KPI (`inventoryValueBySiteParked`) shall remain a dashed "Parked" card in the Reports view until Acumatica inventory truth is live | Parked card shown with label "Parked — requires Acumatica inventory access" | P1 | Built (dashed card in Reports view) | SRC-ACU-013 |

### 7.5 Purchase Order / Financial Posting (FR-ACU-024 – FR-ACU-028)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-ACU-024 | Pulse shall never post a PO directly — it shall close its own work item (`poReceivedAt`) and request Acumatica to create or link the PO | `ConsignmentSite` transitions correctly; a `POST /PurchaseOrder` or `POST /SalesOrder` is sent to Acumatica; until confirmed, PO is `pending_acumatica` | P0 | Not-built (Pulse side wired; Acumatica post parked) | SRC-ACU-013 |
| FR-ACU-025 | Consignment inventory baseline shall not be recalculated until the Acumatica PO confirmation is received | `baselineEstablishedAt` update is gated on Acumatica confirmation response | P0 | Not-built (parked) | SRC-ACU-013 |
| FR-ACU-026 | PURPLE inventory adjustment (baseline change) shall be posted to Acumatica after Pulse approval | Acumatica inventory adjustment record created; Pulse baseline updated only after Acumatica confirmation | P1 | Not-built (Pulse approval wired; Acumatica post parked) | SRC-ACU-013 |
| FR-ACU-027 | SAND exit final settlement (PO, returns, credit memo) shall be posted to Acumatica as part of the exit workflow | Acumatica posts final PO and credit memo; warehouse closed in Acumatica; Pulse stamps `exitedAt` | P1 | Not-built (parked) | SRC-ACU-013 |
| FR-ACU-028 | Order history (orders, invoices, shipments, payments received) from Acumatica shall be displayed read-only on the account detail page in Pulse | ERP Orders tab shows up to 12 months of order history; each row links out to Acumatica for full detail | P1 | Not-built (parked) — placeholder card present in `CustomerDetail.tsx` | SRC-ACU-015 |

### 7.6 Product / Stock Item Sync (FR-ACU-029 – FR-ACU-033)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-ACU-029 | Acumatica shall be the source of truth for base product identity: `InventoryID`, `ItemClass`, base price, and unit of measure — ⚠️ CORRECTED 2026-06-18: Acumatica = truth for identity + price class; base/list price originates in the external pricing engine (see Pricing §0). | Products in Pulse carry `acumaticaInventoryId`, `acumaticaItemClass`, `acumaticaLastSyncedAt`; these are read-only in Pulse | P0 | Partial (fields built in product-management service; live API sync parked) | SRC-ACU-016 |
| FR-ACU-030 | Pulse shall enrich Acumatica base items with marketing descriptions, specifications, product images (AWS S3/CloudFront), and dealer-visibility rules | Enriched products are owned by Pulse and do not sync back to Acumatica | P0 | Built (product-management module) | SRC-ACU-008 |
| FR-ACU-031 | Pulse shall not publish any product to the dealer catalog until its Acumatica `InventoryID` mapping is certified | Publish action blocked if `acumaticaInventoryId` is null or from legacy CSV seed | P0 | Built (publish gate in `service.ts` line 350–360) | SRC-ACU-016 |
| FR-ACU-032 | A periodic delta-sync (recommended: nightly or on-demand) shall update Pulse product records from Acumatica when base identity fields change | Products updated; `acumaticaLastSyncedAt` refreshed; new items added; discontinued items flagged | P1 | Not-built (parked) | SRC-ACU-016, SRC-ACU-017 |
| FR-ACU-033 | The initial product import from Acumatica shall use the CSV export already available (`Acumatica Stock Items.xlsx`) to seed base records; live API sync shall replace the CSV path post-certification | CSV import path working; live API path parked | P0 | Built (CSV import path in `product-management/legacy-import.ts`) | SRC-ACU-016, SRC-ACU-017 |

### 7.7 API Patterns and Infrastructure (FR-ACU-034 – FR-ACU-040)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-ACU-034 | The `packages/acumatica` client shall be the only code that communicates directly with the Acumatica REST API; all modules use it via the service layer | No direct Acumatica HTTP calls outside `packages/acumatica`; client version is pinned to API `24.100.001` | P0 | Built | SRC-ACU-010, SRC-ACU-011 |
| FR-ACU-035 | The client shall support both cookie-based session auth (username + password) and Bearer token (OAuth/access token) | Both auth paths tested in sandbox; token refresh handled | P0 | Built | SRC-ACU-010 |
| FR-ACU-036 | The Acumatica health-check endpoint (`/api/v1/health/acumatica`) shall be maintained and surfaced in the admin integration dashboard | Health check returns `{ ok, statusCode, endpoint, checkedAt }` within 5 seconds; admin dashboard shows "Acumatica" status card | P0 | Built | SRC-ACU-012 |
| FR-ACU-037 | All Acumatica-originating data in Pulse shall carry `sourceRef`, `lastSyncedAt`, and `syncStatus`; a stale-data UI warning shall appear when `lastSyncedAt > 30 minutes` | Warning badge visible on relevant panels when stale | P0 | Partial (pattern defined in consignment; not yet applied to accounts/product) | SRC-ACU-013 |
| FR-ACU-038 | Read operations shall prefer OData Generic Inquiry-based queries for reporting/analytics and the contract-based REST API for transactional entity operations (create/update/read specific record) | Integration layer uses the appropriate interface per operation type | P1 | Not-built (parked) | SRC-ACU-018, SRC-ACU-019 |
| FR-ACU-039 | A retry/circuit-breaker pattern shall be implemented for all Acumatica outbound calls: 3 retries with exponential back-off; circuit opens after 5 consecutive failures; circuit-open events surfaced in admin dashboard | Admin dashboard shows circuit status; no user-facing request silently hangs longer than 10 seconds | P0 | Not-built (client has 401 auto-retry only; full circuit-breaker parked) | SRC-ACU-010 |
| FR-ACU-040 | All Acumatica API calls shall be logged with: operation type, entity, duration, response code, and any Acumatica error payload; logs accessible via standard observability tooling | Logs written at INFO level for success, WARN for retry, ERROR for failure; no secrets in log output | P0 | Not-built (parked) | SRC-ACU-010 |

### 7.8 Field-Mapping Specification (FR-ACU-041 – FR-ACU-045)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-ACU-041 | Before any entity is written to Acumatica, a field-mapping table shall be produced for: Customer, Contact, Location, Warehouse, TransferOrder, PurchaseOrder, InventoryBalance, StockItem | Mapping doc in `docs/roadmap/architecture/`; reviewed by Dan Harshbarger (or Finance lead) | P0 | Not-built | SRC-ACU-005, SRC-ACU-007 |
| FR-ACU-042 | The Customer creation mapping shall include: AccountNumber (Pulse) → CustomerID, legalName → CustomerName, primaryBillingAddress → BillToAddress, priceClassCode → CustomerPriceClass, paymentTerms → Terms, primaryContact.email → CustomerContact | Field mapping validated in sandbox against live entity schema | P0 | Not-built (parked) | SRC-ACU-001, SRC-ACU-002 |
| FR-ACU-043 | The Consignment Warehouse mapping shall include: `warehouseCode` (assigned by Acumatica) ↔ Pulse `acumaticaWarehouseId`; customer attributes set for consignment (e.g. free shipping flag) shall be documented | Attribute list confirmed with Samantha Marks; mapping in `docs/` | P0 | Not-built (parked) | SRC-ACU-007 |
| FR-ACU-044 | The `NAW.DAQS` custom extension package (if present in the Dynamic AQS Acumatica instance) shall be documented before any field mapping begins — custom fields on Customer, Warehouse, and StockItem entities must be discovered via the `$metadata` endpoint | `$metadata` endpoint queried in sandbox; custom fields listed in field-mapping doc | P0 | Not-built (OQ-ACU-02) | SRC-ACU-007, SRC-ACU-019 |
| FR-ACU-045 | The discount table extraction issue raised by Dan Harshbarger (discount code blank → record missing from discount table) shall be investigated during sandbox certification and a workaround or Acumatica configuration fix documented | Root cause identified; either Acumatica is configured to always populate discount code, or Pulse consumes both the discount table and a fallback query | P1 | Not-built (parked) | SRC-ACU-005 |

---

## 8. Non-Functional Requirements

| ID | Category | Requirement | Priority | SRC |
|---|---|---|---|---|
| NFR-ACU-001 | Performance | Customer creation push to Acumatica shall complete within 5 seconds under normal load; retry-eligible failures shall not block the Pulse user | P0 | (inferred standard) |
| NFR-ACU-002 | Performance | Credit-hold polling latency from Acumatica event to Pulse badge update shall not exceed 15 minutes; real-time push notification path shall reduce this to under 60 seconds when certified — ⚠️ CORRECTED 2026-06-18: documented in 2024 R2 docs; availability in the Dynamic AQS instance unconfirmed (sandbox). | P0 | SRC-ACU-018, SRC-ACU-019 |
| NFR-ACU-003 | Performance | Inventory read for consignment warehouse shall return within 3 seconds for single-warehouse queries; bulk inventory queries (for delta sync) shall use OData `$filter` for delta records to avoid full scans | P1 | SRC-ACU-018 |
| NFR-ACU-004 | Security / Auth | Acumatica credentials (username, password, access token) shall be stored only in environment variables or a secrets manager; never committed to source code or database | P0 | SRC-ACU-020 |
| NFR-ACU-005 | Security / Auth | API calls to Acumatica shall use the least-privilege service account — read-only for inventory/credit reads; write-capable only for Customer, Warehouse, and PO endpoints | P0 | (inferred standard) |
| NFR-ACU-006 | Security / Auth | Session cookies obtained from Acumatica login shall not be persisted beyond the request lifecycle; stateless operation shall prefer Bearer token when Acumatica OAuth is available | P1 | SRC-ACU-010 |
| NFR-ACU-007 | Scalability | The Acumatica client shall support concurrent requests up to the Acumatica API rate limit; request queuing shall prevent burst violations | P1 | (inferred standard) |
| NFR-ACU-008 | Availability | Acumatica unavailability shall degrade Pulse gracefully — parked-status placeholders already in place; no Pulse feature shall hard-fail because Acumatica is unreachable | P0 | SRC-ACU-013, SRC-ACU-015 |
| NFR-ACU-009 | Auditability | Every Pulse-to-Acumatica write operation (customer create, PO post, inventory adjustment) shall produce an audit entry in Pulse with: operation type, Acumatica entity ID, actor, timestamp, result | P0 | SRC-ACU-013 (audit pattern established in consignment) |
| NFR-ACU-010 | Auditability | Every Acumatica sync failure shall be logged with the full error payload (excluding credentials); the `AcumaticaClientError` type already carries `statusCode` and `payload` | P0 | SRC-ACU-010, SRC-ACU-011 |
| NFR-ACU-011 | Data Integrity | Pulse shall never overwrite Acumatica's financial truth — no writes to order, invoice, AR balance, or credit-limit fields | P0 | SRC-ACU-001, SRC-ACU-015 |
| NFR-ACU-012 | Data Integrity | Acumatica-sourced read data in Pulse shall carry `lastSyncedAt` and shall not be presented as live unless within the stale threshold; UI shall show stale warnings | P0 | SRC-ACU-013, SRC-ACU-037 |
| NFR-ACU-013 | Observability | The admin integration dashboard `/api/v1/admin/integration-status` shall surface Acumatica connectivity health with last-checked timestamp and error detail | P0 | SRC-ACU-012 |
| NFR-ACU-014 | Observability | Structured log entries for Acumatica operations shall include fields: `service=acumatica`, `operation`, `entity`, `durationMs`, `statusCode`, `acumaticaRef` | P1 | (inferred standard) |
| NFR-ACU-015 | Accessibility | Acumatica-sourced data displayed in Pulse (credit-hold badges, order history) shall meet WCAG 2.1 AA standards — colour-only status indicators shall include text labels | P1 | (inferred standard) |
| NFR-ACU-016 | Data Retention | Acumatica sync event logs shall be retained for 90 days minimum; audit entries linking Pulse actions to Acumatica references shall be retained for the life of the account | P1 | (inferred standard) |

---

## 9. Assumptions

| ID | Assumption | Rationale |
|---|---|---|
| ASM-ACU-001 | The first-order event in Pulse is the definitive trigger for customer creation in Acumatica; no earlier trigger (CIS submission, credit approval) will be used for this integration | Agreed in Sessions 1, 3, 9 after debate; "revenue event" = first order |
| ASM-ACU-002 | Acumatica 2024 R2 is the target version; the contract-based REST API version `24.100.001` and OData endpoints (Generic Inquiry and DAC-based) are available in the Dynamic AQS instance | I310 / I300 PDFs are 2024 R2; `client.ts` hardcodes `24.100.001` as default |
| ASM-ACU-003 | Dan Harshbarger (or a named Acumatica admin) will provide certified sandbox access before integration sprint begins; no integration code will be written against production Acumatica | Session 6 promise; repeated in Session 9 |
| ASM-ACU-004 | Acumatica is the sole warehouse creation authority; Pulse-origin warehouse creation is restricted to SUPER_ADMIN with mandatory audit log | Session 10 confirmed: "very few folks have access to create warehouses within Acumatica … locked down" |
| ASM-ACU-005 | Price class resolution (Affinity + Ownership + Region → Dealer Group → Price Class) is handled by Acumatica; Pulse only reads the resolved price class code and displays it | Session 11: "that is all coming from the Acumatica" |
| ASM-ACU-006 | The Dynamic AQS Acumatica instance may contain a custom `NAW.DAQS` customization project extending standard entities; this must be discovered via `$metadata` before any field mapping is written | Session 10 references customer attributes that are non-standard (consignment free-shipping flag) |
| ASM-ACU-007 | Acumatica push notifications (I300 Part 3 / I310 Part 3) will be used for credit-hold real-time monitoring once the sandbox is certified; polling remains the fallback — ⚠️ CORRECTED 2026-06-18: documented in 2024 R2 docs; availability in the Dynamic AQS instance unconfirmed (sandbox). | I310 documents push notification capability for item availability monitoring |
| ASM-ACU-008 | The Shopify-to-Acumatica hourly order sync remains outside Pulse scope and will continue to operate independently; Pulse does not interfere with or replace this sync | Session 6: "every hour Acumatica says you have any new orders for me and pulls them in" |
| ASM-ACU-009 | Financial data (AR balance, credit limit, invoice history) will be displayed read-only in Pulse and will not be editable; any changes must be made in Acumatica | Governing decision by Currie G confirmed in session 13/20 April |
| ASM-ACU-010 | The `packages/acumatica` package is the canonical integration boundary; no other package or module may make direct HTTP calls to Acumatica | Architectural decision; enforced via build rules |

---

## 10. Open Questions

| ID | Question | Impact | Decision Owner |
|---|---|---|---|
| OQ-ACU-01 | What is the current status of the Acumatica sandbox environment? Has the corruption issue from Session 9 been resolved, and who holds the access credentials? | All integration work is blocked until this is answered | Dan Harshbarger / IT |
| OQ-ACU-02 | Does the Dynamic AQS Acumatica instance have a `NAW.DAQS` or other customization project installed? If so, what custom fields are on Customer, Warehouse, and StockItem entities? | Field-mapping spec cannot be written without this | Dan Harshbarger / Acumatica Admin |
| OQ-ACU-03 | What is the exact trigger for customer creation in Acumatica — first order placed, or first order *submitted* (before fulfilment)? Some sessions implied "submitted order" as the trigger, not "fulfilled order" | Affects FR-ACU-001 implementation timing | Currie G / Dan Harshbarger |
| OQ-ACU-04 | Should Acumatica customer creation happen synchronously (blocking the Pulse first-order confirmation) or asynchronously (queued job)? If async, what is the acceptable lag? | Affects user experience at the moment of first-order activation | Architecture / Currie G |
| OQ-ACU-05 | Is the Acumatica REST API accessible over the public internet, or does Pulse require VPN or private network access? | Affects deployment architecture and network security rules | Dan Harshbarger / IT |
| OQ-ACU-06 | What Acumatica user/role should the Pulse integration service account use, and what permissions does it need (read-only vs read-write per entity)? | Affects security posture and least-privilege scoping | Dan Harshbarger / Acumatica Admin |
| OQ-ACU-07 | Is the discount table extraction problem (blank discount code = missing row) a known Acumatica configuration issue or a data-entry policy gap? | Affects order history and pricing display accuracy | Dan Harshbarger |
| OQ-ACU-08 | Should credit-hold alerts go only to TM and RD, or also to the dealer-portal user themselves? | Affects alert routing rules in FR-ACU-010 | Currie G / Samantha Marks |
| OQ-ACU-09 | What is the format and naming convention for `CustomerID` in Acumatica — auto-numbered, or derived from the Pulse account number? Session 2 noted both manual entry and auto-numbering as possibilities | Affects FR-ACU-001 and idempotency in FR-ACU-002 | Dan Harshbarger |
| OQ-ACU-10 | Will the Acumatica customer attributes for consignment (e.g. "consignment shipping is free") be set automatically by Pulse via the API, or manually by Samantha in Acumatica after warehouse creation? | Affects FR-ACU-043 scope | Samantha Marks |

---

## 11. Requirement → Source Traceability Matrix

| FR / NFR ID | SRC ID(s) | Session / Document |
|---|---|---|
| FR-ACU-001 | SRC-ACU-001, SRC-ACU-002, SRC-ACU-003, SRC-ACU-009 | Sessions 1, 2, 3, 13/20-Apr |
| FR-ACU-002 | SRC-ACU-003 | Session 3 |
| FR-ACU-003 | SRC-ACU-010, SRC-ACU-012 | Built client + health endpoint |
| FR-ACU-004 | SRC-ACU-014, SRC-ACU-015 | Leads service + accounts service |
| FR-ACU-005 | SRC-ACU-001, SRC-ACU-009 | Sessions 1, 13/20-Apr |
| FR-ACU-006 | SRC-ACU-009 | Session 13/20-Apr |
| FR-ACU-007 | SRC-ACU-005, SRC-ACU-007 | Sessions 6, 10 |
| FR-ACU-008 | SRC-ACU-001, SRC-ACU-008 | Sessions 1, 11 |
| FR-ACU-009 | SRC-ACU-008 | Session 11 |
| FR-ACU-010 | SRC-ACU-001, SRC-ACU-008 | Sessions 1, 11 |
| FR-ACU-011 | SRC-ACU-018, SRC-ACU-019 | I300, I310 PDFs |
| FR-ACU-012 | SRC-ACU-013 | Consignment service (stale-data pattern) |
| FR-ACU-013 | SRC-ACU-003, SRC-ACU-008, SRC-ACU-016 | Sessions 3, 11; product service |
| FR-ACU-014 | SRC-ACU-008 | Session 11 |
| FR-ACU-015 | SRC-ACU-003 | Session 3 |
| FR-ACU-016 | SRC-ACU-008 | Session 11 |
| FR-ACU-017 | SRC-ACU-004, SRC-ACU-007 | Sessions 5, 10 |
| FR-ACU-018 | SRC-ACU-004, SRC-ACU-007 | Sessions 5, 10 |
| FR-ACU-019 | SRC-ACU-013 | Consignment service (built rule) |
| FR-ACU-020 | SRC-ACU-013 | Consignment service (built work item) |
| FR-ACU-021 | SRC-ACU-013 | Consignment service (fields exist) |
| FR-ACU-022 | SRC-ACU-002, SRC-ACU-008 | Sessions 2, 11 |
| FR-ACU-023 | SRC-ACU-013 | Consignment service (parked KPI card) |
| FR-ACU-024 | SRC-ACU-013 | Consignment service (parked PO post) |
| FR-ACU-025 | SRC-ACU-013 | Consignment service (baseline gating) |
| FR-ACU-026 | SRC-ACU-013 | Consignment service (PURPLE parked) |
| FR-ACU-027 | SRC-ACU-013 | Consignment service (SAND parked) |
| FR-ACU-028 | SRC-ACU-015 | Accounts service (parked document boundary) |
| FR-ACU-029 | SRC-ACU-016 | Product management service |
| FR-ACU-030 | SRC-ACU-008 | Session 11 |
| FR-ACU-031 | SRC-ACU-016 | Product management service (publish gate) |
| FR-ACU-032 | SRC-ACU-016, SRC-ACU-017 | Product service; I100 |
| FR-ACU-033 | SRC-ACU-016, SRC-ACU-017 | Product service (CSV import); I100 |
| FR-ACU-034 | SRC-ACU-010, SRC-ACU-011 | `packages/acumatica` client |
| FR-ACU-035 | SRC-ACU-010 | `packages/acumatica` client |
| FR-ACU-036 | SRC-ACU-012 | `server.ts` health endpoint |
| FR-ACU-037 | SRC-ACU-013 | Consignment stale-data pattern |
| FR-ACU-038 | SRC-ACU-018, SRC-ACU-019 | I300, I310 PDFs |
| FR-ACU-039 | SRC-ACU-010 | Client (partial 401 retry only) |
| FR-ACU-040 | SRC-ACU-010 | Client (no structured logging yet) |
| FR-ACU-041 | SRC-ACU-005, SRC-ACU-007 | Sessions 6, 10 |
| FR-ACU-042 | SRC-ACU-001, SRC-ACU-002 | Sessions 1, 2 |
| FR-ACU-043 | SRC-ACU-007 | Session 10 |
| FR-ACU-044 | SRC-ACU-007, SRC-ACU-019 | Session 10; I310 `$metadata` |
| FR-ACU-045 | SRC-ACU-005 | Session 6 (Dan Harshbarger) |
| NFR-ACU-001 – 016 | Various; see NFR table | Inferred + SRC-ACU-010/013/018/019/020 |

---

## 12. Integration Readiness Checklist (Pre-Sprint Gate)

The following must all be TRUE before any Acumatica integration sprint is scheduled:

| # | Gate | Owner | Status |
|---|---|---|---|
| G1 | Acumatica sandbox environment accessible with valid credentials | Dan Harshbarger | Open |
| G2 | `$metadata` endpoint queried; entity schema captured for Customer, Warehouse, TransferOrder, PurchaseOrder, InventoryBalance, StockItem | Architecture | Open |
| G3 | NAW.DAQS custom extension presence confirmed or denied; custom fields listed | Dan Harshbarger / Acumatica Admin | Open |
| G4 | Field-mapping specification document written and approved by Dan Harshbarger or Finance lead | Product / Architecture | Open |
| G5 | Least-privilege service account created in Acumatica sandbox with documented permissions | Dan Harshbarger / IT | Open |
| G6 | Network path from Pulse API server to Acumatica confirmed (public internet vs VPN) | IT / Architecture | Open |
| G7 | Decision logged on OQ-ACU-03 (exact first-order trigger) | Currie G | Open |
| G8 | `packages/acumatica` client smoke-tested against sandbox `$metadata` endpoint; health-check returns `ok: true` | Engineering | Open |

---

## 13. Build Status Summary

| Slice | What Is Built | What Is Parked |
|---|---|---|
| Client library | `AcumaticaClient` with GET/POST/PUT/DELETE, cookie + Bearer auth, `healthCheck`, `AcumaticaClientError` | Circuit-breaker, structured logging, retry strategy beyond 401 |
| Config / env | All env keys wired; admin health endpoint live | Nothing |
| Health / admin | `/api/v1/health/acumatica`; admin integration dashboard Acumatica card | Nothing |
| Consignment | `acumaticaStatus` enum, `acumaticaWarehouseId` field, work item creation on READY_FOR_WAREHOUSE, parked audit metadata, inventory-value KPI dashed card | Warehouse creation post, inventory read, PO post, PURPLE/SAND settlement |
| Accounts | Parked dependency placeholder cards in `CustomerDetail.tsx`; readiness check for ERP activity | Customer creation post, credit-hold read, AR balance, order history |
| Leads | `acumaticaSyncStatus: 'parked'` on workflow audit; `firstOrderAt` timestamp | Actual customer creation trigger |
| Products | `acumaticaInventoryId`, `acumaticaItemClass`, `acumaticaLastSyncedAt` fields; CSV import path; publish gate blocking seed items | Live API sync, delta fetch |
| Price class | `priceClassCode` in leads contract | Live read from Acumatica |
| Credit-hold | Nothing | Full credit-hold read + alert |
| Dealer portal | Nothing | Inventory check, price resolution, credit-hold checkout block |
