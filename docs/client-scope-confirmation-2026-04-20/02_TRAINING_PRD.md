# Pulse Platform — Training Module PRD

## 1. Document Control

| Field | Value |
|---|---|
| Version | 2.0 |
| Date | 2026-04-20 |
| Status | Scope confirmation draft for Dynamic AQS review |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS training operations lead, operations leadership, territory leadership, certification approver |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, Leads PRD, Territory PRD, Calendar PRD |

---

## 2. Executive Summary

The Training module will turn training from a mix of Outlook calendars, individual follow-up habits, spreadsheets, and external site references into a governed account-centric operating system. Pulse will support training catalog management, account training programs, scheduling, field execution, proof capture, certification tracking, overdue and recertification visibility, and reporting tied to territory ownership. The module will support both the onboarding training path for newly activated customers and the ongoing territory-led training and coaching motion that Dynamic AQS uses for adoption, retention, and growth.

---

## 3. Module Objective

Pulse will provide a training system that will:

- anchor training to the account and its territory ownership
- give Training Ops a governed catalog and scheduling process
- let TMs and RDs see training obligations and overdue follow-up clearly
- provide a centralized calendar-backed view of upcoming training activity
- support check-in / check-out, notes, proof, and follow-up from field execution
- support offline-ready field execution patterns where a user may need to complete training activity and sync when connectivity returns
- support certification issuance, renewal, expiry, and revocation workflows
- surface training penetration, overdue accounts, and recertification windows to leadership
- surface training-hours reporting by account, state, territory, trainer, and customer relationship

---

## 4. Scope Statement

### 4.1 Pulse Will Support

- admin-managed training categories, types, templates, cadence rules, and trainer setup
- customer/account training programs linked to the account lifecycle
- onboarding training sequences for newly activated customers
- training session scheduling, rescheduling, cancellation, and completion
- training-vs-site-visit distinction in execution and reporting
- structured check-in / check-out, notes, attendance, and follow-up capture
- proof capture and evidence storage for sessions that require it
- certification-capable training types and certification records
- recertification queue and overdue visibility
- TM and RD coaching workload views
- territory training-penetration reporting and regional rollup
- centralized calendar visibility for training sessions
- Outlook reflection for approved scheduling paths
- mobile-ready training execution patterns for field teams
- offline-ready training execution where approved field workflows require sync-after-reconnect behavior

### 4.2 This PRD Will Also Cover

- how onboarding training and ongoing training will differ
- how Training Ops, TMs, RDs, and approvers will interact with the same module
- how proof, certification, and cadence will be governed
- how training will feed territory reporting and customer-readiness visibility

### 4.3 Later-Phase / Separate Decision Items

These items remain part of the broader Pulse vision, but require separate approval or later sequencing:

- advanced training ROI analytics and deeper sales-lift modeling
- full commercial curriculum expansion beyond the agreed first phase
- external content-library or LMS-style expansion
- richer dealer-facing self-service training experiences
- broader mobile field execution depth beyond the confirmed training workflows

---

## 5. Primary Future-State User Journeys

### 5.1 Journey A — Training Ops Maintains The Catalog

1. Training Ops opens the training administration workspace.
2. Training Ops creates or updates categories, types, templates, cadence rules, proof requirements, and trainer records.
3. Pulse makes those governed catalog options available consistently for scheduling and reporting.
4. Retired catalog entries remain historically visible where they already exist on prior sessions.

### 5.2 Journey B — Account Training Program Begins After Customer Activation

1. A lead reaches the approved activation boundary and becomes a customer account.
2. Pulse creates or initiates the account’s training program according to the approved onboarding model.
3. The owning TM and RD inherit visibility to the account’s training obligations.
4. Training Ops and territory ownership can see what is due, what is scheduled, and what is still missing.

### 5.3 Journey C — User Schedules Training In Pulse

1. A user selects the account, training type, trainer, date, time, mode, and attendees.
2. Pulse creates the training session in the training workflow.
3. The session appears in Pulse calendar views and any role-appropriate training views.
4. If Outlook reflection is enabled for the owner, the event is mirrored to Outlook.

### 5.4 Journey D — Field User Executes A Training Session

1. The trainer or TM checks in for the session.
2. Pulse records the actual activity context and planned session type.
3. On completion, the user records notes, attendees or attendee count, proof, and follow-up needs.
4. Pulse marks the session complete, cancelled, or no-show with the required evidence.

### 5.5 Journey E — Certification Is Issued Or Held For Decision

