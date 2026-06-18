# Digital Assets / DAM PRD

## Document Control

| Field | Value |
|-------|-------|
| Module | Digital Assets — Digital Asset Management (DAM) |
| Document Type | Master PRD |
| Version | 1.1 |
| Status | Draft — initial creation, traceability-complete; v1.1 applies 2026-06-18 scope-accuracy corrections (see "Scope corrections (2026-06-18)") |
| Owner | Product / Marketing Operations |
| Sprint Sequence | Seq 06–07 |
| Priority | P1 |
| Meeting Traceability | Session 12 (24 March 2026) — Johan Ericsson (Digital Asset / Widen SME), Adrienne Cardinale (Marketing), Don Hearn (Field Ops / Regional Director), C G, Ahmad Hassan |
| Primary Companion Docs | `05_CONSIGNMENT_PRD.md`, `09_ADMIN_MASTER_DATA_CONFIG_PRD.md` |

---

## Meeting Traceability

| Session | Date | Speakers Cited | Key Topics |
|---------|------|----------------|-----------|
| Session 12 — Reporting and Widen | 24 March 2026 | Johan Ericsson (SME), Adrienne Cardinale, Don Hearn, C G, Ahmad Hassan, Dan Harshbarger | Widen demo + pain-point walkthrough, stable-URL behaviour, portal vs. collection semantics, TM field-access problem, SEO / CDN architecture decision, AWS S3 + CloudFront replacement proposal, asset sharing via link, dealer/TM asset access workflow |

---

## Scope corrections (2026-06-18)

A 2026-06-18 scope-accuracy audit re-verified client-attributed requirements against the actual cited Session 12 transcript. Two corrections apply to this PRD. No requirements are removed; the corrections re-attribute and re-frame existing content.

- **(HIGH) The "Decision reached in Session 12: replace Widen with S3 + CloudFront" framing was a vendor proposal the client was amenable to, not a ratified decision.** At session close the prototype was *pending review*: Ahmad Hassan said he would "shape that so you guys can see this can be a [re]placement for widen … upload a link," and C G replied "We'll look for that link." No client line ratified the replacement or the architecture. The Executive Overview "Decision reached" line and the Out-of-Scope "Pulse DAM replaces Widen entirely" line are reframed as **vendor-proposed; client review pending** — a proposal consistent with the still-open OQ-DAM-001 (migration timeline) and OQ-DAM-002 (portal behaviour), not a closed decision.
- **(LOW) FR-DAM-009 brand-scope evidence is mis-attributed.** The brand-site scoping quote is **Johan Ericsson** (in the context of multi-site propagation), not Adrienne Cardinale. The scope-field granularity (brand / region / dealer group type / dealer group ID) is **code-derived** from the built service, not stated by the client. Substance of the requirement is sound; only the speaker attribution and sourcing basis are corrected.

Full audit: `docs/SCOPE_ACCURACY_AUDIT_2026-06-18.md`.

---

## 1. Source Inventory

