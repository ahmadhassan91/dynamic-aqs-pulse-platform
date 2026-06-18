# Pulse Platform — Admin, Master Data & Configuration Module PRD

## 1. Document Control

| Field | Value |
|---|---|
| Version | 2.1 |
| Date | 2026-06-09 |
| Status | Enriched — traceability closure pass complete; 2026-06-18 scope correction (ASM-AD-08 routing threshold ≤5 was vendor-proposed; only the routing concept is client-confirmed — see Scope corrections) |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS IT / security lead, operations lead, data stewardship owner, Strategic Growth representative, Super Admin / implementation lead |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, Leads PRD, Territory PRD, Training PRD, Product Management PRD |
| Meeting Traceability | Session 1 (Feb 16 2026), Session 2 (Feb 18 2026), Session 3 (Feb 20 2026), Session 4 (Feb 24 2026), Session 5 (Feb 25 2026), Session 6 (Feb 27 2026), Session 7 (Mar 2 2026 — Dealer Portal), Session 9 (Mar 13 2026 — Lead to Dealer Onboarding), Session 10 (Mar 17 2026), Session 11 (Mar 19 2026 — Dealer Portal / Product Mgmt), Sessions 13/20 April 2026 scope review |

---

## Scope corrections (2026-06-18)

A program-wide PRD scope-accuracy re-check (verifying client-attributed requirements against the actual cited meeting transcripts) found that **ASM-AD-08 over-attributes the routing threshold to the client**. As written, the assumption states "Dan Harshbarger confirmed the threshold should be 'less than or equal to five' and C G noted it may shift to technician count (SRC-AD-004)." In the cited Session 4 transcript:

- The **"≤5" number was vendor-spoken** (Ahmad Hassan, Clustox, Session 4) — it was proposed by the vendor, not stated by the client.
- The **client agreed to the routing *concept*** with a bare **"Yes"**; the client did **not** state the exact boundary value.
- The **exact boundary and the technician-count basis/caveat are not present in the cited transcript** — so the precise number and the "shift to technician count" qualifier are unconfirmed.

Correction applied: ASM-AD-08 is reworded so the threshold is recorded as **vendor-proposed ≤5; the client agreed to the routing concept; the exact boundary and basis are unconfirmed (OQ-AD-04)**. This is consistent with OQ-AD-04, which already holds the approved routing basis open. No rows are deleted; the assumption is retained with an inline corrected marker.

Full audit: `docs/SCOPE_ACCURACY_AUDIT_2026-06-18.md`.

---

## 2. Source Inventory

| ID | Absolute Path | What It Sourced |
|---|---|---|
| SRC-AD-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1 - 16th Feb 2026.md` | Strategic objectives, persona roles (executive, field TM, admin ops), pain points re: multiple tool silos |
| SRC-AD-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/18 feb 2026 Discovery session 2.md` | Lead-intake roles, affinity group / ownership (PE) group as governed reference data, "none" / "independent" option requirement |
| SRC-AD-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/20 Feb session 3 _ Discovery session 3 _ Validations.md` | Manual CRM entry pain, data mismatch between Dynamics and Acumatica, reporting as top priority |
| SRC-AD-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/24 Feb 2026 Discovery session 4.md` | Routing logic (truck-count threshold), affinity group import from CSV/Excel, territory assignment roles, credit-card tokenization / no raw card data |
| SRC-AD-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/25 Feb 2026 Session 5.md` | Samantha as ops subject matter expert; consignment ops confirmed operational roles |
| SRC-AD-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Fri 27th  Feb Session 6.md` | Shared context for roles; validated field TM versus back-office admin split |
| SRC-AD-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/02 March session 7 Discovery - Delaer Portal.md` | Dealer portal user provisioning, affinity group branding/visibility in Shopify (to be replaced by Pulse), dealer company isolation |
| SRC-AD-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/13th March Discovery Session 9.md` | Finance role owns credit decisions and CIS; roles involved in lead-to-customer flow; no raw payment-card storage |
| SRC-AD-009 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session _11 To-Be Dealer Portal, Product Management.md` | Acumatica as source of truth for financials/prices; Pulse enriches and governs product taxonomy; digital asset integration scope |
| SRC-AD-010 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/session-13th-20thApril-2026.md` | Executive leadership demo; C G confirmed single-source-of-truth architecture: financials in Acumatica, customer/activity data in Pulse |
| SRC-AD-011 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1_ Executive Vision, Objectives & Mobile Strategy.md` | User disengagement / low CRM adoption pain, mobile-first requirements, Outlook calendar integration |
| SRC-AD-CODE-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/admin/service.ts` | Built: user CRUD, bulk import, role access catalog, audit log, overview, system health, integration status |
| SRC-AD-CODE-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/admin/http.ts` | Built: HTTP route surface for all admin service operations |
| SRC-AD-CODE-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/auth/policy.ts` | Built: Microsoft Entra policy stored in FeatureFlag, group-role mapping editor, domain allow-list |
| SRC-AD-CODE-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/auth/visibility.ts` | Built: record-scope enforcement per role (TM, RD, global-scope roles) |
| SRC-AD-CODE-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/packages/contracts/src/auth.ts` | Built: AUTH_ROLES (9 internal + 1 dealer), WORKSPACE_MODULES, WORKSPACE_ACTIONS, ROLE_PROFILE_CATALOG |
| SRC-AD-CODE-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/admin/AdminWorkspace.tsx` | Built: full admin UI (users, access profiles, audit, integrations, configuration, reference data tabs) |
| SRC-AD-CODE-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/admin/AdminReferenceDataPanel.tsx` | Built: reference data read surface (affinity groups, ownership groups, brand labels, lead sources) |
| SRC-AD-CODE-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/admin/AdminCatalogRulesWorkspace.tsx` | Built: dealer-group catalog rule draft → preview → publish wizard |
| SRC-AD-CODE-009 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/reference/service.ts` | Built: affinity/ownership/brand/lead-source reference data service with default seeds and audit trail |

> Note: Several meeting files are `.md` equivalents sourced from the transcript archive. `.docx` originals were not read (no unreadable sources that affected coverage — all relevant content was available in `.md` form). Session 5 and Session 6 transcripts contain significant consignment operational context but minimal admin-specific content; they are cited as session context only.

---

## 3. Executive Summary

