# Risk Closure Tracker — Dynamic AQS CRM
**Date Created:** March 29, 2026
**Last Updated:** March 30, 2026
**Purpose:** Companion planning tracker for Sprint 1 risk closure. Use `RAID_LOG_INITIAL.csv` as the live source for current risk status, counts, and decision state.
**Owner:** Program Manager

---

## Executive Summary

| Category | Count | Critical | High | Medium |
|----------|-------|----------|------|--------|
| **Live Open Risks in RAID Register** | 23 | See RAID register | See RAID register | See RAID register |
| **Total Open RAID Items** | 34 | See RAID register | See RAID register | See RAID register |
| **Current Control Model** | Four-week pre-sprint closure planning | Week 1 | Week 2 | Week 3-4 |
| **This Document** | Planning and evidence framework | Not source of truth | Not source of truth | Not source of truth |

---

## Priority Sprint 1 Risks

### RAID-026: Frontend Production Readiness
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | Engineering Lead |
| **Target Closure** | Apr 4, 2026 (Week 1) |
| **Closure Criteria** | ✅ All 143 console.log statements removed ✅ MockDataProvider removed + real API layer implemented ✅ Error boundaries + Sentry integration added ✅ 60% test coverage on critical paths ✅ Giant components (LeadPipeline, CISForm) extracted ✅ Next.js locked to stable GA (v16) ✅ Production security audit passed |
| **Effort** | 60-80 hours |
| **Blockers** | Acumatica API contracts must be finalized first (blocks INT-001) |
| **Dependencies** | FRONTEND_PROTOTYPE_DETAILED_AUDIT.md / ACUMATICA_INTEGRATION_PRD.md |
| **Evidence of Closure** | Git commit with "Remove mocks + API layer" + passing test suite + Lighthouse 90+ |
| **Sign-Off** | Engineering Manager + QA Lead |

### RAID-027: Baseline Traceability & Decision Closure Plan
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | Program Manager |
| **Target Closure** | Apr 25, 2026 (Week 4) |
| **Closure Criteria** | ✅ Phase 1 validation sessions completed (20h) ✅ Phase 2 P0 deep-dive (29h) ✅ Phase 3 async questionnaires returned (31h) ✅ Phase 4 session reruns (28h) ✅ All 190 active WBS rows reviewed against discovery, PRDs, or governance decisions ✅ METRIC_DEFINITION_REGISTER reviewed ✅ Remaining open questions explicitly assigned, deferred, or signed off |
| **Effort** | 108 hours validation + 504 hours PRD supplements |
| **Blockers** | None (runs parallel with other activities) |
| **Dependencies** | plans/VALIDATION_AND_MAPPING_ROADMAP.md / PROJECT_BREAKDOWN_DETAILED.csv |
| **Evidence of Closure** | WBS-to-discovery traceability review complete + PRD readiness matrix refreshed + current open-question ownership documented |
| **Sign-Off** | Steering Committee + Product Owner |

### RAID-028: Database Schema Generation
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | Architect + Backend Lead |
| **Target Closure** | Apr 8, 2026 (Week 2) |
| **Closure Criteria** | ✅ Prisma schema generated for all 110+ entities ✅ Field definitions complete (type, nullable, default, index) ✅ Relationships + cascade behavior defined ✅ Soft-delete vs hard-delete decisions finalized ✅ Encryption field strategy (PCI, PHI) documented ✅ Audit trail schema designed ✅ Schema migration scripts tested on local database ✅ Backend team can create tables and write queries |
| **Effort** | 40 hours |
| **Blockers** | RAID-029 (field mappings) must complete first |
| **Dependencies** | SYSTEM_ERD_BLUEPRINT.md / FOUNDATION_SECURITY_ADMIN_SUPPLEMENT.md / RAID-029 |
| **Evidence of Closure** | prisma/schema.prisma file complete + npx prisma migrate dev runs without error + documentation with all entity descriptions |
| **Sign-Off** | Architect + Senior Backend Engineer |

