# Reporting & Dashboards PRD

## Document Control

| Field | Value |
|-------|-------|
| Module | Reporting & Dashboards |
| Document Type | Master PRD |
| Version | 1.4 |
| Status | Draft — RPT-P2/P3/P4 build-status update 2026-06-20 (Training + Executive dashboards + KPI drill-down + CSV export shipped; see Build-status reconciliation §RPT-P2/P3/P4 + §12). Prior: build-status reconciliation 2026-06-20 (existing builder/scheduling + RPT-P1 lead dashboard); dashboard-mockup analysis (FR-RPT-075–079); scope-sourcing correction 2026-06-18 |
| Owner | Product / Operations |
| Sprint Sequence | Cross-module; reporting surfaces attach to Seq 01–05 module work |
| Priority | P0 — #1 executive ask |
| Date | 2026-06-09 |
| Meeting Traceability | Session 12 (24 Mar 2026, C G / Ahmad Hassan / Michelle Hogan / Don Hearn / Dan Harshbarger / Adrienne Cardinale / Johan Ericsson); CG–Dynamics Meeting 2 (24 Oct 2025, C G / Ahmad Hassan / Adam Mohyuddin / Omer Aslam); Currie Catch-Up 8 Dec 2025 (C G / Faraz Sohail / Ahmad Hassan / Adam Mohyuddin / Omer Aslam); April 13–20 Scope Review session (C G / Ahmad Hassan / Steve Mores / Dan Harshbarger / Stephanie Norman) |
| Primary Companion Docs | `REPORTING_ROLE_TRACEABILITY_MATRIX.md`, `05_CONSIGNMENT_PRD.md` §6, `auth-catalog.ts`, `packages/contracts/src/auth.ts` |

---

## Scope corrections (2026-06-18)

A program-wide scope-accuracy re-check (verifying every client-attributed / "confirmed" requirement against the actual cited meeting transcripts) flagged two LOW-severity sourcing nits in this module. The substance is sound; the corrections make the attribution honest before scope-lock. No row is deleted.

- **FR-RPT-016 — revenue by territory manager.** This was **vendor-demo'd** by Ahmad Hassan in Session 12 ("territory revenue by manager"); it was not a client ask. The genuine, client-voiced territory-sales pain belongs to Dan Harshbarger in the (previously uncited) **Discovery Session 1, 16 Feb 2026**: *"all the sales that happened in Florida, South Carolina and Georgia. Well, I can get all breath sales but I don't know how I would get Florida, South Carolina, Georgia."* Discovery Session 1 has been added to the Source Inventory (SRC-RPT-010) so the real pain point is cited; the manager rollup remains a vendor-proposed presentation of it.
- **Power BI out-of-scope note.** The "mentioned by Dan" attribution is wrong — Power BI was raised by **Ahmad Hassan (vendor)**, not Dan, in the April scope-review session. Corrected inline in §5.

Full audit: `docs/SCOPE_ACCURACY_AUDIT_2026-06-18.md`.

---

## Scope additions (2026-06-20) — dashboard-mockup analysis