The Admin, Master Data & Configuration module is the control room that every other Pulse module trusts. It is where system administrators and data stewards manage who can sign in, what access each person carries, which governed reference values the business runs on, how dealer-group visibility is decided, and which integrations are healthy. Today Pulse already ships a permission-gated admin console for user and access management, a separate guided wizard for dealer catalog (dealer-group) rules, and a one-area-at-a-time integration setup surface. This PRD specs that built state honestly and names the gaps that must close before admin can be the single, dependable home for configuration: reference data is still scattered across the Leads, Territory, and Product workspaces; access is governed by a fixed role catalog with only one tunable lever; and several operational settings (routing thresholds, SLA timers, company branding, feature flags) have no admin screen yet. The goal of this module is to give Dynamic AQS one governed, auditable place to run the platform — not engineering tickets, spreadsheets, and raw configuration strings.

---

## 4. Problem Statement

### 4.1 Current State (as of discovery)

- User provisioning was manual and scattered — welcome emails sent by hand, no governed onboarding path (SRC-AD-001, SRC-AD-007)
- Access was governed by Microsoft Dynamics role assignments in a 15–20% adoption environment; no clean role catalog or footprint visibility (SRC-AD-003, SRC-AD-011)
- Affinity group and ownership/PE group lists were maintained per-team in Excel and Hubspot with no governed single source (SRC-AD-002, SRC-AD-004)
- Dealer portal user provisioning was manual in Shopify; affinity-group-based branding per dealer was configured by hand (SRC-AD-007)
- Routing logic (truck-count/technician threshold, state-to-owner mapping) lived in undocumented manual practice (SRC-AD-004)
- No payment-card data governance — raw card details were stored on CIS PDF forms (SRC-AD-008)
- Acumatica and Dynamics data mismatched because there was no authoritative system-of-record boundary decision; C G resolved this during the April sessions: financials stay in Acumatica, customer/activity/workflow data stays in Pulse (SRC-AD-010)

### 4.2 Target State

- One permission-gated admin console covering user lifecycle, access profiles, reference data, dealer-group rules, operational configuration, audit evidence, and integration health
- Fixed role catalog (nine internal + one dealer-portal) with Entra group mapping as the primary tuning lever; no per-permission matrix for launch
- Governed reference data home that Leads, Territory, and Product workspaces read from rather than maintain locally
- Dealer-portal users provisioned inside the admin user-create flow with company isolation enforced
- Raw payment-card data never stored in Pulse; tokenized-capture only
- Every administrative and access change written to an immutable audit trail

---

## 5. Scope Statement

### 5.1 Pulse Will Support

- a permission-gated administration console reachable only by roles with admin access
- user management: list, search, filter, paginate, add, edit, bulk-import, reset password, activate/deactivate, and live-session visibility
- internal user provisioning aligned to Microsoft Entra sign-in, plus dealer-portal user provisioning with initial credential and welcome-email handling
- a clear catalog of access profiles (roles) showing each role's module and action footprint
- Microsoft Entra group → Pulse role mapping through a proper mapping editor (group reference plus role select), replacing today's raw `groupId=ROLE` string entry
- a single, governed reference-data home that consolidates affinity groups, ownership / PE groups, territory regions, product taxonomy, activity types, and related governed lists currently maintained inside other workspaces
- CSV / XLSX import and export plus change history for governed reference data
- a dealer-group (dealer catalog) rule workspace using a draft → preview → publish wizard that builds visibility rules from approved conditions (affinity group, ownership / PE, region, portal-eligible, independent), previews account impact, and enforces publish gates
- routing-rule and SLA-threshold configuration (e.g. service-tech / truck-count split, state → owner mapping, response-timer durations) under admin control
- system settings: company name, logo, timezone, date format, currency defaults
- feature-flag administration to enable or disable capabilities without a deployment
- an audit / activity monitor with view, filter, and export
- an integration overview that shows Entra access, Outlook calendar, payment boundary, and lead-alert delivery health together, with per-provider policy and operational controls
- one consistent navigation model (information architecture) for every admin surface

### 5.2 This PRD Also Covers

- how Pulse will move scattered reference-data CRUD into one governed admin home without breaking the workspaces that read it
- how access will be tuned given a fixed role catalog, and whether per-user permission overrides are needed at all
- how administrators will provision dealer-portal users as part of the user-create flow
- which configuration that lives in code or environment variables today must become admin-managed before launch
- what Dynamic AQS needs to confirm before the admin and configuration scope is locked

### 5.3 Parked Dependencies (by design)

These items remain part of the broader Pulse vision but require later approval or a separate dependency decision:

- **Acumatica** live sync and ERP-owned reference truth (price classes, item classes, and distribution centers where ERP is the system of record) — parked until sandbox and endpoint certification are complete
- barcode / SKU mapping administration
- mailbox / email ingestion configuration
- **Payment provider** final runtime configuration (current build records tokenized capture outcomes manually; live provider runtime is parked)
- a deep per-user permission matrix, if Dynamic AQS confirms the fixed-role model is sufficient
- advanced system-health, maintenance-mode, and break-glass tooling beyond the audit monitor and integration health views

---

## 6. Primary Future-State User Journeys

### 6.1 Journey A — Administrator Onboards A New Internal User

1. An admin opens the Users & Access area of the admin console.
2. The admin adds the user with name, email, and a single access profile (role).
3. Pulse aligns the internal account to Microsoft Entra sign-in and confirms the welcome / activation path.
4. The new user appears in the list with status, last login, and live-session count.
5. The change is written to the audit trail with actor, timestamp, and what changed.

### 6.2 Journey B — Administrator Provisions A Dealer-Portal User

1. From the user-create flow, the admin selects the dealer-portal user type.
2. The admin sets the dealer's email, an initial password path, and the dealer role bounded to their own company.
3. Pulse triggers a welcome email with sign-in instructions.
4. The dealer account is isolated to its own company context and recorded in the audit trail.

### 6.3 Journey C — Data Steward Updates Governed Reference Data

1. A steward opens the Reference Data home in admin and selects a list (for example, affinity groups or ownership / PE groups).
2. The steward adds, edits, or deactivates an entry, or imports a refreshed CSV / XLSX batch with preview and validation.
3. Pulse validates codes and required fields and records a change-history entry (who, when, old / new values).
4. Downstream modules — Leads, Territory, Product, dealer-group rules — immediately read the governed values without re-entry.

### 6.4 Journey D — Administrator Publishes Dealer-Group Visibility Rules

