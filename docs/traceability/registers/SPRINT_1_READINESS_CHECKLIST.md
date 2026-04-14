# Sprint 1 Readiness Checklist — Dynamic AQS CRM
**Date:** March 29, 2026
**Last Refreshed Against Live Baseline:** March 30, 2026
**Target Sprint 1 Kickoff:** June 2, 2026
**Readiness Gate Deadline:** May 31, 2026
**Owner:** Program Manager

---

## Executive Summary

This checklist defines 47 hard gates that must be satisfied before development begins on the current Dynamic AQS baseline.

Use this file as a gate framework, not as the live source for baseline counts or current risk totals. The live authority for scope, sequencing, and RAID status is:

- `registers/PROJECT_BREAKDOWN_DETAILED.csv`
- `registers/RAID_LOG_INITIAL.csv`
- `source_of_truth/FULL_RELEASE_PLAN.md`
- `source_of_truth/PRD_MODULE_COVERAGE_MATRIX.md`
- `source_of_truth/PROGRAM_100_PERCENT_COMPLETION_CHECKLIST.md`

| Gate Category | Status | Count | Critical | Blocker |
|---------------|--------|-------|----------|---------|
| **Architecture Decisions** | Live review required | 8 | 5 | RAID-001, RAID-029 |
| **PRD & Documentation** | Live review required | 12 | 8 | RAID-027, RAID-029 |
| **Foundation Data & Schema** | Live review required | 9 | 6 | RAID-028, RAID-029 |
| **Infrastructure & DevOps** | Live review required | 6 | 3 | RAID-031 |
| **Testing & QA Framework** | Live review required | 6 | 2 | Pre-UAT |
| **Security & Compliance** | Live review required | 4 | 2 | RAID-006 |
| **Sign-Off & Approval** | Live review required | 2 | 2 | Steering Committee |
| **TOTAL** | **Framework only** | **47** | **28** | **See live RAID + PRD decisions** |

---

## 🚫 CRITICAL BLOCKERS (Must Close Before Week 1 Dev)

### 1. RAID-029: Field-Level Mappings (7 Entities) ⚠️
**Status:** 🔴 BLOCKING
**Due:** Apr 4, 2026
**Impact:** Blocks: Database schema, form validation, test data, API contracts, migration

- [ ] **Customer entity mapping** (Acumatica ARCustomer ↔ CRM Customer)
  - Acumatica fields: [mapped list]
  - CRM fields: [mapped list]
  - Transformation rules: [documented]
  - Required vs optional: [specified]
  - Conflict resolution: [defined]
  - **Sign-off:** Acumatica SME + BA

- [ ] **Contact entity mapping** (Acumatica Contact ↔ CRM Contact)
  - Same detail as Customer
  - **Sign-off:** Acumatica SME + BA

- [ ] **Product entity mapping** (Acumatica Item ↔ CRM Product)
  - SKU linkage to Widen asset IDs: [defined]
  - Variant handling: [single record vs children]
  - Brand/region overrides: [rules documented]
  - **Sign-off:** Product Lead + Data Lead

- [ ] **Pricing entity mapping** (Acumatica PriceClass ↔ CRM Pricing)
  - Price class assignment: [rules]
  - Customer price overrides: [logic]
  - Regional pricing: [handled]
  - **Sign-off:** Finance + Pricing Lead

- [ ] **Consignment mapping** (Acumatica Warehouse ↔ CRM ConsignmentSite)
  - Site ID linking: [standardized]
  - Transfer order fields: [mapped]
  - Inventory balance sync: [specified]
  - **Sign-off:** Consignment SME + Acumatica SME

- [ ] **Order mapping** (CRM Order → Acumatica SalesOrder)
  - Line items: [mapped]
  - Ship-to resolution: [defined]
  - Account context: [business unit logic]
  - **Sign-off:** Dealer Portal Lead + Integration Lead

- [ ] **Reporting entity mapping** (Multi-source → ReportingLayer)
  - Fact table sources: [defined]
  - Dimension table sources: [defined]
  - SCD Type 2 handling: [specified]
  - **Sign-off:** Reporting Lead

---

### 2. RAID-028: Database Schema (110+ Entities) ⚠️
**Status:** 🔴 BLOCKING (depends on RAID-029)
**Due:** Apr 8, 2026
**Impact:** Blocks: All backend development, test environment setup, migrations

