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
