# Pulse Platform — Admin, Master Data & Configuration Module PRD

## 1. Document Control

| Field | Value |
|---|---|
| Version | 1.0 |
| Date | 2026-06-07 |
| Status | Scope confirmation draft for Dynamic AQS review |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS IT / security lead, operations lead, data stewardship owner, Strategic Growth representative, Super Admin / implementation lead |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, Leads PRD, Territory PRD, Training PRD, Product Management PRD |

---

## 2. Executive Summary

The Admin, Master Data & Configuration module is the control room that every other Pulse module trusts. It is where system administrators and data stewards manage who can sign in, what access each person carries, which governed reference values the business runs on, how dealer-group visibility is decided, and which integrations are healthy. Today Pulse already ships a permission-gated admin console for user and access management, a separate guided wizard for dealer catalog (dealer-group) rules, and a one-area-at-a-time integration setup surface. This PRD specs that built state honestly and names the gaps that must close before admin can be the single, dependable home for configuration: reference data is still scattered across the Leads, Territory, and Product workspaces; access is governed by a fixed role catalog with only one tunable lever; and several operational settings (routing thresholds, SLA timers, company branding, feature flags) have no admin screen yet. The goal of this module is to give Dynamic AQS one governed, auditable place to run the platform — not engineering tickets, spreadsheets, and raw configuration strings.

---

## 3. Module Objective

Pulse will provide a single administration and configuration system that will:

- manage internal and dealer-portal user accounts through their full lifecycle
- present a clear, role-based access model and the one approved lever to tune it
- govern the business reference data that downstream modules depend on, from one home
- resolve dealer-group visibility through a safe draft → preview → publish rule workflow
- expose operational configuration (routing, SLA timing, system settings, feature flags) to authorized admins instead of engineering
- show integration health and policy at a glance and keep sensitive boundaries enforced
- keep every administrative and access change auditable and reviewable

---

## 4. Scope Statement

### 4.1 Pulse Will Support

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

### 4.2 This PRD Will Also Cover

- how Pulse will move scattered reference-data CRUD into one governed admin home without breaking the workspaces that read it
- how access will be tuned given a fixed role catalog, and whether per-user permission overrides are needed at all
- how administrators will provision dealer-portal users as part of the user-create flow
- which configuration that lives in code or environment variables today must become admin-managed before launch
- what Dynamic AQS needs to confirm before the admin and configuration scope is locked

### 4.3 Later-Phase / Separate Decision Items

These items remain part of the broader Pulse vision but require later approval or a separate dependency decision:

- Acumatica live sync and ERP-owned reference truth (price classes, item classes, and distribution centers where ERP is the system of record)
- barcode / SKU mapping administration
- mailbox / email ingestion configuration
- final payment-provider runtime configuration (current build records tokenized capture outcomes manually; live provider runtime is parked)
- a deep per-user permission matrix, if Dynamic AQS confirms the fixed-role model is sufficient
- advanced system-health, maintenance-mode, and break-glass tooling beyond the audit monitor and integration health views

---

## 5. Primary Future-State User Journeys

### 5.1 Journey A — Administrator Onboards A New Internal User

1. An admin opens the Users & Access area of the admin console.
2. The admin adds the user with name, email, and a single access profile (role).
3. Pulse aligns the internal account to Microsoft Entra sign-in and confirms the welcome / activation path.
4. The new user appears in the list with status, last login, and live-session count.
5. The change is written to the audit trail with actor, timestamp, and what changed.

### 5.2 Journey B — Administrator Provisions A Dealer-Portal User

1. From the user-create flow, the admin selects the dealer-portal user type.
2. The admin sets the dealer's email, an initial password path, and the dealer role bounded to their own company.
3. Pulse triggers a welcome email with sign-in instructions.
4. The dealer account is isolated to its own company context and recorded in the audit trail.

### 5.3 Journey C — Data Steward Updates Governed Reference Data

1. A steward opens the Reference Data home in admin and selects a list (for example, affinity groups or ownership / PE groups).
2. The steward adds, edits, or deactivates an entry, or imports a refreshed CSV / XLSX batch with preview and validation.
3. Pulse validates codes and required fields and records a change-history entry (who, when, old / new values).
4. Downstream modules — Leads, Territory, Product, dealer-group rules — immediately read the governed values without re-entry.