### RAID-029: Field-Level Mapping Workbooks (7 Entities)
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | BA + Integration Lead + Acumatica SME |
| **Target Closure** | Apr 4, 2026 (Week 1) |
| **Closure Criteria** | ✅ Customer mapping (Acumatica ARCustomer ↔ CRM Customer) ✅ Contact mapping (Acumatica Contact ↔ CRM Contact) ✅ Product mapping (Acumatica Item ↔ CRM Product) ✅ Pricing mapping (Acumatica PriceClass ↔ CRM Pricing) ✅ Consignment mapping (Acumatica Warehouse ↔ CRM ConsignmentSite) ✅ Order mapping (CRM Order → Acumatica SalesOrder) ✅ Reporting mappings (multi-source → ReportingLayer) ✅ All workbooks include: source field, target field, transformation rule, default value, required/optional, conflict resolution |
| **Effort** | 30 hours |
| **Blockers** | Acumatica SME availability + INT-001 through INT-007 contracts must be reviewed |
| **Dependencies** | ACUMATICA_INTEGRATION_PRD.md / DATA_MIGRATION_MATRIX.csv |
| **Evidence of Closure** | 7 Excel workbooks (CUSTOMER_MAPPING.xlsx, CONTACT_MAPPING.xlsx, PRODUCT_MAPPING.xlsx, PRICING_MAPPING.xlsx, CONSIGNMENT_MAPPING.xlsx, ORDER_MAPPING.xlsx, REPORTING_MAPPING.xlsx) signed off by Acumatica SME |
| **Sign-Off** | Acumatica SME + Integration Lead |

### RAID-001: ERP Customer Creation Trigger Decision
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | Product Owner |
| **Target Closure** | Apr 1, 2026 (Week 1) |
| **Closure Criteria** | ✅ Decision made: CIS-triggered vs first-order-triggered customer creation ✅ Documented impact on: (1) Customer entity lifecycle, (2) INT-001 sync flow, (3) Dealer portal activation, (4) Reporting qualification rules ✅ Acumatica sync contract updated with decision ✅ Finance + Product + Acumatica SME align ✅ DEP-003 (Customer onboarding) kickoff can proceed |
| **Effort** | 4 hours (1 decision session) |
| **Blockers** | ACUMATICA_INTEGRATION_PRD.md must be reviewed by decision makers |
| **Dependencies** | INT-001 / DEP-001 / DEP-003 / ACUMATICA_INTEGRATION_PRD.md |
| **Evidence of Closure** | Decision memo: "Customer created on [CIS/First Order], rationale: [X], impacts: [1,2,3,4], approved by: [signatures]" |
| **Sign-Off** | Product Owner + Finance VP |

### RAID-004: Consignment Site Count Reconciliation
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | Consignment SME + Acumatica SME |
| **Target Closure** | Apr 4, 2026 (Week 1) |
| **Closure Criteria** | ✅ Authoritative consignment site list created from Acumatica ✅ Site counts reconciled (active, exited, new, total) ✅ C-{TYPE}-{CITY} naming convention validated ✅ Site master signed off by Consignment SME ✅ DEP-011 (consignment audit scheduler) can reference authoritative list |
| **Effort** | 6 hours |
| **Blockers** | Acumatica system access required |
| **Dependencies** | MIG-014 / DEP-011 / INT-007 |
| **Evidence of Closure** | CONSIGNMENT_SITE_MASTER.xlsx with: SiteID, SiteName, Type, City, Status, WarehouseID, reconciliation memo |
| **Sign-Off** | Consignment SME + Finance |

