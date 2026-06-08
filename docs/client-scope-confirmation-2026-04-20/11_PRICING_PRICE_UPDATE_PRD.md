# Pricing & Price Update PRD

## Document Control

| Field | Value |
|-------|-------|
| Module | Pricing & Price Update |
| Document Type | Master PRD |
| Version | 1.0 |
| Status | Draft |
| Owner | Product / Finance / Dan Harshbarger |
| Sprint Sequence | To be scheduled (downstream of Product Management and Dealer Portal) |
| Priority | P1 |
| Meeting Traceability | Session 2 (Feb 18 2026 — Dan Harshbarger, C G / Curry, Michelle Hogan, Adrienne Cardinale, Ahmad Hassan, Salman Shakeel); Session 3 (Feb 20 2026 — Dan Harshbarger, C G, Ahmad Hassan, Muhammad Majid, Michelle Hogan, Adrienne Cardinale); Session 6 (Feb 27 2026 — Dan Harshbarger, Samantha Marks, C G, Ahmad Hassan, Muhammad Majid); Session 9 (Mar 13 2026 — Dan Harshbarger, C G, Ahmad Hassan); April 2026 scope review (session-13th-20thApril-2026.md); Price Update Process document (Dan Harshbarger, written) |
| Primary Companion Docs | `12_DEALER_PORTAL_ORDERING_PRD.md`, `PRODUCT_MANAGEMENT_ACUMATICA_INTEGRATION_ARCHITECTURE.md` |

---

## 1. Meeting Traceability

| Session | Date | Key Speakers | Topics Sourced |
|---------|------|-------------|----------------|
| Discovery Session 2 | Feb 18 2026 | Dan Harshbarger (SME), C G / Curry (VP), Michelle Hogan, Adrienne Cardinale, Ahmad Hassan | LAMP stack pricing engine introduced; 34 price classes; wildcard rules; CSV export to Acumatica and Shopify (Bold Commerce); 80% generic price class share; rebate complexity; discounts and instant rebates |
| Discovery Session 3 | Feb 20 2026 | Dan Harshbarger, C G, Ahmad Hassan, Muhammad Majid | Pricing engine diagram validated; Dan's wish to automate Excel/PDF output; three outputs identified: Acumatica, dealer portal, PDFs+Excel; batch % increase concept discussed; 30+ residential price lists; multi-currency (USD / CAD) |
| Discovery Session 6 | Feb 27 2026 | Dan Harshbarger, Samantha Marks, C G, Ahmad Hassan | Shopify walkthrough: Bold Commerce CSV import; per-customer tags; price A1 class; pricing update frequency (annually); Bold Commerce plug-in issues; rebate scope explicitly parked from CRM |
| Discovery Session 9 | Mar 13 2026 | Dan Harshbarger, C G, Ahmad Hassan | April prototype walkthrough; digital price sheets discussed; PDF catalog generation confirmed as a key ask; affinity/ownership group pricing allocation shown in prototype |
| April 2026 scope review | Apr 13–20 2026 | C G, Dan Harshbarger, Ahmad Hassan | Consolidated module scope confirmed; price update automation confirmed as in-scope; Dan reaffirmed Excel + PDF + Acumatica + dealer portal as four target outputs |
| Price Update Process.docx | Written by Dan Harshbarger | Dan Harshbarger | Authoritative written description of the AS-IS annual price increase process: decision meeting, 35 Excel + 9 PDF lists, LAMP stack / MSSQL logic, CSV→Acumatica, CSV→Shopify Bold Commerce |

---

## 2. Source Inventory