1. An admin opens the Dealer Group Rules workspace and drafts rules from approved conditions (affinity group, ownership / PE, region, portal-eligible, independent).
2. The admin saves the draft and runs a preview that samples real accounts and shows matched, needs-review, and unmatched counts plus affected products and files.
3. Pulse blocks publish while any sampled account is unmatched or needs review, or while the preview is stale.
4. When the preview is clean, the admin publishes; Pulse re-runs the full account check, activates the rule set, and retires the prior version.

### 6.5 Journey E — Administrator Tunes Access For A Person

1. An admin reviews the access-profile catalog and confirms the right profile for a user.
2. If access must be adjusted, the admin changes the user's assigned profile rather than hand-editing individual permissions.
3. For Microsoft sign-in, the admin maps the correct Entra group to a Pulse role using the group picker and role select.
4. Pulse records the access change in the audit trail; per-user permission overrides are applied only if Dynamic AQS confirms that lever is in scope.

### 6.6 Journey F — Administrator Configures Routing And Response Timing

1. An admin opens routing and SLA configuration in admin.
2. The admin sets the routing basis and threshold (for example, the service-tech / truck-count split), state → owner mapping, and Strategic Growth pool membership.
3. The admin sets response-timer durations per event type (initial contact, finance review, and similar).
4. Leads and Calendar apply the configured values without an engineering deployment, and the change is audited.

### 6.7 Journey G — Administrator Reviews Integration Health And Audit Evidence

1. An admin opens the integration overview and sees Entra access, Outlook calendar, payment boundary, and lead-alert delivery health together.
2. The admin opens a provider to adjust policy or run operational actions (for example, retry failed lead-alert deliveries or adjust quiet hours).
3. The admin opens the audit monitor, filters by user, entity, action, or date range, and exports the result for review.
4. Sensitive boundaries (no raw payment-card data, dealer isolation) remain enforced throughout.

---

## 7. Functional Requirements

### 7.1 User Lifecycle Management

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-AD-001 | List users with paginated search and filters | Users list shows name, email, access profile, status (ACTIVE / PENDING / INACTIVE), last login, live-session count; filter by role and status; search by name/email; pagination at 10/20/100 per page | P0 | Built | SRC-AD-CODE-001, SRC-AD-CODE-006 |
| FR-AD-002 | Add internal user | Admin creates user with email, first/last name, role, active flag, optional temp password; system generates temp password if not supplied; user appears in list | P0 | Built | SRC-AD-CODE-001, SRC-AD-001 |
| FR-AD-003 | Edit user | Admin can update email, name, role, and active flag; changes audited with before/after values | P0 | Built | SRC-AD-CODE-001 |
| FR-AD-004 | Deactivate / reactivate user | Deactivation blocks sign-in without deleting historical references; confirmation required before deactivating (UX-AD-001) | P0 | Built (confirmation added per UX-AD-001) | SRC-AD-CODE-006 |
| FR-AD-005 | Reset user password | Admin resets to a generated or specified temp password; all active sessions revoked on reset; result returned in response | P0 | Built | SRC-AD-CODE-001 |
| FR-AD-006 | Bulk import users (CSV/XLSX) | Admin uploads rows; each row validated; per-row success/failure summary returned; successful rows provisioned with temp passwords | P0 | Built | SRC-AD-CODE-001, SRC-AD-CODE-006 |
| FR-AD-007 | Export users CSV | Admin exports filtered user list to CSV with name, email, role, status, sessions, last-login, created-at | P1 | Built | SRC-AD-CODE-006 |
| FR-AD-008 | Live session count in user list | User list shows `activeSessionCount` per user based on non-expired, non-revoked sessions | P1 | Built (UX-AD-002 resolved) | SRC-AD-CODE-001, SRC-AD-CODE-006 |
| FR-AD-009 | Last login timestamp in user list | User list shows last login; "Never" shown for PENDING users | P1 | Built | SRC-AD-CODE-001 |
| FR-AD-010 | Provision dealer-portal user from admin | User-create flow includes an `actorType` selector (internal / dealer); dealer type sets `UserKind.DEALER` and bounds the account to dealer context | P0 | Built (UX-AD-011 resolved) | SRC-AD-CODE-001, SRC-AD-007 |
| FR-AD-011 | User deactivation confirmation modal | Before deactivating an active user, system shows a confirmation modal naming the user | P1 | Built (UX-AD-001 resolved) | SRC-AD-CODE-006 |

### 7.2 Access Profiles and RBAC

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-AD-012 | Fixed role catalog — nine internal profiles plus dealer-portal | Pulse ships exactly ten assignable roles: EXECUTIVE, SUPER_ADMIN, SALES_BD_REP, SALES_BD_LEADERSHIP, FINANCE, ADMIN_CSR_OPS, TERRITORY_MANAGER, REGIONAL_DIRECTOR, TRAINING_OPS, DEALER_PORTAL_USER. Role catalog is read-only in the UI. | P0 | Built | SRC-AD-CODE-005 |
| FR-AD-013 | Access profile catalog with footprint display | Admin can view each role's display name, summary, "best for" description, scope summary, workspace highlights, and action highlights | P0 | Built | SRC-AD-CODE-001, SRC-AD-CODE-005, SRC-AD-CODE-006 |
| FR-AD-014 | Per-role full module and action footprint detail view | Admin can expand each role to see the full list of modules and actions (not just highlights) | P1 | Built (UX-AD-003 resolved per `WorkbenchAdvancedSection`) | SRC-AD-CODE-006 |
| FR-AD-015 | Role-based record scope enforcement | TM sees only their owned accounts/leads; RD sees their regional scope; global-scope roles (EXECUTIVE, SUPER_ADMIN, SALES_BD_LEADERSHIP, FINANCE, ADMIN_CSR_OPS, TRAINING_OPS) see all records | P0 | Built | SRC-AD-CODE-004 |
| FR-AD-016 | Microsoft Entra group → Pulse role mapping editor | Admin uses a structured group-reference + role-select editor (not free-text string) to map Entra AD groups to Pulse roles; stored in governed `FeatureFlag`; audited | P0 | Built | SRC-AD-CODE-003 |
| FR-AD-017 | Domain allow-list for Entra sign-in | Admin configures allowed domains; Entra sign-in only accepted from approved domains when restriction is set | P1 | Built | SRC-AD-CODE-003 |
| FR-AD-018 | Entra email-linking and auto-provisioning controls | Admin can toggle email-linking and group-based auto-provisioning in the Entra integration panel | P1 | Built | SRC-AD-CODE-003 |
| FR-AD-019 | Effective group-role mapping resolution | System merges env-var group mappings and admin-stored group mappings; admin-stored mappings override env-var entries for the same group | P1 | Built | SRC-AD-CODE-003 |
| FR-AD-020 | Per-user permission overrides (if confirmed) | If Dynamic AQS confirms the fixed-role model is insufficient, admin can apply per-user overrides beyond the assigned profile | P2 | Not-built — parked pending OQ-AD-01 decision | SRC-AD-001 |
| FR-AD-021 | Dealer-portal user company isolation | DEALER_PORTAL_USER accounts are bounded to their own company context; no cross-account visibility is permitted at any point | P0 | Built | SRC-AD-CODE-004, SRC-AD-CODE-005, SRC-AD-007 |