### RAID-024: Product Identity / SKU-to-Asset Linkage
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | Product Lead + Data Lead |
| **Target Closure** | Apr 8, 2026 (Week 2) |
| **Closure Criteria** | ✅ Canonical Product Master created: Acumatica ItemID, Shopify ProductID, CRM Product Name, Status, Asset Linkage, Brand/Region Rules, Variant Strategy ✅ Item-to-asset linkage database built ✅ Data quality audit on 50+ sample products passed ✅ Wrong-brand/wrong-asset prevention rules documented ✅ INT-002 (product sync) contract aligned with master |
| **Effort** | 20 hours |
| **Blockers** | RAID-029 (product field mapping) must complete first |
| **Dependencies** | MIG-021 / INT-002 / INT-023 / RAID-029 / PRODUCT_MANAGEMENT_ACUMATICA_INTEGRATION_ARCHITECTURE.md |
| **Evidence of Closure** | PRODUCT_MASTER_CANONICAL.xlsx + data_quality_audit.md + INT-002 contract v2 with asset linkage rules |
| **Sign-Off** | Product Lead + Quality Lead |

---

## HIGH Priority Risks (10) — Week 2-3 Closure Required

### RAID-002: Acumatica API Readiness
| Field | Value |
|-------|-------|
| **Status** | 🟡 Partially Mitigated |
| **Owner** | Integration Lead |
| **Target Closure** | Apr 11, 2026 (Week 2) |
| **Closure Criteria** | ✅ Sandbox API access confirmed ✅ INT-001 through INT-007 endpoint URLs validated ✅ Authentication method confirmed (OAuth / API Key) ✅ Rate limiting documented ✅ Pagination strategy tested ✅ Error response format verified ✅ Sample API calls successful for all 7 integrations |
| **Effort** | 20 hours |
| **Blockers** | Acumatica system access + vendor cooperation |
| **Dependencies** | ACUMATICA_INTEGRATION_PRD.md / INT-001 to INT-007 |
| **Evidence of Closure** | Acumatica Sandbox Validation Memo: "All 7 APIs confirmed functional. Endpoints: [URLs]. Auth: [method]. Rate limit: [X req/min]. Pagination: [strategy]." |
| **Sign-Off** | Integration Lead + Acumatica Technical Contact |

### RAID-003: Historical Data Quality Assessment
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | Migration Lead |
| **Target Closure** | Apr 18, 2026 (Week 3) |
| **Closure Criteria** | ✅ Data profiling complete for Dynamics, HubSpot, Map My Customer, QuickBooks ✅ Duplicate detection rules documented ✅ Confidence classifications assigned to records ✅ Archive-vs-migrate decisions documented ✅ Data quality thresholds set per entity ✅ Remediation plan for low-confidence records ✅ Migration rehearsal runs successfully with profiled data |
| **Effort** | 25 hours |
| **Blockers** | Access to legacy systems + time for profiling |
| **Dependencies** | MIG-008 to MIG-018 / DATA_MIGRATION_MATRIX.csv |
| **Evidence of Closure** | data_quality_profile.xlsx with confidence distribution + remediation_plan.md |
| **Sign-Off** | Migration Lead + Data Quality Lead |

### RAID-005: Dealer Payment Processor Model (US/CA Split)
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | Finance + Product |
| **Target Closure** | Apr 11, 2026 (Week 2) |
| **Closure Criteria** | ✅ Regional payment processor selected for US ✅ Regional payment processor selected for Canada ✅ Integration approach documented (tokenized vs hosted) ✅ PCI compliance strategy confirmed ✅ ERP settlement mapping documented ✅ Dealer portal payment UI design aligned with provider ✅ INT-012 and INT-027 contracts updated |
| **Effort** | 10 hours |
| **Blockers** | Finance + vendor cooperation |
| **Dependencies** | INT-012 / INT-027 / DEP-019 / DEP-023 |
| **Evidence of Closure** | payment_provider_selection.md: "US: [Provider], Canada: [Provider], Rationale: [X], Integration: [approach], ERP settlement: [method]" |
| **Sign-Off** | Finance VP + Product Owner |

