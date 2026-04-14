# Product Model, Variants, And Sync Implementation Guide

## Document Control
| Field | Value |
|-------|-------|
| Document Type | Source of Truth Guide |
| Version | 1.0 |
| Status | Active |
| Owner | Product / Architecture / Integration |
| Scope | Product model, Shopify legacy exports, Acumatica sync, branded presentation, schema validation |
| Primary Sources | `Meetings/Fri 27th  Feb Session 6.md`, `Meetings/20 Feb session 3 _ Discovery session 3 _ Validations.md`, `Meetings/13th March Discovery Session 9.md`, `prds/PRODUCT_MANAGEMENT_PRD.md`, `prds/ACUMATICA_INTEGRATION_PRD.md`, `architecture/DATABASE_SCHEMA.md`, `Meetings/Shopify US Products.csv`, `Meetings/Shopify Canada Products.csv` |

---

## 1. Executive Summary

For this program, a product is **not** a Shopify row.

The clean model is:

- `Acumatica` owns the base sellable item
- `Pulse` owns the business-facing product presentation and dealer visibility
- `Digital Assets` owns or references the files
- `Dealer Portal` shows the approved result

The Shopify exports are useful legacy reference data, but they are **not** the future master model.

---

## 2. What A Product Is In This Program

A product should be understood as:

1. a real sellable base item from Acumatica
2. optionally grouped into a product family with sibling sizes or related sellable SKUs
3. enriched in Pulse with business-facing content
4. filtered by dealer context before it appears in the portal

In practical terms:

- `BaseProduct` = the real underlying sellable item / SKU
- `ProductPresentation` = how that item is described and shown to the dealer
- `CatalogInclusion` = whether that presentation is visible for a dealer group
- `AssetAssignment` = which images, brochures, and files go with that presentation

That matches the intent already documented in [PRODUCT_MANAGEMENT_PRD.md](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/PRODUCT_MANAGEMENT_PRD.md) and [SYSTEM_ERD_BLUEPRINT.md](/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/architecture/SYSTEM_ERD_BLUEPRINT.md).

---

## 3. What A Variant Is, And What It Is Not

### What the Shopify CSVs show

The Shopify exports contain `781` US rows and `434` Canada rows, but only `262` unique US handles and `158` unique Canada handles. That means many rows are storefront variants, repeated rows, or multi-row option sets rather than unique products.

Observed option patterns in the exports:

- `Size`
- `Language`
- `UV Brochure`
- `Count`
- `Title`

Examples from the exports:

- UV units split by `12"` vs `16"` with different SKUs
- brochure/download rows split by `English` vs `Spanish`
- brochure pack/count rows like `50 / 100 / 150 / 200`
- Bold Commerce test products that are clearly storefront artifacts

### Correct future interpretation

Not every Shopify option row should become a first-class product variant in Pulse.

Use these rules:

- if it is a real sellable Acumatica item / SKU, model it as a `BaseProduct`
- if it is a sibling size or sibling sellable SKU, keep separate `BaseProduct` records but relate them by product family
- if it is a branding difference, use `ProductPresentation`
- if it is a language/download/file difference, use `DigitalAssetVersion` and `AssetAssignment`
- if it is a Shopify-only workaround or test row, do not carry it forward as part of the product master

### Important boundary

`Shopify variants` are mostly a legacy storefront packaging mechanism.

They are **not** the future canonical domain model for Pulse.

---

## 4. How Private Label And Brand-Specific Presentation Work

Discovery is explicit that the same underlying product may show different:

- names
- descriptions
- images
- brochures
- brand labels
- dealer-facing assortment

depending on:

- private label / brand
- affinity group
- ownership context
- region

This means:

- do **not** duplicate the base SKU per brand
- do **not** treat brand differences as separate core products
- do use presentation and asset layers to produce brand-specific dealer experiences

The key implementation rule is:

```text
one base product
  -> many branded presentations
  -> many asset assignments
  -> many dealer-group visibility decisions
```

---

## 5. What The Shopify US And Canada CSVs Tell Us

### Common patterns

Both exports contain:

- real sellable product rows
- many repeated handle rows
- option rows for size and language
- marketing/training rows
- image/file URLs

### US-specific observations