- [ ] **Prisma schema generated**
  - File: `prisma/schema.prisma`
  - All 110+ entities modeled
  - All relationships defined
  - All fields with proper types

- [ ] **Field definitions complete**
  - Type annotations (String, Int, DateTime, etc.)
  - Nullability (required vs optional)
  - Default values
  - Max length constraints
  - Index strategy (for performance)

- [ ] **Relationships & cascades defined**
  - Foreign keys
  - Cascade behaviors (DELETE, UPDATE)
  - Soft-delete vs hard-delete decisions per entity

- [ ] **Encryption field specification**
  - PCI fields (credit card, payment info)
  - PHI fields (health info if any)
  - Encryption strategy (at-rest via TDE + in-transit via TLS)

- [ ] **Audit trail schema**
  - Fields: entity_type, entity_id, operation (CREATE/UPDATE/DELETE), user_id, timestamp, old_value, new_value
  - Storage: Separate audit_log table
  - Retention: 7-year hot + 10-year cold archive

- [ ] **Migration scripts tested**
  - `npx prisma migrate dev` runs without error
  - Schema matches ERD Blueprint
  - Naming conventions consistent

- [ ] **Backend team validation**
  - Can create tables: ✓
  - Can write queries: ✓
  - Can run migrations: ✓

- [ ] **Sign-off:** Architect + Senior Backend Engineer

---

### 3. RAID-001: ERP Customer Creation Trigger Decision ⚠️
**Status:** 🔴 BLOCKING
**Due:** Apr 1, 2026
**Impact:** Blocks: Customer entity design, Acumatica sync, dealer activation workflow

- [ ] **Decision documented**
  - Customer created on: ☐ CIS submission ☐ First order ☐ Other: ___
  - Rationale: [documented]
  - Impact on workflow: [documented]

- [ ] **Stakeholders aligned**
  - ✓ Product Owner
  - ✓ Finance VP (credit approval impact)
  - ✓ Acumatica technical (sync impact)
  - ✓ Solution Architect

- [ ] **Downstream impacts documented**
  - **DEP-001 (Lead intake):** How leads become customers
  - **DEP-003 (Customer onboarding):** When customer is created
  - **INT-001 (Customer master sync):** Sync direction + trigger
  - **Reporting:** Definition of "active account" / "new customer"

- [ ] **Acumatica sync contract updated**
  - INT-001 updated with new decision
  - Customer creation trigger field added
  - Sync flow diagram updated

- [ ] **Sign-off:** Product Owner + Finance VP

---

### 4. RAID-027: Baseline Traceability & Decision Closure ⚠️
**Status:** 🔴 BLOCKING
**Due:** Apr 25, 2026
**Impact:** Blocks: Module dev start, WBS refinement, sprint planning

- [ ] **Phase 1 Validation (Week 1 - Mar 31-Apr 4)**
  - [ ] Foundation + P0 kickoff sessions (20 hours)
  - [ ] Acumatica team involved
  - [ ] Async questionnaires distributed (4 modules)
  - [ ] Attendance confirmed

- [ ] **Phase 2 Validation (Week 2 - Apr 7-11)**
  - [ ] Session 3 rerun: Master Data Governance (4 hours)
  - [ ] P0 deep-dive sessions (25 hours)
  - [ ] Async responses collected (3 modules)
  - [ ] P0 sign-offs obtained (Acumatica, Lead Capture, Customer, Foundation)

- [ ] **Phase 3 Validation (Week 3 - Apr 14-18)**
  - [ ] P1 completion sessions (25 hours)
  - [ ] Async questionnaires completed (3 modules)
  - [ ] Session 8 rerun preparation: KPI Definitions & Product Sync
  - [ ] Open-question and decision count tracked daily

- [ ] **Phase 4 Validation (Week 4 - Apr 21-25)**
  - [ ] Session 8 rerun: KPI & Product Sync (3 hours)
  - [ ] Session 12 rerun: Reporting Drill-Down & Widen (3 hours)
  - [ ] Final traceability and policy closure review
  - [ ] Steering Committee sign-off