| ID | Absolute Path | What It Sourced |
|----|--------------|-----------------|
| SRC-DAM-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24th March - Session 12 - Reporting and Widen .md` | Complete session 12 transcript; all Widen requirements, pain points, stable-URL requirement, CDN/SEO decision, portal/collection semantics, TM field-access friction, dealer share workflow |
| SRC-DAM-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/digital-assets/service.ts` | Built API service: asset CRUD, version management, share links, collections, Widen manifest import pipeline, product-asset assignments, access-control assertions |
| SRC-DAM-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/digital-assets/http.ts` | Built HTTP routes: all API endpoints, auth/role guards, method constraints |
| SRC-DAM-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/digital-assets/storage.ts` | Built storage layer: AWS S3 upload via `@aws-sdk/client-s3`, CloudFront public URL construction, local-disk fallback, path-traversal guard, key schema `digital-assets/{assetId}/v{n}/{fileName}` |
| SRC-DAM-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/digital-assets/DigitalAssetsWorkspace.tsx` | Built CRM-web UI: Library tab, Share Sets (collections) tab, Delivery Health tab, Migration tab, bulk upload, version add, share-link create/revoke, filter, approve workflow |

> Note: The `.docx` version of meeting transcripts was not read; the `.md` equivalent (SRC-DAM-001) was used and is complete. No unreadable sources.

---

## 2. Executive Overview

Dynamic AQS currently uses Widen Collective as its Digital Asset Management (DAM) platform to store and share marketing assets — brochures, spec sheets, product photos, videos, and brand materials. The system is used primarily by Johan Ericsson (Marketing) to publish assets, and by Territory Managers (TMs) and residential/commercial teams to find and share assets with prospects and customers.

**Pain points confirmed in Session 12:**
- Widen has no usable mobile app; TMs are forced to use the desktop site on their phones, which is "worthless" (Don Hearn, SRC-DAM-001 14:46)
- Replacing an asset version is a multi-step "conflicted upload" workflow with no inline replace button (Johan Ericsson, SRC-DAM-001 07:36–08:44)
- Collections and portals are confusing; portals bypass security rules while collections respect them; neither is intuitive (SRC-DAM-001 04:23–05:14)
- Assets served from the Widen domain forfeit SEO credit; Dan Harshbarger explicitly requested CDN-served content routed through the Dynamic AQS domain (SRC-DAM-001 29:10–32:02)
- No single-click share for TMs in the field (SRC-DAM-001 18:17–19:33)

**Decision reached in Session 12:** Replace Widen with a Pulse-native DAM backed by AWS S3 (object storage) + CloudFront (CDN). Assets will be served through the Dynamic AQS domain, recovering SEO credit. Ahmad Hassan confirmed this is achievable (SRC-DAM-001 31:03–32:02). — ⚠️ CORRECTED 2026-06-18: vendor-proposed, client review pending; not a ratified decision (see Scope corrections)

---

## 3. In-Scope

- Asset library: upload, version, approve, tag, and organise digital assets (images, documents, videos, logos, presentations)
- Stable URL / stable slug per asset: URL does not change when the file is replaced with a new version
- Version management: maintain a full version history; new upload replaces the "current" pointer without breaking existing links
- Share links: generate revocable, expiry-controlled links for sharing with prospects or customers, tracking access count
- Collections ("Share Sets"): group assets into named sets with visibility scoping, brand/region scoping, and membership management
- Dealer/TM-facing asset access: TMs can find and copy a share link from the mobile or CRM-web UI in two steps
- Product-asset assignments: link assets to product presentations by role (hero image, spec sheet, video, etc.)
- Delivery Health dashboard: surface assets with missing files, unapproved status, or active shares that need attention
- Widen migration: import Widen manifest (JSON/CSV), preview, commit; preserve legacy URLs as redirect aliases; batch audit trail
- AWS S3 + CloudFront storage backend with local-disk fallback for development
- Role-based access control: view / upload / edit / share / sync permissions per user role

---

## 4. Out-of-Scope

- Widen subscription continuation — Pulse DAM replaces Widen entirely — ⚠️ CORRECTED 2026-06-18: vendor-proposed, client review pending; not a ratified decision (see Scope corrections)
- Shopify product images — Johan Ericsson confirmed Widen is not used for Shopify (SRC-DAM-001 18:02); Shopify images remain outside this module
- E-commerce / shopping-cart integration
- AI-based asset tagging or auto-categorisation
- Video transcoding or streaming (store and serve raw video files only)

---

## 5. Parked Dependencies

| Item | Reason Parked |
|------|--------------|
| Widen API live sync | Widen access/API credentials not provided; manifest-import route is the migration path; live Widen sync is not in scope |
| Dealer Portal asset-facing UI | Dealer Portal module (separate PRD) owns the customer-facing portal surfaces; DAM owns the library and share infrastructure |
| SEO redirect cutover (legacy Widen URLs → Pulse CDN URLs) | Requires DNS/proxy configuration and an approved migration plan; migration aliases are stored but redirect activation is parked |
| Payment/billing integration | Not applicable to this module |

---

## 6. Functional Requirements

### 6.1 Asset Library

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|-------------|-----|
| FR-DAM-001 | The system shall maintain a library of digital assets, each with a unique `stableSlug`, title, description, kind (image / document / video / logo / presentation / other), status (draft / active / needs_review / archived / expired), visibility (internal_only / dealer_portal / public), audience, brand scope, and region scope. | Assets are retrievable by slug and filterable by all fields. A new asset defaults to `status=draft`, `visibility=internal_only`, `reviewStatus=pending_review`. | P0 | Built | SRC-DAM-002, SRC-DAM-005 |
| FR-DAM-002 | When a user uploads a new version of an existing asset, the system shall update the `currentVersionId` pointer and serve the new file at the same stable URL, without breaking any previously issued share links. | A share link issued before the upload continues to resolve correctly and returns the new file. Johan Ericsson: "even if you replace the asset…that link will not break." (SRC-DAM-001 10:12) | P0 | Built | SRC-DAM-001, SRC-DAM-002, SRC-DAM-004 |
| FR-DAM-003 | The system shall allow inline asset replacement — uploading a new version directly from the asset's detail view without a separate "conflicted upload" queue. | New version is created in one action from the asset detail panel; no separate conflict-resolution step is required. Johan Ericsson: "I would like to just be able to click into an asset…and just replace it from there." (SRC-DAM-001 07:36) | P0 | Built (version add form in detail rail) | SRC-DAM-001, SRC-DAM-005 |
| FR-DAM-004 | The system shall support bulk file upload, allowing multiple files to be uploaded in a single action with shared default settings (kind, visibility, audience, brand scope, region scope). | N files selected → N assets created with one version each; the last uploaded asset is selected in the detail rail. | P1 | Built | SRC-DAM-005 |
| FR-DAM-005 | The system shall support adding an asset by external URL (linking to an existing CDN or hosted file) without requiring a binary upload. | Asset version is created with `externalUrl` populated and `storageKey` null; `publicUrl` returns the external URL. | P1 | Built | SRC-DAM-002, SRC-DAM-005 |
| FR-DAM-006 | The system shall maintain a full version history for each asset, accessible from the asset detail view, with version number, file name, size, and created date. | Version list displays all historical versions; the current version is visually indicated. | P1 | Built (version list in detail) | SRC-DAM-002, SRC-DAM-005 |
| FR-DAM-007 | The system shall support a review/approval workflow: assets default to `reviewStatus=pending_review`; an authorised user can move an asset to `approved` or `rejected`; only approved (or `not_required`) assets with `dealer_portal` or `public` visibility can be shared externally. | Attempting to share a `pending_review` or `rejected` asset returns an error. "Asset must be approved before it can be shared externally." (service.ts line 377) | P0 | Built | SRC-DAM-002, SRC-DAM-005 |
| FR-DAM-008 | The system shall support full-text search across asset title, description, stable slug, Widen asset ID, legacy file name, legacy folder path, and searchable legacy metadata fields. | Search query returns matching assets; results are ordered by most-recently-updated. | P1 | Built | SRC-DAM-002 |
| FR-DAM-009 | The system shall allow assets to be scoped by brand, region, dealer group type, and dealer group ID so that a collection or assignment can be filtered to specific market segments. | Scoping fields are optional and combinable; collection visibility respects the scoping at membership level. Adrienne Cardinale confirmed brand-site scoped assets are needed (SRC-DAM-001 09:44) — ⚠️ CORRECTED 2026-06-18: quote is Johan (multi-site), scope-fields are code-derived | P1 | Built | SRC-DAM-001, SRC-DAM-002 |

### 6.2 Stable URLs and Storage (AWS S3 + CloudFront)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|-------------|-----|
| FR-DAM-010 | The system shall store asset binaries on AWS S3 using the key pattern `digital-assets/{assetId}/v{versionNumber}/{sanitisedFileName}`. | Object is PUTted to S3 with the correct key, content-type, and asset metadata; key is stored as `storageKey` on the version record. | P0 | Built | SRC-DAM-004 |
| FR-DAM-011 | The system shall serve assets through a CloudFront distribution so that the public URL is `https://{cloudFrontDomainName}/digital-assets/{assetId}/v{n}/{file}`, routed through the Dynamic AQS domain space, preserving SEO credit. | `buildPublicAssetUrl` returns a URL whose hostname is the configured CloudFront domain; no Widen-hosted URLs remain in live content. Dan Harshbarger: "I would love for our site to be grabbing it off of a CDN." (SRC-DAM-001 29:35) | P0 | Built (CloudFront URL construction in storage.ts; env-var configured) | SRC-DAM-001, SRC-DAM-004 |
| FR-DAM-012 | The `stableSlug` on each asset shall be immutable after creation; changing the file or its name shall not change the slug or any derived public path for the asset's share links. | A share link generated before renaming the file continues to resolve after the rename. Johan Ericsson: "you can even change the file name and it'll still…not break." (SRC-DAM-001 10:12) | P0 | Built | SRC-DAM-001, SRC-DAM-002 |
| FR-DAM-013 | Where `APP_STORAGE_PROVIDER` is not `s3` (development / local), the system shall fall back to local-disk storage, resolving paths within the configured `PULSE_STORAGE_ROOT_DIR` with a path-traversal guard. | Uploading a file in local mode writes to `{rootDir}/digital-assets/{assetId}/v{n}/{file}`; paths outside rootDir are rejected. | P1 | Built | SRC-DAM-004 |
| FR-DAM-014 | When ingesting a Widen source download, the system shall enforce a 100 MB per-file cap, reject private-network / localhost source URLs, abort the HTTP request on the cap being exceeded, and never trust `Content-Length` alone. | Attempting to ingest a file exceeding 100 MB or from a private IP throws an error and records a migration issue; the process does not OOM. | P0 | Built | SRC-DAM-002 |