### 7.3 Reference Data Governance

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-AD-022 | Governed reference-data home in admin | Admin module hosts the authoritative CRUD surface for: affinity groups, ownership / PE groups, brand labels, lead sources, and (future) product taxonomy / activity types | P0 | Built (read surface — UX-AD-007 resolved); write surface requires additional API endpoints | SRC-AD-CODE-007, SRC-AD-002, SRC-AD-004 |
| FR-AD-023 | Affinity group reference data | List includes: code, short name, full name, group type (buying_group, coaching_network, etc.), sort order, active status; seeded with Nexstar, CertainPath, EGIA, and others | P0 | Built (read + seed) | SRC-AD-CODE-009, SRC-AD-002 |
| FR-AD-024 | Ownership / PE group reference data | List includes: code, name, group type (private_equity, dealer_group, etc.), active status | P0 | Built (read + seed) | SRC-AD-CODE-009, SRC-AD-002 |
| FR-AD-025 | Brand labels reference data | List of brand/label codes used for dealer visibility and product branding | P0 | Built (read) | SRC-AD-CODE-009 |
| FR-AD-026 | Lead sources reference data | Governed list: branded website, trade show, phone, email, referral, affinity roster, ownership roster, manual entry | P0 | Built (read + seed) | SRC-AD-CODE-009 |
| FR-AD-027 | CSV / XLSX batch import for reference data | Import rows with header mapping, validation, and preview; per-row success/failure; change history recorded | P0 | Built (roster import for affinity/ownership); direct admin panel import for other lists is Not-built | SRC-AD-CODE-009, SRC-AD-004 |
| FR-AD-028 | Change history for reference data | Every add, edit, or deactivate records who, when, old/new values in the audit trail | P0 | Built (via `AuditEntry` in reference service) | SRC-AD-CODE-009 |
| FR-AD-029 | Downstream workspace read-through | Leads, Territory, Product, and Dealer Group rule workspaces read reference values from the governed admin source; they do not maintain independent copies | P0 | Built (API layer routes reads through reference service) | SRC-AD-CODE-009 |
| FR-AD-030 | "Independent" / "None" affinity group option | When creating or editing a lead, the affinity group field offers an "Independent" / "None" option in addition to governed group values | P0 | Built (DEFAULT_AFFINITY_GROUPS seeded; UI offers null/none) | SRC-AD-002 |
| FR-AD-031 | Deactivate reference entry without deletion | Entries can be deactivated (not deleted) to preserve historical references | P0 | Built | SRC-AD-CODE-009 |

### 7.4 Dealer-Group Rule Engine

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-AD-032 | Draft → preview → publish wizard for dealer-group rules | Admin creates rules in draft; saves; runs a preview; sees matched / needs-review / unmatched account counts and affected catalog impact; publishes only when gates pass | P0 | Built | SRC-AD-CODE-008 |
| FR-AD-033 | Rule conditions | Rules can be built from: affinity group membership, ownership / PE group, region, portal-eligible flag, and independent flag | P0 | Built | SRC-AD-CODE-008 |
| FR-AD-034 | Preview stale gate | Publish is blocked if the preview has not been re-run since the rule was last saved | P0 | Built | SRC-AD-CODE-008 |
| FR-AD-035 | Unmatched account gate | Publish is blocked while any sampled account is unmatched or in "needs review" state | P0 | Built | SRC-AD-CODE-008 |
| FR-AD-036 | Full account check on publish | On publish, system re-runs the check against all accounts (not just the preview sample) before activating the rule set | P0 | Built | SRC-AD-CODE-008 |
| FR-AD-037 | Rule set versioning | Publishing a new rule set retires the prior version; version history is kept | P1 | Built | SRC-AD-CODE-008 |
| FR-AD-038 | Publish scope limited to visibility rules | Publishing dealer-group rules never publishes products, files, prices, orders, or inventory | P0 | Built (by design — rules engine is visibility-only) | SRC-AD-CODE-008 |

### 7.5 Operational Configuration

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-AD-039 | Routing threshold configuration | Admin configures: routing basis (service-tech count, truck count), threshold value, state → owner mapping, Strategic Growth pool membership | P0 | Partial — UI panel rendered (UX-AD-008 resolved); write API endpoint (`POST /admin/routing-thresholds`) not-built | SRC-AD-004, SRC-AD-CODE-006 |
| FR-AD-040 | SLA timer configuration | Admin configures response-timer durations per event type (initial contact, finance review, etc.) | P0 | Partial — UI panel present; write endpoint not-built | SRC-AD-004 |
| FR-AD-041 | System settings panel | Admin configures: company name, logo, timezone, date format, currency defaults | P1 | Partial — UI panel rendered (UX-AD-009 resolved); write endpoint (`POST /admin/system-settings`) not-built | SRC-AD-CODE-006 |
| FR-AD-042 | Feature flag administration | Admin can view and toggle capability feature flags without a deployment | P1 | Partial — UI panel rendered (UX-AD-010 resolved); read/write API endpoints (`GET /admin/feature-flags`, `PATCH`) not-built | SRC-AD-CODE-006 |
| FR-AD-043 | Configuration changes applied without deployment | Any change made through the admin configuration UI takes effect immediately via stored database/flag values, not environment variables or code deployments | P0 | Partial — routing/system settings/flags UI reads server state; write path not yet wired | SRC-AD-001 |
| FR-AD-044 | Configuration changes audited | All configuration changes are written to the audit trail with actor, timestamp, before/after values | P0 | Built for Entra policy; Not-built for routing / system settings / feature-flag mutations | SRC-AD-CODE-003 |