- [ ] **Deliverables**
  - [ ] `plans/VALIDATION_AND_MAPPING_ROADMAP.md` executed
  - [ ] METRIC_DEFINITION_REGISTER.md published
  - [ ] All 190 active WBS rows reviewed against PRD, discovery, or governance decisions
  - [ ] All 20 modules covered in the PRD pack with current readiness classification
  - [ ] Remaining open questions explicitly assigned, deferred, or signed off

- [ ] **Sign-off:** Steering Committee + Product Owner

---

## 🏗️ ARCHITECTURE DECISIONS (5 Critical)

### A. RAID-026: Frontend Production Readiness ⚠️
**Status:** 🔴 BLOCKING
**Due:** Apr 4, 2026

- [ ] **Mock data removal**
  - [ ] MockDataProvider wrapper removed
  - [ ] All 676 lines of Generators.ts fake data removed
  - [ ] Real API integration framework implemented
  - [ ] API client (axios/fetch wrapper) configured

- [ ] **Error handling & logging**
  - [ ] 143 console.log statements removed
  - [ ] Error boundaries implemented (global + per-route)
  - [ ] Sentry integration configured + tested
  - [ ] Error fallback UI screens designed

- [ ] **Authentication integration**
  - [ ] Placeholder auth replaced with real integration
  - [ ] NextAuth.js configured for Entra ID
  - [ ] JWT/session handling implemented
  - [ ] Protected routes configured

- [ ] **Component extraction**
  - [ ] LeadPipeline.tsx (74KB) decomposed into <20KB modules
  - [ ] CISFormDigital.tsx (47KB) decomposed into <20KB modules
  - [ ] No component >30KB

- [ ] **Test coverage improvements**
  - [ ] Target: 60% critical paths
  - [ ] 100+ unit tests added
  - [ ] Critical workflows (login, lead create, order) covered
  - [ ] npm test passes

- [ ] **Version locks**
  - [ ] Next.js locked to stable GA (v16, not canary)
  - [ ] All other packages updated + security audit passed
  - [ ] Pre-commit hook blocks canary versions

- [ ] **Production readiness checks**
  - [ ] Lighthouse 90+ Core Web Vitals
  - [ ] No security warnings (npm audit)
  - [ ] Bundle size optimized
  - [ ] Performance budget maintained

- [ ] **Sign-off:** Engineering Lead + QA Lead

---

### B. Acumatica Integration Architecture ⚠️
**Status:** 🟡 DEFINED
**Due:** Apr 11, 2026

- [ ] **ACUMATICA_INTEGRATION_PRD.md approved**
  - [ ] 7 core integration contracts defined (INT-001 to INT-007)
  - [ ] API endpoints confirmed
  - [ ] Auth method confirmed (OAuth/API Key)
  - [ ] Pagination strategy tested
  - [ ] Error handling approach documented

- [ ] **Sandbox environment access**
  - [ ] Acumatica sandbox URL confirmed
  - [ ] API credentials provided
  - [ ] Firewall rules configured
  - [ ] Test accounts available

- [ ] **Integration contracts ready**
  - [ ] INT-001: Customer/Contact Master Sync
  - [ ] INT-002: Product Master Sync
  - [ ] INT-003: Pricing Sync
  - [ ] INT-004: Dealer Order Submission
  - [ ] INT-005: Order/Invoice/Shipment Sync
  - [ ] INT-006: Credit Hold Sync
  - [ ] INT-007: Consignment Warehouse Sync
  - All with: API endpoint, auth, request/response schema, error codes, SLA

- [ ] **Failure recovery documented**
  - [ ] Exponential backoff formula: `min(300, 30 * (2 ^ (attempt - 1)))`
  - [ ] Retry limits per tier (CRITICAL: 10, HIGH: 5, STANDARD: 3)
  - [ ] Dead-letter queue handling
  - [ ] Daily reconciliation jobs

- [ ] **Sign-off:** Integration Lead + Acumatica Technical Lead

---

### C. Message Queue Infrastructure (pg-boss) ⚠️
**Status:** 🔴 BLOCKING
**Due:** Apr 11, 2026

- [ ] **PostgreSQL pg-boss provisioned**
  - [ ] Job table schema created
  - [ ] Monitoring tables created
  - [ ] pgboss.job.* permissions set up

- [ ] **5-tier queue configured**
  - [ ] CRITICAL: 5min SLA, 10 retries
  - [ ] HIGH: 15min SLA, 5 retries
  - [ ] STANDARD: 1hr SLA, 3 retries
  - [ ] BATCH: 24hr SLA, 1 retry
  - [ ] DLQ: manual handling for all failures