### 6.3 Share Links

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|-------------|-----|
| FR-DAM-015 | The system shall allow an authorised user to generate a revocable share link for any approved, non-archived, non-internal asset. The link is a single-click URL that the TM can copy and send via text, email, or any channel. | Share link is created, the URL is copied to clipboard in one action from the asset library. Adrienne Cardinale: "the ability to quickly…copy link to this video and then paste the link in a text message." (SRC-DAM-001 23:04) | P0 | Built | SRC-DAM-001, SRC-DAM-002, SRC-DAM-005 |
| FR-DAM-016 | Each share link shall carry an expiry date (1–365 days, default 30) and an access counter; accessing the link increments `accessCount` and stamps `lastAccessedAt`. | `GET /api/v1/digital-assets/shares/{token}` resolves the URL, increments the counter, and redirects (HTTP 302) to the public CDN URL. Expired or revoked links return an error and do not redirect. | P0 | Built | SRC-DAM-002 |
| FR-DAM-017 | The system shall allow share links to be revoked at any time by an authorised user; a revoked link shall return an error response if accessed. | `revokedAt` is set; subsequent access to the token returns an error. The UI surfaces a "Revoke" action on each active share link. | P0 | Built | SRC-DAM-002, SRC-DAM-005 |
| FR-DAM-018 | A share link shall optionally capture the recipient type (prospect / dealer / other), recipient name, recipient email, and a contextual link to a CRM entity (e.g. a lead or account). | Share form fields are optional; filled values are stored and visible in the share link record. | P1 | Built | SRC-DAM-002, SRC-DAM-005 |
| FR-DAM-019 | The "Copy customer link" action in the Library shall detect an existing active share link for the selected asset and copy it directly; it shall create a new share link only when none exists. | Clicking the primary action when an active link exists copies that link without creating a duplicate. When no active link exists, a new one is created and copied. | P1 | Built | SRC-DAM-005 |

