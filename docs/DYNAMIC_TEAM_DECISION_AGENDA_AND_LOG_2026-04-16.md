# Dynamic Team Decision Agenda And Log

Date: 2026-04-16

Purpose:
- run the next Dynamic AQS review as a decision session, not a generic walkthrough
- close business-rule gaps found in PRDs, meetings, and shared artifacts
- capture approvals and exceptions needed to move these modules to roughly 90% production readiness

Use together with:
- [/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/MODULE_HARDENING_PLAN_TO_90_PERCENT_2026-04-16.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/MODULE_HARDENING_PLAN_TO_90_PERCENT_2026-04-16.md)
- [/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/FOUNDATION_AUTH_USERS_PERMISSIONS_REQUIREMENTS_MAP_2026-04-16.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/FOUNDATION_AUTH_USERS_PERMISSIONS_REQUIREMENTS_MAP_2026-04-16.md)
- [/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/LEADS_REQUIREMENTS_MAP_2026-04-16.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/LEADS_REQUIREMENTS_MAP_2026-04-16.md)
- [/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TERRITORY_REQUIREMENTS_MAP_2026-04-16.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TERRITORY_REQUIREMENTS_MAP_2026-04-16.md)
- [/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TRAINING_REQUIREMENTS_MAP_2026-04-16.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/TRAINING_REQUIREMENTS_MAP_2026-04-16.md)
- [/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/CALENDAR_REQUIREMENTS_MAP_2026-04-16.md](/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/requirements-mapping/CALENDAR_REQUIREMENTS_MAP_2026-04-16.md)

## Desired Outcome

By the end of the meeting, we should have:
- approved decisions for the open business-rule gaps below
- named owners for anything still unresolved
- explicit park decisions for any item being deferred
- agreement on what counts as "done enough" for the current module wave

## Recommended Attendees

- Dynamic business owner
- Dynamic operations lead
- Dynamic territory / TM / RD stakeholder
- Dynamic training stakeholder
- Dynamic finance / compliance stakeholder for auth-sensitive and CIS-adjacent decisions
- implementation lead from our side

## Suggested Agenda Order

1. Foundation / Auth / Users / Permissions
2. Lead Management
3. Calendar
4. Territory Management
5. Training
6. Parked or follow-up-only items

This order is intentional:
- foundation decisions affect all later modules
- lead, calendar, territory, and training are the active hardening path

## Meeting Rules

- decide or park each item explicitly
- if the answer is "it depends", capture the exact condition
- if a rule varies by role, segment, or lifecycle stage, say that clearly
- if a current prototype behavior is only a wish, mark it as a wish and not a committed requirement

## Decision Log Template

Copy this table during the meeting and fill it live.

| Module | Decision Topic | Decision | Owner | Follow-up Needed | Target Date |
| --- | --- | --- | --- | --- | --- |
| Foundation |  |  |  |  |  |
| Leads |  |  |  |  |  |
| Calendar |  |  |  |  |  |
| Territory |  |  |  |  |  |
| Training |  |  |  |  |  |

## Module Questions

### 1. Foundation / Auth / Users / Permissions

Goal:
- close the identity, access, and admin-governance gaps that affect every other module

Questions to decide:
- Is internal staff auth officially `Microsoft Entra first`, with local login kept only as break-glass fallback?
  Why this matters: this decides whether internal identity is centrally governed or split between two long-term auth models.
- Does forgot/reset password apply only to local/dealer accounts, or also to some internal users?
  Why this matters: this controls whether password-reset features remain a real product requirement for staff workflows.
- What are the final session rules for:
  - idle timeout
  - absolute timeout
  - remember-me behavior
  Why this matters: this affects security posture, user friction, and session handling across web and mobile.
- Is MFA required for all internal users, or only certain roles?
  Why this matters: this changes both implementation scope and the minimum security baseline for rollout.
- Should failed login, denied action, and password-reset events always be audited?
  Why this matters: this determines our compliance/audit depth and the expected behavior for security investigations.
- What is the final internal role catalog we should treat as approved?
  Why this matters: role drift causes access bugs, UI confusion, and inconsistent admin behavior.
- Do we support:
  - pre-created internal users linked by email
  - group-mapped Entra auto-provisioning
  - both
  Why this matters: this defines how new staff enter the system and whether IT/admin work stays manual or becomes policy-driven.