- [ ] **Exponential backoff tested**
  - [ ] Formula: `min(300, 30 * (2 ^ (attempt - 1)))`
  - [ ] Attempt 1: immediate
  - [ ] Attempt 2: 30s
  - [ ] Attempt 3: 2m
  - [ ] Attempt 4: 8m
  - [ ] Attempt 5: 30m
  - [ ] Attempts 6-10: 300s (capped)

- [ ] **Monitoring dashboard operational**
  - [ ] Queue depth metric
  - [ ] Latency metrics (p50/p95/p99)
  - [ ] Failure rate metric
  - [ ] DLQ size metric
  - [ ] Alert rules configured

- [ ] **Test suite for queue**
  - [ ] Unit tests for enqueue/dequeue/retry
  - [ ] Integration tests with mock jobs
  - [ ] Error handling tests
  - [ ] DLQ behavior tests

- [ ] **Backend ready to use queue**
  - [ ] Job schema TypeScript interfaces
  - [ ] Example: Customer sync job payload
  - [ ] Documentation on queue usage
  - [ ] Error classification rules (transient vs permanent)

- [ ] **Sign-off:** Backend Lead + DevOps

---

### D. Security Architecture ⚠️
**Status:** 🟡 DEFINED
**Due:** Week 2

- [ ] **FOUNDATION_SECURITY_ADMIN_SUPPLEMENT.md approved**
  - [ ] Entra ID SSO configured
  - [ ] RBAC role matrix finalized (9 internal + 1 dealer)
  - [ ] API authorization strategy documented
  - [ ] Encryption strategy documented

- [ ] **Azure Key Vault configured**
  - [ ] Secrets storage for: API keys, DB password, JWT signing key, payment gateway keys
  - [ ] Rotation policies: 90 days for API keys, 365 for JWT
  - [ ] Access policies per environment (Dev/Test/UAT/Prod)
  - [ ] Audit logging enabled

- [ ] **Entra ID SSO ready**
  - [ ] Application registration created
  - [ ] OAuth consent screen configured
  - [ ] Claim mapping documented (email → login, oid → user ID, groups → role)
  - [ ] Session timeout rules: 8h admin, 4h field, 24h dealer
  - [ ] MFA configured for Admin/RD/VP roles

- [ ] **Encryption specifications**
  - [ ] At-rest: TDE in PostgreSQL
  - [ ] In-transit: TLS 1.3
  - [ ] Field-level encryption: PCI / PHI fields identified
  - [ ] Key rotation strategy: annually + emergency rotation

- [ ] **Audit trail ready**
  - [ ] Schema designed (entity_type, operation, user, timestamp, old/new values)
  - [ ] 7-year hot retention + 10-year cold archive
  - [ ] Immutability enforcement (Azure Blob immutable storage)
  - [ ] Audit access policy (only security/compliance can view)

- [ ] **Sign-off:** Security Lead + Compliance Officer

---

### E. Deployment & Feature Flags ⚠️
**Status:** 🟡 DEFINED
**Due:** Week 2

- [ ] **Blue-green + canary strategy documented**
  - [ ] Deployment sequence: Blue, Canary (5%, 30min), Progressive (5% → 100%, 2h), Monitor (30min)
  - [ ] Rollback triggers: Error rate >5%, Latency p99 >15s
  - [ ] Instant rollback procedure documented
  - [ ] Test cluster for deployment validation

- [ ] **9-stage CI/CD pipeline designed**
  - 1. [ ] Build (2 min): TypeScript, lint, type check
  - 2. [ ] Unit Tests (10 min): Jest, 70% coverage
  - 3. [ ] Integration Tests (15 min): Real DB, queue tests, API contracts
  - 4. [ ] Security Scan (5 min): SAST, npm audit, container scan
  - 5. [ ] Build Docker (3 min): Multi-stage, push registry
  - 6. [ ] Deploy Dev (2 min): Auto-smoke tests
  - 7. [ ] Deploy Test (5 min): Blue-green, E2E (30 min), Load (10 min)
  - 8. [ ] Deploy UAT (5 min): Blue-green, smoke tests
  - 9. [ ] Deploy Prod (5 min): Canary (5%, 30 min) → Progressive → Monitor
  - **Total: 2.5 hours automated**