### 6.4 Collections ("Share Sets")

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|-------------|-----|
| FR-DAM-020 | The system shall support named Collections (labelled "Share Sets" in the UI), which are curated groups of assets with a unique code, visibility scope, optional brand/region scope, and active/inactive toggle. | A Share Set with `visibility=dealer_portal` can only show assets that themselves have `dealer_portal` or `public` visibility to that user. Johan Ericsson: "collections…you can only view within a collection, what you're authorized to view." (SRC-DAM-001 04:23) | P0 | Built | SRC-DAM-001, SRC-DAM-002, SRC-DAM-005 |
| FR-DAM-021 | The system shall allow assets to be added to or removed from a collection via a membership upsert that respects sort order. | A collection listing shows the items in `sortOrder` order; an item can be moved without removing and re-adding it. | P1 | Built | SRC-DAM-002 |
| FR-DAM-022 | Collections shall support dealer-group scoping (`dealerGroupType` / `dealerGroupId`) for cases where a share set is intended for a specific dealer group type only. | The filter combination of `dealerGroupType + dealerGroupId` uniquely identifies the intended audience; this is used at the Dealer Portal rendering layer. | P2 | Built (data model) | SRC-DAM-002 |
| FR-DAM-023 | The residential vs. commercial portal split desired by Don Hearn shall be achievable through separate collections scoped by region or dealer group, without requiring separate Pulse environments. | Two collections exist: one scoped to `residential`, one to `commercial`; each renders the correct assets without cross-contamination. Don Hearn: "There should be residential portal, then commercial." (SRC-DAM-001 20:50) | P1 | Partial (data model built; UI surfacing of residential/commercial collections is not yet implemented) | SRC-DAM-001, SRC-DAM-002 |

### 6.5 Dealer / TM Asset Access

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|-------------|-----|
| FR-DAM-024 | A TM in the field shall be able to find and share an asset in two steps: (1) open the Digital Assets module, (2) select the asset and copy the share link. | On mobile browser or mobile app, the library shows approved share-ready assets by default; the "Copy customer link" button is accessible without scrolling. Don Hearn: "the biggest reason is, it doesn't work very good on your phone." (SRC-DAM-001 20:14) | P0 | Partial (CRM-web library is mobile-accessible; dedicated mobile-app surface for digital assets is not yet built) | SRC-DAM-001, SRC-DAM-005 |
| FR-DAM-025 | The asset library shall default to showing only approved, `dealer_portal` or `public` visibility, share-ready assets; a "Review All Files" toggle shall reveal internal and unapproved assets for admin users. | Non-admin TM arriving at the library sees only share-ready assets; admin toggling "Review All Files" reveals the full library. | P0 | Built | SRC-DAM-005 |
| FR-DAM-026 | The library shall support filtering by asset kind (image / document / video / logo / presentation / other) and visibility, and full-text search. | Applying a kind filter returns only assets matching that kind; search is case-insensitive and matches across title, description, and metadata. Adrienne Cardinale: "it's not super easy to see what's where and be able to get to that asset without a lot of digging." (SRC-DAM-001 11:50) | P0 | Built | SRC-DAM-001, SRC-DAM-005 |
| FR-DAM-027 | The library shall support both card and list view modes, selectable per user session. | Card view shows thumbnail-style cards with type badge, visibility badge, usage count, and share count. List view shows a compact table. | P2 | Built | SRC-DAM-005 |