- Do we need allowlist or approved-domain rules beyond Entra groups?
  Why this matters: this sets the outer security boundary for who may ever reach an internal Pulse role.
- What record-scope rules apply by role:
  - national visibility
  - territory visibility
  - finance-limited visibility
  - training-only visibility
  Why this matters: this controls the real-world information exposure model, not just route access.
- Which sensitive fields need masking from non-admin users?
  Why this matters: this protects finance/PII-heavy data even when a user can access the broader record.
- Which settings belong in:
  - global admin
  - module-level admin/settings
  - end-user preferences
  Why this matters: this keeps ownership clean and prevents settings from being scattered across the product.

Expected outputs:
- approved auth posture
- approved user/role model
- approved permission-scoping model
- password/reset applicability rules

### 2. Lead Management

Goal:
- close the operational and data-governance rules for the lead backbone

Questions to decide:
- For bulk import, what file formats are truly supported in phase 1:
  - CSV
  - XLSX
  - multiple sheet workbooks
  - anything else
  Why this matters: this sets the production boundary for what sales/ops can actually bring into Pulse without manual cleanup.
- Is the demo promise still correct that users can map arbitrary columns to Pulse target fields?
  Why this matters: this is a direct user expectation from demos and affects how flexible the import workbench must be.
- What duplicate outcomes are allowed during import and native intake:
  - create new
  - use existing
  - update existing
  - merge
  - route to review only
  Why this matters: this defines whether Pulse acts as a simple importer or a governed data-resolution system.
- What is the final routing basis when source data conflicts:
  - service tech count
  - truck count
  - install tech count
  Why this matters: this affects assignment, ownership, SLA, and all downstream reporting.
- Is discovery:
  - always required
  - conditionally skippable
  - skippable only by certain roles
  Why this matters: this controls the lead path into CIS/onboarding and removes ambiguity in the real workflow.
- How should homeowner / non-dealer leads be handled?
  Why this matters: meetings surfaced this as a real intake edge case that changes routing and qualification behavior.
- For native website forms, what fields are mandatory per site and what notifications must happen?
  Why this matters: these forms are replacing HubSpot, so field scope and notification behavior must be explicit.
- What is the final lead lifecycle after conversion:
  - active
  - at risk
  - inactive
  - churned
  - reopen
  Why this matters: lifecycle decisions affect analytics, customer handoff, reopen logic, and operational reporting.
- Are older Dynamics / HubSpot / spreadsheet active-lead migrations still required in the current wave?
  Why this matters: this determines whether historical clean-up/migration remains in current scope or becomes later backfill.
- Which mobile wishes are real requirements now versus later:
  - business card capture
  - badge OCR
  - field capture shortcuts
  Why this matters: this separates immediate production scope from future convenience/mobile enhancements.

Expected outputs:
- approved import + dedupe rule set
- approved routing basis
- approved lifecycle model
- approved native-form field policy

### 3. Calendar

Goal:
- finalize what the centralized Pulse calendar must own now, and what Outlook only reflects

Questions to decide:
- Which event families must appear in the centralized calendar now:
  - discovery
  - training
  - visits
  - audits
  - anything else
  Why this matters: this defines whether calendar is just a visibility layer or a true operational scheduling surface.
- Is the centralized calendar only a launch point into owning workflows, or can it directly create/edit certain event families?
  Why this matters: this changes both UX complexity and where workflow truth is allowed to live.
- Are month, week, and list all required at launch?
  Why this matters: meetings repeatedly highlighted weekly and manager visibility needs, so view parity matters.
- Is Outlook sync:
  - Pulse to Outlook only
  - later bi-directional
  Why this matters: this prevents us from overbuilding sync before the business actually wants Outlook to become interactive.
- Do we support shared calendars in phase 1?
  Why this matters: this changes provider permissions, rollout policy, and support complexity.
- What is the meeting-link policy:
  - none
  - Teams only
  - WebEx only
  - mixed by event type
  Why this matters: this determines what kind of meeting objects Pulse should create and what provider setup is required.
- Who can manage:
  - pilot rollout
  - shared calendar enablement
  - default meeting provider
  - auto-sync settings
  Why this matters: this sets admin ownership for the integration and keeps rollout changes governed.
