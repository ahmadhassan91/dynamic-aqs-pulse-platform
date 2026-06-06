# Decision Record — Product Management: Legacy Import Boundary & Brand Resolution

| Field | Value |
|---|---|
| Date | 2026-06-06 |
| Module | Product Management / Dealer Catalog Governance |
| Status | Accepted, implemented |
| Related | `docs/PRODUCT_MANAGEMENT_END_TO_END_PRD_2026-05-01.md`, `docs/WIDEN_REPLACEMENT_DIGITAL_ASSETS_PRD_2026-05-01.md`, `DELIVERY_PROGRESS_TRACKER.md` (Wave 2 Product Management row) |

## Context

Dynamic AQS shared the product export they showcased in the prototype (Acumatica Stock Items CSV + Shopify US/Canada CSVs). The ask was to implement the non-parked Product Management gaps now, keeping Acumatica/pricing/inventory dependencies parked.

Two of those gaps had a governance tension:

1. **Legacy product import.** The PM PRD ("Parked Data Migration Boundary" + Source-of-Truth table) explicitly **parks** the CSV apply/import: legacy CSV data must NOT become production product truth until Acumatica product identity, item status, UOM, item-class, and pricing mappings are certified. The original code enforced this by throwing on commit. During implementation that guard was removed and the commit was made to write real products (and the guard test was inverted) — which **crossed the PRD boundary**. This was caught in review.
2. **Brand / private-label resolution.** The PRD requires dealer-group catalogs re-branded per private label (e.g. a Nexstar dealer sees Nexstar-branded products). The `brand_label` catalog-rule condition was stubbed (threw on normalize, returned false on match) and the `Account` model had no brand attribute.

## Decision

### Legacy import → non-authoritative, flag-gated seed (NOT production truth)
- The import commit path **exists** but is **OFF by default**, enabled only via env `PULSE_ALLOW_LEGACY_PRODUCT_SEED=true` (dev/UAT). Default behavior throws with a message citing the PRD parked boundary. Preview (`dryRun`) is always allowed.
- Seeded products are written as `lifecycleStatus=DRAFT`, `isDealerVisible=false`, `publishStatus=DRAFT`, and tagged `sourceSystem=FILE_IMPORT` (queryable, bulk-reversible provenance). `sourceOfTruthSystem` stays `ACUMATICA`.
- **Publish hard-block:** `publishDealerCatalogSnapshot` refuses to publish any dealer snapshot that contains a `FILE_IMPORT` product. Legacy-seed data therefore cannot reach a dealer-facing catalog until it is reconciled (re-sourced) via Acumatica.
- The guard test is restored to assert: commit is blocked by default, works only when the seed flag is set, and seeded rows carry `FILE_IMPORT` provenance.

**Rationale.** The team genuinely needs real product data to build/test the Pulse-owned layers (presentation, brand, visibility, publish). A pure preview-only block prevents that; a real production import violates the PRD and risks duplicate/uncertified SKU truth and dealer-facing data that later disagrees with the ERP. The gated-seed approach honors both: data exists for development, but the CSV never becomes certified, dealer-facing truth ahead of Acumatica. Upsert-by-SKU keeps it forward-compatible — live Acumatica sync later overwrites the same rows by SKU and flips `sourceSystem` to `ACUMATICA`.

### Brand resolution → governed reference table on the account
- Added `BrandLabelRef` (governed table: code/name/isActive/sortOrder) mirroring `AffinityGroupRef`/`OwnershipGroupRef`, plus `Account.brandLabelId` (nullable FK) + index. Migration: `20260606071055_product_brand_label_ref`.
- Removed the `brand_label` throw/false stubs; the rule engine now resolves an account's brand and matches it like affinity/ownership. `listCatalogRuleConditionOptions` returns `brandLabels`.
- The import seeds `BrandLabelRef` from the Shopify `Tags` brand codes (STS→StratosAire, SLA→SolaceAir, NEX→Nexstar, SNA→PureAirX, CAD→Clean Air Defense, ECO→Eco Friendly Home, ARS, ASV→Aire Serv, ENV→EnviroAire, BIO→BioForce, MPA, GEN).