### 6.6 Product-Asset Assignments

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|-------------|-----|
| FR-DAM-028 | The system shall allow digital assets to be assigned to a product presentation by role (hero image, spec-sheet, video, logo, etc.), optionally scoped by dealer group, brand label, or region. | An assignment links `presentationId` + `assetId` + `role`; the combination of `presentationId + assetId + role + dealerGroupType + dealerGroupId + brandLabel + regionScope` is unique. Ahmad Hassan demonstrated product detail view with linked assets (SRC-DAM-001 01:07:22). | P1 | Built | SRC-DAM-001, SRC-DAM-002 |
| FR-DAM-029 | The system shall allow the product-management module to unlink a product-asset assignment. | `DELETE /api/v1/digital-assets/product-assignments/{assignmentId}` removes the assignment and creates an audit entry. | P1 | Built | SRC-DAM-002, SRC-DAM-003 |
| FR-DAM-030 | The asset detail view shall show all products that use the asset, including the product SKU, product name, presentation name, and assignment role. | The `productUsages` array is populated on `getDigitalAssetDetail`; each row shows the required fields. | P1 | Built | SRC-DAM-002, SRC-DAM-005 |

### 6.7 Delivery Health

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|-------------|-----|
| FR-DAM-031 | The system shall maintain a Delivery Health view that surfaces: (a) assets with no current version file, (b) assets with `reviewStatus != approved`, (c) assets with active share links. The view shall also show four KPI metrics: ready assets count, needs-review count, missing-file count, active-shares count. | The Delivery Health tab lists the union of all three categories; KPI cards show the four counts. An "Review Items" button navigates to the first flagged asset in the Library. | P1 | Built | SRC-DAM-005 |
| FR-DAM-032 | An alert on the Migration tab shall note when Widen manifest rows have not been supplied, preventing inadvertent empty-batch commits. | Manifest preview with no rows surfaces a warning: "No Widen manifest rows were supplied." and the commit button is disabled. | P1 | Built | SRC-DAM-002, SRC-DAM-005 |