1. A certification-capable training session is completed.
2. The user records the certification outcome.
3. Pulse either:
   - issues the certification,
   - holds it pending decision, or
   - records that certification was not awarded.
4. Approved certifications continue through active, expiring, expired, renewed, or revoked states.

### 5.6 Journey F — Recertification Queue Drives Renewal

1. Pulse identifies certifications approaching expiry.
2. The account appears in the recertification queue for the relevant owner and operational team.
3. The renewal session is scheduled and completed.
4. Pulse updates the certification state according to the approved renewal rule.

### 5.7 Journey G — TM Or RD Uses Coaching View

1. A TM opens their coaching workload view and sees upcoming sessions, overdue accounts, pending follow-ups, and certification windows.
2. An RD opens the equivalent regional view with drill-down into territories and accounts.
3. Pulse helps territory leadership decide where intervention is needed next.

---

## 6. Functional Capabilities

### 6.1 Catalog And Governance

Pulse will:

- support training categories, types, and templates managed by admin / Training Ops
- support standard dropdown-driven consistency plus controlled custom presentations
- support trainer records and trainer availability context
- support cadence policies by training type
- keep certification-capable training types explicit rather than hidden in notes

### 6.2 Account-Centric Programs

Pulse will:

- keep training attached to the customer account
- inherit TM and RD ownership from the account and territory truth
- distinguish onboarding program requirements from ongoing customer-development training
- support program-level visibility for what is required, completed, overdue, or pending

### 6.3 Scheduling And Calendar

Pulse will:

- create, reschedule, and cancel training sessions
- support trainer, customer, and account context on every scheduled session
- provide centralized calendar visibility for training events
- reflect approved training events into Outlook according to approved policy
- preserve Pulse as the operational source of truth for training records

### 6.4 Session Execution

Pulse will:

- support check-in and check-out patterns for field and virtual training
- distinguish training from site visits
- require structured completion details
- capture attendance or attendee count according to the approved program rule
- support follow-up tasks created during or after a session

### 6.5 Proof And Evidence

Pulse will:

- support proof requirements by training type or program
- capture file-based proof where required
- retain proof metadata and auditability
- allow lighter completion for routine sessions where Dynamic AQS does not require heavyweight evidence

### 6.6 Certification And Renewal

Pulse will:

- support certification-capable training types
- issue certification records where requirements are satisfied
- support pending decision, active, expiring, expired, renewed, and revoked states
- support recertification queues and renewal workflows
- provide leadership and operational visibility into who is current, who is expiring, and who has lapsed

### 6.7 Reporting And Coaching

Pulse will:

- support training operations reporting
- support overdue and exception views
- support TM and RD workload views
- support territory penetration and regional rollups
- support reporting on training cadence, completion, exceptions, certification posture, and training hours delivered

---

## 7. Business Rules Pulse Will Enforce

| # | Rule |
|---|---|
| BR-T-01 | Training will be anchored to customer/account context rather than operating as a detached generic scheduler. |
| BR-T-02 | TM and RD ownership will follow the account and territory truth unless Dynamic AQS approves a different override rule. |
| BR-T-03 | Training and site visits will remain distinct activity types even if both can be scheduled and logged through related workflows. |
| BR-T-04 | Training completion will require the approved minimum execution data before a session can close. |
| BR-T-05 | Certification-bearing sessions will follow stricter evidence and decision rules than ordinary training sessions. |
| BR-T-06 | Training Ops will govern the training catalog unless Dynamic AQS approves broader edit rights. |
| BR-T-07 | Recertification and overdue logic will follow configurable cadence rules rather than hard-coded timing. |
| BR-T-08 | Pulse will remain the operational record of training truth even when Outlook reflects scheduling. |

---

## 8. Data And Integration Highlights

At business level, this module will depend on and feed the following:

| Area | Proposed Pulse Role |
|---|---|
| Accounts / Customers | Training programs and sessions will attach to customer accounts |
| Territory | TM / RD ownership and penetration reporting will align to territory truth |
| Calendar | Training sessions will appear in the centralized calendar |
| Outlook | Approved training schedules will reflect into Outlook for connected users |
| Reporting | Training completion, cadence, penetration, and certification posture will feed reporting |
| Leads / Activation | Onboarding training expectations will begin when the customer activation workflow reaches the approved point |

---

## 9. Assumptions To Confirm