### RAID-006: Outlook/Microsoft 365 Approval
| Field | Value |
|-------|-------|
| **Status** | 🟡 In Progress |
| **Owner** | Security Lead |
| **Target Closure** | Apr 18, 2026 (Week 3) |
| **Closure Criteria** | ✅ Application registration submitted to Microsoft ✅ OAuth consent workflow tested ✅ Graph API scopes approved (Calendar, Mail) ✅ Tenant policy review completed ✅ Security review approved ✅ INT-009 and INT-010 contracts finalized |
| **Effort** | 8 hours |
| **Blockers** | Microsoft approval cycle (typically 1-2 weeks) |
| **Dependencies** | INT-009 / INT-010 / DEP-018 / DEP-021 |
| **Evidence of Closure** | Microsoft application approval email + OAuth testing report |
| **Sign-Off** | Security Lead + Compliance |

### RAID-007: Training Portal Integration Capability
| Field | Value |
|-------|-------|
| **Status** | 🟡 Open |
| **Owner** | Training SME |
| **Target Closure** | Apr 11, 2026 (Week 2) |
| **Closure Criteria** | ✅ Training vendor API capability confirmed OR ✅ Fallback CSV/file import process designed ✅ Learner identity mapping approach documented ✅ Certification completion capture method confirmed ✅ INT-011 contract finalized with fallback ✅ Core training proof independent of external sync |
| **Effort** | 6 hours |
| **Blockers** | Training vendor response |
| **Dependencies** | INT-011 / DEP-022 |
| **Evidence of Closure** | training_integration_decision.md: "[API available / CSV fallback selected], approach: [X]" |
| **Sign-Off** | Training SME |

### RAID-008: Dealer Company-Wide Visibility Access Rules
| Field | Value |
|-------|-------|
| **Status** | 🟡 Open |
| **Owner** | Security + Product |
| **Target Closure** | Apr 11, 2026 (Week 2) |
| **Closure Criteria** | ✅ Account-admin role model documented ✅ Access delegation rules defined ✅ Company-wide visibility scoped (who sees what) ✅ Pilot account list identified (3-5 representative accounts) ✅ DEP-004 (dealer identity) and DEP-026 (dealer access) design incorporates rules |
| **Effort** | 8 hours |
| **Blockers** | Dealer stakeholder input |
| **Dependencies** | DEP-004 / DEP-026 / FOUNDATION_SECURITY_ADMIN_SUPPLEMENT.md |
| **Evidence of Closure** | dealer_access_rules.md with role definitions + pilot_account_list.xlsx |
| **Sign-Off** | Security Lead + Dealer Portal Lead |

### RAID-009: Mobile Offline Merge Behavior UX
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | Mobile Lead + Product |
| **Target Closure** | Apr 25, 2026 (Week 4) |
| **Closure Criteria** | ✅ Offline sync conflict detection logic documented ✅ Side-by-side merge UI storyboards (3+ conflict types) ✅ Version selection workflow designed ✅ Cascading resolution rules defined ✅ Audit trail for conflicts designed ✅ User testing conducted (3-5 field TMs) ✅ Feedback incorporated into M-Seq 01 design ✅ MOBILE_APP_SUPPLEMENT updated with UX details |
| **Effort** | 12 hours |
| **Blockers** | User testing availability |
| **Dependencies** | MOBILE_APP_SUPPLEMENT.md / DEP-021 |
| **Evidence of Closure** | mobile_conflict_resolution_ux.md with storyboards + user_testing_results.md |
| **Sign-Off** | Mobile Lead + Product Owner |

### RAID-021: Dealer Group vs Price Class Separation
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | Product + Dealer Portal Lead |
| **Target Closure** | Apr 18, 2026 (Week 3) |
| **Closure Criteria** | ✅ Dealer group resolution logic documented (affinity + ownership + region) ✅ Price class assignment rules documented ✅ Catalog visibility rules per dealer group defined ✅ INT-021 (dealer group service) contract finalized ✅ INT-022 (catalog publish) contract aligned with dealer groups ✅ Representative account test cases (5+ accounts) pass validation ✅ DEP-030 (dealer group model) design locked |
| **Effort** | 12 hours |
| **Blockers** | RAID-029 (product mapping) must complete first |
| **Dependencies** | Product Management & Dealer Catalog Governance / INT-021 / INT-022 / RAID-029 |
| **Evidence of Closure** | dealer_group_separation_rules.md + test_cases_validation.xlsx showing 5+ account scenarios |
| **Sign-Off** | Product Lead + Dealer Portal Lead |