### 6.8 Widen Migration

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|-------------|---------------------|----------|-------------|-----|
| FR-DAM-033 | The system shall accept a Widen manifest as a JSON array, a JSON object with `rows`/`assets`/`items`, or a CSV export, and convert it to Pulse `DigitalAsset` + `DigitalAssetVersion` records. | A valid manifest ingested via `POST /api/v1/digital-assets/widen-manifest/commit` produces the expected `assetsCreated`, `assetsUpdated`, `versionsCreated` counts in the response. | P0 | Built | SRC-DAM-002 |
| FR-DAM-034 | The system shall preserve legacy Widen URLs as `DigitalAssetMigrationAlias` records with `redirectStatus=pending`, enabling a future redirect cutover without data loss. | After import, each asset with a `legacyUrl` has a corresponding alias record queryable by `sourceSystem + legacyUrl`. | P0 | Built (data persisted; redirect activation is Parked) | SRC-DAM-002 |
| FR-DAM-035 | A dry-run preview endpoint shall return a summary of what would be imported (source record count, valid/invalid/warning/error counts, sample of first 50 rows) without writing any records. | `POST /api/v1/digital-assets/widen-manifest/preview` with `dryRun: true` returns summary and sample rows; zero DB writes occur. | P1 | Built | SRC-DAM-002, SRC-DAM-003 |
| FR-DAM-036 | The system shall optionally ingest asset binaries from Widen download URLs during the commit phase, up to a configurable per-run limit (default 25, max 200), subject to the 100 MB per-file cap and SSRF guard. | With `ingestSourceDownloads: true`, the commit phase downloads files and stores them in S3; failures are recorded as migration issues without failing the entire batch. | P1 | Built | SRC-DAM-002, SRC-DAM-004 |
| FR-DAM-037 | The system shall track each migration batch in `DigitalAssetMigrationBatch` records, storing source system, batch code, import counts, error counts, and the raw manifest (bounded to 5 MB). | Each commit creates a migration batch record; the batch list endpoint returns up to 50 batches ordered by most-recently-created. | P1 | Built | SRC-DAM-002 |
| FR-DAM-038 | When a manifest row has neither a Widen asset ID nor a legacy URL, the system shall record an error-severity issue and skip that row without aborting the batch. | A row with no identity fields produces a `missing_identity` issue; `invalidRowCount` is incremented; the batch status is `imported_with_issues`. | P1 | Built | SRC-DAM-002 |
| FR-DAM-039 | Duplicate Widen asset IDs within a single manifest shall produce a warning-severity issue per duplicate row, allowing the import to continue but flagging the conflict. | Manifest with two rows sharing the same `widenAssetId` produces `duplicate_external_asset_id` warnings on both rows; the second row's upsert updates the first record. | P2 | Built | SRC-DAM-002 |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement | Priority | Source |
|----|----------|-------------|----------|--------|
| NFR-DAM-001 | Performance | Asset library list (up to 200 assets) shall respond within 500 ms at p95 under normal load. Single asset detail (with versions + share links + product usages) shall respond within 800 ms. | P0 | (inferred standard) |
| NFR-DAM-002 | Performance | CloudFront CDN shall serve asset files from the nearest edge location, targeting < 200 ms TTFB globally for files already cached. Ahmad Hassan: "if someone is accessing that link in New York, it will route the traffic through that nearest New York server so they will get that instantly." (SRC-DAM-001 32:29) | P0 | SRC-DAM-001 |
| NFR-DAM-003 | Performance | Widen manifest commit for up to 1,000 rows shall complete within 60 seconds (the Prisma transaction timeout configured in `service.ts`). | P1 | SRC-DAM-002 |
| NFR-DAM-004 | Security / AuthZ | All DAM API endpoints shall require an authenticated session. `digital_asset.view` is required to read; `digital_asset.upload` to create/version; `digital_asset.edit` to update metadata and collections; `digital_asset.share` to create/revoke share links; `digital_asset.sync` to run migration. | P0 | SRC-DAM-002, SRC-DAM-003 |
| NFR-DAM-005 | Security | Share link tokens shall be stored as SHA-256 hashes only; the raw token is never persisted. A token is a concatenation of two UUIDs with hyphens stripped (64 hex chars). | P0 | SRC-DAM-002 |
| NFR-DAM-006 | Security | Only assets with `visibility=dealer_portal` or `visibility=public` AND `reviewStatus=approved` (or `not_required`) AND `status != archived/expired` can be shared externally via share links. Internal-only assets cannot be shared. | P0 | SRC-DAM-002 |
| NFR-DAM-007 | Security | The source-download ingestion pipeline shall reject localhost, `.local`, and all RFC-1918/RFC-4193 private-network IP addresses to prevent SSRF. Ingestion requires `https://` scheme only. | P0 | SRC-DAM-002 |
| NFR-DAM-008 | Security | The local-disk storage path shall be resolved with a traversal guard: if the resolved path falls outside `PULSE_STORAGE_ROOT_DIR`, the write is rejected with an error. | P0 | SRC-DAM-004 |
| NFR-DAM-009 | Scalability | The asset library list endpoint accepts a `limit` parameter capped at 200; the default is 50. Manifest rows are capped at 10,000 per run. | P1 | SRC-DAM-002 |
| NFR-DAM-010 | Availability | The DAM module shall remain functional when the Widen migration pipeline is not running; core asset-library and share-link functions shall not depend on Widen connectivity. | P0 | SRC-DAM-002 |
| NFR-DAM-011 | Auditability | Every create, update, import, and delete action on `DigitalAsset`, `DigitalAssetVersion`, `DigitalAssetShareLink`, `DigitalAssetCollection`, `ProductAssetAssignment`, and `DigitalAssetMigrationBatch` shall produce an `AuditEntry` record with actor user ID, before/after data snapshots, and action type. | P0 | SRC-DAM-002 |
| NFR-DAM-012 | Auditability | Share link access events shall increment `accessCount` and record `lastAccessedAt` on the share link record, giving a usage audit trail for each shared file. | P1 | SRC-DAM-002 |
| NFR-DAM-013 | Accessibility | The Library and Share Sets views shall be keyboard-navigable and meet WCAG 2.1 AA contrast requirements. | P2 | (inferred standard) |
| NFR-DAM-014 | Observability | Storage errors (S3 PutObject failure, local disk write failure, source download failure) shall surface as thrown exceptions that are caught by the HTTP error handler and returned as 400-level responses with descriptive messages; they shall not silently swallow data. | P0 | SRC-DAM-002, SRC-DAM-004 |
| NFR-DAM-015 | Data Retention | Asset records and version records shall not be hard-deleted; archival via `status=archived` is the soft-delete pattern. Migration batch records and aliases are retained indefinitely for redirect cutover planning. | P1 | (inferred standard) |
| NFR-DAM-016 | SEO | Asset binaries shall be served through the Dynamic AQS CloudFront domain rather than the Widen domain, so that content is attributed to the Dynamic AQS origin for search-engine indexing purposes. Dan Harshbarger: "you don't get credit for other domains, you only get credit for what's on your domain." (SRC-DAM-001 30:03) | P0 | SRC-DAM-001 |