- Are reminders/notifications expected from Pulse, Outlook, or both?
  Why this matters: this avoids duplicate notifications and clarifies which system users should trust.
- Should consignment audits and site visits be scheduled from calendar directly, or launched from their owning workflow?
  Why this matters: this affects how much direct scheduling power the calendar module should own.

Expected outputs:
- approved event-family scope
- approved Outlook scope
- approved meeting-link policy
- approved admin ownership for integration settings

### 4. Territory Management

Goal:
- close the real ownership and propagation rules behind map, routing, and visibility

Questions to decide:
- What is the final source of truth for territory ownership:
  - state-based
  - state plus overrides
  - something more granular
  Why this matters: this is the core rule that drives routing, reporting, visibility, and reassignment.
- What is the exact rule for Strategic Growth precedence?
  Why this matters: meetings suggested exceptions here, and we should not guess a national override policy.
- How visible should TM ownership be before first order?
  Why this matters: this changes lead visibility and early account ownership expectations.
- Should territory truth remain account-level only, or can locations differ?
  Why this matters: this affects propagation design and whether one customer can split ownership by site.
- Who is allowed to override territory assignments, and what reason is required?
  Why this matters: this determines governance, auditability, and how much manual correction ops may perform.
- How much prototype map parity is actually required now:
  - state overlays
  - ZIP/county
  - custom polygons
  - route planning
  Why this matters: this separates the required operational map from future GIS/optimization ambitions.
- Which shipping-center or warehouse overlays are required?
  Why this matters: meetings and shared maps showed real operational alignment to shipping centers, not just decorative geography.
- What reporting is required now:
  - load
  - gaps
  - unassigned
  - reassignments
  - exception views
  Why this matters: this sets the minimum territory command-center value before we chase advanced map work.
- What route planning / optimization behavior is a real requirement now versus a later provider-dependent phase?
  Why this matters: this keeps us from treating “route planning wish” as “immediate production dependency.”

Expected outputs:
- approved ownership rules
- approved override model
- approved propagation depth
- approved map/reporting scope

### 5. Training

Goal:
- lock the business rules that define training as an operational system, not just a scheduler

Questions to decide:
- Who governs training catalog creation and change approval?
  Why this matters: this decides whether training data is centrally controlled or can drift through ad hoc updates.
- Which session types require:
  - named attendance
  - attendee counts only
  - proof
  - certification decision
  Why this matters: this separates normal training from higher-governance certification flows.
- What exactly constitutes a certification:
  - issuance
  - active status
  - expiry
  - renewal
  - approval authority
  Why this matters: this determines the lifecycle and compliance weight of certification records.
- What cadence and overdue rules apply by training type?
  Why this matters: this drives reminders, dashboard exceptions, and account readiness expectations.
- What is the exact reporting split between:
  - training
  - site visit
  - certification
  Why this matters: this avoids inflating training metrics with non-training operational touches.
- Do contest / giveaway / promo value items belong inside training records?
  Why this matters: meetings suggested these adjacent wishes, but we need to know if they are truly part of training scope.
- What dashboards and exception reports are mandatory:
  - hours by state
  - overdue accounts
  - overdue certifications
  - trainer workload
  - account exception reporting
  Why this matters: reporting is one of the strongest reasons this module exists, so the must-have outputs should be explicit.
- Which commercial-ready fields or tracks need to exist now, even if commercial rollout is later?
  Why this matters: this lets us stay commercial-ready without overbuilding commercial-specific workflows too early.
- Which mobile requirements are mandatory now:
  - check-in
  - check-out
  - required notes
  - voice-to-text
  - next-session scheduling
  - proof capture
  Why this matters: training execution is tightly tied to the later mobile app, so these must be treated as foundation decisions.

Expected outputs:
- approved catalog governance
- approved certification rules
- approved cadence and reporting model
- approved mobile-first execution rules

## Parking Lot

Use this section for items that are important, but not required to keep the current module wave moving.

| Module | Parked Item | Why Parked | Revisit Trigger |
| --- | --- | --- | --- |
| Foundation |  |  |  |
| Leads |  |  |  |
| Calendar |  |  |  |
| Territory |  |  |  |
| Training |  |  |  |

## Recommended Close-Out Summary

End the meeting by confirming:
- what was approved
- what remains open
- what is parked
- what changes we should implement next
- what should be updated in source-of-truth docs after the meeting