### 5.4 Journey D — Administrator Publishes Dealer-Group Visibility Rules

1. An admin opens the Dealer Group Rules workspace and drafts rules from approved conditions (affinity group, ownership / PE, region, portal-eligible, independent).
2. The admin saves the draft and runs a preview that samples real accounts and shows matched, needs-review, and unmatched counts plus affected products and files.
3. Pulse blocks publish while any sampled account is unmatched or needs review, or while the preview is stale.
4. When the preview is clean, the admin publishes; Pulse re-runs the full account check, activates the rule set, and retires the prior version.

### 5.5 Journey E — Administrator Tunes Access For A Person

1. An admin reviews the access-profile catalog and confirms the right profile for a user.
2. If access must be adjusted, the admin changes the user's assigned profile rather than hand-editing individual permissions.
3. For Microsoft sign-in, the admin maps the correct Entra group to a Pulse role using the group picker and role select.
4. Pulse records the access change in the audit trail; per-user permission overrides are applied only if Dynamic AQS confirms that lever is in scope.

### 5.6 Journey F — Administrator Configures Routing And Response Timing

1. An admin opens routing and SLA configuration in admin.
2. The admin sets the routing basis and threshold (for example, the service-tech / truck-count split), state → owner mapping, and Strategic Growth pool membership.
3. The admin sets response-timer durations per event type (initial contact, finance review, and similar).
4. Leads and Calendar apply the configured values without an engineering deployment, and the change is audited.

### 5.7 Journey G — Administrator Reviews Integration Health And Audit Evidence

1. An admin opens the integration overview and sees Entra access, Outlook calendar, payment boundary, and lead-alert delivery health together.
2. The admin opens a provider to adjust policy or run operational actions (for example, retry failed lead-alert deliveries or adjust quiet hours).
3. The admin opens the audit monitor, filters by user, entity, action, or date range, and exports the result for review.
4. Sensitive boundaries (no raw payment-card data, dealer isolation) remain enforced throughout.

---

## 6. Functional Capabilities

### 6.1 User Lifecycle Management

Pulse will:

- list users with name, email, access profile, status, last login, and live-session count
- support search, role and status filters, and pagination
- add and edit users, reset passwords, and activate or deactivate without losing historical references
- bulk-import users with validation and a per-row success / failure summary
- provision internal users aligned to Microsoft Entra sign-in and dealer-portal users with an initial credential and welcome-email path

### 6.2 Access Profiles And Access Tuning

Pulse will:

- present access profiles (roles) with each profile's module footprint, typical capabilities, and scope summary
- assign exactly one clear access profile per user and keep exceptions rare
- treat the role catalog as a fixed set of nine assignable internal profiles plus the external dealer-portal profile (read-only in the UI today)
- provide a Microsoft Entra group → role mapping editor using a group reference and a role select, replacing raw `groupId=ROLE` string entry
- support per-user permission overrides only if Dynamic AQS confirms the fixed-role model is insufficient (see Open Questions)

### 6.3 Reference Data Governance (Single Home)

Pulse will:

- consolidate governed reference-data management into one admin home, including affinity groups, ownership / PE groups, territory regions, product taxonomy, activity types, and related governed lists
- support add, edit, deactivate, and reorder for each list with code, name, status, sort order, and notes
- support CSV / XLSX import with header mapping, validation, and preview, plus export
- record change history (who, when, old / new values) for every reference-data change
- keep the workspaces that currently own these values (Leads website forms, Territory management, Product management) reading from the same governed source, so consolidation does not break downstream use

### 6.4 Dealer-Group Rule Engine

Pulse will:

- provide a draft → preview → publish wizard for dealer-group (dealer catalog) visibility rules
- build rules from approved conditions: affinity group, ownership / PE, region, portal-eligible, and independent
- preview rule outcomes against sampled accounts with matched, needs-review, and unmatched counts and affected product / file impact
- enforce publish gates: a saved draft, a fresh (non-stale) preview, and zero unmatched or review-required sampled accounts
- re-run the full account check on publish, activate the new rule set, retire the prior version, and keep version history