---

## 8. Assumptions

| ID | Assumption |
|----|-----------|
| ASM-DAM-001 | AWS credentials (`PULSE_ASSET_S3_BUCKET`, `AWS_REGION`) are provisioned in the production environment; the local fallback is used in development only. |
| ASM-DAM-002 | A CloudFront distribution is configured to serve from the same S3 bucket; `PULSE_ASSET_CLOUDFRONT_DOMAIN` (or `PULSE_ASSET_PUBLIC_BASE_URL`) is set in production. |
| ASM-DAM-003 | The Widen migration is a one-time batch operation, not a live sync; after migration, Pulse is the system of record for all digital assets. |
| ASM-DAM-004 | The Dealer Portal module (separate PRD) is responsible for rendering collections to external dealers; the DAM module provides the data and share-link infrastructure only. |
| ASM-DAM-005 | Asset kind inference from MIME type / file extension is sufficient for the initial migration; manual overrides are available post-import. |
| ASM-DAM-006 | The 100 MB per-file ingestion cap is acceptable for the current Widen asset library; very large video files may need to be linked externally via `externalUrl` rather than downloaded into S3. |
| ASM-DAM-007 | Portals in Widen (public-link collections bypassing security rules) will NOT be replicated directly; all Pulse share sets respect the visibility / approval rules of each individual asset, which is the security-correct behaviour. |
| ASM-DAM-008 | The six to seven Dynamic AQS branded websites will eventually link to assets via stable Pulse CDN URLs; the redirect cutover from Widen URLs is a separate planned migration step. |

---

## 9. Open Questions

| ID | Question | Impact | Decision Owner |
|----|---------|--------|---------------|
| OQ-DAM-001 | What is the target migration timeline for cutting over from Widen to Pulse CDN URLs on the branded websites? | Determines when `redirectStatus` alias records can be activated and Widen subscription can be terminated. | Dan Harshbarger / Johan Ericsson |
| OQ-DAM-002 | Should a "portal"-style share set (public link bypassing per-asset security, matching Widen portal behaviour) ever be supported, or is the per-asset approval / visibility model always enforced? | If portals are needed, a separate `portal` entity with different visibility rules would be required. | Johan Ericsson / C G |
| OQ-DAM-003 | Is access-count analytics per share link sufficient, or does Dynamic AQS require per-user / per-organisation analytics on asset usage (matching Widen "Insights")? | If usage analytics are required, a separate analytics event pipeline is needed. | Adrienne Cardinale / Marketing |
| OQ-DAM-004 | Will the mobile app (React Native) need a dedicated digital-assets screen for TMs, or is the mobile-optimised CRM-web URL sufficient? | Mobile-app screen is Not-built; CRM-web is accessible on phone but is not a native app experience. Don Hearn: "the biggest reason I don't [use Widen] is this is not accessible by your phone." (SRC-DAM-001 20:18) | Don Hearn / Product |
| OQ-DAM-005 | Which file types and maximum file sizes are allowed for upload? Is a 100 MB cap per file acceptable for all expected assets including video? | Determines upload validation rules and S3 multipart upload need. | Johan Ericsson / Engineering |
| OQ-DAM-006 | Should share links be associated to a specific asset version (pinned) or always resolve to the current version at time of access? Default is current version (dynamic); pinning is supported but not the default UX. | Affects how TMs understand "the link will show the latest". | Johan Ericsson / Product |

---

## 10. Requirement → Source Traceability Matrix