The prior revision's Source Inventory noted that the client's `Dashbaords/` screenshots "were not parseable as text" and excluded them. On 2026-06-20 the seven images (the client's as-is Dynamics 365 "Residential Sales Dashboard" P1/P3) were analyzed visually and catalogued as **SRC-RPT-011**. They surfaced five reporting widgets the original 74 FRs did not capture. A cross-PRD refutation audit (all 16 module PRDs + parked PRDs) verified each is genuinely absent from the Reporting PRD before adding it; two adjacent items were confirmed already captured in other modules and are cross-referenced rather than duplicated.

- **Added as new FRs (see §7.11):** FR-RPT-075 product-category revenue; FR-RPT-076 affinity member-list penetration %; FR-RPT-077 sales goal vs actual; FR-RPT-078 Top-N account tiles; FR-RPT-079 new-account acquisition count.
- **Cross-referenced (no duplicate FR added):** contest/campaign ROI reporting → parked Promotions/Coupons/Contests PRD (PCC-006) + Training FR-TRN-055 + Dealer Portal FR-DPO-037; dealer rebate-qualifying spend (quarter filter, shipping excluded) → Dealer Portal FR-DPO-012 / FR-DPO-062 / FR-DPO-064.
- **New open questions:** OQ-RPT-009 (goal tracking — mockup-only, never voiced in discovery), OQ-RPT-010 (member-list penetration metric definition), OQ-RPT-011 (product-category taxonomy / internal-vs-dealer parity with OQ-DPO-005).

---

## Build-status reconciliation (2026-06-20)

A build-status pass against the shipped code found the prior revision **materially understated what exists**. A substantial reporting module already lived in `apps/api/src/modules/reports/` + `apps/crm-web/src/components/reporting/ReportsWorkspace.tsx` — saved report definitions (PRIVATE/TEAM/ORG visibility), ad-hoc + saved runs over 5 CRM executors, recurring email **schedules** with a preview-mode dispatcher, and RBAC on `reports.builder` — yet the original status pass marked the whole builder/scheduling surface **Not-built**. The 2026-06-20 RPT-P1 work then shipped the role-scoped **Lead dashboard** (commit 4dfe445) and role-scoped all 5 executors (commit 619de4f). §12 and the affected §7 cells are corrected to match; **this table is authoritative where it differs from an inline cell.**

| FR | Was | Now | Evidence (code) |
|----|-----|-----|-----------------|
| FR-RPT-010 | Partial | **Built** | `reports` module key + `/reports` route/page + nav entry all wired |
| FR-RPT-001 | Not-built | **Partial** | `/reports` shell + default "Dashboard" tab (role-scoped Lead dashboard); per-role *different* defaults not yet |
| FR-RPT-002 | Not-built | **Partial** | Tabs framework (Dashboard / Saved reports); the 8 enumerated role dashboards not yet |
| FR-RPT-004 | Partial | **Partial (enforcement upgraded)** | server-side row-level scope now enforced in all 5 executors + the lead dashboard (`resolveLeadRecordScope` etc.; commits 4dfe445, 619de4f) |
| FR-RPT-021 | Partial | **Built** | Lead dashboard — intake by source + state |
| FR-RPT-022 | Partial | **Partial** | stage counts built (Lead dashboard `byStage`); per-stage aging not yet |
| FR-RPT-023 | Not-built | **Built** | Lead dashboard — lead→account conversion rate (role-scoped funnel) |
| FR-RPT-026 | Not-built | **Built** | Lead dashboard — homeowner / contractor segmentation |
| FR-RPT-061 | Not-built | **Partial** | per-report config filters (territory / date range / user) via `ReportConfig`; arbitrary multi-field filters not yet |
| FR-RPT-064 | Not-built | **Built** | saved report definitions (personal + admin-shared via PRIVATE/TEAM/ORG visibility) |
| FR-RPT-065 | Not-built | **Partial** | 5 report types selectable as ORG-shared saved reports; specific named pre-seeded templates not yet |
| FR-RPT-066 | Partial | **Built** | builder gated on `reports.builder` (`createReportDefinition`) |
| FR-RPT-068 | Not-built | **Partial** | saved-reports list table built; "Priority Reporting Subjects" pre-built tile section not yet |
| FR-RPT-069 | Not-built | **Built** | report schedules (daily/weekly/monthly, hour, recipient list, `nextRunAt`) |
| FR-RPT-070 | Not-built | **Built** | multi-recipient delivery list (admin add/remove) |
| FR-RPT-072 | Not-built | **Partial** | scheduling built; prior-month-sales report config is user-defined; delivery preview-mode |
| FR-RPT-073 | Not-built | **Partial** | `training_compliance` schedulable monthly; delivery preview-mode |
| FR-RPT-074 | Parked | **Partial** | preview dispatcher built (`processDueReportSchedules` records deliveries + advances `nextRunAt`); real Microsoft Graph mailbox send remains Parked |

**Still genuinely Not-built** in this surface (not contradicted by the existing module): FR-RPT-060 (drag-drop *any-field* selector — the implemented builder picks one of 5 fixed report types, not arbitrary fields), FR-RPT-062 (sort), FR-RPT-063 (pre-save preview tab), FR-RPT-067 (chart type), FR-RPT-006/007/009 (charts — no chart library installed).

### RPT-P2 / P3 / P4 update (2026-06-20)

Subsequent slices shipped the Training dashboard (commit e5f623b), the Executive overview (9aee568), and KPI drill-down + CSV export (5b77b78). Corrected statuses (authoritative over inline cells where they differ):

| FR | Was | Now | Evidence |
|----|-----|-----|----------|
| FR-RPT-018 | Not-built | **Built** | Executive cross-module exception summary (overdue audits / training / stale leads / open consignment work items) |
| FR-RPT-020 | Partial | **Built** | Executive dashboard gated on `reports.executive` (getExecutiveDashboard + UI tab) |
| FR-RPT-050 | Not-built | **Built** | Training-overdue exception (overdue-programs KPI + overdue-account list) |
| FR-RPT-051 | Not-built | **Built** | Site-visits vs trainings split (siteVisits metric + training counts) |
| FR-RPT-011 | Not-built | **Partial** | Exec KPIs open-leads / active-sites / trainings built; YTD revenue + active accounts parked on Acumatica |
| FR-RPT-005 | Not-built | **Partial** | KPI cards drill down by navigating to the module list; in-place filtered drawer is the richer later version |
| FR-RPT-008 | Not-built | **Partial** | CSV export on saved-report runs (dependency-free); Excel/PDF + dashboard export deferred (need a library) |
| FR-RPT-048 | Partial | **Partial** | total training hours built; per-account hours breakdown still pending |
| FR-RPT-049 | Not-built | **Partial** | training hours by trainer built; RD/region/state breakdown pending |
| FR-RPT-052 | Not-built | **Partial** | training-type breakdown built; per-TM (type×TM) cross pending |

Reporting Home now has 3 working CRM-data dashboards (Executive / Leads / Training, role-gated) + KPI drill-down + CSV, alongside the pre-existing builder/scheduling. Remaining dashboard FRs are Acumatica-parked (revenue) or finer role surfaces (Finance/RD/Consignment/Dealer tabs).

---

## 1. Meeting Traceability

| Session | Date | Key Speakers | Reporting Topics Covered |
|---------|------|-------------|--------------------------|
| Session 12 — Reporting and Widen | 24 Mar 2026 | C G, Ahmad Hassan, Michelle Hogan, Don Hearn, Dan Harshbarger, Adrienne Cardinale, Johan Ericsson | Full live demo of Reporting Home prototype; exec dashboard; sales/beauty dashboard; finance & ops view; TM territory dashboard; RD rollup; training overdue; consignment overdue; report builder; saved templates; scheduled CSV/PDF/Excel email exports; role-based dashboards; YoY discussion; unlimited sales history ask; group revenue by manager |
| CG–Dynamics Meeting 2 | 24 Oct 2025 | C G, Ahmad Hassan, Adam Mohyuddin, Omer Aslam | Reporting called out as #2 priority after Acumatica integration; CRM as single source of truth for customer data; Acumatica as truth for financials; ability to run report on any data point; year-over-year challenge due to QuickBooks→Acumatica migration |
| Currie Catch-Up 8 Dec 2025 | 8 Dec 2025 | C G, Faraz Sohail, Ahmad Hassan, Adam Mohyuddin, Omer Aslam | Reporting emphasis for Michelle (VP Business Development) and the broader stakeholder demo; "sort by any data field for reporting" confirmed as biggest complaint |
| April 13–20 Scope Review | 13–20 Apr 2026 | C G, Ahmad Hassan, Steve Mores, Dan Harshbarger, Stephanie Norman | Role-based dashboards confirmed; TM, Executive, Sales & BD, Finance, Training, Dealer, Consignment dashboards all shown; report builder + saved templates confirmed; multi-format export (PDF, Excel, CSV) confirmed; permission control on who sees what confirmed (Steve Mores: "I don't want dealers seeing consignment") |

---

## 2. Source Inventory

| ID | Absolute Path | What It Sourced |
|----|--------------|-----------------|
| SRC-RPT-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24th March - Session 12 - Reporting and Widen .md` | Primary reporting session: exec dashboard demo, finance/ops view, TM territory dashboard, report builder, saved templates, scheduled email exports, training/consignment overdue lists, YoY sales history ask, group revenue ask |
| SRC-RPT-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/CG - Dynamics Meeting 2 - Transcipt  Date_ 24_10_2025, 19_30.md` | Early framing: reporting as #2 priority, YoY challenge from ERP migration, "run a report on any point of data" mandate, CRM = customer truth / Acumatica = financial truth architecture |
| SRC-RPT-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Currie - Catch Up - 8 Dec 2025.md` | Pre-demo prep; reporting highlighted as C G's biggest complaint from staff survey; role-specific focus (Michelle on leads/reports, Don on sales history) |
| SRC-RPT-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/docs/roadmap/legacy_root_docs/context/REPORTING_ROLE_TRACEABILITY_MATRIX.md` | Authoritative role-to-reporting-surface matrix: D/R/A breakdowns for every reporting subject per role; default dashboard expectations; report builder access by role; scheduled report subjects |
| SRC-RPT-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md` | April scope review: role dashboards confirmed, report builder + templates shown, multi-format export confirmed, permission model confirmed (Steve Mores "dealers can't see consignment"), power BI mentioned as future add-on |
| SRC-RPT-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/src/auth.ts` | Code evidence: `reports` workspace module, `reports.builder` and `reports.executive` action keys, per-role report access assignments |
| SRC-RPT-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/lib/auth-catalog.ts` | Code evidence: ROLE_DEFAULT_MODULE_ACCESS_CATALOG and ROLE_DEFAULT_ACTION_ACCESS_CATALOG confirming reports module and builder/executive action assignments per role |
| SRC-RPT-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/consignment/service.ts` | Code evidence: 5 consignment KPIs built server-side (auditComplianceRatePct, onTimeFirstBaselinePct, overduePoCount, meanPoCycleDays, exitCompletionRatePct); consignment dashboard endpoint |
| SRC-RPT-009 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/territories/TerritoryCommandDashboard.tsx` | Code evidence: territory dashboard component with training penetration, overdue engagement (90-day), regional rollups — built UI surface |
| SRC-RPT-010 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1 - 16th Feb 2026.md` | Added 2026-06-18: client-voiced territory-sales reporting pain — Dan Harshbarger: "all the sales that happened in Florida, South Carolina and Georgia. Well, I can get all breath sales but I don't know how I would get Florida, South Carolina, Georgia." Backs FR-RPT-016 / FR-RPT-017 as the genuine pain point behind the vendor-demo'd manager/state rollups |
| SRC-RPT-011 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Dashbaords/` (attachment-1.png, attachment-1.jpeg, attachment-2..6.jpeg) | Added 2026-06-20: the client's as-is Dynamics 365 "Residential Sales Dashboard" (P1/P3) screenshots, analyzed visually. Evidenced five widgets not previously captured: **sales by product category** ("Active Product Categories — Last 12 Month Sales By Category": UV Lights $17.3M, Air Cleaners $12.8M, Media, Pan Treatment); **affinity-group member-list penetration %** ("% of Sold Accounts of Member List Count": Service Experts 69.31%, ARS 60.81%); **sales goal vs actual** ("Current Year Goals vs. Sales", Total Sales Goal = $40M, Goal-CYTD bars); **Top-N tiles** (Top 20 Customers, Top YoY Increases, Top YoY Declines); **new-account count** by month and by owner ("Residential First Order Dates — New Accounts By Month", "New Accounts This Fiscal Year by Owner"). Basis for FR-RPT-075 through FR-RPT-079. |
| SRC-RPT-012 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/02 March session 7 Discovery - Delaer Portal.md` | Added 2026-06-20: Michelle Hogan's recurring product-category sales-mix ask — "what percentage of our business is [each category] … air cleaner, UV lights, pant treatments, HEPA." Verbal corroboration for FR-RPT-075 (product-category revenue), alongside the SRC-RPT-011 mockup. |
| SRC-RPT-013 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md` | Added 2026-06-20: affinity member-list context — lists of 300–1,000 members; Dan Harshbarger manually cross-references each group's member list against sales for rebate eligibility. Verbal corroboration for FR-RPT-076 (member-list penetration %), alongside the SRC-RPT-011 mockup. |

Note: `.docx` variants of meeting files were not attempted; the `.md` equivalents above are complete and fully readable. ⚠️ CORRECTED 2026-06-20: the earlier statement that the `Dashbaords/` screenshots "were not parseable as text" is **retracted** — the seven images were analyzed visually on 2026-06-20, catalogued as SRC-RPT-011, and are the basis for FR-RPT-075 through FR-RPT-079 (see Scope additions).

---

## 3. Overview

### 3.1 Problem Statement

**Current state (from SRC-RPT-002, SRC-RPT-003):**
- "Reporting. Don't get me started on reporting." — C G, Oct 2025
- Year-over-year revenue requires manual reconciliation because QuickBooks (pre-2025) and Acumatica (2025+) do not share a common data model
- Sales history is capped at current-year-to-date + last year; no unlimited history access
- Training visits logged as unstructured notes — cannot run a "trainings completed last month" report
- Microsoft Dynamics CRM and Acumatica do not share accounts, so numbers diverge
- Field team cannot access Acumatica; leadership cannot trust Dynamics CRM numbers
- C G's staff survey: CRM was the #2 complaint; inability to run reports was the most common sub-complaint

**Target state (from SRC-RPT-001, SRC-RPT-004, SRC-RPT-005):**
- One unified Reporting Home module with role-scoped default dashboards
- Pre-built dashboard tabs: Executive, Sales & BD, Finance & Ops, Territory Manager, Regional Director, Training, Consignment, Dealer
- Dynamic report builder with drag-drop field selection, filters, sort, group-by, chart type
- Saved templates (personal and shared) so frequently run reports are one click
- Scheduled email delivery of saved reports (CSV, PDF, or Excel) on daily/weekly/monthly cadence
- Every data point captured in Pulse is available as a report field — "run a report on any point of data" (C G, Oct 2025)
- Role-gated visibility: TMs see their territory; RDs see their subordinate rollup; Executives see everything; Dealers see only their own account

### 3.2 Architecture Boundary

Pulse owns the reporting UI, saved templates, schedules, and all workflow/CRM data (leads, training, consignment, territory, accounts, touch history). Acumatica owns financial truth (invoice amounts, PO values, order totals). Pulse surfaces Acumatica-sourced figures as read-only sync data with `sourceRef + lastSyncedAt + syncStatus` metadata. Pulse does not compute financials — it presents them.

---

## 4. In-Scope

- Reporting Home module route (`/reports`) with role-based default dashboard landing
- Pre-built dashboard tiles per role (see §5 FR-RPT-001 through FR-RPT-008)
- Executive YoY-by-group / YoY-by-location revenue dashboards (SRC-RPT-001: Michelle Hogan)
- Finance & Ops aging receivables / credit-hold and lead-readiness summary (SRC-RPT-001)
- Dynamic drag-drop report builder: field selection, filter, sort, group-by, chart (SRC-RPT-001)
- Saved report templates — personal and admin-shared (SRC-RPT-001)
- Scheduled CSV / PDF / Excel email reports (SRC-RPT-001)
- Training-overdue exception report (SRC-RPT-001, SRC-RPT-004)
- Consignment-audit-overdue report (SRC-RPT-001, SRC-RPT-004)
- Role-based dashboard and builder access gating (SRC-RPT-006, SRC-RPT-007)
- Configurable "active account" parameter (C G, SRC-RPT-001: "active = ordered in last N months, configurable")
- Sales-by-product-category revenue mix on Executive/Sales dashboards (SRC-RPT-011 + Michelle, Session 7; FR-RPT-075 — Parked on Acumatica)
- Affinity / buying-group member-list penetration % (SRC-RPT-011 + Session 4; FR-RPT-076)
- Sales goal vs actual / YTD attainment on the Executive dashboard (SRC-RPT-011; FR-RPT-077 — pending client confirmation, OQ-RPT-009)
- Top-N ranked account tiles — Top Customers, Top YoY Increases, Top Declining-but-Active (SRC-RPT-011; FR-RPT-078)
- New-account acquisition count by month and by owner (SRC-RPT-011; FR-RPT-079)

---

## 5. Out of Scope

- Power BI embedded dashboards (mentioned by Dan in April session as future, not Phase 1) (mentioned by the vendor, Ahmad — not Dan)
- Homeowner / consumer-facing analytics
- Commercial-side reporting (deferred — commercial CRM decision pending)
- Email campaign analytics beyond lead form submission counts
- Real-time streaming dashboards (sub-minute refresh not required for Phase 1)

---

## 6. Parked Dependencies

| Item | Parked Behind |
|------|---------------|
| Revenue KPIs sourced from Acumatica invoices/orders (YTD revenue, order history beyond CRM activity) | Acumatica API endpoint certification |
| Aging receivables with invoice-level detail | Acumatica AR module access |
| Credit-hold sync alert populating the Finance & Ops dashboard | Acumatica account-flag sync (toggle-to-Pulse) |
| Prior-year comparison (QuickBooks 2024 data) | Manual data migration or QuickBooks export not yet completed |
| Microsoft Graph email delivery for scheduled reports | Same Microsoft Graph credentials dependency as lead/consignment alert delivery |
| Dealer portal revenue analytics beyond Acumatica-synced order data | Acumatica/Shopify data quality alignment |
| Payment aging and DSO (days sales outstanding) calculations | Acumatica financial data |
| Sales-by-product-category revenue (FR-RPT-075) | Acumatica order-line / product-category revenue sync |
| Top-N revenue rankings — Top Customers / Increases / Declines (FR-RPT-078) | Acumatica revenue figures |
| Sales goal vs actual — actual-revenue half (FR-RPT-077) | Acumatica revenue sync (goal config is Pulse-owned) |
| Contest / campaign ROI reporting surface | Promotions/Coupons/Contests module activation (parked PRD PCC-006) + Acumatica sales attribution |

---

## 7. Functional Requirements

### 7.1 Reporting Home & Navigation (FR-RPT-001 through FR-RPT-010)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|------------|---------------------|----------|-------------|-----|
| FR-RPT-001 | Reporting Home module (`/reports`) with role-scoped default dashboard | When a user navigates to `/reports`, the system renders the default dashboard for their role without requiring any filter selection. Each role sees their own default (see §3.2 matrix). | P0 | Partial (`/reports` shell + default "Dashboard" tab — role-scoped Lead dashboard; per-role *different* defaults not yet) | SRC-RPT-001, SRC-RPT-004 |
| FR-RPT-002 | Dashboard tab navigation: Executive, Sales & BD, Finance & Ops, TM, RD, Training, Consignment, Dealer | Tabs visible to each user are restricted by their role permissions. TM does not see the Executive tab. Dealer sees only Dealer. | P0 | Partial (Tabs framework: Dashboard / Saved reports; the 8 enumerated role dashboards not yet) | SRC-RPT-001, SRC-RPT-005 |
| FR-RPT-003 | Configurable "active account" threshold | Admin can configure the window (e.g. ordered in last N months) that defines an "active account" for all dashboard KPI counts. C G: "Active accounts — we should be able to change that parameter." (SRC-RPT-001) | P1 | Not-built | SRC-RPT-001 |
| FR-RPT-004 | Role-based data scope (row-level visibility) | TMs see only their assigned accounts/territory. RDs see their TM subordinates' data in rollup. Executives and Admins see full dataset. Dealers see only their own account data. | P0 | Partial (server-side row-level scope now enforced in all 5 report executors + the lead dashboard — commits 4dfe445/619de4f; not every reporting surface built) | SRC-RPT-006, SRC-RPT-007 |
| FR-RPT-005 | Dashboard KPI cards — drill-down on click | Clicking a KPI card (e.g. "Training Overdue: 14") opens the filtered list view behind that number. | P1 | Partial (KPI cards drill down by navigating to the module list; in-place filtered drawer pending) | SRC-RPT-001 (C G: "There are times when we need to run a special report") |
| FR-RPT-006 | Dashboard charts: bar, line, area — switchable | Each chart widget offers bar / line / area toggle. Ahmad confirmed: "We have different chart options by area, line, and bar." (SRC-RPT-001) | P1 | Not-built | SRC-RPT-001 |
| FR-RPT-007 | Revenue by month chart (last 6 months + YTD) | Standard chart shows monthly revenue bars with a YTD cumulative overlay. Scope to territory for TM view, regional rollup for RD, full company for Executive. | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-008 | Multi-format export: CSV, Excel, PDF | Any report or dashboard view can be exported in all three formats. Ahmad: "We have option to export CSV, Excel, PDF." (SRC-RPT-001) | P0 | Partial (CSV export on saved-report runs; Excel/PDF + dashboard export deferred — need a library) | SRC-RPT-001, SRC-RPT-005 |
| FR-RPT-009 | Summary view + chart view toggle per report | Each pre-built report has a Summary tab (key metrics) and a Chart tab (visual). | P1 | Not-built | SRC-RPT-001 |
| FR-RPT-010 | "Reporting Home" as module; listed in role access | `reports` module key already present in WORKSPACE_MODULES. Route, page shell, and navigation entry to be wired. | P0 | Built (reports module key + `/reports` route/page + nav entry all wired) | SRC-RPT-006 |

### 7.2 Executive Dashboard (FR-RPT-011 through FR-RPT-020)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|------------|---------------------|----------|-------------|-----|
| FR-RPT-011 | Executive dashboard: YTD revenue, active accounts, open leads, training hours, audit compliance | Five KPI cards visible at-a-glance on executive landing. Ahmad demo'd these at Session 12. | P0 | Partial (CRM KPIs built — open leads / active consignment sites / trainings completed / open exceptions; YTD revenue + active accounts parked on Acumatica) | SRC-RPT-001 |
| FR-RPT-012 | Year-over-year (YoY) revenue by affinity group / PE group | Shows group revenue current year vs prior year side-by-side. Michelle: "We like to see YoY revenue by group … ARS, Service Experts." (SRC-RPT-001) | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-013 | YoY revenue by location (within a group) | Drill one level deeper: group → individual locations, current year vs prior year. Michelle: "Air Serve revenue by location, year over year, because we like to see the dip." (SRC-RPT-001) | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-014 | New account revenue tracking — first year and second year | When a new account comes on board, track their revenue through year 1 and year 2 separately. Michelle: "We track new account revenue for the first year and the second year because that's a big deal." (SRC-RPT-001) | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-015 | Lost account tracking | Report showing accounts that were active and have not ordered within the configured active-account window. Michelle: "We also like to see lost accounts." (SRC-RPT-001) | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-016 | Revenue by territory manager (monthly + YTD) | Bar chart of TM revenue contributions side-by-side. Ahmad demo'd "territory revenue by manager" in Session 12. — ⚠️ CORRECTED 2026-06-18: vendor-demo'd; the real territory-sales pain is Dan, Discovery Session 1 (see Scope corrections). | P0 | Not-built | SRC-RPT-001, SRC-RPT-010 |
| FR-RPT-017 | Revenue by state — territory map overlay | Table and map showing revenue aggregated by state. Ahmad demo'd "revenue by state." | P1 | Partial (TerritoryCommandDashboard has coverage counts by state/TM but not revenue figures; revenue requires Acumatica sync) | SRC-RPT-001, SRC-RPT-009 |
| FR-RPT-018 | Executive exception summary — cross-module | Single panel surfacing all open exceptions: overdue audits, overdue training, accounts on credit hold, overdue POs, stale leads. C G: "I want an alert for pretty much anything." (SRC-RPT-005); SRC-RPT-004: "Executive exception summary across modules" | P0 | Built (Executive dashboard cross-module exception summary — overdue audits / training / stale leads / open consignment work items; credit-hold parked on Acumatica) | SRC-RPT-004, SRC-RPT-005 |
| FR-RPT-019 | Affinity group / PE group / independent performance comparison | Table showing total revenue, YoY growth %, new accounts, and active accounts broken out by group type. | P1 | Not-built | SRC-RPT-001, SRC-RPT-004 |
| FR-RPT-020 | `reports.executive` action gate | Executive dashboard is only accessible to users with the `reports.executive` permission. All other roles see their own default. | P0 | Built (Executive dashboard + tab gated on `reports.executive` in API and UI) | SRC-RPT-006, SRC-RPT-007 |

### 7.3 Sales & BD Dashboard (FR-RPT-021 through FR-RPT-027)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|------------|---------------------|----------|-------------|-----|
| FR-RPT-021 | Lead intake by source / website / state | Count of leads by origin source (trade show, website, HubSpot, direct) and by state. Ahmad demo'd "lead source" and "state performance" in Session 12. | P0 | Built (Lead dashboard — intake by source + state) | SRC-RPT-001, SRC-RPT-004 |
| FR-RPT-022 | Lead stage bottleneck view — count per stage, aging | Shows how many leads sit in each pipeline stage and how long they have been there. SRC-RPT-004: "Lead stage bottlenecks and next gate." | P0 | Partial (Lead dashboard `byStage` counts built; per-stage aging not yet) | SRC-RPT-001, SRC-RPT-004 |
| FR-RPT-023 | Lead conversion rate: lead-to-account | Shows lead-to-account conversion rate by period, by source, and by TM/RD. Ahmad demo'd "conversion detail" and "lead to account rate" in Session 12. | P0 | Built (Lead dashboard — role-scoped conversion rate) | SRC-RPT-001 |
| FR-RPT-024 | First-order conversion and ready-for-first-order pipeline | How many accounts are in each readiness state; how long since they reached "ready for first order." | P0 | Not-built | SRC-RPT-004 |
| FR-RPT-025 | Website intake analytics — form leads by site | Per-website lead count, conversion rate, form starts vs submissions. Ahmad demo'd "website intake" and "CTA clicks, form starts, submissions" in Session 12. | P1 | Partial (LeadWebsiteFormsWorkspace exists; analytics counts not confirmed built) | SRC-RPT-001 |
| FR-RPT-026 | Lead by homeowner vs contractor segmentation | Form submission segmentation so Adrienne can see "of 187, 86 were homeowner." Adrienne: "You could see homeowner leads of that 187." (SRC-RPT-001) | P1 | Built (Lead dashboard — homeowner/contractor segmentation) | SRC-RPT-001 |
| FR-RPT-027 | SLA risk and ownership handoff alerts | Highlights leads that are at risk of missing their stage-transition SLA and who currently owns them. SRC-RPT-004: "March 13 strongly reinforced handoff alerts." | P0 | Not-built | SRC-RPT-004 |

### 7.4 Finance & Ops Dashboard (FR-RPT-028 through FR-RPT-034)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|------------|---------------------|----------|-------------|-----|
| FR-RPT-028 | Aging receivables view — accounts with open balances | Shows accounts with balances by aging bucket (0–30, 31–60, 61–90, 90+ days). Ahmad demo'd "finance and ops view" showing accounts "waiting on routing/decision" and credit-app status. (SRC-RPT-001) | P0 | Parked (requires Acumatica AR sync) | SRC-RPT-001 |
| FR-RPT-029 | Credit-hold indicator on account with pulse alert | When Acumatica marks an account on credit hold, the Finance & Ops dashboard flags it and alerts the TM. C G: "If that toggle is switched, it shows up in Pulse." (SRC-RPT-001) | P0 | Parked (requires Acumatica credit-hold field sync) | SRC-RPT-001 |
| FR-RPT-030 | Finance queue: accounts awaiting credit approval | List of accounts where CIS finance decision is pending; sorted by wait time. | P0 | Partial (LeadFinanceQueue component exists; dedicated reporting surface not built) | SRC-RPT-001, SRC-RPT-004 |
| FR-RPT-031 | First-order readiness: accounts "ready for first order" pending action | Finance & Ops view of accounts cleared for first order but not yet activated. | P0 | Partial (LeadOnboardingReadyPanel exists; not surfaced in Reporting Home) | SRC-RPT-004 |
| FR-RPT-032 | Dealer YTD spend / invoices / shipments by account | Finance view showing dealer account spend, open invoices, and shipment status. | P1 | Parked (requires Acumatica order/invoice sync) | SRC-RPT-004 |
| FR-RPT-033 | Accounts on hold alert — monthly scheduled report | Scheduled report delivered monthly: any account on credit hold or past-due flag at month end. Michelle: "Any accounts on hold at the end of every month, we would know." (SRC-RPT-001) | P1 | Parked (delivery = Microsoft Graph; data = Acumatica sync) | SRC-RPT-001 |
| FR-RPT-034 | Finance & Ops: lead pipeline readiness summary | How many leads are in each CIS/finance gate stage by owner; flags stalled items. SRC-RPT-004: "Finance / Ops: Lead finance and operational readiness views." | P0 | Not-built | SRC-RPT-004 |

### 7.5 Territory Manager Dashboard (FR-RPT-035 through FR-RPT-042)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|------------|---------------------|----------|-------------|-----|
| FR-RPT-035 | TM default dashboard: active accounts, pipeline leads, revenue YTD, recent follow-ups, overdue actions | Five KPI cards scoped to TM's assigned territory. Ahmad demo'd "active accounts, pipeline leads, revenue, recent follow-ups, trainings already" in TM view. (SRC-RPT-001) | P0 | Partial (TerritoryCommandDashboard built with coverage, training penetration, and overdue counts; revenue YTD requires Acumatica sync) | SRC-RPT-001, SRC-RPT-009 |
| FR-RPT-036 | Unlimited sales history per account | TM can view full order history for any account from inception, not capped at 1 year. Don: "Sales history per account, unlimited. Not one year." (SRC-RPT-001) | P0 | Parked (requires Acumatica full order history sync) | SRC-RPT-001 |
| FR-RPT-037 | Seasonal purchase pattern view | For any account, show month-by-month purchase amounts across multiple years so TMs can identify June uplift, etc. Don: "In June every year their sales have gone up by 20% … I need to be doing a training the month before." (SRC-RPT-001) | P1 | Parked (requires Acumatica multi-year history) | SRC-RPT-001 |
| FR-RPT-038 | Revenue by state — TM-scoped | Bar chart of TM's revenue broken out by state, monthly vs YTD. Ahmad demo'd "TM revenue matrix" and "revenue by state." (SRC-RPT-001) | P0 | Not-built (TerritoryCommandDashboard has state coverage counts; no revenue figures) | SRC-RPT-001 |
| FR-RPT-039 | 90-day account engagement staleness alert | TM dashboard flags accounts where last contact (email, phone, visit, training) was more than 90 days ago. | P0 | Built (TerritoryCommandDashboard has `overdue90DayCount` metric and orange badges) | SRC-RPT-009 |
| FR-RPT-040 | Account touch history view: email, phone, visit, training | Per-account log showing all contact events in a timeline, with type, date, TM, and notes. SRC-RPT-004: "Account touch history: email / phone / visit / training." | P0 | Partial (CustomerActivity log exists in accounts module; not surfaced in Reporting Home) | SRC-RPT-004 |
| FR-RPT-041 | Training overdue list — TM scope | List of accounts within TM territory where training has not occurred within the configured overdue threshold. C G: "This is that training overdue list I was mentioning." (SRC-RPT-001) | P0 | Not-built as dedicated reporting surface | SRC-RPT-001, SRC-RPT-004 |
| FR-RPT-042 | Consignment audit overdue list — TM scope | List of consignment sites within TM territory where the next ROSE audit is past due. C G confirmed this was visible in the prototype bottom of TM dashboard. (SRC-RPT-001) | P0 | Partial (ConsignmentOperationalAlert records built with AUDIT_OVERDUE alerts; no dedicated Reporting Home surface) | SRC-RPT-001, SRC-RPT-008 |

### 7.6 Regional Director Dashboard (FR-RPT-043 through FR-RPT-047)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|------------|---------------------|----------|-------------|-----|
| FR-RPT-043 | RD default dashboard in subordinate-rollup mode | When RD logs in, dashboard shows aggregate metrics across all TMs under them. Don: "It depends on the level of permissions … Tate comes in here, it shows him by default his territory." (SRC-RPT-001) | P0 | Partial (TerritoryCommandDashboard has regionRollups and ownerMetrics props; RD-default landing not built) | SRC-RPT-001, SRC-RPT-009 |
| FR-RPT-044 | Per-TM performance comparison view | Side-by-side comparison of TMs under RD: revenue, training hours, new accounts, overdue items. | P0 | Not-built | SRC-RPT-004 |
| FR-RPT-045 | RD territory revenue: monthly + YTD side-by-side | Ahmad demo'd "Regional Director rollup, some your revenue account for period and sprint." (SRC-RPT-001) | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-046 | State-level rollup for RD's territory | Revenue and activity counts by state across all TMs in the RD's territory. | P1 | Not-built | SRC-RPT-004 |
| FR-RPT-047 | RD intervention flags — TM or state needing action | Highlights the TM or state where overdue items, stale accounts, or low penetration warrant RD attention. SRC-RPT-004: "Which TM or state needs intervention?" | P0 | Not-built | SRC-RPT-004 |

### 7.7 Training Dashboard (FR-RPT-048 through FR-RPT-053)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|------------|---------------------|----------|-------------|-----|
| FR-RPT-048 | Training hours by account | Total training hours delivered to each account, filterable by period, TM, type. C G: "Can't run a report for how many trainings we did last month." (SRC-RPT-002) | P0 | Partial (TrainingWorkspace exists; no dedicated reporting view) | SRC-RPT-002, SRC-RPT-004 |
| FR-RPT-049 | Training hours by TM / RD / region / state | Aggregate training hours broken out by TM, RD, region, and state. | P0 | Not-built | SRC-RPT-004 |
| FR-RPT-050 | Training overdue / no-contact exception | Exception list: accounts that have not received training within the configured threshold (e.g. 90-day or 180-day policy). C G + Don discussed "90 days if set as parameter." (SRC-RPT-001) | P0 | Built (Training dashboard overdue-programs KPI + overdue-account list) | SRC-RPT-001, SRC-RPT-004 |
| FR-RPT-051 | Site visits vs trainings breakdown | Separate count of site visits (non-training) from training events so Michelle can see "site visit visibility separate from training." (SRC-RPT-004) | P1 | Built (Training dashboard separates site-visit count from training sessions/hours) | SRC-RPT-004 |
| FR-RPT-052 | Training type breakdown by TM | How many product trainings, sales trainings, certifications each TM has delivered, by period. | P1 | Not-built | SRC-RPT-004 |
| FR-RPT-053 | Training penetration by account tier (TM view) | Percentage of TM's accounts that have received at least one training in the configured active window. | P1 | Built (TerritoryCommandDashboard has trainingPenetration with penetrationPercent) | SRC-RPT-009 |

### 7.8 Consignment Dashboard (FR-RPT-054 through FR-RPT-059)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|------------|---------------------|----------|-------------|-----|
| FR-RPT-054 | Consignment dashboard: sites in scope, sites ordered/active, warehouse readiness, inventory snapshot, overdue audits, overdue POs | Ahmad demo'd these in Session 12: "Sites in scope ordered, warehouse readiness, inventory snapshot, overdue." (SRC-RPT-001) | P0 | Built (getConsignmentDashboard server endpoint with 14 metrics; ConsignmentWorkspace UI) | SRC-RPT-001, SRC-RPT-008 |
| FR-RPT-055 | Consignment audit compliance rate KPI | COUNT(audits completed on time) / COUNT(audits due). | P0 | Built (auditComplianceRatePct in consignment service) | SRC-RPT-008 |
| FR-RPT-056 | Overdue consignment audit list with drill-down | List view of sites where ROSE audit is past due, with TM, last audit date, days overdue. | P0 | Partial (alert records exist; list surface not in Reporting Home) | SRC-RPT-001, SRC-RPT-004 |
| FR-RPT-057 | Consignment variance / reconciliation summary | Sites with open discrepancy cases, missing item count, and reconciliation status. SRC-RPT-004: "Consignment variance / reconciliation — Ops and TM need the deepest view." | P0 | Partial (discrepancy cases built in service; no Reporting Home surface) | SRC-RPT-004 |
| FR-RPT-058 | Consignment PO overdue count and mean PO cycle days | Count of POs past the 5-day clock and average days from audit to PO received. | P0 | Built (overduePoCount and meanPoCycleDays in consignment service) | SRC-RPT-008 |
| FR-RPT-059 | Consignment inventory value by site | Current baseline quantity × price per site. Parked behind Acumatica inventory truth. | P2 | Parked (surfaced as dashed "Parked" card in Reports view per 05_CONSIGNMENT_PRD §4A.7) | SRC-RPT-008 |

### 7.9 Dynamic Report Builder (FR-RPT-060 through FR-RPT-068)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|------------|---------------------|----------|-------------|-----|
| FR-RPT-060 | Drag-drop field selector — choose any Pulse data field | User can add/remove fields by dragging from a field palette. C G: "We can go in there and just pick any parameter we want." (SRC-RPT-001) Ahmad demo'd field list with "select this one, add field here." | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-061 | Filters: by company, lead stage, state, territory, date range, TM/RD, training type, etc. | User can add one or more filter conditions. Ahmad demo'd "filtering parameters, sort by state, lead equals to company." (SRC-RPT-001) | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-062 | Sort order: ascending / descending on any field | User can set sort field and direction. | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-063 | Preview tab — live preview before saving | User sees a preview of the report result before committing to a saved template. Ahmad: "Preview that here in the Preview tab." (SRC-RPT-001) | P1 | Not-built | SRC-RPT-001 |
| FR-RPT-064 | Save report as personal template | User saves current report definition under "My Templates." C G: "Save it as their own personal report for future use." (SRC-RPT-001) | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-065 | Pre-built shared templates: TM Sales YTD, Training Hours by Account, Territory Revenue by State, Lead Stage Handoff, etc. | Admin-managed set of shared templates visible to applicable roles. Ahmad demo'd "pre-configured quick templates" including "TM sales year to year, training hours by account, territory revenue by state." (SRC-RPT-001) | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-066 | Report builder access gated by `reports.builder` action | Only roles with `reports.builder` permission can open the builder. Dealers have limited/no builder access (SRC-RPT-004). | P0 | Partial (action key defined; UI gating not yet implemented) | SRC-RPT-006, SRC-RPT-007 |
| FR-RPT-067 | Chart type selection in builder: bar, line, area | User can pick chart type for any built report. Ahmad: "Different chart options by area, line, and bar." (SRC-RPT-001) | P1 | Not-built | SRC-RPT-001 |
| FR-RPT-068 | Reports listing page — "Priority Reporting Subjects" section | Pre-built templates displayed as a browsable tile list. Ahmad demo'd "priority reporting subjects … pre-bit templates … click it, it will just pull up that preview." (SRC-RPT-001) | P0 | Not-built | SRC-RPT-001 |

### 7.10 Scheduled Report Delivery (FR-RPT-069 through FR-RPT-074)

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|------------|---------------------|----------|-------------|-----|
| FR-RPT-069 | Schedule a saved report for recurring email delivery | User selects a saved template, sets frequency (daily, weekly, monthly), day/time, and recipient list. Ahmad demo'd "daily operational check, weekly review pack, monthly leadership pack … Monday 9AM they will get the report." (SRC-RPT-001) | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-070 | Multi-recipient delivery list | Each scheduled report has a recipient list. Admin can add/remove recipients. | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-071 | Delivery format: CSV, PDF, Excel per schedule | User selects format at schedule-creation time. Ahmad: "CSV or PDF or in Excel PDF." (SRC-RPT-001) | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-072 | Auto-email: prior-month sales by TM / state / territory | C G: "The sales report I run monthly for the guys … this would do it by itself." Michelle: "That's why I love auto-email reports … I used them 30 years ago." (SRC-RPT-001) | P0 | Not-built (delivery requires Microsoft Graph) | SRC-RPT-001 |
| FR-RPT-073 | Scheduled report: training hours and overdue follow-up — monthly | Michelle: "An account that hasn't had training … any accounts on hold at the end of every month." (SRC-RPT-001) | P0 | Not-built | SRC-RPT-001 |
| FR-RPT-074 | Scheduled report delivery dispatcher (Microsoft Graph sendMail) | Email delivery uses Microsoft Graph. Persisted schedule records queue on `PENDING` until Graph credentials certified — same pattern as consignment/lead alert delivery. | P0 | Parked (Microsoft Graph credentials dependency) | SRC-RPT-001 |

### 7.11 Dashboard-mockup-sourced additions (FR-RPT-075 through FR-RPT-079)

Added 2026-06-20 from the client's as-is Dynamics 365 dashboard screenshots (`Meetings/Dashbaords/`, SRC-RPT-011), which the prior revision had not parsed (see *Scope additions*). Each row below is a widget the client uses today and/or voiced in discovery but which the original 74 FRs did not capture. Each was verified absent from the Reporting PRD via the 2026-06-20 cross-PRD refutation audit before being added here.

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|----|------------|---------------------|----------|-------------|-----|
| FR-RPT-075 | Revenue / sales by product category (and product line) | Executive and Sales dashboards include a "Sales by Product Category" widget (e.g. UV Lights, Air Cleaners, Media, Pan Treatment, Replacement Parts) for the trailing-12-month window, showing $ and % of total, drill-down to category. Client mockup "Active Product Categories — Last 12 Month Sales By Category"; Michelle (Session 7): "what percentage of our business is [each category] … air cleaner, UV lights, pant treatments, HEPA." Category taxonomy from Product Management PRD 13 (see OQ-RPT-011). | P1 | Parked (requires Acumatica order-line / product-category revenue sync) | SRC-RPT-011, SRC-RPT-012 |
| FR-RPT-076 | Affinity / buying-group member-list penetration | For each affinity / PE / buying group, a tile shows total member-list count, count of those members that are sold/active accounts, and penetration % (sold ÷ members), with drill-through to the member/account list. Client mockup "% of Sold Accounts of Member List Count" (Service Experts 69.31%, ARS 60.81%); Session 4: Dan cross-references member lists vs sales for rebates. Depends on member-list import (FR-L-004 / FR-ACC-018); metric definition pending (OQ-RPT-010). | P1 | Not-built (member-list import dependency) | SRC-RPT-011, SRC-RPT-013 |
| FR-RPT-077 | Sales goal vs actual — YTD attainment | Executive dashboard shows a configurable sales goal (company-wide and/or by business unit), actual YTD sales, $ delta, and attainment %, plus a monthly cumulative-sales-vs-straight-line-goal chart. Client mockup "Current Year Goals vs. Sales" (Total Sales Goal = $40M, Goal-CYTD bars). ⚠️ Present in the as-is dashboard but **not voiced in any discovery transcript** — confirm with client before building (OQ-RPT-009). | P2 | Not-built (goal config is Pulse-owned; actual revenue Parked on Acumatica sync) | SRC-RPT-011 |
| FR-RPT-078 | Top-N ranked account tiles — Top Customers, Top YoY Increases, Top Declining-but-Active | Three ranked tiles with configurable N (default 20): (a) Top Customers by trailing-12-month revenue; (b) Top YoY revenue increases; (c) Top YoY revenue **declines among still-active accounts** — an early-churn-warning view distinct from Lost Accounts (FR-RPT-015). Each drills to the account list. Client mockups "Top 20 Customers (Last 12 Mo)", "Top YoY Sales Increases", "Top YoY Sales Declines"; Michelle (Session 12): "we like to see the dip." | P1 | Parked (requires Acumatica revenue figures) | SRC-RPT-011, SRC-RPT-001 |
| FR-RPT-079 | New-account acquisition count by month and by owner | Count (not revenue) of newly acquired accounts by first-order / onboarding month, plus a ranking by owner/RSM and a rollup by RD/region. Distinct from FR-RPT-014 (new-account *revenue* yr1/yr2). Client mockups "Residential First Order Dates — New Accounts By Month" and "New Accounts This Fiscal Year by Owner." | P1 | Not-built (CRM onboarding / first-order date; first-order-shipped figure may need Acumatica) | SRC-RPT-011 |

**Cross-referenced (captured in other module PRDs — no Reporting FR added):**

- **Contest / campaign ROI reporting per TM** (units given away, monetary value, coupon/gift-card redemption, sales lift) — parked under the Promotions/Coupons/Contests PRD (**PCC-006**), with reward-tracking in Training **FR-TRN-055** and coupon redemption in Dealer Portal **FR-DPO-037**. When the Promotions module is activated, its ROI reporting surface attaches to Reporting Home. Sessions 4/5/7 (Michelle, C G, Ahmad). See §6 Parked Dependencies.
- **Dealer self-serve rebate-qualifying spend** (quarter filter, shipping excluded) — fully captured in Dealer Portal PRD **FR-DPO-012** (YTD/monthly spend), **FR-DPO-062** (quarter / date-range filter), **FR-DPO-064** (shipping excluded from rebate-eligible spend), all sourced to Session 11 (Michelle: "they do not get rebates if they paid any shipping"). Not a Reporting-PRD gap; this PRD only cross-references it for the dealer reporting tab.

---

## 8. Non-Functional Requirements

| ID | Category | Requirement | Priority | SRC |
|----|----------|-------------|----------|-----|
| NFR-RPT-001 | Performance | Pre-built dashboard KPI cards must load within 2 seconds for any role's default view on a warm cache. | P0 | (inferred standard; consistent with consignment dashboard server-computation pattern) |
| NFR-RPT-002 | Performance | Report builder preview must return results within 5 seconds for datasets up to 10,000 rows. | P0 | (inferred standard) |
| NFR-RPT-003 | Performance | Scheduled report generation (export) must complete within 30 seconds for any single saved template. | P1 | (inferred standard) |
| NFR-RPT-004 | Security / AuthZ | Every reporting query must apply the user's role scope before returning results — no raw table access. TM cannot query another TM's territory. | P0 | SRC-RPT-004, SRC-RPT-006 |
| NFR-RPT-005 | Security / AuthZ | `reports.executive` action required for Executive dashboard tab. `reports.builder` required for Report Builder entry. Dealer role is explicitly restricted from consignment and internal sales data. | P0 | SRC-RPT-005 (Steve Mores: "I don't want dealers seeing consignment"), SRC-RPT-006 |
| NFR-RPT-006 | Security / AuthZ | Scheduled report delivery list is admin-managed; recipients cannot self-add to reports they do not have view access to. | P0 | (inferred standard) |
| NFR-RPT-007 | Scalability | Dashboard endpoint must support at least 500 concurrent sessions without degradation. Expected peak when leadership runs month-end reports simultaneously. | P1 | SRC-RPT-002 (100 employees, thousands of accounts) |
| NFR-RPT-008 | Scalability | Report builder must handle the full historical dataset (1,000+ accounts, multi-year order history once Acumatica sync complete) without timeout. | P1 | SRC-RPT-001 (Don: "unlimited history") |
| NFR-RPT-009 | Availability | Reporting module must be available during business hours with the same SLA as the rest of Pulse (99.5% uptime target). | P1 | (inferred standard) |
| NFR-RPT-010 | Auditability | All saved report template creations, edits, and deletions must be recorded in the system audit log with user, timestamp, and action. | P0 | (inferred standard) |
| NFR-RPT-011 | Auditability | Scheduled report dispatch events (queued, sent, failed) must be logged with job ID and recipient list. | P0 | (inferred standard) |
| NFR-RPT-012 | Accessibility | Dashboard KPI cards and report tables must meet WCAG 2.1 AA contrast standards. Charts must have accessible data table fallbacks. | P1 | (inferred standard) |
| NFR-RPT-013 | Observability | Report builder query durations and dashboard load times must be emitted as structured metrics consumable by the existing observability stack. | P1 | (inferred standard) |
| NFR-RPT-014 | Data Retention | Saved report templates are retained indefinitely while the user account exists. Scheduled delivery job logs retained for 90 days. | P1 | (inferred standard) |
| NFR-RPT-015 | Data Freshness | Dashboard KPI cards sourcing from Acumatica must display `lastSyncedAt` timestamp and a stale-data warning if sync is > 24 hours old. Same pattern as consignment Acumatica-sourced numbers. | P0 | SRC-RPT-008 (05_CONSIGNMENT_PRD §4A.6 rule 3) |

---

## 9. Assumptions

| ID | Assumption |
|----|-----------|
| ASM-RPT-001 | Acumatica will eventually provide an API endpoint for order/invoice history, AR aging, and credit-hold flags. Until then, all financial KPIs in dashboards remain Parked with a dashed placeholder card. |
| ASM-RPT-002 | The "active account" definition (ordered in last N months) is a single configurable admin parameter that applies globally to all dashboards and reports. The N value starts at 12 months per Michelle Hogan (SRC-RPT-001) pending executive confirmation. |
| ASM-RPT-003 | Prior-year (2024) QuickBooks data is not available for automated YoY comparison until a manual migration or export is completed. The YoY dashboards will show Acumatica data from Jan 2025 forward; pre-2025 comparisons require a separate data-migration effort not in Pulse scope. |
| ASM-RPT-004 | Scheduled report email delivery uses Microsoft Graph (same provider as lead and consignment alerts). Delivery will remain Parked at `PENDING` until Graph credentials are certified. |
| ASM-RPT-005 | The Report Builder exposes only fields from Pulse's own data model (accounts, leads, training, consignment, territories, contacts, activity log). It does not expose raw Acumatica or Shopify tables. |
| ASM-RPT-006 | Role-scoped data visibility (row-level security) is enforced at the API layer using the same `siteScopeWhere` / `territoryScopeWhere` patterns already used in consignment and territory modules — not at the database layer. |
| ASM-RPT-007 | "Training overdue" threshold is a configurable admin parameter per training type (product training, sales training, etc.) rather than a single global value. Default threshold is 90 days unless otherwise configured. |
| ASM-RPT-008 | Dealer-role users access the Dealer Portal reporting tab, not the internal Reporting Home. The internal `/reports` route is inaccessible to Dealer role. |

---

## 10. Open Questions

| ID | Question | Impact | Decision Owner |
|----|---------|--------|---------------|
| OQ-RPT-001 | What is the confirmed "active account" threshold in months? Michelle said 1 year; Don disagreed; C G said it should be configurable. What is the Phase 1 default? | KPI card calculation; affects lost-account list | C G, Michelle Hogan |
| OQ-RPT-002 | Will the QuickBooks 2024 data be migrated to Pulse for prior-year comparison, or will the YoY dashboards simply show N/A for pre-2025? | YoY executive dashboard (FR-RPT-012/013) | Dan Harshbarger, Finance |
| OQ-RPT-003 | Which specific reports should be pre-built as admin-shared templates vs left to users in the Report Builder? Is there a formal list from Michelle / C G? | Scope of pre-built template work | Michelle Hogan, C G |
| OQ-RPT-004 | Should Dealers have any read-only access to saved report templates showing their own account data, or is their reporting entirely within the Dealer Portal module? | Role access boundary | C G, Steve Mores |
| OQ-RPT-005 | What is the cadence and recipient list for the prior-month sales report that C G manually runs today? This determines the first scheduled report definition. | FR-RPT-072 scope | C G, Michelle Hogan |
| OQ-RPT-006 | Is the "training overdue" threshold the same 90-day cycle Don mentioned, or is it different per training type (e.g. 180 days for certification vs 90 days for product training)? | FR-RPT-050, ASM-RPT-007 | C G, Training Ops |
| OQ-RPT-007 | Should the Report Builder allow creating reports across modules (e.g. a single row = account + last training date + last order date + consignment status)? Or is it module-scoped? | Builder architecture complexity | Product / Architecture |
| OQ-RPT-008 | Adrienne asked about styling website intake forms to match brand. Does the same branding customization extend to exported PDF reports (logo, colours)? | FR-RPT-008 export format scope | Adrienne Cardinale, C G |
| OQ-RPT-009 | Sales goal vs actual appears in the client's as-is Dynamics dashboard ($40M company goal) but was **never voiced in any discovery session**. Does the client want goal/attainment tracking carried into Pulse, and what is the goal source — single admin-entered company goal, by business unit, by TM, or imported? | FR-RPT-077 (build vs drop) | C G, Michelle Hogan, Dan Harshbarger |
| OQ-RPT-010 | Member-list penetration metric definition: is a member counted as "sold/active" by the configurable active-account window, by any historical order, or by current-year order? And is penetration computed on member **count** or member **revenue**? | FR-RPT-076 calculation | Dan Harshbarger (rebate logic), Michelle Hogan |
| OQ-RPT-011 | Product-category revenue: should the internal Executive/Sales dashboards mirror the dealer-portal category breakdown (OQ-DPO-005), and what is the canonical category taxonomy (from Product Management PRD 13)? | FR-RPT-075 scope + taxonomy | Product, Michelle Hogan |

---

## 11. Requirement → Source Traceability Matrix

| FR / NFR ID | SRC ID(s) | Session(s) |
|-------------|-----------|-----------|
| FR-RPT-001 | SRC-RPT-001, SRC-RPT-004 | Session 12 (24 Mar 2026), Traceability Matrix |
| FR-RPT-002 | SRC-RPT-001, SRC-RPT-005 | Session 12, April scope review |
| FR-RPT-003 | SRC-RPT-001 | Session 12 |
| FR-RPT-004 | SRC-RPT-006, SRC-RPT-007 | Code — auth contracts |
| FR-RPT-005 | SRC-RPT-001 | Session 12 |
| FR-RPT-006 | SRC-RPT-001 | Session 12 |
| FR-RPT-007 | SRC-RPT-001 | Session 12 |
| FR-RPT-008 | SRC-RPT-001, SRC-RPT-005 | Session 12, April scope review |
| FR-RPT-009 | SRC-RPT-001 | Session 12 |
| FR-RPT-010 | SRC-RPT-006 | Code — auth contracts |
| FR-RPT-011 | SRC-RPT-001 | Session 12 |
| FR-RPT-012 | SRC-RPT-001 | Session 12 (Michelle Hogan) |
| FR-RPT-013 | SRC-RPT-001 | Session 12 (Michelle Hogan) |
| FR-RPT-014 | SRC-RPT-001 | Session 12 (Michelle Hogan) |
| FR-RPT-015 | SRC-RPT-001 | Session 12 (Michelle Hogan) |
| FR-RPT-016 | SRC-RPT-001 | Session 12 |
| FR-RPT-017 | SRC-RPT-001, SRC-RPT-009 | Session 12; TerritoryCommandDashboard |
| FR-RPT-018 | SRC-RPT-004, SRC-RPT-005 | Traceability Matrix; April scope review |
| FR-RPT-019 | SRC-RPT-001, SRC-RPT-004 | Session 12; Traceability Matrix |
| FR-RPT-020 | SRC-RPT-006, SRC-RPT-007 | Code — auth contracts |
| FR-RPT-021 | SRC-RPT-001, SRC-RPT-004 | Session 12; Traceability Matrix |
| FR-RPT-022 | SRC-RPT-001, SRC-RPT-004 | Session 12; Traceability Matrix |
| FR-RPT-023 | SRC-RPT-001 | Session 12 |
| FR-RPT-024 | SRC-RPT-004 | Traceability Matrix |
| FR-RPT-025 | SRC-RPT-001 | Session 12 |
| FR-RPT-026 | SRC-RPT-001 | Session 12 (Adrienne Cardinale) |
| FR-RPT-027 | SRC-RPT-004 | Traceability Matrix |
| FR-RPT-028 | SRC-RPT-001 | Session 12 |
| FR-RPT-029 | SRC-RPT-001 | Session 12 (C G) |
| FR-RPT-030 | SRC-RPT-001, SRC-RPT-004 | Session 12; Traceability Matrix |
| FR-RPT-031 | SRC-RPT-004 | Traceability Matrix |
| FR-RPT-032 | SRC-RPT-004 | Traceability Matrix |
| FR-RPT-033 | SRC-RPT-001 | Session 12 (Michelle Hogan) |
| FR-RPT-034 | SRC-RPT-004 | Traceability Matrix |
| FR-RPT-035 | SRC-RPT-001, SRC-RPT-009 | Session 12; TerritoryCommandDashboard code |
| FR-RPT-036 | SRC-RPT-001 | Session 12 (Don Hearn) |
| FR-RPT-037 | SRC-RPT-001 | Session 12 (Don Hearn) |
| FR-RPT-038 | SRC-RPT-001 | Session 12 |
| FR-RPT-039 | SRC-RPT-009 | TerritoryCommandDashboard code (built) |
| FR-RPT-040 | SRC-RPT-004 | Traceability Matrix |
| FR-RPT-041 | SRC-RPT-001, SRC-RPT-004 | Session 12; Traceability Matrix |
| FR-RPT-042 | SRC-RPT-001, SRC-RPT-004 | Session 12; Traceability Matrix |
| FR-RPT-043 | SRC-RPT-001, SRC-RPT-009 | Session 12; TerritoryCommandDashboard code |
| FR-RPT-044 | SRC-RPT-004 | Traceability Matrix |
| FR-RPT-045 | SRC-RPT-001 | Session 12 |
| FR-RPT-046 | SRC-RPT-004 | Traceability Matrix |
| FR-RPT-047 | SRC-RPT-004 | Traceability Matrix |
| FR-RPT-048 | SRC-RPT-002, SRC-RPT-004 | CG–Dynamics Meeting 2; Traceability Matrix |
| FR-RPT-049 | SRC-RPT-004 | Traceability Matrix |
| FR-RPT-050 | SRC-RPT-001, SRC-RPT-004 | Session 12; Traceability Matrix |
| FR-RPT-051 | SRC-RPT-004 | Traceability Matrix (Michelle Hogan) |
| FR-RPT-052 | SRC-RPT-004 | Traceability Matrix |
| FR-RPT-053 | SRC-RPT-009 | TerritoryCommandDashboard code (built) |
| FR-RPT-054 | SRC-RPT-001, SRC-RPT-008 | Session 12; consignment service (built) |
| FR-RPT-055 | SRC-RPT-008 | consignment service (built) |
| FR-RPT-056 | SRC-RPT-001, SRC-RPT-004 | Session 12; Traceability Matrix |
| FR-RPT-057 | SRC-RPT-004 | Traceability Matrix |
| FR-RPT-058 | SRC-RPT-008 | consignment service (built) |
| FR-RPT-059 | SRC-RPT-008 | consignment service (parked card) |
| FR-RPT-060 | SRC-RPT-001 | Session 12 |
| FR-RPT-061 | SRC-RPT-001 | Session 12 |
| FR-RPT-062 | SRC-RPT-001 | Session 12 |
| FR-RPT-063 | SRC-RPT-001 | Session 12 |
| FR-RPT-064 | SRC-RPT-001 | Session 12 (C G) |
| FR-RPT-065 | SRC-RPT-001 | Session 12 |
| FR-RPT-066 | SRC-RPT-006, SRC-RPT-007 | Code — auth contracts |
| FR-RPT-067 | SRC-RPT-001 | Session 12 |
| FR-RPT-068 | SRC-RPT-001 | Session 12 |
| FR-RPT-069 | SRC-RPT-001 | Session 12 |
| FR-RPT-070 | SRC-RPT-001 | Session 12 |
| FR-RPT-071 | SRC-RPT-001 | Session 12 |
| FR-RPT-072 | SRC-RPT-001 | Session 12 (C G, Michelle Hogan) |
| FR-RPT-073 | SRC-RPT-001 | Session 12 (Michelle Hogan) |
| FR-RPT-074 | SRC-RPT-001 | Session 12 |
| FR-RPT-075 | SRC-RPT-011, SRC-RPT-012 | Dashboard mockups (2026-06-20); Session 7 (Michelle, product-category %) |
| FR-RPT-076 | SRC-RPT-011, SRC-RPT-013 | Dashboard mockups; Session 4 (Dan member-list/rebate cross-reference) |
| FR-RPT-077 | SRC-RPT-011 | Dashboard mockups only — as-is, not voiced (see OQ-RPT-009) |
| FR-RPT-078 | SRC-RPT-011, SRC-RPT-001 | Dashboard mockups; Session 12 (Michelle, "the dip") |
| FR-RPT-079 | SRC-RPT-011 | Dashboard mockups |
| NFR-RPT-001 | (inferred) | — |
| NFR-RPT-002 | (inferred) | — |
| NFR-RPT-003 | (inferred) | — |
| NFR-RPT-004 | SRC-RPT-004, SRC-RPT-006 | Traceability Matrix; auth contracts |
| NFR-RPT-005 | SRC-RPT-005, SRC-RPT-006 | April scope review; auth contracts |
| NFR-RPT-006 | (inferred) | — |
| NFR-RPT-007 | SRC-RPT-002 | CG–Dynamics Meeting 2 |
| NFR-RPT-008 | SRC-RPT-001 | Session 12 (Don Hearn) |
| NFR-RPT-009 | (inferred) | — |
| NFR-RPT-010 | (inferred) | — |
| NFR-RPT-011 | (inferred) | — |
| NFR-RPT-012 | (inferred) | — |
| NFR-RPT-013 | (inferred) | — |
| NFR-RPT-014 | (inferred) | — |
| NFR-RPT-015 | SRC-RPT-008 | consignment service architecture |

---

## 12. Build Status Summary (Not-Built / Parked Gap List)

The lists below were reconciled against the shipped code on 2026-06-20 (see *Build-status reconciliation*) and categorize all 79 FRs.

**Built (confirmed in code):**
FR-RPT-010 (reports module + route + nav), FR-RPT-018 (exec cross-module exception summary), FR-RPT-020 (reports.executive gate), FR-RPT-021 (lead intake by source/state), FR-RPT-023 (lead→account conversion rate), FR-RPT-026 (homeowner/contractor segmentation), FR-RPT-039 (90-day staleness), FR-RPT-050 (training-overdue exception), FR-RPT-051 (site visits vs trainings), FR-RPT-053 (training penetration), FR-RPT-054 (consignment dashboard), FR-RPT-055 (audit compliance KPI), FR-RPT-058 (PO overdue count + mean cycle days), FR-RPT-064 (saved report definitions, personal/shared), FR-RPT-066 (builder gated on reports.builder), FR-RPT-069 (recurring schedules), FR-RPT-070 (multi-recipient delivery list)

**Partial (backing code exists; full Reporting Home surface not built):**
FR-RPT-001 (shell + default tab; per-role defaults pending), FR-RPT-002 (tabs Exec/Leads/Training/Saved-reports; remaining role dashboards pending), FR-RPT-004 (row-level scope enforced in executors + dashboards; not every surface), FR-RPT-005 (drill-down navigates to module list; in-place filtered drawer pending), FR-RPT-008 (CSV on saved-report runs; Excel/PDF + dashboard export pending), FR-RPT-011 (exec CRM KPIs built; revenue/active-accounts parked), FR-RPT-022 (stage counts; aging pending), FR-RPT-025, FR-RPT-030, FR-RPT-031, FR-RPT-035, FR-RPT-040, FR-RPT-042, FR-RPT-043, FR-RPT-048 (total hours; per-account pending), FR-RPT-049 (by trainer; RD/region/state pending), FR-RPT-052 (type breakdown; per-TM pending), FR-RPT-056, FR-RPT-061 (config filters; arbitrary-field pending), FR-RPT-065 (report types as shared saved reports; named templates pending), FR-RPT-068 (saved-reports list; pre-built tile section pending), FR-RPT-072 (scheduling built; delivery preview-mode), FR-RPT-073 (training schedule built; delivery preview-mode), FR-RPT-074 (preview dispatcher built; Microsoft Graph send Parked)

**Not-built (Pulse-owned work, no external blocker):**
FR-RPT-003, FR-RPT-006, FR-RPT-007, FR-RPT-009, FR-RPT-012, FR-RPT-013, FR-RPT-014, FR-RPT-015, FR-RPT-016, FR-RPT-019, FR-RPT-024, FR-RPT-027, FR-RPT-034, FR-RPT-038, FR-RPT-041, FR-RPT-044, FR-RPT-045, FR-RPT-046, FR-RPT-047, FR-RPT-057, FR-RPT-060 (drag-drop any-field builder), FR-RPT-062, FR-RPT-063, FR-RPT-067, FR-RPT-071, FR-RPT-076 (member-list import dependency), FR-RPT-077 (goal config; revenue parked), FR-RPT-079 (new-account count)

**Parked (blocked on Acumatica sync or Microsoft Graph):**
FR-RPT-017 (revenue figures), FR-RPT-028, FR-RPT-029, FR-RPT-032, FR-RPT-033 (delivery), FR-RPT-036, FR-RPT-037, FR-RPT-059, FR-RPT-075 (product-category revenue), FR-RPT-078 (Top-N revenue rankings)

**Cross-referenced to other module PRDs (no Reporting FR — see §7.11):**
Contest / campaign ROI reporting → Promotions PCC-006 + Training FR-TRN-055 + Dealer FR-DPO-037; Dealer rebate-qualifying spend (shipping excluded, quarter filter) → Dealer Portal FR-DPO-012 / FR-DPO-062 / FR-DPO-064
