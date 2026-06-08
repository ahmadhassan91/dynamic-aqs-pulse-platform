# Pulse Platform — Calendar Module PRD

## 1. Document Control

| Field | Value |
|---|---|
| Version | 2.0 |
| Date | 2026-04-20 |
| Status | Scope confirmation draft for Dynamic AQS review |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS operations lead, IT / Microsoft 365 stakeholder, training stakeholder, territory stakeholder |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, Leads PRD, Training PRD, Territory PRD |

---

## 2. Executive Summary

The Calendar module will give Dynamic AQS one centralized operational calendar inside Pulse across the event families that matter to revenue operations and field execution. Pulse will provide day, week, month, and list visibility; show discovery, training, visits, and later audit-style activity in one place; and connect scheduling back to the owning workflow instead of forcing users into disconnected calendars and double entry. Outlook will be supported as a connected reflection layer for approved users and approved event families, while Pulse will remain the source of operational truth.

---

## 3. Module Objective

Pulse will provide a calendar experience that will:

- centralize operational scheduling visibility across approved modules
- support day, week, month, and list views for different planning horizons
- let users move from calendar into the owning workflow quickly
- reduce double entry between Pulse and Outlook
- support admin-governed rollout of Outlook-connected behavior
- provide one scheduling surface leadership and operations can trust

---

## 4. Scope Statement

### 4.1 Pulse Will Support

- a centralized Pulse calendar module
- day, week, month, and list views
- unified visibility across approved event families
- filters by event family, owner, account / lead, and territory where relevant
- event drill-through into the owning source workflow
- Outlook connection for approved internal users
- target-calendar selection and admin-governed rollout policy
- Pulse-to-Outlook reflection for approved event families
- admin settings for pilot rollout, provider defaults, and connection policy
- role-aware visibility and scheduling behavior
- recurring scheduling patterns where Dynamic AQS wants repeatable operational planning

### 4.2 This PRD Will Also Cover

- which event families will belong in the calendar
- whether Pulse or Outlook is the authoring source of truth
- how Teams / WebEx / meeting-provider behavior should be treated
- how shared-calendar or delegated usage should be approached in this phase

### 4.3 Later-Phase / Separate Decision Items

These items remain part of the broader Pulse vision, but require separate approval or dependency closure:

- full bidirectional reconciliation between Outlook and Pulse
- broader provider support beyond Microsoft Outlook / Microsoft 365
- deeper audit / consignment family expansion if not approved now
- richer reminder and notification behavior outside Outlook-connected flows
- more advanced scheduling intelligence or optimization

---

## 5. Primary Future-State User Journeys

### 5.1 Journey A — User Opens The Centralized Calendar

1. The user opens Pulse calendar.
2. Pulse shows the user’s permitted events in day, week, month, or list format.
3. The user filters by event family, owner, account / lead, or territory.
4. The user clicks an event and moves directly into the owning workflow.

### 5.2 Journey B — User Schedules From Pulse And Sees Outlook Reflect It

1. A user schedules a discovery or training event through the owning Pulse workflow.
2. The event appears immediately in Pulse calendar.
3. If the owner has an approved Outlook connection, the event is reflected to Outlook.
4. If the event is rescheduled or cancelled in Pulse, the Outlook reflection updates accordingly.

### 5.3 Journey C — Admin Controls Rollout

1. An admin opens calendar integration settings.
2. The admin defines whether the Outlook connection is enabled, which users are in pilot scope, and the relevant meeting-provider defaults.
3. Pulse uses those policy settings to control who can connect and what behavior is available.

### 5.4 Journey D — Leadership Reviews Upcoming Operational Activity

1. A leadership or operations user opens the centralized calendar.
2. Pulse shows upcoming discovery, training, visits, and other approved event families in one place.
3. The user uses the calendar as a planning and oversight surface instead of checking individual Outlook calendars one by one.

### 5.5 Journey E — Territory Or Training User Uses Weekly Planning View

1. A TM, RD, or trainer opens the week view.
2. Pulse shows hourly placement of relevant events for the week.
3. The user identifies open time, upcoming sessions, and operational load more easily than in list-only views.

---

## 6. Functional Capabilities

### 6.1 Centralized Event Visibility

Pulse will:

- provide one calendar module across approved event families
- support day, week, month, and list views
- support event-family, owner, account / lead, and territory filters
- provide a clean event detail / drill-through path

### 6.2 Source-Workflow Ownership

Pulse will:

- keep the owning workflow responsible for the actual business action
- use the calendar as a visibility and launch surface unless Dynamic AQS explicitly wants broader direct scheduling at calendar level
- keep discovery tied to lead workflows and training tied to training workflows

### 6.3 Outlook Reflection

Pulse will:

- support per-user Outlook connection
- support calendar selection where approved
- reflect approved Pulse-owned events into Outlook
- update or remove reflected events when Pulse changes the source event
- provide admin-governed rollout rather than uncontrolled universal enablement

### 6.4 Meeting Provider Handling

Pulse will:

- support meeting-provider policy for eligible virtual events
- support a consistent tenant or user-level provider preference where Dynamic AQS wants it
- preserve the source workflow and event context when generating or reflecting meeting details
- remain future-ready for recurring scheduling and repeatable planning patterns where Dynamic AQS approves them

### 6.5 Operational Value

Pulse will:

- let leadership review operational workload in one place
- let territory and training users plan weekly activity
- reduce double entry across CRM and Outlook
- support future expansion of event families without redesigning the calendar model

---

## 7. Business Rules Pulse Will Enforce