| Requirement ID | SRC IDs | Session |
|---------------|---------|---------|
| FR-DAM-001 | SRC-DAM-002, SRC-DAM-005 | Code |
| FR-DAM-002 | SRC-DAM-001, SRC-DAM-002, SRC-DAM-004 | Session 12 (24 Mar 2026) |
| FR-DAM-003 | SRC-DAM-001, SRC-DAM-005 | Session 12 (24 Mar 2026) |
| FR-DAM-004 | SRC-DAM-005 | Code |
| FR-DAM-005 | SRC-DAM-002, SRC-DAM-005 | Code |
| FR-DAM-006 | SRC-DAM-002, SRC-DAM-005 | Code |
| FR-DAM-007 | SRC-DAM-002, SRC-DAM-005 | Code |
| FR-DAM-008 | SRC-DAM-002 | Code |
| FR-DAM-009 | SRC-DAM-001, SRC-DAM-002 | Session 12 (24 Mar 2026) |
| FR-DAM-010 | SRC-DAM-004 | Code |
| FR-DAM-011 | SRC-DAM-001, SRC-DAM-004 | Session 12 (24 Mar 2026) |
| FR-DAM-012 | SRC-DAM-001, SRC-DAM-002 | Session 12 (24 Mar 2026) |
| FR-DAM-013 | SRC-DAM-004 | Code |
| FR-DAM-014 | SRC-DAM-002 | Code |
| FR-DAM-015 | SRC-DAM-001, SRC-DAM-002, SRC-DAM-005 | Session 12 (24 Mar 2026) |
| FR-DAM-016 | SRC-DAM-002 | Code |
| FR-DAM-017 | SRC-DAM-002, SRC-DAM-005 | Code |
| FR-DAM-018 | SRC-DAM-002, SRC-DAM-005 | Code |
| FR-DAM-019 | SRC-DAM-005 | Code |
| FR-DAM-020 | SRC-DAM-001, SRC-DAM-002, SRC-DAM-005 | Session 12 (24 Mar 2026) |
| FR-DAM-021 | SRC-DAM-002 | Code |
| FR-DAM-022 | SRC-DAM-002 | Code |
| FR-DAM-023 | SRC-DAM-001, SRC-DAM-002 | Session 12 (24 Mar 2026) |
| FR-DAM-024 | SRC-DAM-001, SRC-DAM-005 | Session 12 (24 Mar 2026) |
| FR-DAM-025 | SRC-DAM-005 | Code |
| FR-DAM-026 | SRC-DAM-001, SRC-DAM-005 | Session 12 (24 Mar 2026) |
| FR-DAM-027 | SRC-DAM-005 | Code |
| FR-DAM-028 | SRC-DAM-001, SRC-DAM-002 | Session 12 (24 Mar 2026) |
| FR-DAM-029 | SRC-DAM-002, SRC-DAM-003 | Code |
| FR-DAM-030 | SRC-DAM-002, SRC-DAM-005 | Code |
| FR-DAM-031 | SRC-DAM-005 | Code |
| FR-DAM-032 | SRC-DAM-002, SRC-DAM-005 | Code |
| FR-DAM-033 | SRC-DAM-002 | Code |
| FR-DAM-034 | SRC-DAM-002 | Code |
| FR-DAM-035 | SRC-DAM-002, SRC-DAM-003 | Code |
| FR-DAM-036 | SRC-DAM-002, SRC-DAM-004 | Code |
| FR-DAM-037 | SRC-DAM-002 | Code |
| FR-DAM-038 | SRC-DAM-002 | Code |
| FR-DAM-039 | SRC-DAM-002 | Code |
| NFR-DAM-001 | — | (inferred standard) |
| NFR-DAM-002 | SRC-DAM-001 | Session 12 (24 Mar 2026) |
| NFR-DAM-003 | SRC-DAM-002 | Code |
| NFR-DAM-004 | SRC-DAM-002, SRC-DAM-003 | Code |
| NFR-DAM-005 | SRC-DAM-002 | Code |
| NFR-DAM-006 | SRC-DAM-002 | Code |
| NFR-DAM-007 | SRC-DAM-002 | Code |
| NFR-DAM-008 | SRC-DAM-004 | Code |
| NFR-DAM-009 | SRC-DAM-002 | Code |
| NFR-DAM-010 | SRC-DAM-002 | Code |
| NFR-DAM-011 | SRC-DAM-002 | Code |
| NFR-DAM-012 | SRC-DAM-002 | Code |
| NFR-DAM-013 | — | (inferred standard) |
| NFR-DAM-014 | SRC-DAM-002, SRC-DAM-004 | Code |
| NFR-DAM-015 | — | (inferred standard) |
| NFR-DAM-016 | SRC-DAM-001 | Session 12 (24 Mar 2026) |

---

## 11. Gap / Not-Built List

The following in-scope requirements have not yet been implemented and represent the remaining Pulse-owned build backlog for this module:

| FR / NFR | Description | Status |
|----------|-------------|--------|
| FR-DAM-023 (partial) | Residential/commercial collection split visible in the UI (data model built, UI surface not built) | Not-built UI surface |
| FR-DAM-024 (partial) | Dedicated mobile-app (React Native) screen for TMs to browse and share assets | Not-built |
| OQ-DAM-001 | Widen URL redirect cutover activation (alias records exist; `redirectStatus` not yet set to active) | Parked — requires migration plan |
| OQ-DAM-004 | Mobile-app Digital Assets screen | Not-built |
| Widen Insights / usage analytics | Per-user / per-org asset engagement analytics comparable to Widen Insights | Not-built (access count per link is built; richer analytics are not) |
