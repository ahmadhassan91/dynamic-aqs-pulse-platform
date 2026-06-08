# Product Management & Catalog PRD

## Document Control

| Field | Value |
|-------|-------|
| Module | Product Management — Catalog, Families/Categories, Dealer Catalog Views, Catalog Rule Engine, Presentation/Visibility, Shopify/Bold Feed Relationship |
| Document Type | Master PRD |
| Version | 1.0 |
| Status | Draft — initial traceability pass complete |
| Owner | Product / Operations |
| Sprint Sequence | Phase 1 (catalog foundation), Phase 2 (dealer portal readiness), Phase 3 (Acumatica reconciliation) |
| Priority | P1 |
| Meeting Traceability | Session 11 (Mar 19 2026) — To-Be Dealer Portal & Product Management |
| Primary Companion Docs | `12_DEALER_PORTAL_ORDERING_PRD.md`, `14_DIGITAL_ASSETS_DAM_PRD.md`, `15_ACUMATICA_INTEGRATION_PRD.md` |

---

## 1. Meeting Traceability Header

| Field | Value |
|-------|-------|
| Primary Session | Session 11 — "To-Be Dealer Portal, Product Management" (Mar 19 2026) |
| Attendees | Ahmad Hassan (Clustox), Muhammad Majid (Clustox), C G / Kari (Dynamic AQS, President's office), Don Hearn (Dynamic AQS, TM), Michelle Hogan (Dynamic AQS, Operations) |
| Transcript Path | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session _11 To-Be Dealer Portal, Product Management.md` |
| Supporting Data | Shopify US Products CSV: `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Shopify US Products.csv`; Shopify Canada Products CSV: `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Shopify Canada Products.csv` |

---

## 2. Source Inventory

| Source ID | Absolute Path | What It Sourced |
|-----------|---------------|-----------------|
| SRC-PM-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session _11 To-Be Dealer Portal, Product Management.md` | Full session transcript confirming: current-state fragmentation (Shopify + Acumatica + Dropbox + Dan's lamp-stack pricing engine + manual Excel transformation); Phase 1–5 product management roadmap; dealer portal live demo feedback; group-first navigation requirement; dealer portal catalog view; pricing class / dealer group relationship; asset sharing / shareable links; Widen/S3 digital asset question; missing Widen replacement scope |
| SRC-PM-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Shopify US Products.csv` | Product reference data: Shopify handles, product titles, HTML descriptions, vendor = "Dynamic AQS", product type (Remote Mount UV / Fixed Mount UV / UV Accessories / Marketing and Training / Pan Strips), brand Tag codes (STS/SLA/NEX/SNA/CAD/ECO/ARS/ASV/ENV/BIO/MPA/GEN), variant SKUs, prices, Shopify CDN image URLs; Shopify 100-variant limit confirmed |
| SRC-PM-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Shopify Canada Products.csv` | Canada-scoped product reference: same schema as US CSV; region-scoped products confirmed as distinct catalog requirement |
| SRC-PM-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/product-management/service.ts` | Built backend service: `listProducts`, `getProductDetail`, `listProductCategories`, `createProductCategory`, `updateProductCategory`, `listProductFamilies`, `createProductFamily`, `updateProductFamily`, `listDealerCatalogViews`, `createDealerCatalogView`, `updateDealerCatalogView`, `listDealerCatalogSnapshots`, `compareDealerCatalogSnapshot`, `publishDealerCatalogSnapshot`, `rollbackDealerCatalogSnapshot`, `listCatalogRuleSets`, `listCatalogRuleConditionOptions`, `createCatalogRuleSet`, `updateCatalogRuleSet`, `previewCatalogRuleSet`, `activateCatalogRuleSet`, `createCatalogInclusion`, `updateCatalogInclusion`, `runProductPublishValidation`; full Prisma data model including BaseProduct, ProductCategory, ProductFamily, ProductPresentation, CatalogInclusion, DealerCatalogView, DealerCatalogSnapshot, CatalogRuleSet, CatalogRule; legacy FILE_IMPORT source system block on publish |
| SRC-PM-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/product-management/http.ts` | Built HTTP routes: all REST endpoints for products, categories, families, catalog-views, snapshots, snapshot-compare, snapshot-rollback, catalog-rule-options, catalog-rule-sets, presentations, catalog-inclusions, import-preview, import-runs; RBAC guards: `product.view`, `product.manage`, `product.publish` |
| SRC-PM-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/product-management/legacy-import.ts` | Built legacy import pipeline: reads Shopify US/Canada CSVs + Acumatica export; brand code → label mapping (STS→StratosAire, SLA→SolaceAir, NEX→Nexstar, SNA→PureAirX, CAD→Clean Air Defense, ECO→Eco Friendly Home, ARS→ARS, ASV→Aire Serv, ENV→EnviroAire, BIO→BioForce, MPA→MPA, GEN→Generic); `CandidateProduct` type with regionScope US/CA; `previewProductReferenceImport`, `commitProductReferenceImport` |
| SRC-PM-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/product-management/ProductManagementWorkspace.tsx` | Built back-office UI: tabs (Review products / Who Sees What / Catalog sections / SKU families / Source file review); catalog view kind options (standard / affinity / ownership / independent / region / brand / private_label / account_override); metric strip (need info, need files, need dealer group, ready to publish); publish/rollback snapshot workflow; snapshot compare UI; category + family CRUD forms; catalog view wizard (audience → scope → review); RBAC gating on manage/publish actions |
| SRC-PM-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/product-management/ProductDetailWorkspace.tsx` | Built product detail UI: presentation form (displayName, shortDescription, longDescription, specSummary, regionScope, brandLabel, publishStatus); catalog inclusion form (dealerCatalogViewId, dealerGroupType, dealerGroupId, regionScope, brandLabel, isVisible, publishStatus, notes); digital asset assignment per role (primary_image, spec_sheet, install_guide, brochure); publish validation run |

---

## 3. Overview

### Current State

The Dynamic AQS product catalog is fragmented across at least five systems:

1. **Shopify** (US and Canada storefronts) — dealer-facing order surface with a hard limit of 100 variants per product. Brands are encoded as three-letter Tags (STS, SLA, ASV, ENV, etc.). Prices are set manually. Product descriptions and image URLs live in Shopify CDN.
2. **Acumatica** — ERP source of truth for inventory ID, item class, UOM, item status, and pricing/price books. Pricing is not editable in Pulse; it flows from Acumatica price books assigned per dealer group.
3. **Dropbox** — stores product-related digital assets (brochures, price sheets, spec sheets). Territory managers navigate outside the CRM to find and share files.
4. **Widen** (DAM, residential/marketing team only) — masters asset propagation to brand websites. Discussed for potential replacement; scope decision deferred pending Betsy/Adrian involvement and commercial-side assessment. Pulse uses AWS S3 + CloudFront as its own asset store (no Widen dependency introduced).
5. **Dan's lamp-stack pricing engine** — midnight replication of ~130 master rows into 6,800+ individual prices, with manual Excel transformation and verification across 30 sheets. Error-prone and not reproducible by others.

The Shopify 100-variant ceiling is a hard blocker for products that exceed it.

### Target State (Pulse)

Pulse replaces the back-office product catalog governance layer through five phases described in Session 11:

- **Phase 1** — Acumatica provides the base item identity (SKU, item class, UOM). Pulse ingests this as the authoritative product master.
- **Phase 2** — Product Content Setup: Pulse enriches base items with business-facing display names, marketing descriptions, and specifications.
- **Phase 3** — Digital Asset Linkage: Pulse hosts product-related assets (replacing Dropbox for field use) with shareable links for TMs to send to dealers/customers directly from Pulse.
- **Phase 4** — Dealer Visibility Rules: rule-based catalog engine defines which products are visible to which dealer group (brand, affinity group, ownership group, region, private label).
- **Phase 5** — Dealer Portal Readiness: published catalog snapshots power the dealer portal catalog view; dealers see their customized/tailored catalog.

Pricing remains Acumatica-owned. The product catalog tab in Pulse is pricing-neutral (shows no price); pricing is applied per dealer when they are in the account context or the dealer portal.

### In-Scope

- Base product catalog sourced from Acumatica (base item identity) and enriched in Pulse (presentation layer)
- Product families (SKU groupings / sibling products)
- Product categories / catalog sections (hierarchical, region- and type-scoped)
- Dealer catalog views — named audiences (standard, affinity, ownership, independent, region, brand, private_label, account_override)
- Catalog rule engine — condition-based assignment of dealer catalog views to accounts
- Product presentations — per-brand/per-region display name, short/long description, spec summary, publish lifecycle
- Catalog inclusions — explicit visibility assignments of a presentation to a dealer catalog view
- Product publish validation checks (category, content, primary image, spec sheet, install guide, brochure, brand/region scope alignment, visibility)
- Dealer catalog snapshots — versioned immutable publish-to-portal artifacts with diff/compare and rollback
- Group-first navigation in back-office: admin must select a dealer group before seeing the product catalog scoped to that group, preventing wrong-logo / wrong-pricing asset sends
- Asset sharing: TMs can generate shareable links for product assets from the product detail page
- Legacy Shopify CSV / Acumatica import pipeline (seed/reference import only; FILE_IMPORT products are blocked from dealer portal publish until reconciled with Acumatica)
- Region-scoped catalog (US and Canada product catalogs are distinct)
- Brand-scoped assets: an asset flagged with a brand scope must match the product presentation brand before the product passes publish validation
- Digital asset roles per product: primary_image, spec_sheet, install_guide, brochure (and additional roles from the DAM module)
- Audit trail on all product governance actions

### Out-of-Scope

- Pricing management — Acumatica owns price books; Pulse displays prices in the dealer portal context only (fetched from Acumatica or cached read-model), not in the product catalog admin tab
- Widen integration — Pulse introduces no Widen dependency; if Widen replacement is pursued it is a separate DAM initiative involving marketing/commercial teams (SRC-PM-001: Kari/Michelle discussion, session 11)
- Shopify as an ongoing order channel — dealer portal (module 12) replaces Shopify ordering; Shopify CSVs are migration/seed source only
- Bold Commerce — referenced in module 12; product pricing rendered in the dealer portal checkout is a module 12 concern
- Direct Acumatica product creation from Pulse — Pulse reads/syncs the Acumatica product master; it does not create Acumatica inventory items
- Dan's Excel pricing engine — replaced by Acumatica price books surfaced per dealer group (no equivalent Pulse build required for the engine itself)
- Dealer portal browsing, cart, and checkout UX — module 12

### Parked Dependencies

| Item | Dependency | Owner |
|------|-----------|-------|
| Acumatica base product sync (live) | Acumatica integration endpoint certification | Architecture + Acumatica admin |
| Legacy FILE_IMPORT products dealer-portal publish | Must be reconciled/re-sourced via Acumatica before publish unblocks | Product + Ops |
| Widen replacement scope | Requires Betsy/Adrian + commercial team review | Kari + Dan (post-vacation) |
| Canada product catalog completeness | Canada CSV imported; coverage validation against Acumatica CA items pending | Ops + Product |
| Bold Commerce pricing feed to dealer portal | Module 12 / Acumatica price book certification | Architecture |

---

## 4. Functional Requirements

### 4.1 Base Product Catalog

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|----|-------------|---------------------|----------|-----|--------------|
| FR-PM-001 | The system shall maintain a base product catalog sourced from Acumatica, where each base product record carries: SKU, Acumatica inventory ID, item class, UOM, item status, lifecycle status (`active`/`inactive`/`discontinued`), `isSellable`, `isDealerVisible`, source system, and last Acumatica sync timestamp. | `GET /api/v1/product-management/products` returns all base product fields including `acumaticaInventoryId`, `acumaticaItemClass`, `uom`, `lifecycleStatus`, `isSellable`, `isDealerVisible`, `sourceSystem`, `acumaticaLastSyncedAt`. | P0 | SRC-PM-001, SRC-PM-004 | Built |
| FR-PM-002 | The system shall support a legacy seed import of base products from the Shopify US and Canada CSVs combined with Acumatica export data, as a reference-only bootstrap that does NOT become dealer-facing catalog truth until Acumatica mapping is certified. | Attempting to publish a dealer catalog snapshot containing FILE_IMPORT products returns a blocking error naming the unreconciled SKUs. `commitProductReferenceImport` sets `sourceSystem = FILE_IMPORT`. | P0 | SRC-PM-002, SRC-PM-003, SRC-PM-006 | Built |
| FR-PM-003 | The system shall map Shopify three-letter brand Tag codes to governed brand label names during the legacy import (STS→StratosAire, SLA→SolaceAir, NEX→Nexstar, SNA→PureAirX, CAD→Clean Air Defense, ECO→Eco Friendly Home, ARS→ARS, ASV→Aire Serv, ENV→EnviroAire, BIO→BioForce, MPA→MPA, GEN→Generic). | `BRAND_CODE_TO_NAME` mapping is applied at import; imported products carry the governed brand label, not the three-letter code. | P0 | SRC-PM-002, SRC-PM-006 | Built |
| FR-PM-004 | The system shall support region-scoped base products, distinguishing US (`COUNTRY_US`) and Canada (`COUNTRY_CA`) catalog items. | Products imported from the US CSV carry `regionScope = US`; Canada CSV items carry `regionScope = CA`. Both are queryable via `regionScope` filter on `GET /api/v1/product-management/products`. | P0 | SRC-PM-001, SRC-PM-002, SRC-PM-003, SRC-PM-006 | Built |
| FR-PM-005 | The back-office product list shall support search by SKU, product name, Acumatica inventory ID, and presentation display name, with filter by category, family, publish status, region scope, and brand label. | All five search/filter parameters accepted by `listProducts`; partial text match confirmed in `buildProductWhere`. | P1 | SRC-PM-004, SRC-PM-007 | Built |

### 4.2 Product Families (SKU Groupings)

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|----|-------------|---------------------|----------|-----|--------------|
| FR-PM-010 | The system shall allow admins to create, edit, and deactivate product families, where a family groups related SKUs (sibling products / variant-like groups) visible to staff without controlling dealer access. | `POST /api/v1/product-management/families` creates a family; `PATCH /api/v1/product-management/families/:familyId` edits it; `listProductFamilies` returns all with `sortOrder`; family assignment is visible in product list. | P1 | SRC-PM-001, SRC-PM-004, SRC-PM-007 | Built |
| FR-PM-011 | A product family shall carry: code, name, description, isActive flag, and sortOrder. | `ProductFamilySummary` contract includes all five fields; `mapFamily` returns them. | P1 | SRC-PM-004, SRC-PM-007 | Built |
| FR-PM-012 | The back-office UI shall display the count of products assigned to each family. | `ProductManagementWorkspace` families tab renders `products.items.filter((p) => p.family?.id === family.id).length` per row. | P2 | SRC-PM-007 | Built |

### 4.3 Product Categories / Catalog Sections

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|----|-------------|---------------------|----------|-----|--------------|
| FR-PM-020 | The system shall allow admins to create, edit, and deactivate product categories (catalog sections), where a category determines where a product appears when dealers browse, not who can see it. | `POST /api/v1/product-management/categories` and `PATCH /api/v1/product-management/categories/:categoryId` operate correctly; `listProductCategories` ordered by `sortOrder`. | P0 | SRC-PM-001, SRC-PM-004, SRC-PM-007 | Built |
| FR-PM-021 | A product category shall support: code, name, optional parentId (hierarchical nesting), description, categoryType (portal_section / product_line / application / brand / legacy_shopify_collection / internal_reference), regionScope, isActive, sortOrder. | `ProductCategorySummary` carries all fields; `updateProductCategory` enforces no self-parent. | P0 | SRC-PM-004, SRC-PM-007 | Built |
| FR-PM-022 | A category assignment on a product shall be required before the product can pass publish validation for the dealer portal. | `runProductPublishValidation` returns `BLOCKED` check with message "Product must have a governed Pulse category before portal publish" when `categoryId` is null. | P0 | SRC-PM-004 | Built |
| FR-PM-023 | Catalog sections derived from Shopify `Type` field (Remote Mount UV, Fixed Mount UV, UV Accessories, Marketing and Training, Pan Strips, etc.) shall be preserved as reference-only categories tagged `legacy_shopify_collection`, not used as dealer portal browse sections without admin review. | `CATEGORY_TYPE_OPTIONS` includes `legacy_shopify_collection` with label "Legacy reference only"; separate section purpose codes exist for `portal_section` intent. | P1 | SRC-PM-002, SRC-PM-007 | Built |

### 4.4 Product Presentations (Content Enrichment)

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|----|-------------|---------------------|----------|-----|--------------|
| FR-PM-030 | Each base product shall have one or more product presentations carrying the dealer-facing enrichment layer: displayName, shortDescription, longDescription, specSummary, regionScope, brandLabel, publishStatus, readyForDealerPortal flag, approvedAt, publishedAt. | `ProductPresentationSummary` contract; `updateProductPresentation` via `PATCH /api/v1/product-management/presentations/:presentationId`. | P0 | SRC-PM-001, SRC-PM-004, SRC-PM-008 | Built |
| FR-PM-031 | The system shall enforce a publish lifecycle for product presentations: `draft → ready_for_review → approved → published`. Transitioning to `approved` stamps `approvedByUserId + approvedAt`; transitioning to `published` stamps `publishedAt` and sets `readyForDealerPortal = true`. | `updateProductPresentation` sets approval and publish data accordingly; `toProductPublishStatus` validates transitions. | P0 | SRC-PM-004, SRC-PM-008 | Built |
| FR-PM-032 | A product presentation shall support a brandLabel that scopes the presentation to a specific brand, and a regionScope that scopes it to a region (US / CA / state/province). | `brandLabel` and `regionScope` fields on `ProductPresentation`; both are filterable in `listProducts`. | P0 | SRC-PM-001, SRC-PM-004, SRC-PM-008 | Built |
| FR-PM-033 | When a TM views the product tab in back-office without being in an account context, the system shall default to requiring group selection first, so no assets are sent with the wrong pricing or logo. | Session 11 (C G, ~17:00): "Put the dealer group first — that way our employee doesn't make a mistake." Enforced in back-office UX: product catalog is filtered to a selected dealer group view before displaying. | P0 | SRC-PM-001 | Partial (back-office workspace filter exists; group-first enforcement gate not yet surfaced as hard block on product browse entry) |
| FR-PM-034 | From the product detail page, a TM shall be able to generate a shareable link for any product asset and send it to a dealer or stakeholder without leaving Pulse. | Session 11 (Ahmad ~12:07): "I will provide a functionality you guys can actually share that the shareable link from here within the pulse app." Asset shareable link capability exists via `legacyUrl` / `stableSlug` on `ProductAssetLinkSummary`. Full shareable-link generation UI confirmed in session. | P1 | SRC-PM-001, SRC-PM-008 | Partial (asset links present in ProductDetailWorkspace; dedicated "share" action UI not yet built) |

### 4.5 Catalog Inclusions and Dealer Visibility

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|----|-------------|---------------------|----------|-----|--------------|
| FR-PM-040 | The system shall allow admins to create visibility assignments (catalog inclusions) linking a product presentation to a dealer catalog view, with optional dealer group type, dealer group ID, region scope, brand label, visibility toggle, publish status, and effective date range. | `createCatalogInclusion` and `updateCatalogInclusion` via `POST/PATCH /api/v1/product-management/catalog-inclusions` and `/catalog-inclusions/:inclusionId`. | P0 | SRC-PM-004, SRC-PM-008 | Built |
| FR-PM-041 | A product presentation that has no visible catalog inclusion (`isVisible = true`) shall be blocked from dealer portal publish. | `runProductPublishValidation` returns `BLOCKED` check "Dealer visibility defined" when no visible inclusion exists. | P0 | SRC-PM-004 | Built |
| FR-PM-042 | The back-office "Who Sees What" tab shall present a dealer-group-first view: a list of all dealer catalog views with product count, published count, not-visible count, and the active snapshot version; selecting a group shows the per-product visibility detail. | `ProductManagementWorkspace` visibility tab renders `catalogViewRows` with group summary; `selectedCatalogVisibilityRows` rendered in detail rail on row select. | P0 | SRC-PM-001, SRC-PM-007 | Built |
| FR-PM-043 | When a TM accidentally selects the wrong brand or group before sharing a spec sheet, the system shall provide a visible warning that the account/brand selection and the asset do not match. | Session 11 (Michelle, ~21:21): "Hopefully there would be a double check because for example if Don went to send an ARS price guide and he accidentally selected service experts, hopefully there would be a double check that said are you sure because these don't match." Asset brand-scope mismatch check in `runProductPublishValidation` (`hasBrandScopedAssetMismatch` returns `BLOCKED`); UI warning on mismatch needed in the share flow. | P1 | SRC-PM-001, SRC-PM-004 | Partial (publish validation catches mismatch; interactive "are you sure" confirmation in the share UI is not yet built) |

### 4.6 Dealer Catalog Views

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|----|-------------|---------------------|----------|-----|--------------|
| FR-PM-050 | The system shall support named dealer catalog views with kinds: `standard` (default eligible dealers), `affinity` (approved relationship/buying-group), `ownership` (common-owner overlay), `independent` (no relationship overlay), `region` (US/CA/province/state), `brand` (brand-specific presentation), `private_label`, `account_override` (specific dealer exception). | `DealerCatalogViewKind` enum; `CATALOG_VIEW_KIND_OPTIONS` in UI; `toDealerCatalogViewKind` mapping in service. | P0 | SRC-PM-001, SRC-PM-004, SRC-PM-007 | Built |
| FR-PM-051 | Each dealer catalog view shall carry: code, name, kind, optional resolverKey (the specific affinity/ownership group identifier), resolverLabel, regionScope, brandLabel, description, isDefault, isActive, precedence, and sourceOfTruthSystem. | `DealerCatalogViewSummary` contract; `mapDealerCatalogView` returns all fields. | P0 | SRC-PM-004, SRC-PM-007 | Built |
| FR-PM-052 | A wizard (audience → scope → review) shall guide admins when creating a new dealer catalog view, with sensible defaults for precedence by kind and a review step before saving. | `CatalogViewWizardStep` flow in `ProductManagementWorkspace`; precedence defaults per kind (e.g. account_override = 10, private_label = 20, brand = 30). | P1 | SRC-PM-007 | Built |
| FR-PM-053 | A dealer catalog view's `resolverKey` shall match the affinity group code, ownership group code, or specific account ID used in the catalog rule engine so that the correct view is resolved when a dealer logs into the portal. | `listCatalogRuleConditionOptions` returns affinityGroups, ownershipGroups, brandLabels, regions, dealerCatalogViews for rule building; `resolverKey` is the join field between rule output and catalog view. | P0 | SRC-PM-001, SRC-PM-004 | Built |
| FR-PM-054 | Session 11 confirmed that dealer groups include at minimum: independent standard dealers, Next Star dealers, Apex dealers (receive standard price with a line-item discount, no portal-visible differentiated price), Service Experts (different price class), ARS, and Aire Serv brand groups. | Session 11 (Don, ~13:00–14:10); Session 11 (C G, ~18:05). Each maps to a dealer catalog view of the appropriate kind. | P0 | SRC-PM-001 | Partial (catalog view kinds built; specific Next Star / Apex / Service Experts views require data setup, not code) |

### 4.7 Dealer Catalog Snapshots (Publish Versioning)

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|----|-------------|---------------------|----------|-----|--------------|
| FR-PM-060 | The system shall support versioned immutable dealer catalog snapshots: each publish creates a new version, deactivates the previous, and captures product count, file count, and the full `assetVersionPayload` (asset assignments with version pointers) for every included product. | `publishDealerCatalogSnapshot` transaction: increments version, archives previous `isActive` snapshot, creates new snapshot with items; returns `DealerCatalogSnapshotSummary`. | P0 | SRC-PM-004, SRC-PM-007 | Built |
| FR-PM-061 | Before publishing, the system shall provide a diff/compare showing: products added, removed, changed (SKU/display name/file count/dealer-safe files), and unchanged count, plus warning messages when no snapshot exists yet, when no ready products exist, or when any product has no dealer-safe files. | `compareDealerCatalogSnapshot` returns `added`, `removed`, `changed`, `unchangedCount`, `warnings`; UI renders the compare in `WorkbenchDetailRail`. | P0 | SRC-PM-004, SRC-PM-007 | Built |
| FR-PM-062 | An admin with `product.publish` permission shall be able to roll back a dealer catalog view to any previous snapshot version. | `rollbackDealerCatalogSnapshot` creates a new version copying items from the source snapshot; audit entry created. | P1 | SRC-PM-004, SRC-PM-007 | Built |
| FR-PM-063 | Legacy FILE_IMPORT products shall be blocked from inclusion in any dealer catalog snapshot publish until they are reconciled with Acumatica (re-sourced with `sourceSystem != FILE_IMPORT`). | `publishDealerCatalogSnapshot` queries for FILE_IMPORT products among snapshot items and throws a blocking error naming the offending SKUs. | P0 | SRC-PM-004 | Built |

### 4.8 Catalog Rule Engine

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|----|-------------|---------------------|----------|-----|--------------|
| FR-PM-070 | The system shall allow admins to create catalog rule sets containing up to 50 prioritized rules. Each rule specifies: conditions (field, operator, value) matched against an account's attributes (affinityGroup, ownershipGroup, brandLabel, region, dealerCatalogView), a result action (ASSIGN_CATALOG_VIEW or REQUIRE_REVIEW), and optionally a target dealer catalog view. | `createCatalogRuleSet` creates rule set + rules; `normalizeCatalogRuleDrafts` validates max 50 rules, each requires a name, at least one condition, and a catalog view if action = ASSIGN_CATALOG_VIEW. | P0 | SRC-PM-001, SRC-PM-004 | Built |
| FR-PM-071 | Only one catalog rule set shall be active at a time. Activating a new rule set retires all previously active sets atomically. | `activateCatalogRuleSet` transaction: retires all active rule sets, activates the new one; status moves `draft → active`; retired sets get `retiredAt + retiredByUserId`. | P0 | SRC-PM-004 | Built |
| FR-PM-072 | Before activating a catalog rule set, the system shall run a preview that evaluates the rules against all active accounts and reports: matched, unmatched, and review-required counts. Activation is blocked if any unmatched or review-required accounts remain. | `previewCatalogRuleSet` runs `evaluateCatalogRuleSetPreview`; `activateCatalogRuleSet` blocks on `unmatchedCount > 0 || reviewRequiredCount > 0`. | P0 | SRC-PM-004 | Built |
| FR-PM-073 | The condition options for catalog rules shall be sourced from the governed reference tables: affinityGroupRef, ownershipGroupRef, brandLabelRef, region, and dealerCatalogView. | `listCatalogRuleConditionOptions` returns all five option sets from governed Prisma tables with active filter. | P0 | SRC-PM-004 | Built |
| FR-PM-074 | The catalog rule engine shall be the mechanism by which the correct dealer catalog view is resolved for each account, replacing manual assignment and eliminating the need for Dan's pricing replication script for the purpose of catalog audience targeting. | Session 11 (Ahmad ~13:50–14:20): affinity groups / ownership groups / pricing class assigned at account onboarding feed directly into rule evaluation. The pricing engine itself is replaced by Acumatica price books, not this rule engine. | P0 | SRC-PM-001, SRC-PM-004 | Built |
| FR-PM-075 | Session 11 confirmed that when an account belongs to an Apex dealer group, the portal shows them standard pricing with a line-item discount rather than a differentiated price book. The rule engine shall resolve Apex accounts to the correct catalog view and the pricing layer shall handle the discount. | Session 11 (C G, ~19:22–19:34): "Apex did we just send them a regular pricing and they get a 12% discount as a line item." Catalog view kind = `affinity` or `ownership` for Apex; discount applied in checkout, not in catalog visibility. | P0 | SRC-PM-001 | Partial (rule engine built; Apex-specific catalog view and discount logic requires data setup and module 12 checkout integration) |

### 4.9 Product Publish Validation

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|----|-------------|---------------------|----------|-----|--------------|
| FR-PM-080 | The system shall run a publish readiness check against a product presentation and return a structured result with status (pass / warning / blocked) and individual check results for: category assignment, dealer-facing content completeness, primary image, spec sheet, install guide, brochure, asset brand scope alignment, asset region scope alignment, and dealer visibility definition. | `runProductPublishValidation` returns 9 named checks with `status` and `message`; results persisted as `ProductPublishCheck` rows for the presentation. | P0 | SRC-PM-004, SRC-PM-008 | Built |
| FR-PM-081 | A product with any BLOCKED check shall not be eligible for inclusion in a dealer catalog snapshot publication. | `publishDealerCatalogSnapshot` filters to `publishStatus: PUBLISHED` and `readyForDealerPortal: true`; a presentation cannot be `PUBLISHED` if BLOCKED checks exist (lifecycle enforced via `updateProductPresentation` approval/publish data). | P0 | SRC-PM-004 | Built |
| FR-PM-082 | The back-office product list shall surface a workflow metric strip showing: products that need info (missing content/category/family), products that need files (missing image/spec sheet/brochure), products that need a dealer-group visibility assignment, and products ready to publish. | `workflowMetrics` computed in `ProductManagementWorkspace` from `readinessRows`; displayed as `WorkbenchMetricStrip`. | P1 | SRC-PM-007 | Built |

### 4.10 Asset / Digital Asset Integration

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|----|-------------|---------------------|----------|-----|--------------|
| FR-PM-090 | Each product presentation shall support digital asset assignments by role: primary_image, spec_sheet, install_guide, brochure (and additional roles from the DAM module). Each assignment carries: assetId, assetVersionId, role, sortOrder, isRequired, brandLabel, regionScope, dealerGroupType, dealerGroupId. | `ProductAssetLinkSummary` contract; `PRODUCT_ASSET_ROLES` constant; `assignDigitalAssetToProduct` and `unlinkDigitalAssetFromProduct` in DAM integration. | P0 | SRC-PM-004, SRC-PM-008 | Built |
| FR-PM-091 | An asset is dealer-visible in a catalog snapshot only if: status = ACTIVE, visibility = DEALER_PORTAL or PUBLIC, reviewStatus = APPROVED or NOT_REQUIRED, and its brandScope/regionScope (if set) matches the catalog view's brandLabel/regionScope. | `isDealerVisibleSnapshotAsset` filter function enforces all four conditions. | P0 | SRC-PM-004 | Built |
| FR-PM-092 | A product presentation with an asset whose brandScope does not match the presentation's brandLabel shall be BLOCKED in publish validation. A region scope mismatch shall produce a WARNING (not a blocker). | `buildAssetReadinessCheck` with `BLOCKED` for brand mismatch (`hasBrandScopedAssetMismatch`); `WARNING` for region mismatch (`hasRegionScopedAssetMismatch`). | P0 | SRC-PM-004 | Built |
| FR-PM-093 | The digital asset store for product assets shall be AWS S3 + CloudFront (replacing Dropbox for field use), with no Widen dependency introduced by Pulse. Widen's continued use by the commercial/marketing side is outside Pulse scope and must not create a coupling. | Session 11 (Muhammad Majid ~08:07): "A private secure service provided by Amazon — these services are cheaper and as we are building a customized solution everything needed to link/access these files will be handled." Explicit no-Widen-dependency decision. | P0 | SRC-PM-001 | Built (S3/CloudFront architecture; confirmed in WIDEN_RELATIONSHIP_FINDINGS and SYSTEM_ARCHITECTURE docs) |

### 4.11 Dealer Portal Catalog View (Read Path)

| ID | Requirement | Acceptance Criteria | Priority | SRC | Build Status |
|----|-------------|---------------------|----------|-----|--------------|
| FR-PM-100 | When a dealer logs into the dealer portal, the system shall resolve their account's catalog view via the active catalog rule set and serve only the products and assets in the active snapshot for that view. | Session 11 (Ahmad ~25:15): "based on You know, we can have branding like this — Next star — dealer will see you know its customize or tailored product catalog." Active `DealerCatalogSnapshot` items are the dealer-facing catalog truth. | P0 | SRC-PM-001, SRC-PM-004 | Partial (snapshot publish pipeline built; dealer portal read path in module 12) |
| FR-PM-101 | The dealer portal catalog shall support search by name/SKU, filter by category, and sort by price high/low/low-high and by category. | Session 11 (Ahmad ~26:41): "filter by category and you know filter by brands as well sort by high price low high to low or based on categories." | P1 | SRC-PM-001 | Not-built (dealer portal module 12) |
| FR-PM-102 | The dealer portal shall display the dealer's assigned price (from their Acumatica price class) on each product, not a generic/neutral price. | Session 11 (C G ~14:55–15:14): question about what pricing shows in product tab; Ahmad confirms pricing comes from account's price class from Acumatica. Product catalog admin tab is price-neutral; dealer portal applies the account's price. | P0 | SRC-PM-001 | Not-built (dealer portal + Acumatica price integration; module 12 + module 15) |
| FR-PM-103 | Billing information shown during checkout in the dealer portal shall be locked and not editable by the dealer. | Session 11 (Ahmad ~27:39): "Dan earlier mentioned that they don't want them to be able to change the billing information so it will be locked." | P0 | SRC-PM-001 | Not-built (module 12 checkout) |
| FR-PM-104 | The dealer portal shall allow dealers to add products to cart, change quantity at product list and cart level, and place an order linked to their account in Acumatica. | Session 11 (Ahmad ~26:55–27:14): add to cart, change quantity, checkout visible in demo. | P0 | SRC-PM-001 | Not-built (module 12) |
| FR-PM-105 | The dealer portal dashboard shall show the dealer's payment terms (e.g., net 30, credit limit) and an alert when they are past due or on credit hold, with color-coded severity (past due = yellow, credit hold = red). | Session 11 (C G ~37:46–38:52): "if an account hits past due it has to not only show up on the dealer portal but also trigger notifications"; Don (39:00): TM homepage should highlight past due accounts. Past due / credit hold notifications are in scope as a dealer portal feature. | P0 | SRC-PM-001 | Not-built (module 12 + accounts module) |

---

## 5. Non-Functional Requirements

| ID | Requirement | Target | SRC |
|----|-------------|--------|-----|
| NFR-PM-001 | Back-office product catalog list must load within 3 seconds for up to 500 products on a standard broadband connection. | P99 < 3 s at 500 product load | (inferred standard) |
| NFR-PM-002 | Dealer catalog snapshot publish must complete within 10 seconds for catalogs of up to 300 products with up to 5 asset assignments each. | P99 publish < 10 s | (inferred standard) |
| NFR-PM-003 | All product governance mutations (create/update category, family, catalog view, rule set, inclusion, presentation) must be logged as audit entries in `AuditEntry` with actorUserId, action, entityType, entityId, beforeData, afterData. | Every mutating service function in `service.ts` creates an `auditEntry`; verified in code. | SRC-PM-004 |
| NFR-PM-004 | Authorization: `product.view` is required to read any product management data. `product.manage` is required for all creation and update operations. `product.publish` is required for snapshot publish, rollback, and catalog rule set activation. | RBAC enforced via `assertActionAccess` in every service function; HTTP routes enforce same via `requireAuthenticatedActor`. | SRC-PM-004, SRC-PM-005 |
| NFR-PM-005 | Legacy FILE_IMPORT products must not be dealer-portal-publishable until reconciled. The publish guard must be server-enforced and must not be bypassable from the UI. | Server-side `publishDealerCatalogSnapshot` checks `sourceSystem = FILE_IMPORT`; the guard is not a UI-only check. | SRC-PM-004 |
| NFR-PM-006 | The catalog rule engine preview must evaluate against all active accounts before activation is permitted. Rule sets with any unmatched or review-required accounts must be blocked. | `activateCatalogRuleSet` runs `evaluateCatalogRuleSetPreview` with `includeAllAccounts: true` and rejects if `unmatchedCount > 0 || reviewRequiredCount > 0`. | SRC-PM-004 |
| NFR-PM-007 | Asset visibility filtering for dealer catalog snapshots must be computed server-side; the dealer portal must not receive unfiltered asset data and apply visibility client-side. | `isDealerVisibleSnapshotAsset` runs in `buildCatalogSnapshotItems` on the API server before snapshot items are written. | SRC-PM-004 |
| NFR-PM-008 | The product management module must support multi-region (US + Canada) and multi-brand catalogs simultaneously, with no cross-contamination of brand-scoped assets between brands. | Brand scope mismatch returns BLOCKED in publish validation; region scope mismatch returns WARNING; `isDealerVisibleSnapshotAsset` filters on both. | SRC-PM-004 |
| NFR-PM-009 | Scalability: The Shopify 100-variant-per-product ceiling that currently limits the catalog must not be reproduced in Pulse. Pulse must handle products with any number of presentations and catalog inclusions. | No variant count limit in the Prisma schema or service layer. | SRC-PM-001, SRC-PM-004 |
| NFR-PM-010 | Accessibility: The back-office product management workspace must meet WCAG 2.1 AA, including keyboard navigation and screen-reader labelling for all table actions and form inputs. | `ariaLabel` on every `WorkbenchTable`; `aria-label` on form fields in `ProductManagementWorkspace`; verified in code. | SRC-PM-007 — (inferred standard) |
| NFR-PM-011 | Observability: Catalog rule set activation and deactivation events must be audit-logged with the list of retired rule set IDs and the activating user. | `AuditAction.APPROVE` entry with `retiredRuleSetIds` metadata in `activateCatalogRuleSet`. | SRC-PM-004 |

---

## 6. Assumptions

| ID | Assumption | Owner |
|----|-----------|-------|
| ASM-PM-001 | Pricing is Acumatica-owned. Pulse displays prices in the dealer portal context only, resolved from the account's Acumatica price class. Pulse does not store or manage price books. | Architecture + Finance |
| ASM-PM-002 | The legacy Shopify CSVs (US + Canada) are the authoritative bootstrap source for the seed import. Any products in Acumatica but not in the Shopify export must be brought in via Acumatica sync, not another CSV. | Ops + Ahmad Hassan |
| ASM-PM-003 | Widen is not replaced by Pulse for marketing/commercial website asset propagation. Pulse introduces its own AWS S3 + CloudFront asset store for field use, which is independent of Widen. | Kari + Dan + Marketing |
| ASM-PM-004 | The three-letter Shopify brand Tag codes are stable and correctly map to the governed brand label names in `BRAND_CODE_TO_NAME`. If Dynamic AQS adds new brands, this mapping table must be updated before import. | Ops + Ahmad Hassan |
| ASM-PM-005 | Apex dealers receive standard pricing with a line-item rebate/discount applied at checkout, not a differentiated catalog view with different prices displayed. The catalog view for Apex accounts resolves to the standard or affinity catalog; the discount is a checkout concern (module 12). | Finance + C G |
| ASM-PM-006 | The requested delivery date field on the dealer portal checkout (shown in demo) has been explicitly removed from scope per Session 11 (C G + Don, ~28:14–29:00): "I actually think we should have nothing." Delivery is quoted at the standard 2–3 days. | Kari + Don |
| ASM-PM-007 | Catalog rule set activation requires a clean preview (no unmatched or review-required accounts). This means all active dealer accounts must be covered by at least one rule before the rule set can go live. | Product + Ops |
| ASM-PM-008 | Canada and US products may be present in the same base product table but are differentiated by regionScope. Separate dealer catalog views will be configured for Canada vs US audiences where the product sets diverge. | Ops + Architecture |

---

## 7. Open Questions

| ID | Question | Impact | Decision Owner |
|----|---------|--------|---------------|
| OQ-PM-001 | Session 11 raised but did not resolve whether Widen will be fully replaced or maintained in parallel for the commercial/marketing side. Which team owns the Widen subscription decision, and what is the timeline for the assessment with Betsy/Adrian? | If Widen is retained by marketing, Pulse must ensure no circular file reference dependency. If replaced, the DAM module (14) must cover marketing asset propagation scenarios. | Kari + Dan + Betsy/Adrian |
| OQ-PM-002 | The Canada product CSV has a distinct set of SKUs from the US CSV. Are there products sold in both regions with the same SKU, or are Canadian SKUs always distinct? This affects whether `regionScope` is a presentation-level or base-product-level attribute. | Data model: if same SKU appears in both, `regionScope` must be on the presentation; if always distinct, it can stay on the base product. | Ops + Ahmad Hassan |
| OQ-PM-003 | Apex dealers: is the 12% line-item discount a hardcoded value or configurable per Apex sub-group? If configurable, where is it managed (Acumatica price book vs. dealer portal config)? | Checkout module 12 + Acumatica integration module 15 | Finance + C G |
| OQ-PM-004 | Are marketing materials (brochures with quantity variants of 50/100/150/200 like the ARS Humidifier Brochure in the Shopify CSV) considered sellable catalog products in the dealer portal, or are they asset-only and should be managed purely in the DAM? They currently appear as Shopify line items with `$0.00` price. | If they are catalog products: they need presentations, inclusions, and catalog view assignments. If asset-only: they belong in the DAM module without a `BaseProduct` record. | Ops + Michelle Hogan |
| OQ-PM-005 | The session confirmed dealers can view company-wide orders (parent-child account relationship). Does the catalog view resolver need to account for parent accounts when assigning a catalog view to a child/branch account? | Catalog rule engine: if a branch inherits the parent's affinity group, rule evaluation should reference the parent. If independent, each branch has its own rule match. | Architecture + Ops |
| OQ-PM-006 | What is the upgrade path from `FILE_IMPORT` source system to `ACUMATICA` source system for legacy-seed products? Is there a bulk reconciliation tool, or must each product be updated individually as Acumatica sync populates matching SKUs? | Unblocks dealer portal publish for the majority of the current product catalog. | Architecture + Ahmad Hassan |
| OQ-PM-007 | The session showed a "rebate-eligible" filter on the invoice reporting page in the dealer portal (Michelle ~34:56): "they do not get rebates if they paid any shipping." Should the catalog / presentation layer carry a rebate-eligible flag per product, or is this purely a reporting/financial concern? | If per-product: add `isRebateEligible` to `BaseProduct`. If reporting-only: no catalog model change needed. | Finance + Michelle Hogan |

---

## 8. FR / NFR → SRC Traceability Matrix

| Requirement ID | Description Summary | SRC Citations |
|----------------|--------------------|--------------------|
| FR-PM-001 | Base product catalog from Acumatica | SRC-PM-001, SRC-PM-004 |
| FR-PM-002 | Legacy seed import — FILE_IMPORT blocked from publish | SRC-PM-002, SRC-PM-003, SRC-PM-006 |
| FR-PM-003 | Shopify brand code → governed label mapping | SRC-PM-002, SRC-PM-006 |
| FR-PM-004 | Region-scoped base products (US / CA) | SRC-PM-001, SRC-PM-002, SRC-PM-003, SRC-PM-006 |
| FR-PM-005 | Product list search and filters | SRC-PM-004, SRC-PM-007 |
| FR-PM-010 | Product families CRUD | SRC-PM-001, SRC-PM-004, SRC-PM-007 |
| FR-PM-011 | Product family data model | SRC-PM-004, SRC-PM-007 |
| FR-PM-012 | Family product count in UI | SRC-PM-007 |
| FR-PM-020 | Product categories / catalog sections CRUD | SRC-PM-001, SRC-PM-004, SRC-PM-007 |
| FR-PM-021 | Category data model with type/region/hierarchy | SRC-PM-004, SRC-PM-007 |
| FR-PM-022 | Category required for portal publish | SRC-PM-004 |
| FR-PM-023 | Legacy Shopify collection categories | SRC-PM-002, SRC-PM-007 |
| FR-PM-030 | Product presentations / content enrichment | SRC-PM-001, SRC-PM-004, SRC-PM-008 |
| FR-PM-031 | Presentation publish lifecycle | SRC-PM-004, SRC-PM-008 |
| FR-PM-032 | Brand and region scoping on presentations | SRC-PM-001, SRC-PM-004, SRC-PM-008 |
| FR-PM-033 | Group-first navigation — no wrong-logo sends | SRC-PM-001 |
| FR-PM-034 | Shareable asset links from product detail | SRC-PM-001, SRC-PM-008 |
| FR-PM-040 | Catalog inclusions — visibility assignments | SRC-PM-004, SRC-PM-008 |
| FR-PM-041 | No visible inclusion blocks publish | SRC-PM-004 |
| FR-PM-042 | "Who Sees What" group-first tab | SRC-PM-001, SRC-PM-007 |
| FR-PM-043 | Wrong brand/group warning in share flow | SRC-PM-001, SRC-PM-004 |
| FR-PM-050 | Dealer catalog view kinds | SRC-PM-001, SRC-PM-004, SRC-PM-007 |
| FR-PM-051 | Catalog view data model | SRC-PM-004, SRC-PM-007 |
| FR-PM-052 | Catalog view creation wizard | SRC-PM-007 |
| FR-PM-053 | resolverKey joins rule engine to catalog view | SRC-PM-001, SRC-PM-004 |
| FR-PM-054 | Specific dealer groups: Next Star, Apex, Service Experts, ARS, Aire Serv | SRC-PM-001 |
| FR-PM-060 | Versioned immutable catalog snapshots | SRC-PM-004, SRC-PM-007 |
| FR-PM-061 | Snapshot diff/compare before publish | SRC-PM-004, SRC-PM-007 |
| FR-PM-062 | Snapshot rollback | SRC-PM-004, SRC-PM-007 |
| FR-PM-063 | FILE_IMPORT blocked from snapshot publish | SRC-PM-004 |
| FR-PM-070 | Catalog rule sets with conditions and actions | SRC-PM-001, SRC-PM-004 |
| FR-PM-071 | Only one active rule set at a time | SRC-PM-004 |
| FR-PM-072 | Rule set preview required before activation | SRC-PM-004 |
| FR-PM-073 | Rule condition options from governed reference tables | SRC-PM-004 |
| FR-PM-074 | Rule engine replaces manual catalog audience targeting | SRC-PM-001, SRC-PM-004 |
| FR-PM-075 | Apex dealer catalog view + discount via checkout | SRC-PM-001 |
| FR-PM-080 | Product publish validation — 9 checks | SRC-PM-004, SRC-PM-008 |
| FR-PM-081 | BLOCKED check prevents portal publish | SRC-PM-004 |
| FR-PM-082 | Workflow metric strip in back-office | SRC-PM-007 |
| FR-PM-090 | Asset assignments by role on presentations | SRC-PM-004, SRC-PM-008 |
| FR-PM-091 | Dealer-visible asset filter conditions | SRC-PM-004 |
| FR-PM-092 | Brand mismatch BLOCKED / region mismatch WARNING | SRC-PM-004 |
| FR-PM-093 | AWS S3 + CloudFront; no Widen dependency in Pulse | SRC-PM-001 |
| FR-PM-100 | Dealer portal catalog view resolution via active snapshot | SRC-PM-001, SRC-PM-004 |
| FR-PM-101 | Dealer portal search/filter/sort | SRC-PM-001 |
| FR-PM-102 | Dealer portal shows account price class from Acumatica | SRC-PM-001 |
| FR-PM-103 | Billing locked in checkout | SRC-PM-001 |
| FR-PM-104 | Add to cart + place order | SRC-PM-001 |
| FR-PM-105 | Past-due / credit-hold indicator in dealer portal | SRC-PM-001 |
| NFR-PM-001 | Product list load performance | (inferred standard) |
| NFR-PM-002 | Snapshot publish performance | (inferred standard) |
| NFR-PM-003 | Audit trail on all mutations | SRC-PM-004 |
| NFR-PM-004 | RBAC: view / manage / publish | SRC-PM-004, SRC-PM-005 |
| NFR-PM-005 | FILE_IMPORT publish guard is server-enforced | SRC-PM-004 |
| NFR-PM-006 | Rule set activation blocked on unmatched accounts | SRC-PM-004 |
| NFR-PM-007 | Asset visibility filtering server-side | SRC-PM-004 |
| NFR-PM-008 | Multi-region / multi-brand catalog isolation | SRC-PM-004 |
| NFR-PM-009 | No 100-variant ceiling (Shopify limitation removed) | SRC-PM-001, SRC-PM-004 |
| NFR-PM-010 | Accessibility WCAG 2.1 AA | SRC-PM-007 — (inferred standard) |
| NFR-PM-011 | Rule set activation observability | SRC-PM-004 |

---

## Build Status Summary

| Area | Status |
|------|--------|
| Base product catalog + search/filter | Built |
| Product families CRUD | Built |
| Product categories (catalog sections) CRUD | Built |
| Product presentations lifecycle | Built |
| Catalog inclusions (visibility assignments) | Built |
| Dealer catalog views (all kinds) | Built |
| Catalog view creation wizard | Built |
| Dealer catalog snapshots (publish, compare, rollback) | Built |
| FILE_IMPORT publish guard | Built |
| Catalog rule engine (create, update, preview, activate) | Built |
| Product publish validation (9 checks) | Built |
| Asset role assignments and brand/region filtering | Built |
| AWS S3 + CloudFront asset store (no Widen dependency) | Built |
| Legacy Shopify CSV import pipeline | Built |
| Group-first navigation enforcement (hard gate) | Partial |
| Shareable asset link "share" action UI | Partial |
| Wrong brand/group confirmation dialog in share flow | Partial |
| Specific dealer group data setup (Next Star, Apex, SE) | Partial (data setup, not code) |
| Dealer portal catalog read path (module 12) | Not-built (module 12) |
| Dealer portal search / sort / filter UX | Not-built (module 12) |
| Dealer portal price display from Acumatica price class | Not-built (modules 12 + 15) |
| Dealer portal checkout (cart, place order, locked billing) | Not-built (module 12) |
| Past-due / credit-hold indicator in dealer portal | Not-built (modules 12 + 06) |
| FILE_IMPORT → Acumatica reconciliation upgrade path | Not-built |