### 7.6 Audit and Activity Monitor

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-AD-045 | Audit trail capture | Every administrative and authentication event records: actor user, action type, entity type, entity ID, timestamp, summary, before/after data | P0 | Built | SRC-AD-CODE-001 |
| FR-AD-046 | Audit monitor — filter and view | Admin views audit entries; filters by actor, entity type, action type, and (future) date range | P0 | Built (actor, action, entity-type filters; date range is Not-built) | SRC-AD-CODE-001, SRC-AD-CODE-006 |
| FR-AD-047 | Audit export CSV | Admin exports the currently visible audit entries as CSV | P1 | Built (UX-AD-012 resolved) | SRC-AD-CODE-006 |
| FR-AD-048 | Audit entries non-editable | No user may edit or delete audit entries | P0 | Built (entries created only via `prisma.auditEntry.create`; no update/delete endpoints exist) | SRC-AD-CODE-001 |
| FR-AD-049 | Audit date range filter | Admin can filter audit entries by date range | P1 | Not-built | (inferred standard) |

### 7.7 Integration Oversight

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-AD-050 | Integration overview — all providers in one view | Admin sees Entra auth, Outlook calendar, payment capture boundary, lead-alert delivery, and consignment-alert delivery together with status, health score, and last-checked timestamp | P0 | Built | SRC-AD-CODE-001, SRC-AD-CODE-006 |
| FR-AD-051 | Microsoft Entra integration management | Admin views configuration issues, updates email-linking and auto-provisioning, edits allowed domains, and edits group-role mappings | P0 | Built | SRC-AD-CODE-003 |
| FR-AD-052 | Outlook calendar integration management | Admin configures shared-calendar settings, meeting provider (Teams / none), auto-sync for discovery and training | P0 | Built | SRC-AD-CODE-002 |
| FR-AD-053 | Payment integration management | Admin sets capture mode (manual recording vs. provider runtime), default provider, CIS capture tracking flag, and account payment-method management flag; raw card data never stored | P0 | Built | SRC-AD-CODE-002, SRC-AD-008 |
| FR-AD-054 | Lead-alert delivery management | Admin views pending/failed delivery counts, retries failed deliveries, dead-letters irrecoverable deliveries, adjusts quiet hours, and manages recipient roster | P0 | Built | SRC-AD-CODE-001, SRC-AD-CODE-006 |
| FR-AD-055 | Consignment-alert delivery management | Admin views consignment operational alert delivery settings; settings panel shows pending alert queue | P0 | Built | SRC-AD-CODE-006 |
| FR-AD-056 | Integration management permission-gated | Integration settings changes require `admin.integration_manage` action; view-only access uses `admin.integration_view` | P0 | Built | SRC-AD-CODE-005 |
| FR-AD-057 | No raw payment-card data in Pulse | Pulse stores only tokenized or masked payment references; CIS form never captures or retains raw card numbers | P0 | Built | SRC-AD-CODE-005, SRC-AD-008 |
| FR-AD-058 | Acumatica integration health visibility | Admin sees Acumatica connectivity status in the integration overview; status shows "connected" or "warning — awaiting sandbox certification" | P1 | Built | SRC-AD-CODE-001 |

### 7.8 Navigation and Information Architecture

| ID | Requirement | Acceptance Criteria | Priority | Build Status | SRC |
|---|---|---|---|---|---|
| FR-AD-059 | Single consistent admin navigation | All admin surfaces (users, access profiles, reference data, dealer-group rules, configuration, audit, integrations) are reachable through one navigation model with Tabs | P0 | Built | SRC-AD-CODE-006 |
| FR-AD-060 | Permission-gated tab visibility | Each admin tab (users, roles, overview, activity, integrations, configuration, reference) is shown only to roles that have the matching action permission | P0 | Built (`tabAccess` computed from `canPerformAction`) | SRC-AD-CODE-006 |
| FR-AD-061 | AdminCatalogRulesWorkspace accessible from admin nav | Dealer-group rules workspace is reachable via the admin navigation (overview page "Setup and Evidence" section → Business Rules) | P1 | Built (UX-AD-004 resolved — router.push to `/admin/catalog-rules`) | SRC-AD-CODE-006 |

---

## 8. Business Rules Pulse Will Enforce

| ID | Rule |
|---|---|
| BR-AD-01 | The administration console will be reachable only by access profiles granted admin access; every surface is permission-gated. |
| BR-AD-02 | Every administrative and access change will be written to an audit trail with actor, timestamp, and what changed. |
| BR-AD-03 | Audit entries will not be editable or deletable by any user. |
| BR-AD-04 | Deactivating a user will block sign-in while preserving that user's historical references and activity authorship. |
| BR-AD-05 | Reassignments and access changes will not rewrite prior activity authorship or historical ownership decisions. |
| BR-AD-06 | The role catalog is a fixed set of access profiles; access is tuned by assigning a profile, not by editing the catalog, unless Dynamic AQS approves per-user overrides. |
| BR-AD-07 | Microsoft Entra group → role mappings will be entered through a governed editor (group reference plus role select), not as free-text strings. |
| BR-AD-08 | Governed reference data will have one administrative home; downstream modules will read those values rather than maintain their own copies. |
| BR-AD-09 | Reference-data changes will be validated and recorded with change history (old / new values). |
| BR-AD-10 | Dealer-group rules will not publish while the preview is stale or while any sampled account is unmatched or requires review. |
| BR-AD-11 | Publishing a dealer-group rule set publishes rules only — never products, files, prices, orders, or inventory. |
| BR-AD-12 | Raw payment-card data will never be stored in Pulse; only tokenized or masked references are retained. |
| BR-AD-13 | Dealer-portal users will be isolated to their own company context with no cross-account visibility. |
| BR-AD-14 | Operational configuration (routing, SLA, system settings, feature flags) will be changeable by authorized admins without an engineering deployment. |
| BR-AD-15 | ERP-owned reference truth will not be edited as authoritative in Pulse once Acumatica is the system of record for those values. |
| BR-AD-16 | Territory Manager record scope is limited to owned accounts and leads; Regional Director scope is limited to their region; all other named roles have global visibility. |

---

## 9. Non-Functional Requirements