| # | Rule |
|---|---|
| BR-C-01 | Pulse will remain the operational source of truth for approved event families unless Dynamic AQS approves a broader two-way scheduling model. |
| BR-C-02 | The calendar will respect record-scope permissions from the underlying modules. |
| BR-C-03 | Events will not appear to a user simply because they are in the calendar module; visibility will still follow ownership and access rules. |
| BR-C-04 | Outlook reflection will apply only to approved users and approved event families. |
| BR-C-05 | Day, week, month, and list views will all be treated as first-class calendar views. |
| BR-C-06 | Meeting-provider behavior will follow the approved Dynamic AQS policy rather than ad hoc user behavior. |
| BR-C-07 | The calendar model will remain future-ready for later event families such as audits or broader field visits. |

---

## 8. Data And Integration Highlights

At business level, this module will depend on and feed the following:

| Area | Proposed Pulse Role |
|---|---|
| Leads | Discovery and qualifying meetings will surface into the calendar |
| Training | Training sessions and related operational activity will surface into the calendar |
| Territory | Territory context and visibility will influence what a user can see |
| Outlook / Microsoft 365 | Pulse will reflect approved events into connected Outlook calendars |
| Reporting | Calendar activity will contribute to operational visibility and later reporting |

---

## 9. Assumptions To Confirm

| # | Assumption | Why It Matters |
|---|---|---|
| A-C-01 | Dynamic AQS wants a single centralized operating calendar inside Pulse rather than continuing with module-by-module calendar behavior. | This defines whether calendar is a true module or just a supporting component. |
| A-C-02 | Pulse should remain the scheduling source of truth and Outlook should behave primarily as a reflection layer. | This affects ownership of edits and integration design. |
| A-C-03 | Microsoft Outlook / Microsoft 365 is the first and primary external calendar provider for this phase. | This affects provider scope and rollout. |
| A-C-04 | Day, week, month, and list views are all needed for launch. | This affects user planning experience and prototype parity. |
| A-C-05 | Leadership and operations need visibility across multiple event families, not just training. | This affects the breadth of the calendar feed. |
| A-C-06 | Admin-governed pilot rollout is the right way to introduce Outlook-connected behavior. | This affects change management and support. |

---

## 10. Open Questions For Dynamic AQS Decision

| # | Question | Options To Confirm | Why Decision Is Needed |
|---|---|---|---|
| Q-C-01 | Which event families must be included in the first approved calendar scope? | discovery + training only / include visits / include audits / other combination | This defines the real launch boundary. |
| Q-C-02 | What is the final scheduling ownership model? | Pulse-first / Outlook-first / mixed by event family | This changes system-of-record behavior. |
| Q-C-03 | What meeting provider behavior is expected for virtual events? | Teams by default / WebEx by default / user choice / no generated links | This affects invites, policies, and integration work. |
| Q-C-04 | How much shared-calendar behavior is required in this phase? | personal calendar only / selectable shared calendar / delegated write support | This affects rollout complexity and Microsoft 365 policy requirements. |
| Q-C-05 | Should users schedule directly from the centralized calendar for all families, or mainly launch the source workflows from it? | launch surface only / mixed / full scheduling workspace | This affects where business rules live. |
| Q-C-06 | Who owns reminder behavior? | Outlook reminders only / Pulse dashboard only / both by role | This affects notification scope and user expectations. |
| Q-C-07 | Should completed visits, training, and audits remain prominently visible in calendar history views? | yes across all / only by filter / only active items by default | This affects how calendar is used operationally versus historically. |
| Q-C-08 | Should recurring schedules or repeatable task patterns be part of the first approved calendar scope? | no recurring support / recurring visibility only / recurring creation and management | This determines how much planning behavior should live in the centralized calendar from day one. |

---

## 11. Later-Phase / Separate Decision Items

These items may still belong in the broader Pulse roadmap, but will not be assumed as finalized by this PRD:

- full two-way reconciliation between Outlook and Pulse
- additional providers such as Google or Apple calendar
- richer notification/reminder engine beyond the approved first phase
- expanded audit and field-event families if not approved in this meeting
- deeper scheduling intelligence and optimization

---

## 12. Approval Checklist

Dynamic AQS approval of this PRD will confirm:

- the calendar should exist as a centralized Pulse module
- the proposed source-of-truth model is directionally correct
- the event-family and Outlook-connectivity direction is acceptable
- day/week/month/list views are the right planning surfaces
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
| UX-C-001 | No empty state when date range has no events | CalendarWorkspace.tsx | Yes | Open |
| UX-C-002 | Scheduler modal missing "this also creates a record in the source workflow" info banner | CalendarSchedulerModal.tsx | Yes | Open |
| UX-C-003 | No in-app reminder settings on scheduler modal | CalendarSchedulerModal.tsx | Yes | Open |
| UX-C-004 | Event click drill-through to owning record unverified | CalendarWorkspace.tsx | Yes | Open |

### Sprint 2 — Core Workflow (M effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-C-005 | No territory filter in calendar workspace | CalendarWorkspace.tsx | Yes | Open |
| UX-C-006 | No account/lead filter in calendar workspace | CalendarWorkspace.tsx | Yes | Open |
| UX-C-007 | Recurring schedule toggle absent in scheduler modal | CalendarSchedulerModal.tsx | Yes | Open |

### Sprint 3 — New Surfaces (L effort)
| ID | Requirement | Component | Can do now? | Status |
|----|-------------|-----------|-------------|--------|
| UX-C-008 | Day/week/month grid views not implemented — list view only (BR-C-05 requires all four) | CalendarWorkspace.tsx | Yes | Open |

_To be completed during the review meeting._
