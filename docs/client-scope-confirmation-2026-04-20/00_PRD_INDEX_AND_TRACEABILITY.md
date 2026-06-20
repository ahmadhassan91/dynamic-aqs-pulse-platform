# Pulse CRM — PRD Index & Requirement Traceability

_Generated 2026-06-09 by scanning the PRD files on disk (distinct requirement IDs)._

_Module 10 (Reporting & Dashboards) updated 2026-06-20: +5 FR (FR-RPT-075–079), +3 OQ, +3 SRC from dashboard-mockup analysis (SRC-RPT-011 screenshots). See `10_REPORTING_DASHBOARDS_PRD.md` → Scope additions (2026-06-20)._

This index supersedes earlier partial versions. Every module PRD now carries a **Meeting Traceability** header and a **SRC-<MOD>-###** source-inventory table citing the original discovery transcripts (under `dynamic-aqs-crm/Meetings/`), plus **Functional (FR)**, **Non-Functional (NFR)**, **Assumptions (ASM)**, and **Open Questions (OQ)** sections — modelled on `05_CONSIGNMENT_PRD.md`, which was the program's original traceability exemplar.

| PRD | FR | NFR | ASM | OQ | SRC |
|---|---:|---:|---:|---:|---:|
| 01_LEADS_PRD.md | 62 | 13 | 10 | 10 | 11 |
| 02_TRAINING_PRD.md | 44 | 10 | 9 | 10 | 11 |
| 03_TERRITORY_PRD.md | 41 | 10 | 8 | 8 | 11 |
| 04_CALENDAR_PRD.md | 39 | 10 | 8 | 9 | 14 |
| 05_CONSIGNMENT_PRD.md | 66 | 6 | 0 | 7 | 14 |
| 06_ACCOUNTS_CUSTOMERS_PRD.md | 21 | 13 | 10 | 10 | 3 |
| 07_CIS_CREDIT_ONBOARDING_PRD.md | 45 | 11 | 9 | 7 | 11 |
| 08_MOBILE_FIELD_APP_PRD.md | 58 | 15 | 10 | 10 | 19 |
| 09_ADMIN_MASTER_DATA_CONFIG_PRD.md | 61 | 17 | 9 | 8 | 11 |
| 10_REPORTING_DASHBOARDS_PRD.md | 79 | 15 | 8 | 11 | 13 |
| 11_PRICING_PRICE_UPDATE_PRD.md | 34 | 10 | 9 | 9 | 11 |
| 12_DEALER_PORTAL_ORDERING_PRD.md | 54 | 14 | 9 | 8 | 10 |
| 13_PRODUCT_MANAGEMENT_CATALOG_PRD.md | 53 | 11 | 8 | 7 | 8 |
| 14_DIGITAL_ASSETS_DAM_PRD.md | 39 | 16 | 8 | 6 | 5 |
| 15_ACUMATICA_INTEGRATION_PRD.md | 45 | 16 | 10 | 10 | 21 |
| **TOTAL** | **741** | **187** | **125** | **130** | **173** |

## Coverage notes
- **15 module PRDs**: 01 Leads, 02 Training, 03 Territory, 04 Calendar, 05 Consignment, 06 Accounts/Customers, 07 CIS/Credit, 08 Mobile, 09 Admin/Master-Data, 10 Reporting & Dashboards *(new — the previously-missing #1 executive ask)*, 11 Pricing & Price-Update *(new — annual price-update process was fully orphaned)*, 12 Dealer Portal & Ordering *(new — the B2B ordering layer meant to replace Shopify)*, 13 Product Management & Catalog *(new)*, 14 Digital Assets / DAM *(new — Widen → AWS S3 + CloudFront)*, 15 Acumatica Integration *(new — mostly parked scope, with the field-mapping spec needed to start sandbox work)*.
- **Build status** is recorded per FR (Built / Partial / Not-built / Parked) so the PRD set doubles as a gap register. Parked items (Acumatica pricing/inventory/PO posting, Microsoft Graph alert delivery, payment tokenization provider) are flagged as scoping decisions, not defects.
- **Caveats:** (a) these are thorough, transcript-grounded **agent-drafted v3 PRDs** — they should get a human SME read-through before being treated as contractually final. (b) `05_CONSIGNMENT_PRD.md` predates the `ASM-` convention; its assumptions are embedded in its `BR-CSG` business rules (a future pass can extract an explicit ASM section). (c) SRC tables cite the raw transcripts in the separate docs repo; the PRDs themselves live here in the working repo.