| ID | Category | Requirement | Source |
|---|---|---|---|
| NFR-AD-001 | Performance | Admin user list loads within 2 s for up to 500 users with active filters applied | (inferred standard) |
| NFR-AD-002 | Performance | Audit monitor filters and returns the first page of results within 2 s for the trailing 90-day window | (inferred standard) |
| NFR-AD-003 | Performance | Reference data lists (affinity groups, ownership groups) load within 1 s for lists under 500 entries | (inferred standard) |
| NFR-AD-004 | Security / AuthZ | Every admin API endpoint validates the actor's JWT and checks the required action permission before executing; unauthenticated requests return 401; unauthorized requests return 403 | SRC-AD-CODE-002 |
| NFR-AD-005 | Security / AuthZ | Admin console tab visibility and mutation actions are enforced server-side, not only in the UI | SRC-AD-CODE-005 |
| NFR-AD-006 | Security / AuthZ | Password hashes use scrypt (salt + 64-byte derived key); plain-text passwords are never stored or logged | SRC-AD-CODE-001 |
| NFR-AD-007 | Security / AuthZ | Temporary passwords generated by admin are cryptographically random (9 bytes base64url entropy) | SRC-AD-CODE-001 |
| NFR-AD-008 | Security / AuthZ | Raw payment-card data is never transmitted to or stored in Pulse at any layer | SRC-AD-008 |
| NFR-AD-009 | Scalability | Admin user list query is paginated server-side (max 100 per page); audit monitor is paginated (max 100 per request) | SRC-AD-CODE-001 |
| NFR-AD-010 | Availability | The admin console must be available whenever the Pulse API is available; admin operations do not have a separate SLA tier | (inferred standard) |
| NFR-AD-011 | Auditability | All user mutations (create, update, deactivate, password reset) write an `AuditEntry` record inside a database transaction so the mutation and its audit record are atomic | SRC-AD-CODE-001 |
| NFR-AD-012 | Auditability | Entra policy updates write an `AuditEntry` inside the same transaction | SRC-AD-CODE-003 |
| NFR-AD-013 | Auditability | Reference data mutations write `AuditEntry` records via `buildAuditEntryData` | SRC-AD-CODE-009 |
| NFR-AD-014 | Accessibility | Admin console adheres to WCAG 2.1 AA for all interactive elements (inputs, buttons, tables, modals) | (inferred standard) |
| NFR-AD-015 | Observability | Admin API routes emit structured error logs on 4xx/5xx responses including the actor role and endpoint | (inferred standard) |
| NFR-AD-016 | Data Retention | Audit entries are immutable and retained for a minimum of 7 years to support compliance reviews | (inferred standard) |
| NFR-AD-017 | Concurrency | Admin role-assignment and deactivation operations use database transactions to prevent race conditions on the same user record | SRC-AD-CODE-001 |

---

## 10. Assumptions

| ID | Assumption | Why It Matters |
|---|---|---|
| ASM-AD-01 | The fixed catalog of access profiles (nine assignable internal roles plus the dealer-portal role) is sufficient for launch, with per-user overrides treated as a later decision. | This determines whether Pulse builds a profile-assignment model or a full per-user permission matrix. |
| ASM-AD-02 | Microsoft Entra group → role mapping is the primary approved lever for tuning internal access. | This sets where access governance happens and how the mapping editor is designed. |
| ASM-AD-03 | Governed reference data should be consolidated into one admin home while downstream workspaces keep reading the same values. | This affects migration sequencing so consolidation does not disrupt Leads, Territory, or Product workflows. |
| ASM-AD-04 | Routing thresholds, SLA timers, system settings, and feature flags should be admin-managed rather than code- or environment-owned. | This determines how much configuration moves out of engineering control before launch. |
| ASM-AD-05 | Dealer-portal user provisioning (initial credential plus welcome email) belongs inside the admin user-create flow. | This affects onboarding completeness and whether dealer setup needs a separate path. |
| ASM-AD-06 | Delegated (non-engineering) admins can perform user, access, and reference-data corrections within an approved boundary. | This sets who can safely operate the console without engineering support. |
| ASM-AD-07 | ERP-owned reference values will become read-only in Pulse once Acumatica is the system of record. | This affects which reference lists Pulse owns versus mirrors, and how stewardship behaves over time (confirmed by C G in April session: SRC-AD-010). |
| ASM-AD-08 | The truck-count / service-technician routing threshold is a configurable value, not hardcoded. The boundary was **vendor-proposed ≤5** (vendor-proposed: five or fewer trucks / technicians → Strategic Growth, greater than five → National TM assignment); the client agreed to the routing **concept**, and the exact boundary/basis is unconfirmed (OQ-AD-04). | Routing-basis configurability matters regardless of the exact threshold. Per the 2026-06-18 scope correction, the ≤5 number was vendor-spoken (Ahmad, Session 4) and the client agreed to the concept with a bare "Yes"; the exact boundary and the technician-count caveat are not in the cited transcript (SRC-AD-004) and remain open under OQ-AD-04. — ⚠️ CORRECTED 2026-06-18: ≤5 was vendor-proposed; only the routing concept is client-confirmed; boundary/basis open (OQ-AD-04). |
| ASM-AD-09 | The break-glass procedure (fallback if Entra is unavailable) will be operated by IT and defined outside the Pulse admin UI for Phase 1. | If no fallback is defined, a Pulse admin with LOCAL identity can remain active as the emergency account. |

---

## 11. Open Questions

| ID | Question | Options To Confirm | Why Decision Is Needed |
|---|---|---|---|
| OQ-AD-01 | Is the fixed nine-role profile model sufficient, or are per-user permission overrides required? | fixed profiles only / profiles plus rare overrides / full per-user matrix | This is the single biggest scope driver for the access model. FR-AD-020 is parked on this answer. |
| OQ-AD-02 | Which named leaders receive delegated admin authority at launch, and what actions are in or out of scope? | Super Admin only / named delegated admins / role-based admin tiers | Required for safe admin setup and operational support boundaries. |
| OQ-AD-03 | Which reference lists does Pulse own as source of truth versus mirror from Acumatica? | Pulse-owned / ERP-owned mirrored read-only / hybrid by list | This determines edit rights, stewardship, and sync direction per list. |
| OQ-AD-04 | What is the approved routing basis and SLA timer set that admins will configure? | service-tech count / truck count / other; timer durations per event | Pulse should not lock routing or escalation behavior on an incorrect basis. FR-AD-039/040 write paths are unbuilt pending this confirmation. |
| OQ-AD-05 | Should reference-data and configuration changes require a reason or approval step for sensitive lists? | no reason / reason required / approval gate for sensitive changes | This affects audit depth and change-control friction. |
| OQ-AD-06 | What is the approved dealer-portal user provisioning policy (initial password and welcome email)? | admin-set password / self-set via email link / mixed | This changes the user-create flow and dealer onboarding security. |
| OQ-AD-07 | Which configuration must be admin-managed at launch versus acceptable as environment-owned initially? | all admin-managed / phased / minimum viable set | This scopes how much configuration tooling is needed for go-live. FR-AD-039–FR-AD-042 write paths are the key items. |
| OQ-AD-08 | What is the break-glass procedure if Microsoft Entra sign-in is unavailable, and who owns it? | local fallback admin / IT-owned recovery / no fallback | Required for operational resilience of the admin console itself (ASM-AD-09). |