### RAID-022: KPI Definition Divergence
| Field | Value |
|-------|-------|
| **Status** | 🟡 Mitigated |
| **Owner** | Reporting Lead |
| **Target Closure** | Apr 11, 2026 (Week 2) |
| **Closure Criteria** | ✅ METRIC_DEFINITION_REGISTER published with 19 KPIs ✅ Each KPI has: definition, SQL formula, refresh frequency, target range, owner, usage context ✅ Reporting semantic layer star schema aligned with KPI definitions ✅ Executive sign-off obtained ✅ DEP-014 (dashboard design) uses metric definitions ✅ Dashboard mockups reviewed against KPI definitions |
| **Effort** | 8 hours (already 90% done via WEB_DASHBOARD_SUPPLEMENT.md) |
| **Blockers** | Executive availability for sign-off |
| **Dependencies** | METRIC_DEFINITION_REGISTER.md / WEB_DASHBOARD_SUPPLEMENT.md / DEP-014 / DEP-015 |
| **Evidence of Closure** | METRIC_DEFINITION_REGISTER.md v2.0 signed off + executive_sign_off_memo.md |
| **Sign-Off** | Reporting Lead + Executive Sponsor |

---

## MEDIUM Priority Risks (3) — Week 3-4 Closure

### RAID-030: Canary Next.js Version Lock
| Field | Value |
|-------|-------|
| **Status** | 🟡 Open (quick fix) |
| **Owner** | Engineering Lead |
| **Target Closure** | Apr 4, 2026 (Week 1) |
| **Closure Criteria** | ✅ package.json updated to Next.js 16 GA (not canary) ✅ package-lock.json updated ✅ npm install runs cleanly ✅ Dev server starts without warnings ✅ Build completes without errors ✅ Pre-commit hook added to block canary versions ✅ Git commit "Lock Next.js to stable v16" |
| **Effort** | 2 hours |
| **Blockers** | None |
| **Dependencies** | package.json |
| **Evidence of Closure** | Git commit + passing build + pre-commit hook test |
| **Sign-Off** | Engineering Lead |

### RAID-031: Message Queue Infrastructure (pg-boss)
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | Backend Lead |
| **Target Closure** | Apr 11, 2026 (Week 2) |
| **Closure Criteria** | ✅ pg-boss job table schema created ✅ Monitoring schema designed (queue depth, latency, DLQ) ✅ 5-tier queue configuration implemented (CRITICAL/HIGH/STANDARD/BATCH/DLQ) ✅ Exponential backoff formula tested (max 300s, 30*2^(attempt-1)) ✅ Unit tests for queue patterns (enqueue, dequeue, retry, DLQ) ✅ Integration tests with mock Acumatica jobs ✅ Monitoring dashboard operational ✅ Backend team ready to use queue for INT-001 through INT-026 |
| **Effort** | 20 hours |
| **Blockers** | Database schema must exist (RAID-028) |
| **Dependencies** | MESSAGE_QUEUE_AND_ASYNC_PATTERN.md / RAID-028 |
| **Evidence of Closure** | pr_branch: "feature/pg-boss-queue" with schema migration + test suite + monitoring dashboard |
| **Sign-Off** | Backend Lead + DevOps |

### RAID-032: Mobile Offline Conflict Resolution (Detailed)
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open |
| **Owner** | Mobile Lead |
| **Target Closure** | Apr 25, 2026 (Week 4) |
| **Closure Criteria** | ✅ Side-by-side merge UI storyboards complete (3+ conflict types: add/update, delete, circular) ✅ Merge resolution strategy UX documented (use mine, use server, manual merge) ✅ Cascade resolution logic designed (resolve all before continuing) ✅ Audit trail for conflicts logged ✅ User testing (3-5 TMs) completed ✅ Feedback incorporated ✅ M-Seq 01 design includes conflict resolution UX |
| **Effort** | 8 hours (part of RAID-009 closure) |
| **Blockers** | User testing availability |
| **Dependencies** | MOBILE_APP_SUPPLEMENT.md / RAID-009 |
| **Evidence of Closure** | mobile_conflict_ux_storyboards.md + user_testing_feedback.md |
| **Sign-Off** | Mobile Lead |

