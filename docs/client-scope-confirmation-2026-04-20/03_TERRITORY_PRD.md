# Pulse Platform — Territory Module PRD

## 1. Document Control

| Field | Value |
|---|---|
| Version | 2.0 |
| Date | 2026-04-20 |
| Status | Scope confirmation draft for Dynamic AQS review |
| Module owner | Pulse delivery team |
| Primary reviewers | Dynamic AQS territory leadership, Regional Director representative, Territory Manager representative, operations lead |
| Related documents | `00_README_AND_MEETING_AGENDA.md`, Leads PRD, Training PRD, Calendar PRD |

---

## 2. Executive Summary

The Territory module will be the ownership, visibility, and field-operations kernel for Pulse. It will define regions, territories, shipping-center alignment, TM and RD ownership, assignment overrides, and the map-based command center used to understand who owns what and what needs attention next. Territory will not be just a map page. It will determine who sees leads, accounts, and training records; it will drive account and lead assignment; and it will provide the operational view needed for reassignment, route planning, coverage review, and exception handling.

---

## 3. Module Objective

Pulse will provide a territory system that will:

- define the official TM / RD ownership structure
- align state-based residential territory truth to the approved map and shipping-center model
- support territory creation, change, reassignment, and history
- drive role-scoped visibility across leads, accounts, training, and calendar
- provide a territory command center for leadership and field teams
- expose a map-centered view of coverage, ownership, and workload
- support the business need for overrides where geography is not the whole story

---

## 4. Scope Statement

### 4.1 Pulse Will Support

- region, territory, and shipping-center administration
- TM and RD ownership assignment
- state-based territory coverage for the residential operating model
- lead and account assignment using approved territory rules
- named-owner or override handling where approved
- assignment history and override reasons
- territory visibility rules for TM, RD, Strategic Growth, leadership, and admin roles
- command-center views for coverage, workload, lifecycle posture, and pipeline posture
- interactive territory map with approved coverage colors and shipping-center context
- account and lead drill-through from territory surfaces
- territory administration actions including reassignment and bulk transfer
- territory-linked visibility for downstream modules including training and calendar

### 4.2 This PRD Will Also Cover

- how geography, territory ownership, and override rules interact
- how Dynamic AQS’ current paper map will translate into live territory truth
- how map expectations differ between leadership, office users, and field users
- which decisions still need to be confirmed before the territory model is locked

### 4.3 Later-Phase / Separate Decision Items

These items remain part of the broader Pulse vision, but require separate approval, provider choice, or later sequencing:

- county-level commercial territory depth
- polygon editing and more advanced restructure tools
- route optimization provider selection and deep navigation behavior
- richer white-space / heat-map analysis
- deeper ERP-backed revenue trending

---

## 5. Primary Future-State User Journeys

### 5.1 Journey A — Admin Defines The Territory Footprint

1. An authorized admin creates or updates regions, territories, shipping centers, and covered states.
2. Pulse assigns the correct RD and TM ownership to the territory.
3. The territory becomes available for lead routing, account assignment, reporting, and map display.

### 5.2 Journey B — Territory Manager Uses The Command Center

1. The TM opens the Territory workspace.
2. Pulse shows only the territory, accounts, leads, and training obligations the TM is allowed to see.
3. The TM reviews coverage, pipeline, overdue follow-up, and upcoming operational activity.
4. The TM drills into the map or directly into the relevant account or lead record.

### 5.3 Journey C — Regional Director Uses Regional Rollup

1. The RD opens the Territory workspace.
2. Pulse shows every territory and owner inside the RD’s region.
3. The RD reviews rollups for coverage, lifecycle posture, pipeline posture, and ownership gaps.
4. The RD drills into any territory, owner, or account that requires intervention.

### 5.4 Journey D — Lead Or Account Is Reassigned

1. An authorized user opens the relevant lead or account.
2. The user changes the territory or named owner and provides a reason.
3. Pulse applies the new ownership and records the prior and new values in assignment history.
4. Visibility updates according to the new ownership truth.

### 5.5 Journey E — Bulk Territory Transfer

1. An authorized admin selects a source territory and a target territory.
2. The admin selects all or some accounts to move and records the reason.
3. Pulse transfers the accounts and writes per-record history and audit events.
4. The source and target territory views refresh with the new ownership truth.

### 5.6 Journey F — Office User Uses The Map For Assignment Decisions

1. An operations or leadership user opens the map workspace.
2. Pulse shows territory coverage, shipping-center alignment, and relevant lead/account points.
3. The user filters the map and opens drill-through details to assess assignment or next action.
4. The user uses the territory view as an operational planning surface, not just a static map.

---

## 6. Functional Capabilities

### 6.1 Territory Structure And Governance

Pulse will:

- support regions, territories, and shipping centers as explicit governed records
- support TM and RD ownership assignment
- align active territories to the approved state-based coverage footprint
- support territory-level policy settings where Dynamic AQS requires them

### 6.2 Assignment And Propagation

Pulse will:

- resolve lead and account ownership from approved territory rules
- propagate territory truth into downstream account and training views
- support explicit override or named-owner scenarios where Dynamic AQS approves them
- preserve assignment history and the reason for change

### 6.3 Visibility And Ownership

Pulse will:

- scope TM visibility to their territory truth
- scope RD visibility to their region truth
- support broader scopes for Strategic Growth, leadership, and admin roles according to approved rules
- use territory truth consistently across list views, map views, dashboards, and downstream modules

### 6.4 Command Center And Reporting

Pulse will:

