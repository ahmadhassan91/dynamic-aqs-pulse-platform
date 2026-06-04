# Product Management And Digital Assets Requirements Map

## Purpose

This map ties the next Pulse Product Management and bounded Widen replacement slices back to discovery evidence, PRDs, and development deliverables.

## Source Artifacts

| Artifact | Path | Use |
|---|---|---|
| Session 11 Product Management | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session _11 To-Be Dealer Portal, Product Management.md` | Product catalog, product/detail, product assets, group-first visibility, accountless product tab. |
| Session 12 Widen | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24th March - Session 12 - Reporting and Widen .md` | Widen portals/collections, stable links, replace-one-update-many behavior, mobile pain, SEO/domain concerns. |
| Product Management PRD | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/PRODUCT_MANAGEMENT_PRD.md` | Core module scope and screens. |
| Product Enhancement Plan | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/PRODUCT_MANAGEMENT_ENHANCEMENT_PLAN.md` | Group-first flow, pricing boundary, dealer group context. |
| Product Model Guide | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/source_of_truth/PRODUCT_MODEL_VARIANTS_AND_SYNC_IMPLEMENTATION_GUIDE.md` | Product/family/presentation separation. |
| Digital Assets PRD | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/prds/DIGITAL_ASSETS_DOCUMENTS_PRD.md` | Asset library, stable URLs, Widen replacement boundary. |
| Digital Assets Scope Workbook | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/workbooks/DYNAMICS_CONFIRMATION_06_DIGITAL_ASSETS_SCOPE.csv` | In-scope vs out-of-scope Widen/Dropbox workflows. |

## Requirement Mapping

| Requirement | Evidence | Build Target | Status |
|---|---|---|---|
| Pulse product catalog cannot be raw Shopify rows | Product model guide, Session 11 | `BaseProduct`, `ProductFamily`, `ProductPresentation` | Planned PM1 |
| Acumatica remains product/pricing truth | Product PRD, integration register | Source fields and parked sync status | Planned PM1 |
| Product categories are governed Pulse taxonomy | Product PRD, Session 11 | `ProductCategory` hierarchy | Planned PM1 |
| Product detail needs assets/spec/install/share links | Session 11 | Product detail Files tab and asset assignments | Planned PM3/PM4 |
| Product tab must be neutral/accountless | Session 11 | No accountless dealer price display | Planned PM3 |
| Group-first visibility prevents wrong brand/materials | Session 11, enhancement plan | `CatalogInclusion` resolver | Planned PM2 |
| Dealer Portal consumes approved catalog feed | Integration register INT-022 | Publish read model/API | Planned PM5 |
| Widen stable links must survive replacement | Session 12, Digital Assets PRD | Stable Pulse asset URL and version pointer | Planned DA1/DA2 |
| One asset update should propagate everywhere | Session 12 | Asset current-version pointer | Planned DA1 |
| Mobile/field users need quick search/share | Session 12 | Responsive asset library and share action | Planned DA3; mobile app deferred |
| S3 + CloudFront replaces Widen delivery for in-scope assets | Session 12, Digital Assets PRD | Storage adapter and signed delivery | Planned DA1/DA2 |
| Widen replacement must stay bounded | RAID/integration register, scope workbook | Curated migration and scope control | Planned DA0/DA6 |
| Widen legacy export may contain inconsistent/custom metadata | Session 12, Digital Assets PRD, migration risk review | `DigitalAssetMigrationBatch`, `DigitalAssetLegacyMetadata`, `DigitalAssetMigrationIssue`, raw source payload snapshots | Added schema foundation |
| SEO risk from Widen domains must be addressed | Session 12 | Brand-domain HTML content guidance and CDN asset domain | Planned DA0/DA6 |

## Next Slice Scope

The next implementation slice should cover:

1. Product/Digital Assets permissions and contracts.
2. Product and asset relational schema.
3. API skeletons with list/detail/readiness endpoints.
4. CRM web navigation and first internal Product Management/Asset Library screens.
5. No real Acumatica or Widen import execution until field mappings, curated manifest, and access are approved.

## UX-05 Slice D Trace - 2026-06-02

| Requirement Area | UX-05 Slice D Coverage | Boundary |
|---|---|---|
| PM-002 product/category/family separation | Product Catalog default remains readiness-first; categories/families stay in Catalog Placement setup. | Acumatica item class and prototype CSV category mapping remain parked. |
| PM-006/PM-007 dealer catalog visibility | Dealer Catalog View create/edit is now a 3-step wizard: `Who is this for?`, `What should they see?`, `Review before publish`. | Price class is not treated as visibility. |
| PM-008/PM-009 publish controls | UI now puts `Review before publish` before publish actions and gates create/edit/publish controls by backend permissions. | Publish is still blocked by existing backend readiness rules. |
| PM-010/PM-011 dealer portal catalog prep | The visibility table and publish checklist remain the operator path for dealer-facing catalog readiness. | Dealer pricing/order behavior remains out of scope. |
| DA-001/DA-002 approved asset library | Digital Assets default now shows approved, current-file, dealer/customer share-ready files first. | Internal-only and pending-review files are still available through Show all files/detail review. |
| DA-007/DA-009 customer/prospect sharing | Primary action copies an active revocable customer link or creates one through the existing share-link API. | Raw file URLs are not treated as customer share links. |
| DA-010/DA-011 product usage and visibility | Product usage, versions, and source trace stay in detail/advanced sections so daily sharing stays simple. | Product assignment logic remains owned by Product Management. |
| DA-013/DA-014 Widen replacement boundary | Migration review remains behind More, and legacy/source trace remains preserved. | Widen redirect cutover and curated migration execution remain parked. |

## UX-07 Slice C Trace - 2026-06-04

| Requirement Area | UX-07 Slice C Coverage | Boundary |
|---|---|---|
| PM-002 category/family separation | Product copy now explains categories as catalog sections and families as SKU groupings; Product readiness table labels placement as catalog placement. | Acumatica item class and prototype CSV mapping remain parked until source access/rules are certified. |
| PM-006/PM-007 dealer catalog visibility | `/product-management?tab=visibility` no longer auto-selects the first Dealer Catalog View; users must choose the dealer context before seeing publish evidence. | Dealer Catalog View resolver logic and publish backend rules are unchanged. |
| PM-008/PM-009 review before publish | Selected-view publish metrics and review actions remain available only after a Dealer Catalog View is selected. | Final publish still depends on existing backend readiness and permission checks. |
| PM-010/PM-011 dealer portal catalog prep | Dealer Portal catalog/detail/dashboard/account copy now uses dealer-safe `available`, `Products and Files`, and `Account Access` language. | Dealer pricing, order placement, and Acumatica-backed product truth remain out of scope. |
| PM-012 scoped presentation overrides | Product detail labels scoped overrides as advanced audience exceptions, with regional/relationship/ownership/brand/private-label audience names. | Override payloads and APIs are unchanged. |
| DA-001/DA-002 approved asset library | Digital Assets first paint continues to show approved/share-ready files first; `Review All Files` moves into More and visibility filtering appears only in review mode. | Internal-only and pending-review files remain available to authorized CRM users through review paths. |
| DA-007/DA-009 customer/prospect sharing | Selected asset detail keeps `Copy customer link` / `Create share link` as the visible primary job. | Share-link API, revocation, expiry, and audit behavior are unchanged. |
| DA-010/DA-011 usage/version/source trace | Recipient fields, CRM context, share-link history, usage, versions, and source trace are available through focused advanced sections instead of default first-paint detail. | Product assignment remains owned by Product Management; Widen/source audit remains preserved. |
| DA-013/DA-014 Widen replacement boundary | Migration language stays out of the Digital Assets header; migration review remains in More/advanced paths. | Widen redirect cutover and curated migration execution remain parked. |