### RAID-033: Production Readiness Artifacts
| Field | Value |
|-------|-------|
| **Status** | 🔴 Open (UAT phase) |
| **Owner** | Engineering Manager |
| **Target Closure** | Week 5-6 (before UAT exit) |
| **Closure Criteria** | ✅ 1,500 unit tests written (70% target) + 10min runtime ✅ 200 integration tests written (40% target) + 30min runtime ✅ 50 E2E tests written (20% target) + 8h runtime ✅ k6 load tests meet SLAs (Order p99 <2s, Search p99 <1s, Report p99 <5s) ✅ OWASP ZAP scan passed ✅ npm audit clean ✅ Snyk vulnerability scan passed ✅ Blue-green deployment tested on test cluster ✅ Canary rollback tested ✅ Monitoring dashboard operational ✅ Lighthouse 90+ Core Web Vitals validated |
| **Effort** | 120 hours (parallel with development) |
| **Blockers** | None |
| **Dependencies** | TESTING_AND_QUALITY_STRATEGY.md / DEPLOYMENT_AND_FEATURE_FLAGS.md / SECURITY_AND_SECRETS_ARCHITECTURE.md |
| **Evidence of Closure** | test_coverage_report.html (70/40/20 pyramid achieved) + k6_load_test_results.md + security_scan_results.md |
| **Sign-Off** | QA Lead + Engineering Manager |

---

## Closure Timeline — 4-Week Critical Path

```
Week 1 (Mar 31 - Apr 4)
├─ RAID-001 ✓ ERP customer trigger decision (1h meeting)
├─ RAID-026 ✓ Frontend refactoring sprint (60-80h, parallel team)
├─ RAID-029 ✓ Field mapping workbooks (30h, SME-led)
├─ RAID-004 ✓ Consignment site reconciliation (6h)
└─ RAID-030 ✓ Lock Next.js version (2h, quick fix)

Week 2 (Apr 7 - Apr 11)
├─ RAID-028 ✓ Database schema generation (40h, depends on RAID-029)
├─ RAID-002 ✓ Acumatica API validation (20h)
├─ RAID-005 ✓ Payment processor selection (10h)
├─ RAID-022 ✓ KPI definitions sign-off (8h)
├─ RAID-031 ✓ pg-boss queue infrastructure (20h)
├─ RAID-006 ✓ Outlook approval (wait for vendor, 8h work)
└─ RAID-007 ✓ Training integration (6h)

Week 3 (Apr 14 - Apr 18)
├─ RAID-024 ✓ Product identity/SKU linkage (20h, depends on RAID-029)
├─ RAID-003 ✓ Data quality profiling (25h)
├─ RAID-021 ✓ Dealer group separation (12h)
├─ RAID-008 ✓ Dealer visibility rules (8h)
└─ RAID-009 ✓ Mobile conflict UX (partial, user testing)

Week 4 (Apr 21 - Apr 25)
├─ RAID-027 ✓ Traceability and decision closure completion (108h total, phases 1-4)
├─ RAID-009 ✓ Mobile conflict UX finalization (feedback integration)
└─ RAID-032 ✓ Mobile conflict resolution detail (included in RAID-009)

Post-Sprint (Week 5-6)
└─ RAID-033 ✓ Production readiness artifacts (120h, UAT phase)
```

---

## Dependency Graph (Critical Path)

```
RAID-029 (Field Mapping) ← Gates →
├─ RAID-028 (Database Schema)
├─ RAID-024 (Product SKU Linkage)
└─ RAID-021 (Dealer Group Separation)

RAID-001 (ERP Trigger Decision) ← Gates →
├─ RAID-026 (Frontend Refactoring)
├─ INT-001 Contract Finalization
└─ DEP-003 (Customer Onboarding Design)

RAID-002 (Acumatica API) ← Gates →
└─ All INT-001 through INT-007 Contract Testing

RAID-027 (Traceability and Decision Closure) → Runs Parallel
└─ No critical blockers (independent validation track)
```