- [ ] **Feature flags (LaunchDarkly/Unleash) ready**
  - [ ] Feature flag schema defined
  - [ ] Rollout strategy: 5% → 25% → 50% → 100%
  - [ ] Targeting rules: by region, by user role, by cohort
  - [ ] Lifecycle: flag creation → staging → production → archival

- [ ] **Database migration strategy**
  - [ ] Expand-contract pattern adopted (Phase 1: ADD, Phase 2: POPULATE, Phase 3: ACTIVATE, Phase 4: DROP)
  - [ ] Zero-downtime migration approach
  - [ ] Rollback procedure per migration

- [ ] **Deployment windows**
  - [ ] Scheduled: Tue-Thu 14:00-18:00 UTC
  - [ ] Blackout: Friday/Monday before 10am
  - [ ] No deploys during business hours for dealers

- [ ] **Sign-off:** Engineering Lead + DevOps

---

## 📖 PRD & DOCUMENTATION (8 Critical)

### 1. 8 Missing PRDs Must Be Written ⚠️
**Status:** 🔴 BLOCKING
**Due:** Apr 25, 2026

- [ ] **Acumatica Integration PRD** (1,650 lines) ✓ DONE
  - Covers INT-001 through INT-007 contracts
  - API specs, error handling, reconciliation

- [ ] **Lead Capture & Management PRD** (need 800-1000 lines)
  - Lead sources (10-16 websites)
  - Lead scoring algorithm
  - Lead routing rules
  - SLA thresholds (response time by priority)
  - Stage gates (source → intake → discovery → CIS → qualified)
  - Assignment algorithm
  - **Sign-off:** Product Lead + Sales Leadership

- [ ] **Customer / Account / Contact PRD** (need 800-1000 lines)
  - Entity definitions + relationships
  - Field definitions (from RAID-029 mapping)
  - Customer lifecycle state machine
  - Multi-location handling (parent account + child locations)
  - Account hierarchy rules
  - **Sign-off:** Product Lead + Finance

- [ ] **Foundation / Security / Admin PRD** (1,854 lines) ✓ DONE
  - SSO, RBAC, audit, encryption, compliance

- [ ] **Training Management PRD** (need 600-800 lines)
  - Training types enumeration
  - Outlook sync contract
  - Proof of completion definition (hours, attendance, certificates)
  - Certification lifecycle
  - Training assignment rules
  - **Sign-off:** Training Lead

- [ ] **Consignment Management PRD** (need 800-1000 lines)
  - ROSE audit 7-step workflow detail
  - Reconciliation algorithm
  - PO clock rules
  - Variance tolerance rules
  - Barcode path (scan at upload/download)
  - Site disenrollment workflow
  - **Sign-off:** Consignment SME + Finance

- [ ] **Territory Management PRD** (need 600-800 lines)
  - Territory hierarchy model (Region → Territory → SubTerritory)
  - Assignment algorithm (TM ← Territory, account ← Territory)
  - Geographic routing rules (zip code, geocoding)
  - Territory change workflow
  - **Sign-off:** Sales Leadership

- [ ] **Communication / Alerts PRD** (need 400-600 lines)
  - Alert types enumeration (lead, credit, training, consignment, order)
  - Trigger rules (e.g., "lead not touched in 24h")
  - Routing logic (to which roles)
  - Delivery channels (email, Teams, Slack, push)
  - Escalation rules
  - Deduplication logic
  - **Sign-off:** Operations Lead

---

### 2. 3 Existing PRDs Need Supplements ⚠️
**Status:** 🟡 DEFINED (mostly done)
**Due:** Apr 25, 2026

- [ ] **Dealer Portal Supplement** (need validation)
  - Form field definitions (order form, account form)
  - Pricing calculation algorithm (price class + customer override + region)
  - Checkout state machine (cart → review → payment → confirm)
  - Credit hold behavior (block/warn/allow)
  - Canada vs US model differences
  - **Sign-off:** Dealer Portal Lead + Finance

- [ ] **Product Management Supplement** (PRODUCT_MANAGEMENT_ACUMATICA_INTEGRATION_ARCHITECTURE.md)
  - Database schema (Product record structure)
  - Sync conflict resolution algorithm
  - Dealer visibility rule formula
  - Brand/region override rules
  - Publish validation checklist
  - **Sign-off:** Product Lead