| # | Assumption | Why It Matters |
|---|---|---|
| A-T-01 | Training Ops will own catalog governance for categories, types, templates, and cadence rules. | This determines who can change the available training structure. |
| A-T-02 | TMs and RDs will inherit ownership from the account and territory model rather than owning a separate standalone training hierarchy. | This keeps training aligned with account responsibility. |
| A-T-03 | Dynamic AQS will want both onboarding training and ongoing relationship/training cadence in the same module. | This changes the breadth of the training model. |
| A-T-04 | Pulse will remain the authoring system for training records, while Outlook will act as a connected scheduling reflection layer. | This affects calendar ownership and user workflow. |
| A-T-05 | A lighter participant model will be acceptable for many training sessions, with stricter named-attendee handling only where required. | This affects operational burden and certification detail depth. |
| A-T-06 | Proof requirements will vary by program rather than every training requiring the same heavy evidence standard. | This changes execution friction and compliance behavior. |
| A-T-07 | Field users may need offline-ready training execution in some travel scenarios rather than assuming reliable connectivity at every customer location. | This affects mobile workflow design and execution expectations. |

---

## 10. Open Questions For Dynamic AQS Decision

| # | Question | Options To Confirm | Why Decision Is Needed |
|---|---|---|---|
| Q-T-01 | Who will be allowed to issue, approve, or revoke certifications? | Training Ops / named approver / hybrid | This determines certification governance and audit authority. |
| Q-T-02 | What are the required cadence windows by training type? | quarterly / six-month / annual / configurable by type | This determines overdue and recertification logic. |
| Q-T-03 | How much attendee detail is required? | named attendees always / only for certifications / counts for routine sessions | This changes execution complexity and data model expectations. |
| Q-T-04 | What proof standard should apply by training type? | notes only / attendance + notes / photo / certificate / mixed by type | This determines field workflow and compliance burden. |
| Q-T-05 | How should the existing external training/certification website coexist with Pulse? | remain primary / remain reference-only / partial replacement / full replacement later | This changes scope and migration expectations. |
| Q-T-06 | What should the default meeting provider be for virtual training? | Teams / WebEx / selectable by user / none by default | This affects calendar policy and invite behavior. |
| Q-T-07 | How much commercial-ready training scope should be included in this phase? | residential-first / shared foundation only / broader launch set | This changes catalog and reporting breadth. |
| Q-T-08 | Should training-adjacent giveaways, demo units, or value-delivered items live inside training workflows in this phase? | yes in module / reference only / separate later track | This changes what business value is captured at session level. |
| Q-T-09 | How should training hours be measured for leadership reporting? | scheduled duration / actual duration / configurable by session type | This determines how Dynamic AQS will use training volume in customer-value and operational reporting. |

---

## 11. Later-Phase / Separate Decision Items

These items may still belong in the broader Pulse roadmap, but will not be assumed as finalized by this PRD:

- deeper ROI and sales-attribution analytics
- richer content-library / LMS capabilities
- broader dealer self-service certification experiences
- more advanced trainer-capacity optimization
- extended commercial curriculum expansion beyond approved scope

---

## 12. Approval Checklist

Dynamic AQS approval of this PRD will confirm:

- the training module should be account-centric and territory-linked
- the proposed training lifecycle is directionally correct
- the proposed catalog, scheduling, proof, and certification scope is acceptable
- the coaching and reporting expectations are framed correctly
- the open questions capture the real decisions still needed

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
| UX-T-001 | No confirmation step before certification revocation | TrainingCertificationOpsModal.tsx | Yes | Open |
| UX-T-002 | Coaching row has no drill-through to account training program | TrainingWorkspace.tsx | Yes | Open |
| UX-T-003 | No "proof required" badge column on sessions list | TrainingWorkspace.tsx | Yes | Open |
| UX-T-004 | Recertification queue rendering needs verification and scheduled-renewal CTA | TrainingWorkspace.tsx | Yes | Open |

### Sprint 2 — Core Workflow (M effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-T-005 | No onboarding training program initiation action from account activation | TrainingWorkspace.tsx | Yes | Done |
| UX-T-006 | No cadence-rule management UI in catalog admin tab | TrainingWorkspace.tsx | Yes | Done |
| UX-T-007 | No trainer records CRUD UI — fetchTrainingTrainers exists but no UI | TrainingWorkspace.tsx | Yes | Done |
| UX-T-008 | File upload in execution modal proof step unconfirmed — no FileInput wired | TrainingSessionExecutionModal.tsx | Yes | Done |
| UX-T-009 | Territory training-penetration table missing from reports tab | TrainingWorkspace.tsx | Yes | Done |

_To be completed during the review meeting._