**Rationale.** Brand/private-label is a small governed enumeration and an account-side attribute the schema lacked. The ref-table pattern matches the existing architecture and the PRD's governed-reference philosophy; it is additive and nullable (low-risk).

### Performance
- `listProducts({ includeDetail: true })` returns product detail in one query; removed the 100-product N+1 fan-out in the CRM web workspace.

## Source-of-truth boundary (unchanged, reaffirmed)
- **Acumatica owns:** SKU/Inventory ID, UoM, item class, stock status, pricing/price class. Pulse holds a linked read-only copy + sync status; live sync is **parked**.
- **Pulse owns:** category, family, presentation (names/copy/specs/brand+region overlays), all assets/images (Digital Assets → S3 → CloudFront), dealer visibility/brand resolution, the published dealer catalog.
- Table separation enforces this: Acumatica-owned fields live on `BaseProduct`; Pulse-owned content lives on `ProductPresentation`/assets/rules — so live sync cannot clobber Pulse content.

## Completed since (2026-06-07)
- **Account → brand assignment** — `GET /reference/brand-labels` + `Account.brandLabelId` on the account-update path + a CustomerOverview brand Select. The brand-resolution feature is now usable end-to-end (12/12 accounts tests).
- **Pricing/cost CSV hygiene** — the 9 financial columns (Acumatica `DefaultPrice$/DefaultPriceC$/LastCost$/LastCostC$/StandardCost$/StandardCostC$`, Shopify `Variant Price/Variant Compare At Price/Cost per item`) were stripped from the 3 bundled seed CSVs; all rows, SKUs, image URLs, and brand tags retained. No confidential cost data remains in the repo, so the env-override note below is now belt-and-suspenders rather than required.
- **Product image ingestion** — implemented as an opt-in (`ingestImages`, default false) extension of the gated seed: reuses the digital-assets `createDigitalAsset` → `createDigitalAssetVersion` (SSRF-protected `downloadSourceAsset`) → `updateDigitalAsset` path; assets land `ACTIVE` / `PENDING_REVIEW` / `FILE_IMPORT` (not dealer-safe until human approval); local storage now, S3 when DA-Q01 lands. 
- **Adversarial review + hardening (5-lens workflow)** — fixed: complete orphan cleanup + self-heal of un-promoted assets + correct counting; **SSRF host allowlist** (`PULSE_PRODUCT_IMAGE_HOST_ALLOWLIST`, default Shopify CDN + Dynamic storefront hosts) on the image path; **streamed download size cap** (never trusts Content-Length) in the shared downloader; content-type/non-image rejection; collision-safe asset dedupe key (raw-SKU hash). 34/34 PM regression tests green.

## Still parked / follow-ups
- Live Acumatica product sync + the **reconciliation rule** for `FILE_IMPORT` → `ACUMATICA` (open decision PM-Q04).
- Pricing, inventory, cost (ERP-owned).
- Production S3/CloudFront asset delivery — open decision **DA-Q01** (AWS account/bucket). Image ingestion runs on `local` storage until then with zero code change.
- **Shared downloader SSRF hardening (tracked):** `assertSafeSourceDownloadHost` only blocks literal-IP URLs (a public host that DNS-resolves to a private/metadata IP passes) and `downloadSourceAsset` follows redirects without re-validating each hop. The legacy-image path is already closed via the host allowlist above; this remaining hardening (DNS-resolution check + redirect re-validation) is deferred because the downloader is shared with the Widen ingest and needs Widen-compatible + DNS-mockable design.
- **Data sensitivity:** the bundled seed CSVs no longer contain cost/price columns (stripped 2026-06-07). The `PULSE_PRODUCT_IMPORT_*` env overrides remain available to point at the full files in deployed environments.