- [ ] **Reporting Supplement** (WEB_DASHBOARD_SUPPLEMENT.md) ✓ DONE
  - 19 KPI definitions with formulas
  - Star schema design (6 fact + 6 dimension tables)
  - Scheduled delivery backend (email, Teams, Slack)
  - Drill-down navigation rules
  - Data freshness SLA (<15 min for CRM, 24h for Acumatica)

---

### 3. Mobile & Testing Documentation ⚠️
**Status:** 🟡 DEFINED (mostly done)
**Due:** Apr 25, 2026

- [ ] **Mobile App Supplement** (MOBILE_APP_SUPPLEMENT.md) ✓ DONE
  - 11 error scenarios with UX
  - Voice transcription spec (Azure Speech, HVAC vocab, 85% confidence)
  - Offline conflict resolution UX (side-by-side merge)
  - Offline data model (sync strategy, storage limits)
  - Performance targets (launch <5s, list <3s, submit <2s)
  - Privacy: audio → transcript only, no storage
  - Adoption metrics: 80% by day 30, 8-10h battery life

- [ ] **Testing & Quality Strategy** (TESTING_AND_QUALITY_STRATEGY.md) ✓ DONE
  - 70% unit / 40% integration / 20% E2E pyramid
  - 1,500 unit tests (10 min runtime)
  - 200 integration tests (30 min runtime)
  - 50 E2E tests (8 hour runtime)
  - API contract tests
  - k6 load tests (Order p99 <2s, Search p99 <1s, Report p99 <5s)
  - Security testing (OWASP ZAP, npm audit, Snyk)
  - Regression test suite (500 tests, 15 min runtime)

- [ ] **Message Queue Pattern** (MESSAGE_QUEUE_AND_ASYNC_PATTERN.md) ✓ DONE
  - pg-boss selected
  - 5-tier queue strategy
  - Exponential backoff formula
  - Monitoring dashboard
  - 26 integrations documented

---

## 📊 FOUNDATION DATA & SCHEMA (9 Critical)

### Data & Entity Setup
**Status:** 🔴 BLOCKING

- [ ] **Reference Data Masters** (100% completeness required)
  - [ ] Affinity Groups (AFFINITY_GROUPS.csv): All groups with business rules
  - [ ] Ownership Groups (OWNERSHIP_GROUPS.csv): All ownerships
  - [ ] Product Categories (PRODUCT_CATEGORIES.csv): Full hierarchy
  - [ ] Territory Hierarchy (TERRITORY_HIERARCHY.csv): Region → Territory → Sub
  - [ ] User Roles (ROLE_MATRIX.csv): 9 internal + 1 dealer with permissions
  - [ ] Consignment Site Master (CONSIGNMENT_SITE_MASTER.csv): All sites reconciled

- [ ] **Test Data Sets**
  - [ ] 100 test customer accounts (full lifecycle data)
  - [ ] 500 test leads (various statuses + sources)
  - [ ] 50 test products (with variants, pricing, assets)
  - [ ] 20 test territory assignments
  - [ ] 10 test consignment sites
  - [ ] 5 test dealer companies with multiple users
  - [ ] **Requirement:** Matches production data patterns, PII masked

- [ ] **Migration Data Preparation**
  - [ ] Legacy data profiling complete (Dynamics, HubSpot, QuickBooks, Shopify)
  - [ ] Reconciliation reports: customer count, lead count, product count
  - [ ] Confidence classification per record (high/medium/low/archive-only)
  - [ ] Wrong-brand/wrong-file exception list

- [ ] **Database Seeding Scripts**
  - [ ] Prisma seed.ts script created
  - [ ] Runs idempotently (safe to re-run)
  - [ ] Populates reference data + test data
  - [ ] Can seed Dev / Test / UAT independently

- [ ] **Sign-off:** Data Lead + QA Lead

---

## 🔧 INFRASTRUCTURE & DEVOPS (3 Critical)

### Development Environment Setup
**Status:** 🔴 BLOCKING

- [ ] **Local Development Environment**
  - [ ] Docker Compose file for PostgreSQL + Redis + pg-boss
  - [ ] Environment variables template (.env.example)
  - [ ] Initial database schema loaded
  - [ ] Seed data populated
  - [ ] **Verification:** `npm run dev` starts cleanly, API responds

