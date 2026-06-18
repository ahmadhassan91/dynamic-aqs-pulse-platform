# Training Module PRD

## Document Control

| Field | Value |
|---|---|
| Module | Training |
| Document Type | Master PRD |
| Version | 3.1 |
| Status | Draft — enrichment pass complete (traceability closure + build status); scope corrections applied 2026-06-18 (completion-proof gating reclassified OPTIONAL; cert lifecycle + reward linkage demoted to vendor-proposed) |
| Owner | Product / Training Operations |
| Sprint Sequence | Seq 03–04 |
| Priority | P1 |
| Date | 2026-06-09 |
| Meeting Traceability | Session 1 (16 Feb 2026), Session 9 (13 Mar 2026), Training Discovery Validation (14 Apr 2026), April 20 scope review |
| Primary Companion Docs | `TRAINING_DISCOVERY_VALIDATION_2026-04-14.md`, Leads PRD, Territory PRD, Calendar PRD |

---

## Scope corrections (2026-06-18)

A program-wide scope-accuracy re-check (client-attributed / "confirmed" requirements verified against the actual cited meeting transcripts) found the following over-attributions in this module. None of these change what is already built; they make the PRD honest before scope-lock.

- **🔴 HIGH — mandatory completion proof/outcome gating (FR-TRN-031, FR-TRN-040) is CONTRADICTED.** The client did not ask for mandatory proof/evaluation gating on session completion. Curry, Session 4: *"I think it would just be completed … we're not doing any kind of evaluations."* The cited SRC-TRN-001 line ("we want [the app] to eliminate excuses for entering data") was about navigation friction, not proof gating. **Correction:** completion proof/outcome is OPTIONAL (vendor-proposed configurable rigor); the SRC-TRN-001 citation no longer supports a *mandatory* proof requirement.

- **🟠 MEDIUM — certification lifecycle (FR-TRN-053 / FR-TRN-054 expiry/recert/revocation) + reward linkage (FR-TRN-055) were not client-confirmed.** The client confirmed only the two certification *names* plus completion *tracking*. The lifecycle was *"that'd be nice" / "if it ties to our training website"* and Don: *"I got to think that one over";* rewards were deferred — Michelle: *"when we start playing with it, that's when we'll be able to better describe … what we might want."* Certifications may remain on the external training site that "may go away." **Correction:** keep cert names + completion tracking; lifecycle/recert/revocation and reward-linkage are demoted to vendor-proposed, pending OQ-TRN-001/005/008.

- **🟡 LOW — the "~16 hours/year double-entry" figure is a vendor estimate, not a client metric.** Curry questioned it (Session 5: *"that's … hard to quantify"*). **Correction:** wherever this Training + Calendar figure is cited, label it "vendor-estimated." (The figure is not stated numerically in this PRD; the label applies to the cross-module Calendar reference.)

Full audit: `docs/SCOPE_ACCURACY_AUDIT_2026-06-18.md`.

---

## 1. Meeting Traceability Header

| Session | Date | Participants | Key Training Topics |
|---|---|---|---|
| Session 1 — Discovery | 16 Feb 2026 | C.G. (Curry), Ahmad Hassan, Muhammad Majid, Don Hearn, Dan Harshbarger, Michelle Hogan, Adrienne Cardinale | Training scheduling + execution as core MVP requirement; lack of centralized dashboard; Map My Customer as field tool to replace; mobile check-in, voice-to-text, scheduling, completion tracking; no centralized training visibility for leadership; Outlook integration requirement; certification concept seeded by Don Hearn and Michelle Hogan |
| Session 9 — Lead to Dealer Onboarding | 13 Mar 2026 | C.G., Ahmad Hassan, Don Hearn, Dan Harshbarger, Michelle Hogan, Adrienne Cardinale, Samantha Marks | Training scheduling from calendar; training vs site-visit distinction; week/month/list calendar views; trainer availability; Outlook two-way sync; training management view with filters; IQ certification curriculum + product installation certification confirmed by Don Hearn; certification completion + giveaway / demo unit reward linkage; coaching view with overdue and upcoming sessions; territory manager assignment; account + training tab confirmed |
| Training Discovery Validation | 14 Apr 2026 | Pulse delivery team (internal) | First-order / customer-activation trigger confirmed; initial onboarding sequence is three live technical sessions; ongoing TM-led cadence; Pulse-first scheduling with Outlook sync; structured records, attendance, notes, proofs, overdue logic, reporting in scope; parked items defined |

---

## 2. Source Inventory