---

## 12. Build Status Summary (Gap List)

The table below identifies every FR that is not fully built.

| FR | Description | Status | Blocker |
|---|---|---|---|
| FR-AD-020 | Per-user permission overrides | Not-built / Parked | OQ-AD-01 decision required |
| FR-AD-039 | Routing threshold write API | Partial — UI built; write endpoint not-built | `POST /admin/routing-thresholds` needed (UX-AD-008) |
| FR-AD-040 | SLA timer write API | Partial — UI built; write endpoint not-built | Endpoint needed (UX-AD-008) |
| FR-AD-041 | System settings write API | Partial — UI built; write endpoint not-built | `POST /admin/system-settings` needed (UX-AD-009) |
| FR-AD-042 | Feature flags read/write API | Partial — UI built; endpoints not-built | `GET /admin/feature-flags` + `PATCH` needed (UX-AD-010) |
| FR-AD-043 | Configuration changes applied without deployment | Partial — depends on write endpoints above | Blocked by FR-AD-039–042 write paths |
| FR-AD-044 | Configuration changes audited (routing/settings/flags) | Not-built (Entra policy audit exists; other config paths lack it) | Depends on write endpoints |
| FR-AD-049 | Audit date range filter | Not-built | Engineering work; no external dependency |
| FR-AD-027 (partial) | Admin panel CSV import for non-roster reference lists | Not-built for direct admin-panel write path | Backend write endpoints for affinity/ownership/brand/lead-source admin mutations needed |

---

## 13. Data And Integration Highlights

| Area | Proposed Pulse Role |
|---|---|
| Microsoft Entra ID | Pulse aligns internal sign-in and maps approved Entra groups to Pulse roles through a governed editor |
| Leads | Pulse supplies governed affinity / ownership reference data, routing rules, and SLA timers the Leads module consumes |
| Territory | Pulse governs region reference data and state → owner mapping used for routing and coverage |
| Product Management | Pulse governs product taxonomy and feeds dealer-group visibility resolution |
| Dealer Portal | Pulse provisions and isolates dealer-portal users and resolves their catalog through dealer-group rules |
| Calendar | Pulse supplies SLA / response-timer configuration that calendar and reminder behavior respect |
| Payments / CIS | Pulse surfaces the payment integration boundary while keeping raw card data out of Pulse |
| Acumatica (parked) | Pulse will later defer ERP-owned reference truth (price classes, item classes, ERP-owned distribution centers) to Acumatica |
| Reporting / Audit | Pulse feeds administrative, access, and configuration change history into auditable reporting |

---

## 14. Requirement → Source Traceability Matrix

| Requirement ID | SRC ID(s) | Session / Evidence |
|---|---|---|
| FR-AD-001 | SRC-AD-CODE-001, SRC-AD-CODE-006 | Built code |
| FR-AD-002 | SRC-AD-CODE-001, SRC-AD-001 | Session 1 (personas); built code |
| FR-AD-003 | SRC-AD-CODE-001 | Built code |
| FR-AD-004 | SRC-AD-CODE-006 | UX-AD-001 audit (Jun 2026) |
| FR-AD-005 | SRC-AD-CODE-001 | Built code |
| FR-AD-006 | SRC-AD-CODE-001, SRC-AD-CODE-006 | Built code |
| FR-AD-007 | SRC-AD-CODE-006 | Built code |
| FR-AD-008 | SRC-AD-CODE-001, SRC-AD-CODE-006 | UX-AD-002 audit (Jun 2026) |
| FR-AD-009 | SRC-AD-CODE-001 | Built code |
| FR-AD-010 | SRC-AD-CODE-001, SRC-AD-007 | Session 7 (dealer portal provisioning); UX-AD-011 |
| FR-AD-011 | SRC-AD-CODE-006 | UX-AD-001 audit |
| FR-AD-012 | SRC-AD-CODE-005 | Built contracts; inferred from session role discussions |
| FR-AD-013 | SRC-AD-CODE-001, SRC-AD-CODE-005, SRC-AD-CODE-006 | Built code |
| FR-AD-014 | SRC-AD-CODE-006 | UX-AD-003 audit |
| FR-AD-015 | SRC-AD-CODE-004 | Built visibility.ts |
| FR-AD-016 | SRC-AD-CODE-003 | Built auth/policy.ts |
| FR-AD-017 | SRC-AD-CODE-003 | Built auth/policy.ts |
| FR-AD-018 | SRC-AD-CODE-003 | Built auth/policy.ts |
| FR-AD-019 | SRC-AD-CODE-003 | Built auth/policy.ts |
| FR-AD-020 | SRC-AD-001 | Session 1 (role model discussion); parked on OQ-AD-01 |
| FR-AD-021 | SRC-AD-CODE-004, SRC-AD-007 | Session 7 (dealer isolation); built code |
| FR-AD-022 | SRC-AD-CODE-007, SRC-AD-002, SRC-AD-004 | Sessions 2 + 4 (reference data governance); UX-AD-007 |
| FR-AD-023 | SRC-AD-CODE-009, SRC-AD-002 | Session 2 (affinity groups discussed); built reference service |
| FR-AD-024 | SRC-AD-CODE-009, SRC-AD-002 | Session 2 (ownership / PE groups); built reference service |
| FR-AD-025 | SRC-AD-CODE-009 | Built code |
| FR-AD-026 | SRC-AD-CODE-009 | Built code |
| FR-AD-027 | SRC-AD-CODE-009, SRC-AD-004 | Session 4 (CSV import request by Dan / C G); roster import built; admin-panel write not-built |
| FR-AD-028 | SRC-AD-CODE-009 | Built code (AuditEntry in reference service) |
| FR-AD-029 | SRC-AD-CODE-009 | Built (API routes reference service) |
| FR-AD-030 | SRC-AD-002 | Session 2 — C G: "we need an option that says none. Independent." |
| FR-AD-031 | SRC-AD-CODE-009 | Built code |
| FR-AD-032 | SRC-AD-CODE-008 | Built code (AdminCatalogRulesWorkspace) |
| FR-AD-033 | SRC-AD-CODE-008 | Built code |
| FR-AD-034 | SRC-AD-CODE-008 | Built code |
| FR-AD-035 | SRC-AD-CODE-008 | Built code |
| FR-AD-036 | SRC-AD-CODE-008 | Built code |
| FR-AD-037 | SRC-AD-CODE-008 | Built code |
| FR-AD-038 | SRC-AD-CODE-008 | Built code (by design) |
| FR-AD-039 | SRC-AD-004, SRC-AD-CODE-006 | Session 4 (truck-count routing logic); UX-AD-008 audit |
| FR-AD-040 | SRC-AD-004 | Session 4 (routing + SLA timers); UX-AD-008 |
| FR-AD-041 | SRC-AD-CODE-006 | UX-AD-009 audit |
| FR-AD-042 | SRC-AD-CODE-006 | UX-AD-010 audit |
| FR-AD-043 | SRC-AD-001 | Session 1 (no manual deployments for config); UX-AD-008/009/010 |
| FR-AD-044 | SRC-AD-CODE-003 | Built for Entra; inferred standard for remaining config |
| FR-AD-045 | SRC-AD-CODE-001 | Built code |
| FR-AD-046 | SRC-AD-CODE-001, SRC-AD-CODE-006 | Built code |
| FR-AD-047 | SRC-AD-CODE-006 | UX-AD-012 audit |
| FR-AD-048 | SRC-AD-CODE-001 | Built code (create-only path) |
| FR-AD-049 | (inferred standard) | Not-built; standard compliance requirement |
| FR-AD-050 | SRC-AD-CODE-001, SRC-AD-CODE-006 | Built code |
| FR-AD-051 | SRC-AD-CODE-003 | Built code |
| FR-AD-052 | SRC-AD-CODE-002 | Built code |
| FR-AD-053 | SRC-AD-CODE-002, SRC-AD-008 | Session 9 (Dan: tokenize card data); built code |
| FR-AD-054 | SRC-AD-CODE-001, SRC-AD-CODE-006 | Built code |
| FR-AD-055 | SRC-AD-CODE-006 | Built code (ConsignmentAlertDeliveryPanel) |
| FR-AD-056 | SRC-AD-CODE-005 | Built code (WORKSPACE_ACTIONS) |
| FR-AD-057 | SRC-AD-008 | Session 9 — Dan: "I want to tokenize" + Ahmad confirmation |
| FR-AD-058 | SRC-AD-CODE-001 | Built code (Acumatica health in integration status) |
| FR-AD-059 | SRC-AD-CODE-006 | Built code (Tabs navigation) |
| FR-AD-060 | SRC-AD-CODE-006 | Built code (tabAccess map) |
| FR-AD-061 | SRC-AD-CODE-006 | UX-AD-004 audit; built via router.push |