- [ ] **Test Environment (Shared)**
  - [ ] PostgreSQL test database
  - [ ] Redis cache (if applicable)
  - [ ] pg-boss job tables
  - [ ] E2E test data seeding
  - [ ] Monitoring/logging (ELK stack or equivalent)
  - [ ] **Verification:** All E2E tests pass

- [ ] **UAT Environment (Production-like)**
  - [ ] Blue-green deployment ready
  - [ ] Monitoring dashboard operational (Prometheus + Grafana)
  - [ ] Alerting configured (PagerDuty or equivalent)
  - [ ] Secrets management (Azure Key Vault test instance)
  - [ ] **Verification:** Blue-green deploy tested

- [ ] **Monitoring & Logging**
  - [ ] Sentry integration for error tracking
  - [ ] Structured logging (JSON format)
  - [ ] Metrics collection (Prometheus)
  - [ ] Dashboard: Request latency, error rate, queue depth, DB connections
  - [ ] Alert thresholds: p99 latency >15s, error rate >5%, DLQ >5 items

- [ ] **Sign-off:** DevOps Lead

---

## 🧪 TESTING & QA FRAMEWORK (Not Yet Started)

### Testing Infrastructure
**Status:** 🔴 NOT STARTED (UAT Phase)

- [ ] **Unit Test Framework**
  - [ ] Jest configured + running
  - [ ] Test utilities library (factories, mocks, helpers)
  - [ ] Test data builders for common entities
  - [ ] Coverage reporting configured

- [ ] **Integration Test Framework**
  - [ ] Testcontainers for PostgreSQL (real DB, not mocked)
  - [ ] Job queue test helpers (enqueue mock job, verify processing)
  - [ ] API contract testing (OpenAPI assertions)
  - [ ] Transaction rollback between tests

- [ ] **E2E Test Framework**
  - [ ] Playwright configured
  - [ ] Browser test fixtures (auth, page navigation)
  - [ ] Test data setup/teardown per test
  - [ ] Screenshot/video capture on failure

- [ ] **Load Testing**
  - [ ] k6 load test scripts
  - [ ] Order placement scenario (p99 <2s at 100 concurrent)
  - [ ] Lead search scenario (p99 <1s)
  - [ ] Report query scenario (p99 <5s at 50 concurrent)
  - [ ] Baseline established before optimizations

- [ ] **Performance Testing**
  - [ ] Lighthouse CI integrated (target: 90+ CWV)
  - [ ] Bundle size monitoring
  - [ ] Database query performance profiling
  - [ ] Memory leak detection (Node.js heap snapshots)

- [ ] **Security Testing**
  - [ ] OWASP ZAP automated scanning
  - [ ] npm audit clean (no vulnerabilities)
  - [ ] Snyk vulnerability scanning
  - [ ] Manual penetration test scheduled (pre-launch)

- [ ] **Sign-off:** QA Lead

---

## ✅ SIGN-OFF & APPROVAL GATES (2 Critical)

### Steering Committee Review & Sign-Off ⚠️
**Status:** 🔴 NOT SCHEDULED
**Due:** Week 5 (May 20, 2026)

**Steering Committee must review and approve:**

- [ ] **Scope & Requirements**
  - [ ] All 190 active WBS rows reviewed against the current WBS baseline
  - [ ] 20 modules reviewed against current PRD readiness classifications
  - [ ] Scope control boundaries confirmed (e.g., commercial deferred)

- [ ] **Architecture Decisions**
  - [ ] Acumatica as financial truth confirmed
  - [ ] Message queue pattern (pg-boss) approved
  - [ ] Encryption strategy approved
  - [ ] Deployment strategy (blue-green + canary) approved

- [ ] **Cost & Timeline**
  - [ ] Current delivery baseline approved
  - [ ] Sprint schedule (Sprint 01-Sprint 25 baseline) approved
  - [ ] Go-live target date approved
  - [ ] Funding and staffing model validated

- [ ] **Risk Mitigation**
  - [ ] Current RAID register reviewed
  - [ ] Risk closure tracker + timeline reviewed
  - [ ] Escalation procedures understood

- [ ] **Team Readiness**
  - [ ] Development team assignments confirmed
  - [ ] Vendor/SME commitments confirmed (Acumatica, Microsoft, payment processor)
  - [ ] Support team (QA, DevOps, Product) ready