| Source ID | Artifact (Absolute Path) | What It Sourced |
|---|---|---|
| SRC-TRN-001 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/Discovery Session 1 - 16th Feb 2026.md` | Core pain points: no centralized training dashboard, no Outlook integration, CRM adoption at 15-20% because of UX; training scheduling + execution + completion tracking as MVP items; mobile check-in, voice-to-text, photo upload, offline capability; leadership visibility requirement; certification concept introduced (Don Hearn, Michelle Hogan) |
| SRC-TRN-002 | `/Users/clustox1/Documents/Currie/dynamic-aqs-crm/Meetings/13th March Discovery Session 9.md` | Training scheduling from territory/calendar screen; week-view calendar requirement (Don Hearn); trainer availability management; Outlook two-way sync; auto-generate Teams invite; IQ certification curriculum + product-installation certification names (Don Hearn); gift-card / demo-unit reward on certification completion; coaching view (upcoming, overdue, follow-ups); territory manager assignment; training tab in account view; training management view with charts and filters |
| SRC-TRN-003 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/docs/TRAINING_DISCOVERY_VALIDATION_2026-04-14.md` | Validated direction: account-centric, first-order trigger, three-session onboarding, ongoing TM-led cadence, Pulse-first with Outlook sync; parked items: final Outlook/Graph wiring, Teams/WebEx-specific creation, external training-site coexistence, revenue-lift ROI |
| SRC-TRN-004 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/training/service.ts` | Built service operations, catalog seed (categories, types, templates, cadence policies), account training programs, session lifecycle (check-in/complete/cancel/reschedule), proof upload/review/download, certifications (issue/revoke/decision), follow-up tasks, coaching workload, recertification queue, compliance report, territory penetration |
| SRC-TRN-005 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/api/src/modules/training/http.ts` | Wired HTTP routes: overview, catalog, ops queue, recertification, coaching, territory-penetration, reporting, trainers, sessions, account-level programs + sessions, check-in, complete, cancel, reschedule, proof upload/review/download, certification decision, follow-up tasks, revoke certification |
| SRC-TRN-006 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/training/TrainingWorkspace.tsx` | Primary training workspace UI; tabs: Accounts, Sessions, Ops Queue, Recertification, Coaching, Reporting, Catalog |
| SRC-TRN-007 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/training/TrainingSessionSchedulerModal.tsx` | Session scheduling modal |
| SRC-TRN-008 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/training/TrainingSessionExecutionModal.tsx` | Session execution (check-in, complete, proof) modal |
| SRC-TRN-009 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/training/TrainingCertificationOpsModal.tsx` | Certification issuance/revocation/decision modal |
| SRC-TRN-010 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/training/CustomerTrainingHistory.tsx` | Account-level training history component |
| SRC-TRN-011 | `/Users/clustox1/Documents/Currie/dynamic-aqs-pulse-platform/apps/crm-web/src/components/training/TrainingBulkScheduleModal.tsx` | Bulk session scheduling modal |

---

## 3. Overview

### 3.1 Problem Statement (Current State)

- Training is tracked via Outlook calendars, individual TM habits, spreadsheets, and external website references — no single source of truth.
- No centralized dashboard: executives and VPs cannot see training volume, overdue accounts, or certification posture in a holistic view.
- TMs use Map My Customer for field activity; training sessions logged there do not appear as training records in the CRM — only as generic notes.
- No unified calendar with blind spots on trainer schedules.
- No Outlook integration to sync training schedules.
- Certification completion tracked manually: Don Hearn collects certification screenshots throughout the week and submits on Fridays.
- Giveaway / demo-unit rewards tied to certification completion are tracked outside the system.

**Sources:** SRC-TRN-001 (Curry: "no centralized dashboard where executives can see… how many trainings did we do"), SRC-TRN-001 (Curry: "they'll do a training and they'll put notes in there and it won't identify in the CRM that a training was done"), SRC-TRN-002 (Don Hearn: "the scheduling in the emails, if you could just do that all in one application, that's so much easier").

### 3.2 Target State

- Pulse is the single operational record of all training activity, anchored to customer accounts and territory ownership.
- Training Ops governs a structured catalog of categories, types, templates, and cadence policies.
- TMs and RDs schedule, execute, and complete training sessions from web and mobile with Outlook reflection.
- Certification-capable sessions issue, renew, expire, and revoke certification records with governance controls.
- Leadership and Operations see training penetration, overdue accounts, and certification posture in real time.
- The existing external training and certification website continues to coexist; full replacement or import rules are a later-phase decision.

### 3.3 In-Scope

- Admin-managed training catalog: categories, types, templates, cadence rules, proof requirements, trainer records
- Account-linked training programs: onboarding sequence and ongoing cadence
- Session scheduling (create, reschedule, cancel) with trainer, mode, date/time, Outlook sync
- Session execution: check-in, completion, attendance/attendee count, notes, follow-up tasks
- Proof capture and evidence storage by training type
- Certification-capable training types: issue, pending-decision, active, expiring, expired, renewed, revoked states
- Recertification queue and renewal workflow
- TM / RD coaching workload view
- Territory training-penetration reporting and regional rollup
- Compliance reporting: cadence, completion, exceptions, certification posture, training hours
- Mobile-ready field execution patterns
- Offline-ready execution where connectivity may not be reliable (sync on reconnect)
- Calendar integration with centralized calendar view and Outlook reflection
- Training vs site-visit distinction in execution and reporting

### 3.4 Out-of-Scope (This Phase)

- Final Outlook / Microsoft Graph integration wiring (parked behind credentials/prerequisites)
- Teams / WebEx provider-specific meeting creation API wiring
- External training-site content import or full LMS replacement
- Revenue-lift and sales-attribution ROI analytics
- Dealer-facing self-service training experiences
- Advanced trainer-capacity optimization
- Extended commercial curriculum beyond the confirmed first phase

### 3.5 Parked Dependencies

| Item | Blocker |
|---|---|
| Outlook calendar two-way sync (write side) | Microsoft Graph credentials and tenant configuration |
| Auto-generate Teams meeting link on scheduling | Microsoft Graph / Teams API prerequisites |
| External training-site coexistence rules | Decision on replacement vs reference-only |
| Revenue-lift and ROI reporting | ERP/reporting maturity and sales-attribution model |

---

## 4. Functional Requirements

### 4.1 Catalog and Governance

| ID | Statement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-TRN-001 | The system shall support admin-managed training categories with a kind (ONBOARDING, PRODUCT, TECHNICAL, SALES, COMPLIANCE, CERTIFICATION, CUSTOM, VISIT), code, name, description, sort order, and active flag. | Training Ops can create, update, and deactivate categories; retired categories remain visible on prior sessions; seeded defaults load automatically on first use. | P0 | SRC-TRN-001, SRC-TRN-004 | Built |
| FR-TRN-002 | The system shall support admin-managed training types linked to a category, with delivery mode (VIRTUAL, ON_SITE, HYBRID, PHONE, VISIT, CUSTOM), default duration, certification-track flag, hours-count flag, customer-facing flag, and segment scope. | Training Ops can create and update types; type catalog is consistently available for scheduling and reporting; types include the seeded IQ certification curriculum and product-installation certification tracks confirmed by Don Hearn. | P0 | SRC-TRN-002, SRC-TRN-004 | Built |
| FR-TRN-003 | The system shall support admin-managed training templates per type, with proof requirement (NOTES_ONLY, ATTENDANCE_AND_NOTES, PHOTO_REQUIRED, CERTIFICATE_REQUIRED), prerequisite summary, and materials summary. | Each type has at least one default template; certification-track types default to CERTIFICATE_REQUIRED; visit types default to NOTES_ONLY; Training Ops can add custom templates. | P0 | SRC-TRN-001, SRC-TRN-004 | Built |
| FR-TRN-004 | The system shall support configurable cadence policies per training type, defining cadence days, required flag, and optional segment scope. | Overdue logic uses the cadence policy values; onboarding types default to 30-day cadence; most ongoing types default to 180 days; cadence is configurable by Training Ops rather than hard-coded. | P0 | SRC-TRN-001 (Curry: "we want configurable cadence rules rather than hard-coded timing"), SRC-TRN-003, SRC-TRN-004 | Built |
| FR-TRN-005 | The system shall support a trainer roster — users with TRAINING_OPS, TERRITORY_MANAGER, or REGIONAL_DIRECTOR roles are eligible trainers; their availability context is manageable by Training Ops. | `/api/v1/training/trainers` returns eligible trainers; trainer can be selected when scheduling a session; availability notes are visible in the scheduler. | P1 | SRC-TRN-002 (Ahmad + Curry: "we have this trainers here as well and we have their availability"), SRC-TRN-004 | Built |
| FR-TRN-006 | When a user schedules a training session, the system shall display the last-sync timestamp of trainer availability from Outlook and warn the user if the data is stale. | Stale-sync warning appears when Outlook last-sync is older than a configurable threshold; user can proceed with manual knowledge; session is not blocked. | P2 | SRC-TRN-002, SRC-TRN-003 | Partial (API ready; Outlook read-side parked behind Graph credentials) |

### 4.2 Account-Centric Programs

| ID | Statement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-TRN-010 | The system shall anchor training programs and sessions to the customer account record; TM and RD ownership shall follow the account and territory truth. | All training sessions are queryable by account; coaching workload and reports filter by territory ownership; a session cannot exist without an account. | P0 | SRC-TRN-001, SRC-TRN-002, SRC-TRN-003 | Built |
| FR-TRN-011 | The system shall support account training programs that define a training type, cadence, required flag, and status (NOT_STARTED, ACTIVE, OVERDUE, COMPLETED, PAUSED, CLOSED). | Creating a program calculates nextDueAt from cadence; overdue programs appear in the ops queue; account training history shows all programs and their status. | P0 | SRC-TRN-001, SRC-TRN-004 | Built |
| FR-TRN-012 | When a customer account is activated (first order placed), the system shall initiate or allow initiation of the account's onboarding training program according to the approved onboarding model. | Onboarding training program can be created from the account activation workflow; the program carries trainingType = onboarding category, cadenceDays = 30, isRequired = true; the action is surfaced from the account detail. | P0 | SRC-TRN-003 (validated direction: first-order trigger), SRC-TRN-002 | Partial (API built; UX-T-005 — no initiation action from account activation — marked Done in UX-GAPS) |
| FR-TRN-013 | The system shall distinguish onboarding training programs from ongoing customer-development training programs and surface this distinction in account history and reporting. | Account training history tab shows program category kind; onboarding programs are clearly labelled; ops queue can be filtered by program type. | P1 | SRC-TRN-003 (validated direction: initial three-session onboarding + ongoing cadence), SRC-TRN-004 | Built |
| FR-TRN-014 | The system shall show TM and RD their assigned account training obligations, including what is required, what is scheduled, what is overdue, and what is still missing. | Coaching workload view groups sessions and programs by territory ownership; overdue count is surfaced as a KPI; accounts with no programs and active status are visible. | P0 | SRC-TRN-001, SRC-TRN-002 | Built |

### 4.3 Scheduling and Calendar

| ID | Statement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-TRN-020 | The system shall support creating, rescheduling, and cancelling training sessions against an account, with training type, trainer, delivery mode, date, time, duration, attendee notes, and meeting link. | Session is created in SCHEDULED state; changes generate audit entries; cancellation records a reason and transitions to CANCELLED; no-show transitions to NO_SHOW. | P0 | SRC-TRN-001, SRC-TRN-002, SRC-TRN-004 | Built |
| FR-TRN-021 | The system shall provide a centralized calendar view for training sessions, accessible by TMs and RDs, with week, month, and list views. | Calendar shows SCHEDULED sessions; week view is available (Don Hearn: "I spend more time with my weekly view"); sessions are filterable by type (discovery call, training, site visit, consignment audit, all events). | P0 | SRC-TRN-002 (Don Hearn: "Can we also make that so it's like a week view"), SRC-TRN-001 | Built |
| FR-TRN-022 | When a training session is scheduled or rescheduled, the system shall attempt to reflect the event in the assigned trainer's Outlook calendar according to the approved sync policy. | Session scheduling calls `tryAutoSyncCalendarEventToOutlook`; cancellation calls `tryAutoUnsyncCalendarEventFromOutlook`; failures are non-blocking and logged; Pulse retains authority over training records regardless of Outlook sync state. | P1 | SRC-TRN-002 (Curry: "can we incorporate an integration so that it just defaults to teams and automatically generates the team meeting"), SRC-TRN-003, SRC-TRN-004 | Partial (API calls are wired; email delivery parked behind Microsoft Graph credentials) |
| FR-TRN-023 | The system shall keep the meeting provider abstract and not hardcode Teams-specific or WebEx-specific behavior; a meeting link field accepts any URL; auto-generation of a Teams invite is a parked dependency on Microsoft Graph. | Meeting link is a free-text URL field; scheduling modal allows entry of any link; "auto-generate Teams link" is not offered as a default until Graph is certified. | P1 | SRC-TRN-002 (Michelle Hogan: "all of us use Microsoft Teams not WebEx"), SRC-TRN-003 | Built (abstract field) / Parked (auto-generate) |
| FR-TRN-024 | When scheduling from the calendar, a user shall be able to click a date to open a quick-schedule form with account, training type, trainer, date, time, and meeting link — and send it directly without additional navigation. | Single-click date opens scheduler; minimum required fields are account and training type; save creates the session and (if Graph enabled) sends the invite; Curry confirmed "all they could really [be] filling in is the title of the training and picking the right contact and hit send and it goes into their outlook". | P0 | SRC-TRN-002 (Curry: "just filling in the title… picking the right contact and hit send"), SRC-TRN-004 | Built |
| FR-TRN-025 | The system shall support bulk session scheduling for multiple accounts in a single action. | TrainingBulkScheduleModal supports selecting multiple accounts and creating sessions in one submission. | P2 | SRC-TRN-011 | Built |

### 4.4 Session Execution

| ID | Statement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-TRN-030 | The system shall support a check-in step for field and virtual training sessions that records the actual check-in time and any contextual notes before execution begins. | Session transitions from SCHEDULED to CHECKED_IN on check-in; check-in timestamp is stored; Pulse records the actual-start context separately from the planned-start time. | P0 | SRC-TRN-001 (Ahmad: "check-ins as well"), SRC-TRN-004 | Built |
| FR-TRN-031 | The system shall require structured completion details before a session can move to COMPLETED status: notes, attendance capture (attendee count or named attendees according to the program rule), duration, outcome, and any follow-up tasks. — ⚠️ CORRECTED 2026-06-18: completion proof/outcome is OPTIONAL (vendor-proposed); client rejected mandatory evaluations (see Scope corrections). | Session cannot be marked COMPLETED without minimum execution data per the cadence/template proof requirement; an incomplete session with missing required fields returns a validation error. | P0 | SRC-TRN-001, SRC-TRN-003, SRC-TRN-004 | Built |
| FR-TRN-032 | The system shall distinguish training sessions (activityKind = TRAINING) from site visits (activityKind = VISIT) in execution, reporting, and hours calculation; site visits shall not count toward training-hours totals. | TrainingActivityKind enum is applied per session; `countsTowardHours` is false for VISIT category types; training-hours delivery metric excludes VISIT sessions; ops queue and coaching view can filter by kind. | P0 | SRC-TRN-001 (Curry: "this is just a training tab… consignment [is] under territory management"), SRC-TRN-002, SRC-TRN-004 | Built |
| FR-TRN-033 | The system shall support follow-up task creation during or after a training session, with owner, due date, and status (OPEN, COMPLETED). | Follow-up tasks are attached to the session record; completing a task records completion time and notes; open follow-up count appears in coaching workload KPIs. | P1 | SRC-TRN-001, SRC-TRN-004 | Built |
| FR-TRN-034 | The system shall record no-show and cancellation outcomes as distinct terminal session states with a required reason. | CANCELLED state records reason and cancelled-by user; NO_SHOW state records no-show reason; both are visible in account training history and excluded from completion-rate metrics as appropriate. | P1 | SRC-TRN-004 | Built |

### 4.5 Proof and Evidence

| ID | Statement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-TRN-040 | The system shall enforce the proof requirement defined on the session's training template; sessions requiring CERTIFICATE_REQUIRED shall not close without a proof document uploaded. — ⚠️ CORRECTED 2026-06-18: completion proof/outcome is OPTIONAL (vendor-proposed); client rejected mandatory evaluations (see Scope corrections). | Proof requirement is read from the template at session creation; execution modal surfaces the proof-upload step based on requirement level; NOTES_ONLY sessions do not block completion on missing document. | P0 | SRC-TRN-001 (Curry: "we want [the app] to eliminate excuses for entering data"), SRC-TRN-003, SRC-TRN-004 | Built |
| FR-TRN-041 | The system shall support file-based proof upload per session (PDF, JPEG, PNG, WEBP, CSV; max 4 MB per document); proof documents shall carry upload timestamp, uploaded-by user, review status (PENDING, APPROVED, REJECTED), and reviewer. | `uploadTrainingSessionProof` stores to configured S3 path; `reviewTrainingSessionProof` records reviewer and status; download is available via pre-signed URL or stream. | P0 | SRC-TRN-004 | Built |
| FR-TRN-042 | The system shall surface a "proof required" indicator on the sessions list so Training Ops can see at a glance which scheduled sessions have an unfulfilled proof obligation. | Sessions list has a proof-required badge column; badge is visible before execution; UX-T-003 — currently open. | P1 | SRC-TRN-006 | Not built (UX-T-003 Open) |
| FR-TRN-043 | The system shall retain all proof documents and training session records for the agreed minimum retention period and shall not allow deletion of completed session records. | Proof documents are stored in S3 with persistent keys; no delete endpoint is exposed for completed sessions or their proof documents; retention policy is enforced at storage layer. | P1 | SRC-TRN-003 | Built (storage layer) |

### 4.6 Certification and Renewal

| ID | Statement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-TRN-050 | The system shall support certification-capable training types (isCertificationTrack = true); completing such a session shall produce a certificationOutcome of AWARDED, NOT_AWARDED, or PENDING_DECISION. | Two seeded certification types: `iaq_certification_curriculum` (IAQ Certification Curriculum) and `product_installations` (Product Installations); confirmed by Don Hearn in Session 9; completing either session presents the certification outcome step. | P0 | SRC-TRN-002 (Don Hearn: "it's the IQ certification curriculum… and now product installation certification"), SRC-TRN-004 | Built |
| FR-TRN-051 | The system shall issue a TrainingCertificationRecord when a certification-capable session is completed with outcome AWARDED; the record shall carry status ACTIVE, awardedAt, awardedBy, and trainingType reference. | Certification record is created in `completeTrainingSession` when outcome = AWARDED; record is visible on account certification history; awardedByUser is the completing actor. | P0 | SRC-TRN-002, SRC-TRN-004 | Built |
| FR-TRN-052 | The system shall support a PENDING_DECISION path for certification-capable sessions where the outcome is not immediately determinable; a governance actor shall later resolve it to AWARDED or NOT_AWARDED via the certification-decision endpoint. | Session with PENDING_DECISION is surfaced in the ops queue `pendingCertificationDecisionCount`; `resolveTrainingCertificationDecision` transitions the session and creates or skips the record; decision is audit-logged. | P0 | SRC-TRN-001 (Journey E — certification held for decision), SRC-TRN-004 | Built |
| FR-TRN-053 | Issued certifications shall follow the lifecycle: ACTIVE → EXPIRING (when within configurable window of expiry) → EXPIRED; they may also be RENEWED or REVOKED. — ⚠️ CORRECTED 2026-06-18: vendor-proposed/deferred, not client-confirmed (see Scope corrections). | Certification status is queryable; recertification queue surfaces EXPIRING and EXPIRED records; revoking a certification requires a reason and is audit-logged; revocation requires a confirmation step before submission. | P0 | SRC-TRN-002, SRC-TRN-004 | Partial (API built; UX-T-001 — no confirmation step before revocation — Open) |
| FR-TRN-054 | The system shall maintain a recertification queue that identifies certifications approaching expiry within a configurable window; the owning TM and RD shall see the queue filtered to their scope. — ⚠️ CORRECTED 2026-06-18: vendor-proposed/deferred, not client-confirmed (see Scope corrections). | `listTrainingRecertificationQueue` returns expiring/expired certifications scoped to actor; queue items show account, certification type, expiry date, and days until expiry; renewal session can be scheduled from the queue. | P0 | SRC-TRN-002 (Journey F), SRC-TRN-004 | Partial (API built; UX-T-004 — rendering verification and scheduled-renewal CTA needed — Open) |
| FR-TRN-055 | When a certification is completed (IAQ or Product Installation), the system shall record the reward association (demo unit or gift card) so that giveaway tracking is not managed outside Pulse. — ⚠️ CORRECTED 2026-06-18: vendor-proposed/deferred, not client-confirmed (see Scope corrections). | Certification completion can carry a reward note or linked program/giveaway reference; Michelle Hogan and Don Hearn confirmed gift cards ($50 per course) for product-installation completers and demo units for IAQ completers; reward linkage is tracked as program/giveaway association on the certification record. | P1 | SRC-TRN-002 (Don Hearn: "product installation will get you that… I give them gift cards $50 for each course"), SRC-TRN-002 (Michelle Hogan: "that's where it gets a little confusing — in the giveaways") | Not built (reward linkage to program/giveaway module) |

### 4.7 Reporting and Coaching

| ID | Statement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-TRN-060 | The system shall provide a TM coaching workload view showing upcoming sessions, overdue programs, open follow-up tasks, and certification windows for assigned accounts. | `getTrainingCoachingWorkload` returns upcoming sessions (next 30 days), overdue count, open follow-up task count, pending certification decision count; scoped to actor's territory by default. | P0 | SRC-TRN-002 (Journey G), SRC-TRN-004 | Built |
| FR-TRN-061 | The system shall provide an RD regional rollup equivalent of the coaching view with drill-down into territories and accounts. | RD actor calling coaching endpoint receives all territory programs in their region; territory penetration endpoint provides per-territory and per-region breakdowns; drill-through from coaching row to account program is required. | P0 | SRC-TRN-002, SRC-TRN-004 | Partial (API built; UX-T-002 — no drill-through from coaching row to account program — Open) |
| FR-TRN-062 | The system shall provide a territory training-penetration report showing accounts covered, sessions completed, training hours, overdue accounts, and certification posture by territory and region. | `getTerritoryTrainingPenetration` returns per-territory and per-region summaries; data includes coverage %, hours delivered, overdue count, active certifications; report tab shows this data with filters. | P0 | SRC-TRN-002, SRC-TRN-004 | Partial (API built; UX-T-009 — territory penetration table missing from reports tab — marked Done in UX-GAPS) |
| FR-TRN-063 | The system shall provide training hours reporting by account, territory, trainer, and period; hours shall be calculated from actual session duration for sessions where the training type countsTowardHours = true. | `deliveredTrainingHours` in overview is the sum of completed training-activity sessions where type countsTowardHours; compliance report provides per-account and per-trainer breakdowns; Michelle Hogan: "I would prefer to see revenue by state and then total… by month and then year to date — I would always want both". | P0 | SRC-TRN-002, SRC-TRN-004 | Built |
| FR-TRN-064 | The system shall provide an operational queue (ops queue) that surfaces overdue programs, open exceptions, and pending certification decisions in a single prioritized view for Training Ops. | `listTrainingOperationalQueue` returns cadence overdue items, execution exceptions, and certification pending-decision items; filterable by TM and RD owner; limit configurable. | P0 | SRC-TRN-004 | Built |
| FR-TRN-065 | The system shall provide a compliance report with per-account rollup, per-owner rollup, certification track rollup, and hours rollup; exportable for leadership review. | `listTrainingComplianceReport` returns all rollup types; report tab in TrainingWorkspace surfaces these; Michelle Hogan confirmed interest in month and year-to-date training volume. | P1 | SRC-TRN-002, SRC-TRN-004 | Built |

### 4.8 Mobile and Field Execution

| ID | Statement | Acceptance Criteria | Priority | SRC | Build Status |
|---|---|---|---|---|---|
| FR-TRN-070 | The system shall support mobile-ready training execution patterns for field TMs: scheduling, check-in, completing a session, capturing notes, and submitting proof from a mobile device. | All session lifecycle operations are available via the API used by a mobile surface; execution modal is mobile-appropriate; proof upload accepts photo (JPEG/PNG) from camera. | P0 | SRC-TRN-001 (Ahmad: "scheduling execution and completion tracking from the field"), SRC-TRN-003 | Built (API) / Partial (mobile surface not separately confirmed) |
| FR-TRN-071 | The system shall support offline-ready training execution for field scenarios where connectivity is not reliable; data shall sync to the server when the device reconnects. | Offline execution design does not require real-time API calls for core session completion; recorded data queues locally and syncs on reconnect; SRC-TRN-001 (Ahmad: "full functionality without connectivity… once the field guy connects it will sync data to the back-end server"). | P1 | SRC-TRN-001, SRC-TRN-003 | Parked (mobile offline queue design not confirmed as wired for training) |
| FR-TRN-072 | The system shall support voice-to-text input for training session notes in the field to reduce manual typing friction. | Voice-to-text is available on the notes field during session execution on mobile; Ahmad confirmed: "there will be a voice to text facility as well". | P1 | SRC-TRN-001 (Ahmad: "voice to text entry"), SRC-TRN-002 | Not built (confirmed as future capability in session 9) |

---

## 5. Non-Functional Requirements

| ID | Requirement | Target | Source |
|---|---|---|---|
| NFR-TRN-001 | Training session list and coaching view load time | Page must load within 3 seconds on a standard web connection | (inferred standard) |
| NFR-TRN-002 | Role-based data isolation | TMs must see only their assigned accounts' training data; RDs see their region; isolation enforced server-side via `buildAccountRecordScope` and `buildTrainingSessionRecordScope`; cannot be bypassed by URL manipulation | SRC-TRN-004 |
| NFR-TRN-003 | Proof document upload size | Max 4 MB per file; allowed types: PDF, JPEG, PNG, WEBP, CSV; enforced at API boundary | SRC-TRN-004 |
| NFR-TRN-004 | Proof document upload body limit | API enforces 8 MB body limit for proof upload requests | SRC-TRN-005 |
| NFR-TRN-005 | Training record retention | Training sessions, proof documents, and certification records must be retained for the agreed minimum period; no delete endpoint exposed for completed records | SRC-TRN-003 |
| NFR-TRN-006 | Audit trail | All catalog changes, session lifecycle transitions, certification issuance/revocation, and program creation must produce AuditEntry records with actorUserId, action, entityType, entityId, before/after data | SRC-TRN-004 |
| NFR-TRN-007 | Catalog governance | Training categories, types, and templates may only be created or modified by users with `training.catalog_manage` action permission; broader read access is allowed for all training-module roles | SRC-TRN-001 (Curry: "Training Ops will govern the training catalog"), SRC-TRN-004 |
| NFR-TRN-008 | Availability | Training module must be available on the same uptime SLA as the broader Pulse platform | (inferred standard) |
| NFR-TRN-009 | Observability | Training service operations must emit structured logs on error paths; proof upload/download errors must be surfaced to the caller rather than silently failing | (inferred standard) |
| NFR-TRN-010 | Accessibility | Training workspace and modals must meet WCAG 2.1 AA baseline for keyboard navigation and screen-reader compatibility | (inferred standard) |

---

## 6. Assumptions

| ID | Assumption | Why It Matters |
|---|---|---|
| ASM-TRN-001 | Training Ops will own catalog governance for categories, types, templates, and cadence rules. | Determines who can change the available training structure. |
| ASM-TRN-002 | TMs and RDs will inherit ownership from the account and territory model rather than owning a separate standalone training hierarchy. | Keeps training aligned with account responsibility and avoids duplicate assignment models. |
| ASM-TRN-003 | Dynamic AQS wants both onboarding training and ongoing relationship / training cadence in the same module. | Changes the breadth of the training model and the program-type distinction. |
| ASM-TRN-004 | Pulse will remain the authoring system for training records; Outlook acts as a connected scheduling reflection layer, not the source of truth. | Affects calendar ownership and user workflow; Pulse records survive Outlook sync failures. |
| ASM-TRN-005 | A lighter participant model (attendee count) is acceptable for most training sessions; named-attendee handling only required where certification evidence demands it. | Affects operational burden and certification detail depth. |
| ASM-TRN-006 | Proof requirements vary by training type rather than every training requiring the same heavy evidence standard. | Changes execution friction and compliance behavior. |
| ASM-TRN-007 | Field users may need offline-ready training execution in some travel scenarios. | Affects mobile workflow design and sync expectations. |
| ASM-TRN-008 | The initial onboarding training sequence is three live technical sessions (validated 2026-04-14); this is the confirmed baseline before ongoing TM-led cadence begins. | Determines the minimum program content for a newly activated customer. |
| ASM-TRN-009 | The trigger for initiating the onboarding training program is first order / customer activation, not the CIS form submission or discovery call. | This was explicitly validated in TRAINING_DISCOVERY_VALIDATION_2026-04-14.md and aligns with the broader customer-activation model. |

---

## 7. Open Questions

| ID | Question | Options to Confirm | Why Decision Is Needed |
|---|---|---|---|
| OQ-TRN-001 | Who will be allowed to issue, approve, or revoke certifications? | Training Ops / named approver / hybrid | Determines certification governance and audit authority; currently the `training.schedule` action controls this. |
| OQ-TRN-002 | What are the required cadence windows by training type? | 30-day for onboarding (seeded), 180-day for ongoing (seeded default) / configurable by type | Cadence policies are seeded with defaults but these must be confirmed before going live; overdue logic depends on these values. |
| OQ-TRN-003 | How much attendee detail is required? | Named attendees always / only for certifications / counts for routine sessions | Changes execution complexity and data model expectations; current implementation accepts attendee count. |
| OQ-TRN-004 | What proof standard should apply by training type beyond the seeded defaults? | Notes only / attendance + notes / photo / certificate / mixed by type | Determines field workflow and compliance burden; current seeds provide a baseline but type-by-type confirmation is needed. |
| OQ-TRN-005 | How should the existing external training/certification website coexist with Pulse? | Remain primary / remain reference-only / partial replacement / full replacement later | Changes scope and migration expectations; currently parked as a later-phase decision per SRC-TRN-003. |
| OQ-TRN-006 | What should the default meeting provider be for virtual training? | Teams (confirmed preferred by Michelle Hogan) / WebEx / selectable by user / none by default | Auto-generation of a Teams link is parked behind Microsoft Graph; but UI copy and meeting-link labelling need a decision. |
| OQ-TRN-007 | How much commercial-ready training scope should be included in this phase? | Residential-first / shared foundation only / broader launch set | Changes catalog and reporting breadth. |
| OQ-TRN-008 | Should training-adjacent giveaways, demo units, or value-delivered items (gift cards for product-installation certification) live inside training workflows in this phase? | Yes in module / reference only / separate later track | Confirmed by Don Hearn and Michelle Hogan that gift-card and demo-unit rewards are tied to certification completion; FR-TRN-055 is currently Not built. |
| OQ-TRN-009 | How should training hours be measured for leadership reporting? | Scheduled duration / actual duration / configurable by session type | Currently uses durationMinutes from the completed session; Don Hearn and Michelle Hogan want both monthly and YTD views. |
| OQ-TRN-010 | Should the offline-ready training execution (FR-TRN-071) use the same mobile draft queue pattern as consignment audits? | Yes, reuse mobile-draft-queue.ts pattern / separate implementation | Training-specific offline queue design is currently parked; decision needed before mobile field rollout. |

---

## 8. FR/NFR to SRC Traceability Matrix

| Requirement | Primary Source(s) | Speaker / Evidence |
|---|---|---|
| FR-TRN-001 (categories) | SRC-TRN-001, SRC-TRN-004 | Ahmad: MVP training management; catalog seeded in service.ts |
| FR-TRN-002 (training types) | SRC-TRN-002, SRC-TRN-004 | Don Hearn: IQ certification + product installation; seeded types in service.ts |
| FR-TRN-003 (templates + proof req) | SRC-TRN-001, SRC-TRN-004 | Curry: "eliminate excuses for entering data"; template seed in service.ts |
| FR-TRN-004 (cadence policies) | SRC-TRN-003, SRC-TRN-004 | Validated direction; cadence overrides seeded in service.ts |
| FR-TRN-005 (trainers) | SRC-TRN-002, SRC-TRN-004 | Ahmad + Curry discussing trainer availability in session 9 |
| FR-TRN-006 (stale-sync warning) | SRC-TRN-002, SRC-TRN-003 | Calendar two-way sync discussion; Outlook read-side parked |
| FR-TRN-010 (account-centric) | SRC-TRN-001, SRC-TRN-002, SRC-TRN-003 | Curry: "training anchored to account"; validated direction |
| FR-TRN-011 (account programs) | SRC-TRN-001, SRC-TRN-004 | Account training program model in service.ts |
| FR-TRN-012 (activation trigger) | SRC-TRN-003 | Validated: first-order trigger confirmed |
| FR-TRN-013 (onboarding vs ongoing) | SRC-TRN-003, SRC-TRN-004 | Three-session onboarding validated; category kind distinguishes |
| FR-TRN-014 (TM/RD obligations) | SRC-TRN-001, SRC-TRN-002 | Curry: "remove barriers"; Don: "scheduling + emails in one application" |
| FR-TRN-020 (session CRUD) | SRC-TRN-001, SRC-TRN-002, SRC-TRN-004 | Session lifecycle in service.ts and http.ts |
| FR-TRN-021 (calendar views) | SRC-TRN-002 | Don Hearn: "week view"; Ahmad showing month/list; "filter by type" |
| FR-TRN-022 (Outlook sync) | SRC-TRN-002, SRC-TRN-003, SRC-TRN-004 | Curry: auto-sync to Outlook; tryAutoSyncCalendarEventToOutlook wired |
| FR-TRN-023 (abstract meeting provider) | SRC-TRN-002, SRC-TRN-003 | Michelle: Teams preferred; auto-generate parked behind Graph |
| FR-TRN-024 (click-to-schedule) | SRC-TRN-002 | Curry: "all they [fill] in is the title… hit send" |
| FR-TRN-025 (bulk schedule) | SRC-TRN-011 | TrainingBulkScheduleModal.tsx exists |
| FR-TRN-030 (check-in) | SRC-TRN-001, SRC-TRN-004 | Ahmad: "check-ins as well"; checkInTrainingSession in service.ts |
| FR-TRN-031 (completion requirements) | SRC-TRN-001, SRC-TRN-003, SRC-TRN-004 | completeTrainingSession enforces minimum data |
| FR-TRN-032 (training vs visit) | SRC-TRN-001, SRC-TRN-002, SRC-TRN-004 | Curry: "this is just a training tab"; VISIT category type has countsTowardHours = false |
| FR-TRN-033 (follow-up tasks) | SRC-TRN-001, SRC-TRN-004 | createTrainingFollowUpTask in service.ts |
| FR-TRN-034 (no-show / cancellation) | SRC-TRN-004 | cancelTrainingSession; NO_SHOW status in service.ts |
| FR-TRN-040 (proof enforcement) | SRC-TRN-001, SRC-TRN-003, SRC-TRN-004 | proofRequirement enforced in execution; template-driven |
| FR-TRN-041 (proof upload) | SRC-TRN-004 | uploadTrainingSessionProof; reviewTrainingSessionProof in service.ts |
| FR-TRN-042 (proof-required badge) | SRC-TRN-006 | UX-T-003 open |
| FR-TRN-043 (retention) | SRC-TRN-003 | No delete endpoint; S3 storage |
| FR-TRN-050 (cert tracks) | SRC-TRN-002, SRC-TRN-004 | Don Hearn named both cert types; isCertificationTrack seeded |
| FR-TRN-051 (cert issuance) | SRC-TRN-002, SRC-TRN-004 | completeTrainingSession creates TrainingCertificationRecord |
| FR-TRN-052 (pending decision) | SRC-TRN-001, SRC-TRN-004 | resolveTrainingCertificationDecision in service.ts |
| FR-TRN-053 (cert lifecycle) | SRC-TRN-002, SRC-TRN-004 | revokeTrainingCertification; UX-T-001 (confirmation step) open |
| FR-TRN-054 (recertification queue) | SRC-TRN-002, SRC-TRN-004 | listTrainingRecertificationQueue; UX-T-004 open |
| FR-TRN-055 (reward linkage) | SRC-TRN-002 | Don Hearn: $50 gift cards + demo units on completion; not built |
| FR-TRN-060 (coaching workload) | SRC-TRN-002, SRC-TRN-004 | getTrainingCoachingWorkload in service.ts |
| FR-TRN-061 (RD rollup) | SRC-TRN-002, SRC-TRN-004 | getTerritoryTrainingPenetration; UX-T-002 open |
| FR-TRN-062 (territory penetration) | SRC-TRN-002, SRC-TRN-004 | getTerritoryTrainingPenetration; UX-T-009 marked Done |
| FR-TRN-063 (hours reporting) | SRC-TRN-002, SRC-TRN-004 | deliveredTrainingHours in overview; Michelle: month + YTD |
| FR-TRN-064 (ops queue) | SRC-TRN-004 | listTrainingOperationalQueue in service.ts |
| FR-TRN-065 (compliance report) | SRC-TRN-002, SRC-TRN-004 | listTrainingComplianceReport in service.ts |
| FR-TRN-070 (mobile execution) | SRC-TRN-001, SRC-TRN-003 | Ahmad: "scheduling execution and completion tracking from the field" |
| FR-TRN-071 (offline) | SRC-TRN-001, SRC-TRN-003 | Ahmad: "full functionality without connectivity"; parked |
| FR-TRN-072 (voice-to-text) | SRC-TRN-001, SRC-TRN-002 | Ahmad: "voice to text facility"; not built |
| NFR-TRN-002 (RBAC) | SRC-TRN-004 | buildAccountRecordScope + buildTrainingSessionRecordScope in service.ts |
| NFR-TRN-003/004 (upload limits) | SRC-TRN-004 | TRAINING_PROOF_MAX_BYTES = 4 MB; upload body limit = 8 MB |
| NFR-TRN-006 (audit trail) | SRC-TRN-004 | AuditEntry created in every mutating operation in service.ts |
| NFR-TRN-007 (catalog governance) | SRC-TRN-001, SRC-TRN-004 | assertActionAccess(actor.role, 'training.catalog_manage') |

---

## §UX-GAPS — Audit 2026-06-08

Gaps identified during a full platform UX/requirements audit. Organised by sprint priority.
All items with **Can do now = Yes** have no external dependency.

### Sprint 1 — Quick Wins (S effort)

| ID | Requirement | Component | Can do now? | Status |
|---|---|---|---|---|
| UX-T-001 | No confirmation step before certification revocation | TrainingCertificationOpsModal.tsx | Yes | Open |
| UX-T-002 | Coaching row has no drill-through to account training program | TrainingWorkspace.tsx | Yes | Open |
| UX-T-003 | No "proof required" badge column on sessions list | TrainingWorkspace.tsx | Yes | Open |
| UX-T-004 | Recertification queue rendering needs verification and scheduled-renewal CTA | TrainingWorkspace.tsx | Yes | Open |

### Sprint 2 — Core Workflow (M effort)

| ID | Requirement | Component | Can do now? | Status |
|---|---|---|---|---|
| UX-T-005 | No onboarding training program initiation action from account activation | TrainingWorkspace.tsx | Yes | Done |
| UX-T-006 | No cadence-rule management UI in catalog admin tab | TrainingWorkspace.tsx | Yes | Done |
| UX-T-007 | No trainer records CRUD UI — fetchTrainingTrainers exists but no UI | TrainingWorkspace.tsx | Yes | Done |
| UX-T-008 | File upload in execution modal proof step unconfirmed — no FileInput wired | TrainingSessionExecutionModal.tsx | Yes | Done |
| UX-T-009 | Territory training-penetration table missing from reports tab | TrainingWorkspace.tsx | Yes | Done |

_To be completed during the review meeting._