---

## 15. Later-Phase / Separate Decision Items

These items may still belong in the broader Pulse roadmap but will not be assumed as finalized by this PRD:

- Acumatica live sync and ERP-owned reference truth (price classes, item classes, ERP-owned distribution centers)
- barcode / SKU mapping administration
- mailbox / email ingestion configuration
- final payment-provider runtime configuration beyond today's manual tokenized-capture recording
- a deep per-user permission matrix if the fixed-role model proves insufficient
- advanced system-health dashboards, maintenance mode, geo / IP access controls, and temporary elevated access
- API-key management for external system integrations

---

## 16. Approval Checklist

Dynamic AQS approval of this PRD will confirm:

- the administration console scope and its permission gating are correct
- the fixed access-profile model (with Entra group mapping as the access lever) is the right approach for launch
- consolidating governed reference data into one admin home is the right direction
- the dealer-group rule workflow is framed correctly as built
- the configuration that must move under admin control before launch is identified
- the open questions capture the real business and security decisions still needed

### Module Status

- `Approved`
- `Approved with amendments`
- `Parked pending decision`
- `Needs rewrite`

### Notes

_To be completed during the review meeting._

---

## §UX-GAPS — Audit 2026-06-08

Gaps identified during a full platform UX/requirements audit. Organised by sprint priority.
All items with **Can do now = Yes** have no external dependency.

### Sprint 1 — Quick Wins (S effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-AD-001 | No confirmation modal before user deactivation | AdminWorkspace.tsx | Yes | Done (pendingDeactivateUser modal added) |
| UX-AD-002 | Live session count and last login missing from user list columns | AdminWorkspace.tsx | Yes | Done (activeSessionCount and lastLoginAt columns present) |
| UX-AD-003 | No per-role permission footprint detail view in roles tab | AdminWorkspace.tsx | Yes | Done (WorkbenchAdvancedSection expands full module+action list per role) |
| UX-AD-004 | AdminCatalogRulesWorkspace linkage from Admin nav unverified | AdminWorkspace.tsx | Yes | Done (router.push to /admin/catalog-rules in Business Rules action) |
| UX-AD-005 | Entra group-to-role mapping editor needs verification (free-text vs Select) | AdminEntraIntegrationPanel.tsx | Yes | Open |
| UX-AD-006 | Break-glass recovery procedure not documented in UI | AdminWorkspace.tsx | Yes | Open |

### Sprint 2 — Core Workflow (M effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-AD-007 | No reference data governance home (affinity groups, ownership groups, taxonomy) | AdminWorkspace.tsx | Yes | Done (Reference Data tab with AdminReferenceDataPanel) |
| UX-AD-008 | No routing threshold and SLA timer configuration screen | AdminWorkspace.tsx | Yes | Done (parked: POST /admin/routing-thresholds endpoint needed for writes) |
| UX-AD-009 | No system settings panel (company name, logo, timezone, currency) | AdminWorkspace.tsx | Yes | Done (parked: POST /admin/system-settings endpoint needed for writes) |
| UX-AD-010 | No feature-flag toggle list in configuration tab | AdminWorkspace.tsx | Yes | Done (parked: GET /admin/feature-flags + PATCH endpoint needed) |
| UX-AD-011 | Dealer-portal user type not selectable in create flow — only INTERNAL created | UserFormModal.tsx | Yes | Done (actorType selector added; DEALER kind wired in service) |
| UX-AD-012 | Audit activity tab missing CSV export | AdminWorkspace.tsx | Yes | Done (handleExportAuditCsv implemented) |

_To be completed during the review meeting._