### 6.5 Operational Configuration

Pulse will:

- expose routing-rule configuration (routing basis and threshold, state → owner mapping, Strategic Growth pool membership)
- expose SLA-threshold configuration (response-timer durations per event type)
- expose system settings: company name, logo, timezone, date format, and currency defaults
- expose feature-flag administration to enable or disable capabilities without a deployment
- apply configuration changes without an engineering deployment and write them to the audit trail

### 6.6 Audit And Activity Monitor

Pulse will:

- record administrative and authentication events (user, action, entity, timestamp, summary)
- provide an audit monitor that supports filtering by user, entity type, action type, and date range
- support exporting audit results
- keep audit entries non-editable so historical evidence stays trustworthy

### 6.7 Integration Oversight

Pulse will:

- show Entra access, Outlook calendar, payment boundary, and lead-alert delivery health together in one overview
- provide per-provider policy controls and operational actions (for example, lead-alert retry, dead-letter, quiet-hours, and recipient management)
- keep integration management permission-gated and separate from view-only access
- enforce sensitive boundaries: tokenized payment capture only, no raw card data in Pulse, and dealer-company isolation

### 6.8 Navigation And Information Architecture

Pulse will:

- present every admin surface (users, access profiles, reference data, dealer-group rules, configuration, audit, integrations) through one consistent navigation model
- replace today's mixed navigation behavior (in-tab switching, link navigation, and full-page reloads) with a single, predictable information architecture
- keep each surface permission-gated so users only see areas their access profile allows

---

## 7. Business Rules Pulse Will Enforce

| # | Rule |
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

---

## 8. Data And Integration Highlights

At business level, this module will depend on and feed the following:

| Area | Proposed Pulse Role |
|---|---|
| Microsoft Entra ID | Pulse will align internal sign-in and map approved Entra groups to Pulse roles through a governed editor |
| Leads | Pulse will supply governed affinity / ownership reference data, routing rules, and SLA timers the Leads module consumes |
| Territory | Pulse will govern region reference data and state → owner mapping used for routing and coverage |
| Product Management | Pulse will govern product taxonomy and feed dealer-group visibility resolution |
| Dealer Portal | Pulse will provision and isolate dealer-portal users and resolve their catalog through dealer-group rules |
| Calendar | Pulse will supply SLA / response-timer configuration that calendar and reminder behavior respect |
| Payments / CIS | Pulse will surface the payment integration boundary while keeping raw card data out of Pulse |
| Acumatica (parked) | Pulse will later defer ERP-owned reference truth (price classes, item classes, ERP-owned distribution centers) to Acumatica |
| Reporting / Audit | Pulse will feed administrative, access, and configuration change history into auditable reporting |

---

## 9. Assumptions To Confirm

| # | Assumption | Why It Matters |
|---|---|---|
| A-AD-01 | The fixed catalog of access profiles (nine assignable internal roles plus the dealer-portal role) is sufficient for launch, with per-user overrides treated as a later decision. | This determines whether Pulse builds a profile-assignment model or a full per-user permission matrix. |
| A-AD-02 | Microsoft Entra group → role mapping is the primary approved lever for tuning internal access. | This sets where access governance happens and how the mapping editor is designed. |
| A-AD-03 | Governed reference data should be consolidated into one admin home while downstream workspaces keep reading the same values. | This affects migration sequencing so consolidation does not disrupt Leads, Territory, or Product workflows. |
| A-AD-04 | Routing thresholds, SLA timers, system settings, and feature flags should be admin-managed rather than code- or environment-owned. | This determines how much configuration moves out of engineering control before launch. |
| A-AD-05 | Dealer-portal user provisioning (initial credential plus welcome email) belongs inside the admin user-create flow. | This affects onboarding completeness and whether dealer setup needs a separate path. |
| A-AD-06 | Delegated (non-engineering) admins can perform user, access, and reference-data corrections within an approved boundary. | This sets who can safely operate the console without engineering support. |
| A-AD-07 | ERP-owned reference values will become read-only in Pulse once Acumatica is the system of record. | This affects which reference lists Pulse owns versus mirrors, and how stewardship behaves over time. |