- `262` unique handles from `781` rows
- status values include `active`, `draft`, and `archived`
- contains `Bold Commerce` test products
- contains more storefront residue and legacy noise than Canada
- broader tag spread including multi-brand tag bundles

### Canada-specific observations

- `158` unique handles from `434` rows
- only `active` rows were populated in the status field
- cleaner vendor set than US
- different branded naming, especially `Modern PURAIR`
- separate regional storefront shape consistent with Dan’s explanation that US and Canada were split because Shopify could not handle multi-currency cleanly

### Critical interpretation

The CSVs are best treated as:

- legacy catalog reference
- legacy presentation reference
- image URL source
- migration aid

They should **not** be treated as the long-term master product model.

---

## 6. How Products Get Into Pulse

### Target production flow

1. `Acumatica` provides the base item feed
2. Pulse creates or refreshes `BaseProduct`
3. Business enriches dealer-facing content in `ProductPresentation`
4. Product / marketing attaches the right files from Digital Assets
5. Product / portal admin defines who sees it through `CatalogInclusion`
6. Approved catalog is published to Dealer Portal

### Transitional flow

During discovery and early visualization:

- Dan shared Shopify CSV exports
- image URLs in those CSVs were explicitly treated as a useful source during transition

That is a demo/migration aid, not the target integration pattern.

---

## 7. Source Of Truth By Product Concern

| Concern | System of Truth |
|---------|-----------------|
| Base item identity / SKU / InventoryID | `Acumatica` |
| Active/inactive item baseline | `Acumatica` |
| Item class / UOM / inventory-side attributes | `Acumatica` |
| Business-facing display name and description | `Pulse` |
| Brand/private-label presentation | `Pulse` |
| Dealer visibility | `Pulse` |
| Images / brochures / spec sheets / download files | `Digital Assets` with transitional legacy references where needed |
| Final dealer-facing product catalog | `Pulse approved publish feed` |

---

## 8. Development Rules To Preserve

### Rule 1. Keep SKU truth in Acumatica

Pulse should not invent a second product identity.

### Rule 2. Keep sellable items separate from collateral

Brochures, language files, and marketing sheets from Shopify exports should not become core products unless they are genuinely sold items.

### Rule 3. Keep brand differences in presentation, not product identity

If the same underlying item appears as different brands, that belongs in `ProductPresentation` and `AssetAssignment`, not duplicate core products.

### Rule 4. Keep dealer visibility separate from pricing

Catalog visibility uses dealer-group logic. Pricing uses price-class logic.

### Rule 5. Do not import Shopify storefront artifacts as domain truth

Examples:

- Bold test products
- empty repeated variant rows
- storefront-only option constructs

---

## 9. Schema Validation

## What already aligns well

The current schema is directionally strong because it already separates:

- `BaseProduct`
- `ProductPresentation`
- `CatalogInclusion`
- `DigitalAsset` / `AssetAssignment`
- `PriceClass` / `PriceEntry`

That matches the correct business separation:

- base item
- business-facing presentation
- visibility
- files
- pricing

## Gaps revealed by the CSV and meetings

### Gap 1. No explicit product family grouping

The exports clearly show sibling sellable SKUs such as size-based families. The schema would be stronger if it explicitly supported product-family grouping so related items can be compared, navigated, and governed together without pretending they are one SKU.

### Gap 2. Sellable-vs-collateral needs to stay explicit

The Shopify exports mix sellable items and collateral-like rows. The schema separation exists conceptually, but development must be strict in import rules so collateral does not pollute `BaseProduct`.

### Gap 3. Variant semantics should not be left ambiguous

The schema should make it clear that:

- true sellable SKU differences are separate `BaseProduct` items
- language/file differences are assets
- brand differences are presentations

That avoids accidental “Shopify variant cloning” in Pulse.

---

## 10. Final Architecture Verdict

The current model is **mostly correct** for the target state.

The most important thing is not to introduce a generic Shopify-style variant table just because the export has repeated rows.

The right model is:

```text
Acumatica item / SKU
  -> BaseProduct

Related sibling sellable items
  -> same product family

Brand / region-specific business-facing view
  -> ProductPresentation

Dealer-specific visibility
  -> CatalogInclusion

Language / brochure / image / spec-sheet differences
  -> DigitalAssetVersion + AssetAssignment
```

That is the cleanest path for build, migration, and integration.