---

## Risk Escalation Rules

| Scenario | Owner | Action | Timeline |
|----------|-------|--------|----------|
| **CRITICAL risk not closed by target date** | Program Manager | Escalate to Steering Committee | Within 24h |
| **Blocker discovered during closure** | Risk Owner | Notify Program Manager + add new RAID | Immediate |
| **Closure effort exceeds estimate by 50%** | Risk Owner | Reassess deadline + request resource help | Within 24h |
| **Vendor approval delayed (e.g., Microsoft Outlook)** | Risk Owner | Activate fallback plan immediately | Day 1 of delay |
| **Conflicting closure requirements** | Program Manager | Schedule resolution meeting | Within 48h |

---

## Sign-Off Authority Matrix

| Risk Category | Closure Authority | Secondary Approver |
|---------------|-------------------|-------------------|
| Architecture/Decision (RAID-001, 024, 021, etc.) | Product Owner + Architect | Steering Committee |
| Integration/API (RAID-002, 029, etc.) | Integration Lead | Architect |
| Technology/Infrastructure (RAID-030, 031, 032, etc.) | Engineering Lead | DevOps |
| Security/Compliance (RAID-006, 008, etc.) | Security Lead | Compliance Officer |
| Data Quality (RAID-003, 004, etc.) | Data Lead | Migration Lead |

---

## Tracking Dashboard (Weekly Status)

### Week 1 Status (Expected Apr 4)
- [ ] RAID-001 decision closed or escalated with target owner/date
- [ ] RAID-004 closed (Consignment sites)
- [ ] RAID-026 progress: 40/80 hours (50%)
- [ ] RAID-029 progress: 25/30 hours (80%)
- [ ] RAID-030 closed (Next.js lock)

### Week 2 Status (Expected Apr 11)
- [ ] RAID-026 closed (Frontend refactoring)
- [ ] RAID-028 closed (Database schema)
- [ ] RAID-002 closed (Acumatica API)
- [ ] RAID-005 closed (Payment processor)
- [ ] RAID-022 closed (KPI definitions)
- [ ] RAID-031 progress: 15/20 hours (75%)

### Week 3 Status (Expected Apr 18)
- [ ] RAID-024 closed (Product SKU linkage)
- [ ] RAID-003 closed (Data quality)
- [ ] RAID-021 closed (Dealer group separation)
- [ ] RAID-008 closed (Dealer visibility)
- [ ] RAID-006 closed (Outlook approval)
- [ ] RAID-009 progress: User testing feedback collected

### Week 4 Status (Expected Apr 25)
- [ ] RAID-027 closed (traceability and decision closure)
- [ ] RAID-009 closed (Mobile conflict UX)
- [ ] RAID-032 closed (Mobile conflict detail)
- [ ] Remaining Sprint 1 blockers reviewed against live RAID register

---

## Resources & Owners

| Owner | Email | Risks | Week 1 Availability |
|-------|-------|-------|-------------------|
| Product Owner | — | RAID-001, 005, 008, 021 | Full |
| Engineering Lead | — | RAID-026, 030, 031 | Full |
| Integration Lead | — | RAID-002, 029, 024 | Full |
| Architect | — | RAID-028, 024, 023 | Full |
| BA + SME team | — | RAID-029 field mapping | Full |
| Migration Lead | — | RAID-003, 004 | Part (TBD) |
| Program Manager | — | RAID-027, overall tracking | Full |
| Mobile Lead | — | RAID-009, 032 | Part (user testing) |
| Security Lead | — | RAID-006, 008, 030 | Part (waiting vendor) |
| Reporting Lead | — | RAID-022, 010 | Full |

---

**Status as of Mar 30, 2026:** This tracker remains useful for closure planning, but live status and open-count authority sit with `RAID_LOG_INITIAL.csv`.