---

## 10. Open Questions For Dynamic AQS Decision

| # | Question | Options To Confirm | Why Decision Is Needed |
|---|---|---|---|
| Q-AD-01 | Is the fixed nine-role profile model sufficient, or are per-user permission overrides required? | fixed profiles only / profiles plus rare overrides / full per-user matrix | This is the single biggest scope driver for the access model. |
| Q-AD-02 | Which named leaders receive delegated admin authority at launch, and what actions are in or out of scope? | Super Admin only / named delegated admins / role-based admin tiers | Required for safe admin setup and operational support boundaries. |
| Q-AD-03 | Which reference lists does Pulse own as source of truth versus mirror from Acumatica? | Pulse-owned / ERP-owned mirrored read-only / hybrid by list | This determines edit rights, stewardship, and sync direction per list. |
| Q-AD-04 | What is the approved routing basis and SLA timer set that admins will configure? | service-tech count / truck count / other; timer durations per event | Pulse should not lock routing or escalation behavior on an incorrect basis. |
| Q-AD-05 | Should reference-data and configuration changes require a reason or approval step for sensitive lists? | no reason / reason required / approval gate for sensitive changes | This affects audit depth and change-control friction. |
| Q-AD-06 | What is the approved dealer-portal user provisioning policy (initial password and welcome email)? | admin-set password / self-set via email link / mixed | This changes the user-create flow and dealer onboarding security. |
| Q-AD-07 | Which configuration must be admin-managed at launch versus acceptable as environment-owned initially? | all admin-managed / phased / minimum viable set | This scopes how much configuration tooling is needed for go-live. |
| Q-AD-08 | What is the break-glass procedure if Microsoft Entra sign-in is unavailable, and who owns it? | local fallback admin / IT-owned recovery / no fallback | Required for operational resilience of the admin console itself. |

---

## 11. Later-Phase / Separate Decision Items

These items may still belong in the broader Pulse roadmap but will not be assumed as finalized by this PRD:

- Acumatica live sync and ERP-owned reference truth (price classes, item classes, ERP-owned distribution centers)
- barcode / SKU mapping administration
- mailbox / email ingestion configuration
- final payment-provider runtime configuration beyond today's manual tokenized-capture recording
- a deep per-user permission matrix if the fixed-role model proves insufficient
- advanced system-health dashboards, maintenance mode, geo / IP access controls, and temporary elevated access
- API-key management for external system integrations

---

## 12. Approval Checklist

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
| UX-AD-001 | No confirmation modal before user deactivation | AdminWorkspace.tsx | Yes | Open |
| UX-AD-002 | Live session count and last login missing from user list columns | AdminWorkspace.tsx | Yes | Open |
| UX-AD-003 | No per-role permission footprint detail view in roles tab | AdminWorkspace.tsx | Yes | Open |
| UX-AD-004 | AdminCatalogRulesWorkspace linkage from Admin nav unverified | AdminWorkspace.tsx | Yes | Open |
| UX-AD-005 | Entra group-to-role mapping editor needs verification (free-text vs Select) | AdminEntraIntegrationPanel.tsx | Yes | Open |
| UX-AD-006 | Break-glass recovery procedure not documented in UI | AdminWorkspace.tsx | Yes | Open |

### Sprint 2 — Core Workflow (M effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-AD-007 | No reference data governance home (affinity groups, ownership groups, taxonomy) | AdminWorkspace.tsx | Yes | Open |
| UX-AD-008 | No routing threshold and SLA timer configuration screen | AdminWorkspace.tsx | Yes | Open |
| UX-AD-009 | No system settings panel (company name, logo, timezone, currency) | AdminWorkspace.tsx | Yes | Open |
| UX-AD-010 | No feature-flag toggle list in configuration tab | AdminWorkspace.tsx | Yes | Open |
| UX-AD-011 | Dealer-portal user type not selectable in create flow — only INTERNAL created | UserFormModal.tsx | Yes | Open |
| UX-AD-012 | Audit activity tab missing CSV export | AdminWorkspace.tsx | Yes | Open |

_To be completed during the review meeting._
