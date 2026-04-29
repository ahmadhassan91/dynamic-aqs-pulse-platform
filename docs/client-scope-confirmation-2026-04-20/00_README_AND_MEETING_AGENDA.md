# Pulse Platform Scope Confirmation Pack

**Client Review Pack**
**Meeting 1 Date:** April 20, 2026
**Meeting 2 Date:** April 22, 2026

---

## 1. Purpose Of This Pack

This folder contains the client-facing Product Requirements Documents (PRDs) for the first scope-confirmation meeting with Dynamic AQS.

These documents are intended to confirm:

- the future-state business workflows Pulse will support
- the module boundaries Dynamic AQS wants Pulse to own
- the assumptions we are carrying forward unless corrected
- the open decisions that need explicit direction before scope is locked

These documents are **not** delivery-status reports.

They intentionally describe the proposed Pulse scope in future tense:

- what Pulse **will** support
- what Pulse **will** integrate
- what Pulse **will** enforce
- what Pulse **will** surface for users and leadership

Where a topic still needs confirmation, the PRDs call that out as a decision point rather than treating it as resolved.

---

## 2. Modules In This Meeting

| # | Module | File |
|---|---|---|
| 1 | Leads | `01_LEADS_PRD.md` |
| 2 | Training | `02_TRAINING_PRD.md` |
| 3 | Territory | `03_TERRITORY_PRD.md` |
| 4 | Calendar | `04_CALENDAR_PRD.md` |
| 5 | Consignment | `05_CONSIGNMENT_PRD.md` |

Consignment is included here as the current working PRD mirror for development traceability. Pulse-owned workflow, audit, document, calendar, role, and dashboard work can proceed now; Acumatica-owned warehouse creation, inventory truth, transfer/receipt posting, PO creation, and financial settlement remain explicitly parked until sandbox access, certified endpoints, and field mappings are available.

The second meeting on **April 22, 2026** will cover the remaining module group:

- Foundation / Auth / Roles / Permissions
- Accounts / Contacts / Customers
- CIS / Finance / Onboarding
- Dealer / Portal-facing follow-through

---

## 3. How These PRDs Should Be Read

Each PRD is written to answer five client-facing questions:

1. What business outcome will this module support?
2. What user journeys will Pulse cover?
3. What rules and guardrails will the system enforce?
4. What assumptions are we currently carrying?
5. What decisions do we need from Dynamic AQS to finalize scope?

The goal of the meeting is not to walk line-by-line through every paragraph.

The goal is to leave the room with:

- confirmed flows
- corrected assumptions
- explicit business decisions
- clearly deferred follow-up items where needed

---

## 4. Recommended Review Method

For each module, use this sequence:

1. Read the Executive Summary and Scope Statement
2. Confirm the major user journeys
3. Review the Assumptions To Confirm
4. Decide the Open Questions / Options
5. Complete the Approval Checklist

If a topic is not ready for a decision, defer it explicitly with an owner and revisit trigger.

---

## 5. What “Approval” Means

Approval of a module PRD means Dynamic AQS agrees that:

- the proposed module scope reflects the intended business process
- the stated workflow ownership is correct
- the assumptions are accepted or corrected
- the open decisions are either resolved or explicitly deferred

Approval does **not** mean:

- every downstream implementation detail is fixed forever
- every integration dependency is already available
- every later-phase enhancement has been decided

It means the business scope and decision framework are accepted.

---

## 6. Suggested Meeting 1 Agenda

| Time | Duration | Topic | Focus |
|---|---:|---|---|
| 0:00 | 10 min | Kickoff | Review desired outcome, document use, decision logging |
| 0:10 | 20 min | Leads | Intake channels, dedupe, routing, classification, lifecycle, first-order boundary |
| 0:30 | 18 min | Training | Catalog, scheduling, proof, certification, reporting, ownership |
| 0:48 | 20 min | Territory | Territory truth, map expectations, reassignment, visibility, precedence rules |
| 1:08 | 17 min | Calendar | Pulse-owned scheduling truth, Outlook reflection, meeting providers, shared calendar expectations |
| 1:25 | 5 min | Close | Confirm decisions, deferred items, owners, and April 22 follow-ups |

---

## 7. Live Decision Log

| # | Module | Topic | Decision | Owner | Follow-Up | Needed By |
|---|---|---|---|---|---|---|
| 1 | Leads |  |  |  |  |  |
| 2 | Leads |  |  |  |  |  |
| 3 | Training |  |  |  |  |  |
| 4 | Territory |  |  |  |  |  |
| 5 | Calendar |  |  |  |  |  |

---

## 8. Parking Lot

| # | Module | Item | Why Parked | Revisit Trigger | Owner |
|---|---|---|---|---|---|
| 1 |  |  |  |  |  |

---

## 9. Approval Checklist For The Meeting

For each module, we should leave with one of these outcomes:

- `Approved`
- `Approved with amendments`
- `Parked pending named decision`
- `Needs rewrite before approval`

Recommended approval questions for each module:

1. Does this PRD describe the right future-state business flow?
2. Are the proposed role responsibilities correct?
3. Are the assumptions acceptable as written?
4. Are the open decisions framed correctly?
5. Are any important workflows or rules missing?

---

## 10. Notes On Scope Language

This pack intentionally distinguishes between three different things:

- **Core Phase 1 scope**  
  What Dynamic AQS expects Pulse to support in the initial operational release.

- **Later-phase / separate decision items**  
  Important capabilities that may still belong in the broader Pulse vision, but need separate approval, dependency closure, or later sequencing.

- **Dependencies requiring Dynamic AQS input or access**  
  Tenant access, provider choice, policy decisions, data contracts, or operating-rule confirmation.

This avoids a common failure mode where something is incorrectly labeled “out of scope” simply because engineering has not finished building it yet.

---

## 11. Desired Outcome From Meeting 1

By the end of the April 20 review, we should have:

- confirmed module direction for Leads, Training, Territory, and Calendar
- explicit answers or parks for the main open decisions in each PRD
- agreement on which dependencies belong to Dynamic AQS
- a clear handoff into the April 22 module group

---

## 12. Versioning

| Version | Date | Author | Notes |
|---|---|---|---|
| 2.0 | 2026-04-20 | Pulse delivery team | Client-facing scope-confirmation pack rewritten for approval discussion |