---

### Executive Sign-Off ⚠️
**Status:** 🔴 NOT SCHEDULED
**Due:** Week 5 (May 27, 2026)

**Program Sponsor must confirm:**

- [ ] **Business Alignment**
  - [ ] Residential CRM scope leads (commercial deferred)
  - [ ] Reporting as approval gate requirement confirmed
  - [ ] Go-live timeline acceptable

- [ ] **Financial Approval**
  - [ ] Approved delivery budget confirmed
  - [ ] Staffing capacity approved
  - [ ] Commercial case accepted

- [ ] **Risk Acceptance**
  - [ ] Current open risks and decisions understood
  - [ ] Mitigation plans acceptable
  - [ ] Escalation authority delegated

- [ ] **Go/No-Go for Sprint 1**
  - [ ] All readiness gates met (this checklist)
  - [ ] Go decision formally recorded
  - [ ] Sprint 1 kickoff scheduled (June 2, 2026)

---

## 📋 SIGN-OFF MATRIX

| Gate | Owner | Approver | Date | Status |
|------|-------|----------|------|--------|
| **RAID-029 (Field Mappings)** | BA + SME | Integration Lead | Apr 4 | ⏳ In Progress |
| **RAID-028 (Database Schema)** | Architect + Backend | Architect | Apr 8 | ⏳ Blocked by RAID-029 |
| **RAID-001 (ERP Trigger Decision)** | Product Owner | Finance VP | Apr 1 | ⏳ In Progress |
| **RAID-027 (Traceability & Decision Closure)** | Program Manager | Steering Committee | Apr 25 | ⏳ In Progress |
| **RAID-026 (Frontend Refactoring)** | Engineering Lead | QA Lead | Apr 4 | ⏳ In Progress |
| **Architecture Review** | Solution Architect | CTO | May 6 | ⏳ Pending |
| **Security Review** | Security Lead | Compliance Officer | May 13 | ⏳ Pending |
| **Steering Committee** | Program Manager | Committee Members | May 20 | ⏳ Scheduled |
| **Executive Sign-Off** | Sponsor | Sponsor | May 27 | ⏳ Pending |
| **Sprint 1 Kickoff** | Program Manager | Team Leads | Jun 2 | ⏳ Depends on gates |

---

## 🚨 ESCALATION RULES

**If any gate is not closed by target date:**

1. **Day 1 of delay:** Risk Owner notifies Program Manager
2. **Day 1 EOD:** Program Manager assesses impact
3. **Day 2:** If critical blocker, escalate to Steering Committee with mitigation plan
4. **Day 3:** If unresolved, recommend sprint 1 delay (1 week minimum)

**Blockers that trigger sprint 1 delay:**
- RAID-029 (field mappings) not complete
- RAID-028 (database schema) not complete
- RAID-027 (traceability and decision closure) not complete
- RAID-001 (ERP trigger) not decided
- RAID-026 (frontend refactoring) not done

---

## Summary: What Must Be Done Before Dev Starts

| Timeline | What Must Be Done | Owner | Sign-Off |
|----------|-------------------|-------|----------|
| **Week 1 (Mar 31-Apr 4)** | RAID-001, RAID-029, RAID-004, RAID-030, RAID-026 start | Respective leads | Integration Lead |
| **Week 2 (Apr 7-11)** | RAID-028, RAID-002, RAID-005, RAID-022, RAID-031 | Respective leads | Architect |
| **Week 3 (Apr 14-18)** | RAID-024, RAID-003, RAID-021, RAID-008, RAID-006 | Respective leads | Security Lead |
| **Week 4 (Apr 21-25)** | RAID-027 complete, RAID-009, RAID-032 | Program Manager | Steering Committee |
| **Week 5 (May 6-13)** | Architecture + Security reviews | Architect + Security | CTO + Compliance |
| **Week 5 (May 20-27)** | Steering Committee + Executive sign-off | Program Manager | Sponsor |
| **Sprint 1 Kickoff** | Jun 2, 2026 | Program Manager | **GO** |

---

**Last Updated:** March 29, 2026
**Next Review:** April 4, 2026 (Week 1 assessment)
**Status Dashboard:** See RISK_CLOSURE_TRACKER.md for detailed tracking