| Source ID | Absolute Path | What It Sourced |
|-----------|--------------|-----------------|
| SRC-PRC-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asispricingdocuments/Price Update Process.docx.md` | Authoritative AS-IS: annual price increase decision process, 35 Excel + 9 PDF price lists, LAMP stack engine, wildcard logic, CSV→Acumatica, CSV→Shopify Bold Commerce |
| SRC-PRC-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md` | LAMP stack walkthrough, 34 price classes, ~80% generic, wildcard rules, CSV→Acumatica, Bold Commerce plug-in, rebate complexity, instant rebates, affinity/PE group pricing, discounts |
| SRC-PRC-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/20 Feb session 3 _ Discovery session 3 _ Validations.md` | Pricing engine diagram validated; Dan's explicit ask for Excel + PDF output automation; 3 outputs: Acumatica, dealer portal, PDFs/Excel; batch % increase concept; USD/CAD multi-currency |
| SRC-PRC-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Fri 27th  Feb Session 6.md` | Shopify walkthrough — Bold Commerce CSV import, per-customer tags (price A1), annual price update cadence, Bold Commerce glitches, rebate out-of-scope decision confirmed |
| SRC-PRC-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/13th March Discovery Session 9.md` | Prototype demo; digital price sheets; PDF catalog generation; affinity/ownership group pricing allocation shown in UI |
| SRC-PRC-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md` | April scope review; price update automation in-scope; four outputs confirmed; wildcard replication discussed; price sheets accessible from dealer portal |
| SRC-PRC-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asispricingdocuments/A1a Generic Pricing 2025.xlsx - Info  .csv` | Sample structure of the generic price list (A1a) — tabs: AirCleaner+3 Media, Humidifiers, IF-PT-RS-HEPA-LIT, Media 4 Packs, UVC-UVV-AIRsana — confirms product-group level organisation |
| SRC-PRC-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asispricingdocuments/AZR to ACM A1-pricelist_20260219_125046.csv` | Sample Acumatica Sales Price Worksheet CSV export (AZR→ACM format) — columns: CustomerPriceClassID, InventoryID, SalesPrice, etc. |
| SRC-PRC-009 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/asispricingdocuments/AZR to Shop EDG20260219125254.csv` | Sample Shopify Bold Commerce CSV export — confirms format fed to Bold Commerce price module |
| SRC-PRC-010 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/leads/readiness.ts` | Built code: `priceClassCode` field exists on lead conversion preparation + onboarding checklist item `price_class_assigned` — only pricing artefact currently in Pulse |
| SRC-PRC-011 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/leads/LeadOnboardingReadyPanel.tsx` | Built code: `Price Class Code` text input on lead onboarding panel — the sole UI surface for pricing in Pulse today |

---

## 3. Overview

### 3.1 Problem Statement

Dynamic AQS runs an annual residential price-increase cycle that requires Dan Harshbarger to spend two to three weeks of manual effort every year:

- Attend a January/February leadership meeting (Duke, Marty, Steve, Dan H) to agree on percentage increases by product group (e.g., panels +4%, UV kits +5%, HEPA +5%, AirSana +2%, Pan Treatments +6%).
- Manually update **35 Excel price lists** (each with a different price class / affinity group) by applying those percentages. A checker (Stephanie, Adrienne, Holly or Kaalena) reviews each file.
- Manually write updated prices on **9 PDF price lists** and email them to Stephanie for final check.
- Export two CSV files from a private custom LAMP stack / MSSQL system (`reporting.dynamicaqs.com`) that replicates Acumatica stock items daily at midnight:
  - CSV 1 → imported as a **Sales Price Worksheet into Acumatica**.
  - CSV 2 → imported into **Shopify via the Bold Commerce price module**.
- Staggered effective dates: most groups go live on the same date, but some affinity groups push back by 15 days, one month, or even a year.

The root cause is a fragmented three-system chain (custom LAMP stack → Acumatica → Shopify) with no unified authoring environment, manual Excel/PDF editing, and a Bold Commerce Shopify plugin that is unreliable and glitchy. "Two to three weeks of my life every year" — Dan Harshbarger, Session 3.

### 3.2 Target State

Pulse becomes the authoritative price master authoring tool for residential pricing. Pricing rules (percentage increases by product group, wildcard patterns, effective dates, price class definitions) are defined once in Pulse and generate all four downstream outputs automatically:

1. **Acumatica Sales Price Worksheet CSV** — uploaded to Acumatica or pushed via API.
2. **Bold Commerce / Dealer Portal CSV** — replacing the Shopify Bold Commerce CSV import.
3. **Excel price list exports** — auto-generated per price class, checksummed, replacing manual spreadsheet edits.
4. **PDF price sheets** — auto-generated with product images and prices, replacing Dan's manual PDF editing.

Rebates (quarterly rebate calculations, affinity group reconciliation, instant rebate compound logic) are **explicitly parked** from Pulse scope by Curry and Dan in Session 6 — they remain in Acumatica and an external calculation system.

---

## 4. Scope

### 4.1 In Scope

- Annual price increase decision workflow (product-group % input, effective date per affinity group / price class)
- Price class master management (CRUD for residential price classes, ~34 classes including generic A1 and named affinity group variants)
- Wildcard pricing rule engine: wildcard part-number patterns → size class → price formula replicated from the LAMP stack logic
- Four output artifacts: Acumatica CSV, Bold Commerce / Dealer Portal CSV, Excel export (per price class), PDF price sheet (per price class with product images)
- Multi-currency support: USD and CAD price classes maintained separately (per Dan's note: "the price list is only in one currency, it's either US or Canadian")
- Price class assignment to accounts/leads (already partially built: `priceClassCode` on lead onboarding)
- Staggered effective date management: different go-live dates per affinity group
- Audit log of price changes (who changed what, when, before/after values)
- Price sheet availability in the dealer portal (dealers can view/print their assigned price sheet)

### 4.2 Out of Scope (for this module)

- Quarterly rebate calculations — explicitly out of CRM scope (Curry + Dan, Session 6): "I think the quarterly rebates are down the road … too complex and it's gonna derail us"
- Instant rebate logic for non-standard groups — parked; may be revisited with a data analyst
- Commercial pricing — residential-only in Phase 1 (Dan: "commercial first … residential first")
- Real-time inventory checks at checkout — not a pricing concern; handled in dealer portal
- Homeowner pricing — out of scope for the primary dealer platform
- Distributor special pricing — residential dealers are primary; distributor edge-case deferred

### 4.3 Parked Dependencies

| Item | Dependency | Status |
|------|------------|--------|
| Acumatica Sales Price Worksheet API push | Acumatica REST API sandbox certification | Parked — CSV file import path remains as interim |
| Bold Commerce CSV push to Shopify | Dealer portal replaces Shopify; Bold Commerce CSV needed only until portal is live | Parked behind dealer portal go-live |
| PDF price sheet product images | Product images must exist in Pulse product catalog (product-management module) | Parked — images needed before PDF generation works end-to-end |
| Quarterly rebate engine | Financial complexity, constantly-changing rules; Dan recommends dedicated data analyst | Explicitly out of scope |
| Instant rebate compound logic (affinity + ownership overlap) | Same as above — financial, quarterly processing | Explicitly out of scope |

---

## 5. Functional Requirements

### 5.1 Price Class Management

| ID | Requirement | Acceptance Criteria | Priority | Build Status |
|----|------------|---------------------|----------|--------------|
| FR-PRC-001 | Maintain a list of residential price classes | Admin can create, edit, deactivate price classes. Each class has: code (e.g., A1, A3, EDL), display name, currency (USD/CAD), affinity group association (optional), effective date, notes. ~34 classes currently. | P0 | Not-built |
| FR-PRC-002 | Price class assignment to account/lead | When setting up a lead or converting to account, admin assigns a price class code. The `priceClassCode` field is captured during onboarding (leads) and stored against the account. | P0 | Partial — `priceClassCode` exists on lead conversion prep and onboarding checklist (SRC-PRC-010/011); account-level storage not confirmed |
| FR-PRC-003 | Generic price class default | If no specific price class is assigned during onboarding, system defaults to the generic residential price class (A1 / ~80% of customers). Admin is alerted when a customer remains on the generic class after activation. | P1 | Not-built |
| FR-PRC-004 | Multi-currency price class isolation | USD price classes and CAD price classes are maintained as separate sets. A single product can have both a USD price and a CAD price from different classes. No cross-currency contamination. | P0 | Not-built |

### 5.2 Price Rule Engine (Wildcard / Product Group Logic)

| ID | Requirement | Acceptance Criteria | Priority | Build Status |
|----|------------|---------------------|----------|--------------|
| FR-PRC-005 | Wildcard pricing rule definition | Admin can define wildcard rules: pattern (partial SKU / part number wildcard), size class (standard / oversized / custom / retrofit), product group (panels, media, UV kits, HEPA, AirSana, Pan Treatments, Marketing), and resulting price formula. Rules have a sort/precedence order. | P0 | Not-built |
| FR-PRC-006 | Rule expansion to stock items | When rules are applied, system expands wildcard patterns against the Acumatica stock item table (synced nightly) and generates individual item prices. The master list of ~6–130 wildcard rows must translate to 12–6,600 individual item prices per price class. | P0 | Not-built |
| FR-PRC-007 | Individually-pinned item prices | Certain products have a fixed (non-wildcard) price that overrides any wildcard rule. Admin can pin a specific price to a specific SKU per price class. These override wildcards. | P1 | Not-built |
| FR-PRC-008 | Product group percentage-increase input | Admin enters a percentage increase per product group (e.g., panels +4%, UV kits +5%, HEPA +5%, AirSana +2%, Marketing +0%, Pan Treatments +6%). System applies the percentage to all rules in each product group and previews resulting price changes before commit. | P0 | Not-built |
| FR-PRC-009 | Price preview before commit | Before publishing any price change, system shows a preview table: SKU, current price, new price, % change, effective date. Admin must explicitly approve the preview before prices are published. | P0 | Not-built |

### 5.3 Annual Price Update Workflow

| ID | Requirement | Acceptance Criteria | Priority | Build Status |
|----|------------|---------------------|----------|--------------|
| FR-PRC-010 | Annual price increase event | Admin creates a named price increase event (e.g., "2026 Residential Price Increase"). The event captures: trigger date, decision participants, target effective date(s), percentage inputs per product group. | P0 | Not-built |
| FR-PRC-011 | Staggered effective dates per price class / affinity group | Each price class or affinity group within a price increase event can have its own effective date. System honours the staggered schedule when generating outputs. Some groups launch 15 days, one month, or even one year later than the majority. | P0 | Not-built |
| FR-PRC-012 | Checker / review workflow | After Dan (or the assigned editor) applies a price increase, a named checker (Stephanie, Adrienne, Holly, Kaalena) is assigned to review. System routes the draft to the checker's queue; checker can approve or send back with comments. Approval is required before outputs are generated. | P1 | Not-built |
| FR-PRC-013 | Audit trail for price changes | Every price change is logged with: user, timestamp, old price, new price, SKU, price class, effective date. Log is immutable and exportable. | P0 | Not-built |
| FR-PRC-014 | Historical price versions | System retains all historical price versions (by price class, by effective date). Admin can view "what was the price of SKU X on date Y for price class Z?" | P1 | Not-built |

### 5.4 Output Artifacts

| ID | Requirement | Acceptance Criteria | Priority | Build Status |
|----|------------|---------------------|----------|--------------|
| FR-PRC-015 | Acumatica Sales Price Worksheet CSV export | System generates a CSV in the Acumatica Sales Price Worksheet import format (columns: CustomerPriceClassID, InventoryID, SalesPrice, EffectiveDate, ExpirationDate, as reflected in SRC-PRC-008). One CSV per price class or a combined multi-class file. Admin can download and manually import to Acumatica, or trigger API push when integration is certified. | P0 | Not-built |
| FR-PRC-016 | Shopify / Bold Commerce CSV export | System generates a CSV in the Bold Commerce Shopify import format (SRC-PRC-009) for each applicable price class. Exported file is ready to be imported into the Bold Commerce price module, or pushed to dealer portal pricing directly when Shopify is replaced. | P0 | Not-built |
| FR-PRC-017 | Excel price list export per price class | System generates one Excel file per price class containing: SKU, description, price, size class, effective date. These replace the 35 manually-maintained Excel files. Formatting should match the existing structure sufficiently to avoid re-training staff. | P0 | Not-built |
| FR-PRC-018 | PDF price sheet generation per price class | System generates a PDF price sheet per price class including: product images (from the product catalog / S3), product name, description, price. This replaces the 9 PDF price lists Dan manually updates. PDF should include Dynamic AQS branding and the affinity group / private label logo where applicable. | P1 | Not-built — depends on product images in Pulse catalog (SRC-PRC-005/006) |
| FR-PRC-019 | Bulk output generation | Admin can trigger generation of all outputs (Acumatica CSV, Shopify CSV, all Excel files, all PDF files) in a single batch action. System queues generation asynchronously and notifies admin when complete. | P1 | Not-built |
| FR-PRC-020 | Dealer portal price sheet access | Dealers logging into the dealer portal can view and download their assigned price sheet (the Excel and/or PDF version for their price class). No pricing is visible for classes the dealer is not assigned to. | P1 | Not-built |

### 5.5 Price Class ↔ Shopify / Dealer Portal Integration

| ID | Requirement | Acceptance Criteria | Priority | Build Status |
|----|------------|---------------------|----------|--------------|
| FR-PRC-021 | Price class tag for dealer portal sessions | When a dealer logs into the dealer portal, the system resolves their assigned price class and applies the correct product prices to their catalog view. No dealer sees another dealer's pricing. | P0 | Not-built |
| FR-PRC-022 | Base price rule | For Shopify compatibility: the base price for any product must be the highest price across all price classes. All other price classes must be at or below this base. System validates this constraint and warns admin when a price class entry would violate it. | P1 | Not-built — addresses current known bug: "sometimes I make mistakes … I don't raise the base price so … it makes errors" (Dan, Session 2) |

### 5.6 Price Class Assignment — Account Onboarding

| ID | Requirement | Acceptance Criteria | Priority | Build Status |
|----|------------|---------------------|----------|--------------|
| FR-PRC-023 | Price class visible on account profile | The assigned price class code is displayed on the account/customer profile so any CRM user can see "this account is on price class A3 (Service Experts)" without navigating to a sub-section. | P1 | Not-built — `priceClassCode` exists on lead but not surfaced on account profile page |
| FR-PRC-024 | Instant rebate flag on account | When an account has an instant rebate configured (set up during onboarding), this flag is visible on the account profile for reference. The CRM does not calculate the rebate — it is a reference indicator only. Instant rebate logic remains in Acumatica. | P2 | Not-built |

---

## 6. Non-Functional Requirements

| ID | Requirement | Target | Source |
|----|------------|--------|--------|
| NFR-PRC-01 | Rule expansion performance | Wildcard rule expansion from ~130 rules to up to 6,600 individual item prices must complete within 60 seconds on the admin workstation for a single price class. | (inferred standard) |
| NFR-PRC-02 | Output generation performance | Generation of all outputs for all 35 price classes (Acumatica CSV + Shopify CSV + Excel + PDF) must complete within 10 minutes when run as a batch. | (inferred standard) |
| NFR-PRC-03 | Pricing data accuracy | Price exported to Acumatica CSV must match prices displayed in the dealer portal for the same price class to 2 decimal places. Discrepancies must be logged and surfaced as a warning before export. | SRC-PRC-002 — Dan: "they're supposed to be the same and they're almost always the same but if there was a mistake shopify is glitchy" |
| NFR-PRC-04 | Access control | Only users with an explicit `pricing_admin` or `pricing_editor` role can create or modify price classes, rules, or price increase events. Dealers and TMs have read-only access to their own price sheet. | SRC-PRC-006 — Curry: "I don't want anybody going in there and changing price books" |
| NFR-PRC-05 | Audit immutability | The price change audit log cannot be edited or deleted by any user role, including admin. | (inferred standard) |
| NFR-PRC-06 | Data retention | Price history must be retained for a minimum of 7 years to support financial audit. | (inferred standard) |
| NFR-PRC-07 | Availability | The price rule engine and export tools must be available with no less than 99.5% uptime during business hours. The annual price update is time-critical (staggered effective dates). | (inferred standard) |
| NFR-PRC-08 | Observability | Every CSV export and PDF generation is logged with: user, timestamp, price class, number of rows, file size, and any validation errors or warnings. | (inferred standard) |
| NFR-PRC-09 | Scalability | Rule engine must support up to 50 price classes and up to 10,000 individual item prices per class without architectural change. | (inferred standard — current: 34 classes, ~6,600 items max) |
| NFR-PRC-10 | Security | Price data must not be accessible to unauthenticated users. Dealer portal price sheet access is restricted to the dealer's own price class. No cross-tenant price exposure. | (inferred standard) |

---

## 7. Assumptions

| ID | Assumption |
|----|-----------|
| ASM-PRC-001 | The LAMP stack / MSSQL system (`reporting.dynamicaqs.com`) nightly sync of Acumatica stock items will continue until Pulse builds its own Acumatica product sync. Pulse's wildcard rule engine will operate on the same stock item dataset. |
| ASM-PRC-002 | There are approximately 34 distinct residential price classes (confirmed by Dan in Session 2 and Session 3: "34 price classes … 29 to 39 plus" depending on counting method). This includes the generic A1, named affinity group variants, and a Canadian set. |
| ASM-PRC-003 | The percentage-increase-by-product-group decision is made annually in January/February by a small leadership group (Duke, Marty, Steve, Dan H). The CRM provides tools to implement the decision; it does not make the decision. |
| ASM-PRC-004 | Rebates (quarterly and instant) remain outside Pulse scope in Phase 1. Pulse stores a reference `priceClassCode` and optionally an `instantRebateFlag` on the account record, but all rebate calculations remain in Acumatica and Dan's external tooling. |
| ASM-PRC-005 | Multi-currency means USD and CAD price lists are separate; a Canadian customer has a CAD price class; a US customer has a USD price class. The price rule engine applies currency-specific rules independently. |
| ASM-PRC-006 | Product images for PDF price sheets will be sourced from the Pulse product catalog (S3 / AWS CloudFront) once the product management module has images populated. PDF generation is blocked until at least a representative set of images exists. |
| ASM-PRC-007 | Staggered effective dates are negotiated externally (by the leadership / sales team with affinity groups). Pulse records and honours the dates but does not negotiate them. |
| ASM-PRC-008 | The Shopify Bold Commerce CSV format (SRC-PRC-009) is used as the interim format for the Shopify price upload until the Dealer Portal replaces Shopify. Once the Dealer Portal is live, the Bold Commerce CSV output may be deprecated. |
| ASM-PRC-009 | Dan Harshbarger (or a designated successor) remains the primary operator of the price update workflow. The checker role (Stephanie, Adrienne, Holly, Kaalena) continues in a review/approval capacity within the new system. |

---

## 8. Open Questions

| ID | Question | Impact | Decision Owner |
|----|---------|--------|----------------|
| OQ-PRC-01 | Should Pulse push the Acumatica Sales Price Worksheet CSV via API or continue as a manual file import? An API push would eliminate the manual import step but requires Acumatica REST endpoint certification. | Integration scope and timeline | Dan Harshbarger + Architecture |
| OQ-PRC-02 | What is the exact column mapping required for the Acumatica Sales Price Worksheet import? The sample CSV (SRC-PRC-008) shows CustomerPriceClassID, InventoryID, SalesPrice but the full schema needs Dan's confirmation. | Output format correctness | Dan Harshbarger |
| OQ-PRC-03 | Should Pulse replicate the LAMP stack wildcard logic exactly, or should the product group / size class assignments be re-entered from scratch in Pulse? Re-entry gives a clean slate; replication is faster but inherits any LAMP stack data quality issues. | Build effort and data quality | Dan Harshbarger + Architecture |
| OQ-PRC-04 | Is there a target replacement date for Shopify, after which the Bold Commerce CSV output is no longer needed? This affects how long to maintain the Bold Commerce export format. | Roadmap sequencing | Curry + Dan Harshbarger |
| OQ-PRC-05 | For the PDF price sheet, what is the required page layout? Dan's current PDFs have product images and prices; is there a specific branded template to match? | Design scope | Dan Harshbarger + Design |
| OQ-PRC-06 | When a price class becomes effective on a staggered date, should the dealer portal automatically switch to the new pricing on that date without any manual action? Or does an admin need to "activate" the new pricing per price class? | Operational risk | Dan Harshbarger + Finance |
| OQ-PRC-07 | Should the instant rebate flag on the account record be synced from Acumatica, or entered manually by admin? Dan noted "instant rebates that get configured" during onboarding — are these maintained in Acumatica or the CRM going forward? | Data ownership | Dan Harshbarger + Finance |
| OQ-PRC-08 | What is the decision on commercial pricing? Dan asked to "build the foundation so commercial can be added later." Does the pricing module need a `channel` (residential / commercial) flag on price classes now? | Future extensibility | Curry + Dan Harshbarger |
| OQ-PRC-09 | The 2026 price increase was tentatively deferred to January 1, 2027. Is this confirmed? Does this affect the priority/timeline for this module relative to the dealer portal? | Sprint scheduling | Curry + Dan Harshbarger |

---

## 9. Requirement → Source Traceability Matrix

| Requirement | Source ID(s) | Session(s) |
|-------------|-------------|------------|
| FR-PRC-001 (price class CRUD) | SRC-PRC-001, SRC-PRC-002 | Session 2, Price Update Process doc |
| FR-PRC-002 (price class on account/lead) | SRC-PRC-002, SRC-PRC-010, SRC-PRC-011 | Session 2, built code |
| FR-PRC-003 (generic default) | SRC-PRC-002 | Session 2 — Dan: "if they don't know, they give them the generic" |
| FR-PRC-004 (multi-currency) | SRC-PRC-002, SRC-PRC-003 | Session 2 — Dan: "the price list is only in one currency, it's either US or Canadian" |
| FR-PRC-005 (wildcard rule definition) | SRC-PRC-001, SRC-PRC-002, SRC-PRC-003 | Session 2, Session 3, Price Update Process doc |
| FR-PRC-006 (rule expansion to stock items) | SRC-PRC-001, SRC-PRC-002 | Session 2 — Dan: "this list of 122 products … comes up with 3,000 prices" |
| FR-PRC-007 (individually-pinned prices) | SRC-PRC-002 | Session 2 — Dan: "there's certain things that are individually placed like this product it gets a $30 price" |
| FR-PRC-008 (% increase input by product group) | SRC-PRC-001, SRC-PRC-003 | Session 3, Price Update Process doc |
| FR-PRC-009 (preview before commit) | SRC-PRC-003 | Session 3 — implicit: Dan noted frequent mistakes caught by checkers |
| FR-PRC-010 (annual price increase event) | SRC-PRC-001 | Price Update Process doc |
| FR-PRC-011 (staggered effective dates) | SRC-PRC-001 | Price Update Process doc — "some groups push back and we launch … 15 day, a month or a year later" |
| FR-PRC-012 (checker/review workflow) | SRC-PRC-001 | Price Update Process doc — "Dan H manually updated the Excel file and someone else checks them" |
| FR-PRC-013 (audit trail) | SRC-PRC-002, SRC-PRC-003 | Session 2, Session 3 — errors and mistakes in current manual process cited as major pain |
| FR-PRC-014 (historical price versions) | SRC-PRC-002 | Session 2 — (inferred: Dan updates once a year; historical records needed) |
| FR-PRC-015 (Acumatica CSV export) | SRC-PRC-001, SRC-PRC-002, SRC-PRC-003, SRC-PRC-008 | Session 2, Session 3, Price Update Process doc |
| FR-PRC-016 (Bold Commerce / dealer portal CSV) | SRC-PRC-001, SRC-PRC-004, SRC-PRC-009 | Session 6, Price Update Process doc |
| FR-PRC-017 (Excel export) | SRC-PRC-001, SRC-PRC-003, SRC-PRC-006 | Session 3 — Dan: "I would love it to spit out Excel spreadsheets"; April scope review confirmed |
| FR-PRC-018 (PDF export) | SRC-PRC-001, SRC-PRC-003, SRC-PRC-006 | Session 3 — Dan: "PDFs … That would be cool and that would save us a lot of time"; April scope review confirmed |
| FR-PRC-019 (bulk output generation) | SRC-PRC-003 | Session 3 — "three outputs Acumatica, the portal, and then PDFs and Excel spreadsheets" |
| FR-PRC-020 (dealer portal price sheet) | SRC-PRC-005, SRC-PRC-006 | Session 9, April scope review — C G: "they want a price sheet, they can print it out" |
| FR-PRC-021 (price class tag for portal session) | SRC-PRC-004 | Session 6 — Dan: "because they have the price A1, they get the pricing" |
| FR-PRC-022 (base price rule) | SRC-PRC-004 | Session 6 — Dan: "you need to set up a base price … the absolute highest price … sometimes I make mistakes" |
| FR-PRC-023 (price class on account profile) | SRC-PRC-002, SRC-PRC-006 | Session 2, April scope review — C G: prototyped pricing allocation on account view |
| FR-PRC-024 (instant rebate flag) | SRC-PRC-003 | Session 3 — Dan: "instant rebates that get configured" during onboarding |
| NFR-PRC-04 (access control) | SRC-PRC-006 | April scope review — Curry: "I don't want anybody going in there and changing price books" |

---

## 10. Current Build Status — Pricing Module

There is **no dedicated Pricing / Price Update module** in the Pulse platform codebase as of 2026-06-09. The following represents the complete set of pricing artefacts found in the codebase:

| Artefact | Location | Status |
|---------|----------|--------|
| `priceClassCode` field on lead conversion preparation | `apps/api/src/modules/leads/readiness.ts` | Built — stored and included in onboarding checklist item `price_class_assigned` |
| `Price Class Code` text input on lead onboarding panel | `apps/crm-web/src/components/leads/LeadOnboardingReadyPanel.tsx` | Built — allows admin to enter a free-text price class code during lead-to-account conversion |
| Price class data model beyond `priceClassCode` string | Entire codebase | Not-built |
| Wildcard pricing rule engine | Entire codebase | Not-built |
| Acumatica CSV export | Entire codebase | Not-built |
| Bold Commerce / Shopify CSV export | Entire codebase | Not-built |
| Excel price list export | Entire codebase | Not-built |
| PDF price sheet generation | Entire codebase | Not-built |
| Annual price increase event workflow | Entire codebase | Not-built |
| Dealer portal price class resolution | Entire codebase | Not-built |

**Summary**: This module is 0% built (excluding the single `priceClassCode` string field on lead onboarding). The Pricing module is a net-new build.

---

## 11. AS-IS Process Reference

For traceability, the current (AS-IS) process that this module replaces is:

```
1. January/February: Annual leadership meeting (Duke, Marty, Steve, Dan H)
   → Agree on % increases per product group

2. Dan manually updates 35 Excel price lists
   → Checker reviews each file

3. Dan manually writes new prices on 9 PDF documents
   → Emails to Stephanie to check and update

4. reporting.dynamicaqs.com (LAMP stack / MSSQL):
   - Nightly midnight sync: Acumatica stock items → Azure DB
   - Master price list updated with new wildcard rules (6–130 rows)
   - Wildcard expansion against stock item table → 12–6,600 individual prices

5. Two CSV exports generated from reporting.dynamicaqs.com:
   - CSV 1 → imported as Acumatica Sales Price Worksheet
   - CSV 2 → imported into Shopify Bold Commerce price module

6. Staggered go-live: most groups same date; some push 15 days / 1 month / 1 year

Pain points documented:
- 2–3 weeks manual effort annually (Dan, Session 3)
- Frequent mistakes in Excel/PDF manual updates (Dan, multiple sessions)
- Bold Commerce Shopify plugin is "not that great" and "glitchy" (Dan, Session 2 and 6)
- Base-price rule in Shopify requires all prices to be ≤ base; Dan misses this during increases
- No version history or audit trail for price changes
```