- provide territory and regional rollups
- show coverage posture, lifecycle posture, pipeline posture, and owner workload
- support operational visibility into what needs follow-up next
- feed territory-linked reporting from account, lead, and training activity

### 6.5 Map And Operational View

Pulse will:

- display the territory footprint in a map-based workspace
- align the visual map to the approved Dynamic AQS territory structure
- show shipping-center context and operational coverage
- provide lead/account drill-through from the map
- support office-side and field-side use of territory context

### 6.6 Administrative Actions

Pulse will:

- create and edit territory records
- update state coverage
- update TM / RD ownership
- reassign individual records
- support bulk account transfer between territories

---

## 7. Business Rules Pulse Will Enforce

| # | Rule |
|---|---|
| BR-TR-01 | Territory will function as an ownership and visibility kernel, not only as a visual map. |
| BR-TR-02 | Each active covered state in the approved residential model will belong to one active territory at a time unless Dynamic AQS explicitly approves a different overlay rule. |
| BR-TR-03 | Territory assignment and override changes will be auditable. |
| BR-TR-04 | Reassignment will preserve the original author and timestamp of prior notes, activities, and history. |
| BR-TR-05 | Lead, account, training, and relevant calendar visibility will follow the same territory truth wherever possible. |
| BR-TR-06 | A named-owner override will supersede default geography only where Dynamic AQS approves that operating rule. |
| BR-TR-07 | Territory reporting will use CRM-owned coverage and ownership truth first; ERP-backed revenue depth will follow as a separate dependency-backed layer. |
| BR-TR-08 | The map will reflect the approved operating footprint; it will not be treated as a free-form drawing tool unless Dynamic AQS approves that level of territory-editing depth later. |

---

## 8. Data And Integration Highlights

At business level, this module will depend on and feed the following:

| Area | Proposed Pulse Role |
|---|---|
| Leads | Territory will drive or influence routing, ownership, and visibility |
| Accounts / Customers | Territory will determine account ownership, reporting, and reassignment history |
| Training | Territory will scope TM / RD visibility and training-penetration reporting |
| Calendar | Territory will contribute visibility and context for territory-linked events |
| Reporting | Territory will provide per-territory, per-region, and per-owner operational rollups |
| Maps | Pulse will render the operational footprint against the approved territory structure |

---

## 9. Assumptions To Confirm

| # | Assumption | Why It Matters |
|---|---|---|
| A-TR-01 | The Phase 1 residential territory truth will be state-based and aligned to the approved Dynamic AQS paper map. | This determines how the initial territory kernel is structured. |
| A-TR-02 | Shipping-center alignment remains part of territory truth, not just a reporting attribute. | This affects territory administration and operational planning. |
| A-TR-03 | TM and RD ownership will remain the core operational hierarchy for territory visibility. | This affects command-center design and access patterns. |
| A-TR-04 | Office users will need the territory map for assignment and review decisions, not only TMs in the field. | This affects map detail, filtering, and drill-through expectations. |
| A-TR-05 | Named-owner or Strategic Growth overrides will exist, but they will be explicit and auditable rather than informal exceptions. | This affects territory truth and role visibility. |
| A-TR-06 | The Phase 1 model should remain future-ready for commercial/county logic even if the first release remains residential/state-first. | This affects how rigidly the model is tied to today’s residential structure. |

---

## 10. Open Questions For Dynamic AQS Decision

| # | Question | Options To Confirm | Why Decision Is Needed |
|---|---|---|---|
| Q-TR-01 | What is the exact precedence rule between Strategic Growth ownership and default geographic TM ownership? | geography first / SGT override first / conditional by lead type / conditional by stage | This determines assignment truth and visibility. |
| Q-TR-02 | When does territory ownership become operationally binding? | at lead intake / after discovery / after CIS / after activation | This affects routing and pre-handoff visibility. |
| Q-TR-03 | What is the approved truth model for accounts with multiple locations? | account-level owner only / location-aware ownership / hybrid with primary owner | This affects propagation and visibility rules. |
| Q-TR-04 | Is a district layer required in the hierarchy? | no district / optional district / required district | This changes hierarchy complexity and reporting shape. |
| Q-TR-05 | How much map precision is required in this phase? | state-based only / ZIP-aware / county-aware / custom shapes later | This changes territory-editing expectations and data-model depth. |
| Q-TR-06 | What should the pre-handoff TM visibility rule be? | no visibility / visibility after certain stage / configurable by territory | This affects lead and account access before handoff. |
| Q-TR-07 | What later-phase route-planning depth should be assumed? | operational map only / route planning included / provider-backed optimization later | This affects whether territory is treated primarily as an ownership kernel or also as a field-operations engine from day one. |

---

## 11. Later-Phase / Separate Decision Items

These items may still belong in the broader Pulse roadmap, but will not be assumed as finalized by this PRD:

- county-level commercial territory logic
- polygon drawing and territory restructure tooling
- deep route optimization provider behavior
- white-space analytics and advanced heat-map reporting
- richer ERP-backed territory revenue analytics beyond CRM-owned operational posture

---

## 12. Approval Checklist

Dynamic AQS approval of this PRD will confirm:

- the proposed territory hierarchy and ownership model are directionally correct
- the map is expected to be an operational surface, not just a static visualization
- the assignment, visibility, and reassignment expectations are framed correctly
- the command-center reporting direction is acceptable
- the open questions capture the real business decisions still needed

### Module Status

- `Approved`
- `Approved with amendments`
- `Parked pending decision`
- `Needs rewrite`

### Notes

_To be completed during the review meeting._

